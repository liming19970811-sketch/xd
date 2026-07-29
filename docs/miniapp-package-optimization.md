# 微信小程序轻量化 V1

## 目标与边界

小程序定位为移动 AI 生产端、作品查看端、移动审批端和客户确认端。企业数据中心、成员与角色、报价订单、审计、经营分析、Cloud Alpha 验收及官网页面继续保留源码，但不注册到正式 `MP-WEIXIN` 构建。

本次没有修改任务创建、`taskLayer`、`generate_wanx`、额度、Provider、支付、云函数业务逻辑、Repository/Service 公共 API 或真实生成流程。

## 页面分包

### 主包

- `pages/index/index`
- `pages/gallery/gallery`
- `pages/mine/mine`

三页均为 tabBar 必需页面，因此必须留在主包。

### package-ai

- `production-guide/production-guide`
- `simple-ai-workbench/simple-ai-workbench`
- `marketing-workbench/marketing-workbench`
- `upload/upload`
- `result/result`

首页只预加载该高频分包。生成链路仍复用原实现。

### package-assets

- `my-works/my-works`
- `task-list/task-list`

用于作品、设计方案、商品资料包与轻量生产记录查看。

### package-mobile-enterprise

- `project-list/project-list`
- `project-detail/project-detail`
- `batch-list/batch-list`
- `batch-detail/batch-detail`
- `delivery-queue-list/delivery-queue-list`
- `delivery-dashboard/delivery-dashboard`
- `delivery-action-history/delivery-action-history`

仅保留移动项目概览、审批、客户确认、交付状态和记录。

### 其他轻分包

- `pages/service-request`
- `pages/package-center`

## H5 专属页面

以下页面通过 `#ifdef H5` 注册，正式微信小程序不包含：

- `pages/workspace`
- `pages/admin`
- `pages/task-admin`
- `pages/order-admin`
- `pages/project-admin`
- `pages/lead-detail`
- 官网服务、价格、案例、企业合作和需求提交页面
- `pages/enterprise-web`

Cloud Alpha 验收仍位于 H5 后台源码中；正式微信构建不注册后台页面，也不生成对应 WXML/WXSS/页面 JS。

## 导航迁移

原页面目录迁移后，项目内导航统一更新为：

- `/package-ai/...`
- `/package-assets/...`
- `/package-mobile-enterprise/...`

首页四个 AI 主入口仍进入 `simple-ai-workbench`，快速目标入口仍进入 `production-guide`。小程序中的专业企业入口改为提示使用企业网页版；H5 继续进入原 `workspace`。

## 编译优化

`manifest.json` 已启用：

- `optimization.subPackages = true`
- `lazyCodeLoading = requiredComponents`
- WXML/WXSS/JS 压缩设置

`App.vue` 只保留必要生命周期，云初始化仍由现有 `main.js` 负责，避免重复初始化和全局启动日志。

## 静态资源

- 最大图片为 `static/logo.png`，约 75.2KB，低于 100KB 警戒线。
- tabBar 图标均低于 5KB。
- 未发现超过 100KB 的图片或字体文件。
- 未引入示例图库、高清营销模板或新外部资源。
- 发现的重复文件均为十余字节级空壳模块，不值得以兼容风险换取删除。

## 包体数据

### 优化前（开发构建，同口径）

| 包 | 大小 |
| --- | ---: |
| 主包 | 1.40MB |
| 最大分包 `pages/workspace` | 543.3KB |
| `pages/admin` | 418.7KB |
| `pages/simple-ai-workbench` | 238.5KB |
| 总包 | 3.71MB |

最大文件为 `pages/workspace/workspace.js`，约 315.3KB；其次为 `pages/admin/admin.js`，约 229.7KB。

### 优化后（开发构建，同口径）

| 包 | 大小 |
| --- | ---: |
| 主包 | 868.6KB |
| `package-ai` | 599.0KB |
| `package-mobile-enterprise` | 378.6KB |
| `package-assets` | 95.3KB |
| `pages/service-request` | 26.0KB |
| `pages/package-center` | 13.4KB |
| 总包 | 1.93MB |

开发构建主包减少约 39.4%，总包减少约 48.0%。

### 优化后（正式发行构建）

| 包 | 大小 |
| --- | ---: |
| 主包 | 443.2KB |
| `package-ai` | 430.0KB |
| `package-mobile-enterprise` | 266.9KB |
| `package-assets` | 64.4KB |
| `pages/service-request` | 18.2KB |
| `pages/package-center` | 10.2KB |
| 总包 | 1.20MB |

主包、每个分包和总包均低于项目目标及微信限制。正式产物没有超过 200KB 的单文件。

## 审计命令

```powershell
node scripts/mp-package-audit.js --root unpackage/dist/dev/mp-weixin --label dev
node scripts/mp-package-audit.js --root unpackage/dist/build/mp-weixin --label release
node scripts/mp-package-audit.js --root unpackage/dist/build/mp-weixin --json
```

审计内容包括主包/分包/总包、最大 30 个文件、图片、JS、WXSS、重复资源、主包企业/开发模块、警戒线和未注册导航目标。

## 后续优化建议

uni-app 会把移动项目详情引用的少量共享 Repository/Service 文件输出到根目录，但主包页面没有静态导入报价、订单、交付或审计 Service；这些能力只由移动企业分包页面使用。下一阶段可为移动企业页面建立分包内适配层，进一步减少根目录共享文件。
