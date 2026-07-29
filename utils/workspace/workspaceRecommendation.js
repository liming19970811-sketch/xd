export const WORKSPACE_RECOMMENDATION_INPUT_TYPES = Object.freeze([
  '女装',
  '男装',
  '童装',
  '针织',
  '牛仔'
])

export const WORKSPACE_GUIDES = Object.freeze([
  Object.freeze({
    guideId: 'product-images',
    index: '01',
    title: '我要制作商品图',
    description: '快速补齐上架和详情页需要的商品视觉。'
  }),
  Object.freeze({
    guideId: 'new-design',
    index: '02',
    title: '我要开发新款',
    description: '围绕颜色、图案和款式方向快速验证方案。'
  }),
  Object.freeze({
    guideId: 'brand-marketing',
    index: '03',
    title: '我要做品牌营销',
    description: '生成适合内容传播、活动和批量上新的视觉资产。'
  })
])

const GUIDE_ACTIONS = Object.freeze({
  'product-images': Object.freeze([
    Object.freeze({ action: 'model_replace', label: '模特展示图', workspaceType: 'model' }),
    Object.freeze({ action: 'scene_replace', label: '商品场景图', workspaceType: 'scene' }),
    Object.freeze({ action: 'detail_asset', label: '详情页素材', workspaceType: 'ecommerce' })
  ]),
  'new-design': Object.freeze([
    Object.freeze({ action: 'color_replace', label: '换颜色', workspaceType: 'color' }),
    Object.freeze({ action: 'pattern_replace', label: '换图案', workspaceType: 'pattern' }),
    Object.freeze({ action: 'design_template', label: '设计方案', workspaceType: 'refine' })
  ]),
  'brand-marketing': Object.freeze([
    Object.freeze({ action: 'scene_replace', label: '换场景', workspaceType: 'scene' }),
    Object.freeze({ action: 'batch_generate', label: '批量生成', workspaceType: 'batch' }),
    Object.freeze({ action: 'marketing_asset', label: '营销素材', workspaceType: 'social' })
  ])
})

const CATEGORY_ACTION_PRIORITY = Object.freeze({
  女装: Object.freeze({
    'product-images': ['model_replace', 'scene_replace', 'detail_asset'],
    'new-design': ['color_replace', 'pattern_replace', 'design_template'],
    'brand-marketing': ['marketing_asset', 'scene_replace', 'batch_generate']
  }),
  男装: Object.freeze({
    'product-images': ['model_replace', 'detail_asset', 'scene_replace'],
    'new-design': ['design_template', 'color_replace', 'pattern_replace'],
    'brand-marketing': ['scene_replace', 'marketing_asset', 'batch_generate']
  }),
  童装: Object.freeze({
    'product-images': ['scene_replace', 'model_replace', 'detail_asset'],
    'new-design': ['pattern_replace', 'color_replace', 'design_template'],
    'brand-marketing': ['marketing_asset', 'scene_replace', 'batch_generate']
  }),
  针织: Object.freeze({
    'product-images': ['detail_asset', 'model_replace', 'scene_replace'],
    'new-design': ['color_replace', 'design_template', 'pattern_replace'],
    'brand-marketing': ['batch_generate', 'scene_replace', 'marketing_asset']
  }),
  牛仔: Object.freeze({
    'product-images': ['scene_replace', 'model_replace', 'detail_asset'],
    'new-design': ['design_template', 'color_replace', 'pattern_replace'],
    'brand-marketing': ['scene_replace', 'marketing_asset', 'batch_generate']
  })
})

const INPUT_TYPE_IDS = Object.freeze({
  女装: 'womenswear',
  男装: 'menswear',
  童装: 'kidswear',
  针织: 'knitwear',
  牛仔: 'denim'
})

function normalizeInputType(inputType = '') {
  return WORKSPACE_RECOMMENDATION_INPUT_TYPES.includes(inputType) ? inputType : '女装'
}

function getRecommendedActions(guideId = '', inputType = '女装') {
  const actions = GUIDE_ACTIONS[guideId] || []
  const priority = CATEGORY_ACTION_PRIORITY[inputType][guideId] || actions.map((item) => item.action)
  return priority.map((action, index) => {
    const matched = actions.find((item) => item.action === action)
    return {
      ...matched,
      priority: index === 0,
      categoryHint: index === 0 ? `${inputType}优先` : '标准推荐'
    }
  }).filter((item) => item.action)
}

export function getWorkspaceRecommendationInputTypes() {
  return [...WORKSPACE_RECOMMENDATION_INPUT_TYPES]
}

export function getWorkspaceRecommendation(guideId = '', inputType = '女装') {
  const guide = WORKSPACE_GUIDES.find((item) => item.guideId === guideId)
  if (!guide) return null
  const normalizedInputType = normalizeInputType(inputType)
  return {
    recommendationId: `workspace_recommend_${guideId}_${INPUT_TYPE_IDS[normalizedInputType]}`,
    guideId,
    inputType: normalizedInputType,
    matchRules: {
      supportedInputTypes: [...WORKSPACE_RECOMMENDATION_INPUT_TYPES],
      matchedInputType: normalizedInputType,
      priorityActions: [...CATEGORY_ACTION_PRIORITY[normalizedInputType][guideId]]
    },
    recommendedActions: getRecommendedActions(guideId, normalizedInputType),
    createdAt: new Date().toISOString()
  }
}

export function getWorkspaceRecommendations(inputType = '女装') {
  return WORKSPACE_GUIDES
    .map((guide) => getWorkspaceRecommendation(guide.guideId, inputType))
    .filter(Boolean)
}
