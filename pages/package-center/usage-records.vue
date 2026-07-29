<template>
  <view class="records-page">
    <view class="filter-bar">
      <view
        v-for="item in filters"
        :key="item.value"
        class="filter-item"
        :class="{ active: activeFilter === item.value }"
        @click="changeFilter(item.value)"
      >{{ item.label }}</view>
    </view>

    <view v-if="loading && !records.length" class="page-state">正在加载额度明细...</view>
    <view v-else-if="error && !records.length" class="page-state error-state">
      <text>{{ errorMessage }}</text>
      <button @click="reload">重新加载</button>
    </view>
    <view v-else-if="!records.length" class="page-state empty-state">
      <text class="empty-title">暂无额度使用记录</text>
      <text class="empty-desc">完成 AI 生成后，真实扣除与退回记录会显示在这里。</text>
    </view>
    <view v-else class="record-list">
      <view v-for="record in records" :key="record.id" class="record-card">
        <view class="record-main">
          <view class="record-copy">
            <text class="record-action">{{ record.actionLabel }}</text>
            <view class="record-meta">
              <text class="status-tag" :class="record.statusTone">{{ record.statusLabel }}</text>
              <text>{{ record.timeLabel }}</text>
            </view>
          </view>
          <text class="record-delta" :class="record.deltaTone">{{ record.deltaText }}</text>
        </view>
        <view v-if="record.hasTask" class="task-link" @click="openTask(record)">
          <text>查看关联任务</text>
          <text>›</text>
        </view>
      </view>
    </view>

    <view v-if="records.length" class="load-more">
      <button v-if="hasMore" :disabled="loadingMore" @click="loadMore">
        {{ loadingMore ? '正在加载...' : '加载更多' }}
      </button>
      <text v-else>已显示全部记录</text>
    </view>
  </view>
</template>

<script>
import { getUsageRecords } from '../../utils/member/usageRecordRepository'

export default {
  data() {
    return {
      filters: [
        { label: '全部', value: 'all' },
        { label: '消耗', value: 'consumed' },
        { label: '退回', value: 'returned' }
      ],
      activeFilter: 'all',
      records: [],
      page: 1,
      hasMore: false,
      loading: false,
      loadingMore: false,
      error: false,
      errorMessage: '额度明细暂时无法获取',
      navigating: false
    }
  },
  onLoad() {
    this.reload()
  },
  onUnload() {
    if (this._navigationTimer) clearTimeout(this._navigationTimer)
  },
  methods: {
    async fetchPage(page = 1, append = false) {
      if (this.loading || this.loadingMore) return
      if (append) this.loadingMore = true
      else this.loading = true
      this.error = false
      try {
        const result = await getUsageRecords({ page, pageSize: 20, filter: this.activeFilter })
        if (!result || result.ok !== true) {
          this.error = true
          this.errorMessage = result && result.message ? result.message : '额度明细暂时无法获取'
          return
        }
        const next = append ? [...this.records, ...result.data] : result.data
        const seen = new Set()
        this.records = next.filter((record) => {
          if (!record.id || seen.has(record.id)) return false
          seen.add(record.id)
          return true
        })
        this.page = result.nextPage
        this.hasMore = result.hasMore
      } catch (error) {
        this.error = true
        this.errorMessage = '额度明细暂时无法获取'
      } finally {
        this.loading = false
        this.loadingMore = false
      }
    },
    reload() {
      this.records = []
      this.page = 1
      this.hasMore = false
      this.fetchPage(1, false)
    },
    loadMore() {
      if (!this.hasMore) return
      this.fetchPage(this.page, true)
    },
    changeFilter(filter) {
      if (this.activeFilter === filter || this.loading || this.loadingMore) return
      this.activeFilter = filter
      this.reload()
    },
    openTask(record = {}) {
      if (!record.taskId || this.navigating) return
      this.navigating = true
      uni.navigateTo({
        url: `/package-ai/result/result?taskId=${encodeURIComponent(record.taskId)}`,
        fail: () => uni.showToast({ title: '关联任务暂不可查看', icon: 'none' }),
        complete: () => {
          if (this._navigationTimer) clearTimeout(this._navigationTimer)
          this._navigationTimer = setTimeout(() => { this.navigating = false }, 700)
        }
      })
    }
  }
}
</script>

<style scoped>
.records-page { min-height: 100vh; padding: 24rpx 24rpx calc(48rpx + env(safe-area-inset-bottom)); box-sizing: border-box; background: #f5f6fa; color: #111827; }
.filter-bar { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8rpx; padding: 7rpx; border-radius: 18rpx; background: #e9ebf1; }
.filter-item { min-height: 68rpx; border-radius: 14rpx; color: #667085; font-size: 24rpx; font-weight: 600; line-height: 68rpx; text-align: center; }
.filter-item.active { background: #fff; color: #4f46e5; box-shadow: 0 3rpx 12rpx rgba(15, 23, 42, .07); }
.page-state { display: flex; min-height: 420rpx; align-items: center; justify-content: center; flex-direction: column; color: #667085; font-size: 24rpx; text-align: center; }
.page-state button, .load-more button { min-width: 190rpx; height: 72rpx; margin: 22rpx 0 0; border: 0; border-radius: 16rpx; background: #eeedff; color: #4f46e5; font-size: 23rpx; line-height: 72rpx; }
.page-state button::after, .load-more button::after { border: 0; }
.error-state { color: #b42318; }.empty-title { color: #344054; font-size: 29rpx; font-weight: 700; }.empty-desc { max-width: 540rpx; margin-top: 12rpx; line-height: 1.55; }
.record-list { display: grid; gap: 16rpx; margin-top: 20rpx; }
.record-card { overflow: hidden; border: 1rpx solid #e8eaf0; border-radius: 24rpx; background: #fff; }
.record-main { display: flex; align-items: center; justify-content: space-between; gap: 20rpx; padding: 24rpx; }
.record-copy { min-width: 0; flex: 1; }.record-action { display: block; overflow: hidden; font-size: 28rpx; font-weight: 700; text-overflow: ellipsis; white-space: nowrap; }
.record-meta { display: flex; align-items: center; gap: 12rpx; margin-top: 11rpx; color: #98a2b3; font-size: 21rpx; }
.status-tag { padding: 5rpx 10rpx; border-radius: 999rpx; background: #f2f4f7; color: #667085; font-weight: 600; }.status-tag.completed { background: #ecfdf3; color: #168754; }.status-tag.returned { background: #ecfdf3; color: #168754; }.status-tag.failed { background: #fef3f2; color: #b42318; }.status-tag.consumed { background: #fff7ed; color: #b54708; }
.record-delta { flex: 0 0 auto; font-size: 30rpx; font-weight: 800; }.record-delta.consumed { color: #b54708; }.record-delta.returned { color: #168754; }.record-delta.neutral { color: #667085; }
.task-link { display: flex; min-height: 74rpx; align-items: center; justify-content: space-between; padding: 0 24rpx; border-top: 1rpx solid #f0f1f4; color: #4f46e5; font-size: 23rpx; }
.load-more { display: flex; min-height: 108rpx; align-items: center; justify-content: center; color: #98a2b3; font-size: 22rpx; }.load-more button { margin: 18rpx 0 0; }
</style>

