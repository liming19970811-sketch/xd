<template>
  <view class="enterprise-page">
    <view class="hero-section">
      <view class="hero-copy">
        <text class="brand-line">蝶变 Diebian · 企业解决方案</text>
        <text class="hero-title">AI 服装视觉生产解决方案</text>
        <text class="hero-desc">帮助品牌、电商、工厂、设计团队降低拍摄和内容生产成本。</text>
        <button class="hero-btn" @click="goDemand">获取企业方案</button>
      </view>
      <view class="hero-panel">
        <view class="panel-top">
          <text>Visual Production</text>
          <text>Enterprise</text>
        </view>
        <view class="panel-stage">
          <view class="stage-card before">
            <text>样衣 / 设计稿</text>
          </view>
          <text class="stage-arrow">→</text>
          <view class="stage-card after">
            <text>AI 商品视觉</text>
          </view>
        </view>
        <view class="panel-tags">
          <text>商品图</text>
          <text>模特图</text>
          <text>种草图</text>
          <text>跨境白底图</text>
        </view>
      </view>
    </view>

    <view class="section">
      <view class="section-head">
        <text class="section-kicker">客户方案</text>
        <text class="section-title">面向不同企业角色的 AI 视觉生产路径</text>
      </view>
      <view class="solution-grid">
        <view v-for="item in customerSolutions" :key="item.name" class="solution-card">
          <text class="solution-name">{{ item.name }}</text>
          <view class="solution-block">
            <text class="block-label">客户痛点</text>
            <text class="block-copy">{{ item.pain }}</text>
          </view>
          <view class="solution-block">
            <text class="block-label">AI解决方案</text>
            <text class="block-copy">{{ item.solution }}</text>
          </view>
          <view class="solution-block">
            <text class="block-label">交付内容</text>
            <text class="block-copy">{{ item.delivery }}</text>
          </view>
          <view class="scene-list">
            <text v-for="scene in item.scenes" :key="scene">{{ scene }}</text>
          </view>
        </view>
      </view>
    </view>

    <view class="section process-section">
      <view class="section-head">
        <text class="section-kicker">合作流程</text>
        <text class="section-title">从需求到交付，形成可确认的企业视觉生产流程</text>
      </view>
      <view class="process-grid">
        <view v-for="(step, index) in processSteps" :key="step.title" class="process-card">
          <text class="step-index">0{{ index + 1 }}</text>
          <text class="step-title">{{ step.title }}</text>
          <text class="step-desc">{{ step.desc }}</text>
        </view>
      </view>
    </view>

    <view class="cta-section">
      <view>
        <text class="cta-title">需要为团队建立 AI 服装视觉生产流程？</text>
        <text class="cta-desc">提交企业需求后，我们会根据服装类型、平台用途、SKU 数量和交付目标给出方案建议。</text>
      </view>
      <button class="cta-btn" @click="goDemand">获取企业方案</button>
    </view>
  </view>
</template>

<script>
export default {
  data() {
    return {
      customerSolutions: [
        {
          name: '服装品牌',
          pain: '新品节奏快，拍摄成本高，品牌视觉需要保持统一。',
          solution: '用 AI 模特、场景和风格模板快速生成多渠道视觉素材。',
          delivery: '新品主图、模特展示图、品牌场景图、重点款精修图。',
          scenes: ['新品上新', '品牌内容', '季度企划']
        },
        {
          name: '电商团队',
          pain: 'SKU 多、平台规格多，图片准备容易拖慢上架效率。',
          solution: '围绕商品主图、白底图和种草图建立批量出图流程。',
          delivery: '商品主图、详情页素材、跨境白底图、批量 SKU 图。',
          scenes: ['电商上架', '活动备货', '多平台投放']
        },
        {
          name: '服装工厂',
          pain: '样衣和设计稿难以快速呈现成衣效果，客户沟通成本高。',
          solution: '将样衣图、面料图和设计稿转化为可沟通的视觉预览。',
          delivery: '样衣展示图、颜色变体图、场景展示图、客户提案图。',
          scenes: ['样衣沟通', '客户提案', '批量打样']
        },
        {
          name: '设计工作室',
          pain: '设计方案需要快速表达款式、图案、颜色和穿着效果。',
          solution: '通过换颜色、换图案、微改款辅助完成设计表达。',
          delivery: '设计预览图、款式变化图、图案应用图、提案展示图。',
          scenes: ['方案提案', '款式研发', '视觉验证']
        }
      ],
      processSteps: [
        {
          title: '需求提交',
          desc: '收集服装类型、平台用途、出图数量、参考素材和交付目标。'
        },
        {
          title: '方案评估',
          desc: '确认适合的 AI 出图方式、人工精修范围和交付节奏。'
        },
        {
          title: 'AI生产',
          desc: '按项目需求生成商品图、模特图、场景图或批量 SKU 图片。'
        },
        {
          title: '审核优化',
          desc: '围绕品牌调性、平台规范和重点图片进行确认与优化。'
        },
        {
          title: '交付确认',
          desc: '按确认后的图片类型、尺寸和用途完成商用交付。'
        }
      ]
    }
  },
  methods: {
    goDemand() {
      uni.navigateTo({
        url: '/pages/enterprise-request/enterprise-request?sourceType=enterprise_solution&interestType=enterprise_cooperation'
      })
    }
  }
}
</script>

<style scoped>
.enterprise-page {
  min-height: 100vh;
  padding: 40rpx 28rpx 56rpx;
  background:
    radial-gradient(circle at 12% 8%, rgba(91, 108, 255, 0.16), transparent 28%),
    linear-gradient(180deg, #f7f8ff 0%, #ffffff 42%, #f8fafc 100%);
  color: #0f172a;
  box-sizing: border-box;
}

.hero-section,
.section,
.cta-section {
  max-width: 1180rpx;
  margin: 0 auto;
}

.hero-section {
  display: grid;
  grid-template-columns: minmax(0, 1.06fr) minmax(360rpx, 0.94fr);
  gap: 34rpx;
  align-items: center;
  padding: 42rpx 0 36rpx;
}

.brand-line,
.hero-title,
.hero-desc,
.section-kicker,
.section-title,
.solution-name,
.block-label,
.block-copy,
.step-index,
.step-title,
.step-desc,
.cta-title,
.cta-desc {
  display: block;
}

.brand-line {
  color: #5b6cff;
  font-size: 24rpx;
  font-weight: 850;
}

.hero-title {
  margin-top: 18rpx;
  max-width: 760rpx;
  color: #111827;
  font-size: 62rpx;
  font-weight: 950;
  line-height: 1.12;
}

.hero-desc {
  margin-top: 22rpx;
  max-width: 720rpx;
  color: #475569;
  font-size: 28rpx;
  line-height: 1.7;
}

.hero-btn,
.cta-btn {
  height: 82rpx;
  line-height: 82rpx;
  margin: 34rpx 0 0;
  padding: 0 36rpx;
  border-radius: 999rpx;
  background: linear-gradient(135deg, #111827, #5b6cff);
  color: #ffffff;
  font-size: 27rpx;
  font-weight: 900;
}

.hero-panel {
  min-width: 0;
  padding: 26rpx;
  border: 1rpx solid rgba(91, 108, 255, 0.14);
  border-radius: 34rpx;
  background: rgba(255, 255, 255, 0.82);
  box-shadow: 0 28rpx 86rpx rgba(15, 23, 42, 0.09);
  box-sizing: border-box;
}

.panel-top,
.panel-tags,
.process-grid {
  display: flex;
}

.panel-top {
  justify-content: space-between;
  color: #64748b;
  font-size: 22rpx;
  font-weight: 780;
}

.panel-stage {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 48rpx minmax(0, 1fr);
  gap: 12rpx;
  align-items: center;
  margin-top: 24rpx;
}

.stage-card {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 280rpx;
  border-radius: 28rpx;
  color: #1e293b;
  font-size: 26rpx;
  font-weight: 900;
  text-align: center;
}

.stage-card.before {
  background:
    radial-gradient(circle at 34% 24%, rgba(15, 23, 42, 0.1), transparent 30%),
    linear-gradient(145deg, #f8fafc, #e2e8f0);
}

.stage-card.after {
  background:
    radial-gradient(circle at 74% 16%, rgba(91, 108, 255, 0.24), transparent 30%),
    linear-gradient(145deg, #eef2ff, #ffffff 54%, #f5f3ff);
}

.stage-arrow {
  color: #5b6cff;
  font-size: 34rpx;
  font-weight: 950;
  text-align: center;
}

.panel-tags {
  flex-wrap: wrap;
  gap: 10rpx;
  margin-top: 20rpx;
}

.panel-tags text,
.scene-list text {
  padding: 8rpx 13rpx;
  border-radius: 999rpx;
  background: #eef2ff;
  color: #4f46e5;
  font-size: 21rpx;
  font-weight: 800;
}

.section {
  padding: 42rpx 0;
}

.section-head {
  max-width: 820rpx;
  margin-bottom: 24rpx;
}

.section-kicker {
  color: #5b6cff;
  font-size: 23rpx;
  font-weight: 850;
}

.section-title {
  margin-top: 10rpx;
  color: #111827;
  font-size: 40rpx;
  font-weight: 940;
  line-height: 1.25;
}

.solution-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 18rpx;
}

.solution-card {
  min-width: 0;
  padding: 24rpx;
  border: 1rpx solid rgba(15, 23, 42, 0.08);
  border-radius: 30rpx;
  background: rgba(255, 255, 255, 0.88);
  box-shadow: 0 20rpx 62rpx rgba(15, 23, 42, 0.055);
  box-sizing: border-box;
}

.solution-name {
  color: #0f172a;
  font-size: 31rpx;
  font-weight: 940;
}

.solution-block {
  margin-top: 18rpx;
}

.block-label {
  color: #5b6cff;
  font-size: 21rpx;
  font-weight: 850;
}

.block-copy {
  margin-top: 7rpx;
  color: #475569;
  font-size: 22rpx;
  line-height: 1.62;
}

.scene-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8rpx;
  margin-top: 20rpx;
}

.scene-list text {
  background: #f1f5f9;
  color: #334155;
}

.process-section {
  padding-top: 34rpx;
}

.process-grid {
  gap: 14rpx;
}

.process-card {
  flex: 1;
  min-width: 0;
  padding: 22rpx;
  border-radius: 26rpx;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.94), rgba(248, 250, 252, 0.9));
  border: 1rpx solid rgba(91, 108, 255, 0.12);
  box-sizing: border-box;
}

.step-index {
  color: #5b6cff;
  font-size: 22rpx;
  font-weight: 900;
}

.step-title {
  margin-top: 12rpx;
  color: #0f172a;
  font-size: 27rpx;
  font-weight: 930;
}

.step-desc {
  margin-top: 10rpx;
  color: #64748b;
  font-size: 21rpx;
  line-height: 1.58;
}

.cta-section {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24rpx;
  margin-top: 20rpx;
  padding: 34rpx;
  border-radius: 34rpx;
  background:
    radial-gradient(circle at 86% 12%, rgba(255, 255, 255, 0.18), transparent 32%),
    linear-gradient(135deg, #111827, #4338ca);
  box-shadow: 0 28rpx 86rpx rgba(67, 56, 202, 0.22);
  box-sizing: border-box;
}

.cta-title {
  color: #ffffff;
  font-size: 36rpx;
  font-weight: 940;
  line-height: 1.25;
}

.cta-desc {
  margin-top: 12rpx;
  color: rgba(255, 255, 255, 0.72);
  font-size: 24rpx;
  line-height: 1.6;
}

.cta-btn {
  flex: 0 0 auto;
  margin: 0;
  background: #ffffff;
  color: #4338ca;
}

@media screen and (max-width: 900px) {
  .enterprise-page {
    padding: 28rpx 22rpx 42rpx;
  }

  .hero-section,
  .solution-grid {
    grid-template-columns: 1fr;
  }

  .hero-title {
    font-size: 46rpx;
  }

  .hero-desc {
    font-size: 25rpx;
  }

  .process-grid,
  .cta-section {
    display: block;
  }

  .process-card {
    margin-top: 14rpx;
  }

  .cta-btn {
    width: 100%;
    margin-top: 24rpx;
  }
}
</style>
