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
          <view v-for="item in menu" :key="item.key" :class="['menu-item', item.key === 'analytics' ? 'active' : '']" @click="goTo(item)">
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

        <view v-if="!guard.allowed" class="state-card denied">{{ guardMessage }}</view>
        <view v-else>
          <view class="metric-grid">
            <view v-for="item in overviewMetrics" :key="item.label" class="metric-card">
              <text class="metric-label">{{ item.label }}</text>
              <text class="metric-value">{{ item.value }}</text>
            </view>
          </view>

          <view class="content-grid">
            <view class="panel">
              <text class="panel-title">{{ labels.production }}</text>
              <view v-for="item in productionMetrics" :key="item.label" class="list-row">
                <text>{{ item.label }}</text>
                <text>{{ item.value }}</text>
              </view>
            </view>

            <view class="panel">
              <text class="panel-title">{{ labels.team }}</text>
              <view v-for="item in teamMetrics" :key="item.label" class="list-row">
                <text>{{ item.label }}</text>
                <text>{{ item.value }}</text>
              </view>
            </view>

            <view class="panel">
              <text class="panel-title">{{ labels.audit }}</text>
              <view v-for="item in auditMetrics" :key="item.label" class="list-row">
                <text>{{ item.label }}</text>
                <text>{{ item.value }}</text>
              </view>
            </view>

            <view class="panel">
              <text class="panel-title">{{ labels.ai }}</text>
              <view v-for="item in aiMetrics" :key="item.label" class="list-row">
                <text>{{ item.label }}</text>
                <text>{{ item.value }}</text>
              </view>
              <text class="hint">{{ labels.aiHint }}</text>
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
import { getDeliveries } from '../../utils/service/deliveryService.js'
import { getQuotes } from '../../utils/service/quoteService.js'
import { canAccessTenantRecord, getEnterpriseGuardMessage, requirePermission } from '../../utils/enterprise-web/enterpriseWebGuard.js'
import { getEnterpriseWebMenu } from '../../utils/enterprise-web/enterpriseWebMenu.js'
import { getWorkspaceProductions, getWorkspaceProductionStats } from '../../utils/workspace/workspaceProduction.js'

const LABELS = Object.freeze({
  brand: '\u8776\u53d8',
  brandDesc: '\u4f01\u4e1a\u7ecf\u8425\u95ed\u73af',
  title: '\u4f01\u4e1a\u6570\u636e\u4e2d\u5fc3 2.0',
  desc: '\u53ea\u8bfb\u805a\u5408\u5df2\u6709\u6570\u636e\uff0cAI \u9884\u8ba1\u6d88\u8017\u4e0d\u8fde\u63a5\u771f\u5b9e\u989d\u5ea6\u3002',
  production: '\u751f\u4ea7\u5206\u6790',
  team: '\u56e2\u961f\u6548\u7387',
  audit: '\u5ba1\u8ba1\u8d8b\u52bf',
  ai: 'AI \u4f7f\u7528\u8d8b\u52bf',
  aiHint: 'AI \u9884\u8ba1\u6d88\u8017\u4e0d\u8fde\u63a5\u771f\u5b9e\u989d\u5ea6',
  h5Only: '\u4f01\u4e1a\u7f51\u9875\u7248\u4ec5\u5728 H5 \u5e73\u53f0\u663e\u793a\u3002',
  customers: '\u5ba2\u6237\u6570',
  projects: '\u9879\u76ee\u6570',
  products: '\u5546\u54c1\u6570',
  orders: '\u8ba2\u5355\u6570',
  amount: '\u6210\u4ea4\u91d1\u989d',
  deliveries: '\u4ea4\u4ed8\u6570\u91cf',
  plans: '\u8bbe\u8ba1\u65b9\u6848\u6570',
  productProduction: '\u5546\u54c1\u751f\u4ea7\u6570',
  generatedImages: '\u751f\u6210\u56fe\u7247\u6570',
  detailPages: '\u8be6\u60c5\u9875\u6570',
  deliveryAssets: '\u4ea4\u4ed8\u7d20\u6750\u6570',
  salesFollow: '\u9500\u552e\u8ddf\u8fdb',
  designPlans: '\u8bbe\u8ba1\u65b9\u6848',
  operationAssets: '\u8fd0\u8425\u7d20\u6750',
  projectManageCount: '\u9879\u76ee\u7ba1\u7406\u6570\u91cf',
  today: '\u4eca\u65e5',
  week: '\u672c\u5468',
  month: '\u672c\u6708',
  generations: '\u751f\u6210\u6b21\u6570',
  assets: '\u7d20\u6750\u6570\u91cf',
  estimatedUsage: '\u9884\u8ba1\u6d88\u8017'
})

export default {
  data() {
    return {
      labels: LABELS,
      menu: getEnterpriseWebMenu(),
      guard: requirePermission('analytics.view'),
      projects: [],
      products: [],
      quotes: [],
      orders: [],
      deliveries: [],
      productions: [],
      auditLogs: []
    }
  },
  computed: {
    guardMessage() { return getEnterpriseGuardMessage(this.guard.reason) },
    orderAmount() { return this.orders.reduce((sum, item) => sum + Number(item.amount || 0), 0) },
    productionStats() { return getWorkspaceProductionStats(this.productions) },
    overviewMetrics() {
      return [
        { label: this.labels.customers, value: new Set(this.projects.map((item) => item.customerId || item.customerName || item.clientName).filter(Boolean)).size },
        { label: this.labels.projects, value: this.projects.length },
        { label: this.labels.products, value: this.products.length },
        { label: this.labels.orders, value: this.orders.length },
        { label: this.labels.amount, value: `\u00a5${this.orderAmount.toFixed(0)}` },
        { label: this.labels.deliveries, value: this.deliveries.length }
      ]
    },
    productionMetrics() {
      const detailPages = this.products.filter((item) => Array.isArray(item.detailModules) && item.detailModules.length).length
      const generatedImages = this.productions.reduce((sum, item) => sum + Number(item.workCount || item.assetIds.length || 0), 0)
      return [
        { label: this.labels.plans, value: this.productionStats.totalPlans || 0 },
        { label: this.labels.productProduction, value: this.products.length },
        { label: this.labels.generatedImages, value: generatedImages },
        { label: this.labels.detailPages, value: detailPages },
        { label: this.labels.deliveryAssets, value: this.deliveries.reduce((sum, item) => sum + (Array.isArray(item.assetVersionIds) ? item.assetVersionIds.length : 0), 0) }
      ]
    },
    teamMetrics() {
      return [
        { label: this.labels.salesFollow, value: this.quotes.length },
        { label: this.labels.designPlans, value: this.productionStats.totalPlans || 0 },
        { label: this.labels.operationAssets, value: this.products.length },
        { label: this.labels.projectManageCount, value: this.projects.length }
      ]
    },
    auditMetrics() {
      const now = Date.now()
      const today = new Date().toISOString().slice(0, 10)
      return [
        { label: this.labels.today, value: this.auditLogs.filter((item) => String(item.createdAt || '').startsWith(today)).length },
        { label: this.labels.week, value: this.auditLogs.filter((item) => now - new Date(item.createdAt || 0).getTime() <= 7 * 86400000).length },
        { label: this.labels.month, value: this.auditLogs.filter((item) => now - new Date(item.createdAt || 0).getTime() <= 30 * 86400000).length }
      ]
    },
    aiMetrics() {
      const generationCount = this.productionStats.totalGenerations || 0
      const assetCount = this.productions.reduce((sum, item) => sum + Number(item.workCount || item.assetIds.length || 0), 0)
      return [
        { label: this.labels.generations, value: generationCount },
        { label: this.labels.assets, value: assetCount },
        { label: this.labels.estimatedUsage, value: `${generationCount * 10} \u70b9` }
      ]
    }
  },
  onShow() { this.refresh() },
  methods: {
    refresh() {
      this.guard = requirePermission('analytics.view')
      this.menu = getEnterpriseWebMenu()
      if (!this.guard.allowed) return
      this.projects = getProjects().filter((item) => canAccessTenantRecord(item, 'project.view').allowed)
      this.products = getProducts().filter((item) => canAccessTenantRecord(item, 'product.view').allowed)
      this.quotes = getQuotes().filter((item) => canAccessTenantRecord(item, 'quote.view').allowed)
      this.orders = getOrders().filter((item) => canAccessTenantRecord(item, 'order.view').allowed)
      this.deliveries = getDeliveries().filter((item) => canAccessTenantRecord(item, 'delivery.view').allowed)
      this.productions = getWorkspaceProductions()
      this.auditLogs = getAuditLogs()
    },
    goTo(item = {}) {
      if (item.route && item.key !== 'analytics') uni.navigateTo({ url: item.route })
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
.topbar,.metric-card,.panel,.state-card { background: #fff; border: 1px solid #e5e7eb; border-radius: 16px; box-shadow: 0 18px 40px rgba(15,23,42,0.05); }
.topbar { padding: 20px 24px; margin-bottom: 18px; }
.page-title { display: block; font-size: 24px; font-weight: 800; }
.page-desc { display: block; margin-top: 6px; color: #64748b; font-size: 13px; }
.metric-grid { display: grid; grid-template-columns: repeat(6, minmax(0,1fr)); gap: 14px; }
.metric-card { padding: 18px; }
.metric-label { display: block; color: #64748b; font-size: 13px; }
.metric-value { display: block; margin-top: 10px; color: #111827; font-size: 24px; font-weight: 800; }
.content-grid { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 16px; margin-top: 16px; }
.panel { padding: 20px; }
.panel-title { display: block; margin-bottom: 14px; font-size: 17px; font-weight: 800; }
.list-row { display: flex; justify-content: space-between; gap: 12px; padding: 10px 0; border-bottom: 1px solid #eef2f7; font-size: 14px; color: #334155; }
.hint { display: block; margin-top: 12px; color: #8a6d3b; font-size: 12px; }
.denied,.platform-tip { padding: 24px; color: #b42318; }
@media (max-width: 900px) { .shell { display: block; } .sidebar { position: static; width: auto; } .main { margin-left: 0; padding: 16px; } .metric-grid,.content-grid { grid-template-columns: 1fr; } }
</style>
