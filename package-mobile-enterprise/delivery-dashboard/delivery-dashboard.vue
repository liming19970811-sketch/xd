<template>
  <view class="container">
    <view class="header-card">
      <text class="title">交付状态看板</text>
      <text class="subtitle">查看交付、审核和补偿队列的整体状态</text>
    </view>

    <view class="health-card">
      <text class="health-label">整体状态</text>
      <text class="health-value" :class="`health-${globalHealthStatus}`">{{ globalHealthStatusLabel }}</text>
      <text class="health-desc">{{ globalHealthDesc }}</text>
    </view>

    <view class="priority-card">
      <text class="section-title">优先处理建议</text>
      <text class="summary-line">优先操作：{{ priorityActionLabel }}</text>
      <text class="summary-line">优先原因：{{ priorityReason }}</text>
      <view class="action-row">
        <button class="action-btn primary" @click="handlePriorityAction">{{ priorityActionLabel }}</button>
      </view>
    </view>

    <view class="summary-card">
      <text class="section-title">优先处理对象</text>

      <view class="target-group">
        <text class="group-title">优先待审核批次</text>
        <view
          v-for="batch in topPendingReviewBatches"
          :key="`pending_${batch.batchId}`"
          class="target-item"
          @click="goToBatchDetailWithContext(batch.batchId, 'delivery-review', 'pending_review')"
        >
          <text class="target-main">{{ batch.batchId }}</text>
          <text class="target-sub">状态：{{ batch.status || '未知' }} | 审核：待审核 | 待处理任务：{{ batch.pendingCount }}</text>
          <text class="target-sub">时间：{{ formatTime(batch.updatedAt || batch.createdAt) }}</text>
        </view>
        <text v-if="!topPendingReviewBatches.length" class="target-empty">{{ getTargetEmptyText('pending review batches') }}</text>
      </view>

      <view class="target-group">
        <text class="group-title">优先待修改批次</text>
        <view
          v-for="batch in topNeedsRevisionBatches"
          :key="`revision_${batch.batchId}`"
          class="target-item"
          @click="goToBatchDetailWithContext(batch.batchId, 'delivery-review', 'needs_revision')"
        >
          <text class="target-main">{{ batch.batchId }}</text>
          <text class="target-sub">状态：{{ batch.status || '未知' }} | 审核：待修改 | 修改任务：{{ batch.revisionCount }}</text>
          <text class="target-sub">时间：{{ formatTime(batch.updatedAt || batch.createdAt) }}</text>
        </view>
        <text v-if="!topNeedsRevisionBatches.length" class="target-empty">{{ getTargetEmptyText('needs-revision batches') }}</text>
      </view>

      <view class="target-group">
        <text class="group-title">优先待审核项目</text>
        <view
          v-for="project in topPendingReviewProjects"
          :key="`project_pending_${project.projectId}`"
          class="target-item"
          @click="goToProjectDetailWithContext(project.projectId, 'delivery-review', 'pending_review')"
        >
          <text class="target-main">{{ project.projectId }}</text>
          <text class="target-sub">状态：{{ project.status || '未知' }} | 待审核批次：{{ project.pendingCount }}</text>
          <text class="target-sub">时间：{{ formatTime(project.latestTime) }}</text>
        </view>
        <text v-if="!topPendingReviewProjects.length" class="target-empty">{{ getTargetEmptyText('pending review projects') }}</text>
      </view>

      <view class="target-group">
        <text class="group-title">优先待修改项目</text>
        <view
          v-for="project in topNeedsRevisionProjects"
          :key="`project_revision_${project.projectId}`"
          class="target-item"
          @click="goToProjectDetailWithContext(project.projectId, 'delivery-review', 'needs_revision')"
        >
          <text class="target-main">{{ project.projectId }}</text>
          <text class="target-sub">状态：{{ project.status || '未知' }} | 待修改批次：{{ project.revisionCount }}</text>
          <text class="target-sub">时间：{{ formatTime(project.latestTime) }}</text>
        </view>
        <text v-if="!topNeedsRevisionProjects.length" class="target-empty">{{ getTargetEmptyText('needs-revision projects') }}</text>
      </view>
    </view>

    <view class="summary-card">
      <text class="section-title">交付与审核</text>
      <text class="summary-line">可交付数量：{{ deliverableCount }}</text>
      <text class="summary-line clickable" @click="goToBatchReview('pending_review')">待审核数量：{{ pendingReviewCount }}</text>
      <text class="summary-line clickable" @click="goToBatchReview('needs_revision')">待修改数量：{{ needsRevisionCount }}</text>
      <text class="summary-line">已通过数量：{{ approvedCount }}</text>
    </view>

    <view class="summary-card">
      <text class="section-title">项目交付明细</text>
      <text class="summary-line clickable" @click="goToProjectListWithContext('delivery-review', 'pending_review')">
        含待审核批次的项目：{{ projectsWithPendingReviewCount }}
      </text>
      <text class="summary-line clickable" @click="goToProjectListWithContext('delivery-review', 'needs_revision')">
        含待修改批次的项目：{{ projectsWithNeedsRevisionCount }}
      </text>
      <text class="summary-line clickable" @click="goToProjectListWithContext('delivery-view', '')">
        可交付项目：{{ projectsReadyToDeliverCount }}
      </text>
    </view>

    <view class="summary-card">
      <text class="section-title">同步与校准</text>
      <text class="summary-line clickable" @click="goToQueueWithFilter('sync', 'failed')">同步失败：{{ syncFailedCount }}</text>
      <text class="summary-line clickable" @click="goToQueueWithFilter('reconcile', 'failed')">校准失败：{{ reconcileFailedCount }}</text>
      <text class="summary-line clickable" @click="goToQueueWithFilter('all', 'pending')">补偿队列待处理：{{ queuePendingCount }}</text>
      <text class="summary-line clickable" @click="goToQueueWithFilter('all', 'failed')">补偿队列失败：{{ queueFailedCount }}</text>
    </view>

    <view class="summary-card">
      <text class="section-title">异常对象</text>

      <view class="target-group">
        <text class="group-title">优先同步失败批次</text>
        <view
          v-for="item in topSyncFailedBatches"
          :key="`sync_failed_${item.batchId}`"
          class="target-item"
          @click="goToBatchDetailWithContext(item.batchId, 'delivery-review', 'needs_revision')"
        >
          <text class="target-main">{{ item.batchId }}</text>
          <text class="target-sub">同步失败：{{ item.syncFailedCount }}</text>
          <text class="target-sub">时间：{{ formatTime(item.latestTime) }}</text>
        </view>
        <text v-if="!topSyncFailedBatches.length" class="target-empty">{{ getTargetEmptyText('sync-failed batches') }}</text>
      </view>

      <view class="target-group">
        <text class="group-title">优先校准失败批次</text>
        <view
          v-for="item in topReconcileFailedBatches"
          :key="`reconcile_failed_${item.batchId}`"
          class="target-item"
          @click="goToBatchDetailWithContext(item.batchId, 'delivery-review', 'needs_revision')"
        >
          <text class="target-main">{{ item.batchId }}</text>
          <text class="target-sub">校准失败：{{ item.reconcileFailedCount }}</text>
          <text class="target-sub">时间：{{ formatTime(item.latestTime) }}</text>
        </view>
        <text v-if="!topReconcileFailedBatches.length" class="target-empty">{{ getTargetEmptyText('reconcile-failed batches') }}</text>
      </view>

      <view class="target-group">
        <text class="group-title">补偿压力较高批次</text>
        <view
          v-for="item in topCompensationHeavyBatches"
          :key="`queue_batch_${item.batchId}`"
          class="target-item"
          @click="goToQueueWithTarget('all', 'failed', item.batchId, '')"
        >
          <text class="target-main">{{ item.batchId }}</text>
          <text class="target-sub">队列待处理和失败：{{ item.queueLoad }}（待处理：{{ item.pendingCount }} / 失败：{{ item.failedCount }}）</text>
          <text class="target-sub">时间：{{ formatTime(item.latestTime) }}</text>
        </view>
        <text v-if="!topCompensationHeavyBatches.length" class="target-empty">{{ getTargetEmptyText('compensation-heavy batches') }}</text>
      </view>

      <view class="target-group">
        <text class="group-title">补偿压力较高项目</text>
        <view
          v-for="item in topCompensationHeavyProjects"
          :key="`queue_project_${item.projectId}`"
          class="target-item"
          @click="goToQueueWithTarget('all', 'failed', '', item.projectId)"
        >
          <text class="target-main">{{ item.projectId }}</text>
          <text class="target-sub">队列待处理和失败：{{ item.queueLoad }}（待处理：{{ item.pendingCount }} / 失败：{{ item.failedCount }}）</text>
          <text class="target-sub">时间：{{ formatTime(item.latestTime) }}</text>
        </view>
        <text v-if="!topCompensationHeavyProjects.length" class="target-empty">{{ getTargetEmptyText('compensation-heavy projects') }}</text>
      </view>
    </view>

    <view class="priority-card">
      <text class="section-title">异常优先处理建议</text>
      <text class="summary-line">优先操作：{{ exceptionPriorityActionLabel }}</text>
      <text class="summary-line">优先原因：{{ exceptionPriorityReason }}</text>
      <view class="action-row">
        <button class="action-btn warning" @click="handleExceptionPriorityAction">{{ exceptionPriorityActionLabel }}</button>
      </view>
    </view>

    <view class="action-card">
      <text class="section-title">快捷入口</text>
      <view class="action-row">
        <button class="action-btn primary" @click="goToDeliveryQueue">查看交付队列</button>
        <button class="action-btn secondary" @click="goToBatchList">查看生产批次</button>
        <button class="action-btn secondary" @click="goToDeliveryActionHistory">查看交付记录</button>
      </view>

      <view class="action-group">
        <text class="group-title">项目操作</text>
        <view class="action-row">
          <button class="action-btn primary" @click="goToProjectListWithContext('delivery-review', 'pending_review')">
            处理待审核项目
          </button>
          <button class="action-btn warning" @click="goToProjectListWithContext('delivery-review', 'needs_revision')">
            处理待修改项目
          </button>
          <button class="action-btn success" @click="goToProjectListWithContext('delivery-view', '')">
            查看可交付项目
          </button>
        </view>
      </view>

      <view class="action-group">
        <text class="group-title">批次操作</text>
        <view class="action-row">
          <button class="action-btn primary" @click="goToBatchListWithContext('delivery-review', 'pending_review')">
            处理待审核批次
          </button>
          <button class="action-btn warning" @click="goToBatchListWithContext('delivery-review', 'needs_revision')">
            处理待修改批次
          </button>
          <button class="action-btn success" @click="goToBatchListWithContext('delivery-view', '')">
            查看可交付批次
          </button>
        </view>
      </view>
    </view>
  </view>
</template>

<script>
import { getMainChainState } from '../../utils/mainChainState'
import { getBatchesByProjectId, getBatchList } from '../../utils/service/batchStore'
import { getProjectList } from '../../utils/service/projectStore'

export default {
  data() {
    return {
      chainState: getMainChainState()
    }
  },
  onShow() {
    this.refreshState()
  },
  computed: {
    tasksById() {
      return (this.chainState.tasks && this.chainState.tasks.byId) || {}
    },
    allTasks() {
      return Object.values(this.tasksById).filter(Boolean)
    },
    queueItems() {
      return Array.isArray(this.chainState.deliveryCompensationQueue)
        ? this.chainState.deliveryCompensationQueue
        : []
    },
    projects() {
      return getProjectList()
    },
    batches() {
      return getBatchList()
    },
    deliverableTasks() {
      return this.allTasks.filter((task) => this.hasTaskResult(task))
    },
    deliverableCount() {
      return this.deliverableTasks.length
    },
    approvedCount() {
      return this.deliverableTasks.filter((task) => (task.deliveryStatus || 'pending_review') === 'approved').length
    },
    needsRevisionCount() {
      return this.deliverableTasks.filter((task) => (task.deliveryStatus || 'pending_review') === 'needs_revision').length
    },
    pendingReviewCount() {
      return this.deliverableTasks.filter((task) => {
        const status = task.deliveryStatus || 'pending_review'
        return status !== 'approved' && status !== 'needs_revision'
      }).length
    },
    syncFailedCount() {
      return this.allTasks.filter((task) => (task.lastDeliverySyncStatus || 'unknown') === 'failed').length
    },
    reconcileFailedCount() {
      return this.allTasks.filter((task) => (task.lastDeliveryReconcileStatus || 'unknown') === 'failed').length
    },
    queuePendingCount() {
      return this.queueItems.filter((item) => item && item.status === 'pending').length
    },
    queueFailedCount() {
      return this.queueItems.filter((item) => item && item.status === 'failed').length
    },
    projectsWithPendingReviewCount() {
      return this.projects.filter((project) => this.hasPendingReviewBatches(project)).length
    },
    projectsWithNeedsRevisionCount() {
      return this.projects.filter((project) => this.hasNeedsRevisionBatches(project)).length
    },
    projectsReadyToDeliverCount() {
      return this.projects.filter((project) => this.getProjectDeliveryReviewLabel(project) === 'ready_to_deliver').length
    },
    topPendingReviewBatches() {
      return this.batches
        .map((batch) => {
          const counts = this.getBatchDeliveryCounts(batch)
          return {
            ...batch,
            pendingCount: counts.pendingReviewCount
          }
        })
        .filter((batch) => batch.pendingCount > 0)
        .sort((left, right) => {
          if (right.pendingCount !== left.pendingCount) {
            return right.pendingCount - left.pendingCount
          }
          return String(right.updatedAt || right.createdAt || '').localeCompare(String(left.updatedAt || left.createdAt || ''))
        })
        .slice(0, 3)
    },
    topNeedsRevisionBatches() {
      return this.batches
        .map((batch) => {
          const counts = this.getBatchDeliveryCounts(batch)
          return {
            ...batch,
            revisionCount: counts.needsRevisionCount
          }
        })
        .filter((batch) => batch.revisionCount > 0)
        .sort((left, right) => {
          if (right.revisionCount !== left.revisionCount) {
            return right.revisionCount - left.revisionCount
          }
          return String(right.updatedAt || right.createdAt || '').localeCompare(String(left.updatedAt || left.createdAt || ''))
        })
        .slice(0, 3)
    },
    topPendingReviewProjects() {
      return this.projects
        .map((project) => {
          const batches = this.getProjectBatches(project)
          const pendingCount = batches.filter((batch) => {
            const label = this.getBatchDeliveryReviewLabel(batch)
            return label === 'pending_review' || label === 'partially_reviewed'
          }).length
          const latestTime = this.getProjectLatestTime(project)
          return {
            ...project,
            pendingCount,
            latestTime
          }
        })
        .filter((project) => project.pendingCount > 0)
        .sort((left, right) => {
          if (right.pendingCount !== left.pendingCount) {
            return right.pendingCount - left.pendingCount
          }
          return String(right.latestTime || '').localeCompare(String(left.latestTime || ''))
        })
        .slice(0, 3)
    },
    topNeedsRevisionProjects() {
      return this.projects
        .map((project) => {
          const batches = this.getProjectBatches(project)
          const revisionCount = batches.filter((batch) => this.getBatchDeliveryReviewLabel(batch) === 'revision_required').length
          const latestTime = this.getProjectLatestTime(project)
          return {
            ...project,
            revisionCount,
            latestTime
          }
        })
        .filter((project) => project.revisionCount > 0)
        .sort((left, right) => {
          if (right.revisionCount !== left.revisionCount) {
            return right.revisionCount - left.revisionCount
          }
          return String(right.latestTime || '').localeCompare(String(left.latestTime || ''))
        })
        .slice(0, 3)
    },
    topSyncFailedBatches() {
      const map = new Map()
      this.allTasks.forEach((task) => {
        if ((task && task.lastDeliverySyncStatus) !== 'failed') {
          return
        }
        const batchId = task.batchId || ''
        if (!batchId) {
          return
        }
        const time = task.updatedAt || task.completedAt || task.submittedAt || task.createdAt || ''
        const current = map.get(batchId) || { batchId, syncFailedCount: 0, latestTime: '' }
        current.syncFailedCount += 1
        if (time && String(time).localeCompare(String(current.latestTime || '')) > 0) {
          current.latestTime = time
        }
        map.set(batchId, current)
      })
      return Array.from(map.values())
        .sort((left, right) => {
          if (right.syncFailedCount !== left.syncFailedCount) {
            return right.syncFailedCount - left.syncFailedCount
          }
          return String(right.latestTime || '').localeCompare(String(left.latestTime || ''))
        })
        .slice(0, 3)
    },
    topReconcileFailedBatches() {
      const map = new Map()
      this.allTasks.forEach((task) => {
        if ((task && task.lastDeliveryReconcileStatus) !== 'failed') {
          return
        }
        const batchId = task.batchId || ''
        if (!batchId) {
          return
        }
        const time = task.updatedAt || task.completedAt || task.submittedAt || task.createdAt || ''
        const current = map.get(batchId) || { batchId, reconcileFailedCount: 0, latestTime: '' }
        current.reconcileFailedCount += 1
        if (time && String(time).localeCompare(String(current.latestTime || '')) > 0) {
          current.latestTime = time
        }
        map.set(batchId, current)
      })
      return Array.from(map.values())
        .sort((left, right) => {
          if (right.reconcileFailedCount !== left.reconcileFailedCount) {
            return right.reconcileFailedCount - left.reconcileFailedCount
          }
          return String(right.latestTime || '').localeCompare(String(left.latestTime || ''))
        })
        .slice(0, 3)
    },
    topCompensationHeavyBatches() {
      return this.getCompensationTargets('batch').slice(0, 3)
    },
    topCompensationHeavyProjects() {
      return this.getCompensationTargets('project').slice(0, 3)
    },
    globalHealthStatus() {
      const failedSignal = this.syncFailedCount + this.reconcileFailedCount + this.queueFailedCount
      if (failedSignal >= 5) {
        return 'blocked'
      }
      if (failedSignal > 0 || this.queuePendingCount > 0 || this.needsRevisionCount > 0 || this.pendingReviewCount > 0) {
        return 'attention_needed'
      }
      return 'healthy'
    },
    globalHealthStatusLabel() {
      return {
        blocked: '存在阻塞',
        attention_needed: '需要关注',
        healthy: '运行正常'
      }[this.globalHealthStatus] || '未知'
    },
    globalHealthDesc() {
      if (this.globalHealthStatus === 'blocked') {
        return '检测到多项交付失败，请优先处理队列重试和校准检查。'
      }
      if (this.globalHealthStatus === 'attention_needed') {
        return '交付流程正在运行，但仍有待审核或待重试项目。'
      }
      return '交付流程运行稳定，可继续正常处理。'
    },
    priorityActionKey() {
      const syncOrQueueRiskScore =
        this.syncFailedCount * 2 +
        this.reconcileFailedCount * 2 +
        this.queueFailedCount * 2 +
        this.queuePendingCount
      if (syncOrQueueRiskScore >= 3) {
        return 'delivery_queue'
      }
      if (this.needsRevisionCount > 0) {
        return 'needs_revision_batches'
      }
      if (this.pendingReviewCount > 0) {
        return 'pending_review_batches'
      }
      if (this.deliverableCount > 0) {
        return 'ready_to_deliver_batches'
      }
      return 'observe'
    },
    priorityActionLabel() {
      if (this.priorityActionKey === 'delivery_queue') {
        return '查看交付队列'
      }
      if (this.priorityActionKey === 'needs_revision_batches') {
        return '处理待修改批次'
      }
      if (this.priorityActionKey === 'pending_review_batches') {
        return '处理待审核批次'
      }
      if (this.priorityActionKey === 'ready_to_deliver_batches') {
        return '查看可交付批次'
      }
      return '查看生产批次'
    },
    priorityReason() {
      if (this.priorityActionKey === 'delivery_queue') {
        return '同步、校准或补偿队列风险较高，请先恢复交付数据一致性。'
      }
      if (this.priorityActionKey === 'needs_revision_batches') {
        return '存在待修改结果，请优先处理以解除交付阻塞。'
      }
      if (this.priorityActionKey === 'pending_review_batches') {
        return '存在可交付结果等待审核确认。'
      }
      if (this.priorityActionKey === 'ready_to_deliver_batches') {
        return '结果已准备完成，请优先推进交付。'
      }
      return '暂无紧急交付阻塞，请继续关注执行状态。'
    },
    topPendingQueueTask() {
      const pendingQueue = this.queueItems
        .filter((item) => item && item.status === 'pending' && item.taskId)
        .sort((left, right) => String(right.updatedAt || right.createdAt || '').localeCompare(String(left.updatedAt || left.createdAt || '')))
      return pendingQueue.length ? pendingQueue[0] : null
    },
    exceptionPriorityKey() {
      const syncScore = this.syncFailedCount
      const reconcileScore = this.reconcileFailedCount
      const queueScore = this.queuePendingCount + this.queueFailedCount
      const maxScore = Math.max(syncScore, reconcileScore, queueScore)

      if (maxScore <= 1) {
        return 'stable'
      }
      if (syncScore >= reconcileScore && syncScore >= queueScore) {
        return 'sync_failed'
      }
      if (reconcileScore >= syncScore && reconcileScore >= queueScore) {
        return 'reconcile_failed'
      }
      return 'queue_backlog'
    },
    exceptionPriorityActionLabel() {
      if (this.exceptionPriorityKey === 'sync_failed') {
        return '打开优先同步失败批次'
      }
      if (this.exceptionPriorityKey === 'reconcile_failed') {
        return '打开优先校准失败批次'
      }
      if (this.exceptionPriorityKey === 'queue_backlog') {
        return '打开优先待处理结果'
      }
      return '查看生产批次'
    },
    exceptionPriorityReason() {
      if (this.exceptionPriorityKey === 'sync_failed') {
        return `同步失败压力最高（${this.syncFailedCount} 项），请优先处理同步失败。`
      }
      if (this.exceptionPriorityKey === 'reconcile_failed') {
        return `校准失败压力最高（${this.reconcileFailedCount} 项），请优先处理校准失败。`
      }
      if (this.exceptionPriorityKey === 'queue_backlog') {
        return `补偿队列压力最高（待处理和失败共 ${this.queuePendingCount + this.queueFailedCount} 项），请优先清理积压。`
      }
      return '异常压力可控，可按正常优先级处理交付。'
    },
    hasAnyDeliveryData() {
      return !!(
        (this.projects && this.projects.length) ||
        (this.batches && this.batches.length) ||
        (this.allTasks && this.allTasks.length) ||
        (this.queueItems && this.queueItems.length)
      )
    }
  },
  methods: {
    refreshState() {
      this.chainState = getMainChainState()
    },
    hasTaskResult(task) {
      if (!task) return false
      const result = task.result || {}
      const items = Array.isArray(result.items) ? result.items : (result.items ? [result.items] : [])
      return Boolean(
        task.resultImageUrl || task.result_image_url ||
        result.coverUrl || result.image || result.imageUrl || result.image_url ||
        items.some((item) => typeof item === 'string' ? Boolean(item.trim()) : Boolean(item && (item.imageUrl || item.fileUrl || item.url)))
      )
    },
    getProjectBatches(project) {
      if (!project || !project.projectId) {
        return []
      }
      const allBatches = getBatchesByProjectId(project.projectId)
      const batchIds = Array.isArray(project.batchIds) ? project.batchIds : []
      if (!batchIds.length) {
        return allBatches
      }
      const idSet = new Set(batchIds)
      const matched = allBatches.filter((batch) => idSet.has(batch.batchId))
      return matched.length ? matched : allBatches
    },
    getProjectLatestTime(project) {
      const batches = this.getProjectBatches(project)
      const batchLatest = batches
        .map((batch) => batch.updatedAt || batch.createdAt || '')
        .filter(Boolean)
        .sort((left, right) => String(right).localeCompare(String(left)))[0]
      return batchLatest || project.updatedAt || project.createdAt || ''
    },
    formatTime(value) {
      if (!value) {
        return '-'
      }
      const date = new Date(value)
      if (Number.isNaN(date.getTime())) {
        return String(value)
      }
      const y = date.getFullYear()
      const m = `${date.getMonth() + 1}`.padStart(2, '0')
      const d = `${date.getDate()}`.padStart(2, '0')
      const hh = `${date.getHours()}`.padStart(2, '0')
      const mm = `${date.getMinutes()}`.padStart(2, '0')
      return `${y}-${m}-${d} ${hh}:${mm}`
    },
    getTargetEmptyText(targetName = 'targets') {
      const labels = {
        'pending review batches': '待审核批次',
        'needs-revision batches': '待修改批次',
        'pending review projects': '待审核项目',
        'needs-revision projects': '待修改项目',
        'sync-failed batches': '同步失败批次',
        'reconcile-failed batches': '校准失败批次',
        'compensation-heavy batches': '补偿压力较高批次',
        'compensation-heavy projects': '补偿压力较高项目',
        targets: '处理对象'
      }
      const label = labels[targetName] || '处理对象'
      if (!this.hasAnyDeliveryData) {
        return `暂无${label}数据。`
      }
      return `当前状态下没有匹配的${label}。`
    },
    getBatchReviewableTasks(batch) {
      const byId = this.tasksById || {}
      const taskIds = Array.isArray(batch && batch.taskIds) ? batch.taskIds : []
      return taskIds
        .map((taskId) => byId[taskId])
        .filter((task) => task && this.hasTaskResult(task))
    },
    getBatchDeliveryReviewLabel(batch) {
      const counts = this.getBatchDeliveryCounts(batch)
      const readyCount = counts.readyCount
      const approvedCount = counts.approvedCount
      const needsRevisionCount = counts.needsRevisionCount
      const pendingReviewCount = counts.pendingReviewCount

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
    getBatchDeliveryCounts(batch) {
      const reviewableTasks = this.getBatchReviewableTasks(batch)
      const readyCount = reviewableTasks.length
      const approvedCount = reviewableTasks.filter((task) => (task.deliveryStatus || 'pending_review') === 'approved').length
      const needsRevisionCount = reviewableTasks.filter((task) => (task.deliveryStatus || 'pending_review') === 'needs_revision').length
      const pendingReviewCount = Math.max(0, readyCount - approvedCount - needsRevisionCount)
      return {
        readyCount,
        approvedCount,
        needsRevisionCount,
        pendingReviewCount
      }
    },
    getProjectDeliveryReviewLabel(project) {
      const batches = this.getProjectBatches(project)
      if (!batches.length) {
        return 'pending_review'
      }
      const hasRevisionRequired = batches.some((batch) => this.getBatchDeliveryReviewLabel(batch) === 'revision_required')
      if (hasRevisionRequired) {
        return 'revision_required'
      }
      const readyToDeliverCount = batches.filter((batch) => this.getBatchDeliveryReviewLabel(batch) === 'ready_to_deliver').length
      const pendingReviewCount = batches.filter((batch) => this.getBatchDeliveryReviewLabel(batch) === 'pending_review').length
      const partiallyReviewedCount = batches.filter((batch) => this.getBatchDeliveryReviewLabel(batch) === 'partially_reviewed').length

      if (readyToDeliverCount === batches.length && batches.length > 0) {
        return 'ready_to_deliver'
      }
      if (readyToDeliverCount > 0 && (pendingReviewCount > 0 || partiallyReviewedCount > 0)) {
        return 'partially_reviewed'
      }
      return 'pending_review'
    },
    hasPendingReviewBatches(project) {
      return this.getProjectBatches(project).some((batch) => {
        const label = this.getBatchDeliveryReviewLabel(batch)
        return label === 'pending_review' || label === 'partially_reviewed'
      })
    },
    hasNeedsRevisionBatches(project) {
      return this.getProjectBatches(project).some((batch) => this.getBatchDeliveryReviewLabel(batch) === 'revision_required')
    },
    goToDeliveryQueue() {
      uni.navigateTo({
        url: '/package-mobile-enterprise/delivery-queue-list/delivery-queue-list'
      })
    },
    goToQueueWithFilter(type = 'all', status = 'all') {
      const query = [
        `type=${encodeURIComponent(type || 'all')}`,
        `status=${encodeURIComponent(status || 'all')}`
      ].join('&')
      uni.navigateTo({
        url: `/package-mobile-enterprise/delivery-queue-list/delivery-queue-list?${query}`
      })
    },
    goToQueueWithTarget(type = 'all', status = 'all', batchId = '', projectId = '') {
      const query = [
        `type=${encodeURIComponent(type || 'all')}`,
        `status=${encodeURIComponent(status || 'all')}`
      ]
      if (batchId) {
        query.push(`batchId=${encodeURIComponent(batchId)}`)
      }
      if (projectId) {
        query.push(`projectId=${encodeURIComponent(projectId)}`)
      }
      uni.navigateTo({
        url: `/package-mobile-enterprise/delivery-queue-list/delivery-queue-list?${query.join('&')}`
      })
    },
    goToBatchList() {
      uni.navigateTo({
        url: '/package-mobile-enterprise/batch-list/batch-list'
      })
    },
    goToDeliveryActionHistory() {
      uni.navigateTo({
        url: '/package-mobile-enterprise/delivery-action-history/delivery-action-history'
      })
    },
    goToBatchReview(reviewContext = 'pending_review') {
      uni.navigateTo({
        url: `/package-mobile-enterprise/batch-list/batch-list?mode=delivery-review&reviewContext=${encodeURIComponent(reviewContext)}`
      })
    },
    goToBatchListWithContext(mode = '', reviewContext = '') {
      const query = []
      if (mode) {
        query.push(`mode=${encodeURIComponent(mode)}`)
      }
      if (reviewContext) {
        query.push(`reviewContext=${encodeURIComponent(reviewContext)}`)
      }
      const suffix = query.length ? `?${query.join('&')}` : ''
      uni.navigateTo({
        url: `/package-mobile-enterprise/batch-list/batch-list${suffix}`
      })
    },
    goToProjectListWithContext(mode = '', reviewContext = '') {
      const query = []
      if (mode) {
        query.push(`mode=${encodeURIComponent(mode)}`)
      }
      if (reviewContext) {
        query.push(`reviewContext=${encodeURIComponent(reviewContext)}`)
      }
      const suffix = query.length ? `?${query.join('&')}` : ''
      uni.navigateTo({
        url: `/package-mobile-enterprise/project-list/project-list${suffix}`
      })
    },
    goToBatchDetailWithContext(batchId = '', mode = '', reviewContext = '') {
      if (!batchId) {
        return
      }
      const query = [`batchId=${encodeURIComponent(batchId)}`]
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
    goToProjectDetailWithContext(projectId = '', mode = '', reviewContext = '') {
      if (!projectId) {
        return
      }
      const query = [`projectId=${encodeURIComponent(projectId)}`]
      if (mode) {
        query.push(`mode=${encodeURIComponent(mode)}`)
      }
      if (reviewContext) {
        query.push(`reviewContext=${encodeURIComponent(reviewContext)}`)
      }
      uni.navigateTo({
        url: `/package-mobile-enterprise/project-detail/project-detail?${query.join('&')}`
      })
    },
    getCompensationTargets(level = 'batch') {
      const byId = this.tasksById || {}
      const map = new Map()
      const activeQueueItems = this.queueItems.filter((item) => {
        if (!item) {
          return false
        }
        return item.status === 'pending' || item.status === 'failed'
      })

      activeQueueItems.forEach((item) => {
        const task = byId[item.taskId] || null
        const key = level === 'project' ? ((task && task.projectId) || '') : ((task && task.batchId) || '')
        if (!key) {
          return
        }
        const time = item.updatedAt || item.createdAt || (task && (task.updatedAt || task.createdAt)) || ''
        const current = map.get(key) || {
          [level === 'project' ? 'projectId' : 'batchId']: key,
          pendingCount: 0,
          failedCount: 0,
          queueLoad: 0,
          latestTime: ''
        }
        if (item.status === 'pending') {
          current.pendingCount += 1
        }
        if (item.status === 'failed') {
          current.failedCount += 1
        }
        current.queueLoad = current.pendingCount + current.failedCount
        if (time && String(time).localeCompare(String(current.latestTime || '')) > 0) {
          current.latestTime = time
        }
        map.set(key, current)
      })

      return Array.from(map.values()).sort((left, right) => {
        if (right.queueLoad !== left.queueLoad) {
          return right.queueLoad - left.queueLoad
        }
        return String(right.latestTime || '').localeCompare(String(left.latestTime || ''))
      })
    },
    handlePriorityAction() {
      if (this.priorityActionKey === 'delivery_queue') {
        this.goToDeliveryQueue()
        return
      }
      if (this.priorityActionKey === 'needs_revision_batches') {
        this.goToBatchListWithContext('delivery-review', 'needs_revision')
        return
      }
      if (this.priorityActionKey === 'pending_review_batches') {
        this.goToBatchListWithContext('delivery-review', 'pending_review')
        return
      }
      if (this.priorityActionKey === 'ready_to_deliver_batches') {
        this.goToBatchListWithContext('delivery-view', '')
        return
      }
      this.goToBatchList()
    },
    handleExceptionPriorityAction() {
      if (this.exceptionPriorityKey === 'sync_failed') {
        const top = this.topSyncFailedBatches && this.topSyncFailedBatches[0]
        if (top && top.batchId) {
          this.goToBatchDetailWithContext(top.batchId, 'delivery-review', 'needs_revision')
          return
        }
        this.goToQueueWithFilter('sync', 'failed')
        return
      }
      if (this.exceptionPriorityKey === 'reconcile_failed') {
        const top = this.topReconcileFailedBatches && this.topReconcileFailedBatches[0]
        if (top && top.batchId) {
          this.goToBatchDetailWithContext(top.batchId, 'delivery-review', 'needs_revision')
          return
        }
        this.goToQueueWithFilter('reconcile', 'failed')
        return
      }
      if (this.exceptionPriorityKey === 'queue_backlog') {
        if (this.topPendingQueueTask && this.topPendingQueueTask.taskId) {
          uni.navigateTo({
            url: `/package-ai/result/result?taskId=${encodeURIComponent(this.topPendingQueueTask.taskId)}&mode=delivery-review&reviewContext=pending_review`
          })
          return
        }
        this.goToQueueWithFilter('all', 'pending')
        return
      }
      this.goToBatchList()
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
.health-card,
.priority-card,
.summary-card,
.action-card {
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

.health-label {
  display: block;
  font-size: 24rpx;
  color: #888;
}

.health-value {
  display: block;
  margin-top: 8rpx;
  font-size: 34rpx;
  font-weight: 700;
}

.health-healthy {
  color: #16a34a;
}

.health-attention_needed {
  color: #d97706;
}

.health-blocked {
  color: #dc2626;
}

.health-desc {
  display: block;
  margin-top: 8rpx;
  font-size: 24rpx;
  line-height: 1.6;
  color: #555;
}

.section-title {
  display: block;
  font-size: 28rpx;
  font-weight: 700;
  color: #222;
  margin-bottom: 10rpx;
}

.summary-line {
  display: block;
  margin-top: 10rpx;
  font-size: 24rpx;
  color: #333;
}

.summary-line.clickable {
  color: #1677ff;
  text-decoration: underline;
}

.action-row {
  display: flex;
  gap: 12rpx;
  flex-wrap: wrap;
}

.action-group {
  margin-top: 16rpx;
}

.group-title {
  display: block;
  margin-bottom: 10rpx;
  font-size: 24rpx;
  color: #666;
}

.target-group {
  margin-top: 14rpx;
}

.target-item {
  margin-top: 10rpx;
  padding: 12rpx 14rpx;
  border-radius: 14rpx;
  background: #f7f8fb;
}

.target-main {
  display: block;
  font-size: 24rpx;
  font-weight: 600;
  color: #1f2937;
}

.target-sub {
  display: block;
  margin-top: 4rpx;
  font-size: 22rpx;
  color: #4b5563;
}

.target-empty {
  display: block;
  margin-top: 8rpx;
  font-size: 22rpx;
  color: #9ca3af;
}

.action-btn {
  flex: 1;
  min-width: 280rpx;
  border-radius: 999rpx;
  font-size: 24rpx;
}

.action-btn.primary {
  background: #1677ff;
  color: #fff;
}

.action-btn.secondary {
  background: #13c2c2;
  color: #fff;
}

.action-btn.warning {
  background: #ff4d4f;
  color: #fff;
}

.action-btn.success {
  background: #16a34a;
  color: #fff;
}

.action-btn[disabled] {
  opacity: 0.55;
}
</style>
