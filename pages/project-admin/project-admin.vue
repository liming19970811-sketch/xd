<template>
  <view class="container">
    <view class="header">
      <text class="title">项目管理</text>
      <text class="subtitle">项目阶段与状态管理</text>
    </view>

    <view class="toolbar">
      <picker :range="statusLabels" :value="statusIndex" @change="onStatusFilterChange">
        <view class="filter-chip">状态：{{ getProjectStatusFilterLabel(filterStatus) }}</view>
      </picker>
      <picker :range="stageLabels" :value="stageIndex" @change="onStageFilterChange">
        <view class="filter-chip">阶段：{{ getProjectStageFilterLabel(filterStage) }}</view>
      </picker>
    </view>

    <view v-if="visibleProjects.length" class="card-list">
      <view v-for="project in visibleProjects" :key="project.projectId" class="card">
        <view class="card-top">
          <view>
            <text class="card-title">{{ project.projectName || project.projectId }}</text>
            <text class="card-meta">{{ project.projectId }}</text>
          </view>
          <text class="status-chip">{{ getProjectStatusLabel(project.status) }}</text>
        </view>

        <text class="card-line">类型：{{ project.projectType || 'design_service' }}</text>
        <text class="card-line">阶段：{{ getProjectStageLabel(project.stage) }}</text>
        <text class="card-line">线索：{{ project.leadId || '暂无' }}</text>
        <text class="card-line">更新时间：{{ formatTime(project.updatedAt) }}</text>

        <view class="inline-pickers">
          <picker :range="projectStatusLabels" :value="getProjectStatusIndex(project.status)" @change="onProjectStatusChange(project, $event)">
            <view class="picker-chip">更新状态</view>
          </picker>
          <picker :range="projectStageLabels" :value="getProjectStageIndex(project.stage)" @change="onProjectStageChange(project, $event)">
            <view class="picker-chip">更新阶段</view>
          </picker>
        </view>

        <view class="actions">
          <button class="primary-btn" @click="viewProject(project)">查看详情</button>
        </view>
      </view>
    </view>

    <view v-else class="empty-state">
      <text class="empty-title">暂无线索项目</text>
      <text class="empty-desc">将线索转为项目后，会显示在这里。</text>
    </view>
  </view>
</template>

<script>
import {
  PROJECT_STAGE_DISPLAY,
  PROJECT_STATUS_DISPLAY,
  getProjectStageLabel,
  getProjectStatusLabel
} from '../../utils/constants'
import { getAdminProjectList, PROJECT_ADMIN_STAGE_OPTIONS, updateAdminProject } from '../../utils/service/adminRepository'

export default {
  data() {
    return {
      projects: [],
      filterStatus: 'all',
      filterStage: 'all'
    }
  },
  onShow() {
    this.loadProjects()
  },
  computed: {
    projectStatusOptions() {
      return PROJECT_STATUS_DISPLAY
    },
    projectStageOptions() {
      return PROJECT_STAGE_DISPLAY.filter((item) => PROJECT_ADMIN_STAGE_OPTIONS.includes(item.value))
    },
    statusOptions() {
      return [{ value: 'all', label: '全部' }, ...this.projectStatusOptions]
    },
    stageOptions() {
      return [{ value: 'all', label: '全部' }, ...this.projectStageOptions]
    },
    statusLabels() {
      return this.statusOptions.map((item) => item.label)
    },
    stageLabels() {
      return this.stageOptions.map((item) => item.label)
    },
    projectStatusLabels() {
      return this.projectStatusOptions.map((item) => item.label)
    },
    projectStageLabels() {
      return this.projectStageOptions.map((item) => item.label)
    },
    statusIndex() {
      const index = this.statusOptions.findIndex((item) => item.value === this.filterStatus)
      return index >= 0 ? index : 0
    },
    stageIndex() {
      const index = this.stageOptions.findIndex((item) => item.value === this.filterStage)
      return index >= 0 ? index : 0
    },
    visibleProjects() {
      return this.projects.filter((project) => {
        if (this.filterStatus !== 'all' && project.status !== this.filterStatus) {
          return false
        }
        if (this.filterStage !== 'all' && project.stage !== this.filterStage) {
          return false
        }
        return true
      })
    }
  },
  methods: {
    async loadProjects() {
      this.projects = await getAdminProjectList({ preferCloud: true })
    },
    onStatusFilterChange(event) {
      const index = Number(event.detail.value)
      this.filterStatus = (this.statusOptions[index] && this.statusOptions[index].value) || 'all'
    },
    onStageFilterChange(event) {
      const index = Number(event.detail.value)
      this.filterStage = (this.stageOptions[index] && this.stageOptions[index].value) || 'all'
    },
    getProjectStatusIndex(status) {
      const index = this.projectStatusOptions.findIndex((item) => item.value === status)
      return index >= 0 ? index : 0
    },
    getProjectStageIndex(stage) {
      const index = this.projectStageOptions.findIndex((item) => item.value === stage)
      return index >= 0 ? index : 0
    },
    getProjectStatusLabel,
    getProjectStageLabel,
    getProjectStatusFilterLabel(value) {
      if (value === 'all') {
        return '全部'
      }
      return this.getProjectStatusLabel(value)
    },
    getProjectStageFilterLabel(value) {
      if (value === 'all') {
        return '全部'
      }
      return this.getProjectStageLabel(value)
    },
    formatTime(value) {
      return value ? String(value).replace('T', ' ').replace('.000Z', '') : '暂无'
    },
    async onProjectStatusChange(project, event) {
      const status = (this.projectStatusOptions[Number(event.detail.value)] && this.projectStatusOptions[Number(event.detail.value)].value) || this.projectStatusOptions[0].value
      try {
        await updateAdminProject(project.projectId, { status }, { preferCloud: true })
        await this.loadProjects()
        uni.showToast({
          title: '项目状态已更新',
          icon: 'success'
        })
      } catch (error) {
        uni.showToast({
          title: error && error.message ? error.message : '更新状态失败',
          icon: 'none'
        })
      }
    },
    async onProjectStageChange(project, event) {
      const stage = (this.projectStageOptions[Number(event.detail.value)] && this.projectStageOptions[Number(event.detail.value)].value) || this.projectStageOptions[0].value
      try {
        await updateAdminProject(project.projectId, { stage }, { preferCloud: true })
        await this.loadProjects()
        uni.showToast({
          title: '项目阶段已更新',
          icon: 'success'
        })
      } catch (error) {
        uni.showToast({
          title: error && error.message ? error.message : '更新阶段失败',
          icon: 'none'
        })
      }
    },
    viewProject(project) {
      if (!project || !project.projectId) {
        return
      }

      uni.navigateTo({
        url: `/package-mobile-enterprise/project-detail/project-detail?projectId=${encodeURIComponent(project.projectId)}`
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
  font-weight: 600;
  color: #222;
}

.subtitle {
  display: block;
  margin-top: 8rpx;
  font-size: 24rpx;
  color: #666;
}

.toolbar,
.card,
.empty-state {
  background: #fff;
  border-radius: 20rpx;
  padding: 24rpx;
  margin-bottom: 20rpx;
}

.toolbar {
  display: flex;
  gap: 12rpx;
  flex-wrap: wrap;
}

.filter-chip,
.picker-chip {
  padding: 12rpx 18rpx;
  border-radius: 999rpx;
  background: #f9f0ff;
  color: #722ed1;
  font-size: 24rpx;
}

.card-list {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}

.card-top {
  display: flex;
  justify-content: space-between;
  gap: 20rpx;
  align-items: flex-start;
  margin-bottom: 12rpx;
}

.card-title {
  display: block;
  font-size: 30rpx;
  font-weight: 600;
  color: #222;
}

.card-meta,
.card-line {
  display: block;
  margin-top: 8rpx;
  font-size: 24rpx;
  color: #666;
  word-break: break-all;
}

.status-chip {
  padding: 10rpx 18rpx;
  border-radius: 999rpx;
  background: #e6f4ff;
  color: #1677ff;
  font-size: 22rpx;
}

.inline-pickers,
.actions {
  display: flex;
  gap: 12rpx;
  margin-top: 18rpx;
}

.primary-btn {
  width: 100%;
  border-radius: 16rpx;
  background: #1677ff;
  color: #fff;
  font-size: 24rpx;
}

.empty-state {
  text-align: center;
}

.empty-title {
  display: block;
  font-size: 30rpx;
  font-weight: 600;
  color: #222;
}

.empty-desc {
  display: block;
  margin-top: 10rpx;
  font-size: 24rpx;
  color: #888;
}
</style>
