<template>
  <view class="auth-callback-page">
    <!-- #ifdef H5 -->
    <view class="callback-card">
      <text class="kicker">Wechat OAuth</text>
      <text class="title">{{ title }}</text>
      <text class="desc">{{ message }}</text>
      <text v-if="errorCode" class="error-code">{{ labels.errorCode }}{{ errorCode }}</text>
      <button v-if="status === 'failed'" class="ghost-btn" @click="goLogin">{{ labels.back }}</button>
    </view>
    <!-- #endif -->
    <!-- #ifndef H5 -->
    <view class="platform-tip">{{ labels.h5Only }}</view>
    <!-- #endif -->
  </view>
</template>

<script>
import { createCloudFailedSession, resolvePostLoginRoute, setSession } from '../../utils/auth/authSessionService.js'
import { AUTH_MODES, completeWechatWebLogin } from '../../utils/auth/cloudAuthProvider.js'
import { navigateEnterpriseWeb } from '../../utils/enterprise-web/enterpriseWebRoutes.js'

const LABELS = Object.freeze({
  processing: '\u6b63\u5728\u5b8c\u6210\u5fae\u4fe1\u6388\u6743\u767b\u5f55\uff0c\u8bf7\u7a0d\u5019\u3002',
  success: '\u767b\u5f55\u6210\u529f',
  failed: '\u767b\u5f55\u5931\u8d25',
  confirming: '\u6b63\u5728\u786e\u8ba4\u8eab\u4efd',
  missingParams: '\u6388\u6743\u56de\u8c03\u53c2\u6570\u7f3a\u5931\uff0c\u8bf7\u8fd4\u56de\u767b\u5f55\u9875\u91cd\u65b0\u5f00\u59cb\u3002',
  exchangeFailed: '\u5fae\u4fe1\u6388\u6743\u767b\u5f55\u5931\u8d25',
  confirmed: '\u8eab\u4efd\u5df2\u786e\u8ba4\uff0c\u6b63\u5728\u8fdb\u5165\u4f01\u4e1a\u5de5\u4f5c\u53f0\u3002',
  unknown: '\u767b\u5f55\u5931\u8d25',
  errorCode: '\u9519\u8bef\u7801\uff1a',
  back: '\u8fd4\u56de\u767b\u5f55',
  h5Only: '\u4f01\u4e1a\u7f51\u9875\u7248\u4ec5\u5728 H5 \u5e73\u53f0\u663e\u793a\u3002'
})

export default {
  data() {
    return {
      labels: LABELS,
      status: 'processing',
      message: LABELS.processing,
      errorCode: ''
    }
  },
  computed: {
    title() {
      if (this.status === 'success') return this.labels.success
      if (this.status === 'failed') return this.labels.failed
      return this.labels.confirming
    }
  },
  onLoad(options = {}) {
    this.completeLogin(options)
  },
  methods: {
    async completeLogin(options = {}) {
      const code = options.code || ''
      const state = options.state || ''
      if (!code || !state) {
        this.fail('auth_code_missing', this.labels.missingParams)
        return
      }
      const result = await completeWechatWebLogin({ code, state })
      if (!result || !result.success || !result.session || result.status !== 'authenticated') {
        this.fail(result && result.errorCode ? result.errorCode : 'wechat_token_exchange_failed', result && result.message ? result.message : this.labels.exchangeFailed)
        return
      }
      const session = setSession({
        ...result.session,
        authSource: AUTH_MODES.CLOUD_AUTHENTICATED,
        authMode: AUTH_MODES.CLOUD_AUTHENTICATED,
        authCapability: result.authCapability,
        identityDiagnostics: result
      })
      this.status = 'success'
      this.message = this.labels.confirmed
      await this.routeAfterLogin(session)
    },
    fail(errorCode = 'unknown_error', message = '') {
      this.status = 'failed'
      this.errorCode = errorCode
      this.message = message || this.labels.unknown
      createCloudFailedSession({ errorCode, message: this.message, status: 'failed' })
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
.auth-callback-page { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 32px; background: #f4f6fb; box-sizing: border-box; }
.callback-card { width: 100%; max-width: 520px; padding: 36px; border-radius: 22px; background: #fff; border: 1px solid #e5e7eb; box-shadow: 0 24px 70px rgba(15,23,42,0.08); text-align: center; }
.kicker { display: block; color: #4f46e5; font-size: 13px; font-weight: 800; }
.title { display: block; margin-top: 8px; color: #111827; font-size: 30px; font-weight: 800; }
.desc,.platform-tip { display: block; margin-top: 12px; color: #64748b; font-size: 14px; line-height: 1.8; }
.error-code { display: block; margin-top: 12px; color: #dc2626; font-size: 13px; }
.ghost-btn { margin-top: 20px; height: 42px; line-height: 42px; border-radius: 12px; background: #eef2ff; color: #4f46e5; font-size: 14px; }
</style>
