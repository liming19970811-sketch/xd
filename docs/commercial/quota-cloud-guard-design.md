# quota_guard 云端强校验落地设计

## 1. 阶段目标

当前 `quota_guard` 仍是 mock/fallback 阶段，不能作为真实商业化扣点依据。P7 的目标是把真实落地方案写清楚，并在云函数中加入真实模式骨架，但不启用真实数据库扣减、不接支付、不允许真实 provider 被误触发。

本阶段边界：

- 默认 `ENABLE_REAL_QUOTA_GUARD !== 'true'`，继续走现有 mock。
- 如果 `ENABLE_REAL_QUOTA_GUARD === 'true'`，进入 real guard 分支，但返回 `REAL_QUOTA_GUARD_NOT_IMPLEMENTED`。
- 不允许把 mock 扣点误当成真实商业扣点。
- 真实 provider 调用前必须拿到 `quota_guard.consume*` 的 consumed 流水。

## 2. membership_usage 集合

集合名：`membership_usage`

建议唯一维度：`openid + period` 或 `userId + period`。真实上线前应按业务账号体系决定主键，避免同一用户多身份重复初始化。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `_id` | string | 数据库文档 ID |
| `openid` | string | 微信 OPENID，云函数从上下文读取 |
| `userId` | string | 业务用户 ID，可选但不应完全依赖前端传入 |
| `membershipTier` | string | 云端查询到的会员等级 |
| `period` | string | 统计周期，例如 `2026-06` |
| `monthlyAiPoints` | number | 本周期 AI 点数额度 |
| `monthlyAiPointsUsed` | number | 本周期已用 AI 点数 |
| `monthlyRefineQuota` | number | 本周期精修额度 |
| `monthlyRefineUsed` | number | 本周期已用精修额度 |
| `monthlyRunwayVideoQuota` | number | 本周期走秀视频额度 |
| `monthlyRunwayVideoUsed` | number | 本周期已用走秀视频额度 |
| `monthlySampleQuota` | number | 本周期样衣/实拍额度 |
| `monthlySampleUsed` | number | 本周期已用样衣/实拍额度 |
| `status` | string | `active` / `frozen` / `expired` |
| `createdAt` | string/date | 创建时间 |
| `updatedAt` | string/date | 更新时间 |

要求：

- 前端传入的 `membershipTier`、额度、已用量均不可信。
- 云端必须根据 `openid/userId` 查询真实会员权益。
- 如果当期 usage 不存在，应由云端按会员权益初始化。

## 3. membership_usage_records 集合

集合名：`membership_usage_records`

建议对 `idempotencyKey` 建唯一索引。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `_id` | string | 数据库文档 ID |
| `recordId` | string | 业务流水 ID |
| `openid` | string | 微信 OPENID |
| `userId` | string | 业务用户 ID |
| `period` | string | 统计周期 |
| `membershipTier` | string | 扣减时云端会员等级快照 |
| `action` | string | `consumeAiPoints` / `rollbackUsage` 等 |
| `actionType` | string | 原始动作类型 |
| `costActionType` | string | 成本归一后的动作类型 |
| `costType` | string | `ai_points` / `refine_quota` / `runway_video_quota` / `sample_quota` |
| `costValue` | number | 本次消耗值 |
| `beforeValue` | number | 扣减前 used 值 |
| `afterValue` | number | 扣减后 used 值 |
| `sourceTaskId` | string | 来源任务 ID |
| `extensionTaskId` | string | 二次加工任务 ID |
| `providerTaskId` | string | provider 返回的 task_id |
| `idempotencyKey` | string | 幂等键，必须唯一 |
| `status` | string | `pending` / `consumed` / `rolled_back` / `intent_recorded` / `failed` |
| `statusReason` | string | 状态原因 |
| `rollbackOfRecordId` | string | rollback 对应的原 consume 流水 |
| `createdAt` | string/date | 创建时间 |
| `updatedAt` | string/date | 更新时间 |

mock/fallback 行为：

- mock/fallback 不扣正式额度。
- 可记录 `status='intent_recorded'`，用于运营分析和人工跟进。

## 4. 幂等和唯一索引

规则：

1. `membership_usage_records.idempotencyKey` 必须唯一。
2. 所有 consume 类 action 必须带 `idempotencyKey`。
3. 推荐格式：`openid + actionType + sourceTaskId/clientTaskId + clientRequestId`。
4. 重复 `idempotencyKey` 时：
   - 已 `consumed`：直接返回原流水，不重复扣点。
   - `pending`：返回 pending 状态，不重复提交 provider。
   - `failed`：根据 `statusReason` 判断是否允许重试。
   - `rolled_back`：默认不自动重扣，除非产生新的 `idempotencyKey`。

禁止：

- 前端自行生成 cost 后让云端直接信任。
- 缺少 `idempotencyKey` 仍执行真实扣减。
- 网络重试时重复扣减。

## 5. 原子扣减设计

真实扣点必须使用数据库事务或条件更新。

AI 点数条件：

```text
monthlyAiPointsUsed + costValue <= monthlyAiPoints
```

精修额度条件：

```text
monthlyRefineUsed + 1 <= monthlyRefineQuota
```

视频额度条件：

```text
monthlyRunwayVideoUsed + 1 <= monthlyRunwayVideoQuota
```

样衣/实拍额度条件：

```text
monthlySampleUsed + 1 <= monthlySampleQuota
```

事务建议：

1. 获取调用者 `openid/userId`。
2. 根据云端会员表读取权益。
3. 查询或初始化当期 `membership_usage`。
4. 查询 `idempotencyKey` 是否已有流水。
5. 云端按 `costActionType/actionType` 计算成本。
6. 条件满足时更新 used 字段。
7. 写入 `membership_usage_records`，`status='consumed'`。
8. 提交事务并返回 consumed 流水。

扣减失败返回：

```text
reason = insufficient_quota
```

## 6. consume / rollback / finalize 上线流程

真实 provider 调用顺序必须是：

1. `resolveCostActionType`
2. `quota_guard.consumeAiPoints` 或对应 consume action
3. 得到 `status='consumed'` 的流水
4. 调用 provider
5. provider 未收到请求失败：调用 `rollbackUsage`
6. provider 已返回 `task_id`：不立即 rollback，进入 pending/轮询
7. provider 最终失败：根据 provider 状态做 finalize/rollback

允许 rollback：

- provider 未收到请求。
- 参数校验失败且未提交 provider。
- 云函数在请求 provider 前失败。

不允许立即 rollback：

- provider 已返回 `task_id`。
- provider 已接受异步任务。
- provider 成功但前端展示失败。

需要 pending/finalize：

- provider `task_id` 已创建但仍在生成中。
- 轮询超时。
- provider 最终失败。

rollback 流水要求：

- `rollbackOfRecordId` 指向原 consume 流水。
- rollback 记录 `status='rolled_back'`。
- `beforeValue/afterValue` 记录回滚前后。
- 原 consume 流水保留审计状态，不物理删除。

## 7. mock 与 real 模式边界

mock 模式：

- 默认启用。
- 不写真实数据库。
- consume 可返回 `consumed` 或 `intent_recorded`，但只用于体验和调试。

real 模式：

- 仅当 `ENABLE_REAL_QUOTA_GUARD === 'true'` 才进入。
- P7 阶段返回 `REAL_QUOTA_GUARD_NOT_IMPLEMENTED`。
- 上线前必须实现真实 membership 查询、usage 初始化、幂等唯一索引、事务扣减、rollback/finalize 状态机。

## 8. ai_generate 调用边界

真实 provider 调用前必须依赖 quota 流水：

- `ai_generate` 不应相信前端传入的 cost。
- `ai_generate` 调真实 provider 前必须拿到 consumed record 或可验证的 consume 上下文。
- `ENABLE_REAL_PROVIDER_CALL` 仍必须默认关闭。
- 即使打开 provider，也不能绕过 `quota_guard`。

## 9. 日志安全

允许打印：

- action
- actionType / costActionType
- costType / costValue
- status / reason
- hasIdempotencyKey
- recordId 短摘要
- enableRealQuotaGuard
- realModeImplemented

禁止打印：

- 完整图片 URL
- fileID / localPath
- endpoint 原文
- API key
- 真实支付参数
- 完整用户 prompt

## 10. P7 当前结论

本阶段只完成设计和云函数 TODO 骨架：

- 未启用真实数据库扣减。
- 未接真实支付。
- 未接真实 provider。
- 不影响现有 mock 链路。
- 真实上线前必须先完成 `membership_usage` / `membership_usage_records` 和事务扣减。

## 11. P10 真实数据库扣点 Alpha

P10 在 `quota_guard` 中加入真实数据库扣点 Alpha，但仍默认关闭。

开关：

```text
ENABLE_REAL_QUOTA_GUARD === 'true'
```

默认行为：

- `ENABLE_REAL_QUOTA_GUARD=false`：继续现有 mock 行为。
- `ENABLE_REAL_QUOTA_GUARD=true`：进入真实数据库 Alpha。

Alpha 支持：

- `debugConfig`
- `getUsageSummary`
- `checkAiPoints`
- `consumeAiPoints`
- `rollbackUsage`

暂不支持：

- `checkRefineQuota`
- `consumeRefineQuota`
- `checkRunwayVideoQuota`
- `consumeRunwayVideoQuota`

这些动作在 real 模式返回 `REAL_QUOTA_ACTION_NOT_IMPLEMENTED`，不会影响默认 mock 链路。

### real debugConfig

`debugConfig` 返回：

- `mock`
- `enableRealQuotaGuard`
- `realModeImplemented: true`
- `supportedActions`
- `costSource: server_action_type`
- `idempotencyRequiredForConsume: true`
- `collections.usage=membership_usage`
- `collections.records=membership_usage_records`

### real getUsageSummary

流程：

1. 从云函数上下文读取 `OPENID`。
2. 若缺少 `OPENID`，返回 `missing_openid`。
3. 使用 `usageId = openid + '_' + period` 查询 `membership_usage`。
4. 不存在则按服务端默认会员等级初始化 usage。
5. 返回 usage。

Alpha 默认会员等级沿用当前 mock：`self_799`。

### real checkAiPoints

流程：

1. 使用 `costActionType || actionType` 解析成本动作。
2. 服务端成本表计算 `costValue`。
3. 未知动作返回 `unknown_action_type`。
4. 读取 usage。
5. 如果 `monthlyAiPointsUsed + costValue > monthlyAiPoints`，返回 `insufficient_quota`。
6. 否则返回 `checked` record，不扣点。

### real consumeAiPoints

必填：

- `actionType` 或 `costActionType`
- `sourceTaskId`
- `idempotencyKey`

流程：

1. 缺少 `idempotencyKey` 返回 `missing_idempotency_key`。
2. 缺少 `sourceTaskId` 返回 `missing_source_task_id`。
3. 用 `idempotencyKey` 的 hash 作为流水文档 ID，先查重。
4. 已有 `consumed` 流水时直接返回，不重复扣点。
5. 已有 `pending` 流水时返回 pending。
6. 已有 `rolled_back` 流水时返回 `already_rolled_back`。
7. 没有流水时进入数据库事务。
8. 事务内读取 usage，判断额度，更新 `monthlyAiPointsUsed`，写入 `membership_usage_records`。

并发安全：

- Alpha 优先使用云数据库 `runTransaction`。
- 如果当前运行时不支持事务，返回 `transaction_failed`。
- 不使用“先读后写无条件覆盖”。

### real rollbackUsage

输入：

- `recordId` 或原 `idempotencyKey`
- `reason/statusReason`

流程：

1. 查找原 consumed 流水。
2. 找不到返回 `record_not_found`。
3. 已回滚则幂等返回已回滚结果。
4. 只有 `status=consumed` 才能 rollback。
5. 事务内读取 usage，将 `monthlyAiPointsUsed` 回滚到不小于 0。
6. 写入新的 rollback record，`rollbackOfRecordId` 指向原流水。
7. 原流水标记 `rollbackStatus=rolled_back`。

### Alpha 边界

- 不接支付。
- 不调用真实 provider。
- 不改变成本数值。
- 不改变 Upload/Result 主链路。
- 真实 provider 仍必须等待 `ENABLE_REAL_PROVIDER_CALL` 和 quota consumed record 同时满足。

## P13 全链路 smoke 与上线前审计索引

quota_guard 强校验、真实数据库扣点 Alpha、幂等、rollback/finalize 和上线前检查已汇总到：

```text
docs/smoke/full-chain-smoke-summary.md
```

真实 provider 接入前不得跳过：
- `ENABLE_REAL_QUOTA_GUARD=true` 数据库 smoke。
- `membership_usage_records.idempotencyKey` 唯一约束或等价幂等文档 ID 验证。
- `consumeAiPoints` 重复 idempotencyKey 不重复扣点验证。
- `rollbackUsage` 不对 provider 已 accepted task 立即回滚的流程验证。

## P14 quota_guard real Alpha 索引建议

`membership_usage`：

- `openid` 升序 + `period` 升序，建议唯一或业务唯一。
- `updatedAt` 降序。

`membership_usage_records`：

- `idempotencyKey` 升序，必须唯一。
- `openid` 升序 + `period` 升序 + `createdAt` 降序。
- `sourceTaskId` 升序。
- `recordId` 升序。
- `rollbackOfRecordId` 升序。

如果微信云数据库不支持直接配置唯一索引，`consumeAiPoints` 必须在 consume 前用 `idempotencyKey` 查询，并在事务内二次检查，防止重复扣点。P10 Alpha 当前使用幂等文档 ID 作为等价唯一约束，实机 smoke 仍需验证重复 `idempotencyKey` 不重复增加 `monthlyAiPointsUsed`。

P14 实机 smoke 文档：

```text
docs/smoke/quota-guard-real-alpha-smoke.md
```

## P18 Real Provider Gray Release Quota Gate

Real provider gray release is allowed only in mode G:

- `ENABLE_REAL_QUOTA_GUARD=true`
- `PROVIDER_DRY_RUN=false`
- `ENABLE_REAL_PROVIDER_CALL=true`
- `quota_guard.consumeAiPoints` has returned a consumed record
- `quotaRecordId`, `idempotencyKey`, and `costActionType` are passed to `ai_generate`

Forbidden combinations must not create usage ambiguity:

- Real provider enabled while real quota guard is disabled: block with `REAL_QUOTA_GUARD_REQUIRED`.
- Real provider enabled together with dryRun: block with `PROVIDER_SWITCH_CONFLICT`.
- dryRun without real quota guard: forbidden for device smoke; use local contract smoke only.

Before mode G, verify idempotent consume, rollback record linkage, repeated rollback behavior, and finalize policy. Provider accepted async tasks must not be immediately rolled back; they should enter pending/finalize handling.

## P19 quota terminal states

Quota record terminal state rules before real provider gray release:

- `consumed -> finalized`: provider has completed successfully; this is a success terminal state.
- `consumed -> rolled_back`: provider did not receive the request or failed before billable acceptance; this is a rollback terminal state.
- `finalized` cannot rollback.
- `rolled_back` cannot finalize.
- `consumed` is the only rollbackable intermediate state.
- Repeated consume with the same `idempotencyKey` returns the original `consumed`, `finalized`, or `rolled_back` record and never deducts twice.
- Repeated finalize returns the existing finalized record and does not write another terminal record.
- Repeated rollback returns the existing rollback result or duplicate state and never adds quota twice.

`finalizeUsage` updates the original consumed record to `status=finalized`, with `finalizedAt`, `finalizeReason`, and `updatedAt`. `rollbackUsage` writes a rollback record with `rollbackOfRecordId` and marks the original record rollback status for audit.

## P21 quota finalization in real provider canary

Quota state transition rules during the first real provider canary:

- Provider success -> `finalizeUsage(recordId)`.
- Provider explicit failure before accepted -> `rollbackUsage(recordId)`.
- Provider accepted async pending -> no finalize and no rollback until final status is known.
- `finalized` records cannot rollback.
- `rolled_back` records cannot finalize.
- Fallback mock cannot be used to hide real provider failure after a quota record has been consumed.

During incident rollback, keep `ENABLE_REAL_QUOTA_GUARD=true` for audit and repair, but immediately set `ENABLE_REAL_PROVIDER_CALL=false`. Do not delete quota records; record any rollback/finalize action with masked identifiers in the canary table.
