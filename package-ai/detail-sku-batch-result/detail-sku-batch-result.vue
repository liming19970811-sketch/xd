<template>
  <view class="page">
    <view class="summary"><text class="title">批量详情长图</text><text>预计 {{ expected }} 张 · 已完成 {{ completed }} 张 · 失败 {{ failed }} 张</text></view>
    <view v-for="child in children" :key="child.task.taskId" class="card">
      <view class="head"><view class="swatch" :style="{ backgroundColor: (child.sku || {}).colorHex || '#f2f4f7' }"></view><view><text>{{ (child.sku || {}).colorName || '颜色SKU' }}</text><text>{{ (child.sku || {}).skuCode || '' }}</text></view><text :class="['status', statusClass(child.task.status)]">{{ statusText(child.task.status) }}</text></view>
      <view v-if="resultItems(child.task).length" class="results"><image v-for="item in resultItems(child.task)" :key="item.assetId || item.fileId" :src="item.fileId || item.fileUrl || item.url" mode="widthFix" @click="preview(item, child.task)" /></view>
      <text v-else class="empty">{{ child.task.status === 'failed' ? safeError(child.task) : '详情长图正在后台保存' }}</text>
      <view class="actions"><button v-if="child.task.status === 'failed'" @click="retry(child)">修改素材并重试</button><button @click="openWork(child)">{{ resultItems(child.task).length ? '查看作品' : '查看任务' }}</button></view>
    </view>
    <view class="bottom"><button @click="backToWorks">返回我的作品</button></view>
  </view>
</template>

<script>
import { getSkuRenderBatchDetail } from '../../utils/detail-page/detailSkuBatch'

export default {
  data() { return { batchId: '', detail: { batch: {}, children: [] }, timer: null, busy: false } },
  computed: {
    children() { return this.detail.children || [] },
    expected() { return Number((this.detail.batch || {}).expectedOutputCount) || this.children.reduce((sum, item) => sum + (Number(item.task.expectedOutputCount) || 1), 0) },
    completed() { return this.children.reduce((sum, item) => sum + this.resultItems(item.task).length, 0) },
    failed() { return this.children.filter((item) => ['failed', 'result_missing'].includes(item.task.status)).length }
  },
  onLoad(query = {}) { this.batchId = query.batchId ? decodeURIComponent(query.batchId) : ''; this.refresh() },
  onShow() { this.refresh(); this.schedule() }, onHide() { this.stop() }, onUnload() { this.stop() },
  methods: {
    refresh() { if (!this.batchId || this.busy) return; this.busy = true; try { this.detail = getSkuRenderBatchDetail(this.batchId) } finally { this.busy = false } },
    schedule() { this.stop(); if (this.children.some((item) => !['completed', 'failed', 'result_missing', 'cancelled'].includes(item.task.status))) this.timer = setTimeout(() => { this.refresh(); this.schedule() }, 2000) },
    stop() { if (this.timer) clearTimeout(this.timer); this.timer = null },
    resultItems(task) { return Array.isArray((task.result || {}).items) ? task.result.items.filter((item) => item.fileId || item.fileUrl || item.url) : [] },
    statusText(status) { return ({ pending: '等待处理', generating: '生成中', partial_success: '部分完成', completed: '已完成', failed: '失败', result_missing: '结果缺失' })[status] || '处理中' },
    statusClass(status) { return ['failed', 'result_missing'].includes(status) ? 'bad' : (status === 'completed' ? 'done' : 'running') },
    safeError(task) { return (((task.error || {}).message) || '渲染失败，请检查素材后重试') },
    preview(item, task) { const urls = this.resultItems(task).map((result) => result.fileId || result.fileUrl || result.url); uni.previewImage({ current: item.fileId || item.fileUrl || item.url, urls }) },
    retry(child) { uni.navigateTo({ url: `/package-ai/detail-sku-batch/detail-sku-batch?productId=${encodeURIComponent((child.sku || {}).productId || '')}&skuGroupId=${encodeURIComponent((child.sku || {}).skuGroupId || '')}&retrySkuId=${encodeURIComponent((child.sku || {}).skuId || '')}` }) },
    openWork(child) { uni.navigateTo({ url: `/package-ai/result/result?taskId=${encodeURIComponent(child.task.taskId)}` }) },
    backToWorks() { uni.switchTab({ url: '/pages/gallery/gallery' }) }
  }
}
</script>

<style scoped>
.page{min-height:100vh;padding:24rpx 24rpx calc(150rpx + env(safe-area-inset-bottom));background:#f5f6fa;color:#101828;box-sizing:border-box}.summary,.card{margin-bottom:18rpx;padding:24rpx;border:1rpx solid #e4e7ec;border-radius:18rpx;background:#fff}.title{display:block;font-size:32rpx;font-weight:700}.summary text+text{display:block;margin-top:8rpx;color:#667085;font-size:22rpx}.head{display:flex;align-items:center;gap:14rpx}.swatch{width:50rpx;height:50rpx;border:1rpx solid #d0d5dd;border-radius:50%}.head view{min-width:0;flex:1}.head view text{display:block;font-size:24rpx;font-weight:700}.head view text+text{margin-top:5rpx;color:#667085;font-size:20rpx;font-weight:400}.status{padding:8rpx 12rpx;border-radius:10rpx;font-size:20rpx}.running{background:#eef6ff;color:#175cd3}.done{background:#ecfdf3;color:#067647}.bad{background:#fef3f2;color:#b42318}.results{margin-top:18rpx}.results image{display:block;width:100%;margin-top:14rpx;border-radius:12rpx;background:#f2f4f7}.empty{display:block;padding:46rpx 0;color:#667085;text-align:center;font-size:22rpx}.actions{display:flex;justify-content:flex-end;gap:14rpx;margin-top:16rpx}.actions button,.bottom button{height:68rpx;margin:0;border:0;border-radius:12rpx;background:#eef4ff;color:#1677ff;font-size:22rpx;line-height:68rpx}.bottom{position:fixed;right:0;bottom:0;left:0;padding:16rpx 24rpx calc(16rpx + env(safe-area-inset-bottom));border-top:1rpx solid #e4e7ec;background:#fff}.bottom button{width:100%;height:82rpx;background:#1677ff;color:#fff;line-height:82rpx}
</style>
