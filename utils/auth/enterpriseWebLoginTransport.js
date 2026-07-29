import * as cloudFunctionTransport from './miniappWebLoginProvider.js'
// #ifdef H5
import * as webSdkTransport from './enterpriseWebLoginHttpProvider.js'
// #endif

function isH5Platform() {
  // #ifdef H5
  return true
  // #endif
  return false
}

export function getEnterpriseWebLoginTransport() {
  // #ifdef H5
  if (isH5Platform()) return webSdkTransport
  // #endif
  return cloudFunctionTransport
}

export function createTicket(input = {}) {
  return getEnterpriseWebLoginTransport().createTicket(input)
}

export function getTicketStatus(loginTicket = '') {
  return getEnterpriseWebLoginTransport().getTicketStatus(loginTicket)
}

export function consumeTicket(loginTicket = '') {
  return getEnterpriseWebLoginTransport().consumeTicket(loginTicket)
}

export function cancelTicket(loginTicket = '') {
  return getEnterpriseWebLoginTransport().cancelTicket(loginTicket)
}

export function getConfirmContext(loginTicket = '') {
  return cloudFunctionTransport.getConfirmContext(loginTicket)
}

export function confirmTicket(input = {}) {
  return cloudFunctionTransport.confirmTicket(input)
}
