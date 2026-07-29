import { get, set } from '../data-provider/dataProvider.js'
import { getCurrentEnterpriseId } from '../tenant/tenantContext.js'
import { protectTenantCreate, protectTenantUpdate } from '../tenant/tenantGuard.js'

export const ROLE_STORAGE_KEY = 'diebiandesign_enterprise_roles_v1'
export const ROLE_SCHEMA_VERSION = 1
export const ROLE_SCOPES = Object.freeze(['all', 'project', 'own', 'custom'])

function unique(values = []) {
  return Array.from(new Set(
    (Array.isArray(values) ? values : [])
      .map((item) => String(item || '').trim())
      .filter(Boolean)
  ))
}

export function normalize(record = {}) {
  const value = record && typeof record === 'object' && !Array.isArray(record) ? record : {}
  const createdAt = value.createdAt || new Date().toISOString()
  return {
    roleId: String(value.roleId || '').trim(),
    enterpriseId: String(value.enterpriseId || 'default_enterprise').trim(),
    roleName: String(value.roleName || value.role || '').trim(),
    permissions: unique(value.permissions),
    scope: ROLE_SCOPES.includes(value.scope) ? value.scope : 'own',
    projectIds: unique(value.projectIds),
    createdBy: String(value.createdBy || 'default_admin').trim(),
    createdAt,
    updatedBy: String(value.updatedBy || value.createdBy || 'default_admin').trim(),
    updatedAt: value.updatedAt || createdAt,
    schemaVersion: ROLE_SCHEMA_VERSION,
    dataSource: value.dataSource === 'mock' ? 'mock' : 'local'
  }
}

function readRecords() {
  const value = get(ROLE_STORAGE_KEY, [])
  const records = Array.isArray(value) ? value : (Array.isArray(value?.roles) ? value.roles : [])
  return records.map(normalize).filter((item) => item.roleId && item.roleName)
}

function writeRecords(records = []) {
  const roles = records.map(normalize).filter((item) => item.roleId && item.roleName)
  set(ROLE_STORAGE_KEY, { schemaVersion: ROLE_SCHEMA_VERSION, dataSource: 'local', roles })
  return roles
}

export function getList(filters = {}) {
  const enterpriseId = getCurrentEnterpriseId()
  if (filters.enterpriseId && filters.enterpriseId !== enterpriseId) return []
  return readRecords()
    .filter((item) => item.enterpriseId === enterpriseId)
    .sort((left, right) => String(right.updatedAt).localeCompare(String(left.updatedAt)))
}

export function getById(roleId = '', enterpriseId = '') {
  if (enterpriseId && enterpriseId !== getCurrentEnterpriseId()) return null
  return getList({ enterpriseId }).find((item) => item.roleId === roleId) || null
}

export function getByName(roleName = '', enterpriseId = '') {
  if (enterpriseId && enterpriseId !== getCurrentEnterpriseId()) return null
  const name = String(roleName || '').trim()
  return getList({ enterpriseId }).find((item) => item.roleName === name) || null
}

export function create(input = {}) {
  const enterpriseId = getCurrentEnterpriseId()
  const protectedInput = protectTenantCreate(input, enterpriseId)
  if (!protectedInput) return null
  const now = new Date().toISOString()
  const record = normalize({
    ...protectedInput,
    roleId: input.roleId || `role_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    createdAt: input.createdAt || now,
    updatedAt: now
  })
  if (!record.roleName) return null
  const records = readRecords()
  const duplicated = records.some((item) => item.enterpriseId === record.enterpriseId && item.roleName === record.roleName)
  if (duplicated) return null
  writeRecords([record, ...records.filter((item) => item.roleId !== record.roleId)])
  return record
}

export function update(roleId = '', patch = {}) {
  const enterpriseId = getCurrentEnterpriseId()
  const records = readRecords()
  const current = records.find((item) => item.roleId === roleId)
  const protectedRecord = protectTenantUpdate(current, patch, enterpriseId)
  if (!protectedRecord) return null
  const next = normalize({ ...protectedRecord, roleId, updatedAt: new Date().toISOString() })
  const duplicated = records.some((item) => item.roleId !== roleId && item.enterpriseId === next.enterpriseId && item.roleName === next.roleName)
  if (!next.roleName || duplicated) return null
  writeRecords(records.map((item) => item.roleId === roleId ? next : item))
  return next
}

export function remove(roleId = '') {
  const enterpriseId = getCurrentEnterpriseId()
  const records = readRecords()
  const current = records.find((item) => item.roleId === roleId)
  if (!current || current.enterpriseId !== enterpriseId) return null
  writeRecords(records.filter((item) => item.roleId !== roleId))
  return current
}
