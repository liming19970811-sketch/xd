import { create as createOrder, getList as getOrderList, update as updateOrder } from '../repository/orderRepository.js'
import { emit, on } from '../events/eventBus.js'
import { ORDER_CREATED, QUOTE_CONFIRMED } from '../events/businessEvents.js'
import { recordAudit } from '../audit/auditService.js'

export const ORDER_STATUS_FLOW = Object.freeze(['pending_payment', 'processing', 'completed', 'closed'])

function logOrderAction(payload = {}) {
  if (typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'production') return
  console.log('[order:flow]', {
    entityId: payload.entityId || '',
    action: payload.action || '',
    success: Boolean(payload.success),
    errorCode: payload.errorCode || ''
  })
}

function auditOrder(action = '', order = {}, actor = {}, before = {}) {
  if (!order || !order.orderId) return null
  return recordAudit({
    enterpriseId: order.enterpriseId || actor.enterpriseId,
    userId: actor.userId,
    operator: actor.operator,
    action,
    targetType: 'order',
    targetId: order.orderId,
    before: before && before.orderId ? { status: before.status || 'pending_payment' } : {},
    after: {
      status: order.status || 'pending_payment',
      projectId: order.projectId || '',
      sourceQuoteId: order.sourceQuoteId || '',
      amount: Number(order.amount || 0)
    }
  })
}

export function getOrders(filters = {}) {
  const records = getOrderList()
  return filters.projectId ? records.filter((item) => item.projectId === filters.projectId) : records
}

export function createOrderFromQuote(quote = {}, actor = {}) {
  if (!quote.quoteId) {
    logOrderAction({ action: 'create_from_quote', success: false, errorCode: 'missing_quote_id' })
    return null
  }
  const existing = getOrderList().find((item) => item.sourceQuoteId === quote.quoteId)
  if (existing) {
    logOrderAction({ entityId: existing.orderId, action: 'create_from_quote', success: true })
    return existing
  }
  const order = createOrder({
    projectId: quote.projectId || '',
    customer: quote.customer || quote.customerName || '\u672a\u8bbe\u7f6e\u5ba2\u6237',
    amount: Number(quote.amount || 0),
    status: 'pending_payment',
    sourceQuoteId: quote.quoteId,
    enterpriseId: quote.enterpriseId || actor.enterpriseId,
    userId: actor.userId,
    createdBy: actor.userId
  })
  if (order) {
    auditOrder('\u8ba2\u5355\u521b\u5efa', order, actor)
    emit(ORDER_CREATED, { order, quote, actor })
    logOrderAction({ entityId: order.orderId, action: 'create_from_quote', success: true })
  } else {
    logOrderAction({ action: 'create_from_quote', success: false, errorCode: 'create_failed' })
  }
  return order
}

on(QUOTE_CONFIRMED, ({ quote = {}, actor = {} } = {}) => createOrderFromQuote(quote, actor))

export function transitionOrder(orderId = '', status = 'pending_payment', actor = {}) {
  if (!orderId || !ORDER_STATUS_FLOW.includes(status)) {
    logOrderAction({ entityId: orderId, action: status, success: false, errorCode: 'invalid_status' })
    return null
  }
  const previous = getOrderList().find((item) => item.orderId === orderId)
  const order = updateOrder(orderId, { status, updatedBy: actor.userId })
  if (order && previous?.status !== status) {
    auditOrder('\u66f4\u65b0\u8ba2\u5355\u72b6\u6001', order, actor, previous)
  }
  logOrderAction({ entityId: orderId, action: status, success: Boolean(order), errorCode: order ? '' : 'update_failed' })
  return order
}

export function calculateOrderStatistics(orders = getOrderList()) {
  return {
    orderCount: orders.length,
    dealAmount: orders.filter((item) => ['processing', 'completed'].includes(item.status)).reduce((sum, item) => sum + Number(item.amount || 0), 0),
    pendingAmount: orders.filter((item) => item.status === 'pending_payment').reduce((sum, item) => sum + Number(item.amount || 0), 0),
    completedCount: orders.filter((item) => item.status === 'completed').length
  }
}
