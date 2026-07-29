# P14 quota_guard real Alpha 实机 smoke

## 前置条件

- 仅在开发环境执行。
- 设置云函数环境变量：`ENABLE_REAL_QUOTA_GUARD=true`。
- 不设置 `ENABLE_REAL_PROVIDER_CALL=true`。
- 不调用 `ai_generate` real provider。
- 执行前记录当前 openid 和 period。
- 执行后可在 `membership_usage` / `membership_usage_records` 集合检查数据。

## 验收目标

1. `debugConfig` 能正确显示 real mode。
2. `getUsageSummary` 能创建/读取 `membership_usage`。
3. `checkAiPoints` 不扣点，只返回 `checked`。
4. `consumeAiPoints` 能真实写 `membership_usage_records`，并增加 `monthlyAiPointsUsed`。
5. 同一个 `idempotencyKey` 重试不重复扣点。
6. 缺 `idempotencyKey` 返回 `missing_idempotency_key`。
7. `rollbackUsage` 能写 rollback 流水并回退 used。
8. unknown `actionType` fail-closed。
9. `insufficient_quota` 能结构化返回。
10. 不影响 `ENABLE_REAL_QUOTA_GUARD=false` 的 mock 链路。

## 脚本 1：debugConfig

```js
wx.cloud.callFunction({
  name: 'quota_guard',
  data: { action: 'debugConfig' }
}).then(function(res) {
  console.log('[manual:p14:debug-config]', JSON.stringify({
    success: res.result && res.result.success,
    ok: res.result && res.result.ok,
    enableRealQuotaGuard: res.result && res.result.data && res.result.data.enableRealQuotaGuard,
    realModeImplemented: res.result && res.result.data && res.result.data.realModeImplemented,
    collections: res.result && res.result.data && res.result.data.collections,
    idempotencyRequiredForConsume: res.result && res.result.data && res.result.data.idempotencyRequiredForConsume
  }, null, 2));
}).catch(console.error);
```

预期：
- `enableRealQuotaGuard=true`
- `realModeImplemented=true`
- `collections.usage=membership_usage`
- `collections.records=membership_usage_records`

### raw debug

用于确认字段在顶层和 `data` 下的真实结构：

```js
wx.cloud.callFunction({
  name: 'quota_guard',
  data: { action: 'debugConfig' }
}).then(function(res) {
  console.log('[manual:p14:debug-config:raw]', JSON.stringify(res.result, null, 2));
}).catch(console.error);
```

## 脚本 2：getUsageSummary

```js
wx.cloud.callFunction({
  name: 'quota_guard',
  data: { action: 'getUsageSummary' }
}).then(function(res) {
  console.log('[manual:p14:get-usage]', JSON.stringify({
    ok: res.result && res.result.ok,
    reason: res.result && res.result.reason,
    usage: res.result && res.result.data && res.result.data.usage && {
      openid: res.result.data.usage.openid,
      period: res.result.data.usage.period,
      membershipTier: res.result.data.usage.membershipTier,
      monthlyAiPoints: res.result.data.usage.monthlyAiPoints,
      monthlyAiPointsUsed: res.result.data.usage.monthlyAiPointsUsed
    }
  }, null, 2));
}).catch(console.error);
```

预期：
- `ok=true`
- `usage` 存在
- `monthlyAiPointsUsed` 为数字

## 脚本 3：checkAiPoints 不扣点

```js
wx.cloud.callFunction({
  name: 'quota_guard',
  data: {
    action: 'checkAiPoints',
    actionType: 'fabric_replace'
  }
}).then(function(res) {
  console.log('[manual:p14:check-ai]', JSON.stringify({
    ok: res.result && res.result.ok,
    reason: res.result && res.result.reason,
    record: res.result && res.result.data && res.result.data.record && {
      actionType: res.result.data.record.actionType,
      costValue: res.result.data.record.costValue,
      status: res.result.data.record.status,
      beforeValue: res.result.data.record.beforeValue,
      afterValue: res.result.data.record.afterValue
    },
    usageUsed: res.result && res.result.data && res.result.data.usage && res.result.data.usage.monthlyAiPointsUsed
  }, null, 2));
}).catch(console.error);
```

预期：
- `ok=true`
- `costValue=2`
- `status=checked`
- `monthlyAiPointsUsed` 不增加

## 脚本 4：consumeAiPoints 幂等

```js
var key = 'manual_p14_fabric_' + Date.now();
var firstRecordId = '';

wx.cloud.callFunction({
  name: 'quota_guard',
  data: {
    action: 'consumeAiPoints',
    actionType: 'fabric_replace',
    sourceTaskId: 'manual_p14_' + Date.now(),
    idempotencyKey: key
  }
}).then(function(first) {
  firstRecordId = first.result && first.result.data && first.result.data.record && first.result.data.record.recordId;
  console.log('[manual:p14:consume:first]', JSON.stringify({
    ok: first.result && first.result.ok,
    reason: first.result && first.result.reason,
    recordId: firstRecordId,
    status: first.result && first.result.data && first.result.data.record && first.result.data.record.status,
    costValue: first.result && first.result.data && first.result.data.record && first.result.data.record.costValue,
    beforeValue: first.result && first.result.data && first.result.data.record && first.result.data.record.beforeValue,
    afterValue: first.result && first.result.data && first.result.data.record && first.result.data.record.afterValue
  }, null, 2));

  return wx.cloud.callFunction({
    name: 'quota_guard',
    data: {
      action: 'consumeAiPoints',
      actionType: 'fabric_replace',
      sourceTaskId: 'manual_p14_retry',
      idempotencyKey: key
    }
  });
}).then(function(second) {
  var secondRecordId = second.result && second.result.data && second.result.data.record && second.result.data.record.recordId;
  console.log('[manual:p14:consume:second-idempotent]', JSON.stringify({
    ok: second.result && second.result.ok,
    reason: second.result && second.result.reason,
    recordId: secondRecordId,
    sameRecordId: secondRecordId === firstRecordId,
    status: second.result && second.result.data && second.result.data.record && second.result.data.record.status,
    costValue: second.result && second.result.data && second.result.data.record && second.result.data.record.costValue,
    beforeValue: second.result && second.result.data && second.result.data.record && second.result.data.record.beforeValue,
    afterValue: second.result && second.result.data && second.result.data.record && second.result.data.record.afterValue
  }, null, 2));
}).catch(console.error);
```

预期：
- 第一次 `ok=true`，`status=consumed`，`costValue=2`
- 第二次 `ok=true`，返回的 `recordId` 必须等于第一次 `recordId`
- 第二次不重复增加 `monthlyAiPointsUsed`

## 脚本 5：缺 idempotencyKey

```js
wx.cloud.callFunction({
  name: 'quota_guard',
  data: {
    action: 'consumeAiPoints',
    actionType: 'fabric_replace',
    sourceTaskId: 'manual_p14_missing_key_' + Date.now()
  }
}).then(function(res) {
  console.log('[manual:p14:missing-idempotency]', JSON.stringify({
    ok: res.result && res.result.ok,
    reason: res.result && res.result.reason,
    reasonText: res.result && res.result.reasonText
  }, null, 2));
}).catch(console.error);
```

预期：
- `ok=false`
- `reason=missing_idempotency_key`

## 脚本 6：unknown actionType

```js
wx.cloud.callFunction({
  name: 'quota_guard',
  data: {
    action: 'checkAiPoints',
    actionType: 'unknown_action_for_p14'
  }
}).then(function(res) {
  console.log('[manual:p14:unknown-action]', JSON.stringify({
    ok: res.result && res.result.ok,
    reason: res.result && res.result.reason,
    reasonText: res.result && res.result.reasonText
  }, null, 2));
}).catch(console.error);
```

预期：
- `ok=false`
- `reason=unknown_action_type`

## 脚本 7：rollbackUsage

```js
var rollbackKey = 'manual_p14_rollback_' + Date.now();

wx.cloud.callFunction({
  name: 'quota_guard',
  data: {
    action: 'consumeAiPoints',
    actionType: 'fabric_replace',
    sourceTaskId: 'manual_p14_rollback_' + Date.now(),
    idempotencyKey: rollbackKey
  }
}).then(function(consumeRes) {
  var record = consumeRes.result && consumeRes.result.data && consumeRes.result.data.record;
  console.log('[manual:p14:rollback:consume]', JSON.stringify({
    ok: consumeRes.result && consumeRes.result.ok,
    recordId: record && record.recordId,
    status: record && record.status,
    costValue: record && record.costValue,
    beforeValue: record && record.beforeValue,
    afterValue: record && record.afterValue
  }, null, 2));

  return wx.cloud.callFunction({
    name: 'quota_guard',
    data: {
      action: 'rollbackUsage',
      recordId: record && record.recordId,
      statusReason: 'manual_p14_rollback_test'
    }
  });
}).then(function(rollbackRes) {
  var record = rollbackRes.result && rollbackRes.result.data && rollbackRes.result.data.record;
  console.log('[manual:p14:rollback:result]', JSON.stringify({
    ok: rollbackRes.result && rollbackRes.result.ok,
    reason: rollbackRes.result && rollbackRes.result.reason,
    rollbackRecordId: record && record.recordId,
    status: record && record.status,
    rollbackOfRecordId: record && record.rollbackOfRecordId,
    beforeValue: record && record.beforeValue,
    afterValue: record && record.afterValue
  }, null, 2));
}).catch(console.error);
```

预期：
- consume `ok=true`
- rollback `ok=true`
- rollback record `status=rolled_back`
- `rollbackOfRecordId` 指向原 `recordId`
- `monthlyAiPointsUsed` 回退

## 脚本 8：insufficient_quota 受控验收

该脚本只在受控开发数据中执行：先将当前 openid/period 的 `membership_usage.monthlyAiPointsUsed` 调整到接近 `monthlyAiPoints`，再执行高成本或普通扣点动作。不要在生产用户数据上执行。

```js
wx.cloud.callFunction({
  name: 'quota_guard',
  data: {
    action: 'consumeAiPoints',
    actionType: 'runway_video_10s',
    sourceTaskId: 'manual_p14_insufficient_' + Date.now(),
    idempotencyKey: 'manual_p14_insufficient_' + Date.now()
  }
}).then(function(res) {
  console.log('[manual:p14:insufficient-quota]', JSON.stringify({
    ok: res.result && res.result.ok,
    reason: res.result && res.result.reason,
    reasonText: res.result && res.result.reasonText,
    costValue: res.result && res.result.data && res.result.data.costValue
  }, null, 2));
}).catch(console.error);
```

预期：
- `ok=false`
- `reason=insufficient_quota`
- 不写入 `consumed` 流水

## 脚本 9：mock 链路不受影响

将云函数环境变量 `ENABLE_REAL_QUOTA_GUARD` 关闭或设置为非 `true` 后执行：

```js
wx.cloud.callFunction({
  name: 'quota_guard',
  data: {
    action: 'consumeAiPoints',
    actionType: 'fabric_replace',
    sourceTaskId: 'manual_p14_mock_' + Date.now(),
    idempotencyKey: 'manual_p14_mock_' + Date.now()
  }
}).then(function(res) {
  console.log('[manual:p14:mock-unaffected]', JSON.stringify({
    ok: res.result && res.result.ok,
    mock: res.result && res.result.mock,
    status: res.result && res.result.data && res.result.data.record && res.result.data.record.status,
    costValue: res.result && res.result.data && res.result.data.record && res.result.data.record.costValue
  }, null, 2));
}).catch(console.error);
```

预期：
- mock 链路保持原行为
- 不写真实数据库
- 不调用真实 provider

## 结果记录模板

| 项目 | 预期 | 实测 | 是否通过 |
| --- | --- | --- | --- |
| debugConfig | `enableRealQuotaGuard=true` |  |  |
| getUsageSummary | usage 存在 |  |  |
| checkAiPoints | checked 不扣点 |  |  |
| consume 幂等 | 不重复扣点 |  |  |
| 缺 idempotencyKey | `missing_idempotency_key` |  |  |
| unknown action | `unknown_action_type` |  |  |
| rollback | `rolled_back` |  |  |
| insufficient_quota | `insufficient_quota` |  |  |
| mock 链路 | 原 mock 行为不受影响 |  |  |

## 边界

- 本 smoke 不调用 `ai_generate` real provider。
- 本 smoke 不要求设置 `ENABLE_REAL_PROVIDER_CALL=true`。
- 本 smoke 不改 quota 成本数值。
- `ENABLE_REAL_QUOTA_GUARD=false` 时 mock 链路应保持原行为。

## P14 实机执行记录

| 字段 | 记录 |
| --- | --- |
| 执行日期 | 待填写 |
| 执行环境 | 微信开发者工具 / 开发环境，待填写 |
| 云函数环境变量 | `ENABLE_REAL_QUOTA_GUARD=true`，`ENABLE_REAL_PROVIDER_CALL` 未开启 |
| openid 是否获取成功 | 待填写 |
| period | 待填写 |
| `membership_usage` 是否创建/读取 | 待填写 |
| `membership_usage_records` 是否写入 | 待填写 |
| 是否调用真实 provider | 否 |
| 是否开启 `ENABLE_REAL_PROVIDER_CALL` | 否 |

## DevTools 实机执行顺序

1. 先部署 `quota_guard` 云函数。
2. 设置 `ENABLE_REAL_QUOTA_GUARD=true`。
3. 重新上传并部署 `quota_guard`。
4. 执行 `debugConfig`。
5. 执行 `getUsageSummary`。
6. 执行 `checkAiPoints`。
7. 执行 consume 幂等。
8. 执行 missing `idempotencyKey`。
9. 执行 unknown `actionType`。
10. 执行 `rollbackUsage`。
11. 设置 `ENABLE_REAL_QUOTA_GUARD=false`。
12. 复验 mock 链路不受影响。

## 实机结果表

| 项目 | 预期 | 实测 | 是否通过 | 备注 |
| --- | --- | --- | --- | --- |
| debugConfig | `enableRealQuotaGuard=true` | 待填写 | 待填写 |  |
| getUsageSummary | usage 存在 | 待填写 | 待填写 |  |
| checkAiPoints | checked 不扣点 | 待填写 | 待填写 |  |
| consume 首次 | `status=consumed` | 待填写 | 待填写 |  |
| consume 幂等重试 | 不重复扣点 | 待填写 | 待填写 |  |
| 缺 idempotencyKey | `missing_idempotency_key` | 待填写 | 待填写 |  |
| unknown actionType | `unknown_action_type` | 待填写 | 待填写 |  |
| rollbackUsage | `status=rolled_back` | 待填写 | 待填写 |  |
| mock 链路 | `ENABLE_REAL_QUOTA_GUARD=false` 时不受影响 | 待填写 | 待填写 |  |

## 实机安全提醒

- 本轮只允许调用 `quota_guard`。
- 不调用 `ai_generate` real provider。
- 不设置 `ENABLE_REAL_PROVIDER_CALL=true`。
- 不请求真实万相 endpoint。
- 不打印 `idempotencyKey` 原文。
- 不打印用户敏感信息。
## usage_init_failed 诊断补充

当 `ENABLE_REAL_QUOTA_GUARD=true` 且 `getUsageSummary` 返回 `usage_init_failed` 时，先确认返回体和云函数日志中的脱敏诊断字段。

### 返回字段

失败返回会在顶层和 `data` 中包含：

- `stage`：失败阶段，例如 `get_wx_context`、`read_usage_doc`、`create_usage_doc`。
- `hasOpenid`：是否拿到 openid，只显示布尔值，不显示 openid 原文。
- `collectionName`：固定为 `membership_usage`。
- `errCode`：云数据库错误码。
- `errorMessage`：截断后的错误信息，最多 300 字符。

### 云函数日志筛选

在微信开发者工具或云开发控制台筛选 `quota_guard` 日志，重点查看：

```text
[quota_guard:usage-init] failed
```

该日志只打印 `action`、`stage`、`hasOpenid`、`collectionName`、`errCode`、`errMessage`。不会打印 openid 原文、完整 stack、token、API key、图片 URL 或 prompt。

### 集合检查

确认云数据库中已存在集合：

- `membership_usage`
- `membership_usage_records`

如果集合已存在但仍失败，重点看 `errCode` / `errorMessage` 是否指向权限、集合名、文档写入方式或环境未选择。

### 常见错误码

| errorCode | 含义 | 建议处理 |
| --- | --- | --- |
| `missing_openid` | 云函数未拿到 openid | 检查调用环境和云环境选择 |
| `usage_collection_missing` | `membership_usage` 集合不存在或不可访问 | 创建集合并重新部署云函数 |
| `usage_permission_denied` | 云数据库权限不足 | 检查云函数端数据库权限和环境 |
| `usage_init_failed` | 其他初始化失败 | 查看 `stage`、`errCode`、`errorMessage` 定位 |

### raw diagnostic 脚本

```js
wx.cloud.callFunction({
  name: 'quota_guard',
  data: { action: 'getUsageSummary' }
}).then(function(res) {
  var result = res.result || {};
  var data = result.data || {};
  console.log('[manual:p14:usage-init-diagnostic]', JSON.stringify({
    success: result.success,
    ok: result.ok,
    errorCode: result.errorCode,
    reason: result.reason,
    stage: result.stage || data.stage,
    hasOpenid: result.hasOpenid || data.hasOpenid,
    collectionName: result.collectionName || data.collectionName,
    errCode: result.errCode || data.errCode,
    errorMessage: result.errorMessage || data.errorMessage
  }, null, 2));
}).catch(console.error);
```

预期：如果初始化失败，可看到脱敏后的 `stage`、`errCode`、`errorMessage`；如果成功，则 `ok=true` 且返回 `usage`。

## transaction_failed 诊断补充

当 `ENABLE_REAL_QUOTA_GUARD=true` 且 `consumeAiPoints` 返回 `transaction_failed` 时，说明 usage 已初始化，但真实扣点事务阶段失败。失败返回会在顶层和 `data` 中包含脱敏诊断字段：

- `stage`：失败阶段。
- `collectionName`：失败阶段涉及的集合。
- `hasUsageId`：是否已构造 usage 文档 ID，只显示布尔值。
- `hasIdempotencyKey`：是否传入幂等键，只显示布尔值。
- `errCode`：云数据库错误码。
- `errorMessage`：截断后的错误信息，最多 300 字符。

云函数日志筛选：

```text
[quota_guard:consume-transaction] failed
```

该日志只打印 `action`、`stage`、`collectionName`、`hasUsageId`、`hasIdempotencyKey`、`errCode`、`errMessage`。不会打印 openid、idempotencyKey 原文、完整 usage 文档、完整 stack、token、API key、图片 URL 或 prompt。

### stage 说明

| stage | 含义 |
| --- | --- |
| `before_transaction_check_record_by_id` | 事务前按稳定 doc id 检查记录 |
| `before_transaction_check_record_by_idempotency_key` | 事务前按幂等键检查记录 |
| `transaction_start` | 启动事务 |
| `transaction_read_usage` | 事务内读取 usage |
| `transaction_check_existing_record` | 事务内检查重复记录 |
| `transaction_update_usage` | 事务内更新 usage |
| `transaction_create_record` | 事务内写入 records |
| `transaction_commit` | 事务提交 |

### 常见错误码

| errorCode | 含义 | 建议处理 |
| --- | --- | --- |
| `transaction_failed` | 事务执行失败 | 查看 `stage` / `errCode` / `errorMessage` |
| `transaction_not_supported` | 当前云开发 SDK 不支持 `db.runTransaction` | 不要降级普通扣费，升级运行时或调整云函数环境 |
| `usage_update_failed` | usage 更新失败 | 检查 `membership_usage` 写权限和事务 API |
| `usage_record_create_failed` | records 写入失败 | 检查 `membership_usage_records` 写权限和 doc id |
| `idempotency_record_check_failed` | 幂等记录检查失败 | 检查 records 查询能力和索引 |

### `-501007` invalid parameters

如果 `transaction_create_record` 阶段返回：

```text
document.set:fail -501007 invalid parameters. 不能更新_id的值
```

说明代码使用了 `doc(recordId).set({ data })` 或 `doc(id).update({ data })`，但 `data` 中仍包含 `_id` 字段。微信云数据库不允许在指定 doc id 的 set/update payload 中更新 `_id`。

修复原则：

- `recordId` 继续作为稳定 doc id 使用，保证幂等。
- 写入 `membership_usage_records` 前删除 payload 内的 `_id`。
- 返回给调用方的 record 仍可保留 `recordId`，用于 smoke 和审计。
- 不要改成 `collection.add()` 随机 id，否则会破坏幂等。

### consume transaction debug 脚本

```js
var idem = 'manual_tx_debug_' + Date.now();

wx.cloud.callFunction({
  name: 'quota_guard',
  data: {
    action: 'consumeAiPoints',
    actionType: 'fabric_replace',
    sourceTaskId: 'manual_tx_debug_' + Date.now(),
    idempotencyKey: idem
  }
}).then(function(res) {
  var result = res.result || {};
  var data = result.data || {};
  console.log('[manual:p14:consume-transaction-diagnostic]', JSON.stringify({
    success: result.success,
    ok: result.ok,
    errorCode: result.errorCode,
    reason: result.reason,
    stage: result.stage || data.stage,
    collectionName: result.collectionName || data.collectionName,
    hasUsageId: result.hasUsageId || data.hasUsageId,
    hasIdempotencyKey: result.hasIdempotencyKey || data.hasIdempotencyKey,
    errCode: result.errCode || data.errCode,
    errorMessage: result.errorMessage || data.errorMessage,
    record: data.record && {
      recordId: data.record.recordId,
      status: data.record.status,
      costValue: data.record.costValue,
      beforeValue: data.record.beforeValue,
      afterValue: data.record.afterValue
    }
  }, null, 2));
}).catch(console.error);
```

预期：成功时 `ok=true`、`record.status=consumed`；失败时看到脱敏后的 `stage`、`errCode`、`errorMessage`。

## P17 quota_guard real Alpha + provider dryRun 联动 smoke

本节只验证 quota_guard real Alpha 与 provider dryRun 的联动边界，不调用真实 provider，不设置 `ENABLE_REAL_PROVIDER_CALL=true`。

### P17 前置条件

- 开发环境执行。
- quota real Alpha 场景临时设置 `ENABLE_REAL_QUOTA_GUARD=true`。
- provider dryRun 场景设置 `PROVIDER_DRY_RUN=true` 或在调用参数中传 `dryRun: true`。
- 不设置 `ENABLE_REAL_PROVIDER_CALL=true`。
- 不请求真实 provider endpoint。
- 不打印 idempotencyKey 原文、图片 URL、fileID、localPath、endpoint、API key。

### 通用脱敏工具

```js
function maskId(value) {
  var text = String(value || '');
  if (!text) return '';
  if (text.length <= 14) return text.slice(0, 4) + '***';
  return text.slice(0, 8) + '***' + text.slice(-6);
}
```

### 1. quota debugConfig raw

```js
wx.cloud.callFunction({
  name: 'quota_guard',
  data: { action: 'debugConfig' }
}).then(function(res) {
  var result = res.result || {};
  var data = result.data || {};
  console.log('[manual:p17:quota-debug-config:raw]', JSON.stringify({
    success: result.success,
    ok: result.ok,
    topLevel: {
      enableRealQuotaGuard: result.enableRealQuotaGuard,
      realModeImplemented: result.realModeImplemented,
      idempotencyRequiredForConsume: result.idempotencyRequiredForConsume,
      collections: result.collections
    },
    data: {
      enableRealQuotaGuard: data.enableRealQuotaGuard,
      realModeImplemented: data.realModeImplemented,
      idempotencyRequiredForConsume: data.idempotencyRequiredForConsume,
      collections: data.collections,
      supportedActions: data.supportedActions,
      costSource: data.costSource
    }
  }, null, 2));
}).catch(console.error);
```

预期：
- `enableRealQuotaGuard` 能明确显示当前模式。
- `realModeImplemented=true`。
- `collections.usage=membership_usage`。
- `collections.records=membership_usage_records`。

### 2. mock 模式 consume smoke

前置：`ENABLE_REAL_QUOTA_GUARD=false` 或未设置。

```js
wx.cloud.callFunction({
  name: 'quota_guard',
  data: {
    action: 'consumeAiPoints',
    actionType: 'fabric_replace',
    sourceTaskId: 'manual_p17_mock_' + Date.now(),
    idempotencyKey: 'manual_p17_mock_' + Date.now()
  }
}).then(function(res) {
  var result = res.result || {};
  var record = result.data && result.data.record || {};
  console.log('[manual:p17:quota-mock-consume]', JSON.stringify({
    ok: result.ok,
    mock: result.mock,
    status: record.status,
    costValue: record.costValue,
    hasRecordId: !!record.recordId
  }, null, 2));
}).catch(console.error);
```

预期：
- 仍走 mock/intent 兼容链路。
- 不写真实 `membership_usage` / `membership_usage_records`。

### 3. real Alpha consume 幂等 smoke

前置：临时设置 `ENABLE_REAL_QUOTA_GUARD=true` 并重新部署 `quota_guard`。

```js
(function () {
  var key = 'manual_p17_quota_idem_' + Date.now();
  var firstRecordId = '';
  var firstAfterValue = null;

  wx.cloud.callFunction({
    name: 'quota_guard',
    data: {
      action: 'consumeAiPoints',
      actionType: 'fabric_replace',
      sourceTaskId: 'manual_p17_quota_' + Date.now(),
      idempotencyKey: key
    }
  }).then(function(first) {
    var result = first.result || {};
    var record = result.data && result.data.record || {};
    firstRecordId = record.recordId || '';
    firstAfterValue = record.afterValue;
    console.log('[manual:p17:quota-consume:first]', JSON.stringify({
      ok: result.ok,
      reason: result.reason,
      recordId: maskId(firstRecordId),
      status: record.status,
      costValue: record.costValue,
      beforeValue: record.beforeValue,
      afterValue: record.afterValue
    }, null, 2));

    return wx.cloud.callFunction({
      name: 'quota_guard',
      data: {
        action: 'consumeAiPoints',
        actionType: 'fabric_replace',
        sourceTaskId: 'manual_p17_quota_retry',
        idempotencyKey: key
      }
    });
  }).then(function(second) {
    var result = second.result || {};
    var record = result.data && result.data.record || {};
    var secondRecordId = record.recordId || '';
    console.log('[manual:p17:quota-consume:second]', JSON.stringify({
      ok: result.ok,
      reason: result.reason,
      recordId: maskId(secondRecordId),
      status: record.status,
      costValue: record.costValue,
      beforeValue: record.beforeValue,
      afterValue: record.afterValue
    }, null, 2));
    console.log('[manual:p17:quota-consume:idempotency-check]', JSON.stringify({
      sameRecordId: secondRecordId === firstRecordId,
      sameAfterValue: record.afterValue === firstAfterValue,
      firstRecordId: maskId(firstRecordId),
      secondRecordId: maskId(secondRecordId)
    }, null, 2));
  }).catch(console.error);
})();
```

预期：
- 两次 `ok=true`。
- 两次 `status=consumed`。
- 第二次 `recordId` 等于第一次 `recordId`。
- 第二次不重复扣点，`afterValue` 一致。

### 4. rollback smoke

```js
(function () {
  var key = 'manual_p17_rollback_' + Date.now();
  var consumedRecordId = '';
  var rollbackRecordId = '';

  wx.cloud.callFunction({
    name: 'quota_guard',
    data: {
      action: 'consumeAiPoints',
      actionType: 'fabric_replace',
      sourceTaskId: 'manual_p17_rollback_' + Date.now(),
      idempotencyKey: key
    }
  }).then(function(consumeRes) {
    var record = consumeRes.result && consumeRes.result.data && consumeRes.result.data.record || {};
    consumedRecordId = record.recordId || '';
    return wx.cloud.callFunction({
      name: 'quota_guard',
      data: {
        action: 'rollbackUsage',
        recordId: consumedRecordId,
        statusReason: 'manual_p17_rollback'
      }
    });
  }).then(function(rollbackRes) {
    var result = rollbackRes.result || {};
    var record = result.data && result.data.record || {};
    rollbackRecordId = record.recordId || '';
    console.log('[manual:p17:quota-rollback]', JSON.stringify({
      ok: result.ok,
      reason: result.reason,
      rollbackRecordId: maskId(rollbackRecordId),
      status: record.status,
      rollbackOfRecordId: maskId(record.rollbackOfRecordId),
      rollbackMatchesConsume: record.rollbackOfRecordId === consumedRecordId,
      costValue: record.costValue,
      beforeValue: record.beforeValue,
      afterValue: record.afterValue,
      beforeAfterLooksReal: Number(record.beforeValue) !== Number(record.afterValue)
    }, null, 2));

    return wx.cloud.callFunction({
      name: 'quota_guard',
      data: {
        action: 'rollbackUsage',
        recordId: consumedRecordId,
        statusReason: 'manual_p17_rollback_retry'
      }
    });
  }).then(function(secondRollbackRes) {
    var result = secondRollbackRes.result || {};
    var record = result.data && result.data.record || {};
    console.log('[manual:p17:quota-rollback:idempotency-check]', JSON.stringify({
      ok: result.ok,
      reason: result.reason,
      status: record.status,
      rollbackRecordId: maskId(record.recordId),
      rollbackOfRecordId: maskId(record.rollbackOfRecordId),
      sameRollbackRecord: !record.recordId || record.recordId === rollbackRecordId
    }, null, 2));
  }).catch(console.error);
})();
```

预期：
- rollback 成功。
- rollback record 包含 `rollbackOfRecordId`。
- `rollbackOfRecordId === consumedRecordId`。
- 正常真实回滚时 `beforeValue / afterValue` 不应是无意义的 `0 -> 0`。
- 重复 rollback 不得重复加点；可以返回已有 rollback record，或明确 rejected/duplicate。

### 5. finalize smoke

当前 `quota_guard` 暂未实现 `finalizeUsage`，P17 不阻塞。真实 provider 上线前必须补齐：
- consumed record -> finalized 终态。
- finalized 后 rollback 应被拒绝，或返回不可 rollback 的结构化原因。

```js
console.log('[manual:p17:quota-finalize]', {
  implemented: false,
  status: 'pending_before_real_provider_launch'
});
```

### P17 quota 日志安全 checklist

允许输出：
- boolean、count、length
- 脱敏后的 taskId / recordId
- providerTaskType、costActionType
- providerDryRun、enableRealQuotaGuard
- status、errorCode、fallbackReason

禁止输出：
- full customPrompt
- fullAdvancedPromptSummary 全量
- positivePrompt / negativePrompt 全量
- sourceImageUrl / resultImageUrl
- fileID / localPath
- provider endpoint
- API key / Authorization header
- idempotencyKey 原文

### repeated rollback 预期

重复调用 `rollbackUsage` 时：

- 不重复返还额度。
- 不更新 `membership_usage`。
- 不创建新的 rollback record。
- 必须返回已有 rollback record。
- 顶层和 `data` 中应包含 `status=rolled_back`、`reason=already_rolled_back`、`rollbackRecordId`、`rollbackOfRecordId`。
- `rollbackOfRecordId` 必须指向原 consume recordId。
- 不应返回原 consumed record；如果原记录已标记 rolled_back 但找不到 rollback record，应返回 `rollback_record_missing`。

## P18 switch matrix reference

P18 switch matrix smoke links quota_guard real Alpha to provider dryRun without enabling real provider calls.

- B mode: `ENABLE_REAL_QUOTA_GUARD=true`, `PROVIDER_DRY_RUN=false`, `ENABLE_REAL_PROVIDER_CALL=false`; run quota consume, idempotency, rollback, and optional finalize checks only.
- C mode: `ENABLE_REAL_QUOTA_GUARD=true`, `PROVIDER_DRY_RUN=true`, `ENABLE_REAL_PROVIDER_CALL=false`; provider dryRun must require a consumed `quotaRecordId` and must not request endpoint.
- D/E/F are forbidden for device smoke and must be blocked or treated as local-contract-only checks.
- G mode is real provider gray release and is not part of P18 execution.

Use `docs/smoke/manual-smoke-miniapp.md` P18 scripts to inspect current switch mode. Do not print raw `idempotencyKey`, prompt, image URL, endpoint, API key, or Authorization.

## P19 finalizeUsage terminal state smoke

Purpose: before real provider gray release, verify quota records can enter `finalized`, and finalized records cannot rollback.

Safety:
- Do not enable `ENABLE_REAL_PROVIDER_CALL`.
- Do not call real provider endpoint.
- Do not print raw `idempotencyKey`, prompt, image URL, fileID, endpoint, API key, Authorization, or user-sensitive data.
- Use masked `recordId` only.

### DevTools async IIFE

```js
(async function () {
  function maskId(id) {
    id = String(id || '');
    if (!id) return '';
    if (id.length <= 14) return id.slice(0, 4) + '...' + id.slice(-3);
    return id.slice(0, 8) + '...' + id.slice(-6);
  }

  var debug = await wx.cloud.callFunction({
    name: 'quota_guard',
    data: { action: 'debugConfig' }
  });
  var debugData = (debug.result && debug.result.data) || {};
  console.log('[manual:p19:debug-config]', JSON.stringify({
    ok: !!(debug.result && debug.result.ok),
    enableRealQuotaGuard: debugData.enableRealQuotaGuard || debug.result.enableRealQuotaGuard,
    finalizeImplemented: debugData.finalizeImplemented || debug.result.finalizeImplemented,
    terminalStates: debugData.terminalStates || debug.result.terminalStates,
    rollbackForbiddenStatuses: debugData.rollbackForbiddenStatuses || debug.result.rollbackForbiddenStatuses,
    supportedActions: debugData.supportedActions || debug.result.supportedActions
  }, null, 2));

  var mockFinalize = await wx.cloud.callFunction({
    name: 'quota_guard',
    data: {
      action: 'finalizeUsage',
      recordId: 'mock_record_for_p19',
      reason: 'manual_mock_finalize'
    }
  });
  console.log('[manual:p19:finalize:mock]', JSON.stringify({
    ok: !!(mockFinalize.result && mockFinalize.result.ok),
    mock: !!(mockFinalize.result && mockFinalize.result.mock),
    status: mockFinalize.result && (mockFinalize.result.status || mockFinalize.result.data && mockFinalize.result.data.status)
  }, null, 2));

  var consumeKey = 'manual_p19_finalize_' + Date.now();
  var consume = await wx.cloud.callFunction({
    name: 'quota_guard',
    data: {
      action: 'consumeAiPoints',
      actionType: 'fabric_replace',
      sourceTaskId: 'manual_p19_finalize_' + Date.now(),
      idempotencyKey: consumeKey
    }
  });
  var consumedRecord = consume.result && consume.result.data && consume.result.data.record;
  console.log('[manual:p19:consume]', JSON.stringify({
    ok: !!(consume.result && consume.result.ok),
    recordId: maskId(consumedRecord && consumedRecord.recordId),
    status: consumedRecord && consumedRecord.status,
    beforeValue: consumedRecord && consumedRecord.beforeValue,
    afterValue: consumedRecord && consumedRecord.afterValue
  }, null, 2));

  var finalize = await wx.cloud.callFunction({
    name: 'quota_guard',
    data: {
      action: 'finalizeUsage',
      recordId: consumedRecord && consumedRecord.recordId,
      reason: 'provider_success'
    }
  });
  var finalizedRecord = finalize.result && finalize.result.data && finalize.result.data.record;
  console.log('[manual:p19:finalize:real]', JSON.stringify({
    ok: !!(finalize.result && finalize.result.ok),
    recordId: maskId(finalizedRecord && finalizedRecord.recordId),
    status: finalizedRecord && finalizedRecord.status,
    hasFinalizedAt: !!(finalizedRecord && finalizedRecord.finalizedAt),
    finalizeReason: finalizedRecord && finalizedRecord.finalizeReason
  }, null, 2));

  var finalizeAgain = await wx.cloud.callFunction({
    name: 'quota_guard',
    data: {
      action: 'finalizeUsage',
      recordId: consumedRecord && consumedRecord.recordId,
      reason: 'provider_success_retry'
    }
  });
  var finalizedAgainRecord = finalizeAgain.result && finalizeAgain.result.data && finalizeAgain.result.data.record;
  console.log('[manual:p19:finalize:idempotency]', JSON.stringify({
    ok: !!(finalizeAgain.result && finalizeAgain.result.ok),
    sameRecordId: (finalizedAgainRecord && finalizedAgainRecord.recordId) === (finalizedRecord && finalizedRecord.recordId),
    status: finalizedAgainRecord && finalizedAgainRecord.status,
    reason: finalizeAgain.result && finalizeAgain.result.reason
  }, null, 2));

  var rollbackAfterFinalize = await wx.cloud.callFunction({
    name: 'quota_guard',
    data: {
      action: 'rollbackUsage',
      recordId: consumedRecord && consumedRecord.recordId,
      statusReason: 'manual_p19_should_block'
    }
  });
  console.log('[manual:p19:rollback:after-finalize-blocked]', JSON.stringify({
    ok: !!(rollbackAfterFinalize.result && rollbackAfterFinalize.result.ok),
    errorCode: rollbackAfterFinalize.result && (rollbackAfterFinalize.result.errorCode || rollbackAfterFinalize.result.reason),
    reason: rollbackAfterFinalize.result && rollbackAfterFinalize.result.reason
  }, null, 2));

  var rollbackKey = 'manual_p19_rollback_' + Date.now();
  var consumeForRollback = await wx.cloud.callFunction({
    name: 'quota_guard',
    data: {
      action: 'consumeAiPoints',
      actionType: 'fabric_replace',
      sourceTaskId: 'manual_p19_rollback_' + Date.now(),
      idempotencyKey: rollbackKey
    }
  });
  var rollbackSource = consumeForRollback.result && consumeForRollback.result.data && consumeForRollback.result.data.record;
  var rollback = await wx.cloud.callFunction({
    name: 'quota_guard',
    data: {
      action: 'rollbackUsage',
      recordId: rollbackSource && rollbackSource.recordId,
      statusReason: 'manual_p19_rollback_before_finalize'
    }
  });
  var rollbackRecord = rollback.result && rollback.result.data && rollback.result.data.record;
  console.log('[manual:p19:rollback]', JSON.stringify({
    ok: !!(rollback.result && rollback.result.ok),
    rollbackRecordId: maskId(rollbackRecord && rollbackRecord.recordId),
    rollbackOfRecordId: maskId(rollbackRecord && rollbackRecord.rollbackOfRecordId),
    status: rollbackRecord && rollbackRecord.status,
    beforeValue: rollbackRecord && rollbackRecord.beforeValue,
    afterValue: rollbackRecord && rollbackRecord.afterValue
  }, null, 2));

  var finalizeAfterRollback = await wx.cloud.callFunction({
    name: 'quota_guard',
    data: {
      action: 'finalizeUsage',
      recordId: rollbackSource && rollbackSource.recordId,
      reason: 'manual_should_block_after_rollback'
    }
  });
  console.log('[manual:p19:finalize:after-rollback-blocked]', JSON.stringify({
    ok: !!(finalizeAfterRollback.result && finalizeAfterRollback.result.ok),
    errorCode: finalizeAfterRollback.result && (finalizeAfterRollback.result.errorCode || finalizeAfterRollback.result.reason),
    reason: finalizeAfterRollback.result && finalizeAfterRollback.result.reason
  }, null, 2));
})().catch(console.error);
```

Expected:

| Item | Expected |
| --- | --- |
| mock finalize | `mock=true`, `status=finalized_mock` when real quota guard is disabled |
| real consume -> finalize | consumed record becomes `status=finalized`, with `finalizedAt` and `finalizeReason` |
| repeat finalize | same `recordId`, no duplicate terminal write |
| rollback after finalized | `ok=false`, `errorCode=QUOTA_RECORD_FINALIZED` |
| finalize after rollback | `ok=false`, `errorCode=QUOTA_RECORD_ALREADY_ROLLED_BACK` or `QUOTA_RECORD_NOT_CONSUMABLE` |
## P20 实机执行顺序索引

完整开发环境 runbook：`docs/smoke/p20-devtools-real-alpha-runbook.md`。

本文件被 P20 引用的段落：

- P14 quota_guard real Alpha 实机 smoke：debugConfig、getUsageSummary、checkAiPoints、consume 幂等、missing idempotency、unknown action、rollback。
- P17 quota_guard real Alpha + provider dryRun 联动 smoke：quota debug、mock consume、real consume 幂等、rollback、provider dryRun quotaRecordId 契约。
- P19 finalizeUsage terminal state smoke：mock finalize、real consume -> finalize、重复 finalize、finalized 后 rollback blocked、rollback 后 finalize blocked。

执行 P20 时必须按阶段切换环境变量，且始终保持 `ENABLE_REAL_PROVIDER_CALL=false`，不得调用真实 provider endpoint。

## P20 quota_guard real Alpha 实机通过记录

P20 B/C 阶段已在微信开发者工具完成 real Alpha 手测：

- `getUsageSummary` 成功读取/创建 usage。
- `consumeAiPoints` 首次扣点成功。
- 相同 `idempotencyKey` 重试返回同一 consumed record，不重复扣点。
- `rollbackUsage` 首次回滚成功，`rollbackOfRecordId` 指向原 consume recordId。
- repeated rollback 不重复返还，返回已有 rollback record，`status=rolled_back`、`reason=already_rolled_back`。
- `finalizeUsage` 成功进入 finalized。
- finalized 后 rollback 返回 `QUOTA_RECORD_FINALIZED`。

本轮修复记录：

- `usage_init_failed` 增加 `stage`、`errCode`、`errorMessage` 脱敏诊断。
- `transaction_failed` 增加事务阶段诊断。
- `transaction_create_record` 阶段移除 doc set payload 中的 `_id`。
- repeated rollback 返回结构已统一。
- `consumeAiPoints` 成功返回兼容字段：顶层 `recordId` / `usageRecordId`，以及 `data.recordId` / `data.usageRecordId` / `data.usageRecordDocId`。

最终已恢复 `ENABLE_REAL_QUOTA_GUARD=false`，mock 链路保持可用。
