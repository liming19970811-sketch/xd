# 小程序包体审计报告

生成时间：2026-07-28T02:23:07.535Z
扫描目录：`unpackage/dist/build/mp-weixin`
产物构建时间：2026-07-27T14:06:02.116Z
小程序源码最新时间：2026-07-28T02:18:39.694Z
产物新鲜度：已过期，必须重新正式构建

## 总览

| 指标 |结果 |
| --- | --- |
| 主包大小 | 443.2 KB |
| 全部代码包总大小 | 1.20 MB |
| 文件数量 | 178 |
| 普通分包数量 | 5 |
| 独立分包数量 | 0 |
| 云函数目录 | 未出现在 mp-weixin 编译产物中 |
| enterprise-web | 未出现在 MP-WEIXIN 编译产物中 |
| Cloud Alpha 页面 | 未进入 MP-WEIXIN 编译产物 |

## 分包大小

| 类型 |分包 |页面数 |文件数 |大小 |
| --- | --- | --- | --- | --- |
| 普通分包 | package-ai | 5 | 20 | 430.0 KB |
| 普通分包 | package-assets | 2 | 8 | 64.4 KB |
| 普通分包 | package-mobile-enterprise | 7 | 28 | 266.9 KB |
| 普通分包 | pages/service-request | 1 | 4 | 18.2 KB |
| 普通分包 | pages/package-center | 1 | 4 | 10.2 KB |

## 最大 50 个文件

| 文件 |大小 |
| --- | --- |
| package-ai/simple-ai-workbench/simple-ai-workbench.js | 100.0 KB |
| package-mobile-enterprise/project-detail/project-detail.js | 81.7 KB |
| package-ai/result/result.js | 79.0 KB |
| static/logo.png | 75.2 KB |
| common/vendor.js | 65.0 KB |
| package-ai/upload/upload.js | 59.9 KB |
| package-ai/simple-ai-workbench/simple-ai-workbench.wxml | 42.2 KB |
| package-ai/simple-ai-workbench/simple-ai-workbench.wxss | 38.8 KB |
| package-mobile-enterprise/project-detail/project-detail.wxml | 37.0 KB |
| package-assets/my-works/my-works.js | 29.9 KB |
| pages/index/index.wxss | 28.4 KB |
| package-ai/result/result.wxml | 24.3 KB |
| package-mobile-enterprise/project-detail/project-detail.wxss | 22.1 KB |
| package-ai/upload/upload.wxml | 21.9 KB |
| package-mobile-enterprise/delivery-dashboard/delivery-dashboard.js | 20.2 KB |
| package-ai/upload/upload.wxss | 17.9 KB |
| package-mobile-enterprise/project-list/project-list.js | 17.0 KB |
| package-ai/result/result.wxss | 16.5 KB |
| package-mobile-enterprise/delivery-queue-list/delivery-queue-list.js | 15.2 KB |
| utils/service/adminRepository.js | 14.2 KB |
| package-mobile-enterprise/batch-list/batch-list.js | 13.8 KB |
| package-assets/my-works/my-works.wxss | 13.4 KB |
| utils/constants/advancedPanelPresets.js | 12.0 KB |
| utils/constants/entryScenePresets.js | 11.6 KB |
| utils/model/modelLibrary.js | 11.4 KB |
| pages/index/index.js | 11.0 KB |
| utils/task/taskLayer.js | 10.4 KB |
| utils/task/taskActions.js | 10.4 KB |
| package-assets/my-works/my-works.wxml | 10.3 KB |
| pages/service-request/service-request.js | 9.2 KB |
| package-mobile-enterprise/delivery-dashboard/delivery-dashboard.wxml | 8.6 KB |
| package-mobile-enterprise/delivery-queue-list/delivery-queue-list.wxml | 8.4 KB |
| pages/gallery/gallery.js | 7.3 KB |
| utils/task/taskMapper.js | 7.2 KB |
| package-ai/production-guide/production-guide.js | 7.2 KB |
| pages/gallery/gallery.wxss | 6.7 KB |
| utils/data-provider/cloudProvider.js | 6.6 KB |
| package-assets/task-list/task-list.js | 6.3 KB |
| pages/index/index.wxml | 6.1 KB |
| utils/task/deliveryActionHistory.js | 6.0 KB |
| package-mobile-enterprise/project-list/project-list.wxml | 5.7 KB |
| utils/constants/membershipPlans.js | 5.6 KB |
| package-ai/production-guide/production-guide.wxss | 5.4 KB |
| package-mobile-enterprise/batch-detail/batch-detail.js | 5.2 KB |
| package-mobile-enterprise/batch-list/batch-list.wxml | 5.2 KB |
| pages/service-request/service-request.wxml | 5.0 KB |
| utils/cloudbase/batchesRepository.js | 4.9 KB |
| package-ai/marketing-workbench/marketing-workbench.js | 4.7 KB |
| static/tab/home.png | 4.7 KB |
| package-mobile-enterprise/batch-detail/batch-detail.wxss | 4.5 KB |

## 最大 JS 文件

| 文件 |大小 |
| --- | --- |
| package-ai/simple-ai-workbench/simple-ai-workbench.js | 100.0 KB |
| package-mobile-enterprise/project-detail/project-detail.js | 81.7 KB |
| package-ai/result/result.js | 79.0 KB |
| common/vendor.js | 65.0 KB |
| package-ai/upload/upload.js | 59.9 KB |
| package-assets/my-works/my-works.js | 29.9 KB |
| package-mobile-enterprise/delivery-dashboard/delivery-dashboard.js | 20.2 KB |
| package-mobile-enterprise/project-list/project-list.js | 17.0 KB |
| package-mobile-enterprise/delivery-queue-list/delivery-queue-list.js | 15.2 KB |
| utils/service/adminRepository.js | 14.2 KB |
| package-mobile-enterprise/batch-list/batch-list.js | 13.8 KB |
| utils/constants/advancedPanelPresets.js | 12.0 KB |
| utils/constants/entryScenePresets.js | 11.6 KB |
| utils/model/modelLibrary.js | 11.4 KB |
| pages/index/index.js | 11.0 KB |
| utils/task/taskLayer.js | 10.4 KB |
| utils/task/taskActions.js | 10.4 KB |
| pages/service-request/service-request.js | 9.2 KB |
| pages/gallery/gallery.js | 7.3 KB |
| utils/task/taskMapper.js | 7.2 KB |

## 最大 WXSS 文件

| 文件 |大小 |
| --- | --- |
| package-ai/simple-ai-workbench/simple-ai-workbench.wxss | 38.8 KB |
| pages/index/index.wxss | 28.4 KB |
| package-mobile-enterprise/project-detail/project-detail.wxss | 22.1 KB |
| package-ai/upload/upload.wxss | 17.9 KB |
| package-ai/result/result.wxss | 16.5 KB |
| package-assets/my-works/my-works.wxss | 13.4 KB |
| pages/gallery/gallery.wxss | 6.7 KB |
| package-ai/production-guide/production-guide.wxss | 5.4 KB |
| package-mobile-enterprise/batch-detail/batch-detail.wxss | 4.5 KB |
| package-ai/marketing-workbench/marketing-workbench.wxss | 4.3 KB |
| pages/service-request/service-request.wxss | 4.0 KB |
| package-mobile-enterprise/delivery-queue-list/delivery-queue-list.wxss | 3.0 KB |
| pages/mine/mine.wxss | 2.9 KB |
| package-mobile-enterprise/batch-list/batch-list.wxss | 2.9 KB |
| pages/package-center/package-center.wxss | 2.8 KB |
| package-mobile-enterprise/project-list/project-list.wxss | 2.8 KB |
| package-assets/task-list/task-list.wxss | 2.4 KB |
| package-mobile-enterprise/delivery-dashboard/delivery-dashboard.wxss | 2.1 KB |
| package-mobile-enterprise/delivery-action-history/delivery-action-history.wxss | 1.4 KB |
| app.wxss | 191 B |

## 最大图片和媒体文件

| 文件 |大小 |
| --- | --- |
| static/logo.png | 75.2 KB |
| static/tab/home.png | 4.7 KB |
| static/tab/work-active.png | 4.3 KB |
| static/tab/work.png | 3.9 KB |
| static/tab/mine-active.png | 3.3 KB |
| static/tab/home-active.png | 3.0 KB |
| static/tab/mine.png | 2.8 KB |

## 超过 100KB 的图片

无

## 超过 200KB 的单文件

无

## 重复文件

- 48 B：`utils/api/generate.js`、`utils/cloudbase/tasksRepository.js`
- 14 B：`utils/constants/file.js`、`utils/constants/package.js`

## 主包中出现的企业模块

| 文件 |匹配 |
| --- | --- |
| utils/audit/auditService.js | /auditService/i |
| utils/service/deliveryService.js | /auditService/i |
| utils/service/orderService.js | /orderService/i<br>/auditService/i |
| utils/service/quoteService.js | /quoteService/i<br>/auditService/i |

## 主包中出现的开发调试模块

| 文件 |匹配 |
| --- | --- |
| common/vendor.js | /debug/i |
| project.private.config.json | /debug/i |
| utils/api/leads.js | /debug/i |
| utils/data-provider/cloudProvider.js | /enterprise_data/i<br>/debug/i |
| utils/repository/enterpriseRepository.js | /enterprise_data/i |

## 当前页面结构

主包页面：`pages/index/index`、`pages/mine/mine`、`pages/gallery/gallery`

预加载：`pages/index/index`

## 不计入小程序上传包的项目目录

- `node_modules`
- `docs`
- `scripts`
- `cloudfunctions` 源码
- H5 页面源码中未注册到 MP-WEIXIN 的页面

## 结论

- 主包当前低于 1.2MB 目标。
- package-ai 低于 1.5MB 单分包目标。
- package-assets 低于 1.5MB 单分包目标。
- package-mobile-enterprise 低于 1.5MB 单分包目标。
- pages/service-request 低于 1.5MB 单分包目标。
- pages/package-center 低于 1.5MB 单分包目标。
- 总包当前低于 8MB 目标。
- 当前正式产物早于源码，不得作为本轮发布产物。
- 审计结论：不可发布。
