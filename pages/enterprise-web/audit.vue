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
          <view v-for="item in menu" :key="item.key" :class="['menu-item', item.key === 'audit' ? 'active' : '']" @click="goTo(item)">
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
          <view class="filterbar">
            <input v-model="keyword" class="filter-input" :placeholder="labels.keyword" />
            <input v-model="operator" class="filter-input" :placeholder="labels.operator" />
            <input v-model="targetType" class="filter-input" :placeholder="labels.targetType" />
            <input v-model="action" class="filter-input" :placeholder="labels.action" />
            <input v-model="dateStart" class="date-input" :placeholder="labels.dateStart" />
            <input v-model="dateEnd" class="date-input" :placeholder="labels.dateEnd" />
          </view>

          <view class="table-card">
            <view class="table-head row">
              <text>{{ labels.createdAt }}</text>
              <text>{{ labels.operator }}</text>
              <text>{{ labels.action }}</text>
              <text>{{ labels.targetType }}</text>
              <text>{{ labels.targetId }}</text>
              <text>{{ labels.before }}</text>
              <text>{{ labels.after }}</text>
            </view>
            <view v-if="pagedLogs.length">
              <view v-for="log in pagedLogs" :key="log.auditId" class="row data-row">
                <text>{{ formatTime(log.createdAt) }}</text>
                <text>{{ log.operator }}</text>
                <text>{{ log.action }}</text>
                <text>{{ log.targetType }}</text>
                <text>{{ maskSensitive(log.targetId) }}</text>
                <text>{{ safeJson(log.before) }}</text>
                <text>{{ safeJson(log.after) }}</text>
              </view>
            </view>
            <view v-else class="empty">{{ labels.empty }}</view>
          </view>

          <view class="pager">
            <button class="mini-btn" @click="prevPage">{{ labels.prev }}</button>
            <text>{{ labels.pagePrefix }}{{ page }}{{ labels.pageMiddle }}{{ totalPages }}{{ labels.pageSuffix }}</text>
            <button class="mini-btn" @click="nextPage">{{ labels.next }}</button>
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
import { getEnterpriseGuardMessage, requirePermission } from '../../utils/enterprise-web/enterpriseWebGuard.js'
import { getEnterpriseWebMenu } from '../../utils/enterprise-web/enterpriseWebMenu.js'

const PAGE_SIZE = 20
const SENSITIVE_KEYS = ['openid', 'token', 'credential', 'password', 'secret', 'apiKey']
const LABELS = Object.freeze({
  brand: '\u8776\u53d8',
  brandDesc: '\u4f01\u4e1a\u7ecf\u8425\u95ed\u73af',
  title: '\u5ba1\u8ba1\u4e2d\u5fc3',
  desc: '\u4ec5\u5c55\u793a\u5f53\u524d\u4f01\u4e1a\u64cd\u4f5c\u8bb0\u5f55\uff0c\u654f\u611f\u5b57\u6bb5\u505a\u6458\u8981\u5904\u7406\u3002',
  keyword: '\u641c\u7d22\u52a8\u4f5c\u3001\u5bf9\u8c61\u3001\u64cd\u4f5c\u4eba',
  operator: '\u64cd\u4f5c\u4eba',
  targetType: '\u5bf9\u8c61\u7c7b\u578b',
  action: '\u52a8\u4f5c',
  dateStart: '\u5f00\u59cb\u65e5\u671f YYYY-MM-DD',
  dateEnd: '\u7ed3\u675f\u65e5\u671f YYYY-MM-DD',
  createdAt: '\u64cd\u4f5c\u65f6\u95f4',
  targetId: '\u5bf9\u8c61\u7f16\u53f7',
  before: '\u53d8\u66f4\u524d',
  after: '\u53d8\u66f4\u540e',
  empty: '\u6682\u65e0\u5ba1\u8ba1\u8bb0\u5f55',
  prev: '\u4e0a\u4e00\u9875',
  next: '\u4e0b\u4e00\u9875',
  pagePrefix: '\u7b2c ',
  pageMiddle: ' \u9875 / \u5171 ',
  pageSuffix: ' \u9875',
  h5Only: '\u4f01\u4e1a\u7f51\u9875\u7248\u4ec5\u5728 H5 \u5e73\u53f0\u663e\u793a\u3002',
  masked: '[\u5df2\u9690\u85cf]',
  objectSummary: '[\u5bf9\u8c61\u6458\u8981]',
  defaultAction: '\u66f4\u65b0\u4e1a\u52a1\u6570\u636e'
})

export default {
  data() {
    return {
      labels: LABELS,
      menu: getEnterpriseWebMenu(),
      guard: requirePermission('audit.view'),
      logs: [],
      keyword: '',
      operator: '',
      targetType: '',
      action: '',
      dateStart: '',
      dateEnd: '',
      page: 1
    }
  },
  computed: {
    guardMessage() { return getEnterpriseGuardMessage(this.guard.reason) },
    filteredLogs() {
      const keyword = String(this.keyword || '').trim().toLowerCase()
      const operator = String(this.operator || '').trim().toLowerCase()
      const targetType = String(this.targetType || '').trim().toLowerCase()
      const action = String(this.action || '').trim().toLowerCase()
      const start = this.dateStart ? new Date(`${this.dateStart}T00:00:00`).getTime() : null
      const end = this.dateEnd ? new Date(`${this.dateEnd}T23:59:59`).getTime() : null
      const seen = new Set()
      return [...this.logs].sort((left, right) => String(right.createdAt || '').localeCompare(String(left.createdAt || ''))).filter((log) => {
        const time = new Date(log.createdAt || 0).getTime()
        const dedupeKey = [log.targetType || 'business', log.targetId || '', log.action || this.labels.defaultAction].join('::')
        if (seen.has(dedupeKey)) return false
        seen.add(dedupeKey)
        const text = [log.operator, log.action, log.targetType, this.maskSensitive(log.targetId)].join(' ').toLowerCase()
        return (!keyword || text.includes(keyword)) &&
          (!operator || String(log.operator || '').toLowerCase().includes(operator)) &&
          (!targetType || String(log.targetType || '').toLowerCase().includes(targetType)) &&
          (!action || String(log.action || '').toLowerCase().includes(action)) &&
          (start === null || time >= start) &&
          (end === null || time <= end)
      })
    },
    totalPages() { return Math.max(1, Math.ceil(this.filteredLogs.length / PAGE_SIZE)) },
    pagedLogs() { return this.filteredLogs.slice((this.page - 1) * PAGE_SIZE, this.page * PAGE_SIZE) }
  },
  watch: {
    keyword() { this.page = 1 },
    operator() { this.page = 1 },
    targetType() { this.page = 1 },
    action() { this.page = 1 },
    dateStart() { this.page = 1 },
    dateEnd() { this.page = 1 }
  },
  onLoad(options = {}) {
    this.keyword = options.keyword || ''
    this.operator = options.operator || ''
    this.targetType = options.targetType || ''
    this.action = options.action || ''
  },
  onShow() { this.refresh() },
  methods: {
    refresh() {
      this.guard = requirePermission('audit.view')
      this.menu = getEnterpriseWebMenu()
      if (!this.guard.allowed) return
      this.logs = getAuditLogs()
    },
    goTo(item = {}) { if (item.route && item.key !== 'audit') uni.navigateTo({ url: item.route }) },
    prevPage() { this.page = Math.max(1, this.page - 1) },
    nextPage() { this.page = Math.min(this.totalPages, this.page + 1) },
    formatTime(value = '') { return value ? String(value).slice(0, 16).replace('T', ' ') : '--' },
    maskSensitive(value = '') {
      const text = String(value || '')
      return SENSITIVE_KEYS.some((item) => text.toLowerCase().includes(item.toLowerCase())) ? this.labels.masked : text
    },
    safeJson(value = {}) {
      const clean = {}
      Object.keys(value || {}).forEach((key) => {
        const raw = value[key]
        clean[key] = SENSITIVE_KEYS.some((item) => key.toLowerCase().includes(item.toLowerCase())) ? this.labels.masked : (raw && typeof raw === 'object' ? this.labels.objectSummary : raw)
      })
      const text = JSON.stringify(clean)
      return text.length > 100 ? `${text.slice(0, 100)}...` : text
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
.topbar,.filterbar,.table-card,.state-card { background: #fff; border: 1px solid #e5e7eb; border-radius: 16px; box-shadow: 0 18px 40px rgba(15,23,42,0.05); }
.topbar { padding: 20px 24px; margin-bottom: 18px; }
.page-title { display: block; font-size: 24px; font-weight: 800; }
.page-desc { display: block; margin-top: 6px; color: #64748b; font-size: 13px; }
.filterbar { display: grid; grid-template-columns: repeat(6, minmax(0,1fr)); gap: 12px; padding: 14px; margin-bottom: 14px; }
.filter-input,.date-input { height: 38px; padding: 0 12px; border-radius: 10px; background: #f8fafc; border: 1px solid #e2e8f0; font-size: 13px; box-sizing: border-box; }
.table-card { overflow-x: auto; }
.row { min-width: 1120px; display: grid; grid-template-columns: 1fr 0.8fr 1fr 0.8fr 1fr 1.4fr 1.4fr; gap: 12px; align-items: center; padding: 14px 18px; font-size: 13px; }
.table-head { color: #64748b; background: #f8fafc; font-weight: 700; }
.data-row { border-top: 1px solid #eef2f7; }
.pager { display: flex; justify-content: center; align-items: center; gap: 12px; margin-top: 14px; color: #64748b; }
.mini-btn { height: 30px; line-height: 30px; border-radius: 8px; background: #f1f5f9; color: #334155; font-size: 12px; }
.empty,.denied,.platform-tip { padding: 24px; color: #64748b; }
.denied { color: #b42318; }
@media (max-width: 900px) { .shell { display: block; } .sidebar { position: static; width: auto; } .main { margin-left: 0; padding: 16px; } .filterbar { grid-template-columns: 1fr; } }
</style>
