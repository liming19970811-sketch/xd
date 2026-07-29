import { normalize as normalizeEnterpriseRecord, readLocalStorage, writeLocalStorage } from '../repository/enterpriseRepository.js'
import { getCurrentContext, normalizeEnterprise, normalizeMember, normalizeUser } from './authRepository.js'
import { getCurrentSession, setSession } from './authSessionService.js'
import { AUTH_MODES } from './cloudAuthProvider.js'
import { registerEnterprise as registerCloudEnterprise } from './cloudAuthProvider.js'
import { ensureEnterpriseAuthTransportReady } from './enterpriseAuthTransport.js'
import { setCurrentEnterpriseId } from '../tenant/tenantContext.js'

const ENTERPRISE_STORAGE_KEY = 'diebiandesign_enterprise_team_v1'

function nowIso() {
  return new Date().toISOString()
}

function stableId(value = '') {
  const text = String(value || 'enterprise').trim() || 'enterprise'
  let hash = 0
  for (let index = 0; index < text.length; index += 1) {
    hash = ((hash << 5) - hash) + text.charCodeAt(index)
    hash |= 0
  }
  return `enterprise_${Math.abs(hash)}`
}

function validateEnterpriseName(value = '') {
  const name = String(value || '').trim()
  if (name.length < 2) return { ok: false, message: '企业名称至少 2 个字符' }
  if (name.length > 50) return { ok: false, message: '企业名称最多 50 个字符' }
  return { ok: true, name }
}

function validateContactName(value = '') {
  const name = String(value || '').trim()
  if (!name) return { ok: false, message: '请填写联系人姓名' }
  return { ok: true, name }
}

function validateContactPhone(value = '') {
  const phone = String(value || '').trim()
  if (!phone) return { ok: false, message: '请填写联系电话' }
  if (!/^[0-9+\-\s()]{6,20}$/.test(phone)) return { ok: false, message: '联系电话格式不正确' }
  return { ok: true, phone }
}

function readAllEnterprises() {
  const value = readLocalStorage(ENTERPRISE_STORAGE_KEY, null)
  if (Array.isArray(value)) return value
  if (value && Array.isArray(value.enterprises)) return value.enterprises
  return value && typeof value === 'object' ? [value] : []
}

function writeAllEnterprises(records = []) {
  writeLocalStorage(ENTERPRISE_STORAGE_KEY, {
    schemaVersion: 1,
    dataSource: 'local',
    enterprises: records.map((item) => normalizeEnterpriseRecord(item, { enterpriseId: item.enterpriseId }))
  })
}

function getActiveUser(input = {}) {
  const session = getCurrentSession()
  const context = getCurrentContext()
  return normalizeUser({
    ...(session && session.user ? session.user : context.currentUser),
    name: input.contactName || (session && session.user ? session.user.name : context.currentUser.name)
  })
}

function getIdempotencyKey(input = {}, userId = '') {
  return input.idempotencyKey || stableId(`${userId}_${String(input.enterpriseName || '').trim()}`)
}

function isDevelopment() {
  try {
    return typeof process !== 'undefined' && process.env && process.env.NODE_ENV !== 'production'
  } catch (error) {
    return false
  }
}

function logCloudRegister(payload = {}) {
  if (!isDevelopment()) return
  console.log('[enterprise-register:h5]', {
    action: 'registerEnterprise',
    hasSessionToken: !!payload.hasSessionToken,
    authMode: payload.authMode || '',
    authProvider: payload.authProvider || '',
    success: !!payload.success,
    errorCode: payload.errorCode || '',
    elapsedMs: payload.elapsedMs || 0
  })
}

function validateCommonInput(input = {}) {
  const enterpriseName = validateEnterpriseName(input.enterpriseName)
  if (!enterpriseName.ok) return { ok: false, errorCode: 'enterprise_name_invalid', message: enterpriseName.message }
  const contactName = validateContactName(input.contactName)
  if (!contactName.ok) return { ok: false, errorCode: 'contact_name_invalid', message: contactName.message }
  const contactPhone = validateContactPhone(input.contactPhone)
  if (!contactPhone.ok) return { ok: false, errorCode: 'contact_phone_invalid', message: contactPhone.message }
  return {
    ok: true,
    enterpriseName: enterpriseName.name,
    contactName: contactName.name,
    contactPhone: contactPhone.phone,
    industry: String(input.industry || '').trim(),
    teamSize: String(input.teamSize || '').trim()
  }
}

async function validateCloudRegistrationSession(currentSession = {}) {
  if (!currentSession) return { ok: false, errorCode: 'authentication_required', message: '请先登录' }
  if (currentSession.authSource !== AUTH_MODES.CLOUD_AUTHENTICATED || currentSession.authMode !== AUTH_MODES.CLOUD_AUTHENTICATED) {
    return { ok: false, errorCode: 'authentication_required', message: '请使用云端身份登录后再注册企业' }
  }
  if (!currentSession.token) {
    return { ok: false, errorCode: 'session_invalid', message: '登录会话无效，请重新登录' }
  }
  const allowedProviders = ['miniapp_scan', 'wechat_web', 'email_code', 'phone_code']
  if (!allowedProviders.includes(currentSession.authProvider)) {
    return { ok: false, errorCode: 'authentication_required', message: '当前登录方式暂不能注册企业' }
  }
  const transportStatus = await ensureEnterpriseAuthTransportReady()
  if (transportStatus.platform === 'h5') {
    if (!transportStatus.initialized || !transportStatus.hasCallFunction) {
      return { ok: false, errorCode: 'cloud_sdk_not_ready', message: 'CloudBase Web SDK 尚未就绪' }
    }
    if (!transportStatus.authenticated) {
      return { ok: false, errorCode: 'cloud_web_auth_required', message: '请先完成 CloudBase Web 登录态初始化' }
    }
  }
  return { ok: true }
}

function buildRegisteredSession(currentSession = {}, result = {}) {
  const enterprise = normalizeEnterprise(result.enterprise || result.session?.enterprise || result.currentEnterprise || {})
  const member = normalizeMember(result.member || result.session?.member || result.currentMember || {}, {
    user: currentSession.user,
    enterprise,
    role: result.role || result.session?.role || 'admin'
  })
  const session = setSession({
    ...currentSession,
    ...(result.session || {}),
    token: currentSession.token,
    user: currentSession.user,
    enterprise,
    member,
    role: result.role || result.session?.role || member.role || 'admin',
    authSource: AUTH_MODES.CLOUD_AUTHENTICATED,
    authMode: AUTH_MODES.CLOUD_AUTHENTICATED,
    authProvider: currentSession.authProvider,
    authCapability: result.authCapability || currentSession.authCapability,
    identityDiagnostics: result
  })
  setCurrentEnterpriseId(enterprise.enterpriseId)
  return { enterprise, member, session }
}

export async function registerEnterprise(input = {}) {
  const currentSession = getCurrentSession()
  if (!currentSession) return { success: false, errorCode: 'authentication_required', message: '请先登录' }
  if (currentSession.authSource === AUTH_MODES.CLOUD_PENDING) {
    return { success: false, errorCode: 'authentication_required', message: '云端登录尚未完成，暂不能注册企业' }
  }
  if (currentSession.authSource === AUTH_MODES.CLOUD_FAILED) {
    return { success: false, errorCode: 'authentication_required', message: '云端登录失败，请重新登录' }
  }

  const validation = validateCommonInput(input)
  if (!validation.ok) return { success: false, errorCode: validation.errorCode, message: validation.message }

  if (currentSession.authSource === AUTH_MODES.CLOUD_AUTHENTICATED) {
    const sessionValidation = await validateCloudRegistrationSession(currentSession)
    if (!sessionValidation.ok) return { success: false, errorCode: sessionValidation.errorCode, message: sessionValidation.message }

    const startedAt = Date.now()
    const result = await registerCloudEnterprise({
      sessionToken: currentSession.token,
      idempotencyKey: getIdempotencyKey(input, currentSession.user.userId),
      enterpriseName: validation.enterpriseName,
      contactName: validation.contactName,
      contactPhone: validation.contactPhone,
      industry: validation.industry,
      teamSize: validation.teamSize
    })
    logCloudRegister({
      hasSessionToken: !!currentSession.token,
      authMode: currentSession.authMode,
      authProvider: currentSession.authProvider,
      success: !!(result && result.success),
      errorCode: result && result.errorCode ? result.errorCode : '',
      elapsedMs: Date.now() - startedAt
    })
    if (result && result.success) {
      const registered = buildRegisteredSession(currentSession, result)
      return {
        success: true,
        enterprise: registered.enterprise,
        member: registered.member,
        session: registered.session
      }
    }
    return {
      success: false,
      errorCode: result && result.errorCode ? result.errorCode : 'register_failed',
      message: result && result.message ? result.message : '云端企业注册失败'
    }
  }

  return registerEnterpriseLocal({ ...input, enterpriseName: validation.enterpriseName })
}

export function registerEnterpriseLocal(input = {}) {
  const currentSession = getCurrentSession()
  if (!currentSession || currentSession.authSource !== AUTH_MODES.LOCAL_MOCK) {
    return { success: false, errorCode: 'local_mock_required', message: '请先显式选择本地模拟身份' }
  }
  const validation = validateCommonInput(input)
  if (!validation.ok) return { success: false, errorCode: validation.errorCode, message: validation.message }

  const now = nowIso()
  const user = getActiveUser({ ...input, contactName: validation.contactName })
  const enterprise = normalizeEnterprise({
    enterpriseId: input.enterpriseId || stableId(`${user.userId}_${validation.enterpriseName}`),
    enterpriseName: validation.enterpriseName
  })
  const member = normalizeMember({
    memberId: `${enterprise.enterpriseId}_${user.userId}`,
    enterpriseId: enterprise.enterpriseId,
    userId: user.userId,
    name: user.name,
    avatar: user.avatar,
    role: 'admin',
    status: 'active',
    createdAt: now,
    updatedAt: now
  }, { user, enterprise, role: 'admin' })

  const records = readAllEnterprises()
  const existing = records.find((item) => item.enterpriseId === enterprise.enterpriseId)
  const currentMembers = existing && Array.isArray(existing.members) ? existing.members : []
  const nextMembers = [
    member,
    ...currentMembers.filter((item) => item.memberId !== member.memberId && item.userId !== user.userId)
  ]
  const record = normalizeEnterpriseRecord({
    ...(existing || {}),
    ...enterprise,
    contactName: validation.contactName || user.name,
    contactPhone: validation.contactPhone || existing?.contactPhone || '',
    industry: validation.industry || existing?.industry || '',
    teamSize: validation.teamSize || existing?.teamSize || '',
    idempotencyKey: getIdempotencyKey(input, user.userId),
    members: nextMembers,
    currentMemberId: member.memberId,
    userId: user.userId,
    createdAt: existing?.createdAt || now,
    updatedAt: now
  }, { enterpriseId: enterprise.enterpriseId, userId: user.userId })

  writeAllEnterprises([
    record,
    ...records.filter((item) => item.enterpriseId !== enterprise.enterpriseId)
  ])

  const session = setSession({
    ...currentSession,
    user,
    enterprise,
    member,
    role: member.role,
    enterprises: []
  })
  setCurrentEnterpriseId(enterprise.enterpriseId)

  return {
    success: true,
    enterprise,
    member,
    user,
    session
  }
}
