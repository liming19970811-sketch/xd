<template>
  <view class="enterprise-login-page">
    <!-- #ifdef H5 -->
    <view class="login-card">
      <text class="login-kicker">Diebian Enterprise</text>
      <text class="login-title">{{ labels.title }}</text>
      <text class="login-desc">{{ labels.desc }}</text>

      <view class="login-methods">
        <view class="method-card primary-method" @click="goMiniappLogin">
          <text class="method-title">{{ labels.miniappTitle }}</text>
          <text class="method-desc">{{ labels.miniappDesc }}</text>
        </view>
        <view class="method-card" @click="goAccountLogin('email_code')">
          <text class="method-title">{{ labels.emailTitle }}</text>
          <text class="method-desc">{{ accountCapabilityLabel('email') }}</text>
        </view>
        <view class="method-card" @click="goAccountLogin('phone_code')">
          <text class="method-title">{{ labels.phoneTitle }}</text>
          <text class="method-desc">{{ accountCapabilityLabel('phone') }}</text>
        </view>
        <view class="method-card" @click="startWechatLogin">
          <text class="method-title">{{ labels.wechatTitle }}</text>
          <text class="method-desc">{{ capabilityLabel }}</text>
          <button v-if="authUrl" class="auth-link-btn" :disabled="loading" @click.stop="openWechatAuth">{{ labels.wechatAuth }}</button>
        </view>
        <view class="method-card mock" @click="useLocalMock">
          <text class="method-title">{{ labels.mockTitle }}</text>
          <text class="method-desc">{{ labels.mockDesc }}</text>
        </view>
      </view>

      <text v-if="message" class="message">{{ message }}</text>

      <view class="diagnostic-panel">
        <text class="diagnostic-title">{{ labels.diagnostic }}</text>
        <view class="diagnostic-row"><text>{{ labels.currentMode }}</text><text>{{ authSourceLabel }}</text></view>
        <view class="diagnostic-row"><text>{{ labels.wechatCapability }}</text><text>{{ authCapability }}</text></view>
        <view class="diagnostic-row"><text>{{ labels.emailCapability }}</text><text>{{ accountCapabilityStatus('email') }}</text></view>
        <view class="diagnostic-row"><text>{{ labels.phoneCapability }}</text><text>{{ accountCapabilityStatus('phone') }}</text></view>
        <view class="diagnostic-row"><text>identityAvailable</text><text>{{ diagnostics.identityAvailable ? 'true' : 'false' }}</text></view>
        <view class="diagnostic-row"><text>{{ labels.sessionStatus }}</text><text>{{ sessionStatus }}</text></view>
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
import { createCloudFailedSession, createCloudPendingSession, ensureLocalMockSession, getCurrentSession, resolvePostLoginRoute, restoreSession } from '../../utils/auth/authSessionService.js'
import { loadAccountCapability } from '../../utils/auth/accountAuthService.js'
import { AUTH_CAPABILITIES, AUTH_MODES, getAuthCapability, startWechatWebLogin } from '../../utils/auth/cloudAuthProvider.js'
import { getAuthCapabilityLabel } from '../../utils/auth/wechatWebAuthConfig.js'
import { navigateEnterpriseWeb } from '../../utils/enterprise-web/enterpriseWebRoutes.js'

const LABELS = Object.freeze({
  title: '\u8776\u53d8\u4f01\u4e1a\u5de5\u4f5c\u53f0',
  desc: '\u9009\u62e9\u4e00\u79cd\u767b\u5f55\u65b9\u5f0f\u8fdb\u5165\u4f01\u4e1a\u5de5\u4f5c\u53f0\u3002\u9a8c\u8bc1\u7801\u767b\u5f55\u53ef\u72ec\u7acb\u4e8e\u5fae\u4fe1\u5f00\u653e\u5e73\u53f0\u4f7f\u7528\uff1b\u672c\u5730\u6a21\u62df\u8eab\u4efd\u4ec5\u7528\u4e8e\u5f00\u53d1\u6f14\u793a\u3002',
  miniappTitle: '\u4f7f\u7528\u8776\u53d8\u5c0f\u7a0b\u5e8f\u626b\u7801\u767b\u5f55',
  miniappDesc: '\u4f7f\u7528\u5c0f\u7a0b\u5e8f\u786e\u8ba4\u7f51\u9875\u767b\u5f55\uff0c\u57fa\u4e8e\u4e91\u5f00\u53d1 OPENID \u83b7\u5f97\u53ef\u4fe1 cloud_authenticated Session\u3002',
  emailTitle: '\u90ae\u7bb1\u9a8c\u8bc1\u7801\u767b\u5f55',
  phoneTitle: '\u624b\u673a\u53f7\u9a8c\u8bc1\u7801\u767b\u5f55',
  wechatTitle: '\u5fae\u4fe1\u5f00\u653e\u5e73\u53f0\u626b\u7801\u767b\u5f55',
  wechatAuth: '\u524d\u5f80\u5fae\u4fe1\u6388\u6743',
  mockTitle: '\u672c\u5730\u6a21\u62df\u8eab\u4efd',
  mockDesc: '\u4ec5\u5f00\u53d1\u73af\u5883\u6f14\u793a\u4f7f\u7528\uff0c\u9876\u90e8\u4f1a\u6301\u7eed\u663e\u793a local_mock\u3002',
  diagnostic: '\u5f00\u53d1\u5b89\u5168\u8bca\u65ad',
  currentMode: '\u5f53\u524d\u6a21\u5f0f',
  wechatCapability: '\u5fae\u4fe1\u80fd\u529b',
  emailCapability: '\u90ae\u7bb1\u80fd\u529b',
  phoneCapability: '\u624b\u673a\u80fd\u529b',
  sessionStatus: 'session \u72b6\u6001',
  h5Only: '\u4f01\u4e1a\u7f51\u9875\u7248\u4ec5\u5728 H5 \u5e73\u53f0\u663e\u793a\u3002',
  accountConfigured: '\u670d\u52a1\u5df2\u914d\u7f6e\uff0c\u53ef\u53d1\u9001\u771f\u5b9e\u9a8c\u8bc1\u7801\u3002',
  accountMock: '\u5f00\u53d1 Mock \u5df2\u663e\u5f0f\u542f\u7528\u3002',
  accountDisabled: '\u670d\u52a1\u6682\u672a\u914d\u7f6e\u3002',
  wechatUnavailable: '\u5fae\u4fe1\u626b\u7801\u767b\u5f55\u5c1a\u672a\u53ef\u7528',
  wechatAuthReady: '\u5df2\u751f\u6210\u5fae\u4fe1\u6388\u6743\u5730\u5740\uff0c\u8bf7\u70b9\u51fb\u524d\u5f80\u6388\u6743\u3002',
  wechatAuthPending: '\u8bf7\u7b49\u5f85\u5fae\u4fe1\u6388\u6743\u3002',
  cloudCallFailed: 'enterprise_auth \u4e91\u51fd\u6570\u8c03\u7528\u5931\u8d25'
})

export default {
  data() {
    return {
      labels: LABELS,
      context: getCurrentContext(),
      authCapability: AUTH_CAPABILITIES.PLACEHOLDER,
      accountCapability: {},
      diagnostics: {},
      sessionStatus: '',
      authUrl: '',
      loading: false,
      message: ''
    }
  },
  computed: {
    authSourceLabel() {
      return this.context.authSource || AUTH_MODES.LOCAL_MOCK
    },
    capabilityLabel() {
      return getAuthCapabilityLabel(this.authCapability)
    }
  },
  async onShow() {
    const session = await restoreSession()
    await Promise.all([this.loadWechatCapability(), this.loadAccountCapability()])
    this.context = getCurrentContext()
    this.syncDiagnostics(session)
    if (session && session.token && [AUTH_MODES.LOCAL_MOCK, AUTH_MODES.CLOUD_AUTHENTICATED].includes(session.authSource)) {
      await this.routeAfterLogin(session)
    }
  },
  methods: {
    async loadWechatCapability() {
      const result = await getAuthCapability()
      this.authCapability = result.authCapability || AUTH_CAPABILITIES.PLACEHOLDER
      this.diagnostics = result || {}
    },
    async loadAccountCapability() {
      const result = await loadAccountCapability()
      this.accountCapability = result && result.data ? result.data : (result || {})
    },
    accountCapabilityStatus(key = 'email') {
      const item = this.accountCapability && this.accountCapability[key] ? this.accountCapability[key] : {}
      return item.status || 'disabled'
    },
    accountCapabilityLabel(key = 'email') {
      const status = this.accountCapabilityStatus(key)
      if (status === 'configured') return this.labels.accountConfigured
      if (status === 'development_mock') return this.labels.accountMock
      return this.labels.accountDisabled
    },
    goAccountLogin(type = 'email_code') {
      navigateEnterpriseWeb('accountLogin', { type })
    },
    goMiniappLogin() {
      navigateEnterpriseWeb('miniappLogin')
    },
    async startWechatLogin() {
      this.loading = true
      this.message = ''
      this.authUrl = ''
      try {
        const result = await startWechatWebLogin()
        this.authCapability = result.authCapability || this.authCapability
        this.diagnostics = result || {}
        if (!result || !result.success) {
          createCloudFailedSession(result || {})
          this.context = getCurrentContext()
          this.syncDiagnostics(result)
          this.message = result.message || this.labels.wechatUnavailable
          return
        }
        createCloudPendingSession(result)
        this.context = getCurrentContext()
        this.syncDiagnostics(result)
        this.authUrl = result.qrUrl || result.qrPayload || ''
        this.message = this.authUrl ? this.labels.wechatAuthReady : this.labels.wechatAuthPending
      } catch (error) {
        const failed = {
          status: 'failed',
          authCapability: this.authCapability,
          errorCode: 'cloud_call_failed',
          message: this.labels.cloudCallFailed
        }
        createCloudFailedSession(failed)
        this.context = getCurrentContext()
        this.syncDiagnostics(failed)
        this.message = failed.message
      } finally {
        this.loading = false
      }
    },
    openWechatAuth() {
      if (this.authUrl && typeof window !== 'undefined') {
        window.location.href = this.authUrl
      }
    },
    useLocalMock() {
      const session = ensureLocalMockSession()
      this.context = getCurrentContext()
      this.syncDiagnostics(session)
      this.routeAfterLogin(session)
    },
    syncDiagnostics(source = {}) {
      const session = getCurrentSession()
      this.diagnostics = source && source.identityDiagnostics ? source.identityDiagnostics : (source || (session && session.identityDiagnostics) || {})
      this.sessionStatus = (session && session.sessionStatus) || (source && source.status) || ''
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
    }
  }
}
</script>

<style scoped>
.enterprise-login-page { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 32px; background: linear-gradient(135deg, #f8fbff 0%, #eef2ff 48%, #f7f3ff 100%); box-sizing: border-box; }
.login-card { width: 100%; max-width: 760px; padding: 40px; border-radius: 24px; background: rgba(255,255,255,0.94); border: 1px solid #e5e7eb; box-shadow: 0 24px 70px rgba(79,70,229,0.14); }
.login-kicker,.login-desc,.method-desc,.platform-tip,.message { color: #64748b; }
.login-kicker { display: block; font-size: 13px; font-weight: 700; }
.login-title { display: block; margin-top: 8px; color: #111827; font-size: 34px; font-weight: 800; }
.login-desc { display: block; margin-top: 12px; line-height: 1.8; font-size: 14px; }
.login-methods { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; margin-top: 26px; }
.method-card { min-height: 112px; padding: 18px; border-radius: 18px; background: #f8fafc; border: 1px solid #e2e8f0; box-sizing: border-box; cursor: pointer; }
.method-card:hover { border-color: #c7d2fe; background: #eef2ff; }
.method-card.mock { background: #fff7ed; border-color: #fed7aa; }
.method-card.primary-method { background: linear-gradient(135deg, #eef2ff 0%, #f5f3ff 100%); border-color: #c7d2fe; }
.method-title { display: block; color: #111827; font-size: 17px; font-weight: 800; }
.method-desc { display: block; margin-top: 8px; font-size: 13px; line-height: 1.6; }
.auth-link-btn { margin-top: 12px; height: 34px; line-height: 34px; border-radius: 10px; background: #111827; color: #fff; font-size: 13px; }
.message { display: block; margin-top: 14px; text-align: center; font-size: 13px; }
.diagnostic-panel { margin-top: 22px; padding: 16px; border-radius: 16px; background: #0f172a; color: #dbeafe; }
.diagnostic-title { display: block; margin-bottom: 10px; font-size: 13px; font-weight: 800; }
.diagnostic-row { display: flex; justify-content: space-between; gap: 12px; padding: 6px 0; font-size: 12px; }
.diagnostic-row text:first-child { color: #93c5fd; }
@media (max-width: 720px) { .login-methods { grid-template-columns: 1fr; } .login-card { padding: 28px; } }
</style>
