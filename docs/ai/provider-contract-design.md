# P8 Provider 接入前接口参数契约

## 1. Provider 接入目标

P8 定义 `ai_generate` 到真实 AI provider 的统一参数契约，确保后续接入万相或其他 provider 时，输入、输出、错误、日志、quota 边界都一致。本阶段只做契约设计和 adapter skeleton，不发真实 HTTP 请求。

## 2. 当前边界

- 不调用真实万相 API。
- `ENABLE_REAL_PROVIDER_CALL` 默认关闭。
- `ENABLE_REAL_QUOTA_GUARD` 默认关闭，真实 quota guard 尚未实现。
- mock/fallback 链路保持不变。
- 真实 provider 接入前必须先有 `quota_guard` consumed record。

## 3. 统一输入 requestPlan

`ai_generate` 内部应将业务输入、提示词摘要、图片输入、安全状态统一为 `requestPlan`。

```js
{
  providerTaskType,
  costActionType,
  sourceTaskId,
  clientTaskId,
  idempotencyKey,
  quotaRecordId,
  imageInputs: {
    sourceImageUrl,
    clothImageUrl,
    styleImageUrl
  },
  prompt: {
    positivePrompt,
    negativePrompt,
    promptMeta
  },
  params: {
    templateType,
    entryScene,
    modelType,
    scene,
    styleCode,
    sceneCode,
    bodyType,
    durationSec,
    outputType
  },
  advanced: {
    advancedPanelValues,
    advancedCustomPrompts,
    advancedOptionPrompts,
    fullAdvancedPromptSummary
  },
  safety: {
    allowRealProviderCall,
    hasQuotaConsumeRecord
  }
}
```

字段说明：

- `providerTaskType`：provider 任务类型，例如 `image_edit_fabric_replace`。
- `costActionType`：成本归一后的扣点动作。
- `idempotencyKey`：请求幂等键。
- `quotaRecordId`：`quota_guard.consume*` 成功返回的 consumed 流水 ID。
- `prompt.promptMeta`：只包含长度、count、版本等摘要。
- `safety.allowRealProviderCall`：必须由服务端配置决定。
- `safety.hasQuotaConsumeRecord`：必须为 true 才允许真实请求。

## 4. 统一输出 normalizedProviderResult

provider 返回后应归一为：

```js
{
  ok,
  provider,
  providerTaskType,
  providerTaskId,
  status,
  resultImageUrl,
  resultVideoUrl,
  resultItems,
  rawStatus,
  providerReceivedRequest,
  providerAcceptedTask,
  shouldRollbackQuota,
  shouldEnterPolling,
  errorCode,
  message,
  meta
}
```

要求：

- `providerReceivedRequest=false` 表示请求没有发到 provider，可安全 rollback。
- `providerAcceptedTask=true` 表示 provider 已接受异步任务，不立即 rollback。
- `shouldEnterPolling=true` 表示进入轮询/finalize 状态机。
- `resultItems` 不应保存完整原始 provider payload，只保存业务需要的归一结果。

## 5. 错误契约

| errorCode | 说明 | 是否可立即 rollback |
| --- | --- | --- |
| `REAL_PROVIDER_DISABLED` | 真实 provider 未启用 | 是 |
| `REAL_QUOTA_GUARD_REQUIRED` | 缺少 quota consumed record | 否 |
| `PROVIDER_CONFIG_MISSING` | endpoint/key/model 等配置缺失 | 是 |
| `PROVIDER_REQUEST_VALIDATION_FAILED` | 请求参数校验失败 | 是 |
| `PROVIDER_REQUEST_TIMEOUT_BEFORE_SUBMIT` | 请求前或可确认未提交时超时 | 是 |
| `PROVIDER_ACCEPTED_ASYNC_TASK` | provider 已接受异步任务 | 否 |
| `PROVIDER_FINAL_FAILED` | provider 最终失败 | 视 provider 状态 |
| `PROVIDER_RESPONSE_NORMALIZE_FAILED` | provider 响应无法归一 | 否，需人工或状态机判断 |

## 6. rollback 决策

`shouldRollbackQuota=true` 仅当：

- `providerReceivedRequest=false`
- `providerAcceptedTask=false`
- 请求 provider 前失败
- 参数校验失败

`shouldRollbackQuota=false` 当：

- `providerAcceptedTask=true`
- `providerTaskId` 已返回
- provider 可能已产生实际成本
- provider 响应归一失败但无法确认是否收费

异步任务必须进入 pending/finalize：

- provider 返回 `task_id`
- 轮询超时
- provider 最终失败
- 前端展示失败但 provider 成功

## 7. quota 契约

真实 provider 调用前必须满足：

1. `resolveCostActionType`
2. `quota_guard.consumeAiPoints` 或对应 consume action 成功
3. 返回 consumed 流水
4. `quotaRecordId` 写入 requestPlan
5. provider 调用携带稳定 `idempotencyKey`

没有 consumed record 时，adapter 必须返回 `REAL_QUOTA_GUARD_REQUIRED`，不得请求真实 endpoint。

## 7.1 真实 provider quota preflight 契约

P11 开始，`ai_generate` 进入真实 provider 前必须先做 quota preflight。只有同时满足以下条件才允许继续到 real adapter：

1. `provider === 'real'`
2. `ENABLE_REAL_PROVIDER_CALL === 'true'`
3. `quotaRecordId` 存在
4. `quotaConsumedRecord.status === 'consumed'` 或 `quotaRecordStatus === 'consumed'`
5. `idempotencyKey` 存在
6. `costActionType` 存在

任一条件缺失时返回：

```js
{
  success: false,
  ok: false,
  errorCode: 'REAL_QUOTA_GUARD_REQUIRED',
  message: '真实 provider 调用前必须完成 quota_guard.consumeAiPoints 并提供 consumed record。',
  data: {
    provider: 'real',
    providerReceivedRequest: false,
    providerAcceptedTask: false,
    shouldRollbackQuota: false,
    shouldEnterPolling: false,
    hasQuotaRecordId,
    hasIdempotencyKey,
    costActionType
  }
}
```

这里 `shouldRollbackQuota=false`，因为 provider 尚未收到请求，且没有可确认的真实 consumed record 可回滚。真实 provider 已返回 `task_id` 或已接受异步任务后，也不得立即 rollback，应进入 pending/finalize 状态机。

## 7.2 P12 真实链路 dryRun 契约

`PROVIDER_DRY_RUN === 'true'` 时，`ai_generate` 可以模拟真实 provider 端到端链路，但不得发出 HTTP 请求。dryRun 只用于服务端契约验证，默认关闭。

dryRun 链路仍必须执行：

1. provider prompt adapter
2. quota preflight
3. real adapter `requestPlan` 构建
4. `runRealProviderDryRun(requestPlan)`
5. 返回 normalizedProviderResult 摘要

dryRun 可以在 `ENABLE_REAL_PROVIDER_CALL=false` 时运行，但必须有 consumed quota record，除非显式传入仅用于 smoke/debug 的 `debugSkipQuotaPreflight=true`。普通生产路径不得跳过 quota preflight。

dryRun 结果形态：

```js
{
  ok: true,
  provider: 'real',
  providerTaskType,
  providerTaskId: 'dry_run_' + timestamp,
  status: 'dry_run',
  resultImageUrl: '',
  resultVideoUrl: '',
  providerReceivedRequest: false,
  providerAcceptedTask: false,
  shouldRollbackQuota: false,
  shouldEnterPolling: false,
  errorCode: '',
  meta: {
    dryRun: true,
    positivePromptLength,
    negativePromptLength,
    costActionType,
    quotaRecordId
  }
}
```

dryRun 不返回完整 `positivePrompt`、`negativePrompt`、`fullAdvancedPromptSummary` 或完整图片 URL；日志只允许输出长度、count、布尔值、`providerTaskType`、`costActionType` 和状态摘要。

## 8. mock/real 边界

- `ENABLE_REAL_PROVIDER_CALL !== 'true'` 时不得发真实请求。
- `ENABLE_REAL_QUOTA_GUARD !== 'true'` 时不得把 mock consume 视为真实扣点。
- mock/fallback 可以返回 meta 摘要，但不返回完整 prompt。
- real provider 代码路径必须先通过 provider guard 和 quota guard。

## 9. 日志安全

允许打印：

- providerTaskType
- costActionType
- status
- errorCode
- providerReceivedRequest
- providerAcceptedTask
- shouldRollbackQuota
- shouldEnterPolling
- prompt length/count/meta
- hasEndpoint / hasApiKey 布尔值

禁止打印：

- endpoint 原文
- API key
- full positivePrompt
- full negativePrompt
- fullAdvancedPromptSummary
- 完整图片 URL
- fileID
- localPath
- provider 原始 payload

## 10. P8 当前实现状态

- `providerPromptAdapter` 已返回 `promptVersion`。
- `real.js` 已有 requestPlan / validation / normalize / contract error skeleton。
- 当前不启用真实 HTTP 请求。
- 后续 P9/P10 接真实 provider 前，必须先实现真实 quota guard 和 provider 状态机。

## 11. 本地 contract smoke

P9 新增本地验证脚本：

```bash
npm run smoke:provider-contract
```

脚本路径：

```text
scripts/smoke/provider-contract-smoke.js
```

覆盖：

- `fabric_replace` 的 `providerTaskType=image_edit_fabric_replace`
- `runway_video_10s` 的 `providerTaskType=image_to_runway_video`
- `image_to_sketch` 的 `providerTaskType=image_to_structure_sketch`
- real provider 缺少 quota consumed record 时返回 `REAL_QUOTA_GUARD_REQUIRED`
- provider 已返回 `task_id` 时进入 pending/polling，不立即 rollback
- 请求提交前参数校验失败时 `shouldRollbackQuota=true`

脚本只调用 adapter 构建、校验、归一函数，不调用 `requestWithTimeoutAndRetry`，不发任何 HTTP 请求。

## P13 全链路 smoke 与上线前审计索引

Provider request/response/error/rollback 契约、dryRun 复验和上线前安全边界的汇总入口：

```text
docs/smoke/full-chain-smoke-summary.md
```

真实 provider 接入前必须确认：
- `ENABLE_REAL_PROVIDER_CALL=true` 前，`ENABLE_REAL_QUOTA_GUARD=true` 已完成数据库实测。
- `quotaRecordId`、`quota record status=consumed`、`idempotencyKey`、`costActionType` 齐全。
- provider contract validate ok。
- 日志不得打印完整 prompt、图片 URL、endpoint 或 API key。

## P18 Provider Switch Matrix Contract

Before real provider gray release, `ai_generate` must classify the three switches as A-G:

- A default safe mock: all false.
- B quota real Alpha only: only `ENABLE_REAL_QUOTA_GUARD=true`.
- C provider dryRun with real quota: `ENABLE_REAL_QUOTA_GUARD=true`, `PROVIDER_DRY_RUN=true`, `ENABLE_REAL_PROVIDER_CALL=false`.
- D blocked dryRun without real quota: `PROVIDER_DRY_RUN=true` while real quota guard is false.
- E blocked real provider without real quota: `ENABLE_REAL_PROVIDER_CALL=true` while real quota guard is false; return `REAL_QUOTA_GUARD_REQUIRED`.
- F blocked switch conflict: `ENABLE_REAL_PROVIDER_CALL=true` and `PROVIDER_DRY_RUN=true`; return `PROVIDER_SWITCH_CONFLICT`.
- G gray real provider allowed: `ENABLE_REAL_QUOTA_GUARD=true`, `PROVIDER_DRY_RUN=false`, `ENABLE_REAL_PROVIDER_CALL=true` after the hard checklist passes.

Real and dryRun provider paths require `quotaRecordId`, `quotaRecordStatus=consumed`, `idempotencyKey`, and `costActionType`. Blocked responses must not fallback to mock success and must not include deliverable image URLs.

Logging remains summary-only: switch booleans, mode, blockers, `providerTaskType`, `costActionType`, status, error code, retry and timeout numbers. Never log prompt text, image URL, endpoint, API key, Authorization, or raw idempotency keys.

## P21 real provider canary execution contract

The first real provider canary is allowed only after P20 A-F pass and only in switch matrix mode G:

```text
ENABLE_REAL_QUOTA_GUARD=true
PROVIDER_DRY_RUN=false
ENABLE_REAL_PROVIDER_CALL=true
```

Runtime contract:

- Provider success -> call `quota_guard.finalizeUsage(recordId)` and mark the quota record `finalized`.
- Provider explicit failure before accepted -> call `quota_guard.rollbackUsage(recordId)`.
- Provider accepted async task -> do not finalize and do not rollback until the final provider status is known.
- Timeout -> do not retry timeout; decide pending/failure according to provider accepted state.
- Fallback mock must not hide real provider blocked/failure states.
- Accepted async task must return pending/accepted and must not fallback mock.

Logging remains summary-only: status, errorCode, masked IDs, costActionType, providerTaskType, switchMatrixMode, hasEndpoint/hasApiKey booleans. Never log prompt text, image URLs, endpoint, API key, Authorization, raw idempotencyKey, or raw openid.
