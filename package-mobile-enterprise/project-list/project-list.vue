<template>
  <view class="container">
    <view class="header">
      <text class="title">项目列表</text>
      <text class="subtitle">查看由客户需求转化的企业项目</text>
      <text v-if="deliveryContextHint" class="delivery-context-hint">{{ deliveryContextHint }}</text>
      <button class="batch-entry-btn" @click="goToBatchList">查看生产批次</button>
    </view>

    <view class="filter-card">
      <input
        v-model.trim="searchKeyword"
        class="search-input"
        placeholder="搜索项目名称、项目编号或线索编号"
      />

      <view class="filter-row">
        <picker :range="statusFilterLabels" :value="statusFilterIndex" @change="onStatusFilterChange">
          <view class="filter-chip">状态：{{ formatStatusLabel(filterStatus) }}</view>
        </picker>

        <picker :range="projectTypeLabels" :value="projectTypeFilterIndex" @change="onProjectTypeFilterChange">
          <view class="filter-chip">类型：{{ formatProjectType(filterProjectType) }}</view>
        </picker>
      </view>
    </view>

    <view class="filter-card quick-actions-card">
      <text class="quick-actions-title">项目快捷操作</text>
      <view class="project-action-row">
        <button
          class="project-action-btn primary"
          :disabled="!topPendingReviewProject"
          @click="goToProjectDetailWithContext(topPendingReviewProject, 'delivery-review', 'pending_review')"
        >
          打开优先待审核项目
        </button>
        <button
          class="project-action-btn warning"
          :disabled="!topNeedsRevisionProject"
          @click="goToProjectDetailWithContext(topNeedsRevisionProject, 'delivery-review', 'needs_revision')"
        >
          打开优先待修改项目
        </button>
        <button
          class="project-action-btn success"
          :disabled="!topDeliverableProject"
          @click="goToProjectDetailWithContext(topDeliverableProject, 'delivery-view', '')"
        >
          打开优先可交付项目
        </button>
      </view>
      <text v-if="!topPendingReviewProject && !topNeedsRevisionProject && !topDeliverableProject" class="state-hint">
        {{ projects.length ? '当前筛选下没有可快捷处理的项目。' : '暂无项目数据。' }}
      </text>
    </view>

    <view class="filter-card quick-actions-card">
      <text class="quick-actions-title">项目优先处理建议</text>
      <text class="project-line">优先项目分组：{{ priorityProjectGroupLabel }}</text>
      <text class="project-line">优先原因：{{ priorityProjectReason }}</text>
      <text class="project-line">建议操作：{{ priorityProjectActionLabel }}</text>
      <text
        v-if="priorityProjectGroupCount > 0"
        class="project-line"
      >
        优先分组数量：{{ priorityProjectGroupCount }}
      </text>
      <view class="project-action-row">
        <button
          class="project-action-btn"
          :class="{ primary: priorityProjectGroup === 'pending_review', warning: priorityProjectGroup === 'needs_revision', success: priorityProjectGroup === 'deliverable' }"
          :disabled="!priorityProjectActionEnabled"
          @click="triggerPriorityProjectAction"
        >
          {{ priorityProjectActionLabel }}
        </button>
      </view>
    </view>

    <view class="filter-card quick-actions-card">
      <text class="quick-actions-title">项目分组操作</text>
      <text class="project-line">当前分组：{{ focusGroupLabel }}</text>
      <text class="project-line">推荐项目：{{ recommendedProject ? (recommendedProject.projectName || recommendedProject.projectId || '暂无') : '暂无' }}</text>
      <view class="project-action-row">
        <button
          class="project-action-btn primary"
          :disabled="!pendingReviewProjects.length"
          @click="focusProjectGroup('pending_review')"
        >
          查看全部待审核项目
        </button>
        <button
          class="project-action-btn warning"
          :disabled="!needsRevisionProjects.length"
          @click="focusProjectGroup('needs_revision')"
        >
          查看全部待修改项目
        </button>
        <button
          class="project-action-btn success"
          :disabled="!deliverableProjects.length"
          @click="focusProjectGroup('deliverable')"
        >
          查看全部可交付项目
        </button>
        <button
          class="project-action-btn"
          :disabled="!effectiveListFocusGroup"
          @click="focusProjectGroup('')"
        >
          重置分组
        </button>
      </view>
      <text
        v-if="effectiveListFocusGroup && !focusedProjects.length"
        class="state-hint"
      >
        {{ projects.length ? '当前分组没有匹配项目。' : '暂无项目数据。' }}
      </text>
    </view>

    <view id="project-list-section" v-if="filteredProjects.length" class="project-list">
      <view
        v-for="project in displayProjects"
        :key="project.projectId"
        class="project-card"
        :class="{ focused: isFocusedProject(project), compact: isCompactProject(project), recommended: isRecommendedProject(project) }"
        @click="goToProjectDetail(project)"
      >
        <text class="project-name">{{ project.projectName || '未命名项目' }}</text>
        <text v-if="isRecommendedProject(project)" class="recommended-badge">推荐项目</text>
        <text class="project-line">项目编号：{{ project.projectId }}</text>
        <text class="project-line">线索编号：{{ project.leadId || '暂无' }}</text>
        <text class="project-line">项目类型：{{ formatProjectType(project.projectType) }}</text>
        <text class="project-line">项目状态：{{ formatStatusLabel(project.status) }}</text>
        <text class="project-line">
          交付审核：<text class="review-badge">{{ formatStatusLabel(getProjectDeliveryReviewLabel(project)) }}</text>
        </text>
        <text class="project-line">可交付批次：{{ getProjectDeliverableBatchCount(project) }}</text>
        <text class="project-line">待审核批次：{{ getProjectPendingReviewBatchCount(project) }}</text>
        <text class="project-line">待修改批次：{{ getProjectNeedsRevisionBatchCount(project) }}</text>
        <text v-if="!isCompactProject(project)" class="project-line">已有结果任务：{{ getProjectReadyResultTaskCount(project) }}</text>
        <text v-if="!isCompactProject(project)" class="project-line">任务数量：{{ getProjectTaskCount(project) }}</text>
        <text v-if="!isCompactProject(project)" class="project-line">批次数量：{{ getProjectBatchCount(project) }}</text>
        <text v-if="!isCompactProject(project)" class="project-line">最近任务：{{ getProjectLatestTaskAt(project) }}</text>
        <text v-if="!isCompactProject(project)" class="project-line">最近批次：{{ getProjectLatestBatchAt(project) }}</text>
        <text v-if="!isCompactProject(project)" class="project-line">服务范围：{{ formatScope(project.serviceScope) }}</text>
        <text v-if="!isCompactProject(project)" class="project-line">创建时间：{{ project.createdAt || '暂无' }}</text>
        <text v-else class="project-line compact-hint">当前为精简视图，可切换分组调整优先级。</text>
        <view class="project-action-row">
          <button
            v-if="getProjectNeedsRevisionBatchCount(project) > 0"
            class="project-action-btn warning"
            @click.stop="goToProjectDetailWithContext(project, 'delivery-review', 'needs_revision')"
          >
            处理项目修改
          </button>
          <button
            v-if="getProjectPendingReviewBatchCount(project) > 0"
            class="project-action-btn primary"
            @click.stop="goToProjectDetailWithContext(project, 'delivery-review', 'pending_review')"
          >
            审核项目
          </button>
          <button
            v-if="getProjectDeliveryReviewLabel(project) === 'ready_to_deliver'"
            class="project-action-btn success"
            @click.stop="goToProjectDetailWithContext(project, 'delivery-view', '')"
          >
            查看交付项目
          </button>
        </view>
      </view>
    </view>

    <view v-else class="empty-state">
      <text class="empty-title">{{ projects.length ? '没有匹配项目' : '暂无项目' }}</text>
      <text class="empty-desc">
        {{ projects.length ? '请调整筛选条件或搜索关键词。' : '项目创建后会显示在这里。' }}
      </text>
    </view>
  </view>
</template>

<script>
import { getMainChainState } from '../../utils/mainChainState'
import { getBatchesByProjectId } from '../../utils/service/batchStore'
import { getProjectList } from '../../utils/service/projectStore'

export default {
  data() {
    return {
      projects: [],
      chainState: getMainChainState(),
      searchKeyword: '',
      filterStatus: 'all',
      filterProjectType: 'all',
      entryMode: '',
      reviewContext: '',
      listManualFocusGroup: '',
      compactProjectLimit: 2
    }
  },
  onLoad(options) {
    this.entryMode = options && options.mode ? decodeURIComponent(options.mode) : ''
    this.reviewContext = options && options.reviewContext ? decodeURIComponent(options.reviewContext) : ''
  },
  onShow() {
    this.chainState = getMainChainState()
    this.loadProjects()
  },
  computed: {
    deliveryContextHint() {
      if (this.entryMode === 'delivery-review' && this.reviewContext === 'needs_revision') {
        return '当前优先展示包含待修改批次的项目。'
      }
      if (this.entryMode === 'delivery-review' && this.reviewContext === 'pending_review') {
        return '当前优先展示包含待审核批次的项目。'
      }
      if (this.entryMode === 'delivery-view') {
        return '当前优先展示可交付项目。'
      }
      return ''
    },
    statusFilterOptions() {
      const options = Array.from(new Set(this.projects.map((project) => String(project.status || '').trim()).filter(Boolean)))
      return ['all', ...options]
    },
    projectTypeOptions() {
      const options = Array.from(new Set(this.projects.map((project) => String(project.projectType || '').trim()).filter(Boolean)))
      return ['all', ...options]
    },
    statusFilterLabels() {
      return this.statusFilterOptions.map((value) => this.formatStatusLabel(value))
    },
    projectTypeLabels() {
      return this.projectTypeOptions.map((value) => this.formatProjectType(value))
    },
    statusFilterIndex() {
      return this.getOptionIndex(this.statusFilterOptions, this.filterStatus)
    },
    projectTypeFilterIndex() {
      return this.getOptionIndex(this.projectTypeOptions, this.filterProjectType)
    },
    filteredProjects() {
      const keyword = String(this.searchKeyword || '').trim().toLowerCase()

      const filtered = this.projects.filter((project) => {
        if (!this.matchesDeliveryContext(project)) {
          return false
        }

        if (this.filterStatus !== 'all' && project.status !== this.filterStatus) {
          return false
        }

        if (this.filterProjectType !== 'all' && project.projectType !== this.filterProjectType) {
          return false
        }

        if (!keyword) {
          return true
        }

        const searchableFields = [project.projectName, project.projectId, project.leadId]
        return searchableFields.some((field) => String(field || '').toLowerCase().includes(keyword))
      })

      return filtered.sort((left, right) => this.compareProjectByDeliveryPriority(left, right))
    },
    pendingReviewProjects() {
      return this.filteredProjects.filter((project) => this.getProjectPendingReviewBatchCount(project) > 0)
    },
    needsRevisionProjects() {
      return this.filteredProjects.filter((project) => this.getProjectNeedsRevisionBatchCount(project) > 0)
    },
    deliverableProjects() {
      return this.filteredProjects.filter((project) => this.getProjectDeliveryReviewLabel(project) === 'ready_to_deliver')
    },
    topPendingReviewProject() {
      return this.filteredProjects.find((project) => this.getProjectPendingReviewBatchCount(project) > 0) || null
    },
    topNeedsRevisionProject() {
      return this.filteredProjects.find((project) => this.getProjectNeedsRevisionBatchCount(project) > 0) || null
    },
    topDeliverableProject() {
      return this.filteredProjects.find((project) => this.getProjectDeliveryReviewLabel(project) === 'ready_to_deliver') || null
    },
    priorityProjectGroup() {
      if (this.needsRevisionProjects.length > 0) {
        return '待修改'
      }
      if (this.pendingReviewProjects.length > 0) {
        return '待审核'
      }
      if (this.deliverableProjects.length > 0) {
        return '可交付'
      }
      return '暂无'
    },
    priorityProjectGroupLabel() {
      if (this.priorityProjectGroup === 'needs_revision') {
        return 'needs_revision'
      }
      if (this.priorityProjectGroup === 'pending_review') {
        return 'pending_review'
      }
      if (this.priorityProjectGroup === 'deliverable') {
        return 'deliverable'
      }
      return 'none'
    },
    priorityProjectReason() {
      if (this.priorityProjectGroup === 'needs_revision') {
        return `${this.needsRevisionProjects.length} 个项目包含待修改批次，建议优先处理。`
      }
      if (this.priorityProjectGroup === 'pending_review') {
        return `${this.pendingReviewProjects.length} 个项目包含待审核批次，建议尽快审核。`
      }
      if (this.priorityProjectGroup === 'deliverable') {
        return `${this.deliverableProjects.length} 个项目已可交付，建议进入交付处理。`
      }
      return '当前筛选条件下暂无优先项目。'
    },
    priorityProjectActionLabel() {
      if (this.priorityProjectGroup === 'needs_revision') {
        return '查看首个待修改项目'
      }
      if (this.priorityProjectGroup === 'pending_review') {
        return '查看首个待审核项目'
      }
      if (this.priorityProjectGroup === 'deliverable') {
        return '查看首个可交付项目'
      }
      return '暂无优先操作'
    },
    priorityProjectGroupCount() {
      if (this.priorityProjectGroup === 'needs_revision') {
        return this.needsRevisionProjects.length
      }
      if (this.priorityProjectGroup === 'pending_review') {
        return this.pendingReviewProjects.length
      }
      if (this.priorityProjectGroup === 'deliverable') {
        return this.deliverableProjects.length
      }
      return 0
    },
    priorityProjectActionEnabled() {
      if (this.priorityProjectGroup === 'needs_revision') {
        return !!this.topNeedsRevisionProject
      }
      if (this.priorityProjectGroup === 'pending_review') {
        return !!this.topPendingReviewProject
      }
      if (this.priorityProjectGroup === 'deliverable') {
        return !!this.topDeliverableProject
      }
      return false
    },
    contextFocusGroup() {
      if (this.entryMode === 'delivery-view') {
        return 'deliverable'
      }
      if (this.entryMode === 'delivery-review' && this.reviewContext === 'pending_review') {
        return '待审核'
      }
      if (this.entryMode === 'delivery-review' && this.reviewContext === 'needs_revision') {
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
    focusedProjects() {
      if (!this.effectiveListFocusGroup) {
        return this.filteredProjects
      }
      return this.filteredProjects.filter((project) => this.matchesProjectFocusGroup(project, this.effectiveListFocusGroup))
    },
    recommendedProject() {
      return this.focusedProjects.length ? this.focusedProjects[0] : null
    },
    displayProjects() {
      if (!this.effectiveListFocusGroup) {
        return this.filteredProjects
      }
      const focusedIds = new Set(this.focusedProjects.map((project) => project.projectId))
      const compactOthers = this.filteredProjects.filter((project) => !focusedIds.has(project.projectId)).slice(0, this.compactProjectLimit)
      return [...this.focusedProjects, ...compactOthers]
    }
  },
  methods: {
    formatProjectType(value) {
      const labels = {
        all: '全部',
        product: '商品项目',
        design: '设计项目',
        marketing: '营销项目',
        enterprise: '企业项目'
      }
      return labels[value] || value || '暂无'
    },
    formatStatusLabel(value) {
      const labels = {
        all: '全部',
        draft: '草稿',
        active: '进行中',
        processing: '处理中',
        completed: '已完成',
        pending_review: '待审核',
        partially_reviewed: '部分已审核',
        revision_required: '待修改',
        ready_to_deliver: '可交付',
        delivered: '已交付',
        failed: '失败'
      }
      return labels[value] || value || '暂无'
    },
    loadProjects() {
      this.projects = getProjectList()
    },
    getOptionIndex(options, value) {
      const index = options.indexOf(value)
      return index >= 0 ? index : 0
    },
    onStatusFilterChange(event) {
      const index = Number(event.detail.value)
      this.filterStatus = this.statusFilterOptions[index] || 'all'
    },
    onProjectTypeFilterChange(event) {
      const index = Number(event.detail.value)
      this.filterProjectType = this.projectTypeOptions[index] || 'all'
    },
    formatScope(scope) {
      if (!Array.isArray(scope) || !scope.length) {
        return '暂无'
      }
      return scope.join(', ')
    },
    getProjectTaskCount(project) {
      return Array.isArray(project && project.taskIds) ? project.taskIds.length : 0
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
    getProjectRelatedTaskIds(project) {
      const projectTaskIds = Array.isArray(project && project.taskIds) ? project.taskIds : []
      const batchTaskIds = this.getProjectBatches(project).flatMap((batch) => (Array.isArray(batch.taskIds) ? batch.taskIds : []))
      return Array.from(new Set([...projectTaskIds, ...batchTaskIds].filter(Boolean)))
    },
    getProjectRelatedTasks(project) {
      const byId = (this.chainState.tasks && this.chainState.tasks.byId) || {}
      return this.getProjectRelatedTaskIds(project)
        .map((taskId) => byId[taskId])
        .filter(Boolean)
    },
    hasTaskResult(task) {
      return !!(
        (task && task.result && task.result.coverUrl) ||
        (task && task.result && Array.isArray(task.result.items) && task.result.items.length)
      )
    },
    getProjectReviewableTasks(project) {
      return this.getProjectRelatedTasks(project).filter((task) => this.hasTaskResult(task))
    },
    getProjectReadyResultTaskCount(project) {
      return this.getProjectReviewableTasks(project).length
    },
    getBatchReviewableTasks(batch) {
      const byId = (this.chainState.tasks && this.chainState.tasks.byId) || {}
      const taskIds = Array.isArray(batch && batch.taskIds) ? batch.taskIds : []
      return taskIds
        .map((taskId) => byId[taskId])
        .filter((task) => task && this.hasTaskResult(task))
    },
    getBatchDeliveryReviewLabel(batch) {
      const reviewableTasks = this.getBatchReviewableTasks(batch)
      const readyCount = reviewableTasks.length
      const approvedCount = reviewableTasks.filter((task) => (task.deliveryStatus || 'pending_review') === 'approved').length
      const needsRevisionCount = reviewableTasks.filter((task) => (task.deliveryStatus || 'pending_review') === 'needs_revision').length
      const pendingReviewCount = readyCount - approvedCount - needsRevisionCount

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
    getProjectDeliverableBatchCount(project) {
      return this.getProjectBatches(project).filter((batch) => this.getBatchDeliveryReviewLabel(batch) === 'ready_to_deliver').length
    },
    getProjectPendingReviewBatchCount(project) {
      return this.getProjectBatches(project).filter((batch) => this.getBatchDeliveryReviewLabel(batch) === 'pending_review').length
    },
    hasProjectPendingReviewBatch(project) {
      return this.getProjectBatches(project).some((batch) => {
        const label = this.getBatchDeliveryReviewLabel(batch)
        return label === 'pending_review' || label === 'partially_reviewed'
      })
    },
    getProjectNeedsRevisionBatchCount(project) {
      return this.getProjectBatches(project).filter((batch) => this.getBatchDeliveryReviewLabel(batch) === 'revision_required').length
    },
    getProjectDeliveryReviewLabel(project) {
      const batches = this.getProjectBatches(project)
      if (!batches.length) {
        return this.getProjectReadyResultTaskCount(project) > 0 ? 'pending_review' : 'pending_review'
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
    getProjectPriorityRank(project) {
      const label = this.getProjectDeliveryReviewLabel(project)
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
    getProjectProcessingLoad(project) {
      const label = this.getProjectDeliveryReviewLabel(project)
      if (label === 'revision_required') {
        return this.getProjectNeedsRevisionBatchCount(project)
      }
      if (label === 'pending_review' || label === 'partially_reviewed') {
        return this.getProjectPendingReviewBatchCount(project)
      }
      if (label === 'ready_to_deliver') {
        return this.getProjectDeliverableBatchCount(project)
      }
      return 0
    },
    getProjectSortTime(project) {
      const latestTaskAt = this.getProjectLatestTaskAt(project)
      const latestBatchAt = this.getProjectLatestBatchAt(project)
      const candidates = [
        latestTaskAt !== '暂无' ? latestTaskAt : '',
        latestBatchAt !== '暂无' ? latestBatchAt : '',
        project.updatedAt || '',
        project.createdAt || ''
      ]
      const validTimes = candidates
        .map((value) => new Date(value).getTime() || 0)
        .filter((time) => time > 0)
      return validTimes.length ? Math.max(...validTimes) : 0
    },
    compareProjectByDeliveryPriority(left, right) {
      const rankDiff = this.getProjectPriorityRank(left) - this.getProjectPriorityRank(right)
      if (rankDiff !== 0) {
        return rankDiff
      }

      const loadDiff = this.getProjectProcessingLoad(right) - this.getProjectProcessingLoad(left)
      if (loadDiff !== 0) {
        return loadDiff
      }

      return this.getProjectSortTime(right) - this.getProjectSortTime(left)
    },
    matchesDeliveryContext(project) {
      if (this.entryMode === 'delivery-review' && this.reviewContext === 'pending_review') {
        return this.hasProjectPendingReviewBatch(project)
      }
      if (this.entryMode === 'delivery-review' && this.reviewContext === 'needs_revision') {
        return this.getProjectNeedsRevisionBatchCount(project) > 0
      }
      if (this.entryMode === 'delivery-view') {
        return this.getProjectDeliveryReviewLabel(project) === 'ready_to_deliver'
      }
      return true
    },
    matchesProjectFocusGroup(project, groupKey = '') {
      if (!project || !groupKey) {
        return true
      }
      if (groupKey === 'pending_review') {
        return this.getProjectPendingReviewBatchCount(project) > 0
      }
      if (groupKey === 'needs_revision') {
        return this.getProjectNeedsRevisionBatchCount(project) > 0
      }
      if (groupKey === 'deliverable') {
        return this.getProjectDeliveryReviewLabel(project) === 'ready_to_deliver'
      }
      return true
    },
    isFocusedProject(project) {
      if (!this.effectiveListFocusGroup) {
        return false
      }
      return this.matchesProjectFocusGroup(project, this.effectiveListFocusGroup)
    },
    isCompactProject(project) {
      if (!this.effectiveListFocusGroup) {
        return false
      }
      return !this.isFocusedProject(project)
    },
    isRecommendedProject(project) {
      return !!(project && this.recommendedProject && project.projectId && project.projectId === this.recommendedProject.projectId)
    },
    focusProjectGroup(groupKey = '') {
      this.listManualFocusGroup = groupKey
      this.$nextTick(() => {
        uni.pageScrollTo({
          selector: '#project-list-section',
          duration: 220
        })
      })
    },
    triggerPriorityProjectAction() {
      if (this.priorityProjectGroup === 'needs_revision' && this.topNeedsRevisionProject) {
        this.goToProjectDetailWithContext(this.topNeedsRevisionProject, 'delivery-review', 'needs_revision')
        return
      }
      if (this.priorityProjectGroup === 'pending_review' && this.topPendingReviewProject) {
        this.goToProjectDetailWithContext(this.topPendingReviewProject, 'delivery-review', 'pending_review')
        return
      }
      if (this.priorityProjectGroup === 'deliverable' && this.topDeliverableProject) {
        this.goToProjectDetailWithContext(this.topDeliverableProject, 'delivery-view', '')
        return
      }
      uni.showToast({
        title: 'No priority project to open',
        icon: 'none'
      })
    },
    getProjectBatchCount(project) {
      if (!project || !project.projectId) {
        return 0
      }

      const projectBatchIds = Array.isArray(project.batchIds) ? project.batchIds : []
      if (projectBatchIds.length) {
        return projectBatchIds.length
      }

      return getBatchesByProjectId(project.projectId).length
    },
    getProjectLatestTaskAt(project) {
      const taskIds = Array.isArray(project && project.taskIds) ? project.taskIds : []
      if (!taskIds.length) {
        return '暂无'
      }

      const byId = (this.chainState.tasks && this.chainState.tasks.byId) || {}
      let latestTime = ''

      taskIds.forEach((taskId) => {
        const task = byId[taskId]
        if (!task) {
          return
        }

        const taskTime = task.completedAt || task.updatedAt || task.submittedAt || task.createdAt || ''
        if (!taskTime) {
          return
        }

        if (!latestTime || new Date(taskTime).getTime() > new Date(latestTime).getTime()) {
          latestTime = taskTime
        }
      })

      return latestTime || '暂无'
    },
    getProjectLatestBatchAt(project) {
      if (!project || !project.projectId) {
        return '暂无'
      }

      const batches = this.getProjectBatches(project)
      if (!batches.length) {
        return '暂无'
      }

      const latestBatch = [...batches].sort((left, right) => {
        const leftTime = new Date(left.updatedAt || left.createdAt || '').getTime() || 0
        const rightTime = new Date(right.updatedAt || right.createdAt || '').getTime() || 0
        return rightTime - leftTime
      })[0]

      return latestBatch && (latestBatch.updatedAt || latestBatch.createdAt) ? latestBatch.updatedAt || latestBatch.createdAt : '暂无'
    },
    goToProjectDetail(project) {
      if (!project || !project.projectId) {
        uni.showToast({
          title: 'Project not found',
          icon: 'none'
        })
        return
      }

      uni.navigateTo({
        url: `/package-mobile-enterprise/project-detail/project-detail?projectId=${encodeURIComponent(project.projectId)}`
      })
    },
    goToProjectDetailWithContext(project, mode = '', reviewContext = '') {
      if (!project || !project.projectId) {
        uni.showToast({
          title: 'Project not found',
          icon: 'none'
        })
        return
      }
      const query = [`projectId=${encodeURIComponent(project.projectId)}`]
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
    goToBatchList() {
      uni.navigateTo({
        url: '/package-mobile-enterprise/batch-list/batch-list'
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

.delivery-context-hint {
  display: block;
  margin-top: 8rpx;
  font-size: 22rpx;
  color: #1677ff;
}

.batch-entry-btn {
  margin-top: 14rpx;
  background: #13c2c2;
  color: #fff;
  border-radius: 999rpx;
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
  background: #eef5ff;
  color: #1677ff;
  font-size: 22rpx;
}

.project-list {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}

.project-card,
.empty-state {
  background: #fff;
  border-radius: 24rpx;
  padding: 24rpx;
}

.project-card {
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.04);
}

.project-card.focused {
  border: 1rpx solid #1677ff;
}

.project-card.compact {
  opacity: 0.84;
}

.project-card.recommended {
  border: 1rpx solid #16a34a;
  box-shadow: 0 0 0 1rpx rgba(22, 163, 74, 0.12);
}

.project-name {
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

.project-line {
  display: block;
  margin-top: 10rpx;
  font-size: 24rpx;
  color: #444;
  word-break: break-all;
}

.project-action-row {
  margin-top: 14rpx;
  display: flex;
  flex-wrap: wrap;
  gap: 10rpx;
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

.compact-hint {
  color: #888;
}

.project-action-btn {
  border-radius: 999rpx;
  font-size: 22rpx;
  padding: 8rpx 14rpx;
  min-width: 220rpx;
}

.project-action-btn.primary {
  background: #1677ff;
  color: #fff;
}

.project-action-btn.warning {
  background: #fff7e6;
  color: #d46b08;
}

.project-action-btn.success {
  background: #f6ffed;
  color: #389e0d;
}

.project-action-btn[disabled],
.batch-entry-btn[disabled] {
  opacity: 0.55;
}

.state-hint {
  display: block;
  margin-top: 10rpx;
  font-size: 22rpx;
  color: #8c8c8c;
}

.review-badge {
  color: #1677ff;
  font-weight: 600;
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
