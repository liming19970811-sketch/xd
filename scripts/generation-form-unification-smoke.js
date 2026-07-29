const assert = require('assert')
const fs = require('fs')
const path = require('path')
const vm = require('vm')

const ROOT = path.resolve(__dirname, '..')

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8')
}

function count(source, pattern) {
  return (source.match(pattern) || []).length
}

function loadMarketingRuntime(uploadImpl) {
  const source = read('package-ai/marketing-workbench/marketing-workbench.vue')
  let script = source.slice(source.indexOf('<script>') + 8, source.lastIndexOf('</script>'))
  script = script
    .replace(/import\s+[\s\S]*?\s+from\s+'[^']+'\s*/g, '')
    .replace('export default', 'module.exports =')

  const calls = { uploads: [], tasks: [], navigations: [] }
  const sandbox = {
    module: { exports: {} },
    exports: {},
    AiFeatureHeader: {},
    GenerationActionBar: {},
    uploadImage: async (payload) => {
      calls.uploads.push(payload)
      if (uploadImpl) return uploadImpl(payload)
      return { fileId: 'cloud://test-env/marketing-source.jpg' }
    },
    createTaskAndRun: (payload) => {
      calls.tasks.push(payload)
      return { taskId: 'marketing_task_1' }
    },
    uni: {
      navigateTo(payload) {
        calls.navigations.push(payload.url)
        if (typeof payload.success === 'function') payload.success()
      },
      showToast() {}
    },
    console: { log() {}, warn() {}, error() {} },
    String,
    RegExp,
    Promise
  }
  vm.runInNewContext(script, sandbox, { filename: 'marketing-workbench.vue' })
  return { component: sandbox.module.exports, calls }
}

function createMarketingInstance(component) {
  const instance = { ...component.data() }
  Object.entries(component.computed || {}).forEach(([name, getter]) => {
    Object.defineProperty(instance, name, { configurable: true, get: getter.bind(instance) })
  })
  Object.entries(component.methods || {}).forEach(([name, method]) => {
    instance[name] = method.bind(instance)
  })
  return instance
}

async function main() {
  const header = read('components/ai-generation/ai-feature-header.vue')
  const actionBar = read('components/ai-generation/generation-action-bar.vue')
  const simple = read('package-ai/simple-ai-workbench/simple-ai-workbench.vue')
  const upload = read('package-ai/upload/upload.vue')
  const marketing = read('package-ai/marketing-workbench/marketing-workbench.vue')

  assert(header.includes("name: 'AiFeatureHeader'"))
  assert(actionBar.includes("name: 'GenerationActionBar'"))
  assert(actionBar.includes(':disabled="disabled || loading"'))
  assert(actionBar.includes('env(safe-area-inset-bottom)'))

  ;[simple, upload, marketing].forEach((source) => {
    assert(source.includes('AiFeatureHeader'))
    assert(source.includes('GenerationActionBar'))
  })

  assert(count(simple, /<GenerationActionBar/g) >= 3)
  assert(count(upload, /<GenerationActionBar/g) >= 4)
  assert(!upload.includes('使用方案出图'))
  assert(marketing.includes('ensureStableClothImage'))
  assert(marketing.includes("if (this.createdTaskId)"))
  assert(marketing.includes("scene: 'marketing_workbench'"))
  assert(!header.includes('createTaskAndRun'))
  assert(!actionBar.includes('createTaskAndRun'))

  const runtime = loadMarketingRuntime()
  const marketingInstance = createMarketingInstance(runtime.component)
  marketingInstance.clothImagePath = 'wxfile://tmp/marketing-source.jpg'
  await marketingInstance.startGenerate()
  assert.strictEqual(runtime.calls.uploads.length, 1)
  assert.strictEqual(runtime.calls.tasks.length, 1)
  assert.strictEqual(runtime.calls.tasks[0].input.assets.clothImage.fileId, 'cloud://test-env/marketing-source.jpg')
  assert.strictEqual(marketingInstance.createdTaskId, 'marketing_task_1')
  await marketingInstance.startGenerate()
  assert.strictEqual(runtime.calls.tasks.length, 1)
  assert.strictEqual(runtime.calls.navigations.length, 2)

  const failedRuntime = loadMarketingRuntime(async () => { throw new Error('upload failed') })
  const failedInstance = createMarketingInstance(failedRuntime.component)
  failedInstance.clothImagePath = 'wxfile://tmp/upload-failed.jpg'
  await failedInstance.startGenerate()
  assert.strictEqual(failedRuntime.calls.tasks.length, 0)
  assert.strictEqual(failedInstance.submissionState, 'upload_failed')

  console.log('[PASS] shared generation header and action bar contracts')
  console.log('[PASS] all task-creating miniapp forms use the shared presentation layer')
  console.log('[PASS] upload flow keeps one visible final generation action per step')
  console.log('[PASS] marketing upload uses a stable image and guards duplicate task creation')
}

try {
  main().catch((error) => {
    console.error('[FAIL] generation form unification smoke')
    console.error(error && error.stack ? error.stack : error)
    process.exitCode = 1
  })
} catch (error) {
  console.error('[FAIL] generation form unification smoke')
  console.error(error && error.stack ? error.stack : error)
  process.exitCode = 1
}
