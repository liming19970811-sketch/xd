<template>
  <view class="container">
    <view class="nav-card">
      <view class="nav-list">
        <text class="nav-item" @click="goToHome">首页</text>
        <text class="nav-item active">服务</text>
        <text class="nav-item" @click="goToCases">案例</text>
        <text class="nav-item" @click="goToPricing">价格</text>
        <text class="nav-item" @click="goToEnterprise">企业合作</text>
        <text class="nav-item" @click="goToDemand">提交需求</text>
      </view>
    </view>

    <view class="hero-card">
      <text class="hero-title">设计服务概览</text>
      <text class="hero-desc">
        我们将 AI 出图和人工设计服务结合，帮助服装商家完成商品图升级、新款视觉规划、电商素材生产和长期项目交付。
      </text>
      <button class="service-btn hero-btn" @click="goToProDesign">查看专业版方案（更适合成交）</button>
    </view>

    <view class="service-list">
      <view v-for="item in serviceModules" :key="item.title" class="service-card">
        <text class="service-title">{{ item.title }}</text>
        <text class="service-line">适合：{{ item.forWho }}</text>
        <text class="service-line">解决：{{ item.solve }}</text>
        <text class="service-line">交付：{{ item.deliver }}</text>
        <button class="service-btn" @click="goToDemand">提交需求</button>
      </view>
    </view>
  </view>
</template>

<script>
const SERVICE_MODULES = [
  {
    title: '单品视觉升级',
    forWho: '需要快速优化单个 SKU 的品牌和商家',
    solve: '图片更新慢、视觉质感弱、缺少模特或场景版本',
    deliver: '优化后的模特图、主图方向和快速迭代素材'
  },
  {
    title: '新款与延展设计',
    forWho: '准备上新或延展爆款的设计和商品团队',
    solve: '打样前需要快速验证多个概念方向',
    deliver: '款式方向、延展概念和基于图片的设计建议'
  },
  {
    title: '电商视觉出图',
    forWho: '需要规模化生产商品图的电商运营团队',
    solve: '图片制作成本高、商品素材交付慢',
    deliver: '主图、详情图、场景图和视觉翻新素材包'
  },
  {
    title: '企业项目服务',
    forWho: '需要长期协作和项目制交付的品牌团队',
    solve: '多任务、多团队协同时缺少稳定推进节奏',
    deliver: '专属交付支持、项目协同和持续服务规划'
  }
]

export default {
  data() {
    return {
      serviceModules: SERVICE_MODULES
    }
  },
  methods: {
    goToHome() {
      uni.switchTab({
        url: '/pages/index/index'
      })
    },
    goToCases() {
      uni.navigateTo({
        url: '/pages/cases/cases'
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
        url: '/pages/enterprise-request/enterprise-request?sourceType=services'
      })
    },
    goToProDesign() {
      uni.navigateTo({
        url: '/pages/pro-design/pro-design'
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
.service-card {
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

.service-list {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}

.service-title {
  display: block;
  font-size: 30rpx;
  font-weight: 700;
  color: #1677ff;
}

.service-line {
  display: block;
  margin-top: 12rpx;
  font-size: 24rpx;
  line-height: 1.6;
  color: #444;
}

.service-btn {
  margin-top: 20rpx;
  background: #1677ff;
  color: #fff;
  border-radius: 999rpx;
}

.hero-btn {
  margin-top: 18rpx;
}
</style>
