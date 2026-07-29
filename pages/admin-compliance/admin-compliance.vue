<template>
  <view class="compliance-page">
    <aside class="compliance-sidebar">
      <view class="brand">
        <text class="brand-mark">CMP</text>
        <view>
          <text class="brand-title">合规中心</text>
          <text class="brand-sub">Privacy & Consent</text>
        </view>
      </view>
      <button
        v-for="item in tabs"
        :key="item.key"
        class="nav-item"
        :class="{ active: currentTab === item.key }"
        @click="currentTab = item.key"
      >
        {{ item.label }}
      </button>
    </aside>

    <main class="compliance-main">
      <view v-if="!center.canAccess" class="state-card">
        <text class="page-title">无权限访问合规中心</text>
        <text class="page-desc">仅平台管理员和授权合规人员可查看授权记录、数据请求和案例授权状态。</text>
      </view>

      <template v-else>
        <view class="page-head">
          <view>
            <text class="eyebrow">Compliance V1</text>
            <text class="page-title">{{ pageTitle }}</text>
            <text class="page-desc">合规后台只做授权、请求、案例和协议版本治理，不直接查看用户私有素材。</text>
          </view>
          <button class="outline-btn" @click="reload">刷新</button>
        </view>

        <view class="metric-grid">
          <view class="metric-card"><text>待处理请求</text><strong>{{ center.stats.pendingRequests || 0 }}</strong></view>
          <view class="metric-card"><text>已授权记录</text><strong>{{ center.stats.grantedConsents || 0 }}</strong></view>
          <view class="metric-card"><text>已撤回授权</text><strong>{{ center.stats.withdrawnConsents || 0 }}</strong></view>
          <view class="metric-card"><text>待下线案例</text><strong>{{ center.stats.offlineCases || 0 }}</strong></view>
        </view>

        <view class="filter-bar">
          <input v-model.trim="filters.keyword" placeholder="搜索 consentId、requestId、caseId、企业或状态" />
          <button class="outline-btn" @click="reload">筛选</button>
        </view>

        <view v-if="currentTab === 'requests'" class="section">
          <text class="section-title">待处理数据请求</text>
          <text class="section-desc">删除、导出和注销请求必须先检查项目、订单、额度、交付和法定留存要求。</text>
          <view class="table">
            <view class="table-row head"><text>请求</text><text>用户/企业</text><text>类型</text><text>状态</text><text>时间</text></view>
            <view v-for="item in center.requests" :key="item.requestId" class="table-row">
              <text>{{ item.requestId }}</text>
              <text>{{ item.userId }} / {{ item.enterpriseId || '-' }}</text>
              <text>{{ item.requestType }}</text>
              <text :class="['status', item.status]">{{ item.status }}</text>
              <text>{{ formatDate(item.createdAt) }}</text>
            </view>
          </view>
          <view v-if="!center.requests.length" class="state-card">暂无数据请求。</view>
        </view>

        <view v-else-if="currentTab === 'consents'" class="section">
          <text class="section-title">授权记录</text>
          <text class="section-desc">历史授权保留协议版本、来源页面和适用数据范围，协议更新不会覆盖旧记录。</text>
          <view class="table">
            <view class="table-row head"><text>授权</text><text>类型</text><text>状态</text><text>协议版本</text><text>范围</text></view>
            <view v-for="item in center.consents" :key="item.consentId" class="table-row">
              <text>{{ item.consentId }}</text>
              <text>{{ item.consentType }}</text>
              <text :class="['status', item.status]">{{ item.status }}</text>
              <text>{{ item.protocolVersion }}</text>
              <text>{{ item.dataScope }}</text>
            </view>
          </view>
        </view>

        <view v-else-if="currentTab === 'cases'" class="section">
          <view class="section-head">
            <view>
              <text class="section-title">公开案例授权</text>
              <text class="section-desc">客户名称、Logo、图片和公开范围必须分别确认；过期或撤回后进入下线待办。</text>
            </view>
            <button class="primary-btn" @click="saveDemoCaseAuthorization">登记授权检查</button>
          </view>
          <view class="table">
            <view class="table-row head"><text>案例</text><text>授权项</text><text>状态</text><text>有效期</text><text>范围</text></view>
            <view v-for="item in center.caseAuthorizations" :key="item.authorizationId" class="table-row">
              <text>{{ item.caseId || item.authorizationId }}</text>
              <text>客户{{ item.customerNameAuthorized ? '是' : '否' }} / Logo{{ item.logoAuthorized ? '是' : '否' }} / 图片{{ item.imageAuthorized ? '是' : '否' }}</text>
              <text :class="['status', item.status]">{{ item.status }}</text>
              <text>{{ item.validUntil || '-' }}</text>
              <text>{{ item.publicScope || '-' }}</text>
            </view>
          </view>
          <view v-if="!center.caseAuthorizations.length" class="state-card">暂无公开案例授权记录。</view>
        </view>

        <view v-else-if="currentTab === 'protocols'" class="section">
          <text class="section-title">协议版本与异常访问</text>
          <view class="policy-grid">
            <view class="policy-card">
              <text class="card-title">协议版本</text>
              <view v-for="item in center.protocolVersions" :key="item.type" class="policy-row">
                <text>{{ item.type }}</text>
                <text>{{ item.version }} · {{ item.status }}</text>
              </view>
            </view>
            <view class="policy-card">
              <text class="card-title">异常访问记录</text>
              <view v-for="item in center.abnormalAccessRecords" :key="item.consentId" class="policy-row">
                <text>{{ item.consentType }}</text>
                <text>{{ item.status }}</text>
              </view>
              <view v-if="!center.abnormalAccessRecords.length" class="empty-text">暂无异常访问记录。</view>
            </view>
            <view class="policy-card">
              <text class="card-title">数据导出记录</text>
              <view v-for="item in center.exportRecords" :key="item.requestId" class="policy-row">
                <text>{{ item.requestId }}</text>
                <text>{{ item.status }}</text>
              </view>
              <view v-if="!center.exportRecords.length" class="empty-text">暂无导出记录。</view>
            </view>
          </view>
        </view>

        <view v-else class="section">
          <text class="section-title">不可删除审计日志</text>
          <view class="table">
            <view class="table-row head"><text>时间</text><text>操作</text><text>资源</text><text>操作人</text><text>原因</text></view>
            <view v-for="item in center.audits" :key="item.auditId" class="table-row">
              <text>{{ formatDate(item.createdAt) }}</text>
              <text>{{ item.action }}</text>
              <text>{{ item.resourceId }}</text>
              <text>{{ item.operatorId }}</text>
              <text>{{ item.reason || '-' }}</text>
            </view>
          </view>
        </view>
      </template>
    </main>
  </view>
</template>

<script>
import { loadComplianceAdminCenter, saveCaseAuthorization } from '../../utils/compliance/privacyConsentCenter'

export default {
  data() {
    return {
      currentTab: 'requests',
      filters: { keyword: '' },
      tabs: [
        { key: 'requests', label: '数据请求' },
        { key: 'consents', label: '授权记录' },
        { key: 'cases', label: '案例授权' },
        { key: 'protocols', label: '协议与异常' },
        { key: 'audit', label: '审计日志' }
      ],
      center: loadComplianceAdminCenter()
    }
  },
  computed: {
    pageTitle() {
      const tab = this.tabs.find((item) => item.key === this.currentTab)
      return tab ? tab.label : '合规中心'
    }
  },
  onLoad(query = {}) {
    this.currentTab = ['requests', 'consents', 'cases', 'protocols', 'audit'].includes(query.tab) ? query.tab : 'requests'
    this.filters.keyword = query.keyword || ''
    this.reload()
  },
  methods: {
    reload() {
      this.center = loadComplianceAdminCenter(this.filters)
    },
    saveDemoCaseAuthorization() {
      const result = saveCaseAuthorization({
        caseId: `case_review_${Date.now()}`,
        customerNameAuthorized: false,
        logoAuthorized: false,
        imageAuthorized: false,
        publicScope: '授权不完整，仅可作为产品能力演示',
        reason: '后台登记案例授权检查'
      })
      uni.showToast({ title: result.success ? '已登记检查' : '无权限操作', icon: 'none' })
      this.reload()
    },
    formatDate(value) {
      if (!value) return '-'
      return String(value).replace('T', ' ').slice(0, 16)
    }
  }
}
</script>

<style scoped>
.compliance-page { min-height: 100vh; display: grid; grid-template-columns: 236px minmax(0, 1fr); background: #f5f7fb; color: #0f172a; }
.compliance-sidebar { position: sticky; top: 0; height: 100vh; padding: 22px 16px; background: #fff; border-right: 1px solid #e5e7eb; box-sizing: border-box; }
.brand, .page-head, .section-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
.brand { align-items: center; justify-content: flex-start; margin-bottom: 22px; }
.brand-mark { width: 42px; height: 42px; border-radius: 12px; display: flex; align-items: center; justify-content: center; background: #4f46e5; color: #fff; font-weight: 900; }
.brand-title, .brand-sub, .eyebrow, .page-title, .page-desc, .section-title, .section-desc, .card-title { display: block; }
.brand-title, .page-title, .section-title, .card-title { font-weight: 900; }
.brand-sub, .page-desc, .section-desc { color: #64748b; }
.nav-item { width: 100%; height: 42px; margin: 0 0 8px; border: 0; border-radius: 10px; background: transparent; color: #475569; text-align: left; font-weight: 800; }
.nav-item.active { background: #eef2ff; color: #4f46e5; }
.compliance-main { min-width: 0; padding: 28px; box-sizing: border-box; }
.eyebrow { color: #4f46e5; font-size: 12px; font-weight: 900; text-transform: uppercase; }
.page-title { margin-top: 6px; font-size: 28px; }
.page-desc { max-width: 760px; margin-top: 8px; line-height: 1.65; }
.metric-grid, .policy-grid { display: grid; gap: 14px; }
.metric-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); margin: 18px 0; }
.metric-card, .section, .state-card, .policy-card { border: 1px solid #e5e7eb; border-radius: 14px; background: #fff; box-shadow: 0 12px 30px rgba(15, 23, 42, .05); box-sizing: border-box; }
.metric-card { padding: 16px; }
.metric-card text { display: block; color: #64748b; font-size: 13px; }
.metric-card strong { display: block; margin-top: 6px; font-size: 24px; }
.filter-bar { display: grid; grid-template-columns: minmax(260px, 1fr) 100px; gap: 10px; margin-bottom: 14px; }
.filter-bar input { height: 42px; padding: 0 12px; border: 1px solid #dbe3ef; border-radius: 10px; background: #fff; box-sizing: border-box; }
.section, .state-card, .policy-card { padding: 18px; }
.section-title { font-size: 20px; }
.section-desc { margin: 6px 0 14px; line-height: 1.6; }
.table { width: 100%; overflow-x: auto; }
.table-row { min-width: 920px; display: grid; grid-template-columns: 1.2fr 1.3fr .8fr .8fr 1fr; gap: 12px; align-items: center; padding: 12px 0; border-top: 1px solid #eef2f7; }
.table-row.head { color: #64748b; font-size: 12px; font-weight: 900; border-top: 0; }
.status { display: inline-flex; width: fit-content; padding: 5px 9px; border-radius: 999px; background: #f1f5f9; color: #475569; font-size: 12px; font-weight: 900; }
.status.granted, .status.authorized, .status.completed { background: #ecfdf5; color: #047857; }
.status.withdrawn, .status.offline_required, .status.rejected { background: #fef2f2; color: #dc2626; }
.status.pending, .status.new, .status.processing, .status.checking { background: #fff7ed; color: #c2410c; }
.policy-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
.policy-row { display: flex; justify-content: space-between; gap: 10px; padding: 10px 0; border-top: 1px solid #eef2f7; color: #475569; }
.empty-text { margin-top: 10px; color: #64748b; }
.primary-btn, .outline-btn { height: 42px; padding: 0 14px; border-radius: 10px; font-weight: 900; }
.primary-btn { border: 0; background: #4f46e5; color: #fff; }
.outline-btn { border: 1px solid #cbd5e1; background: #fff; color: #334155; }
@media (max-width: 900px) {
  .compliance-page { grid-template-columns: 1fr; }
  .compliance-sidebar { position: static; height: auto; display: flex; gap: 8px; overflow-x: auto; }
  .brand { min-width: 170px; margin-bottom: 0; }
  .nav-item { min-width: 100px; text-align: center; }
  .compliance-main { padding: 18px; }
  .page-head, .section-head { flex-direction: column; }
  .metric-grid, .policy-grid, .filter-bar { grid-template-columns: 1fr; }
}
</style>
