const STORAGE_KEY = 'diebi_workspace_delivery_package_v1'

const PACKAGE_STATUS_LABELS = Object.freeze({
  draft: '草稿',
  preparing: '准备中',
  delivered: '已交付',
  confirmed: '已确认'
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
    // Delivery packages are local workspace metadata and must not block delivery flows.
  }
}

function normalizeStatus(status = 'draft') {
  return PACKAGE_STATUS_LABELS[status] ? status : 'draft'
}

function normalizeVersionIds(assetVersionIds = []) {
  return Array.from(new Set(
    (Array.isArray(assetVersionIds) ? assetVersionIds : [])
      .map((item) => String(item || '').trim())
      .filter(Boolean)
  ))
}

function normalizePackage(input = {}) {
  const projectId = String(input.projectId || '').trim()
  const deliveryId = String(input.deliveryId || '').trim()
  const assetVersionIds = normalizeVersionIds(input.assetVersionIds)
  const createdAt = input.createdAt || nowIso()
  return {
    deliveryPackageId: input.deliveryPackageId || `delivery_package_${projectId || 'project'}_${deliveryId || Date.now()}`,
    deliveryId,
    projectId,
    assetVersionIds,
    title: input.title || `项目交付包 ${assetVersionIds.length || 1}`,
    status: normalizeStatus(input.status),
    createdAt
  }
}

function normalizeStore(raw) {
  const packages = raw && Array.isArray(raw.deliveryPackages)
    ? raw.deliveryPackages
    : Array.isArray(raw) ? raw : []
  return packages
    .map(normalizePackage)
    .filter((item) => item.deliveryPackageId && item.deliveryId && item.projectId && item.assetVersionIds.length)
    .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))
}

function getStorePackages() {
  return normalizeStore(safeGetStorage())
}

function writePackages(packages = []) {
  const normalized = normalizeStore({ deliveryPackages: packages })
  safeSetStorage({ version: 1, deliveryPackages: normalized })
  return normalized
}

export function getDeliveryPackages(projectId = '') {
  const packages = getStorePackages()
  return projectId ? packages.filter((item) => item.projectId === projectId) : packages
}

export function createDeliveryPackage(input = {}) {
  const deliveryPackage = normalizePackage(input)
  if (!deliveryPackage.deliveryId || !deliveryPackage.projectId || !deliveryPackage.assetVersionIds.length) return null
  const packages = getStorePackages()
  const existing = packages.find((item) => item.deliveryId === deliveryPackage.deliveryId)
  if (existing) return existing
  writePackages([deliveryPackage, ...packages])
  return deliveryPackage
}

export function updateDeliveryPackageStatus(deliveryPackageId = '', status = 'draft') {
  if (!deliveryPackageId) return null
  const normalizedStatus = normalizeStatus(status)
  let updatedPackage = null
  const packages = getStorePackages().map((item) => {
    if (item.deliveryPackageId !== deliveryPackageId) return item
    updatedPackage = normalizePackage({
      ...item,
      status: normalizedStatus
    })
    return updatedPackage
  })
  writePackages(packages)
  return updatedPackage
}

export function getDeliveryPackageStatusLabel(status = '') {
  return PACKAGE_STATUS_LABELS[status] || PACKAGE_STATUS_LABELS.draft
}
