import { getCurrentEnterpriseContext, normalizeSaasRecord, readLocalStorage, writeLocalStorage } from './enterpriseRepository.js'
import { filterTenantData, protectTenantCreate, protectTenantUpdate, resolveTenantId } from '../tenant/tenantGuard.js'
import { getCurrentEnterpriseId } from '../tenant/tenantContext.js'

const STORAGE_KEY = 'diebiandesign_product_packages'

export function normalize(record = {}, options = {}) {
  return normalizeSaasRecord({ ...record, productPackageId: record.productPackageId || '' }, options)
}

export function getList() {
  const records = readLocalStorage(STORAGE_KEY, [])
  const context = getCurrentEnterpriseContext()
  return filterTenantData(records, getCurrentEnterpriseId()).map((item) => normalize(item, context))
}

export function getById(productPackageId = '') {
  return getList().find((item) => item.productPackageId === productPackageId) || null
}

export function create(input = {}) {
  const now = new Date().toISOString()
  const context = getCurrentEnterpriseContext()
  const protectedInput = protectTenantCreate(input, context.enterpriseId)
  if (!protectedInput) return null
  const record = normalize({ ...protectedInput, productPackageId: input.productPackageId || `product_package_${Date.now()}`, createdAt: input.createdAt || now, updatedAt: input.updatedAt || now }, context)
  const records = readLocalStorage(STORAGE_KEY, [])
  const rawRecords = Array.isArray(records) ? records : []
  writeLocalStorage(STORAGE_KEY, [record, ...rawRecords.filter((item) => item.productPackageId !== record.productPackageId || resolveTenantId(item) !== context.enterpriseId)])
  return record
}

export function update(productPackageId = '', patch = {}) {
  const records = getList()
  const current = records.find((item) => item.productPackageId === productPackageId)
  if (!current) return null
  const context = getCurrentEnterpriseContext()
  const protectedRecord = protectTenantUpdate(current, patch, context.enterpriseId)
  if (!protectedRecord) return null
  const record = normalize({ ...protectedRecord, productPackageId }, { ...context, updatedBy: patch.updatedBy || patch.userId, touchUpdatedAt: new Date().toISOString() })
  const rawRecords = readLocalStorage(STORAGE_KEY, [])
  writeLocalStorage(STORAGE_KEY, (Array.isArray(rawRecords) ? rawRecords : []).map((item) => item.productPackageId === productPackageId && resolveTenantId(item) === context.enterpriseId ? record : item))
  return record
}
