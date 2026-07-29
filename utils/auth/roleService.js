import { getCurrentEnterprise, getCurrentMember, getCurrentUser } from './authRepository.js'
import { DEFAULT_ROLE_PERMISSIONS } from './permissionRepository.js'
import {
  ROLE_SCOPES,
  create as createRoleRecord,
  getById,
  getList,
  remove as removeRoleRecord,
  update as updateRoleRecord
} from './roleRepository.js'
import { recordAudit } from '../audit/auditService.js'

export const ROLE_PERMISSION_OPTIONS = Object.freeze([
  'enterprise.view', 'enterprise.manage', 'member.manage', 'finance.view', 'finance.manage',
  'customer.view', 'customer.manage', 'quote.manage', 'project.view', 'project.manage', 'project.approve',
  'design.view', 'design.edit', 'product.view', 'product.edit', 'product.publish',
  'asset.view', 'asset.manage', 'marketing.manage', 'delivery.view', 'delivery.manage', 'delivery.confirm'
])

function resolveActor(input = {}) {
  const member = input.member || getCurrentMember()
  const user = getCurrentUser()
  return {
    enterpriseId: input.enterpriseId || member.enterpriseId || getCurrentEnterprise().enterpriseId,
    userId: input.userId || member.userId || user.userId,
    operator: input.operator || member.name || user.name || '默认管理员'
  }
}

function auditRole(action, before, after, actor) {
  return recordAudit({
    enterpriseId: actor.enterpriseId,
    userId: actor.userId,
    operator: actor.operator,
    action,
    targetType: 'role',
    targetId: after?.roleId || before?.roleId || '',
    before: before || {},
    after: after || {}
  })
}

export function getDefaultRoles() {
  return DEFAULT_ROLE_PERMISSIONS.map((item) => ({
    roleId: `default_${item.role}`,
    enterpriseId: '',
    roleName: item.role,
    permissions: [...item.permissions],
    scope: item.scope,
    projectIds: [],
    builtin: true
  }))
}

export function getRoles(enterpriseId = getCurrentEnterprise().enterpriseId, options = {}) {
  const customRoles = getList({ enterpriseId }).map((item) => ({ ...item, builtin: false }))
  return options.includeDefaults === false ? customRoles : [...getDefaultRoles(), ...customRoles]
}

export function createRole(input = {}, context = {}) {
  const actor = resolveActor({ ...context, enterpriseId: input.enterpriseId || context.enterpriseId })
  if (getDefaultRoles().some((item) => item.roleName === String(input.roleName || '').trim())) return null
  const record = createRoleRecord({
    ...input,
    enterpriseId: actor.enterpriseId,
    createdBy: input.createdBy || actor.userId,
    updatedBy: actor.userId
  })
  if (record) auditRole('创建自定义角色', {}, record, actor)
  return record
}

export function updateRole(roleId = '', patch = {}, context = {}) {
  const before = getById(roleId)
  if (!before) return null
  if (patch.roleName && getDefaultRoles().some((item) => item.roleName === String(patch.roleName).trim())) return null
  const actor = resolveActor({ ...context, enterpriseId: before.enterpriseId })
  const after = updateRoleRecord(roleId, { ...patch, updatedBy: actor.userId })
  if (after) auditRole('修改角色配置', before, after, actor)
  return after
}

export function updateRolePermissions(roleId = '', permissions = [], context = {}) {
  return updateRole(roleId, { permissions }, context)
}

export function deleteRole(roleId = '', context = {}) {
  const before = getById(roleId)
  if (!before) return null
  const actor = resolveActor({ ...context, enterpriseId: before.enterpriseId })
  const removed = removeRoleRecord(roleId)
  if (removed) auditRole('删除自定义角色', before, {}, actor)
  return removed
}

export function isRoleScope(scope = '') {
  return ROLE_SCOPES.includes(scope)
}
