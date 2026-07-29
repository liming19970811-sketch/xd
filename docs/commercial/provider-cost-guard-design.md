# 真实 Provider 成本保护设计

## 1. 目标

真实接入阿里/万相等图片生成 API 前，必须把 AI 点数消耗从前端 mock 体验升级为云端强校验。真实 provider 调用可能产生实际扣费，不能允许绕过额度校验、重复提交或失败后错误扣点。

本阶段只做设计文档和代码占位，不默认启用，不影响当前 mock 生成链路。

## 2. 真实生成保护流程

1. 前端发起生成。
2. 如果目标是真实 provider 且该动作需要消耗 AI 点数，生成 `idempotencyKey`。
3. 调用 `quota_guard.consumeAiPoints`。
4. 云端扣点成功后，再调用 `ai_generate`。
5. `ai_generate` 成功，记录 task 成功。
6. `ai_generate` 失败时，根据 provider 是否已收到请求决定 rollback。
7. mock/fallback 结果不扣正式额度，只记录 intent。

推荐顺序：

```text
client -> quota_guard.consumeAiPoints -> ai_generate(real provider) -> task success/failure
```

禁止顺序：

```text
client -> ai_generate(real provider) -> frontend/local deduct
```

## 3. actionType 映射

| 场景/功能 | actionType | 点数 |
| --- | --- | --- |
| 电商主图 / AI 模特图 | `ai_model_image` | 5 |
| 设计稿成衣图 | `sketch_to_model` | 5 |
| 图片转结构线稿 | `image_to_sketch` | 5 |
| 爆款改款 / 线稿改款效果图 | `hot_style_remix` | 6 |
| 细节特写 | `detail_closeup` | 2 |
| 3 秒走秀视频 | `runway_video_3s` | 25 |
| 5 秒走秀视频 | `runway_video_5s` | 45 |
| 10 秒走秀视频 | `runway_video_10s` | 90 |

云端必须按 `actionType` 自己计算 cost，不能信任前端传入的 cost。

## 4. idempotencyKey 方案

格式：

```text
user/openid + actionType + clientTaskId/taskId + clientRequestId
```

示例：

```text
openid_xxx_ai_model_image_task_123_req_456
```

要求：

- 同一次生成重试必须复用相同 `idempotencyKey`。
- 不同用户、不同 actionType、不同 task 或不同用户主动请求应使用不同 key。
- `membership_usage_records.idempotencyKey` 必须建立唯一约束。
- 如果相同 key 已经 consumed，云端直接返回已有流水，不重复扣点。

## 5. rollback 规则

### 可 rollback

1. 云函数调用失败，能确认 provider 未收到请求。
2. provider 返回参数错误，明确没有创建任务、没有出图、没有扣费。
3. 请求在本地校验阶段失败，尚未发起真实 provider 请求。

### 不立即 rollback

1. provider 已接受异步任务，返回 task_id。
2. provider 超时但无法确认是否已收到请求。
3. provider 可能已计费但最终状态未知。

这些情况应进入 pending/人工审计或轮询状态，等最终失败确认后再 rollback。

### 不 rollback

1. provider 成功生成，但前端展示失败。
2. 结果已写入任务，只是页面恢复失败。
3. mock/fallback，因为未扣正式额度，不需要 rollback。

## 6. 代码插点

### 前端 `utils/api/generate.js`

TODO：

- before real provider generation: call `quota_guard.consumeAiPoints`
- pass `idempotencyKey` with generate payload
- never trust frontend cost
- cloud function call failure must not become local fake success

### 云函数 `cloudfunctions/ai_generate/index.js`

TODO：

- before real adapter call: verify quota guard record or consume through server-side guard
- after provider failure: rollback only when provider did not receive request or clearly did not charge
- if provider returns async task_id: do not rollback submit immediately
- mock/fallback should not consume formal quota, only record intent upstream

## 7. 默认开关

当前默认不启用真实成本保护链路：

- `ENABLE_REMOTE_QUOTA_GUARD=false`
- `ai_generate` 仍保持当前 mock/real adapter 编排
- 当前 mock provider 成功链路不变

上线真实 provider 前必须：

1. 启用云端 `quota_guard`。
2. 完成 consume -> real provider -> success/failure/rollback 测试。
3. 验证重复调用不会重复扣点。
4. 验证 provider 未收到请求失败时可 rollback。
5. 验证 provider 已接收异步任务时不会误 rollback。

## 8. 安全红线

- 不允许前端决定 cost。
- 不允许前端传 membershipTier 作为可信来源。
- 不允许先调用真实 provider 后再扣点。
- 不允许 timeout 后盲目 retry 造成重复扣费。
- 不允许 provider 已接收异步任务后再次 submit。
- 不允许 mock/fallback 当真实交付图审核通过。
