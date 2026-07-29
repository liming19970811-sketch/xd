import { hasPermission } from './permissionService.js'

function getPermissionDomain(permission = '') {
  return String(permission || '').trim().split('.')[0]
}

export function canView(permission = '', context = {}) {
  const permissionName = String(permission || '').trim()
  if (!permissionName) return false
  if (hasPermission(permissionName, context)) return true
  const domain = getPermissionDomain(permissionName)
  if (!domain || !permissionName.endsWith('.view')) return false
  return [
    `${domain}.manage`,
    `${domain}.edit`,
    `${domain}.publish`,
    `${domain}.confirm`,
    `${domain}.approve`
  ].some((candidate) => hasPermission(candidate, context))
}

export function canEdit(permission = '', context = {}) {
  const permissionName = String(permission || '').trim()
  if (!permissionName) return false
  if (hasPermission(permissionName, context)) return true
  const domain = getPermissionDomain(permissionName)
  return Boolean(domain && permissionName.endsWith('.edit') && hasPermission(`${domain}.manage`, context))
}

export function canOperate(permission = '', context = {}) {
  const permissionName = String(permission || '').trim()
  if (!permissionName) return false
  if (hasPermission(permissionName, context)) return true
  const domain = getPermissionDomain(permissionName)
  return Boolean(domain && hasPermission(`${domain}.manage`, context))
}
