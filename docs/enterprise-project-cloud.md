# 企业项目与阶段历史云端权威化 V3.4.5

## 范围

本阶段将企业项目、项目阶段推进和项目阶段历史收口到 `enterprise_project` 云函数。H5 企业网页通过 service 调用云函数，页面不再作为可信来源传入企业、成员、角色、权限或操作者信息。

不包含：报价确认、订单创建、交付业务规则、AI 生成链路、quota、provider、支付。

## 云函数

路径：`cloudfunctions/enterprise_project`

请求：

```json
{
  "action": "getProjectList",
  "sessionToken": "业务 sessionToken",
  "data": {}
}
```

响应：

```json
{
  "success": true,
  "ok": true,
  "data": {}
}
```

## Actions

- `getProjectList`
- `getProjectDetail`
- `createProject`
- `updateProject`
- `deleteProject`
- `advanceProjectStage`
- `getProjectStageHistory`

## 项目模型

集合：`enterprise_projects`

```js
{
  projectId,
  enterpriseId,
  name,
  description,
  stage,
  status,
  customerName,
  ownerMemberId,
  ownerName,
  startDate,
  dueDate,
  createdByMemberId,
  createdAt,
  updatedAt,
  version
}
```

`enterpriseId`、`createdByMemberId`、`ownerMemberId` 默认来自云端 Session 和当前 Member。`version` 用于乐观锁。

## 阶段模型

阶段顺序：

```text
draft -> design -> production -> review -> delivery -> completed
```

云端 `advanceProjectStage` 校验：

- `projectId`
- `nextStage`
- `expectedStage`
- `expectedVersion`
- `idempotencyKey`
- 当前项目存在且属于当前企业
- 当前成员 active
- 当前成员拥有 `project.manage`
- `nextStage` 是唯一合法下一阶段
- `completed` 后不可继续推进

冲突错误：

- `PROJECT_STAGE_CONFLICT`
- `PROJECT_VERSION_CONFLICT`
- `PROJECT_ALREADY_COMPLETED`
- `PROJECT_STAGE_INVALID`

## 阶段历史模型

集合：`enterprise_project_stage_history`

```js
{
  historyId,
  enterpriseId,
  projectId,
  fromStage,
  toStage,
  operatorMemberId,
  operatorName,
  reason,
  idempotencyKey,
  projectVersion,
  createdAt
}
```

历史由云端写入，普通页面不能修改或删除。查询按 `createdAt` 倒序。

## 幂等与并发

阶段推进使用：

- `projectId + idempotencyKey`
- `expectedStage`
- `expectedVersion`
- 项目 `version` 自增
- 云端二次读取和条件更新

重复 `idempotencyKey` 返回第一次历史结果，不重复推进、不重复写历史、不重复审计。

## 删除保护

`deleteProject` 需要 `project.delete`。

存在关联报价、订单或交付时返回：

```text
PROJECT_HAS_RELATED_BUSINESS
```

当前实现优先软删除：

```js
{
  status: 'deleted',
  deletedAt,
  deletedByMemberId
}
```

项目列表默认不返回 `deleted`。

## 前端变化

- `pages/enterprise-web/projects.vue` 通过 `utils/project/projectService.js` 加载项目。
- `pages/enterprise-web/project-detail.vue` 通过云端加载项目详情和阶段历史。
- 阶段推进携带 `expectedStage`、`expectedVersion`、`idempotencyKey`。
- 阶段历史加载失败时独立展示错误，不影响项目详情整体。
- 关联报价、订单、商品、交付区域保留现有只读读取方式。

## 本地兼容

- `local_mock` 下继续读取本地项目和 `project_stage_history`。
- 云端登录环境调用失败不会静默写本地。
- 旧本地数据不会自动覆盖云端同 `projectId` 数据。
- 迁移脚本默认 dry-run。

## 审计

集合：`enterprise_project_audit_logs`

记录：

- `PROJECT_CREATED`
- `PROJECT_UPDATED`
- `PROJECT_DELETED`
- `PROJECT_STAGE_ADVANCED`

不记录 `sessionToken`、OPENID、accessToken、Secret、完整客户联系方式和完整项目敏感描述。

## 建议索引

`enterprise_projects`：

- `enterpriseId + updatedAt`
- `enterpriseId + stage + updatedAt`
- `enterpriseId + status + updatedAt`
- `enterpriseId + projectId`
- `enterpriseId + ownerMemberId`

`enterprise_project_stage_history`：

- `enterpriseId + projectId + createdAt`
- `enterpriseId + projectId + idempotencyKey`
- `historyId`

唯一约束建议：

- `enterprise_projects`: `enterpriseId + projectId`
- `enterprise_project_stage_history`: `enterpriseId + projectId + idempotencyKey`

## 部署步骤

1. 在微信开发者工具确认云函数根目录为 `cloudfunctions/`。
2. 右键 `enterprise_project`。
3. 选择“上传并部署：云端安装依赖”。
4. 在云开发控制台创建集合和索引。
5. 用真实企业账号验证项目列表、详情、阶段推进和阶段历史。

## 仍需人工验证

- 云函数部署成功。
- 云数据库集合与索引已创建。
- CloudBase 事务 API 在当前环境可用。
- 多账号并发推进同一项目的冲突返回。
- 真实报价、订单、交付集合名称与删除保护检查一致。

## 上线阻塞项

- 未部署 `enterprise_project` 前，真实云端项目功能不可用。
- 未创建唯一索引前，极端并发下仍需云端联调确认幂等强度。
- 关联业务集合命名若与线上不一致，需要在云函数中调整删除保护集合名。
