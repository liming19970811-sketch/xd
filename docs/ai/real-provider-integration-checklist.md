# 真实 AI Provider 接入准备清单

当前有两条不同验收链路：

- Upload MVP 直生成链路：`upload -> startGenerate -> ai_generate -> result`
- Batch-detail 批次链路：`project/batch-detail -> runBatch`

注意：当前 upload 页 `startGenerate` 是直达 result 页的单图生成链路，不会自动创建 `batchId`。因此在 upload/result 页看到 `batchId: undefined` 是正常现象，不代表真实 provider 输入或上传失败。

## 1. 当前已完成

- `ai_generate` mock provider 可用。
- real provider skeleton 已完成。
- `debugConfig` 可检查 provider / hasEndpoint / hasApiKey / model / timeout。
- `resolveProviderImageUrl` 支持：
  - `https_url`
  - `cloud_temp_url`
- fallback mock 保留。
- mock/fallback 图在 batch-detail 不可审核通过。
- mock/fallback 图在 result 页不可审核通过。
- mock/fallback task 会跳过远端 delivery reconcile。
- batch/task/review 状态链路已收口。
- Upload MVP 直生成链路已确认：
  - `clothImage.hasCloudFileId === true`
  - `source === 'wx_cloud_upload'`
  - `startGenerate` 只触发一次 `generateResult`
  - result 页能显示 source image 和 result image

## 2. 接入真实 API 前必须准备的信息

- `AI_API_ENDPOINT`
- `AI_API_KEY`
- `AI_MODEL`
- 鉴权方式，例如 `Authorization: Bearer`
- 请求 body 示例
- 成功响应示例
- 失败响应示例
- 结果图 URL 字段路径
- 是否同步返回图片
- 是否异步 `task_id + 轮询`
- 费用/扣费规则
- QPS/并发限制
- 图片 URL 输入要求
- 图片结果是否为 HTTPS URL

## 3. 云函数环境变量

- `AI_PROVIDER`
- `AI_MODEL`
- `AI_API_ENDPOINT`
- `AI_API_KEY`
- `AI_REQUEST_TIMEOUT_MS`
- `AI_RETRY_TIMES`
- `AI_RETRY_BASE_DELAY_MS`

说明：

- 未接真实 API 时，`AI_PROVIDER` 应设为 `mock`。
- API key 只放云函数环境变量，不能写入代码。
- 只有 endpoint/key/model 确认可用后，才切 `AI_PROVIDER=real`。
- 不要在小程序端暴露 API key。

## 4. 接入顺序

1. 先确认 provider 文档。
2. 填 `AI_API_ENDPOINT / AI_API_KEY / AI_MODEL`。
3. 调用 `debugConfig`，确认 `hasEndpoint=true / hasApiKey=true`。
4. 跑 HTTPS smoke。
5. 跑 `cloud://` smoke。
6. 检查 `resultImageUrl` 是否为真实 provider 返回的 HTTPS 图。
7. 失败时只根据 `fallbackReason / fallbackErrorCode` 修 `real.js`。
8. 不改小程序端页面。
9. 不把 upload/result 页的 `batchId undefined` 当作失败；Upload MVP 直生成链路本来不创建 batch。

## 5. Smoke 脚本

### debugConfig

```js
wx.cloud.callFunction({
  name: 'ai_generate',
  data: { action: 'debugConfig' }
}).then(res => console.log('[manual:debugConfig]', res.result));
```

预期：

- `provider` 为当前云函数实际读取到的 provider。
- 未接真实 API 时建议为 `mock`。
- 准备切 real 前应确认：
  - `hasEndpoint === true`
  - `hasApiKey === true`
  - `model` 为目标模型

### Upload MVP HTTPS/source smoke

Upload MVP 直生成链路只调用 `startGenerate()`，不要连续调用 `startGenerate()` + `runGenerate()`。

```js
var page = getCurrentPages().slice(-1)[0];
var vm = page.$vm || page;
vm.startGenerate();
```

预期：

- 只出现一次 `[generateResult] cloud call start`。
- mock 模式下进入 result 页。
- result 页有 `resultImageUrl`。
- mock/fallback delivery reconcile skipped。

### ai_generate HTTPS smoke

```js
wx.cloud.callFunction({
  name: 'ai_generate',
  data: {
    action: 'generateResult',
    taskId: 'manual_real_https_' + Date.now(),
    modelType: 'female',
    scene: 'white',
    cloth_image: {
      file_url: 'https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?auto=format&fit=crop&w=900&q=80'
    },
    style_image: {
      file_id: '',
      file_url: ''
    }
  }
}).then(res => {
  console.log('[manual:ai_generate:real:https]', res.result);
}).catch(err => {
  console.error('[manual:ai_generate:real:https:failed]', err);
});
```

### ai_generate cloud:// smoke

```js
wx.cloud.callFunction({
  name: 'ai_generate',
  data: {
    action: 'generateResult',
    taskId: 'manual_real_cloud_' + Date.now(),
    modelType: 'female',
    scene: 'white',
    cloth_image: {
      file_id: 'cloud://你的环境ID/你的文件路径.jpg'
    },
    style_image: {
      file_id: '',
      file_url: ''
    }
  }
}).then(res => {
  console.log('[manual:ai_generate:real:cloud]', res.result);
}).catch(err => {
  console.error('[manual:ai_generate:real:cloud:failed]', err);
});
```

## 6. 成功标准

真实 provider 成功时：

- `provider=real`
- `requestedProvider=real`
- `fallback=false`
- `mock=false`
- `resultImageUrl` 是真实 provider 返回的 HTTPS 图片

失败但 fallback 可接受时：

- `provider=mock`
- `requestedProvider=real`
- `fallback=true`
- `fallbackReason` 有值
- `fallbackErrorCode` 有值

Upload MVP mock 链路成功时：

- `clothImage.hasCloudFileId=true`
- `source='wx_cloud_upload'`
- `styleImage` 不干扰 MVP
- 只调用 `startGenerate`
- 只出现一次 `generateResult cloud call start`
- result 页 `hasSourceImage=true / hasResultImage=true`
- `resultImageUrl` 有值
- mock/fallback delivery reconcile skipped
- 不请求 `/api/task/delivery/mock_generate_xxx`

Batch-detail 批次链路成功时：

- 当前页面为 `pages/batch-detail/batch-detail`
- `batchId` 有值
- `relatedTasks` 有值
- 点击 `runBatch()` 后进入 batch run 日志

## 7. 安全红线

- 不打印 API key。
- 不打印完整 endpoint。
- 不打印完整 inputImageUrl。
- 不打印 tempFileURL。
- 不打印 provider 原始完整 response。
- 不把 mock/fallback 图当真实图交付。
- mock/fallback 图不能作为真实交付图审核通过。
- 不在客户端暴露 API key。
- 不把临时 `*.tcb.qcloud.la?...sign=...` URL 当长期稳定图片地址。

## 8. 当前建议

当前还未配置真实 API，所以生产/开发默认仍建议：

```text
AI_PROVIDER=mock
```

等确认真实 provider endpoint/key/model 后，再切换：

```text
AI_PROVIDER=real
```

如果希望 upload 生成也进入批次体系，需要单独实现：

- upload `startGenerate` 成功后创建 task/batch snapshot。
- 写入 `batchStore`。
- 调用 `syncAdminBatchToCloud`。
- result 页带 `batchId`。
- batch-detail 可恢复该 task。

在这之前，Upload MVP 直生成链路和 Batch-detail 批次链路应分别验收，不要混用脚本结论。
