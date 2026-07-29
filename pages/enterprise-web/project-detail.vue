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
          <view v-for="item in menu" :key="item.key" :class="['menu-item', item.key === 'projects' ? 'active' : '']" @click="goTo(item)">
            <text class="menu-icon">{{ item.icon }}</text>
            <text>{{ item.label }}</text>
          </view>
        </view>
      </view>

      <view class="main">
        <view class="topbar">
          <view>
            <text class="page-title">{{ projectTitle }}</text>
            <text class="page-desc">{{ labels.pageDesc }}</text>
          </view>
          <button class="ghost-btn" @click="backToProjects">{{ labels.back }}</button>
        </view>

        <view v-if="pageState === 'loading'" class="state-card">{{ labels.loading }}</view>
        <view v-else-if="pageState === 'forbidden'" class="state-card denied">{{ guardMessage }}</view>
        <view v-else-if="pageState === 'not_found'" class="state-card">{{ labels.notFound }}</view>
        <view v-else-if="pageState === 'error'" class="state-card denied">{{ errorMessage || labels.error }}</view>
        <view v-else class="detail-grid">
          <view class="panel wide">
            <view class="panel-head">
              <text class="panel-title">{{ labels.baseInfo }}</text>
              <text class="stage-tag">{{ currentStageLabel }}</text>
            </view>
            <view class="info-grid">
              <view><text>{{ labels.customerName }}</text><text>{{ project.customerName || project.clientName || '--' }}</text></view>
              <view><text>{{ labels.currentStage }}</text><text>{{ currentStageLabel }}</text></view>
              <view><text>{{ labels.status }}</text><text>{{ getStatusLabel(project.status || project.stage) }}</text></view>
              <view><text>{{ labels.owner }}</text><text>{{ project.owner || project.ownerName || project.managerName || '--' }}</text></view>
              <view><text>{{ labels.updatedAt }}</text><text>{{ formatTime(project.updatedAt || project.createdAt) }}</text></view>
            </view>
            <view v-if="canManageProject" class="actions">
              <button v-if="nextStage" class="action-btn primary" :disabled="isAdvancing" @click="confirmAdvanceStage">{{ isAdvancing ? labels.advancing : nextStageButtonText }}</button>
              <button class="action-btn" :disabled="isUpdatingProject" @click="updateBase">{{ labels.editBase }}</button>
              <button class="action-btn" @click="approveProject">{{ labels.approve }}</button>
              <button class="action-btn danger" @click="rejectProject">{{ labels.reject }}</button>
              <button class="action-btn" @click="confirmDelivery">{{ labels.confirmDelivery }}</button>
            </view>
          </view>

          <view class="panel wide">
            <view class="panel-head">
              <text class="panel-title">{{ labels.stageProgress }}</text>
              <text class="progress-value">{{ projectProgressPercent }}%</text>
            </view>
            <view class="stage-track">
              <view v-for="stage in projectStages" :key="stage.key" :class="['stage-item', stage.state]">
                <view class="stage-dot">{{ stage.index + 1 }}</view>
                <text>{{ stage.label }}</text>
              </view>
            </view>
          </view>

          <view class="panel wide">
            <view class="panel-head">
              <text class="panel-title">{{ labels.quotes }} ({{ quotes.length }})</text>
              <button v-if="canManageQuote" class="small-btn" @click="createProjectQuote">{{ labels.createQuote }}</button>
            </view>
            <view v-if="!canViewQuote" class="empty">{{ labels.noQuoteViewPermission }}</view>
            <view class="mini-table">
              <view v-if="canViewQuote" class="mini-head mini-row">
                <text>{{ labels.quoteId }}</text>
                <text>{{ labels.amount }}</text>
                <text>{{ labels.status }}</text>
                <text>{{ labels.updatedAt }}</text>
                <text>{{ labels.action }}</text>
              </view>
              <view v-for="item in quotes" :key="item.quoteId" class="mini-row">
                <text>{{ item.quoteId }}</text>
                <text>{{ formatMoney(item.amount) }}</text>
                <text>{{ getQuoteStatusLabel(item.status) }}</text>
                <text>{{ formatTime(item.updatedAt || item.createdAt) }}</text>
                <button class="mini-btn" @click="openQuote(item)">{{ labels.viewQuote }}</button>
              </view>
            </view>
            <view v-if="canViewQuote && !quotes.length" class="empty">{{ labels.emptyQuotes }}</view>
          </view>

          <view class="panel">
            <text class="panel-title">{{ labels.orders }} ({{ orders.length }})</text>
            <view v-if="!canViewOrder" class="empty">{{ labels.noOrderViewPermission }}</view>
            <view v-for="item in orders" :key="item.orderId" class="list-item rich-list-item clickable" @click="openOrder(item)">
              <text>{{ item.orderId }}</text>
              <text>{{ getOrderStatusLabel(item.status) }} / {{ formatMoney(item.amount) }}</text>
            </view>
            <view v-if="canViewOrder && !orders.length" class="empty">{{ labels.emptyOrders }}</view>
          </view>

          <view class="panel">
            <text class="panel-title">{{ labels.products }} ({{ products.length }})</text>
            <view v-for="item in products" :key="item.productPackageId" class="list-item rich-list-item">
              <text>{{ getProductTitle(item) }}</text>
              <text>{{ getProductStatusLabel(item.status || item.productStatus) }}</text>
            </view>
            <view v-if="!products.length" class="empty">{{ labels.emptyProducts }}</view>
          </view>

          <view class="panel">
            <text class="panel-title">{{ labels.deliveries }} ({{ deliveryRows.length }})</text>
            <view v-for="item in deliveryRows" :key="item.id" class="list-item rich-list-item clickable" @click="openDelivery(item)">
              <text>{{ item.title }}</text>
              <text>{{ item.statusText }}</text>
            </view>
            <view v-if="!deliveryRows.length" class="empty">{{ labels.emptyDeliveries }}</view>
          </view>

          <view class="panel">
            <text class="panel-title">{{ labels.stageHistory }}</text>
            <view v-if="stageHistoryError" class="empty denied">{{ stageHistoryError }}</view>
            <view v-for="item in stageHistory" :key="item.historyId" class="log-row">
              <text>{{ formatTime(item.createdAt) }}</text>
              <text>{{ item.operatorName || labels.system }}</text>
              <text>{{ item.fromStageLabel }} {{ labels.arrow }} {{ item.toStageLabel }}</text>
            </view>
            <view v-if="!stageHistory.length" class="empty">{{ labels.emptyStageHistory }}</view>
          </view>

          <view class="panel wide">
            <text class="panel-title">{{ labels.audit }}</text>
            <view v-for="item in auditLogs" :key="item.auditId || item.eventId || item.createdAt" class="log-row">
              <text>{{ item.operator || labels.system }}</text>
              <text>{{ item.action || item.eventName || '--' }}</text>
              <text>{{ formatTime(item.createdAt) }}</text>
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
import { getAuditLogs, recordAudit } from '../../utils/audit/auditService.js'
import { getCurrentMember, getCurrentUser } from '../../utils/auth/authRepository.js'
import { getList as getProducts } from '../../utils/repository/productPackageRepository.js'
import { update as updateDelivery } from '../../utils/repository/deliveryRepository.js'
import { createQuote, getQuotes } from '../../utils/service/quoteService.js'
import { getOrders } from '../../utils/service/orderService.js'
import { listDeliveries } from '../../utils/service/deliveryService.js'
import { getProjectDetail, updateProject } from '../../utils/project/projectService.js'
import { canAccessProject, getEnterpriseGuardMessage, requirePermission } from '../../utils/enterprise-web/enterpriseWebGuard.js'
import { getEnterpriseWebMenu } from '../../utils/enterprise-web/enterpriseWebMenu.js'
import { buildEnterpriseWebUrl, hasEnterpriseWebRoute } from '../../utils/enterprise-web/enterpriseWebRoutes.js'
import { PERMISSION_KEYS } from '../../utils/permission/permissionCatalog.js'
import { buildProjectStageProgress, getProjectStageLabel, getProjectStatusLabel, normalizeProjectStage } from '../../utils/project/projectStage.js'
import { advanceProjectStage, getNextStage, getStageHistory } from '../../utils/project/projectStageService.js'
import { getDeliveryPackages, getDeliveryPackageStatusLabel } from '../../utils/workspace/deliveryPackage.js'
import { getDeliveryStatusLabel } from '../../utils/delivery/deliveryStatus.js'

const LABELS = Object.freeze({
  brand: '\u8776\u53d8',
  brandDesc: '\u670d\u88c5\u4f01\u4e1a\u5de5\u4f5c\u53f0',
  pageTitle: '\u9879\u76ee\u8be6\u60c5',
  pageDesc: '\u67e5\u770b\u9879\u76ee\u9636\u6bb5\u3001\u62a5\u4ef7\u3001\u8ba2\u5355\u548c\u4ea4\u4ed8\u72b6\u6001\u3002',
  loading: '\u52a0\u8f7d\u9879\u76ee\u4e2d...',
  notFound: '\u9879\u76ee\u4e0d\u5b58\u5728',
  error: '\u52a0\u8f7d\u5931\u8d25',
  h5Only: '\u4f01\u4e1a\u7f51\u9875\u7248\u4ec5\u5728 H5 \u5e73\u53f0\u663e\u793a\u3002',
  back: '\u8fd4\u56de\u9879\u76ee\u5217\u8868',
  baseInfo: '\u9879\u76ee\u57fa\u7840\u4fe1\u606f',
  customerName: '\u5ba2\u6237\u540d\u79f0',
  currentStage: '\u5f53\u524d\u9636\u6bb5',
  status: '\u72b6\u6001',
  owner: '\u8d1f\u8d23\u4eba',
  updatedAt: '\u66f4\u65b0\u65f6\u95f4',
  editBase: '\u7f16\u8f91\u9879\u76ee\u57fa\u7840\u4fe1\u606f',
  approve: '\u5ba1\u6279\u901a\u8fc7',
  reject: '\u5ba1\u6279\u9a73\u56de',
  confirmDelivery: '\u4ea4\u4ed8\u786e\u8ba4',
  stageProgress: '\u9879\u76ee\u9636\u6bb5',
  stageHistory: '\u9879\u76ee\u9636\u6bb5\u8bb0\u5f55',
  emptyStageHistory: '\u6682\u65e0\u9636\u6bb5\u8bb0\u5f55',
  quotes: '\u5173\u8054\u62a5\u4ef7',
  quoteId: '\u62a5\u4ef7 ID',
  amount: '\u91d1\u989d',
  action: '\u64cd\u4f5c',
  createQuote: '\u521b\u5efa\u62a5\u4ef7',
  viewQuote: '\u67e5\u770b\u62a5\u4ef7',
  orders: '\u8ba2\u5355',
  products: '\u5546\u54c1\u8d44\u6599\u5305',
  deliveries: '\u4ea4\u4ed8',
  audit: '\u64cd\u4f5c\u65e5\u5fd7',
  emptyProducts: '\u6682\u65e0\u5546\u54c1\u8d44\u6599\u5305',
  emptyQuotes: '\u6682\u65e0\u5173\u8054\u62a5\u4ef7',
  noQuoteViewPermission: '\u5f53\u524d\u89d2\u8272\u6682\u65e0\u62a5\u4ef7\u67e5\u770b\u6743\u9650',
  emptyOrders: '\u6682\u65e0\u5173\u8054\u8ba2\u5355',
  noOrderViewPermission: '\u5f53\u524d\u89d2\u8272\u6682\u65e0\u8ba2\u5355\u67e5\u770b\u6743\u9650',
  emptyDeliveries: '\u6682\u65e0\u4ea4\u4ed8\u8bb0\u5f55',
  emptyAudit: '\u6682\u65e0\u64cd\u4f5c\u65e5\u5fd7',
  unnamedProject: '\u672a\u547d\u540d\u9879\u76ee',
  unnamedProduct: '\u672a\u547d\u540d\u5546\u54c1',
  updateSuccess: '\u9879\u76ee\u5df2\u66f4\u65b0',
  quoteCreateSuccess: '\u5df2\u521b\u5efa\u62a5\u4ef7',
  quoteCreateFailed: '\u62a5\u4ef7\u521b\u5efa\u5931\u8d25',
  rejectSuccess: '\u5df2\u8bb0\u5f55\u9a73\u56de',
  noDelivery: '\u6682\u65e0\u53ef\u786e\u8ba4\u4ea4\u4ed8',
  routeUnavailable: '\u76ee\u6807\u9875\u9762\u6682\u672a\u5f00\u653e',
  stageAdvanceSuccess: '\u9879\u76ee\u9636\u6bb5\u5df2\u63a8\u8fdb',
  stageAdvanceFailed: '\u9636\u6bb5\u63a8\u8fdb\u5931\u8d25',
  stageConflict: '\u9879\u76ee\u72b6\u6001\u5df2\u88ab\u5176\u4ed6\u6210\u5458\u66f4\u65b0\uff0c\u8bf7\u5237\u65b0\u540e\u91cd\u8bd5\u3002',
  stageHistoryFailed: '\u9636\u6bb5\u5386\u53f2\u52a0\u8f7d\u5931\u8d25',
  advancing: '\u63a8\u8fdb\u4e2d...',
  stageAdvanceConfirm: '\u786e\u8ba4\u5c06\u9879\u76ee\u4ece',
  stageAdvanceConfirmTo: '\u63a8\u8fdb\u5230',
  arrow: '->',
  system: '\u7cfb\u7edf'
})

const QUOTE_STATUS_LABELS = Object.freeze({
  draft: '\u8349\u7a3f',
  sent: '\u5df2\u53d1\u9001',
  confirmed: '\u5df2\u786e\u8ba4',
  rejected: '\u5df2\u62d2\u7edd'
})

const ORDER_STATUS_LABELS = Object.freeze({
  pending_payment: '\u5f85\u5904\u7406',
  processing: '\u5904\u7406\u4e2d',
  completed: '\u5df2\u5b8c\u6210',
  closed: '\u5df2\u5173\u95ed'
})

const PRODUCT_STATUS_LABELS = Object.freeze({
  draft: '\u8349\u7a3f',
  ready: '\u5df2\u5b8c\u6574',
  approved: '\u5df2\u5ba1\u6838',
  archived: '\u5df2\u5f52\u6863'
})

const NEXT_STAGE_BUTTONS = Object.freeze({
  design: '\u8fdb\u5165\u8bbe\u8ba1',
  production: '\u8fdb\u5165\u751f\u4ea7',
  review: '\u8fdb\u5165\u5ba1\u6838',
  delivery: '\u8fdb\u5165\u4ea4\u4ed8',
  completed: '\u5b8c\u6210\u9879\u76ee'
})

export default {
  data() {
    return {
      labels: LABELS,
      menu: getEnterpriseWebMenu(),
      projectId: '',
      guard: requirePermission(PERMISSION_KEYS.PROJECT_VIEW),
      manageGuard: requirePermission(PERMISSION_KEYS.PROJECT_MANAGE),
      quoteViewGuard: requirePermission(PERMISSION_KEYS.QUOTE_VIEW),
      quoteManageGuard: requirePermission(PERMISSION_KEYS.QUOTE_MANAGE),
      orderViewGuard: requirePermission(PERMISSION_KEYS.ORDER_VIEW),
      pageState: 'loading',
      errorMessage: '',
      project: null,
      quotes: [],
      orders: [],
      products: [],
      deliveries: [],
      deliveryPackages: [],
      auditLogs: [],
      stageHistory: [],
      stageHistoryError: '',
      isAdvancing: false,
      isUpdatingProject: false
    }
  },
  computed: {
    guardMessage() {
      return getEnterpriseGuardMessage(this.guard.reason)
    },
    canManageProject() {
      return this.manageGuard.allowed
    },
    canViewQuote() {
      return this.quoteViewGuard.allowed
    },
    canViewOrder() {
      return this.orderViewGuard.allowed
    },
    canManageQuote() {
      return this.quoteManageGuard.allowed
    },
    projectTitle() {
      if (!this.project) return this.labels.pageTitle
      return this.project.name || this.project.title || this.project.projectName || this.labels.unnamedProject
    },
    currentStageKey() {
      return normalizeProjectStage(this.project ? (this.project.stage || this.project.status) : '')
    },
    currentStageLabel() {
      return getProjectStageLabel(this.currentStageKey)
    },
    nextStage() {
      return this.project ? getNextStage(this.currentStageKey) : null
    },
    nextStageButtonText() {
      return this.nextStage ? (NEXT_STAGE_BUTTONS[this.nextStage.key] || this.nextStage.label) : ''
    },
    projectStages() {
      return buildProjectStageProgress(this.currentStageKey, { deliveries: this.deliveries })
    },
    projectProgressPercent() {
      const current = this.projectStages.find((stage) => stage.state === 'current')
      const index = current ? current.index : 0
      return Math.round(((index + 1) / this.projectStages.length) * 100)
    },
    deliveryRows() {
      const deliveries = this.deliveries.map((item) => ({
        id: item.deliveryId,
        title: item.deliveryId,
        deliveryId: item.deliveryId,
        statusText: getDeliveryStatusLabel(item.status)
      }))
      const packages = this.deliveryPackages.map((item) => ({
        id: item.deliveryPackageId,
        title: item.title || item.deliveryPackageId,
        deliveryId: item.deliveryId,
        statusText: getDeliveryPackageStatusLabel(item.status)
      }))
      return [...packages, ...deliveries]
    }
  },
  onLoad(options = {}) {
    this.projectId = options.projectId || ''
    this.refresh()
  },
  onShow() {
    if (this.projectId) this.refresh()
  },
  methods: {
    async refresh() {
      try {
        this.pageState = 'loading'
        this.errorMessage = ''
        this.stageHistoryError = ''
        this.guard = requirePermission(PERMISSION_KEYS.PROJECT_VIEW)
        this.manageGuard = requirePermission(PERMISSION_KEYS.PROJECT_MANAGE)
        this.quoteViewGuard = requirePermission(PERMISSION_KEYS.QUOTE_VIEW)
        this.quoteManageGuard = requirePermission(PERMISSION_KEYS.QUOTE_MANAGE)
        this.orderViewGuard = requirePermission(PERMISSION_KEYS.ORDER_VIEW)
        if (!this.guard.allowed) {
          this.pageState = 'forbidden'
          return
        }
        const detailResult = await getProjectDetail(this.projectId)
        if (!detailResult || detailResult.errorCode === 'PROJECT_NOT_FOUND') {
          this.project = null
          this.pageState = 'not_found'
          return
        }
        if (!detailResult.success) {
          this.pageState = detailResult.errorCode === 'FORBIDDEN' ? 'forbidden' : 'error'
          this.errorMessage = detailResult.message || this.labels.error
          return
        }
        const project = detailResult.project
        const projectGuard = canAccessProject(project)
        if (!projectGuard.allowed) {
          this.guard = projectGuard
          this.pageState = 'forbidden'
          return
        }
        this.project = project
        this.quotes = this.quoteViewGuard.allowed ? getQuotes({ projectId: this.projectId }) : []
        this.orders = this.orderViewGuard.allowed ? getOrders({ projectId: this.projectId }) : []
        this.products = getProducts().filter((item) => item.projectId === this.projectId)
        this.deliveries = await listDeliveries({ projectId: this.projectId })
        this.deliveryPackages = getDeliveryPackages(this.projectId)
        try {
          this.stageHistory = await getStageHistory(this.projectId)
        } catch (historyError) {
          this.stageHistory = []
          this.stageHistoryError = historyError && historyError.message ? historyError.message : this.labels.stageHistoryFailed
        }
        this.auditLogs = getAuditLogs({ targetId: this.projectId }).slice(0, 12)
        this.pageState = 'ready'
      } catch (error) {
        this.pageState = 'error'
        this.errorMessage = error && error.message ? error.message : this.labels.error
      }
    },
    actor() {
      const user = getCurrentUser()
      const member = getCurrentMember()
      return {
        userId: user.userId,
        operator: member.name || user.name || ''
      }
    },
    goTo(item = {}) {
      if (item.route) uni.navigateTo({ url: item.route })
    },
    backToProjects() {
      uni.navigateTo({ url: buildEnterpriseWebUrl('projects') })
    },
    createProjectQuote() {
      if (!this.canManageQuote || !this.project) return
      const quote = createQuote({
        customer: this.project.customerName || this.project.clientName || '',
        customerName: this.project.customerName || this.project.clientName || '',
        projectId: this.projectId,
        amount: 0,
        items: []
      }, this.actor())
      if (!quote) {
        uni.showToast({ title: this.labels.quoteCreateFailed, icon: 'none' })
        return
      }
      uni.showToast({ title: this.labels.quoteCreateSuccess, icon: 'none' })
      this.refresh()
      this.openQuote(quote)
    },
    async updateBase() {
      if (!this.canManageProject) return
      this.isUpdatingProject = true
      const result = await updateProject(this.projectId, { touchedByEnterpriseWeb: true }, Number(this.project.version || 0))
      this.isUpdatingProject = false
      if (result && result.success) {
        uni.showToast({ title: this.labels.updateSuccess, icon: 'none' })
        await this.refresh()
      } else {
        uni.showToast({ title: result?.message || this.labels.error, icon: 'none' })
      }
    },
    confirmAdvanceStage() {
      if (!this.canManageProject || !this.nextStage) return
      const content = `${this.labels.stageAdvanceConfirm}\n${this.currentStageLabel}\n${this.labels.stageAdvanceConfirmTo}\n${this.nextStage.label}?`
      uni.showModal({ title: this.labels.stageProgress, content, success: (res) => { if (res.confirm) this.advanceStage() } })
    },
    async advanceStage() {
      const nextStage = this.nextStage
      if (!nextStage) return
      this.isAdvancing = true
      const result = await advanceProjectStage(this.projectId, nextStage.key, {
        expectedStage: this.currentStageKey,
        expectedVersion: Number(this.project.version || 0),
        idempotencyKey: `stage_${this.projectId}_${this.currentStageKey}_${nextStage.key}_${Date.now()}`
      })
      this.isAdvancing = false
      if (!result.ok) {
        const message = ['PROJECT_STAGE_CONFLICT', 'PROJECT_VERSION_CONFLICT'].includes(result.errorCode) ? this.labels.stageConflict : (result.message || this.labels.stageAdvanceFailed)
        return uni.showToast({ title: message, icon: 'none' })
      }
      uni.showToast({ title: this.labels.stageAdvanceSuccess, icon: 'none' })
      await this.refresh()
    },
    async approveProject() {
      if (!this.canManageProject) return
      const status = normalizeProjectStage(this.project.status) === 'completed' ? 'completed' : 'reviewing'
      const result = await updateProject(this.projectId, { status, approvalStatus: 'approved' }, Number(this.project.version || 0))
      if (result && result.success) await this.refresh()
    },
    rejectProject() {
      if (!this.canManageProject) return
      recordAudit({ action: '\u9879\u76ee\u5ba1\u6279\u9a73\u56de', targetType: 'project', targetId: this.projectId, after: { approvalStatus: 'rejected' } })
      uni.showToast({ title: this.labels.rejectSuccess, icon: 'none' })
      this.refresh()
    },
    async confirmDelivery() {
      if (!this.canManageProject) return
      const delivery = this.deliveries[0]
      if (!delivery) return uni.showToast({ title: this.labels.noDelivery, icon: 'none' })
      updateDelivery(delivery.deliveryId, { status: 'confirmed', completedAt: new Date().toISOString() })
      await updateProject(this.projectId, { status: 'completed', statusSource: 'enterprise_web_delivery_confirmed' }, Number(this.project.version || 0))
      await this.refresh()
    },
    openQuote(quote = {}) {
      this.navigateDetail('quoteDetail', { quoteId: quote.quoteId })
    },
    openOrder(order = {}) {
      this.navigateDetail('orderDetail', { orderId: order.orderId })
    },
    openDelivery(item = {}) {
      if (!item.deliveryId) return
      this.navigateDetail('deliveryDetail', { deliveryId: item.deliveryId })
    },
    navigateDetail(routeName = '', query = {}) {
      if (!hasEnterpriseWebRoute(routeName)) return uni.showToast({ title: this.labels.routeUnavailable, icon: 'none' })
      uni.navigateTo({ url: buildEnterpriseWebUrl(routeName, query) })
    },
    formatTime(value = '') {
      return value ? String(value).slice(0, 16).replace('T', ' ') : '--'
    },
    formatMoney(value = 0) {
      return `\u00a5${Number(value || 0).toFixed(0)}`
    },
    getProductTitle(item = {}) {
      const productInfo = item.productInfo || {}
      return item.title || productInfo.productTitle || productInfo.name || this.labels.unnamedProduct
    },
    getProductStatusLabel(status = '') {
      return PRODUCT_STATUS_LABELS[status] || status || '--'
    },
    getQuoteStatusLabel(status = '') {
      return QUOTE_STATUS_LABELS[status] || status || '--'
    },
    getOrderStatusLabel(status = '') {
      return ORDER_STATUS_LABELS[status] || status || '--'
    },
    getStatusLabel(status = '') {
      return getProjectStatusLabel(status)
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
.topbar, .panel, .state-card { background: #fff; border: 1px solid #e5e7eb; border-radius: 16px; box-shadow: 0 18px 40px rgba(15,23,42,0.05); }
.topbar { display: flex; justify-content: space-between; gap: 16px; padding: 20px 24px; margin-bottom: 18px; }
.page-title { display: block; font-size: 24px; font-weight: 800; }
.page-desc { display: block; margin-top: 6px; color: #64748b; font-size: 13px; }
.ghost-btn, .action-btn, .small-btn { height: 36px; line-height: 36px; border-radius: 10px; font-size: 13px; background: #eef2ff; color: #4f46e5; }
.action-btn.primary { background: #4f46e5; color: #fff; }
.detail-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.panel { padding: 20px; }
.wide { grid-column: 1 / -1; }
.panel-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 14px; }
.panel-title { display: block; margin-bottom: 14px; font-size: 17px; font-weight: 800; }
.panel-head .panel-title { margin-bottom: 0; }
.progress-value { color: #4f46e5; font-size: 18px; font-weight: 800; }
.info-grid { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 12px; }
.info-grid view { padding: 14px; border-radius: 12px; background: #f8fafc; }
.info-grid text { display: block; color: #64748b; font-size: 12px; }
.info-grid text + text { margin-top: 8px; color: #111827; font-size: 15px; font-weight: 700; }
.actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 16px; }
.danger { background: #fff1f2; color: #e11d48; }
.stage-tag { display: inline-block; padding: 5px 10px; border-radius: 999px; background: #eef2ff; color: #4f46e5; font-size: 13px; font-weight: 700; }
.stage-track { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 10px; }
.stage-item { padding: 14px 10px; border-radius: 14px; background: #f8fafc; border: 1px solid #e2e8f0; color: #64748b; text-align: center; }
.stage-dot { width: 28px; height: 28px; margin: 0 auto 8px; border-radius: 999px; background: #e5e7eb; color: #64748b; line-height: 28px; font-size: 12px; font-weight: 800; }
.stage-item.done { background: #eef2ff; border-color: #c7d2fe; color: #4338ca; }
.stage-item.done .stage-dot { background: #4f46e5; color: #fff; }
.stage-item.current { background: #f5f3ff; border-color: #8b5cf6; color: #5b21b6; }
.stage-item.current .stage-dot { background: #7c3aed; color: #fff; }
.mini-table { overflow-x: auto; }
.mini-row { min-width: 760px; display: grid; grid-template-columns: 1.2fr 0.8fr 0.8fr 1fr 0.8fr; gap: 12px; align-items: center; padding: 10px 0; border-bottom: 1px solid #eef2f7; font-size: 13px; }
.mini-head { color: #64748b; font-weight: 800; }
.mini-btn { height: 28px; line-height: 28px; border-radius: 8px; background: #f1f5f9; color: #334155; font-size: 12px; }
.list-item, .log-row { padding: 10px 0; border-bottom: 1px solid #eef2f7; color: #334155; font-size: 14px; }
.rich-list-item { display: flex; justify-content: space-between; gap: 12px; }
.clickable { cursor: pointer; }
.clickable:hover { background: #fbfdff; }
.rich-list-item text + text { color: #64748b; font-size: 13px; }
.log-row { display: grid; grid-template-columns: 1fr 1fr 1.2fr; gap: 12px; }
.empty, .state-card, .platform-tip { padding: 24px; color: #64748b; }
.denied { color: #b42318; }
@media (max-width: 900px) {
  .shell { display: block; }
  .sidebar { position: static; width: auto; }
  .main { margin-left: 0; padding: 16px; }
  .topbar, .detail-grid { display: block; }
  .panel { margin-bottom: 14px; }
  .info-grid, .log-row, .stage-track { grid-template-columns: 1fr; }
  .rich-list-item { display: block; }
  .rich-list-item text + text { display: block; margin-top: 6px; }
}
</style>

