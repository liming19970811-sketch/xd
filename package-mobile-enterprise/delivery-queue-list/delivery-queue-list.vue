<template>
  <view class="container">
    <view class="header-card">
      <text class="title">交付补偿队列</text>
      <text class="subtitle">查看交付同步、校准和重试状态</text>
      <view class="header-actions">
        <button class="header-btn" @click="goToDeliveryDashboard">交付状态看板</button>
      </view>
    </view>

    <view class="summary-card">
      <text class="summary-line">队列总数：{{ queueTotalCount }}</text>
      <text class="summary-line">待处理：{{ pendingCount }}</text>
      <text class="summary-line">失败：{{ failedCount }}</text>
      <text class="summary-line">已解决：{{ resolvedCount }}</text>
      <text class="summary-line">同步任务：{{ syncCount }}</text>
      <text class="summary-line">校准任务：{{ reconcileCount }}</text>
    </view>

    <view class="summary-card">
      <text class="section-title">队列处理概览</text>
      <text class="summary-line">同步待处理：{{ syncPendingCount }}</text>
      <text class="summary-line">同步失败：{{ syncFailedCount }}</text>
      <text class="summary-line">校准待处理：{{ reconcilePendingCount }}</text>
      <text class="summary-line">校准失败：{{ reconcileFailedCount }}</text>
      <text class="summary-line">已解决：{{ resolvedCount }}</text>
    </view>

    <view class="summary-card">
      <text class="section-title">队列处理进度</text>
      <text class="summary-line">筛选后同步失败：{{ filteredFailedSyncTotal }}</text>
      <text class="summary-line">筛选后校准失败：{{ filteredFailedReconcileTotal }}</text>
      <text class="summary-line">筛选后待处理：{{ filteredPendingTotal }}</text>
      <text class="summary-line">筛选后已解决：{{ filteredResolvedTotal }}</text>
      <text class="summary-line">剩余可处理项：{{ filteredRemainingActionableTotal }}</text>
      <text class="focus-hint">当前重点：{{ currentQueueFocusHint }}</text>
    </view>

    <view class="filter-card">
      <view class="filter-row">
        <input
          v-model.trim="batchIdFilter"
          class="filter-input"
          placeholder="按批次编号筛选"
        />
        <input
          v-model.trim="projectIdFilter"
          class="filter-input"
          placeholder="按项目编号筛选"
        />
      </view>
      <view class="filter-row">
        <button class="filter-btn" :class="{ active: typeFilter === 'all' }" @click="typeFilter = 'all'">类型：全部</button>
        <button class="filter-btn" :class="{ active: typeFilter === 'sync' }" @click="typeFilter = 'sync'">类型：同步</button>
        <button class="filter-btn" :class="{ active: typeFilter === 'reconcile' }" @click="typeFilter = 'reconcile'">类型：校准</button>
      </view>
      <view class="filter-row">
        <button class="filter-btn" :class="{ active: statusFilter === 'all' }" @click="statusFilter = 'all'">状态：全部</button>
        <button class="filter-btn" :class="{ active: statusFilter === 'pending' }" @click="statusFilter = 'pending'">状态：待处理</button>
        <button class="filter-btn" :class="{ active: statusFilter === 'failed' }" @click="statusFilter = 'failed'">状态：失败</button>
        <button class="filter-btn" :class="{ active: statusFilter === 'resolved' }" @click="statusFilter = 'resolved'">状态：已解决</button>
      </view>
      <view class="filter-row">
        <button class="retry-btn" :disabled="retrying || retryableCount === 0" @click="retryFailedQueueItems">
          {{ retrying ? '重试中...' : '重试失败队列项' }}
        </button>
        <button class="retry-btn next-btn" :disabled="!nextFailedQueueItem" @click="goToNextFailedQueueItem">
          下一个失败队列项
        </button>
      </view>
    </view>

    <view class="summary-card">
      <text class="section-title">异常分组</text>

      <view class="group-block">
        <view class="group-head">
          <text class="group-title">同步失败项</text>
          <view class="group-action-row">
            <button
              class="group-action-btn group-retry-btn"
              :disabled="retrying || retryableFailedSyncItems.length === 0"
              @click="retryFailedSyncGroup"
            >
              重试同步失败分组
            </button>
            <button
              class="group-action-btn"
              :disabled="!topFailedSyncItem"
              @click="openTopFailedSyncBatch"
            >
              打开优先同步失败批次
            </button>
          </view>
        </view>
        <view v-if="failedSyncItems.length" class="group-list">
          <view v-for="item in failedSyncItems" :key="`failed_sync_${item.queueId}`" class="queue-item grouped-item">
            <text class="queue-main">任务：{{ item.taskId || '暂无' }}</text>
            <text class="queue-meta">类型：{{ item.type || '暂无' }} | 状态：{{ item.status || '暂无' }}</text>
            <text class="queue-meta">批次：{{ getTaskBatchId(item.taskId) || '暂无' }} | 项目：{{ getTaskProjectId(item.taskId) || '暂无' }}</text>
            <text class="queue-meta">时间：{{ item.updatedAt || item.createdAt || '暂无' }}</text>
            <view class="item-action-row">
              <button v-if="getTaskBatchId(item.taskId)" class="mini-btn" @click="goToBatchDetail(item.taskId)">查看批次</button>
              <button v-if="getTaskProjectId(item.taskId)" class="mini-btn" @click="goToProjectDetail(item.taskId)">查看项目</button>
              <button class="mini-btn" :disabled="!item.taskId" @click="goToTaskDetail(item.taskId)">查看结果</button>
            </view>
          </view>
        </view>
        <text v-else class="group-empty">{{ getGroupEmptyText('failed sync') }}</text>
      </view>

      <view class="group-block">
        <view class="group-head">
          <text class="group-title">校准失败项</text>
          <view class="group-action-row">
            <button
              class="group-action-btn group-retry-btn"
              :disabled="retrying || retryableFailedReconcileItems.length === 0"
              @click="retryFailedReconcileGroup"
            >
              重试校准失败分组
            </button>
            <button
              class="group-action-btn"
              :disabled="!topFailedReconcileItem"
              @click="openTopFailedReconcileBatch"
            >
              打开优先校准失败批次
            </button>
          </view>
        </view>
        <view v-if="failedReconcileItems.length" class="group-list">
          <view v-for="item in failedReconcileItems" :key="`failed_reconcile_${item.queueId}`" class="queue-item grouped-item">
            <text class="queue-main">任务：{{ item.taskId || '暂无' }}</text>
            <text class="queue-meta">类型：{{ item.type || '暂无' }} | 状态：{{ item.status || '暂无' }}</text>
            <text class="queue-meta">批次：{{ getTaskBatchId(item.taskId) || '暂无' }} | 项目：{{ getTaskProjectId(item.taskId) || '暂无' }}</text>
            <text class="queue-meta">时间：{{ item.updatedAt || item.createdAt || '暂无' }}</text>
            <view class="item-action-row">
              <button v-if="getTaskBatchId(item.taskId)" class="mini-btn" @click="goToBatchDetail(item.taskId)">查看批次</button>
              <button v-if="getTaskProjectId(item.taskId)" class="mini-btn" @click="goToProjectDetail(item.taskId)">查看项目</button>
              <button class="mini-btn" :disabled="!item.taskId" @click="goToTaskDetail(item.taskId)">查看结果</button>
            </view>
          </view>
        </view>
        <text v-else class="group-empty">{{ getGroupEmptyText('failed reconcile') }}</text>
      </view>

      <view class="group-block">
        <view class="group-head">
          <text class="group-title">待处理队列项</text>
          <view class="group-action-row">
            <button
              class="group-action-btn group-retry-btn"
              :disabled="retrying || retryablePendingQueueItems.length === 0"
              @click="retryPendingQueueGroup"
            >
              重试待处理分组
            </button>
            <button
              class="group-action-btn"
              :disabled="!topPendingQueueItem"
              @click="openTopPendingQueueResult"
            >
              打开优先待处理结果
            </button>
          </view>
        </view>
        <view v-if="pendingQueueItems.length" class="group-list">
          <view v-for="item in pendingQueueItems" :key="`pending_${item.queueId}`" class="queue-item grouped-item">
            <text class="queue-main">任务：{{ item.taskId || '暂无' }}</text>
            <text class="queue-meta">类型：{{ item.type || '暂无' }} | 状态：{{ item.status || '暂无' }}</text>
            <text class="queue-meta">批次：{{ getTaskBatchId(item.taskId) || '暂无' }} | 项目：{{ getTaskProjectId(item.taskId) || '暂无' }}</text>
            <text class="queue-meta">时间：{{ item.updatedAt || item.createdAt || '暂无' }}</text>
            <view class="item-action-row">
              <button v-if="getTaskBatchId(item.taskId)" class="mini-btn" @click="goToBatchDetail(item.taskId)">查看批次</button>
              <button v-if="getTaskProjectId(item.taskId)" class="mini-btn" @click="goToProjectDetail(item.taskId)">查看项目</button>
              <button class="mini-btn" :disabled="!item.taskId" @click="goToTaskDetail(item.taskId)">查看结果</button>
            </view>
          </view>
        </view>
        <text v-else class="group-empty">{{ getGroupEmptyText('pending queue') }}</text>
      </view>
    </view>

    <view v-if="displayQueueItems.length" class="list-card">
      <view v-for="item in displayQueueItems" :key="item.queueId" class="queue-item">
        <text class="queue-main">任务：{{ item.taskId || '暂无' }}</text>
        <text class="queue-meta">类型：{{ item.type || '暂无' }} | 状态：{{ item.status || '暂无' }}</text>
        <text class="queue-meta">创建时间：{{ item.createdAt || '暂无' }}</text>
        <text class="queue-meta">更新时间：{{ item.updatedAt || '暂无' }}</text>
        <text class="queue-meta">批次：{{ getTaskBatchId(item.taskId) || '暂无' }} | 项目：{{ getTaskProjectId(item.taskId) || '暂无' }}</text>
        <view class="item-action-row">
          <button v-if="getTaskBatchId(item.taskId)" class="mini-btn" @click="goToBatchDetail(item.taskId)">查看批次</button>
          <button v-if="getTaskProjectId(item.taskId)" class="mini-btn" @click="goToProjectDetail(item.taskId)">查看项目</button>
          <button class="mini-btn" :disabled="!item.taskId" @click="goToTaskDetail(item.taskId)">查看结果</button>
        </view>
      </view>
    </view>

    <view v-else class="empty-card">
      <text class="empty-title">{{ queueItems.length ? '没有匹配的队列项' : '暂无队列项' }}</text>
      <text class="empty-desc">
        {{ queueItems.length ? '请调整类型、状态、批次或项目筛选。' : '同步或校准产生补偿任务后会显示在这里。' }}
      </text>
    </view>
  </view>
</template>

<script>
import { fetchTaskDeliveryStatus, syncTaskDeliveryStatus } from '../../utils/api/task'
import { getMainChainState, patchMainChainState } from '../../utils/mainChainState'
import { updateDeliveryQueueItem } from '../../utils/task/taskDeliveryQueue'

export default {
  data() {
    return {
      chainState: getMainChainState(),
      typeFilter: 'all',
      statusFilter: 'all',
      batchIdFilter: '',
      projectIdFilter: '',
      retrying: false
    }
  },
  onLoad(query) {
    this.applyInitialFilters(query)
  },
  onShow() {
    this.refreshState()
  },
  computed: {
    queueItems() {
      const queue = Array.isArray(this.chainState.deliveryCompensationQueue)
        ? this.chainState.deliveryCompensationQueue
        : []
      return queue.slice().sort((a, b) => {
        const left = String((b && (b.updatedAt || b.createdAt)) || '')
        const right = String((a && (a.updatedAt || a.createdAt)) || '')
        return left.localeCompare(right)
      })
    },
    queueTotalCount() {
      return this.queueItems.length
    },
    pendingCount() {
      return this.queueItems.filter((item) => item.status === 'pending').length
    },
    failedCount() {
      return this.queueItems.filter((item) => item.status === 'failed').length
    },
    resolvedCount() {
      return this.queueItems.filter((item) => item.status === 'resolved').length
    },
    syncCount() {
      return this.queueItems.filter((item) => item.type === 'sync').length
    },
    reconcileCount() {
      return this.queueItems.filter((item) => item.type === 'reconcile').length
    },
    syncPendingCount() {
      return this.queueItems.filter((item) => item.type === 'sync' && item.status === 'pending').length
    },
    syncFailedCount() {
      return this.queueItems.filter((item) => item.type === 'sync' && item.status === 'failed').length
    },
    reconcilePendingCount() {
      return this.queueItems.filter((item) => item.type === 'reconcile' && item.status === 'pending').length
    },
    reconcileFailedCount() {
      return this.queueItems.filter((item) => item.type === 'reconcile' && item.status === 'failed').length
    },
    filteredQueueItems() {
      const batchKeyword = String(this.batchIdFilter || '').trim().toLowerCase()
      const projectKeyword = String(this.projectIdFilter || '').trim().toLowerCase()

      const filtered = this.queueItems.filter((item) => {
        if (this.typeFilter !== 'all' && item.type !== this.typeFilter) {
          return false
        }
        if (this.statusFilter !== 'all' && item.status !== this.statusFilter) {
          return false
        }
        const batchId = String(this.getTaskBatchId(item.taskId) || '').toLowerCase()
        const projectId = String(this.getTaskProjectId(item.taskId) || '').toLowerCase()
        if (batchKeyword && !batchId.includes(batchKeyword)) {
          return false
        }
        if (projectKeyword && !projectId.includes(projectKeyword)) {
          return false
        }
        return true
      })

      const batchLoadMap = {}
      const projectLoadMap = {}
      filtered.forEach((item) => {
        const batchId = this.getTaskBatchId(item.taskId)
        const projectId = this.getTaskProjectId(item.taskId)
        const isException = item && (item.status === 'failed' || item.status === 'pending')
        if (!isException) {
          return
        }
        if (batchId) {
          batchLoadMap[batchId] = (batchLoadMap[batchId] || 0) + 1
        }
        if (projectId) {
          projectLoadMap[projectId] = (projectLoadMap[projectId] || 0) + 1
        }
      })

      return filtered.sort((left, right) => this.compareQueueItemPriority(left, right, batchLoadMap, projectLoadMap))
    },
    displayQueueItems() {
      return this.filteredQueueItems.slice(0, 80)
    },
    retryableItems() {
      return this.queueItems.filter((item) => ['pending', 'failed'].includes(item.status))
    },
    retryableCount() {
      return this.retryableItems.length
    },
    filteredFailedSyncTotal() {
      return this.filteredQueueItems.filter((item) => item && item.type === 'sync' && item.status === 'failed').length
    },
    filteredFailedReconcileTotal() {
      return this.filteredQueueItems.filter((item) => item && item.type === 'reconcile' && item.status === 'failed').length
    },
    filteredPendingTotal() {
      return this.filteredQueueItems.filter((item) => item && item.status === 'pending').length
    },
    filteredResolvedTotal() {
      return this.filteredQueueItems.filter((item) => item && item.status === 'resolved').length
    },
    filteredRemainingActionableTotal() {
      return this.filteredQueueItems.filter((item) => item && ['pending', 'failed'].includes(item.status)).length
    },
    currentQueueFocusHint() {
      const focusCandidates = [
        { key: 'sync_failed', label: '同步失败', count: this.filteredFailedSyncTotal },
        { key: 'reconcile_failed', label: '校准失败', count: this.filteredFailedReconcileTotal },
        { key: 'pending_queue', label: '待处理队列', count: this.filteredPendingTotal }
      ].sort((left, right) => right.count - left.count)

      const top = focusCandidates[0]
      if (!top || top.count <= 0) {
        if (this.filteredResolvedTotal > 0) {
          return '复核已解决项目'
        }
        return '当前筛选下没有可处理异常'
      }
      return `${top.label} (${top.count})`
    },
    nextFailedQueueItem() {
      return this.filteredQueueItems.find((item) => item && ['pending', 'failed'].includes(item.status)) || null
    },
    failedSyncItems() {
      return this.filteredQueueItems
        .filter((item) => item && item.type === 'sync' && item.status === 'failed')
        .slice(0, 5)
    },
    failedReconcileItems() {
      return this.filteredQueueItems
        .filter((item) => item && item.type === 'reconcile' && item.status === 'failed')
        .slice(0, 5)
    },
    pendingQueueItems() {
      return this.filteredQueueItems
        .filter((item) => item && item.status === 'pending')
        .slice(0, 5)
    },
    retryableFailedSyncItems() {
      return this.filteredQueueItems.filter((item) => item && item.type === 'sync' && ['pending', 'failed'].includes(item.status))
    },
    retryableFailedReconcileItems() {
      return this.filteredQueueItems.filter((item) => item && item.type === 'reconcile' && ['pending', 'failed'].includes(item.status))
    },
    retryablePendingQueueItems() {
      return this.filteredQueueItems.filter((item) => item && item.status === 'pending' && ['pending', 'failed'].includes(item.status))
    },
    topFailedSyncItem() {
      return this.failedSyncItems.length ? this.failedSyncItems[0] : null
    },
    topFailedReconcileItem() {
      return this.failedReconcileItems.length ? this.failedReconcileItems[0] : null
    },
    topPendingQueueItem() {
      return this.pendingQueueItems.length ? this.pendingQueueItems[0] : null
    }
  },
  methods: {
    applyInitialFilters(query = {}) {
      const type = query && query.type ? decodeURIComponent(query.type) : ''
      const status = query && query.status ? decodeURIComponent(query.status) : ''
      const batchId = query && query.batchId ? decodeURIComponent(query.batchId) : ''
      const projectId = query && query.projectId ? decodeURIComponent(query.projectId) : ''
      const allowedTypes = ['all', 'sync', 'reconcile']
      const allowedStatuses = ['all', 'pending', 'failed', 'resolved']

      if (allowedTypes.includes(type)) {
        this.typeFilter = type
      }
      if (allowedStatuses.includes(status)) {
        this.statusFilter = status
      }
      if (batchId) {
        this.batchIdFilter = batchId
      }
      if (projectId) {
        this.projectIdFilter = projectId
      }
    },
    refreshState() {
      this.chainState = getMainChainState()
    },
    getGroupEmptyText(groupName = 'queue') {
      if (!this.queueItems.length) {
        return '暂无队列项。'
      }
      const labels = {
        'failed sync': '同步失败',
        'failed reconcile': '校准失败',
        'pending queue': '待处理队列'
      }
      return `当前筛选下没有${labels[groupName] || '队列'}项。`
    },
    getTaskEntity(taskId) {
      if (!taskId) {
        return null
      }
      const tasks = this.chainState.tasks || {}
      const byId = tasks.byId || {}
      return byId[taskId] || null
    },
    getTaskBatchId(taskId) {
      const task = this.getTaskEntity(taskId)
      return (task && task.batchId) || ''
    },
    getTaskProjectId(taskId) {
      const task = this.getTaskEntity(taskId)
      return (task && task.projectId) || ''
    },
    goToTaskDetail(taskId) {
      if (!taskId) {
        return
      }
      patchMainChainState({
        currentTaskId: taskId
      })
      uni.navigateTo({
        url: `/package-ai/result/result?taskId=${encodeURIComponent(taskId)}`
      })
    },
    goToBatchDetail(taskId) {
      const batchId = this.getTaskBatchId(taskId)
      if (!batchId) {
        return
      }
      uni.navigateTo({
        url: `/package-mobile-enterprise/batch-detail/batch-detail?batchId=${encodeURIComponent(batchId)}&mode=delivery-review&reviewContext=needs_revision`
      })
    },
    goToProjectDetail(taskId) {
      const projectId = this.getTaskProjectId(taskId)
      if (!projectId) {
        return
      }
      uni.navigateTo({
        url: `/package-mobile-enterprise/project-detail/project-detail?projectId=${encodeURIComponent(projectId)}&mode=delivery-review&reviewContext=needs_revision`
      })
    },
    goToNextFailedQueueItem() {
      const next = this.nextFailedQueueItem
      if (!next || !next.taskId) {
        return
      }
      this.goToTaskDetail(next.taskId)
    },
    openTopFailedSyncBatch() {
      const item = this.topFailedSyncItem
      if (!item) {
        return
      }
      const batchId = this.getTaskBatchId(item.taskId)
      if (batchId) {
        this.goToBatchDetail(item.taskId)
        return
      }
      const projectId = this.getTaskProjectId(item.taskId)
      if (projectId) {
        this.goToProjectDetail(item.taskId)
        return
      }
      if (item.taskId) {
        this.goToTaskDetail(item.taskId)
      }
    },
    openTopFailedReconcileBatch() {
      const item = this.topFailedReconcileItem
      if (!item) {
        return
      }
      const batchId = this.getTaskBatchId(item.taskId)
      if (batchId) {
        this.goToBatchDetail(item.taskId)
        return
      }
      const projectId = this.getTaskProjectId(item.taskId)
      if (projectId) {
        this.goToProjectDetail(item.taskId)
        return
      }
      if (item.taskId) {
        this.goToTaskDetail(item.taskId)
      }
    },
    openTopPendingQueueResult() {
      const item = this.topPendingQueueItem
      if (!item) {
        return
      }
      if (item.taskId) {
        this.goToTaskDetail(item.taskId)
        return
      }
      const projectId = this.getTaskProjectId(item.taskId)
      if (projectId) {
        this.goToProjectDetail(item.taskId)
        return
      }
      const batchId = this.getTaskBatchId(item.taskId)
      if (batchId) {
        this.goToBatchDetail(item.taskId)
      }
    },
    goToDeliveryDashboard() {
      uni.navigateTo({
        url: '/package-mobile-enterprise/delivery-dashboard/delivery-dashboard'
      })
    },
    getQueueStatusRank(status = '') {
      if (status === 'failed') {
        return 0
      }
      if (status === 'pending') {
        return 1
      }
      if (status === 'retrying') {
        return 2
      }
      if (status === 'resolved') {
        return 3
      }
      return 4
    },
    getQueueItemContextLoad(item, batchLoadMap = {}, projectLoadMap = {}) {
      if (!item) {
        return 0
      }
      const batchId = this.getTaskBatchId(item.taskId)
      const projectId = this.getTaskProjectId(item.taskId)
      const batchLoad = batchId ? (batchLoadMap[batchId] || 0) : 0
      const projectLoad = projectId ? (projectLoadMap[projectId] || 0) : 0
      return Math.max(batchLoad, projectLoad)
    },
    getQueueItemSortTime(item) {
      if (!item) {
        return 0
      }
      return new Date(item.updatedAt || item.createdAt || '').getTime() || 0
    },
    compareQueueItemPriority(left, right, batchLoadMap = {}, projectLoadMap = {}) {
      const rankDiff = this.getQueueStatusRank(left && left.status) - this.getQueueStatusRank(right && right.status)
      if (rankDiff !== 0) {
        return rankDiff
      }

      const contextDiff =
        this.getQueueItemContextLoad(right, batchLoadMap, projectLoadMap) -
        this.getQueueItemContextLoad(left, batchLoadMap, projectLoadMap)
      if (contextDiff !== 0) {
        return contextDiff
      }

      return this.getQueueItemSortTime(right) - this.getQueueItemSortTime(left)
    },
    patchTaskDeliveryVisibility(taskId, visibilityPatch = {}) {
      if (!taskId) {
        return
      }
      const state = getMainChainState()
      const tasks = state.tasks || {}
      const byId = tasks.byId || {}
      const currentTask = byId[taskId]
      if (!currentTask) {
        return
      }
      const nextTask = {
        ...currentTask,
        ...visibilityPatch
      }
      patchMainChainState({
        tasks: {
          ...tasks,
          byId: {
            ...byId,
            [taskId]: nextTask
          }
        }
      })
    },
    async retryFailedQueueItems() {
      if (this.retrying || this.retryableCount === 0) {
        return
      }
      await this.retryQueueItems(this.retryableItems, '已解决')
    },
    async retryFailedSyncGroup() {
      if (this.retrying || this.retryableFailedSyncItems.length === 0) {
        return
      }
      await this.retryQueueItems(this.retryableFailedSyncItems, '同步分组已解决')
    },
    async retryFailedReconcileGroup() {
      if (this.retrying || this.retryableFailedReconcileItems.length === 0) {
        return
      }
      await this.retryQueueItems(this.retryableFailedReconcileItems, '校准分组已解决')
    },
    async retryPendingQueueGroup() {
      if (this.retrying || this.retryablePendingQueueItems.length === 0) {
        return
      }
      await this.retryQueueItems(this.retryablePendingQueueItems, '待处理分组已解决')
    },
    async retryQueueItems(items = [], toastPrefix = '已解决') {
      const targetItems = Array.isArray(items)
        ? items.filter((item) => item && ['pending', 'failed'].includes(item.status))
        : []
      if (!targetItems.length) {
        uni.showToast({
          title: '暂无可重试队列项',
          icon: 'none'
        })
        return
      }
      this.retrying = true

      let resolvedCount = 0
      let failedRetryCount = 0

      for (const item of targetItems) {
        const currentItem = updateDeliveryQueueItem(item.queueId, {
          status: 'retrying'
        }) || item

        try {
          if (currentItem.type === 'sync') {
            const payload = currentItem.payload || {}
            await syncTaskDeliveryStatus({
              taskId: payload.taskId || currentItem.taskId,
              deliveryStatus: payload.deliveryStatus || 'pending_review',
              deliveryConfirmedAt: payload.deliveryConfirmedAt || '',
              deliveryNote: payload.deliveryNote || ''
            })
            this.patchTaskDeliveryVisibility(currentItem.taskId, {
              lastDeliverySyncAt: new Date().toISOString(),
              lastDeliverySyncStatus: 'success'
            })
          } else {
            const remote = await fetchTaskDeliveryStatus(currentItem.taskId)
            const state = getMainChainState()
            const task = state.tasks && state.tasks.byId && state.tasks.byId[currentItem.taskId]
            const serverStatus = remote.deliveryStatus || ''
            const serverConfirmedAt = remote.deliveryConfirmedAt || ''
            const serverNote = remote.deliveryNote || ''
            const hasServerValue = !!(serverStatus || serverConfirmedAt || serverNote)

            if (task) {
              const nextPatch = {
                lastDeliveryReconcileAt: new Date().toISOString(),
                lastDeliveryReconcileStatus: hasServerValue ? 'success' : 'skipped'
              }
              if (hasServerValue) {
                nextPatch.deliveryStatus = serverStatus || task.deliveryStatus || 'pending_review'
                nextPatch.deliveryConfirmedAt = serverConfirmedAt || task.deliveryConfirmedAt || ''
                nextPatch.deliveryNote = serverNote || task.deliveryNote || ''
              }
              this.patchTaskDeliveryVisibility(currentItem.taskId, nextPatch)
            }
          }

          updateDeliveryQueueItem(currentItem.queueId, {
            status: 'resolved'
          })
          resolvedCount += 1
        } catch (error) {
          if (currentItem.type === 'sync') {
            this.patchTaskDeliveryVisibility(currentItem.taskId, {
              lastDeliverySyncAt: new Date().toISOString(),
              lastDeliverySyncStatus: 'failed'
            })
          } else {
            this.patchTaskDeliveryVisibility(currentItem.taskId, {
              lastDeliveryReconcileAt: new Date().toISOString(),
              lastDeliveryReconcileStatus: 'failed'
            })
          }

          updateDeliveryQueueItem(currentItem.queueId, {
            status: 'failed',
            payload: {
              ...(currentItem.payload || {}),
              lastError: (error && error.message) || 'retry failed'
            }
          })
          failedRetryCount += 1
        }
      }

      this.refreshState()
      this.retrying = false

      uni.showToast({
        title: `${toastPrefix} ${resolvedCount} 项，失败 ${failedRetryCount} 项`,
        icon: 'none'
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

.header-card,
.summary-card,
.filter-card,
.list-card,
.empty-card {
  background: #fff;
  border-radius: 24rpx;
  padding: 24rpx;
  margin-bottom: 20rpx;
}

.title {
  display: block;
  font-size: 38rpx;
  font-weight: 700;
  color: #222;
}

.subtitle {
  display: block;
  margin-top: 8rpx;
  font-size: 24rpx;
  color: #666;
}

.summary-line {
  display: block;
  margin-top: 10rpx;
  font-size: 24rpx;
  color: #333;
}

.focus-hint {
  display: block;
  margin-top: 10rpx;
  font-size: 22rpx;
  color: #1677ff;
}

.section-title {
  display: block;
  font-size: 28rpx;
  font-weight: 700;
  color: #222;
  margin-bottom: 8rpx;
}

.group-block {
  margin-top: 14rpx;
}

.group-head {
  display: flex;
  gap: 10rpx;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
}

.group-action-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8rpx;
}

.group-title {
  display: block;
  font-size: 24rpx;
  color: #4b5563;
  margin-bottom: 8rpx;
}

.group-action-btn {
  background: #eef5ff;
  color: #1677ff;
  border-radius: 999rpx;
  font-size: 20rpx;
  padding: 8rpx 14rpx;
}

.group-action-btn.group-retry-btn {
  background: #fff7e6;
  color: #d46b08;
}

.group-list {
  display: flex;
  flex-direction: column;
  gap: 10rpx;
}

.grouped-item {
  margin-bottom: 0;
}

.group-empty {
  display: block;
  margin-top: 8rpx;
  font-size: 22rpx;
  color: #9ca3af;
}

.header-actions {
  margin-top: 12rpx;
}

.header-btn {
  background: #1677ff;
  color: #fff;
  border-radius: 999rpx;
  font-size: 22rpx;
  padding: 10rpx 18rpx;
}

.filter-row {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
  margin-top: 12rpx;
}

.filter-input {
  flex: 1;
  min-width: 280rpx;
  background: #f5f7fa;
  border-radius: 14rpx;
  padding: 14rpx 16rpx;
  box-sizing: border-box;
  font-size: 22rpx;
}

.filter-btn,
.retry-btn {
  background: #e6f4ff;
  color: #1677ff;
  border-radius: 999rpx;
  font-size: 22rpx;
  padding: 10rpx 18rpx;
}

.filter-btn.active {
  background: #13c2c2;
  color: #fff;
}

.retry-btn {
  background: #1677ff;
  color: #fff;
}

.retry-btn.next-btn {
  background: #13c2c2;
}

.queue-item {
  background: #f8fafc;
  border-radius: 18rpx;
  padding: 18rpx;
  margin-bottom: 12rpx;
}

.queue-main {
  display: block;
  font-size: 24rpx;
  font-weight: 600;
  color: #222;
}

.queue-meta {
  display: block;
  margin-top: 6rpx;
  font-size: 22rpx;
  color: #555;
  word-break: break-all;
}

.item-action-row {
  margin-top: 10rpx;
  display: flex;
  flex-wrap: wrap;
  gap: 10rpx;
}

.mini-btn {
  background: #f0f5ff;
  color: #1677ff;
  border-radius: 999rpx;
  font-size: 22rpx;
  padding: 8rpx 16rpx;
}

.retry-btn[disabled],
.group-action-btn[disabled],
.mini-btn[disabled],
.filter-btn[disabled] {
  opacity: 0.55;
}

.empty-title {
  display: block;
  font-size: 30rpx;
  font-weight: 600;
  color: #222;
}

.empty-desc {
  display: block;
  margin-top: 8rpx;
  font-size: 24rpx;
  color: #666;
}
</style>
