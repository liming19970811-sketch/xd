import { getById as getEnterpriseById, update as updateEnterprise } from '../repository/enterpriseRepository.js'
import {
  MEMBER_STATUSES,
  getCurrentEnterprise,
  getCurrentMember,
  getCurrentUser,
  normalizeMember,
  setCurrentContext
} from './authRepository.js'

function getEnterpriseRecord(enterpriseId = '') {
  return getEnterpriseById(enterpriseId || getCurrentEnterprise().enterpriseId)
}

function saveMembers(enterprise, members) {
  if (!enterprise) return null
  return updateEnterprise(enterprise.enterpriseId, {
    members,
    updatedBy: getCurrentUser().userId
  })
}

export function getMembers(enterpriseId = '') {
  const enterprise = getEnterpriseRecord(enterpriseId)
  return enterprise && Array.isArray(enterprise.members) ? enterprise.members : []
}

export function addMember(input = {}) {
  const enterprise = getEnterpriseRecord(input.enterpriseId)
  if (!enterprise) return null
  const user = {
    userId: input.userId || `user_${Date.now()}`,
    name: input.name || '未命名成员',
    avatar: input.avatar || ''
  }
  const member = {
    ...normalizeMember({
      ...input,
      memberId: input.memberId || `member_${Date.now()}`,
      status: MEMBER_STATUSES.includes(input.status) ? input.status : 'pending'
    }, { user, enterprise, role: input.role || '成员' }),
    name: user.name,
    avatar: user.avatar
  }
  const members = [member, ...getMembers(enterprise.enterpriseId).filter((item) => item.memberId !== member.memberId)]
  saveMembers(enterprise, members)
  return member
}

export function updateRole(memberId = '', role = '') {
  if (!memberId || !role) return null
  const enterprise = getEnterpriseRecord()
  if (!enterprise) return null
  const members = getMembers(enterprise.enterpriseId)
  const current = members.find((item) => item.memberId === memberId)
  if (!current) return null
  const member = { ...current, role, updatedAt: new Date().toISOString(), updatedBy: getCurrentUser().userId }
  saveMembers(enterprise, members.map((item) => item.memberId === memberId ? member : item))
  if (getCurrentMember().memberId === memberId) {
    setCurrentContext({
      user: { userId: member.userId, name: member.name, avatar: member.avatar },
      enterprise,
      member
    })
  }
  return member
}

export function updateMemberStatus(memberId = '', status = '') {
  if (!memberId || !MEMBER_STATUSES.includes(status)) return null
  const enterprise = getEnterpriseRecord()
  if (!enterprise) return null
  const members = getMembers(enterprise.enterpriseId)
  const current = members.find((item) => item.memberId === memberId)
  if (!current) return null
  const member = { ...current, status, updatedAt: new Date().toISOString(), updatedBy: getCurrentUser().userId }
  saveMembers(enterprise, members.map((item) => item.memberId === memberId ? member : item))
  if (getCurrentMember().memberId === memberId) {
    setCurrentContext({
      user: { userId: member.userId, name: member.name, avatar: member.avatar },
      enterprise,
      member
    })
  }
  return member
}

export function removeMember(memberId = '') {
  if (!memberId) return false
  const enterprise = getEnterpriseRecord()
  if (!enterprise) return false
  const members = getMembers(enterprise.enterpriseId)
  if (!members.some((item) => item.memberId === memberId)) return false
  const remainingMembers = members.filter((item) => item.memberId !== memberId)
  if (!remainingMembers.length) return false
  saveMembers(enterprise, remainingMembers)
  if (getCurrentMember().memberId === memberId) {
    const nextMember = remainingMembers.find((item) => item.status === 'active') || remainingMembers[0]
    setCurrentContext({
      user: { userId: nextMember.userId, name: nextMember.name, avatar: nextMember.avatar },
      enterprise,
      member: nextMember
    })
  }
  return true
}
