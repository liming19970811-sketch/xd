const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')

const ROOT = path.resolve(__dirname, '..')
const BUILD_ROOT = path.join(ROOT, 'unpackage', 'dist', 'build', 'mp-weixin')
const REPORT_PATH = path.join(ROOT, 'docs', 'miniapp-rc1-preflight-report.md')

const REQUIRED_REPORTS = [
  'docs/full-chain-smoke-v2.md',
  'docs/security-permission-audit-v1.md',
  'docs/release-canary-v1.md',
  'docs/experience-release-acceptance-v1.md',
  'docs/experience-defects-v1.md',
  'docs/rc1-regression-v1.md'
]

const AUXILIARY_REPORTS = [
  'docs/miniapp-full-chain-manual-acceptance-v2.md',
  'docs/data-permission-audit-v1.md',
  'docs/miniapp-experience-preflight-report.md',
  'docs/miniapp-release-decision.md',
  'docs/miniapp-device-test-report.md'
]

function full(relativePath) {
  return path.join(ROOT, relativePath)
}

function exists(relativePath) {
  return fs.existsSync(full(relativePath))
}

function read(relativePath) {
  return fs.readFileSync(full(relativePath), 'utf8')
}

function parseJsonWithComments(relativePath) {
  return JSON.parse(read(relativePath)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, ''))
}

function stripPlatformConditionals(source, platform = 'MP-WEIXIN') {
  const active = [true]
  return source.split(/\r?\n/).filter((line) => {
    const ifdef = line.match(/^\s*\/\/\s*#ifdef\s+(.+)$/)
    const ifndef = line.match(/^\s*\/\/\s*#ifndef\s+(.+)$/)
    if (ifdef || ifndef) {
      const platforms = (ifdef || ifndef)[1].split(/\s*\|\|\s*/)
      const matches = platforms.includes(platform)
      active.push(active[active.length - 1] && (ifdef ? matches : !matches))
      return false
    }
    if (/^\s*\/\/\s*#endif/.test(line)) {
      active.pop()
      return false
    }
    return active[active.length - 1]
  }).join('\n')
}

function parsePagesJson() {
  return JSON.parse(stripPlatformConditionals(read('pages.json')).replace(/\/\*[\s\S]*?\*\//g, ''))
}

function listFiles(rootPath) {
  if (!fs.existsSync(rootPath)) return []
  if (fs.statSync(rootPath).isFile()) return [rootPath]
  const files = []
  const walk = (current) => fs.readdirSync(current, { withFileTypes: true }).forEach((entry) => {
    const candidate = path.join(current, entry.name)
    if (entry.isDirectory()) walk(candidate)
    else files.push(candidate)
  })
  walk(rootPath)
  return files
}

function newestMtime(files) {
  return files.reduce((latest, file) => Math.max(latest, fs.statSync(file).mtimeMs), 0)
}

function normalizeRoutes(config = {}) {
  const routes = []
  ;(config.pages || []).forEach((item) => routes.push(typeof item === 'string' ? item : item.path))
  ;(config.subPackages || []).forEach((group) => {
    ;(group.pages || []).forEach((item) => routes.push(`${group.root}/${typeof item === 'string' ? item : item.path}`))
  })
  return routes.filter(Boolean).sort()
}

function normalizeTabs(config = {}) {
  return ((((config || {}).tabBar || {}).list) || []).map((item) => ({
    pagePath: item.pagePath,
    text: item.text,
    iconPath: item.iconPath,
    selectedIconPath: item.selectedIconPath
  }))
}

function collectDefects(relativePaths) {
  const defects = new Map()
  relativePaths.filter(exists).forEach((relativePath) => {
    const source = read(relativePath)
    const patterns = [
      /\|\s*([A-Z][A-Z0-9_-]+)\s*\|\s*(P[0-3])\s*\|/g,
      /\b(P[0-3])\s+`([A-Z][A-Z0-9_-]+)`/g
    ]
    patterns.forEach((pattern, index) => {
      let match
      while ((match = pattern.exec(source))) {
        const id = index === 0 ? match[1] : match[2]
        const severity = index === 0 ? match[2] : match[1]
        defects.set(id, { id, severity, source: relativePath })
      }
    })
  })
  return [...defects.values()]
}

function countDefects(defects) {
  return ['P0', 'P1', 'P2', 'P3'].reduce((counts, severity) => {
    counts[severity] = defects.filter((item) => item.severity === severity).length
    return counts
  }, {})
}

function checkCloudFunctions() {
  const root = full('cloudfunctions')
  if (!fs.existsSync(root)) return { functions: [], invalid: ['cloudfunctions'] }
  const functions = fs.readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
  const invalid = []
  functions.forEach((name) => {
    const indexPath = path.join(root, name, 'index.js')
    const packagePath = path.join(root, name, 'package.json')
    if (!fs.existsSync(indexPath)) invalid.push(`${name}: missing index.js`)
    if (!fs.existsSync(packagePath)) invalid.push(`${name}: missing package.json`)
    if (fs.existsSync(packagePath)) {
      try {
        JSON.parse(fs.readFileSync(packagePath, 'utf8'))
      } catch (error) {
        invalid.push(`${name}: invalid package.json`)
      }
    }
  })
  return { functions, invalid }
}

function status(ok, fail = 'BLOCKED') {
  return ok ? 'PASS' : fail
}

function main() {
  const packageAudit = spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'mp-package-audit.js')], { cwd: ROOT, encoding: 'utf8' })
  const packageBudgetPassed = packageAudit.status === 0
  const manifest = parseJsonWithComments('manifest.json')
  const packageJson = parseJsonWithComments('package.json')
  const pagesConfig = parsePagesJson()
  const aiConfig = read('cloudfunctions/ai_generate/utils/config.js')
  const aiGenerate = read('cloudfunctions/ai_generate/index.js')
  const quotaGuard = read('cloudfunctions/quota_guard/index.js')
  const clientGenerate = read('utils/api/generate.js')
  const homeCapabilities = read('utils/home/homeCapabilities.js')
  const resultPage = read('package-ai/result/result.vue')
  const deliveryCenter = read('utils/workspace/workspaceBatchDeliveryCenter.js')

  const requiredReportState = REQUIRED_REPORTS.map((file) => ({ file, exists: exists(file) }))
  const missingReports = requiredReportState.filter((item) => !item.exists)
  const exactDefects = collectDefects(REQUIRED_REPORTS)
  const auxiliaryDefects = collectDefects(AUXILIARY_REPORTS)
  const exactCounts = countDefects(exactDefects)
  const auxiliaryCounts = countDefects(auxiliaryDefects)

  const securityReportMissing = !exists('docs/security-permission-audit-v1.md')
  const auxiliarySecurity = exists('docs/data-permission-audit-v1.md') ? read('docs/data-permission-audit-v1.md') : ''
  const unresolvedHighRiskEvidence = /高风险|严重|CRITICAL|HIGH/.test(auxiliarySecurity)
  const auxiliaryHighRiskCount = (auxiliarySecurity.match(/\|\s*(?:高|严重|CRITICAL|HIGH)\s*\|/g) || []).length

  const sourceRoots = [
    'pages/index', 'pages/mine', 'pages/gallery', 'pages/settings',
    'package-ai', 'package-assets', 'package-mobile-enterprise',
    'components', 'utils', 'pages.json', 'manifest.json', 'App.vue', 'main.js'
  ]
  const sourceFiles = sourceRoots.flatMap((relativePath) => listFiles(full(relativePath)))
  const buildFiles = listFiles(BUILD_ROOT)
  const sourceMtime = newestMtime(sourceFiles)
  const buildMtime = newestMtime(buildFiles)
  const buildAppPath = path.join(BUILD_ROOT, 'app.json')
  const buildExists = fs.existsSync(buildAppPath)
  const buildFresh = buildExists && buildMtime >= sourceMtime
  let buildConfig = null
  try {
    buildConfig = buildExists ? JSON.parse(fs.readFileSync(buildAppPath, 'utf8')) : null
  } catch (error) {
    buildConfig = null
  }
  const sourceRoutes = normalizeRoutes(pagesConfig)
  const buildRoutes = normalizeRoutes(buildConfig || {})
  const routesExist = sourceRoutes.every((route) => fs.existsSync(full(`${route}.vue`)))
  const routeSync = Boolean(buildConfig) && JSON.stringify(sourceRoutes) === JSON.stringify(buildRoutes)
  const tabSync = Boolean(buildConfig) && JSON.stringify(normalizeTabs(pagesConfig)) === JSON.stringify(normalizeTabs(buildConfig))

  const batchEntry = homeCapabilities.match(/id:\s*'batch_model'[\s\S]{0,360}?\}\)/)
  const batchGenerationEnabled = Boolean(batchEntry && !/enabled:\s*false/.test(batchEntry[0]))
  const autoDeliveryEnabled = /autoDelivery\s*[:=]\s*true|autoApprove\s*[:=]\s*true/i.test(`${resultPage}\n${deliveryCenter}`)
  const deliveryApprovalEnabled = /markDeliveryApproved\s*\(/.test(resultPage)
  const debugToolsEnabled = sourceRoutes.some((route) => /cloud-alpha|pages\/admin|pages\/developer|pages\/task-admin/i.test(route))
  const cloud = checkCloudFunctions()

  const checks = [
    ['包体预算与平台边界通过', packageBudgetPassed],
    ['六份指定前置报告齐全', missingReports.length === 0],
    ['P0 为 0', missingReports.length === 0 && exactCounts.P0 === 0],
    ['P1 为 0', missingReports.length === 0 && exactCounts.P1 === 0],
    ['安全报告无 CRITICAL/HIGH', !securityReportMissing && !unresolvedHighRiskEvidence],
    ['Provider 默认 mock', /DEFAULT_PROVIDER\s*=\s*'mock'/.test(aiConfig)],
    ['真实 Provider 仅显式开启', /ENABLE_REAL_PROVIDER_CALL/.test(aiConfig) && /isExplicitTrue/.test(aiConfig)],
    ['Provider dry-run 默认关闭', /isExplicitTrue\(process\.env\.PROVIDER_DRY_RUN\)/.test(aiGenerate)],
    ['真实 quota 默认关闭', /ENABLE_REAL_QUOTA_GUARD[\s\S]{0,180}===\s*'true'/.test(quotaGuard)],
    ['客户端失败不伪造成功', /ENABLE_CLIENT_GENERATE_MOCK_FALLBACK\s*=\s*false/.test(clientGenerate)],
    ['mock/fallback 禁止正式交付', /blocked mock approve/.test(resultPage) && /provider\.includes\('mock'\)/.test(deliveryCenter)],
    ['批量生成关闭', !batchGenerationEnabled],
    ['自动交付关闭', !autoDeliveryEnabled],
    ['交付审批关闭', !deliveryApprovalEnabled],
    ['production debugTools 关闭', !debugToolsEnabled],
    ['源码注册路由文件完整', routesExist],
    ['正式构建存在', buildExists],
    ['正式构建晚于源码', buildFresh],
    ['正式构建路由同步', routeSync],
    ['正式构建 tabBar 同步', tabSync],
    ['云函数源码结构完整', cloud.invalid.length === 0]
  ].map(([name, ok]) => ({ name, status: status(ok) }))

  const blockers = checks.filter((item) => item.status === 'BLOCKED')
  const releaseReady = blockers.length === 0
  const recommendedVersion = `${manifest.versionName || packageJson.version || '1.0.0'}-rc.1`
  const lines = [
    '# 蝶变小程序 RC1 发布预检报告',
    '',
    `生成时间：${new Date().toISOString()}`,
    '',
    '## 结论',
    '',
    releaseReady ? '**READY FOR MANUAL RC1 ACCEPTANCE**' : '**BLOCKED**',
    '',
    '本报告只覆盖本地源码、配置、已有报告与构建产物。云函数部署、微信开发者工具发布构建、体验版上传、线上权限核验和真机回归均未自动执行。',
    '',
    '## 前置报告',
    '',
    '| 文件 | 状态 |',
    '| --- | --- |',
    ...requiredReportState.map((item) => `| \`${item.file}\` | ${item.exists ? '存在' : '**缺失**'} |`),
    '',
    `- 指定报告缺陷统计：${missingReports.length ? 'UNKNOWN（报告不完整）' : `P0=${exactCounts.P0} / P1=${exactCounts.P1} / P2=${exactCounts.P2} / P3=${exactCounts.P3}`}`,
    `- 辅助报告已知缺陷下限：P0=${auxiliaryCounts.P0} / P1=${auxiliaryCounts.P1} / P2=${auxiliaryCounts.P2} / P3=${auxiliaryCounts.P3}`,
    `- 辅助安全审计高风险/严重集合项：${auxiliaryHighRiskCount} 项。`,
    '- 辅助报告不能替代缺失的指定报告，也不能把未验证项推定为通过。',
    '',
    '## 版本与产物',
    '',
    `- package 版本：\`${packageJson.version || '未配置'}\``,
    `- manifest 版本：\`${manifest.versionName || '未配置'}\` / \`${manifest.versionCode || '未配置'}\``,
    `- RC1 建议标识：\`${recommendedVersion}\`（本轮未自动改版本）`,
    `- 源码最新时间：${sourceMtime ? new Date(sourceMtime).toISOString() : '不存在'}`,
    `- 构建最新时间：${buildMtime ? new Date(buildMtime).toISOString() : '不存在'}`,
    '',
    '## 自动准入检查',
    '',
    '| 检查项 | 结果 |',
    '| --- | --- |',
    ...checks.map((item) => `| ${item.name} | **${item.status}** |`),
    '| 微信开发者工具发布构建 | **NOT RUN** |',
    '| 云端函数版本与环境变量复验 | **NOT RUN** |',
    '| 体验版上传 | **NOT RUN** |',
    '| Android 真机回归 | **NOT RUN** |',
    '| iOS 真机回归 | **NOT RUN** |',
    '| 线上数据库权限核验 | **BLOCKED** |',
    '',
    '## 阻塞项',
    '',
    ...(blockers.length ? blockers.map((item) => `- ${item.name}`) : ['- 无本地自动检查阻塞项。']),
    ...(unresolvedHighRiskEvidence ? ['- 辅助安全审计仍有高风险/严重证据，且线上数据库规则未复验。'] : []),
    '',
    '## 云函数部署准备',
    '',
    `- 源目录共发现 ${cloud.functions.length} 个云函数：${cloud.functions.map((name) => `\`${name}\``).join('、')}。`,
    `- 源码结构检查：${cloud.invalid.length ? cloud.invalid.join('；') : 'index.js 与 package.json 均存在且 package.json 可解析'}。`,
    '- 本轮未复制到构建目录、未上传、未部署、未读取或修改线上环境变量。',
    '',
    '## 未验证与云端复验',
    '',
    '- 微信开发者工具清缓存发布编译、分包加载与控制台错误。',
    '- mock 成功链、安全失败链、防重复提交、生产记录找回与作品收录。',
    '- Android/iOS 上传、相册授权、分享、弱网、前后台切换与安全区。',
    '- 已部署 `ai_generate`、`generate_wanx`、`quota_guard` 的版本及安全开关。',
    '- 云数据库集合权限、客户端直连边界与可信用户隔离。',
    '',
    '## 安全声明',
    '',
    '- 不输出 AppID、OPENID、Token、云凭证、客户素材地址或完整业务记录。',
    '- 不调用真实 Provider、不启用真实 quota、不执行批量真实生成、支付或正式交付。',
    '- mock/fallback 结果只能用于测试，不得正式审核或交付。',
    ''
  ]

  fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true })
  fs.writeFileSync(REPORT_PATH, `${lines.join('\n')}\n`)
  console.log(lines.join('\n'))
  if (!releaseReady) process.exitCode = 1
}

try {
  main()
} catch (error) {
  console.error(`[rc1-preflight] ${error && error.message ? error.message : 'unknown_error'}`)
  process.exitCode = 1
}
