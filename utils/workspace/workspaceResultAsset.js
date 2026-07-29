const STORAGE_KEY = 'diebi_workspace_result_asset_v1'

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
    // Result-asset links are local workspace metadata and should not block usage.
  }
}

function normalizeResultAsset(input = {}) {
  const historyId = String(input.historyId || '').trim()
  const assetId = String(input.assetId || '').trim()
  const projectId = String(input.projectId || '').trim()
  const planId = String(input.planId || '').trim()
  const versionId = String(input.versionId || '').trim()
  const projectAssetId = String(input.projectAssetId || '').trim()
  return {
    resultAssetId: input.resultAssetId || `result_asset_${historyId}_${assetId}_${projectAssetId}`,
    projectId,
    assetId,
    historyId,
    planId,
    versionId,
    projectAssetId,
    createdAt: input.createdAt || nowIso()
  }
}

function normalizeStore(raw) {
  const links = raw && Array.isArray(raw.resultAssets) ? raw.resultAssets : Array.isArray(raw) ? raw : []
  return links
    .map(normalizeResultAsset)
    .filter((item) => item.resultAssetId && item.projectId && item.historyId && item.assetId && item.projectAssetId)
    .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))
}

function writeResultAssets(resultAssets = []) {
  const normalized = normalizeStore({ resultAssets })
  safeSetStorage({ version: 1, resultAssets: normalized })
  return normalized
}

export function getWorkspaceResultAssets() {
  return normalizeStore(safeGetStorage())
}

export function getWorkspaceResultAssetsByHistory(historyId = '') {
  return getWorkspaceResultAssets().filter((item) => item.historyId === historyId)
}

export function linkWorkspaceResultAsset(input = {}) {
  const link = normalizeResultAsset(input)
  if (!link.projectId || !link.historyId || !link.assetId || !link.projectAssetId) return null
  const resultAssets = getWorkspaceResultAssets()
  const existing = resultAssets.find((item) => (
    item.projectId === link.projectId &&
    item.historyId === link.historyId &&
    item.assetId === link.assetId &&
    item.projectAssetId === link.projectAssetId
  ))
  if (existing) return existing
  writeResultAssets([link, ...resultAssets])
  return link
}

export function getWorkspaceResultAssetMap(resultAssets = []) {
  return (Array.isArray(resultAssets) ? resultAssets : []).reduce((result, item) => {
    if (!item.historyId) return result
    if (!result[item.historyId]) result[item.historyId] = []
    result[item.historyId].push(item)
    return result
  }, {})
}
