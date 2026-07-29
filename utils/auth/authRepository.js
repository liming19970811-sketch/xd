import {
  clearCurrentAuthContext,
  getCurrentAuthContext,
  setCurrentAuthContext
} from './authContext.js'
import { getList as getEnterpriseList } from '../repository/enterpriseRepository.js'

export const MEMBER_STATUSES = Object.freeze(['pending', 'active', 'disabled'])

export function normalizeUser(value = {}) {
  return {
    userId: value.userId || value.memberId || 'default_admin',
    name: value.name || '默认管理员',
    avatar: value.avatar || ''
  }
}

export function normalizeEnterprise(value = {}) {
  return {
    enterpriseId: value.enterpriseId || 'default_enterprise',
    enterpriseName: value.enterpriseName || '默认企业'
  }
}

export function normalizeMember(value = {}, context = {}) {
  const user = normalizeUser(context.user || context.currentUser || value)
  const enterprise = normalizeEnterprise(context.enterprise || context.currentEnterprise || value)
  const status = MEMBER_STATUSES.includes(value.status) ? value.status : 'active'
  return {
    memberId: value.memberId || user.userId,
    enterpriseId: enterprise.enterpriseId,
    userId: user.userId,
    roleId: value.roleId || '',
    role: value.role || context.role || '管理员',
    status,
    projectId: value.projectId || '',
    projectIds: Array.isArray(value.projectIds) ? [...value.projectIds] : []
  }
}

function getLegacyFallback() {
  const enterpriseRecord = getEnterpriseList()[0] || {}
  const members = Array.isArray(enterpriseRecord.members) ? enterpriseRecord.members : []
  const memberRecord = members.find((item) => item.memberId === enterpriseRecord.currentMemberId) || members[0] || {}
  const user = normalizeUser(memberRecord)
  const enterprise = normalizeEnterprise(enterpriseRecord)
  const member = normalizeMember(memberRecord, { user, enterprise, role: memberRecord.role || '管理员' })
  return {
    currentUser: user,
    currentEnterprise: enterprise,
    currentMember: member,
    currentRole: member.role,
    authSource: 'local_mock',
    authCapability: 'placeholder',
    authProvider: 'local_mock',
    sessionToken: '',
    sessionStatus: 'valid',
    identityDiagnostics: { identitySource: 'local_mock', identityAvailable: true }
  }
}

export function getCurrentContext() {
  return getCurrentAuthContext(getLegacyFallback())
}

export function getCurrentUser() {
  return normalizeUser(getCurrentContext().currentUser)
}

export function getCurrentEnterprise() {
  return normalizeEnterprise(getCurrentContext().currentEnterprise)
}

export function getCurrentMember() {
  const context = getCurrentContext()
  return normalizeMember(context.currentMember, {
    user: context.currentUser,
    enterprise: context.currentEnterprise,
    role: context.currentRole
  })
}

export function setCurrentContext(input = {}) {
  const current = getCurrentContext()
  const user = normalizeUser(input.user || input.currentUser || current.currentUser)
  const enterprise = normalizeEnterprise(input.enterprise || input.currentEnterprise || current.currentEnterprise)
  const memberInput = input.member || input.currentMember || current.currentMember
  const member = normalizeMember(memberInput, {
    user,
    enterprise,
    role: input.role || input.currentRole || memberInput.role || current.currentRole
  })
  return setCurrentAuthContext({
    currentUser: user,
    currentEnterprise: enterprise,
    currentMember: member,
    currentRole: member.role,
    authSource: input.authSource || current.authSource || 'local_mock',
    authCapability: input.authCapability || current.authCapability || 'placeholder',
    authProvider: input.authProvider || current.authProvider || 'local_mock',
    sessionToken: input.sessionToken !== undefined ? input.sessionToken : (current.sessionToken || ''),
    sessionStatus: input.sessionStatus || current.sessionStatus || '',
    identityDiagnostics: input.identityDiagnostics || current.identityDiagnostics || {},
    sessionUpdatedAt: input.sessionUpdatedAt || current.sessionUpdatedAt || new Date().toISOString()
  })
}

export function clearContext() {
  clearCurrentAuthContext()
  return getCurrentContext()
}
