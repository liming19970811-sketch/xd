<template>
  <view class="public-page">
    <view class="public-nav">
      <view class="brand" @click="goPublic('/pages/website-demand/website-demand')">
        <text class="brand-mark">蝶</text>
        <view>
          <text class="brand-name">蝶变 Diebian</text>
          <text class="brand-sub">AI 服装视觉与制版</text>
        </view>
      </view>
      <view class="nav-links">
        <text @click="goPublic('/pages/website-demand/website-demand')">首页</text>
        <text class="active">案例</text>
        <text @click="goPublic('/pages/enterprise-solution/enterprise-solution')">解决方案</text>
        <text @click="goPublic('/pages/knowledge-center/knowledge-center')">知识中心</text>
        <text @click="goPublic('/pages/enterprise-request/enterprise-request?sourceType=enterprise')">企业合作</text>
      </view>
    </view>

    <view v-if="selectedCase" class="detail-shell">
      <text class="back-link" @click="clearDetail">← 返回案例中心</text>
      <view class="detail-hero">
        <view>
          <text class="kicker">{{ selectedCase.category }}</text>
          <text class="hero-title">{{ selectedCase.title }}</text>
          <text class="hero-desc">{{ selectedCase.projectBackground }}</text>
          <text class="auth-badge">{{ getAuthorizationLabel(selectedCase) }}</text>
        </view>
        <view class="auth-card">
          <text>公开授权状态</text>
          <text>{{ selectedCase.authorization.label }}</text>
          <text>{{ selectedCase.authorization.validUntil || '无客户授权素材，不展示客户名称、Logo 或图片' }}</text>
        </view>
      </view>

      <view class="comparison-grid">
        <view v-for="frame in selectedCase.comparisonFrames" :key="frame.label" class="comparison-card">
          <view class="comparison-visual">{{ frame.label }}</view>
          <text>{{ frame.desc }}</text>
        </view>
      </view>

      <view class="detail-grid">
        <view v-for="section in caseDetailSections" :key="section.title" class="detail-card">
          <text class="detail-title">{{ section.title }}</text>
          <text class="detail-copy">{{ section.copy }}</text>
        </view>
      </view>

      <view class="process-panel">
        <text class="detail-title">AI处理流程</text>
        <view class="process-line">
          <view v-for="(step, index) in selectedCase.process" :key="step" class="process-step">
            <text>0{{ index + 1 }}</text>
            <text>{{ step }}</text>
          </view>
        </view>
      </view>

      <view class="conversion-card">
        <view>
          <text class="conversion-title">想把类似流程用于团队项目？</text>
          <text class="conversion-desc">公开案例页只保留两个动作：进入对应 AI 功能，或提交企业需求。</text>
        </view>
        <view class="conversion-actions">
          <button class="secondary-btn" @click="goWorkspace(selectedCase.relatedFunctions[0].path)">进入对应AI功能</button>
          <button class="primary-btn" @click="goPublic('/pages/enterprise-request/enterprise-request?sourceType=case&sourceId=' + selectedCase.caseId)">提交企业需求</button>
        </view>
      </view>
    </view>

    <view v-else>
      <view class="hero-section">
        <text class="kicker">公开案例中心</text>
        <text class="hero-title">真实授权优先，未授权只展示产品能力演示</text>
        <text class="hero-desc">案例用于说明 AI 出图、AI 制版、版型整理和企业项目的业务流程。未获公开授权时，不展示客户名称、Logo、图片或虚构效果数据。</text>
      </view>

      <view class="category-tabs">
        <text class="category-tab" :class="{ active: activeCategory === '' }" @click="setCategory('')">全部</text>
        <text v-for="category in categories" :key="category" class="category-tab" :class="{ active: activeCategory === category }" @click="setCategory(category)">{{ category }}</text>
      </view>

      <view class="case-grid">
        <view v-for="item in filteredCases" :key="item.caseId" class="case-card" @click="openCase(item.caseId)">
          <view class="case-visual">
            <view>原图</view>
            <view>AI初稿</view>
            <view>修订稿</view>
          </view>
          <view class="case-head">
            <text>{{ item.category }}</text>
            <text>{{ item.authorization.label }}</text>
          </view>
          <text class="case-title">{{ item.title }}</text>
          <text class="case-desc">{{ item.originalProblem }}</text>
          <view class="case-meta">
            <view><text>使用功能</text><text>{{ item.usedFunctions.join(' / ') }}</text></view>
            <view><text>交付内容</text><text>{{ item.delivery }}</text></view>
            <view><text>适用行业</text><text>{{ item.industry }}</text></view>
            <view><text>公开授权</text><text>{{ item.authorization.publicAuthorized ? '已授权' : '未使用客户素材' }}</text></view>
          </view>
          <view class="tag-list">
            <text v-for="tag in item.tags" :key="tag">{{ tag }}</text>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script>
import {
  ENTERPRISE_CASE_CATEGORIES,
  getCaseAuthorizationLabel,
  getEnterpriseCaseById,
  listEnterpriseCases
} from '../../utils/website/caseRepository'

export default {
  data() {
    return {
      activeCategory: '',
      selectedCaseId: '',
      categories: ENTERPRISE_CASE_CATEGORIES
    }
  },
  computed: {
    filteredCases() {
      return listEnterpriseCases(this.activeCategory)
    },
    selectedCase() {
      return this.selectedCaseId ? getEnterpriseCaseById(this.selectedCaseId) : null
    },
    caseDetailSections() {
      const item = this.selectedCase
      if (!item) return []
      return [
        { title: '项目背景', copy: item.projectBackground },
        { title: '客户问题', copy: item.originalProblem },
        { title: '输入素材说明', copy: item.inputNotes },
        { title: '人工审核与修订', copy: item.humanReview },
        { title: '交付结果', copy: item.resultSummary },
        { title: '适用场景', copy: item.scenarios.join('、') }
      ]
    }
  },
  onLoad(options = {}) {
    if (options.caseId) {
      this.selectedCaseId = decodeURIComponent(options.caseId)
    }
  },
  methods: {
    setCategory(category) {
      this.activeCategory = category || ''
    },
    openCase(caseId) {
      this.selectedCaseId = caseId
      if (process.env.NODE_ENV !== 'production') {
        const item = getEnterpriseCaseById(caseId)
        console.log('[website:case]', { caseId, title: item ? item.title : '' })
      }
    },
    clearDetail() {
      this.selectedCaseId = ''
    },
    getAuthorizationLabel(item) {
      return getCaseAuthorizationLabel(item)
    },
    goPublic(url) {
      uni.navigateTo({ url })
    },
    goWorkspace(path) {
      const target = path || '/workspace'
      if (target.indexOf('/workspace') === 0) {
        const typeMatch = target.match(/[?&]type=([^&]+)/)
        const moduleName = target.indexOf('pattern-making') > -1 ? 'pattern-making' : 'ai-output'
        const typeQuery = typeMatch ? `&type=${encodeURIComponent(decodeURIComponent(typeMatch[1]))}` : ''
        uni.navigateTo({ url: `/pages/workspace/workspace?module=${moduleName}${typeQuery}` })
        return
      }
      this.goPublic(target)
    }
  }
}
</script>

<style scoped>
.public-page { min-height:100vh; padding:28rpx; background:#f8fafc; color:#0f172a; box-sizing:border-box; }
.public-nav, .hero-section, .detail-shell, .category-tabs, .case-grid { max-width:1180rpx; margin:0 auto; }
.public-nav { position:sticky; top:18rpx; z-index:5; display:flex; align-items:center; justify-content:space-between; gap:24rpx; padding:18rpx 22rpx; border:1rpx solid rgba(15,23,42,.08); border-radius:26rpx; background:rgba(255,255,255,.94); box-shadow:0 18rpx 54rpx rgba(15,23,42,.08); }
.brand { display:flex; align-items:center; gap:14rpx; }
.brand-mark { display:flex; align-items:center; justify-content:center; width:52rpx; height:52rpx; border-radius:16rpx; background:#4f46e5; color:#fff; font-weight:900; }
.brand-name, .brand-sub, .kicker, .hero-title, .hero-desc, .case-title, .case-desc, .detail-title, .detail-copy, .conversion-title, .conversion-desc { display:block; }
.brand-name { font-size:26rpx; font-weight:900; }
.brand-sub { margin-top:2rpx; color:#64748b; font-size:19rpx; }
.nav-links { display:flex; gap:24rpx; color:#475569; font-size:22rpx; font-weight:800; }
.nav-links .active { color:#4f46e5; }
.hero-section { padding:72rpx 0 30rpx; }
.kicker { color:#4f46e5; font-size:24rpx; font-weight:900; }
.hero-title { max-width:880rpx; margin-top:14rpx; font-size:56rpx; line-height:1.12; font-weight:950; }
.hero-desc { max-width:860rpx; margin-top:18rpx; color:#475569; font-size:27rpx; line-height:1.65; }
.category-tabs { display:flex; flex-wrap:wrap; gap:12rpx; padding:8rpx 0 28rpx; }
.category-tab { padding:11rpx 18rpx; border:1rpx solid #e2e8f0; border-radius:999rpx; background:#fff; color:#475569; font-size:22rpx; font-weight:850; }
.category-tab.active { border-color:#4f46e5; background:#4f46e5; color:#fff; }
.case-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:20rpx; }
.case-card, .detail-card, .process-panel, .conversion-card, .auth-card { border:1rpx solid rgba(15,23,42,.08); border-radius:26rpx; background:#fff; box-shadow:0 18rpx 54rpx rgba(15,23,42,.06); box-sizing:border-box; }
.case-card { padding:22rpx; }
.case-visual { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:10rpx; }
.case-visual view, .comparison-visual { display:flex; align-items:center; justify-content:center; min-height:168rpx; border-radius:20rpx; background:linear-gradient(145deg,#eef2ff,#fff); color:#4338ca; font-weight:900; }
.case-visual view:first-child { background:#f1f5f9; color:#334155; }
.case-head { display:flex; justify-content:space-between; gap:14rpx; margin-top:16rpx; color:#4f46e5; font-size:21rpx; font-weight:850; }
.case-title { margin-top:10rpx; font-size:31rpx; font-weight:940; line-height:1.28; }
.case-desc { margin-top:10rpx; color:#475569; font-size:23rpx; line-height:1.55; }
.case-meta { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:10rpx; margin-top:16rpx; }
.case-meta view { padding:14rpx; border-radius:16rpx; background:#f8fafc; }
.case-meta text { display:block; color:#334155; font-size:20rpx; line-height:1.45; }
.case-meta text:first-child { color:#64748b; font-size:18rpx; font-weight:850; }
.tag-list { display:flex; flex-wrap:wrap; gap:8rpx; margin-top:14rpx; }
.tag-list text { padding:7rpx 11rpx; border-radius:999rpx; background:#eef2ff; color:#4f46e5; font-size:19rpx; font-weight:800; }
.detail-shell { padding:34rpx 0 60rpx; }
.back-link { display:block; margin:18rpx 0; color:#4f46e5; font-size:23rpx; font-weight:850; }
.detail-hero { display:grid; grid-template-columns:minmax(0,1fr) 360rpx; gap:20rpx; align-items:stretch; }
.auth-badge { display:inline-flex; width:fit-content; margin-top:18rpx; padding:10rpx 16rpx; border-radius:999rpx; background:#eef2ff; color:#4338ca; font-size:21rpx; font-weight:850; }
.auth-card { padding:22rpx; display:grid; gap:10rpx; color:#475569; font-size:22rpx; }
.auth-card text:first-child { color:#0f172a; font-size:25rpx; font-weight:900; }
.comparison-grid { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:14rpx; margin-top:24rpx; }
.comparison-card { padding:14rpx; border-radius:22rpx; background:#fff; border:1rpx solid #e2e8f0; }
.comparison-card text { display:block; margin-top:9rpx; color:#475569; font-size:20rpx; line-height:1.45; }
.detail-grid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:16rpx; margin-top:22rpx; }
.detail-card, .process-panel, .conversion-card { padding:22rpx; }
.detail-title { font-size:25rpx; font-weight:920; }
.detail-copy { margin-top:10rpx; color:#475569; font-size:22rpx; line-height:1.58; }
.process-panel { margin-top:22rpx; }
.process-line { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:12rpx; margin-top:16rpx; }
.process-step { padding:16rpx; border-radius:18rpx; background:#f8fafc; }
.process-step text { display:block; color:#334155; font-size:21rpx; line-height:1.45; }
.process-step text:first-child { color:#4f46e5; font-weight:950; }
.conversion-card { display:flex; align-items:center; justify-content:space-between; gap:20rpx; margin-top:22rpx; }
.conversion-title { font-size:28rpx; font-weight:940; }
.conversion-desc { margin-top:8rpx; color:#64748b; font-size:22rpx; }
.conversion-actions { display:flex; gap:12rpx; }
.primary-btn, .secondary-btn { min-width:180rpx; height:64rpx; line-height:64rpx; margin:0; border-radius:999rpx; font-size:22rpx; font-weight:850; }
.primary-btn { background:#4f46e5; color:#fff; }
.secondary-btn { border:1rpx solid #c7d2fe; background:#fff; color:#4338ca; }
@media screen and (max-width: 900px) {
  .public-page { padding:18rpx; }
  .public-nav, .detail-hero, .conversion-card { display:block; }
  .nav-links { margin-top:16rpx; flex-wrap:wrap; gap:14rpx; }
  .hero-title { font-size:42rpx; }
  .case-grid, .case-meta, .comparison-grid, .detail-grid, .process-line { grid-template-columns:1fr; }
  .auth-card, .conversion-actions { margin-top:16rpx; }
  .conversion-actions { display:grid; }
}
</style>
