# 服装增强功能接口映射表 P0

本文档用于记录服装增强功能从 P0 mock 入口到后续真实接口接入的映射关系。当前阶段只做入口、扣点入口和 mock 结果，不接真实 provider。

## Result 页二次加工功能映射

| 功能名称 | actionType | 当前状态 | 扣点 | 后续建议接口 | 是否异步 | 是否需要 quota_guard | 失败是否 rollback | 备注 |
| --- | --- | --- | ---: | --- | --- | --- | --- | --- |
| AI印花生成 | `print_generate` | Result 页按钮已接入，当前生成 mock extension result | 3 | 万相图像生成/图案生成 | 否/视接口 | 是 | provider 未收到请求可 rollback | 先输出图案体验结果，后续再接真实图案生成 |
| 一键衣身贴图 | `print_placement` | Result 页按钮已接入，当前生成 mock extension result | 4 | 图像编辑/局部重绘/贴图 | 否/视接口 | 是 | provider 未收到请求可 rollback | 适合前胸、后背、满印贴图占位 |
| AI面料替换 | `fabric_replace` | P2：`ai_generate.fabricReplace` 已保留 mock 占位，并新增 `FABRIC_REPLACE_PROVIDER` 配置检查；默认 mock，real 未配置返回 `FABRIC_REPLACE_CONFIG_MISSING`，配置齐全返回 `FABRIC_REPLACE_REAL_NOT_IMPLEMENTED`，未调用真实万相 | 2 | P3 接万相图像编辑/局部材质替换真实请求 | 否/视接口 | 是 | provider 未收到请求可 rollback | 建议第一个真实接入；真实开关默认关闭；云函数 debugConfig 只返回配置摘要 |
| 同款多色批量生成 | `basic_recolor` | Result 页按钮已接入，当前生成 mock extension result | 1 | 图像编辑/换色 | 否/视接口 | 是 | provider 未收到请求可 rollback | 建议第二个真实接入 |
| 爆款衍生改款 | `hot_style_remix` | Result 页按钮已接入，当前生成 mock extension result | 6 | 图像生成/图像编辑 | 否/视接口 | 是 | provider 未收到请求可 rollback | 文案统一为辅助改款，不写扒款/抄版 |
| 局部放大细节图 | `detail_closeup` | Result 页按钮已接入，当前生成 mock extension result | 2 | 局部超分/细节增强 | 否/视接口 | 是 | provider 未收到请求可 rollback | 建议第三个真实接入 |
| 自动排版详情长图 | `detail_long_image` | Result 页按钮已接入，当前生成 mock extension result | 3 | 优先前端/云端 JS 拼图，不优先走 AI | 否 | 可选 | 不涉及 provider 成本时不需要 rollback | 先做主图、场景图、细节图拼版 |
| 一键生成T台走秀短片 | `runway_video_3s` / `runway_video_5s` / `runway_video_10s` | Result 页按钮已接入，当前生成视频占位 mock result | 25 / 45 / 90 | 万相图生视频 | 是 | 是 | 已接受异步任务不立即 rollback，最终失败再 rollback | 当前 `videoUrl=''`，只提示走秀视频能力即将开放 |

## 首页原创开发工具映射

| 功能名称 | entryScene | actionType | 当前状态 | 扣点 | 后续建议接口 | 是否异步 | 是否需要 quota_guard | 失败是否 rollback | 备注 |
| --- | --- | --- | --- | ---: | --- | --- | --- | --- | --- |
| 设计稿成衣图 | `sketch_to_model` | `sketch_to_model` | 首页入口和 upload preset 已接入 | 5 | 图生图/设计稿生成上身效果图 | 否/视接口 | 是 | provider 未收到请求可 rollback | 输出为上身参考图 |
| 图片转结构线稿 | `image_to_sketch` | `image_to_sketch` | 首页入口和 upload preset 已接入 | 5 | 图像理解/线稿生成 | 否/视接口 | 是 | provider 未收到请求可 rollback | 输出为参考线稿，不承诺生产制版 |
| 线稿改款效果图 | `sketch_remix` | `hot_style_remix` 或 `sketch_to_model` | 首页入口和 upload preset 已接入 | 6 或 5 | 图像生成/图像编辑 | 否/视接口 | 是 | provider 未收到请求可 rollback | 后续需要统一 actionType |
| AI款式起稿 | `text_to_sketch` | `sketch_to_model` 或新增 `text_to_sketch` | 首页入口和 upload preset 已接入 | 暂按落地 actionType 计算 | 文生图/款式草图生成 | 否/视接口 | 是 | provider 未收到请求可 rollback | 如新增 `text_to_sketch`，需要同步 `aiPointCost` 和 `quota_guard` 成本表 |

## 推荐真实接入顺序

按风险和成本从低到高建议：

1. AI面料替换 `fabric_replace`
2. 同款多色 `basic_recolor`
3. 局部细节图 `detail_closeup`
4. AI印花生成 `print_generate`
5. 一键衣身贴图 `print_placement`
6. 详情长图 `detail_long_image`
7. 设计稿成衣图 `sketch_to_model`
8. 图片转结构线稿 `image_to_sketch`
9. 走秀视频 `runway_video`

## 上线前强制规则

- 真实 provider 调用前必须先调用 `quota_guard.consumeAiPoints`。
- 前端传入的 cost 不可信，云端必须按 `actionType` 计算成本。
- mock/fallback 任务不扣正式额度，只生成体验结果或记录意向。
- 只有 provider 未收到请求时才可 rollback。
- 异步任务已提交后不立即 rollback，应等待最终任务状态；最终失败后再按状态机执行 rollback。
- 不得使用“扒款”“抄版”“100%版权登记”“必然维权成功”等高风险文案。
- 详情长图如仅使用前端/云端 JS 拼图且不产生 provider 成本，可不走 AI provider rollback。

## fabric_replace P2 配置项

云函数 `ai_generate.fabricReplace` 使用独立配置，不复用主生成链路的 `AI_PROVIDER`。

| 环境变量 | 默认值 | 是否返回原文 | 说明 |
| --- | --- | --- | --- |
| `FABRIC_REPLACE_PROVIDER` | `mock` | 返回 provider 值 | `mock` 时走 mock；`real` 时进入配置检查 |
| `FABRIC_REPLACE_ENDPOINT` | 空 | 否，只返回 `hasFabricReplaceEndpoint` | P3 真实接口地址 |
| `FABRIC_REPLACE_API_KEY` | 空 | 否，只返回 `hasFabricReplaceApiKey` | P3 真实接口密钥 |
| `FABRIC_REPLACE_MODEL` | `wanx-image-edit` | 返回模型名 | P3 默认图像编辑模型占位 |
| `FABRIC_REPLACE_TIMEOUT_MS` | `18000` | 返回超时时间 | P3 请求超时占位 |

`debugConfig` 只允许返回：

- `fabricReplaceProvider`
- `hasFabricReplaceEndpoint`
- `hasFabricReplaceApiKey`
- `fabricReplaceModel`
- `fabricReplaceTimeoutMs`
## H2 成本 actionType 归一表

新增入口的 `entryScene/taskType` 不一定等于成本表中的扣点 `actionType`。前端在调用成本查询、扣点或 `quota_guard.consumeAiPoints` 前，必须先归一为 `costActionType`。

| entryScene/taskType | costActionType | cost | 说明 |
| --- | --- | ---: | --- |
| `text_to_sketch` | `sketch_to_model` | 5 | AI 款式起稿先按设计稿成衣图成本归一 |
| `sketch_remix` | `hot_style_remix` | 6 | 线稿改款效果图按爆款衍生改款成本归一 |
| `color_batch` | `basic_recolor` | 1 | 同款多色批量生成按基础换色成本归一 |
| `detail_page_from_photo` | `detail_long_image` | 3 | 实拍图详情页素材先按详情长图成本归一 |
| `sketch_to_tech_pack` | `image_to_sketch` | 5 | 参考工艺结构图先按图片转结构线稿成本归一 |
| `runway_video + 3s` | `runway_video_3s` | 25 | 走秀视频按时长分档 |
| `runway_video + 5s` | `runway_video_5s` | 45 | 走秀视频按时长分档 |
| `runway_video + 10s` | `runway_video_10s` | 90 | 走秀视频按时长分档 |

规则：
- 前端统一使用 `resolveCostActionType(input, options)`。
- `options.costActionType` 显式存在时优先使用。
- `runway_video` 根据 `durationSec` 归一到 `runway_video_3s`、`runway_video_5s`、`runway_video_10s`，默认 3 秒。
- 云端 `quota_guard` 仍按 `actionType` 成本表强校验，本阶段不改成本数值。

## P3 高级提示词参数占位说明

Upload 页生成请求已透传以下高级面板摘要字段到 `generateResult` / `ai_generate`：

- `advancedPanelValues`
- `advancedCustomPrompts`
- `advancedOptionPrompts`
- `customPromptSummary`
- `optionPromptSummary`
- `fullAdvancedPromptSummary`
- `costActionType`

当前阶段仅用于 mock/fallback 链路调试和后续真实 provider 拼接 prompt 的参数占位。`ai_generate` 只返回 `data.advancedPromptMeta`，包括摘要长度、选项摘要数量、补充需求数量和 `costActionType`，不返回完整用户提示词。

边界：
- 未调用真实万相 API。
- 未改变 `quota_guard` 成本数值。
- 未改变支付和套餐配置。
- 后续接真实 provider 前，云端仍必须以 `costActionType/actionType` 做 quota_guard 强校验，不能信任前端成本。

## P4 Provider Prompt Adapter 占位设计

`ai_generate` 新增 Provider Prompt Adapter，用于把业务参数、`costActionType` 和 `fullAdvancedPromptSummary` 组合为真实 provider 可用的 prompt payload。当前阶段只构建 prompt 和 meta，不调用真实万相 API。

### providerTaskType 映射

| entryScene / costActionType | providerTaskType |
| --- | --- |
| `fabric_replace` / `fabricReplace` | `image_edit_fabric_replace` |
| `print_generate` | `image_generate_print` |
| `print_placement` | `image_edit_print_placement` |
| `color_batch` / `basic_recolor` | `image_edit_recolor` |
| `detail_long_image` / `detail_page_from_photo` | `image_layout_detail_long_image` |
| `detail_closeup` | `image_enhance_closeup` |
| `sketch_to_model` | `sketch_to_model_image` |
| `image_to_sketch` | `image_to_structure_sketch` |
| `hot_style_remix` | `style_remix_image` |
| `runway_video_3s` / `runway_video_5s` / `runway_video_10s` | `image_to_runway_video` |
| 未知 | `generic_fashion_image` |

### positivePrompt 组合规则

1. 基础任务描述：按 `providerTaskType` 生成中文任务说明。
2. 基础参数摘要：包含 `templateType`、`styleCode`、`sceneCode`、`bodyType`、`costActionType`。
3. 高级面板摘要：追加 `fullAdvancedPromptSummary`；为空时写入“使用默认高级参数。”。
4. 业务安全说明：保持服装主体清晰，避免夸张变形、不合理肢体、错位纽扣、破碎纹理、文字水印和品牌标识。

### negativePrompt 规则

基础负向提示词统一包含：低清晰度、变形人体、错误手部、多余肢体、衣服结构错乱、面料纹理破碎、印花漂浮、文字水印、品牌 logo、过度磨皮、背景脏乱、商品主体缺失。

任务追加：
- `fabric_replace`：避免改变衣服版型、避免破坏原有褶皱、避免面料贴图漂浮。
- `runway_video`：避免人物闪烁、衣摆穿模、背景跳变、脸部变形、动作僵硬。
- `image_to_sketch`：避免线稿断裂、结构标注错误、过度阴影、照片质感残留。

### 日志安全

- 普通日志只打印 `[ai_generate:provider-prompt] built` 摘要字段。
- `providerPromptMeta` 可返回给 mock 调试。
- 不打印、不返回完整 `positivePrompt` / `negativePrompt` / `fullAdvancedPromptSummary`。
- 不打印图片 URL、fileID、API key、endpoint 原文。

## P6 审查问题最小修复边界

### 真实 provider 硬开关

- `ENABLE_REAL_PROVIDER_CALL` 默认为关闭。
- 即使 `AI_PROVIDER=real`，只要 `ENABLE_REAL_PROVIDER_CALL !== 'true'`，`ai_generate` 不得请求真实 endpoint。
- 未开启时返回 `REAL_PROVIDER_DISABLED` 或按当前 mock/fallback 策略回落。
- 后续启用真实 provider 前，必须先完成 `quota_guard.consumeAiPoints` 强校验和稳定 `idempotencyKey` 设计。

### 日志脱敏规则

- `generateResult` 只打印 `cloud response raw summary` / `cloud response result summary`。
- 摘要日志只允许出现 success/ok/status、短 taskId、是否存在结果图、provider、mock/fallback、advancedPromptMeta、providerPromptMeta、costActionType、errorCode/message 摘要。
- 禁止打印完整 `resultImageUrl`、`sourceImageUrl`、`fileID`、`localPath`、`fullAdvancedPromptSummary`、`customPromptSummary`、`positivePrompt`、`negativePrompt`、endpoint 原文、API key。

### 成本 strict 校验

- 保留旧 `getAiPointCost(actionType)` 兼容行为，未知 actionType 仍返回 0。
- 新增 strict 能力用于真实扣点前检查：未知 actionType 返回 `unknown_action_type`。
- 前端 cost 不可信；真实扣点仍以云端 `quota_guard` 为最终强校验。

## P7 quota_guard 云端强校验调用边界

真实 provider 接入前，调用顺序必须固定为：

1. `resolveCostActionType`
2. `quota_guard.consumeAiPoints` 或对应 consume action
3. 得到 `status='consumed'` 的 usage record
4. 调用 provider
5. provider 未收到请求失败：调用 `rollbackUsage`
6. provider 已返回 `task_id`：不立即 rollback，进入 pending/轮询
7. provider 最终失败：按 provider 最终状态做 finalize/rollback

边界规则：

- `quota_guard` 是真实扣点最终强校验，不能信任前端 cost。
- consume 必须带 `idempotencyKey`。
- 重复 `idempotencyKey` 必须返回原流水或 pending 状态，不重复扣点。
- provider 已接受异步任务后不能立即 rollback。
- 当前 P7 只完成设计和 `ENABLE_REAL_QUOTA_GUARD` 骨架，不启用真实数据库扣减。

## P8 Provider 接入前参数契约

真实 provider 接入前必须遵守 `docs/ai/provider-contract-design.md` 中的统一契约。

关键结构：

- `requestPlan`：统一封装 `providerTaskType`、`costActionType`、`idempotencyKey`、`quotaRecordId`、图片输入、prompt meta、业务参数、高级面板摘要和 safety 状态。
- `normalizedProviderResult`：统一返回 `ok/providerTaskId/status/resultImageUrl/resultVideoUrl/providerReceivedRequest/providerAcceptedTask/shouldRollbackQuota/shouldEnterPolling/errorCode/meta`。
- `providerPromptMeta`：只返回 `promptVersion`、长度、count、`providerTaskType`、`costActionType`，不返回完整 prompt。

真实请求前置条件：

1. `ENABLE_REAL_PROVIDER_CALL === 'true'`
2. `ENABLE_REAL_QUOTA_GUARD === 'true'`
3. `quota_guard.consume*` 返回 consumed record
4. requestPlan 中 `safety.hasQuotaConsumeRecord=true`
5. requestPlan 校验通过

当前 P8 仍不调用真实 API；adapter skeleton 只做构建、校验、归一和错误契约。

## P11 ai_generate 真实 provider 前置 quota record 契约

真实 provider 调用顺序必须固定为：

1. `resolveCostActionType`
2. `quota_guard.consumeAiPoints`
3. 获取 `status='consumed'` 的 `recordId`
4. 调用 `ai_generate` 时传入 `quotaRecordId` 和 `quotaConsumedRecord`，并保留同一个 `idempotencyKey`
5. `ai_generate` 执行 real provider quota preflight
6. preflight 通过后才允许进入真实 provider adapter
7. provider 未收到请求前失败，才允许按 consumed record 做 `rollbackUsage`
8. provider 已返回 `task_id` 或已接受异步任务后，不立即 rollback，进入 pending/轮询/finalize

缺少 `quotaRecordId`、`quotaConsumedRecord.status='consumed'`、`idempotencyKey` 或 `costActionType` 时，`ai_generate` 必须返回 `REAL_QUOTA_GUARD_REQUIRED`，并保证：

- `providerReceivedRequest=false`
- `providerAcceptedTask=false`
- `shouldRollbackQuota=false`
- 不请求真实 endpoint

mock/fallback 链路不要求 quota record，继续用于本阶段体验和 smoke。

## P13 全链路 smoke 与上线前审计索引

P1-P12 的全链路 smoke、日志安全、成本扣点、provider dryRun、quota_guard 和上线前风险边界已汇总到：

```text
docs/smoke/full-chain-smoke-summary.md
```

真实 provider 接入前必须同时复核本文档的接口映射、`docs/ai/provider-contract-design.md` 的 provider 契约，以及 `docs/commercial/quota-cloud-guard-design.md` 的 quota guard 强校验设计。
