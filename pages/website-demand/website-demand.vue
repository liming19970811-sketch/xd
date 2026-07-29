<template>
  <view class="website-page">
    <view class="topbar">
      <view class="brand" @click="scrollTo('#home-section')">
        <view class="brand-mark">D</view>
        <view>
          <text class="brand-name">蝶变 Diebian</text>
          <text class="brand-sub">服装 AI 视觉生产</text>
        </view>
      </view>

      <view class="desktop-nav">
        <text class="nav-item" @click="scrollTo('#home-section')">首页</text>
        <view class="nav-item dropdown">
          <text>AI 出图</text>
          <view class="dropdown-panel">
            <text v-for="item in aiOutputMenu" :key="item.type" @click="goWorkspace(item)"> {{ item.label }} </text>
          </view>
        </view>
        <view class="nav-item dropdown">
          <text>AI 制版</text>
          <view class="dropdown-panel">
            <text v-for="item in patternMenu" :key="item.type" @click="goWorkspace(item)"> {{ item.label }} </text>
          </view>
        </view>
        <text class="nav-item" @click="goWorkspace({ module: 'library' })">版型库</text>
        <text class="nav-item" @click="goWorkspace({ module: 'projects' })">项目中心</text>
        <text class="nav-item" @click="scrollTo('#enterprise-section')">企业服务</text>
        <text class="nav-item" @click="scrollTo('#case-section')">案例</text>
      </view>

      <view class="top-actions">
        <button class="login-btn" @click="goLogin">登录 / 进入工作台</button>
        <button class="menu-btn" @click="mobileMenuOpen = true">菜单</button>
      </view>
    </view>

    <view v-if="mobileMenuOpen" class="mobile-drawer">
      <view class="drawer-card">
        <view class="drawer-head">
          <text>导航</text>
          <text @click="mobileMenuOpen = false">关闭</text>
        </view>
        <text v-for="item in mobileNav" :key="item.label" class="drawer-link" @click="handleMobileNav(item)">{{ item.label }}</text>
      </view>
    </view>

    <view id="home-section" class="hero section">
      <view class="hero-copy">
        <text class="kicker">品牌展示官网 + 专业 AI 工作台</text>
        <text class="hero-title">服装商家和团队的 AI 出图与 AI 制版入口</text>
        <text class="hero-desc">官网只讲清价值与合作方式，专业功能进入工作台完成。视觉出图、AI 制版、版型库和项目交付都有独立入口，不再藏在长页面里。</text>
        <view class="hero-actions">
          <button class="primary-btn" @click="goWorkspace({ module: 'ai-output', type: 'model' })">开始 AI 出图</button>
          <button class="secondary-btn" @click="goWorkspace({ module: 'pattern', type: 'structure' })">进入 AI 制版</button>
        </view>
        <view class="hero-note">
          <text>专业用户登录后可直接进入工作台；手机端使用抽屉导航快速定位。</text>
        </view>
      </view>
      <view class="hero-product">
        <view class="product-top">
          <text>Diebian Workspace</text>
          <text>可直接收藏功能路由</text>
        </view>
        <view class="product-grid">
          <view v-for="item in heroShortcuts" :key="item.label" @click="goWorkspace(item)">
            <text>{{ item.label }}</text>
            <text>{{ item.desc }}</text>
          </view>
        </view>
        <view class="search-preview">
          <text>搜索：项目 / 任务 / 作品 / 版型 / 功能</text>
        </view>
      </view>
    </view>

    <view id="capability-section" class="section split-section">
      <view>
        <text class="kicker">核心能力</text>
        <text class="section-title">两大模块，不再重复堆叠</text>
        <text class="section-desc">首页只保留视觉出图与 AI 制版的能力边界，具体参数、任务、审核和资产进入工作台。</text>
      </view>
      <view class="ability-panels">
        <view class="ability-panel">
          <text class="ability-title">视觉出图</text>
          <text class="ability-desc">换模特、换衣服、换颜色、换场景、改款、换面料、换图案、批量生成。</text>
          <view class="tag-row">
            <text v-for="item in aiOutputMenu" :key="item.type" @click="goWorkspace(item)">{{ item.label }}</text>
          </view>
        </view>
        <view class="ability-panel dark">
          <text class="ability-title">AI 制版</text>
          <text class="ability-desc">服装结构图、AI 制版任务、版型检索、版型审核、训练与评估。</text>
          <view class="tag-row">
            <text v-for="item in patternMenu" :key="item.type" @click="goWorkspace(item)">{{ item.label }}</text>
          </view>
        </view>
      </view>
    </view>

    <view id="scene-section" class="section">
      <view class="section-head">
        <text class="kicker">典型业务场景</text>
        <text class="section-title">从单张图，到项目化交付</text>
      </view>
      <view class="scene-grid">
        <view v-for="item in scenes" :key="item.title" class="scene-card">
          <text class="scene-title">{{ item.title }}</text>
          <text class="scene-desc">{{ item.desc }}</text>
          <button class="small-btn" @click="goWorkspace(item.route)">进入</button>
        </view>
      </view>
    </view>

    <view id="case-section" class="section case-section">
      <view class="section-head">
        <text class="kicker">精选真实案例</text>
        <text class="section-title">未授权真实客户不展示名称</text>
        <text class="section-desc">当前展示为演示结构，不伪装真实客户。后续接入授权案例后再展示客户名称、行业与数据。</text>
      </view>
      <view class="case-grid">
        <view v-for="item in cases" :key="item.title" class="case-card">
          <view class="case-visual">
            <view>原图</view>
            <view>AI 结果</view>
          </view>
          <text class="case-label">演示案例，不代表真实客户</text>
          <text class="case-title">{{ item.title }}</text>
          <text class="case-desc">{{ item.desc }}</text>
        </view>
      </view>
    </view>

    <view id="enterprise-section" class="section enterprise-section">
      <view class="enterprise-copy">
        <text class="kicker">企业合作与咨询</text>
        <text class="section-title">需要批量生产、项目交付或制版资产管理？</text>
        <text class="section-desc">官网首页不再维护独立长表单。所有企业需求统一进入同一套分步提交流程，提交后生成需求编号并进入后台跟进。</text>
      </view>
      <view class="lead-form">
        <text class="request-title">统一企业需求入口</text>
        <text class="request-desc">分三步提交：联系方式、业务需求、交付要求。只需联系人和一种有效联系方式必填，附件会优先保存为私有云文件。</text>
        <view class="request-list">
          <text>生成真实 leadId，可查询处理状态</text>
          <text>后台可记录跟进人、跟进内容和下次跟进时间</text>
          <text>确认需求后再一键转项目，保留线索快照</text>
        </view>
        <button class="submit-btn" @click="goEnterpriseRequest">提交企业需求</button>
        <text class="form-tip">不在首页重复维护第二套表单。</text>
      </view>
    </view>
  </view>
</template>

<script>
import { submitLead } from '../../utils/api/leads'
import { createProjectFromLead } from '../../utils/project/projectFromLead'
import { buildLeadSnapshot } from '../../utils/website/leadSource'

const AI_OUTPUT_MENU = [
  { label: '换模特', module: 'ai-output', type: 'model' },
  { label: '换衣服', module: 'ai-output', type: 'clothing' },
  { label: '换颜色', module: 'ai-output', type: 'color' },
  { label: '换场景', module: 'ai-output', type: 'scene' },
  { label: '改款', module: 'ai-output', type: 'refine' },
  { label: '换面料', module: 'ai-output', type: 'fabric' },
  { label: '换图案', module: 'ai-output', type: 'pattern' },
  { label: '批量生成', module: 'ai-output', type: 'batch' }
]

const PATTERN_MENU = [
  { label: '服装结构图', module: 'pattern', type: 'structure' },
  { label: 'AI 制版任务', module: 'pattern', type: 'drafting' },
  { label: '版型检索', module: 'pattern', type: 'search' },
  { label: '版型审核', module: 'pattern', type: 'review' },
  { label: '训练与评估', module: 'pattern', type: 'training', adminOnly: true }
]

export default {
  data() {
    return {
      mobileMenuOpen: false,
      submitting: false,
      aiOutputMenu: AI_OUTPUT_MENU,
      patternMenu: PATTERN_MENU,
      demandOptions: [
        { label: 'AI 出图', value: 'ai_listing' },
        { label: 'AI 制版', value: 'pattern_making' },
        { label: '版型库', value: 'pattern_library' },
        { label: '企业服务', value: 'enterprise_cooperation' }
      ],
      heroShortcuts: [
        { label: '换模特', desc: '商品图快速上新', module: 'ai-output', type: 'model' },
        { label: 'AI 制版任务', desc: '结构图与版型流转', module: 'pattern', type: 'drafting' },
        { label: '版型库', desc: '检索复用版型资产', module: 'library' },
        { label: '项目中心', desc: '管理需求与交付', module: 'projects' }
      ],
      scenes: [
        { title: '电商快速上新', desc: '主图、模特图、白底图、详情页素材集中产出。', route: { module: 'ai-output', type: 'batch' } },
        { title: '设计研发打样', desc: '改款、换图案、结构图和版型检索串成研发流程。', route: { module: 'pattern', type: 'structure' } },
        { title: '企业项目交付', desc: '把任务、作品、审核和交付放入项目中心。', route: { module: 'projects' } }
      ],
      cases: [
        { title: '女装新品上新演示', desc: '从挂拍图生成模特展示图、场景图和平台素材包。' },
        { title: '跨境多色 SKU 演示', desc: '换色、白底图和批量生成帮助统一 Listing 图。' },
        { title: '版型资产复用演示', desc: '从结构图到版型检索，帮助设计团队减少重复沟通。' }
      ],
      form: {
        companyName: '',
        contactName: '',
        phone: '',
        wechat: '',
        demandType: 'enterprise_cooperation',
        requirementText: '',
        serviceScope: ['model_replace', 'batch_generate'],
        source: 'website',
        sourcePage: 'website-demand',
        sourceChannel: 'website',
        leadSource: 'website_home',
        sourceType: 'website',
        sourceId: 'website-demand',
        interestType: 'home'
      }
    }
  },
  computed: {
    mobileNav() {
      return [
        { label: '首页', anchor: '#home-section' },
        ...this.aiOutputMenu,
        ...this.patternMenu,
        { label: '版型库', module: 'library' },
        { label: '项目中心', module: 'projects' },
        { label: '企业服务', anchor: '#enterprise-section' },
        { label: '案例', anchor: '#case-section' },
        { label: '登录 / 进入工作台', login: true }
      ]
    }
  },
  methods: {
    scrollTo(selector) {
      uni.pageScrollTo({ selector, duration: 240 })
    },
    goLogin() {
      uni.navigateTo({ url: '/pages/workspace/workspace' })
    },
    goEnterpriseRequest() {
      uni.navigateTo({ url: '/pages/enterprise-request/enterprise-request?sourceType=website_home' })
    },
    goWorkspace(route = {}) {
      const query = []
      if (route.module) query.push(`module=${encodeURIComponent(route.module)}`)
      if (route.type) query.push(`type=${encodeURIComponent(route.type)}`)
      const suffix = query.length ? `?${query.join('&')}` : ''
      uni.navigateTo({ url: `/pages/workspace/workspace${suffix}` })
    },
    handleMobileNav(item = {}) {
      this.mobileMenuOpen = false
      if (item.login) {
        this.goLogin()
        return
      }
      if (item.anchor) {
        this.$nextTick(() => this.scrollTo(item.anchor))
        return
      }
      this.goWorkspace(item)
    },
    selectDemand(item = {}) {
      this.form.demandType = item.value
      this.form.interestType = item.value
    },
    buildLeadPayload() {
      const leadSnapshot = buildLeadSnapshot({ form: this.form })
      return {
        ...this.form,
        mobile: this.form.phone,
        description: this.form.requirementText,
        leadSnapshot,
        interestSnapshot: leadSnapshot.interestSnapshot,
        sourceContext: {
          taskId: '',
          batchId: '',
          projectId: '',
          assetId: '',
          deliveryId: '',
          sourcePage: 'website-demand'
        }
      }
    },
    async submitDemand() {
      if (!this.form.companyName || !this.form.contactName || !this.form.phone) {
        uni.showToast({ title: '请填写公司/店铺、联系人和手机号', icon: 'none' })
        return
      }
      if (this.submitting) return
      this.submitting = true
      try {
        const payload = this.buildLeadPayload()
        const result = await submitLead(payload)
        const lead = result && result.lead ? result.lead : {}
        const leadId = lead.leadId || lead.id || ''
        if (leadId) {
          createProjectFromLead({ ...lead, leadId, companyName: this.form.companyName, customerName: this.form.contactName, phone: this.form.phone, requirementText: this.form.requirementText })
        }
        uni.navigateTo({ url: `/pages/website-demand-success/website-demand-success?leadId=${encodeURIComponent(leadId)}` })
      } catch (error) {
        uni.showToast({ title: '提交失败，请稍后重试', icon: 'none' })
      } finally {
        this.submitting = false
      }
    }
  }
}
</script>

<style scoped>
.website-page { min-height: 100vh; background: #f8fafc; color: #0f172a; }
.topbar { position: sticky; top: 16rpx; z-index: 20; display: flex; align-items: center; justify-content: space-between; gap: 22rpx; width: min(1200px, calc(100% - 48rpx)); margin: 0 auto; padding: 16rpx 18rpx; border: 1rpx solid rgba(15,23,42,.08); border-radius: 28rpx; background: rgba(15,23,42,.94); box-shadow: 0 18rpx 54rpx rgba(15,23,42,.16); box-sizing: border-box; }
.brand, .desktop-nav, .top-actions, .hero-actions, .form-row { display: flex; align-items: center; }
.brand { gap: 14rpx; cursor: pointer; }
.brand-mark { display:flex; align-items:center; justify-content:center; width: 56rpx; height: 56rpx; border-radius: 18rpx; background: linear-gradient(135deg,#4f46e5,#7c3aed); color:#fff; font-weight:900; }
.brand-name, .brand-sub, .kicker, .hero-title, .hero-desc, .section-title, .section-desc, .ability-title, .ability-desc, .scene-title, .scene-desc, .case-label, .case-title, .case-desc { display:block; }
.brand-name { color:#fff; font-size:27rpx; font-weight:920; }
.brand-sub { margin-top:2rpx; color:#c7d2fe; font-size:19rpx; }
.desktop-nav { flex:1; justify-content:center; gap:26rpx; }
.nav-item { position:relative; color:rgba(255,255,255,.78); font-size:23rpx; font-weight:760; cursor:pointer; }
.dropdown-panel { display:none; position:absolute; top:38rpx; left:50%; transform:translateX(-50%); min-width:220rpx; padding:12rpx; border-radius:18rpx; background:#fff; box-shadow:0 22rpx 56rpx rgba(15,23,42,.18); }
.dropdown:hover .dropdown-panel { display:grid; gap:6rpx; }
.dropdown-panel text { padding:12rpx 14rpx; border-radius:12rpx; color:#334155; font-size:22rpx; white-space:nowrap; }
.dropdown-panel text:hover { background:#eef2ff; color:#4f46e5; }
.login-btn, .menu-btn { margin:0; border-radius:999rpx; font-size:22rpx; font-weight:850; }
.login-btn { height:58rpx; line-height:58rpx; padding:0 22rpx; background:#fff; color:#4338ca; }
.menu-btn { display:none; height:58rpx; line-height:58rpx; background:#334155; color:#fff; }
.section { width:min(1200px, calc(100% - 48rpx)); margin:0 auto; padding:68rpx 0; }
.hero { display:grid; grid-template-columns:minmax(0,.98fr) minmax(420rpx,1.02fr); gap:58rpx; align-items:center; min-height:720rpx; }
.kicker { color:#4f46e5; font-size:24rpx; font-weight:900; }
.hero-title { max-width:760rpx; margin-top:18rpx; font-size:72rpx; line-height:1.06; font-weight:950; letter-spacing:0; }
.hero-desc, .section-desc { margin-top:18rpx; color:#64748b; font-size:27rpx; line-height:1.7; }
.hero-actions { flex-wrap:wrap; gap:16rpx; margin-top:34rpx; }
.primary-btn, .secondary-btn, .submit-btn { margin:0; border-radius:999rpx; font-weight:900; }
.primary-btn, .secondary-btn { height:78rpx; line-height:78rpx; padding:0 34rpx; font-size:26rpx; }
.primary-btn { background:linear-gradient(135deg,#4f46e5,#7c3aed); color:#fff; box-shadow:0 20rpx 48rpx rgba(79,70,229,.24); }
.secondary-btn { border:1rpx solid rgba(79,70,229,.22); background:#fff; color:#4338ca; }
.hero-note { margin-top:24rpx; padding:18rpx 22rpx; border-radius:20rpx; background:#eef2ff; color:#475569; font-size:22rpx; }
.hero-product, .ability-panel, .scene-card, .case-card, .lead-form { border:1rpx solid rgba(15,23,42,.08); border-radius:32rpx; background:#fff; box-shadow:0 20rpx 70rpx rgba(15,23,42,.07); box-sizing:border-box; }
.hero-product { padding:28rpx; }
.product-top { display:flex; justify-content:space-between; gap:16rpx; color:#64748b; font-size:22rpx; font-weight:800; }
.product-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:14rpx; margin-top:24rpx; }
.product-grid view { min-height:150rpx; padding:22rpx; border-radius:22rpx; background:#f8fafc; box-sizing:border-box; }
.product-grid text:first-child { display:block; color:#111827; font-size:28rpx; font-weight:920; }
.product-grid text:last-child { display:block; margin-top:8rpx; color:#64748b; font-size:21rpx; }
.search-preview { margin-top:18rpx; padding:18rpx; border-radius:18rpx; background:#0f172a; color:#fff; font-size:23rpx; }
.split-section, .enterprise-section { display:grid; grid-template-columns:minmax(0,.72fr) minmax(0,1.28fr); gap:38rpx; align-items:start; }
.section-title { margin-top:12rpx; font-size:46rpx; line-height:1.2; font-weight:950; }
.ability-panels { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:18rpx; }
.ability-panel { padding:30rpx; }
.ability-panel.dark { background:#111827; }
.ability-title { font-size:34rpx; font-weight:940; }
.ability-panel.dark .ability-title, .ability-panel.dark .ability-desc { color:#fff; }
.ability-desc { margin-top:12rpx; color:#64748b; font-size:24rpx; line-height:1.55; }
.tag-row, .chip-row { display:flex; flex-wrap:wrap; gap:10rpx; margin-top:20rpx; }
.tag-row text, .chip-row text { padding:10rpx 14rpx; border-radius:999rpx; background:#eef2ff; color:#4f46e5; font-size:21rpx; font-weight:820; }
.ability-panel.dark .tag-row text { background:rgba(255,255,255,.12); color:#c7d2fe; }
.section-head { max-width:860rpx; margin-bottom:26rpx; }
.scene-grid, .case-grid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:18rpx; }
.scene-card { padding:28rpx; }
.scene-title, .case-title { font-size:30rpx; font-weight:930; }
.scene-desc, .case-desc { margin-top:10rpx; color:#64748b; font-size:23rpx; line-height:1.55; }
.small-btn { width:160rpx; height:58rpx; line-height:58rpx; margin:22rpx 0 0; border-radius:999rpx; background:#111827; color:#fff; font-size:22rpx; }
.case-visual { display:grid; grid-template-columns:1fr 1fr; gap:10rpx; }
.case-visual view { display:flex; align-items:center; justify-content:center; min-height:190rpx; border-radius:20rpx; background:#f1f5f9; color:#334155; font-weight:900; }
.case-visual view:last-child { background:linear-gradient(145deg,#eef2ff,#fff); color:#4338ca; }
.case-label { margin-top:14rpx; color:#6b7280; font-size:20rpx; }
.enterprise-section { padding-bottom:86rpx; }
.lead-form { padding:30rpx; }
.request-title { display:block; color:#0f172a; font-size:32rpx; font-weight:940; }
.request-desc { display:block; margin-top:12rpx; color:#475569; font-size:24rpx; line-height:1.6; }
.request-list { display:grid; gap:10rpx; margin:22rpx 0; padding:18rpx; border-radius:20rpx; background:#f8fafc; }
.request-list text { color:#334155; font-size:22rpx; line-height:1.45; }
.input, .textarea { width:100%; margin-bottom:14rpx; padding:20rpx 22rpx; border:1rpx solid rgba(15,23,42,.09); border-radius:18rpx; background:#f8fafc; color:#111827; font-size:25rpx; box-sizing:border-box; }
.form-row { gap:14rpx; }
.chip-row text.active { background:#4f46e5; color:#fff; }
.textarea { min-height:126rpx; }
.submit-btn { width:100%; height:82rpx; line-height:82rpx; background:linear-gradient(135deg,#4f46e5,#7c3aed); color:#fff; font-size:27rpx; }
.form-tip { display:block; margin-top:14rpx; color:#64748b; font-size:21rpx; text-align:center; }
.mobile-drawer { position:fixed; inset:0; z-index:50; padding:24rpx; background:rgba(15,23,42,.45); box-sizing:border-box; }
.drawer-card { margin-left:auto; width:min(620rpx,100%); padding:26rpx; border-radius:28rpx; background:#fff; }
.drawer-head { display:flex; justify-content:space-between; margin-bottom:16rpx; font-size:28rpx; font-weight:900; }
.drawer-link { display:block; padding:18rpx 0; border-bottom:1rpx solid #eef2f7; color:#0f172a; font-size:25rpx; }
@media screen and (max-width: 900px) {
  .topbar, .section { width:calc(100% - 36rpx); }
  .desktop-nav, .login-btn { display:none; }
  .menu-btn { display:block; }
  .topbar { top:0; border-radius:0 0 24rpx 24rpx; width:100%; }
  .hero, .split-section, .enterprise-section, .ability-panels, .scene-grid, .case-grid { grid-template-columns:1fr; }
  .hero { min-height:auto; padding-top:48rpx; }
  .hero-title { font-size:52rpx; }
  .section { padding:44rpx 0; }
  .section-title { font-size:38rpx; }
  .product-grid { grid-template-columns:1fr; }
  .form-row { display:block; }
}
</style>
