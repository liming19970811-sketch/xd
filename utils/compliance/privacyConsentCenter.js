import { get, set } from '../data-provider/dataProvider.js'
import { getCurrentMember, getCurrentUser } from '../auth/authRepository.js'
import { getCurrentEnterpriseId } from '../tenant/tenantContext.js'
import { requirePlatformAdmin } from '../admin/platformAdminRepository.js'
import { writeStructuredLog } from '../observability/traceLogger.js'

const CONSENT_KEY = 'diebians_privacy_consents_v1'
const REQUEST_KEY = 'diebians_privacy_data_requests_v1'
const CASE_AUTH_KEY = 'diebians_privacy_case_authorizations_v1'
const COMPLIANCE_AUDIT_KEY = 'diebians_privacy_compliance_audit_v1'

export const PRIVACY_POLICY_VERSION = 'privacy-v1.0.0'
export const TERMS_VERSION = 'terms-v1.0.0'

export const CONSENT_TYPES = Object.freeze([
  {
    type: 'basic_service_processing',
    label: '基础服务数据处理',
    required: true,
    defaultGranted: true,
    description: '用于登录、创建任务、保存项目、展示作品和处理必要客服请求。'
  },
  {
    type: 'cloud_file_storage',
    label: '图片与文件云存储',
    required: true,
    defaultGranted: true,
    description: '用于保存用户主动上传的服装图、版型文件、交付文件和附件。'
  },
  {
    type: 'ai_provider_processing',
    label: 'AI 供应商处理',
    required: false,
    defaultGranted: false,
    description: '任务提交前独立提示第三方供应商、发送数据类型、临时访问方式和保留规则。'
  },
  {
    type: 'enterprise_team_sharing',
    label: '企业团队共享',
    required: false,
    defaultGranted: false,
    description: '允许在当前企业和授权项目成员范围内共享任务、素材、作品和交付状态。'
  },
  {
    type: 'ai_training',
    label: 'AI训练使用',
    required: false,
    defaultGranted: false,
    description: '默认关闭。仅授权、审核通过且来源明确的数据可进入训练候选集。'
  },
  {
    type: 'public_case_display',
    label: '公开案例展示',
    required: false,
    defaultGranted: false,
    description: '未经客户、图片、Logo与品牌名称授权，不展示真实客户名称、图片和评价。'
  },
  {
    type: 'marketing_notice',
    label: '营销通知',
    required: false,
    defaultGranted: false,
    description: '用于发送产品更新、企业服务和活动通知，可随时撤回。'
  }
])

export const DATA_REQUEST_TYPES = Object.freeze(['export', 'delete', 'withdraw_optional', 'account_cancel', 'contact_privacy_officer'])
export const DATA_REQUEST_STATUSES = Object.freeze(['new', 'checking', 'blocked_by_retention', 'processing', 'completed', 'rejected'])
export const CASE_AUTH_STATUSES = Object.freeze(['pending', 'authorized', 'expired', 'withdrawn', 'offline_required'])

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

function writeList(key = '', records = []) {
  set(key, Array.isArray(records) ? records : [])
}

function currentIdentity() {
  const user = getCurrentUser() || {}
  const member = getCurrentMember() || {}
  return {
    userId: String(user.userId || member.userId || 'local_user'),
    enterpriseId: String(getCurrentEnterpriseId() || member.enterpriseId || ''),
    memberId: String(member.memberId || ''),
    role: String(member.role || member.roleId || '')
  }
}

function normalizeConsent(record = {}) {
  const typeConfig = CONSENT_TYPES.find((item) => item.type === record.consentType) || {}
  return {
    consentId: String(record.consentId || createId('consent')),
    userId: String(record.userId || currentIdentity().userId),
    enterpriseId: String(record.enterpriseId || currentIdentity().enterpriseId),
    consentType: String(record.consentType || typeConfig.type || ''),
    label: String(record.label || typeConfig.label || ''),
    protocolVersion: String(record.protocolVersion || PRIVACY_POLICY_VERSION),
    status: record.status === 'granted' ? 'granted' : 'withdrawn',
    grantedAt: record.grantedAt || '',
    withdrawnAt: record.withdrawnAt || '',
    sourcePage: String(record.sourcePage || ''),
    dataScope: String(record.dataScope || 'current_user'),
    required: Boolean(typeConfig.required),
    createdAt: record.createdAt || nowIso(),
    updatedAt: record.updatedAt || record.createdAt || nowIso()
  }
}

function normalizeDataRequest(record = {}) {
  return {
    requestId: String(record.requestId || createId('privacy_request')),
    userId: String(record.userId || currentIdentity().userId),
    enterpriseId: String(record.enterpriseId || currentIdentity().enterpriseId),
    requestType: DATA_REQUEST_TYPES.includes(record.requestType) ? record.requestType : 'export',
    status: DATA_REQUEST_STATUSES.includes(record.status) ? record.status : 'new',
    reason: String(record.reason || ''),
    retentionCheck: {
      projects: Boolean(record.retentionCheck?.projects),
      orders: Boolean(record.retentionCheck?.orders),
      quota: Boolean(record.retentionCheck?.quota),
      deliveries: Boolean(record.retentionCheck?.deliveries),
      legalHold: Boolean(record.retentionCheck?.legalHold)
    },
    createdAt: record.createdAt || nowIso(),
    updatedAt: record.updatedAt || record.createdAt || nowIso()
  }
}

function normalizeCaseAuthorization(record = {}) {
  return {
    authorizationId: String(record.authorizationId || createId('case_auth')),
    caseId: String(record.caseId || ''),
    enterpriseId: String(record.enterpriseId || currentIdentity().enterpriseId),
    customerNameAuthorized: Boolean(record.customerNameAuthorized),
    logoAuthorized: Boolean(record.logoAuthorized),
    imageAuthorized: Boolean(record.imageAuthorized),
    publicScope: String(record.publicScope || ''),
    status: CASE_AUTH_STATUSES.includes(record.status) ? record.status : 'pending',
    validUntil: record.validUntil || '',
    sourcePage: String(record.sourcePage || 'admin_compliance'),
    createdAt: record.createdAt || nowIso(),
    updatedAt: record.updatedAt || record.createdAt || nowIso()
  }
}

function writeComplianceAudit(action = '', resourceId = '', after = {}, reason = '') {
  const identity = currentIdentity()
  const record = {
    auditId: createId('privacy_audit'),
    action,
    resourceId,
    enterpriseId: identity.enterpriseId,
    operatorId: identity.memberId || identity.userId,
    reason,
    after,
    createdAt: nowIso()
  }
  writeList(COMPLIANCE_AUDIT_KEY, [record, ...readList(COMPLIANCE_AUDIT_KEY)].slice(0, 1000))
  writeStructuredLog({
    level: ['case_offline_required', 'data_request_blocked'].includes(action) ? 'warn' : 'info',
    module: 'admin',
    action: `privacy_${action}`,
    status: 'success',
    data: { resourceId, reason }
  })
  return record
}

function getUserConsentRecords(identity = currentIdentity()) {
  const existing = readList(CONSENT_KEY).map(normalizeConsent)
  return existing.filter((item) => item.userId === identity.userId && (!identity.enterpriseId || item.enterpriseId === identity.enterpriseId || !item.enterpriseId))
}

export function getConsentCatalog() {
  return CONSENT_TYPES.map((item) => ({ ...item }))
}

export function loadUserConsentCenter() {
  const identity = currentIdentity()
  const records = getUserConsentRecords(identity)
  const byType = new Map(records.map((item) => [item.consentType, item]))
  const consents = CONSENT_TYPES.map((item) => {
    const record = byType.get(item.type)
    return {
      ...item,
      consentId: record?.consentId || '',
      status: record ? record.status : (item.defaultGranted ? 'granted' : 'withdrawn'),
      grantedAt: record?.grantedAt || (item.defaultGranted ? 'system_required' : ''),
      withdrawnAt: record?.withdrawnAt || '',
      protocolVersion: record?.protocolVersion || PRIVACY_POLICY_VERSION,
      sourcePage: record?.sourcePage || 'system_default',
      dataScope: record?.dataScope || (item.required ? 'service_required' : 'current_user')
    }
  })
  const requests = readList(REQUEST_KEY).map(normalizeDataRequest).filter((item) => item.userId === identity.userId && (!identity.enterpriseId || item.enterpriseId === identity.enterpriseId || !item.enterpriseId))
  return {
    identity,
    policyVersion: PRIVACY_POLICY_VERSION,
    termsVersion: TERMS_VERSION,
    consents,
    requests,
    trainingConsent: consents.find((item) => item.type === 'ai_training') || null,
    caseConsent: consents.find((item) => item.type === 'public_case_display') || null,
    marketingConsent: consents.find((item) => item.type === 'marketing_notice') || null,
    updatedAt: nowIso()
  }
}

export function setConsent(consentType = '', granted = false, options = {}) {
  const config = CONSENT_TYPES.find((item) => item.type === consentType)
  if (!config) return { success: false, errorCode: 'consent_type_not_found' }
  if (config.required && !granted) return { success: false, errorCode: 'required_consent_cannot_withdraw' }
  const identity = currentIdentity()
  const records = readList(CONSENT_KEY).map(normalizeConsent)
  const existing = records.find((item) => item.userId === identity.userId && item.enterpriseId === identity.enterpriseId && item.consentType === consentType)
  const now = nowIso()
  const next = normalizeConsent({
    ...(existing || {}),
    userId: identity.userId,
    enterpriseId: identity.enterpriseId,
    consentType,
    label: config.label,
    protocolVersion: options.protocolVersion || PRIVACY_POLICY_VERSION,
    status: granted ? 'granted' : 'withdrawn',
    grantedAt: granted ? (existing?.grantedAt || now) : (existing?.grantedAt || ''),
    withdrawnAt: granted ? '' : now,
    sourcePage: options.sourcePage || 'workspace_data_consent',
    dataScope: options.dataScope || (consentType === 'ai_training' ? 'authorized_reviewed_assets_only' : 'current_user'),
    updatedAt: now
  })
  writeList(CONSENT_KEY, [next, ...records.filter((item) => item.consentId !== next.consentId)])
  writeComplianceAudit(granted ? 'consent_granted' : 'consent_withdrawn', next.consentId, {
    consentType,
    status: next.status,
    protocolVersion: next.protocolVersion,
    dataScope: next.dataScope
  }, options.reason || '')
  return { success: true, consent: next }
}

export function createDataRequest(input = {}) {
  const request = normalizeDataRequest({
    requestType: input.requestType,
    reason: input.reason,
    status: 'new',
    retentionCheck: input.retentionCheck || {}
  })
  writeList(REQUEST_KEY, [request, ...readList(REQUEST_KEY).map(normalizeDataRequest)])
  writeComplianceAudit('data_request_created', request.requestId, {
    requestType: request.requestType,
    status: request.status
  }, input.reason || '')
  return { success: true, request }
}

export function canUseDataForTraining(input = {}) {
  const center = loadUserConsentCenter()
  const consent = center.consents.find((item) => item.type === 'ai_training')
  const authorized = consent && consent.status === 'granted'
  const reviewed = input.reviewed === true || input.reviewStatus === 'approved'
  const sourceKnown = input.sourceKnown !== false
  const enterpriseAllowed = input.enterprisePolicyAllowsTraining !== false
  const frozenDataset = input.datasetStatus === 'frozen'
  return {
    allowed: Boolean(authorized && reviewed && sourceKnown && enterpriseAllowed),
    reason: !authorized
      ? 'training_consent_missing'
      : (!reviewed ? 'review_required' : (!sourceKnown ? 'source_unknown' : (!enterpriseAllowed ? 'enterprise_policy_denied' : (frozenDataset ? 'already_frozen_dataset' : 'allowed')))),
    frozenDatasetNotice: frozenDataset ? '撤回后未进入冻结数据集的数据立即停止使用；历史模型影响按协议与技术能力说明。' : ''
  }
}

export function saveCaseAuthorization(input = {}) {
  const guard = requirePlatformAdmin()
  if (!guard.allowed) return { success: false, errorCode: 'platform_admin_required' }
  const auth = normalizeCaseAuthorization(input)
  const fullyAuthorized = auth.customerNameAuthorized && auth.logoAuthorized && auth.imageAuthorized && auth.validUntil
  const next = normalizeCaseAuthorization({
    ...auth,
    status: fullyAuthorized ? 'authorized' : 'pending',
    updatedAt: nowIso()
  })
  const records = readList(CASE_AUTH_KEY).map(normalizeCaseAuthorization)
  writeList(CASE_AUTH_KEY, [next, ...records.filter((item) => item.authorizationId !== next.authorizationId)])
  writeComplianceAudit('case_authorization_saved', next.authorizationId, {
    caseId: next.caseId,
    status: next.status,
    validUntil: next.validUntil
  }, input.reason || '')
  return { success: true, authorization: next }
}

export function loadComplianceAdminCenter(filters = {}) {
  const guard = requirePlatformAdmin()
  if (!guard.allowed) {
    return {
      canAccess: false,
      reason: guard.reason,
      consents: [],
      requests: [],
      caseAuthorizations: [],
      audits: [],
      stats: {}
    }
  }
  const consents = readList(CONSENT_KEY).map(normalizeConsent)
  const requests = readList(REQUEST_KEY).map(normalizeDataRequest)
  const caseAuthorizations = readList(CASE_AUTH_KEY).map(normalizeCaseAuthorization).map((item) => {
    const expired = item.validUntil && new Date(item.validUntil).getTime() < Date.now()
    return expired && item.status === 'authorized' ? { ...item, status: 'offline_required' } : item
  })
  const keyword = String(filters.keyword || '').trim().toLowerCase()
  const filteredConsents = consents.filter((item) => !keyword || `${item.consentId}${item.userId}${item.enterpriseId}${item.consentType}${item.status}`.toLowerCase().includes(keyword))
  const filteredRequests = requests.filter((item) => !keyword || `${item.requestId}${item.userId}${item.enterpriseId}${item.requestType}${item.status}`.toLowerCase().includes(keyword))
  const filteredCases = caseAuthorizations.filter((item) => !keyword || `${item.authorizationId}${item.caseId}${item.enterpriseId}${item.status}`.toLowerCase().includes(keyword))
  return {
    canAccess: true,
    reason: '',
    catalog: getConsentCatalog(),
    consents: filteredConsents,
    requests: filteredRequests,
    caseAuthorizations: filteredCases,
    audits: readList(COMPLIANCE_AUDIT_KEY).slice(0, 100),
    protocolVersions: [
      { type: 'privacy', version: PRIVACY_POLICY_VERSION, status: 'active', updatedAt: '2026-07-28' },
      { type: 'terms', version: TERMS_VERSION, status: 'active', updatedAt: '2026-07-28' }
    ],
    abnormalAccessRecords: consents.filter((item) => item.status === 'withdrawn' && item.consentType === 'ai_training'),
    exportRecords: requests.filter((item) => item.requestType === 'export'),
    stats: {
      pendingRequests: requests.filter((item) => ['new', 'checking', 'processing'].includes(item.status)).length,
      grantedConsents: consents.filter((item) => item.status === 'granted').length,
      withdrawnConsents: consents.filter((item) => item.status === 'withdrawn').length,
      offlineCases: caseAuthorizations.filter((item) => item.status === 'offline_required' || item.status === 'withdrawn').length,
      protocolVersionCount: 2,
      exportCount: requests.filter((item) => item.requestType === 'export').length
    },
    updatedAt: nowIso()
  }
}

export function clearComplianceDevelopmentData() {
  writeList(CONSENT_KEY, [])
  writeList(REQUEST_KEY, [])
  writeList(CASE_AUTH_KEY, [])
  writeList(COMPLIANCE_AUDIT_KEY, [])
  return { success: true }
}
