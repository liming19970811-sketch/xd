import { create as createLocalDelivery, getById as getDeliveryById, getList as getDeliveryList, update as updateDelivery } from '../repository/deliveryRepository.js'
import { getCurrentSession } from '../auth/authSessionService.js'
import { callEnterpriseDelivery } from '../delivery/enterpriseDeliveryTransport.js'
import { getDeliveryStatusLabel, normalizeDeliveryStatus } from '../delivery/deliveryStatus.js'
import { emit } from '../events/eventBus.js'
import { CUSTOMER_FEEDBACK_CREATED, DELIVERY_CONFIRMED } from '../events/businessEvents.js'
import { recordAudit } from '../audit/auditService.js'

export const DELIVERY_STATUS_FLOW = Object.freeze([
  'draft',
  'preparing',
  'submitted',
  'reviewing',
  'approved',
  'rejected',
  'customer_confirmed',
  'completed',
  'cancelled'
])

function isLocalMockSession() {
  const session = getCurrentSession()
  return !session || session.authSource === 'local_mock'
}

function normalizeDelivery(record = {}) {
  const status = normalizeDeliveryStatus(record.status)
  return {
    ...record,
    deliveryId: record.deliveryId || '',
    status,
    statusText: record.statusText || getDeliveryStatusLabel(status),
    itemCount: Number(record.itemCount || (Array.isArray(record.assetVersionIds) ? record.assetVersionIds.length : 0)),
    version: Number(record.version || 0)
  }
}

function buildFailure(result = {}, fallback = '\u4ea4\u4ed8\u64cd\u4f5c\u5931\u8d25') {
  return {
    success: false,
    errorCode: result?.errorCode || 'cloud_call_failed',
    message: result?.message || fallback
  }
}

export function getDeliveries(filters = {}) {
  return getDeliveryList(filters).map(normalizeDelivery)
}

export async function listDeliveries(filters = {}) {
  if (isLocalMockSession()) return getDeliveries(filters)
  const result = await callEnterpriseDelivery('listDeliveries', { filters })
  if (!result || !result.success) {
    throw Object.assign(new Error(result?.message || '\u4ea4\u4ed8\u5217\u8868\u52a0\u8f7d\u5931\u8d25'), { errorCode: result?.errorCode || 'cloud_call_failed' })
  }
  return (result.data?.deliveries || []).map(normalizeDelivery)
}

export async function getDeliveryDashboard() {
  if (isLocalMockSession()) {
    const deliveries = getDeliveries()
    return {
      success: true,
      summary: DELIVERY_STATUS_FLOW.reduce((result, status) => {
        result[status] = deliveries.filter((item) => item.status === status).length
        return result
      }, { total: deliveries.length }),
      deliveries,
      source: 'local_mock'
    }
  }
  const result = await callEnterpriseDelivery('getDeliveryDashboard')
  if (!result || !result.success) return buildFailure(result, '\u4ea4\u4ed8\u770b\u677f\u52a0\u8f7d\u5931\u8d25')
  return {
    success: true,
    summary: result.data?.summary || {},
    deliveries: (result.data?.deliveries || []).map(normalizeDelivery),
    source: 'cloud'
  }
}

export async function getDeliveryDetail(deliveryId = '') {
  if (isLocalMockSession()) {
    const delivery = getDeliveryById(deliveryId)
    return delivery
      ? { success: true, delivery: normalizeDelivery(delivery), history: [], source: 'local_mock' }
      : { success: false, errorCode: 'DELIVERY_NOT_FOUND', message: '\u4ea4\u4ed8\u5355\u4e0d\u5b58\u5728', source: 'local_mock' }
  }
  const result = await callEnterpriseDelivery('getDeliveryDetail', { deliveryId })
  if (!result || !result.success) return buildFailure(result, '\u4ea4\u4ed8\u8be6\u60c5\u52a0\u8f7d\u5931\u8d25')
  return {
    success: true,
    delivery: normalizeDelivery(result.data?.delivery),
    history: result.data?.history || [],
    source: 'cloud'
  }
}

export async function createDeliveryFromOrder(orderId = '', options = {}) {
  if (isLocalMockSession()) {
    const existing = getDeliveryList().find((item) => item.orderId === orderId)
    if (existing) return { success: true, delivery: normalizeDelivery(existing), source: 'local_mock', idempotent: true }
    const delivery = createLocalDelivery({
      orderId,
      title: `Order delivery ${orderId}`,
      status: 'preparing',
      assetVersionIds: ['local_mock_asset_version'],
      itemCount: 1
    })
    return {
      success: Boolean(delivery),
      delivery: delivery ? normalizeDelivery(delivery) : null,
      errorCode: delivery ? '' : 'create_failed',
      message: delivery ? '' : '\u4ea4\u4ed8\u5355\u521b\u5efa\u5931\u8d25',
      source: 'local_mock'
    }
  }
  const result = await callEnterpriseDelivery('createDeliveryFromOrder', { orderId, idempotencyKey: options.idempotencyKey })
  if (!result || !result.success) return buildFailure(result, '\u4ea4\u4ed8\u5355\u521b\u5efa\u5931\u8d25')
  return { success: true, delivery: normalizeDelivery(result.data?.delivery), source: 'cloud' }
}

export async function transitionDelivery(deliveryId = '', status = 'draft', actor = {}, options = {}) {
  const targetStatus = normalizeDeliveryStatus(status)
  if (isLocalMockSession()) {
    if (!deliveryId || !DELIVERY_STATUS_FLOW.includes(targetStatus)) {
      return { success: false, errorCode: 'DELIVERY_STATUS_INVALID', message: '\u4ea4\u4ed8\u72b6\u6001\u65e0\u6548' }
    }
    const previous = getDeliveryById(deliveryId)
    const patch = { status: targetStatus, updatedBy: actor.userId }
    if (targetStatus === 'completed') patch.completedAt = new Date().toISOString()
    const delivery = updateDelivery(deliveryId, patch)
    if (delivery && targetStatus === 'completed' && normalizeDeliveryStatus(previous?.status) !== 'completed') {
      emit(DELIVERY_CONFIRMED, { delivery, actor, before: previous, after: delivery })
    } else if (delivery && previous?.status !== targetStatus) {
      recordAudit({
        enterpriseId: delivery.enterpriseId,
        userId: actor.userId,
        operator: actor.operator,
        action: '\u66f4\u65b0\u4ea4\u4ed8\u72b6\u6001',
        targetType: 'delivery',
        targetId: delivery.deliveryId,
        before: { status: previous?.status || 'draft' },
        after: { status: delivery.status }
      })
    }
    return { success: Boolean(delivery), delivery: normalizeDelivery(delivery), source: 'local_mock' }
  }
  const actionMap = {
    submitted: 'submitDelivery',
    reviewing: 'startDeliveryReview',
    approved: 'approveDelivery',
    rejected: 'rejectDelivery',
    customer_confirmed: 'confirmDeliveryByCustomer',
    completed: 'completeDelivery',
    cancelled: 'cancelDelivery'
  }
  const action = actionMap[targetStatus]
  if (!action) return { success: false, errorCode: 'DELIVERY_STATUS_INVALID', message: '\u4ea4\u4ed8\u72b6\u6001\u4e0d\u80fd\u8df3\u8f6c' }
  const result = await callEnterpriseDelivery(action, {
    deliveryId,
    expectedVersion: options.expectedVersion,
    idempotencyKey: options.idempotencyKey,
    reason: options.reason
  })
  if (!result || !result.success) return buildFailure(result, '\u4ea4\u4ed8\u72b6\u6001\u66f4\u65b0\u5931\u8d25')
  return { success: true, delivery: normalizeDelivery(result.data?.delivery), history: result.data?.history, source: 'cloud' }
}

export async function confirmDelivery(deliveryId = '', actor = {}, options = {}) {
  return transitionDelivery(deliveryId, 'completed', actor, options)
}

export function syncDeliveryFeedback(deliveryId = '', feedback = {}, actor = {}) {
  const delivery = getDeliveryById(deliveryId)
  if (!delivery) return null
  const revisionRequired = feedback.type === '\u4fee\u6539\u5efa\u8bae' || feedback.status === 'revision_required'
  const updatedDelivery = updateDelivery(deliveryId, {
    customerFeedbackStatus: revisionRequired ? 'revision_required' : 'confirmed',
    customerFeedbackId: feedback.feedbackId || '',
    status: revisionRequired ? delivery.status : 'confirmed',
    completedAt: revisionRequired ? delivery.completedAt : new Date().toISOString(),
    updatedBy: actor.userId
  })
  if (updatedDelivery) {
    emit(CUSTOMER_FEEDBACK_CREATED, { delivery: updatedDelivery, feedback, actor, before: delivery, after: updatedDelivery })
    if (!revisionRequired && delivery.status !== 'confirmed') {
      emit(DELIVERY_CONFIRMED, { delivery: updatedDelivery, actor })
    }
  }
  return updatedDelivery
}

export function getDeliveryStatistics(deliveries = getDeliveryList()) {
  return DELIVERY_STATUS_FLOW.reduce((result, status) => {
    result[status] = deliveries.filter((item) => normalizeDeliveryStatus(item.status) === status).length
    return result
  }, { total: deliveries.length })
}
