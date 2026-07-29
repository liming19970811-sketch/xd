const assert = require('assert')
const crypto = require('crypto')

function hash(value = '') {
  return crypto.createHash('sha256').update(String(value || '')).digest('hex')
}

function shortHash(value = '') {
  return hash(value).slice(0, 24)
}

function randomToken(prefix = 'token') {
  return `${prefix}_${crypto.randomBytes(24).toString('hex')}`
}

function createHarness() {
  const store = {
    tickets: new Map(),
    users: new Map(),
    identities: new Map(),
    sessions: new Map(),
    logs: []
  }
  const enterprises = [
    {
      enterpriseId: 'enterprise_a',
      enterpriseName: '示例企业 A',
      members: [{ memberId: 'member_active', enterpriseId: 'enterprise_a', userId: 'user_active', role: 'admin', status: 'active' }]
    },
    {
      enterpriseId: 'enterprise_pending',
      enterpriseName: '待审核企业',
      members: [{ memberId: 'member_pending', enterpriseId: 'enterprise_pending', userId: 'user_pending', role: 'member', status: 'pending' }]
    },
    {
      enterpriseId: 'enterprise_disabled',
      enterpriseName: '停用企业',
      members: [{ memberId: 'member_disabled', enterpriseId: 'enterprise_disabled', userId: 'user_disabled', role: 'member', status: 'disabled' }]
    }
  ]

  function log(message, payload = {}) {
    store.logs.push(`${message} ${JSON.stringify(payload)}`)
  }

  function userFromOpenid(openid = '') {
    const map = {
      openid_active: 'user_active',
      openid_pending: 'user_pending',
      openid_disabled: 'user_disabled',
      openid_new: 'user_new'
    }
    const userId = map[openid] || `user_${shortHash(openid)}`
    store.users.set(userId, { userId, name: '小程序用户' })
    store.identities.set(shortHash(openid), userId)
    return store.users.get(userId)
  }

  function listMemberships(userId = '') {
    return enterprises.flatMap((enterprise) => enterprise.members
      .filter((member) => member.userId === userId)
      .map((member) => ({ enterprise: { enterpriseId: enterprise.enterpriseId, enterpriseName: enterprise.enterpriseName }, member, role: member.role })))
  }

  function createTicket() {
    const loginTicket = randomToken('web_login')
    const ticketId = `ticket_${shortHash(loginTicket)}`
    store.tickets.set(hash(loginTicket), {
      ticketId,
      ticketHash: hash(loginTicket),
      status: 'pending',
      expiresAt: Date.now() + 300000,
      attemptCount: 0
    })
    log('[enterprise_web_login]', { action: 'createTicket', status: 'pending', ticketId })
    return { success: true, status: 'pending', loginTicket, ticketId, qrPayload: `/package-mobile-enterprise/web-login-confirm/web-login-confirm?ticket=${encodeURIComponent(loginTicket)}` }
  }

  function getTicket(loginTicket = '') {
    return store.tickets.get(hash(loginTicket))
  }

  function expireTicket(loginTicket = '') {
    const ticket = getTicket(loginTicket)
    if (ticket) ticket.expiresAt = Date.now() - 1
  }

  function getTicketStatus(loginTicket = '') {
    const ticket = getTicket(loginTicket)
    if (!ticket) return { success: false, errorCode: 'ticket_invalid' }
    if (ticket.expiresAt <= Date.now() && ['pending', 'confirmed'].includes(ticket.status)) {
      ticket.status = 'expired'
      return { success: false, status: 'expired', errorCode: 'ticket_expired' }
    }
    return { success: true, status: ticket.status }
  }

  function getConfirmContext(loginTicket = '', openid = '') {
    const status = getTicketStatus(loginTicket)
    if (!status.success && status.errorCode !== undefined) return status
    const user = userFromOpenid(openid)
    return {
      success: true,
      user,
      enterprises: listMemberships(user.userId).filter((item) => item.member.status === 'active')
    }
  }

  function confirmTicket(loginTicket = '', openid = '', enterpriseId = '') {
    const ticket = getTicket(loginTicket)
    if (!ticket) return { success: false, errorCode: 'ticket_invalid' }
    if (ticket.status === 'confirmed') return { success: false, errorCode: 'ticket_already_confirmed' }
    if (ticket.status === 'cancelled') return { success: false, errorCode: 'ticket_cancelled' }
    if (ticket.expiresAt <= Date.now()) {
      ticket.status = 'expired'
      return { success: false, errorCode: 'ticket_expired' }
    }
    const user = userFromOpenid(openid)
    const memberships = listMemberships(user.userId)
    if (enterpriseId) {
      const anyTarget = memberships.find((item) => item.enterprise.enterpriseId === enterpriseId)
      if (!anyTarget) {
        ticket.attemptCount += 1
        return { success: false, errorCode: 'enterprise_not_accessible' }
      }
      if (anyTarget.member.status !== 'active') {
        ticket.attemptCount += 1
        return { success: false, errorCode: 'member_inactive' }
      }
    }
    ticket.status = 'confirmed'
    ticket.confirmedUserId = user.userId
    ticket.confirmedEnterpriseId = enterpriseId
    log('[enterprise_web_login]', { action: 'confirmTicket', status: 'confirmed', ticketId: ticket.ticketId, hasOpenid: Boolean(openid) })
    return { success: true, status: 'confirmed' }
  }

  function consumeTicket(loginTicket = '') {
    const ticket = getTicket(loginTicket)
    if (!ticket) return { success: false, errorCode: 'ticket_invalid' }
    if (ticket.status === 'consumed') return { success: false, errorCode: 'ticket_consumed' }
    if (ticket.status === 'cancelled') return { success: false, errorCode: 'ticket_cancelled' }
    if (ticket.status !== 'confirmed') return { success: true, status: ticket.status }
    const user = store.users.get(ticket.confirmedUserId)
    const memberships = listMemberships(user.userId)
    const target = memberships.find((item) => item.enterprise.enterpriseId === ticket.confirmedEnterpriseId && item.member.status === 'active') ||
      memberships.find((item) => item.member.status === 'active')
    const sessionToken = randomToken('cloud_session')
    store.sessions.set(hash(sessionToken), { userId: user.userId, status: 'active' })
    ticket.status = 'consumed'
    return {
      success: true,
      status: 'authenticated',
      session: {
        sessionToken,
        authMode: 'cloud_authenticated',
        authProvider: 'miniapp_scan',
        user,
        enterprise: target ? target.enterprise : {},
        member: target ? target.member : {},
        enterprises: memberships
      }
    }
  }

  function cancelTicket(loginTicket = '') {
    const ticket = getTicket(loginTicket)
    if (!ticket) return { success: false, errorCode: 'ticket_invalid' }
    ticket.status = 'cancelled'
    return { success: true, status: 'cancelled' }
  }

  function simulateCloudFailure() {
    return { success: false, errorCode: 'cloud_call_failed', authMode: 'cloud_failed', authProvider: 'miniapp_scan' }
  }

  return { store, createTicket, getTicket, getTicketStatus, getConfirmContext, confirmTicket, consumeTicket, cancelTicket, expireTicket, simulateCloudFailure }
}

function createTransportHarness() {
  const calls = []
  const cloudFunctionTransport = {
    createTicket(input = {}) {
      calls.push({ type: 'wx.cloud', action: 'createTicket', input })
      return { success: true, status: 'pending', via: 'wx.cloud' }
    }
  }
  const httpTransport = {
    enabled: false,
    apiBase: '',
    createTicket(input = {}) {
      calls.push({ type: 'http', action: 'createTicket', input })
      if (!this.enabled || !this.apiBase) {
        return { success: false, errorCode: 'http_transport_not_configured', message: 'H5 登录接口尚未配置' }
      }
      return { success: true, status: 'pending', via: 'http' }
    }
  }
  function createTicket(platform = 'h5', input = {}) {
    return platform === 'h5' ? httpTransport.createTicket(input) : cloudFunctionTransport.createTicket(input)
  }
  return { calls, httpTransport, createTicket }
}

function createHttpGatewayHarness(core) {
  const allowedOrigins = new Set(['https://www.diebiandesign.com', 'http://localhost:8080'])
  function handle({ origin = '', method = 'POST', contentType = 'application/json', body = {} } = {}) {
    if (!allowedOrigins.has(origin)) return { success: false, errorCode: 'invalid_origin' }
    if (method !== 'POST' && method !== 'OPTIONS') return { success: false, errorCode: 'invalid_method' }
    if (method === 'OPTIONS') return { success: true, status: 'preflight' }
    if (!contentType.includes('application/json')) return { success: false, errorCode: 'invalid_content_type' }
    if (JSON.stringify(body).length > 16 * 1024) return { success: false, errorCode: 'request_too_large' }
    if (['getConfirmContext', 'confirmTicket'].includes(body.action)) return { success: false, errorCode: 'invalid_action' }
    if (!['createTicket', 'getTicketStatus', 'consumeTicket', 'cancelTicket'].includes(body.action)) return { success: false, errorCode: 'invalid_action' }
    if (body.action === 'createTicket') return core.createTicket()
    if (body.action === 'getTicketStatus') return core.getTicketStatus(body.loginTicket)
    if (body.action === 'consumeTicket') return core.consumeTicket(body.loginTicket)
    if (body.action === 'cancelTicket') return core.cancelTicket(body.loginTicket)
    return { success: false, errorCode: 'invalid_action' }
  }
  return { handle }
}

function assertNoSensitiveLogs(logs = []) {
  const joined = logs.join('\n')
  assert(!/web_login_|cloud_session_|openid_active|openid_pending|openid_disabled|openid_new/.test(joined), 'logs must not contain ticket/openId/token')
}

function run() {
  const h = createHarness()
  const a = h.createTicket()
  const b = h.createTicket()
  assert.notStrictEqual(a.loginTicket, b.loginTicket, 'createTicket must generate random tickets')
  assert(h.getTicket(a.loginTicket).ticketHash, 'ticket hash stored')
  assert(!h.getTicket(a.loginTicket).loginTicket, 'plain ticket is not stored')
  assert.strictEqual(h.getTicketStatus(a.loginTicket).status, 'pending', 'pending status visible')

  const context = h.getConfirmContext(a.loginTicket, 'openid_active')
  assert.strictEqual(context.enterprises.length, 1, 'active member can be listed')
  assert.strictEqual(h.getConfirmContext(a.loginTicket, 'openid_pending').enterprises.length, 0, 'pending member is not selectable')
  assert.strictEqual(h.confirmTicket(a.loginTicket, 'openid_pending', 'enterprise_pending').errorCode, 'member_inactive', 'pending member confirm rejected')
  assert.strictEqual(h.confirmTicket(a.loginTicket, 'openid_disabled', 'enterprise_disabled').errorCode, 'member_inactive', 'disabled member confirm rejected')
  assert.strictEqual(h.confirmTicket(a.loginTicket, 'openid_active', 'enterprise_missing').errorCode, 'enterprise_not_accessible', 'wrong enterprise rejected')
  assert.strictEqual(h.confirmTicket(a.loginTicket, 'openid_active', 'enterprise_a').status, 'confirmed', 'active member confirms')
  assert.strictEqual(h.confirmTicket(a.loginTicket, 'openid_active', 'enterprise_a').errorCode, 'ticket_already_confirmed', 'confirmed ticket cannot confirm again')
  assert.strictEqual(h.getTicketStatus(a.loginTicket).status, 'confirmed', 'confirmed status visible')

  const consumed = h.consumeTicket(a.loginTicket)
  assert.strictEqual(consumed.status, 'authenticated', 'consume creates session')
  assert.strictEqual(consumed.session.authProvider, 'miniapp_scan', 'session provider is miniapp_scan')
  assert.strictEqual(h.consumeTicket(a.loginTicket).errorCode, 'ticket_consumed', 'consume replay rejected')

  const expired = h.createTicket()
  h.expireTicket(expired.loginTicket)
  assert.strictEqual(h.getTicketStatus(expired.loginTicket).errorCode, 'ticket_expired', 'expired ticket rejected')
  const cancelled = h.createTicket()
  assert.strictEqual(h.cancelTicket(cancelled.loginTicket).status, 'cancelled', 'ticket can be cancelled')
  assert.strictEqual(h.confirmTicket(cancelled.loginTicket, 'openid_active', 'enterprise_a').errorCode, 'ticket_cancelled', 'cancelled ticket cannot confirm')
  assert.notStrictEqual(h.simulateCloudFailure().authMode, 'local_mock', 'cloud failure never downgrades local_mock')

  const transport = createTransportHarness()
  assert.strictEqual(transport.createTicket('mp').via, 'wx.cloud', 'MP transport uses wx.cloud')
  assert.strictEqual(transport.createTicket('h5').errorCode, 'http_transport_not_configured', 'H5 missing config returns clear error')
  transport.httpTransport.enabled = true
  transport.httpTransport.apiBase = 'https://www.diebiandesign.com/api/enterprise-web-login'
  assert.strictEqual(transport.createTicket('h5').via, 'http', 'H5 transport uses HTTP')

  const gatewayCore = createHarness()
  const gateway = createHttpGatewayHarness(gatewayCore)
  assert.strictEqual(gateway.handle({ origin: 'https://evil.example', body: { action: 'createTicket' } }).errorCode, 'invalid_origin', 'invalid origin rejected')
  assert.strictEqual(gateway.handle({ origin: 'https://www.diebiandesign.com', body: { action: 'unknown' } }).errorCode, 'invalid_action', 'invalid action rejected')
  assert.strictEqual(gateway.handle({ origin: 'https://www.diebiandesign.com', body: { action: 'getConfirmContext' } }).errorCode, 'invalid_action', 'getConfirmContext blocked on HTTP')
  assert.strictEqual(gateway.handle({ origin: 'https://www.diebiandesign.com', body: { action: 'confirmTicket' } }).errorCode, 'invalid_action', 'confirmTicket blocked on HTTP')
  const httpTicket = gateway.handle({ origin: 'https://www.diebiandesign.com', body: { action: 'createTicket' } })
  assert.strictEqual(httpTicket.status, 'pending', 'HTTP createTicket works')
  assert.strictEqual(gateway.handle({ origin: 'https://www.diebiandesign.com', body: { action: 'getTicketStatus', loginTicket: httpTicket.loginTicket } }).status, 'pending', 'HTTP status works')
  assert.strictEqual(gateway.handle({ origin: 'https://www.diebiandesign.com', body: { action: 'cancelTicket', loginTicket: httpTicket.loginTicket } }).status, 'cancelled', 'HTTP cancel works')

  assertNoSensitiveLogs(h.store.logs)
  assertNoSensitiveLogs(gatewayCore.store.logs)
  console.log('enterprise-miniapp-login smoke passed')
}

run()
