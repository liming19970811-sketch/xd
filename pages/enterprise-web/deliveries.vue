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
          <view v-for="item in menu" :key="item.key" :class="['menu-item', item.key === 'deliveries' ? 'active' : '']" @click="goTo(item)">
            <text class="menu-icon">{{ item.icon }}</text>
            <text>{{ item.label }}</text>
          </view>
        </view>
      </view>

      <view class="main">
        <view class="topbar">
          <view>
            <text class="page-title">{{ labels.title }}</text>
            <text class="page-desc">{{ labels.desc }}</text>
          </view>
        </view>

        <view v-if="pageState === 'loading'" class="state-card">{{ labels.loading }}</view>
        <view v-else-if="pageState === 'forbidden'" class="state-card denied">{{ guardMessage }}</view>
        <view v-else-if="pageState === 'error'" class="state-card denied">{{ errorMessage }}</view>
        <view v-else>
          <view class="metric-grid">
            <view v-for="metric in metrics" :key="metric.key" class="metric-card" @click="status = metric.status">
              <text>{{ metric.label }}</text>
              <text>{{ metric.value }}</text>
            </view>
          </view>

          <view class="filterbar">
            <picker :range="statusOptions" range-key="label" @change="handleStatusChange">
              <view class="filter-select">{{ currentStatusLabel }}</view>
            </picker>
            <input v-model="projectKeyword" class="filter-input" :placeholder="labels.searchPlaceholder" />
          </view>

          <view class="table-card">
            <view class="table-head row">
              <text>{{ labels.deliveryId }}</text>
              <text>{{ labels.project }}</text>
              <text>{{ labels.order }}</text>
              <text>{{ labels.status }}</text>
              <text>{{ labels.itemCount }}</text>
              <text>{{ labels.updatedAt }}</text>
              <text>{{ labels.action }}</text>
            </view>
            <view v-if="filteredDeliveries.length">
              <view v-for="delivery in filteredDeliveries" :key="delivery.deliveryId" class="row data-row" @click="openDetail(delivery)">
                <text class="strong">{{ delivery.deliveryId }}</text>
                <text>{{ delivery.projectId || '--' }}</text>
                <text>{{ delivery.orderId || '--' }}</text>
                <text><text class="status-tag">{{ getDeliveryStatusLabel(delivery.status) }}</text></text>
                <text>{{ delivery.itemCount || 0 }}</text>
                <text>{{ formatTime(delivery.updatedAt || delivery.createdAt) }}</text>
                <view class="actions" @click.stop>
                  <button class="mini-btn" @click="openDetail(delivery)">{{ labels.viewDelivery }}</button>
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
import { buildEnterpriseWebUrl } from '../../utils/enterprise-web/enterpriseWebRoutes.js'
import { getEnterpriseGuardMessage, requirePermission } from '../../utils/enterprise-web/enterpriseWebGuard.js'
import { PERMISSION_KEYS } from '../../utils/permission/permissionCatalog.js'
import { getDeliveryDashboard, listDeliveries } from '../../utils/service/deliveryService.js'
import { getDeliveryStatusLabel } from '../../utils/delivery/deliveryStatus.js'
import { getEnterpriseWebMenu } from '../../utils/enterprise-web/enterpriseWebMenu.js'

const STATUS_OPTIONS = Object.freeze([
  { label: '\u5168\u90e8\u72b6\u6001', value: '' },
  { label: '\u51c6\u5907\u4e2d', value: 'preparing' },
  { label: '\u5f85\u63d0\u4ea4\u5ba1\u6838', value: 'submitted' },
  { label: '\u5ba1\u6838\u4e2d', value: 'reviewing' },
  { label: '\u5f85\u5ba2\u6237\u786e\u8ba4', value: 'approved' },
  { label: '\u5ba2\u6237\u5df2\u786e\u8ba4', value: 'customer_confirmed' },
  { label: '\u5df2\u5b8c\u6210', value: 'completed' },
  { label: '\u5df2\u9a73\u56de', value: 'rejected' }
])

const LABELS = Object.freeze({
  brand: '\u8776\u53d8',
  brandDesc: '\u4f01\u4e1a\u7ecf\u8425\u95ed\u73af',
  title: '\u4ea4\u4ed8\u4e2d\u5fc3',
  desc: '\u8ba2\u5355\u4ea4\u4ed8\u3001\u5ba1\u6838\u548c\u5ba2\u6237\u786e\u8ba4\u7684\u7edf\u4e00\u5904\u7406\u961f\u5217\u3002',
  loading: '\u52a0\u8f7d\u4ea4\u4ed8\u4e2d...',
  searchPlaceholder: '\u9879\u76ee / \u8ba2\u5355\u7b5b\u9009',
  deliveryId: '\u4ea4\u4ed8\u7f16\u53f7',
  project: '\u9879\u76ee',
  order: '\u8ba2\u5355',
  status: '\u72b6\u6001',
  itemCount: '\u5185\u5bb9\u6570',
  updatedAt: '\u66f4\u65b0\u65f6\u95f4',
  action: '\u64cd\u4f5c',
  viewDelivery: '\u67e5\u770b\u4ea4\u4ed8',
  empty: '\u6682\u65e0\u4ea4\u4ed8\u8bb0\u5f55',
  loadFailed: '\u4ea4\u4ed8\u52a0\u8f7d\u5931\u8d25',
  h5Only: '\u4f01\u4e1a\u7f51\u9875\u7248\u4ec5\u5728 H5 \u5e73\u53f0\u663e\u793a\u3002',
  metricPreparing: '\u5f85\u51c6\u5907',
  metricSubmitted: '\u5f85\u63d0\u4ea4',
  metricReviewing: '\u5f85\u5ba1\u6838',
  metricApproved: '\u5f85\u5ba2\u6237\u786e\u8ba4',
  metricCompleted: '\u5df2\u5b8c\u6210',
  metricRejected: '\u5df2\u9a73\u56de'
})

export default {
  data() {
    return {
      labels: LABELS,
      menu: getEnterpriseWebMenu(),
      guard: requirePermission(PERMISSION_KEYS.DELIVERY_VIEW),
      pageState: 'loading',
      errorMessage: '',
      deliveries: [],
      summary: {},
      status: '',
      projectKeyword: '',
      statusOptions: STATUS_OPTIONS
    }
  },
  computed: {
    guardMessage() {
      return getEnterpriseGuardMessage(this.guard.reason)
    },
    currentStatusLabel() {
      return (this.statusOptions.find((item) => item.value === this.status) || this.statusOptions[0]).label
    },
    metrics() {
      return [
        { key: 'preparing', label: this.labels.metricPreparing, status: 'preparing', value: this.summary.preparing || 0 },
        { key: 'submitted', label: this.labels.metricSubmitted, status: 'submitted', value: this.summary.submitted || 0 },
        { key: 'reviewing', label: this.labels.metricReviewing, status: 'reviewing', value: this.summary.reviewing || 0 },
        { key: 'approved', label: this.labels.metricApproved, status: 'approved', value: this.summary.approved || 0 },
        { key: 'completed', label: this.labels.metricCompleted, status: 'completed', value: this.summary.completed || 0 },
        { key: 'rejected', label: this.labels.metricRejected, status: 'rejected', value: this.summary.rejected || 0 }
      ]
    },
    filteredDeliveries() {
      const keyword = String(this.projectKeyword || '').trim().toLowerCase()
      return this.deliveries
        .filter((delivery) => !this.status || delivery.status === this.status)
        .filter((delivery) => {
          if (!keyword) return true
          return [delivery.projectId, delivery.orderId, delivery.deliveryId].some((value) => String(value || '').toLowerCase().includes(keyword))
        })
    }
  },
  onLoad(options = {}) {
    this.status = options.status || ''
    this.projectKeyword = options.projectId || options.orderId || ''
  },
  onShow() {
    this.refresh()
  },
  methods: {
    async refresh() {
      this.guard = requirePermission(PERMISSION_KEYS.DELIVERY_VIEW)
      this.menu = getEnterpriseWebMenu()
      if (!this.guard.allowed) {
        this.pageState = 'forbidden'
        return
      }
      try {
        this.pageState = 'loading'
        const dashboard = await getDeliveryDashboard()
        if (dashboard && dashboard.success) this.summary = dashboard.summary || {}
        this.deliveries = await listDeliveries()
        this.pageState = 'ready'
      } catch (error) {
        this.errorMessage = error && error.message ? error.message : this.labels.loadFailed
        this.pageState = 'error'
      }
    },
    goTo(item = {}) {
      if (item.route && item.key !== 'deliveries') uni.navigateTo({ url: item.route })
    },
    handleStatusChange(event) {
      this.status = this.statusOptions[Number(event.detail.value) || 0].value
    },
    openDetail(delivery = {}) {
      if (!delivery.deliveryId) return
      uni.navigateTo({ url: buildEnterpriseWebUrl('deliveryDetail', { deliveryId: delivery.deliveryId }) })
    },
    getDeliveryStatusLabel,
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
.menu-item.active,.menu-item:hover { background: #eef2ff; color: #4f46e5; }
.menu-icon { width: 24px; height: 24px; border-radius: 8px; background: rgba(255,255,255,0.1); text-align: center; line-height: 24px; font-size: 12px; }
.main { flex: 1; margin-left: 216px; padding: 24px; box-sizing: border-box; }
.topbar,.filterbar,.table-card,.state-card,.metric-card { background: #fff; border: 1px solid #e5e7eb; border-radius: 16px; box-shadow: 0 18px 40px rgba(15,23,42,0.05); }
.topbar { padding: 20px 24px; margin-bottom: 18px; }
.page-title { display: block; font-size: 24px; font-weight: 800; }
.page-desc { display: block; margin-top: 6px; color: #64748b; font-size: 13px; }
.metric-grid { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 12px; margin-bottom: 14px; }
.metric-card { padding: 16px; cursor: pointer; }
.metric-card text { display: block; color: #64748b; font-size: 13px; }
.metric-card text + text { margin-top: 8px; color: #111827; font-size: 24px; font-weight: 800; }
.filterbar { display: flex; gap: 12px; padding: 14px; margin-bottom: 14px; }
.filter-input,.filter-select { height: 38px; padding: 0 12px; border-radius: 10px; background: #f8fafc; border: 1px solid #e2e8f0; font-size: 14px; box-sizing: border-box; }
.filter-input { flex: 1; }
.table-card { overflow-x: auto; }
.row { min-width: 920px; display: grid; grid-template-columns: 1.2fr 1fr 1fr 0.9fr 0.6fr 1fr 0.9fr; gap: 12px; align-items: center; padding: 14px 18px; font-size: 13px; }
.table-head { color: #64748b; background: #f8fafc; font-weight: 700; }
.data-row { border-top: 1px solid #eef2f7; cursor: pointer; }
.strong { font-weight: 800; }
.status-tag { display: inline-block; padding: 4px 8px; border-radius: 999px; background: #eef2ff; color: #4f46e5; }
.mini-btn { min-width: 72px; height: 28px; line-height: 28px; border-radius: 8px; background: #f1f5f9; color: #334155; font-size: 12px; }
.empty,.state-card,.platform-tip { padding: 24px; color: #64748b; }
.denied { color: #b42318; }
@media (max-width: 900px) {
  .shell { display: block; }
  .sidebar { position: static; width: auto; }
  .main { margin-left: 0; padding: 16px; }
  .metric-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .filterbar { display: block; }
  .filter-input,.filter-select { width: 100%; margin-top: 10px; }
}
</style>
