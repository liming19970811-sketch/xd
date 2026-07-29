const crypto = require('crypto')
const cloud = require('wx-server-sdk')
const { createEmailProviderByEnv, getEmailCapability } = require('./providers/providerFactory')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const CODE_TTL_MS = 5 * 60 * 1000
const SESSION_TTL_MS = 24 * 60 * 60 * 1000
const SEND_INTERVAL_MS = 60 * 1000
const HOURLY_LIMIT = 5
const DAILY_LIMIT = 15
const MAX_VERIFY_ATTEMPTS = 5
const LOCK_MS = 15 * 60 * 1000

function nowIso() {
  return new Date().toISOString()
}

function ok(data = {}, extra = {}) {
  return { ok: true, success: true, status: extra.status || 'ready', data, ...extra }
}

function fail(errorCode = 'unknown_error', message = '请求失败', extra = {}) {
  return { ok: false, success: false, status: extra.status || 'failed', errorCode, message, ...extra }
}

function hash(value = '') {
  return crypto.createHash('sha256').update(String(value || '')).digest('hex')
}

function shortHash(value = '') {
  return hash(value).slice(0, 24)
}

function randomCode() {
  return String(crypto.randomInt(0, 1000000)).padStart(6, '0')
}

function randomToken(prefix = 'token') {
  return `${prefix}_${crypto.randomBytes(24).toString('hex')}`
}

function normalizeEmail(value = '') {
  return String(value || '').trim().toLowerCase()
}

function validateEmail(value = '') {
  const email = normalizeEmail(value)
  return email.length > 0 && email.length <= 120 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ? { ok: true, value: email }
    : { ok: false, errorCode: 'invalid_email', message: '邮箱格式不正确' }
}

function normalizePhone(value = '') {
  const raw = String(value || '').trim().replace(/[\s-]/g, '')
  if (/^\+86\d{11}$/.test(raw)) return raw
  if (/^86\d{11}$/.test(raw)) return `+${raw}`
  if (/^1\d{10}$/.test(raw)) return `+86${raw}`
  return raw
}

function validatePhone(value = '') {
  const phone = normalizePhone(value)
  return /^\+861[3-9]\d{9}$/.test(phone)
    ? { ok: true, value: phone }
    : { ok: false, errorCode: 'invalid_phone', message: '请输入中国大陆手机号' }
}

function getProvider(input = {}) {
  if (input.provider === 'phone' || input.loginType === 'phone_code') return 'phone'
  return 'email'
}

function validateAccount(provider = 'email', value = '') {
  return provider === 'phone' ? validatePhone(value) : validateEmail(value)
}

function isEnabled(value = '') {
  return ['1', 'true', 'yes', 'on', 'enabled'].includes(String(value || '').toLowerCase())
}

function getRuntimeMode() {
  return String(process.env.NODE_ENV || process.env.TCB_ENV || process.env.ENV || 'development').toLowerCase()
}

function isProductionLike() {
  return ['production', 'prod', 'release', 'trial'].includes(getRuntimeMode())
}

function providerStatus(provider = 'email') {
  if (provider === 'email') return getEmailCapability()
  const enabled = isEnabled(process.env.PHONE_AUTH_ENABLED)
  const providerMode = String(process.env.SMS_PROVIDER_MODE || '')
  const devMockEnabled = isEnabled(process.env.ACCOUNT_AUTH_DEV_MOCK_ENABLED) && !isProductionLike()
  if (!enabled) return { status: 'disabled', devCodeAvailable: false, provider: 'disabled' }
  if (providerMode === 'configured') return { status: 'disabled', devCodeAvailable: false, provider: 'disabled' }
  if (devMockEnabled) return { status: 'development_mock', devCodeAvailable: true, provider: 'mock' }
  return { status: 'disabled', devCodeAvailable: false, provider: 'disabled' }
}

function normalizeRequestId(value = '') {
  const text = String(value || '').trim()
  return /^[a-zA-Z0-9_-]{8,80}$/.test(text) ? text : randomToken('request')
}

function accountHash(provider = 'email', account = '') {
  return hash(`${provider}:${account}`)
}

function getPeriodKey(date = new Date(), type = 'day') {
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  const hour = String(date.getUTCHours()).padStart(2, '0')
  return type === 'hour' ? `${year}${month}${day}${hour}` : `${year}${month}${day}`
}

async function getLatestCodeRecord(provider = 'email', normalizedAccountHash = '') {
  const result = await db.collection('enterprise_account_codes').where({
    provider,
    normalizedAccountHash
  }).orderBy('createdAtMs', 'desc').limit(1).get()
  return result.data && result.data.length ? result.data[0] : null
}

async function countCodeRequests(provider = 'email', normalizedAccountHash = '', periodType = 'day') {
  const periodKey = getPeriodKey(new Date(), periodType)
  const result = await db.collection('enterprise_account_codes').where({
    provider,
    normalizedAccountHash,
    [`${periodType}Key`]: periodKey
  }).get()
  return (result.data || []).length
}

async function invalidateOldCodes(provider = 'email', normalizedAccountHash = '') {
  const result = await db.collection('enterprise_account_codes').where({
    provider,
    normalizedAccountHash,
    status: 'active'
  }).get()
  await Promise.all((result.data || []).map((item) => (
    db.collection('enterprise_account_codes').doc(item._id).update({
      data: { status: 'invalidated', updatedAt: nowIso() }
    })
  )))
}

async function getRequestRecord(requestId = '') {
  if (!requestId) return null
  const result = await db.collection('enterprise_account_request_ids').where({
    requestIdHash: hash(requestId)
  }).limit(1).get()
  return result.data && result.data.length ? result.data[0] : null
}

async function saveRequestRecord(requestId = '', payload = {}) {
  if (!requestId) return
  const now = Date.now()
  await db.collection('enterprise_account_request_ids').add({
    data: {
      requestIdHash: hash(requestId),
      provider: payload.provider || 'email',
      accountHashPrefix: payload.accountHashPrefix || '',
      status: payload.status || 'failed',
      response: payload.response || {},
      expiresAt: new Date(now + CODE_TTL_MS).toISOString(),
      createdAtMs: now,
      createdAt: new Date(now).toISOString(),
      updatedAt: new Date(now).toISOString()
    }
  })
}

function sanitizeUser(user = {}) {
  return {
    userId: user.userId || '',
    name: user.name || '企业用户',
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

async function upsertUser(user = {}) {
  const safeUser = sanitizeUser(user)
  const existing = await db.collection('enterprise_auth_users').where({ userId: safeUser.userId }).limit(1).get()
  const now = nowIso()
  if (existing.data && existing.data.length) {
    await db.collection('enterprise_auth_users').doc(existing.data[0]._id).update({ data: { updatedAt: now } })
    return { ...safeUser, ...sanitizeUser(existing.data[0]) }
  }
  await db.collection('enterprise_auth_users').add({ data: { ...safeUser, createdAt: now, updatedAt: now } })
  return safeUser
}

async function findOrCreateIdentity(provider = 'email', normalizedAccountHash = '') {
  const existing = await db.collection('enterprise_account_identities').where({
    provider,
    normalizedAccountHash
  }).limit(1).get()
  const now = nowIso()
  if (existing.data && existing.data.length) {
    const record = existing.data[0]
    if (record.status === 'disabled') return { disabled: true }
    await db.collection('enterprise_account_identities').doc(record._id).update({ data: { updatedAt: now } })
    return { userId: record.userId, identityId: record.identityId }
  }
  const userId = `cloud_user_${shortHash(`account:${provider}:${normalizedAccountHash}`)}`
  const identityId = `account_${provider}_${shortHash(normalizedAccountHash)}`
  await db.collection('enterprise_account_identities').add({
    data: {
      identityId,
      provider,
      normalizedAccountHash,
      userId,
      status: 'active',
      createdAt: now,
      updatedAt: now
    }
  })
  await upsertUser({
    userId,
    name: provider === 'phone' ? '手机号用户' : '邮箱用户',
    avatar: ''
  })
  return { userId, identityId }
}

async function getUserById(userId = '') {
  const existing = await db.collection('enterprise_auth_users').where({ userId }).limit(1).get()
  return existing.data && existing.data.length ? sanitizeUser(existing.data[0]) : sanitizeUser({ userId })
}

async function listMemberships(userId = '') {
  const result = await db.collection('enterprises').where({
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

function buildSessionSummary(session = {}, user = {}, enterprise = {}, member = {}, memberships = [], sessionToken = '') {
  const payload = {
    authMode: 'cloud_authenticated',
    authProvider: session.authProvider || 'email_code',
    user: sanitizeUser(user),
    enterprise: sanitizeEnterprise(enterprise),
    member: sanitizeMember(member),
    role: member.role || 'member',
    enterprises: memberships,
    expiresAt: session.expiresAt,
    createdAt: session.createdAt || nowIso()
  }
  if (sessionToken) payload.sessionToken = sessionToken
  return payload
}

async function createSession(user = {}, authProvider = 'email_code') {
  const memberships = await listMemberships(user.userId)
  const target = chooseActiveMembership(memberships)
  const sessionToken = randomToken('cloud_session')
  const now = Date.now()
  const record = {
    sessionTokenHash: hash(sessionToken),
    userId: user.userId,
    enterpriseId: target ? target.enterprise.enterpriseId : '',
    memberId: target ? target.member.memberId : '',
    authProvider,
    status: 'active',
    expiresAt: new Date(now + SESSION_TTL_MS).toISOString(),
    createdAt: nowIso(),
    updatedAt: nowIso()
  }
  await db.collection('enterprise_auth_sessions').add({ data: record })
  return buildSessionSummary(record, user, target ? target.enterprise : {}, target ? target.member : {}, memberships, sessionToken)
}

async function getSession(sessionToken = '') {
  if (!sessionToken) return null
  const result = await db.collection('enterprise_auth_sessions').where({ sessionTokenHash: hash(sessionToken) }).limit(1).get()
  return result.data && result.data.length ? result.data[0] : null
}

async function requireSession(sessionToken = '') {
  const session = await getSession(sessionToken)
  if (!session) return { ok: false, errorCode: 'session_invalid', status: 'session_invalid', message: '登录态无效' }
  if (session.status !== 'active') return { ok: false, errorCode: 'session_invalid', status: 'session_invalid', message: '登录态已失效' }
  if (new Date(session.expiresAt).getTime() <= Date.now()) return { ok: false, errorCode: 'session_expired', status: 'session_expired', message: '登录态已过期' }
  return { ok: true, session }
}

async function getCapability() {
  return ok({
    email: providerStatus('email'),
    phone: providerStatus('phone')
  })
}

async function requestCode(event = {}) {
  const startedAt = Date.now()
  const provider = getProvider(event)
  const capability = providerStatus(provider)
  const validation = validateAccount(provider, event.account)
  if (!validation.ok) return fail(validation.errorCode, validation.message)
  if (!['configured', 'development_mock'].includes(capability.status)) {
    return fail('auth_provider_not_configured', '验证码服务暂未配置', { provider, accountType: provider })
  }

  const normalizedAccountHash = accountHash(provider, validation.value)
  const requestId = normalizeRequestId(event.requestId)
  const previousRequest = await getRequestRecord(requestId)
  if (previousRequest && previousRequest.response) return previousRequest.response

  const latest = await getLatestCodeRecord(provider, normalizedAccountHash)
  if (latest && latest.createdAtMs && Date.now() - latest.createdAtMs < SEND_INTERVAL_MS) {
    return fail('code_send_too_frequent', '验证码发送过于频繁，请稍后再试', {
      retryAfterSeconds: Math.ceil((SEND_INTERVAL_MS - (Date.now() - latest.createdAtMs)) / 1000)
    })
  }
  if (await countCodeRequests(provider, normalizedAccountHash, 'hour') >= HOURLY_LIMIT) {
    return fail('code_daily_limit_reached', '验证码请求过多，请稍后再试')
  }
  if (await countCodeRequests(provider, normalizedAccountHash, 'day') >= DAILY_LIMIT) {
    return fail('code_daily_limit_reached', '今日验证码请求已达上限')
  }

  const code = randomCode()
  const salt = randomToken('salt')
  const now = Date.now()
  let sendResult = {
    ok: true,
    provider: 'mock',
    status: 'sent',
    devCodeAvailable: capability.devCodeAvailable,
    debug: capability.devCodeAvailable ? { devCode: code } : undefined,
    message: capability.status === 'development_mock' ? '开发 Mock 验证码已生成' : '验证码已发送'
  }

  if (provider === 'email') {
    const emailProvider = createEmailProviderByEnv()
    sendResult = await emailProvider.provider.sendLoginCode({
      to: validation.value,
      code,
      expiresInMinutes: 5,
      requestId
    })
  }

  if (!sendResult || !sendResult.ok) {
    const errorCode = sendResult && sendResult.errorCode ? sendResult.errorCode : 'email_send_failed'
    const response = fail(errorCode, sendResult && sendResult.message ? sendResult.message : '验证码发送失败', {
      provider,
      accountType: provider
    })
    await saveRequestRecord(requestId, {
      provider,
      accountHashPrefix: normalizedAccountHash.slice(0, 8),
      status: 'failed',
      response
    })
    console.log('[enterprise_account_auth]', {
      action: 'requestCode',
      provider,
      accountType: provider,
      accountHashPrefix: normalizedAccountHash.slice(0, 8),
      hasRequestId: Boolean(requestId),
      sendSuccess: false,
      errorCode,
      elapsedMs: Date.now() - startedAt
    })
    return response
  }

  await invalidateOldCodes(provider, normalizedAccountHash)
  await db.collection('enterprise_account_codes').add({
    data: {
      provider,
      normalizedAccountHash,
      requestIdHash: hash(requestId),
      codeHash: hash(`${salt}:${code}`),
      salt,
      status: 'active',
      attempts: 0,
      lockedUntil: '',
      hourKey: getPeriodKey(new Date(now), 'hour'),
      dayKey: getPeriodKey(new Date(now), 'day'),
      createdAtMs: now,
      expiresAt: new Date(now + CODE_TTL_MS).toISOString(),
      createdAt: new Date(now).toISOString(),
      updatedAt: new Date(now).toISOString()
    }
  })

  const response = ok({}, {
    status: 'code_sent',
    provider,
    emailProvider: sendResult.provider,
    providerMessageId: sendResult.providerMessageId || '',
    authProvider: provider === 'phone' ? 'phone_code' : 'email_code',
    retryAfterSeconds: 60,
    devCodeAvailable: Boolean(sendResult.devCodeAvailable),
    debug: sendResult.debug,
    message: sendResult.message || '验证码已发送'
  })
  await saveRequestRecord(requestId, {
    provider,
    accountHashPrefix: normalizedAccountHash.slice(0, 8),
    status: 'code_sent',
    response
  })
  console.log('[enterprise_account_auth]', {
    action: 'requestCode',
    provider,
    accountType: provider,
    accountHashPrefix: normalizedAccountHash.slice(0, 8),
    hasRequestId: Boolean(requestId),
    sendSuccess: true,
    elapsedMs: Date.now() - startedAt
  })
  return response
}

async function verifyCode(event = {}) {
  const provider = getProvider(event)
  const validation = validateAccount(provider, event.account)
  if (!validation.ok) return fail(validation.errorCode, validation.message)
  const code = String(event.code || '').trim()
  if (!/^\d{6}$/.test(code)) return fail('code_invalid', '验证码不正确')
  const normalizedAccountHash = accountHash(provider, validation.value)
  const record = await getLatestCodeRecord(provider, normalizedAccountHash)
  if (!record) return fail('code_invalid', '验证码不正确')
  if (record.status === 'used') return fail('code_used', '验证码已使用')
  if (record.status !== 'active') return fail('code_invalid', '验证码已失效')
  if (record.lockedUntil && new Date(record.lockedUntil).getTime() > Date.now()) {
    return fail('verify_attempts_exceeded', '验证码错误次数过多，请稍后再试')
  }
  if (new Date(record.expiresAt).getTime() <= Date.now()) {
    await db.collection('enterprise_account_codes').doc(record._id).update({ data: { status: 'expired', updatedAt: nowIso() } })
    return fail('code_expired', '验证码已过期')
  }
  const matched = record.codeHash === hash(`${record.salt}:${code}`)
  if (!matched) {
    const attempts = Number(record.attempts || 0) + 1
    await db.collection('enterprise_account_codes').doc(record._id).update({
      data: {
        attempts,
        lockedUntil: attempts >= MAX_VERIFY_ATTEMPTS ? new Date(Date.now() + LOCK_MS).toISOString() : '',
        updatedAt: nowIso()
      }
    })
    return fail(attempts >= MAX_VERIFY_ATTEMPTS ? 'verify_attempts_exceeded' : 'code_invalid', attempts >= MAX_VERIFY_ATTEMPTS ? '验证码错误次数过多，请稍后再试' : '验证码不正确')
  }

  await db.collection('enterprise_account_codes').doc(record._id).update({
    data: { status: 'used', usedAt: nowIso(), updatedAt: nowIso() }
  })
  const identity = await findOrCreateIdentity(provider, normalizedAccountHash)
  if (identity.disabled) return fail('account_disabled', '账号已停用')
  const user = await getUserById(identity.userId)
  let session
  try {
    session = await createSession(user, provider === 'phone' ? 'phone_code' : 'email_code')
  } catch (error) {
    return fail('session_create_failed', '登录态创建失败')
  }
  console.log('[enterprise_account_auth]', {
    action: 'verifyCode',
    provider,
    accountType: provider,
    accountHashPrefix: normalizedAccountHash.slice(0, 8),
    success: true,
    hasSession: true
  })
  return ok({}, {
    status: 'authenticated',
    authMode: 'cloud_authenticated',
    authProvider: session.authProvider,
    provider,
    session
  })
}

async function restoreSession(event = {}) {
  const valid = await requireSession(event.sessionToken)
  if (!valid.ok) return fail(valid.errorCode, valid.message, { status: valid.status })
  const user = await getUserById(valid.session.userId)
  const memberships = await listMemberships(user.userId)
  const target = chooseActiveMembership(memberships, valid.session.enterpriseId)
  return ok({}, {
    status: 'authenticated',
    authMode: 'cloud_authenticated',
    authProvider: valid.session.authProvider || 'email_code',
    session: buildSessionSummary(valid.session, user, target ? target.enterprise : {}, target ? target.member : {}, memberships)
  })
}

async function listEnterprises(event = {}) {
  const valid = await requireSession(event.sessionToken)
  if (!valid.ok) return fail(valid.errorCode, valid.message, { status: valid.status })
  return ok({ enterprises: await listMemberships(valid.session.userId) }, { status: 'authenticated' })
}

async function switchEnterprise(event = {}) {
  const valid = await requireSession(event.sessionToken)
  if (!valid.ok) return fail(valid.errorCode, valid.message, { status: valid.status })
  const user = await getUserById(valid.session.userId)
  const memberships = await listMemberships(user.userId)
  const target = memberships.find((item) => item.enterprise.enterpriseId === event.enterpriseId)
  if (!target) return fail('not_found', '未找到企业成员关系')
  if (!target.member || target.member.status !== 'active') return fail('member_inactive', '当前成员状态不可进入')
  await db.collection('enterprise_auth_sessions').doc(valid.session._id).update({
    data: {
      enterpriseId: target.enterprise.enterpriseId,
      memberId: target.member.memberId,
      updatedAt: nowIso()
    }
  })
  return ok({}, {
    status: 'authenticated',
    authMode: 'cloud_authenticated',
    authProvider: valid.session.authProvider || 'email_code',
    session: buildSessionSummary(valid.session, user, target.enterprise, target.member, memberships)
  })
}

async function logout(event = {}) {
  const session = await getSession(event.sessionToken)
  if (session && session._id) {
    await db.collection('enterprise_auth_sessions').doc(session._id).update({
      data: { status: 'revoked', updatedAt: nowIso() }
    })
  }
  return ok({}, { status: 'logged_out' })
}

exports.main = async (event = {}) => {
  const action = event.action || ''
  console.log('[enterprise_account_auth]', { action, provider: event.provider || '', accountType: event.provider || '', hasRequestId: Boolean(event.requestId) })
  if (action === 'getCapability') return getCapability(event)
  if (action === 'requestCode') return requestCode(event)
  if (action === 'verifyCode') return verifyCode(event)
  if (action === 'restoreSession') return restoreSession(event)
  if (action === 'listEnterprises') return listEnterprises(event)
  if (action === 'switchEnterprise') return switchEnterprise(event)
  if (action === 'logout') return logout(event)
  return fail('unknown_action', '未知账号身份动作')
}
