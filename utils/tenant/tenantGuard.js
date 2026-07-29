import { DEFAULT_ENTERPRISE_ID, getCurrentEnterpriseId } from './tenantContext.js'

export function resolveTenantId(record = {}) {
  return String(record?.enterpriseId || DEFAULT_ENTERPRISE_ID).trim()
}

export function canAccessTenantData(record = {}, enterpriseId = getCurrentEnterpriseId()) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) return false
  return resolveTenantId(record, enterpriseId) === String(enterpriseId || DEFAULT_ENTERPRISE_ID)
}

export function normalizeTenantData(record = {}, enterpriseId = getCurrentEnterpriseId()) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) return null
  return { ...record, enterpriseId: resolveTenantId(record, enterpriseId) }
}

export function filterTenantData(records = [], enterpriseId = getCurrentEnterpriseId()) {
  return (Array.isArray(records) ? records : [])
    .map((item) => normalizeTenantData(item, enterpriseId))
    .filter((item) => item && canAccessTenantData(item, enterpriseId))
}

export function protectTenantCreate(input = {}, enterpriseId = getCurrentEnterpriseId()) {
  if (input?.enterpriseId && input.enterpriseId !== enterpriseId) return null
  return { ...(input || {}), enterpriseId }
}

export function protectTenantUpdate(current = {}, patch = {}, enterpriseId = getCurrentEnterpriseId()) {
  if (!canAccessTenantData(current, enterpriseId)) return null
  if (patch?.enterpriseId && patch.enterpriseId !== enterpriseId) return null
  return { ...(current || {}), ...(patch || {}), enterpriseId }
}
