import { ENTERPRISE_SERVICE_PLAN_CATEGORIES } from './solutionData'

export const ENTERPRISE_SERVICE_PLANS = [
  {
    planId: 'plan-ai-visual-basic',
    name: 'AI视觉基础版',
    target: '适合正在高频上新、需要先降低拍摄和修图压力的服装商家。',
    priceText: '咨询后评估',
    services: ['商品主图生成', '换模特', '换颜色', '换场景', '基础出图建议'],
    deliveryCycle: '按单次需求和图片数量评估',
    features: ['快速 AI 初稿', '适合日常上新', '可选人工精修', '支持多平台用途说明'],
    createdAt: '2026-07-12'
  },
  {
    planId: 'plan-brand-visual-upgrade',
    name: '品牌视觉升级版',
    target: '适合希望统一店铺、社媒和活动视觉风格的品牌团队或设计工作室。',
    priceText: '项目制咨询',
    services: ['品牌风格梳理', '品牌模特方向', '品牌场景模板', '重点图人工精修', '交付清单管理'],
    deliveryCycle: '按项目周期和确认轮次评估',
    features: ['品牌资产沉淀', '多轮确认', '系列化上新', '可复用视觉规范'],
    createdAt: '2026-07-12'
  },
  {
    planId: 'plan-enterprise-api',
    name: '企业API版',
    target: '适合已有内部系统、批量 SKU 或需要稳定接口接入的企业客户。',
    priceText: '企业定制咨询',
    services: ['API 接入方案', '调用额度规划', '调用分析口径', '账单对账说明', '企业项目协作'],
    deliveryCycle: '按接入范围和测试计划评估',
    features: ['接口接入规划', '额度管理建议', '调用分析', '专人对接'],
    createdAt: '2026-07-12'
  }
]

export function listEnterpriseServicePlans() {
  return ENTERPRISE_SERVICE_PLANS
}

export function getEnterpriseServicePlanById(planId) {
  return ENTERPRISE_SERVICE_PLANS.find((item) => item.planId === planId) || null
}

export { ENTERPRISE_SERVICE_PLAN_CATEGORIES }
