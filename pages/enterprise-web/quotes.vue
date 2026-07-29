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
          <view v-for="item in menu" :key="item.key" :class="['menu-item', item.key === 'quotes' ? 'active' : '']" @click="goTo(item)">
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
          <button v-if="canManageQuote" class="primary-btn" @click="createDraft">{{ labels.createQuote }}</button>
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
              <text>{{ labels.quoteId }}</text>
              <text>{{ labels.customer }}</text>
              <text>{{ labels.project }}</text>
              <text>{{ labels.amount }}</text>
              <text>{{ labels.status }}</text>
              <text>{{ labels.updatedAt }}</text>
              <text>{{ labels.action }}</text>
            </view>
            <view v-if="filteredQuotes.length">
              <view v-for="quote in filteredQuotes" :key="quote.quoteId" class="row data-row">
                <text class="strong" @click="openDetail(quote)">{{ quote.quoteId }}</text>
                <text>{{ quote.customer || quote.customerName || '--' }}</text>
                <text>{{ getProjectName(quote.projectId) }}</text>
                <text>{{ formatMoney(quote.amount) }}</text>
                <text><text class="status-tag">{{ getQuoteStatusLabel(quote.status) }}</text></text>
                <text>{{ formatTime(quote.updatedAt || quote.createdAt) }}</text>
                <view class="actions">
                  <button class="mini-btn" @click="openDetail(quote)">{{ labels.view }}</button>
                  <button v-if="canManageQuote" class="mini-btn" @click="send(quote)">{{ labels.send }}</button>
                  <button v-if="canManageQuote" class="mini-btn primary" @click="confirm(quote)">{{ labels.confirm }}</button>
                  <button v-if="canManageQuote" class="mini-btn danger" @click="reject(quote)">{{ labels.reject }}</button>
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
import { getCurrentMember, getCurrentUser } from '../../utils/auth/authRepository.js'
import { getList as getProjects } from '../../utils/repository/projectRepository.js'
import { buildEnterpriseWebUrl } from '../../utils/enterprise-web/enterpriseWebRoutes.js'
import { canAccessTenantRecord, getEnterpriseGuardMessage, requirePermission } from '../../utils/enterprise-web/enterpriseWebGuard.js'
import { PERMISSION_KEYS } from '../../utils/permission/permissionCatalog.js'
import { createQuote, confirmQuote, getQuotes, rejectQuote, sendQuote } from '../../utils/service/quoteService.js'
import '../../utils/service/orderService.js'
import '../../utils/service/projectService.js'
import { getEnterpriseWebMenu } from '../../utils/enterprise-web/enterpriseWebMenu.js'

const LABELS = Object.freeze({
  brand: '\u8776\u53d8',
  brandDesc: '\u4f01\u4e1a\u7ecf\u8425\u95ed\u73af',
  pageTitle: '\u62a5\u4ef7\u7ba1\u7406',
  pageDesc: '\u62a5\u4ef7\u786e\u8ba4\u540e\u901a\u8fc7 QUOTE_CONFIRMED \u4e8b\u4ef6\u5e42\u7b49\u521b\u5efa\u8ba2\u5355\u3002',
  loading: '\u52a0\u8f7d\u62a5\u4ef7\u4e2d...',
  error: '\u52a0\u8f7d\u5931\u8d25',
  h5Only: '\u4f01\u4e1a\u7f51\u9875\u7248\u4ec5\u5728 H5 \u5e73\u53f0\u663e\u793a\u3002',
  createQuote: '\u521b\u5efa\u62a5\u4ef7',
  searchPlaceholder: '\u641c\u7d22\u62a5\u4ef7\u3001\u5ba2\u6237\u6216\u9879\u76ee',
  allStatuses: '\u5168\u90e8\u72b6\u6001',
  minAmount: '\u6700\u5c0f\u91d1\u989d',
  maxAmount: '\u6700\u5927\u91d1\u989d',
  quoteId: '\u62a5\u4ef7 ID',
  customer: '\u5ba2\u6237',
  project: '\u5173\u8054\u9879\u76ee',
  amount: '\u91d1\u989d',
  status: '\u72b6\u6001',
  updatedAt: '\u66f4\u65b0\u65f6\u95f4',
  action: '\u64cd\u4f5c',
  view: '\u67e5\u770b\u62a5\u4ef7',
  send: '\u53d1\u9001',
  confirm: '\u786e\u8ba4',
  reject: '\u62d2\u7edd',
  empty: '\u6682\u65e0\u62a5\u4ef7\u6570\u636e',
  noManagePermission: '\u6682\u65e0\u62a5\u4ef7\u7ba1\u7406\u6743\u9650',
  noProject: '\u6682\u65e0\u53ef\u5173\u8054\u9879\u76ee',
  createSuccess: '\u5df2\u521b\u5efa\u62a5\u4ef7',
  sendSuccess: '\u5df2\u53d1\u9001\u62a5\u4ef7',
  confirmTitle: '\u786e\u8ba4\u62a5\u4ef7',
  confirmContent: '\u786e\u8ba4\u540e\u5c06\u901a\u8fc7\u4e8b\u4ef6\u94fe\u521b\u5efa\u8ba2\u5355\u3002',
  confirmSuccess: '\u5df2\u786e\u8ba4\u62a5\u4ef7',
  rejectTitle: '\u62d2\u7edd\u62a5\u4ef7',
  rejectContent: '\u786e\u5b9a\u5c06\u8be5\u62a5\u4ef7\u6807\u8bb0\u4e3a\u5df2\u62d2\u7edd\uff1f',
  rejectSuccess: '\u5df2\u62d2\u7edd\u62a5\u4ef7'
})

const STATUS_OPTIONS = Object.freeze([
  { label: LABELS.allStatuses, value: '' },
  { label: '\u8349\u7a3f', value: 'draft' },
  { label: '\u5df2\u53d1\u9001', value: 'sent' },
  { label: '\u5df2\u786e\u8ba4', value: 'confirmed' },
  { label: '\u5df2\u62d2\u7edd', value: 'rejected' }
])

const QUOTE_STATUS_LABELS = Object.freeze({
  draft: '\u8349\u7a3f',
  sent: '\u5df2\u53d1\u9001',
  confirmed: '\u5df2\u786e\u8ba4',
  rejected: '\u5df2\u62d2\u7edd'
})

export default {
  data() {
    return {
      labels: LABELS,
      menu: getEnterpriseWebMenu(),
      guard: requirePermission(PERMISSION_KEYS.QUOTE_VIEW),
      manageGuard: requirePermission(PERMISSION_KEYS.QUOTE_MANAGE),
      pageState: 'loading',
      quotes: [],
      projects: [],
      projectId: '',
      keyword: '',
      status: '',
      minAmount: '',
      maxAmount: '',
      statusOptions: STATUS_OPTIONS
    }
  },
  computed: {
    guardMessage() {
      return getEnterpriseGuardMessage(this.guard.reason)
    },
    canManageQuote() {
      return this.manageGuard.allowed
    },
    currentStatusLabel() {
      return (this.statusOptions.find((item) => item.value === this.status) || this.statusOptions[0]).label
    },
    filteredQuotes() {
      const keyword = String(this.keyword || '').trim().toLowerCase()
      const min = this.minAmount === '' ? null : Number(this.minAmount)
      const max = this.maxAmount === '' ? null : Number(this.maxAmount)
      return this.quotes.filter((quote) => {
        const amount = Number(quote.amount || 0)
        const projectName = this.getProjectName(quote.projectId)
        const textMatched = !keyword || [quote.quoteId, quote.customer, quote.customerName, projectName]
          .some((value) => String(value || '').toLowerCase().includes(keyword))
        return textMatched &&
          (!this.projectId || quote.projectId === this.projectId) &&
          (!this.status || quote.status === this.status) &&
          (min === null || amount >= min) &&
          (max === null || amount <= max)
      })
    }
  },
  onLoad(options = {}) {
    this.status = options.status || ''
    this.keyword = options.keyword || ''
    this.projectId = options.projectId || ''
  },
  onShow() {
    this.refresh()
  },
  methods: {
    refresh() {
      this.guard = requirePermission(PERMISSION_KEYS.QUOTE_VIEW)
      this.manageGuard = requirePermission(PERMISSION_KEYS.QUOTE_MANAGE)
      this.menu = getEnterpriseWebMenu()
      if (!this.guard.allowed) {
        this.pageState = 'forbidden'
        return
      }
      try {
        this.pageState = 'loading'
        this.projects = getProjects()
        this.quotes = getQuotes().filter((quote) => canAccessTenantRecord(quote, PERMISSION_KEYS.QUOTE_VIEW).allowed)
        this.pageState = 'ready'
        this.logFlow('load', true)
      } catch (error) {
        this.pageState = 'error'
        this.logFlow('load', false, error && error.code)
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
    logFlow(action = '', success = false, errorCode = '', entityId = '') {
      if (typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'production') return
      console.log('[enterprise-quote:page]', { entityId, action, success: Boolean(success), errorCode: errorCode || '' })
    },
    goTo(item = {}) {
      if (item.route && item.key !== 'quotes') uni.navigateTo({ url: item.route })
    },
    handleStatusChange(event) {
      const index = Number(event.detail.value) || 0
      this.status = this.statusOptions[index].value
    },
    createDraft() {
      if (!this.canManageQuote) return uni.showToast({ title: this.labels.noManagePermission, icon: 'none' })
      const project = this.projectId
        ? this.projects.find((item) => item.projectId === this.projectId)
        : this.projects[0]
      if (!project) return uni.showToast({ title: this.labels.noProject, icon: 'none' })
      const quote = createQuote({
        customer: project.customerName || project.clientName || '',
        customerName: project.customerName || project.clientName || '',
        projectId: project.projectId,
        amount: 0,
        items: []
      }, this.actor())
      if (quote) {
        this.logFlow('create', true, '', quote.quoteId)
        uni.showToast({ title: this.labels.createSuccess, icon: 'none' })
        this.openDetail(quote)
      }
    },
    send(quote = {}) {
      if (!this.canManageQuote) return uni.showToast({ title: this.labels.noManagePermission, icon: 'none' })
      const updated = sendQuote(quote.quoteId, this.actor())
      this.logFlow('send', Boolean(updated), updated ? '' : 'send_failed', quote.quoteId)
      if (updated) uni.showToast({ title: this.labels.sendSuccess, icon: 'none' })
      this.refresh()
    },
    confirm(quote = {}) {
      if (!this.canManageQuote) return uni.showToast({ title: this.labels.noManagePermission, icon: 'none' })
      uni.showModal({
        title: this.labels.confirmTitle,
        content: this.labels.confirmContent,
        success: (res) => {
          if (!res.confirm) return
          const updated = confirmQuote(quote.quoteId, this.actor())
          this.logFlow('confirm', Boolean(updated), updated ? '' : 'confirm_failed', quote.quoteId)
          if (updated) uni.showToast({ title: this.labels.confirmSuccess, icon: 'none' })
          this.refresh()
        }
      })
    },
    reject(quote = {}) {
      if (!this.canManageQuote) return uni.showToast({ title: this.labels.noManagePermission, icon: 'none' })
      uni.showModal({
        title: this.labels.rejectTitle,
        content: this.labels.rejectContent,
        success: (res) => {
          if (!res.confirm) return
          const updated = rejectQuote(quote.quoteId, this.actor())
          this.logFlow('reject', Boolean(updated), updated ? '' : 'reject_failed', quote.quoteId)
          if (updated) uni.showToast({ title: this.labels.rejectSuccess, icon: 'none' })
          this.refresh()
        }
      })
    },
    openDetail(quote = {}) {
      if (!quote.quoteId) return
      uni.navigateTo({ url: buildEnterpriseWebUrl('quoteDetail', { quoteId: quote.quoteId }) })
    },
    getProjectName(projectId = '') {
      const project = this.projects.find((item) => item.projectId === projectId)
      return project ? (project.name || project.title || project.projectName || project.projectId) : (projectId || '--')
    },
    getQuoteStatusLabel(status = '') {
      return QUOTE_STATUS_LABELS[status] || QUOTE_STATUS_LABELS.draft
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
.topbar { display: flex; justify-content: space-between; gap: 16px; padding: 20px 24px; margin-bottom: 18px; }
.page-title { display: block; font-size: 24px; font-weight: 800; }
.page-desc { display: block; margin-top: 6px; color: #64748b; font-size: 13px; }
.primary-btn { height: 38px; line-height: 38px; border-radius: 10px; background: #4f46e5; color: #fff; font-size: 13px; }
.filterbar { display: flex; gap: 12px; padding: 14px; margin-bottom: 14px; }
.filter-input, .filter-select, .amount-input { height: 38px; padding: 0 12px; border-radius: 10px; background: #f8fafc; border: 1px solid #e2e8f0; font-size: 14px; box-sizing: border-box; }
.filter-input { flex: 1; }
.amount-input { width: 120px; }
.table-card { overflow-x: auto; }
.row { min-width: 980px; display: grid; grid-template-columns: 1.2fr 1fr 1fr 0.8fr 0.8fr 1fr 1.4fr; gap: 12px; align-items: center; padding: 14px 18px; font-size: 13px; }
.table-head { color: #64748b; background: #f8fafc; font-weight: 700; }
.data-row { border-top: 1px solid #eef2f7; }
.strong { font-weight: 800; cursor: pointer; }
.status-tag { display: inline-block; padding: 4px 8px; border-radius: 999px; background: #eef2ff; color: #4f46e5; }
.actions { display: flex; gap: 6px; flex-wrap: wrap; }
.mini-btn { min-width: 58px; height: 28px; line-height: 28px; border-radius: 8px; background: #f1f5f9; color: #334155; font-size: 12px; }
.mini-btn.primary { background: #eef2ff; color: #4f46e5; }
.danger { background: #fff1f2; color: #e11d48; }
.empty, .state-card, .platform-tip { padding: 24px; color: #64748b; }
.denied { color: #b42318; }
@media (max-width: 900px) {
  .shell { display: block; }
  .sidebar { position: static; width: auto; }
  .main { margin-left: 0; padding: 16px; }
  .topbar, .filterbar { display: block; }
  .filter-input, .filter-select, .amount-input { width: 100%; margin-top: 10px; }
}
</style>
