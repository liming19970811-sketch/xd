import { getCurrentEnterpriseContext, normalizeSaasRecord } from './enterpriseRepository.js'
import { getCurrentEnterpriseId } from '../tenant/tenantContext.js'
import { filterTenantData, protectTenantCreate, protectTenantUpdate, resolveTenantId } from '../tenant/tenantGuard.js'
import { readFactoryCollaborationStore, writeFactoryCollaborationStore } from './factoryRepository.js'

export const PRODUCTION_ORDER_STATUSES = Object.freeze([
  'pending_confirmation',
  'confirmed',
  'in_production',
  'quality_check',
  'ready_to_ship',
  'shipped',
  'completed',
  'cancelled'
])

export function normalize(record = {}, options = {}) {
  const context = getCurrentEnterpriseContext()
  const createdAt = record.createdAt || new Date().toISOString()
  return normalizeSaasRecord({
    ...record,
    productionOrderId: String(record.productionOrderId || ''),
    productionOrderNo: String(record.productionOrderNo || ''),
    sourceQuoteId: String(record.sourceQuoteId || ''),
    commercialOrderId: String(record.commercialOrderId || ''),
    projectId: String(record.projectId || ''),
    factoryId: String(record.factoryId || ''),
    status: PRODUCTION_ORDER_STATUSES.includes(record.status) ? record.status : 'pending_confirmation',
    items: Array.isArray(record.items) ? record.items : [],
    amount: Math.max(0, Number(record.amount || 0)),
    requestedDeliveryAt: String(record.requestedDeliveryAt || ''),
    promisedDeliveryAt: String(record.promisedDeliveryAt || ''),
    latestEstimatedDeliveryAt: String(record.latestEstimatedDeliveryAt || ''),
    deliveryRisk: ['none', 'low', 'medium', 'high'].includes(record.deliveryRisk) ? record.deliveryRisk : 'none',
    qualityStatus: ['pending', 'passed', 'failed'].includes(record.qualityStatus) ? record.qualityStatus : 'pending',
    progressLogs: Array.isArray(record.progressLogs) ? record.progressLogs : [],
    deliveryFeedbacks: Array.isArray(record.deliveryFeedbacks) ? record.deliveryFeedbacks : [],
    anomalies: Array.isArray(record.anomalies) ? record.anomalies : [],
    completedAt: String(record.completedAt || ''),
    createdAt,
    updatedAt: record.updatedAt || createdAt
  }, { ...context, ...options })
}

export function getList(filters = {}) {
  return filterTenantData(readFactoryCollaborationStore().productionOrders, getCurrentEnterpriseId())
    .map((item) => normalize(item))
    .filter((item) => !filters.factoryId || item.factoryId === filters.factoryId)
    .filter((item) => !filters.projectId || item.projectId === filters.projectId)
    .filter((item) => !filters.status || item.status === filters.status)
    .sort((left, right) => String(right.updatedAt).localeCompare(String(left.updatedAt)))
}

export function getById(productionOrderId = '') {
  return getList().find((item) => item.productionOrderId === productionOrderId) || null
}

export function create(input = {}) {
  const context = getCurrentEnterpriseContext()
  const protectedInput = protectTenantCreate(input, context.enterpriseId)
  if (!protectedInput) return null
  const existing = input.sourceQuoteId && getList().find((item) => item.sourceQuoteId === input.sourceQuoteId)
  if (existing) return existing
  const now = new Date().toISOString()
  const productionOrderId = String(input.productionOrderId || `production_order_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`)
  const record = normalize({
    ...protectedInput,
    productionOrderId,
    productionOrderNo: input.productionOrderNo || `PO-${String(Date.now()).slice(-10)}`,
    createdAt: now,
    updatedAt: now
  }, { createdBy: context.userId })
  const store = readFactoryCollaborationStore()
  writeFactoryCollaborationStore({
    productionOrders: [record, ...store.productionOrders.filter((item) => item.productionOrderId !== productionOrderId || resolveTenantId(item) !== context.enterpriseId)]
  })
  return record
}

export function update(productionOrderId = '', patch = {}) {
  const current = getById(productionOrderId)
  if (!current) return null
  const context = getCurrentEnterpriseContext()
  const protectedRecord = protectTenantUpdate(current, patch, context.enterpriseId)
  if (!protectedRecord) return null
  const record = normalize({ ...protectedRecord, productionOrderId }, { updatedBy: context.userId, touchUpdatedAt: new Date().toISOString() })
  const store = readFactoryCollaborationStore()
  writeFactoryCollaborationStore({
    productionOrders: store.productionOrders.map((item) => item.productionOrderId === productionOrderId && resolveTenantId(item) === context.enterpriseId ? record : item)
  })
  return record
}

