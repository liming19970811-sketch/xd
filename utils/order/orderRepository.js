const ORDER_STORAGE_KEY = 'diebiandesign_commercial_orders'

export const ORDER_TYPES = Object.freeze({
  MEMBERSHIP: 'membership',
  POINTS: 'points',
  API_PACKAGE: 'api_package',
  PRIVATE_SERVICE: 'private_service'
})

export const ORDER_STATUS = Object.freeze({
  PENDING: 'pending',
  PAID: 'paid',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled'
})

export const ORDER_TARGET_TYPES = Object.freeze({
  MEMBERSHIP: 'membership',
  POINTS_PACKAGE: 'points_package',
  API_PACKAGE: 'api_package',
  PROJECT_SERVICE: 'project_service'
})

const TYPE_LABELS = Object.freeze({
  [ORDER_TYPES.MEMBERSHIP]: '会员套餐',
  [ORDER_TYPES.POINTS]: '积分套餐',
  [ORDER_TYPES.API_PACKAGE]: 'API 套餐',
  [ORDER_TYPES.PRIVATE_SERVICE]: '项目服务'
})

const STATUS_LABELS = Object.freeze({
  [ORDER_STATUS.PENDING]: '待支付',
  [ORDER_STATUS.PAID]: '已支付',
  [ORDER_STATUS.PROCESSING]: '处理中',
  [ORDER_STATUS.COMPLETED]: '已完成',
  [ORDER_STATUS.CANCELLED]: '已取消'
})

const TARGET_TYPE_LABELS = Object.freeze({
  [ORDER_TARGET_TYPES.MEMBERSHIP]: '会员套餐',
  [ORDER_TARGET_TYPES.POINTS_PACKAGE]: '积分包',
  [ORDER_TARGET_TYPES.API_PACKAGE]: 'API 套餐',
  [ORDER_TARGET_TYPES.PROJECT_SERVICE]: '项目服务'
})

const ORDER_TYPE_TARGET_MAP = Object.freeze({
  [ORDER_TYPES.MEMBERSHIP]: ORDER_TARGET_TYPES.MEMBERSHIP,
  [ORDER_TYPES.POINTS]: ORDER_TARGET_TYPES.POINTS_PACKAGE,
  [ORDER_TYPES.API_PACKAGE]: ORDER_TARGET_TYPES.API_PACKAGE,
  [ORDER_TYPES.PRIVATE_SERVICE]: ORDER_TARGET_TYPES.PROJECT_SERVICE
})

function createInitialOrders() {
  const now = Date.now()
  return [
    {
      orderId: 'order_demo_001',
      userId: 'user_demo_001',
      companyId: 'company_demo_001',
      orderType: ORDER_TYPES.MEMBERSHIP,
      targetId: 'plan_professional_yearly',
      targetType: ORDER_TARGET_TYPES.MEMBERSHIP,
      productName: '专业版年度会员',
      amount: 1999,
      points: 12000,
      status: ORDER_STATUS.COMPLETED,
      createdAt: new Date(now - 12 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(now - 11 * 24 * 60 * 60 * 1000).toISOString()
    },
    {
      orderId: 'order_demo_002',
      userId: 'user_demo_002',
      companyId: '',
      orderType: ORDER_TYPES.POINTS,
      targetId: 'points_package_1000',
      targetType: ORDER_TARGET_TYPES.POINTS_PACKAGE,
      productName: '1000 积分包',
      amount: 99,
      points: 1000,
      status: ORDER_STATUS.PAID,
      createdAt: new Date(now - 3 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(now - 3 * 24 * 60 * 60 * 1000).toISOString()
    },
    {
      orderId: 'order_demo_003',
      userId: 'user_demo_003',
      companyId: 'company_demo_002',
      orderType: ORDER_TYPES.API_PACKAGE,
      targetId: 'api_plan_professional_enterprise',
      planId: 'api_plan_professional_enterprise',
      targetType: ORDER_TARGET_TYPES.API_PACKAGE,
      productName: '企业 API 10000 次套餐',
      amount: 4999,
      points: 0,
      status: ORDER_STATUS.PROCESSING,
      createdAt: new Date(now - 36 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(now - 18 * 60 * 60 * 1000).toISOString()
    },
    {
      orderId: 'order_demo_004',
      userId: 'user_demo_004',
      companyId: 'company_demo_001',
      orderType: ORDER_TYPES.PRIVATE_SERVICE,
      targetId: 'project_demo_brand_visual_001',
      targetType: ORDER_TARGET_TYPES.PROJECT_SERVICE,
      productName: '品牌视觉项目服务',
      amount: 12800,
      points: 0,
      status: ORDER_STATUS.PENDING,
      createdAt: new Date(now - 4 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(now - 4 * 60 * 60 * 1000).toISOString()
    }
  ]
}

function normalizeOrder(order = {}) {
  const now = new Date().toISOString()
  const orderType = Object.values(ORDER_TYPES).includes(order.orderType)
    ? order.orderType
    : ORDER_TYPES.POINTS
  const status = Object.values(ORDER_STATUS).includes(order.status)
    ? order.status
    : ORDER_STATUS.PENDING
  const targetType = Object.values(ORDER_TARGET_TYPES).includes(order.targetType)
    ? order.targetType
    : ORDER_TYPE_TARGET_MAP[orderType]
  const targetId = String(order.targetId || order.projectId || `${targetType}_${order.orderId || 'legacy'}`)
  const planId = orderType === ORDER_TYPES.API_PACKAGE
    ? String(order.planId || targetId)
    : String(order.planId || '')
  return {
    orderId: String(order.orderId || ''),
    userId: String(order.userId || ''),
    companyId: String(order.companyId || ''),
    orderType,
    targetId,
    targetType,
    planId,
    productName: String(order.productName || TYPE_LABELS[orderType]),
    amount: Math.max(0, Number(order.amount) || 0),
    points: Math.max(0, Number(order.points) || 0),
    status,
    createdAt: order.createdAt || now,
    updatedAt: order.updatedAt || order.createdAt || now
  }
}

function readOrders() {
  try {
    const orders = uni.getStorageSync(ORDER_STORAGE_KEY)
    if (Array.isArray(orders) && orders.length) return orders.map(normalizeOrder)
  } catch (error) {
    return createInitialOrders().map(normalizeOrder)
  }
  const initialOrders = createInitialOrders().map(normalizeOrder)
  writeOrders(initialOrders)
  return initialOrders
}

function writeOrders(orders = []) {
  uni.setStorageSync(ORDER_STORAGE_KEY, orders.map(normalizeOrder))
}

export function getOrders() {
  return readOrders().sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt)))
}

export function createOrder(input = {}) {
  const now = new Date().toISOString()
  const order = normalizeOrder({
    ...input,
    orderId: input.orderId || `order_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    status: input.status || ORDER_STATUS.PENDING,
    createdAt: now,
    updatedAt: now
  })
  writeOrders([order, ...readOrders()])
  console.log('[order:create]', {
    orderId: order.orderId,
    orderType: order.orderType,
    status: order.status
  })
  return order
}

export function updateOrder(orderId = '', patch = {}) {
  const orders = readOrders()
  const index = orders.findIndex((order) => order.orderId === orderId)
  if (index < 0) throw new Error('订单不存在')
  const currentOrder = orders[index]
  const order = normalizeOrder({
    ...currentOrder,
    ...patch,
    orderId: currentOrder.orderId,
    userId: currentOrder.userId,
    companyId: currentOrder.companyId,
    orderType: currentOrder.orderType,
    createdAt: currentOrder.createdAt,
    updatedAt: new Date().toISOString()
  })
  orders.splice(index, 1, order)
  writeOrders(orders)
  console.log('[order:update]', {
    orderId: order.orderId,
    status: order.status,
    targetType: order.targetType
  })
  return order
}

export function getOrderTypeLabel(orderType = '') {
  return TYPE_LABELS[orderType] || '商业订单'
}

export function getOrderStatusLabel(status = '') {
  return STATUS_LABELS[status] || '待支付'
}

export function getOrderTargetTypeLabel(targetType = '') {
  return TARGET_TYPE_LABELS[targetType] || '购买对象'
}

export function getOrderCustomerLabel(order = {}) {
  return order.companyId || order.userId || '匿名客户'
}

export function getOrderApiPlanId(order = {}) {
  return order.orderType === ORDER_TYPES.API_PACKAGE
    ? String(order.planId || order.targetId || '')
    : ''
}

export function formatOrderTime(value = '') {
  const date = value ? new Date(value) : null
  if (!date || Number.isNaN(date.getTime())) return '刚刚'
  const pad = (number) => String(number).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}
