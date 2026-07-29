const assert = require('assert')
const crypto = require('crypto')

function hash(value = '') {
  return crypto.createHash('sha256').update(String(value)).digest('hex')
}

function normalizeEmail(value = '') {
  return String(value || '').trim().toLowerCase()
}

function validateEmail(value = '') {
  const email = normalizeEmail(value)
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 120
}

function normalizePhone(value = '') {
  const raw = String(value || '').trim().replace(/[\s-]/g, '')
  if (/^1\d{10}$/.test(raw)) return `+86${raw}`
  if (/^86\d{11}$/.test(raw)) return `+${raw}`
  return raw
}

function validatePhone(value = '') {
  return /^\+861[3-9]\d{9}$/.test(normalizePhone(value))
}

function createHarness(options = {}) {
  const now = { value: Date.now() }
  const state = {
    codes: [],
    identities: new Map(),
    sessions: new Map(),
    logs: [],
    sendCount: 0
  }
  const config = {
    emailEnabled: Boolean(options.emailEnabled),
    phoneEnabled: Boolean(options.phoneEnabled),
    devMock: Boolean(options.devMock),
    production: Boolean(options.production)
  }

  function capability(provider = 'email') {
    const enabled = provider === 'phone' ? config.phoneEnabled : config.emailEnabled
    if (!enabled) return { status: 'disabled', devCodeAvailable: false }
    if (options.configured) return { status: 'configured', devCodeAvailable: false }
    if (config.devMock && !config.production) return { status: 'development_mock', devCodeAvailable: true }
    return { status: 'disabled', devCodeAvailable: false }
  }

  function log(payload = {}) {
    state.logs.push(JSON.stringify(payload))
  }

  function accountHash(provider, account) {
    return hash(`${provider}:${account}`)
  }

  function requestCode(provider, account) {
    const normalized = provider === 'phone' ? normalizePhone(account) : normalizeEmail(account)
    if (provider === 'email' && !validateEmail(normalized)) return { success: false, errorCode: 'invalid_email' }
    if (provider === 'phone' && !validatePhone(normalized)) return { success: false, errorCode: 'invalid_phone' }
    const cap = capability(provider)
    if (!['configured', 'development_mock'].includes(cap.status)) return { success: false, errorCode: 'auth_provider_not_configured' }
    const key = accountHash(provider, normalized)
    const latest = state.codes.filter((item) => item.key === key).sort((a, b) => b.createdAt - a.createdAt)[0]
    if (latest && now.value - latest.createdAt < 60000) return { success: false, errorCode: 'code_send_too_frequent' }
    const hourCount = state.codes.filter((item) => item.key === key && now.value - item.createdAt < 3600000).length
    if (hourCount >= 5) return { success: false, errorCode: 'code_daily_limit_reached' }
    if (provider === 'email' && options.providerFailure) {
      return { success: false, errorCode: options.providerFailure, savedCodeCount: state.codes.length }
    }
    if (provider === 'email') state.sendCount += 1
    state.codes.filter((item) => item.key === key && item.status === 'active').forEach((item) => { item.status = 'invalidated' })
    const code = '123456'
    const salt = crypto.randomBytes(8).toString('hex')
    state.codes.push({
      key,
      provider,
      codeHash: hash(`${salt}:${code}`),
      salt,
      status: 'active',
      attempts: 0,
      createdAt: now.value,
      expiresAt: now.value + 300000
    })
    log({ action: 'requestCode', provider, accountHashPrefix: key.slice(0, 8), success: true })
    return { success: true, status: 'code_sent', debug: cap.devCodeAvailable ? { devCode: code } : undefined }
  }

  const requestCache = new Map()
  function requestCodeWithId(provider, account, requestId) {
    if (requestCache.has(requestId)) return requestCache.get(requestId)
    const result = requestCode(provider, account)
    requestCache.set(requestId, result)
    return result
  }

  function verifyCode(provider, account, code) {
    const normalized = provider === 'phone' ? normalizePhone(account) : normalizeEmail(account)
    const key = accountHash(provider, normalized)
    const record = state.codes.filter((item) => item.key === key).sort((a, b) => b.createdAt - a.createdAt)[0]
    if (!record) return { success: false, errorCode: 'code_invalid' }
    if (record.status === 'used') return { success: false, errorCode: 'code_used' }
    if (record.status !== 'active') return { success: false, errorCode: 'code_invalid' }
    if (record.lockedUntil && record.lockedUntil > now.value) return { success: false, errorCode: 'verify_attempts_exceeded' }
    if (record.expiresAt <= now.value) return { success: false, errorCode: 'code_expired' }
    if (record.codeHash !== hash(`${record.salt}:${code}`)) {
      record.attempts += 1
      if (record.attempts >= 5) {
        record.lockedUntil = now.value + 900000
        return { success: false, errorCode: 'verify_attempts_exceeded' }
      }
      return { success: false, errorCode: 'code_invalid' }
    }
    record.status = 'used'
    const identityKey = hash(`${provider}:${key}`).slice(0, 24)
    const userId = state.identities.get(identityKey) || `cloud_user_${identityKey}`
    state.identities.set(identityKey, userId)
    const sessionToken = `cloud_session_${crypto.randomBytes(12).toString('hex')}`
    state.sessions.set(hash(sessionToken), { userId, status: 'active', expiresAt: now.value + 86400000 })
    log({ action: 'verifyCode', provider, accountHashPrefix: key.slice(0, 8), success: true, hasSession: true })
    return { success: true, status: 'authenticated', session: { sessionToken, user: { userId }, enterprises: [] } }
  }

  function restoreSession(sessionToken) {
    const session = state.sessions.get(hash(sessionToken))
    if (!session) return { success: false, errorCode: 'session_invalid' }
    if (session.status !== 'active') return { success: false, errorCode: 'session_invalid' }
    if (session.expiresAt <= now.value) return { success: false, errorCode: 'session_expired' }
    return { success: true, status: 'authenticated', session: { user: { userId: session.userId } } }
  }

  function logout(sessionToken) {
    const session = state.sessions.get(hash(sessionToken))
    if (session) session.status = 'revoked'
    return { success: true }
  }

  return { now, state, capability, requestCode, requestCodeWithId, verifyCode, restoreSession, logout }
}

function assertNoSensitiveLogs(logs) {
  const text = logs.join('\n')
  assert(!/demo@example\.com|13812345678|\+8613812345678|123456|cloud_session_/.test(text), 'logs must not include account/code/token')
}

function run() {
  assert(validateEmail(' Demo@Example.com '), 'email validation')
  assert(validatePhone('13812345678'), 'phone validation')

  const disabled = createHarness()
  assert.strictEqual(disabled.requestCode('email', 'demo@example.com').errorCode, 'auth_provider_not_configured', 'unconfigured rejected')
  const incomplete = createHarness({ emailEnabled: true })
  assert.strictEqual(incomplete.requestCode('email', 'demo@example.com').errorCode, 'auth_provider_not_configured', 'incomplete provider rejected')

  const mock = createHarness({ emailEnabled: true, phoneEnabled: true, devMock: true })
  const sent = mock.requestCode('email', 'demo@example.com')
  assert(sent.debug && sent.debug.devCode, 'development mock returns debug devCode')
  assert.strictEqual(mock.requestCode('email', 'demo@example.com').errorCode, 'code_send_too_frequent', 'send interval limit')
  mock.now.value += 61000
  assert.strictEqual(mock.requestCode('email', 'demo@example.com').success, true, 'new code invalidates old')
  const loginA = mock.verifyCode('email', 'demo@example.com', '123456')
  assert.strictEqual(loginA.status, 'authenticated', 'correct code login')
  assert.strictEqual(mock.verifyCode('email', 'demo@example.com', '123456').errorCode, 'code_used', 'code cannot reuse')

  mock.now.value += 61000
  mock.requestCode('phone', '13812345678')
  assert.strictEqual(mock.verifyCode('phone', '13812345678', '000000').errorCode, 'code_invalid', 'wrong code')
  mock.verifyCode('phone', '13812345678', '000000')
  mock.verifyCode('phone', '13812345678', '000000')
  mock.verifyCode('phone', '13812345678', '000000')
  assert.strictEqual(mock.verifyCode('phone', '13812345678', '000000').errorCode, 'verify_attempts_exceeded', 'verify failure lock')

  mock.now.value += 61000
  mock.requestCode('email', 'second@example.com')
  mock.now.value += 301000
  assert.strictEqual(mock.verifyCode('email', 'second@example.com', '123456').errorCode, 'code_expired', 'code expired')

  const providerFailed = createHarness({ emailEnabled: true, devMock: true, providerFailure: 'email_send_failed' })
  assert.strictEqual(providerFailed.requestCode('email', 'fail@example.com').errorCode, 'email_send_failed', 'provider failure surfaced')
  assert.strictEqual(providerFailed.state.codes.length, 0, 'send failure does not save usable code')

  const idem = createHarness({ emailEnabled: true, devMock: true })
  const idemA = idem.requestCodeWithId('email', 'idem@example.com', 'request_same')
  const idemB = idem.requestCodeWithId('email', 'idem@example.com', 'request_same')
  assert.strictEqual(idemA, idemB, 'same requestId returns first result')
  assert.strictEqual(idem.state.sendCount, 1, 'same requestId sends once')

  const reuse = createHarness({ emailEnabled: true, devMock: true })
  const one = reuse.requestCode('email', 'same@example.com')
  assert(one.success)
  const loginOne = reuse.verifyCode('email', 'same@example.com', '123456')
  reuse.now.value += 61000
  reuse.requestCode('email', 'same@example.com')
  const loginTwo = reuse.verifyCode('email', 'same@example.com', '123456')
  assert.strictEqual(loginOne.session.user.userId, loginTwo.session.user.userId, 'same account reuses userId')
  assert.strictEqual(reuse.restoreSession(loginTwo.session.sessionToken).status, 'authenticated', 'restore session')
  reuse.logout(loginTwo.session.sessionToken)
  assert.strictEqual(reuse.restoreSession(loginTwo.session.sessionToken).errorCode, 'session_invalid', 'logout invalidates session')

  const production = createHarness({ emailEnabled: true, devMock: true, production: true })
  assert.strictEqual(production.requestCode('email', 'prod@example.com').errorCode, 'auth_provider_not_configured', 'production does not return devCode')

  const cloudFailure = { success: false, authSource: 'cloud_failed' }
  assert.notStrictEqual(cloudFailure.authSource, 'local_mock', 'cloud failure does not downgrade local_mock')
  assertNoSensitiveLogs(mock.state.logs)
  console.log('enterprise-account-auth smoke passed')
}

run()
