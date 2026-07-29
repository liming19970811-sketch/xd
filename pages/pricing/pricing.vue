<template>
  <view class="container">
    <view class="nav-card">
      <view class="nav-list">
        <text class="nav-item" @click="goToHome">首页</text>
        <text class="nav-item" @click="goToServices">服务</text>
        <text class="nav-item" @click="goToCases">案例</text>
        <text class="nav-item active">价格</text>
        <text class="nav-item" @click="goToDemand">提交需求</text>
      </view>
    </view>

    <view class="hero-card">
      <text class="hero-title">价格与合作方式</text>
      <text class="hero-desc">
        根据出图节奏、交付复杂度和合作周期，选择 AI 快速出图、一对一设计支持或企业项目合作。
      </text>
    </view>

    <view class="pricing-list">
      <view v-for="item in pricingPlans" :key="item.planId" class="pricing-card">
        <text class="pricing-tag">{{ item.tag }}</text>
        <text class="pricing-title">{{ item.title }}</text>
        <text class="pricing-price">{{ item.price }}</text>
        <text class="pricing-desc">{{ item.desc }}</text>
        <view class="benefit-list">
          <text v-for="benefit in item.benefits" :key="`${item.planId}-${benefit}`" class="benefit-line">
            {{ benefit }}
          </text>
        </view>
        <button class="pricing-btn" @click="goToDemandWithPlan(item)">提交需求</button>
      </view>
    </view>

    <view class="faq-card">
      <text class="faq-title">如何开始</text>
      <view v-for="item in faqList" :key="item.title" class="faq-item">
        <text class="faq-item-title">{{ item.title }}</text>
        <text class="faq-item-desc">{{ item.desc }}</text>
      </view>
    </view>
  </view>
</template>

<script>
const PRICING_PLANS = [
  {
    planId: 'pricing-fast-ai',
    tag: 'AI 快速出图',
    title: '单品快速升级',
    price: '299 元起',
    desc: '适合需要快速优化主图或商品图的商家。',
    demandType: 'ai_listing',
    benefits: [
      '快速确认视觉升级方向',
      '支持模特、场景、风格调整',
      '适合活动前短周期补图'
    ]
  },
  {
    planId: 'pricing-design-service',
    tag: '人工设计服务',
    title: '一对一设计支持',
    price: '1,999 元起',
    desc: '适合需要 AI 出图后继续人工跟进和迭代的品牌。',
    demandType: 'design_service',
    benefits: [
      '提交需求后人工跟进',
      '适合新款规划和款式延展',
      '支持视觉交付和服务协同'
    ]
  },
  {
    planId: 'pricing-enterprise',
    tag: '企业合作',
    title: '项目制合作',
    price: '按需报价',
    desc: '适合需要批量交付、稳定执行节奏和项目可视化的团队。',
    demandType: 'enterprise_cooperation',
    benefits: [
      '项目制交付结构',
      '支持长期合作规划',
      '适合高客单协作和团队流程'
    ]
  }
]

const FAQ_LIST = [
  {
    title: '需要准备哪些信息？',
    desc: '建议提供产品品类、目标效果、参考风格、交付时间，以及是否需要人工跟进。'
  },
  {
    title: '可以先从单次需求开始吗？',
    desc: '可以。单次需求跑通后，可根据交付节奏和服务范围继续升级为项目合作。'
  },
  {
    title: '价格是固定的吗？',
    desc: '页面价格为起步参考，最终报价会根据数量、服务深度和交付周期确认。'
  }
]

export default {
  data() {
    return {
      pricingPlans: PRICING_PLANS,
      faqList: FAQ_LIST
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
    goToCases() {
      uni.navigateTo({
        url: '/pages/cases/cases'
      })
    },
    goToDemand() {
      uni.navigateTo({
        url: '/pages/enterprise-request/enterprise-request?sourceType=pricing'
      })
    },
    goToDemandWithPlan(item) {
      const query = [
        'sourceType=pricing_plan',
        `sourceId=${encodeURIComponent(item.planId || item.title || '')}`,
        `interestType=${encodeURIComponent(item.demandType || 'enterprise_request')}`
      ]
      uni.navigateTo({
        url: `/pages/enterprise-request/enterprise-request?${query.join('&')}`
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
.pricing-card,
.faq-card {
  background: #fff;
  border-radius: 24rpx;
  padding: 28rpx;
  box-shadow: 0 6rpx 20rpx rgba(0, 0, 0, 0.05);
}

.nav-card,
.hero-card,
.faq-card {
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

.pricing-list {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}

.pricing-tag {
  display: inline-block;
  padding: 8rpx 16rpx;
  border-radius: 999rpx;
  background: #eef5ff;
  color: #1677ff;
  font-size: 22rpx;
}

.pricing-title {
  display: block;
  margin-top: 14rpx;
  font-size: 32rpx;
  font-weight: 700;
  color: #222;
}

.pricing-price {
  display: block;
  margin-top: 10rpx;
  font-size: 28rpx;
  color: #cf1322;
  font-weight: 600;
}

.pricing-desc {
  display: block;
  margin-top: 10rpx;
  font-size: 24rpx;
  line-height: 1.6;
  color: #666;
}

.benefit-list {
  margin-top: 16rpx;
}

.benefit-line {
  display: block;
  margin-top: 10rpx;
  font-size: 24rpx;
  line-height: 1.6;
  color: #333;
}

.pricing-btn {
  margin-top: 20rpx;
  background: #1677ff;
  color: #fff;
  border-radius: 999rpx;
}

.faq-title {
  display: block;
  font-size: 30rpx;
  font-weight: 700;
  color: #222;
}

.faq-item {
  margin-top: 18rpx;
  padding: 20rpx;
  border-radius: 18rpx;
  background: #f8fafc;
}

.faq-item-title {
  display: block;
  font-size: 26rpx;
  font-weight: 600;
  color: #222;
}

.faq-item-desc {
  display: block;
  margin-top: 8rpx;
  font-size: 24rpx;
  line-height: 1.6;
  color: #666;
}
</style>
