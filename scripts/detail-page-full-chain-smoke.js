const assert = require('assert')
const fs = require('fs')
const path = require('path')
const vm = require('vm')

const ROOT = path.resolve(__dirname, '..')
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8')

function loadRepository() {
  const storage = new Map()
  const source = `${read('utils/detail-page/detailPageRepository.js')
    .replace(/^import .*$/gm, '')
    .replace(/export const /g, 'const ')
    .replace(/export function /g, 'function ')}
module.exports = { saveDetailPageDraft, getDetailPage, getDetailPageByTaskId, updateDetailPageRenderState, createDetailPageVersion, completeDetailPageVersion }`
  const context = {
    module: { exports: {} }, exports: {}, Object, Array, Set, String, Number, Boolean, Date, Math, JSON,
    uni: { getStorageSync: (key) => storage.get(key), setStorageSync: (key, value) => storage.set(key, value) },
    getCurrentEnterpriseId: () => 'enterprise_1',
    getCurrentUser: () => ({ userId: 'user_1', enterpriseId: 'enterprise_1' })
  }
  vm.runInNewContext(source, context, { filename: 'detailPageRepository.js' })
  return context.module.exports
}

function loadOrganizer() {
  const source = `${read('utils/detail-page/detailContentOrganizer.js')
    .replace(/export const /g, 'const ')
    .replace(/export function /g, 'function ')}
module.exports = { organizeDetailContent, validateDetailContentTruthfulness }`
  const context = { module: { exports: {} }, exports: {}, Object, Array, Set, String, Number, Boolean, Date, Math, RegExp }
  vm.runInNewContext(source, context, { filename: 'detailContentOrganizer.js' })
  return context.module.exports
}

function run() {
  const repository = loadRepository()
  const organizer = loadOrganizer()
  const taskSource = read('utils/detail-page/detailPageTask.js')
  const pageSource = read('package-ai/detail-long-image/detail-long-image.vue')
  const resultSource = read('package-ai/result/result.vue')
  const rendererSource = read('utils/detail-page/detailPageRenderer.js')
  const workTypeSource = read('utils/work/workTypeCatalog.js')

  const organized = organizer.organizeDetailContent({
    assets: [{ assetId: 'asset_main', fileId: 'cloud://main.jpg', usage: 'product_main', usageConfirmed: true }],
    productFacts: { productName: '测试连衣裙', materialComposition: '' },
    sizeRows: []
  })
  assert.ok(organized.contentVersion > 0 && organized.recommendedModuleIds.includes('hero'))

  const editorSnapshot = { primaryAsset: { assetId: 'asset_main', fileId: 'cloud://main.jpg' }, modules: [{ id: 'hero', enabled: true, order: 0 }], currentStep: 2 }
  const draft = repository.saveDetailPageDraft({
    templateId: 'simple_ecommerce', sourceAssetIds: ['asset_main'], editorSnapshot,
    contentVersion: organized.contentVersion, assetClassifications: organized.assetClassifications,
    productFacts: organized.productFacts, generatedCopy: organized.generatedCopy
  })
  assert.strictEqual(repository.getDetailPage(draft.detailPageId).editorSnapshot.currentStep, 2)

  const version = repository.createDetailPageVersion({ ...draft, editorSnapshot })
  repository.updateDetailPageRenderState(draft.detailPageId, { taskId: 'task_1', workId: 'work_task_1', renderStatus: 'partial_success', renderProgress: 55, renderedAssetIds: ['asset_render_1'], coverAssetId: 'asset_render_1' })
  assert.strictEqual(repository.getDetailPageByTaskId('task_1').workId, 'work_task_1')
  repository.completeDetailPageVersion(version.detailPageVersionId, { renderedAssetIds: ['asset_render_1', 'asset_render_2'], coverAssetId: 'asset_render_1', previewUrl: 'cloud://render-1.jpg' })
  const completed = repository.getDetailPage(draft.detailPageId)
  assert.strictEqual(completed.renderStatus, 'completed')
  assert.strictEqual(completed.renderProgress, 100)
  assert.strictEqual(completed.renderedAssetIds.length, 2)
  assert.strictEqual(completed.coverAssetId, 'asset_render_1')

  const unsafeSize = organizer.validateDetailContentTruthfulness({
    primaryAsset: { fileId: 'cloud://main.jpg' },
    sizeRows: [{ size: 'M', bust: '92', confirmedByUser: false }],
    productFacts: [], generatedCopy: [], modules: []
  })
  assert.strictEqual(unsafeSize.ok, false)
  const unsafeComposition = organizer.validateDetailContentTruthfulness({
    primaryAsset: { fileId: 'cloud://main.jpg' }, sizeRows: [], generatedCopy: [], modules: [],
    productFacts: [{ fieldId: 'materialComposition', value: '100%纯棉', confirmedByUser: false }]
  })
  assert.strictEqual(unsafeComposition.ok, false)

  assert.ok(taskSource.indexOf('createDetailPageRenderTask') < taskSource.indexOf('startDetailPageRenderJob'))
  assert.ok(taskSource.indexOf('await uploadImage') < taskSource.lastIndexOf("status: 'completed'"))
  assert.ok(taskSource.includes('updateDetailPageRenderState(options.detailPageId'))
  assert.ok(taskSource.includes("legacyResultLabel: '旧版结果'"))
  assert.ok(pageSource.includes('startDetailPageRenderJob(task.taskId, [...this.previewPaths]'))
  assert.ok(pageSource.includes('validateDetailContentTruthfulness(this.buildDraft())'))
  assert.ok(pageSource.includes('restoreFromDetailPage(detailPageId)'))
  assert.ok(resultSource.includes('detailPageId=${encodeURIComponent(detailPageId)}'))
  assert.ok(rendererSource.includes('buildVerticalSegments') && !rendererSource.includes('four-grid'))
  assert.ok(workTypeSource.includes("key: 'detail_long_image'"))
  assert.ok(!taskSource.includes('createTaskAndRun'))
  assert.ok(!taskSource.includes('generate_wanx'))

  console.log('DETAIL_PAGE_FULL_CHAIN_SMOKE_OK cases=12 draft=1 organize=1 order=1 truth=1 deterministic=1 immediate_work=1 live_progress=1 split=1 no_grid=1 valid_complete=1 reedit=1 template_truth=1')
}

try {
  run()
} catch (error) {
  console.error(error.stack || error.message || error)
  process.exitCode = 1
}
