<template>
  <view class="enterprise-page">
    <!-- #ifdef H5 -->
    <view class="shell">
      <view class="sidebar">
        <view class="brand">
          <text class="brand-title">{{ labels.brandTitle }}</text>
          <text class="brand-desc">{{ labels.brandDesc }}</text>
        </view>
        <view class="menu">
          <view v-for="item in menu" :key="item.key" :class="['menu-item', item.key === 'roles' ? 'active' : '']" @click="goTo(item)">
            <text class="menu-icon">{{ item.icon }}</text>
            <text>{{ item.label }}</text>
          </view>
        </view>
      </view>

      <view class="main">
        <view class="topbar">
          <view>
            <text class="page-title">{{ labels.pageTitle }}</text>
            <text class="page-desc">{{ labels.pageDesc }}</text>
          </view>
          <button v-if="canManageRoles" class="primary-btn" :disabled="!selectedRole" @click="saveSelectedRole">{{ labels.save }}</button>
        </view>

        <view v-if="!guard.allowed" class="state-card denied">{{ guardMessage }}</view>
        <view v-else-if="pageState === 'loading'" class="state-card">{{ labels.loading }}</view>
        <view v-else-if="pageState === 'error'" class="state-card denied">{{ message }}</view>

        <view v-else class="role-workspace">
          <view class="role-list">
            <view
              v-for="role in roles"
              :key="role.role"
              :class="['role-item', selectedRole === role.role ? 'active' : '']"
              @click="selectRole(role)"
            >
              <text class="role-name">{{ role.label }}</text>
              <text class="role-code">{{ role.role }}</text>
              <text class="role-count">{{ role.permissions.length }} {{ labels.permissionCount }}</text>
            </view>
          </view>

          <view class="permission-panel">
            <view class="panel-head">
              <view>
                <text class="panel-title">{{ selectedRoleLabel }}</text>
                <text class="panel-desc">{{ labels.editorDesc }}</text>
              </view>
            </view>

            <view v-for="group in permissionGroups" :key="group.group" class="permission-group">
              <text class="group-title">{{ group.group }}</text>
              <view class="permission-grid">
                <view
                  v-for="permission in group.permissions"
                  :key="permission.key"
                  :class="['permission-item', selectedPermissions.includes(permission.key) ? 'checked' : '']"
                  @click="togglePermission(permission.key)"
                >
                  <text class="check-mark">{{ selectedPermissions.includes(permission.key) ? labels.checked : labels.unchecked }}</text>
                  <text>{{ permission.label }}</text>
                </view>
              </view>
            </view>

            <text v-if="message" class="message">{{ message }}</text>
          </view>
        </view>
      </view>
    </view>
    <!-- #endif -->
    <!-- #ifndef H5 -->
    <view class="platform-tip">{{ labels.h5Only }}</view>
    <!-- #endif -->
  </view>
</template>

<script>
import { getEnterpriseGuardMessage, requirePermission } from '../../utils/enterprise-web/enterpriseWebGuard.js'
import { getEnterpriseWebMenu } from '../../utils/enterprise-web/enterpriseWebMenu.js'
import { PERMISSION_KEYS, getPermissionGroups } from '../../utils/permission/permissionCatalog.js'
import { fetchRolePermissionRecords, listRolePermissionRecords, saveRolePermissions } from '../../utils/permission/rolePermissionService.js'

const LABELS = Object.freeze({
  brandTitle: '\u8776\u53d8',
  brandDesc: '\u670d\u88c5\u4f01\u4e1a\u5de5\u4f5c\u53f0',
  pageTitle: '\u89d2\u8272\u6743\u9650',
  pageDesc: '\u4e3a\u5f53\u524d\u4f01\u4e1a\u914d\u7f6e\u89d2\u8272\u53ef\u7528\u7684\u64cd\u4f5c\u6743\u9650\u3002',
  save: '\u4fdd\u5b58\u6743\u9650',
  editorDesc: '\u6743\u9650\u4fee\u6539\u4ec5\u5bf9\u5f53\u524d\u4f01\u4e1a\u751f\u6548\u3002',
  permissionCount: '\u9879\u6743\u9650',
  checked: '\u2611',
  unchecked: '\u2610',
  saveSuccess: '\u6743\u9650\u5df2\u4fdd\u5b58',
  saveFailed: '\u6743\u9650\u4fdd\u5b58\u5931\u8d25',
  conflict: '\u6743\u9650\u914d\u7f6e\u5df2\u88ab\u5176\u4ed6\u6210\u5458\u66f4\u65b0\uff0c\u8bf7\u5237\u65b0\u540e\u91cd\u8bd5\u3002',
  loading: '\u6743\u9650\u6570\u636e\u52a0\u8f7d\u4e2d...',
  loadFailed: '\u6743\u9650\u6570\u636e\u52a0\u8f7d\u5931\u8d25',
  readOnly: '\u5f53\u524d\u89d2\u8272\u4ec5\u53ef\u67e5\u770b\uff0c\u4e0d\u53ef\u4fee\u6539\u6743\u9650\u3002',
  h5Only: '\u4f01\u4e1a\u7f51\u9875\u7248\u4ec5\u5728 H5 \u5e73\u53f0\u663e\u793a\u3002'
})

export default {
  data() {
    return {
      labels: LABELS,
      menu: getEnterpriseWebMenu(),
      guard: requirePermission(PERMISSION_KEYS.ROLE_VIEW),
      manageGuard: requirePermission(PERMISSION_KEYS.ROLE_MANAGE),
      roles: [],
      selectedRole: '',
      selectedPermissions: [],
      selectedVersion: 0,
      pageState: 'loading',
      permissionGroups: getPermissionGroups(),
      message: ''
    }
  },
  computed: {
    guardMessage() {
      return getEnterpriseGuardMessage(this.guard.reason)
    },
    selectedRoleLabel() {
      const role = this.roles.find((item) => item.role === this.selectedRole)
      return role ? role.label : ''
    },
    canManageRoles() {
      return this.manageGuard && this.manageGuard.allowed
    }
  },
  onShow() {
    this.refresh()
  },
  methods: {
    async refresh() {
      this.guard = requirePermission(PERMISSION_KEYS.ROLE_VIEW)
      this.manageGuard = requirePermission(PERMISSION_KEYS.ROLE_MANAGE)
      if (!this.guard.allowed) {
        this.pageState = 'forbidden'
        return
      }
      this.pageState = 'loading'
      const result = await fetchRolePermissionRecords()
      if (!result || !result.success) {
        this.pageState = 'error'
        this.message = result?.message || this.labels.loadFailed
        this.roles = listRolePermissionRecords()
        return
      }
      this.roles = result.records
      if (!this.selectedRole && this.roles.length) this.selectRole(this.roles[0])
      if (this.selectedRole) {
        const current = this.roles.find((item) => item.role === this.selectedRole)
        this.selectedPermissions = current ? [...current.permissions] : []
        this.selectedVersion = current ? Number(current.version || 0) : 0
      }
      if (!this.canManageRoles) this.message = this.labels.readOnly
      this.pageState = 'ready'
    },
    goTo(item = {}) {
      if (item.route && item.key !== 'roles') uni.navigateTo({ url: item.route })
    },
    selectRole(role = {}) {
      this.selectedRole = role.role || ''
      this.selectedPermissions = Array.isArray(role.permissions) ? [...role.permissions] : []
      this.selectedVersion = Number(role.version || 0)
      this.message = ''
      if (!this.canManageRoles) this.message = this.labels.readOnly
    },
    togglePermission(permission = '') {
      if (!this.canManageRoles) return
      if (!permission) return
      if (this.selectedPermissions.includes(permission)) {
        this.selectedPermissions = this.selectedPermissions.filter((item) => item !== permission)
        return
      }
      this.selectedPermissions = [...this.selectedPermissions, permission]
    },
    async saveSelectedRole() {
      if (!this.canManageRoles) return
      const result = await saveRolePermissions({
        role: this.selectedRole,
        permissions: this.selectedPermissions,
        version: this.selectedVersion
      })
      if (!result || !result.success) {
        this.message = result?.errorCode === 'PERMISSION_VERSION_CONFLICT' ? this.labels.conflict : (result?.message || this.labels.saveFailed)
        return
      }
      this.message = this.labels.saveSuccess
      await this.refresh()
    }
  }
}
</script>

<style scoped>
.enterprise-page { min-height: 100vh; background: #f4f6fb; color: #172033; }
.shell { display: flex; min-height: 100vh; }
.sidebar { position: fixed; left: 0; top: 0; bottom: 0; width: 216px; padding: 24px 16px; background: #101828; color: #fff; box-sizing: border-box; }
.brand { margin-bottom: 28px; }
.brand-title { display: block; font-size: 22px; font-weight: 800; }
.brand-desc { display: block; margin-top: 6px; color: #a9b4ca; font-size: 12px; }
.menu-item { display: flex; align-items: center; gap: 10px; padding: 12px; border-radius: 10px; color: #cbd5e1; font-size: 14px; cursor: pointer; }
.menu-item.active, .menu-item:hover { background: #eef2ff; color: #4f46e5; }
.menu-icon { width: 24px; height: 24px; border-radius: 8px; background: rgba(255,255,255,0.1); text-align: center; line-height: 24px; font-size: 12px; }
.main { flex: 1; margin-left: 216px; padding: 24px; box-sizing: border-box; }
.topbar,.role-list,.permission-panel,.state-card { background: #fff; border: 1px solid #e5e7eb; border-radius: 16px; box-shadow: 0 18px 40px rgba(15,23,42,0.05); }
.topbar { display: flex; justify-content: space-between; gap: 16px; padding: 20px 24px; margin-bottom: 18px; }
.page-title { display: block; font-size: 24px; font-weight: 800; }
.page-desc,.panel-desc,.role-code,.role-count,.message { display: block; margin-top: 6px; color: #64748b; font-size: 13px; }
.primary-btn { height: 38px; line-height: 38px; border-radius: 10px; background: #4f46e5; color: #fff; font-size: 13px; }
.primary-btn[disabled] { background: #cbd5e1; color: #64748b; }
.role-workspace { display: grid; grid-template-columns: 260px minmax(0, 1fr); gap: 16px; }
.role-list { padding: 12px; }
.role-item { padding: 14px; border-radius: 12px; cursor: pointer; }
.role-item.active,.role-item:hover { background: #eef2ff; }
.role-name { display: block; color: #111827; font-size: 16px; font-weight: 800; }
.permission-panel { padding: 20px; }
.panel-title { display: block; color: #111827; font-size: 20px; font-weight: 800; }
.permission-group { margin-top: 22px; }
.group-title { display: block; margin-bottom: 10px; color: #111827; font-size: 15px; font-weight: 800; }
.permission-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
.permission-item { display: flex; align-items: center; gap: 8px; padding: 12px; border-radius: 12px; border: 1px solid #e2e8f0; background: #f8fafc; color: #334155; cursor: pointer; }
.permission-item.checked { border-color: #c7d2fe; background: #eef2ff; color: #4f46e5; }
.check-mark { width: 22px; font-size: 15px; }
.denied,.platform-tip { padding: 24px; color: #64748b; }
.denied { color: #b42318; }
@media (max-width: 900px) {
  .shell { display: block; }
  .sidebar { position: static; width: auto; }
  .main { margin-left: 0; padding: 16px; }
  .topbar { display: block; }
  .role-workspace,.permission-grid { grid-template-columns: 1fr; }
}
</style>
