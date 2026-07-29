export const PUBLIC_CASE_CATEGORIES = [
  '电商上新',
  '换模特',
  '批量 SKU',
  '品牌视觉',
  'AI 制版',
  '版型整理',
  '企业项目'
]

export const CASE_PUBLISH_STATUSES = ['draft', 'reviewing', 'published', 'offline']

const DEMO_AUTHORIZATION = Object.freeze({
  status: 'product_demo',
  label: '产品能力演示',
  publicAuthorized: false,
  validUntil: '',
  attachment: ''
})

export const ENTERPRISE_CASES = [
  {
    caseId: 'demo-ecommerce-launch',
    title: '电商新品上新视觉演示',
    category: '电商上新',
    customerDisplayName: '产品能力演示',
    isDemo: true,
    publishStatus: 'published',
    authorization: DEMO_AUTHORIZATION,
    originalProblem: '新品款式集中上架，需要快速准备商品主图、模特展示图和详情页补充素材。',
    usedFunctions: ['换模特', '商品主图', '换场景', '批量 SKU'],
    process: ['整理服装参考图与平台用途', '生成 AI 模特展示初稿', '筛选重点图进入人工修订', '按用途形成交付清单'],
    delivery: '商品主图方向、模特展示图方向、详情页素材方向',
    industry: '服装电商、品牌店铺',
    projectBackground: '适用于新品节奏快、拍摄排期紧、需要多平台素材准备的团队。',
    inputNotes: '可使用平铺图、挂拍图、真人图作为参考；演示内容不包含真实客户素材。',
    aiWorkflow: 'AI 先生成模特和场景方向稿，再按平台用途筛选可交付素材。',
    humanReview: '正式交付前需要人工检查服装结构、纹理、品牌调性和平台规范。',
    resultSummary: '形成可用于上新准备的视觉素材方向，后续可进入项目交付流程。',
    scenarios: ['电商上新', '活动预热', '商品详情页补图'],
    relatedFunctions: [
      { label: '进入 AI 出图', path: '/workspace/ai-output?type=model' },
      { label: '提交企业需求', path: '/enterprise' }
    ],
    comparisonFrames: [
      { label: '原图', desc: '服装参考图示意，不含客户图片' },
      { label: 'AI初稿', desc: '模特和场景方向稿' },
      { label: '修订稿', desc: '人工检查后的重点图方向' },
      { label: '正式交付稿', desc: '需授权项目确认后交付' }
    ],
    tags: ['商品主图', '换模特', '批量素材'],
    relatedArticles: ['article-ai-commercial-photo-001', 'article-ai-fashion-design-001'],
    createdAt: '2026-07-14',
    updatedAt: '2026-07-28'
  },
  {
    caseId: 'demo-model-change',
    title: '服装换模特展示演示',
    category: '换模特',
    customerDisplayName: '产品能力演示',
    isDemo: true,
    publishStatus: 'published',
    authorization: DEMO_AUTHORIZATION,
    originalProblem: '已有商品图缺少适合目标人群的上身效果，重新拍摄成本较高。',
    usedFunctions: ['换模特', '换场景', '人工审核'],
    process: ['上传服装参考图', '选择模特气质与展示风格', '生成 AI 初稿', '人工复核服装细节'],
    delivery: '模特展示图方向、社媒封面方向',
    industry: '女装、男装、设计工作室',
    projectBackground: '适用于需要快速判断不同模特风格是否匹配产品定位的团队。',
    inputNotes: '建议提供清晰服装图，重点款可补充品牌模特偏好和禁用风格。',
    aiWorkflow: '围绕服装主体生成不同模特展示效果，保留衣服关键结构和纹理方向。',
    humanReview: '人工重点检查衣领、袖口、下摆、图案与人体姿态是否合理。',
    resultSummary: '帮助团队在正式拍摄或投放前快速确认视觉方向。',
    scenarios: ['新品视觉方向确认', '社媒素材扩展', '品牌模特资产测试'],
    relatedFunctions: [
      { label: '进入换模特', path: '/workspace/ai-output?type=model' },
      { label: '提交企业需求', path: '/enterprise' }
    ],
    comparisonFrames: [
      { label: '原图', desc: '服装参考图示意' },
      { label: 'AI初稿', desc: '不同模特展示方向' },
      { label: '修订稿', desc: '人工检查服装细节' },
      { label: '正式交付稿', desc: '项目确认后交付' }
    ],
    tags: ['换模特', '上身展示', '人工审核'],
    relatedArticles: ['article-virtual-model-001', 'article-ai-fashion-design-001'],
    createdAt: '2026-07-15',
    updatedAt: '2026-07-28'
  },
  {
    caseId: 'demo-batch-sku',
    title: '多色 SKU 批量素材演示',
    category: '批量 SKU',
    customerDisplayName: '产品能力演示',
    isDemo: true,
    publishStatus: 'published',
    authorization: DEMO_AUTHORIZATION,
    originalProblem: '基础款颜色多、平台规格多，逐色拍摄和修图会拖慢上架节奏。',
    usedFunctions: ['换颜色', '跨境白底图', '批量 SKU'],
    process: ['确认基础款与颜色表', '生成多色方向稿', '输出白底和浅灰底版本', '整理批量交付清单'],
    delivery: '多色 SKU 展示图方向、跨境白底图方向',
    industry: '跨境电商、基础款商家、服装供应链',
    projectBackground: '适用于颜色和尺码组合较多、需要统一视觉规范的商品。',
    inputNotes: '需提供基础款参考图、目标颜色表和平台用途。',
    aiWorkflow: 'AI 按颜色表生成视觉方向，并区分白底图、主图和补充图用途。',
    humanReview: '人工检查颜色偏差、面料纹理、边缘细节和平台合规性。',
    resultSummary: '形成可用于 Listing 准备和运营审核的批量素材方向。',
    scenarios: ['跨境上架', 'SKU 批量视觉准备', '基础款补图'],
    relatedFunctions: [
      { label: '进入批量 SKU', path: '/workspace/ai-output?type=batch' },
      { label: '提交企业需求', path: '/enterprise' }
    ],
    comparisonFrames: [
      { label: '原图', desc: '基础款参考图示意' },
      { label: 'AI初稿', desc: '多色方向稿' },
      { label: '修订稿', desc: '人工核色和细节调整' },
      { label: '正式交付稿', desc: '按平台规范确认后交付' }
    ],
    tags: ['换颜色', '白底图', '批量 SKU'],
    relatedArticles: ['article-ai-commercial-photo-001', 'article-fashion-digitalization-001'],
    createdAt: '2026-07-16',
    updatedAt: '2026-07-28'
  },
  {
    caseId: 'demo-pattern-making',
    title: 'AI 制版参考流程演示',
    category: 'AI 制版',
    customerDisplayName: '产品能力演示',
    isDemo: true,
    publishStatus: 'published',
    authorization: DEMO_AUTHORIZATION,
    originalProblem: '设计图或样衣图需要转化为结构参考，但生产前必须经过专业版师审核。',
    usedFunctions: ['服装结构图', 'AI 制版任务', '版型审核'],
    process: ['上传正背面参考图', '识别服装结构要素', '生成结构图草稿', '版师修订并记录版本'],
    delivery: '技术结构图草稿、工艺说明草稿、版型审核记录',
    industry: '设计工作室、服装工厂、品牌研发团队',
    projectBackground: '适用于从视觉方向进入结构表达、版型整理和研发协作的场景。',
    inputNotes: '建议提供正面、背面、侧面和局部细节图；AI 结果仅作为制版参考。',
    aiWorkflow: 'AI 识别品类、廓形、领型、袖型、衣长和结构线，生成结构表达草稿。',
    humanReview: '必须由专业版师审核、修订并确认尺寸后，才可进入后续生产判断。',
    resultSummary: '形成可追踪的 AI 原稿、人工修订稿和审核记录。',
    scenarios: ['设计研发', '版型数字化', '工厂样衣沟通'],
    relatedFunctions: [
      { label: '进入 AI 制版', path: '/workspace/pattern-making' },
      { label: '提交企业需求', path: '/enterprise' }
    ],
    comparisonFrames: [
      { label: '原图', desc: '服装参考图示意' },
      { label: 'AI初稿', desc: '结构识别与技术图草稿' },
      { label: '修订稿', desc: '版师修订版本' },
      { label: '正式交付稿', desc: '审核通过后才可用于交付判断' }
    ],
    tags: ['AI 制版', '结构图', '版师审核'],
    relatedArticles: ['article-ai-pattern-making-001', 'article-pattern-digitalization-001'],
    createdAt: '2026-07-17',
    updatedAt: '2026-07-28'
  }
]

export function listEnterpriseCases(category = '') {
  const cases = ENTERPRISE_CASES.filter((item) => item.publishStatus === 'published')
  if (!category) {
    return cases
  }
  return cases.filter((item) => item.category === category)
}

export function getEnterpriseCaseById(caseId) {
  return ENTERPRISE_CASES.find((item) => item.caseId === caseId && item.publishStatus === 'published') || null
}

export function getRelatedEnterpriseCases(caseId, limit = 3) {
  const current = getEnterpriseCaseById(caseId)
  if (!current) {
    return listEnterpriseCases().slice(0, limit)
  }
  const tagSet = new Set(current.tags || [])
  return listEnterpriseCases()
    .filter((item) => item.caseId !== caseId)
    .map((item) => ({
      item,
      score: (item.tags || []).filter((tag) => tagSet.has(tag)).length + (item.category === current.category ? 1 : 0)
    }))
    .sort((a, b) => b.score - a.score)
    .map(({ item }) => item)
    .slice(0, limit)
}

export function getCaseAuthorizationLabel(item) {
  if (!item || !item.authorization) {
    return '授权状态未记录'
  }
  if (item.authorization.publicAuthorized) {
    return item.authorization.validUntil ? `已获公开授权，有效期至 ${item.authorization.validUntil}` : '已获公开授权'
  }
  return '产品能力演示，未使用真实客户名称、Logo 或图片'
}

export { PUBLIC_CASE_CATEGORIES as ENTERPRISE_CASE_CATEGORIES }
