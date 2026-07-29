# 企业身份 Alpha 验收 Runbook

本文档用于验收企业网页版 V3.0.2 的微信开放平台网站应用扫码登录适配层。自动测试通过不等于真实微信扫码验收通过；真实验收必须具备已审核通过的网站应用、正确 AppID/AppSecret 和回调域名。

## A. 前置条件

1. 微信开放平台已创建网站应用。
2. 网站应用已审核通过。
3. 授权回调域名已配置到当前 H5 域名。
4. H5 路由存在：`/pages/enterprise-web/auth-callback`。
5. 云函数 `enterprise_auth` 已部署。

## B. 云函数环境变量

在 `enterprise_auth` 云函数环境变量中配置：

- `WECHAT_WEB_APP_ID`
- `WECHAT_WEB_APP_SECRET`
- `WECHAT_WEB_REDIRECT_URI`
- `WECHAT_WEB_AUTH_ENABLED=true`

缺少任一配置或未显式启用时，系统必须保持：

- `authCapability=placeholder`
- 不允许返回 `cloud_authenticated`
- 登录页显示“微信开放平台网站应用尚未配置完成”
- 仅允许用户显式点击“使用本地模拟身份”进入 `local_mock`

## C. 部署 enterprise_auth

1. 打开微信开发者工具。
2. 右键 `cloudfunctions/enterprise_auth`。
3. 选择“上传并部署：云端安装依赖”。
4. 确认云函数日志不输出 AppSecret、code、sessionToken、OPENID、UNIONID。

## D. H5 启动与回调检查

1. 打开 H5 企业登录页：`/pages/enterprise-web/login`。
2. 点击“微信扫码登录”。
3. 配置完整时应返回微信开放平台授权地址。
4. 授权完成后微信回调到 `WECHAT_WEB_REDIRECT_URI`，该地址应指向 `/pages/enterprise-web/auth-callback` 并携带 `code`、`state`。
5. 回调页不得展示 `code`、`state`、`sessionToken`。

## E. placeholder 验收

1. 不配置 `WECHAT_WEB_APP_SECRET` 或将 `WECHAT_WEB_AUTH_ENABLED` 设为非 true。
2. 点击“微信扫码登录”。
3. 应显示 `wechat_auth_not_configured` 或对应中文提示。
4. 不得创建 `cloud_authenticated` session。
5. 不得自动进入企业工作台。
6. 点击“使用本地模拟身份”后才允许进入 `local_mock`。

## F. 真实扫码验收

1. 配置完整环境变量。
2. 点击“微信扫码登录”并打开授权地址。
3. 微信扫码确认授权。
4. 回调页调用 `completeWechatWebLogin`。
5. 云函数完成 code 交换和身份哈希映射。
6. 前端收到 `cloud_authenticated` session。
7. 已有 active 企业成员进入 Dashboard；多企业进入选择企业；无企业进入注册页。

## G. state 安全测试

1. 使用错误 state 调用回调，应返回 `auth_state_invalid`。
2. 使用过期 state，应返回 `auth_state_expired`。
3. 同一 state 重复回调，应返回 `auth_state_used`。
4. code 缺失，应返回 `auth_code_missing`。
5. state 记录只保存 hash，不保存明文 code。

## H. Session 测试

1. 登录成功后前端只保存 `sessionToken`。
2. 云端只保存 token hash。
3. 刷新页面时调用 `restoreSession` 云端校验 token。
4. token 无效返回 `session_invalid`。
5. token 过期返回 `session_expired`。
6. 退出登录后调用 `logout`，token 立即失效。

## I. 企业注册与切换

1. `cloud_authenticated` 或用户显式选择的 `local_mock` 才能注册企业。
2. 注册创建 Enterprise 和 admin Member。
3. 同一 `idempotencyKey` 重复提交返回同一企业。
4. 企业切换只允许当前用户的 active Member。
5. pending / disabled Member 返回 `member_inactive`。

## J. 敏感信息检查

禁止在页面、日志、文档示例中输出：

- AppSecret
- code
- sessionToken
- OPENID
- UNIONID
- 云凭证

允许输出布尔诊断：

- `hasOpenid`
- `hasUnionid`
- `hasAppid`
- `identityAvailable`
- `authCapability`

## K. 回退方式

当微信开放平台网站应用未审核通过或配置异常时：

1. 将 `WECHAT_WEB_AUTH_ENABLED` 设为 false 或移除配置。
2. 系统自动回到 `authCapability=placeholder`。
3. 业务演示可由用户显式点击“使用本地模拟身份”进入。
4. 不允许云失败自动降级为 `local_mock`。
