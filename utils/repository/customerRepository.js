import { getCurrentEnterpriseContext, normalizeSaasRecord, readLocalStorage, writeLocalStorage } from './enterpriseRepository.js'
import { filterTenantData, protectTenantCreate, protectTenantUpdate, resolveTenantId } from '../tenant/tenantGuard.js'
import { getCurrentEnterpriseId } from '../tenant/tenantContext.js'

const STORAGE_KEY = 'diebiandesign_enterprise_customers_v1'

export function normalize(record = {}, options = {}) {
  return normalizeSaasRecord({
    ...record,
    customerId: record.customerId || record.leadId || ''
  }, options)
}

export function getList() {
  const records = readLocalStorage(STORAGE_KEY, [])
  const context = getCurrentEnterpriseContext()
  return filterTenantData(records, getCurrentEnterpriseId()).map((item) => normalize(item, context))
}

export function getById(customerId = '') {
  return getList().find((item) => item.customerId === customerId) || null
}

export function create(input = {}) {
  const now = new Date().toISOString()
  const context = getCurrentEnterpriseContext()
  const protectedInput = protectTenantCreate(input, context.enterpriseId)
  if (!protectedInput) return null
  const record = normalize({ ...protectedInput, customerId: input.customerId || `customer_${Date.now()}`, createdAt: input.createdAt || now, updatedAt: input.updatedAt || now }, context)
  const records = readLocalStorage(STORAGE_KEY, [])
  const rawRecords = Array.isArray(records) ? records : []
  writeLocalStorage(STORAGE_KEY, [record, ...rawRecords.filter((item) => item.customerId !== record.customerId || resolveTenantId(item) !== context.enterpriseId)])
  return record
}

export function update(customerId = '', patch = {}) {
  const records = getList()
  const current = records.find((item) => item.customerId === customerId)
  if (!current) return null
  const context = getCurrentEnterpriseContext()
  const protectedRecord = protectTenantUpdate(current, patch, context.enterpriseId)
  if (!protectedRecord) return null
  const record = normalize({ ...protectedRecord, customerId }, { ...context, updatedBy: patch.updatedBy || patch.userId, touchUpdatedAt: new Date().toISOString() })
  const rawRecords = readLocalStorage(STORAGE_KEY, [])
  writeLocalStorage(STORAGE_KEY, (Array.isArray(rawRecords) ? rawRecords : []).map((item) => item.customerId === customerId && resolveTenantId(item) === context.enterpriseId ? record : item))
  return record
}
