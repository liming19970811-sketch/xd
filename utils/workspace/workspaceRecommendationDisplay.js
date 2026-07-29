const GUIDE_SCENE_MAP = Object.freeze({
  'product-images': '商品主图、详情页素材、上新展示',
  'new-design': '新款配色、图案方案、改款验证',
  'brand-marketing': '活动视觉、内容种草、批量营销素材'
})

const GUIDE_EFFECT_MAP = Object.freeze({
  'product-images': '获得一组可直接进入商品图制作的视觉方案',
  'new-design': '快速验证颜色、图案和款式方向',
  'brand-marketing': '形成适合活动与内容投放的素材组合'
})

const FALLBACK_REASON_MAP = Object.freeze({
  'product-images': '适合首次制作商品展示图，路径清晰、产出稳定。',
  'new-design': '适合先验证设计方向，再进入细化制作。',
  'brand-marketing': '适合需要快速准备活动和内容素材的场景。'
})

function getPlanTotals(actions = []) {
  return actions.reduce((result, action) => ({
    outputCount: result.outputCount + Number(action.outputCount || 0),
    estimatedCost: result.estimatedCost + Number(action.estimatedCost || 0)
  }), { outputCount: 0, estimatedCost: 0 })
}

function getContextHint(context = {}, guideId = '') {
  const planId = context.planId || context.lastPlanId || ''
  if (planId && guideId && String(planId).includes(guideId)) return '延续最近创作方向'
  if (context.projectId || context.lastProjectId) return '结合当前项目上下文'
  return ''
}

export function buildWorkspaceRecommendationDisplays(input = {}) {
  const guides = Array.isArray(input.guides) ? input.guides : []
  const reasonMap = input.reasonMap || {}
  const context = input.context || {}
  return guides.slice(0, 3).map((guide) => {
    const reason = reasonMap[guide.guideId] || null
    const totals = getPlanTotals(guide.recommendedActions || [])
    const contextHint = getContextHint(context, guide.guideId)
    return {
      displayId: `workspace_recommend_display_${guide.guideId}`,
      guideId: guide.guideId,
      recommendationId: guide.recommendationId || `workspace_recommend_${guide.guideId}`,
      planName: guide.title || '智能推荐方案',
      reasonTitle: reason ? reason.title : (contextHint || '默认推荐'),
      reasonDescription: reason ? reason.description : FALLBACK_REASON_MAP[guide.guideId] || '根据当前工作台默认流程推荐。',
      scene: GUIDE_SCENE_MAP[guide.guideId] || guide.description || '服装 AI 创作场景',
      outputCount: totals.outputCount || 1,
      estimatedCost: totals.estimatedCost || 1,
      effect: GUIDE_EFFECT_MAP[guide.guideId] || '生成一组可继续制作的出图方案',
      primaryAction: (guide.recommendedActions || [])[0] || null,
      guide
    }
  })
}

export function buildWorkspacePlanDisplay(plan = {}, reason = null) {
  return {
    reasonTitle: reason ? reason.title : '基于当前目标推荐',
    reasonDescription: reason ? reason.description : '该方案覆盖当前目标所需的主要制作能力。',
    scene: GUIDE_SCENE_MAP[plan.guideId] || plan.category || '当前创作目标',
    effect: GUIDE_EFFECT_MAP[plan.guideId] || '完成后可继续进入参数设置和制作流程。'
  }
}
