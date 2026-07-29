const cloud = require('wx-server-sdk')
const crypto = require('crypto')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

const COLLECTION = 'colorPreferences'
const MAX_COLORS = 30

function text(value, max = 200) { return String(value || '').trim().slice(0, max) }
function nowIso() { return new Date().toISOString() }
function hash(value) { return crypto.createHash('sha256').update(String(value || '')).digest('hex') }
function ok(data = {}) { return { ok: true, success: true, errorCode: '', message: '', data } }
function fail(errorCode, message) { return { ok: false, success: false, errorCode, message, data: null } }
function error(errorCode, message) { return Object.assign(new Error(message), { errorCode }) }
function validHex(value = '') { return /^#[0-9A-F]{6}$/.test(text(value, 7).toUpperCase()) }

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

async function resolveScope(data = {}) {
  const ownerId = callerOpenId()
  if (data.scope !== 'enterprise') return { ownerId, enterpriseId: '', scope: 'personal' }
  const enterpriseId = text(data.enterpriseId, 160)
  const sessionToken = text(data.sessionToken, 1000)
  if (!enterpriseId || !sessionToken) throw error('ENTERPRISE_AUTH_REQUIRED', '企业颜色需要有效的企业登录状态。')
  const session = await one('enterprise_auth_sessions', { sessionTokenHash: hash(sessionToken) })
  if (!session || session.status !== 'active' || session.enterpriseId !== enterpriseId) throw error('SESSION_INVALID', '企业登录状态无效。')
  if (session.expiresAt && new Date(session.expiresAt).getTime() <= Date.now()) throw error('SESSION_EXPIRED', '企业登录已过期。')
  const member = await one('enterprise_members', { enterpriseId, memberId: session.memberId, status: 'active' })
  if (!member || member.userId !== session.userId) throw error('MEMBER_FORBIDDEN', '当前企业成员无权访问颜色记录。')
  return { ownerId, enterpriseId, scope: 'enterprise' }
}

function normalizeColor(color = {}) {
  const hex = text(color.hex, 7).toUpperCase()
  if (!validHex(hex)) throw error('COLOR_HEX_INVALID', '颜色值无效。')
  const rgb = Array.isArray(color.rgb) ? color.rgb.slice(0, 3).map((value) => Math.max(0, Math.min(255, Math.round(Number(value) || 0)))) : []
  const lab = Array.isArray(color.lab) ? color.lab.slice(0, 3).map((value) => Number(value) || 0) : []
  if (rgb.length !== 3 || lab.length !== 3) throw error('COLOR_DATA_INVALID', '颜色数据不完整。')
  const sourceImageFileId = text(color.sourceImageFileId, 1200)
  if (sourceImageFileId && !sourceImageFileId.startsWith('cloud://')) throw error('COLOR_SOURCE_FILE_INVALID', '取色图片地址无效。')
  return {
    name: text(color.name, 60) || '自定义颜色',
    displayName: text(color.displayName, 60) || '自定义颜色',
    hex,
    rgb,
    lab,
    sourceType: text(color.sourceType || color.source, 60) || 'recent_color',
    sourceImageFileId
  }
}

async function listColors(data) {
  const scope = await resolveScope(data)
  const result = await db.collection(COLLECTION)
    .where(scope)
    .orderBy('usedAt', 'desc')
    .limit(MAX_COLORS)
    .get()
  return ok({ colors: (result.data || []).map((item) => ({
    colorId: item.colorId,
    name: item.name,
    displayName: item.displayName || item.name || '自定义颜色',
    hex: item.hex,
    rgb: item.rgb,
    lab: item.lab,
    sourceType: item.sourceType,
    sourceImageFileId: item.sourceImageFileId || '',
    usedAt: item.usedAt,
    usedCount: item.usedCount
  })) })
}

async function saveColor(data) {
  const scope = await resolveScope(data)
  const color = normalizeColor(data.color)
  const existing = await one(COLLECTION, { ...scope, hex: color.hex })
  const timestamp = nowIso()
  if (existing) {
    await db.collection(COLLECTION).doc(existing._id).update({
      data: { ...color, usedAt: timestamp, updatedAt: timestamp, usedCount: Math.max(1, Number(existing.usedCount) || 0) + 1 }
    })
  } else {
    await db.collection(COLLECTION).add({
      data: {
        ...scope,
        ...color,
        colorId: `recent_${color.hex.slice(1).toLowerCase()}`,
        usedAt: timestamp,
        usedCount: 1,
        createdAt: timestamp,
        updatedAt: timestamp
      }
    })
  }
  const overflow = await db.collection(COLLECTION).where(scope).orderBy('usedAt', 'desc').skip(MAX_COLORS).limit(100).get()
  for (const item of overflow.data || []) await db.collection(COLLECTION).doc(item._id).remove()
  return listColors(data)
}

async function removeColor(data) {
  const scope = await resolveScope(data)
  const hex = text(data.hex, 7).toUpperCase()
  if (!validHex(hex)) throw error('COLOR_HEX_INVALID', '颜色值无效。')
  await db.collection(COLLECTION).where({ ...scope, hex }).remove()
  return listColors(data)
}

async function clearColors(data) {
  const scope = await resolveScope(data)
  await db.collection(COLLECTION).where(scope).remove()
  return ok({ colors: [] })
}

exports.main = async (event = {}) => {
  const action = text(event.action, 40)
  const data = event.data && typeof event.data === 'object' ? event.data : {}
  try {
    if (action === 'list') return listColors(data)
    if (action === 'save') return saveColor(data)
    if (action === 'remove') return removeColor(data)
    if (action === 'clear') return clearColors(data)
    return fail('ACTION_NOT_SUPPORTED', '不支持的颜色记录操作。')
  } catch (caught) {
    console.warn('[color-preference]', { action, success: false, errorCode: caught.errorCode || 'COLOR_PREFERENCE_ERROR' })
    return fail(caught.errorCode || 'COLOR_PREFERENCE_ERROR', caught.message || '颜色记录操作失败。')
  }
}
