const cloud = require('wx-server-sdk')
const crypto = require('crypto')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const _ = db.command

const COLLECTIONS = Object.freeze({
  sessions: 'enterprise_auth_sessions',
  users: 'enterprise_auth_users',
  members: 'enterprise_members',
  rolePermissions: 'enterprise_role_permissions',
  projects: 'enterprise_projects',
  stageHistory: 'enterprise_project_stage_history',
  audit: 'enterprise_project_audit_logs',
  quotes: 'enterprise_quotes',
  orders: 'enterprise_orders',
  deliveries: 'enterprise_deliveries'
})

const PERMISSION_KEYS = Object.freeze([
  'member.view',
  'member.manage',
  'role.view',
  'role.manage',
  'project.view',
  'project.manage',
  'project.delete',
  'product.view',
  'product.manage',
  'quote.view',
  'quote.manage',
  'order.view',
  'order.manage',
  'delivery.view',
  'delivery.manage',
  'audit.view',
  'analytics.view'
])

const DEFAULT_ROLE_PERMISSIONS = Object.freeze({
  admin: PERMISSION_KEYS,
  designer: ['project.view', 'project.manage', 'product.view'],
  operator: ['product.view', 'order.view', 'delivery.view'],
  finance: ['quote.view', 'order.view'],
  viewer: ['project.view', 'product.view']
})

const PROJECT_STAGES = Object.freeze([
  { key: 'draft', label: '需求阶段', index: 0 },
  { key: 'design', label: '设计阶段', index: 1 },
  { key: 'production', label: '生产阶段', index: 2 },
  { key: 'review', label: '审核阶段', index: 3 },
  { key: 'delivery', label: '交付阶段', index: 4 },
  { key: 'completed', label: '完成阶段', index: 5 }
])

const STAGE_ALIASES = Object.freeze({
  draft: 'draft',
  requirement: 'draft',
  requirement_confirmation: 'draft',
  pending: 'draft',
  planning: 'draft',
  design: 'design',
  designing: 'design',
  production: 'production',
  generating: 'production',
  processing: 'production',
  in_progress: 'production',
  review: 'review',
  reviewing: 'review',
  pending_review: 'review',
  delivery: 'delivery',
  delivered: 'delivery',
  completed: 'completed',
  confirmed: 'completed',
  archived: 'completed'
})

const STAGE_STATUS_MAP = Object.freeze({
  draft: 'draft',
  design: 'planning',
  production: 'in_progress',
  review: 'reviewing',
  delivery: 'in_progress',
  completed: 'completed'
})

function nowIso() {
  return new Date().toISOString()
}

function sha256(value = '') {
  return crypto.createHash('sha256').update(String(value || '')).digest('hex')
}

function createId(prefix = 'id') {
  return `${prefix}_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`
}

function ok(data = {}) {
  return { success: true, ok: true, data }
}

function fail(errorCode = 'INTERNAL_ERROR', message = '操作失败', data = {}) {
  return { success: false, ok: false, errorCode, message, data }
}

function normalizeDoc(doc = {}) {
  if (!doc || typeof doc !== 'object') return {}
  const { _id, ...rest } = doc
  return { ...rest, id: _id }
}

function normalizeStage(value = '') {
  return STAGE_ALIASES[String(value || '').trim().toLowerCase()] || 'draft'
}

function getStage(value = '') {
  const key = normalizeStage(value)
  return PROJECT_STAGES.find((item) => item.key === key) || PROJECT_STAGES[0]
}

function getNextStage(currentStage = '') {
  const current = getStage(currentStage)
  return PROJECT_STAGES.find((item) => item.index === current.index + 1) || null
}

function pickText(value = '', max = 200) {
  return String(value || '').trim().slice(0, max)
}

function sanitizeProject(record = {}) {
  const stage = normalizeStage(record.stage || record.status)
  const createdAt = record.createdAt || nowIso()
  return {
    projectId: record.projectId || '',
    enterpriseId: record.enterpriseId || '',
    name: record.name || record.projectName || record.title || '未命名项目',
    projectName: record.name || record.projectName || record.title || '未命名项目',
    description: record.description || '',
    stage,
    status: record.status || STAGE_STATUS_MAP[stage] || 'draft',
    customerName: record.customerName || record.clientName || '',
    ownerMemberId: record.ownerMemberId || '',
    ownerName: record.ownerName || record.owner || '',
    startDate: record.startDate || '',
    dueDate: record.dueDate || record.deadline || '',
    createdByMemberId: record.createdByMemberId || '',
    createdAt,
    updatedAt: record.updatedAt || createdAt,
    version: Number(record.version || 0)
  }
}

function sanitizeHistory(record = {}) {
  return {
    historyId: record.historyId || '',
    enterpriseId: record.enterpriseId || '',
    projectId: record.projectId || '',
    fromStage: normalizeStage(record.fromStage),
    toStage: normalizeStage(record.toStage),
    operatorMemberId: record.operatorMemberId || '',
    operatorName: record.operatorName || '',
    reason: record.reason || '',
    idempotencyKey: record.idempotencyKey || '',
    projectVersion: Number(record.projectVersion || 0),
    createdAt: record.createdAt || ''
  }
}

async function getOne(collection, where = {}) {
  const result = await db.collection(collection).where(where).limit(1).get()
  return result.data && result.data.length ? normalizeDoc(result.data[0]) : null
}

async function count(collection, where = {}) {
  try {
    const result = await db.collection(collection).where(where).count()
    return Number(result.total || 0)
  } catch (error) {
    return 0
  }
}

async function addAudit(ctx = {}, action = '', target = {}, payload = {}) {
  try {
    await db.collection(COLLECTIONS.audit).add({
      data: {
        auditId: createId('audit'),
        enterpriseId: ctx.enterpriseId || '',
        operatorMemberId: ctx.memberId || '',
        action,
        targetType: 'project',
        targetId: target.projectId || '',
        fromStage: payload.fromStage || '',
        toStage: payload.toStage || '',
        success: payload.success !== false,
        errorCode: payload.errorCode || '',
        createdAt: nowIso()
      }
    })
  } catch (error) {
    console.warn('[enterprise_project:audit]', {
      action,
      success: false,
      errorCode: 'AUDIT_WRITE_FAILED'
    })
  }
}

async function getRolePermissions(enterpriseId = '', role = '') {
  const roleCode = String(role || 'viewer').trim()
  const record = await getOne(COLLECTIONS.rolePermissions, { enterpriseId, roleCode })
  if (record && Array.isArray(record.permissions)) {
    const valid = new Set(PERMISSION_KEYS)
    return Array.from(new Set(record.permissions.filter((item) => valid.has(item))))
  }
  return [...(DEFAULT_ROLE_PERMISSIONS[roleCode] || [])]
}

async function requirePermission(ctx = {}, permission = '') {
  const permissions = await getRolePermissions(ctx.enterpriseId, ctx.role)
  if (!permissions.includes(permission)) {
    throw Object.assign(new Error('无权限执行该操作'), { errorCode: 'FORBIDDEN' })
  }
}

async function requireSession(sessionToken = '') {
  const token = String(sessionToken || '').trim()
  if (!token) throw Object.assign(new Error('请先登录'), { errorCode: 'AUTH_REQUIRED' })
  const session = await getOne(COLLECTIONS.sessions, { sessionTokenHash: sha256(token) })
  if (!session) throw Object.assign(new Error('登录状态无效'), { errorCode: 'SESSION_INVALID' })
  if (session.status === 'revoked') throw Object.assign(new Error('登录已退出'), { errorCode: 'SESSION_REVOKED' })
  if (session.status && session.status !== 'active') throw Object.assign(new Error('登录状态无效'), { errorCode: 'SESSION_INVALID' })
  if (session.expiresAt && new Date(session.expiresAt).getTime() <= Date.now()) {
    throw Object.assign(new Error('登录已过期'), { errorCode: 'SESSION_EXPIRED' })
  }
  const enterpriseId = session.enterpriseId || ''
  const memberId = session.memberId || ''
  if (!enterpriseId || !memberId) throw Object.assign(new Error('请选择企业'), { errorCode: 'TENANT_MISMATCH' })
  const member = await getOne(COLLECTIONS.members, { enterpriseId, memberId })
  if (!member) throw Object.assign(new Error('成员不存在'), { errorCode: 'MEMBER_NOT_FOUND' })
  if (member.userId !== session.userId) throw Object.assign(new Error('成员不属于当前用户'), { errorCode: 'TENANT_MISMATCH' })
  if (member.status !== 'active') throw Object.assign(new Error('成员状态不可用'), { errorCode: 'MEMBER_NOT_ACTIVE' })
  const user = await getOne(COLLECTIONS.users, { userId: session.userId })
  return {
    session,
    user,
    enterpriseId,
    memberId,
    memberName: member.name || (user && user.name) || '',
    role: member.role || 'viewer',
    userId: session.userId
  }
}

async function getProjectOrFail(ctx, projectId = '') {
  const id = String(projectId || '').trim()
  if (!id) throw Object.assign(new Error('projectId 不能为空'), { errorCode: 'INVALID_ARGUMENT' })
  const project = await getOne(COLLECTIONS.projects, { enterpriseId: ctx.enterpriseId, projectId: id })
  if (!project || project.status === 'deleted') {
    throw Object.assign(new Error('项目不存在'), { errorCode: 'PROJECT_NOT_FOUND' })
  }
  return sanitizeProject(project)
}

async function getProjectList(ctx, data = {}) {
  await requirePermission(ctx, 'project.view')
  const where = { enterpriseId: ctx.enterpriseId, status: _.neq('deleted') }
  const result = await db.collection(COLLECTIONS.projects).where(where).orderBy('updatedAt', 'desc').limit(100).get()
  const filters = data.filters || {}
  const stage = filters.stage ? normalizeStage(filters.stage) : ''
  const status = String(filters.status || '').trim()
  const projects = (result.data || [])
    .map(sanitizeProject)
    .filter((item) => !stage || item.stage === stage)
    .filter((item) => !status || item.status === status)
  return ok({ projects })
}

async function getProjectDetail(ctx, data = {}) {
  await requirePermission(ctx, 'project.view')
  const project = await getProjectOrFail(ctx, data.projectId)
  return ok({ project })
}

async function createProject(ctx, data = {}) {
  await requirePermission(ctx, 'project.manage')
  const now = nowIso()
  const stage = normalizeStage(data.stage)
  const project = sanitizeProject({
    projectId: data.projectId || createId('project'),
    enterpriseId: ctx.enterpriseId,
    name: pickText(data.name || data.projectName || data.title || '未命名项目', 80),
    description: pickText(data.description, 500),
    stage,
    status: data.status || STAGE_STATUS_MAP[stage] || 'draft',
    customerName: pickText(data.customerName || data.clientName, 80),
    ownerMemberId: data.ownerMemberId || ctx.memberId,
    ownerName: pickText(data.ownerName || ctx.memberName, 60),
    startDate: pickText(data.startDate, 32),
    dueDate: pickText(data.dueDate || data.deadline, 32),
    createdByMemberId: ctx.memberId,
    createdAt: now,
    updatedAt: now,
    version: 1
  })
  await db.collection(COLLECTIONS.projects).add({ data: project })
  await addAudit(ctx, 'PROJECT_CREATED', project, { success: true })
  return ok({ project })
}

async function updateProject(ctx, data = {}) {
  await requirePermission(ctx, 'project.manage')
  const project = await getProjectOrFail(ctx, data.projectId)
  const expectedVersion = Number(data.expectedVersion)
  if (!Number.isFinite(expectedVersion) || expectedVersion !== project.version) {
    return fail('PROJECT_VERSION_CONFLICT', '项目状态已被其他成员更新，请刷新后重试。')
  }
  const patch = data.patch || {}
  const next = sanitizeProject({
    ...project,
    name: patch.name !== undefined ? pickText(patch.name, 80) : project.name,
    description: patch.description !== undefined ? pickText(patch.description, 500) : project.description,
    status: patch.status !== undefined ? pickText(patch.status, 40) : project.status,
    customerName: patch.customerName !== undefined ? pickText(patch.customerName, 80) : project.customerName,
    ownerMemberId: patch.ownerMemberId !== undefined ? pickText(patch.ownerMemberId, 80) : project.ownerMemberId,
    ownerName: patch.ownerName !== undefined ? pickText(patch.ownerName, 60) : project.ownerName,
    startDate: patch.startDate !== undefined ? pickText(patch.startDate, 32) : project.startDate,
    dueDate: patch.dueDate !== undefined ? pickText(patch.dueDate, 32) : project.dueDate,
    updatedAt: nowIso(),
    version: project.version + 1
  })
  await db.collection(COLLECTIONS.projects).where({ enterpriseId: ctx.enterpriseId, projectId: project.projectId }).update({ data: next })
  await addAudit(ctx, 'PROJECT_UPDATED', project, { success: true })
  return ok({ project: next })
}

async function hasRelatedBusiness(ctx, projectId = '') {
  const where = { enterpriseId: ctx.enterpriseId, projectId }
  const [quotes, orders, deliveries] = await Promise.all([
    count(COLLECTIONS.quotes, where),
    count(COLLECTIONS.orders, where),
    count(COLLECTIONS.deliveries, where)
  ])
  return quotes + orders + deliveries > 0
}

async function deleteProject(ctx, data = {}) {
  await requirePermission(ctx, 'project.delete')
  const project = await getProjectOrFail(ctx, data.projectId)
  const expectedVersion = Number(data.expectedVersion)
  if (!Number.isFinite(expectedVersion) || expectedVersion !== project.version) {
    return fail('PROJECT_VERSION_CONFLICT', '项目状态已被其他成员更新，请刷新后重试。')
  }
  if (await hasRelatedBusiness(ctx, project.projectId)) {
    return fail('PROJECT_HAS_RELATED_BUSINESS', '项目存在关联业务，不能物理删除')
  }
  const patch = {
    status: 'deleted',
    deletedAt: nowIso(),
    deletedByMemberId: ctx.memberId,
    updatedAt: nowIso(),
    version: project.version + 1
  }
  await db.collection(COLLECTIONS.projects).where({ enterpriseId: ctx.enterpriseId, projectId: project.projectId }).update({ data: patch })
  await addAudit(ctx, 'PROJECT_DELETED', project, { success: true })
  return ok({ project: { ...project, ...patch } })
}

async function advanceProjectStage(ctx, data = {}) {
  await requirePermission(ctx, 'project.manage')
  const projectId = String(data.projectId || '').trim()
  const nextStage = normalizeStage(data.nextStage)
  const expectedStage = normalizeStage(data.expectedStage)
  const expectedVersion = Number(data.expectedVersion)
  const idempotencyKey = String(data.idempotencyKey || '').trim()
  if (!projectId || !data.nextStage || !data.expectedStage || !Number.isFinite(expectedVersion)) {
    return fail('INVALID_ARGUMENT', '阶段推进参数不完整')
  }
  if (!idempotencyKey) return fail('IDEMPOTENCY_KEY_REQUIRED', 'idempotencyKey 不能为空')

  const previousHistory = await getOne(COLLECTIONS.stageHistory, { enterpriseId: ctx.enterpriseId, projectId, idempotencyKey })
  if (previousHistory) {
    const project = await getProjectOrFail(ctx, projectId)
    return ok({ project, history: sanitizeHistory(previousHistory), idempotent: true })
  }

  const project = await getProjectOrFail(ctx, projectId)
  const currentStage = normalizeStage(project.stage)
  if (currentStage === 'completed') return fail('PROJECT_ALREADY_COMPLETED', '项目已完成')
  if (currentStage !== expectedStage) return fail('PROJECT_STAGE_CONFLICT', '项目状态已被其他成员更新，请刷新后重试。')
  if (project.version !== expectedVersion) return fail('PROJECT_VERSION_CONFLICT', '项目状态已被其他成员更新，请刷新后重试。')
  const expectedNext = getNextStage(currentStage)
  if (!expectedNext || nextStage !== expectedNext.key) return fail('PROJECT_STAGE_INVALID', '项目阶段只能按顺序推进')

  const now = nowIso()
  const nextVersion = project.version + 1
  const nextProject = {
    ...project,
    stage: nextStage,
    status: STAGE_STATUS_MAP[nextStage] || project.status,
    stageUpdatedAt: now,
    updatedAt: now,
    version: nextVersion
  }
  const history = {
    historyId: createId('stage_history'),
    enterpriseId: ctx.enterpriseId,
    projectId,
    fromStage: currentStage,
    toStage: nextStage,
    operatorMemberId: ctx.memberId,
    operatorName: ctx.memberName,
    reason: pickText(data.reason, 200),
    idempotencyKey,
    projectVersion: nextVersion,
    createdAt: now
  }

  await db.runTransaction(async (transaction) => {
    const updateResult = await transaction.collection(COLLECTIONS.projects).where({
      enterpriseId: ctx.enterpriseId,
      projectId,
      version: expectedVersion,
      stage: currentStage
    }).update({
      data: nextProject
    })
    if (!updateResult.stats || updateResult.stats.updated !== 1) {
      throw Object.assign(new Error('项目状态已被其他成员更新，请刷新后重试。'), { errorCode: 'PROJECT_VERSION_CONFLICT' })
    }
    await transaction.collection(COLLECTIONS.stageHistory).add({ data: history })
  })

  await addAudit(ctx, 'PROJECT_STAGE_ADVANCED', project, { fromStage: currentStage, toStage: nextStage, success: true })
  return ok({ project: nextProject, history: sanitizeHistory(history) })
}

async function getProjectStageHistory(ctx, data = {}) {
  await requirePermission(ctx, 'project.view')
  await getProjectOrFail(ctx, data.projectId)
  const result = await db.collection(COLLECTIONS.stageHistory)
    .where({ enterpriseId: ctx.enterpriseId, projectId: String(data.projectId || '').trim() })
    .orderBy('createdAt', 'desc')
    .limit(100)
    .get()
  return ok({ history: (result.data || []).map((item) => sanitizeHistory(normalizeDoc(item))) })
}

const ACTIONS = Object.freeze({
  getProjectList,
  getProjectDetail,
  createProject,
  updateProject,
  deleteProject,
  advanceProjectStage,
  getProjectStageHistory
})

exports.main = async (event = {}) => {
  const startedAt = Date.now()
  const action = String(event.action || '').trim()
  let success = false
  let errorCode = ''
  let projectId = ''
  let stage = ''
  try {
    if (!ACTIONS[action]) return fail('INVALID_ACTION', '未知操作')
    const ctx = await requireSession(event.sessionToken)
    const data = event.data || {}
    projectId = data.projectId || ''
    stage = data.nextStage || data.stage || ''
    const result = await ACTIONS[action](ctx, data)
    success = Boolean(result && result.success)
    errorCode = result && result.errorCode ? result.errorCode : ''
    return result
  } catch (error) {
    errorCode = error.errorCode || 'INTERNAL_ERROR'
    return fail(errorCode, error.message || '操作失败')
  } finally {
    console.info('[enterprise_project]', {
      action,
      success,
      errorCode,
      projectId,
      stage,
      durationMs: Date.now() - startedAt
    })
  }
}
