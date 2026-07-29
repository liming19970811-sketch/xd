import { MEMBER_PLAN_IDS, getMemberPlanByTier } from './memberPlan'

export const MEMBER_CAPABILITY_KEYS = Object.freeze({
  BASIC_GENERATE: 'basic_generate',
  BATCH_GENERATE: 'batch_generate',
  ADVANCED_MODEL: 'advanced_model',
  COMMERCIAL_USE: 'commercial_use',
  API_ACCESS: 'api_access',
  PRIVATE_SERVICE: 'private_service'
})

export const MEMBER_CAPABILITY_LABELS = Object.freeze({
  [MEMBER_CAPABILITY_KEYS.BASIC_GENERATE]: '基础出图',
  [MEMBER_CAPABILITY_KEYS.BATCH_GENERATE]: '批量生成',
  [MEMBER_CAPABILITY_KEYS.ADVANCED_MODEL]: '高级模特库',
  [MEMBER_CAPABILITY_KEYS.COMMERCIAL_USE]: '商用授权',
  [MEMBER_CAPABILITY_KEYS.API_ACCESS]: 'API 能力',
  [MEMBER_CAPABILITY_KEYS.PRIVATE_SERVICE]: '企业专属服务'
})

export const MEMBER_LIMIT_LABELS = Object.freeze({
  dailyGenerate: '每日生成',
  batchMax: '单次批量',
  modelCount: '可用模特',
  assetStorage: '资产存储'
})

const MEMBER_CAPABILITY_MAP = Object.freeze({
  [MEMBER_PLAN_IDS.EXPERIENCE]: Object.freeze({
    memberLevel: MEMBER_PLAN_IDS.EXPERIENCE,
    capabilities: Object.freeze([
      MEMBER_CAPABILITY_KEYS.BASIC_GENERATE
    ]),
    limits: Object.freeze({
      dailyGenerate: 5,
      batchMax: 1,
      modelCount: 6,
      assetStorage: 100
    })
  }),
  [MEMBER_PLAN_IDS.PROFESSIONAL]: Object.freeze({
    memberLevel: MEMBER_PLAN_IDS.PROFESSIONAL,
    capabilities: Object.freeze([
      MEMBER_CAPABILITY_KEYS.BASIC_GENERATE,
      MEMBER_CAPABILITY_KEYS.BATCH_GENERATE,
      MEMBER_CAPABILITY_KEYS.ADVANCED_MODEL,
      MEMBER_CAPABILITY_KEYS.COMMERCIAL_USE
    ]),
    limits: Object.freeze({
      dailyGenerate: 100,
      batchMax: 30,
      modelCount: 30,
      assetStorage: 2000
    })
  }),
  [MEMBER_PLAN_IDS.ENTERPRISE]: Object.freeze({
    memberLevel: MEMBER_PLAN_IDS.ENTERPRISE,
    capabilities: Object.freeze([
      MEMBER_CAPABILITY_KEYS.BASIC_GENERATE,
      MEMBER_CAPABILITY_KEYS.BATCH_GENERATE,
      MEMBER_CAPABILITY_KEYS.ADVANCED_MODEL,
      MEMBER_CAPABILITY_KEYS.COMMERCIAL_USE,
      MEMBER_CAPABILITY_KEYS.API_ACCESS,
      MEMBER_CAPABILITY_KEYS.PRIVATE_SERVICE
    ]),
    limits: Object.freeze({
      dailyGenerate: 1000,
      batchMax: 100,
      modelCount: 100,
      assetStorage: 10000
    })
  })
})

const CAPABILITY_LIMIT_MAP = Object.freeze({
  [MEMBER_CAPABILITY_KEYS.BASIC_GENERATE]: 'dailyGenerate',
  [MEMBER_CAPABILITY_KEYS.BATCH_GENERATE]: 'batchMax',
  [MEMBER_CAPABILITY_KEYS.ADVANCED_MODEL]: 'modelCount'
})

function normalizeMemberLevel(user = {}) {
  const memberLevel = String(user.memberLevel || user.planId || user.membershipTier || '').trim()
  if (MEMBER_CAPABILITY_MAP[memberLevel]) return memberLevel
  return getMemberPlanByTier(memberLevel).planId
}

function getCapabilityCurrent(user = {}, limitType = '') {
  const usage = user.capabilityUsage && typeof user.capabilityUsage === 'object' ? user.capabilityUsage : {}
  const currentMap = {
    dailyGenerate: user.dailyGenerateUsed ?? usage.dailyGenerate ?? 0,
    batchMax: user.batchCount ?? user.requestedBatchCount ?? usage.batchMax ?? 0,
    modelCount: user.modelCount ?? user.requestedModelCount ?? usage.modelCount ?? 0
  }
  return Math.max(0, Number(currentMap[limitType]) || 0)
}

export function getMemberCapability(memberLevel = MEMBER_PLAN_IDS.EXPERIENCE) {
  const capability = MEMBER_CAPABILITY_MAP[memberLevel] || MEMBER_CAPABILITY_MAP[MEMBER_PLAN_IDS.EXPERIENCE]
  const result = {
    memberLevel: capability.memberLevel,
    capabilities: [...capability.capabilities],
    limits: { ...capability.limits }
  }
  console.log('[member:capability]', {
    memberLevel: result.memberLevel,
    capabilities: result.capabilities
  })
  return result
}

export function getMemberCapabilityLabel(capability = '') {
  return MEMBER_CAPABILITY_LABELS[capability] || capability
}

export function getMemberLimitLabel(limit = '') {
  return MEMBER_LIMIT_LABELS[limit] || limit
}

export function hasMemberCapability(memberLevel, capability) {
  const memberCapability = MEMBER_CAPABILITY_MAP[memberLevel] || MEMBER_CAPABILITY_MAP[MEMBER_PLAN_IDS.EXPERIENCE]
  return memberCapability.capabilities.includes(capability)
}

export function checkCapability(user = {}, capability = '') {
  const memberLevel = normalizeMemberLevel(user)
  const memberCapability = MEMBER_CAPABILITY_MAP[memberLevel] || MEMBER_CAPABILITY_MAP[MEMBER_PLAN_IDS.EXPERIENCE]
  const limitType = CAPABILITY_LIMIT_MAP[capability] || null
  const current = limitType ? getCapabilityCurrent(user, limitType) : null
  const max = limitType ? Number(memberCapability.limits[limitType]) : null
  const hasCapability = memberCapability.capabilities.includes(capability)
  const exceedsLimit = hasCapability && limitType === 'dailyGenerate'
    ? current >= max
    : hasCapability && limitType && current > max
  const allowed = Boolean(hasCapability && !exceedsLimit)
  let reason = ''

  if (!hasCapability) {
    reason = `当前套餐未开放${getMemberCapabilityLabel(capability)}，请升级会员`
  } else if (exceedsLimit) {
    reason = `${getMemberLimitLabel(limitType)}已达上限（${current}/${max}）`
  }

  const result = {
    allowed,
    reason,
    capability,
    limitType,
    current,
    max
  }
  console.log('[member:guard]', {
    memberLevel,
    capability,
    allowed
  })
  return result
}
