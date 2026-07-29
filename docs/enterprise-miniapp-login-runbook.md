# 企业网页版小程序扫码登录 Runbook

本文档用于验收蝶变企业网页版 V3.2：H5 创建一次性登录 ticket，小程序扫码确认，H5 消费 ticket 并获得 `cloud_authenticated` Session。

## 1. 创建集合

在云开发数据库中准备以下集合：

- `enterprise_web_login_tickets`：保存 ticket hash、状态、确认人和过期时间。
- `enterprise_auth_sessions`：复用现有企业网页登录 Session 集合。
- `enterprise_auth_identities`：复用现有身份映射集合。
- `enterprise_auth_users`：复用现有用户集合。
- `enterprises`：复用现有企业与成员关系集合。

`enterprise_web_login_tickets` 只保存 `ticketHash`，不要保存明文 `loginTicket`。

## 2. 部署云函数

新增云函数：

- `cloudfunctions/enterprise_web_login`

建议使用微信开发者工具右键“上传并部署：云端安装依赖”。不要在日志中输出完整 ticket、OPENID 或 sessionToken。

## 3. H5 创建 ticket

打开：

- `/pages/enterprise-web/login`

点击：

- 使用蝶变小程序扫码登录

进入：

- `/pages/enterprise-web/miniapp-login`

页面会调用 `enterprise_web_login.createTicket`，返回：

- `loginTicket`
- `expiresAt`
- `qrPayload`
- `pollIntervalMs`

当前阶段若未接入正式小程序码生成，页面展示开发占位二维码和小程序确认路径。

## 4. 小程序扫码

二维码 payload 应指向：

`/package-mobile-enterprise/web-login-confirm/web-login-confirm?ticket=一次性loginTicket`

如未生成正式小程序码，可在开发阶段复制该路径，在微信开发者工具中打开确认页并携带 `ticket` 参数。

## 5. 小程序确认

确认页调用：

- `getConfirmContext`
- `confirmTicket`

云函数必须使用 `cloud.getWXContext().OPENID` 获取可信身份。小程序端不得传入或伪造：

- `userId`
- `openId`
- `unionId`
- `role`

小程序只能提交：

- `loginTicket`
- 用户选择的 `enterpriseId`（可选）

## 6. H5 轮询与 Session 创建

H5 每 2 秒调用：

- `getTicketStatus`

当状态为 `confirmed` 时调用：

- `consumeTicket`

成功后返回 `authProvider=miniapp_scan` 的 `cloud_authenticated` Session，并写入现有：

- `authSessionService`
- `authRepository`
- `authContext`

## 7. 多企业选择

如果同一用户有多个 active 企业，H5 登录成功后进入：

- `/pages/enterprise-web/select-enterprise`

pending / disabled 成员不可选择。

## 8. 无企业注册

如果扫码用户没有 active 企业成员关系，H5 登录成功后进入：

- `/pages/enterprise-web/register`

企业注册继续复用 `enterpriseRegistrationService`，不复制第二套注册逻辑。

## 9. Ticket 过期

Ticket 建议 5 分钟有效。过期后：

- 小程序确认页显示过期。
- H5 登录页显示过期并允许重新生成。

## 10. Ticket 重放

Ticket 只能确认一次、消费一次。重复消费必须返回：

- `ticket_consumed`

不得再次签发 Session。

## 11. 取消登录

H5 取消或重新生成时调用：

- `cancelTicket`

小程序确认前如果 ticket 已取消，应显示明确取消状态。

## 12. 日志敏感信息检查

日志只允许输出：

- action
- status
- ticketId
- hasOpenid
- memberStatus
- errorCode

禁止输出：

- 完整 loginTicket
- OPENID
- UNIONID
- sessionToken
- 企业敏感数据

## 13. 回退方案

如果云函数不可用或身份不可用：

- H5 显示失败状态。
- 不自动降级到 `local_mock`。
- 只有用户显式点击“本地模拟身份”才允许进入 local_mock。

## 14. 真实手机验收

自动 smoke 只能证明 ticket 流程正确。真实扫码还需要人工确认：

1. 部署 `enterprise_web_login`。
2. 在 H5 打开小程序扫码登录页。
3. 使用真实小程序扫码或开发者工具打开确认路径。
4. 小程序展示当前用户和可进入企业。
5. 点击确认后，H5 自动进入企业选择页、注册页或 Dashboard。
6. 刷新 H5 后 Session 可恢复。
7. 退出登录后 Session 失效。
8. 云函数日志不包含 ticket、OPENID、sessionToken。

## 15. 为什么普通 H5 不能直接 wx.cloud.callFunction

`wx.cloud.callFunction` 是微信小程序运行环境能力。普通浏览器 H5 页面没有小程序 `wx.cloud` 上下文，因此企业网页必须走独立 HTTPS API。

本项目现在区分两条 transport：

- MP-WEIXIN：继续调用 `enterprise_web_login` Event 云函数。
- H5：调用 `enterprise_web_login_http` HTTP 云函数。

云失败不得自动降级为 `local_mock`。

## 16. HTTP 云函数部署方式

新增 HTTP 云函数：

- `cloudfunctions/enterprise_web_login_http`

HTTP 函数需要：

- `index.js`
- `package.json`
- `scf_bootstrap`

部署后需要在云开发网关或函数 HTTP 访问中配置浏览器可访问的 HTTPS 地址。

## 17. H5 API Base 配置

H5 页面读取：

- `ENTERPRISE_WEB_LOGIN_HTTP_ENABLED=true`
- `ENTERPRISE_WEB_LOGIN_API_BASE=https://你的网页登录接口地址`

如果未显式启用或未配置 API Base，H5 显示：

`H5 登录接口尚未配置`

前端不得保存云函数密钥、Secret 或管理凭证。

## 18. CORS 域名配置

HTTP 云函数读取：

- `ENTERPRISE_WEB_ALLOWED_ORIGINS`

示例：

`https://www.diebiandesign.com,http://localhost:8080`

要求：

- 请求 `Origin` 必须匹配白名单。
- 生产环境禁止 `*`。
- `localhost` 仅 development 环境允许。
- OPTIONS 预检应正常返回。

## 19. localhost 开发配置

开发环境允许：

- `ENTERPRISE_WEB_LOGIN_HTTP_ENABLED=true`
- `ENTERPRISE_WEB_LOGIN_API_BASE=http://localhost:9000`
- `ENTERPRISE_WEB_ALLOWED_ORIGINS=http://localhost:8080`

正式环境必须使用 HTTPS。

## 20. HTTP create ticket 测试

向 HTTP API 发送：

```json
{
  "action": "createTicket",
  "clientId": "dev-client"
}
```

应返回：

- `success=true`
- `status=pending`
- `loginTicket`
- `qrPayload`
- `expiresAt`

数据库只保存 `ticketHash`，不保存明文 `loginTicket`。

## 21. 小程序确认测试

小程序确认页继续调用 `enterprise_web_login` Event 云函数：

- `getConfirmContext`
- `confirmTicket`

HTTP 接口不得开放这两个 action。

## 22. H5 轮询测试

H5 每 2 秒通过 HTTP 调用：

- `getTicketStatus`

只返回 ticket 状态，不返回 OPENID、用户身份、企业敏感字段或 session hash。

## 23. Session 消费测试

ticket 状态变为 `confirmed` 后，H5 通过 HTTP 调用：

- `consumeTicket`

成功后写入现有 `authSessionService`，获得：

- `authMode=cloud_authenticated`
- `authProvider=miniapp_scan`

重复消费必须返回 `ticket_consumed`。

## 24. 安全日志检查

HTTP 云函数日志只允许输出：

- action
- status
- ticketId
- hasOpenid 布尔值
- errorCode

禁止输出：

- 完整 loginTicket
- OPENID
- UNIONID
- sessionToken
- session hash
