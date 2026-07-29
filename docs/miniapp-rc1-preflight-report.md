# 蝶变小程序 RC1 发布预检报告

生成时间：2026-07-28T02:31:23.291Z

## 结论

**BLOCKED**

本报告只覆盖本地源码、配置、已有报告与构建产物。云函数部署、微信开发者工具发布构建、体验版上传、线上权限核验和真机回归均未自动执行。

## 前置报告

| 文件 | 状态 |
| --- | --- |
| `docs/full-chain-smoke-v2.md` | **缺失** |
| `docs/security-permission-audit-v1.md` | **缺失** |
| `docs/release-canary-v1.md` | **缺失** |
| `docs/experience-release-acceptance-v1.md` | **缺失** |
| `docs/experience-defects-v1.md` | **缺失** |
| `docs/rc1-regression-v1.md` | **缺失** |

- 指定报告缺陷统计：UNKNOWN（报告不完整）
- 辅助报告已知缺陷下限：P0=3 / P1=0 / P2=0 / P3=0
- 辅助安全审计高风险/严重集合项：6 项。
- 辅助报告不能替代缺失的指定报告，也不能把未验证项推定为通过。

## 版本与产物

- package 版本：`1.0.0`
- manifest 版本：`1.0.0` / `100`
- RC1 建议标识：`1.0.0-rc.1`（本轮未自动改版本）
- 源码最新时间：2026-07-28T02:27:52.674Z
- 构建最新时间：2026-07-27T14:06:02.116Z

## 自动准入检查

| 检查项 | 结果 |
| --- | --- |
| 六份指定前置报告齐全 | **BLOCKED** |
| P0 为 0 | **BLOCKED** |
| P1 为 0 | **BLOCKED** |
| 安全报告无 CRITICAL/HIGH | **BLOCKED** |
| Provider 默认 mock | **PASS** |
| 真实 Provider 仅显式开启 | **PASS** |
| Provider dry-run 默认关闭 | **PASS** |
| 真实 quota 默认关闭 | **PASS** |
| 客户端失败不伪造成功 | **PASS** |
| mock/fallback 禁止正式交付 | **PASS** |
| 批量生成关闭 | **BLOCKED** |
| 自动交付关闭 | **PASS** |
| 交付审批关闭 | **BLOCKED** |
| production debugTools 关闭 | **PASS** |
| 源码注册路由文件完整 | **PASS** |
| 正式构建存在 | **PASS** |
| 正式构建晚于源码 | **BLOCKED** |
| 正式构建路由同步 | **BLOCKED** |
| 正式构建 tabBar 同步 | **BLOCKED** |
| 云函数源码结构完整 | **PASS** |
| 微信开发者工具发布构建 | **NOT RUN** |
| 云端函数版本与环境变量复验 | **NOT RUN** |
| 体验版上传 | **NOT RUN** |
| Android 真机回归 | **NOT RUN** |
| iOS 真机回归 | **NOT RUN** |
| 线上数据库权限核验 | **BLOCKED** |

## 阻塞项

- 六份指定前置报告齐全
- P0 为 0
- P1 为 0
- 安全报告无 CRITICAL/HIGH
- 批量生成关闭
- 交付审批关闭
- 正式构建晚于源码
- 正式构建路由同步
- 正式构建 tabBar 同步
- 辅助安全审计仍有高风险/严重证据，且线上数据库规则未复验。

## 云函数部署准备

- 源目录共发现 13 个云函数：`ai_generate`、`enterprise_account_auth`、`enterprise_api`、`enterprise_auth`、`enterprise_data`、`enterprise_delivery`、`enterprise_member`、`enterprise_project`、`enterprise_web_login`、`enterprise_web_login_http`、`generate_wanx`、`leads_create`、`quota_guard`。
- 源码结构检查：index.js 与 package.json 均存在且 package.json 可解析。
- 本轮未复制到构建目录、未上传、未部署、未读取或修改线上环境变量。

## 未验证与云端复验

- 微信开发者工具清缓存发布编译、分包加载与控制台错误。
- mock 成功链、安全失败链、防重复提交、生产记录找回与作品收录。
- Android/iOS 上传、相册授权、分享、弱网、前后台切换与安全区。
- 已部署 `ai_generate`、`generate_wanx`、`quota_guard` 的版本及安全开关。
- 云数据库集合权限、客户端直连边界与可信用户隔离。

## 安全声明

- 不输出 AppID、OPENID、Token、云凭证、客户素材地址或完整业务记录。
- 不调用真实 Provider、不启用真实 quota、不执行批量真实生成、支付或正式交付。
- mock/fallback 结果只能用于测试，不得正式审核或交付。

