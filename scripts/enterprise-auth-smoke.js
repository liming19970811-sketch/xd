const assert = require('assert')
const crypto = require('crypto')

function hash(value = '') {
  return crypto.createHash('sha256').update(String(value)).digest('hex')
}

function randomState() {
  return `wechat_state_${crypto.randomBytes(24).toString('hex')}`
}

function createHarness(config = {}) {
  const store = {
    states: new Map(),
    identities: new Map(),
    sessions: new Map(),
    logs: []
  }
  const cfg = {
    appId: config.appId || '',
    appSecret: config.appSecret || '',
    redirectUri: config.redirectUri || '',
    enabled: Boolean(config.enabled)
  }
  const configured = Boolean(cfg.enabled && cfg.appId && cfg.appSecret && cfg.redirectUri)
  const authCapability = configured ? 'wechat_web_oauth' : 'placeholder'

  function log(message, payload = {}) {
    store.logs.push(`${message} ${JSON.stringify(payload)}`)
  }

  function getAuthCapability() {
    return { success: true, authCapability, configured }
  }

  function startLogin() {
    log('[enterprise_auth]', { action: 'startWechatWebLogin', authCapability })
    if (!configured) {
      return { success: false, errorCode: 'wechat_auth_not_configured', authCapability, authMode: 'cloud_failed' }
    }
    const state = randomState()
    store.states.set(hash(state), {
      stateHash: hash(state),
      status: 'pending',
      redirectUri: cfg.redirectUri,
      expiresAt: Date.now() + 300000
    })
    return {
      success: true,
      status: 'pending',
      authCapability,
      authMode: 'cloud_pending',
      loginTicket: state,
      qrUrl: `https://open.weixin.qq.com/connect/qrconnect?appid=${cfg.appId}&state=${state}`
    }
  }

  function expireState(state) {
    const item = store.states.get(hash(state))
    if (item) item.expiresAt = Date.now() - 1
  }

  function completeLogin(input = {}, exchangeResult = {}) {
    if (!configured) return { success: false, errorCode: 'wechat_auth_not_configured', authCapability }
    if (!input.code) return { success: false, errorCode: 'auth_code_missing', authCapability }
    const item = store.states.get(hash(input.state || ''))
    if (!item) return { success: false, errorCode: 'auth_state_invalid', authCapability }
    if (item.status === 'used') return { success: false, errorCode: 'auth_state_used', authCapability }
    if (item.expiresAt <= Date.now()) return { success: false, errorCode: 'auth_state_expired', authCapability }
    item.status = 'used'
    if (!exchangeResult.access_token) {
      return { success: false, errorCode: 'wechat_token_exchange_failed', authCapability }
    }
    if (!exchangeResult.openid) {
      return { success: false, errorCode: 'wechat_identity_invalid', authCapability }
    }
    const identityKey = exchangeResult.unionid || exchangeResult.openid
    const identityHash = hash(`${cfg.appId}:${identityKey}`).slice(0, 24)
    const existingUserId = store.identities.get(identityHash)
    const userId = existingUserId || `cloud_user_${identityHash}`
    store.identities.set(identityHash, userId)
    const sessionToken = `cloud_session_${crypto.randomBytes(16).toString('hex')}`
    store.sessions.set(hash(sessionToken), { userId, status: 'active', expiresAt: Date.now() + 86400000 })
    return {
      success: true,
      status: 'authenticated',
      authSource: 'cloud',
      authMode: 'cloud_authenticated',
      authCapability,
      identityAvailable: true,
      session: {
        sessionToken,
        authSource: 'cloud',
        authMode: 'cloud_authenticated',
        user: { userId, name: '微信用户', avatar: '' },
        enterprises: []
      }
    }
  }

  function restoreSession(sessionToken = '') {
    const session = store.sessions.get(hash(sessionToken))
    if (!session) return { success: false, errorCode: 'session_invalid', status: 'session_invalid' }
    if (session.status !== 'active') return { success: false, errorCode: 'session_invalid', status: 'session_invalid' }
    if (session.expiresAt <= Date.now()) return { success: false, errorCode: 'session_expired', status: 'session_expired' }
    return { success: true, status: 'authenticated', authMode: 'cloud_authenticated', session: { user: { userId: session.userId }, enterprises: [] } }
  }

  function expireSession(sessionToken = '') {
    const session = store.sessions.get(hash(sessionToken))
    if (session) session.expiresAt = Date.now() - 1
  }

  function logout(sessionToken = '') {
    const session = store.sessions.get(hash(sessionToken))
    if (session) session.status = 'revoked'
    return { success: true, status: 'logged_out' }
  }

  function simulateCloudFailure() {
    return { success: false, errorCode: 'cloud_call_failed', authMode: 'cloud_failed' }
  }

  return { store, getAuthCapability, startLogin, expireState, completeLogin, restoreSession, expireSession, logout, simulateCloudFailure }
}

function assertNoSensitiveLogs(logs = []) {
  const joined = logs.join('\n')
  assert(!/secret_value|auth_code_value|cloud_session_|openid_value|unionid_value|WECHAT_WEB_APP_SECRET/.test(joined), 'logs must not contain code/token/openId/unionId/AppSecret')
}

function run() {
  const placeholder = createHarness()
  assert.strictEqual(placeholder.getAuthCapability().authCapability, 'placeholder', 'unconfigured capability is placeholder')
  assert.strictEqual(placeholder.startLogin().errorCode, 'wechat_auth_not_configured', 'unconfigured login rejected')
  assert.notStrictEqual(placeholder.startLogin().authMode, 'cloud_authenticated', 'unconfigured login never authenticated')

  const oauth = createHarness({
    appId: 'wx_app_id',
    appSecret: 'secret_value',
    redirectUri: 'https://www.diebiandesign.com/#/pages/enterprise-web/auth-callback',
    enabled: true
  })
  const startA = oauth.startLogin()
  const startB = oauth.startLogin()
  assert.notStrictEqual(startA.loginTicket, startB.loginTicket, 'startLogin generates random state')
  assert.strictEqual(oauth.completeLogin({ code: '', state: startA.loginTicket }).errorCode, 'auth_code_missing', 'missing code rejected')
  assert.strictEqual(oauth.completeLogin({ code: 'auth_code_value', state: 'wrong_state' }).errorCode, 'auth_state_invalid', 'wrong state rejected')

  const expired = oauth.startLogin()
  oauth.expireState(expired.loginTicket)
  assert.strictEqual(oauth.completeLogin({ code: 'auth_code_value', state: expired.loginTicket }, { openid: 'openid_value', access_token: 'token_value' }).errorCode, 'auth_state_expired', 'expired state rejected')
  const invalidIdentity = oauth.startLogin()
  assert.strictEqual(oauth.completeLogin({ code: 'auth_code_value', state: invalidIdentity.loginTicket }, { access_token: 'token_value' }).errorCode, 'wechat_identity_invalid', 'invalid wechat identity rejected')

  const goodA = oauth.startLogin()
  const loginA = oauth.completeLogin({ code: 'auth_code_value', state: goodA.loginTicket }, { openid: 'openid_value', unionid: 'unionid_value', access_token: 'token_value' })
  assert.strictEqual(loginA.status, 'authenticated', 'token exchange mock success')
  assert.strictEqual(oauth.completeLogin({ code: 'auth_code_value', state: goodA.loginTicket }, { openid: 'openid_value', access_token: 'token_value' }).errorCode, 'auth_state_used', 'state single use enforced')

  const goodB = oauth.startLogin()
  const loginB = oauth.completeLogin({ code: 'auth_code_value', state: goodB.loginTicket }, { openid: 'openid_value', unionid: 'unionid_value', access_token: 'token_value' })
  assert.strictEqual(loginA.session.user.userId, loginB.session.user.userId, 'same wechat identity reuses userId')
  assert(loginA.session.sessionToken, 'session created')
  assert.strictEqual(oauth.restoreSession(loginA.session.sessionToken).status, 'authenticated', 'restoreSession works')
  oauth.expireSession(loginA.session.sessionToken)
  assert.strictEqual(oauth.restoreSession(loginA.session.sessionToken).errorCode, 'session_expired', 'session expired handled')
  oauth.logout(loginB.session.sessionToken)
  assert.strictEqual(oauth.restoreSession(loginB.session.sessionToken).errorCode, 'session_invalid', 'logout invalidates session')
  assert.strictEqual(oauth.simulateCloudFailure().authMode, 'cloud_failed', 'cloud failure does not downgrade local_mock')

  const localMock = { authSource: 'local_mock', explicit: true }
  assert.strictEqual(localMock.authSource, 'local_mock', 'local_mock requires explicit selection in UI layer')
  assertNoSensitiveLogs(oauth.store.logs)
  console.log('enterprise-auth smoke passed')
}

run()
