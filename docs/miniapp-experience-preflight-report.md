# 蝶变小程序体验版发布预检报告

生成时间：2026-07-28T02:23:07.709Z

## 发布结论

**BLOCKED**

该结论只覆盖本地源码与构建产物。微信云函数已部署环境、开发者工具编译、体验版上传和真机行为均为 **NOT RUN**。

## 基线

- 当前分支：`main`
- 工作区：当前沙箱不能从 Node 子进程调用 git，请以 `git status --short` 为准
- 版本：`1.0.0` / `100`
- AppID：project.config.json 已配置；manifest.json 未配置（不输出具体值）
- 本地运行环境：`win32` / Node `v25.9.0` / NODE_ENV `未设置`
- 云函数源码目录：`cloudfunctions`，发现 13 个入口文件；本轮不复制、不部署
- 隐私与权限声明：requiredPrivateInfos 0 项，permission 0 项；需在微信公众平台人工核对隐私保护指引
- debugTools：未进入 MP 路由
- 构建目录：`unpackage/dist/build/mp-weixin`
- 源码最新时间：2026-07-28T02:15:24.168Z
- 构建最新时间：2026-07-27T14:06:02.116Z
- 源码安全组合：不满足

## 自动检查

| 检查项 | 结果 |
| --- | --- |
| Provider 源码默认 mock | **PASS** |
| 真实 Provider 仅显式开启 | **PASS** |
| Provider dry-run 默认关闭 | **PASS** |
| 真实 quota 默认关闭 | **PASS** |
| 客户端云失败不伪造成功 | **PASS** |
| mock/fallback 禁止正式审核 | **PASS** |
| 批量生成关闭 | **BLOCKED** |
| 视频生成关闭 | **PASS** |
| 自动交付关闭 | **PASS** |
| 交付审批关闭 | **BLOCKED** |
| 开发调试页面关闭 | **PASS** |
| 正式构建存在 | **PASS** |
| 正式构建晚于源码 | **BLOCKED** |
| 正式构建路由同步 | **BLOCKED** |
| 正式构建 tabBar 同步 | **BLOCKED** |
| 正式 MP 不注册 H5 企业后台 | **PASS** |
| 正式 MP 不注册 Cloud Alpha | **PASS** |
| AppID 项目配置 | **PASS** |
| manifest AppID 配置 | **WARN** |
| 已部署 ai_generate 环境变量 | **NOT RUN** |
| 已部署 quota_guard 环境变量 | **NOT RUN** |
| 微信开发者工具编译 | **NOT RUN** |
| 体验版上传 | **NOT RUN** |
| 真机验收 | **NOT RUN** |

## 阻塞项

- 批量生成关闭
- 交付审批关闭
- 正式构建晚于源码
- 正式构建路由同步
- 正式构建 tabBar 同步

## 警告

- manifest.json 未配置 MP AppID；正式构建前需在 HBuilderX manifest 可视化配置中确认。

## 安全说明

- 本脚本不会上传体验版、部署云函数、修改数据库权限或调用真实生成。
- 本脚本不会输出 AppID、OPENID、Token、云凭证、图片地址或完整业务记录。
- 源码默认值不能证明已部署云函数环境变量；必须在微信开发者工具中执行 Runbook 的安全摘要检查。
- 测试必须使用非客户素材；mock/fallback 结果只能作为测试结果，不得正式审核或交付。

