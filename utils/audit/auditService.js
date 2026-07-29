import { on } from '../events/eventBus.js'
import { getCurrentEnterpriseContext, getList as getEnterpriseList, readLocalStorage, writeLocalStorage } from '../repository/enterpriseRepository.js'
import { AUDITED_BUSINESS_EVENTS, buildAuditInput } from './auditEvents.js'
import { filterTenantData, protectTenantCreate, resolveTenantId } from '../tenant/tenantGuard.js'
import { getCurrentEnterpriseId } from '../tenant/tenantContext.js'

const STORAGE_KEY = 'diebiandesign_enterprise_audit_logs_v1'
const MAX_LOGS = 500

function readStore() {
  const value = readLocalStorage(STORAGE_KEY, [])
  if (Array.isArray(value)) return value
  return value && Array.isArray(value.auditLogs) ? value.auditLogs : []
}

export function normalizeAuditLog(record = {}) {
  const context = getCurrentEnterpriseContext()
  const enterprise = getEnterpriseList()[0] || {}
  const userId = record.userId || context.userId
  const member = (Array.isArray(enterprise.members) ? enterprise.members : []).find((item) => item.memberId === userId || item.userId === userId)
  return {
    auditId: record.auditId || `audit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    enterpriseId: record.enterpriseId || context.enterpriseId,
    userId,
    operator: record.operator || member?.name || userId || '系统',
    action: record.action || '更新业务数据',
    targetType: record.targetType || 'business',
    targetId: record.targetId || '',
    before: record.before && typeof record.before === 'object' ? record.before : {},
    after: record.after && typeof record.after === 'object' ? record.after : {},
    createdAt: record.createdAt || new Date().toISOString()
  }
}

export function getAuditLogs(filters = {}) {
  const enterpriseId = getCurrentEnterpriseId()
  if (filters.enterpriseId && filters.enterpriseId !== enterpriseId) return []
  return filterTenantData(readStore(), enterpriseId)
    .map(normalizeAuditLog)
    .filter((item) => !filters.targetType || item.targetType === filters.targetType)
    .filter((item) => !filters.targetId || item.targetId === filters.targetId)
    .sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt)))
}

export function recordAudit(input = {}) {
  const enterpriseId = getCurrentEnterpriseId()
  const protectedInput = protectTenantCreate(input, enterpriseId)
  if (!protectedInput) return null
  const record = normalizeAuditLog(protectedInput)
  const stored = readStore()
  const tenantRecords = [
    record,
    ...stored.filter((item) => resolveTenantId(item) === enterpriseId && item.auditId !== record.auditId)
  ].slice(0, MAX_LOGS)
  const records = [...tenantRecords, ...stored.filter((item) => resolveTenantId(item) !== enterpriseId)]
  writeLocalStorage(STORAGE_KEY, { version: 1, auditLogs: records })
  return record
}

AUDITED_BUSINESS_EVENTS.forEach((eventName) => {
  on(eventName, (payload = {}) => {
    const input = buildAuditInput(eventName, payload)
    return input ? recordAudit(input) : null
  })
})
