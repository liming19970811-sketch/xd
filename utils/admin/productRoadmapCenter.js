import { requirePlatformAdmin } from './platformAdminRepository.js'
import { loadBusinessMetricsCenter } from './businessMetricsCenter.js'
import { loadPatternTrainingCenter } from '../workspace/workspacePatternTrainingCenter.js'
import { listTasks } from '../task/taskLayer.js'

const REQUEST_OVERRIDE_KEY = 'diebians_product_request_overrides_v1'
const ROADMAP_OVERRIDE_KEY = 'diebians_product_roadmap_overrides_v1'

const FEEDBACK_KEY = 'diebians_product_feedback_v1'
const TICKET_KEY = 'diebians_support_tickets_v1'
const LEAD_KEY = 'service_leads'
const ANALYTICS_KEY = 'diebians_product_analytics_events_v1'
const INTERNAL_SUGGESTION_KEY = 'diebians_internal_product_suggestions_v1'

export const FEATURE_REQUEST_CATEGORIES = Object.freeze([
  { key: 'ai_output', label: 'AI出图' },
  { key: 'pattern_making', label: 'AI制版' },
  { key: 'pattern_library', label: '版型库' },
  { key: 'project_delivery', label: '项目与交付' },
  { key: 'enterprise_collaboration', label: '企业协作' },
  { key: 'website_experience', label: '网站体验' },
  { key: 'miniapp_experience', label: '小程序体验' },
  { key: 'performance_security', label: '性能与安全' },
  { key: 'data_operations', label: '数据与运营' }
])

export const ROADMAP_STATUSES = Object.freeze([
  { key: 'idea', label: '想法池' },
  { key: 'evaluating', label: '评估中' },
  { key: 'planned', label: '已规划' },
  { key: 'in_progress', label: '开发中' },
  { key: 'validating', label: '验证中' },
  { key: 'released', label: '已发布' },
  { key: 'paused', label: '已暂停' },
  { key: 'rejected', label: '已拒绝' }
])

export const ROADMAP_VIEWS = Object.freeze([
  { key: 'current', label: '当前开发', statuses: ['in_progress', 'validating'] },
  { key: 'next', label: '下一阶段', statuses: ['planned'] },
  { key: 'later', label: '后续规划', statuses: ['idea', 'evaluating'] },
  { key: 'paused', label: '已暂停', statuses: ['paused', 'rejected'] },
  { key: 'released', label: '已发布', statuses: ['released'] }
])

export const PLATFORM_ALLOCATION = Object.freeze([
  { platform: 'miniapp', label: '微信小程序', principle: '高频、轻量、快速生成' },
  { platform: 'workspace', label: '网站工作台', principle: '专业制版、版型库、批量管理' },
  { platform: 'admin', label: '管理后台', principle: '用户、任务、额度、审核' },
  { platform: 'server', label: '服务端', principle: '大文件、模型训练和复杂分析' }
])

const PRIORITY_LEVELS = Object.freeze([
  { key: 'P0', label: 'P0 阻断', min: 85 },
  { key: 'P1', label: 'P1 高优先级', min: 70 },
  { key: 'P2', label: 'P2 中优先级', min: 45 },
  { key: 'P3', label: 'P3 观察', min: 0 }
])

function nowIso() {
  return new Date().toISOString()
}

function readStore(key = '', fallback = []) {
  try {
    if (typeof uni === 'undefined' || !uni.getStorageSync) return fallback
    const value = uni.getStorageSync(key)
    return value === undefined || value === null || value === '' ? fallback : value
  } catch (error) {
    return fallback
  }
}

function writeStore(key = '', value = []) {
  try {
    if (typeof uni !== 'undefined' && uni.setStorageSync) uni.setStorageSync(key, value)
  } catch (error) {}
}

function asArray(value) {
  return Array.isArray(value) ? value : []
}

function sanitizeText(value = '', limit = 180) {
  return String(value || '')
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email]')
    .replace(/1[3-9]\d{9}/g, '[phone]')
    .replace(/https?:\/\/[^\s"'<>]+/gi, '[url]')
    .replace(/([?&](?:token|sessionToken|apiKey|secret|signature)=)[^&\s]+/gi, '$1[redacted]')
    .slice(0, limit)
}

function normalizeKey(value = '') {
  return sanitizeText(value, 80).toLowerCase().replace(/[^\w\u4e00-\u9fa5]+/g, '_').replace(/^_+|_+$/g, '')
}

function getCategoryLabel(category = '') {
  const found = FEATURE_REQUEST_CATEGORIES.find((item) => item.key === category)
  return found ? found.label : '数据与运营'
}

function inferCategory(text = '') {
  const source = String(text || '').toLowerCase()
  if (/制版|版师|结构图|pattern|technical|尺码|尺寸/.test(source)) return 'pattern_making'
  if (/版型库|版型|pattern_library|library/.test(source)) return 'pattern_library'
  if (/项目|交付|审核|批次|delivery|project|batch/.test(source)) return 'project_delivery'
  if (/成员|权限|企业|协作|team|member|role/.test(source)) return 'enterprise_collaboration'
  if (/官网|首页|网站|搜索|导航|workspace|h5/.test(source)) return 'website_experience'
  if (/小程序|miniapp|mp-weixin/.test(source)) return 'miniapp_experience'
  if (/安全|越权|性能|超时|泄露|合规|隐私|security|timeout/.test(source)) return 'performance_security'
  if (/数据|分析|日志|运营|成本|额度|统计|analytics|quota/.test(source)) return 'data_operations'
  return 'ai_output'
}

function sourceWeight(type = '') {
  const map = {
    security: 24,
    task_failure: 18,
    support_ticket: 16,
    enterprise_lead: 15,
    user_feedback: 12,
    search_empty: 9,
    feature_usage: 8,
    pattern_revision: 12,
    internal_suggestion: 5,
    cost_signal: 14
  }
  return map[type] || 5
}

function normalizeSource(input = {}) {
  const sourceType = String(input.sourceType || 'internal_suggestion')
  const title = sanitizeText(input.title || input.keyword || input.type || '未命名需求', 120)
  const category = input.category || inferCategory(`${title} ${input.description || ''} ${input.functionType || ''}`)
  return {
    sourceId: String(input.sourceId || `${sourceType}_${normalizeKey(title)}`),
    sourceType,
    title,
    category,
    description: sanitizeText(input.description || '', 260),
    functionType: sanitizeText(input.functionType || '', 80),
    resourceId: sanitizeText(input.resourceId || '', 100),
    userImpact: Math.max(0, Number(input.userImpact || 1) || 1),
    enterpriseValue: Math.max(0, Number(input.enterpriseValue || 0) || 0),
    usageFrequency: Math.max(0, Number(input.usageFrequency || 0) || 0),
    urgency: Math.max(0, Number(input.urgency || 0) || 0),
    technicalRisk: Math.max(0, Number(input.technicalRisk || 0) || 0),
    developmentCost: Math.max(0, Number(input.developmentCost || 0) || 0),
    operatingCost: Math.max(0, Number(input.operatingCost || 0) || 0),
    coreChainImpact: Boolean(input.coreChainImpact),
    securityCompliance: Boolean(input.securityCompliance),
    createdAt: input.createdAt || nowIso()
  }
}

function readRawSources() {
  return {
    feedback: asArray(readStore(FEEDBACK_KEY, [])),
    tickets: asArray(readStore(TICKET_KEY, [])),
    leads: asArray(readStore(LEAD_KEY, [])),
    events: asArray(readStore(ANALYTICS_KEY, [])),
    internalSuggestions: asArray(readStore(INTERNAL_SUGGESTION_KEY, [])),
    tasks: listTasks()
  }
}

function buildFeedbackSources(items = []) {
  return items.map((item) => normalizeSource({
    sourceType: 'user_feedback',
    sourceId: item.feedbackId,
    title: item.type === 'hard_to_find' ? '功能难找' : item.type === 'pattern_inaccurate' ? '版型不准确' : item.type || '用户反馈',
    description: item.description || item.type,
    category: inferCategory(`${item.type} ${item.description} ${item.sourcePage}`),
    resourceId: item.resourceId || item.taskId || item.patternMasterId,
    userImpact: item.severity === 'critical' ? 8 : item.severity === 'high' ? 5 : 2,
    urgency: item.severity === 'critical' ? 10 : item.severity === 'high' ? 7 : 3,
    coreChainImpact: ['generation_error', 'quota_issue', 'pattern_inaccurate'].includes(item.type),
    securityCompliance: item.type === 'quota_issue',
    createdAt: item.createdAt
  }))
}

function buildTicketSources(items = []) {
  return items.map((item) => normalizeSource({
    sourceType: 'support_ticket',
    sourceId: item.ticketId,
    title: item.title || item.typeLabel || item.type,
    description: item.description || item.recentErrorCode,
    category: inferCategory(`${item.type} ${item.title} ${item.description}`),
    resourceId: item.taskId || item.projectId || item.patternId,
    userImpact: item.priority === 'P0' ? 10 : item.priority === 'P1' ? 7 : item.priority === 'P2' ? 4 : 2,
    urgency: item.priority === 'P0' ? 10 : item.priority === 'P1' ? 8 : item.priority === 'P2' ? 5 : 2,
    coreChainImpact: ['ai_generation_failed', 'quota_billing', 'upload_download', 'project_delivery'].includes(item.type),
    securityCompliance: item.priority === 'P0' || item.type === 'account_permission',
    createdAt: item.createdAt
  }))
}

function buildLeadSources(items = []) {
  return items.map((item) => normalizeSource({
    sourceType: 'enterprise_lead',
    sourceId: item.leadId,
    title: item.demandType || item.interestType || '企业需求',
    description: item.requirementText || item.description || item.interestType,
    category: inferCategory(`${item.demandType} ${item.interestType} ${item.requirementText}`),
    resourceId: item.leadId,
    enterpriseValue: 8,
    userImpact: 4,
    usageFrequency: 3,
    urgency: item.expectedDeliveryDate || item.expectedDeliveryTime ? 5 : 2,
    coreChainImpact: true,
    createdAt: item.createdAt
  }))
}

function buildAnalyticsSources(events = []) {
  const reportable = events.filter((event) => event.eventName && !event.isMock && !event.isInternalTest && !['development', 'dev', 'test'].includes(String(event.env || '').toLowerCase()))
  const emptyKeywords = groupCount(reportable.filter((event) => event.eventName === 'search_empty' || event.noResult), (event) => event.searchKeyword || event.keyword || '无结果搜索')
  const usage = groupCount(reportable.filter((event) => event.functionType), (event) => event.functionType)
  return [
    ...Object.keys(emptyKeywords).map((keyword) => normalizeSource({
      sourceType: 'search_empty',
      sourceId: `search_empty_${normalizeKey(keyword)}`,
      title: `搜索无结果：${keyword}`,
      description: '用户搜索后没有找到可用功能或内容。',
      category: inferCategory(keyword),
      usageFrequency: emptyKeywords[keyword],
      userImpact: Math.min(10, emptyKeywords[keyword]),
      urgency: emptyKeywords[keyword] >= 5 ? 6 : 3
    })),
    ...Object.keys(usage).map((functionType) => normalizeSource({
      sourceType: 'feature_usage',
      sourceId: `usage_${normalizeKey(functionType)}`,
      title: `高频功能：${functionType}`,
      description: '来自真实功能访问和任务事件。',
      functionType,
      category: inferCategory(functionType),
      usageFrequency: usage[functionType],
      userImpact: Math.min(10, usage[functionType]),
      enterpriseValue: usage[functionType] >= 5 ? 5 : 2
    }))
  ]
}

function buildTaskFailureSources(tasks = []) {
  const realFailures = tasks.filter((task) => {
    const provider = String(task.provider || task.result?.provider || '').toLowerCase()
    const source = String(task.source || task.result?.source || '').toLowerCase()
    if (task.mock || task.isMock || task.fallback || task.isFallback) return false
    if (provider.includes('mock') || provider.includes('fallback')) return false
    if (source.includes('mock') || source.includes('fallback') || source.includes('test')) return false
    return ['failed', 'timeout'].includes(String(task.status || '').toLowerCase())
  })
  const groups = groupCount(realFailures, (task) => task.type || task.taskType || task.input?.type || task.errorCode || 'AI任务失败')
  return Object.keys(groups).map((key) => normalizeSource({
    sourceType: 'task_failure',
    sourceId: `task_failure_${normalizeKey(key)}`,
    title: `任务失败：${key}`,
    description: '来自真实 AI 任务失败和超时数据。',
    functionType: key,
    category: inferCategory(key),
    usageFrequency: groups[key],
    userImpact: Math.min(10, groups[key] * 2),
    urgency: groups[key] >= 3 ? 8 : 5,
    technicalRisk: 6,
    operatingCost: 4,
    coreChainImpact: true
  }))
}

function buildPatternRevisionSources(trainingCenter = {}) {
  const samples = asArray(trainingCenter.samples)
  const queue = asArray(trainingCenter.qualityQueue)
  const revisionHeavy = samples.filter((sample) => asArray(sample.revisionDiff).filter((item) => item.changed).length >= 3)
  return [
    queue.length ? normalizeSource({
      sourceType: 'pattern_revision',
      sourceId: 'pattern_quality_queue',
      title: '版型训练样本质量待处理',
      description: '存在未授权、标签缺失或版本关系不完整的版型样本。',
      category: 'pattern_making',
      userImpact: Math.min(10, queue.length),
      urgency: 6,
      technicalRisk: 6,
      securityCompliance: queue.some((item) => String(asArray(item.issues).join('')).includes('授权'))
    }) : null,
    revisionHeavy.length ? normalizeSource({
      sourceType: 'pattern_revision',
      sourceId: 'pattern_heavy_revision',
      title: '版师修订项过多',
      description: 'AI 初稿到人工修订差异较大，需要优化制版识别或审核流程。',
      category: 'pattern_making',
      userImpact: Math.min(10, revisionHeavy.length),
      urgency: 5,
      technicalRisk: 5,
      developmentCost: 6,
      coreChainImpact: true
    }) : null
  ].filter(Boolean)
}

function buildCostSignalSources(metrics = {}) {
  return asArray(metrics.featureMetrics).filter((item) => item.taskCount > 0).map((item) => normalizeSource({
    sourceType: 'cost_signal',
    sourceId: `cost_signal_${normalizeKey(item.functionType)}`,
    title: `${item.functionType} 成本与通过率评估`,
    description: `${item.segmentLabel || ''}，建议：${item.recommendedAction || ''}`,
    functionType: item.functionType,
    category: inferCategory(item.functionType),
    usageFrequency: item.taskCount,
    userImpact: Math.min(10, item.taskCount),
    enterpriseValue: item.approvedImageCount > 0 ? 6 : 1,
    urgency: item.failureRate >= 30 || item.approvalRate < 50 ? 6 : 2,
    technicalRisk: item.failureRate >= 30 ? 5 : 2,
    operatingCost: item.aiCost > item.quotaIncome ? 6 : 2,
    coreChainImpact: item.taskCount >= 3
  }))
}

function buildInternalSources(items = []) {
  return items.map((item) => normalizeSource({
    ...item,
    sourceType: 'internal_suggestion',
    sourceId: item.suggestionId || item.sourceId,
    title: item.title || item.name || '内部运营建议',
    description: item.description || item.reason || '',
    category: item.category || inferCategory(`${item.title} ${item.description}`),
    createdAt: item.createdAt
  }))
}

function groupCount(items = [], getKey) {
  return items.reduce((result, item) => {
    const key = sanitizeText(getKey(item) || 'unknown', 80)
    result[key] = (result[key] || 0) + 1
    return result
  }, {})
}

function mergeSimilarRequests(sources = []) {
  const map = {}
  sources.forEach((source) => {
    const normalized = normalizeSource(source)
    const key = `${normalized.category}:${normalizeKey(normalized.functionType || normalized.title)}`
    if (!map[key]) {
      map[key] = {
        requestId: `request_${normalizeKey(key)}`,
        canonicalKey: key,
        title: normalized.title,
        category: normalized.category,
        categoryLabel: getCategoryLabel(normalized.category),
        description: normalized.description,
        sources: [],
        sourceTypes: [],
        relatedSourceIds: [],
        metrics: createEmptyScoreMetrics(),
        createdAt: normalized.createdAt,
        updatedAt: normalized.createdAt
      }
    }
    const item = map[key]
    item.sources.push(normalized)
    item.sourceTypes = [...new Set([...item.sourceTypes, normalized.sourceType])]
    item.relatedSourceIds = [...new Set([...item.relatedSourceIds, normalized.sourceId])]
    item.metrics.userImpact += normalized.userImpact + sourceWeight(normalized.sourceType) / 4
    item.metrics.enterpriseValue += normalized.enterpriseValue
    item.metrics.usageFrequency += normalized.usageFrequency
    item.metrics.businessUrgency += normalized.urgency
    item.metrics.technicalRisk += normalized.technicalRisk
    item.metrics.developmentCost += normalized.developmentCost
    item.metrics.operatingCost += normalized.operatingCost
    item.metrics.coreChainImpact += normalized.coreChainImpact ? 10 : 0
    item.metrics.securityCompliance += normalized.securityCompliance ? 15 : 0
    if (String(normalized.createdAt).localeCompare(String(item.updatedAt)) > 0) item.updatedAt = normalized.createdAt
  })
  return Object.values(map).map(applyScoreAndOverrides).sort((left, right) => right.score.total - left.score.total)
}

function createEmptyScoreMetrics() {
  return {
    userImpact: 0,
    enterpriseValue: 0,
    usageFrequency: 0,
    businessUrgency: 0,
    technicalRisk: 0,
    developmentCost: 0,
    operatingCost: 0,
    coreChainImpact: 0,
    securityCompliance: 0
  }
}

function applyScoreAndOverrides(request = {}) {
  const overrides = readRequestOverrides()[request.requestId] || {}
  const metrics = request.metrics || createEmptyScoreMetrics()
  const positive = metrics.userImpact + metrics.enterpriseValue + metrics.usageFrequency + metrics.businessUrgency + metrics.coreChainImpact + metrics.securityCompliance
  const negative = metrics.technicalRisk * 0.6 + metrics.developmentCost * 0.8 + metrics.operatingCost * 0.5
  const total = Math.max(0, Math.min(100, Math.round(positive - negative)))
  const suggestedPriority = getPriorityLevel(total).key
  return {
    ...request,
    score: {
      ...metrics,
      total,
      suggestedPriority,
      suggestedPriorityLabel: getPriorityLevel(total).label,
      manualPriority: overrides.manualPriority || '',
      finalPriority: overrides.manualPriority || suggestedPriority,
      manuallyConfirmed: Boolean(overrides.manualPriority),
      confirmedBy: overrides.confirmedBy || '',
      confirmedAt: overrides.confirmedAt || ''
    },
    owner: overrides.owner || '',
    targetVersion: overrides.targetVersion || '',
    acceptanceCriteria: overrides.acceptanceCriteria || '',
    dependencies: asArray(overrides.dependencies),
    risks: buildRisks(metrics),
    platformAllocation: getPlatformAllocation(request.category, request.title),
    stopSignals: buildStopSignals(request, metrics),
    roadmapStatus: overrides.roadmapStatus || getDefaultRoadmapStatus(total, metrics),
    publicCommitmentSafe: false
  }
}

function getPriorityLevel(score = 0) {
  return PRIORITY_LEVELS.find((item) => score >= item.min) || PRIORITY_LEVELS[3]
}

function buildRisks(metrics = {}) {
  const risks = []
  if (metrics.securityCompliance > 0) risks.push('涉及安全与合规，必须先完成风险评估')
  if (metrics.technicalRisk >= 6) risks.push('技术风险较高，需要技术预研')
  if (metrics.operatingCost >= 6) risks.push('运营成本偏高，需要限定开放范围')
  if (metrics.developmentCost >= 8) risks.push('开发成本高，应拆分阶段交付')
  return risks
}

function getDefaultRoadmapStatus(score = 0, metrics = {}) {
  if (metrics.securityCompliance > 0 && score >= 75) return 'planned'
  if (score >= 85) return 'planned'
  if (score >= 55) return 'evaluating'
  return 'idea'
}

function getPlatformAllocation(category = '', title = '') {
  const text = `${category} ${title}`
  if (category === 'miniapp_experience' || (/快速|轻量|高频|AI出图/.test(text) && !/批量|专业|制版/.test(text))) return PLATFORM_ALLOCATION[0]
  if (['pattern_making', 'pattern_library', 'project_delivery'].includes(category) || /批量|制版|版型库|专业/.test(text)) return PLATFORM_ALLOCATION[1]
  if (['enterprise_collaboration', 'data_operations'].includes(category) || /用户|任务|额度|审核|后台/.test(text)) return PLATFORM_ALLOCATION[2]
  if (category === 'performance_security' || /模型|训练|大文件|服务端|安全/.test(text)) return PLATFORM_ALLOCATION[3]
  return PLATFORM_ALLOCATION[1]
}

function buildStopSignals(request = {}, metrics = {}) {
  const signals = []
  if (metrics.usageFrequency <= 1 && metrics.userImpact <= 3) signals.push('长期低使用')
  if (metrics.operatingCost >= 8 && metrics.enterpriseValue <= 3) signals.push('成本持续高于价值')
  if (metrics.technicalRisk >= 8) signals.push('模型效果或技术风险未达最低标准')
  if (metrics.securityCompliance >= 15 && metrics.technicalRisk >= 6) signals.push('存在不可接受的安全风险')
  if (request.category === 'website_experience' && /无关|非核心/.test(request.description || '')) signals.push('与核心定位无关')
  return signals
}

function readRequestOverrides() {
  const value = readStore(REQUEST_OVERRIDE_KEY, {})
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
}

function writeRequestOverrides(next = {}) {
  writeStore(REQUEST_OVERRIDE_KEY, next)
}

function readRoadmapOverrides() {
  const value = readStore(ROADMAP_OVERRIDE_KEY, {})
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
}

function buildRoadmapItems(requests = []) {
  const roadmapOverrides = readRoadmapOverrides()
  return requests.map((request) => {
    const patch = roadmapOverrides[request.requestId] || {}
    const status = ROADMAP_STATUSES.some((item) => item.key === patch.status) ? patch.status : request.roadmapStatus
    return {
      roadmapId: `roadmap_${request.requestId}`,
      requestId: request.requestId,
      title: request.title,
      category: request.category,
      categoryLabel: request.categoryLabel,
      status,
      statusLabel: getStatusLabel(status),
      owner: patch.owner || request.owner || '未指定',
      targetVersion: patch.targetVersion || request.targetVersion || '待确认',
      dependencies: asArray(patch.dependencies || request.dependencies),
      risks: asArray(patch.risks || request.risks),
      acceptanceCriteria: patch.acceptanceCriteria || request.acceptanceCriteria || '需补充验收标准',
      platformAllocation: request.platformAllocation,
      finalPriority: request.score.finalPriority,
      score: request.score.total,
      publicCommitmentSafe: false,
      updatedAt: patch.updatedAt || request.updatedAt
    }
  })
}

function getStatusLabel(status = '') {
  const found = ROADMAP_STATUSES.find((item) => item.key === status)
  return found ? found.label : '评估中'
}

function buildRoadmapViews(items = []) {
  return ROADMAP_VIEWS.map((view) => ({
    ...view,
    items: items.filter((item) => view.statuses.includes(item.status))
  }))
}

function buildSourceStats(requests = []) {
  const sourceMap = {}
  requests.forEach((request) => {
    request.sourceTypes.forEach((type) => {
      sourceMap[type] = (sourceMap[type] || 0) + 1
    })
  })
  return Object.keys(sourceMap).map((sourceType) => ({ sourceType, count: sourceMap[sourceType] })).sort((left, right) => right.count - left.count)
}

function collectSources() {
  const raw = readRawSources()
  const metrics = loadBusinessMetricsCenter({ period: '30d' })
  const trainingCenter = loadPatternTrainingCenter({}, {})
  return [
    ...buildFeedbackSources(raw.feedback),
    ...buildTicketSources(raw.tickets),
    ...buildLeadSources(raw.leads),
    ...buildAnalyticsSources(raw.events),
    ...buildTaskFailureSources(raw.tasks),
    ...buildPatternRevisionSources(trainingCenter),
    ...buildCostSignalSources(metrics.canAccess ? metrics : {}),
    ...buildInternalSources(raw.internalSuggestions)
  ]
}

export function loadProductRoadmapCenter() {
  const guard = requirePlatformAdmin()
  if (!guard.allowed) return buildDeniedCenter(guard.reason || 'platform_admin_required')
  const requests = mergeSimilarRequests(collectSources())
  const roadmapItems = buildRoadmapItems(requests)
  return {
    canAccess: true,
    reason: '',
    requests,
    roadmapItems,
    roadmapViews: buildRoadmapViews(roadmapItems),
    sourceStats: buildSourceStats(requests),
    categories: FEATURE_REQUEST_CATEGORIES,
    statuses: ROADMAP_STATUSES,
    platformAllocation: PLATFORM_ALLOCATION,
    summary: {
      requestCount: requests.length,
      linkedSourceCount: requests.reduce((sum, item) => sum + item.sources.length, 0),
      confirmedPriorityCount: requests.filter((item) => item.score.manuallyConfirmed).length,
      pausedCandidateCount: requests.filter((item) => item.stopSignals.length).length,
      highPriorityCount: requests.filter((item) => ['P0', 'P1'].includes(item.score.finalPriority)).length
    },
    updatedAt: nowIso()
  }
}

export function loadFeatureRequestCenter(filters = {}) {
  const center = loadProductRoadmapCenter()
  if (!center.canAccess) return center
  const category = String(filters.category || '')
  const priority = String(filters.priority || '')
  const sourceType = String(filters.sourceType || '')
  const keyword = String(filters.keyword || '').trim().toLowerCase()
  const requests = center.requests.filter((item) => {
    if (category && item.category !== category) return false
    if (priority && item.score.finalPriority !== priority) return false
    if (sourceType && !item.sourceTypes.includes(sourceType)) return false
    if (keyword && !`${item.title} ${item.description} ${item.categoryLabel}`.toLowerCase().includes(keyword)) return false
    return true
  })
  return {
    ...center,
    requests,
    filters
  }
}

export function confirmFeatureRequestPriority(requestId = '', manualPriority = 'P2', input = {}) {
  const guard = requirePlatformAdmin()
  if (!guard.allowed) return { success: false, errorCode: guard.reason || 'platform_admin_required' }
  const priority = PRIORITY_LEVELS.some((item) => item.key === manualPriority) ? manualPriority : 'P2'
  const overrides = readRequestOverrides()
  overrides[requestId] = {
    ...(overrides[requestId] || {}),
    manualPriority: priority,
    owner: sanitizeText(input.owner || overrides[requestId]?.owner || ''),
    targetVersion: sanitizeText(input.targetVersion || overrides[requestId]?.targetVersion || ''),
    acceptanceCriteria: sanitizeText(input.acceptanceCriteria || overrides[requestId]?.acceptanceCriteria || '', 400),
    confirmedBy: sanitizeText(input.confirmedBy || 'platform_admin', 80),
    confirmedAt: nowIso()
  }
  writeRequestOverrides(overrides)
  return { success: true, requestId, manualPriority: priority }
}

export function updateRoadmapItem(requestId = '', patch = {}) {
  const guard = requirePlatformAdmin()
  if (!guard.allowed) return { success: false, errorCode: guard.reason || 'platform_admin_required' }
  const status = ROADMAP_STATUSES.some((item) => item.key === patch.status) ? patch.status : ''
  if (!status) return { success: false, errorCode: 'invalid_roadmap_status' }
  const overrides = readRoadmapOverrides()
  overrides[requestId] = {
    ...(overrides[requestId] || {}),
    status,
    owner: sanitizeText(patch.owner || overrides[requestId]?.owner || ''),
    targetVersion: sanitizeText(patch.targetVersion || overrides[requestId]?.targetVersion || ''),
    acceptanceCriteria: sanitizeText(patch.acceptanceCriteria || overrides[requestId]?.acceptanceCriteria || '', 400),
    updatedAt: nowIso()
  }
  writeStore(ROADMAP_OVERRIDE_KEY, overrides)
  return { success: true, requestId, status }
}

function buildDeniedCenter(reason = 'platform_admin_required') {
  return {
    canAccess: false,
    reason,
    requests: [],
    roadmapItems: [],
    roadmapViews: buildRoadmapViews([]),
    sourceStats: [],
    categories: FEATURE_REQUEST_CATEGORIES,
    statuses: ROADMAP_STATUSES,
    platformAllocation: PLATFORM_ALLOCATION,
    summary: {
      requestCount: 0,
      linkedSourceCount: 0,
      confirmedPriorityCount: 0,
      pausedCandidateCount: 0,
      highPriorityCount: 0
    },
    updatedAt: nowIso()
  }
}
