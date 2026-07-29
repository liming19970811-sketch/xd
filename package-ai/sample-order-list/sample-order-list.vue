<template>
  <view class="list-page">
    <view class="hero"><text class="title">样衣打样</text><text class="subtitle">跟踪人工打样、样衣照片、修改轮次和最终确认。</text><text class="notice">样衣确认不会自动询价或下单，也不代表生产级工业纸样已完成。</text><view class="production-entry" @click="openManualSampling"><view><text>联系人工打样</text><text>提交需求，由人工确认版型、面料与后续安排</text></view><text>联系 ></text></view></view>
    <scroll-view class="filter-scroll" scroll-x :show-scrollbar="false"><view class="filter-row"><text v-for="item in filters" :key="item.value" class="filter" :class="{ active: status === item.value }" @click="changeStatus(item.value)">{{ item.label }}</text></view></scroll-view>
    <view v-if="loading" class="state-card">正在读取样衣单...</view>
    <view v-else-if="errorMessage" class="state-card"><text>{{ errorMessage }}</text><button @click="loadList">重新加载</button></view>
    <view v-else-if="!items.length" class="state-card"><text class="state-title">暂无样衣单</text><text>请从已批准版型详情创建样衣单。</text></view>
    <view v-else class="order-list"><view v-for="item in items" :key="item.sampleOrderId" class="order-card" @click="openDetail(item)"><view class="card-head"><text>{{ item.patternTitle }}</text><text class="pill">{{ label(item.status) }}</text></view><text class="meta">{{ item.patternVersionNo }} · 第 {{ item.currentRound }} 轮</text><text class="meta">{{ item.factoryName || '工厂待确认' }} · {{ item.expectedAt || '交期待确认' }}</text><view class="card-foot"><text>{{ item.sampleValidationStatus === 'sample_confirmed' ? '样衣已确认' : '仍不可直接用于生产' }}</text><text>查看 ></text></view></view></view>
    <view class="safe-space"></view>
  </view>
</template>

<script>
import { listSampleOrders } from '../../utils/sample/sampleRepository.js'
import { getSampleStatusLabel } from '../../utils/sample/sampleState.js'
export default {
  data() { return { status: '', loading: false, errorMessage: '', items: [], navigationLocked: false, filters: [{ value: '', label: '全部' }, { value: 'pending_factory_acceptance', label: '待接单' }, { value: 'sampling', label: '打样中' }, { value: 'pending_review', label: '待验收' }, { value: 'changes_requested', label: '需修改' }, { value: 'confirmed', label: '已确认' }] } },
  onLoad(options = {}) { if (this.filters.some((item) => item.value === options.status)) this.status = options.status; this.loadList() },
  onShow() { if (this._loadedOnce) this.loadList(); this._loadedOnce = true },
  onUnload() { if (this._navTimer) clearTimeout(this._navTimer) },
  methods: {
    async loadList() { if (this.loading) return; this.loading = true; this.errorMessage = ''; const result = await listSampleOrders({ status: this.status }); if (result.ok) this.items = result.data.items || []; else { this.items = []; this.errorMessage = result.message || '样衣单暂时无法读取。' } this.loading = false },
    changeStatus(value) { if (value === this.status) return; this.status = value; this.loadList() },
    label(value) { return getSampleStatusLabel(value) },
    openManualSampling() { uni.navigateTo({ url: '/pages/service-request/service-request', fail: () => uni.showToast({ title: '人工打样需求页暂时无法打开', icon: 'none' }) }) },
    openDetail(item) { if (this.navigationLocked) return; this.navigationLocked = true; uni.navigateTo({ url: `/package-ai/sample-order-detail/sample-order-detail?sampleOrderId=${encodeURIComponent(item.sampleOrderId)}`, fail: () => uni.showToast({ title: '样衣详情暂时无法打开', icon: 'none' }), complete: () => { this._navTimer = setTimeout(() => { this.navigationLocked = false }, 600) } }) }
  }
}
</script>

<style scoped>
.list-page{min-height:100vh;padding:24rpx;background:#f5f6fa;color:#1f2937;box-sizing:border-box}.hero{padding:28rpx;border-radius:18rpx;background:#fff}.title,.subtitle,.notice{display:block}.title{font-size:36rpx;font-weight:700}.subtitle{margin-top:8rpx;color:#667085;font-size:23rpx}.notice{margin-top:18rpx;padding:14rpx;border-radius:10rpx;background:#fff8e8;color:#765f39;font-size:20rpx;line-height:1.5}.filter-scroll{margin-top:18rpx;white-space:nowrap}.filter-row{display:inline-flex;gap:12rpx}.filter{padding:14rpx 22rpx;border:1rpx solid #dfe4eb;border-radius:12rpx;background:#fff;color:#667085;font-size:22rpx}.filter.active{border-color:#1677ff;background:#eaf4ff;color:#1677ff;font-weight:700}.state-card{display:flex;align-items:center;flex-direction:column;margin-top:18rpx;padding:70rpx 28rpx;border-radius:18rpx;background:#fff;color:#667085;font-size:23rpx;text-align:center}.state-title{color:#1f2937;font-size:28rpx;font-weight:700}.state-card button{height:72rpx;margin-top:20rpx;border:0;border-radius:12rpx;background:#1677ff;color:#fff;line-height:72rpx}.order-list{display:flex;flex-direction:column;gap:16rpx;margin-top:18rpx}.order-card{padding:24rpx;border:1rpx solid #e4e9f0;border-radius:18rpx;background:#fff}.card-head,.card-foot{display:flex;align-items:center;justify-content:space-between;gap:16rpx}.card-head>text:first-child{font-size:27rpx;font-weight:700}.pill{padding:7rpx 12rpx;border-radius:8rpx;background:#fff4e5;color:#9a5700;font-size:20rpx}.meta{display:block;margin-top:10rpx;color:#667085;font-size:22rpx}.card-foot{margin-top:18rpx;padding-top:16rpx;border-top:1rpx solid #edf0f4;color:#1677ff;font-size:21rpx}.safe-space{height:calc(36rpx + env(safe-area-inset-bottom))}
.production-entry{display:flex;align-items:center;justify-content:space-between;gap:16rpx;margin-top:18rpx;padding:16rpx;border-radius:12rpx;background:#eef9f2;color:#177245}.production-entry view text{display:block}.production-entry view text:first-child{font-size:23rpx;font-weight:700}.production-entry view text:last-child{margin-top:5rpx;color:#667085;font-size:20rpx}.production-entry>text{font-size:21rpx;font-weight:700}
</style>
