# 官网与专业工作台发布验收报告 V1

生成时间：2026-07-28T01:42:32.794Z
扫描对象：H5 构建产物
扫描目录：`unpackage\dist\build\web`

## 路由与拆分边界
- H5 根路径进入官网：通过
- /workspace 路由可映射工作台：通过
- /help 路由可映射帮助中心：通过
- 私有路由 noindex 策略：通过

## SEO 检查
- robots.txt 存在：通过
- sitemap.xml 存在：通过
- robots 阻止私有页面：通过
- sitemap 仅包含公开页面：通过
- index 默认 description：通过
- Open Graph 基础信息：通过

## 敏感信息扫描
- 未发现常见 API Key、云密钥、Bearer token 或私钥片段。

## 大文件检查
### 超过 200KB 的文件
- `unpackage/dist/build/web/assets/index-DJ-N7HPy.js`：329.7KB
- `unpackage/dist/build/web/assets/pages-workspace-workspace.2Tc2uThU.js`：323.5KB
- `unpackage/dist/build/web/assets/pages-admin-admin.Cn0xrUZu.js`：267.8KB

### 超过 100KB 的图片/媒体
无

## 最大 JS 文件
- `unpackage/dist/build/web/assets/index-DJ-N7HPy.js`：329.7KB
- `unpackage/dist/build/web/assets/pages-workspace-workspace.2Tc2uThU.js`：323.5KB
- `unpackage/dist/build/web/assets/pages-admin-admin.Cn0xrUZu.js`：267.8KB
- `unpackage/dist/build/web/assets/package-ai-simple-ai-workbench-simple-ai-workbench.DCut80WK.js`：131.5KB
- `unpackage/dist/build/web/assets/package-ai-upload-upload.Bq1n8OSY.js`：117.8KB
- `unpackage/dist/build/web/assets/package-mobile-enterprise-project-detail-project-detail.BN99_kfk.js`：111.3KB
- `unpackage/dist/build/web/assets/package-ai-result-result.CSlWsQ9A.js`：100.2KB
- `unpackage/dist/build/web/assets/pages-website-demand-website-demand.DjSe2fYS.js`：57.7KB
- `unpackage/dist/build/web/assets/adminRepository.BN4V1dRP.js`：46.7KB
- `unpackage/dist/build/web/assets/package-assets-my-works-my-works.DkpD4Yu8.js`：38.4KB
- `unpackage/dist/build/web/assets/package-mobile-enterprise-delivery-dashboard-delivery-dashboard.CFLWLvlp.js`：27.5KB
- `unpackage/dist/build/web/assets/pages-index-index.Cnfppn31.js`：25.9KB
- `unpackage/dist/build/web/assets/package-mobile-enterprise-delivery-queue-list-delivery-queue-list.DnwRl9EH.js`：22.2KB
- `unpackage/dist/build/web/assets/package-mobile-enterprise-project-list-project-list.B_YK-lFA.js`：21.5KB
- `unpackage/dist/build/web/assets/package-mobile-enterprise-batch-list-batch-list.D453sZd9.js`：18.2KB

## 最大 CSS 文件
- `unpackage/dist/build/web/assets/workspace-BaVuH02M.css`：113.1KB
- `unpackage/dist/build/web/assets/admin-IcEbEdST.css`：88.4KB
- `unpackage/dist/build/web/assets/website-demand-CIaD4YX5.css`：47.0KB
- `unpackage/dist/build/web/assets/simple-ai-workbench-VT2AEGQ9.css`：41.2KB
- `unpackage/dist/build/web/assets/index-2CPmuTjM.css`：29.8KB
- `unpackage/dist/build/web/assets/project-detail-Cu5pM3dW.css`：23.7KB
- `unpackage/dist/build/web/assets/uni.8582521b.css`：21.5KB
- `unpackage/dist/build/web/assets/upload-ChE8we_n.css`：18.9KB
- `unpackage/dist/build/web/assets/result-CUiV6DNz.css`：17.4KB
- `unpackage/dist/build/web/assets/my-works-DZGM6Mi9.css`：14.2KB
- `unpackage/dist/build/web/assets/index-BPFd6J6e.css`：12.1KB
- `unpackage/dist/build/web/assets/gallery-FbWgMM0s.css`：7.0KB
- `unpackage/dist/build/web/assets/production-guide-Cc9uu0op.css`：5.8KB
- `unpackage/dist/build/web/assets/enterprise-solution-Bj3Y7zJA.css`：5.7KB
- `unpackage/dist/build/web/assets/batch-detail-Dycv0N-8.css`：4.8KB

## 最大图片/媒体文件
- `unpackage/dist/build/web/assets/logo-DSTYpRqF.png`：75.2KB
- `unpackage/dist/build/web/static/logo.png`：75.2KB
- `unpackage/dist/build/web/static/tab/home.png`：4.7KB
- `unpackage/dist/build/web/static/tab/work-active.png`：4.3KB
- `unpackage/dist/build/web/static/tab/work.png`：3.9KB
- `unpackage/dist/build/web/static/tab/mine-active.png`：3.3KB
- `unpackage/dist/build/web/static/tab/home-active.png`：3.0KB
- `unpackage/dist/build/web/static/tab/mine.png`：2.8KB

## 人工发布前仍需验证
- HBuilderX 执行 H5 生产构建。
- 刷新 `/`, `/#/workspace`, `/#/help`, `/#/enterprise-solution`, `/#/case-center`。
- 未登录访问工作台、企业后台和 developer 页面。
- 不同角色权限、企业切换、项目/任务/资产隔离。
- 桌面 1920/1440/1024、平板 768、手机宽度响应式。
- 核心创建任务、结果页、下载与交付流程。
- 浏览器控制台无白屏错误；生产日志不包含 token、手机号、邮箱和完整临时图片地址。