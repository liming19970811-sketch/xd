import { AUTH_MODES, LOGIN_STATUSES } from './cloudAuthProvider.js'

export const ACCOUNT_AUTH_PROVIDERS = Object.freeze({
  EMAIL_CODE: 'email_code',
  PHONE_CODE: 'phone_code'
})

export const ACCOUNT_AUTH_CAPABILITY = Object.freeze({
  DISABLED: 'disabled',
  DEVELOPMENT_MOCK: 'development_mock',
  CONFIGURED: 'configured'
})

function canUseCloudFunction() {
  return typeof wx !== 'undefined' && wx.cloud && typeof wx.cloud.callFunction === 'function'
}

function normalizeError(errorCode = 'cloud_call_failed', message = '账号登录云函数调用失败') {
  return {
    ok: false,
    success: false,
    status: LOGIN_STATUSES.FAILED,
    authSource: AUTH_MODES.CLOUD_FAILED,
    authMode: AUTH_MODES.CLOUD_FAILED,
    errorCode,
    message
  }
}

function normalizeResult(result = {}) {
  if (!result || typeof result !== 'object') {
    return normalizeError('cloud_response_invalid', '账号登录云函数响应非法')
  }
  const status = result.status || (result.ok || result.success ? 'ready' : LOGIN_STATUSES.FAILED)
  const authMode = result.authMode || (status === LOGIN_STATUSES.AUTHENTICATED ? AUTH_MODES.CLOUD_AUTHENTICATED : result.authSource)
  return {
    ...result,
    success: result.success !== undefined ? result.success : Boolean(result.ok),
    ok: result.ok !== undefined ? result.ok : Boolean(result.success),
    status,
    authSource: authMode || result.authSource || AUTH_MODES.CLOUD_PENDING,
    authMode: authMode || result.authSource || AUTH_MODES.CLOUD_PENDING
  }
}

function callAccountAuth(action = '', data = {}) {
  if (!canUseCloudFunction()) {
    return Promise.resolve(normalizeError('cloud_call_failed', '当前环境不可调用 enterprise_account_auth 云函数'))
  }
  return wx.cloud.callFunction({
    name: 'enterprise_account_auth',
    data: { action, ...data }
  })
    .then((res) => normalizeResult(res && res.result ? res.result : null))
    .catch(() => normalizeError('cloud_call_failed', 'enterprise_account_auth 云函数调用失败'))
}

export function getCapability() {
  return callAccountAuth('getCapability')
}

export function requestCode(input = {}) {
  return callAccountAuth('requestCode', input)
}

export function verifyCode(input = {}) {
  return callAccountAuth('verifyCode', input)
}

export function restoreSession(sessionToken = '') {
  return callAccountAuth('restoreSession', { sessionToken })
}

export function listEnterprises(sessionToken = '') {
  return callAccountAuth('listEnterprises', { sessionToken })
}

export function switchEnterprise(enterpriseId = '', sessionToken = '') {
  return callAccountAuth('switchEnterprise', { enterpriseId, sessionToken })
}

export function logout(sessionToken = '') {
  return callAccountAuth('logout', { sessionToken })
}
