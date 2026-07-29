<template>
  <view class="container">
    <view class="nav-card">
      <view class="nav-list">
        <text class="nav-item" @click="goToHome">首页</text>
        <text class="nav-item" @click="goToServices">服务</text>
        <text class="nav-item active">案例</text>
        <text class="nav-item" @click="goToPricing">价格</text>
        <text class="nav-item" @click="goToEnterprise">企业合作</text>
        <text class="nav-item" @click="goToDemand">提交需求</text>
      </view>
    </view>

    <view class="hero-card">
      <text class="hero-title">案例展示</text>
      <text class="hero-desc">
        查看 AI 工具和人工服务如何帮助品牌完成模特图升级、颜色延展、场景升级、款式精修、电商视觉和项目交付。
      </text>
    </view>

    <view class="case-list">
      <view v-for="item in caseList" :key="item.caseId" class="case-card">
        <text class="case-title">{{ item.title }}</text>
        <text class="case-type">类型：{{ item.type }}</text>
        <text class="case-line">前后变化：{{ item.compare }}</text>
        <text class="case-line">场景：{{ item.scene }}</text>
        <text class="case-line">亮点：{{ item.highlight }}</text>
        <view class="case-actions">
          <button class="case-btn ghost-btn" @click="goToCaseDetail(item.caseId)">查看详情</button>
          <button class="case-btn" @click="goToDemand">提交需求</button>
        </view>
      </view>
    </view>

    <view class="value-card">
      <text class="value-title">结果价值</text>
      <view class="value-list">
        <view v-for="item in resultValueList" :key="item.title" class="value-item">
          <text class="value-item-title">{{ item.title }}</text>
          <text class="value-item-desc">{{ item.desc }}</text>
        </view>
      </view>
    </view>

    <view class="value-card">
      <text class="value-title">适用行业与场景</text>
      <view class="scene-tag-list">
        <text v-for="item in sceneTags" :key="item" class="scene-tag">{{ item }}</text>
      </view>
    </view>
  </view>
</template>

<script>
const CASES = [
  {
    caseId: 'model-replacement-core-sku',
    title: '核心单品换模特',
    type: '换模特',
    compare: '从平铺商品图升级为模特展示电商图',
    scene: '单品快速翻新',
    highlight: '无需重新拍摄，也能更快升级商品主图',
    target: 'Brands and ecommerce teams needing quick conversion-oriented refresh for core products',
    problem: 'Existing product visuals lacked model context and reduced listing competitiveness during campaign windows.',
    solution: 'Used AI model replacement for fast direction generation and manual design review for style consistency and final usability.',
    resultHighlights: [
      'Main visual quality improved for listing-first display',
      'Reduced need for urgent reshoot before campaign launch',
      'Output kept brand style direction aligned'
    ],
    services: ['Single Item Visual Upgrade', 'Ecommerce Visual Generation & Upgrade']
  },
  {
    caseId: 'season-color-extension',
    title: '季节款颜色延展',
    type: '换颜色',
    compare: '从单一颜色扩展为多套营销可用配色',
    scene: '新季色系扩展',
    highlight: '降低修图成本，同时保持视觉一致',
    target: 'Product teams expanding seasonal color stories with limited visual production time',
    problem: 'Color variants were slow to produce, causing delays in listing preparation and marketing synchronization.',
    solution: 'Generated color extension directions with AI and applied manual quality checks to maintain realistic material and tone control.',
    resultHighlights: [
      'Color variants delivered faster for launch schedule',
      'Visual consistency improved across SKU color families',
      'Lower repeated retouch communication cost'
    ],
    services: ['Series Extension Design', 'Ecommerce Visual Generation & Upgrade']
  },
  {
    caseId: 'scene-upgrade-main-visual',
    title: '主视觉场景升级',
    type: '换场景',
    compare: '从普通影棚背景升级到生活方式场景',
    scene: '首页和商品列表视觉翻新',
    highlight: '增强画面故事感和转化氛围',
    target: 'Teams wanting stronger storytelling and conversion atmosphere for ecommerce channels',
    problem: 'Original studio visuals lacked scene context and failed to support brand narrative across channels.',
    solution: 'Built scene upgrade outputs via AI and refined final compositions manually for commerce-ready readability.',
    resultHighlights: [
      'Lifestyle scene quality improved perception of product value',
      'Main visual storytelling became clearer for campaigns',
      'Scene outputs aligned better with target user expectations'
    ],
    services: ['Scene Upgrade Service', 'Single Item Visual Upgrade']
  },
  {
    caseId: 'micro-redesign-before-sample',
    title: '打样前微改款',
    type: '微改款',
    compare: '从原款快速探索局部调整方向',
    scene: '打样前设计方向验证',
    highlight: '更早筛选可执行的款式方向',
    target: 'Design and product teams that need quick direction validation before sample investment',
    problem: 'Too many potential detail directions made early decision-making slow and sample costs uncertain.',
    solution: 'Used AI for quick micro redesign ideation and manual selection logic to prioritize feasible directions.',
    resultHighlights: [
      'Direction choices narrowed before physical sampling',
      'Design review cycles shortened in early stage',
      'Decision confidence improved for next execution phase'
    ],
    services: ['Micro Redesign Service', 'Series Extension Design']
  },
  {
    caseId: 'ecommerce-upgrade-pack',
    title: '电商视觉升级包',
    type: '电商视觉升级',
    compare: '从零散图片升级为统一商品图体系',
    scene: '平台商品视觉优化',
    highlight: '主图、详情图和场景图一起升级',
    target: 'Ecommerce operation teams needing scalable and consistent listing image systems',
    problem: 'Main visuals, detail pages, and scene assets were disconnected, impacting overall conversion coherence.',
    solution: 'Applied AI + manual collaboration to build unified main/detail/scene assets with consistent output standards.',
    resultHighlights: [
      'Listing visual system became more standardized',
      'Cross-page quality consistency increased',
      'Production rhythm supported ongoing SKU updates'
    ],
    services: ['Ecommerce Visual Generation & Upgrade', 'Batch Visual Support']
  },
  {
    caseId: 'enterprise-collaboration-program',
    title: '企业项目协作',
    type: '企业项目',
    compare: '从零散需求升级为项目制交付',
    scene: '品牌长期合作',
    highlight: '多任务稳定交付，并配合人工跟进',
    target: 'Enterprise clients requiring long-term, project-based visual delivery collaboration',
    problem: 'Single-task requests lacked coordination visibility and could not support recurring launch rhythms.',
    solution: 'Built a project-task-batch execution loop with AI acceleration and manual service follow-up for stable delivery.',
    resultHighlights: [
      'Project-level visibility improved across multi-task execution',
      'Delivery cadence became more predictable',
      'Long-term cooperation quality and efficiency stayed stable'
    ],
    services: ['Enterprise Project Service', 'Project-Based Long-Term Cooperation']
  }
]

const RESULT_VALUE_LIST = [
  {
    title: '更快完成上新素材',
    desc: '案例结果体现了更快的视觉生产节奏，适合商品上新和列表图更新。'
  },
  {
    title: '多任务质量更稳定',
    desc: '统一任务流程可以帮助多 SKU 保持图片质量和风格节奏。'
  },
  {
    title: '从单次出图延展到项目合作',
    desc: '一次需求可以继续扩展为可跟踪、可交付的长期合作。'
  }
]

const SCENE_TAGS = [
  '服装品牌',
  '电商运营',
  '季节上新',
  'SKU 延展',
  '视觉翻新活动',
  '长期项目合作'
]

export default {
  data() {
    return {
      caseList: CASES,
      resultValueList: RESULT_VALUE_LIST,
      sceneTags: SCENE_TAGS
    }
  },
  methods: {
    goToHome() {
      uni.switchTab({
        url: '/pages/index/index'
      })
    },
    goToServices() {
      uni.navigateTo({
        url: '/pages/services/services'
      })
    },
    goToPricing() {
      uni.navigateTo({
        url: '/pages/pricing/pricing'
      })
    },
    goToEnterprise() {
      uni.navigateTo({
        url: '/pages/enterprise/enterprise'
      })
    },
    goToDemand() {
      uni.navigateTo({
        url: '/pages/enterprise-request/enterprise-request?sourceType=case_list'
      })
    },
    goToCaseDetail(caseId) {
      if (!caseId) return
      uni.navigateTo({
        url: `/pages/case-detail/case-detail?caseId=${encodeURIComponent(caseId)}`
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
.case-card {
  background: #fff;
  border-radius: 24rpx;
  padding: 28rpx;
  box-shadow: 0 6rpx 20rpx rgba(0, 0, 0, 0.05);
}

.nav-card,
.hero-card {
  margin-bottom: 24rpx;
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

.nav-item.active {
  background: #1677ff;
  color: #fff;
}

.hero-title {
  display: block;
  font-size: 40rpx;
  font-weight: 700;
  color: #222;
}

.hero-desc {
  display: block;
  margin-top: 14rpx;
  font-size: 26rpx;
  line-height: 1.7;
  color: #666;
}

.case-list {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}

.case-title {
  display: block;
  font-size: 30rpx;
  font-weight: 700;
  color: #1677ff;
}

.case-type,
.case-line {
  display: block;
  margin-top: 12rpx;
  font-size: 24rpx;
  line-height: 1.6;
  color: #444;
}

.case-btn {
  margin-top: 20rpx;
  background: #1677ff;
  color: #fff;
  border-radius: 999rpx;
}

.case-actions {
  display: flex;
  gap: 14rpx;
}

.ghost-btn {
  background: #eef5ff;
  color: #1677ff;
}

.value-card {
  margin-top: 20rpx;
  background: #fff;
  border-radius: 24rpx;
  padding: 28rpx;
  box-shadow: 0 6rpx 20rpx rgba(0, 0, 0, 0.05);
}

.value-title {
  display: block;
  font-size: 30rpx;
  font-weight: 700;
  color: #222;
  margin-bottom: 14rpx;
}

.value-list {
  display: flex;
  flex-direction: column;
  gap: 14rpx;
}

.value-item {
  background: #f8fafc;
  border-radius: 18rpx;
  padding: 20rpx;
}

.value-item-title {
  display: block;
  font-size: 26rpx;
  font-weight: 600;
  color: #222;
}

.value-item-desc {
  display: block;
  margin-top: 8rpx;
  font-size: 24rpx;
  line-height: 1.6;
  color: #666;
}

.scene-tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
}

.scene-tag {
  padding: 10rpx 18rpx;
  border-radius: 999rpx;
  background: #eef5ff;
  color: #1677ff;
  font-size: 22rpx;
}
</style>
