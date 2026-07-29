<template>
  <view class="member-page">
    <view class="current-card">
      <text class="current-kicker">会员中心</text>
      <view v-if="identityLoading || usageLoading" class="member-state">
        <text>正在加载会员信息...</text>
      </view>
      <view v-else-if="identityError" class="member-state error-state">
        <text>身份信息暂时无法获取</text>
        <button @click="refreshMembership">重新同步</button>
      </view>
      <view v-else-if="!identityAvailable" class="member-state error-state">
        <text>登录后查看当前套餐和额度</text>
        <button @click="refreshMembership">重新同步</button>
      </view>
      <view v-else-if="usageError || !usageAvailable" class="member-state error-state">
        <text>会员信息暂时无法获取</text>
        <button @click="refreshMembership">重新加载</button>
      </view>
      <view v-else class="current-main">
        <view>
          <text class="current-label">当前套餐</text>
          <text class="current-plan">{{ currentPlan.name }}</text>
        </view>
        <text class="current-status">{{ membershipDisplay.statusText }}</text>
        <view class="current-remaining">
          <text>{{ membershipDisplay.remaining }}</text>
          <text>剩余 AI 点数</text>
        </view>
      </view>
      <view v-if="identityAvailable && usageAvailable && !usageLoading && !usageError" class="usage-summary">
        <view><text>{{ membershipDisplay.total }}</text><text>总点数</text></view>
        <view><text>{{ membershipDisplay.used }}</text><text>已使用</text></view>
        <view><text>{{ membershipDisplay.remaining }}</text><text>剩余点数</text></view>
      </view>
      <view v-if="effectiveDateLabel || expiresDateLabel" class="membership-dates">
        <text v-if="effectiveDateLabel">生效时间：{{ effectiveDateLabel }}</text>
        <text v-if="expiresDateLabel">有效期至：{{ expiresDateLabel }}</text>
      </view>
      <template v-if="identityAvailable && usageAvailable && !usageLoading && !usageError">
        <view class="usage-progress" aria-label="AI点数已使用比例">
          <view class="usage-progress-value" :style="{ width: membershipDisplay.usedPercent + '%' }"></view>
        </view>
        <view class="usage-footer">
          <text>{{ membershipDisplay.resetText }}</text>
          <text @click="goToUsageRecords">查看额度明细 ›</text>
        </view>
        <text v-if="membershipDisplay.mockLabel" class="mock-label">{{ membershipDisplay.mockLabel }}</text>
      </template>
    </view>

    <view class="section-head">
      <text class="section-title">选择适合你的套餐</text>
      <text class="section-desc">当前阶段仅展示升级入口，不会发起微信支付。</text>
    </view>

    <view class="plan-list">
      <view v-for="plan in planCards" :key="plan.planId" class="plan-card" :class="{ recommended: plan.type === 'professional', current: usageAvailable && isCurrentPlan(plan) }">
        <view class="plan-head">
          <view>
            <text class="plan-name">{{ plan.name }}</text>
            <text class="plan-positioning">{{ plan.suitableFor }}</text>
          </view>
          <text v-if="usageAvailable && isCurrentPlan(plan)" class="plan-badge current-badge">当前套餐</text>
          <text v-else-if="plan.type === 'professional'" class="plan-badge">推荐</text>
        </view>
        <view class="plan-quota">
          <text>{{ plan.monthlyPoints }}</text>
          <text>AI 点数 / 当前会员周期</text>
        </view>
        <view class="feature-list">
          <view v-for="feature in plan.features" :key="feature" class="feature-item">
            <text class="feature-dot"></text>
            <text>{{ feature }}</text>
          </view>
        </view>
        <button class="upgrade-btn" :class="{ disabled: usageAvailable && isCurrentPlan(plan) }" :disabled="usageAvailable && isCurrentPlan(plan)" @click="selectPlan(plan)">
          {{ isCurrentPlan(plan) && usageAvailable ? '当前套餐' : `了解${plan.name}` }}
        </button>
      </view>
    </view>

    <view class="comparison-section">
      <view class="section-head comparison-head">
        <text class="section-title">套餐权益比较</text>
        <text class="section-desc">快速了解不同套餐的核心差异。</text>
      </view>
      <view class="comparison-list">
        <view v-for="item in planComparison" :key="item.key" class="comparison-row">
          <text class="comparison-label">{{ item.label }}</text>
          <text class="comparison-summary">{{ item.summary }}</text>
        </view>
      </view>
    </view>

    <text class="safe-note">当前不提供在线购买；如需开通或变更套餐，可提交服务需求。</text>
  </view>
</template>

<script>
import { refreshMembershipUsage } from '../../utils/member/membershipRepository'
import { buildMembershipDisplay, formatMembershipDate } from '../../utils/member/membershipDisplay'
import { getPlans, getCurrentPlan, getPlanComparison } from '../../utils/member/planRepository'
import { getCurrentUser } from '../../utils/user/userRepository'

export default {
  data() {
    return {
      planCards: getPlans(),
      planComparison: getPlanComparison(),
      membershipUsage: { total: 0, used: 0, remaining: 0, resetAt: '', period: '' },
      currentPlan: getCurrentPlan(),
      identityLoading: true,
      identityAvailable: false,
      identityError: false,
      usageLoading: true,
      usageError: false,
      membershipRefreshing: false
    }
  },
  computed: {
    usageAvailable() {
      return this.membershipUsage.available === true && this.membershipUsage.isFallback !== true
    },
    membershipDisplay() {
      return buildMembershipDisplay(this.membershipUsage, this.currentPlan)
    },
    effectiveDateLabel() {
      return formatMembershipDate(this.membershipUsage.effectiveAt)
    },
    expiresDateLabel() {
      return formatMembershipDate(this.membershipUsage.expiresAt)
    }
  },
  onShow() {
    this.refreshMembership()
  },
  methods: {
    async refreshMembership() {
      if (this.membershipRefreshing) return
      this.membershipRefreshing = true
      this.identityLoading = true
      this.usageLoading = true
      this.usageError = false
      this.identityError = false
      try {
        const result = await refreshMembershipUsage()
        const user = getCurrentUser()
        const openId = String(user && user.openId || '').trim()
        this.identityAvailable = Boolean(openId && !openId.startsWith('mock_'))
        if (!result || result.ok !== true || !result.data || result.data.available !== true || result.data.isFallback === true) {
          if (result && result.diagnostics && result.diagnostics.hasOpenid === true) this.identityAvailable = true
          this.usageError = true
          return
        }
        this.membershipUsage = result.data
        this.currentPlan = getCurrentPlan(result.data)
      } catch (error) {
        if (!this.identityAvailable) this.identityError = true
        else this.usageError = true
      } finally {
        this.identityLoading = false
        this.usageLoading = false
        this.membershipRefreshing = false
      }
    },
    isCurrentPlan(plan = {}) {
      return Boolean(plan.planId && plan.planId === this.currentPlan.planId)
    },
    selectPlan(plan = {}) {
      if (this.isCurrentPlan(plan) && this.usageAvailable) return
      uni.showModal({
        title: plan.name || '套餐权益',
        content: `${(plan.features || []).join('、')}。当前不提供在线购买，可提交需求咨询开通方式。`,
        cancelText: '稍后了解',
        confirmText: '咨询服务',
        success: ({ confirm }) => {
          if (!confirm) return
          uni.navigateTo({
            url: `/pages/service-request/service-request?demandType=membership_consultation&sourcePage=package_center&planId=${encodeURIComponent(plan.planId || '')}`,
            fail: () => uni.showToast({ title: '服务咨询暂时无法打开', icon: 'none' })
          })
        }
      })
    },
    goToUsageRecords() {
      uni.navigateTo({
        url: '/pages/package-center/usage-records',
        fail: () => uni.showToast({ title: '额度明细暂时无法打开', icon: 'none' })
      })
    }
  }
}
</script>

<style scoped>
.member-page { min-height: 100vh; padding: 24rpx 24rpx 64rpx; box-sizing: border-box; background: #f6f7fb; color: #111827; }
.current-card,
.plan-card { border-radius: 28rpx; background: #ffffff; box-shadow: 0 12rpx 30rpx rgba(15, 23, 42, 0.06); }
.current-card { padding: 30rpx; background: linear-gradient(145deg, #ffffff, #f2f2ff); }
.member-state { display: flex; min-height: 150rpx; align-items: center; justify-content: center; color: #667085; font-size: 24rpx; }
.member-state.error-state { flex-direction: column; gap: 18rpx; }
.member-state button { min-width: 180rpx; height: 64rpx; margin: 0; border: 0; border-radius: 14rpx; background: #eeedff; color: #4f46e5; font-size: 22rpx; line-height: 64rpx; }
.member-state button::after { border: 0; }
.current-kicker,
.current-label,
.current-plan,
.current-remaining text,
.reset-label,
.usage-error,
.section-title,
.section-desc,
.plan-name,
.plan-desc,
.plan-quota text,
.safe-note { display: block; }
.current-kicker { color: #4f46e5; font-size: 22rpx; font-weight: 700; }
.current-main { display: flex; align-items: flex-end; justify-content: space-between; gap: 20rpx; margin-top: 22rpx; }
.current-label { color: #6b7280; font-size: 22rpx; }
.current-plan { margin-top: 5rpx; font-size: 40rpx; font-weight: 800; }
.current-remaining { text-align: right; }
.current-status { flex: 0 0 auto; align-self: center; padding: 7rpx 13rpx; border-radius: 999rpx; background: #ecfdf3; color: #168754; font-size: 20rpx; font-weight: 700; }
.current-remaining text:first-child { color: #4f46e5; font-size: 42rpx; font-weight: 800; }
.current-remaining text:last-child { margin-top: 3rpx; color: #6b7280; font-size: 20rpx; }
.usage-summary { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12rpx; margin-top: 24rpx; }
.usage-summary view { padding: 16rpx 8rpx; border-radius: 18rpx; background: rgba(255, 255, 255, 0.76); text-align: center; }
.usage-summary text { display: block; }
.usage-summary text:first-child { font-size: 27rpx; font-weight: 800; }
.usage-summary text:last-child { margin-top: 4rpx; color: #6b7280; font-size: 19rpx; }
.reset-label,
.usage-error { margin-top: 20rpx; font-size: 21rpx; }
.reset-label { color: #8b93a2; }
.membership-dates { display: flex; flex-wrap: wrap; gap: 8rpx 20rpx; margin-top: 16rpx; color: #667085; font-size: 21rpx; }
.usage-error { color: #dc2626; }
.section-head { margin: 30rpx 4rpx 18rpx; }
.section-title { font-size: 31rpx; font-weight: 800; }
.section-desc { margin-top: 7rpx; color: #6b7280; font-size: 22rpx; }
.plan-list { display: grid; gap: 18rpx; }
.plan-card { padding: 26rpx; border: 2rpx solid transparent; }
.plan-card.recommended { border-color: #c7c4ff; }
.plan-card.current { background: #fafaff; }
.plan-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 20rpx; }
.plan-name { font-size: 31rpx; font-weight: 800; }
.plan-positioning { display: block; max-width: 500rpx; margin-top: 8rpx; color: #667085; font-size: 21rpx; line-height: 1.45; }
.plan-badge { flex: 0 0 auto; padding: 7rpx 13rpx; border-radius: 999rpx; background: #eef0ff; color: #4f46e5; font-size: 20rpx; }
.current-badge { background: #ecfdf3; color: #168754; }
.plan-quota { display: flex; align-items: baseline; gap: 10rpx; margin: 24rpx 0; }
.plan-quota text:first-child { color: #111827; font-size: 42rpx; font-weight: 800; }
.plan-quota text:last-child { color: #6b7280; font-size: 21rpx; }
.feature-list { display: grid; gap: 12rpx; margin-bottom: 24rpx; }
.feature-item { display: flex; align-items: center; gap: 12rpx; color: #4b5563; font-size: 22rpx; }
.feature-dot { width: 10rpx; height: 10rpx; border-radius: 50%; background: #7c3aed; }
.usage-progress { height: 11rpx; margin-top: 20rpx; overflow: hidden; border-radius: 999rpx; background: #e3e5ec; }.usage-progress-value { height: 100%; border-radius: inherit; background: #4f46e5; }
.usage-footer { display: flex; align-items: center; justify-content: space-between; gap: 16rpx; margin-top: 14rpx; color: #667085; font-size: 21rpx; }.usage-footer text:last-child { color: #4f46e5; font-weight: 700; }.mock-label { display: inline-block; margin-top: 12rpx; padding: 5rpx 10rpx; border-radius: 999rpx; background: #fff7ed; color: #b54708; font-size: 19rpx; }
.upgrade-btn { height: 72rpx; border: 0; border-radius: 17rpx; background: #4f46e5; color: #ffffff; font-size: 25rpx; line-height: 72rpx; }
.upgrade-btn.disabled { background: #e5e7eb; color: #6b7280; }
.upgrade-btn::after { border: 0; }
.comparison-section { margin-top: 24rpx; padding: 26rpx; border-radius: 28rpx; background: #ffffff; box-shadow: 0 12rpx 30rpx rgba(15, 23, 42, 0.06); }
.comparison-head { margin: 0 0 18rpx; }
.comparison-list { display: grid; gap: 2rpx; overflow: hidden; border-radius: 20rpx; background: #eef0f4; }
.comparison-row { display: grid; grid-template-columns: 128rpx minmax(0, 1fr); gap: 18rpx; padding: 18rpx; background: #fafbfc; }
.comparison-label { color: #111827; font-size: 21rpx; font-weight: 800; }
.comparison-summary { color: #6b7280; font-size: 20rpx; line-height: 1.45; }
.safe-note { margin-top: 24rpx; color: #9ca3af; font-size: 20rpx; text-align: center; }
</style>
