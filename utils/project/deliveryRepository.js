const DELIVERY_STORAGE_KEY = 'diebiandesign_project_deliveries'

export const DELIVERY_STATUS = Object.freeze({
  PENDING_REVIEW: 'pending_review',
  REVISING: 'revising',
  CONFIRMED: 'confirmed',
  DELIVERED: 'delivered'
})

export const DELIVERY_STATUS_OPTIONS = Object.freeze([
  { value: DELIVERY_STATUS.PENDING_REVIEW, label: '待审核' },
  { value: DELIVERY_STATUS.REVISING, label: '修改中' },
  { value: DELIVERY_STATUS.CONFIRMED, label: '已确认' },
  { value: DELIVERY_STATUS.DELIVERED, label: '已交付' }
])

function normalizeAssets(assets = []) {
  if (!Array.isArray(assets)) {
    return []
  }
  return assets.filter(Boolean).map((asset) => {
    if (typeof asset === 'string') {
      return { assetId: asset, taskId: '', url: '' }
    }
    return {
      assetId: String(asset.assetId || ''),
      taskId: String(asset.taskId || ''),
      url: String(asset.url || asset.coverUrl || '')
    }
  })
}

function normalizeStatus(status = '') {
  return DELIVERY_STATUS_OPTIONS.some((option) => option.value === status)
    ? status
    : DELIVERY_STATUS.PENDING_REVIEW
}

function normalizeDelivery(delivery = {}) {
  const now = new Date().toISOString()
  return {
    deliveryId: String(delivery.deliveryId || ''),
    projectId: String(delivery.projectId || ''),
    version: String(delivery.version || 'draft'),
    assets: normalizeAssets(delivery.assets),
    status: normalizeStatus(delivery.status),
    reviewer: String(delivery.reviewer || ''),
    remark: String(delivery.remark || ''),
    createdAt: delivery.createdAt || now,
    updatedAt: delivery.updatedAt || delivery.createdAt || now
  }
}

function readDeliveries() {
  try {
    const deliveries = uni.getStorageSync(DELIVERY_STORAGE_KEY)
    return Array.isArray(deliveries) ? deliveries.map(normalizeDelivery) : []
  } catch (error) {
    return []
  }
}

function writeDeliveries(deliveries = []) {
  uni.setStorageSync(DELIVERY_STORAGE_KEY, deliveries.map(normalizeDelivery))
}

function logDeliveryUpdate(delivery) {
  console.log('[delivery:update]', {
    projectId: delivery.projectId,
    deliveryId: delivery.deliveryId,
    status: delivery.status
  })
}

export function getProjectDeliveries(projectId = '') {
  return readDeliveries()
    .filter((delivery) => delivery.projectId === projectId)
    .sort((left, right) => String(right.updatedAt).localeCompare(String(left.updatedAt)))
}

export function createDelivery(input = {}) {
  const now = new Date().toISOString()
  const delivery = normalizeDelivery({
    deliveryId: `delivery_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    projectId: input.projectId,
    version: input.version,
    assets: input.assets,
    status: DELIVERY_STATUS.PENDING_REVIEW,
    reviewer: input.reviewer,
    remark: input.remark,
    createdAt: now,
    updatedAt: now
  })
  writeDeliveries([delivery, ...readDeliveries()])
  logDeliveryUpdate(delivery)
  return delivery
}

export function updateDelivery(deliveryId = '', patch = {}) {
  const deliveries = readDeliveries()
  const deliveryIndex = deliveries.findIndex((delivery) => delivery.deliveryId === deliveryId)
  if (deliveryIndex < 0) {
    return null
  }
  const currentDelivery = deliveries[deliveryIndex]
  const delivery = normalizeDelivery({
    ...currentDelivery,
    ...patch,
    deliveryId: currentDelivery.deliveryId,
    projectId: currentDelivery.projectId,
    version: currentDelivery.version,
    assets: currentDelivery.assets,
    updatedAt: new Date().toISOString()
  })
  deliveries.splice(deliveryIndex, 1, delivery)
  writeDeliveries(deliveries)
  logDeliveryUpdate(delivery)
  return delivery
}

export function getDeliveryStatusLabel(status = '') {
  const option = DELIVERY_STATUS_OPTIONS.find((item) => item.value === normalizeStatus(status))
  return option ? option.label : '待审核'
}

export function formatDeliveryTime(value = '') {
  const date = value ? new Date(value) : null
  if (!date || Number.isNaN(date.getTime())) {
    return '刚刚'
  }
  const pad = (number) => String(number).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}
