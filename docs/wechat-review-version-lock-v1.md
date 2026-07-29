# 审核版版本与开关锁定 V1

锁定日期：2026-07-28  
状态：**未锁定，当前不可生成可提交审核版。** 本文件记录源码事实和人工待办，不修改云端环境变量或版本。

## 版本信息

| 项目 | 当前值 | 锁定状态 |
| --- | --- | --- |
| 分支 | `main` | 工作区存在大量未提交修改，不能作为可复现快照 |
| 当前 HEAD | `3cce5d5f` | 早于当前工作区修改，不是审核源码快照 |
| package 版本 | `1.0.0` | 待负责人确认 |
| manifest 版本 | `1.0.0` / `100` | 待负责人确认 |
| RC1 内部建议 | `1.0.0-rc.1` | 仅建议，未写入配置 |
| 上一稳定线上版本 | UNKNOWN | 必须从微信公众平台版本管理确认 |
| 正式产物 | 已存在但旧于源码 | BLOCKED，必须由 HBuilderX 重新发布构建 |

版本锁定必须记录最终提交 commit 或只读源码归档、构建时间、微信开发者工具版本、HBuilderX 版本、AppID 配置状态、云环境别名、构建包校验值和负责人。当前脏工作区不能作为审核回滚锚点。

## 安全开关摘要

```text
runtimeEnv=本地进程未设置；正式构建与云端待人工确认
realProvider=false（仅源码默认）
realQuota=false（仅源码默认）
providerDryRun=false（仅源码默认）
mockFallback=server路径存在；client=false
testResultVisible=true
batchGeneration=true（BLOCKED）
videoGeneration=false
deliveryApproval=true（条件入口，BLOCKED）
autoDelivery=false
debugTools=false（MP路由静态检查）
```

注意：源码默认值不能证明已部署云函数环境变量。正式构建前必须在云端安全摘要中再次确认 `realProvider=false`、`realQuota=false`、`providerDryRun=false`，且不得输出密钥。

## 产品形态锁定

当前属于 **C：仍主要依赖 mock 测试**。

- 不得把 mock/fallback 包装成正式 AI 服务。
- 不得上传为“正式 AI 生成能力已上线”的审核版本。
- 若选择 B（仅企业服务和需求收集），需另行从审核构建依赖图中排除即时生成入口，且不得仅靠文案隐藏。
- 选择 A 前必须完成真实 Provider、真实 quota、失败链、内容安全、作品和交付规则的专项验收。

## 锁定解除条件

1. 指定前置报告齐全，P0/P1 均为 0。
2. 六项高风险/严重权限证据由线上规则和双账号测试关闭。
3. 独立隐私政策与用户协议可访问。
4. 批量生成、交付审批和未验收入口从审核版关闭。
5. 最新 HBuilderX 正式构建生成，路由和 tabBar 同步。
6. release preflight 全部通过。
7. 至少一台真机完成核心路径，客服和权限流程真实可用。
8. 从微信公众平台确认可回滚的上一稳定版本。
