<template>
  <view class="enterprise-page">
    <!-- #ifdef H5 -->
    <view class="shell">
      <view class="sidebar">
        <view class="brand">
          <text class="brand-title">{{ labels.brandTitle }}</text>
          <text class="brand-desc">{{ labels.brandDesc }}</text>
        </view>
        <view class="menu">
          <view
            v-for="item in menu"
            :key="item.key"
            :class="['menu-item', item.key === 'dashboard' ? 'active' : '']"
            @click="goTo(item)"
          >
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
          <view class="meta">
            <text class="enterprise-name">{{ enterpriseName }}</text>
            <text class="user-name">{{ userName }}</text>
            <text class="user-role">{{ roleName }}</text>
            <button class="logout-btn" :disabled="isLoggingOut" @click="handleLogout">
              {{ isLoggingOut ? labels.logoutLoading : labels.logout }}
            </button>
          </view>
        </view>

        <view v-if="!guard.allowed" class="state-card denied">
          <text>{{ guardMessage }}</text>
        </view>

        <view v-else>
          <view class="metric-grid">
            <view v-for="item in metrics" :key="item.key" class="metric-card">
              <text class="metric-label">{{ item.label }}</text>
              <text class="metric-value">{{ item.value }}</text>
              <text class="metric-desc">{{ item.desc }}</text>
            </view>
          </view>

          <view class="todo-grid">
            <view v-for="item in todayTodos" :key="item.key" class="todo-card" @click="openQuick(item)">
              <text class="todo-label">{{ item.label }}</text>
              <text class="todo-value">{{ item.value }}</text>
              <text class="todo-desc">{{ item.desc }}</text>
            </view>
          </view>

          <view class="content-grid">
            <view class="panel">
              <text class="panel-title">{{ labels.overviewTitle }}</text>
              <view class="compact-row">
                <text>{{ labels.projectCount }}</text>
                <text>{{ summary.projectCount }}</text>
              </view>
              <view class="compact-row">
                <text>{{ labels.productCount }}</text>
                <text>{{ summary.productCount }}</text>
              </view>
              <view class="compact-row">
                <text>{{ labels.orderAmount }}</text>
                <text>{{ summary.orderAmountText }}</text>
              </view>
            </view>

            <view class="panel">
              <text class="panel-title">{{ labels.recentTitle }}</text>
              <view v-if="recentActivities.length" class="audit-list">
                <view
                  v-for="activity in recentActivities"
                  :key="activity.activityId"
                  class="audit-item activity-item"
                  @click="openActivity(activity)"
                >
                  <view>
                    <text class="activity-action">{{ activity.action }}</text>
                    <text class="activity-meta">{{ activity.operator }} · {{ activity.targetType }} {{ activity.targetId }}</text>
                  </view>
                  <text>{{ formatTime(activity.createdAt) }}</text>
                </view>
              </view>
              <view v-else class="empty">{{ labels.emptyRecent }}</view>
            </view>

            <view class="panel wide-panel">
              <text class="panel-title">{{ labels.riskTitle }}</text>
              <view v-if="riskItems.length" class="risk-list">
                <view v-for="risk in riskItems" :key="risk.riskId" class="risk-item" @click="openRisk(risk)">
                  <text :class="['risk-level', risk.level]">{{ risk.levelText }}</text>
                  <view class="risk-copy">
                    <text class="risk-title">{{ risk.title }}</text>
                    <text class="risk-desc">{{ risk.description }}</text>
                  </view>
                </view>
              </view>
              <view v-else class="empty">{{ labels.emptyRisk }}</view>
            </view>
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
import { getList as getOrders } from '../../utils/repository/orderRepository.js'
import { getList as getProducts } from '../../utils/repository/productPackageRepository.js'
import { getList as getProjects } from '../../utils/repository/projectRepository.js'
import { getList as getDeliveries } from '../../utils/repository/deliveryRepository.js'
import { getMembers } from '../../utils/auth/memberService.js'
import { clearSession } from '../../utils/auth/authSessionService.js'
import { buildEnterpriseWebUrl, hasEnterpriseWebRoute, navigateEnterpriseWeb } from '../../utils/enterprise-web/enterpriseWebRoutes.js'
import { getEnterpriseWebMenu } from '../../utils/enterprise-web/enterpriseWebMenu.js'
import { canAccessTenantRecord, getEnterpriseGuardMessage, requirePermission } from '../../utils/enterprise-web/enterpriseWebGuard.js'
import { getQuotes } from '../../utils/service/quoteService.js'
import { calculateProductRisk } from '../../utils/service/productService.js'
import { getWorkspaceProductions, getWorkspaceProductionStats } from '../../utils/workspace/workspaceProduction.js'

const LABELS = Object.freeze({
  brandTitle: '\u8776\u53d8',
  brandDesc: '\u670d\u88c5\u4f01\u4e1a\u5de5\u4f5c\u53f0',
  pageTitle: '\u7ecf\u8425\u9996\u9875',
  pageDesc: '\u4f01\u4e1a\u6570\u636e\u805a\u5408\u5c55\u793a\uff0c\u4e0d\u4fee\u6539\u539f\u59cb\u4e1a\u52a1\u6570\u636e\u3002',
  logout: '\u9000\u51fa\u767b\u5f55',
  logoutLoading: '\u6b63\u5728\u9000\u51fa...',
  unselectedEnterprise: '\u672a\u9009\u62e9\u4f01\u4e1a',
  miniappUser: '\u5c0f\u7a0b\u5e8f\u7528\u6237',
  overviewTitle: '\u9500\u552e\u4e0e\u9879\u76ee\u6982\u89c8',
  projectCount: '\u9879\u76ee\u6570\u91cf',
  productCount: '\u5546\u54c1\u8d44\u6599\u5305',
  orderAmount: '\u8ba2\u5355\u91d1\u989d',
  recentTitle: '\u6700\u8fd1\u52a8\u6001',
  riskTitle: '\u98ce\u9669\u4e2d\u5fc3',
  emptyRecent: '\u6682\u65e0\u6700\u8fd1\u52a8\u6001',
  emptyRisk: '\u6682\u65e0\u7ecf\u8425\u98ce\u9669',
  h5Only: '\u4f01\u4e1a\u7f51\u9875\u7248\u4ec5\u5728 H5 \u5e73\u53f0\u663e\u793a\u3002'
})

export default {
  data() {
    return {
      labels: LABELS,
      menu: getEnterpriseWebMenu(),
      guard: requirePermission('enterprise.view'),
      projects: [],
      products: [],
      quotes: [],
      orders: [],
      deliveries: [],
      productions: [],
      auditLogs: [],
      members: [],
      isLoggingOut: false
    }
  },
  computed: {
    enterpriseName() {
      return this.guard.currentEnterprise.enterpriseName || this.labels.unselectedEnterprise
    },
    userName() {
      return this.guard.currentUser.name || this.labels.miniappUser
    },
    roleName() {
      return this.guard.currentRole || 'admin'
    },
    guardMessage() {
      return getEnterpriseGuardMessage(this.guard.reason)
    },
    summary() {
      const orderAmount = this.orders.reduce((total, item) => total + Number(item.amount || item.totalAmount || 0), 0)
      const stats = getWorkspaceProductionStats(this.productions)
      return {
        customerCount: new Set(this.projects.map((item) => item.customerId || item.customerName || item.clientName).filter(Boolean)).size,
        projectCount: this.projects.length,
        productCount: this.products.length,
        orderCount: this.orders.length,
        orderAmountText: `¥${orderAmount.toFixed(0)}`,
        deliveryCount: this.deliveries.length,
        generationCount: stats.totalGenerations || 0,
        auditCount: this.auditLogs.length,
        memberCount: this.members.length
      }
    },
    metrics() {
      return [
        { key: 'customers', label: '\u5ba2\u6237\u6570', value: this.summary.customerCount, desc: '\u6765\u81ea\u9879\u76ee\u5ba2\u6237\u5b57\u6bb5' },
        { key: 'projects', label: '\u9879\u76ee\u6570', value: this.summary.projectCount, desc: '\u5f53\u524d\u4f01\u4e1a\u9879\u76ee' },
        { key: 'products', label: '\u5546\u54c1\u6570', value: this.summary.productCount, desc: '\u5546\u54c1\u8d44\u6599\u5305' },
        { key: 'orders', label: '\u8ba2\u5355\u6570', value: this.summary.orderCount, desc: '\u4f01\u4e1a\u8ba2\u5355\u8bb0\u5f55' },
        { key: 'amount', label: '\u6210\u4ea4\u91d1\u989d', value: this.summary.orderAmountText, desc: '\u672c\u5730\u8ba2\u5355\u805a\u5408' },
        { key: 'deliveries', label: '\u4ea4\u4ed8\u6570\u91cf', value: this.summary.deliveryCount, desc: '\u4ea4\u4ed8\u8bb0\u5f55' },
        { key: 'generations', label: '\u751f\u6210\u6b21\u6570', value: this.summary.generationCount, desc: '\u751f\u4ea7\u5386\u53f2' },
        { key: 'audit', label: '\u5ba1\u8ba1\u8d8b\u52bf', value: this.summary.auditCount, desc: '\u64cd\u4f5c\u65e5\u5fd7\u6570\u91cf' }
      ]
    },
    todayTodos() {
      return [
        { key: 'todo-quotes', label: '\u5f85\u786e\u8ba4\u62a5\u4ef7', value: this.countUnique(this.quotes.filter((item) => item.status === 'sent'), 'quoteId'), desc: '\u5ba2\u6237\u5df2\u6536\u5230\uff0c\u7b49\u5f85\u786e\u8ba4', routeName: 'quotes', query: { status: 'sent' } },
        { key: 'todo-orders', label: '\u5f85\u5904\u7406\u8ba2\u5355', value: this.countUnique(this.orders.filter((item) => ['pending_payment', 'processing'].includes(item.status)), 'orderId'), desc: '\u9700\u8981\u8ddf\u8fdb\u652f\u4ed8\u6216\u751f\u4ea7', routeName: 'orders', query: { statusGroup: 'active' } },
        { key: 'todo-deliveries', label: '\u5f85\u4ea4\u4ed8\u9879\u76ee', value: this.countUnique(this.deliveries.filter((item) => ['pending', 'preparing'].includes(item.status)), 'deliveryId'), desc: '\u4ea4\u4ed8\u6750\u6599\u5f85\u51c6\u5907', routeName: 'deliveries', query: { statusGroup: 'pre_delivery' } },
        { key: 'todo-feedback', label: '\u5ba2\u6237\u53cd\u9988', value: this.countUnique(this.deliveries.filter((item) => item.customerFeedbackStatus === 'revision_required'), 'deliveryId'), desc: '\u5ba2\u6237\u8981\u6c42\u4fee\u6539\u6216\u8865\u5145', routeName: 'deliveries', query: { feedback: 'revision_required' } },
        { key: 'todo-approval', label: '\u5ba1\u6279\u4e8b\u9879', value: this.countUnique(this.auditLogs.filter((item) => String(item.action || '').includes('\u5ba1\u6279')), 'auditId'), desc: '\u6700\u8fd1\u5ba1\u6279\u76f8\u5173\u8bb0\u5f55', routeName: 'audit', query: { action: '\u5ba1\u6279' } }
      ]
    },
    recentActivities() {
      const seen = new Set()
      return [...this.auditLogs]
        .sort((left, right) => String(right.createdAt || '').localeCompare(String(left.createdAt || '')))
        .filter((item) => {
          const key = [item.targetType || 'business', item.targetId || '', item.action || 'update'].join('::')
          if (seen.has(key)) return false
          seen.add(key)
          return true
        })
        .slice(0, 10)
        .map((item) => ({
          activityId: item.auditId || `${item.targetType || 'business'}-${item.targetId || item.createdAt}`,
          createdAt: item.createdAt,
          operator: item.operator || '\u7cfb\u7edf',
          action: item.action || '\u66f4\u65b0\u4e1a\u52a1\u6570\u636e',
          targetType: item.targetType || 'business',
          targetId: item.targetId || '',
          routeName: this.getTargetRouteName(item.targetType),
          query: this.getTargetQuery(item.targetType, item.targetId)
        }))
    },
    riskItems() {
      const projectRisks = this.projects
        .filter((item) => this.isProjectDelayed(item))
        .map((item) => ({
          riskId: `project-${item.projectId}`,
          level: 'high',
          levelText: '\u9ad8',
          targetType: 'project',
          routeName: 'projectDetail',
          query: { projectId: item.projectId },
          title: '\u9879\u76ee\u5ef6\u671f',
          description: `${item.title || item.projectName || item.projectId} \u5df2\u8d85\u8fc7\u8ba1\u5212\u4ea4\u4ed8\u65f6\u95f4\u3002`
        }))
      const productRisks = this.products
        .map((item) => ({ product: item, risk: calculateProductRisk(item) }))
        .filter((item) => item.risk.code !== 'low')
        .map((item) => ({
          riskId: `product-${item.product.productPackageId}`,
          level: item.risk.code,
          levelText: item.risk.level,
          targetType: 'product',
          title: '\u5546\u54c1\u7f3a\u7d20\u6750',
          description: `${this.getProductTitle(item.product)}: ${item.risk.issues.join(', ') || '\u8d44\u6599\u4e0d\u5b8c\u6574'}`
        }))
      const orderRisks = this.orders
        .filter((item) => item.status === 'closed' || (item.status === 'pending_payment' && this.getAgeDays(item.updatedAt || item.createdAt) > 7))
        .map((item) => ({
          riskId: `order-${item.orderId}`,
          level: item.status === 'closed' ? 'high' : 'medium',
          levelText: item.status === 'closed' ? '\u9ad8' : '\u4e2d',
          targetType: 'order',
          routeName: 'orderDetail',
          query: { orderId: item.orderId },
          title: '\u8ba2\u5355\u5f02\u5e38',
          description: `${item.orderId} ${this.getOrderStatusLabel(item.status)}`
        }))
      const deliveryRisks = this.deliveries
        .filter((item) => item.status !== 'confirmed' && this.getAgeDays(item.updatedAt || item.createdAt) > 7)
        .map((item) => ({
          riskId: `delivery-${item.deliveryId}`,
          level: 'medium',
          levelText: '\u4e2d',
          targetType: 'delivery',
          routeName: 'deliveryDetail',
          query: { deliveryId: item.deliveryId },
          title: '\u4ea4\u4ed8\u8d85\u671f',
          description: `${item.deliveryId} \u5df2\u8d85\u8fc7 7 \u5929\u672a\u786e\u8ba4`
        }))
      return this.uniqueBy([...projectRisks, ...productRisks, ...orderRisks, ...deliveryRisks], 'riskId').slice(0, 8)
    }
  },
  onShow() {
    this.refresh()
  },
  methods: {
    async handleLogout() {
      if (this.isLoggingOut) return
      this.isLoggingOut = true
      try {
        await clearSession()
      } finally {
        this.isLoggingOut = false
        navigateEnterpriseWeb('login')
      }
    },
    refresh() {
      this.guard = requirePermission('enterprise.view')
      this.menu = getEnterpriseWebMenu()
      if (!this.guard.allowed) return
      this.projects = getProjects().filter((item) => canAccessTenantRecord(item, 'project.view').allowed)
      this.products = getProducts().filter((item) => canAccessTenantRecord(item, 'product.view').allowed)
      this.quotes = getQuotes().filter((item) => canAccessTenantRecord(item, 'quote.view').allowed)
      this.orders = getOrders().filter((item) => canAccessTenantRecord(item, 'order.view').allowed)
      this.deliveries = getDeliveries().filter((item) => canAccessTenantRecord(item, 'delivery.view').allowed)
      this.productions = getWorkspaceProductions()
      this.auditLogs = getAuditLogs()
      this.members = getMembers(this.guard.currentEnterprise.enterpriseId)
    },
    goTo(item = {}) {
      if (item.route && item.key !== 'dashboard') uni.navigateTo({ url: item.route })
    },
    openQuick(item = {}) {
      if (!item.routeName) return
      this.navigateRoute(item.routeName, item.query || {})
    },
    openActivity(activity = {}) {
      if (!activity.routeName) {
        uni.showToast({ title: '\u8be5\u52a8\u6001\u6682\u65e0\u8be6\u60c5\u9875', icon: 'none' })
        return
      }
      this.navigateRoute(activity.routeName, activity.query || {})
    },
    openRisk(risk = {}) {
      if (!risk.routeName) {
        uni.showToast({ title: '\u8be5\u98ce\u9669\u6682\u65e0\u8be6\u60c5\u9875', icon: 'none' })
        return
      }
      this.navigateRoute(risk.routeName, risk.query || {})
    },
    navigateRoute(routeName = '', query = {}) {
      if (!hasEnterpriseWebRoute(routeName)) {
        uni.showToast({ title: '\u76ee\u6807\u9875\u9762\u6682\u672a\u5f00\u653e', icon: 'none' })
        return
      }
      uni.navigateTo({ url: buildEnterpriseWebUrl(routeName, query) })
    },
    uniqueBy(items = [], key = '') {
      const seen = new Set()
      return (Array.isArray(items) ? items : []).filter((item) => {
        const value = String(item && item[key] ? item[key] : '')
        if (!value || seen.has(value)) return false
        seen.add(value)
        return true
      })
    },
    countUnique(items = [], key = '') {
      return this.uniqueBy(items, key).length
    },
    getTargetRouteName(targetType = '') {
      return { project: 'projectDetail', quote: 'quoteDetail', order: 'orderDetail', delivery: 'deliveryDetail' }[targetType] || ''
    },
    getTargetQuery(targetType = '', targetId = '') {
      const queryKey = { project: 'projectId', quote: 'quoteId', order: 'orderId', delivery: 'deliveryId' }[targetType]
      return queryKey ? { [queryKey]: targetId } : {}
    },
    formatTime(value = '') {
      if (!value) return '--'
      return String(value).slice(0, 16).replace('T', ' ')
    },
    getAgeDays(value = '') {
      const date = value ? new Date(value) : null
      if (!date || Number.isNaN(date.getTime())) return 0
      return (Date.now() - date.getTime()) / 86400000
    },
    isProjectDelayed(project = {}) {
      const value = project.deadline || project.expectedDeliveryDate || project.expectedDeliveryTime
      const date = value ? new Date(value) : null
      if (!date || Number.isNaN(date.getTime())) return false
      return date.getTime() < Date.now() && !['completed', 'archived', 'delivered'].includes(project.status)
    },
    getProductTitle(product = {}) {
      const info = product.productInfo || {}
      return info.productTitle || info.name || product.title || product.productPackageId || '\u672a\u547d\u540d\u5546\u54c1'
    },
    getOrderStatusLabel(status = '') {
      return { pending_payment: '\u5f85\u652f\u4ed8', processing: '\u5904\u7406\u4e2d', completed: '\u5df2\u5b8c\u6210', closed: '\u5df2\u5173\u95ed' }[status] || '\u5f85\u652f\u4ed8'
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
.main { flex: 1; margin-left: 216px; padding: 24px; box-sizing: border-box; }
.topbar, .metric-card, .panel, .state-card { background: #fff; border: 1px solid #e5e7eb; border-radius: 16px; box-shadow: 0 18px 40px rgba(15,23,42,0.05); }
.topbar { display: flex; justify-content: space-between; gap: 16px; padding: 20px 24px; margin-bottom: 18px; }
.page-title { display: block; font-size: 24px; font-weight: 800; }
.page-desc, .meta text, .metric-desc, .metric-label, .empty { display: block; color: #64748b; font-size: 13px; }
.page-desc, .meta text, .metric-desc { margin-top: 6px; }
.meta { min-width: 180px; text-align: right; }
.enterprise-name { color: #172033; font-weight: 800; }
.user-name { color: #172033; font-weight: 700; }
.user-role { color: #64748b; }
.logout-btn { display: inline-block; margin-top: 10px; min-width: 86px; height: 32px; line-height: 32px; border-radius: 8px; background: #fff1f2; color: #e11d48; font-size: 12px; }
.logout-btn[disabled] { color: #94a3b8; background: #f1f5f9; }
.metric-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; }
.metric-card { padding: 18px; }
.metric-value { display: block; margin-top: 10px; font-size: 26px; font-weight: 800; color: #111827; }
.todo-grid { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 12px; margin-top: 16px; }
.todo-card { padding: 16px; border-radius: 14px; background: #111827; color: #fff; cursor: pointer; }
.todo-label,.todo-value,.todo-desc { display: block; }
.todo-label { color: #cbd5e1; font-size: 12px; }
.todo-value { margin-top: 8px; font-size: 26px; font-weight: 800; }
.todo-desc { margin-top: 6px; color: #a9b4ca; font-size: 12px; }
.content-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 16px; }
.panel { padding: 20px; }
.wide-panel { grid-column: 1 / -1; }
.panel-title { display: block; margin-bottom: 14px; font-size: 17px; font-weight: 800; }
.compact-row, .audit-item { display: flex; justify-content: space-between; gap: 12px; padding: 10px 0; border-bottom: 1px solid #eef2f7; color: #334155; font-size: 14px; }
.activity-item { align-items: flex-start; cursor: pointer; }
.activity-action,.activity-meta { display: block; }
.activity-action { color: #111827; font-weight: 700; }
.activity-meta { margin-top: 4px; color: #64748b; font-size: 12px; }
.risk-list { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
.risk-item { display: flex; gap: 12px; padding: 14px; border-radius: 12px; background: #f8fafc; border: 1px solid #e2e8f0; cursor: pointer; }
.risk-level { flex: 0 0 28px; height: 28px; border-radius: 999px; text-align: center; line-height: 28px; font-size: 12px; font-weight: 800; }
.risk-level.high { background: #fee2e2; color: #b42318; }
.risk-level.medium { background: #fef3c7; color: #92400e; }
.risk-level.low { background: #e0f2fe; color: #0369a1; }
.risk-copy { flex: 1; min-width: 0; }
.risk-title,.risk-desc { display: block; }
.risk-title { color: #111827; font-size: 14px; font-weight: 800; }
.risk-desc { margin-top: 4px; color: #64748b; font-size: 12px; line-height: 1.6; }
.denied { padding: 24px; color: #b42318; }
.platform-tip { padding: 48px 24px; color: #64748b; }
@media (max-width: 900px) {
  .shell { display: block; }
  .sidebar { position: static; width: auto; }
  .main { margin-left: 0; padding: 16px; }
  .metric-grid, .content-grid, .todo-grid, .risk-list { grid-template-columns: 1fr; }
  .topbar { display: block; }
  .meta { margin-top: 16px; text-align: left; }
}
</style>
