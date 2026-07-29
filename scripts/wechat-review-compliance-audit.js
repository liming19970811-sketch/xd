const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8')
}

function exists(relativePath) {
  return fs.existsSync(path.join(ROOT, relativePath))
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

function parseJsonWithComments(relativePath, platformAware = false) {
  let source = read(relativePath)
  if (platformAware) source = stripPlatformConditionals(source)
  return JSON.parse(source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, ''))
}

function collectRoutes(config) {
  const routes = []
  ;(config.pages || []).forEach((page) => routes.push(typeof page === 'string' ? page : page.path))
  ;(config.subPackages || []).forEach((group) => {
    ;(group.pages || []).forEach((page) => {
      routes.push(`${group.root}/${typeof page === 'string' ? page : page.path}`)
    })
  })
  return routes.filter(Boolean)
}

function listFiles(relativePath) {
  const root = path.join(ROOT, relativePath)
  if (!fs.existsSync(root)) return []
  if (fs.statSync(root).isFile()) return [root]
  const files = []
  const walk = (current) => {
    fs.readdirSync(current, { withFileTypes: true }).forEach((entry) => {
      const candidate = path.join(current, entry.name)
      if (entry.isDirectory()) walk(candidate)
      else files.push(candidate)
    })
  }
  walk(root)
  return files
}

function relative(file) {
  return path.relative(ROOT, file).replace(/\\/g, '/')
}

function scan(files, pattern) {
  return files.flatMap((file) => {
    const source = fs.readFileSync(file, 'utf8')
    const matches = source.match(pattern) || []
    return matches.map((match) => ({ file: relative(file), match }))
  })
}

function printCheck(name, status, detail) {
  console.log(`${status.padEnd(8)} ${name}${detail ? ` - ${detail}` : ''}`)
}

function main() {
  const pages = parseJsonWithComments('pages.json', true)
  const manifest = parseJsonWithComments('manifest.json')
  const routes = collectRoutes(pages)
  const routeFiles = routes.map((route) => `${route}.vue`)
  const missingRoutes = routeFiles.filter((file) => !exists(file))
  const sourceFiles = [
    ...routeFiles.filter(exists).map((file) => path.join(ROOT, file)),
    ...listFiles('components').filter((file) => /\.(vue|js)$/.test(file)),
    ...listFiles('utils').filter((file) => /\.js$/.test(file))
  ]
  const privacyApis = [
    'chooseImage', 'chooseMedia', 'chooseVideo', 'saveImageToPhotosAlbum',
    'saveVideoToPhotosAlbum', 'getUserProfile', 'getPhoneNumber', 'getLocation',
    'chooseLocation', 'requestSubscribeMessage', 'setClipboardData',
    'getClipboardData', 'openSetting', 'getSetting', 'getPrivacySetting',
    'onNeedPrivacyAuthorization', 'requirePrivacyAuthorize', 'openPrivacyContract',
    'uploadFile', 'downloadFile'
  ]
  const apiRows = privacyApis.map((api) => ({
    api,
    hits: scan(sourceFiles, new RegExp(`\\b${api}\\b`, 'g'))
  })).filter((row) => row.hits.length)
  const mpConfig = manifest['mp-weixin'] || {}
  const agreementRoute = routes.find((route) => /(?:user-)?agreement|terms/i.test(route))
  const privacyRoute = routes.find((route) => /privacy(?:-policy)?/i.test(route))
  const routeSources = [
    ...routeFiles.filter(exists).map((file) => path.join(ROOT, file)),
    ...listFiles('components').filter((file) => /\.(vue|js)$/.test(file))
  ]
  const paymentCalls = scan(routeSources, /\b(?:requestPayment|wxPay|createOrderByPackage)\b/g)
  const paymentImplementationExists = exists('utils/pay.js') && /\brequestPayment\b/.test(read('utils/pay.js'))
  const riskTerms = scan(sourceFiles, /(?:mock|fallback|debug|taskType|fileId|立即购买|自动续费)/g)
  const privacyHandlers = apiRows.filter((row) => [
    'getPrivacySetting', 'onNeedPrivacyAuthorization', 'requirePrivacyAuthorize'
  ].includes(row.api))

  console.log('WeChat review and privacy compliance audit (read-only)')
  console.log(`MP routes: ${routes.length}`)
  printCheck('registered route files', missingRoutes.length ? 'FAIL' : 'PASS', missingRoutes.join(', '))
  printCheck('independent user agreement route', agreementRoute ? 'PASS' : 'BLOCKED', agreementRoute || 'not found')
  printCheck('independent privacy policy route', privacyRoute ? 'PASS' : 'BLOCKED', privacyRoute || 'not found; platform contract API is not an independent page')
  printCheck('privacy authorization adapter', privacyHandlers.length ? 'PASS' : 'BLOCKED', privacyHandlers.length ? 'found' : 'getPrivacySetting/onNeedPrivacyAuthorization/requirePrivacyAuthorize not found')
  printCheck('manifest requiredPrivateInfos', Array.isArray(mpConfig.requiredPrivateInfos) && mpConfig.requiredPrivateInfos.length ? 'INFO' : 'MANUAL', Array.isArray(mpConfig.requiredPrivateInfos) ? mpConfig.requiredPrivateInfos.join(', ') : 'not configured')
  printCheck('payment call in registered MP pages/components', paymentCalls.length ? 'REVIEW' : 'PASS', paymentCalls.length ? `${paymentCalls.length} reference(s)` : 'no call found')
  printCheck('payment implementation in repository', paymentImplementationExists ? 'REVIEW' : 'PASS', paymentImplementationExists ? 'implementation exists; verify it remains unreachable in review build' : 'not found')
  printCheck('review-risk strings', riskTerms.length ? 'REVIEW' : 'PASS', `${riskTerms.length} occurrence(s); inspect context before changing`)
  console.log('\nPrivacy-related APIs:')
  apiRows.forEach((row) => {
    const files = [...new Set(row.hits.map((hit) => hit.file))]
    console.log(`- ${row.api}: ${row.hits.length} hit(s) in ${files.join(', ')}`)
  })
  console.log('\nManual checks still required: platform privacy declaration, service category, operator/contact details, data retention, third-party contracts, cloud rules, real-device permission behavior.')

  if (missingRoutes.length || !agreementRoute || !privacyRoute || !privacyHandlers.length) {
    process.exitCode = 1
  }
}

try {
  main()
} catch (error) {
  console.error(`[wechat-review-audit] ${error && error.message ? error.message : 'unknown_error'}`)
  process.exitCode = 1
}
