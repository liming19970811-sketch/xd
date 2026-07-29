const fs = require('fs')
const path = require('path')
const vm = require('vm')
const assert = require('assert')

const root = path.resolve(__dirname, '..')
const sourcePath = path.join(root, 'utils/admin/releaseControlCenter.js')
let source = fs.readFileSync(sourcePath, 'utf8')

source = source
  .replace(/^import .+$/gm, '')
  .replace(/export const /g, 'const ')
  .replace(/export function /g, 'function ')

source += `
globalThis.__releaseControlExports = {
  RELEASE_MODULES,
  RELEASE_STATUSES,
  FEATURE_FLAG_STATUSES,
  GRAY_DIMENSIONS,
  FEATURE_FLAGS,
  FORBIDDEN_COMBINATIONS,
  validateForbiddenCombinations,
  evaluateFeatureFlag,
  updateFeatureFlag,
  emergencyCloseFeature,
  createReleaseDraft,
  advanceReleaseStatus,
  rollbackRelease,
  loadReleaseControlCenter,
  clearReleaseControlDevelopmentData
}
`

const memory = {}
const logs = []
const context = {
  console,
  Date,
  Math,
  String,
  Number,
  Boolean,
  Array,
  Object,
  get(key, fallback) {
    return Object.prototype.hasOwnProperty.call(memory, key) ? memory[key] : fallback
  },
  set(key, value) {
    memory[key] = value
  },
  getCurrentMember() {
    return { memberId: 'member_platform_admin', userId: 'user_platform_admin', name: '发布管理员', role: 'platform_admin', status: 'active' }
  },
  requirePlatformAdmin() {
    return { allowed: true, reason: '', currentMember: this.getCurrentMember ? this.getCurrentMember() : {} }
  },
  writeStructuredLog(input) {
    logs.push(input)
    return { ok: true, log: input }
  },
  globalThis: {}
}

vm.createContext(context)
vm.runInContext(source, context, { filename: sourcePath })

const api = context.globalThis.__releaseControlExports

api.clearReleaseControlDevelopmentData()

const center = api.loadReleaseControlCenter({ environment: 'production' })
assert.strictEqual(center.canAccess, true)
assert.ok(center.flags.length >= 8)
assert.ok(center.environments.some((item) => item.name === 'production'))
assert.strictEqual(center.priority[0], '紧急全局关闭')
assert.strictEqual(center.priority[1], '环境配置')

const blocked = api.validateForbiddenCombinations({
  realQuota: true,
  mockGeneration: true,
  formalDelivery: true,
  fallbackResult: true,
  realProviderCall: true,
  quotaIdempotency: false
})
assert.ok(blocked.some((item) => item.comboId === 'real_quota_with_mock_generation'))
assert.ok(blocked.some((item) => item.comboId === 'formal_delivery_with_fallback'))
assert.ok(blocked.some((item) => item.comboId === 'provider_without_quota_idempotency'))

const rejectedRelease = api.createReleaseDraft({
  version: 'v-risk',
  safetyConfig: { realQuota: true, mockGeneration: true, quotaIdempotency: true, permissionGuard: true }
})
assert.strictEqual(rejectedRelease.success, false)
assert.strictEqual(rejectedRelease.errorCode, 'forbidden_combination')

const draft = api.createReleaseDraft({
  version: 'v-safe',
  gitCommit: 'abc1234',
  environment: 'staging',
  modules: ['website', 'admin'],
  summary: 'safe release',
  grayScope: { environments: ['staging'], trafficRatio: 1 },
  safetyConfig: { realQuota: false, mockGeneration: false, quotaIdempotency: true, adminOpen: true, permissionGuard: true }
})
assert.strictEqual(draft.success, true)
assert.strictEqual(draft.release.status, 'draft')

const gray = api.advanceReleaseStatus(draft.release.releaseId, 'gray_running', 'smoke gray')
assert.strictEqual(gray.success, true)
assert.strictEqual(gray.release.status, 'gray_running')

const rolledBack = api.rollbackRelease(draft.release.releaseId, 'smoke rollback')
assert.strictEqual(rolledBack.success, true)
assert.strictEqual(rolledBack.release.status, 'rolled_back')

const flagBefore = api.evaluateFeatureFlag('developer_api', {
  environment: 'production',
  userId: 'ordinary_user',
  role: 'viewer',
  plan: 'trial',
  functionType: 'api'
})
assert.strictEqual(flagBefore.enabled, false)

const flagUpdate = api.updateFeatureFlag('developer_api', {
  status: 'gray',
  grayScope: { environments: ['production'], userIds: ['gray_user'], trafficRatio: 0 },
  reason: 'smoke gray user'
})
assert.strictEqual(flagUpdate.success, true)

const flagHit = api.evaluateFeatureFlag('developer_api', {
  environment: 'production',
  userId: 'gray_user',
  role: 'viewer',
  plan: 'trial',
  functionType: 'api'
})
assert.strictEqual(flagHit.enabled, true)
assert.strictEqual(flagHit.source, 'user_gray')

const closed = api.emergencyCloseFeature('developer_api', 'smoke emergency')
assert.strictEqual(closed.success, true)
const flagClosed = api.evaluateFeatureFlag('developer_api', { environment: 'production', userId: 'gray_user' })
assert.strictEqual(flagClosed.enabled, false)
assert.strictEqual(flagClosed.source, 'emergency')

const reloaded = api.loadReleaseControlCenter({ environment: 'production' })
assert.ok(reloaded.audits.some((item) => item.action === 'feature_flag_updated'))
assert.ok(logs.some((item) => item.action === 'release_control_feature_flag_updated'))

const main = fs.readFileSync(path.join(root, 'main.js'), 'utf8')
assert.ok(main.includes('#/admin/releases'))
assert.ok(main.includes('#/admin/feature-flags'))
assert.ok(main.includes('#/admin/environments'))

const pagesJson = fs.readFileSync(path.join(root, 'pages.json'), 'utf8')
assert.ok(pagesJson.includes('pages/admin-release-control'))

const page = fs.readFileSync(path.join(root, 'pages/admin-release-control/admin-release-control.vue'), 'utf8')
assert.ok(page.includes('发布与灰度中心'))
assert.ok(page.includes('禁止组合'))

console.log('[release-control-smoke] ok')
