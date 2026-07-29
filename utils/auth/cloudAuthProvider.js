import { callEnterpriseAuth } from './enterpriseAuthTransport.js'
import { AUTH_CAPABILITIES, normalizeAuthCapability } from './wechatWebAuthConfig.js'

export const AUTH_MODES = Object.freeze({
  LOCAL_MOCK: 'local_mock',
  CLOUD_PENDING: 'cloud_pending',
  CLOUD_AUTHENTICATED: 'cloud_authenticated',
  CLOUD_FAILED: 'cloud_failed'
})

export const LOGIN_STATUSES = Object.freeze({
  PENDING: 'pending',
  AUTHENTICATED: 'authenticated',
  EXPIRED: 'expired',
  CANCELLED: 'cancelled',
  FAILED: 'failed',
  IDENTITY_UNAVAILABLE: 'identity_unavailable',
  SESSION_INVALID: 'session_invalid',
  SESSION_EXPIRED: 'session_expired'
})

export { AUTH_CAPABILITIES }

function normalizeCloudError(errorCode = 'cloud_call_failed', message = 'enterprise_auth cloud function call failed') {
  return {
    success: false,
    ok: false,
    status: LOGIN_STATUSES.FAILED,
    authSource: AUTH_MODES.CLOUD_FAILED,
    authMode: AUTH_MODES.CLOUD_FAILED,
    authCapability: AUTH_CAPABILITIES.PLACEHOLDER,
    errorCode,
    message,
    identityAvailable: false,
    identitySource: 'cloud_function'
  }
}

function normalizeMode(result = {}) {
  if (Object.values(AUTH_MODES).includes(result.authMode)) return result.authMode
  if (result.authSource === 'cloud' && result.status === LOGIN_STATUSES.AUTHENTICATED) {
    return AUTH_MODES.CLOUD_AUTHENTICATED
  }
  if (Object.values(AUTH_MODES).includes(result.authSource)) return result.authSource
  if (result.status === LOGIN_STATUSES.AUTHENTICATED) return AUTH_MODES.CLOUD_AUTHENTICATED
  if (result.status === LOGIN_STATUSES.FAILED || result.errorCode) return AUTH_MODES.CLOUD_FAILED
  return AUTH_MODES.CLOUD_PENDING
}

function normalizeResult(result = {}) {
  if (!result || typeof result !== 'object') {
    return normalizeCloudError('cloud_response_invalid', 'enterprise_auth cloud function response is invalid')
  }
  const authMode = normalizeMode(result)
  return {
    ...result,
    authSource: authMode,
    authMode,
    authCapability: normalizeAuthCapability(result.authCapability),
    identityAvailable: Boolean(result.identityAvailable),
    identitySource: result.identitySource || 'cloud_function',
    hasOpenid: Boolean(result.hasOpenid),
    hasUnionid: Boolean(result.hasUnionid),
    hasAppid: Boolean(result.hasAppid)
  }
}

function callAuth(action = '', data = {}) {
  return callEnterpriseAuth(action, data)
    .then((result) => normalizeResult(result))
    .catch(() => normalizeCloudError('cloud_call_failed', 'enterprise_auth cloud function call failed'))
}

export function getAuthCapability() {
  return callAuth('getAuthCapability')
}

export function startWechatWebLogin() {
  return callAuth('startWechatWebLogin')
}

export function completeWechatWebLogin(input = {}) {
  return callAuth('completeWechatWebLogin', {
    code: input.code || '',
    state: input.state || ''
  })
}

export function startLogin() {
  return startWechatWebLogin()
}

export function pollLogin(loginTicket = '') {
  return callAuth('pollLogin', { loginTicket })
}

export function restoreSession(sessionToken = '') {
  return callAuth('restoreSession', { sessionToken })
}

export function registerEnterprise(input = {}) {
  return callAuth('registerEnterprise', input)
}

export function listEnterprises(sessionToken = '') {
  return callAuth('listEnterprises', { sessionToken })
}

export function switchEnterprise(enterpriseId = '', sessionToken = '') {
  return callAuth('switchEnterprise', { enterpriseId, sessionToken })
}

export function logout(sessionToken = '') {
  return callAuth('logout', { sessionToken })
}
