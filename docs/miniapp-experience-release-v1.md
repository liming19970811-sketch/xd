# 蝶变小程序体验版发布验收 V1

本流程用于生成和验收 MP-WEIXIN 体验版候选包。它不会自动上传体验版、部署云函数、修改数据库权限、开启真实 Provider、开启真实 quota 或调用支付。

## 1. 本地预检

在项目根目录执行：

```powershell
node scripts/miniapp-experience-preflight.js
node scripts/miniapp-release-smoke.js
node scripts/mp-package-audit.js --root unpackage/dist/build/mp-weixin --report docs/miniapp-package-report-release.md
git diff --check
```

预检报告输出到 `docs/miniapp-experience-preflight-report.md`。任何 `BLOCKED` 都必须先处理；`NOT RUN` 不能改写成通过。

当前安全目标：

```text
realProvider=false
realQuota=false
providerDryRun=false
batchGeneration=false
videoGeneration=false
autoDelivery=false
deliveryApproval=false
mock/fallback 仅用于测试
测试结果禁止正式审核和交付
```

## 2. HBuilderX 正式构建

1. 打开 `C:\Users\1\Desktop\Diebian`，不要打开旧的 `unpackage/dist` 目录作为源码项目。
2. 打开 `manifest.json` 的可视化配置，确认微信小程序 AppID 已配置且与目标体验版一致。只核对是否一致，不在截图或报告中暴露完整值。
3. 确认版本名称和版本号；当前源码值以 `manifest.json` 为准。
4. 确认真实 Provider、真实 quota 和 Provider dry-run 没有在本地或云函数环境中被开启。
5. 选择“发行 → 小程序-微信”。输出目录应为：

   `C:\Users\1\Desktop\Diebian\unpackage\dist\build\mp-weixin`

6. 构建完成后确认 `app.json`、`project.config.json` 和页面文件时间晚于本轮源码。
7. 重新执行第 1 节四条命令；`miniapp-release-smoke` 和包体审计必须通过。

若 HBuilderX 构建失败，记录首个稳定复现的错误并停止，不要复制 `dev/mp-weixin` 冒充正式产物。

## 3. 云函数安全摘要核对

本轮没有云函数代码变更，不要求部署。只有在确认体验环境云函数版本落后时，才手动复制指定云函数到开发产物并在微信开发者工具中右键“上传并部署：云端安装依赖”；不要整目录盲目覆盖。

在微信开发者工具 Console 中仅输出安全摘要：

```js
wx.cloud.callFunction({ name: 'ai_generate', data: { action: 'debugConfig' } })
  .then(({ result = {} }) => console.log('[experience:ai-safe]', {
    provider: result.data && result.data.provider,
    realProvider: result.enableRealProviderCall === true,
    realQuota: result.enableRealQuotaGuard === true,
    providerDryRun: result.providerDryRun === true,
    switchMode: result.switchMatrixMode || ''
  }))
  .catch(() => console.log('[experience:ai-safe]', { checkFailed: true }))
```

期望：`provider=mock`、三个布尔值均为 `false`、`switchMode=A_DEFAULT_SAFE_MOCK`。

```js
wx.cloud.callFunction({ name: 'quota_guard', data: { action: 'debugConfig' } })
  .then(({ result = {} }) => console.log('[experience:quota-safe]', {
    mock: result.mock === true,
    realQuota: result.enableRealQuotaGuard === true
  }))
  .catch(() => console.log('[experience:quota-safe]', { checkFailed: true }))
```

期望：`mock=true`、`realQuota=false`。任一检查失败或结果不符时停止体验版上传。不要打印完整响应、环境变量、OPENID 或凭证。

## 4. 微信开发者工具验收

1. 导入 `C:\Users\1\Desktop\Diebian\unpackage\dist\build\mp-weixin`。
2. 核对项目 AppID、基础库和云开发环境，报告中只记录“匹配/不匹配”。
3. 执行“清除缓存 → 全部清除”，重新编译。
4. 确认首页、作品、我的三个 tab 图标和跳转正确；作品不能复用首页图标。
5. 确认分包首次进入无“页面不存在”或加载失败。
6. 确认正式 MP 不包含 enterprise-web、Cloud Alpha、后台管理和开发诊断页面。
7. 在 Network/Console 检查：没有持续异常、没有真实 Provider 请求、没有真实额度扣减、没有敏感日志。
8. 使用一张不含客户或个人隐私的测试服装图完成单任务 mock 链路。
9. mock/fallback 结果必须显示为测试结果，且“审核通过/正式交付”被拒绝。
10. 批量生成、视频生成、自动交付和交付审批入口必须不可用；如仍可操作，记录为 P0 并停止上传。

## 5. 核心体验链路

按顺序执行并记录 `PASS/FAIL/BLOCKED/NOT RUN`：

1. 首次进入：新手引导仅自动出现一次，跳过或完成后不重复。
2. 首页：核心能力、任务入口、作品入口和我的入口均可达。
3. 上传：选择、预览、删除、重新选择；上传失败时不创建任务。
4. 生成：按钮防连点，只创建一个新任务；状态从等待/生成中进入终态。
5. 失败：中文原因明确，可重试；重试创建新 taskId，旧任务保留。
6. 结果：无有效结果不能显示完成；不显示敏感内部字段。
7. 作品：保存到作品库后可见，再次保存不重复；测试结果不进入正式作品统计。
8. 相册：真机完成首次授权、拒绝、打开设置和再次保存。
9. 分享：路径只携带必要记录标识，不含 Token、签名图片地址或用户隐私。
10. 我的：身份、套餐、额度和任务状态有 loading/error，不用硬编码 0 冒充成功。
11. 会员：升级入口不创建支付订单，不拉起微信支付。
12. 返回与恢复：前后台切换和重新进入后，任务与草稿状态合理恢复。

## 6. 真机验收

至少一台 iOS 和一台 Android；无法覆盖的设备标记 `NOT RUN`。

1. 扫码进入体验版，检查冷启动、tabBar、分包首次加载和返回栈。
2. 使用测试素材完成上传、mock 生成、失败重试、保存作品、相册授权和分享。
3. 切后台 30 秒后返回，确认轮询不会重复创建，终态任务不继续高频轮询。
4. 在 Wi-Fi、移动网络和一次断网恢复场景下检查中文错误与恢复入口。
5. 检查小屏、系统大字体、刘海屏和底部安全区，无按钮遮挡或文字重叠。
6. 确认测试结果不能正式审核、交付、自动下单或触发支付。

禁止使用真实客户图片、真实订单、真实交付记录或批量真实生成。

## 7. 手工上传体验版

仅当本地自动检查、开发者工具和至少一台真机核心链路均无 P0/P1 时执行：

1. 微信开发者工具点击“上传”。
2. 版本号与 `manifest.json` 保持一致，备注包含“体验版、mock provider、真实 quota 关闭”。
3. 登录微信公众平台，在开发管理的开发版本中选择该版本设为体验版。
4. 添加体验成员并扫码复测，不直接提交审核。
5. 上传后不要切换云函数真实 Provider 或真实 quota；任何环境变化都需要重新跑安全摘要检查。

Codex 本轮不会执行以上上传动作。

## 8. 通过标准

- 自动预检无 `BLOCKED`。
- 正式构建晚于源码，路由与 tabBar 同步。
- 主包、分包和总包均低于项目警戒线。
- 云端安全摘要为 mock Provider、真实 quota 关闭、dry-run 关闭。
- 批量、视频、自动交付和交付审批均不可操作。
- mock/fallback 结果无法进入正式审核和交付。
- 开发者工具无持续关键错误。
- 真机核心链路通过，无 P0/P1。

开发者工具、云端环境和真机未执行前，发布结论必须保持 `BLOCKED` 或 `NOT RUN`。
