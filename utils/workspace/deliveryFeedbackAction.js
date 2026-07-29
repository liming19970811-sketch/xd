const STORAGE_KEY = 'diebi_workspace_delivery_feedback_action_v1'

const ACTION_TYPE_LABELS = Object.freeze({
  modify_plan: '优化方案',
  create_revision: '创建改版',
  ignore_feedback: '暂不处理'
})

const ACTION_STATUS_LABELS = Object.freeze({
  pending: '待处理',
  processing: '处理中',
  completed: '已完成'
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
    // Feedback actions are local planning metadata and must not block production flows.
  }
}

function normalizeActionType(actionType = 'modify_plan') {
  return ACTION_TYPE_LABELS[actionType] ? actionType : 'modify_plan'
}

function normalizeStatus(status = 'pending') {
  return ACTION_STATUS_LABELS[status] ? status : 'pending'
}

function normalizeAction(input = {}) {
  return {
    actionId: input.actionId || `feedback_action_${input.feedbackId || 'feedback'}_${Date.now()}`,
    feedbackId: input.feedbackId || '',
    actionType: normalizeActionType(input.actionType),
    targetType: input.targetType || (input.versionId ? 'version' : 'plan'),
    targetId: input.targetId || input.planId || input.versionId || '',
    status: normalizeStatus(input.status),
    planId: input.planId || '',
    versionId: input.versionId || '',
    createdAt: input.createdAt || nowIso()
  }
}

function normalizeStore(raw) {
  const actions = raw && Array.isArray(raw.actions) ? raw.actions : Array.isArray(raw) ? raw : []
  return actions
    .map(normalizeAction)
    .filter((item) => item.actionId && item.feedbackId)
    .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))
}

function getStoreActions() {
  return normalizeStore(safeGetStorage())
}

function writeActions(actions = []) {
  const normalized = normalizeStore({ actions })
  safeSetStorage({ version: 1, actions: normalized })
  return normalized
}

export function createDeliveryFeedbackAction(input = {}) {
  const action = normalizeAction(input)
  if (!action.feedbackId) return null
  const actions = getStoreActions()
  writeActions([action, ...actions])
  return action
}

export function getDeliveryFeedbackActions(feedbackId = '') {
  const actions = getStoreActions()
  return feedbackId ? actions.filter((item) => item.feedbackId === feedbackId) : actions
}

export function updateDeliveryFeedbackActionStatus(actionId = '', status = 'pending') {
  if (!actionId) return null
  const normalizedStatus = normalizeStatus(status)
  let updatedAction = null
  const actions = getStoreActions().map((item) => {
    if (item.actionId !== actionId) return item
    updatedAction = normalizeAction({
      ...item,
      status: normalizedStatus
    })
    return updatedAction
  })
  writeActions(actions)
  return updatedAction
}

export function getDeliveryFeedbackActionTypeLabel(actionType = '') {
  return ACTION_TYPE_LABELS[actionType] || ACTION_TYPE_LABELS.modify_plan
}

export function getDeliveryFeedbackActionStatusLabel(status = '') {
  return ACTION_STATUS_LABELS[status] || ACTION_STATUS_LABELS.pending
}
