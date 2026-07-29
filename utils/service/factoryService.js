import { getCurrentMember, getCurrentUser } from '../auth/authRepository.js'
import { hasPermission } from '../auth/permissionService.js'
import { recordAudit } from '../audit/auditService.js'
import * as factoryRepository from '../repository/factoryRepository.js'
import * as factoryQuoteRepository from '../repository/factoryQuoteRepository.js'
import * as productionOrderRepository from '../repository/productionOrderRepository.js'

export const FACTORY_PERMISSION_KEYS = Object.freeze({
  VIEW: 'factory.view',
  MANAGE: 'factory.manage',
  QUOTE: 'factory.quote',
  COLLABORATE: 'factory.collaborate'
})

export const FACTORY_MEMBER_ROLES = Object.freeze([
  'factory_admin',
  'factory_merchandiser',
  'production_coordinator',
  'quality_inspector'
])

const ORDER_TRANSITIONS = Object.freeze({
  pending_confirmation: ['confirmed', 'cancelled'],
  confirmed: ['in_production', 'cancelled'],
  in_production: ['quality_check', 'cancelled'],
  quality_check: ['in_production', 'ready_to_ship', 'cancelled'],
  ready_to_ship: ['shipped', 'cancelled'],
  shipped: ['completed'],
  completed: [],
  cancelled: []
})

function nowIso() {
  return new Date().toISOString()
}

function actor() {
  const user = getCurrentUser()
  const member = getCurrentMember()
  return { userId: user.userId, operator: user.name || member.memberId || '当前成员', member }
}

function audit(action = '', targetType = '', targetId = '', before = {}, after = {}) {
  const current = actor()
  return recordAudit({
    userId: current.userId,
    operator: current.operator,
    action,
    targetType,
    targetId,
    before,
    after
  })
}

function success(data = {}, extra = {}) {
  return { success: true, data, errorCode: '', message: '', ...extra }
}

function failure(errorCode = 'operation_failed', message = '操作失败') {
  return { success: false, data: null, errorCode, message }
}

function hasAnyPermission(keys = []) {
  return keys.some((key) => hasPermission(key))
}

export function getFactoryMember(factory = {}) {
  const currentUser = getCurrentUser()
  const currentMember = getCurrentMember()
  return (Array.isArray(factory.members) ? factory.members : []).find((item) =>
    item.status === 'active' && (item.userId === currentUser.userId || item.memberId === currentMember.memberId)
  ) || null
}

export function canAccessFactory(factory = {}, operation = 'view') {
  const permissionMap = {
    view: [FACTORY_PERMISSION_KEYS.VIEW, FACTORY_PERMISSION_KEYS.MANAGE],
    manage: [FACTORY_PERMISSION_KEYS.MANAGE],
    quote: [FACTORY_PERMISSION_KEYS.QUOTE, FACTORY_PERMISSION_KEYS.MANAGE],
    collaborate: [FACTORY_PERMISSION_KEYS.COLLABORATE, FACTORY_PERMISSION_KEYS.MANAGE]
  }
  if (hasAnyPermission(permissionMap[operation] || permissionMap.view)) return true
  const member = getFactoryMember(factory)
  if (!member) return false
  if (operation === 'manage') return member.role === 'factory_admin'
  if (operation === 'quote') return ['factory_admin', 'factory_merchandiser'].includes(member.role)
  if (operation === 'collaborate') return ['factory_admin', 'factory_merchandiser', 'production_coordinator', 'quality_inspector'].includes(member.role)
  return true
}

export function listFactories(filters = {}) {
  return factoryRepository.getList(filters).filter((factory) => canAccessFactory(factory, 'view'))
}

export function createFactory(input = {}) {
  if (!hasAnyPermission([FACTORY_PERMISSION_KEYS.MANAGE])) return failure('permission_denied', '当前角色无权创建工厂档案')
  if (!String(input.name || '').trim()) return failure('factory_name_required', '请输入工厂名称')
  const factory = factoryRepository.create(input)
  if (!factory) return failure('factory_create_failed', '工厂档案创建失败')
  audit('创建工厂档案', 'factory', factory.factoryId, {}, { status: factory.status, verificationStatus: factory.verificationStatus })
  return success({ factory })
}

export function updateFactory(factoryId = '', patch = {}) {
  const current = factoryRepository.getById(factoryId)
  if (!current) return failure('factory_not_found', '工厂不存在')
  if (!canAccessFactory(current, 'manage')) return failure('permission_denied', '当前角色无权编辑该工厂')
  const factory = factoryRepository.update(factoryId, patch)
  if (!factory) return failure('factory_update_failed', '工厂档案更新失败')
  audit('更新工厂档案', 'factory', factoryId, { status: current.status, verificationStatus: current.verificationStatus }, { status: factory.status, verificationStatus: factory.verificationStatus })
  return success({ factory })
}

export function setFactoryVerification(factoryId = '', verificationStatus = 'pending') {
  if (!['pending', 'verified', 'rejected'].includes(verificationStatus)) return failure('verification_status_invalid', '认证状态无效')
  return updateFactory(factoryId, { verificationStatus })
}

export function addFactoryMember(factoryId = '', input = {}) {
  const factory = factoryRepository.getById(factoryId)
  if (!factory) return failure('factory_not_found', '工厂不存在')
  if (!canAccessFactory(factory, 'manage')) return failure('permission_denied', '当前角色无权管理工厂成员')
  if (!String(input.name || '').trim()) return failure('member_name_required', '请输入成员名称')
  if (!FACTORY_MEMBER_ROLES.includes(input.role)) return failure('factory_member_role_invalid', '工厂成员角色无效')
  const userId = String(input.userId || '').trim()
  if (userId && (factory.members || []).some((item) => item.userId === userId)) {
    return failure('factory_member_exists', '该用户已在工厂成员中')
  }
  const member = {
    memberId: input.memberId || `factory_member_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    factoryId,
    userId,
    name: String(input.name || ''),
    role: String(input.role || 'factory_coordinator'),
    status: ['pending', 'active', 'disabled'].includes(input.status) ? input.status : 'pending',
    createdAt: nowIso(),
    updatedAt: nowIso()
  }
  const members = [member, ...(factory.members || []).filter((item) => item.memberId !== member.memberId)]
  const updated = factoryRepository.update(factoryId, { members })
  audit('添加工厂成员', 'factory', factoryId, {}, { memberId: member.memberId, role: member.role, status: member.status })
  return success({ factory: updated, member })
}

export function updateFactoryMember(factoryId = '', memberId = '', patch = {}) {
  const factory = factoryRepository.getById(factoryId)
  if (!factory) return failure('factory_not_found', '工厂不存在')
  if (!canAccessFactory(factory, 'manage')) return failure('permission_denied', '当前角色无权管理工厂成员')
  const target = (factory.members || []).find((item) => item.memberId === memberId)
  if (!target) return failure('factory_member_not_found', '工厂成员不存在')
  if (patch.role && !FACTORY_MEMBER_ROLES.includes(patch.role)) return failure('factory_member_role_invalid', '工厂成员角色无效')
  const members = factory.members.map((item) => item.memberId === memberId ? {
    ...item,
    role: patch.role || item.role,
    status: ['pending', 'active', 'disabled'].includes(patch.status) ? patch.status : item.status,
    updatedAt: nowIso()
  } : item)
  const updated = factoryRepository.update(factoryId, { members })
  audit('更新工厂成员', 'factory', factoryId, { memberId, role: target.role, status: target.status }, { memberId, role: patch.role || target.role, status: patch.status || target.status })
  return success({ factory: updated })
}

export function inviteFactoryQuote(input = {}) {
  const factory = factoryRepository.getById(input.factoryId)
  if (!factory) return failure('factory_not_found', '工厂不存在')
  if (!hasAnyPermission([FACTORY_PERMISSION_KEYS.QUOTE, FACTORY_PERMISSION_KEYS.MANAGE])) return failure('permission_denied', '当前角色无权发起询价')
  if (factory.verificationStatus !== 'verified') return failure('factory_not_verified', '仅可邀请已认证工厂')
  if (!String(input.projectId || '').trim()) return failure('project_required', '请选择关联项目')
  const quote = factoryQuoteRepository.create({ ...input, status: 'invited' })
  if (!quote) return failure('quote_create_failed', '询价邀请创建失败')
  audit('发送工厂询价邀请', 'factory_quote', quote.quoteId, {}, { factoryId: quote.factoryId, projectId: quote.projectId, status: quote.status })
  return success({ quote })
}

export function submitFactoryQuote(quoteId = '', input = {}) {
  const quote = factoryQuoteRepository.getById(quoteId)
  if (!quote) return failure('factory_quote_not_found', '询价不存在')
  const factory = factoryRepository.getById(quote.factoryId)
  if (!factory || !canAccessFactory(factory, 'quote')) return failure('permission_denied', '当前成员无权提交该工厂报价')
  if (!['invited', 'viewed', 'submitted'].includes(quote.status)) return failure('quote_status_invalid', '当前询价状态不可提交报价')
  if (Number(input.amount || 0) <= 0) return failure('quote_amount_required', '请输入有效报价金额')
  if (Number(input.leadTimeDays || 0) <= 0) return failure('lead_time_required', '请输入生产周期')
  const current = actor()
  const updated = factoryQuoteRepository.update(quoteId, {
    ...input,
    status: 'submitted',
    submittedBy: current.userId,
    submittedAt: nowIso()
  })
  audit('提交工厂报价', 'factory_quote', quoteId, { status: quote.status }, { status: updated.status, amount: updated.amount, leadTimeDays: updated.leadTimeDays })
  return success({ quote: updated })
}

export function acceptFactoryQuote(quoteId = '') {
  if (!hasAnyPermission([FACTORY_PERMISSION_KEYS.MANAGE])) return failure('permission_denied', '仅工厂管理权限可确认报价')
  const quote = factoryQuoteRepository.getById(quoteId)
  if (!quote) return failure('factory_quote_not_found', '询价不存在')
  if (quote.status !== 'submitted' && quote.status !== 'accepted') return failure('quote_status_invalid', '仅可确认已提交的报价')
  const existing = productionOrderRepository.getList().find((item) => item.sourceQuoteId === quoteId)
  if (existing) return success({ quote, productionOrder: existing }, { idempotent: true })
  const productionOrder = productionOrderRepository.create({
    sourceQuoteId: quoteId,
    commercialOrderId: quote.commercialOrderId,
    projectId: quote.projectId,
    factoryId: quote.factoryId,
    items: quote.items,
    amount: quote.amount,
    requestedDeliveryAt: quote.requestedDeliveryAt,
    promisedDeliveryAt: quote.estimatedDeliveryAt,
    latestEstimatedDeliveryAt: quote.estimatedDeliveryAt,
    status: 'pending_confirmation'
  })
  if (!productionOrder) return failure('production_order_create_failed', '生产协作单创建失败')
  const accepted = factoryQuoteRepository.update(quoteId, { status: 'accepted', acceptedAt: nowIso() })
  audit('确认报价并创建生产协作单', 'production_order', productionOrder.productionOrderId, {}, { sourceQuoteId: quoteId, status: productionOrder.status })
  return success({ quote: accepted, productionOrder })
}

export function transitionProductionOrder(productionOrderId = '', status = '') {
  const order = productionOrderRepository.getById(productionOrderId)
  if (!order) return failure('production_order_not_found', '生产协作单不存在')
  const factory = factoryRepository.getById(order.factoryId)
  if (!factory || !canAccessFactory(factory, 'collaborate')) return failure('permission_denied', '当前成员无权更新该生产协作单')
  const allowed = ORDER_TRANSITIONS[order.status] || []
  if (!allowed.includes(status)) return failure('production_status_invalid', '当前状态不能执行该操作')
  const log = { operator: actor().operator, fromStatus: order.status, toStatus: status, time: nowIso() }
  const patch = {
    status,
    progressLogs: [log, ...(order.progressLogs || [])]
  }
  if (status === 'completed') patch.completedAt = nowIso()
  const updated = productionOrderRepository.update(productionOrderId, patch)
  audit('更新生产协作状态', 'production_order', productionOrderId, { status: order.status }, { status })
  return success({ productionOrder: updated })
}

export function submitLeadTimeFeedback(productionOrderId = '', input = {}) {
  const order = productionOrderRepository.getById(productionOrderId)
  if (!order) return failure('production_order_not_found', '生产协作单不存在')
  const factory = factoryRepository.getById(order.factoryId)
  if (!factory || !canAccessFactory(factory, 'collaborate')) return failure('permission_denied', '当前成员无权反馈交期')
  if (!String(input.estimatedDeliveryAt || '').trim()) return failure('delivery_date_required', '请选择预计交期')
  const feedback = {
    feedbackId: `lead_time_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    estimatedDeliveryAt: String(input.estimatedDeliveryAt),
    risk: ['none', 'low', 'medium', 'high'].includes(input.risk) ? input.risk : 'none',
    content: String(input.content || ''),
    operator: actor().operator,
    time: nowIso()
  }
  const updated = productionOrderRepository.update(productionOrderId, {
    latestEstimatedDeliveryAt: feedback.estimatedDeliveryAt,
    deliveryRisk: feedback.risk,
    deliveryFeedbacks: [feedback, ...(order.deliveryFeedbacks || [])]
  })
  audit('反馈生产交期', 'production_order', productionOrderId, { latestEstimatedDeliveryAt: order.latestEstimatedDeliveryAt }, { latestEstimatedDeliveryAt: updated.latestEstimatedDeliveryAt, deliveryRisk: updated.deliveryRisk })
  return success({ productionOrder: updated, feedback })
}

export function recordProductionAnomaly(productionOrderId = '', input = {}) {
  const order = productionOrderRepository.getById(productionOrderId)
  if (!order) return failure('production_order_not_found', '生产协作单不存在')
  const factory = factoryRepository.getById(order.factoryId)
  if (!factory || !canAccessFactory(factory, 'collaborate')) return failure('permission_denied', '当前成员无权记录异常')
  if (!String(input.content || '').trim()) return failure('anomaly_content_required', '请输入异常说明')
  const anomaly = {
    anomalyId: `factory_anomaly_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    type: String(input.type || 'production'),
    level: ['low', 'medium', 'high'].includes(input.level) ? input.level : 'medium',
    content: String(input.content),
    status: 'open',
    operator: actor().operator,
    createdAt: nowIso(),
    resolvedAt: ''
  }
  const updated = productionOrderRepository.update(productionOrderId, { anomalies: [anomaly, ...(order.anomalies || [])] })
  audit('记录生产异常', 'production_order', productionOrderId, {}, { anomalyId: anomaly.anomalyId, level: anomaly.level, status: anomaly.status })
  return success({ productionOrder: updated, anomaly })
}

export function resolveProductionAnomaly(productionOrderId = '', anomalyId = '') {
  const order = productionOrderRepository.getById(productionOrderId)
  if (!order) return failure('production_order_not_found', '生产协作单不存在')
  const factory = factoryRepository.getById(order.factoryId)
  if (!factory || !canAccessFactory(factory, 'collaborate')) return failure('permission_denied', '当前成员无权处理异常')
  const target = (order.anomalies || []).find((item) => item.anomalyId === anomalyId)
  if (!target) return failure('anomaly_not_found', '异常记录不存在')
  const anomalies = order.anomalies.map((item) => item.anomalyId === anomalyId ? { ...item, status: 'resolved', resolvedAt: nowIso() } : item)
  const updated = productionOrderRepository.update(productionOrderId, { anomalies })
  audit('关闭生产异常', 'production_order', productionOrderId, { anomalyId, status: target.status }, { anomalyId, status: 'resolved' })
  return success({ productionOrder: updated })
}

export function recordQualityResult(productionOrderId = '', qualityStatus = 'pending') {
  if (!['passed', 'failed'].includes(qualityStatus)) return failure('quality_status_invalid', '质检结果无效')
  const order = productionOrderRepository.getById(productionOrderId)
  if (!order) return failure('production_order_not_found', '生产协作单不存在')
  const factory = factoryRepository.getById(order.factoryId)
  if (!factory || !canAccessFactory(factory, 'collaborate')) return failure('permission_denied', '当前成员无权记录质检结果')
  const updated = productionOrderRepository.update(productionOrderId, { qualityStatus })
  audit('记录生产质检结果', 'production_order', productionOrderId, { qualityStatus: order.qualityStatus }, { qualityStatus })
  return success({ productionOrder: updated })
}

export function getFactoryPerformance(factoryId = '') {
  const quotes = factoryQuoteRepository.getList({ factoryId })
  const orders = productionOrderRepository.getList({ factoryId })
  const submittedQuotes = quotes.filter((item) => ['submitted', 'accepted'].includes(item.status))
  const completed = orders.filter((item) => item.status === 'completed')
  const onTime = completed.filter((item) => {
    if (!item.completedAt || !item.promisedDeliveryAt) return false
    return new Date(item.completedAt).getTime() <= new Date(item.promisedDeliveryAt).getTime()
  })
  const anomalies = orders.flatMap((item) => item.anomalies || [])
  const qualityChecked = orders.filter((item) => ['passed', 'failed'].includes(item.qualityStatus))
  return {
    invitationCount: quotes.length,
    submittedQuoteCount: submittedQuotes.length,
    quoteResponseRate: quotes.length ? Math.round(submittedQuotes.length / quotes.length * 100) : null,
    productionOrderCount: orders.length,
    completedOrderCount: completed.length,
    onTimeDeliveryRate: completed.length ? Math.round(onTime.length / completed.length * 100) : null,
    qualityPassRate: qualityChecked.length ? Math.round(qualityChecked.filter((item) => item.qualityStatus === 'passed').length / qualityChecked.length * 100) : null,
    openAnomalyCount: anomalies.filter((item) => item.status !== 'resolved').length
  }
}

export function getFactoryQuotes(filters = {}) {
  return factoryQuoteRepository.getList(filters)
}

export function getProductionOrders(filters = {}) {
  return productionOrderRepository.getList(filters)
}
