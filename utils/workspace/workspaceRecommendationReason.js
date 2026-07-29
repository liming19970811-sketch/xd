import { getWorkspacePlanTemplate } from './workspacePlan'

const VALID_REASON_TYPES = Object.freeze([
  'history',
  'success_rate',
  'project',
  'brand',
  'season'
])

function createStableId(value = '') {
  let hash = 2166136261
  const text = String(value || '')
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(36)
}

function createReason(recommendationId, reasonType, title, description) {
  const normalizedType = VALID_REASON_TYPES.includes(reasonType) ? reasonType : 'history'
  return {
    reasonId: `workspace_reason_${createStableId(`${recommendationId}:${normalizedType}:${description}`)}`,
    recommendationId: String(recommendationId || ''),
    reasonType: normalizedType,
    title: String(title || ''),
    description: String(description || ''),
    createdAt: new Date().toISOString()
  }
}

function resolveGuideId(value = '', guideId = '') {
  return guideId && String(value || '').includes(guideId) ? guideId : ''
}

function getSeasonLabel(date = new Date()) {
  const month = date.getMonth() + 1
  if (month >= 3 && month <= 5) return '春季'
  if (month >= 6 && month <= 8) return '夏季'
  if (month >= 9 && month <= 11) return '秋季'
  return '冬季'
}

export function createWorkspaceRecommendationReasons(input = {}) {
  const recommendation = input.recommendation || {}
  const recommendationId = recommendation.recommendationId || recommendation.guideId || ''
  const guideId = recommendation.guideId || ''
  const learningRecords = Array.isArray(input.learningRecords) ? input.learningRecords : []
  const analytics = input.analytics || {}
  const context = input.context || {}
  const projectScope = input.projectScope || {}
  const category = String(input.category || recommendation.inputType || '服装')
  const now = input.now instanceof Date ? input.now : new Date(input.now || Date.now())
  const reasons = []
  const planLearning = learningRecords.find((record) => (
    record.sourceType === 'plan' && record.sourceId === guideId
  ))

  if (planLearning && planLearning.usageCount > 0) {
    reasons.push(createReason(
      recommendationId,
      'history',
      '基于你的常用方案',
      `你最近 ${planLearning.usageCount} 次使用该方案`
    ))
  }

  const successRate = planLearning && planLearning.successRate > 0
    ? planLearning.successRate
    : Number(analytics.successRate) || 0
  if (successRate > 0) {
    reasons.push(createReason(
      recommendationId,
      'success_rate',
      '历史效果稳定',
      `该方案历史成功率 ${successRate}%`
    ))
  }

  const contextPlanId = context.planId || context.lastPlanId || ''
  const projectId = projectScope.projectId || context.projectId || context.lastProjectId || ''
  if (projectId || resolveGuideId(contextPlanId, guideId)) {
    reasons.push(createReason(
      recommendationId,
      'project',
      projectId ? '适合当前项目' : '延续最近创作',
      projectId ? '该方案与当前项目的生产方向匹配' : '该方案与最近一次创作方向一致'
    ))
  }

  const brandId = projectScope.brandId || context.brandId || context.lastBrandId || ''
  if (guideId === 'brand-marketing' && brandId) {
    reasons.push(createReason(
      recommendationId,
      'brand',
      '适合品牌资产沉淀',
      '可继续复用当前品牌的场景与营销素材方向'
    ))
  }

  const planTemplate = getWorkspacePlanTemplate(guideId)
  const planActionCount = planTemplate && Array.isArray(planTemplate.actions) ? planTemplate.actions.length : 0
  reasons.push(createReason(
    recommendationId,
    'season',
    `${getSeasonLabel(now)}上新建议`,
    `${category}可优先使用该方案${planActionCount ? `，一次覆盖 ${planActionCount} 项生产能力` : ''}`
  ))

  return reasons
}

export function getPrimaryWorkspaceRecommendationReason(input = {}) {
  return createWorkspaceRecommendationReasons(input)[0] || null
}

export function logWorkspaceRecommendationReason(reason = {}) {
  if (!reason.reasonId) return
  console.log('[workspace:recommend-reason]', {
    reasonId: reason.reasonId
  })
}
