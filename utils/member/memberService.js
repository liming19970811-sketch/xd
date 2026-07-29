import { get, set } from '../data-provider/dataProvider.js'
import { getCurrentSession } from '../auth/authSessionService.js'
import { callEnterpriseMember } from '../auth/enterpriseMemberTransport.js'
import { getCurrentContext, getCurrentEnterprise, getCurrentMember, getCurrentUser } from '../auth/authRepository.js'
import { getCurrentEnterpriseId } from '../tenant/tenantContext.js'
import { filterTenantData, protectTenantCreate, protectTenantUpdate } from '../tenant/tenantGuard.js'

const MEMBER_STORAGE_KEY = 'enterprise_members'
const VALID_STATUSES = ['active', 'pending', 'disabled']

function nowIso() {
  return new Date().toISOString()
}

function createId(prefix = 'member') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

function readStore() {
  const records = get(MEMBER_STORAGE_KEY, [])
  return Array.isArray(records) ? records : []
}

function writeStore(records = []) {
  set(MEMBER_STORAGE_KEY, Array.isArray(records) ? records : [])
}

function normalizeMember(record = {}) {
  const currentEnterpriseId = getCurrentEnterpriseId()
  return {
    memberId: String(record.memberId || record._id || createId()).trim(),
    enterpriseId: String(record.enterpriseId || currentEnterpriseId).trim(),
    userId: String(record.userId || '').trim(),
    name: String(record.name || record.userName || '').trim(),
    avatar: String(record.avatar || '').trim(),
    role: String(record.role || 'member').trim(),
    status: VALID_STATUSES.includes(record.status) ? record.status : 'pending',
    createdAt: record.createdAt || nowIso(),
    updatedAt: record.updatedAt || record.createdAt || nowIso()
  }
}

function getSessionMemberships() {
  const session = getCurrentSession()
  const memberships = session && Array.isArray(session.enterprises) ? session.enterprises : []
  return memberships
    .filter((item) => item && item.member && item.enterprise && item.enterprise.enterpriseId === getCurrentEnterpriseId())
    .map((item) => normalizeMember({
      ...item.member,
      enterpriseId: item.enterprise.enterpriseId,
      role: item.role || item.member.role,
      name: item.member.name || session.user?.name || ''
    }))
}

function getCurrentMemberFallback() {
  const context = getCurrentContext()
  const enterprise = getCurrentEnterprise()
  const member = getCurrentMember()
  const user = getCurrentUser()
  if (!enterprise.enterpriseId || !member.memberId || member.enterpriseId !== enterprise.enterpriseId) return []
  return [normalizeMember({
    ...member,
    enterpriseId: enterprise.enterpriseId,
    userId: member.userId || user.userId,
    name: member.name || user.name,
    avatar: member.avatar || user.avatar,
    role: context.currentRole || member.role || 'admin',
    status: member.status || 'active'
  })]
}

function mergeMembers(...groups) {
  const map = new Map()
  groups.flat().forEach((item) => {
    if (!item || !item.memberId) return
    map.set(item.memberId, { ...(map.get(item.memberId) || {}), ...item })
  })
  return [...map.values()].sort((left, right) => String(left.createdAt || '').localeCompare(String(right.createdAt || '')))
}

function isLocalMockSession() {
  const session = getCurrentSession()
  return !session || session.authSource === 'local_mock'
}

function normalizeCloudMember(record = {}) {
  return normalizeMember({
    ...record,
    memberId: record.memberId,
    enterpriseId: record.enterpriseId || getCurrentEnterpriseId(),
    role: record.role || 'viewer',
    status: record.status || 'pending'
  })
}

export function getCurrentEnterpriseMembers() {
  const enterpriseId = getCurrentEnterpriseId()
  const stored = filterTenantData(readStore().map(normalizeMember), enterpriseId)
  return mergeMembers(stored, getSessionMemberships(), getCurrentMemberFallback())
}

export async function getCurrentMemberDetail() {
  if (isLocalMockSession()) {
    const member = getCurrentMemberFallback()[0] || null
    return { success: true, member, source: 'local_mock' }
  }
  const result = await callEnterpriseMember('getCurrentMember')
  if (!result || !result.success) {
    return { success: false, errorCode: result?.errorCode || 'cloud_call_failed', message: result?.message || '成员加载失败' }
  }
  return {
    success: true,
    member: normalizeCloudMember(result.data && result.data.member),
    permissions: result.data && result.data.permissions,
    source: 'cloud'
  }
}

export async function getMembers() {
  if (isLocalMockSession()) return getCurrentEnterpriseMembers()
  const result = await callEnterpriseMember('listMembers')
  if (!result || !result.success) {
    throw Object.assign(new Error(result?.message || '成员列表加载失败'), {
      errorCode: result?.errorCode || 'cloud_call_failed'
    })
  }
  return ((result.data && result.data.members) || []).map(normalizeCloudMember)
}

export function addMember(input = {}) {
  const currentUser = getCurrentUser()
  const record = protectTenantCreate({
    ...input,
    memberId: input.memberId || createId(),
    userId: input.userId || createId('user'),
    name: input.name || '',
    role: input.role || 'member',
    status: VALID_STATUSES.includes(input.status) ? input.status : 'pending',
    createdAt: nowIso(),
    updatedAt: nowIso(),
    updatedBy: currentUser.userId
  })
  if (!record) return null
  const members = readStore().map(normalizeMember).filter((item) => item.memberId !== record.memberId)
  writeStore([normalizeMember(record), ...members])
  return normalizeMember(record)
}

export function updateRole(memberId = '', role = '') {
  if (!memberId || !role) return null
  const enterpriseId = getCurrentEnterpriseId()
  const members = readStore().map(normalizeMember)
  const current = members.find((item) => item.memberId === memberId)
  const patch = protectTenantUpdate(current, { role, updatedAt: nowIso(), updatedBy: getCurrentUser().userId }, enterpriseId)
  if (!patch) return null
  writeStore(members.map((item) => item.memberId === memberId ? normalizeMember(patch) : item))
  return normalizeMember(patch)
}

export async function updateMemberRole(memberId = '', role = '') {
  if (isLocalMockSession()) return updateRole(memberId, role)
  const result = await callEnterpriseMember('updateMemberRole', { memberId, role })
  if (!result || !result.success) {
    return { success: false, errorCode: result?.errorCode || 'cloud_call_failed', message: result?.message || '角色更新失败' }
  }
  return { success: true, member: normalizeCloudMember(result.data && result.data.member), source: 'cloud' }
}

function updateMemberStatusLocal(memberId = '', status = '') {
  if (!memberId || !VALID_STATUSES.includes(status)) return null
  const enterpriseId = getCurrentEnterpriseId()
  const members = readStore().map(normalizeMember)
  const current = members.find((item) => item.memberId === memberId)
  const patch = protectTenantUpdate(current, { status, updatedAt: nowIso(), updatedBy: getCurrentUser().userId }, enterpriseId)
  if (!patch) return null
  writeStore(members.map((item) => item.memberId === memberId ? normalizeMember(patch) : item))
  return normalizeMember(patch)
}

export async function updateMemberStatus(memberId = '', status = '') {
  if (isLocalMockSession()) return updateMemberStatusLocal(memberId, status)
  const result = await callEnterpriseMember('updateMemberStatus', { memberId, status })
  if (!result || !result.success) {
    return { success: false, errorCode: result?.errorCode || 'cloud_call_failed', message: result?.message || '成员状态更新失败' }
  }
  return { success: true, member: normalizeCloudMember(result.data && result.data.member), source: 'cloud' }
}

export function removeMember(memberId = '') {
  if (!memberId) return false
  const enterpriseId = getCurrentEnterpriseId()
  const members = readStore().map(normalizeMember)
  const target = members.find((item) => item.memberId === memberId)
  if (!target || target.enterpriseId !== enterpriseId) return false
  writeStore(members.filter((item) => item.memberId !== memberId))
  return true
}
