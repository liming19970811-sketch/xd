<template>
  <view class="container">
    <view class="nav-card">
      <view class="nav-list">
        <text class="nav-item" @click="goToHome">Home</text>
        <text class="nav-item" @click="goToServices">Services</text>
        <text class="nav-item" @click="goToCases">Cases</text>
        <text class="nav-item active">Enterprise</text>
        <text class="nav-item" @click="goToDemand">Submit Demand</text>
      </view>
    </view>

    <view class="hero-card">
      <text class="hero-title">Enterprise Cooperation</text>
      <text class="hero-desc">
        We support brands and teams that need repeatable visual delivery, project collaboration, and long-term service
        rhythm beyond one-off image generation.
      </text>
      <button class="primary-btn" @click="goToProDesign">查看专业版合作方案</button>
    </view>

    <view class="section-card">
      <text class="section-title">Who It Fits</text>
      <view class="tag-list">
        <text v-for="item in targetCustomers" :key="item" class="tag-item">{{ item }}</text>
      </view>
    </view>

    <view class="section-card">
      <text class="section-title">Service Scope</text>
      <view class="content-list">
        <view v-for="item in serviceScopeList" :key="item.title" class="content-item">
          <text class="item-title">{{ item.title }}</text>
          <text class="item-desc">{{ item.desc }}</text>
        </view>
      </view>
    </view>

    <view class="section-card">
      <text class="section-title">Cooperation Mode</text>
      <view class="content-list">
        <view v-for="item in cooperationModes" :key="item.title" class="content-item">
          <text class="item-title">{{ item.title }}</text>
          <text class="item-desc">{{ item.desc }}</text>
        </view>
      </view>
    </view>

    <view class="section-card">
      <text class="section-title">Delivery Method</text>
      <text class="section-desc">
        Delivery can include AI-generated visual assets, manual design follow-up, project-based communication, and phased
        output aligned with your launch schedule.
      </text>
    </view>

    <view class="section-card">
      <text class="section-title">Why Choose Us</text>
      <view class="content-list">
        <view v-for="item in trustReasons" :key="item.title" class="content-item">
          <text class="item-title">{{ item.title }}</text>
          <text class="item-desc">{{ item.desc }}</text>
        </view>
      </view>
    </view>

    <view class="section-card">
      <text class="section-title">Cooperation Assurance</text>
      <view class="content-list">
        <view v-for="item in assuranceItems" :key="item.title" class="content-item">
          <text class="item-title">{{ item.title }}</text>
          <text class="item-desc">{{ item.desc }}</text>
        </view>
      </view>
    </view>

    <view class="section-card">
      <text class="section-title">Why Long-Term Cooperation Works</text>
      <text class="section-desc">
        A shared project rhythm helps keep visual standards stable, shorten turnaround time, and reduce repeated briefing
        cost across many SKUs and campaigns.
      </text>
      <button class="primary-btn" @click="goToDemand">Submit Demand</button>
    </view>

    <view class="section-card">
      <text class="section-title">Business FAQ</text>
      <view class="faq-list">
        <view v-for="item in faqList" :key="item.q" class="faq-item">
          <text class="faq-q">{{ item.q }}</text>
          <text class="faq-a">{{ item.a }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script>
const TARGET_CUSTOMERS = [
  'Apparel brands with continuous listing demand',
  'Ecommerce teams managing many SKUs',
  'Design teams needing extension support',
  'Brands running seasonal launch projects',
  'Companies exploring long-term visual outsourcing'
]

const SERVICE_SCOPE_LIST = [
  {
    title: 'Single Item Visual Upgrade',
    desc: 'Quickly improve one SKU when you need model, color, or scene refresh.'
  },
  {
    title: 'New Collection / Extension Design',
    desc: 'Support new launches and derivative style exploration before deeper production.'
  },
  {
    title: 'Ecommerce Visual Generation & Upgrade',
    desc: 'Build listing-ready image systems across many products and channels.'
  },
  {
    title: 'Long-Term Project Cooperation',
    desc: 'Operate through project rhythm when you need continuous support instead of isolated requests.'
  }
]

const COOPERATION_MODES = [
  {
    title: 'Single Project Cooperation',
    desc: 'Suitable for one campaign, one launch window, or one defined delivery scope.'
  },
  {
    title: 'Periodic Cooperation',
    desc: 'Suitable for recurring needs such as weekly or monthly content and image refresh.'
  },
  {
    title: 'Long-Term Cooperation',
    desc: 'Suitable for brands that need an ongoing service relationship and project-based follow-up.'
  }
]

const FAQ_LIST = [
  {
    q: 'Who is this suitable for?',
    a: 'It is suitable for apparel brands, ecommerce operators, and teams that need recurring visual output or project-based support.'
  },
  {
    q: 'How does cooperation usually work?',
    a: 'You submit a demand first, we clarify the scope, then move into single-project, periodic, or long-term cooperation based on the need.'
  },
  {
    q: 'What services can be covered?',
    a: 'The service can cover single item visual upgrade, new collection and extension support, ecommerce visual generation, and long-term project cooperation.'
  },
  {
    q: 'What is the usual delivery cycle?',
    a: 'The delivery cycle depends on scope and urgency, but the first round is typically clarified after reviewing your submitted demand.'
  },
  {
    q: 'How do I submit a demand?',
    a: 'You can go to the submit demand page, leave your company, contact, product, and service scope, and the team will follow up manually.'
  },
  {
    q: 'Do you support long-term cooperation?',
    a: 'Yes. Long-term cooperation is supported when brands need a stable delivery rhythm across multiple tasks, launches, or projects.'
  }
]

const TRUST_REASONS = [
  {
    title: 'Platform + Service Dual Model',
    desc: 'Teams can start with AI task production and move to manual project service when business complexity increases.'
  },
  {
    title: 'Faster Than Traditional Visual Loops',
    desc: 'Structured task and batch flow helps reduce repeated communication and execution delay.'
  },
  {
    title: 'Closed-Loop Project Execution',
    desc: 'Demand intake, project conversion, task execution, and result tracking are linked in one operation path.'
  }
]

const ASSURANCE_ITEMS = [
  {
    title: 'Clear Cooperation Scope',
    desc: 'Service boundaries, expected output, and collaboration rhythm are aligned before execution.'
  },
  {
    title: 'Deliverable-Oriented Process',
    desc: 'Output focuses on usable visual results for ecommerce and campaign launch, not only process activity.'
  },
  {
    title: 'Long-Term Value Continuity',
    desc: 'Support repeated launches and seasonal changes with consistent style and faster turnaround.'
  }
]

export default {
  data() {
    return {
      targetCustomers: TARGET_CUSTOMERS,
      serviceScopeList: SERVICE_SCOPE_LIST,
      cooperationModes: COOPERATION_MODES,
      trustReasons: TRUST_REASONS,
      assuranceItems: ASSURANCE_ITEMS,
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
        url: '/pages/enterprise-request/enterprise-request?sourceType=enterprise&interestType=enterprise_cooperation'
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
.section-card {
  background: #fff;
  border-radius: 24rpx;
  padding: 28rpx;
  box-shadow: 0 6rpx 20rpx rgba(0, 0, 0, 0.05);
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

.hero-desc,
.section-desc {
  display: block;
  margin-top: 14rpx;
  font-size: 26rpx;
  line-height: 1.7;
  color: #666;
}

.section-title {
  display: block;
  font-size: 30rpx;
  font-weight: 700;
  color: #222;
  margin-bottom: 18rpx;
}

.tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 14rpx;
}

.tag-item {
  padding: 12rpx 20rpx;
  border-radius: 999rpx;
  background: #f3f8ff;
  color: #1677ff;
  font-size: 24rpx;
}

.content-list,
.faq-list {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.content-item,
.faq-item {
  background: #f8fafc;
  border-radius: 20rpx;
  padding: 22rpx;
}

.item-title,
.faq-q {
  display: block;
  font-size: 28rpx;
  font-weight: 600;
  color: #222;
}

.item-desc,
.faq-a {
  display: block;
  margin-top: 10rpx;
  font-size: 24rpx;
  line-height: 1.7;
  color: #666;
}

.primary-btn {
  margin-top: 24rpx;
  background: #1677ff;
  color: #fff;
  border-radius: 999rpx;
}
</style>
