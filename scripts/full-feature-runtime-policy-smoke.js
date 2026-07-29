const assert = require('assert')
const fs = require('fs')
const path = require('path')
const parser = require('@babel/parser')

const root = path.resolve(__dirname, '..')
const policyPath = path.join(root, 'utils/runtime/featureRuntimePolicy.js')

function setMiniProgramStage(envVersion) {
  global.wx.getAccountInfoSync = () => ({ miniProgram: { envVersion } })
}

async function loadPolicy() {
  const source = fs.readFileSync(policyPath, 'utf8')
  const url = `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`
  return import(url)
}

function assertChangedSourcesParse() {
  const moduleFiles = [
    'main.js',
    'utils/runtime/featureRuntimePolicy.js',
    'utils/runtime/appRuntimeConfig.js',
    'utils/home/homeCapabilities.js'
  ]
  const sfcFiles = [
    'pages/index/index.vue',
    'package-ai/simple-ai-workbench/simple-ai-workbench.vue',
    'package-ai/change-pose/change-pose.vue',
    'package-ai/upload/upload.vue',
    'package-ai/production-guide/production-guide.vue'
  ]
  moduleFiles.forEach((relativePath) => {
    parser.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'), { sourceType: 'module' })
  })
  sfcFiles.forEach((relativePath) => {
    const source = fs.readFileSync(path.join(root, relativePath), 'utf8')
    const match = source.match(/<script[^>]*>([\s\S]*?)<\/script>/)
    assert(match, `missing script block: ${relativePath}`)
    parser.parse(match[1], { sourceType: 'module' })
  })
}

async function run() {
  assertChangedSourcesParse()
  let providerDebug = {
    provider: 'wanx',
    model: 'qwen-image-2.0-pro',
    realProviderEnabled: true,
    realQuotaGuardEnabled: true,
    dryRun: false,
    hasEndpoint: true,
    hasApiKey: true,
    hasPollEndpoint: true,
    mockFallbackEnabled: false,
    supportedTaskTypes: ['head_replace', 'face_replace', 'garment_replace', 'pose_replace']
  }
  const currentUser = { userId: 'internal_policy_smoke', role: 'internal_tester' }
  global.uni = {
    getStorageSync(key) {
      if (key === 'diebiandesign_current_user') return currentUser
      if (key === 'diebiandesign_internal_runtime_config_v1') return { modelEffectTestEnabled: true }
      return null
    },
    setStorageSync() {}
  }
  global.wx = {
    getAccountInfoSync: () => ({ miniProgram: { envVersion: 'develop' } }),
    cloud: {
      async callFunction({ name }) {
        if (name === 'generate_wanx') return { result: { success: true, debugConfig: providerDebug } }
        return { result: { success: true, data: { enableRealQuotaGuard: true } } }
      }
    }
  }

  const policy = await loadPolicy()
  await policy.refreshFeatureRuntimeBackendState({ force: true })

  const internalDebug = policy.getFeatureRuntimePolicy({
    featureEnabled: false,
    featureImplemented: true,
    providerSupported: false,
    experimentalProviderSupported: true,
    taskType: 'head_replace'
  })
  assert.strictEqual(internalDebug.isInternalDebug, true)
  assert.strictEqual(internalDebug.canAccessFeature, true)
  assert.strictEqual(internalDebug.canSelectExperimentalOption, true)
  assert.strictEqual(internalDebug.canSubmitRealTask, true)
  assert.strictEqual(internalDebug.isRealApiDebug, true)
  assert.strictEqual(internalDebug.allowExperimentalProvider, true)
  assert.strictEqual(internalDebug.allowRealProviderTest, true)
  assert.strictEqual(internalDebug.featureAvailable, true)
  assert.strictEqual(internalDebug.submitDisabledReason, '')

  const page = fs.readFileSync(path.join(root, 'package-ai/simple-ai-workbench/simple-ai-workbench.vue'), 'utf8')
  assert(page.includes("replaceMode: 'head_replace'"))
  assert(page.includes('restoreModelReplacePreference(incomingToolType)'))
  assert(page.includes('this.saveModelReplacePreference()'))
  assert(page.includes('taskType: this.modelTaskType'))
  const homeCapabilities = fs.readFileSync(path.join(root, 'utils/home/homeCapabilities.js'), 'utf8')
  assert(homeCapabilities.includes("id: 'ai_production_center'"))

  providerDebug = { ...providerDebug, mockFallbackEnabled: true }
  await policy.refreshFeatureRuntimeBackendState({ force: true })
  const unsafeDebug = policy.getFeatureRuntimePolicy({
    providerSupported: false,
    experimentalProviderSupported: true,
    taskType: 'head_replace'
  })
  assert.strictEqual(unsafeDebug.canSelectExperimentalOption, true)
  assert.strictEqual(unsafeDebug.canSubmitRealTask, false)
  assert.strictEqual(unsafeDebug.disabledReason, 'mock fallback 尚未关闭')

  setMiniProgramStage('release')
  const production = policy.getFeatureRuntimePolicy({
    featureEnabled: true,
    featureImplemented: true,
    providerSupported: false,
    experimentalProviderSupported: true,
    taskType: 'head_replace'
  })
  assert.strictEqual(production.isProduction, true)
  assert.strictEqual(production.isInternalTester, false)
  assert.strictEqual(production.canSelectExperimentalOption, false)
  assert.strictEqual(production.canSubmitRealTask, false)
  assert.strictEqual(production.canSubmit, false)

  console.log('full-feature-runtime-policy-smoke: PASS')
}

run().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
