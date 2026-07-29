const STORAGE_KEY = 'diebi_workspace_project_asset_version_v1'

const STATUS_LABELS = Object.freeze({
  draft: '草稿',
  reviewing: '审核中',
  approved: '已通过',
  delivered: '已交付'
})

const REVIEW_STATUS_LABELS = Object.freeze({
  pending: '待审核',
  reviewing: '审核中',
  approved: '审核通过'
})

const DELIVERY_STATUS_LABELS = Object.freeze({
  pending: '待交付',
  ready: '可交付',
  delivered: '已交付'
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
    // Asset versions are local metadata; failures should not block workspace usage.
  }
}

function normalizeStatus(status = 'draft') {
  return STATUS_LABELS[status] ? status : 'draft'
}

function getReviewStatus(status = 'draft') {
  if (status === 'reviewing') return 'reviewing'
  if (status === 'approved' || status === 'delivered') return 'approved'
  return 'pending'
}

function getDeliveryStatus(status = 'draft') {
  if (status === 'delivered') return 'delivered'
  if (status === 'approved') return 'ready'
  return 'pending'
}

function normalizeVersion(input = {}) {
  const status = normalizeStatus(input.status)
  return {
    assetVersionId: input.assetVersionId || `asset_version_${input.projectAssetId || 'asset'}_${input.version || 1}`,
    projectAssetId: input.projectAssetId || '',
    version: Math.max(1, Number(input.version) || 1),
    status,
    reviewStatus: input.reviewStatus || getReviewStatus(status),
    deliveryStatus: input.deliveryStatus || getDeliveryStatus(status),
    sourceAssetId: input.sourceAssetId || '',
    createdAt: input.createdAt || nowIso()
  }
}

function normalizeStore(raw) {
  const versions = raw && Array.isArray(raw.versions) ? raw.versions : Array.isArray(raw) ? raw : []
  return versions
    .map(normalizeVersion)
    .filter((item) => item.projectAssetId && item.assetVersionId)
    .sort((a, b) => b.version - a.version)
}

function getStoreVersions() {
  return normalizeStore(safeGetStorage())
}

function writeVersions(versions = []) {
  const normalized = normalizeStore({ versions })
  safeSetStorage({ version: 1, versions: normalized })
  return normalized
}

function getAssetVersionsFromList(projectAssetId = '', versions = []) {
  return versions
    .filter((item) => item.projectAssetId === projectAssetId)
    .sort((a, b) => b.version - a.version)
}

function createVersion(asset = {}, versionNumber = 1) {
  return normalizeVersion({
    assetVersionId: `asset_version_${asset.projectAssetId}_${versionNumber}`,
    projectAssetId: asset.projectAssetId,
    version: versionNumber,
    status: 'draft',
    sourceAssetId: asset.assetId || '',
    createdAt: asset.createdAt || nowIso()
  })
}

export function ensureWorkspaceProjectAssetVersions(assets = []) {
  const versions = getStoreVersions()
  const next = [...versions]
  assets.forEach((asset) => {
    if (!asset || !asset.projectAssetId) return
    const existing = getAssetVersionsFromList(asset.projectAssetId, next)
    if (!existing.length) {
      next.push(createVersion(asset, 1))
      return
    }
    const latest = existing[0]
    if (asset.assetId && latest.sourceAssetId && latest.sourceAssetId !== asset.assetId) {
      next.push(createVersion(asset, latest.version + 1))
    }
  })
  return writeVersions(next)
}

export function getWorkspaceProjectAssetVersions(projectAssetId = '') {
  return getAssetVersionsFromList(projectAssetId, getStoreVersions())
}

export function getWorkspaceProjectAssetVersionMap(assets = []) {
  ensureWorkspaceProjectAssetVersions(assets)
  return assets.reduce((result, asset) => {
    result[asset.projectAssetId] = getWorkspaceProjectAssetVersions(asset.projectAssetId)
    return result
  }, {})
}

export function updateWorkspaceProjectAssetVersionStatus(assetVersionId = '', status = 'draft') {
  const normalizedStatus = normalizeStatus(status)
  const versions = getStoreVersions()
  const updated = versions.map((item) => (
    item.assetVersionId === assetVersionId
      ? normalizeVersion({
        ...item,
        status: normalizedStatus,
        reviewStatus: getReviewStatus(normalizedStatus),
        deliveryStatus: getDeliveryStatus(normalizedStatus)
      })
      : item
  ))
  writeVersions(updated)
  return updated.find((item) => item.assetVersionId === assetVersionId) || null
}

export function getWorkspaceAssetVersionStatusLabel(status = '') {
  return STATUS_LABELS[status] || '草稿'
}

export function getWorkspaceAssetReviewStatusLabel(status = '') {
  return REVIEW_STATUS_LABELS[status] || '待审核'
}

export function getWorkspaceAssetDeliveryStatusLabel(status = '') {
  return DELIVERY_STATUS_LABELS[status] || '待交付'
}
