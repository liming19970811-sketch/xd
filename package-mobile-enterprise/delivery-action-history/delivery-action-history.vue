<template>
  <view class="container">
    <view class="header-card">
      <text class="title">交付操作记录</text>
      <text class="subtitle">查看项目、批次和结果的近期交付操作</text>
    </view>

    <view class="summary-card">
      <text class="summary-line">近期操作总数：{{ actions.length }}</text>
      <text class="summary-line">最多显示：30 条</text>
    </view>

    <view class="summary-card">
      <text class="section-title">筛选</text>
      <text class="summary-line">操作层级：{{ getActionLevelLabel(levelFilter) }}</text>
      <view class="filter-row">
        <button class="action-btn filter-btn" :class="{ active: levelFilter === 'all' }" @click="levelFilter = 'all'">全部</button>
        <button class="action-btn filter-btn" :class="{ active: levelFilter === 'project' }" @click="levelFilter = 'project'">项目</button>
        <button class="action-btn filter-btn" :class="{ active: levelFilter === 'batch' }" @click="levelFilter = 'batch'">批次</button>
        <button class="action-btn filter-btn" :class="{ active: levelFilter === 'result' }" @click="levelFilter = 'result'">结果</button>
      </view>
      <text class="summary-line">操作类型：{{ getActionTypeLabel(typeFilter) }}</text>
      <view class="filter-row">
        <button
          v-for="type in actionTypeOptions"
          :key="`type_${type}`"
          class="action-btn filter-btn"
          :class="{ active: typeFilter === type }"
          @click="typeFilter = type"
        >
          {{ getActionTypeLabel(type) }}
        </button>
      </view>
    </view>

    <view class="list-card">
      <text class="section-title">近期交付操作</text>
      <view v-if="filteredActions.length" class="history-list">
        <view
          v-for="item in filteredActions"
          :key="item.key"
          class="history-item"
        >
          <text class="info-line">操作层级：{{ item.actionLevelLabel }}</text>
          <text class="info-line">操作类型：{{ getActionTypeLabel(item.actionType) }}</text>
          <text class="info-line">操作来源：<text class="source-badge">{{ item.actionSource || '暂无' }}</text></text>
          <text class="info-line">触发位置：{{ item.triggeredFrom || '暂无' }}</text>
          <text class="info-line">时间：{{ formatTime(item.createdAt) }}</text>
          <text class="info-line">项目编号：{{ item.projectId || '暂无' }}</text>
          <text class="info-line">批次编号：{{ item.batchId || '暂无' }}</text>
          <text class="info-line">任务编号：{{ item.taskId || '暂无' }}</text>
          <button
            class="action-btn"
            :disabled="!item.target"
            @click="openActionTarget(item)"
          >
            查看关联对象
          </button>
        </view>
      </view>
      <text v-else-if="!actions.length" class="empty-text">暂无交付操作记录。</text>
      <text v-else class="empty-text">没有匹配的交付操作。</text>
    </view>
  </view>
</template>

<script>
import { getDeliveryActionTarget, getRecentDeliveryActions } from '../../utils/task/deliveryActionHistory'

export default {
  data() {
    return {
      actions: [],
      levelFilter: 'all',
      typeFilter: 'all',
      actionTypeOptions: [
        'all',
        'approve_deliverable_batches_in_project',
        'mark_pending_review_batches_as_needs_revision_in_project',
        'approve_deliverable_results',
        'mark_pending_review_as_needs_revision',
        'approve_result',
        'mark_needs_revision'
      ]
    }
  },
  onShow() {
    this.refreshActions()
  },
  computed: {
    filteredActions() {
      let list = this.actions.slice()
      if (this.levelFilter !== 'all') {
        list = list.filter((item) => item && item.actionLevel === this.levelFilter)
      }
      if (this.typeFilter !== 'all') {
        list = list.filter((item) => item && item.actionType === this.typeFilter)
      }
      return list
    }
  },
  methods: {
    refreshActions() {
      const list = getRecentDeliveryActions(30)
      this.actions = list.map((item, index) => {
        const target = getDeliveryActionTarget(item)
        return {
          ...item,
          key: `${item.actionLevel || item.level || 'unknown'}_${item.actionType || 'na'}_${item.createdAt || item.time || 'na'}_${index}`,
          actionLevelLabel: this.getActionLevelLabel(item.actionLevel || item.level),
          target
        }
      })
    },
    getActionLevelLabel(level = '') {
      if (level === 'all') {
        return '全部'
      }
      if (level === 'project') {
        return '项目'
      }
      if (level === 'batch') {
        return '批次'
      }
      if (level === 'result') {
        return '结果'
      }
      return '未知'
    },
    getActionTypeLabel(type = '') {
      const labels = {
        all: '全部',
        approve_deliverable_batches_in_project: '通过项目可交付批次',
        mark_pending_review_batches_as_needs_revision_in_project: '项目待审核批次标记修改',
        approve_deliverable_results: '通过可交付结果',
        mark_pending_review_as_needs_revision: '待审核结果标记修改',
        approve_result: '通过结果',
        mark_needs_revision: '标记需要修改'
      }
      return labels[type] || type || '暂无'
    },
    formatTime(value = '') {
      if (!value) {
        return '暂无'
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
      const ss = `${date.getSeconds()}`.padStart(2, '0')
      return `${y}-${m}-${d} ${hh}:${mm}:${ss}`
    },
    openActionTarget(item) {
      if (!item || !item.target || !item.target.url) {
        uni.showToast({
          title: '暂无关联对象',
          icon: 'none'
        })
        return
      }
      uni.navigateTo({
        url: item.target.url
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
.list-card {
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

.section-title {
  display: block;
  font-size: 28rpx;
  font-weight: 700;
  color: #222;
  margin-bottom: 10rpx;
}

.summary-line,
.info-line {
  display: block;
  margin-top: 10rpx;
  font-size: 24rpx;
  color: #333;
  line-height: 1.6;
  word-break: break-all;
}

.history-list {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
  margin-top: 8rpx;
}

.filter-row {
  display: flex;
  flex-wrap: wrap;
  gap: 10rpx;
  margin-top: 10rpx;
}

.history-item {
  background: #f8fafc;
  border-radius: 14rpx;
  padding: 14rpx;
}

.source-badge {
  display: inline-block;
  margin-left: 6rpx;
  padding: 2rpx 10rpx;
  border-radius: 999rpx;
  font-size: 20rpx;
  color: #1677ff;
  background: #e6f4ff;
}

.action-btn {
  margin-top: 10rpx;
  background: #1677ff;
  color: #fff;
  border-radius: 999rpx;
  font-size: 24rpx;
}

.filter-btn {
  margin-top: 0;
  min-width: 180rpx;
}

.filter-btn.active {
  background: #13c2c2;
}

.action-btn[disabled] {
  opacity: 0.6;
}

.empty-text {
  display: block;
  margin-top: 8rpx;
  font-size: 24rpx;
  color: #8c8c8c;
}
</style>
