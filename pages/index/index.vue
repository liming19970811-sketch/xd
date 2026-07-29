<template>
  <view class="container">
    <!-- #ifdef H5 -->
    <view class="site-nav">
      <view class="site-brand">
        <image class="site-logo" src="/static/logo.png" mode="aspectFit"></image>
        <text class="site-brand-name">蝶变</text>
      </view>
      <view class="site-nav-links">
        <text class="site-nav-item active">首页</text>
        <text class="site-nav-item" @click="goToServices">服务</text>
        <text class="site-nav-item" @click="goToCases">案例</text>
        <text class="site-nav-item" @click="goToPricing">价格</text>
        <text class="site-nav-item" @click="goToEnterprise">企业合作</text>
        <text class="site-nav-item" @click="goToEnterpriseWeb">企业工作台</text>
        <text class="site-nav-item cta" @click="goToWebsiteDemand">提交需求</text>
      </view>
    </view>

    <view class="site-hero">
      <view class="site-hero-copy">
        <text class="site-eyebrow">面向服装商家与品牌团队</text>
        <text class="site-title">AI 快改款 + 人工设计服务</text>
        <text class="site-desc">
          从商品图换模特、换色、换场景，到批量视觉升级和一对一设计交付，帮助商家更快完成上新、活动和视觉翻新。
        </text>
        <view class="site-actions">
          <button class="site-primary-btn" @click="goToWebsiteDemand">提交设计需求</button>
          <button class="site-secondary-btn" @click="goToServices">查看服务</button>
          <button class="site-secondary-btn enterprise-web-btn" @click="goToEnterpriseWeb">企业工作台</button>
        </view>
      </view>
      <view class="site-hero-visual">
        <image class="site-hero-image" src="/static/logo.png" mode="aspectFit"></image>
        <text class="site-visual-title">服装视觉升级工作台</text>
        <text class="site-visual-desc">AI 出图、人工精修、项目交付可以按业务阶段组合使用。</text>
      </view>
    </view>

    <view class="site-section site-enterprise-case-section">
      <view class="site-section-head">
        <text class="site-section-title">企业案例中心</text>
        <text class="site-section-desc">第一阶段展示示例案例结构，点击可进入官网查看客户问题、AI 方案、生成过程和交付结果。</text>
      </view>
      <view class="site-enterprise-case-grid">
        <view
          v-for="caseItem in enterpriseCasePreview"
          :key="caseItem.caseId"
          class="site-enterprise-case-item"
          @click="goToEnterpriseCase(caseItem)"
        >
          <view class="site-enterprise-case-visual">
            <view class="site-enterprise-case-before">{{ caseItem.before.label }}</view>
            <view class="site-enterprise-case-after">{{ caseItem.after.label }}</view>
          </view>
          <text class="site-enterprise-case-company">{{ caseItem.companyName }}</text>
          <text class="site-enterprise-case-title">{{ caseItem.title }}</text>
          <view class="site-enterprise-case-meta">
            <text>{{ caseItem.category }}</text>
            <text>{{ caseItem.solutions.slice(0, 2).join(' / ') }}</text>
          </view>
        </view>
      </view>
    </view>

    <view class="site-section">
      <view class="site-section-head">
        <text class="site-section-title">核心服务</text>
        <text class="site-section-desc">适合日常商品图生产，也适合品牌项目型交付。</text>
      </view>
      <view class="site-service-grid">
        <view v-for="item in websiteServices" :key="item.title" class="site-service-item">
          <text class="site-service-title">{{ item.title }}</text>
          <text class="site-service-desc">{{ item.desc }}</text>
        </view>
      </view>
    </view>

    <view class="site-section site-cases-section">
      <view class="site-section-head">
        <text class="site-section-title">案例方向</text>
        <text class="site-section-desc">先展示服务边界，后续可继续接入真实案例素材。</text>
      </view>
      <view class="site-case-list">
        <view v-for="item in websiteCases" :key="item.title" class="site-case-item">
          <text class="site-case-tag">{{ item.tag }}</text>
          <text class="site-case-title">{{ item.title }}</text>
          <text class="site-case-desc">{{ item.desc }}</text>
        </view>
      </view>
    </view>

    <view class="site-section">
      <view class="site-section-head">
        <text class="site-section-title">服务流程</text>
        <text class="site-section-desc">从需求到交付，保留清晰的项目推进节奏。</text>
      </view>
      <view class="site-flow">
        <view v-for="item in websiteFlow" :key="item.step" class="site-flow-item">
          <text class="site-flow-step">{{ item.step }}</text>
          <text class="site-flow-title">{{ item.title }}</text>
          <text class="site-flow-desc">{{ item.desc }}</text>
        </view>
      </view>
    </view>

    <view class="site-section site-enterprise-section">
      <view class="site-section-head">
        <text class="site-section-title">企业 AI 服装解决方案</text>
        <text class="site-section-desc">面向品牌、工厂和团队协作，把 AI 设计、品牌资产、项目管理和 API 接入放进统一展示入口。</text>
      </view>
      <view class="site-enterprise-grid">
        <view
          v-for="solution in enterpriseSolutions"
          :key="solution.id"
          class="site-enterprise-item"
          @click="goToEnterpriseSolution(solution)"
        >
          <text class="site-enterprise-title">{{ solution.name }}</text>
          <text class="site-enterprise-desc">{{ solution.desc }}</text>
          <view class="site-enterprise-tags">
            <text v-for="item in solution.items" :key="item" class="site-enterprise-tag">{{ item }}</text>
          </view>
        </view>
      </view>
      <button class="site-primary-btn enterprise-demand-btn" @click="goToEnterpriseSolution()">企业需求提交</button>
    </view>

    <view class="site-section site-service-plan-section">
      <view class="site-section-head">
        <text class="site-section-title">企业服务方案</text>
        <text class="site-section-desc">按 AI 视觉、品牌升级和 API 接入三类需求进入咨询，不接支付，不展示真实成交价格。</text>
      </view>
      <view class="site-service-plan-grid">
        <view
          v-for="plan in enterpriseServicePlanPreview"
          :key="plan.planId"
          class="site-service-plan-item"
          @click="goToServicePlan(plan)"
        >
          <view class="site-service-plan-head">
            <text class="site-service-plan-name">{{ plan.name }}</text>
            <text class="site-service-plan-price">{{ plan.priceText }}</text>
          </view>
          <text class="site-service-plan-target">{{ plan.target }}</text>
          <view class="site-service-plan-tags">
            <text v-for="feature in plan.features.slice(0, 3)" :key="feature">{{ feature }}</text>
          </view>
          <button class="site-service-plan-btn" @click.stop="goToServicePlan(plan)">立即咨询</button>
        </view>
      </view>
    </view>

    <view class="site-section site-trust-section">
      <view class="site-section-head">
        <text class="site-section-title">企业为什么选择蝶变</text>
        <text class="site-section-desc">从技术保障、AI 生产流程、商业授权、数据安全到交付保障，先把企业合作边界说清楚。</text>
      </view>
      <view class="site-trust-grid">
        <view
          v-for="item in enterpriseTrustPreview"
          :key="item.trustId"
          class="site-trust-item"
          @click="goToTrustFlow(item)"
        >
          <text class="site-trust-icon">{{ item.icon }}</text>
          <text class="site-trust-title">{{ item.title }}</text>
          <text class="site-trust-desc">{{ item.description }}</text>
        </view>
      </view>
      <view class="site-flow-preview">
        <view class="site-flow-preview-copy">
          <text class="site-flow-preview-title">企业合作流程</text>
          <text class="site-flow-preview-desc">需求沟通、方案确认、AI生成、审核优化、最终交付，继续进入官网线索表单。</text>
        </view>
        <view class="site-flow-preview-steps">
          <text v-for="step in enterpriseDeliveryPreview" :key="step.trustId">{{ step.title }}</text>
        </view>
        <button class="site-service-plan-btn trust-flow-btn" @click="goToTrustFlow()">企业合作流程入口</button>
      </view>
    </view>

    <view class="site-section site-article-section">
      <view class="site-section-head">
        <text class="site-section-title">企业知识中心</text>
        <text class="site-section-desc">围绕 AI服装设计、AI商拍、虚拟模特、服装数字化和企业解决方案建立官网 SEO 内容入口。</text>
      </view>
      <view class="site-article-grid">
        <view
          v-for="article in articlePreview"
          :key="article.articleId"
          class="site-article-item"
          @click="goToArticle(article)"
        >
          <text class="site-article-category">{{ article.category }}</text>
          <text class="site-article-title">{{ article.metaTitle || article.title }}</text>
          <text class="site-article-summary">{{ article.summary }}</text>
          <view class="site-article-keywords">
            <text v-for="keyword in (article.seoKeywords || article.keywords).slice(0, 2)" :key="keyword">{{ keyword }}</text>
          </view>
        </view>
      </view>
    </view>

    <view class="site-final-cta">
      <text class="site-final-title">有明确款式或上新计划？</text>
      <text class="site-final-desc">留下需求范围、预算和交付时间，我们会按项目情况安排后续跟进。</text>
      <button class="site-primary-btn final-btn" @click="goToWebsiteDemand">提交需求</button>
    </view>
    <!-- #endif -->

    <!-- #ifdef MP-WEIXIN -->
    <view class="workbench-head legacy-workbench-head">
      <text class="workbench-label">蝶变 AI｜服装视觉生产</text>
      <text class="brand-name">一张服装图，快速生成上新素材</text>
      <text class="brand-subtitle">无需拍摄，生成商品图、AI模特图、详情页和营销素材</text>
      <view class="workbench-actions">
        <button class="workbench-btn primary" @click="goToProductionGuide()">上传服装开始制作</button>
      </view>
      <text class="workbench-task-link" @click="goToTaskList">查看任务记录 ›</text>

      <view class="start-making-panel">
        <text class="start-making-title">你想先做什么？</text>
        <view class="start-goal-grid">
          <view v-for="goal in businessGoals" :key="goal.intent" class="start-goal-button" @click="goToProductionGuide(goal)">
            <text class="start-goal-title">{{ goal.name }}</text>
            <text class="start-goal-desc">{{ goal.description }}</text>
          </view>
        </view>
      </view>

      <view v-if="homeDraft" class="legacy-attention-strip" @click="resumeHomeDraft">
        <text class="legacy-attention-icon">任务</text>
        <view class="legacy-attention-copy">
          <text class="legacy-attention-label">继续上次任务</text>
          <text class="legacy-attention-value">{{ homeDraft.name }}</text>
        </view>
        <text class="legacy-attention-action">继续 ›</text>
      </view>
    </view>

    <view class="production-tools-section home-module">
      <view class="section-head">
        <text class="section-title">常用工具</text>
      </view>
      <view class="production-tool-groups">
        <view v-for="group in commonToolGroups" :key="group.id" class="production-tool-group">
          <text class="production-tool-group-title">{{ group.title }}</text>
          <view class="production-tool-grid">
            <view
              v-for="tool in group.items"
              :key="tool.id"
              class="production-tool-button"
              :class="[`tool-tone-${tool.tone}`, { unavailable: !tool.enabled }]"
              @click="openCapability(tool)"
            >
              <text class="production-tool-icon">{{ tool.icon }}</text>
              <view class="production-tool-copy">
                <text class="production-tool-title">{{ tool.name }}</text>
              </view>
            </view>
          </view>
        </view>
      </view>
    </view>

    <view class="production-cases-section home-module">
      <view class="section-head">
        <text class="section-title">案例展示</text>
        <text class="section-subtitle">从原始服装素材到可用商业视觉，快速复用同类生产方案。</text>
      </view>
      <scroll-view class="production-case-scroll" scroll-x :show-scrollbar="false">
        <view class="production-case-row">
          <view v-for="item in productionCases" :key="item.title" class="production-case-card">
            <text v-if="!item.beforeImage || !item.afterImage" class="production-case-demo-tag">功能演示</text>
            <text class="production-case-title">{{ item.title }}</text>
            <view class="production-case-compare">
              <view class="production-case-image before">
                <image v-if="item.beforeImage" class="production-case-real-image" :src="item.beforeImage" mode="aspectFill"></image>
                <view v-else class="production-case-placeholder">
                  <text class="production-case-placeholder-label">原图</text>
                  <text class="production-case-placeholder-copy">服装素材</text>
                </view>
              </view>
              <view class="production-case-image after">
                <image v-if="item.afterImage" class="production-case-real-image" :src="item.afterImage" mode="aspectFill"></image>
                <view v-else class="production-case-placeholder">
                  <text class="production-case-placeholder-label">AI效果图</text>
                  <text class="production-case-placeholder-copy">生成预览</text>
                </view>
              </view>
            </view>
            <text class="production-case-desc">{{ item.description }}</text>
            <button class="production-case-action" @click="goToWorkspaceWithType(item.workspaceType)">{{ item.actionText }}</button>
          </view>
        </view>
      </scroll-view>
      <text v-if="productionCases.length > 1" class="production-case-swipe-hint">左右滑动查看更多</text>
    </view>

    <view class="section-card service-entry-card">
      <view>
        <text class="service-entry-title">需要专业设计支持？</text>
        <text class="service-entry-desc">提交需求，由设计师协助完成批量交付。</text>
      </view>
      <button class="service-entry-btn" @click="goToWebsiteDemand">提交设计需求</button>
    </view>

    <view class="advanced-tools-section home-module">
      <view class="section-head advanced-section-head">
        <view>
          <text class="section-title">高级工具</text>
          <text class="section-subtitle">面向设计开发和批量生产的专业能力</text>
        </view>
        <text class="advanced-module-tip">专业功能</text>
      </view>
      <view class="advanced-tool-list">
        <view v-for="tool in visibleAdvancedTools" :key="tool.id" class="advanced-tool-item" @click="openCapability(tool)">
          <view class="advanced-tool-copy">
            <text class="advanced-tool-title">{{ tool.name }}</text>
            <text class="advanced-tool-desc">{{ tool.description }}</text>
          </view>
          <text class="advanced-tool-arrow">›</text>
        </view>
      </view>
      <button v-if="advancedTools.length > 4" class="advanced-tool-toggle" @click="toggleAdvancedTools">
        {{ advancedToolsExpanded ? '收起' : '展开更多' }}
        <text class="advanced-tool-toggle-arrow">{{ advancedToolsExpanded ? '⌃' : '⌄' }}</text>
      </button>
    </view>

    <view v-if="showOnboardingGuide" class="onboarding-mask">
      <view class="onboarding-sheet" @touchmove.stop.prevent>
        <view class="onboarding-handle"></view>
        <text class="onboarding-kicker">欢迎使用蝶变 AI</text>
        <text class="onboarding-title">3 步生成服装商品素材</text>
        <view class="onboarding-steps">
          <view v-for="item in onboardingSteps" :key="item.index" class="onboarding-step">
            <text class="onboarding-step-index">{{ item.index }}</text>
            <text>{{ item.text }}</text>
          </view>
        </view>
        <view class="onboarding-example">
          <text class="onboarding-example-title">一件衣服可以生成</text>
          <view class="onboarding-example-tags">
            <text v-for="item in onboardingOutputs" :key="item">{{ item }}</text>
          </view>
        </view>
        <button class="onboarding-primary" @click="startOnboardingExperience">立即体验</button>
        <button class="onboarding-secondary" @click="skipOnboardingGuide">暂时跳过</button>
      </view>
    </view>
    <!-- #endif -->
  </view>
</template>

<script>
// #ifdef MP-WEIXIN
import { hasCompletedOnboarding, completeOnboarding } from '../../utils/onboarding/onboardingRepository'
import { getTaskCenterSnapshot } from '../../utils/workspace/productionRecordRepository'
import { getTaskStatusMeta, normalizeTaskDisplayStatus } from '../../utils/task/taskDisplay'
import { refreshMembershipUsage } from '../../utils/member/membershipRepository'
// Production goal contract: product_launch, new_design, marketing. Values live in the shared home capability config.
import { HOME_BUSINESS_GOALS, HOME_CORE_CAPABILITIES, HOME_MORE_CAPABILITIES, PRODUCTION_ADVANCED_CAPABILITIES, buildCapabilityUrl } from '../../utils/home/homeCapabilities'
import { getHomeWorkbenchSnapshot } from '../../utils/home/homeWorkbenchRepository'
import { openWebsiteFeature } from '../../utils/navigation/websiteFeatureRouter'
import { getFeatureRuntimePolicy, refreshFeatureRuntimeBackendState } from '../../utils/runtime/featureRuntimePolicy'
// #endif
// #ifdef H5
import { ENTERPRISE_SOLUTIONS } from '../../utils/website/solutionData'
import { listEnterpriseCases } from '../../utils/website/caseRepository'
import { listEnterpriseServicePlans } from '../../utils/website/servicePlanRepository'
import { listEnterpriseTrustItems, listEnterpriseDeliveryFlow } from '../../utils/website/trustRepository'
import { listWebsiteArticles } from '../../utils/website/articleRepository'
// #endif

// #ifdef H5
const WEBSITE_SERVICES = [
  {
    title: 'AI 商品图快速生成',
    desc: '支持换模特、换颜色、换场景、微改款，适合日常上新和活动补图。'
  },
  {
    title: '批量视觉出图',
    desc: '面向多 SKU 和多渠道素材需求，帮助运营团队快速补齐主图和场景图。'
  },
  {
    title: '人工精修设计',
    desc: '当 AI 结果接近目标后，可转人工继续处理款式、质感和细节。'
  },
  {
    title: '品牌项目交付',
    desc: '支持长期视觉升级、系列上新和企业协作型设计服务。'
  }
]

const WEBSITE_CASES = [
  {
    tag: '上新',
    title: '新品主图快速成图',
    desc: '围绕同一款服装快速生成模特、场景和主图方向。'
  },
  {
    tag: '活动',
    title: '老款视觉翻新',
    desc: '在不重拍的前提下，为促销、清仓和复投素材补充新视觉。'
  },
  {
    tag: '项目',
    title: '品牌系列图升级',
    desc: '结合 AI 初稿和人工精修，形成更稳定的系列化交付。'
  }
]

const WEBSITE_FLOW = [
  {
    step: '01',
    title: '提交需求',
    desc: '填写产品方向、预算、交付时间和参考资料。'
  },
  {
    step: '02',
    title: '确认方案',
    desc: '根据目标效果选择 AI 快改、人工精修或项目合作。'
  },
  {
    step: '03',
    title: '出图交付',
    desc: '按任务推进生成、审核、修改和最终交付。'
  },
  {
    step: '04',
    title: '复用扩展',
    desc: '沉淀可复用的风格和任务记录，支持后续批量生产。'
  }
]

const BUSINESS_SCENE_CARDS = [
  {
    key: 'ecommerce_main',
    title: '电商主图',
    desc: '生成淘宝、拼多多、抖音等平台可用的商品主图',
    tags: ['白底', '模特', '高清']
  },
  {
    key: 'xiaohongshu_seed',
    title: '小红书种草图',
    desc: '生成生活方式场景图，适合社媒内容投放',
    tags: ['场景', '氛围', '社媒']
  },
  {
    key: 'cross_border_white',
    title: '跨境白底图',
    desc: '适合亚马逊、独立站等渠道上架',
    tags: ['白底', '规范', '批量']
  },
  {
    key: 'new_arrival',
    title: '新品上新图',
    desc: '多款服装快速生成上新素材',
    tags: ['批量', '上新', '快速']
  },
  {
    key: 'batch_model',
    title: '批量模特图',
    desc: '一批服装统一生成真人展示效果',
    tags: ['批次', '模特', '审核']
  },
  {
    key: 'hot_style_remix',
    title: '爆款微改款',
    desc: '基于参考款生成领口、袖型、版型等微改方向',
    tags: ['领口', '袖型', '版型']
  }
]

const AI_ABILITY_CARDS = [
  {
    key: 'model_replace',
    workspaceType: 'model',
    title: '换模特',
    desc: '保留服装，生成不同模特图',
    iconText: '模',
    iconClass: 'ability-model',
    outputLabel: '模特图'
  },
  {
    key: 'color_change',
    workspaceType: 'color',
    title: '换颜色',
    desc: '快速生成多色方案',
    iconText: '色',
    iconClass: 'ability-color',
    outputLabel: '多色方案'
  },
  {
    key: 'scene_change',
    workspaceType: 'scene',
    title: '换场景',
    desc: '白底、棚拍、街拍一键切换',
    iconText: '景',
    iconClass: 'ability-scene',
    outputLabel: '场景图'
  },
  {
    key: 'micro_redesign',
    workspaceType: 'refine',
    title: '微改款',
    desc: '领型、袖型、版型轻改款',
    iconText: '改',
    iconClass: 'ability-remix',
    outputLabel: '改款参考'
  }
]

const DEVELOPMENT_TOOL_CARDS = [
  {
    key: 'text_to_sketch',
    title: '文字生成款式草图',
    desc: '输入款式描述，生成服装草图',
    tags: ['草图', '款式描述', '设计沟通']
  },
  {
    key: 'sketch_to_model',
    title: '设计稿成衣图',
    desc: '上传手稿或线稿，生成模特上身参考图',
    tags: ['设计稿', '参考图', '草图']
  },
  {
    key: 'image_to_sketch',
    title: '图片转结构线稿',
    desc: '上传成衣图，生成参考结构线稿',
    tags: ['参考线稿', '结构', '成衣图']
  },
  {
    key: 'sketch_remix',
    title: '线稿改款效果图',
    desc: '改领口、袖型、衣长，生成新款参考图',
    tags: ['辅助改款', '新款参考图', '线稿']
  },
  {
    key: 'sketch_to_tech_pack',
    title: '线稿生成简易工艺结构图',
    desc: '根据线稿生成参考工艺结构说明',
    tags: ['参考工艺结构说明', '线稿', '生产沟通']
  }
]

const MATERIAL_TOOL_CARDS = [
  {
    key: 'print_generate',
    title: 'AI 印花生成',
    desc: '文字或图片生成印花图案',
    tags: ['印花', '图案', '上新素材']
  },
  {
    key: 'print_placement',
    title: '一键衣身贴图',
    desc: '前胸、后背、满印贴图占位',
    tags: ['贴图', '前胸', '满印']
  },
  {
    key: 'fabric_replace',
    title: 'AI 面料替换',
    desc: '棉、牛仔、雪纺、针织等面料质感预览',
    tags: ['面料', '质感', '预览']
  },
  {
    key: 'color_batch',
    title: '同款多色批量生成',
    desc: '一款生成多色方案',
    tags: ['多色', '批量', '配色']
  },
  {
    key: 'hot_style_remix',
    title: '爆款衍生改款',
    desc: '改领口、袖型、衣长，快速扩 SKU',
    tags: ['辅助改款', 'SKU', '新款参考图']
  },
  {
    key: 'detail_page_from_photo',
    title: '实拍图智能生成详情页',
    desc: '实拍图结合 AI 生成详情页素材',
    tags: ['详情页', '实拍图', '上新素材']
  },
  {
    key: 'detail_closeup',
    title: '局部放大细节图',
    desc: '领口、袖口、面料、纹理、拉链细节',
    tags: ['细节图', '领口', '面料']
  },
  {
    key: 'detail_long_image',
    title: '自动排版详情长图',
    desc: '主图、场景图、细节图自动拼版',
    tags: ['长图', '拼版', '详情页']
  },
  {
    key: 'runway_video',
    title: '一键生成 T 台走秀短片',
    desc: '3 秒、5 秒、10 秒走秀视频占位',
    tags: ['走秀视频', '占位', '上新素材']
  }
]
// #endif

const PRODUCTION_CASES = [
  {
    title: '挂拍图生成模特展示',
    beforeImage: '',
    afterImage: '',
    description: '保留服装版型和材质，快速生成真人展示效果。',
    actionText: '制作同款',
    workspaceType: 'model'
  },
  {
    title: '商品图延展生活场景',
    beforeImage: '',
    afterImage: '',
    description: '从基础商品素材延展为种草和品牌内容场景。',
    actionText: '制作同款',
    workspaceType: 'scene'
  },
  {
    title: '单款生成多色 SKU',
    beforeImage: '',
    afterImage: '',
    description: '保持面料纹理和光影，生成可对比的多色方案。',
    actionText: '制作同款',
    workspaceType: 'color'
  }
]

// #ifdef MP-WEIXIN
const ONBOARDING_STEPS = Object.freeze([
  Object.freeze({ index: '1', text: '上传服装图片' }),
  Object.freeze({ index: '2', text: '选择生成用途' }),
  Object.freeze({ index: '3', text: '获得商品图、模特图和营销素材' })
])

const ONBOARDING_OUTPUTS = Object.freeze(['商品主图', '模特图', '详情页素材', '营销素材'])

const HOME_GOAL_DESCRIPTIONS = Object.freeze({
  product_launch: '生成商品展示素材',
  new_design: '探索款式设计方向',
  marketing: '制作推广视觉内容'
})

function findHomeCapability(id) {
  return [...HOME_CORE_CAPABILITIES, ...HOME_MORE_CAPABILITIES].find((item) => item.id === id) || {}
}

function createHomeTool(id, overrides = {}) {
  return Object.freeze({
    enabled: true,
    tone: 'blue',
    ...findHomeCapability(id),
    id,
    ...overrides
  })
}

function applyHomeRuntimePolicy(capability = {}) {
  const hasDestination = Boolean(capability.route || capability.websiteFeature)
  const runtime = getFeatureRuntimePolicy({
    featureEnabled: capability.enabled !== false,
    featureImplemented: hasDestination,
    taskType: capability.taskType || capability.id
  })
  return {
    ...capability,
    enabled: runtime.canAccessFeature,
    runtimeStatus: hasDestination ? (runtime.capabilityStatus || 'available') : 'ui_only',
    disabledReason: runtime.disabledReason
  }
}

function buildRuntimeToolGroups() {
  return COMMON_TOOL_GROUPS.map((group) => ({
    ...group,
    items: group.items.map(applyHomeRuntimePolicy)
  }))
}

function buildRuntimeAdvancedTools() {
  const source = [...ADVANCED_TOOLS, ...PRODUCTION_ADVANCED_CAPABILITIES]
  const seen = new Set()
  return source.filter((item) => {
    if (seen.has(item.id)) return false
    seen.add(item.id)
    return true
  }).map(applyHomeRuntimePolicy)
}

const COMMON_TOOL_GROUPS = Object.freeze([
  Object.freeze({
    id: 'model-homepage',
    title: '模特与穿搭',
    description: '生成真人展示和商品主页图',
    items: Object.freeze([
      createHomeTool('model_replace', { name: 'AI模特', description: '换模特与人脸', icon: '模特', tone: 'purple' }),
      createHomeTool('garment_replace', { name: '换衣服', description: '上下装分开替换', icon: '换装', tone: 'yellow' }),
      createHomeTool('scene_replace', { name: '换场景', description: '替换展示环境', icon: '场景', tone: 'blue' }),
      createHomeTool('pose_replace', {
        name: '换姿势',
        description: '生成不同动作',
        icon: '姿势',
        tone: 'pink'
      })
    ])
  }),
  Object.freeze({
    id: 'garment-redesign',
    title: '服装设计',
    description: '调整款式、颜色、材质和设计效果',
    items: Object.freeze([
      createHomeTool('style_redesign', { name: '改款式', description: '优化款式方向', icon: '改款', tone: 'red' }),
      createHomeTool('color_replace', { name: '换颜色', description: '预览不同配色', icon: '配色', tone: 'green' }),
      createHomeTool('fabric_replace', { name: '换面料', description: '替换材质质感', icon: '面料', tone: 'cyan' }),
      createHomeTool('pattern_replace', { name: '换图案', description: '替换印花纹样', icon: '图案', tone: 'yellow' })
    ])
  }),
  Object.freeze({
    id: 'detail-assets',
    title: '商品素材',
    description: '补充商品展示和详情页素材',
    items: Object.freeze([
      createHomeTool('display_image', { name: '平铺细节', description: '生成平铺细节', icon: '平铺', tone: 'cyan' }),
      createHomeTool('detail_long_image', { name: '商品详情页', description: '自动排版详情长图', icon: '详情', tone: 'orange' })
    ])
  })
])

const ADVANCED_TOOLS = Object.freeze([
  createHomeTool('structure_analysis', { name: '服装结构解析', description: '识别版型与设计细节', icon: '结构', route: '/package-ai/upload/upload', query: { entryScene: 'structure_analysis', autoPromptPlan: '1' }, taskType: 'structure_analysis', tone: 'slate' }),
  createHomeTool('text_to_sketch', { name: '文字生成款式图', description: '描述生成设计方向' }),
  createHomeTool('image_to_sketch', { name: '图片转结构稿', description: '生成服装结构参考' }),
  createHomeTool('ai_design_assistant', { name: 'AI设计助手', description: '辅助设计方向与方案', icon: '设计', route: '/package-ai/upload/upload', query: { entryScene: 'ai_design_assistant', autoPromptPlan: '1' }, taskType: 'ai_design_assistant', tone: 'purple' }),
  createHomeTool('sketch_remix', { name: '线稿效果图', description: '快速生成效果参考' }),
  createHomeTool('batch_model', { name: '批量处理', description: '一次处理多款素材' }),
  createHomeTool('enterprise_tools', { name: '企业工具', description: '进入企业协作能力', icon: '企业', websiteFeature: 'enterprise_workspace', tone: 'slate' }),
  createHomeTool('pattern_structure'),
  createHomeTool('pattern_library')
])
// #endif

export default {
  data() {
    return {
      // #ifdef H5
      websiteServices: WEBSITE_SERVICES,
      websiteCases: WEBSITE_CASES,
      websiteFlow: WEBSITE_FLOW,
      enterpriseSolutions: ENTERPRISE_SOLUTIONS,
      enterpriseCasePreview: listEnterpriseCases().slice(0, 3),
      enterpriseServicePlanPreview: listEnterpriseServicePlans(),
      enterpriseTrustPreview: listEnterpriseTrustItems(),
      enterpriseDeliveryPreview: listEnterpriseDeliveryFlow(),
      articlePreview: listWebsiteArticles().slice(0, 3),
      businessSceneCards: BUSINESS_SCENE_CARDS,
      aiAbilityCards: AI_ABILITY_CARDS,
      // #endif
      productionCases: PRODUCTION_CASES,
      // #ifdef MP-WEIXIN
      coreCapabilities: HOME_CORE_CAPABILITIES,
      businessGoals: HOME_BUSINESS_GOALS.map((goal) => ({
        ...goal,
        description: HOME_GOAL_DESCRIPTIONS[goal.intent] || ''
      })),
      commonToolGroups: buildRuntimeToolGroups(),
      advancedTools: buildRuntimeAdvancedTools(),
      advancedToolsExpanded: false,
      moreCapabilities: HOME_MORE_CAPABILITIES,
      moreCapabilitiesExpanded: false,
      homeDraft: null,
      homeIdentity: { available: false, nickname: '', avatarUrl: '' },
      homeMembership: { ok: false, data: null, errorCode: '' },
      homeMembershipLoading: false,
      recentWorks: [],
      navigationLocked: false,
      showOnboardingGuide: false,
      onboardingSteps: ONBOARDING_STEPS,
      onboardingOutputs: ONBOARDING_OUTPUTS,
      taskCenterItems: [],
      taskCenterStats: { all: 0, processing: 0, completed: 0, failed: 0 },
      taskCenterLoading: false,
      taskCenterVisible: false,
      // #endif
    }
  },
  computed: {
    visibleMoreCapabilities() {
      return this.moreCapabilitiesExpanded ? this.moreCapabilities : this.moreCapabilities.slice(0, 6)
    },
    visibleAdvancedTools() {
      return this.advancedToolsExpanded ? this.advancedTools : this.advancedTools.slice(0, 4)
    },
    homeQuotaText() {
      if (this.homeMembershipLoading && !(this.homeMembership && this.homeMembership.data && this.homeMembership.data.available)) return '同步中'
      const usage = this.homeMembership && this.homeMembership.data
      if (!this.homeMembership || this.homeMembership.ok !== true || !usage || usage.available !== true || usage.isFallback) return '暂不可用'
      return `剩余 ${usage.remaining}`
    },
    homeTaskStatusText() {
      const stats = this.taskCenterStats || {}
      if (stats.failed) return `${stats.failed} 个待处理`
      if (stats.processing) return `${stats.processing} 个进行中`
      return stats.all ? '查看记录' : '暂无任务'
    },
    taskCenterSummaryText() {
      const stats = this.taskCenterStats || {}
      if (stats.processing) return `正在生成 ${stats.processing}`
      if (stats.failed) return `${stats.failed} 个任务需要处理`
      return '查看近期生成状态'
    }
  },
  onShow() {
    // #ifdef MP-WEIXIN
    this.taskCenterVisible = true
    this.refreshFeatureRuntimePolicy()
    this.refreshOnboardingGuide()
    this.refreshHomeWorkbench()
    // #endif
  },
  onHide() {
    // #ifdef MP-WEIXIN
    this.taskCenterVisible = false
    this.stopTaskCenterRefresh()
    // #endif
  },
  onUnload() {
    // #ifdef MP-WEIXIN
    this.taskCenterVisible = false
    this.stopTaskCenterRefresh()
    // #endif
  },
  methods: {
    // #ifdef MP-WEIXIN
    refreshOnboardingGuide() {
      const shouldShow = !hasCompletedOnboarding()
      this.showOnboardingGuide = shouldShow
    },
    startOnboardingExperience() {
      completeOnboarding('completed')
      this.showOnboardingGuide = false
      this.goToProductionGuide()
    },
    skipOnboardingGuide() {
      completeOnboarding('skipped')
      this.showOnboardingGuide = false
    },
    refreshHomeWorkbench() {
      try {
        const snapshot = getHomeWorkbenchSnapshot()
        this.homeIdentity = snapshot.identity || { available: false, nickname: '', avatarUrl: '' }
        this.homeMembership = snapshot.membership || { ok: false, data: null, errorCode: 'membership_unavailable' }
        this.homeDraft = snapshot.draft || null
        this.recentWorks = Array.isArray(snapshot.works) ? snapshot.works : []
        const taskSnapshot = snapshot.taskSnapshot || {}
        this.taskCenterItems = taskSnapshot.identityAvailable ? (taskSnapshot.items || []) : []
        this.taskCenterStats = taskSnapshot.stats || { all: 0, processing: 0, completed: 0, failed: 0 }
        this.scheduleTaskCenterRefresh()
      } catch (error) {
        this.taskCenterItems = []
        this.recentWorks = []
      }
      this.refreshHomeMembership()
    },
    async refreshHomeMembership() {
      const now = Date.now()
      if (this.homeMembershipLoading || (this._lastMembershipRefreshAt && now - this._lastMembershipRefreshAt < 120000)) return
      this.homeMembershipLoading = true
      this._lastMembershipRefreshAt = now
      try {
        const result = await refreshMembershipUsage()
        if (result && result.ok === true) this.homeMembership = result
      } finally {
        this.homeMembershipLoading = false
      }
    },
    refreshTaskCenter() {
      if (this.taskCenterLoading) return
      this.taskCenterLoading = true
      try {
        const snapshot = getTaskCenterSnapshot({ limit: 3 })
        this.taskCenterItems = snapshot.identityAvailable ? snapshot.items : []
        this.taskCenterStats = snapshot.stats || { all: 0, processing: 0, completed: 0, failed: 0 }
      } catch (error) {
        this.taskCenterItems = []
      } finally {
        this.taskCenterLoading = false
        this.scheduleTaskCenterRefresh()
      }
    },
    scheduleTaskCenterRefresh() {
      this.stopTaskCenterRefresh()
      if (!this.taskCenterVisible || !this.taskCenterStats.processing) return
      this._taskCenterTimer = setTimeout(() => this.refreshTaskCenter(), 5000)
    },
    stopTaskCenterRefresh() {
      if (!this._taskCenterTimer) return
      clearTimeout(this._taskCenterTimer)
      this._taskCenterTimer = null
    },
    openTaskCenter(filter = 'all') {
      uni.navigateTo({
        url: `/package-assets/task-list/task-list?filter=${encodeURIComponent(filter)}`,
        fail: () => uni.showToast({ title: '任务中心暂时无法打开', icon: 'none' })
      })
    },
    openTaskRecord(item = {}) {
      const query = []
      if (item.historyId) query.push(`historyId=${encodeURIComponent(item.historyId)}`)
      else if (item.taskId) query.push(`taskId=${encodeURIComponent(item.taskId)}`)
      uni.navigateTo({
        url: `/package-assets/task-list/task-list${query.length ? `?${query.join('&')}` : ''}`,
        fail: () => uni.showToast({ title: '任务详情暂时无法打开', icon: 'none' })
      })
    },
    navigateHome(url = '', mode = 'navigateTo') {
      if (!url || this.navigationLocked) return
      this.navigationLocked = true
      const unlock = () => {
        setTimeout(() => { this.navigationLocked = false }, 500)
      }
      const options = {
        url,
        success: unlock,
        fail: () => {
          unlock()
          uni.showToast({ title: '页面暂时无法打开，请稍后重试', icon: 'none' })
        }
      }
      if (mode === 'switchTab') uni.switchTab(options)
      else uni.navigateTo(options)
    },
    openCapability(capability = {}) {
      if (!capability.enabled) {
        uni.showToast({ title: capability.disabledReason || `${capability.name || '该能力'}暂未开放`, icon: 'none' })
        return
      }
      if (capability.id === 'enterprise_tools') {
        uni.showModal({
          title: '企业工具',
          content: '完整企业管理能力已迁移到蝶变企业网页版。',
          showCancel: false
        })
        return
      }
      if (capability.websiteFeature) {
        openWebsiteFeature(capability.websiteFeature)
        return
      }
      const url = buildCapabilityUrl(capability)
      if (!url) {
        uni.showToast({ title: '该能力暂时无法打开', icon: 'none' })
        return
      }
      this.navigateHome(url)
    },
    async refreshFeatureRuntimePolicy() {
      await refreshFeatureRuntimeBackendState()
      this.commonToolGroups = buildRuntimeToolGroups()
      this.advancedTools = buildRuntimeAdvancedTools()
    },
    toggleMoreCapabilities() {
      this.moreCapabilitiesExpanded = !this.moreCapabilitiesExpanded
    },
    toggleAdvancedTools() {
      this.advancedToolsExpanded = !this.advancedToolsExpanded
    },
    resumeHomeDraft() {
      if (!this.homeDraft || !this.homeDraft.route) return
      this.navigateHome(this.homeDraft.route)
    },
    goToMine() {
      this.navigateHome('/pages/mine/mine', 'switchTab')
    },
    goToGallery() {
      this.navigateHome('/pages/gallery/gallery', 'switchTab')
    },
    goToMembershipCenter() {
      this.navigateHome('/pages/package-center/package-center')
    },
    // #endif
    goToWorkspaceWithType(type = 'model') {
      // #ifdef MP-WEIXIN
      const simpleTypeMap = {
        ecommerce: 'flat_lay',
        social: 'marketing',
        crossborder: 'flat_lay',
        batch: 'marketing'
      }
      this.goToSimpleWorkbench(simpleTypeMap[type] || type || 'model')
      return
      // #endif
      // #ifdef H5
      const query = type ? `?type=${encodeURIComponent(type)}` : ''
      uni.navigateTo({
        url: `/pages/workspace/workspace${query}`
      })
      // #endif
    },
    goToWorkspaceWithIntent(entry = {}) {
      // #ifdef MP-WEIXIN
      this.goToProductionGuide(entry)
      return
      // #endif
      // #ifdef H5
      const query = [
        `workspaceIntent=${encodeURIComponent(entry.intent || '')}`,
        `quickEntry=${encodeURIComponent(entry.intent || '')}`,
        `guideId=${encodeURIComponent(entry.guideId || '')}`
      ].join('&')
      uni.navigateTo({
        url: `/pages/workspace/workspace?${query}`
      })
      // #endif
    },
    goToProductionGuide(entry = {}) {
      const queryItems = []
      if (entry.intent) {
        queryItems.push(`target=${encodeURIComponent(entry.intent)}`)
      }
      if (entry.guideId) {
        queryItems.push(`guideId=${encodeURIComponent(entry.guideId)}`)
      }
      const query = queryItems.length ? `?${queryItems.join('&')}` : ''
      // #ifdef MP-WEIXIN
      this.navigateHome(`/package-ai/production-guide/production-guide${query}`)
      return
      // #endif
      uni.navigateTo({
        url: `/package-ai/production-guide/production-guide${query}`
      })
    },
    goToSimpleWorkbench(toolType = 'model') {
      const query = toolType ? `?toolType=${encodeURIComponent(toolType)}` : ''
      // #ifdef MP-WEIXIN
      this.navigateHome(`/package-ai/simple-ai-workbench/simple-ai-workbench${query}`)
      return
      // #endif
      uni.navigateTo({
        url: `/package-ai/simple-ai-workbench/simple-ai-workbench${query}`
      })
    },
    goToUploadWithMode(mode) {
      const query = mode ? `?toolType=${encodeURIComponent(mode)}` : ''
      uni.navigateTo({
        url: `/package-ai/upload/upload${query}`
      })
    },
    goToUploadWithScene(entryScene, section = 'unknown', name = '', options = {}) {
      console.log('[index:feature-entry] click', {
        section,
        entryScene,
        name,
        autoPromptPlan: !!options.autoPromptPlan
      })
      const queryItems = []
      if (entryScene) {
        queryItems.push(`entryScene=${encodeURIComponent(entryScene)}`)
      }
      if (options.autoPromptPlan) {
        queryItems.push('autoPromptPlan=1')
      }
      const query = queryItems.length ? `?${queryItems.join('&')}` : ''
      uni.navigateTo({
        url: `/package-ai/upload/upload${query}`
      })
    },
    goToTaskList() {
      // #ifdef MP-WEIXIN
      this.navigateHome('/package-assets/task-list/task-list')
      return
      // #endif
      uni.navigateTo({ url: '/package-assets/task-list/task-list' })
    },
    goToGallery() {
      uni.switchTab({
        url: '/pages/gallery/gallery'
      })
    },
    goToPackageCenter() {
      uni.navigateTo({
        url: '/pages/package-center/package-center'
      })
    },
    goToServiceRequest() {
      uni.navigateTo({
        url: '/pages/service-request/service-request'
      })
    },
    goToWebsiteDemand() {
      // #ifdef MP-WEIXIN
      uni.navigateTo({
        url: '/pages/service-request/service-request'
      })
      return
      // #endif
      // #ifdef H5
      uni.navigateTo({
        url: '/pages/enterprise-request/enterprise-request?sourceType=index'
      })
      // #endif
    },
    // #ifdef H5
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
    goToPricing() {
      uni.navigateTo({
        url: '/pages/pricing/pricing'
      })
    },
    goToEnterpriseSolution(solution = {}) {
      const solutionId = solution.id || 'enterprise-solution'
      const name = solution.name || '企业 AI 服装解决方案'
      console.log('[website:solution]', {
        solutionId,
        name
      })
      console.log('[website:lead-source]', {
        sourceType: 'enterprise_solution',
        sourceId: solutionId
      })
      uni.navigateTo({
        url: `/pages/enterprise-request/enterprise-request?sourceType=enterprise_solution&sourceId=${encodeURIComponent(solutionId)}&interestType=enterprise_solution`
      })
    },
    goToEnterpriseCase(caseItem = {}) {
      const caseId = caseItem.caseId || ''
      const title = caseItem.title || ''
      console.log('[website:case]', {
        caseId,
        title
      })
      console.log('[website:lead-source]', {
        sourceType: 'case',
        sourceId: caseId
      })
      uni.navigateTo({
        url: `/pages/enterprise-request/enterprise-request?sourceType=case&sourceId=${encodeURIComponent(caseId)}&interestType=case`
      })
    },
    goToServicePlan(plan = {}) {
      const planId = plan.planId || ''
      const name = plan.name || ''
      console.log('[website:service]', {
        planId,
        name
      })
      console.log('[website:lead-source]', {
        sourceType: 'service_plan',
        sourceId: planId
      })
      uni.navigateTo({
        url: `/pages/enterprise-request/enterprise-request?sourceType=service_plan&sourceId=${encodeURIComponent(planId)}&interestType=service_plan`
      })
    },
    goToTrustFlow(item = {}) {
      const trustId = item.trustId || 'flow-requirement'
      const title = item.title || '企业合作流程'
      console.log('[website:trust]', {
        trustId,
        title
      })
      console.log('[website:lead-source]', {
        sourceType: 'trust',
        sourceId: trustId
      })
      uni.navigateTo({
        url: `/pages/enterprise-request/enterprise-request?sourceType=trust&sourceId=${encodeURIComponent(trustId)}&interestType=trust`
      })
    },
    goToArticle(article = {}) {
      const articleId = article.articleId || ''
      const title = article.title || ''
      console.log('[website:article]', {
        articleId,
        title
      })
      console.log('[website:lead-source]', {
        sourceType: 'article',
        sourceId: articleId
      })
      uni.navigateTo({
        url: `/pages/enterprise-request/enterprise-request?sourceType=article&sourceId=${encodeURIComponent(articleId)}&interestType=article`
      })
    },
    goToEnterprise() {
      this.goToEnterpriseSolution()
    },
    goToEnterpriseWeb() {
      uni.navigateTo({
        url: '/pages/enterprise-web/dashboard'
      })
    },
    // #endif
    goToResult(task) {
      const taskId = this.getRecentTaskId(task)
      if (!taskId) {
        return
      }
      uni.navigateTo({
        url: `/package-ai/result/result?taskId=${encodeURIComponent(taskId)}`
      })
    },
    handleRecentTaskView(task) {
      const taskId = this.getRecentTaskId(task)
      if (!taskId) {
        uni.showToast({
          title: '任务信息缺失',
          icon: 'none'
        })
        return
      }
      uni.navigateTo({
        url: `/package-ai/result/result?taskId=${encodeURIComponent(taskId)}`
      })
    },
    buildRecentTaskCard(task = {}) {
      const taskId = this.getRecentTaskId(task)
      return {
        taskId,
        rawTask: task,
        thumbnail: this.resolveTaskThumbnail(task),
        title: this.formatRecentTaskTitle(task),
        subtitle: this.formatRecentTaskSubtitle(task),
        statusText: this.formatRecentTaskStatus(task)
      }
    },
    getRecentTaskId(task = {}) {
      const rawTask = task.rawTask || task
      const summary = rawTask.summary || {}
      return String(
        task.taskId ||
        rawTask.taskId ||
        rawTask.task_id ||
        rawTask.id ||
        rawTask.clientTaskId ||
        (summary && summary.primaryText) ||
        ''
      )
    },
    getNestedImageValue(value) {
      if (!value) {
        return ''
      }
      if (typeof value === 'string') {
        return value
      }
      if (typeof value === 'object') {
        return value.url || value.fileUrl || value.imageUrl || value.image_url || value.resultImageUrl || value.result_image_url || ''
      }
      return ''
    },
    resolveRecentTaskThumbnail(task = {}) {
      const result = task.result || {}
      const resultItems = Array.isArray(result.items) ? result.items : []
      const input = task.input || {}
      const assets = input.assets || {}
      const clothImage = assets.clothImage || {}
      const directUrl =
        task.resultImageUrl ||
        task.result_image_url ||
        result.resultImageUrl ||
        result.result_image_url ||
        this.getNestedImageValue(result.image) ||
        this.getNestedImageValue(resultItems[0]) ||
        task.coverUrl ||
        task.thumbnailUrl ||
        task.imageUrl ||
        task.sourceImageUrl ||
        task.clothImageUrl ||
        this.getNestedImageValue(clothImage) ||
        ''
      return String(directUrl || '')
    },
    resolveTaskThumbnail(task = {}) {
      return this.resolveRecentTaskThumbnail(task)
    },
    getRecentTaskStatusValue(task = {}) {
      return normalizeTaskDisplayStatus(task.status || task.taskStatus || task.task_status || task.deliveryStatus)
    },
    formatRecentTaskTitle(task = {}) {
      const status = this.getRecentTaskStatusValue(task)
      if (status === 'success' || status === 'completed') {
        return '生成结果'
      }
      if (status === 'processing' || status === 'generating' || status === 'running') {
        return '生成中'
      }
      if (status === 'failed' || status === 'error') {
        return '生成失败'
      }
      if (status === 'draft') {
        return '待生成任务'
      }
      return '出图任务'
    },
    formatRecentTaskSubtitle(task = {}) {
      const summary = task.summary || {}
      if (summary && typeof summary.secondaryText === 'string' && summary.secondaryText) {
        return this.formatRecentTaskSubtitleText(summary.secondaryText)
      }
      const parts = [
        task.bizType,
        task.taskType,
        task.source
      ].filter((item) => typeof item === 'string' && item)
      if (!parts.length) {
        return '服装 AI 出图'
      }
      const labels = parts
        .map((item) => this.formatRecentTaskTokenLabel(item))
        .filter(Boolean)
        .filter((item, index, list) => list.indexOf(item) === index)
      return labels.length ? labels.join(' / ') : '服装 AI 出图'
    },
    formatRecentTaskSubtitleText(value = '') {
      const text = String(value || '').trim()
      if (!text) {
        return '服装 AI 出图'
      }
      const tokens = text.indexOf('/') >= 0 ? text.split('/') : [text]
      const labels = tokens
        .map((item) => this.formatRecentTaskTokenLabel(item))
        .filter(Boolean)
        .filter((item, index, list) => list.indexOf(item) === index)
      return labels.length ? labels.join(' / ') : '服装 AI 出图'
    },
    formatRecentTaskTokenLabel(token = '') {
      const raw = String(token || '').trim()
      if (!raw) {
        return ''
      }
      const normalized = raw.toLowerCase().replace(/[\s-]+/g, '_')
      const tokenMap = {
        female: '女装',
        women: '女装',
        woman: '女装',
        male: '男装',
        men: '男装',
        man: '男装',
        kids: '童装',
        child: '童装',
        children: '童装',
        simple: '简约棚拍',
        white: '白底图',
        main: '电商主图',
        scene: '场景图',
        model: '换模特',
        color: '换颜色',
        style: '微改款',
        miniapp: '小程序',
        success: '已完成',
        processing: '生成中',
        failed: '生成失败'
      }
      if (tokenMap[normalized]) {
        return tokenMap[normalized]
      }
      if (/[\u4e00-\u9fa5]/.test(raw)) {
        return raw
      }
      return ''
    },
    formatRecentTaskStatus(task = {}) {
      return getTaskStatusMeta(this.getRecentTaskStatusValue(task)).label
    },
    getRecentTaskStatusClass(task = {}) {
      const status = this.getRecentTaskStatusValue(task)
      if (status === 'success' || status === 'completed') {
        return 'is-completed'
      }
      if (status === 'processing' || status === 'generating' || status === 'running') {
        return 'is-generating'
      }
      if (status === 'failed' || status === 'error') {
        return 'is-failed'
      }
      return 'is-pending'
    },
    resolveLegacyTaskThumbnail(task = {}) {
      const result = task.result || {}
      const data = task.data || {}
      const input = task.input || {}
      const assets = input.assets || {}
      const clothImage = assets.clothImage || input.clothImage || task.clothImage || {}
      const directUrl =
        this.resolveRecentTaskThumbnail(task) ||
        result.coverUrl ||
        result.thumbnailUrl ||
        result.imageUrl ||
        data.resultImageUrl ||
        data.result_image_url ||
        data.coverUrl ||
        data.thumbnailUrl ||
        data.imageUrl ||
        task.sourceImageUrl ||
        task.clothImageUrl ||
        input.sourceImageUrl ||
        input.clothImageUrl ||
        this.getNestedImageValue(clothImage) ||
        ''
      return /^cloud:\/\//.test(String(directUrl || '')) ? '' : String(directUrl || '')
    },
  }
}
</script>

<style scoped>
.container {
  min-height: 100vh;
  background: #f4f7fb;
  padding: 20rpx 24rpx 32rpx;
  box-sizing: border-box;
}

/* #ifdef MP-WEIXIN */
.container {
  padding-bottom: calc(150rpx + env(safe-area-inset-bottom));
}
/* #endif */

.site-nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24rpx;
  max-width: 1200px;
  margin: 0 auto 28rpx;
  padding: 24rpx 0;
}

.site-brand {
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.site-logo {
  width: 54rpx;
  height: 54rpx;
}

.site-brand-name {
  font-size: 34rpx;
  font-weight: 700;
  color: #162033;
}

.site-nav-links {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 14rpx;
}

.site-nav-item {
  padding: 12rpx 18rpx;
  border-radius: 12rpx;
  font-size: 24rpx;
  color: #4b5563;
}

.site-nav-item.active {
  color: #1677ff;
  background: #eaf4ff;
}

.site-nav-item.cta {
  color: #fff;
  background: #1677ff;
}

.site-hero,
.site-section,
.site-final-cta {
  max-width: 1200px;
  margin: 0 auto 28rpx;
}

.site-hero {
  display: flex;
  align-items: stretch;
  gap: 28rpx;
  min-height: 520rpx;
}

.site-hero-copy,
.site-hero-visual,
.site-section,
.site-final-cta {
  background: #fff;
  border-radius: 20rpx;
  padding: 40rpx;
  box-sizing: border-box;
}

.site-hero-copy {
  flex: 1.35;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.site-hero-visual {
  flex: 0.85;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  background: #eef7ff;
}

.site-eyebrow {
  display: block;
  font-size: 24rpx;
  color: #1677ff;
  font-weight: 600;
}

.site-title {
  display: block;
  margin-top: 18rpx;
  font-size: 58rpx;
  line-height: 1.18;
  font-weight: 700;
  color: #111827;
}

.site-desc {
  display: block;
  margin-top: 24rpx;
  max-width: 760rpx;
  font-size: 28rpx;
  line-height: 1.8;
  color: #4b5563;
}

.site-actions {
  display: flex;
  gap: 16rpx;
  margin-top: 32rpx;
}

.site-primary-btn,
.site-secondary-btn {
  margin: 0;
  min-width: 220rpx;
  height: 84rpx;
  line-height: 84rpx;
  border-radius: 12rpx;
  font-size: 28rpx;
}

.site-primary-btn {
  background: #1677ff;
  color: #fff;
}

.site-secondary-btn {
  background: #eef6ff;
  color: #1677ff;
}

.site-hero-image {
  width: 160rpx;
  height: 160rpx;
}

.site-visual-title {
  display: block;
  margin-top: 26rpx;
  font-size: 32rpx;
  font-weight: 700;
  color: #1f2937;
  text-align: center;
}

.site-visual-desc {
  display: block;
  margin-top: 12rpx;
  font-size: 24rpx;
  line-height: 1.7;
  color: #4b5563;
  text-align: center;
}

.site-section-head {
  margin-bottom: 24rpx;
}

.site-section-title {
  display: block;
  font-size: 36rpx;
  font-weight: 700;
  color: #111827;
}

.site-section-desc {
  display: block;
  margin-top: 10rpx;
  font-size: 26rpx;
  line-height: 1.7;
  color: #6b7280;
}

.site-service-grid,
.site-case-list,
.site-flow {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 18rpx;
}

.site-case-list {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.site-service-item,
.site-case-item,
.site-flow-item {
  background: #f8fafc;
  border-radius: 16rpx;
  padding: 24rpx;
}

.site-service-title,
.site-case-title,
.site-flow-title {
  display: block;
  font-size: 28rpx;
  font-weight: 700;
  color: #1f2937;
}

.site-service-desc,
.site-case-desc,
.site-flow-desc {
  display: block;
  margin-top: 12rpx;
  font-size: 24rpx;
  line-height: 1.7;
  color: #5f6b7a;
}

.site-case-tag,
.site-flow-step {
  display: inline-block;
  margin-bottom: 14rpx;
  padding: 6rpx 12rpx;
  border-radius: 8rpx;
  background: #eaf4ff;
  color: #1677ff;
  font-size: 22rpx;
}

.site-enterprise-case-section {
  background: linear-gradient(180deg, #ffffff, #f8fafc);
}

.site-enterprise-case-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 18rpx;
}

.site-enterprise-case-item {
  min-width: 0;
  padding: 20rpx;
  border: 1rpx solid rgba(22, 119, 255, 0.1);
  border-radius: 16rpx;
  background: rgba(255, 255, 255, 0.86);
  box-shadow: 0 12rpx 34rpx rgba(31, 72, 128, 0.045);
  box-sizing: border-box;
}

.site-enterprise-case-visual {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10rpx;
  height: 210rpx;
}

.site-enterprise-case-before,
.site-enterprise-case-after {
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 14rpx;
  color: #334155;
  font-size: 22rpx;
  font-weight: 800;
  text-align: center;
}

.site-enterprise-case-before {
  background: linear-gradient(145deg, #f8fafc, #e2e8f0);
}

.site-enterprise-case-after {
  background:
    radial-gradient(circle at 76% 18%, rgba(22, 119, 255, 0.2), transparent 30%),
    linear-gradient(145deg, #eef4ff, #ffffff 55%, #f5f3ff);
}

.site-enterprise-case-company,
.site-enterprise-case-title {
  display: block;
}

.site-enterprise-case-company {
  margin-top: 16rpx;
  color: #1677ff;
  font-size: 22rpx;
  font-weight: 800;
}

.site-enterprise-case-title {
  margin-top: 8rpx;
  color: #162033;
  font-size: 28rpx;
  font-weight: 800;
  line-height: 1.35;
}

.site-enterprise-case-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8rpx;
  margin-top: 12rpx;
}

.site-enterprise-case-meta text {
  padding: 6rpx 10rpx;
  border-radius: 999rpx;
  background: #eef4ff;
  color: #1677ff;
  font-size: 20rpx;
  font-weight: 700;
}

.site-enterprise-section {
  background:
    radial-gradient(circle at 12% 0%, rgba(22, 119, 255, 0.1), transparent 32%),
    linear-gradient(180deg, #ffffff, #f8fbff);
}

.site-enterprise-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 18rpx;
}

.site-enterprise-item {
  min-width: 0;
  padding: 24rpx;
  border: 1rpx solid rgba(22, 119, 255, 0.12);
  border-radius: 16rpx;
  background: rgba(255, 255, 255, 0.82);
  box-shadow: 0 12rpx 34rpx rgba(31, 72, 128, 0.045);
  box-sizing: border-box;
}

.site-enterprise-title {
  display: block;
  font-size: 28rpx;
  font-weight: 800;
  color: #162033;
}

.site-enterprise-desc {
  display: block;
  margin-top: 12rpx;
  min-height: 116rpx;
  font-size: 23rpx;
  line-height: 1.62;
  color: #5f6b7a;
}

.site-enterprise-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8rpx;
  margin-top: 16rpx;
}

.site-enterprise-tag {
  padding: 6rpx 10rpx;
  border-radius: 999rpx;
  background: #eef4ff;
  color: #1677ff;
  font-size: 20rpx;
  font-weight: 700;
}

.enterprise-demand-btn {
  margin: 24rpx 0 0;
}

.site-service-plan-section {
  background:
    radial-gradient(circle at 88% 8%, rgba(22, 119, 255, 0.1), transparent 30%),
    linear-gradient(180deg, #ffffff, #f8fbff);
}

.site-service-plan-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 18rpx;
}

.site-service-plan-item {
  min-width: 0;
  padding: 24rpx;
  border: 1rpx solid rgba(22, 119, 255, 0.12);
  border-radius: 16rpx;
  background: rgba(255, 255, 255, 0.88);
  box-shadow: 0 12rpx 34rpx rgba(31, 72, 128, 0.045);
  box-sizing: border-box;
}

.site-service-plan-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14rpx;
}

.site-service-plan-name,
.site-service-plan-target {
  display: block;
}

.site-service-plan-name {
  color: #162033;
  font-size: 29rpx;
  font-weight: 820;
  line-height: 1.35;
}

.site-service-plan-price {
  flex-shrink: 0;
  padding: 7rpx 11rpx;
  border-radius: 999rpx;
  background: #eef4ff;
  color: #1677ff;
  font-size: 20rpx;
  font-weight: 800;
}

.site-service-plan-target {
  margin-top: 14rpx;
  min-height: 112rpx;
  color: #5f6b7a;
  font-size: 23rpx;
  line-height: 1.62;
}

.site-service-plan-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8rpx;
  margin-top: 16rpx;
}

.site-service-plan-tags text {
  padding: 6rpx 10rpx;
  border-radius: 999rpx;
  background: #eef4ff;
  color: #1677ff;
  font-size: 20rpx;
  font-weight: 700;
}

.site-service-plan-btn {
  width: 100%;
  height: 66rpx;
  line-height: 66rpx;
  margin: 20rpx 0 0;
  border-radius: 999rpx;
  background: #162033;
  color: #ffffff;
  font-size: 24rpx;
  font-weight: 800;
}

.site-trust-section {
  background:
    radial-gradient(circle at 10% 0%, rgba(22, 119, 255, 0.1), transparent 30%),
    linear-gradient(180deg, #ffffff, #f8fafc);
}

.site-trust-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 14rpx;
}

.site-trust-item {
  min-width: 0;
  padding: 20rpx;
  border: 1rpx solid rgba(22, 119, 255, 0.1);
  border-radius: 16rpx;
  background: rgba(255, 255, 255, 0.88);
  box-shadow: 0 12rpx 34rpx rgba(31, 72, 128, 0.045);
  box-sizing: border-box;
}

.site-trust-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 46rpx;
  height: 46rpx;
  padding: 0 10rpx;
  border-radius: 14rpx;
  background: #162033;
  color: #ffffff;
  font-size: 20rpx;
  font-weight: 900;
  box-sizing: border-box;
}

.site-trust-title,
.site-trust-desc,
.site-flow-preview-title,
.site-flow-preview-desc {
  display: block;
}

.site-trust-title {
  margin-top: 14rpx;
  color: #162033;
  font-size: 26rpx;
  font-weight: 820;
  line-height: 1.35;
}

.site-trust-desc {
  margin-top: 10rpx;
  color: #5f6b7a;
  font-size: 21rpx;
  line-height: 1.55;
}

.site-flow-preview {
  display: grid;
  grid-template-columns: minmax(0, 0.58fr) minmax(0, 1fr) 220rpx;
  align-items: center;
  gap: 18rpx;
  margin-top: 20rpx;
  padding: 22rpx;
  border-radius: 18rpx;
  background: #162033;
  box-sizing: border-box;
}

.site-flow-preview-title {
  color: #ffffff;
  font-size: 28rpx;
  font-weight: 850;
}

.site-flow-preview-desc {
  margin-top: 8rpx;
  color: #cbd5e1;
  font-size: 22rpx;
  line-height: 1.55;
}

.site-flow-preview-steps {
  display: flex;
  flex-wrap: wrap;
  gap: 8rpx;
}

.site-flow-preview-steps text {
  padding: 7rpx 10rpx;
  border-radius: 999rpx;
  background: rgba(255, 255, 255, 0.1);
  color: #ffffff;
  font-size: 20rpx;
  font-weight: 760;
}

.trust-flow-btn {
  margin-top: 0;
  background: #ffffff;
  color: #162033;
}

.site-article-section {
  background:
    radial-gradient(circle at 88% 0%, rgba(22, 119, 255, 0.1), transparent 30%),
    linear-gradient(180deg, #ffffff, #f8fbff);
}

.site-article-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 18rpx;
}

.site-article-item {
  min-width: 0;
  padding: 24rpx;
  border: 1rpx solid rgba(22, 119, 255, 0.12);
  border-radius: 16rpx;
  background: rgba(255, 255, 255, 0.88);
  box-shadow: 0 12rpx 34rpx rgba(31, 72, 128, 0.045);
  box-sizing: border-box;
}

.site-article-category,
.site-article-title,
.site-article-summary {
  display: block;
}

.site-article-category {
  color: #1677ff;
  font-size: 22rpx;
  font-weight: 820;
}

.site-article-title {
  margin-top: 10rpx;
  color: #162033;
  font-size: 29rpx;
  font-weight: 850;
  line-height: 1.35;
}

.site-article-summary {
  margin-top: 12rpx;
  min-height: 112rpx;
  color: #5f6b7a;
  font-size: 23rpx;
  line-height: 1.62;
}

.site-article-keywords {
  display: flex;
  flex-wrap: wrap;
  gap: 8rpx;
  margin-top: 16rpx;
}

.site-article-keywords text {
  padding: 6rpx 10rpx;
  border-radius: 999rpx;
  background: #eef4ff;
  color: #1677ff;
  font-size: 20rpx;
  font-weight: 700;
}

@media screen and (max-width: 900px) {
  .site-enterprise-case-grid,
  .site-service-plan-grid,
  .site-trust-grid,
  .site-article-grid,
  .site-enterprise-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .site-flow-preview {
    grid-template-columns: 1fr;
  }
}

@media screen and (max-width: 640px) {
  .site-enterprise-case-grid,
  .site-service-plan-grid,
  .site-trust-grid,
  .site-article-grid,
  .site-enterprise-grid {
    grid-template-columns: 1fr;
  }

  .site-service-plan-target,
  .site-article-summary,
  .site-enterprise-desc {
    min-height: auto;
  }

  .enterprise-demand-btn {
    width: 100%;
  }
}

.site-final-cta {
  text-align: center;
  background: #111827;
}

.site-final-title {
  display: block;
  font-size: 38rpx;
  font-weight: 700;
  color: #fff;
}

.site-final-desc {
  display: block;
  margin-top: 12rpx;
  font-size: 26rpx;
  line-height: 1.7;
  color: #d1d5db;
}

.final-btn {
  margin: 28rpx auto 0;
}

.workbench-head,
.section-card {
  background: #fff;
  border-radius: 20rpx;
  padding: 28rpx 24rpx;
  margin-bottom: 20rpx;
  border: 1rpx solid rgba(226, 232, 240, 0.82);
  box-shadow: 0 10rpx 26rpx rgba(31, 72, 128, 0.045);
}

.workbench-head {
  position: relative;
  padding: 24rpx 22rpx 20rpx;
  margin-bottom: 18rpx;
  border-radius: 28rpx;
  background: #edf5ff;
  border: 0;
  box-shadow: 0 18rpx 42rpx rgba(29, 78, 216, 0.11);
  overflow: hidden;
}

.workbench-head::after {
  display: none;
}

.workbench-brand-lockup {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.workbench-label {
  display: inline-block;
  color: #155eef;
  font-size: 24rpx;
  font-weight: 900;
}

.workbench-product-name {
  padding-left: 12rpx;
  border-left: 1rpx solid rgba(21, 94, 239, 0.26);
  color: #475569;
  font-size: 22rpx;
  font-weight: 700;
}

.brand-name {
  position: relative;
  z-index: 1;
  display: block;
  max-width: 100%;
  margin-top: 16rpx;
  font-size: 38rpx;
  line-height: 1.2;
  font-weight: 700;
  color: #172554;
  white-space: nowrap;
}

.brand-subtitle {
  position: relative;
  z-index: 1;
  display: block;
  max-width: 620rpx;
  margin-top: 10rpx;
  font-size: 25rpx;
  line-height: 1.5;
  color: #52637a;
}

.workbench-actions {
  position: relative;
  z-index: 1;
  display: flex;
  margin-top: 18rpx;
}

.workbench-btn {
  height: 76rpx;
  line-height: 76rpx;
  margin: 0;
  padding: 0;
  border-radius: 17rpx;
  font-size: 28rpx;
  font-weight: 600;
}

.workbench-btn::after {
  border: 0;
}

.workbench-btn.primary {
  width: 100%;
  background: #155eef;
  color: #ffffff;
  box-shadow: 0 10rpx 24rpx rgba(21, 94, 239, 0.24);
}

.workbench-task-link {
  position: relative;
  z-index: 1;
  margin-top: 10rpx;
  color: #52637a;
  text-align: right;
  font-size: 23rpx;
  line-height: 1.45;
}

.legacy-workbench-head {
  padding: 18rpx 20rpx 15rpx;
  margin-bottom: 15rpx;
  background: linear-gradient(150deg, #edf5ff 0%, #f7faff 100%);
}

.legacy-workbench-head .brand-name {
  margin-top: 10rpx;
}

.legacy-workbench-head .brand-subtitle {
  margin-top: 6rpx;
}

.legacy-workbench-head .workbench-actions {
  margin-top: 14rpx;
}

.legacy-workbench-head .workbench-btn {
  height: 88rpx;
  line-height: 88rpx;
}

.legacy-workbench-head .workbench-task-link {
  margin-top: 7rpx;
}

.legacy-workbench-head .start-making-panel {
  margin-top: 12rpx;
  padding-top: 12rpx;
}

.legacy-workbench-head .start-goal-grid {
  margin-top: 10rpx;
}

.legacy-workbench-head .start-goal-button {
  min-height: 108rpx;
  padding: 12rpx 10rpx;
}

.legacy-attention-strip {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  gap: 10rpx;
  margin-top: 14rpx;
  min-height: 64rpx;
  padding: 8rpx 10rpx;
  border: 1rpx solid rgba(21, 94, 239, 0.12);
  border-radius: 14rpx;
  background: rgba(255, 255, 255, 0.72);
  box-sizing: border-box;
}

.legacy-attention-icon {
  display: flex;
  flex: 0 0 44rpx;
  align-items: center;
  justify-content: center;
  width: 44rpx;
  height: 44rpx;
  border-radius: 12rpx;
  background: #e5efff;
  color: #155eef;
  font-size: 18rpx;
  font-weight: 800;
}

.legacy-attention-copy {
  min-width: 0;
  flex: 1;
}

.legacy-attention-label {
  display: block;
  color: #334155;
  font-size: 21rpx;
  font-weight: 700;
}

.legacy-attention-value {
  display: block;
  margin-top: 2rpx;
  overflow: hidden;
  color: #64748b;
  font-size: 19rpx;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.legacy-attention-action {
  flex-shrink: 0;
  color: #155eef;
  font-size: 21rpx;
  font-weight: 700;
}

.start-making-panel {
  position: relative;
  z-index: 1;
  margin-top: 18rpx;
  padding-top: 18rpx;
  border-top: 1rpx solid rgba(21, 94, 239, 0.14);
}

.start-making-title,
.start-goal-title,
.start-result-title,
.start-result-desc,
.start-result-item-title,
.start-result-item-desc {
  display: block;
}

.start-making-title {
  color: #172554;
  font-size: 30rpx;
  font-weight: 700;
}

.start-goal-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10rpx;
  margin-top: 12rpx;
}

.start-goal-button {
  min-width: 0;
  min-height: 118rpx;
  padding: 14rpx 11rpx;
  border: 0;
  border-radius: 15rpx;
  background: rgba(255, 255, 255, 0.88);
  text-align: left;
  box-sizing: border-box;
  box-shadow: 0 5rpx 14rpx rgba(30, 64, 175, 0.055);
}

.start-goal-button:active {
  border-color: rgba(79, 70, 229, 0.4);
  background: #eef2ff;
  transform: scale(0.98);
}

.start-goal-title,
.start-goal-desc {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
}

.start-goal-title {
  color: #1f2937;
  font-size: 25rpx;
  font-weight: 700;
  white-space: nowrap;
}

.start-goal-desc {
  margin-top: 7rpx;
  color: #64748b;
  font-size: 21rpx;
  line-height: 1.4;
  white-space: nowrap;
}

.start-result-explanation {
  margin-top: 20rpx;
  padding-top: 18rpx;
  border-top: 1rpx solid rgba(148, 163, 184, 0.18);
}

.start-result-title {
  color: #1f2937;
  font-size: 26rpx;
  font-weight: 800;
}

.start-result-desc {
  margin-top: 5rpx;
  color: #64748b;
  font-size: 20rpx;
}

.start-result-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10rpx 18rpx;
  margin-top: 15rpx;
}

.start-result-item {
  min-width: 0;
  display: flex;
  align-items: flex-start;
  gap: 10rpx;
  padding: 10rpx 0;
}

.start-result-mark {
  flex: 0 0 38rpx;
  width: 38rpx;
  height: 38rpx;
  border-radius: 11rpx;
  background: rgba(79, 70, 229, 0.1);
  color: #4f46e5;
  text-align: center;
  font-size: 18rpx;
  font-weight: 900;
  line-height: 38rpx;
}

.start-result-copy {
  min-width: 0;
  flex: 1;
}

.start-result-item-title {
  color: #334155;
  font-size: 21rpx;
  font-weight: 800;
}

.start-result-item-desc {
  display: -webkit-box;
  margin-top: 3rpx;
  overflow: hidden;
  color: #7b8794;
  font-size: 17rpx;
  line-height: 1.35;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.section-head {
  margin-bottom: 14rpx;
}

.section-title {
  display: block;
  font-size: 32rpx;
  font-weight: 700;
  color: #1f2937;
}

.section-subtitle {
  display: block;
  margin-top: 6rpx;
  font-size: 23rpx;
  line-height: 1.5;
  color: #7b8794;
}

.quick-creation-kicker,
.quick-creation-title,
.quick-creation-desc,
.quick-creation-card-title,
.quick-creation-card-desc,
.production-case-title,
.production-case-desc {
  display: block;
}

.quick-creation-section {
  margin-bottom: 20rpx;
  padding: 24rpx;
  border: 1rpx solid rgba(226, 232, 240, 0.86);
  border-radius: 28rpx;
  background: linear-gradient(145deg, #ffffff 0%, #f8faff 72%, #f0fdfa 100%);
  box-shadow: 0 14rpx 34rpx rgba(15, 23, 42, 0.06);
}

.quick-creation-head {
  padding: 0 2rpx 18rpx;
}

.quick-creation-kicker {
  color: #4f46e5;
  font-size: 21rpx;
  font-weight: 700;
}

.quick-creation-title {
  margin-top: 7rpx;
  color: #111827;
  font-size: 32rpx;
  font-weight: 800;
}

.quick-creation-desc {
  margin-top: 7rpx;
  color: #6b7280;
  font-size: 22rpx;
  line-height: 1.5;
}

.quick-creation-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14rpx;
}

.quick-creation-card {
  min-height: 162rpx;
  padding: 18rpx;
  border: 1rpx solid rgba(79, 70, 229, 0.1);
  border-radius: 22rpx;
  background: rgba(255, 255, 255, 0.84);
  box-sizing: border-box;
  transition: transform 0.16s ease, border-color 0.16s ease, box-shadow 0.16s ease;
}

.quick-creation-card:active {
  transform: scale(0.982);
  border-color: rgba(79, 70, 229, 0.3);
  box-shadow: 0 9rpx 20rpx rgba(15, 23, 42, 0.08);
}

.quick-creation-card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10rpx;
}

.quick-creation-tag {
  padding: 5rpx 9rpx;
  border-radius: 999rpx;
  background: #eef2ff;
  color: #4f46e5;
  font-size: 18rpx;
  font-weight: 700;
}

.quick-creation-arrow {
  color: #94a3b8;
  font-size: 30rpx;
  line-height: 1;
}

.quick-creation-card-title {
  margin-top: 12rpx;
  color: #111827;
  font-size: 27rpx;
  font-weight: 800;
}

.quick-creation-card-desc {
  margin-top: 6rpx;
  color: #667085;
  font-size: 20rpx;
  line-height: 1.4;
}

.core-result-section {
  margin-bottom: 20rpx;
  padding: 26rpx 22rpx;
  border: 1rpx solid rgba(79, 70, 229, 0.14);
  border-radius: 28rpx;
  background: #ffffff;
  box-shadow: 0 14rpx 34rpx rgba(15, 23, 42, 0.07);
}

.core-result-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14rpx;
}

.core-result-card {
  min-height: 180rpx;
  padding: 20rpx;
  border: 1rpx solid rgba(79, 70, 229, 0.14);
  border-radius: 22rpx;
  background: #eef2ff;
  box-sizing: border-box;
  transition: transform 0.16s ease, box-shadow 0.16s ease;
}

.core-result-card.core-tone-2 { background: #eff6ff; }
.core-result-card.core-tone-3 { background: #ecfdf5; }
.core-result-card.core-tone-4 { background: #fff7ed; }

.core-result-card:active {
  transform: scale(0.98);
  box-shadow: 0 10rpx 22rpx rgba(15, 23, 42, 0.08);
}

.core-result-card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.core-result-mark {
  width: 50rpx;
  height: 50rpx;
  border-radius: 14rpx;
  background: rgba(79, 70, 229, 0.13);
  color: #4f46e5;
  text-align: center;
  font-size: 22rpx;
  font-weight: 900;
  line-height: 50rpx;
}

.core-result-arrow {
  color: #64748b;
  font-size: 34rpx;
  line-height: 1;
}

.core-result-title,
.core-result-desc {
  display: block;
}

.core-result-title {
  margin-top: 14rpx;
  color: #111827;
  font-size: 29rpx;
  font-weight: 900;
}

.core-result-desc {
  margin-top: 7rpx;
  color: #667085;
  font-size: 20rpx;
  line-height: 1.4;
}

.production-case-scroll {
  width: 100%;
  white-space: nowrap;
  scroll-snap-type: x mandatory;
}

.production-case-row {
  display: inline-flex;
  gap: 16rpx;
  padding-right: 70rpx;
}

.production-case-card {
  position: relative;
  width: 580rpx;
  padding: 18rpx;
  border: 1rpx solid rgba(226, 232, 240, 0.88);
  border-radius: 20rpx;
  background: #ffffff;
  box-sizing: border-box;
  scroll-snap-align: start;
  white-space: normal;
}

.production-case-demo-tag {
  position: absolute;
  top: 15rpx;
  right: 16rpx;
  padding: 4rpx 9rpx;
  border-radius: 999rpx;
  background: #f1f5f9;
  color: #64748b;
  font-size: 18rpx;
  line-height: 1.4;
}

.production-case-title,
.production-case-desc {
  display: block;
}

.production-case-title {
  color: #111827;
  font-size: 28rpx;
  font-weight: 700;
}

.production-case-compare {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10rpx;
  margin-top: 14rpx;
}

.production-case-image {
  overflow: hidden;
  height: 210rpx;
  border-radius: 15rpx;
  background: #f3f4f6;
}

.production-case-image.after {
  background: linear-gradient(145deg, #e0e7ff, #ecfeff 62%, #ffffff);
}

.production-case-real-image,
.production-case-placeholder {
  width: 100%;
  height: 100%;
}

.production-case-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 7rpx;
}

.production-case-placeholder-label {
  color: #334155;
  font-size: 24rpx;
  font-weight: 700;
}

.production-case-placeholder-copy {
  color: #94a3b8;
  font-size: 22rpx;
}

.production-case-desc {
  margin-top: 14rpx;
  color: #667085;
  font-size: 24rpx;
  line-height: 1.5;
}

.production-case-action {
  height: 64rpx;
  line-height: 64rpx;
  margin: 16rpx 0 0;
  padding: 0;
  border-radius: 14rpx;
  background: #111827;
  color: #ffffff;
  font-size: 24rpx;
  font-weight: 700;
}

.production-case-action::after {
  border: 0;
}

.production-case-swipe-hint {
  display: block;
  margin-top: 12rpx;
  color: #64748b;
  font-size: 21rpx;
  text-align: center;
}

.home-module {
  margin-bottom: 15rpx;
  padding: 22rpx;
  border-radius: 24rpx;
  box-sizing: border-box;
}

.service-entry-card {
  padding: 20rpx;
  border-radius: 24rpx;
}

.service-entry-title,
.service-entry-desc {
  display: block;
}

.service-entry-title {
  color: #1f2937;
  font-size: 28rpx;
  font-weight: 700;
}

.service-entry-desc {
  margin-top: 7rpx;
  color: #64748b;
  font-size: 23rpx;
  line-height: 1.5;
}

.service-entry-btn {
  height: 66rpx;
  margin: 12rpx 0 0;
  border-radius: 16rpx;
  background: #155eef;
  color: #ffffff;
  font-size: 24rpx;
  font-weight: 600;
  line-height: 66rpx;
}

.service-entry-btn::after {
  border: 0;
}

.production-tools-section {
  background: #ffffff;
  box-shadow: 0 8rpx 24rpx rgba(31, 72, 128, 0.04);
}

.task-center-section { padding: 22rpx; border: 1rpx solid rgba(79,70,229,.12); border-radius: 24rpx; background: #fff; }
.task-center-head, .task-center-title-row, .task-center-card { display: flex; align-items: center; }
.task-center-head { justify-content: space-between; gap: 18rpx; margin-bottom: 14rpx; }
.task-center-link { flex-shrink: 0; color: #4f46e5; font-size: 22rpx; font-weight: 700; }
.task-center-list { display: grid; gap: 10rpx; }
.task-center-card { gap: 14rpx; min-height: 92rpx; padding: 12rpx; border-radius: 16rpx; background: #f7f8fc; box-sizing: border-box; }
.task-center-preview, .task-center-preview image { width: 72rpx; height: 72rpx; border-radius: 14rpx; }
.task-center-preview { display: flex; flex: 0 0 auto; align-items: center; justify-content: center; overflow: hidden; background: #e9eafe; color: #4f46e5; font-size: 24rpx; font-weight: 800; }
.task-center-copy { min-width: 0; flex: 1; }
.task-center-title-row { gap: 10rpx; }
.task-center-title { min-width: 0; overflow: hidden; color: #172033; font-size: 24rpx; font-weight: 750; text-overflow: ellipsis; white-space: nowrap; }
.task-center-status { flex-shrink: 0; padding: 4rpx 8rpx; border-radius: 999rpx; background: #eff6ff; color: #2563eb; font-size: 18rpx; }
.task-center-status.tone-success { background: #ecfdf3; color: #16803c; }
.task-center-status.tone-failed { background: #fef2f2; color: #dc2626; }
.task-center-status.tone-warning { background: #fff7ed; color: #c2410c; }
.task-center-status.tone-muted { background: #f1f3f5; color: #687181; }
.task-center-progress, .task-center-time { display: block; margin-top: 4rpx; overflow: hidden; color: #687181; font-size: 19rpx; text-overflow: ellipsis; white-space: nowrap; }
.task-center-time { color: #9299a7; }
.task-center-action { flex: 0 0 auto; color: #4f46e5; font-size: 20rpx; font-weight: 700; }

.production-tool-groups {
  display: flex;
  flex-direction: column;
  gap: 14rpx;
}

.production-tool-group {
  min-width: 0;
}

.production-tool-group-title {
  display: block;
  color: #334155;
  margin-bottom: 10rpx;
  font-size: 25rpx;
  font-weight: 700;
  line-height: 1.4;
}

.production-tool-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16rpx;
}

.production-tool-button {
  min-width: 0;
  height: 108rpx;
  padding: 12rpx 15rpx;
  border: 1rpx solid rgba(148, 163, 184, 0.08);
  border-radius: 16rpx;
  background: #f8fafc;
  display: flex;
  align-items: center;
  gap: 10rpx;
  box-sizing: border-box;
}

.production-tool-button:active {
  opacity: 0.84;
  transform: scale(0.98);
}

.production-tool-button.unavailable {
  opacity: 0.62;
}

.production-tool-button.tool-tone-purple { background: #f7f5fb; }
.production-tool-button.tool-tone-blue { background: #f3f7fc; }
.production-tool-button.tool-tone-pink { background: #fcf5f8; }
.production-tool-button.tool-tone-green { background: #f4faf6; }
.production-tool-button.tool-tone-orange { background: #fcf7f1; }
.production-tool-button.tool-tone-red { background: #fcf5f4; }
.production-tool-button.tool-tone-cyan { background: #f2f9f9; }
.production-tool-button.tool-tone-yellow { background: #fcfaf1; }

.production-tool-icon {
  flex: 0 0 60rpx;
  width: 60rpx;
  height: 60rpx;
  border-radius: 14rpx;
  background: rgba(21, 94, 239, 0.1);
  color: #4f46e5;
  text-align: center;
  font-size: 20rpx;
  font-weight: 900;
  line-height: 60rpx;
}

.tool-tone-purple .production-tool-icon { background: rgba(124, 58, 237, 0.1); color: #6d28d9; }
.tool-tone-blue .production-tool-icon { background: rgba(37, 99, 235, 0.1); color: #2563eb; }
.tool-tone-pink .production-tool-icon { background: rgba(219, 39, 119, 0.1); color: #db2777; }
.tool-tone-green .production-tool-icon { background: rgba(22, 128, 60, 0.1); color: #16803c; }
.tool-tone-orange .production-tool-icon { background: rgba(217, 119, 6, 0.1); color: #d97706; }
.tool-tone-red .production-tool-icon { background: rgba(220, 38, 38, 0.09); color: #dc2626; }
.tool-tone-cyan .production-tool-icon { background: rgba(8, 145, 178, 0.1); color: #0891b2; }
.tool-tone-yellow .production-tool-icon { background: rgba(161, 98, 7, 0.09); color: #a16207; }

.production-tool-copy {
  min-width: 0;
  flex: 1;
}

.production-tool-title {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.production-tool-title {
  min-width: 0;
  color: #1f2937;
  font-size: 29rpx;
  font-weight: 600;
}

.advanced-tools-section {
  margin-bottom: 0;
  background: #f7f8fa;
  box-shadow: none;
}

.advanced-tool-title,
.advanced-tool-desc {
  display: block;
}

.advanced-section-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18rpx;
}

.advanced-module-tip {
  flex-shrink: 0;
  margin-top: 4rpx;
  color: #64748b;
  font-size: 20rpx;
  line-height: 1.4;
}

.advanced-tool-list {
  overflow: hidden;
  border: 1rpx solid #e8ebf0;
  border-radius: 16rpx;
  background: #ffffff;
}

.advanced-tool-item {
  min-height: 94rpx;
  padding: 15rpx 18rpx;
  border-bottom: 1rpx solid #edf0f4;
  background: #ffffff;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18rpx;
  box-sizing: border-box;
}

.advanced-tool-item:last-child {
  border-bottom: 0;
}

.advanced-tool-item:active {
  background: #f5f7fa;
}

.advanced-tool-copy {
  min-width: 0;
  flex: 1;
}

.advanced-tool-title {
  color: #1f2937;
  font-size: 25rpx;
  font-weight: 700;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.advanced-tool-desc {
  margin-top: 6rpx;
  overflow: hidden;
  color: #7b8492;
  font-size: 21rpx;
  line-height: 1.4;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.advanced-tool-arrow {
  flex: 0 0 28rpx;
  color: #94a3b8;
  font-size: 38rpx;
  font-weight: 300;
  line-height: 1;
  text-align: right;
}

.advanced-tool-toggle {
  height: 66rpx;
  margin: 14rpx 0 0;
  border: 0;
  border-radius: 12rpx;
  background: #eef1f5;
  color: #475569;
  font-size: 23rpx;
  line-height: 66rpx;
}

.advanced-tool-toggle::after {
  border: 0;
}

.advanced-tool-toggle-arrow {
  margin-left: 8rpx;
  color: #64748b;
}

.main-function-section {
  margin-bottom: 20rpx;
  padding: 22rpx;
  border: 1rpx solid rgba(226, 232, 240, 0.8);
  border-radius: 28rpx;
  background: linear-gradient(180deg, #ffffff 0%, #f8faff 100%);
  box-shadow: 0 12rpx 30rpx rgba(15, 23, 42, 0.05);
}

.main-function-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12rpx;
  margin-top: 16rpx;
}

.main-function-grid.more {
  margin-top: 12rpx;
}

.main-function-card {
  position: relative;
  min-height: 132rpx;
  padding: 16rpx;
  border: 1rpx solid rgba(226, 232, 240, 0.78);
  border-radius: 20rpx;
  background: #f8fafc;
  box-sizing: border-box;
  overflow: hidden;
  transition: transform 0.16s ease, border-color 0.16s ease, box-shadow 0.16s ease;
}

.main-function-card:active {
  transform: scale(0.982);
  border-color: rgba(79, 70, 229, 0.26);
  box-shadow: 0 10rpx 22rpx rgba(15, 23, 42, 0.07);
}

.main-function-card.tone-indigo {
  background: #eef2ff;
}

.main-function-card.tone-violet {
  background: #f5f3ff;
}

.main-function-card.tone-rose {
  background: #fff1f2;
}

.main-function-card.tone-blue {
  background: #eff6ff;
}

.main-function-card.tone-emerald {
  background: #ecfdf5;
}

.main-function-card.tone-orange {
  background: #fff7ed;
}

.main-function-card.tone-amber {
  background: #fffbeb;
}

.main-function-card.tone-cyan {
  background: #ecfeff;
}

.main-function-card.tone-slate {
  background: #f1f5f9;
}

.main-function-card.tone-purple {
  background: #faf5ff;
}

.main-function-tag,
.main-function-icon,
.main-function-title,
.main-function-desc {
  display: block;
}

.main-function-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10rpx;
}

.main-function-icon {
  width: 46rpx;
  height: 46rpx;
  border-radius: 16rpx;
  background: rgba(79, 70, 229, 0.14);
  color: #4f46e5;
  text-align: center;
  line-height: 46rpx;
  font-size: 22rpx;
  font-weight: 900;
}

.tone-rose .main-function-icon {
  background: rgba(225, 29, 72, 0.12);
  color: #be123c;
}

.tone-blue .main-function-icon,
.tone-cyan .main-function-icon {
  background: rgba(37, 99, 235, 0.12);
  color: #2563eb;
}

.tone-emerald .main-function-icon {
  background: rgba(5, 150, 105, 0.12);
  color: #047857;
}

.tone-orange .main-function-icon,
.tone-amber .main-function-icon {
  background: rgba(234, 88, 12, 0.12);
  color: #c2410c;
}

.tone-slate .main-function-icon {
  background: rgba(51, 65, 85, 0.1);
  color: #334155;
}

.main-function-tag {
  width: fit-content;
  padding: 4rpx 9rpx;
  border-radius: 999rpx;
  background: rgba(255, 255, 255, 0.72);
  color: #475569;
  font-size: 18rpx;
  font-weight: 800;
}

.main-function-title {
  margin-top: 12rpx;
  color: #111827;
  font-size: 29rpx;
  font-weight: 800;
}

.main-function-desc {
  margin-top: 5rpx;
  color: #6b7280;
  font-size: 20rpx;
  line-height: 1.35;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.main-function-more-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 16rpx;
  padding: 16rpx 18rpx;
  border-radius: 18rpx;
  background: rgba(248, 250, 252, 0.92);
  color: #4b5563;
  font-size: 23rpx;
  font-weight: 800;
}

.production-cases-section {
  background: #ffffff;
  border: 1rpx solid rgba(226, 232, 240, 0.84);
  box-shadow: 0 8rpx 24rpx rgba(31, 72, 128, 0.04);
}

.production-flow-source {
  padding: 22rpx;
  border: 1rpx solid rgba(79, 70, 229, 0.16);
  border-radius: 20rpx;
  background: #f5f3ff;
  text-align: center;
}

.production-flow-kicker,
.production-flow-source-title,
.production-flow-source-desc,
.production-result-index,
.production-result-tag,
.production-result-action {
  display: block;
}

.production-flow-kicker {
  color: #6d5bd0;
  font-size: 19rpx;
  font-weight: 700;
}

.production-flow-source-title {
  margin-top: 7rpx;
  color: #111827;
  font-size: 29rpx;
  font-weight: 800;
}

.production-flow-source-desc {
  margin-top: 5rpx;
  color: #6b7280;
  font-size: 21rpx;
}

.production-flow-arrow {
  display: flex;
  align-items: center;
  flex-direction: column;
  gap: 2rpx;
  padding: 10rpx 0;
  color: #7c3aed;
  font-size: 20rpx;
  font-weight: 700;
}

.production-result-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12rpx;
}

.production-result-card {
  min-height: 180rpx;
  padding: 18rpx;
  border: 1rpx solid rgba(226, 232, 240, 0.9);
  border-radius: 20rpx;
  background: #ffffff;
  box-sizing: border-box;
  transition: transform 0.16s ease, border-color 0.16s ease;
}

.production-result-card:active {
  transform: scale(0.98);
  border-color: rgba(79, 70, 229, 0.3);
}

.production-result-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10rpx;
  margin-bottom: 12rpx;
}

.production-result-index {
  color: #7c3aed;
  font-size: 20rpx;
  font-weight: 800;
}

.production-result-tag {
  padding: 4rpx 9rpx;
  border-radius: 999rpx;
  background: #f3f4f6;
  color: #6b7280;
  font-size: 17rpx;
}

.production-result-action {
  margin-top: 13rpx;
  color: #4f46e5;
  font-size: 20rpx;
  font-weight: 700;
}

.scene-section {
  margin-top: 22rpx;
}

.development-section {
  border: 2rpx solid #dbeafe;
}

.material-section {
  border: 2rpx solid #dcfce7;
}

.scene-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16rpx;
}

.scene-card {
  min-height: 230rpx;
  padding: 24rpx 20rpx;
  border-radius: 18rpx;
  background: #f7f9fc;
  border: 2rpx solid #e9eef5;
  box-sizing: border-box;
}

.scene-card:first-child {
  background: #eef6ff;
  border-color: #cfe2ff;
}

.development-card {
  background: #f8fbff;
  border-color: #dbeafe;
}

.material-card {
  background: #f8fffb;
  border-color: #bbf7d0;
}

.scene-title {
  display: block;
  font-size: 32rpx;
  font-weight: 700;
  color: #1f2937;
}

.scene-desc {
  display: block;
  margin-top: 10rpx;
  min-height: 70rpx;
  font-size: 24rpx;
  line-height: 1.5;
  color: #667085;
}

.scene-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8rpx;
  margin-top: 16rpx;
}

.scene-tag {
  padding: 6rpx 10rpx;
  border-radius: 8rpx;
  background: #e6f4ff;
  color: #1677ff;
  font-size: 20rpx;
}

.ability-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12rpx;
}

.ability-item {
  position: relative;
  display: flex;
  flex-direction: column;
  min-height: 96rpx;
  padding: 12rpx 14rpx;
  border-radius: 16rpx;
  background: linear-gradient(145deg, #ffffff 0%, #f8fbff 100%);
  border: 1rpx solid rgba(226, 232, 240, 0.92);
  box-shadow: 0 6rpx 14rpx rgba(31, 72, 128, 0.04);
  box-sizing: border-box;
  overflow: hidden;
  transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease;
}

.ability-item:active {
  transform: scale(0.985);
  border-color: rgba(22, 119, 255, 0.22);
  box-shadow: 0 8rpx 18rpx rgba(31, 72, 128, 0.07);
}

.ability-item::after {
  content: '';
  position: absolute;
  right: -22rpx;
  top: -28rpx;
  width: 64rpx;
  height: 64rpx;
  border-radius: 999rpx;
  background: rgba(22, 119, 255, 0.055);
}

.ability-card-head {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: flex-end;
}

.ability-output {
  max-width: 108rpx;
  padding: 5rpx 9rpx;
  border-radius: 999rpx;
  background: rgba(255, 255, 255, 0.78);
  color: #667085;
  font-size: 19rpx;
  line-height: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ability-model {
  background: linear-gradient(145deg, #ffffff 0%, #f0f6ff 100%);
  border-color: rgba(79, 70, 229, 0.14);
}

.ability-color {
  background: linear-gradient(145deg, #ffffff 0%, #fff3ed 100%);
  border-color: rgba(249, 115, 22, 0.15);
}

.ability-scene {
  background: linear-gradient(145deg, #ffffff 0%, #edfaff 100%);
  border-color: rgba(8, 145, 178, 0.14);
}

.ability-remix {
  background: linear-gradient(145deg, #ffffff 0%, #f5f3ff 100%);
  border-color: rgba(124, 58, 237, 0.14);
}

.ability-copy {
  position: relative;
  z-index: 1;
  margin-top: 10rpx;
}

.ability-title {
  display: block;
  font-size: 28rpx;
  font-weight: 800;
  line-height: 1.2;
  color: #111827;
}

.recent-generation-section {
  margin-bottom: 20rpx;
  padding: 22rpx;
  border: 1rpx solid rgba(226, 232, 240, 0.82);
  border-radius: 24rpx;
  background: #ffffff;
  box-shadow: 0 10rpx 26rpx rgba(31, 72, 128, 0.05);
}

.recent-generation-head,
.recent-generation-card,
.recent-generation-content,
.recent-generation-empty {
  display: flex;
  align-items: center;
}

.recent-generation-head {
  justify-content: space-between;
  margin-bottom: 16rpx;
}

.recent-generation-title,
.recent-generation-empty-title {
  display: block;
  color: #111827;
  font-size: 28rpx;
  font-weight: 800;
}

.recent-generation-link {
  color: #4f46e5;
  font-size: 22rpx;
  font-weight: 700;
}

.recent-generation-card {
  gap: 16rpx;
  padding: 12rpx;
  border-radius: 18rpx;
  background: #f7f8fc;
}

.recent-generation-card:active {
  transform: scale(0.99);
}

.recent-generation-cover,
.recent-generation-image,
.recent-generation-placeholder {
  width: 112rpx;
  height: 112rpx;
  border-radius: 14rpx;
}

.recent-generation-cover {
  flex-shrink: 0;
  overflow: hidden;
}

.recent-generation-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(145deg, #eef2ff 0%, #ecfeff 100%);
  color: #4f46e5;
  font-size: 25rpx;
  font-weight: 800;
}

.recent-generation-content {
  min-width: 0;
  flex: 1;
  align-items: flex-start;
  flex-direction: column;
  gap: 10rpx;
}

.recent-generation-type {
  max-width: 100%;
  overflow: hidden;
  color: #111827;
  font-size: 25rpx;
  font-weight: 750;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.recent-generation-status {
  padding: 5rpx 10rpx;
  border-radius: 999rpx;
  background: #f3f4f6;
  color: #6b7280;
  font-size: 19rpx;
  font-weight: 700;
}

.recent-generation-status.is-completed {
  background: #ecfdf3;
  color: #16803c;
}

.recent-generation-status.is-generating {
  background: #eff6ff;
  color: #2563eb;
}

.recent-generation-status.is-failed {
  background: #fef2f2;
  color: #dc2626;
}

.recent-generation-arrow {
  flex-shrink: 0;
  color: #94a3b8;
  font-size: 34rpx;
}

.recent-generation-empty {
  justify-content: space-between;
  gap: 18rpx;
  padding: 18rpx;
  border-radius: 18rpx;
  background: linear-gradient(145deg, #f8faff 0%, #f8fafc 100%);
}

.recent-generation-empty-desc {
  display: block;
  margin-top: 6rpx;
  color: #6b7280;
  font-size: 21rpx;
  line-height: 1.45;
}

.recent-generation-empty-action {
  flex-shrink: 0;
  width: 236rpx;
  height: 64rpx;
  line-height: 64rpx;
  margin: 0;
  padding: 0 14rpx;
  border-radius: 16rpx;
  background: #4f46e5;
  color: #ffffff;
  font-size: 21rpx;
  font-weight: 700;
}

.recent-generation-empty-action::after {
  border: 0;
}

.tool-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 22rpx;
  margin-top: 24rpx;
}

.tool-item {
  min-height: 250rpx;
  padding: 28rpx 22rpx;
  border-radius: 18rpx;
  background: #f7f9fc;
  border: 2rpx solid #e9eef5;
  box-sizing: border-box;
}

.tool-card {
  position: relative;
  min-height: 214rpx;
  padding: 24rpx 22rpx;
  border-radius: 20rpx;
  background: linear-gradient(145deg, #ffffff 0%, #f3f8ff 100%);
  border: 1rpx solid rgba(22, 119, 255, 0.14);
  box-shadow: 0 16rpx 34rpx rgba(31, 72, 128, 0.085);
  box-sizing: border-box;
  overflow: hidden;
  transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease;
}

.tool-card:active {
  transform: scale(0.982);
  border-color: rgba(22, 119, 255, 0.28);
  box-shadow: 0 18rpx 38rpx rgba(31, 72, 128, 0.12);
}

.tool-item.primary,
.tool-card:first-child {
  background: linear-gradient(145deg, #eef6ff 0%, #ffffff 100%);
  border-color: #cfe2ff;
}

.tool-card-head {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10rpx;
}

.tool-badge {
  max-width: 92rpx;
  padding: 8rpx 13rpx;
  border-radius: 999rpx;
  background: #1f2937;
  color: #ffffff;
  font-size: 22rpx;
  line-height: 1;
  font-weight: 700;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tool-lite-tag {
  max-width: 100rpx;
  padding: 7rpx 10rpx;
  border-radius: 999rpx;
  background: #f1f5f9;
  color: #475467;
  font-size: 20rpx;
  line-height: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tool-card:nth-child(1) .tool-badge {
  background: #2563eb;
}

.tool-card:nth-child(2) .tool-badge {
  background: #e11d48;
}

.tool-card:nth-child(3) .tool-badge {
  background: #475569;
}

.tool-card:nth-child(4) .tool-badge {
  background: #16a34a;
}

.tool-card:nth-child(5) .tool-badge {
  background: #0891b2;
}

.tool-card:nth-child(6) .tool-badge {
  background: #7c3aed;
}

.tool-card:nth-child(7) .tool-badge {
  background: #6b7280;
}

.tool-card:nth-child(8) .tool-badge {
  background: #f97316;
}

.tool-title {
  position: relative;
  z-index: 1;
  display: block;
  margin-top: 20rpx;
  font-size: 30rpx;
  font-weight: 800;
  color: #111827;
}

.tool-desc {
  position: relative;
  z-index: 1;
  display: block;
  margin-top: 12rpx;
  font-size: 23rpx;
  line-height: 1.45;
  color: #475467;
}

.more-tools-section {
  background: #fbfcff;
  box-shadow: 0 6rpx 16rpx rgba(31, 72, 128, 0.035);
}

.more-tool-grid {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}

.more-tool-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
  padding: 16rpx 18rpx;
  border-radius: 12rpx;
  background: #f8fafc;
  border: 1rpx solid rgba(233, 238, 245, 0.9);
}

.more-tool-main {
  min-width: 0;
  flex: 1;
}

.more-tool-title {
  display: block;
  font-size: 26rpx;
  font-weight: 700;
  color: #344054;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.more-tool-desc {
  display: block;
  margin-top: 6rpx;
  font-size: 22rpx;
  line-height: 1.45;
  color: #7b8794;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.more-tool-badge {
  flex-shrink: 0;
  padding: 6rpx 10rpx;
  border-radius: 999rpx;
  background: #eef2ff;
  color: #4f46e5;
  font-size: 20rpx;
}

.more-tool-toggle {
  margin-top: 16rpx;
  height: 70rpx;
  line-height: 70rpx;
  border-radius: 14rpx;
  background: #f2f4f7;
  color: #475467;
  font-size: 24rpx;
}

.quick-list,
.recent-list {
  display: flex;
  flex-direction: column;
  gap: 14rpx;
}

.quick-item,
.recent-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
  padding: 22rpx 20rpx;
  border-radius: 16rpx;
  background: #f7f9fc;
}

.recent-main {
  min-width: 0;
  flex: 1;
}

.recent-thumb {
  flex-shrink: 0;
  width: 96rpx;
  height: 96rpx;
  border-radius: 14rpx;
  background: #eef2f6;
  overflow: hidden;
}

.empty-thumb {
  display: flex;
  align-items: center;
  justify-content: center;
  color: #9aa4b2;
  font-size: 24rpx;
}

.quick-title,
.recent-title {
  display: block;
  font-size: 28rpx;
  font-weight: 600;
  color: #1f2937;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.quick-desc,
.recent-subtitle,
.recent-meta {
  display: block;
  margin-top: 8rpx;
  font-size: 24rpx;
  line-height: 1.6;
  color: #667085;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.recent-meta {
  font-size: 22rpx;
  color: #1677ff;
}

.empty-card {
  padding: 22rpx 20rpx;
  border-radius: 16rpx;
  background: #f7f9fc;
}

.empty-desc {
  display: block;
  font-size: 24rpx;
  line-height: 1.6;
  color: #667085;
}

.history-btn {
  margin-top: 16rpx;
  height: 76rpx;
  line-height: 76rpx;
  border-radius: 14rpx;
  background: #e6f4ff;
  color: #1677ff;
  font-size: 26rpx;
}

.quick-arrow {
  flex-shrink: 0;
  font-size: 24rpx;
  color: #1677ff;
}

.onboarding-mask {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 80;
  display: flex;
  align-items: flex-end;
  background: rgba(17, 24, 39, 0.42);
}

.onboarding-sheet {
  width: 100%;
  padding: 18rpx 28rpx calc(28rpx + env(safe-area-inset-bottom));
  border-radius: 32rpx 32rpx 0 0;
  background: #ffffff;
  box-sizing: border-box;
  box-shadow: 0 -18rpx 50rpx rgba(15, 23, 42, 0.16);
}

.onboarding-handle {
  width: 72rpx;
  height: 8rpx;
  margin: 0 auto 24rpx;
  border-radius: 999rpx;
  background: #d1d5db;
}

.onboarding-kicker,
.onboarding-title,
.onboarding-example-title {
  display: block;
}

.onboarding-kicker {
  color: #4f46e5;
  font-size: 22rpx;
  font-weight: 800;
}

.onboarding-title {
  margin-top: 8rpx;
  color: #111827;
  font-size: 36rpx;
  font-weight: 900;
}

.onboarding-steps {
  display: grid;
  gap: 12rpx;
  margin-top: 24rpx;
}

.onboarding-step {
  display: flex;
  align-items: center;
  gap: 14rpx;
  color: #374151;
  font-size: 24rpx;
}

.onboarding-step-index {
  flex: 0 0 auto;
  width: 44rpx;
  height: 44rpx;
  border-radius: 14rpx;
  background: #eef2ff;
  color: #4f46e5;
  font-size: 21rpx;
  font-weight: 900;
  line-height: 44rpx;
  text-align: center;
}

.onboarding-example {
  margin-top: 24rpx;
  padding: 20rpx;
  border-radius: 20rpx;
  background: #f8fafc;
}

.onboarding-example-title {
  color: #6b7280;
  font-size: 21rpx;
}

.onboarding-example-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 10rpx;
  margin-top: 12rpx;
}

.onboarding-example-tags text {
  padding: 8rpx 12rpx;
  border-radius: 999rpx;
  background: #ffffff;
  color: #4338ca;
  font-size: 20rpx;
}

.onboarding-primary,
.onboarding-secondary {
  width: 100%;
  margin: 18rpx 0 0;
  border: 0;
  border-radius: 18rpx;
  font-size: 25rpx;
}

.onboarding-primary {
  height: 76rpx;
  background: #4f46e5;
  color: #ffffff;
  font-weight: 800;
  line-height: 76rpx;
}

.onboarding-secondary {
  height: 58rpx;
  background: transparent;
  color: #6b7280;
  line-height: 58rpx;
}

.onboarding-primary::after,
.onboarding-secondary::after {
  border: 0;
}
/* Rendered PNG visual resources for recommendation cards */
.tool-card-image {
  position: absolute;
  right: 14rpx;
  bottom: 14rpx;
  width: 118rpx;
  height: 118rpx;
  border-radius: 24rpx;
  opacity: 0.26;
  pointer-events: none;
  z-index: 0;
}

.tool-card:nth-child(2n) .tool-card-image {
  opacity: 0.3;
}

.tool-card:nth-child(3n) .tool-card-image,
.tool-card:nth-child(4n) .tool-card-image {
  opacity: 0.24;
}

/* MP-WEIXIN home workbench V2 */
.workbench-v2-head {
  padding: 24rpx;
  background: linear-gradient(145deg, #edf5ff 0%, #f7f9ff 100%);
}

.workbench-topline,
.section-head-row,
.workbench-status-row,
.attention-actions {
  display: flex;
  align-items: center;
}

.workbench-topline,
.section-head-row {
  justify-content: space-between;
  gap: 16rpx;
}

.workbench-profile {
  display: flex;
  flex: 0 0 64rpx;
  align-items: center;
  justify-content: center;
  width: 64rpx;
  height: 64rpx;
  overflow: hidden;
  border: 2rpx solid rgba(21, 94, 239, 0.14);
  border-radius: 50%;
  background: #ffffff;
  color: #155eef;
  font-size: 20rpx;
  font-weight: 800;
}

.workbench-profile image {
  width: 100%;
  height: 100%;
}

.workbench-v2-head .brand-name {
  margin-top: 18rpx;
  font-size: 40rpx;
  white-space: normal;
}

.workbench-v2-head .brand-subtitle {
  max-width: 610rpx;
  font-size: 24rpx;
  line-height: 1.55;
}

.workbench-status-row {
  gap: 12rpx;
  margin-top: 18rpx;
}

.workbench-status-pill {
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: space-between;
  min-width: 0;
  min-height: 66rpx;
  padding: 0 16rpx;
  border: 1rpx solid rgba(21, 94, 239, 0.12);
  border-radius: 16rpx;
  background: rgba(255, 255, 255, 0.82);
  box-sizing: border-box;
}

.workbench-status-pill.alert {
  border-color: rgba(220, 38, 38, 0.16);
  background: #fff7f7;
}

.status-pill-label {
  color: #64748b;
  font-size: 21rpx;
}

.status-pill-value {
  overflow: hidden;
  color: #172554;
  font-size: 22rpx;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.workbench-v2-head .workbench-btn {
  margin-top: 18rpx;
}

.workbench-goal-row {
  display: flex;
  align-items: center;
  gap: 10rpx;
  margin-top: 14rpx;
  overflow: hidden;
}

.workbench-goal-label,
.workbench-goal-item {
  flex-shrink: 0;
  font-size: 20rpx;
}

.workbench-goal-label { color: #7b8798; }

.workbench-goal-item {
  padding: 7rpx 11rpx;
  border-radius: 999rpx;
  background: rgba(255, 255, 255, 0.84);
  color: #155eef;
  font-weight: 700;
}

.core-capability-section,
.more-tools-section,
.attention-section,
.recent-works-section {
  border: 1rpx solid rgba(226, 232, 240, 0.84);
  background: #ffffff;
  box-shadow: 0 8rpx 24rpx rgba(31, 72, 128, 0.04);
}

.section-head-row > view:first-child {
  min-width: 0;
}

.core-capability-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12rpx;
}

.core-capability-card {
  position: relative;
  min-width: 0;
  min-height: 190rpx;
  padding: 18rpx;
  border: 1rpx solid rgba(148, 163, 184, 0.12);
  border-radius: 20rpx;
  background: #f5f7fb;
  box-sizing: border-box;
}

.core-capability-card.tool-tone-purple { background: #f6f3fc; }
.core-capability-card.tool-tone-blue { background: #f1f6fd; }
.core-capability-card.tool-tone-green { background: #f1f8f4; }
.core-capability-card.tool-tone-red { background: #fbf3f4; }
.core-capability-card.unavailable,
.more-capability-card.unavailable { opacity: 0.58; }

.core-capability-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 58rpx;
  height: 58rpx;
  padding: 0 10rpx;
  border-radius: 15rpx;
  background: rgba(79, 70, 229, 0.1);
  color: #4f46e5;
  font-size: 20rpx;
  font-weight: 850;
  box-sizing: border-box;
}

.core-capability-name,
.core-capability-desc,
.draft-title,
.draft-desc,
.more-capability-name,
.more-capability-desc,
.recent-work-card text {
  display: block;
}

.core-capability-name {
  margin-top: 14rpx;
  color: #172033;
  font-size: 28rpx;
  font-weight: 750;
}

.core-capability-desc {
  margin-top: 7rpx;
  color: #64748b;
  font-size: 21rpx;
  line-height: 1.45;
}

.capability-state {
  position: absolute;
  top: 18rpx;
  right: 16rpx;
  color: #8b94a3;
  font-size: 19rpx;
}

.draft-card {
  display: flex;
  align-items: center;
  gap: 14rpx;
  min-height: 92rpx;
  padding: 14rpx;
  border-radius: 18rpx;
  background: #eef4ff;
  box-sizing: border-box;
}

.draft-icon {
  display: flex;
  flex: 0 0 56rpx;
  align-items: center;
  justify-content: center;
  width: 56rpx;
  height: 56rpx;
  border-radius: 15rpx;
  background: #155eef;
  color: #ffffff;
  font-size: 22rpx;
  font-weight: 800;
}

.draft-copy { min-width: 0; flex: 1; }
.draft-title { overflow: hidden; color: #172554; font-size: 24rpx; font-weight: 750; text-overflow: ellipsis; white-space: nowrap; }
.draft-desc { margin-top: 5rpx; color: #64748b; font-size: 20rpx; }
.draft-action { flex-shrink: 0; color: #155eef; font-size: 21rpx; font-weight: 700; }

.attention-actions {
  gap: 10rpx;
  margin-top: 12rpx;
}

.attention-action {
  display: flex;
  flex: 1;
  align-items: center;
  gap: 8rpx;
  min-height: 62rpx;
  padding: 0 14rpx;
  border-radius: 15rpx;
  background: #f6f8fb;
  color: #475569;
  font-size: 21rpx;
  box-sizing: border-box;
}

.attention-action.danger { background: #fff5f5; color: #b42318; }
.attention-count { color: #155eef; font-size: 28rpx; font-weight: 800; }
.attention-action.danger .attention-count { color: #dc2626; }

.more-tools-toggle {
  flex-shrink: 0;
  color: #155eef;
  font-size: 22rpx;
  font-weight: 700;
}

.more-capability-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10rpx;
}

.more-capability-card {
  display: flex;
  align-items: center;
  gap: 10rpx;
  min-width: 0;
  min-height: 104rpx;
  padding: 13rpx;
  border: 1rpx solid #edf0f4;
  border-radius: 17rpx;
  background: #f8fafc;
  box-sizing: border-box;
}

.more-capability-icon {
  display: flex;
  flex: 0 0 50rpx;
  align-items: center;
  justify-content: center;
  width: 50rpx;
  height: 50rpx;
  border-radius: 13rpx;
  background: #e9eef8;
  color: #47607d;
  font-size: 18rpx;
  font-weight: 800;
}

.more-capability-icon.tone-purple { background: #eee9fb; color: #6d28d9; }
.more-capability-icon.tone-blue { background: #e7f0fb; color: #2563eb; }
.more-capability-icon.tone-green { background: #e7f5ec; color: #16803c; }
.more-capability-icon.tone-cyan { background: #e5f5f6; color: #087f8c; }
.more-capability-icon.tone-yellow { background: #faf3d9; color: #92700c; }
.more-capability-icon.tone-orange { background: #faeddf; color: #b45309; }
.more-capability-icon.tone-pink { background: #faeaf1; color: #be185d; }

.more-capability-copy { min-width: 0; flex: 1; }
.more-capability-name { overflow: hidden; color: #263244; font-size: 23rpx; font-weight: 700; text-overflow: ellipsis; white-space: nowrap; }
.more-capability-desc { margin-top: 5rpx; overflow: hidden; color: #7a8595; font-size: 19rpx; text-overflow: ellipsis; white-space: nowrap; }
.more-capability-arrow { flex-shrink: 0; color: #a0a8b5; font-size: 28rpx; }

.recent-work-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10rpx;
}

.recent-work-card {
  min-width: 0;
  overflow: hidden;
  border: 1rpx solid #edf0f4;
  border-radius: 16rpx;
  background: #f8fafc;
}

.recent-work-card image {
  display: block;
  width: 100%;
  height: 152rpx;
  background: #edf0f4;
}

.recent-work-card text {
  overflow: hidden;
  padding: 10rpx;
  color: #475569;
  font-size: 20rpx;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media screen and (max-width: 350px) {
  .core-capability-card { min-height: 204rpx; padding: 15rpx; }
  .core-capability-name { font-size: 26rpx; }
  .core-capability-desc { font-size: 20rpx; }
  .more-capability-card { min-height: 108rpx; padding: 11rpx; }
  .more-capability-name { font-size: 21rpx; }
  .more-capability-desc { font-size: 18rpx; }
  .workbench-status-pill { padding: 0 12rpx; }
}
</style>
