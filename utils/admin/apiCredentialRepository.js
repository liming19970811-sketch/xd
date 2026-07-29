import { ENTERPRISE_API_STATUS, getBrandApiAppById } from './apiRepository'
import { getApiPlanById } from './apiPlanRepository'
import { validateApiPolicyPermission } from './apiPolicyRepository'
import { API_ACTION_PERMISSIONS, getBrandApiActionCost } from './apiUsageFlow'

const API_CREDENTIAL_STORAGE_KEY = 'diebiandesign_api_credentials'

export const API_CREDENTIAL_STATUS = Object.freeze({
  ACTIVE: 'active',
  DISABLED: 'disabled'
})

const SHA256_CONSTANTS = Object.freeze([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
])

function rotateRight(value, bits) {
  return (value >>> bits) | (value << (32 - bits))
}

function hashCredentialSecret(value = '') {
  const encoded = unescape(encodeURIComponent(String(value || '')))
  const bytes = Array.from(encoded).map((character) => character.charCodeAt(0))
  const bitLength = bytes.length * 8
  bytes.push(0x80)
  while (bytes.length % 64 !== 56) bytes.push(0)
  for (let shift = 56; shift >= 0; shift -= 8) {
    bytes.push(Math.floor(bitLength / Math.pow(2, shift)) & 0xff)
  }

  const hash = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
  ]
  const words = new Array(64)

  for (let offset = 0; offset < bytes.length; offset += 64) {
    for (let index = 0; index < 16; index += 1) {
      const cursor = offset + index * 4
      words[index] = (
        (bytes[cursor] << 24) |
        (bytes[cursor + 1] << 16) |
        (bytes[cursor + 2] << 8) |
        bytes[cursor + 3]
      )
    }
    for (let index = 16; index < 64; index += 1) {
      const left = words[index - 15]
      const right = words[index - 2]
      const sigma0 = rotateRight(left, 7) ^ rotateRight(left, 18) ^ (left >>> 3)
      const sigma1 = rotateRight(right, 17) ^ rotateRight(right, 19) ^ (right >>> 10)
      words[index] = (words[index - 16] + sigma0 + words[index - 7] + sigma1) | 0
    }

    let [a, b, c, d, e, f, g, h] = hash
    for (let index = 0; index < 64; index += 1) {
      const sum1 = rotateRight(e, 6) ^ rotateRight(e, 11) ^ rotateRight(e, 25)
      const choice = (e & f) ^ (~e & g)
      const temp1 = (h + sum1 + choice + SHA256_CONSTANTS[index] + words[index]) | 0
      const sum0 = rotateRight(a, 2) ^ rotateRight(a, 13) ^ rotateRight(a, 22)
      const majority = (a & b) ^ (a & c) ^ (b & c)
      const temp2 = (sum0 + majority) | 0
      h = g
      g = f
      f = e
      e = (d + temp1) | 0
      d = c
      c = b
      b = a
      a = (temp1 + temp2) | 0
    }
    hash[0] = (hash[0] + a) | 0
    hash[1] = (hash[1] + b) | 0
    hash[2] = (hash[2] + c) | 0
    hash[3] = (hash[3] + d) | 0
    hash[4] = (hash[4] + e) | 0
    hash[5] = (hash[5] + f) | 0
    hash[6] = (hash[6] + g) | 0
    hash[7] = (hash[7] + h) | 0
  }

  return hash.map((part) => (part >>> 0).toString(16).padStart(8, '0')).join('')
}

function normalizeCredential(credential = {}) {
  return {
    credentialId: String(credential.credentialId || ''),
    appId: String(credential.appId || ''),
    keyPrefix: String(credential.keyPrefix || '').slice(0, 24),
    secretHash: String(credential.secretHash || ''),
    status: credential.status === API_CREDENTIAL_STATUS.DISABLED
      ? API_CREDENTIAL_STATUS.DISABLED
      : API_CREDENTIAL_STATUS.ACTIVE,
    lastUsedAt: credential.lastUsedAt || '',
    createdAt: credential.createdAt || new Date().toISOString()
  }
}

function readCredentials() {
  try {
    const credentials = uni.getStorageSync(API_CREDENTIAL_STORAGE_KEY)
    if (!Array.isArray(credentials)) return []
    const normalized = credentials.map(normalizeCredential)
    if (credentials.some((item) => item && (item.secret || item.apiKey || item.plainTextKey))) {
      uni.setStorageSync(API_CREDENTIAL_STORAGE_KEY, normalized)
    }
    return normalized
  } catch (error) {
    return []
  }
}

function writeCredentials(credentials = []) {
  try {
    uni.setStorageSync(API_CREDENTIAL_STORAGE_KEY, credentials.map(normalizeCredential))
  } catch (error) {}
  return credentials
}

function logCredential(credential = {}) {
  console.log('[api:credential]', {
    credentialId: credential.credentialId || '',
    appId: credential.appId || '',
    status: credential.status || ''
  })
}

function createSecret(appId = '') {
  const appPart = String(appId || 'app').replace(/[^a-zA-Z0-9]/g, '').slice(-8) || 'app'
  return `db_test_${appPart}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 14)}`
}

function disableActiveCredentials(appId = '') {
  const disabledCredentials = []
  const credentials = readCredentials().map((credential) => (
    credential.appId === appId && credential.status === API_CREDENTIAL_STATUS.ACTIVE
      ? (() => {
          const disabled = normalizeCredential({ ...credential, status: API_CREDENTIAL_STATUS.DISABLED })
          disabledCredentials.push(disabled)
          return disabled
        })()
      : credential
  ))
  writeCredentials(credentials)
  disabledCredentials.forEach(logCredential)
  return credentials
}

export function getApiCredentials(appId = '') {
  return readCredentials()
    .filter((credential) => !appId || credential.appId === appId)
    .sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt)))
}

export function getActiveApiCredential(appId = '') {
  return getApiCredentials(appId).find((credential) => credential.status === API_CREDENTIAL_STATUS.ACTIVE) || null
}

export function formatApiCredentialMask(credential = {}) {
  return credential && credential.keyPrefix ? `${credential.keyPrefix}••••••••` : '未生成凭证'
}

export function createApiCredential(appId = '') {
  if (!getBrandApiAppById(appId)) throw new Error('API 应用不存在')
  disableActiveCredentials(appId)
  const plainTextKey = createSecret(appId)
  const credential = normalizeCredential({
    credentialId: `api_credential_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    appId,
    keyPrefix: plainTextKey.slice(0, 20),
    secretHash: hashCredentialSecret(plainTextKey),
    status: API_CREDENTIAL_STATUS.ACTIVE,
    lastUsedAt: '',
    createdAt: new Date().toISOString()
  })
  writeCredentials([credential, ...readCredentials().filter((item) => item.credentialId !== credential.credentialId)])
  logCredential(credential)
  return { credential, plainTextKey }
}

export function regenerateApiCredential(appId = '') {
  return createApiCredential(appId)
}

export function disableApiCredential(credentialId = '') {
  const credentials = readCredentials()
  const index = credentials.findIndex((credential) => credential.credentialId === credentialId)
  if (index < 0) throw new Error('API 凭证不存在')
  const credential = normalizeCredential({
    ...credentials[index],
    status: API_CREDENTIAL_STATUS.DISABLED
  })
  credentials.splice(index, 1, credential)
  writeCredentials(credentials)
  logCredential(credential)
  return credential
}

export function validateApiCredential(input = {}) {
  const credential = input.credentialId
    ? readCredentials().find((item) => item.credentialId === input.credentialId)
    : getActiveApiCredential(input.appId)
  if (!credential || credential.appId !== input.appId) {
    return { allowed: false, code: 'KEY_INVALID', reason: 'API Key 不存在', credential: null }
  }
  if (credential.status !== API_CREDENTIAL_STATUS.ACTIVE) {
    return { allowed: false, code: 'KEY_DISABLED', reason: 'API Key 已禁用', credential }
  }
  if (input.plainTextKey && hashCredentialSecret(input.plainTextKey) !== credential.secretHash) {
    return { allowed: false, code: 'KEY_INVALID', reason: 'API Key 无效', credential }
  }
  return { allowed: true, code: '', reason: '', credential }
}

export function validateApiCredentialUsage(input = {}) {
  const credentialValidation = validateApiCredential(input)
  if (!credentialValidation.allowed) return credentialValidation
  const credential = credentialValidation.credential
  const app = getBrandApiAppById(input.appId)
  const action = String(input.action || '')
  const permission = API_ACTION_PERMISSIONS[action]
  const cost = getBrandApiActionCost(action)
  if (!app || app.status !== ENTERPRISE_API_STATUS.ENABLED) {
    return { allowed: false, code: 'APP_PAUSED', reason: 'API 应用未启用', credential, app, action, cost }
  }
  const policyValidation = validateApiPolicyPermission({
    appId: input.appId,
    credentialId: credential.credentialId,
    permission
  })
  if (!policyValidation.allowed) {
    return { ...policyValidation, credential, app, action, cost }
  }
  const plan = getApiPlanById(app.planId)
  if (!permission || !app.permissions.includes(permission) || !plan.permissions.includes(permission)) {
    return { allowed: false, code: 'PERMISSION_DENIED', reason: 'API 套餐权限不足', credential, app, action, cost, policy: policyValidation.policy }
  }
  if (!cost) {
    return { allowed: false, code: 'INVALID_COST', reason: '调用消耗必须大于 0', credential, app, action, cost, policy: policyValidation.policy }
  }
  if (app.remainingQuota < cost) {
    return { allowed: false, code: 'QUOTA_NOT_ENOUGH', reason: 'API 应用额度不足', credential, app, action, cost, policy: policyValidation.policy }
  }
  return {
    allowed: true,
    code: '',
    reason: '',
    credential,
    app,
    action,
    permission,
    cost,
    policy: policyValidation.policy,
    inheritedPolicy: policyValidation.inherited
  }
}

export function markApiCredentialUsed(credentialId = '') {
  const credentials = readCredentials()
  const index = credentials.findIndex((credential) => credential.credentialId === credentialId)
  if (index < 0) return null
  const credential = normalizeCredential({
    ...credentials[index],
    lastUsedAt: new Date().toISOString()
  })
  credentials.splice(index, 1, credential)
  writeCredentials(credentials)
  return credential
}
