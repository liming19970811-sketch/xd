import { callCloudWebFunction } from '../cloud/cloudWebClient.js'
import { MINIAPP_WEB_LOGIN_PROVIDER, MINIAPP_WEB_LOGIN_STATUSES } from './miniappWebLoginProvider.js'

const ERROR_CODES = Object.freeze({
  SDK_INIT_FAILED: 'CLOUD_SDK_INIT_FAILED',
  ANONYMOUS_AUTH_FAILED: 'CLOUD_ANONYMOUS_AUTH_FAILED',
  ANONYMOUS_AUTH_DISABLED: 'CLOUD_ANONYMOUS_AUTH_DISABLED',
  WEB_ORIGIN_NOT_ALLOWED: 'CLOUD_WEB_ORIGIN_NOT_ALLOWED',
  FUNCTION_NOT_FOUND: 'FUNCTION_NOT_FOUND',
  INVALID_RESPONSE: 'INVALID_CLOUD_RESPONSE',
  NETWORK_ERROR: 'CLOUD_NETWORK_ERROR',
  CLOUD_CALL_FAILED: 'CLOUD_CALL_FAILED'
})

function normalizeError(errorCode = ERROR_CODES.CLOUD_CALL_FAILED, message = 'enterprise_web_login cloud function call failed') {
  return {
    success: false,
    ok: false,
    status: MINIAPP_WEB_LOGIN_STATUSES.FAILED,
    errorCode,
    message,
    authMode: 'cloud_failed',
    authProvider: MINIAPP_WEB_LOGIN_PROVIDER
  }
}

function sanitizeMessage(message = '') {
  return String(message || '')
    .replace(/(sessionToken|token|ticket|openid|openId|unionid|unionId)\s*[:=]\s*[^,\s}]+/ig, '$1:[redacted]')
    .slice(0, 240)
}

function safeLog(action = '', result = {}, startedAt = Date.now()) {
  const elapsedMs = Date.now() - startedAt
  const success = !!(result && result.success)
  const errorCode = result && result.errorCode ? result.errorCode : ''
  const message = result && result.message ? sanitizeMessage(result.message) : ''
  console.log('[enterprise-web-login:h5]', {
    action,
    success,
    errorCode,
    message,
    elapsedMs
  })
}

function normalizeResult(result = {}) {
  if (!result || typeof result !== 'object') {
    return normalizeError(ERROR_CODES.INVALID_RESPONSE, 'Cloud function response is invalid')
  }
  return {
    authProvider: MINIAPP_WEB_LOGIN_PROVIDER,
    ...result
  }
}

function isSdkInitError(code = '') {
  return [
    'cloudbase_env_not_configured',
    'cloudbase_web_sdk_unavailable',
    'cloudbase_web_sdk_load_failed',
    'cloudbase_web_call_function_unavailable'
  ].includes(code)
}

function isFunctionNotFound(error = {}, message = '') {
  const code = String(error.code || error.errCode || error.errorCode || '')
  const text = `${code} ${message}`.toLowerCase()
  return text.includes('function_not_found') ||
    text.includes('function not found') ||
    text.includes('resource not found') ||
    text.includes('not exist') ||
    text.includes('does not exist') ||
    text.includes('functionname')
}

function isNetworkError(error = {}, message = '') {
  const code = String(error.code || error.errCode || error.errorCode || '')
  const text = `${code} ${message}`.toLowerCase()
  return text.includes('network') ||
    text.includes('timeout') ||
    text.includes('failed to fetch') ||
    text.includes('load failed') ||
    text.includes('request failed') ||
    text.includes('abort')
}

function isOriginNotAllowed(error = {}, message = '') {
  const code = String(error.code || error.errCode || error.errorCode || '')
  const text = `${code} ${message}`.toLowerCase()
  return text.includes('origin') ||
    text.includes('domain') ||
    text.includes('not allowed') ||
    text.includes('allowlist') ||
    text.includes('illegal web') ||
    text.includes('invalid host')
}

function normalizeCloudError(error = {}) {
  const code = error && (error.code || error.errCode || error.errorCode)
  const message = sanitizeMessage(error && (error.message || error.errMsg || error.msg || code || 'Cloud function call failed'))

  if (isSdkInitError(code)) {
    return normalizeError(ERROR_CODES.SDK_INIT_FAILED, message || 'CloudBase Web SDK initialization failed')
  }
  if (code === ERROR_CODES.ANONYMOUS_AUTH_FAILED) {
    return normalizeError(ERROR_CODES.ANONYMOUS_AUTH_FAILED, message || 'CloudBase anonymous auth failed')
  }
  if (code === ERROR_CODES.ANONYMOUS_AUTH_DISABLED) {
    return normalizeError(ERROR_CODES.ANONYMOUS_AUTH_DISABLED, message || 'CloudBase anonymous auth is disabled')
  }
  if (code === ERROR_CODES.WEB_ORIGIN_NOT_ALLOWED) {
    return normalizeError(ERROR_CODES.WEB_ORIGIN_NOT_ALLOWED, message || 'Current web origin is not allowed')
  }
  if (isOriginNotAllowed(error, message)) {
    return normalizeError(ERROR_CODES.WEB_ORIGIN_NOT_ALLOWED, message || 'Current web origin is not allowed')
  }
  if (isFunctionNotFound(error, message)) {
    return normalizeError(ERROR_CODES.FUNCTION_NOT_FOUND, message || 'enterprise_web_login function not found')
  }
  if (isNetworkError(error, message)) {
    return normalizeError(ERROR_CODES.NETWORK_ERROR, message || 'CloudBase network request failed')
  }
  return normalizeError(ERROR_CODES.CLOUD_CALL_FAILED, message || 'enterprise_web_login cloud function call failed')
}

async function callWebAction(action = '', data = {}) {
  const startedAt = Date.now()
  let result
  try {
    const response = await callCloudWebFunction('enterprise_web_login', { action, ...data })
    result = normalizeResult(response && response.result ? response.result : null)
  } catch (error) {
    result = normalizeCloudError(error)
  }
  safeLog(action, result, startedAt)
  return result
}

export function createTicket(input = {}) {
  return callWebAction('createTicket', input)
}

export function getTicketStatus(loginTicket = '') {
  return callWebAction('getTicketStatus', { loginTicket })
}

export function consumeTicket(loginTicket = '') {
  return callWebAction('consumeTicket', { loginTicket })
}

export function cancelTicket(loginTicket = '') {
  return callWebAction('cancelTicket', { loginTicket })
}
