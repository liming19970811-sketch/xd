import { createWorkspacePlan } from './workspacePlan'
import { getWorkspaceRecommendation } from './workspaceRecommendation'

const INTENT_RULES = Object.freeze([
  {
    targetType: 'brand_assets',
    guideId: 'enterprise_assets',
    recommendedEntry: 'brand_workspace',
    keywords: ['品牌资产', '品牌库', '品牌色', '品牌模特', '资产管理', '视觉规范']
  },
  {
    targetType: 'new_design',
    guideId: 'new-design',
    recommendedEntry: 'color',
    keywords: ['新品开发', '开发新款', '新款', '换颜色', '换色', '换图案', '印花', '改款', '设计方案']
  },
  {
    targetType: 'brand_marketing',
    guideId: 'brand-marketing',
    recommendedEntry: 'scene',
    keywords: ['品牌营销', '营销', '小红书', '种草', '广告', '活动', '海报', '批量素材']
  },
  {
    targetType: 'product_images',
    guideId: 'product-images',
    recommendedEntry: 'model',
    keywords: ['商品图', '主图', '白底图', '详情页', '模特图', '上新图', '电商图']
  }
])

const CATEGORY_KEYWORDS = ['女装', '男装', '童装', '针织', '牛仔', '运动']
const COLOR_KEYWORDS = [
  '纯黑', '黑色', '米白', '白色', '高级灰', '灰色', '藏蓝', '蓝色', '红色',
  '粉色', '绿色', '紫色', '黄色', '橙色', '雾霾蓝', '奶油色', '香槟色', '牛仔蓝'
]
const STYLE_KEYWORDS = ['韩系', '通勤', '国风', '运动', '街拍', '轻奢', '极简', '复古', '甜美', '商务', '休闲']
const SCENE_KEYWORDS = ['白底', '棚拍', '街拍', '户外', '自然', '酒店', '运动场', '节日', '办公室', '咖啡店']
const MODEL_KEYWORDS = ['亚洲女模', '欧美女模', '女模', '男模', '童模', '大码模特', '大码', '高挑', '微胖', '年轻模特', '轻熟模特']

function includesKeyword(text, keyword) {
  return text.toLowerCase().includes(String(keyword).toLowerCase())
}

function findFirstKeyword(text, keywords) {
  return keywords.find((keyword) => includesKeyword(text, keyword)) || ''
}

function findAllKeywords(text, keywords) {
  return [...new Set(keywords.filter((keyword) => includesKeyword(text, keyword)))]
}

function findSpecificKeywords(text, keywords) {
  return findAllKeywords(text, keywords)
    .sort((left, right) => right.length - left.length)
    .filter((keyword, index, matches) => !matches.slice(0, index).some((item) => item.includes(keyword)))
}

function resolveIntentRule(text) {
  return INTENT_RULES.find((rule) => rule.keywords.some((keyword) => includesKeyword(text, keyword))) || INTENT_RULES[3]
}

function resolveRecommendedEntry(text, rule) {
  if (rule.targetType === 'new_design') {
    if (includesKeyword(text, '图案') || includesKeyword(text, '印花')) return 'pattern'
    if (includesKeyword(text, '改款')) return 'refine'
    return 'color'
  }
  if (rule.targetType === 'brand_marketing') {
    if (includesKeyword(text, '批量')) return 'batch'
    if (includesKeyword(text, '小红书') || includesKeyword(text, '种草')) return 'social'
    return 'scene'
  }
  if (rule.targetType === 'product_images') {
    if (includesKeyword(text, '白底')) return 'crossborder'
    if (includesKeyword(text, '详情')) return 'ecommerce'
    return 'model'
  }
  return rule.recommendedEntry
}

function buildEnterpriseAssetsPlan(category) {
  const actions = [
    { action: 'brand_model', label: '品牌模特', workspaceType: 'brand_workspace', outputCount: 0, estimatedCost: 0 },
    { action: 'brand_color', label: '品牌颜色', workspaceType: 'brand_workspace', outputCount: 0, estimatedCost: 0 },
    { action: 'brand_template', label: '品牌模板', workspaceType: 'brand_workspace', outputCount: 0, estimatedCost: 0 },
    { action: 'brand_project', label: '品牌项目', workspaceType: 'brand_workspace', outputCount: 0, estimatedCost: 0 }
  ]
  return {
    planId: `intent_plan_enterprise_assets_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    guideId: 'enterprise_assets',
    category: category || '品牌资产',
    title: '品牌资产管理方案',
    actions,
    estimatedCost: 0,
    outputCount: 0,
    createdAt: new Date().toISOString(),
    entryType: 'brand_workspace',
    recommendationId: 'workspace_intent_enterprise_assets'
  }
}

function buildRecommendedPlan(rule, category, recommendedEntry) {
  if (rule.targetType === 'brand_assets') return buildEnterpriseAssetsPlan(category)
  const supportedCategory = ['女装', '男装', '童装', '针织', '牛仔'].includes(category) ? category : '女装'
  const recommendation = getWorkspaceRecommendation(rule.guideId, supportedCategory)
  if (!recommendation) return null
  const selectedAction = recommendation.recommendedActions.find((item) => item.workspaceType === recommendedEntry) || recommendation.recommendedActions[0]
  return createWorkspacePlan({
    recommendation,
    category: category || supportedCategory,
    selectedAction
  })
}

export function parseWorkspaceIntent(inputText = '') {
  const text = String(inputText || '').trim()
  if (!text) return null
  const rule = resolveIntentRule(text)
  const clothingCategory = findFirstKeyword(text, CATEGORY_KEYWORDS) || '女装'
  const recommendedEntry = resolveRecommendedEntry(text, rule)
  const hexMatch = text.match(/#[0-9a-fA-F]{6}\b/)
  const extractedParams = {
    clothingCategory,
    color: hexMatch ? hexMatch[0].toUpperCase() : findFirstKeyword(text, COLOR_KEYWORDS),
    style: findAllKeywords(text, STYLE_KEYWORDS),
    scene: findAllKeywords(text, SCENE_KEYWORDS),
    modelRequirement: findSpecificKeywords(text, MODEL_KEYWORDS)
  }
  return {
    intentId: `workspace_intent_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    inputText: text,
    targetType: rule.targetType,
    recommendedEntry,
    recommendedPlan: buildRecommendedPlan(rule, clothingCategory, recommendedEntry),
    extractedParams,
    createdAt: new Date().toISOString()
  }
}

export function getWorkspaceIntentTargetLabel(targetType = '') {
  const labels = {
    product_images: '商品图',
    new_design: '新品开发',
    brand_marketing: '品牌营销',
    brand_assets: '品牌资产'
  }
  return labels[targetType] || '商品图'
}

export function logWorkspaceIntent(intent = {}) {
  if (!intent.intentId) return
  console.log('[workspace:intent]', {
    intentId: intent.intentId
  })
}
