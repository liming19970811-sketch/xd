<template>
  <view class="container">
    <view class="nav-card">
      <view class="nav-list">
        <text class="nav-item" @click="goToHome">首页</text>
        <text class="nav-item" @click="goToServices">服务页</text>
        <text class="nav-item" @click="goToCases">案例页</text>
        <text class="nav-item" @click="goToEnterprise">企业合作</text>
        <text class="nav-item active">专业版</text>
      </view>
    </view>

    <view class="hero-card">
      <text class="eyebrow">PRO DESIGN SERVICE</text>
      <text class="hero-title">AI + 人工协同专业设计服务</text>
      <text class="hero-desc">
        面向品牌方、电商团队与企业客户。我们不是“只做生成”，而是用 AI 提速、人工保质量，
        承接单款、系列、批量与项目制需求，确保从需求到交付持续可控。
      </text>
      <text class="hero-highlight">
        更高质量结果 · 更稳定交付节奏 · 更适合长期合作
      </text>
      <view class="hero-actions">
        <button class="primary-btn" @click="goToDemand">立即提交专业版需求</button>
        <button class="secondary-btn" @click="goToUpload">先试用普通体验版工具</button>
      </view>
    </view>

    <view class="section-card">
      <text class="section-title">专业版 vs 普通体验版</text>
      <view class="module-list">
        <view v-for="item in compareList" :key="item.title" class="module-item">
          <text class="module-title">{{ item.title }}</text>
          <text class="module-desc">{{ item.desc }}</text>
        </view>
      </view>
    </view>

    <view class="section-card">
      <text class="section-title">适合谁</text>
      <view class="tag-list">
        <text v-for="item in forWhoList" :key="item" class="tag-item">{{ item }}</text>
      </view>
    </view>

    <view class="section-card">
      <text class="section-title">专业版能做什么</text>
      <view class="module-list">
        <view v-for="item in moduleList" :key="item.title" class="module-item">
          <text class="module-title">{{ item.title }}</text>
          <text class="module-desc">{{ item.desc }}</text>
        </view>
      </view>
    </view>

    <view class="section-card">
      <text class="section-title">为什么选择专业版</text>
      <view class="module-list">
        <view v-for="item in whyList" :key="item.title" class="module-item">
          <text class="module-title">{{ item.title }}</text>
          <text class="module-desc">{{ item.desc }}</text>
        </view>
      </view>
    </view>

    <view class="section-card">
      <text class="section-title">服务流程</text>
      <view class="flow-list">
        <view v-for="item in flowList" :key="item.step" class="flow-item">
          <text class="flow-step">{{ item.step }}</text>
          <text class="flow-title">{{ item.title }}</text>
          <text class="flow-desc">{{ item.desc }}</text>
        </view>
      </view>
    </view>

    <view class="section-card">
      <text class="section-title">交付内容</text>
      <view class="tag-list">
        <text v-for="item in deliverList" :key="item" class="tag-item">{{ item }}</text>
      </view>
    </view>

    <view class="section-card">
      <text class="section-title">合作方式</text>
      <view class="module-list">
        <view v-for="item in cooperationList" :key="item.title" class="module-item">
          <text class="module-title">{{ item.title }}</text>
          <text class="module-desc">{{ item.desc }}</text>
        </view>
      </view>
    </view>

    <view class="section-card">
      <text class="section-title">结果价值</text>
      <view class="module-list">
        <view v-for="item in valueList" :key="item.title" class="module-item">
          <text class="module-title">{{ item.title }}</text>
          <text class="module-desc">{{ item.desc }}</text>
        </view>
      </view>
    </view>

    <view class="section-card">
      <text class="section-title">案例切片</text>
      <view class="module-list">
        <view v-for="item in caseSliceList" :key="item.title" class="module-item">
          <text class="module-title">{{ item.title }}</text>
          <text class="module-desc">{{ item.desc }}</text>
        </view>
      </view>
    </view>

    <view class="section-card">
      <text class="section-title">FAQ</text>
      <view class="faq-list">
        <view v-for="item in faqList" :key="item.q" class="faq-item">
          <text class="faq-q">{{ item.q }}</text>
          <text class="faq-a">{{ item.a }}</text>
        </view>
      </view>
    </view>

    <view class="cta-card">
      <text class="cta-title">准备把体验版升级为可持续交付的专业合作？</text>
      <text class="cta-desc">提交需求后，我们会快速完成范围澄清并进入专业版承接流程，按项目节奏稳定交付。</text>
      <button class="primary-btn" @click="goToDemand">提交需求，进入专业版承接</button>
    </view>
  </view>
</template>

<script>
const FOR_WHO_LIST = [
  '品牌方与商品企划团队',
  '电商运营团队与视觉团队',
  '有系列上新和多 SKU 交付需求的企业客户',
  '需要长期合作与项目制管理的团队'
]

const COMPARE_LIST = [
  {
    title: '普通体验版：适合快速试用',
    desc: '适合个人或小范围快速验证，重点是低门槛体验和单次生成效率。'
  },
  {
    title: '专业版：适合稳定交付',
    desc: '适合品牌方与企业团队，支持需求承接、任务编排、批次执行和结果复盘。'
  },
  {
    title: '核心差异：AI 提效 + 人工保质',
    desc: '专业版强调可交付结果与长期合作节奏，不仅是“能生成”，更是“交得稳”。'
  }
]

const MODULE_LIST = [
  {
    title: '单款 / 系列 / 批量协同',
    desc: '支持单款快速优化、系列上新延展、批量视觉升级，覆盖不同业务节奏。'
  },
  {
    title: 'AI + 人工协同生产',
    desc: 'AI 负责效率与规模，人工负责质量把控与策略判断，保证可交付结果。'
  },
  {
    title: '项目制承接与闭环执行',
    desc: '从需求承接、任务编排、批次执行到结果回收，全链路可追踪。'
  }
]

const WHY_LIST = [
  {
    title: '比传统流程更快',
    desc: '通过标准化任务与批次流程，减少重复沟通、返工和执行等待。'
  },
  {
    title: '服装场景专属能力',
    desc: '聚焦换模特、换色、换场景、微改款、电商视觉升级等高频场景。'
  },
  {
    title: '更适合长期合作',
    desc: '支持周期合作与长期合作节奏，保障多轮上新中的风格一致和效率稳定。'
  }
]

const FLOW_LIST = [
  { step: '01', title: '需求澄清', desc: '明确品牌目标、服务范围、时间节奏与交付标准。' },
  { step: '02', title: '方案规划', desc: '制定单款、系列或批量执行策略与资源安排。' },
  { step: '03', title: '任务执行', desc: '基于 AI + 人工协同完成任务与批次交付。' },
  { step: '04', title: '复盘迭代', desc: '交付结果并沉淀标准，进入下一轮优化与合作。' }
]

const DELIVER_LIST = [
  '主图、细节图与组合视觉资产',
  '场景与色彩延展结果包',
  '任务级状态与结果跟踪',
  '项目级长期协作衔接能力',
  '面向上线与投放的可用结果'
]

const COOPERATION_LIST = [
  {
    title: '单次项目合作',
    desc: '适合短周期明确目标，快速完成阶段性交付。'
  },
  {
    title: '周期合作',
    desc: '按周或按月稳定支持系列更新与持续上新。'
  },
  {
    title: '长期项目制合作',
    desc: '围绕品牌业务节奏建立持续协作机制，保障质量与效率双稳定。'
  }
]

const VALUE_LIST = [
  {
    title: '交付速度与质量兼顾',
    desc: '在业务节奏不降速的前提下，保持输出质量可控且稳定。'
  },
  {
    title: '降低重复沟通成本',
    desc: '需求结构化与执行流程化，减少跨团队反复对齐成本。'
  },
  {
    title: '从需求到交付全程可见',
    desc: '承接、执行、回收、复盘都有状态沉淀，更适合长期经营。'
  }
]

const CASE_SLICE_LIST = [
  {
    title: '系列上新冲刺',
    desc: '在上新窗口期内完成系列级视觉输出，缩短从需求到上线的周期。'
  },
  {
    title: '电商视觉升级',
    desc: '多商品主图与详情图标准化升级，提高整体页面质感和转化基础。'
  },
  {
    title: '企业长期合作',
    desc: '围绕项目节奏持续交付，在多轮任务中保持质量稳定和进度透明。'
  }
]

const FAQ_LIST = [
  { q: '什么情况下建议使用专业版？', a: '当你需要更高质量把控、批量交付能力或长期合作时，建议优先使用专业版。' },
  { q: '可以先从单款开始吗？', a: '可以。支持从单款验证起步，再平滑扩展到系列和批量执行。' },
  { q: '只有大型企业才能使用吗？', a: '不是。只要有明确交付目标的品牌方和电商团队都可以使用。' },
  { q: '如何开始合作？', a: '先提交需求，我们会完成范围澄清后进入专业版承接流程。' }
]

export default {
  data() {
    return {
      forWhoList: FOR_WHO_LIST,
      compareList: COMPARE_LIST,
      moduleList: MODULE_LIST,
      whyList: WHY_LIST,
      flowList: FLOW_LIST,
      deliverList: DELIVER_LIST,
      cooperationList: COOPERATION_LIST,
      valueList: VALUE_LIST,
      caseSliceList: CASE_SLICE_LIST,
      faqList: FAQ_LIST
    }
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
    goToUpload() {
      uni.navigateTo({ url: '/package-ai/upload/upload' })
    },
    goToDemand() {
      uni.navigateTo({
        url: '/pages/enterprise-request/enterprise-request?sourceType=pro_design&interestType=brand_visual'
      })
    }
  }
}
</script>

<style scoped>
.container {
  min-height: 100vh;
  background: linear-gradient(180deg, #eef6ff 0%, #f8fbff 100%);
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

.nav-item.active {
  background: #1677ff;
  color: #fff;
}

.eyebrow {
  display: block;
  font-size: 22rpx;
  letter-spacing: 2rpx;
  color: #1677ff;
  text-transform: uppercase;
}

.hero-title {
  display: block;
  margin-top: 14rpx;
  font-size: 42rpx;
  font-weight: 700;
  line-height: 1.3;
  color: #222;
}

.hero-desc,
.cta-desc {
  display: block;
  margin-top: 14rpx;
  font-size: 26rpx;
  line-height: 1.7;
  color: #666;
}

.hero-highlight {
  display: block;
  margin-top: 16rpx;
  font-size: 24rpx;
  color: #1677ff;
  font-weight: 600;
}

.hero-actions {
  display: flex;
  gap: 14rpx;
  margin-top: 22rpx;
}

.primary-btn,
.secondary-btn {
  flex: 1;
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

.section-title,
.cta-title {
  display: block;
  font-size: 30rpx;
  font-weight: 700;
  color: #222;
  margin-bottom: 14rpx;
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

.module-list,
.faq-list,
.flow-list {
  display: flex;
  flex-direction: column;
  gap: 14rpx;
}

.module-item,
.faq-item,
.flow-item {
  background: #f8fafc;
  border-radius: 18rpx;
  padding: 20rpx;
}

.module-title,
.faq-q,
.flow-title {
  display: block;
  font-size: 26rpx;
  font-weight: 600;
  color: #222;
}

.module-desc,
.faq-a,
.flow-desc {
  display: block;
  margin-top: 8rpx;
  font-size: 24rpx;
  line-height: 1.65;
  color: #666;
}

.flow-step {
  display: inline-block;
  padding: 6rpx 14rpx;
  border-radius: 999rpx;
  background: #e6f4ff;
  color: #1677ff;
  font-size: 20rpx;
  font-weight: 600;
  margin-bottom: 8rpx;
}
</style>
