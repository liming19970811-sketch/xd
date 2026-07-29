import { getDataProviderName } from '../data-provider/dataProvider.js'
import { ENTERPRISE_SCHEMA_VERSION, getCurrentEnterpriseContext, normalizeSaasRecord, readLocalStorage, writeLocalStorage } from './enterpriseRepository.js'
import { filterTenantData, protectTenantCreate, protectTenantUpdate, resolveTenantId } from '../tenant/tenantGuard.js'
import { getCurrentEnterpriseId } from '../tenant/tenantContext.js'

const STORAGE_KEY = 'diebi_workspace_delivery_v1'

function readStore() {
  const value = readLocalStorage(STORAGE_KEY, {})
  return value && Array.isArray(value.deliveries) ? value.deliveries : (Array.isArray(value) ? value : [])
}

function writeStore(records = []) {
  return writeLocalStorage(STORAGE_KEY, { version: 1, schemaVersion: ENTERPRISE_SCHEMA_VERSION, dataSource: getDataProviderName(), deliveries: records })
}

export function normalize(record = {}, options = {}) {
  const validStatuses = ['pending', 'draft', 'preparing', 'submitted', 'reviewing', 'approved', 'rejected', 'customer_confirmed', 'completed', 'cancelled', 'delivered', 'confirmed']
  const assetVersionIds = Array.from(new Set(
    (Array.isArray(record.assetVersionIds) ? record.assetVersionIds : [])
      .map((item) => String(item || '').trim())
      .filter(Boolean)
  ))
  return normalizeSaasRecord({
    ...record,
    deliveryId: record.deliveryId || '',
    projectId: record.projectId || '',
    orderId: record.orderId || '',
    sourceQuoteId: record.sourceQuoteId || '',
    title: record.title || '',
    assetVersionIds,
    status: validStatuses.includes(record.status) ? record.status : 'pending',
    itemCount: Number(record.itemCount || assetVersionIds.length || 0),
    version: Number(record.version || 0),
    completedAt: record.completedAt || ''
  }, options)
}

export function getList(filters = {}) {
  const records = filterTenantData(readStore(), getCurrentEnterpriseId())
    .map((item) => normalize(item, getCurrentEnterpriseContext()))
    .filter((item) => item.deliveryId && (item.projectId || item.orderId || item.assetVersionIds.length))
    .sort((left, right) => String(right.createdAt || '').localeCompare(String(left.createdAt || '')))
  return records
    .filter((item) => !filters.projectId || item.projectId === filters.projectId)
    .filter((item) => !filters.orderId || item.orderId === filters.orderId)
}

export function getById(deliveryId = '') {
  return getList().find((item) => item.deliveryId === deliveryId) || null
}

export function create(input = {}) {
  const now = new Date().toISOString()
  const context = getCurrentEnterpriseContext()
  const protectedInput = protectTenantCreate(input, context.enterpriseId)
  if (!protectedInput) return null
  const record = normalize({ ...protectedInput, deliveryId: input.deliveryId || `workspace_delivery_${Date.now()}`, status: input.status || 'pending', createdAt: input.createdAt || now, updatedAt: input.updatedAt || now }, context)
  const records = readStore()
  writeStore([record, ...records.filter((item) => item.deliveryId !== record.deliveryId || resolveTenantId(item) !== context.enterpriseId)])
  return record
}

export function update(deliveryId = '', patch = {}) {
  const records = getList()
  const current = records.find((item) => item.deliveryId === deliveryId)
  if (!current) return null
  const context = getCurrentEnterpriseContext()
  const protectedRecord = protectTenantUpdate(current, patch, context.enterpriseId)
  if (!protectedRecord) return null
  const record = normalize({ ...protectedRecord, deliveryId }, { ...context, updatedBy: patch.updatedBy || patch.userId, touchUpdatedAt: new Date().toISOString() })
  writeStore(readStore().map((item) => item.deliveryId === deliveryId && resolveTenantId(item) === context.enterpriseId ? record : item))
  return record
}
