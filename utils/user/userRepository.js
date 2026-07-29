import { getMemberPlanById } from '../member/memberPlan'
import { getOrders } from '../order/orderRepository'
import { getProjects } from '../project/projectRepository'

const USER_STORAGE_KEY = 'diebiandesign_current_user'
const WECHAT_IDENTITY_STORAGE_KEY = 'diebiandesign_wechat_identity'
const LEGACY_WECHAT_IDENTITY_KEYS = ['wechat_user_identity', 'wechatUserIdentity']

const MOCK_USER = Object.freeze({
  userId: 'user_demo_001',
  openId: 'mock_openid_diebiandesign_001',
  unionId: '',
  nickname: '蝶变 AI 用户',
  avatarUrl: '/static/logo.png',
  memberLevel: 'professional',
  points: 860,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-07-01T00:00:00.000Z'
})

function normalizeUser(user = {}) {
  const now = new Date().toISOString()
  return {
    userId: String(user.userId || MOCK_USER.userId),
    openId: String(user.openId || MOCK_USER.openId),
    unionId: String(user.unionId || ''),
    nickname: String(user.nickname || MOCK_USER.nickname),
    avatarUrl: String(user.avatarUrl || MOCK_USER.avatarUrl),
    memberLevel: String(user.memberLevel || MOCK_USER.memberLevel),
    points: Math.max(0, Number(user.points) || 0),
    createdAt: user.createdAt || now,
    updatedAt: user.updatedAt || user.createdAt || now
  }
}

function isRealOpenId(openId = '') {
  const value = String(openId || '').trim()
  return Boolean(value && !value.startsWith('mock_'))
}

function normalizeWechatIdentity(identity = {}) {
  const openId = identity.openId || identity.openid || identity.open_id || ''
  return {
    openId: String(openId || '').trim(),
    unionId: String(identity.unionId || identity.unionid || identity.union_id || '').trim(),
    nickname: String(identity.nickname || identity.nickName || '').trim(),
    avatarUrl: String(identity.avatarUrl || identity.avatar || '').trim()
  }
}

function readStorageValue(key) {
  try {
    return uni.getStorageSync(key)
  } catch (error) {
    return null
  }
}

function readRuntimeWechatIdentity() {
  try {
    if (typeof getApp !== 'function') return null
    const app = getApp()
    const globalData = (app && app.globalData) || {}
    return {
      ...(globalData.userInfo || {}),
      ...(globalData.userIdentity || {}),
      ...(globalData.wechatIdentity || {}),
      openId: globalData.openId || globalData.openid || (globalData.wechatIdentity || {}).openId || (globalData.userIdentity || {}).openId || (globalData.userInfo || {}).openId,
      unionId: globalData.unionId || globalData.unionid || (globalData.wechatIdentity || {}).unionId || (globalData.userIdentity || {}).unionId || (globalData.userInfo || {}).unionId
    }
  } catch (error) {
    return null
  }
}

function readWechatIdentity() {
  const candidates = [
    readStorageValue(WECHAT_IDENTITY_STORAGE_KEY),
    ...LEGACY_WECHAT_IDENTITY_KEYS.map(readStorageValue),
    readRuntimeWechatIdentity()
  ]
  for (const candidate of candidates) {
    const identity = normalizeWechatIdentity(candidate || {})
    if (isRealOpenId(identity.openId)) return identity
  }
  return null
}

function writeUser(user) {
  try {
    uni.setStorageSync(USER_STORAGE_KEY, user)
  } catch (error) {
    // Storage may be unavailable during non-client checks; the normalized user is still returned.
  }
  return user
}

function readUser() {
  try {
    const user = uni.getStorageSync(USER_STORAGE_KEY)
    if (user && typeof user === 'object' && user.userId) return normalizeUser(user)
  } catch (error) {
    return normalizeUser(MOCK_USER)
  }
  const user = normalizeUser(MOCK_USER)
  return writeUser(user)
}

function getUserProjects(userId = '') {
  return getProjects().filter((project) => {
    const memberIds = Array.isArray(project.memberIds) ? project.memberIds : []
    return !project.userId || project.userId === userId || project.ownerId === userId || memberIds.includes(userId)
  })
}

export function getCurrentUser(overrides = {}) {
  const currentUser = readUser()
  const wechatIdentity = readWechatIdentity()
  let identityUser = currentUser
  if (wechatIdentity) {
    identityUser = normalizeUser({
      ...currentUser,
      openId: wechatIdentity.openId,
      unionId: wechatIdentity.unionId || currentUser.unionId,
      nickname: wechatIdentity.nickname || currentUser.nickname,
      avatarUrl: wechatIdentity.avatarUrl || currentUser.avatarUrl,
      updatedAt: new Date().toISOString()
    })
    writeUser(identityUser)
  }
  const nextOverrides = Object.keys(overrides).reduce((result, key) => {
    const value = overrides[key]
    if (value !== undefined && value !== null && value !== '') result[key] = value
    return result
  }, {})
  const user = normalizeUser({ ...identityUser, ...nextOverrides, updatedAt: identityUser.updatedAt })
  console.log('[user:identity]', {
    hasRealIdentity: isRealOpenId(user.openId)
  })
  return user
}

export function saveWechatIdentity(identity = {}) {
  const normalizedIdentity = normalizeWechatIdentity(identity)
  if (!isRealOpenId(normalizedIdentity.openId)) return getCurrentUser()
  try {
    uni.setStorageSync(WECHAT_IDENTITY_STORAGE_KEY, normalizedIdentity)
  } catch (error) {
    // Keep the current local user available even when identity persistence fails.
  }
  return getCurrentUser()
}

export function getUserAccountCenter(options = {}) {
  const user = getCurrentUser({
    memberLevel: options.memberLevel,
    points: options.points
  })
  const memberPlan = getMemberPlanById(user.memberLevel)
  const orders = getOrders().filter((order) => order.userId === user.userId)
  const projects = getUserProjects(user.userId)
  console.log('[user:center]', {
    hasRealIdentity: isRealOpenId(user.openId),
    hasMemberPlan: !!memberPlan,
    orderCount: orders.length,
    projectCount: projects.length
  })
  return {
    user,
    memberPlan,
    orders,
    projects
  }
}
