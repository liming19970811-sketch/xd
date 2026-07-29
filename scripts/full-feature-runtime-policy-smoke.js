const assert = require('assert')
const fs = require('fs')
const path = require('path')
const parser = require('@babel/parser')

const root = path.resolve(__dirname, '..')
const policyPath = path.join(root, 'utils/runtime/featureRuntimePolicy.js')

async function loadPolicy() {
  const source = fs.readFileSync(policyPath, 'utf8')
  return import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}#${Date.now()}`)
}

function assertSourcesParse() {
  const moduleFiles = [
    'utils/runtime/featureRuntimePolicy.js',
    'utils/runtime/appRuntimeConfig.js',
    'utils/task/generationExecution.js',
    'utils/task/taskLayer.js',
    'utils/quota/quotaFlow.js',
    'utils/home/homeCapabilities.js'
  ]
  const sfcFiles = [
    'pages/index/index.vue',
    'package-ai/simple-ai-workbench/simple-ai-workbench.vue',
    'package-ai/change-pose/change-pose.vue',
    'package-ai/upload/upload.vue'
  ]
  moduleFiles.forEach((relativePath) => parser.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'), { sourceType: 'module' }))
  sfcFiles.forEach((relativePath) => {
    const source = fs.readFileSync(path.join(root, relativePath), 'utf8')
    const match = source.match(/<script[^>]*>([\s\S]*?)<\/script>/)
    assert(match, `missing script block: ${relativePath}`)
    parser.parse(match[1], { sourceType: 'module' })
  })
}

async function run() {
  assertSourcesParse()
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
    switchMatrixAllowed: true,
    supportedTaskTypes: ['head_replace', 'face_replace', 'garment_replace', 'pose_replace']
  }
  global.wx = {
    cloud: {
      async callFunction({ name }) {
        if (name === 'generate_wanx') return { result: { debugConfig: providerDebug } }
        return { result: { data: { enableRealQuotaGuard: true } } }
      }
    }
  }

  const policy = await loadPolicy()
  await policy.refreshFeatureRuntimeBackendState({ force: true })
  const formal = policy.getRuntimeGenerationConfig({ providerRouteSupported: true, taskType: 'head_replace' })
  assert.strictEqual(formal.stage, 'production')
  assert.strictEqual(formal.canSubmit, true)
  assert.strictEqual(formal.useRealProvider, true)
  assert.strictEqual(formal.usesMock, false)
  assert.strictEqual(policy.buildGenerationTaskMetadata(formal).resultMode, 'formal')

  providerDebug = { ...providerDebug, mockFallbackEnabled: true }
  await policy.refreshFeatureRuntimeBackendState({ force: true })
  const blocked = policy.getRuntimeGenerationConfig({ providerRouteSupported: true, taskType: 'head_replace' })
  assert.strictEqual(blocked.canSubmit, false)
  assert.strictEqual(blocked.disabledReason, 'mock fallback 尚未关闭')

  const page = fs.readFileSync(path.join(root, 'package-ai/simple-ai-workbench/simple-ai-workbench.vue'), 'utf8')
  assert(page.includes("replaceMode: 'head_replace'"))
  assert(page.includes('createRealGenerationTask'))
  assert(!page.includes('调用真实API测试'))
  assert(!page.includes('测试模式'))
  console.log('full-feature-runtime-policy-smoke: PASS')
}

run().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
