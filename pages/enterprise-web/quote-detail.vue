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
            <text class="page-title">{{ labels.title }}</text>
            <text class="page-desc">{{ quoteId }}</text>
          </view>
          <button class="primary-btn ghost" @click="back">{{ labels.back }}</button>
        </view>

        <view v-if="!guard.allowed" class="state-card denied">{{ guardMessage }}</view>
        <view v-else-if="!quote" class="state-card">{{ labels.notFound }}</view>
        <view v-else class="detail-grid">
          <view class="panel wide">
            <text class="panel-title">{{ labels.basicInfo }}</text>
            <view class="info-grid">
              <view><text>{{ labels.customer }}</text><text>{{ quote.customer || quote.customerName || '--' }}</text></view>
              <view><text>{{ labels.project }}</text><text>{{ projectName }}</text></view>
              <view><text>{{ labels.amount }}</text><text>{{ formatMoney(quote.amount) }}</text></view>
              <view><text>{{ labels.status }}</text><text>{{ getQuoteStatusLabel(quote.status) }}</text></view>
            </view>
            <view class="actions">
              <button class="action-btn" @click="editDraft">{{ labels.editDraft }}</button>
              <button class="action-btn" @click="send">{{ labels.send }}</button>
              <button class="action-btn" @click="confirm">{{ labels.confirm }}</button>
              <button class="action-btn danger" @click="reject">{{ labels.reject }}</button>
            </view>
          </view>

          <view class="panel">
            <text class="panel-title">{{ labels.items }}</text>
            <view v-for="item in quoteItems" :key="item.name" class="list-row">
              <text>{{ item.name }}</text>
              <text>{{ formatMoney(item.amount) }}</text>
            </view>
            <view v-if="!quoteItems.length" class="empty">{{ labels.itemsEmpty }}</view>
          </view>

          <view class="panel">
            <text class="panel-title">{{ labels.timeline }}</text>
            <view class="list-row">
              <text>{{ getQuoteStatusLabel(quote.status) }}</text>
              <text>{{ formatTime(quote.updatedAt || quote.createdAt) }}</text>
            </view>
          </view>

          <view class="panel wide">
            <text class="panel-title">{{ labels.audit }}</text>
            <view v-for="log in auditLogs" :key="log.auditId" class="log-row">
              <text>{{ formatTime(log.createdAt) }}</text>
              <text>{{ log.operator }}</text>
              <text>{{ log.action }}</text>
              <text>{{ safeJson(log.after) }}</text>
            </view>
            <view v-if="!auditLogs.length" class="empty">{{ labels.auditEmpty }}</view>
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
import { getById as getProjectById } from '../../utils/repository/projectRepository.js'
import { getCurrentMember, getCurrentUser } from '../../utils/auth/authRepository.js'
import { buildEnterpriseWebUrl } from '../../utils/enterprise-web/enterpriseWebRoutes.js'
import { canAccessTenantRecord, getEnterpriseGuardMessage, requirePermission } from '../../utils/enterprise-web/enterpriseWebGuard.js'
import { confirmQuote, getQuote, rejectQuote, sendQuote } from '../../utils/service/quoteService.js'
import '../../utils/service/orderService.js'
import '../../utils/service/projectService.js'
import { getEnterpriseWebMenu } from '../../utils/enterprise-web/enterpriseWebMenu.js'

const LABELS = Object.freeze({
  brand: '\u8776\u53d8',
  brandDesc: '\u4f01\u4e1a\u7ecf\u8425\u95ed\u73af',
  title: '\u62a5\u4ef7\u8be6\u60c5',
  back: '\u8fd4\u56de\u62a5\u4ef7\u5217\u8868',
  notFound: '\u672a\u627e\u5230\u62a5\u4ef7\u6216\u65e0\u6743\u8bbf\u95ee\u3002',
  basicInfo: '\u57fa\u7840\u4fe1\u606f',
  customer: '\u5ba2\u6237',
  project: '\u9879\u76ee',
  amount: '\u603b\u91d1\u989d',
  status: '\u72b6\u6001',
  editDraft: '\u7f16\u8f91\u8349\u7a3f',
  send: '\u53d1\u9001',
  confirm: '\u786e\u8ba4',
  reject: '\u62d2\u7edd',
  items: '\u62a5\u4ef7\u660e\u7ec6',
  itemsEmpty: '\u6682\u65e0\u660e\u7ec6',
  timeline: '\u72b6\u6001\u65f6\u95f4\u7ebf',
  audit: '\u64cd\u4f5c\u8bb0\u5f55',
  auditEmpty: '\u6682\u65e0\u64cd\u4f5c\u8bb0\u5f55',
  h5Only: '\u4f01\u4e1a\u7f51\u9875\u7248\u4ec5\u5728 H5 \u5e73\u53f0\u663e\u793a\u3002',
  draftOnly: '\u4ec5\u8349\u7a3f\u53ef\u7f16\u8f91',
  editRecorded: '\u5df2\u8bb0\u5f55\u7f16\u8f91\u52a8\u4f5c',
  confirmTitle: '\u786e\u8ba4\u62a5\u4ef7',
  confirmContent: '\u91cd\u590d\u786e\u8ba4\u4e0d\u4f1a\u65b0\u589e\u8ba2\u5355\u3002',
  rejectTitle: '\u62d2\u7edd\u62a5\u4ef7',
  rejectContent: '\u786e\u5b9a\u62d2\u7edd\u8be5\u62a5\u4ef7\uff1f'
})

export default {
  data() {
    return {
      labels: LABELS,
      menu: getEnterpriseWebMenu(),
      quoteId: '',
      guard: requirePermission('quote.view'),
      quote: null,
      auditLogs: []
    }
  },
  computed: {
    guardMessage() { return getEnterpriseGuardMessage(this.guard.reason) },
    projectName() {
      const project = this.quote ? getProjectById(this.quote.projectId || '') : null
      return project ? (project.title || project.projectName || project.projectId) : (this.quote && this.quote.projectId ? this.quote.projectId : '--')
    },
    quoteItems() {
      const items = this.quote && Array.isArray(this.quote.items) ? this.quote.items : []
      return items.map((item, index) => ({ name: item.name || item.title || `\u62a5\u4ef7\u9879 ${index + 1}`, amount: item.amount || item.price || 0 }))
    }
  },
  onLoad(options = {}) {
    this.quoteId = options.quoteId || ''
    this.refresh()
  },
  methods: {
    refresh() {
      const quote = getQuote(this.quoteId)
      this.guard = canAccessTenantRecord(quote || { quoteId: this.quoteId }, 'quote.view')
      this.menu = getEnterpriseWebMenu()
      if (!this.guard.allowed) return
      this.quote = quote
      this.auditLogs = getAuditLogs({ targetType: 'quote', targetId: this.quoteId }).slice(0, 20)
    },
    actor() {
      const user = getCurrentUser()
      const member = getCurrentMember()
      return { userId: user.userId, operator: member.name || user.name || '\u9ed8\u8ba4\u7ba1\u7406\u5458' }
    },
    goTo(item = {}) { if (item.route) uni.navigateTo({ url: item.route }) },
    back() { uni.navigateTo({ url: buildEnterpriseWebUrl('quotes') }) },
    editDraft() {
      if (!this.quote || this.quote.status !== 'draft') return uni.showToast({ title: this.labels.draftOnly, icon: 'none' })
      recordAudit({ action: '\u7f16\u8f91\u62a5\u4ef7\u8349\u7a3f', targetType: 'quote', targetId: this.quoteId, after: { touchedByEnterpriseWeb: true } })
      uni.showToast({ title: this.labels.editRecorded, icon: 'none' })
      this.refresh()
    },
    send() {
      if (requirePermission('quote.manage').allowed) {
        sendQuote(this.quoteId, this.actor())
        this.refresh()
      }
    },
    confirm() {
      if (!requirePermission('quote.manage').allowed) return
      uni.showModal({
        title: this.labels.confirmTitle,
        content: this.labels.confirmContent,
        success: (res) => {
          if (res.confirm) {
            confirmQuote(this.quoteId, this.actor())
            this.refresh()
          }
        }
      })
    },
    reject() {
      if (!requirePermission('quote.manage').allowed) return
      uni.showModal({
        title: this.labels.rejectTitle,
        content: this.labels.rejectContent,
        success: (res) => {
          if (res.confirm) {
            rejectQuote(this.quoteId, this.actor())
            this.refresh()
          }
        }
      })
    },
    getQuoteStatusLabel(status = '') {
      return { draft: '\u8349\u7a3f', sent: '\u5df2\u53d1\u9001', confirmed: '\u5df2\u786e\u8ba4', rejected: '\u5df2\u62d2\u7edd' }[status] || '\u8349\u7a3f'
    },
    formatMoney(value) { return `\u00a5${Number(value || 0).toFixed(0)}` },
    formatTime(value = '') { return value ? String(value).slice(0, 16).replace('T', ' ') : '--' },
    safeJson(value = {}) {
      const text = JSON.stringify(value || {})
      return text.length > 120 ? `${text.slice(0, 120)}...` : text
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
.topbar, .panel, .state-card { background: #fff; border: 1px solid #e5e7eb; border-radius: 16px; box-shadow: 0 18px 40px rgba(15,23,42,0.05); }
.topbar { display: flex; justify-content: space-between; gap: 16px; padding: 20px 24px; margin-bottom: 18px; }
.page-title { display: block; font-size: 24px; font-weight: 800; }
.page-desc { display: block; margin-top: 6px; color: #64748b; font-size: 13px; }
.primary-btn,.action-btn { height: 36px; line-height: 36px; border-radius: 10px; background: #4f46e5; color: #fff; font-size: 13px; }
.ghost { background: #eef2ff; color: #4f46e5; }
.detail-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.panel { padding: 20px; }
.wide { grid-column: 1 / -1; }
.panel-title { display: block; margin-bottom: 14px; font-size: 17px; font-weight: 800; }
.info-grid { display: grid; grid-template-columns: repeat(4, minmax(0,1fr)); gap: 12px; }
.info-grid view { padding: 14px; border-radius: 12px; background: #f8fafc; }
.info-grid text { display: block; color: #64748b; font-size: 12px; }
.info-grid text + text { margin-top: 8px; color: #111827; font-size: 15px; font-weight: 700; }
.actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 16px; }
.danger { background: #fff1f2; color: #e11d48; }
.list-row,.log-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; padding: 10px 0; border-bottom: 1px solid #eef2f7; font-size: 13px; }
.log-row { grid-template-columns: 1fr 0.8fr 1fr 2fr; }
.empty,.state-card,.platform-tip { padding: 24px; color: #64748b; }
.denied { color: #b42318; }
@media (max-width: 900px) { .shell { display: block; } .sidebar { position: static; width: auto; } .main { margin-left: 0; padding: 16px; } .detail-grid,.info-grid,.log-row { grid-template-columns: 1fr; } }
</style>
