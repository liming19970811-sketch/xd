export const WEBSITE_ARTICLE_CATEGORIES = [
  'AI服装设计',
  'AI商拍',
  '换模特与换衣',
  'AI制版',
  '版型数字化',
  '企业解决方案',
  '使用教程'
]

export const WEBSITE_ARTICLE_KEYWORDS = ['AI服装设计', '服装AI生成', 'AI换模特', 'AI商拍', '服装品牌数字化']

const DEFAULT_RELATED_SOLUTIONS = ['plan-ai-visual-basic', 'plan-brand-visual-upgrade', 'plan-enterprise-api']

export const WEBSITE_ARTICLES = [
  {
    articleId: 'article-ai-fashion-design-001',
    title: 'AI服装设计如何帮助商家更快完成上新视觉',
    category: 'AI服装设计',
    summary: '从款式图、样衣图到商品图，AI 可以先生成方向稿，再进入人工确认和精修。',
    content: [
      { heading: '为什么从上新视觉切入', body: '服装商家真正耗时的往往不是一张图，而是模特、场景、颜色、平台尺寸和内容风格之间的反复协调。AI 更适合作为方向稿和素材扩展入口。' },
      { heading: '适合优先落地的环节', body: '换模特、换颜色、换场景、微改款和批量生成可以帮助团队先看清视觉方向，再决定哪些图进入人工精修。' },
      { heading: '交付前仍需确认', body: 'AI 初稿不应直接等同最终交付。重点图需要人工复核服装结构、纹理、品牌调性和平台规范。' }
    ],
    keywords: ['AI服装设计', '服装AI生成', '服装品牌数字化'],
    tags: ['商品上新', 'AI出图', '人工精修'],
    coverUrl: '',
    author: '蝶变内容团队',
    reviewer: '服装视觉顾问',
    publishedAt: '2026-07-14',
    updatedAt: '2026-07-28',
    relatedFunctions: [{ label: '进入 AI 出图', path: '/workspace/ai-output' }],
    relatedSolutions: DEFAULT_RELATED_SOLUTIONS,
    relatedCases: ['demo-ecommerce-launch', 'demo-model-change'],
    relatedArticles: ['article-ai-commercial-photo-001', 'article-fashion-digitalization-001'],
    ctaText: '提交企业需求',
    metaTitle: 'AI服装设计企业方案_服装AI生成与上新图交付',
    metaDescription: '了解 AI 服装设计如何帮助服装商家、工厂和品牌团队更快完成商品图、上新图和设计预览图交付。',
    seoKeywords: ['AI服装设计', '服装AI生成', 'AI换模特', '服装品牌数字化'],
    publishStatus: 'published',
    scheduledAt: '',
    version: 'v1'
  },
  {
    articleId: 'article-ai-commercial-photo-001',
    title: 'AI商拍适合哪些服装商品图场景',
    category: 'AI商拍',
    summary: 'AI商拍更适合商品主图、白底图、社媒封面和活动补图等高频视觉场景。',
    content: [
      { heading: 'AI 商拍的边界', body: 'AI 商拍适合减少重复拍摄和补拍成本，尤其适合新品上架、活动补图和多渠道分发。复杂材质和重点投放图仍建议保留人工复核。' },
      { heading: '常见落地场景', body: '商品主图、跨境白底图、生活方式场景图和种草封面图，是服装商家更容易先验证价值的场景。' },
      { heading: '提交需求时要说明什么', body: '建议提前说明图片用途、平台规范、输出数量、是否需要人工精修和交付时间。' }
    ],
    keywords: ['AI商拍', '服装AI生成', 'AI换模特'],
    tags: ['商品主图', '白底图', '社媒封面'],
    coverUrl: '',
    author: '蝶变内容团队',
    reviewer: '电商视觉顾问',
    publishedAt: '2026-07-14',
    updatedAt: '2026-07-28',
    relatedFunctions: [{ label: '创建商品主图', path: '/workspace/ai-output?type=ecommerce' }],
    relatedSolutions: ['plan-ai-visual-basic', 'plan-brand-visual-upgrade'],
    relatedCases: ['demo-ecommerce-launch', 'demo-batch-sku'],
    relatedArticles: ['article-ai-fashion-design-001', 'article-virtual-model-001'],
    ctaText: '提交企业需求',
    metaTitle: 'AI商拍服装商品图方案_主图白底图种草图生成',
    metaDescription: '面向服装电商、跨境卖家和品牌团队，梳理 AI 商拍适合落地的商品图、白底图和社媒种草图场景。',
    seoKeywords: ['AI商拍', '服装AI生成', '跨境白底图', '商品主图'],
    publishStatus: 'published',
    scheduledAt: '',
    version: 'v1'
  },
  {
    articleId: 'article-virtual-model-001',
    title: '虚拟模特与 AI 换模特在服装展示中的区别',
    category: '换模特与换衣',
    summary: '虚拟模特偏向长期资产沉淀，AI换模特更适合日常商品展示和快速上新。',
    content: [
      { heading: '两类能力解决的问题不同', body: '虚拟模特更强调品牌资产和长期一致性，AI 换模特更适合日常商品图生产和视觉方向测试。' },
      { heading: '什么时候使用 AI 换模特', body: '当商家需要快速判断不同模特气质、身形和场景是否匹配款式时，可以先用 AI 生成展示方向。' },
      { heading: '企业客户如何沉淀资产', body: '建议把品牌模特、场景、模板和禁用风格统一管理，减少每次出图时重复沟通。' }
    ],
    keywords: ['虚拟模特', 'AI换模特', 'AI换衣', '服装品牌数字化'],
    tags: ['换模特', '换衣', '品牌模特'],
    coverUrl: '',
    author: '蝶变内容团队',
    reviewer: '品牌视觉顾问',
    publishedAt: '2026-07-14',
    updatedAt: '2026-07-28',
    relatedFunctions: [{ label: '进入换模特', path: '/workspace/ai-output?type=model' }],
    relatedSolutions: ['plan-brand-visual-upgrade', 'plan-enterprise-api'],
    relatedCases: ['demo-model-change', 'demo-ecommerce-launch'],
    relatedArticles: ['article-ai-fashion-design-001', 'article-ai-commercial-photo-001'],
    ctaText: '提交企业需求',
    metaTitle: '虚拟模特与AI换模特_服装品牌数字资产建设',
    metaDescription: '对比虚拟模特和 AI 换模特在服装展示、品牌资产沉淀和日常上新图生产中的不同使用方式。',
    seoKeywords: ['虚拟模特', 'AI换模特', 'AI换衣', '品牌模特'],
    publishStatus: 'published',
    scheduledAt: '',
    version: 'v1'
  },
  {
    articleId: 'article-ai-pattern-making-001',
    title: 'AI 制版为什么必须保留专业审核',
    category: 'AI制版',
    summary: 'AI 可以帮助生成结构参考和工艺说明草稿，但投入生产前必须由专业版师审核。',
    content: [
      { heading: 'AI 制版的适用位置', body: 'AI 制版更适合作为结构识别、技术图草稿和版型方向参考，而不是直接替代生产制版。' },
      { heading: '审核必须覆盖哪些内容', body: '版师需要检查品类、廓形、领型、袖型、衣长、松量、结构线和尺寸逻辑。' },
      { heading: '如何形成可追踪数据', body: 'AI 原稿、版师修订稿、差异说明和审核记录需要分版本保存，已审核版本不得被覆盖。' }
    ],
    keywords: ['AI制版', '服装结构图', '版师审核'],
    tags: ['AI制版', '结构图', '专业审核'],
    coverUrl: '',
    author: '蝶变内容团队',
    reviewer: '版型顾问',
    publishedAt: '2026-07-28',
    updatedAt: '2026-07-28',
    relatedFunctions: [{ label: '进入 AI 制版', path: '/workspace/pattern-making' }],
    relatedSolutions: ['plan-brand-visual-upgrade', 'plan-enterprise-api'],
    relatedCases: ['demo-pattern-making'],
    relatedArticles: ['article-pattern-digitalization-001', 'article-enterprise-solution-001'],
    ctaText: '提交企业需求',
    metaTitle: 'AI制版专业审核_服装结构图与版型参考流程',
    metaDescription: '说明 AI 制版在服装结构识别、技术图草稿和版师审核流程中的边界，避免未审核结果直接进入生产。',
    seoKeywords: ['AI制版', '服装结构图', '版型数字化'],
    publishStatus: 'published',
    scheduledAt: '',
    version: 'v1'
  },
  {
    articleId: 'article-pattern-digitalization-001',
    title: '版型数字化如何连接研发、审核和训练数据',
    category: '版型数字化',
    summary: '版型库不仅是文件夹，还需要版本、权限、审核、派生关系和训练授权。',
    content: [
      { heading: '版型资产需要结构化', body: '专业团队需要区分系统版型、个人版型和企业版型，并保存版本、来源、审核状态和派生关系。' },
      { heading: '为什么不能覆盖已审核版本', body: '已审核或已批准版本会关联项目和交付记录，后续修改必须创建新版本，避免破坏历史追溯。' },
      { heading: '训练数据必须授权', body: '只有来源明确、审核通过且获得训练授权的数据，才可以进入模型训练候选集。' }
    ],
    keywords: ['版型数字化', 'AI制版', '服装品牌数字化'],
    tags: ['版型库', '版本管理', '训练授权'],
    coverUrl: '',
    author: '蝶变内容团队',
    reviewer: '版型顾问',
    publishedAt: '2026-07-28',
    updatedAt: '2026-07-28',
    relatedFunctions: [{ label: '进入版型库', path: '/workspace/pattern-library' }],
    relatedSolutions: ['plan-enterprise-api', 'plan-brand-visual-upgrade'],
    relatedCases: ['demo-pattern-making'],
    relatedArticles: ['article-ai-pattern-making-001', 'article-enterprise-solution-001'],
    ctaText: '提交企业需求',
    metaTitle: '版型数字化_版型库版本管理与AI训练授权',
    metaDescription: '介绍服装版型数字化如何连接版本管理、企业权限、审核记录和 AI 训练数据闭环。',
    seoKeywords: ['版型数字化', 'AI制版', '版型库'],
    publishStatus: 'published',
    scheduledAt: '',
    version: 'v1'
  },
  {
    articleId: 'article-enterprise-solution-001',
    title: '企业级 AI 服装视觉方案应该包含哪些模块',
    category: '企业解决方案',
    summary: '企业级方案不只是生成按钮，还需要工作台、项目、审核、交付和权限体系。',
    content: [
      { heading: '官网和工作台要分离', body: '官网负责讲清产品价值、案例和咨询入口，工作台负责专业操作、任务管理和交付追踪。' },
      { heading: '企业客户关心什么', body: '企业客户更关心项目是否可管理、结果是否可审核、资产是否可追溯、权限是否隔离。' },
      { heading: '逐步接入 API 和批量任务', body: '当项目、任务、资产和交付链路稳定后，再开放企业 API 和批量 SKU 能力会更稳妥。' }
    ],
    keywords: ['企业解决方案', '服装品牌数字化', 'AI服装设计'],
    tags: ['企业服务', '项目管理', '交付流程'],
    coverUrl: '',
    author: '蝶变内容团队',
    reviewer: '企业服务顾问',
    publishedAt: '2026-07-14',
    updatedAt: '2026-07-28',
    relatedFunctions: [{ label: '查看企业方案', path: '/solutions' }],
    relatedSolutions: DEFAULT_RELATED_SOLUTIONS,
    relatedCases: ['demo-ecommerce-launch', 'demo-pattern-making'],
    relatedArticles: ['article-fashion-digitalization-001', 'article-pattern-digitalization-001'],
    ctaText: '提交企业需求',
    metaTitle: '企业级AI服装视觉解决方案_工作台与交付流程',
    metaDescription: '面向企业客户梳理 AI 服装视觉方案的核心模块，包括官网获客、专业工作台、项目管理、权限和交付流程。',
    seoKeywords: ['企业解决方案', 'AI服装设计', '服装品牌数字化', '企业API'],
    publishStatus: 'published',
    scheduledAt: '',
    version: 'v1'
  },
  {
    articleId: 'article-get-started-001',
    title: '第一次使用蝶变工作台应该从哪里开始',
    category: '使用教程',
    summary: '不同身份用户可以从 AI 出图、AI 制版、版型库或项目中心进入。',
    content: [
      { heading: '电商商家', body: '可以先从商品主图、换模特、换场景和批量 SKU 开始，快速完成上新视觉准备。' },
      { heading: '设计师和版师', body: '设计师可从改款、换面料、换图案开始，版师可从 AI 制版、版型库和待审核版型进入。' },
      { heading: '品牌和企业团队', body: '建议从项目中心建立项目，再把出图、制版、审核和交付任务统一纳入项目流程。' }
    ],
    keywords: ['使用教程', 'AI出图', 'AI制版', '项目中心'],
    tags: ['快速开始', '工作台', '项目中心'],
    coverUrl: '',
    author: '蝶变内容团队',
    reviewer: '产品团队',
    publishedAt: '2026-07-28',
    updatedAt: '2026-07-28',
    relatedFunctions: [{ label: '进入工作台', path: '/workspace' }],
    relatedSolutions: [],
    relatedCases: ['demo-ecommerce-launch', 'demo-pattern-making'],
    relatedArticles: ['article-ai-fashion-design-001', 'article-ai-pattern-making-001'],
    ctaText: '提交企业需求',
    metaTitle: '蝶变工作台快速开始_AI出图AI制版项目中心入口',
    metaDescription: '帮助电商商家、设计师、版师和企业团队快速理解蝶变工作台入口与推荐流程。',
    seoKeywords: ['使用教程', 'AI出图', 'AI制版', '项目中心'],
    publishStatus: 'published',
    scheduledAt: '',
    version: 'v1'
  }
]

export function listWebsiteArticles(category = '') {
  const articles = WEBSITE_ARTICLES.filter((item) => item.publishStatus === 'published')
  if (!category) {
    return articles
  }
  return articles.filter((item) => item.category === category)
}

export function searchWebsiteArticles({ keyword = '', category = '', tag = '' } = {}) {
  const normalizedKeyword = String(keyword || '').trim().toLowerCase()
  return listWebsiteArticles(category).filter((item) => {
    const matchesKeyword = !normalizedKeyword || [
      item.title,
      item.summary,
      item.category,
      ...(item.keywords || []),
      ...(item.tags || [])
    ].join(' ').toLowerCase().includes(normalizedKeyword)
    const matchesTag = !tag || (item.tags || []).includes(tag)
    return matchesKeyword && matchesTag
  })
}

export function getWebsiteArticleById(articleId) {
  return WEBSITE_ARTICLES.find((item) => item.articleId === articleId && item.publishStatus === 'published') || null
}

export function getRelatedWebsiteArticles(articleId, limit = 3) {
  const current = getWebsiteArticleById(articleId)
  if (!current) {
    return listWebsiteArticles().slice(0, limit)
  }
  const keywordSet = new Set(current.keywords || [])
  return listWebsiteArticles()
    .filter((item) => item.articleId !== articleId)
    .map((item) => ({
      item,
      score: (item.keywords || []).filter((keyword) => keywordSet.has(keyword)).length + (item.category === current.category ? 1 : 0)
    }))
    .sort((a, b) => b.score - a.score)
    .map(({ item }) => item)
    .slice(0, limit)
}

export function getArticleCatalog(article) {
  if (!article) {
    return []
  }
  return (article.content || []).map((block, index) => ({
    id: `${article.articleId}-section-${index + 1}`,
    title: block.heading || `第 ${index + 1} 节`
  }))
}
