<template>
  <view class="settings-page">
    <view class="settings-section">
      <text class="section-title">隐私与授权</text>
      <view class="setting-row" @click="openAuthorizationSettings">
        <view class="row-icon privacy">权</view>
        <view class="row-copy">
          <text class="row-title">系统授权管理</text>
          <text class="row-desc">管理相册、相机等小程序权限</text>
        </view>
        <text class="row-arrow">›</text>
      </view>
      <view v-if="privacyContractAvailable" class="setting-row" @click="openPrivacyContract">
        <view class="row-icon policy">隐</view>
        <view class="row-copy">
          <text class="row-title">隐私政策</text>
          <text class="row-desc">查看当前小程序隐私保护指引</text>
        </view>
        <text class="row-arrow">›</text>
      </view>
    </view>

    <view class="settings-section">
      <text class="section-title">使用偏好</text>
      <view class="setting-row" :class="{ disabled: !notificationCapability.available }" @click="handleNotificationSetting">
        <view class="row-icon notification">醒</view>
        <view class="row-copy">
          <text class="row-title">生成完成提醒</text>
          <text class="row-desc">任务完成或失败时，通过微信服务通知提醒</text>
        </view>
        <text class="row-value">{{ notificationCapability.statusLabel }}</text>
      </view>
      <view class="setting-row" @click="confirmResetOnboarding">
        <view class="row-icon guide">引</view>
        <view class="row-copy">
          <text class="row-title">重新查看新手引导</text>
          <text class="row-desc">下次进入首页时重新显示使用说明</text>
        </view>
        <text class="row-arrow">›</text>
      </view>
      <view class="setting-row" :class="{ disabled: !hasClearableCache || clearingCache }" @click="confirmClearCache">
        <view class="row-icon cache">清</view>
        <view class="row-copy">
          <text class="row-title">清理临时偏好</text>
          <text class="row-desc">{{ cacheStatusText }}</text>
        </view>
        <text class="row-value">{{ clearingCache ? '清理中' : (hasClearableCache ? '可清理' : '已清理') }}</text>
      </view>
      <text class="section-note">不会删除作品、任务、会员额度、登录身份或已保存的场景。</text>
    </view>

    <view class="settings-section">
      <text class="section-title">帮助与关于</text>
      <button class="setting-row contact-row" open-type="contact">
        <view class="row-icon feedback">馈</view>
        <view class="row-copy">
          <text class="row-title">意见反馈</text>
          <text class="row-desc">通过微信客服反馈使用问题</text>
        </view>
        <text class="row-arrow">›</text>
      </button>
      <view class="setting-row" @click="showAbout">
        <view class="row-icon about">蝶</view>
        <view class="row-copy">
          <text class="row-title">关于蝶变</text>
          <text class="row-desc">服装商品视觉生产工具</text>
        </view>
        <text class="row-value">{{ versionLabel }}</text>
      </view>
    </view>

    <text class="security-note">当前版本没有独立账号退出或注销能力，因此未提供无效入口。</text>
  </view>
</template>

<script>
import { resetOnboarding } from '../../utils/onboarding/onboardingRepository'
import { getTaskNotificationCapability, requestTaskNotificationSubscription } from '../../utils/task/taskNotification'

const SAFE_PREFERENCE_KEYS = Object.freeze([
  'diebiandesign_scene_last_selected_v1'
])

function getMiniProgramApi() {
  if (typeof wx !== 'undefined' && wx) return wx
  return null
}

function hasStoredValue(key) {
  try {
    if (typeof uni === 'undefined' || typeof uni.getStorageSync !== 'function') return false
    const value = uni.getStorageSync(key)
    return value !== undefined && value !== null && value !== ''
  } catch (error) {
    return false
  }
}

function removeStoredValue(key) {
  if (typeof uni === 'undefined' || typeof uni.removeStorageSync !== 'function') return false
  uni.removeStorageSync(key)
  return true
}

export default {
  data() {
    return {
      privacyContractAvailable: false,
      hasClearableCache: false,
      clearingCache: false,
      versionLabel: '当前版本',
      notificationCapability: getTaskNotificationCapability(),
      requestingNotification: false
    }
  },
  computed: {
    cacheStatusText() {
      return this.hasClearableCache
        ? '清除场景等页面的临时选择，不影响业务数据'
        : '当前没有需要清理的临时偏好'
    }
  },
  onLoad() {
    this.refreshPlatformCapabilities()
    this.refreshCacheState()
    this.refreshNotificationCapability()
  },
  onShow() {
    this.refreshCacheState()
    this.refreshNotificationCapability()
  },
  methods: {
    refreshNotificationCapability() {
      this.notificationCapability = getTaskNotificationCapability()
    },
    async handleNotificationSetting() {
      if (this.requestingNotification) return
      if (!this.notificationCapability.available) {
        uni.showModal({
          title: '生成提醒暂未开放',
          content: this.notificationCapability.message,
          showCancel: false,
          confirmText: '知道了'
        })
        return
      }
      this.requestingNotification = true
      const result = await requestTaskNotificationSubscription()
      this.requestingNotification = false
      this.refreshNotificationCapability()
      uni.showToast({ title: result.message, icon: 'none' })
    },
    refreshPlatformCapabilities() {
      const api = getMiniProgramApi()
      this.privacyContractAvailable = Boolean(api && typeof api.openPrivacyContract === 'function')
      try {
        if (!api || typeof api.getAccountInfoSync !== 'function') return
        const info = api.getAccountInfoSync() || {}
        const miniProgram = info.miniProgram || {}
        const version = String(miniProgram.version || '').trim()
        const envVersion = String(miniProgram.envVersion || '').trim()
        this.versionLabel = version || (envVersion === 'develop' ? '开发版本' : envVersion === 'trial' ? '体验版本' : '当前版本')
      } catch (error) {
        this.versionLabel = '当前版本'
      }
    },
    refreshCacheState() {
      this.hasClearableCache = SAFE_PREFERENCE_KEYS.some(hasStoredValue)
    },
    openAuthorizationSettings() {
      if (typeof uni === 'undefined' || typeof uni.openSetting !== 'function') {
        uni.showToast({ title: '当前环境不支持授权设置', icon: 'none' })
        return
      }
      uni.openSetting({
        fail: () => uni.showToast({ title: '暂时无法打开授权设置', icon: 'none' })
      })
    },
    openPrivacyContract() {
      const api = getMiniProgramApi()
      if (!api || typeof api.openPrivacyContract !== 'function') return
      api.openPrivacyContract({
        fail: () => uni.showToast({ title: '暂时无法打开隐私政策', icon: 'none' })
      })
    },
    confirmResetOnboarding() {
      uni.showModal({
        title: '重新查看新手引导',
        content: '重置后，下次进入首页会重新显示新手引导。',
        confirmText: '确认重置',
        success: ({ confirm }) => {
          if (!confirm) return
          const success = resetOnboarding()
          uni.showToast({ title: success ? '已重置新手引导' : '重置失败，请重试', icon: 'none' })
        }
      })
    },
    confirmClearCache() {
      if (!this.hasClearableCache || this.clearingCache) return
      uni.showModal({
        title: '清理临时偏好',
        content: '仅清除页面临时选择，不会删除作品、任务、额度或登录信息。',
        confirmText: '确认清理',
        success: ({ confirm }) => {
          if (confirm) this.clearSafePreferences()
        }
      })
    },
    clearSafePreferences() {
      this.clearingCache = true
      try {
        SAFE_PREFERENCE_KEYS.forEach(removeStoredValue)
        this.refreshCacheState()
        uni.showToast({ title: '临时偏好已清理', icon: 'success' })
      } catch (error) {
        uni.showToast({ title: '清理失败，请重试', icon: 'none' })
      } finally {
        this.clearingCache = false
      }
    },
    showAbout() {
      uni.showModal({
        title: '关于蝶变',
        content: `蝶变 AI，为服装商品视觉生产提供移动创作能力。\n版本：${this.versionLabel}`,
        showCancel: false,
        confirmText: '知道了'
      })
    }
  }
}
</script>

<style scoped>
.settings-page {
  min-height: 100vh;
  padding: 24rpx 24rpx calc(64rpx + env(safe-area-inset-bottom));
  box-sizing: border-box;
  background: #f5f6fa;
  color: #111827;
}

.settings-section {
  margin-bottom: 20rpx;
  padding: 22rpx 24rpx 8rpx;
  border: 1rpx solid #e8eaf0;
  border-radius: 24rpx;
  background: #fff;
}

.section-title {
  display: block;
  margin-bottom: 8rpx;
  color: #344054;
  font-size: 28rpx;
  font-weight: 700;
}

.setting-row {
  display: flex;
  width: 100%;
  min-height: 112rpx;
  align-items: center;
  gap: 16rpx;
  padding: 18rpx 0;
  border: 0;
  border-bottom: 1rpx solid #f0f1f4;
  border-radius: 0;
  background: transparent;
  box-sizing: border-box;
  text-align: left;
}

.setting-row:last-of-type { border-bottom: 0; }
.setting-row.disabled { opacity: .58; }
.contact-row { margin: 0; line-height: normal; }
.contact-row::after { border: 0; }

.row-icon {
  flex: 0 0 auto;
  width: 56rpx;
  height: 56rpx;
  border-radius: 16rpx;
  font-size: 22rpx;
  font-weight: 700;
  line-height: 56rpx;
  text-align: center;
}

.row-icon.privacy, .row-icon.policy { background: #eef3ff; color: #3157b7; }
.row-icon.notification { background: #eef4ff; color: #3157b7; }
.row-icon.guide { background: #f0efff; color: #5b4ac6; }
.row-icon.cache { background: #eef7f5; color: #277568; }
.row-icon.feedback { background: #fff4e8; color: #a85d12; }
.row-icon.about { background: #f7eef5; color: #915376; }

.row-copy { min-width: 0; flex: 1; }
.row-title, .row-desc { display: block; }
.row-title { color: #111827; font-size: 27rpx; font-weight: 600; }
.row-desc { margin-top: 6rpx; color: #667085; font-size: 22rpx; line-height: 1.45; }
.row-arrow { color: #98a2b3; font-size: 34rpx; }
.row-value { flex: 0 0 auto; color: #667085; font-size: 22rpx; }

.section-note, .security-note {
  display: block;
  color: #667085;
  font-size: 21rpx;
  line-height: 1.5;
}

.section-note { padding: 6rpx 0 16rpx; }
.security-note { padding: 4rpx 18rpx 0; text-align: center; }

@media (max-width: 340px) {
  .settings-page { padding-right: 18rpx; padding-left: 18rpx; }
  .settings-section { padding-right: 20rpx; padding-left: 20rpx; }
  .row-desc { font-size: 21rpx; }
}
</style>
