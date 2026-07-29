# 企业成员与 RBAC 云端权威化 V3.4.4

## 目标

本阶段将企业成员、成员邀请、成员状态和角色权限收口到 `enterprise_member` 云函数。前端页面只调用 service，不直接拼接 `enterpriseId`，也不直接写本地集合。

## 云函数

路径：`cloudfunctions/enterprise_member`

请求格式：

```json
{
  "action": "listMembers",
  "sessionToken": "业务会话令牌",
  "data": {}
}
```

返回格式：

```json
{
  "success": true,
  "ok": true,
  "data": {}
}
```

失败返回：

```json
{
  "success": false,
  "ok": false,
  "errorCode": "FORBIDDEN",
  "message": "无权限执行该操作"
}
```

## Actions

- `getCurrentMember`
- `listMembers`
- `getMemberDetail`
- `listInvites`
- `createInvite`
- `cancelInvite`
- `acceptInvite`
- `listRolePermissions`
- `updateRolePermissions`
- `updateMemberRole`
- `updateMemberStatus`

## 数据集合

- `enterprise_members`
- `enterprise_member_invites`
- `enterprise_role_permissions`
- `enterprise_member_audit_logs`
- `enterprise_auth_sessions`
- `enterprise_auth_users`
- `enterprises`

## Session 校验

云函数只信任 `sessionToken`，不信任前端传入的 `userId`、`enterpriseId`、`role` 或 `status`。

校验顺序：

1. `sessionToken` 存在。
2. `enterprise_auth_sessions` 中 session 存在。
3. session 未过期、未撤销。
4. session 包含当前 `enterpriseId` 和 `memberId`。
5. `enterprise_members` 中成员存在。
6. 成员属于当前 session 用户和企业。
7. 成员状态为 `active`。

## 权限模型

权限目录统一来自 `utils/permission/permissionCatalog.js`。

新增权限：

- `role.view`
- `role.manage`

默认角色：

- `admin`：全部权限
- `designer`：`project.view`、`project.manage`、`product.view`
- `operator`：`product.view`、`order.view`、`delivery.view`
- `finance`：`quote.view`、`order.view`
- `viewer`：`project.view`、`product.view`

云函数的 `requirePermission` 读取 `enterprise_role_permissions`。当企业尚未配置角色权限时，使用默认角色权限兜底。

## 邀请流程

1. 管理员在成员管理页创建邀请。
2. 云函数使用当前 session 推导企业与邀请人。
3. 创建 `enterprise_member_invites` 记录，状态为 `pending`。
4. 同一企业、同一账号、同一 pending 邀请不会重复创建。
5. 接受邀请时校验 token、状态和过期时间。
6. 成功后创建或激活 `enterprise_members` 记录。
7. 邀请状态更新为 `accepted`。

## 角色权限流程

1. 角色页读取云端 `listRolePermissions`。
2. `role.view` 可查看。
3. `role.manage` 可保存。
4. 保存时传入 `version`。
5. 云端版本不一致返回 `PERMISSION_VERSION_CONFLICT`。

## 成员状态保护

禁用成员时，云端检查企业内是否仍有至少一名 active 且拥有 `member.manage` 权限的成员。否则返回 `LAST_ADMIN_PROTECTION`。

## 审计

写入 `enterprise_member_audit_logs`：

- `MEMBER_INVITE_CREATED`
- `MEMBER_INVITE_CANCELLED`
- `MEMBER_INVITE_ACCEPTED`
- `MEMBER_ROLE_UPDATED`
- `MEMBER_STATUS_UPDATED`
- `ROLE_PERMISSIONS_UPDATED`

日志不记录完整手机号、邮箱、token、OPENID。

## 前端收口

- `pages/enterprise-web/members.vue` 通过 `memberService` 和 `memberInviteService` 读写。
- `pages/enterprise-web/roles.vue` 通过 `rolePermissionService` 读写。
- 云端 session 下调用失败不会静默写入本地。
- `local_mock` 仅用于开发显式模拟。

## 建议索引

- `enterprise_members`: `enterpriseId + memberId`
- `enterprise_members`: `enterpriseId + userId`
- `enterprise_member_invites`: `enterpriseId + emailHash + status`
- `enterprise_member_invites`: `enterpriseId + mobileHash + status`
- `enterprise_member_invites`: `inviteCodeHash`
- `enterprise_role_permissions`: `enterpriseId + roleCode`
- `enterprise_auth_sessions`: `sessionTokenHash`

## 部署

1. 在微信开发者工具中确认云函数根目录为 `cloudfunctions/`。
2. 右键 `enterprise_member`。
3. 选择“上传并部署：云端安装依赖”。
4. 在云开发控制台创建必要集合和索引。
5. 使用管理员账号进入 H5 企业工作台验证成员和角色页面。

## 上线阻塞项

- 需要部署 `enterprise_member` 云函数。
- 需要创建集合和索引。
- 需要云端真实 session 数据完成联调。
- 需要人工验证邀请接受入口的实际分发方式。
