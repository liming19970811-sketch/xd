# 日志、链路追踪与系统告警中心 V1

## 目标

让每次生成失败、额度异常、权限拒绝和交付问题都可以通过 `requestId`、`traceId`、`taskId`、`projectId` 或 `batchId` 快速定位。

本阶段建立治理层和后台查看入口，不改生成主链路、不改云函数业务逻辑、不接外部日志平台。

## 统一请求标识

统一由 `utils/observability/traceLogger.js` 提供：

- `createTraceContext(input)`
- `writeStructuredLog(input)`
- `listStructuredLogs(filters)`
- `getTraceTimeline(identifier)`
- `redactSensitive(payload)`

每次用户操作应创建：

- `requestId`
- `traceId`

并贯穿：

前端请求 -> API/云函数 -> AI 供应商 -> 任务轮询 -> 额度记录 -> 资产记录 -> 审核与交付。

## 结构化日志字段

日志统一包含：

- 环境
- 模块
- 操作
- `requestId`
- `traceId`
- 用户和企业脱敏标识
- `taskId`
- `projectId`
- `batchId`
- provider 与 modelVersion
- 状态
- 耗时
- 错误码
- 时间

禁止只输出无法检索的自由文本日志。

## 日志级别

- debug：仅开发环境
- info：正常关键节点
- warn：可恢复异常
- error：任务或请求失败
- critical：数据泄露、重复扣费、错误交付等严重异常

生产环境默认跳过详细 debug 日志。

## 敏感信息保护

日志禁止记录：

- API 密钥
- 登录令牌
- 完整手机号和邮箱
- 私有图片完整 URL
- 用户输入的完整隐私内容
- 数据库完整连接信息

统一使用 `redactSensitive(payload)`，不要在各模块自行拼脱敏逻辑。

## 关键链路日志

V1 覆盖计划包括：

- 用户登录与企业切换
- 文件上传与临时 URL 生成
- 任务创建与 provider 调用
- 异步任务轮询
- 额度预扣、确认、回滚
- 审核通过与退回
- 交付创建与下载
- 版型版本与模型发布
- 权限拒绝
- 管理员高风险操作

## 告警规则

`utils/admin/errorAlertCenter.js` 定义告警中心，支持：

- 任务失败率持续升高
- provider 超时或空结果
- 额度重复扣除
- 回滚失败
- 任务长期停留在生成中
- mock 或 fallback 进入正式审核
- 未授权下载
- 跨企业访问尝试
- 正式交付失败
- 数据备份失败

告警状态：

- open
- acknowledged
- investigating
- resolved
- ignored

每条告警保留负责人、影响范围、处理过程、解决时间和关联工单字段。

## 后台入口

H5 管理入口：

- `/#/admin/errors`

支持：

- 错误日志
- 系统告警
- 链路追踪
- 治理策略

仅平台管理员和授权技术人员可查看。

## 日志保留

- 普通运行日志：30 天
- 错误日志：180 天
- 安全日志：365 天
- 额度日志：730 天
- 审核与交付审计日志：1095 天

清理过期日志不得删除法务、账务和关键审计记录。

## 验收

自动检查：

```powershell
node scripts/observability-alerting-smoke.js
```

人工检查：

1. 打开 `/#/admin/errors`。
2. 输入任意 `taskId` 或 `traceId` 查看链路。
3. 触发或注入一条 provider 超时日志，确认出现告警。
4. 标记告警为 resolved。
5. 确认页面不展示 API Key、sessionToken、完整手机号、完整邮箱和私有图片完整 URL。
