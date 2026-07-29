# 企业账号验证码登录 Runbook

本文档用于验收企业网页版 V3.1：邮箱与手机号验证码登录基础闭环。当前阶段不接真实邮件或短信服务商；未接真实服务商时，不得声称真实验证码已发送。

## A. 开发 Mock 配置

云函数 `enterprise_account_auth` 支持开发 Mock：

- `ACCOUNT_AUTH_DEV_MOCK_ENABLED=true`
- `EMAIL_AUTH_ENABLED=true` 或 `PHONE_AUTH_ENABLED=true`
- `EMAIL_PROVIDER_MODE` / `SMS_PROVIDER_MODE` 不为 `configured`
- 运行环境不能是 `production / prod / release / trial`

开发 Mock 允许在安全 debug 字段返回 `debug.devCode`，不能把验证码写进普通 message。

## B. 邮箱能力配置

环境变量：

- `EMAIL_AUTH_ENABLED=true`
- `EMAIL_PROVIDER_MODE=configured_provider` 或 `configured` 表示真实服务已配置
- `EMAIL_PROVIDER_ENDPOINT`
- `EMAIL_PROVIDER_API_KEY`
- `EMAIL_PROVIDER_API_SECRET`
- `EMAIL_FROM_ADDRESS`
- `EMAIL_FROM_NAME`
- `EMAIL_TEMPLATE_ID`

未配置真实邮件服务商时：

- 返回能力 `disabled` 或 `development_mock`
- 不得声称真实邮件已发送
- 生产环境不得返回 `debug.devCode`
- 配置不完整时返回 `auth_provider_not_configured`，不得自动切换 mock

## C. 手机号能力配置

环境变量：

- `PHONE_AUTH_ENABLED=true`
- `SMS_PROVIDER_MODE=configured` 表示真实服务已配置

本阶段手机号优先支持中国大陆手机号，并统一为 `+8613812345678` 形式。

## D. 部署 enterprise_account_auth

1. 打开微信开发者工具。
2. 右键 `cloudfunctions/enterprise_account_auth`。
3. 选择“上传并部署：云端安装依赖”。
4. 检查日志只包含 action、provider、accountType、accountHashPrefix、success、errorCode、hasSession。

## E. 验证码发送测试

1. H5 打开 `/pages/enterprise-web/login`。
2. 选择邮箱或手机号验证码登录。
3. 输入合法账号。
4. 点击发送验证码。
5. configured 模式显示已发送；development_mock 模式显示开发 Mock 提示并在 debug 字段展示 devCode。
6. 真实邮箱模式需要检查收件箱和垃圾邮件目录。
7. 邮件标题为“蝶变企业工作台登录验证码”。
8. 邮件正文包含验证码、5 分钟有效、不要泄露、非本人可忽略。

## E1. 真实邮箱 Provider 流程

`requestCode` 的真实邮箱顺序必须为：

1. 校验邮箱格式。
2. 校验频率限制。
3. 生成验证码。
4. 生成 hash 和 salt。
5. 调用邮件 Provider。
6. 邮件发送成功后保存有效验证码记录。
7. 邮件发送失败时不保存可登录验证码。
8. 返回安全发送结果。

Provider 接口：

```js
sendLoginCode({ to, code, expiresInMinutes, requestId })
```

统一返回：

```js
{
  ok,
  provider,
  providerMessageId,
  status,
  errorCode,
  message
}
```

页面和验证码核心流程不得依赖具体邮件服务商 SDK。

## F. 验证码安全测试

1. 验证码为服务端安全随机 6 位数字。
2. 云端只保存验证码 hash 和 salt。
3. 新验证码生成后旧验证码失效。
4. 验证码过期后返回 `code_expired`。
5. 成功使用后再次使用返回 `code_used`。
6. 错误验证码返回 `code_invalid`。
7. 连续失败 5 次后返回 `verify_attempts_exceeded`。

## G. 频率限制测试

基础规则：

- 60 秒内不能重复发送
- 每小时最多 5 次
- 每天最多 15 次
- 相同 `requestId` 重复提交返回第一次结果，不重复发送邮件，不生成第二个验证码

对应错误码：

- `code_send_too_frequent`
- `code_daily_limit_reached`

## H. 登录与 Session

1. 验证码正确后创建或复用账号身份。
2. 相同邮箱复用同一 `userId`。
3. 相同手机号复用同一 `userId`。
4. 云端创建 `sessionToken`，只返回一次。
5. 云端只保存 token hash。
6. `restoreSession` 必须云端校验。
7. `logout` 后 token 立即失效。

## I. 企业注册与切换

登录成功后：

1. 无企业进入企业注册页。
2. 一个 active 企业进入 Dashboard。
3. 多个 active 企业进入企业选择页。
4. pending / disabled 成员不可进入。
5. 企业切换后同步当前用户、企业、成员、角色和租户上下文。

企业注册继续复用 `enterpriseRegistrationService`，不复制第二套注册逻辑。

## J. 生产环境禁用 devCode

当运行环境是 `production / prod / release / trial` 时：

- 即使 `ACCOUNT_AUTH_DEV_MOCK_ENABLED=true`
- 也不得返回 `debug.devCode`
- 未配置真实服务商时返回 `auth_provider_not_configured`
- Provider 发送失败不得假装成功
- 不允许自动切换 `local_mock`

## K. 敏感信息检查

禁止日志输出：

- 完整邮箱
- 完整手机号
- 验证码
- sessionToken
- OPENID
- UNIONID
- AppSecret
- 邮件或短信服务密钥

允许日志输出：

- action
- provider
- accountType
- accountHashPrefix
- hasRequestId
- sendSuccess
- errorCode
- elapsedMs

## L. 邮件发送失败测试

1. 将 Provider endpoint 配置为会返回 4xx 或 `ok=false` 的测试接口。
2. 调用 `requestCode`。
3. 应返回 `email_provider_rejected` 或 `email_send_failed`。
4. 不应写入可用验证码记录。
5. 使用任何验证码登录都应失败。

## M. 回退到 disabled

1. 将 `EMAIL_AUTH_ENABLED=false` 或移除必要 Provider 配置。
2. `getCapability.email.status` 应为 `disabled`。
3. `requestCode` 应返回 `auth_provider_not_configured`。
4. 不得自动使用 mock。
- success
- errorCode
- hasSession
