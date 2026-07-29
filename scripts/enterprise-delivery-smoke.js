const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8')
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function includesAll(source, values, label) {
  values.forEach((value) => assert(source.includes(value), `${label} missing: ${value}`))
}

const cloudFunction = read('cloudfunctions/enterprise_delivery/index.js')
const deliveryStatus = read('utils/delivery/deliveryStatus.js')
const deliveryService = read('utils/service/deliveryService.js')
const ordersPage = read('pages/enterprise-web/orders.vue')
const orderDetailPage = read('pages/enterprise-web/order-detail.vue')
const deliveriesPage = read('pages/enterprise-web/deliveries.vue')
const deliveryDetailPage = read('pages/enterprise-web/delivery-detail.vue')
const permissionCatalog = read('utils/permission/permissionCatalog.js')

includesAll(cloudFunction, [
  'getDeliveryDashboard',
  'listDeliveries',
  'getDeliveryDetail',
  'createDeliveryFromOrder',
  'updateDelivery',
  'submitDelivery',
  'startDeliveryReview',
  'approveDelivery',
  'rejectDelivery',
  'confirmDeliveryByCustomer',
  'completeDelivery',
  'cancelDelivery',
  'getDeliveryActionHistory'
], 'enterprise_delivery action')

includesAll(cloudFunction, [
  'INVALID_ACTION',
  'AUTH_REQUIRED',
  'SESSION_INVALID',
  'SESSION_EXPIRED',
  'SESSION_REVOKED',
  'MEMBER_NOT_FOUND',
  'MEMBER_NOT_ACTIVE',
  'FORBIDDEN',
  'ORDER_NOT_FOUND',
  'DELIVERY_NOT_FOUND',
  'DELIVERY_ITEM_REQUIRED',
  'DELIVERY_ITEM_NOT_ELIGIBLE',
  'DELIVERY_STATUS_INVALID',
  'DELIVERY_STATUS_CONFLICT',
  'DELIVERY_VERSION_CONFLICT',
  'REJECT_REASON_REQUIRED',
  'IDEMPOTENCY_KEY_REQUIRED',
  'TENANT_MISMATCH'
], 'enterprise_delivery error code')

includesAll(deliveryStatus, [
  'draft',
  'preparing',
  'submitted',
  'reviewing',
  'approved',
  'rejected',
  'customer_confirmed',
  'completed',
  'cancelled',
  'canTransitionDelivery'
], 'delivery status machine')

includesAll(permissionCatalog, ['delivery.view', 'delivery.manage', 'delivery.approve'], 'delivery permission catalog')
includesAll(deliveryService, ['callEnterpriseDelivery', 'createDeliveryFromOrder', 'transitionDelivery', 'getDeliveryDashboard'], 'delivery service')
includesAll(ordersPage, ['createDeliveryFromOrder', 'viewDelivery', 'createDelivery'], 'orders page delivery linkage')
includesAll(orderDetailPage, ['createDeliveryFromOrder', 'listDeliveries', 'openDelivery'], 'order detail delivery linkage')
includesAll(deliveriesPage, ['getDeliveryDashboard', 'listDeliveries'], 'deliveries page cloud data')
includesAll(deliveryDetailPage, ['expectedVersion', 'idempotencyKey', 'transitionDelivery'], 'delivery detail transitions')

;[ordersPage, orderDetailPage, deliveriesPage, deliveryDetailPage].forEach((source, index) => {
  assert(!source.includes('enterpriseId:'), `page ${index} must not assemble enterpriseId`)
})

const logLines = cloudFunction.split(/\r?\n/).filter((line) => line.includes('console.'))
const unsafeLogPattern = /(sessionToken|OPENID|openid|UNIONID|accessToken|Secret|confirmToken|token|phone|email|fileUrl|previewUrl)/i
const unsafeLog = logLines.find((line) => unsafeLogPattern.test(line))
assert(!unsafeLog, `unsafe log field found: ${unsafeLog || ''}`)

console.log('[enterprise-delivery-smoke] passed')
