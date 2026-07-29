import { get, set } from '../data-provider/dataProvider.js'
import { requirePlatformAdmin } from './platformAdminRepository.js'
import { getTraceCoveragePlan, getTraceTimeline, getLogRetentionPolicy, listStructuredLogs, writeStructuredLog } from '../observability/traceLogger.js'
import { listTasks } from '../task/taskLayer.js'
import { listWorkspaceDeliveries } from '../workspace/workspaceBatchDeliveryCenter.js'

const ALERT_STORAGE_KEY = 'diebians_observability_alerts_v1'
const ALERT_ACTION_STORAGE_KEY = 'diebians_observability_alert_actions_v1'

export const ALERT_STATUSES = Object.freeze(['open', 'acknowledged', 'investigating', 'resolved', 'ignored'])
export const ALERT_LEVELS = Object.freeze(['low', 'medium', 'high', 'critical'])
export const ALERT_TYPES = Object.freeze([
  'task_failure_rate',
  'provider_timeout',
  'provider_empty_result',
  'quota_duplicate_charge',
  'quota_rollback_failed',
  'task_stuck_processing',
  'mock_fallback_review',
  'unauthorized_download',
  'cross_enterprise_access',
  'delivery_failed',
  'backup_failed'
])

function nowIso() {
  return new Date().toISOString()
}

function createId(prefix = 'alert') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

function readList(key = '') {
  const value = get(key, [])
  return Array.isArray(value) ? value : []
}

function writeList(key = '', records = []) {
  set(key, Array.isArray(records) ? records : [])
}

function normalizeAlert(alert = {}) {
  return {
    alertId: String(alert.alertId || createId('alert')),
    type: ALERT_TYPES.includes(alert.type) ? alert.type : 'task_failure_rate',
    level: ALERT_LEVELS.includes(alert.level) ? alert.level : 'medium',
    status: ALERT_STATUSES.includes(alert.status) ? alert.status : 'open',
    title: String(alert.title || ''),
    description: String(alert.description || ''),
    owner: String(alert.owner || ''),
    impactScope: String(alert.impactScope || ''),
    relatedTicketId: String(alert.relatedTicketId || ''),
    traceId: String(alert.traceId || ''),
    requestId: String(alert.requestId || ''),
    taskId: String(alert.taskId || ''),
    projectId: String(alert.projectId || ''),
    batchId: String(alert.batchId || ''),
    provider: String(alert.provider || ''),
    modelVersion: String(alert.modelVersion || ''),
    errorCode: String(alert.errorCode || ''),
    createdAt: alert.createdAt || nowIso(),
    resolvedAt: alert.resolvedAt || ''
  }
}

function readAlerts() {
  return readList(ALERT_STORAGE_KEY).map(normalizeAlert)
}

function saveAlerts(records = []) {
  writeList(ALERT_STORAGE_KEY, records.map(normalizeAlert))
}

function readAlertActions() {
  return readList(ALERT_ACTION_STORAGE_KEY)
}

function saveAlertActions(records = []) {
  writeList(ALERT_ACTION_STORAGE_KEY, records)
}

function isMockOrFallback(task = {}) {
  const provider = String(task.provider || '').toLowerCase()
  const source = String(task.source || '').toLowerCase()
  return task.mock === true || task.isMock === true || task.fallback === true || task.isFallback === true || Boolean(task.fallbackReason) || provider.includes('mock') || provider.includes('fallback') || source.includes('mock') || source.includes('fallback')
}

function taskAgeMinutes(task = {}) {
  const time = Date.parse(task.updatedAt || task.createdAt || '')
  if (!Number.isFinite(time)) return 0
  return Math.floor((Date.now() - time) / 60000)
}

function upsertRuleAlert(alert = {}) {
  const normalized = normalizeAlert(alert)
  const alerts = readAlerts()
  const existing = alerts.find((item) => (
    item.status !== 'resolved' &&
    item.type === normalized.type &&
    item.taskId === normalized.taskId &&
    item.projectId === normalized.projectId &&
    item.batchId === normalized.batchId &&
    item.errorCode === normalized.errorCode
  ))
  if (existing) return existing
  saveAlerts([normalized, ...alerts])
  writeStructuredLog({
    level: normalized.level === 'critical' ? 'critical' : 'warn',
    module: 'admin',
    action: 'alert_created',
    traceId: normalized.traceId,
    requestId: normalized.requestId,
    taskId: normalized.taskId,
    projectId: normalized.projectId,
    batchId: normalized.batchId,
    provider: normalized.provider,
    modelVersion: normalized.modelVersion,
    status: normalized.status,
    errorCode: normalized.errorCode,
    data: { alertId: normalized.alertId, type: normalized.type }
  })
  return normalized
}

export function evaluateAlertRules(input = {}) {
  const guard = requirePlatformAdmin()
  if (!guard.allowed) return { canAccess: false, errorCode: guard.reason, alerts: [] }
  const tasks = Array.isArray(input.tasks) ? input.tasks : listTasks()
  const deliveries = Array.isArray(input.deliveries) ? input.deliveries : listWorkspaceDeliveries()
  const logs = listStructuredLogs()
  const created = []
  const failedTasks = tasks.filter((task) => ['failed', 'timeout'].includes(String(task.status || '').toLowerCase()))
  if (tasks.length >= 5 && failedTasks.length / tasks.length >= 0.3) {
    created.push(upsertRuleAlert({
      type: 'task_failure_rate',
      level: 'high',
      title: '任务失败率持续升高',
      description: `当前样本失败 ${failedTasks.length}/${tasks.length}。`,
      impactScope: 'task',
      errorCode: 'task_failure_rate_high'
    }))
  }
  tasks.filter((task) => String(task.status || '').toLowerCase() === 'processing' && taskAgeMinutes(task) > 30).forEach((task) => {
    created.push(upsertRuleAlert({
      type: 'task_stuck_processing',
      level: 'high',
      title: '任务长期停留在生成中',
      description: '任务超过 30 分钟仍未进入终态。',
      impactScope: 'task',
      taskId: task.taskId,
      projectId: task.projectId,
      batchId: task.batchId,
      provider: task.provider,
      modelVersion: task.modelVersion,
      errorCode: 'task_stuck_processing'
    }))
  })
  tasks.filter((task) => isMockOrFallback(task) && ['pending_review', 'reviewing', 'approved', 'delivering', 'delivered'].includes(String(task.deliveryStatus || task.reviewStatus || '').toLowerCase())).forEach((task) => {
    created.push(upsertRuleAlert({
      type: 'mock_fallback_review',
      level: 'critical',
      title: 'mock 或 fallback 结果进入正式审核',
      description: '体验结果不得进入正式审核与交付。',
      impactScope: 'review_delivery',
      taskId: task.taskId,
      projectId: task.projectId,
      batchId: task.batchId,
      provider: task.provider,
      modelVersion: task.modelVersion,
      errorCode: 'mock_fallback_review_blocked'
    }))
  })
  deliveries.filter((delivery) => ['failed', 'expired'].includes(String(delivery.status || '').toLowerCase())).forEach((delivery) => {
    created.push(upsertRuleAlert({
      type: 'delivery_failed',
      level: 'high',
      title: '正式交付失败',
      description: '交付记录进入失败或过期状态。',
      impactScope: 'delivery',
      projectId: delivery.projectId,
      batchId: delivery.batchId,
      errorCode: 'delivery_failed'
    }))
  })
  logs.filter((log) => log.level === 'error' || log.level === 'critical').forEach((log) => {
    if (['provider_timeout', 'provider_empty_result', 'quota_duplicate_charge', 'quota_rollback_failed', 'unauthorized_download', 'cross_enterprise_access', 'backup_failed'].includes(log.errorCode)) {
      created.push(upsertRuleAlert({
        type: log.errorCode,
        level: log.level === 'critical' ? 'critical' : 'high',
        title: log.errorCode,
        description: log.message || '系统日志触发告警。',
        impactScope: log.module,
        traceId: log.traceId,
        requestId: log.requestId,
        taskId: log.taskId,
        projectId: log.projectId,
        batchId: log.batchId,
        provider: log.provider,
        modelVersion: log.modelVersion,
        errorCode: log.errorCode
      }))
    }
  })
  return { canAccess: true, alerts: created }
}

export function updateAlertStatus(alertId = '', status = 'acknowledged', input = {}) {
  const guard = requirePlatformAdmin()
  if (!guard.allowed) return { success: false, errorCode: guard.reason }
  if (!ALERT_STATUSES.includes(status)) return { success: false, errorCode: 'invalid_alert_status' }
  const alerts = readAlerts()
  let updated = null
  const next = alerts.map((alert) => {
    if (alert.alertId !== alertId) return alert
    updated = normalizeAlert({
      ...alert,
      status,
      owner: input.owner || alert.owner,
      relatedTicketId: input.relatedTicketId || alert.relatedTicketId,
      resolvedAt: status === 'resolved' ? nowIso() : alert.resolvedAt
    })
    return updated
  })
  if (!updated) return { success: false, errorCode: 'alert_not_found' }
  saveAlerts(next)
  const action = {
    actionId: createId('alert_action'),
    alertId,
    actionType: status,
    operator: input.operator || 'platform_admin',
    content: input.content || '',
    createdAt: nowIso()
  }
  saveAlertActions([action, ...readAlertActions()])
  writeStructuredLog({
    level: status === 'resolved' ? 'info' : 'warn',
    module: 'admin',
    action: 'alert_status_update',
    traceId: updated.traceId,
    requestId: updated.requestId,
    taskId: updated.taskId,
    projectId: updated.projectId,
    batchId: updated.batchId,
    status,
    errorCode: updated.errorCode,
    data: { alertId, actionType: status }
  })
  return { success: true, alert: updated, action }
}

export function loadErrorAlertCenter(filters = {}) {
  const guard = requirePlatformAdmin()
  if (!guard.allowed) {
    return {
      canAccess: false,
      reason: guard.reason,
      logs: [],
      alerts: [],
      alertActions: [],
      traceTimeline: [],
      retentionPolicies: getLogRetentionPolicy(),
      coveragePlan: getTraceCoveragePlan(),
      metrics: {}
    }
  }
  evaluateAlertRules()
  const logs = listStructuredLogs(filters)
  const alerts = readAlerts()
    .filter((alert) => !filters.status || alert.status === filters.status)
    .filter((alert) => !filters.errorCode || alert.errorCode === filters.errorCode)
    .filter((alert) => !filters.provider || alert.provider === filters.provider)
    .filter((alert) => !filters.modelVersion || alert.modelVersion === filters.modelVersion)
    .sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt)))
  const traceTimeline = filters.traceId || filters.taskId || filters.projectId || filters.batchId
    ? getTraceTimeline(filters.traceId || filters.taskId || filters.projectId || filters.batchId)
    : []
  const errorLogs = logs.filter((log) => log.level === 'error' || log.level === 'critical')
  return {
    canAccess: true,
    reason: '',
    logs,
    alerts,
    alertActions: readAlertActions(),
    traceTimeline,
    retentionPolicies: getLogRetentionPolicy(),
    coveragePlan: getTraceCoveragePlan(),
    metrics: {
      logCount: logs.length,
      errorCount: errorLogs.length,
      criticalCount: logs.filter((log) => log.level === 'critical').length,
      openAlertCount: alerts.filter((alert) => alert.status === 'open').length,
      resolvedAlertCount: alerts.filter((alert) => alert.status === 'resolved').length
    },
    updatedAt: nowIso()
  }
}
