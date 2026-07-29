import { getDataProviderName } from '../data-provider/dataProvider.js'
import {
  ENTERPRISE_SCHEMA_VERSION,
  getCurrentEnterpriseContext,
  normalizeSaasRecord,
  readLocalStorage,
  writeLocalStorage
} from './enterpriseRepository.js'
import { getCurrentEnterpriseId } from '../tenant/tenantContext.js'
import { filterTenantData, protectTenantCreate, protectTenantUpdate, resolveTenantId } from '../tenant/tenantGuard.js'

export const FACTORY_COLLABORATION_STORAGE_KEY = 'diebiandesign_factory_collaboration_v1'
export const FACTORY_STATUSES = Object.freeze(['active', 'suspended', 'archived'])
export const FACTORY_VERIFICATION_STATUSES = Object.freeze(['unverified', 'pending', 'verified', 'rejected'])
export const FACTORY_MEMBER_STATUSES = Object.freeze(['pending', 'active', 'disabled'])

function unique(values = []) {
  return [...new Set((Array.isArray(values) ? values : []).map((item) => String(item || '').trim()).filter(Boolean))]
}

export function readFactoryCollaborationStore() {
  const value = readLocalStorage(FACTORY_COLLABORATION_STORAGE_KEY, {})
  return {
    schemaVersion: Number(value?.schemaVersion || ENTERPRISE_SCHEMA_VERSION),
    dataSource: value?.dataSource || getDataProviderName(),
    factories: Array.isArray(value?.factories) ? value.factories : [],
    factoryQuotes: Array.isArray(value?.factoryQuotes) ? value.factoryQuotes : [],
    productionOrders: Array.isArray(value?.productionOrders) ? value.productionOrders : []
  }
}

export function writeFactoryCollaborationStore(value = {}) {
  const current = readFactoryCollaborationStore()
  return writeLocalStorage(FACTORY_COLLABORATION_STORAGE_KEY, {
    ...current,
    ...value,
    schemaVersion: ENTERPRISE_SCHEMA_VERSION,
    dataSource: getDataProviderName()
  })
}

export function normalize(record = {}, options = {}) {
  const context = getCurrentEnterpriseContext()
  const createdAt = record.createdAt || new Date().toISOString()
  const members = (Array.isArray(record.members) ? record.members : []).map((member) => ({
    memberId: String(member.memberId || `factory_member_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`),
    factoryId: String(record.factoryId || member.factoryId || ''),
    enterpriseId: String(record.enterpriseId || member.enterpriseId || context.enterpriseId),
    userId: String(member.userId || ''),
    name: String(member.name || '未命名成员'),
    role: String(member.role || 'factory_coordinator'),
    status: FACTORY_MEMBER_STATUSES.includes(member.status) ? member.status : 'pending',
    createdAt: member.createdAt || createdAt,
    updatedAt: member.updatedAt || member.createdAt || createdAt
  }))
  return normalizeSaasRecord({
    ...record,
    factoryId: String(record.factoryId || ''),
    factoryNo: String(record.factoryNo || ''),
    name: String(record.name || '未命名工厂'),
    shortName: String(record.shortName || record.name || '未命名工厂'),
    status: FACTORY_STATUSES.includes(record.status) ? record.status : 'active',
    verificationStatus: FACTORY_VERIFICATION_STATUSES.includes(record.verificationStatus) ? record.verificationStatus : 'unverified',
    region: String(record.region || ''),
    capabilities: unique(record.capabilities),
    supportedCategories: unique(record.supportedCategories),
    supportedMaterials: unique(record.supportedMaterials),
    supportedProcesses: unique(record.supportedProcesses),
    minimumOrderQuantity: Math.max(0, Number(record.minimumOrderQuantity || 0)),
    monthlyCapacity: Math.max(0, Number(record.monthlyCapacity || 0)),
    leadTimeRange: {
      minDays: Math.max(0, Number(record.leadTimeRange?.minDays || 0)),
      maxDays: Math.max(0, Number(record.leadTimeRange?.maxDays || 0))
    },
    qualityCapabilities: unique(record.qualityCapabilities),
    contactSummary: String(record.contactSummary || ''),
    assetIds: unique(record.assetIds),
    members,
    createdAt,
    updatedAt: record.updatedAt || createdAt
  }, { ...context, ...options })
}

export function getList(filters = {}) {
  const enterpriseId = getCurrentEnterpriseId()
  return filterTenantData(readFactoryCollaborationStore().factories, enterpriseId)
    .map((item) => normalize(item))
    .filter((item) => !filters.status || item.status === filters.status)
    .filter((item) => !filters.verificationStatus || item.verificationStatus === filters.verificationStatus)
    .sort((left, right) => String(right.updatedAt).localeCompare(String(left.updatedAt)))
}

export function getById(factoryId = '') {
  return getList().find((item) => item.factoryId === factoryId) || null
}

export function create(input = {}) {
  const context = getCurrentEnterpriseContext()
  const protectedInput = protectTenantCreate(input, context.enterpriseId)
  if (!protectedInput) return null
  const now = new Date().toISOString()
  const factoryId = String(input.factoryId || `factory_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`)
  const record = normalize({
    ...protectedInput,
    factoryId,
    factoryNo: input.factoryNo || `FAC-${String(Date.now()).slice(-8)}`,
    createdAt: now,
    updatedAt: now
  }, { createdBy: context.userId })
  const store = readFactoryCollaborationStore()
  writeFactoryCollaborationStore({
    factories: [record, ...store.factories.filter((item) => item.factoryId !== factoryId || resolveTenantId(item) !== context.enterpriseId)]
  })
  return record
}

export function update(factoryId = '', patch = {}) {
  const current = getById(factoryId)
  if (!current) return null
  const context = getCurrentEnterpriseContext()
  const protectedRecord = protectTenantUpdate(current, patch, context.enterpriseId)
  if (!protectedRecord) return null
  const record = normalize({ ...protectedRecord, factoryId }, {
    updatedBy: context.userId,
    touchUpdatedAt: new Date().toISOString()
  })
  const store = readFactoryCollaborationStore()
  writeFactoryCollaborationStore({
    factories: store.factories.map((item) => item.factoryId === factoryId && resolveTenantId(item) === context.enterpriseId ? record : item)
  })
  return record
}

