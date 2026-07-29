const assert = require('assert')
const fs = require('fs')
const path = require('path')
const vm = require('vm')

const ROOT = path.resolve(__dirname, '..')
const fabricContract = require(path.join(ROOT, 'cloudfunctions/generate_wanx/fabricReplaceContract'))
const garmentContract = require(path.join(ROOT, 'cloudfunctions/generate_wanx/garmentReplaceContract'))
const patternContract = require(path.join(ROOT, 'cloudfunctions/generate_wanx/patternStructureContract'))
const identityContract = require(path.join(ROOT, 'cloudfunctions/generate_wanx/identityReplaceContract'))

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8')
}

function testResultRefreshContract() {
  const resultPage = read('package-ai/result/result.vue')
  const history = read('utils/task/taskHistory.js')
  assert.ok(resultPage.includes('await loadTaskDetailIntoState(currentId)'))
  assert.ok(resultPage.includes('this._resultRefreshInFlight'))
  assert.ok(resultPage.includes('elapsed < 30000 ? 2000 : 5000'))
  assert.ok(resultPage.includes("switchTab({ url: '/pages/gallery/gallery'"))
  assert.ok(resultPage.includes('Number(task.expectedOutputCount)'))
  assert.ok(history.includes('serverResultCount <= localResultCount'))
  assert.ok(history.includes('upsertWorkRecordFromTask(mergedById[taskId])'))
}

function testFabricPageContract() {
  const page = read('package-ai/simple-ai-workbench/simple-ai-workbench.vue')
  assert.ok(page.includes("actionType: 'fabric_replace'"))
  assert.ok(page.includes("materialTransferMode: 'generative_reference'"))
  assert.ok(page.includes('fabricReferenceImage: this.fabricReferenceImagePath'))
  assert.ok(page.includes("run: { fallbackToMock: false }"))
  assert.ok(page.includes('requiresReview: true'))
  assert.ok(page.includes('deliveryEligible: false'))
  assert.ok(!page.includes("fabricColorMode === 'sample_color'"))
}

function createProviderRuntime() {
  const requests = []
  const source = read('cloudfunctions/generate_wanx/index.js')
    .replace("const cloud = require('wx-server-sdk')", 'const cloud = globalThis.__cloudMock')
  const sandbox = {
    exports: {},
    module: { exports: {} },
    require(id) {
      if (id === './fabricReplaceContract') return fabricContract
      if (id === './garmentReplaceContract') return garmentContract
      if (id === './patternStructureContract') return patternContract
      if (id === './identityReplaceContract') return identityContract
      throw new Error(`Unexpected require: ${id}`)
    },
    __cloudMock: {
      DYNAMIC_CURRENT_ENV: 'test',
      init() {},
      database() { return { collection() { return { where() { return { limit() { return { async get() { return { data: [] } } } } } } } } } },
      getWXContext() { return { OPENID: 'test-user' } },
      async getTempFileURL({ fileList = [] } = {}) {
        return { fileList: fileList.map((fileID, index) => ({ fileID, status: 0, tempFileURL: `https://cdn.example.com/cloud-${index}.png` })) }
      }
    },
    fetch: async (url, request = {}) => {
      requests.push({ url, request })
      return { ok: true, status: 200, async text() { return JSON.stringify({ output: { results: [{ url: 'https://cdn.example.com/fabric-result.png' }] } }) } }
    },
    process: { env: { DASHSCOPE_API_KEY: 'test-key', WANX_MODEL: 'qwen-image-2.0-pro' } },
    console: { log() {}, warn() {}, error() {} },
    setTimeout,
    clearTimeout,
    Date,
    JSON,
    String,
    Number,
    Boolean,
    Array,
    Object,
    Set,
    RegExp,
    Promise,
    encodeURIComponent
  }
  sandbox.globalThis = sandbox
  vm.runInNewContext(source, sandbox, { filename: 'generate_wanx/index.js' })
  return { main: sandbox.exports.main, requests }
}

async function testFabricProviderContract() {
  const source = 'https://cdn.example.com/source.png'
  const reference = 'https://cdn.example.com/fabric.png'
  const valid = fabricContract.validateFabricReplaceParams({
    fabricType: 'silk',
    fabricReferenceImage: reference,
    materialTransferMode: 'generative_reference'
  }, source)
  assert.strictEqual(valid.ok, true)

  const unsupported = fabricContract.validateFabricReplaceParams({
    fabricType: 'silk',
    materialTransferMode: 'precise_masked_transfer'
  }, source)
  assert.strictEqual(unsupported.ok, false)
  assert.strictEqual(unsupported.errorCode, 'FABRIC_MASK_EDIT_NOT_SUPPORTED')

  const prompt = fabricContract.buildFabricReplacePrompt({
    fabricType: 'silk',
    fabricTargetArea: 'whole_garment',
    fabricColorMode: 'preserve_original'
  }, '', true)
  assert.ok(prompt.includes('Image 1 is the source'))
  assert.ok(prompt.includes('Image 2 is the fabric sample'))
  assert.ok(prompt.includes('Keep the original garment color'))
  assert.ok(prompt.includes('Preserve metal chains'))
  assert.ok(prompt.includes('No plastic or metallic glare'))

  const provider = read('cloudfunctions/generate_wanx/index.js')
  assert.ok(provider.includes('...(wanxFabricReferenceUrl ? [{ image: wanxFabricReferenceUrl }] : [])'))
  assert.ok(provider.includes("reviewStatus: (sceneReplace || identityReplace || modelProfile || fabricReplace) ? 'needs_review'"))
  assert.ok(provider.includes("materialTransferMode: fabricReplace ? 'generative_reference'"))

  const runtime = createProviderRuntime()
  const response = await runtime.main({
    type: 'fabric_replace',
    taskId: 'task-fabric-test',
    imageUrl: source,
    params: {
      actionType: 'fabric_replace',
      fabricType: 'silk',
      fabricReferenceImage: reference,
      fabricColorMode: 'preserve_original',
      materialTransferMode: 'generative_reference'
    }
  })
  assert.strictEqual(response.success, true)
  assert.strictEqual(response.fabricReferenceUsed, true)
  assert.strictEqual(response.fabricMaskUsed, false)
  assert.strictEqual(response.reviewStatus, 'needs_review')
  assert.strictEqual(response.deliveryEligible, false)
  const body = JSON.parse(runtime.requests[0].request.body)
  const content = body.input.messages[0].content
  assert.deepStrictEqual(content.slice(0, 2).map((item) => item.image), [source, reference])
  assert.ok(content[2].text.includes('Image 1 is the source'))
  assert.ok(content[2].text.includes('Image 2 is the fabric sample'))
}

async function main() {
  testResultRefreshContract()
  testFabricPageContract()
  await testFabricProviderContract()
  console.log('result-fabric-sync-smoke: PASS')
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
