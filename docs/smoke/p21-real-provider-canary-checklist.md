# P21-0 Real Provider Canary Static Checklist

本记录用于 P21-0 真实 provider canary 前置静态检查。本轮只做静态检查和文档记录，不开启真实 provider，不调用真实 API，不改动云函数环境变量，不写入真实 quota 数据。

## P21-0 完成记录

P21-0 已完成，当前已经恢复默认安全 mock 态。

### P21-0.2 默认安全状态部署验证通过

`ai_generate debugConfig` 结果：

```text
provider=mock
enableRealQuotaGuard=false
providerDryRun=false
enableRealProviderCall=false
switchMatrixMode=A_DEFAULT_SAFE_MOCK
switchMatrixAllowed=true
switchMatrixBlockers=[]
```

结论：`ai_generate` 修复版已部署，默认仍处于安全 mock 状态。

### P21-0.3 provider dryRun + real quota guard 回归通过

开关状态：

```text
quota_guard:
success=true
enableRealQuotaGuard=true
realModeImplemented=true
finalizeImplemented=true

ai_generate:
success=true
provider=mock
enableRealQuotaGuard=true
providerDryRun=true
enableRealProviderCall=false
switchMatrixMode=C_PROVIDER_DRY_RUN_WITH_REAL_QUOTA
switchMatrixAllowed=true
switchMatrixBlockers=[]
```

dryRun 链路结果：

```text
consumeAiPoints:
success=true
ok=true
quotaRecordStatus=consumed

ai_generate dryRun:
success=true
ok=true
status=dry_run
provider=real
providerDryRun=true
quotaRecordId 有值
quotaRecordStatus=consumed
quotaPendingFinalization=true
quotaFinalized=false
quotaRolledBack=false

cleanup rollback:
success=true
ok=true
status=rolled_back
```

P21-0.3 期间发现并修复的问题：

- `ai_generate` 之前没有用 `quotaRecordId` 查询 `quota_guard` 已写入的 consumed record，导致 `REAL_QUOTA_GUARD_REQUIRED`。
- 已修复为兼容 `event.quotaRecordId`、`event.quota_record_id`、`event.usageRecordId`、`event.recordId`、`event.input.quotaRecordId`、`event.input.usageRecordId`。
- 已在 real quota guard 模式下查库确认 consumed record。

### P21-0.4 恢复默认安全状态通过

最终 `restore-safe-check`：

```text
quota_guard:
success=true
enableRealQuotaGuard=false
mock=true
finalizeImplemented=true

ai_generate:
success=true
provider=mock
enableRealQuotaGuard=false
providerDryRun=false
enableRealProviderCall=false
switchMatrixMode=A_DEFAULT_SAFE_MOCK
switchMatrixAllowed=true
switchMatrixBlockers=[]
```

结论：

- P21-0 完成。
- 当前已恢复默认安全 mock 态。
- 真实 API 未调用。
- 真实 provider 未开启。
- dryRun 已关闭。
- real quota guard 已关闭。

### P21-1 前置注意事项

可以进入 P21-1 前置准备，但不能直接开启 `ENABLE_REAL_PROVIDER_CALL=true`。

进入 P21-1 前必须再次确认：

1. provider endpoint / API key 已配置。
2. 单次 canary 成本可控。
3. 只允许一条真实任务。
4. 失败必须 rollback。
5. 成功必须 finalize。
6. 真实 canary 下禁止 fallback mock success。
7. pending / accepted 不 finalize、不 rollback，保留 `quotaPendingFinalization=true`。
8. 测完必须立即恢复 `A_DEFAULT_SAFE_MOCK`。

### P21-1A 真实 provider 选型结论

当前 `debugConfig`：

```text
provider=mock
hasEndpoint=false
hasApiKey=false
enableRealQuotaGuard=false
providerDryRun=false
enableRealProviderCall=false
switchMatrixMode=A_DEFAULT_SAFE_MOCK
switchMatrixAllowed=true
```

最终选型：

- 真实 provider 首选：阿里云百炼 / DashScope。

选型理由：

1. 更适合中国大陆微信小程序环境。
2. 境内服务，减少微信云函数跨境调用不稳定风险。
3. 百炼 / DashScope 有图像生成能力，也有 AI 试衣 `aitryon-plus` 能力。
4. AI 试衣能力适合后续“换模特 + 保持服装款式一致”。
5. 异步 `task_id` + 轮询机制与当前 `ai_generate` 的 pending / accepted 架构匹配。
6. 当前 P21-1 的目标是先验证真实 provider 调用闭环，不是一次性完成所有服装能力。

P21-1 首轮接入顺序：

- 先做最小真实 canary，优先接通义万相 / DashScope 文生图或最小图像生成链路。
- 验证 `AI_API_ENDPOINT` / `AI_API_KEY` 能被云函数读取。
- 验证真实 provider HTTP 调用。
- 验证 `consume -> ai_generate -> finalize` 成功链路。
- 验证失败 rollback 链路。
- 验证 pending / accepted 不 finalize、不 rollback。
- 测完恢复 `A_DEFAULT_SAFE_MOCK`。

P21-2 或后续接入顺序：

- 再接 AI 试衣 `aitryon-plus`。
- 目标包括换模特、保持服装款式一致、上衣 / 下装试衣、服装电商图生成。

当前不能进入真实 canary：

- `hasEndpoint=false`。
- `hasApiKey=false`。
- 缺少 `AI_API_ENDPOINT`。
- 缺少 `AI_API_KEY`。
- 因此不能开启 `ENABLE_REAL_PROVIDER_CALL=true`，不能跑真实 provider canary，不能调用真实 API。

当前必须保持安全状态：

```text
ENABLE_REAL_QUOTA_GUARD=false
PROVIDER_DRY_RUN=false
ENABLE_REAL_PROVIDER_CALL=false
switchMatrixMode=A_DEFAULT_SAFE_MOCK
```

下一步人工动作：

1. 开通阿里云百炼 / DashScope。
2. 创建 API Key。
3. 确认图像生成 endpoint。
4. 不把 API Key 写入代码仓库。
5. 只配置到 `ai_generate` 云函数环境变量。

待用户完成后，再配置：

```text
AI_API_ENDPOINT
AI_API_KEY
```

然后重新跑 `[manual:p21-1-0:provider-env-check-final]`。

预期：

```text
hasEndpoint=true
hasApiKey=true
provider=mock
enableRealQuotaGuard=false
providerDryRun=false
enableRealProviderCall=false
switchMatrixMode=A_DEFAULT_SAFE_MOCK
switchMatrixAllowed=true
```

风险记录：

1. `membership_usage_records.recordId` 索引需要确认。
2. DashScope 具体文生图 endpoint / model 名称需要以官网当前文档为准。
3. AI 试衣 `aitryon-plus` 不在 P21-1 首轮 canary 内，后续单独接入。

## 1. 当前默认安全态

当前应保持 P20 收尾后的安全 mock 默认态：

```text
ai_generate:
ENABLE_REAL_QUOTA_GUARD=false
PROVIDER_DRY_RUN=false
ENABLE_REAL_PROVIDER_CALL=false

quota_guard:
ENABLE_REAL_QUOTA_GUARD=false
```

静态检查结论：

- `ai_generate` 默认 provider 为 `mock`。
- `quota_guard` 默认 `mock=true`。
- 当前模式应为 `A_DEFAULT_SAFE_MOCK`。
- 默认不请求真实 provider endpoint。
- 默认不写真实 usage/quota 数据。

## 2. P21 canary 允许条件

真实 provider canary 只允许在以下条件全部满足后进入真实调用：

1. `ENABLE_REAL_PROVIDER_CALL=true`。
2. `PROVIDER_DRY_RUN=false`。
3. `ENABLE_REAL_QUOTA_GUARD=true`。
4. `switchMatrixAllowed=true`。
5. `quotaRecordId` 存在。
6. `quotaRecordStatus=consumed`。
7. `idempotencyKey` 存在。
8. `costActionType` 存在。
9. provider endpoint / API key 配置完整。
10. 不处于 mock / fallback / dryRun 路径。

静态检查结论：

- `cloudfunctions/ai_generate/index.js` 已有 `buildRealProviderQuotaPreflight`，会校验 `switchMatrixAllowed`、`ENABLE_REAL_QUOTA_GUARD`、`quotaRecordId`、`quotaRecordStatus=consumed`、`idempotencyKey`、`costActionType`。
- `cloudfunctions/ai_generate/utils/config.js` 只从云函数环境变量读取 endpoint / API key，并只输出 `hasEndpoint` / `hasApiKey` 摘要。
- `cloudfunctions/ai_generate/adapters/real.js` 的 request plan 会校验 `allowRealProviderCall`、consumed quota record、endpoint 和 Authorization。
- P21-1 前仍需人工确认云函数环境变量，不允许由前端单独开启真实 provider。

## 3. 禁止条件

以下任一条件出现时，必须禁止真实 provider 请求：

- `ENABLE_REAL_PROVIDER_CALL=false`。
- `ENABLE_REAL_QUOTA_GUARD=false`。
- `PROVIDER_DRY_RUN=true` 且同时 `ENABLE_REAL_PROVIDER_CALL=true`。
- `PROVIDER_DRY_RUN=true` 且 `ENABLE_REAL_QUOTA_GUARD=false`。
- 缺少 `quotaRecordId`。
- `quotaRecordStatus` 不是 `consumed`。
- 缺少 `idempotencyKey`。
- 缺少 `costActionType`。
- 缺少 endpoint 或 API key。
- 当前结果或任务是 mock/fallback。

静态检查结论：

- D/E/F 禁止组合在 switch matrix 中存在。
- E 会返回 `REAL_QUOTA_GUARD_REQUIRED`。
- F 会返回 `PROVIDER_SWITCH_CONFLICT`。
- `result.vue` 保留 mock/fallback 审核通过拦截，mock/fallback 不允许变成 `approved` / `passed` / `delivery_approved`。

## 4. 成功 finalize 条件

真实 provider 成功后，只有满足以下条件才允许 finalize：

- provider 返回真实成功态。
- 有有效 `resultImageUrl` 或等价有效结果。
- `mock=false`。
- `fallback=false`。
- `provider=real`。
- 对应 quota record 仍为 `consumed`。
- 调用 `quota_guard.finalizeUsage` 成功。

静态检查结论：

- `quota_guard.realFinalizeUsage` 已实现 `consumed -> finalized`。
- 已实现重复 finalize 返回同一 finalized record。
- 已实现 rolled back record 不可 finalize。
- 当前 `ai_generate` 真实 provider 成功路径未看到自动调用 `quota_guard.finalizeUsage` 的编排。

P21-1 前置状态：不可进入，需先补齐真实成功后的 finalize 编排或明确由 canary runbook 人工调用并记录。

## 5. 失败 rollback 条件

真实 provider 明确失败且未生成有效结果时，才允许 rollback：

- provider 未 accepted async task。
- provider 未返回有效结果。
- provider 失败是明确失败，不是 pending/accepted。
- quota record 仍为 `consumed`。
- 调用 `quota_guard.rollbackUsage`。

静态检查结论：

- `quota_guard.realRollbackUsage` 已实现 `consumed -> rolled_back`。
- finalized 后 rollback 会返回 `QUOTA_RECORD_FINALIZED`。
- repeated rollback 不会重复退点。
- 当前 `ai_generate` 真实 provider 明确失败路径未看到自动调用 `quota_guard.rollbackUsage` 的编排。
- 当前真实 provider 失败仍存在 fallback-to-mock 兼容路径，P21 canary 前必须收紧，不能把真实 provider 失败伪装成 mock 成功。

P21-1 前置状态：不可进入，需先补齐失败 rollback 策略，并禁止真实 canary 失败 fallback 成 mock success。

## 6. Pending / Accepted 条件

provider 返回 accepted / pending / async task 时：

- 不立即 finalize。
- 不立即 rollback。
- 标记 `pending` / `accepted`。
- 保留 provider task id。
- 等待轮询或最终态回调后再决定 finalize / rollback。

静态检查结论：

- `adapters/real.js` 已有 `PROVIDER_POLL_STATUS`、`buildPendingProviderResult`、`pollProviderTaskUntilDone`。
- accepted async task 会设置 `shouldRollbackQuota=false`、`shouldEnterPolling=true`。
- 当前 `ai_generate` 可返回 pending 结果，但 P21-1 前仍需确认最终态轮询或人工补偿 runbook。

## 7. 日志脱敏检查结果

允许输出：

- `hasApiKey` / `hasEndpoint`。
- masked id 或布尔摘要。
- `requestId`。
- `taskId` 摘要。
- `quotaRecordId` 摘要或存在性。
- provider status。
- `errorCode` / `reason`。
- `switchMatrixMode`。

禁止输出：

- API Key。
- Authorization header。
- endpoint 完整敏感 URL。
- 原始 base64 图片。
- 用户 openid 完整值。
- 云文件完整临时 URL 中的敏感 query。
- provider 原始完整响应大对象。

静态检查结论：

- `ai_generate` 的 config / request 日志主要输出 `hasEndpoint`、`hasApiKey`、status、errorCode、长度和布尔值。
- `utils/api/generate.js` 只输出 cloud response summary，不输出完整 result 大对象。
- `quota_guard` 入口日志输出 `hasOpenid`、`hasIdempotencyKey`，不打印完整 openid。
- P21-1 前建议继续人工复查真实 provider 适配器新增日志，避免输出完整 endpoint、Authorization、临时 URL query 或 provider 原始响应。

## 8. 前端安全检查结果

静态检查结论：

- `utils/api/generate.js` 默认 `ENABLE_CLIENT_GENERATE_MOCK_FALLBACK=false`，cloud call 失败不会默认伪装成本地 mock 成功。
- 前端未发现直接持有 provider API Key。
- `pages/upload/upload.vue` 可构造 `costActionType`，dryRun 调试路径可携带 `idempotencyKey`、`quotaRecordId`、`quotaRecordStatus`。
- 前端不能单独开启真实 provider；真实 provider 由云函数环境变量和 server-side switch matrix 控制。
- `pages/result/result.vue` 保留 mock/fallback 识别与审核通过拦截。
- real provider 结果应通过 `provider=real`、`mock=false`、`fallback=false` 与 mock/fallback 区分。

## 9. Switch matrix 检查结果

| Mode | quota | dryRun | realProvider | allowed | provider / blocker |
| --- | --- | --- | --- | --- | --- |
| A_DEFAULT_SAFE_MOCK | false | false | false | true | provider=mock |
| B_REAL_QUOTA_ONLY | true | false | false | true | provider=mock |
| C_PROVIDER_DRY_RUN_WITH_REAL_QUOTA | true | true | false | true | 不调用真实 API |
| D_BLOCKED_DRY_RUN_WITHOUT_REAL_QUOTA | false | true | false | false | `ENABLE_REAL_QUOTA_GUARD_REQUIRED_FOR_PROVIDER_DRY_RUN` |
| E_BLOCKED_REAL_PROVIDER_WITHOUT_REAL_QUOTA | false | false | true | false | `REAL_QUOTA_GUARD_REQUIRED` |
| F_BLOCKED_REAL_PROVIDER_AND_DRY_RUN_CONFLICT | true | true | true | false | `PROVIDER_SWITCH_CONFLICT` |
| G_CANARY_REAL_PROVIDER | true | false | true | true | 必须有 consumed quota record、`idempotencyKey`、`costActionType` |

静态检查结论：

- A-F 已在 `getProviderSwitchMatrix` 中存在。
- G 在代码中命名为 `G_REAL_PROVIDER_GRAY_ALLOWED`，语义对应 `G_CANARY_REAL_PROVIDER`。
- G 仍必须通过 quota preflight，不是直接放行真实 API。

## 10. P21-1 可执行前置条件清单

进入 P21-1 前必须人工确认：

1. `ai_generate.ENABLE_REAL_QUOTA_GUARD=true`。
2. `ai_generate.PROVIDER_DRY_RUN=false`。
3. `ai_generate.ENABLE_REAL_PROVIDER_CALL=true`。
4. `quota_guard.ENABLE_REAL_QUOTA_GUARD=true`。
5. `AI_PROVIDER=real` 或目标 action 的 provider server-side 指向 real。
6. `AI_API_ENDPOINT` / `AI_API_KEY` 或对应 action endpoint / key 已在云函数环境变量中配置。
7. 只使用单测试账号、单 action、单任务、单张无敏感信息测试图。
8. 前端生成请求携带 `costActionType`、`idempotencyKey`、`quotaRecordId`、`quotaRecordStatus=consumed`。
9. 成功后有明确 `finalizeUsage` 编排。
10. 明确失败且未 accepted 时有明确 `rollbackUsage` 编排。
11. accepted / pending 时有不 finalize / 不 rollback 的等待最终态方案。
12. 真实 provider 失败不得 fallback 成 mock success。

## 11. 当前是否可以进入 P21-1

结论：可以进入 P21-1 前置准备，但不能直接开启 `ENABLE_REAL_PROVIDER_CALL=true`。

进入 P21-1 前必须再次人工确认 provider endpoint / API key、单次 canary 成本、单任务范围、失败 rollback、成功 finalize、真实失败禁止 fallback mock success、pending / accepted 暂不 finalize / rollback，以及测试后立即恢复 `A_DEFAULT_SAFE_MOCK`。

## 12. 本轮结论

- 本轮未调用真实 API。
- 本轮未开启真实 provider。
- 本轮未改动云函数环境变量。
- 本轮未写入真实 quota 数据。
- P21-0 已完成并恢复默认安全 mock 态。
