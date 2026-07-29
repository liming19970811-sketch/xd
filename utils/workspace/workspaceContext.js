const STORAGE_KEY = 'diebi_workspace_context_v1'
const USER_STORAGE_KEY = 'diebiandesign_current_user'
const MAX_CONTEXT_COUNT = 20

function nowIso() {
  return new Date().toISOString()
}

function createContextId() {
  return `workspace_context_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
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
    // Context memory is a convenience layer; failures should not block workspace usage.
  }
}

function safeRemoveStorage() {
  try {
    uni.removeStorageSync(STORAGE_KEY)
  } catch (error) {
    // no-op
  }
}

function normalizeTitle(context = {}) {
  return String(context.title || context.planName || context.name || context.lastPlanId || context.planId || '未命名创作')
}

function normalizeContext(input = {}) {
  const createdAt = input.createdAt || input.updatedAt || input.lastUsedAt || nowIso()
  const entryType = input.entryType || input.lastEntry || ''
  const planId = input.planId || input.lastPlanId || ''
  const brandId = input.brandId || input.lastBrandId || input.companyId || ''
  const projectId = input.projectId || input.lastProjectId || ''
  const customerId = input.customerId || input.lastCustomerId || ''
  const modelId = input.modelId || input.lastModelId || ''
  const colorId = input.colorId || input.lastColorId || ''
  const sceneId = input.sceneId || input.lastSceneId || ''
  const designId = input.designId || input.lastDesignId || ''
  return {
    contextId: input.contextId || createContextId(),
    userId: input.userId || '',
    title: normalizeTitle({ ...input, planId }),
    entryType,
    brandId,
    projectId,
    customerId,
    planId,
    modelId,
    colorId,
    sceneId,
    designId,
    lastUsedAt: input.lastUsedAt || input.updatedAt || createdAt,
    createdAt,
    lastEntry: entryType,
    lastBrandId: brandId,
    lastProjectId: projectId,
    lastCustomerId: customerId,
    lastPlanId: planId,
    lastModelId: modelId,
    lastColorId: colorId,
    lastSceneId: sceneId,
    lastDesignId: designId
  }
}

function normalizeContextList(raw) {
  if (!raw) return []
  const contexts = Array.isArray(raw)
    ? raw
    : Array.isArray(raw.contexts)
      ? raw.contexts
      : raw.contextId
        ? [raw]
        : []
  return contexts
    .map(normalizeContext)
    .filter((item) => item.contextId)
    .sort((a, b) => String(b.lastUsedAt || '').localeCompare(String(a.lastUsedAt || '')))
    .slice(0, MAX_CONTEXT_COUNT)
}

function getCurrentUserId() {
  try {
    const user = uni.getStorageSync(USER_STORAGE_KEY) || {}
    return user.userId || 'guest'
  } catch (error) {
    return 'guest'
  }
}

function getPatchPlanId(patch = {}) {
  return patch.planId || patch.lastPlanId || ''
}

function getPatchDesignId(patch = {}) {
  return patch.designId || patch.lastDesignId || ''
}

function findContextIndex(list, patch = {}) {
  if (patch.contextId) {
    return list.findIndex((item) => item.contextId === patch.contextId)
  }
  const planId = getPatchPlanId(patch)
  if (planId) {
    const planIndex = list.findIndex((item) => item.planId === planId || item.lastPlanId === planId)
    if (planIndex >= 0) return planIndex
  }
  const designId = getPatchDesignId(patch)
  if (designId) {
    const designIndex = list.findIndex((item) => item.designId === designId || item.lastDesignId === designId)
    if (designIndex >= 0) return designIndex
  }
  if (planId || designId) return -1
  return list.length ? 0 : -1
}

function buildNextContext(previous = {}, patch = {}) {
  const timestamp = nowIso()
  const userId = patch.userId || previous.userId || getCurrentUserId()
  const normalizedPatch = normalizeContext({
    ...previous,
    ...patch,
    userId,
    entryType: patch.entryType || patch.lastEntry || previous.entryType || previous.lastEntry || '',
    brandId: patch.brandId || patch.lastBrandId || previous.brandId || previous.lastBrandId || '',
    projectId: patch.projectId || patch.lastProjectId || previous.projectId || previous.lastProjectId || '',
    customerId: patch.customerId || patch.lastCustomerId || previous.customerId || previous.lastCustomerId || '',
    planId: patch.planId || patch.lastPlanId || previous.planId || previous.lastPlanId || '',
    modelId: patch.modelId || patch.lastModelId || previous.modelId || previous.lastModelId || '',
    colorId: patch.colorId || patch.lastColorId || previous.colorId || previous.lastColorId || '',
    sceneId: patch.sceneId || patch.lastSceneId || previous.sceneId || previous.lastSceneId || '',
    designId: patch.designId || patch.lastDesignId || previous.designId || previous.lastDesignId || '',
    title: patch.title || previous.title || '',
    contextId: patch.contextId || previous.contextId || createContextId(),
    createdAt: previous.createdAt || patch.createdAt || timestamp,
    lastUsedAt: timestamp
  })
  return normalizedPatch
}

export function getWorkspaceContexts() {
  return normalizeContextList(safeGetStorage())
}

export function getWorkspaceContext(contextId = '') {
  const list = getWorkspaceContexts()
  if (contextId) {
    return list.find((item) => item.contextId === contextId) || null
  }
  return list[0] || null
}

export function saveWorkspaceContext(patch = {}) {
  const list = getWorkspaceContexts()
  const index = findContextIndex(list, patch)
  const previous = index >= 0 ? list[index] : {}
  const next = buildNextContext(previous, patch)
  const updated = index >= 0
    ? list.map((item, itemIndex) => (itemIndex === index ? next : item))
    : [next, ...list]
  const sorted = normalizeContextList(updated)
  safeSetStorage({ version: 2, contexts: sorted })
  return sorted.find((item) => item.contextId === next.contextId) || next
}

export function renameWorkspaceContext(contextId, title) {
  const normalizedTitle = String(title || '').trim()
  if (!contextId || !normalizedTitle) return getWorkspaceContext(contextId)
  return saveWorkspaceContext({
    contextId,
    title: normalizedTitle
  })
}

export function deleteWorkspaceContext(contextId) {
  const list = getWorkspaceContexts().filter((item) => item.contextId !== contextId)
  safeSetStorage({ version: 2, contexts: list })
  return list
}

export function clearWorkspaceContext() {
  safeRemoveStorage()
}
