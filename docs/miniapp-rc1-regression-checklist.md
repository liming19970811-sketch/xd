# 蝶变小程序 RC1 体验版回归清单

## 使用规则

- 仅使用测试账号和非客户素材，Provider 保持 mock，真实 quota、批量生成、自动交付和支付保持关闭。
- 每项只填写 `PASS`、`FAIL`、`BLOCKED` 或 `NOT RUN`。没有截图、日志摘要或复现步骤时不得填 PASS。
- 日志只记录状态、错误码、耗时和 ID 是否存在，不粘贴 OPENID、Token、完整图片地址或完整业务记录。
- 任一 P0/P1、CRITICAL/HIGH 权限风险或发布构建错误出现时，停止上传 RC1。

## 0. 准入与构建

| 项目 | 结果 | 证据 |
| --- | --- | --- |
| 六份前置报告齐全 | BLOCKED | 当前指定文件缺失 |
| P0=0、P1=0 | BLOCKED | 缺陷总表不完整，辅助报告仍有 P0 |
| P2 已修复或有延期理由 | BLOCKED | 缺少统一缺陷报告 |
| 无 CRITICAL/HIGH 权限风险 | BLOCKED | 辅助安全审计有高风险证据，线上规则未复验 |
| HBuilderX 发布到 MP-WEIXIN 无错误 | NOT RUN | 需人工执行 |
| 最新产物晚于源码 | BLOCKED | 当前产物过期 |
| release smoke 全通过 | BLOCKED | 待最新构建后复跑 |
| 包体主包/分包/总包达标 | BLOCKED | 历史数据不可替代 RC1 产物 |

## 1. 安全开关

| 项目 | 预期 | 结果 |
| --- | --- | --- |
| realProvider | false | NOT RUN（需复验已部署环境） |
| realQuota | false | NOT RUN（需复验已部署环境） |
| PROVIDER_DRY_RUN | false | NOT RUN（需复验已部署环境） |
| batchGeneration | false | BLOCKED（源码入口仍可达） |
| autoDelivery | false | PASS（本地静态） |
| deliveryApproval | false | BLOCKED（结果页仍存在审批入口） |
| production debugTools | false | PASS（本地路由静态） |
| mock/fallback 正式交付 | 必须拒绝 | NOT RUN（静态拦截存在，需体验版复验） |

## 2. 主链回归

| 步骤 | 预期 | 结果 |
| --- | --- | --- |
| 冷启动与首次引导 | 仅首次显示，不阻塞首页 | NOT RUN |
| 首页核心入口 | 路由和参数正确 | NOT RUN |
| 上传图片 | 预览、更换、删除正常 | NOT RUN |
| 缺图提交 | 中文提示，不创建任务 | NOT RUN |
| mock 任务创建 | 只创建一次，taskId 存在 | NOT RUN |
| 生成中 | 状态可恢复，无无限轮询 | NOT RUN |
| mock 成功 | 结果明确标记测试 | NOT RUN |
| 云调用失败 | 不伪造成功，可重试 | NOT RUN |
| 快速连点 | 不重复创建任务 | NOT RUN |
| 再次生成 | 新 taskId，旧任务保留 | NOT RUN |

## 3. 记录与作品

| 项目 | 预期 | 结果 |
| --- | --- | --- |
| 生产记录找回 | 可按 history/task 恢复 | NOT RUN |
| 各任务状态 | pending/generating/completed/failed 正确 | NOT RUN |
| 失败重试 | 新任务，旧失败记录保留 | NOT RUN |
| 作品中心收录 | 仅有效完成结果 | NOT RUN |
| mock/fallback 作品 | 测试标记且不可正式交付 | NOT RUN |
| 保存作品 | 不重复写入，返回可见 | NOT RUN |
| 下载相册 | 成功、拒绝、重新授权均有反馈 | NOT RUN |
| 分享回流 | 路径有效且无敏感参数 | NOT RUN |

## 4. 账户与移动企业

| 项目 | 预期 | 结果 |
| --- | --- | --- |
| 我的页面六入口 | 路由存在、快速连点受控 | NOT RUN |
| 会员与额度 | 真实读取；失败不显示假 0 | NOT RUN |
| 升级入口 | 不创建支付订单 | NOT RUN |
| 设置与缓存 | 操作真实、返回刷新 | NOT RUN |
| 移动企业权限 | 无权限隐藏且方法层拒绝 | NOT RUN |
| pending/disabled | 拒绝访问 | NOT RUN |
| 客户确认与交付 | 测试数据，不执行正式交付 | NOT RUN |

## 5. 真机矩阵

| 环境 | 核心范围 | 结果 |
| --- | --- | --- |
| Android | 冷启动、上传、任务、结果、相册、分享、弱网 | NOT RUN |
| iOS | 授权、安全区、上传、任务、结果、相册、分享 | NOT RUN |
| 前后台切换 | 轮询停止/恢复、状态找回 | NOT RUN |
| 分包首次加载 | AI、作品、移动企业 | NOT RUN |
| 小屏与大字体 | 无遮挡、截断和重复点击 | NOT RUN |

## 6. 缺陷记录模板

| 编号 | 等级 | 页面/链路 | 现象 | 复现步骤 | 状态 | 延期理由 |
| --- | --- | --- | --- | --- | --- | --- |
| RC1-000 | P0/P1/P2/P3 |  |  |  | open |  |

RC1 上传前必须由发布负责人确认：P0=0、P1=0，所有 P2 已关闭或有书面延期理由，且权限高风险项已由线上规则证据关闭。
