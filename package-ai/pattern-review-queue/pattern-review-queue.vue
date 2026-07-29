<template>
  <view class="queue-page">
    <view class="hero">
      <text class="title">打版师复核工作台</text>
      <text class="subtitle">处理已提交的尺寸、纸样部件和结构资料。所有结论由云端企业身份确认。</text>
      <text class="notice">已复核不等于已完成样衣验证，批准版本仍不可直接用于生产。</text>
    </view>

    <scroll-view class="status-scroll" scroll-x :show-scrollbar="false">
      <view class="status-row">
        <text v-for="item in statuses" :key="item.value" class="status-tab" :class="{ active: status === item.value }" @click="changeStatus(item.value)">{{ item.label }}</text>
      </view>
    </scroll-view>

    <view v-if="loading" class="state-card">正在读取待复核版型...</view>
    <view v-else-if="errorMessage" class="state-card error"><text>{{ errorMessage }}</text><button @click="loadQueue">重新加载</button></view>
    <view v-else-if="!items.length" class="state-card"><text class="state-title">当前没有{{ currentStatusLabel }}版型</text><text>这里只显示云端已提交、且当前企业角色可处理的版本。</text></view>
    <view v-else class="queue-list">
      <view v-for="item in items" :key="item.versionId" class="queue-card" @click="openDetail(item)">
        <view class="card-head"><text class="card-title">{{ item.title }}</text><text class="pill">{{ statusLabel(item.reviewStatus) }}</text></view>
        <text class="meta">{{ categoryLabel(item.category) }} · {{ item.versionNo || '版本待确认' }}</text>
        <text class="meta">{{ item.assignedReviewerMemberId ? '已分配复核人员' : '待认领' }} · 更新于 {{ formatDate(item.updatedAt) }}</text>
        <view class="card-foot"><text>尺寸与部件复核</text><text>查看 ></text></view>
      </view>
    </view>
    <view class="safe-space"></view>
  </view>
</template>

<script>
import { getPatternReviewQueue } from '../../utils/pattern/patternReviewRepository.js'
import { getPatternReviewLabel } from '../../utils/pattern/patternReviewState.js'

const CATEGORY_LABELS = Object.freeze({ tshirt: 'T恤', shirt: '衬衫', dress: '连衣裙', skirt: '半身裙', pants: '裤装', coat: '外套' })

export default {
  data() {
    return {
      status: 'under_review', loading: false, errorMessage: '', items: [], navigationLocked: false,
      statuses: [
        { value: 'under_review', label: '待复核' }, { value: 'changes_requested', label: '需修改' },
        { value: 'reviewed', label: '已复核' }, { value: 'approved', label: '已批准' }
      ]
    }
  },
  computed: { currentStatusLabel() { const item = this.statuses.find((entry) => entry.value === this.status); return item ? item.label : '' } },
  onLoad(options = {}) { if (this.statuses.some((item) => item.value === options.status)) this.status = options.status; this.loadQueue() },
  onShow() { if (this._loadedOnce) this.loadQueue(); this._loadedOnce = true },
  onUnload() { if (this._navTimer) clearTimeout(this._navTimer) },
  methods: {
    async loadQueue() {
      if (this.loading) return
      this.loading = true; this.errorMessage = ''
      const result = await getPatternReviewQueue({ status: this.status })
      if (result.ok) this.items = (result.data && result.data.items) || []
      else { this.items = []; this.errorMessage = result.message || '复核队列暂时无法加载。' }
      this.loading = false
    },
    changeStatus(value) { if (value === this.status) return; this.status = value; this.loadQueue() },
    openDetail(item) {
      if (this.navigationLocked) return
      this.navigationLocked = true
      uni.navigateTo({
        url: `/package-ai/pattern-review-detail/pattern-review-detail?patternId=${encodeURIComponent(item.patternId)}&versionId=${encodeURIComponent(item.versionId)}`,
        fail: () => uni.showToast({ title: '复核详情暂时无法打开', icon: 'none' }),
        complete: () => { this._navTimer = setTimeout(() => { this.navigationLocked = false }, 600) }
      })
    },
    statusLabel(value) { return getPatternReviewLabel(value) },
    categoryLabel(value) { return CATEGORY_LABELS[value] || value || '品类待确认' },
    formatDate(value) { const date = value ? new Date(value) : null; return date && Number.isFinite(date.getTime()) ? `${date.getMonth() + 1}月${date.getDate()}日` : '时间待同步' }
  }
}
</script>

<style scoped>
.queue-page{min-height:100vh;padding:24rpx;background:#f5f6fa;color:#1f2937;box-sizing:border-box}.hero{padding:30rpx;border-radius:20rpx;background:#fff}.title,.subtitle,.notice{display:block}.title{font-size:36rpx;font-weight:700}.subtitle{margin-top:10rpx;color:#667085;font-size:23rpx;line-height:1.55}.notice{margin-top:20rpx;padding:16rpx;border-radius:10rpx;background:#fff7e8;color:#8a5200;font-size:21rpx;line-height:1.5}.status-scroll{margin-top:18rpx;white-space:nowrap}.status-row{display:inline-flex;gap:12rpx}.status-tab{padding:14rpx 24rpx;border:1rpx solid #dfe4eb;border-radius:12rpx;background:#fff;color:#667085;font-size:23rpx}.status-tab.active{border-color:#1677ff;background:#eaf4ff;color:#1167d8;font-weight:700}.state-card{display:flex;align-items:center;flex-direction:column;margin-top:18rpx;padding:70rpx 28rpx;border-radius:18rpx;background:#fff;color:#667085;font-size:23rpx;text-align:center}.state-card text{line-height:1.6}.state-title{color:#1f2937;font-size:28rpx;font-weight:700}.state-card button{height:72rpx;margin-top:22rpx;border:0;border-radius:12rpx;background:#1677ff;color:#fff;font-size:23rpx;line-height:72rpx}.state-card button::after{border:0}.queue-list{display:flex;flex-direction:column;gap:16rpx;margin-top:18rpx}.queue-card{padding:24rpx;border:1rpx solid #e4e9f0;border-radius:18rpx;background:#fff}.card-head,.card-foot{display:flex;align-items:center;justify-content:space-between;gap:16rpx}.card-title{font-size:28rpx;font-weight:700}.pill{padding:7rpx 12rpx;border-radius:8rpx;background:#fff4e5;color:#9a5700;font-size:20rpx}.meta{display:block;margin-top:10rpx;color:#667085;font-size:22rpx}.card-foot{margin-top:20rpx;padding-top:18rpx;border-top:1rpx solid #edf0f4;color:#1677ff;font-size:22rpx;font-weight:600}.safe-space{height:calc(36rpx + env(safe-area-inset-bottom))}
</style>
