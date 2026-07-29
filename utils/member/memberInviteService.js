import { get, isDataProviderDevelopment, set } from '../data-provider/dataProvider.js'
import { getCurrentSession } from '../auth/authSessionService.js'
import { callEnterpriseMember } from '../auth/enterpriseMemberTransport.js'
import { getCurrentMember } from '../auth/authRepository.js'
import { getCurrentEnterpriseId } from '../tenant/tenantContext.js'
import { filterTenantData, protectTenantCreate, protectTenantUpdate } from '../tenant/tenantGuard.js'

const INVITE_STORAGE_KEY = 'enterprise_member_invites'
const VALID_INVITE_STATUSES = ['pending', 'accepted', 'expired', 'cancelled']
const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000

function nowIso() {
  return new Date().toISOString()
}

function createId(prefix = 'invite') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

function readStore() {
  const records = get(INVITE_STORAGE_KEY, [])
  return Array.isArray(records) ? records : []
}

function writeStore(records = []) {
  set(INVITE_STORAGE_KEY, Array.isArray(records) ? records : [])
}

function normalizeInvite(record = {}) {
  return {
    inviteId: String(record.inviteId || record._id || createId()).trim(),
    enterpriseId: String(record.enterpriseId || getCurrentEnterpriseId()).trim(),
    inviterMemberId: String(record.inviterMemberId || '').trim(),
    targetAccount: String(record.targetAccount || '').trim(),
    role: String(record.role || 'member').trim(),
    status: VALID_INVITE_STATUSES.includes(record.status) ? record.status : 'pending',
    createdAt: record.createdAt || nowIso(),
    expiresAt: record.expiresAt || new Date(Date.now() + INVITE_TTL_MS).toISOString()
  }
}

function logInviteResult(success = false, errorCode = '') {
  if (!isDataProviderDevelopment()) return
  console.info('[member:invite]', {
    hasEnterpriseId: Boolean(getCurrentEnterpriseId()),
    success: Boolean(success),
    errorCode: errorCode || ''
  })
}

function validateTargetAccount(value = '') {
  const account = String(value || '').trim()
  if (!account) return { ok: false, errorCode: 'target_account_required' }
  const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(account)
  const isPhone = /^[0-9+\-\s()]{6,32}$/.test(account)
  if (!isEmail && !isPhone) return { ok: false, errorCode: 'target_account_invalid' }
  return { ok: true, account }
}

function isLocalMockSession() {
  const session = getCurrentSession()
  return !session || session.authSource === 'local_mock'
}

function getInvitesLocal() {
  return filterTenantData(readStore().map(normalizeInvite), getCurrentEnterpriseId())
    .sort((left, right) => String(right.createdAt || '').localeCompare(String(left.createdAt || '')))
}

export async function getInvites() {
  if (isLocalMockSession()) return getInvitesLocal()
  const result = await callEnterpriseMember('listInvites')
  if (!result || !result.success) {
    throw Object.assign(new Error(result?.message || '邀请列表加载失败'), {
      errorCode: result?.errorCode || 'cloud_call_failed'
    })
  }
  return (result.data && result.data.invites) || []
}

function createInviteLocal(input = {}) {
  const accountValidation = validateTargetAccount(input.targetAccount)
  if (!accountValidation.ok) {
    logInviteResult(false, accountValidation.errorCode)
    return { success: false, errorCode: accountValidation.errorCode }
  }
  const currentMember = getCurrentMember()
  if (!currentMember || !currentMember.memberId || currentMember.status !== 'active') {
    logInviteResult(false, 'member_inactive')
    return { success: false, errorCode: 'member_inactive' }
  }
  const record = protectTenantCreate({
    inviteId: createId(),
    inviterMemberId: currentMember.memberId,
    targetAccount: accountValidation.account,
    role: input.role || 'member',
    status: 'pending',
    createdAt: nowIso(),
    expiresAt: new Date(Date.now() + INVITE_TTL_MS).toISOString()
  })
  if (!record) {
    logInviteResult(false, 'tenant_denied')
    return { success: false, errorCode: 'tenant_denied' }
  }
  const invite = normalizeInvite(record)
  writeStore([invite, ...readStore().map(normalizeInvite).filter((item) => item.inviteId !== invite.inviteId)])
  logInviteResult(true, '')
  return { success: true, invite }
}

export async function createInvite(input = {}) {
  if (isLocalMockSession()) return createInviteLocal(input)
  const result = await callEnterpriseMember('createInvite', {
    targetAccount: input.targetAccount,
    role: input.role
  })
  if (!result || !result.success) {
    logInviteResult(false, result && result.errorCode)
    return { success: false, errorCode: result?.errorCode || 'cloud_call_failed', message: result?.message || '邀请创建失败' }
  }
  logInviteResult(true, '')
  return { success: true, invite: result.data && result.data.invite, source: 'cloud' }
}

function cancelInviteLocal(inviteId = '') {
  const id = String(inviteId || '').trim()
  if (!id) {
    logInviteResult(false, 'invite_id_required')
    return { success: false, errorCode: 'invite_id_required' }
  }
  const enterpriseId = getCurrentEnterpriseId()
  const records = readStore().map(normalizeInvite)
  const current = records.find((item) => item.inviteId === id)
  const patch = protectTenantUpdate(current, { status: 'cancelled' }, enterpriseId)
  if (!patch) {
    logInviteResult(false, 'tenant_denied')
    return { success: false, errorCode: 'tenant_denied' }
  }
  if (current.status !== 'pending') {
    logInviteResult(false, 'invite_not_pending')
    return { success: false, errorCode: 'invite_not_pending' }
  }
  const next = records.map((item) => item.inviteId === id ? normalizeInvite(patch) : item)
  writeStore(next)
  logInviteResult(true, '')
  return { success: true, invite: normalizeInvite(patch) }
}

export async function cancelInvite(inviteId = '') {
  if (isLocalMockSession()) return cancelInviteLocal(inviteId)
  const result = await callEnterpriseMember('cancelInvite', { inviteId })
  if (!result || !result.success) {
    logInviteResult(false, result && result.errorCode)
    return { success: false, errorCode: result?.errorCode || 'cloud_call_failed', message: result?.message || '邀请取消失败' }
  }
  logInviteResult(true, '')
  return { success: true, invite: result.data && result.data.invite, source: 'cloud' }
}

export async function acceptInvite(inviteToken = '') {
  if (!inviteToken) return { success: false, errorCode: 'invite_token_required' }
  if (isLocalMockSession()) return { success: false, errorCode: 'cloud_required' }
  const result = await callEnterpriseMember('acceptInvite', { inviteToken })
  if (!result || !result.success) {
    logInviteResult(false, result && result.errorCode)
    return { success: false, errorCode: result?.errorCode || 'cloud_call_failed', message: result?.message || '邀请接受失败' }
  }
  logInviteResult(true, '')
  return {
    success: true,
    invite: result.data && result.data.invite,
    member: result.data && result.data.member,
    source: 'cloud'
  }
}
