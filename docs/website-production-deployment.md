# 官网生产部署与域名上线 V1

## 环境

- development：本地开发，允许使用本地预览和开发 mock。
- staging：预发布验收，必须使用 HTTPS、正式云环境或预发布云环境，不允许 mock API。
- production：正式网站，域名固定为 `https://www.diebiandesign.com`，不允许 localhost、mock API、测试云函数或硬编码密钥进入构建产物。

## 环境变量

只列名称，不记录密钥值：

- `DIEBIAN_DEPLOY_ENV`
- `DIEBIAN_SITE_DOMAIN`
- `DIEBIAN_API_BASE`
- `DIEBIAN_CLOUDBASE_ENV_ID`
- `DIEBIAN_FILE_DOMAIN`
- `DIEBIAN_LOGIN_CALLBACK_URL`
- `DIEBIAN_LOG_ENV`
- `DIEBIAN_ENABLE_MOCK`
- `DIEBIAN_ENABLE_DEV_API`
- `DIEBIAN_FEATURE_FLAGS`
- `DIEBIAN_TCB_TARGET_PATH`

复制 `.env.h5.production.example` 为 `.env.h5.production.local` 后填写真实配置。不要提交 `.local` 文件。

## 构建与预览

```powershell
npm run build:h5 -- --env production
npm run preview:h5
```

如果命令行缺少 `vue-cli-service`，使用 HBuilderX 执行 H5 生产构建，产物目录仍为：

```text
unpackage/dist/build/web
```

预览脚本会把不存在的路径回退到 `index.html`，用于验证工作台刷新不 404。

## 发布前检查

```powershell
npm run preflight:h5:production
```

检查项：

- H5 构建产物是否存在。
- 生产变量是否完整。
- 生产域名是否为 HTTPS。
- 是否误带 localhost、mock API、临时图片地址。
- 是否误带常见 API Key、云密钥、Bearer token 或私钥片段。
- SEO、robots、sitemap、私有页 noindex 策略。

检查失败会阻止部署。

## 部署

预发布：

```powershell
npm run deploy:staging
```

生产：

```powershell
npm run deploy:production
```

部署脚本会先执行对应环境 preflight，再调用：

```powershell
tcb hosting deploy unpackage/dist/build/web / -e <DIEBIAN_CLOUDBASE_ENV_ID>
```

需要提前完成：

- 安装并登录 `tcb` CLI。
- 开通 CloudBase 静态网站托管。
- 绑定正式域名 `www.diebiandesign.com`。
- 配置 HTTPS 证书。
- 配置 SPA 路由回退到 `index.html`。
- 配置 HTTP 到 HTTPS 跳转。
- 配置静态资源压缩和缓存。

## 发布验证

- 首页打开。
- 登录与退出。
- `/`, `/#/workspace`, `/#/help`, `/#/enterprise-solution`, `/#/case-center` 刷新正常。
- 未登录访问工作台跳登录并保留目标地址。
- 企业切换后项目、任务、作品、版型不串数据。
- AI 出图任务创建。
- AI 制版任务创建。
- 版型库读取。
- 项目与批次读取。
- 上传进入云存储。
- 私有作品和版型下载使用临时授权链接。
- 手机端和微信内置浏览器访问。
- 控制台无白屏错误和敏感日志。

## 回滚

CloudBase 静态托管建议保留最近一次稳定构建产物归档：

```text
deliverables/h5-releases/<version>/
```

严重错误时重新部署上一稳定版本：

```powershell
tcb hosting deploy deliverables/h5-releases/<version> / -e <DIEBIAN_CLOUDBASE_ENV_ID>
```

回滚只替换静态资源，不覆盖数据库、云存储和云函数数据。
