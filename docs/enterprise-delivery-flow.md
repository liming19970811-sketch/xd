# Enterprise Order to Delivery Flow V3.5.1

This document records the first cloud-authoritative delivery flow for the enterprise web app.

## Main Flow

```text
Project -> Quote confirmed -> Order created idempotently -> Delivery created
-> Delivery submitted -> Internal review -> Customer confirmation -> Completed
```

This phase does not add payment, logistics, invoices, or complex file management.

## Cloud Function

Path:

```text
cloudfunctions/enterprise_delivery
```

Request shape:

```json
{
  "action": "createDeliveryFromOrder",
  "sessionToken": "business session token",
  "data": {}
}
```

Response shape:

```json
{
  "success": true,
  "data": {}
}
```

Actions:

- `getDeliveryDashboard`
- `listDeliveries`
- `getDeliveryDetail`
- `createDeliveryFromOrder`
- `updateDelivery`
- `submitDelivery`
- `startDeliveryReview`
- `approveDelivery`
- `rejectDelivery`
- `confirmDeliveryByCustomer`
- `completeDelivery`
- `cancelDelivery`
- `getDeliveryActionHistory`

## Delivery Model

Collection:

```text
enterprise_deliveries
```

Suggested fields:

```js
{
  deliveryId,
  enterpriseId,
  projectId,
  orderId,
  sourceQuoteId,
  title,
  status,
  deliveryType,
  itemCount,
  submittedAt,
  reviewStartedAt,
  approvedAt,
  rejectedAt,
  customerConfirmedAt,
  completedAt,
  cancelledAt,
  createdByMemberId,
  updatedByMemberId,
  version,
  createdAt,
  updatedAt
}
```

The cloud session decides `enterpriseId`, operator member, role, and permissions. The page must not provide these authoritative fields.

## Status Machine

```text
draft -> preparing
preparing -> submitted
submitted -> reviewing
reviewing -> approved / rejected
rejected -> preparing
approved -> customer_confirmed
customer_confirmed -> completed
draft / preparing -> cancelled
```

`completed` and `cancelled` are terminal statuses.

## Order to Delivery

`createDeliveryFromOrder(orderId, { idempotencyKey })`:

- Validates the order exists.
- Validates the order belongs to the current enterprise.
- Requires `delivery.manage`.
- Keeps one main delivery per order.
- Repeated create requests return the existing delivery.
- Updates the order delivery summary when creation succeeds.
- Writes action history and audit records.

## Review Flow

- `submitDelivery`: `preparing -> submitted`
- `startDeliveryReview`: `submitted -> reviewing`
- `approveDelivery`: `reviewing -> approved`
- `rejectDelivery`: `reviewing -> rejected`

Review actions require `delivery.approve`. Reject requires a trimmed reason.

## Customer Confirmation

`confirmDeliveryByCustomer`: `approved -> customer_confirmed`

This phase does not add a separate external customer account system. The endpoint remains protected by the existing business session and delivery status checks.

## Completion

`completeDelivery`: `customer_confirmed -> completed`

Completion writes `completedAt`, increments `version`, records history/audit, and updates the related order delivery summary.

Project stage advancement from `delivery` to `completed` still needs integration with the cloud-side project stage API. The page does not mutate project stage directly.

## Formal Delivery Redline

`submitDelivery` checks `enterprise_delivery_items` before formal submission:

- No delivery items: `DELIVERY_ITEM_REQUIRED`
- `mock / fallback / test / placeholder / dummy`: `DELIVERY_ITEM_NOT_ELIGIBLE`
- `deliveryEligible=false`: `DELIVERY_ITEM_NOT_ELIGIBLE`

Mock or fallback output must not enter formal approved/completed delivery.

## Action History

Collection:

```text
enterprise_delivery_action_history
```

Fields:

```js
{
  historyId,
  enterpriseId,
  deliveryId,
  orderId,
  projectId,
  action,
  fromStatus,
  toStatus,
  operatorType,
  operatorMemberId,
  operatorName,
  reason,
  idempotencyKey,
  deliveryVersion,
  createdAt
}
```

## Permissions

- `delivery.view`: view deliveries
- `delivery.manage`: create, submit, customer-confirm, complete, and cancel deliveries
- `delivery.approve`: start review, approve, and reject deliveries

Pages only hide or show controls for UX. The cloud function repeats permission checks.

## Local Compatibility

- `local_mock` still uses the local delivery repository.
- Cloud-authenticated environments do not silently fall back to local writes.
- Old statuses `pending / delivered / confirmed` map into the new status machine.

## Suggested Indexes

`enterprise_deliveries`:

- `enterpriseId + updatedAt`
- `enterpriseId + status + updatedAt`
- `enterpriseId + projectId + updatedAt`
- `enterpriseId + orderId`
- High-selectivity or unique constraint on `orderId` where appropriate

`enterprise_delivery_items`:

- `enterpriseId + deliveryId + createdAt`
- `deliveryId + status`

`enterprise_delivery_action_history`:

- `enterpriseId + deliveryId + createdAt`
- `enterpriseId + deliveryId + idempotencyKey + action`
- `historyId`

## Deployment Steps

1. Confirm the cloud function root is `cloudfunctions/`.
2. Right-click `enterprise_delivery` in WeChat DevTools.
3. Choose "Upload and deploy: cloud install dependencies".
4. Create the collections and indexes listed above.
5. Verify the flow with a real enterprise account and a real cloud order.

## Launch Blockers

- `enterprise_delivery` still needs deployment.
- Cloud database collections and indexes still need to be created.
- The real order collection name must be confirmed as `enterprise_orders`.
- External customer confirmation credentials are not implemented in this phase.
- Real file download and deliverable acceptance need integration testing with real assets.
