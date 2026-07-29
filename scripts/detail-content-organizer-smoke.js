const assert = require('assert')
const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8')
}

async function loadModule(relativePath) {
  const source = read(relativePath)
  return import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`)
}

async function run() {
  const organizer = await loadModule('utils/detail-page/detailContentOrganizer.js')
  assert.strictEqual(organizer.DETAIL_ASSET_TYPES.length, 13)
  const assets = [
    { assetId: 'main', fileId: 'cloud://main.jpg', usage: 'product_main', usageConfirmed: true },
    { assetId: 'model', fileId: 'cloud://model-look.jpg', fileName: 'model-look.jpg', usage: 'other' },
    { assetId: 'flat', fileId: 'cloud://flat-front.jpg', fileName: 'flat-front.jpg', usage: 'other' },
    { assetId: 'chain', fileId: 'cloud://metal-chain.jpg', fileName: 'metal-chain.jpg', usage: 'other' }
  ]
  const first = organizer.organizeDetailContent({
    assets,
    productFacts: { productName: '链条连衣裙', category: '连衣裙', color: '黑色', sellingPoints: '金属链条装饰,流畅廓形' },
    sizeRows: []
  })
  assert.strictEqual(first.contentVersion, 1)
  assert.strictEqual(first.assetClassifications.find((item) => item.assetId === 'model').assetType, 'model_display')
  assert.strictEqual(first.assetClassifications.find((item) => item.assetId === 'flat').assetType, 'flat_front')
  const chain = first.assetClassifications.find((item) => item.assetId === 'chain')
  assert.strictEqual(chain.assetType, 'hardware_detail')
  assert.ok(chain.detectedDetails.join(' ').includes('金属链条'))
  assert.ok(!JSON.stringify(first).includes('白色包边'))
  assert.ok(!first.recommendedModuleIds.includes('size_chart'))
  assert.ok(!first.recommendedModuleIds.includes('fabric'))
  assert.ok(first.unresolvedFields.some((item) => item.fieldId === 'materialComposition' && item.risk === 'high'))
  assert.ok(!first.generatedCopy.some((item) => item.copyId === 'fabric_description'))

  const manuallyEditedCopy = first.generatedCopy.map((item) => item.copyId === 'product_title'
    ? { ...item, content: '用户确认的标题', userEdited: true }
    : item)
  const confirmedAssets = first.assetClassifications.map((item) => ({ ...item, confidence: 1, userConfirmed: true, sourceType: 'user_confirmed' }))
  const second = organizer.organizeDetailContent({
    assets,
    productFacts: { productName: '链条连衣裙', category: '连衣裙', color: '黑色', sellingPoints: '金属链条装饰,流畅廓形' },
    sizeRows: []
  }, { ...first, assetClassifications: confirmedAssets, generatedCopy: manuallyEditedCopy })
  assert.strictEqual(second.contentVersion, 2)
  assert.strictEqual(second.generatedCopy.find((item) => item.copyId === 'product_title').content, '用户确认的标题')
  assert.ok(second.recommendedModuleIds.includes('model_display'))
  assert.ok(second.recommendedModuleIds.includes('flat_display'))
  assert.ok(second.recommendedModuleIds.includes('craft'))
  assert.strictEqual(organizer.validateOrganizationForRender(second).ok, true)
  assert.strictEqual(organizer.validateOrganizationForRender(first).ok, false)

  const page = read('package-ai/detail-long-image/detail-long-image.vue')
  const contract = read('utils/detail-page/detailPageContract.js')
  const task = read('utils/detail-page/detailPageTask.js')
  assert.ok(page.includes('AI整理结果'))
  assert.ok(page.includes('采用AI整理'))
  assert.ok(page.includes('重新整理'))
  assert.ok(page.includes('contentVersions'))
  assert.ok(contract.includes('assetClassifications'))
  assert.ok(contract.includes('generatedCopy'))
  assert.ok(task.includes('contentVersion: snapshot.contentVersion'))
  assert.ok(!task.includes('createTaskAndRun'))
  console.log('DETAIL_CONTENT_ORGANIZER_SMOKE_OK classifications=13 safe_facts=1 manual_preserved=1 no_fake_size=1 no_fake_images=1')
}

run().catch((error) => {
  console.error(error.stack || error.message || error)
  process.exitCode = 1
})
