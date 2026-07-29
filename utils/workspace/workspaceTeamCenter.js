import { getAuditLogs, recordAudit } from '../audit/auditService.js'
import { getCurrentEnterprise, getCurrentMember } from '../auth/authRepository.js'
import { hasPermission } from '../auth/permissionService.js'
import { createInvite, cancelInvite, getInvites } from '../member/memberInviteService.js'
import { getMembers, removeMember, updateMemberRole, updateMemberStatus } from '../member/memberService.js'
import { getPermissionGroups } from '../permission/permissionCatalog.js'
import {
  DEFAULT_ROLE_PERMISSIONS,
  getDefaultRoleLabel,
  listRolePermissionRecords,
  saveRolePermissions
} from '../permission/rolePermissionService.js'
import { getCurrentEnterpriseId } from '../tenant/tenantContext.js'

export const WORKSPACE_TEAM_TABS = Object.freeze([
  { key: 'overview', label: '团队概览' },
  { key: 'members', label: '成员管理' },
  { key: 'roles', label: '角色权限' },
  { key: 'audit-logs', label: '审计日志' }
])

export const DATA_SCOPE_OPTIONS = Object.freeze([
  { key: 'own', label: '仅本人创建', desc: '只能访问自己创建或负责的数据。' },
  { key: 'project', label: '所属项目', desc: '只能访问被分配项目内的数据。' },
  { key: 'team', label: '所属团队', desc: '可访问同团队协作数据。' },
  { key: 'enterprise', label: '企业全部数据', desc: '可访问当前企业全部授权数据。' }
])

export const PROTECTED_ACTIONS = Object.freeze([
  { action: 'pattern_archive', label: '删除或归档版型', permission: 'pattern_library.delete' },
  { action: 'batch_download', label: '批量下载', permission: 'delivery.download' },
  { action: 'batch_approve', label: '批量审核', permission: 'batch.approve' },
  { action: 'formal_delivery', label: '正式交付', permission: 'delivery.manage' },
  { action: 'role_change', label: '修改角色', permission: 'member.manage' },
  { action: 'member_remove', label: '移除成员', permission: 'member.manage' },
  { action: 'quota_adjust', label: '调整企业额度', permission: 'quota.manage' },
  { action: 'training_export', label: '导出训练数据', permission: 'pattern_library.export' }
])

function nowIso() {
  return new Date().toISOString()
}

function currentEnterpriseId() {
  return String(getCurrentEnterpriseId() || 'local_enterprise')
}

function currentMember() {
  return getCurrentMember() || {}
}

function maskAccount(value = '') {
  const text = String(value || '').trim()
  if (!text) return ''
  if (text.includes('@')) {
    const [name, domain] = text.split('@')
    return `${name.slice(0, 2)}***@${domain || ''}`
  }
  return `${text.slice(0, 3)}****${text.slice(-2)}`
}

function normalizeRoleCode(value = '') {
  const role = String(value || '').trim()
  const aliases = {
    管理员: 'admin',
    企业管理员: 'admin',
    项目负责人: 'project_owner',
    设计师: 'designer',
    版师: 'pattern_maker',
    审核员: 'reviewer',
    交付专员: 'delivery_specialist',
    运营: 'operator',
    财务: 'finance',
    查看者: 'viewer',
    只读成员: 'viewer'
  }
  return aliases[role] || role || 'viewer'
}

function createSyntheticMember(member = {}) {
  const role = normalizeRoleCode(member.role || 'viewer')
  const enterprise = getCurrentEnterprise()
  return {
    memberId: member.memberId || member.userId || '',
    userId: member.userId || '',
    name: member.name || member.userName || '未命名成员',
    avatar: member.avatar || '',
    account: maskAccount(member.account || member.email || member.phone || member.targetAccount || ''),
    enterpriseName: enterprise.enterpriseName || '当前企业',
    role,
    roleLabel: getDefaultRoleLabel(role),
    projectCount: Array.isArray(member.projectIds) ? member.projectIds.length : (member.projectId ? 1 : 0),
    status: member.status || 'pending',
    lastLoginAt: member.lastLoginAt || member.updatedAt || member.createdAt || '',
    createdAt: member.createdAt || nowIso()
  }
}

function normalizeRoleRecord(record = {}) {
  const role = record.role || ''
  const permissions = Array.isArray(record.permissions) ? record.permissions : []
  return {
    ...record,
    role,
    label: record.label || getDefaultRoleLabel(role) || role,
    permissions,
    permissionCount: permissions.length,
    builtin: Boolean(record.builtin),
    locked: role === 'admin',
    dataScope: role === 'admin' ? 'enterprise' : (record.scope || 'project')
  }
}

function normalizeAudit(record = {}) {
  return {
    logId: record.logId || record.auditId || '',
    enterpriseId: record.enterpriseId || currentEnterpriseId(),
    operatorId: record.operatorId || record.userId || '',
    operator: record.operator || '系统',
    action: record.action || '',
    module: record.module || record.targetType || record.resourceType || '',
    resourceType: record.resourceType || record.targetType || '',
    resourceId: record.resourceId || record.targetId || '',
    beforeSummary: record.beforeSummary || summarizeChange(record.before),
    afterSummary: record.afterSummary || summarizeChange(record.after),
    deviceInfo: record.deviceInfo || record.ip || '未采集',
    projectId: record.projectId || '',
    createdAt: record.createdAt || ''
  }
}

function summarizeChange(value = {}) {
  if (!value || typeof value !== 'object') return ''
  return Object.keys(value).slice(0, 4).join('、')
}

function assertCan(permission = '') {
  const member = currentMember()
  return hasPermission(permission, { member })
}

function recordTeamAudit(action = '', resourceType = '', resourceId = '', before = {}, after = {}) {
  const operator = currentMember()
  return recordAudit({
    enterpriseId: currentEnterpriseId(),
    operatorId: operator.memberId || operator.userId || '',
    userId: operator.userId || operator.memberId || '',
    operator: operator.name || operator.role || '当前成员',
    action,
    targetType: resourceType,
    targetId: resourceId,
    resourceType,
    resourceId,
    before,
    after,
    createdAt: nowIso()
  })
}

export async function loadWorkspaceTeamCenter() {
  const enterprise = getCurrentEnterprise()
  const canViewMembers = assertCan('member.view') || assertCan('member.manage')
  const canManageMembers = assertCan('member.manage')
  const canViewRoles = assertCan('role.view') || assertCan('role.manage')
  const canManageRoles = assertCan('role.manage')
  const canViewAudit = assertCan('audit.view')

  const members = canViewMembers ? (await getMembers()).map(createSyntheticMember) : []
  const invites = canManageMembers ? (await getInvites()).map((item) => ({
    ...item,
    targetAccountMasked: maskAccount(item.targetAccount)
  })) : []
  const roles = canViewRoles ? listRolePermissionRecords().map(normalizeRoleRecord) : []
  const auditLogs = canViewAudit ? getAuditLogs().map(normalizeAudit).slice(0, 80) : []

  return {
    enterprise,
    permissions: {
      canViewMembers,
      canManageMembers,
      canViewRoles,
      canManageRoles,
      canViewAudit
    },
    members,
    invites,
    roles,
    permissionGroups: getPermissionGroups(),
    auditLogs,
    dataScopes: DATA_SCOPE_OPTIONS,
    protectedActions: PROTECTED_ACTIONS
  }
}

export async function inviteWorkspaceMember(input = {}) {
  if (!assertCan('member.manage')) return { success: false, errorCode: 'forbidden' }
  const result = await createInvite({
    targetAccount: input.targetAccount,
    role: input.role || 'viewer'
  })
  if (result && result.success) {
    recordTeamAudit('邀请成员', 'member_invite', result.invite && result.invite.inviteId, {}, { role: input.role || 'viewer' })
  }
  return result
}

export async function cancelWorkspaceInvite(inviteId = '') {
  if (!assertCan('member.manage')) return { success: false, errorCode: 'forbidden' }
  const result = await cancelInvite(inviteId)
  if (result && result.success) recordTeamAudit('撤销邀请', 'member_invite', inviteId, { status: 'pending' }, { status: 'cancelled' })
  return result
}

export async function updateWorkspaceMemberRole(member = {}, role = '') {
  if (!assertCan('member.manage')) return { success: false, errorCode: 'forbidden' }
  if (!member.memberId || !role || member.role === role) return { success: false, errorCode: 'invalid_role_change' }
  const result = await updateMemberRole(member.memberId, role)
  const success = result && (result.success || result.memberId)
  if (success) recordTeamAudit('修改角色', 'enterprise_member', member.memberId, { role: member.role }, { role })
  return result && result.success === false ? result : { success: Boolean(success), member: result.member || result }
}

export async function updateWorkspaceMemberStatus(member = {}, status = '') {
  if (!assertCan('member.manage')) return { success: false, errorCode: 'forbidden' }
  if (!member.memberId || !status) return { success: false, errorCode: 'invalid_member_status' }
  const result = await updateMemberStatus(member.memberId, status)
  const success = result && (result.success || result.memberId)
  if (success) recordTeamAudit(status === 'disabled' ? '暂停账号' : '启用账号', 'enterprise_member', member.memberId, { status: member.status }, { status })
  return result && result.success === false ? result : { success: Boolean(success), member: result.member || result }
}

export async function removeWorkspaceMember(member = {}) {
  if (!assertCan('member.manage')) return { success: false, errorCode: 'forbidden' }
  if (!member.memberId) return { success: false, errorCode: 'member_required' }
  const removed = removeMember(member.memberId)
  if (removed) {
    recordTeamAudit('移除成员', 'enterprise_member', member.memberId, { status: member.status, role: member.role }, { removed: true })
    return { success: true }
  }
  const disabled = await updateWorkspaceMemberStatus(member, 'disabled')
  return disabled && disabled.success ? { success: true, fallback: 'disabled' } : { success: false, errorCode: disabled?.errorCode || 'remove_failed' }
}

export async function saveWorkspaceRolePermissions(role = '', permissions = []) {
  if (!assertCan('role.manage')) return { success: false, errorCode: 'forbidden' }
  if (role === 'admin') return { success: false, errorCode: 'admin_role_locked' }
  const before = { permissions: DEFAULT_ROLE_PERMISSIONS[role] || [] }
  const result = await saveRolePermissions({ role, permissions })
  if (result && result.success) recordTeamAudit('保存角色权限', 'role_permission', role, before, { permissions })
  return result
}
