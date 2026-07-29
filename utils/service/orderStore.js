import { ORDER_STATUS, ORDER_TYPE, PAY_CHANNEL, PAY_STATUS } from '../constants'

const ORDER_STORAGE_KEY = 'admin_orders'

const DEFAULT_ORDERS = [
  {
    orderId: 'order_demo_package_001',
    orderType: ORDER_TYPE.PACKAGE_PURCHASE,
    orderStatus: ORDER_STATUS.PENDING,
    payStatus: PAY_STATUS.UNPAID,
    payChannel: PAY_CHANNEL.WECHAT,
    packageType: 'times_card',
    amount: 19900,
    buyerName: 'Demo Brand',
    createdAt: '2026-04-20T08:00:00.000Z',
    updatedAt: '2026-04-20T08:00:00.000Z'
  },
  {
    orderId: 'order_demo_service_001',
    orderType: ORDER_TYPE.PROJECT_SERVICE,
    orderStatus: ORDER_STATUS.COMPLETED,
    payStatus: PAY_STATUS.PAID,
    payChannel: PAY_CHANNEL.OFFLINE,
    packageType: '',
    amount: 89900,
    buyerName: 'Sample Studio',
    createdAt: '2026-04-19T06:30:00.000Z',
    updatedAt: '2026-04-19T09:10:00.000Z'
  }
]

function createOrderEntity(overrides = {}) {
  const now = new Date().toISOString()
  return {
    orderId: `order_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    orderType: ORDER_TYPE.PACKAGE_PURCHASE,
    orderStatus: ORDER_STATUS.PENDING,
    payStatus: PAY_STATUS.UNPAID,
    payChannel: PAY_CHANNEL.WECHAT,
    packageType: '',
    amount: 0,
    buyerName: '',
    createdAt: now,
    updatedAt: now,
    ...overrides
  }
}

function normalizeOrderList(list) {
  if (!Array.isArray(list) || !list.length) {
    return DEFAULT_ORDERS.map((order) => createOrderEntity(order))
  }

  return list.map((order) => createOrderEntity(order))
}

function saveOrderList(list) {
  uni.setStorageSync(ORDER_STORAGE_KEY, list)
}

export function getOrderList() {
  const orders = normalizeOrderList(uni.getStorageSync(ORDER_STORAGE_KEY))
  saveOrderList(orders)
  return [...orders].sort((left, right) =>
    String(right.updatedAt || right.createdAt || '').localeCompare(String(left.updatedAt || left.createdAt || ''))
  )
}

export function updateOrder(orderId, patch = {}) {
  const normalizedOrderId = String(orderId || '').trim()
  if (!normalizedOrderId) {
    throw new Error('Order ID is required')
  }

  const orders = getOrderList()
  let updatedOrder = null

  const nextOrders = orders.map((order) => {
    if (order.orderId !== normalizedOrderId) {
      return order
    }

    updatedOrder = createOrderEntity({
      ...order,
      ...patch,
      orderId: order.orderId,
      updatedAt: new Date().toISOString()
    })
    return updatedOrder
  })

  if (!updatedOrder) {
    throw new Error('Order not found')
  }

  saveOrderList(nextOrders)
  return updatedOrder
}
