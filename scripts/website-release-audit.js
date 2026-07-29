const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')
const BUILD_DIR = path.join(ROOT, 'unpackage', 'dist', 'build', 'web')
const REPORT_PATH = path.join(ROOT, 'docs', 'website-release-report.md')
const PUBLIC_ROUTES = ['/', '/#/enterprise-solution', '/#/case-center', '/#/help']
const ROBOTS_PRIVATE_MARKERS = ['#/workspace', '#/developer', '#/enterprise-web', '/pages/workspace/', '/pages/developer/', '/pages/enterprise-web/']
const SEO_PRIVATE_MARKERS = [
  '/workspace',
  '/pages/workspace/',
  '/enterprise-web',
  '/pages/enterprise-web/',
  '/developer',
  '/pages/developer/',
  '/admin',
  '/pages/admin/',
  'projectId=',
  'taskId=',
  'assetId=',
  'batchId=',
  'deliveryId='
]
const SENSITIVE_PATTERNS = [
  { name: 'DashScope API Key', pattern: /sk-[A-Za-z0-9]{16,}/ },
  { name: 'Cloud secret id', pattern: /AKID[A-Za-z0-9]{16,}/ },
  { name: 'Cloud secret key field', pattern: /(secretKey|apiSecret|DASHSCOPE_API_KEY|AI_API_KEY)\s*[:=]\s*['"][^'"]{8,}/i },
  { name: 'Bearer token literal', pattern: /Bearer\s+[A-Za-z0-9._-]{20,}/i },
  { name: 'Private key block', pattern: /-----BEGIN\s+(RSA\s+)?PRIVATE\s+KEY-----/i }
]
const SKIP_DIRS = new Set(['node_modules', '.git', 'unpackage/dist/dev', 'ms-playwright_backup', 'npm-cache_backup', 'tools_backup'])
const TEXT_EXT = new Set(['.js', '.css', '.html', '.json', '.xml', '.txt', '.map'])
const MEDIA_EXT = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg', '.mp4', '.mov'])

function exists(file) {
  return fs.existsSync(file)
}

function walk(dir, files = []) {
  if (!exists(dir)) return files
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    const rel = path.relative(ROOT, full).replace(/\\/g, '/')
    if (entry.isDirectory()) {
      if ([...SKIP_DIRS].some((skip) => rel === skip || rel.startsWith(`${skip}/`))) continue
      walk(full, files)
    } else {
      files.push(full)
    }
  }
  return files
}

function sizeKb(bytes) {
  return `${(bytes / 1024).toFixed(1)}KB`
}

function readText(file) {
  try {
    return fs.readFileSync(file, 'utf8')
  } catch (error) {
    return ''
  }
}

function scanSensitive(files) {
  const findings = []
  files.forEach((file) => {
    const ext = path.extname(file).toLowerCase()
    if (!TEXT_EXT.has(ext)) return
    const text = readText(file)
    SENSITIVE_PATTERNS.forEach((rule) => {
      if (rule.pattern.test(text)) {
        findings.push({
          file: path.relative(ROOT, file).replace(/\\/g, '/'),
          rule: rule.name
        })
      }
    })
  })
  return findings
}

function topFiles(files, filter, limit = 20) {
  return files
    .map((file) => ({ file, size: fs.statSync(file).size }))
    .filter((item) => !filter || filter(item.file))
    .sort((a, b) => b.size - a.size)
    .slice(0, limit)
    .map((item) => ({
      file: path.relative(ROOT, item.file).replace(/\\/g, '/'),
      size: sizeKb(item.size)
    }))
}

function buildRouteChecks() {
  const mainText = readText(path.join(ROOT, 'main.js'))
  const seoText = readText(path.join(ROOT, 'utils', 'website', 'seoRuntime.js'))
  return {
    rootRedirect: mainText.includes("H5_WEBSITE_DEMAND_ROUTE"),
    workspaceRoute: mainText.includes("'#/workspace'") && mainText.includes("moduleMap"),
    helpRoute: mainText.includes("'#/help'"),
    privateNoindex: SEO_PRIVATE_MARKERS.every((marker) => seoText.includes(marker)),
    publicSeo: PUBLIC_ROUTES.length
  }
}

function buildSeoChecks() {
  const robots = readText(path.join(ROOT, 'robots.txt'))
  const sitemap = readText(path.join(ROOT, 'sitemap.xml'))
  const indexHtml = readText(path.join(ROOT, 'index.html'))
  return {
    robotsExists: !!robots,
    sitemapExists: !!sitemap,
    robotsBlocksPrivate: ROBOTS_PRIVATE_MARKERS.every((marker) => robots.includes(marker)),
    sitemapPublicOnly: PUBLIC_ROUTES.every((route) => sitemap.includes(`https://www.diebiandesign.com${route}`)) && !sitemap.includes('/workspace'),
    indexHasDescription: indexHtml.includes('name="description"'),
    indexHasOg: indexHtml.includes('property="og:title"')
  }
}

function renderTable(rows = []) {
  if (!rows.length) return '无'
  return rows.map((item) => `- \`${item.file}\`：${item.size}`).join('\n')
}

function main() {
  const hasBuild = exists(BUILD_DIR)
  const scanRoot = hasBuild ? BUILD_DIR : ROOT
  const files = walk(scanRoot)
  const allSourceFiles = hasBuild ? files : files.filter((file) => !path.relative(ROOT, file).startsWith('unpackage/'))
  const sensitiveFindings = scanSensitive(allSourceFiles)
  const routeChecks = buildRouteChecks()
  const seoChecks = buildSeoChecks()
  const jsFiles = topFiles(files, (file) => path.extname(file).toLowerCase() === '.js', 15)
  const cssFiles = topFiles(files, (file) => path.extname(file).toLowerCase() === '.css', 15)
  const mediaFiles = topFiles(files, (file) => MEDIA_EXT.has(path.extname(file).toLowerCase()), 15)
  const overLimitFiles = topFiles(files, (file) => fs.statSync(file).size > 200 * 1024, 50)
  const largeImages = topFiles(files, (file) => MEDIA_EXT.has(path.extname(file).toLowerCase()) && fs.statSync(file).size > 100 * 1024, 50)
  const report = [
    '# 官网与专业工作台发布验收报告 V1',
    '',
    `生成时间：${new Date().toISOString()}`,
    `扫描对象：${hasBuild ? 'H5 构建产物' : '源码 fallback（未发现 H5 build 产物）'}`,
    `扫描目录：\`${path.relative(ROOT, scanRoot) || '.'}\``,
    '',
    '## 路由与拆分边界',
    `- H5 根路径进入官网：${routeChecks.rootRedirect ? '通过' : '待修复'}`,
    `- /workspace 路由可映射工作台：${routeChecks.workspaceRoute ? '通过' : '待修复'}`,
    `- /help 路由可映射帮助中心：${routeChecks.helpRoute ? '通过' : '待修复'}`,
    `- 私有路由 noindex 策略：${routeChecks.privateNoindex ? '通过' : '待修复'}`,
    '',
    '## SEO 检查',
    `- robots.txt 存在：${seoChecks.robotsExists ? '通过' : '待修复'}`,
    `- sitemap.xml 存在：${seoChecks.sitemapExists ? '通过' : '待修复'}`,
    `- robots 阻止私有页面：${seoChecks.robotsBlocksPrivate ? '通过' : '待修复'}`,
    `- sitemap 仅包含公开页面：${seoChecks.sitemapPublicOnly ? '通过' : '待修复'}`,
    `- index 默认 description：${seoChecks.indexHasDescription ? '通过' : '待修复'}`,
    `- Open Graph 基础信息：${seoChecks.indexHasOg ? '通过' : '待修复'}`,
    '',
    '## 敏感信息扫描',
    sensitiveFindings.length
      ? sensitiveFindings.map((item) => `- ${item.rule}：\`${item.file}\``).join('\n')
      : '- 未发现常见 API Key、云密钥、Bearer token 或私钥片段。',
    '',
    '## 大文件检查',
    '### 超过 200KB 的文件',
    renderTable(overLimitFiles),
    '',
    '### 超过 100KB 的图片/媒体',
    renderTable(largeImages),
    '',
    '## 最大 JS 文件',
    renderTable(jsFiles),
    '',
    '## 最大 CSS 文件',
    renderTable(cssFiles),
    '',
    '## 最大图片/媒体文件',
    renderTable(mediaFiles),
    '',
    '## 人工发布前仍需验证',
    '- HBuilderX 执行 H5 生产构建。',
    '- 刷新 `/`, `/#/workspace`, `/#/help`, `/#/enterprise-solution`, `/#/case-center`。',
    '- 未登录访问工作台、企业后台和 developer 页面。',
    '- 不同角色权限、企业切换、项目/任务/资产隔离。',
    '- 桌面 1920/1440/1024、平板 768、手机宽度响应式。',
    '- 核心创建任务、结果页、下载与交付流程。',
    '- 浏览器控制台无白屏错误；生产日志不包含 token、手机号、邮箱和完整临时图片地址。'
  ].join('\n')
  fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true })
  fs.writeFileSync(REPORT_PATH, report, 'utf8')
  console.log(report)
  if (sensitiveFindings.length) process.exitCode = 2
}

main()
