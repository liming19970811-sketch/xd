<template>
  <view class="container">
    <view class="header">
      <text class="title">生产批次</text>
      <text class="subtitle">查看项目执行流程关联的全部批次</text>
      <text v-if="reviewContextHint" class="context-hint">{{ reviewContextHint }}</text>
      <view class="entry-row">
        <button class="queue-entry-btn" @click="goToDeliveryQueueList">交付队列</button>
        <button class="queue-entry-btn dashboard-entry-btn" @click="goToDeliveryDashboard">交付状态</button>
      </view>
    </view>

    <view class="filter-card">
      <input
        v-model.trim="searchKeyword"
        class="search-input"
        placeholder="搜索批次编号、名称或项目编号"
      />

      <view class="filter-row">
        <picker :range="statusFilterLabels" :value="statusFilterIndex" @change="onStatusFilterChange">
          <view class="filter-chip">状态：{{ formatStatusLabel(filterStatus) }}</view>
        </picker>
      </view>
    </view>

    <view class="filter-card quick-actions-card">
      <text class="quick-actions-title">批次快捷操作</text>
      <view class="batch-action-row">
        <button
          class="batch-action-btn primary"
          :disabled="!topPendingReviewBatch"
          @click="goToBatchDetailWithContext(topPendingReviewBatch, 'delivery-review', 'pending_review')"
        >
          打开优先待审核批次
        </button>
        <button
          class="batch-action-btn warning"
          :disabled="!topNeedsRevisionBatch"
          @click="goToBatchDetailWithContext(topNeedsRevisionBatch, 'delivery-review', 'needs_revision')"
        >
          打开优先待修改批次
        </button>
        <button
          class="batch-action-btn success"
          :disabled="!topDeliverableBatch"
          @click="goToBatchDetailWithContext(topDeliverableBatch, 'delivery-view', '')"
        >
          打开优先可交付批次
        </button>
      </view>
      <text v-if="!topPendingReviewBatch && !topNeedsRevisionBatch && !topDeliverableBatch" class="state-hint">
        {{ batches.length ? '当前筛选下没有可快捷处理的批次。' : '暂无批次数据。' }}
      </text>
    </view>

    <view class="filter-card quick-actions-card">
      <text class="quick-actions-title">批次优先处理建议</text>
      <text class="batch-line">优先批次分组：{{ priorityBatchGroupLabel }}</text>
      <text class="batch-line">优先原因：{{ priorityBatchReason }}</text>
      <text class="batch-line">建议操作：{{ priorityBatchActionLabel }}</text>
      <text
        v-if="priorityBatchGroupCount > 0"
        class="batch-line"
      >
        优先分组数量：{{ priorityBatchGroupCount }}
      </text>
      <view class="batch-action-row">
        <button
          class="batch-action-btn"
          :class="{ primary: priorityBatchGroup === 'pending_review', warning: priorityBatchGroup === 'needs_revision', success: priorityBatchGroup === 'deliverable' }"
          :disabled="!priorityBatchActionEnabled"
          @click="triggerPriorityBatchAction"
        >
          {{ priorityBatchActionLabel }}
        </button>
      </view>
    </view>

    <view class="filter-card quick-actions-card">
      <text class="quick-actions-title">批次分组操作</text>
      <text class="batch-line">当前分组：{{ focusGroupLabel }}</text>
      <text class="batch-line">推荐批次：{{ recommendedBatch ? (recommendedBatch.batchName || recommendedBatch.batchId || '暂无') : '暂无' }}</text>
      <view class="batch-action-row">
        <button
          class="batch-action-btn primary"
          :disabled="!pendingReviewBatches.length"
          @click="focusBatchGroup('pending_review')"
        >
          查看全部待审核批次
        </button>
        <button
          class="batch-action-btn warning"
          :disabled="!needsRevisionBatches.length"
          @click="focusBatchGroup('needs_revision')"
        >
          查看全部待修改批次
        </button>
        <button
          class="batch-action-btn success"
          :disabled="!deliverableBatches.length"
          @click="focusBatchGroup('deliverable')"
        >
          查看全部可交付批次
        </button>
        <button
          class="batch-action-btn"
          :disabled="!effectiveListFocusGroup"
          @click="focusBatchGroup('')"
        >
          重置分组
        </button>
      </view>
      <text
        v-if="effectiveListFocusGroup && !focusedBatches.length"
        class="state-hint"
      >
        {{ batches.length ? '当前分组没有匹配批次。' : '暂无批次数据。' }}
      </text>
    </view>

    <view id="batch-list-section" v-if="filteredBatches.length" class="batch-list">
      <view
        v-for="batch in displayBatches"
        :key="batch.batchId"
        class="batch-card"
        :class="{ focused: isFocusedBatch(batch), compact: isCompactBatch(batch), recommended: isRecommendedBatch(batch) }"
        @click="goToBatchDetail(batch)"
      >
        <text class="batch-name">{{ batch.batchName || '未命名批次' }}</text>
        <text v-if="isRecommendedBatch(batch)" class="recommended-badge">推荐批次</text>
        <text class="batch-line">批次编号：{{ batch.batchId || '暂无' }}</text>
        <text class="batch-line">项目编号：{{ batch.projectId || '暂无' }}</text>
        <text class="batch-line">项目名称：{{ getProjectName(batch.projectId) }}</text>
        <text class="batch-line">批次状态：{{ formatStatusLabel(batch.status) }}</text>
        <text class="batch-line">
          交付审核：<text class="review-badge">{{ formatStatusLabel(getBatchDeliveryReviewLabel(batch)) }}</text>
        </text>
        <text class="batch-line">已通过数量：{{ getBatchApprovedCount(batch) }}</text>
        <text class="batch-line">待审核数量：{{ getBatchPendingReviewCount(batch) }}</text>
        <text class="batch-line">待修改数量：{{ getBatchNeedsRevisionCount(batch) }}</text>
        <text v-if="!isCompactBatch(batch)" class="batch-line">已有结果数量：{{ getBatchReadyResultCount(batch) }}</text>
        <text v-if="!isCompactBatch(batch)" class="batch-line">任务数量：{{ getTaskCount(batch.taskIds) }}</text>
        <text v-if="!isCompactBatch(batch)" class="batch-line">创建时间：{{ batch.createdAt || '暂无' }}</text>
        <text v-if="!isCompactBatch(batch)" class="batch-line">更新时间：{{ batch.updatedAt || '暂无' }}</text>
        <text v-else class="batch-line compact-hint">当前为精简视图，可切换分组调整优先级。</text>
        <view class="batch-action-row">
          <button
            v-if="getBatchNeedsRevisionCount(batch) > 0"
            class="batch-action-btn warning"
            @click.stop="goToBatchDetailWithContext(batch, 'delivery-review', 'needs_revision')"
          >
            处理批次修改
          </button>
          <button
            v-if="getBatchPendingReviewCount(batch) > 0"
            class="batch-action-btn primary"
            @click.stop="goToBatchDetailWithContext(batch, 'delivery-review', 'pending_review')"
          >
            审核批次
          </button>
          <button
            v-if="getBatchDeliveryReviewLabel(batch) === 'ready_to_deliver'"
            class="batch-action-btn success"
            @click.stop="goToBatchDetailWithContext(batch, 'delivery-view', '')"
          >
            查看交付批次
          </button>
        </view>
      </view>
    </view>

    <view v-else class="empty-state">
      <text class="empty-title">{{ batches.length ? '没有匹配批次' : '暂无批次' }}</text>
      <text class="empty-desc">
        {{ batches.length ? '请调整状态筛选或搜索关键词。' : '项目创建生产批次后会显示在这里。' }}
      </text>
    </view>
  </view>
</template>

<script>
import { getBatchList } from '../../utils/service/batchStore'
import { getProjectList } from '../../utils/service/projectStore'
import { getMainChainState } from '../../utils/mainChainState'

export default {
  data() {
    return {
      batches: [],
      projectMap: {},
      chainState: getMainChainState(),
      searchKeyword: '',
      filterStatus: 'all',
      reviewContext: '',
      pageMode: '',
      listManualFocusGroup: '',
      compactBatchLimit: 2
    }
  },
  onLoad(query) {
    this.applyPageQuery(query)
  },
  onShow() {
    this.loadBatches()
  },
  computed: {
    reviewContextHint() {
      if (this.pageMode !== 'delivery-review') {
        return ''
      }
      if (this.reviewContext === 'pending_review') {
        return '当前为待审核交付任务，请优先检查关联批次。'
      }
      if (this.reviewContext === 'needs_revision') {
        return '当前任务需要修改，请检查关联批次和重试流程。'
      }
      return '当前为交付审核模式。'
    },
    statusFilterOptions() {
      const options = Array.from(new Set(this.batches.map((batch) => String(batch.status || '').trim()).filter(Boolean)))
      return ['all', ...options]
    },
    statusFilterIndex() {
      return this.getOptionIndex(this.statusFilterOptions, this.filterStatus)
    },
    statusFilterLabels() {
      return this.statusFilterOptions.map((value) => this.formatStatusLabel(value))
    },
    tasksById() {
      return (this.chainState.tasks && this.chainState.tasks.byId) || {}
    },
    filteredBatches() {
      const keyword = String(this.searchKeyword || '').trim().toLowerCase()

      const filtered = this.batches.filter((batch) => {
        if (!this.isBatchMatchedByReviewContext(batch)) {
          return false
        }

        if (this.filterStatus !== 'all' && batch.status !== this.filterStatus) {
          return false
        }

        if (!keyword) {
          return true
        }

        const searchableFields = [batch.batchId, batch.batchName, batch.projectId]
        return searchableFields.some((field) => String(field || '').toLowerCase().includes(keyword))
      })

      return filtered.sort((left, right) => this.compareBatchByDeliveryPriority(left, right))
    },
    topPendingReviewBatch() {
      return this.filteredBatches.find((batch) => {
        const label = this.getBatchDeliveryReviewLabel(batch)
        return label === 'pending_review' || label === 'partially_reviewed'
      }) || null
    },
    topNeedsRevisionBatch() {
      return this.filteredBatches.find((batch) => this.getBatchDeliveryReviewLabel(batch) === 'revision_required') || null
    },
    topDeliverableBatch() {
      return this.filteredBatches.find((batch) => this.getBatchDeliveryReviewLabel(batch) === 'ready_to_deliver') || null
    },
    priorityBatchGroup() {
      if (this.needsRevisionBatches.length > 0) {
        return '待修改'
      }
      if (this.pendingReviewBatches.length > 0) {
        return '待审核'
      }
      if (this.deliverableBatches.length > 0) {
        return '可交付'
      }
      return '暂无'
    },
    priorityBatchGroupLabel() {
      if (this.priorityBatchGroup === 'needs_revision') {
        return 'needs_revision'
      }
      if (this.priorityBatchGroup === 'pending_review') {
        return 'pending_review'
      }
      if (this.priorityBatchGroup === 'deliverable') {
        return 'deliverable'
      }
      return 'none'
    },
    priorityBatchReason() {
      if (this.priorityBatchGroup === 'needs_revision') {
        return `${this.needsRevisionBatches.length} 个批次需要修改，建议优先处理。`
      }
      if (this.priorityBatchGroup === 'pending_review') {
        return `${this.pendingReviewBatches.length} 个批次待审核或部分已审核，建议尽快处理。`
      }
      if (this.priorityBatchGroup === 'deliverable') {
        return `${this.deliverableBatches.length} 个批次已可交付，建议进入交付视图。`
      }
      return '当前筛选条件下暂无优先批次。'
    },
    priorityBatchActionLabel() {
      if (this.priorityBatchGroup === 'needs_revision') {
        return '查看首个待修改批次'
      }
      if (this.priorityBatchGroup === 'pending_review') {
        return '查看首个待审核批次'
      }
      if (this.priorityBatchGroup === 'deliverable') {
        return '查看首个可交付批次'
      }
      return '暂无优先操作'
    },
    priorityBatchGroupCount() {
      if (this.priorityBatchGroup === 'needs_revision') {
        return this.needsRevisionBatches.length
      }
      if (this.priorityBatchGroup === 'pending_review') {
        return this.pendingReviewBatches.length
      }
      if (this.priorityBatchGroup === 'deliverable') {
        return this.deliverableBatches.length
      }
      return 0
    },
    priorityBatchActionEnabled() {
      if (this.priorityBatchGroup === 'needs_revision') {
        return !!this.topNeedsRevisionBatch
      }
      if (this.priorityBatchGroup === 'pending_review') {
        return !!this.topPendingReviewBatch
      }
      if (this.priorityBatchGroup === 'deliverable') {
        return !!this.topDeliverableBatch
      }
      return false
    },
    pendingReviewBatches() {
      return this.filteredBatches.filter((batch) => {
        const label = this.getBatchDeliveryReviewLabel(batch)
        return label === 'pending_review' || label === 'partially_reviewed'
      })
    },
    needsRevisionBatches() {
      return this.filteredBatches.filter((batch) => this.getBatchDeliveryReviewLabel(batch) === 'revision_required')
    },
    deliverableBatches() {
      return this.filteredBatches.filter((batch) => this.getBatchDeliveryReviewLabel(batch) === 'ready_to_deliver')
    },
    contextFocusGroup() {
      if (this.pageMode === 'delivery-view') {
        return 'deliverable'
      }
      if (this.pageMode === 'delivery-review' && this.reviewContext === 'pending_review') {
        return '待审核'
      }
      if (this.pageMode === 'delivery-review' && this.reviewContext === 'needs_revision') {
        return '待修改'
      }
      return ''
    },
    effectiveListFocusGroup() {
      return this.listManualFocusGroup || this.contextFocusGroup
    },
    focusGroupLabel() {
      if (this.effectiveListFocusGroup === 'pending_review') {
        return 'pending_review'
      }
      if (this.effectiveListFocusGroup === 'needs_revision') {
        return 'needs_revision'
      }
      if (this.effectiveListFocusGroup === 'deliverable') {
        return '可交付'
      }
      return '全部'
    },
    focusedBatches() {
      if (!this.effectiveListFocusGroup) {
        return this.filteredBatches
      }
      return this.filteredBatches.filter((batch) => this.matchesBatchFocusGroup(batch, this.effectiveListFocusGroup))
    },
    recommendedBatch() {
      return this.focusedBatches.length ? this.focusedBatches[0] : null
    },
    displayBatches() {
      if (!this.effectiveListFocusGroup) {
        return this.filteredBatches
      }
      const focusedIds = new Set(this.focusedBatches.map((batch) => batch.batchId))
      const compactOthers = this.filteredBatches.filter((batch) => !focusedIds.has(batch.batchId)).slice(0, this.compactBatchLimit)
      return [...this.focusedBatches, ...compactOthers]
    }
  },
  methods: {
    formatStatusLabel(value) {
      const labels = {
        all: '全部',
        draft: '草稿',
        pending: '待处理',
        generating: '生成中',
        processing: '处理中',
        completed: '已完成',
        failed: '失败',
        pending_review: '待审核',
        partially_reviewed: '部分已审核',
        revision_required: '待修改',
        ready_to_deliver: '可交付',
        delivered: '已交付'
      }
      return labels[value] || value || '暂无'
    },
    applyPageQuery(query = {}) {
      const mode = query && query.mode ? decodeURIComponent(query.mode) : ''
      const reviewContext = query && query.reviewContext ? decodeURIComponent(query.reviewContext) : ''
      const status = query && query.status ? decodeURIComponent(query.status) : ''
      this.pageMode = mode || ''
      this.reviewContext = reviewContext || ''

      if (status) {
        this.filterStatus = status
      }
    },
    loadBatches() {
      this.batches = getBatchList()
      this.chainState = getMainChainState()

      const projects = getProjectList()
      this.projectMap = projects.reduce((acc, project) => {
        acc[project.projectId] = project
        return acc
      }, {})
    },
    getBatchTasks(batch) {
      const taskIds = Array.isArray(batch && batch.taskIds) ? batch.taskIds : []
      return taskIds
        .map((taskId) => this.tasksById[taskId])
        .filter(Boolean)
    },
    hasTaskResult(task) {
      return !!(
        (task && task.result && task.result.coverUrl) ||
        (task && task.result && Array.isArray(task.result.items) && task.result.items.length)
      )
    },
    isBatchMatchedByReviewContext(batch) {
      if (this.pageMode !== 'delivery-review' || !this.reviewContext) {
        return true
      }

      const tasks = this.getBatchTasks(batch)
      if (!tasks.length) {
        return false
      }

      if (this.reviewContext === 'pending_review') {
        return tasks.some((task) => this.hasTaskResult(task) && (task.deliveryStatus || 'pending_review') === 'pending_review')
      }

      if (this.reviewContext === 'needs_revision') {
        return tasks.some((task) => (task.deliveryStatus || 'pending_review') === 'needs_revision')
      }

      return true
    },
    matchesBatchFocusGroup(batch, groupKey = '') {
      if (!batch || !groupKey) {
        return true
      }
      const label = this.getBatchDeliveryReviewLabel(batch)
      if (groupKey === 'pending_review') {
        return label === 'pending_review' || label === 'partially_reviewed'
      }
      if (groupKey === 'needs_revision') {
        return label === 'revision_required'
      }
      if (groupKey === 'deliverable') {
        return label === 'ready_to_deliver'
      }
      return true
    },
    isFocusedBatch(batch) {
      if (!this.effectiveListFocusGroup) {
        return false
      }
      return this.matchesBatchFocusGroup(batch, this.effectiveListFocusGroup)
    },
    isCompactBatch(batch) {
      if (!this.effectiveListFocusGroup) {
        return false
      }
      return !this.isFocusedBatch(batch)
    },
    isRecommendedBatch(batch) {
      return !!(batch && this.recommendedBatch && batch.batchId && batch.batchId === this.recommendedBatch.batchId)
    },
    focusBatchGroup(groupKey = '') {
      this.listManualFocusGroup = groupKey
      this.$nextTick(() => {
        uni.pageScrollTo({
          selector: '#batch-list-section',
          duration: 220
        })
      })
    },
    triggerPriorityBatchAction() {
      if (this.priorityBatchGroup === 'needs_revision' && this.topNeedsRevisionBatch) {
        this.goToBatchDetailWithContext(this.topNeedsRevisionBatch, 'delivery-review', 'needs_revision')
        return
      }
      if (this.priorityBatchGroup === 'pending_review' && this.topPendingReviewBatch) {
        this.goToBatchDetailWithContext(this.topPendingReviewBatch, 'delivery-review', 'pending_review')
        return
      }
      if (this.priorityBatchGroup === 'deliverable' && this.topDeliverableBatch) {
        this.goToBatchDetailWithContext(this.topDeliverableBatch, 'delivery-view', '')
        return
      }
      uni.showToast({
        title: 'No priority batch to open',
        icon: 'none'
      })
    },
    getOptionIndex(options, value) {
      const index = options.indexOf(value)
      return index >= 0 ? index : 0
    },
    onStatusFilterChange(event) {
      const index = Number(event.detail.value)
      this.filterStatus = this.statusFilterOptions[index] || 'all'
    },
    getTaskCount(taskIds) {
      return Array.isArray(taskIds) ? taskIds.length : 0
    },
    getBatchRelatedTasks(batch) {
      return this.getBatchTasks(batch)
    },
    getBatchReviewableTasks(batch) {
      return this.getBatchRelatedTasks(batch).filter((task) => this.hasTaskResult(task))
    },
    getBatchApprovedCount(batch) {
      return this.getBatchReviewableTasks(batch).filter((task) => (task.deliveryStatus || 'pending_review') === 'approved').length
    },
    getBatchNeedsRevisionCount(batch) {
      return this.getBatchReviewableTasks(batch).filter((task) => (task.deliveryStatus || 'pending_review') === 'needs_revision').length
    },
    getBatchPendingReviewCount(batch) {
      return this.getBatchReviewableTasks(batch).filter((task) => {
        const status = task.deliveryStatus || 'pending_review'
        return status !== 'approved' && status !== 'needs_revision'
      }).length
    },
    getBatchReadyResultCount(batch) {
      return this.getBatchReviewableTasks(batch).length
    },
    getBatchDeliveryReviewLabel(batch) {
      const readyCount = this.getBatchReadyResultCount(batch)
      const approvedCount = this.getBatchApprovedCount(batch)
      const needsRevisionCount = this.getBatchNeedsRevisionCount(batch)
      const pendingReviewCount = this.getBatchPendingReviewCount(batch)

      if (readyCount === 0) {
        return 'pending_review'
      }

      if (needsRevisionCount > 0) {
        return 'revision_required'
      }

      if (approvedCount === readyCount && readyCount > 0) {
        return 'ready_to_deliver'
      }

      if (approvedCount > 0 && pendingReviewCount > 0) {
        return 'partially_reviewed'
      }

      return 'pending_review'
    },
    getBatchPriorityRank(batch) {
      const label = this.getBatchDeliveryReviewLabel(batch)
      if (label === 'revision_required') {
        return 0
      }
      if (label === 'pending_review' || label === 'partially_reviewed') {
        return 1
      }
      if (label === 'ready_to_deliver') {
        return 2
      }
      return 3
    },
    getBatchProcessingLoad(batch) {
      const label = this.getBatchDeliveryReviewLabel(batch)
      if (label === 'revision_required') {
        return this.getBatchNeedsRevisionCount(batch)
      }
      if (label === 'pending_review' || label === 'partially_reviewed') {
        return this.getBatchPendingReviewCount(batch)
      }
      if (label === 'ready_to_deliver') {
        return this.getBatchReadyResultCount(batch)
      }
      return 0
    },
    getBatchSortTime(batch) {
      return new Date(batch.updatedAt || batch.createdAt || '').getTime() || 0
    },
    compareBatchByDeliveryPriority(left, right) {
      const rankDiff = this.getBatchPriorityRank(left) - this.getBatchPriorityRank(right)
      if (rankDiff !== 0) {
        return rankDiff
      }

      const loadDiff = this.getBatchProcessingLoad(right) - this.getBatchProcessingLoad(left)
      if (loadDiff !== 0) {
        return loadDiff
      }

      return this.getBatchSortTime(right) - this.getBatchSortTime(left)
    },
    getProjectName(projectId) {
      if (!projectId) {
        return '暂无'
      }
      const project = this.projectMap[projectId]
      return (project && project.projectName) || '暂无'
    },
    goToBatchDetail(batch) {
      if (!batch || !batch.batchId) {
        uni.showToast({
          title: 'Batch not found',
          icon: 'none'
        })
        return
      }

      uni.navigateTo({
        url: `/package-mobile-enterprise/batch-detail/batch-detail?batchId=${encodeURIComponent(batch.batchId)}`
      })
    },
    goToBatchDetailWithContext(batch, mode = '', reviewContext = '') {
      if (!batch || !batch.batchId) {
        uni.showToast({
          title: 'Batch not found',
          icon: 'none'
        })
        return
      }
      const query = [`batchId=${encodeURIComponent(batch.batchId)}`]
      if (mode) {
        query.push(`mode=${encodeURIComponent(mode)}`)
      }
      if (reviewContext) {
        query.push(`reviewContext=${encodeURIComponent(reviewContext)}`)
      }
      uni.navigateTo({
        url: `/package-mobile-enterprise/batch-detail/batch-detail?${query.join('&')}`
      })
    },
    goToDeliveryQueueList() {
      uni.navigateTo({
        url: '/package-mobile-enterprise/delivery-queue-list/delivery-queue-list'
      })
    },
    goToDeliveryDashboard() {
      uni.navigateTo({
        url: '/package-mobile-enterprise/delivery-dashboard/delivery-dashboard'
      })
    }
  }
}
</script>

<style scoped>
.container {
  min-height: 100vh;
  background: #f6f6f9;
  padding: 24rpx;
}

.header {
  margin-bottom: 24rpx;
}

.title {
  display: block;
  font-size: 40rpx;
  font-weight: 700;
  color: #222;
}

.subtitle {
  display: block;
  margin-top: 8rpx;
  font-size: 24rpx;
  color: #888;
}

.context-hint {
  display: block;
  margin-top: 10rpx;
  font-size: 22rpx;
  color: #1677ff;
}

.queue-entry-btn {
  margin-top: 16rpx;
  background: #13c2c2;
  color: #fff;
  border-radius: 999rpx;
  font-size: 22rpx;
  padding: 10rpx 18rpx;
}

.entry-row {
  display: flex;
  gap: 10rpx;
  flex-wrap: wrap;
}

.dashboard-entry-btn {
  background: #1677ff;
}

.filter-card {
  background: #fff;
  border-radius: 24rpx;
  padding: 24rpx;
  margin-bottom: 20rpx;
}

.quick-actions-card {
  margin-top: -4rpx;
}

.quick-actions-title {
  display: block;
  margin-bottom: 10rpx;
  font-size: 24rpx;
  font-weight: 600;
  color: #222;
}

.search-input {
  width: 100%;
  background: #f5f7fa;
  border-radius: 16rpx;
  padding: 18rpx 20rpx;
  box-sizing: border-box;
  font-size: 24rpx;
  margin-bottom: 14rpx;
}

.filter-row {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
}

.filter-chip {
  padding: 10rpx 16rpx;
  border-radius: 999rpx;
  background: #e6f4ff;
  color: #1677ff;
  font-size: 22rpx;
}

.batch-list {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}

.batch-card,
.empty-state {
  background: #fff;
  border-radius: 24rpx;
  padding: 24rpx;
}

.batch-card {
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.04);
}

.batch-card.focused {
  border: 1rpx solid #1677ff;
}

.batch-card.compact {
  opacity: 0.84;
}

.batch-card.recommended {
  border: 1rpx solid #16a34a;
  box-shadow: 0 0 0 1rpx rgba(22, 163, 74, 0.12);
}

.batch-name {
  display: block;
  font-size: 30rpx;
  font-weight: 600;
  color: #222;
}

.recommended-badge {
  display: inline-block;
  margin-top: 8rpx;
  padding: 4rpx 12rpx;
  border-radius: 999rpx;
  background: #f6ffed;
  color: #389e0d;
  font-size: 20rpx;
}

.batch-line {
  display: block;
  margin-top: 10rpx;
  font-size: 24rpx;
  color: #444;
  word-break: break-all;
}

.review-badge {
  color: #1677ff;
  font-weight: 600;
}

.batch-action-row {
  margin-top: 14rpx;
  display: flex;
  flex-wrap: wrap;
  gap: 10rpx;
}

.compact-hint {
  color: #888;
}

.batch-action-btn {
  border-radius: 999rpx;
  font-size: 22rpx;
  padding: 8rpx 14rpx;
  min-width: 190rpx;
}

.batch-action-btn.primary {
  background: #1677ff;
  color: #fff;
}

.batch-action-btn.warning {
  background: #fff7e6;
  color: #d46b08;
}

.batch-action-btn.success {
  background: #f6ffed;
  color: #389e0d;
}

.batch-action-btn[disabled],
.queue-entry-btn[disabled] {
  opacity: 0.55;
}

.state-hint {
  display: block;
  margin-top: 10rpx;
  font-size: 22rpx;
  color: #8c8c8c;
}

.empty-state {
  text-align: center;
}

.empty-title {
  display: block;
  font-size: 32rpx;
  font-weight: 600;
  color: #222;
}

.empty-desc {
  display: block;
  margin-top: 14rpx;
  font-size: 24rpx;
  color: #888;
}
</style>
