const assert = require('assert')
const fs = require('fs')
const path = require('path')
const vm = require('vm')

const ROOT = path.resolve(__dirname, '..')

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8')
}

function loadModule(relativePath, names, globals = {}) {
  const source = read(relativePath)
    .replace(/import[\s\S]*?from\s+['"][^'"]+['"]\s*/g, '')
    .replace(/export\s+(?=(?:async\s+)?(?:const|let|var|function|class)\s)/g, '')
    .concat(`\nmodule.exports = { ${names.join(', ')} }`)
  const sandbox = { module: { exports: {} }, exports: {}, console: { info() {}, log() {}, warn() {}, error() {} }, Date, Math, String, Number, Boolean, Array, Object, Set, RegExp, JSON, ...globals }
  vm.runInNewContext(source, sandbox, { filename: relativePath })
  return sandbox.module.exports
}

function createRuntime() {
  const storage = new Map()
  const identity = { enterpriseId: 'enterprise_a', memberId: 'member_a', userId: 'user_a', status: 'active', role: 'admin', authSource: 'cloud_authenticated' }
  const uni = { getStorageSync: (key) => storage.get(key), setStorageSync: (key, value) => storage.set(key, value) }
  const pattern = loadModule('utils/workspace/patternMakingRepository.js', [
    'createPatternStructurePlan', 'createDerivedPattern', 'createPatternRevisionVersion', 'getPatternMaster', 'getPatternStructurePackage', 'getPatternVersion',
    'listPatternMasters', 'listPatternParts', 'listPatternSizeSpecs', 'listPatternVersions', 'linkPatternStructureAssets', 'reviewPatternVersion'
  ], {
    uni,
    getCurrentEnterpriseId: () => identity.enterpriseId,
    getCurrentMember: () => ({ memberId: identity.memberId, userId: identity.userId, status: identity.status, role: identity.role, enterpriseId: identity.enterpriseId }),
    getCurrentUser: () => ({ userId: identity.userId })
  })
  const library = loadModule('utils/pattern/patternLibraryRepository.js', [
    'createPatternLibraryRevision', 'derivePatternLibraryItem', 'getPatternLibraryDetail', 'getPatternLibraryScopes', 'queryPatternLibrary'
  ], {
    ...pattern,
    getCurrentContext: () => ({ authSource: identity.authSource, currentEnterprise: { enterpriseId: identity.enterpriseId }, currentRole: identity.role }),
    getCurrentMember: () => ({ memberId: identity.memberId, userId: identity.userId, status: identity.status, role: identity.role, enterpriseId: identity.enterpriseId }),
    getCurrentUser: () => ({ userId: identity.userId }),
    hasRolePermission: (role, permission) => role === 'admin' || permission === 'pattern_library.view',
    getWorkDetail: () => null
  })
  return { identity, pattern, library }
}

function main() {
  const runtime = createRuntime()
  const created = runtime.pattern.createPatternStructurePlan({ category: 'shirt', categoryLabel: '衬衫', baseSize: 'M', taskIds: ['task_a'], measurements: { bust: 88 } })
  assert.strictEqual(created.ok, true)
  assert.strictEqual(created.master.scope, 'personal')
  assert.strictEqual(created.master.taxonomy.garmentCategory, 'shirt')

  const page = runtime.library.queryPatternLibrary({ scope: 'personal', page: 1, pageSize: 1 })
  assert.strictEqual(page.ok, true)
  assert.strictEqual(page.total, 1)
  assert.strictEqual(page.items[0].patternId, created.master.patternMasterId)

  const derived = runtime.library.derivePatternLibraryItem(created.master.patternMasterId, { title: '衬衫派生新款' })
  assert.strictEqual(derived.ok, true)
  assert.notStrictEqual(derived.data.master.patternMasterId, created.master.patternMasterId)
  assert(runtime.pattern.listPatternParts(derived.data.master.patternMasterId).length > 0)
  assert.strictEqual(runtime.pattern.listPatternSizeSpecs(derived.data.master.patternMasterId).length, 1)

  runtime.pattern.reviewPatternVersion(created.version.versionId, 'approved')
  const revision = runtime.library.createPatternLibraryRevision(created.master.patternMasterId)
  assert.strictEqual(revision.ok, true)
  assert.notStrictEqual(revision.data.version.versionId, created.version.versionId)
  assert.strictEqual(runtime.pattern.getPatternVersion(created.version.versionId).reviewStatus, 'approved')
  assert.strictEqual(runtime.pattern.getPatternVersion(created.version.versionId).productionAvailable, false)

  runtime.identity.enterpriseId = 'enterprise_b'
  runtime.identity.memberId = 'member_b'
  runtime.identity.userId = 'user_b'
  assert.strictEqual(runtime.library.getPatternLibraryDetail(created.master.patternMasterId).status, 'not_found')
  assert.strictEqual(runtime.library.queryPatternLibrary({ scope: 'personal' }).total, 0)

  runtime.identity.enterpriseId = 'enterprise_a'
  runtime.identity.memberId = 'member_a'
  runtime.identity.userId = 'user_a'
  runtime.identity.status = 'pending'
  assert.strictEqual(runtime.library.queryPatternLibrary({ scope: 'personal' }).errorCode, 'member_inactive')

  const listPage = read('package-ai/pattern-library/pattern-library.vue')
  const detailPage = read('package-ai/pattern-detail/pattern-detail.vue')
  const resultPage = read('package-ai/result/result.vue')
  const minePage = read('pages/mine/mine.vue')
  const home = read('utils/home/homeCapabilities.js')
  const pagesJson = read('pages.json')
  assert(listPage.includes('queryPatternLibrary') && listPage.includes('350'))
  assert(detailPage.includes('createPatternLibraryRevision') && detailPage.includes('派生新款'))
  assert(resultPage.includes('保存至版型库'))
  assert(minePage.includes('我的版型'))
  assert(home.includes("id: 'pattern_library'"))
  assert(pagesJson.includes('pattern-library/pattern-library') && pagesJson.includes('pattern-detail/pattern-detail'))
  console.log('pattern library smoke: PASS')
}

main()
