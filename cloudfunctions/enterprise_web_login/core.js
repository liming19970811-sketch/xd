const crypto = require('crypto')
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const _ = db.command

const TICKET_TTL_MS = 5 * 60 * 1000
const SESSION_TTL_MS = 24 * 60 * 60 * 1000
const CREATE_RATE_LIMIT_MS = 60 * 1000
const CREATE_RATE_LIMIT_COUNT = 10
const MAX_CONFIRM_ATTEMPTS = 5
const TICKET_COLLECTION = 'enterprise_web_login_tickets'
const SESSION_COLLECTION = 'enterprise_auth_sessions'
const USER_COLLECTION = 'enterprise_auth_users'
const IDENTITY_COLLECTION = 'enterprise_auth_identities'
const ENTERPRISE_COLLECTION = 'enterprises'
const CONFIRM_PAGE = 'package-mobile-enterprise/web-login-confirm/web-login-confirm'

function nowIso() {
  return new Date().toISOString()
}

function hash(value = '') {
  return crypto.createHash('sha256').update(String(value || '')).digest('hex')
}

function shortHash(value = '') {
  return hash(value).slice(0, 24)
}

function randomToken(prefix = 'token') {
  return `${prefix}_${crypto.randomBytes(24).toString('hex')}`
}

function ok(payload = {}) {
  return { success: true, ok: true, ...payload }
}

function fail(errorCode = 'unknown_error', message = '请求失败', extra = {}) {
  return { success: false, ok: false, errorCode, message, ...extra }
}

function safeLog(action = '', payload = {}) {
  console.log('[enterprise_web_login]', {
    action,
    status: payload.status || '',
    ticketId: payload.ticketId || '',
    hasOpenid: Boolean(payload.hasOpenid),
    memberStatus: payload.memberStatus || '',
    errorCode: payload.errorCode || ''
  })
}

function getIdentity(wxContext = {}) {
  return {
    openid: wxContext.OPENID || '',
    appid: wxContext.APPID || '',
    unionid: wxContext.UNIONID || ''
  }
}

function sanitizeUser(user = {}) {
  return {
    userId: user.userId || '',
    name: user.name || '小程序用户',
    avatar: user.avatar || ''
  }
}

function sanitizeEnterprise(record = {}) {
  return {
    enterpriseId: record.enterpriseId || '',
    enterpriseName: record.enterpriseName || ''
  }
}

function sanitizeMember(record = {}) {
  return {
    memberId: record.memberId || '',
    enterpriseId: record.enterpriseId || '',
    userId: record.userId || '',
    role: record.role || 'member',
    status: record.status || 'pending'
  }
}

function sanitizeMembership(item = {}) {
  return {
    enterprise: sanitizeEnterprise(item.enterprise || {}),
    member: sanitizeMember(item.member || {}),
    role: item.role || item.member?.role || 'member'
  }
}

function getClientKey(event = {}, wxContext = {}) {
  const raw = event.clientId || wxContext.OPENID || wxContext.APPID || 'anonymous'
  return shortHash(raw)
}

function buildQrPayload(loginTicket = '') {
  return `/${CONFIRM_PAGE}?ticket=${encodeURIComponent(loginTicket)}`
}

async function getTicketByLoginTicket(loginTicket = '') {
  if (!loginTicket) return null
  const result = await db.collection(TICKET_COLLECTION).where({ ticketHash: hash(loginTicket) }).limit(1).get()
  return result.data && result.data.length ? result.data[0] : null
}

async function getFreshTicket(loginTicket = '') {
  const ticket = await getTicketByLoginTicket(loginTicket)
  if (!ticket) return { error: fail('ticket_invalid', '登录 ticket 无效', { status: 'failed' }) }
  if (ticket.status === 'pending' || ticket.status === 'confirmed') {
    const expired = new Date(ticket.expiresAt).getTime() <= Date.now()
    if (expired) {
      await db.collection(TICKET_COLLECTION).doc(ticket._id).update({
        data: { status: 'expired', updatedAt: nowIso() }
      })
      return { error: fail('ticket_expired', '登录 ticket 已过期', { status: 'expired', ticketId: ticket.ticketId }) }
    }
  }
  return { ticket }
}

async function assertCreateRateLimit(clientKey = '') {
  const since = new Date(Date.now() - CREATE_RATE_LIMIT_MS).toISOString()
  const result = await db.collection(TICKET_COLLECTION).where({
    clientHash: clientKey,
    createdAt: _.gte(since)
  }).count()
  return (result.total || 0) < CREATE_RATE_LIMIT_COUNT
}

async function createTicket(event = {}, wxContext = {}) {
  const clientHash = getClientKey(event, wxContext)
  const allowed = await assertCreateRateLimit(clientHash)
  if (!allowed) return fail('ticket_rate_limited', '登录二维码创建过于频繁，请稍后再试', { status: 'failed' })

  const createdAt = Date.now()
  const loginTicket = randomToken('web_login')
  const ticketId = `ticket_${shortHash(loginTicket)}`
  const expiresAt = new Date(createdAt + TICKET_TTL_MS).toISOString()
  const record = {
    ticketId,
    ticketHash: hash(loginTicket),
    status: 'pending',
    createdAt: new Date(createdAt).toISOString(),
    expiresAt,
    confirmedAt: '',
    consumedAt: '',
    cancelledAt: '',
    confirmedUserId: '',
    confirmedEnterpriseId: '',
    attemptCount: 0,
    clientHash,
    provider: 'miniapp_scan'
  }
  await db.collection(TICKET_COLLECTION).add({ data: record })
  safeLog('createTicket', { status: 'pending', ticketId })
  return ok({
    status: 'pending',
    loginTicket,
    expiresAt,
    qrPayload: buildQrPayload(loginTicket),
    qrMode: 'miniapp_path_payload',
    pollIntervalMs: 2000
  })
}

async function getTicketStatus(event = {}) {
  const resolved = await getFreshTicket(event.loginTicket || '')
  if (resolved.error) {
    return fail(resolved.error.errorCode || 'ticket_invalid', resolved.error.message || '登录 ticket 无效', {
      status: resolved.error.status || 'failed'
    })
  }
  const status = resolved.ticket.status || 'pending'
  safeLog('getTicketStatus', { status, ticketId: resolved.ticket.ticketId })
  return ok({ status })
}

async function findOrCreateMiniappUser(identity = {}) {
  if (!identity.openid) return { error: fail('identity_unavailable', '无法获取小程序可信身份', { status: 'failed' }) }
  const appIdHash = shortHash(identity.appid || 'miniapp')
  const openIdHash = shortHash(identity.openid)
  const unionIdHash = identity.unionid ? shortHash(identity.unionid) : ''
  const stableHash = unionIdHash || openIdHash
  const userId = `cloud_user_${shortHash(`miniapp:${appIdHash}:${stableHash}`)}`
  const identityQuery = unionIdHash
    ? { provider: 'miniapp_scan', appIdHash, unionIdHash }
    : { provider: 'miniapp_scan', appIdHash, openIdHash }
  const existingIdentity = await db.collection(IDENTITY_COLLECTION).where(identityQuery).limit(1).get()
  const now = nowIso()
  if (existingIdentity.data && existingIdentity.data.length) {
    await db.collection(IDENTITY_COLLECTION).doc(existingIdentity.data[0]._id).update({ data: { updatedAt: now } })
    return { user: await upsertUser({ userId: existingIdentity.data[0].userId || userId, name: '小程序用户' }) }
  }
  await db.collection(IDENTITY_COLLECTION).add({
    data: {
      identityId: `miniapp_${shortHash(`${appIdHash}:${stableHash}`)}`,
      provider: 'miniapp_scan',
      appIdHash,
      openIdHash,
      unionIdHash,
      userId,
      createdAt: now,
      updatedAt: now
    }
  })
  return { user: await upsertUser({ userId, name: '小程序用户' }) }
}

async function upsertUser(user = {}) {
  const safeUser = sanitizeUser(user)
  const now = nowIso()
  const existing = await db.collection(USER_COLLECTION).where({ userId: safeUser.userId }).limit(1).get()
  if (existing.data && existing.data.length) {
    await db.collection(USER_COLLECTION).doc(existing.data[0]._id).update({ data: { name: safeUser.name, avatar: safeUser.avatar, updatedAt: now } })
    return safeUser
  }
  await db.collection(USER_COLLECTION).add({ data: { ...safeUser, createdAt: now, updatedAt: now } })
  return safeUser
}

async function getUserById(userId = '') {
  if (!userId) return sanitizeUser({})
  const result = await db.collection(USER_COLLECTION).where({ userId }).limit(1).get()
  return result.data && result.data.length ? sanitizeUser(result.data[0]) : sanitizeUser({ userId })
}

async function listMemberships(userId = '') {
  const result = await db.collection(ENTERPRISE_COLLECTION).where({
    'members.userId': userId
  }).get()
  return (result.data || []).map((enterprise) => {
    const member = (enterprise.members || []).find((item) => item.userId === userId) || {}
    return {
      enterprise: sanitizeEnterprise(enterprise),
      member: sanitizeMember(member),
      role: member.role || 'member'
    }
  })
}

function chooseActiveMembership(memberships = [], enterpriseId = '') {
  return memberships.find((item) => item.enterprise.enterpriseId === enterpriseId && item.member.status === 'active') ||
    memberships.find((item) => item.member.status === 'active') ||
    null
}

async function getConfirmContext(event = {}, wxContext = {}) {
  const resolved = await getFreshTicket(event.loginTicket || '')
  if (resolved.error) return resolved.error
  if (resolved.ticket.status === 'cancelled') return fail('ticket_cancelled', '网页登录请求已取消', { status: 'cancelled' })
  if (resolved.ticket.status === 'consumed') return fail('ticket_consumed', '网页登录请求已完成', { status: 'consumed' })

  const identity = getIdentity(wxContext)
  const userResult = await findOrCreateMiniappUser(identity)
  if (userResult.error) return userResult.error
  const memberships = await listMemberships(userResult.user.userId)
  const activeMemberships = memberships.filter((item) => item.member.status === 'active').map(sanitizeMembership)
  safeLog('getConfirmContext', { status: resolved.ticket.status, ticketId: resolved.ticket.ticketId, hasOpenid: Boolean(identity.openid) })
  return ok({
    status: resolved.ticket.status,
    ticketId: resolved.ticket.ticketId,
    user: userResult.user,
    enterprises: activeMemberships,
    canRegisterEnterprise: activeMemberships.length === 0
  })
}

async function increaseConfirmAttempts(ticket = {}) {
  if (!ticket || !ticket._id) return
  await db.collection(TICKET_COLLECTION).doc(ticket._id).update({
    data: { attemptCount: _.inc(1), updatedAt: nowIso() }
  })
}

async function confirmTicket(event = {}, wxContext = {}) {
  const resolved = await getFreshTicket(event.loginTicket || '')
  if (resolved.error) return resolved.error
  const ticket = resolved.ticket
  if (ticket.status === 'confirmed') return fail('ticket_already_confirmed', '该网页登录请求已确认', { status: 'confirmed', ticketId: ticket.ticketId })
  if (ticket.status === 'consumed') return fail('ticket_consumed', '该网页登录请求已完成', { status: 'consumed', ticketId: ticket.ticketId })
  if (ticket.status === 'cancelled') return fail('ticket_cancelled', '该网页登录请求已取消', { status: 'cancelled', ticketId: ticket.ticketId })
  if (ticket.status !== 'pending') return fail('ticket_invalid', '该网页登录请求状态无效', { status: ticket.status || 'failed', ticketId: ticket.ticketId })
  if ((ticket.attemptCount || 0) >= MAX_CONFIRM_ATTEMPTS) {
    return fail('confirm_attempts_exceeded', '确认失败次数过多，请重新生成二维码', { status: 'failed', ticketId: ticket.ticketId })
  }

  const identity = getIdentity(wxContext)
  const userResult = await findOrCreateMiniappUser(identity)
  if (userResult.error) return userResult.error
  const memberships = await listMemberships(userResult.user.userId)
  const enterpriseId = String(event.enterpriseId || '').trim()
  let confirmedEnterpriseId = ''
  if (enterpriseId) {
    const anyTarget = memberships.find((item) => item.enterprise.enterpriseId === enterpriseId)
    if (!anyTarget) {
      await increaseConfirmAttempts(ticket)
      return fail('enterprise_not_accessible', '无法进入该企业', { status: 'failed', ticketId: ticket.ticketId })
    }
    if (anyTarget.member.status !== 'active') {
      await increaseConfirmAttempts(ticket)
      return fail('member_inactive', '当前成员状态不可进入企业', { status: 'failed', ticketId: ticket.ticketId, memberStatus: anyTarget.member.status })
    }
    confirmedEnterpriseId = anyTarget.enterprise.enterpriseId
  } else {
    const activeMemberships = memberships.filter((item) => item.member.status === 'active')
    confirmedEnterpriseId = activeMemberships.length === 1 ? activeMemberships[0].enterprise.enterpriseId : ''
  }

  await db.collection(TICKET_COLLECTION).doc(ticket._id).update({
    data: {
      status: 'confirmed',
      confirmedAt: nowIso(),
      confirmedUserId: userResult.user.userId,
      confirmedEnterpriseId,
      updatedAt: nowIso()
    }
  })
  safeLog('confirmTicket', { status: 'confirmed', ticketId: ticket.ticketId, hasOpenid: Boolean(identity.openid) })
  return ok({ status: 'confirmed', ticketId: ticket.ticketId, confirmedEnterpriseId: confirmedEnterpriseId || '' })
}

async function createSession(user = {}, enterprise = {}, member = {}, memberships = []) {
  const sessionToken = randomToken('cloud_session')
  const now = Date.now()
  const record = {
    sessionTokenHash: hash(sessionToken),
    userId: user.userId,
    enterpriseId: enterprise.enterpriseId || '',
    memberId: member.memberId || '',
    status: 'active',
    provider: 'miniapp_scan',
    expiresAt: new Date(now + SESSION_TTL_MS).toISOString(),
    createdAt: nowIso(),
    updatedAt: nowIso()
  }
  await db.collection(SESSION_COLLECTION).add({ data: record })
  return {
    sessionToken,
    authSource: 'cloud',
    authMode: 'cloud_authenticated',
    authCapability: 'miniapp_scan',
    authProvider: 'miniapp_scan',
    user: sanitizeUser(user),
    enterprise: sanitizeEnterprise(enterprise),
    member: sanitizeMember(member),
    role: member.role || 'member',
    enterprises: memberships.map(sanitizeMembership),
    expiresAt: record.expiresAt,
    createdAt: record.createdAt
  }
}

async function consumeTicket(event = {}, wxContext = {}) {
  const resolved = await getFreshTicket(event.loginTicket || '')
  if (resolved.error) return resolved.error
  const ticket = resolved.ticket
  if (ticket.status === 'consumed') return fail('ticket_consumed', '网页登录请求已消费', { status: 'consumed', ticketId: ticket.ticketId })
  if (ticket.status === 'cancelled') return fail('ticket_cancelled', '网页登录请求已取消', { status: 'cancelled', ticketId: ticket.ticketId })
  if (ticket.status !== 'confirmed') return ok({ status: ticket.status || 'pending', ticketId: ticket.ticketId })
  const user = await getUserById(ticket.confirmedUserId)
  const memberships = await listMemberships(user.userId)
  const target = ticket.confirmedEnterpriseId ? chooseActiveMembership(memberships, ticket.confirmedEnterpriseId) : null
  let session
  try {
    session = await createSession(user, target ? target.enterprise : {}, target ? target.member : {}, memberships)
  } catch (error) {
    return fail('session_create_failed', '网页登录态创建失败', { status: 'failed', ticketId: ticket.ticketId })
  }
  await db.collection(TICKET_COLLECTION).doc(ticket._id).update({
    data: { status: 'consumed', consumedAt: nowIso(), updatedAt: nowIso() }
  })
  safeLog('consumeTicket', { status: 'consumed', ticketId: ticket.ticketId, hasOpenid: Boolean(wxContext.OPENID) })
  return ok({ status: 'authenticated', authSource: 'cloud', authMode: 'cloud_authenticated', authProvider: 'miniapp_scan', session })
}

async function cancelTicket(event = {}) {
  const resolved = await getFreshTicket(event.loginTicket || '')
  if (resolved.error) return resolved.error
  const ticket = resolved.ticket
  if (ticket.status === 'consumed') return fail('ticket_consumed', '网页登录请求已完成', { status: 'consumed', ticketId: ticket.ticketId })
  if (ticket.status === 'cancelled') return ok({ status: 'cancelled', ticketId: ticket.ticketId })
  await db.collection(TICKET_COLLECTION).doc(ticket._id).update({
    data: { status: 'cancelled', cancelledAt: nowIso(), updatedAt: nowIso() }
  })
  safeLog('cancelTicket', { status: 'cancelled', ticketId: ticket.ticketId })
  return ok({ status: 'cancelled', ticketId: ticket.ticketId })
}

async function handleEventAction(event = {}, wxContext = {}) {
  const action = event.action || ''
  safeLog(action, { hasOpenid: Boolean(wxContext.OPENID) })
  try {
    if (action === 'createTicket') return createTicket(event, wxContext)
    if (action === 'getTicketStatus') return getTicketStatus(event, wxContext)
    if (action === 'getConfirmContext') return getConfirmContext(event, wxContext)
    if (action === 'confirmTicket') return confirmTicket(event, wxContext)
    if (action === 'consumeTicket') return consumeTicket(event, wxContext)
    if (action === 'cancelTicket') return cancelTicket(event, wxContext)
    return fail('unknown_action', '未知扫码登录动作', { status: 'failed' })
  } catch (error) {
    safeLog(action, { status: 'failed', errorCode: error && error.code ? error.code : 'cloud_call_failed' })
    return fail('cloud_call_failed', '企业网页登录云函数调用失败', { status: 'failed' })
  }
}

async function handleWebAction(event = {}) {
  const action = event.action || ''
  safeLog(action, {})
  try {
    if (action === 'createTicket') return createTicket(event, {})
    if (action === 'getTicketStatus') return getTicketStatus(event, {})
    if (action === 'consumeTicket') return consumeTicket(event, {})
    if (action === 'cancelTicket') return cancelTicket(event, {})
    if (action === 'getConfirmContext' || action === 'confirmTicket') {
      return fail('invalid_action', 'HTTP 登录接口不开放小程序确认动作', { status: 'failed' })
    }
    return fail('invalid_action', '未知网页登录动作', { status: 'failed' })
  } catch (error) {
    safeLog(action, { status: 'failed', errorCode: error && error.code ? error.code : 'cloud_call_failed' })
    return fail('cloud_call_failed', '企业网页登录云函数调用失败', { status: 'failed' })
  }
}

module.exports = {
  createTicket,
  getTicketStatus,
  getConfirmContext,
  confirmTicket,
  consumeTicket,
  cancelTicket,
  handleEventAction,
  handleWebAction,
  ok,
  fail,
  safeLog,
  hash,
  shortHash
}
