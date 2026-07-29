# P21 真实 provider 灰度首轮执行方案

## 0. 灰度原则

- P21 只写方案，不开启真实 provider。
- 必须人工确认后才能进入真实调用。
- 首轮只允许单账号、单 action、单张图、低成本任务。
- 不允许 batch 批量真实调用。
- 不允许自动合并、自动部署、自动扩量。
- 出现任一停止条件，立即关闭 `ENABLE_REAL_PROVIDER_CALL`。
- 不打印 prompt、图片 URL、fileID、endpoint、API key、Authorization、原始 `idempotencyKey`。

## 1. 前置条件

进入真实 provider 灰度前，必须全部满足：

1. P20 A-F 实机 smoke 全部通过。
2. quota real Alpha consume 幂等通过。
3. `rollbackOfRecordId` 正确。
4. `finalizeUsage` 已实现。
5. finalized 后 rollback 被拒绝。
6. dryRun 缺 `quotaRecordId` 被 blocked。
7. dryRun 带 consumed `quotaRecordId` 可构建 requestPlan。
8. 禁止组合 E/F 已 blocked。
9. result 页 mock/fallback 审核通过被拦截。
10. batch-detail mock/fallback 审核通过被拦截。
11. real.js timeout 真 abort。
12. timeout 不 retry。
13. retry 只覆盖网络/429/5xx。
14. accepted async task 不 fallback mock。
15. 日志不泄露 prompt、图片 URL、endpoint、API key。
16. provider endpoint / API key 只存在云函数环境变量，不进代码仓库。

## 2. 首轮允许开关组合

只允许 P18 G：

```text
ENABLE_REAL_QUOTA_GUARD=true
PROVIDER_DRY_RUN=false
ENABLE_REAL_PROVIDER_CALL=true
```

必须遵守：

- 其他组合全部禁止用于真实调用。
- 如果 `PROVIDER_DRY_RUN=true` 且 `ENABLE_REAL_PROVIDER_CALL=true`，必须 blocked。
- 如果 `ENABLE_REAL_PROVIDER_CALL=true` 但 `ENABLE_REAL_QUOTA_GUARD=false`，必须 blocked。
- 真实调用前必须再次运行 `ai_generate debugConfig` 和 `quota_guard debugConfig`，确认 `switchMatrixMode=G_REAL_PROVIDER_GRAY_ALLOWED` 且 `switchMatrixAllowed=true`。

## 3. 首轮灰度范围

- 账号：仅开发者本人 openid / 测试账号。
- action：只允许一个低成本 action，优先 `fabric_replace` 或 `basic_recolor`；如果 `fabric_replace` real 仍未实现，则使用当前 real.js 已支持且成本最低的 action。
- 数量：1 个任务。
- 图片：一张无敏感信息、无客户隐私的测试图。
- 不允许 batch。
- 不允许客户真实订单。
- 不允许交付审核通过真实客户资产。
- 不允许开启自动重试扩量。

## 4. 执行顺序

| 步骤 | 操作 | 预期 |
| --- | --- | --- |
| 1 | 设置 `ENABLE_REAL_QUOTA_GUARD=true`、`PROVIDER_DRY_RUN=false`、`ENABLE_REAL_PROVIDER_CALL=true`，provider endpoint/key 仅放云函数环境变量 | 只进入 P18 G 组合 |
| 2 | 部署 `quota_guard` 和 `ai_generate` | 不部署无关页面，除非必要 |
| 3 | 执行 `ai_generate debugConfig` 和 `quota_guard debugConfig` | `switchMatrixMode=G`、`switchMatrixAllowed=true`、`hasEndpoint=true`、`hasApiKey=true`；只打印 boolean，不打印原文 |
| 4 | 调 `quota_guard consumeAiPoints` | 记录 masked `quotaRecordId`，确认 `status=consumed`，before/after 合理 |
| 5 | 调 `ai_generate` | 必须传 `quotaRecordId`、`quotaRecordStatus=consumed`、`idempotencyKey`、`costActionType`、`taskId/sourceTaskId`、合法输入 |
| 6 | provider 同步成功 | 提取结果但不打印 URL；调用 `finalizeUsage(recordId)`；record 进入 `finalized`；result 标记 `mock=false fallback=false provider=real` |
| 7 | provider accepted async task | 不 fallback mock；状态为 pending/provider_pending/accepted；保存 providerTaskId；不 finalize；不 rollback；进入轮询或人工检查 |
| 8 | provider 明确失败且未 accepted | 调 `rollbackUsage(recordId)`；`rollbackOfRecordId` 正确；result 不标记可交付 success；不生成 mock success 掩盖错误 |
| 9 | provider timeout | 确认底层 request abort；timeout 不 retry；根据 provider 是否 accepted 决定 pending 或失败；不盲目 rollback accepted task |
| 10 | 记录灰度结果 | 填写灰度记录表和日志编号 |

## 5. 停止条件

任一出现立即停止，关闭 `ENABLE_REAL_PROVIDER_CALL`：

- 真实 provider 请求超过 1 次。
- timeout 后仍继续 retry。
- provider accepted task 被 fallback mock。
- dryRun 或真实调用缺 `quotaRecordId` 仍成功。
- consume 第二次 `recordId` 不一致。
- finalized 后 rollback 成功。
- rollback 后 finalize 成功。
- `resultImageUrl` / `sourceImageUrl` / endpoint / API key 出现在 console。
- mock/fallback 能审核通过。
- batch 被真实调用。
- 非测试账号触发真实 provider。
- `pointsConsumed` / membership usage 异常。
- provider 返回错误但用户看到 success mock 图。
- 任务状态卡在 success 但无真实结果。

## 6. 回滚方案

1. 立即设置 `ENABLE_REAL_PROVIDER_CALL=false`。
2. 保持 `ENABLE_REAL_QUOTA_GUARD=true`，用于检查/修复 records。
3. 不删除 quota records，保留审计。
4. 对未 finalized 且 provider 明确失败的 consumed record 执行 `rollbackUsage`。
5. 对 accepted async task 不立即 rollback，先查 provider 最终状态。
6. 对 finalized record 不 rollback。
7. 标记异常 task，不允许交付。
8. 记录事故原因和日志编号。

## 7. 灰度记录表

| canaryId | 日期时间 | 执行人 | 测试账号 | action | taskId(masked) | quotaRecordId(masked) | idempotencyKey(masked) | providerTaskId(masked) | provider 状态 | quota 状态 | 同步成功 | async accepted | rollback | finalize | points before/after | result 页状态 | 是否通过 | 停止条件触发 | 备注 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 待填写 | 待填写 | 待填写 | 待填写 | 待填写 | 待填写 | 待填写 | 待填写 | 待填写 | 待填写 | consumed/finalized/rolled_back | 待填写 | 待填写 | 待填写 | 待填写 | 待填写 | 待填写 | 待填写 | 待填写 | 待填写 |

## 8. 日志安全红线

禁止打印：

- prompt 全文。
- `fullAdvancedPromptSummary` 全文。
- `positivePrompt` / `negativePrompt` 全文。
- `sourceImageUrl` / `resultImageUrl`。
- `fileID` / `localPath`。
- provider endpoint。
- API key。
- Authorization。
- 原始 `idempotencyKey`。
- 用户 openid 原文。

允许打印：

- boolean。
- count / length。
- masked taskId / recordId / providerTaskId。
- status。
- errorCode。
- costActionType。
- providerTaskType。
- switchMatrixMode。
- hasEndpoint / hasApiKey。

