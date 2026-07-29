# Enterprise Cloud Release Checklist V3.5.1-A

This checklist is for release verification only. It does not introduce new business features.

## Verification Levels

- Static verification: local code structure, syntax, routes, status machines, sensitive strings.
- Local automated smoke: Node script checks that can run without CloudBase access.
- Cloud deployment verified: confirmed by CloudBase console or `tcb fn list/detail`.
- Cloud database verified: collections and indexes confirmed in CloudBase console.
- Single-account test: one real enterprise account completes the flow.
- Multi-account test: multiple members and enterprises verify RBAC and tenant isolation.
- Device test: browser H5 plus WeChat Mini Program confirms the real login and business flow.

Items without evidence must stay marked as `not_verified`.

## Cloud Functions

Required functions:

- `enterprise_auth`
- `enterprise_web_login`
- `enterprise_member`
- `enterprise_project`
- `enterprise_delivery`

For each function:

- Local directory exists.
- `index.js` exists and uses the expected entry.
- `package.json` exists and parses.
- No Hello World or sample response remains.
- No replacement-character mojibake remains.
- No sensitive value is logged.
- `node --check` passes.
- Cloud deployment is verified by console or CLI.

## Collections

Required collections:

- `enterprises`
- `enterprise_members`
- `enterprise_auth_sessions`
- `enterprise_auth_users`
- `enterprise_auth_identities`
- `enterprise_member_invites`
- `enterprise_role_permissions`
- `enterprise_projects`
- `enterprise_project_stage_history`
- `enterprise_quotes`
- `enterprise_orders`
- `enterprise_deliveries`
- `enterprise_delivery_items`
- `enterprise_delivery_action_history`
- Unified audit collection or function-specific audit collection

## Required Indexes

`enterprise_members`:

- `enterpriseId + userId`
- `enterpriseId + status`

`enterprise_member_invites`:

- `enterpriseId + status + createdAt`
- `enterpriseId + target identity + status`
- `inviteCodeHash`

`enterprise_role_permissions`:

- `enterpriseId + roleCode` unique

`enterprise_projects`:

- `enterpriseId + updatedAt`
- `enterpriseId + stage + updatedAt`
- `enterpriseId + projectId`

`enterprise_project_stage_history`:

- `enterpriseId + projectId + createdAt`
- `enterpriseId + projectId + idempotencyKey`

`enterprise_quotes`:

- `enterpriseId + projectId + updatedAt`
- `enterpriseId + quoteId`

`enterprise_orders`:

- `enterpriseId + projectId + updatedAt`
- `enterpriseId + sourceQuoteId`
- `sourceQuoteId` idempotency constraint

`enterprise_deliveries`:

- `enterpriseId + orderId`
- `enterpriseId + status + updatedAt`
- `orderId` unique or high-selectivity constraint

`enterprise_delivery_action_history`:

- `enterpriseId + deliveryId + createdAt`
- `deliveryId + idempotencyKey + action`

## Session Verification

Every enterprise cloud function must verify:

- `sessionToken` exists.
- Session document exists.
- Session is not expired.
- Session is not revoked.
- User exists.
- Member exists.
- Member belongs to the selected enterprise.
- Member status is `active`.

Forbidden:

- Trusting frontend `enterpriseId`.
- Trusting frontend `role`.
- Trusting frontend `permissions`.
- Silently writing local fallback data in a cloud-authenticated environment.

## RBAC Verification

Prepare:

- Admin or member manager.
- Operator member.
- Viewer member.
- Disabled member.

Verify:

- Viewer can only read allowed data.
- Viewer cannot invite members.
- Viewer cannot edit roles.
- Viewer cannot create or manage projects.
- Viewer cannot manage quotes, orders, or deliveries.
- Authorized member can operate only within assigned permissions.
- Disabled member is rejected by all enterprise cloud functions.
- Checks use permission keys, not `role === 'admin'` in pages.

## Tenant Isolation

Prepare two enterprises: Enterprise A and Enterprise B.

Verify Enterprise A cannot read or modify Enterprise B:

- Members
- Invites
- Role permissions
- Projects
- Stage history
- Quotes
- Orders
- Deliveries
- Delivery action history
- Audit records

Use direct service or cloud function calls. Do not rely only on page filtering.

## Project Flow

Verify:

- Project creation uses current enterprise context.
- Viewer is read-only.
- Legal stage advancement succeeds.
- Illegal stage jump is rejected.
- `expectedStage` conflict is rejected.
- `expectedVersion` conflict is rejected.
- Reused `idempotencyKey` does not duplicate history.
- Completed projects cannot continue advancing.

## Quote and Order Flow

Verify:

- Quote can be created from project.
- Quote can be sent.
- Quote can be confirmed.
- `QUOTE_CONFIRMED` creates an order.
- `sourceQuoteId` and `projectId` are preserved.
- Repeated confirmation does not create duplicate orders.
- Viewer cannot manage quotes or orders.
- Cross-enterprise quote/order access is rejected.
- Audit records exist.

## Delivery Flow

Verify:

- Delivery can be created from a valid order.
- One order has one main delivery.
- Repeated create returns existing delivery.
- `preparing -> submitted`
- `submitted -> reviewing`
- `reviewing -> approved`
- `reviewing -> rejected`
- `rejected -> preparing`
- `approved -> customer_confirmed`
- `customer_confirmed -> completed`
- Illegal transitions are rejected.
- Version conflict is rejected.
- Repeated idempotency key does not duplicate history.
- Completed delivery cannot continue changing.
- Completed delivery updates order status.
- Project `delivery -> completed` linkage is verified only after cloud project stage integration exists.

## Formal Delivery Redline

The cloud side must reject formal delivery review/completion for:

- `mock`
- `fallback`
- `dummy`
- `placeholder`
- `test`

Preferred fields:

- `isMock`
- `isFallback`
- `provider`
- `sourceType`
- `deliveryEligible`

The page hiding buttons is not enough. The cloud function must enforce this.

## Customer Confirmation Security

If a real external customer confirmation mechanism exists, verify:

- Credential expires.
- Plain token is not stored long term.
- Credential maps to one delivery only.
- Non-approved delivery cannot be confirmed.
- Cancelled delivery cannot be confirmed.
- Repeated confirmation is idempotent.
- Logs do not expose confirmation credentials.
- Customer confirmation does not forge an internal member operator.

If this mechanism does not exist yet, mark it as a launch blocker.

## Local Fallback

Verify:

- `local_mock` is explicit.
- Local fallback is read-compatible only where required.
- Cloud-authenticated failures do not silently write local data.
- Pages show a clear unavailable/error state when cloud service fails.

## Sensitive Information

Search code, docs, and logs for:

- `sessionToken`
- `accessToken`
- `OPENID`
- `UNIONID`
- `Secret`
- `secretId`
- `secretKey`
- `authorization`
- `inviteToken`
- `confirmToken`
- phone numbers
- email addresses
- signed image URLs

Do not copy real credentials into reports.

## Credential Rotation Checklist

If credentials may have appeared in historical logs:

1. Revoke current enterprise sessions.
2. Rotate exposed secrets or access credentials.
3. Remove real values from local test scripts.
4. Clean sensitive cloud function logs where the platform supports it.
5. Log in again and generate a new session.
6. Verify the old session is invalid.

## Current Known Blockers

- Cloud deployment cannot be marked verified without console or CLI evidence.
- Database collections and indexes cannot be marked verified without console or CLI evidence.
- Real multi-account RBAC and tenant isolation require test accounts.
- External customer confirmation credential security remains a launch blocker if no real credential flow exists.
