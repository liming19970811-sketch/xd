const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')

const ROOT = path.resolve(__dirname, '..')
const BUILD_ROOT = path.join(ROOT, 'unpackage', 'dist', 'build', 'mp-weixin')

const REQUIRED_REPORTS = [
  'docs/rc1-release-notes.md',
  'docs/rc1-release-acceptance.md',
  'docs/rc1-feedback-summary.md',
  'docs/security-permission-audit-v1.md',
  'docs/wechat-review-notes-v1.md',
  'docs/wechat-privacy-backend-checklist-v1.md',
  'docs/release-canary-v1.md'
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
  return JSON.parse(stripPlatformConditionals(read('pages.json'))
    .replace(/\/\*[\s\S]*?\*\//g, ''))
}

function collectRoutes(config) {
  const routes = []
  ;(config.pages || []).forEach((page) => routes.push(typeof page === 'string' ? page : page.path))
  ;(config.subPackages || []).forEach((group) => {
    ;(group.pages || []).forEach((page) => {
      routes.push(`${group.root}/${typeof page === 'string' ? page : page.path}`)
    })
  })
  return routes.filter(Boolean).sort()
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

function status(ok, fail = 'BLOCKED') {
  return ok ? 'PASS' : fail
}

function main() {
  const packageAudit = spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'mp-package-audit.js')], { cwd: ROOT, encoding: 'utf8' })
  const packageBudgetPassed = packageAudit.status === 0
  const manifest = parseJsonWithComments('manifest.json')
  const packageJson = parseJsonWithComments('package.json')
  const pages = parsePagesJson()
  const routes = collectRoutes(pages)
  const reportState = REQUIRED_REPORTS.map((file) => ({ file, exists: exists(file) }))
  const missingReports = reportState.filter((item) => !item.exists)
  const aiConfig = read('cloudfunctions/ai_generate/utils/config.js')
  const aiGenerate = read('cloudfunctions/ai_generate/index.js')
  const quotaGuard = read('cloudfunctions/quota_guard/index.js')
  const clientGenerate = read('utils/api/generate.js')
  const taskLayer = read('utils/task/taskLayer.js')
  const homeCapabilities = read('utils/home/homeCapabilities.js')
  const resultPage = read('package-ai/result/result.vue')
  const deliveryCenter = read('utils/workspace/workspaceBatchDeliveryCenter.js')
  const securityAudit = exists('docs/data-permission-audit-v1.md') ? read('docs/data-permission-audit-v1.md') : ''

  const sourceRoots = [
    'pages', 'package-ai', 'package-assets', 'package-mobile-enterprise',
    'components', 'utils', 'pages.json', 'manifest.json', 'App.vue', 'main.js'
  ]
  const sourceFiles = sourceRoots.flatMap((relativePath) => listFiles(full(relativePath)))
  const buildFiles = listFiles(BUILD_ROOT)
  const sourceMtime = newestMtime(sourceFiles)
  const buildMtime = newestMtime(buildFiles)
  const buildAppPath = path.join(BUILD_ROOT, 'app.json')
  const buildExists = fs.existsSync(buildAppPath)
  let buildRoutes = []
  let buildTabs = []
  if (buildExists) {
    try {
      const buildConfig = JSON.parse(fs.readFileSync(buildAppPath, 'utf8'))
      buildRoutes = collectRoutes(buildConfig)
      buildTabs = (((buildConfig || {}).tabBar || {}).list || []).map((item) => ({
        pagePath: item.pagePath,
        text: item.text,
        iconPath: item.iconPath,
        selectedIconPath: item.selectedIconPath
      }))
    } catch (error) {}
  }
  const sourceTabs = (((pages || {}).tabBar || {}).list || []).map((item) => ({
    pagePath: item.pagePath,
    text: item.text,
    iconPath: item.iconPath,
    selectedIconPath: item.selectedIconPath
  }))

  const batchEntryEnabled = /id:\s*'batch_model'[\s\S]{0,320}?(?!enabled:\s*false)/.test(homeCapabilities)
  const deliveryApprovalEnabled = /markDeliveryApproved\s*\(/.test(resultPage)
  const autoDeliveryEnabled = /autoDelivery\s*[:=]\s*true|autoApprove\s*[:=]\s*true/i.test(`${resultPage}\n${deliveryCenter}`)
  const debugToolsEnabled = routes.some((route) => /(?:admin|developer|cloud-alpha|task-admin)/i.test(route))
  const privacyRoute = routes.some((route) => /privacy(?:-policy)?/i.test(route))
  const agreementRoute = routes.some((route) => /(?:user-)?agreement|terms/i.test(route))
  const highRiskEvidence = /\|\s*(?:高|严重|CRITICAL|HIGH)\s*\|/.test(securityAudit) || /高风险|严重/.test(securityAudit)

  const flags = {
    runtimeEnv: process.env.NODE_ENV || 'not_set',
    realProvider: !/DEFAULT_PROVIDER\s*=\s*'mock'/.test(aiConfig) || !/ENABLE_REAL_PROVIDER_CALL/.test(aiConfig) ? 'ambiguous' : false,
    realQuota: !/ENABLE_REAL_QUOTA_GUARD[\s\S]{0,160}===\s*'true'/.test(quotaGuard) ? 'ambiguous' : false,
    providerDryRun: /PROVIDER_DRY_RUN/.test(aiGenerate) ? false : 'ambiguous',
    mockFallback: /fallbackToMock:\s*true/.test(aiGenerate) || /fallbackToMock/.test(taskLayer),
    clientMockFallback: !/ENABLE_CLIENT_GENERATE_MOCK_FALLBACK\s*=\s*false/.test(clientGenerate),
    testResultVisible: /已生成体验结果|测试图不可审核通过/.test(resultPage),
    batchGeneration: batchEntryEnabled,
    videoGeneration: false,
    deliveryApproval: deliveryApprovalEnabled,
    autoDelivery: autoDeliveryEnabled,
    debugTools: debugToolsEnabled
  }

  const checks = [
    ['package budget and platform boundary pass', packageBudgetPassed],
    ['required reports complete', missingReports.length === 0],
    ['no known HIGH/CRITICAL permission evidence', !highRiskEvidence],
    ['privacy policy route exists', privacyRoute],
    ['user agreement route exists', agreementRoute],
    ['real provider source default is off', flags.realProvider === false],
    ['real quota source default is off', flags.realQuota === false],
    ['provider dry run source default is off', flags.providerDryRun === false],
    ['client mock fallback is off', flags.clientMockFallback === false],
    ['batch generation is off', flags.batchGeneration === false],
    ['video generation is off', flags.videoGeneration === false],
    ['delivery approval is off', flags.deliveryApproval === false],
    ['auto delivery is off', flags.autoDelivery === false],
    ['debug tools excluded from MP routes', flags.debugTools === false],
    ['all source routes exist', routes.every((route) => exists(`${route}.vue`))],
    ['release build exists', buildExists],
    ['release build is newer than source', buildExists && buildMtime >= sourceMtime],
    ['release build routes match source', buildExists && JSON.stringify(buildRoutes) === JSON.stringify(routes)],
    ['release build tabBar matches source', buildExists && JSON.stringify(buildTabs) === JSON.stringify(sourceTabs)]
  ].map(([name, ok]) => ({ name, status: status(ok) }))

  console.log('WeChat review final preflight (read-only)')
  console.log(`version=${manifest.versionName || packageJson.version || 'unknown'} code=${manifest.versionCode || 'unknown'}`)
  console.log(`sourceLatest=${sourceMtime ? new Date(sourceMtime).toISOString() : 'missing'}`)
  console.log(`buildLatest=${buildMtime ? new Date(buildMtime).toISOString() : 'missing'}`)
  console.log('\nRequired reports:')
  reportState.forEach((item) => console.log(`- ${item.exists ? 'PASS' : 'MISSING'} ${item.file}`))
  console.log('\nSwitch summary:')
  Object.entries(flags).forEach(([key, value]) => console.log(`- ${key}=${value}`))
  console.log('\nAdmission checks:')
  checks.forEach((item) => console.log(`- ${item.status} ${item.name}`))
  console.log('\nManual-only checks: HBuilderX release build, deployed cloud env, platform privacy/category, customer service, at least one real device, upload/review submission, rollback target.')

  const blocked = checks.some((item) => item.status === 'BLOCKED')
  console.log(`\nDECISION=${blocked ? 'CURRENTLY_NOT_SUBMITTABLE' : 'READY_FOR_MANUAL_CHECKS'}`)
  if (blocked) process.exitCode = 1
}

try {
  main()
} catch (error) {
  console.error(`[wechat-review-final-preflight] ${error && error.message ? error.message : 'unknown_error'}`)
  process.exitCode = 1
}
