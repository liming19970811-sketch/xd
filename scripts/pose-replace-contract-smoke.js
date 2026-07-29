const assert = require('assert')
const fs = require('fs')
const path = require('path')
const vm = require('vm')

const ROOT = path.resolve(__dirname, '..')

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8')
}

function loadContract() {
  const source = read('utils/task/poseReplaceContract.js')
    .replace(/export\s+const\s+/g, 'const ')
    .replace(/export\s+function\s+/g, 'function ')
    .concat('\nmodule.exports = { POSE_REPLACE_ACTION, POSE_REPLACE_DRAFT_KEY, POSE_PRESETS, isStablePoseImage, validatePoseReplaceInput, buildPoseReplaceTaskPayload, getPoseProviderCapability }')
  const sandbox = { module: { exports: {} }, exports: {}, Object, String, RegExp }
  vm.runInNewContext(source, sandbox, { filename: 'poseReplaceContract.js' })
  return sandbox.module.exports
}

function testContract() {
  const contract = loadContract()
  assert.strictEqual(contract.POSE_REPLACE_ACTION, 'pose_replace')
  assert.strictEqual(contract.getPoseProviderCapability().supported, false)

  const missingBase = contract.buildPoseReplaceTaskPayload({ poseSource: 'preset', posePreset: 'standing' })
  assert.strictEqual(missingBase.ok, false)
  assert.strictEqual(missingBase.errorCode, 'POSE_BASE_IMAGE_REQUIRED')

  const presetPayload = contract.buildPoseReplaceTaskPayload({
    baseImage: 'cloud://test/base.jpg',
    poseSource: 'preset',
    posePreset: 'sitting'
  })
  assert.strictEqual(presetPayload.ok, true)
  assert.strictEqual(presetPayload.type, 'pose_replace')
  assert.strictEqual(presetPayload.taskType, 'pose_replace')
  assert.strictEqual(presetPayload.input.params.costActionType, 'pose_replace')
  assert.strictEqual(presetPayload.input.assets.baseImage.fileId, 'cloud://test/base.jpg')
  assert.strictEqual(presetPayload.input.assets.poseReferenceImage, undefined)
  assert.strictEqual(presetPayload.input.options.posePreset, 'sitting')
  assert.strictEqual(presetPayload.input.options.preserveIdentity, true)
  assert.strictEqual(presetPayload.input.options.preserveFace, true)
  assert.strictEqual(presetPayload.input.options.preserveGarment, true)
  assert.strictEqual(presetPayload.input.options.preserveBackground, true)
  assert.strictEqual(presetPayload.input.options.extractPoseOnly, true)
  assert.strictEqual(presetPayload.input.options.useReferenceIdentity, false)
  assert.strictEqual(presetPayload.input.options.useReferenceGarment, false)
  assert.strictEqual(presetPayload.input.options.useReferenceBackground, false)

  const referencePayload = contract.buildPoseReplaceTaskPayload({
    baseImage: 'https://cdn.example.com/base.jpg',
    poseSource: 'reference',
    poseReferenceImage: 'cloud://test/pose.jpg'
  })
  assert.strictEqual(referencePayload.ok, true)
  assert.strictEqual(referencePayload.input.assets.poseReferenceImage.fileId, 'cloud://test/pose.jpg')
  assert.strictEqual(referencePayload.input.params.posePreset, '')
  assert.strictEqual(referencePayload.input.params.poseReferenceImage, 'cloud://test/pose.jpg')

  const sameImage = contract.buildPoseReplaceTaskPayload({
    baseImage: 'cloud://test/same.jpg',
    poseSource: 'reference',
    poseReferenceImage: 'cloud://test/same.jpg'
  })
  assert.strictEqual(sameImage.ok, false)
  assert.strictEqual(sameImage.errorCode, 'POSE_REFERENCE_MUST_DIFFER')
}

function testWiring() {
  const pages = read('pages.json')
  const home = read('pages/index/index.vue')
  const capabilities = read('utils/home/homeCapabilities.js')
  const page = read('package-ai/change-pose/change-pose.vue')
  const provider = read('cloudfunctions/generate_wanx/index.js')
  const records = read('utils/workspace/productionRecordRepository.js')
  const works = read('utils/work/workRepository.js')
  const membership = read('utils/member/membershipDisplay.js')
  const result = read('package-ai/result/result.vue')

  assert.ok(pages.includes('"path": "change-pose/change-pose"'))
  assert.ok(pages.includes('"navigationBarTitleText": "AI换姿势"'))
  assert.ok(capabilities.includes("route: '/package-ai/change-pose/change-pose'"))
  assert.ok(home.includes("createHomeTool('pose_replace'"))
  assert.ok(!/createHomeTool\('pose_replace',[\s\S]{0,400}simple-ai-workbench/.test(home))
  assert.ok(page.includes("getPoseProviderCapability()"))
  assert.ok(page.includes('未进入真实 Provider 前不会创建任务或扣除额度'))
  assert.ok(!page.includes('createTaskAndRun('))
  assert.ok(!page.includes('模特类型'))
  assert.ok(!page.includes('随机人脸'))
  assert.ok(provider.includes("POSE_REPLACE_ACTIONS = new Set(['pose_replace', 'pose_adjust', 'pose_variation', 'pose_variant', 'pose_change'])"))
  assert.ok(provider.includes("'POSE_CONTROL_NOT_SUPPORTED'"))
  assert.ok(records.includes("label: 'AI换姿势'"))
  assert.ok(works.includes("label: 'AI换姿势'"))
  assert.ok(membership.includes("pose_replace: 'AI换姿势'"))
  assert.ok(result.includes("return 'AI换姿势'"))
}

testContract()
testWiring()
console.log('[PASS] pose replace independent route')
console.log('[PASS] pose preset and reference-image contracts')
console.log('[PASS] identity, garment and background preservation flags')
console.log('[PASS] unsupported provider blocks before task and quota')
console.log('[PASS] task, work, membership and result labels')
