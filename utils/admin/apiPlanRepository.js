export const API_PLAN_IDS = Object.freeze({
  BASIC: 'api_plan_basic_enterprise',
  PROFESSIONAL: 'api_plan_professional_enterprise',
  FLAGSHIP: 'api_plan_flagship_enterprise'
})

const API_PLANS = Object.freeze([
  Object.freeze({
    planId: API_PLAN_IDS.BASIC,
    name: '基础企业版',
    price: 999,
    apiQuota: 5000,
    permissions: Object.freeze(['image_generate', 'asset_access']),
    maxApps: 1,
    createdAt: '2026-07-19T00:00:00.000Z'
  }),
  Object.freeze({
    planId: API_PLAN_IDS.PROFESSIONAL,
    name: '专业企业版',
    price: 2999,
    apiQuota: 30000,
    permissions: Object.freeze(['image_generate', 'batch_generate', 'asset_access', 'project_access']),
    maxApps: 5,
    createdAt: '2026-07-19T00:00:00.000Z'
  }),
  Object.freeze({
    planId: API_PLAN_IDS.FLAGSHIP,
    name: '旗舰企业版',
    price: 9999,
    apiQuota: 150000,
    permissions: Object.freeze(['image_generate', 'batch_generate', 'asset_access', 'project_access']),
    maxApps: 20,
    createdAt: '2026-07-19T00:00:00.000Z'
  })
])

function clonePlan(plan = {}) {
  return {
    planId: plan.planId || '',
    name: plan.name || '',
    price: Math.max(0, Number(plan.price) || 0),
    apiQuota: Math.max(0, Number(plan.apiQuota) || 0),
    permissions: [...(plan.permissions || [])],
    maxApps: Math.max(1, Number(plan.maxApps) || 1),
    createdAt: plan.createdAt || new Date().toISOString()
  }
}

function logApiPlan(plan = {}) {
  console.log('[api:plan]', {
    planId: plan.planId || '',
    name: plan.name || ''
  })
}

export function getApiPlans() {
  return API_PLANS.map(clonePlan)
}

export function getApiPlanById(planId = '') {
  const plan = API_PLANS.find((item) => item.planId === planId) || API_PLANS[0]
  return clonePlan(plan)
}

export function selectApiPlan(planId = '') {
  const plan = getApiPlanById(planId)
  logApiPlan(plan)
  return plan
}
