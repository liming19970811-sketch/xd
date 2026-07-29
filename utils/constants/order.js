export const ORDER_TYPE = Object.freeze({
  DESIGN_SERVICE: 'design_service',
  AI_GENERATE: 'ai_generate',
  PACKAGE_PURCHASE: 'package_purchase',
  PROJECT_SERVICE: 'project_service'
})

export const ORDER_STATUS = Object.freeze({
  CREATED: 'created',
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  CLOSED: 'closed',
  CANCELLED: 'cancelled'
})

export const PAY_STATUS = Object.freeze({
  UNPAID: 'unpaid',
  PENDING: 'pending',
  PAID: 'paid',
  FAILED: 'failed',
  REFUNDED: 'refunded'
})

export const PAY_CHANNEL = Object.freeze({
  WECHAT: 'wechat',
  ALIPAY: 'alipay',
  OFFLINE: 'offline',
  BALANCE: 'balance'
})
