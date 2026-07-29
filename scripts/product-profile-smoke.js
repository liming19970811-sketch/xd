const assert = require('assert')
const fs = require('fs')
const path = require('path')
const vm = require('vm')

const ROOT = path.resolve(__dirname, '..')
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8')

function loadRepository() {
  const storage = new Map()
  const source = `${read('utils/product/productProfileRepository.js')
    .replace(/^import .*$/gm, '')
    .replace(/export const /g, 'const ')
    .replace(/export function /g, 'function ')}
module.exports = { PRODUCT_PROFILE_FIELD_DEFINITIONS, createProfileField, saveProductProfile, getProductProfile, createProductProfileVersion, listProductProfileVersions, copyProductProfile, saveSizeChart, getSizeChart, createSizeChartOcrDraft, validateSizeChart, confirmSizeChart, convertSizeChartUnit, buildProductProfileSnapshot, validateProductProfileForDetail, restoreProductProfileVersion }`
  const context = {
    module: { exports: {} }, exports: {}, Object, Array, Set, Map, String, Number, Boolean, Date, Math, JSON,
    uni: { getStorageSync: (key) => storage.get(key), setStorageSync: (key, value) => storage.set(key, value) },
    getCurrentEnterpriseId: () => 'enterprise_1',
    getCurrentUser: () => ({ userId: 'user_1', enterpriseId: 'enterprise_1' })
  }
  vm.runInNewContext(source, context, { filename: 'productProfileRepository.js' })
  return context.module.exports
}

function run() {
  const repo = loadRepository()
  const confirmed = (value, source = 'manual') => repo.createProfileField(value, { source, confirmed: true })
  const pending = (value, source = 'ai_detected') => repo.createProfileField(value, { source, confidence: 0.62, confirmed: false })

  let profileA = repo.saveProductProfile({
    productName: confirmed('商品A'), productCode: confirmed('A001'), category: confirmed('连衣裙'),
    fitType: confirmed('A型'), fabricComposition: pending('棉混纺'), colorName: confirmed('黑色'), colorHex: confirmed('#111111'),
    sourceAssetIds: ['asset_a']
  })
  const columns = [{ key: 'size', label: '尺码', type: 'text' }, { key: 'bust', label: '胸围', type: 'number' }, { key: 'garmentLength', label: '衣长', type: 'number' }]
  let chartA = repo.createSizeChartOcrDraft({ productId: profileA.productId, sourceImageAssetId: 'asset_size_a', unit: 'cm', ocrRawData: { columns, rows: [{ size: 'S', bust: '88', garmentLength: '82' }, { size: 'M', bust: '92', garmentLength: '84' }] } })
  assert.strictEqual(chartA.ocrStatus, 'recognized_needs_confirmation')
  chartA.rows[0].bust = '89'
  chartA = repo.saveSizeChart(chartA)
  assert.strictEqual(repo.getSizeChart(chartA.sizeChartId).rows[0].bust, '89')
  assert.strictEqual(repo.validateSizeChart(chartA, profileA.productId).ok, false)
  chartA = repo.confirmSizeChart(chartA.sizeChartId, profileA.productId)
  assert.strictEqual(repo.validateSizeChart(chartA, profileA.productId).ok, true)

  const emptyOcr = repo.createSizeChartOcrDraft({ productId: profileA.productId, sourceImageAssetId: 'asset_empty', ocrRawData: null })
  assert.strictEqual(emptyOcr.rows.length, 0)
  assert.strictEqual(emptyOcr.ocrStatus, 'unavailable_needs_manual_entry')

  profileA = repo.saveProductProfile({ ...profileA, sizeChartId: chartA.sizeChartId })
  const version1 = repo.createProductProfileVersion(profileA.productId).version
  const profileB = repo.saveProductProfile({ productName: confirmed('商品B') })
  assert.strictEqual(repo.validateSizeChart(chartA, profileB.productId).ok, false)

  const colorVariant = repo.copyProductProfile(profileA.productId, { colorVariant: true })
  assert.notStrictEqual(colorVariant.productId, profileA.productId)
  assert.strictEqual(colorVariant.fitType.value, 'A型')
  assert.strictEqual(colorVariant.colorName.value, '')
  assert.strictEqual(colorVariant.sourceAssetIds.length, 0)
  assert.strictEqual(repo.getSizeChart(colorVariant.sizeChartId).productId, colorVariant.productId)

  const changed = repo.saveProductProfile({ ...profileA, productName: confirmed('商品A改名') })
  const historical = repo.buildProductProfileSnapshot(profileA.productId, version1.version)
  assert.strictEqual(historical.profile.productName.value, '商品A')
  assert.strictEqual(changed.productName.value, '商品A改名')

  const inches = repo.convertSizeChartUnit(chartA, 'inch')
  assert.strictEqual(inches.unit, 'inch')
  assert.strictEqual(inches.rows[0].bust, '35')
  assert.strictEqual(inches.confirmed, false)

  assert.strictEqual(profileA.fabricComposition.confirmed, false)
  assert.ok(profileA.unconfirmedFields.includes('fabricComposition'))

  const detailBlocked = repo.validateProductProfileForDetail(profileA.productId, version1.version, { requireSizeChart: true })
  assert.strictEqual(detailBlocked.ok, false)
  const confirmedProfile = repo.saveProductProfile({ ...changed, fabricComposition: confirmed('棉 65%，聚酯纤维 35%') })
  const version2 = repo.createProductProfileVersion(confirmedProfile.productId).version
  assert.strictEqual(repo.validateProductProfileForDetail(confirmedProfile.productId, version2.version, { requireSizeChart: true }).ok, true)

  const copied = repo.copyProductProfile(confirmedProfile.productId)
  assert.notStrictEqual(copied.productId, confirmedProfile.productId)
  const restored = repo.restoreProductProfileVersion(confirmedProfile.productId, version1.version)
  assert.ok(restored.version.version > version2.version)
  assert.ok(repo.listProductProfileVersions(confirmedProfile.productId).length >= 3)

  const detailPage = read('package-ai/detail-long-image/detail-long-image.vue')
  const task = read('utils/detail-page/detailPageTask.js')
  const workRecord = read('utils/work/workRecordRepository.js')
  assert.ok(detailPage.includes('validateProductProfileForDetail'))
  assert.ok(detailPage.includes('buildProductProfileSnapshot(this.productId, this.productProfileVersion)'))
  assert.ok(task.includes('productProfileSnapshot: snapshot.productProfileSnapshot'))
  assert.ok(workRecord.includes('contentSnapshotId'))
  assert.ok(workRecord.includes('sizeChartId'))

  console.log('PRODUCT_PROFILE_SMOKE_OK cases=12 ocr_edit=1 confirm_guard=1 no_random=1 isolation=1 color_variant=1 immutable=1 unit=1 ai_pending=1 detail_read=1 copy=1 versions=1 work_link=1')
}

try { run() } catch (error) { console.error(error.stack || error.message || error); process.exitCode = 1 }
