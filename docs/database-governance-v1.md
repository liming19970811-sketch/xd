# 蝶变数据库结构、索引与数据迁移治理 V1

## 目标

本阶段建立数据库治理基线，避免功能持续增加后出现字段混乱、查询变慢和历史数据不可用。

本阶段不执行真实云端 DDL，不迁移生产数据，不在页面加载时静默改写历史记录。

## 核心集合

正式数据字典由 `utils/schema/schemaCatalog.js` 维护，覆盖：

- `users`
- `enterprises`
- `memberships`
- `usageRecords`
- `projects`
- `batches`
- `tasks`
- `assets`
- `deliveries`
- `patternMasters`
- `patternVersions`
- `reviews`
- `leads`
- `tickets`
- `auditLogs`
- `notifications`

主要业务记录统一包含：

- `id`
- `ownerId`
- `enterpriseId`
- `createdBy`
- `createdAt`
- `updatedAt`
- `status`
- `schemaVersion`

需要软删除的数据增加：

- `deletedAt`
- `deletedBy`
- `deleteReason`

## 状态枚举

任务、项目、批次、版型、审核、交付、工单、线索和迁移状态统一在 `STATUS_ENUMS` 中维护。

页面不得各自定义状态名称。历史状态必须在数据层通过 `normalizeStandardStatus(domain, value)` 转换。

## 索引设计

索引定义由 `INDEX_DEFINITIONS` 维护，每个索引必须有查询场景：

- `projects`: `enterpriseId + updatedAt`
- `tasks`: `ownerId + status + createdAt`
- `tasks`: `projectId + status + updatedAt`
- `tasks`: `batchId + status`
- `patternVersions`: `patternMasterId + version`
- `tasks`: `taskId + createdAt`
- `usageRecords`: `idempotencyKey`
- `leads`: `leadId + status`
- `assets`: `projectId + status + updatedAt`
- `tickets`: `enterpriseId + status + updatedAt`
- `auditLogs`: `enterpriseId + createdAt`
- `notifications`: `receiverId + status + createdAt`

不要盲目建立大量重复索引。新增索引前必须说明对应列表、搜索或详情链路。

## 分页规则

大列表必须分页，不得一次性全量读取：

- `tasks`: 默认 20，最大 100
- `projects`: 默认 20，最大 100
- `assets`: 默认 30，最大 120
- `patternMasters`: 默认 20，最大 80
- `auditLogs`: 默认 30，最大 100

排序必须使用稳定字段和游标，例如 `updatedAt + taskId`。

统计数据应使用独立聚合查询或汇总记录，避免前端循环请求详情形成 N+1。

## 迁移治理

迁移治理由 `utils/schema/migrationGovernance.js` 维护。

已定义迁移：

- `2026_07_schema_common_fields_v1`
- `2026_07_task_status_standard_v1`
- `2026_07_batch_task_snapshot_v1`
- `2026_07_asset_file_id_v1`
- `2026_07_project_enterprise_v1`
- `2026_07_pattern_versions_v1`
- `2026_07_usage_records_v1`

迁移必须支持：

- dry-run
- 预计影响数量
- 分批执行计划
- 成功、失败、跳过数量
- 安全重跑
- 暂停与恢复
- 迁移前备份
- 人工处理清单

V1 默认不直接批量写历史业务数据，执行结果进入 `paused` 或 dry-run 记录，后续专项脚本确认后再落库。

## 历史数据兼容

重点兼容：

- 旧任务状态
- 旧批次仅保存 `taskIds`
- 旧资产临时 URL
- 旧额度字段
- 旧项目缺少企业字段
- 旧版型缺少版本结构

无法自动迁移的数据进入人工处理清单，不伪造默认业务结果。

## 完整性检查

检查范围：

- 重复 ID
- 重复幂等键
- 缺失关联对象
- 非法状态
- 额度余额异常
- 跨企业引用
- 已交付资产版本缺失
- 版型版本号冲突
- 孤立文件

发现问题先生成修复建议，不自动删除数据。

## 管理入口

H5 管理入口：

- `/#/admin/schema-governance`
- `/#/admin/data-health`
- `/#/admin/backups`
- `/#/admin/recovery`

仅平台最高权限管理员可访问。

