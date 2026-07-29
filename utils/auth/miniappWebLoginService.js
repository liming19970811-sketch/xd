import {
  confirmTicket,
  getConfirmContext,
  MINIAPP_WEB_LOGIN_PROVIDER,
  MINIAPP_WEB_LOGIN_STATUSES
} from './miniappWebLoginProvider.js'
import {
  cancelTicket as transportCancelTicket,
  consumeTicket as transportConsumeTicket,
  createTicket as transportCreateTicket,
  getTicketStatus as transportGetTicketStatus
} from './enterpriseWebLoginTransport.js'

export { MINIAPP_WEB_LOGIN_PROVIDER, MINIAPP_WEB_LOGIN_STATUSES }

function getStorageValue(key = '', fallback = '') {
  try {
    return uni.getStorageSync(key) || fallback
  } catch (error) {
    return fallback
  }
}

function setStorageValue(key = '', value = '') {
  try {
    uni.setStorageSync(key, value)
  } catch (error) {}
}

export function getMiniappLoginClientId() {
  const key = 'diebiandesign_enterprise_web_login_client_v1'
  const existing = getStorageValue(key, '')
  if (existing) return existing
  const next = `client_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
  setStorageValue(key, next)
  return next
}

export function startMiniappWebLogin() {
  return transportCreateTicket({ clientId: getMiniappLoginClientId() })
}

export function pollMiniappWebLogin(loginTicket = '') {
  return transportGetTicketStatus(loginTicket)
}

export function completeMiniappWebLogin(loginTicket = '') {
  return transportConsumeTicket(loginTicket)
}

export function cancelMiniappWebLogin(loginTicket = '') {
  return transportCancelTicket(loginTicket)
}

function normalizeConfirmContextResult(result = {}) {
  if (!result || result.success) return result
  const messages = {
    ticket_cancelled: '网页登录请求已取消，请回电脑重新生成。',
    ticket_expired: '网页登录请求已过期，请回电脑重新生成。',
    ticket_invalid: '网页登录请求无效，请回电脑重新生成。'
  }
  const errorCode = result.errorCode || ''
  if (!messages[errorCode]) return result
  return {
    ...result,
    message: result.message || messages[errorCode]
  }
}

export function loadMiniappConfirmContext(loginTicket = '') {
  return getConfirmContext(loginTicket).then(normalizeConfirmContextResult)
}

export function confirmMiniappWebLogin(input = {}) {
  return confirmTicket(input)
}
