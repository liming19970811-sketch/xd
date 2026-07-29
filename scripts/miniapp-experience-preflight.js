const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')
const { execFileSync } = require('child_process')

const ROOT = path.resolve(__dirname, '..')
const BUILD_ROOT = path.join(ROOT, 'unpackage', 'dist', 'build', 'mp-weixin')
const REPORT_PATH = path.join(ROOT, 'docs', 'miniapp-experience-preflight-report.md')

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8')
}

function parseJsonWithComments(relativePath) {
  const source = read(relativePath)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
  return JSON.parse(source)
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
  const files = []
  const walk = (current) => {
    fs.readdirSync(current, { withFileTypes: true }).forEach((entry) => {
      const fullPath = path.join(current, entry.name)
      if (entry.isDirectory()) walk(fullPath)
      else files.push(fullPath)
    })
  }
  walk(rootPath)
  return files
}

function newestMtime(files) {
  return files.reduce((latest, file) => Math.max(latest, fs.statSync(file).mtimeMs), 0)
}

function getGitState() {
  try {
    const bundledGit = 'C:\\Program Files\\Git\\cmd\\git.exe'
    const gitCommand = process.platform === 'win32' && fs.existsSync(bundledGit) ? bundledGit : 'git'
    const branch = execFileSync(gitCommand, ['branch', '--show-current'], { cwd: ROOT, encoding: 'utf8' }).trim() || 'detached'
    const lines = execFileSync(gitCommand, ['status', '--short'], { cwd: ROOT, encoding: 'utf8' })
      .split(/\r?\n/)
      .filter(Boolean)
    return {
      branch,
      dirty: lines.length > 0,
      changedCount: lines.length,
      stagedCount: lines.filter((line) => line[0] !== ' ' && line[0] !== '?').length,
      unstagedCount: lines.filter((line) => line[1] !== ' ').length,
      untrackedCount: lines.filter((line) => line.startsWith('??')).length
    }
  } catch (error) {
    let branch = 'unknown'
    try {
      const head = fs.readFileSync(path.join(ROOT, '.git', 'HEAD'), 'utf8').trim()
      branch = head.startsWith('ref: refs/heads/') ? head.slice('ref: refs/heads/'.length) : 'detached'
    } catch (readError) {
      branch = 'unknown'
    }
    return { branch, dirty: null, changedCount: null, stagedCount: null, unstagedCount: null, untrackedCount: null }
  }
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
  return (((config.tabBar || {}).list) || []).map((item) => ({
    pagePath: item.pagePath,
    text: item.text,
    iconPath: item.iconPath,
    selectedIconPath: item.selectedIconPath
  }))
}

function sameJson(left, right) {
  return JSON.stringify(left) === JSON.stringify(right)
}

function formatTime(value) {
  if (!value) return '不存在'
  return new Date(value).toISOString()
}

function statusLabel(status) {
  return `**${status}**`
}

function main() {
  const packageAudit = spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'mp-package-audit.js')], { cwd: ROOT, encoding: 'utf8' })
  const packageBudgetPassed = packageAudit.status === 0
  const manifest = parseJsonWithComments('manifest.json')
  const projectConfig = parseJsonWithComments('project.config.json')
  const pagesConfig = parsePagesJson()
  const aiConfig = read('cloudfunctions/ai_generate/utils/config.js')
  const aiGenerate = read('cloudfunctions/ai_generate/index.js')
  const quotaGuard = read('cloudfunctions/quota_guard/index.js')
  const clientGenerate = read('utils/api/generate.js')
  const homeCapabilities = read('utils/home/homeCapabilities.js')
  const resultPage = read('package-ai/result/result.vue')
  const deliveryCenter = read('utils/workspace/workspaceBatchDeliveryCenter.js')
  const pagesSource = read('pages.json')
  const template = resultPage.split('</template>')[0]
  const git = getGitState()

  const sourceRoots = [
    'pages/index', 'pages/mine', 'pages/gallery', 'pages/settings',
    'package-ai', 'package-assets', 'package-mobile-enterprise',
    'components', 'utils', 'pages.json', 'manifest.json', 'App.vue', 'main.js'
  ]
  const sourceFiles = sourceRoots.flatMap((relativePath) => {
    const fullPath = path.join(ROOT, relativePath)
    if (!fs.existsSync(fullPath)) return []
    return fs.statSync(fullPath).isDirectory() ? listFiles(fullPath) : [fullPath]
  })
  const buildFiles = listFiles(BUILD_ROOT)
  const sourceMtime = newestMtime(sourceFiles)
  const buildMtime = newestMtime(buildFiles)
  const buildExists = fs.existsSync(path.join(BUILD_ROOT, 'app.json'))
  const buildFresh = buildExists && buildMtime >= sourceMtime

  let buildConfig = null
  try {
    buildConfig = buildExists ? JSON.parse(fs.readFileSync(path.join(BUILD_ROOT, 'app.json'), 'utf8')) : null
  } catch (error) {
    buildConfig = null
  }

  const sourceRoutes = normalizeRoutes(pagesConfig)
  const buildRoutes = normalizeRoutes(buildConfig || {})
  const routeSync = buildConfig ? sameJson(sourceRoutes, buildRoutes) : false
  const tabSync = buildConfig ? sameJson(normalizeTabs(pagesConfig), normalizeTabs(buildConfig)) : false

  const batchEntry = homeCapabilities.match(/id:\s*'batch_model'[\s\S]{0,300}?\}\)/)
  const batchGenerationEnabled = Boolean(batchEntry && !/enabled:\s*false/.test(batchEntry[0]))
  const videoGenerationReachable = /handleExtensionAction\s*\(/.test(template) && /RUNWAY_VIDEO/.test(template)
  const autoDeliveryEnabled = /autoDelivery\s*[:=]\s*true|autoApprove\s*[:=]\s*true/i.test(`${resultPage}\n${deliveryCenter}`)
  const deliveryApprovalEnabled = /markDeliveryApproved\s*\(/.test(resultPage) && sourceRoutes.some((route) => /package-mobile-enterprise\/(delivery|project|batch)/.test(route))
  const debugToolsEnabled = sourceRoutes.some((route) => /cloud-alpha|pages\/admin|pages\/developer|pages\/task-admin/i.test(route))

  const checks = [
    ['包体预算与平台边界', packageBudgetPassed, 'PASS', 'BLOCKED'],
    ['Provider 源码默认 mock', /DEFAULT_PROVIDER\s*=\s*'mock'/.test(aiConfig), 'PASS', 'BLOCKED'],
    ['真实 Provider 仅显式开启', /ENABLE_REAL_PROVIDER_CALL/.test(aiConfig) && /isExplicitTrue/.test(aiConfig), 'PASS', 'BLOCKED'],
    ['Provider dry-run 默认关闭', /isProviderDryRunEnabled/.test(aiGenerate) && /isExplicitTrue\(process\.env\.PROVIDER_DRY_RUN\)/.test(aiGenerate), 'PASS', 'BLOCKED'],
    ['真实 quota 默认关闭', /ENABLE_REAL_QUOTA_GUARD[\s\S]{0,160}===\s*'true'/.test(quotaGuard), 'PASS', 'BLOCKED'],
    ['客户端云失败不伪造成功', /ENABLE_CLIENT_GENERATE_MOCK_FALLBACK\s*=\s*false/.test(clientGenerate), 'PASS', 'BLOCKED'],
    ['mock/fallback 禁止正式审核', /blocked mock approve/.test(resultPage) && /provider\.includes\('mock'\)/.test(deliveryCenter), 'PASS', 'BLOCKED'],
    ['批量生成关闭', !batchGenerationEnabled, 'PASS', 'BLOCKED'],
    ['视频生成关闭', !videoGenerationReachable, 'PASS', 'BLOCKED'],
    ['自动交付关闭', !autoDeliveryEnabled, 'PASS', 'BLOCKED'],
    ['交付审批关闭', !deliveryApprovalEnabled, 'PASS', 'BLOCKED'],
    ['开发调试页面关闭', !debugToolsEnabled, 'PASS', 'BLOCKED'],
    ['正式构建存在', buildExists, 'PASS', 'BLOCKED'],
    ['正式构建晚于源码', buildFresh, 'PASS', 'BLOCKED'],
    ['正式构建路由同步', routeSync, 'PASS', 'BLOCKED'],
    ['正式构建 tabBar 同步', tabSync, 'PASS', 'BLOCKED'],
    ['正式 MP 不注册 H5 企业后台', !sourceRoutes.some((route) => /enterprise-web|pages\/admin|pages\/workspace/.test(route)), 'PASS', 'BLOCKED'],
    ['正式 MP 不注册 Cloud Alpha', !sourceRoutes.some((route) => /cloud-alpha/i.test(route)), 'PASS', 'BLOCKED']
  ].map(([name, ok, passStatus, failStatus]) => ({ name, status: ok ? passStatus : failStatus }))

  const appidConfiguredInProject = Boolean(projectConfig.appid && !/tourist|placeholder|your-app/i.test(projectConfig.appid))
  const appidConfiguredInManifest = Boolean(manifest['mp-weixin'] && manifest['mp-weixin'].appid)
  const mpManifest = manifest['mp-weixin'] || {}
  const privateInfoCount = Array.isArray(mpManifest.requiredPrivateInfos) ? mpManifest.requiredPrivateInfos.length : 0
  const permissionCount = mpManifest.permission && typeof mpManifest.permission === 'object'
    ? Object.keys(mpManifest.permission).length
    : 0
  const cloudFunctionRoot = path.join(ROOT, 'cloudfunctions')
  const cloudFunctionCount = fs.existsSync(cloudFunctionRoot)
    ? fs.readdirSync(cloudFunctionRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && fs.existsSync(path.join(cloudFunctionRoot, entry.name, 'index.js')))
      .length
    : 0
  const blockers = checks.filter((item) => item.status === 'BLOCKED')
  const sourceSafe = checks.slice(0, 10).every((item) => item.status === 'PASS')
  const releaseReady = blockers.length === 0 && appidConfiguredInProject

  const lines = []
  lines.push('# 蝶变小程序体验版发布预检报告')
  lines.push('')
  lines.push(`生成时间：${new Date().toISOString()}`)
  lines.push('')
  lines.push('## 发布结论')
  lines.push('')
  lines.push(releaseReady ? '**READY FOR MANUAL UPLOAD**' : '**BLOCKED**')
  lines.push('')
  lines.push('该结论只覆盖本地源码与构建产物。微信云函数已部署环境、开发者工具编译、体验版上传和真机行为均为 **NOT RUN**。')
  lines.push('')
  lines.push('## 基线')
  lines.push('')
  lines.push(`- 当前分支：\`${git.branch}\``)
  const gitSummary = git.dirty === null
    ? '当前沙箱不能从 Node 子进程调用 git，请以 `git status --short` 为准'
    : git.dirty
      ? `有 ${git.changedCount} 个状态项（暂存 ${git.stagedCount}、未暂存 ${git.unstagedCount}、未跟踪 ${git.untrackedCount}）`
      : '干净'
  lines.push(`- 工作区：${gitSummary}`)
  lines.push(`- 版本：\`${manifest.versionName || '未配置'}\` / \`${manifest.versionCode || '未配置'}\``)
  lines.push(`- AppID：project.config.json ${appidConfiguredInProject ? '已配置' : '未配置'}；manifest.json ${appidConfiguredInManifest ? '已配置' : '未配置'}（不输出具体值）`)
  lines.push(`- 本地运行环境：\`${process.platform}\` / Node \`${process.version}\` / NODE_ENV \`${process.env.NODE_ENV || '未设置'}\``)
  lines.push(`- 云函数源码目录：\`cloudfunctions\`，发现 ${cloudFunctionCount} 个入口文件；本轮不复制、不部署`)
  lines.push(`- 隐私与权限声明：requiredPrivateInfos ${privateInfoCount} 项，permission ${permissionCount} 项；需在微信公众平台人工核对隐私保护指引`)
  lines.push(`- debugTools：${debugToolsEnabled ? '已进入 MP 路由' : '未进入 MP 路由'}`)
  lines.push(`- 构建目录：\`${path.relative(ROOT, BUILD_ROOT).replace(/\\/g, '/')}\``)
  lines.push(`- 源码最新时间：${formatTime(sourceMtime)}`)
  lines.push(`- 构建最新时间：${formatTime(buildMtime)}`)
  lines.push(`- 源码安全组合：${sourceSafe ? '满足' : '不满足'}`)
  lines.push('')
  lines.push('## 自动检查')
  lines.push('')
  lines.push('| 检查项 | 结果 |')
  lines.push('| --- | --- |')
  checks.forEach((item) => lines.push(`| ${item.name} | ${statusLabel(item.status)} |`))
  lines.push(`| AppID 项目配置 | ${statusLabel(appidConfiguredInProject ? 'PASS' : 'BLOCKED')} |`)
  lines.push(`| manifest AppID 配置 | ${statusLabel(appidConfiguredInManifest ? 'PASS' : 'WARN')} |`)
  lines.push('| 已部署 ai_generate 环境变量 | **NOT RUN** |')
  lines.push('| 已部署 quota_guard 环境变量 | **NOT RUN** |')
  lines.push('| 微信开发者工具编译 | **NOT RUN** |')
  lines.push('| 体验版上传 | **NOT RUN** |')
  lines.push('| 真机验收 | **NOT RUN** |')
  lines.push('')
  lines.push('## 阻塞项')
  lines.push('')
  if (blockers.length) blockers.forEach((item) => lines.push(`- ${item.name}`))
  else lines.push('- 无本地自动检查阻塞项。')
  if (!appidConfiguredInProject) lines.push('- project.config.json 未配置可用 AppID。')
  lines.push('')
  lines.push('## 警告')
  lines.push('')
  if (!appidConfiguredInManifest) lines.push('- manifest.json 未配置 MP AppID；正式构建前需在 HBuilderX manifest 可视化配置中确认。')
  else lines.push('- 无。')
  lines.push('')
  lines.push('## 安全说明')
  lines.push('')
  lines.push('- 本脚本不会上传体验版、部署云函数、修改数据库权限或调用真实生成。')
  lines.push('- 本脚本不会输出 AppID、OPENID、Token、云凭证、图片地址或完整业务记录。')
  lines.push('- 源码默认值不能证明已部署云函数环境变量；必须在微信开发者工具中执行 Runbook 的安全摘要检查。')
  lines.push('- 测试必须使用非客户素材；mock/fallback 结果只能作为测试结果，不得正式审核或交付。')
  lines.push('')

  fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true })
  fs.writeFileSync(REPORT_PATH, `${lines.join('\n')}\n`)
  console.log(lines.join('\n'))
  if (!releaseReady) process.exitCode = 1
}

try {
  main()
} catch (error) {
  console.error(`[experience-preflight] failed: ${error && error.message ? error.message : 'unknown_error'}`)
  process.exitCode = 1
}
