<template>
  <view class="page-shell">
    <view v-if="selectedRecord" class="detail-page">
      <view class="detail-nav">
        <text class="back-link" @click="closeDetail">返回记录</text>
        <text class="nav-title">生产记录详情</text>
        <text></text>
      </view>

      <view class="overview-card">
        <view class="overview-head">
          <view class="overview-copy">
            <text class="record-title">{{ selectedRecord.planName }}</text>
            <text class="record-type">{{ selectedRecord.typeLabel }}</text>
          </view>
          <text class="status-badge" :class="`tone-${selectedRecord.statusTone}`">{{ selectedRecord.statusLabel }}</text>
        </view>
        <view class="overview-grid">
          <view><text class="metric-value">{{ selectedRecord.taskCount }}</text><text class="metric-label">任务数</text></view>
          <view><text class="metric-value">{{ selectedRecord.workCount }}</text><text class="metric-label">作品数</text></view>
          <view><text class="metric-value">{{ selectedRecord.executionCount }}</text><text class="metric-label">执行次数</text></view>
        </view>
        <view class="overview-times">
          <view><text>创建时间</text><text>{{ selectedRecord.createdTimeLabel }}</text></view>
          <view v-if="selectedRecord.completedAt"><text>完成时间</text><text>{{ selectedRecord.completedTimeLabel }}</text></view>
          <view><text>最近更新</text><text>{{ selectedRecord.updatedTimeLabel }}</text></view>
        </view>
      </view>

      <view class="section-card progress-card">
        <view class="section-heading">
          <view><text class="section-title">当前进度</text><text class="section-desc">按真实任务状态汇总</text></view>
          <text class="progress-count">{{ selectedRecord.completedTaskCount }}/{{ selectedRecord.taskCount }} 项完成</text>
        </view>
        <view class="progress-track"><view class="progress-fill" :style="{ width: progressWidth }"></view></view>
        <text class="progress-stage">{{ selectedRecord.statusLabel }} · 最近更新 {{ selectedRecord.updatedRelativeLabel }}</text>
      </view>

      <view v-if="selectedRecord.timeline.length" class="section-card">
        <view class="section-heading"><view><text class="section-title">状态时间线</text><text class="section-desc">仅展示有真实时间的状态</text></view></view>
        <view class="timeline-list">
          <view v-for="(node, index) in selectedRecord.timeline" :key="`${node.status}-${node.timestamp}`" class="timeline-item">
            <view class="timeline-rail"><text class="timeline-dot" :class="`node-${node.status}`"></text><text v-if="index !== selectedRecord.timeline.length - 1" class="timeline-line"></text></view>
            <view class="timeline-copy"><text class="timeline-title">{{ node.label }}</text><text class="timeline-time">{{ node.timeLabel }}</text><text v-if="node.description" class="timeline-desc">{{ node.description }}</text></view>
          </view>
        </view>
      </view>

      <view class="section-card">
        <view class="section-heading">
          <view><text class="section-title">任务列表</text><text class="section-desc">{{ batchSummary }}</text></view>
          <text v-if="selectedRecord.taskCount > 3" class="text-action" @click="tasksExpanded = !tasksExpanded">{{ tasksExpanded ? '收起' : '展开全部' }}</text>
        </view>
        <view class="detail-task-list">
          <view v-for="task in visibleDetailTasks" :key="task.taskId" class="detail-task-row">
            <text class="task-index">{{ task.index }}</text>
            <view class="detail-task-copy"><text class="task-name">{{ task.typeLabel }}</text><text class="task-time">创建 {{ task.createdTimeLabel }}</text><text v-if="task.finishedAt" class="task-time">完成 {{ task.finishedTimeLabel }}</text></view>
            <view class="task-result"><text class="task-state" :class="`state-${task.status}`">{{ task.statusLabel }}</text><text>{{ task.hasResult ? `已生成 ${task.resultCount} 件` : task.progressLabel }}</text></view>
          </view>
        </view>
      </view>

      <view v-if="selectedRecord.works.length" class="section-card">
        <view class="section-heading">
          <view><text class="section-title">结果作品</text><text class="section-desc">已找到 {{ selectedRecord.workCount }} 件有效作品</text></view>
          <text class="text-action" @click="viewAllWorks(selectedRecord)">查看全部作品</text>
        </view>
        <view class="works-grid">
          <view v-for="work in selectedRecord.works" :key="work.id" class="work-preview" @click="openWork(work)">
            <image class="work-image" :src="work.coverUrl" mode="aspectFill"></image>
            <text class="work-title">{{ work.title }}</text>
          </view>
        </view>
      </view>
      <view v-else-if="selectedRecord.status === 'completed'" class="section-card empty-result-card">
        <text class="section-title">结果作品</text>
        <text class="section-desc">任务已完成，但暂未找到有效作品。</text>
      </view>

      <view v-if="selectedRecord.failedTaskCount" class="section-card failure-card">
        <text class="section-title">失败信息</text>
        <text class="failure-message">{{ selectedRecord.failureMessage || '生成未完成，请稍后重试。' }}</text>
        <text v-if="!selectedRecord.canRetry" class="failure-hint">当前失败项不可直接重试，可检查输入素材后再次执行。</text>
      </view>
      <view v-if="isTerminalRecord && !selectedRecord.canRerun" class="section-card input-warning">
        <text class="section-title">原输入素材已失效</text>
        <text class="section-desc">为避免复用过期临时图片，请重新上传素材后创建任务。</text>
        <button class="inline-action" @click="goToCreate">重新上传创作</button>
      </view>

      <view class="detail-actions">
        <button v-if="selectedRecord.canRetry" class="action-btn primary" :disabled="submittingAction" @click="confirmRetry(selectedRecord)">{{ submittingAction === 'retry' ? '正在提交...' : retryButtonLabel }}</button>
        <button v-if="isTerminalRecord && selectedRecord.canRerun" class="action-btn secondary" :disabled="submittingAction" @click="confirmRerun(selectedRecord)">{{ submittingAction === 'rerun' ? '正在创建...' : '再次执行' }}</button>
        <button v-if="selectedRecord.works.length" class="action-btn ghost" @click="viewAllWorks(selectedRecord)">查看作品</button>
      </view>
    </view>

    <view v-else class="list-page">
      <view class="header">
        <text class="title">生产记录</text>
        <text class="subtitle">查看生成进度、历史任务和失败记录</text>
      </view>

      <view class="stats-grid">
        <view v-for="item in statItems" :key="item.value" class="stat-card" :class="{ active: activeFilter === item.value }" @click="changeFilter(item.value)">
          <text class="stat-value">{{ statsReady ? item.count : '—' }}</text>
          <text class="stat-label">{{ item.label }}</text>
        </view>
      </view>

      <scroll-view class="filter-scroll" scroll-x :show-scrollbar="false">
        <view class="filter-row">
          <view v-for="filter in filterOptions" :key="filter.value" class="filter-chip" :class="{ active: activeFilter === filter.value }" @click="changeFilter(filter.value)">{{ filter.label }}</view>
        </view>
      </scroll-view>

      <view class="sort-row">
        <text class="sort-label">排序</text>
        <view class="sort-options">
          <text class="sort-option" :class="{ active: activeSort === 'created' }" @click="changeSort('created')">最近创建</text>
          <text class="sort-option" :class="{ active: activeSort === 'updated' }" @click="changeSort('updated')">最近更新</text>
        </view>
      </view>

      <view v-if="loading && !records.length" class="state-card"><text class="state-title">正在加载生产记录...</text></view>
      <view v-else-if="loadError && !records.length" class="state-card">
        <text class="state-title">生产记录加载失败</text><text class="state-desc">请检查网络或身份状态后重新加载。</text><button class="state-btn" @click="loadRecords(true)">重新加载</button>
      </view>
      <view v-else-if="!identityAvailable" class="state-card">
        <text class="state-title">登录后查看生产记录</text><text class="state-desc">当前未获取到有效微信身份。</text><button class="state-btn" @click="loadRecords(true)">重新同步</button>
      </view>
      <view v-else-if="!records.length" class="state-card">
        <text class="state-title">{{ emptyTitle }}</text><text class="state-desc">{{ emptyDescription }}</text><button v-if="activeFilter === 'all'" class="state-btn" @click="goToCreate">去创作</button>
      </view>

      <view v-else class="record-list">
        <view v-for="record in records" :key="record.recordId" class="record-card" :class="{ focused: isFocused(record) }" @click="openDetail(record)">
          <view class="record-head">
            <view class="record-copy"><text class="record-title">{{ record.planName }}</text><text class="record-type">{{ record.typeLabel }}</text></view>
            <text class="status-badge" :class="`tone-${record.statusTone}`">{{ record.statusLabel }}</text>
          </view>
          <view class="record-metrics">
            <text>{{ record.taskCount }} 个任务</text><text>{{ record.workCount }} 件作品</text><text>{{ record.completedTaskCount }}/{{ record.taskCount }} 项完成</text>
          </view>
          <view class="record-times"><text>创建 {{ record.createdRelativeLabel }}</text><text>更新 {{ record.updatedRelativeLabel }}</text></view>
          <view class="record-actions">
            <button v-if="record.status === 'pending' || record.status === 'generating'" class="card-action primary" @click.stop="openDetail(record)">查看进度</button>
            <button v-if="record.status === 'completed' && record.works.length" class="card-action primary" @click.stop="viewAllWorks(record)">查看作品</button>
            <button v-if="record.status === 'completed' && record.canRerun" class="card-action secondary" @click.stop="confirmRerun(record)">再次执行</button>
            <button v-if="record.status === 'failed'" class="card-action secondary" @click.stop="openDetail(record)">查看原因</button>
            <button v-if="record.status === 'failed' && record.canRetry" class="card-action primary" @click.stop="confirmRetry(record)">失败重试</button>
            <button v-if="record.status === 'partial_success'" class="card-action secondary" @click.stop="openDetail(record)">查看结果</button>
            <button v-if="record.status === 'partial_success' && record.canRetry" class="card-action primary" @click.stop="confirmRetry(record)">重试失败项</button>
          </view>
        </view>
        <view class="load-footer">
          <button v-if="hasMore" class="load-more" :loading="loadingMore" @click="loadMore">加载更多</button>
          <text v-else>已展示当前筛选的全部记录</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script>
import {
  PRODUCTION_RECORD_PAGE_SIZE,
  getProductionRecordDetail,
  getProductionRecordPage,
  getProductionRecordsByIds,
  isProductionRecordTerminal,
  rerunProductionRecord,
  retryProductionRecord
} from '../../utils/workspace/productionRecordRepository'

const FILTER_STORAGE_KEY = 'diebiandesign_production_record_filter_v2'
const SORT_STORAGE_KEY = 'diebiandesign_production_record_sort_v2'
const GALLERY_FOCUS_STORAGE_KEY = 'diebiandesign_gallery_focus_v1'

function readPreference(key, allowed, fallback) {
  try {
    const value = uni.getStorageSync(key)
    return allowed.includes(value) ? value : fallback
  } catch (error) {
    return fallback
  }
}

export default {
  data() {
    return {
      filterOptions: [
        { label: '全部', value: 'all' },
        { label: '进行中', value: 'processing' },
        { label: '已完成', value: 'completed' },
        { label: '失败', value: 'failed' }
      ],
      activeFilter: readPreference(FILTER_STORAGE_KEY, ['all', 'processing', 'completed', 'failed'], 'all'),
      activeSort: readPreference(SORT_STORAGE_KEY, ['created', 'updated'], 'created'),
      records: [],
      stats: { all: 0, processing: 0, completed: 0, failed: 0 },
      statsReady: false,
      cursor: '',
      hasMore: false,
      loading: false,
      loadingMore: false,
      loadError: false,
      identityAvailable: true,
      selectedRecord: null,
      tasksExpanded: false,
      submittingAction: '',
      focusTaskId: '',
      focusHistoryId: '',
      pageVisible: false,
      refreshTimer: null,
      refreshDelay: 5000
    }
  },
  computed: {
    statItems() {
      return this.filterOptions.map((item) => ({ ...item, count: this.stats[item.value] || 0 }))
    },
    emptyTitle() {
      const labels = { processing: '暂无进行中的任务', completed: '暂无已完成记录', failed: '暂无失败记录' }
      return labels[this.activeFilter] || '暂无生产记录'
    },
    emptyDescription() {
      return this.activeFilter === 'all' ? '完成一次AI生成后，可以在这里查看进度和历史。' : '当前筛选条件下没有生产记录。'
    },
    visibleDetailTasks() {
      const tasks = (this.selectedRecord && this.selectedRecord.tasks) || []
      return this.tasksExpanded ? tasks : tasks.slice(0, 3)
    },
    progressWidth() {
      if (!this.selectedRecord || !this.selectedRecord.taskCount) return '0%'
      const value = Math.round((this.selectedRecord.completedTaskCount / this.selectedRecord.taskCount) * 100)
      return `${Math.max(0, Math.min(100, value))}%`
    },
    batchSummary() {
      if (!this.selectedRecord) return ''
      const summary = this.selectedRecord.batchId && this.selectedRecord.taskCount > 1
        ? `批量任务，共 ${this.selectedRecord.taskCount} 项`
        : `共 ${this.selectedRecord.taskCount} 个任务`
      return this.selectedRecord.attemptCount > this.selectedRecord.taskCount
        ? `${summary} · 累计 ${this.selectedRecord.attemptCount} 次尝试`
        : summary
    },
    retryButtonLabel() {
      return this.selectedRecord && this.selectedRecord.status === 'partial_success' ? '重试失败项' : '失败重试'
    },
    isTerminalRecord() {
      return Boolean(this.selectedRecord && isProductionRecordTerminal(this.selectedRecord.status))
    }
  },
  onLoad(options = {}) {
    this.focusTaskId = String(options.taskId || '').trim()
    this.focusHistoryId = String(options.historyId || '').trim()
    const requestedFilter = String(options.filter || '').trim()
    if (['all', 'processing', 'completed', 'failed'].includes(requestedFilter)) this.activeFilter = requestedFilter
    if (this.focusTaskId || this.focusHistoryId) this.activeFilter = 'all'
  },
  onShow() {
    this.pageVisible = true
    if (this.selectedRecord) this.refreshSelectedRecord()
    else this.loadRecords(true)
  },
  onHide() {
    this.pageVisible = false
    this.stopAutoRefresh()
  },
  onUnload() {
    this.pageVisible = false
    this.stopAutoRefresh()
  },
  onPullDownRefresh() {
    this.loadRecords(true).finally(() => uni.stopPullDownRefresh())
  },
  onReachBottom() {
    if (!this.selectedRecord && this.hasMore) this.loadMore()
  },
  onBackPress() {
    if (!this.selectedRecord) return false
    this.closeDetail()
    return true
  },
  methods: {
    async loadRecords(reset = false) {
      if ((reset && this.loading) || (!reset && this.loadingMore)) return
      if (reset) {
        this.loading = true
        this.loadError = false
        this.cursor = ''
      } else {
        this.loadingMore = true
      }
      try {
        const result = getProductionRecordPage({
          filter: this.activeFilter,
          sort: this.activeSort,
          cursor: reset ? '' : this.cursor,
          pageSize: PRODUCTION_RECORD_PAGE_SIZE
        })
        const nextItems = Array.isArray(result.items) ? result.items : []
        const merged = reset ? nextItems : [...this.records, ...nextItems]
        const seen = new Set()
        this.records = merged.filter((record) => {
          if (!record || !record.recordId || seen.has(record.recordId)) return false
          seen.add(record.recordId)
          return true
        })
        this.identityAvailable = result.identityAvailable !== false
        this.stats = result.stats || this.stats
        this.statsReady = true
        this.cursor = result.cursor || ''
        this.hasMore = result.hasMore === true
        if (reset) this.openFocusedRecord()
        this.refreshDelay = 5000
        this.scheduleAutoRefresh()
      } catch (error) {
        this.loadError = true
        this.statsReady = false
        this.refreshDelay = Math.min(this.refreshDelay * 2, 30000)
        this.scheduleAutoRefresh()
      } finally {
        this.loading = false
        this.loadingMore = false
      }
    },
    loadMore() {
      if (!this.hasMore || this.loadingMore) return
      this.loadRecords(false)
    },
    changeFilter(value) {
      if (this.activeFilter === value) return
      this.activeFilter = value
      try { uni.setStorageSync(FILTER_STORAGE_KEY, value) } catch (error) {}
      this.loadRecords(true)
    },
    changeSort(value) {
      if (this.activeSort === value) return
      this.activeSort = value
      try { uni.setStorageSync(SORT_STORAGE_KEY, value) } catch (error) {}
      this.loadRecords(true)
    },
    openFocusedRecord() {
      if (!this.focusTaskId && !this.focusHistoryId) return
      const record = this.records.find((item) => item.historyId === this.focusHistoryId || item.currentTaskIds.includes(this.focusTaskId) || item.tasks.some((task) => task.taskId === this.focusTaskId)) ||
        (this.focusHistoryId ? getProductionRecordDetail(this.focusHistoryId) : getProductionRecordDetail(`task:${this.focusTaskId}`))
      if (record) this.openDetail(record)
      this.focusTaskId = ''
      this.focusHistoryId = ''
    },
    isFocused(record = {}) {
      return Boolean((this.focusHistoryId && record.historyId === this.focusHistoryId) || (this.focusTaskId && record.tasks.some((task) => task.taskId === this.focusTaskId)))
    },
    openDetail(record = {}) {
      const detail = getProductionRecordDetail(record.recordId)
      if (!detail) {
        uni.showToast({ title: '记录不存在或无权访问', icon: 'none' })
        return
      }
      this.selectedRecord = detail
      this.tasksExpanded = false
      this.scheduleAutoRefresh()
    },
    closeDetail() {
      this.selectedRecord = null
      this.tasksExpanded = false
      this.loadRecords(true)
    },
    refreshSelectedRecord() {
      if (!this.selectedRecord) return
      const detail = getProductionRecordDetail(this.selectedRecord.recordId)
      if (detail) this.selectedRecord = detail
      this.scheduleAutoRefresh()
    },
    refreshVisibleRecords() {
      try {
        const refreshed = getProductionRecordsByIds(this.records.map((record) => record.recordId))
        const byId = new Map(refreshed.map((record) => [record.recordId, record]))
        const nextStats = { ...this.stats }
        this.records.forEach((record) => {
          const next = byId.get(record.recordId)
          if (!next || next.status === record.status) return
          const previousBucket = this.getStatusBucket(record.status)
          const nextBucket = this.getStatusBucket(next.status)
          if (previousBucket !== nextBucket) {
            if (Object.prototype.hasOwnProperty.call(nextStats, previousBucket)) nextStats[previousBucket] = Math.max(0, Number(nextStats[previousBucket]) - 1)
            if (Object.prototype.hasOwnProperty.call(nextStats, nextBucket)) nextStats[nextBucket] = Math.max(0, Number(nextStats[nextBucket]) + 1)
          }
        })
        this.stats = nextStats
        this.records = this.records
          .map((record) => byId.get(record.recordId) || record)
          .filter((record) => this.matchesActiveFilter(record))
        this.refreshDelay = 5000
      } catch (error) {
        this.refreshDelay = Math.min(this.refreshDelay * 2, 30000)
      }
      this.scheduleAutoRefresh()
    },
    getStatusBucket(status = '') {
      if (status === 'completed') return 'completed'
      if (status === 'failed' || status === 'partial_success') return 'failed'
      if (status === 'pending' || status === 'generating') return 'processing'
      return 'other'
    },
    matchesActiveFilter(record = {}) {
      if (this.activeFilter === 'all') return true
      return this.getStatusBucket(record.status) === this.activeFilter
    },
    scheduleAutoRefresh() {
      this.stopAutoRefresh()
      if (!this.pageVisible) return
      const hasActive = this.selectedRecord
        ? !isProductionRecordTerminal(this.selectedRecord.status)
        : this.records.some((record) => !isProductionRecordTerminal(record.status))
      if (!hasActive) return
      this.refreshTimer = setTimeout(() => {
        if (!this.pageVisible) return
        if (this.selectedRecord) this.refreshSelectedRecord()
        else this.refreshVisibleRecords()
      }, this.refreshDelay)
    },
    stopAutoRefresh() {
      if (this.refreshTimer) clearTimeout(this.refreshTimer)
      this.refreshTimer = null
    },
    confirmRetry(record = {}) {
      if (this.submittingAction || !record.canRetry) return
      uni.showModal({
        title: record.status === 'partial_success' ? '重试失败项' : '失败重试',
        content: `将重试 ${record.failedTaskCount} 个失败项，已完成作品会保留。额度按实际生成规则处理。`,
        confirmText: '确认重试',
        success: ({ confirm }) => { if (confirm) this.submitRetry(record) }
      })
    },
    submitRetry(record = {}) {
      if (this.submittingAction) return
      this.submittingAction = 'retry'
      const result = retryProductionRecord(record.recordId)
      this.submittingAction = ''
      if (!result.ok) {
        uni.showToast({ title: result.message || '失败项暂时无法重试', icon: 'none' })
        return
      }
      uni.showToast({ title: result.message || '已创建重试任务', icon: 'success' })
      if (this.selectedRecord) this.refreshSelectedRecord()
      else this.loadRecords(true)
    },
    confirmRerun(record = {}) {
      if (this.submittingAction) return
      if (!record.canRerun) {
        uni.showToast({ title: '原输入图片已失效，请重新上传', icon: 'none' })
        return
      }
      uni.showModal({
        title: '再次执行',
        content: `方案：${record.planName}\n功能：${record.typeLabel}\n预计创建 ${record.currentTaskIds.length} 个任务。额度按实际生成规则处理。`,
        confirmText: '创建新记录',
        success: ({ confirm }) => { if (confirm) this.submitRerun(record) }
      })
    },
    submitRerun(record = {}) {
      if (this.submittingAction) return
      this.submittingAction = 'rerun'
      const result = rerunProductionRecord(record.recordId)
      this.submittingAction = ''
      if (!result.ok) {
        uni.showToast({ title: result.message || '暂时无法再次执行', icon: 'none' })
        return
      }
      uni.showToast({ title: '已创建新的生产记录', icon: 'success' })
      this.selectedRecord = null
      this.focusHistoryId = result.historyId || ''
      this.loadRecords(true)
    },
    viewAllWorks(record = {}) {
      const firstWork = (record.works || [])[0]
      try { uni.setStorageSync(GALLERY_FOCUS_STORAGE_KEY, firstWork ? { workId: firstWork.id, taskIds: record.currentTaskIds } : { taskIds: record.currentTaskIds }) } catch (error) {}
      uni.switchTab({ url: '/pages/gallery/gallery', fail: () => uni.showToast({ title: '作品中心暂时无法打开', icon: 'none' }) })
    },
    openWork(work = {}) {
      try { uni.setStorageSync(GALLERY_FOCUS_STORAGE_KEY, { workId: work.id, taskIds: [work.taskId] }) } catch (error) {}
      uni.switchTab({ url: '/pages/gallery/gallery', fail: () => uni.showToast({ title: '作品预览暂时无法打开', icon: 'none' }) })
    },
    goToCreate() {
      uni.navigateTo({ url: '/package-ai/production-guide/production-guide', fail: () => uni.showToast({ title: '创作页面暂时无法打开', icon: 'none' }) })
    }
  }
}
</script>

<style scoped>
.page-shell { min-height: 100vh; box-sizing: border-box; background: #f5f6fa; color: #172033; }
.list-page, .detail-page { padding: 24rpx 24rpx calc(72rpx + env(safe-area-inset-bottom)); box-sizing: border-box; }
.header { margin-bottom: 22rpx; }.title, .subtitle, .record-title, .record-type, .metric-value, .metric-label, .section-title, .section-desc, .timeline-title, .timeline-time, .timeline-desc, .task-name, .task-time, .work-title, .failure-message, .failure-hint { display: block; }
.title { font-size: 40rpx; font-weight: 800; }.subtitle { margin-top: 8rpx; color: #737b8c; font-size: 24rpx; line-height: 1.5; }
.stats-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10rpx; }.stat-card { padding: 18rpx 8rpx; border: 1rpx solid transparent; border-radius: 22rpx; background: #fff; text-align: center; }.stat-card.active { border-color: rgba(79, 70, 229, .35); background: #f3f2ff; }.stat-value { display: block; font-size: 32rpx; font-weight: 800; }.stat-label { display: block; margin-top: 4rpx; color: #6b7280; font-size: 21rpx; }
.filter-scroll { width: 100%; margin: 20rpx 0 14rpx; white-space: nowrap; }.filter-row { display: inline-flex; gap: 12rpx; padding-right: 24rpx; }.filter-chip { padding: 12rpx 24rpx; border: 1rpx solid #e1e5ec; border-radius: 999rpx; background: #fff; color: #60697a; font-size: 23rpx; }.filter-chip.active { border-color: #4f46e5; background: #4f46e5; color: #fff; font-weight: 700; }
.sort-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 18rpx; }.sort-label { color: #737b8c; font-size: 22rpx; }.sort-options { display: flex; gap: 8rpx; padding: 6rpx; border-radius: 14rpx; background: #e9ecf2; }.sort-option { padding: 8rpx 14rpx; border-radius: 10rpx; color: #6b7280; font-size: 21rpx; }.sort-option.active { background: #fff; color: #4f46e5; font-weight: 700; }
.record-list { display: grid; gap: 20rpx; }.record-card, .section-card, .overview-card, .state-card { border-radius: 28rpx; background: #fff; }.record-card { padding: 24rpx; }.record-card.focused { border: 2rpx solid rgba(79, 70, 229, .4); }.record-head, .overview-head, .section-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 18rpx; }.record-copy, .overview-copy { min-width: 0; }.record-title { color: #172033; font-size: 29rpx; font-weight: 800; line-height: 1.35; }.record-type { margin-top: 7rpx; color: #737b8c; font-size: 22rpx; }
.status-badge { flex-shrink: 0; padding: 8rpx 13rpx; border-radius: 999rpx; font-size: 21rpx; font-weight: 700; }.tone-processing { background: #eef2ff; color: #4f46e5; }.tone-success { background: #ecfdf3; color: #16803c; }.tone-failed { background: #fef2f2; color: #dc2626; }.tone-partial { background: #fff7ed; color: #c2410c; }.tone-muted { background: #f3f4f6; color: #6b7280; }
.record-metrics { display: flex; flex-wrap: wrap; gap: 10rpx 18rpx; margin-top: 18rpx; color: #4b5563; font-size: 22rpx; }.record-times { display: flex; justify-content: space-between; gap: 16rpx; margin-top: 12rpx; color: #9299a7; font-size: 20rpx; }.record-actions { display: flex; gap: 12rpx; margin-top: 20rpx; }.card-action, .action-btn { min-height: 88rpx; margin: 0; border-radius: 18rpx; font-size: 23rpx; font-weight: 700; line-height: 86rpx; }.card-action { flex: 1; }.card-action::after, .action-btn::after, .state-btn::after, .load-more::after { border: 0; }.primary { background: #4f46e5; color: #fff; }.secondary { border: 1rpx solid rgba(79, 70, 229, .25); background: #eef2ff; color: #4f46e5; }.ghost { border: 1rpx solid #e1e5ec; background: #fff; color: #4b5563; }
.state-card { padding: 60rpx 32rpx; text-align: center; }.state-title { display: block; font-size: 30rpx; font-weight: 800; }.state-desc { display: block; margin-top: 12rpx; color: #737b8c; font-size: 23rpx; line-height: 1.55; }.state-btn { width: 280rpx; min-height: 82rpx; margin-top: 24rpx; border-radius: 18rpx; background: #4f46e5; color: #fff; font-size: 24rpx; line-height: 82rpx; }.load-footer { padding: 28rpx 0; color: #9299a7; font-size: 21rpx; text-align: center; }.load-more { width: 240rpx; min-height: 76rpx; border-radius: 16rpx; background: #fff; color: #4f46e5; font-size: 23rpx; line-height: 76rpx; }
.detail-nav { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; margin-bottom: 20rpx; }.back-link { color: #4f46e5; font-size: 23rpx; font-weight: 700; }.nav-title { font-size: 30rpx; font-weight: 800; }.overview-card, .section-card { padding: 24rpx; }.section-card { margin-top: 20rpx; }.overview-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10rpx; margin-top: 22rpx; padding: 18rpx 0; border-top: 1rpx solid #eef0f4; border-bottom: 1rpx solid #eef0f4; }.overview-grid view { text-align: center; }.metric-value { font-size: 32rpx; font-weight: 800; }.metric-label { margin-top: 4rpx; color: #737b8c; font-size: 20rpx; }.overview-times { display: grid; gap: 10rpx; margin-top: 18rpx; }.overview-times view { display: flex; justify-content: space-between; gap: 16rpx; color: #737b8c; font-size: 21rpx; }.overview-times text:last-child { color: #374151; text-align: right; }
.section-title { font-size: 28rpx; font-weight: 800; }.section-desc { margin-top: 6rpx; color: #737b8c; font-size: 21rpx; line-height: 1.45; }.progress-count, .text-action { color: #4f46e5; font-size: 21rpx; font-weight: 700; }.progress-track { overflow: hidden; height: 12rpx; margin-top: 20rpx; border-radius: 999rpx; background: #e9ecf2; }.progress-fill { height: 100%; border-radius: inherit; background: #4f46e5; transition: width .2s ease; }.progress-stage { display: block; margin-top: 12rpx; color: #60697a; font-size: 21rpx; }
.timeline-list { margin-top: 20rpx; }.timeline-item { display: flex; gap: 16rpx; min-height: 82rpx; }.timeline-rail { position: relative; flex: 0 0 20rpx; }.timeline-dot { position: relative; z-index: 2; display: block; width: 18rpx; height: 18rpx; margin-top: 6rpx; border: 4rpx solid #fff; border-radius: 50%; background: #4f46e5; box-shadow: 0 0 0 2rpx #c7d2fe; }.node-completed { background: #16803c; box-shadow: 0 0 0 2rpx #bbf7d0; }.node-failed { background: #dc2626; box-shadow: 0 0 0 2rpx #fecaca; }.node-partial_success { background: #c2410c; box-shadow: 0 0 0 2rpx #fed7aa; }.node-cancelled { background: #6b7280; box-shadow: 0 0 0 2rpx #d1d5db; }.timeline-line { position: absolute; left: 8rpx; top: 24rpx; bottom: -2rpx; width: 2rpx; background: #e1e5ec; }.timeline-copy { flex: 1; min-width: 0; }.timeline-title { font-size: 24rpx; font-weight: 700; }.timeline-time { margin-top: 4rpx; color: #9299a7; font-size: 20rpx; }.timeline-desc { margin-top: 5rpx; color: #60697a; font-size: 21rpx; line-height: 1.45; }
.detail-task-list { display: grid; gap: 12rpx; margin-top: 18rpx; }.detail-task-row { display: flex; align-items: center; gap: 14rpx; padding: 16rpx; border-radius: 18rpx; background: #f8f9fc; }.task-index { display: flex; align-items: center; justify-content: center; flex: 0 0 46rpx; height: 46rpx; border-radius: 14rpx; background: #eef2ff; color: #4f46e5; font-size: 21rpx; font-weight: 800; }.detail-task-copy { flex: 1; min-width: 0; }.task-name { font-size: 23rpx; font-weight: 700; }.task-time { margin-top: 5rpx; color: #9299a7; font-size: 19rpx; line-height: 1.4; }.task-result { flex: 0 0 124rpx; color: #737b8c; font-size: 19rpx; text-align: right; }.task-state { display: block; margin-bottom: 5rpx; font-weight: 700; }.state-completed { color: #16803c; }.state-failed { color: #dc2626; }.state-generating { color: #4f46e5; }.state-pending { color: #737b8c; }
.works-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14rpx; margin-top: 18rpx; }.work-preview { overflow: hidden; min-width: 0; border-radius: 18rpx; background: #f8f9fc; }.work-image { display: block; width: 100%; height: 280rpx; background: #eef0f4; }.work-title { padding: 12rpx; overflow: hidden; color: #374151; font-size: 21rpx; text-overflow: ellipsis; white-space: nowrap; }.empty-result-card { display: grid; gap: 8rpx; }.failure-card { background: #fff8f7; }.failure-message { margin-top: 12rpx; color: #9f2020; font-size: 23rpx; line-height: 1.55; }.failure-hint { margin-top: 9rpx; color: #a35b34; font-size: 21rpx; line-height: 1.5; }
.input-warning { background: #fffaf0; }.inline-action { width: 260rpx; min-height: 76rpx; margin: 18rpx 0 0; border-radius: 16rpx; background: #4f46e5; color: #fff; font-size: 22rpx; line-height: 76rpx; }.inline-action::after { border: 0; }
.detail-actions { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12rpx; margin-top: 20rpx; }.action-btn { width: 100%; }.action-btn[disabled] { opacity: .5; }
@media (max-width: 340px) { .stats-grid { grid-template-columns: repeat(2, 1fr); }.record-times { flex-direction: column; gap: 5rpx; }.detail-actions { grid-template-columns: 1fr; }.detail-task-row { align-items: flex-start; }.task-result { flex-basis: 108rpx; } }
</style>
