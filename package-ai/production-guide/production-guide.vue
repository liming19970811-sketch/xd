<template>
  <view class="guide-page">
    <view class="hero-card">
      <text class="eyebrow">AI服装生产中心</text>
      <text class="page-title">按生产目标开始</text>
      <text class="page-subtitle">先明确要做什么，再上传资料，系统会推荐合适的商品素材方案。</text>
    </view>

    <view class="guide-progress">
      <view v-for="step in guideSteps" :key="step.index" class="guide-progress-item" :class="{ current: currentGuideStep === step.index, completed: isGuideStepCompleted(step.index) }">
        <text class="guide-progress-index">{{ isGuideStepCompleted(step.index) ? '✓' : step.index }}</text>
        <text class="guide-progress-label">{{ step.label }}</text>
      </view>
    </view>

    <view class="step-card" :class="{ 'is-current': currentGuideStep === 1, 'is-completed': isGuideStepCompleted(1) }">
      <view class="step-head">
        <text class="step-index">步骤1</text>
        <text class="step-title">选择目标</text>
      </view>
      <view class="goal-grid">
        <view
          v-for="goal in goals"
          :key="goal.value"
          class="goal-card"
          :class="{ active: selectedGoal === goal.value }"
          @tap="selectGoal(goal.value)"
        >
          <text class="goal-title">{{ goal.title }}</text>
          <text class="goal-desc">{{ goal.desc }}</text>
        </view>
      </view>
    </view>

    <view class="step-card" :class="{ 'is-current': currentGuideStep === 2, 'is-completed': isGuideStepCompleted(2) }">
      <view class="step-head">
        <text class="step-index">步骤2</text>
        <text class="step-title">上传资料</text>
      </view>
      <text class="section-desc">{{ currentGoal.uploadTip }}</text>
      <view class="upload-grid">
        <view
          v-for="item in uploadItems"
          :key="item.key"
          class="upload-item"
          :class="{ uploaded: uploadFiles[item.key] }"
          @tap="chooseGuideImage(item.key)"
        >
          <image v-if="uploadFiles[item.key]" class="upload-thumb" :src="uploadFiles[item.key]" mode="aspectFill" />
          <view v-else class="upload-empty">
            <text class="upload-plus">+</text>
            <text class="upload-name">{{ item.title }}</text>
            <text class="upload-tip">{{ item.tip }}</text>
          </view>
          <view v-if="uploadFiles[item.key]" class="upload-label">{{ item.title }}</view>
        </view>
      </view>
    </view>

    <view class="step-card" :class="{ 'is-current': currentGuideStep === 3, 'is-completed': isGuideStepCompleted(3) }">
      <view class="step-head">
        <text class="step-index">步骤3</text>
        <text class="step-title">查看 AI 推荐</text>
      </view>
      <text class="section-desc">根据你的生产目标，推荐以下制作方案。</text>
      <view class="plan-grid">
        <view
          v-for="plan in currentGoal.plans"
          :key="plan.key"
          class="plan-card"
          :class="{ active: selectedPlanKey === plan.key }"
          @tap="selectPlan(plan.key)"
        >
          <text class="plan-label">{{ plan.label }}</text>
          <text class="plan-title">{{ plan.title }}</text>
          <text class="plan-desc">{{ plan.scene }}</text>
          <text class="plan-tool">预计生成 {{ getPlanExpectedOutputCount(plan) }} 个独立结果</text>
        </view>
      </view>
      <view class="plan-preview">
        <view class="plan-preview-head">
          <view>
            <text class="preview-label">当前选择</text>
            <text class="preview-title">{{ selectedPlan.title }}</text>
          </view>
          <text v-if="adoptedPlanKey === selectedPlan.key" class="adopted-badge">已采用</text>
        </view>
        <view class="preview-row">
          <text class="preview-key">适用场景</text>
          <text class="preview-value">{{ selectedPlan.scene }}</text>
        </view>
        <view class="preview-row preview-row-top">
          <text class="preview-key">预计生成内容</text>
          <view class="output-tags">
            <text
              v-for="item in getPlanDisplayItems(selectedPlan)"
              :key="item.itemType || item.name"
              class="output-tag"
              :class="{ unavailable: item.available === false }"
            >{{ item.title || item.name }} × {{ item.quantity || 1 }}{{ item.available === false ? ' · 暂不可用' : '' }}</text>
          </view>
        </view>
        <view class="preview-row">
          <text class="preview-key">预计消耗</text>
          <text class="preview-value">{{ getPlanEstimatedCost(selectedPlan) }} AI点</text>
        </view>
        <button class="adopt-btn" @tap="adoptPlan">采用方案</button>
      </view>
    </view>

    <view class="step-card final-card" :class="{ 'is-current': currentGuideStep === 4 }">
      <view class="step-head">
        <text class="step-index">步骤4</text>
        <text class="step-title">开始生成</text>
      </view>
      <view class="final-summary">
        <view>
          <text>生产目标</text>
          <text>{{ currentGoal.title }}</text>
        </view>
        <view>
          <text>推荐方案</text>
          <text>{{ adoptedPlan ? adoptedPlan.title : '请先采用方案' }}</text>
        </view>
        <view>
          <text>已上传资料</text>
          <text>{{ uploadedCount }} 项</text>
        </view>
      </view>
      <view v-if="adoptedPlan" class="batch-confirmation">
        <text class="batch-confirmation-title">本次将生成</text>
        <view class="batch-confirmation-list">
          <text v-for="item in adoptedPlanExecutableItems" :key="item.deliverableId || item.itemType || item.key" class="batch-confirmation-item">{{ item.title || item.name }} × {{ item.quantity || 1 }}</text>
        </view>
        <view class="batch-confirmation-total">
          <text>合计</text><text>{{ adoptedPlanExpectedOutputCount }} 个独立结果</text>
        </view>
        <view class="batch-confirmation-total">
          <text>预计消耗</text><text>{{ adoptedPlanEstimatedCost }} AI点</text>
        </view>
        <view class="batch-confirmation-total muted">
          <text>当前剩余额度</text><text>{{ quotaAvailable ? `${quotaRemaining} AI点` : '暂时无法获取' }}</text>
        </view>
      </view>
      <button
        class="start-btn"
        :class="{ disabled: !adoptedPlan || !uploadFiles.cloth || isStartingBatch || quotaInsufficient }"
        :disabled="!adoptedPlan || !uploadFiles.cloth || isStartingBatch || quotaInsufficient"
        @tap="startWorkbench"
      >{{ startButtonLabel }}</button>
      <text v-if="quotaInsufficient" class="quota-warning">当前额度不足，请减少交付数量或前往会员中心查看额度。</text>
    </view>
  </view>
</template>

<script>
import {
  createWorkspaceProductionBatch,
  getProductionPlanDefinition
} from '../../utils/workspace/workspaceProduction'
import { getEstimatedQuotaCost, getExpectedOutputCount, validateDeliverables } from '../../utils/task/multiResultExecutor'
import { getMembershipUsage } from '../../utils/member/membershipRepository'
import { AI_POINT_ACTION_TYPES, getAiPointCost } from '../../utils/constants/aiPointCost'

const TOOL_EXECUTION_MAP = Object.freeze({
  model: Object.freeze({ taskType: 'model_replace', outputType: 'model_image', quotaAction: AI_POINT_ACTION_TYPES.AI_MODEL_IMAGE }),
  scene: Object.freeze({ taskType: 'scene_replace', outputType: 'scene_image', quotaAction: AI_POINT_ACTION_TYPES.BASIC_BACKGROUND }),
  marketing: Object.freeze({ taskType: 'marketing_asset', outputType: 'marketing_image', quotaAction: AI_POINT_ACTION_TYPES.DETAIL_LONG_IMAGE }),
  flat_lay: Object.freeze({ taskType: 'flat_lay_generate', outputType: 'flat_lay_image', quotaAction: AI_POINT_ACTION_TYPES.BASIC_BACKGROUND }),
  refine: Object.freeze({ taskType: 'style_redesign', outputType: 'style_redesign_image', quotaAction: AI_POINT_ACTION_TYPES.HOT_STYLE_REMIX }),
  color: Object.freeze({ taskType: 'color_replace', outputType: 'color_replace_image', quotaAction: AI_POINT_ACTION_TYPES.BASIC_RECOLOR }),
  fabric: Object.freeze({ taskType: 'fabric_variation', outputType: 'fabric_replace_image', quotaAction: AI_POINT_ACTION_TYPES.FABRIC_REPLACE }),
  pattern: Object.freeze({ taskType: 'pattern_variation', outputType: 'pattern_replace_image', quotaAction: AI_POINT_ACTION_TYPES.PRINT_GENERATE })
})

function inferOutputToolType(title = '', fallback = '') {
  const value = String(title || '')
  if (/模特/.test(value)) return 'model'
  if (/场景/.test(value)) return 'scene'
  if (/平铺|白底|商品主图/.test(value)) return 'flat_lay'
  if (/面料/.test(value)) return 'fabric'
  if (/图案|印花|纹样/.test(value)) return 'pattern'
  if (/颜色|配色/.test(value)) return 'color'
  if (/详情|海报|宣传|卖点|种草|封面|配图|视觉/.test(value)) return 'marketing'
  return fallback || 'refine'
}

const QUICK_LAUNCH_DEFINITION = getProductionPlanDefinition('quick_launch')

const PRODUCTION_GOALS = [
  {
    value: 'product_launch',
    title: '商品展示',
    desc: '做上架图、白底图、详情页和细节素材',
    uploadTip: '建议上传服装图片，补充款式参考图可提升商品展示一致性。',
    plans: [
      {
        key: QUICK_LAUNCH_DEFINITION.planId,
        label: '方案 A',
        title: QUICK_LAUNCH_DEFINITION.title,
        scene: '新品快速上架与基础商品展示',
        outputs: QUICK_LAUNCH_DEFINITION.items.map((item) => item.name),
        items: QUICK_LAUNCH_DEFINITION.items,
        actions: QUICK_LAUNCH_DEFINITION.items.map((item) => ({
          key: item.itemType,
          title: item.name,
          toolType: item.toolType,
          actionType: item.actionType,
          available: item.available
        }))
      },
      {
        key: 'product_brand_showcase', label: '方案 B', title: '品牌展示', scene: '品牌新品发布与形象内容制作',
        outputs: ['高级模特图', '场景图', '宣传图'],
        actions: [
          { key: 'model_image', title: '高级模特图', toolType: 'model' },
          { key: 'scene_image', title: '场景图', toolType: 'scene' },
          { key: 'poster', title: '宣传图', toolType: 'marketing' }
        ]
      },
      {
        key: 'product_complete_package', label: '方案 C', title: '完整商品包', scene: '一次准备完整商品上新素材',
        outputs: ['模特图', '平铺细节图', '详情页', '海报'],
        actions: [
          { key: 'model_image', title: '模特图', toolType: 'model' },
          { key: 'display_image', title: '平铺细节图', toolType: 'flat_lay' },
          { key: 'detail_page', title: '详情页', toolType: 'marketing' },
          { key: 'poster', title: '海报', toolType: 'marketing' }
        ]
      }
    ]
  },
  {
    value: 'new_design',
    title: '新品开发',
    desc: '验证颜色、款式、图案和面料方向',
    uploadTip: '建议上传服装图片，可补充款式参考图或设计参考图。',
    plans: [
      {
        key: 'design_micro_change', label: '方案 A', title: '微改款', scene: '保留原款识别度，轻量调整设计细节',
        outputs: ['款式微调方案', '颜色建议', '设计参考图'],
        actions: [{ key: 'micro_change', title: '微改款', toolType: 'refine' }]
      },
      {
        key: 'design_bestseller_derivative', label: '方案 B', title: '爆款衍生', scene: '围绕成熟款式拓展新品方向',
        outputs: ['衍生款式', '面料方案', '图案方案'],
        actions: [{ key: 'bestseller_derivative', title: '爆款衍生', toolType: 'refine' }]
      },
      {
        key: 'design_brand_upgrade', label: '方案 C', title: '品牌升级', scene: '统一品牌风格并提升系列质感',
        outputs: ['品牌化款式', '配色方案', '系列设计方向'],
        actions: [{ key: 'brand_upgrade', title: '品牌升级', toolType: 'refine' }]
      }
    ]
  },
  {
    value: 'marketing',
    title: '营销宣传',
    desc: '做场景图、海报和系列宣传内容',
    uploadTip: '建议上传服装图片，品牌素材和设计参考图可后续在制作工具中补充。',
    plans: [
      {
        key: 'marketing_detail_page', label: '方案 A', title: '电商详情页', scene: '商品上架、卖点表达与转化展示',
        outputs: ['商品主图', '卖点图', '详情页素材'],
        actions: [{ key: 'detail_page', title: '电商详情页', toolType: 'marketing' }]
      },
      {
        key: 'marketing_social_seed', label: '方案 B', title: '小红书种草', scene: '生活方式内容与社交平台种草',
        outputs: ['种草封面', '场景内容图', '系列配图'],
        actions: [{ key: 'social_seed', title: '小红书种草', toolType: 'marketing' }]
      },
      {
        key: 'marketing_brand_campaign', label: '方案 C', title: '品牌宣传大片', scene: '品牌活动、新品发布与形象传播',
        outputs: ['品牌海报', '宣传大片', '系列视觉'],
        actions: [{ key: 'brand_campaign', title: '品牌宣传大片', toolType: 'marketing' }]
      }
    ]
  }
]

const UPLOAD_ITEMS = [
  { key: 'cloth', title: '服装图片', tip: '必备' },
  { key: 'styleRef', title: '款式参考图', tip: '可选' },
  { key: 'designRef', title: '设计参考图', tip: '可选' }
]

const TARGET_MAP = {
  product_launch: 'product_launch',
  'product-images': 'product_launch',
  new_design: 'new_design',
  'new-design': 'new_design',
  marketing: 'marketing',
  'brand-marketing': 'marketing'
}

const PRODUCTION_CONTEXT_STORAGE_KEY = 'diebiandesign_production_context'

const GUIDE_STEPS = Object.freeze([
  Object.freeze({ index: 1, label: '选择目标' }),
  Object.freeze({ index: 2, label: '上传资料' }),
  Object.freeze({ index: 3, label: '查看推荐' }),
  Object.freeze({ index: 4, label: '开始生成' })
])

export default {
  data() {
    return {
      selectedGoal: 'product_launch',
      selectedPlanKey: '',
      adoptedPlanKey: '',
      uploadFiles: {
        cloth: '',
        styleRef: '',
        designRef: ''
      },
      goals: PRODUCTION_GOALS,
      uploadItems: UPLOAD_ITEMS,
      guideSteps: GUIDE_STEPS,
      isStartingBatch: false,
      productionSubmissionKey: '',
      quotaAvailable: false,
      quotaRemaining: 0
    }
  },
  computed: {
    currentGoal() {
      return this.goals.find((item) => item.value === this.selectedGoal) || this.goals[0]
    },
    selectedPlan() {
      return this.currentGoal.plans.find((item) => item.key === this.selectedPlanKey) || this.currentGoal.plans[0]
    },
    adoptedPlan() {
      return this.currentGoal.plans.find((item) => item.key === this.adoptedPlanKey) || null
    },
    uploadedCount() {
      return Object.keys(this.uploadFiles).filter((key) => this.uploadFiles[key]).length
    },
    adoptedPlanExecutableItems() {
      return this.getExecutablePlanItems(this.adoptedPlan)
    },
    adoptedPlanExpectedOutputCount() {
      return getExpectedOutputCount(this.adoptedPlanExecutableItems)
    },
    adoptedPlanEstimatedCost() {
      return getEstimatedQuotaCost(this.adoptedPlanExecutableItems)
    },
    quotaInsufficient() {
      return this.quotaAvailable && this.adoptedPlanEstimatedCost > this.quotaRemaining
    },
    startButtonLabel() {
      if (this.isStartingBatch) return '正在创建生产批次...'
      if (this.adoptedPlan) return `确认生成${this.adoptedPlanExpectedOutputCount}个独立结果`
      return '请先确认AI方案'
    },
    currentGuideStep() {
      if (!this.selectedGoal) return 1
      if (!this.uploadFiles.cloth) return 2
      if (!this.adoptedPlan) return 3
      return 4
    },
    productionContext() {
      const plan = this.adoptedPlan || this.selectedPlan
      const recommendedActions = (plan.actions || []).map((item) => ({ ...item }))
      return {
        contextId: `production_context_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        productionType: this.currentGoal.title,
        productionTypeValue: this.selectedGoal,
        assets: this.uploadItems
          .filter((item) => this.uploadFiles[item.key])
          .map((item) => ({
            key: item.key,
            title: item.title,
            url: this.uploadFiles[item.key]
          })),
        selectedPlanId: plan.key,
        selectedPlanName: plan.title,
        deliverables: this.getExecutablePlanItems(plan).map((item) => ({ ...item })),
        expectedOutputCount: this.getPlanExpectedOutputCount(plan),
        recommendedActions,
        recommendedTools: recommendedActions.map((item) => item.toolType),
        selectedAction: recommendedActions[0] || null,
        updatedAt: new Date().toISOString()
      }
    }
  },
  onLoad(query = {}) {
    const incoming = String(query.target || query.workspaceIntent || query.guideId || '').trim()
    const goal = TARGET_MAP[incoming] || 'product_launch'
    this.selectGoal(goal)
    this.refreshQuotaSummary()
  },
  onShow() {
    this.refreshQuotaSummary()
  },
  methods: {
    isQuickLaunchPlan(plan = {}) {
      return plan && (plan.key === 'quick_launch' || plan.key === 'product_quick_launch')
    },
    getPlanDisplayItems(plan = {}) {
      return this.getPlanDeliverables(plan)
    },
    getPlanDeliverables(plan = {}) {
      if (!plan) return []
      if (Array.isArray(plan.items) && plan.items.length) {
        return plan.items.map((item) => ({ ...item, quantity: Math.max(1, Number(item.quantity) || 1) }))
      }
      const actions = Array.isArray(plan.actions) ? plan.actions : []
      const outputs = Array.isArray(plan.outputs) ? plan.outputs : []
      const deliverableCount = Math.max(actions.length, outputs.length)
      return Array.from({ length: deliverableCount }, (_, index) => {
        const item = actions[index] || (actions.length === 1 ? actions[0] : {})
        const title = outputs[index] || item.title || `交付结果 ${index + 1}`
        const toolType = inferOutputToolType(title, item.toolType)
        const execution = TOOL_EXECUTION_MAP[toolType] || null
        const stableKey = actions[index] ? item.key : `${item.key || plan.key || 'output'}_${index + 1}`
        return {
          deliverableId: `${plan.key || 'plan'}_${stableKey || index + 1}`,
          itemType: stableKey || `${plan.key || 'plan'}_${index + 1}`,
          outputType: execution ? execution.outputType : '',
          title,
          name: title,
          quantity: 1,
          ratio: item.toolType === 'model' ? '3:4' : '1:1',
          scene: plan.scene || '',
          purpose: this.currentGoal.title,
          prompt: `生成独立的${title}，用于${plan.scene || this.currentGoal.title}`,
          promptDraft: `生成独立的${title}，用于${plan.scene || this.currentGoal.title}`,
          status: 'pending',
          taskType: execution ? execution.taskType : '',
          actionType: execution ? execution.taskType : '',
          toolType,
          quotaAction: execution ? execution.quotaAction : '',
          unitCost: execution ? getAiPointCost(execution.quotaAction) : 0,
          available: item.available !== false && Boolean(execution),
          unavailableReason: execution ? '' : '当前交付类型尚未接入真实生成任务'
        }
      })
    },
    getExecutablePlanItems(plan = {}) {
      return this.getPlanDeliverables(plan).filter((item) => item.available !== false && item.taskType)
    },
    getPlanExpectedOutputCount(plan = {}) {
      return getExpectedOutputCount(this.getExecutablePlanItems(plan))
    },
    getPlanEstimatedCost(plan = {}) {
      return getEstimatedQuotaCost(this.getExecutablePlanItems(plan))
    },
    refreshQuotaSummary() {
      const usage = getMembershipUsage()
      this.quotaAvailable = Boolean(usage && usage.ok && usage.data && usage.data.available)
      this.quotaRemaining = this.quotaAvailable ? Math.max(0, Number(usage.data.remaining) || 0) : 0
    },
    isGuideStepCompleted(stepIndex) {
      return Number(stepIndex) < this.currentGuideStep
    },
    selectGoal(goal) {
      this.selectedGoal = TARGET_MAP[goal] || goal || 'product_launch'
      this.selectedPlanKey = (this.currentGoal.plans[0] && this.currentGoal.plans[0].key) || ''
      this.adoptedPlanKey = ''
    },
    selectPlan(planKey) {
      this.selectedPlanKey = planKey
      if (this.adoptedPlanKey !== planKey) {
        this.adoptedPlanKey = ''
      }
    },
    adoptPlan() {
      const validation = validateDeliverables(this.getExecutablePlanItems(this.selectedPlan))
      if (!validation.ok) {
        uni.showToast({ title: validation.message, icon: 'none' })
        return
      }
      this.adoptedPlanKey = this.selectedPlan.key
      this.productionSubmissionKey = `production_submit_${this.selectedPlan.key}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
      uni.showToast({ title: `已采用${this.selectedPlan.title}`, icon: 'none' })
    },
    chooseGuideImage(key) {
      uni.chooseImage({
        count: 1,
        sizeType: ['compressed'],
        sourceType: ['album', 'camera'],
        success: (res) => {
          const paths = res.tempFilePaths || []
          this.uploadFiles = {
            ...this.uploadFiles,
            [key]: paths[0] || ''
          }
        }
      })
    },
    startWorkbench() {
      const plan = this.adoptedPlan
      if (!plan) {
        uni.showToast({ title: '请先采用一个方案', icon: 'none' })
        return
      }
      if (!this.uploadFiles.cloth) {
        uni.showToast({ title: '请先上传服装图片', icon: 'none' })
        return
      }
      if (this.quotaInsufficient) {
        uni.showToast({ title: '当前额度不足，请先调整方案', icon: 'none' })
        return
      }
      const context = this.productionContext
      uni.setStorageSync(`${PRODUCTION_CONTEXT_STORAGE_KEY}_${context.contextId}`, context)
      this.startProductionBatch(context)
    },
    startProductionBatch(context = {}) {
      if (this.isStartingBatch) return
      this.isStartingBatch = true
      try {
        const created = createWorkspaceProductionBatch({
          planId: this.adoptedPlan.key,
          plan: {
            ...this.adoptedPlan,
            planId: this.adoptedPlan.key,
            guideId: this.selectedGoal,
            category: this.currentGoal.title,
            entryType: (context.selectedAction && context.selectedAction.toolType) || 'model',
            items: this.adoptedPlanExecutableItems,
            outputCount: this.adoptedPlanExpectedOutputCount
          },
          submissionKey: this.productionSubmissionKey,
          assets: {
            cloth: this.uploadFiles.cloth,
            style: this.uploadFiles.styleRef,
            design: this.uploadFiles.designRef
          },
          params: {
            workspaceIntent: this.selectedGoal,
            productionContextId: context.contextId
          }
        })
        const taskId = created.batch.taskIds[0] || ''
        const query = [
          `taskId=${encodeURIComponent(taskId)}`,
          `batchId=${encodeURIComponent(created.batch.batchId)}`,
          `historyId=${encodeURIComponent(created.history.historyId)}`
        ].join('&')
        uni.navigateTo({ url: `/package-ai/result/result?${query}` })
      } catch (error) {
        uni.showToast({
          title: error && error.message === 'CLOTH_IMAGE_REQUIRED' ? '请先上传服装图片' : '生产批次创建失败，请重试',
          icon: 'none'
        })
      } finally {
        this.isStartingBatch = false
      }
    }
  }
}
</script>

<style scoped>
.guide-page {
  min-height: 100vh;
  padding: 24rpx 24rpx 64rpx;
  background: #f6f7fb;
  box-sizing: border-box;
}

.hero-card,
.step-card {
  border-radius: 32rpx;
  background: #ffffff;
  box-shadow: 0 16rpx 40rpx rgba(15, 23, 42, 0.07);
  box-sizing: border-box;
}

.hero-card {
  padding: 32rpx;
  margin-bottom: 22rpx;
  background: linear-gradient(135deg, #ffffff 0%, #f3f4ff 62%, #ecfeff 100%);
}

.guide-progress {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8rpx;
  margin-bottom: 22rpx;
  padding: 18rpx 12rpx;
  border-radius: 24rpx;
  background: #ffffff;
  box-shadow: 0 10rpx 28rpx rgba(15, 23, 42, 0.05);
}

.guide-progress-item {
  display: flex;
  min-width: 0;
  align-items: center;
  flex-direction: column;
  gap: 7rpx;
  color: #9ca3af;
  text-align: center;
}

.guide-progress-index {
  width: 42rpx;
  height: 42rpx;
  border-radius: 50%;
  background: #f3f4f6;
  font-size: 20rpx;
  font-weight: 900;
  line-height: 42rpx;
}

.guide-progress-label {
  overflow: hidden;
  width: 100%;
  font-size: 18rpx;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.guide-progress-item.current {
  color: #4f46e5;
  font-weight: 800;
}

.guide-progress-item.current .guide-progress-index {
  background: #4f46e5;
  color: #ffffff;
  box-shadow: 0 7rpx 16rpx rgba(79, 70, 229, 0.2);
}

.guide-progress-item.completed {
  color: #168754;
}

.guide-progress-item.completed .guide-progress-index {
  background: #dcfce7;
  color: #168754;
}

.eyebrow,
.page-title,
.page-subtitle,
.step-index,
.step-title,
.section-desc,
.goal-title,
.goal-desc,
.plan-title,
.plan-desc,
.plan-tool,
.upload-name,
.upload-tip {
  display: block;
}

.eyebrow {
  color: #4f46e5;
  font-size: 22rpx;
  font-weight: 800;
}

.page-title {
  margin-top: 12rpx;
  color: #111827;
  font-size: 42rpx;
  font-weight: 900;
}

.page-subtitle {
  margin-top: 10rpx;
  color: #6b7280;
  font-size: 25rpx;
  line-height: 1.55;
}

.step-card {
  padding: 26rpx;
  margin-bottom: 22rpx;
}

.step-card.is-current {
  box-shadow: 0 0 0 2rpx rgba(79, 70, 229, 0.2), 0 16rpx 40rpx rgba(15, 23, 42, 0.07);
}

.step-card.is-completed .step-index {
  background: #dcfce7;
  color: #168754;
}

.step-head {
  display: flex;
  align-items: center;
  gap: 12rpx;
  margin-bottom: 18rpx;
}

.step-index {
  padding: 6rpx 12rpx;
  border-radius: 999rpx;
  color: #4f46e5;
  background: #eef2ff;
  font-size: 21rpx;
  font-weight: 900;
}

.step-title {
  color: #111827;
  font-size: 31rpx;
  font-weight: 900;
}

.section-desc {
  margin: -6rpx 0 18rpx;
  color: #6b7280;
  font-size: 23rpx;
  line-height: 1.5;
}

.goal-grid,
.plan-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14rpx;
}

.goal-card,
.plan-card {
  min-height: 150rpx;
  padding: 18rpx;
  border: 1rpx solid #e5e7eb;
  border-radius: 24rpx;
  background: #f9fafb;
  box-sizing: border-box;
}

.goal-card.active,
.plan-card.active {
  border-color: rgba(79, 70, 229, 0.46);
  background: linear-gradient(145deg, #eef2ff 0%, #ffffff 100%);
  box-shadow: 0 12rpx 28rpx rgba(79, 70, 229, 0.1);
}

.goal-title,
.plan-title {
  color: #111827;
  font-size: 27rpx;
  font-weight: 900;
}

.goal-desc,
.plan-desc {
  margin-top: 8rpx;
  color: #6b7280;
  font-size: 21rpx;
  line-height: 1.38;
}

.plan-tool {
  margin-top: 12rpx;
  color: #4f46e5;
  font-size: 20rpx;
  font-weight: 800;
}

.plan-label,
.preview-label,
.preview-title,
.preview-key,
.preview-value {
  display: block;
}

.plan-label {
  margin-bottom: 10rpx;
  color: #4f46e5;
  font-size: 19rpx;
  font-weight: 800;
}

.plan-preview {
  margin-top: 18rpx;
  padding: 22rpx;
  border: 1rpx solid #e0e7ff;
  border-radius: 24rpx;
  background: #f8faff;
}

.plan-preview-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 18rpx;
}

.preview-label {
  color: #6b7280;
  font-size: 20rpx;
}

.preview-title {
  margin-top: 5rpx;
  color: #111827;
  font-size: 29rpx;
  font-weight: 900;
}

.adopted-badge {
  padding: 6rpx 12rpx;
  border-radius: 999rpx;
  color: #047857;
  background: #d1fae5;
  font-size: 19rpx;
  font-weight: 800;
}

.preview-row {
  display: flex;
  align-items: flex-start;
  gap: 16rpx;
}

.preview-row-top {
  margin-top: 14rpx;
}

.preview-key {
  flex: 0 0 120rpx;
  color: #6b7280;
  font-size: 21rpx;
  line-height: 1.55;
}

.preview-value {
  flex: 1;
  color: #374151;
  font-size: 22rpx;
  line-height: 1.55;
}

.output-tags {
  flex: 1;
  display: flex;
  flex-wrap: wrap;
  gap: 8rpx;
}

.output-tag {
  padding: 7rpx 11rpx;
  border-radius: 10rpx;
  color: #4338ca;
  background: #eef2ff;
  font-size: 20rpx;
}

.output-tag.unavailable {
  color: #9ca3af;
  background: #f3f4f6;
  text-decoration: line-through;
}

.adopt-btn {
  height: 72rpx;
  margin-top: 20rpx;
  border-radius: 16rpx;
  color: #ffffff;
  background: #4f46e5;
  font-size: 25rpx;
  font-weight: 900;
  line-height: 72rpx;
}

.adopt-btn::after {
  border: 0;
}

.upload-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14rpx;
}

.upload-item {
  position: relative;
  height: 168rpx;
  border: 1rpx dashed rgba(79, 70, 229, 0.28);
  border-radius: 24rpx;
  background: #f8faff;
  overflow: hidden;
}

.upload-item.uploaded {
  border-style: solid;
}

.upload-empty {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.upload-plus {
  width: 46rpx;
  height: 46rpx;
  border-radius: 50%;
  color: #ffffff;
  background: #4f46e5;
  text-align: center;
  line-height: 42rpx;
  font-size: 34rpx;
}

.upload-name {
  margin-top: 10rpx;
  color: #111827;
  font-size: 23rpx;
  font-weight: 900;
}

.upload-tip {
  margin-top: 4rpx;
  color: #6b7280;
  font-size: 19rpx;
}

.upload-thumb {
  width: 100%;
  height: 100%;
}

.upload-label {
  position: absolute;
  left: 10rpx;
  bottom: 10rpx;
  padding: 6rpx 10rpx;
  border-radius: 999rpx;
  color: #ffffff;
  background: rgba(17, 24, 39, 0.62);
  font-size: 19rpx;
  font-weight: 800;
}

.final-card {
  margin-bottom: 0;
}

.final-summary {
  display: grid;
  gap: 12rpx;
  margin-bottom: 22rpx;
}

.final-summary > view {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16rpx 18rpx;
  border-radius: 18rpx;
  background: #f8fafc;
}

.final-summary text:first-child {
  color: #6b7280;
  font-size: 23rpx;
}

.final-summary text:last-child {
  color: #111827;
  font-size: 24rpx;
  font-weight: 900;
}

.batch-confirmation {
  margin: 0 0 22rpx;
  padding: 20rpx;
  border: 1rpx solid #e0e7ff;
  border-radius: 20rpx;
  background: #f8faff;
}

.batch-confirmation-title {
  display: block;
  margin-bottom: 14rpx;
  color: #111827;
  font-size: 25rpx;
  font-weight: 800;
}

.batch-confirmation-list {
  display: flex;
  flex-wrap: wrap;
  gap: 10rpx;
}

.batch-confirmation-item {
  padding: 8rpx 14rpx;
  border-radius: 12rpx;
  color: #4338ca;
  background: #eef2ff;
  font-size: 22rpx;
}

.batch-confirmation-total {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20rpx;
  padding-top: 14rpx;
  color: #27314a;
  font-size: 24rpx;
  font-weight: 700;
}

.batch-confirmation-total.muted {
  color: #667085;
  font-size: 22rpx;
  font-weight: 500;
}

.quota-warning {
  display: block;
  margin-top: 14rpx;
  color: #b42318;
  font-size: 22rpx;
  line-height: 1.5;
  text-align: center;
}

.start-btn {
  height: 88rpx;
  border-radius: 999rpx;
  color: #ffffff;
  background: linear-gradient(135deg, #4f46e5, #2563eb);
  font-size: 30rpx;
  font-weight: 900;
  line-height: 88rpx;
  box-shadow: 0 18rpx 36rpx rgba(79, 70, 229, 0.2);
}

.start-btn::after {
  border: 0;
}

.start-btn.disabled {
  color: #9ca3af;
  background: #e5e7eb;
  box-shadow: none;
}
</style>
