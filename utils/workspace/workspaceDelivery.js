const STORAGE_KEY = 'diebi_workspace_delivery_v1'

const DELIVERY_STATUS_LABELS = Object.freeze({
  pending: '待准备',
  preparing: '准备中',
  delivered: '已交付',
  confirmed: '客户已确认'
})

function nowIso() {
  return new Date().toISOString()
}

function safeGetStorage() {
  try {
    return uni.getStorageSync(STORAGE_KEY) || null
  } catch (error) {
    return null
  }
}

function safeSetStorage(payload) {
  try {
    uni.setStorageSync(STORAGE_KEY, payload)
  } catch (error) {
    // Delivery metadata is local workspace state and should not block production flows.
  }
}

function normalizeStatus(status = 'pending') {
  return DELIVERY_STATUS_LABELS[status] ? status : 'pending'
}

function normalizeVersionIds(assetVersionIds = []) {
  return Array.from(new Set(
    (Array.isArray(assetVersionIds) ? assetVersionIds : [])
      .map((item) => String(item || '').trim())
      .filter(Boolean)
  ))
}

function normalizeDelivery(input = {}) {
  const status = normalizeStatus(input.status)
  return {
    deliveryId: input.deliveryId || `workspace_delivery_${input.projectId || 'project'}_${Date.now()}`,
    projectId: input.projectId || '',
    assetVersionIds: normalizeVersionIds(input.assetVersionIds),
    customerId: input.customerId || '',
    status,
    createdAt: input.createdAt || nowIso(),
    completedAt: status === 'confirmed' ? (input.completedAt || nowIso()) : (input.completedAt || '')
  }
}

function normalizeStore(raw) {
  const deliveries = raw && Array.isArray(raw.deliveries) ? raw.deliveries : Array.isArray(raw) ? raw : []
  return deliveries
    .map(normalizeDelivery)
    .filter((item) => item.deliveryId && item.projectId && item.assetVersionIds.length)
    .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))
}

function getStoreDeliveries() {
  return normalizeStore(safeGetStorage())
}

function writeDeliveries(deliveries = []) {
  const normalized = normalizeStore({ deliveries })
  safeSetStorage({ version: 1, deliveries: normalized })
  return normalized
}

export function getWorkspaceDeliveries(projectId = '') {
  const deliveries = getStoreDeliveries()
  return projectId ? deliveries.filter((item) => item.projectId === projectId) : deliveries
}

export function createWorkspaceDelivery(input = {}) {
  const delivery = normalizeDelivery(input)
  if (!delivery.projectId || !delivery.assetVersionIds.length) return null
  const deliveries = getStoreDeliveries()
  writeDeliveries([delivery, ...deliveries])
  return delivery
}

export function updateWorkspaceDeliveryStatus(deliveryId = '', status = 'pending') {
  if (!deliveryId) return null
  const normalizedStatus = normalizeStatus(status)
  let updatedDelivery = null
  const deliveries = getStoreDeliveries().map((item) => {
    if (item.deliveryId !== deliveryId) return item
    updatedDelivery = normalizeDelivery({
      ...item,
      status: normalizedStatus,
      completedAt: normalizedStatus === 'confirmed' ? (item.completedAt || nowIso()) : item.completedAt
    })
    return updatedDelivery
  })
  writeDeliveries(deliveries)
  return updatedDelivery
}

export function getWorkspaceDeliveryStatusLabel(status = '') {
  return DELIVERY_STATUS_LABELS[status] || DELIVERY_STATUS_LABELS.pending
}
