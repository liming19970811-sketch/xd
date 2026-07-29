# 蝶变项目 Codex 交接记录

更新时间：2026-07-29  
项目根目录：`C:\Users\1\Desktop\Diebian\xd`

## 1. 当前结论

本轮源码已完成“取消测试模式、统一正式 AI 生成策略、关闭 mock fallback、接通任务与作品保存约束”的改造，并已提交、推送到 `main`。

当前 Git 状态基线：

- 分支：`main`
- 当前提交：`b859665 启用正式AI生成并关闭测试模式`
- 远端：`origin/main` 与当前提交一致
- 写本文档前工作区：干净
- 官网：未修改
- 线上数据库权限：未修改
- 云函数：源码已修改，尚未自动部署
- 真实付费 Canary：`NOT RUN`
- 正式 MP-WEIXIN 构建：`BLOCKED`，当前机器缺少可用的 HBuilderX/完整小程序编译环境

源码状态不能等同于线上状态。云端环境变量、云函数部署版本、Provider 账户配置和真实扣费闭环仍需在微信云开发环境中复验。

## 2. 已完成修改

### 2.1 取消测试模式设计

- 删除或隐藏了测试模式卡片、流程测试/模型效果测试切换、内部测试专用按钮和前台调试面板。
- 去除了 development、experimental 等面向普通用户的测试文案。
- 前台统一使用正式生成语义，不再因“尚未验收”或“高一致性未确认”直接隐藏整个表单。
- 历史 mock/实验作品仍保留不可交付标识，不会被包装成正式结果。

### 2.2 统一正式运行策略

正式运行策略集中在 `utils/runtime/featureRuntimePolicy.js`，当前运行阶段固定为 production。

正式提交仍保留以下必要检查：

- Provider Endpoint 已配置。
- Provider 凭据已配置。
- `taskType` 存在真实 Provider 路由。
- 必填素材完整且已稳定化。
- 真实额度检查通过。
- 当前没有重复提交或正在提交的任务。
- dry run 关闭。
- mock fallback 关闭。

页面禁用时应返回具体原因，不再统一显示“功能暂不可用”。

### 2.3 AI 模特

- 默认替换方式为 `head_replace`（换整头）。
- 用户历史选择优先；历史选择为 `face_replace` 时不会被默认值覆盖。
- 换整头与只换脸映射到独立 `taskType`。
- 原图和身份参考图保留为两个独立图片角色。
- 正式请求不允许降级到随机人物、普通文生图或输入图回显。

### 2.4 正式生成闭环

正式生成公共入口为 `utils/task/generationExecution.js` 中的真实任务创建流程，主云函数路径为 `generate_wanx`。

当前流程：

1. 校验输入和正式运行配置。
2. 真实额度预扣并取得额度记录关联。
3. 创建云端任务。
4. 立即创建状态为 generating 的作品记录。
5. 调用真实 Provider。
6. 将有效结果保存到稳定云存储并建立资产关联。
7. 更新 `task.result.items`。
8. 更新作品的资产、封面和完成数量。
9. 仅在有效结果已保存后更新 completed。
10. 成功终态 finalize；失败或缺少有效结果 rollback。

异步 accepted 只表示处理中，不能直接视为成功。页面退出不应取消云端任务。

### 2.5 状态与作品一致性

- 任务创建后立即创建“生成中”作品，不依赖手动保存。
- 任务结果和作品记录使用同一云端任务数据进行状态同步。
- completed 必须建立在有效 `result.items`、稳定资产和作品关联之上。
- 无有效图片时不得出现 `completed 0/N`，应进入明确失败或结果缺失状态。
- 封面优先使用第一张有效生成结果；生成中或失败时才允许使用输入图辅助展示。
- 多结果任务按独立结果项保存，不用拼图代替结果数量。

### 2.6 Mock 与错误处理

- 已删除 `cloudfunctions/ai_generate/adapters/mock.js`。
- `ai_generate` adapter 只保留真实实现。
- `utils/api/generate.js` 不再返回 dummy、mock 或输入图作为生成结果。
- Provider 失败、能力不匹配、超时或空结果均需返回真实安全错误摘要。
- 未实现的正式路由明确失败并触发额度回滚，不再静默降级。

### 2.7 Provider 能力与路由

- `qwen-image-2.0-pro` 已配置为多图编辑能力，用于身份替换及服装替换相关任务路由。
- 换姿势正式路由已开放进入真实 Provider 校验。
- `generate_wanx` 声明了项目现有 AI 任务类型的支持清单。
- 能进入页面不代表 Provider 已具备对应效果质量；缺少真实路由的功能必须安全失败，不得伪造结果。

### 2.8 额度依赖修复

- 修复了 `quotaFlow` 对 `taskLayer` 的静态循环依赖。
- `settleQuotaByTask` 改为接收任务读取器，避免初始化顺序导致额度终态处理异常。
- 真实结果保存前不得 finalize；失败和结果缺失必须 rollback。

### 2.9 Git 大文件治理

- `ms-playwright_backup/`、`npm-cache_backup/`、`tools_backup/` 已停止 Git 跟踪并加入 `.gitignore`。
- 本地备份未作为本轮业务代码删除对象，仅从版本库排除。
- 已扫描当前历史，未发现大于 50 MB 的 Git blob。
- 当前受跟踪内容约 8.44 MB，不再包含超过 GitHub 单文件限制的 Chromium 二进制。
- Git 远程地址中的历史嵌入式凭据已移除；凭据所有者仍应确认旧凭据已撤销。

## 3. 关键技术决策

### 3.1 单一正式策略

不再维护页面级测试模式分支。前端只消费统一运行策略和云端 `debugConfig` 的非敏感能力摘要，避免不同页面对正式能力作出矛盾判断。

### 3.2 云端是最终可信边界

前端可做体验校验，但 Provider、额度、任务类型、结果有效性和完成状态必须由云端再次确认。前端开关不能替代服务端授权或能力检查。

### 3.3 禁止假成功

以下情况一律不能标记 completed：

- Provider 只返回 success 文案而没有图片。
- 结果仍是临时本地路径。
- 图片未保存到稳定云存储。
- 资产未关联任务和作品。
- 完成数量小于预期数量。
- 结果是 mock、dummy 或输入图回显。

### 3.4 额度终态晚于结果持久化

先保存有效结果、资产和作品关联，再设置完成状态并 finalize。任何失败都不能用 mock 掩盖，也不能把无结果请求确认成成功消费。

### 3.5 Provider 能力按任务隔离

功能入口可以存在，但正式提交必须命中对应任务路由。某个任务类型未实现时，只影响该功能，不应暂停其他已配置功能。

## 4. 云函数与正式配置

### 4.1 涉及云函数

- `cloudfunctions/generate_wanx`
- `cloudfunctions/quota_guard`
- `cloudfunctions/ai_generate`

其中小程序正式生成主路径当前以 `generate_wanx` 为主；`ai_generate` 保留兼容和安全失败逻辑。实际部署前需再次核对前端调用日志确认线上命中的云函数版本。

### 4.2 目标配置

云端需要确认以下配置，文档不记录任何配置值或私密凭据：

| 配置 | 目标状态 | 代码默认/要求 |
|---|---|---|
| `APP_STAGE` | production | production |
| `ENABLE_REAL_PROVIDER_CALL` | true | 默认 true，正式路径要求开启 |
| `ENABLE_REAL_QUOTA_GUARD` | true | 默认 true，正式路径要求开启 |
| `PROVIDER_DRY_RUN` | false | 为 true 时正式请求被阻止 |
| `DISABLE_MOCK_FALLBACK` | true | 正式路径要求为 true |
| Provider Endpoint | 已配置 | 仅通过 `hasEndpoint` 暴露布尔状态 |
| Provider 凭据 | 已配置 | 仅通过 `hasApiKey` 暴露布尔状态 |
| Provider Model | 与路由匹配 | 当前图像编辑目标模型为 `qwen-image-2.0-pro` |
| Poll Endpoint | 异步模型需要时配置 | 仅暴露 `hasPollEndpoint` |

`debugConfig` 只能返回 Provider 名称、模型、布尔能力状态和支持任务类型，不得返回完整 Endpoint、凭据、签名或敏感请求头。

### 4.3 代码中的当前默认状态

- `generate_wanx`：正式 Provider 和真实额度保护默认开启。
- `quota_guard`：真实额度模式默认开启。
- `ai_generate`：默认真实 Provider，mock fallback 默认关闭。
- dry run：正式路径要求关闭。

注意：代码默认值不代表已部署云函数的实际环境值。必须在微信云开发控制台或已部署函数的安全调试接口中复核。

## 5. 测试结果

### 5.1 已通过的静态与本地测试

| 测试 | 结果 |
|---|---|
| `scripts/full-feature-runtime-policy-smoke.js` | PASS |
| `scripts/real-provider-test-channel-smoke.js` | PASS |
| `scripts/testing-stage-capability-smoke.js` | PASS（兼容性脚本名称保留，断言已更新为正式策略） |
| `scripts/full-generation-loop-smoke.js` | PASS，覆盖 13 类生成能力及单图、多图、批次、状态逻辑 |
| `scripts/head-replace-contract-smoke.js` | PASS |
| `scripts/garment-replace-contract-smoke.js` | PASS |
| `scripts/scene-replace-contract-smoke.js` | PASS |
| `scripts/smoke/provider-contract-smoke.js` | PASS，13/13 |
| 云函数关键 JS `node --check` | PASS |
| `git diff --check` | PASS（上次源码修改完成时） |

### 5.2 包体预检

- 主包约 443.2 KB。
- 总包约 1.20 MB。
- 包体本身低于内部预算。
- 发布预检仍为 `BLOCKED`：现有 `unpackage/dist/build/mp-weixin` 构建产物早于源码，属于陈旧产物，不能作为发布验收依据。

### 5.3 未执行测试

| 项目 | 状态 | 原因 |
|---|---|---|
| HBuilderX 正式 MP-WEIXIN 构建 | BLOCKED | 当前环境无可用的完整 HBuilderX 小程序编译链 |
| 微信开发者工具页面回归 | NOT RUN | 需要重新构建后导入开发者工具 |
| 云函数上传部署 | NOT RUN | 按项目边界未自动部署 |
| 单次真实付费 Provider Canary | NOT RUN | 未在本轮安全取得已部署配置、测试素材和授权执行窗口 |
| 真实额度预扣/finalize/rollback | NOT RUN | 依赖已部署云函数和真实 Canary |
| 真机回归 | NOT RUN | 依赖有效体验/开发构建 |

因此，目前不能宣称真实 API 已调用成功、真实额度已扣除或作品已在线上自动生成。

## 6. 未完成事项与风险

### P0：上线前必须完成

1. 使用 HBuilderX 重新构建 MP-WEIXIN，替换陈旧构建产物。
2. 将本轮涉及的云函数源码复制到开发构建目录，并在微信开发者工具中手动上传部署。
3. 在云端确认正式 Provider、真实额度、dry run 和 fallback 的实际环境状态。
4. 执行一次并发数为 1 的真实单图 Canary，验证 Provider、结果持久化、作品关联和额度闭环。
5. 执行一次受控失败 Canary，验证错误分类及 rollback。

### P1：正式发布前复验

1. 验证异步 Provider 请求在页面关闭后仍能由云端继续查询和回写。
2. 验证结果页和“我的作品”无需退出页面即可同步更新。
3. 验证所有开放任务类型均命中真实路由；尚未实现的路由应返回明确错误并退款。
4. 验证普通用户无法看到任何内部配置或敏感调试信息。
5. 验证历史 mock/实验结果仍被禁止正式交付。

### 已知风险

- 云端当前实际配置尚未在本轮读取确认。
- Provider 协议可用性和生成质量尚未通过真实请求验证。
- 某些声明支持的任务类型可能仍缺少对应 Provider 的专用能力；安全策略是失败并退款，而非 fallback。
- 云端异步轮询的持续性尚未通过真实任务证明。
- 当前构建目录为旧产物，不能用于提交审核或体验版验收。

## 7. 主要修改文件

### 云函数

- `cloudfunctions/ai_generate/adapters/index.js`
- `cloudfunctions/ai_generate/adapters/real.js`
- `cloudfunctions/ai_generate/index.js`
- `cloudfunctions/ai_generate/utils/config.js`
- `cloudfunctions/ai_generate/adapters/mock.js`（已删除）
- `cloudfunctions/generate_wanx/index.js`
- `cloudfunctions/quota_guard/index.js`

### 小程序页面

- `package-ai/change-pose/change-pose.vue`
- `package-ai/simple-ai-workbench/simple-ai-workbench.vue`
- `package-ai/upload/upload.vue`
- `pages/index/index.vue`
- `pages/workspace/workspace.vue`

### 公共逻辑

- `utils/api/generate.js`
- `utils/home/homeCapabilities.js`
- `utils/provider/garmentProviderCapability.js`
- `utils/provider/identityProviderCapability.js`
- `utils/quota/quotaFlow.js`
- `utils/runtime/appRuntimeConfig.js`
- `utils/runtime/featureRuntimePolicy.js`
- `utils/task/generationExecution.js`
- `utils/task/poseReplaceContract.js`
- `utils/task/taskLayer.js`
- `utils/work/workRecordRepository.js`
- `utils/work/workRepository.js`

### 验证与仓库治理

- `scripts/full-feature-runtime-policy-smoke.js`
- `scripts/full-generation-loop-smoke.js`
- `scripts/garment-replace-contract-smoke.js`
- `scripts/head-replace-contract-smoke.js`
- `scripts/real-provider-test-channel-smoke.js`
- `scripts/scene-replace-contract-smoke.js`
- `scripts/testing-stage-capability-smoke.js`
- `.gitignore`

## 8. 下一步操作

按以下顺序执行，避免在未部署或未确认额度保护前调用付费接口：

1. 在 HBuilderX 中选择 MP-WEIXIN 重新构建。
2. 检查新构建时间和页面路由，确认不再使用陈旧产物。
3. 将需要部署的云函数从根目录复制到：
   `unpackage/dist/dev/mp-weixin/cloudfunctions`
4. 在微信开发者工具中分别右键 `generate_wanx`、`quota_guard`；如线上调用仍经过 `ai_generate`，也部署该函数。
5. 选择“上传并部署：云端安装依赖”。
6. 在云端确认第 4 节配置，所有敏感值只保存在云端环境中。
7. 调用安全 `debugConfig`，确认：真实 Provider 开启、真实额度开启、dry run 关闭、mock fallback 关闭、Endpoint/凭据布尔状态为已配置、目标任务类型受支持。
8. 使用经过授权的测试素材执行一个单结果 Canary，禁止批量和自动重试。
9. 核对 Provider 请求标识、输入图片数量、结果不是输入图、云存储资产、任务结果、作品封面及额度 finalize。
10. 再执行一个明确失败的受控请求，核对真实错误、任务失败状态和额度 rollback。
11. 回归 AI 模特、AI 换衣服、换场景及其他开放功能，记录未实现的真实 Provider 路由。
12. 对新构建运行包体预检和微信开发者工具检查，再决定是否准备体验版。

## 9. 恢复工作时的检查清单

```powershell
git status --short --branch
node scripts/full-feature-runtime-policy-smoke.js
node scripts/full-generation-loop-smoke.js
node scripts/smoke/provider-contract-smoke.js
git diff --check
```

重新构建后再执行项目现有 MP-WEIXIN 包体预检脚本。若预检仍提示构建陈旧，应先解决构建链，不要绕过发布阻塞。

## 10. 安全边界

- 本文未记录任何 Provider 私密凭据、用户身份标识、请求签名或完整私人图片地址。
- 不应将云端私密配置写入前端、Git、日志或交接文档。
- 本轮未修改线上数据库权限、未部署云函数、未执行真实支付、未删除历史任务和作品。
- 本轮未修改官网页面。
