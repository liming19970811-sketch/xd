# 蝶变微信小程序全链路手工验收 V2

验收日期：2026-07-28

验收范围：AI 生成主链、账户服务、作品管理

验收策略：默认 mock provider，不启用真实额度扣减，不执行真实订单、交付或批量生成

## 1. 安全基线

- 当前分支：`main`。
- 工作区已有大量未提交修改：280 个状态项，其中 150 个含暂存修改、41 个含未暂存修改、114 个未跟踪项。验收过程不得清理、重置或覆盖这些修改。
- `cloudfunctions/ai_generate/utils/config.js` 默认 provider 为 `mock`。
- 只有 `ENABLE_REAL_PROVIDER_CALL=true` 才允许真实 provider 调用。
- `cloudfunctions/quota_guard/index.js` 只有 `ENABLE_REAL_QUOTA_GUARD=true` 才启用真实额度保护；未设置时为关闭。
- `PROVIDER_DRY_RUN` 只有显式设为 `true` 才开启。
- 客户端云调用失败后的本地图片 fallback 在 `utils/api/generate.js` 中默认关闭，不会伪造云调用成功。
- mock/fallback 结果不能审核交付、不能下载为正式结果，也不会进入正式作品统计。
- 本轮不修改云函数、数据库权限、provider、quota、支付或交付配置。

## 2. 自动验收结果

| 检查项 | 结果 | 说明 |
| --- | --- | --- |
| Provider 安全契约 | 通过 | 13/13；真实 provider、真实 quota 和 dry-run 组合保护正常 |
| 全局生成表单统一 Smoke | 通过 | 页面契约、提交锁和生成表单结构正常 |
| 换场景契约 Smoke | 通过 | action 映射、双图参数和失败保护正常 |
| Miniapp release Smoke | 部分通过 | 29/32；源码路由、模板、作品、额度只读和安全检查通过 |
| 作品分页、去重、对象型 result | 通过 | 完成结果可归一，失败及空结果不进入作品 |
| 作品保存偏好 | 通过 | 保存写入现有作品偏好，不创建第二套作品模型 |
| 再次生成 | 通过 | 新 taskId、新 historyId，旧作品保留 |
| 路由与 tabBar | 通过 | 注册页面存在，tabBar 跳转方式正确，无旧结果页路径 |
| 包体历史基线 | 通过 | 主包约 443.2 KB，总包约 1.20 MB，最大分包约 430 KB |

Miniapp release Smoke 的 3 个失败均来自正式构建产物过旧：当前源码晚于 `unpackage/dist/build/mp-weixin`。这不是已确认的业务代码错误，但属于发布阻断。

## 3. 已确认的真实接线

### AI 生成主链

`生产向导 → AI 工作台/上传 → createTaskAndRun → taskLayer → 结果页` 路由均已注册。结果页在隐藏和卸载时停止页面轮询，终态后不继续高频查询；跳转失败不会重新创建任务。

### 账户服务

- 我的作品：`switchTab('/pages/gallery/gallery')`。
- 生产记录：`navigateTo('/package-assets/task-list/task-list')`，支持进行中、已完成、失败筛选。
- 会员中心：`navigateTo('/pages/package-center/package-center')`。
- 额度明细：`navigateTo('/pages/package-center/usage-records')`。
- 企业合作：复用 `pages/service-request/service-request`，存在提交锁和成功状态。
- 联系客服：优先使用微信 `open-type="contact"`，失败后可进入真实服务留言页。
- 设置：`navigateTo('/pages/settings/settings')`。

用户、会员、额度和任务统计均有 loading/error 状态；失败时显示不可用状态，不以硬编码 0 冒充真实数据。入口有快速连点保护和中文跳转失败提示。

### 作品管理

- 数据由现有 task、production history 和 result 归一，不新增作品实体。
- 仅展示当前用户可访问、已完成且存在有效 URL 的结果。
- pending、generating、failed、空结果、mock/fallback、静态占位图不会进入正式作品。
- 支持分页、去重、筛选、预览、收藏、保存偏好、移出本地作品引用和关联生产记录。
- 保存到作品库与保存到系统相册是两条独立操作。
- 图片下载使用 `downloadFile` 或云存储下载，再调用 `saveImageToPhotosAlbum`；拒绝授权时引导打开设置。

## 4. 微信开发者工具手工验收

### 4.1 构建前

1. 保持真实 provider、真实 quota 和 provider dry-run 环境变量未启用。
2. 不上传或部署本轮未修改的云函数。
3. 在 HBuilderX 重新发行 MP-WEIXIN，确认 `unpackage/dist/build/mp-weixin/app.json` 时间晚于 `pages.json` 和本轮修改源码。
4. 将新产物导入微信开发者工具，清缓存并重新编译。
5. 不删除现有云端任务、作品或生产记录；需要隔离时使用新的测试微信账号或新的本地测试任务。

### 4.2 AI 主链

1. 从首页进入一个真实已注册的 AI 能力，确认连续点击只打开一次页面。
2. 在生产向导选择目标并上传一张不含隐私的测试服装图。
3. 检查目标参数、上传预览和返回后表单状态；缺少必填图时不得提交。
4. 点击生成一次，确认按钮立即锁定且只创建一个新任务。
5. 验证等待处理、生成中、完成或失败中文状态；切到后台再返回后状态可恢复。
6. 失败时使用生产记录中的失败重试；确认创建新 taskId，旧失败任务仍在。
7. 已完成任务再次执行时确认创建新 historyId，旧生产记录不被覆盖。
8. mock/fallback 结果必须带体验提示，不能审核交付、不能作为正式作品或正式下载。

### 4.3 结果、作品与相册

1. 对已有真实 completed 且有有效 URL 的历史结果点击“保存到作品库”。
2. 进入“作品”Tab，确认作品出现；再次保存不得重复生成作品卡片。
3. 验证类型筛选、20 条分页、图片加载失败占位和详情页返回行为。
4. 从作品详情打开关联生产记录，确认定位到正确记录且页面不显示内部 ID。
5. 点击“保存到系统相册/下载高清图”，分别验收首次授权、允许、拒绝、打开设置和下载失败中文提示。
6. 真机检查相册确实新增图片。开发者工具模拟器不能代替此项。
7. 点击“移出作品中心”，确认仅删除本地引用，不删除云端任务、历史记录或资源。

### 4.4 我的与账户服务

1. 进入“我的”，等待身份、套餐、额度和任务统计加载完成。
2. 模拟加载失败，确认显示“—/暂时无法获取”和重试入口，不显示假昵称、假会员或假额度。
3. 依次快速双击我的作品、生产记录、会员中心、额度明细、企业合作、设置，确认不会重复打开页面。
4. 生产记录分别验证 pending、generating、completed、failed 和 partial_success。
5. 会员中心与“我的”页剩余额度应一致；升级入口只能咨询或提示，不得触发支付。
6. 企业合作连续点击提交只产生一次提交；成功后显示真实成功状态。
7. 客服可用时打开微信客服；不可用时显示明确提示并可进入服务留言。
8. 设置页返回后再次进入“我的”，确认必要状态刷新且无重复请求闪烁。

### 4.5 真机与发布前

1. iOS 与 Android 各完成一次上传、后台切换、结果恢复和相册授权。
2. 检查弱网、断网、云调用失败和轮询超时；不得自动切换真实 provider 或伪造成功。
3. 检查分享路径不携带 token、图片签名地址或用户隐私。
4. 运行 `node scripts/miniapp-release-smoke.js`，要求新正式产物同步检查全部通过。
5. 运行 `node scripts/mp-package-audit.js --root unpackage/dist/build/mp-weixin --label release`，确认无包超过警戒线。
6. 执行 `git diff --check` 后再提交审核。

## 5. 当前阻断与限制

1. **发布阻断：正式 MP-WEIXIN 产物过旧。** 当前环境未发现 HBuilderX CLI，项目也没有本地 `vue-cli-service` 可执行文件，因此本轮不能自动重新编译。
2. 微信云身份、`open-type="contact"`、相册授权、真机文件下载和云函数真实调用必须在微信开发者工具及真机完成。
3. 安全 mock 结果按规则不会进入正式作品中心；作品保存闭环需使用已有真实有效结果验收，不能放宽审核红线来迁就 mock。
4. `utils/quota/quotaSmoke.js` 是会调用真实 quota 云函数的微信运行时脚本，本轮安全策略下不得执行，也不属于 Node 自动测试。

本轮未发现需要修改页面、Repository、Service、taskLayer 或云函数业务代码的确定性阻断。
