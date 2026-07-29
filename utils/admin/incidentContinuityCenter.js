import { get, set } from '../data-provider/dataProvider.js'
import { requirePlatformAdmin } from './platformAdminRepository.js'
import { writeStructuredLog } from '../observability/traceLogger.js'

const INCIDENT_KEY = 'diebians_incident_continuity_incidents_v1'
const SWITCH_KEY = 'diebians_incident_continuity_switches_v1'
const RECOVERY_KEY = 'diebians_incident_continuity_recovery_v1'

export const INCIDENT_LEVELS = Object.freeze([
  {
    key: 'P0',
    label: 'P0',
    title: '数据泄露、跨企业访问、重复扣费、错误正式交付',
    owner: '平台负责人 + 安全负责人 + 业务负责人',
    response: '立即暂停高风险功能，冻结相关交付，启动复盘和数据修复。',
    recovery: '越权、扣费和交付数据全部校验通过，P0 回归用例补齐。'
  },
  {
    key: 'P1',
    label: 'P1',
    title: '登录、上传、生成、审核或交付主链不可用',
    owner: '值班工程师 + 产品负责人',
    response: '暂停受影响入口，保留已创建数据，优先恢复主链。',
    recovery: '主链冒烟通过，任务、额度、审核和交付状态一致。'
  },
  {
    key: 'P2',
    label: 'P2',
    title: '单个功能或部分用户异常',
    owner: '模块负责人',
    response: '限制异常功能或灰度范围，给出替代流程。',
    recovery: '受影响功能恢复，失败样本完成回归。'
  },
  {
    key: 'P3',
    label: 'P3',
    title: '样式、文案和非核心体验问题',
    owner: '产品/前端负责人',
    response: '记录问题并安排普通迭代。',
    recovery: '修复后完成页面检查。'
  }
])

export const PUBLIC_COMPONENTS = Object.freeze([
  { key: 'website', label: '网站', defaultStatus: 'operational' },
  { key: 'login', label: '登录', defaultStatus: 'operational' },
  { key: 'upload', label: '文件上传', defaultStatus: 'operational' },
  { key: 'ai_output', label: 'AI出图', defaultStatus: 'operational' },
  { key: 'pattern_making', label: 'AI制版', defaultStatus: 'operational' },
  { key: 'task_query', label: '任务查询', defaultStatus: 'operational' },
  { key: 'download_delivery', label: '下载与交付', defaultStatus: 'operational' }
])

export const EMERGENCY_SWITCHES = Object.freeze([
  { key: 'new_task_creation', label: '新任务创建', component: 'ai_output', defaultPaused: false },
  { key: 'ai_feature', label: '指定AI功能', component: 'ai_output', defaultPaused: false },
  { key: 'provider', label: '指定provider', component: 'ai_output', defaultPaused: false },
  { key: 'batch_task', label: '批量任务', component: 'ai_output', defaultPaused: false },
  { key: 'formal_delivery', label: '正式交付', component: 'download_delivery', defaultPaused: false },
  { key: 'api_call', label: 'API调用', component: 'task_query', defaultPaused: false },
  { key: 'training_task', label: '训练任务', component: 'pattern_making', defaultPaused: false },
  { key: 'file_download', label: '文件下载', component: 'download_delivery', defaultPaused: false }
])

export const INCIDENT_STATUSES = Object.freeze(['open', 'mitigating', 'recovering', 'resolved', 'postmortem'])
export const PUBLIC_STATUS = Object.freeze(['operational', 'degraded', 'partial_outage', 'major_outage', 'maintenance'])

export const TASK_RECOVERY_RULES = Object.freeze([
  { state: 'not_submitted', label: '未提交', action: '允许重新提交', guardrail: '不产生扣费记录。' },
  { state: 'precharged_not_called', label: '已预扣未调用', action: '安全回滚', guardrail: '按 idempotencyKey 找到预扣记录，只回滚一次。' },
  { state: 'called_unknown', label: '已调用状态未知', action: '先查询供应商', guardrail: '禁止重复提交，直到确认供应商是否接受任务。' },
  { state: 'async_accepted', label: '已接受异步任务', action: '恢复轮询', guardrail: '沿用供应商 taskId，不重新创建任务。' },
  { state: 'failed', label: '明确失败', action: '按规则回滚并允许重试', guardrail: '仅失败项重试，成功项跳过。' },
  { state: 'success', label: '已成功', action: '恢复结果和资产关联', guardrail: '不得重复扣费或覆盖已交付版本。' }
])

export const QUOTA_GUARDRAILS = Object.freeze([
  '相同幂等键不重复扣费',
  '未确认失败不得盲目回滚',
  '已终态记录不可重复修改',
  '补偿必须生成独立记录',
  '批量任务只处理未完成项'
])

export const DELIVERY_BLOCKERS = Object.freeze([
  '结果来源不明',
  'mock或fallback标记',
  '审核记录缺失',
  '文件不可访问',
  '资产版本不一致',
  '项目权限异常',
  '批次统计不一致'
])

export const RECOVERY_CHECKLIST = Object.freeze([
  '登录正常',
  '上传正常',
  '单任务生成正常',
  '额度消费正常',
  '失败回滚正常',
  '任务轮询正常',
  '审核红线正常',
  '下载与交付正常',
  '权限隔离正常'
])

function nowIso() {
  return new Date().toISOString()
}

function createId(prefix = 'incident') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

function readList(key = '') {
  const value = get(key, [])
  return Array.isArray(value) ? value : []
}

function writeList(key = '', records = []) {
  set(key, Array.isArray(records) ? records : [])
}

function normalizeLevel(level = 'P2') {
  return INCIDENT_LEVELS.some((item) => item.key === level) ? level : 'P2'
}

function normalizeIncident(record = {}) {
  const level = normalizeLevel(record.level)
  return {
    incidentId: String(record.incidentId || createId('incident')),
    level,
    status: INCIDENT_STATUSES.includes(record.status) ? record.status : 'open',
    title: String(record.title || '未命名故障'),
    description: String(record.description || ''),
    affectedComponents: Array.isArray(record.affectedComponents) ? record.affectedComponents.filter((item) => PUBLIC_COMPONENTS.some((component) => component.key === item)) : [],
    affectedUserCount: Math.max(0, Number(record.affectedUserCount || 0)),
    affectedTaskCount: Math.max(0, Number(record.affectedTaskCount || 0)),
    temporaryActions: Array.isArray(record.temporaryActions) ? record.temporaryActions.map(String) : [],
    rootCause: String(record.rootCause || ''),
    dataRepair: String(record.dataRepair || ''),
    owner: String(record.owner || INCIDENT_LEVELS.find((item) => item.key === level)?.owner || ''),
    followUps: Array.isArray(record.followUps) ? record.followUps.map(String) : [],
    startedAt: record.startedAt || nowIso(),
    recoveredAt: record.recoveredAt || '',
    createdAt: record.createdAt || record.startedAt || nowIso(),
    updatedAt: record.updatedAt || nowIso()
  }
}

function normalizeSwitch(record = {}) {
  const base = EMERGENCY_SWITCHES.find((item) => item.key === record.switchKey) || {}
  return {
    switchKey: String(record.switchKey || base.key || ''),
    label: String(record.label || base.label || '未命名开关'),
    component: String(record.component || base.component || 'website'),
    paused: Boolean(record.paused),
    reason: String(record.reason || ''),
    incidentId: String(record.incidentId || ''),
    updatedBy: String(record.updatedBy || 'platform_admin'),
    updatedAt: record.updatedAt || nowIso()
  }
}

function normalizeRecovery(record = {}) {
  return {
    recoveryId: String(record.recoveryId || createId('recovery')),
    incidentId: String(record.incidentId || ''),
    checklist: RECOVERY_CHECKLIST.map((label) => {
      const found = Array.isArray(record.checklist) ? record.checklist.find((item) => item.label === label) : null
      return {
        label,
        passed: Boolean(found && found.passed),
        note: String(found && found.note ? found.note : '')
      }
    }),
    verifiedBy: String(record.verifiedBy || ''),
    verifiedAt: record.verifiedAt || '',
    createdAt: record.createdAt || nowIso()
  }
}

function listIncidents() {
  return readList(INCIDENT_KEY).map(normalizeIncident).sort((left, right) => String(right.startedAt).localeCompare(String(left.startedAt)))
}

function saveIncidents(records = []) {
  writeList(INCIDENT_KEY, records.map(normalizeIncident))
}

function listSwitches() {
  const stored = readList(SWITCH_KEY)
  const byKey = new Map(stored.map((item) => [item.switchKey, item]))
  return EMERGENCY_SWITCHES.map((item) => normalizeSwitch({ ...item, ...(byKey.get(item.key) || {}), switchKey: item.key, label: item.label, component: item.component }))
}

function saveSwitches(records = []) {
  writeList(SWITCH_KEY, records.map(normalizeSwitch))
}

function listRecoveries() {
  return readList(RECOVERY_KEY).map(normalizeRecovery)
}

function saveRecoveries(records = []) {
  writeList(RECOVERY_KEY, records.map(normalizeRecovery))
}

function publicStatusFromIncidents(componentKey = '', incidents = [], switches = []) {
  const relatedIncidents = incidents.filter((incident) => (
    ['open', 'mitigating', 'recovering'].includes(incident.status) &&
    incident.affectedComponents.includes(componentKey)
  ))
  const relatedSwitch = switches.find((item) => item.component === componentKey && item.paused)
  if (relatedIncidents.some((incident) => incident.level === 'P0')) return 'major_outage'
  if (relatedIncidents.some((incident) => incident.level === 'P1')) return 'partial_outage'
  if (relatedSwitch) return 'maintenance'
  if (relatedIncidents.length) return 'degraded'
  return 'operational'
}

function publicStatusLabel(status = '') {
  const labels = {
    operational: '正常',
    degraded: '性能下降',
    partial_outage: '部分中断',
    major_outage: '重大故障',
    maintenance: '维护中'
  }
  return labels[status] || '未知'
}

export function loadPublicStatusPage() {
  const incidents = listIncidents()
  const switches = listSwitches()
  const components = PUBLIC_COMPONENTS.map((component) => {
    const status = publicStatusFromIncidents(component.key, incidents, switches)
    return {
      key: component.key,
      label: component.label,
      status,
      statusLabel: publicStatusLabel(status)
    }
  })
  const activeIncidents = incidents
    .filter((incident) => ['open', 'mitigating', 'recovering'].includes(incident.status))
    .map((incident) => ({
      incidentId: incident.incidentId,
      level: incident.level,
      status: incident.status,
      title: incident.title,
      affectedComponents: incident.affectedComponents.map((key) => PUBLIC_COMPONENTS.find((item) => item.key === key)?.label || key),
      startedAt: incident.startedAt,
      updatedAt: incident.updatedAt
    }))
  return {
    updatedAt: nowIso(),
    overallStatus: components.some((item) => item.status === 'major_outage')
      ? 'major_outage'
      : (components.some((item) => item.status === 'partial_outage') ? 'partial_outage' : (components.some((item) => item.status !== 'operational') ? 'degraded' : 'operational')),
    components,
    activeIncidents,
    userNoticeRules: [
      '仅展示受影响功能、当前状态、是否需要用户操作和额度处理方式。',
      '不展示内部供应商名称、服务器地址、安全细节或错误堆栈。',
      '恢复时间只在确认后更新，不给出不确定承诺。'
    ]
  }
}

export function loadIncidentAdminCenter() {
  const guard = requirePlatformAdmin()
  if (!guard.allowed) {
    return {
      canAccess: false,
      reason: guard.reason,
      incidents: [],
      switches: [],
      recoveries: [],
      levels: INCIDENT_LEVELS,
      taskRecoveryRules: TASK_RECOVERY_RULES,
      quotaGuardrails: QUOTA_GUARDRAILS,
      deliveryBlockers: DELIVERY_BLOCKERS,
      recoveryChecklist: RECOVERY_CHECKLIST
    }
  }
  const incidents = listIncidents()
  const switches = listSwitches()
  const recoveries = listRecoveries()
  return {
    canAccess: true,
    reason: '',
    incidents,
    switches,
    recoveries,
    levels: INCIDENT_LEVELS,
    taskRecoveryRules: TASK_RECOVERY_RULES,
    quotaGuardrails: QUOTA_GUARDRAILS,
    deliveryBlockers: DELIVERY_BLOCKERS,
    recoveryChecklist: RECOVERY_CHECKLIST,
    stats: {
      openCount: incidents.filter((item) => ['open', 'mitigating', 'recovering'].includes(item.status)).length,
      p0p1Count: incidents.filter((item) => ['P0', 'P1'].includes(item.level) && ['open', 'mitigating', 'recovering'].includes(item.status)).length,
      pausedSwitchCount: switches.filter((item) => item.paused).length,
      recoveryCount: recoveries.length
    },
    updatedAt: nowIso()
  }
}

export function createIncident(input = {}) {
  const guard = requirePlatformAdmin()
  if (!guard.allowed) return { success: false, errorCode: guard.reason }
  const incident = normalizeIncident(input)
  saveIncidents([incident, ...listIncidents()])
  writeStructuredLog({
    level: incident.level === 'P0' ? 'critical' : (incident.level === 'P1' ? 'error' : 'warn'),
    module: 'admin',
    action: 'incident_created',
    status: incident.status,
    errorCode: `incident_${incident.level.toLowerCase()}`,
    data: { incidentId: incident.incidentId, level: incident.level, affectedComponents: incident.affectedComponents }
  })
  return { success: true, incident }
}

export function updateIncidentStatus(incidentId = '', status = 'mitigating', patch = {}) {
  const guard = requirePlatformAdmin()
  if (!guard.allowed) return { success: false, errorCode: guard.reason }
  if (!INCIDENT_STATUSES.includes(status)) return { success: false, errorCode: 'invalid_incident_status' }
  let updated = null
  const incidents = listIncidents().map((incident) => {
    if (incident.incidentId !== incidentId) return incident
    updated = normalizeIncident({
      ...incident,
      ...patch,
      status,
      recoveredAt: status === 'resolved' ? (patch.recoveredAt || nowIso()) : incident.recoveredAt,
      updatedAt: nowIso()
    })
    return updated
  })
  if (!updated) return { success: false, errorCode: 'incident_not_found' }
  saveIncidents(incidents)
  writeStructuredLog({
    level: status === 'resolved' ? 'info' : 'warn',
    module: 'admin',
    action: 'incident_status_update',
    status,
    errorCode: '',
    data: { incidentId, level: updated.level }
  })
  return { success: true, incident: updated }
}

export function setEmergencySwitch(switchKey = '', paused = true, input = {}) {
  const guard = requirePlatformAdmin()
  if (!guard.allowed) return { success: false, errorCode: guard.reason }
  if (!EMERGENCY_SWITCHES.some((item) => item.key === switchKey)) return { success: false, errorCode: 'invalid_switch' }
  const switches = listSwitches()
  let updated = null
  const next = switches.map((item) => {
    if (item.switchKey !== switchKey) return item
    updated = normalizeSwitch({
      ...item,
      paused,
      reason: input.reason || item.reason,
      incidentId: input.incidentId || item.incidentId,
      updatedBy: input.updatedBy || 'platform_admin',
      updatedAt: nowIso()
    })
    return updated
  })
  saveSwitches(next)
  writeStructuredLog({
    level: paused ? 'critical' : 'info',
    module: 'admin',
    action: paused ? 'emergency_switch_paused' : 'emergency_switch_resumed',
    status: paused ? 'paused' : 'active',
    data: { switchKey, incidentId: updated.incidentId }
  })
  return { success: true, switch: updated }
}

export function createRecoveryChecklist(incidentId = '', checklist = [], input = {}) {
  const guard = requirePlatformAdmin()
  if (!guard.allowed) return { success: false, errorCode: guard.reason }
  const incident = listIncidents().find((item) => item.incidentId === incidentId)
  if (!incident) return { success: false, errorCode: 'incident_not_found' }
  const recovery = normalizeRecovery({
    incidentId,
    checklist,
    verifiedBy: input.verifiedBy || 'platform_admin',
    verifiedAt: checklist.every((item) => item.passed) ? nowIso() : ''
  })
  saveRecoveries([recovery, ...listRecoveries().filter((item) => item.incidentId !== incidentId)])
  writeStructuredLog({
    level: recovery.verifiedAt ? 'info' : 'warn',
    module: 'admin',
    action: 'incident_recovery_checklist',
    status: recovery.verifiedAt ? 'passed' : 'pending',
    data: { incidentId, recoveryId: recovery.recoveryId }
  })
  return { success: true, recovery }
}

export function getTaskRecoveryDecision(state = '') {
  const key = String(state || '').trim()
  return TASK_RECOVERY_RULES.find((item) => item.state === key) || TASK_RECOVERY_RULES[0]
}

export function shouldPauseFormalDelivery(reason = '') {
  const text = String(reason || '')
  return DELIVERY_BLOCKERS.some((item) => text.includes(item))
}

