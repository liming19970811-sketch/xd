# 小程序包体治理报告

生成时间：2026-07-28T21:42:22.776Z
扫描目录：`unpackage/dist/build/mp-weixin`
构建时间：2026-07-27T14:06:02.116Z
源码时间：2026-07-28T21:42:12.648Z
产物新鲜度：过期
状态：**WARNING**

## 包体总览

| 指标 | 结果 | 预警 | 阻断 |
| --- | --- | --- | --- |
| 主包 | 443.2 KB | 1.20 MB | 1.50 MB |
| 总包 | 1.20 MB | 8.00 MB | 12.00 MB |
| 文件数 | 178 | - | - |

## 分包

| 分包 | 页面数 | 文件数 | 大小 |
| --- | --- | --- | --- |
| package-ai | 5 | 20 | 430.0 KB |
| package-assets | 2 | 8 | 64.4 KB |
| package-mobile-enterprise | 7 | 28 | 266.9 KB |
| pages/service-request | 1 | 4 | 18.2 KB |
| pages/package-center | 1 | 4 | 10.2 KB |

## 最大 30 个文件

| 文件 | 大小 | 归属 |
| --- | --- | --- |
| package-ai/simple-ai-workbench/simple-ai-workbench.js | 100.0 KB | package-ai |
| package-mobile-enterprise/project-detail/project-detail.js | 81.7 KB | package-mobile-enterprise |
| package-ai/result/result.js | 79.0 KB | package-ai |
| static/logo.png | 75.2 KB | main |
| common/vendor.js | 65.0 KB | main |
| package-ai/upload/upload.js | 59.9 KB | package-ai |
| package-ai/simple-ai-workbench/simple-ai-workbench.wxml | 42.2 KB | package-ai |
| package-ai/simple-ai-workbench/simple-ai-workbench.wxss | 38.8 KB | package-ai |
| package-mobile-enterprise/project-detail/project-detail.wxml | 37.0 KB | package-mobile-enterprise |
| package-assets/my-works/my-works.js | 29.9 KB | package-assets |
| pages/index/index.wxss | 28.4 KB | main |
| package-ai/result/result.wxml | 24.3 KB | package-ai |
| package-mobile-enterprise/project-detail/project-detail.wxss | 22.1 KB | package-mobile-enterprise |
| package-ai/upload/upload.wxml | 21.9 KB | package-ai |
| package-mobile-enterprise/delivery-dashboard/delivery-dashboard.js | 20.2 KB | package-mobile-enterprise |
| package-ai/upload/upload.wxss | 17.9 KB | package-ai |
| package-mobile-enterprise/project-list/project-list.js | 17.0 KB | package-mobile-enterprise |
| package-ai/result/result.wxss | 16.5 KB | package-ai |
| package-mobile-enterprise/delivery-queue-list/delivery-queue-list.js | 15.2 KB | package-mobile-enterprise |
| utils/service/adminRepository.js | 14.2 KB | main |
| package-mobile-enterprise/batch-list/batch-list.js | 13.8 KB | package-mobile-enterprise |
| package-assets/my-works/my-works.wxss | 13.4 KB | package-assets |
| utils/constants/advancedPanelPresets.js | 12.0 KB | main |
| utils/constants/entryScenePresets.js | 11.6 KB | main |
| utils/model/modelLibrary.js | 11.4 KB | main |
| pages/index/index.js | 11.0 KB | main |
| utils/task/taskLayer.js | 10.4 KB | main |
| utils/task/taskActions.js | 10.4 KB | main |
| package-assets/my-works/my-works.wxml | 10.3 KB | package-assets |
| pages/service-request/service-request.js | 9.2 KB | pages/service-request |

## 最大图片与媒体

| 文件 | 大小 | 归属 |
| --- | --- | --- |
| static/logo.png | 75.2 KB | main |
| static/tab/home.png | 4.7 KB | main |
| static/tab/work-active.png | 4.3 KB | main |
| static/tab/work.png | 3.9 KB | main |
| static/tab/mine-active.png | 3.3 KB | main |
| static/tab/home-active.png | 3.0 KB | main |
| static/tab/mine.png | 2.8 KB | main |

## 最大 JS

| 文件 | 大小 | 归属 |
| --- | --- | --- |
| package-ai/simple-ai-workbench/simple-ai-workbench.js | 100.0 KB | package-ai |
| package-mobile-enterprise/project-detail/project-detail.js | 81.7 KB | package-mobile-enterprise |
| package-ai/result/result.js | 79.0 KB | package-ai |
| common/vendor.js | 65.0 KB | main |
| package-ai/upload/upload.js | 59.9 KB | package-ai |
| package-assets/my-works/my-works.js | 29.9 KB | package-assets |
| package-mobile-enterprise/delivery-dashboard/delivery-dashboard.js | 20.2 KB | package-mobile-enterprise |
| package-mobile-enterprise/project-list/project-list.js | 17.0 KB | package-mobile-enterprise |
| package-mobile-enterprise/delivery-queue-list/delivery-queue-list.js | 15.2 KB | package-mobile-enterprise |
| utils/service/adminRepository.js | 14.2 KB | main |
| package-mobile-enterprise/batch-list/batch-list.js | 13.8 KB | package-mobile-enterprise |
| utils/constants/advancedPanelPresets.js | 12.0 KB | main |
| utils/constants/entryScenePresets.js | 11.6 KB | main |
| utils/model/modelLibrary.js | 11.4 KB | main |
| pages/index/index.js | 11.0 KB | main |
| utils/task/taskLayer.js | 10.4 KB | main |
| utils/task/taskActions.js | 10.4 KB | main |
| pages/service-request/service-request.js | 9.2 KB | pages/service-request |
| pages/gallery/gallery.js | 7.3 KB | main |
| utils/task/taskMapper.js | 7.2 KB | main |

## 最大 WXSS

| 文件 | 大小 | 归属 |
| --- | --- | --- |
| package-ai/simple-ai-workbench/simple-ai-workbench.wxss | 38.8 KB | package-ai |
| pages/index/index.wxss | 28.4 KB | main |
| package-mobile-enterprise/project-detail/project-detail.wxss | 22.1 KB | package-mobile-enterprise |
| package-ai/upload/upload.wxss | 17.9 KB | package-ai |
| package-ai/result/result.wxss | 16.5 KB | package-ai |
| package-assets/my-works/my-works.wxss | 13.4 KB | package-assets |
| pages/gallery/gallery.wxss | 6.7 KB | main |
| package-ai/production-guide/production-guide.wxss | 5.4 KB | package-ai |
| package-mobile-enterprise/batch-detail/batch-detail.wxss | 4.5 KB | package-mobile-enterprise |
| package-ai/marketing-workbench/marketing-workbench.wxss | 4.3 KB | package-ai |
| pages/service-request/service-request.wxss | 4.0 KB | pages/service-request |
| package-mobile-enterprise/delivery-queue-list/delivery-queue-list.wxss | 3.0 KB | package-mobile-enterprise |
| pages/mine/mine.wxss | 2.9 KB | main |
| package-mobile-enterprise/batch-list/batch-list.wxss | 2.9 KB | package-mobile-enterprise |
| pages/package-center/package-center.wxss | 2.8 KB | pages/package-center |
| package-mobile-enterprise/project-list/project-list.wxss | 2.8 KB | package-mobile-enterprise |
| package-assets/task-list/task-list.wxss | 2.4 KB | package-assets |
| package-mobile-enterprise/delivery-dashboard/delivery-dashboard.wxss | 2.1 KB | package-mobile-enterprise |
| package-mobile-enterprise/delivery-action-history/delivery-action-history.wxss | 1.4 KB | package-mobile-enterprise |
| app.wxss | 191 B | main |

## 重复资源

- 48 B：`utils/api/generate.js`、`utils/cloudbase/tasksRepository.js`
- 14 B：`utils/constants/file.js`、`utils/constants/package.js`

## 可能未引用的 static 资源

无

## 主包企业与开发依赖线索

| 文件 | 匹配 |
| --- | --- |
| utils/audit/auditService.js | /auditService/i |
| utils/service/deliveryService.js | /deliveryService/i<br>/auditService/i |
| utils/service/orderService.js | /orderService/i<br>/auditService/i |
| utils/service/quoteService.js | /quoteService/i<br>/auditService/i |

## 网站分流范围

- 版型库、版型详情与派生管理
- 打版师复核队列与复核详情
- AI制版训练数据与模型评测
- 样衣协作与小单生产后台
- 企业成员权限、审计、分析、报价和订单后台
## 预警

- 当前为过期产物趋势报告，不可作为发布包体结论
- 主包发现 4 个企业后台依赖线索，请复核静态导入

## 阻断

无

## 微信限制说明

脚本参考值为主包 2.00 MB、单分包 2.00 MB、总包 20.00 MB。该值只用于趋势对照，提交时必须以微信开发者工具和官方平台的实时检测为准。

## 发布结论

未触发阻断线，但需复核预警后再准备发布。