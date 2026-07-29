const assert = require('assert')
const fs = require('fs')
const path = require('path')
const vm = require('vm')

const ROOT = path.resolve(__dirname, '..')

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8')
}

function loadContract() {
  const source = `${read('utils/detail-page/detailPageContract.js')
    .replace(/export const /g, 'const ')
    .replace(/export function /g, 'function ')}
module.exports = { DETAIL_PAGE_TEMPLATES, DETAIL_PAGE_MODULES, createDetailPageModules, normalizeSizeRows, validateDetailPageDraft, buildDetailPageSnapshot, isLegacyInvalidDetailPageTask }`
  const context = { module: { exports: {} }, exports: {}, Object, Array, Set, String, Number, Boolean, RegExp, Math }
  vm.runInNewContext(source, context, { filename: 'detailPageContract.js' })
  return context.module.exports
}

function loadRepository() {
  const storage = new Map()
  const source = `${read('utils/detail-page/detailPageRepository.js')
    .replace(/^import .*$/gm, '')
    .replace(/export const /g, 'const ')
    .replace(/export function /g, 'function ')}
module.exports = { saveDetailPageDraft, getDetailPage, createDetailPageVersion, completeDetailPageVersion, listDetailPageVersions }`
  const context = {
    module: { exports: {} },
    exports: {},
    Object,
    Array,
    Set,
    String,
    Number,
    Boolean,
    Date,
    Math,
    uni: {
      getStorageSync: (key) => storage.get(key),
      setStorageSync: (key, value) => storage.set(key, value)
    },
    getCurrentEnterpriseId: () => 'enterprise_1',
    getCurrentUser: () => ({ userId: 'user_1', enterpriseId: 'enterprise_1' })
  }
  vm.runInNewContext(source, context, { filename: 'detailPageRepository.js' })
  return context.module.exports
}

function loadRenderer() {
  const source = `${read('utils/detail-page/detailPageRenderer.js')
    .replace(/^import[\s\S]*?from '\.\/detailPageContract'\s*/m, '')
    .replace(/export const /g, 'const ')
    .replace(/export function /g, 'function ')}
module.exports = { estimateModuleHeight, buildVerticalSegments }`
  const context = {
    module: { exports: {} },
    exports: {},
    Object,
    Array,
    String,
    Number,
    Math,
    DETAIL_PAGE_MAX_SEGMENT_HEIGHT: 6000,
    DETAIL_PAGE_RENDER_WIDTH: 750,
    SIZE_FIELDS: [
      { key: 'size', label: '尺码' }, { key: 'shoulder', label: '肩宽' }, { key: 'bust', label: '胸围' },
      { key: 'waist', label: '腰围' }, { key: 'hip', label: '臀围' }, { key: 'sleeveLength', label: '袖长' },
      { key: 'garmentLength', label: '衣长' }, { key: 'pantsLength', label: '裤长' }
    ]
  }
  vm.runInNewContext(source, context, { filename: 'detailPageRenderer.js' })
  return context.module.exports
}

function run() {
  const contract = loadContract()
  const detailPages = loadRepository()
  const rendererRuntime = loadRenderer()
  assert.strictEqual(contract.DETAIL_PAGE_TEMPLATES.length, 3)
  assert.deepStrictEqual(Array.from(contract.DETAIL_PAGE_TEMPLATES, (item) => item.name), ['简约电商', '清透日系', '品牌质感'])
  assert.strictEqual(contract.DETAIL_PAGE_MODULES.length, 12)
  const modules = contract.createDetailPageModules()
  const primary = { assetId: 'asset_source', fileId: 'cloud://source.jpg' }
  modules.forEach((module) => {
    if (['hero', 'flat_display'].includes(module.id)) Object.assign(module, primary)
    if (module.needsText) module.text = '已确认的真实商品信息'
  })
  const draft = { primaryAsset: primary, assets: [], modules, sizeRows: [] }
  assert.strictEqual(contract.validateDetailPageDraft(draft).ok, true)

  const sizeModule = modules.find((item) => item.id === 'size_chart')
  sizeModule.enabled = true
  assert.strictEqual(contract.validateDetailPageDraft(draft).ok, false)
  draft.sizeRows = [{ size: 'M', bust: '92', unit: 'cm', source: 'manual', confirmedByUser: true }]
  assert.strictEqual(contract.validateDetailPageDraft(draft).ok, true)
  const snapshot = contract.buildDetailPageSnapshot(draft)
  assert.strictEqual(snapshot.taskType, 'detail_page_long_image')
  assert.strictEqual(snapshot.render.direction, 'vertical')
  assert.strictEqual(snapshot.render.allowGrid, false)
  assert.strictEqual(snapshot.sizeChartSnapshot.rows[0].bust, '92')
  assert.strictEqual(snapshot.sizeChartSnapshot.rows[0].confirmedByUser, true)
  assert.strictEqual(snapshot.modules.length, snapshot.contentSnapshot.length)
  assert.ok(['moduleId', 'moduleType', 'title', 'subtitle', 'content', 'assetIds', 'layout', 'visible', 'sortOrder', 'dataSource', 'confirmedByUser'].every((key) => Object.prototype.hasOwnProperty.call(snapshot.modules[0], key)))
  const switched = contract.buildDetailPageSnapshot({ ...draft, templateId: 'brand_quality' })
  assert.strictEqual(switched.modules[0].content, snapshot.modules[0].content)
  assert.strictEqual(switched.modules[0].assetIds[0], snapshot.modules[0].assetIds[0])
  const draftRecord = detailPages.saveDetailPageDraft(snapshot)
  const firstVersion = detailPages.createDetailPageVersion({ ...snapshot, detailPageId: draftRecord.detailPageId })
  const secondVersion = detailPages.createDetailPageVersion({ ...switched, detailPageId: draftRecord.detailPageId })
  assert.notStrictEqual(firstVersion.detailPageVersionId, secondVersion.detailPageVersionId)
  detailPages.completeDetailPageVersion(firstVersion.detailPageVersionId, { renderedAssetIds: ['asset_long_1'], previewUrl: 'cloud://long-1.jpg' })
  const versions = detailPages.listDetailPageVersions(draftRecord.detailPageId)
  assert.strictEqual(versions.length, 2)
  assert.strictEqual(versions.find((item) => item.detailPageVersionId === firstVersion.detailPageVersionId).renderedAssetIds[0], 'asset_long_1')
  assert.strictEqual(versions.find((item) => item.detailPageVersionId === secondVersion.detailPageVersionId).status, 'rendering')
  const allModules = contract.createDetailPageModules().map((item, index) => ({ ...item, enabled: true, order: index, text: '真实商品内容', fileId: 'cloud://source.jpg' }))
  const renderedSegments = rendererRuntime.buildVerticalSegments(allModules, draft.sizeRows, 2600, contract.DETAIL_PAGE_TEMPLATES[0], 1200)
  assert.ok(renderedSegments.length > 1)
  assert.ok(renderedSegments.every((segment) => segment.width === 1200 && segment.height <= 2600))
  assert.strictEqual(renderedSegments.reduce((sum, segment) => sum + segment.modules.length, 0), 12)

  assert.strictEqual(contract.isLegacyInvalidDetailPageTask({ taskType: 'detail_long_image', status: 'completed' }), true)
  assert.strictEqual(contract.isLegacyInvalidDetailPageTask({
    taskType: 'detail_page_long_image',
    result: { meta: { renderer: 'deterministic_canvas' } }
  }), false)

  const renderer = read('utils/detail-page/detailPageRenderer.js')
  const task = read('utils/detail-page/detailPageTask.js')
  const page = read('package-ai/detail-long-image/detail-long-image.vue')
  const repository = read('utils/detail-page/detailPageRepository.js')
  const contractSource = read('utils/detail-page/detailPageContract.js')
  assert.ok(renderer.includes('buildVerticalSegments'))
  assert.ok(renderer.includes('drawImageContain'))
  assert.ok(renderer.includes('drawImageCover'))
  assert.ok(renderer.includes('getVisibleSizeFields'))
  assert.ok(!renderer.includes('four-grid'))
  assert.ok(!task.includes('createTaskAndRun'))
  assert.ok(!task.includes('generate_wanx'))
  assert.ok(task.indexOf('await uploadImage') < task.indexOf("status: 'completed'"))
  assert.ok(page.includes('预览图就是正式保存的排版结果，不调用通用生图模型'))
  assert.ok(page.includes('请核对录入结果后确认'))
  assert.ok(page.includes('uni.canvasToTempFilePath'))
  assert.ok(page.includes('DETAIL_PAGE_MAX_ASSETS'))
  assert.ok(page.includes('DETAIL_PAGE_TEMPLATES'))
  assert.ok(page.includes('DETAIL_PAGE_PLATFORMS'))
  assert.ok(page.includes('createDetailPageVersion(snapshot)'))
  assert.ok(page.includes('startDetailPageRenderJob(task.taskId, [...this.previewPaths]'))
  assert.ok(page.indexOf('createDetailPageRenderTask(snapshot') < page.indexOf('url: `/package-ai/result/result?taskId='))
  assert.ok(page.includes('detailPageId=${encodeURIComponent(version.detailPageId)}'))
  assert.ok(page.includes("const LEGACY_DRAFT_KEY = 'detail_page_long_image_draft_v1'"))
  assert.ok(!page.includes('快速生成模式'))
  assert.ok(!page.includes('创意生成模式'))
  assert.ok(contractSource.includes('DETAIL_PAGE_MAX_ASSETS = 12'))
  assert.strictEqual((contractSource.match(/description: '/g) || []).length, 12)
  assert.ok(repository.includes('DETAIL_PAGE_VERSION_STORAGE_KEY'))
  assert.ok(repository.includes('renderedAssetIds'))
  assert.ok(repository.includes('getDetailPageByTaskId'))
  assert.ok(repository.includes('renderStatus'))
  assert.ok(repository.includes('renderProgress'))
  assert.ok(repository.includes('coverAssetId'))
  assert.ok(repository.indexOf("status: 'completed'") > repository.indexOf("if (!renderedAssetIds.length)"))
  console.log('DETAIL_PAGE_RENDERER_SMOKE_OK templates=3 modules=12 deterministic=1 size_confirmed=1 immutable_versions=1 auto_persist=1')
}

try {
  run()
} catch (error) {
  console.error(error.stack || error.message || error)
  process.exitCode = 1
}
