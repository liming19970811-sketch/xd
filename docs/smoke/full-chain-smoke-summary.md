# P13 全链路 smoke + 上线前安全总账

## 1. 当前阶段结论

- 真实 provider 默认关闭：`ENABLE_REAL_PROVIDER_CALL=false`。
- 真实 quota guard 默认关闭：`ENABLE_REAL_QUOTA_GUARD=false`。
- Provider dryRun 默认关闭：`PROVIDER_DRY_RUN=false`。
- 当前 mock/fallback 主链路可用。
- 高级提示词已经从 Upload 透传到 `generateResult` / `ai_generate`。
- `advancedPromptMeta` 和 `providerPromptMeta` 只返回摘要，不返回完整 prompt。
- `providerPromptAdapter`、provider contract、real provider dryRun 已完成契约验证。
- 真实 provider 接入前必须先开启 real quota guard，并完成数据库 smoke、幂等和 rollback/finalize 验收。

## 2. P1-P13 阶段总览

| 阶段 | 名称 | 摘要 | 关键文件 | 验收 |
| --- | --- | --- | --- | --- |
| P1 | 高级面板交互 | Upload 页动态高级面板、固定选项和 customPrompt 输入 | `pages/upload/upload.vue`, `utils/constants/advancedPanelPresets.js` | DevTools 手工验收 |
| P2 | 高级提示词摘要 | `advancedPanelValues` 生成 custom/option/full summary | `utils/constants/advancedPromptRules.js`, `utils/constants/advancedPanelPresets.js`, `pages/upload/upload.vue` | DevTools 手工验收 |
| P3 | 生成请求参数透传 | 高级提示词字段进入 `generateResult` / `ai_generate` payload，并返回 `advancedPromptMeta` | `pages/upload/upload.vue`, `utils/api/generate.js`, `cloudfunctions/ai_generate/index.js` | DevTools 手工验收 |
| P4 | Provider Prompt Adapter | 生成 `providerTaskType`、positive/negative prompt 和 `promptMeta`，不调用真实 API | `cloudfunctions/ai_generate/utils/providerPromptAdapter.js`, `cloudfunctions/ai_generate/index.js` | DevTools 手工验收 |
| P5 | 高级提示词链路日志与 smoke | 覆盖 Upload -> generateResult -> ai_generate -> providerPromptAdapter -> Result 的日志安全和 smoke | `docs/smoke/manual-smoke-miniapp.md`, `cloudfunctions/ai_generate/index.js`, `pages/upload/upload.vue` | DevTools 手工验收 |
| P6 | 安全修复 | 真实 provider 硬拦截、generate.js 日志脱敏、Result WXSS selector 修复、核心入口 costActionType 补齐、aiPointCost strict | `cloudfunctions/ai_generate/index.js`, `cloudfunctions/ai_generate/adapters/real.js`, `utils/api/generate.js`, `pages/result/result.vue`, `utils/constants/entryScenePresets.js`, `utils/constants/aiPointCost.js` | DevTools + 静态检查 |
| P7 | quota_guard 云端强校验设计 | `membership_usage` / `membership_usage_records`、幂等、原子扣减、rollback/finalize 规则设计 | `cloudfunctions/quota_guard/index.js`, `docs/commercial/quota-cloud-guard-design.md` | DevTools + 文档验收 |
| P8 | Provider Contract | 真实 provider 接入前 requestPlan、normalizedProviderResult、错误契约、rollback 决策 | `cloudfunctions/ai_generate/adapters/real.js`, `docs/ai/provider-contract-design.md` | DevTools + 文档验收 |
| P9 | Provider Contract 本地 smoke | 本地 Node 脚本验证 provider contract，不发 HTTP 请求 | `scripts/smoke/provider-contract-smoke.js`, `package.json` | `npm run smoke:provider-contract` |
| P10 | quota_guard 真实数据库扣点 Alpha | `ENABLE_REAL_QUOTA_GUARD=true` 时启用真实数据库扣点 Alpha，默认关闭 | `cloudfunctions/quota_guard/index.js`, `docs/commercial/quota-cloud-guard-design.md` | DevTools + 静态检查 |
| P11 | ai_generate 真实 provider 前置 quota record 契约 | 真实 provider 前必须有 `quotaRecordId`、consumed 状态、`idempotencyKey`、`costActionType` | `cloudfunctions/ai_generate/index.js`, `cloudfunctions/ai_generate/adapters/real.js` | DevTools + 文档验收 |
| P12 | real provider dryRun 链路复验 | `PROVIDER_DRY_RUN=true` 时构建真实链路 requestPlan 并返回 dryRun normalized result，不请求 endpoint | `cloudfunctions/ai_generate/index.js`, `cloudfunctions/ai_generate/adapters/real.js`, `scripts/smoke/provider-contract-smoke.js` | DevTools + `npm run smoke:provider-contract` |
| P13 | 全链路 smoke + 上线前安全总账 | 汇总 P1-P12 阶段结果、风险边界、日志安全、smoke 执行清单和上线前不得跳过的检查 | `docs/smoke/full-chain-smoke-summary.md`, `docs/smoke/manual-smoke-miniapp.md`, `docs/ai/fashion-enhancement-api-map.md`, `docs/ai/provider-contract-design.md`, `docs/commercial/quota-cloud-guard-design.md` | 文档复盘 |

## 3. 默认安全开关

```json
{
  "ENABLE_REAL_PROVIDER_CALL": false,
  "ENABLE_REAL_QUOTA_GUARD": false,
  "PROVIDER_DRY_RUN": false
}
```

真实 provider 接入前必须满足：

1. `ENABLE_REAL_PROVIDER_CALL=true`
2. `ENABLE_REAL_QUOTA_GUARD=true`
3. `quotaRecordId` exists
4. quota record status = `consumed`
5. `idempotencyKey` exists
6. `costActionType` exists
7. provider contract validate ok
8. real provider adapter 日志不打印 endpoint/API key/prompt/image URL
9. `membership_usage_records.idempotencyKey` 唯一索引已验证
10. `rollbackUsage` 不会对 provider 已 accepted task 立即回滚

## 4. 日志安全规则

允许打印：

- length
- count
- boolean
- panelKey
- fieldKey
- costActionType
- entryScene
- templateType
- providerTaskType
- pointsConsumed
- pointsBefore
- pointsAfter
- errorCode
- status

禁止打印：

- full customPrompt
- full fullAdvancedPromptSummary
- positivePrompt
- negativePrompt
- image URL
- fileID
- localPath
- endpoint
- API key
- raw idempotencyKey

## 5. costActionType 归一表

| entryScene/taskType | costActionType | costValue |
| --- | --- | ---: |
| `color_batch` | `basic_recolor` | 1 |
| `text_to_sketch` | `sketch_to_model` | 5 |
| `sketch_remix` | `hot_style_remix` | 6 |
| `detail_page_from_photo` | `detail_long_image` | 3 |
| `sketch_to_tech_pack` | `image_to_sketch` | 5 |
| `runway_video_3s` | `runway_video_3s` | 25 |
| `runway_video_5s` | `runway_video_5s` | 45 |
| `runway_video_10s` | `runway_video_10s` | 90 |
| `ecommerce_main` | `ai_model_image` | 5 |
| `xiaohongshu_seed` | `ai_model_image` | 5 |
| `cross_border_white` | `ai_model_image` | 5 |
| `new_arrival` | `ai_model_image` | 5 |
| `batch_model` | `ai_model_image` | 5 |
| `default` | `ai_model_image` | 5 |

## 6. providerTaskType 映射表

| action/costActionType | providerTaskType |
| --- | --- |
| `fabric_replace` | `image_edit_fabric_replace` |
| `print_generate` | `image_generate_print` |
| `print_placement` | `image_edit_print_placement` |
| `basic_recolor` | `image_edit_recolor` |
| `color_batch` | `image_edit_recolor` |
| `detail_long_image` | `image_layout_detail_long_image` |
| `detail_page_from_photo` | `image_layout_detail_long_image` |
| `detail_closeup` | `image_enhance_closeup` |
| `sketch_to_model` | `sketch_to_model_image` |
| `image_to_sketch` | `image_to_structure_sketch` |
| `hot_style_remix` | `style_remix_image` |
| `runway_video_3s` | `image_to_runway_video` |
| `runway_video_5s` | `image_to_runway_video` |
| `runway_video_10s` | `image_to_runway_video` |

## 7. 推荐 smoke 顺序

1. `npm run smoke:provider-contract`
2. `quota_guard debugConfig`
3. `quota_guard mock consume`
4. `quota_guard real Alpha check/consume only when ENABLE_REAL_QUOTA_GUARD=true`
5. `ai_generate debugConfig`
6. `fabricReplace mock providerPromptMeta`
7. `Upload fabric_replace startGenerate`
8. `Result handleConsumeForAction H2 table`
9. `P12 dryRun missing quota record`
10. `P12 dryRun fake consumed record`

## 8. smoke 命令

```bash
npm run smoke:provider-contract
node --check cloudfunctions/ai_generate/index.js
node --check cloudfunctions/quota_guard/index.js
node --check utils/api/generate.js
node --check utils/constants/entryScenePresets.js
node --check utils/constants/advancedPanelPresets.js
node --check utils/constants/advancedPromptRules.js
node --check utils/constants/costActionType.js
node --check utils/constants/aiPointCost.js
```

## 9. DevTools smoke 模板

### ai_generate debugConfig

```js
wx.cloud.callFunction({ name: 'ai_generate', data: { action: 'debugConfig' } }).then(function(res) {
  console.log('[manual:debug:ai_generate]', JSON.stringify({
    success: res.result && res.result.success,
    provider: res.result && res.result.data && res.result.data.provider,
    enableRealProviderCall: res.result && res.result.data && res.result.data.enableRealProviderCall,
    providerDryRun: res.result && res.result.data && res.result.data.providerDryRun
  }, null, 2));
}).catch(console.error);
```

### quota_guard debugConfig

```js
wx.cloud.callFunction({ name: 'quota_guard', data: { action: 'debugConfig' } }).then(function(res) {
  console.log('[manual:debug:quota_guard]', JSON.stringify({
    success: res.result && res.result.success,
    ok: res.result && res.result.ok,
    enableRealQuotaGuard: res.result && res.result.data && res.result.data.enableRealQuotaGuard,
    realModeImplemented: res.result && res.result.data && res.result.data.realModeImplemented,
    idempotencyRequiredForConsume: res.result && res.result.data && res.result.data.idempotencyRequiredForConsume
  }, null, 2));
}).catch(console.error);
```

### fabricReplace mock

```js
wx.cloud.callFunction({
  name: 'ai_generate',
  data: {
    action: 'fabricReplace',
    sourceTaskId: 'manual_summary_' + Date.now(),
    sourceImageUrl: 'https://example.com/mock-source.jpg',
    fabricType: 'denim',
    idempotencyKey: 'manual_summary_' + Date.now(),
    costActionType: 'fabric_replace',
    fullAdvancedPromptSummary: '[fabric_texture] 面料：牛仔；质感强度：强'
  }
}).then(function(res) {
  console.log('[manual:summary:fabricReplace]', JSON.stringify({
    success: res.result && res.result.success,
    ok: res.result && res.result.ok,
    providerPromptMeta: res.result && res.result.data && res.result.data.providerPromptMeta,
    advancedPromptMeta: res.result && res.result.data && res.result.data.advancedPromptMeta
  }, null, 2));
}).catch(console.error);
```

## 10. 验收口径

- mock/fallback 主链路可用。
- `advancedPromptMeta` 返回摘要。
- `providerPromptMeta` 返回摘要。
- provider contract smoke 通过。
- real provider 默认禁用。
- real quota guard 默认禁用。
- dryRun 默认禁用且不请求 endpoint。
- 开启真实 provider 前必须先完成真实 quota guard 数据库实测。
- 日志不打印完整 prompt / 图片 URL / endpoint / API key。

## 11. Codex-ready JSON 汇总模板

```json
{
  "task": "P13 全链路 smoke + 上线前安全总账",
  "description": "汇总 P1-P12 全链路验收、日志安全、quota_guard、provider dryRun 与 provider contract 契约，作为后续真实 provider 接入前的 Codex-ready 验收模板。",
  "defaultSafety": {
    "ENABLE_REAL_PROVIDER_CALL": false,
    "ENABLE_REAL_QUOTA_GUARD": false,
    "PROVIDER_DRY_RUN": false
  },
  "requiredBeforeRealProvider": [
    "ENABLE_REAL_PROVIDER_CALL=true",
    "ENABLE_REAL_QUOTA_GUARD=true",
    "quotaRecordId exists",
    "quota record status=consumed",
    "idempotencyKey exists",
    "costActionType exists",
    "provider contract validate ok",
    "real provider adapter 日志不打印 endpoint/API key/prompt/image URL",
    "membership_usage_records.idempotencyKey 唯一索引已验证",
    "rollbackUsage 不会对 provider 已 accepted task 立即回滚"
  ],
  "logSafety": {
    "allow": [
      "length",
      "count",
      "boolean",
      "panelKey",
      "fieldKey",
      "costActionType",
      "entryScene",
      "templateType",
      "providerTaskType",
      "pointsConsumed",
      "pointsBefore",
      "pointsAfter",
      "errorCode",
      "status"
    ],
    "forbid": [
      "full customPrompt",
      "full fullAdvancedPromptSummary",
      "positivePrompt",
      "negativePrompt",
      "image URL",
      "fileID",
      "localPath",
      "endpoint",
      "API key",
      "raw idempotencyKey"
    ]
  },
  "costActionTypeMap": {
    "color_batch": {
      "costActionType": "basic_recolor",
      "costValue": 1
    },
    "text_to_sketch": {
      "costActionType": "sketch_to_model",
      "costValue": 5
    },
    "sketch_remix": {
      "costActionType": "hot_style_remix",
      "costValue": 6
    },
    "detail_page_from_photo": {
      "costActionType": "detail_long_image",
      "costValue": 3
    },
    "sketch_to_tech_pack": {
      "costActionType": "image_to_sketch",
      "costValue": 5
    },
    "runway_video_3s": {
      "costActionType": "runway_video_3s",
      "costValue": 25
    },
    "runway_video_5s": {
      "costActionType": "runway_video_5s",
      "costValue": 45
    },
    "runway_video_10s": {
      "costActionType": "runway_video_10s",
      "costValue": 90
    },
    "ecommerce_main": {
      "costActionType": "ai_model_image",
      "costValue": 5
    },
    "xiaohongshu_seed": {
      "costActionType": "ai_model_image",
      "costValue": 5
    },
    "cross_border_white": {
      "costActionType": "ai_model_image",
      "costValue": 5
    },
    "new_arrival": {
      "costActionType": "ai_model_image",
      "costValue": 5
    },
    "batch_model": {
      "costActionType": "ai_model_image",
      "costValue": 5
    },
    "default": {
      "costActionType": "ai_model_image",
      "costValue": 5
    }
  },
  "providerTaskTypeMap": {
    "fabric_replace": "image_edit_fabric_replace",
    "print_generate": "image_generate_print",
    "print_placement": "image_edit_print_placement",
    "basic_recolor": "image_edit_recolor",
    "color_batch": "image_edit_recolor",
    "detail_long_image": "image_layout_detail_long_image",
    "detail_page_from_photo": "image_layout_detail_long_image",
    "detail_closeup": "image_enhance_closeup",
    "sketch_to_model": "sketch_to_model_image",
    "image_to_sketch": "image_to_structure_sketch",
    "hot_style_remix": "style_remix_image",
    "runway_video_3s": "image_to_runway_video",
    "runway_video_5s": "image_to_runway_video",
    "runway_video_10s": "image_to_runway_video"
  },
  "smokeCommands": [
    "npm run smoke:provider-contract",
    "node --check cloudfunctions/ai_generate/index.js",
    "node --check cloudfunctions/quota_guard/index.js",
    "node --check utils/api/generate.js",
    "node --check utils/constants/entryScenePresets.js",
    "node --check utils/constants/advancedPanelPresets.js",
    "node --check utils/constants/advancedPromptRules.js",
    "node --check utils/constants/costActionType.js",
    "node --check utils/constants/aiPointCost.js"
  ],
  "recommendedSmokeOrder": [
    "npm run smoke:provider-contract",
    "quota_guard debugConfig",
    "quota_guard mock consume",
    "quota_guard real Alpha check/consume only when ENABLE_REAL_QUOTA_GUARD=true",
    "ai_generate debugConfig",
    "fabricReplace mock providerPromptMeta",
    "Upload fabric_replace startGenerate",
    "Result handleConsumeForAction H2 table",
    "P12 dryRun missing quota record",
    "P12 dryRun fake consumed record"
  ],
  "acceptance": [
    "mock/fallback 主链路可用",
    "advancedPromptMeta 返回摘要",
    "providerPromptMeta 返回摘要",
    "provider contract smoke 通过",
    "real provider 默认禁用",
    "real quota guard 默认禁用",
    "dryRun 默认禁用且不请求 endpoint",
    "开启真实 provider 前必须先完成真实 quota guard 数据库实测",
    "日志不打印完整 prompt / 图片 URL / endpoint / API key"
  ]
}
```

## P18 Real Provider Switch Matrix And Gray Release Smoke

### Switch matrix A-G

| Mode | ENABLE_REAL_QUOTA_GUARD | PROVIDER_DRY_RUN | ENABLE_REAL_PROVIDER_CALL | Expected behavior |
| --- | --- | --- | --- | --- |
| A default safe mock | false | false | false | quota_guard uses mock; ai_generate uses mock/fallback; no real usage records; no provider request; mini program main flow remains available. |
| B quota real Alpha only | true | false | false | quota_guard can run real consume/rollback smoke; ai_generate still must not request provider; provider path remains mock/fallback. |
| C provider dryRun + quota real Alpha | true | true | false | quota real Alpha can provide consumed record; provider only builds requestPlan / normalized dryRun result; no endpoint request; quotaRecordId with consumed status is required. |
| D forbidden dryRun without real quota | false | true | false | Blocked for device smoke; only local contract tests may simulate it. It must not produce a real-looking provider dryRun success result. |
| E forbidden real provider without real quota | false | false | true | Blocked with REAL_QUOTA_GUARD_REQUIRED; no endpoint request; no fallback may hide the error. |
| F forbidden real provider and dryRun conflict | true | true | true | Blocked with PROVIDER_SWITCH_CONFLICT; recommended behavior is explicit block to avoid ambiguous configuration. |
| G gray real provider allowed | true | false | true | Allowed only after the P18 hard checklist passes; must consume quota first and pass provider contract validation. |

### Blocked combinations

- E: `ENABLE_REAL_PROVIDER_CALL=true` with `ENABLE_REAL_QUOTA_GUARD=false` returns `REAL_QUOTA_GUARD_REQUIRED` and must not request endpoint.
- F: `ENABLE_REAL_PROVIDER_CALL=true` with `PROVIDER_DRY_RUN=true` returns `PROVIDER_SWITCH_CONFLICT` and must not request endpoint.
- D: `PROVIDER_DRY_RUN=true` with `ENABLE_REAL_QUOTA_GUARD=false` is forbidden for device smoke and must be blocked or kept to local contract-only checks.

### Real provider hard checklist

1. `ENABLE_REAL_QUOTA_GUARD=true` database smoke passed.
2. Reusing the same `idempotencyKey` returns the same consume `recordId`.
3. `rollbackOfRecordId` is present and correct.
4. Repeated rollback does not add quota twice.
5. `finalizeUsage` is implemented, or successful real provider tasks are explicitly non-rollbackable.
6. dryRun without `quotaRecordId` is blocked.
7. dryRun with a consumed `quotaRecordId` can build requestPlan and never requests endpoint.
8. Real provider timeout aborts the underlying request.
9. Timeout is not retried.
10. Retry is limited to network errors, 429, and 5xx.
11. Accepted async task returns pending/accepted and never fallback mock.
12. Result page blocks mock/fallback approval.
13. Batch detail blocks mock/fallback approval.
14. Logs do not expose prompt, image URL, endpoint, or API key.
15. Provider endpoint/key are only configured in cloud function environment variables, never in repo files.
16. First gray run is limited to one test account, one action, and one image.

### P18 log safety

Allowed: booleans, counts, lengths, masked `recordId`/`taskId`, `providerTaskType`, `costActionType`, `status`, `errorCode`, `timeoutMs`, `retryTimes`, and switch flags.

Forbidden: full `customPrompt`, full `fullAdvancedPromptSummary`, `positivePrompt`, `negativePrompt`, image URLs, `fileID`, `localPath`, endpoint, API key, Authorization, and raw `idempotencyKey`.

## P19 finalizeUsage terminal rule update

The real provider hard checklist is updated:

- `finalizeUsage` is implemented.
- Finalized quota records reject rollback with `QUOTA_RECORD_FINALIZED`.
- Rolled back quota records reject finalize with `QUOTA_RECORD_ALREADY_ROLLED_BACK` or `QUOTA_RECORD_NOT_CONSUMABLE`.
- Repeated finalize returns the same finalized record without duplicate terminal writes.
- Repeated rollback must not add quota twice.

Before enabling real provider gray release, run the P19 smoke in `docs/smoke/quota-guard-real-alpha-smoke.md` after P14/P17 quota real Alpha smoke.
## P20 开发环境实机 smoke 顺序执行清单

- 名称：开发环境实机 smoke 顺序执行清单。
- 文档：`docs/smoke/p20-devtools-real-alpha-runbook.md`。
- 目的：串联 P17/P18/P19，在真实 provider 灰度前完成手工复验。
- 禁止：不调用真实 provider，不开启 `ENABLE_REAL_PROVIDER_CALL=true` 执行真实请求，不打印 prompt、图片 URL、endpoint、API key、Authorization 或原始 idempotencyKey。
- 通过标准：阶段 A-F 全部通过，且无停止条件触发。

阶段摘要：

| 阶段 | 环境变量组合 | 验证目标 |
| --- | --- | --- |
| A 默认 mock 安全基线 | `false / false / false` | mock 主链路安全，不写真实 usage，不请求 provider |
| B quota real Alpha only | `true / false / false` | consume 幂等，rollback 正确 |
| C finalize 终态验证 | `true / false / false` | finalized 后不可 rollback，rolled_back 后不可 finalize |
| D provider dryRun + quota | `true / true / false` | dryRun 依赖 consumed quotaRecordId，不请求 endpoint |
| E 禁止组合检查 | D/E/F 禁止组合 | 禁止组合 blocked |
| F 审核红线复验 | `false / false / false` | mock/fallback 不可审核通过 |

## P21 真实 provider 灰度首轮执行方案

- 名称：真实 provider 灰度首轮执行方案。
- 文档：`docs/smoke/real-provider-canary-plan.md`。
- 目的：定义首轮真实调用边界、停止条件、回滚方案和灰度记录表。
- 禁止：P21 本轮不调用真实 provider，不开启 `ENABLE_REAL_PROVIDER_CALL`，不写入真实 API key。
- 前置：P20 A-F 全部实机通过。
- 通过标准：方案完整、只允许 P18 G 作为真实灰度组合、停止条件明确、回滚规则明确、日志红线明确。

首轮真实灰度范围必须限制为单测试账号、单 action、单任务、单张无敏感信息测试图；不允许 batch、客户真实订单、自动扩量或自动交付审核。

## P20 DevTools real Alpha smoke 结果

P20 已完成微信开发者工具实机复验并通过。覆盖范围：默认 mock 安全态、quota_guard real Alpha consume/idempotency/rollback/finalize、provider dryRun + quotaRecordId、危险开关组合拦截，以及最终恢复默认安全环境。

已验证修复：

- 云函数上传配置 `cloudfunctionRoot`。
- quota usage 初始化诊断与兼容创建。
- consume 事务诊断与 `_id` payload 修复。
- consume 幂等与 repeated rollback 返回结构。
- finalize 终态规则。
- `ai_generate action='generate'` 通用生成入口。
- provider dryRun + real quota 联动。
- 危险组合 E1/E2/E3 switch matrix blocked。

最终安全状态：`ENABLE_REAL_PROVIDER_CALL=false`、`PROVIDER_DRY_RUN=false`、`ENABLE_REAL_QUOTA_GUARD=false`。当前未调用真实 API，未开启真实 provider，dryRun 不生成真实图片。
- P21-0 static checklist: `docs/smoke/p21-real-provider-canary-checklist.md`

## P21-0 Real Provider Canary Static Check

P21-0 静态检查已记录到 `docs/smoke/p21-real-provider-canary-checklist.md`。本轮不调用真实 API，不开启真实 provider，不改动云函数环境变量，不写入真实 quota 数据。

当前默认安全态：

```text
ai_generate:
ENABLE_REAL_QUOTA_GUARD=false
PROVIDER_DRY_RUN=false
ENABLE_REAL_PROVIDER_CALL=false

quota_guard:
ENABLE_REAL_QUOTA_GUARD=false
```

检查结论：

- 当前仍为 `A_DEFAULT_SAFE_MOCK`，`ai_generate` 默认 mock/fallback，`quota_guard` 默认 `mock=true`。
- 真实 provider canary 仅允许在 `ENABLE_REAL_PROVIDER_CALL=true`、`PROVIDER_DRY_RUN=false`、`ENABLE_REAL_QUOTA_GUARD=true`、`switchMatrixAllowed=true` 且存在 consumed `quotaRecordId`、`idempotencyKey`、`costActionType`、完整 endpoint/API key 时进入。
- D/E/F 禁止组合已存在；E 对应 `REAL_QUOTA_GUARD_REQUIRED`，F 对应 `PROVIDER_SWITCH_CONFLICT`。
- 日志检查以 `hasApiKey`、`hasEndpoint`、status、errorCode、长度、布尔值为主，不应输出 API key、Authorization、完整 endpoint、base64、完整 openid、临时 URL 敏感 query 或 provider 原始完整响应。
- 前端不能单独开启真实 provider，`utils/api/generate.js` 默认关闭 client mock fallback，`pages/result/result.vue` 保留 mock/fallback 审核通过拦截。

## P21-0 Real Provider Canary 前置验证完成

P21-0 已完成，当前已经恢复默认安全 mock 态。详细记录见 `docs/smoke/p21-real-provider-canary-checklist.md`。

### P21-0.2 默认安全状态部署验证通过

`ai_generate debugConfig`：

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

P21-0.3 期间发现并修复：`ai_generate` 之前没有用 `quotaRecordId` 查询 `quota_guard` 已写入的 consumed record，导致 `REAL_QUOTA_GUARD_REQUIRED`。已兼容 `event.quotaRecordId`、`event.quota_record_id`、`event.usageRecordId`、`event.recordId`、`event.input.quotaRecordId`、`event.input.usageRecordId`，并在 real quota guard 模式下查库确认 consumed record。

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

结论：P21-0 完成。当前已恢复默认安全 mock 态，真实 API 未调用，真实 provider 未开启，dryRun 已关闭，real quota guard 已关闭。

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

## P21-1A 真实 provider 选型结论

P21-1A 只记录 provider 选型和人工准备事项，不改代码、不部署、不调用真实 API。

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

P21-1 首轮目标：

- 优先接通义万相 / DashScope 文生图或最小图像生成链路。
- 验证 `AI_API_ENDPOINT` / `AI_API_KEY` 能被云函数读取。
- 验证真实 provider HTTP 调用。
- 验证 `consume -> ai_generate -> finalize` 成功链路。
- 验证失败 rollback 链路。
- 验证 pending / accepted 不 finalize、不 rollback。
- 测完恢复 `A_DEFAULT_SAFE_MOCK`。

P21-2 或后续目标：

- 接入 AI 试衣 `aitryon-plus`。
- 支持换模特、保持服装款式一致、上衣 / 下装试衣、服装电商图生成。

当前不能进入真实 canary：

- `hasEndpoint=false`。
- `hasApiKey=false`。
- 缺少 `AI_API_ENDPOINT`。
- 缺少 `AI_API_KEY`。
- 不能开启 `ENABLE_REAL_PROVIDER_CALL=true`。
- 不能跑真实 provider canary。
- 不能调用真实 API。

当前必须保持：

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

## 2026-06-17 小程序 UI 主链路稳定性验收

小程序 UI 主链路稳定性验收完成：

- 首页 index 可编译
- 作品页 gallery 可编译
- 上传页 upload 语法检查通过
- 结果页 result 语法检查通过
- tabBar：首页 / 作品 / 我的 配置存在
- 官网 website-demand 路由存在
- 未发现 missing end tag
- 未发现 Unterminated string constant
- 未改云函数
- 未开启真实 provider
- 当前 dev:h5 script 不存在，H5 预览仍使用已有 serve:h5:local
