<template>
  <view class="account-login-page">
    <!-- #ifdef H5 -->
    <view class="login-card">
      <text class="kicker">{{ labels.kicker }}</text>
      <text class="title">{{ labels.title }}</text>
      <text class="desc">{{ labels.desc }}</text>

      <view class="tabs">
        <view :class="['tab', loginType === 'email_code' ? 'active' : '']" @click="switchType('email_code')">{{ labels.emailTab }}</view>
        <view :class="['tab', loginType === 'phone_code' ? 'active' : '']" @click="switchType('phone_code')">{{ labels.phoneTab }}</view>
      </view>

      <view class="capability">
        <text>{{ capabilityText }}</text>
        <text v-if="devCodeAvailable" class="dev-tip">{{ labels.devMockEnabled }}</text>
      </view>

      <view class="field">
        <text>{{ loginType === 'email_code' ? labels.email : labels.phone }}</text>
        <input v-model="account" :placeholder="loginType === 'email_code' ? 'name@example.com' : '13812345678'" />
      </view>

      <view class="field code-row">
        <view class="code-input">
          <text>{{ labels.code }}</text>
          <input v-model="code" maxlength="6" :placeholder="labels.codePlaceholder" />
        </view>
        <button class="send-btn" :disabled="!canSendCode" @click="sendCode">{{ sendButtonText }}</button>
      </view>

      <view v-if="debugCode" class="debug-box">
        <text>{{ labels.devCode }}{{ debugCode }}</text>
      </view>

      <button class="primary-btn" :disabled="status === 'verifying'" @click="verifyAndLogin">{{ labels.login }}</button>
      <button class="ghost-btn" @click="goLogin">{{ labels.back }}</button>
      <text v-if="message" class="message">{{ message }}</text>
    </view>
    <!-- #endif -->
    <!-- #ifndef H5 -->
    <view class="platform-tip">{{ labels.h5Only }}</view>
    <!-- #endif -->
  </view>
</template>

<script>
import { ACCOUNT_AUTH_PROVIDERS } from '../../utils/auth/accountAuthProvider.js'
import { loadAccountCapability, requestAccountCode, verifyAccountCode } from '../../utils/auth/accountAuthService.js'
import { resolvePostLoginRoute } from '../../utils/auth/authSessionService.js'
import { navigateEnterpriseWeb } from '../../utils/enterprise-web/enterpriseWebRoutes.js'

function createRequestId() {
  return `account_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
}

const LABELS = Object.freeze({
  kicker: 'Account Login',
  title: '\u9a8c\u8bc1\u7801\u767b\u5f55',
  desc: '\u4f7f\u7528\u90ae\u7bb1\u6216\u624b\u673a\u53f7\u9a8c\u8bc1\u7801\u8fdb\u5165\u4f01\u4e1a\u5de5\u4f5c\u53f0\u3002\u90ae\u7bb1\u53ef\u63a5\u5165\u771f\u5b9e\u670d\u52a1\u5546\uff0c\u624b\u673a\u53f7\u672c\u9636\u6bb5\u4ecd\u4fdd\u6301 disabled \u6216 development_mock\u3002',
  emailTab: '\u90ae\u7bb1\u9a8c\u8bc1\u7801',
  phoneTab: '\u624b\u673a\u53f7\u9a8c\u8bc1\u7801',
  devMockEnabled: '\u5f00\u53d1 Mock \u5df2\u542f\u7528',
  email: '\u90ae\u7bb1\u5730\u5740',
  phone: '\u624b\u673a\u53f7',
  code: '\u9a8c\u8bc1\u7801',
  codePlaceholder: '6 \u4f4d\u6570\u5b57',
  devCode: '\u5f00\u53d1\u8c03\u8bd5\u7801\uff1a',
  login: '\u767b\u5f55\u4f01\u4e1a\u5de5\u4f5c\u53f0',
  back: '\u8fd4\u56de\u767b\u5f55\u65b9\u5f0f',
  h5Only: '\u4f01\u4e1a\u7f51\u9875\u7248\u4ec5\u5728 H5 \u5e73\u53f0\u663e\u793a\u3002',
  capabilityConfigured: '\u670d\u52a1\u80fd\u529b\uff1a\u53ef\u7528',
  capabilityMock: '\u670d\u52a1\u80fd\u529b\uff1a\u5f00\u53d1 Mock',
  capabilityDisabled: '\u670d\u52a1\u80fd\u529b\uff1a\u6682\u672a\u914d\u7f6e',
  sending: '\u53d1\u9001\u4e2d',
  sendCode: '\u53d1\u9001\u9a8c\u8bc1\u7801',
  sendFailed: '\u9a8c\u8bc1\u7801\u53d1\u9001\u5931\u8d25',
  sent: '\u9a8c\u8bc1\u7801\u5df2\u53d1\u9001\uff0c\u8bf7\u67e5\u6536\u3002',
  loginFailed: '\u9a8c\u8bc1\u7801\u767b\u5f55\u5931\u8d25'
})

export default {
  data() {
    return {
      labels: LABELS,
      loginType: ACCOUNT_AUTH_PROVIDERS.EMAIL_CODE,
      account: '',
      code: '',
      capability: {},
      status: 'idle',
      countdown: 0,
      timer: null,
      message: '',
      debugCode: '',
      requestId: ''
    }
  },
  computed: {
    activeCapability() {
      const key = this.loginType === ACCOUNT_AUTH_PROVIDERS.PHONE_CODE ? 'phone' : 'email'
      return (this.capability && this.capability[key]) || { status: 'disabled' }
    },
    capabilityText() {
      const status = this.activeCapability.status
      if (status === 'configured') return this.labels.capabilityConfigured
      if (status === 'development_mock') return this.labels.capabilityMock
      return this.labels.capabilityDisabled
    },
    devCodeAvailable() {
      return Boolean(this.activeCapability.devCodeAvailable)
    },
    canSendCode() {
      return !this.countdown && !['sending', 'verifying'].includes(this.status)
    },
    sendButtonText() {
      if (this.countdown > 0) return `${this.countdown}s`
      if (this.status === 'sending') return this.labels.sending
      return this.labels.sendCode
    }
  },
  async onLoad(options = {}) {
    if (options.type === ACCOUNT_AUTH_PROVIDERS.PHONE_CODE) this.loginType = ACCOUNT_AUTH_PROVIDERS.PHONE_CODE
    await this.loadCapability()
  },
  onUnload() {
    this.clearTimer()
  },
  methods: {
    async loadCapability() {
      const result = await loadAccountCapability()
      this.capability = result && result.data ? result.data : result
    },
    switchType(type = ACCOUNT_AUTH_PROVIDERS.EMAIL_CODE) {
      this.loginType = type
      this.code = ''
      this.message = ''
      this.debugCode = ''
      this.requestId = ''
      this.status = 'idle'
      this.clearTimer(true)
    },
    async sendCode() {
      if (!this.canSendCode) return
      this.status = 'sending'
      this.message = ''
      this.debugCode = ''
      this.requestId = this.requestId || createRequestId()
      const result = await requestAccountCode({
        loginType: this.loginType,
        account: this.account,
        requestId: this.requestId
      })
      if (!result || !result.success) {
        this.status = 'failed'
        this.message = result && result.message ? result.message : this.labels.sendFailed
        this.requestId = ''
        return
      }
      this.status = 'code_sent'
      this.message = result.message || this.labels.sent
      this.debugCode = result.debug && result.debug.devCode ? result.debug.devCode : ''
      this.startCountdown(result.retryAfterSeconds || 60)
    },
    async verifyAndLogin() {
      this.status = 'verifying'
      this.message = ''
      const result = await verifyAccountCode({ loginType: this.loginType, account: this.account, code: this.code })
      if (!result || !result.success || !result.session) {
        this.status = 'failed'
        this.message = result && result.message ? result.message : this.labels.loginFailed
        return
      }
      this.status = 'authenticated'
      await this.routeAfterLogin(result.session)
    },
    startCountdown(seconds = 60) {
      this.clearTimer(false)
      this.countdown = Number(seconds) || 60
      this.timer = setInterval(() => {
        this.countdown -= 1
        if (this.countdown <= 0) this.clearTimer(true)
      }, 1000)
    },
    clearTimer(resetRequest = false) {
      if (this.timer) clearInterval(this.timer)
      this.timer = null
      this.countdown = 0
      if (resetRequest) this.requestId = ''
    },
    async routeAfterLogin(session = {}) {
      const route = await resolvePostLoginRoute(session)
      if (route.type === 'select_enterprise') {
        navigateEnterpriseWeb('selectEnterprise')
        return
      }
      if (route.type === 'register') {
        navigateEnterpriseWeb('register')
        return
      }
      if (route.type === 'login') {
        navigateEnterpriseWeb('login')
        return
      }
      navigateEnterpriseWeb('dashboard')
    },
    goLogin() {
      navigateEnterpriseWeb('login')
    }
  }
}
</script>

<style scoped>
.account-login-page { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 32px; background: #f4f6fb; box-sizing: border-box; }
.login-card { width: 100%; max-width: 560px; padding: 36px; border-radius: 22px; background: #fff; border: 1px solid #e5e7eb; box-shadow: 0 24px 70px rgba(15,23,42,0.08); }
.kicker,.desc,.field text,.message,.platform-tip,.capability { color: #64748b; }
.kicker { display: block; font-size: 13px; font-weight: 800; }
.title { display: block; margin-top: 8px; color: #111827; font-size: 30px; font-weight: 800; }
.desc { display: block; margin-top: 10px; font-size: 14px; line-height: 1.8; }
.tabs { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; margin-top: 24px; }
.tab { padding: 12px; border-radius: 12px; background: #f8fafc; border: 1px solid #e2e8f0; color: #475569; text-align: center; font-size: 14px; }
.tab.active { background: #eef2ff; border-color: #c7d2fe; color: #4f46e5; font-weight: 800; }
.capability { display: flex; justify-content: space-between; gap: 12px; margin-top: 14px; font-size: 13px; }
.dev-tip { color: #d97706; font-weight: 800; }
.field { margin-top: 16px; }
.field text { display: block; margin-bottom: 8px; font-size: 13px; }
.field input { width: 100%; height: 42px; padding: 0 12px; border-radius: 12px; border: 1px solid #e2e8f0; background: #f8fafc; box-sizing: border-box; }
.code-row { display: flex; gap: 12px; align-items: flex-end; }
.code-input { flex: 1; }
.send-btn { width: 124px; height: 42px; line-height: 42px; border-radius: 12px; background: #eef2ff; color: #4f46e5; font-size: 13px; }
.debug-box { margin-top: 14px; padding: 12px; border-radius: 12px; background: #fff7ed; color: #c2410c; font-size: 13px; }
.primary-btn,.ghost-btn { height: 44px; line-height: 44px; border-radius: 12px; font-size: 15px; }
.primary-btn { margin-top: 24px; background: #4f46e5; color: #fff; }
.ghost-btn { margin-top: 12px; background: #eef2ff; color: #4f46e5; }
.message { display: block; margin-top: 12px; text-align: center; font-size: 13px; }
@media (max-width: 640px) { .login-card { padding: 26px; } .code-row { display: block; } .send-btn { width: 100%; margin-top: 10px; } }
</style>
