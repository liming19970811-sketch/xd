import { getCurrentEnterpriseContext, normalizeSaasRecord, readLocalStorage, writeLocalStorage } from './enterpriseRepository.js'
import { canAccessTenantData, filterTenantData, normalizeTenantData, protectTenantCreate, protectTenantUpdate, resolveTenantId } from '../tenant/tenantGuard.js'
import { getCurrentEnterpriseId } from '../tenant/tenantContext.js'

const STORAGE_KEY = 'diebiandesign_projects'
const META_STORAGE_KEY = 'diebiandesign_enterprise_project_meta_v1'

export function normalize(record = {}, options = {}) {
  return normalizeSaasRecord({ ...record, projectId: record.projectId || '' }, options)
}

export function getProjectMetaMap() {
  const value = readLocalStorage(META_STORAGE_KEY, {})
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const context = getCurrentEnterpriseContext()
  return Object.keys(value).reduce((result, storageKey) => {
    const source = value[storageKey] || {}
    const projectId = source.projectId || (storageKey.includes('::') ? storageKey.split('::').slice(1).join('::') : storageKey)
    const tenantRecord = normalizeTenantData({ ...source, projectId })
    if (canAccessTenantData(tenantRecord, context.enterpriseId)) result[projectId] = normalize(tenantRecord, context)
    return result
  }, {})
}

export function getProjectMeta(projectId = '') {
  return getProjectMetaMap()[projectId] || null
}

export function updateProjectMeta(projectId = '', patch = {}) {
  if (!projectId) return null
  const records = getProjectMetaMap()
  const current = records[projectId] || {}
  const context = getCurrentEnterpriseContext()
  if (patch.enterpriseId && patch.enterpriseId !== context.enterpriseId) return null
  const record = normalize({ ...current, ...patch, projectId, enterpriseId: context.enterpriseId }, { ...context, updatedBy: patch.updatedBy || patch.userId, touchUpdatedAt: new Date().toISOString() })
  const raw = readLocalStorage(META_STORAGE_KEY, {})
  const next = raw && typeof raw === 'object' && !Array.isArray(raw) ? { ...raw } : {}
  Object.keys(next).forEach((key) => {
    const item = next[key] || {}
    const itemProjectId = item.projectId || (key.includes('::') ? key.split('::').slice(1).join('::') : key)
    if (itemProjectId === projectId && resolveTenantId(item) === context.enterpriseId) delete next[key]
  })
  next[`${context.enterpriseId}::${projectId}`] = record
  writeLocalStorage(META_STORAGE_KEY, next)
  return record
}

export function getList() {
  const records = readLocalStorage(STORAGE_KEY, [])
  const meta = getProjectMetaMap()
  const context = getCurrentEnterpriseContext()
  return filterTenantData(records, getCurrentEnterpriseId()).map((item) => normalize({ ...item, ...(meta[item.projectId] || {}) }, context))
}

export function getById(projectId = '') {
  return getList().find((item) => item.projectId === projectId) || getProjectMeta(projectId)
}

export function create(input = {}) {
  const now = new Date().toISOString()
  const context = getCurrentEnterpriseContext()
  const protectedInput = protectTenantCreate(input, context.enterpriseId)
  if (!protectedInput) return null
  const record = normalize({ ...protectedInput, projectId: input.projectId || `project_${Date.now()}`, createdAt: input.createdAt || now, updatedAt: input.updatedAt || now }, context)
  const records = readLocalStorage(STORAGE_KEY, [])
  const rawRecords = Array.isArray(records) ? records : []
  writeLocalStorage(STORAGE_KEY, [record, ...rawRecords.filter((item) => item.projectId !== record.projectId || resolveTenantId(item) !== context.enterpriseId)])
  return record
}

export function update(projectId = '', patch = {}) {
  const records = getList()
  const current = records.find((item) => item.projectId === projectId)
  if (!current) return null
  const context = getCurrentEnterpriseContext()
  const protectedRecord = protectTenantUpdate(current, patch, context.enterpriseId)
  if (!protectedRecord) return null
  const record = normalize({ ...protectedRecord, projectId }, { ...context, updatedBy: patch.updatedBy || patch.userId, touchUpdatedAt: new Date().toISOString() })
  const rawRecords = readLocalStorage(STORAGE_KEY, [])
  writeLocalStorage(STORAGE_KEY, (Array.isArray(rawRecords) ? rawRecords : []).map((item) => item.projectId === projectId && resolveTenantId(item) === context.enterpriseId ? record : item))
  return record
}
