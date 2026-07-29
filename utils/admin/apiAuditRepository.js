const API_AUDIT_STORAGE_KEY = 'diebiandesign_api_audits'

export const API_AUDIT_STATUS = Object.freeze({
  SUCCESS: 'success',
  FAILED: 'failed',
  APP_PAUSED: 'app_paused',
  QUOTA_NOT_ENOUGH: 'quota_not_enough',
  PERMISSION_DENIED: 'permission_denied'
})

function normalizeAudit(audit = {}) {
  return {
    auditId: String(audit.auditId || ''),
    appId: String(audit.appId || ''),
    credentialId: String(audit.credentialId || ''),
    brandId: String(audit.brandId || ''),
    action: String(audit.action || ''),
    status: Object.values(API_AUDIT_STATUS).includes(audit.status)
      ? audit.status
      : API_AUDIT_STATUS.FAILED,
    cost: Math.max(0, Number(audit.cost) || 0),
    createdAt: audit.createdAt || new Date().toISOString()
  }
}

function readAudits() {
  try {
    const audits = uni.getStorageSync(API_AUDIT_STORAGE_KEY)
    return Array.isArray(audits) ? audits.map(normalizeAudit) : []
  } catch (error) {
    return []
  }
}

function writeAudits(audits = []) {
  try {
    uni.setStorageSync(API_AUDIT_STORAGE_KEY, audits.map(normalizeAudit))
  } catch (error) {}
  return audits
}

function getLocalDateKey(value = '') {
  const date = value ? new Date(value) : new Date()
  if (Number.isNaN(date.getTime())) return ''
  const pad = (number) => String(number).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function getApiAuditStatusFromCode(code = '', success = false) {
  if (success) return API_AUDIT_STATUS.SUCCESS
  if (code === 'APP_PAUSED') return API_AUDIT_STATUS.APP_PAUSED
  if (code === 'QUOTA_NOT_ENOUGH') return API_AUDIT_STATUS.QUOTA_NOT_ENOUGH
  if (code === 'PERMISSION_DENIED' || code === 'POLICY_PERMISSION_DENIED') {
    return API_AUDIT_STATUS.PERMISSION_DENIED
  }
  return API_AUDIT_STATUS.FAILED
}

export function createApiAuditRecord(input = {}) {
  const audit = normalizeAudit({
    ...input,
    auditId: input.auditId || `api_audit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    createdAt: input.createdAt || new Date().toISOString()
  })
  writeAudits([audit, ...readAudits().filter((item) => item.auditId !== audit.auditId)])
  console.log('[api:audit]', {
    auditId: audit.auditId,
    appId: audit.appId,
    action: audit.action,
    status: audit.status
  })
  return audit
}

export function getApiAuditRecords(appId = '') {
  return readAudits()
    .filter((audit) => !appId || audit.appId === appId)
    .sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt)))
}

export function getApiAuditStats(records = getApiAuditRecords()) {
  const todayKey = getLocalDateKey(new Date())
  const todayRecords = records.filter((audit) => getLocalDateKey(audit.createdAt) === todayKey)
  return {
    todayCount: todayRecords.length,
    successCount: todayRecords.filter((audit) => audit.status === API_AUDIT_STATUS.SUCCESS).length,
    failedCount: todayRecords.filter((audit) => audit.status !== API_AUDIT_STATUS.SUCCESS).length,
    totalCost: todayRecords.reduce((total, audit) => total + audit.cost, 0)
  }
}

export function getApiAuditStatusLabel(status = '') {
  const labels = {
    success: '成功',
    failed: '失败',
    app_paused: '应用暂停',
    quota_not_enough: '额度不足',
    permission_denied: '权限拒绝'
  }
  return labels[status] || status || '未知'
}
