const fs = require('fs')
const path = require('path')
const vm = require('vm')
const assert = require('assert')

const root = path.resolve(__dirname, '..')
const sourcePath = path.join(root, 'utils/compliance/privacyConsentCenter.js')
let source = fs.readFileSync(sourcePath, 'utf8')

source = source
  .replace(/^import .+$/gm, '')
  .replace(/export const /g, 'const ')
  .replace(/export function /g, 'function ')

source += `
globalThis.__privacyExports = {
  PRIVACY_POLICY_VERSION,
  TERMS_VERSION,
  CONSENT_TYPES,
  DATA_REQUEST_TYPES,
  DATA_REQUEST_STATUSES,
  CASE_AUTH_STATUSES,
  getConsentCatalog,
  loadUserConsentCenter,
  setConsent,
  createDataRequest,
  canUseDataForTraining,
  saveCaseAuthorization,
  loadComplianceAdminCenter,
  clearComplianceDevelopmentData
}
`

const memory = {}
const logs = []
const context = {
  console,
  Date,
  Math,
  String,
  Boolean,
  Array,
  Object,
  get(key, fallback) {
    return Object.prototype.hasOwnProperty.call(memory, key) ? memory[key] : fallback
  },
  set(key, value) {
    memory[key] = value
  },
  getCurrentUser() {
    return { userId: 'user_001', name: '测试用户' }
  },
  getCurrentMember() {
    return { memberId: 'member_001', userId: 'user_001', role: 'platform_admin', status: 'active' }
  },
  getCurrentEnterpriseId() {
    return 'enterprise_001'
  },
  requirePlatformAdmin() {
    return { allowed: true, reason: '' }
  },
  writeStructuredLog(input) {
    logs.push(input)
    return { ok: true, log: input }
  },
  globalThis: {}
}

vm.createContext(context)
vm.runInContext(source, context, { filename: sourcePath })

const api = context.globalThis.__privacyExports

api.clearComplianceDevelopmentData()

const catalog = api.getConsentCatalog()
assert.strictEqual(catalog.length, 7)
assert.ok(catalog.some((item) => item.type === 'ai_training' && item.defaultGranted === false && item.required === false))
assert.ok(catalog.some((item) => item.type === 'public_case_display' && item.defaultGranted === false))
assert.ok(catalog.some((item) => item.type === 'marketing_notice' && item.defaultGranted === false))

let center = api.loadUserConsentCenter()
const training = center.consents.find((item) => item.type === 'ai_training')
assert.strictEqual(training.status, 'withdrawn')

let canTrain = api.canUseDataForTraining({ reviewed: true, sourceKnown: true, enterprisePolicyAllowsTraining: true })
assert.strictEqual(canTrain.allowed, false)
assert.strictEqual(canTrain.reason, 'training_consent_missing')

const granted = api.setConsent('ai_training', true, { sourcePage: 'smoke', reason: 'explicit smoke consent' })
assert.strictEqual(granted.success, true)
canTrain = api.canUseDataForTraining({ reviewed: true, sourceKnown: true, enterprisePolicyAllowsTraining: true })
assert.strictEqual(canTrain.allowed, true)

const unreviewed = api.canUseDataForTraining({ reviewed: false, sourceKnown: true, enterprisePolicyAllowsTraining: true })
assert.strictEqual(unreviewed.allowed, false)
assert.strictEqual(unreviewed.reason, 'review_required')

const withdrawn = api.setConsent('ai_training', false, { sourcePage: 'smoke', reason: 'withdraw smoke consent' })
assert.strictEqual(withdrawn.success, true)
canTrain = api.canUseDataForTraining({ reviewed: true, sourceKnown: true, enterprisePolicyAllowsTraining: true })
assert.strictEqual(canTrain.allowed, false)

const requiredWithdraw = api.setConsent('basic_service_processing', false)
assert.strictEqual(requiredWithdraw.success, false)
assert.strictEqual(requiredWithdraw.errorCode, 'required_consent_cannot_withdraw')

const request = api.createDataRequest({ requestType: 'delete', reason: 'smoke delete request' })
assert.strictEqual(request.success, true)
assert.strictEqual(request.request.status, 'new')

const caseAuth = api.saveCaseAuthorization({
  caseId: 'case_001',
  customerNameAuthorized: true,
  logoAuthorized: true,
  imageAuthorized: true,
  publicScope: '官网案例详情',
  validUntil: '2000-01-01',
  reason: 'smoke expired case'
})
assert.strictEqual(caseAuth.success, true)

const admin = api.loadComplianceAdminCenter()
assert.strictEqual(admin.canAccess, true)
assert.ok(admin.requests.some((item) => item.requestId === request.request.requestId))
assert.ok(admin.consents.some((item) => item.consentType === 'ai_training' && item.status === 'withdrawn'))
assert.ok(admin.caseAuthorizations.some((item) => item.status === 'offline_required'))
assert.ok(admin.audits.some((item) => item.action === 'consent_withdrawn'))
assert.ok(logs.some((item) => item.action === 'privacy_consent_withdrawn'))

const main = fs.readFileSync(path.join(root, 'main.js'), 'utf8')
assert.ok(main.includes('#/privacy'))
assert.ok(main.includes('#/terms'))
assert.ok(main.includes('data-consent'))
assert.ok(main.includes('#/admin/compliance'))

const pagesJson = fs.readFileSync(path.join(root, 'pages.json'), 'utf8')
assert.ok(pagesJson.includes('pages/privacy'))
assert.ok(pagesJson.includes('pages/terms'))
assert.ok(pagesJson.includes('pages/workspace-data-consent'))
assert.ok(pagesJson.includes('pages/admin-compliance'))

const privacyPage = fs.readFileSync(path.join(root, 'pages/privacy/privacy.vue'), 'utf8')
assert.ok(privacyPage.includes('AI 训练授权默认关闭'))
const consentPage = fs.readFileSync(path.join(root, 'pages/workspace-data-consent/workspace-data-consent.vue'), 'utf8')
assert.ok(consentPage.includes('不使用一个总开关'))
const adminPage = fs.readFileSync(path.join(root, 'pages/admin-compliance/admin-compliance.vue'), 'utf8')
assert.ok(adminPage.includes('待下线案例'))

console.log('[privacy-compliance-smoke] ok')
