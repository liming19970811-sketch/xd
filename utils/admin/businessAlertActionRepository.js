const BUSINESS_ALERT_ACTION_STORAGE_KEY = 'diebiandesign_admin_business_alert_actions'

export const BUSINESS_ALERT_ACTION_STATUSES = [
  { value: 'open', label: '待处理' },
  { value: 'processing', label: '处理中' },
  { value: 'resolved', label: '已解决' },
  { value: 'ignored', label: '已忽略' }
]

export const BUSINESS_ALERT_ACTION_TYPES = [
  { value: 'assign', label: '分配处理人' },
  { value: 'record', label: '新增处理记录' },
  { value: 'status_change', label: '修改处理状态' }
]

function safeReadActions() {
  try {
    const records = uni.getStorageSync(BUSINESS_ALERT_ACTION_STORAGE_KEY)
    return Array.isArray(records) ? records : []
  } catch (error) {
    return []
  }
}

function safeWriteActions(records = []) {
  try {
    uni.setStorageSync(BUSINESS_ALERT_ACTION_STORAGE_KEY, Array.isArray(records) ? records : [])
  } catch (error) {
    // Keep the admin page readable when local storage is unavailable.
  }
}

function getActionStatus(status = '') {
  return BUSINESS_ALERT_ACTION_STATUSES.find((item) => item.value === status) || BUSINESS_ALERT_ACTION_STATUSES[0]
}

function getActionType(actionType = '') {
  return BUSINESS_ALERT_ACTION_TYPES.find((item) => item.value === actionType) || BUSINESS_ALERT_ACTION_TYPES[1]
}

function normalizeAction(input = {}) {
  const status = getActionStatus(input.status)
  const actionType = getActionType(input.actionType)
  const now = new Date().toISOString()
  return {
    actionId: String(input.actionId || `alert_action_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`),
    alertId: String(input.alertId || ''),
    operator: String(input.operator || '运营同学'),
    actionType: actionType.value,
    content: String(input.content || actionType.label),
    status: status.value,
    createdAt: String(input.createdAt || now)
  }
}

function sortByCreatedAtDesc(records = []) {
  return [...records].sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt)))
}

export function getBusinessAlertActionStatusLabel(status = '') {
  return getActionStatus(status).label
}

export function getBusinessAlertActionTypeLabel(actionType = '') {
  return getActionType(actionType).label
}

export function listBusinessAlertActions() {
  return sortByCreatedAtDesc(safeReadActions().map(normalizeAction))
}

export function getBusinessAlertActions(alertId = '') {
  return listBusinessAlertActions().filter((action) => action.alertId === alertId)
}

export function createBusinessAlertAction(input = {}) {
  const action = normalizeAction(input)
  const records = [action, ...listBusinessAlertActions().filter((item) => item.actionId !== action.actionId)]
  safeWriteActions(records)
  console.log('[business:alert-action]', {
    alertId: action.alertId,
    actionType: action.actionType
  })
  return action
}

export function getBusinessAlertActionState(alertId = '') {
  const actions = getBusinessAlertActions(alertId)
  const latestStatusAction = actions.find((action) => action.status)
  const latestAssignAction = actions.find((action) => action.actionType === 'assign')
  return {
    status: latestStatusAction ? latestStatusAction.status : 'open',
    operator: latestAssignAction ? latestAssignAction.operator : '',
    latestAction: actions[0] || null,
    actionCount: actions.length
  }
}

export function assignBusinessAlert(alertId = '', operator = '', content = '') {
  return createBusinessAlertAction({
    alertId,
    operator,
    actionType: 'assign',
    content: content || `分配给 ${operator || '运营同学'}`,
    status: 'processing'
  })
}

export function updateBusinessAlertStatus(alertId = '', status = 'processing', operator = '', content = '') {
  return createBusinessAlertAction({
    alertId,
    operator,
    actionType: 'status_change',
    content: content || `处理状态更新为 ${getBusinessAlertActionStatusLabel(status)}`,
    status
  })
}
