import { get, remove, set } from '../data-provider/dataProvider.js'
import { getList as getEnterpriseList, readLocalStorage } from '../repository/enterpriseRepository.js'
import { getCurrentContext, setCurrentContext, clearContext, normalizeEnterprise, normalizeMember, normalizeUser } from './authRepository.js'
import {
  AUTH_MODES,
  AUTH_CAPABILITIES,
  LOGIN_STATUSES,
  restoreSession as restoreCloudSession,
  logout as logoutCloud,
  switchEnterprise as switchCloudEnterprise
} from './cloudAuthProvider.js'
import {
  ACCOUNT_AUTH_PROVIDERS,
  restoreSession as restoreAccountSession,
  logout as logoutAccount,
  switchEnterprise as switchAccountEnterprise
} from './accountAuthProvider.js'

export const AUTH_SESSION_STORAGE_KEY = 'diebiandesign_enterprise_auth_session_v1'
const ENTERPRISE_STORAGE_KEY = 'diebiandesign_enterprise_team_v1'

function nowIso() {
  return new Date().toISOString()
}

function createLocalToken() {
  return `local_mock_session_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

function normalizeMode(value = '') {
  if (value === 'cloud') return AUTH_MODES.CLOUD_AUTHENTICATED
  return Object.values(AUTH_MODES).includes(value) ? value : AUTH_MODES.LOCAL_MOCK
}

function normalizeSession(input = {}) {
  const mode = normalizeMode(input.authMode || input.authSource || input.mode)
  const user = normalizeUser(input.user || input.currentUser || {})
  const enterpriseInput = input.enterprise || input.currentEnterprise || {}
  const hasEnterprise = Boolean(enterpriseInput && enterpriseInput.enterpriseId)
  const enterprise = hasEnterprise ? normalizeEnterprise(enterpriseInput) : { enterpriseId: '', enterpriseName: '' }
  const member = normalizeMember(input.member || input.currentMember || {}, {
    user,
    enterprise,
    role: input.role || input.currentRole
  })
  return {
    token: input.token || input.sessionToken || '',
    authSource: mode,
    authMode: mode,
    authCapability: input.authCapability || AUTH_CAPABILITIES.PLACEHOLDER,
    authProvider: input.authProvider || (mode === AUTH_MODES.LOCAL_MOCK ? 'local_mock' : 'wechat_web'),
    sessionStatus: input.sessionStatus || (mode === AUTH_MODES.CLOUD_AUTHENTICATED || mode === AUTH_MODES.LOCAL_MOCK ? 'valid' : mode),
    user,
    enterprise,
    member,
    role: input.role || input.currentRole || member.role,
    enterprises: Array.isArray(input.enterprises) ? input.enterprises : [],
    identityDiagnostics: sanitizeDiagnostics(input.identityDiagnostics || input),
    createdAt: input.createdAt || nowIso(),
    updatedAt: input.updatedAt || nowIso()
  }
}

function sanitizeDiagnostics(value = {}) {
  return {
    hasOpenid: Boolean(value.hasOpenid),
    hasUnionid: Boolean(value.hasUnionid),
    hasAppid: Boolean(value.hasAppid),
    identityAvailable: Boolean(value.identityAvailable),
    identitySource: value.identitySource || '',
    authCapability: value.authCapability || AUTH_CAPABILITIES.PLACEHOLDER,
    authProvider: value.authProvider || '',
    status: value.status || ''
  }
}

function readAllEnterprises() {
  const value = readLocalStorage(ENTERPRISE_STORAGE_KEY, null)
  if (Array.isArray(value)) return value
  if (value && Array.isArray(value.enterprises)) return value.enterprises
  return value && typeof value === 'object' ? [value] : []
}

function getMembershipsForUser(userId = '') {
  const activeUserId = String(userId || '').trim()
  if (!activeUserId) return []
  return readAllEnterprises().flatMap((enterpriseRecord) => {
    const enterprise = normalizeEnterprise(enterpriseRecord)
    const members = Array.isArray(enterpriseRecord.members) ? enterpriseRecord.members : []
    return members
      .filter((member) => member.userId === activeUserId || member.memberId === activeUserId)
      .map((member) => ({
        enterprise,
        member: normalizeMember(member, { user: { userId: activeUserId, name: member.name }, enterprise }),
        role: member.role || '成员'
      }))
  })
}

function applySession(sessionInput = {}) {
  const session = normalizeSession(sessionInput)
  const memberships = session.enterprises.length ? session.enterprises : getMembershipsForUser(session.user.userId)
  const context = setCurrentContext({
    user: session.user,
    enterprise: session.enterprise,
    member: session.member,
    role: session.role,
    authSource: session.authSource,
    authMode: session.authMode,
    authCapability: session.authCapability,
    authProvider: session.authProvider,
    sessionToken: session.token,
    sessionStatus: session.sessionStatus,
    identityDiagnostics: session.identityDiagnostics,
    sessionUpdatedAt: session.updatedAt
  })
  return { ...session, enterprises: memberships, context }
}

function persistSession(sessionInput = {}) {
  const session = normalizeSession(sessionInput)
  const memberships = session.enterprises.length ? session.enterprises : getMembershipsForUser(session.user.userId)
  const next = { ...session, enterprises: memberships, updatedAt: nowIso() }
  set(AUTH_SESSION_STORAGE_KEY, next)
  applySession(next)
  return next
}

export function getCurrentSession() {
  const stored = get(AUTH_SESSION_STORAGE_KEY, null)
  return stored ? normalizeSession(stored) : null
}

export function setSession(sessionInput = {}) {
  const session = normalizeSession(sessionInput)
  if (session.authSource === AUTH_MODES.CLOUD_PENDING || session.authSource === AUTH_MODES.CLOUD_FAILED) {
    set(AUTH_SESSION_STORAGE_KEY, session)
    return applySession(session)
  }
  return persistSession(session)
}

export async function restoreSession() {
  const localSession = getCurrentSession()
  if (!localSession) return null
  if (localSession.authSource === AUTH_MODES.CLOUD_AUTHENTICATED) {
    const isAccountProvider = [ACCOUNT_AUTH_PROVIDERS.EMAIL_CODE, ACCOUNT_AUTH_PROVIDERS.PHONE_CODE].includes(localSession.authProvider)
    const result = isAccountProvider
      ? await restoreAccountSession(localSession.token)
      : await restoreCloudSession(localSession.token)
    if (result && result.success && result.session && result.status === LOGIN_STATUSES.AUTHENTICATED) {
      return persistSession({
        ...localSession,
        ...result.session,
        token: localSession.token,
        authSource: AUTH_MODES.CLOUD_AUTHENTICATED,
        authMode: AUTH_MODES.CLOUD_AUTHENTICATED,
        authCapability: result.authCapability || localSession.authCapability,
        authProvider: result.authProvider || localSession.authProvider,
        identityDiagnostics: result
      })
    }
    if (result && [LOGIN_STATUSES.SESSION_INVALID, LOGIN_STATUSES.SESSION_EXPIRED].includes(result.status)) {
      clearSession({ skipCloudLogout: true })
      return {
        authSource: AUTH_MODES.CLOUD_FAILED,
        sessionStatus: result.status,
        errorCode: result.errorCode,
        message: result.message
      }
    }
    return setSession({
      ...localSession,
      authSource: AUTH_MODES.CLOUD_FAILED,
      sessionStatus: result.status || LOGIN_STATUSES.FAILED,
      identityDiagnostics: result
    })
  }
  if (localSession.authSource === AUTH_MODES.LOCAL_MOCK) return applySession(localSession)
  return applySession(localSession)
}

export function clearSession(options = {}) {
  const session = getCurrentSession()
  if (!options.skipCloudLogout && session && session.authSource === AUTH_MODES.CLOUD_AUTHENTICATED && session.token) {
    if ([ACCOUNT_AUTH_PROVIDERS.EMAIL_CODE, ACCOUNT_AUTH_PROVIDERS.PHONE_CODE].includes(session.authProvider)) {
      logoutAccount(session.token)
    } else {
      logoutCloud(session.token)
    }
  }
  remove(AUTH_SESSION_STORAGE_KEY)
  clearContext()
  return null
}

export function listUserEnterprises(userId = '') {
  const session = getCurrentSession()
  if (!userId && session && session.authSource === AUTH_MODES.CLOUD_AUTHENTICATED && Array.isArray(session.enterprises)) {
    return session.enterprises
  }
  const activeUserId = userId || (session && session.user && session.user.userId) || getCurrentContext().currentUser.userId
  return getMembershipsForUser(activeUserId)
}

function getActiveMemberships(memberships = []) {
  return (Array.isArray(memberships) ? memberships : []).filter((item) => item && item.member && item.member.status === 'active' && item.enterprise && item.enterprise.enterpriseId)
}

export async function resolvePostLoginRoute(sessionInput = null) {
  let session = sessionInput || getCurrentSession()
  if (!session || !session.token) return { type: 'login' }
  if (session.authSource === AUTH_MODES.CLOUD_PENDING || session.authSource === AUTH_MODES.CLOUD_FAILED) {
    return { type: 'login' }
  }

  const restored = await restoreSession()
  session = getCurrentSession() || restored || session
  if (!session || !session.token || session.authSource === AUTH_MODES.CLOUD_FAILED) {
    return { type: 'login' }
  }

  const memberships = listUserEnterprises()
  const activeMemberships = getActiveMemberships(memberships)
  if (activeMemberships.length > 1) {
    return { type: 'select_enterprise' }
  }
  if (activeMemberships.length === 1) {
    const active = activeMemberships[0]
    const currentEnterpriseId = session.enterprise && session.enterprise.enterpriseId ? session.enterprise.enterpriseId : ''
    if (currentEnterpriseId !== active.enterprise.enterpriseId) {
      await switchEnterprise(active.enterprise.enterpriseId)
    }
    return { type: 'dashboard' }
  }
  if (session.enterprise && session.enterprise.enterpriseId && session.member && session.member.status === 'active') {
    return { type: 'dashboard' }
  }
  return { type: 'register' }
}

export async function switchEnterprise(enterpriseId = '') {
  const session = getCurrentSession()
  if (!session) return { success: false, errorCode: 'not_authenticated', message: '请先登录' }
  if (session.authSource === AUTH_MODES.CLOUD_PENDING) return { success: false, errorCode: 'cloud_pending', message: '云端登录尚未完成' }
  if (session.authSource === AUTH_MODES.CLOUD_FAILED) return { success: false, errorCode: 'cloud_failed', message: '云端登录失败，请重新登录' }
  if (session.authSource === AUTH_MODES.CLOUD_AUTHENTICATED) {
    const isAccountProvider = [ACCOUNT_AUTH_PROVIDERS.EMAIL_CODE, ACCOUNT_AUTH_PROVIDERS.PHONE_CODE].includes(session.authProvider)
    const result = isAccountProvider
      ? await switchAccountEnterprise(enterpriseId, session.token)
      : await switchCloudEnterprise(enterpriseId, session.token)
    if (result && result.success && result.session) {
      return {
        success: true,
        session: persistSession({
          ...session,
          ...result.session,
          token: session.token,
          authSource: AUTH_MODES.CLOUD_AUTHENTICATED,
          authMode: AUTH_MODES.CLOUD_AUTHENTICATED,
          authCapability: result.authCapability || session.authCapability,
          authProvider: result.authProvider || session.authProvider,
          identityDiagnostics: result
        })
      }
    }
    return { success: false, errorCode: result.errorCode || 'switch_failed', message: result.message || '企业切换失败' }
  }
  const memberships = listUserEnterprises(session.user.userId)
  const target = memberships.find((item) => item.enterprise.enterpriseId === enterpriseId)
  if (!target) return { success: false, errorCode: 'not_found', message: '未找到企业成员关系' }
  if (target.member.status !== 'active') return { success: false, errorCode: 'member_inactive', message: '当前成员状态不可进入' }
  const next = persistSession({
    ...session,
    enterprise: target.enterprise,
    member: target.member,
    role: target.role || target.member.role,
    enterprises: memberships
  })
  return { success: true, session: next }
}

export function ensureLocalMockSession() {
  const context = getCurrentContext()
  return persistSession({
    token: createLocalToken(),
    authSource: AUTH_MODES.LOCAL_MOCK,
    authProvider: 'local_mock',
    sessionStatus: 'valid',
    user: context.currentUser,
    enterprise: context.currentEnterprise,
    member: context.currentMember,
    role: context.currentRole,
    enterprises: getEnterpriseList().map((enterprise) => ({
      enterprise,
      member: enterprise.members.find((item) => item.memberId === enterprise.currentMemberId) || enterprise.members[0] || context.currentMember,
      role: context.currentRole
    }))
  })
}

export function createCloudPendingSession(payload = {}) {
  return setSession({
    token: '',
    authSource: AUTH_MODES.CLOUD_PENDING,
    authMode: AUTH_MODES.CLOUD_PENDING,
    authCapability: payload.authCapability || AUTH_CAPABILITIES.PLACEHOLDER,
    authProvider: payload.authProvider || '',
    sessionStatus: AUTH_MODES.CLOUD_PENDING,
    identityDiagnostics: payload
  })
}

export function createCloudFailedSession(payload = {}) {
  return setSession({
    token: '',
    authSource: AUTH_MODES.CLOUD_FAILED,
    authMode: AUTH_MODES.CLOUD_FAILED,
    authCapability: payload.authCapability || AUTH_CAPABILITIES.PLACEHOLDER,
    authProvider: payload.authProvider || '',
    sessionStatus: payload.status || AUTH_MODES.CLOUD_FAILED,
    identityDiagnostics: payload
  })
}
