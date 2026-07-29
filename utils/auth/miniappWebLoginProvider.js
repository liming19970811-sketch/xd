export const MINIAPP_WEB_LOGIN_PROVIDER = 'miniapp_scan'

export const MINIAPP_WEB_LOGIN_STATUSES = Object.freeze({
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  CONSUMED: 'consumed',
  EXPIRED: 'expired',
  CANCELLED: 'cancelled',
  AUTHENTICATED: 'authenticated',
  FAILED: 'failed'
})

function canCallCloud() {
  return typeof wx !== 'undefined' && wx.cloud && typeof wx.cloud.callFunction === 'function'
}

function normalizeError(errorCode = 'cloud_call_failed', message = '小程序扫码登录云函数调用失败') {
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

function normalizeResult(result = {}) {
  if (!result || typeof result !== 'object') {
    return normalizeError('cloud_response_invalid', '小程序扫码登录响应非法')
  }
  return {
    authProvider: MINIAPP_WEB_LOGIN_PROVIDER,
    ...result
  }
}

export function callMiniappWebLogin(action = '', data = {}) {
  if (!canCallCloud()) {
    return Promise.resolve(normalizeError('cloud_unavailable', '当前环境不可调用 enterprise_web_login 云函数'))
  }
  return wx.cloud.callFunction({
    name: 'enterprise_web_login',
    data: { action, ...data }
  })
    .then((res) => normalizeResult(res && res.result ? res.result : null))
    .catch(() => normalizeError('cloud_call_failed', 'enterprise_web_login 云函数调用失败'))
}

export function createTicket(input = {}) {
  return callMiniappWebLogin('createTicket', input)
}

export function getTicketStatus(loginTicket = '') {
  return callMiniappWebLogin('getTicketStatus', { loginTicket })
}

export function getConfirmContext(loginTicket = '') {
  return callMiniappWebLogin('getConfirmContext', { loginTicket })
}

export function confirmTicket(input = {}) {
  return callMiniappWebLogin('confirmTicket', input)
}

export function consumeTicket(loginTicket = '') {
  return callMiniappWebLogin('consumeTicket', { loginTicket })
}

export function cancelTicket(loginTicket = '') {
  return callMiniappWebLogin('cancelTicket', { loginTicket })
}
