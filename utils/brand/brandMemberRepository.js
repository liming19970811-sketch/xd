const BRAND_MEMBER_STORAGE_KEY = 'diebiandesign_brand_members'

export const BRAND_MEMBER_ROLES = Object.freeze({
  OWNER: 'owner',
  DESIGNER: 'designer',
  OPERATOR: 'operator',
  VIEWER: 'viewer'
})

export const BRAND_PERMISSIONS = Object.freeze({
  BRAND_VIEW: 'brand:view',
  BRAND_EDIT: 'brand:edit',
  TEMPLATE_EDIT: 'template:edit',
  PROJECT_VIEW: 'project:view',
  PROJECT_EDIT: 'project:edit',
  DELIVERY_VIEW: 'delivery:view'
})

export const BRAND_ROLE_PERMISSIONS = Object.freeze({
  owner: Object.freeze(Object.values(BRAND_PERMISSIONS)),
  designer: Object.freeze([
    BRAND_PERMISSIONS.BRAND_VIEW,
    BRAND_PERMISSIONS.TEMPLATE_EDIT,
    BRAND_PERMISSIONS.PROJECT_VIEW
  ]),
  operator: Object.freeze([
    BRAND_PERMISSIONS.BRAND_VIEW,
    BRAND_PERMISSIONS.PROJECT_VIEW,
    BRAND_PERMISSIONS.DELIVERY_VIEW
  ]),
  viewer: Object.freeze([BRAND_PERMISSIONS.BRAND_VIEW])
})

function nowIso() {
  return new Date().toISOString()
}

function normalizeRole(role = '') {
  return BRAND_ROLE_PERMISSIONS[role] ? role : BRAND_MEMBER_ROLES.VIEWER
}

function normalizeMember(member = {}) {
  const role = normalizeRole(member.role)
  return {
    memberId: member.memberId || `brand_member_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    brandId: String(member.brandId || ''),
    userId: String(member.userId || ''),
    nickname: String(member.nickname || '品牌成员').trim() || '品牌成员',
    role,
    permissions: [...BRAND_ROLE_PERMISSIONS[role]],
    createdAt: member.createdAt || nowIso()
  }
}

function readMembers() {
  try {
    if (typeof uni === 'undefined' || !uni.getStorageSync) return []
    const value = uni.getStorageSync(BRAND_MEMBER_STORAGE_KEY)
    return Array.isArray(value) ? value.map(normalizeMember) : []
  } catch (error) {
    return []
  }
}

function writeMembers(members = []) {
  try {
    if (typeof uni !== 'undefined' && uni.setStorageSync) {
      uni.setStorageSync(BRAND_MEMBER_STORAGE_KEY, members.map(normalizeMember))
    }
  } catch (error) {}
  return members
}

function logBrandMember(member = {}) {
  console.log('[brand:member]', {
    brandId: member.brandId || '',
    userId: member.userId || '',
    role: member.role || ''
  })
}

export function getBrandMembers(brandId = '') {
  return readMembers()
    .filter((member) => !brandId || member.brandId === brandId)
    .sort((left, right) => String(left.createdAt).localeCompare(String(right.createdAt)))
}

export function getBrandMemberByUser(brandId = '', userId = '') {
  return getBrandMembers(brandId).find((member) => member.userId === userId) || null
}

export function createBrandMember(member = {}) {
  if (!member.brandId || !member.userId) return null
  const current = getBrandMemberByUser(member.brandId, member.userId)
  if (current) return updateBrandMember(current.memberId, member)
  const nextMember = normalizeMember(member)
  writeMembers([...readMembers(), nextMember])
  logBrandMember(nextMember)
  return nextMember
}

export function updateBrandMember(memberId = '', patch = {}) {
  const members = readMembers()
  const current = members.find((member) => member.memberId === memberId)
  if (!current) return null
  const nextRole = normalizeRole(patch.role === undefined ? current.role : patch.role)
  const owners = members.filter((member) => member.brandId === current.brandId && member.role === BRAND_MEMBER_ROLES.OWNER)
  if (current.role === BRAND_MEMBER_ROLES.OWNER && nextRole !== BRAND_MEMBER_ROLES.OWNER && owners.length <= 1) {
    return null
  }
  const nextMember = normalizeMember({ ...current, ...patch, memberId: current.memberId, createdAt: current.createdAt })
  writeMembers(members.map((member) => member.memberId === memberId ? nextMember : member))
  logBrandMember(nextMember)
  return nextMember
}

export function deleteBrandMember(memberId = '') {
  const members = readMembers()
  const current = members.find((member) => member.memberId === memberId)
  if (!current) return false
  const owners = members.filter((member) => member.brandId === current.brandId && member.role === BRAND_MEMBER_ROLES.OWNER)
  if (current.role === BRAND_MEMBER_ROLES.OWNER && owners.length <= 1) return false
  writeMembers(members.filter((member) => member.memberId !== memberId))
  logBrandMember(current)
  return true
}

export function ensureBrandOwner(brandId = '', user = {}) {
  if (!brandId || !user.userId) return null
  const owner = getBrandMembers(brandId).find((member) => member.role === BRAND_MEMBER_ROLES.OWNER)
  if (owner) return owner
  return createBrandMember({
    brandId,
    userId: user.userId,
    nickname: user.nickname || '品牌所有者',
    role: BRAND_MEMBER_ROLES.OWNER
  })
}

export function checkBrandPermission(brandId = '', userId = '', permission = '') {
  const member = getBrandMemberByUser(brandId, userId)
  return Boolean(member && member.permissions.includes(permission))
}

export function getBrandRoleLabel(role = '') {
  const labels = {
    owner: '所有者',
    designer: '设计师',
    operator: '运营',
    viewer: '访客'
  }
  return labels[role] || '访客'
}
