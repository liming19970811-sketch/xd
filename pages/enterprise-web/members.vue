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
          <view v-for="item in menu" :key="item.key" :class="['menu-item', item.key === 'members' ? 'active' : '']" @click="goTo(item)">
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
          <view class="top-actions">
            <button v-if="canInviteMembers" class="primary-btn" @click="openInviteModal">{{ labels.inviteMember }}</button>
          </view>
        </view>
        <view v-if="!guard.allowed" class="state-card denied">{{ guardMessage }}</view>
        <view v-else-if="pageState === 'loading'" class="state-card">{{ labels.loading }}</view>
        <view v-else-if="pageState === 'error'" class="state-card denied">{{ errorMessage }}</view>
        <view v-else class="table-card">
          <view class="table-head row">
            <text>{{ labels.name }}</text>
            <text>{{ labels.role }}</text>
            <text>{{ labels.status }}</text>
            <text>{{ labels.createdAt }}</text>
            <text>{{ labels.actions }}</text>
          </view>
          <view v-if="members.length">
            <view v-for="member in members" :key="member.memberId" class="row data-row">
              <text>{{ member.name || member.userId }}</text>
              <picker :disabled="!canManageMembers" :range="roleNames" :data-member-id="member.memberId" @change="handleRoleChange">
                <view class="select-pill">{{ member.role || 'member' }}</view>
              </picker>
              <view><text class="status-tag">{{ getStatusText(member.status) }}</text></view>
              <text>{{ formatTime(member.createdAt) }}</text>
              <view v-if="canManageMembers" class="actions">
                <button class="mini-btn" @click="setStatus(member, 'active')">{{ labels.enable }}</button>
                <button class="mini-btn" @click="setStatus(member, 'disabled')">{{ labels.disable }}</button>
              </view>
              <text v-else>--</text>
            </view>
          </view>
          <view v-else class="empty">{{ labels.empty }}</view>
        </view>

        <view v-if="guard.allowed && canManageMembers" class="table-card invite-card">
          <view class="section-title">{{ labels.invitesTitle }}</view>
          <view class="table-head invite-row">
            <text>{{ labels.targetAccount }}</text>
            <text>{{ labels.role }}</text>
            <text>{{ labels.status }}</text>
            <text>{{ labels.expiresAt }}</text>
            <text>{{ labels.actions }}</text>
          </view>
          <view v-if="invites.length">
            <view v-for="invite in invites" :key="invite.inviteId" class="invite-row data-row">
              <text>{{ maskAccount(invite.targetAccount) }}</text>
              <text>{{ invite.role }}</text>
              <text><text class="status-tag">{{ getInviteStatusText(invite.status) }}</text></text>
              <text>{{ formatTime(invite.expiresAt) }}</text>
              <view class="actions">
                <button class="mini-btn danger" :disabled="invite.status !== 'pending'" @click="cancel(invite)">{{ labels.cancelInvite }}</button>
              </view>
            </view>
          </view>
          <view v-else class="empty">{{ labels.emptyInvites }}</view>
        </view>

        <view v-if="showInviteModal" class="modal-mask" @click="closeInviteModal">
          <view class="invite-modal" @click.stop>
            <text class="modal-title">{{ labels.inviteMember }}</text>
            <view class="field">
              <text>{{ labels.targetAccount }}</text>
              <input v-model="inviteForm.targetAccount" :placeholder="labels.targetAccountPlaceholder" />
            </view>
            <view class="field">
              <text>{{ labels.role }}</text>
              <picker :range="roleNames" @change="handleInviteRoleChange">
                <view class="select-pill">{{ inviteForm.role }}</view>
              </picker>
            </view>
            <text v-if="inviteMessage" class="message">{{ inviteMessage }}</text>
            <view class="modal-actions">
              <button class="secondary-btn" @click="closeInviteModal">{{ labels.cancel }}</button>
              <button class="primary-btn" @click="submitInvite">{{ labels.createInvite }}</button>
            </view>
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
import { getMembers, updateMemberRole, updateMemberStatus } from '../../utils/member/memberService.js'
import { cancelInvite, createInvite, getInvites } from '../../utils/member/memberInviteService.js'
import { getEnterpriseGuardMessage, requirePermission } from '../../utils/enterprise-web/enterpriseWebGuard.js'
import { getEnterpriseWebMenu } from '../../utils/enterprise-web/enterpriseWebMenu.js'
import { PERMISSION_KEYS } from '../../utils/permission/permissionCatalog.js'
import { fetchRolePermissionRecords, getDefaultRoles } from '../../utils/permission/rolePermissionService.js'

const LABELS = Object.freeze({
  brandTitle: '\u8776\u53d8',
  brandDesc: '\u670d\u88c5\u4f01\u4e1a\u5de5\u4f5c\u53f0',
  pageTitle: '\u6210\u5458\u7ba1\u7406',
  pageDesc: '\u6210\u5458\u5217\u8868\u6765\u81ea\u5f53\u524d\u4f01\u4e1a\u7684 enterprise_members \u6570\u636e\u3002',
  inviteMember: '\u9080\u8bf7\u6210\u5458',
  name: '\u6210\u5458\u540d\u79f0',
  role: '\u89d2\u8272',
  status: '\u72b6\u6001',
  createdAt: '\u52a0\u5165\u65f6\u95f4',
  actions: '\u64cd\u4f5c',
  invitesTitle: '\u6210\u5458\u9080\u8bf7',
  targetAccount: '\u624b\u673a\u53f7/\u90ae\u7bb1\u8d26\u53f7',
  targetAccountPlaceholder: '\u8bf7\u8f93\u5165\u624b\u673a\u53f7\u6216\u90ae\u7bb1',
  expiresAt: '\u8fc7\u671f\u65f6\u95f4',
  createInvite: '\u521b\u5efa\u9080\u8bf7',
  cancelInvite: '\u53d6\u6d88\u9080\u8bf7',
  cancel: '\u53d6\u6d88',
  enable: '\u542f\u7528',
  disable: '\u7981\u7528',
  remove: '\u5220\u9664',
  empty: '\u6682\u65e0\u6210\u5458',
  emptyInvites: '\u6682\u65e0\u9080\u8bf7',
  h5Only: '\u4f01\u4e1a\u7f51\u9875\u7248\u4ec5\u5728 H5 \u5e73\u53f0\u663e\u793a\u3002',
  keepAdmin: '\u81f3\u5c11\u4fdd\u7559\u4e00\u4e2a\u6709\u6548\u7ba1\u7406\u5458',
  inviteCreated: '\u9080\u8bf7\u5df2\u521b\u5efa',
  inviteFailed: '\u9080\u8bf7\u521b\u5efa\u5931\u8d25',
  inviteCancelled: '\u9080\u8bf7\u5df2\u53d6\u6d88',
  invalidAccount: '\u8bf7\u8f93\u5165\u6b63\u786e\u7684\u624b\u673a\u53f7\u6216\u90ae\u7bb1'
  ,
  loading: '\u6210\u5458\u6570\u636e\u52a0\u8f7d\u4e2d...',
  loadFailed: '\u6210\u5458\u6570\u636e\u52a0\u8f7d\u5931\u8d25',
  updateFailed: '\u6210\u5458\u66f4\u65b0\u5931\u8d25'
})

export default {
  data() {
    return {
      labels: LABELS,
      menu: getEnterpriseWebMenu(),
      guard: requirePermission(PERMISSION_KEYS.MEMBER_VIEW),
      manageGuard: requirePermission(PERMISSION_KEYS.MEMBER_MANAGE),
      pageState: 'loading',
      errorMessage: '',
      members: [],
      roles: [],
      invites: [],
      showInviteModal: false,
      inviteMessage: '',
      inviteForm: {
        targetAccount: '',
        role: 'member'
      }
    }
  },
  computed: {
    guardMessage() {
      return getEnterpriseGuardMessage(this.guard.reason)
    },
    roleNames() {
      const roles = this.roles.map((item) => item.roleName || item.role).filter(Boolean)
      return roles.length ? roles : ['admin', 'member']
    },
    canInviteMembers() {
      return this.canManageMembers
    },
    canManageMembers() {
      return this.manageGuard && this.manageGuard.allowed
    }
  },
  onShow() {
    this.refresh()
  },
  methods: {
    async refresh() {
      this.guard = requirePermission(PERMISSION_KEYS.MEMBER_VIEW)
      this.manageGuard = requirePermission(PERMISSION_KEYS.MEMBER_MANAGE)
      if (!this.guard.allowed) {
        this.pageState = 'forbidden'
        return
      }
      this.pageState = 'loading'
      this.errorMessage = ''
      try {
        const rolesResult = await fetchRolePermissionRecords()
        this.roles = rolesResult && rolesResult.success ? rolesResult.records : getDefaultRoles()
        this.members = await getMembers()
        this.invites = this.canManageMembers ? await getInvites() : []
        this.pageState = 'ready'
      } catch (error) {
        this.pageState = 'error'
        this.errorMessage = error && error.message ? error.message : this.labels.loadFailed
      }
    },
    goTo(item = {}) {
      if (item.route && item.key !== 'members') uni.navigateTo({ url: item.route })
    },
    openInviteModal() {
      if (!this.canManageMembers) return
      this.inviteMessage = ''
      this.inviteForm = {
        targetAccount: '',
        role: this.roleNames.includes('member') ? 'member' : this.roleNames[0]
      }
      this.showInviteModal = true
    },
    closeInviteModal() {
      this.showInviteModal = false
      this.inviteMessage = ''
    },
    handleInviteRoleChange(event = {}) {
      this.inviteForm.role = this.roleNames[Number(event.detail.value) || 0] || 'member'
    },
    async submitInvite() {
      const result = await createInvite({
        targetAccount: this.inviteForm.targetAccount,
        role: this.inviteForm.role
      })
      if (!result || !result.success) {
        this.inviteMessage = result && result.errorCode === 'target_account_invalid' ? this.labels.invalidAccount : this.labels.inviteFailed
        return
      }
      uni.showToast({ title: this.labels.inviteCreated, icon: 'none' })
      this.closeInviteModal()
      await this.refresh()
    },
    async cancel(invite = {}) {
      const result = await cancelInvite(invite.inviteId)
      if (!result || !result.success) return
      uni.showToast({ title: this.labels.inviteCancelled, icon: 'none' })
      await this.refresh()
    },
    async handleRoleChange(event = {}) {
      if (!this.canManageMembers) return
      const memberId = event.currentTarget && event.currentTarget.dataset ? event.currentTarget.dataset.memberId : ''
      const member = this.members.find((item) => item.memberId === memberId)
      const role = this.roleNames[Number(event.detail.value) || 0]
      if (!member || !role) return
      const result = await updateMemberRole(member.memberId, role)
      if (!result || result.success === false) {
        uni.showToast({ title: result?.message || this.labels.updateFailed, icon: 'none' })
        return
      }
      await this.refresh()
    },
    async setStatus(member = {}, status = '') {
      if (!this.canManageMembers) return
      const result = await updateMemberStatus(member.memberId, status)
      if (!result || result.success === false) {
        uni.showToast({ title: result?.message || this.labels.updateFailed, icon: 'none' })
        return
      }
      await this.refresh()
    },
    isAdmin(member = {}) {
      return ['admin', '\u7ba1\u7406\u5458'].includes(member.role)
    },
    countActiveAdmins() {
      return this.members.filter((item) => this.isAdmin(item) && item.status === 'active').length
    },
    getStatusText(status = '') {
      const labels = { pending: '\u5f85\u5ba1\u6838', active: '\u542f\u7528', disabled: '\u505c\u7528' }
      return labels[status] || '\u672a\u77e5'
    },
    getInviteStatusText(status = '') {
      const labels = { pending: '\u5f85\u63a5\u53d7', accepted: '\u5df2\u63a5\u53d7', expired: '\u5df2\u8fc7\u671f', cancelled: '\u5df2\u53d6\u6d88' }
      return labels[status] || '\u672a\u77e5'
    },
    maskAccount(value = '') {
      const account = String(value || '')
      if (account.includes('@')) {
        const parts = account.split('@')
        return `${parts[0].slice(0, 2)}***@${parts[1]}`
      }
      return account.length > 4 ? `${account.slice(0, 3)}****${account.slice(-2)}` : '****'
    },
    formatTime(value = '') {
      return value ? String(value).slice(0, 16).replace('T', ' ') : '--'
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
.topbar, .table-card, .state-card { background: #fff; border: 1px solid #e5e7eb; border-radius: 16px; box-shadow: 0 18px 40px rgba(15,23,42,0.05); }
.topbar { display: flex; justify-content: space-between; gap: 16px; padding: 20px 24px; margin-bottom: 18px; }
.page-title { display: block; font-size: 24px; font-weight: 800; }
.page-desc { display: block; margin-top: 6px; color: #64748b; font-size: 13px; }
.top-actions { display: flex; gap: 10px; flex-wrap: wrap; justify-content: flex-end; }
.primary-btn,.secondary-btn { height: 38px; line-height: 38px; border-radius: 10px; font-size: 13px; }
.primary-btn { background: #4f46e5; color: #fff; }
.secondary-btn { background: #eef2ff; color: #4f46e5; }
.row,.invite-row { display: grid; grid-template-columns: 1.2fr 1fr 0.8fr 1fr 1.5fr; gap: 12px; align-items: center; padding: 14px 18px; font-size: 13px; }
.table-head { color: #64748b; background: #f8fafc; font-weight: 700; }
.data-row { border-top: 1px solid #eef2f7; }
.status-tag, .select-pill { display: inline-block; padding: 4px 8px; border-radius: 999px; background: #eef2ff; color: #4f46e5; }
.actions { display: flex; gap: 8px; flex-wrap: wrap; }
.mini-btn { height: 30px; line-height: 30px; border-radius: 8px; background: #f1f5f9; color: #334155; font-size: 12px; }
.danger { background: #fff1f2; color: #e11d48; }
.empty, .denied, .platform-tip { padding: 24px; color: #64748b; }
.denied { color: #b42318; }
.invite-card { margin-top: 18px; }
.section-title { padding: 18px 18px 4px; color: #111827; font-size: 17px; font-weight: 800; }
.modal-mask { position: fixed; inset: 0; z-index: 20; display: flex; align-items: center; justify-content: center; padding: 24px; background: rgba(15,23,42,0.42); box-sizing: border-box; }
.invite-modal { width: 100%; max-width: 420px; padding: 24px; border-radius: 18px; background: #fff; box-shadow: 0 24px 70px rgba(15,23,42,0.2); }
.modal-title { display: block; color: #111827; font-size: 20px; font-weight: 800; }
.field { margin-top: 16px; }
.field text { display: block; margin-bottom: 8px; color: #64748b; font-size: 13px; }
.field input { height: 40px; padding: 0 12px; border-radius: 10px; border: 1px solid #e2e8f0; background: #f8fafc; box-sizing: border-box; }
.message { display: block; margin-top: 12px; color: #e11d48; font-size: 13px; }
.modal-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px; }
@media (max-width: 900px) {
  .shell { display: block; }
  .sidebar { position: static; width: auto; }
  .main { margin-left: 0; padding: 16px; }
  .topbar { display: block; }
  .row,.invite-row { grid-template-columns: 1fr; }
}
</style>
