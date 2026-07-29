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
            <text class="page-desc">{{ deliveryId }}</text>
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
              <text class="panel-title">{{ labels.basicInfo }}</text>
              <text class="status-tag">{{ getDeliveryStatusLabel(delivery.status) }}</text>
            </view>
            <view class="info-grid">
              <view><text>{{ labels.project }}</text><text>{{ delivery.projectId || '--' }}</text></view>
              <view><text>{{ labels.order }}</text><text>{{ delivery.orderId || '--' }}</text></view>
              <view><text>{{ labels.sourceQuote }}</text><text>{{ delivery.sourceQuoteId || '--' }}</text></view>
              <view><text>{{ labels.itemCount }}</text><text>{{ delivery.itemCount || 0 }}</text></view>
              <view><text>{{ labels.updatedAt }}</text><text>{{ formatTime(delivery.updatedAt || delivery.createdAt) }}</text></view>
            </view>
            <view class="actions">
              <button v-for="action in availableActions" :key="action.status" :class="['action-btn', action.danger ? 'danger' : '']" :disabled="isSubmitting" @click="runAction(action)">
                {{ action.label }}
              </button>
            </view>
          </view>

          <view class="panel">
            <text class="panel-title">{{ labels.contentTitle }}</text>
            <view class="list-row">
              <text>{{ labels.assetCount }}</text>
              <text>{{ delivery.itemCount || 0 }}</text>
            </view>
            <view class="empty">{{ labels.contentHint }}</view>
          </view>

          <view class="panel">
            <text class="panel-title">{{ labels.timelineTitle }}</text>
            <view class="list-row"><text>{{ labels.submittedAt }}</text><text>{{ formatTime(delivery.submittedAt) }}</text></view>
            <view class="list-row"><text>{{ labels.reviewStartedAt }}</text><text>{{ formatTime(delivery.reviewStartedAt) }}</text></view>
            <view class="list-row"><text>{{ labels.approvedAt }}</text><text>{{ formatTime(delivery.approvedAt) }}</text></view>
            <view class="list-row"><text>{{ labels.customerConfirmedAt }}</text><text>{{ formatTime(delivery.customerConfirmedAt) }}</text></view>
            <view class="list-row"><text>{{ labels.completedAt }}</text><text>{{ formatTime(delivery.completedAt) }}</text></view>
          </view>

          <view class="panel wide">
            <text class="panel-title">{{ labels.historyTitle }}</text>
            <view v-for="item in history" :key="item.historyId" class="log-row">
              <text>{{ formatTime(item.createdAt) }}</text>
              <text>{{ item.operatorName || item.operatorType || labels.system }}</text>
              <text>{{ item.action }}</text>
              <text>{{ getDeliveryStatusLabel(item.fromStatus) }} -> {{ getDeliveryStatusLabel(item.toStatus) }}</text>
              <text>{{ item.reason || '--' }}</text>
            </view>
            <view v-if="!history.length" class="empty">{{ labels.historyEmpty }}</view>
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
import { getDeliveryDetail, transitionDelivery } from '../../utils/service/deliveryService.js'
import { canTransitionDelivery, getDeliveryStatusLabel, normalizeDeliveryStatus } from '../../utils/delivery/deliveryStatus.js'
import { getEnterpriseWebMenu } from '../../utils/enterprise-web/enterpriseWebMenu.js'

const ACTIONS = Object.freeze([
  { status: 'submitted', label: '\u63d0\u4ea4\u5ba1\u6838', permission: PERMISSION_KEYS.DELIVERY_MANAGE },
  { status: 'reviewing', label: '\u5f00\u59cb\u5ba1\u6838', permission: PERMISSION_KEYS.DELIVERY_APPROVE },
  { status: 'approved', label: '\u5ba1\u6838\u901a\u8fc7', permission: PERMISSION_KEYS.DELIVERY_APPROVE },
  { status: 'rejected', label: '\u9a73\u56de', permission: PERMISSION_KEYS.DELIVERY_APPROVE, danger: true, reasonRequired: true },
  { status: 'customer_confirmed', label: '\u5ba2\u6237\u786e\u8ba4', permission: PERMISSION_KEYS.DELIVERY_MANAGE },
  { status: 'completed', label: '\u5b8c\u6210\u4ea4\u4ed8', permission: PERMISSION_KEYS.DELIVERY_MANAGE },
  { status: 'cancelled', label: '\u53d6\u6d88\u4ea4\u4ed8', permission: PERMISSION_KEYS.DELIVERY_MANAGE, danger: true }
])

const LABELS = Object.freeze({
  brand: '\u8776\u53d8',
  brandDesc: '\u4f01\u4e1a\u7ecf\u8425\u95ed\u73af',
  title: '\u4ea4\u4ed8\u8be6\u60c5',
  back: '\u8fd4\u56de\u4ea4\u4ed8\u4e2d\u5fc3',
  loading: '\u52a0\u8f7d\u4ea4\u4ed8\u4e2d...',
  notFound: '\u672a\u627e\u5230\u4ea4\u4ed8\u6216\u65e0\u6743\u8bbf\u95ee\u3002',
  loadFailed: '\u4ea4\u4ed8\u52a0\u8f7d\u5931\u8d25',
  updateFailed: '\u4ea4\u4ed8\u72b6\u6001\u66f4\u65b0\u5931\u8d25',
  updateSuccess: '\u4ea4\u4ed8\u72b6\u6001\u5df2\u66f4\u65b0',
  rejectTitle: '\u9a73\u56de\u4ea4\u4ed8',
  rejectContent: '\u8bf7\u786e\u8ba4\u9a73\u56de\u4ea4\u4ed8\u3002\u539f\u56e0\u5c06\u8bb0\u5f55\u4e3a\uff1a\u4ea4\u4ed8\u5185\u5bb9\u9700\u8c03\u6574\u3002',
  rejectReason: '\u4ea4\u4ed8\u5185\u5bb9\u9700\u8c03\u6574',
  basicInfo: '\u4ea4\u4ed8\u57fa\u7840\u4fe1\u606f',
  project: '\u9879\u76ee',
  order: '\u8ba2\u5355',
  sourceQuote: '\u6765\u6e90\u62a5\u4ef7',
  itemCount: '\u5185\u5bb9\u6570\u91cf',
  updatedAt: '\u66f4\u65b0\u65f6\u95f4',
  contentTitle: '\u4ea4\u4ed8\u5185\u5bb9',
  assetCount: '\u8d44\u4ea7\u6570\u91cf',
  contentHint: '\u672c\u9636\u6bb5\u53ea\u5c55\u793a\u4ea4\u4ed8\u5185\u5bb9\u6458\u8981\uff0c\u4e0d\u590d\u5236\u5b8c\u6574\u8d44\u4ea7\u5bf9\u8c61\u3002',
  timelineTitle: '\u72b6\u6001\u65f6\u95f4\u7ebf',
  submittedAt: '\u63d0\u4ea4\u5ba1\u6838',
  reviewStartedAt: '\u5f00\u59cb\u5ba1\u6838',
  approvedAt: '\u5ba1\u6838\u901a\u8fc7',
  customerConfirmedAt: '\u5ba2\u6237\u786e\u8ba4',
  completedAt: '\u5b8c\u6210\u4ea4\u4ed8',
  historyTitle: '\u4ea4\u4ed8\u52a8\u4f5c\u5386\u53f2',
  historyEmpty: '\u6682\u65e0\u52a8\u4f5c\u5386\u53f2',
  system: '\u7cfb\u7edf',
  h5Only: '\u4f01\u4e1a\u7f51\u9875\u7248\u4ec5\u5728 H5 \u5e73\u53f0\u663e\u793a\u3002'
})

export default {
  data() {
    return {
      labels: LABELS,
      menu: getEnterpriseWebMenu(),
      deliveryId: '',
      guard: requirePermission(PERMISSION_KEYS.DELIVERY_VIEW),
      pageState: 'loading',
      errorMessage: '',
      delivery: null,
      history: [],
      isSubmitting: false
    }
  },
  computed: {
    guardMessage() {
      return getEnterpriseGuardMessage(this.guard.reason)
    },
    availableActions() {
      if (!this.delivery) return []
      const current = normalizeDeliveryStatus(this.delivery.status)
      return ACTIONS
        .filter((action) => canTransitionDelivery(current, action.status))
        .filter((action) => requirePermission(action.permission).allowed)
    }
  },
  onLoad(options = {}) {
    this.deliveryId = options.deliveryId || ''
    this.refresh()
  },
  onShow() {
    if (this.deliveryId) this.refresh()
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
        const result = await getDeliveryDetail(this.deliveryId)
        if (!result || result.errorCode === 'DELIVERY_NOT_FOUND') {
          this.pageState = 'not_found'
          return
        }
        if (!result.success) {
          this.errorMessage = result.message || this.labels.loadFailed
          this.pageState = 'error'
          return
        }
        this.delivery = result.delivery
        this.history = result.history || []
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
      uni.navigateTo({ url: buildEnterpriseWebUrl('deliveries') })
    },
    runAction(action = {}) {
      if (!this.delivery || this.isSubmitting) return
      if (action.reasonRequired) {
        uni.showModal({
          title: this.labels.rejectTitle,
          content: this.labels.rejectContent,
          success: (res) => {
            if (res.confirm) this.submitAction(action, this.labels.rejectReason)
          }
        })
        return
      }
      this.submitAction(action, '')
    },
    async submitAction(action = {}, reason = '') {
      this.isSubmitting = true
      const result = await transitionDelivery(this.delivery.deliveryId, action.status, {}, {
        expectedVersion: Number(this.delivery.version || 0),
        idempotencyKey: `delivery_${this.delivery.deliveryId}_${action.status}_${Date.now()}`,
        reason
      })
      this.isSubmitting = false
      if (!result || !result.success) {
        uni.showToast({ title: result?.message || this.labels.updateFailed, icon: 'none' })
        return
      }
      uni.showToast({ title: this.labels.updateSuccess, icon: 'none' })
      await this.refresh()
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
.actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 16px; }
.danger { background: #fff1f2; color: #e11d48; }
.status-tag { display: inline-block; padding: 5px 10px; border-radius: 999px; background: #eef2ff; color: #4f46e5; font-size: 13px; font-weight: 700; }
.list-row,.log-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; padding: 10px 0; border-bottom: 1px solid #eef2f7; font-size: 13px; }
.log-row { grid-template-columns: 1fr 1fr 1fr 1.2fr 1fr; }
.empty,.state-card,.platform-tip { padding: 24px; color: #64748b; }
.denied { color: #b42318; }
@media (max-width: 900px) {
  .shell { display: block; }
  .sidebar { position: static; width: auto; }
  .main { margin-left: 0; padding: 16px; }
  .detail-grid,.info-grid,.log-row { grid-template-columns: 1fr; }
}
</style>
