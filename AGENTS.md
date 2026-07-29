# AGENTS.md｜蝶变项目 Codex 工作规则

## 1. 项目主线

蝶变项目包含三条主线：

- 微信小程序：工具入口、上传、生成、结果、任务列表。
- H5 官网：品牌展示、服务介绍、线索提交。
- 后台/云函数：线索、项目、任务、批次、交付、AI生成、额度。

## 2. 严格区分小程序和官网

- 小程序首页是工具工作台，主要文件：`pages/index/index.vue`。
- 官网落地页是品牌展示和咨询转化，主要文件：`pages/website-demand/website-demand.vue`。
- 修改小程序首页时，禁止修改 `pages/website-demand/website-demand.vue`。
- 修改官网时，禁止修改 `pages/index/index.vue`、`pages/upload/upload.vue`、`pages/result/result.vue` 主链路。

## 3. 云函数安全规则

默认禁止修改：

- `cloudfunctions/ai_generate`
- `cloudfunctions/quota_guard`
- `cloudfunctions/leads_create`

禁止随意开启：

- `ENABLE_REAL_PROVIDER_CALL=true`
- `ENABLE_REAL_QUOTA_GUARD=true`
- `PROVIDER_DRY_RUN=true`

## 4. AI 出图方案生成器规则

相关文件：

- `pages/upload/upload.vue`
- `pages/result/result.vue`
- `utils/api/generate.js`

字段：

- `input.params.promptDraft`
- `input.params.promptPlan`
- `input.params.generationMode`
- `input.params.negativePrompt`
- `input.params.outputUsage`

要求：

- 本地中文 mock 方案。
- 不调用真实 provider。
- 不消耗真实额度。
- 不破坏原上传 → 生成 → 结果流程。

## 5. 结果页审核红线

- mock / fallback 结果不得被直接审核通过交付。
- 不要破坏 `pages/result/result.vue` 审核拦截。

## 6. 每个任务必须先声明

- 本次目标
- 允许修改文件
- 禁止修改文件
- 是否允许改官网
- 是否允许改小程序主链路
- 是否允许改云函数
- 验证方式

## 7. 每次完成必须回复

- 修改了哪些文件
- 改了什么
- 没改什么
- 是否改官网
- 是否改小程序主链路
- 是否改云函数
- 如何预览
- 如何验证
- `git diff --check` 是否通过

## 8. 检查命令

每次修改后至少执行：

```powershell
git diff --check
```

如修改 JS 文件，尽量执行：

```powershell
node --check <file>
```

## 9. 部署规则

- 云函数部署优先使用微信开发者工具右键上传并部署。
- 不默认使用 `tcb`。

## 10. 官网正式域名

正式域名：

- `www.diebiandesign.com`

H5 构建产物目录：

- `unpackage/dist/build/web`

部署时上传 `web` 目录里面的内容，不上传 `web` 文件夹本身。
