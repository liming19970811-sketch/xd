# P20 开发环境实机 smoke 顺序执行清单

本 runbook 用于在微信开发者工具中按顺序复验 P17/P18/P19。全程只验证 mock、quota real Alpha、provider dryRun 与审核红线，不调用真实 provider。

## 0. 前置安全确认

- 当前不允许设置 `ENABLE_REAL_PROVIDER_CALL=true` 执行真实请求。
- 当前不允许调用真实 provider。
- provider endpoint / API key 即使已配置，也不得被请求。
- 所有脚本只输出 boolean、status、masked id、errorCode、count、length。
- 不得打印原始 `idempotencyKey`。
- 不得打印完整 prompt、图片 URL、fileID、localPath、endpoint、API key、Authorization。

## 1. 阶段 A：默认 mock 安全基线

环境变量：

```text
ENABLE_REAL_QUOTA_GUARD=false
PROVIDER_DRY_RUN=false
ENABLE_REAL_PROVIDER_CALL=false
```

执行：

1. `ai_generate debugConfig`
2. `quota_guard debugConfig`
3. quota mock consume
4. 小程序主链路 mock 生成一次；可引用 `docs/smoke/manual-smoke-miniapp.md` 中 P3/P5/P6 的 Upload 生成 smoke。

预期：

- `switchMatrixMode=A_DEFAULT_SAFE_MOCK` 或等价 default mock。
- `ai_generate` provider 为 mock，或 real provider disabled。
- `quota_guard mock=true`。
- 不写真实 `membership_usage` / `membership_usage_records`。
- 不请求 provider。
- 小程序生成主链路可用。

## 2. 阶段 B：quota real Alpha only

环境变量：

```text
ENABLE_REAL_QUOTA_GUARD=true
PROVIDER_DRY_RUN=false
ENABLE_REAL_PROVIDER_CALL=false
```

执行：

1. quota debugConfig raw。
2. quota real consume first。
3. quota real consume second with same `idempotencyKey`。
4. idempotency check。
5. rollback。
6. duplicate rollback。

脚本索引：

- P17 quota consume / rollback：`docs/smoke/quota-guard-real-alpha-smoke.md`
- P14 real Alpha 基础 smoke：`docs/smoke/quota-guard-real-alpha-smoke.md`

预期：

- `enableRealQuotaGuard=true`。
- `realModeImplemented=true`。
- 第二次 `recordId === 第一次 recordId`。
- 两次 `afterValue` 一致。
- 不重复扣点。
- `rollbackOfRecordId` 指向 consumed record。
- 重复 rollback 不重复加点。

## 3. 阶段 C：finalize 终态验证

环境变量：

```text
ENABLE_REAL_QUOTA_GUARD=true
PROVIDER_DRY_RUN=false
ENABLE_REAL_PROVIDER_CALL=false
```

执行：

1. debugConfig 检查 `finalizeImplemented=true`。
2. consume -> finalize。
3. finalize again。
4. rollback after finalize blocked。
5. consume -> rollback -> finalize blocked。

脚本索引：

- P19 finalize 终态 smoke：`docs/smoke/quota-guard-real-alpha-smoke.md`

预期：

- `consumed -> finalized` 成功。
- 重复 finalize 返回同一 record。
- finalized 后 rollback 返回 `QUOTA_RECORD_FINALIZED`。
- `monthlyAiPointsUsed` 不被 rollback 改回。
- rollback 后 finalize 返回 `QUOTA_RECORD_ALREADY_ROLLED_BACK` 或等价错误。
- 不调用 provider。

## 4. 阶段 D：provider dryRun + quota real Alpha

环境变量：

```text
ENABLE_REAL_QUOTA_GUARD=true
PROVIDER_DRY_RUN=true
ENABLE_REAL_PROVIDER_CALL=false
```

执行：

1. `ai_generate debugConfig`。
2. switch matrix check。
3. provider dryRun missing `quotaRecordId`。
4. provider dryRun with consumed `quotaRecordId`。
5. accepted async task 不 fallback mock 检查。

脚本索引：

- P18 switch matrix：`docs/smoke/manual-smoke-miniapp.md`
- P17 provider dryRun + quotaRecordId 契约：`docs/smoke/manual-smoke-miniapp.md`
- 本地 contract 补充：`node scripts/smoke/provider-contract-smoke.js`

预期：

- `switchMatrixMode=C_PROVIDER_DRY_RUN_WITH_REAL_QUOTA`。
- 缺 `quotaRecordId` 返回 `REAL_QUOTA_GUARD_REQUIRED` 或等价 blocked。
- 带 consumed `quotaRecordId` 可构建 requestPlan / providerDryRunResult。
- 不请求 endpoint。
- accepted async task 返回 pending/accepted。
- `fallback !== true`。
- `mock !== true`。
- `provider !== mock`。
- 不生成 `mock_generate_` taskId。

## 5. 阶段 E：禁止组合检查

只做 debugConfig / preflight，不调用生成。

### 检查 D：dryRun 但 quota 关闭

```text
ENABLE_REAL_QUOTA_GUARD=false
PROVIDER_DRY_RUN=true
ENABLE_REAL_PROVIDER_CALL=false
```

预期：

- 文档标记禁止实机链路。
- preflight blocked 或提示 only local contract smoke。

### 检查 E：真实 provider 开启但 quota 关闭

```text
ENABLE_REAL_QUOTA_GUARD=false
PROVIDER_DRY_RUN=false
ENABLE_REAL_PROVIDER_CALL=true
```

预期：

- blocked。
- `errorCode=REAL_QUOTA_GUARD_REQUIRED`。
- 不请求 endpoint。

### 检查 F：真实 provider 与 dryRun 同时开启

```text
ENABLE_REAL_QUOTA_GUARD=true
PROVIDER_DRY_RUN=true
ENABLE_REAL_PROVIDER_CALL=true
```

预期：

- blocked。
- `errorCode=PROVIDER_SWITCH_CONFLICT`。
- 不请求 endpoint。

## 6. 阶段 F：result / batch-detail 审核红线复验

建议环境变量：

```text
ENABLE_REAL_QUOTA_GUARD=false
PROVIDER_DRY_RUN=false
ENABLE_REAL_PROVIDER_CALL=false
```

执行：

1. 生成 mock/fallback 任务。
2. 从 batch-detail 尝试审核通过。
3. 从 result 页点击通过结果。

预期：

- batch-detail 拦截 mock/fallback 审核通过。
- result 页 toast：`测试图不可审核通过`。
- console 出现 `[result:delivery-approve:block-mock-fallback]`。
- 不写 approved。
- 不同步 approved。
- 不写 approve audit。

## 7. 最小入口脚本

### 当前开关状态总览

```js
Promise.all([
  wx.cloud.callFunction({ name: 'ai_generate', data: { action: 'debugConfig' } }),
  wx.cloud.callFunction({ name: 'quota_guard', data: { action: 'debugConfig' } })
]).then(function(list) {
  var ai = (list[0].result && list[0].result.data) || {};
  var quota = (list[1].result && list[1].result.data) || {};
  console.log('[manual:p20:env-overview]', JSON.stringify({
    aiSwitchMatrixMode: ai.switchMatrixMode,
    aiSwitchMatrixAllowed: ai.switchMatrixAllowed,
    aiBlockers: ai.switchMatrixBlockers,
    quotaEnableRealQuotaGuard: quota.enableRealQuotaGuard,
    quotaFinalizeImplemented: quota.finalizeImplemented,
    quotaSupportedActions: quota.supportedActions
  }, null, 2));
}).catch(console.error);
```

### 阶段完成记录

```js
(function(stageName, passed, manualNotes) {
  console.log('[manual:p20:stage-checkpoint]', JSON.stringify({
    stageName: stageName,
    passed: !!passed,
    manualNotes: manualNotes || ''
  }, null, 2));
})('阶段 A 默认 mock 安全基线', false, '填写实测摘要，不粘贴敏感日志');
```

## 8. 执行结果记录模板

| 阶段 | 环境变量组合 | 执行脚本 | 预期结果 | 实际结果 | 是否通过 | 备注 | 截图/日志编号 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| A 默认 mock 安全基线 | `false / false / false` | ai/quota debugConfig + mock consume | mock 安全，不写真实 usage，不请求 provider | 待填写 | 待填写 |  |  |
| B quota real Alpha only | `true / false / false` | P17/P14 quota consume/rollback | consume 幂等，rollback 正确 | 待填写 | 待填写 |  |  |
| C finalize 终态验证 | `true / false / false` | P19 finalize smoke | finalized 不可 rollback | 待填写 | 待填写 |  |  |
| D provider dryRun + quota | `true / true / false` | P17/P18 dryRun smoke | dryRun 依赖 consumed record，不请求 endpoint | 待填写 | 待填写 |  |  |
| E 禁止组合检查 | D/E/F 禁止组合 | P18 matrix/preflight | 禁止组合 blocked | 待填写 | 待填写 |  |  |
| F 审核红线复验 | `false / false / false` | result/batch-detail smoke | mock/fallback 不可 approved | 待填写 | 待填写 |  |  |

## 9. 停止条件

任一情况出现必须停止，不进入下一阶段：

- 真实 provider 被请求。
- endpoint / API key / 图片 URL 出现在 console。
- quota 第二次 consume `recordId` 不一致。
- finalized 后 rollback 改变 usage。
- dryRun 缺 `quotaRecordId` 却成功。
- 禁止组合未 blocked。
- mock/fallback 可审核通过。


## P20 D 补充：ai_generate action=generate dryRun

P20 D 阶段调用 `ai_generate` 时，生成主流程支持 `action: 'generate'`。该入口等价进入通用生成流程，用于验证 provider dryRun + quotaRecordId 契约。

环境变量组合：

```text
ENABLE_REAL_QUOTA_GUARD=true
PROVIDER_DRY_RUN=true
ENABLE_REAL_PROVIDER_CALL=false
```

调用要求：

- 必须传 `quotaRecordId`。
- 必须传 `quotaRecordStatus: 'consumed'`。
- 必须传 `idempotencyKey`。
- 必须传 `costActionType`。
- 不请求真实 provider endpoint。
- 不生成真实图片。
- 不返回 endpoint/API key 原文。

预期：

- `success=true`
- `ok=true`
- `providerDryRun=true`
- `switchMatrixMode=C_PROVIDER_DRY_RUN_WITH_REAL_QUOTA`
- `switchMatrixAllowed=true`
- `quotaRecordStatus=consumed`
- `hasResultImage=false`
- `data.providerDryRunResult` 存在

如果缺少 `quotaRecordId` 或 `quotaRecordStatus` 不是 `consumed`，预期返回 `REAL_QUOTA_GUARD_REQUIRED` 或等价 quota preflight 错误，不得 fallback 成 mock success。

## P20 DevTools real Alpha 实机结果收尾

本次微信开发者工具 real Alpha smoke 已通过：

- A 默认 mock 安全态通过。
- B quota_guard real consume / idempotency / rollback / repeated rollback 通过。
- C finalizeUsage / finalized 后禁止 rollback 通过。
- D ai_generate provider dryRun + quotaRecordId 联动通过。
- E 危险开关组合拦截通过。
- Restore 已恢复安全默认环境变量。

本轮实测中修复并验证的问题：

- 补充 `cloudfunctionRoot`，修复云函数上传失败。
- 创建 `membership_usage` / `membership_usage_records` 集合。
- 增强并修复 `usage_init_failed` 诊断与初始化。
- 定位 `transaction_failed` 的 `_id` payload 问题，并在 doc set payload 中移除 `_id`。
- `consumeAiPoints` 幂等通过。
- 修复 repeated rollback 返回结构，重复回滚返回已有 rollback record。
- 支持 `ai_generate` 的 `action='generate'` 进入通用生成主流程。
- provider dryRun + real quota 联动通过。
- E1/E2/E3 危险组合均被 switch matrix 拦截。

最终安全恢复状态：

```text
ai_generate:
ENABLE_REAL_QUOTA_GUARD=false
PROVIDER_DRY_RUN=false
ENABLE_REAL_PROVIDER_CALL=false

quota_guard:
ENABLE_REAL_QUOTA_GUARD=false
```

最终确认：当前仍未开启真实 provider，未调用真实 API，dryRun 不生成真实图片。
