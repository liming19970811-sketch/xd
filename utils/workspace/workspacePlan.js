const WORKSPACE_PLAN_TEMPLATES = Object.freeze({
  'product-images': Object.freeze({
    title: '商品视觉生产方案',
    actions: Object.freeze([
      Object.freeze({ action: 'model_replace', label: '模特展示图', workspaceType: 'model', estimatedCost: 5, outputCount: 1 }),
      Object.freeze({ action: 'scene_replace', label: '场景图', workspaceType: 'scene', estimatedCost: 2, outputCount: 1 }),
      Object.freeze({ action: 'detail_asset', label: '详情页素材', workspaceType: 'ecommerce', estimatedCost: 6, outputCount: 3 })
    ])
  }),
  'new-design': Object.freeze({
    title: '新款开发方案',
    actions: Object.freeze([
      Object.freeze({ action: 'color_replace', label: '颜色方案', workspaceType: 'color', estimatedCost: 9, outputCount: 3 }),
      Object.freeze({ action: 'pattern_replace', label: '图案方案', workspaceType: 'pattern', estimatedCost: 16, outputCount: 2 }),
      Object.freeze({ action: 'design_template', label: '设计方案', workspaceType: 'refine', estimatedCost: 8, outputCount: 1 })
    ])
  }),
  'brand-marketing': Object.freeze({
    title: '品牌营销生产方案',
    actions: Object.freeze([
      Object.freeze({ action: 'scene_replace', label: '营销场景', workspaceType: 'scene', estimatedCost: 4, outputCount: 2 }),
      Object.freeze({ action: 'batch_generate', label: '批量素材', workspaceType: 'batch', estimatedCost: 30, outputCount: 6 })
    ])
  })
})

function cloneActions(actions = []) {
  return actions.map((item) => ({ ...item }))
}

export function getWorkspacePlanTemplate(guideId = '') {
  const template = WORKSPACE_PLAN_TEMPLATES[guideId]
  if (!template) return null
  return {
    title: template.title,
    actions: cloneActions(template.actions)
  }
}

export function createWorkspacePlan(input = {}) {
  const recommendation = input.recommendation || {}
  const guideId = String(input.guideId || recommendation.guideId || '')
  const template = getWorkspacePlanTemplate(guideId)
  if (!template) return null
  const category = String(input.category || recommendation.inputType || '女装')
  const selectedAction = input.selectedAction || {}
  const actions = cloneActions(template.actions)
  return {
    planId: `workspace_plan_${guideId}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    guideId,
    category,
    title: `${category} · ${template.title}`,
    actions,
    estimatedCost: actions.reduce((total, item) => total + item.estimatedCost, 0),
    outputCount: actions.reduce((total, item) => total + item.outputCount, 0),
    createdAt: new Date().toISOString(),
    entryType: selectedAction.workspaceType || actions[0].workspaceType,
    recommendationId: recommendation.recommendationId || ''
  }
}
