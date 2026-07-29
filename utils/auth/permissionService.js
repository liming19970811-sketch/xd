import { getCurrentMember, getCurrentUser } from './authRepository.js'
import { getById as getCustomRoleById, getByName as getCustomRoleByName } from './roleRepository.js'
import { getRolePermissions as getEnterpriseRolePermissions } from '../permission/rolePermissionService.js'

function resolveMember(context = {}) {
  if (typeof context === 'string') {
    return { role: context, status: 'active', userId: getCurrentUser().userId }
  }
  if (context.member) return context.member
  if (context.role) {
    return {
      ...context,
      status: context.status || 'active',
      userId: context.userId || getCurrentUser().userId
    }
  }
  return getCurrentMember()
}

function matchesPermission(grantedPermissions = [], permission = '') {
  if (!permission) return false
  if (grantedPermissions.includes('*') || grantedPermissions.includes(permission)) return true
  return permission.endsWith('.view') && grantedPermissions.includes('all.view')
}

function resolveProjectIds(context = {}, member = {}, rolePermission = {}) {
  if (Array.isArray(context.projectIds)) return context.projectIds
  if (Array.isArray(member.projectIds) && member.projectIds.length) return member.projectIds
  if (member.projectId) return [member.projectId]
  return Array.isArray(rolePermission.projectIds) ? rolePermission.projectIds : []
}

function getCustomRole(member = {}) {
  const enterpriseId = member.enterpriseId || ''
  if (member.roleId) {
    const record = getCustomRoleById(member.roleId, enterpriseId)
    if (record) return record
  }
  return getCustomRoleByName(member.role || '', enterpriseId)
}

export function getRolePermission(role = '', context = {}) {
  const member = resolveMember(context)
  const roleName = role || member.role || getCurrentMember().role
  const customRole = getCustomRole({ ...member, role: roleName })
  if (customRole) {
    return { ...customRole, role: customRole.roleName, permissions: [...customRole.permissions] }
  }
  const permissions = getEnterpriseRolePermissions(roleName)
  return { role: roleName, permissions, scope: 'all' }
}

export function getRolePermissions(role = '', context = {}) {
  const record = getRolePermission(role, context)
  return record ? [...record.permissions] : []
}

export function getRoleScope(role = '', context = {}) {
  const record = getRolePermission(role, context)
  return record ? record.scope : ''
}

export function hasPermission(permission = '', context = {}) {
  const member = resolveMember(context)
  if (!member || member.status !== 'active') return false
  return matchesPermission(getRolePermissions(member.role, { member }), permission)
}

export function canAccess(permission = '', resource = {}, context = {}) {
  const member = resolveMember(context)
  if (!hasPermission(permission, { member })) return false
  const rolePermission = getRolePermission(member.role, { member })
  const scope = rolePermission?.scope || ''
  if (scope === 'all') return true

  const target = resource && typeof resource === 'object' && !Array.isArray(resource) ? resource : {}
  if (scope === 'project') {
    const projectId = target.projectId || ''
    if (!projectId) return true
    const projectIds = resolveProjectIds(context, member, rolePermission)
    return Array.isArray(projectIds) && projectIds.includes(projectId)
  }

  if (scope === 'own') {
    const ownerId = target.userId || target.ownerId || target.createdBy || target.assignedUserId || ''
    if (!ownerId) return true
    return ownerId === member.userId
  }

  if (scope === 'custom') {
    const projectId = target.projectId || ''
    if (!projectId) return true
    const projectIds = resolveProjectIds(context, member, rolePermission)
    return Array.isArray(projectIds) && projectIds.includes(projectId)
  }

  return false
}
