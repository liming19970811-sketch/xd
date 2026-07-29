import { getCurrentMember, getCurrentUser } from '../auth/authRepository.js'
import { requirePermission } from '../enterprise-web/enterpriseWebGuard.js'
import { getList as getEnterpriseList } from '../repository/enterpriseRepository.js'
import { listSupportTickets } from '../support/supportTicketRepository.js'
import { listTasks } from '../task/taskLayer.js'
import { getProjects } from '../project/projectRepository.js'
import { listWorkspaceBatches } from '../workspace/workspaceBatchDeliveryCenter.js'
import { listWorkspaceDeliveries } from '../workspace/workspaceBatchDeliveryCenter.js'
import { loadProductAnalyticsCenter } from '../analytics/productAnalyticsRepository.js'
import { loadPatternTrainingCenter } from '../workspace/workspacePatternTrainingCenter.js'
import { loadModelOperationsCenter } from '../workspace/workspaceModelOperationsCenter.js'

const PLATFORM_ADMIN_ROLES = Object.freeze(['platform_admin', 'super_admin', '平台管理员'])

function nowIso() {
  return new Date().toISOString()
}

function hasPlatformRole(member = {}) {
  return PLATFORM_ADMIN_ROLES.includes(String(member.role || '')) || PLATFORM_ADMIN_ROLES.includes(String(member.roleId || ''))
}

function isProduction() {
  return typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'production'
}

export function requirePlatformAdmin() {
  const member = getCurrentMember()
  const analyticsGuard = requirePermission('analytics.view')
  const auditGuard = requirePermission('audit.view')
  const supportGuard = requirePermission('support.manage')
  const allowed = hasPlatformRole(member) || (!isProduction() && analyticsGuard.allowed && auditGuard.allowed && supportGuard.allowed)
  return {
    allowed,
    reason: allowed ? '' : 'platform_admin_required',
    currentUser: getCurrentUser(),
    currentMember: member
  }
}

function uniqueBy(items = [], key = '') {
  const map = {}
  items.forEach((item) => {
    const value = String(item[key] || '')
    if (value) map[value] = item
  })
  return Object.values(map)
}

function normalizeTask(task = {}) {
  return {
    taskId: task.taskId || '',
    userId: task.userId || task.creatorId || '',
    enterpriseId: task.enterpriseId || '',
    projectId: task.projectId || '',
    type: task.type || task.taskType || (task.input && task.input.type) || '',
    provider: task.provider || (task.result && task.result.provider) || '',
    modelVersion: task.modelVersion || task.modelId || '',
    status: task.status || '',
    isMock: task.mock === true || task.isMock === true || String(task.provider || '').includes('mock'),
    isFallback: task.fallback === true || task.isFallback === true || String(task.source || '').includes('fallback'),
    createdAt: task.createdAt || '',
    updatedAt: task.updatedAt || task.completedAt || task.createdAt || ''
  }
}

function buildUsers(tasks = [], enterprises = []) {
  const current = getCurrentUser()
  const members = enterprises.flatMap((enterprise) => Array.isArray(enterprise.members) ? enterprise.members : [])
  return uniqueBy([
    { userId: current.userId, name: current.name || current.nickname || '当前用户', status: 'active', role: getCurrentMember().role || '' },
    ...members.map((member) => ({
      userId: member.userId || member.memberId,
      name: member.name || member.userId || member.memberId,
      status: member.status || 'active',
      role: member.role || ''
    })),
    ...tasks.map((task) => ({ userId: task.userId, name: task.userId || '任务用户', status: 'active', role: '' })).filter((item) => item.userId)
  ], 'userId')
}

function buildQuotaRecords(tasks = [], tickets = []) {
  const taskCosts = tasks
    .filter((task) => Number(task.quotaCost || task.cost || 0) > 0)
    .map((task) => ({
      recordId: `quota_${task.taskId}`,
      taskId: task.taskId,
      enterpriseId: task.enterpriseId || '',
      type: task.status === 'failed' ? 'rollback_candidate' : 'consume',
      amount: Number(task.quotaCost || task.cost || 0),
      status: task.status || '',
      createdAt: task.createdAt || ''
    }))
  const compensations = tickets.flatMap((ticket) => (ticket.quotaCompensations || []).map((item) => ({
    recordId: item.compensationId,
    ticketId: ticket.ticketId,
    enterpriseId: ticket.enterpriseId,
    type: 'compensation_request',
    amount: item.amount,
    status: item.status,
    createdAt: item.createdAt
  })))
  return [...taskCosts, ...compensations]
}

function buildAuditLogs(tickets = [], tasks = []) {
  const ticketLogs = tickets.flatMap((ticket) => (ticket.activities || []).map((item) => ({
    logId: item.activityId,
    action: item.type,
    resourceType: 'support_ticket',
    resourceId: ticket.ticketId,
    operator: item.operatorName,
    createdAt: item.createdAt
  })))
  const taskLogs = tasks
    .filter((task) => task.status === 'failed' || task.status === 'success')
    .map((task) => ({
      logId: `task_${task.taskId}_${task.status}`,
      action: `task_${task.status}`,
      resourceType: 'task',
      resourceId: task.taskId,
      operator: task.userId || 'system',
      createdAt: task.updatedAt || task.createdAt
    }))
  return [...ticketLogs, ...taskLogs].sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt)))
}

export function loadPlatformAdminCenter(filters = {}) {
  const guard = requirePlatformAdmin()
  if (!guard.allowed) {
    return {
      canAccess: false,
      reason: guard.reason,
      sections: [],
      overview: {},
      users: [],
      enterprises: [],
      tasks: [],
      projects: [],
      deliveries: [],
      patterns: [],
      quotaRecords: [],
      tickets: [],
      modelReleases: [],
      auditLogs: [],
      updatedAt: nowIso()
    }
  }
  const rawTasks = listTasks().map(normalizeTask)
  const enterprises = getEnterpriseList()
  const users = buildUsers(rawTasks, enterprises)
  const projects = getProjects()
  const batches = listWorkspaceBatches()
  const deliveries = listWorkspaceDeliveries()
  const tickets = listSupportTickets()
  const analytics = loadProductAnalyticsCenter({ tasks: rawTasks, projects, batches, deliveries })
  const trainingCenter = loadPatternTrainingCenter({}, {})
  const modelOps = loadModelOperationsCenter({ tasks: rawTasks, trainingCenter })
  const quotaRecords = buildQuotaRecords(rawTasks, tickets)
  const auditLogs = buildAuditLogs(tickets, rawTasks)
  const today = new Date().toISOString().slice(0, 10)
  const todayTasks = rawTasks.filter((task) => String(task.createdAt || '').slice(0, 10) === today)
  const successCount = rawTasks.filter((task) => ['success', 'completed'].includes(String(task.status || '').toLowerCase())).length
  const failedCount = rawTasks.filter((task) => ['failed', 'timeout'].includes(String(task.status || '').toLowerCase())).length
  return {
    canAccess: true,
    reason: '',
    filters,
    sections: [
      '运营总览',
      '用户管理',
      '企业管理',
      'AI任务',
      '项目与交付',
      '版型与训练数据',
      '额度记录',
      '工单中心',
      '模型发布',
      '系统配置',
      '审计日志'
    ],
    overview: {
      newUsers: users.filter((item) => String(item.createdAt || '').slice(0, 10) === today).length,
      activeUsers: analytics.metrics.activeUsers || users.length,
      enterpriseCount: enterprises.length,
      todayTaskCount: todayTasks.length,
      successRate: rawTasks.length ? Math.round((successCount / rawTasks.length) * 100) : 0,
      failedAndTimeout: failedCount,
      pendingReview: rawTasks.filter((task) => ['review', 'pending_review'].includes(String(task.status || '').toLowerCase())).length,
      openTickets: tickets.filter((ticket) => ['new', 'assigned', 'investigating', 'waiting_user', 'reopened'].includes(ticket.status)).length,
      quotaAnomaly: quotaRecords.filter((item) => ['rollback_candidate', 'compensation_request'].includes(item.type)).length,
      currentModelVersion: modelOps.currentVersion || (modelOps.releases && modelOps.releases[0] && modelOps.releases[0].modelVersion) || '未接入'
    },
    users,
    enterprises,
    tasks: rawTasks,
    projects,
    deliveries,
    patterns: trainingCenter.samples || [],
    quotaRecords,
    tickets,
    modelReleases: modelOps.releases || [],
    auditLogs,
    updatedAt: nowIso()
  }
}
