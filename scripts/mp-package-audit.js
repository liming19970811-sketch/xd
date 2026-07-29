const crypto = require('crypto')
const fs = require('fs')
const path = require('path')
const budget = require('./mp-package-budget')

const ROOT = process.cwd()
const KB = 1024
const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'])
const MEDIA_EXTENSIONS = new Set(['.mp4', '.mov', '.webm', '.mp3', '.wav', '.pdf', '.ttf', '.otf', '.woff', '.woff2'])
const SOURCE_TEXT_EXTENSIONS = new Set(['.vue', '.js', '.json', '.css', '.scss', '.html'])
const MAIN_ENTERPRISE_PATTERNS = [/quoteService/i, /orderService/i, /deliveryService/i, /auditService/i, /roleService/i, /businessDashboard/i]
const MAIN_DEV_PATTERNS = [/Cloud Alpha/i, /cloudAlphaResults/i, /fixture/i, /debugTools/i, /smoke/i]
const MP_EXCLUDED_PREFIXES = [
  'package-ai/pattern-library/',
  'package-ai/pattern-detail/',
  'package-ai/pattern-review-',
  'package-ai/pattern-training-',
  'package-ai/sample-order-',
  'package-mobile-enterprise/small-batch-',
  'pages/enterprise-web/',
  'pages/admin/'
]
const WEBSITE_MIGRATION_SCOPE = [
  '版型库、版型详情与派生管理',
  '打版师复核队列与复核详情',
  'AI制版训练数据与模型评测',
  '样衣协作与小单生产后台',
  '企业成员权限、审计、分析、报价和订单后台'
]

function option(name, fallback = '') {
  const index = process.argv.indexOf(name)
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback
}

function hasFlag(name) {
  return process.argv.includes(name)
}

const DIST_DIR = path.resolve(ROOT, option('--root', 'unpackage/dist/build/mp-weixin'))
const REPORT_PATH = path.resolve(ROOT, option('--report', 'docs/miniapp-package-report.md'))
const JSON_REPORT_PATH = path.resolve(ROOT, option('--json-report', 'docs/miniapp-package-report.json'))
const ALLOW_STALE = hasFlag('--allow-stale')

function toPosix(value) {
  return value.split(path.sep).join('/')
}

function formatBytes(bytes) {
  if (!bytes) return '0 B'
  if (bytes < KB) return `${bytes} B`
  if (bytes >= KB * KB) return `${(bytes / KB / KB).toFixed(2)} MB`
  return `${(bytes / KB).toFixed(1)} KB`
}

function listFiles(directory) {
  if (!fs.existsSync(directory)) return []
  const files = []
  const walk = (current) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const fullPath = path.join(current, entry.name)
      if (entry.isDirectory()) walk(fullPath)
      if (entry.isFile()) {
        const stat = fs.statSync(fullPath)
        files.push({
          fullPath,
          relativePath: toPosix(path.relative(directory, fullPath)),
          size: stat.size,
          mtimeMs: stat.mtimeMs,
          ext: path.extname(entry.name).toLowerCase()
        })
      }
    }
  }
  walk(directory)
  return files
}

function readJson(filePath, fallback = {}) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'))
  } catch (error) {
    return fallback
  }
}

function sum(files) {
  return files.reduce((total, file) => total + file.size, 0)
}

function latestMtime(files) {
  return files.reduce((latest, file) => Math.max(latest, file.mtimeMs || 0), 0)
}

function getSourceFiles() {
  const roots = ['pages', 'package-ai', 'package-assets', 'package-mobile-enterprise', 'components', 'utils', 'static']
  const files = roots.flatMap((root) => listFiles(path.join(ROOT, root)).map((file) => ({
    ...file,
    relativePath: `${root}/${file.relativePath}`
  })))
  for (const fileName of ['App.vue', 'main.js', 'pages.json', 'manifest.json']) {
    const fullPath = path.join(ROOT, fileName)
    if (!fs.existsSync(fullPath)) continue
    const stat = fs.statSync(fullPath)
    files.push({ fullPath, relativePath: fileName, size: stat.size, mtimeMs: stat.mtimeMs, ext: path.extname(fileName) })
  }
  return files
}

function getPackageRoots(appJson) {
  return (appJson.subPackages || appJson.subpackages || []).map((item) => ({
    root: String(item.root || '').replace(/\/$/, ''),
    pages: Array.isArray(item.pages) ? item.pages : [],
    independent: item.independent === true
  })).filter((item) => item.root)
}

function classifyFile(file, packageRoots) {
  const target = packageRoots.find((item) => file.relativePath === item.root || file.relativePath.startsWith(`${item.root}/`))
  return target ? target.root : 'main'
}

function hash(filePath) {
  return crypto.createHash('sha1').update(fs.readFileSync(filePath)).digest('hex')
}

function findDuplicates(files) {
  const groups = new Map()
  for (const file of files) {
    if (!file.size) continue
    const key = `${file.size}:${hash(file.fullPath)}`
    groups.set(key, [...(groups.get(key) || []), file])
  }
  return [...groups.values()].filter((group) => group.length > 1)
}

function findTextMatches(files, patterns) {
  return files.flatMap((file) => {
    if (!['.js', '.json', '.wxml', '.wxss'].includes(file.ext)) return []
    let content = ''
    try { content = fs.readFileSync(file.fullPath, 'utf8') } catch (error) { return [] }
    const matches = patterns.filter((pattern) => pattern.test(content) || pattern.test(file.relativePath)).map(String)
    return matches.length ? [{ path: file.relativePath, matches }] : []
  })
}

function findPotentialUnusedStatic(sourceFiles) {
  const text = sourceFiles
    .filter((file) => SOURCE_TEXT_EXTENSIONS.has(file.ext))
    .map((file) => {
      try { return fs.readFileSync(file.fullPath, 'utf8') } catch (error) { return '' }
    })
    .join('\n')
  return sourceFiles.filter((file) => file.relativePath.startsWith('static/')).filter((file) => {
    const relative = file.relativePath.replace(/^static\//, '')
    return !text.includes(file.relativePath) && !text.includes(`/static/${relative}`)
  })
}

function markdownTable(headers, rows) {
  if (!rows.length) return '无\n'
  return [
    `| ${headers.join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows.map((row) => `| ${row.join(' | ')} |`)
  ].join('\n') + '\n'
}

function topRows(files, count = 30) {
  return [...files].sort((left, right) => right.size - left.size).slice(0, count).map((file) => [file.relativePath, formatBytes(file.size), file.packageName])
}

function buildMissingReport() {
  const relative = toPosix(path.relative(ROOT, DIST_DIR))
  return {
    generatedAt: new Date().toISOString(),
    root: relative,
    status: 'blocked',
    warnings: [],
    blockers: [`未找到 MP-WEIXIN 构建产物：${relative}`],
    packages: [],
    totals: { main: 0, all: 0 },
    files: [],
    duplicates: [],
    potentialUnusedStatic: [],
    mainEnterpriseMatches: [],
    mainDevMatches: [],
    migratedPageFiles: []
  }
}

function audit() {
  if (!fs.existsSync(DIST_DIR)) return buildMissingReport()
  const appJson = readJson(path.join(DIST_DIR, 'app.json'))
  const packageRoots = getPackageRoots(appJson)
  const files = listFiles(DIST_DIR).map((file) => ({ ...file, packageName: classifyFile(file, packageRoots) }))
  const sourceFiles = getSourceFiles()
  const mainFiles = files.filter((file) => file.packageName === 'main')
  const packages = packageRoots.map((entry) => {
    const packageFiles = files.filter((file) => file.packageName === entry.root)
    return { ...entry, size: sum(packageFiles), fileCount: packageFiles.length }
  })
  const mainSize = sum(mainFiles)
  const totalSize = sum(files)
  const buildMtime = latestMtime(files)
  const sourceMtime = latestMtime(sourceFiles.filter((file) => ['.vue', '.js', '.json'].includes(file.ext)))
  const stale = buildMtime < sourceMtime
  const warnings = []
  const blockers = []
  const assets = files.filter((file) => IMAGE_EXTENSIONS.has(file.ext) || MEDIA_EXTENSIONS.has(file.ext))

  if (mainSize > budget.mainPackageWarning) warnings.push(`主包 ${formatBytes(mainSize)} 超过内部预警 ${formatBytes(budget.mainPackageWarning)}`)
  if (mainSize > budget.mainPackageBlocking) blockers.push(`主包超过内部阻断线 ${formatBytes(budget.mainPackageBlocking)}`)
  for (const item of packages) {
    if (item.size > budget.subPackageWarning) warnings.push(`${item.root} ${formatBytes(item.size)} 超过分包预警`)
    if (item.size > budget.subPackageBlocking) blockers.push(`${item.root} 超过分包阻断线 ${formatBytes(budget.subPackageBlocking)}`)
  }
  if (totalSize > budget.totalWarning) warnings.push(`总包 ${formatBytes(totalSize)} 超过内部预警 ${formatBytes(budget.totalWarning)}`)
  if (totalSize > budget.totalBlocking) blockers.push(`总包超过内部阻断线 ${formatBytes(budget.totalBlocking)}`)
  for (const asset of assets.filter((file) => file.size > budget.singleAssetWarning)) warnings.push(`大资源 ${asset.relativePath}：${formatBytes(asset.size)}`)
  for (const asset of assets.filter((file) => file.size > budget.singleAssetBlocking)) blockers.push(`资源 ${asset.relativePath} 超过单资源阻断线`)
  if (stale && !ALLOW_STALE) blockers.push('构建产物早于当前小程序源码，必须重新正式构建后复验')
  if (stale && ALLOW_STALE) warnings.push('当前为过期产物趋势报告，不可作为发布包体结论')

  const migratedPageFiles = files.filter((file) => MP_EXCLUDED_PREFIXES.some((prefix) => file.relativePath.startsWith(prefix)))
  if (migratedPageFiles.length) blockers.push(`发现 ${migratedPageFiles.length} 个应迁移至网站的页面文件进入 MP 产物`)
  if (files.some((file) => file.relativePath.startsWith('cloudfunctions/'))) blockers.push('云函数源码进入 MP 代码包')
  if (files.some((file) => /cloud-alpha/i.test(file.relativePath))) blockers.push('Cloud Alpha 开发页面进入 MP 代码包')

  const mainEnterpriseMatches = findTextMatches(mainFiles, MAIN_ENTERPRISE_PATTERNS)
  const mainDevMatches = findTextMatches(mainFiles, MAIN_DEV_PATTERNS)
  if (mainEnterpriseMatches.length) warnings.push(`主包发现 ${mainEnterpriseMatches.length} 个企业后台依赖线索，请复核静态导入`)
  if (mainDevMatches.length) warnings.push(`主包发现 ${mainDevMatches.length} 个开发调试线索，请复核 release 条件编译`)

  return {
    generatedAt: new Date().toISOString(),
    root: toPosix(path.relative(ROOT, DIST_DIR)),
    buildTime: new Date(buildMtime).toISOString(),
    sourceTime: new Date(sourceMtime).toISOString(),
    stale,
    status: blockers.length ? 'blocked' : warnings.length ? 'warning' : 'passed',
    budget,
    warnings,
    blockers,
    totals: { main: mainSize, all: totalSize, fileCount: files.length },
    pages: appJson.pages || [],
    preloadRule: appJson.preloadRule || {},
    packages,
    files,
    topFiles: [...files].sort((left, right) => right.size - left.size).slice(0, 30),
    duplicates: findDuplicates(files),
    potentialUnusedStatic: findPotentialUnusedStatic(sourceFiles),
    mainEnterpriseMatches,
    mainDevMatches,
    migratedPageFiles,
    websiteMigrationScope: WEBSITE_MIGRATION_SCOPE
  }
}

function renderMarkdown(report) {
  const packageRows = report.packages.map((item) => [item.root, String(item.pages.length), String(item.fileCount), formatBytes(item.size)])
  const lines = [
    '# 小程序包体治理报告',
    '',
    `生成时间：${report.generatedAt}`,
    `扫描目录：\`${report.root}\``,
    `构建时间：${report.buildTime || '未知'}`,
    `源码时间：${report.sourceTime || '未知'}`,
    `产物新鲜度：${report.stale ? '过期' : '有效'}`,
    `状态：**${report.status.toUpperCase()}**`,
    '',
    '## 包体总览',
    '',
    markdownTable(['指标', '结果', '预警', '阻断'], [
      ['主包', formatBytes(report.totals.main), formatBytes(budget.mainPackageWarning), formatBytes(budget.mainPackageBlocking)],
      ['总包', formatBytes(report.totals.all), formatBytes(budget.totalWarning), formatBytes(budget.totalBlocking)],
      ['文件数', String(report.totals.fileCount || 0), '-', '-']
    ]),
    '## 分包',
    '',
    markdownTable(['分包', '页面数', '文件数', '大小'], packageRows),
    '## 最大 30 个文件',
    '',
    markdownTable(['文件', '大小', '归属'], topRows(report.files, 30)),
    '## 最大图片与媒体',
    '',
    markdownTable(['文件', '大小', '归属'], topRows(report.files.filter((file) => IMAGE_EXTENSIONS.has(file.ext) || MEDIA_EXTENSIONS.has(file.ext)), 30)),
    '## 最大 JS',
    '',
    markdownTable(['文件', '大小', '归属'], topRows(report.files.filter((file) => file.ext === '.js'), 20)),
    '## 最大 WXSS',
    '',
    markdownTable(['文件', '大小', '归属'], topRows(report.files.filter((file) => file.ext === '.wxss'), 20)),
    '## 重复资源',
    '',
    report.duplicates.length ? report.duplicates.map((group) => `- ${formatBytes(group[0].size)}：${group.map((file) => `\`${file.relativePath}\``).join('、')}`).join('\n') : '无',
    '',
    '## 可能未引用的 static 资源',
    '',
    report.potentialUnusedStatic.length ? report.potentialUnusedStatic.map((file) => `- \`${file.relativePath}\`（${formatBytes(file.size)}）`).join('\n') : '无',
    '',
    '## 主包企业与开发依赖线索',
    '',
    markdownTable(['文件', '匹配'], [...report.mainEnterpriseMatches, ...report.mainDevMatches].map((item) => [item.path, item.matches.join('<br>')])),
    '## 网站分流范围',
    '',
    WEBSITE_MIGRATION_SCOPE.map((item) => `- ${item}`).join('\n'),
    '## 预警',
    '',
    report.warnings.length ? report.warnings.map((item) => `- ${item}`).join('\n') : '无',
    '',
    '## 阻断',
    '',
    report.blockers.length ? report.blockers.map((item) => `- ${item}`).join('\n') : '无',
    '',
    '## 微信限制说明',
    '',
    `脚本参考值为主包 ${formatBytes(budget.wechatReference.mainPackage)}、单分包 ${formatBytes(budget.wechatReference.subPackage)}、总包 ${formatBytes(budget.wechatReference.total)}。该值只用于趋势对照，提交时必须以微信开发者工具和官方平台的实时检测为准。`,
    '',
    '## 发布结论',
    '',
    report.status === 'blocked' ? '当前包体审计阻断发布准备。' : report.status === 'warning' ? '未触发阻断线，但需复核预警后再准备发布。' : '包体与编译边界检查通过。'
  ]
  return lines.join('\n')
}

const report = audit()
fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true })
fs.mkdirSync(path.dirname(JSON_REPORT_PATH), { recursive: true })
fs.writeFileSync(REPORT_PATH, renderMarkdown(report), 'utf8')
fs.writeFileSync(JSON_REPORT_PATH, JSON.stringify({
  generatedAt: report.generatedAt,
  root: report.root,
  buildTime: report.buildTime || '',
  sourceTime: report.sourceTime || '',
  stale: Boolean(report.stale),
  status: report.status,
  budget: report.budget || budget,
  warnings: report.warnings,
  blockers: report.blockers,
  totals: report.totals,
  pages: report.pages || [],
  preloadRule: report.preloadRule || {},
  packages: report.packages.map(({ root, size, fileCount, independent, pages }) => ({ root, size, fileCount, independent, pageCount: pages.length })),
  topFiles: (report.topFiles || []).map(({ relativePath, size, packageName, ext }) => ({ relativePath, size, packageName, ext })),
  duplicates: report.duplicates.map((group) => group.map(({ relativePath, size, packageName }) => ({ relativePath, size, packageName }))),
  potentialUnusedStatic: report.potentialUnusedStatic.map(({ relativePath, size }) => ({ relativePath, size })),
  mainEnterpriseMatches: report.mainEnterpriseMatches,
  mainDevMatches: report.mainDevMatches,
  migratedPageFiles: report.migratedPageFiles.map(({ relativePath, size }) => ({ relativePath, size })),
  websiteMigrationScope: report.websiteMigrationScope || WEBSITE_MIGRATION_SCOPE
}, null, 2), 'utf8')
console.log(renderMarkdown(report))
if (report.status === 'blocked') process.exitCode = 1
