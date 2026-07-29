import { requirePlatformAdmin } from './platformAdminRepository.js'
import { getCostRecords } from './providerCostCenter.js'
import { requirePermission } from '../enterprise-web/enterpriseWebGuard.js'
import { getCurrentEnterpriseId } from '../tenant/tenantContext.js'
import { listTasks } from '../task/taskLayer.js'
import { getProjects as getLegacyProjects } from '../project/projectRepository.js'
import { getList as getEnterpriseProjects } from '../repository/projectRepository.js'
import { listWorkspaceBatches, listWorkspaceDeliveries } from '../workspace/workspaceBatchDeliveryCenter.js'
import { loadPatternTrainingCenter } from '../workspace/workspacePatternTrainingCenter.js'

export const BUSINESS_VALUE_SEGMENTS = Object.freeze([
  { key: 'high_usage_high_pass', label: '高使用、高通过', action: '继续重点开发' },
  { key: 'high_usage_low_pass', label: '高使用、低通过', action: '优化模型或流程' },
  { key: 'low_usage_high_value', label: '低使用、高价值', action: '限制开放范围并验证场景' },
  { key: 'low_usage_low_value', label: '低使用、低价值', action: '暂停投入或重新定位' }
])

export const BUSINESS_METRIC_PERIODS = Object.freeze([
  { key: '7d', label: '近7天', days: 7 },
  { key: '30d', label: '近30天', days: 30 },
  { key: '90d', label: '近90天', days: 90 }
])

const SUCCESS_STATUSES = Object.freeze(['success', 'completed'])
const FAILED_STATUSES = Object.freeze(['failed', 'timeout'])
const APPROVED_STATUSES = Object.freeze(['approved', 'reviewed', 'delivered', 'confirmed'])
const PATTERN_TYPES = Object.freeze(['pattern', 'pattern_making', 'structure', 'technical_drawing', 'pattern_structure'])

function nowIso() {
  return new Date().toISOString()
}

function toNumber(value = 0) {
  const num = Number(value)
  return Number.isFinite(num) ? num : 0
}

function toTime(value = '') {
  const time = new Date(value || '').getTime()
  return Number.isFinite(time) ? time : 0
}

function round(value = 0, digits = 2) {
  const unit = Math.pow(10, digits)
  return Math.round((toNumber(value) + Number.EPSILON) * unit) / unit
}

function percent(part = 0, total = 0) {
  return total ? Math.round((part / total) * 100) : 0
}

function getPeriodStart(period = '30d') {
  const option = BUSINESS_METRIC_PERIODS.find((item) => item.key === period) || BUSINESS_METRIC_PERIODS[1]
  return Date.now() - option.days * 24 * 60 * 60 * 1000
}

function inPeriod(record = {}, period = '30d') {
  const created = toTime(record.createdAt || record.updatedAt || record.completedAt || record.deliveredAt)
  return !created || created >= getPeriodStart(period)
}

function normalizeFunctionType(task = {}) {
  return String(task.functionType || task.type || task.taskType || task.input?.type || task.input?.params?.taskType || 'unknown')
}

function normalizeEnterpriseId(record = {}) {
  return String(record.enterpriseId || record.tenantId || '')
}

function isSuccess(task = {}) {
  return SUCCESS_STATUSES.includes(String(task.status || '').toLowerCase())
}

function isFailed(task = {}) {
  return FAILED_STATUSES.includes(String(task.status || '').toLowerCase())
}

function hasResultImage(task = {}) {
  const result = task.result || {}
  return Boolean(task.resultImageUrl || result.image || (Array.isArray(result.items) && result.items.length))
}

function getOutputCount(task = {}) {
  const result = task.result || {}
  if (Array.isArray(result.items)) return result.items.length
  if (task.resultImageUrl || result.image) return 1
  return toNumber(task.outputCount || 0)
}

function getRevisionCount(task = {}) {
  const fields = [
    task.revisionCount,
    task.manualRevisionCount,
    task.retouchCount,
    task.reviewRevisionCount,
    task.result?.revisionCount
  ]
  const explicit = fields.reduce((sum, value) => sum + Math.max(0, toNumber(value)), 0)
  if (explicit) return explicit
  return ['needs_revision', 'changes_requested', 'retouch'].includes(String(task.reviewStatus || task.auditStatus || '').toLowerCase()) ? 1 : 0
}

function isApprovedTask(task = {}) {
  const status = String(task.reviewStatus || task.deliveryStatus || task.approvalStatus || task.result?.reviewStatus || '').toLowerCase()
  return APPROVED_STATUSES.includes(status)
}

function isRealBusinessTask(task = {}) {
  const provider = String(task.provider || task.resultProvider || task.result?.provider || '').toLowerCase()
  const source = String(task.source || task.result?.source || task.input?.source || '').toLowerCase()
  const tags = Array.isArray(task.tags) ? task.tags.join(' ').toLowerCase() : ''
  if (task.mock === true || task.isMock === true || task.fallback === true || task.isFallback === true || task.isInternalTest === true) return false
  if (provider.includes('mock') || provider.includes('fallback')) return false
  if (source.includes('mock') || source.includes('fallback') || source.includes('dev') || source.includes('test')) return false
  if (tags.includes('mock') || tags.includes('fallback') || tags.includes('internal_test')) return false
  return true
}

function filterByScope(records = [], { scope = 'enterprise', enterpriseId = '', period = '30d' } = {}) {
  return records
    .filter((record) => inPeriod(record, period))
    .filter((record) => scope === 'platform' || normalizeEnterpriseId(record) === enterpriseId)
}

function getQuotaIncome(task = {}) {
  return Math.max(0, toNumber(task.quotaIncome || task.quotaCost || task.cost || task.usageAmount || task.result?.quotaCost))
}

function buildCostIndex(records = []) {
  const map = {}
  records.forEach((record) => {
    const taskId = String(record.taskId || '')
    if (!taskId) return
    if (!map[taskId]) map[taskId] = []
    map[taskId].push(record)
  })
  return map
}

function getTaskAiCost(task = {}, costIndex = {}) {
  const linked = costIndex[String(task.taskId || '')] || []
  if (linked.length) return linked.reduce((sum, item) => sum + toNumber(item.actualCost), 0)
  return Math.max(0, toNumber(task.actualProviderCost || task.providerCost || task.aiCost || task.result?.actualProviderCost))
}

function averageHours(items = [], startField = 'createdAt', endField = 'completedAt') {
  const durations = items
    .map((item) => {
      const start = toTime(item[startField] || item.createdAt)
      const end = toTime(item[endField] || item.deliveredAt || item.completedAt || item.updatedAt)
      return start && end && end >= start ? (end - start) / 36e5 : 0
    })
    .filter((value) => value > 0)
  return durations.length ? round(durations.reduce((sum, value) => sum + value, 0) / durations.length, 1) : 0
}

function classifyFeature(metric = {}, usageThreshold = 1) {
  const highUsage = metric.taskCount >= usageThreshold
  const highPass = metric.approvalRate >= 60 || metric.approvedImageCount > 0
  if (highUsage && highPass) return BUSINESS_VALUE_SEGMENTS[0]
  if (highUsage && !highPass) return BUSINESS_VALUE_SEGMENTS[1]
  if (!highUsage && highPass) return BUSINESS_VALUE_SEGMENTS[2]
  return BUSINESS_VALUE_SEGMENTS[3]
}

function buildFeatureMetrics(tasks = [], costRecords = []) {
  const costIndex = buildCostIndex(costRecords)
  const groups = {}
  tasks.forEach((task) => {
    const type = normalizeFunctionType(task)
    if (!groups[type]) groups[type] = []
    groups[type].push(task)
  })
  const counts = Object.values(groups).map((items) => items.length)
  const usageThreshold = Math.max(1, Math.ceil((counts.reduce((sum, value) => sum + value, 0) / Math.max(1, counts.length)) || 1))
  return Object.keys(groups).map((type) => {
    const items = groups[type]
    const success = items.filter(isSuccess)
    const failed = items.filter(isFailed)
    const approved = items.filter(isApprovedTask)
    const generatedImageCount = items.reduce((sum, task) => sum + getOutputCount(task), 0)
    const approvedImageCount = approved.reduce((sum, task) => sum + Math.max(1, getOutputCount(task)), 0)
    const aiCost = items.reduce((sum, task) => sum + getTaskAiCost(task, costIndex), 0)
    const quotaIncome = items.reduce((sum, task) => sum + getQuotaIncome(task), 0)
    const revisionTasks = items.filter((task) => getRevisionCount(task) > 0)
    const deliveredTasks = items.filter((task) => ['delivered', 'confirmed'].includes(String(task.deliveryStatus || '').toLowerCase()))
    const metric = {
      functionType: type,
      taskCount: items.length,
      aiCost: round(aiCost),
      quotaIncome: round(quotaIncome),
      averageTaskCost: round(items.length ? aiCost / items.length : 0),
      effectiveImageCost: round(approvedImageCount ? aiCost / approvedImageCount : 0),
      generatedImageCount,
      approvedImageCount,
      successRate: percent(success.length, items.length),
      failureRate: percent(failed.length, items.length),
      approvalRate: percent(approved.length, Math.max(1, success.length)),
      revisionRate: percent(revisionTasks.length, items.length),
      averageDeliveryHours: averageHours(deliveredTasks),
      repeatGenerateCount: items.reduce((sum, task) => sum + Math.max(0, toNumber(task.regenerateCount || task.retryCount || (task.retryOf ? 1 : 0))), 0),
      customerReuseRate: buildReuseRate(items)
    }
    const segment = classifyFeature(metric, usageThreshold)
    return {
      ...metric,
      segment: segment.key,
      segmentLabel: segment.label,
      recommendedAction: segment.action
    }
  }).sort((left, right) => right.taskCount - left.taskCount)
}

function buildReuseRate(tasks = []) {
  const userMap = {}
  tasks.forEach((task) => {
    const userId = String(task.userId || task.creatorId || task.memberId || '')
    if (!userId) return
    userMap[userId] = (userMap[userId] || 0) + 1
  })
  const users = Object.keys(userMap)
  const reused = users.filter((userId) => userMap[userId] > 1).length
  return percent(reused, users.length)
}

function buildSummary(tasks = [], featureMetrics = [], deliveries = []) {
  const taskCount = tasks.length
  const success = tasks.filter(isSuccess).length
  const approved = tasks.filter(isApprovedTask).length
  const aiCost = featureMetrics.reduce((sum, item) => sum + item.aiCost, 0)
  const quotaIncome = featureMetrics.reduce((sum, item) => sum + item.quotaIncome, 0)
  return {
    taskCount,
    featureCount: featureMetrics.length,
    aiCost: round(aiCost),
    quotaIncome: round(quotaIncome),
    averageTaskCost: round(taskCount ? aiCost / taskCount : 0),
    successRate: percent(success, taskCount),
    approvalRate: percent(approved, Math.max(1, success)),
    deliveryCount: deliveries.length,
    updatedAt: nowIso()
  }
}

function buildValueSegments(featureMetrics = []) {
  return BUSINESS_VALUE_SEGMENTS.map((segment) => ({
    ...segment,
    features: featureMetrics.filter((item) => item.segment === segment.key)
  }))
}

function hasTraditionalBaseline(project = {}) {
  return Boolean(project.traditionalBaselineHours || project.traditionalProductionHours || project.baseline?.traditionalHours)
}

function getTraditionalBaseline(project = {}) {
  return toNumber(project.traditionalBaselineHours || project.traditionalProductionHours || project.baseline?.traditionalHours)
}

function buildProjectMetrics(projects = [], tasks = [], deliveries = [], costRecords = []) {
  const costIndex = buildCostIndex(costRecords)
  return projects.map((project) => {
    const projectId = String(project.projectId || '')
    const projectTasks = tasks.filter((task) => String(task.projectId || '') === projectId || (Array.isArray(project.taskIds) && project.taskIds.includes(task.taskId)))
    const projectDeliveries = deliveries.filter((delivery) => String(delivery.projectId || '') === projectId)
    const generatedImageCount = projectTasks.reduce((sum, task) => sum + getOutputCount(task), 0)
    const approvedImageCount = projectTasks.filter(isApprovedTask).reduce((sum, task) => sum + Math.max(1, getOutputCount(task)), 0)
    const aiCost = projectTasks.reduce((sum, task) => sum + getTaskAiCost(task, costIndex), 0)
    const revisionCount = projectTasks.reduce((sum, task) => sum + getRevisionCount(task), 0)
    const deliveryAssetCount = projectDeliveries.reduce((sum, delivery) => sum + (Array.isArray(delivery.assetIds) ? delivery.assetIds.length : 0), 0)
    const projectCycleHours = averageHours([{ createdAt: project.createdAt, updatedAt: project.completedAt || project.deliveredAt || project.updatedAt }])
    const traditionalBaselineHours = getTraditionalBaseline(project)
    return {
      projectId,
      projectName: project.projectName || project.name || '未命名项目',
      status: project.status || 'unknown',
      owner: project.owner || project.ownerName || project.manager || '未指定',
      taskCount: projectTasks.length,
      generatedImageCount,
      approvedImageCount,
      aiCost: round(aiCost),
      revisionCount,
      projectCycleHours,
      deliveryCount: projectDeliveries.length,
      deliveryAssetCount,
      costPerDeliveredAsset: round(deliveryAssetCount ? aiCost / deliveryAssetCount : 0),
      hasTraditionalBaseline: hasTraditionalBaseline(project),
      traditionalBaselineHours,
      timeComparisonLabel: hasTraditionalBaseline(project)
        ? `传统基准 ${traditionalBaselineHours} 小时，当前周期 ${projectCycleHours} 小时`
        : '暂无真实传统制作基准，不计算节省比例',
      updatedAt: project.updatedAt || project.createdAt || ''
    }
  }).sort((left, right) => String(right.updatedAt).localeCompare(String(left.updatedAt)))
}

function buildPatternMetrics(tasks = [], trainingCenter = {}) {
  const patternTasks = tasks.filter((task) => {
    const type = normalizeFunctionType(task).toLowerCase()
    return PATTERN_TYPES.some((key) => type.includes(key))
  })
  const approved = patternTasks.filter(isApprovedTask)
  const byCategory = {}
  patternTasks.forEach((task) => {
    const category = String(task.category || task.input?.params?.category || task.input?.category || '未分类')
    if (!byCategory[category]) byCategory[category] = { category, total: 0, approved: 0 }
    byCategory[category].total += 1
    if (isApprovedTask(task)) byCategory[category].approved += 1
  })
  const modelMap = {}
  patternTasks.forEach((task) => {
    const modelVersion = String(task.modelVersion || task.modelId || task.result?.modelVersion || 'unknown')
    if (!modelMap[modelVersion]) modelMap[modelVersion] = { modelVersion, taskCount: 0, revisionCount: 0 }
    modelMap[modelVersion].taskCount += 1
    modelMap[modelVersion].revisionCount += getRevisionCount(task)
  })
  const samples = Array.isArray(trainingCenter.samples) ? trainingCenter.samples : []
  return {
    patternTaskCount: patternTasks.length,
    aiDraftToApprovalHours: averageHours(approved, 'createdAt', 'approvedAt'),
    averageRevisionItems: round(patternTasks.length ? patternTasks.reduce((sum, task) => sum + getRevisionCount(task), 0) / patternTasks.length : 0),
    categoryApprovalRates: Object.values(byCategory).map((item) => ({
      ...item,
      approvalRate: percent(item.approved, item.total)
    })),
    patternReuseCount: patternTasks.filter((task) => task.referencePatternId || task.patternMasterId || String(task.source || '').includes('pattern_library')).length,
    libraryTaskSuccessRate: percent(
      patternTasks.filter((task) => (task.referencePatternId || String(task.source || '').includes('pattern_library')) && isSuccess(task)).length,
      patternTasks.filter((task) => task.referencePatternId || String(task.source || '').includes('pattern_library')).length
    ),
    modelRevisionImpact: Object.values(modelMap).map((item) => ({
      ...item,
      averageRevisionItems: round(item.taskCount ? item.revisionCount / item.taskCount : 0)
    })),
    eligibleTrainingSampleCount: samples.filter((item) => item.eligible).length,
    unauthorizedSampleCount: samples.filter((item) => item.authorizationStatus === 'not_authorized').length
  }
}

function buildCostAnomalies(tasks = [], costRecords = []) {
  const anomalies = []
  const costs = costRecords.map((item) => toNumber(item.actualCost)).filter((value) => value > 0)
  const avgCost = costs.length ? costs.reduce((sum, value) => sum + value, 0) / costs.length : 0
  tasks.forEach((task) => {
    const taskId = String(task.taskId || '')
    if (toNumber(task.retryCount || task.regenerateCount) > 1) anomalies.push(makeAnomaly('repeat_generation', 'medium', '重复生成', taskId))
    if (isFailed(task) && toNumber(task.retryCount) > 0) anomalies.push(makeAnomaly('high_retry_failure', 'high', '高频失败重试', taskId))
    if (isSuccess(task) && !hasResultImage(task)) anomalies.push(makeAnomaly('empty_result', 'high', '空结果', taskId))
    if (String(task.errorCode || task.status || '').toLowerCase().includes('timeout')) anomalies.push(makeAnomaly('provider_timeout', 'medium', 'provider超时', taskId))
    if (isSuccess(task) && !isApprovedTask(task) && toTime(task.createdAt) && Date.now() - toTime(task.createdAt) > 7 * 24 * 60 * 60 * 1000) anomalies.push(makeAnomaly('unused_success', 'low', '生成成功但未使用', taskId))
    if (getRevisionCount(task) >= 3) anomalies.push(makeAnomaly('heavy_revision', 'medium', '人工修订过多', taskId))
    if (String(task.quotaStatus || task.errorCode || '').toLowerCase().includes('rollback')) anomalies.push(makeAnomaly('quota_rollback_abnormal', 'high', '额度回滚异常', taskId))
  })
  costRecords.forEach((record) => {
    if (avgCost > 0 && toNumber(record.actualCost) > avgCost * 2) anomalies.push(makeAnomaly('cost_spike', 'medium', '单任务成本突增', record.taskId || record.costRecordId))
  })
  return anomalies
}

function makeAnomaly(type = '', level = 'low', title = '', targetId = '') {
  return {
    anomalyId: `business_${type}_${targetId || 'global'}`,
    type,
    level,
    title,
    targetId,
    createdAt: nowIso()
  }
}

function collectData({ scope = 'enterprise', enterpriseId = '', period = '30d' } = {}) {
  const allTasks = listTasks().filter(isRealBusinessTask)
  const allCostRecords = getCostRecords().filter((record) => {
    const source = String(record.source || record.providerId || '').toLowerCase()
    return !source.includes('mock') && !source.includes('fallback')
  })
  const tasks = filterByScope(allTasks, { scope, enterpriseId, period })
  const costRecords = filterByScope(allCostRecords, { scope, enterpriseId, period })
  const projects = filterByScope(readProjectRecords(), { scope, enterpriseId, period: '90d' })
  const batches = filterByScope(listWorkspaceBatches(), { scope, enterpriseId, period })
  const deliveries = filterByScope(listWorkspaceDeliveries(), { scope, enterpriseId, period })
  return { tasks, costRecords, projects, batches, deliveries }
}

function readProjectRecords() {
  const map = {}
  ;[...safeRead(getLegacyProjects), ...safeRead(getEnterpriseProjects)].forEach((project) => {
    const projectId = String(project.projectId || '')
    if (!projectId) return
    map[projectId] = { ...(map[projectId] || {}), ...project }
  })
  return Object.values(map)
}

function safeRead(reader) {
  try {
    const value = reader()
    return Array.isArray(value) ? value : []
  } catch (error) {
    return []
  }
}

export function loadBusinessMetricsCenter(input = {}) {
  const guard = requirePlatformAdmin()
  if (!guard.allowed) {
    return buildDeniedCenter('platform_admin_required', 'platform')
  }
  const period = input.period || '30d'
  const data = collectData({ scope: 'platform', period })
  const featureMetrics = buildFeatureMetrics(data.tasks, data.costRecords)
  const trainingCenter = loadPatternTrainingCenter({}, {})
  return {
    canAccess: true,
    scope: 'platform',
    period,
    summary: buildSummary(data.tasks, featureMetrics, data.deliveries),
    featureMetrics,
    valueSegments: buildValueSegments(featureMetrics),
    projectMetrics: buildProjectMetrics(data.projects, data.tasks, data.deliveries, data.costRecords),
    patternMetrics: buildPatternMetrics(data.tasks, trainingCenter),
    anomalies: buildCostAnomalies(data.tasks, data.costRecords),
    dataPolicy: buildDataPolicy(data.tasks),
    updatedAt: nowIso()
  }
}

export function loadProjectEfficiencyCenter(input = {}) {
  const guard = requirePermission('analytics.view')
  const enterpriseId = getCurrentEnterpriseId()
  if (!guard.allowed || !enterpriseId) {
    return buildDeniedCenter(guard.reason || 'analytics_permission_required', 'enterprise')
  }
  const period = input.period || '30d'
  const data = collectData({ scope: 'enterprise', enterpriseId, period })
  const featureMetrics = buildFeatureMetrics(data.tasks, data.costRecords)
  const trainingCenter = loadPatternTrainingCenter({}, {})
  return {
    canAccess: true,
    scope: 'enterprise',
    enterpriseId,
    period,
    summary: buildSummary(data.tasks, featureMetrics, data.deliveries),
    featureMetrics,
    valueSegments: buildValueSegments(featureMetrics),
    projectMetrics: buildProjectMetrics(data.projects, data.tasks, data.deliveries, data.costRecords),
    patternMetrics: buildPatternMetrics(data.tasks, trainingCenter),
    anomalies: buildCostAnomalies(data.tasks, data.costRecords),
    dataPolicy: buildDataPolicy(data.tasks),
    updatedAt: nowIso()
  }
}

function buildDeniedCenter(reason = 'forbidden', scope = 'enterprise') {
  return {
    canAccess: false,
    reason,
    scope,
    period: '30d',
    summary: buildSummary([], [], []),
    featureMetrics: [],
    valueSegments: buildValueSegments([]),
    projectMetrics: [],
    patternMetrics: buildPatternMetrics([]),
    anomalies: [],
    dataPolicy: buildDataPolicy([]),
    updatedAt: nowIso()
  }
}

function buildDataPolicy(tasks = []) {
  return {
    realTaskCount: tasks.length,
    excludesMock: true,
    excludesFallback: true,
    excludesDevelopmentTests: true,
    traditionalBaselineRequired: true,
    message: '仅统计真实任务、真实成本和真实交付数据；无传统制作基准时不计算节省比例。'
  }
}
