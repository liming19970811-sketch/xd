const fs = require('fs')
const path = require('path')
const vm = require('vm')
const parser = require('@babel/parser')
const packageBudget = require('./mp-package-budget')

const ROOT = path.resolve(__dirname, '..')
const MB = 1024 * 1024
const results = []
const executedAt = new Date().toISOString()

function record(name, ok, detail = '') {
  results.push({ name, ok: Boolean(ok), detail })
  console.log(`${ok ? '[PASS]' : '[FAIL]'} ${name}${detail ? ` - ${detail}` : ''}`)
}

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8')
}

function listFiles(directory, extensions = null) {
  const root = path.join(ROOT, directory)
  if (!fs.existsSync(root)) return []
  const files = []
  const walk = (current) => {
    fs.readdirSync(current, { withFileTypes: true }).forEach((entry) => {
      const fullPath = path.join(current, entry.name)
      if (entry.isDirectory()) walk(fullPath)
      else if (!extensions || extensions.includes(path.extname(entry.name).toLowerCase())) files.push(fullPath)
    })
  }
  walk(root)
  return files
}

function stripConditional(source, platform = 'MP-WEIXIN') {
  const active = [true]
  return source.split(/\r?\n/).filter((line) => {
    const ifdef = line.match(/^\s*\/\/\s*#ifdef\s+(.+)$/)
    const ifndef = line.match(/^\s*\/\/\s*#ifndef\s+(.+)$/)
    if (ifdef || ifndef) {
      const names = (ifdef || ifndef)[1].split(/\s*\|\|\s*/)
      const matched = names.includes(platform)
      active.push(active[active.length - 1] && (ifdef ? matched : !matched))
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
  const source = stripConditional(read('pages.json'))
  return JSON.parse(source.replace(/\/\*[\s\S]*?\*\//g, ''))
}

function registeredRoutes(config) {
  const routes = new Set((config.pages || []).map((item) => `/${item.path}`))
  ;(config.subPackages || []).forEach((group) => {
    ;(group.pages || []).forEach((item) => routes.add(`/${group.root}/${item.path}`))
  })
  return routes
}

function checkRoutes(config) {
  const routes = registeredRoutes(config)
  const missingFiles = [...routes].filter((route) => !fs.existsSync(path.join(ROOT, `${route.slice(1)}.vue`)))
  record('所有注册路由存在', missingFiles.length === 0, missingFiles.join(', '))

  const tabRoutes = new Set((((config.tabBar || {}).list) || []).map((item) => `/${item.pagePath}`))
  const invalidTabs = [...tabRoutes].filter((route) => !routes.has(route) || !(config.pages || []).some((item) => `/${item.path}` === route))
  record('tabBar 路由属于主包且已注册', invalidTabs.length === 0, invalidTabs.join(', '))

  const sourceRoots = ['pages/index', 'pages/mine', 'pages/gallery', 'pages/gallery-detail', 'package-ai', 'package-assets', 'package-mobile-enterprise']
  const navigationIssues = []
  const oldRoutes = []
  sourceRoots.flatMap((root) => listFiles(root, ['.vue', '.js'])).forEach((file) => {
    const relative = path.relative(ROOT, file).replace(/\\/g, '/')
    if (relative.endsWith('.vue') && !routes.has(`/${relative.slice(0, -4)}`)) return
    const source = stripConditional(fs.readFileSync(file, 'utf8'))
    const callPattern = /(navigateTo|redirectTo|reLaunch|switchTab)\s*\(\s*\{[\s\S]{0,500}?url\s*:\s*([`'"])(\/[^`'"]+)\2/g
    let match
    while ((match = callPattern.exec(source))) {
      const method = match[1]
      const route = match[3].split('?')[0].split('${')[0]
      if (!route || route.endsWith('/')) continue
      if (['/pages/result/result', '/pages/work/work', '/pages/upload/upload'].includes(route)) oldRoutes.push(`${relative}: ${route}`)
      if (!routes.has(route)) navigationIssues.push(`${relative}: ${method} ${route}`)
      if (tabRoutes.has(route) && method !== 'switchTab') navigationIssues.push(`${relative}: tabBar 应使用 switchTab ${route}`)
      if (!tabRoutes.has(route) && method === 'switchTab') navigationIssues.push(`${relative}: 普通页面不能使用 switchTab ${route}`)
    }
  })
  record('页面跳转与 pages.json 一致', navigationIssues.length === 0, navigationIssues.slice(0, 8).join('; '))
  record('不存在旧迁移路由', oldRoutes.length === 0, oldRoutes.join('; '))
}

function extractBlock(source, tag) {
  const opening = source.match(new RegExp(`<${tag}[^>]*>`, 'i'))
  if (!opening || opening.index === undefined) return ''
  const start = opening.index + opening[0].length
  const end = source.toLowerCase().lastIndexOf(`</${tag}>`)
  return end > start ? source.slice(start, end) : ''
}

function checkVueFiles() {
  const roots = ['pages/index', 'pages/mine', 'pages/gallery', 'pages/gallery-detail', 'package-ai', 'package-assets', 'package-mobile-enterprise']
  const files = roots.flatMap((root) => listFiles(root, ['.vue']))
  const scriptErrors = []
  const templateErrors = []
  files.forEach((file) => {
    const relative = path.relative(ROOT, file).replace(/\\/g, '/')
    const source = fs.readFileSync(file, 'utf8')
    const script = extractBlock(source, 'script')
    const template = extractBlock(source, 'template')
    if (!script || !template) templateErrors.push(`${relative}: 缺少 script/template`)
    if (script) {
      try {
        parser.parse(stripConditional(script), {
          sourceType: 'module',
          plugins: ['dynamicImport', 'optionalChaining', 'objectRestSpread', 'classProperties']
        })
      } catch (error) {
        scriptErrors.push(`${relative}:${error.loc ? error.loc.line : 0} ${error.message}`)
      }
    }
    if (template) {
      const stack = []
      const voidTags = new Set(['image', 'input'])
      const pattern = /<\/?([a-zA-Z][\w-]*)(?:\s[^<>]*?)?\s*\/?>/g
      let match
      while ((match = pattern.exec(template))) {
        const token = match[0]
        const tag = match[1]
        if (token.startsWith('</')) {
          if (voidTags.has(tag)) continue
          const opened = stack.pop()
          if (opened !== tag) {
            templateErrors.push(`${relative}: </${tag}> 与 <${opened || '无'}> 不匹配`)
            break
          }
        } else if (!token.endsWith('/>') && !voidTags.has(tag)) {
          stack.push(tag)
        }
      }
      if (stack.length) templateErrors.push(`${relative}: 未闭合 <${stack[stack.length - 1]}>`)
    }
  })
  record('Vue script 语法检查', scriptErrors.length === 0, scriptErrors.slice(0, 5).join('; '))
  record('Vue template 标签检查', templateErrors.length === 0, templateErrors.slice(0, 5).join('; '))
}

function loadWorkRepository(tasks) {
  const storage = {
    diebiandesign_current_user: {
      userId: 'release_smoke_user',
      openId: 'release_smoke_openid'
    },
    diebiandesign_wechat_identity: {
      openId: 'release_smoke_openid'
    }
  }
  let generatedIndex = 0
  let historyIndex = 0
  let source = read('utils/work/workRepository.js')
    .replace(/^import .*$/gm, '')
    .replace(/export\s+(const|function)\s+/g, '$1 ')
    .replace(/export\s*\{[^}]+\}\s*$/gm, '')
  source += '\nmodule.exports = { getMyWorks, getWorkDetail, setWorkSaved, regenerateWork };'
  const context = {
    module: { exports: {} },
    exports: {},
    console,
    Date,
    Set,
    Object,
    Array,
    Number,
    String,
    Math,
    RegExp,
    uni: {
      getStorageSync(key) { return storage[key] },
      setStorageSync(key, value) { storage[key] = value }
    },
    listTasks() { return tasks },
    getWorkspaceProductions() { return [] },
    createWorkspacePlanHistory(input) {
      historyIndex += 1
      return { historyId: `release_smoke_history_${historyIndex}`, ...input }
    },
    linkWorkspacePlanTasks(historyId, taskIds) { return { historyId, taskIds } },
    failWorkspacePlanHistory(historyId) { return { historyId, status: 'failed' } },
    createTaskAndRun(input) {
      generatedIndex += 1
      return { taskId: `release_smoke_new_${generatedIndex}`, input }
    }
  }
  vm.runInNewContext(source, context, { filename: 'workRepository.js' })
  return context.module.exports
}

function checkWorkFlow() {
  const tasks = [{
    taskId: 'release_smoke_old',
    taskType: 'model_replace',
    status: 'completed',
    createdAt: '2026-01-01T00:00:00.000Z',
    input: { assets: { clothImage: 'local-source.jpg' }, params: { toolType: 'model' } },
    userId: 'release_smoke_user',
    result: { items: { imageUrl: 'https://example.com/local-result.jpg' } }
  }, {
    taskId: 'release_smoke_old',
    status: 'completed',
    result: 'duplicate-result.jpg'
  }, {
    taskId: 'release_smoke_failed',
    userId: 'release_smoke_user',
    status: 'failed',
    result: { items: [] }
  }]
  try {
    const repository = loadWorkRepository(tasks)
    const page = repository.getMyWorks({ page: 1, pageSize: 20 })
    const saved = repository.setWorkSaved('release_smoke_old', true)
    const regenerated = repository.regenerateWork('release_smoke_old')
    record('作品分页、去重与对象型 result 兼容', page.total === 1 && page.items.length === 1 && page.items[0].coverUrl === 'https://example.com/local-result.jpg')
    record('结果可保存到作品偏好', Boolean(saved && saved.isSaved))
    record('再次生成创建新 taskId、新 historyId 且保留旧作品', Boolean(
      regenerated &&
      regenerated.taskId &&
      regenerated.taskId !== 'release_smoke_old' &&
      regenerated.input &&
      regenerated.input.params &&
      /^release_smoke_history_/.test(regenerated.input.params.historyId || '')
    ))
  } catch (error) {
    record('作品仓储运行 Smoke', false, error.message)
  }
}

function checkOnboarding() {
  const storage = {}
  let source = read('utils/onboarding/onboardingRepository.js')
    .replace(/export\s+(const|function)\s+/g, '$1 ')
    .replace(/export\s*\{[^}]+\}\s*$/gm, '')
  source += '\nmodule.exports = { hasCompletedOnboarding, completeOnboarding, resetOnboarding };'
  const context = {
    module: { exports: {} },
    exports: {},
    console,
    Date,
    process: { env: { NODE_ENV: 'production' } },
    uni: {
      getStorageSync(key) { return storage[key] },
      setStorageSync(key, value) { storage[key] = value },
      removeStorageSync(key) { delete storage[key] }
    }
  }
  try {
    vm.runInNewContext(source, context, { filename: 'onboardingRepository.js' })
    const repository = context.module.exports
    const firstVisit = repository.hasCompletedOnboarding() === false
    const completed = repository.completeOnboarding('skipped') && repository.hasCompletedOnboarding() === true
    const reset = repository.resetOnboarding() && repository.hasCompletedOnboarding() === false
    record('新手引导仅首次显示且可重置', firstVisit && completed && reset)
  } catch (error) {
    record('新手引导存储 Smoke', false, error.message)
  }
}

function checkBusinessBoundaries() {
  const indexSource = read('pages/index/index.vue')
  const guideSource = read('package-ai/production-guide/production-guide.vue')
  record('首页主入口指向生产向导', indexSource.includes('/package-ai/production-guide/production-guide'))
  record('首页三个生产目标参数存在', ['product_launch', 'new_design', 'marketing'].every((value) => indexSource.includes(value)))
  record('生产上下文参数完整', ['productionType', 'assets', 'recommendedActions', 'selectedAction'].every((value) => guideSource.includes(value)))
  record('缺少服装图片时禁止进入制作', guideSource.includes('请先上传服装图片') && guideSource.includes('!uploadFiles.cloth'))

  const memberFiles = ['utils/member/membershipRepository.js', 'utils/member/planRepository.js', 'pages/mine/mine.vue', 'pages/package-center/package-center.vue']
  const memberSource = memberFiles.map(read).join('\n')
  const hasQuotaMutation = /action\s*:\s*['"](?:consumeAiPoints|consumeRefineQuota|consumeRunwayVideoQuota|rollbackUsage|finalizeUsage)['"]/.test(memberSource)
  const hasDirectQuotaWrite = /collection\s*\(\s*['"]membership_usage(?:_records)?['"]\s*\)[\s\S]{0,180}\.(?:add|set|update|remove)\s*\(/.test(memberSource)
  record('额度展示保持只读', !hasQuotaMutation && !hasDirectQuotaWrite)
  record('会员升级不触发支付', !/requestPayment\s*\(|wx\.requestPayment\s*\(|createPaymentOrder/.test(memberSource))
  const resultSource = read('package-ai/result/result.vue')
  record('mock/fallback 交付审核红线保留', resultSource.includes('isCurrentTaskMockOrFallback') && resultSource.includes('体验结果不可审核交付'))
  record('分享路径不携带 token', !/(?:token|sessionToken|accessToken)=/i.test(resultSource + read('pages/gallery/gallery.vue')))
  const uploadSource = read('package-ai/upload/upload.vue')
  record('生成轮询包含超时和失败恢复', uploadSource.includes("pollResult.reason === 'timeout'") && uploadSource.includes('retryGenerate'))
}

function checkSourceSafety() {
  const roots = ['pages/index', 'pages/mine', 'pages/gallery', 'pages/gallery-detail', 'package-ai', 'package-assets', 'package-mobile-enterprise', 'utils/work', 'utils/onboarding', 'utils/member']
  const files = roots.flatMap((root) => listFiles(root, ['.vue', '.js', '.json']))
  const mojibake = []
  const placeholderCopy = []
  const sensitiveLogs = []
  const mojibakePattern = /\uFFFD|锟斤拷|浣滃搧|棣栭〉|鐢熸垚|浜や粯|鏆傛棤/
  const sensitivePattern = /sessionToken|OPENID|UNIONID|accessToken|secret|手机号|邮箱|signedUrl|signature/i
  files.forEach((file) => {
    const relative = path.relative(ROOT, file).replace(/\\/g, '/')
    const source = fs.readFileSync(file, 'utf8')
    if (mojibakePattern.test(source)) mojibake.push(relative)
    if (/['"`]N\/A['"`]|暂无时间|>\s*(?:Works|Gallery|Assets|Loading|Retry)\s*</i.test(source)) placeholderCopy.push(relative)
    const statements = source.match(/console\.(?:log|info|warn|error)\s*\([\s\S]{0,800}?\)/g) || []
    if (statements.some((statement) => sensitivePattern.test(statement.replace(/hasOpenid/gi, 'hasIdentity')))) sensitiveLogs.push(relative)
  })
  record('中文乱码扫描', mojibake.length === 0, mojibake.slice(0, 8).join(', '))
  record('英文占位与时间兜底扫描', placeholderCopy.length === 0, placeholderCopy.slice(0, 8).join(', '))
  record('敏感前端日志扫描', sensitiveLogs.length === 0, sensitiveLogs.slice(0, 8).join(', '))
}

function checkPackage(config) {
  const release = path.join(ROOT, 'unpackage/dist/build/mp-weixin')
  const development = path.join(ROOT, 'unpackage/dist/dev/mp-weixin')
  const dist = fs.existsSync(release) ? release : development
  if (!fs.existsSync(dist)) {
    record('小程序构建产物存在', false, '未找到 MP-WEIXIN 构建产物')
    return
  }
  const packageRoots = (config.subPackages || []).map((item) => item.root)
  const sizes = Object.fromEntries(packageRoots.map((root) => [root, 0]))
  let mainSize = 0
  let totalSize = 0
  const oversizedImages = []
  listFiles(path.relative(ROOT, dist)).forEach((file) => {
    const relative = path.relative(dist, file).replace(/\\/g, '/')
    const size = fs.statSync(file).size
    totalSize += size
    const root = packageRoots.find((item) => relative === item || relative.startsWith(`${item}/`))
    if (root) sizes[root] += size
    else mainSize += size
    if (/\.(png|jpe?g|gif|webp)$/i.test(relative) && size > 100 * 1024 && !/logo/i.test(relative)) oversizedImages.push(relative)
  })
  const buildFiles = listFiles(path.relative(ROOT, dist))
  const sourceFiles = ['pages', 'package-ai', 'package-assets', 'package-mobile-enterprise', 'utils']
    .flatMap((root) => listFiles(root, ['.vue', '.js', '.json']))
    .concat(['App.vue', 'main.js', 'pages.json', 'manifest.json'].map((file) => path.join(ROOT, file)).filter(fs.existsSync))
  const buildMtime = buildFiles.reduce((latest, file) => Math.max(latest, fs.statSync(file).mtimeMs), 0)
  const sourceMtime = sourceFiles.reduce((latest, file) => Math.max(latest, fs.statSync(file).mtimeMs), 0)
  record('正式产物晚于本轮小程序源码', buildMtime >= sourceMtime, `产物 ${new Date(buildMtime).toISOString()} / 源码 ${new Date(sourceMtime).toISOString()}`)
  record('主包低于内部阻断线', mainSize < packageBudget.mainPackageBlocking, `${(mainSize / 1024).toFixed(1)} KB`)
  const oversizedPackages = Object.entries(sizes).filter(([, size]) => size >= packageBudget.subPackageBlocking)
  record('单分包低于内部阻断线', oversizedPackages.length === 0, Object.entries(sizes).map(([name, size]) => `${name} ${(size / 1024).toFixed(1)}KB`).join(', '))
  record('总包低于内部阻断线', totalSize < packageBudget.totalBlocking, `${(totalSize / MB).toFixed(2)} MB`)
  record('非 Logo 图片不超过 100KB', oversizedImages.length === 0, oversizedImages.join(', '))
  const builtApp = fs.existsSync(path.join(dist, 'app.json')) ? fs.readFileSync(path.join(dist, 'app.json'), 'utf8') : ''
  let builtConfig = {}
  try {
    builtConfig = JSON.parse(builtApp)
  } catch (error) {
    builtConfig = {}
  }
  const sourceRoutes = [...registeredRoutes(config)].sort()
  const builtRoutes = [
    ...(builtConfig.pages || []).map((item) => `/${item}`),
    ...(builtConfig.subPackages || []).flatMap((group) => (group.pages || []).map((item) => `/${group.root}/${item}`))
  ].sort()
  record('正式产物路由与 pages.json 同步', JSON.stringify(sourceRoutes) === JSON.stringify(builtRoutes))
  const sourceTabs = (((config.tabBar || {}).list) || []).map(({ pagePath, text, iconPath, selectedIconPath }) => ({ pagePath, text, iconPath, selectedIconPath }))
  const builtTabs = (((builtConfig.tabBar || {}).list) || []).map(({ pagePath, text, iconPath, selectedIconPath }) => ({ pagePath, text, iconPath, selectedIconPath }))
  record('正式产物 tabBar 与 pages.json 同步', JSON.stringify(sourceTabs) === JSON.stringify(builtTabs))
  record('正式 MP 不包含 enterprise-web', !builtApp.includes('enterprise-web'))
  record('正式 MP 不包含 Cloud Alpha 页面', !builtApp.includes('cloud-alpha'))
}

function main() {
  console.log(`Miniapp release smoke executedAt: ${executedAt}`)
  let config
  try {
    config = parsePagesJson()
    record('pages.json 可解析', true)
  } catch (error) {
    record('pages.json 可解析', false, error.message)
    process.exitCode = 1
    return
  }
  checkRoutes(config)
  checkVueFiles()
  checkOnboarding()
  checkWorkFlow()
  checkBusinessBoundaries()
  checkSourceSafety()
  checkPackage(config)
  const failed = results.filter((item) => !item.ok)
  console.log(`\nMiniapp release smoke: ${results.length - failed.length}/${results.length} passed`)
  if (failed.length) process.exitCode = 1
}

main()
