import { getCurrentEnterpriseId } from '../tenant/tenantContext'
import { getCurrentUser } from '../user/userRepository'
import { getProductProfile, getProductProfileVersion, getSizeChart } from './productProfileRepository'
import { normalizeStandardColor } from '../color/colorPicker'

export const SKU_GROUP_STORAGE_KEY = 'diebiandesign_product_sku_groups_v1'
export const PRODUCT_SKU_STORAGE_KEY = 'diebiandesign_product_skus_v1'
export const SKU_BATCH_STORAGE_KEY = 'diebiandesign_detail_sku_batches_v1'

function text(value = '') { return String(value || '').trim() }
function nowIso() { return new Date().toISOString() }
function id(prefix) { return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}` }
function clone(value, fallback) { try { return JSON.parse(JSON.stringify(value)) } catch (error) { return fallback } }
function read(key) { try { const value = uni.getStorageSync(key); return Array.isArray(value) ? value : [] } catch (error) { return [] } }
function write(key, value) { uni.setStorageSync(key, Array.isArray(value) ? value : []) }

function scope() {
  const user = getCurrentUser()
  return {
    ownerId: text(user.userId || user.openId || user.openid),
    enterpriseId: text(user.enterpriseId) || text(getCurrentEnterpriseId())
  }
}

function allowed(record = {}) {
  const current = scope()
  return Boolean(current.ownerId && record.ownerId === current.ownerId && record.enterpriseId === current.enterpriseId)
}

function normalizeAsset(asset = {}, fallbackUsage = 'product_main') {
  const fileId = text(asset.fileId || asset.fileID || asset.fileUrl || asset.url)
  if (!fileId) return null
  return {
    assetId: text(asset.assetId) || `asset_${fileId}`,
    fileId,
    usage: text(asset.usage) || fallbackUsage,
    source: text(asset.source) || 'manual_upload',
    skuId: text(asset.skuId),
    shared: asset.shared === true,
    colorConfirmed: asset.colorConfirmed === true,
    styleConfirmed: asset.styleConfirmed === true,
    createdAt: text(asset.createdAt) || nowIso()
  }
}

export function createSkuColor(value = {}, source = 'manual') {
  const normalized = normalizeStandardColor(value, source)
  if (!normalized) return { colorName: '', colorHex: '', colorLab: [], colorSource: source, colorConfirmed: false }
  return {
    colorName: text(value.colorName || value.displayName || value.name || normalized.displayName),
    colorHex: normalized.hex,
    colorLab: [...normalized.lab],
    colorSource: text(source || normalized.sourceType),
    colorConfirmed: value.colorConfirmed === true
  }
}

export function saveSkuGroup(input = {}) {
  const records = read(SKU_GROUP_STORAGE_KEY)
  const requestedId = text(input.skuGroupId)
  const previous = requestedId ? records.find((item) => item.skuGroupId === requestedId && allowed(item)) : null
  const profile = getProductProfile(input.productId || (previous || {}).productId)
  if (!profile) throw new Error('商品档案不存在或无权访问')
  const current = scope()
  const group = {
    skuGroupId: text((previous || {}).skuGroupId || input.skuGroupId) || id('sku_group'),
    productId: profile.productId,
    ownerId: current.ownerId,
    enterpriseId: current.enterpriseId,
    sharedProfileVersion: Math.max(1, Number(input.sharedProfileVersion || profile.version || (previous || {}).sharedProfileVersion) || 1),
    templateId: text(input.templateId || (previous || {}).templateId) || 'simple_ecommerce',
    platformId: text(input.platformId || (previous || {}).platformId) || 'taobao',
    sharedModules: clone(input.sharedModules || (previous || {}).sharedModules || [], []),
    sharedAssetIds: Array.from(new Set((input.sharedAssetIds || (previous || {}).sharedAssetIds || []).map(text).filter(Boolean))),
    pendingAssets: (input.pendingAssets || (previous || {}).pendingAssets || []).map((item) => normalizeAsset(item)).filter(Boolean),
    status: text(input.status || (previous || {}).status) || 'draft',
    createdAt: text((previous || {}).createdAt || input.createdAt) || nowIso(),
    updatedAt: nowIso()
  }
  write(SKU_GROUP_STORAGE_KEY, [group, ...records.filter((item) => item.skuGroupId !== group.skuGroupId)])
  return clone(group, {})
}

export function getSkuGroup(skuGroupId = '') {
  const record = read(SKU_GROUP_STORAGE_KEY).find((item) => item.skuGroupId === text(skuGroupId))
  return record && allowed(record) ? clone(record, null) : null
}

export function getSkuGroupByProduct(productId = '') {
  const record = read(SKU_GROUP_STORAGE_KEY).find((item) => item.productId === text(productId) && allowed(item))
  return record ? clone(record, null) : null
}

export function saveProductSku(input = {}) {
  const records = read(PRODUCT_SKU_STORAGE_KEY)
  const group = getSkuGroup(input.skuGroupId)
  if (!group) throw new Error('SKU分组不存在或无权访问')
  const requestedId = text(input.skuId)
  const previous = requestedId ? records.find((item) => item.skuId === requestedId && allowed(item)) : null
  const duplicated = records.find((item) => item.skuGroupId === group.skuGroupId && item.skuId !== requestedId && text(item.skuCode) === text(input.skuCode) && allowed(item))
  if (duplicated && text(input.skuCode)) throw new Error('同一商品内SKU编码不能重复')
  const current = scope()
  const color = createSkuColor({
    colorName: input.colorName || (previous || {}).colorName,
    displayName: input.colorName || (previous || {}).colorName,
    hex: input.colorHex || (previous || {}).colorHex,
    lab: input.colorLab || (previous || {}).colorLab,
    colorConfirmed: input.colorConfirmed === true
  }, input.colorSource || (previous || {}).colorSource || 'manual')
  const assets = (input.assets || (previous || {}).assets || []).map((item) => normalizeAsset({ ...item, skuId: requestedId || (previous || {}).skuId })).filter(Boolean)
  const skuId = text((previous || {}).skuId || input.skuId) || id('sku')
  const normalizedAssets = assets.map((item) => ({ ...item, skuId, shared: false }))
  const sku = {
    skuId,
    skuGroupId: group.skuGroupId,
    productId: group.productId,
    ownerId: current.ownerId,
    enterpriseId: current.enterpriseId,
    skuCode: text(input.skuCode || (previous || {}).skuCode),
    ...color,
    sourceAssetIds: normalizedAssets.map((item) => item.assetId),
    coverAssetId: text(input.coverAssetId || (previous || {}).coverAssetId) || ((normalizedAssets.find((item) => item.usage === 'product_main') || {}).assetId || ''),
    detailAssetIds: normalizedAssets.filter((item) => item.usage !== 'product_main').map((item) => item.assetId),
    assets: normalizedAssets,
    sharedProfileVersion: group.sharedProfileVersion,
    skuSpecificFacts: clone(input.skuSpecificFacts || (previous || {}).skuSpecificFacts || {}, {}),
    templateId: text(input.templateId || (previous || {}).templateId || group.templateId),
    renderTaskId: text(input.renderTaskId || (previous || {}).renderTaskId),
    workId: text(input.workId || (previous || {}).workId),
    batchId: text(input.batchId || (previous || {}).batchId),
    status: text(input.status || (previous || {}).status) || 'draft',
    renderedAssetIds: Array.from(new Set((input.renderedAssetIds || (previous || {}).renderedAssetIds || []).map(text).filter(Boolean))),
    assetColorConfirmed: input.assetColorConfirmed === true,
    styleConfirmed: input.styleConfirmed === true,
    selected: input.selected !== false,
    createdAt: text((previous || {}).createdAt || input.createdAt) || nowIso(),
    updatedAt: nowIso()
  }
  write(PRODUCT_SKU_STORAGE_KEY, [sku, ...records.filter((item) => item.skuId !== sku.skuId)])
  return clone(sku, {})
}

export function getProductSku(skuId = '') {
  const record = read(PRODUCT_SKU_STORAGE_KEY).find((item) => item.skuId === text(skuId))
  return record && allowed(record) ? clone(record, null) : null
}

export function listProductSkus(skuGroupId = '') {
  return read(PRODUCT_SKU_STORAGE_KEY).filter((item) => item.skuGroupId === text(skuGroupId) && allowed(item)).sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt))).map((item) => clone(item, {}))
}

export function copyProductSku(skuId = '') {
  const source = getProductSku(skuId)
  if (!source) throw new Error('SKU不存在或无权访问')
  return saveProductSku({
    ...clone(source, {}),
    skuId: '',
    skuCode: '',
    colorName: '',
    colorHex: '',
    colorLab: [],
    colorConfirmed: false,
    assets: [],
    sourceAssetIds: [],
    coverAssetId: '',
    detailAssetIds: [],
    renderTaskId: '',
    workId: '',
    status: 'draft',
    renderedAssetIds: [],
    assetColorConfirmed: false
  })
}

export function validateSkuForRender(sku = {}, group = null) {
  const errors = []
  const activeGroup = group || getSkuGroup(sku.skuGroupId)
  const profile = activeGroup && getProductProfile(activeGroup.productId)
  const profileVersion = activeGroup && getProductProfileVersion(activeGroup.productId, activeGroup.sharedProfileVersion)
  const sizeChart = profileVersion && profileVersion.sizeChartSnapshot
    ? profileVersion.sizeChartSnapshot
    : (profile && profile.sizeChartId ? getSizeChart(profile.sizeChartId) : null)
  if (!activeGroup || !profile) errors.push('公共商品档案不存在')
  if (!sku.skuCode) errors.push('请填写SKU编码')
  if (!sku.colorName || !sku.colorHex || !sku.colorConfirmed) errors.push('请确认颜色名称和色值')
  if (!(sku.assets || []).some((item) => item.usage === 'product_main')) errors.push('请上传当前SKU真实主图')
  const moduleAssets = {
    model_display: ['model_display'],
    flat_display: ['flat_front', 'flat_back', 'product_main'],
    fabric: ['fabric_detail'],
    craft: ['neckline_detail', 'cuff_detail', 'hem_detail', 'hardware_detail', 'craft_detail']
  }
  ;(activeGroup && activeGroup.sharedModules || []).forEach((moduleId) => {
    const accepted = moduleAssets[typeof moduleId === 'string' ? moduleId : moduleId.id]
    if (accepted && !(sku.assets || []).some((item) => accepted.includes(item.usage))) errors.push(`所选详情模块缺少当前SKU素材：${typeof moduleId === 'string' ? moduleId : moduleId.id}`)
  })
  if (!sku.assetColorConfirmed) errors.push('请确认图片属于当前颜色SKU')
  if (!sku.styleConfirmed) errors.push('请确认SKU与公共档案为同一款式')
  if (!sizeChart || sizeChart.confirmed !== true) errors.push('公共尺码表尚未确认')
  return { ok: errors.length === 0, errors, profile, profileVersion, sizeChart }
}

export function saveSkuBatch(input = {}) {
  const records = read(SKU_BATCH_STORAGE_KEY)
  const previous = records.find((item) => item.batchId === text(input.batchId) && allowed(item)) || {}
  const current = scope()
  const record = {
    ...previous,
    ...clone(input, {}),
    batchId: text(input.batchId || previous.batchId) || id('sku_batch'),
    ownerId: current.ownerId,
    enterpriseId: current.enterpriseId,
    createdAt: text(previous.createdAt || input.createdAt) || nowIso(),
    updatedAt: nowIso()
  }
  write(SKU_BATCH_STORAGE_KEY, [record, ...records.filter((item) => item.batchId !== record.batchId)])
  return clone(record, {})
}

export function getSkuBatch(batchId = '') {
  const record = read(SKU_BATCH_STORAGE_KEY).find((item) => item.batchId === text(batchId))
  return record && allowed(record) ? clone(record, null) : null
}
