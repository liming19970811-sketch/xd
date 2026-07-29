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
          <view v-for="item in menu" :key="item.key" :class="['menu-item', item.key === 'products' ? 'active' : '']" @click="goTo(item)">
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
          <view class="meta">
            <text>{{ guard.currentEnterprise.enterpriseName }}</text>
            <text>{{ guard.currentUser.name }} · {{ guard.currentRole }}</text>
          </view>
        </view>

        <view v-if="!guard.allowed" class="state-card denied">{{ guardMessage }}</view>
        <view v-else>
          <view class="filterbar">
            <input v-model="keyword" class="filter-input" :placeholder="labels.searchPlaceholder" />
            <picker :range="statusOptions" range-key="label" @change="handleStatusChange">
              <view class="filter-select">{{ currentStatusLabel }}</view>
            </picker>
          </view>

          <view class="table-card">
            <view class="table-head row">
              <text>{{ labels.productName }}</text>
              <text>{{ labels.sourceDesign }}</text>
              <text>{{ labels.productStatus }}</text>
              <text>{{ labels.completion }}</text>
              <text>{{ labels.owner }}</text>
              <text>{{ labels.updatedAt }}</text>
            </view>
            <view v-if="filteredProducts.length">
              <view v-for="product in filteredProducts" :key="product.productPackageId" class="row data-row" @click="openProduct(product)">
                <text>{{ product.productName }}</text>
                <text>{{ product.sourceDesignId || product.designTitle || '--' }}</text>
                <text><text class="status-tag">{{ product.productStatusLabel }}</text></text>
                <text>{{ product.overallCompletion }}%</text>
                <text>{{ product.ownerName || product.updatedBy || '--' }}</text>
                <text>{{ formatTime(product.updatedAt || product.createdAt) }}</text>
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
import { getList as getProducts } from '../../utils/repository/productPackageRepository.js'
import { buildProductDashboard } from '../../utils/service/productService.js'
import { canAccessTenantRecord, getEnterpriseGuardMessage, requirePermission } from '../../utils/enterprise-web/enterpriseWebGuard.js'
import { getEnterpriseWebMenu } from '../../utils/enterprise-web/enterpriseWebMenu.js'

const STATUS_OPTIONS = [
  { label: '\u5168\u90e8\u72b6\u6001', value: '' },
  { label: '\u8349\u7a3f', value: 'draft' },
  { label: '\u8bbe\u8ba1\u4e2d', value: 'designing' },
  { label: '\u5f85\u4e0a\u67b6', value: 'ready_for_sale' },
  { label: '\u5df2\u53d1\u5e03', value: 'published' },
  { label: '\u5df2\u4ea4\u4ed8', value: 'delivered' }
]

const LABELS = Object.freeze({
  brand: '\u8776\u53d8',
  brandDesc: '\u670d\u88c5\u4f01\u4e1a\u5de5\u4f5c\u53f0',
  title: '\u5546\u54c1\u8d44\u6599\u5305',
  desc: '\u8bfb\u53d6\u73b0\u6709 productPackageRepository \u4e0e productService\u3002',
  searchPlaceholder: '\u641c\u7d22\u5546\u54c1\u3001\u6765\u6e90\u8bbe\u8ba1\u3001\u8d1f\u8d23\u4eba',
  productName: '\u5546\u54c1\u540d\u79f0',
  sourceDesign: '\u6765\u6e90\u8bbe\u8ba1',
  productStatus: '\u5546\u4e1a\u72b6\u6001',
  completion: '\u8d44\u6599\u5b8c\u6574\u5ea6',
  owner: '\u8d1f\u8d23\u4eba',
  updatedAt: '\u66f4\u65b0\u65f6\u95f4',
  empty: '\u6682\u65e0\u5546\u54c1\u8d44\u6599\u5305',
  h5Only: '\u4f01\u4e1a\u7f51\u9875\u7248\u4ec5\u5728 H5 \u5e73\u53f0\u663e\u793a\u3002',
  detailToast: '\u5546\u54c1\u8d44\u6599\u8be6\u60c5\uff1a'
})

export default {
  data() {
    return {
      labels: LABELS,
      menu: getEnterpriseWebMenu(),
      guard: requirePermission('product.view'),
      products: [],
      keyword: '',
      status: '',
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
    filteredProducts() {
      const keyword = String(this.keyword || '').trim().toLowerCase()
      return this.products
        .filter((product) => !this.status || product.productStatus === this.status)
        .filter((product) => {
          if (!keyword) return true
          return [product.productName, product.sourceDesignId, product.designTitle, product.ownerName]
            .some((value) => String(value || '').toLowerCase().includes(keyword))
        })
    }
  },
  onLoad(options = {}) {
    this.status = options.status || ''
    this.keyword = options.keyword || ''
  },
  onShow() {
    this.refresh()
  },
  methods: {
    refresh() {
      this.guard = requirePermission('product.view')
      if (!this.guard.allowed) return
      this.products = getProducts()
        .filter((item) => canAccessTenantRecord(item, 'product.view').allowed)
        .map((item) => buildProductDashboard(item))
    },
    goTo(item = {}) {
      if (item.route && item.key !== 'products') uni.navigateTo({ url: item.route })
    },
    handleStatusChange(event) {
      const index = Number(event.detail.value) || 0
      this.status = this.statusOptions[index].value
    },
    openProduct(product = {}) {
      uni.showToast({
        title: `${this.labels.detailToast}${product.productName}`,
        icon: 'none'
      })
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
.main { flex: 1; margin-left: 216px; padding: 24px; box-sizing: border-box; }
.topbar, .filterbar, .table-card, .state-card { background: #fff; border: 1px solid #e5e7eb; border-radius: 16px; box-shadow: 0 18px 40px rgba(15,23,42,0.05); }
.topbar { display: flex; justify-content: space-between; gap: 16px; padding: 20px 24px; margin-bottom: 18px; }
.page-title { display: block; font-size: 24px; font-weight: 800; }
.page-desc, .meta text { display: block; margin-top: 6px; color: #64748b; font-size: 13px; }
.filterbar { display: flex; gap: 12px; padding: 14px; margin-bottom: 14px; }
.filter-input, .filter-select { height: 38px; padding: 0 12px; border-radius: 10px; background: #f8fafc; border: 1px solid #e2e8f0; font-size: 14px; box-sizing: border-box; }
.filter-input { flex: 1; }
.table-card { overflow: hidden; }
.row { display: grid; grid-template-columns: 1.4fr 1fr 0.9fr 0.8fr 0.9fr 1fr; gap: 12px; align-items: center; padding: 14px 18px; font-size: 13px; }
.table-head { color: #64748b; background: #f8fafc; font-weight: 700; }
.data-row { border-top: 1px solid #eef2f7; cursor: pointer; }
.data-row:hover { background: #fbfdff; }
.status-tag { display: inline-block; padding: 4px 8px; border-radius: 999px; background: #eef2ff; color: #4f46e5; }
.empty, .denied, .platform-tip { padding: 24px; color: #64748b; }
.denied { color: #b42318; }
@media (max-width: 900px) {
  .shell { display: block; }
  .sidebar { position: static; width: auto; }
  .main { margin-left: 0; padding: 16px; }
  .topbar, .filterbar { display: block; }
  .filter-input, .filter-select { width: 100%; margin-top: 10px; }
  .row { grid-template-columns: 1fr; }
}
</style>
