const assert = require('assert')
const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')
const POLICY_FILE = path.join(ROOT, 'utils/runtime/featureRuntimePolicy.js')

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8')
}

async function loadRuntime(envVersion = 'develop', storedConfig = {}, backend = {}) {
  const storage = {
    diebiandesign_current_user: { userId: 'user_demo_001', role: 'tester' },
    diebiandesign_internal_runtime_config_v1: storedConfig
  }
  global.uni = {
    getStorageSync(key) { return storage[key] },
    setStorageSync(key, value) { storage[key] = value }
  }
  global.wx = {
    getAccountInfoSync: () => ({ miniProgram: { envVersion } }),
    cloud: {
      callFunction({ name }) {
        if (name === 'quota_guard') {
          return Promise.resolve({ result: { debugConfig: { enableRealQuotaGuard: backend.realQuotaGuardEnabled !== false } } })
        }
        return Promise.resolve({
          result: {
            debugConfig: {
              provider: 'wanx',
              model: 'qwen-image-2.0-pro',
              realProviderEnabled: backend.realProviderEnabled !== false,
              realQuotaGuardEnabled: backend.realQuotaGuardEnabled !== false,
              dryRun: backend.dryRun === true,
              hasEndpoint: backend.hasEndpoint !== false,
              hasApiKey: backend.hasApiKey !== false,
              mockFallbackEnabled: backend.mockFallbackEnabled === true,
              supportedTaskTypes: ['head_replace', 'face_replace', 'garment_replace', 'pose_replace']
            }
          }
        })
      }
    }
  }
  const source = fs.readFileSync(POLICY_FILE, 'utf8')
  const moduleUrl = `data:text/javascript;base64,${Buffer.from(source).toString('base64')}#${envVersion}-${Math.random()}`
  const runtime = await import(moduleUrl)
  await runtime.refreshFeatureRuntimeBackendState({ force: true })
  return runtime
}

async function main() {
  const development = await loadRuntime('develop')
  const devRuntime = development.getRuntimeGenerationConfig({
    providerSupported: false,
    experimentalProviderSupported: true,
    provider: 'wanx',
    modelName: 'qwen-image-2.0-pro',
    taskType: 'head_replace'
  })
  assert.strictEqual(devRuntime.stage, 'development')
  assert.strictEqual(devRuntime.capabilityStatus, 'experimental')
  assert.strictEqual(devRuntime.canSubmit, true)
  assert.strictEqual(devRuntime.realProviderTest, true)
  assert.strictEqual(devRuntime.usesMock, false)
  assert.strictEqual(devRuntime.usesFormalQuota, true)

  const testing = await loadRuntime('trial')
  const testingRuntime = testing.getRuntimeGenerationConfig({
    providerSupported: false,
    experimentalProviderSupported: true,
    taskType: 'garment_replace'
  })
  assert.strictEqual(testingRuntime.stage, 'testing')
  assert.strictEqual(testingRuntime.canSubmit, true)

  const blocked = await loadRuntime('trial', {}, { mockFallbackEnabled: true })
  const blockedRuntime = blocked.getRuntimeGenerationConfig({
    providerSupported: false,
    experimentalProviderSupported: true,
    taskType: 'head_replace'
  })
  assert.strictEqual(blockedRuntime.canSelectExperimentalOption, true)
  assert.strictEqual(blockedRuntime.canSubmit, false)
  assert.match(blockedRuntime.disabledReason, /mock fallback/i)

  const production = await loadRuntime('release')
  const productionBlocked = production.getRuntimeGenerationConfig({
    providerSupported: false,
    experimentalProviderSupported: true,
    taskType: 'head_replace'
  })
  assert.strictEqual(productionBlocked.stage, 'production')
  assert.strictEqual(productionBlocked.isInternalTester, false)
  assert.strictEqual(productionBlocked.canSubmit, false)

  const metadata = development.buildTestTaskMetadata(devRuntime)
  assert.strictEqual(metadata.isMock, false)
  assert.strictEqual(metadata.deliveryEligible, false)
  assert.strictEqual(metadata.usesFormalQuota, true)
  assert.strictEqual(metadata.testResultType, 'experimental')

  const page = read('package-ai/simple-ai-workbench/simple-ai-workbench.vue')
  assert(page.includes('refreshFeatureRuntimeBackendState'))
  assert(page.includes("taskType: this.modelTaskType"))
  assert(page.includes("MODEL_REPLACE_PREFERENCE_STORAGE_KEY"))
  assert(page.includes("restoreModelReplacePreference(incomingToolType)"))
  assert(page.includes("this.genericRuntimeConfig.isInternalDebug ? 1 : 2"))
  assert(page.includes("taskType: GARMENT_REPLACE_ACTION"))

  console.log('TESTING_STAGE_CAPABILITY_SMOKE_OK')
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
