<template>
  <view class="confirm-page">
    <view class="confirm-card">
      <text class="kicker">蝶变企业工作台</text>
      <text class="title">网页登录确认</text>
      <text class="desc">请确认是否允许电脑端企业工作台登录。不会向小程序返回网页登录会话凭证。</text>

      <view v-if="state === 'loading'" class="state-panel">正在读取登录请求...</view>
      <view v-else-if="state === 'expired'" class="state-panel warning">登录请求已过期，请在电脑端重新生成。</view>
      <view v-else-if="state === 'success'" class="state-panel success">网页登录已确认，请返回电脑继续。</view>
      <view v-else-if="state === 'failed'" class="state-panel warning">{{ message || '登录确认失败' }}</view>

      <view v-if="state === 'ready' || state === 'confirming'" class="content">
        <view class="info-block">
          <text class="info-label">当前用户</text>
          <text class="info-value">{{ user.name || '小程序用户' }}</text>
        </view>

        <view class="enterprise-block">
          <text class="section-title">可进入企业</text>
          <view v-if="!enterprises.length" class="empty-enterprise">
            <text>当前账号暂无已启用的企业成员关系。</text>
            <text>确认后网页将进入企业注册流程。</text>
          </view>
          <view
            v-for="item in enterprises"
            :key="item.enterprise.enterpriseId"
            :class="['enterprise-item', selectedEnterpriseId === item.enterprise.enterpriseId ? 'active' : '']"
            @click="selectEnterprise(item)"
          >
            <view>
              <text class="enterprise-name">{{ item.enterprise.enterpriseName }}</text>
              <text class="enterprise-meta">角色：{{ item.role || item.member.role }} · 状态：{{ item.member.status }}</text>
            </view>
            <text class="select-dot">{{ selectedEnterpriseId === item.enterprise.enterpriseId ? '已选' : '选择' }}</text>
          </view>
        </view>

        <button class="primary-btn" :disabled="state === 'confirming'" @click="confirmLogin">确认登录</button>
        <button class="ghost-btn" :disabled="state === 'confirming'" @click="cancelLogin">取消</button>
      </view>
    </view>
  </view>
</template>

<script>
import {
  cancelMiniappWebLogin,
  confirmMiniappWebLogin,
  loadMiniappConfirmContext
} from '../../utils/auth/miniappWebLoginService.js'

export default {
  data() {
    return {
      loginTicket: '',
      state: 'loading',
      message: '',
      user: {},
      enterprises: [],
      selectedEnterpriseId: ''
    }
  },
  onLoad(options = {}) {
    this.loginTicket = this.resolveTicket(options)
    this.loadContext()
  },
  methods: {
    resolveTicket(options = {}) {
      if (options.ticket) return decodeURIComponent(options.ticket)
      if (options.scene) {
        const scene = decodeURIComponent(options.scene)
        const match = scene.match(/(?:ticket=)?([^&]+)/)
        return match ? match[1] : scene
      }
      return ''
    },
    async loadContext() {
      this.state = 'loading'
      this.message = ''
      if (!this.loginTicket) {
        this.state = 'failed'
        this.message = '缺少登录 ticket'
        return
      }
      const result = await loadMiniappConfirmContext(this.loginTicket)
      if (!result || !result.success) {
        this.state = result && result.status === 'expired' ? 'expired' : 'failed'
        this.message = result && result.message ? result.message : '登录请求读取失败'
        return
      }
      this.user = result.user || {}
      this.enterprises = Array.isArray(result.enterprises) ? result.enterprises : []
      this.selectedEnterpriseId = this.enterprises.length === 1 ? this.enterprises[0].enterprise.enterpriseId : ''
      this.state = 'ready'
    },
    selectEnterprise(item = {}) {
      if (!item.member || item.member.status !== 'active') return
      this.selectedEnterpriseId = item.enterprise.enterpriseId
    },
    async confirmLogin() {
      this.state = 'confirming'
      const result = await confirmMiniappWebLogin({
        loginTicket: this.loginTicket,
        enterpriseId: this.selectedEnterpriseId
      })
      if (!result || !result.success) {
        this.state = result && result.status === 'expired' ? 'expired' : 'failed'
        this.message = result && result.message ? result.message : '确认失败，请重新扫码'
        return
      }
      this.state = 'success'
      uni.showToast({ title: '已确认', icon: 'none' })
    },
    async cancelLogin() {
      await cancelMiniappWebLogin(this.loginTicket)
      uni.navigateBack()
    }
  }
}
</script>

<style scoped>
.confirm-page { min-height: 100vh; padding: 24px; background: #f4f6fb; box-sizing: border-box; }
.confirm-card { padding: 24px; border-radius: 22px; background: #fff; border: 1px solid #e5e7eb; box-shadow: 0 16px 42px rgba(15,23,42,0.08); }
.kicker,.desc,.info-label,.enterprise-meta,.empty-enterprise { color: #64748b; }
.kicker { display: block; font-size: 12px; font-weight: 800; }
.title { display: block; margin-top: 8px; color: #111827; font-size: 26px; font-weight: 800; }
.desc { display: block; margin-top: 10px; font-size: 14px; line-height: 1.7; }
.state-panel { margin-top: 22px; padding: 18px; border-radius: 16px; background: #eef2ff; color: #4f46e5; font-size: 14px; }
.state-panel.warning { background: #fff7ed; color: #c2410c; }
.state-panel.success { background: #ecfdf5; color: #047857; }
.content { margin-top: 20px; }
.info-block,.enterprise-block { padding: 16px; border-radius: 16px; background: #f8fafc; border: 1px solid #e2e8f0; }
.info-label,.info-value,.section-title,.enterprise-name,.enterprise-meta,.empty-enterprise text { display: block; }
.info-label { font-size: 12px; }
.info-value { margin-top: 6px; color: #111827; font-size: 18px; font-weight: 800; }
.enterprise-block { margin-top: 14px; }
.section-title { color: #111827; font-size: 15px; font-weight: 800; }
.empty-enterprise { margin-top: 12px; line-height: 1.7; font-size: 13px; }
.enterprise-item { display: flex; justify-content: space-between; gap: 12px; align-items: center; margin-top: 12px; padding: 14px; border-radius: 14px; background: #fff; border: 1px solid #e5e7eb; }
.enterprise-item.active { border-color: #4f46e5; background: #eef2ff; }
.enterprise-name { color: #111827; font-size: 15px; font-weight: 800; }
.enterprise-meta { margin-top: 5px; font-size: 12px; }
.select-dot { color: #4f46e5; font-size: 12px; font-weight: 800; }
.primary-btn,.ghost-btn { height: 44px; line-height: 44px; border-radius: 14px; font-size: 15px; }
.primary-btn { margin-top: 18px; background: #4f46e5; color: #fff; }
.ghost-btn { margin-top: 10px; background: #eef2ff; color: #4f46e5; }
</style>
