const crypto = require('crypto')
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const SESSION_COLLECTION = 'enterprise_auth_sessions'
const USER_COLLECTION = 'enterprise_auth_users'
const ENTERPRISE_COLLECTION = 'enterprises'
const MEMBER_COLLECTION = 'enterprise_members'

function nowIso() {
  return new Date().toISOString()
}

function ok(payload = {}) {
  return { success: true, ok: true, ...payload }
}

function fail(errorCode = 'unknown_error', message = '请求失败', extra = {}) {
  return { success: false, ok: false, errorCode, message, ...extra }
}

function hash(value = '') {
  return crypto.createHash('sha256').update(String(value || '')).digest('hex')
}

function shortHash(value = '') {
  return hash(value).slice(0, 24)
}

function sanitizeUser(record = {}) {
  return {
    userId: String(record.userId || ''),
    name: String(record.name || '企业用户'),
    avatar: String(record.avatar || '')
  }
}

function sanitizeEnterprise(record = {}) {
  return {
    enterpriseId: String(record.enterpriseId || ''),
    enterpriseName: String(record.enterpriseName || '')
  }
}

function sanitizeMember(record = {}) {
  return {
    memberId: String(record.memberId || ''),
    enterpriseId: String(record.enterpriseId || ''),
    userId: String(record.userId || ''),
    role: String(record.role || 'member'),
    status: String(record.status || 'pending')
  }
}

function buildSessionSummary(session = {}, user = {}, enterprise = {}, member = {}, enterprises = []) {
  return {
    authSource: 'cloud',
    authMode: 'cloud_authenticated',
    authCapability: 'miniapp_scan',
    authProvider: session.provider || 'miniapp_scan',
    user: sanitizeUser(user),
    enterprise: sanitizeEnterprise(enterprise),
    member: sanitizeMember(member),
    role: member.role || 'member',
    enterprises,
    expiresAt: session.expiresAt || '',
    createdAt: session.createdAt || ''
  }
}

function validateEnterpriseName(value = '') {
  const name = String(value || '').trim()
  if (name.length < 2) return { ok: false, message: '企业名称至少需要2个字符' }
  if (name.length > 50) return { ok: false, message: '企业名称最多50个字符' }
  return { ok: true, name }
}

function normalizeOptionalText(value = '', maxLength = 80) {
  return String(value || '').trim().slice(0, maxLength)
}

function normalizePhone(value = '') {
  return String(value || '').trim().slice(0, 32)
}

async function getSession(sessionToken = '') {
  const token = String(sessionToken || '').trim()
  if (!token) return null
  const result = await db.collection(SESSION_COLLECTION).where({
    sessionTokenHash: hash(token)
  }).limit(1).get()
  return result.data && result.data.length ? result.data[0] : null
}

async function requireValidSession(sessionToken = '') {
  const session = await getSession(sessionToken)
  if (!session) return { ok: false, errorCode: 'session_invalid', status: 'session_invalid', message: '登录状态已失效，请重新登录' }
  if (session.status !== 'active') return { ok: false, errorCode: 'session_invalid', status: 'session_invalid', message: '登录状态已失效，请重新登录' }
  if (session.expiresAt && new Date(session.expiresAt).getTime() <= Date.now()) {
    return { ok: false, errorCode: 'session_expired', status: 'session_expired', message: '登录已过期，请重新扫码登录' }
  }
  if (!session.userId) return { ok: false, errorCode: 'session_invalid', status: 'session_invalid', message: '登录状态缺少用户信息' }
  return { ok: true, session }
}

async function getUserById(userId = '') {
  const id = String(userId || '').trim()
  if (!id) return null
  const result = await db.collection(USER_COLLECTION).where({ userId: id }).limit(1).get()
  if (result.data && result.data.length) return sanitizeUser(result.data[0])
  return sanitizeUser({ userId: id })
}

async function getEnterpriseById(enterpriseId = '') {
  const id = String(enterpriseId || '').trim()
  if (!id) return null
  const result = await db.collection(ENTERPRISE_COLLECTION).where({ enterpriseId: id }).limit(1).get()
  return result.data && result.data.length ? result.data[0] : null
}

async function getMemberById(memberId = '') {
  const id = String(memberId || '').trim()
  if (!id) return null
  const result = await db.collection(MEMBER_COLLECTION).where({ memberId: id }).limit(1).get()
  return result.data && result.data.length ? result.data[0] : null
}

async function ensureAdminMember({ enterpriseId, user, now }) {
  const memberId = `${enterpriseId}_${user.userId}`
  const existing = await getMemberById(memberId)
  if (existing) return sanitizeMember(existing)
  const member = {
    memberId,
    enterpriseId,
    userId: user.userId,
    name: user.name || '',
    avatar: user.avatar || '',
    role: 'admin',
    status: 'active',
    createdAt: now,
    updatedAt: now
  }
  await db.collection(MEMBER_COLLECTION).add({ data: member })
  return sanitizeMember(member)
}

async function listMemberships(userId = '') {
  const result = await db.collection(MEMBER_COLLECTION).where({ userId }).get()
  const memberships = []
  for (const member of result.data || []) {
    const enterprise = await getEnterpriseById(member.enterpriseId)
    if (!enterprise) continue
    memberships.push({
      enterprise: sanitizeEnterprise(enterprise),
      member: sanitizeMember(member),
      role: member.role || 'member'
    })
  }
  return memberships
}

function chooseActiveMembership(memberships = [], enterpriseId = '') {
  return memberships.find((item) => item.enterprise.enterpriseId === enterpriseId && item.member.status === 'active') ||
    memberships.find((item) => item.member.status === 'active') ||
    null
}

async function getAuthCapability() {
  return ok({
    status: 'ready',
    authSource: 'cloud_pending',
    authMode: 'cloud_pending',
    authCapability: 'miniapp_scan',
    identityAvailable: false,
    identitySource: 'enterprise_auth'
  })
}

async function restoreSession(event = {}) {
  const valid = await requireValidSession(event.sessionToken)
  if (!valid.ok) return fail(valid.errorCode, valid.message, { status: valid.status, authSource: 'cloud_failed', authMode: 'cloud_failed' })
  const user = await getUserById(valid.session.userId)
  const memberships = await listMemberships(user.userId)
  const target = chooseActiveMembership(memberships, valid.session.enterpriseId)
  return ok({
    status: 'authenticated',
    authSource: 'cloud',
    authMode: 'cloud_authenticated',
    session: buildSessionSummary(valid.session, user, target ? target.enterprise : {}, target ? target.member : {}, memberships)
  })
}

async function registerEnterprise(event = {}) {
  const valid = await requireValidSession(event.sessionToken)
  if (!valid.ok) return fail(valid.errorCode, valid.message, { status: valid.status, authSource: 'cloud_failed', authMode: 'cloud_failed' })

  const user = await getUserById(valid.session.userId)
  if (!user || !user.userId) return fail('session_invalid', '登录状态缺少用户信息')

  const validation = validateEnterpriseName(event.enterpriseName)
  if (!validation.ok) return fail('enterprise_name_invalid', validation.message)

  const idempotencyKey = String(event.idempotencyKey || '').trim()
  if (!idempotencyKey) return fail('idempotency_key_required', '缺少幂等请求标识')

  const now = nowIso()
  const enterpriseId = `enterprise_${shortHash(`${user.userId}:${idempotencyKey}`)}`
  const existing = await db.collection(ENTERPRISE_COLLECTION).where({ idempotencyKey }).limit(1).get()
  let enterpriseRecord = existing.data && existing.data.length ? existing.data[0] : null

  if (!enterpriseRecord) {
    enterpriseRecord = {
      enterpriseId,
      enterpriseName: validation.name,
      contactName: normalizeOptionalText(event.contactName, 50),
      contactPhone: normalizePhone(event.contactPhone),
      industry: normalizeOptionalText(event.industry, 50),
      teamSize: normalizeOptionalText(event.teamSize, 30),
      ownerUserId: user.userId,
      createdBy: user.userId,
      idempotencyKey,
      status: 'active',
      createdAt: now,
      updatedAt: now
    }
    await db.collection(ENTERPRISE_COLLECTION).add({ data: enterpriseRecord })
  }

  const member = await ensureAdminMember({ enterpriseId: enterpriseRecord.enterpriseId, user, now })
  await db.collection(SESSION_COLLECTION).doc(valid.session._id).update({
    data: {
      enterpriseId: enterpriseRecord.enterpriseId,
      memberId: member.memberId,
      updatedAt: nowIso()
    }
  })

  const memberships = await listMemberships(user.userId)
  const session = {
    ...valid.session,
    enterpriseId: enterpriseRecord.enterpriseId,
    memberId: member.memberId,
    updatedAt: nowIso()
  }
  return ok({
    enterprise: sanitizeEnterprise(enterpriseRecord),
    member,
    role: member.role,
    session: buildSessionSummary(session, user, enterpriseRecord, member, memberships)
  })
}

async function listEnterprises(event = {}) {
  const valid = await requireValidSession(event.sessionToken)
  if (!valid.ok) return fail(valid.errorCode, valid.message, { status: valid.status, authSource: 'cloud_failed', authMode: 'cloud_failed' })
  const user = await getUserById(valid.session.userId)
  return ok({
    status: 'authenticated',
    authSource: 'cloud',
    authMode: 'cloud_authenticated',
    enterprises: await listMemberships(user.userId)
  })
}

async function switchEnterprise(event = {}) {
  const valid = await requireValidSession(event.sessionToken)
  if (!valid.ok) return fail(valid.errorCode, valid.message, { status: valid.status, authSource: 'cloud_failed', authMode: 'cloud_failed' })
  const user = await getUserById(valid.session.userId)
  const memberships = await listMemberships(user.userId)
  const target = memberships.find((item) => item.enterprise.enterpriseId === event.enterpriseId)
  if (!target) return fail('not_found', '未找到企业成员关系')
  if (target.member.status !== 'active') return fail('member_inactive', '当前成员状态不可进入企业')
  await db.collection(SESSION_COLLECTION).doc(valid.session._id).update({
    data: {
      enterpriseId: target.enterprise.enterpriseId,
      memberId: target.member.memberId,
      updatedAt: nowIso()
    }
  })
  return ok({
    status: 'authenticated',
    authSource: 'cloud',
    authMode: 'cloud_authenticated',
    session: buildSessionSummary(valid.session, user, target.enterprise, target.member, memberships)
  })
}

async function logout(event = {}) {
  const session = await getSession(event.sessionToken)
  if (session && session._id) {
    await db.collection(SESSION_COLLECTION).doc(session._id).update({
      data: { status: 'revoked', updatedAt: nowIso() }
    })
  }
  return ok({ status: 'logged_out' })
}

async function dispatchAction(event = {}) {
  const action = String(event.action || '')
  if (action === 'getAuthCapability') return getAuthCapability(event)
  if (action === 'restoreSession') return restoreSession(event)
  if (action === 'registerEnterprise') return registerEnterprise(event)
  if (action === 'listEnterprises') return listEnterprises(event)
  if (action === 'switchEnterprise') return switchEnterprise(event)
  if (action === 'logout') return logout(event)
  return fail('unknown_action', '未知身份动作')
}

exports.main = async (event = {}, context = {}) => {
  const action = String(event.action || '')
  let response
  try {
    response = await dispatchAction(event, context)
  } catch (error) {
    response = fail('enterprise_auth_failed', '企业身份服务处理失败')
  }
  console.log('[enterprise_auth]', {
    action,
    hasSessionToken: Boolean(event.sessionToken),
    success: Boolean(response && response.success),
    errorCode: response && response.errorCode ? response.errorCode : ''
  })
  return response
}
