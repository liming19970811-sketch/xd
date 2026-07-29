<template>
  <view class="enterprise-web-page">
    <!-- #ifdef H5 -->
    <view class="enterprise-shell">
      <view class="enterprise-sidebar">
        <view class="brand-block">
          <text class="brand-name">{{ labels.brand }}</text>
          <text class="brand-subtitle">{{ labels.brandSubtitle }}</text>
        </view>
        <view class="menu-list">
          <view v-for="item in menu" :key="item.key" :class="['menu-item', item.key === activeKey ? 'active' : '']" @click="goTo(item)">
            <text class="menu-icon">{{ item.icon }}</text>
            <text>{{ item.label }}</text>
          </view>
        </view>
      </view>

      <view class="enterprise-main">
        <view class="topbar">
          <view>
            <text class="page-title">{{ labels.title }}</text>
            <text class="page-subtitle">{{ labels.subtitle }}</text>
          </view>

          <view class="enterprise-meta">
            <text class="enterprise-name">{{ enterpriseName }}</text>
            <view class="user-card">
              <text class="user-name">{{ userName }}</text>
              <text class="user-role">{{ roleName }}</text>
            </view>
            <view class="top-actions">
              <button class="mini-btn" @click="switchEnterprise">{{ labels.switchEnterprise }}</button>
              <button class="logout-btn" :disabled="isLoggingOut" @click="handleLogout">
                {{ isLoggingOut ? labels.loggingOut : labels.logout }}
              </button>
            </view>
          </view>
        </view>

        <view class="empty-panel">
          <text class="empty-title">{{ labels.emptyTitle }}</text>
          <text class="empty-desc">{{ labels.emptyDesc }}</text>
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
import { getCurrentContext } from '../../utils/auth/authRepository.js'
import { clearSession, getCurrentSession, restoreSession } from '../../utils/auth/authSessionService.js'
import { getEnterpriseWebMenu } from '../../utils/enterprise-web/enterpriseWebMenu.js'
import { navigateEnterpriseWeb } from '../../utils/enterprise-web/enterpriseWebRoutes.js'

const LABELS = Object.freeze({
  brand: '\u8776\u53d8',
  brandSubtitle: '\u4f01\u4e1a\u5de5\u4f5c\u53f0',
  title: '\u4f01\u4e1a\u7f51\u9875\u7248\u6846\u67b6',
  subtitle: '\u5de6\u4fa7\u5bfc\u822a\u3001\u9876\u90e8\u4f01\u4e1a\u4fe1\u606f\u680f\u548c\u4e3b\u5185\u5bb9\u533a\u5df2\u5c31\u7eea\u3002',
  switchEnterprise: '\u5207\u6362\u4f01\u4e1a',
  loggingOut: '\u6b63\u5728\u9000\u51fa...',
  logout: '\u9000\u51fa\u767b\u5f55',
  emptyTitle: '\u8bf7\u9009\u62e9\u5de6\u4fa7\u6a21\u5757',
  emptyDesc: '\u7ecf\u8425\u9996\u9875\u3001\u9879\u76ee\u7ba1\u7406\u3001\u5546\u54c1\u8d44\u6599\u5305\u3001\u6210\u5458\u7ba1\u7406\u3001\u89d2\u8272\u6743\u9650\u5df2\u6ce8\u518c\u4e3a\u72ec\u7acb\u9875\u9762\u3002',
  h5Only: '\u4f01\u4e1a\u7f51\u9875\u7248\u4ec5\u5728 H5 \u5e73\u53f0\u663e\u793a\u3002',
  noEnterprise: '\u672a\u9009\u62e9\u4f01\u4e1a',
  defaultUser: '\u5c0f\u7a0b\u5e8f\u7528\u6237'
})

export default {
  data() {
    return {
      labels: LABELS,
      activeKey: 'layout',
      context: getCurrentContext(),
      isLoggingOut: false,
      menu: getEnterpriseWebMenu()
    }
  },
  computed: {
    enterpriseName() {
      return this.context.currentEnterprise.enterpriseName || this.labels.noEnterprise
    },
    userName() {
      return this.context.currentUser.name || this.labels.defaultUser
    },
    roleName() {
      return this.context.currentRole || 'admin'
    }
  },
  async onShow() {
    const restored = await restoreSession()
    this.context = getCurrentContext()
    this.menu = getEnterpriseWebMenu()
    if (!restored && !getCurrentSession()) {
      navigateEnterpriseWeb('login')
    }
  },
  methods: {
    goTo(item = {}) {
      if (!item.route) return
      uni.navigateTo({ url: item.route })
    },
    switchEnterprise() {
      navigateEnterpriseWeb('selectEnterprise')
    },
    async handleLogout() {
      if (this.isLoggingOut) return
      this.isLoggingOut = true
      try {
        await clearSession()
      } finally {
        this.context = getCurrentContext()
        this.isLoggingOut = false
        navigateEnterpriseWeb('login')
      }
    }
  }
}
</script>

<style scoped>
.enterprise-web-page { min-height: 100vh; background: #f4f6fb; }
.enterprise-shell { display: flex; min-height: 100vh; color: #172033; }
.enterprise-sidebar { position: fixed; left: 0; top: 0; bottom: 0; width: 216px; padding: 24px 16px; background: #101828; color: #fff; box-sizing: border-box; }
.brand-block { margin-bottom: 28px; }
.brand-name { display: block; font-size: 22px; font-weight: 700; }
.brand-subtitle { display: block; margin-top: 6px; font-size: 12px; color: #a9b4ca; }
.menu-item { display: flex; align-items: center; gap: 10px; padding: 12px; border-radius: 10px; font-size: 14px; color: #cbd5e1; cursor: pointer; }
.menu-item.active,.menu-item:hover { background: #eef2ff; color: #4f46e5; }
.menu-icon { width: 24px; height: 24px; border-radius: 8px; background: rgba(255, 255, 255, 0.1); text-align: center; line-height: 24px; font-size: 12px; }
.enterprise-main { flex: 1; margin-left: 216px; padding: 24px; }
.topbar,.empty-panel { background: #fff; border: 1px solid #e5e7eb; border-radius: 16px; box-shadow: 0 18px 40px rgba(15, 23, 42, 0.06); }
.topbar { display: flex; justify-content: space-between; gap: 16px; padding: 20px 24px; }
.page-title,.empty-title { display: block; font-size: 22px; font-weight: 700; }
.page-subtitle,.empty-desc,.enterprise-name { display: block; margin-top: 6px; color: #64748b; font-size: 13px; }
.enterprise-meta { min-width: 180px; text-align: right; }
.user-card { margin-top: 8px; }
.user-name,.user-role { display: block; line-height: 1.5; }
.user-name { color: #172033; font-size: 14px; font-weight: 700; }
.user-role { color: #64748b; font-size: 12px; }
.top-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 10px; }
.mini-btn,.logout-btn { height: 32px; line-height: 32px; border-radius: 8px; font-size: 12px; }
.mini-btn { background: #eef2ff; color: #4f46e5; }
.logout-btn { min-width: 86px; background: #fff1f2; color: #e11d48; }
.logout-btn[disabled] { color: #94a3b8; background: #f1f5f9; }
.empty-panel { margin-top: 18px; padding: 32px; }
.platform-tip { padding: 48px 24px; color: #64748b; }
@media (max-width: 900px) {
  .enterprise-shell { display: block; }
  .enterprise-sidebar { position: static; width: auto; }
  .enterprise-main { margin-left: 0; padding: 16px; }
  .topbar { display: block; }
  .enterprise-meta { margin-top: 16px; text-align: left; }
  .top-actions { justify-content: flex-start; }
}
</style>
