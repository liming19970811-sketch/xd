# 发布前数据与权限审计 V1

审计日期：2026-07-28  
审计方式：仅扫描本地源码和配置，不连接云数据库，不读取线上记录，不修改或部署权限规则。

## 范围与边界

已检查 `pages`、`components`、`utils`、`cloudfunctions`、`pages.json`、`manifest.json`、`project.config.json`，重点覆盖小程序任务、批次、作品、额度、线索，以及企业身份、成员、项目、交付和 API 云函数。

本仓库未发现可用于证明线上集合权限状态的数据库安全规则文件。因此，任何客户端直连集合都只能确认“代码如何访问”，不能确认线上规则是否安全。发布前必须在云开发控制台逐集合核验。

静态扫描覆盖 347 个源码文件，包括主包、AI 分包、作品分包和移动企业分包，识别 34 个集合名和 155 个 `.collection(...)` 调用点。审计脚本同时统计 `.doc/.where/.add/.set/.update/.remove/command/transaction` 调用，并列出云存储及安全相关 storage 文件；统计是源码调用证据，不代表线上调用量。

数据库调用标记统计：`.doc` 45、`.where` 74、`.add` 58、`.set` 19、`.update` 65、`.remove` 4、`command` 21、事务相关标记 22。

## 身份来源

| 来源 | 实际使用位置 | 是否可作为授权依据 | 结论 |
|---|---|---|---|
| `cloud.getWXContext().OPENID` | `enterprise_data`、`enterprise_web_login`、`quota_guard` | 是 | 小程序云函数可信来源 |
| `event.openid/event.userId` | `quota_guard` 身份回退 | 否 | 真实额度模式发布前必须移除回退 |
| session token | 企业 auth/member/project/delivery/API 云函数 | 需服务端哈希、过期、成员状态校验 | 当前企业云函数已有对应校验 |
| 本地 user/openId | 用户展示、额度明细客户端过滤、作品范围恢复 | 否 | 只能用于体验和查询提示 |
| 页面 taskId/historyId/batchId/projectId | 详情跳转与分享 | 否 | 目标读取必须再次验证所有权 |
| 前端 role/admin 布尔值 | 后台和演示 UI | 否 | 只能控制展示，不能决定云端权限 |

## 云存储与本地 storage

云存储调用主要分布在上传页、任务上传、线索附件、作品下载与图片临时 URL 解析。客户端上传得到的 fileID 或 URL 只能作为资源定位符，不能作为访问授权凭证；下载和预览仍依赖云存储规则或服务端临时 URL 授权。

实际调用文件包括 `package-ai/result/result.vue`、`pages/gallery/gallery.vue`、`pages/gallery-detail/gallery-detail.vue`、`pages/lead-detail/lead-detail.vue`、`pages/service-request/service-request.vue`、`utils/api/upload.js`、`utils/task/taskLayer.js`。

共识别 76 个使用同步 storage 的文件。安全相关本地 storage 包括用户身份、企业上下文、会话、任务状态、作品偏好、生产历史、会员展示缓存和设置。它们可用于页面恢复，但任意值均可被客户端修改，不能决定云端 owner、tenant、admin 或 quota 权限。

## 云函数清单

| 云函数 | 主要用途 | 身份与范围证据 | 结论 |
|---|---|---|---|
| `ai_generate` | AI 生成与额度记录检查 | 默认 provider 为 mock；真实 provider 需显式开关 | 本轮未修改 |
| `quota_guard` | 额度预留、完成、回滚事务 | 使用事务；真实模式仍存在客户端身份回退 | 高风险方案项，本轮未修改 |
| `generate_wanx` | 万相生成适配 | 生成主链 | 本轮未修改 |
| `leads_create` | 公开需求线索创建 | 服务端写入，但缺少可见的可信用户/管理员校验和限流证据 | 需发布前评审 |
| `enterprise_data` | Alpha 企业、成员、项目 | 使用 `getWXContext().OPENID`，成员状态和租户检查 | 已有可信校验 |
| `enterprise_auth` | 企业会话 | 会话 token 哈希查询 | 已有可信校验 |
| `enterprise_account_auth` | 企业账号登录 | 账号验证码、会话和限流 | 已有服务端校验 |
| `enterprise_web_login` | 小程序与网页登录票据 | 小程序身份来自 `getWXContext()`，票据和会话保存哈希 | 已有可信校验 |
| `enterprise_web_login_http` | H5 登录 HTTP 入口 | 复用网页登录核心，不直接读取小程序身份 | 需保持部署入口与核心版本一致 |
| `enterprise_member` | 成员、邀请、角色 | 会话、有效成员、企业范围、RBAC | 已有可信校验 |
| `enterprise_project` | 企业项目、报价、订单 | 会话、有效成员、企业范围、RBAC | 已有可信校验 |
| `enterprise_delivery` | 企业交付 | 会话、有效成员、企业范围、RBAC | 已有可信校验 |
| `enterprise_api` | 企业开放 API | 会话或 API key 哈希、企业和应用范围 | 已有可信校验 |

## 集合矩阵

| 集合或集合组 | 用途 | 读取方 | 写入方 | 隔离字段/校验 | 管理员访问 | 风险 |
|---|---|---|---|---|---|---|
| `tasks` | 小程序生成任务 | 客户端 `tasksRepository` | 未在该仓库发现对应可信写函数 | 客户端查询未附加可信 owner 条件 | 未见服务端管理员门禁 | 高 |
| `batches` | 小程序生产批次 | 客户端 `batchesRepository` | 客户端直接 `set/add` | 仅按 batch/project ID，未附加可信 owner 条件 | 未见服务端管理员门禁 | 高 |
| `projects` | 旧项目与线索快照 | 客户端 `projectsRepository` | 客户端直接 `add/update` | 未附加可信 owner/enterprise 条件 | 前端后台页面使用 | 严重 |
| `leads` | 联系人、需求、附件 | 客户端列表/详情；`leads_create` 创建 | 云函数创建，客户端直接更新 | 客户端读取/更新无可信管理员条件 | 前端后台页面使用 | 严重 |
| `membership_usage` | 会员额度余额 | `quota_guard` | `quota_guard` 事务 | 当前身份函数在真实模式应只接受 WXContext | 无前端管理员写 | 高 |
| `membership_usage_records` | 额度流水 | 客户端明细页、`ai_generate`、`quota_guard` | `quota_guard` 事务 | 客户端使用本地 openId 查询；服务端存在身份回退 | 无前端管理员写 | 高 |
| `enterprises`、`enterprise_members`、`enterprise_projects` | Alpha 企业数据 | `enterprise_data` | `enterprise_data` | WXContext OPENID、active Member、enterpriseId | 管理员成员规则 | 中低 |
| 企业会话、用户、身份、登录票据 | 企业登录 | 企业认证云函数 | 企业认证云函数 | token/ticket/openid 使用哈希或可信上下文 | 服务端 | 中低 |
| 企业成员、角色、邀请、成员审计 | 企业成员与 RBAC | `enterprise_member` | `enterprise_member` | session + active member + enterpriseId + permission | RBAC | 中低 |
| 企业项目、阶段、报价、订单、交付、审计 | 企业业务 | 项目/交付云函数 | 项目/交付云函数 | session + active member + enterpriseId + permission | RBAC | 中低 |
| 企业 API 应用、密钥、任务、批次、日志 | 企业开放 API | `enterprise_api` | `enterprise_api` | API key 哈希、enterpriseId、appId、scope | owner/admin | 中低 |

说明：未在云端集合调用中发现独立的通用 `assets` 或 `production_histories` 集合证据；对应作品和生产历史主要由现有本地 storage/repository 管理。该结论不代表线上环境一定不存在这些集合。

## 已证实问题

### 1. 客户端直连敏感集合

证据：

- `utils/cloudbase/tasksRepository.js` 列表查询未附加 owner 条件，详情可按 taskId 或文档 ID 读取。
- `utils/cloudbase/batchesRepository.js` 可在客户端查询、覆盖和新增批次。
- `utils/cloudbase/projectsRepository.js` 可在客户端查询和更新项目，项目还包含联系人、手机号、微信、附件等线索快照。
- `utils/cloudbase/leadsRepository.js` 可在客户端读取全部线索并更新跟进状态。

前端页面是否隐藏入口与这些集合是否安全无关。发布阻塞条件是：云数据库规则必须证明调用者只能读取自己的数据，或这些管理集合完全禁止客户端直连并迁移到带可信会话/RBAC 的云函数。

### 2. 额度明细使用本地身份过滤

`utils/member/usageRecordRepository.js` 从本地用户缓存读取 openId，再直接查询 `membership_usage_records`。查询后的二次过滤只能避免误显示，不能阻止越权读取。

建议：改为可信云函数读取当前 WXContext 用户的记录；过渡期至少确保规则使用 `auth.openid`，而不是信任查询参数。

### 3. 额度云函数接受客户端身份回退

`cloudfunctions/quota_guard/index.js` 的身份归一包含 `wxContext.OPENID || event.openid`，同时接收 `event.userId`。真实额度模式发布前应强制要求 WXContext OPENID；如 mock 测试确需传入身份，应只在明确的非生产测试分支允许。

本轮遵守额度事务禁止修改规则，未改代码、未部署。

### 4. 分享链接包含内部记录 ID

结果页和作品页分享路径包含 taskId、historyId 或 batchId。ID 本身不是授权凭证，但落地页和数据读取层必须重新校验当前用户。当前旧 `tasks/batches` 客户端仓储不能提供服务端所有权证明。

建议：短期核验规则和落地页所有权；中期使用有过期时间、用途和接收范围的服务端分享 token。

### 5. 本地缓存不应作为授权依据

项目将用户身份、企业上下文、作品偏好和部分业务数据保存在 storage；企业会话 token 还存在两处上下文存储。storage 可用于恢复体验，但不能作为云端权限凭证。需要登录的云端操作必须继续由服务端验证会话、成员状态和租户。

### 6. 生成主链曾打印完整 prompt

`utils/task/taskLayer.js` 原先直接记录最终生成 prompt。prompt 可能包含用户输入的设计要求、款式描述或业务信息，不应进入正式前端日志。

本轮仅删除该日志语句；任务参数、任务状态、调用接口和生成行为均未改变。现有下一条日志仍记录 task type、是否有图片和安全的图片来源类别。

## 本轮低风险修复

- 云环境初始化日志不再输出完整环境 ID，仅输出是否配置和是否合法。
- 线索详情不再输出附件 fileID、临时 URL、图片源地址或云文件完整响应。
- 线索提交不再输出 debug 对象和完整线索 ID，仅输出成功状态和是否存在 ID。
- 批次持久化不再输出数据库 SDK 的原始写响应。

这些修改不改变接口、数据结构、生成链、额度事务、业务权限或线上数据。

静态凭证扫描未发现私钥头、常见 provider secret 字面量；这只能证明受扫源码未命中，不替代云函数环境变量和部署配置人工核验。

## 发布前人工核验

1. 在云开发控制台逐一导出或截图 `tasks`、`batches`、`projects`、`leads`、`membership_usage`、`membership_usage_records` 的权限规则。
2. 使用两个真实测试账号验证 A 无法读取、更新或删除 B 的任务、批次、额度流水、项目和线索。
3. 验证直接猜测 taskId、batchId、projectId、leadId 不能获得其他用户记录。
4. 验证普通用户无法直接调用客户端数据库接口创建或更新项目、线索状态和批次快照。
5. 保持 `ENABLE_REAL_PROVIDER_CALL`、`ENABLE_REAL_QUOTA_GUARD`、`PROVIDER_DRY_RUN` 为非启用状态，直到权限阻塞项关闭。
6. 检查云函数日志，确认不出现 OPENID、session token、完整图片 URL、完整请求或完整数据库记录。

## 修复优先级

1. 发布阻塞：核验并收紧客户端直连集合的线上规则，不能仅依靠页面隐藏。
2. 发布阻塞：真实额度模式去除客户端 openid/userId 授权回退。
3. 高：将 leads/projects/batches 管理写入迁移到可信云函数。
4. 高：额度明细改由可信云函数按 WXContext 查询。
5. 中：统一并缩短企业会话本地保存面，完善过期和轮换。
6. 中：为分享查看建立服务端授权或受控分享 token。

## 复核命令

```powershell
node scripts/data-permission-audit.js
node --check scripts/data-permission-audit.js
git diff --check
```

脚本只输出文件路径、行号、规则名、集合名和布尔状态，不输出匹配代码正文或任何运行时用户数据。
