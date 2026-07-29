import { get, set } from '../data-provider/dataProvider.js'
import { getCurrentMember } from '../auth/authRepository.js'
import { hasPermission } from '../auth/permissionService.js'
import { getCurrentEnterpriseId } from '../tenant/tenantContext.js'
import { recordAudit } from '../audit/auditService.js'

const RELEASE_KEY = 'diebians_workspace_model_releases_v1'
const INCIDENT_KEY = 'diebians_workspace_model_incidents_v1'

export const MODEL_OPS_TABS = Object.freeze([
  { key: 'overview', label: '运维概览' },
  { key: 'releases', label: '灰度发布' },
  { key: 'monitoring', label: '质量监控' },
  { key: 'incidents', label: '异常事件' }
])

export const RELEASE_STATUSES = Object.freeze(['draft', 'offline_evaluated', 'checked', 'risk_confirmed', 'gray_planned', 'gray_running', 'paused', 'expanded', 'active', 'rolled_back'])
export const INCIDENT_LEVELS = Object.freeze(['high', 'medium', 'low'])

function nowIso() {
  return new Date().toISOString()
}

function createId(prefix = 'id') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

function currentEnterpriseId() {
  return String(getCurrentEnterpriseId() || 'local_enterprise')
}

function currentMember() {
  return getCurrentMember() || {}
}

function readList(key = '') {
  const value = get(key, [])
  return Array.isArray(value) ? value : []
}

function writeList(key = '', value = []) {
  set(key, Array.isArray(value) ? value : [])
}

function canAccessModelOps() {
  const member = currentMember()
  const role = String(member.role || '').toLowerCase()
  if (!member || member.status !== 'active') return false
  if (hasPermission('settings.manage', { member }) || hasPermission('analytics.view', { member })) return true
  return ['admin', '管理员', 'tech', '技术', 'algorithm', '算法', 'ops'].some((item) => role.includes(item))
}

function audit(action = '', targetId = '', after = {}) {
  const member = currentMember()
  recordAudit({
    enterpriseId: currentEnterpriseId(),
    userId: member.userId || '',
    operatorId: member.memberId || member.userId || '',
    operator: member.name || member.role || '当前成员',
    action,
    targetType: 'model_operations',
    targetId,
    resourceType: 'model_operations',
    resourceId: targetId,
    after,
    createdAt: nowIso()
  })
}

function normalizeRelease(record = {}) {
  return {
    releaseId: String(record.releaseId || ''),
    enterpriseId: String(record.enterpriseId || currentEnterpriseId()),
    modelId: String(record.modelId || ''),
    modelVersion: String(record.modelVersion || ''),
    status: RELEASE_STATUSES.includes(record.status) ? record.status : 'draft',
    scope: {
      accountIds: Array.isArray(record.scope?.accountIds) ? record.scope.accountIds : [],
      enterpriseIds: Array.isArray(record.scope?.enterpriseIds) ? record.scope.enterpriseIds : [],
      functions: Array.isArray(record.scope?.functions) ? record.scope.functions : ['pattern-making'],
      categories: Array.isArray(record.scope?.categories) ? record.scope.categories : ['女装上衣'],
      taskRatio: Math.min(100, Math.max(0, Number(record.scope?.taskRatio || 1))),
      startAt: record.scope?.startAt || '',
      endAt: record.scope?.endAt || '',
      allowDelivery: Boolean(record.scope?.allowDelivery)
    },
    gates: {
      offlineEvaluation: Boolean(record.gates?.offlineEvaluation),
      patternMakerCheck: Boolean(record.gates?.patternMakerCheck),
      riskConfirmed: Boolean(record.gates?.riskConfirmed),
      grayPlanCreated: Boolean(record.gates?.grayPlanCreated),
      smallScopeEnabled: Boolean(record.gates?.smallScopeEnabled),
      metricsObserved: Boolean(record.gates?.metricsObserved),
      adminActivated: Boolean(record.gates?.adminActivated)
    },
    rollback: record.rollback && typeof record.rollback === 'object' ? record.rollback : null,
    createdBy: String(record.createdBy || currentMember().name || currentMember().memberId || ''),
    createdAt: record.createdAt || nowIso(),
    updatedAt: record.updatedAt || record.createdAt || nowIso()
  }
}

function normalizeIncident(record = {}) {
  return {
    incidentId: String(record.incidentId || ''),
    enterpriseId: String(record.enterpriseId || currentEnterpriseId()),
    type: String(record.type || 'quality'),
    level: INCIDENT_LEVELS.includes(record.level) ? record.level : 'medium',
    title: String(record.title || '模型质量异常'),
    description: String(record.description || ''),
    releaseId: String(record.releaseId || ''),
    modelId: String(record.modelId || ''),
    status: String(record.status || 'open'),
    autoPaused: Boolean(record.autoPaused),
    manualRequired: record.manualRequired !== false,
    createdAt: record.createdAt || nowIso(),
    updatedAt: record.updatedAt || record.createdAt || nowIso()
  }
}

function getEnterpriseReleases() {
  const enterpriseId = currentEnterpriseId()
  return readList(RELEASE_KEY).map(normalizeRelease).filter((item) => item.enterpriseId === enterpriseId)
}

function saveEnterpriseReleases(next = []) {
  const enterpriseId = currentEnterpriseId()
  const other = readList(RELEASE_KEY).map(normalizeRelease).filter((item) => item.enterpriseId !== enterpriseId)
  writeList(RELEASE_KEY, [...next.map(normalizeRelease), ...other])
}

function getEnterpriseIncidents() {
  const enterpriseId = currentEnterpriseId()
  return readList(INCIDENT_KEY).map(normalizeIncident).filter((item) => item.enterpriseId === enterpriseId)
}

function saveEnterpriseIncidents(next = []) {
  const enterpriseId = currentEnterpriseId()
  const other = readList(INCIDENT_KEY).map(normalizeIncident).filter((item) => item.enterpriseId !== enterpriseId)
  writeList(INCIDENT_KEY, [...next.map(normalizeIncident), ...other])
}

function getTaskResultImageUrl(task = {}) {
  const result = task.result || {}
  const firstItem = Array.isArray(result.items) ? result.items[0] : null
  if (typeof firstItem === 'string') return firstItem
  return task.resultImageUrl ||
    result.imageUrl ||
    result.coverUrl ||
    (typeof result.image === 'string' ? result.image : '') ||
    (result.image && (result.image.url || result.image.fileUrl)) ||
    (firstItem && (firstItem.url || firstItem.imageUrl || firstItem.fileUrl)) ||
    ''
}

function isFormalReviewRisk(task = {}) {
  const provider = String(task.provider || task.resultProvider || task.result?.provider || '').toLowerCase()
  const source = String(task.source || task.result?.source || '').toLowerCase()
  const review = String(task.reviewStatus || task.deliveryStatus || '').toLowerCase()
  const formal = ['pending_review', 'review', 'approved', 'pending_delivery', 'delivered'].includes(review)
  return formal && (provider.includes('mock') || provider.includes('fallback') || source.includes('mock') || source.includes('fallback'))
}

function normalizeTaskTrace(task = {}) {
  const input = task.input || {}
  const params = input.params || task.params || {}
  const result = task.result || {}
  return {
    taskId: String(task.taskId || ''),
    modelId: String(task.modelId || params.modelId || result.modelId || result.meta?.modelId || 'untracked'),
    modelVersion: String(task.modelVersion || params.modelVersion || result.modelVersion || result.meta?.modelVersion || '未记录'),
    provider: String(task.provider || result.provider || result.meta?.provider || '未记录'),
    releaseId: String(task.releaseId || params.releaseId || result.releaseId || result.meta?.releaseId || ''),
    experimentGroup: String(task.experimentGroup || params.experimentGroup || result.experimentGroup || result.meta?.experimentGroup || 'default'),
    promptVersion: String(task.promptVersion || params.promptVersion || result.promptVersion || result.meta?.promptVersion || '未记录'),
    functionType: String(task.type || task.taskType || params.taskType || 'unknown'),
    category: String(params.category || params.clothingCategory || params.garmentCategory || '未分类'),
    enterpriseId: String(task.enterpriseId || currentEnterpriseId()),
    status: String(task.status || 'pending'),
    hasResult: Boolean(getTaskResultImageUrl(task)),
    createdAt: task.createdAt || task.submittedAt || '',
    completedAt: task.completedAt || task.updatedAt || '',
    durationMs: Number(task.durationMs || result.durationMs || result.meta?.durationMs || 0),
    retryCount: Number(task.retryCount || task.control?.retryCount || 0),
    quotaRecordId: String(task.quotaRecordId || result.quotaRecordId || result.meta?.quotaRecordId || ''),
    rollbackRecordId: String(task.rollbackRecordId || result.rollbackRecordId || result.meta?.rollbackRecordId || ''),
    reviewStatus: String(task.reviewStatus || ''),
    deliveryStatus: String(task.deliveryStatus || ''),
    formalReviewRisk: isFormalReviewRisk(task)
  }
}

function percentileDuration(traces = []) {
  const durations = traces.map((item) => Number(item.durationMs || 0)).filter((item) => item > 0).sort((a, b) => a - b)
  if (!durations.length) return 0
  return durations[Math.min(durations.length - 1, Math.floor(durations.length * 0.5))]
}

function ratio(part = 0, total = 0) {
  return total ? Math.round((part / total) * 100) : 0
}

function buildMonitoring(traces = []) {
  const total = traces.length
  const success = traces.filter((item) => ['success', 'completed'].includes(item.status)).length
  const failed = traces.filter((item) => ['failed', 'timeout'].includes(item.status)).length
  const timeout = traces.filter((item) => item.status === 'timeout').length
  const retry = traces.filter((item) => item.retryCount > 0).length
  const empty = traces.filter((item) => ['success', 'completed'].includes(item.status) && !item.hasResult).length
  const approved = traces.filter((item) => ['approved', 'delivered'].includes(item.reviewStatus || item.deliveryStatus)).length
  const regenerated = traces.filter((item) => item.retryCount > 0 || String(item.experimentGroup).includes('regen')).length
  const quotaAbnormal = traces.filter((item) => item.quotaRecordId && item.rollbackRecordId).length
  const byModel = {}
  traces.forEach((item) => {
    const key = `${item.modelId}@${item.modelVersion}`
    byModel[key] = (byModel[key] || 0) + 1
  })
  return {
    total,
    successRate: ratio(success, total),
    averageDurationMs: percentileDuration(traces),
    timeoutRate: ratio(timeout, total),
    failureRate: ratio(failed, total),
    retryRate: ratio(retry, total),
    revisionLoad: 0,
    approvalRate: ratio(approved, total),
    regenerateRate: ratio(regenerated, total),
    quotaAbnormal,
    emptyResultCount: empty,
    modelTaskCounts: Object.keys(byModel).map((key) => ({ key, count: byModel[key] })).sort((left, right) => right.count - left.count)
  }
}

function buildAutoIncidents(monitoring = {}, traces = [], releases = []) {
  const incidents = []
  const activeRelease = releases.find((item) => ['gray_running', 'expanded', 'active'].includes(item.status)) || {}
  const addIncident = (type, level, title, description) => {
    incidents.push(normalizeIncident({
      incidentId: `auto_${type}_${activeRelease.releaseId || 'global'}`,
      type,
      level,
      title,
      description,
      releaseId: activeRelease.releaseId || '',
      modelId: activeRelease.modelId || '',
      autoPaused: level === 'high',
      manualRequired: level === 'high'
    }))
  }
  if (monitoring.total > 0 && monitoring.successRate < 70) addIncident('success_rate', 'high', '任务成功率明显下降', `当前成功率 ${monitoring.successRate}%`)
  if (monitoring.timeoutRate >= 20) addIncident('timeout', 'medium', '超时率持续升高', `当前超时率 ${monitoring.timeoutRate}%`)
  if (monitoring.emptyResultCount > 0) addIncident('empty_result', 'high', '空结果增加', `${monitoring.emptyResultCount} 个成功任务缺少结果`)
  if (monitoring.approvalRate > 0 && monitoring.approvalRate < 50) addIncident('approval', 'medium', '审核通过率下降', `当前审核通过率 ${monitoring.approvalRate}%`)
  if (monitoring.quotaAbnormal > 0) addIncident('quota', 'high', '额度扣费与回滚异常', `${monitoring.quotaAbnormal} 条任务同时存在扣费和回滚记录`)
  if (traces.some((item) => item.status === 'processing' && item.createdAt && Date.now() - new Date(item.createdAt).getTime() > 1000 * 60 * 60 * 6)) addIncident('stuck_task', 'high', '任务状态无法结束', '存在长时间 processing 任务')
  if (traces.some((item) => item.formalReviewRisk)) addIncident('mock_review', 'high', 'mock 或 fallback 进入正式审核', '存在测试或兜底结果进入审核/交付链路')
  return incidents
}

function hasPassedRequiredGates(release = {}) {
  const gates = release.gates || {}
  return Boolean(gates.offlineEvaluation && gates.patternMakerCheck && gates.riskConfirmed && gates.grayPlanCreated && gates.smallScopeEnabled && gates.metricsObserved)
}

export function loadModelOperationsCenter({ tasks = [], trainingCenter = {} } = {}) {
  const access = canAccessModelOps()
  if (!access) {
    return {
      canAccess: false,
      releases: [],
      monitoring: buildMonitoring([]),
      incidents: [],
      taskTraces: [],
      models: [],
      stats: { releaseCount: 0, activeReleaseCount: 0, incidentCount: 0, tracedTaskCount: 0 }
    }
  }
  const taskTraces = tasks.map(normalizeTaskTrace).filter((item) => item.enterpriseId === currentEnterpriseId() || !item.enterpriseId)
  const releases = getEnterpriseReleases()
  const storedIncidents = getEnterpriseIncidents()
  const monitoring = buildMonitoring(taskTraces)
  const autoIncidents = buildAutoIncidents(monitoring, taskTraces, releases)
  const incidentMap = new Map([...autoIncidents, ...storedIncidents].map((item) => [item.incidentId, item]))
  const incidents = [...incidentMap.values()].sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt)))
  return {
    canAccess: true,
    releases,
    monitoring,
    incidents,
    taskTraces,
    models: Array.isArray(trainingCenter.models) ? trainingCenter.models : [],
    stats: {
      releaseCount: releases.length,
      activeReleaseCount: releases.filter((item) => ['gray_running', 'expanded', 'active'].includes(item.status)).length,
      incidentCount: incidents.filter((item) => item.status !== 'resolved').length,
      tracedTaskCount: taskTraces.length
    }
  }
}

export function createGrayReleasePlan(model = {}) {
  if (!canAccessModelOps()) return { success: false, errorCode: 'forbidden' }
  if (!model.modelId || !['approved', 'active', 'candidate', 'evaluating'].includes(String(model.status || ''))) {
    return { success: false, errorCode: 'model_required' }
  }
  const now = nowIso()
  const release = normalizeRelease({
    releaseId: createId('release'),
    modelId: model.modelId,
    modelVersion: model.version || '',
    status: 'gray_planned',
    gates: {
      offlineEvaluation: model.status !== 'candidate',
      patternMakerCheck: Boolean(model.patternMakerChecked),
      riskConfirmed: Boolean(model.riskConfirmed),
      grayPlanCreated: true,
      smallScopeEnabled: false,
      metricsObserved: false,
      adminActivated: false
    },
    scope: {
      accountIds: [currentMember().userId || currentMember().memberId || 'current_user'].filter(Boolean),
      enterpriseIds: [currentEnterpriseId()],
      functions: ['pattern-making'],
      categories: ['女装上衣'],
      taskRatio: 1,
      startAt: now,
      endAt: '',
      allowDelivery: false
    },
    createdAt: now,
    updatedAt: now
  })
  saveEnterpriseReleases([release, ...getEnterpriseReleases()])
  audit('创建模型灰度计划', release.releaseId, { modelId: release.modelId, scope: release.scope })
  return { success: true, release }
}

export function advanceReleaseGate(releaseId = '', gate = '') {
  if (!canAccessModelOps()) return { success: false, errorCode: 'forbidden' }
  const list = getEnterpriseReleases()
  const target = list.find((item) => item.releaseId === releaseId)
  if (!target) return { success: false, errorCode: 'release_not_found' }
  const next = normalizeRelease({
    ...target,
    gates: { ...target.gates, [gate]: true },
    status: gate === 'smallScopeEnabled' ? 'gray_running' : target.status,
    updatedAt: nowIso()
  })
  saveEnterpriseReleases(list.map((item) => item.releaseId === releaseId ? next : item))
  audit('更新模型发布门禁', releaseId, { gate })
  return { success: true, release: next }
}

export function expandRelease(releaseId = '') {
  if (!canAccessModelOps()) return { success: false, errorCode: 'forbidden' }
  const list = getEnterpriseReleases()
  const target = list.find((item) => item.releaseId === releaseId)
  if (!target) return { success: false, errorCode: 'release_not_found' }
  if (!hasPassedRequiredGates(target)) return { success: false, errorCode: 'release_gates_incomplete' }
  const next = normalizeRelease({
    ...target,
    status: target.status === 'expanded' ? 'active' : 'expanded',
    scope: { ...target.scope, taskRatio: Math.min(20, Math.max(5, Number(target.scope.taskRatio || 1) * 5)) },
    gates: { ...target.gates, adminActivated: target.status === 'expanded' },
    updatedAt: nowIso()
  })
  saveEnterpriseReleases(list.map((item) => item.releaseId === releaseId ? next : item))
  audit(next.status === 'active' ? '正式激活模型版本' : '扩大模型灰度', releaseId, { status: next.status, scope: next.scope })
  return { success: true, release: next }
}

export function pauseRelease(releaseId = '', reason = '指标异常，暂停扩大灰度') {
  if (!canAccessModelOps()) return { success: false, errorCode: 'forbidden' }
  const list = getEnterpriseReleases()
  const target = list.find((item) => item.releaseId === releaseId)
  if (!target) return { success: false, errorCode: 'release_not_found' }
  const next = normalizeRelease({ ...target, status: 'paused', updatedAt: nowIso() })
  saveEnterpriseReleases(list.map((item) => item.releaseId === releaseId ? next : item))
  const incident = normalizeIncident({
    incidentId: createId('incident'),
    type: 'manual_pause',
    level: 'medium',
    title: '灰度发布已暂停',
    description: reason,
    releaseId,
    modelId: target.modelId,
    autoPaused: false,
    manualRequired: true
  })
  saveEnterpriseIncidents([incident, ...getEnterpriseIncidents()])
  audit('暂停模型灰度', releaseId, { reason })
  return { success: true, release: next, incident }
}

export function rollbackRelease(releaseId = '', reason = '人工确认回滚') {
  if (!canAccessModelOps()) return { success: false, errorCode: 'forbidden' }
  const list = getEnterpriseReleases()
  const target = list.find((item) => item.releaseId === releaseId)
  if (!target) return { success: false, errorCode: 'release_not_found' }
  const previous = list.find((item) => item.status === 'active' && item.releaseId !== releaseId) || {}
  const rollback = {
    reason,
    operator: currentMember().name || currentMember().memberId || '当前成员',
    fromModelVersion: target.modelVersion,
    toModelVersion: previous.modelVersion || '上一个已批准版本',
    scope: target.scope,
    rolledBackAt: nowIso()
  }
  const next = normalizeRelease({ ...target, status: 'rolled_back', rollback, updatedAt: nowIso() })
  saveEnterpriseReleases(list.map((item) => item.releaseId === releaseId ? next : item))
  audit('回滚模型灰度发布', releaseId, rollback)
  return { success: true, release: next }
}

export function resolveIncident(incidentId = '') {
  if (!canAccessModelOps()) return { success: false, errorCode: 'forbidden' }
  const list = getEnterpriseIncidents()
  const existing = list.find((item) => item.incidentId === incidentId)
  const next = normalizeIncident({
    ...(existing || { incidentId, title: '自动异常已人工确认' }),
    status: 'resolved',
    updatedAt: nowIso()
  })
  saveEnterpriseIncidents([next, ...list.filter((item) => item.incidentId !== incidentId)])
  audit('处理模型质量异常', incidentId, { status: 'resolved' })
  return { success: true, incident: next }
}
