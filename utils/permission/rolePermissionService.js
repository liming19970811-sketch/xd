import { get, isDataProviderDevelopment, set } from '../data-provider/dataProvider.js'
import { getCurrentSession } from '../auth/authSessionService.js'
import { callEnterpriseMember } from '../auth/enterpriseMemberTransport.js'
import { getCurrentEnterpriseId } from '../tenant/tenantContext.js'
import { protectTenantCreate, protectTenantUpdate } from '../tenant/tenantGuard.js'
import { getPermissionKeys } from './permissionCatalog.js'

export const ROLE_PERMISSION_STORAGE_KEY = 'enterprise_role_permissions'

export const DEFAULT_ROLES = Object.freeze([
  { role: 'admin', label: '企业管理员' },
  { role: 'project_owner', label: '项目负责人' },
  { role: 'designer', label: '\u8bbe\u8ba1\u5e08' },
  { role: 'pattern_maker', label: '版师' },
  { role: 'reviewer', label: '审核员' },
  { role: 'delivery_specialist', label: '交付专员' },
  { role: 'operator', label: '\u8fd0\u8425' },
  { role: 'finance', label: '\u8d22\u52a1' },
  { role: 'viewer', label: '只读成员' }
])

export const DEFAULT_ROLE_PERMISSIONS = Object.freeze({
  admin: Object.freeze(getPermissionKeys()),
  project_owner: Object.freeze(['project.view', 'project.manage', 'product.view', 'product.manage', 'quote.view', 'order.view', 'delivery.view', 'batch.view', 'batch.create', 'batch.edit']),
  designer: Object.freeze(['ai_output.view', 'ai_output.create', 'ai_output.edit', 'pattern_library.view', 'sample.view', 'sample.create', 'project.view', 'project.manage', 'product.view']),
  pattern_maker: Object.freeze(['pattern_making.view', 'pattern_making.create', 'pattern_making.edit', 'pattern_making.approve', 'pattern_library.view', 'pattern_library.create', 'pattern_library.edit', 'sample.view', 'sample.create', 'sample.approve', 'project.view', 'product.view']),
  reviewer: Object.freeze(['ai_output.view', 'pattern_making.view', 'pattern_making.approve', 'sample.view', 'sample.approve', 'batch.view', 'batch.approve', 'delivery.view', 'delivery.approve', 'project.view', 'product.view']),
  delivery_specialist: Object.freeze(['delivery.view', 'delivery.manage', 'delivery.download', 'delivery.export', 'batch.view', 'project.view', 'product.view']),
  operator: Object.freeze(['product.view', 'order.view', 'delivery.view', 'batch.view', 'factory.view', 'factory.quote', 'factory.collaborate', 'sample.view', 'sample.collaborate']),
  finance: Object.freeze(['quote.view', 'order.view']),
  viewer: Object.freeze(['project.view', 'product.view'])
})

function nowIso() {
  return new Date().toISOString()
}

function uniquePermissions(permissions = []) {
  const valid = new Set(getPermissionKeys())
  return Array.from(new Set(
    (Array.isArray(permissions) ? permissions : [])
      .map((item) => String(item || '').trim())
      .filter((item) => valid.has(item))
  ))
}

function normalizeRole(value = '') {
  const role = String(value || '').trim()
  const aliases = {
    管理员: 'admin',
    企业管理员: 'admin',
    设计师: 'designer',
    运营: 'operator',
    财务: 'finance',
    查看者: 'viewer',
    只读成员: 'viewer',
    版师: 'pattern_maker',
    审核员: 'reviewer',
    交付专员: 'delivery_specialist',
    项目负责人: 'project_owner'
  }
  return aliases[role] || role
}

function readStore() {
  const records = get(ROLE_PERMISSION_STORAGE_KEY, [])
  return Array.isArray(records) ? records : []
}

function writeStore(records = []) {
  set(ROLE_PERMISSION_STORAGE_KEY, Array.isArray(records) ? records : [])
}

function isLocalMockSession() {
  const session = getCurrentSession()
  return !session || session.authSource === 'local_mock'
}

function normalizeRecord(record = {}) {
  const createdAt = record.createdAt || nowIso()
  return {
    enterpriseId: String(record.enterpriseId || getCurrentEnterpriseId()).trim(),
    role: normalizeRole(record.role || record.roleCode),
    permissions: uniquePermissions(record.permissions),
    version: Number(record.version || 0),
    source: record.source || '',
    createdAt,
    updatedAt: record.updatedAt || createdAt
  }
}

function logRolePermission(role = '', permissionCount = 0, success = false, errorCode = '') {
  if (!isDataProviderDevelopment()) return
  console.info('[role:permission]', {
    role,
    permissionCount,
    success: Boolean(success),
    errorCode: errorCode || ''
  })
}

export function getDefaultRoleLabel(role = '') {
  const normalizedRole = normalizeRole(role)
  const target = DEFAULT_ROLES.find((item) => item.role === normalizedRole)
  return target ? target.label : normalizedRole
}

export function getDefaultRoles() {
  return DEFAULT_ROLES.map((item) => ({
    ...item,
    permissions: [...(DEFAULT_ROLE_PERMISSIONS[item.role] || [])]
  }))
}

export function getStoredRolePermissions() {
  const enterpriseId = getCurrentEnterpriseId()
  return readStore()
    .map(normalizeRecord)
    .filter((item) => item.enterpriseId === enterpriseId && item.role)
}

export function getRolePermissionRecord(role = '') {
  const roleName = normalizeRole(role)
  if (!roleName) return null
  const stored = getStoredRolePermissions().find((item) => item.role === roleName)
  if (roleName === 'admin') {
    return {
      ...(stored || {}),
      enterpriseId: getCurrentEnterpriseId(),
      role: roleName,
      permissions: getPermissionKeys(),
      createdAt: stored ? stored.createdAt : '',
      updatedAt: stored ? stored.updatedAt : ''
    }
  }
  if (stored) return stored
  const defaults = DEFAULT_ROLE_PERMISSIONS[roleName]
  if (!defaults) return { enterpriseId: getCurrentEnterpriseId(), role: roleName, permissions: [], createdAt: '', updatedAt: '' }
  return {
    enterpriseId: getCurrentEnterpriseId(),
    role: roleName,
    permissions: [...defaults],
    createdAt: '',
    updatedAt: ''
  }
}

export function getRolePermissions(role = '') {
  const record = getRolePermissionRecord(role)
  return record ? [...record.permissions] : []
}

export function listRolePermissionRecords() {
  const defaults = getDefaultRoles().map((item) => {
    const record = getRolePermissionRecord(item.role)
    return {
      enterpriseId: getCurrentEnterpriseId(),
      role: item.role,
      label: item.label,
      permissions: record ? record.permissions : [],
      builtin: true,
      createdAt: record ? record.createdAt : '',
      updatedAt: record ? record.updatedAt : ''
    }
  })
  const defaultRoleSet = new Set(defaults.map((item) => item.role))
  const custom = getStoredRolePermissions()
    .filter((item) => !defaultRoleSet.has(item.role))
    .map((item) => ({
      ...item,
      label: item.role,
      builtin: false
    }))
  return [...defaults, ...custom]
}

function saveRolePermissionsLocal(input = {}) {
  const role = normalizeRole(input.role)
  const permissions = uniquePermissions(input.permissions)
  if (!role) {
    logRolePermission(role, permissions.length, false, 'role_required')
    return { success: false, errorCode: 'role_required' }
  }
  const enterpriseId = getCurrentEnterpriseId()
  if (input.enterpriseId && input.enterpriseId !== enterpriseId) {
    logRolePermission(role, permissions.length, false, 'tenant_denied')
    return { success: false, errorCode: 'tenant_denied' }
  }
  const current = getStoredRolePermissions().find((item) => item.role === role)
  const now = nowIso()
  const protectedRecord = current
    ? protectTenantUpdate(current, { permissions, updatedAt: now }, enterpriseId)
    : protectTenantCreate({ role, permissions, createdAt: now, updatedAt: now }, enterpriseId)
  if (!protectedRecord) {
    logRolePermission(role, permissions.length, false, 'tenant_denied')
    return { success: false, errorCode: 'tenant_denied' }
  }
  const record = normalizeRecord(protectedRecord)
  const records = readStore().map(normalizeRecord)
  writeStore([record, ...records.filter((item) => !(item.enterpriseId === enterpriseId && item.role === role))])
  logRolePermission(role, permissions.length, true, '')
  return { success: true, record }
}

function cacheRolePermissionRecords(records = []) {
  const enterpriseId = getCurrentEnterpriseId()
  const normalized = (Array.isArray(records) ? records : []).map(normalizeRecord)
  const existing = readStore().map(normalizeRecord).filter((item) => item.enterpriseId !== enterpriseId)
  writeStore([...normalized, ...existing])
  return normalized
}

export async function fetchRolePermissionRecords() {
  if (isLocalMockSession()) return { success: true, records: listRolePermissionRecords(), source: 'local_mock' }
  const result = await callEnterpriseMember('listRolePermissions')
  if (!result || !result.success) {
    logRolePermission('', 0, false, result && result.errorCode)
    return { success: false, errorCode: result?.errorCode || 'cloud_call_failed', message: result?.message || '角色权限加载失败' }
  }
  const records = cacheRolePermissionRecords(result.data && result.data.roles)
  logRolePermission('', records.length, true, '')
  return { success: true, records: listRolePermissionRecords(), source: 'cloud' }
}

export async function saveRolePermissions(input = {}) {
  const role = normalizeRole(input.role)
  const permissions = uniquePermissions(input.permissions)
  if (isLocalMockSession()) return saveRolePermissionsLocal(input)
  const result = await callEnterpriseMember('updateRolePermissions', {
    role,
    permissions,
    version: Number(input.version || 0)
  })
  if (!result || !result.success) {
    logRolePermission(role, permissions.length, false, result && result.errorCode)
    return {
      success: false,
      errorCode: result?.errorCode || 'cloud_call_failed',
      message: result?.message || '权限保存失败'
    }
  }
  cacheRolePermissionRecords([result.data && result.data.record])
  logRolePermission(role, permissions.length, true, '')
  return { success: true, record: normalizeRecord(result.data.record), source: 'cloud' }
}

export function hasRolePermission(role = '', permission = '') {
  const permissions = getRolePermissions(role)
  return permissions.includes(permission)
}
