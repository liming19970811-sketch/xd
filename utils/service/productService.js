import { getById as getProductById, update as updateProduct } from '../repository/productPackageRepository.js'
import { emit } from '../events/eventBus.js'
import { PRODUCT_READY } from '../events/businessEvents.js'
import { recordAudit } from '../audit/auditService.js'

export const PRODUCT_STATUS_FLOW = Object.freeze(['draft', 'designing', 'ready_for_sale', 'published', 'delivered'])

export const PRODUCT_STATUS_LABELS = Object.freeze({
  draft: '草稿',
  designing: '设计中',
  ready_for_sale: '待上架',
  published: '已发布',
  delivered: '已交付'
})

function getCompletedAssets(product = {}) {
  const assets = Array.isArray(product.assets) ? product.assets : []
  return assets.filter((asset) => ['completed', 'success'].includes(String(asset.status || '').toLowerCase()) || asset.statusLabel === '已完成')
}

function hasAssetType(assets = [], types = []) {
  return assets.some((asset) => types.includes(asset.assetType) || types.some((type) => String(asset.title || '').includes(type)))
}

export function getProductSignals(product = {}) {
  const assets = getCompletedAssets(product)
  const detailModules = Array.isArray(product.detailModules) ? product.detailModules : []
  const hasDetailPage = hasAssetType(assets, ['detail_page', '详情页'])
  const hasMainImage = hasAssetType(assets, ['main_image', 'model_image', '商品主图', 'AI模特图']) || (hasDetailPage && detailModules.includes('main_image'))
  const hasDetailImage = hasAssetType(assets, ['flat_detail', 'detail_image', 'detail_photo', '细节图', '平铺细节图']) || (hasDetailPage && detailModules.includes('detail_image'))
  const hasProductImage = hasMainImage || hasAssetType(assets, ['flat_detail', 'poster', 'series'])
  const productInfo = product.productInfo || {}
  const hasCopy = Boolean(String(productInfo.productTitle || '').trim() && (String(productInfo.sellingPoints || '').trim() || String(productInfo.detailDescription || '').trim()))
  const hasDesign = Boolean(product.sourceDesignId || Object.keys(product.designParams || {}).length)
  const hasDelivery = Boolean(product.deliveryPackageId || product.deliveryId || ['delivery_preparing', 'delivered'].includes(product.status))
  return { hasDesign, hasProductImage, hasDetailPage, hasMainImage, hasDetailImage, hasCopy, hasDelivery }
}

export function calculateProductCompletion(product = {}) {
  const signals = getProductSignals(product)
  const items = [
    { key: 'design', label: '设计完成度', value: signals.hasDesign ? 100 : 0 },
    { key: 'material', label: '素材完成度', value: signals.hasProductImage ? 100 : 0 },
    { key: 'detail', label: '详情页完成度', value: signals.hasDetailPage ? 100 : 0 },
    { key: 'delivery', label: '交付完成度', value: signals.hasDelivery ? 100 : 0 }
  ]
  return { overall: items.filter((item) => item.value === 100).length * 25, items }
}

export function getPublishChecks(product = {}) {
  const signals = getProductSignals(product)
  return [
    !signals.hasMainImage ? '缺少主图' : '',
    !signals.hasDetailPage ? '缺少详情页' : '',
    !signals.hasDetailImage ? '缺少细节图' : '',
    !signals.hasCopy ? '缺少文案' : ''
  ].filter(Boolean)
}

export function calculateProductRisk(product = {}) {
  const signals = getProductSignals(product)
  const issues = [...getPublishChecks(product), !signals.hasDelivery ? '缺交付' : ''].filter(Boolean)
  const code = issues.length >= 3 ? 'high' : (issues.length ? 'medium' : 'low')
  return { code, level: { high: '高', medium: '中', low: '低' }[code], issues }
}

export function getProductStatus(product = {}) {
  const signals = getProductSignals(product)
  if (product.status === 'delivered') return 'delivered'
  if (PRODUCT_STATUS_FLOW.includes(product.productStatus)) return product.productStatus
  return signals.hasProductImage ? 'ready_for_sale' : ((Array.isArray(product.assets) && product.assets.length) ? 'designing' : 'draft')
}

export function transitionProductStatus(productPackageId = '', status = 'draft', patch = {}) {
  if (!productPackageId || !PRODUCT_STATUS_FLOW.includes(status)) return null
  const previous = getProductById(productPackageId)
  const nextPatch = { ...patch, productStatus: status }
  if (status === 'delivered') nextPatch.status = 'delivered'
  const product = updateProduct(productPackageId, nextPatch)
  if (product && status === 'ready_for_sale') {
    emit(PRODUCT_READY, { product, projectId: product.projectId || patch.projectId || '', before: previous, after: product })
  } else if (product && previous?.productStatus !== status) {
    recordAudit({
      enterpriseId: product.enterpriseId,
      userId: patch.updatedBy || patch.userId,
      operator: patch.operator,
      action: '更新商品状态',
      targetType: 'product',
      targetId: product.productPackageId,
      before: { productStatus: previous?.productStatus || 'draft' },
      after: { productStatus: product.productStatus }
    })
  }
  return product
}

export function buildProductDashboard(product = {}) {
  const completion = calculateProductCompletion(product)
  const risk = calculateProductRisk(product)
  const status = getProductStatus(product)
  const productInfo = product.productInfo || {}
  return {
    ...product,
    productName: productInfo.productTitle || productInfo.name || product.title || '未命名商品',
    productStatus: status,
    productStatusLabel: PRODUCT_STATUS_LABELS[status] || PRODUCT_STATUS_LABELS.draft,
    overallCompletion: completion.overall,
    productionCompletion: completion.items,
    publishIssues: getPublishChecks(product),
    riskIssues: risk.issues,
    riskCode: risk.code,
    riskLevel: risk.level
  }
}

export function getProductDashboardById(productPackageId = '') {
  const product = getProductById(productPackageId)
  return product ? buildProductDashboard(product) : null
}
