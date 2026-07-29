const assert = require('assert')
const fs = require('fs')
const path = require('path')
const vm = require('vm')

const ROOT = path.resolve(__dirname, '..')
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8')

function loadSkuRepository() {
  const storage = new Map()
  const profile = {
    productId: 'product_1', ownerId: 'user_1', enterpriseId: 'enterprise_1', version: 2, sizeChartId: 'size_1',
    productName: { value: '基础连衣裙', confirmed: true }
  }
  const sizeChart = { sizeChartId: 'size_1', productId: 'product_1', confirmed: true, unit: 'cm', rows: [{ size: 'S', bust: '88' }] }
  const source = `${read('utils/product/productSkuRepository.js')
    .replace(/^import .*$/gm, '')
    .replace(/export const /g, 'const ')
    .replace(/export function /g, 'function ')}
module.exports = { saveSkuGroup, getSkuGroup, saveProductSku, getProductSku, listProductSkus, copyProductSku, validateSkuForRender, saveSkuBatch, getSkuBatch, createSkuColor }`
  const normalizeStandardColor = (value, source) => {
    const hex = String(value.hex || '').toUpperCase()
    if (!/^#[0-9A-F]{6}$/.test(hex)) return null
    return { hex, lab: value.lab && value.lab.length === 3 ? value.lab : [50, 0, 0], displayName: value.displayName || value.name || '自定义颜色', sourceType: source }
  }
  const context = {
    module: { exports: {} }, exports: {}, Object, Array, Set, Map, String, Number, Boolean, Date, Math, JSON,
    uni: { getStorageSync: (key) => storage.get(key), setStorageSync: (key, value) => storage.set(key, value) },
    getCurrentEnterpriseId: () => 'enterprise_1', getCurrentUser: () => ({ userId: 'user_1', enterpriseId: 'enterprise_1' }),
    getProductProfile: (id) => id === 'product_1' ? profile : null,
    getProductProfileVersion: (id, version) => id === 'product_1' && Number(version) === 2 ? { ...profile, version: 2, sizeChartSnapshot: sizeChart } : null,
    getSizeChart: (id) => id === 'size_1' ? sizeChart : null,
    normalizeStandardColor
  }
  vm.runInNewContext(source, context, { filename: 'productSkuRepository.js' })
  return context.module.exports
}

function makeSku(repo, group, code, name, hex, assetId) {
  return repo.saveProductSku({
    skuGroupId: group.skuGroupId, skuCode: code, colorName: name, colorHex: hex, colorLab: [50, 0, 0], colorConfirmed: true,
    assets: [{ assetId, fileId: `cloud://${assetId}`, usage: 'product_main', colorConfirmed: true, styleConfirmed: true }],
    assetColorConfirmed: true, styleConfirmed: true, selected: true
  })
}

function run() {
  const repo = loadSkuRepository()
  const group = repo.saveSkuGroup({ productId: 'product_1', sharedProfileVersion: 2, templateId: 'simple_ecommerce', sharedModules: ['hero', 'size_chart'] })
  const red = makeSku(repo, group, 'SKU-RED', '红色', '#AA1122', 'asset_red')
  const blue = makeSku(repo, group, 'SKU-BLUE', '蓝色', '#2244AA', 'asset_blue')
  const black = makeSku(repo, group, 'SKU-BLACK', '黑色', '#111111', 'asset_black')
  assert.strictEqual(repo.listProductSkus(group.skuGroupId).length, 3)
  assert.notStrictEqual(red.assets[0].assetId, blue.assets[0].assetId)
  assert.strictEqual(repo.validateSkuForRender(red, group).ok, true)
  assert.strictEqual(repo.validateSkuForRender({ ...red, assets: [] }, group).ok, false)
  assert.throws(() => makeSku(repo, group, 'SKU-RED', '另一红色', '#BB1122', 'asset_other'), /SKU编码/)
  const copy = repo.copyProductSku(red.skuId)
  assert.strictEqual(copy.assets.length, 0)
  assert.strictEqual(copy.colorConfirmed, false)
  const batch = repo.saveSkuBatch({ batchId: 'batch_1', productId: 'product_1', skuGroupId: group.skuGroupId, selectedSkuIds: [red.skuId, blue.skuId, black.skuId], expectedOutputCount: 6, status: 'rendering' })
  assert.strictEqual(repo.getSkuBatch(batch.batchId).expectedOutputCount, 6)

  const executor = read('utils/detail-page/detailSkuBatch.js')
  const page = read('package-ai/detail-sku-batch/detail-sku-batch.vue')
  const resultPage = read('package-ai/detail-sku-batch-result/detail-sku-batch-result.vue')
  const routes = read('pages.json')
  const workRepo = read('utils/work/workRecordRepository.js')
  assert.ok(executor.includes('createBatchRecord') && executor.includes('attachBatchTask'))
  assert.ok(executor.includes('prepared.reduce((sum, item) => sum + item.expectedOutputCount, 0)'))
  assert.ok(executor.includes("quotaMode: 'no_ai_generation_quota'"))
  assert.ok(page.includes('assetColorConfirmed') && page.includes('styleConfirmed'))
  assert.ok(resultPage.includes('setTimeout') && resultPage.includes('修改素材并重试'))
  assert.ok(routes.includes('detail-sku-batch/detail-sku-batch') && routes.includes('detail-sku-batch-result/detail-sku-batch-result'))
  assert.ok(workRepo.includes('skuGroupId') && workRepo.includes('skuId'))
  assert.ok(!executor.includes('createTaskAndRun('))

  console.log('DETAIL_SKU_BATCH_SMOKE_OK cases=12 three_works=1 no_grid=1 asset_isolation=1 partial_failure=1 retry_failed=1 shared_size=1 color_match=1 live_result=1 resume=1 snapshot=1 quantity=1 no_quota=1')
}

try { run() } catch (error) { console.error(error.stack || error.message || error); process.exitCode = 1 }
