import { getCurrentMember, getCurrentUser } from '../auth/authRepository.js'
import { requireActiveMember, requirePermission } from '../enterprise-web/enterpriseWebGuard.js'
import { getCurrentEnterpriseId } from '../tenant/tenantContext.js'

const SUPPORT_TICKET_KEY = 'diebians_support_tickets_v1'

export const SUPPORT_TICKET_TYPES = Object.freeze([
  { key: 'ai_generation_failed', label: 'AI生成失败' },
  { key: 'generation_quality', label: '生成效果问题' },
  { key: 'pattern_making', label: 'AI制版问题' },
  { key: 'pattern_review', label: '版型审核问题' },
  { key: 'quota_billing', label: '额度与扣费' },
  { key: 'upload_download', label: '上传或下载失败' },
  { key: 'account_permission', label: '账号与权限' },
  { key: 'project_delivery', label: '项目与交付' },
  { key: 'enterprise_cooperation', label: '企业合作' },
  { key: 'product_suggestion', label: '产品建议' }
])

export const SUPPORT_TICKET_STATUSES = Object.freeze(['new', 'assigned', 'investigating', 'waiting_user', 'resolved', 'closed', 'reopened'])
export const SUPPORT_TICKET_PRIORITIES = Object.freeze(['P0', 'P1', 'P2', 'P3'])

function nowIso() {
  return new Date().toISOString()
}

function safeUniGet(key, fallback) {
  try {
    const value = uni.getStorageSync(key)
    return value === undefined || value === null || value === '' ? fallback : value
  } catch (error) {
    return fallback
  }
}

function safeUniSet(key, value) {
  try {
    uni.setStorageSync(key, value)
  } catch (error) {}
}

function sanitizeText(value = '', limit = 500) {
  return String(value || '')
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email]')
    .replace(/1[3-9]\d{9}/g, '[phone]')
    .replace(/https?:\/\/[^\s"'<>]+/gi, '[url]')
    .replace(/([?&](?:token|sessionToken|apiKey|secret|signature)=)[^&\s]+/gi, '$1[redacted]')
    .slice(0, limit)
}

function getTypeLabel(type = '') {
  const item = SUPPORT_TICKET_TYPES.find((entry) => entry.key === type)
  return item ? item.label : '产品建议'
}

function inferPriority(type = '', description = '') {
  const text = `${type} ${description}`.toLowerCase()
  if (/数据泄露|泄露|重复扣费|错误交付|p0/.test(text)) return 'P0'
  if (['ai_generation_failed', 'quota_billing', 'upload_download'].includes(type) || /核心流程|无法使用|不可用|p1/.test(text)) return 'P1'
  if (['generation_quality', 'pattern_making', 'pattern_review', 'project_delivery'].includes(type)) return 'P2'
  return 'P3'
}

function getBrowserInfo() {
  // #ifdef H5
  if (typeof window !== 'undefined' && window.navigator) {
    return sanitizeText(`${window.navigator.userAgent || ''} ${window.location && window.location.pathname ? window.location.pathname : ''}`, 260)
  }
  // #endif
  return ''
}

function normalizeActivity(activity = {}) {
  const type = ['user_reply', 'internal_note', 'system_log', 'status_change', 'quota_compensation_request'].includes(activity.type)
    ? activity.type
    : 'system_log'
  return {
    activityId: String(activity.activityId || `act_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`),
    type,
    visibility: type === 'internal_note' || type === 'quota_compensation_request' ? 'internal' : 'user',
    operatorId: sanitizeText(activity.operatorId || '', 80),
    operatorName: sanitizeText(activity.operatorName || '', 80),
    content: sanitizeText(activity.content || '', 600),
    createdAt: activity.createdAt || nowIso()
  }
}

function normalizeQuotaCompensation(record = {}) {
  return {
    compensationId: String(record.compensationId || `comp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`),
    sourceUsageRecordId: sanitizeText(record.sourceUsageRecordId || '', 120),
    amount: Number(record.amount || 0),
    reason: sanitizeText(record.reason || '', 260),
    approver: sanitizeText(record.approver || '', 80),
    operator: sanitizeText(record.operator || '', 80),
    idempotencyKey: sanitizeText(record.idempotencyKey || '', 120),
    status: ['requested', 'approved', 'rejected'].includes(record.status) ? record.status : 'requested',
    createdAt: record.createdAt || nowIso()
  }
}

function normalizeTicket(ticket = {}) {
  const createdAt = ticket.createdAt || nowIso()
  const status = SUPPORT_TICKET_STATUSES.includes(ticket.status) ? ticket.status : 'new'
  const type = SUPPORT_TICKET_TYPES.some((entry) => entry.key === ticket.type) ? ticket.type : 'product_suggestion'
  return {
    ticketId: String(ticket.ticketId || `ticket_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`),
    enterpriseId: String(ticket.enterpriseId || getCurrentEnterpriseId()),
    userId: sanitizeText(ticket.userId || '', 100),
    memberId: sanitizeText(ticket.memberId || '', 100),
    type,
    typeLabel: getTypeLabel(type),
    title: sanitizeText(ticket.title || getTypeLabel(type), 120),
    description: sanitizeText(ticket.description || '', 800),
    status,
    priority: SUPPORT_TICKET_PRIORITIES.includes(ticket.priority) ? ticket.priority : inferPriority(type, ticket.description),
    owner: sanitizeText(ticket.owner || '', 80),
    waitingSide: sanitizeText(ticket.waitingSide || (status === 'waiting_user' ? 'user' : 'support'), 40),
    sourcePage: sanitizeText(ticket.sourcePage || 'workspace', 160),
    taskId: sanitizeText(ticket.taskId || '', 100),
    projectId: sanitizeText(ticket.projectId || '', 100),
    batchId: sanitizeText(ticket.batchId || '', 100),
    assetId: sanitizeText(ticket.assetId || '', 100),
    patternId: sanitizeText(ticket.patternId || '', 100),
    recentErrorCode: sanitizeText(ticket.recentErrorCode || '', 100),
    browserInfo: sanitizeText(ticket.browserInfo || '', 260),
    environment: sanitizeText(ticket.environment || '', 80),
    firstResponseAt: ticket.firstResponseAt || '',
    lastReplyAt: ticket.lastReplyAt || '',
    resolvedAt: ticket.resolvedAt || '',
    closedAt: ticket.closedAt || '',
    activities: Array.isArray(ticket.activities) ? ticket.activities.map(normalizeActivity) : [],
    quotaCompensations: Array.isArray(ticket.quotaCompensations) ? ticket.quotaCompensations.map(normalizeQuotaCompensation) : [],
    createdAt,
    updatedAt: ticket.updatedAt || createdAt
  }
}

function readTickets() {
  const value = safeUniGet(SUPPORT_TICKET_KEY, [])
  return Array.isArray(value) ? value.map(normalizeTicket) : []
}

function writeTickets(tickets = []) {
  safeUniSet(SUPPORT_TICKET_KEY, tickets.map(normalizeTicket))
}

function currentActor() {
  const user = getCurrentUser()
  const member = getCurrentMember()
  return {
    user,
    member,
    enterpriseId: getCurrentEnterpriseId(),
    canManage: requirePermission('support.manage').allowed || requirePermission('analytics.view').allowed
  }
}

function canAccessTicket(ticket = {}) {
  const actor = currentActor()
  if (ticket.enterpriseId !== actor.enterpriseId) return false
  return actor.canManage || ticket.userId === actor.user.userId || ticket.memberId === actor.member.memberId
}

function redactTicketForActor(ticket = {}, actor = currentActor()) {
  const normalized = normalizeTicket(ticket)
  if (actor.canManage) return normalized
  return {
    ...normalized,
    activities: normalized.activities.filter((item) => item.visibility !== 'internal'),
    quotaCompensations: []
  }
}

function buildActivity(type = 'system_log', content = '') {
  const actor = currentActor()
  return normalizeActivity({
    type,
    operatorId: actor.member.memberId || actor.user.userId,
    operatorName: actor.user.name || actor.member.role || '当前用户',
    content
  })
}

export function createSupportTicket(input = {}) {
  const guard = requireActiveMember()
  if (!guard.allowed) return { success: false, errorCode: guard.reason || 'not_authenticated' }
  const actor = currentActor()
  const type = SUPPORT_TICKET_TYPES.some((entry) => entry.key === input.type) ? input.type : 'product_suggestion'
  const description = sanitizeText(input.description || '', 800)
  if (!description) return { success: false, errorCode: 'description_required' }
  const ticket = normalizeTicket({
    ...input,
    enterpriseId: actor.enterpriseId,
    userId: actor.user.userId,
    memberId: actor.member.memberId,
    type,
    priority: inferPriority(type, description),
    description,
    browserInfo: getBrowserInfo(),
    environment: input.environment || 'h5',
    activities: [normalizeActivity({
      type: 'system_log',
      operatorId: actor.member.memberId || actor.user.userId,
      operatorName: actor.user.name || '当前用户',
      content: '工单已创建，系统自动关联当前用户、企业和上下文资源。'
    })]
  })
  writeTickets([ticket, ...readTickets()])
  return { success: true, ticket }
}

export function listSupportTickets() {
  const actor = currentActor()
  return readTickets()
    .filter((ticket) => ticket.enterpriseId === actor.enterpriseId)
    .filter((ticket) => actor.canManage || ticket.userId === actor.user.userId || ticket.memberId === actor.member.memberId)
    .map((ticket) => redactTicketForActor(ticket, actor))
    .sort((left, right) => String(right.updatedAt).localeCompare(String(left.updatedAt)))
}

export function getSupportTicket(ticketId = '') {
  const ticket = readTickets().find((item) => item.ticketId === ticketId)
  if (!ticket) return { success: false, errorCode: 'ticket_not_found' }
  if (!canAccessTicket(ticket)) return { success: false, errorCode: 'tenant_denied' }
  return { success: true, ticket: redactTicketForActor(ticket) }
}

export function updateSupportTicket(ticketId = '', patch = {}) {
  const actor = currentActor()
  if (!actor.canManage) return { success: false, errorCode: 'permission_denied' }
  let updated = null
  const next = readTickets().map((ticket) => {
    if (ticket.ticketId !== ticketId || ticket.enterpriseId !== actor.enterpriseId) return ticket
    const oldStatus = ticket.status
    const nextStatus = SUPPORT_TICKET_STATUSES.includes(patch.status) ? patch.status : ticket.status
    const now = nowIso()
    const activity = oldStatus !== nextStatus ? buildActivity('status_change', `状态从 ${oldStatus} 更新为 ${nextStatus}`) : null
    updated = normalizeTicket({
      ...ticket,
      status: nextStatus,
      priority: SUPPORT_TICKET_PRIORITIES.includes(patch.priority) ? patch.priority : ticket.priority,
      owner: patch.owner !== undefined ? patch.owner : ticket.owner,
      waitingSide: patch.waitingSide !== undefined ? patch.waitingSide : ticket.waitingSide,
      firstResponseAt: ticket.firstResponseAt || (nextStatus !== 'new' ? now : ''),
      resolvedAt: nextStatus === 'resolved' ? now : ticket.resolvedAt,
      closedAt: nextStatus === 'closed' ? now : ticket.closedAt,
      activities: activity ? [activity, ...ticket.activities] : ticket.activities,
      updatedAt: now
    })
    return updated
  })
  writeTickets(next)
  return updated ? { success: true, ticket: updated } : { success: false, errorCode: 'ticket_not_found' }
}

export function addTicketReply(ticketId = '', content = '', internal = false) {
  const target = getSupportTicket(ticketId)
  if (!target.success) return target
  const actor = currentActor()
  if (internal && !actor.canManage) return { success: false, errorCode: 'permission_denied' }
  const activity = buildActivity(internal ? 'internal_note' : 'user_reply', content)
  let updated = null
  const next = readTickets().map((ticket) => {
    if (ticket.ticketId !== ticketId || !canAccessTicket(ticket)) return ticket
    const now = nowIso()
    updated = normalizeTicket({
      ...ticket,
      activities: [activity, ...ticket.activities],
      lastReplyAt: now,
      waitingSide: internal ? ticket.waitingSide : 'support',
      updatedAt: now
    })
    return updated
  })
  writeTickets(next)
  return updated ? { success: true, ticket: updated } : { success: false, errorCode: 'ticket_not_found' }
}

export function requestQuotaCompensation(ticketId = '', input = {}) {
  const actor = currentActor()
  if (!actor.canManage) return { success: false, errorCode: 'permission_denied' }
  if (!input.sourceUsageRecordId || !Number(input.amount)) return { success: false, errorCode: 'quota_record_required' }
  let updated = null
  const record = normalizeQuotaCompensation({
    ...input,
    operator: actor.user.name || actor.member.memberId,
    createdAt: nowIso()
  })
  const next = readTickets().map((ticket) => {
    if (ticket.ticketId !== ticketId || ticket.enterpriseId !== actor.enterpriseId) return ticket
    if (ticket.quotaCompensations.some((item) => item.idempotencyKey && item.idempotencyKey === record.idempotencyKey)) {
      updated = ticket
      return ticket
    }
    updated = normalizeTicket({
      ...ticket,
      quotaCompensations: [record, ...ticket.quotaCompensations],
      activities: [buildActivity('quota_compensation_request', `已记录额度补偿申请：${record.amount}`), ...ticket.activities],
      updatedAt: nowIso()
    })
    return updated
  })
  writeTickets(next)
  return updated ? { success: true, ticket: updated, compensation: record } : { success: false, errorCode: 'ticket_not_found' }
}

export function loadSupportCenter(ticketId = '') {
  const active = requireActiveMember()
  if (!active.allowed) {
    return {
      canAccess: false,
      canManage: false,
      reason: active.reason || '',
      tickets: [],
      selectedTicket: null,
      stats: { total: 0, open: 0, p0: 0, waitingUser: 0, resolved: 0 },
      typeOptions: SUPPORT_TICKET_TYPES,
      statusOptions: SUPPORT_TICKET_STATUSES,
      priorityOptions: SUPPORT_TICKET_PRIORITIES
    }
  }
  const tickets = listSupportTickets()
  const selected = ticketId ? getSupportTicket(ticketId) : { success: false }
  const openStatuses = ['new', 'assigned', 'investigating', 'waiting_user', 'reopened']
  return {
    canAccess: true,
    canManage: currentActor().canManage,
    reason: '',
    tickets,
    selectedTicket: selected.success ? selected.ticket : null,
    stats: {
      total: tickets.length,
      open: tickets.filter((item) => openStatuses.includes(item.status)).length,
      p0: tickets.filter((item) => item.priority === 'P0').length,
      waitingUser: tickets.filter((item) => item.status === 'waiting_user').length,
      resolved: tickets.filter((item) => item.status === 'resolved' || item.status === 'closed').length
    },
    typeOptions: SUPPORT_TICKET_TYPES,
    statusOptions: SUPPORT_TICKET_STATUSES,
    priorityOptions: SUPPORT_TICKET_PRIORITIES
  }
}
