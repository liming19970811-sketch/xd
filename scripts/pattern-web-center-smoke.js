const fs = require('fs')
const path = require('path')
const parser = require('@babel/parser')

const ROOT = path.resolve(__dirname, '..')
const checks = []

function read(relative) {
  return fs.readFileSync(path.join(ROOT, relative), 'utf8')
}

function check(name, passed, detail = '') {
  checks.push({ name, passed: Boolean(passed), detail })
}

function extract(source, tag) {
  const startMatch = source.match(new RegExp(`<${tag}[^>]*>`, 'i'))
  if (!startMatch || startMatch.index === undefined) return ''
  const start = startMatch.index + startMatch[0].length
  const end = source.toLowerCase().lastIndexOf(`</${tag}>`)
  return end > start ? source.slice(start, end) : ''
}

function checkTemplate(template) {
  const stack = []
  const voidTags = new Set(['image', 'input'])
  const pattern = /<\/?([a-zA-Z][\w-]*)(?:\s[^<>]*?)?\s*\/?>/g
  let match
  while ((match = pattern.exec(template))) {
    const token = match[0]
    const tag = match[1]
    if (token.startsWith('</')) {
      if (voidTags.has(tag)) continue
      if (stack.pop() !== tag) return false
    } else if (!token.endsWith('/>') && !voidTags.has(tag)) {
      stack.push(tag)
    }
  }
  return stack.length === 0
}

const pagePath = 'pages/enterprise-web/pattern-center.vue'
const page = read(pagePath)
const script = extract(page, 'script')
const template = extract(page, 'template')

try {
  parser.parse(script, { sourceType: 'module', plugins: ['optionalChaining', 'nullishCoalescingOperator'] })
  check('center Vue script syntax', true)
} catch (error) {
  check('center Vue script syntax', false, error.message)
}
check('center template tags', checkTemplate(template))

const pages = read('pages.json')
const h5Start = pages.indexOf('// #ifdef H5')
const h5End = pages.lastIndexOf('// #endif')
const centerRoute = pages.indexOf('"path": "pattern-center"')
check('pattern center route registered', centerRoute >= 0)
check('pattern center route is H5-only', centerRoute > h5Start && centerRoute < h5End)

const routes = read('utils/enterprise-web/enterpriseWebRoutes.js')
const menu = read('utils/enterprise-web/enterpriseWebMenu.js')
const websiteRouter = read('utils/navigation/websiteFeatureRouter.js')
check('enterprise route registered', routes.includes("patternCenter: '/pages/enterprise-web/pattern-center'"))
check('permission-gated enterprise menu', menu.includes("permission: 'pattern_library.view'") && menu.includes('ENTERPRISE_WEB_ROUTES.patternCenter'))
check('miniapp light links use web center', ['tab=library', 'tab=review', 'tab=training'].every((value) => websiteRouter.includes(value)))

const reviewTransport = read('utils/pattern/patternReviewTransport.js')
const trainingTransport = read('utils/pattern/patternTrainingTransport.js')
check('review transport supports H5 CloudBase', reviewTransport.includes("callCloudWebFunction(FUNCTION_NAME, payload)") && reviewTransport.includes('ensureCloudWebAuth'))
check('training transport supports H5 CloudBase', trainingTransport.includes("callCloudWebFunction(FUNCTION_NAME, payload)") && trainingTransport.includes('ensureCloudWebAuth'))
check('miniapp wx.cloud path retained', reviewTransport.includes('wx.cloud.callFunction') && trainingTransport.includes('wx.cloud.callFunction'))
check('cloud enterprise session required', reviewTransport.includes('cloud_authenticated') && trainingTransport.includes('cloud_authenticated'))
check('no provider credentials in web page', !/(api[_-]?key|secret|access[_-]?token|sessionToken)/i.test(page))
check('shared cloud repositories used', [
  'searchApprovedPatternLibrary', 'getPatternReviewQueue', 'getPatternTrainingSummary'
].every((name) => page.includes(name)))

checks.forEach((item) => {
  console.log(`[${item.passed ? 'PASS' : 'FAIL'}] ${item.name}${item.detail ? ` - ${item.detail}` : ''}`)
})

const failed = checks.filter((item) => !item.passed)
console.log(`pattern web center smoke: ${checks.length - failed.length}/${checks.length} passed`)
if (failed.length) process.exitCode = 1
