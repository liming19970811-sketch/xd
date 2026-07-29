const assert = require('assert')
const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8')

const runtime = read('utils/runtime/featureRuntimePolicy.js')
const compatibility = read('utils/runtime/appRuntimeConfig.js')
const page = read('package-ai/simple-ai-workbench/simple-ai-workbench.vue')
const taskLayer = read('utils/task/taskLayer.js')
const quotaFlow = read('utils/quota/quotaFlow.js')
const provider = read('cloudfunctions/generate_wanx/index.js')

for (const api of [
  'isDevelopment',
  'isTesting',
  'isProduction',
  'isInternalTester',
  'canAccessFeature',
  'canSelectExperimentalOption',
  'canSubmitRealTask',
  'getDisabledReason'
]) {
  assert(runtime.includes(`function ${api}`), `missing runtime policy API: ${api}`)
  assert(compatibility.includes(api), `missing compatibility export: ${api}`)
}

assert(runtime.includes('realQuotaGuardEnabled'))
assert(runtime.includes('mockFallbackEnabled'))
assert(runtime.includes('supportedTaskTypes'))
assert(page.includes('refreshFeatureRuntimeBackendState'))
assert(page.includes('consumeQuota({ taskId: clientTaskId'))
assert(page.includes('settleQuotaByTask({ taskId: task.taskId, quotaRecordId })'))
assert(quotaFlow.includes("clothes_replace: 'ai_model_image'"))
assert(quotaFlow.includes("head_replace: 'ai_model_image'"))
assert(taskLayer.includes('options.fallbackToMock === false'))
assert(taskLayer.includes("params.resultMode === 'real_provider_test'"))

for (const flag of [
  'APP_STAGE',
  'ENABLE_REAL_PROVIDER_CALL',
  'ENABLE_REAL_PROVIDER_TEST',
  'ENABLE_REAL_QUOTA_GUARD',
  'ALLOW_EXPERIMENTAL_PROVIDER',
  'PROVIDER_DRY_RUN',
  'DISABLE_MOCK_FALLBACK'
]) assert(provider.includes(flag), `missing provider guard: ${flag}`)

assert(provider.includes('const INTERNAL_TEST_ROLES'))
assert(provider.includes('db.collection(USERS_COLLECTION)'))
assert(provider.includes('db.collection(QUOTA_RECORDS_COLLECTION)'))
assert(provider.includes("resultMode: 'real_provider_test'"))
assert(provider.includes('isMock: false'))
assert(provider.includes("action: 'rollbackUsage'"))
assert(provider.includes('Only settleQuotaByTask may finalize'))
assert(quotaFlow.includes('finalizeQuota'))
assert(provider.includes('{ image: wanxImageUrl }'))
assert(provider.includes('{ image: wanxIdentityReferenceUrl }'))
assert(provider.includes('...wanxGarmentReferenceUrls.map((image) => ({ image }))'))
assert(provider.includes('providerRequestId:'))

console.log('REAL_PROVIDER_TEST_CHANNEL_SMOKE_OK')
