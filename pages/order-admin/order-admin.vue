<template>
  <view class="container">
    <view class="header">
      <text class="title">订单管理</text>
      <text class="subtitle">套餐订单与服务订单</text>
    </view>

    <view class="toolbar">
      <picker :range="orderStatusLabels" :value="orderStatusIndex" @change="onOrderStatusFilterChange">
        <view class="filter-chip">订单：{{ getOrderStatusFilterLabel(filterOrderStatus) }}</view>
      </picker>
      <picker :range="payStatusLabels" :value="payStatusIndex" @change="onPayStatusFilterChange">
        <view class="filter-chip">支付：{{ getPayStatusFilterLabel(filterPayStatus) }}</view>
      </picker>
    </view>

    <view v-if="visibleOrders.length" class="card-list">
      <view v-for="order in visibleOrders" :key="order.orderId" class="card">
        <view class="card-top">
          <view>
            <text class="card-title">{{ order.orderType || 'package_purchase' }}</text>
            <text class="card-meta">{{ order.orderId }}</text>
          </view>
          <text class="status-chip">{{ getOrderStatusLabel(order.orderStatus) }}</text>
        </view>

        <text class="card-line">购买人：{{ order.buyerName || '暂无' }}</text>
        <text class="card-line">支付状态：{{ getPayStatusLabel(order.payStatus) }}</text>
        <text class="card-line">支付渠道：{{ order.payChannel || 'wechat' }}</text>
        <text class="card-line">金额：{{ formatAmount(order.amount) }}</text>
        <text class="card-line">创建时间：{{ formatTime(order.createdAt) }}</text>

        <view class="actions">
          <button class="primary-btn" @click="viewOrder(order)">查看详情</button>
          <button class="ghost-btn" @click="confirmOrder(order)">标记确认</button>
        </view>
      </view>
    </view>

    <view v-else class="empty-state">
      <text class="empty-title">暂无订单</text>
      <text class="empty-desc">套餐或服务订单会显示在这里。</text>
    </view>

    <view v-if="selectedOrder" class="detail-card">
      <text class="detail-title">订单详情</text>
      <text class="card-line">订单编号：{{ selectedOrder.orderId }}</text>
      <text class="card-line">类型：{{ selectedOrder.orderType }}</text>
      <text class="card-line">订单状态：{{ getOrderStatusLabel(selectedOrder.orderStatus) }}</text>
      <text class="card-line">支付状态：{{ getPayStatusLabel(selectedOrder.payStatus) }}</text>
      <text class="card-line">套餐：{{ selectedOrder.packageType || '暂无' }}</text>
    </view>
  </view>
</template>

<script>
import {
  ORDER_STATUS,
  ORDER_STATUS_DISPLAY,
  PAY_STATUS,
  PAY_STATUS_DISPLAY,
  getOrderStatusLabel,
  getPayStatusLabel
} from '../../utils/constants'
import { getAdminOrderList, updateAdminOrder } from '../../utils/service/adminRepository'

export default {
  data() {
    return {
      orders: [],
      selectedOrder: null,
      filterOrderStatus: 'all',
      filterPayStatus: 'all'
    }
  },
  onShow() {
    this.loadOrders()
  },
  computed: {
    orderStatusOptions() {
      return [{ value: 'all', label: '全部' }, ...ORDER_STATUS_DISPLAY]
    },
    payStatusOptions() {
      return [{ value: 'all', label: '全部' }, ...PAY_STATUS_DISPLAY]
    },
    orderStatusLabels() {
      return this.orderStatusOptions.map((item) => item.label)
    },
    payStatusLabels() {
      return this.payStatusOptions.map((item) => item.label)
    },
    orderStatusIndex() {
      const index = this.orderStatusOptions.findIndex((item) => item.value === this.filterOrderStatus)
      return index >= 0 ? index : 0
    },
    payStatusIndex() {
      const index = this.payStatusOptions.findIndex((item) => item.value === this.filterPayStatus)
      return index >= 0 ? index : 0
    },
    visibleOrders() {
      return this.orders.filter((order) => {
        if (this.filterOrderStatus !== 'all' && order.orderStatus !== this.filterOrderStatus) {
          return false
        }
        if (this.filterPayStatus !== 'all' && order.payStatus !== this.filterPayStatus) {
          return false
        }
        return true
      })
    }
  },
  methods: {
    loadOrders() {
      this.orders = getAdminOrderList()
      if (this.selectedOrder) {
        this.selectedOrder = this.orders.find((item) => item.orderId === this.selectedOrder.orderId) || null
      }
    },
    onOrderStatusFilterChange(event) {
      const index = Number(event.detail.value)
      this.filterOrderStatus = (this.orderStatusOptions[index] && this.orderStatusOptions[index].value) || 'all'
    },
    onPayStatusFilterChange(event) {
      const index = Number(event.detail.value)
      this.filterPayStatus = (this.payStatusOptions[index] && this.payStatusOptions[index].value) || 'all'
    },
    getOrderStatusLabel,
    getPayStatusLabel,
    getOrderStatusFilterLabel(value) {
      if (value === 'all') {
        return '全部'
      }
      return this.getOrderStatusLabel(value)
    },
    getPayStatusFilterLabel(value) {
      if (value === 'all') {
        return '全部'
      }
      return this.getPayStatusLabel(value)
    },
    formatTime(value) {
      return value ? String(value).replace('T', ' ').replace('.000Z', '') : '暂无'
    },
    formatAmount(amount) {
      const normalized = Number(amount || 0)
      return `￥${(normalized / 100).toFixed(2)}`
    },
    viewOrder(order) {
      this.selectedOrder = order
    },
    confirmOrder(order) {
      updateAdminOrder(order.orderId, {
        orderStatus: ORDER_STATUS.CONFIRMED,
        payStatus: order.payStatus === PAY_STATUS.UNPAID ? PAY_STATUS.PAID : order.payStatus
      })
      this.loadOrders()
      uni.showToast({
        title: '订单已更新',
        icon: 'success'
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
.detail-card,
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

.filter-chip {
  padding: 12rpx 18rpx;
  border-radius: 999rpx;
  background: #fff7e6;
  color: #fa8c16;
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
  color: #555;
  word-break: break-all;
}

.status-chip {
  padding: 10rpx 18rpx;
  border-radius: 999rpx;
  background: #fff7e6;
  color: #fa8c16;
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
  background: #fa8c16;
  color: #fff;
}

.ghost-btn {
  background: #f5f5f5;
  color: #333;
}

.detail-title,
.empty-title {
  display: block;
  font-size: 30rpx;
  font-weight: 600;
  color: #222;
}

.empty-state {
  text-align: center;
}

.empty-desc {
  display: block;
  margin-top: 12rpx;
  font-size: 24rpx;
  color: #888;
}
</style>
