import {
  CUSTOMER_FEEDBACK_CREATED,
  DELIVERY_CONFIRMED,
  ORDER_CREATED,
  PRODUCT_READY,
  PROJECT_STATUS_CHANGED,
  QUOTE_CONFIRMED
} from '../events/businessEvents.js'

function pick(record = {}, fields = []) {
  return fields.reduce((result, field) => {
    if (record[field] !== undefined) result[field] = record[field]
    return result
  }, {})
}

const EVENT_CONFIG = Object.freeze({
  [QUOTE_CONFIRMED]: {
    action: '确认报价',
    targetType: 'quote',
    entityKey: 'quote',
    idKey: 'quoteId',
    fields: ['quoteId', 'projectId', 'status', 'amount']
  },
  [ORDER_CREATED]: {
    action: '创建订单',
    targetType: 'order',
    entityKey: 'order',
    idKey: 'orderId',
    fields: ['orderId', 'projectId', 'sourceQuoteId', 'status', 'amount']
  },
  [PRODUCT_READY]: {
    action: '商品生产完成',
    targetType: 'product',
    entityKey: 'product',
    idKey: 'productPackageId',
    fields: ['productPackageId', 'projectId', 'productStatus', 'status']
  },
  [DELIVERY_CONFIRMED]: {
    action: '确认交付',
    targetType: 'delivery',
    entityKey: 'delivery',
    idKey: 'deliveryId',
    fields: ['deliveryId', 'projectId', 'status', 'completedAt']
  },
  [CUSTOMER_FEEDBACK_CREATED]: {
    action: '处理客户反馈',
    targetType: 'customer_feedback',
    entityKey: 'feedback',
    idKey: 'feedbackId',
    fields: ['feedbackId', 'deliveryId', 'status', 'type']
  },
  [PROJECT_STATUS_CHANGED]: {
    action: '更新项目状态',
    targetType: 'project',
    entityKey: 'project',
    idKey: 'projectId',
    fields: ['projectId', 'status', 'statusSource']
  }
})

export const AUDITED_BUSINESS_EVENTS = Object.freeze(Object.keys(EVENT_CONFIG))

export function buildAuditInput(eventName = '', payload = {}) {
  const config = EVENT_CONFIG[eventName]
  if (!config) return null
  const entity = payload[config.entityKey] || payload.after || {}
  const previous = payload.before || (payload.previousStatus ? { status: payload.previousStatus } : {})
  const actor = payload.actor || {}
  return {
    enterpriseId: entity.enterpriseId || actor.enterpriseId || '',
    userId: actor.userId || entity.updatedBy || entity.userId || '',
    operator: actor.operator || actor.name || '',
    action: config.action,
    targetType: config.targetType,
    targetId: entity[config.idKey] || payload.targetId || '',
    before: pick(previous, config.fields),
    after: pick(entity, config.fields)
  }
}
