const cloud = require('wx-server-sdk')
const crypto = require('crypto')
const { canAccessModelProfile } = require('./accessPolicy')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const command = db.command

const COLLECTIONS = Object.freeze({
  profiles: 'modelProfiles',
  tasks: 'tasks',
  sessions: 'enterprise_auth_sessions',
  members: 'enterprise_members'
})
const ACTIVE_TASK_STATUSES = ['pending', 'queued', 'accepted', 'processing', 'generating', 'running']
const CONSENT_TEXT = '我确认拥有该人物图片的使用授权，并同意将图片保存为我的常用模特，仅用于我主动发起的图片生成任务。'

function nowIso() { return new Date().toISOString() }
function text(value, max = 200) { return String(value || '').trim().slice(0, max) }
function hash(value) { return crypto.createHash('sha256').update(String(value || '')).digest('hex') }
function id() { return `model_profile_${Date.now()}_${crypto.randomBytes(6).toString('hex')}` }
function ok(data = {}) { return { ok: true, success: true, errorCode: '', message: '', data } }
function fail(errorCode, message) { return { ok: false, success: false, errorCode, message, data: null } }
function error(errorCode, message) { return Object.assign(new Error(message), { errorCode }) }
function isCloudFileId(value = '') { return /^cloud:\/\//i.test(text(value, 1200)) }

async function one(collection, where) {
  const result = await db.collection(collection).where(where).limit(1).get()
  return result.data && result.data.length ? result.data[0] : null
}

function callerOpenId() {
  const context = cloud.getWXContext()
  const openId = text(context && context.OPENID, 160)
  if (!openId) throw error('AUTH_REQUIRED', '无法确认当前用户身份。')
  return openId
}

async function enterpriseContext(sessionToken, expectedEnterpriseId) {
  const token = text(sessionToken, 1000)
  if (!token) throw error('ENTERPRISE_AUTH_REQUIRED', '企业模特需要有效的企业登录状态。')
  const session = await one(COLLECTIONS.sessions, { sessionTokenHash: hash(token) })
  if (!session || session.status !== 'active') throw error('SESSION_INVALID', '企业登录状态无效。')
  if (session.expiresAt && new Date(session.expiresAt).getTime() <= Date.now()) throw error('SESSION_EXPIRED', '企业登录已过期。')
  if (!session.enterpriseId || session.enterpriseId !== expectedEnterpriseId) throw error('TENANT_MISMATCH', '企业范围不匹配。')
  const member = await one(COLLECTIONS.members, { enterpriseId: session.enterpriseId, memberId: session.memberId })
  if (!member || member.status !== 'active' || member.userId !== session.userId) throw error('MEMBER_FORBIDDEN', '当前企业成员无权访问该模特。')
  return { enterpriseId: session.enterpriseId, userId: session.userId, memberId: session.memberId, role: text(member.role, 60) }
}

async function requireProfileAccess(profile, eventData = {}, mode = 'read') {
  if (!profile || ['deleted'].includes(profile.status)) throw error('MODEL_PROFILE_NOT_FOUND', '常用模特不存在或已删除。')
  const openId = callerOpenId()
  if (profile.scope === 'personal') {
    if (!canAccessModelProfile(profile, { openId }, mode)) throw error('MODEL_PROFILE_FORBIDDEN', '无权访问该常用模特。')
    return { ownerId: openId, enterpriseId: '' }
  }
  const context = await enterpriseContext(eventData.sessionToken, profile.enterpriseId)
  if (!canAccessModelProfile(profile, { ...context, memberStatus: 'active' }, mode)) throw error(mode === 'read' ? 'MODEL_PROFILE_FORBIDDEN' : 'MODEL_PROFILE_MANAGE_FORBIDDEN', mode === 'read' ? '无权访问该常用模特。' : '当前企业角色不能修改常用模特。')
  return context
}

function cleanFileIds(coverFileId, referenceFileIds) {
  const values = [coverFileId, ...(Array.isArray(referenceFileIds) ? referenceFileIds : [])]
    .map((item) => text(item, 1200))
    .filter(Boolean)
  const unique = [...new Set(values)]
  if (!unique.length) throw error('MODEL_PROFILE_IMAGE_REQUIRED', '请至少上传一张人像参考图。')
  if (unique.length > 3) throw error('MODEL_PROFILE_IMAGE_LIMIT', '常用模特最多保存三张参考图。')
  if (unique.some((item) => !isCloudFileId(item))) throw error('MODEL_PROFILE_STABLE_FILE_REQUIRED', '人像图片尚未获得稳定云文件地址。')
  return { coverFileId: unique[0], referenceFileIds: unique.slice(1, 3) }
}

async function temporaryUrls(fileIds = []) {
  if (!fileIds.length) return {}
  const result = await cloud.getTempFileURL({ fileList: fileIds })
  return (result.fileList || []).reduce((map, item) => {
    if (item.status === 0 && item.tempFileURL) map[item.fileID] = item.tempFileURL
    return map
  }, {})
}

async function present(profile) {
  const fileIds = [profile.coverFileId, ...(profile.referenceFileIds || [])].filter(Boolean)
  const urls = await temporaryUrls(fileIds)
  return {
    modelProfileId: profile.modelProfileId,
    name: profile.name,
    note: profile.note || '',
    coverFileId: profile.coverFileId,
    referenceFileIds: profile.referenceFileIds || [],
    coverUrl: urls[profile.coverFileId] || '',
    referenceUrls: (profile.referenceFileIds || []).map((fileId) => urls[fileId] || '').filter(Boolean),
    source: 'user_upload',
    scope: profile.scope,
    enterpriseId: profile.enterpriseId || '',
    consentConfirmed: profile.consentConfirmed === true,
    trainingAllowed: false,
    status: profile.status,
    isDefault: profile.isDefault === true,
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt,
    deletedAt: profile.deletedAt || ''
  }
}

async function listProfiles(data) {
  const openId = callerOpenId()
  const scope = data.scope === 'enterprise' ? 'enterprise' : 'personal'
  let where = { scope, status: data.status === 'archived' ? 'archived' : 'active' }
  if (scope === 'personal') where.ownerId = openId
  else {
    const enterpriseId = text(data.enterpriseId, 160)
    await enterpriseContext(data.sessionToken, enterpriseId)
    where.enterpriseId = enterpriseId
  }
  const result = await db.collection(COLLECTIONS.profiles).where(where).orderBy('updatedAt', 'desc').limit(Math.min(50, Math.max(1, Number(data.limit) || 30))).get()
  const profiles = []
  for (const profile of result.data || []) profiles.push(await present(profile))
  return ok({ profiles })
}

async function getProfile(data, forTask = false) {
  const profile = await one(COLLECTIONS.profiles, { modelProfileId: text(data.modelProfileId, 160) })
  await requireProfileAccess(profile, data, 'read')
  if (forTask && profile.status !== 'active') throw error('MODEL_PROFILE_INACTIVE', '该常用模特当前不可用于新任务。')
  const value = await present(profile)
  return ok(forTask ? {
    modelProfileId: value.modelProfileId,
    name: value.name,
    coverFileId: value.coverFileId,
    referenceFileIds: value.referenceFileIds,
    coverUrl: value.coverUrl,
    referenceUrls: value.referenceUrls,
    consentConfirmed: value.consentConfirmed,
    trainingAllowed: false
  } : value)
}

async function createProfile(data) {
  const ownerId = callerOpenId()
  if (data.consentConfirmed !== true || text(data.consentText, 500) !== CONSENT_TEXT) throw error('CONSENT_REQUIRED', '请确认已获得人物图片使用授权。')
  if (data.imageQualityConfirmed !== true) throw error('IMAGE_QUALITY_CONFIRMATION_REQUIRED', '请确认人像正面清晰且五官无遮挡。')
  const name = text(data.name, 60)
  if (!name) throw error('MODEL_PROFILE_NAME_REQUIRED', '请输入模特名称。')
  const files = cleanFileIds(data.coverFileId, data.referenceFileIds)
  const scope = data.scope === 'enterprise' ? 'enterprise' : 'personal'
  let enterpriseId = ''
  if (scope === 'enterprise') {
    enterpriseId = text(data.enterpriseId, 160)
    await enterpriseContext(data.sessionToken, enterpriseId)
  }
  const timestamp = nowIso()
  const profile = {
    modelProfileId: id(), ownerId, enterpriseId, name, note: text(data.note, 300),
    ...files, source: 'user_upload', scope, consentConfirmed: true, consentTextVersion: 'v1',
    imageQualityConfirmed: true, trainingAllowed: false, status: 'active', isDefault: false,
    createdAt: timestamp, updatedAt: timestamp, deletedAt: ''
  }
  await db.collection(COLLECTIONS.profiles).add({ data: profile })
  return ok(await present(profile))
}

async function updateProfile(data) {
  const profile = await one(COLLECTIONS.profiles, { modelProfileId: text(data.modelProfileId, 160) })
  await requireProfileAccess(profile, data, 'manage')
  const patch = { updatedAt: nowIso() }
  if (Object.prototype.hasOwnProperty.call(data, 'name')) {
    patch.name = text(data.name, 60)
    if (!patch.name) throw error('MODEL_PROFILE_NAME_REQUIRED', '请输入模特名称。')
  }
  if (Object.prototype.hasOwnProperty.call(data, 'note')) patch.note = text(data.note, 300)
  if (data.coverFileId || Array.isArray(data.referenceFileIds)) {
    if (data.consentConfirmed !== true || data.imageQualityConfirmed !== true) throw error('CONSENT_REQUIRED', '更换参考图前请重新确认图片授权和质量。')
    Object.assign(patch, cleanFileIds(data.coverFileId || profile.coverFileId, data.referenceFileIds || profile.referenceFileIds))
    patch.consentConfirmed = true
    patch.imageQualityConfirmed = true
    patch.trainingAllowed = false
  }
  await db.collection(COLLECTIONS.profiles).where({ modelProfileId: profile.modelProfileId }).update({ data: patch })
  return getProfile({ ...data, modelProfileId: profile.modelProfileId })
}

async function setDefault(data) {
  const profile = await one(COLLECTIONS.profiles, { modelProfileId: text(data.modelProfileId, 160) })
  await requireProfileAccess(profile, data, 'manage')
  const where = profile.scope === 'personal'
    ? { ownerId: profile.ownerId, scope: 'personal', status: 'active' }
    : { enterpriseId: profile.enterpriseId, scope: 'enterprise', status: 'active' }
  await db.collection(COLLECTIONS.profiles).where(where).update({ data: { isDefault: false, updatedAt: nowIso() } })
  await db.collection(COLLECTIONS.profiles).where({ modelProfileId: profile.modelProfileId }).update({ data: { isDefault: true, updatedAt: nowIso() } })
  return ok({ modelProfileId: profile.modelProfileId, isDefault: true })
}

async function archiveProfile(data) {
  const profile = await one(COLLECTIONS.profiles, { modelProfileId: text(data.modelProfileId, 160) })
  await requireProfileAccess(profile, data, 'manage')
  await db.collection(COLLECTIONS.profiles).where({ modelProfileId: profile.modelProfileId }).update({ data: { status: 'archived', isDefault: false, updatedAt: nowIso() } })
  return ok({ modelProfileId: profile.modelProfileId, status: 'archived' })
}

async function hasRunningTask(modelProfileId) {
  const profilePath = { modelProfileId, status: command.in(ACTIVE_TASK_STATUSES) }
  const direct = await db.collection(COLLECTIONS.tasks).where(profilePath).limit(1).get()
  if (direct.data && direct.data.length) return true
  const nested = await db.collection(COLLECTIONS.tasks).where({ 'input.params.modelProfileId': modelProfileId, status: command.in(ACTIVE_TASK_STATUSES) }).limit(1).get()
  return Boolean(nested.data && nested.data.length)
}

async function deleteProfile(data) {
  const profile = await one(COLLECTIONS.profiles, { modelProfileId: text(data.modelProfileId, 160) })
  await requireProfileAccess(profile, data, 'manage')
  if (await hasRunningTask(profile.modelProfileId)) throw error('MODEL_PROFILE_IN_USE', '该模特正被生成任务使用，任务结束后才能删除。')
  const timestamp = nowIso()
  await db.collection(COLLECTIONS.profiles).where({ modelProfileId: profile.modelProfileId }).update({ data: { status: 'deleted', isDefault: false, updatedAt: timestamp, deletedAt: timestamp } })
  return ok({ modelProfileId: profile.modelProfileId, status: 'deleted' })
}

exports.main = async (event = {}) => {
  const action = text(event.action, 80)
  const data = event.data && typeof event.data === 'object' ? event.data : {}
  try {
    if (action === 'list') return listProfiles(data)
    if (action === 'get') return getProfile(data)
    if (action === 'resolve_for_task') return getProfile(data, true)
    if (action === 'create') return createProfile(data)
    if (action === 'update') return updateProfile(data)
    if (action === 'set_default') return setDefault(data)
    if (action === 'archive') return archiveProfile(data)
    if (action === 'delete') return deleteProfile(data)
    return fail('ACTION_NOT_SUPPORTED', '不支持的常用模特操作。')
  } catch (caught) {
    console.warn('[model-profile]', { action, success: false, errorCode: caught.errorCode || 'MODEL_PROFILE_ERROR' })
    return fail(caught.errorCode || 'MODEL_PROFILE_ERROR', caught.message || '常用模特操作失败。')
  }
}
