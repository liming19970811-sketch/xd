import { MEMBERSHIP_PLAN_CONFIG, MEMBERSHIP_TIERS } from '../constants/membershipPlans'

const MEMBERSHIP_USAGE_KEY = 'membership_usage'
const LEGACY_MEMBERSHIP_USAGE_KEY = 'membership_usage_mock'

const PLAN_DEFINITIONS = Object.freeze([
  Object.freeze({
    planId: MEMBERSHIP_TIERS.FREE_TRIAL,
    name: '体验版',
    type: 'trial',
    monthlyPoints: Number(MEMBERSHIP_PLAN_CONFIG[MEMBERSHIP_TIERS.FREE_TRIAL].monthlyAiPoints || 0),
    price: 0,
    features: Object.freeze(['免费体验', '基础商品图生成', '作品中心保存']),
    suitableFor: '适合首次体验 AI 服装出图的用户',
    enabled: true
  }),
  Object.freeze({
    planId: MEMBERSHIP_TIERS.SELF_799,
    name: '基础版',
    type: 'basic',
    monthlyPoints: Number(MEMBERSHIP_PLAN_CONFIG[MEMBERSHIP_TIERS.SELF_799].monthlyAiPoints || 0),
    price: Number(MEMBERSHIP_PLAN_CONFIG[MEMBERSHIP_TIERS.SELF_799].price || 0),
    features: Object.freeze(['更多商品图生成', '更多素材制作', '作品高清下载']),
    suitableFor: '适合个人商家日常上新和素材补充',
    enabled: true
  }),
  Object.freeze({
    planId: MEMBERSHIP_TIERS.PRO_1699,
    name: '专业版',
    type: 'professional',
    monthlyPoints: Number(MEMBERSHIP_PLAN_CONFIG[MEMBERSHIP_TIERS.PRO_1699].monthlyAiPoints || 0),
    price: Number(MEMBERSHIP_PLAN_CONFIG[MEMBERSHIP_TIERS.PRO_1699].price || 0),
    features: Object.freeze(['高额度', '高清输出', '优先生成', '更多商业模板']),
    suitableFor: '适合稳定上新的品牌与电商团队',
    enabled: true
  }),
  Object.freeze({
    planId: MEMBERSHIP_TIERS.ENTERPRISE_5999,
    name: '企业版',
    type: 'enterprise',
    monthlyPoints: Number(MEMBERSHIP_PLAN_CONFIG[MEMBERSHIP_TIERS.ENTERPRISE_5999].monthlyAiPoints || 0),
    price: Number(MEMBERSHIP_PLAN_CONFIG[MEMBERSHIP_TIERS.ENTERPRISE_5999].price || 0),
    features: Object.freeze(['团队协作', '企业项目能力', '批量视觉生产', '人工服务入口']),
    suitableFor: '适合需要项目协作和批量生产的企业',
    enabled: true
  })
])

const PLAN_ALIASES = Object.freeze({
  [MEMBERSHIP_TIERS.PRO_PLUS_1999]: MEMBERSHIP_TIERS.PRO_1699,
  [MEMBERSHIP_TIERS.ENTERPRISE_7999]: MEMBERSHIP_TIERS.ENTERPRISE_5999,
  [MEMBERSHIP_TIERS.ENTERPRISE_YEAR_56800]: MEMBERSHIP_TIERS.ENTERPRISE_5999
})

function clonePlan(plan) {
  return {
    ...plan,
    features: [...plan.features]
  }
}

function resolvePlanId(input = '') {
  const value = input && typeof input === 'object'
    ? input.planId || input.currentTier || input.membershipTier || input.tier
    : input
  const planId = String(value || MEMBERSHIP_TIERS.FREE_TRIAL)
  return PLAN_ALIASES[planId] || planId
}

function readCurrentUsage() {
  if (typeof uni === 'undefined' || !uni || typeof uni.getStorageSync !== 'function') return {}
  try {
    return uni.getStorageSync(MEMBERSHIP_USAGE_KEY) || uni.getStorageSync(LEGACY_MEMBERSHIP_USAGE_KEY) || {}
  } catch (error) {
    return {}
  }
}

function isDevelopment() {
  try {
    return typeof process !== 'undefined' && ['development', 'dev'].includes(String(process.env && process.env.NODE_ENV || '').toLowerCase())
  } catch (error) {
    return false
  }
}

function logPlanAction(planId = '', success = false, errorCode = '') {
  if (!isDevelopment() || typeof console === 'undefined' || typeof console.info !== 'function') return
  console.info('[membership:plan]', { planId, success, errorCode })
}

export function getPlans() {
  return PLAN_DEFINITIONS.filter((plan) => plan.enabled).map(clonePlan)
}

export function getCurrentPlan(usageInput = null) {
  const planId = resolvePlanId(usageInput || readCurrentUsage())
  const plan = PLAN_DEFINITIONS.find((item) => item.planId === planId) || PLAN_DEFINITIONS[0]
  return clonePlan(plan)
}

export function getPlanComparison() {
  const plans = getPlans()
  return [
    {
      key: 'generation',
      label: 'AI 点数',
      summary: plans.map((plan) => `${plan.name} ${plan.monthlyPoints}点`).join(' · ')
    },
    {
      key: 'hd_output',
      label: '高清输出',
      summary: '专业版及以上支持更完整的高清输出权益'
    },
    {
      key: 'templates',
      label: '素材模板',
      summary: '基础版增加素材制作，专业版提供更多商业模板'
    },
    {
      key: 'enterprise',
      label: '企业能力',
      summary: '企业版支持团队协作和企业项目能力'
    }
  ]
}

export function upgradePlan(planId = '') {
  const normalizedPlanId = resolvePlanId(planId)
  const plan = PLAN_DEFINITIONS.find((item) => item.planId === normalizedPlanId && item.enabled)
  if (!plan) {
    const result = {
      ok: false,
      status: 'invalid_plan',
      planId: normalizedPlanId,
      errorCode: 'INVALID_PLAN',
      message: '该套餐暂不可用'
    }
    logPlanAction(normalizedPlanId, false, result.errorCode)
    return result
  }
  const result = {
    ok: false,
    status: 'coming_soon',
    planId: normalizedPlanId,
    errorCode: 'UPGRADE_NOT_AVAILABLE',
    message: '升级功能即将开放。'
  }
  logPlanAction(normalizedPlanId, false, result.errorCode)
  return result
}
