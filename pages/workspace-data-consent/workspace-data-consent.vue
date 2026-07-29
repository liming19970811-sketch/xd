<template>
  <view class="consent-page">
    <view class="consent-shell">
      <view class="page-head">
        <view>
          <text class="eyebrow">Data Consent</text>
          <text class="page-title">数据授权中心</text>
          <text class="page-desc">AI训练、公开案例展示和营销通知均为独立可选授权，默认关闭。基础服务必要处理与云存储用于完成当前服务。</text>
        </view>
        <button class="outline-btn" @click="reload">刷新</button>
      </view>

      <view class="summary-grid">
        <view class="summary-card"><text>协议版本</text><strong>{{ center.policyVersion }}</strong></view>
        <view class="summary-card"><text>已授权</text><strong>{{ grantedCount }}</strong></view>
        <view class="summary-card"><text>可撤回授权</text><strong>{{ optionalCount }}</strong></view>
        <view class="summary-card"><text>数据请求</text><strong>{{ center.requests.length }}</strong></view>
      </view>

      <view class="section">
        <view class="section-head">
          <view>
            <text class="section-title">授权项目</text>
            <text class="section-desc">每项授权单独管理，不使用一个总开关默认同意全部授权。</text>
          </view>
        </view>
        <view class="consent-list">
          <view v-for="item in center.consents" :key="item.type" class="consent-card">
            <view class="consent-main">
              <text class="card-title">{{ item.label }}</text>
              <text class="row-meta">{{ item.required ? '必要处理，不可撤回' : '可选授权，默认关闭' }} · {{ item.protocolVersion }}</text>
              <text class="card-desc">{{ item.description }}</text>
              <text v-if="item.type === 'ai_training'" class="warning-text">训练数据仅限已授权、已审核、来源明确且企业政策允许的数据。撤回后，未进入冻结数据集的数据立即停止使用。</text>
            </view>
            <view class="consent-side">
              <text :class="['status', item.status]">{{ item.status === 'granted' ? '已授权' : '未授权' }}</text>
              <button
                v-if="!item.required"
                class="outline-small"
                :class="{ danger: item.status === 'granted' }"
                @click="toggleConsent(item)"
              >
                {{ item.status === 'granted' ? '撤回授权' : '开启授权' }}
              </button>
            </view>
          </view>
        </view>
      </view>

      <view class="section">
        <view class="section-head">
          <view>
            <text class="section-title">用户数据权利</text>
            <text class="section-desc">删除和注销会先检查项目、订单、额度、交付和法定留存要求，不会直接清空全部数据库。</text>
          </view>
        </view>
        <view class="rights-actions">
          <button class="outline-btn" @click="createRequest('export')">申请导出个人数据</button>
          <button class="outline-btn" @click="createRequest('delete')">申请删除数据</button>
          <button class="outline-btn" @click="createRequest('account_cancel')">申请注销账号</button>
          <button class="outline-btn" @click="createRequest('contact_privacy_officer')">联系隐私负责人</button>
        </view>
        <view class="table">
          <view class="table-row head"><text>请求编号</text><text>类型</text><text>状态</text><text>创建时间</text></view>
          <view v-for="item in center.requests" :key="item.requestId" class="table-row">
            <text>{{ item.requestId }}</text>
            <text>{{ getRequestTypeLabel(item.requestType) }}</text>
            <text :class="['status', item.status]">{{ getRequestStatusLabel(item.status) }}</text>
            <text>{{ formatDate(item.createdAt) }}</text>
          </view>
        </view>
        <view v-if="!center.requests.length" class="empty-card">暂无数据权利申请。</view>
      </view>

      <view class="footer-actions">
        <button class="outline-btn" @click="goPrivacy">查看隐私政策</button>
        <button class="outline-btn" @click="goTerms">查看用户协议</button>
      </view>
    </view>
  </view>
</template>

<script>
import { createDataRequest, loadUserConsentCenter, setConsent } from '../../utils/compliance/privacyConsentCenter'

export default {
  data() {
    return {
      center: loadUserConsentCenter()
    }
  },
  computed: {
    grantedCount() {
      return this.center.consents.filter((item) => item.status === 'granted').length
    },
    optionalCount() {
      return this.center.consents.filter((item) => !item.required).length
    }
  },
  methods: {
    reload() {
      this.center = loadUserConsentCenter()
    },
    toggleConsent(item) {
      const granting = item.status !== 'granted'
      const result = setConsent(item.type, granting, {
        sourcePage: 'workspace_data_consent',
        reason: granting ? '用户主动开启授权' : '用户主动撤回授权'
      })
      uni.showToast({ title: result.success ? (granting ? '已开启授权' : '已撤回授权') : this.getErrorLabel(result.errorCode), icon: 'none' })
      this.reload()
    },
    createRequest(requestType) {
      const result = createDataRequest({ requestType, reason: '用户在数据授权中心提交' })
      uni.showToast({ title: result.success ? '申请已提交' : '提交失败', icon: 'none' })
      this.reload()
    },
    goPrivacy() {
      uni.navigateTo({ url: '/pages/privacy/privacy' })
    },
    goTerms() {
      uni.navigateTo({ url: '/pages/terms/terms' })
    },
    getErrorLabel(errorCode) {
      const map = {
        required_consent_cannot_withdraw: '必要授权不可撤回',
        consent_type_not_found: '授权类型不存在'
      }
      return map[errorCode] || '操作失败'
    },
    getRequestTypeLabel(type) {
      const map = {
        export: '数据导出',
        delete: '删除申请',
        withdraw_optional: '撤回可选授权',
        account_cancel: '注销账号',
        contact_privacy_officer: '联系隐私负责人'
      }
      return map[type] || type
    },
    getRequestStatusLabel(status) {
      const map = {
        new: '待处理',
        checking: '检查中',
        blocked_by_retention: '受留存要求限制',
        processing: '处理中',
        completed: '已完成',
        rejected: '已拒绝'
      }
      return map[status] || status
    },
    formatDate(value) {
      if (!value) return '-'
      return String(value).replace('T', ' ').slice(0, 16)
    }
  }
}
</script>

<style scoped>
.consent-page { min-height: 100vh; background: #f5f7fb; color: #0f172a; }
.consent-shell { max-width: 1180px; margin: 0 auto; padding: 36px 22px; box-sizing: border-box; }
.page-head, .section-head, .consent-card, .consent-side, .rights-actions, .footer-actions { display: flex; gap: 14px; }
.page-head, .section-head, .consent-card { justify-content: space-between; }
.page-head, .consent-card { align-items: flex-start; }
.eyebrow, .page-title, .page-desc, .section-title, .section-desc, .card-title, .card-desc, .row-meta, .warning-text { display: block; }
.eyebrow { color: #4f46e5; font-size: 12px; font-weight: 900; text-transform: uppercase; }
.page-title { margin-top: 6px; font-size: 30px; font-weight: 950; }
.page-desc { max-width: 760px; margin-top: 8px; color: #64748b; line-height: 1.65; }
.summary-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; margin: 18px 0; }
.summary-card, .section, .consent-card, .empty-card { border: 1px solid #e5e7eb; border-radius: 14px; background: #fff; box-shadow: 0 12px 30px rgba(15, 23, 42, .05); box-sizing: border-box; }
.summary-card { padding: 16px; }
.summary-card text { display: block; color: #64748b; font-size: 13px; }
.summary-card strong { display: block; margin-top: 6px; font-size: 24px; }
.section { margin-top: 16px; padding: 18px; }
.section-title, .card-title { font-weight: 900; font-size: 20px; }
.section-desc, .row-meta, .card-desc { color: #64748b; line-height: 1.6; }
.consent-list { display: grid; gap: 10px; margin-top: 14px; }
.consent-card { padding: 16px; }
.consent-main { min-width: 0; }
.consent-side { flex-direction: column; align-items: flex-end; }
.warning-text { margin-top: 8px; color: #b45309; font-size: 13px; }
.status { display: inline-flex; width: fit-content; padding: 5px 9px; border-radius: 999px; background: #f1f5f9; color: #475569; font-size: 12px; font-weight: 900; }
.status.granted, .status.completed { background: #ecfdf5; color: #047857; }
.status.withdrawn, .status.rejected { background: #fef2f2; color: #dc2626; }
.status.new, .status.checking, .status.processing { background: #fff7ed; color: #c2410c; }
.rights-actions, .footer-actions { flex-wrap: wrap; margin: 14px 0; }
.table { width: 100%; overflow-x: auto; }
.table-row { min-width: 760px; display: grid; grid-template-columns: 1.4fr 1fr 1fr 1fr; gap: 12px; align-items: center; padding: 12px 0; border-top: 1px solid #eef2f7; }
.table-row.head { color: #64748b; font-size: 12px; font-weight: 900; border-top: 0; }
.empty-card { padding: 18px; color: #64748b; }
.outline-btn, .outline-small { border: 1px solid #cbd5e1; background: #fff; color: #334155; border-radius: 10px; font-weight: 900; }
.outline-btn { height: 42px; padding: 0 14px; }
.outline-small { min-height: 32px; padding: 0 10px; font-size: 12px; }
.outline-small.danger { border-color: #fecaca; color: #dc2626; }
@media (max-width: 800px) {
  .consent-shell { padding: 24px 14px; }
  .page-head, .consent-card { flex-direction: column; }
  .summary-grid { grid-template-columns: 1fr; }
  .consent-side { align-items: flex-start; }
}
</style>
