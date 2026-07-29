const WORKSPACE_PLAN_HISTORY_STORAGE_KEY = 'diebiandesign_workspace_plan_history'

export const WORKSPACE_PLAN_HISTORY_STATUS = Object.freeze({
  PENDING: 'pending',
  GENERATING: 'generating',
  COMPLETED: 'completed',
  PARTIAL_FAILED: 'partial_failed',
  FAILED: 'failed'
})

function uniqueIds(values = []) {
  return [...new Set((Array.isArray(values) ? values : []).map((value) => String(value || '').trim()).filter(Boolean))]
}

function normalizeStatus(status = '') {
  return Object.values(WORKSPACE_PLAN_HISTORY_STATUS).includes(status)
    ? status
    : WORKSPACE_PLAN_HISTORY_STATUS.PENDING
}

function normalizeHistory(history = {}) {
  return {
    historyId: String(history.historyId || ''),
    planId: String(history.planId || ''),
    userId: String(history.userId || ''),
    taskIds: uniqueIds(history.taskIds),
    assetIds: uniqueIds(history.assetIds),
    cost: Math.max(0, Number(history.cost) || 0),
    status: normalizeStatus(history.status),
    createdAt: history.createdAt || new Date().toISOString(),
    updatedAt: history.updatedAt || ''
  }
}

function readHistories() {
  try {
    const histories = uni.getStorageSync(WORKSPACE_PLAN_HISTORY_STORAGE_KEY)
    return Array.isArray(histories) ? histories.map(normalizeHistory) : []
  } catch (error) {
    return []
  }
}

function writeHistories(histories = []) {
  const normalized = histories.map(normalizeHistory)
  try {
    uni.setStorageSync(WORKSPACE_PLAN_HISTORY_STORAGE_KEY, normalized)
  } catch (error) {}
  return normalized
}

function logHistory(history) {
  console.log('[workspace:plan-history]', {
    historyId: history.historyId,
    planId: history.planId,
    status: history.status
  })
}

export function getWorkspacePlanHistories() {
  return readHistories().sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt)))
}

export function getWorkspacePlanHistory(historyId = '') {
  return readHistories().find((history) => history.historyId === historyId) || null
}

export function getActiveWorkspacePlanHistory() {
  return getWorkspacePlanHistories().find((history) => (
    history.status === WORKSPACE_PLAN_HISTORY_STATUS.PENDING ||
    history.status === WORKSPACE_PLAN_HISTORY_STATUS.GENERATING
  )) || null
}

export function createWorkspacePlanHistory(input = {}) {
  const createdAt = input.createdAt || new Date().toISOString()
  const history = normalizeHistory({
    ...input,
    historyId: input.historyId || `workspace_plan_history_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    status: WORKSPACE_PLAN_HISTORY_STATUS.PENDING,
    createdAt,
    updatedAt: input.updatedAt || createdAt
  })
  writeHistories([history, ...readHistories().filter((item) => item.historyId !== history.historyId)])
  logHistory(history)
  return history
}

export function updateWorkspacePlanHistory(historyId = '', patch = {}) {
  const histories = readHistories()
  const index = histories.findIndex((history) => history.historyId === historyId)
  if (index < 0) return null
  const history = normalizeHistory({
    ...histories[index],
    ...patch,
    updatedAt: patch.updatedAt || new Date().toISOString(),
    taskIds: patch.taskIds === undefined ? histories[index].taskIds : patch.taskIds,
    assetIds: patch.assetIds === undefined ? histories[index].assetIds : patch.assetIds
  })
  histories.splice(index, 1, history)
  writeHistories(histories)
  logHistory(history)
  return history
}

export function linkWorkspacePlanTasks(historyId = '', taskIds = []) {
  const history = getWorkspacePlanHistory(historyId)
  if (!history) return null
  return updateWorkspacePlanHistory(historyId, {
    taskIds: uniqueIds([...history.taskIds, ...taskIds]),
    status: WORKSPACE_PLAN_HISTORY_STATUS.GENERATING
  })
}

export function completeWorkspacePlanHistory(historyId = '', assetIds = []) {
  const history = getWorkspacePlanHistory(historyId)
  if (!history) return null
  return updateWorkspacePlanHistory(historyId, {
    assetIds: uniqueIds([...history.assetIds, ...assetIds]),
    status: WORKSPACE_PLAN_HISTORY_STATUS.COMPLETED
  })
}

export function failWorkspacePlanHistory(historyId = '', assetIds = []) {
  const history = getWorkspacePlanHistory(historyId)
  if (!history) return null
  return updateWorkspacePlanHistory(historyId, {
    assetIds: uniqueIds([...history.assetIds, ...assetIds]),
    status: WORKSPACE_PLAN_HISTORY_STATUS.FAILED
  })
}
