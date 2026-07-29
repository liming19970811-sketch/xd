export const MEMBER_PLAN_IDS = Object.freeze({
  EXPERIENCE: 'experience',
  PROFESSIONAL: 'professional',
  ENTERPRISE: 'enterprise'
})

export const MEMBER_PLANS = Object.freeze([
  Object.freeze({
    planId: MEMBER_PLAN_IDS.EXPERIENCE,
    name: '体验版',
    price: 0,
    points: 20,
    features: Object.freeze(['免费积分', '基础生成']),
    batchLimit: 1,
    modelLibrary: '基础模特库',
    commercialUse: false
  }),
  Object.freeze({
    planId: MEMBER_PLAN_IDS.PROFESSIONAL,
    name: '专业版',
    price: 1699,
    points: 1200,
    features: Object.freeze(['更多积分', '批量生成', '高级模特']),
    batchLimit: 30,
    modelLibrary: '高级模特库',
    commercialUse: true
  }),
  Object.freeze({
    planId: MEMBER_PLAN_IDS.ENTERPRISE,
    name: '企业版',
    price: 5999,
    points: 4000,
    features: Object.freeze(['企业模特库', 'API能力', '私有化支持']),
    batchLimit: 100,
    modelLibrary: '企业专属模特库',
    commercialUse: true
  })
])

const MEMBERSHIP_TIER_PLAN_MAP = Object.freeze({
  free_trial: MEMBER_PLAN_IDS.EXPERIENCE,
  self_799: MEMBER_PLAN_IDS.PROFESSIONAL,
  pro_1699: MEMBER_PLAN_IDS.PROFESSIONAL,
  pro_plus_1999: MEMBER_PLAN_IDS.PROFESSIONAL,
  enterprise_5999: MEMBER_PLAN_IDS.ENTERPRISE,
  enterprise_7999: MEMBER_PLAN_IDS.ENTERPRISE,
  enterprise_year_56800: MEMBER_PLAN_IDS.ENTERPRISE
})

export function getMemberPlans() {
  return MEMBER_PLANS.map((plan) => ({
    ...plan,
    features: [...plan.features]
  }))
}

export function getMemberPlanById(planId = MEMBER_PLAN_IDS.EXPERIENCE) {
  return MEMBER_PLANS.find((plan) => plan.planId === planId) || MEMBER_PLANS[0]
}

export function getMemberPlanByTier(membershipTier = '') {
  const planId = MEMBERSHIP_TIER_PLAN_MAP[membershipTier] || MEMBER_PLAN_IDS.EXPERIENCE
  return getMemberPlanById(planId)
}
