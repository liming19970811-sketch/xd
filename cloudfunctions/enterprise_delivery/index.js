const cloud = require('wx-server-sdk')
const crypto = require('crypto')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()

const COLLECTIONS = Object.freeze({
  sessions: 'enterprise_auth_sessions',
  users: 'enterprise_auth_users',
  members: 'enterprise_members',
  rolePermissions: 'enterprise_role_permissions',
  projects: 'enterprise_projects',
  orders: 'enterprise_orders',
  deliveries: 'enterprise_deliveries',
  items: 'enterprise_delivery_items',
  history: 'enterprise_delivery_action_history',
  audit: 'enterprise_delivery_audit_logs'
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
  'delivery.approve',
  'audit.view',
  'analytics.view'
])

const DEFAULT_ROLE_PERMISSIONS = Object.freeze({
  admin: PERMISSION_KEYS,
  designer: ['project.view', 'project.manage', 'product.view'],
  operator: ['product.view', 'order.view', 'delivery.view', 'delivery.manage'],
  finance: ['quote.view', 'order.view'],
  viewer: ['project.view', 'product.view']
})

const DELIVERY_STATUS_LABELS = Object.freeze({
  draft: '草稿',
  preparing: '准备中',
  submitted: '待提交审核',
  reviewing: '审核中',
  approved: '已审核',
  rejected: '已驳回',
  customer_confirmed: '客户已确认',
  completed: '已完成',
  cancelled: '已取消'
})

const STATUS_ALIASES = Object.freeze({
  pending: 'draft',
  delivered: 'approved',
  confirmed: 'completed'
})

const TRANSITIONS = Object.freeze({
  draft: ['preparing', 'cancelled'],
  preparing: ['submitted', 'cancelled'],
  submitted: ['reviewing'],
  reviewing: ['approved', 'rejected'],
  rejected: ['preparing'],
  approved: ['customer_confirmed'],
  customer_confirmed: ['completed'],
  completed: [],
  cancelled: []
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

function normalizeStatus(status = '') {
  const key = String(status || '').trim().toLowerCase()
  return STATUS_ALIASES[key] || (Object.prototype.hasOwnProperty.call(DELIVERY_STATUS_LABELS, key) ? key : 'draft')
}

function canTransition(fromStatus = '', toStatus = '') {
  const from = normalizeStatus(fromStatus)
  const to = normalizeStatus(toStatus)
  return (TRANSITIONS[from] || []).includes(to)
}

function pickText(value = '', max = 200) {
  return String(value || '').trim().slice(0, max)
}

function sanitizeDelivery(record = {}) {
  const status = normalizeStatus(record.status)
  const createdAt = record.createdAt || nowIso()
  return {
    deliveryId: record.deliveryId || '',
    enterpriseId: record.enterpriseId || '',
    projectId: record.projectId || '',
    orderId: record.orderId || '',
    sourceQuoteId: record.sourceQuoteId || '',
    title: record.title || record.deliveryTitle || '交付单',
    status,
    statusText: DELIVERY_STATUS_LABELS[status] || status,
    deliveryType: record.deliveryType || 'main',
    itemCount: Number(record.itemCount || 0),
    submittedAt: record.submittedAt || '',
    reviewStartedAt: record.reviewStartedAt || '',
    approvedAt: record.approvedAt || '',
    rejectedAt: record.rejectedAt || '',
    customerConfirmedAt: record.customerConfirmedAt || '',
    completedAt: record.completedAt || '',
    cancelledAt: record.cancelledAt || '',
    createdByMemberId: record.createdByMemberId || '',
    updatedByMemberId: record.updatedByMemberId || '',
    version: Number(record.version || 0),
    createdAt,
    updatedAt: record.updatedAt || createdAt
  }
}

function sanitizeHistory(record = {}) {
  return {
    historyId: record.historyId || '',
    enterpriseId: record.enterpriseId || '',
    deliveryId: record.deliveryId || '',
    orderId: record.orderId || '',
    projectId: record.projectId || '',
    action: record.action || '',
    fromStatus: normalizeStatus(record.fromStatus),
    toStatus: normalizeStatus(record.toStatus),
    operatorType: record.operatorType || 'member',
    operatorMemberId: record.operatorMemberId || '',
    operatorName: record.operatorName || '',
    reason: record.reason || '',
    idempotencyKey: record.idempotencyKey || '',
    deliveryVersion: Number(record.deliveryVersion || 0),
    createdAt: record.createdAt || ''
  }
}

async function getOne(collection, where = {}) {
  const result = await db.collection(collection).where(where).limit(1).get()
  return result.data && result.data.length ? normalizeDoc(result.data[0]) : null
}

async function count(collection, where = {}) {
  const result = await db.collection(collection).where(where).count()
  return Number(result.total || 0)
}

async function addAudit(ctx = {}, action = '', delivery = {}, payload = {}) {
  try {
    await db.collection(COLLECTIONS.audit).add({
      data: {
        auditId: createId('audit'),
        enterpriseId: ctx.enterpriseId || delivery.enterpriseId || '',
        operatorMemberId: ctx.memberId || '',
        action,
        targetType: 'delivery',
        targetId: delivery.deliveryId || '',
        fromStatus: payload.fromStatus || '',
        toStatus: payload.toStatus || '',
        success: payload.success !== false,
        errorCode: payload.errorCode || '',
        createdAt: nowIso()
      }
    })
  } catch (error) {
    console.warn('[enterprise_delivery:audit]', {
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
  if (!permissions.includes(permission)) throw Object.assign(new Error('无权限执行该操作'), { errorCode: 'FORBIDDEN' })
}

async function requireSession(sessionToken = '') {
  const token = String(sessionToken || '').trim()
  if (!token) throw Object.assign(new Error('请先登录'), { errorCode: 'AUTH_REQUIRED' })
  const session = await getOne(COLLECTIONS.sessions, { sessionTokenHash: sha256(token) })
  if (!session) throw Object.assign(new Error('登录状态无效'), { errorCode: 'SESSION_INVALID' })
  if (session.status === 'revoked') throw Object.assign(new Error('登录已退出'), { errorCode: 'SESSION_REVOKED' })
  if (session.status && session.status !== 'active') throw Object.assign(new Error('登录状态无效'), { errorCode: 'SESSION_INVALID' })
  if (session.expiresAt && new Date(session.expiresAt).getTime() <= Date.now()) throw Object.assign(new Error('登录已过期'), { errorCode: 'SESSION_EXPIRED' })
  const enterpriseId = session.enterpriseId || ''
  const memberId = session.memberId || ''
  const member = await getOne(COLLECTIONS.members, { enterpriseId, memberId })
  if (!member) throw Object.assign(new Error('成员不存在'), { errorCode: 'MEMBER_NOT_FOUND' })
  if (member.userId !== session.userId) throw Object.assign(new Error('租户不匹配'), { errorCode: 'TENANT_MISMATCH' })
  if (member.status !== 'active') throw Object.assign(new Error('成员状态不可用'), { errorCode: 'MEMBER_NOT_ACTIVE' })
  const user = await getOne(COLLECTIONS.users, { userId: session.userId })
  return {
    enterpriseId,
    memberId,
    memberName: member.name || (user && user.name) || '',
    role: member.role || 'viewer',
    userId: session.userId
  }
}

async function getOrderOrFail(ctx, orderId = '') {
  const id = String(orderId || '').trim()
  if (!id) throw Object.assign(new Error('orderId 不能为空'), { errorCode: 'INVALID_ARGUMENT' })
  const order = await getOne(COLLECTIONS.orders, { enterpriseId: ctx.enterpriseId, orderId: id })
  if (!order) throw Object.assign(new Error('订单不存在'), { errorCode: 'ORDER_NOT_FOUND' })
  return order
}

async function getDeliveryOrFail(ctx, deliveryId = '') {
  const id = String(deliveryId || '').trim()
  if (!id) throw Object.assign(new Error('deliveryId 不能为空'), { errorCode: 'INVALID_ARGUMENT' })
  const delivery = await getOne(COLLECTIONS.deliveries, { enterpriseId: ctx.enterpriseId, deliveryId: id })
  if (!delivery) throw Object.assign(new Error('交付单不存在'), { errorCode: 'DELIVERY_NOT_FOUND' })
  return sanitizeDelivery(delivery)
}

async function writeHistory(ctx = {}, delivery = {}, action = '', fromStatus = '', toStatus = '', options = {}) {
  const previous = options.idempotencyKey
    ? await getOne(COLLECTIONS.history, {
      enterpriseId: delivery.enterpriseId,
      deliveryId: delivery.deliveryId,
      action,
      idempotencyKey: options.idempotencyKey
    })
    : null
  if (previous) return sanitizeHistory(previous)
  const history = {
    historyId: createId('delivery_history'),
    enterpriseId: delivery.enterpriseId,
    deliveryId: delivery.deliveryId,
    orderId: delivery.orderId || '',
    projectId: delivery.projectId || '',
    action,
    fromStatus,
    toStatus,
    operatorType: options.operatorType || 'member',
    operatorMemberId: options.operatorType === 'customer' ? '' : (ctx.memberId || ''),
    operatorName: options.operatorType === 'customer' ? '客户确认' : (ctx.memberName || ''),
    reason: pickText(options.reason, 200),
    idempotencyKey: options.idempotencyKey || '',
    deliveryVersion: Number(delivery.version || 0),
    createdAt: nowIso()
  }
  await db.collection(COLLECTIONS.history).add({ data: history })
  return sanitizeHistory(history)
}

async function getDeliveryDashboard(ctx) {
  await requirePermission(ctx, 'delivery.view')
  const result = await db.collection(COLLECTIONS.deliveries).where({ enterpriseId: ctx.enterpriseId }).limit(200).get()
  const deliveries = (result.data || []).map(sanitizeDelivery)
  const statuses = ['preparing', 'submitted', 'reviewing', 'approved', 'customer_confirmed', 'completed', 'rejected']
  const summary = statuses.reduce((acc, status) => {
    acc[status] = deliveries.filter((item) => item.status === status).length
    return acc
  }, { total: deliveries.length })
  return ok({ summary, deliveries: deliveries.slice(0, 20) })
}

async function listDeliveries(ctx, data = {}) {
  await requirePermission(ctx, 'delivery.view')
  const filters = data.filters || {}
  const result = await db.collection(COLLECTIONS.deliveries).where({ enterpriseId: ctx.enterpriseId }).orderBy('updatedAt', 'desc').limit(100).get()
  const status = filters.status ? normalizeStatus(filters.status) : ''
  const deliveries = (result.data || [])
    .map(sanitizeDelivery)
    .filter((item) => !status || item.status === status)
    .filter((item) => !filters.projectId || item.projectId === filters.projectId)
    .filter((item) => !filters.orderId || item.orderId === filters.orderId)
  return ok({ deliveries })
}

async function getDeliveryDetail(ctx, data = {}) {
  await requirePermission(ctx, 'delivery.view')
  const delivery = await getDeliveryOrFail(ctx, data.deliveryId)
  const history = await getDeliveryActionHistory(ctx, { deliveryId: delivery.deliveryId })
  return ok({ delivery, history: history.data.history })
}

async function createDeliveryFromOrder(ctx, data = {}) {
  await requirePermission(ctx, 'delivery.manage')
  const order = await getOrderOrFail(ctx, data.orderId)
  const existing = await getOne(COLLECTIONS.deliveries, { enterpriseId: ctx.enterpriseId, orderId: order.orderId, deliveryType: 'main' })
  if (existing) return ok({ delivery: sanitizeDelivery(existing), idempotent: true })
  const now = nowIso()
  const delivery = sanitizeDelivery({
    deliveryId: createId('delivery'),
    enterpriseId: ctx.enterpriseId,
    projectId: order.projectId || '',
    orderId: order.orderId,
    sourceQuoteId: order.sourceQuoteId || '',
    title: `订单交付 ${order.orderId}`,
    status: 'preparing',
    deliveryType: 'main',
    itemCount: Number(order.itemCount || 0),
    createdByMemberId: ctx.memberId,
    updatedByMemberId: ctx.memberId,
    version: 1,
    createdAt: now,
    updatedAt: now
  })
  await db.collection(COLLECTIONS.deliveries).add({ data: delivery })
  await db.collection(COLLECTIONS.orders).where({ enterpriseId: ctx.enterpriseId, orderId: order.orderId }).update({
    data: { deliveryId: delivery.deliveryId, deliveryStatus: delivery.status, updatedAt: now }
  })
  await writeHistory(ctx, delivery, 'DELIVERY_CREATED', '', 'preparing', { idempotencyKey: data.idempotencyKey })
  await addAudit(ctx, 'DELIVERY_CREATED', delivery, { toStatus: 'preparing' })
  return ok({ delivery })
}

async function ensureItemsEligible(ctx, delivery = {}) {
  const result = await db.collection(COLLECTIONS.items).where({ enterpriseId: ctx.enterpriseId, deliveryId: delivery.deliveryId }).limit(50).get()
  const items = result.data || []
  if (!items.length && Number(delivery.itemCount || 0) <= 0) return fail('DELIVERY_ITEM_REQUIRED', '至少需要一个可交付内容')
  const blocked = items.some((item) => {
    const source = String(item.sourceType || '').toLowerCase()
    return item.isMock || item.isFallback || ['mock', 'fallback', 'test', 'placeholder', 'dummy'].includes(source) || item.deliveryEligible === false
  })
  if (blocked) return fail('DELIVERY_ITEM_NOT_ELIGIBLE', 'mock 或 fallback 内容不能进入正式交付')
  return ok({ items })
}

async function transitionDelivery(ctx, data = {}, toStatus = '', action = '', permission = 'delivery.manage', options = {}) {
  await requirePermission(ctx, permission)
  const idempotencyKey = String(data.idempotencyKey || '').trim()
  if (!idempotencyKey) return fail('IDEMPOTENCY_KEY_REQUIRED', 'idempotencyKey 不能为空')
  const delivery = await getDeliveryOrFail(ctx, data.deliveryId)
  const currentStatus = normalizeStatus(delivery.status)
  if (['completed', 'cancelled'].includes(currentStatus)) return fail(currentStatus === 'completed' ? 'DELIVERY_ALREADY_COMPLETED' : 'DELIVERY_CANCELLED', '交付已进入终态')
  const expectedVersion = Number(data.expectedVersion)
  if (!Number.isFinite(expectedVersion) || expectedVersion !== delivery.version) return fail('DELIVERY_VERSION_CONFLICT', '交付状态已更新，请刷新后重试')
  if (!canTransition(currentStatus, toStatus)) return fail('DELIVERY_STATUS_INVALID', '交付状态不能跳转')
  if (action === 'DELIVERY_REJECTED' && !pickText(data.reason, 200)) return fail('REJECT_REASON_REQUIRED', '请填写驳回原因')
  if (action === 'DELIVERY_SUBMITTED') {
    const eligibility = await ensureItemsEligible(ctx, delivery)
    if (!eligibility.success) return eligibility
  }
  const previousHistory = await getOne(COLLECTIONS.history, {
    enterpriseId: ctx.enterpriseId,
    deliveryId: delivery.deliveryId,
    action,
    idempotencyKey
  })
  if (previousHistory) return ok({ delivery, history: sanitizeHistory(previousHistory), idempotent: true })
  const now = nowIso()
  const patch = {
    status: toStatus,
    updatedByMemberId: ctx.memberId,
    updatedAt: now,
    version: delivery.version + 1
  }
  if (toStatus === 'submitted') patch.submittedAt = now
  if (toStatus === 'reviewing') patch.reviewStartedAt = now
  if (toStatus === 'approved') patch.approvedAt = now
  if (toStatus === 'rejected') patch.rejectedAt = now
  if (toStatus === 'customer_confirmed') patch.customerConfirmedAt = now
  if (toStatus === 'completed') patch.completedAt = now
  if (toStatus === 'cancelled') patch.cancelledAt = now
  const updateResult = await db.collection(COLLECTIONS.deliveries).where({
    enterpriseId: ctx.enterpriseId,
    deliveryId: delivery.deliveryId,
    version: expectedVersion,
    status: currentStatus
  }).update({ data: patch })
  if (!updateResult.stats || updateResult.stats.updated !== 1) return fail('DELIVERY_STATUS_CONFLICT', '交付状态已更新，请刷新后重试')
  const next = sanitizeDelivery({ ...delivery, ...patch })
  const orderPatch = { deliveryId: delivery.deliveryId, deliveryStatus: toStatus, updatedAt: now }
  if (toStatus === 'completed') orderPatch.status = 'completed'
  await db.collection(COLLECTIONS.orders).where({ enterpriseId: ctx.enterpriseId, orderId: delivery.orderId }).update({ data: orderPatch })
  const history = await writeHistory(ctx, next, action, currentStatus, toStatus, {
    idempotencyKey,
    reason: data.reason,
    operatorType: options.operatorType || 'member'
  })
  await addAudit(ctx, action, next, { fromStatus: currentStatus, toStatus })
  return ok({ delivery: next, history })
}

async function updateDelivery(ctx, data = {}) {
  await requirePermission(ctx, 'delivery.manage')
  const delivery = await getDeliveryOrFail(ctx, data.deliveryId)
  const expectedVersion = Number(data.expectedVersion)
  if (!Number.isFinite(expectedVersion) || expectedVersion !== delivery.version) return fail('DELIVERY_VERSION_CONFLICT', '交付状态已更新，请刷新后重试')
  const patch = {
    title: data.patch && data.patch.title ? pickText(data.patch.title, 80) : delivery.title,
    updatedAt: nowIso(),
    updatedByMemberId: ctx.memberId,
    version: delivery.version + 1
  }
  await db.collection(COLLECTIONS.deliveries).where({ enterpriseId: ctx.enterpriseId, deliveryId: delivery.deliveryId }).update({ data: patch })
  const next = sanitizeDelivery({ ...delivery, ...patch })
  await addAudit(ctx, 'DELIVERY_UPDATED', next, {})
  return ok({ delivery: next })
}

async function submitDelivery(ctx, data) {
  return transitionDelivery(ctx, data, 'submitted', 'DELIVERY_SUBMITTED', 'delivery.manage')
}

async function startDeliveryReview(ctx, data) {
  return transitionDelivery(ctx, data, 'reviewing', 'DELIVERY_REVIEW_STARTED', 'delivery.approve')
}

async function approveDelivery(ctx, data) {
  return transitionDelivery(ctx, data, 'approved', 'DELIVERY_APPROVED', 'delivery.approve')
}

async function rejectDelivery(ctx, data) {
  return transitionDelivery(ctx, data, 'rejected', 'DELIVERY_REJECTED', 'delivery.approve')
}

async function confirmDeliveryByCustomer(ctx, data) {
  return transitionDelivery(ctx, data, 'customer_confirmed', 'DELIVERY_CUSTOMER_CONFIRMED', 'delivery.manage', { operatorType: 'customer' })
}

async function completeDelivery(ctx, data) {
  return transitionDelivery(ctx, data, 'completed', 'DELIVERY_COMPLETED', 'delivery.manage')
}

async function cancelDelivery(ctx, data) {
  return transitionDelivery(ctx, data, 'cancelled', 'DELIVERY_CANCELLED', 'delivery.manage')
}

async function getDeliveryActionHistory(ctx, data = {}) {
  await requirePermission(ctx, 'delivery.view')
  const delivery = await getDeliveryOrFail(ctx, data.deliveryId)
  const result = await db.collection(COLLECTIONS.history)
    .where({ enterpriseId: ctx.enterpriseId, deliveryId: delivery.deliveryId })
    .orderBy('createdAt', 'desc')
    .limit(100)
    .get()
  return ok({ history: (result.data || []).map((item) => sanitizeHistory(normalizeDoc(item))) })
}

const ACTIONS = Object.freeze({
  getDeliveryDashboard,
  listDeliveries,
  getDeliveryDetail,
  createDeliveryFromOrder,
  updateDelivery,
  submitDelivery,
  startDeliveryReview,
  approveDelivery,
  rejectDelivery,
  confirmDeliveryByCustomer,
  completeDelivery,
  cancelDelivery,
  getDeliveryActionHistory
})

exports.main = async (event = {}) => {
  const startedAt = Date.now()
  const action = String(event.action || '').trim()
  let success = false
  let errorCode = ''
  const data = event.data || {}
  try {
    if (!ACTIONS[action]) return fail('INVALID_ACTION', '未知操作')
    const ctx = await requireSession(event.sessionToken)
    const result = await ACTIONS[action](ctx, data)
    success = Boolean(result && result.success)
    errorCode = result && result.errorCode ? result.errorCode : ''
    return result
  } catch (error) {
    errorCode = error.errorCode || 'INTERNAL_ERROR'
    return fail(errorCode, error.message || '操作失败')
  } finally {
    console.info('[enterprise_delivery]', {
      action,
      success,
      errorCode,
      deliveryId: data.deliveryId || '',
      orderId: data.orderId || '',
      fromStatus: data.expectedStatus || '',
      toStatus: data.toStatus || '',
      durationMs: Date.now() - startedAt
    })
  }
}
