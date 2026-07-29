# 蝶变小程序 RC1 云函数部署准备

## 边界

本清单只做部署准备，不自动复制、不自动部署、不修改环境变量，也不使用 `tcb`。部署必须在微信开发者工具中人工执行“上传并部署：云端安装依赖”。

## RC1 直接依赖

| 云函数 | 用途 | RC1 要求 | 当前动作 |
| --- | --- | --- | --- |
| `ai_generate` | 生成入口与 mock 结果 | Provider 保持 mock，真实 quota 关闭 | 待人工核对后部署 |
| `generate_wanx` | 生成适配 | 不开启真实 Provider | 待人工核对后部署 |
| `quota_guard` | 额度读取/事务入口 | `ENABLE_REAL_QUOTA_GUARD` 不得开启 | 高风险身份回退未关闭，RC1 阻塞 |
| `leads_create` | 企业合作线索 | 不使用真实客户资料 | 权限与限流需云端复验 |
| `enterprise_auth` | 移动企业会话 | 使用测试企业账号 | 按移动企业回归范围部署 |
| `enterprise_member` | 成员权限 | active/pending/disabled 校验 | 按移动企业回归范围部署 |
| `enterprise_project` | 项目协作 | 租户与 RBAC 校验 | 按移动企业回归范围部署 |
| `enterprise_delivery` | 交付状态 | 禁止正式交付 | 按移动企业回归范围部署 |
| `enterprise_web_login` | 小程序确认网页登录 | 不输出票据和 OPENID | 仅当 RC1 含该入口时部署 |

`enterprise_account_auth`、`enterprise_api`、`enterprise_data`、`enterprise_web_login_http` 属于企业网页或 Alpha 能力，不因小程序 RC1 自动部署；如线上版本确实依赖，需单独审批。

## 部署前检查

1. 确认 `cloudfunctions/<name>/index.js` 和 `package.json` 存在，`node --check` 通过。
2. 比对源码与 `unpackage/dist/build/mp-weixin/cloudfunctions/<name>`；构建目录不能替代源码审查。
3. 在云开发控制台记录当前函数版本和更新时间，只记录摘要，不复制环境变量全集。
4. 核对安全摘要：真实 Provider 关闭、真实 quota 关闭、dry-run 关闭、无真实支付和自动交付。
5. 核对数据库权限规则，特别是 `tasks`、`batches`、`projects`、`leads`、`membership_usage`、`membership_usage_records`。
6. 权限证据未关闭前，不部署以扩大客户端直连能力。

## 人工复制与部署

1. HBuilderX 完成最新 MP-WEIXIN 发布构建。
2. 将经确认的函数目录从项目根目录 `cloudfunctions` 复制到 `unpackage/dist/build/mp-weixin/cloudfunctions`。
3. 微信开发者工具导入 `unpackage/dist/build/mp-weixin`，确认云环境正确。
4. 逐个右键目标函数，选择“上传并部署：云端安装依赖”。
5. 每次部署后记录函数名、部署时间、操作者和控制台成功状态，不记录凭证或完整环境变量。
6. 用测试账号执行最小 smoke；失败时停止后续函数部署并按上一稳定版本回滚。

## 部署后最小复验

- `ai_generate`：mock 成功、可控失败、mock/fallback 交付阻断。
- `generate_wanx`：真实 Provider 未开启，不产生真实调用。
- `quota_guard`：真实扣点关闭，读取失败不伪造余额。
- `leads_create`：测试线索单次提交与重复点击保护。
- 企业函数：active 可访问，pending/disabled 拒绝，跨租户拒绝。

当前状态：**BLOCKED**。原因是权限高风险证据、旧正式构建和云端环境均未完成复验。
