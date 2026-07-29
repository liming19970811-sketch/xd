import { get, set } from '../data-provider/dataProvider.js'
import { getCurrentMember } from '../auth/authRepository.js'
import { requirePlatformAdmin } from './platformAdminRepository.js'
import { writeStructuredLog } from '../observability/traceLogger.js'

const RELEASE_KEY = 'diebians_release_control_releases_v1'
const FLAG_KEY = 'diebians_release_control_flags_v1'
const ENV_KEY = 'diebians_release_control_environments_v1'
const AUDIT_KEY = 'diebians_release_control_audit_v1'

export const RELEASE_MODULES = Object.freeze(['website', 'miniapp', 'admin', 'ai_service'])
export const RELEASE_STATUSES = Object.freeze(['draft', 'testing', 'staging_verified', 'approved', 'gray_running', 'released', 'rolled_back'])
export const FEATURE_FLAG_STATUSES = Object.freeze(['enabled', 'disabled', 'gray'])
export const GRAY_DIMENSIONS = Object.freeze(['environment', 'users', 'enterprises', 'roles', 'plans', 'functionTypes', 'trafficRatio', 'timeWindow'])

export const FEATURE_FLAGS = Object.freeze([
  { key: 'ai_output', label: 'AI 出图功能', module: 'ai_service' },
  { key: 'pattern_making', label: 'AI 制版功能', module: 'ai_service' },
  { key: 'pattern_library', label: '版型库功能', module: 'website' },
  { key: 'batch_tasks', label: '批量任务', module: 'website' },
  { key: 'enterprise_collaboration', label: '企业协作', module: 'website' },
  { key: 'developer_api', label: 'API 开放平台', module: 'ai_service' },
  { key: 'training_evaluation', label: '训练与模型评估', module: 'admin' },
  { key: 'new_workspace_ui', label: '新版页面与组件', module: 'website' }
])

export const FORBIDDEN_COMBINATIONS = Object.freeze([
  {
    comboId: 'real_quota_with_mock_generation',
    title: '真实扣费不能搭配 mock 生成',
    severity: 'critical',
    when: (config) => config.realQuota === true && config.mockGeneration === true
  },
  {
    comboId: 'formal_delivery_with_fallback',
    title: '正式交付不能使用 fallback 结果',
    severity: 'critical',
    when: (config) => config.formalDelivery === true && config.fallbackResult === true
  },
  {
    comboId: 'unreviewed_pattern_production',
    title: '未审核版型不能标记生产可用',
    severity: 'high',
    when: (config) => config.patternProductionReady === true && config.patternReviewed !== true
  },
  {
    comboId: 'training_with_unauthorized_data',
    title: '训练数据启用前必须确认授权',
    severity: 'critical',
    when: (config) => config.trainingEnabled === true && config.trainingAuthorized !== true
  },
  {
    comboId: 'provider_without_quota_idempotency',
    title: '真实 provider 调用必须具备额度幂等',
    severity: 'critical',
    when: (config) => config.realProviderCall === true && config.quotaIdempotency !== true
  },
  {
    comboId: 'admin_without_permission_guard',
    title: '管理后台开放时权限校验不能关闭',
    severity: 'critical',
    when: (config) => config.adminOpen === true && config.permissionGuard !== true
  }
])

function nowIso() {
  return new Date().toISOString()
}

function createId(prefix = 'id') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

function readList(key = '') {
  const value = get(key, [])
  return Array.isArray(value) ? value : []
}

function writeList(key = '', value = []) {
  set(key, Array.isArray(value) ? value : [])
}

function currentOperator() {
  const member = getCurrentMember() || {}
  return {
    operatorId: member.memberId || member.userId || '',
    operatorName: member.name || member.role || 'platform_admin'
  }
}

function writeReleaseAudit(action = '', resourceId = '', before = null, after = {}, reason = '') {
  const operator = currentOperator()
  const record = {
    auditId: createId('release_audit'),
    action,
    resourceType: 'release_control',
    resourceId,
    before,
    after,
    scope: after.scope || after.grayScope || after.environment || '',
    reason,
    approver: after.approver || after.approvedBy || '',
    publishedAt: after.publishedAt || '',
    rollbackResult: after.rollbackResult || '',
    operatorId: operator.operatorId,
    operatorName: operator.operatorName,
    createdAt: nowIso()
  }
  writeList(AUDIT_KEY, [record, ...readList(AUDIT_KEY)].slice(0, 1000))
  writeStructuredLog({
    level: action.includes('blocked') ? 'warn' : 'info',
    module: 'admin',
    action: `release_control_${action}`,
    status: 'success',
    data: { resourceId, reason }
  })
  return record
}

function defaultEnvironments() {
  return [
    {
      environmentId: 'development',
      name: 'development',
      label: '本地开发',
      status: 'active',
      apiBase: 'local',
      cloudEnvId: 'cloudbase-d8ghr94wg306011e0',
      mockAllowed: true,
      realProviderAllowed: false,
      productionSafety: false,
      configVersion: 'dev-1',
      updatedAt: nowIso()
    },
    {
      environmentId: 'staging',
      name: 'staging',
      label: '预发布验收',
      status: 'active',
      apiBase: 'staging',
      cloudEnvId: 'cloudbase-d8ghr94wg306011e0',
      mockAllowed: false,
      realProviderAllowed: true,
      productionSafety: true,
      configVersion: 'staging-1',
      updatedAt: nowIso()
    },
    {
      environmentId: 'production',
      name: 'production',
      label: '正式网站',
      status: 'active',
      apiBase: 'production',
      cloudEnvId: 'cloudbase-d8ghr94wg306011e0',
      mockAllowed: false,
      realProviderAllowed: true,
      productionSafety: true,
      configVersion: 'prod-1',
      updatedAt: nowIso()
    }
  ]
}

function normalizeScope(scope = {}) {
  return {
    environments: Array.isArray(scope.environments) ? scope.environments.map(String) : [],
    userIds: Array.isArray(scope.userIds) ? scope.userIds.map(String) : [],
    enterpriseIds: Array.isArray(scope.enterpriseIds) ? scope.enterpriseIds.map(String) : [],
    roles: Array.isArray(scope.roles) ? scope.roles.map(String) : [],
    plans: Array.isArray(scope.plans) ? scope.plans.map(String) : [],
    functionTypes: Array.isArray(scope.functionTypes) ? scope.functionTypes.map(String) : [],
    trafficRatio: Math.max(0, Math.min(100, Number(scope.trafficRatio || 0))),
    startAt: scope.startAt || '',
    endAt: scope.endAt || ''
  }
}

function normalizeFlag(record = {}) {
  const base = FEATURE_FLAGS.find((item) => item.key === record.flagKey) || {}
  return {
    flagKey: String(record.flagKey || base.key || ''),
    name: String(record.name || base.label || '未命名功能'),
    module: String(record.module || base.module || 'website'),
    status: FEATURE_FLAG_STATUSES.includes(record.status) ? record.status : 'disabled',
    emergencyOff: Boolean(record.emergencyOff),
    defaultEnabled: Boolean(record.defaultEnabled),
    environmentOverrides: record.environmentOverrides && typeof record.environmentOverrides === 'object' ? record.environmentOverrides : {},
    enterpriseOverrides: record.enterpriseOverrides && typeof record.enterpriseOverrides === 'object' ? record.enterpriseOverrides : {},
    grayScope: normalizeScope(record.grayScope || {}),
    disabledMessage: String(record.disabledMessage || '该功能暂未开放，请联系管理员。'),
    owner: String(record.owner || 'platform'),
    reason: String(record.reason || ''),
    configVersion: String(record.configVersion || 'flag-v1'),
    updatedAt: record.updatedAt || nowIso()
  }
}

function normalizeRelease(record = {}) {
  return {
    releaseId: String(record.releaseId || createId('release')),
    version: String(record.version || '0.0.0'),
    gitCommit: String(record.gitCommit || ''),
    environment: String(record.environment || 'staging'),
    modules: Array.isArray(record.modules) ? record.modules.filter((item) => RELEASE_MODULES.includes(item)) : ['website'],
    summary: String(record.summary || ''),
    migrationVersion: String(record.migrationVersion || ''),
    configVersion: String(record.configVersion || ''),
    publisher: String(record.publisher || currentOperator().operatorName),
    publishedAt: record.publishedAt || '',
    acceptanceReport: String(record.acceptanceReport || ''),
    rollbackVersion: String(record.rollbackVersion || ''),
    rollbackResult: String(record.rollbackResult || ''),
    status: RELEASE_STATUSES.includes(record.status) ? record.status : 'draft',
    approval: {
      required: record.approval?.required !== false,
      approvedBy: String(record.approval?.approvedBy || ''),
      approvedAt: record.approval?.approvedAt || '',
      reason: String(record.approval?.reason || '')
    },
    grayScope: normalizeScope(record.grayScope || { trafficRatio: 1 }),
    safetyConfig: {
      realQuota: Boolean(record.safetyConfig?.realQuota),
      mockGeneration: Boolean(record.safetyConfig?.mockGeneration),
      formalDelivery: Boolean(record.safetyConfig?.formalDelivery),
      fallbackResult: Boolean(record.safetyConfig?.fallbackResult),
      patternProductionReady: Boolean(record.safetyConfig?.patternProductionReady),
      patternReviewed: Boolean(record.safetyConfig?.patternReviewed),
      trainingEnabled: Boolean(record.safetyConfig?.trainingEnabled),
      trainingAuthorized: Boolean(record.safetyConfig?.trainingAuthorized),
      realProviderCall: Boolean(record.safetyConfig?.realProviderCall),
      quotaIdempotency: record.safetyConfig?.quotaIdempotency !== false,
      adminOpen: Boolean(record.safetyConfig?.adminOpen),
      permissionGuard: record.safetyConfig?.permissionGuard !== false
    },
    createdAt: record.createdAt || nowIso(),
    updatedAt: record.updatedAt || record.createdAt || nowIso()
  }
}

function getFlags() {
  const stored = readList(FLAG_KEY)
  if (stored.length) return stored.map(normalizeFlag)
  const seeded = FEATURE_FLAGS.map((item) => normalizeFlag({
    flagKey: item.key,
    name: item.label,
    module: item.module,
    status: item.key === 'training_evaluation' || item.key === 'developer_api' ? 'gray' : 'enabled',
    defaultEnabled: !['training_evaluation', 'developer_api'].includes(item.key),
    grayScope: { environments: ['development', 'staging'], trafficRatio: item.key === 'developer_api' ? 5 : 1 },
    reason: 'V1 默认受控配置'
  }))
  writeList(FLAG_KEY, seeded)
  return seeded
}

function getReleases() {
  return readList(RELEASE_KEY).map(normalizeRelease)
}

function getEnvironments() {
  const stored = readList(ENV_KEY)
  if (stored.length) return stored
  const seeded = defaultEnvironments()
  writeList(ENV_KEY, seeded)
  return seeded
}

function hashToPercent(value = '') {
  const text = String(value || '')
  let hash = 0
  for (let index = 0; index < text.length; index += 1) hash = ((hash << 5) - hash + text.charCodeAt(index)) | 0
  return Math.abs(hash) % 100
}

function inTimeWindow(scope = {}, now = Date.now()) {
  const start = scope.startAt ? new Date(scope.startAt).getTime() : 0
  const end = scope.endAt ? new Date(scope.endAt).getTime() : 0
  if (start && now < start) return false
  if (end && now > end) return false
  return true
}

function includesOrEmpty(list = [], value = '') {
  return !list.length || list.includes(String(value || ''))
}

export function validateForbiddenCombinations(config = {}) {
  return FORBIDDEN_COMBINATIONS
    .filter((rule) => {
      try {
        return rule.when(config)
      } catch (error) {
        return false
      }
    })
    .map((rule) => ({
      comboId: rule.comboId,
      title: rule.title,
      severity: rule.severity
    }))
}

export function evaluateFeatureFlag(flagKey = '', context = {}) {
  const flag = getFlags().find((item) => item.flagKey === flagKey)
  if (!flag) {
    return { enabled: false, reason: 'flag_not_found', source: 'default_config', message: '功能开关不存在。' }
  }
  if (flag.emergencyOff) {
    return { enabled: false, reason: 'emergency_global_off', source: 'emergency', message: flag.disabledMessage }
  }
  const environment = String(context.environment || 'development')
  if (Object.prototype.hasOwnProperty.call(flag.environmentOverrides, environment)) {
    const enabled = Boolean(flag.environmentOverrides[environment])
    return { enabled, reason: `environment:${environment}`, source: 'environment_config', message: enabled ? '' : flag.disabledMessage }
  }
  const enterpriseId = String(context.enterpriseId || '')
  if (enterpriseId && Object.prototype.hasOwnProperty.call(flag.enterpriseOverrides, enterpriseId)) {
    const enabled = Boolean(flag.enterpriseOverrides[enterpriseId])
    return { enabled, reason: `enterprise:${enterpriseId}`, source: 'enterprise_config', message: enabled ? '' : flag.disabledMessage }
  }
  const scope = flag.grayScope || {}
  const userId = String(context.userId || '')
  const hitUser = userId && scope.userIds.includes(userId)
  const hitEnterprise = enterpriseId && scope.enterpriseIds.includes(enterpriseId)
  const hitRole = includesOrEmpty(scope.roles, context.role)
  const hitPlan = includesOrEmpty(scope.plans, context.plan)
  const hitFunction = includesOrEmpty(scope.functionTypes, context.functionType)
  const hitEnvironment = includesOrEmpty(scope.environments, environment)
  const hitRatio = Number(scope.trafficRatio || 0) > 0 && hashToPercent(`${flagKey}:${userId || enterpriseId || environment}`) < Number(scope.trafficRatio || 0)
  if (flag.status === 'gray' && inTimeWindow(scope) && hitEnvironment && hitRole && hitPlan && hitFunction && (hitUser || hitEnterprise || hitRatio)) {
    return { enabled: true, reason: 'gray_scope_matched', source: 'user_gray', message: '' }
  }
  if (flag.status === 'enabled' && flag.defaultEnabled) {
    return { enabled: true, reason: 'default_enabled', source: 'default_config', message: '' }
  }
  return { enabled: false, reason: flag.status === 'disabled' ? 'flag_disabled' : 'gray_scope_not_matched', source: 'default_config', message: flag.disabledMessage }
}

export function updateFeatureFlag(flagKey = '', patch = {}) {
  const guard = requirePlatformAdmin()
  if (!guard.allowed) return { success: false, errorCode: 'platform_admin_required' }
  const flags = getFlags()
  const existing = flags.find((item) => item.flagKey === flagKey)
  if (!existing) return { success: false, errorCode: 'flag_not_found' }
  const next = normalizeFlag({ ...existing, ...patch, flagKey, updatedAt: nowIso() })
  writeList(FLAG_KEY, flags.map((item) => item.flagKey === flagKey ? next : item))
  writeReleaseAudit('feature_flag_updated', flagKey, existing, next, patch.reason || next.reason)
  return { success: true, flag: next }
}

export function emergencyCloseFeature(flagKey = '', reason = '紧急关闭') {
  return updateFeatureFlag(flagKey, { emergencyOff: true, status: 'disabled', reason, updatedAt: nowIso() })
}

export function createReleaseDraft(input = {}) {
  const guard = requirePlatformAdmin()
  if (!guard.allowed) return { success: false, errorCode: 'platform_admin_required' }
  const release = normalizeRelease({
    ...input,
    releaseId: input.releaseId || createId('release'),
    status: 'draft',
    createdAt: nowIso(),
    updatedAt: nowIso()
  })
  const blocked = validateForbiddenCombinations(release.safetyConfig)
  if (blocked.length) {
    writeReleaseAudit('release_blocked_forbidden_combo', release.releaseId, null, { blocked, version: release.version }, '高风险组合')
    return { success: false, errorCode: 'forbidden_combination', blocked }
  }
  writeList(RELEASE_KEY, [release, ...getReleases()])
  writeReleaseAudit('release_draft_created', release.releaseId, null, release, input.reason || '创建发布草稿')
  return { success: true, release }
}

export function advanceReleaseStatus(releaseId = '', nextStatus = '', reason = '') {
  const guard = requirePlatformAdmin()
  if (!guard.allowed) return { success: false, errorCode: 'platform_admin_required' }
  if (!RELEASE_STATUSES.includes(nextStatus)) return { success: false, errorCode: 'invalid_release_status' }
  const releases = getReleases()
  const existing = releases.find((item) => item.releaseId === releaseId)
  if (!existing) return { success: false, errorCode: 'release_not_found' }
  const blocked = validateForbiddenCombinations(existing.safetyConfig)
  if (blocked.length && !['rolled_back'].includes(nextStatus)) {
    writeReleaseAudit('release_blocked_forbidden_combo', releaseId, existing, { blocked, nextStatus }, reason)
    return { success: false, errorCode: 'forbidden_combination', blocked }
  }
  const next = normalizeRelease({
    ...existing,
    status: nextStatus,
    publishedAt: nextStatus === 'released' ? nowIso() : existing.publishedAt,
    updatedAt: nowIso()
  })
  writeList(RELEASE_KEY, releases.map((item) => item.releaseId === releaseId ? next : item))
  writeReleaseAudit('release_status_changed', releaseId, existing, next, reason)
  return { success: true, release: next }
}

export function rollbackRelease(releaseId = '', reason = '紧急回滚') {
  const releases = getReleases()
  const existing = releases.find((item) => item.releaseId === releaseId)
  if (!existing) return { success: false, errorCode: 'release_not_found' }
  return advanceReleaseStatus(releaseId, 'rolled_back', reason)
}

export function loadReleaseControlCenter(filters = {}) {
  const guard = requirePlatformAdmin()
  if (!guard.allowed) {
    return {
      canAccess: false,
      reason: guard.reason,
      releases: [],
      flags: [],
      environments: [],
      audits: [],
      effectiveResults: [],
      forbiddenRules: FORBIDDEN_COMBINATIONS.map(({ comboId, title, severity }) => ({ comboId, title, severity })),
      flow: [],
      stats: { releaseCount: 0, flagCount: 0, disabledCount: 0, grayCount: 0 }
    }
  }
  const keyword = String(filters.keyword || '').trim().toLowerCase()
  const environment = String(filters.environment || 'production')
  const flags = getFlags()
  const releases = getReleases()
  const environments = getEnvironments()
  const filteredReleases = releases.filter((item) => !keyword || `${item.releaseId}${item.version}${item.gitCommit}${item.summary}${item.environment}${item.status}`.toLowerCase().includes(keyword))
  const filteredFlags = flags.filter((item) => !keyword || `${item.flagKey}${item.name}${item.module}${item.status}${item.reason}`.toLowerCase().includes(keyword))
  return {
    canAccess: true,
    reason: '',
    releases: filteredReleases,
    flags: filteredFlags,
    environments,
    audits: readList(AUDIT_KEY).slice(0, 80),
    effectiveResults: flags.map((flag) => ({
      flagKey: flag.flagKey,
      name: flag.name,
      ...evaluateFeatureFlag(flag.flagKey, { environment, userId: filters.userId || '', enterpriseId: filters.enterpriseId || '', role: filters.role || '', plan: filters.plan || '', functionType: filters.functionType || '' })
    })),
    forbiddenRules: FORBIDDEN_COMBINATIONS.map(({ comboId, title, severity }) => ({ comboId, title, severity })),
    priority: ['紧急全局关闭', '环境配置', '企业配置', '用户灰度', '默认配置'],
    flow: ['创建发布草稿', '关联代码和配置', '执行自动测试', '执行数据迁移预检', '预发布验证', '人工批准', '小范围灰度', '指标观察', '正式发布或回滚'],
    rollbackOptions: ['关闭单一功能', '回滚页面版本', '回滚 API 版本', '回滚模型路由', '暂停新任务'],
    updatedAt: nowIso(),
    stats: {
      releaseCount: releases.length,
      flagCount: flags.length,
      disabledCount: flags.filter((item) => item.status === 'disabled' || item.emergencyOff).length,
      grayCount: flags.filter((item) => item.status === 'gray').length
    }
  }
}

export function clearReleaseControlDevelopmentData() {
  const guard = requirePlatformAdmin()
  if (!guard.allowed) return { success: false, errorCode: 'platform_admin_required' }
  writeList(RELEASE_KEY, [])
  writeList(FLAG_KEY, [])
  writeList(ENV_KEY, [])
  writeList(AUDIT_KEY, [])
  return { success: true }
}
