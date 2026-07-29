const assert = require('assert')
const fs = require('fs')
const path = require('path')
const vm = require('vm')

const ROOT = path.resolve(__dirname, '..')
const contract = require(path.join(ROOT, 'cloudfunctions/generate_wanx/identityReplaceContract'))
const garmentReplaceContract = require(path.join(ROOT, 'cloudfunctions/generate_wanx/garmentReplaceContract'))
const patternStructureContract = require(path.join(ROOT, 'cloudfunctions/generate_wanx/patternStructureContract'))
const fabricReplaceContract = require(path.join(ROOT, 'cloudfunctions/generate_wanx/fabricReplaceContract'))

const pageSource = fs.readFileSync(
  path.join(ROOT, 'package-ai/simple-ai-workbench/simple-ai-workbench.vue'),
  'utf8'
)
const providerSource = fs.readFileSync(
  path.join(ROOT, 'cloudfunctions/generate_wanx/index.js'),
  'utf8'
)
const uploadSource = fs.readFileSync(
  path.join(ROOT, 'package-ai/upload/upload.vue'),
  'utf8'
)
const resultSource = fs.readFileSync(
  path.join(ROOT, 'package-ai/result/result.vue'),
  'utf8'
)
const taskLayerSource = fs.readFileSync(
  path.join(ROOT, 'utils/task/taskLayer.js'),
  'utf8'
)
const clientCapabilitySource = fs.readFileSync(
  path.join(ROOT, 'utils/provider/identityProviderCapability.js'),
  'utf8'
)

const baseImage = 'https://example.com/base-person.jpg'
const headReferenceImage = 'https://example.com/head-reference.jpg'
const validation = contract.validateIdentityReplaceParams({
  baseImage,
  headReferenceImage,
  preserveGarment: true,
  preserveBody: true,
  preservePose: true,
  preserveComposition: true,
  preserveBackground: true,
  preserveScene: true,
  sourceWidth: 900,
  sourceHeight: 1200
}, baseImage, 'head_replace')

assert.strictEqual(contract.isIdentityReplaceAction('head_replace'), true)
assert.strictEqual(validation.ok, true)
assert.strictEqual(validation.input.baseImage, baseImage)
assert.strictEqual(validation.input.referenceImage, headReferenceImage)
assert.strictEqual(validation.input.identityReferenceImage, headReferenceImage)
assert.strictEqual(validation.input.replaceMode, 'full_head')
assert.strictEqual(validation.input.preserveGarment, true)
assert.strictEqual(validation.input.preserveBackground, true)
const forcedPreservation = contract.validateIdentityReplaceParams({ baseImage, headReferenceImage, preserveGarment: false, preserveBody: false, preservePose: false, preserveBackground: false, preserveScene: false, identityStrength: 'low' }, baseImage, 'head_replace')
assert.strictEqual(forcedPreservation.input.preserveGarment, true)
assert.strictEqual(forcedPreservation.input.preserveBody, true)
assert.strictEqual(forcedPreservation.input.preservePose, true)
assert.strictEqual(forcedPreservation.input.preserveBackground, true)
assert.strictEqual(forcedPreservation.input.preserveScene, true)
assert.strictEqual(forcedPreservation.input.identityStrength, 'high')
const currentCapabilities = contract.getIdentityProviderCapabilities('qwen-image-2.0-pro')
assert.strictEqual(currentCapabilities.supportsMultipleImages, true)
assert.strictEqual(currentCapabilities.supportsIdentityReference, false)
assert.strictEqual(currentCapabilities.supportsFaceSwap, false)
assert.strictEqual(currentCapabilities.supportsHeadReplace, false)
assert.strictEqual(currentCapabilities.supportsMaskEdit, false)
assert.strictEqual(currentCapabilities.maxReferenceImages, 2)
assert.strictEqual(contract.supportsIdentityReference('qwen-image-2.0-pro'), false)
assert.strictEqual(contract.supportsIdentityReference('wanx-v1'), false)
assert.strictEqual(contract.validateIdentityProviderCapabilities('qwen-image-2.0-pro', 'head_replace').ok, false)
assert.strictEqual(
  contract.validateIdentityReplaceParams({ baseImage }, baseImage, 'head_replace').errorCode,
  'IDENTITY_REFERENCE_REQUIRED'
)
assert.strictEqual(
  contract.validateIdentityReplaceParams({ baseImage, headReferenceImage: baseImage }, baseImage, 'head_replace').errorCode,
  'SOURCE_TARGET_IMAGE_MUST_DIFFER'
)

const prompt = contract.buildIdentityReplacePrompt(validation.input)
assert.ok(prompt.includes('严格保留图一的服装'))
assert.ok(prompt.includes('不得生成白底'))
assert.ok(prompt.includes('不得更换或简化场景'))
assert.ok(!prompt.includes('电商主图'))
assert.ok(/^\d+\*\d+$/.test(contract.buildIdentityOutputSize(validation.input)))

assert.ok(pageSource.includes("type: actionType"))
assert.ok(pageSource.includes('baseImage: sourceImage'))
assert.ok(pageSource.includes('identityReferenceImage: targetPersonImage'))
assert.ok(pageSource.includes('replaceMode: actionType'))
assert.ok(pageSource.includes("identityMode: actionType === 'face_replace' ? 'face_only' : 'full_head'"))
assert.ok(pageSource.includes('headReferenceImage: targetPersonImage'))
assert.ok(pageSource.includes('fallbackToMock: false'))
assert.ok(pageSource.includes("backgroundType: 'original'"))
assert.ok(!pageSource.includes("head_replace: 'face_replace'"))
assert.ok(!pageSource.includes('title="AI模特"'))
assert.ok(pageSource.includes("{ label: '换整头', value: 'head_replace'"))
assert.ok(pageSource.includes("{ label: '只换脸', value: 'face_replace'"))
assert.ok(pageSource.includes('modelEditingStep'))
assert.ok(pageSource.includes('请选择替换方式'))
assert.ok(pageSource.includes('padding: 20rpx 24rpx calc(220rpx + env(safe-area-inset-bottom))'))
assert.ok(resultSource.includes('identityReferenceImageUrl'))
assert.ok(resultSource.includes('目标人物'))
assert.ok(resultSource.includes('backToWorks'))

const baseContentIndex = providerSource.indexOf('{ image: wanxImageUrl }')
const referenceContentIndex = providerSource.indexOf('{ image: wanxIdentityReferenceUrl }')
assert.ok(baseContentIndex >= 0 && referenceContentIndex > baseContentIndex)
assert.ok(providerSource.includes('identityCapabilityValidation.errorCode'))
assert.ok(providerSource.includes('providerImageCount: 0'))
assert.ok(taskLayerSource.includes('assertIdentityProviderCapability(actionType)'))
assert.ok(taskLayerSource.includes("params.resultMode === 'real_provider_test'"))
assert.ok(clientCapabilitySource.includes('supportsIdentityReference: false'))
assert.ok(providerSource.includes("reviewStatus: (sceneReplace || identityReplace || modelProfile || fabricReplace) ? 'needs_review' : ''"))
assert.ok(uploadSource.includes('normalizeVisibleUploadError'))
assert.ok(uploadSource.includes('mojibakePattern'))

function createBlockedWanxRuntime() {
  const requests = []
  const source = providerSource.replace("const cloud = require('wx-server-sdk')", 'const cloud = globalThis.__cloudMock')
  const sandbox = {
    exports: {},
    module: { exports: {} },
    require(id) {
      if (id === './garmentReplaceContract') return garmentReplaceContract
      if (id === './patternStructureContract') return patternStructureContract
      if (id === './identityReplaceContract') return contract
      if (id === './fabricReplaceContract') return fabricReplaceContract
      throw new Error(`Unexpected require: ${id}`)
    },
    __cloudMock: {
      DYNAMIC_CURRENT_ENV: 'test-env',
      init() {},
      database() { return { collection() { return { where() { return this }, limit() { return this }, async get() { return { data: [] } } } } } }
    },
    fetch: async (...args) => {
      requests.push(args)
      throw new Error('Provider request must not run for unsupported identity replacement')
    },
    process: { env: { DASHSCOPE_API_KEY: 'test-key', WANX_MODEL: 'qwen-image-2.0-pro' } },
    console: { log() {}, warn() {}, error() {}, info() {} },
    setTimeout,
    clearTimeout,
    Date,
    JSON,
    String,
    Number,
    Array,
    Object,
    Set,
    RegExp,
    Promise
  }
  sandbox.globalThis = sandbox
  vm.runInNewContext(source, sandbox, { filename: 'generate_wanx/index.js' })
  return { main: sandbox.exports.main, requests }
}

async function verifyProviderBlock() {
  const runtime = createBlockedWanxRuntime()
  const result = await runtime.main({
    taskId: 'task_identity_blocked',
    type: 'head_replace',
    imageUrl: baseImage,
    params: {
      baseImage,
      identityReferenceImage: headReferenceImage,
      replaceMode: 'full_head'
    }
  })
  assert.strictEqual(result.success, false)
  assert.strictEqual(result.errorCode, 'IDENTITY_PROVIDER_NOT_SUPPORTED')
  assert.strictEqual(runtime.requests.length, 0)
  console.log('head-replace-contract-smoke: PASS')
}

verifyProviderBlock().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
