<template>
  <view class="container">
    <view class="nav-card">
      <view class="nav-list">
        <text class="nav-item" @click="goToHome">Home</text>
        <text class="nav-item" @click="goToServices">Services</text>
        <text class="nav-item" @click="goToCases">Cases</text>
        <text class="nav-item" @click="goToEnterprise">Enterprise</text>
        <text class="nav-item" @click="goToDemand">Submit Demand</text>
      </view>
    </view>

    <view class="hero-card">
      <text class="case-type">{{ caseDetail.type }}</text>
      <text class="hero-title">{{ caseDetail.title }}</text>
      <text class="hero-desc">{{ caseDetail.summary }}</text>
    </view>

    <view class="section-card">
      <text class="section-title">客户场景 / 适用对象</text>
      <text class="section-desc">{{ caseDetail.target }}</text>
    </view>

    <view class="section-card">
      <text class="section-title">需求问题</text>
      <text class="section-desc">{{ caseDetail.problem }}</text>
    </view>

    <view class="section-card">
      <text class="section-title">解决方案</text>
      <text class="section-desc">{{ caseDetail.solution }}</text>
    </view>

    <view class="section-card">
      <text class="section-title">结果亮点</text>
      <view class="point-list">
        <view v-for="item in caseDetail.resultHighlights" :key="item" class="point-item">
          <text class="point-text">{{ item }}</text>
        </view>
      </view>
    </view>

    <view class="section-card">
      <text class="section-title">适用服务</text>
      <view class="tag-list">
        <text v-for="item in caseDetail.services" :key="item" class="tag-item">{{ item }}</text>
      </view>
    </view>

    <view class="cta-card">
      <text class="cta-title">想把类似结果落到你的项目中？</text>
      <text class="cta-desc">提交需求后，我们会根据你的业务目标给出最小可落地承接方案。</text>
      <button class="primary-btn" @click="goToDemand">提交需求</button>
      <button class="secondary-btn" @click="goToCases">返回案例列表</button>
    </view>
  </view>
</template>

<script>
const CASE_DETAIL_MAP = {
  'model-replacement-core-sku': {
    caseId: 'model-replacement-core-sku',
    title: 'Model Replacement for Core SKU',
    type: 'Model Replacement',
    summary: '核心款在不重拍前提下完成模特化升级，提升电商主图吸引力。',
    target: '品牌方、电商团队，尤其是核心款迭代频繁且上线时间紧的团队。',
    problem: '原图缺少真人穿搭语境，主图竞争力不足，活动窗口临近无法完成完整重拍。',
    solution: 'AI 快速生成模特方向，人工做风格统一与可用性复核，确保结果可直接用于上线。',
    resultHighlights: [
      '核心款主图更具转化导向',
      '减少紧急重拍与反复沟通成本',
      '输出风格更贴近品牌调性'
    ],
    services: ['单款快速视觉优化', '电商视觉图生成与升级']
  },
  'season-color-extension': {
    caseId: 'season-color-extension',
    title: 'Color Extension for Seasonal Range',
    type: 'Color Change',
    summary: '围绕已确认款式扩展多色系视觉，支持季节上新节奏。',
    target: '需要快速扩展色系并保持视觉一致性的商品团队。',
    problem: '多色版本制作慢、质量不稳，导致上新与营销节奏不同步。',
    solution: 'AI 先做多色方向生成，人工把控材质与色彩真实性，输出可用版本。',
    resultHighlights: [
      '多色视觉交付节奏加快',
      '跨色系展示一致性更稳定',
      '减少重复修图和二次返工'
    ],
    services: ['系列上新 / 延款设计', '电商视觉图生成与升级']
  },
  'scene-upgrade-main-visual': {
    caseId: 'scene-upgrade-main-visual',
    title: 'Scene Upgrade for Main Visuals',
    type: 'Scene Upgrade',
    summary: '从基础棚拍升级到场景化视觉，增强品牌表达与购买氛围。',
    target: '希望提升页面叙事感和场景表达的品牌与运营团队。',
    problem: '原始棚拍图信息密度低，场景表达弱，难以支撑核心营销页面。',
    solution: 'AI 提供多场景升级方案，人工做构图和信息层级优化，保证电商可读性。',
    resultHighlights: [
      '主视觉叙事力明显增强',
      '页面整体氛围更贴近目标人群',
      '营销页面素材复用能力提升'
    ],
    services: ['换场景服务', '电商视觉图生成与升级']
  },
  'micro-redesign-before-sample': {
    caseId: 'micro-redesign-before-sample',
    title: 'Micro Redesign Before Sampling',
    type: 'Micro Redesign',
    summary: '在打样前完成微改款方向验证，减少试错成本。',
    target: '设计与商品协同团队，需在样衣前快速验证方向。',
    problem: '方向过多、沟通成本高，打样前难以快速收敛可执行方案。',
    solution: 'AI 先做微改款探索，人工基于业务可行性筛选和收敛方向。',
    resultHighlights: [
      '打样前方向更明确',
      '前期评审周期缩短',
      '后续执行决策更高效'
    ],
    services: ['微改款设计服务', '系列上新 / 延款设计']
  },
  'ecommerce-upgrade-pack': {
    caseId: 'ecommerce-upgrade-pack',
    title: 'Ecommerce Visual Upgrade Pack',
    type: 'Ecommerce Visual Upgrade',
    summary: '主图、详情图与场景图统一升级，形成电商可复用视觉系统。',
    target: 'SKU 较多、需要统一视觉口径的电商运营团队。',
    problem: '素材分散、标准不一，导致详情页表达和主图策略不一致。',
    solution: 'AI 提供规模化生成能力，人工做统一规范和结果校验，保证可交付质量。',
    resultHighlights: [
      '主图与详情体系更加统一',
      '多商品视觉升级效率提升',
      '跨页面质量一致性更好'
    ],
    services: ['电商视觉图生成与升级', '批量生成支持']
  },
  'enterprise-collaboration-program': {
    caseId: 'enterprise-collaboration-program',
    title: 'Enterprise Project Collaboration',
    type: 'Enterprise Project',
    summary: '从零散需求升级为项目制承接，支持长期稳定交付。',
    target: '有持续上新与多团队协作需求的企业客户。',
    problem: '单次需求难管理，执行进度分散，无法沉淀可复用的交付节奏。',
    solution: '通过需求-项目-任务-批次的闭环，结合 AI + 人工协同完成持续交付。',
    resultHighlights: [
      '项目执行可见性更强',
      '多任务交付节奏更稳定',
      '长期合作效率与质量同步提升'
    ],
    services: ['企业长期合作 / 项目制服务', '批量生成支持']
  }
}

const EMPTY_CASE = {
  title: 'Case Not Found',
  type: 'Unknown',
  summary: 'This case is currently unavailable.',
  target: 'Please return to case list and choose another case.',
  problem: '-',
  solution: '-',
  resultHighlights: ['No detail available'],
  services: ['Submit demand for custom consultation']
}

export default {
  data() {
    return {
      caseId: '',
      caseDetail: EMPTY_CASE
    }
  },
  onLoad(query) {
    const caseId = query && query.caseId ? decodeURIComponent(query.caseId) : ''
    this.caseId = caseId
    this.caseDetail = CASE_DETAIL_MAP[caseId] || EMPTY_CASE
  },
  methods: {
    goToHome() {
      uni.switchTab({ url: '/pages/index/index' })
    },
    goToServices() {
      uni.navigateTo({ url: '/pages/services/services' })
    },
    goToCases() {
      uni.navigateTo({ url: '/pages/cases/cases' })
    },
    goToEnterprise() {
      uni.navigateTo({ url: '/pages/enterprise/enterprise' })
    },
    goToDemand() {
      const caseIdQuery = this.caseId ? `&sourceId=${encodeURIComponent(this.caseId)}` : ''
      uni.navigateTo({
        url: `/pages/enterprise-request/enterprise-request?sourceType=case${caseIdQuery}`
      })
    }
  }
}
</script>

<style scoped>
.container {
  min-height: 100vh;
  background: #f6f6f9;
  padding: 24rpx;
}

.nav-card,
.hero-card,
.section-card,
.cta-card {
  background: #fff;
  border-radius: 24rpx;
  padding: 28rpx;
  box-shadow: 0 6rpx 20rpx rgba(0, 0, 0, 0.05);
  margin-bottom: 22rpx;
}

.nav-list {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
}

.nav-item {
  padding: 12rpx 18rpx;
  border-radius: 999rpx;
  background: #f3f8ff;
  color: #1677ff;
  font-size: 22rpx;
}

.case-type {
  display: inline-block;
  padding: 6rpx 14rpx;
  border-radius: 999rpx;
  background: #e6f4ff;
  color: #1677ff;
  font-size: 22rpx;
}

.hero-title {
  display: block;
  margin-top: 14rpx;
  font-size: 38rpx;
  font-weight: 700;
  color: #222;
}

.hero-desc,
.section-desc,
.cta-desc {
  display: block;
  margin-top: 12rpx;
  font-size: 24rpx;
  line-height: 1.7;
  color: #666;
}

.section-title,
.cta-title {
  display: block;
  font-size: 30rpx;
  font-weight: 700;
  color: #222;
}

.point-list {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}

.point-item {
  background: #f8fafc;
  border-radius: 16rpx;
  padding: 18rpx;
}

.point-text {
  font-size: 24rpx;
  line-height: 1.6;
  color: #444;
}

.tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
}

.tag-item {
  padding: 10rpx 18rpx;
  border-radius: 999rpx;
  background: #eef5ff;
  color: #1677ff;
  font-size: 22rpx;
}

.primary-btn,
.secondary-btn {
  margin-top: 18rpx;
  border-radius: 999rpx;
}

.primary-btn {
  background: #1677ff;
  color: #fff;
}

.secondary-btn {
  background: #eef5ff;
  color: #1677ff;
}
</style>
