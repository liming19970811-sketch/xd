# 微信小程序审核版最终构建与提交清单 V1

生成日期：2026-07-28  
最终结论：**当前不可提交审核。** 本轮未构建、未部署、未上传、未提交，也未修改微信公众平台配置。

## 1. 前置材料

| 文件 | 状态 | 结论 |
| --- | --- | --- |
| `docs/rc1-release-notes.md` | 缺失 | BLOCKED |
| `docs/rc1-release-acceptance.md` | 缺失 | BLOCKED |
| `docs/rc1-feedback-summary.md` | 存在 | 0 份反馈；不能证明真机通过 |
| `docs/security-permission-audit-v1.md` | 缺失 | BLOCKED；替代审计仍有 6 项高风险/严重证据 |
| `docs/wechat-review-notes-v1.md` | 存在 | 审核说明草稿，仍有负责人待办 |
| `docs/wechat-privacy-backend-checklist-v1.md` | 存在 | 后台尚未人工填验 |
| `docs/release-canary-v1.md` | 缺失 | BLOCKED |

指定报告缺陷等级为 **UNKNOWN**。辅助报告已知下限为 P0=3、P1=0、P2=0、P3=0；P1/P2/P3 的 0 不代表已完成验收。

已知 P0：正式产物过期、产物路由不同步、真机核心路径未执行。真机 Android/iOS、弱网、相册授权、分享、前后台恢复和分包首次加载均为 NOT RUN。

## 2. 准入判定

| 条件 | 状态 | 证据 |
| --- | --- | --- |
| P0=0 / P1=0 | BLOCKED | P0 下限为 3；指定缺陷报告不完整 |
| 无 CRITICAL/HIGH 权限风险 | BLOCKED | 替代审计记录 6 项高风险/严重证据 |
| 至少一台真机核心路径通过 | BLOCKED | 未执行 |
| 所有开放入口真实可用 | BLOCKED | AI 主要依赖 mock，批量入口启用 |
| 隐私政策可访问 | BLOCKED | 仅有微信隐私保护指引，无独立政策页 |
| 用户协议可访问 | BLOCKED | 页面不存在 |
| 权限用途与代码一致 | BLOCKED | 公众平台未核对，统一隐私适配缺失 |
| 客服/反馈可用 | NOT RUN | 代码入口存在，审核账号未验证 |
| 无内部参数和调试信息 | PARTIAL | 静态检查通过主要项，正式包未复验 |
| 无硬编码密钥 | PARTIAL | 静态凭证扫描未命中，云端环境未复验 |
| mock/fallback 不可正式交付 | PARTIAL | 静态拦截存在，体验版未复验 |
| 未实现支付无购买入口 | PARTIAL | 会员页不支付；结果页仍有“购买”提示文案 |
| 回滚版本明确 | BLOCKED | 上一稳定线上版本 UNKNOWN |
| release preflight 通过 | BLOCKED | release smoke 29/32，RC1 preflight BLOCKED |

## 3. 审核版功能锁定

下表中的“审核版显示”是目标锁定状态，不代表当前源码已经隐藏。当前首页仍公开核心 AI、更多 AI 工具和批量入口，因此目标状态尚未达成。

| 功能 | 页面 | 真实可用 | 审核版显示 | 说明 |
| --- | --- | --- | --- | --- |
| 换模特 | AI 工作台 | 未完成真实链验收 | 否 | 当前产品形态 C，不得以 mock 申报正式 AI |
| 换颜色 | AI 工作台 | 同上 | 否 | 真实 Provider/额度未验收 |
| 换场景 | AI 工作台 | 同上 | 否 | 双图 Provider 和真机未验收 |
| 微改款 | AI 工作台 | 同上 | 否 | 仅保留体验版测试 |
| 换面料 | AI 工作台 | 同上 | 否 | 真实能力未验收 |
| 换图案 | AI 工作台 | 同上 | 否 | 真实能力未验收 |
| 展示图/细节图 | AI 工作台 | 同上 | 否 | 真实结果未验收 |
| 结构线稿/款式起稿/线稿改款 | 上传页 | 同上 | 否 | 不得用 mock 冒充正式设计能力 |
| 批量模特图 | 上传页 | 未验收且入口启用 | 否，必须关闭 | RC1 明确禁止批量真实生成 |
| 作品中心 | 作品页 | 本地逻辑可用，真机未验收 | 条件保留 | 仅显示合法可访问结果；测试结果明确标记 |
| 生产记录 | 任务列表 | 本地逻辑可用，真机未验收 | 条件保留 | 不得丢失失败和进行中任务 |
| 会员中心 | 套餐页 | 只读展示 | 保留 | 不提供在线购买 |
| 设置 | 设置页 | 部分可用 | 条件保留 | 隐私/协议补齐后保留 |
| 企业合作 | 需求表单 | 代码存在，云端未复验 | 条件保留 | 产品形态 B 的候选主入口 |
| 客服 | 我的/设置 | 微信客服入口存在 | 条件保留 | 审核账号必须真机验证 |
| 隐私政策 | 不存在独立页面 | 否 | 不可提交前必须补齐 | `openPrivacyContract` 不等于独立政策 |
| 用户协议 | 不存在 | 否 | 不可提交前必须补齐 | 法律文本由负责人审核 |

当前真实产品形态为 **C：仍主要依赖 mock 测试**，应继续使用体验版，不建议提交正式功能审核。若后续改选 B（企业服务和需求收集），必须通过编译期和服务端开关排除即时 AI、批量和交付能力；当前源码尚未完成该收敛。

## 4. 开关与版本

详见 `docs/wechat-review-version-lock-v1.md`。关键阻塞为：server fallback 路径存在、`batchGeneration=true`、`deliveryApproval=true`，正式部署环境变量未核验。

版本当前为 `1.0.0` / `100`，但工作区大量未提交，当前 HEAD 不能代表审核源码。正式构建必须在负责人确认的可复现快照上完成。

## 5. 最终构建步骤（人工）

1. 关闭全部阻塞项并冻结源码快照，记录 commit/归档校验值。
2. 负责人核对 `manifest.json`、`pages.json`、AppID、基础库、服务类目和隐私声明。
3. 在 HBuilderX 执行“发行 → 小程序-微信”，目标为 `unpackage/dist/build/mp-weixin`。
4. 运行 `node scripts/miniapp-release-smoke.js`，要求全部 PASS。
5. 运行 `node scripts/mp-package-audit.js`，确认主包、分包、总包和开发页面隔离。
6. 运行 `node scripts/wechat-review-final-preflight.js`，要求不再出现 BLOCKED。
7. 微信开发者工具导入正式产物，清缓存编译，检查 AppID、云环境、域名、分包和控制台。
8. 人工部署确需更新的云函数；每个函数记录源版本、部署时间和安全开关摘要。
9. 至少一台真机完成首页、客服、协议、权限、上传、任务、结果、作品和生产记录路径。
10. 上传体验版并完成回归；P0/P1 必须为 0，P2 有关闭或书面延期理由。
11. 准备审核说明、截图、测试素材和账号说明，经负责人签字后才提交审核。

## 6. 云函数部署准备

本轮不复制、不部署。审核版本如采用产品形态 B，应避免部署或调用即时 AI 生成链。若未来采用 A，至少需要单独核验 `ai_generate`、`generate_wanx`、`quota_guard` 的部署版本、身份边界、真实 Provider、真实额度和 mock/fallback 规则。

不得在审核材料中放 API Key、完整环境变量、OPENID、云环境 ID、内部集合名或管理员入口。

## 7. 审核材料

- 审核说明：`docs/wechat-review-notes-v1.md`
- 隐私后台清单：`docs/wechat-privacy-backend-checklist-v1.md`
- 合规审计：`docs/wechat-review-compliance-audit-v1.md`
- 版本锁定：`docs/wechat-review-version-lock-v1.md`
- 回滚方案：`docs/wechat-review-rollback-plan-v1.md`
- 截图：主页、真实开放能力、企业需求、作品/记录、会员、设置、客服、隐私政策、用户协议和权限用途；不使用客户素材或内部字段。

## 8. 提交与回滚签字项

- [ ] 产品负责人确认审核版产品形态和开放功能。
- [ ] 安全负责人确认线上权限和云端开关。
- [ ] 隐私负责人确认主体、联系人、期限、第三方和协议文本。
- [ ] 测试负责人确认真机与体验版结果。
- [ ] 发布负责人确认版本、构建、云函数、截图、审核说明和回滚目标。
- [ ] 上一稳定线上版本可在公众平台回退。

任一项未完成，维持：**当前不可提交审核**。

## 9. 本轮静态验证

- `node --check scripts/wechat-review-final-preflight.js`：PASS。
- 最终预检：预期非零退出，结论 `CURRENTLY_NOT_SUBMITTABLE`。
- `scripts/miniapp-release-smoke.js`：29/32 PASS；正式产物过期、路由不同步、tabBar 不同步。
- 静态凭证特征扫描：未命中常见私钥/API Key 字面量；不替代云端环境变量复验。
- 微信开发者工具、云函数部署、体验版上传、公众平台提交和真机：NOT RUN。
- `git diff --check`：在最终复跑后记录。
