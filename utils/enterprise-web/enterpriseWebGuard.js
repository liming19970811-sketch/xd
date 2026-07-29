import {
  getCurrentContext,
  getCurrentEnterprise,
  getCurrentMember,
  getCurrentUser
} from '../auth/authRepository.js'
import { canAccess, hasPermission } from '../auth/permissionService.js'
import { getCurrentSession, setSession } from '../auth/authSessionService.js'
import { AUTH_MODES, LOGIN_STATUSES } from '../auth/cloudAuthProvider.js'
import { canAccessTenantData } from '../tenant/tenantGuard.js'

const LEGACY_PERMISSION_FALLBACKS = Object.freeze({
  'quote.view': ['quote.manage', 'customer.view', 'customer.manage', 'finance.view', 'enterprise.view'],
  'quote.manage': ['customer.manage', 'finance.manage', 'enterprise.manage'],
  'order.view': ['order.manage', 'finance.view', 'finance.manage', 'enterprise.view'],
  'order.manage': ['finance.manage', 'enterprise.manage'],
  'delivery.view': ['delivery.manage', 'project.view', 'project.manage', 'enterprise.view'],
  'delivery.manage': ['project.manage', 'enterprise.manage'],
  'factory.view': ['factory.manage', 'project.view', 'project.manage', 'enterprise.view'],
  'factory.manage': ['enterprise.manage'],
  'factory.quote': ['factory.manage', 'quote.manage', 'project.manage', 'enterprise.manage'],
  'factory.collaborate': ['factory.manage', 'delivery.manage', 'project.manage', 'enterprise.manage'],
  'audit.view': ['enterprise.manage'],
  'analytics.view': ['enterprise.view', 'finance.view', 'enterprise.manage'],
  'support.view': ['support.manage', 'analytics.view', 'enterprise.view', 'enterprise.manage'],
  'support.manage': ['analytics.view', 'enterprise.manage']
})

function buildGuardResult(allowed, reason = '', context = {}) {
  return {
    allowed,
    reason,
    currentUser: context.currentUser || getCurrentUser(),
    currentEnterprise: context.currentEnterprise || getCurrentEnterprise(),
    currentMember: context.currentMember || getCurrentMember(),
    currentRole: context.currentRole || getCurrentMember().role
  }
}

function hasEnterpriseWebPermission(permission = '', member = {}) {
  if (hasPermission(permission, { member })) return true
  if (permission.endsWith('.view')) {
    return hasPermission(permission.replace(/\.view$/, '.manage'), { member })
  }
  const fallbacks = LEGACY_PERMISSION_FALLBACKS[permission] || []
  return fallbacks.some((item) => hasPermission(item, { member }))
}

function redirectEnterpriseWeb(name = 'login') {
  if (typeof uni === 'undefined' || !uni.redirectTo) return
  const routes = {
    login: '/pages/enterprise-web/login',
    selectEnterprise: '/pages/enterprise-web/select-enterprise'
  }
  const pages = typeof getCurrentPages === 'function' ? getCurrentPages() : []
  const current = pages.length ? `/${pages[pages.length - 1].route || ''}` : ''
  const target = routes[name]
  if (target && current !== target) {
    uni.redirectTo({ url: target })
  }
}

export function requireAuthenticatedUser() {
  const session = getCurrentSession()
  if (session && session.authSource === AUTH_MODES.CLOUD_PENDING) {
    redirectEnterpriseWeb('login')
    return buildGuardResult(false, 'cloud_pending', getCurrentContext())
  }
  if (session && session.authSource === AUTH_MODES.CLOUD_FAILED) {
    return buildGuardResult(false, session.sessionStatus || 'cloud_failed', getCurrentContext())
  }
  if (!session || !session.token) {
    const context = getCurrentContext()
    return buildGuardResult(false, 'not_authenticated', {
      ...context,
      authSource: context.authSource || 'local_mock'
    })
  }
  if (session.authSource === AUTH_MODES.CLOUD_AUTHENTICATED && [LOGIN_STATUSES.SESSION_INVALID, LOGIN_STATUSES.SESSION_EXPIRED].includes(session.sessionStatus)) {
    redirectEnterpriseWeb('login')
    return buildGuardResult(false, session.sessionStatus, getCurrentContext())
  }
  if (![AUTH_MODES.LOCAL_MOCK, AUTH_MODES.CLOUD_AUTHENTICATED].includes(session.authSource)) {
    return buildGuardResult(false, 'not_authenticated', getCurrentContext())
  }
  const activeSession = setSession(session)
  return buildGuardResult(true, '', {
    currentUser: activeSession.user,
    currentEnterprise: activeSession.enterprise,
    currentMember: activeSession.member,
    currentRole: activeSession.role
  })
}

export function requireEnterpriseSelection() {
  const authResult = requireAuthenticatedUser()
  if (!authResult.allowed) {
    redirectEnterpriseWeb('login')
    return authResult
  }
  const enterpriseId = authResult.currentEnterprise && authResult.currentEnterprise.enterpriseId ? authResult.currentEnterprise.enterpriseId : ''
  if (!enterpriseId) {
    redirectEnterpriseWeb('selectEnterprise')
    return buildGuardResult(false, 'enterprise_not_selected', authResult)
  }
  return authResult
}

export function requireEnterpriseContext() {
  const selectionResult = requireEnterpriseSelection()
  if (!selectionResult.allowed) return selectionResult
  const context = selectionResult
  const enterpriseId = context.currentEnterprise && context.currentEnterprise.enterpriseId ? context.currentEnterprise.enterpriseId : ''
  const userId = context.currentUser && context.currentUser.userId ? context.currentUser.userId : ''
  if (!enterpriseId || !userId) {
    return buildGuardResult(false, 'missing_enterprise_context', context)
  }
  return buildGuardResult(true, '', context)
}

export function requireActiveMember() {
  const contextResult = requireEnterpriseContext()
  if (!contextResult.allowed) return contextResult
  const member = contextResult.currentMember || {}
  if (member.status === 'pending') {
    return buildGuardResult(false, 'member_pending', contextResult)
  }
  if (member.status === 'disabled') {
    return buildGuardResult(false, 'member_disabled', contextResult)
  }
  if (member.status !== 'active') {
    return buildGuardResult(false, 'member_inactive', contextResult)
  }
  return buildGuardResult(true, '', contextResult)
}

export function requirePermission(permission = '') {
  const activeResult = requireActiveMember()
  if (!activeResult.allowed) return activeResult
  if (!permission) return activeResult
  const allowed = hasEnterpriseWebPermission(permission, activeResult.currentMember)
  return allowed ? activeResult : buildGuardResult(false, 'permission_denied', activeResult)
}

export function canAccessProject(project = {}) {
  const activeResult = requireActiveMember()
  if (!activeResult.allowed) return activeResult
  const resource = typeof project === 'string' ? { projectId: project } : (project || {})
  if (resource.enterpriseId && !canAccessTenantData(resource, activeResult.currentEnterprise.enterpriseId)) {
    return buildGuardResult(false, 'tenant_denied', activeResult)
  }
  const allowed = canAccess('project.view', resource, { member: activeResult.currentMember }) ||
    canAccess('project.manage', resource, { member: activeResult.currentMember })
  return allowed ? activeResult : buildGuardResult(false, 'project_permission_denied', activeResult)
}

export function canAccessTenantRecord(record = {}, permission = '') {
  const permissionResult = requirePermission(permission)
  if (!permissionResult.allowed) return permissionResult
  const resource = record && typeof record === 'object' && !Array.isArray(record) ? record : {}
  if (resource.enterpriseId && !canAccessTenantData(resource, permissionResult.currentEnterprise.enterpriseId)) {
    return buildGuardResult(false, 'tenant_denied', permissionResult)
  }
  return permissionResult
}

export function getEnterpriseGuardMessage(reason = '') {
  const messages = {
    missing_enterprise_context: '未获取到企业身份上下文',
    not_authenticated: '请先登录企业工作台',
    enterprise_not_selected: '请选择要进入的企业',
    cloud_pending: '云端登录尚未完成，请在登录页等待',
    cloud_failed: '云端登录失败，请重新登录',
    failed: '云端登录失败，请重新登录',
    session_invalid: '登录态无效，请重新登录',
    session_expired: '登录态已过期，请重新登录',
    member_pending: '当前成员待审核，暂不能访问企业工作台',
    member_disabled: '当前成员已停用，暂不能访问企业工作台',
    member_inactive: '当前成员状态不可用',
    permission_denied: '当前角色暂无访问权限',
    tenant_denied: '已拦截跨企业数据访问',
    project_permission_denied: '当前角色暂无该项目访问权限'
  }
  return messages[reason] || '当前无法访问'
}
