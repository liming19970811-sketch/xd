const assert = require('assert')
const fs = require('fs')
const path = require('path')
const vm = require('vm')

const ROOT = path.resolve(__dirname, '..')
const garmentReplaceContract = require(path.join(ROOT, 'cloudfunctions/generate_wanx/garmentReplaceContract'))
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
      if (id === './garmentReplaceContract') return garmentReplaceContract
      if (id === './patternStructureContract') return patternStructureContract
      if (id === './identityReplaceContract') return identityReplaceContract
      if (id === './fabricReplaceContract') return fabricReplaceContract
      throw new Error(`Unexpected require: ${id}`)
    },
    __cloudMock: {
      DYNAMIC_CURRENT_ENV: 'test-env',
      init() {},
      database() {
        return {
          collection() {
            return {
              where() {
                return {
                  limit() {
                    return { async get() { return { data: [] } } }
                  }
                }
              }
            }
          }
        }
      },
      async getTempFileURL({ fileList = [] } = {}) {
        return {
          fileList: fileList.map((fileID, index) => ({
            fileID,
            status: 0,
            tempFileURL: `https://cdn.example.com/cloud-${index}-${encodeURIComponent(fileID)}.png`
          }))
        }
      }
    },
    fetch: async (url, request = {}) => {
      requests.push({ url, request })
      const resultImageUrl = options.resultImageUrl || 'https://cdn.example.com/scene-result.png'
      return {
        ok: true,
        status: 200,
        async text() {
          return JSON.stringify({ output: { results: [{ url: resultImageUrl }] } })
        }
      }
    },
    process: {
      env: {
        DASHSCOPE_API_KEY: 'test-key',
        WANX_MODEL: options.model || 'qwen-image-2.0-pro'
      }
    },
    console: { log() {}, warn() {}, error() {} },
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
    encodeURIComponent,
    Promise
  }
  sandbox.globalThis = sandbox
  vm.runInNewContext(source, sandbox, { filename: 'generate_wanx/index.js' })
  return { main: sandbox.exports.main, requests }
}

async function testProviderContract() {
  const sourceImage = 'https://cdn.example.com/source.png'
  const sceneReference = 'https://cdn.example.com/scene.png'

  {
    const runtime = createWanxRuntime()
    const result = await runtime.main({ type: 'pose_replace', imageUrl: sourceImage, params: {} })
    assert.strictEqual(result.success, false)
    assert.strictEqual(result.errorCode, 'POSE_CONTROL_NOT_SUPPORTED')
    assert.strictEqual(runtime.requests.length, 0)
  }

  {
    const runtime = createWanxRuntime()
    const result = await runtime.main({ type: 'pose_adjust', imageUrl: sourceImage, params: {} })
    assert.strictEqual(result.errorCode, 'POSE_CONTROL_NOT_SUPPORTED')
    assert.strictEqual(runtime.requests.length, 0)
  }

  {
    const runtime = createWanxRuntime()
    const result = await runtime.main({
      type: 'scene_replace',
      imageUrl: sourceImage,
      params: { sceneMode: 'exact_composite' }
    })
    assert.strictEqual(result.success, false)
    assert.strictEqual(result.errorCode, 'SCENE_REFERENCE_REQUIRED')
    assert.strictEqual(runtime.requests.length, 0)
  }

  {
    const runtime = createWanxRuntime()
    const result = await runtime.main({
      type: 'scene_replace',
      imageUrl: sourceImage,
      params: { sceneMode: 'exact_composite', sceneReferenceImage: sceneReference }
    })
    assert.strictEqual(result.success, false)
    assert.strictEqual(result.errorCode, 'SCENE_EXACT_COMPOSITE_NOT_AVAILABLE')
    assert.strictEqual(runtime.requests.length, 0)
  }

  {
    const runtime = createWanxRuntime()
    const result = await runtime.main({
      type: 'scene_replace',
      imageUrl: sourceImage,
      params: { sceneReferenceImage: sourceImage }
    })
    assert.strictEqual(result.errorCode, 'SCENE_REFERENCE_MUST_DIFFER')
    assert.strictEqual(runtime.requests.length, 0)
  }

  {
    const runtime = createWanxRuntime({ model: 'wanx-unsupported-model' })
    const result = await runtime.main({
      type: 'scene_replace',
      imageUrl: sourceImage,
      params: { sceneReferenceImage: sceneReference }
    })
    assert.strictEqual(result.errorCode, 'SCENE_REFERENCE_NOT_SUPPORTED')
    assert.strictEqual(runtime.requests.length, 0)
  }

  {
    const runtime = createWanxRuntime()
    const result = await runtime.main({
      type: 'scene_replace',
      imageUrl: sourceImage,
      params: {
        sceneReferenceImage: sceneReference,
        sceneMode: 'generative_reference',
        scenePrompt: '浅色室内家居环境与柔和自然光',
        preserveGarment: true,
        preservePerson: true,
        replaceBackground: true
      }
    })
    assert.strictEqual(result.success, true)
    assert.strictEqual(result.actionType, 'scene_replace')
    assert.strictEqual(result.sceneMode, 'generative_reference')
    assert.strictEqual(result.sceneReferenceUsed, true)
    assert.strictEqual(result.reviewStatus, 'needs_review')
    assert.strictEqual(result.deliveryEligible, false)
    assert.strictEqual(runtime.requests.length, 1)
    const body = JSON.parse(runtime.requests[0].request.body)
    const content = body.input.messages[0].content
    assert.deepStrictEqual(content.slice(0, 2).map((item) => item.image), [sourceImage, sceneReference])
    assert.ok(content[2].text.includes('图一'))
    assert.ok(content[2].text.includes('图二'))
    assert.ok(content[2].text.includes('保留'))
    assert.ok(content[2].text.includes('移除'))
  }

  {
    const runtime = createWanxRuntime()
    const result = await runtime.main({
      type: 'scene_replace',
      imageUrl: sourceImage,
      params: {
        sceneMode: 'generative_reference',
        sceneType: 'scene_studio',
        scenePrompt: '专业摄影棚环境，柔和布光'
      }
    })
    assert.strictEqual(result.success, true)
    assert.strictEqual(result.sceneReferenceUsed, false)
    const body = JSON.parse(runtime.requests[0].request.body)
    const content = body.input.messages[0].content
    assert.strictEqual(content.filter((item) => item.image).length, 1)
    assert.ok(content.at(-1).text.includes('文字引导'))
  }

  {
    const runtime = createWanxRuntime({ resultImageUrl: sourceImage })
    const result = await runtime.main({
      type: 'scene_replace',
      imageUrl: sourceImage,
      params: { sceneReferenceImage: sceneReference }
    })
    assert.strictEqual(result.success, false)
    assert.strictEqual(result.errorCode, 'SCENE_REPLACE_UNCHANGED_RESULT')
  }
}

function loadWorkbenchRuntime(uploadImageImpl, createTaskImpl) {
  const vueSource = read('package-ai/simple-ai-workbench/simple-ai-workbench.vue')
  let script = vueSource.slice(vueSource.indexOf('<script>') + 8, vueSource.lastIndexOf('</script>'))
  script = script
    .replace(/import\s+[\s\S]*?\s+from\s+'[^']+'\s*/g, '')
    .replace('export default', 'module.exports =')
  const toasts = []
  const navigations = []
  const sandbox = {
    module: { exports: {} },
    exports: {},
    createTaskAndRun: createTaskImpl,
    uploadImage: uploadImageImpl,
    GARMENT_REPLACE_ACTION: 'garment_replace',
    GARMENT_PROVIDER_MAX_INPUT_IMAGES: 4,
    GARMENT_REPLACE_MODES: {
      UPPER_ONLY: 'upper_only',
      LOWER_ONLY: 'lower_only',
      SEPARATE: 'separate',
      FULL_OUTFIT: 'full_outfit'
    },
    validateGarmentReplaceInput: () => ({ ok: false, message: 'not used by scene smoke' }),
    ACCESSORY_TYPES: [],
    AiFeatureHeader: {},
    GenerationActionBar: {},
    MODEL_TYPES: {},
    createCustomModel: () => null,
    getBrandModels: () => [],
    getPersonalModels: () => [],
    getSystemModels: () => [],
    MODEL_PROFILE_CONSENT_TEXT: 'test consent',
    MODEL_PROFILE_SELECTION_KEY: 'test_model_profile',
    uni: {
      getStorageSync: () => null,
      setStorageSync() {},
      showToast: (payload) => toasts.push(payload),
      navigateTo: (payload) => navigations.push(payload)
    },
    console: { log() {}, warn() {}, error() {} },
    Date,
    Math,
    JSON,
    String,
    Number,
    Boolean,
    Array,
    Object,
    Set,
    RegExp,
    Promise
  }
  vm.runInNewContext(script, sandbox, { filename: 'simple-ai-workbench.vue' })
  return { component: sandbox.module.exports, toasts, navigations }
}

function createSceneInstance(component) {
  const instance = {
    ...component.data(),
    clothImagePath: 'https://cdn.example.com/original-result.png',
    sceneReferenceImagePath: 'wxfile://tmp/scene-reference.jpg',
    sceneReferenceUploadedUrl: '',
    selectedModelFeatures: ['scene_replace'],
    selectedParams: { sceneType: 'custom_scene', scenePrompt: '浅色室内家居环境' },
    toolType: 'model',
    isModelTool: true,
    isPureSceneReplace: true,
    isDisplayTool: false,
    isColorTool: false,
    isFabricTool: false,
    isPatternTool: false,
    isStyleTool: false,
    isMarketingTool: false,
    currentTool: { taskType: 'scene_replace', outputType: 'model_image' },
    currentModelMode: { label: '场景替换' },
    productionContext: null,
    advancedSettingsOpen: false
  }
  Object.keys(component.methods).forEach((name) => {
    instance[name] = component.methods[name].bind(instance)
  })
  instance.buildPromptDraft = () => '保留人物与服装，替换背景'
  return instance
}

async function testWorkbenchContract() {
  {
    const runtime = loadWorkbenchRuntime(
      async () => ({ fileId: 'cloud://test-env/unused.jpg' }),
      () => ({ taskId: 'unused' })
    )
    const instance = createSceneInstance(runtime.component)
    const keys = Object.keys(instance.resourceLibraryExpanded || {})
    assert.ok(keys.length >= 12)
    assert.ok(keys.every((key) => instance.resourceLibraryExpanded[key] === false))
    instance.toggleResourceLibrary('sceneTemplates')
    assert.strictEqual(instance.isResourceLibraryExpanded('sceneTemplates'), true)
    instance.toggleResourceLibrary('modelReferences')
    assert.strictEqual(instance.isResourceLibraryExpanded('sceneTemplates'), true)
    assert.strictEqual(instance.isResourceLibraryExpanded('modelReferences'), true)
    instance.toggleResourceLibrary('sceneTemplates')
    assert.strictEqual(instance.isResourceLibraryExpanded('sceneTemplates'), false)
    assert.strictEqual(instance.isResourceLibraryExpanded('modelReferences'), true)
    assert.strictEqual(instance.sceneReferenceStyle, 'scene_street')
  }

  {
    let taskCreates = 0
    const runtime = loadWorkbenchRuntime(
      async () => ({ fileId: 'cloud://test-env/unused.jpg' }),
      () => { taskCreates += 1; return { taskId: 'should_not_exist' } }
    )
    const instance = createSceneInstance(runtime.component)
    instance.sceneMode = 'generative_reference'
    instance.sceneReferenceImagePath = instance.clothImagePath
    await instance.startGenerate()
    assert.strictEqual(taskCreates, 0)
    assert.strictEqual(runtime.toasts.at(-1).title, '场景参考图不能与当前主体图相同')
  }

  {
    let taskCreates = 0
    const runtime = loadWorkbenchRuntime(
      async () => { throw Object.assign(new Error('upload failed'), { code: 'UPLOAD_FAILED' }) },
      () => { taskCreates += 1; return { taskId: 'should_not_exist' } }
    )
    const instance = createSceneInstance(runtime.component)
    instance.sceneMode = 'generative_reference'
    instance.selectedParams.sceneReferenceImage = instance.sceneReferenceImagePath
    instance.selectedParams.sceneReferenceUrl = instance.sceneReferenceImagePath
    await instance.startGenerate()
    assert.strictEqual(taskCreates, 0)
    assert.strictEqual(instance.sceneReferenceImagePath, 'wxfile://tmp/scene-reference.jpg')
    assert.strictEqual(runtime.toasts.at(-1).title, '场景参考图上传失败，请重新选择。')
  }

  {
    const oldResult = { taskId: 'old_task', resultImageUrl: 'https://cdn.example.com/original-result.png' }
    let createdPayload = null
    const runtime = loadWorkbenchRuntime(
      async () => ({ fileId: 'cloud://test-env/scene-reference.jpg' }),
      (payload) => {
        createdPayload = payload
        return { taskId: 'new_scene_task' }
      }
    )
    const instance = createSceneInstance(runtime.component)
    instance.sceneMode = 'generative_reference'
    instance.selectedParams.backgroundType = 'white'
    instance.selectedParams.randomScene = true
    instance.selectedParams.randomPose = true
    await instance.startGenerate()
    assert.ok(createdPayload)
    assert.strictEqual(createdPayload.type, 'scene_replace')
    assert.strictEqual(createdPayload.run.fallbackToMock, false)
    assert.strictEqual(createdPayload.input.imageUrl, oldResult.resultImageUrl)
    assert.strictEqual(createdPayload.input.params.sceneReferenceImage, 'cloud://test-env/scene-reference.jpg')
    assert.strictEqual(createdPayload.input.params.sceneMode, 'generative_reference')
    assert.strictEqual(createdPayload.input.assets.baseImage.fileUrl, oldResult.resultImageUrl)
    assert.strictEqual(createdPayload.input.assets.sceneImage.fileId, 'cloud://test-env/scene-reference.jpg')
    assert.notStrictEqual(createdPayload.input.imageUrl, createdPayload.input.params.sceneReferenceImage)
    assert.strictEqual(createdPayload.input.options.preserveGarment, true)
    assert.strictEqual(createdPayload.input.options.preserveFace, true)
    assert.strictEqual(createdPayload.input.options.preserveExpression, true)
    assert.strictEqual(createdPayload.input.options.preservePose, true)
    assert.strictEqual(createdPayload.input.options.preserveForeground, true)
    assert.strictEqual(createdPayload.input.options.preserveScene, true)
    assert.strictEqual(createdPayload.input.options.preservePerson, true)
    assert.strictEqual(createdPayload.input.options.replaceBackground, true)
    assert.strictEqual(createdPayload.input.params.backgroundType, undefined)
    assert.strictEqual(createdPayload.input.params.randomScene, undefined)
    assert.strictEqual(createdPayload.input.params.randomPose, undefined)
    assert.strictEqual(oldResult.taskId, 'old_task')
    assert.ok(runtime.navigations[0].url.includes('new_scene_task'))
  }

  {
    let createdPayload = null
    const runtime = loadWorkbenchRuntime(
      async () => ({ fileId: 'cloud://test-env/unused.jpg' }),
      (payload) => {
        createdPayload = payload
        return { taskId: 'new_template_scene_task' }
      }
    )
    const instance = createSceneInstance(runtime.component)
    instance.sceneMode = 'generative_reference'
    instance.sceneReferenceImagePath = ''
    instance.selectedSceneTemplateId = 'scene_studio'
    instance.selectedSceneTemplate = {
      value: 'scene_studio',
      label: '摄影棚',
      prompt: '专业摄影棚环境，柔和布光'
    }
    await instance.startGenerate()
    assert.ok(createdPayload)
    assert.strictEqual(createdPayload.type, 'scene_replace')
    assert.strictEqual(createdPayload.input.params.sceneTemplateId, 'scene_studio')
    assert.strictEqual(createdPayload.input.params.sceneReferenceImage, '')
    assert.strictEqual(createdPayload.input.params.sourceImageUrl, instance.clothImagePath)
  }

  {
    let taskCreates = 0
    const runtime = loadWorkbenchRuntime(
      async () => ({ fileId: 'cloud://test-env/scene-reference.jpg' }),
      () => { taskCreates += 1; return { taskId: 'should_not_exist' } }
    )
    const instance = createSceneInstance(runtime.component)
    instance.sceneMode = 'exact_composite'
    await instance.startGenerate()
    assert.strictEqual(taskCreates, 0)
    assert.strictEqual(runtime.toasts.at(-1).title, '当前环境尚未配置人物分割与背景合成服务，未创建任务，也不会扣除额度。')
  }

  {
    const runtime = loadWorkbenchRuntime(
      async () => ({ fileId: 'cloud://test-env/unused.jpg' }),
      () => ({ taskId: 'unused' })
    )
    const instance = createSceneInstance(runtime.component)
    instance.sceneReferenceImagePath = 'wxfile://tmp/existing-scene.jpg'
    instance.sceneReferenceUploadedUrl = 'cloud://test-env/existing-scene.jpg'
    instance.selectSceneQuickTemplate({
      value: 'scene_outdoor',
      label: '自然户外',
      prompt: '自然户外环境'
    })
    assert.strictEqual(instance.sceneReferenceImagePath, '')
    assert.strictEqual(instance.sceneReferenceUploadedUrl, '')
    assert.strictEqual(instance.selectedSceneTemplateId, 'scene_outdoor')
  }
}

async function main() {
  await testProviderContract()
  const workbenchSource = read('package-ai/simple-ai-workbench/simple-ai-workbench.vue')
  assert.ok(workbenchSource.includes("type: sceneTaskInput ? 'scene_replace' : tool.taskType"))
  assert.ok(workbenchSource.includes('sceneReferenceImage: sceneReferenceTaskImage'))
  assert.ok(workbenchSource.includes('run: { fallbackToMock: false }'))
  assert.ok(workbenchSource.includes('createInternalRealGenerationTask(taskOptions, runtime)'))
  console.log('[PASS] scene replace action mapping')
  console.log('[PASS] pose replace and legacy pose aliases are blocked before provider')
  console.log('[PASS] resource libraries default collapsed and toggle independently')
  console.log('[PASS] scene replace dual-image provider contract')
  console.log('[PASS] exact composite is blocked before provider and task creation')
  console.log('[PASS] generative text template does not fabricate a scene image')
  console.log('[PASS] scene upload failure blocks task creation')
  console.log('[PASS] scene task creates a new task and preserves old result')
  console.log('[PASS] scene template id enters the existing task params')
  console.log('[PASS] uploaded reference and template stay mutually exclusive')
  console.log('[PASS] unsupported provider returns stable error')
}

main().catch((error) => {
  console.error('[FAIL] scene replace contract smoke')
  console.error(error && error.stack ? error.stack : error)
  process.exitCode = 1
})
