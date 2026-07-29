const assert = require('assert')
const fs = require('fs')
const path = require('path')
const vm = require('vm')

const ROOT = path.resolve(__dirname, '..')

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8')
}

function loadIntegrity() {
  const source = `${read('utils/work/workResultIntegrity.js')
    .replace(/export function /g, 'function ')
    .replace(/export \{[^}]+\}\s*$/m, '')}
module.exports = { normalizeWorkResultItems, normalizeWorkIntegrityStatus, isStableWorkResultUrl }`
  const context = { module: { exports: {} }, exports: {}, Object, Array, Set, String, Number, Boolean, RegExp, Math }
  vm.runInNewContext(source, context, { filename: 'workResultIntegrity.js' })
  return context.module.exports
}

function run() {
  const integrity = loadIntegrity()
  const valid = integrity.normalizeWorkResultItems([
    { assetId: 'asset_1', fileId: 'cloud://env/result-1.jpg' },
    { assetId: 'asset_2', imageUrl: 'https://cdn.example.com/result-2.jpg' }
  ])
  assert.strictEqual(valid.length, 2)
  assert.strictEqual(integrity.normalizeWorkIntegrityStatus({ status: 'completed' }, 0, 1), 'result_missing')
  assert.strictEqual(integrity.normalizeWorkIntegrityStatus({ status: 'completed' }, 1, 2), 'partial_success')
  assert.strictEqual(integrity.normalizeWorkIntegrityStatus({ status: 'completed' }, 2, 2), 'completed')
  assert.strictEqual(integrity.normalizeWorkIntegrityStatus({ status: 'processing' }, 1, 2), 'partial_success')
  assert.strictEqual(integrity.isStableWorkResultUrl('wxfile://tmp/result.jpg'), false)
  assert.strictEqual(integrity.isStableWorkResultUrl('http://tmp/result.jpg'), false)

  const taskLayer = read('utils/task/taskLayer.js')
  const persistIndex = taskLayer.indexOf('await persistWanxResultItems')
  const successIndex = taskLayer.indexOf('buildWanxSuccessPatch(latestTask, wanxResult, persistedItems)')
  assert.ok(persistIndex >= 0 && successIndex > persistIndex, 'result must be persisted before success is written')
  assert.ok(taskLayer.includes('status: GENERATION_STATUSES.RESULT_MISSING'))
  assert.ok(taskLayer.includes('await verifyCloudResultFile(fileId)'))
  assert.ok(taskLayer.includes('coverFileId: imageUrl'))
  assert.ok(taskLayer.includes('assetIds,'))

  const gallery = read('pages/gallery/gallery.vue')
  assert.ok(gallery.includes("work.status === 'result_missing'"))
  assert.ok(gallery.includes('resolveCloudPreviewUrls'))
  assert.ok(gallery.includes('scheduleWorkPolling'))
  assert.ok(gallery.includes('生成结果未保存，请检查或重试'))

  console.log('work-result-integrity-smoke: PASS statuses=4 stable-results=2 polling=enabled')
}

try {
  run()
} catch (error) {
  console.error(error.stack || error.message || error)
  process.exitCode = 1
}
