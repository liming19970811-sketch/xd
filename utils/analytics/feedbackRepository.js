import { getCurrentEnterpriseId } from '../tenant/tenantContext.js'
import { getCurrentMember, getCurrentUser } from '../auth/authRepository.js'
import { requirePermission } from '../enterprise-web/enterpriseWebGuard.js'

const FEEDBACK_KEY = 'diebians_product_feedback_v1'

export const FEEDBACK_TYPES = Object.freeze([
  { key: 'satisfied', label: '结果满意' },
  { key: 'unsatisfied', label: '结果不满意' },
  { key: 'hard_to_find', label: '功能难找' },
  { key: 'unclear_flow', label: '操作不清楚' },
  { key: 'generation_error', label: '生成错误' },
  { key: 'pattern_inaccurate', label: '版型不准确' },
  { key: 'quota_issue', label: '扣费问题' },
  { key: 'suggestion', label: '其他建议' }
])

export const FEEDBACK_STATUSES = Object.freeze(['new', 'triaged', 'investigating', 'fixing', 'verified', 'closed'])
export const FEEDBACK_SEVERITIES = Object.freeze(['low', 'medium', 'high', 'critical'])

function nowIso() {
  return new Date().toISOString()
}

function readFeedback() {
  try {
    const value = uni.getStorageSync(FEEDBACK_KEY)
    return Array.isArray(value) ? value.map(normalizeFeedback) : []
  } catch (error) {
    return []
  }
}

function writeFeedback(items = []) {
  try {
    uni.setStorageSync(FEEDBACK_KEY, items.map(normalizeFeedback))
  } catch (error) {}
}

function sanitizeText(value = '', limit = 300) {
  return String(value || '')
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email]')
    .replace(/1[3-9]\d{9}/g, '[phone]')
    .replace(/https?:\/\/[^\s"'<>]+/gi, '[url]')
    .replace(/([?&](?:token|sessionToken|apiKey|secret|signature)=)[^&\s]+/gi, '$1[redacted]')
    .slice(0, limit)
}

function normalizeFeedback(item = {}) {
  const type = FEEDBACK_TYPES.some((entry) => entry.key === item.type) ? item.type : 'suggestion'
  const status = FEEDBACK_STATUSES.includes(item.status) ? item.status : 'new'
  const severity = FEEDBACK_SEVERITIES.includes(item.severity) ? item.severity : 'medium'
  return {
    feedbackId: String(item.feedbackId || `feedback_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`),
    enterpriseId: String(item.enterpriseId || getCurrentEnterpriseId()),
    userId: String(item.userId || ''),
    memberId: String(item.memberId || ''),
    sourcePage: sanitizeText(item.sourcePage || ''),
    resourceType: String(item.resourceType || ''),
    resourceId: sanitizeText(item.resourceId || ''),
    projectId: sanitizeText(item.projectId || ''),
    taskId: sanitizeText(item.taskId || ''),
    patternMasterId: sanitizeText(item.patternMasterId || ''),
    type,
    severity,
    status,
    description: sanitizeText(item.description || '', 500),
    owner: sanitizeText(item.owner || ''),
    fixVersion: sanitizeText(item.fixVersion || ''),
    verifyResult: sanitizeText(item.verifyResult || ''),
    createdAt: item.createdAt || nowIso(),
    updatedAt: item.updatedAt || item.createdAt || nowIso()
  }
}

export function createProductFeedback(input = {}) {
  const user = getCurrentUser()
  const member = getCurrentMember()
  const item = normalizeFeedback({
    ...input,
    enterpriseId: getCurrentEnterpriseId(),
    userId: user.userId,
    memberId: member.memberId,
    status: 'new',
    createdAt: nowIso(),
    updatedAt: nowIso()
  })
  writeFeedback([item, ...readFeedback()])
  return { success: true, feedback: item }
}

export function listProductFeedback() {
  const enterpriseId = getCurrentEnterpriseId()
  return readFeedback()
    .filter((item) => item.enterpriseId === enterpriseId)
    .sort((left, right) => String(right.updatedAt).localeCompare(String(left.updatedAt)))
}

export function updateProductFeedback(feedbackId = '', patch = {}) {
  const guard = requirePermission('analytics.view')
  if (!guard.allowed) return { success: false, errorCode: guard.reason || 'permission_denied' }
  const enterpriseId = getCurrentEnterpriseId()
  let updated = null
  const next = readFeedback().map((item) => {
    if (item.feedbackId !== feedbackId || item.enterpriseId !== enterpriseId) return item
    updated = normalizeFeedback({
      ...item,
      status: patch.status || item.status,
      severity: patch.severity || item.severity,
      owner: patch.owner !== undefined ? patch.owner : item.owner,
      fixVersion: patch.fixVersion !== undefined ? patch.fixVersion : item.fixVersion,
      verifyResult: patch.verifyResult !== undefined ? patch.verifyResult : item.verifyResult,
      updatedAt: nowIso()
    })
    return updated
  })
  writeFeedback(next)
  return updated ? { success: true, feedback: updated } : { success: false, errorCode: 'feedback_not_found' }
}

export function loadProductFeedbackCenter() {
  const guard = requirePermission('analytics.view')
  const items = guard.allowed ? listProductFeedback() : []
  return {
    canAccess: guard.allowed,
    reason: guard.reason || '',
    items,
    statusOptions: FEEDBACK_STATUSES,
    typeOptions: FEEDBACK_TYPES,
    severityOptions: FEEDBACK_SEVERITIES,
    stats: {
      total: items.length,
      open: items.filter((item) => !['verified', 'closed'].includes(item.status)).length,
      critical: items.filter((item) => item.severity === 'critical').length,
      closed: items.filter((item) => item.status === 'closed').length
    }
  }
}
