export const ENTERPRISE_SOLUTIONS = [
  {
    id: 'ai-design-workbench',
    name: 'AI 设计工作台',
    desc: '围绕服装图片生产的高频操作，把单款、系列款和批量上新先放进统一出图流程。',
    items: ['换模特', '换颜色', '换图案', '换场景', '批量生成'],
    scopeValues: ['model_replace', 'color_change', 'scene_change', 'batch_generate']
  },
  {
    id: 'brand-asset-center',
    name: '品牌资产中心',
    desc: '沉淀品牌常用视觉资产，减少每次出图都重新描述风格和约束。',
    items: ['品牌颜色', '品牌模特', '品牌场景', '品牌模板'],
    scopeValues: ['model_replace', 'scene_change', 'manual_refine']
  },
  {
    id: 'enterprise-project-management',
    name: '企业项目管理',
    desc: '把需求、生成、审核和交付拆成可跟进的项目节点，适合多人协作。',
    items: ['需求确认', '设计中', '生成中', '审核', '交付'],
    scopeValues: ['manual_refine', 'batch_generate']
  },
  {
    id: 'enterprise-api-service',
    name: '企业 API 服务',
    desc: '面向已有系统的图片生产接入规划，先展示能力边界和后续对接方向。',
    items: ['API 接入', '额度管理', '调用分析', '账单'],
    scopeValues: ['batch_generate']
  }
]

export const ENTERPRISE_KEEP_FIELDS = ['taskId', 'batchId', 'projectId', 'assetId', 'deliveryId']

export const ENTERPRISE_CASE_CATEGORIES = ['女装品牌', '男装品牌', '童装品牌', '电商上新', '批量生产']

export const ENTERPRISE_SERVICE_PLAN_CATEGORIES = ['AI视觉基础版', '品牌视觉升级版', '企业API版']

export const ENTERPRISE_TRUST_TYPES = ['技术保障', 'AI生产流程', '商业授权', '数据安全', '交付保障']

export function getEnterpriseSolutionById(solutionId) {
  return ENTERPRISE_SOLUTIONS.find((item) => item.id === solutionId) || null
}

export function buildEnterpriseDemandSnapshot(solution = {}, form = {}) {
  return {
    solutionId: solution.id || form.mode || '',
    name: solution.name || '',
    capabilityItems: Array.isArray(solution.items) ? solution.items : [],
    demandType: form.demandType || 'enterprise_cooperation',
    productCategory: form.productCategory || '',
    expectedVolume: form.expectedVolume || '',
    expectedDeliveryTime: form.expectedDeliveryTime || '',
    sourcePage: form.sourcePage || 'enterprise',
    sourceChannel: form.sourceChannel || 'website',
    keepFields: ENTERPRISE_KEEP_FIELDS
  }
}
