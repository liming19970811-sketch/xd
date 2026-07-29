const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8')
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function includesAll(source, values, label) {
  values.forEach((value) => {
    assert(source.includes(value), `${label} missing: ${value}`)
  })
}

const cloudFunction = read('cloudfunctions/enterprise_member/index.js')
const permissionCatalog = read('utils/permission/permissionCatalog.js')
const membersPage = read('pages/enterprise-web/members.vue')
const rolesPage = read('pages/enterprise-web/roles.vue')
const memberService = read('utils/member/memberService.js')
const inviteService = read('utils/member/memberInviteService.js')
const roleService = read('utils/permission/rolePermissionService.js')

includesAll(cloudFunction, [
  'getCurrentMember',
  'listMembers',
  'getMemberDetail',
  'listInvites',
  'createInvite',
  'cancelInvite',
  'acceptInvite',
  'listRolePermissions',
  'updateRolePermissions',
  'updateMemberRole',
  'updateMemberStatus'
], 'enterprise_member action')

includesAll(cloudFunction, [
  'AUTH_REQUIRED',
  'SESSION_INVALID',
  'SESSION_EXPIRED',
  'SESSION_REVOKED',
  'TENANT_MISMATCH',
  'MEMBER_NOT_FOUND',
  'MEMBER_NOT_ACTIVE',
  'INVITE_NOT_FOUND',
  'INVITE_EXPIRED',
  'INVITE_CANCELLED',
  'INVITE_ALREADY_ACCEPTED',
  'PERMISSION_INVALID',
  'PERMISSION_VERSION_CONFLICT',
  'LAST_ADMIN_PROTECTION',
  'FORBIDDEN'
], 'enterprise_member error code')

includesAll(permissionCatalog, [
  'member.view',
  'member.manage',
  'role.view',
  'role.manage'
], 'permission catalog')

includesAll(cloudFunction, [
  'MEMBER_INVITE_CREATED',
  'MEMBER_INVITE_CANCELLED',
  'MEMBER_INVITE_ACCEPTED',
  'MEMBER_ROLE_UPDATED',
  'MEMBER_STATUS_UPDATED',
  'ROLE_PERMISSIONS_UPDATED'
], 'audit action')

assert(!membersPage.includes('addMember('), 'members page must not directly create members')
assert(!membersPage.includes('removeMember('), 'members page must not directly remove members')
assert(!membersPage.includes('enterpriseId:'), 'members page must not assemble enterpriseId')
assert(!rolesPage.includes('enterpriseId:'), 'roles page must not assemble enterpriseId')

includesAll(memberService, ['callEnterpriseMember', 'listMembers', 'updateMemberRole', 'updateMemberStatus'], 'member service cloud calls')
includesAll(inviteService, ['callEnterpriseMember', 'listInvites', 'createInvite', 'cancelInvite', 'acceptInvite'], 'invite service cloud calls')
includesAll(roleService, ['callEnterpriseMember', 'listRolePermissions', 'updateRolePermissions'], 'role service cloud calls')

const logLines = cloudFunction.split(/\r?\n/).filter((line) => line.includes('console.'))
const unsafeLogPattern = /(sessionToken|openid|OPENID|inviteToken|email|mobile|targetAccount|phone)/i
const unsafeLog = logLines.find((line) => unsafeLogPattern.test(line))
assert(!unsafeLog, `unsafe log field found: ${unsafeLog || ''}`)

console.log('[enterprise-member-cloud-smoke] passed')
