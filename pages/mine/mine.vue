<template>
  <view class="mine-page">
    <view class="profile-card">
      <image v-if="isAuthenticated && accountUser.avatarUrl" class="avatar-image" :src="accountUser.avatarUrl" mode="aspectFill"></image>
      <image v-else class="avatar-image avatar-brand" src="/static/logo.png" mode="aspectFit"></image>
      <view class="profile-copy">
        <text class="profile-name">{{ displayName }}</text>
        <text class="profile-status">{{ profileStatusText }}</text>
      </view>
      <text v-if="isAuthenticated && usageAvailable" class="plan-pill" @click="goToPackageCenter">{{ currentPlan.name }}</text>
      <text v-else class="identity-pill">{{ isAuthenticated ? '同步中' : '未登录' }}</text>
    </view>

    <view class="quota-card">
      <view class="quota-head">
        <view class="quota-heading">
          <text class="quota-title">本周期可用额度</text>
          <text v-if="isAuthenticated && usageAvailable" class="quota-caption">当前套餐：{{ currentPlan.name }}</text>
          <text v-else class="quota-caption">AI 点数按实际会员记录展示</text>
        </view>
        <button v-if="isAuthenticated && usageAvailable" class="quota-upgrade" @click="goToPackageCenter">{{ upgradeActionLabel }}</button>
      </view>

      <view v-if="!isAuthenticated" class="quota-state account-state">
        <text class="state-title">登录后查看作品和额度</text>
        <text class="state-desc">当前未检测到有效微信身份，不展示演示会员或默认点数。</text>
        <button class="state-action" @click="refreshAccount">重新同步</button>
      </view>
      <view v-else-if="usageLoading" class="quota-state">正在加载额度…</view>
      <view v-else-if="usageError || !usageAvailable" class="quota-state account-state error">
        <text class="state-title">额度暂时无法获取</text>
        <text class="state-desc">不会使用默认点数代替真实记录。</text>
        <button class="state-action" @click="refreshAccount">重新加载</button>
      </view>
      <template v-else>
        <view class="remaining-row">
          <text class="remaining-label">剩余 AI 点数</text>
          <view class="remaining-number"><text class="remaining-value">{{ safeUsage.remaining }}</text><text class="remaining-unit">点</text></view>
        </view>
        <view class="quota-progress" aria-label="AI点数已使用比例">
          <view class="quota-progress-value" :style="{ width: usedPercent + '%' }"></view>
        </view>
        <text class="progress-caption">已使用 {{ usedPercent }}%，剩余 {{ safeUsage.remaining }} 点</text>
        <view class="quota-metrics">
          <view><text>{{ safeUsage.total }}</text><text>总点数</text></view>
          <view><text>{{ safeUsage.used }}</text><text>已使用</text></view>
          <view><text>{{ safeUsage.remaining }}</text><text>剩余点数</text></view>
        </view>
        <view class="quota-foot">
          <text>{{ resetTimeLabel }}</text>
          <text class="usage-record-link" @click="goToUsageRecords">使用明细 ›</text>
        </view>
        <text v-if="membershipDisplay.mockLabel" class="mock-label">{{ membershipDisplay.mockLabel }}</text>
        <view v-if="safeUsage.remaining === 0" class="quota-shortage" @click="goToPackageCenter">
          <text>AI 点数不足，了解更多套餐权益</text>
          <text>查看套餐 ›</text>
        </view>
      </template>
    </view>

    <view class="task-section">
      <view class="section-heading">
        <text class="section-title">我的任务</text>
        <text class="section-desc">快速查看需要关注的生成状态</text>
      </view>
      <view class="task-status-grid">
        <view v-for="item in taskStatusEntries" :key="item.filter" class="task-status-entry" @click="goToTaskList(item.filter)">
          <text class="task-status-count">{{ taskStatsLabel(item.key) }}</text>
          <text class="task-status-name">{{ item.label }}</text>
        </view>
      </view>
      <view class="works-entry" @click="goToGallery">
        <text class="shortcut-icon works">作</text>
        <view><text class="shortcut-title">我的作品</text><text class="shortcut-desc">查看已生成的图片、视频和设计素材</text></view>
        <text class="menu-arrow">›</text>
      </view>
      <view class="materials-heading"><text class="section-title">我的素材</text></view>
      <view class="works-entry" @click="goToModelProfiles">
        <text class="shortcut-icon models">模</text>
        <view><text class="shortcut-title">常用模特</text><text class="shortcut-desc">管理已授权的人像参考图</text></view>
        <text class="menu-arrow">›</text>
      </view>
    </view>

    <view class="service-card">
      <view class="service-group">
        <text class="service-group-title">创作与会员</text>
        <view class="menu-row" @click="goToPackageCenter">
          <text class="menu-icon member">会</text>
          <view class="menu-copy"><text>会员中心</text><text>查看当前套餐、额度和会员权益</text></view>
          <text class="menu-arrow">›</text>
        </view>
        <view class="menu-row" @click="goToPatternLibrary">
          <text class="menu-icon pattern">版</text>
          <view class="menu-copy"><text>我的版型</text><text>查看已保存的结构图和版型版本</text></view>
          <text class="menu-arrow">›</text>
        </view>
        <view class="menu-row" @click="goToEnterpriseCooperation">
          <text class="menu-icon enterprise">企</text>
          <view class="menu-copy"><text>企业合作</text><text>批量生产、人工精修与企业服务</text></view>
          <text class="menu-arrow">›</text>
        </view>
      </view>

      <view class="service-divider"></view>

      <view class="service-group">
        <text class="service-group-title">服务与支持</text>
        <button class="menu-row contact-row" open-type="contact" @contact="handleContactResult" @error="handleContactFailure">
          <text class="menu-icon service">客</text>
          <view class="menu-copy"><text>联系客服</text><text>咨询使用问题、额度和售后服务</text></view>
          <text class="menu-arrow">›</text>
        </button>
        <view class="menu-row" @click="goToSettings">
          <text class="menu-icon settings">设</text>
          <view class="menu-copy"><text>设置</text><text>管理偏好、权限、缓存和应用信息</text></view>
          <text class="menu-arrow">›</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script>
import { refreshMembershipUsage } from '../../utils/member/membershipRepository'
import { buildMembershipDisplay } from '../../utils/member/membershipDisplay'
import { getCurrentPlan } from '../../utils/member/planRepository'
import { getUserAccountCenter } from '../../utils/user/userRepository'
import { getTaskCenterSnapshot } from '../../utils/workspace/productionRecordRepository'
import { openWebsiteFeature } from '../../utils/navigation/websiteFeatureRouter'

const EMPTY_USAGE = Object.freeze({
  total: 0,
  used: 0,
  remaining: 0,
  resetAt: '',
  period: '',
  available: false,
  isFallback: true,
  exhausted: false
})

function safeNumber(value) {
  const number = Number(value)
  return Number.isFinite(number) && number >= 0 ? number : 0
}

export default {
  data() {
    return {
      accountCenter: getUserAccountCenter(),
      membershipUsage: { ...EMPTY_USAGE },
      currentPlan: getCurrentPlan(),
      usageLoading: true,
      usageError: false,
      accountRefreshing: false,
      navigationLocked: false,
      taskStatsLoading: true,
      taskStatsError: false,
      taskStats: { all: 0, processing: 0, completed: 0, failed: 0 },
      taskStatusEntries: [
        { key: 'processing', filter: 'processing', label: '进行中' },
        { key: 'completed', filter: 'completed', label: '已完成' },
        { key: 'failed', filter: 'failed', label: '需要处理' },
        { key: 'all', filter: 'all', label: '全部记录' }
      ]
    }
  },
  computed: {
    accountUser() {
      return this.accountCenter.user || {}
    },
    isAuthenticated() {
      const openId = String(this.accountUser.openId || '').trim()
      return Boolean(openId && !openId.startsWith('mock_'))
    },
    usageAvailable() {
      return this.membershipUsage.available === true && this.membershipUsage.isFallback !== true
    },
    displayName() {
      if (!this.isAuthenticated) return '蝶变用户'
      return this.accountUser.nickname || this.accountUser.name || '蝶变用户'
    },
    profileStatusText() {
      if (!this.isAuthenticated) return '登录后查看作品和额度'
      if (this.usageLoading) return '正在同步会员信息'
      if (this.usageError || !this.usageAvailable) return '会员信息暂时无法获取'
      return this.membershipLevelLabel
    },
    membershipDisplay() {
      return buildMembershipDisplay(this.membershipUsage, this.currentPlan)
    },
    safeUsage() {
      return {
        total: safeNumber(this.membershipDisplay.total),
        used: safeNumber(this.membershipDisplay.used),
        remaining: safeNumber(this.membershipDisplay.remaining)
      }
    },
    usedPercent() {
      if (!this.safeUsage.total) return 0
      return Math.min(100, Math.max(0, Math.round((this.safeUsage.used / this.safeUsage.total) * 100)))
    },
    membershipLevelLabel() {
      const labels = {
        trial: '体验会员',
        basic: '基础会员',
        professional: '专业会员',
        enterprise: '企业会员'
      }
      return labels[this.currentPlan.type] || '会员'
    },
    upgradeActionLabel() {
      if (['trial', 'basic'].includes(this.currentPlan.type)) return '了解专业版'
      return '查看套餐'
    },
    resetTimeLabel() {
      return this.membershipDisplay.resetText
    }
  },
  onShow() {
    this.refreshAccount()
    this.refreshTaskStats()
  },
  onUnload() {
    if (this._navigationUnlockTimer) clearTimeout(this._navigationUnlockTimer)
  },
  methods: {
    refreshTaskStats() {
      this.taskStatsLoading = true
      this.taskStatsError = false
      try {
        const snapshot = getTaskCenterSnapshot({ limit: 1 })
        if (!snapshot.identityAvailable) throw new Error('identity_unavailable')
        this.taskStats = snapshot.stats
      } catch (error) {
        this.taskStatsError = true
      } finally {
        this.taskStatsLoading = false
      }
    },
    taskStatsLabel(key = '') {
      if (this.taskStatsLoading || this.taskStatsError) return '—'
      return String(this.taskStats[key] || 0)
    },
    async refreshAccount() {
      if (this.accountRefreshing) return
      this.accountRefreshing = true
      this.usageLoading = true
      this.usageError = false
      this.membershipUsage = { ...EMPTY_USAGE }
      try {
        this.accountCenter = getUserAccountCenter()
        const result = await refreshMembershipUsage()
        this.accountCenter = getUserAccountCenter()
        if (!result || result.ok !== true || !result.data || result.data.available !== true || result.data.isFallback === true) {
          this.usageError = true
          return
        }
        this.membershipUsage = { ...EMPTY_USAGE, ...result.data }
        this.currentPlan = getCurrentPlan(result.data)
      } catch (error) {
        this.usageError = true
      } finally {
        this.usageLoading = false
        this.accountRefreshing = false
      }
    },
    navigateAccountEntry({ type = 'navigateTo', url = '', label = '页面' } = {}) {
      if (!url || this.navigationLocked) return
      const navigator = uni[type]
      if (typeof navigator !== 'function') {
        uni.showToast({ title: `${label}暂时无法打开`, icon: 'none' })
        return
      }
      this.navigationLocked = true
      navigator({
        url,
        fail: () => uni.showToast({ title: `${label}暂时无法打开`, icon: 'none' }),
        complete: () => {
          if (this._navigationUnlockTimer) clearTimeout(this._navigationUnlockTimer)
          this._navigationUnlockTimer = setTimeout(() => {
            this.navigationLocked = false
          }, 700)
        }
      })
    },
    goToGallery() {
      this.navigateAccountEntry({ type: 'switchTab', url: '/pages/gallery/gallery', label: '我的作品' })
    },
    goToModelProfiles() {
      this.navigateAccountEntry({ url: '/package-assets/model-profiles/model-profiles', label: '常用模特' })
    },
    goToTaskList(filter = 'all') {
      this.navigateAccountEntry({ url: `/package-assets/task-list/task-list?filter=${encodeURIComponent(filter)}`, label: '生产记录' })
    },
    goToPackageCenter() {
      this.navigateAccountEntry({ url: '/pages/package-center/package-center', label: '会员中心' })
    },
    goToUsageRecords() {
      this.navigateAccountEntry({ url: '/pages/package-center/usage-records', label: '额度明细' })
    },
    goToPatternLibrary() {
      if (this.navigationLocked) return
      this.navigationLocked = true
      openWebsiteFeature('pattern_library')
      setTimeout(() => { this.navigationLocked = false }, 600)
    },
    goToEnterpriseCooperation() {
      this.navigateAccountEntry({
        url: '/pages/service-request/service-request?demandType=enterprise_cooperation&sourcePage=mine',
        label: '企业合作'
      })
    },
    goToSettings() {
      this.navigateAccountEntry({ url: '/pages/settings/settings', label: '设置' })
    },
    handleContactResult(event = {}) {
      const detail = event.detail || {}
      if (detail.errMsg && !/ok$/i.test(String(detail.errMsg))) this.handleContactFailure()
    },
    handleContactFailure() {
      uni.showModal({
        title: '暂时无法打开客服',
        content: '可以前往服务需求页留言，我们会根据提交信息跟进。',
        confirmText: '去留言',
        success: ({ confirm }) => {
          if (!confirm) return
          this.navigateAccountEntry({
            url: '/pages/service-request/service-request?demandType=support_request&sourcePage=mine_support',
            label: '服务留言'
          })
        }
      })
    }
  }
}
</script>

<style scoped>
.mine-page { min-height: 100vh; padding: 24rpx 24rpx calc(150rpx + env(safe-area-inset-bottom)); box-sizing: border-box; background: #f5f6fa; color: #111827; }
.profile-card, .quota-card, .task-section, .service-card { border: 1rpx solid #e8eaf0; border-radius: 24rpx; background: #fff; }
.profile-card { display: flex; min-height: 116rpx; align-items: center; gap: 20rpx; padding: 22rpx 24rpx; box-sizing: border-box; }
.avatar-image { flex: 0 0 auto; width: 84rpx; height: 84rpx; border-radius: 24rpx; background: #eef0ff; }
.avatar-brand { padding: 8rpx; box-sizing: border-box; }
.profile-copy { min-width: 0; flex: 1; }
.profile-name, .profile-status, .quota-title, .quota-caption, .remaining-label, .state-title, .state-desc, .section-title, .section-desc, .shortcut-title, .shortcut-desc, .service-group-title, .menu-copy text, .quota-metrics text, .progress-caption { display: block; }
.profile-name { overflow: hidden; color: #111827; font-size: 34rpx; font-weight: 700; text-overflow: ellipsis; white-space: nowrap; }
.profile-status { margin-top: 7rpx; color: #667085; font-size: 24rpx; }
.plan-pill, .identity-pill { flex: 0 0 auto; padding: 9rpx 15rpx; border-radius: 999rpx; font-size: 21rpx; font-weight: 700; }
.plan-pill { background: #eeedff; color: #4f46e5; }.identity-pill { background: #f2f4f7; color: #667085; }

.quota-card { margin-top: 20rpx; padding: 24rpx; }
.quota-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 20rpx; }.quota-heading { min-width: 0; flex: 1; }
.quota-title { font-size: 30rpx; font-weight: 700; }.quota-caption { margin-top: 6rpx; color: #667085; font-size: 22rpx; }
.quota-upgrade, .state-action { margin: 0; border: 0; border-radius: 14rpx; font-weight: 600; }.quota-upgrade::after, .state-action::after { border: 0; }
.quota-upgrade { flex: 0 0 auto; height: 64rpx; padding: 0 20rpx; background: #4f46e5; color: #fff; font-size: 22rpx; line-height: 64rpx; }
.quota-state { padding: 36rpx 0 14rpx; color: #667085; font-size: 24rpx; text-align: center; }.account-state { display: flex; align-items: center; flex-direction: column; }
.state-title { color: #344054; font-size: 25rpx; font-weight: 700; }.state-desc { max-width: 540rpx; margin-top: 8rpx; color: #667085; font-size: 22rpx; line-height: 1.5; }.quota-state.error .state-title { color: #b42318; }
.state-action { min-width: 180rpx; height: 66rpx; margin-top: 18rpx; background: #f0efff; color: #4f46e5; font-size: 22rpx; line-height: 66rpx; }
.remaining-row { display: flex; align-items: flex-end; justify-content: space-between; margin-top: 24rpx; }.remaining-label { color: #475467; font-size: 23rpx; }.remaining-number { display: flex; align-items: baseline; gap: 7rpx; }
.remaining-value { color: #4f46e5; font-size: 48rpx; font-weight: 800; line-height: 1; }.remaining-unit { color: #4f46e5; font-size: 23rpx; font-weight: 700; }
.quota-progress { height: 11rpx; margin-top: 18rpx; overflow: hidden; border-radius: 999rpx; background: #e7e9ef; }.quota-progress-value { height: 100%; border-radius: inherit; background: #4f46e5; transition: width .2s ease; }
.progress-caption { margin-top: 9rpx; color: #667085; font-size: 21rpx; }
.quota-metrics { display: grid; grid-template-columns: repeat(3,minmax(0,1fr)); gap: 10rpx; margin-top: 20rpx; }.quota-metrics view { padding: 14rpx 6rpx; border-radius: 14rpx; background: #f7f7fa; text-align: center; }.quota-metrics text:first-child { font-size: 27rpx; font-weight: 700; }.quota-metrics text:last-child { margin-top: 4rpx; color: #667085; font-size: 20rpx; }
.quota-foot { display: flex; justify-content: space-between; gap: 16rpx; margin-top: 17rpx; color: #667085; font-size: 21rpx; }.usage-record-link { color: #4f46e5; font-weight: 700; }.mock-label { display: inline-block; margin-top: 12rpx; padding: 5rpx 10rpx; border-radius: 999rpx; background: #fff7ed; color: #b54708; font-size: 19rpx; }
.quota-shortage { display: flex; align-items: center; justify-content: space-between; gap: 12rpx; margin-top: 17rpx; padding: 15rpx 17rpx; border-radius: 14rpx; background: #fff7ed; color: #b54708; font-size: 21rpx; font-weight: 600; }

.task-section { margin-top: 20rpx; padding: 24rpx; }.section-heading { margin-bottom: 18rpx; }.section-title { font-size: 30rpx; font-weight: 700; }.section-desc { margin-top: 6rpx; color: #667085; font-size: 22rpx; }
.task-status-grid { display: grid; grid-template-columns: repeat(4,minmax(0,1fr)); gap: 10rpx; }.task-status-entry { min-width: 0; padding: 16rpx 6rpx; border-radius: 16rpx; background: #f7f8fc; text-align: center; }.task-status-count, .task-status-name { display: block; }.task-status-count { color: #2835a7; font-size: 30rpx; font-weight: 800; }.task-status-name { margin-top: 5rpx; color: #667085; font-size: 19rpx; white-space: nowrap; }
.works-entry { display: grid; min-height: 92rpx; grid-template-columns: 54rpx minmax(0,1fr) 22rpx; align-items: center; gap: 12rpx; margin-top: 14rpx; padding: 14rpx; border: 1rpx solid #e8eaf0; border-radius: 18rpx; background: #fafbfc; box-sizing: border-box; }
.materials-heading { margin-top: 24rpx; }
.shortcut-icon, .menu-icon { flex: 0 0 auto; width: 54rpx; height: 54rpx; border-radius: 15rpx; font-size: 22rpx; font-weight: 700; line-height: 54rpx; text-align: center; }.shortcut-icon.works { background: #eeedff; color: #4f46e5; }.shortcut-icon.records { background: #edf5ff; color: #2563eb; }.shortcut-icon.models { background: #fff3e8; color: #c2410c; }
.shortcut-title { color: #111827; font-size: 26rpx; font-weight: 700; }.shortcut-desc { display: -webkit-box; overflow: hidden; margin-top: 6rpx; color: #667085; font-size: 20rpx; line-height: 1.4; -webkit-box-orient: vertical; -webkit-line-clamp: 2; }

.service-card { margin-top: 20rpx; padding: 22rpx 24rpx; }.service-group-title { margin-bottom: 6rpx; color: #344054; font-size: 27rpx; font-weight: 700; }.service-divider { height: 1rpx; margin: 18rpx 0; background: #eceef2; }
.menu-row { display: flex; width: 100%; min-height: 112rpx; align-items: center; gap: 17rpx; padding: 18rpx 0; border: 0; border-bottom: 1rpx solid #f0f1f4; border-radius: 0; background: transparent; box-sizing: border-box; text-align: left; }.menu-row:last-child { border-bottom: 0; }.contact-row { margin: 0; line-height: normal; }.contact-row::after { border: 0; }
.menu-icon.member { background: #f2efff; color: #6d55c7; }.menu-icon.pattern { background: #edf5ff; color: #1767b5; }.menu-icon.enterprise { background: #eef7f5; color: #2f7f71; }.menu-icon.service { background: #f7f1f5; color: #9a5878; }.menu-icon.settings { background: #f1f3f6; color: #596273; }
.menu-copy { min-width: 0; flex: 1; }.menu-copy text:first-child { color: #111827; font-size: 27rpx; font-weight: 600; }.menu-copy text:last-child { margin-top: 6rpx; overflow: hidden; color: #667085; font-size: 22rpx; text-overflow: ellipsis; white-space: nowrap; }.menu-arrow { color: #98a2b3; font-size: 34rpx; }

@media (max-width: 340px) {
  .mine-page { padding-right: 18rpx; padding-left: 18rpx; }
  .task-status-grid { grid-template-columns: repeat(2,minmax(0,1fr)); }
  .quota-head { align-items: stretch; flex-direction: column; }.quota-upgrade { align-self: flex-start; }
  .menu-copy text:last-child { white-space: normal; }
}
</style>
