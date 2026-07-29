import { setSession } from './authSessionService.js'
import { AUTH_MODES } from './cloudAuthProvider.js'
import { ACCOUNT_AUTH_PROVIDERS, getCapability, requestCode as requestCloudCode, verifyCode as verifyCloudCode } from './accountAuthProvider.js'
import { normalizeEmail, normalizePhone, validateEmail, validatePhone } from './accountValidation.js'

export function getProviderFromLoginType(loginType = 'email_code') {
  return loginType === ACCOUNT_AUTH_PROVIDERS.PHONE_CODE ? 'phone' : 'email'
}

export function normalizeAccount(loginType = 'email_code', account = '') {
  return getProviderFromLoginType(loginType) === 'phone'
    ? normalizePhone(account)
    : normalizeEmail(account)
}

export function validateAccount(loginType = 'email_code', account = '') {
  return getProviderFromLoginType(loginType) === 'phone'
    ? validatePhone(account)
    : validateEmail(account)
}

export async function loadAccountCapability() {
  return getCapability()
}

export async function requestAccountCode(input = {}) {
  const loginType = input.loginType || ACCOUNT_AUTH_PROVIDERS.EMAIL_CODE
  const provider = getProviderFromLoginType(loginType)
  const validation = validateAccount(loginType, input.account)
  if (!validation.valid) return { ok: false, success: false, status: 'failed', errorCode: validation.errorCode, message: validation.message }
  return requestCloudCode({
    loginType,
    provider,
    account: validation.value,
    requestId: input.requestId || ''
  })
}

export async function verifyAccountCode(input = {}) {
  const loginType = input.loginType || ACCOUNT_AUTH_PROVIDERS.EMAIL_CODE
  const provider = getProviderFromLoginType(loginType)
  const validation = validateAccount(loginType, input.account)
  if (!validation.valid) return { ok: false, success: false, status: 'failed', errorCode: validation.errorCode, message: validation.message }
  const result = await verifyCloudCode({
    loginType,
    provider,
    account: validation.value,
    code: String(input.code || '').trim()
  })
  if (result && result.success && result.session && result.status === 'authenticated') {
    const session = setSession({
      ...result.session,
      authSource: AUTH_MODES.CLOUD_AUTHENTICATED,
      authMode: AUTH_MODES.CLOUD_AUTHENTICATED,
      authProvider: loginType,
      identityDiagnostics: result
    })
    return { ...result, session }
  }
  return result
}
