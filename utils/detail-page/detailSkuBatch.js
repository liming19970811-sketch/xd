import { buildDetailPageSnapshot, createDetailPageModules, DETAIL_PAGE_TEMPLATES, DETAIL_PAGE_PLATFORMS } from './detailPageContract'
import { buildVerticalSegments } from './detailPageRenderer'
import { createDetailPageRenderTask, startDetailPageRenderJob } from './detailPageTask'
import { createBatchRecord, attachBatchTask, getBatch } from '../task/batchTask'
import { getBatchDetail } from '../task/batchRepository'
import { buildProductProfileSnapshot } from '../product/productProfileRepository'
import { getProductSku, getSkuGroup, saveProductSku, saveSkuBatch, validateSkuForRender } from '../product/productSkuRepository'

function text(value = '') { return String(value || '').trim() }
function clone(value, fallback) { try { return JSON.parse(JSON.stringify(value)) } catch (error) { return fallback } }
function valueOf(field) { return field && typeof field === 'object' ? text(field.value) : text(field) }

const MODULE_TEXT = Object.freeze({
  hero: (profile, sku) => [valueOf(profile.productName), sku.colorName, valueOf(profile.sellingPoints)].filter(Boolean).join(' · '),
  fit: (profile) => [valueOf(profile.fitType), valueOf(profile.neckType), valueOf(profile.sleeveType), valueOf(profile.garmentLength)].filter(Boolean).join('；'),
  fabric: (profile) => [valueOf(profile.fabricComposition), valueOf(profile.fabricDescription)].filter(Boolean).join('；'),
  craft: (profile) => [valueOf(profile.craftsmanship), valueOf(profile.decoration)].filter(Boolean).join('；'),
  selling_points: (profile, sku) => [valueOf(profile.sellingPoints), text((sku.skuSpecificFacts || {}).sellingPoints)].filter(Boolean).join('；'),
  product_info: (profile, sku) => [`SKU：${sku.skuCode}`, `颜色：${sku.colorName} ${sku.colorHex}`, valueOf(profile.category), valueOf(profile.season)].filter(Boolean).join('；'),
  care: (profile) => valueOf(profile.careInstruction)
})

function assetForModule(sku = {}, module = {}) {
  const assets = Array.isArray(sku.assets) ? sku.assets : []
  const exact = assets.find((item) => item.usage === module.preferredUsage)
  if (exact) return exact
  if (module.id === 'hero') return assets.find((item) => item.usage === 'product_main') || null
  if (module.id === 'flat_display') return assets.find((item) => ['flat_front', 'flat_back', 'product_main'].includes(item.usage)) || null
  if (module.id === 'craft') return assets.find((item) => /detail$/.test(item.usage)) || null
  return null
}

export function buildSkuDetailDraft(options = {}) {
  const group = options.group || getSkuGroup(options.skuGroupId)
  const sku = options.sku || getProductSku(options.skuId)
  if (!group || !sku || sku.skuGroupId !== group.skuGroupId) throw new Error('SKU与商品分组不匹配')
  const check = validateSkuForRender(sku, group)
  if (!check.ok) throw new Error(check.errors[0])
  const profileBundle = buildProductProfileSnapshot(group.productId, group.sharedProfileVersion)
  if (!profileBundle) throw new Error('商品档案版本不存在')
  const profile = profileBundle.profile || check.profileVersion || check.profile
  const chart = profileBundle.sizeChart || check.sizeChart
  const selectedIds = new Set((options.moduleIds && options.moduleIds.length ? options.moduleIds : group.sharedModules).map((item) => typeof item === 'string' ? item : item.id))
  selectedIds.add('hero')
  const modules = createDetailPageModules().map((module, index) => {
    const selected = selectedIds.has(module.id)
    const asset = assetForModule(sku, module)
    const content = MODULE_TEXT[module.id] ? MODULE_TEXT[module.id](profile, sku) : ''
    return {
      ...module,
      enabled: selected,
      visible: selected,
      order: index,
      sortOrder: index,
      text: content,
      content,
      assetId: (asset && asset.assetId) || '',
      fileId: (asset && asset.fileId) || '',
      fileUrl: (asset && asset.fileId) || '',
      imageSource: 'original_upload',
      sourceConfirmed: Boolean(asset ? sku.assetColorConfirmed && sku.styleConfirmed : true)
    }
  })
  const sizeRows = chart && chart.confirmed
    ? (chart.rows || []).map((row) => ({ ...row, unit: chart.unit, measurementNote: chart.measurementNotes, source: 'imported', confirmedByUser: true }))
    : []
  const primaryAsset = sku.assets.find((item) => item.usage === 'product_main')
  const template = DETAIL_PAGE_TEMPLATES.find((item) => item.id === (options.templateId || group.templateId)) || DETAIL_PAGE_TEMPLATES[0]
  const platform = DETAIL_PAGE_PLATFORMS.find((item) => item.id === (options.platformId || group.platformId)) || DETAIL_PAGE_PLATFORMS[0]
  const detailPageId = `detail_${group.skuGroupId}_${sku.skuId}`
  const contentSnapshotId = `snapshot_${group.sharedProfileVersion}_${sku.skuId}_${Date.now()}`
  return {
    detailPageId,
    productId: group.productId,
    productProfileVersion: group.sharedProfileVersion,
    productProfileSnapshot: clone(profileBundle, null),
    sizeChartId: (chart && chart.sizeChartId) || '',
    contentSnapshotId,
    primaryAsset,
    assets: sku.assets,
    modules,
    sizeRows,
    sizeUnit: (chart && chart.unit) || 'cm',
    measurementNote: (chart && chart.measurementNotes) || '',
    templateId: template.id,
    platformId: platform.id,
    productFacts: [
      { fieldId: 'productName', value: valueOf(profile.productName), confirmedByUser: true },
      { fieldId: 'skuCode', value: sku.skuCode, confirmedByUser: true },
      { fieldId: 'colorName', value: sku.colorName, confirmedByUser: true },
      { fieldId: 'colorHex', value: sku.colorHex, confirmedByUser: true }
    ],
    confirmationStatus: 'confirmed',
    unresolvedFields: [],
    contentVersion: 1,
    skuGroupId: group.skuGroupId,
    skuId: sku.skuId,
    skuCode: sku.skuCode,
    colorName: sku.colorName,
    colorHex: sku.colorHex
  }
}

export function prepareSkuRender(options = {}) {
  const draft = buildSkuDetailDraft(options)
  const snapshot = buildDetailPageSnapshot(draft)
  Object.assign(snapshot, {
    skuGroupId: draft.skuGroupId,
    skuId: draft.skuId,
    skuCode: draft.skuCode,
    colorName: draft.colorName,
    colorHex: draft.colorHex
  })
  const template = DETAIL_PAGE_TEMPLATES.find((item) => item.id === snapshot.templateId) || DETAIL_PAGE_TEMPLATES[0]
  const segments = buildVerticalSegments(snapshot.contentSnapshot, snapshot.sizeChartSnapshot.rows, snapshot.render.maxSegmentHeight, template, snapshot.width)
  return { draft, snapshot, segments, expectedOutputCount: segments.length }
}

export function createSkuRenderBatch(options = {}) {
  const skuIds = Array.from(new Set((options.skuIds || []).map(text).filter(Boolean)))
  if (!skuIds.length) throw new Error('请至少选择一个SKU')
  const group = getSkuGroup(options.skuGroupId)
  if (!group) throw new Error('SKU分组不存在或无权访问')
  const prepared = skuIds.map((skuId) => prepareSkuRender({ ...options, group, skuId }))
  const expectedOutputCount = prepared.reduce((sum, item) => sum + item.expectedOutputCount, 0)
  const batch = createBatchRecord({
    totalCount: prepared.length,
    batchConfig: { modelCount: prepared.length, colorCount: 1, sceneCount: 1 },
    metadata: {
      batchType: 'detail_sku_batch',
      productId: group.productId,
      skuGroupId: group.skuGroupId,
      sharedProfileVersion: group.sharedProfileVersion,
      expectedOutputCount,
      completedOutputCount: 0,
      failedOutputCount: 0,
      selectedSkuIds: skuIds,
      quotaMode: 'no_ai_generation_quota'
    }
  })
  const children = prepared.map((entry) => {
    const task = createDetailPageRenderTask(entry.snapshot, {
      batchId: batch.batchId,
      skuGroupId: group.skuGroupId,
      skuId: entry.snapshot.skuId,
      skuCode: entry.snapshot.skuCode,
      colorName: entry.snapshot.colorName,
      colorHex: entry.snapshot.colorHex,
      expectedOutputCount: entry.expectedOutputCount,
      primaryAsset: entry.draft.primaryAsset,
      sourceAssets: entry.draft.assets,
      idempotencyKey: `${batch.batchId}:${entry.snapshot.skuId}:detail-render:v1`
    })
    attachBatchTask(batch.batchId, task.taskId)
    saveProductSku({
      ...getProductSku(entry.snapshot.skuId),
      renderTaskId: task.taskId,
      workId: task.workId,
      batchId: batch.batchId,
      status: 'rendering'
    })
    return { ...entry, taskId: task.taskId, workId: task.workId }
  })
  saveSkuBatch({
    batchId: batch.batchId,
    skuGroupId: group.skuGroupId,
    productId: group.productId,
    selectedSkuIds: skuIds,
    childTaskIds: children.map((item) => item.taskId),
    childWorkIds: children.map((item) => item.workId),
    expectedOutputCount,
    completedOutputCount: 0,
    failedOutputCount: 0,
    status: 'rendering',
    templateId: options.templateId || group.templateId,
    platformId: options.platformId || group.platformId,
    contentSnapshots: children.map((item) => ({ skuId: item.snapshot.skuId, contentSnapshotId: item.snapshot.contentSnapshotId, snapshot: item.snapshot }))
  })
  return { batchId: batch.batchId, group, children, expectedOutputCount }
}

export function startSkuRenderChild(child = {}, tempPaths = []) {
  return startDetailPageRenderJob(child.taskId, tempPaths, { detailPageId: child.snapshot.detailPageId })
    .then((task) => {
      saveProductSku({ ...getProductSku(child.snapshot.skuId), status: 'completed', renderedAssetIds: task.assetIds || [] })
      return task
    })
    .catch((error) => {
      saveProductSku({ ...getProductSku(child.snapshot.skuId), status: 'failed' })
      throw error
    })
}

export function getSkuRenderBatchDetail(batchId = '') {
  const batch = getBatch(batchId)
  const detail = getBatchDetail(batchId)
  const children = (detail.tasks || []).map((task) => {
    const params = ((task.input || {}).params || {})
    return { task, sku: getProductSku(params.skuId), params }
  })
  const completedOutputCount = children.reduce((sum, item) => sum + (Array.isArray((item.task.result || {}).items) ? item.task.result.items.length : 0), 0)
  const failedOutputCount = children.reduce((sum, item) => sum + (['failed', 'result_missing'].includes(item.task.status) ? Math.max(1, Number(item.task.failedOutputCount) || 1) : 0), 0)
  const terminalCount = children.filter((item) => ['completed', 'failed', 'result_missing', 'cancelled'].includes(item.task.status)).length
  const status = terminalCount < children.length ? (completedOutputCount ? 'partial_success' : 'rendering') : (failedOutputCount ? (completedOutputCount ? 'partial_success' : 'failed') : 'completed')
  const stored = saveSkuBatch({
    ...(batch || {}),
    batchId,
    completedOutputCount,
    failedOutputCount,
    status
  })
  return { ...detail, batch: { ...(detail.batch || batch || {}), ...stored }, children }
}
