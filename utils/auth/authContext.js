import { get, remove, set } from '../data-provider/dataProvider.js'

export const AUTH_CONTEXT_STORAGE_KEY = 'diebiandesign_auth_context_v1'

export const DEFAULT_CURRENT_USER = Object.freeze({
  userId: 'default_admin',
  name: '默认管理员',
  avatar: ''
})

export const DEFAULT_CURRENT_ENTERPRISE = Object.freeze({
  enterpriseId: 'default_enterprise',
  enterpriseName: '默认企业'
})

export const DEFAULT_CURRENT_ROLE = '管理员'

export const DEFAULT_CURRENT_MEMBER = Object.freeze({
  memberId: 'default_admin',
  enterpriseId: 'default_enterprise',
  userId: 'default_admin',
  role: DEFAULT_CURRENT_ROLE,
  status: 'active'
})

export const DEFAULT_AUTH_SOURCE = 'local_mock'
export const DEFAULT_AUTH_CAPABILITY = 'placeholder'
export const DEFAULT_AUTH_PROVIDER = 'local_mock'

export let currentUser = { ...DEFAULT_CURRENT_USER }
export let currentEnterprise = { ...DEFAULT_CURRENT_ENTERPRISE }
export let currentMember = { ...DEFAULT_CURRENT_MEMBER }
export let currentRole = DEFAULT_CURRENT_ROLE
export let authSource = DEFAULT_AUTH_SOURCE
export let authCapability = DEFAULT_AUTH_CAPABILITY
export let authProvider = DEFAULT_AUTH_PROVIDER
export let sessionToken = ''
export let sessionStatus = ''
export let identityDiagnostics = {}

function normalizeEntity(value, fallback) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? { ...fallback, ...value }
    : { ...fallback }
}

export function normalizeAuthContext(value = {}, fallback = {}) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {}
  const normalizedUser = normalizeEntity(source.currentUser || fallback.currentUser, DEFAULT_CURRENT_USER)
  const normalizedEnterprise = normalizeEntity(source.currentEnterprise || fallback.currentEnterprise, DEFAULT_CURRENT_ENTERPRISE)
  const normalizedRole = source.currentRole || source.currentMember?.role || fallback.currentRole || fallback.currentMember?.role || DEFAULT_CURRENT_ROLE
  const normalizedMember = normalizeEntity(source.currentMember || fallback.currentMember, {
    ...DEFAULT_CURRENT_MEMBER,
    memberId: normalizedUser.userId || DEFAULT_CURRENT_MEMBER.memberId,
    enterpriseId: normalizedEnterprise.enterpriseId || DEFAULT_CURRENT_MEMBER.enterpriseId,
    userId: normalizedUser.userId || DEFAULT_CURRENT_MEMBER.userId,
    role: normalizedRole
  })
  return {
    currentUser: normalizedUser,
    currentEnterprise: normalizedEnterprise,
    currentMember: {
      ...normalizedMember,
      enterpriseId: normalizedEnterprise.enterpriseId,
      userId: normalizedUser.userId,
      role: normalizedRole,
      status: normalizedMember.status || 'active'
    },
    currentRole: normalizedRole,
    authSource: source.authSource || fallback.authSource || DEFAULT_AUTH_SOURCE,
    authCapability: source.authCapability || fallback.authCapability || DEFAULT_AUTH_CAPABILITY,
    authProvider: source.authProvider || fallback.authProvider || DEFAULT_AUTH_PROVIDER,
    sessionToken: source.sessionToken || fallback.sessionToken || '',
    sessionStatus: source.sessionStatus || fallback.sessionStatus || '',
    identityDiagnostics: source.identityDiagnostics || fallback.identityDiagnostics || {},
    sessionUpdatedAt: source.sessionUpdatedAt || fallback.sessionUpdatedAt || ''
  }
}

function syncCurrentContext(context) {
  currentUser = context.currentUser
  currentEnterprise = context.currentEnterprise
  currentMember = context.currentMember
  currentRole = context.currentRole
  authSource = context.authSource || DEFAULT_AUTH_SOURCE
  authCapability = context.authCapability || DEFAULT_AUTH_CAPABILITY
  authProvider = context.authProvider || DEFAULT_AUTH_PROVIDER
  sessionToken = context.sessionToken || ''
  sessionStatus = context.sessionStatus || ''
  identityDiagnostics = context.identityDiagnostics || {}
  return context
}

export function getCurrentAuthContext(fallback = {}) {
  return syncCurrentContext(normalizeAuthContext(get(AUTH_CONTEXT_STORAGE_KEY, null), fallback))
}

export function setCurrentAuthContext(patch = {}) {
  const current = getCurrentAuthContext()
  const next = normalizeAuthContext({
    currentUser: { ...current.currentUser, ...(patch.currentUser || {}) },
    currentEnterprise: { ...current.currentEnterprise, ...(patch.currentEnterprise || {}) },
    currentMember: { ...current.currentMember, ...(patch.currentMember || {}) },
    currentRole: patch.currentRole || patch.currentMember?.role || current.currentRole,
    authSource: patch.authSource || current.authSource,
    authCapability: patch.authCapability || current.authCapability,
    authProvider: patch.authProvider || current.authProvider,
    sessionToken: patch.sessionToken !== undefined ? patch.sessionToken : current.sessionToken,
    sessionStatus: patch.sessionStatus || current.sessionStatus,
    identityDiagnostics: patch.identityDiagnostics || current.identityDiagnostics,
    sessionUpdatedAt: patch.sessionUpdatedAt || current.sessionUpdatedAt
  })
  set(AUTH_CONTEXT_STORAGE_KEY, next)
  return syncCurrentContext(next)
}

export function clearCurrentAuthContext() {
  remove(AUTH_CONTEXT_STORAGE_KEY)
  return syncCurrentContext(normalizeAuthContext())
}
