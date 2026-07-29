const cloud = require('wx-server-sdk')
const crypto = require('crypto')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const _ = db.command

const COLLECTIONS = Object.freeze({
  sessions: 'enterprise_auth_sessions',
  users: 'enterprise_auth_users',
  enterprises: 'enterprises',
  members: 'enterprise_members',
  invites: 'enterprise_member_invites',
  rolePermissions: 'enterprise_role_permissions',
  audit: 'enterprise_member_audit_logs'
})

const PERMISSION_KEYS = Object.freeze([
  'member.view',
  'member.manage',
  'role.view',
  'role.manage',
  'project.view',
  'project.manage',
  'project.delete',
  'product.view',
  'product.manage',
  'quote.view',
  'quote.manage',
  'order.view',
  'order.manage',
  'delivery.view',
  'delivery.manage',
  'audit.view',
  'analytics.view',
  'pattern_making.view',
  'pattern_making.create',
  'pattern_making.edit',
  'pattern_making.approve',
  'pattern_library.view',
  'pattern_library.create',
  'pattern_library.edit',
  'sample.view',
  'sample.create',
  'sample.collaborate',
  'sample.approve'
])

const DEFAULT_ROLES = Object.freeze([
  { role: 'admin', label: '管理员' },
  { role: 'designer', label: '设计师' },
  { role: 'operator', label: '运营' },
  { role: 'finance', label: '财务' },
  { role: 'viewer', label: '查看者' },
  { role: 'pattern_maker', label: '打版师' },
  { role: 'reviewer', label: '复核人员' }
])

const DEFAULT_ROLE_PERMISSIONS = Object.freeze({
  admin: PERMISSION_KEYS,
  designer: ['project.view', 'project.manage', 'product.view', 'sample.view', 'sample.create'],
  operator: ['product.view', 'order.view', 'delivery.view', 'sample.view', 'sample.collaborate'],
  finance: ['quote.view', 'order.view'],
  viewer: ['project.view', 'product.view'],
  pattern_maker: ['pattern_making.view', 'pattern_making.create', 'pattern_making.edit', 'pattern_making.approve', 'pattern_library.view', 'pattern_library.create', 'pattern_library.edit', 'sample.view', 'sample.create', 'sample.approve'],
  reviewer: ['pattern_making.view', 'pattern_making.approve', 'pattern_library.view', 'sample.view', 'sample.approve']
})

const WRITE_MEMBER_STATUSES = Object.freeze(['active', 'pending', 'disabled'])
const INVITE_STATUSES = Object.freeze(['pending', 'accepted', 'expired', 'cancelled'])
const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000

function nowIso() {
  return new Date().toISOString()
}

function sha256(value = '') {
  return crypto.createHash('sha256').update(String(value || '')).digest('hex')
}

function createId(prefix = 'id') {
  return `${prefix}_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`
}

function createInviteToken() {
  return crypto.randomBytes(20).toString('hex')
}

function ok(data = {}) {
  return { success: true, ok: true, data }
}

function fail(errorCode = 'INTERNAL_ERROR', message = '操作失败', data = {}) {
  return { success: false, ok: false, errorCode, message, data }
}

function normalizeDoc(doc = {}) {
  if (!doc || typeof doc !== 'object') return {}
  const { _id, ...rest } = doc
  return { ...rest, id: _id }
}

function normalizeRole(role = '') {
  return String(role || '').trim() || 'viewer'
}

function normalizeAccount(value = '') {
  return String(value || '').trim().toLowerCase()
}

function isEmail(value = '') {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

function isMobile(value = '') {
  return /^[0-9+\-\s()]{6,32}$/.test(value)
}

function maskAccount(value = '') {
  const account = String(value || '')
  if (!account) return ''
  if (account.includes('@')) {
    const [name, domain] = account.split('@')
    return `${name.slice(0, 2)}***@${domain || ''}`
  }
  return account.length > 4 ? `${account.slice(0, 3)}****${account.slice(-2)}` : '****'
}

function sanitizeMember(member = {}) {
  return {
    memberId: member.memberId || '',
    enterpriseId: member.enterpriseId || '',
    userId: member.userId || '',
    name: member.name || member.userName || '',
    avatar: member.avatar || '',
    role: member.role || '',
    status: member.status || 'pending',
    createdAt: member.createdAt || '',
    updatedAt: member.updatedAt || ''
  }
}

function sanitizeInvite(invite = {}, options = {}) {
  const account = invite.email || invite.mobile || invite.targetAccount || ''
  return {
    inviteId: invite.inviteId || '',
    enterpriseId: invite.enterpriseId || '',
    inviterMemberId: invite.invitedByMemberId || invite.inviterMemberId || '',
    targetAccount: maskAccount(account),
    role: invite.targetRole || invite.role || 'viewer',
    status: invite.status || 'pending',
    createdAt: invite.createdAt || '',
    expiresAt: invite.expiresAt || '',
    acceptedAt: invite.acceptedAt || '',
    cancelledAt: invite.cancelledAt || '',
    inviteToken: options.includeToken ? invite.inviteToken || '' : ''
  }
}

function uniquePermissions(permissions = []) {
  const valid = new Set(PERMISSION_KEYS)
  return Array.from(new Set((Array.isArray(permissions) ? permissions : [])
    .map((item) => String(item || '').trim())
    .filter((item) => valid.has(item))))
}

function getInvalidPermissions(permissions = []) {
  const valid = new Set(PERMISSION_KEYS)
  return (Array.isArray(permissions) ? permissions : [])
    .map((item) => String(item || '').trim())
    .filter((item) => item && !valid.has(item))
}

function getRoleLabel(role = '') {
  const target = DEFAULT_ROLES.find((item) => item.role === role)
  return target ? target.label : role
}

async function getOne(collection, where = {}) {
  const result = await db.collection(collection).where(where).limit(1).get()
  return result.data && result.data.length ? normalizeDoc(result.data[0]) : null
}

async function addAudit(ctx = {}, action = '', target = {}, success = true, errorCode = '') {
  try {
    await db.collection(COLLECTIONS.audit).add({
      data: {
        auditId: createId('audit'),
        enterpriseId: ctx.enterpriseId || '',
        operatorMemberId: ctx.memberId || '',
        action,
        targetType: target.type || '',
        targetId: target.id || '',
        success: Boolean(success),
        errorCode: errorCode || '',
        createdAt: nowIso()
      }
    })
  } catch (error) {
    console.warn('[enterprise_member:audit]', {
      action,
      success: false,
      errorCode: 'AUDIT_WRITE_FAILED'
    })
  }
}

async function getRolePermissionRecord(enterpriseId = '', role = '') {
  const roleCode = normalizeRole(role)
  const record = await getOne(COLLECTIONS.rolePermissions, { enterpriseId, roleCode })
  if (record) {
    return {
      role: record.roleCode,
      label: getRoleLabel(record.roleCode),
      permissions: uniquePermissions(record.permissions),
      version: Number(record.version || 0),
      createdAt: record.createdAt || '',
      updatedAt: record.updatedAt || '',
      source: 'cloud'
    }
  }
  return {
    role: roleCode,
    label: getRoleLabel(roleCode),
    permissions: [...(DEFAULT_ROLE_PERMISSIONS[roleCode] || [])],
    version: 0,
    createdAt: '',
    updatedAt: '',
    source: 'default'
  }
}

async function hasPermission(ctx = {}, permission = '') {
  if (!permission) return true
  const record = await getRolePermissionRecord(ctx.enterpriseId, ctx.role)
  return record.permissions.includes(permission)
}

async function requirePermission(ctx = {}, permission = '') {
  const allowed = await hasPermission(ctx, permission)
  if (!allowed) throw Object.assign(new Error('无权限执行该操作'), { errorCode: 'FORBIDDEN' })
  return true
}

async function requireAnyPermission(ctx = {}, permissions = []) {
  for (const permission of permissions) {
    if (await hasPermission(ctx, permission)) return true
  }
  throw Object.assign(new Error('无权限执行该操作'), { errorCode: 'FORBIDDEN' })
}

async function requireSession(sessionToken = '') {
  const token = String(sessionToken || '').trim()
  if (!token) throw Object.assign(new Error('请先登录'), { errorCode: 'AUTH_REQUIRED' })
  const session = await getOne(COLLECTIONS.sessions, { sessionTokenHash: sha256(token) })
  if (!session) throw Object.assign(new Error('登录状态无效'), { errorCode: 'SESSION_INVALID' })
  if (session.status === 'revoked') throw Object.assign(new Error('登录已退出'), { errorCode: 'SESSION_REVOKED' })
  if (session.status && session.status !== 'active') throw Object.assign(new Error('登录状态无效'), { errorCode: 'SESSION_INVALID' })
  if (session.expiresAt && new Date(session.expiresAt).getTime() <= Date.now()) {
    throw Object.assign(new Error('登录已过期'), { errorCode: 'SESSION_EXPIRED' })
  }
  const enterpriseId = session.enterpriseId || ''
  const memberId = session.memberId || ''
  if (!enterpriseId || !memberId) throw Object.assign(new Error('请选择企业'), { errorCode: 'TENANT_MISMATCH' })
  const member = await getOne(COLLECTIONS.members, { enterpriseId, memberId })
  if (!member) throw Object.assign(new Error('成员不存在'), { errorCode: 'MEMBER_NOT_FOUND' })
  if (member.userId !== session.userId) throw Object.assign(new Error('成员不属于当前用户'), { errorCode: 'TENANT_MISMATCH' })
  if (member.status !== 'active') throw Object.assign(new Error('成员状态不可用'), { errorCode: 'MEMBER_NOT_ACTIVE' })
  const user = await getOne(COLLECTIONS.users, { userId: session.userId })
  return {
    session,
    user,
    enterpriseId,
    memberId,
    member,
    role: normalizeRole(member.role),
    userId: session.userId
  }
}

async function listMembers(ctx) {
  await requirePermission(ctx, 'member.view')
  const result = await db.collection(COLLECTIONS.members).where({ enterpriseId: ctx.enterpriseId }).limit(100).get()
  return ok({ members: (result.data || []).map(sanitizeMember) })
}

async function getCurrentMember(ctx) {
  return ok({
    member: sanitizeMember(ctx.member),
    permissions: (await getRolePermissionRecord(ctx.enterpriseId, ctx.role)).permissions
  })
}

async function getMemberDetail(ctx, data = {}) {
  await requirePermission(ctx, 'member.view')
  const memberId = String(data.memberId || '').trim()
  if (!memberId) return fail('INVALID_ARGUMENT', 'memberId 不能为空')
  const member = await getOne(COLLECTIONS.members, { enterpriseId: ctx.enterpriseId, memberId })
  if (!member) return fail('MEMBER_NOT_FOUND', '成员不存在')
  return ok({ member: sanitizeMember(member) })
}

async function listInvites(ctx) {
  await requirePermission(ctx, 'member.manage')
  const result = await db.collection(COLLECTIONS.invites).where({ enterpriseId: ctx.enterpriseId }).limit(100).get()
  const invites = (result.data || [])
    .map((item) => {
      const invite = normalizeDoc(item)
      if (invite.status === 'pending' && invite.expiresAt && new Date(invite.expiresAt).getTime() <= Date.now()) {
        invite.status = 'expired'
      }
      return sanitizeInvite(invite)
    })
    .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))
  return ok({ invites })
}

async function createInvite(ctx, data = {}) {
  await requirePermission(ctx, 'member.manage')
  const account = normalizeAccount(data.targetAccount || data.email || data.mobile)
  if (!account || (!isEmail(account) && !isMobile(account))) return fail('INVALID_ARGUMENT', '邀请账号格式不正确')
  const targetRole = normalizeRole(data.role || data.targetRole)
  const accountField = isEmail(account) ? 'emailHash' : 'mobileHash'
  const accountHash = sha256(account)
  const existing = await getOne(COLLECTIONS.invites, {
    enterpriseId: ctx.enterpriseId,
    [accountField]: accountHash,
    status: 'pending'
  })
  if (existing && (!existing.expiresAt || new Date(existing.expiresAt).getTime() > Date.now())) {
    return ok({ invite: sanitizeInvite(existing), duplicate: true })
  }
  const inviteToken = createInviteToken()
  const now = nowIso()
  const invite = {
    inviteId: createId('invite'),
    enterpriseId: ctx.enterpriseId,
    email: isEmail(account) ? account : '',
    mobile: isMobile(account) ? account : '',
    emailHash: isEmail(account) ? accountHash : '',
    mobileHash: isMobile(account) ? accountHash : '',
    inviteCodeHash: sha256(inviteToken),
    targetRole,
    status: 'pending',
    invitedByMemberId: ctx.memberId,
    expiresAt: new Date(Date.now() + INVITE_TTL_MS).toISOString(),
    createdAt: now,
    updatedAt: now
  }
  await db.collection(COLLECTIONS.invites).add({ data: invite })
  await addAudit(ctx, 'MEMBER_INVITE_CREATED', { type: 'invite', id: invite.inviteId }, true)
  return ok({ invite: sanitizeInvite({ ...invite, inviteToken }, { includeToken: true }) })
}

async function cancelInvite(ctx, data = {}) {
  await requirePermission(ctx, 'member.manage')
  const inviteId = String(data.inviteId || '').trim()
  if (!inviteId) return fail('INVALID_ARGUMENT', 'inviteId 不能为空')
  const invite = await getOne(COLLECTIONS.invites, { enterpriseId: ctx.enterpriseId, inviteId })
  if (!invite) return fail('INVITE_NOT_FOUND', '邀请不存在')
  if (invite.status === 'cancelled') return ok({ invite: sanitizeInvite(invite) })
  if (invite.status !== 'pending') return fail(`INVITE_${String(invite.status || '').toUpperCase()}`, '邀请状态不可取消')
  const patch = { status: 'cancelled', cancelledAt: nowIso(), updatedAt: nowIso() }
  await db.collection(COLLECTIONS.invites).where({ enterpriseId: ctx.enterpriseId, inviteId }).update({ data: patch })
  await addAudit(ctx, 'MEMBER_INVITE_CANCELLED', { type: 'invite', id: inviteId }, true)
  return ok({ invite: sanitizeInvite({ ...invite, ...patch }) })
}

async function acceptInvite(ctx, data = {}) {
  const inviteToken = String(data.inviteToken || data.inviteCode || '').trim()
  if (!inviteToken) return fail('INVALID_ARGUMENT', 'inviteToken 不能为空')
  const invite = await getOne(COLLECTIONS.invites, { inviteCodeHash: sha256(inviteToken) })
  if (!invite) return fail('INVITE_NOT_FOUND', '邀请不存在')
  if (invite.status === 'cancelled') return fail('INVITE_CANCELLED', '邀请已取消')
  if (invite.status === 'accepted') return fail('INVITE_ALREADY_ACCEPTED', '邀请已接受')
  if (invite.expiresAt && new Date(invite.expiresAt).getTime() <= Date.now()) return fail('INVITE_EXPIRED', '邀请已过期')
  const existing = await getOne(COLLECTIONS.members, { enterpriseId: invite.enterpriseId, userId: ctx.userId })
  const now = nowIso()
  let member = existing
  if (!member) {
    member = {
      memberId: createId('member'),
      enterpriseId: invite.enterpriseId,
      userId: ctx.userId,
      name: ctx.user?.name || '',
      role: invite.targetRole || 'viewer',
      status: 'active',
      createdAt: now,
      updatedAt: now
    }
    await db.collection(COLLECTIONS.members).add({ data: member })
  } else if (member.status !== 'active') {
    await db.collection(COLLECTIONS.members).where({ enterpriseId: invite.enterpriseId, memberId: member.memberId }).update({
      data: { status: 'active', updatedAt: now }
    })
    member = { ...member, status: 'active', updatedAt: now }
  }
  const patch = {
    status: 'accepted',
    acceptedByUserId: ctx.userId,
    acceptedByMemberId: member.memberId,
    acceptedAt: now,
    updatedAt: now
  }
  await db.collection(COLLECTIONS.invites).where({ inviteId: invite.inviteId }).update({ data: patch })
  await addAudit({ ...ctx, enterpriseId: invite.enterpriseId }, 'MEMBER_INVITE_ACCEPTED', { type: 'invite', id: invite.inviteId }, true)
  return ok({ invite: sanitizeInvite({ ...invite, ...patch }), member: sanitizeMember(member) })
}

async function listRolePermissions(ctx) {
  await requirePermission(ctx, 'role.view')
  const result = await db.collection(COLLECTIONS.rolePermissions).where({ enterpriseId: ctx.enterpriseId }).limit(100).get()
  const stored = new Map((result.data || []).map((item) => {
    const record = normalizeDoc(item)
    return [record.roleCode, record]
  }))
  const records = DEFAULT_ROLES.map((role) => {
    const record = stored.get(role.role)
    return {
      enterpriseId: ctx.enterpriseId,
      role: role.role,
      label: role.label,
      permissions: record ? uniquePermissions(record.permissions) : [...(DEFAULT_ROLE_PERMISSIONS[role.role] || [])],
      version: Number(record ? record.version || 0 : 0),
      builtin: true,
      createdAt: record ? record.createdAt || '' : '',
      updatedAt: record ? record.updatedAt || '' : '',
      source: record ? 'cloud' : 'default'
    }
  })
  return ok({ roles: records })
}

async function updateRolePermissions(ctx, data = {}) {
  await requirePermission(ctx, 'role.manage')
  const roleCode = normalizeRole(data.role || data.roleCode)
  if (!roleCode) return fail('ROLE_NOT_FOUND', '角色不存在')
  const invalid = getInvalidPermissions(data.permissions)
  if (invalid.length) return fail('PERMISSION_INVALID', '包含未知权限')
  const permissions = uniquePermissions(data.permissions)
  const existing = await getOne(COLLECTIONS.rolePermissions, { enterpriseId: ctx.enterpriseId, roleCode })
  const currentVersion = Number(existing ? existing.version || 0 : 0)
  const expectedVersion = Number(data.version || 0)
  if (expectedVersion !== currentVersion) return fail('PERMISSION_VERSION_CONFLICT', '权限配置已被其他成员更新，请刷新后重试。')
  const now = nowIso()
  const next = {
    enterpriseId: ctx.enterpriseId,
    roleCode,
    permissions,
    version: currentVersion + 1,
    updatedAt: now,
    updatedByMemberId: ctx.memberId
  }
  if (existing) {
    await db.collection(COLLECTIONS.rolePermissions).where({ enterpriseId: ctx.enterpriseId, roleCode }).update({ data: next })
  } else {
    await db.collection(COLLECTIONS.rolePermissions).add({
      data: {
        rolePermissionId: createId('role_perm'),
        ...next,
        createdAt: now
      }
    })
  }
  await addAudit(ctx, 'ROLE_PERMISSIONS_UPDATED', { type: 'role', id: roleCode }, true)
  return ok({
    record: {
      enterpriseId: ctx.enterpriseId,
      role: roleCode,
      label: getRoleLabel(roleCode),
      permissions,
      version: currentVersion + 1,
      updatedAt: now,
      source: 'cloud'
    }
  })
}

async function updateMemberRole(ctx, data = {}) {
  await requireAnyPermission(ctx, ['member.manage', 'role.manage'])
  const memberId = String(data.memberId || '').trim()
  const role = normalizeRole(data.role)
  if (!memberId || !role) return fail('INVALID_ARGUMENT', 'memberId 和 role 不能为空')
  if (memberId === ctx.memberId && role !== ctx.role) return fail('FORBIDDEN', '不能修改自己的角色')
  const member = await getOne(COLLECTIONS.members, { enterpriseId: ctx.enterpriseId, memberId })
  if (!member) return fail('MEMBER_NOT_FOUND', '成员不存在')
  if (member.role === role) return ok({ member: sanitizeMember(member) })
  await db.collection(COLLECTIONS.members).where({ enterpriseId: ctx.enterpriseId, memberId }).update({
    data: { role, updatedAt: nowIso(), updatedByMemberId: ctx.memberId }
  })
  await addAudit(ctx, 'MEMBER_ROLE_UPDATED', { type: 'member', id: memberId }, true)
  return ok({ member: sanitizeMember({ ...member, role, updatedAt: nowIso() }) })
}

async function hasManagePermissionForRole(enterpriseId = '', role = '') {
  const record = await getRolePermissionRecord(enterpriseId, role)
  return record.permissions.includes('member.manage')
}

async function assertLastAdminProtection(ctx, memberId = '', status = '') {
  if (status === 'active') return
  const members = await db.collection(COLLECTIONS.members).where({
    enterpriseId: ctx.enterpriseId,
    status: 'active',
    memberId: _.neq(memberId)
  }).limit(100).get()
  for (const member of members.data || []) {
    if (await hasManagePermissionForRole(ctx.enterpriseId, member.role)) return
  }
  throw Object.assign(new Error('至少保留一名可管理成员'), { errorCode: 'LAST_ADMIN_PROTECTION' })
}

async function updateMemberStatus(ctx, data = {}) {
  await requirePermission(ctx, 'member.manage')
  const memberId = String(data.memberId || '').trim()
  const status = String(data.status || '').trim()
  if (!memberId || !WRITE_MEMBER_STATUSES.includes(status)) return fail('INVALID_ARGUMENT', '成员状态不正确')
  const member = await getOne(COLLECTIONS.members, { enterpriseId: ctx.enterpriseId, memberId })
  if (!member) return fail('MEMBER_NOT_FOUND', '成员不存在')
  if (member.status === status) return ok({ member: sanitizeMember(member) })
  await assertLastAdminProtection(ctx, memberId, status)
  const patch = { status, updatedAt: nowIso(), updatedByMemberId: ctx.memberId }
  await db.collection(COLLECTIONS.members).where({ enterpriseId: ctx.enterpriseId, memberId }).update({ data: patch })
  await addAudit(ctx, 'MEMBER_STATUS_UPDATED', { type: 'member', id: memberId }, true)
  return ok({ member: sanitizeMember({ ...member, ...patch }) })
}

const ACTIONS = Object.freeze({
  getCurrentMember,
  listMembers,
  getMemberDetail,
  listInvites,
  createInvite,
  cancelInvite,
  acceptInvite,
  listRolePermissions,
  updateRolePermissions,
  updateMemberRole,
  updateMemberStatus
})

exports.main = async (event = {}) => {
  const startedAt = Date.now()
  const action = String(event.action || '').trim()
  let success = false
  let errorCode = ''
  try {
    if (!ACTIONS[action]) return fail('INVALID_ACTION', '未知操作')
    const ctx = await requireSession(event.sessionToken)
    const result = await ACTIONS[action](ctx, event.data || {})
    success = Boolean(result && result.success)
    errorCode = result && result.errorCode ? result.errorCode : ''
    return result
  } catch (error) {
    errorCode = error.errorCode || 'INTERNAL_ERROR'
    return fail(errorCode, error.message || '操作失败')
  } finally {
    console.info('[enterprise_member]', {
      action,
      success,
      errorCode,
      elapsedMs: Date.now() - startedAt
    })
  }
}
