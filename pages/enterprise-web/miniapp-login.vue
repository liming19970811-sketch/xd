<template>
  <view class="miniapp-login-page">
    <!-- #ifdef H5 -->
    <view class="login-panel">
      <view class="header">
        <text class="kicker">Mini Program Scan</text>
        <text class="title">Diebian Mini Program Login</text>
        <text class="desc">This page creates a one-time login request. Open the confirmation path in the Diebian mini program, confirm the login, and this page will enter the enterprise workspace automatically.</text>
      </view>

      <view class="qr-card">
        <view class="qr-placeholder">
          <view v-for="row in qrCells" :key="row" class="qr-row">
            <view
              v-for="col in qrCells"
              :key="row + '-' + col"
              :class="['qr-cell', isDarkCell(row, col) ? 'dark' : '']"
            ></view>
          </view>
        </view>
        <text class="qr-note">Development QR placeholder. Copy the mini program confirmation path below, or generate an official mini program code after deployment.</text>
        <text class="payload-label">Mini program confirmation path</text>
        <text class="payload-text">{{ qrPayload || 'Generating...' }}</text>
        <button class="copy-btn" :disabled="!qrPayload" @click="copyPayload">Copy Path</button>
      </view>

      <view class="status-card">
        <view class="status-row">
          <text>Login status</text>
          <text>{{ statusLabel }}</text>
        </view>
        <view class="status-row">
          <text>Remaining time</text>
          <text>{{ remainingSeconds }}s</text>
        </view>
        <view class="status-row">
          <text>Polling interval</text>
          <text>{{ pollIntervalMs / 1000 }}s</text>
        </view>
      </view>

      <view class="actions">
        <button class="primary-btn" :disabled="loading" @click="renewTicket">Regenerate</button>
        <button class="ghost-btn" @click="cancelAndBack">Cancel Login</button>
      </view>
      <text v-if="message" class="message">{{ message }}</text>
      <view v-if="isDevelopment && debugError" class="debug-card">
        <text class="debug-title">Debug</text>
        <text class="debug-line">Error: {{ debugErrorMessage }}</text>
        <text class="debug-line">Code: {{ debugErrorCode }}</text>
      </view>
      <view v-if="isDevelopment" class="debug-card">
        <text class="debug-title">Cloud Status</text>
        <text class="debug-line">initialized: {{ cloudStatus.initialized }}</text>
        <text class="debug-line">authenticated: {{ cloudStatus.authenticated }}</text>
        <text class="debug-line">authType: {{ cloudStatus.authType || 'none' }}</text>
        <text class="debug-line">envId: {{ cloudStatus.envId || '-' }}</text>
        <text class="debug-line">callFunction available: {{ cloudStatus.hasCallFunction }}</text>
        <text class="debug-line">errorCode: {{ cloudStatus.errorCode || '-' }}</text>
        <text class="debug-line">errorMessage: {{ cloudStatus.errorMessage || '-' }}</text>
      </view>
    </view>
    <!-- #endif -->
    <!-- #ifndef H5 -->
    <view class="platform-tip">Enterprise web mini program scan login is only shown on H5.</view>
    <!-- #endif -->
  </view>
</template>

<script>
import { getCloudWebClientStatus } from '../../utils/cloud/cloudWebClient.js'
import { resolvePostLoginRoute, setSession } from '../../utils/auth/authSessionService.js'
import {
  cancelMiniappWebLogin,
  completeMiniappWebLogin,
  MINIAPP_WEB_LOGIN_STATUSES,
  pollMiniappWebLogin,
  startMiniappWebLogin
} from '../../utils/auth/miniappWebLoginService.js'
import { navigateEnterpriseWeb } from '../../utils/enterprise-web/enterpriseWebRoutes.js'

export default {
  data() {
    return {
      loading: false,
      loginTicket: '',
      qrPayload: '',
      expiresAt: '',
      status: MINIAPP_WEB_LOGIN_STATUSES.PENDING,
      message: '',
      pollIntervalMs: 2000,
      pollTimer: null,
      countdownTimer: null,
      remainingSeconds: 0,
      qrCells: [0, 1, 2, 3, 4, 5, 6, 7, 8],
      debugError: false,
      debugErrorCode: '',
      debugErrorMessage: '',
      cloudStatus: {
        initialized: false,
        envId: '',
        hasApp: false,
        hasCallFunction: false,
        authenticated: false,
        authType: 'none',
        errorCode: '',
        errorMessage: ''
      },
      isExplicitCancelling: false,
      isRegenerating: false,
      ticketGenerationId: 0,
      cancelledTicketMap: {},
      focusHandler: null,
      visibilityHandler: null
    }
  },
  computed: {
    isDevelopment() {
      try {
        return typeof process !== 'undefined' && process.env && process.env.NODE_ENV !== 'production'
      } catch (error) {
        return false
      }
    },
    statusLabel() {
      const labels = {
        pending: 'Waiting for mini program confirmation',
        confirmed: 'Confirmed, creating web session',
        authenticated: 'Login successful',
        expired: 'Expired',
        cancelled: 'Cancelled',
        consumed: 'Completed',
        failed: 'Login failed'
      }
      return labels[this.status] || 'Waiting for mini program confirmation'
    }
  },
  onShow() {
    this.logLifecycle('onShow')
    if (this.loading || this.isRegenerating) return
    if (this.loginTicket) {
      this.pollOnce()
      return
    }
    this.renewTicket()
  },
  onUnload() {
    this.logLifecycle('onUnload')
    this.stopPolling()
    this.stopCountdown()
  },
  mounted() {
    // #ifdef H5
    this.focusHandler = () => {
      this.logLifecycle('windowFocus')
      if (this.loginTicket) this.pollOnce()
    }
    this.visibilityHandler = () => {
      const event = typeof document !== 'undefined' && document.hidden ? 'documentHidden' : 'documentVisible'
      this.logLifecycle(event)
      if (typeof document !== 'undefined' && !document.hidden && this.loginTicket) this.pollOnce()
    }
    if (typeof window !== 'undefined') window.addEventListener('focus', this.focusHandler)
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', this.visibilityHandler)
    // #endif
  },
  beforeUnmount() {
    this.logLifecycle('beforeUnmount')
    this.stopPolling()
    this.stopCountdown()
    this.removeLifecycleListeners()
  },
  beforeDestroy() {
    this.logLifecycle('beforeDestroy')
    this.stopPolling()
    this.stopCountdown()
    this.removeLifecycleListeners()
  },
  methods: {
    removeLifecycleListeners() {
      // #ifdef H5
      if (typeof window !== 'undefined' && this.focusHandler) window.removeEventListener('focus', this.focusHandler)
      if (typeof document !== 'undefined' && this.visibilityHandler) document.removeEventListener('visibilitychange', this.visibilityHandler)
      this.focusHandler = null
      this.visibilityHandler = null
      // #endif
    },
    logLifecycle(event = '') {
      if (!this.isDevelopment) return
      console.log('[miniapp-login:lifecycle]', {
        event,
        hasTicket: !!this.loginTicket,
        ticketStatus: this.status,
        polling: !!this.pollTimer,
        explicitCancel: !!this.isExplicitCancelling,
        regenerating: !!this.isRegenerating
      })
    },
    refreshCloudStatus() {
      // #ifdef H5
      this.cloudStatus = getCloudWebClientStatus()
      // #endif
    },
    clearDebugError() {
      this.debugError = false
      this.debugErrorCode = ''
      this.debugErrorMessage = ''
    },
    sanitizeDebugMessage(message = '') {
      return String(message || '')
        .replace(/(sessionToken|token|ticket|openid|openId|unionid|unionId)\s*[:=]\s*[^,\s}]+/ig, '$1:[redacted]')
        .slice(0, 240)
    },
    setDebugError(result = {}, fallbackMessage = '') {
      this.debugError = true
      this.debugErrorCode = result && result.errorCode ? String(result.errorCode) : 'UNKNOWN_ERROR'
      this.debugErrorMessage = this.sanitizeDebugMessage(result && result.message ? result.message : fallbackMessage)
    },
    isDarkCell(row, col) {
      const seed = `${this.loginTicket}:${row}:${col}`
      let total = 0
      for (let i = 0; i < seed.length; i += 1) total += seed.charCodeAt(i)
      return row < 2 || col < 2 || row > 6 || col > 6 || total % 3 === 0
    },
    async renewTicket() {
      const oldTicket = this.loginTicket
      const oldState = {
        loginTicket: this.loginTicket,
        qrPayload: this.qrPayload,
        expiresAt: this.expiresAt,
        pollIntervalMs: this.pollIntervalMs,
        status: this.status
      }
      const generationId = this.ticketGenerationId + 1
      this.ticketGenerationId = generationId
      this.isRegenerating = true
      this.logLifecycle('regenerateStart')
      this.stopPolling()
      this.stopCountdown()
      this.loading = true
      this.message = ''
      this.clearDebugError()
      this.refreshCloudStatus()
      try {
        const result = await startMiniappWebLogin()
        this.refreshCloudStatus()
        if (generationId !== this.ticketGenerationId) {
          this.logLifecycle('regenerateStaleIgnored')
          return
        }
        if (!result || !result.success) {
          this.status = MINIAPP_WEB_LOGIN_STATUSES.FAILED
          this.message = result && result.message ? result.message : 'Failed to create login QR'
          this.setDebugError(result, this.message)
          if (oldState.loginTicket) {
            this.loginTicket = oldState.loginTicket
            this.qrPayload = oldState.qrPayload
            this.expiresAt = oldState.expiresAt
            this.pollIntervalMs = oldState.pollIntervalMs
            this.status = oldState.status || MINIAPP_WEB_LOGIN_STATUSES.PENDING
            this.updateRemainingSeconds()
            this.startCountdown()
            this.startPolling()
          }
          return
        }
        this.clearDebugError()
        this.loginTicket = result.loginTicket || ''
        this.qrPayload = result.qrPayload || ''
        this.expiresAt = result.expiresAt || ''
        this.pollIntervalMs = result.pollIntervalMs || 2000
        this.status = result.status || MINIAPP_WEB_LOGIN_STATUSES.PENDING
        this.updateRemainingSeconds()
        this.startCountdown()
        this.startPolling()
        if (oldTicket && oldTicket !== this.loginTicket) {
          this.cancelTicketSnapshot(oldTicket, 'regenerateOldTicket', generationId)
        }
      } catch (error) {
        this.status = MINIAPP_WEB_LOGIN_STATUSES.FAILED
        this.message = 'Failed to create login QR'
        this.setDebugError({
          errorCode: error && (error.errorCode || error.code) ? (error.errorCode || error.code) : 'UNKNOWN_ERROR',
          message: error && error.message ? error.message : this.message
        }, this.message)
        if (oldState.loginTicket) {
          this.loginTicket = oldState.loginTicket
          this.qrPayload = oldState.qrPayload
          this.expiresAt = oldState.expiresAt
          this.pollIntervalMs = oldState.pollIntervalMs
          this.status = oldState.status || MINIAPP_WEB_LOGIN_STATUSES.PENDING
          this.updateRemainingSeconds()
          this.startCountdown()
          this.startPolling()
        }
      } finally {
        if (generationId === this.ticketGenerationId) this.isRegenerating = false
        this.loading = false
        this.logLifecycle('regenerateEnd')
      }
    },
    startPolling() {
      if (!this.loginTicket) return
      this.pollTimer = setInterval(() => {
        this.pollOnce()
      }, this.pollIntervalMs)
      this.pollOnce()
    },
    stopPolling() {
      if (this.pollTimer) clearInterval(this.pollTimer)
      this.pollTimer = null
    },
    startCountdown() {
      this.countdownTimer = setInterval(() => {
        this.updateRemainingSeconds()
      }, 1000)
    },
    stopCountdown() {
      if (this.countdownTimer) clearInterval(this.countdownTimer)
      this.countdownTimer = null
    },
    updateRemainingSeconds() {
      const expiresAt = new Date(this.expiresAt).getTime()
      this.remainingSeconds = expiresAt ? Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000)) : 0
      if (!this.remainingSeconds && this.status === MINIAPP_WEB_LOGIN_STATUSES.PENDING) {
        this.status = MINIAPP_WEB_LOGIN_STATUSES.EXPIRED
        this.stopPolling()
      }
    },
    async pollOnce() {
      if (!this.loginTicket) return
      const result = await pollMiniappWebLogin(this.loginTicket)
      this.refreshCloudStatus()
      if (!result || !result.success) {
        this.status = MINIAPP_WEB_LOGIN_STATUSES.FAILED
        this.message = result && result.message ? result.message : 'Failed to query login status'
        this.setDebugError(result, this.message)
        this.stopPolling()
        return
      }
      this.clearDebugError()
      this.status = result.status || this.status
      if (this.status === MINIAPP_WEB_LOGIN_STATUSES.CONFIRMED) {
        await this.consumeConfirmedTicket()
      }
      if ([MINIAPP_WEB_LOGIN_STATUSES.EXPIRED, MINIAPP_WEB_LOGIN_STATUSES.CANCELLED, MINIAPP_WEB_LOGIN_STATUSES.CONSUMED].includes(this.status)) {
        this.stopPolling()
      }
    },
    async consumeConfirmedTicket() {
      this.stopPolling()
      const result = await completeMiniappWebLogin(this.loginTicket)
      this.refreshCloudStatus()
      if (!result || !result.success || !result.session) {
        this.status = MINIAPP_WEB_LOGIN_STATUSES.FAILED
        this.message = result && result.message ? result.message : 'Failed to create web session'
        this.setDebugError(result, this.message)
        return
      }
      this.clearDebugError()
      this.status = MINIAPP_WEB_LOGIN_STATUSES.AUTHENTICATED
      const session = setSession({
        ...result.session,
        authSource: 'cloud_authenticated',
        authMode: 'cloud_authenticated',
        authProvider: 'miniapp_scan',
        authCapability: 'miniapp_scan'
      })
      uni.showToast({ title: 'Login successful', icon: 'none' })
      await this.routeAfterLogin(session)
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
    copyPayload() {
      if (!this.qrPayload) return
      this.logLifecycle('copyPayload')
      uni.setClipboardData({ data: this.qrPayload })
    },
    async cancelTicketSnapshot(ticket = '', reason = '', generationId = 0) {
      if (!ticket || this.cancelledTicketMap[ticket]) return null
      this.cancelledTicketMap = {
        ...this.cancelledTicketMap,
        [ticket]: true
      }
      const ticketAtStart = ticket
      const currentTicketAtStart = this.loginTicket
      this.logLifecycle(reason || 'cancelTicketSnapshot')
      try {
        const result = await cancelMiniappWebLogin(ticketAtStart)
        if (this.loginTicket !== ticketAtStart || currentTicketAtStart !== ticketAtStart) {
          this.logLifecycle('staleCancelIgnored')
          return result
        }
        if (generationId && generationId !== this.ticketGenerationId) {
          this.logLifecycle('staleGenerationCancelIgnored')
          return result
        }
        if (this.isExplicitCancelling) {
          this.status = MINIAPP_WEB_LOGIN_STATUSES.CANCELLED
          this.loginTicket = ''
          this.qrPayload = ''
          this.expiresAt = ''
          this.remainingSeconds = 0
        }
        return result
      } catch (error) {
        return null
      }
    },
    async cancelAndBack() {
      this.isExplicitCancelling = true
      const ticket = this.loginTicket
      this.stopPolling()
      this.stopCountdown()
      if (ticket) await this.cancelTicketSnapshot(ticket, 'explicitCancel')
      this.isExplicitCancelling = false
      navigateEnterpriseWeb('login')
    }
  }
}
</script>

<style scoped>
.miniapp-login-page { min-height: 100vh; display: flex; justify-content: center; align-items: center; padding: 32px; background: linear-gradient(135deg, #f8fbff 0%, #eef2ff 50%, #f7f3ff 100%); box-sizing: border-box; }
.login-panel { width: 100%; max-width: 720px; padding: 36px; border-radius: 24px; background: rgba(255,255,255,0.96); border: 1px solid #e5e7eb; box-shadow: 0 24px 70px rgba(79,70,229,0.14); box-sizing: border-box; }
.kicker,.desc,.qr-note,.payload-label,.payload-text,.message,.platform-tip { color: #64748b; }
.kicker { display: block; font-size: 13px; font-weight: 800; }
.title { display: block; margin-top: 8px; color: #111827; font-size: 32px; font-weight: 800; }
.desc { display: block; margin-top: 10px; font-size: 14px; line-height: 1.8; }
.qr-card { margin-top: 24px; padding: 22px; border-radius: 20px; background: #f8fafc; border: 1px solid #e2e8f0; text-align: center; }
.qr-placeholder { display: inline-flex; flex-direction: column; gap: 4px; padding: 16px; border-radius: 18px; background: #fff; border: 1px solid #e5e7eb; }
.qr-row { display: flex; gap: 4px; }
.qr-cell { width: 14px; height: 14px; border-radius: 3px; background: #eef2ff; }
.qr-cell.dark { background: #111827; }
.qr-note { display: block; margin-top: 14px; font-size: 13px; line-height: 1.7; }
.payload-label { display: block; margin-top: 16px; font-size: 12px; font-weight: 700; }
.payload-text { display: block; margin-top: 6px; padding: 10px; border-radius: 12px; background: #fff; word-break: break-all; font-size: 12px; line-height: 1.6; }
.copy-btn,.primary-btn,.ghost-btn { height: 40px; line-height: 40px; border-radius: 12px; font-size: 14px; }
.copy-btn { margin-top: 12px; background: #111827; color: #fff; }
.status-card { margin-top: 16px; padding: 16px; border-radius: 16px; background: #fff; border: 1px solid #e5e7eb; }
.status-row { display: flex; justify-content: space-between; gap: 12px; padding: 7px 0; color: #334155; font-size: 13px; }
.status-row text:last-child { color: #4f46e5; font-weight: 800; }
.actions { display: flex; gap: 12px; margin-top: 18px; }
.primary-btn { flex: 1; background: #4f46e5; color: #fff; }
.ghost-btn { flex: 1; background: #eef2ff; color: #4f46e5; }
.message { display: block; margin-top: 12px; text-align: center; font-size: 13px; }
.debug-card { margin-top: 14px; padding: 14px; border-radius: 14px; background: #0f172a; color: #cbd5e1; text-align: left; }
.debug-title { display: block; color: #fff; font-size: 12px; font-weight: 800; }
.debug-line { display: block; margin-top: 6px; font-size: 12px; line-height: 1.5; word-break: break-word; }
@media (max-width: 720px) {
  .miniapp-login-page { padding: 18px; align-items: flex-start; }
  .login-panel { padding: 24px; }
  .title { font-size: 26px; }
  .actions { display: block; }
  .ghost-btn { margin-top: 10px; }
}
</style>
