<template>
  <view class="enterprise-select-page">
    <!-- #ifdef H5 -->
    <view class="select-card">
      <view class="header">
        <view>
          <text class="title">{{ labels.title }}</text>
          <text class="desc">{{ labels.desc }}</text>
        </view>
        <button class="ghost-btn" @click="logout">{{ labels.logout }}</button>
      </view>

      <view v-if="!memberships.length" class="empty">
        <text>{{ labels.empty }}</text>
        <button class="primary-btn" @click="goRegister">{{ labels.register }}</button>
      </view>

      <view v-else class="enterprise-list">
        <view v-for="item in memberships" :key="item.enterprise.enterpriseId" class="enterprise-item">
          <view>
            <text class="enterprise-name">{{ item.enterprise.enterpriseName }}</text>
            <text class="enterprise-meta">{{ labels.role }}{{ item.role || item.member.role }} · {{ labels.status }}{{ item.member.status }}</text>
          </view>
          <button :class="['mini-btn', item.member.status !== 'active' ? 'disabled' : '']" @click="selectEnterprise(item)">{{ labels.enter }}</button>
        </view>
      </view>

      <text v-if="message" class="message">{{ message }}</text>
    </view>
    <!-- #endif -->

    <!-- #ifndef H5 -->
    <view class="platform-tip">{{ labels.h5Only }}</view>
    <!-- #endif -->
  </view>
</template>

<script>
import { clearSession, getCurrentSession, listUserEnterprises, restoreSession, switchEnterprise } from '../../utils/auth/authSessionService.js'
import { navigateEnterpriseWeb } from '../../utils/enterprise-web/enterpriseWebRoutes.js'

const LABELS = {
  title: '\u9009\u62e9\u4f01\u4e1a',
  desc: '\u5f53\u524d\u7528\u6237\u53ef\u52a0\u5165\u591a\u4e2a\u4f01\u4e1a\uff0c\u4ec5 active \u6210\u5458\u53ef\u8fdb\u5165\u5de5\u4f5c\u53f0\u3002',
  logout: '\u9000\u51fa\u767b\u5f55',
  empty: '\u6682\u65e0\u53ef\u9009\u62e9\u4f01\u4e1a\uff0c\u8bf7\u5148\u6ce8\u518c\u4f01\u4e1a\u3002',
  register: '\u6ce8\u518c\u4f01\u4e1a',
  role: '\u89d2\u8272\uff1a',
  status: '\u72b6\u6001\uff1a',
  enter: '\u8fdb\u5165',
  inactive: '\u8be5\u4f01\u4e1a\u6210\u5458\u72b6\u6001\u4e0d\u53ef\u8fdb\u5165',
  switchFailed: '\u4f01\u4e1a\u5207\u6362\u5931\u8d25',
  h5Only: '\u4f01\u4e1a\u7f51\u9875\u7248\u4ec5\u5728 H5 \u5e73\u53f0\u663e\u793a\u3002'
}

export default {
  data() {
    return {
      labels: LABELS,
      memberships: [],
      message: ''
    }
  },
  async onShow() {
    await restoreSession()
    if (!getCurrentSession()) {
      navigateEnterpriseWeb('login')
      return
    }
    this.memberships = listUserEnterprises()
  },
  methods: {
    async selectEnterprise(item = {}) {
      if (!item.member || item.member.status !== 'active') {
        this.message = this.labels.inactive
        return
      }
      const result = await switchEnterprise(item.enterprise.enterpriseId)
      if (!result.success) {
        this.message = result.message || this.labels.switchFailed
        return
      }
      navigateEnterpriseWeb('dashboard')
    },
    goRegister() {
      navigateEnterpriseWeb('register')
    },
    logout() {
      clearSession()
      navigateEnterpriseWeb('login')
    }
  }
}
</script>

<style scoped>
.enterprise-select-page { min-height: 100vh; padding: 32px; background: #f4f6fb; box-sizing: border-box; }
.select-card { max-width: 860px; margin: 0 auto; padding: 32px; border-radius: 22px; background: #fff; border: 1px solid #e5e7eb; box-shadow: 0 24px 70px rgba(15,23,42,0.08); }
.header { display: flex; justify-content: space-between; gap: 16px; align-items: flex-start; }
.title { display: block; color: #111827; font-size: 30px; font-weight: 800; }
.desc,.enterprise-meta,.message,.platform-tip { color: #64748b; }
.desc { display: block; margin-top: 8px; font-size: 14px; }
.enterprise-list { display: grid; gap: 12px; margin-top: 24px; }
.enterprise-item { display: flex; justify-content: space-between; align-items: center; gap: 16px; padding: 18px; border-radius: 16px; background: #f8fafc; border: 1px solid #e2e8f0; }
.enterprise-name,.enterprise-meta { display: block; }
.enterprise-name { color: #111827; font-size: 17px; font-weight: 800; }
.enterprise-meta { margin-top: 6px; font-size: 13px; }
.primary-btn,.ghost-btn,.mini-btn { height: 38px; line-height: 38px; border-radius: 10px; font-size: 13px; }
.primary-btn,.mini-btn { background: #4f46e5; color: #fff; }
.ghost-btn { background: #eef2ff; color: #4f46e5; }
.disabled { background: #e5e7eb; color: #94a3b8; }
.empty { margin-top: 24px; padding: 24px; border-radius: 16px; background: #f8fafc; color: #64748b; }
.message { display: block; margin-top: 12px; font-size: 13px; }
@media (max-width: 720px) { .header,.enterprise-item { display: block; } .ghost-btn,.mini-btn { margin-top: 12px; } }
</style>
