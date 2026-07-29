<template>
  <view class="container">
    <view class="header">
      <text class="title">任务管理</text>
      <text class="subtitle">任务列表、状态筛选和基础操作</text>
    </view>

    <view class="toolbar">
      <picker :range="statusFilterLabels" :value="statusIndex" @change="onStatusChange">
        <view class="filter-chip">状态：{{ getStatusFilterLabel(filterStatus) }}</view>
      </picker>
      <button class="refresh-btn" @click="loadTasks">刷新</button>
      <text class="source-badge">
        {{ taskListSource === 'cloud' ? 'Cloud' : taskListSource === 'local' ? 'Local' : 'Mock' }}
        <text v-if="taskListFallbackReason"> · fallback</text>
      </text>
    </view>

    <view class="refine-section">
      <view class="section-head">
        <text class="section-title">人工精修工单</text>
        <text class="section-desc">Result 页提交的精修意向会先进入本地 mock 工单池。</text>
      </view>
      <view v-if="refineOrders.length" class="refine-list">
        <view v-for="(order, orderIndex) in refineOrders" :key="getRefineOrderListKey(order, orderIndex)" class="refine-item">
          <text class="card-meta">工单：{{ order.orderId }}</text>
          <text class="card-line">任务：{{ order.taskId || '暂无' }}</text>
          <text class="card-line">类型：{{ getRefineOrderTypeText(order.orderType) }}</text>
          <text class="card-line">状态：{{ getRefineOrderStatusText(order.status) }}</text>
          <text class="card-line">创建：{{ formatTime(order.createdAt) }}</text>
          <text class="card-line">需求：{{ order.requirementText || '暂无补充需求' }}</text>
          <text class="card-line">审计记录：{{ getAuditTrailLength(order) }}</text>
          <view class="refine-actions">
            <button v-if="canAssignRefineOrder(order)" class="mini-btn primary-mini" @click="handleAssignRefineOrder(order)">领取</button>
            <button v-if="canStartRefineOrder(order)" class="mini-btn primary-mini" @click="handleStartRefineOrder(order)">开始处理</button>
            <button v-if="canDeliverRefineOrder(order)" class="mini-btn warning-mini" @click="handleDeliverRefineOrder(order)">上传精修结果占位</button>
            <button v-if="canApproveRefineOrder(order)" class="mini-btn primary-mini" @click="handleApproveRefineOrder(order)">标记客户已确认</button>
            <button v-if="canRejectRefineOrder(order)" class="mini-btn ghost-mini" @click="handleRejectRefineOrder(order)">驳回</button>
            <button v-if="canCancelRefineOrder(order)" class="mini-btn ghost-mini" @click="handleCancelRefineOrder(order)">取消</button>
          </view>
        </view>
      </view>
      <text v-else class="empty-desc">暂无人工精修工单。</text>
    </view>

    <view v-if="visibleTasks.length" class="card-list">
      <view v-for="(task, taskIndex) in visibleTasks" :key="getTaskListKey(task, taskIndex)" class="card">
        <view class="card-top">
          <view>
            <text class="card-title">{{ task.taskType || 'unknown_task' }}</text>
            <text class="card-meta">{{ task.taskId }}</text>
          </view>
          <text class="status-chip">{{ getTaskStatusLabel(task.status) }}</text>
        </view>

        <text class="card-line">来源：{{ task.taskSource || 'miniapp' }}</text>
        <text class="card-line">创建时间：{{ formatTime(task.createdAt) }}</text>
        <text class="card-line">更新时间：{{ formatTime(task.updatedAt) }}</text>
        <text class="card-line">摘要：{{ buildSummary(task) }}</text>

        <view class="actions">
          <button class="primary-btn" @click="viewTask(task)">查看详情</button>
          <button class="ghost-btn" @click="retryTask(task)">重试</button>
        </view>
      </view>
    </view>

    <view v-else class="empty-state">
      <text class="empty-title">暂无任务</text>
      <text class="empty-desc">运行一次主链路后，任务记录会显示在这里。</text>
    </view>
  </view>
</template>

<script>
import { TASK_STATUS, TASK_STATUS_DISPLAY, getTaskStatusLabel } from '../../utils/constants'
import {
  approveRefineWorkOrder,
  assignRefineWorkOrder,
  cancelRefineWorkOrder,
  deliverRefineWorkOrder,
  getAdminTaskList,
  getRefineWorkOrderList,
  rejectRefineWorkOrder,
  retryAdminTask,
  startRefineWorkOrder
} from '../../utils/service/adminRepository'
import { REFINE_ORDER_STATUS, REFINE_ORDER_STATUS_TEXT, REFINE_ORDER_TYPE_TEXT } from '../../utils/constants/refineWorkOrder'

export default {
  data() {
    return {
      tasks: [],
      refineOrders: [],
      filterStatus: 'all',
      taskListSource: 'mock',
      taskListFallbackReason: ''
    }
  },
  onShow() {
    this.loadTasks()
  },
  computed: {
    statusOptions() {
      return [{ value: 'all', label: '全部' }, ...TASK_STATUS_DISPLAY]
    },
    statusFilterLabels() {
      return this.statusOptions.map((item) => item.label)
    },
    statusIndex() {
      const index = this.statusOptions.findIndex((item) => item.value === this.filterStatus)
      return index >= 0 ? index : 0
    },
    visibleTasks() {
      return this.tasks.filter((task) => this.filterStatus === 'all' || task.status === this.filterStatus)
    }
  },
  methods: {
    async loadTasks() {
      const result = await getAdminTaskList({ preferCloud: true })
      this.loadRefineOrders()

      if (Array.isArray(result)) {
        this.tasks = result
        this.taskListSource = 'local'
        this.taskListFallbackReason = ''
        return
      }

      this.tasks = Array.isArray(result && result.data) ? result.data : []
      this.taskListSource = (result && result.source) || 'mock'
      this.taskListFallbackReason = (result && result.fallbackReason) || ''
    },
    loadRefineOrders() {
      this.refineOrders = getRefineWorkOrderList({})
    },
    getRefineOrderListKey(order, index) {
      const orderId = order && (order.orderId || order.id)
      return `${orderId || 'refine_order'}_${index}`
    },
    getTaskListKey(task, index) {
      const taskId = task && (task.taskId || task.id || task.clientTaskId)
      return `${taskId || 'task'}_${index}`
    },
    getRefineOrderTypeText(value) {
      return REFINE_ORDER_TYPE_TEXT[value] || value || '未知类型'
    },
    getRefineOrderStatusText(value) {
      return REFINE_ORDER_STATUS_TEXT[value] || value || '未知状态'
    },
    getAuditTrailLength(order) {
      return Array.isArray(order && order.auditTrail) ? order.auditTrail.length : 0
    },
    canAssignRefineOrder(order) {
      return order && [REFINE_ORDER_STATUS.DRAFT, REFINE_ORDER_STATUS.SUBMITTED].includes(order.status)
    },
    canStartRefineOrder(order) {
      return order && order.status === REFINE_ORDER_STATUS.ASSIGNED
    },
    canDeliverRefineOrder(order) {
      return order && order.status === REFINE_ORDER_STATUS.PROCESSING
    },
    canApproveRefineOrder(order) {
      return order && order.status === REFINE_ORDER_STATUS.DELIVERED
    },
    canRejectRefineOrder(order) {
      return order && order.status === REFINE_ORDER_STATUS.DELIVERED
    },
    canCancelRefineOrder(order) {
      return order && [REFINE_ORDER_STATUS.DRAFT, REFINE_ORDER_STATUS.SUBMITTED, REFINE_ORDER_STATUS.ASSIGNED, REFINE_ORDER_STATUS.PROCESSING].includes(order.status)
    },
    refreshRefineOrdersWithToast(order, title) {
      if (!order) {
        uni.showToast({
          title: '工单不存在',
          icon: 'none'
        })
        return
      }
      this.loadRefineOrders()
      uni.showToast({
        title,
        icon: 'none'
      })
    },
    handleAssignRefineOrder(order) {
      const updatedOrder = assignRefineWorkOrder(order.orderId, {
        designerId: 'designer_mock',
        designerName: 'Mock Designer'
      })
      this.refreshRefineOrdersWithToast(updatedOrder, '已领取')
    },
    handleStartRefineOrder(order) {
      const updatedOrder = startRefineWorkOrder(order.orderId)
      this.refreshRefineOrdersWithToast(updatedOrder, '已开始处理')
    },
    handleDeliverRefineOrder(order) {
      const updatedOrder = deliverRefineWorkOrder(order.orderId, {
        deliverableUrl: `mock_refine_deliverable_${Date.now()}`,
        note: '后台占位交付'
      })
      this.refreshRefineOrdersWithToast(updatedOrder, '已标记交付')
    },
    handleApproveRefineOrder(order) {
      const updatedOrder = approveRefineWorkOrder(order.orderId)
      this.refreshRefineOrdersWithToast(updatedOrder, '客户已确认')
    },
    handleRejectRefineOrder(order) {
      const updatedOrder = rejectRefineWorkOrder(order.orderId, '客户要求继续修改')
      this.refreshRefineOrdersWithToast(updatedOrder, '已驳回')
    },
    handleCancelRefineOrder(order) {
      const updatedOrder = cancelRefineWorkOrder(order.orderId, '后台取消工单')
      this.refreshRefineOrdersWithToast(updatedOrder, '已取消')
    },
    onStatusChange(event) {
      const index = Number(event.detail.value)
      this.filterStatus = (this.statusOptions[index] && this.statusOptions[index].value) || 'all'
    },
    getTaskStatusLabel,
    getStatusFilterLabel(value) {
      if (value === 'all') {
        return '全部'
      }
      return this.getTaskStatusLabel(value)
    },
    buildSummary(task) {
      if (task && task.summary) {
        return task.summary
      }
      if (task && task.result && task.result.imageUrl) {
        return '结果图已生成'
      }
      if (task && task.input && task.input.prompt) {
        return `提示词：${task.input.prompt}`
      }
      return '暂无摘要'
    },
    formatTime(value) {
      return value ? String(value).replace('T', ' ').replace('.000Z', '') : '暂无'
    },
    viewTask(task) {
      if (!task || !task.taskId) {
        return
      }

      if (task.isMock) {
        uni.showToast({
          title: '演示任务暂无详情',
          icon: 'none'
        })
        return
      }

      uni.navigateTo({
        url: `/package-ai/result/result?taskId=${encodeURIComponent(task.taskId)}`
      })
    },
    retryTask(task) {
      if (task && task.taskId) {
        retryAdminTask(task.taskId)
        this.loadTasks()
      }
      uni.showToast({
        title: task && task.taskId ? '重试占位已触发' : '任务缺失',
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
.refine-section,
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
  align-items: center;
  flex-wrap: wrap;
}

.filter-chip {
  padding: 12rpx 18rpx;
  border-radius: 999rpx;
  background: #eef5ff;
  color: #1677ff;
  font-size: 24rpx;
}

.refresh-btn {
  margin: 0;
  border-radius: 16rpx;
  background: #f5f5f5;
  color: #333;
  font-size: 24rpx;
}

.source-badge {
  padding: 10rpx 16rpx;
  border-radius: 999rpx;
  background: #f4f6f8;
  color: #666;
  font-size: 22rpx;
}

.section-head {
  margin-bottom: 14rpx;
}

.section-title {
  display: block;
  font-size: 30rpx;
  font-weight: 600;
  color: #222;
}

.section-desc {
  display: block;
  margin-top: 8rpx;
  font-size: 23rpx;
  color: #666;
}

.refine-list {
  display: flex;
  flex-direction: column;
  gap: 14rpx;
}

.refine-item {
  border-radius: 16rpx;
  background: #f8fbff;
  padding: 18rpx;
}

.refine-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
  margin-top: 16rpx;
}

.mini-btn {
  margin: 0;
  min-width: 140rpx;
  height: 58rpx;
  line-height: 58rpx;
  border-radius: 12rpx;
  font-size: 22rpx;
  border: none;
}

.primary-mini {
  background: #1677ff;
  color: #fff;
}

.warning-mini {
  background: #fff7e6;
  color: #d46b08;
  border: 1rpx solid #ffd591;
}

.ghost-mini {
  background: #f5f5f5;
  color: #333;
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
  color: #555;
  word-break: break-all;
}

.status-chip {
  padding: 10rpx 18rpx;
  border-radius: 999rpx;
  background: #e6f4ff;
  color: #1677ff;
  font-size: 22rpx;
}

.actions {
  display: flex;
  gap: 12rpx;
  margin-top: 18rpx;
}

.primary-btn,
.ghost-btn {
  flex: 1;
  border-radius: 16rpx;
  font-size: 24rpx;
}

.primary-btn {
  background: #1677ff;
  color: #fff;
}

.ghost-btn {
  background: #f5f5f5;
  color: #333;
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
  margin-top: 12rpx;
  font-size: 24rpx;
  color: #888;
}
</style>
