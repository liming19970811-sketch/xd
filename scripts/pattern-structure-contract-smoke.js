const assert = require('assert')
const fs = require('fs')
const path = require('path')
const vm = require('vm')

const ROOT = path.resolve(__dirname, '..')
const patternContract = require(path.join(ROOT, 'cloudfunctions/generate_wanx/patternStructureContract'))
const garmentContract = require(path.join(ROOT, 'cloudfunctions/generate_wanx/garmentReplaceContract'))
const identityContract = require(path.join(ROOT, 'cloudfunctions/generate_wanx/identityReplaceContract'))
const fabricContract = require(path.join(ROOT, 'cloudfunctions/generate_wanx/fabricReplaceContract'))

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8')
}

function createRuntime(options = {}) {
  const requests = []
  const source = read('cloudfunctions/generate_wanx/index.js').replace("const cloud = require('wx-server-sdk')", 'const cloud = globalThis.__cloudMock')
  const sandbox = {
    exports: {}, module: { exports: {} },
    require(id) {
      if (id === './patternStructureContract') return patternContract
      if (id === './garmentReplaceContract') return garmentContract
      if (id === './identityReplaceContract') return identityContract
      if (id === './fabricReplaceContract') return fabricContract
      throw new Error(`Unexpected require: ${id}`)
    },
    __cloudMock: { DYNAMIC_CURRENT_ENV: 'test', init() {}, database() { return { collection() { return { where() { return { limit() { return { async get() { return { data: [] } } } } } } } } } }, async getTempFileURL({ fileList = [] } = {}) { return { fileList: fileList.map((fileID, index) => ({ fileID, status: 0, tempFileURL: `https://cdn.example.com/ref-${index}.png` })) } } },
    fetch: async (url, request = {}) => {
      requests.push({ url, request })
      return { ok: true, status: 200, async text() { return JSON.stringify({ output: { results: [{ url: 'https://cdn.example.com/pattern-result.png' }] } }) } }
    },
    process: { env: { DASHSCOPE_API_KEY: 'test-key', WANX_MODEL: options.model || 'qwen-image-2.0-pro' } },
    console: { log() {}, info() {}, warn() {}, error() {} }, setTimeout, clearTimeout, Date, JSON, String, Number, Array, Object, Set, RegExp, Promise
  }
  sandbox.globalThis = sandbox
  vm.runInNewContext(source, sandbox, { filename: 'generate_wanx/index.js' })
  return { main: sandbox.exports.main, requests }
}

async function main() {
  const front = 'https://cdn.example.com/front.png'
  const back = 'https://cdn.example.com/back.png'
  const sketch = 'https://cdn.example.com/sketch.png'
  const valid = patternContract.validatePatternStructureParams({ category: 'shirt', outputTarget: 'front_technical', referenceImages: [front, back, sketch] }, front)
  assert.strictEqual(valid.ok, true)
  assert.strictEqual(valid.input.referenceImages.length, 3)
  assert.strictEqual(patternContract.validatePatternStructureParams({ category: '', referenceImages: [front] }, front).errorCode, 'PATTERN_CATEGORY_REQUIRED')
  assert.strictEqual(patternContract.validatePatternStructureParams({ category: 'shirt' }, '').errorCode, 'PATTERN_FRONT_IMAGE_REQUIRED')

  const runtime = createRuntime()
  const response = await runtime.main({
    type: 'pattern_structure_generate',
    imageUrl: front,
    params: {
      actionType: 'pattern_structure_generate', category: 'shirt', inputMode: 'garment_photo', outputTarget: 'pattern_pieces',
      referenceImages: [front, back, sketch], baseSize: 'M', measurementBasis: 'body', measurements: { bust: 84 }
    }
  })
  assert.strictEqual(response.success, true)
  assert.strictEqual(response.actionType, 'pattern_structure_generate')
  const body = JSON.parse(runtime.requests[0].request.body)
  const content = body.input.messages[0].content
  assert.deepStrictEqual(content.slice(0, 3).map((item) => item.image), [front, back, sketch])
  assert(content[3].text.includes('HUMAN PATTERN MAKER REVIEW REQUIRED'))
  assert(content[3].text.includes('not an industrial cutting pattern'))

  const unsupported = createRuntime({ model: 'single-image-provider' })
  const unsupportedResponse = await unsupported.main({ type: 'pattern_structure_generate', imageUrl: front, params: { category: 'shirt', referenceImages: [front] } })
  assert.strictEqual(unsupportedResponse.errorCode, 'PATTERN_REFERENCE_NOT_SUPPORTED')
  assert.strictEqual(unsupported.requests.length, 0)

  const page = read('package-ai/pattern-structure/pattern-structure.vue')
  const home = read('utils/home/homeCapabilities.js')
  const taskLayer = read('utils/task/taskLayer.js')
  const repository = read('utils/workspace/patternMakingRepository.js')
  const resultPage = read('package-ai/result/result.vue')
  const pagesJson = read('pages.json')
  assert(page.includes("run: { fallbackToMock: false }"))
  assert(page.includes('createBatchTasks'))
  assert(page.includes('frontImage') && page.includes('backImage') && page.includes('structureSketch'))
  assert(home.includes("id: 'pattern_structure'"))
  assert(taskLayer.includes('isPatternStructureTask(sourceTask)'))
  assert(repository.includes('productionAvailable: false'))
  assert(repository.includes("industrialStatus: 'not_implemented'"))
  assert(repository.includes("master.source === 'ai_pattern_structure'"))
  assert(repository.includes('productionAvailable: approved && !referenceOnly'))
  assert(repository.includes('factoryReady: referenceOnly ? false'))
  assert(repository.includes('PATTERN_PART_KEY') && repository.includes('PATTERN_SIZE_SPEC_KEY'))
  assert(resultPage.includes('待打版师复核，不可直接裁剪'))
  assert(pagesJson.includes('pattern-structure/pattern-structure'))
  console.log('pattern structure contract smoke: PASS')
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
