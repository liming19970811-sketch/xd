import { getCurrentEnterpriseContext, normalizeSaasRecord } from './enterpriseRepository.js'
import { getCurrentEnterpriseId } from '../tenant/tenantContext.js'
import { filterTenantData, protectTenantCreate, protectTenantUpdate, resolveTenantId } from '../tenant/tenantGuard.js'
import { readFactoryCollaborationStore, writeFactoryCollaborationStore } from './factoryRepository.js'

export const FACTORY_QUOTE_STATUSES = Object.freeze(['draft', 'invited', 'viewed', 'submitted', 'accepted', 'rejected', 'expired'])

export function normalize(record = {}, options = {}) {
  const context = getCurrentEnterpriseContext()
  const createdAt = record.createdAt || new Date().toISOString()
  return normalizeSaasRecord({
    ...record,
    quoteId: String(record.quoteId || ''),
    factoryId: String(record.factoryId || ''),
    projectId: String(record.projectId || ''),
    commercialOrderId: String(record.commercialOrderId || ''),
    status: FACTORY_QUOTE_STATUSES.includes(record.status) ? record.status : 'draft',
    inquiryTitle: String(record.inquiryTitle || '生产询价'),
    items: Array.isArray(record.items) ? record.items.map((item) => ({
      name: String(item.name || ''),
      quantity: Math.max(0, Number(item.quantity || 0)),
      material: String(item.material || ''),
      process: String(item.process || '')
    })) : [],
    requestedDeliveryAt: String(record.requestedDeliveryAt || ''),
    quoteDueAt: String(record.quoteDueAt || ''),
    amount: Math.max(0, Number(record.amount || 0)),
    currency: String(record.currency || 'CNY'),
    minimumOrderQuantity: Math.max(0, Number(record.minimumOrderQuantity || 0)),
    leadTimeDays: Math.max(0, Number(record.leadTimeDays || 0)),
    estimatedDeliveryAt: String(record.estimatedDeliveryAt || ''),
    factoryComment: String(record.factoryComment || ''),
    submittedBy: String(record.submittedBy || ''),
    submittedAt: String(record.submittedAt || ''),
    acceptedAt: String(record.acceptedAt || ''),
    createdAt,
    updatedAt: record.updatedAt || createdAt
  }, { ...context, ...options })
}

export function getList(filters = {}) {
  return filterTenantData(readFactoryCollaborationStore().factoryQuotes, getCurrentEnterpriseId())
    .map((item) => normalize(item))
    .filter((item) => !filters.factoryId || item.factoryId === filters.factoryId)
    .filter((item) => !filters.projectId || item.projectId === filters.projectId)
    .filter((item) => !filters.status || item.status === filters.status)
    .sort((left, right) => String(right.updatedAt).localeCompare(String(left.updatedAt)))
}

export function getById(quoteId = '') {
  return getList().find((item) => item.quoteId === quoteId) || null
}

export function create(input = {}) {
  const context = getCurrentEnterpriseContext()
  const protectedInput = protectTenantCreate(input, context.enterpriseId)
  if (!protectedInput) return null
  const now = new Date().toISOString()
  const quoteId = String(input.quoteId || `factory_quote_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`)
  const record = normalize({ ...protectedInput, quoteId, createdAt: now, updatedAt: now }, { createdBy: context.userId })
  const store = readFactoryCollaborationStore()
  writeFactoryCollaborationStore({
    factoryQuotes: [record, ...store.factoryQuotes.filter((item) => item.quoteId !== quoteId || resolveTenantId(item) !== context.enterpriseId)]
  })
  return record
}

export function update(quoteId = '', patch = {}) {
  const current = getById(quoteId)
  if (!current) return null
  const context = getCurrentEnterpriseContext()
  const protectedRecord = protectTenantUpdate(current, patch, context.enterpriseId)
  if (!protectedRecord) return null
  const record = normalize({ ...protectedRecord, quoteId }, { updatedBy: context.userId, touchUpdatedAt: new Date().toISOString() })
  const store = readFactoryCollaborationStore()
  writeFactoryCollaborationStore({
    factoryQuotes: store.factoryQuotes.map((item) => item.quoteId === quoteId && resolveTenantId(item) === context.enterpriseId ? record : item)
  })
  return record
}

