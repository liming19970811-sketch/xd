const ADMIN_ROLE_STORAGE_KEY = 'diebiandesign_admin_current_role'

export const ADMIN_ROLES = Object.freeze({
  ADMIN: 'admin',
  DESIGNER: 'designer',
  OPERATOR: 'operator'
})

export const ROLE_PERMISSION_MAP = Object.freeze({
  [ADMIN_ROLES.ADMIN]: Object.freeze([
    'project:view',
    'project:update',
    'delivery:update',
    'customer:view'
  ]),
  [ADMIN_ROLES.DESIGNER]: Object.freeze([
    'project:view',
    'asset:view',
    'task:view'
  ]),
  [ADMIN_ROLES.OPERATOR]: Object.freeze([
    'customer:view',
    'project:view',
    'delivery:view'
  ])
})

export const MOCK_ADMIN_USERS = Object.freeze([
  Object.freeze({
    userId: 'mock_admin_001',
    name: '系统管理员',
    role: ADMIN_ROLES.ADMIN,
    permissions: ROLE_PERMISSION_MAP[ADMIN_ROLES.ADMIN],
    createdAt: '2026-01-01T00:00:00.000Z'
  }),
  Object.freeze({
    userId: 'mock_designer_001',
    name: '设计师',
    role: ADMIN_ROLES.DESIGNER,
    permissions: ROLE_PERMISSION_MAP[ADMIN_ROLES.DESIGNER],
    createdAt: '2026-01-01T00:00:00.000Z'
  }),
  Object.freeze({
    userId: 'mock_operator_001',
    name: '运营人员',
    role: ADMIN_ROLES.OPERATOR,
    permissions: ROLE_PERMISSION_MAP[ADMIN_ROLES.OPERATOR],
    createdAt: '2026-01-01T00:00:00.000Z'
  })
])

const ROLE_LABELS = Object.freeze({
  [ADMIN_ROLES.ADMIN]: '管理员',
  [ADMIN_ROLES.DESIGNER]: '设计师',
  [ADMIN_ROLES.OPERATOR]: '运营'
})

function cloneUser(user) {
  return {
    ...user,
    permissions: [...(user.permissions || [])]
  }
}

export function getMockAdminUsers() {
  return MOCK_ADMIN_USERS.map(cloneUser)
}

export function getCurrentAdminUser() {
  let role = ADMIN_ROLES.ADMIN
  try {
    role = uni.getStorageSync(ADMIN_ROLE_STORAGE_KEY) || role
  } catch (error) {
    role = ADMIN_ROLES.ADMIN
  }
  const user = MOCK_ADMIN_USERS.find((item) => item.role === role) || MOCK_ADMIN_USERS[0]
  return cloneUser(user)
}

export function setCurrentAdminRole(role = '') {
  const user = MOCK_ADMIN_USERS.find((item) => item.role === role)
  if (!user) throw new Error('无效的后台角色')
  uni.setStorageSync(ADMIN_ROLE_STORAGE_KEY, user.role)
  return cloneUser(user)
}

export function hasAdminPermission(user = {}, permission = '') {
  if (!permission) return false
  if (user.role === ADMIN_ROLES.ADMIN) return true
  return Array.isArray(user.permissions) && user.permissions.includes(permission)
}

export function assertAdminPermission(user = {}, permission = '') {
  if (!hasAdminPermission(user, permission)) {
    throw new Error(`当前角色无权限：${permission}`)
  }
  return true
}

export function getAdminRoleLabel(role = '') {
  return ROLE_LABELS[role] || '未知角色'
}
