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
            <text class="page-desc">{{ orderId }}</text>
          </view>
          <button class="primary-btn ghost" @click="back">{{ labels.back }}</button>
        </view>

        <view v-if="pageState === 'loading'" class="state-card">{{ labels.loading }}</view>
        <view v-else-if="pageState === 'forbidden'" class="state-card denied">{{ guardMessage }}</view>
        <view v-else-if="pageState === 'not_found'" class="state-card">{{ labels.notFound }}</view>
        <view v-else-if="pageState === 'error'" class="state-card denied">{{ errorMessage }}</view>
        <view v-else class="detail-grid">
          <view class="panel wide">
            <view class="panel-head">
              <text class="panel-title">{{ labels.baseInfo }}</text>
              <text class="status-tag">{{ getOrderStatusLabel(order.status) }}</text>
            </view>
            <view class="info-grid">
              <view><text>{{ labels.sourceQuote }}</text><text>{{ order.sourceQuoteId || '--' }}</text></view>
              <view><text>{{ labels.customer }}</text><text>{{ order.customer || order.customerName || '--' }}</text></view>
              <view><text>{{ labels.project }}</text><text>{{ projectName }}</text></view>
              <view><text>{{ labels.amount }}</text><text>{{ formatMoney(order.amount) }}</text></view>
              <view><text>{{ labels.deliveryStatus }}</text><text>{{ delivery ? getDeliveryStatusLabel(delivery.status) : labels.noDelivery }}</text></view>
            </view>
          </view>

          <view class="panel">
            <text class="panel-title">{{ labels.deliveryLink }}</text>
            <view v-if="delivery" class="list-row clickable" @click="openDelivery">
              <text>{{ delivery.deliveryId }}</text>
              <text>{{ getDeliveryStatusLabel(delivery.status) }}</text>
            </view>
            <view v-else class="empty">{{ labels.emptyDelivery }}</view>
            <button v-if="canManageDelivery && !delivery" class="action-btn" @click="createDelivery">{{ labels.createDelivery }}</button>
            <button v-if="canViewDelivery && delivery" class="action-btn" @click="openDelivery">{{ labels.viewDelivery }}</button>
          </view>

          <view class="panel">
            <text class="panel-title">{{ labels.timeline }}</text>
            <view class="list-row">
              <text>{{ getOrderStatusLabel(order.status) }}</text>
              <text>{{ formatTime(order.updatedAt || order.createdAt) }}</text>
            </view>
          </view>

          <view class="panel wide">
            <text class="panel-title">{{ labels.audit }}</text>
            <view v-for="log in auditLogs" :key="log.auditId || log.createdAt" class="log-row">
              <text>{{ formatTime(log.createdAt) }}</text>
              <text>{{ log.operator || labels.system }}</text>
              <text>{{ log.action || '--' }}</text>
            </view>
            <view v-if="!auditLogs.length" class="empty">{{ labels.emptyAudit }}</view>
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
import { getAuditLogs } from '../../utils/audit/auditService.js'
import { getById as getOrderById } from '../../utils/repository/orderRepository.js'
import { getById as getProjectById } from '../../utils/repository/projectRepository.js'
import { buildEnterpriseWebUrl } from '../../utils/enterprise-web/enterpriseWebRoutes.js'
import { canAccessTenantRecord, getEnterpriseGuardMessage, requirePermission } from '../../utils/enterprise-web/enterpriseWebGuard.js'
import { PERMISSION_KEYS } from '../../utils/permission/permissionCatalog.js'
import { createDeliveryFromOrder, listDeliveries } from '../../utils/service/deliveryService.js'
import { getDeliveryStatusLabel } from '../../utils/delivery/deliveryStatus.js'
import { getEnterpriseWebMenu } from '../../utils/enterprise-web/enterpriseWebMenu.js'

const LABELS = Object.freeze({
  brand: '\u8776\u53d8',
  brandDesc: '\u4f01\u4e1a\u7ecf\u8425\u95ed\u73af',
  pageTitle: '\u8ba2\u5355\u8be6\u60c5',
  back: '\u8fd4\u56de\u8ba2\u5355\u5217\u8868',
  loading: '\u52a0\u8f7d\u8ba2\u5355\u4e2d...',
  notFound: '\u672a\u627e\u5230\u8ba2\u5355\u6216\u65e0\u6743\u8bbf\u95ee\u3002',
  baseInfo: '\u57fa\u7840\u4fe1\u606f',
  sourceQuote: '\u6765\u6e90\u62a5\u4ef7',
  customer: '\u5ba2\u6237',
  project: '\u9879\u76ee',
  amount: '\u8ba2\u5355\u91d1\u989d',
  deliveryStatus: '\u4ea4\u4ed8\u72b6\u6001',
  noDelivery: '\u672a\u521b\u5efa',
  deliveryLink: '\u5173\u8054\u4ea4\u4ed8',
  emptyDelivery: '\u6682\u65e0\u4ea4\u4ed8\u5355',
  createDelivery: '\u521b\u5efa\u4ea4\u4ed8\u5355',
  viewDelivery: '\u67e5\u770b\u4ea4\u4ed8',
  timeline: '\u8ba2\u5355\u65f6\u95f4\u7ebf',
  audit: '\u64cd\u4f5c\u8bb0\u5f55',
  emptyAudit: '\u6682\u65e0\u64cd\u4f5c\u8bb0\u5f55',
  system: '\u7cfb\u7edf',
  h5Only: '\u4f01\u4e1a\u7f51\u9875\u7248\u4ec5\u5728 H5 \u5e73\u53f0\u663e\u793a\u3002',
  createSuccess: '\u4ea4\u4ed8\u5355\u5df2\u521b\u5efa',
  createFailed: '\u4ea4\u4ed8\u5355\u521b\u5efa\u5931\u8d25',
  loadFailed: '\u8ba2\u5355\u52a0\u8f7d\u5931\u8d25'
})

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
      orderId: '',
      guard: requirePermission(PERMISSION_KEYS.ORDER_VIEW),
      deliveryViewGuard: requirePermission(PERMISSION_KEYS.DELIVERY_VIEW),
      deliveryManageGuard: requirePermission(PERMISSION_KEYS.DELIVERY_MANAGE),
      pageState: 'loading',
      errorMessage: '',
      order: null,
      delivery: null,
      auditLogs: []
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
    projectName() {
      const project = this.order ? getProjectById(this.order.projectId || '') : null
      return project ? (project.title || project.projectName || project.name || project.projectId) : (this.order && this.order.projectId ? this.order.projectId : '--')
    }
  },
  onLoad(options = {}) {
    this.orderId = options.orderId || ''
    this.refresh()
  },
  onShow() {
    if (this.orderId) this.refresh()
  },
  methods: {
    async refresh() {
      this.pageState = 'loading'
      this.errorMessage = ''
      this.guard = requirePermission(PERMISSION_KEYS.ORDER_VIEW)
      this.deliveryViewGuard = requirePermission(PERMISSION_KEYS.DELIVERY_VIEW)
      this.deliveryManageGuard = requirePermission(PERMISSION_KEYS.DELIVERY_MANAGE)
      if (!this.guard.allowed) {
        this.pageState = 'forbidden'
        return
      }
      try {
        const order = getOrderById(this.orderId)
        this.guard = canAccessTenantRecord(order || { orderId: this.orderId }, PERMISSION_KEYS.ORDER_VIEW)
        if (!this.guard.allowed) {
          this.pageState = 'forbidden'
          return
        }
        if (!order) {
          this.pageState = 'not_found'
          return
        }
        this.order = order
        const deliveries = this.canViewDelivery ? await listDeliveries({ orderId: order.orderId }) : []
        this.delivery = deliveries.find((item) => item.orderId === order.orderId || item.deliveryId === order.deliveryId) || null
        this.auditLogs = getAuditLogs({ targetType: 'order', targetId: this.orderId }).slice(0, 20)
        this.pageState = 'ready'
      } catch (error) {
        this.errorMessage = error && error.message ? error.message : this.labels.loadFailed
        this.pageState = 'error'
      }
    },
    goTo(item = {}) {
      if (item.route) uni.navigateTo({ url: item.route })
    },
    back() {
      uni.navigateTo({ url: buildEnterpriseWebUrl('orders') })
    },
    async createDelivery() {
      if (!this.canManageDelivery || !this.order) return
      const result = await createDeliveryFromOrder(this.order.orderId, {
        idempotencyKey: `delivery_from_order_${this.order.orderId}_${Date.now()}`
      })
      if (!result || !result.success) {
        uni.showToast({ title: result?.message || this.labels.createFailed, icon: 'none' })
        return
      }
      uni.showToast({ title: this.labels.createSuccess, icon: 'none' })
      await this.refresh()
    },
    openDelivery() {
      if (!this.delivery || !this.delivery.deliveryId) return
      uni.navigateTo({ url: buildEnterpriseWebUrl('deliveryDetail', { deliveryId: this.delivery.deliveryId }) })
    },
    getDeliveryStatusLabel,
    getOrderStatusLabel(status = '') {
      return ORDER_STATUS_LABELS[status] || ORDER_STATUS_LABELS.pending_payment
    },
    formatMoney(value) {
      return `楼${Number(value || 0).toFixed(0)}`
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
.menu-item.active,.menu-item:hover { background: #eef2ff; color: #4f46e5; }
.menu-icon { width: 24px; height: 24px; border-radius: 8px; background: rgba(255,255,255,0.1); text-align: center; line-height: 24px; font-size: 12px; }
.main { flex: 1; margin-left: 216px; padding: 24px; box-sizing: border-box; }
.topbar,.panel,.state-card { background: #fff; border: 1px solid #e5e7eb; border-radius: 16px; box-shadow: 0 18px 40px rgba(15,23,42,0.05); }
.topbar { display: flex; justify-content: space-between; gap: 16px; padding: 20px 24px; margin-bottom: 18px; }
.page-title { display: block; font-size: 24px; font-weight: 800; }
.page-desc { display: block; margin-top: 6px; color: #64748b; font-size: 13px; }
.primary-btn,.action-btn { height: 36px; line-height: 36px; border-radius: 10px; background: #4f46e5; color: #fff; font-size: 13px; }
.ghost { background: #eef2ff; color: #4f46e5; }
.detail-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.panel { padding: 20px; }
.wide { grid-column: 1 / -1; }
.panel-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.panel-title { display: block; margin-bottom: 14px; font-size: 17px; font-weight: 800; }
.info-grid { display: grid; grid-template-columns: repeat(5, minmax(0,1fr)); gap: 12px; }
.info-grid view { padding: 14px; border-radius: 12px; background: #f8fafc; }
.info-grid text { display: block; color: #64748b; font-size: 12px; }
.info-grid text + text { margin-top: 8px; color: #111827; font-size: 15px; font-weight: 700; }
.status-tag { display: inline-block; padding: 5px 10px; border-radius: 999px; background: #eef2ff; color: #4f46e5; font-size: 13px; font-weight: 700; }
.list-row,.log-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; padding: 10px 0; border-bottom: 1px solid #eef2f7; font-size: 13px; }
.log-row { grid-template-columns: 1fr 1fr 1fr; }
.clickable { cursor: pointer; }
.empty,.state-card,.platform-tip { padding: 24px; color: #64748b; }
.denied { color: #b42318; }
@media (max-width: 900px) {
  .shell { display: block; }
  .sidebar { position: static; width: auto; }
  .main { margin-left: 0; padding: 16px; }
  .detail-grid,.info-grid,.log-row { grid-template-columns: 1fr; }
}
</style>

