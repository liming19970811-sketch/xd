# Enterprise Cloud Deployment Runbook V3.5.1-A

Project root:

```text
C:\Users\1\Desktop\Diebian
```

Target CloudBase environment used in recent local configuration:

```text
cloudbase-d8ghr94wg306011e0
```

Confirm this envId before any production operation.

## 1. Local Preflight

Run from the project root:

```powershell
node scripts/enterprise-cloud-release-smoke.js
node scripts/enterprise-member-cloud-smoke.js
node scripts/enterprise-project-cloud-smoke.js
node scripts/enterprise-delivery-smoke.js
git diff --check
```

The smoke script separates static checks from cloud/manual checks. Do not treat `manual_required` items as passed.

## 2. Open WeChat DevTools

1. Completely close WeChat DevTools.
2. From HBuilderX, run the project to the WeChat Mini Program simulator.
3. Confirm the imported project is:

```text
C:\Users\1\Desktop\Diebian\unpackage\dist\dev\mp-weixin
```

4. Confirm `project.config.json` has:

```json
{
  "miniprogramRoot": "./",
  "cloudfunctionRoot": "cloudfunctions/"
}
```

5. Select cloud environment:

```text
cloudbase-d8ghr94wg306011e0
```

## 3. Deploy Cloud Functions

Deploy these functions one by one:

- `enterprise_auth`
- `enterprise_web_login`
- `enterprise_member`
- `enterprise_project`
- `enterprise_delivery`

For each function:

1. Right-click the function directory.
2. Select "Upload and deploy: cloud install dependencies".
3. Wait until deployment completes.
4. Open function details and confirm the latest update time.
5. Open function logs and confirm no startup error.

Do not claim deployment succeeded unless the console shows the deployed function/version.

## 4. Optional CLI Verification

If `tcb` is logged in and the envId is confirmed:

```powershell
tcb fn list
tcb fn detail enterprise_auth
tcb fn detail enterprise_web_login
tcb fn detail enterprise_member
tcb fn detail enterprise_project
tcb fn detail enterprise_delivery
```

If CLI login or permissions fail, use WeChat DevTools / CloudBase console as the source of truth.

## 5. Create Collections

Create or confirm these collections:

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

Also confirm the audit collection strategy. Existing functions may use function-specific audit collections until a unified audit collection is consolidated.

## 6. Create Indexes

Create the indexes listed in:

```text
docs/enterprise-cloud-release-checklist.md
```

Do not assume indexes exist. Verify each index in the CloudBase console.

## 7. Configure Function Invocation Permissions

Recommended baseline:

- `enterprise_web_login`: allow the ticket actions required for the mini program scan login flow.
- `enterprise_auth`: allow only necessary auth/register actions, with business `sessionToken` validation inside the function.
- `enterprise_member`: require enterprise session and RBAC.
- `enterprise_project`: require enterprise session and RBAC.
- `enterprise_delivery`: require enterprise session and RBAC.

Do not keep unconditional public write permissions for convenience.

## 8. Real Test Data

Create:

- Two enterprises: Enterprise A and Enterprise B.
- At least one admin/member manager.
- One operator member.
- One viewer member.
- One disabled member.

Use safe test data only. Do not use real customer personal data.

## 9. Real Flow Verification

Verify:

1. Login creates/restores a cloud session.
2. Current member is active.
3. RBAC permissions load from cloud.
4. Project is created under the current enterprise.
5. Project stage advances legally and writes stage history.
6. Quote is created from project.
7. Quote confirmation emits the existing order creation flow.
8. Order keeps `sourceQuoteId` and `projectId`.
9. Repeated quote confirmation does not duplicate orders.
10. Delivery is created from the order.
11. Repeated delivery creation returns the existing delivery.
12. Delivery moves through review and customer confirmation.
13. Delivery completion updates related order state.
14. Project completion linkage is tested only after the cloud project-stage integration is available.

## 10. Security Verification

Verify:

- Viewer cannot manage members, roles, projects, quotes, orders, or deliveries.
- Disabled member is rejected by all enterprise cloud functions.
- Enterprise A cannot read or modify Enterprise B resources.
- Pages are not trusted for tenant or permission decisions.
- Cloud logs do not include credentials, full user identifiers, phone numbers, email addresses, or signed file URLs.

## 11. Credential Rotation

If sensitive values may have appeared in historical logs:

1. Revoke enterprise sessions.
2. Rotate exposed secrets or access credentials.
3. Remove real values from local scripts/docs.
4. Clean cloud logs where the platform supports it.
5. Log in again and confirm the old session is invalid.

## 12. Rollback

If a cloud function deployment fails:

1. Do not continue the end-to-end test.
2. Restore the previous function version from CloudBase console if available.
3. Record the failed function, error message, and timestamp.
4. Keep business data unchanged.

If a database/index setup fails:

1. Stop write-flow tests.
2. Fix collections/indexes first.
3. Re-run the relevant smoke and manual checks.
