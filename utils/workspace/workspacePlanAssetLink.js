import {
  getWorkspacePlanVersion,
  switchWorkspacePlanVersion
} from './workspacePlanVersion'

const WORKSPACE_PLAN_ASSET_LINK_STORAGE_KEY = 'diebiandesign_workspace_plan_asset_links'
const WORKSPACE_PLAN_ASSET_CONTEXT_STORAGE_KEY = 'diebiandesign_workspace_plan_asset_contexts'

function uniqueIds(values = []) {
  return [...new Set((Array.isArray(values) ? values : []).map((value) => String(value || '').trim()).filter(Boolean))]
}

function normalizeLink(link = {}) {
  return {
    linkId: String(link.linkId || ''),
    projectId: String(link.projectId || ''),
    planId: String(link.planId || ''),
    versionId: String(link.versionId || ''),
    assetId: String(link.assetId || ''),
    assetType: String(link.assetType || 'image'),
    createdAt: link.createdAt || new Date().toISOString()
  }
}

function readLinks() {
  try {
    const value = uni.getStorageSync(WORKSPACE_PLAN_ASSET_LINK_STORAGE_KEY)
    return Array.isArray(value) ? value.map(normalizeLink) : []
  } catch (error) {
    return []
  }
}

function writeLinks(links = []) {
  const normalized = links.map(normalizeLink)
  try {
    uni.setStorageSync(WORKSPACE_PLAN_ASSET_LINK_STORAGE_KEY, normalized)
  } catch (error) {}
  return normalized
}

function readContexts() {
  try {
    const value = uni.getStorageSync(WORKSPACE_PLAN_ASSET_CONTEXT_STORAGE_KEY)
    return value && typeof value === 'object' ? value : {}
  } catch (error) {
    return {}
  }
}

function writeContexts(contexts = {}) {
  try {
    uni.setStorageSync(WORKSPACE_PLAN_ASSET_CONTEXT_STORAGE_KEY, contexts)
  } catch (error) {}
  return contexts
}

function inferAssetType(assetId = '') {
  return String(assetId).startsWith('batch_') ? 'batch' : 'image'
}

function createLinkId(input = {}) {
  const seed = [input.projectId || 'none', input.planId, input.versionId, input.assetId].join('_')
  return `workspace_plan_asset_link_${seed}`
}

function logLink(link = {}) {
  if (!link.linkId) return
  console.log('[workspace:plan-asset-link]', {
    linkId: link.linkId
  })
}

export function saveWorkspacePlanAssetContext(historyId = '', input = {}) {
  if (!historyId || !input.planId || !input.versionId) return null
  const contexts = readContexts()
  const context = {
    projectId: String(input.projectId || ''),
    planId: String(input.planId || ''),
    versionId: String(input.versionId || ''),
    createdAt: input.createdAt || new Date().toISOString()
  }
  contexts[historyId] = context
  writeContexts(contexts)
  return context
}

export function copyWorkspacePlanAssetContext(sourceHistoryId = '', targetHistoryId = '') {
  const context = readContexts()[sourceHistoryId]
  return context ? saveWorkspacePlanAssetContext(targetHistoryId, context) : null
}

export function createWorkspacePlanAssetLink(input = {}) {
  if (!input.planId || !input.versionId || !input.assetId) return null
  const links = readLinks()
  const existing = links.find((item) => (
    item.planId === String(input.planId) &&
    item.versionId === String(input.versionId) &&
    item.assetId === String(input.assetId)
  ))
  if (existing) return existing
  const link = normalizeLink({
    ...input,
    linkId: input.linkId || createLinkId(input),
    assetType: input.assetType || inferAssetType(input.assetId),
    createdAt: input.createdAt || new Date().toISOString()
  })
  writeLinks([link, ...links])
  logLink(link)
  return link
}

export function linkWorkspacePlanAssets(historyId = '', assetIds = []) {
  const context = readContexts()[historyId]
  if (!context) return []
  return uniqueIds(assetIds).map((assetId) => createWorkspacePlanAssetLink({
    ...context,
    assetId,
    assetType: inferAssetType(assetId)
  })).filter(Boolean)
}

export function getWorkspacePlanAssetLinks(filters = {}) {
  return readLinks().filter((link) => Object.keys(filters).every((key) => (
    filters[key] === undefined || filters[key] === '' || link[key] === String(filters[key])
  )))
}

export function getWorkspacePlanAssetSource(assetId = '') {
  const link = readLinks().find((item) => item.assetId === assetId)
  if (!link) return null
  const version = getWorkspacePlanVersion(link.versionId)
  return {
    ...link,
    planTitle: version ? version.title : '智能生产方案',
    version: version ? version.version : 1
  }
}

export function restoreWorkspacePlanFromAssetLink(link = {}) {
  if (!link.planId || !link.versionId) return null
  return switchWorkspacePlanVersion({ planId: link.planId }, link.versionId)
}
