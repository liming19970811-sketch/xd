import { ENTERPRISE_TRUST_TYPES } from './solutionData'

export const ENTERPRISE_TRUST_ITEMS = [
  {
    trustId: 'trust-technology',
    title: '技术保障',
    type: '技术保障',
    description: '围绕服装图像生成、风格控制和批量任务沉淀标准流程，便于后续替换和升级真实 AI 能力。',
    icon: 'T',
    createdAt: '2026-07-13'
  },
  {
    trustId: 'trust-ai-production',
    title: 'AI生产流程',
    type: 'AI生产流程',
    description: '从素材整理、参数确认、AI 初稿到人工复核，拆成清晰节点，降低企业协作成本。',
    icon: 'AI',
    createdAt: '2026-07-13'
  },
  {
    trustId: 'trust-commercial-license',
    title: '商业授权',
    type: '商业授权',
    description: '交付前明确图片用途、交付范围和可商用说明，避免把试验图直接当作最终交付。',
    icon: 'C',
    createdAt: '2026-07-13'
  },
  {
    trustId: 'trust-data-security',
    title: '数据安全',
    type: '数据安全',
    description: '企业素材、品牌资产和项目记录按业务边界管理，后续可扩展权限、审计和资产隔离能力。',
    icon: 'S',
    createdAt: '2026-07-13'
  },
  {
    trustId: 'trust-delivery',
    title: '交付保障',
    type: '交付保障',
    description: '通过需求确认、审核优化和最终交付记录，让企业客户清楚每一批图片的状态和交付口径。',
    icon: 'D',
    createdAt: '2026-07-13'
  }
]

export const ENTERPRISE_DELIVERY_FLOW = [
  {
    trustId: 'flow-requirement',
    title: '需求沟通',
    type: '交付流程',
    description: '确认款式、平台、数量、用途和参考素材。',
    icon: '01',
    createdAt: '2026-07-13'
  },
  {
    trustId: 'flow-plan',
    title: '方案确认',
    type: '交付流程',
    description: '明确服务方案、交付范围、重点图和确认节奏。',
    icon: '02',
    createdAt: '2026-07-13'
  },
  {
    trustId: 'flow-generate',
    title: 'AI生成',
    type: '交付流程',
    description: '按确认方向生成 AI 初稿，形成可筛选的图片候选。',
    icon: '03',
    createdAt: '2026-07-13'
  },
  {
    trustId: 'flow-review',
    title: '审核优化',
    type: '交付流程',
    description: '围绕构图、材质、平台规范和品牌调性继续优化。',
    icon: '04',
    createdAt: '2026-07-13'
  },
  {
    trustId: 'flow-delivery',
    title: '最终交付',
    type: '交付流程',
    description: '按确认范围交付图片素材，并保留项目和需求快照。',
    icon: '05',
    createdAt: '2026-07-13'
  }
]

export function listEnterpriseTrustItems() {
  return ENTERPRISE_TRUST_ITEMS
}

export function listEnterpriseDeliveryFlow() {
  return ENTERPRISE_DELIVERY_FLOW
}

export function getEnterpriseTrustById(trustId) {
  return [...ENTERPRISE_TRUST_ITEMS, ...ENTERPRISE_DELIVERY_FLOW].find((item) => item.trustId === trustId) || null
}

export { ENTERPRISE_TRUST_TYPES }
