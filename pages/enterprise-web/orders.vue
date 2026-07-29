<template>
  <view class="enterprise-page">
    <!-- #ifdef H5 -->
    <view class="shell">
      <view class="sidebar">
        <view class="brand">
          <text class="brand-title">{{ labels.brand }}</text>
          <text class="brand-desc">{{ labels.brandDesc }}</text>
        </view>
        <view class="menu">
          <view v-for="item in menu" :key="item.key" :class="['menu-item', item.key === 'orders' ? 'active' : '']" @click="goTo(item)">
            <text class="menu-icon">{{ item.icon }}</text>
            <text>{{ item.label }}</text>
          </view>
        </view>
      </view>
      <view class="main">
        <view class="topbar">
          <view>
            <text class="page-title">{{ labels.pageTitle }}</text>
            <text class="page-desc">{{ labels.pageDesc }}</text>
          </view>
        </view>

        <view v-if="pageState === 'loading'" class="state-card">{{ labels.loading }}</view>
        <view v-else-if="pageState === 'forbidden'" class="state-card denied">{{ guardMessage }}</view>
        <view v-else-if="pageState === 'error'" class="state-card denied">{{ labels.error }}</view>
        <view v-else>
          <view class="filterbar">
            <input v-model="keyword" class="filter-input" :placeholder="labels.searchPlaceholder" />
            <picker :range="statusOptions" range-key="label" @change="handleStatusChange">
              <view class="filter-select">{{ currentStatusLabel }}</view>
            </picker>
            <input v-model="minAmount" class="amount-input" type="number" :placeholder="labels.minAmount" />
            <input v-model="maxAmount" class="amount-input" type="number" :placeholder="labels.maxAmount" />
          </view>

          <view class="table-card">
            <view class="table-head row">
              <text>{{ labels.orderId }}</text>
              <text>{{ labels.sourceQuote }}</text>
              <text>{{ labels.customer }}</text>
              <text>{{ labels.project }}</text>
              <text>{{ labels.amount }}</text>
              <text>{{ labels.status }}</text>
              <text>{{ labels.delivery }}</text>
              <text>{{ labels.createdAt }}</text>
              <text>{{ labels.action }}</text>
            </view>
            <view v-if="filteredOrders.length">
              <view v-for="order in filteredOrders" :key="order.orderId" class="row data-row">
                <text class="strong" @click="openDetail(order)">{{ order.orderId }}</text>
                <text>{{ order.sourceQuoteId || '--' }}</text>
                <text>{{ order.customer || order.customerName || '--' }}</text>
                <text>{{ getProjectName(order.projectId) }}</text>
                <text>{{ formatMoney(order.amount) }}</text>
                <text><text class="status-tag">{{ getOrderStatusLabel(order.status) }}</text></text>
                <text><text class="status-tag">{{ getDeliveryLabel(order) }}</text></text>
                <text>{{ formatTime(order.createdAt || order.updatedAt) }}</text>
                <view class="actions">
                  <button class="mini-btn" @click="openDetail(order)">{{ labels.view }}</button>
                  <button class="mini-btn" @click="openProject(order)">{{ labels.viewProject }}</button>
                  <button v-if="canViewDelivery && getOrderDelivery(order)" class="mini-btn" @click="openDelivery(order)">{{ labels.viewDelivery }}</button>
                  <button v-if="canManageDelivery && !getOrderDelivery(order)" class="mini-btn" @click="createDelivery(order)">{{ labels.createDelivery }}</button>
                </view>
              </view>
            </view>
            <view v-else class="empty">{{ labels.empty }}</view>
          </view>
        </view>
      </view>
    </view>
    <!-- #endif -->
    <!-- #ifndef H5 -->
    <view class="platform-tip">{{ labels.h5Only }}</view>
    <!-- #endif -->
  </view>
</template>

<script>
import { getList as getProjects } from '../../utils/repository/projectRepository.js'
import { buildEnterpriseWebUrl } from '../../utils/enterprise-web/enterpriseWebRoutes.js'
import { canAccessTenantRecord, getEnterpriseGuardMessage, requirePermission } from '../../utils/enterprise-web/enterpriseWebGuard.js'
import { PERMISSION_KEYS } from '../../utils/permission/permissionCatalog.js'
import { getOrders } from '../../utils/service/orderService.js'
import { createDeliveryFromOrder, listDeliveries } from '../../utils/service/deliveryService.js'
import { getEnterpriseWebMenu } from '../../utils/enterprise-web/enterpriseWebMenu.js'
import { getDeliveryStatusLabel } from '../../utils/delivery/deliveryStatus.js'

const LABELS = Object.freeze({
  brand: '\u8776\u53d8',
  brandDesc: '\u4f01\u4e1a\u7ecf\u8425\u95ed\u73af',
  pageTitle: '\u8ba2\u5355\u7ba1\u7406',
  pageDesc: '\u8ba2\u5355\u7531\u62a5\u4ef7\u786e\u8ba4\u4e8b\u4ef6\u94fe\u5e42\u7b49\u751f\u6210\uff0c\u5e76\u4fdd\u7559\u5173\u8054\u9879\u76ee\u3002',
  loading: '\u52a0\u8f7d\u8ba2\u5355\u4e2d...',
  error: '\u52a0\u8f7d\u5931\u8d25',
  h5Only: '\u4f01\u4e1a\u7f51\u9875\u7248\u4ec5\u5728 H5 \u5e73\u53f0\u663e\u793a\u3002',
  searchPlaceholder: '\u641c\u7d22\u8ba2\u5355\u3001\u5ba2\u6237\u3001\u9879\u76ee\u6216\u62a5\u4ef7',
  allStatuses: '\u5168\u90e8\u72b6\u6001',
  minAmount: '\u6700\u5c0f\u91d1\u989d',
  maxAmount: '\u6700\u5927\u91d1\u989d',
  orderId: '\u8ba2\u5355 ID',
  sourceQuote: '\u6765\u6e90\u62a5\u4ef7',
  customer: '\u5ba2\u6237',
  project: '\u5173\u8054\u9879\u76ee',
  amount: '\u91d1\u989d',
  status: '\u72b6\u6001',
  delivery: '\u4ea4\u4ed8',
  createdAt: '\u521b\u5efa\u65f6\u95f4',
  action: '\u64cd\u4f5c',
  view: '\u67e5\u770b\u8ba2\u5355',
  viewProject: '\u67e5\u770b\u9879\u76ee',
  viewDelivery: '\u67e5\u770b\u4ea4\u4ed8',
  createDelivery: '\u521b\u5efa\u4ea4\u4ed8\u5355',
  deliveryNone: '\u672a\u521b\u5efa',
  deliveryCreateSuccess: '\u4ea4\u4ed8\u5355\u5df2\u521b\u5efa',
  deliveryCreateFailed: '\u4ea4\u4ed8\u5355\u521b\u5efa\u5931\u8d25',
  empty: '\u6682\u65e0\u8ba2\u5355\u6570\u636e'
})

const STATUS_OPTIONS = Object.freeze([
  { label: LABELS.allStatuses, value: '' },
  { label: '\u5f85\u5904\u7406', value: 'pending_payment' },
  { label: '\u5904\u7406\u4e2d', value: 'processing' },
  { label: '\u5df2\u5b8c\u6210', value: 'completed' },
  { label: '\u5df2\u5173\u95ed', value: 'closed' }
])

const ORDER_STATUS_LABELS = Object.freeze({
  pending_payment: '\u5f85\u5904\u7406',
  processing: '\u5904\u7406\u4e2d',
  completed: '\u5df2\u5b8c\u6210',
  closed: '\u5df2\u5173\u95ed'
})

export default {
  data() {
    return {
      labels: LABELS,
      menu: getEnterpriseWebMenu(),
      guard: requirePermission(PERMISSION_KEYS.ORDER_VIEW),
      manageGuard: requirePermission(PERMISSION_KEYS.ORDER_MANAGE),
      deliveryViewGuard: requirePermission(PERMISSION_KEYS.DELIVERY_VIEW),
      deliveryManageGuard: requirePermission(PERMISSION_KEYS.DELIVERY_MANAGE),
      pageState: 'loading',
      orders: [],
      deliveries: [],
      projects: [],
      projectId: '',
      keyword: '',
      status: '',
      statusGroup: '',
      minAmount: '',
      maxAmount: '',
      statusOptions: STATUS_OPTIONS
    }
  },
  computed: {
    guardMessage() {
      return getEnterpriseGuardMessage(this.guard.reason)
    },
    canViewDelivery() {
      return this.deliveryViewGuard.allowed
    },
    canManageDelivery() {
      return this.deliveryManageGuard.allowed
    },
    currentStatusLabel() {
      return (this.statusOptions.find((item) => item.value === this.status) || this.statusOptions[0]).label
    },
    filteredOrders() {
      const keyword = String(this.keyword || '').trim().toLowerCase()
      const min = this.minAmount === '' ? null : Number(this.minAmount)
      const max = this.maxAmount === '' ? null : Number(this.maxAmount)
      return this.orders.filter((order) => {
        const amount = Number(order.amount || 0)
        const projectName = this.getProjectName(order.projectId)
        const textMatched = !keyword || [order.orderId, order.sourceQuoteId, order.customer, order.customerName, projectName]
          .some((value) => String(value || '').toLowerCase().includes(keyword))
        const groupMatched = this.statusGroup !== 'active' || ['pending_payment', 'processing'].includes(order.status)
        return textMatched &&
          groupMatched &&
          (!this.projectId || order.projectId === this.projectId) &&
          (!this.status || order.status === this.status) &&
          (min === null || amount >= min) &&
          (max === null || amount <= max)
      })
    }
  },
  onLoad(options = {}) {
    this.status = options.status || ''
    this.statusGroup = options.statusGroup || ''
    this.keyword = options.keyword || ''
    this.projectId = options.projectId || ''
  },
  onShow() {
    this.refresh()
  },
  methods: {
    async refresh() {
      this.guard = requirePermission(PERMISSION_KEYS.ORDER_VIEW)
      this.manageGuard = requirePermission(PERMISSION_KEYS.ORDER_MANAGE)
      this.deliveryViewGuard = requirePermission(PERMISSION_KEYS.DELIVERY_VIEW)
      this.deliveryManageGuard = requirePermission(PERMISSION_KEYS.DELIVERY_MANAGE)
      this.menu = getEnterpriseWebMenu()
      if (!this.guard.allowed) {
        this.pageState = 'forbidden'
        return
      }
      try {
        this.pageState = 'loading'
        this.projects = getProjects()
        this.orders = getOrders().filter((order) => canAccessTenantRecord(order, PERMISSION_KEYS.ORDER_VIEW).allowed)
        this.deliveries = this.canViewDelivery ? await listDeliveries() : []
        this.pageState = 'ready'
        this.logFlow('load', true)
      } catch (error) {
        this.pageState = 'error'
        this.logFlow('load', false, error && error.code)
      }
    },
    logFlow(action = '', success = false, errorCode = '', entityId = '') {
      if (typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'production') return
      console.log('[enterprise-order:page]', { entityId, action, success: Boolean(success), errorCode: errorCode || '' })
    },
    goTo(item = {}) {
      if (item.route && item.key !== 'orders') uni.navigateTo({ url: item.route })
    },
    handleStatusChange(event) {
      this.status = this.statusOptions[Number(event.detail.value) || 0].value
    },
    openDetail(order = {}) {
      if (!order.orderId) return
      uni.navigateTo({ url: buildEnterpriseWebUrl('orderDetail', { orderId: order.orderId }) })
    },
    openProject(order = {}) {
      if (!order.projectId) return
      uni.navigateTo({ url: buildEnterpriseWebUrl('projectDetail', { projectId: order.projectId }) })
    },
    getOrderDelivery(order = {}) {
      return this.deliveries.find((item) => item.orderId === order.orderId || item.deliveryId === order.deliveryId) || null
    },
    getDeliveryLabel(order = {}) {
      const delivery = this.getOrderDelivery(order)
      return delivery ? getDeliveryStatusLabel(delivery.status) : this.labels.deliveryNone
    },
    openDelivery(order = {}) {
      const delivery = this.getOrderDelivery(order)
      if (!delivery) return
      uni.navigateTo({ url: buildEnterpriseWebUrl('deliveryDetail', { deliveryId: delivery.deliveryId }) })
    },
    async createDelivery(order = {}) {
      if (!this.canManageDelivery || !order.orderId) return
      const result = await createDeliveryFromOrder(order.orderId, {
        idempotencyKey: `delivery_from_order_${order.orderId}_${Date.now()}`
      })
      if (!result || !result.success) {
        uni.showToast({ title: result?.message || this.labels.deliveryCreateFailed, icon: 'none' })
        return
      }
      uni.showToast({ title: this.labels.deliveryCreateSuccess, icon: 'none' })
      await this.refresh()
    },
    getProjectName(projectId = '') {
      const project = this.projects.find((item) => item.projectId === projectId)
      return project ? (project.name || project.title || project.projectName || project.projectId) : (projectId || '--')
    },
    getOrderStatusLabel(status = '') {
      return ORDER_STATUS_LABELS[status] || ORDER_STATUS_LABELS.pending_payment
    },
    formatMoney(value) {
      return `\u00a5${Number(value || 0).toFixed(0)}`
    },
    formatTime(value = '') {
      return value ? String(value).slice(0, 16).replace('T', ' ') : '--'
    }
  }
}
</script>

<style scoped>
.enterprise-page { min-height: 100vh; background: #f4f6fb; color: #172033; }
.shell { display: flex; min-height: 100vh; }
.sidebar { position: fixed; left: 0; top: 0; bottom: 0; width: 216px; padding: 24px 16px; background: #101828; color: #fff; box-sizing: border-box; }
.brand { margin-bottom: 28px; }
.brand-title { display: block; font-size: 22px; font-weight: 800; }
.brand-desc { display: block; margin-top: 6px; color: #a9b4ca; font-size: 12px; }
.menu-item { display: flex; align-items: center; gap: 10px; padding: 12px; border-radius: 10px; color: #cbd5e1; font-size: 14px; cursor: pointer; }
.menu-item.active, .menu-item:hover { background: #eef2ff; color: #4f46e5; }
.menu-icon { width: 24px; height: 24px; border-radius: 8px; background: rgba(255,255,255,0.1); text-align: center; line-height: 24px; font-size: 12px; }
.main { flex: 1; margin-left: 216px; padding: 24px; box-sizing: border-box; min-width: 0; }
.topbar, .filterbar, .table-card, .state-card { background: #fff; border: 1px solid #e5e7eb; border-radius: 16px; box-shadow: 0 18px 40px rgba(15,23,42,0.05); }
.topbar { padding: 20px 24px; margin-bottom: 18px; }
.page-title { display: block; font-size: 24px; font-weight: 800; }
.page-desc { display: block; margin-top: 6px; color: #64748b; font-size: 13px; }
.filterbar { display: flex; gap: 12px; padding: 14px; margin-bottom: 14px; }
.filter-input, .filter-select, .amount-input { height: 38px; padding: 0 12px; border-radius: 10px; background: #f8fafc; border: 1px solid #e2e8f0; font-size: 14px; box-sizing: border-box; }
.filter-input { flex: 1; }
.amount-input { width: 120px; }
.table-card { overflow-x: auto; }
.row { min-width: 1160px; display: grid; grid-template-columns: 1.2fr 1fr 1fr 1fr 0.8fr 0.8fr 0.9fr 1fr 1.6fr; gap: 12px; align-items: center; padding: 14px 18px; font-size: 13px; }
.table-head { color: #64748b; background: #f8fafc; font-weight: 700; }
.data-row { border-top: 1px solid #eef2f7; }
.strong { font-weight: 800; cursor: pointer; }
.status-tag { display: inline-block; padding: 4px 8px; border-radius: 999px; background: #eef2ff; color: #4f46e5; }
.actions { display: flex; gap: 6px; flex-wrap: wrap; }
.mini-btn { min-width: 72px; height: 28px; line-height: 28px; border-radius: 8px; background: #f1f5f9; color: #334155; font-size: 12px; }
.empty, .state-card, .platform-tip { padding: 24px; color: #64748b; }
.denied { color: #b42318; }
@media (max-width: 900px) {
  .shell { display: block; }
  .sidebar { position: static; width: auto; }
  .main { margin-left: 0; padding: 16px; }
  .filterbar { display: block; }
  .filter-input, .filter-select, .amount-input { width: 100%; margin-top: 10px; }
}
</style>

