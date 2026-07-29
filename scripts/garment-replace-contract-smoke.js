const assert = require('assert')
const fs = require('fs')
const path = require('path')
const vm = require('vm')

const ROOT = path.resolve(__dirname, '..')
const contract = require(path.join(ROOT, 'cloudfunctions/generate_wanx/garmentReplaceContract'))
const patternStructureContract = require(path.join(ROOT, 'cloudfunctions/generate_wanx/patternStructureContract'))
const identityReplaceContract = require(path.join(ROOT, 'cloudfunctions/generate_wanx/identityReplaceContract'))
const fabricReplaceContract = require(path.join(ROOT, 'cloudfunctions/generate_wanx/fabricReplaceContract'))

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8')
}

function createWanxRuntime(options = {}) {
  const requests = []
  const source = read('cloudfunctions/generate_wanx/index.js')
    .replace("const cloud = require('wx-server-sdk')", 'const cloud = globalThis.__cloudMock')
  const sandbox = {
    exports: {},
    module: { exports: {} },
    require(id) {
      if (id === './garmentReplaceContract') return contract
      if (id === './patternStructureContract') return patternStructureContract
      if (id === './identityReplaceContract') return identityReplaceContract
      if (id === './fabricReplaceContract') return fabricReplaceContract
      throw new Error(`Unexpected require: ${id}`)
    },
    __cloudMock: {
      DYNAMIC_CURRENT_ENV: 'test-env',
      init() {},
      getWXContext() { return { OPENID: 'formal-user' } },
      async callFunction() { return { result: { ok: true, status: 'rolled_back' } } },
      database() {
        return {
          collection() {
            return {
              where() { return this },
              limit() { return this },
              async get() { return { data: [{ recordId: 'quota-record', openid: 'formal-user', status: 'consumed' }] } }
            }
          }
        }
      },
      async getTempFileURL({ fileList = [] } = {}) {
        return { fileList: fileList.map((fileID, index) => ({ fileID, status: 0, tempFileURL: `https://cdn.example.com/cloud-${index}.png` })) }
      }
    },
    fetch: async (url, request = {}) => {
      requests.push({ url, request })
      return {
        ok: true,
        status: 200,
        async text() {
          return JSON.stringify({ output: { results: [{ url: options.resultImageUrl || 'https://cdn.example.com/garment-result.png' }] } })
        }
      }
    },
    process: { env: { DASHSCOPE_API_KEY: 'test-key', WANX_MODEL: options.model || 'qwen-image-2.0-pro' } },
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
  return {
    main(event = {}) {
      return sandbox.exports.main({
        ...event,
        params: {
          ...(event.params || {}),
          formalProviderRequest: true,
          resultMode: 'formal',
          isMock: false,
          quotaRecordId: 'quota-record'
        }
      })
    },
    requests
  }
}

async function main() {
  const person = 'https://cdn.example.com/person.png'
  const upper = 'https://cdn.example.com/upper.png'
  const lower = 'https://cdn.example.com/lower.png'
  const outfit = 'https://cdn.example.com/outfit.png'
  const shoes = 'https://cdn.example.com/shoes.png'

  const upperOnly = contract.validateGarmentParams({ replaceMode: 'upper_only', personImage: person, upperGarment: upper })
  assert.strictEqual(upperOnly.ok, true)
  assert.strictEqual(upperOnly.input.lowerGarment, '')

  const lowerOnly = contract.validateGarmentParams({ replaceMode: 'lower_only', personImage: person, lowerGarment: lower })
  assert.strictEqual(lowerOnly.ok, true)

  const fullOutfit = contract.validateGarmentParams({ replaceMode: 'full_outfit', personImage: person, garmentImage: outfit })
  assert.strictEqual(fullOutfit.ok, true)
  assert.strictEqual(fullOutfit.input.outfitGarment, outfit)

  const missingLower = contract.validateGarmentParams({ replaceMode: 'separate', personImage: person, upperGarment: upper })
  assert.strictEqual(missingLower.errorCode, 'GARMENT_REFERENCE_REQUIRED')

  const overwritten = contract.validateGarmentParams({ replaceMode: 'separate', personImage: person, upperGarment: upper, lowerGarment: upper })
  assert.strictEqual(overwritten.errorCode, 'GARMENT_REFERENCES_MUST_DIFFER')

  const accessoryInput = contract.validateGarmentParams({
    replaceMode: 'upper_only',
    personImage: person,
    upperGarment: upper,
    accessoryReferences: [{ accessoryId: 'acc_shoes', type: 'shoes', name: '鞋子', imageUrl: shoes }]
  })
  assert.strictEqual(accessoryInput.ok, true)
  assert.strictEqual(accessoryInput.input.accessoryReferences[0].type, 'shoes')

  const accessoryOverflow = contract.validateGarmentParams({
    replaceMode: 'separate',
    personImage: person,
    upperGarment: upper,
    lowerGarment: lower,
    accessoryReferences: [{ type: 'bag', imageUrl: shoes }]
  })
  assert.strictEqual(accessoryOverflow.errorCode, 'GARMENT_REFERENCE_LIMIT_EXCEEDED')

  const duplicatedAccessory = contract.validateGarmentParams({
    replaceMode: 'upper_only',
    personImage: person,
    upperGarment: upper,
    accessoryReferences: [{ type: 'hat', imageUrl: upper }]
  })
  assert.strictEqual(duplicatedAccessory.errorCode, 'GARMENT_ACCESSORY_REFERENCE_MUST_DIFFER')

  const capabilities = contract.getGarmentProviderCapabilities('qwen-image-2.0-pro')
  assert.strictEqual(capabilities.supportsMultipleImages, true)
  assert.strictEqual(capabilities.supportsVirtualTryOn, false)
  assert.strictEqual(capabilities.supportsGarmentReference, false)
  assert.strictEqual(capabilities.supportsGarmentMask, false)

  const providerGate = contract.validateGarmentProviderCapabilities('qwen-image-2.0-pro', 'separate')
  assert.strictEqual(providerGate.ok, false)
  assert.strictEqual(providerGate.errorCode, 'GARMENT_PROVIDER_NOT_SUPPORTED')
  ;['upper_only', 'lower_only', 'separate', 'full_outfit'].forEach((mode) => {
    assert.strictEqual(contract.validateGarmentProviderCapabilities('qwen-image-2.0-pro', mode).ok, false)
  })

  const runtime = createWanxRuntime()
  const result = await runtime.main({
    type: 'garment_replace',
    imageUrl: person,
    params: { replaceMode: 'separate', personImage: person, upperGarment: upper, lowerGarment: lower }
  })
  assert.strictEqual(result.success, true)
  assert.strictEqual(runtime.requests.length, 1)

  const accessoryRuntime = createWanxRuntime()
  const accessoryResult = await accessoryRuntime.main({
    type: 'garment_replace',
    imageUrl: person,
    params: {
      replaceMode: 'upper_only',
      personImage: person,
      upperGarment: upper,
      accessoryReferences: [{ accessoryId: 'acc_shoes', type: 'shoes', name: '鞋子', imageUrl: shoes }]
    }
  })
  assert.strictEqual(accessoryResult.success, true)
  assert.strictEqual(accessoryRuntime.requests.length, 1)

  const unsupported = createWanxRuntime({ model: 'single-image-provider' })
  const unsupportedResult = await unsupported.main({
    type: 'garment_replace',
    imageUrl: person,
    params: { replaceMode: 'full_outfit', personImage: person, outfitGarment: outfit }
  })
  assert.strictEqual(unsupportedResult.errorCode, 'provider_capability_mismatch')
  assert.strictEqual(unsupported.requests.length, 0)

  const workbench = read('package-ai/simple-ai-workbench/simple-ai-workbench.vue')
  const taskLayer = read('utils/task/taskLayer.js')
  const providerCapability = read('utils/provider/garmentProviderCapability.js')
  const resultPage = read('package-ai/result/result.vue')
  const productionRecords = read('utils/workspace/productionRecordRepository.js')
  const workRepository = read('utils/work/workRepository.js')
  const homeCapabilities = read('utils/home/homeCapabilities.js')
  const taskMapper = read('utils/task/taskMapper.js')
  const accessoryRepository = read('utils/accessory/accessoryLibraryRepository.js')
  assert(workbench.includes('garmentPersonImage'))
  assert(workbench.includes('garmentUpperImage'))
  assert(workbench.includes('garmentLowerImage'))
  assert(workbench.includes('garmentOutfitImage'))
  assert(workbench.includes('garmentAccessories'))
  assert(workbench.includes('配饰与保留'))
  assert(workbench.includes('当前模式已使用模型支持的全部 3 张输入图'))
  assert(workbench.includes('garmentCurrentStep'))
  assert(workbench.includes('garmentSelectedAccessoryTypes'))
  assert(workbench.includes('topGarmentImage'))
  assert(workbench.includes('bottomGarmentImage'))
  assert(workbench.includes('onePieceGarmentImage'))
  assert(workbench.includes("run: { fallbackToMock: false }"))
  assert(workbench.includes('validateAndUploadStyleImage'))
  assert(workbench.includes('createRealGenerationTask'))
  assert(workbench.includes('type: GARMENT_REPLACE_TASK_TYPE'))
  assert(workbench.includes('taskType: GARMENT_REPLACE_TASK_TYPE'))
  assert(workbench.includes('preserveGarmentDetails: true'))
  assert(!workbench.includes('clothImage: this.buildTaskImageAsset(normalized.personImage, normalized.personImage)'))
  assert(taskLayer.includes('isGarmentReplaceTask(latestTask)'))
  assert(taskLayer.includes('consumeQuota({ taskId: task.taskId, action, count: 1 })'))
  assert(providerCapability.includes('supportsVirtualTryOn: true'))
  assert(providerCapability.includes('supportsGarmentMask: true'))
  assert(resultPage.includes("return 'AI换衣服'"))
  assert(productionRecords.includes("label: 'AI换衣服'"))
  assert(productionRecords.includes('assets: { ...(input.assets || {}) }'))
  assert(workRepository.includes('assets: { ...(sourceInput.assets || {}) }'))
  assert(homeCapabilities.includes("id: 'garment_replace'"))
  assert(homeCapabilities.includes("query: { toolType: 'clothing' }"))
  assert(taskMapper.includes('upperGarment: mapServerAsset(upperGarment)'))
  assert(taskMapper.includes('lowerGarment: mapServerAsset(lowerGarment)'))
  assert(taskMapper.includes('outfitGarment: mapServerAsset(outfitGarment)'))
  assert(taskMapper.includes('accessoryReferences: accessoryReferences.map'))
  assert(accessoryRepository.includes("value: 'shoes'"))
  assert(accessoryRepository.includes("value: 'jewelry'"))

  console.log('garment replace contract smoke: PASS')
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
