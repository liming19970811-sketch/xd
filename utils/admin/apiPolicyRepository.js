import { BRAND_API_APP_PERMISSIONS, getBrandApiAppById } from './apiRepository'

const API_POLICY_STORAGE_KEY = 'diebiandesign_api_policies'

export const API_POLICY_PERMISSIONS = Object.freeze([...BRAND_API_APP_PERMISSIONS])

function cloneRestrictions(restrictions = {}) {
  try {
    return JSON.parse(JSON.stringify(restrictions && typeof restrictions === 'object' ? restrictions : {}))
  } catch (error) {
    return {}
  }
}

function normalizePolicy(policy = {}) {
  return {
    policyId: String(policy.policyId || ''),
    appId: String(policy.appId || ''),
    credentialId: String(policy.credentialId || ''),
    permissions: Array.isArray(policy.permissions)
      ? [...new Set(policy.permissions.filter((permission) => API_POLICY_PERMISSIONS.includes(permission)))]
      : [],
    restrictions: cloneRestrictions(policy.restrictions),
    createdAt: policy.createdAt || new Date().toISOString(),
    updatedAt: policy.updatedAt || policy.createdAt || new Date().toISOString()
  }
}

function readPolicies() {
  try {
    const policies = uni.getStorageSync(API_POLICY_STORAGE_KEY)
    return Array.isArray(policies) ? policies.map(normalizePolicy) : []
  } catch (error) {
    return []
  }
}

function writePolicies(policies = []) {
  try {
    uni.setStorageSync(API_POLICY_STORAGE_KEY, policies.map(normalizePolicy))
  } catch (error) {}
  return policies
}

function logPolicy(policy = {}) {
  console.log('[api:policy]', {
    policyId: policy.policyId || '',
    appId: policy.appId || ''
  })
}

function validatePolicyInput(input = {}) {
  if (!input.appId || !getBrandApiAppById(input.appId)) throw new Error('API 应用不存在')
  if (!Array.isArray(input.permissions) || !input.permissions.length) throw new Error('请至少选择一项权限')
}

export function getApiPolicies(appId = '') {
  return readPolicies()
    .filter((policy) => !appId || policy.appId === appId)
    .sort((left, right) => String(right.updatedAt).localeCompare(String(left.updatedAt)))
}

export function getApiPolicyById(policyId = '') {
  const policy = readPolicies().find((item) => item.policyId === policyId)
  return policy ? normalizePolicy(policy) : null
}

export function getEffectiveApiPolicy(appId = '', credentialId = '') {
  const policies = getApiPolicies(appId)
  return policies.find((policy) => policy.credentialId && policy.credentialId === credentialId) ||
    policies.find((policy) => !policy.credentialId) ||
    null
}

export function createApiPolicy(input = {}) {
  validatePolicyInput(input)
  const now = new Date().toISOString()
  const policy = normalizePolicy({
    ...input,
    policyId: input.policyId || `api_policy_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    createdAt: input.createdAt || now,
    updatedAt: now
  })
  const policies = readPolicies().filter((item) => item.policyId !== policy.policyId)
  writePolicies([policy, ...policies])
  logPolicy(policy)
  return policy
}

export function updateApiPolicy(policyId = '', patch = {}) {
  const policies = readPolicies()
  const index = policies.findIndex((policy) => policy.policyId === policyId)
  if (index < 0) throw new Error('权限策略不存在')
  const policy = normalizePolicy({
    ...policies[index],
    ...patch,
    policyId,
    createdAt: policies[index].createdAt,
    updatedAt: new Date().toISOString()
  })
  validatePolicyInput(policy)
  policies.splice(index, 1, policy)
  writePolicies(policies)
  logPolicy(policy)
  return policy
}

export function deleteApiPolicy(policyId = '') {
  const policies = readPolicies()
  const policy = policies.find((item) => item.policyId === policyId)
  if (!policy) return false
  writePolicies(policies.filter((item) => item.policyId !== policyId))
  logPolicy(policy)
  return true
}

export function validateApiPolicyPermission(input = {}) {
  const policy = getEffectiveApiPolicy(input.appId, input.credentialId)
  if (!policy) {
    return { allowed: true, code: '', reason: '', policy: null, inherited: true }
  }
  if (!policy.permissions.includes(input.permission)) {
    return {
      allowed: false,
      code: 'POLICY_PERMISSION_DENIED',
      reason: 'API 权限策略不允许该操作',
      policy,
      inherited: false
    }
  }
  return { allowed: true, code: '', reason: '', policy, inherited: false }
}
