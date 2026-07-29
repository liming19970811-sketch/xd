import { get, set } from '../data-provider/dataProvider.js'
import { getCurrentEnterprise, getCurrentMember, getCurrentUser } from '../auth/authRepository.js'
import { getCurrentEnterpriseId } from '../tenant/tenantContext.js'
import { hasPermission } from '../auth/permissionService.js'
import { getBrandApiUsageRecords } from '../admin/apiUsageRepository.js'

const PLAN_CONFIG_KEY = 'diebians_membership_plan_configs_v1'
const QUOTA_RECORD_KEY = 'diebians_membership_quota_records_v1'
const ORDER_KEY = 'diebiandesign_commercial_orders'
const MEMBER_LIMIT_KEY = 'diebians_membership_member_limits_v1'

export const ACCOUNT_TYPES = Object.freeze([
  { key: 'trial', label: '体验会员' },
  { key: 'personal_pro', label: '个人专业版' },
  { key: 'enterprise', label: '企业版' },
  { key: 'enterprise_api', label: '企业 API 版' }
])

export const QUOTA_TYPES = Object.freeze([
  { key: 'ai_image', label: 'AI出图次数' },
  { key: 'ai_pattern', label: 'AI制版次数' },
  { key: 'manual_refine', label: '人工服务次数' },
  { key: 'api_call', label: 'API调用额度' },
  { key: 'gift', label: '赠送额度' }
])

export const ORDER_STATUSES = Object.freeze([
  { key: 'pending', label: '待处理' },
  { key: 'paid', label: '已支付' },
  { key: 'activated', label: '已激活' },
  { key: 'refunded', label: '已退款' },
  { key: 'closed', label: '已关闭' }
])

export const QUOTA_ACTION_TYPES = Object.freeze([
  { key: 'grant', label: '发放' },
  { key: 'pre_hold', label: '预扣' },
  { key: 'confirm_consume', label: '确认消费' },
  { key: 'rollback', label: '回滚' },
  { key: 'compensation', label: '补偿' },
  { key: 'expire', label: '到期' }
])

function nowIso() {
  return new Date().toISOString()
}

function currentEnterpriseId() {
  return String(getCurrentEnterpriseId() || getCurrentEnterprise().enterpriseId || 'default_enterprise')
}

function currentAccountId() {
  const member = getCurrentMember()
  return String(member.memberId || member.userId || getCurrentUser().userId || 'default_account')
}

function readArray(key) {
  const value = get(key, [])
  return Array.isArray(value) ? value : []
}

function writeArray(key, value = []) {
  set(key, Array.isArray(value) ? value : [])
}

function defaultPlans() {
  const createdAt = '2026-07-28T00:00:00.000Z'
  return [
    {
      planId: 'trial',
      accountType: 'trial',
      name: '体验会员',
      priceText: '免费体验，额度以后台配置为准',
      status: 'active',
      benefits: { aiImage: 0, aiPattern: 0, manualRefine: 0, batchLimit: 1, storageSpace: '按系统默认', memberLimit: 1, projectLimit: 1, apiQuota: 0, validDays: 7 },
      notes: ['用于体验基础流程', '不承诺人工精修或企业 API 权益'],
      createdAt,
      updatedAt: createdAt
    },
    {
      planId: 'personal_pro',
      accountType: 'personal_pro',
      name: '个人专业版',
      priceText: '联系开通',
      status: 'draft',
      benefits: { aiImage: 0, aiPattern: 0, manualRefine: 0, batchLimit: 0, storageSpace: '待配置', memberLimit: 1, projectLimit: 0, apiQuota: 0, validDays: 0 },
      notes: ['权益由后台配置后生效', '支付成功必须经服务端回调激活'],
      createdAt,
      updatedAt: createdAt
    },
    {
      planId: 'enterprise',
      accountType: 'enterprise',
      name: '企业版',
      priceText: '联系企业顾问',
      status: 'draft',
      benefits: { aiImage: 0, aiPattern: 0, manualRefine: 0, batchLimit: 0, storageSpace: '待配置', memberLimit: 0, projectLimit: 0, apiQuota: 0, validDays: 0 },
      notes: ['适合团队项目、审核交付和成员协作', '不展示无法兑现的固定价格'],
      createdAt,
      updatedAt: createdAt
    },
    {
      planId: 'enterprise_api',
      accountType: 'enterprise_api',
      name: '企业 API 版',
      priceText: '联系开通',
      status: 'draft',
      benefits: { aiImage: 0, aiPattern: 0, manualRefine: 0, batchLimit: 0, storageSpace: '待配置', memberLimit: 0, projectLimit: 0, apiQuota: 0, validDays: 0 },
      notes: ['仅开放稳定 API 能力', 'AI制版、模型训练和版型下载默认不开放'],
      createdAt,
      updatedAt: createdAt
    }
  ]
}

function normalizePlan(plan = {}) {
  const fallback = defaultPlans().find((item) => item.planId === plan.planId) || defaultPlans()[0]
  const benefits = plan.benefits && typeof plan.benefits === 'object' ? plan.benefits : {}
  return {
    ...fallback,
    ...plan,
    planId: String(plan.planId || fallback.planId),
    accountType: String(plan.accountType || fallback.accountType),
    name: String(plan.name || fallback.name),
    priceText: String(plan.priceText || fallback.priceText || '联系开通'),
    status: String(plan.status || fallback.status || 'draft'),
    benefits: {
      aiImage: Math.max(0, Number(benefits.aiImage ?? fallback.benefits.aiImage) || 0),
      aiPattern: Math.max(0, Number(benefits.aiPattern ?? fallback.benefits.aiPattern) || 0),
      manualRefine: Math.max(0, Number(benefits.manualRefine ?? fallback.benefits.manualRefine) || 0),
      batchLimit: Math.max(0, Number(benefits.batchLimit ?? fallback.benefits.batchLimit) || 0),
      storageSpace: String(benefits.storageSpace || fallback.benefits.storageSpace || '待配置'),
      memberLimit: Math.max(0, Number(benefits.memberLimit ?? fallback.benefits.memberLimit) || 0),
      projectLimit: Math.max(0, Number(benefits.projectLimit ?? fallback.benefits.projectLimit) || 0),
      apiQuota: Math.max(0, Number(benefits.apiQuota ?? fallback.benefits.apiQuota) || 0),
      validDays: Math.max(0, Number(benefits.validDays ?? fallback.benefits.validDays) || 0)
    },
    notes: Array.isArray(plan.notes) ? plan.notes.map(String) : fallback.notes,
    createdAt: plan.createdAt || fallback.createdAt || nowIso(),
    updatedAt: plan.updatedAt || plan.createdAt || fallback.updatedAt || nowIso()
  }
}

export function getMembershipPlans() {
  const stored = readArray(PLAN_CONFIG_KEY)
  if (!stored.length) {
    const plans = defaultPlans().map(normalizePlan)
    writeArray(PLAN_CONFIG_KEY, plans)
    return plans
  }
  const map = {}
  defaultPlans().forEach((plan) => { map[plan.planId] = normalizePlan(plan) })
  stored.forEach((plan) => { map[plan.planId] = normalizePlan({ ...map[plan.planId], ...plan }) })
  return Object.values(map)
}

export function saveMembershipPlan(input = {}) {
  const plans = getMembershipPlans()
  const plan = normalizePlan({ ...input, updatedAt: nowIso() })
  const index = plans.findIndex((item) => item.planId === plan.planId)
  if (index >= 0) plans.splice(index, 1, plan)
  else plans.push({ ...plan, createdAt: nowIso() })
  writeArray(PLAN_CONFIG_KEY, plans)
  console.log('[membership:plan]', { planId: plan.planId, name: plan.name, status: plan.status })
  return { success: true, plan }
}

function normalizeQuotaRecord(record = {}) {
  const amount = Number(record.amount ?? record.cost ?? record.costValue ?? 0) || 0
  return {
    recordId: String(record.recordId || record.usageId || record.logId || ''),
    accountId: String(record.accountId || record.memberId || record.userId || ''),
    enterpriseId: String(record.enterpriseId || record.companyId || ''),
    quotaType: String(record.quotaType || record.type || 'ai_image'),
    actionType: String(record.actionType || record.costActionType || record.action || 'confirm_consume'),
    amount,
    before: Number(record.before ?? record.beforeQuota ?? 0) || 0,
    after: Number(record.after ?? record.afterQuota ?? 0) || 0,
    taskId: String(record.taskId || record.sourceTaskId || ''),
    orderId: String(record.orderId || ''),
    idempotencyKey: String(record.idempotencyKey || record.requestId || ''),
    status: String(record.status || 'confirmed'),
    terminal: Boolean(record.terminal || ['confirmed', 'rolled_back', 'failed', 'expired'].includes(String(record.status || ''))),
    createdAt: record.createdAt || record.updatedAt || nowIso()
  }
}

function readExternalQuotaRecords() {
  const keys = ['membership_usage_records', 'quota_usage_records', 'ai_quota_records']
  return keys.flatMap((key) => {
    const value = get(key, [])
    if (Array.isArray(value)) return value
    if (value && Array.isArray(value.records)) return value.records
    return []
  })
}

function readApiUsageQuotaRecords() {
  return getBrandApiUsageRecords().map((item) => ({
    recordId: item.usageId,
    accountId: item.appId,
    enterpriseId: item.brandId,
    quotaType: 'api_call',
    actionType: 'confirm_consume',
    amount: item.cost,
    before: item.beforeQuota,
    after: item.afterQuota,
    taskId: '',
    orderId: '',
    idempotencyKey: item.auditId || item.usageId,
    status: item.status === 'failed' ? 'failed' : 'confirmed',
    terminal: true,
    createdAt: item.createdAt
  }))
}

export function getQuotaRecords() {
  const own = readArray(QUOTA_RECORD_KEY)
  const records = [...own, ...readExternalQuotaRecords(), ...readApiUsageQuotaRecords()]
    .map(normalizeQuotaRecord)
    .filter((item) => item.recordId)
  const map = {}
  records.forEach((item) => { map[item.recordId] = item })
  return Object.values(map).sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt)))
}

function getBalanceByType(records = getQuotaRecords()) {
  const balances = {}
  QUOTA_TYPES.forEach((type) => { balances[type.key] = { quotaType: type.key, label: type.label, total: 0, used: 0, remaining: 0, expiring: 0 } })
  records.forEach((record) => {
    const bucket = balances[record.quotaType] || (balances[record.quotaType] = { quotaType: record.quotaType, label: record.quotaType, total: 0, used: 0, remaining: 0, expiring: 0 })
    if (['grant', 'compensation'].includes(record.actionType)) bucket.total += Math.max(0, record.amount)
    if (['confirm_consume', 'pre_hold'].includes(record.actionType)) bucket.used += Math.abs(record.amount)
    if (record.actionType === 'rollback') bucket.used -= Math.abs(record.amount)
  })
  Object.values(balances).forEach((bucket) => {
    bucket.used = Math.max(0, bucket.used)
    bucket.remaining = Math.max(0, bucket.total - bucket.used)
  })
  return Object.values(balances)
}

export function createQuotaPreHold(input = {}) {
  const idempotencyKey = String(input.idempotencyKey || '')
  if (!idempotencyKey) return { success: false, errorCode: 'idempotency_required' }
  const records = readArray(QUOTA_RECORD_KEY).map(normalizeQuotaRecord)
  const existing = records.find((record) => record.idempotencyKey === idempotencyKey && record.actionType === 'pre_hold')
  if (existing) return { success: true, record: existing, idempotent: true }
  const balances = getBalanceByType(getQuotaRecords())
  const quotaType = String(input.quotaType || 'ai_image')
  const bucket = balances.find((item) => item.quotaType === quotaType)
  const amount = Math.max(1, Number(input.amount) || 1)
  if (!bucket || bucket.remaining < amount) return { success: false, errorCode: 'quota_not_enough' }
  const record = normalizeQuotaRecord({
    recordId: `quota_hold_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    accountId: currentAccountId(),
    enterpriseId: currentEnterpriseId(),
    quotaType,
    actionType: 'pre_hold',
    amount,
    before: bucket.remaining,
    after: bucket.remaining - amount,
    taskId: input.taskId || '',
    orderId: input.orderId || '',
    idempotencyKey,
    status: 'processing',
    terminal: false,
    createdAt: nowIso()
  })
  writeArray(QUOTA_RECORD_KEY, [record, ...records])
  return { success: true, record, idempotent: false }
}

export function finalizeQuotaRecord(recordId = '', status = 'success') {
  const records = readArray(QUOTA_RECORD_KEY).map(normalizeQuotaRecord)
  const index = records.findIndex((record) => record.recordId === recordId)
  if (index < 0) return { success: false, errorCode: 'record_not_found' }
  const current = records[index]
  if (current.terminal) return { success: false, errorCode: 'record_terminal' }
  const next = normalizeQuotaRecord({
    ...current,
    actionType: status === 'success' ? 'confirm_consume' : 'rollback',
    status: status === 'success' ? 'confirmed' : 'rolled_back',
    terminal: true,
    createdAt: current.createdAt
  })
  records.splice(index, 1, next)
  writeArray(QUOTA_RECORD_KEY, records)
  return { success: true, record: next }
}

function normalizeOrder(order = {}) {
  return {
    orderId: String(order.orderId || ''),
    accountId: String(order.accountId || order.userId || ''),
    enterpriseId: String(order.enterpriseId || order.companyId || ''),
    planId: String(order.planId || order.targetId || ''),
    orderType: String(order.orderType || order.targetType || 'membership'),
    productName: String(order.productName || order.name || '会员与额度订单'),
    status: String(order.status || 'pending'),
    amount: Number(order.amount || 0) || 0,
    createdAt: order.createdAt || nowIso(),
    updatedAt: order.updatedAt || order.createdAt || nowIso(),
    note: String(order.note || '')
  }
}

export function getMembershipOrders() {
  return readArray(ORDER_KEY)
    .map(normalizeOrder)
    .filter((order) => order.orderId)
    .sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt)))
}

export function createContactOrder(planId = '') {
  const plans = getMembershipPlans()
  const plan = plans.find((item) => item.planId === planId)
  if (!plan) return { success: false, errorCode: 'plan_not_found' }
  const orders = readArray(ORDER_KEY).map(normalizeOrder)
  const existing = orders.find((order) => order.planId === planId && order.status === 'pending' && order.accountId === currentAccountId())
  if (existing) return { success: true, order: existing, idempotent: true }
  const order = normalizeOrder({
    orderId: `membership_order_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    accountId: currentAccountId(),
    enterpriseId: currentEnterpriseId(),
    planId,
    orderType: 'membership',
    productName: plan.name,
    status: 'pending',
    amount: 0,
    note: '未接入真实支付，需人工联系开通；权益激活必须等待服务端回调。',
    createdAt: nowIso(),
    updatedAt: nowIso()
  })
  writeArray(ORDER_KEY, [order, ...orders])
  return { success: true, order, idempotent: false }
}

export function saveMemberQuotaLimit(memberId = '', limit = {}) {
  const enterpriseId = currentEnterpriseId()
  const all = get(MEMBER_LIMIT_KEY, {})
  const scoped = all[enterpriseId] && typeof all[enterpriseId] === 'object' ? all[enterpriseId] : {}
  scoped[memberId] = {
    memberId,
    aiImageLimit: Math.max(0, Number(limit.aiImageLimit) || 0),
    apiCallLimit: Math.max(0, Number(limit.apiCallLimit) || 0),
    updatedAt: nowIso()
  }
  all[enterpriseId] = scoped
  set(MEMBER_LIMIT_KEY, all)
  return { success: true, limit: scoped[memberId] }
}

function getMemberLimits() {
  const all = get(MEMBER_LIMIT_KEY, {})
  const scoped = all && all[currentEnterpriseId()] ? all[currentEnterpriseId()] : {}
  return Object.values(scoped || {})
}

export function loadMembershipCenter() {
  const user = getCurrentUser()
  const enterprise = getCurrentEnterprise()
  const member = getCurrentMember()
  const plans = getMembershipPlans()
  const planId = String(enterprise.planId || member.planId || user.planId || 'trial')
  const currentPlan = plans.find((item) => item.planId === planId) || plans[0]
  const records = getQuotaRecords()
  const orders = getMembershipOrders()
  const balanceByType = getBalanceByType(records)
  const canManageEnterpriseQuota = hasPermission('member.manage', { member }) || hasPermission('settings.manage', { member })
  return {
    user,
    enterprise,
    member,
    account: {
      accountId: currentAccountId(),
      accountType: currentPlan.accountType,
      accountTypeLabel: (ACCOUNT_TYPES.find((item) => item.key === currentPlan.accountType) || ACCOUNT_TYPES[0]).label,
      planId: currentPlan.planId,
      planName: currentPlan.name,
      expiresAt: enterprise.planExpiresAt || user.planExpiresAt || '',
      paymentStatus: 'contact_required'
    },
    currentPlan,
    plans,
    quotaAccounts: balanceByType,
    records,
    orders,
    enterpriseUsage: {
      canManage: canManageEnterpriseQuota,
      memberLimits: getMemberLimits(),
      abnormalRecords: records.filter((record) => ['failed', 'rollback_candidate'].includes(record.status) || record.actionType === 'rollback')
    },
    notices: [
      '权益判断、预扣、确认消费和回滚必须由服务端执行；本页只读取和展示统一记录。',
      '当前未接入真实支付，订单不会因为前端操作变为已支付或已激活。',
      '套餐到期不会删除历史项目、作品和版型，只会限制超出免费范围的继续使用。'
    ],
    updatedAt: nowIso()
  }
}

export function getOrderStatusLabel(status = '') {
  const item = ORDER_STATUSES.find((option) => option.key === status)
  return item ? item.label : status || '待处理'
}

export function getQuotaActionLabel(actionType = '') {
  const item = QUOTA_ACTION_TYPES.find((option) => option.key === actionType)
  return item ? item.label : actionType || '记录'
}
