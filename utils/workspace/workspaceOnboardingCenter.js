import { get, set } from '../data-provider/dataProvider.js'

const TASK_STATE_KEY = 'diebians_workspace_onboarding_tasks_v1'
const TASK_SKIP_KEY = 'diebians_workspace_onboarding_skipped_v1'

export const ROLE_HOME_ENTRIES = Object.freeze({
  merchant: [
    { icon: '主', label: '商品主图', desc: '快速生成电商平台商品主图。', action: '立即创建', module: 'ai-output', type: 'ecommerce' },
    { icon: '模', label: '换模特', desc: '把服装换到不同模特身上。', action: '立即创建', module: 'ai-output', type: 'model' },
    { icon: '景', label: '换场景', desc: '生成生活方式或商业场景图。', action: '立即创建', module: 'ai-output', type: 'scene' },
    { icon: 'SKU', label: '批量 SKU', desc: '面向多款多色集中出图。', action: '进入批量', module: 'ai-output', type: 'batch' }
  ],
  designer: [
    { icon: '改', label: '改款', desc: '轻改领型、袖型、长度和细节。', action: '立即创建', module: 'ai-output', type: 'refine' },
    { icon: '料', label: '换面料', desc: '模拟不同面料质感预览。', action: '查看能力', module: 'ai-output', type: 'fabric' },
    { icon: '纹', label: '换图案', desc: '生成印花和局部图案预览。', action: '查看能力', module: 'ai-output', type: 'pattern-print' },
    { icon: '构', label: '技术结构图', desc: '进入 AI 制版结构图任务。', action: '进入制版', module: 'pattern-making', type: 'technical-drawing', patternCreate: true }
  ],
  pattern_maker: [
    { icon: '版', label: 'AI 制版', desc: '从服装图进入制版参考流程。', action: '新建任务', module: 'pattern-making', type: 'recognition', patternCreate: true },
    { icon: '审', label: '待审核版型', desc: '查看待审核和待修订的版型。', action: '查看审核', module: 'library', libraryTab: 'review' },
    { icon: '库', label: '版型库', desc: '检索系统、个人和企业版型。', action: '进入版型库', module: 'library' },
    { icon: '修', label: '修订记录', desc: '查看版本历史和修订链路。', action: '查看记录', module: 'pattern-making', type: 'review' }
  ],
  brand: [
    { icon: '项', label: '项目中心', desc: '按项目组织出图、制版和交付。', action: '进入项目', module: 'projects' },
    { icon: '批', label: '批量任务', desc: '集中管理批量生成和失败重试。', action: '查看批次', module: 'batch' },
    { icon: '交', label: '审核交付', desc: '处理审核队列和交付候选。', action: '进入交付', module: 'delivery' },
    { icon: '团', label: '团队管理', desc: '管理成员、角色和权限。', action: '管理团队', module: 'team' }
  ],
  factory: [
    { icon: '项', label: '项目中心', desc: '管理企业项目和交付计划。', action: '进入项目', module: 'projects' },
    { icon: '批', label: '批量任务', desc: '跟踪批量 SKU 和生产记录。', action: '查看批次', module: 'batch' },
    { icon: '交', label: '审核交付', desc: '确认交付批次和反馈处理。', action: '进入交付', module: 'delivery' },
    { icon: '团', label: '团队管理', desc: '设置成员权限和数据范围。', action: '管理团队', module: 'team' }
  ]
})

export const ONBOARDING_TASKS = Object.freeze([
  { taskId: 'profile', title: '完善账号资料', desc: '补充姓名、职业身份和默认进入模块。', module: 'settings', settingsTab: 'profile', action: '去完善' },
  { taskId: 'project', title: '创建第一个项目', desc: '把出图、制版、审核和交付放到同一个项目里。', module: 'projects', mode: 'project-create', action: '创建项目' },
  { taskId: 'upload', title: '上传第一张服装图', desc: '准备平铺图、挂拍图或真人图开始生产。', module: 'ai-output', type: 'model', upload: true, action: '上传图片' },
  { taskId: 'generate', title: '完成一次 AI 生成', desc: '选择一个能力，确认参数后生成结果。', module: 'ai-output', type: 'model', action: '开始生成' },
  { taskId: 'result', title: '查看生成结果', desc: '查看作品来源、状态和可继续处理动作。', module: 'assets', action: '查看作品' },
  { taskId: 'delivery', title: '了解审核与交付', desc: '了解审核通过、交付候选和正式交付的边界。', module: 'delivery', action: '查看交付' }
])

export const HELP_CATEGORIES = Object.freeze([
  { key: 'quick-start', label: '快速开始' },
  { key: 'ai-output', label: 'AI 出图' },
  { key: 'pattern-making', label: 'AI 制版' },
  { key: 'library', label: '版型库' },
  { key: 'projects', label: '项目与批量任务' },
  { key: 'delivery', label: '审核与交付' },
  { key: 'settings', label: '账号与额度' },
  { key: 'team', label: '企业协作' },
  { key: 'faq', label: '常见问题' }
])

export const HELP_ARTICLES = Object.freeze([
  {
    articleId: 'quick-start-first-task',
    category: 'quick-start',
    title: '第一次使用：从一张服装图开始',
    summary: '选择身份后，从工作台首页进入 AI 出图或 AI 制版，先完成一个小任务。',
    keywords: ['首次使用', '上传服装图', '新建任务'],
    targetModule: 'ai-output',
    targetType: 'model',
    actionText: '进入 AI 出图',
    sections: {
      purpose: '帮助新用户快速找到第一个可执行入口。',
      materials: '准备一张清晰服装图，平铺图、挂拍图或真人图均可。',
      standard: '建议主体完整、光线均匀、不要遮挡关键款式细节。',
      steps: ['选择身份', '点击推荐入口', '上传图片', '确认参数', '生成并查看结果'],
      failures: ['图片过暗或主体被遮挡', '上传中断', '选择了规划中的能力'],
      example: '示例结果会在任务结果或资产中心中展示，不在帮助页伪造案例。',
      support: '如仍无法开始，可在企业服务或登录后的团队入口联系支持。'
    }
  },
  {
    articleId: 'ai-output-materials',
    category: 'ai-output',
    title: 'AI 出图需要准备哪些素材',
    summary: '不同出图能力只需要对应素材，创建页不会把全部参数堆在一起。',
    keywords: ['换模特', '换颜色', '换场景', '批量 SKU'],
    targetModule: 'ai-output',
    actionText: '查看出图功能',
    sections: {
      purpose: '说明商品主图、换模特、换场景、批量 SKU 的输入要求。',
      materials: '服装图、商品图、SKU 图片包，部分规划中能力会要求人物图或参考图。',
      standard: '服装轮廓清楚、颜色不严重偏色、SKU 命名尽量规范。',
      steps: ['搜索功能名称', '点击立即创建', '上传素材', '设置当前功能参数', '确认额度并生成'],
      failures: ['素材缺失', '图片链接失效', '功能尚处于规划中', '结果进入审核拦截'],
      example: '可在作品与数字资产中心查看真实任务产出的作品。',
      support: '批量需求建议创建项目或联系企业顾问。'
    }
  },
  {
    articleId: 'pattern-making-review',
    category: 'pattern-making',
    title: 'AI 制版结果为什么必须审核',
    summary: 'AI 制版是专业参考，投入生产前必须由版师修订确认。',
    keywords: ['AI 制版', '结构图', '版型审核', '版师'],
    targetModule: 'pattern-making',
    targetType: 'recognition',
    actionText: '进入 AI 制版',
    sections: {
      purpose: '区分普通视觉出图和专业制版参考，避免把 AI 草稿直接用于生产。',
      materials: '正面服装图为必需，背面图、侧面图和细节图可提升参考完整度。',
      standard: '图片应能看清领型、袖型、衣长、门襟和结构线。',
      steps: ['选择服装品类', '上传参考图片', '填写基础尺寸', '选择结构方向', '生成草稿', '提交专业审核'],
      failures: ['图片角度不足', '尺寸缺失', '结构线被遮挡', '未通过专业审核'],
      example: '任务详情中可查看 AI 原稿与版师修订对比。',
      support: '复杂制版建议由企业管理员分配给授权版师处理。'
    }
  },
  {
    articleId: 'pattern-library-search',
    category: 'library',
    title: '如何检索和复用版型',
    summary: '通过关键词、品类和审核状态找到可复用版型。',
    keywords: ['版型库', '检索', '引用制版', '派生'],
    targetModule: 'library',
    actionText: '进入版型库',
    sections: {
      purpose: '帮助专业用户从系统、个人和企业版型中查找可复用资产。',
      materials: '可准备版型编号、品类、领型、袖型或相似图片。',
      standard: '优先选择审核通过或已授权的版本。',
      steps: ['进入版型库', '筛选范围', '查看详情', '引用制版或创建变体'],
      failures: ['无权限访问企业版型', '版本未审核', '筛选条件过窄'],
      example: '详情页展示版本、审核记录和派生关系。',
      support: '企业版型权限问题请联系管理员。'
    }
  },
  {
    articleId: 'project-batch-delivery',
    category: 'projects',
    title: '用项目管理批量出图和交付',
    summary: '项目用于组织任务、版型、审核和交付，不建议只靠单个任务管理团队协作。',
    keywords: ['项目中心', '批量任务', '交付批次'],
    targetModule: 'projects',
    actionText: '进入项目中心',
    sections: {
      purpose: '把零散 AI 任务组织为可追踪的项目流程。',
      materials: '项目名称、业务类型、负责人、交付时间和需要的功能模块。',
      standard: '企业协作场景建议先建项目，再在项目内创建任务。',
      steps: ['创建项目', '添加任务或版型', '提交审核', '创建交付批次', '确认交付'],
      failures: ['项目成员无权限', '任务未完成', 'mock 或 fallback 结果不能交付'],
      example: '项目详情展示出图任务、制版任务、版型资产、作品与交付。',
      support: '交付异常可在作品与交付中心继续处理。'
    }
  },
  {
    articleId: 'account-quota-errors',
    category: 'faq',
    title: '遇到失败、额度或权限提示怎么办',
    summary: '错误提示应说明是否扣额度、能否重试以及下一步处理方式。',
    keywords: ['失败', '额度', '权限', '重试'],
    targetModule: 'todos',
    actionText: '查看待办中心',
    sections: {
      purpose: '帮助用户判断失败后是否需要重试、联系支持或等待审核。',
      materials: '保留任务 ID、项目 ID、失败时间和页面提示。',
      standard: '不要反复提交同一素材；先查看任务状态和待办中心。',
      steps: ['查看错误说明', '确认是否扣除额度', '按提示重试或进入待办', '必要时联系支持'],
      failures: ['网络失败', '权限不足', '额度不足', '素材不合规', '结果需要审核'],
      example: '失败任务会在待办中心或批量任务中聚合展示。',
      support: '联系支持时只提供任务 ID，不发送密钥、token 或隐私数据。'
    }
  }
])

function readMap(key) {
  const value = get(key, {})
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
}

function writeMap(key, value) {
  set(key, value && typeof value === 'object' ? value : {})
}

function identityKey(identity = '') {
  return identity || 'default'
}

export function getRoleHomeEntries(identity = '') {
  return ROLE_HOME_ENTRIES[identityKey(identity)] || ROLE_HOME_ENTRIES.merchant
}

export function markOnboardingTaskDone(identity = '', taskId = '') {
  if (!taskId) return
  const state = readMap(TASK_STATE_KEY)
  const key = identityKey(identity)
  const list = Array.isArray(state[key]) ? state[key] : []
  if (!list.includes(taskId)) list.push(taskId)
  state[key] = list
  writeMap(TASK_STATE_KEY, state)
}

export function skipOnboarding(identity = '') {
  const state = readMap(TASK_SKIP_KEY)
  state[identityKey(identity)] = true
  writeMap(TASK_SKIP_KEY, state)
}

export function isOnboardingSkipped(identity = '') {
  const state = readMap(TASK_SKIP_KEY)
  return !!state[identityKey(identity)]
}

export function loadOnboardingTasks(identity = '', context = {}) {
  const manualState = readMap(TASK_STATE_KEY)
  const manualDone = Array.isArray(manualState[identityKey(identity)]) ? manualState[identityKey(identity)] : []
  const tasks = Array.isArray(context.tasks) ? context.tasks : []
  const projects = Array.isArray(context.projects) ? context.projects : []
  const assets = Array.isArray(context.assets) ? context.assets : []
  const deliveries = Array.isArray(context.deliveries) ? context.deliveries : []
  const profile = context.profile || {}
  const hasUploaded = tasks.some((task) => {
    const input = task.input || {}
    return !!(input.imageUrl || input.imageSource || input.fileID || (input.assets && Object.keys(input.assets).length))
  })
  const hasSuccessTask = tasks.some((task) => ['success', 'completed'].includes(task.status))
  const autoDone = {
    profile: !!(profile.name || profile.nickname || profile.profession),
    project: projects.length > 0,
    upload: hasUploaded,
    generate: hasSuccessTask,
    result: assets.length > 0 || hasSuccessTask,
    delivery: deliveries.length > 0
  }
  return ONBOARDING_TASKS.map((task) => ({
    ...task,
    completed: manualDone.includes(task.taskId) || !!autoDone[task.taskId]
  }))
}

export function searchHelpArticles(keyword = '', category = 'all') {
  const normalized = String(keyword || '').trim().toLowerCase()
  return HELP_ARTICLES.filter((article) => {
    const categoryMatched = !category || category === 'all' || article.category === category
    if (!categoryMatched) return false
    if (!normalized) return true
    const haystack = [
      article.title,
      article.summary,
      article.category,
      ...(article.keywords || [])
    ].join(' ').toLowerCase()
    return haystack.includes(normalized)
  })
}

export function getHelpArticle(articleId = '') {
  return HELP_ARTICLES.find((article) => article.articleId === articleId) || null
}

export function getModuleHelp(module = '', type = '') {
  const map = {
    overview: 'quick-start-first-task',
    'ai-output': 'ai-output-materials',
    'pattern-making': 'pattern-making-review',
    library: 'pattern-library-search',
    projects: 'project-batch-delivery',
    batch: 'project-batch-delivery',
    delivery: 'project-batch-delivery',
    assets: 'project-batch-delivery',
    todos: 'account-quota-errors',
    settings: 'account-quota-errors',
    team: 'account-quota-errors'
  }
  return getHelpArticle(map[module] || map.overview)
}
