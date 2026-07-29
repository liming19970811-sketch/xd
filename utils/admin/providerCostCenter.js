import { get, set } from '../data-provider/dataProvider.js'
import { getCurrentMember } from '../auth/authRepository.js'
import { hasPermission } from '../auth/permissionService.js'
import { listTasks } from '../task/taskLayer.js'
import { recordAudit } from '../audit/auditService.js'

const PROVIDER_KEY = 'diebians_ai_provider_configs_v1'
const MODEL_KEY = 'diebians_ai_provider_models_v1'
const ROUTING_KEY = 'diebians_ai_provider_routing_rules_v1'
const COST_KEY = 'diebians_ai_provider_cost_records_v1'
const ALERT_KEY = 'diebians_ai_provider_alerts_v1'

export const PROVIDER_CAPABILITIES = Object.freeze([
  { key: 'model_replace', label: '换模特' },
  { key: 'clothing_replace', label: '上下装分开换衣' },
  { key: 'accessory_replace', label: '配饰替换' },
  { key: 'color_change', label: '换色' },
  { key: 'scene_change', label: '换场景' },
  { key: 'style_refine', label: '改款' },
  { key: 'fabric_change', label: '换面料' },
  { key: 'pattern_change', label: '换图案' },
  { key: 'technical_drawing', label: '结构图生成' },
  { key: 'batch_generate', label: '批量任务' }
])

export const PROVIDER_STATUSES = Object.freeze(['active', 'paused', 'degraded', 'disabled'])
export const MODEL_STATUSES = Object.freeze(['approved', 'active', 'gray', 'paused', 'deprecated'])
export const ROUTE_STATUSES = Object.freeze(['draft', 'active', 'paused', 'archived'])

function nowIso() {
  return new Date().toISOString()
}

function createId(prefix = 'id') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

function readArray(key) {
  const value = get(key, [])
  return Array.isArray(value) ? value : []
}

function writeArray(key, value = []) {
  set(key, Array.isArray(value) ? value : [])
}

function currentMember() {
  return getCurrentMember() || {}
}

function canAccessProviderCenter() {
  const member = currentMember()
  const role = String(member.role || member.roleId || '').toLowerCase()
  if (!member || member.status !== 'active') return false
  if (hasPermission('settings.manage', { member }) || hasPermission('analytics.view', { member })) return true
  return ['platform_admin', 'super_admin', 'admin', 'tech', 'ops', 'algorithm', '技术', '算法', '平台管理员'].some((item) => role.includes(item))
}

function audit(action = '', targetType = 'ai_provider', targetId = '', after = {}) {
  const member = currentMember()
  recordAudit({
    enterpriseId: 'platform',
    userId: member.userId || member.memberId || '',
    operatorId: member.memberId || member.userId || '',
    operator: member.name || member.role || '平台管理员',
    action,
    targetType,
    targetId,
    resourceType: targetType,
    resourceId: targetId,
    after,
    createdAt: nowIso()
  })
}

function defaultProviders() {
  return [
    {
      providerId: 'wanx_dashscope',
      name: '通义万相 Wanx',
      supportedFunctions: ['model_replace', 'color_change', 'scene_change', 'style_refine', 'batch_generate'],
      supportedInputTypes: ['image_url', 'cloud_file_id', 'prompt'],
      maxReferenceImages: 1,
      asyncTask: true,
      timeoutMs: 60000,
      retryRule: { maxRetries: 1, retryOn: ['network', '429', '5xx'], maxTotalMs: 120000, highCostAutoRetry: false },
      status: 'active',
      environments: ['development', 'staging'],
      secretStorage: 'server_env',
      secretEnvNames: ['DASHSCOPE_API_KEY', 'AI_API_KEY'],
      createdAt: '2026-07-28T00:00:00.000Z',
      updatedAt: '2026-07-28T00:00:00.000Z'
    },
    {
      providerId: 'development_mock',
      name: '开发 Mock',
      supportedFunctions: ['model_replace', 'color_change', 'scene_change', 'style_refine', 'batch_generate'],
      supportedInputTypes: ['image_url', 'prompt'],
      maxReferenceImages: 3,
      asyncTask: false,
      timeoutMs: 5000,
      retryRule: { maxRetries: 0, retryOn: [], maxTotalMs: 5000, highCostAutoRetry: false },
      status: 'disabled',
      environments: ['development'],
      secretStorage: 'none',
      secretEnvNames: [],
      createdAt: '2026-07-28T00:00:00.000Z',
      updatedAt: '2026-07-28T00:00:00.000Z'
    }
  ]
}

function normalizeProvider(provider = {}) {
  return {
    providerId: String(provider.providerId || ''),
    name: String(provider.name || '未命名供应商'),
    supportedFunctions: Array.isArray(provider.supportedFunctions) ? provider.supportedFunctions.map(String) : [],
    supportedInputTypes: Array.isArray(provider.supportedInputTypes) ? provider.supportedInputTypes.map(String) : [],
    maxReferenceImages: Math.max(0, Number(provider.maxReferenceImages) || 0),
    asyncTask: Boolean(provider.asyncTask),
    timeoutMs: Math.max(1000, Number(provider.timeoutMs) || 30000),
    retryRule: {
      maxRetries: Math.max(0, Number(provider.retryRule?.maxRetries) || 0),
      retryOn: Array.isArray(provider.retryRule?.retryOn) ? provider.retryRule.retryOn.map(String) : [],
      maxTotalMs: Math.max(1000, Number(provider.retryRule?.maxTotalMs) || 60000),
      highCostAutoRetry: Boolean(provider.retryRule?.highCostAutoRetry)
    },
    status: PROVIDER_STATUSES.includes(provider.status) ? provider.status : 'paused',
    environments: Array.isArray(provider.environments) ? provider.environments.map(String) : ['development'],
    secretStorage: 'server_env',
    secretEnvNames: Array.isArray(provider.secretEnvNames) ? provider.secretEnvNames.map(String) : [],
    createdAt: provider.createdAt || nowIso(),
    updatedAt: provider.updatedAt || provider.createdAt || nowIso()
  }
}

function defaultModels() {
  return [
    {
      modelId: 'wanx-v1-image2image',
      providerId: 'wanx_dashscope',
      name: 'Wanx v1 图生图',
      modelVersion: 'wanx-v1',
      capabilities: ['model_replace', 'color_change', 'scene_change', 'style_refine'],
      cost: { estimatePerInput: 1, estimatePerOutput: 1, currency: 'internal_unit' },
      status: 'approved',
      qualityModes: ['standard'],
      createdAt: '2026-07-28T00:00:00.000Z',
      updatedAt: '2026-07-28T00:00:00.000Z'
    },
    {
      modelId: 'mock-image-dev',
      providerId: 'development_mock',
      name: '开发 Mock 出图',
      modelVersion: 'mock-dev',
      capabilities: ['model_replace', 'color_change', 'scene_change', 'style_refine', 'batch_generate'],
      cost: { estimatePerInput: 0, estimatePerOutput: 0, currency: 'none' },
      status: 'paused',
      qualityModes: ['development'],
      createdAt: '2026-07-28T00:00:00.000Z',
      updatedAt: '2026-07-28T00:00:00.000Z'
    }
  ]
}

function normalizeModel(model = {}) {
  return {
    modelId: String(model.modelId || ''),
    providerId: String(model.providerId || ''),
    name: String(model.name || '未命名模型'),
    modelVersion: String(model.modelVersion || ''),
    capabilities: Array.isArray(model.capabilities) ? model.capabilities.map(String) : [],
    cost: {
      estimatePerInput: Math.max(0, Number(model.cost?.estimatePerInput) || 0),
      estimatePerOutput: Math.max(0, Number(model.cost?.estimatePerOutput) || 0),
      currency: String(model.cost?.currency || 'internal_unit')
    },
    status: MODEL_STATUSES.includes(model.status) ? model.status : 'paused',
    qualityModes: Array.isArray(model.qualityModes) ? model.qualityModes.map(String) : ['standard'],
    createdAt: model.createdAt || nowIso(),
    updatedAt: model.updatedAt || model.createdAt || nowIso()
  }
}

function defaultRoutes() {
  return [
    {
      ruleId: 'route_standard_image_wanx_v1',
      version: '2026.07.28',
      name: '标准服装出图路由',
      functionTypes: ['model_replace', 'color_change', 'scene_change', 'style_refine'],
      categoryRules: ['女装', '男装', '童装', '通用'],
      qualityModes: ['standard'],
      enterpriseTiers: ['trial', 'personal_pro', 'enterprise'],
      grayScope: { enabled: false, enterpriseIds: [], accountIds: [], percent: 0 },
      maxReferenceImages: 1,
      costCeiling: 5,
      providerId: 'wanx_dashscope',
      modelId: 'wanx-v1-image2image',
      fallbackProviderId: '',
      status: 'active',
      reason: '标准图生图能力优先使用 Wanx，异步 taskId 进入轮询，不降级提交 mock。',
      createdAt: '2026-07-28T00:00:00.000Z',
      updatedAt: '2026-07-28T00:00:00.000Z'
    }
  ]
}

function normalizeRoute(rule = {}) {
  return {
    ruleId: String(rule.ruleId || ''),
    version: String(rule.version || 'draft'),
    name: String(rule.name || '未命名路由规则'),
    functionTypes: Array.isArray(rule.functionTypes) ? rule.functionTypes.map(String) : [],
    categoryRules: Array.isArray(rule.categoryRules) ? rule.categoryRules.map(String) : [],
    qualityModes: Array.isArray(rule.qualityModes) ? rule.qualityModes.map(String) : [],
    enterpriseTiers: Array.isArray(rule.enterpriseTiers) ? rule.enterpriseTiers.map(String) : [],
    grayScope: {
      enabled: Boolean(rule.grayScope?.enabled),
      enterpriseIds: Array.isArray(rule.grayScope?.enterpriseIds) ? rule.grayScope.enterpriseIds.map(String) : [],
      accountIds: Array.isArray(rule.grayScope?.accountIds) ? rule.grayScope.accountIds.map(String) : [],
      percent: Math.min(100, Math.max(0, Number(rule.grayScope?.percent) || 0))
    },
    maxReferenceImages: Math.max(0, Number(rule.maxReferenceImages) || 0),
    costCeiling: Math.max(0, Number(rule.costCeiling) || 0),
    providerId: String(rule.providerId || ''),
    modelId: String(rule.modelId || ''),
    fallbackProviderId: String(rule.fallbackProviderId || ''),
    status: ROUTE_STATUSES.includes(rule.status) ? rule.status : 'draft',
    reason: String(rule.reason || ''),
    createdAt: rule.createdAt || nowIso(),
    updatedAt: rule.updatedAt || rule.createdAt || nowIso()
  }
}

function ensureSeeded(key, factory, normalizer) {
  const stored = readArray(key)
  if (stored.length) return stored.map(normalizer)
  const initial = factory().map(normalizer)
  writeArray(key, initial)
  return initial
}

export function getProviders() {
  return ensureSeeded(PROVIDER_KEY, defaultProviders, normalizeProvider)
}

export function getProviderModels() {
  return ensureSeeded(MODEL_KEY, defaultModels, normalizeModel)
}

export function getRoutingRules() {
  return ensureSeeded(ROUTING_KEY, defaultRoutes, normalizeRoute)
}

export function saveProviderStatus(providerId = '', status = 'paused') {
  if (!canAccessProviderCenter()) return { success: false, errorCode: 'forbidden' }
  if (!PROVIDER_STATUSES.includes(status)) return { success: false, errorCode: 'invalid_status' }
  const providers = getProviders()
  const target = providers.find((provider) => provider.providerId === providerId)
  if (!target) return { success: false, errorCode: 'provider_not_found' }
  const next = normalizeProvider({ ...target, status, updatedAt: nowIso() })
  writeArray(PROVIDER_KEY, providers.map((provider) => provider.providerId === providerId ? next : provider))
  audit('更新供应商状态', 'ai_provider', providerId, { status })
  return { success: true, provider: next }
}

export function saveRouteStatus(ruleId = '', status = 'paused') {
  if (!canAccessProviderCenter()) return { success: false, errorCode: 'forbidden' }
  if (!ROUTE_STATUSES.includes(status)) return { success: false, errorCode: 'invalid_status' }
  const rules = getRoutingRules()
  const target = rules.find((rule) => rule.ruleId === ruleId)
  if (!target) return { success: false, errorCode: 'route_not_found' }
  const next = normalizeRoute({ ...target, status, updatedAt: nowIso() })
  writeArray(ROUTING_KEY, rules.map((rule) => rule.ruleId === ruleId ? next : rule))
  audit('更新任务路由状态', 'ai_routing_rule', ruleId, { status })
  return { success: true, rule: next }
}

export function validateProviderCapability(input = {}) {
  const functionType = String(input.functionType || input.type || '')
  const referenceImageCount = Math.max(0, Number(input.referenceImageCount || input.imageCount || 0))
  const providers = getProviders()
  const models = getProviderModels()
  const rules = getRoutingRules().filter((rule) => rule.status === 'active')
  const candidates = rules.filter((rule) => {
    if (functionType && !rule.functionTypes.includes(functionType)) return false
    if (referenceImageCount > rule.maxReferenceImages) return false
    const provider = providers.find((item) => item.providerId === rule.providerId)
    const model = models.find((item) => item.modelId === rule.modelId)
    if (!provider || provider.status !== 'active') return false
    if (!model || !['approved', 'active', 'gray'].includes(model.status)) return false
    if (!provider.supportedFunctions.includes(functionType)) return false
    if (!model.capabilities.includes(functionType)) return false
    return true
  })
  if (!candidates.length) {
    return {
      allowed: false,
      errorCode: 'capability_not_supported',
      message: '当前供应商或模型不支持该功能，任务创建前应被阻止。',
      functionType
    }
  }
  const rule = candidates[0]
  const model = models.find((item) => item.modelId === rule.modelId)
  const provider = providers.find((item) => item.providerId === rule.providerId)
  return {
    allowed: true,
    providerId: provider.providerId,
    modelId: model.modelId,
    routingRuleVersion: rule.version,
    reason: rule.reason || '命中已启用路由规则'
  }
}

function normalizeCostRecord(record = {}) {
  return {
    costRecordId: String(record.costRecordId || ''),
    providerId: String(record.providerId || ''),
    modelId: String(record.modelId || ''),
    functionType: String(record.functionType || record.type || ''),
    inputCount: Math.max(0, Number(record.inputCount) || 0),
    outputCount: Math.max(0, Number(record.outputCount) || 0),
    estimatedCost: Math.max(0, Number(record.estimatedCost) || 0),
    actualCost: Math.max(0, Number(record.actualCost) || 0),
    taskId: String(record.taskId || ''),
    enterpriseId: String(record.enterpriseId || ''),
    status: String(record.status || 'pending'),
    retryCount: Math.max(0, Number(record.retryCount) || 0),
    durationMs: Math.max(0, Number(record.durationMs) || 0),
    createdAt: record.createdAt || nowIso()
  }
}

export function recordProviderCost(input = {}) {
  if (!canAccessProviderCenter()) return { success: false, errorCode: 'forbidden' }
  const record = normalizeCostRecord({
    ...input,
    costRecordId: input.costRecordId || createId('provider_cost'),
    createdAt: input.createdAt || nowIso()
  })
  writeArray(COST_KEY, [record, ...readArray(COST_KEY).map(normalizeCostRecord)])
  audit('记录供应商调用成本', 'ai_provider_cost', record.costRecordId, {
    providerId: record.providerId,
    modelId: record.modelId,
    taskId: record.taskId,
    status: record.status
  })
  return { success: true, record }
}

function taskToCostRecord(task = {}) {
  const result = task.result || {}
  return normalizeCostRecord({
    costRecordId: `task_cost_${task.taskId}`,
    providerId: task.provider || result.provider || result.meta?.provider || '',
    modelId: task.modelId || task.modelVersion || result.modelId || result.meta?.modelId || '',
    functionType: task.type || task.taskType || task.input?.type || '',
    inputCount: Number(task.inputCount || task.input?.images?.length || (task.input?.imageUrl ? 1 : 0)) || 0,
    outputCount: Number(task.outputCount || result.items?.length || (task.resultImageUrl || result.image ? 1 : 0)) || 0,
    estimatedCost: Number(task.estimatedProviderCost || task.cost || 0) || 0,
    actualCost: Number(task.actualProviderCost || task.cost || 0) || 0,
    taskId: task.taskId || '',
    enterpriseId: task.enterpriseId || '',
    status: task.status || '',
    retryCount: Number(task.retryCount || 0) || 0,
    durationMs: Number(task.durationMs || result.durationMs || 0) || 0,
    createdAt: task.createdAt || task.updatedAt || nowIso()
  })
}

export function getCostRecords() {
  const own = readArray(COST_KEY).map(normalizeCostRecord)
  const fromTasks = listTasks()
    .filter((task) => task.provider || task.modelId || task.modelVersion || task.actualProviderCost || task.estimatedProviderCost)
    .map(taskToCostRecord)
  const map = {}
  ;[...own, ...fromTasks].forEach((record) => {
    if (record.costRecordId) map[record.costRecordId] = record
  })
  return Object.values(map).sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt)))
}

function buildMonitoring(costRecords = [], providers = []) {
  const total = costRecords.length
  const success = costRecords.filter((item) => ['success', 'completed'].includes(item.status)).length
  const failed = costRecords.filter((item) => ['failed', 'timeout'].includes(item.status)).length
  const timeout = costRecords.filter((item) => item.status === 'timeout').length
  const retry = costRecords.filter((item) => item.retryCount > 0).length
  const empty = costRecords.filter((item) => ['success', 'completed'].includes(item.status) && item.outputCount === 0).length
  const averageDurationMs = total ? Math.round(costRecords.reduce((sum, item) => sum + item.durationMs, 0) / total) : 0
  const totalCost = costRecords.reduce((sum, item) => sum + item.actualCost, 0)
  return {
    total,
    successRate: total ? Math.round((success / total) * 100) : 0,
    failureRate: total ? Math.round((failed / total) * 100) : 0,
    timeoutRate: total ? Math.round((timeout / total) * 100) : 0,
    retryCount: retry,
    emptyResultRate: total ? Math.round((empty / total) * 100) : 0,
    averageDurationMs,
    totalCost,
    providerPausedCount: providers.filter((item) => ['paused', 'disabled'].includes(item.status)).length,
    asyncBacklog: costRecords.filter((item) => item.status === 'processing' && item.createdAt && Date.now() - new Date(item.createdAt).getTime() > 1000 * 60 * 20).length
  }
}

function buildAlerts(monitoring = {}, providers = []) {
  const alerts = []
  const add = (type, level, title, description, targetId = '') => {
    alerts.push({
      alertId: `provider_alert_${type}_${targetId || 'global'}`,
      type,
      level,
      targetId,
      title,
      description,
      status: 'open',
      createdAt: nowIso()
    })
  }
  if (monitoring.total && monitoring.successRate < 70) add('success_rate', 'high', '成功率下降', `当前成功率 ${monitoring.successRate}%`)
  if (monitoring.timeoutRate >= 20) add('timeout', 'medium', '超时率升高', `当前超时率 ${monitoring.timeoutRate}%`)
  if (monitoring.emptyResultRate > 0) add('empty_result', 'high', '空结果增加', `空结果率 ${monitoring.emptyResultRate}%`)
  if (monitoring.asyncBacklog > 0) add('async_backlog', 'medium', '异步任务积压', `${monitoring.asyncBacklog} 条任务处理超过 20 分钟`)
  providers.filter((provider) => provider.status === 'degraded').forEach((provider) => add('provider_degraded', 'medium', '供应商降级', `${provider.name} 当前处于降级状态`, provider.providerId))
  return alerts
}

export function loadProviderCostCenter() {
  const access = canAccessProviderCenter()
  if (!access) {
    return {
      canAccess: false,
      reason: 'platform_admin_or_tech_required',
      providers: [],
      models: [],
      routes: [],
      costs: [],
      monitoring: buildMonitoring([]),
      alerts: [],
      capabilityMatrix: [],
      updatedAt: nowIso()
    }
  }
  const providers = getProviders()
  const models = getProviderModels()
  const routes = getRoutingRules()
  const costs = getCostRecords()
  const monitoring = buildMonitoring(costs, providers)
  const storedAlerts = readArray(ALERT_KEY)
  const autoAlerts = buildAlerts(monitoring, providers)
  const alertMap = {}
  ;[...autoAlerts, ...storedAlerts].forEach((item) => {
    alertMap[item.alertId] = item
  })
  const capabilityMatrix = PROVIDER_CAPABILITIES.map((capability) => ({
    ...capability,
    providers: providers.map((provider) => ({
      providerId: provider.providerId,
      name: provider.name,
      supported: provider.supportedFunctions.includes(capability.key),
      models: models.filter((model) => model.providerId === provider.providerId && model.capabilities.includes(capability.key)).map((model) => model.modelId)
    }))
  }))
  return {
    canAccess: true,
    reason: '',
    providers,
    models,
    routes,
    costs,
    monitoring,
    alerts: Object.values(alertMap).sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt))),
    capabilityMatrix,
    updatedAt: nowIso()
  }
}

export function resolveProviderAlert(alertId = '') {
  if (!canAccessProviderCenter()) return { success: false, errorCode: 'forbidden' }
  const current = readArray(ALERT_KEY)
  const existing = current.find((item) => item.alertId === alertId) || { alertId, type: 'manual', level: 'low', title: '手动处理告警' }
  const next = { ...existing, status: 'resolved', updatedAt: nowIso() }
  writeArray(ALERT_KEY, [next, ...current.filter((item) => item.alertId !== alertId)])
  audit('处理供应商告警', 'ai_provider_alert', alertId, { status: 'resolved' })
  return { success: true, alert: next }
}
