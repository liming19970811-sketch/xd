# 小程序手工 Smoke 验收

本清单用于每轮小程序改动后的最小手工验收。当前有两条不同链路：

- Upload MVP 直生成链路：`upload -> startGenerate -> ai_generate mock -> result`
- Batch-detail 批次链路：`project/batch-detail -> runBatch`

注意：当前 upload 页 `startGenerate` 是直达 result 页的单图生成链路，不会自动创建 `batchId`。因此在 upload/result 页执行 batch-detail 相关脚本得到 `batchId: undefined` 是正常现象，不应判定为上传或生成失败。

---

## 1. 首页场景入口

验收目标：
- 首页展示 6 个商家场景入口：
  - 电商主图
  - 小红书图
  - 跨境白底图
  - 新品上新图
  - 批量模特图
  - 爆款改款图
- 点击场景卡片进入 upload 页，并带 `entryScene`。

操作：
- 打开首页。
- 点击“电商主图”。

预期：

```text
/pages/upload/upload?entryScene=ecommerce_main
```

---

## 2. 首页 6 大入口 preset 验收

验收目标：
- 首页仍然只有 6 个商家场景入口，不新增分类。
- 6 个入口分别对应：
  - `ecommerce_main`
  - `xiaohongshu_seed`
  - `cross_border_white`
  - `new_arrival`
  - `batch_model`
  - `hot_style_remix`
- upload 页会根据 `entryScene` 写入 `draftTask.input.params`。
- 普通入口默认收起高级面板。
- `hot_style_remix` 默认展开高级面板，并打开 `pattern_adjustment`。

电商主图验收脚本：

```js
wx.redirectTo({
  url: '/pages/upload/upload?entryScene=ecommerce_main'
});

setTimeout(function () {
  var page = getCurrentPages().slice(-1)[0];
  var vm = page && (page.$vm || page);
  var params = (((vm || {}).chainState || {}).draftTask || {}).input &&
    vm.chainState.draftTask.input.params || {};

  console.log('[manual:preset:ecommerce_main]', {
    route: page && page.route,
    entryScene: vm && vm.entryScene,
    templateType: params.templateType,
    finalStyleCode: params.finalStyleCode,
    finalSceneCode: params.finalSceneCode,
    finalBodyType: params.finalBodyType,
    outputTypes: params.outputTypes,
    showAdvancedSettings: vm && vm.showAdvancedSettings,
    activeAdvancedPanel: vm && vm.activeAdvancedPanel
  });
}, 1000);
```

预期：
- `entryScene === 'ecommerce_main'`
- `templateType === 'ecommerce_main'`
- `finalStyleCode === 'simple_commute'`
- `finalSceneCode === 'white_studio'`
- `finalBodyType === 'standard'`
- `showAdvancedSettings === false`

爆款改款图验收脚本：

```js
wx.redirectTo({
  url: '/pages/upload/upload?entryScene=hot_style_remix'
});

setTimeout(function () {
  var page = getCurrentPages().slice(-1)[0];
  var vm = page && (page.$vm || page);
  var params = (((vm || {}).chainState || {}).draftTask || {}).input &&
    vm.chainState.draftTask.input.params || {};

  console.log('[manual:preset:hot_style_remix]', {
    route: page && page.route,
    entryScene: vm && vm.entryScene,
    templateType: params.templateType,
    finalStyleCode: params.finalStyleCode,
    finalSceneCode: params.finalSceneCode,
    finalBodyType: params.finalBodyType,
    outputTypes: params.outputTypes,
    showAdvancedSettings: vm && vm.showAdvancedSettings,
    activeAdvancedPanel: vm && vm.activeAdvancedPanel
  });
}, 1000);
```

预期：
- `entryScene === 'hot_style_remix'`
- `templateType === 'hot_style_remix'`
- `finalStyleCode === 'follow_original_style'`
- `finalSceneCode === 'follow_original_scene'`
- `finalBodyType === 'follow_original_body'`
- `showAdvancedSettings === true`
- `activeAdvancedPanel === 'pattern_adjustment'`

其他入口预期：
- `xiaohongshu_seed`、`cross_border_white`、`new_arrival`、`batch_model` 默认 `showAdvancedSettings === false`。
- `outputTypes` 应匹配对应入口的 preset。
- 不影响 `clothImage` 上传、`startGenerate` 和 Upload MVP 直生成链路。

---

## 3. Upload MVP 直生成链路

验收路径：

```text
upload -> startGenerate -> ai_generate mock -> result
```

验收目标：
- upload 页能识别 `entryScene`。
- 当前出图模板正确。
- `outputRatio` 用于比例。
- `outputType` 不应被写成 `1:1` / `3:4`。
- 会员/邀请弹窗默认关闭。
- 上传区域不被遮罩挡住。
- 主服装图上传后写入 `draftTask.input.assets.clothImage`。
- `styleImage` 不干扰 MVP 主链路。

Upload 页模板检查：

```js
var page = getCurrentPages().slice(-1)[0];
var vm = page.$vm || page;

console.log('[manual:upload-template-check]', {
  route: page.route,
  entryScene: vm.entryScene,
  showPayModal: vm.showPayModal,
  showShare: vm.showShare,
  hasTemplate: !!vm.currentSceneTemplate,
  templateTitle: vm.currentSceneTemplate && vm.currentSceneTemplate.title,
  draftOptions: vm.chainState && vm.chainState.draftTask && vm.chainState.draftTask.input && vm.chainState.draftTask.input.options,
  draftParams: vm.chainState && vm.chainState.draftTask && vm.chainState.draftTask.input && vm.chainState.draftTask.input.params
});
```

上传主服装图后检查：

```js
(function () {
  var page = getCurrentPages().slice(-1)[0];
  var vm = page && (page.$vm || page);
  var assets = (((vm || {}).chainState || {}).draftTask || {}).input &&
    vm.chainState.draftTask.input.assets || {};
  var cloth = assets.clothImage || {};
  var style = assets.styleImage || {};

  function summary(img) {
    var fileId = img.fileId || img.file_id || img.fileID || '';
    var fileUrl = img.fileUrl || img.file_url || img.imageUrl || img.image_url || img.url || '';
    return {
      hasLocalPath: !!img.localPath,
      hasFileId: !!fileId,
      hasFileUrl: !!fileUrl,
      hasCloudFileId: /^cloud:\/\//.test(fileId),
      hasHttpsUrl: /^https:\/\//.test(fileUrl),
      source: img.source,
      hasAssetId: !!img.assetId
    };
  }

  console.log('[manual:upload-mvp-assets-check]', {
    route: page && page.route,
    entryScene: vm && vm.entryScene,
    clothImage: summary(cloth),
    styleImage: summary(style)
  });
})();
```

预期：
- `clothImage.hasLocalPath === true`
- `clothImage.hasFileId === true`
- `clothImage.hasCloudFileId === true`
- `clothImage.source === 'wx_cloud_upload'`
- `styleImage` 可以为空，不应干扰 MVP 主链路。

生成操作：
- 只调用 `startGenerate()`。
- 不要连续调用 `startGenerate()` + `runGenerate()`。
- `runGenerate` 是内部/底层方法，除非专门测试 inFlight 锁，否则不要手动调用。

```js
var page = getCurrentPages().slice(-1)[0];
var vm = page.$vm || page;
vm.startGenerate();
```

通过标准：
- 只出现一次 `[generateResult] cloud call start`。
- `ai_generate mock success`。
- 自动进入 result 页。
- result 页：
  - `status === 'success'`
  - `stage === 'result_ready'`
  - `progress === 100`
  - `hasSourceImage === true` 或 `hasSourceDisplayImageUrl === true`
  - `hasResultImage === true`
  - `resultImageUrl` 有值
- mock/fallback delivery reconcile 被跳过。
- 不请求 `/api/task/delivery/mock_generate_xxx`。

---

## 4. Batch-detail 批次链路

验收路径：

```text
project/batch-detail -> runBatch
```

说明：
- 只有在 `pages/batch-detail/batch-detail` 页面才有 `runBatch()`。
- 只有存在 `batchId / relatedTasks` 时才能跑 batch smoke。
- upload/result 页 `batchId === undefined` 属于正常现象，不代表上传失败。
- 当前 Upload MVP 直生成链路不创建 batch。

进入批次页：

```text
/pages/batch-detail/batch-detail?batchId=你的batchId
```

Batch-detail 检查：

```js
var page = getCurrentPages().slice(-1)[0];
var vm = page.$vm || page;
var task = vm.relatedTasks && vm.relatedTasks[0];

console.log('[manual:batch-task-card-check]', {
  route: page.route,
  batchId: vm.batchId,
  batchStatus: vm.batch && vm.batch.status,
  batchExecutionStatus: vm.batchExecutionStatus,
  relatedTasksCount: vm.relatedTasks && vm.relatedTasks.length,
  firstTask: task ? {
    taskId: task.taskId || task.id || task.clientTaskId,
    status: task.status,
    stage: task.stage,
    deliveryStatus: task.deliveryStatus,
    reviewStatus: task.reviewStatus,
    statusText: task.statusText,
    resultImageUrl: task.resultImageUrl || (task.result && task.result.coverUrl)
  } : null
});
```

预期：
- `route === 'pages/batch-detail/batch-detail'`
- `batchId` 有值。
- `relatedTasksCount > 0`。
- 有可运行 task 时点击 `runBatch()` 能进入批次运行日志：

```text
[batch-run] start
[batch-run] inspect task
```

---

## 5. ai_generate 云函数

验收目标：
- `ai_generate` 云函数可调用。
- 默认 mock provider 返回成功。
- provider metadata 正确。
- `AI_PROVIDER=real` 但真实 provider 失败时，应 fallback 到 mock。

Console 脚本：

```js
wx.cloud.callFunction({
  name: 'ai_generate',
  data: {
    action: 'generateResult',
    taskId: 'manual_smoke_' + Date.now(),
    modelType: 'female',
    scene: 'white',
    cloth_image: {
      file_id: '',
      file_url: 'https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?auto=format&fit=crop&w=900&q=80'
    },
    style_image: {
      file_id: '',
      file_url: ''
    }
  }
}).then(function (res) {
  console.log('[manual:ai_generate-check]', {
    errMsg: res.errMsg,
    success: res.result && res.result.success,
    provider: res.result && res.result.data && res.result.data.provider,
    requestedProvider: res.result && res.result.data && res.result.data.requestedProvider,
    fallback: res.result && res.result.data && res.result.data.fallback,
    fallbackReason: res.result && res.result.data && res.result.data.fallbackReason,
    mock: res.result && res.result.data && res.result.data.mock,
    resultImageUrl: res.result && res.result.resultImageUrl
  });
}).catch(function (err) {
  console.error('[manual:ai_generate-check:failed]', err);
});
```

默认 mock 预期：

```text
provider = mock
requestedProvider = mock
fallback = false
mock = true
```

---

## 6. 常见问题排查

### upload/result 页 `batchId` 是 undefined

这是正常现象。当前 Upload MVP 直生成链路不创建 batch，也不会自动带 `batchId`。

只有在 `pages/batch-detail/batch-detail` 页面，且存在 `batchId / relatedTasks` 时，才执行 batch smoke。

### result 页 source image 403

- `wx.cloud.getTempFileURL` 返回的是临时 URL，过期后会 403。
- result 页应优先使用 `localPath`，或通过 `cloud:// fileId` 动态刷新展示 URL。
- 不应长期依赖旧的 `*.tcb.qcloud.la?...sign=...`。

### 云函数调用失败

- 确认微信开发者工具项目树中能看到 `cloudfunctions/ai_generate`。
- 确认已上传并部署 `ai_generate`。
- 确认 CloudBase 初始化环境 ID 正确。
- 默认 mock 应能返回成功，不依赖真实 AI API。

---

## 7. 下一阶段可选任务

如果希望 upload 生成也进入批次体系，需要单独实现：

- upload `startGenerate` 成功后创建 task/batch snapshot。
- 写入 `batchStore`。
- 调用 `syncAdminBatchToCloud`。
- result 页带 `batchId`。
- batch-detail 可恢复该 task。

在实现前，Upload MVP 直生成链路和 Batch-detail 批次链路应作为两条独立 smoke 路径验收。
---

## 8. 商业化 P0/P1 smoke

### 套餐权限检查

验收目标：
- 自助会员默认不能使用高级面板，不能生成原创保护材料包。
- 专业会员包含 1000 张 AI 初稿/质检额度和 50 张基础精修额度。
- 企业尊享会员可生成原创保护材料包。

Console 脚本：

```js
var plan = require('/utils/constants/membershipPlans.js');
console.log('[manual:membership:self]', plan.getMembershipPermissions('self_799'));
console.log('[manual:membership:pro]', plan.getMembershipPermissions('pro_1699'));
console.log('[manual:membership:enterprise]', plan.getMembershipPermissions('enterprise_5999'));
```

预期：
- `self_799.canUseAdvancedPanel === false`
- `pro_1699.canUseAdvancedPanel === true`
- `pro_1699.monthlyRefineQuota === 50`
- `enterprise_5999.canCreateOriginalProtectionPackage === true`

### Result 页申请人工精修

进入 result 页后执行：

```js
var page = getCurrentPages().slice(-1)[0];
var vm = page && (page.$vm || page);

if (typeof vm.handleCreateRefineOrder === 'function') {
  vm.handleCreateRefineOrder();
} else {
  console.warn('handleCreateRefineOrder not found');
}
```

预期：
- toast：`已提交人工精修意向`
- Console 出现 `[result:refine-order] created`
- 当前 task 状态不被修改

### mock/fallback 精修与原创材料包

验收目标：
- mock/fallback 结果可以申请人工精修意向。
- 工单中应标记 `sourceIsMockOrFallback=true`。
- mock/fallback 结果不能生成原创保护材料包。

预期：
- 点击 result 页“申请人工精修”可以生成 mock 工单草稿。
- 点击“生成原创保护材料包”提示：`占位/mock 结果不可生成原创保护材料包`。

### Package Center 套餐选择

进入：

```js
wx.redirectTo({ url: '/pages/package-center/package-center' });
```

检查页面展示：
- 免费试用为顶部轻量入口。
- 主付费卡片只有 `self_799 / pro_1699 / enterprise_5999`。
- `pro_1699` 有推荐标记。
- `pro_1699` 显示开业价 `1699`、划线价 `2299`、后期新客 `1999`。
- `enterprise_year_56800` 显示为年包横条。
- `pro_plus_1999 / enterprise_7999` 不作为主卡片展示。

点击任意套餐按钮。

预期：
- Console 出现 `[package-center] plan selected`
- toast：`套餐开通即将开放`
- 不传 `price/amount/totalFee` 给后端
- 不调用真实支付或旧的 `createOrder(price, type, name)`

Console 检查：

```js
var page = getCurrentPages().slice(-1)[0];
var vm = page && (page.$vm || page);

console.log('[manual:package-center:plans]', {
  mainPaidPlans: vm && vm.mainPaidPlans && vm.mainPaidPlans.map(function (item) { return item.tier; }),
  proRecommended: !!(vm && vm.mainPaidPlans && vm.mainPaidPlans.find(function (item) {
    return item.tier === 'pro_1699' && item.recommended;
  })),
  proPrice: vm && vm.mainPaidPlans && vm.mainPaidPlans.find(function (item) {
    return item.tier === 'pro_1699';
  }),
  yearPlan: vm && vm.yearPlan && vm.yearPlan.tier
});
```
## 人工精修工单后台闭环 smoke

验收目标：
- Result 页提交精修意向后，Task Admin 可看到工单。
- 后台可按最小状态流处理：`submitted -> assigned -> processing -> delivered -> approved`。
- 也允许取消和驳回：`submitted -> cancelled`，`delivered -> rejected`。
- 每次状态变化都会追加 `auditTrail`。

Task Admin 页面操作：
1. 进入 `/pages/task-admin/task-admin`。
2. 在“人工精修工单”区点击“领取”，状态应变为 `assigned`。
3. 点击“开始处理”，状态应变为 `processing`。
4. 点击“上传精修结果占位”，状态应变为 `delivered`。
5. 点击“标记客户已确认”，状态应变为 `approved`。

Console 检查脚本：

```js
var page = getCurrentPages().slice(-1)[0];
var vm = page && (page.$vm || page);
var order = vm && vm.refineOrders && vm.refineOrders[0];

console.log('[manual:refine-order-admin-check]', {
  route: page && page.route,
  orderId: order && order.orderId,
  status: order && order.status,
  deliverableUrl: order && order.deliverableUrl,
  auditTrailLength: order && order.auditTrail && order.auditTrail.length
});
```

预期：
- `status === 'approved'`
- `auditTrailLength >= 5`
- Console 每次操作出现 `[refine-order] status updated`
## 原创开发工具入口 smoke

验收目标：
- 首页存在“原创开发工具”区域。
- 三个入口分别进入 `sketch_to_model`、`image_to_sketch`、`sketch_remix`。
- upload 页只改文案和 params，主上传仍写入 `draftTask.input.assets.clothImage`。
- `image_to_sketch` 和 `sketch_remix` 默认展开 `pattern_adjustment`。
- Result 页在 `developmentMode` 不为空时显示原创开发占位动作。

设计稿成衣图：

```js
wx.redirectTo({ url: '/pages/upload/upload?entryScene=sketch_to_model' });

setTimeout(function () {
  var page = getCurrentPages().slice(-1)[0];
  var vm = page && (page.$vm || page);
  var params = (((vm || {}).chainState || {}).draftTask || {}).input &&
    vm.chainState.draftTask.input.params || {};

  console.log('[manual:development:sketch_to_model]', {
    route: page && page.route,
    entryScene: vm && vm.entryScene,
    uploadTitle: vm && vm.primaryUploadTitle,
    templateType: params.templateType,
    taskType: params.taskType,
    developmentMode: params.developmentMode,
    sourceDesignType: params.sourceDesignType,
    hasStructureAnalysis: !!params.structureAnalysis,
    hasTechPack: !!params.techPack
  });
}, 1000);
```

预期：
- `entryScene === 'sketch_to_model'`
- `uploadTitle === '上传设计稿/线稿'`
- `developmentMode === 'sketch_to_model'`
- `hasStructureAnalysis === true`
- `hasTechPack === true`

图片转结构线稿：

```js
wx.redirectTo({ url: '/pages/upload/upload?entryScene=image_to_sketch' });

setTimeout(function () {
  var page = getCurrentPages().slice(-1)[0];
  var vm = page && (page.$vm || page);
  var params = (((vm || {}).chainState || {}).draftTask || {}).input &&
    vm.chainState.draftTask.input.params || {};

  console.log('[manual:development:image_to_sketch]', {
    entryScene: vm && vm.entryScene,
    uploadTitle: vm && vm.primaryUploadTitle,
    showAdvancedSettings: vm && vm.showAdvancedSettings,
    activeAdvancedPanel: vm && vm.activeAdvancedPanel,
    developmentMode: params.developmentMode,
    sourceDesignType: params.sourceDesignType,
    structureAnalysis: params.structureAnalysis,
    techPack: params.techPack
  });
}, 1000);
```

预期：
- `entryScene === 'image_to_sketch'`
- `uploadTitle === '上传成衣图/模特图'`
- `showAdvancedSettings === true`
- `activeAdvancedPanel === 'pattern_adjustment'`

Result 页原创开发动作区：

```js
var page = getCurrentPages().slice(-1)[0];
var vm = page && (page.$vm || page);

console.log('[manual:development:result-actions]', {
  route: page && page.route,
  developmentMode: vm && vm.taskParamsValue && vm.taskParamsValue.developmentMode,
  hasDevelopmentMode: vm && vm.hasDevelopmentMode
});
```

预期：
- `hasDevelopmentMode === true` 时显示“继续改款 / 生成参考工艺单 / 申请设计师修正线稿”。
- 点击按钮仅显示占位 toast，不改变生成状态。

## 套餐点数制与高成本功能限额 smoke

验收目标：
- 套餐配置包含每月 AI 点数、精修额度、视频额度、样衣/实拍额度和原创材料包权限。
- Result 页高成本动作会先检查 AI 点数。
- Result 页申请人工精修会按会员档位处理额度。
- mock/fallback 结果可以提交精修意向，但不扣正式精修额度。
- Package Center 只展示套餐和点数说明，不调用真实支付，不传 `price/amount/totalFee`。

### AI 点数边界

进入 Result 页后执行：

```js
var page = getCurrentPages().slice(-1)[0];
var vm = page && (page.$vm || page);

vm.setMockMembershipTier && vm.setMockMembershipTier('pro_1699');
vm.setMockAiPointsUsed && vm.setMockAiPointsUsed(1195);

vm.handleConsumeForAction && vm.handleConsumeForAction('ai_model_image');
```

预期：
- 成功扣点。
- Console 出现 `[result:ai-points] consumed`。
- `pointsBefore=1195`。
- `pointsConsumed=5`。
- `pointsAfter=1200`。

再次执行：

```js
vm.handleConsumeForAction && vm.handleConsumeForAction('basic_background');
```

预期：
- 被拦截。
- toast：`AI 点数不足`。

### 精修额度边界

```js
vm.setMockMembershipTier && vm.setMockMembershipTier('pro_1699');
vm.setMockRefineUsed && vm.setMockRefineUsed(49);
vm.handleCreateRefineOrder && vm.handleCreateRefineOrder();
```

预期：
- 成功创建人工精修工单。
- Console 出现 `[result:refine-quota] consumed` 和 `[result:refine-order] created`。
- `quotaConsumed=1`。
- `quotaBefore=49`。
- `quotaAfter=50`。

再次执行：

```js
vm.handleCreateRefineOrder && vm.handleCreateRefineOrder();
```

预期：
- 被拦截或提示额度不足。
- toast：`本月精修额度不足，可按张购买或升级套餐`。

### mock/fallback 精修意向不扣额度

当前为 `mock_generate_` task 时执行：

```js
vm.setMockMembershipTier && vm.setMockMembershipTier('pro_1699');
vm.setMockRefineUsed && vm.setMockRefineUsed(50);
vm.handleCreateRefineOrder && vm.handleCreateRefineOrder();
```

预期：
- 允许提交精修意向。
- Console `[result:refine-order] created` 中 `sourceIsMockOrFallback=true`。
- `quotaConsumed=0`。
- `quotaConsumeReason='mock_or_fallback_intent'`。

### 自助会员精修意向

```js
vm.setMockMembershipTier && vm.setMockMembershipTier('self_799');
vm.handleCreateRefineOrder && vm.handleCreateRefineOrder();
```

预期：
- 允许提交精修意向。
- `quotaConsumed=0`。
- toast：`自助会员精修需按张购买`。

### Package Center 点数展示

进入：

```js
wx.redirectTo({ url: '/pages/package-center/package-center' });
```

预期：
- 自助会员显示 `600 AI点/月`、`0 张精修/月`、`3 条视频/月`。
- 专业会员显示 `1200 AI点/月`、`50 张精修/月`、`10 条视频/月`。
- 企业尊享显示 `4000 AI点/月`、`100 张精修/月`、`30 条视频/月`。
- 页面出现 AI 点数制说明。
- 点击套餐按钮只打印 `[package-center] plan selected`。
- 不调用真实支付，不传 `price/amount/totalFee`。

## 云端额度强校验 smoke

验收目标：
- 前端 mock 扣点只用于体验验证，不能作为真实商业化依据。
- 真实上线必须先调用 `quota_guard` 完成云端 check/consume，再调用 `ai_generate` 或扩展生成接口。
- consume 类 action 必须带 `idempotencyKey`，避免重复扣点。
- 失败时不记成功消耗；如果已扣点但后续未提交到真实 provider，可进入 `rollbackUsage`。

### debugConfig

```js
wx.cloud.callFunction({
  name: 'quota_guard',
  data: { action: 'debugConfig' }
}).then(function (res) {
  console.log('[manual:quota-guard:debugConfig]', JSON.stringify(res.result, null, 2));
});
```

预期：
- `success=true`
- `mock=true`
- `supportedActions` 包含 `consumeAiPoints` / `consumeRefineQuota` / `rollbackUsage`
- 不返回前端传入的会员等级作为可信结果

### AI 点数云端占位扣减

```js
wx.cloud.callFunction({
  name: 'quota_guard',
  data: {
    action: 'consumeAiPoints',
    actionType: 'ai_model_image',
    sourceTaskId: 'manual_task_' + Date.now(),
    idempotencyKey: 'manual_user_ai_model_image_' + Date.now()
  }
}).then(function (res) {
  console.log('[manual:quota-guard:consume-ai]', JSON.stringify(res.result, null, 2));
});
```

预期：
- `success=true`
- `data.record.costType='ai_points'`
- `data.record.costValue=5`
- `data.record.beforeValue=0`
- `data.record.afterValue=5`
- `data.usage.monthlyAiPointsUsed=5`
- `data.record.status='consumed'`

说明：
- 当前 `quota_guard` 仍是 mock 占位，usage 只在单次调用返回值内模拟同步。
- 再调用 `getUsageSummary` 不保证看到上一次 consume 的 used 值。
- 真实上线必须使用 `membership_usage` 数据库持久化和事务/条件更新。

### mock/fallback 精修意向不扣正式额度

```js
wx.cloud.callFunction({
  name: 'quota_guard',
  data: {
    action: 'consumeRefineQuota',
    actionType: 'basic_refine',
    sourceTaskId: 'mock_generate_' + Date.now(),
    sourceIsMockOrFallback: true,
    idempotencyKey: 'manual_mock_refine_' + Date.now()
  }
}).then(function (res) {
  console.log('[manual:quota-guard:mock-refine-intent]', JSON.stringify(res.result, null, 2));
});
```

预期：
- `success=true`
- `data.record.status='intent_recorded'`
- `data.record.costValue=0`
- 不扣正式精修额度

### 真实上线顺序

真实商业化链路必须是：
1. `quota_guard.consumeAiPoints` 或对应 consume action 成功；
2. 再调用 `ai_generate` 或扩展生成接口；
3. provider 未收到请求且生成失败时，可 `rollbackUsage`；
4. provider 已收到请求或可能扣费时，不应盲目 rollback，需要状态机或人工审计。

## Quota Guard 前端联调占位

验收目标：
- Result 页已有远程额度校验开关，但默认关闭。
- 默认 `ENABLE_REMOTE_QUOTA_GUARD=false` 时，前端继续走本地 mock 扣点。
- 后续接真实 API 前，再把开关改为 `true`。
- 开关为 `true` 后，高成本动作会先调用 `quota_guard.consumeAiPoints`。
- mock/fallback 精修意向不扣正式额度。
- 远程额度校验失败时，不继续执行高成本动作。

Result 页执行：

```js
var page = getCurrentPages().slice(-1)[0];
var vm = page && (page.$vm || page);

console.log('[manual:remote-quota-debug]',
  vm.getRemoteQuotaGuardDebugInfo && vm.getRemoteQuotaGuardDebugInfo()
);
```

预期：
- `enabled=false`
- `hasCallRemoteQuotaGuard=true`
- `currentTaskId` 有值或为空均可

如果本地临时把 `ENABLE_REMOTE_QUOTA_GUARD` 改为 `true` 后，再执行：

```js
vm.handleConsumeForAction && vm.handleConsumeForAction('ai_model_image');
```

预期：
- 调用 `quota_guard.consumeAiPoints`
- 成功返回 `costValue=5`
- 本地动作继续
- 如果 `quota_guard` 失败，则 toast 拦截，不继续高成本动作

## 真实 Provider 成本保护占位 smoke

验收目标：
- 当前真实 provider 成本保护仍为设计占位。
- `ENABLE_REMOTE_QUOTA_GUARD` 默认仍为 `false`。
- 当前 mock provider 成功链路不受影响。
- 上线真实 provider 前必须启用云端 `quota_guard`，并通过 consume/rollback/idempotency 测试。

真实 provider 上线前必须验证：
1. 真实生成前先调用 `quota_guard.consumeAiPoints`。
2. `idempotencyKey` 使用 `user/openid + actionType + clientTaskId/taskId + clientRequestId`。
3. 同一次生成重试不会重复扣点。
4. provider 未收到请求或明确未计费失败时，可以 `quota_guard.rollbackUsage`。
5. provider 已接受异步任务时，不立即 rollback，不重复 submit。
6. mock/fallback 不扣正式额度，只记录 intent。

actionType 映射：
- `ecommerce_main` / AI 模特图：`ai_model_image`
- `sketch_to_model`：`sketch_to_model`
- `image_to_sketch`：`image_to_sketch`
- `hot_style_remix`：`hot_style_remix`
- 细节特写：`detail_closeup`
- 走秀视频：`runway_video_3s` / `runway_video_5s` / `runway_video_10s`

## Remote Quota Dev Toggle 小修 smoke

验收目标：
- 不通过 Console 重声明 `const ENABLE_REMOTE_QUOTA_GUARD`。
- Result 页默认仍关闭远程 quota guard。
- DevTools 可通过 `setRemoteQuotaGuardEnabledForDev(true)` 临时打开远程扣点。
- 打开后可直接调用 `callRemoteQuotaGuard('consumeAiPoints', ...)` 验证云函数返回。

在 result 页执行：

```js
var page = getCurrentPages().slice(-1)[0];
var vm = page && (page.$vm || page);

console.log('[manual:remote-quota-before]', vm.getRemoteQuotaGuardDebugInfo());

vm.setRemoteQuotaGuardEnabledForDev && vm.setRemoteQuotaGuardEnabledForDev(true);

console.log('[manual:remote-quota-after]', vm.getRemoteQuotaGuardDebugInfo());
```

预期：
- `before.enabled=false`
- `after.enabled=true`
- `after.hasCallRemoteQuotaGuard=true`

再执行：

```js
(async function () {
  var page = getCurrentPages().slice(-1)[0];
  var vm = page && (page.$vm || page);
  var task = vm && (vm.currentTaskValue || vm.currentTask || {});
  var taskId = task.taskId || task.id || task.clientTaskId || ('manual_task_' + Date.now());

  var res = await vm.callRemoteQuotaGuard('consumeAiPoints', {
    actionType: 'ai_model_image',
    sourceTaskId: taskId,
    idempotencyKey: 'manual_ai_model_image_' + Date.now()
  });

  console.log('[manual:remote-quota-consume-ai]', JSON.stringify({
    ok: res && res.ok,
    costValue: res && res.result && res.result.data && res.result.data.record && res.result.data.record.costValue,
    beforeValue: res && res.result && res.result.data && res.result.data.record && res.result.data.record.beforeValue,
    afterValue: res && res.result && res.result.data && res.result.data.record && res.result.data.record.afterValue,
    monthlyAiPointsUsed: res && res.result && res.result.data && res.result.data.usage && res.result.data.usage.monthlyAiPointsUsed
  }, null, 2));
})();
```

预期：
- `ok=true`
- `costValue=5`
- `afterValue=5`
- `monthlyAiPointsUsed=5`

## Step 2 Result 页二次加工工具区 smoke

验收目标：
- 进入 result 页后检查是否出现“二次加工与上新素材”工具区。
- 点击或调用 AI 面料替换时，mock/fallback 任务只生成体验结果，不扣正式额度。
- 走秀视频按钮只生成占位结果，不调用真实视频 API。

AI 面料替换：

```js
var page = getCurrentPages().slice(-1)[0];
var vm = page && (page.$vm || page);

vm.handleExtensionAction && vm.handleExtensionAction('fabric_replace');

setTimeout(function () {
  console.log('[manual:extension-results]', {
    route: page && page.route,
    count: vm.extensionResults && vm.extensionResults.length,
    first: vm.extensionResults && vm.extensionResults[0]
  });
}, 300);
```

预期：
- mock_generate 下不扣正式额度。
- `extensionResults` 增加 1 条。
- `sourceIsMockOrFallback === true`。
- `pointsConsumed === 0`。

走秀视频占位：

```js
vm.handleExtensionAction && vm.handleExtensionAction('runway_video_3s');
```

预期：
- `statusText` 包含“走秀视频能力即将开放”。
- `videoUrl === ''`。

## Step 3 首页原创开发工具入口 smoke

进入首页：

```js
wx.redirectTo({ url: '/pages/index/index' });
```

检查原创开发工具入口是否展示：
- 设计稿成衣图
- 图片转结构线稿
- 线稿改款效果图
- AI款式起稿

点击/跳转验证：

```js
wx.redirectTo({ url: '/pages/upload/upload?entryScene=sketch_to_model' });
```

在 upload 页执行：

```js
var page = getCurrentPages().slice(-1)[0];
var vm = page && (page.$vm || page);

console.log('[manual:creative-entry-preset]', {
  route: page && page.route,
  entryScene: vm && vm.entryScene,
  templateType: vm && vm.templateType,
  showAdvancedSettings: vm && vm.showAdvancedSettings,
  activeAdvancedPanel: vm && vm.activeAdvancedPanel,
  draftParams: vm && vm.chainState && vm.chainState.draftTask && vm.chainState.draftTask.input && vm.chainState.draftTask.input.params
});
```

预期：
- `route === 'pages/upload/upload'`
- `entryScene === 'sketch_to_model'`
- `draftParams.developmentMode === 'sketch_to_model'`
- `draftParams.sourceDesignType === 'sketch'`

## 服装增强功能 P0 总验收

本章节用于从首页原创开发入口到 Result 页二次加工工具区做一次完整 DevTools 总验收。

真实接口接入前请先查看：[服装增强功能接口映射表 P0](../ai/fashion-enhancement-api-map.md)。

### 1. 首页原创开发入口验收

进入首页：

```js
wx.redirectTo({ url: '/pages/index/index' });
```

检查目标：
- 页面显示“原创开发工具”区。
- 入口包含：设计稿成衣图 `sketch_to_model`。
- 入口包含：图片转结构线稿 `image_to_sketch`。
- 入口包含：线稿改款效果图 `sketch_remix`。
- 入口包含：AI款式起稿 `text_to_sketch`。

### 2. 原创入口跳转 upload preset 验收

进入 upload preset：

```js
wx.redirectTo({ url: '/pages/upload/upload?entryScene=sketch_to_model' });
```

然后执行：

```js
var page = getCurrentPages().slice(-1)[0];
var vm = page && (page.$vm || page);

console.log('[manual:creative-entry-preset]', {
  route: page && page.route,
  entryScene: vm && vm.entryScene,
  templateType: vm && vm.templateType,
  showAdvancedSettings: vm && vm.showAdvancedSettings,
  activeAdvancedPanel: vm && vm.activeAdvancedPanel,
  draftParams: vm && vm.chainState && vm.chainState.draftTask && vm.chainState.draftTask.input && vm.chainState.draftTask.input.params
});
```

预期：
- `route === 'pages/upload/upload'`
- `entryScene === 'sketch_to_model'`
- `draftParams.developmentMode === 'sketch_to_model'`
- `draftParams.sourceDesignType === 'sketch'`

### 3. 进入 result 页

如果已有 mock 任务：

```js
wx.redirectTo({ url: '/pages/result/result?taskId=mock_generate_1780628774691' });
```

如果没有 mock 任务，从 upload 页生成一次。

### 4. Result 页二次加工工具区验收

执行：

```js
var page = getCurrentPages().slice(-1)[0];
var vm = page && (page.$vm || page);

console.log('[manual:extension-methods-check]', {
  route: page && page.route,
  hasHandleExtensionAction: !!(vm && typeof vm.handleExtensionAction === 'function'),
  hasExtensionResults: !!(vm && Array.isArray(vm.extensionResults)),
  currentCount: vm && vm.extensionResults && vm.extensionResults.length
});
```

预期：
- `route === 'pages/result/result'`
- `hasHandleExtensionAction === true`
- `hasExtensionResults === true`

### 5. AI面料替换 mock 结果验收

执行：

```js
vm.handleExtensionAction && vm.handleExtensionAction('fabric_replace');

setTimeout(function () {
  console.log('[manual:extension-results:fabric]', JSON.stringify(
    (vm.extensionResults || []).map(function (item) {
      return {
        extensionTaskId: item.extensionTaskId,
        sourceTaskId: item.sourceTaskId,
        actionType: item.actionType,
        title: item.title,
        status: item.status,
        statusText: item.statusText,
        sourceIsMockOrFallback: item.sourceIsMockOrFallback,
        pointsConsumed: item.pointsConsumed,
        hasPreviewUrl: !!item.previewUrl,
        videoUrl: item.videoUrl,
        createdAt: item.createdAt
      };
    }),
    null,
    2
  ));
}, 500);
```

预期：
- 新增 `actionType === 'fabric_replace'`。
- `mock_generate` 下 `sourceIsMockOrFallback === true`。
- `pointsConsumed === 0`。
- `status === 'success'`。

### 6. 走秀视频占位验收

执行：

```js
vm.handleExtensionAction && vm.handleExtensionAction('runway_video_3s');

setTimeout(function () {
  var latest = vm.extensionResults && vm.extensionResults[0];

  console.log('[manual:extension-results:runway]', {
    route: page && page.route,
    count: vm.extensionResults && vm.extensionResults.length,
    latest: latest && {
      extensionTaskId: latest.extensionTaskId,
      actionType: latest.actionType,
      status: latest.status,
      statusText: latest.statusText,
      sourceIsMockOrFallback: latest.sourceIsMockOrFallback,
      pointsConsumed: latest.pointsConsumed,
      videoUrl: latest.videoUrl
    }
  });
}, 500);
```

预期：
- `actionType === 'runway_video_3s'`。
- `statusText` 包含“走秀视频能力即将开放”。
- `videoUrl === ''`。
- `mock_generate` 下 `pointsConsumed === 0`。

### 7. 远程 quota_guard 联调状态说明

说明：
- Result 页 Dev Toggle 已支持。
- 默认 `enabled=false`。
- mock/fallback 不扣正式额度。
- 非 mock task 可通过 `manual_real_task` 测试 `consumeAiPoints=5`。

保留脚本：

```js
vm.setRemoteQuotaGuardEnabledForDev(true);
vm.callRemoteQuotaGuard('consumeAiPoints', {
  actionType: 'ai_model_image',
  sourceTaskId: 'manual_real_task_' + Date.now(),
  idempotencyKey: 'manual_real_ai_model_image_' + Date.now()
});
```

### 8. 当前边界说明

- 本阶段只做入口和 mock 结果。
- 未接真实万相 API。
- 未接真实视频。
- 未生成真实长图。
- 未生成真实工艺单。
- 未接真实支付。
- 不影响 Upload MVP 主生成链路。
- 后续接真实接口前必须开启 `quota_guard` 云端强校验。

## AI面料替换 fabric_replace P1 接口占位 smoke

验收目标：
- `ai_generate.fabricReplace` 已有云函数 action 占位。
- Result 页默认仍走 mock extension result。
- `mock_generate` 任务不扣正式额度。
- P1 不调用真实万相 API。

### 1. 调用 ai_generate.fabricReplace mock

```js
wx.cloud.callFunction({
  name: 'ai_generate',
  data: {
    action: 'fabricReplace',
    sourceTaskId: 'manual_fabric_source_' + Date.now(),
    sourceImageUrl: 'https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?auto=format&fit=crop&w=900&q=80',
    fabricType: 'cotton_linen',
    idempotencyKey: 'manual_fabric_replace_' + Date.now()
  }
}).then(function (res) {
  console.log('[manual:fabric-replace:cloud]', {
    success: res.result && res.result.success,
    ok: res.result && res.result.ok,
    action: res.result && res.result.action,
    taskId: res.result && res.result.taskId,
    status: res.result && res.result.status,
    hasResultImage: !!(res.result && res.result.resultImageUrl),
    data: res.result && res.result.data
  });
}).catch(function (err) {
  console.error('[manual:fabric-replace:cloud:failed]', err);
});
```

预期：
- `success === true`
- `ok === true`
- `action === 'fabricReplace'`
- `status === 'success'`
- `data.provider === 'mock'`
- `data.actionType === 'fabric_replace'`
- `data.fabricType === 'cotton_linen'`

### 2. Result 页 fabric_replace 默认 mock 链路

在 result 页执行：

```js
var page = getCurrentPages().slice(-1)[0];
var vm = page && (page.$vm || page);

console.log('[manual:fabric-replace:debug]', vm.getFabricReplaceDebugInfo && vm.getFabricReplaceDebugInfo());

vm.handleExtensionAction && vm.handleExtensionAction('fabric_replace', {
  fabricType: 'cotton_linen'
});

setTimeout(function () {
  var latest = vm.extensionResults && vm.extensionResults[0];
  console.log('[manual:fabric-replace:result]', {
    route: page && page.route,
    enabled: vm.getFabricReplaceDebugInfo && vm.getFabricReplaceDebugInfo().enabled,
    count: vm.extensionResults && vm.extensionResults.length,
    latest: latest && {
      actionType: latest.actionType,
      title: latest.title,
      status: latest.status,
      statusText: latest.statusText,
      sourceIsMockOrFallback: latest.sourceIsMockOrFallback,
      pointsConsumed: latest.pointsConsumed,
      hasPreviewUrl: !!latest.previewUrl,
      videoUrl: latest.videoUrl
    }
  });
}, 500);
```

预期：
- `enabled === false`
- `latest.actionType === 'fabric_replace'`
- `latest.status === 'success'`
- `mock_generate` 下 `latest.sourceIsMockOrFallback === true`
- `mock_generate` 下 `latest.pointsConsumed === 0`

## AI面料替换 fabric_replace P2 真实接入准备 smoke

验收目标：
- 保留 `fabricReplace` mock smoke。
- 云函数在 `AI_PROVIDER=real` 时只走 real provider 骨架，不请求真实万相。
- Result 页默认 `ENABLE_REAL_FABRIC_REPLACE=false`，仍走 mock extension result。
- 本地临时开启 real 开关后可验证 Result 页 debug 信息。

### 1. fabricReplace mock smoke

```js
wx.cloud.callFunction({
  name: 'ai_generate',
  data: {
    action: 'fabricReplace',
    sourceTaskId: 'manual_fabric_source_' + Date.now(),
    sourceImageUrl: 'https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?auto=format&fit=crop&w=900&q=80',
    fabricType: 'cotton_linen',
    idempotencyKey: 'manual_fabric_replace_mock_' + Date.now()
  }
}).then(function (res) {
  console.log('[manual:fabric-replace:p2:mock]', {
    success: res.result && res.result.success,
    ok: res.result && res.result.ok,
    action: res.result && res.result.action,
    status: res.result && res.result.status,
    hasResultImage: !!(res.result && res.result.resultImageUrl),
    provider: res.result && res.result.data && res.result.data.provider,
    requestedProvider: res.result && res.result.data && res.result.data.requestedProvider,
    actionType: res.result && res.result.data && res.result.data.actionType,
    fabricType: res.result && res.result.data && res.result.data.fabricType
  });
});
```

预期：
- `success === true`
- `ok === true`
- `provider === 'mock'`
- `requestedProvider === 'fabric_replace'`
- `actionType === 'fabric_replace'`

### 2. Result 页 fabric_replace extension smoke

```js
var page = getCurrentPages().slice(-1)[0];
var vm = page && (page.$vm || page);

console.log('[manual:fabric-replace:p2:debug]', vm.getFabricReplaceDebugInfo && vm.getFabricReplaceDebugInfo());

vm.handleExtensionAction && vm.handleExtensionAction('fabric_replace', {
  fabricType: 'cotton_linen'
});

setTimeout(function () {
  var latest = vm.extensionResults && vm.extensionResults[0];
  console.log('[manual:fabric-replace:p2:extension]', {
    route: page && page.route,
    debug: vm.getFabricReplaceDebugInfo && vm.getFabricReplaceDebugInfo(),
    latest: latest && {
      actionType: latest.actionType,
      status: latest.status,
      statusText: latest.statusText,
      sourceIsMockOrFallback: latest.sourceIsMockOrFallback,
      pointsConsumed: latest.pointsConsumed,
      hasPreviewUrl: !!latest.previewUrl
    }
  });
}, 500);
```

预期：
- `debug.enabled === false`
- `debug.actionType === 'fabric_replace'`
- `debug.sourceIsMockOrFallback` 能反映当前 Result 源任务状态。
- `latest.actionType === 'fabric_replace'`
- `mock_generate` 下 `latest.pointsConsumed === 0`

### 3. 开启 real 开关后的 debug 验证脚本

本脚本只用于本地临时验证。需要先在 `pages/result/result.vue` 临时把：

```js
const ENABLE_REAL_FABRIC_REPLACE = true
```

然后重新编译并在 Result 页执行：

```js
var page = getCurrentPages().slice(-1)[0];
var vm = page && (page.$vm || page);

console.log('[manual:fabric-replace:p2:real-toggle-debug]', {
  route: page && page.route,
  debug: vm.getFabricReplaceDebugInfo && vm.getFabricReplaceDebugInfo()
});
```

预期：
- `debug.enabled === true`
- `debug.actionType === 'fabric_replace'`
- `debug.hasHandleExtensionAction === true`
- `debug.hasCallRemoteQuotaGuard === true`

### 4. 云函数 real provider 骨架说明

如需验证云函数 real 骨架，需要在云函数环境临时设置 `AI_PROVIDER=real` 后调用 `fabricReplace`。该骨架只做参数校验和结构化占位返回，不请求真实万相。

预期：
- 返回 `data.provider === 'real_placeholder'`。
- 返回 `data.requestedProvider === 'fabric_replace'`。
- 返回 `data.providerCallSkipped === true`。
- 不产生真实 provider 成本。

## fabric_replace P2 真实接口接入前配置检查 smoke

验收目标：
- `debugConfig` 返回 fabricReplace 配置摘要，不返回 endpoint/API key 原文。
- 默认 `FABRIC_REPLACE_PROVIDER=mock` 时，`fabricReplace` 仍返回 mock 成功。
- 当云函数环境变量 `FABRIC_REPLACE_PROVIDER=real` 但未配置 endpoint/key 时，应返回 `FABRIC_REPLACE_CONFIG_MISSING`，且不请求外部 API。

### 1. debugConfig 检查 fabricReplace 配置摘要

```js
wx.cloud.callFunction({
  name: 'ai_generate',
  data: { action: 'debugConfig' }
}).then(function (res) {
  console.log('[manual:fabric-replace:debug-config]', {
    success: res.result && res.result.success,
    provider: res.result && res.result.data && res.result.data.provider,
    fabricReplaceProvider: res.result && res.result.data && res.result.data.fabricReplaceProvider,
    hasFabricReplaceEndpoint: res.result && res.result.data && res.result.data.hasFabricReplaceEndpoint,
    hasFabricReplaceApiKey: res.result && res.result.data && res.result.data.hasFabricReplaceApiKey,
    fabricReplaceModel: res.result && res.result.data && res.result.data.fabricReplaceModel,
    fabricReplaceTimeoutMs: res.result && res.result.data && res.result.data.fabricReplaceTimeoutMs
  });
});
```

预期：
- `success === true`
- `fabricReplaceProvider === 'mock'`
- `hasFabricReplaceEndpoint` 为布尔值。
- `hasFabricReplaceApiKey` 为布尔值。
- 不出现 endpoint 原文。
- 不出现 API key 原文。

### 2. 默认 mock fabricReplace

```js
wx.cloud.callFunction({
  name: 'ai_generate',
  data: {
    action: 'fabricReplace',
    sourceTaskId: 'manual_fabric_source_' + Date.now(),
    sourceImageUrl: 'https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?auto=format&fit=crop&w=900&q=80',
    fabricType: 'cotton_linen',
    idempotencyKey: 'manual_fabric_replace_mock_' + Date.now()
  }
}).then(function (res) {
  console.log('[manual:fabric-replace:default-mock]', {
    success: res.result && res.result.success,
    ok: res.result && res.result.ok,
    action: res.result && res.result.action,
    status: res.result && res.result.status,
    provider: res.result && res.result.data && res.result.data.provider,
    requestedProvider: res.result && res.result.data && res.result.data.requestedProvider,
    actionType: res.result && res.result.data && res.result.data.actionType,
    fabricType: res.result && res.result.data && res.result.data.fabricType
  });
});
```

预期：
- `success === true`
- `ok === true`
- `provider === 'mock'`
- `requestedProvider === 'fabric_replace'`
- `actionType === 'fabric_replace'`

### 3. real 未配置说明

如果云函数环境变量临时设置：

```text
FABRIC_REPLACE_PROVIDER=real
```

但未配置：

```text
FABRIC_REPLACE_ENDPOINT
FABRIC_REPLACE_API_KEY
```

再次调用 `fabricReplace` 时预期：

- `success === false`
- `ok === false`
- `errorCode === 'FABRIC_REPLACE_CONFIG_MISSING'`
- `message === '面料替换服务暂未配置'`
- `data.provider === 'real'`
- `data.requestedProvider === 'fabric_replace'`
- `data.actionType === 'fabric_replace'`
- `data.hasEndpoint === false`
- `data.hasApiKey === false`
- 不请求外部 API。

### 4. real 配置齐全但 P3 未启用说明

如果 `FABRIC_REPLACE_PROVIDER=real` 且 endpoint/key 均已配置，P2 仍不请求真实万相，预期返回：

- `success === false`
- `ok === false`
- `errorCode === 'FABRIC_REPLACE_REAL_NOT_IMPLEMENTED'`
- `message === '面料替换真实接口尚未启用'`
- `data.providerCallSkipped === true`

## Fabric Replace 前端按钮 smoke

验收目标：
- Result 页“AI面料替换”按钮默认调用 `handleExtensionAction('fabric_replace', { fabricType: 'cotton_linen' })`。
- `mock_generate` 任务下不扣正式额度、不调用 `quota_guard`、创建 `extensionResult`。
- DevTools 可检查 `getFabricReplaceDebugInfo()` 和最新 `extensionResults`。

### 1. 进入 result 页

```js
wx.redirectTo({
  url: '/pages/result/result?taskId=mock_generate_1780628774691'
});
```

### 2. 检查 debug

```js
var page = getCurrentPages().slice(-1)[0];
var vm = page && (page.$vm || page);

console.log('[manual:fabric-replace-debug]', JSON.stringify(
  vm.getFabricReplaceDebugInfo && vm.getFabricReplaceDebugInfo(),
  null,
  2
));
```

预期：
- `enabled === false`
- `hasHandleExtensionAction === true`
- `currentTaskId` 有值

### 3. 触发 fabric_replace

```js
vm.handleExtensionAction && vm.handleExtensionAction('fabric_replace', {
  fabricType: 'cotton_linen'
});

setTimeout(function () {
  var latest = vm.extensionResults && vm.extensionResults[0];

  console.log('[manual:fabric-replace-extension-result]', {
    route: page && page.route,
    count: vm.extensionResults && vm.extensionResults.length,
    latest: latest && {
      extensionTaskId: latest.extensionTaskId,
      sourceTaskId: latest.sourceTaskId,
      actionType: latest.actionType,
      status: latest.status,
      statusText: latest.statusText,
      sourceIsMockOrFallback: latest.sourceIsMockOrFallback,
      pointsConsumed: latest.pointsConsumed,
      hasPreviewUrl: !!latest.previewUrl,
      videoUrl: latest.videoUrl
    }
  });
}, 500);
```

预期：
- `route === 'pages/result/result'`
- `latest.actionType === 'fabric_replace'`
- `latest.status === 'success'`
- `latest.sourceIsMockOrFallback === true`
- `latest.pointsConsumed === 0`
- `latest.hasPreviewUrl === true`

## 首页功能矩阵补齐 P0 验收

验收目标：
- 首页保留 6 大主入口。
- 首页展示“原创开发工具”和“上新素材工具”两个功能矩阵区块。
- 所有新增卡片点击统一跳转 `/pages/upload/upload?entryScene=<entryScene>`。
- 本阶段只做入口和 preset 占位，不接真实 API，不改生成主链路。

### 1. 进入首页

```js
wx.redirectTo({ url: '/pages/index/index' });
```

人工检查首页是否出现：

原创开发工具：
- 文字生成款式草图
- 设计稿成衣图
- 图片转结构线稿
- 线稿改款效果图
- 线稿生成简易工艺结构图

上新素材工具：
- AI印花生成
- 一键衣身贴图
- AI面料替换
- 同款多色批量生成
- 爆款衍生改款
- 实拍图智能生成详情页
- 局部放大细节图
- 自动排版详情长图
- 一键生成T台走秀短片

### 2. 测试跳转到 upload preset

```js
wx.redirectTo({ url: '/pages/upload/upload?entryScene=fabric_replace' });
```

进入 upload 后执行：

```js
var page = getCurrentPages().slice(-1)[0];
var vm = page && (page.$vm || page);

console.log('[manual:index-feature-entry-upload-check]', {
  route: page && page.route,
  entryScene: vm && vm.entryScene,
  templateType: vm && vm.templateType,
  draftParams: vm && vm.chainState && vm.chainState.draftTask && vm.chainState.draftTask.input && vm.chainState.draftTask.input.params
});
```

预期：
- `route === 'pages/upload/upload'`
- `entryScene === 'fabric_replace'`
- `draftParams.developmentMode === 'fabric_replace'` 或 `draftParams.taskType === 'fabric_replace'`

### 3. 点击日志

点击首页新增功能卡片时，Console 应出现：

```text
[index:feature-entry] click
```

日志字段只包含：
- `section`
- `entryScene`
- `name`

不应打印图片 URL、`fileID`、`localPath`。

## 高级精细化设置动态面板 P0 验收

验收目标：
- upload 页根据当前 `entryScene` 动态展示高级精细化设置面板。
- 不同功能只展示相关高级参数。
- `draftTask.input.params` 保留 `entryScene`、`taskType`、`developmentMode`、`selectedAdvancedPanels`、`advancedPanelValues`。
- 本阶段只做配置和显示控制，不接真实 API，不改生成主链路。

通用检查脚本：

```js
var page = getCurrentPages().slice(-1)[0];
var vm = page && (page.$vm || page);

console.log('[manual:advanced-panels-check]', {
  route: page && page.route,
  entryScene: vm && vm.entryScene,
  currentAdvancedPanels: vm && vm.currentAdvancedPanels,
  activeAdvancedPanel: vm && vm.activeAdvancedPanel,
  showAdvancedSettings: vm && vm.showAdvancedSettings,
  draftParams: vm && vm.chainState && vm.chainState.draftTask && vm.chainState.draftTask.input && vm.chainState.draftTask.input.params
});
```

### 1. 电商主图

```js
wx.redirectTo({ url: '/pages/upload/upload?entryScene=ecommerce_main' });
```

预期：
- `currentAdvancedPanels` 包含 `model_and_body`、`style_scene`、`platform_output`。
- `currentAdvancedPanels` 不包含 `print_design`、`runway_video`、`tech_pack`。

### 2. 爆款改款

```js
wx.redirectTo({ url: '/pages/upload/upload?entryScene=hot_style_remix' });
```

预期：
- `currentAdvancedPanels` 包含 `pattern_adjustment`、`style_scene`、`fabric_texture`。
- `showAdvancedSettings === true`。
- `activeAdvancedPanel === 'pattern_adjustment'`。

### 3. AI面料替换

```js
wx.redirectTo({ url: '/pages/upload/upload?entryScene=fabric_replace' });
```

预期：
- `currentAdvancedPanels` 重点包含 `fabric_texture`。
- `currentAdvancedPanels` 不包含 `runway_video`、`tech_pack`。

### 4. 走秀视频

```js
wx.redirectTo({ url: '/pages/upload/upload?entryScene=runway_video' });
```

预期：
- `currentAdvancedPanels` 包含 `runway_video`、`style_scene`。

### 5. 图片转结构线稿

```js
wx.redirectTo({ url: '/pages/upload/upload?entryScene=image_to_sketch' });
```

预期：
- `currentAdvancedPanels` 包含 `image_to_sketch`、`tech_pack`。
- 面板文案使用“参考线稿”“参考工艺结构说明”“设计师/制版师修正后用于生产沟通”等低风险表达。

## 新功能入口不应 fallback default

目标：
- 首页新增功能入口跳转 upload 后，`entryScene` 和 `templateType` 不应回退为 `default`。
- 新入口应继续带出对应高级动态面板。
- 本 smoke 只验证入口识别和参数写入，不触发真实生成。

### 1. fabric_replace

```js
wx.redirectTo({ url: '/pages/upload/upload?entryScene=fabric_replace' });
```

执行：

```js
var page = getCurrentPages().slice(-1)[0];
var vm = page && (page.$vm || page);

console.log('[manual:upload-entry:fabric_replace]', {
  route: page && page.route,
  entryScene: vm && vm.entryScene,
  templateType: vm && vm.templateType,
  currentAdvancedPanels: vm && vm.currentAdvancedPanels,
  activeAdvancedPanel: vm && vm.activeAdvancedPanel,
  showAdvancedSettings: vm && vm.showAdvancedSettings,
  draftParams: vm && vm.chainState && vm.chainState.draftTask && vm.chainState.draftTask.input && vm.chainState.draftTask.input.params
});
```

预期：
- `entryScene === 'fabric_replace'`
- `templateType === 'fabric_replace'`
- `currentAdvancedPanels` 包含 `fabric_texture`
- `activeAdvancedPanel === 'fabric_texture'`
- `showAdvancedSettings === true`
- `draftParams.developmentMode === 'fabric_replace'`
- `draftParams.selectedAdvancedPanels` 包含 `fabric_texture`

### 2. runway_video

```js
wx.redirectTo({ url: '/pages/upload/upload?entryScene=runway_video' });
```

执行通用检查脚本，预期：
- `entryScene === 'runway_video'`
- `templateType === 'runway_video'`
- `currentAdvancedPanels` 包含 `runway_video`、`style_scene`
- `activeAdvancedPanel === 'runway_video'`
- `showAdvancedSettings === true`
- `draftParams.developmentMode === 'runway_video'`

### 3. 批量检查其他新增入口

```js
[
  'print_generate',
  'print_placement',
  'color_batch',
  'detail_page_from_photo',
  'detail_closeup',
  'detail_long_image',
  'sketch_to_tech_pack'
].forEach(function (entryScene, index) {
  setTimeout(function () {
    wx.redirectTo({ url: '/pages/upload/upload?entryScene=' + entryScene });
    setTimeout(function () {
      var page = getCurrentPages().slice(-1)[0];
      var vm = page && (page.$vm || page);
      console.log('[manual:upload-entry:not-default]', {
        entryScene: entryScene,
        route: page && page.route,
        vmEntryScene: vm && vm.entryScene,
        templateType: vm && vm.templateType,
        currentAdvancedPanels: vm && vm.currentAdvancedPanels,
        activeAdvancedPanel: vm && vm.activeAdvancedPanel,
        draftParams: vm && vm.chainState && vm.chainState.draftTask && vm.chainState.draftTask.input && vm.chainState.draftTask.input.params
      });
    }, 300);
  }, index * 800);
});
```

预期：
- 每个入口的 `vmEntryScene` 不等于 `default`。
- 每个入口的 `templateType` 不等于 `default`。
- `draftParams.developmentMode` 等于当前入口。
- `draftParams.selectedAdvancedPanels` 有对应面板。
## 高级面板自定义提示词 P1 验收

目标：
- 每个动态高级面板都有 `customPrompt` 补充需求字段。
- textarea 输入只写入 `advancedPanelValues`，不触发真实生成。
- 日志只打印长度，不打印完整用户输入内容。

### 1. 进入 AI 面料替换

```js
wx.redirectTo({ url: '/pages/upload/upload?entryScene=fabric_replace' });
```

### 2. 模拟写入 customPrompt

实际页面方法：`updateAdvancedFieldValue(panelKey, field, value)`。

```js
var page = getCurrentPages().slice(-1)[0];
var vm = page && (page.$vm || page);
var fabricPanel = vm && vm.currentAdvancedPanelConfigs && vm.currentAdvancedPanelConfigs.find(function (panel) {
  return panel.panelKey === 'fabric_texture';
});
var customPromptField = fabricPanel && fabricPanel.fields && fabricPanel.fields.find(function (field) {
  return field.key === 'customPrompt';
});

vm.updateAdvancedFieldValue && vm.updateAdvancedFieldValue(
  'fabric_texture',
  customPromptField,
  '重磅水洗牛仔，轻微做旧，保留原版褶皱'
);
```

### 3. 检查写入结果

```js
var page = getCurrentPages().slice(-1)[0];
var vm = page && (page.$vm || page);

console.log('[manual:advanced-custom-prompt-check]', {
  route: page && page.route,
  entryScene: vm && vm.entryScene,
  advancedPanelValues: vm && vm.advancedPanelValues,
  draftAdvancedPanelValues: vm && vm.chainState && vm.chainState.draftTask && vm.chainState.draftTask.input && vm.chainState.draftTask.input.params && vm.chainState.draftTask.input.params.advancedPanelValues
});
```

## 高级面板 customPrompt 汇总 P1 验收

目标：
- `customPrompt` 继续写入 `advancedPanelValues`。
- 非空 `customPrompt` 汇总到 `draftTask.input.params.advancedCustomPrompts`。
- 同步生成 `draftTask.input.params.customPromptSummary`。
- 日志只打印 panelKey 和长度，不打印完整 prompt 内容。

### 1. 写入 fabric_texture

```js
wx.redirectTo({ url: '/pages/upload/upload?entryScene=fabric_replace' });

setTimeout(function () {
  var page = getCurrentPages().slice(-1)[0];
  var vm = page && (page.$vm || page);
  var panel = vm && vm.currentAdvancedPanelConfigs && vm.currentAdvancedPanelConfigs.find(function (item) {
    return item.panelKey === 'fabric_texture';
  });
  var field = panel && panel.fields && panel.fields.find(function (item) {
    return item.key === 'customPrompt';
  });

  vm.updateAdvancedFieldValue && vm.updateAdvancedFieldValue(
    'fabric_texture',
    field,
    '重磅水洗牛仔，轻微做旧，保留原版褶皱'
  );
}, 300);
```

### 2. 写入 runway_video

```js
wx.redirectTo({ url: '/pages/upload/upload?entryScene=runway_video' });

setTimeout(function () {
  var page = getCurrentPages().slice(-1)[0];
  var vm = page && (page.$vm || page);
  var panel = vm && vm.currentAdvancedPanelConfigs && vm.currentAdvancedPanelConfigs.find(function (item) {
    return item.panelKey === 'runway_video';
  });
  var field = panel && panel.fields && panel.fields.find(function (item) {
    return item.key === 'customPrompt';
  });

  vm.updateAdvancedFieldValue && vm.updateAdvancedFieldValue(
    'runway_video',
    field,
    '自然走秀，轻微转身，衣摆随动作自然摆动'
  );
}, 300);
```

### 3. 检查汇总字段

```js
var page = getCurrentPages().slice(-1)[0];
var vm = page && (page.$vm || page);
var params = vm && vm.chainState && vm.chainState.draftTask && vm.chainState.draftTask.input && vm.chainState.draftTask.input.params;

console.log('[manual:advanced-custom-prompt-payload-check]', {
  route: page && page.route,
  entryScene: vm && vm.entryScene,
  advancedCustomPrompts: params && params.advancedCustomPrompts,
  customPromptSummary: params && params.customPromptSummary
});
```

预期：
- 修改 `fabric_texture.customPrompt` 后，`advancedCustomPrompts.fabric_texture` 有值。
- 修改 `runway_video.customPrompt` 后，`advancedCustomPrompts.runway_video` 有值。
- `customPromptSummary` 包含 `[fabric_texture]` 或 `[runway_video]` 开头的摘要行。
- Console 的 `[upload:advanced-panel] custom prompt changed` 只包含 `panelKey/key/length`。

预期：
- `advancedPanelValues.fabric_texture.customPrompt` 有值。
- `draftTask.input.params.advancedPanelValues.fabric_texture.customPrompt` 同步有值。
- Console 出现 `[upload:advanced-panel] custom prompt changed`，字段包含 `panelKey/key/length`，不包含完整输入内容。
## 高级面板固定选项交互 P1 验收

目标：
- `select` / `switch` / `number` / `text` / `textarea` 字段均可通过 `updateAdvancedFieldValue(panelKey, field, value)` 写入。
- 每次字段变化同步 `advancedPanelValues`、`draftTask.input.params.advancedPanelValues`、`advancedCustomPrompts`、`customPromptSummary`、`selectedAdvancedPanels`。
- 日志 `[upload:advanced-panel] field changed` 只打印字段摘要；customPrompt 不打印完整内容。

### 1. fabric_replace

```js
wx.redirectTo({ url: '/pages/upload/upload?entryScene=fabric_replace' });

setTimeout(function () {
  var page = getCurrentPages().slice(-1)[0];
  var vm = page && (page.$vm || page);

  vm.updateAdvancedFieldValue && vm.updateAdvancedFieldValue(
    'fabric_texture',
    { key: 'fabricType', type: 'select' },
    'denim'
  );

  vm.updateAdvancedFieldValue && vm.updateAdvancedFieldValue(
    'fabric_texture',
    { key: 'textureStrength', type: 'select' },
    'strong'
  );

  console.log('[manual:advanced-field-fabric]', {
    value: vm && vm.advancedPanelValues && vm.advancedPanelValues.fabric_texture,
    draftValue: vm && vm.chainState && vm.chainState.draftTask && vm.chainState.draftTask.input && vm.chainState.draftTask.input.params && vm.chainState.draftTask.input.params.advancedPanelValues && vm.chainState.draftTask.input.params.advancedPanelValues.fabric_texture
  });
}, 300);
```

预期：
- `fabricType === 'denim'`
- `textureStrength === 'strong'`

### 2. runway_video

```js
wx.redirectTo({ url: '/pages/upload/upload?entryScene=runway_video' });

setTimeout(function () {
  var page = getCurrentPages().slice(-1)[0];
  var vm = page && (page.$vm || page);

  vm.updateAdvancedFieldValue && vm.updateAdvancedFieldValue(
    'runway_video',
    { key: 'durationSec', type: 'select' },
    10
  );

  vm.updateAdvancedFieldValue && vm.updateAdvancedFieldValue(
    'runway_video',
    { key: 'motionType', type: 'select' },
    'natural_catwalk'
  );

  console.log('[manual:advanced-field-runway]', {
    value: vm && vm.advancedPanelValues && vm.advancedPanelValues.runway_video,
    draftValue: vm && vm.chainState && vm.chainState.draftTask && vm.chainState.draftTask.input && vm.chainState.draftTask.input.params && vm.chainState.draftTask.input.params.advancedPanelValues && vm.chainState.draftTask.input.params.advancedPanelValues.runway_video
  });
}, 300);
```

预期：
- `durationSec === 10`
- `motionType === 'natural_catwalk'`

### 3. image_to_sketch

```js
wx.redirectTo({ url: '/pages/upload/upload?entryScene=image_to_sketch' });

setTimeout(function () {
  var page = getCurrentPages().slice(-1)[0];
  var vm = page && (page.$vm || page);

  vm.updateAdvancedFieldValue && vm.updateAdvancedFieldValue(
    'image_to_sketch',
    { key: 'sketchLevel', type: 'select' },
    'precise'
  );
  vm.updateAdvancedFieldValue && vm.updateAdvancedFieldValue(
    'image_to_sketch',
    { key: 'includeLabels', type: 'switch' },
    true
  );
  vm.updateAdvancedFieldValue && vm.updateAdvancedFieldValue(
    'image_to_sketch',
    { key: 'includeCraftNotes', type: 'switch' },
    true
  );

  console.log('[manual:advanced-field-sketch]', {
    value: vm && vm.advancedPanelValues && vm.advancedPanelValues.image_to_sketch,
    draftValue: vm && vm.chainState && vm.chainState.draftTask && vm.chainState.draftTask.input && vm.chainState.draftTask.input.params && vm.chainState.draftTask.input.params.advancedPanelValues && vm.chainState.draftTask.input.params.advancedPanelValues.image_to_sketch
  });
}, 300);
```

预期：
- `sketchLevel === 'precise'`
- `includeLabels === true`
- `includeCraftNotes === true`

### 4. hot_style_remix

```js
wx.redirectTo({ url: '/pages/upload/upload?entryScene=hot_style_remix' });

setTimeout(function () {
  var page = getCurrentPages().slice(-1)[0];
  var vm = page && (page.$vm || page);

  vm.updateAdvancedFieldValue && vm.updateAdvancedFieldValue(
    'pattern_adjustment',
    { key: 'neckType', type: 'select' },
    'v_neck'
  );
  vm.updateAdvancedFieldValue && vm.updateAdvancedFieldValue(
    'pattern_adjustment',
    { key: 'sleeveType', type: 'select' },
    'short_sleeve'
  );
  vm.updateAdvancedFieldValue && vm.updateAdvancedFieldValue(
    'pattern_adjustment',
    { key: 'pocketEnabled', type: 'switch' },
    true
  );

  console.log('[manual:advanced-field-remix]', {
    value: vm && vm.advancedPanelValues && vm.advancedPanelValues.pattern_adjustment,
    draftValue: vm && vm.chainState && vm.chainState.draftTask && vm.chainState.draftTask.input && vm.chainState.draftTask.input.params && vm.chainState.draftTask.input.params.advancedPanelValues && vm.chainState.draftTask.input.params.advancedPanelValues.pattern_adjustment
  });
}, 300);
```

预期：
- `neckType === 'v_neck'`
- `sleeveType === 'short_sleeve'`
- `pocketEnabled === true`
## 高级面板选项与提示词联动 P2 验收

目标：
- 固定选项不仅写入 value，还生成可读中文选项摘要。
- `customPrompt` 与固定选项合并生成 `fullAdvancedPromptSummary`。
- 本阶段不触发真实生成，不调用真实 API。

### 1. fabric_replace

```js
wx.redirectTo({ url: '/pages/upload/upload?entryScene=fabric_replace' });

setTimeout(function () {
  var page = getCurrentPages().slice(-1)[0];
  var vm = page && (page.$vm || page);

  vm.updateAdvancedFieldValue('fabric_texture', { key: 'fabricType', type: 'select' }, 'denim');
  vm.updateAdvancedFieldValue('fabric_texture', { key: 'textureStrength', type: 'select' }, 'strong');
  vm.updateAdvancedFieldValue('fabric_texture', { key: 'customPrompt', type: 'textarea' }, '水洗牛仔，轻微做旧，保留原版褶皱');

  setTimeout(function () {
    var params = vm.chainState.draftTask.input.params;
    console.log('[manual:advanced-prompt-summary:fabric]', {
      advancedPanelValues: params.advancedPanelValues,
      advancedCustomPrompts: params.advancedCustomPrompts,
      advancedOptionPrompts: params.advancedOptionPrompts,
      customPromptSummary: params.customPromptSummary,
      optionPromptSummary: params.optionPromptSummary,
      fullAdvancedPromptSummary: params.fullAdvancedPromptSummary
    });
  }, 300);
}, 300);
```

预期：
- `advancedOptionPrompts.fabric_texture` 包含“面料：牛仔”。
- `advancedOptionPrompts.fabric_texture` 包含“质感强度：强”。
- `advancedCustomPrompts.fabric_texture` 有值。
- `fullAdvancedPromptSummary` 同时包含选项摘要和补充需求。

### 2. runway_video

```js
wx.redirectTo({ url: '/pages/upload/upload?entryScene=runway_video' });

setTimeout(function () {
  var page = getCurrentPages().slice(-1)[0];
  var vm = page && (page.$vm || page);

  vm.updateAdvancedFieldValue('runway_video', { key: 'durationSec', type: 'select' }, 10);
  vm.updateAdvancedFieldValue('runway_video', { key: 'motionType', type: 'select' }, 'natural_catwalk');
  vm.updateAdvancedFieldValue('runway_video', { key: 'customPrompt', type: 'textarea' }, '自然走秀，轻微转身');

  setTimeout(function () {
    var params = vm.chainState.draftTask.input.params;
    console.log('[manual:advanced-prompt-summary:runway]', {
      advancedOptionPrompts: params.advancedOptionPrompts,
      advancedCustomPrompts: params.advancedCustomPrompts,
      fullAdvancedPromptSummary: params.fullAdvancedPromptSummary
    });
  }, 300);
}, 300);
```

预期：
- `advancedOptionPrompts.runway_video` 包含“时长：10”。
- `advancedCustomPrompts.runway_video` 有值。
- `fullAdvancedPromptSummary` 包含 `runway_video`。

### 3. hot_style_remix

```js
wx.redirectTo({ url: '/pages/upload/upload?entryScene=hot_style_remix' });

setTimeout(function () {
  var page = getCurrentPages().slice(-1)[0];
  var vm = page && (page.$vm || page);

  vm.updateAdvancedFieldValue('pattern_adjustment', { key: 'neckType', type: 'select' }, 'v_neck');
  vm.updateAdvancedFieldValue('pattern_adjustment', { key: 'sleeveType', type: 'select' }, 'short_sleeve');
  vm.updateAdvancedFieldValue('pattern_adjustment', { key: 'pocketEnabled', type: 'switch' }, true);
  vm.updateAdvancedFieldValue('pattern_adjustment', { key: 'customPrompt', type: 'textarea' }, '圆领改V领，衣长略短');

  setTimeout(function () {
    var params = vm.chainState.draftTask.input.params;
    console.log('[manual:advanced-prompt-summary:remix]', {
      advancedOptionPrompts: params.advancedOptionPrompts,
      advancedCustomPrompts: params.advancedCustomPrompts,
      fullAdvancedPromptSummary: params.fullAdvancedPromptSummary
    });
  }, 300);
}, 300);
```

预期：
- `advancedOptionPrompts.pattern_adjustment` 包含“领口：V领”。
- `advancedOptionPrompts.pattern_adjustment` 包含“是否加口袋：是”。
- `fullAdvancedPromptSummary` 包含选项摘要和补充需求。
## 生成前参数确认卡片 P1 验收

目标：
- Upload 页生成按钮附近展示“生成前确认”卡片。
- 卡片展示当前功能、已选高级设置、补充需求、完整 AI 参考摘要。
- 修改高级面板后，`getGenerateConfirmSummary()` 返回内容实时更新。
- App 日志不打印完整 prompt。

### 1. fabric_replace 参数确认

```js
wx.redirectTo({ url: '/pages/upload/upload?entryScene=fabric_replace' });

setTimeout(function () {
  var page = getCurrentPages().slice(-1)[0];
  var vm = page && (page.$vm || page);

  vm.updateAdvancedFieldValue('fabric_texture', { key: 'fabricType', type: 'select' }, 'denim');
  vm.updateAdvancedFieldValue('fabric_texture', { key: 'textureStrength', type: 'select' }, 'strong');
  vm.updateAdvancedFieldValue('fabric_texture', { key: 'customPrompt', type: 'textarea' }, '水洗牛仔，轻微做旧，保留原版褶皱');

  setTimeout(function () {
    console.log('[manual:generate-confirm-summary]', vm.getGenerateConfirmSummary && vm.getGenerateConfirmSummary());
  }, 300);
}, 300);
```

预期：
- `entryScene === 'fabric_replace'`
- `optionPromptSummary` 包含“面料：牛仔”
- `optionPromptSummary` 包含“质感强度：强”
- `customPromptSummary` 包含“水洗牛仔”
- `fullAdvancedPromptSummary` 有值
- 页面可看到“生成前确认”卡片
## H2 成本 actionType 归一验收

目标：
- 新入口进入 upload 后写入 `draftTask.input.params.costActionType`。
- 不直接把未入成本表的 `entryScene/taskType` 传给扣点。
- `runway_video` 按高级面板时长分档归一。

通用检查：

```js
var page = getCurrentPages().slice(-1)[0];
var vm = page && (page.$vm || page);
var params = vm && vm.chainState && vm.chainState.draftTask && vm.chainState.draftTask.input && vm.chainState.draftTask.input.params;

console.log('[manual:h2-cost-action-type]', {
  route: page && page.route,
  entryScene: vm && vm.entryScene,
  costActionType: params && params.costActionType,
  advancedPanelValues: params && params.advancedPanelValues
});
```

### 1. color_batch

```js
wx.redirectTo({ url: '/pages/upload/upload?entryScene=color_batch' });
```

预期：`draftTask.input.params.costActionType === 'basic_recolor'`

### 2. text_to_sketch

```js
wx.redirectTo({ url: '/pages/upload/upload?entryScene=text_to_sketch' });
```

预期：`draftTask.input.params.costActionType === 'sketch_to_model'`

### 3. sketch_remix

```js
wx.redirectTo({ url: '/pages/upload/upload?entryScene=sketch_remix' });
```

预期：`draftTask.input.params.costActionType === 'hot_style_remix'`

### 4. detail_page_from_photo

```js
wx.redirectTo({ url: '/pages/upload/upload?entryScene=detail_page_from_photo' });
```

预期：`draftTask.input.params.costActionType === 'detail_long_image'`

### 5. sketch_to_tech_pack

```js
wx.redirectTo({ url: '/pages/upload/upload?entryScene=sketch_to_tech_pack' });
```

预期：`draftTask.input.params.costActionType === 'image_to_sketch'`

### 6. runway_video 10s

```js
wx.redirectTo({ url: '/pages/upload/upload?entryScene=runway_video' });

setTimeout(function () {
  var page = getCurrentPages().slice(-1)[0];
  var vm = page && (page.$vm || page);
  vm.updateAdvancedFieldValue && vm.updateAdvancedFieldValue(
    'runway_video',
    { key: 'durationSec', type: 'select' },
    10
  );
  setTimeout(function () {
    var params = vm.chainState.draftTask.input.params;
    console.log('[manual:h2-cost-action-type:runway]', {
      costActionType: params.costActionType,
      durationSec: params.advancedPanelValues && params.advancedPanelValues.runway_video && params.advancedPanelValues.runway_video.durationSec
    });
  }, 300);
}, 300);
```

预期：`draftTask.input.params.costActionType === 'runway_video_10s'`
## H2 Result 扣点返回结构表格验收

目标：
- `vm.handleConsumeForAction(...)` 返回值直接暴露 `costActionType`。
- 返回值直接暴露 `costValue` 或 `pointsConsumed`。
- 表格 smoke 能统计 `mappingPassCount=8`、`costPassCount=8`、`okCount=8`。

进入 result 页后执行。执行前请确认当前账号/本地 mock 账本有足够 AI 点数，避免余额不足影响 `okCount`。

```js
var page = getCurrentPages().slice(-1)[0];
var vm = page && (page.$vm || page);

var cases = [
  { rawActionType: 'text_to_sketch', expectedCostActionType: 'sketch_to_model', expectedCostValue: 5 },
  { rawActionType: 'sketch_remix', expectedCostActionType: 'hot_style_remix', expectedCostValue: 6 },
  { rawActionType: 'color_batch', expectedCostActionType: 'basic_recolor', expectedCostValue: 1 },
  { rawActionType: 'detail_page_from_photo', expectedCostActionType: 'detail_long_image', expectedCostValue: 3 },
  { rawActionType: 'sketch_to_tech_pack', expectedCostActionType: 'image_to_sketch', expectedCostValue: 5 },
  { rawActionType: 'runway_video', options: { durationSec: 3 }, expectedCostActionType: 'runway_video_3s', expectedCostValue: 25 },
  { rawActionType: 'runway_video', options: { durationSec: 5 }, expectedCostActionType: 'runway_video_5s', expectedCostValue: 45 },
  { rawActionType: 'runway_video', options: { durationSec: 10 }, expectedCostActionType: 'runway_video_10s', expectedCostValue: 90 }
];

(async function () {
  var rows = [];
  for (var i = 0; i < cases.length; i += 1) {
    var item = cases[i];
    var res = vm.handleConsumeForAction
      ? await vm.handleConsumeForAction(item.rawActionType, item.options || {})
      : {};
    var actualCostActionType = res.costActionType || res.actionType || '';
    var actualCostValue = res.costValue || res.pointsConsumed || 0;
    rows.push({
      rawActionType: item.rawActionType,
      expectedCostActionType: item.expectedCostActionType,
      actualCostActionType: actualCostActionType,
      expectedCostValue: item.expectedCostValue,
      actualCostValue: actualCostValue,
      mappingPass: actualCostActionType === item.expectedCostActionType,
      costPass: Number(actualCostValue) === Number(item.expectedCostValue),
      ok: !!res.ok,
      reason: res.reason || '',
      reasonText: res.reasonText || ''
    });
  }

  var summary = rows.reduce(function (acc, row) {
    acc.mappingPassCount += row.mappingPass ? 1 : 0;
    acc.costPassCount += row.costPass ? 1 : 0;
    acc.okCount += row.ok ? 1 : 0;
    return acc;
  }, { mappingPassCount: 0, costPassCount: 0, okCount: 0 });

  console.table(rows);
  console.log('[manual:h2-cost-action-type:consume-table]', summary);
})();
```

预期：
- `mappingPassCount === 8`
- `costPassCount === 8`
- `okCount === 8`
- 每条 `res` 都包含 `rawActionType`、`costActionType`、`actionType`、`costValue`、`pointsConsumed`。
## P2 高级面板提示词链路收口验收

目标：
- 固定选项转成中文 `advancedOptionPrompts`。
- `customPrompt` 汇总到 `advancedCustomPrompts`。
- `fullAdvancedPromptSummary` 同时包含固定选项和补充需求。
- `getGenerateConfirmSummary()` 读取同一份 `draftTask.input.params` 摘要。
- 不触发真实生成，不调用真实 API。

### 1. fabric_replace / fabric_texture

```js
wx.redirectTo({ url: '/pages/upload/upload?entryScene=fabric_replace' });

setTimeout(function () {
  var page = getCurrentPages().slice(-1)[0];
  var vm = page && (page.$vm || page);

  vm.updateAdvancedFieldValue('fabric_texture', { key: 'fabricType', type: 'select' }, 'denim');
  vm.updateAdvancedFieldValue('fabric_texture', { key: 'fabricColor', type: 'select' }, 'keep_original');
  vm.updateAdvancedFieldValue('fabric_texture', { key: 'textureStrength', type: 'select' }, 'strong');
  vm.updateAdvancedFieldValue('fabric_texture', { key: 'replaceScope', type: 'select' }, 'whole_garment');
  vm.updateAdvancedFieldValue('fabric_texture', { key: 'customPrompt', type: 'textarea' }, '水洗牛仔，轻微做旧，保留原版褶皱和版型');

  setTimeout(function () {
    var params = vm.chainState.draftTask.input.params;
    console.log('[manual:p2-advanced-prompt:fabric]', {
      advancedOptionPrompts: params.advancedOptionPrompts,
      advancedCustomPrompts: params.advancedCustomPrompts,
      optionPromptSummary: params.optionPromptSummary,
      customPromptSummary: params.customPromptSummary,
      fullAdvancedPromptSummary: params.fullAdvancedPromptSummary,
      confirmSummary: vm.getGenerateConfirmSummary && vm.getGenerateConfirmSummary()
    });
  }, 300);
}, 300);
```

预期：
- `advancedOptionPrompts.fabric_texture` 包含“面料：牛仔”。
- 包含“面料颜色：保留原色”“质感强度：强”“替换范围：整衣”。
- `advancedCustomPrompts.fabric_texture` 有值。
- `fullAdvancedPromptSummary` 同时包含选项摘要和补充需求。

### 2. runway_video

```js
wx.redirectTo({ url: '/pages/upload/upload?entryScene=runway_video' });

setTimeout(function () {
  var page = getCurrentPages().slice(-1)[0];
  var vm = page && (page.$vm || page);

  vm.updateAdvancedFieldValue('runway_video', { key: 'durationSec', type: 'select' }, 10);
  vm.updateAdvancedFieldValue('runway_video', { key: 'motionType', type: 'select' }, 'natural_catwalk');
  vm.updateAdvancedFieldValue('runway_video', { key: 'cameraType', type: 'select' }, 'full_body');
  vm.updateAdvancedFieldValue('runway_video', { key: 'backgroundType', type: 'select' }, 'runway_stage');
  vm.updateAdvancedFieldValue('runway_video', { key: 'customPrompt', type: 'textarea' }, '自然走秀，轻微转身，衣摆随动作自然摆动');

  setTimeout(function () {
    var params = vm.chainState.draftTask.input.params;
    console.log('[manual:p2-advanced-prompt:runway]', {
      costActionType: params.costActionType,
      advancedOptionPrompts: params.advancedOptionPrompts,
      advancedCustomPrompts: params.advancedCustomPrompts,
      optionPromptSummary: params.optionPromptSummary,
      customPromptSummary: params.customPromptSummary,
      fullAdvancedPromptSummary: params.fullAdvancedPromptSummary,
      confirmSummary: vm.getGenerateConfirmSummary && vm.getGenerateConfirmSummary()
    });
  }, 300);
}, 300);
```

预期：
- `advancedOptionPrompts.runway_video` 包含“时长：10秒”“动作：自然走秀”“镜头：全身”“背景：T台”。
- `costActionType === 'runway_video_10s'`。
- `fullAdvancedPromptSummary` 同时包含选项摘要和补充需求。

### 3. hot_style_remix / pattern_adjustment

```js
wx.redirectTo({ url: '/pages/upload/upload?entryScene=hot_style_remix' });

setTimeout(function () {
  var page = getCurrentPages().slice(-1)[0];
  var vm = page && (page.$vm || page);

  vm.updateAdvancedFieldValue('pattern_adjustment', { key: 'neckType', type: 'select' }, 'v_neck');
  vm.updateAdvancedFieldValue('pattern_adjustment', { key: 'sleeveType', type: 'select' }, 'short_sleeve');
  vm.updateAdvancedFieldValue('pattern_adjustment', { key: 'fitType', type: 'select' }, 'slim');
  vm.updateAdvancedFieldValue('pattern_adjustment', { key: 'pocketEnabled', type: 'switch' }, true);
  vm.updateAdvancedFieldValue('pattern_adjustment', { key: 'customPrompt', type: 'textarea' }, '圆领改V领，长袖改短袖，衣长略短，腰线略收');

  setTimeout(function () {
    var params = vm.chainState.draftTask.input.params;
    console.log('[manual:p2-advanced-prompt:remix]', {
      advancedOptionPrompts: params.advancedOptionPrompts,
      advancedCustomPrompts: params.advancedCustomPrompts,
      optionPromptSummary: params.optionPromptSummary,
      customPromptSummary: params.customPromptSummary,
      fullAdvancedPromptSummary: params.fullAdvancedPromptSummary,
      confirmSummary: vm.getGenerateConfirmSummary && vm.getGenerateConfirmSummary()
    });
  }, 300);
}, 300);
```

预期：
- `advancedOptionPrompts.pattern_adjustment` 包含“领口：V领”“袖型：短袖”“版型：修身”“是否加口袋：是”。

### 4. image_to_sketch

```js
wx.redirectTo({ url: '/pages/upload/upload?entryScene=image_to_sketch' });

setTimeout(function () {
  var page = getCurrentPages().slice(-1)[0];
  var vm = page && (page.$vm || page);

  vm.updateAdvancedFieldValue('image_to_sketch', { key: 'sketchLevel', type: 'select' }, 'precise');
  vm.updateAdvancedFieldValue('image_to_sketch', { key: 'includeLabels', type: 'switch' }, true);
  vm.updateAdvancedFieldValue('image_to_sketch', { key: 'includeCraftNotes', type: 'switch' }, true);
  vm.updateAdvancedFieldValue('image_to_sketch', { key: 'customPrompt', type: 'textarea' }, '重点标注领口、袖口、省道、口袋和开衩结构');

  setTimeout(function () {
    var params = vm.chainState.draftTask.input.params;
    console.log('[manual:p2-advanced-prompt:sketch]', {
      advancedOptionPrompts: params.advancedOptionPrompts,
      advancedCustomPrompts: params.advancedCustomPrompts,
      optionPromptSummary: params.optionPromptSummary,
      customPromptSummary: params.customPromptSummary,
      fullAdvancedPromptSummary: params.fullAdvancedPromptSummary,
      confirmSummary: vm.getGenerateConfirmSummary && vm.getGenerateConfirmSummary()
    });
  }, 300);
}, 300);
```

预期：
- `advancedOptionPrompts.image_to_sketch` 包含“线稿精度：精细”“是否标注结构：是”“是否生成参考工艺说明：是”。
- `getGenerateConfirmSummary()` 与 params 中的摘要一致。

## P3 高级提示词进入生成请求参数占位验收

本阶段只验证 Upload 生成请求参数透传、客户端日志摘要和 `ai_generate` mock/fallback 返回调试摘要，不接真实 provider。

### 1. 进入 AI 面料替换入口

```js
wx.redirectTo({ url: '/pages/upload/upload?entryScene=fabric_replace' });
```

### 2. 写入高级参数

```js
var page = getCurrentPages().slice(-1)[0];
var vm = page && (page.$vm || page);

vm.updateAdvancedFieldValue('fabric_texture', { key: 'fabricType', type: 'select' }, 'denim');
vm.updateAdvancedFieldValue('fabric_texture', { key: 'textureStrength', type: 'select' }, 'strong');
vm.updateAdvancedFieldValue('fabric_texture', { key: 'customPrompt', type: 'textarea' }, '水洗牛仔，轻微做旧，保留原版褶皱和版型');
```

### 3. 检查生成前 params

```js
var params = vm.chainState.draftTask.input.params;
console.log('[manual:p3-before-generate-params]', {
  entryScene: vm.entryScene,
  costActionType: params.costActionType,
  hasAdvancedPanelValues: !!params.advancedPanelValues,
  advancedCustomPrompts: params.advancedCustomPrompts,
  advancedOptionPrompts: params.advancedOptionPrompts,
  customPromptSummary: params.customPromptSummary,
  optionPromptSummary: params.optionPromptSummary,
  fullAdvancedPromptSummary: params.fullAdvancedPromptSummary
});
```

预期：
- `costActionType === 'fabric_replace'`。
- `advancedCustomPrompts.fabric_texture` 有值。
- `advancedOptionPrompts.fabric_texture` 包含“面料：牛仔”和“质感强度：强”。
- `fullAdvancedPromptSummary` 同时包含固定选项摘要和补充需求。

### 4. 调用生成

```js
vm.startGenerate && vm.startGenerate();
```

预期控制台看到：
- `[upload:generate-advanced-prompt] prepared`
- `[generateResult] advanced prompt summary`
- `[generateResult] cloud call start`
- `[generateResult] cloud response result`

预期 `ai_generate` 返回：
- `data.advancedPromptMeta.hasFullAdvancedPromptSummary === true`
- `data.advancedPromptMeta.fullAdvancedPromptSummaryLength > 0`
- `data.advancedPromptMeta.advancedCustomPromptCount >= 1`
- `data.advancedPromptMeta.advancedOptionPromptCount >= 1`
- `data.advancedPromptMeta.costActionType === 'fabric_replace'`

注意：
- 日志只应打印长度、count、`costActionType` 等摘要。
- 不应打印完整 `customPrompt` / `fullAdvancedPromptSummary`。
- 不应调用真实万相 API。
## P3 高级提示词生成链路复验收口

本节用于复验高级提示词摘要从 Upload 生成前参数进入 `generateResult` / `ai_generate` 的 mock/fallback 链路。当前阶段不接真实 provider，不调用真实万相 API。

### 1. fabric_replace 主验收脚本

```js
wx.redirectTo({ url: '/pages/upload/upload?entryScene=fabric_replace' });

setTimeout(function () {
  var page = getCurrentPages().slice(-1)[0];
  var vm = page && (page.$vm || page);

  vm.updateAdvancedFieldValue('fabric_texture', { key: 'fabricType', type: 'select' }, 'denim');
  vm.updateAdvancedFieldValue('fabric_texture', { key: 'fabricColor', type: 'select' }, 'keep_original');
  vm.updateAdvancedFieldValue('fabric_texture', { key: 'textureStrength', type: 'select' }, 'strong');
  vm.updateAdvancedFieldValue('fabric_texture', { key: 'replaceScope', type: 'select' }, 'whole_garment');
  vm.updateAdvancedFieldValue('fabric_texture', { key: 'customPrompt', type: 'textarea' }, '水洗牛仔，轻微做旧，保留原版褶皱和版型');

  setTimeout(function () {
    var params = vm.chainState.draftTask.input.params;

    console.log('[manual:p3-before-generate]', {
      entryScene: vm.entryScene,
      templateType: vm.templateType,
      costActionType: params.costActionType,
      advancedOptionPrompt: params.advancedOptionPrompts && params.advancedOptionPrompts.fabric_texture,
      advancedCustomPromptLength: params.advancedCustomPrompts && params.advancedCustomPrompts.fabric_texture && params.advancedCustomPrompts.fabric_texture.length,
      optionPromptSummaryLength: params.optionPromptSummary && params.optionPromptSummary.length,
      customPromptSummaryLength: params.customPromptSummary && params.customPromptSummary.length,
      fullAdvancedPromptSummaryLength: params.fullAdvancedPromptSummary && params.fullAdvancedPromptSummary.length,
      confirmSummary: vm.getGenerateConfirmSummary && vm.getGenerateConfirmSummary()
    });

    vm.startGenerate && vm.startGenerate();
  }, 300);
}, 300);
```

### 2. Upload 日志预期

必须看到：

```text
[upload:generate-advanced-prompt] prepared
```

字段预期：
- `entryScene=fabric_replace`
- `templateType=fabric_replace`
- `costActionType=fabric_replace`
- `hasAdvancedPanelValues=true`
- `advancedCustomPromptCount >= 1`
- `advancedOptionPromptCount >= 1`
- `fullAdvancedPromptSummaryLength > 0`

### 3. generateResult 日志预期

必须看到：

```text
[generateResult] advanced prompt summary
```

字段预期：
- `hasFullAdvancedPromptSummary=true`
- `fullAdvancedPromptSummaryLength > 0`
- `advancedCustomPromptCount >= 1`
- `advancedOptionPromptCount >= 1`
- `costActionType=fabric_replace`

### 4. ai_generate 返回预期

在 `[generateResult] cloud response result` 中检查：

```js
result.data && result.data.advancedPromptMeta
```

字段预期：
- `hasFullAdvancedPromptSummary === true`
- `fullAdvancedPromptSummaryLength > 0`
- `advancedCustomPromptCount >= 1`
- `advancedOptionPromptCount >= 1`
- `costActionType === 'fabric_replace'`

### 5. 边界与安全

- 不打印完整 `customPrompt`。
- 不打印完整 `fullAdvancedPromptSummary`。
- 不打印图片 URL、fileID、localPath、API key、endpoint 原文。
- 不调用真实万相 API。
- 不改变 `quota_guard` 成本数值。
- 不影响 Upload 主生成链路，只增加参数透传和摘要日志验证。

## advancedPromptRules alias 兜底验收

目标：确认 `buildAdvancedPromptSummary` 优先使用 `advancedPanelPresets` 的 `field.label` 与 `options.label`，当 options 找不到时再使用 alias 兜底；同时确认 upload 页没有第二套汇总函数。

### 1. runway_video alias

```js
wx.redirectTo({ url: '/pages/upload/upload?entryScene=runway_video' });

setTimeout(function () {
  var page = getCurrentPages().slice(-1)[0];
  var vm = page && (page.$vm || page);

  vm.updateAdvancedFieldValue('runway_video', { key: 'durationSec', type: 'select' }, 10);
  vm.updateAdvancedFieldValue('runway_video', { key: 'motionType', type: 'select' }, 'natural_walk');
  vm.updateAdvancedFieldValue('runway_video', { key: 'cameraType', type: 'select' }, 'full_body');
  vm.updateAdvancedFieldValue('runway_video', { key: 'backgroundType', type: 'select' }, 'runway');

  setTimeout(function () {
    var params = vm.chainState.draftTask.input.params;
    console.log('[manual:advanced-alias:runway]', {
      optionPrompt: params.advancedOptionPrompts && params.advancedOptionPrompts.runway_video,
      optionPromptSummary: params.optionPromptSummary
    });
  }, 300);
}, 300);
```

预期：
- `optionPrompt` 包含“时长：10秒”。
- `optionPrompt` 包含“动作：自然走秀”。
- `optionPrompt` 包含“镜头：全身”。
- `optionPrompt` 包含“背景：T台”。

### 2. pattern_adjustment alias

```js
wx.redirectTo({ url: '/pages/upload/upload?entryScene=hot_style_remix' });

setTimeout(function () {
  var page = getCurrentPages().slice(-1)[0];
  var vm = page && (page.$vm || page);

  vm.updateAdvancedFieldValue('pattern_adjustment', { key: 'neckType', type: 'select' }, 'v_neck');
  vm.updateAdvancedFieldValue('pattern_adjustment', { key: 'sleeveType', type: 'select' }, 'short_sleeve');
  vm.updateAdvancedFieldValue('pattern_adjustment', { key: 'fitType', type: 'select' }, 'slim');

  setTimeout(function () {
    var params = vm.chainState.draftTask.input.params;
    console.log('[manual:advanced-alias:pattern]', {
      optionPrompt: params.advancedOptionPrompts && params.advancedOptionPrompts.pattern_adjustment,
      optionPromptSummary: params.optionPromptSummary
    });
  }, 300);
}, 300);
```

预期：
- `optionPrompt` 包含“领口：V领”。
- `optionPrompt` 包含“袖型：短袖”。
- `optionPrompt` 包含“版型：修身”。

### 3. image_to_sketch boolean alias

```js
wx.redirectTo({ url: '/pages/upload/upload?entryScene=image_to_sketch' });

setTimeout(function () {
  var page = getCurrentPages().slice(-1)[0];
  var vm = page && (page.$vm || page);

  vm.updateAdvancedFieldValue('image_to_sketch', { key: 'sketchLevel', type: 'select' }, 'precise');
  vm.updateAdvancedFieldValue('image_to_sketch', { key: 'includeLabels', type: 'switch' }, true);
  vm.updateAdvancedFieldValue('image_to_sketch', { key: 'includeCraftNotes', type: 'switch' }, false);

  setTimeout(function () {
    var params = vm.chainState.draftTask.input.params;
    console.log('[manual:advanced-alias:sketch]', {
      optionPrompt: params.advancedOptionPrompts && params.advancedOptionPrompts.image_to_sketch,
      optionPromptSummary: params.optionPromptSummary
    });
  }, 300);
}, 300);
```

预期：
- `optionPrompt` 包含“线稿精度：精细”。
- `optionPrompt` 包含“是否标注结构：是”。
- `optionPrompt` 包含“是否生成参考工艺说明：否”。

代码检查预期：
- `advancedPromptRules.js` 只导出 `buildAdvancedPromptSummary` 作为主汇总入口。
- `upload.vue` 不包含单独的 `buildAdvancedPromptPayload` 方法。
## P4 Provider Prompt Adapter 占位验收

本阶段只验证 `ai_generate` 内部 Provider Prompt Adapter 是否能把业务参数和 `fullAdvancedPromptSummary` 转成 provider prompt meta，不调用真实万相 API，不返回完整 prompt 原文。

### fabricReplace provider prompt smoke

```js
wx.cloud.callFunction({
  name: 'ai_generate',
  data: {
    action: 'fabricReplace',
    entryScene: 'fabric_replace',
    templateType: 'fabric_replace',
    costActionType: 'fabric_replace',
    styleCode: 'follow_original_style',
    sceneCode: 'plain_background',
    bodyType: 'standard',
    sourceTaskId: 'manual_provider_prompt_' + Date.now(),
    sourceImageUrl: 'https://example.com/mock-source.jpg',
    fabricType: 'denim',
    idempotencyKey: 'manual_provider_prompt_' + Date.now(),
    advancedPanelValues: {
      fabric_texture: {
        fabricType: 'denim',
        fabricColor: 'keep_original',
        textureStrength: 'strong',
        replaceScope: 'whole_garment',
        customPrompt: '水洗牛仔，轻微做旧，保留原版褶皱和版型'
      }
    },
    advancedCustomPrompts: {
      fabric_texture: '水洗牛仔，轻微做旧，保留原版褶皱和版型'
    },
    advancedOptionPrompts: {
      fabric_texture: '面料：牛仔；面料颜色：保留原色；质感强度：强；替换范围：整衣'
    },
    customPromptSummary: '[fabric_texture] 水洗牛仔，轻微做旧，保留原版褶皱和版型',
    optionPromptSummary: '[fabric_texture] 面料：牛仔；面料颜色：保留原色；质感强度：强；替换范围：整衣',
    fullAdvancedPromptSummary: '[fabric_texture] 面料：牛仔；面料颜色：保留原色；质感强度：强；替换范围：整衣\n[fabric_texture 补充需求] 水洗牛仔，轻微做旧，保留原版褶皱和版型'
  }
}).then(function(res) {
  console.log('[manual:p4-provider-prompt]', JSON.stringify({
    success: res.result && res.result.success,
    ok: res.result && res.result.ok,
    action: res.result && res.result.action,
    providerPromptMeta: res.result && res.result.data && res.result.data.providerPromptMeta,
    advancedPromptMeta: res.result && res.result.data && res.result.data.advancedPromptMeta
  }, null, 2));
}).catch(console.error);
```

预期：
- `success === true`
- `providerPromptMeta.providerTaskType === 'image_edit_fabric_replace'`
- `providerPromptMeta.hasFullAdvancedPromptSummary === true`
- `providerPromptMeta.fullAdvancedPromptSummaryLength > 0`
- `providerPromptMeta.positivePromptLength > 0`
- `providerPromptMeta.negativePromptLength > 0`
- 返回结果不包含完整 `positivePrompt` / `negativePrompt`

日志预期：
- 看到 `[ai_generate:provider-prompt] built`
- 日志只包含 `providerTaskType`、`costActionType`、长度和布尔摘要
- 不打印完整 prompt、图片 URL、fileID、API key、endpoint 原文
## P5 高级提示词链路日志与 smoke 覆盖收口

### P5 smoke JSON 规范

```json
{
  "task": "P5 高级提示词链路日志与 smoke 覆盖收口",
  "scope": "Upload -> generateResult -> ai_generate -> providerPromptAdapter -> Result",
  "fields": [
    "advancedPanelValues",
    "advancedCustomPrompts",
    "advancedOptionPrompts",
    "customPromptSummary",
    "optionPromptSummary",
    "fullAdvancedPromptSummary",
    "costActionType",
    "advancedPromptMeta",
    "providerPromptMeta"
  ],
  "requiredLogs": {
    "upload": "[upload:generate-advanced-prompt] prepared",
    "generateResult": "[generateResult] advanced prompt summary",
    "aiGenerate": "[ai_generate:provider-prompt] built",
    "resultConsume": "[result:ai-points] consumed"
  },
  "safetyRules": {
    "allowLog": [
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
      "pointsAfter"
    ],
    "forbidLog": [
      "完整 customPrompt",
      "完整 positivePrompt",
      "完整 negativePrompt",
      "完整 fullAdvancedPromptSummary",
      "图片 URL",
      "fileID",
      "localPath",
      "API key",
      "endpoint 原文"
    ]
  },
  "panelCases": {
    "fabric_replace": {
      "entryScene": "fabric_replace",
      "panelKey": "fabric_texture",
      "values": {
        "fabricType": "denim",
        "fabricColor": "keep_original",
        "textureStrength": "strong",
        "replaceScope": "whole_garment",
        "customPrompt": "水洗牛仔，轻微做旧，保留原版褶皱和版型"
      },
      "expectedCostActionType": "fabric_replace",
      "expectedProviderTaskType": "image_edit_fabric_replace"
    },
    "runway_video": {
      "entryScene": "runway_video",
      "panelKey": "runway_video",
      "values": {
        "durationSec": 10,
        "motionType": "natural_walk",
        "cameraType": "full_body",
        "backgroundType": "runway"
      },
      "expectedCostActionType": "runway_video_10s",
      "expectedProviderTaskType": "image_to_runway_video"
    },
    "hot_style_remix": {
      "entryScene": "hot_style_remix",
      "panelKey": "pattern_adjustment",
      "values": {
        "neckType": "v_neck",
        "sleeveType": "short_sleeve",
        "fitType": "slim",
        "customPrompt": "圆领改V领，衣长略短，腰线略收"
      },
      "expectedCostActionType": "hot_style_remix",
      "expectedProviderTaskType": "style_remix_image"
    },
    "image_to_sketch": {
      "entryScene": "image_to_sketch",
      "panelKey": "image_to_sketch",
      "values": {
        "sketchLevel": "precise",
        "includeLabels": true,
        "includeCraftNotes": false
      },
      "expectedCostActionType": "image_to_sketch",
      "expectedProviderTaskType": "image_to_structure_sketch"
    }
  },
  "acceptance": [
    "Upload 生成前打印 [upload:generate-advanced-prompt] prepared",
    "generateResult 打印 [generateResult] advanced prompt summary",
    "ai_generate 打印 [ai_generate:provider-prompt] built",
    "Result 扣点打印 [result:ai-points] consumed",
    "Upload / generateResult / ai_generate / Result 日志均不打印完整 prompt",
    "ai_generate mock/fallback 返回 advancedPromptMeta 和 providerPromptMeta",
    "不调用真实 API",
    "不影响主生成链路"
  ]
}
```

### 脚本 1：fabric_replace Upload -> startGenerate

```js
wx.redirectTo({ url: '/pages/upload/upload?entryScene=fabric_replace' });

setTimeout(function () {
  var page = getCurrentPages().slice(-1)[0];
  var vm = page && (page.$vm || page);

  vm.updateAdvancedFieldValue('fabric_texture', { key: 'fabricType', type: 'select' }, 'denim');
  vm.updateAdvancedFieldValue('fabric_texture', { key: 'fabricColor', type: 'select' }, 'keep_original');
  vm.updateAdvancedFieldValue('fabric_texture', { key: 'textureStrength', type: 'select' }, 'strong');
  vm.updateAdvancedFieldValue('fabric_texture', { key: 'replaceScope', type: 'select' }, 'whole_garment');
  vm.updateAdvancedFieldValue('fabric_texture', { key: 'customPrompt', type: 'textarea' }, '水洗牛仔，轻微做旧，保留原版褶皱和版型');

  setTimeout(function () {
    var params = vm.chainState.draftTask.input.params;

    console.log('[manual:p5:fabric-before-generate]', {
      entryScene: vm.entryScene,
      templateType: vm.templateType,
      costActionType: params.costActionType,
      hasAdvancedPanelValues: !!params.advancedPanelValues,
      advancedCustomPromptCount: Object.keys(params.advancedCustomPrompts || {}).length,
      advancedOptionPromptCount: Object.keys(params.advancedOptionPrompts || {}).length,
      customPromptSummaryLength: (params.customPromptSummary || '').length,
      optionPromptSummaryLength: (params.optionPromptSummary || '').length,
      fullAdvancedPromptSummaryLength: (params.fullAdvancedPromptSummary || '').length
    });

    vm.startGenerate && vm.startGenerate();
  }, 300);
}, 300);
```

预期：
- `[upload:generate-advanced-prompt] prepared`
- `[generateResult] advanced prompt summary`
- `[ai_generate:provider-prompt] built`
- `[generateResult] cloud response result`
- `result.data.advancedPromptMeta` 有 count/length/costActionType
- `result.data.providerPromptMeta` 有 providerTaskType/length/count/costActionType

### 脚本 2：runway_video durationSec -> runway_video_10s

```js
wx.redirectTo({ url: '/pages/upload/upload?entryScene=runway_video' });

setTimeout(function () {
  var page = getCurrentPages().slice(-1)[0];
  var vm = page && (page.$vm || page);

  vm.updateAdvancedFieldValue('runway_video', { key: 'durationSec', type: 'select' }, 10);
  vm.updateAdvancedFieldValue('runway_video', { key: 'motionType', type: 'select' }, 'natural_walk');
  vm.updateAdvancedFieldValue('runway_video', { key: 'cameraType', type: 'select' }, 'full_body');
  vm.updateAdvancedFieldValue('runway_video', { key: 'backgroundType', type: 'select' }, 'runway');

  setTimeout(function () {
    var params = vm.chainState.draftTask.input.params;
    console.log('[manual:p5:runway]', {
      entryScene: vm.entryScene,
      templateType: vm.templateType,
      costActionType: params.costActionType,
      advancedOptionPromptCount: Object.keys(params.advancedOptionPrompts || {}).length,
      optionPromptLength: (params.advancedOptionPrompts && params.advancedOptionPrompts.runway_video || '').length,
      fullAdvancedPromptSummaryLength: (params.fullAdvancedPromptSummary || '').length
    });
  }, 300);
}, 300);
```

预期：`costActionType = runway_video_10s`，`fullAdvancedPromptSummaryLength > 0`，不打印完整 prompt。

### 脚本 3：hot_style_remix / pattern_adjustment

```js
wx.redirectTo({ url: '/pages/upload/upload?entryScene=hot_style_remix' });

setTimeout(function () {
  var page = getCurrentPages().slice(-1)[0];
  var vm = page && (page.$vm || page);

  vm.updateAdvancedFieldValue('pattern_adjustment', { key: 'neckType', type: 'select' }, 'v_neck');
  vm.updateAdvancedFieldValue('pattern_adjustment', { key: 'sleeveType', type: 'select' }, 'short_sleeve');
  vm.updateAdvancedFieldValue('pattern_adjustment', { key: 'fitType', type: 'select' }, 'slim');
  vm.updateAdvancedFieldValue('pattern_adjustment', { key: 'customPrompt', type: 'textarea' }, '圆领改V领，衣长略短，腰线略收');

  setTimeout(function () {
    var params = vm.chainState.draftTask.input.params;
    console.log('[manual:p5:pattern]', {
      entryScene: vm.entryScene,
      templateType: vm.templateType,
      costActionType: params.costActionType,
      advancedCustomPromptCount: Object.keys(params.advancedCustomPrompts || {}).length,
      advancedOptionPromptCount: Object.keys(params.advancedOptionPrompts || {}).length,
      fullAdvancedPromptSummaryLength: (params.fullAdvancedPromptSummary || '').length
    });
  }, 300);
}, 300);
```

预期：`costActionType = hot_style_remix`，`fullAdvancedPromptSummaryLength > 0`，不打印完整 prompt。

### 脚本 4：image_to_sketch

```js
wx.redirectTo({ url: '/pages/upload/upload?entryScene=image_to_sketch' });

setTimeout(function () {
  var page = getCurrentPages().slice(-1)[0];
  var vm = page && (page.$vm || page);

  vm.updateAdvancedFieldValue('image_to_sketch', { key: 'sketchLevel', type: 'select' }, 'precise');
  vm.updateAdvancedFieldValue('image_to_sketch', { key: 'includeLabels', type: 'switch' }, true);
  vm.updateAdvancedFieldValue('image_to_sketch', { key: 'includeCraftNotes', type: 'switch' }, false);

  setTimeout(function () {
    var params = vm.chainState.draftTask.input.params;
    console.log('[manual:p5:image-to-sketch]', {
      entryScene: vm.entryScene,
      templateType: vm.templateType,
      costActionType: params.costActionType,
      advancedOptionPromptCount: Object.keys(params.advancedOptionPrompts || {}).length,
      optionPromptSummaryLength: (params.optionPromptSummary || '').length,
      fullAdvancedPromptSummaryLength: (params.fullAdvancedPromptSummary || '').length
    });
  }, 300);
}, 300);
```

预期：`costActionType = image_to_sketch`，`optionPromptSummaryLength > 0`，不打印完整 prompt。

### 脚本 5：Result 页扣点日志

```js
wx.redirectTo({ url: '/pages/result/result?taskId=mock_generate_1780628774691' });

setTimeout(function () {
  var page = getCurrentPages().slice(-1)[0];
  var vm = page && (page.$vm || page);

  Promise.resolve(
    vm.handleConsumeForAction && vm.handleConsumeForAction('fabric_replace')
  ).then(function (res) {
    console.log('[manual:p5:consume-result]', {
      ok: res && res.ok,
      rawActionType: res && res.rawActionType,
      costActionType: res && res.costActionType,
      pointsConsumed: res && res.pointsConsumed,
      pointsBefore: res && res.pointsBefore,
      pointsAfter: res && res.pointsAfter
    });
  });
}, 500);
```

预期：`[result:ai-points] consumed`，`costActionType = fabric_replace`，`pointsConsumed > 0`，不打印图片 URL/fileID/localPath。

### 脚本 6：Result 页二次加工 action

```js
setTimeout(function () {
  var page = getCurrentPages().slice(-1)[0];
  var vm = page && (page.$vm || page);

  vm.handleExtensionAction && vm.handleExtensionAction('fabric_replace', {
    fabricType: 'cotton_linen'
  });

  setTimeout(function () {
    var latest = vm.extensionResults && vm.extensionResults[0];
    console.log('[manual:p5:extension-result]', {
      actionType: latest && latest.actionType,
      status: latest && latest.status,
      sourceIsMockOrFallback: latest && latest.sourceIsMockOrFallback,
      pointsConsumed: latest && latest.pointsConsumed,
      hasPreviewUrl: !!(latest && latest.previewUrl)
    });
  }, 500);
}, 1000);
```

预期：extensionResult 创建成功；mock/fallback 不扣正式额度；不打印图片 URL/fileID/localPath。

### P5 安全验收

允许打印：长度、count、布尔值、panelKey、字段 key、costActionType、entryScene、templateType、providerTaskType、pointsConsumed、pointsBefore、pointsAfter。

禁止打印：完整 prompt、positivePrompt、negativePrompt、fullAdvancedPromptSummary、图片 URL、fileID、localPath、API key、endpoint 原文。

## P6 审查问题最小修复验收

### 1. 真实 provider 禁用验收

边界：即使云函数环境变量 `AI_PROVIDER=real`，只要 `ENABLE_REAL_PROVIDER_CALL` 未显式设置为 `true`，`ai_generate` 不得请求真实 endpoint。

```js
wx.cloud.callFunction({
  name: 'ai_generate',
  data: {
    action: 'generateResult',
    payload: {
      taskId: 'manual_p6_real_disabled_' + Date.now(),
      modelType: 'female',
      scene: 'white',
      costActionType: 'ai_model_image'
    }
  }
}).then(function (res) {
  var result = res && res.result;
  var data = result && result.data;
  console.log('[manual:p6:real-provider-disabled]', {
    success: result && result.success,
    ok: result && result.ok,
    provider: data && data.provider,
    mock: data && data.mock,
    fallback: data && data.fallback,
    fallbackErrorCode: data && data.fallbackErrorCode,
    errorCode: result && result.errorCode
  });
}).catch(console.error);
```

预期：`AI_PROVIDER=real` 且 `ENABLE_REAL_PROVIDER_CALL` 未开启时，应返回 `REAL_PROVIDER_DISABLED` 或 fallback mock；不出现 endpoint 原文、API key、图片 URL、fileID、localPath。

### 2. generate.js 安全日志验收

执行任意一次 Upload 生成后，预期只看到：

- `[generateResult] cloud response raw summary`
- `[generateResult] cloud response result summary`

不应再看到旧日志 `[generateResult] cloud response raw` / `[generateResult] cloud response result` 打印整包对象。
日志中不应出现完整 `resultImageUrl`、`result_image_url`、`fullAdvancedPromptSummary`、`customPromptSummary`、`positivePrompt`、`negativePrompt`、endpoint 或 API key。

### 3. Result WXSS selector 验收

命令行检查：

```bash
rg "\[disabled\]" pages/result/result.vue
```

预期：不再出现 `.extension-action-btn[disabled]` 或 `.action-btn[disabled]` 样式选择器。按钮仍保留 `disabled` 属性，并通过 `is-disabled` class 控制禁用态样式。

### 4. 原核心入口 costActionType 验收

逐个进入原核心入口：

```js
wx.redirectTo({ url: '/pages/upload/upload?entryScene=ecommerce_main' });

setTimeout(function () {
  var page = getCurrentPages().slice(-1)[0];
  var vm = page && (page.$vm || page);
  var params = vm && vm.chainState && vm.chainState.draftTask && vm.chainState.draftTask.input && vm.chainState.draftTask.input.params;
  console.log('[manual:p6:core-entry-cost]', {
    route: page && page.route,
    entryScene: vm && vm.entryScene,
    templateType: vm && vm.templateType,
    taskType: params && params.taskType,
    costActionType: params && params.costActionType
  });
}, 300);
```

将 `entryScene` 替换为：

- `ecommerce_main`
- `xiaohongshu_seed`
- `cross_border_white`
- `new_arrival`
- `batch_model`

预期：`taskType=ai_model_image`，`costActionType=ai_model_image`，不为空且不是 unknown。

### 5. aiPointCost strict 验收

开发侧检查：

```js
// getAiPointCostStrict('fabric_replace')
// 预期：{ ok: true, costValue: 2, reason: '', reasonText: '' }

// getAiPointCostStrict('unknown_p6_action')
// 预期：{ ok: false, costValue: 0, reason: 'unknown_action_type', reasonText: '未知扣点类型' }
```

说明：兼容旧 `getAiPointCost(actionType)` 行为，未知 actionType 仍返回 0；真实扣点前应使用 `costActionType` + strict 校验，云端 `quota_guard` 仍是最终强校验。

## P6 安全修复复验 smoke

本节用于复验 P6 安全修复是否真实生效；只验证 mock/fallback 与日志摘要，不启用真实 provider。

### Smoke 1：真实 provider 禁用复验

云函数环境或本地模拟设置：

- `AI_PROVIDER=real`
- `ENABLE_REAL_PROVIDER_CALL` 不设置，或设置为非 `true`

先检查配置摘要：

```js
wx.cloud.callFunction({
  name: 'ai_generate',
  data: {
    action: 'debugConfig'
  }
}).then(function(res) {
  console.log('[manual:p6:debug-config]', JSON.stringify({
    success: res.result && res.result.success,
    action: res.result && res.result.action,
    provider: res.result && res.result.data && res.result.data.provider,
    enableRealProviderCall: res.result && res.result.data && res.result.data.enableRealProviderCall,
    hasEndpoint: res.result && res.result.data && res.result.data.hasEndpoint,
    hasApiKey: res.result && res.result.data && res.result.data.hasApiKey,
    fabricReplaceProvider: res.result && res.result.data && res.result.data.fabricReplaceProvider,
    hasFabricReplaceEndpoint: res.result && res.result.data && res.result.data.hasFabricReplaceEndpoint,
    hasFabricReplaceApiKey: res.result && res.result.data && res.result.data.hasFabricReplaceApiKey
  }, null, 2));
}).catch(console.error);
```

预期：

- `success=true`
- `enableRealProviderCall=false`
- 只返回 `hasEndpoint/hasApiKey` 布尔值
- 不返回 endpoint 原文
- 不返回 API key 原文

再调用 `fabricReplace`：

```js
wx.cloud.callFunction({
  name: 'ai_generate',
  data: {
    action: 'fabricReplace',
    sourceTaskId: 'manual_p6_' + Date.now(),
    sourceImageUrl: 'https://example.com/mock-source.jpg',
    fabricType: 'denim',
    idempotencyKey: 'manual_p6_' + Date.now(),
    costActionType: 'fabric_replace'
  }
}).then(function(res) {
  console.log('[manual:p6:real-provider-disabled]', JSON.stringify({
    success: res.result && res.result.success,
    ok: res.result && res.result.ok,
    errorCode: res.result && (res.result.errorCode || res.result.code),
    message: res.result && res.result.message,
    provider: res.result && res.result.data && res.result.data.provider,
    mock: res.result && res.result.data && res.result.data.mock,
    fallback: res.result && res.result.data && res.result.data.fallback,
    providerPromptMeta: res.result && res.result.data && res.result.data.providerPromptMeta
  }, null, 2));
}).catch(console.error);
```

预期：

- 不请求真实 endpoint
- 若走结构化失败，`errorCode=REAL_PROVIDER_DISABLED`
- 若当前策略走 fallback mock，则 `mock=true` 或 `fallback=true`
- 不打印 endpoint/API key/完整 prompt

### Smoke 2：generate.js 日志脱敏复验

进入 `fabric_replace` upload，写入高级参数并生成：

```js
wx.redirectTo({ url: '/pages/upload/upload?entryScene=fabric_replace' });

setTimeout(function () {
  var page = getCurrentPages().slice(-1)[0];
  var vm = page && (page.$vm || page);

  vm.updateAdvancedFieldValue('fabric_texture', { key: 'fabricType', type: 'select' }, 'denim');
  vm.updateAdvancedFieldValue('fabric_texture', { key: 'textureStrength', type: 'select' }, 'strong');
  vm.updateAdvancedFieldValue('fabric_texture', { key: 'customPrompt', type: 'textarea' }, '水洗牛仔，轻微做旧，保留原版褶皱和版型');

  setTimeout(function () {
    vm.startGenerate && vm.startGenerate();
  }, 300);
}, 300);
```

预期控制台只看到：

- `[generateResult] cloud response raw summary`
- `[generateResult] cloud response result summary`

不应再看到：

- `[generateResult] cloud response raw {完整 response}`
- `[generateResult] cloud response result {完整 result}`
- 完整 `resultImageUrl`
- 完整 `fullAdvancedPromptSummary`
- 完整 `customPrompt`
- endpoint/API key

### Smoke 3：核心入口 costActionType 复验

通用脚本：

```js
function checkEntry(entryScene) {
  wx.redirectTo({ url: '/pages/upload/upload?entryScene=' + entryScene });

  setTimeout(function () {
    var page = getCurrentPages().slice(-1)[0];
    var vm = page && (page.$vm || page);
    var params = vm && vm.chainState && vm.chainState.draftTask && vm.chainState.draftTask.input && vm.chainState.draftTask.input.params;

    console.log('[manual:p6:entry-cost-action]', {
      route: page && page.route,
      entryScene: vm && vm.entryScene,
      templateType: vm && vm.templateType,
      taskType: params && params.taskType,
      costActionType: params && params.costActionType
    });
  }, 500);
}

checkEntry('ecommerce_main');
```

依次替换：

- `ecommerce_main`
- `xiaohongshu_seed`
- `cross_border_white`
- `new_arrival`
- `batch_model`
- `default`

预期：

- `taskType=ai_model_image`
- `costActionType=ai_model_image`
- 不 fallback default，除非入口本来就是 `default`

### Smoke 4：aiPointCost strict 复验

如果 DevTools 可访问模块方法，验证：

```js
// isKnownAiPointActionType('ai_model_image') === true
// getAiPointCostStrict('ai_model_image').ok === true
// getAiPointCostStrict('unknown_xxx').ok === false
// getAiPointCostStrict('unknown_xxx').reason === 'unknown_action_type'
```

如果 DevTools 不能直接 import，则用代码层验收：

```bash
node --check utils/constants/aiPointCost.js
```

预期：

- 已知 action 返回 `ok=true`
- 未知 action 返回 `ok=false`
- `reason=unknown_action_type`
- 云端 `quota_guard` 仍作为最终强校验

## P7 quota_guard 云端强校验落地设计验收

本节验证 P7 只完成云端强校验设计和 real guard 骨架，不启用真实数据库扣减。

### 脚本 1：debugConfig

```js
wx.cloud.callFunction({
  name: 'quota_guard',
  data: { action: 'debugConfig' }
}).then(function(res) {
  console.log('[manual:p7:quota-debug]', JSON.stringify(res.result, null, 2));
}).catch(console.error);
```

预期：

- `ok=true` / `success=true`
- `enableRealQuotaGuard=false`
- `idempotencyRequiredForConsume=true`
- `realModeImplemented=false`
- `supportedActions` 包含 `consumeAiPoints` / `rollbackUsage`
- 不返回敏感信息

### 脚本 2：consume 缺 idempotencyKey

```js
wx.cloud.callFunction({
  name: 'quota_guard',
  data: {
    action: 'consumeAiPoints',
    actionType: 'fabric_replace'
  }
}).then(function(res) {
  console.log('[manual:p7:consume-missing-idempotency]', JSON.stringify(res.result, null, 2));
}).catch(console.error);
```

预期：

- `ok=false`
- `reason=missing_idempotency_key`
- 不进入真实数据库扣减

### 脚本 3：mock consume 有 idempotencyKey

```js
wx.cloud.callFunction({
  name: 'quota_guard',
  data: {
    action: 'consumeAiPoints',
    actionType: 'fabric_replace',
    sourceTaskId: 'manual_p7_' + Date.now(),
    idempotencyKey: 'manual_p7_fabric_' + Date.now()
  }
}).then(function(res) {
  console.log('[manual:p7:consume-mock]', JSON.stringify({
    ok: res.result && res.result.ok,
    costValue: res.result && res.result.data && res.result.data.record && res.result.data.record.costValue,
    status: res.result && res.result.data && res.result.data.record && res.result.data.record.status
  }, null, 2));
}).catch(console.error);
```

预期：

- `ok=true`
- `costValue=2`
- `status=consumed` 或 `intent_recorded`，按当前 mock 规则

### 脚本 4：real guard 未实现边界

当云函数环境变量 `ENABLE_REAL_QUOTA_GUARD=true` 时，任意非 `debugConfig` action 应返回：

- `ok=false`
- `reason=REAL_QUOTA_GUARD_NOT_IMPLEMENTED`
- `realModeImplemented=false`

当前 P7 不启用真实数据库扣减，不接真实支付，不允许用 mock 作为真实商业扣点依据。

## P8 Provider 接入前参数契约验收

本节验证真实 provider 接入前的参数契约、meta 摘要和禁用边界。当前不调用真实 API。

### 脚本 1：debugConfig

```js
wx.cloud.callFunction({
  name: 'ai_generate',
  data: { action: 'debugConfig' }
}).then(function(res) {
  console.log('[manual:p8:debug-config]', JSON.stringify({
    success: res.result && res.result.success,
    provider: res.result && res.result.data && res.result.data.provider,
    enableRealProviderCall: res.result && res.result.data && res.result.data.enableRealProviderCall,
    hasEndpoint: res.result && res.result.data && res.result.data.hasEndpoint,
    hasApiKey: res.result && res.result.data && res.result.data.hasApiKey
  }, null, 2));
}).catch(console.error);
```

预期：

- `enableRealProviderCall=false`
- 不返回 endpoint 原文
- 不返回 API key 原文

### 脚本 2：fabricReplace mock providerPromptMeta

```js
wx.cloud.callFunction({
  name: 'ai_generate',
  data: {
    action: 'fabricReplace',
    sourceTaskId: 'manual_p8_' + Date.now(),
    sourceImageUrl: 'https://example.com/mock-source.jpg',
    fabricType: 'denim',
    idempotencyKey: 'manual_p8_' + Date.now(),
    costActionType: 'fabric_replace',
    fullAdvancedPromptSummary: '[fabric_texture] 面料：牛仔；质感强度：强'
  }
}).then(function(res) {
  console.log('[manual:p8:fabric-provider-contract]', JSON.stringify({
    success: res.result && res.result.success,
    ok: res.result && res.result.ok,
    providerPromptMeta: res.result && res.result.data && res.result.data.providerPromptMeta,
    advancedPromptMeta: res.result && res.result.data && res.result.data.advancedPromptMeta
  }, null, 2));
}).catch(console.error);
```

预期：

- `success=true`
- `providerPromptMeta` 存在
- `providerPromptMeta.providerTaskType=image_edit_fabric_replace`
- `providerPromptMeta.promptVersion` 存在
- 不返回 `positivePrompt` / `negativePrompt` 原文

### 脚本 3：real provider disabled

如果可模拟 `AI_PROVIDER=real` 且 `ENABLE_REAL_PROVIDER_CALL` 未设置为 `true`：

```js
wx.cloud.callFunction({
  name: 'ai_generate',
  data: {
    action: 'generateResult',
    payload: {
      taskId: 'manual_p8_real_disabled_' + Date.now(),
      modelType: 'female',
      scene: 'white',
      costActionType: 'ai_model_image'
    }
  }
}).then(function(res) {
  var result = res && res.result;
  var data = result && result.data;
  console.log('[manual:p8:real-disabled]', JSON.stringify({
    success: result && result.success,
    ok: result && result.ok,
    errorCode: result && (result.errorCode || result.fallbackErrorCode),
    provider: data && data.provider,
    mock: data && data.mock,
    fallback: data && data.fallback,
    providerPromptMeta: data && data.providerPromptMeta
  }, null, 2));
}).catch(console.error);
```

预期：

- `REAL_PROVIDER_DISABLED` 或 fallback mock
- 不请求 endpoint
- provider contract 中应能表达 `providerReceivedRequest=false`，`shouldRollbackQuota=true`
- 不打印 endpoint/API key/prompt 原文/图片 URL

## P9 Provider Contract 本地验证脚本

本节用于在本地 Node 环境验证 provider contract，不依赖微信 DevTools，不发 HTTP 请求。

运行命令：

```bash
npm run smoke:provider-contract
```

也可直接运行：

```bash
node scripts/smoke/provider-contract-smoke.js
```

覆盖场景：

- `fabric_replace` requestPlan / providerTaskType / disabled real provider 校验
- `runway_video_10s` prompt meta 长度和 providerTaskType
- `image_to_sketch` prompt meta 长度和 providerTaskType
- real provider 开启但缺少 quota consumed record 时返回 `REAL_QUOTA_GUARD_REQUIRED`
- provider 已接受异步 task_id 时进入 pending/polling，且不立即 rollback
- 请求提交前参数校验失败时 `shouldRollbackQuota=true`

预期 summary：

```text
[provider-contract-smoke:summary]
{
  "total": 6,
  "passed": 6,
  "failed": 0,
  "rows": [...]
}
```

安全日志要求：

- 只输出 `providerTaskType`、`errorCode`、`shouldRollbackQuota`、`shouldEnterPolling`、`providerAcceptedTask` 等摘要。
- 不输出完整 `positivePrompt`。
- 不输出完整 `negativePrompt`。
- 不输出完整 `fullAdvancedPromptSummary`。
- 不输出完整 `sourceImageUrl`。
- 不输出 endpoint 原文。
- 不输出 API key。

## P10 quota_guard 真实数据库扣点 Alpha 验收

本节用于验证 `quota_guard` 真实数据库扣点 Alpha。默认 `ENABLE_REAL_QUOTA_GUARD=false` 时仍走 mock，不影响当前链路。

### 脚本 1：debugConfig

```js
wx.cloud.callFunction({
  name: 'quota_guard',
  data: { action: 'debugConfig' }
}).then(function(res) {
  console.log('[manual:p10:quota-debug]', JSON.stringify(res.result, null, 2));
}).catch(console.error);
```

预期：

- `enableRealQuotaGuard` 根据环境变量显示。
- `realModeImplemented=true`。
- 默认环境仍 `mock=true` 或 `enableRealQuotaGuard=false`。
- `collections.usage=membership_usage`。
- `collections.records=membership_usage_records`。

### 脚本 2：mock 不受影响

当 `ENABLE_REAL_QUOTA_GUARD=false` 时执行：

```js
wx.cloud.callFunction({
  name: 'quota_guard',
  data: {
    action: 'consumeAiPoints',
    actionType: 'fabric_replace',
    sourceTaskId: 'manual_p10_mock_' + Date.now(),
    idempotencyKey: 'manual_p10_mock_fabric_' + Date.now()
  }
}).then(function(res) {
  console.log('[manual:p10:mock-consume]', JSON.stringify({
    ok: res.result && res.result.ok,
    mock: res.result && res.result.mock,
    status: res.result && res.result.data && res.result.data.record && res.result.data.record.status,
    costValue: res.result && res.result.data && res.result.data.record && res.result.data.record.costValue
  }, null, 2));
}).catch(console.error);
```

预期：保持现有 mock 行为。

### 脚本 3：real 模式 checkAiPoints

当 `ENABLE_REAL_QUOTA_GUARD=true` 时：

```js
wx.cloud.callFunction({
  name: 'quota_guard',
  data: {
    action: 'checkAiPoints',
    actionType: 'fabric_replace'
  }
}).then(function(res) {
  console.log('[manual:p10:real-check-ai]', JSON.stringify({
    ok: res.result && res.result.ok,
    reason: res.result && res.result.reason,
    costValue: res.result && res.result.data && res.result.data.record && res.result.data.record.costValue,
    usage: res.result && res.result.data && res.result.data.usage
  }, null, 2));
}).catch(console.error);
```

预期：

- `ok=true`
- `costValue=2`
- `usage` 存在

### 脚本 4：real consume 幂等

当 `ENABLE_REAL_QUOTA_GUARD=true` 时：

```js
var key = 'manual_p10_fabric_' + Date.now();

wx.cloud.callFunction({
  name: 'quota_guard',
  data: {
    action: 'consumeAiPoints',
    actionType: 'fabric_replace',
    sourceTaskId: 'manual_p10_' + Date.now(),
    idempotencyKey: key
  }
}).then(function(first) {
  console.log('[manual:p10:real-consume:first]', JSON.stringify({
    ok: first.result && first.result.ok,
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
      sourceTaskId: 'manual_p10_retry',
      idempotencyKey: key
    }
  });
}).then(function(second) {
  console.log('[manual:p10:real-consume:second-idempotent]', JSON.stringify({
    ok: second.result && second.result.ok,
    status: second.result && second.result.data && second.result.data.record && second.result.data.record.status,
    costValue: second.result && second.result.data && second.result.data.record && second.result.data.record.costValue,
    beforeValue: second.result && second.result.data && second.result.data.record && second.result.data.record.beforeValue,
    afterValue: second.result && second.result.data && second.result.data.record && second.result.data.record.afterValue
  }, null, 2));
}).catch(console.error);
```

预期：

- 第一次 `status=consumed`。
- 第二次不重复扣点。
- 第二次返回同一 consumed record 或等价幂等结果。

### 脚本 5：缺 idempotencyKey

```js
wx.cloud.callFunction({
  name: 'quota_guard',
  data: {
    action: 'consumeAiPoints',
    actionType: 'fabric_replace',
    sourceTaskId: 'manual_p10_missing_key_' + Date.now()
  }
}).then(function(res) {
  console.log('[manual:p10:missing-idempotency]', JSON.stringify({
    ok: res.result && res.result.ok,
    reason: res.result && res.result.reason
  }, null, 2));
}).catch(console.error);
```

预期：

- `ok=false`
- `reason=missing_idempotency_key`

### P10 边界

- 默认 mock 链路不受影响。
- real Alpha 只支持 AI 点数 check/consume/rollback。
- refine/runway/sample real 模式暂返回未实现。
- 不调用真实 provider。

## P11 ai_generate 真实 provider 前置 quota record 契约验收

本节验证 `ai_generate` 在真实 provider 路径前必须检查 `quota_guard.consumeAiPoints` 的 consumed record。当前仍不启用真实 provider，不调用真实万相 API。

### 脚本 1：debugConfig

```js
wx.cloud.callFunction({
  name: 'ai_generate',
  data: { action: 'debugConfig' }
}).then(function(res) {
  console.log('[manual:p11:debug-config]', JSON.stringify({
    success: res.result && res.result.success,
    provider: res.result && res.result.data && res.result.data.provider,
    enableRealProviderCall: res.result && res.result.data && res.result.data.enableRealProviderCall,
    hasEndpoint: res.result && res.result.data && res.result.data.hasEndpoint,
    hasApiKey: res.result && res.result.data && res.result.data.hasApiKey
  }, null, 2));
}).catch(console.error);
```

预期：
- `enableRealProviderCall=false`
- 不返回 endpoint 原文
- 不返回 API key 原文

### 脚本 2：real provider disabled 仍优先生效

在 `AI_PROVIDER=real` 且 `ENABLE_REAL_PROVIDER_CALL` 未设置为 `true` 时调用：

```js
wx.cloud.callFunction({
  name: 'ai_generate',
  data: {
    action: 'fabricReplace',
    sourceTaskId: 'manual_p11_' + Date.now(),
    sourceImageUrl: 'https://example.com/mock-source.jpg',
    fabricType: 'denim',
    idempotencyKey: 'manual_p11_' + Date.now(),
    costActionType: 'fabric_replace'
  }
}).then(function(res) {
  console.log('[manual:p11:real-disabled]', JSON.stringify({
    success: res.result && res.result.success,
    ok: res.result && res.result.ok,
    errorCode: res.result && (res.result.errorCode || res.result.code),
    message: res.result && res.result.message,
    provider: res.result && res.result.data && res.result.data.provider,
    mock: res.result && res.result.data && res.result.data.mock,
    fallback: res.result && res.result.data && res.result.data.fallback
  }, null, 2));
}).catch(console.error);
```

预期：
- 不请求真实 endpoint
- 返回 `REAL_PROVIDER_DISABLED` 或按当前策略 fallback mock
- 不触发真实 API
- 不打印 endpoint/API key/完整 prompt

### 脚本 3：real provider quota preflight 文档验收

说明：因为 `ENABLE_REAL_PROVIDER_CALL` 默认不能打开，本脚本作为“开关打开后的预期行为”文档验收。

当 `ENABLE_REAL_PROVIDER_CALL=true` 且 `AI_PROVIDER=real`，但未传 `quotaRecordId` / `quotaConsumedRecord` 时，预期：
- `ok=false`
- `errorCode=REAL_QUOTA_GUARD_REQUIRED`
- `providerReceivedRequest=false`
- `providerAcceptedTask=false`
- `shouldRollbackQuota=false`
- 不请求真实 endpoint

如果需要在隔离环境验证，可用如下数据形态调用：

```js
wx.cloud.callFunction({
  name: 'ai_generate',
  data: {
    action: 'generateResult',
    taskId: 'manual_p11_preflight_' + Date.now(),
    costActionType: 'fabric_replace',
    idempotencyKey: 'manual_p11_preflight_' + Date.now()
  }
}).then(function(res) {
  console.log('[manual:p11:quota-preflight-required]', JSON.stringify({
    success: res.result && res.result.success,
    ok: res.result && res.result.ok,
    errorCode: res.result && res.result.errorCode,
    providerReceivedRequest: res.result && res.result.data && res.result.data.providerReceivedRequest,
    providerAcceptedTask: res.result && res.result.data && res.result.data.providerAcceptedTask,
    shouldRollbackQuota: res.result && res.result.data && res.result.data.shouldRollbackQuota
  }, null, 2));
}).catch(console.error);
```

### 脚本 4：mock/fallback 不要求 quota record

```js
wx.cloud.callFunction({
  name: 'ai_generate',
  data: {
    action: 'fabricReplace',
    sourceTaskId: 'manual_p11_mock_' + Date.now(),
    sourceImageUrl: 'https://example.com/mock-source.jpg',
    fabricType: 'denim',
    idempotencyKey: 'manual_p11_mock_' + Date.now(),
    costActionType: 'fabric_replace'
  }
}).then(function(res) {
  console.log('[manual:p11:mock-no-quota-record]', JSON.stringify({
    success: res.result && res.result.success,
    ok: res.result && res.result.ok,
    provider: res.result && res.result.data && res.result.data.provider,
    mock: res.result && res.result.data && res.result.data.mock,
    providerPromptMeta: res.result && res.result.data && res.result.data.providerPromptMeta
  }, null, 2));
}).catch(console.error);
```

预期：
- mock/fallback 可用
- 不要求 `quotaRecordId`
- 不调用真实 API

## P12 真实链路 dryRun 端到端契约验收

本节验证 dryRun 模式下的真实链路契约：`quota consume record -> ai_generate preflight -> real adapter requestPlan -> normalizedProviderResult`。dryRun 不请求真实 endpoint，不返回完整 prompt。

### 脚本 1：debugConfig

```js
wx.cloud.callFunction({
  name: 'ai_generate',
  data: { action: 'debugConfig' }
}).then(function(res) {
  console.log('[manual:p12:debug-config]', JSON.stringify({
    success: res.result && res.result.success,
    provider: res.result && res.result.data && res.result.data.provider,
    enableRealProviderCall: res.result && res.result.data && res.result.data.enableRealProviderCall,
    providerDryRun: res.result && res.result.data && res.result.data.providerDryRun,
    realProviderRequiresQuotaRecord: res.result && res.result.data && res.result.data.realProviderRequiresQuotaRecord
  }, null, 2));
}).catch(console.error);
```

预期：
- `providerDryRun` 按服务端 `PROVIDER_DRY_RUN` 环境变量显示
- `realProviderRequiresQuotaRecord=true`
- 不返回 endpoint/API key 原文

### 脚本 2：dryRun 缺 quotaRecordId

当 `PROVIDER_DRY_RUN=true` 且 `provider=real`，但缺 `quotaRecordId` 时：

```js
wx.cloud.callFunction({
  name: 'ai_generate',
  data: {
    action: 'fabricReplace',
    provider: 'real',
    sourceTaskId: 'manual_p12_missing_quota_' + Date.now(),
    sourceImageUrl: 'https://example.com/mock-source.jpg',
    fabricType: 'denim',
    idempotencyKey: 'manual_p12_missing_quota_' + Date.now(),
    costActionType: 'fabric_replace'
  }
}).then(function(res) {
  console.log('[manual:p12:dry-run-missing-quota]', JSON.stringify({
    success: res.result && res.result.success,
    ok: res.result && res.result.ok,
    errorCode: res.result && res.result.errorCode,
    providerReceivedRequest: res.result && res.result.data && res.result.data.providerReceivedRequest,
    providerAcceptedTask: res.result && res.result.data && res.result.data.providerAcceptedTask,
    shouldRollbackQuota: res.result && res.result.data && res.result.data.shouldRollbackQuota
  }, null, 2));
}).catch(console.error);
```

预期：
- `ok=false`
- `errorCode=REAL_QUOTA_GUARD_REQUIRED`
- `providerReceivedRequest=false`
- `providerAcceptedTask=false`
- 不请求真实 endpoint

### 脚本 3：dryRun with fake consumed quota record

用于本地/开发 smoke，可传 fake consumed record：

```js
wx.cloud.callFunction({
  name: 'ai_generate',
  data: {
    action: 'fabricReplace',
    provider: 'real',
    sourceTaskId: 'manual_p12_' + Date.now(),
    sourceImageUrl: 'https://example.com/mock-source.jpg',
    fabricType: 'denim',
    idempotencyKey: 'manual_p12_' + Date.now(),
    costActionType: 'fabric_replace',
    quotaRecordId: 'manual_quota_record_' + Date.now(),
    quotaRecordStatus: 'consumed',
    fullAdvancedPromptSummary: '[fabric_texture] 面料：牛仔；质感强度：强'
  }
}).then(function(res) {
  console.log('[manual:p12:dry-run]', JSON.stringify({
    success: res.result && res.result.success,
    ok: res.result && res.result.ok,
    errorCode: res.result && res.result.errorCode,
    providerPromptMeta: res.result && res.result.data && res.result.data.providerPromptMeta,
    providerDryRunResult: res.result && res.result.data && res.result.data.providerDryRunResult
  }, null, 2));
}).catch(console.error);
```

预期：
- 不请求真实 endpoint
- `providerDryRunResult.dryRun=true`
- `providerDryRunResult.providerReceivedRequest=false`
- `providerDryRunResult.providerAcceptedTask=false`
- `providerDryRunResult.shouldRollbackQuota=false`
- `providerPromptMeta.providerTaskType=image_edit_fabric_replace`

### 脚本 4：本地 provider contract dryRun

```bash
node scripts/smoke/provider-contract-smoke.js
```

预期：
- summary 中包含 `real provider dryRun requestPlan contract`
- `passed=total`
- 不打印 prompt 原文、图片 URL、endpoint 或 API key

## P12 高级提示词 + real provider dryRun 链路复验

本节复验 `Upload -> generateResult -> ai_generate dryRun -> quota preflight`。注意：缺少 quota consumed record 时只验证 preflight 拦截；要验证 `providerDryRunResult` 成功返回，需要传 fake consumed quota record 或使用本地 contract smoke。

### Smoke JSON 规范

```json
{
  "task": "P12 高级提示词 + real provider dryRun 链路复验",
  "scope": "Upload -> generateResult -> ai_generate dryRun -> quota preflight",
  "fields": [
    "advancedPanelValues",
    "advancedCustomPrompts",
    "advancedOptionPrompts",
    "customPromptSummary",
    "optionPromptSummary",
    "fullAdvancedPromptSummary",
    "costActionType",
    "quotaRecordId",
    "idempotencyKey"
  ],
  "requiredLogs": [
    "[manual:p12-upload]",
    "[generateResult] advanced prompt summary",
    "[ai_generate:provider-dry-run] quota preflight",
    "[ai_generate:provider-dry-run] completed"
  ],
  "safety": {
    "allow": ["length", "count", "boolean", "panelKey", "field key", "costActionType", "entryScene", "templateType", "dryRun status", "providerTaskType"],
    "forbid": ["完整 customPrompt", "完整 fullAdvancedPromptSummary", "positivePrompt", "negativePrompt", "图片 URL", "fileID", "localPath", "API key", "endpoint 原文"]
  }
}
```

### 脚本 5：Upload dryRun 缺 quota preflight

```js
wx.redirectTo({ url: '/pages/upload/upload?entryScene=fabric_replace' });

setTimeout(function () {
  var page = getCurrentPages().slice(-1)[0];
  var vm = page && (page.$vm || page);

  vm.updateAdvancedFieldValue('fabric_texture', { key: 'fabricType', type: 'select' }, 'denim');
  vm.updateAdvancedFieldValue('fabric_texture', { key: 'textureStrength', type: 'select' }, 'strong');
  vm.updateAdvancedFieldValue('fabric_texture', { key: 'customPrompt', type: 'textarea' }, '水洗牛仔，轻微做旧，保留原版褶皱');

  setTimeout(function () {
    var params = vm.chainState.draftTask.input.params;
    console.log('[manual:p12-upload]', {
      entryScene: vm.entryScene,
      templateType: vm.templateType,
      costActionType: params.costActionType,
      advancedCustomPromptCount: Object.keys(params.advancedCustomPrompts || {}).length,
      advancedOptionPromptCount: Object.keys(params.advancedOptionPrompts || {}).length,
      fullAdvancedPromptSummaryLength: (params.fullAdvancedPromptSummary || '').length
    });

    vm.startGenerate && vm.startGenerate({ dryRun: true });
  }, 300);
}, 300);
```

预期：
- `[manual:p12-upload]` 中 `entryScene=fabric_replace`
- `costActionType=fabric_replace`
- `advancedCustomPromptCount >= 1`
- `advancedOptionPromptCount >= 1`
- `fullAdvancedPromptSummaryLength > 0`
- `[generateResult] advanced prompt summary` 只打印 length/count/meta
- `[ai_generate:provider-dry-run] quota preflight` 中 `ok=false`
- `errorCode=REAL_QUOTA_GUARD_REQUIRED`
- 不请求真实 endpoint
- 不打印完整 prompt、图片 URL、endpoint 或 API key

### 脚本 6：dryRun fake consumed record 成功路径

```js
wx.cloud.callFunction({
  name: 'ai_generate',
  data: {
    action: 'fabricReplace',
    provider: 'real',
    dryRun: true,
    sourceTaskId: 'manual_p12_success_' + Date.now(),
    sourceImageUrl: 'https://example.com/mock-source.jpg',
    fabricType: 'denim',
    idempotencyKey: 'manual_p12_success_' + Date.now(),
    costActionType: 'fabric_replace',
    quotaRecordId: 'manual_quota_record_' + Date.now(),
    quotaRecordStatus: 'consumed',
    advancedCustomPrompts: {
      fabric_texture: '水洗牛仔，轻微做旧，保留原版褶皱'
    },
    advancedOptionPrompts: {
      fabric_texture: '面料：牛仔；质感强度：强'
    },
    fullAdvancedPromptSummary: '[fabric_texture] 面料：牛仔；质感强度：强\n[fabric_texture 补充需求] 水洗牛仔，轻微做旧，保留原版褶皱'
  }
}).then(function(res) {
  console.log('[manual:p12-dry-run-success]', JSON.stringify({
    success: res.result && res.result.success,
    ok: res.result && res.result.ok,
    providerPromptMeta: res.result && res.result.data && res.result.data.providerPromptMeta,
    providerDryRunResult: res.result && res.result.data && res.result.data.providerDryRunResult
  }, null, 2));
}).catch(console.error);
```

预期：
- `[ai_generate:provider-dry-run] quota preflight` 中 `ok=true`
- `[ai_generate:provider-dry-run] completed`
- `providerDryRunResult.dryRun=true`
- `providerDryRunResult.status=dry_run`
- `providerDryRunResult.providerReceivedRequest=false`
- `providerDryRunResult.providerAcceptedTask=false`
- `providerDryRunResult.shouldRollbackQuota=false`
- `providerPromptMeta.providerTaskType=image_edit_fabric_replace`
- 不请求真实 endpoint
- 不打印完整 prompt、图片 URL、endpoint 或 API key

## 全链路 smoke 总索引

- P1-P12 全链路汇总：`docs/smoke/full-chain-smoke-summary.md`
- P5 日志链路章节：搜索 `P5 高级提示词链路日志与 smoke 覆盖收口`
- P6 安全修复章节：搜索 `P6 审查问题最小修复验收` 或 `P6 安全修复复验 smoke`
- P7 quota_guard 章节：搜索 `P7 quota_guard 云端强校验落地设计验收`
- P9 provider-contract-smoke：搜索 `P9 Provider Contract 本地验证脚本`
- P12 dryRun 章节：搜索 `P12 真实链路 dryRun 端到端契约验收` 和 `P12 高级提示词 + real provider dryRun 链路复验`

## P14 quota_guard real Alpha 实机 smoke

详见独立文档：

```text
docs/smoke/quota-guard-real-alpha-smoke.md
```

## P16 Result 页审核信任红线与交付态回滚 smoke

目标：
- mock/fallback/dev mock/provider=mock 任务不能在 Result 页审核通过。
- `needs_revision`、返回、重新生成等非 approved 操作不受影响。
- 本地刚操作的交付态不会被 server 旧的 `pending_review` 覆盖。

### 1. mock/fallback 审核通过拦截

进入 mock/fallback result 页：

```js
wx.redirectTo({ url: '/pages/result/result?taskId=mock_generate_1780628774691' });
```

执行：

```js
setTimeout(function () {
  var page = getCurrentPages().slice(-1)[0];
  var vm = page && (page.$vm || page);
  var before = vm && vm.taskDeliveryStatus;

  vm.markDeliveryApproved && vm.markDeliveryApproved();

  setTimeout(function () {
    console.log('[manual:p16:approve-block-mock]', {
      route: page && page.route,
      before: before,
      after: vm && vm.taskDeliveryStatus,
      isMockOrFallback: vm && vm.isMockOrFallbackTask && vm.isMockOrFallbackTask(vm.currentTaskValue),
      auditExpectation: 'no approve_result audit should be created'
    });
  }, 300);
}, 500);
```

预期：
- toast：`测试图不可审核通过`
- console 出现 `[result:delivery-approve:block-mock-fallback]`
- `deliveryStatus` 不变为 `approved`
- 不新增 `approve_result` 审计记录
- 不触发 approved 云端同步

### 2. reconcile 不回滚本地新交付态

人工构造本地状态：

```js
var page = getCurrentPages().slice(-1)[0];
var vm = page && (page.$vm || page);
var taskId = vm && vm.currentTaskIdValue;
var now = new Date().toISOString();

vm.patchCurrentTaskVisibility && vm.patchCurrentTaskVisibility(taskId, {
  deliveryStatus: 'approved',
  deliveryConfirmedAt: now,
  deliveryUpdatedAt: now,
  localDeliveryUpdatedAt: now,
  pendingDeliverySync: true,
  lastDeliverySyncStatus: 'pending'
});

console.log('[manual:p16:local-before-reconcile]', {
  taskId: taskId,
  deliveryStatus: vm && vm.taskDeliveryStatus,
  localDeliveryUpdatedAt: now
});
```

然后在开发环境临时让 `fetchTaskDeliveryStatus` 返回旧值：

```js
{
  deliveryStatus: 'pending_review',
  deliveryConfirmedAt: '',
  deliveryUpdatedAt: ''
}
```

执行：

```js
vm.reconcileDeliveryStatusFromServer && vm.reconcileDeliveryStatusFromServer();

setTimeout(function () {
  console.log('[manual:p16:local-after-reconcile]', {
    taskId: taskId,
    deliveryStatus: vm && vm.taskDeliveryStatus
  });
}, 800);
```

预期：
- console 出现 `[result:delivery-reconcile] skipped local delivery override`
- `skipReason` 为 `local_pending_sync_newer` 或 `local_user_action_newer_than_server_pending`
- 本地 `deliveryStatus=approved` 不被回滚成 `pending_review`
- 不影响结果图、source image、result image 的恢复逻辑

执行前置条件：

- 仅在开发环境执行。
- 设置云函数环境变量 `ENABLE_REAL_QUOTA_GUARD=true`。
- 不设置 `ENABLE_REAL_PROVIDER_CALL=true`。
- 不调用 `ai_generate` real provider。
- 执行后在 `membership_usage` / `membership_usage_records` 集合检查数据。

覆盖场景：

- `debugConfig` real mode 摘要。
- `getUsageSummary` 创建/读取 usage。
- `checkAiPoints` checked 不扣点。
- `consumeAiPoints` 幂等。
- 缺 `idempotencyKey`。
- unknown `actionType` fail-closed。
- `rollbackUsage` 回滚流水。

P14 完整执行记录模板见：

```text
docs/smoke/quota-guard-real-alpha-smoke.md
```
## P17 quota_guard real Alpha + provider dryRun 联动 smoke

本节用于把 quota_guard real Alpha 与 ai_generate provider dryRun 放在同一组可复验边界中。当前不调用真实 provider，不设置 `ENABLE_REAL_PROVIDER_CALL=true`。

完整 quota real Alpha consume / rollback 脚本见：

```text
docs/smoke/quota-guard-real-alpha-smoke.md
```

### P17 前置条件

- `ENABLE_REAL_PROVIDER_CALL=false` 或未设置。
- `PROVIDER_DRY_RUN=true`，或调用时传 `dryRun: true`。
- quota record smoke 可临时设置 `ENABLE_REAL_QUOTA_GUARD=true`。
- 不配置真实 endpoint；即使配置也不得请求。
- 日志只输出 length/count/boolean/status/errorCode/providerTaskType/costActionType/脱敏 ID。

### 通用脱敏工具

```js
function maskId(value) {
  var text = String(value || '');
  if (!text) return '';
  if (text.length <= 14) return text.slice(0, 4) + '***';
  return text.slice(0, 8) + '***' + text.slice(-6);
}
```

### 场景 A：provider dryRun 缺 quotaRecordId

```js
wx.cloud.callFunction({
  name: 'ai_generate',
  data: {
    action: 'fabricReplace',
    provider: 'real',
    dryRun: true,
    sourceTaskId: 'manual_p17_missing_quota_' + Date.now(),
    sourceImageUrl: 'https://example.com/mock-source.jpg',
    fabricType: 'denim',
    idempotencyKey: 'manual_p17_missing_quota_' + Date.now(),
    costActionType: 'fabric_replace',
    fullAdvancedPromptSummary: '[fabric_texture] option summary only'
  }
}).then(function(res) {
  var result = res.result || {};
  var data = result.data || {};
  console.log('[manual:p17:provider-dryrun-missing-quota]', JSON.stringify({
    success: result.success,
    ok: result.ok,
    errorCode: result.errorCode || result.code,
    provider: data.provider,
    providerReceivedRequest: data.providerReceivedRequest,
    providerAcceptedTask: data.providerAcceptedTask,
    shouldRollbackQuota: data.shouldRollbackQuota,
    hasQuotaRecordId: data.hasQuotaRecordId,
    hasIdempotencyKey: data.hasIdempotencyKey,
    costActionType: data.costActionType,
    hasResultImageUrl: !!(result.resultImageUrl || result.result_image_url)
  }, null, 2));
}).catch(console.error);
```

预期：
- 不请求 endpoint。
- `ok=false` 或 `success=false`。
- `errorCode=REAL_QUOTA_GUARD_REQUIRED`。
- `providerReceivedRequest=false`。
- `providerAcceptedTask=false`。
- 不 fallback 成可交付 mock 图。

### 场景 B：provider dryRun 使用 fake consumed quotaRecordId

可先使用 P17 quota consume 返回的真实 consumed `recordId`，也可在开发 smoke 中使用 fake consumed record：

```js
var quotaRecordId = 'manual_quota_record_' + Date.now();

wx.cloud.callFunction({
  name: 'ai_generate',
  data: {
    action: 'fabricReplace',
    provider: 'real',
    dryRun: true,
    sourceTaskId: 'manual_p17_with_quota_' + Date.now(),
    sourceImageUrl: 'https://example.com/mock-source.jpg',
    fabricType: 'denim',
    idempotencyKey: 'manual_p17_with_quota_' + Date.now(),
    costActionType: 'fabric_replace',
    quotaRecordId: quotaRecordId,
    quotaRecordStatus: 'consumed',
    advancedCustomPrompts: {
      fabric_texture: 'custom prompt exists but should not be logged in full'
    },
    advancedOptionPrompts: {
      fabric_texture: 'option summary exists'
    },
    fullAdvancedPromptSummary: '[fabric_texture] option summary only'
  }
}).then(function(res) {
  var result = res.result || {};
  var data = result.data || {};
  var dry = data.providerDryRunResult || {};
  var meta = data.providerPromptMeta || {};
  console.log('[manual:p17:provider-dryrun-with-quota]', JSON.stringify({
    success: result.success,
    ok: result.ok,
    errorCode: result.errorCode || result.code,
    quotaRecordId: maskId(quotaRecordId),
    providerTaskType: meta.providerTaskType || dry.providerTaskType,
    costActionType: (data.advancedPromptMeta && data.advancedPromptMeta.costActionType) || 'fabric_replace',
    providerDryRun: dry.dryRun,
    status: dry.status,
    providerTaskId: maskId(dry.providerTaskId),
    providerReceivedRequest: dry.providerReceivedRequest,
    providerAcceptedTask: dry.providerAcceptedTask,
    shouldRollbackQuota: dry.shouldRollbackQuota,
    shouldEnterPolling: dry.shouldEnterPolling,
    hasResultImageUrl: !!(result.resultImageUrl || result.result_image_url)
  }, null, 2));
}).catch(console.error);
```

预期：
- 构建 requestPlan / providerPromptMeta。
- `providerDryRun=true`。
- 不请求 endpoint。
- `providerTaskType=image_edit_fabric_replace`。
- `costActionType=fabric_replace`。
- `quotaRecordId` 被透传。
- 不返回完整 prompt，不打印图片 URL。

### 场景 C：accepted async task 不 fallback mock

本地脚本覆盖：

```bash
node scripts/smoke/provider-contract-smoke.js
```

预期：
- `normalize provider accepted async task` 通过。
- 状态为 pending / accepted 类语义。
- `fallback !== true`。
- `provider !== 'mock'`。
- `mock !== true`。
- 不产生 `mock_generate_` taskId。

### P17 日志安全 checklist

禁止输出：
- full customPrompt
- fullAdvancedPromptSummary 全量
- positivePrompt / negativePrompt 全量
- sourceImageUrl / resultImageUrl
- fileID / localPath
- provider endpoint
- API key / Authorization header

允许输出：
- boolean、count、length
- 脱敏后的 taskId / recordId
- providerTaskType、costActionType
- providerDryRun、enableRealQuotaGuard
- status、errorCode、fallbackReason

## P18 真实 provider 开关矩阵与灰度 smoke

前置边界：不要设置 `ENABLE_REAL_PROVIDER_CALL=true` 执行真实请求；本节脚本只读 debugConfig 或做本地组合判断，不请求真实 endpoint。

### 脚本 1：ai_generate debugConfig raw

```js
wx.cloud.callFunction({
  name: 'ai_generate',
  data: { action: 'debugConfig' }
}).then(function(res) {
  var data = (res.result && res.result.data) || {};
  console.log('[manual:p18:ai-debug-config]', JSON.stringify({
    success: !!(res.result && res.result.success),
    provider: data.provider,
    enableRealProviderCall: data.enableRealProviderCall,
    providerDryRun: data.providerDryRun,
    enableRealQuotaGuard: data.enableRealQuotaGuard,
    switchMatrixMode: data.switchMatrixMode,
    switchMatrixAllowed: data.switchMatrixAllowed,
    switchMatrixBlockers: data.switchMatrixBlockers,
    hasEndpoint: data.hasEndpoint,
    hasApiKey: data.hasApiKey,
    timeoutMs: data.timeoutMs,
    retryTimes: data.retryTimes
  }, null, 2));
}).catch(console.error);
```

### 脚本 2：quota_guard debugConfig raw

```js
wx.cloud.callFunction({
  name: 'quota_guard',
  data: { action: 'debugConfig' }
}).then(function(res) {
  var data = (res.result && res.result.data) || {};
  console.log('[manual:p18:quota-debug-config]', JSON.stringify({
    success: !!(res.result && res.result.success),
    ok: !!(res.result && res.result.ok),
    enableRealQuotaGuard: data.enableRealQuotaGuard || res.result.enableRealQuotaGuard,
    realModeImplemented: data.realModeImplemented || res.result.realModeImplemented,
    idempotencyRequiredForConsume: data.idempotencyRequiredForConsume || res.result.idempotencyRequiredForConsume,
    collections: data.collections || res.result.collections,
    supportedActions: data.supportedActions,
    costSource: data.costSource
  }, null, 2));
}).catch(console.error);
```

### 脚本 3：开关组合自检

```js
Promise.all([
  wx.cloud.callFunction({ name: 'ai_generate', data: { action: 'debugConfig' } }),
  wx.cloud.callFunction({ name: 'quota_guard', data: { action: 'debugConfig' } })
]).then(function(list) {
  var ai = (list[0].result && list[0].result.data) || {};
  var quota = (list[1].result && list[1].result.data) || {};
  var enableRealQuotaGuard = !!(quota.enableRealQuotaGuard || ai.enableRealQuotaGuard);
  var providerDryRun = !!ai.providerDryRun;
  var enableRealProviderCall = !!ai.enableRealProviderCall;
  var modeName = 'A_DEFAULT_SAFE_MOCK';
  var allowed = true;
  var reason = 'default safe mock';
  var nextRequiredAction = 'Keep using mock/fallback smoke.';

  if (enableRealQuotaGuard && !providerDryRun && !enableRealProviderCall) {
    modeName = 'B_QUOTA_REAL_ALPHA_ONLY';
    nextRequiredAction = 'Run quota real Alpha consume/rollback smoke only.';
  } else if (enableRealQuotaGuard && providerDryRun && !enableRealProviderCall) {
    modeName = 'C_PROVIDER_DRY_RUN_WITH_REAL_QUOTA';
    nextRequiredAction = 'Run dryRun with consumed quotaRecordId.';
  } else if (!enableRealQuotaGuard && providerDryRun && !enableRealProviderCall) {
    modeName = 'D_BLOCKED_DRY_RUN_WITHOUT_REAL_QUOTA';
    allowed = false;
    reason = 'dryRun requires real quota guard for device smoke';
    nextRequiredAction = 'Enable real quota guard first, or use local contract smoke only.';
  } else if (!enableRealQuotaGuard && !providerDryRun && enableRealProviderCall) {
    modeName = 'E_BLOCKED_REAL_PROVIDER_WITHOUT_REAL_QUOTA';
    allowed = false;
    reason = 'REAL_QUOTA_GUARD_REQUIRED';
    nextRequiredAction = 'Disable real provider and validate real quota guard first.';
  } else if (enableRealQuotaGuard && providerDryRun && enableRealProviderCall) {
    modeName = 'F_BLOCKED_REAL_PROVIDER_AND_DRY_RUN_CONFLICT';
    allowed = false;
    reason = 'PROVIDER_SWITCH_CONFLICT';
    nextRequiredAction = 'Disable either real provider call or dryRun.';
  } else if (enableRealQuotaGuard && !providerDryRun && enableRealProviderCall) {
    modeName = 'G_REAL_PROVIDER_GRAY_ALLOWED';
    reason = 'allowed only after hard checklist passes';
    nextRequiredAction = 'Limit gray run to one account, one action, one image.';
  }

  console.log('[manual:p18:switch-matrix-check]', JSON.stringify({
    modeName: modeName,
    allowed: allowed,
    reason: reason,
    nextRequiredAction: nextRequiredAction,
    enableRealQuotaGuard: enableRealQuotaGuard,
    providerDryRun: providerDryRun,
    enableRealProviderCall: enableRealProviderCall
  }, null, 2));

  if ((enableRealProviderCall && !enableRealQuotaGuard) || (enableRealProviderCall && providerDryRun)) {
    console.error('[manual:p18:switch-matrix:blocked]', JSON.stringify({
      modeName: modeName,
      reason: reason,
      enableRealQuotaGuard: enableRealQuotaGuard,
      providerDryRun: providerDryRun,
      enableRealProviderCall: enableRealProviderCall
    }, null, 2));
  }
}).catch(console.error);
```

### 脚本 4：灰度前最终确认

```js
Promise.all([
  wx.cloud.callFunction({ name: 'ai_generate', data: { action: 'debugConfig' } }),
  wx.cloud.callFunction({ name: 'quota_guard', data: { action: 'debugConfig' } })
]).then(function(list) {
  var ai = (list[0].result && list[0].result.data) || {};
  var quota = (list[1].result && list[1].result.data) || {};
  var blockers = [];
  var hasRealQuotaGuard = !!quota.enableRealQuotaGuard;
  var hasProviderCall = !!ai.enableRealProviderCall;
  var isDryRun = !!ai.providerDryRun;

  if (!hasRealQuotaGuard) blockers.push('ENABLE_REAL_QUOTA_GUARD must be true and database smoke must pass');
  if (isDryRun && hasProviderCall) blockers.push('PROVIDER_SWITCH_CONFLICT');
  if (!hasProviderCall) blockers.push('ENABLE_REAL_PROVIDER_CALL is not enabled; this is safe smoke only');

  console.log('[manual:p18:preflight]', JSON.stringify({
    hasRealQuotaGuard: hasRealQuotaGuard,
    hasProviderCall: hasProviderCall,
    isDryRun: isDryRun,
    canProceedToRealProvider: blockers.length === 0,
    blockers: blockers
  }, null, 2));
}).catch(console.error);
```

日志红线：不要打印完整 prompt、图片 URL、fileID、localPath、endpoint、API key、Authorization 或原始 idempotencyKey。
## P20 开发环境实机 smoke 顺序执行清单

完整 runbook 见：`docs/smoke/p20-devtools-real-alpha-runbook.md`。

执行顺序索引：

1. 阶段 A 默认 mock 安全基线：使用本文件 P18 `ai_generate debugConfig raw`、`quota_guard debugConfig raw` 和既有 Upload mock 生成 smoke。
2. 阶段 B quota real Alpha only：见 `docs/smoke/quota-guard-real-alpha-smoke.md` 的 P17/P14 consume、idempotency、rollback 脚本。
3. 阶段 C finalize 终态验证：见 `docs/smoke/quota-guard-real-alpha-smoke.md` 的 P19 finalize smoke。
4. 阶段 D provider dryRun + quota real Alpha：见本文件 P17/P18 provider dryRun 与 switch matrix 脚本。
5. 阶段 E 禁止组合检查：见本文件 P18 switch matrix 与 preflight 脚本。
6. 阶段 F result / batch-detail 审核红线复验：见 P16 result 审核红线 smoke 和 batch-detail 审核拦截 smoke。

最小入口脚本：

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

阶段完成记录：

```js
(function(stageName, passed, manualNotes) {
  console.log('[manual:p20:stage-checkpoint]', JSON.stringify({
    stageName: stageName,
    passed: !!passed,
    manualNotes: manualNotes || ''
  }, null, 2));
})('阶段 A 默认 mock 安全基线', false, '填写实测摘要，不粘贴敏感日志');
```

## P20 D ai_generate action=generate dryRun 验收

本节用于验证 `action: 'generate'` 已进入生成主流程，并在 `PROVIDER_DRY_RUN=true`、`ENABLE_REAL_PROVIDER_CALL=false` 时只执行 provider dryRun 契约，不请求真实 provider、不生成真实图片。

前置环境：

```text
ENABLE_REAL_QUOTA_GUARD=true
PROVIDER_DRY_RUN=true
ENABLE_REAL_PROVIDER_CALL=false
```

### 脚本：action=generate with consumed quotaRecordId

```js
(function () {
  function maskId(value) {
    var text = String(value || '');
    if (!text) return '';
    return text.length <= 12 ? text.slice(0, 4) + '***' : text.slice(0, 8) + '***' + text.slice(-4);
  }

  var key = 'manual_p20_generate_dryrun_' + Date.now();

  wx.cloud.callFunction({
    name: 'quota_guard',
    data: {
      action: 'consumeAiPoints',
      actionType: 'ai_model_image',
      costActionType: 'ai_model_image',
      sourceTaskId: 'manual_p20_generate_' + Date.now(),
      idempotencyKey: key
    }
  }).then(function(quotaRes) {
    var quotaRecord = quotaRes.result && quotaRes.result.data && quotaRes.result.data.record;
    console.log('[manual:p20-d:quota-consumed]', JSON.stringify({
      ok: !!(quotaRes.result && quotaRes.result.ok),
      recordId: maskId(quotaRecord && quotaRecord.recordId),
      status: quotaRecord && quotaRecord.status,
      costActionType: quotaRecord && quotaRecord.costActionType,
      costValue: quotaRecord && quotaRecord.costValue
    }, null, 2));

    return wx.cloud.callFunction({
      name: 'ai_generate',
      data: {
        action: 'generate',
        taskType: 'model_image',
        costActionType: 'ai_model_image',
        quotaRecordId: quotaRecord && quotaRecord.recordId,
        quotaRecordStatus: 'consumed',
        idempotencyKey: key,
        source: 'manual_p20_dryrun',
        input: {
          prompt: 'manual dryRun prompt',
          imageUrl: 'https://example.com/mock-source.jpg'
        },
        params: {
          outputType: 'main',
          sceneType: 'white'
        }
      }
    });
  }).then(function(aiRes) {
    var result = aiRes.result || {};
    var data = result.data || {};
    var dry = data.providerDryRunResult || {};
    console.log('[manual:p20-d:ai-generate-dryrun]', JSON.stringify({
      success: result.success,
      ok: result.ok,
      providerDryRun: result.providerDryRun || data.providerDryRun,
      enableRealProviderCall: result.enableRealProviderCall,
      switchMatrixMode: result.switchMatrixMode,
      switchMatrixAllowed: result.switchMatrixAllowed,
      quotaRecordId: maskId(result.quotaRecordId || data.quotaRecordId),
      quotaRecordStatus: result.quotaRecordStatus || data.quotaRecordStatus,
      status: result.status,
      hasResultImage: !!result.resultImageUrl,
      providerTaskType: dry.providerTaskType,
      dryRun: dry.dryRun
    }, null, 2));
  }).catch(console.error);
})();
```

预期：

- 不再返回 `unsupported action`。
- `success=true` / `ok=true`。
- `providerDryRun=true`。
- `switchMatrixMode=C_PROVIDER_DRY_RUN_WITH_REAL_QUOTA`。
- `quotaRecordStatus=consumed`。
- `hasResultImage=false`。
- 不请求真实 provider endpoint。
- 不打印 endpoint/API key/prompt 全文/图片 URL。

## P20 DevTools real Alpha smoke 收尾记录

P20 DevTools 实机 smoke 已完成并通过：A 默认 mock、B quota real consume/idempotency/rollback、C finalize 终态、D provider dryRun + quotaRecordId、E 危险组合拦截、Restore 安全恢复。

最终安全环境变量：

```text
ai_generate:
ENABLE_REAL_QUOTA_GUARD=false
PROVIDER_DRY_RUN=false
ENABLE_REAL_PROVIDER_CALL=false

quota_guard:
ENABLE_REAL_QUOTA_GUARD=false
```

最终确认：未开启真实 provider，未调用真实 API，provider dryRun 不生成真实图片。后续进入真实 provider 灰度前，仍必须重新执行 P20 runbook 并确认所有停止条件未触发。
