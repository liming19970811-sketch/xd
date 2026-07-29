import { get, set } from '../data-provider/dataProvider.js'
import { getCurrentEnterprise, getCurrentMember, getCurrentUser, setCurrentContext } from '../auth/authRepository.js'
import { getCurrentSession } from '../auth/authSessionService.js'
import { hasPermission } from '../auth/permissionService.js'
import { recordAudit } from '../audit/auditService.js'
import { getCurrentEnterpriseId } from '../tenant/tenantContext.js'

const SETTINGS_KEY = 'diebians_workspace_settings_center_v1'
const QUOTA_RECORD_KEYS = ['membership_usage_records', 'quota_usage_records', 'ai_quota_records']

export const WORKSPACE_SETTINGS_TABS = Object.freeze([
  { key: 'profile', label: '个人资料' },
  { key: 'security', label: '账号安全' },
  { key: 'enterprise', label: '企业资料' },
  { key: 'generation', label: '生成偏好' },
  { key: 'notifications', label: '通知设置' },
  { key: 'storage', label: '存储与下载' },
  { key: 'billing', label: '额度与账单' },
  { key: 'privacy', label: '数据与隐私' }
])

export const DEFAULT_GENERATION_PREFERENCES = Object.freeze({
  defaultRatio: '1:1',
  defaultCount: 1,
  defaultQuality: '高清',
  defaultMode: '商品视觉',
  namingRule: '项目-功能-SKU-序号',
  downloadFormat: 'JPG/PNG',
  reviewFlow: '生成后人工审核',
  defaultProjectId: ''
})

export const NOTIFICATION_CHANNELS = Object.freeze([
  { key: 'inApp', label: '站内通知', enabled: true, available: true },
  { key: 'wechat', label: '微信通知', enabled: false, available: false },
  { key: 'email', label: '邮件通知', enabled: false, available: false }
])

export const NOTIFICATION_EVENTS = Object.freeze([
  { key: 'taskCompleted', label: '任务完成' },
  { key: 'taskFailed', label: '任务失败' },
  { key: 'reviewPending', label: '待审核' },
  { key: 'reviewResult', label: '审核结果' },
  { key: 'deliveryCompleted', label: '交付完成' },
  { key: 'quotaInsufficient', label: '额度不足' },
  { key: 'teamInvite', label: '团队邀请' },
  { key: 'securityAlert', label: '安全提醒' }
])

function nowIso() {
  return new Date().toISOString()
}

function currentEnterpriseId() {
  return String(getCurrentEnterpriseId() || 'local_enterprise')
}

function readAllSettings() {
  const value = get(SETTINGS_KEY, {})
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
}

function writeAllSettings(value = {}) {
  set(SETTINGS_KEY, value && typeof value === 'object' ? value : {})
}

function defaultNotificationSettings() {
  return NOTIFICATION_EVENTS.reduce((acc, event) => {
    acc[event.key] = { inApp: true, wechat: false, email: false }
    return acc
  }, {})
}

function defaultStorageSettings() {
  return {
    downloadFormat: 'JPG/PNG',
    namingRule: '项目-用途-序号',
    keepOriginalFiles: true,
    autoAddToProject: false,
    retentionNote: '文件保留期限以企业存储策略和平台规则为准，不承诺无限存储。'
  }
}

function defaultPrivacySettings() {
  return {
    dataExportRequested: false,
    workLicenseScope: '仅当前账号和企业项目使用',
    patternLicenseScope: '仅当前账号和企业项目使用',
    aiTrainingAuthorized: false,
    cancellationRequested: false
  }
}

function getEnterpriseSettings() {
  const all = readAllSettings()
  const enterpriseId = currentEnterpriseId()
  if (!all[enterpriseId]) all[enterpriseId] = {}
  return { all, enterpriseId, settings: all[enterpriseId] }
}

function saveModuleSettings(module = '', patch = {}) {
  const { all, enterpriseId, settings } = getEnterpriseSettings()
  const nextModule = {
    ...(settings[module] || {}),
    ...patch,
    updatedAt: nowIso()
  }
  all[enterpriseId] = { ...settings, [module]: nextModule }
  writeAllSettings(all)
  return nextModule
}

function createAudit(action = '', targetType = 'settings', targetId = '', before = {}, after = {}) {
  const member = getCurrentMember()
  recordAudit({
    enterpriseId: currentEnterpriseId(),
    userId: member.userId || member.memberId || '',
    operatorId: member.memberId || member.userId || '',
    operator: member.name || member.role || '当前成员',
    action,
    targetType,
    targetId,
    resourceType: targetType,
    resourceId: targetId,
    before,
    after,
    createdAt: nowIso()
  })
}

function maskAccount(value = '') {
  const text = String(value || '').trim()
  if (!text) return ''
  if (text.includes('@')) {
    const [name, domain] = text.split('@')
    return `${name.slice(0, 2)}***@${domain || ''}`
  }
  return `${text.slice(0, 3)}****${text.slice(-2)}`
}

function readQuotaRecords() {
  return QUOTA_RECORD_KEYS.flatMap((key) => {
    const value = get(key, [])
    if (Array.isArray(value)) return value
    if (value && Array.isArray(value.records)) return value.records
    return []
  })
}

function normalizeQuotaRecord(record = {}) {
  const cost = Number(record.costValue || record.cost || record.amount || 0)
  const status = String(record.status || '')
  return {
    recordId: String(record.recordId || record.usageId || record.id || record._id || ''),
    action: String(record.costActionType || record.actionType || record.action || '额度记录'),
    status,
    cost,
    isRollback: ['rolled_back', 'rollback', 'refunded'].includes(status),
    taskId: String(record.sourceTaskId || record.taskId || ''),
    createdAt: record.createdAt || record.updatedAt || ''
  }
}

export function loadWorkspaceSettingsCenter() {
  const user = getCurrentUser()
  const enterprise = getCurrentEnterprise()
  const member = getCurrentMember()
  const session = getCurrentSession()
  const { settings } = getEnterpriseSettings()
  const quotaRecords = readQuotaRecords().map(normalizeQuotaRecord)
  const consumed = quotaRecords.filter((item) => !item.isRollback).reduce((sum, item) => sum + item.cost, 0)
  const rolledBack = quotaRecords.filter((item) => item.isRollback).reduce((sum, item) => sum + item.cost, 0)
  const canManageEnterprise = hasPermission('settings.manage', { member }) || hasPermission('member.manage', { member })

  return {
    user,
    enterprise,
    member,
    sessionStatus: session && session.sessionStatus,
    canManageEnterprise,
    profile: {
      avatar: user.avatar || '',
      name: user.name || '',
      phone: maskAccount(settings.profile?.phone || user.phone || ''),
      email: maskAccount(settings.profile?.email || user.email || ''),
      rawPhone: settings.profile?.phone || '',
      rawEmail: settings.profile?.email || '',
      identity: settings.profile?.identity || '专业用户',
      defaultModule: settings.profile?.defaultModule || 'overview',
      language: settings.profile?.language || '简体中文'
    },
    enterpriseProfile: {
      enterpriseName: settings.enterprise?.enterpriseName || enterprise.enterpriseName || '',
      logo: settings.enterprise?.logo || '',
      contact: settings.enterprise?.contact || '',
      industry: settings.enterprise?.industry || '',
      defaultProjectSpec: settings.enterprise?.defaultProjectSpec || '按项目目标确认',
      defaultDeliverySpec: settings.enterprise?.defaultDeliverySpec || '审核通过后交付',
      brandColor: settings.enterprise?.brandColor || '#4f46e5'
    },
    generation: { ...DEFAULT_GENERATION_PREFERENCES, ...(settings.generation || {}) },
    notifications: { ...defaultNotificationSettings(), ...(settings.notifications || {}) },
    channels: NOTIFICATION_CHANNELS.map((item) => ({ ...item })),
    storage: { ...defaultStorageSettings(), ...(settings.storage || {}) },
    privacy: { ...defaultPrivacySettings(), ...(settings.privacy || {}) },
    billing: {
      planName: settings.billing?.planName || '未接入会员方案',
      remainingQuota: settings.billing?.remainingQuota || '',
      usedThisMonth: consumed,
      rolledBack,
      expiresAt: settings.billing?.expiresAt || '',
      records: quotaRecords.sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt))).slice(0, 30),
      hasRealRecords: quotaRecords.length > 0
    }
  }
}

export function saveWorkspaceProfile(input = {}) {
  const before = loadWorkspaceSettingsCenter().profile
  const profile = saveModuleSettings('profile', {
    avatar: input.avatar || '',
    name: input.name || '',
    phone: input.phone || '',
    email: input.email || '',
    identity: input.identity || '专业用户',
    defaultModule: input.defaultModule || 'overview',
    language: input.language || '简体中文'
  })
  setCurrentContext({ user: { ...getCurrentUser(), name: profile.name, avatar: profile.avatar } })
  createAudit('保存个人资料', 'settings_profile', 'profile', before, { name: profile.name, identity: profile.identity })
  return { success: true, profile }
}

export function saveWorkspaceEnterpriseProfile(input = {}) {
  const member = getCurrentMember()
  if (!(hasPermission('settings.manage', { member }) || hasPermission('member.manage', { member }))) {
    return { success: false, errorCode: 'forbidden' }
  }
  const before = loadWorkspaceSettingsCenter().enterpriseProfile
  const enterprise = saveModuleSettings('enterprise', input)
  createAudit('保存企业资料', 'settings_enterprise', currentEnterpriseId(), before, enterprise)
  return { success: true, enterprise }
}

export function saveWorkspaceGenerationPreferences(input = {}) {
  const before = loadWorkspaceSettingsCenter().generation
  const generation = saveModuleSettings('generation', input)
  createAudit('保存生成偏好', 'settings_generation', 'generation', before, generation)
  return { success: true, generation }
}

export function saveWorkspaceNotificationSettings(input = {}) {
  const before = loadWorkspaceSettingsCenter().notifications
  const notifications = saveModuleSettings('notifications', input)
  createAudit('保存通知设置', 'settings_notifications', 'notifications', before, notifications)
  return { success: true, notifications }
}

export function saveWorkspaceStorageSettings(input = {}) {
  const before = loadWorkspaceSettingsCenter().storage
  const storage = saveModuleSettings('storage', input)
  createAudit('保存存储与下载设置', 'settings_storage', 'storage', before, storage)
  return { success: true, storage }
}

export function saveWorkspacePrivacySettings(input = {}) {
  const before = loadWorkspaceSettingsCenter().privacy
  const privacy = saveModuleSettings('privacy', {
    ...input,
    aiTrainingAuthorized: Boolean(input.aiTrainingAuthorized)
  })
  createAudit('保存数据与隐私设置', 'settings_privacy', 'privacy', before, {
    dataExportRequested: privacy.dataExportRequested,
    aiTrainingAuthorized: privacy.aiTrainingAuthorized,
    cancellationRequested: privacy.cancellationRequested
  })
  return { success: true, privacy }
}

export function recordWorkspaceSecurityAction(action = '') {
  createAudit(action, 'settings_security', 'security', {}, { requestedAt: nowIso() })
  return { success: true, requiresReAuth: true }
}

export function getWorkspaceGenerationDefaults() {
  return loadWorkspaceSettingsCenter().generation
}
