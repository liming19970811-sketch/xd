import assert from 'node:assert/strict'

const storage = new Map()
globalThis.uni = {
  getStorageSync(key) { return storage.get(key) },
  setStorageSync(key, value) { storage.set(key, value) },
  removeStorageSync(key) { storage.delete(key) }
}

const auth = await import('../utils/auth/authRepository.js')
const factoryRepository = await import('../utils/repository/factoryRepository.js')
const service = await import('../utils/service/factoryService.js')

function setAdmin(enterpriseId, userId) {
  auth.setCurrentContext({
    currentUser: { userId, name: `管理员-${userId}` },
    currentEnterprise: { enterpriseId, enterpriseName: enterpriseId },
    currentMember: { memberId: `member_${userId}`, enterpriseId, userId, role: 'admin', status: 'active' },
    currentRole: 'admin',
    authSource: 'local_mock'
  })
}

setAdmin('factory_smoke_enterprise_a', 'factory_smoke_admin_a')

const created = service.createFactory({
  name: '快反测试工厂',
  shortName: '测试工厂',
  region: '广东广州',
  capabilities: ['小单快反', '针织'],
  minimumOrderQuantity: 30,
  monthlyCapacity: 5000,
  leadTimeRange: { minDays: 7, maxDays: 15 },
  verificationStatus: 'pending'
})
assert.equal(created.success, true)
const factoryId = created.data.factory.factoryId

assert.equal(service.addFactoryMember(factoryId, {
  userId: 'factory_smoke_worker',
  name: '测试跟单员',
  role: 'factory_merchandiser',
  status: 'active'
}).success, true)

const blockedInvite = service.inviteFactoryQuote({ factoryId, projectId: 'project_smoke_a' })
assert.equal(blockedInvite.errorCode, 'factory_not_verified')
assert.equal(service.setFactoryVerification(factoryId, 'verified').success, true)

const invitation = service.inviteFactoryQuote({
  factoryId,
  projectId: 'project_smoke_a',
  inquiryTitle: '春季针织小单询价',
  requestedDeliveryAt: '2026-08-30',
  items: [{ name: '针织上衣', quantity: 100, material: '棉针织', process: '印花' }]
})
assert.equal(invitation.success, true)
const quoteId = invitation.data.quote.quoteId

const submitted = service.submitFactoryQuote(quoteId, {
  amount: 8800,
  leadTimeDays: 12,
  estimatedDeliveryAt: '2026-08-25',
  factoryComment: '确认面辅料后排产'
})
assert.equal(submitted.success, true)

const accepted = service.acceptFactoryQuote(quoteId)
assert.equal(accepted.success, true)
const productionOrderId = accepted.data.productionOrder.productionOrderId
const repeatedAccept = service.acceptFactoryQuote(quoteId)
assert.equal(repeatedAccept.success, true)
assert.equal(repeatedAccept.data.productionOrder.productionOrderId, productionOrderId)

assert.equal(service.transitionProductionOrder(productionOrderId, 'confirmed').success, true)
assert.equal(service.transitionProductionOrder(productionOrderId, 'in_production').success, true)
assert.equal(service.submitLeadTimeFeedback(productionOrderId, {
  estimatedDeliveryAt: '2026-08-27',
  risk: 'medium',
  content: '面料到仓晚一天'
}).success, true)
assert.equal(service.transitionProductionOrder(productionOrderId, 'quality_check').success, true)
assert.equal(service.recordQualityResult(productionOrderId, 'passed').success, true)

const anomalyResult = service.recordProductionAnomaly(productionOrderId, {
  level: 'medium',
  content: '首件车线需要调整'
})
assert.equal(anomalyResult.success, true)
assert.equal(service.getFactoryPerformance(factoryId).openAnomalyCount, 1)
assert.equal(service.resolveProductionAnomaly(productionOrderId, anomalyResult.data.anomaly.anomalyId).success, true)
assert.equal(service.getFactoryPerformance(factoryId).openAnomalyCount, 0)

assert.equal(service.transitionProductionOrder(productionOrderId, 'ready_to_ship').success, true)
assert.equal(service.transitionProductionOrder(productionOrderId, 'shipped').success, true)
assert.equal(service.transitionProductionOrder(productionOrderId, 'completed').success, true)
assert.equal(service.getFactoryPerformance(factoryId).completedOrderCount, 1)

const workerInvitation = service.inviteFactoryQuote({
  factoryId,
  projectId: 'project_smoke_worker',
  inquiryTitle: '工厂成员报价权限测试',
  items: [{ name: '测试款', quantity: 20 }]
})
assert.equal(workerInvitation.success, true)

auth.setCurrentContext({
  currentUser: { userId: 'factory_smoke_worker', name: '测试跟单员' },
  currentEnterprise: { enterpriseId: 'factory_smoke_enterprise_a', enterpriseName: 'factory_smoke_enterprise_a' },
  currentMember: { memberId: 'enterprise_member_worker', enterpriseId: 'factory_smoke_enterprise_a', userId: 'factory_smoke_worker', role: 'viewer', status: 'active' },
  currentRole: 'viewer',
  authSource: 'local_mock'
})
assert.equal(service.listFactories().length, 1)
assert.equal(service.submitFactoryQuote(workerInvitation.data.quote.quoteId, { amount: 1200, leadTimeDays: 5 }).success, true)
assert.equal(service.acceptFactoryQuote(workerInvitation.data.quote.quoteId).errorCode, 'permission_denied')

setAdmin('factory_smoke_enterprise_a', 'factory_smoke_admin_a')
const workerMember = factoryRepository.getById(factoryId).members.find((item) => item.userId === 'factory_smoke_worker')
assert.equal(service.updateFactoryMember(factoryId, workerMember.memberId, { status: 'disabled' }).success, true)
auth.setCurrentContext({
  currentUser: { userId: 'factory_smoke_worker', name: '测试跟单员' },
  currentEnterprise: { enterpriseId: 'factory_smoke_enterprise_a', enterpriseName: 'factory_smoke_enterprise_a' },
  currentMember: { memberId: 'enterprise_member_worker', enterpriseId: 'factory_smoke_enterprise_a', userId: 'factory_smoke_worker', role: 'viewer', status: 'active' },
  currentRole: 'viewer',
  authSource: 'local_mock'
})
assert.equal(service.listFactories().length, 0)

setAdmin('factory_smoke_enterprise_b', 'factory_smoke_admin_b')
assert.equal(factoryRepository.getList().length, 0)
assert.equal(service.getFactoryQuotes().length, 0)
assert.equal(service.getProductionOrders().length, 0)

console.log('FACTORY_COLLABORATION_SMOKE_OK')
