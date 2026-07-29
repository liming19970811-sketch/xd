import { ORDER_STATUS, ORDER_TARGET_TYPES } from './orderRepository'

const FULFILLMENT_STORAGE_KEY = 'diebiandesign_order_fulfillments'

export const FULFILLMENT_ACTIONS = Object.freeze({
  [ORDER_TARGET_TYPES.MEMBERSHIP]: 'activate_membership',
  [ORDER_TARGET_TYPES.POINTS_PACKAGE]: 'add_points',
  [ORDER_TARGET_TYPES.API_PACKAGE]: 'enable_api',
  [ORDER_TARGET_TYPES.PROJECT_SERVICE]: 'create_project'
})

export const FULFILLMENT_STATUS = Object.freeze({
  PENDING: 'pending',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed'
})

const ELIGIBLE_ORDER_STATUSES = Object.freeze([
  ORDER_STATUS.PAID,
  ORDER_STATUS.PROCESSING,
  ORDER_STATUS.COMPLETED
])

const ACTION_LABELS = Object.freeze({
  activate_membership: '激活会员',
  add_points: '增加积分',
  enable_api: '启用 API',
  create_project: '创建项目'
})

const STATUS_LABELS = Object.freeze({
  pending: '等待履约',
  processing: '履约中',
  completed: '已完成',
  failed: '履约失败'
})

function createInitialFulfillments() {
  const now = Date.now()
  return [
    {
      fulfillmentId: 'fulfillment_demo_001',
      orderId: 'order_demo_001',
      action: 'activate_membership',
      targetType: ORDER_TARGET_TYPES.MEMBERSHIP,
      targetId: 'plan_professional_yearly',
      status: FULFILLMENT_STATUS.COMPLETED,
      createdAt: new Date(now - 11 * 24 * 60 * 60 * 1000).toISOString()
    },
    {
      fulfillmentId: 'fulfillment_demo_002',
      orderId: 'order_demo_003',
      action: 'enable_api',
      targetType: ORDER_TARGET_TYPES.API_PACKAGE,
      targetId: 'api_package_enterprise_10000',
      status: FULFILLMENT_STATUS.PROCESSING,
      createdAt: new Date(now - 16 * 60 * 60 * 1000).toISOString()
    }
  ]
}

function normalizeFulfillment(fulfillment = {}) {
  const targetType = Object.values(ORDER_TARGET_TYPES).includes(fulfillment.targetType)
    ? fulfillment.targetType
    : ORDER_TARGET_TYPES.MEMBERSHIP
  const expectedAction = FULFILLMENT_ACTIONS[targetType]
  const status = Object.values(FULFILLMENT_STATUS).includes(fulfillment.status)
    ? fulfillment.status
    : FULFILLMENT_STATUS.PENDING
  return {
    fulfillmentId: String(fulfillment.fulfillmentId || ''),
    orderId: String(fulfillment.orderId || ''),
    action: fulfillment.action === expectedAction ? fulfillment.action : expectedAction,
    targetType,
    targetId: String(fulfillment.targetId || ''),
    status,
    createdAt: fulfillment.createdAt || new Date().toISOString()
  }
}

function readFulfillments() {
  try {
    const records = uni.getStorageSync(FULFILLMENT_STORAGE_KEY)
    if (Array.isArray(records) && records.length) return records.map(normalizeFulfillment)
  } catch (error) {
    return createInitialFulfillments().map(normalizeFulfillment)
  }
  const initialRecords = createInitialFulfillments().map(normalizeFulfillment)
  writeFulfillments(initialRecords)
  return initialRecords
}

function writeFulfillments(records = []) {
  uni.setStorageSync(FULFILLMENT_STORAGE_KEY, records.map(normalizeFulfillment))
}

export function canFulfillOrder(order = {}) {
  return ELIGIBLE_ORDER_STATUSES.includes(order.status) && Boolean(FULFILLMENT_ACTIONS[order.targetType])
}

export function getOrderFulfillments() {
  return readFulfillments().sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt)))
}

export function createMockOrderFulfillment(order = {}) {
  if (!canFulfillOrder(order)) {
    throw new Error('当前订单状态不可履约')
  }
  const existing = readFulfillments().find((record) => record.orderId === order.orderId)
  if (existing) return existing
  const fulfillment = normalizeFulfillment({
    fulfillmentId: `fulfillment_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    orderId: order.orderId,
    action: FULFILLMENT_ACTIONS[order.targetType],
    targetType: order.targetType,
    targetId: order.targetId,
    status: FULFILLMENT_STATUS.COMPLETED,
    createdAt: new Date().toISOString()
  })
  writeFulfillments([fulfillment, ...readFulfillments()])
  console.log('[order:fulfillment]', {
    orderId: fulfillment.orderId,
    action: fulfillment.action,
    status: fulfillment.status
  })
  return fulfillment
}

export function getFulfillmentActionLabel(action = '') {
  return ACTION_LABELS[action] || action || '业务处理'
}

export function getFulfillmentStatusLabel(status = '') {
  return STATUS_LABELS[status] || '等待履约'
}

export function formatFulfillmentTime(value = '') {
  const date = value ? new Date(value) : null
  if (!date || Number.isNaN(date.getTime())) return '刚刚'
  const pad = (number) => String(number).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}
