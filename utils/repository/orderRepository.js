import { getDataProviderName } from '../data-provider/dataProvider.js'
import { ENTERPRISE_SCHEMA_VERSION, getCurrentEnterpriseContext, normalizeSaasRecord, readLocalStorage, writeLocalStorage } from './enterpriseRepository.js'
import { filterTenantData, protectTenantCreate, protectTenantUpdate, resolveTenantId } from '../tenant/tenantGuard.js'
import { getCurrentEnterpriseId } from '../tenant/tenantContext.js'

const STORAGE_KEY = 'diebiandesign_enterprise_commerce_v1'

function readStore() {
  const value = readLocalStorage(STORAGE_KEY, {})
  return {
    quotes: value && Array.isArray(value.quotes) ? value.quotes : [],
    orders: value && Array.isArray(value.orders) ? value.orders : [],
    schemaVersion: (value && value.schemaVersion) || ENTERPRISE_SCHEMA_VERSION,
    dataSource: (value && value.dataSource) || getDataProviderName()
  }
}

export function normalize(record = {}, options = {}) {
  return normalizeSaasRecord({ ...record, orderId: record.orderId || '' }, options)
}

export function getList() {
  const context = getCurrentEnterpriseContext()
  return filterTenantData(readStore().orders, getCurrentEnterpriseId()).map((item) => normalize(item, context))
}

export function getById(orderId = '') {
  return getList().find((item) => item.orderId === orderId) || null
}

export function create(input = {}) {
  const store = readStore()
  const now = new Date().toISOString()
  const context = getCurrentEnterpriseContext()
  const protectedInput = protectTenantCreate(input, context.enterpriseId)
  if (!protectedInput) return null
  const record = normalize({ ...protectedInput, orderId: input.orderId || `enterprise_order_${Date.now()}`, status: input.status || 'pending_payment', createdAt: input.createdAt || now, updatedAt: input.updatedAt || now }, context)
  writeLocalStorage(STORAGE_KEY, { ...store, orders: [record, ...store.orders.filter((item) => item.orderId !== record.orderId || resolveTenantId(item) !== context.enterpriseId)], schemaVersion: ENTERPRISE_SCHEMA_VERSION })
  return record
}

export function update(orderId = '', patch = {}) {
  const store = readStore()
  const records = getList()
  const current = records.find((item) => item.orderId === orderId)
  if (!current) return null
  const context = getCurrentEnterpriseContext()
  const protectedRecord = protectTenantUpdate(current, patch, context.enterpriseId)
  if (!protectedRecord) return null
  const record = normalize({ ...protectedRecord, orderId }, { ...context, updatedBy: patch.updatedBy || patch.userId, touchUpdatedAt: new Date().toISOString() })
  writeLocalStorage(STORAGE_KEY, { ...store, orders: store.orders.map((item) => item.orderId === orderId && resolveTenantId(item) === context.enterpriseId ? record : item), schemaVersion: ENTERPRISE_SCHEMA_VERSION })
  return record
}
