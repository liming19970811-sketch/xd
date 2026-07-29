import { get, remove, set } from '../data-provider/dataProvider.js'

export const PERMISSION_STORAGE_KEY = 'diebiandesign_role_permissions_v1'
export const PERMISSION_SCHEMA_VERSION = 1
export const PERMISSION_SCOPES = Object.freeze(['all', 'project', 'own', 'custom'])

export const DEFAULT_ROLE_PERMISSIONS = Object.freeze([
  Object.freeze({
    role: '管理员',
    permissions: Object.freeze(['*', 'enterprise.manage', 'member.manage', 'all.view']),
    scope: 'all'
  }),
  Object.freeze({
    role: '老板',
    permissions: Object.freeze(['finance.view', 'enterprise.view', 'project.view', 'project.approve', 'delivery.confirm']),
    scope: 'all'
  }),
  Object.freeze({
    role: '项目经理',
    permissions: Object.freeze(['project.manage', 'customer.manage', 'delivery.manage', 'project.approve']),
    scope: 'project'
  }),
  Object.freeze({
    role: '设计师',
    permissions: Object.freeze(['design.manage', 'product.edit']),
    scope: 'own'
  }),
  Object.freeze({
    role: '运营',
    permissions: Object.freeze(['marketing.manage', 'asset.manage', 'product.publish']),
    scope: 'project'
  }),
  Object.freeze({
    role: '销售',
    permissions: Object.freeze(['customer.manage', 'quote.manage']),
    scope: 'own'
  })
])

function uniquePermissions(permissions = []) {
  return Array.from(new Set(
    (Array.isArray(permissions) ? permissions : [])
      .map((permission) => String(permission || '').trim())
      .filter(Boolean)
  ))
}

export function normalize(record = {}) {
  const value = record && typeof record === 'object' && !Array.isArray(record) ? record : {}
  return {
    role: String(value.role || '').trim(),
    permissions: uniquePermissions(value.permissions),
    scope: PERMISSION_SCOPES.includes(value.scope) ? value.scope : 'own'
  }
}

function normalizeStoredRecords(value) {
  if (Array.isArray(value)) return value.map(normalize).filter((item) => item.role)
  if (!value || typeof value !== 'object') return []
  if (Array.isArray(value.rolePermissions)) {
    return value.rolePermissions.map(normalize).filter((item) => item.role)
  }
  return Object.keys(value)
    .filter((role) => !['version', 'schemaVersion', 'dataSource'].includes(role))
    .map((role) => normalize({
      role,
      permissions: Array.isArray(value[role]) ? value[role] : value[role]?.permissions,
      scope: Array.isArray(value[role]) ? 'own' : value[role]?.scope
    }))
    .filter((item) => item.role)
}

function getStoredRecords() {
  return normalizeStoredRecords(get(PERMISSION_STORAGE_KEY, null))
}

function writeRecords(records = []) {
  const rolePermissions = records.map(normalize).filter((item) => item.role)
  set(PERMISSION_STORAGE_KEY, {
    schemaVersion: PERMISSION_SCHEMA_VERSION,
    rolePermissions
  })
  return rolePermissions
}

export function getList() {
  const storedMap = getStoredRecords().reduce((result, item) => {
    result[item.role] = item
    return result
  }, {})
  const records = DEFAULT_ROLE_PERMISSIONS.map((item) => normalize(storedMap[item.role] || item))
  const defaultRoles = new Set(records.map((item) => item.role))
  return [
    ...records,
    ...Object.values(storedMap).filter((item) => !defaultRoles.has(item.role)).map(normalize)
  ]
}

export function getByRole(role = '') {
  const roleName = String(role || '').trim()
  return getList().find((item) => item.role === roleName) || null
}

export function setRolePermission(input = {}) {
  const record = normalize(input)
  if (!record.role) return null
  const stored = getStoredRecords()
  writeRecords([record, ...stored.filter((item) => item.role !== record.role)])
  return record
}

export function updateRolePermission(role = '', patch = {}) {
  const roleName = String(role || '').trim()
  if (!roleName) return null
  const current = getByRole(roleName)
  return setRolePermission({
    ...(current || { role: roleName, permissions: [], scope: 'own' }),
    ...patch,
    role: roleName
  })
}

export function clearRolePermissionOverrides() {
  remove(PERMISSION_STORAGE_KEY)
  return getList()
}
