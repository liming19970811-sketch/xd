<template>
  <view class="enterprise-register-page">
    <!-- #ifdef H5 -->
    <view class="register-card">
      <text class="kicker">{{ labels.kicker }}</text>
      <text class="title">{{ labels.title }}</text>
      <text class="desc">{{ labels.desc }}</text>

      <view class="form-grid">
        <view class="field">
          <text>{{ labels.enterpriseName }}</text>
          <input v-model="form.enterpriseName" :placeholder="labels.enterpriseNamePlaceholder" />
        </view>
        <view class="field">
          <text>{{ labels.contactName }}</text>
          <input v-model="form.contactName" :placeholder="labels.contactNamePlaceholder" />
        </view>
        <view class="field">
          <text>{{ labels.contactPhone }}</text>
          <input v-model="form.contactPhone" :placeholder="labels.contactPhonePlaceholder" />
        </view>
        <view class="field">
          <text>{{ labels.industry }}</text>
          <input v-model="form.industry" :placeholder="labels.industryPlaceholder" />
        </view>
        <view class="field">
          <text>{{ labels.teamSize }}</text>
          <input v-model="form.teamSize" :placeholder="labels.teamSizePlaceholder" />
        </view>
      </view>

      <button class="primary-btn" :disabled="submitting" @click="submit">
        {{ submitting ? labels.creating : labels.create }}
      </button>
      <button class="ghost-btn" :disabled="submitting" @click="goLogin">{{ labels.back }}</button>
      <text v-if="message" class="message">{{ message }}</text>
    </view>
    <!-- #endif -->
    <!-- #ifndef H5 -->
    <view class="platform-tip">{{ labels.h5Only }}</view>
    <!-- #endif -->
  </view>
</template>

<script>
import { getCurrentContext } from '../../utils/auth/authRepository.js'
import { getCurrentSession, resolvePostLoginRoute } from '../../utils/auth/authSessionService.js'
import { registerEnterprise } from '../../utils/auth/enterpriseRegistrationService.js'
import { navigateEnterpriseWeb } from '../../utils/enterprise-web/enterpriseWebRoutes.js'

const LABELS = Object.freeze({
  kicker: '\u4f01\u4e1a\u6ce8\u518c',
  title: '\u521b\u5efa\u4f01\u4e1a',
  desc: '\u521b\u5efa\u4f01\u4e1a\u5de5\u4f5c\u7a7a\u95f4\uff0c\u5f53\u524d\u7528\u6237\u5c06\u81ea\u52a8\u6210\u4e3a\u4f01\u4e1a\u7ba1\u7406\u5458\u3002\u9996\u6b21\u6210\u5458\u7531\u7cfb\u7edf\u81ea\u52a8\u521b\u5efa\u4e3a\u7ba1\u7406\u5458\u3002',
  enterpriseName: '\u4f01\u4e1a\u540d\u79f0',
  contactName: '\u8054\u7cfb\u4eba\u59d3\u540d',
  contactPhone: '\u8054\u7cfb\u7535\u8bdd',
  industry: '\u6240\u5c5e\u884c\u4e1a',
  teamSize: '\u56e2\u961f\u89c4\u6a21',
  enterpriseNamePlaceholder: '\u8bf7\u8f93\u5165\u4f01\u4e1a\u540d\u79f0',
  contactNamePlaceholder: '\u8bf7\u8f93\u5165\u8054\u7cfb\u4eba\u59d3\u540d',
  contactPhonePlaceholder: '\u8bf7\u8f93\u5165\u8054\u7cfb\u7535\u8bdd',
  industryPlaceholder: '\u4f8b\u5982\uff1a\u670d\u88c5\u54c1\u724c\u3001\u670d\u88c5\u5de5\u5382',
  teamSizePlaceholder: '\u4f8b\u5982\uff1a1-10\u4eba',
  create: '\u521b\u5efa\u4f01\u4e1a\u5e76\u8fdb\u5165\u5de5\u4f5c\u53f0',
  creating: '\u521b\u5efa\u4e2d...',
  back: '\u8fd4\u56de\u767b\u5f55',
  h5Only: '\u4f01\u4e1a\u7f51\u9875\u7248\u6ce8\u518c\u4ec5\u5728 H5 \u5e73\u53f0\u663e\u793a\u3002',
  nameTooShort: '\u4f01\u4e1a\u540d\u79f0\u81f3\u5c11\u9700\u89812\u4e2a\u5b57\u7b26',
  nameTooLong: '\u4f01\u4e1a\u540d\u79f0\u4e0d\u80fd\u8d85\u8fc750\u4e2a\u5b57\u7b26',
  contactRequired: '\u8bf7\u8f93\u5165\u8054\u7cfb\u4eba\u59d3\u540d',
  phoneRequired: '\u8bf7\u8f93\u5165\u8054\u7cfb\u7535\u8bdd',
  phoneInvalid: '\u8054\u7cfb\u7535\u8bdd\u683c\u5f0f\u4e0d\u6b63\u786e',
  created: '\u4f01\u4e1a\u5df2\u521b\u5efa',
  failed: '\u4f01\u4e1a\u521b\u5efa\u5931\u8d25\uff0c\u8bf7\u7a0d\u540e\u91cd\u8bd5'
})

export default {
  data() {
    const context = getCurrentContext()
    return {
      labels: LABELS,
      submitting: false,
      message: '',
      form: {
        enterpriseName: '',
        contactName: context.currentUser.name || '',
        contactPhone: '',
        industry: '',
        teamSize: ''
      }
    }
  },
  async onShow() {
    const session = getCurrentSession()
    if (!session) {
      navigateEnterpriseWeb('login')
      return
    }
    const route = await resolvePostLoginRoute(session)
    if (route.type === 'dashboard') {
      navigateEnterpriseWeb('dashboard')
      return
    }
    if (route.type === 'select_enterprise') {
      navigateEnterpriseWeb('selectEnterprise')
      return
    }
    if (route.type === 'login') {
      navigateEnterpriseWeb('login')
    }
  },
  methods: {
    validateForm() {
      const enterpriseName = String(this.form.enterpriseName || '').trim()
      const contactName = String(this.form.contactName || '').trim()
      const contactPhone = String(this.form.contactPhone || '').trim()
      if (enterpriseName.length < 2) return this.labels.nameTooShort
      if (enterpriseName.length > 50) return this.labels.nameTooLong
      if (!contactName) return this.labels.contactRequired
      if (!contactPhone) return this.labels.phoneRequired
      if (!/^[0-9+\-\s()]{6,20}$/.test(contactPhone)) return this.labels.phoneInvalid
      return ''
    },
    getErrorMessage(result = {}) {
      const messages = {
        authentication_required: '\u8bf7\u5148\u5b8c\u6210\u767b\u5f55',
        session_invalid: '\u767b\u5f55\u72b6\u6001\u5df2\u5931\u6548\uff0c\u8bf7\u91cd\u65b0\u767b\u5f55',
        session_expired: '\u767b\u5f55\u5df2\u8fc7\u671f\uff0c\u8bf7\u91cd\u65b0\u626b\u7801\u767b\u5f55',
        enterprise_name_invalid: '\u4f01\u4e1a\u540d\u79f0\u683c\u5f0f\u4e0d\u6b63\u786e',
        register_failed: this.labels.failed
      }
      return messages[result.errorCode] || result.message || this.labels.failed
    },
    async submit() {
      if (this.submitting) return
      const validationMessage = this.validateForm()
      if (validationMessage) {
        this.message = validationMessage
        return
      }
      this.submitting = true
      this.message = ''
      try {
        const result = await registerEnterprise({
          enterpriseName: String(this.form.enterpriseName || '').trim(),
          contactName: String(this.form.contactName || '').trim(),
          contactPhone: String(this.form.contactPhone || '').trim(),
          industry: String(this.form.industry || '').trim(),
          teamSize: String(this.form.teamSize || '').trim()
        })
        if (!result || !result.success) {
          this.message = this.getErrorMessage(result || {})
          return
        }
        uni.showToast({ title: this.labels.created, icon: 'none' })
        navigateEnterpriseWeb('dashboard')
      } catch (error) {
        this.message = this.labels.failed
      } finally {
        this.submitting = false
      }
    },
    goLogin() {
      if (this.submitting) return
      navigateEnterpriseWeb('login')
    }
  }
}
</script>

<style scoped>
.enterprise-register-page { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 32px; background: #f4f6fb; box-sizing: border-box; }
.register-card { width: 100%; max-width: 680px; padding: 36px; border-radius: 22px; background: #fff; border: 1px solid #e5e7eb; box-shadow: 0 24px 70px rgba(15,23,42,0.08); }
.kicker,.desc,.field text,.message,.platform-tip { color: #64748b; }
.kicker { display: block; font-size: 13px; font-weight: 800; }
.title { display: block; margin-top: 8px; color: #111827; font-size: 30px; font-weight: 800; }
.desc { display: block; margin-top: 10px; font-size: 14px; line-height: 1.8; }
.form-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; margin-top: 24px; }
.field text { display: block; margin-bottom: 8px; font-size: 13px; }
.field input { height: 42px; padding: 0 12px; border-radius: 12px; border: 1px solid #e2e8f0; background: #f8fafc; box-sizing: border-box; }
.primary-btn,.ghost-btn { height: 44px; line-height: 44px; border-radius: 12px; font-size: 15px; }
.primary-btn { margin-top: 24px; background: #4f46e5; color: #fff; }
.ghost-btn { margin-top: 12px; background: #eef2ff; color: #4f46e5; }
.message { display: block; margin-top: 12px; text-align: center; font-size: 13px; }
@media (max-width: 720px) { .form-grid { grid-template-columns: 1fr; } .register-card { padding: 26px; } }
</style>
