<template>
  <view class="result-page result-page-simple">
    <view class="top-nav">
      <button class="nav-back-btn" @click="backToWorks">← 返回我的作品</button>
      <text class="nav-title">生成结果</text>
      <view class="nav-placeholder"></view>
    </view>
    <view class="simple-overview" :class="`tone-${productionSummaryTone}`">
      <view class="simple-overview-copy">
        <text class="simple-eyebrow">{{ productionResultSummary.planName }}</text>
        <text class="simple-title">{{ productionOverviewTitle }}</text>
        <text class="simple-subtitle">{{ productionProgressLabel }}</text>
      </view>
      <view class="simple-overview-meta">
        <text class="simple-status">{{ productionSummaryStatusLabel }}</text>
        <text class="simple-quota">剩余额度 {{ membershipRemainingLabel }}</text>
      </view>
    </view>
    <view class="simple-section material-section">
      <view class="simple-section-head">
        <text class="simple-section-title">结果素材</text>
        <text class="simple-section-note">切换查看本次各项结果</text>
      </view>
      <scroll-view v-if="productionResultItems.length > 1" class="material-tabs" scroll-x>
        <view class="material-tabs-inner">
          <view v-for="(item, index) in productionResultItems" :key="`${item.itemType}-${item.taskId}`" class="material-tab" :class="{ active: activeProductionItemIndex === index, failed: item.status === 'failed' }" @click="selectProductionItem(index)">
            <text>{{ item.displayName }}</text>
            <text class="material-tab-status">{{ getProductionItemStatusLabel(item.status) }}</text>
          </view>
        </view>
      </scroll-view>
      <view v-if="activeProductionItem" class="material-viewer">
        <view v-if="(isIdentityReplaceTask || isSceneReplaceTask || isPoseReplaceTask || isStyleRedesignTask || isColorReplaceTask || isFabricReplaceTask || isGarmentDetailTask) && comparisonSourceImageUrl && activeProductionItem.imageUrl" class="scene-comparison" :class="{ identity: isIdentityReplaceTask && identityReferenceImageUrl }">
          <view class="scene-comparison-item">
            <text class="scene-comparison-label">{{ isStyleRedesignTask ? '原款' : '原图' }}</text>
            <image class="scene-comparison-image" :src="comparisonSourceImageUrl" mode="aspectFit" />
          </view>
          <view v-if="isIdentityReplaceTask && identityReferenceImageUrl" class="scene-comparison-item">
            <text class="scene-comparison-label">目标人物</text>
            <image class="scene-comparison-image" :src="identityReferenceImageUrl" mode="aspectFit" />
          </view>
          <view class="scene-comparison-item result">
            <text class="scene-comparison-label">{{ isIdentityReplaceTask ? '生成结果' : (isGarmentDetailTask ? activeProductionItem.displayName : (isFabricReplaceTask ? '面料效果' : (isColorReplaceTask ? '换色结果' : (isStyleRedesignTask ? activeProductionItem.displayName : (isPoseReplaceTask ? '新姿势' : '新场景'))))) }}</text>
            <image class="scene-comparison-image" :src="activeProductionItem.imageUrl" mode="aspectFit" />
          </view>
        </view>
        <image v-else-if="activeProductionItem.imageUrl" class="material-image" :src="activeProductionItem.imageUrl" mode="aspectFit" />
        <view v-else-if="activeProductionItem.status === 'failed'" class="material-state failed">
          <text class="material-state-title">生成失败</text>
          <text class="material-state-desc">{{ activeProductionItem.errorMessage || '本项素材生成失败，可单独重试。' }}</text>
          <button class="light-action danger" @click="retryProductionItem(activeProductionItem)">仅重试{{ activeProductionItem.displayName }}</button>
        </view>
        <view v-else-if="activeProductionItem.status === 'completed'" class="material-state">
          <text class="material-state-title">已完成，结果暂不可用</text>
          <text class="material-state-desc">任务已经结束，但暂未取得可访问的结果，请稍后从生产记录再次查看。</text>
        </view>
        <view v-else class="material-state">
          <text class="material-state-title">{{ activeProductionItem.status === 'pending' ? '等待生成' : '生成中...' }}</text>
          <text class="material-state-desc">{{ taskWaitingHint }}</text>
        </view>
        <view v-if="isStyleRedesignTask" class="style-result-summary">
          <text class="style-result-summary-title">{{ activeProductionItem.displayName }}</text>
          <text class="style-result-summary-line">修改内容：{{ activeStyleResultChangeSummary }}</text>
          <text class="style-result-summary-line">保留约束：{{ activeStyleResultPreserveSummary }}</text>
          <text class="style-result-summary-line muted">结果已自动加入作品中心</text>
          <button v-if="activeProductionItem.status === 'completed'" class="light-action" @click="regenerateCurrentStyleVariant">重新生成本方案</button>
        </view>
        <view v-if="isColorReplaceTask" class="style-result-summary color-result-summary">
          <text class="style-result-summary-title">目标颜色</text>
          <view class="color-result-target"><view :style="{ background: activeColorTarget.hex || '#E5E7EB' }"></view><text>{{ activeColorTarget.name || '目标颜色' }} · {{ activeColorTarget.hex || '未记录' }}</text></view>
          <text class="style-result-summary-line">换色区域：{{ activeColorRegionLabel }}</text>
          <text class="style-result-summary-line">色值来源：{{ activeColorSourceLabel }}</text>
          <text class="style-result-summary-line">纹理保留：{{ activeColorTextureLabel }}</text>
          <text class="style-result-summary-line muted">当前服务为生成式近似换色，结果需结合面料与光线人工确认</text>
        </view>
        <view v-if="isGarmentDetailTask" class="style-result-summary">
          <text class="style-result-summary-title">{{ activeProductionItem.displayName }}</text>
          <text class="style-result-summary-line">生成方式：{{ garmentDetailModeLabel }}</text>
          <text class="style-result-summary-line">输入依据：对应细节近照</text>
          <text class="style-result-summary-line">结构约束：颜色、材质、五金、车线、数量和连接方式保持</text>
          <text v-if="garmentDetailNeedsReview" class="style-result-summary-line muted">{{ garmentDetailReviewNote }}</text>
          <text v-else class="style-result-summary-line muted">结果已自动加入作品中心</text>
        </view>
        <view v-if="isFabricReplaceTask" class="style-result-summary">
          <text class="style-result-summary-title">面料效果需检查</text>
          <text class="style-result-summary-line">目标面料：{{ fabricResultName }}</text>
          <text class="style-result-summary-line">替换区域：{{ fabricResultAreaLabel }}</text>
          <text class="style-result-summary-line">颜色处理：{{ fabricResultColorLabel }}</text>
          <text class="style-result-summary-line">样布参考：{{ fabricReferenceImageUrl ? '已真实传入' : '未上传，使用面料物理约束' }}</text>
          <image v-if="fabricReferenceImageUrl" class="fabric-result-reference" :src="fabricReferenceImageUrl" mode="aspectFill" />
          <text class="style-result-summary-line muted">当前为生成式面料效果参考，不具备精确蒙版材质迁移能力，不可直接用于商品交付。</text>
        </view>
        <view class="material-caption">
          <view>
            <text class="material-name">{{ activeProductionItem.displayName }}</text>
            <text class="material-caption-status">{{ getProductionItemStatusLabel(activeProductionItem.status) }}</text>
          </view>
          <button v-if="activeProductionItem.status === 'failed'" class="inline-retry" @click="retryProductionItem(activeProductionItem)">重试</button>
        </view>
      </view>
    </view>
    <view class="simple-section primary-actions-section">
      <text class="simple-section-title">主要操作</text>
      <button class="simple-primary-btn" :disabled="!hasCompletedProductionItem || savingWorks" @click="handleSaveWorks">{{ saveWorksButtonLabel }}</button>
      <text class="save-destination-hint">生成成功后会自动收录到作品库；下载高清图会保存到系统相册。</text>
      <view class="simple-secondary-actions">
        <button class="simple-secondary-btn" :disabled="!activeProductionItemImageUrl || downloadingImage" @click="downloadCurrentProductionItem">{{ downloadingImage ? '下载中...' : (activeProductionItemImageUrl ? '下载高清图到手机' : '暂无可下载图片') }}</button>
        <button v-if="isDetailPageLongImageTask" class="simple-secondary-btn" @click="editDetailPageLongImage">重新编辑详情页</button>
        <button v-if="isDetailPageLongImageTask && activeProductId" class="simple-secondary-btn" @click="openProductProfile">查看商品档案</button>
        <button class="simple-secondary-btn" :disabled="!activeProductionItemImageUrl" @click="showContinueMenu = !showContinueMenu">继续制作</button>
      </view>
      <view v-if="showContinueMenu" class="continue-menu">
        <button v-for="option in continueOptimizeOptions" :key="option.action" class="continue-chip" @click="continueFromProductionItem(option)">{{ option.label }}</button>
      </view>
      <button class="share-text-btn" open-type="share">分享当前结果</button>
    </view>
    <view class="simple-section more-section">
      <view class="simple-fold-head" @click="showMoreInfo = !showMoreInfo">
        <view>
          <text class="simple-section-title">更多信息</text>
          <text class="simple-section-note">生成方案与交付状态</text>
        </view>
        <text class="simple-fold-toggle">{{ showMoreInfo ? '收起' : '展开' }}</text>
      </view>
      <view v-if="showMoreInfo" class="more-content">
        <view class="simple-info-row"><text>本次生成方案</text><text>{{ productionResultSummary.planName }}</text></view>
        <view class="simple-info-row"><text>本次消耗</text><text>{{ currentGenerationCostLabel }}</text></view>
        <view v-if="isPoseReplaceTask" class="pose-result-summary">
          <text class="delivery-compact-title">姿势替换信息</text>
          <view class="simple-info-row"><text>姿势来源</text><text>{{ poseSourceLabel }}</text></view>
          <view class="simple-info-row"><text>目标姿势</text><text>{{ posePresetLabel }}</text></view>
          <view class="simple-info-row"><text>参考图</text><text>{{ poseReferenceUsedLabel }}</text></view>
          <view class="simple-info-row"><text>保留状态</text><text>人物、服装、背景</text></view>
          <view class="simple-info-row"><text>模型与服务</text><text>{{ poseProviderLabel }}</text></view>
        </view>
        <view v-if="isPatternStructureTask" class="pattern-package-summary">
          <text class="delivery-compact-title">打版资料包</text>
          <view class="simple-info-row"><text>资料等级</text><text>等级 A · 结构参考</text></view>
          <view class="simple-info-row"><text>部件清单</text><text>{{ patternPackagePartCount }} 项</text></view>
          <view class="simple-info-row"><text>基础尺码</text><text>{{ patternPackageBaseSize }}</text></view>
          <view class="simple-info-row"><text>尺寸状态</text><text>{{ patternPackagePrecisionLabel }}</text></view>
          <view class="simple-info-row warning"><text>生产状态</text><text>待打版师复核，不可直接裁剪</text></view>
          <button class="pattern-library-btn" :disabled="savingPattern" @click="saveOrOpenPatternLibrary">{{ savingPattern ? '保存中...' : patternLibraryButtonLabel }}</button>
        </view>
        <view v-if="entryMode === 'delivery-review'" class="delivery-compact">
          <text class="delivery-compact-title">交付状态</text>
          <view class="simple-secondary-actions">
            <button id="action-delivery-approve" class="simple-secondary-btn" :disabled="queryingTask" @click="markDeliveryApproved">审核通过</button>
            <button id="action-delivery-reject" class="simple-secondary-btn" :disabled="queryingTask" @click="markNeedsRevision">需要修改</button>
          </view>
        </view>
      </view>
    </view>
    <view class="result-safe-space"></view>
  </view>
</template>

<script>
import { getBatchById, getBatchList } from '../../utils/service/batchStore'
import { getProjectById } from '../../utils/service/projectStore'
import { getMainChainState, patchMainChainState } from '../../utils/mainChainState'
import { getTask } from '../../utils/task/taskLayer'
import {
  getWorkDetail,
  isDownloadableWorkImageUrl,
  regenerateWork,
  resolveWorkImageUrl,
  setWorkSaved
} from '../../utils/work/workRepository'
import { hasIncompleteTaskDetail, loadTaskDetailIntoState } from '../../utils/task/taskHistory'
import { appendDeliveryAudit, createDeliveryAudit, getTaskDeliveryAudits } from '../../utils/task/taskDeliveryAudit'
import { appendDeliveryQueueItem, getTaskDeliveryQueue, updateDeliveryQueueItem } from '../../utils/task/taskDeliveryQueue'
import { fetchTaskDeliveryStatus, syncTaskDeliveryStatus } from '../../utils/api/task'
import { getResultRecentDeliveryActions } from '../../utils/task/deliveryActionHistory'
import { getTaskStatusLabel } from '../../utils/constants'
import {
  getTaskStatusMeta,
  normalizeTaskDisplayStatus,
  shouldPollTask
} from '../../utils/task/taskDisplay'
import {
  canConsumeAiPoints,
  consumeAiPoints,
  consumeRefineQuota,
  createRefineWorkOrderFromTask,
  getMembershipUsageSummary,
  setCurrentMembershipTier as setRepositoryMembershipTier,
  setMockAiPointsUsed as setRepositoryMockAiPointsUsed,
  setMockRefineUsed as setRepositoryMockRefineUsed
} from '../../utils/service/adminRepository'
import { canUseFeature, getDefaultMembershipTier } from '../../utils/constants/membershipPlans'
import { AI_POINT_ACTION_TYPES, getAiPointCost } from '../../utils/constants/aiPointCost'
import { resolveCostActionType } from '../../utils/constants/costActionType'
import {
  getWorkspaceProductionResultSummary,
  retryWorkspaceProductionItem
} from '../../utils/workspace/workspaceProduction'
import { getPatternStructurePackage, linkPatternStructureAssets } from '../../utils/workspace/patternMakingRepository.js'
import { findPatternLibraryItemByTaskId, savePatternStructureToLibrary } from '../../utils/pattern/patternLibraryRepository.js'
import { openWebsiteFeature } from '../../utils/navigation/websiteFeatureRouter.js'
import { POSE_PRESETS, POSE_REPLACE_DRAFT_KEY } from '../../utils/task/poseReplaceContract.js'

const ENABLE_REMOTE_QUOTA_GUARD = false
const ENABLE_REAL_FABRIC_REPLACE = false
let remoteQuotaGuardEnabledForDevRuntime = false
const CONTINUE_CONTEXT_STORAGE_PREFIX = 'diebiandesign_continue_context_'
const CONTINUE_OPTIMIZE_OPTIONS = [
  { label: '换模特', action: 'model', toolType: 'model' },
  { label: '换衣服', action: 'garment_replace', toolType: 'clothing', continueAction: 'garment_replace' },
  { label: '换颜色', action: 'color', toolType: 'color' },
  { label: '换面料', action: 'fabric', toolType: 'fabric' },
  { label: '换图案', action: 'pattern', toolType: 'pattern' },
  { label: '换场景', action: 'scene_replace', toolType: 'scene', continueAction: 'scene_replace' },
  { label: '换姿势', action: 'pose_replace', toolType: 'pose', continueAction: 'pose_replace' },
  { label: '生成详情页', action: 'detail_page', toolType: 'marketing', continueAction: 'detail_page' },
  { label: '生成系列图', action: 'series', toolType: 'marketing', continueAction: 'series' }
]
const DEFAULT_LABEL = '未设置'

const MODEL_TYPE_NAME_MAP = {
  female: '女模',
  male: '男模',
  kids: '童模'
}

const BODY_NAME_MAP = {
  slim: '偏瘦',
  normal: '标准',
  curvy: '曲线'
}

const KIDS_AGE_NAME_MAP = {
  toddler: '幼龄',
  middle: '中童',
  big: '大童'
}

const STYLE_NAME_MAP = {
  korean: '韩系',
  ins: 'INS',
  simple: '简约',
  japanese: '日系',
  sweet: '甜美',
  gentle: '温柔',
  yujie: '御姐',
  cool: '冷感',
  yan: '极简',
  college: '学院',
  office: '通勤',
  casual: '休闲'
}

const SCENE_NAME_MAP = {
  white: '纯白',
  gray: '灰调',
  blue: '蓝调',
  beige: '米色',
  black: '黑色',
  warm: '暖感室内',
  cold: '冷感室内',
  living: '客厅',
  studio: '影棚',
  park: '公园',
  street: '街景'
}

const NECK_NAME_MAP = {
  round: '圆领',
  v: 'V领',
  polo: 'Polo领'
}

const SLEEVE_NAME_MAP = {
  short: '短袖',
  long: '长袖',
  sleeveless: '无袖'
}

const FIT_NAME_MAP = {
  tight: '修身',
  normal: '标准',
  loose: '宽松',
  oversize: '廓形'
}

const BACKGROUND_NAME_MAP = {
  normal: '普通背景',
  transparent: '透明背景'
}

const OUTPUT_NAME_MAP = {
  main: '主图',
  detail: '细节图'
}

const MVP_PRIMARY_CLOTH_SCENE_SET = new Set([
  'ecommerce_main',
  'cross_border_white',
  'new_arrival',
  'batch_model',
  'white_background',
  'main_image'
])

const EXTENSION_ACTION_OPTIONS = Object.freeze([
  Object.freeze({
    title: 'AI印花生成',
    subtitle: '文字/图片生成印花图案',
    actionType: AI_POINT_ACTION_TYPES.PRINT_GENERATE
  }),
  Object.freeze({
    title: '一键衣身贴图',
    subtitle: '前胸、后背、满印贴图占位',
    actionType: AI_POINT_ACTION_TYPES.PRINT_PLACEMENT
  }),
  Object.freeze({
    title: 'AI面料替换',
    subtitle: '棉、牛仔、雪纺、针织等面料质感预览',
    actionType: AI_POINT_ACTION_TYPES.FABRIC_REPLACE,
    defaultOptions: Object.freeze({ fabricType: 'cotton_linen' })
  }),
  Object.freeze({
    title: '同款多色批量生成',
    subtitle: '一款生成多色方案',
    actionType: AI_POINT_ACTION_TYPES.BASIC_RECOLOR
  }),
  Object.freeze({
    title: '改款式',
    subtitle: '改领口、袖型、衣长，快速扩 SKU',
    actionType: AI_POINT_ACTION_TYPES.HOT_STYLE_REMIX
  }),
  Object.freeze({
    title: '局部放大细节图',
    subtitle: '领口、袖口、面料、纽扣/拉链细节',
    actionType: AI_POINT_ACTION_TYPES.DETAIL_CLOSEUP
  }),
  Object.freeze({
    title: '一键生成T台走秀短片',
    subtitle: '3秒/5秒/10秒走秀视频占位',
    actionType: AI_POINT_ACTION_TYPES.RUNWAY_VIDEO_3S,
    defaultOptions: Object.freeze({ durationSec: 3 })
  })
])

const STATUS_LABEL_MAP = {
  draft: '编辑中',
  submitted: '已提交',
  queued: '排队中',
  processing: '生成中',
  success: '已完成',
  failed: '失败',
  error: '错误',
  timeout: '超时'
}

const STAGE_LABEL_MAP = {
  editing: '编辑中',
  uploading: '上传中',
  submitting: '提交中',
  queued: '排队中',
  generating: '生成中',
  polling: '轮询中',
  result_ready: '结果已就绪',
  error: '错误'
}

function formatTaskStatusLabel(status) {
  const sharedLabel = getTaskStatusLabel(status)
  if (sharedLabel && sharedLabel !== status) {
    return sharedLabel
  }
  return STATUS_LABEL_MAP[status] || status || DEFAULT_LABEL
}

function resolveImageUrl(value) {
  if (!value) {
    return ''
  }
  if (typeof value === 'string') {
    return value
  }
  return value.fileUrl ||
    value.file_url ||
    value.imageUrl ||
    value.image_url ||
    value.url ||
    value.tempFilePath ||
    value.path ||
    value.localPath ||
    ''
}

export default {
  data() {
    return {
      chainState: getMainChainState(),
      showShare: false,
      queryingTask: false,
      detailLoading: false,
      reconcilingDelivery: false,
      taskId: '',
      historyId: '',
      activeProductionItemIndex: 0,
      showContinueMenu: false,
      showMoreInfo: false,
      savingWorks: false,
      savingPattern: false,
      savedPatternMasterId: '',
      workSaveFailed: false,
      downloadingImage: false,
      workSaveVersion: 0,
      autoSavedTaskIds: [],
      task: null,
      result: null,
      currentResult: null,
      pageTask: null,
      pageResult: null,
      currentTask: null,
      currentResultValue: null,
      task_id: '',
      provider: '',
      source: '',
      result_image_url: '',
      sourceDisplayImageUrl: '',
      styleDisplayImageUrl: '',
      sourceDisplayImageKey: '',
      styleDisplayImageKey: '',
      entryMode: '',
      reviewContext: '',
      contextTargetSectionId: '',
      hasAutoFocusedByContext: false,
      returnContext: {
        mode: '',
        reviewContext: '',
        batchId: '',
        projectId: ''
      },
      siblingManualFocusGroup: '',
      compactSiblingLimit: 3,
      activeRecentResultActionKey: '',
      currentMembershipTier: getDefaultMembershipTier(),
      remoteQuotaGuardEnabledForDev: false,
      extensionResults: [],
      extensionActionOptions: EXTENSION_ACTION_OPTIONS,
      promptPlanExpanded: false,
      showTaskInfo: false,
      showDeliveryInfo: false,
      showDebugInfo: false,
      localTaskRefreshTimer: null,
      localTaskRefreshActive: false,
      taskRefreshStartedAt: 0,
      taskRefreshError: '',
      returningToWorks: false
    }
  },
  onLoad(options) {
    const pageTaskId = this.resolveTaskIdFromOptions(options)
    this.taskId = pageTaskId
    this.historyId = options && options.historyId ? decodeURIComponent(options.historyId) : ''
    if (pageTaskId) {
      patchMainChainState({
        currentTaskId: pageTaskId
      })
    }
    this.entryMode = options && options.mode ? decodeURIComponent(options.mode) : ''
    this.reviewContext = options && options.reviewContext ? decodeURIComponent(options.reviewContext) : ''
    this.returnContext = {
      mode: this.entryMode || '',
      reviewContext: this.reviewContext || '',
      batchId: (options && options.batchId ? decodeURIComponent(options.batchId) : '') || '',
      projectId: (options && options.projectId ? decodeURIComponent(options.projectId) : '') || ''
    }
    this.contextTargetSectionId = this.resolveContextTargetSectionId(this.entryMode, this.reviewContext)
    this.hasAutoFocusedByContext = false
    this.refreshState()
    this.restoreTaskFromLocalState(pageTaskId, this.returnContext.batchId)
    this.ensureTaskDetailLoaded()
    this.reconcileDeliveryStatusFromServer()
    this.startLocalTaskRefresh()
    this.scheduleContextAutoFocus()
  },
  onShow() {
    this.refreshState()
    this.restoreTaskFromLocalState(this.currentTaskIdValue, this.currentBatchId || this.returnContext.batchId)
    this.ensureTaskDetailLoaded()
    this.reconcileDeliveryStatusFromServer()
    this.startLocalTaskRefresh()
    this.scheduleContextAutoFocus()
  },
  onShareAppMessage() {
    const taskId = this.currentTaskIdValue || ''
    const params = []
    if (taskId) params.push(`taskId=${encodeURIComponent(taskId)}`)
    if (this.productionResultSummary.batchId) params.push(`batchId=${encodeURIComponent(this.productionResultSummary.batchId)}`)
    if (this.productionResultSummary.historyId) params.push(`historyId=${encodeURIComponent(this.productionResultSummary.historyId)}`)
    return {
      title: `${this.resultTypeLabel} · 蝶变 AI 生成结果`,
      path: params.length ? `/package-ai/result/result?${params.join('&')}` : '/pages/index/index',
      imageUrl: this.activeProductionItemImageUrl || this.resultImageUrl || ''
    }
  },
  onHide() {
    this.stopLocalTaskRefresh()
  },
  onUnload() {
    this.stopLocalTaskRefresh()
  },
  computed: {
    continueOptimizeOptions() {
      return CONTINUE_OPTIMIZE_OPTIONS
    },
    activeProductId() {
      const task = this.activeProductionTask || this.currentTaskValue || this.currentTask || {}
      return (((task.input || {}).params || {}).productId) || ''
    },
    productionResultSummary() {
      const summary = getWorkspaceProductionResultSummary({
        historyId: this.historyId,
        batchId: this.currentBatchId || this.returnContext.batchId,
        taskId: this.currentTaskIdValue
      })
      if (summary.items && summary.items.length) return summary
      const task = this.currentTaskValue || this.currentTask || {}
      if (!this.currentTaskIdValue && !task.taskId) return summary
      const normalizedStatus = normalizeTaskDisplayStatus(task.status || task.stage)
      const status = this.hasResultOutput ? 'completed' : normalizedStatus
      const item = {
        itemType: this.taskParamsValue.itemType || this.taskParamsValue.outputType || task.type || 'generated_image',
        displayName: this.taskParamsValue.itemDisplayName || this.resultTypeLabel,
        taskId: this.currentTaskIdValue || task.taskId || '',
        status,
        imageUrl: this.resultImageUrl,
        errorCode: this.taskErrorValue.code || this.taskErrorValue.errorCode || '',
        errorMessage: this.displayErrorMessage || this.taskErrorValue.message || '',
        canRetry: status === 'failed',
        quotaConsumed: null,
        attemptTaskIds: [this.currentTaskIdValue || task.taskId || ''].filter(Boolean),
        retryRelations: []
      }
      return {
        ...summary,
        planName: this.taskParamsValue.planName || this.resultPlanName,
        completedCount: status === 'completed' ? 1 : 0,
        failedCount: status === 'failed' ? 1 : 0,
        totalCount: 1,
        summaryStatus: status,
        items: [item]
      }
    },
    productionResultItems() {
      const items = this.productionResultSummary && this.productionResultSummary.items
      return Array.isArray(items) ? items : []
    },
    activeProductionItem() {
      return this.productionResultItems[this.activeProductionItemIndex] || this.productionResultItems[0] || null
    },
    activeProductionItemImageUrl() {
      return (this.activeProductionItem && this.activeProductionItem.imageUrl) || ''
    },
    hasCompletedProductionItem() {
      return this.productionResultItems.some((item) => item.status === 'completed' && item.imageUrl)
    },
    completedProductionItems() {
      return this.productionResultItems.filter((item) => item.status === 'completed' && item.imageUrl)
    },
    allCompletedWorksSaved() {
      this.workSaveVersion
      return this.completedProductionItems.length > 0 && this.completedProductionItems.every((item) => {
        const work = getWorkDetail(item.taskId)
        return !!(work && work.isSaved)
      })
    },
    saveWorksButtonLabel() {
      if (this.savingWorks) return '同步中...'
      if (this.workSaveFailed) return '作品同步失败'
      if (!this.completedProductionItems.length) return '生成后自动保存到作品库'
      return '查看我的作品'
    },
    productionProgressLabel() {
      const summary = this.productionResultSummary || {}
      const total = Math.max(0, Number(summary.totalCount) || 0)
      const completed = Math.max(0, Number(summary.completedCount) || 0)
      const failed = Math.max(0, Number(summary.failedCount) || 0)
      const generating = Math.max(0, total - completed - failed)
      return `已完成 ${completed}/${total} · 正在生成 ${generating}张 · 失败 ${failed}张`
    },
    taskWaitingHint() {
      if (this.taskRefreshError) return '状态同步暂时失败，页面会自动重试；任务仍在后台处理中。'
      if (this.taskRefreshStartedAt && Date.now() - this.taskRefreshStartedAt >= 30000) {
        return '任务仍在后台处理中，可以先返回作品，完成后会自动更新。'
      }
      return '每完成一张都会自动显示，离开页面不会中断后台任务。'
    },
    productionSummaryStatusLabel() {
      return getTaskStatusMeta(this.productionResultSummary.summaryStatus).label
    },
    productionSummaryTone() {
      return getTaskStatusMeta(this.productionResultSummary.summaryStatus).tone
    },
    productionOverviewTitle() {
      const summary = this.productionResultSummary
      if (summary.summaryStatus === 'completed') return `${summary.planName}已完成`
      if (summary.summaryStatus === 'partial_failed' || summary.summaryStatus === 'partial_success') return `${summary.planName}部分完成`
      if (summary.summaryStatus === 'failed') return `${summary.planName}生成失败`
      return `${summary.planName}生成中`
    },
    isDevelopmentEnvironment() {
      try {
        if (typeof wx !== 'undefined' && wx.getAccountInfoSync) {
          const info = wx.getAccountInfoSync()
          return !!(info && info.miniProgram && info.miniProgram.envVersion === 'develop')
        }
      } catch (error) {}
      return typeof process !== 'undefined' && process.env && ['development', 'dev'].includes(process.env.NODE_ENV)
    },
    entryContextHint() {
      if (this.entryMode === 'delivery-view') {
        return '从交付视图打开，优先查看可交付结果。'
      }
      if (this.entryMode === 'delivery-review' && this.reviewContext === 'pending_review') {
        return '从待审核入口打开，优先处理通过或修改操作。'
      }
      if (this.entryMode === 'delivery-review' && this.reviewContext === 'needs_revision') {
        return '从待修改入口打开，优先查看交付备注和问题提示。'
      }
      return ''
    },
    returnContextHint() {
      const reviewContextLabel = this.returnContext.reviewContext === 'needs_revision' ? '待修改' : '待审核'
      if (this.canBackToBatchReview) {
        return `返回路径：批次审核（${reviewContextLabel}）`
      }
      if (this.canBackToBatchDelivery) {
        return '返回路径：批次交付视图'
      }
      if (this.canBackToProjectReview) {
        return `返回路径：项目审核（${reviewContextLabel}）`
      }
      return ''
    },
    currentTaskIdValue() {
      return this.taskId || this.chainState.currentTaskId || this.chainState.taskId || this.chainState.lastTaskId || ''
    },
    currentTaskValue() {
      const taskId = this.currentTaskIdValue
      return (taskId && this.chainState.tasks && this.chainState.tasks.byId && this.chainState.tasks.byId[taskId]) || this.currentTask || null
    },
    draftTaskValue() {
      return this.chainState.draftTask || {}
    },
    taskInputValue() {
      return (this.currentTaskValue && this.currentTaskValue.input) || {}
    },
    taskAssetsValue() {
      return this.taskInputValue.assets || {}
    },
    taskParamsValue() {
      return this.taskInputValue.params || {}
    },
    promptPlanValue() {
      const params = this.taskParamsValue || {}
      return params.promptPlan || {}
    },
    hasPromptPlan() {
      const plan = this.promptPlanValue || {}
      return !!(
        plan.clothingDescription ||
        plan.modelSetting ||
        plan.sceneSetting ||
        plan.poseSetting ||
        plan.outputUsage ||
        plan.negativePrompt ||
        this.taskParamsValue.promptDraft
      )
    },
    generationModeLabel() {
      const map = {
        quick: '快速',
        standard: '标准',
        creative: '创意'
      }
      return map[this.taskParamsValue.generationMode] || '标准'
    },
    promptPlanRows() {
      const plan = this.promptPlanValue || {}
      return [
        { label: '服装描述', value: plan.clothingDescription || '暂无' },
        { label: '模特设定', value: plan.modelSetting || '暂无' },
        { label: '场景设定', value: plan.sceneSetting || '暂无' },
        { label: '姿势设定', value: plan.poseSetting || '暂无' },
        { label: '出图用途', value: plan.outputUsage || this.taskParamsValue.outputUsage || '暂无' },
        { label: '负面约束', value: plan.negativePrompt || this.taskParamsValue.negativePrompt || '暂无' },
        { label: '生成模式', value: this.generationModeLabel }
      ]
    },
    hasDevelopmentMode() {
      return !!(this.taskParamsValue && this.taskParamsValue.developmentMode)
    },
    taskOptionsValue() {
      return this.taskInputValue.options || {}
    },
    isMvpPrimaryClothTask() {
      const task = this.currentTaskValue || {}
      const input = this.taskInputValue || {}
      const options = this.taskOptionsValue || {}
      const uiState = task.uiState || {}
      const templateType = String(
        options.templateType ||
        options.entryScene ||
        uiState.entryScene ||
        input.entryScene ||
        task.entryScene ||
        ''
      )
      return MVP_PRIMARY_CLOTH_SCENE_SET.has(templateType)
    },
    taskResultValue() {
      return (this.currentTaskValue && this.currentTaskValue.result) || {}
    },
    taskResultItemsValue() {
      return Array.isArray(this.taskResultValue.items) ? this.taskResultValue.items : []
    },
    taskErrorValue() {
      return (this.currentTaskValue && this.currentTaskValue.error) || {}
    },
    taskControlValue() {
      return (this.currentTaskValue && this.currentTaskValue.control) || {}
    },
    clothImageValue() {
      return this.taskAssetsValue.clothImage || { localPath: '', fileId: '', fileUrl: '' }
    },
    styleImageValue() {
      return this.taskAssetsValue.styleImage || { localPath: '', fileId: '', fileUrl: '' }
    },
    clothImageUrl() {
      return this.resolveDisplayImageUrlSync(this.clothImageValue)
    },
    isSceneReplaceTask() {
      const task = this.currentTaskValue || {}
      const type = String(task.type || task.taskType || this.taskParamsValue.actionType || '').trim().toLowerCase()
      return ['scene_replace', 'replace_scene', 'scene_change', 'background_replace'].includes(type)
    },
    isIdentityReplaceTask() {
      const task = this.activeProductionTask || this.currentTaskValue || {}
      const params = this.activeProductionTaskParams || this.taskParamsValue || {}
      const type = String(task.type || task.taskType || params.actionType || params.replaceType || '').trim().toLowerCase()
      return ['head_replace', 'face_replace'].includes(type)
    },
    identityReferenceImageUrl() {
      const task = this.activeProductionTask || this.currentTaskValue || {}
      const assets = ((task.input || {}).assets) || this.taskAssetsValue || {}
      const params = this.activeProductionTaskParams || this.taskParamsValue || {}
      return this.resolveDisplayImageUrlSync(assets.headReferenceImage || assets.faceReferenceImage || params.headReferenceImage || params.faceReferenceImage || params.targetPersonImage || {})
    },
    isPoseReplaceTask() {
      const task = this.currentTaskValue || {}
      const type = String(task.type || task.taskType || this.taskParamsValue.actionType || '').trim().toLowerCase()
      return ['pose_replace', 'pose_adjust', 'pose_variation', 'pose_variant', 'pose_change'].includes(type)
    },
    activeProductionTask() {
      return this.activeProductionItem && this.activeProductionItem.taskId
        ? (getTask(this.activeProductionItem.taskId) || {})
        : {}
    },
    activeProductionTaskParams() {
      const task = this.activeProductionTask || {}
      return {
        ...(((task.input || {}).params) || {}),
        ...(task.params || {})
      }
    },
    isStyleRedesignTask() {
      const task = this.activeProductionTask || this.currentTaskValue || {}
      const params = this.activeProductionTaskParams || {}
      const type = String(task.type || task.taskType || params.itemType || params.toolType || '').toLowerCase()
      return /micro_redesign|style_redesign|style_refine|refine/.test(type)
    },
    activeProductionTaskOptions() {
      const task = this.activeProductionTask || this.currentTaskValue || {}
      return ((task.input || {}).options) || {}
    },
    isColorReplaceTask() {
      const task = this.activeProductionTask || this.currentTaskValue || {}
      const params = this.activeProductionTaskParams || {}
      const type = String(task.type || task.taskType || params.actionType || '').toLowerCase()
      return /color_replace|basic_recolor|color_batch/.test(type)
    },
    isFabricReplaceTask() {
      const task = this.activeProductionTask || this.currentTaskValue || {}
      const params = this.activeProductionTaskParams || {}
      const type = String(task.type || task.taskType || params.actionType || params.toolType || '').toLowerCase()
      return /fabric_replace|fabric_variation|material_replace|(^|\s)fabric($|\s)/.test(type)
    },
    fabricReferenceImageUrl() {
      const task = this.activeProductionTask || this.currentTaskValue || {}
      const assets = ((task.input || {}).assets) || this.taskAssetsValue || {}
      return this.resolveDisplayImageUrlSync(assets.fabricReferenceImage || {})
    },
    fabricResultName() {
      const params = this.activeProductionTaskParams || {}
      return params.fabricName || params.referenceStyleName || '自定义面料'
    },
    fabricResultAreaLabel() {
      const params = this.activeProductionTaskParams || {}
      const map = { whole_garment: '服装主体', upper: '上衣', top: '上衣', lower: '下装', bottom: '下装', sleeve: '袖子', cuff: '袖口', collar: '领口' }
      return map[params.fabricTargetArea || params.materialPosition] || '服装主体'
    },
    fabricResultColorLabel() {
      const options = this.activeProductionTaskOptions || {}
      const params = this.activeProductionTaskParams || {}
      return (options.fabricColorMode || params.fabricColorMode) === 'adopt_reference' ? '采用样布颜色' : '保留原服装颜色'
    },
    isGarmentDetailTask() {
      const task = this.activeProductionTask || this.currentTaskValue || {}
      const params = this.activeProductionTaskParams || {}
      const type = String(task.type || task.taskType || params.actionType || params.parentTaskType || '').toLowerCase()
      return /garment_detail_/.test(type)
    },
    isDetailPageLongImageTask() {
      const task = this.activeProductionTask || this.currentTaskValue || {}
      const params = this.activeProductionTaskParams || {}
      const type = String(task.type || task.taskType || params.taskType || '').toLowerCase()
      return /detail_page_long_image/.test(type)
    },
    garmentDetailModeLabel() {
      const params = this.activeProductionTaskParams || {}
      return params.detailGenerationMode === 'ai_completion_reference' ? 'AI补全参考' : '忠实细节图'
    },
    garmentDetailNeedsReview() {
      const params = this.activeProductionTaskParams || {}
      const options = this.activeProductionTaskOptions || {}
      return params.requiresQualityReview === true || options.requiresQualityReview === true
    },
    garmentDetailReviewNote() {
      return this.garmentDetailModeLabel === 'AI补全参考'
        ? 'AI推测参考，需人工核对后再用于商品交付'
        : '关键商品细节需人工核对，确认与原图一致后再用于交付'
    },
    activeColorTarget() {
      const params = this.activeProductionTaskParams || {}
      const options = this.activeProductionTaskOptions || {}
      const target = options.targetColor || params.targetColor || {}
      return {
        name: target.displayName || target.name || params.targetColorName || params.colorName || '',
        hex: target.hex || params.targetColorHex || '',
        rgb: target.rgb || params.targetColorRgb || [],
        lab: target.lab || params.targetColorLab || []
      }
    },
    activeColorRegionLabel() {
      const params = this.activeProductionTaskParams || {}
      const options = this.activeProductionTaskOptions || {}
      const value = options.targetRegion || params.targetRegion || params.colorTargetArea || 'whole_garment'
      return { whole_garment: '整件服装', top: '上衣', bottom: '下装', pants: '下装', sleeve: '袖子', collar: '领口' }[value] || '整件服装'
    },
    activeColorSourceLabel() {
      const params = this.activeProductionTaskParams || {}
      const options = this.activeProductionTaskOptions || {}
      const source = options.colorSource || params.colorSource || ''
      return {
        system: '系统颜色',
        system_palette: '系统颜色',
        custom_picker: '自定义颜色',
        eyedropper_garment: '服装图吸管',
        eyedropper_uploaded: '上传图片吸管',
        dominant_color: '图片主要颜色',
        recent_color: '最近使用',
        personal: '我的颜色',
        brand: '品牌颜色',
        recent: '最近使用',
        eyedropper: '服装图吸管',
        color_card_auto: '色卡自动提取',
        color_card_eyedropper: '色卡吸管'
      }[source] || '未记录'
    },
    activeColorTextureLabel() {
      const params = this.activeProductionTaskParams || {}
      const options = this.activeProductionTaskOptions || {}
      return options.preserveTexture !== false && params.preserveTexture !== false ? '保留原纹理、明暗与褶皱' : '按任务配置'
    },
    activeStyleResultChangeSummary() {
      const params = this.activeProductionTaskParams || {}
      const targets = Array.isArray(params.changeTargets) ? params.changeTargets : []
      const directions = params.targetDirections && typeof params.targetDirections === 'object' ? params.targetDirections : {}
      const labels = {
        neckline: '领口', sleeve: '袖型', shoulder: '肩部', body_fit: '衣身版型', garment_length: '衣长',
        placket: '门襟', pocket: '口袋', hem: '下摆', decoration: '装饰细节', silhouette: '整体廓形'
      }
      return targets.length
        ? targets.map((target) => `${labels[target] || target} → ${directions[target] || '按要求调整'}`).join('、')
        : '旧任务未记录结构化改动'
    },
    activeStyleResultPreserveSummary() {
      const params = this.activeProductionTaskParams || {}
      const values = Array.isArray(params.preserveItems) ? params.preserveItems : []
      const labels = {
        garment_subject: '服装主体', color: '颜色', fabric: '面料', pattern: '图案',
        model_pose: '模特与姿势', background_composition: '背景与构图'
      }
      return values.length ? values.map((value) => labels[value] || value).join('、') : '旧任务未记录保留项'
    },
    sceneReplaceSourceImageUrl() {
      return this.taskInputValue.imageUrl || this.taskInputValue.image_url || this.taskParamsValue.sourceImageUrl || this.clothImageUrl || ''
    },
    comparisonSourceImageUrl() {
      return this.taskInputValue.imageUrl || this.taskInputValue.image_url || this.taskParamsValue.sourceImageUrl || this.clothImageUrl || ''
    },
    poseSourceLabel() {
      return this.taskParamsValue.poseSource === 'reference' ? '姿势参考图' : '姿势模板'
    },
    posePresetLabel() {
      if (this.taskParamsValue.poseSource === 'reference') return '按参考图动作'
      const preset = POSE_PRESETS.find((item) => item.value === this.taskParamsValue.posePreset)
      return preset ? preset.label : '未记录'
    },
    poseReferenceUsedLabel() {
      const assets = this.taskAssetsValue || {}
      return assets.poseReferenceImage || this.taskParamsValue.poseReferenceImage ? '已进入任务' : '未使用'
    },
    poseProviderLabel() {
      const task = this.currentTaskValue || {}
      const provider = task.provider || this.taskParamsValue.provider || '未记录'
      const version = this.taskParamsValue.modelVersion || this.taskParamsValue.providerModel || ''
      return version ? `${provider} · ${version}` : provider
    },
    sourceClothImageUrl() {
      return this.resolveDisplayImageUrlSync(this.getSourceClothImageAsset())
    },
    styleImageUrl() {
      if (this.isMvpPrimaryClothTask) {
        return ''
      }
      return this.styleDisplayImageUrl || this.resolveDisplayImageUrlSync(this.styleImageValue)
    },
    resultImageUrl() {
      const firstResult = this.taskResultItemsValue[0] || {}
      return (this.currentTaskValue && this.currentTaskValue.resultImageUrl) ||
        (this.currentTaskValue && this.currentTaskValue.result_image_url) ||
        this.taskResultValue.image ||
        this.taskResultValue.imageUrl ||
        this.taskResultValue.image_url ||
        this.taskResultValue.resultImageUrl ||
        this.taskResultValue.result_image_url ||
        (typeof firstResult === 'string' ? firstResult : '') ||
        firstResult.imageUrl ||
        firstResult.image_url ||
        firstResult.fileUrl ||
        firstResult.file_url ||
        firstResult.url ||
        this.taskResultValue.coverUrl ||
        this.taskResultValue.fileUrl ||
        this.taskResultValue.file_url ||
        this.taskResultValue.url ||
        ''
    },
    resultThumbnailList() {
      const list = []
      const pushUrl = (value) => {
        const url = String(value || '').trim()
        if (url && !list.includes(url)) {
          list.push(url)
        }
      }
      pushUrl(this.resultImageUrl)
      this.taskResultItemsValue.forEach((item = {}) => {
        pushUrl(item.imageUrl || item.image_url || item.fileUrl || item.file_url || item.url)
      })
      return list
    },
    taskStatusValue() {
      return (this.currentTaskValue && this.currentTaskValue.status) || ''
    },
    taskStageValue() {
      return (this.currentTaskValue && this.currentTaskValue.stage) || ''
    },
    taskProgressValue() {
      return (this.currentTaskValue && this.currentTaskValue.progress) || 0
    },
    statusTextValue() {
      return (this.currentTaskValue && this.currentTaskValue.statusText) || ''
    },
    taskStatusLabel() {
      return formatTaskStatusLabel(this.taskStatusValue)
    },
    resultStatusHeading() {
      if (this.detailLoading) return '正在加载'
      if (this.isFailedTaskStatus) return '生成失败'
      if (this.isProcessingTaskStatus || !this.hasResultOutput) return '正在生成'
      return '生成完成'
    },
    resultPlanName() {
      const task = this.currentTaskValue || {}
      const plan = this.promptPlanValue || {}
      return task.planName || plan.planName || plan.title || this.taskParamsValue.outputUsage || 'AI生成方案'
    },
    resultTypeLabel() {
      const task = this.currentTaskValue || {}
      const source = [
        task.taskType,
        task.type,
        task.toolType,
        task.entryScene,
        this.taskParamsValue.actionType,
        this.taskParamsValue.toolType,
        this.taskParamsValue.entryScene,
        this.taskParamsValue.outputType,
        this.taskParamsValue.outputUsage,
        this.promptPlanValue.outputUsage
      ].filter(Boolean).join(' ').toLowerCase()
      if (/garment_replace|clothes_replace|outfit_replace|virtual_try_on|换衣服/.test(source)) return 'AI换衣服'
      if (/pattern_structure_generate|pattern_structure_|打版结构/.test(source)) return '打版结构图'
      if (/fabric_replace|fabric_variation|(^|\s)fabric($|\s)|换面料/.test(source)) return '换面料'
      if (/pattern_replace|pattern_variation|(^|\s)pattern($|\s)|换图案/.test(source)) return '换图案'
      if (/style_redesign|hot_style|(^|\s)refine($|\s)|服装改款|改爆款|改款式/.test(source)) return '改款式'
      if (/garment_detail_/.test(source)) return '服装细节图'
      if (/detail|page_material|详情|卖点|尺寸/.test(source)) return '详情页'
      if (/marketing|poster|series|social|campaign|营销|海报|系列|种草/.test(source)) return '营销素材'
      if (/ecommerce|main_image|white_bg|flat|product|商品|主图|白底|平铺/.test(source)) return '商品主图'
      if (/scene_replace|replace_scene|scene_change|background_replace|换场景/.test(source)) return '场景替换图'
      if (/pose_replace|pose_adjust|pose_variation|pose_variant|pose_change|换姿势/.test(source)) return 'AI换姿势'
      if (/model|face|pose|scene|模特|换脸|姿势|场景/.test(source)) return 'AI模特图'
      return 'AI生成作品'
    },
    isPatternStructureTask() {
      const params = this.taskParamsValue || {}
      return /pattern_structure/.test([params.actionType, params.taskType, params.itemType, this.currentTaskValue && (this.currentTaskValue.type || this.currentTaskValue.taskType)].filter(Boolean).join(' ').toLowerCase())
    },
    patternStructurePackage() {
      if (!this.isPatternStructureTask) return null
      const patternMasterId = this.patternMasterIdValue
      return patternMasterId ? getPatternStructurePackage(patternMasterId) : null
    },
    patternMasterIdValue() {
      const direct = String(this.savedPatternMasterId || (this.taskParamsValue && this.taskParamsValue.patternMasterId) || '')
      if (direct) return direct
      const existing = findPatternLibraryItemByTaskId(this.currentTaskIdValue)
      return existing ? existing.patternMasterId : ''
    },
    patternLibraryButtonLabel() {
      return this.patternMasterIdValue ? '查看版型方案' : '保存至版型库'
    },
    patternPackagePartCount() {
      return this.patternStructurePackage && Array.isArray(this.patternStructurePackage.parts) ? this.patternStructurePackage.parts.length : 0
    },
    patternPackageBaseSize() {
      const specs = this.patternStructurePackage && this.patternStructurePackage.sizeSpecs
      const size = Array.isArray(specs) && specs[0] ? specs[0].baseSize : this.taskParamsValue.baseSize
      return size || '未设精确尺码'
    },
    patternPackagePrecisionLabel() {
      const specs = this.patternStructurePackage && this.patternStructurePackage.sizeSpecs
      const status = Array.isArray(specs) && specs[0] ? specs[0].precisionStatus : ''
      return status === 'user_provided_partial' ? '用户部分提供，待复核' : '无精确尺寸'
    },
    resultTimeLabel() {
      const task = this.currentTaskValue || {}
      return this.formatResultTime(task.completedAt || task.updatedAt || task.createdAt || '')
    },
    resultRecommendationText() {
      if (this.resultTypeLabel === '商品主图') return '推荐下一步：生成详情页和营销素材，补齐商品上新内容。'
      if (this.resultTypeLabel === 'AI模特图') return '推荐下一步：生成更多模特场景，丰富商品展示。'
      if (this.resultTypeLabel === '详情页') return '推荐下一步：生成推广素材，延展活动和社交内容。'
      return '推荐下一步：继续生成同系列素材。'
    },
    membershipUsageSummary() {
      return getMembershipUsageSummary()
    },
    currentGenerationCostLabel() {
      const batchCosts = this.productionResultItems
        .map((item) => item.quotaConsumed)
        .filter((value) => value !== null && value !== undefined && Number.isFinite(Number(value)))
      if (batchCosts.length) {
        const total = batchCosts.reduce((sum, value) => sum + Math.max(0, Number(value) || 0), 0)
        return `${total} 次`
      }
      const task = this.currentTaskValue || {}
      const result = this.taskResultValue || {}
      const values = [task.quotaConsumed, task.pointsConsumed, result.quotaConsumed, result.pointsConsumed]
      const value = values.find((item) => item !== undefined && item !== null && item !== '')
      return value === undefined || value === null || value === '' ? '额度记录同步中' : `${value} 次`
    },
    membershipRemainingLabel() {
      const summary = this.membershipUsageSummary || {}
      const value = Number(summary.monthlyAiPointsRemaining)
      return Number.isFinite(value) ? `${Math.max(0, value)} 次` : '暂时无法获取'
    },
    isMembershipInsufficient() {
      const summary = this.membershipUsageSummary || {}
      const quota = Number(summary.monthlyAiPointsQuota)
      const remaining = Number(summary.monthlyAiPointsRemaining)
      return Number.isFinite(quota) && quota > 0 && Number.isFinite(remaining) && remaining <= 0
    },
    canStartNewGeneration() {
      return !!this.currentTaskIdValue && !this.queryingTask && !this.detailLoading
    },
    taskStageLabel() {
      return STAGE_LABEL_MAP[this.taskStageValue] || this.taskStageValue || DEFAULT_LABEL
    },
    statusTone() {
      if (this.taskStatusValue === 'success' || this.taskStatusValue === 'completed') {
        return 'success'
      }
      if (['failed', 'error', 'timeout'].includes(this.taskStatusValue)) {
        return 'failed'
      }
      if (['processing', 'queued', 'submitted'].includes(this.taskStatusValue)) {
        return 'processing'
      }
      return 'draft'
    },
    modelTypeName() {
      return MODEL_TYPE_NAME_MAP[this.taskParamsValue.modelType] || DEFAULT_LABEL
    },
    bodyName() {
      return BODY_NAME_MAP[this.taskParamsValue.bodyType] || DEFAULT_LABEL
    },
    kidsAgeName() {
      if (this.taskParamsValue.modelType !== 'kids') {
        return '不适用'
      }
      return KIDS_AGE_NAME_MAP[this.taskParamsValue.kidsAgeGroup] || DEFAULT_LABEL
    },
    styleTagName() {
      return STYLE_NAME_MAP[this.taskParamsValue.styleTag] || DEFAULT_LABEL
    },
    sceneName() {
      return SCENE_NAME_MAP[this.taskParamsValue.sceneType] || DEFAULT_LABEL
    },
    neckName() {
      return NECK_NAME_MAP[this.taskParamsValue.neckType] || DEFAULT_LABEL
    },
    sleeveName() {
      return SLEEVE_NAME_MAP[this.taskParamsValue.sleeveType] || DEFAULT_LABEL
    },
    fitName() {
      return FIT_NAME_MAP[this.taskParamsValue.fitType] || DEFAULT_LABEL
    },
    backgroundName() {
      return BACKGROUND_NAME_MAP[this.taskOptionsValue.backgroundType] || DEFAULT_LABEL
    },
    outputTypeName() {
      return OUTPUT_NAME_MAP[this.taskOptionsValue.outputType] || DEFAULT_LABEL
    },
    displayErrorMessage() {
      const errorCode = String(this.taskErrorValue.code || this.taskErrorValue.errorCode || '').toUpperCase()
      const messages = {
        SCENE_REFERENCE_REQUIRED: '请选择场景参考图后重试。',
        SCENE_REFERENCE_INVALID: '场景参考图无法访问，请重新选择。',
        SCENE_REFERENCE_MUST_DIFFER: '场景参考图不能与当前主体图相同。',
        SCENE_REFERENCE_NOT_SUPPORTED: '当前模型暂不支持参考图换场景，请选择文字场景或其他模型。',
        SCENE_REPLACE_UNCHANGED_RESULT: '本次场景未有效替换，请保留参考图后重试。',
        QUOTA_FAILED: '额度预扣或额度记录校验失败，未完成的消费会按失败流程退回。',
        IMAGE_UPLOAD_FAILED: '原图或目标人像上传失败，请重新选择后重试。',
        IMAGE_URL_FAILED: '图片无法转换为 Provider 可访问地址，请重新上传。',
        PROVIDER_AUTH_FAILED: 'API Key 无效或无权访问当前模型。',
        PROVIDER_REGION_MISMATCH: 'API Key、Workspace 与接口地域可能不一致。',
        PROVIDER_REQUEST_INVALID: 'Provider 请求参数或测试环境配置不符合要求。',
        PROVIDER_RATE_LIMITED: 'Provider 请求频率受限，请稍后重试。',
        PROVIDER_TIMEOUT: 'Provider 图像编辑请求超时，额度已按失败流程处理。',
        PROVIDER_EMPTY_RESULT: 'Provider 未返回有效图片，本次任务未完成。',
        RESULT_PERSIST_FAILED: '结果图片保存失败，本次任务未标记完成。'
      }
      const providerErrors = new Set([
        'QUOTA_FAILED',
        'IMAGE_UPLOAD_FAILED',
        'IMAGE_URL_FAILED',
        'PROVIDER_AUTH_FAILED',
        'PROVIDER_REGION_MISMATCH',
        'PROVIDER_REQUEST_INVALID',
        'PROVIDER_RATE_LIMITED',
        'PROVIDER_TIMEOUT',
        'PROVIDER_EMPTY_RESULT',
        'RESULT_PERSIST_FAILED'
      ])
      if (providerErrors.has(errorCode) && this.taskErrorValue.message) return this.taskErrorValue.message
      return messages[errorCode] || this.taskErrorValue.message || ''
    },
    errorTypeLabel() {
      const type = this.taskErrorValue.type || ''
      if (!type) {
        return '无'
      }
      if (type === 'upload') {
        return '上传'
      }
      if (type === 'generate') {
        return '生成'
      }
      if (type === 'polling') {
        return '轮询'
      }
      return type
    },
    createdAtLabel() {
      return (this.currentTaskValue && this.currentTaskValue.createdAt) || '暂无记录'
    },
    submittedAtLabel() {
      return (this.currentTaskValue && this.currentTaskValue.submittedAt) || '暂无记录'
    },
    completedAtLabel() {
      return (this.currentTaskValue && this.currentTaskValue.completedAt) || '暂无记录'
    },
    canRetryGenerate() {
      return !!this.taskControlValue.canRetry
    },
    canContinueQuery() {
      return !!this.taskControlValue.canContinuePolling
    },
    taskDeliveryStatus() {
      return (this.currentTaskValue && this.currentTaskValue.deliveryStatus) || 'pending_review'
    },
    taskDeliveryConfirmedAt() {
      return (this.currentTaskValue && this.currentTaskValue.deliveryConfirmedAt) || ''
    },
    taskDeliveryNote() {
      return (this.currentTaskValue && this.currentTaskValue.deliveryNote) || ''
    },
    deliveryStatusLabel() {
      if (this.taskDeliveryStatus === 'approved') {
        return '已通过'
      }
      if (this.taskDeliveryStatus === 'needs_revision') {
        return '待修改'
      }
      return '待审核'
    },
    deliveryConfirmedAtLabel() {
      return this.taskDeliveryConfirmedAt || '未确认'
    },
    hasResultOutput() {
      return this.hasTaskResult(this.currentTaskValue)
    },
    isCurrentTaskMockOrFallback() {
      return this.isMockOrFallbackTask(this.currentTaskValue)
    },
    canDeliverNow() {
      return this.hasResultOutput && this.taskStatusValue === 'success' && !this.isCurrentTaskMockOrFallback
    },
    needRetryOrWait() {
      return this.isFailedTaskStatus || this.isProcessingTaskStatus || !this.hasResultOutput
    },
    isFailedTaskStatus() {
      return normalizeTaskDisplayStatus(this.taskStatusValue) === 'failed'
    },
    isProcessingTaskStatus() {
      return shouldPollTask(this.taskStatusValue)
    },
    deliveryStateLabel() {
      if (this.canDeliverNow) {
        return '可交付'
      }
      if (this.isFailedTaskStatus) {
        return '失败，需重试'
      }
      if (this.isProcessingTaskStatus) {
        return '处理中，需等待'
      }
      return '等待结果'
    },
    deliveryGuidanceNote() {
      if (this.canDeliverNow) {
        return '当前任务已有可用结果，可以继续确认交付。'
      }
      if (this.isFailedTaskStatus) {
        return '结果生成失败，建议先重试或重新生成后再交付。'
      }
      if (this.isProcessingTaskStatus) {
        return '任务仍在处理中，请稍后查看生成结果。'
      }
      return '当前暂无完整结果，请等待生成完成或检查输入设置。'
    },
    recentDeliveryAudits() {
      return getTaskDeliveryAudits(this.currentTaskIdValue, 8)
    },
    latestResultReviewAction() {
      return this.recentResultReviewActions.length ? this.recentResultReviewActions[0] : null
    },
    hasResultReviewActionSummary() {
      return !!this.latestResultReviewAction
    },
    resultReviewActionLabel() {
      const action = (this.latestResultReviewAction && this.latestResultReviewAction.actionType) || ''
      if (action === 'approve_result') {
        return '审核通过'
      }
      if (action === 'mark_needs_revision') {
        return '标记待修改'
      }
      return action || '暂无'
    },
    resultReviewActionTone() {
      const action = (this.latestResultReviewAction && this.latestResultReviewAction.actionType) || ''
      if (action === 'approve_result') {
        return 'success'
      }
      if (action === 'mark_needs_revision') {
        return 'warning'
      }
      return 'default'
    },
    resultReviewActionSourceLabel() {
      const source = (this.latestResultReviewAction && this.latestResultReviewAction.actionSource) || ''
      if (source === 'Single Task Review') {
        return '单任务审核'
      }
      return source || '暂无'
    },
    resultReviewActionTypeLabel() {
      const action = (this.latestResultReviewAction && this.latestResultReviewAction.actionType) || ''
      if (action === 'approve_result') {
        return '审核通过'
      }
      if (action === 'mark_needs_revision') {
        return '标记待修改'
      }
      return '暂无'
    },
    resultReviewTriggeredFrom() {
      if (!this.hasResultReviewActionSummary) {
        return '暂无'
      }
      const triggeredFrom = this.latestResultReviewAction.triggeredFrom || ''
      if (triggeredFrom === 'result / Delivery Status actions') {
        return '结果页 / 交付状态操作'
      }
      return triggeredFrom || '暂无'
    },
    recentResultReviewActions() {
      if (!this.currentTaskIdValue) {
        return []
      }
      const list = getResultRecentDeliveryActions(this.currentTaskIdValue, 5)
      return list.map((item, index) => {
        const createdAt = item.createdAt || item.time || ''
        const rawActionType = item.actionType || ''
        const actionType = rawActionType === 'approve_result'
          ? '审核通过'
          : rawActionType === 'mark_needs_revision'
            ? '标记待修改'
            : rawActionType || '暂无'
        const rawActionSource = item.actionSource || 'Single Task Review'
        const actionSource = rawActionSource === 'Single Task Review' ? '单任务审核' : rawActionSource
        const rawTriggeredFrom = item.triggeredFrom || 'result / Delivery Status actions'
        const triggeredFrom = rawTriggeredFrom === 'result / Delivery Status actions' ? '结果页 / 交付状态操作' : rawTriggeredFrom
        return {
          actionLevel: item.actionLevel || 'result',
          actionType,
          actionSource,
          triggeredFrom,
          createdAt,
          time: createdAt,
          actionKey: [actionType, actionSource, triggeredFrom, createdAt, item.taskId || this.currentTaskIdValue || 'na', index].join('::')
        }
      })
    },
    resultReviewActionTimeLabel() {
      return (this.latestResultReviewAction && (this.latestResultReviewAction.createdAt || this.latestResultReviewAction.time)) || '暂无'
    },
    lastDeliverySyncAtLabel() {
      return (this.currentTaskValue && this.currentTaskValue.lastDeliverySyncAt) || '暂无记录'
    },
    lastDeliverySyncStatusLabel() {
      return (this.currentTaskValue && this.currentTaskValue.lastDeliverySyncStatus) || '未知'
    },
    lastDeliveryReconcileAtLabel() {
      return (this.currentTaskValue && this.currentTaskValue.lastDeliveryReconcileAt) || '暂无记录'
    },
    lastDeliveryReconcileStatusLabel() {
      return (this.currentTaskValue && this.currentTaskValue.lastDeliveryReconcileStatus) || '未知'
    },
    taskCompensationQueue() {
      return getTaskDeliveryQueue(this.currentTaskIdValue, ['pending', 'failed', 'retrying', 'resolved']).slice(0, 8)
    },
    pendingCompensationCount() {
      return getTaskDeliveryQueue(this.currentTaskIdValue, ['pending', 'failed', 'retrying']).length
    },
    currentProjectId() {
      return (this.currentTaskValue && this.currentTaskValue.projectId) || ''
    },
    currentBatchId() {
      return (this.currentTaskValue && this.currentTaskValue.batchId) || ''
    },
    batchTaskIds() {
      if (!this.currentBatchId) {
        return []
      }

      const batch = getBatchById(this.currentBatchId)
      if (batch && Array.isArray(batch.taskIds) && batch.taskIds.length) {
        return batch.taskIds
      }

      const byId = (this.chainState.tasks && this.chainState.tasks.byId) || {}
      return Object.keys(byId).filter((taskId) => {
        const task = byId[taskId]
        return task && task.batchId === this.currentBatchId
      })
    },
    batchTasksSorted() {
      const byId = (this.chainState.tasks && this.chainState.tasks.byId) || {}
      return this.batchTaskIds
        .map((taskId) => byId[taskId])
        .filter(Boolean)
        .sort((left, right) => {
          const leftTime = new Date(this.getTaskTimeValue(left)).getTime() || 0
          const rightTime = new Date(this.getTaskTimeValue(right)).getTime() || 0
          return rightTime - leftTime
        })
    },
    siblingTasks() {
      const currentTaskId = this.currentTaskIdValue

      return this.batchTasksSorted
        .filter((task) => task && task.taskId !== currentTaskId)
    },
    pendingReviewSiblingTasks() {
      return this.siblingTasks.filter((task) => this.hasTaskResult(task) && this.getTaskDeliveryStatus(task) === 'pending_review')
    },
    needsRevisionSiblingTasks() {
      return this.siblingTasks.filter((task) => this.hasTaskResult(task) && this.getTaskDeliveryStatus(task) === 'needs_revision')
    },
    deliverableSiblingTasks() {
      return this.siblingTasks.filter((task) => this.hasTaskResult(task) && this.getTaskDeliveryStatus(task) === 'approved')
    },
    siblingContextFocusGroup() {
      if (this.entryMode === 'delivery-view') {
        return 'deliverable'
      }
      if (this.entryMode === 'delivery-review' && this.reviewContext === 'pending_review') {
        return 'pending_review'
      }
      if (this.entryMode === 'delivery-review' && this.reviewContext === 'needs_revision') {
        return 'needs_revision'
      }
      return ''
    },
    effectiveSiblingFocusGroup() {
      return this.siblingManualFocusGroup || this.siblingContextFocusGroup
    },
    hasSiblingFocus() {
      return !!this.effectiveSiblingFocusGroup
    },
    siblingFocusGroupLabel() {
      if (this.effectiveSiblingFocusGroup === 'pending_review') {
        return '待审核'
      }
      if (this.effectiveSiblingFocusGroup === 'needs_revision') {
        return '待修改'
      }
      if (this.effectiveSiblingFocusGroup === 'deliverable') {
        return '可交付'
      }
      return '全部'
    },
    siblingGroups() {
      return [
        {
          key: 'pending_review',
          title: '待审核任务',
          mode: 'delivery-review',
          reviewContext: 'pending_review',
          tasks: this.pendingReviewSiblingTasks
        },
        {
          key: 'needs_revision',
          title: '待修改任务',
          mode: 'delivery-review',
          reviewContext: 'needs_revision',
          tasks: this.needsRevisionSiblingTasks
        },
        {
          key: 'deliverable',
          title: '可交付任务',
          mode: 'delivery-view',
          reviewContext: '',
          tasks: this.deliverableSiblingTasks
        }
      ]
    },
    focusedSiblingTasks() {
      if (this.effectiveSiblingFocusGroup === 'pending_review') {
        return this.pendingReviewSiblingTasks
      }
      if (this.effectiveSiblingFocusGroup === 'needs_revision') {
        return this.needsRevisionSiblingTasks
      }
      if (this.effectiveSiblingFocusGroup === 'deliverable') {
        return this.deliverableSiblingTasks
      }
      return this.siblingTasks
    },
    recommendedSiblingTask() {
      return this.focusedSiblingTasks.length ? this.focusedSiblingTasks[0] : null
    },
    nextRecommendedSiblingTask() {
      if (!this.recommendedSiblingTask || !this.focusedSiblingTasks.length) {
        return null
      }
      const currentIndex = this.focusedSiblingTasks.findIndex((task) => task && task.taskId === this.recommendedSiblingTask.taskId)
      if (currentIndex < 0) {
        return null
      }
      return this.focusedSiblingTasks[currentIndex + 1] || null
    },
    recommendedSiblingPosition() {
      if (!this.recommendedSiblingTask || !this.focusedSiblingTasks.length) {
        return '暂无'
      }
      const currentIndex = this.focusedSiblingTasks.findIndex((task) => task && task.taskId === this.recommendedSiblingTask.taskId)
      if (currentIndex < 0) {
        return '暂无'
      }
      return `${currentIndex + 1} / ${this.focusedSiblingTasks.length}`
    },
    recommendedSiblingShortSummary() {
      if (!this.recommendedSiblingTask) {
        return '当前聚焦分组暂无推荐同批任务。'
      }
      const task = this.recommendedSiblingTask
      const status = formatTaskStatusLabel(task.status)
      const rawDeliveryStatus = this.getTaskDeliveryStatus(task)
      const deliveryStatus = rawDeliveryStatus === 'approved'
        ? '已通过'
        : rawDeliveryStatus === 'needs_revision'
          ? '待修改'
          : '待审核'
      const hasResult = this.hasTaskResult(task) ? '是' : '否'
      const time = this.getTaskDisplayTime(task)
      return `状态=${status}，交付状态=${deliveryStatus}，已有结果=${hasResult}，时间=${time}`
    },
    recommendedSiblingActionMode() {
      if (this.effectiveSiblingFocusGroup === 'pending_review') {
        return 'delivery-review'
      }
      if (this.effectiveSiblingFocusGroup === 'needs_revision') {
        return 'delivery-review'
      }
      if (this.effectiveSiblingFocusGroup === 'deliverable') {
        return 'delivery-view'
      }
      if (!this.recommendedSiblingTask) {
        return this.entryMode || ''
      }
      const status = this.getTaskDeliveryStatus(this.recommendedSiblingTask)
      if (status === 'needs_revision' || status === 'pending_review') {
        return 'delivery-review'
      }
      if (status === 'approved') {
        return 'delivery-view'
      }
      return this.entryMode || ''
    },
    recommendedSiblingActionReviewContext() {
      if (this.effectiveSiblingFocusGroup === 'pending_review') {
        return 'pending_review'
      }
      if (this.effectiveSiblingFocusGroup === 'needs_revision') {
        return 'needs_revision'
      }
      if (this.effectiveSiblingFocusGroup === 'deliverable') {
        return ''
      }
      if (!this.recommendedSiblingTask) {
        return this.reviewContext || ''
      }
      const status = this.getTaskDeliveryStatus(this.recommendedSiblingTask)
      if (status === 'needs_revision') {
        return 'needs_revision'
      }
      if (status === 'pending_review') {
        return 'pending_review'
      }
      return this.reviewContext || ''
    },
    flowGroupKey() {
      if (this.effectiveSiblingFocusGroup) {
        return this.effectiveSiblingFocusGroup
      }
      if (this.needsRevisionSiblingTasks.length) {
        return 'needs_revision'
      }
      if (this.pendingReviewSiblingTasks.length) {
        return 'pending_review'
      }
      if (this.deliverableSiblingTasks.length) {
        return 'deliverable'
      }
      return 'all'
    },
    flowGroupLabel() {
      if (this.flowGroupKey === 'pending_review') {
        return '待审核'
      }
      if (this.flowGroupKey === 'needs_revision') {
        return '待修改'
      }
      if (this.flowGroupKey === 'deliverable') {
        return '可交付'
      }
      return '全部'
    },
    focusedFlowTasks() {
      if (!this.currentBatchId) {
        return []
      }
      if (this.flowGroupKey === 'all') {
        return this.batchTasksSorted
      }
      return this.batchTasksSorted.filter((task) => this.taskMatchesSiblingGroup(task, this.flowGroupKey))
    },
    nextFocusedSiblingTask() {
      if (!this.focusedFlowTasks.length) {
        return null
      }
      const currentTaskId = this.currentTaskIdValue
      const currentIndex = this.focusedFlowTasks.findIndex((task) => task && task.taskId === currentTaskId)
      if (currentIndex >= 0 && currentIndex < this.focusedFlowTasks.length - 1) {
        return this.focusedFlowTasks[currentIndex + 1]
      }
      return this.focusedFlowTasks.find((task) => task && task.taskId !== currentTaskId) || null
    },
    canBackToBatchReview() {
      const mode = this.returnContext.mode || this.entryMode
      const reviewContext = this.returnContext.reviewContext || this.reviewContext
      return !!(this.currentBatchId && mode === 'delivery-review' && ['pending_review', 'needs_revision'].includes(reviewContext))
    },
    canBackToBatchDelivery() {
      const mode = this.returnContext.mode || this.entryMode
      return !!(this.currentBatchId && mode === 'delivery-view')
    },
    canBackToProjectReview() {
      const mode = this.returnContext.mode || this.entryMode
      const reviewContext = this.returnContext.reviewContext || this.reviewContext
      return !!(this.currentProjectId && mode === 'delivery-review' && ['pending_review', 'needs_revision'].includes(reviewContext))
    },
    nextPendingReviewTask() {
      return this.pendingReviewSiblingTasks[0] || null
    },
    nextNeedsRevisionTask() {
      return this.needsRevisionSiblingTasks[0] || null
    },
    nextDeliverableSiblingTask() {
      return this.deliverableSiblingTasks[0] || null
    },
    prioritySiblingGroup() {
      if (this.needsRevisionSiblingTasks.length > 0) {
        return 'needs_revision'
      }
      if (this.pendingReviewSiblingTasks.length > 0) {
        return 'pending_review'
      }
      if (this.deliverableSiblingTasks.length > 0) {
        return 'deliverable'
      }
      return 'none'
    },
    prioritySiblingGroupLabel() {
      if (this.prioritySiblingGroup === 'needs_revision') {
        return '待修改'
      }
      if (this.prioritySiblingGroup === 'pending_review') {
        return '待审核'
      }
      if (this.prioritySiblingGroup === 'deliverable') {
        return '可交付'
      }
      return '暂无'
    },
    prioritySiblingReason() {
      if (this.prioritySiblingGroup === 'needs_revision') {
        return `${this.needsRevisionSiblingTasks.length} 个同批结果需要修改，建议优先处理。`
      }
      if (this.prioritySiblingGroup === 'pending_review') {
        return `${this.pendingReviewSiblingTasks.length} 个同批结果待审核。`
      }
      if (this.prioritySiblingGroup === 'deliverable') {
        return `${this.deliverableSiblingTasks.length} 个同批结果可交付。`
      }
      return '当前暂无需要优先处理的同批结果。'
    },
    prioritySiblingActionLabel() {
      if (this.prioritySiblingGroup === 'needs_revision') {
        return '下一个待修改任务'
      }
      if (this.prioritySiblingGroup === 'pending_review') {
        return '下一个待审核任务'
      }
      if (this.prioritySiblingGroup === 'deliverable') {
        return '打开下一个可交付任务'
      }
      return '暂无优先操作'
    },
    prioritySiblingGroupCount() {
      if (this.prioritySiblingGroup === 'needs_revision') {
        return this.needsRevisionSiblingTasks.length
      }
      if (this.prioritySiblingGroup === 'pending_review') {
        return this.pendingReviewSiblingTasks.length
      }
      if (this.prioritySiblingGroup === 'deliverable') {
        return this.deliverableSiblingTasks.length
      }
      return 0
    },
    prioritySiblingActionEnabled() {
      if (this.prioritySiblingGroup === 'needs_revision') {
        return !!this.nextNeedsRevisionTask
      }
      if (this.prioritySiblingGroup === 'pending_review') {
        return !!this.nextPendingReviewTask
      }
      if (this.prioritySiblingGroup === 'deliverable') {
        return !!this.nextDeliverableSiblingTask
      }
      return false
    }
  },
  methods: {
    getProductionItemStatusLabel(status = '') {
      return getTaskStatusMeta(status).label
    },
    selectProductionItem(index = 0) {
      const item = this.productionResultItems[index]
      if (!item) return
      this.activeProductionItemIndex = index
      if (item.taskId && item.taskId !== this.currentTaskIdValue) {
        this.taskId = item.taskId
        patchMainChainState({ currentTaskId: item.taskId })
        this.refreshState()
        this.restoreTaskFromLocalState(item.taskId, this.currentBatchId || this.returnContext.batchId)
        this.ensureTaskDetailLoaded()
        this.startLocalTaskRefresh()
      }
    },
    retryProductionItem(item = {}) {
      if (!item.taskId || item.status !== 'failed') return
      const retried = retryWorkspaceProductionItem({
        historyId: this.productionResultSummary.historyId,
        batchId: this.productionResultSummary.batchId,
        taskId: item.taskId,
        itemType: item.itemType
      })
      if (!retried.ok || !retried.taskId) {
        uni.showToast({ title: '当前项目暂时无法重试', icon: 'none' })
        return
      }
      this.taskId = retried.taskId
      patchMainChainState({ currentTaskId: retried.taskId })
      this.refreshState()
      this.restoreTaskFromLocalState(retried.taskId, retried.batchId)
      this.startLocalTaskRefresh()
      uni.showToast({ title: '已重新生成本项素材', icon: 'none' })
    },
    regenerateCurrentStyleVariant() {
      const item = this.activeProductionItem
      if (!item || !item.taskId || item.status !== 'completed') return
      const nextTask = regenerateWork(item.taskId)
      const nextTaskId = nextTask && (nextTask.taskId || nextTask.id || nextTask.clientTaskId)
      if (!nextTaskId) {
        uni.showToast({ title: '当前方案暂时无法重新生成', icon: 'none' })
        return
      }
      uni.navigateTo({
        url: `/package-ai/result/result?taskId=${encodeURIComponent(nextTaskId)}`,
        fail: () => uni.showToast({ title: '任务已创建，请从生产记录查看', icon: 'none' })
      })
    },
    handleSaveWorks() {
      if (this.savingWorks) return
      uni.switchTab({ url: '/pages/gallery/gallery' })
    },
    saveAllProductionWorks() {
      const completedItems = this.completedProductionItems
      if (!completedItems.length) {
        uni.showToast({ title: '暂无可保存作品', icon: 'none' })
        return
      }
      this.workSaveFailed = false
      this.savingWorks = true
      this.$nextTick(() => this.persistCompletedWorks(completedItems))
    },
    persistCompletedWorks(completedItems = []) {
      let savedCount = 0
      let failedCount = 0
      completedItems.forEach((item) => {
        const work = getWorkDetail(item.taskId)
        if (work && work.isSaved) {
          savedCount += 1
          return
        }
        if (work && setWorkSaved(work.id, true)) savedCount += 1
        else failedCount += 1
      })
      this.savingWorks = false
      this.workSaveVersion += 1
      if (failedCount || savedCount !== completedItems.length) {
        this.workSaveFailed = true
        uni.showToast({ title: '保存失败，请稍后重试', icon: 'none' })
        return
      }
      const patternMasterId = String((this.taskParamsValue && this.taskParamsValue.patternMasterId) || '')
      if (patternMasterId) {
        const assetIds = completedItems.map((item) => {
          const work = getWorkDetail(item.taskId)
          return work && work.id
        }).filter(Boolean)
        linkPatternStructureAssets(patternMasterId, assetIds)
      }
      this.workSaveFailed = false
      uni.showToast({ title: '已保存到作品库', icon: 'success' })
    },
    autoPersistCompletedWorks() {
      const pendingItems = this.completedProductionItems.filter((item) => (
        item.taskId && !this.autoSavedTaskIds.includes(item.taskId)
      ))
      if (!pendingItems.length) return
      let changed = false
      pendingItems.forEach((item) => {
        const work = getWorkDetail(item.taskId)
        if (!work) return
        const saved = work.isSaved ? work : setWorkSaved(work.id, true)
        if (!saved) return
        this.autoSavedTaskIds.push(item.taskId)
        changed = true
      })
      if (changed) this.workSaveVersion += 1
    },
    saveOrOpenPatternLibrary() {
      if (this.savingPattern) return
      if (this.patternMasterIdValue) {
        openWebsiteFeature('pattern_library')
        return
      }
      const params = this.taskParamsValue || {}
      const taskIds = this.productionResultItems.map((item) => item.taskId).filter(Boolean)
      const assetIds = this.productionResultItems.map((item) => {
        const work = getWorkDetail(item.taskId)
        return work && work.id
      }).filter(Boolean)
      this.savingPattern = true
      const result = savePatternStructureToLibrary({
        title: params.planName || '服装打版结构方案',
        category: params.category || '',
        categoryLabel: params.categoryLabel || '',
        inputMode: params.inputMode || 'garment_photo',
        sourceImages: { frontImage: params.frontImage || '', backImage: params.backImage || '', sideImage: params.sideImage || '', structureSketch: params.structureSketch || '', designSketch: params.designSketch || '' },
        baseSize: params.baseSize || '',
        measurementBasis: params.measurementBasis || 'body',
        measurements: params.measurements || {},
        structureRequirements: params.structureRequirements || {},
        notes: params.notes || '',
        requestedOutputs: params.requestedOutputs || [],
        historyId: this.productionResultSummary.historyId || this.historyId || '',
        batchId: this.productionResultSummary.batchId || this.currentBatchId || '',
        taskIds,
        assetIds
      })
      this.savingPattern = false
      if (!result.ok) {
        uni.showToast({ title: result.message || '版型保存失败', icon: 'none' })
        return
      }
      this.savedPatternMasterId = result.data.master.patternMasterId
      uni.showToast({ title: result.status === 'existing' ? '版型已在库中' : '已保存至版型库', icon: 'success' })
    },
    downloadCurrentProductionItem() {
      const item = this.activeProductionItem
      if (!item || !item.imageUrl) return
      this.downloadHighResolutionImage(item.imageUrl)
    },
    editDetailPageLongImage() {
      const task = this.activeProductionTask || this.currentTaskValue || {}
      const taskId = task.taskId || this.currentTaskIdValue || ''
      const detailPageId = (((task.input || {}).params || {}).detailPageId) || ''
      if (!detailPageId && !taskId) {
        uni.showToast({ title: '未找到可编辑的详情页配置', icon: 'none' })
        return
      }
      uni.navigateTo({
        url: detailPageId
          ? `/package-ai/detail-long-image/detail-long-image?detailPageId=${encodeURIComponent(detailPageId)}`
          : `/package-ai/detail-long-image/detail-long-image?sourceTaskId=${encodeURIComponent(taskId)}`,
        fail: () => uni.showToast({ title: '详情页编辑器打开失败', icon: 'none' })
      })
    },
    openProductProfile() {
      if (!this.activeProductId) return
      uni.navigateTo({
        url: `/package-assets/product-profile/product-profile?productId=${encodeURIComponent(this.activeProductId)}`,
        fail: () => uni.showToast({ title: '商品档案页面打开失败', icon: 'none' })
      })
    },
    continueFromProductionItem(option = {}) {
      const item = this.activeProductionItem
      if (!item || !item.imageUrl) return
      const index = this.productionResultItems.findIndex((candidate) => candidate.taskId === item.taskId)
      this.selectProductionItem(index < 0 ? 0 : index)
      this.showContinueMenu = false
      this.$nextTick(() => this.goToContinueOptimize(option))
    },
    formatTaskStatusLabel,
    formatResultTime(value = '') {
      const date = value ? new Date(value) : null
      if (!date || !Number.isFinite(date.getTime())) return '刚刚'
      const pad = (number) => String(number).padStart(2, '0')
      return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
    },
    saveWorkToGallery() {
      if (!this.hasResultOutput || !this.currentTaskIdValue) {
        uni.showToast({
          title: '暂无可保存作品',
          icon: 'none'
        })
        return
      }
      const work = getWorkDetail(this.currentTaskIdValue)
      if (!work) {
        uni.showToast({
          title: '作品记录同步中',
          icon: 'none'
        })
        return
      }
      const savedWork = setWorkSaved(work.id, true)
      if (!savedWork) {
        uni.showToast({ title: '作品保存失败，请稍后重试', icon: 'none' })
        return
      }
      uni.showToast({
        title: '作品已保存',
        icon: 'success'
      })
      setTimeout(() => {
        uni.switchTab({
          url: '/pages/gallery/gallery'
        })
      }, 450)
    },
    async continueGenerate() {
      if (!this.canStartNewGeneration) return
      this.queryingTask = true
      try {
        const nextTask = await Promise.resolve(regenerateWork(this.currentTaskIdValue))
        const nextTaskId = nextTask && (nextTask.taskId || nextTask.id || nextTask.clientTaskId)
        if (!nextTaskId) {
          uni.showToast({
            title: '暂时无法继续生成',
            icon: 'none'
          })
          return
        }
        uni.navigateTo({
          url: `/package-ai/result/result?taskId=${encodeURIComponent(nextTaskId)}`
        })
      } catch (error) {
        uni.showToast({
          title: '重新生成失败',
          icon: 'none'
        })
      } finally {
        this.queryingTask = false
      }
    },
    goGenerateDetailPage() {
      this.goToContinueOptimize({
        action: 'detail_page',
        toolType: 'marketing',
        continueAction: 'detail_page'
      })
    },
    goGenerateMarketing() {
      this.goToContinueOptimize({
        action: 'marketing',
        toolType: 'marketing',
        continueAction: 'marketing'
      })
    },
    goGenerateMoreModelScenes() {
      this.goToContinueOptimize({
        action: 'scene_replace',
        toolType: 'scene',
        continueAction: 'scene_replace'
      })
    },
    goToPackageCenter() {
      uni.navigateTo({
        url: '/pages/package-center/package-center'
      })
    },
    buildContinueOptimizeContext(option = {}) {
      const task = this.currentTaskValue || this.currentTask || {}
      const params = this.taskParamsValue || {}
      const taskId = this.currentTaskIdValue || task.taskId || ''
      const contextId = `${taskId || 'result'}_${option.action || option.toolType || 'continue'}_${Date.now()}`
      const sourceImage = this.resultImageUrl || this.sourceDisplayImageUrl || this.clothImageUrl || ''
      const context = {
        contextId,
        taskId,
        assetId: task.assetId || params.assetId || '',
        resultImage: this.resultImageUrl || sourceImage,
        sourceImage,
        toolType: option.toolType || params.toolType || 'model',
        params: {
          ...params,
          continueFromTaskId: taskId,
          continueAction: option.action || '',
          continueSourceToolType: params.toolType || task.type || task.taskType || ''
        }
      }
      uni.setStorageSync(`${CONTINUE_CONTEXT_STORAGE_PREFIX}${contextId}`, context)
      return context
    },
    goToContinueOptimize(option = {}) {
      if (!this.resultImageUrl) {
        uni.showToast({
          title: '暂无可继续优化的作品',
          icon: 'none'
        })
        return
      }
      if (option.action === 'pose_replace') {
        uni.setStorageSync(POSE_REPLACE_DRAFT_KEY, {
          version: 1,
          updatedAt: Date.now(),
          currentStep: 2,
          poseSource: 'preset',
          posePreset: '',
          baseImage: { localPath: this.resultImageUrl, remoteUrl: this.resultImageUrl, status: 'ready', error: '' },
          poseReferenceImage: { localPath: '', remoteUrl: '', status: 'idle', error: '' }
        })
        uni.navigateTo({ url: '/package-ai/change-pose/change-pose' })
        return
      }
      const context = this.buildContinueOptimizeContext(option)
      const query = [
        `toolType=${encodeURIComponent(context.toolType || 'model')}`,
        `continueContextId=${encodeURIComponent(context.contextId)}`
      ]
      if (option.continueAction) {
        query.push(`continueAction=${encodeURIComponent(option.continueAction)}`)
      }
      uni.navigateTo({
        url: `/package-ai/simple-ai-workbench/simple-ai-workbench?${query.join('&')}`
      })
    },
    togglePromptPlanExpanded() {
      this.promptPlanExpanded = !this.promptPlanExpanded
    },
    formatPromptPlanForCopy() {
      return this.promptPlanRows
        .map((item) => `${item.label}：${item.value}`)
        .join('\n')
    },
    copyPromptPlan() {
      const content = this.formatPromptPlanForCopy()
      if (!content) {
        uni.showToast({
          title: '暂无方案可复制',
          icon: 'none'
        })
        return
      }
      uni.setClipboardData({
        data: content,
        success: () => {
          uni.showToast({
            title: '方案已复制',
            icon: 'success'
          })
        }
      })
    },
    resolveContextTargetSectionId(mode = '', reviewContext = '') {
      if (mode === 'delivery-view') {
        return 'section-result-display'
      }
      if (mode === 'delivery-review' && reviewContext === 'pending_review') {
        return 'section-delivery-status'
      }
      if (mode === 'delivery-review' && reviewContext === 'needs_revision') {
        return 'section-delivery-note'
      }
      return ''
    },
    scheduleContextAutoFocus() {
      if (!this.contextTargetSectionId || this.hasAutoFocusedByContext) {
        return
      }
      let targetSectionId = this.contextTargetSectionId
      if (
        this.entryMode === 'delivery-review' &&
        this.reviewContext === 'needs_revision' &&
        this.displayErrorMessage
      ) {
        targetSectionId = 'section-error-info'
      }
      this.$nextTick(() => {
        setTimeout(() => {
          this.focusSectionById(targetSectionId)
        }, 100)
      })
    },
    focusSectionById(sectionId) {
      if (!sectionId) {
        return
      }
      const fallback = 'section-delivery-status'
      uni.pageScrollTo({
        selector: `#${sectionId}`,
        duration: 240,
        fail: () => {
          uni.pageScrollTo({
            selector: `#${fallback}`,
            duration: 180
          })
        },
        complete: () => {
          this.hasAutoFocusedByContext = true
        }
      })
    },
    getRecentResultActionKey(item) {
      if (!item) {
        return ''
      }
      if (item.actionKey) {
        return item.actionKey
      }
      return [
        item.actionType || 'unknown',
        item.actionSource || 'na',
        item.triggeredFrom || 'na',
        item.createdAt || item.time || 'na'
      ].join('::')
    },
    resolveResultActionSectionId(actionType = '') {
      if (actionType === 'approve_result') {
        return 'section-delivery-status'
      }
      if (actionType === 'mark_needs_revision') {
        return 'section-delivery-note'
      }
      return 'section-delivery-audit'
    },
    isRecentResultActionActive(item) {
      const key = this.getRecentResultActionKey(item)
      if (!key) {
        return false
      }
      if (this.activeRecentResultActionKey) {
        return this.activeRecentResultActionKey === key
      }
      const first = (this.recentResultReviewActions && this.recentResultReviewActions[0]) || null
      return !!first && key === this.getRecentResultActionKey(first)
    },
    focusRecentResultAction(item) {
      if (!item) {
        return
      }
      this.activeRecentResultActionKey = this.getRecentResultActionKey(item)
      const targetSectionId = this.resolveResultActionSectionId(item.actionType)
      this.focusSectionById(targetSectionId)
      this.$nextTick(() => {
        setTimeout(() => {
          this.focusSectionById(targetSectionId)
        }, 220)
      })
    },
    isTcbTempUrl(url = '') {
      const normalizedUrl = String(url || '')
      return /^https:\/\/.*\.tcb\.qcloud\.la\//.test(normalizedUrl) && /[?&]sign=/.test(normalizedUrl)
    },
    getCloudFileIdFromAsset(asset = {}) {
      const fileId = asset.fileId || asset.file_id || asset.fileID || ''
      return /^cloud:\/\//.test(String(fileId || '')) ? fileId : ''
    },
    getStableLocalPreview(asset = {}) {
      return asset.localPath || asset.tempFilePath || asset.path || ''
    },
    getAssetHttpsUrl(asset = {}) {
      const candidates = [
        asset.fileUrl,
        asset.file_url,
        asset.imageUrl,
        asset.image_url,
        asset.url,
        asset.downloadUrl,
        asset.download_url,
        asset.tempFileURL,
        asset.tempFileUrl
      ]
      return candidates.find((value) => /^https:\/\//.test(String(value || ''))) || ''
    },
    resolveDisplayImageUrlSync(asset = {}) {
      const localPreview = this.getStableLocalPreview(asset)
      if (localPreview) {
        return localPreview
      }
      const httpsUrl = this.getAssetHttpsUrl(asset)
      if (httpsUrl && !this.isTcbTempUrl(httpsUrl)) {
        return httpsUrl
      }
      return ''
    },
    getSourceClothImageAsset() {
      const currentAssets = this.taskAssetsValue || {}
      const draftInput = this.draftTaskValue.input || {}
      const draftAssets = draftInput.assets || {}
      const candidates = [
        currentAssets.clothImage,
        currentAssets.cloth_image,
        draftAssets.clothImage,
        draftAssets.cloth_image,
        this.taskInputValue.clothImage,
        this.taskInputValue.cloth_image,
        this.clothImageValue
      ].filter(Boolean)
      return candidates.find((asset) =>
        this.getStableLocalPreview(asset) ||
        this.getCloudFileIdFromAsset(asset) ||
        this.getAssetHttpsUrl(asset)
      ) || candidates[0] || {}
    },
    getDisplayImageAssetKey(asset = {}, reason = '') {
      return [
        reason,
        this.currentTaskIdValue || '',
        this.getStableLocalPreview(asset) || '',
        this.getCloudFileIdFromAsset(asset) || '',
        this.getAssetHttpsUrl(asset) || ''
      ].join('|')
    },
    async resolveDisplayImageFromAsset(asset = {}, reason = '') {
      const localPreview = this.getStableLocalPreview(asset)
      const cloudFileId = this.getCloudFileIdFromAsset(asset)
      const oldHttpsUrl = this.getAssetHttpsUrl(asset)
      const logSummary = {
        reason,
        hasLocalPath: !!localPreview,
        hasCloudFileId: !!cloudFileId,
        hasOldHttpsUrl: !!oldHttpsUrl,
        refreshedTempUrl: false,
        status: ''
      }

      if (localPreview) {
        console.log('[result:image-display] resolved source image', {
          ...logSummary,
          status: 'local_preview'
        })
        return localPreview
      }

      if (cloudFileId && typeof wx !== 'undefined' && wx.cloud && wx.cloud.getTempFileURL) {
        try {
          const response = await new Promise((resolve, reject) => {
            wx.cloud.getTempFileURL({
              fileList: [cloudFileId],
              success: resolve,
              fail: reject
            })
          })
          const file = response && Array.isArray(response.fileList) ? response.fileList[0] : null
          const status = file && file.status
          const tempFileURL = file && file.tempFileURL
          if (status === 0 && /^https:\/\//.test(String(tempFileURL || ''))) {
            console.log('[result:image-display] resolved source image', {
              ...logSummary,
              refreshedTempUrl: true,
              status
            })
            return tempFileURL
          }
          console.warn('[result:image-display] temp url refresh failed', {
            ...logSummary,
            status
          })
        } catch (error) {
          console.warn('[result:image-display] temp url refresh failed', {
            ...logSummary,
            status: 'request_failed'
          })
        }
      }

      if (oldHttpsUrl && !this.isTcbTempUrl(oldHttpsUrl)) {
        console.log('[result:image-display] resolved source image', {
          ...logSummary,
          status: 'stable_https'
        })
        return oldHttpsUrl
      }

      console.warn('[result:image-display] source image unavailable', {
        ...logSummary,
        status: oldHttpsUrl ? 'stale_tcb_temp_url' : 'missing_remote_image'
      })
      return ''
    },
    async resolveDisplayImages() {
      const sourceAsset = this.getSourceClothImageAsset()
      const sourceKey = this.getDisplayImageAssetKey(sourceAsset, 'source')
      if (sourceKey !== this.sourceDisplayImageKey || !this.sourceDisplayImageUrl) {
        this.sourceDisplayImageKey = sourceKey
        this.sourceDisplayImageUrl = this.resolveDisplayImageUrlSync(sourceAsset)
        const sourceUrl = await this.resolveDisplayImageFromAsset(sourceAsset, 'source')
        if (sourceKey === this.sourceDisplayImageKey) {
          this.sourceDisplayImageUrl = sourceUrl
        }
      }

      if (this.isMvpPrimaryClothTask) {
        this.styleDisplayImageUrl = ''
        this.styleDisplayImageKey = ''
        return
      }

      const styleKey = this.getDisplayImageAssetKey(this.styleImageValue, 'style')
      if (styleKey !== this.styleDisplayImageKey || !this.styleDisplayImageUrl) {
        this.styleDisplayImageKey = styleKey
        this.styleDisplayImageUrl = this.resolveDisplayImageUrlSync(this.styleImageValue)
        const styleUrl = await this.resolveDisplayImageFromAsset(this.styleImageValue, 'style')
        if (styleKey === this.styleDisplayImageKey) {
          this.styleDisplayImageUrl = styleUrl
        }
      }
    },
    refreshState() {
      this.chainState = getMainChainState()
      const task = this.currentTaskValue || this.currentTask || {}
      const taskResult = task.result || {}
      console.log('[result:compare] resolved images', {
        taskId: this.currentTaskIdValue,
        hasSourceImage: !!(this.sourceDisplayImageUrl || this.sourceClothImageUrl),
        hasResultImage: !!this.resultImageUrl
      })
      console.log('[result:task] loaded', {
        taskId: this.currentTaskIdValue,
        status: task.status || task.taskStatus || task.stage || '',
        hasResultImageUrl: !!(task.resultImageUrl || task.result_image_url),
        hasResultImage: !!(taskResult.image || taskResult.imageUrl || taskResult.image_url || this.resultImageUrl)
      })
      this.resolveDisplayImages()
      this.$nextTick(() => this.autoPersistCompletedWorks())
    },
    isLocalMockTask(task = this.currentTaskValue) {
      const taskId = this.getTaskIdentity(task) || this.currentTaskIdValue || ''
      return /^mock_generate_/.test(String(taskId || '')) ||
        (task && task.mock === true) ||
        (task && task.provider === 'deterministic_canvas') ||
        (task && task.result && task.result.meta && task.result.meta.renderer === 'deterministic_canvas') ||
        (task && task.provider === 'mock') ||
        (task && task.result && task.result.mock === true)
    },
    startLocalTaskRefresh() {
      this.stopLocalTaskRefresh()
      const taskId = this.currentTaskIdValue
      const task = getTask(taskId)
      if (!taskId) {
        return
      }
      this.localTaskRefreshActive = true
      this.taskRefreshStartedAt = Date.now()
      this.taskRefreshError = ''
      if (task) this.currentTask = task
      this.refreshState()
      if (task && !this.shouldContinueTaskRefresh(task)) {
        return
      }
      const refresh = async () => {
        if (!this.localTaskRefreshActive) return
        if (this.detailLoading || this._resultRefreshInFlight) {
          this.scheduleNextTaskRefresh(refresh, 500)
          return
        }
        this._resultRefreshInFlight = true
        try {
          if (!this.isLocalMockTask(task)) {
            const taskIds = this.getResultRefreshTaskIds()
            for (const currentId of taskIds) {
              if (!this.localTaskRefreshActive) return
              await loadTaskDetailIntoState(currentId)
            }
          }
          const latestTask = getTask(taskId)
          if (latestTask) this.currentTask = latestTask
          this.taskRefreshError = ''
          this.refreshState()
          if (latestTask && !this.shouldContinueTaskRefresh(latestTask)) {
            this.stopLocalTaskRefresh()
            return
          }
        } catch (error) {
          this.taskRefreshError = (error && error.message) || '任务状态暂时无法刷新'
        } finally {
          this._resultRefreshInFlight = false
        }
        if (!this.localTaskRefreshActive) return
        const elapsed = Date.now() - this.taskRefreshStartedAt
        this.scheduleNextTaskRefresh(refresh, elapsed < 30000 ? 2000 : 5000)
      }
      this.scheduleNextTaskRefresh(refresh, 250)
    },
    scheduleNextTaskRefresh(refresh, delay) {
      if (!this.localTaskRefreshActive) return
      if (this.localTaskRefreshTimer) clearTimeout(this.localTaskRefreshTimer)
      this.localTaskRefreshTimer = setTimeout(refresh, delay)
    },
    getResultRefreshTaskIds() {
      return Array.from(new Set([
        this.currentTaskIdValue,
        ...this.productionResultItems.map((item) => item.taskId)
      ].filter(Boolean)))
    },
    shouldContinueTaskRefresh(task = {}) {
      const pendingItems = this.productionResultItems.some((item) => ['pending', 'generating', 'unknown'].includes(item.status))
      const summary = this.productionResultSummary || {}
      const expected = Math.max(
        1,
        Number(summary.totalCount) || 0,
        Number(task.expectedOutputCount) || 0,
        Number(((task.input || {}).options || {}).expectedOutputCount) || 0,
        Number(((task.input || {}).options || {}).outputCount) || 0
      )
      const settled = Math.max(0, Number(summary.completedCount) || 0) + Math.max(0, Number(summary.failedCount) || 0)
      return shouldPollTask(task.status || task.stage) || pendingItems || settled < expected
    },
    stopLocalTaskRefresh() {
      this.localTaskRefreshActive = false
      if (this.localTaskRefreshTimer) {
        clearTimeout(this.localTaskRefreshTimer)
        this.localTaskRefreshTimer = null
      }
    },
    resolveTaskIdFromOptions(options = {}) {
      return String(
        (options && (options.taskId || options.task_id || options.id)) ||
        this.taskId ||
        ''
      ).trim()
    },
    getTaskIdentity(task) {
      return String((task && (task.taskId || task.id || task.clientTaskId)) || '').trim()
    },
    getBatchEmbeddedTasks(batch = {}) {
      return [batch.tasks, batch.taskList, batch.items].reduce((list, value) => {
        if (Array.isArray(value)) {
          value.forEach((task) => {
            if (task && this.getTaskIdentity(task)) {
              list.push(task)
            }
          })
        }
        return list
      }, [])
    },
    findTaskInBatch(batch, taskId) {
      const normalizedTaskId = String(taskId || '').trim()
      if (!batch || !normalizedTaskId) {
        return null
      }
      return this.getBatchEmbeddedTasks(batch).find((task) => this.getTaskIdentity(task) === normalizedTaskId) || null
    },
    findTaskInStateBatches(state = {}, taskId = '', preferredBatchId = '') {
      const normalizedTaskId = String(taskId || '').trim()
      if (!normalizedTaskId) {
        return null
      }
      const batches = state.batches || {}
      const byId = batches.byId || {}
      const batchList = Array.isArray(batches.list)
        ? batches.list
        : Array.isArray(batches.allIds)
          ? batches.allIds.map((batchId) => byId[batchId]).filter(Boolean)
          : Object.keys(byId).map((batchId) => byId[batchId]).filter(Boolean)
      const orderedBatches = preferredBatchId && byId[preferredBatchId]
        ? [byId[preferredBatchId], ...batchList.filter((batch) => batch && batch.batchId !== preferredBatchId)]
        : batchList

      for (const batch of orderedBatches) {
        const task = this.findTaskInBatch(batch, normalizedTaskId)
        if (task) {
          return {
            task,
            source: 'mainChainState.batches'
          }
        }
      }
      return null
    },
    findTaskInBatchStore(taskId = '', preferredBatchId = '') {
      const normalizedTaskId = String(taskId || '').trim()
      if (!normalizedTaskId) {
        return null
      }

      if (preferredBatchId) {
        const preferredBatch = getBatchById(preferredBatchId)
        const preferredTask = this.findTaskInBatch(preferredBatch, normalizedTaskId)
        if (preferredTask) {
          return {
            task: preferredTask,
            source: 'batch.tasks'
          }
        }
      }

      const batches = getBatchList()
      for (const batch of batches) {
        const task = this.findTaskInBatch(batch, normalizedTaskId)
        if (task) {
          return {
            task,
            source: 'batchStore.batches'
          }
        }
      }
      return null
    },
    normalizeRestoredTask(task = {}, taskId = '', batchId = '') {
      const normalizedTaskId = String(taskId || this.getTaskIdentity(task)).trim()
      const resultImageUrl = this.getResultImageUrlFromTask(task)
      const result = task.result || {}
      const items = Array.isArray(result.items) ? result.items : []
      return {
        ...task,
        taskId: normalizedTaskId,
        batchId: task.batchId || batchId || '',
        resultImageUrl: task.resultImageUrl || task.result_image_url || resultImageUrl,
        result: {
          ...result,
          coverUrl: result.coverUrl || resultImageUrl,
          items: items.length
            ? items
            : (resultImageUrl
              ? [{
                  imageUrl: resultImageUrl,
                  fileUrl: resultImageUrl,
                  type: 'image'
                }]
              : [])
        }
      }
    },
    getResultImageUrlFromTask(task = {}) {
      const result = task.result || {}
      const items = Array.isArray(result.items) ? result.items : []
      const firstItem = items[0] || {}
      return task.resultImageUrl ||
        task.result_image_url ||
        result.coverUrl ||
        result.fileUrl ||
        result.file_url ||
        result.imageUrl ||
        result.image_url ||
        result.url ||
        firstItem.imageUrl ||
        firstItem.image_url ||
        firstItem.fileUrl ||
        firstItem.file_url ||
        firstItem.url ||
        ''
    },
    restoreTaskFromLocalState(taskId = this.currentTaskIdValue, batchId = this.currentBatchId || this.returnContext.batchId) {
      const normalizedTaskId = String(taskId || '').trim()
      const normalizedBatchId = String(batchId || '').trim()
      console.log('[result:task-restore] start', {
        taskId: normalizedTaskId,
        batchId: normalizedBatchId
      })

      if (!normalizedTaskId) {
        console.log('[result:task-restore] miss', {
          taskId: normalizedTaskId,
          batchId: normalizedBatchId,
          source: 'missing_task_id'
        })
        return null
      }

      const state = getMainChainState()
      const stateTask = state.tasks && state.tasks.byId && state.tasks.byId[normalizedTaskId]
      let app = null
      try {
        app = typeof getApp === 'function' ? getApp() : null
      } catch (error) {
        app = null
      }
      const appState = app && app.globalData && app.globalData.mainChainState
      const appStateTask = appState && appState.tasks && appState.tasks.byId && appState.tasks.byId[normalizedTaskId]
      const candidates = [
        stateTask && { task: stateTask, source: 'tasks.byId' },
        this.chainState && this.chainState.tasks && this.chainState.tasks.byId && this.chainState.tasks.byId[normalizedTaskId]
          ? { task: this.chainState.tasks.byId[normalizedTaskId], source: 'this.chainState.tasks.byId' }
          : null,
        appStateTask && { task: appStateTask, source: 'globalData.mainChainState.tasks.byId' },
        this.currentTask && this.getTaskIdentity(this.currentTask) === normalizedTaskId
          ? { task: this.currentTask, source: 'page.currentTask' }
          : null,
        this.findTaskInBatchStore(normalizedTaskId, normalizedBatchId),
        this.findTaskInStateBatches(state, normalizedTaskId, normalizedBatchId)
      ].filter(Boolean)

      const found = candidates.find((item) => this.getResultImageUrlFromTask(item.task)) || candidates[0]
      if (!found || !found.task) {
        console.log('[result:task-restore] miss', {
          taskId: normalizedTaskId,
          batchId: normalizedBatchId,
          source: 'local_state_and_batch_snapshots',
          hasResultImage: false,
          hasSourceImage: false
        })
        return null
      }

      const restoredTask = this.normalizeRestoredTask(found.task, normalizedTaskId, normalizedBatchId)
      const tasks = state.tasks || {}
      const byId = {
        ...(tasks.byId || {}),
        [normalizedTaskId]: restoredTask
      }
      const allIds = Array.isArray(tasks.allIds) ? [...tasks.allIds] : []
      if (!allIds.includes(normalizedTaskId)) {
        allIds.unshift(normalizedTaskId)
      }
      patchMainChainState({
        currentTaskId: normalizedTaskId,
        tasks: {
          ...tasks,
          byId,
          allIds
        }
      })
      this.taskId = normalizedTaskId
      this.currentTask = restoredTask
      this.chainState = getMainChainState()
      console.log('[result:task-restore] restored', {
        taskId: normalizedTaskId,
        batchId: restoredTask.batchId || normalizedBatchId,
        source: found.source,
        hasResultImage: !!this.getResultImageUrlFromTask(restoredTask),
        hasSourceImage: !!(
          resolveImageUrl(restoredTask.input && restoredTask.input.assets && restoredTask.input.assets.clothImage) ||
          resolveImageUrl(restoredTask.input && restoredTask.input.assets && restoredTask.input.assets.cloth_image)
        )
      })
      return restoredTask
    },
    shouldLoadTaskDetail() {
      if (!this.currentTaskIdValue) {
        return false
      }

      const localTask = getTask(this.currentTaskIdValue)
      if (localTask) {
        const status = normalizeTaskDisplayStatus(localTask.status || localTask.stage)
        return shouldPollTask(localTask.status || localTask.stage) || (
          status === 'completed' && !this.getResultImageUrlFromTask(localTask)
        )
      }

      if (!this.currentTaskValue) {
        return true
      }

      return hasIncompleteTaskDetail(this.currentTaskValue)
    },
    async ensureTaskDetailLoaded() {
      if (!this.shouldLoadTaskDetail() || this.detailLoading) {
        return
      }

      this.detailLoading = true
      try {
        await loadTaskDetailIntoState(this.currentTaskIdValue)
        this.refreshState()
      } catch (error) {
        uni.showToast({
          title: '加载详情失败',
          icon: 'none'
        })
      } finally {
        this.detailLoading = false
        this.scheduleContextAutoFocus()
      }
    },
    backToWorks() {
      if (this.returningToWorks) return
      this.returningToWorks = true
      const pages = typeof getCurrentPages === 'function' ? getCurrentPages() : []
      if (pages.length > 1) {
        uni.navigateBack({
          delta: 1,
          fail: () => this.switchToWorks()
        })
        return
      }
      this.switchToWorks()
    },
    switchToWorks() {
      uni.switchTab({
        url: '/pages/gallery/gallery',
        fail: () => { this.returningToWorks = false }
      })
    },
    goBack() {
      this.backToWorks()
    },
    goToTaskList() {
      uni.navigateTo({
        url: '/package-assets/task-list/task-list'
      })
    },
    goToUploadPage() {
      uni.navigateTo({
        url: '/package-ai/upload/upload'
      })
    },
    handleDownloadMainImage() {
      if (this.resultImageUrl) {
        this.saveImage()
        return
      }
      uni.showToast({
        title: '下载能力即将开放',
        icon: 'none'
      })
    },
    async handleGenerateMoreScenes() {
      const actionType = this.hasDevelopmentMode
        ? AI_POINT_ACTION_TYPES.HOT_STYLE_REMIX
        : AI_POINT_ACTION_TYPES.BASIC_BACKGROUND
      const consumeResult = await this.handleConsumeForAction(actionType)
      if (!consumeResult || !consumeResult.ok) {
        return
      }
      uni.showToast({
        title: '同款多场景能力即将开放',
        icon: 'none'
      })
    },
    getExtensionActionOption(actionType = '') {
      return this.extensionActionOptions.find((item) => item.actionType === actionType) || null
    },
    isRunwayVideoAction(actionType = '') {
      return String(actionType || '').indexOf('runway_video_') === 0
    },
    createExtensionResult(actionType, options = {}, pointsConsumed = 0, sourceIsMockOrFallback = false) {
      const actionOption = this.getExtensionActionOption(actionType) || {}
      const random = Math.random().toString(36).slice(2, 8)
      const isVideoAction = this.isRunwayVideoAction(actionType)
      const previewUrl = options.previewUrl || this.resultImageUrl || ''
      return {
        extensionTaskId: `ext_${Date.now()}_${random}`,
        sourceTaskId: this.currentTaskIdValue || '',
        actionType,
        title: actionOption.title || actionType || '二次加工结果',
        status: 'success',
        statusText: isVideoAction ? '走秀视频能力即将开放' : '已生成体验结果',
        sourceIsMockOrFallback,
        pointsConsumed,
        previewUrl,
        videoUrl: '',
        items: [
          {
            actionType,
            title: actionOption.title || actionType || '二次加工结果',
            previewUrl,
            videoUrl: '',
            options: {
              fabricType: options.fabricType || '',
              colorGroup: options.colorGroup || '',
              detailType: options.detailType || '',
              durationSec: options.durationSec || ''
            }
          }
        ],
        createdAt: new Date().toISOString()
      }
    },
    async callFabricReplacePlaceholder(options = {}) {
      const sourceImageUrl = this.resultImageUrl || ''
      const payload = {
        action: 'fabricReplace',
        sourceTaskId: this.currentTaskIdValue || '',
        sourceImageUrl,
        fabricType: options.fabricType || 'cotton_linen',
        idempotencyKey: this.buildQuotaGuardIdempotencyKey(AI_POINT_ACTION_TYPES.FABRIC_REPLACE)
      }

      console.log('[result:fabric-replace] placeholder call', {
        sourceTaskId: payload.sourceTaskId,
        fabricType: payload.fabricType,
        hasSourceImageUrl: !!payload.sourceImageUrl,
        hasIdempotencyKey: !!payload.idempotencyKey
      })

      try {
        const response = await wx.cloud.callFunction({
          name: 'ai_generate',
          data: payload
        })
        const rawResult = response && response.result ? response.result : {}
        const ok = !!(rawResult.ok || rawResult.success)
        console.log('[result:fabric-replace] placeholder result', {
          ok,
          taskId: rawResult.taskId || '',
          status: rawResult.status || '',
          hasResultImage: !!rawResult.resultImageUrl,
          provider: rawResult.data && rawResult.data.provider,
          actionType: rawResult.data && rawResult.data.actionType
        })
        return {
          ok,
          result: rawResult,
          resultImageUrl: rawResult.resultImageUrl || '',
          reasonText: ok ? '' : (rawResult.message || 'AI面料替换占位调用失败')
        }
      } catch (error) {
        console.warn('[result:fabric-replace] placeholder failed', {
          message: (error && (error.errMsg || error.message)) || 'fabric replace placeholder failed'
        })
        return {
          ok: false,
          result: null,
          resultImageUrl: '',
          reasonText: 'AI面料替换占位调用失败'
        }
      }
    },
    async handleExtensionAction(actionType, options = {}) {
      const currentTask = this.currentTaskValue || this.currentTask || {}
      const sourceIsMockOrFallback = this.isMockOrFallbackTask(currentTask)
      const remoteQuotaEnabled = this.isRemoteQuotaGuardEnabled()
      const costActionType = resolveCostActionType(actionType, options)

      console.log('[result:extension-action] submit', {
        actionType: costActionType,
        rawActionType: actionType,
        costActionType,
        taskId: this.currentTaskIdValue || '',
        sourceIsMockOrFallback,
        remoteQuotaEnabled
      })

      let pointsConsumed = 0
      if (sourceIsMockOrFallback) {
        uni.showToast({
          title: 'mock/fallback 任务仅生成体验结果，不扣正式额度',
          icon: 'none'
        })
      } else {
        const consumeResult = await this.handleConsumeForAction(actionType, options)
        if (!consumeResult || !consumeResult.ok) {
          console.warn('[result:extension-action] blocked', {
            actionType: costActionType,
            rawActionType: actionType,
            costActionType,
            taskId: this.currentTaskIdValue || '',
            reason: (consumeResult && (consumeResult.reason || consumeResult.reasonText)) || 'consume_failed',
            remoteQuotaEnabled
          })
          uni.showToast({
            title: (consumeResult && consumeResult.reasonText) || 'AI 点数不足',
            icon: 'none'
          })
          return null
        }
        pointsConsumed = getAiPointCost(costActionType)

        if (actionType === AI_POINT_ACTION_TYPES.FABRIC_REPLACE && ENABLE_REAL_FABRIC_REPLACE) {
          const fabricResult = await this.callFabricReplacePlaceholder(options)
          if (!fabricResult || !fabricResult.ok) {
            console.warn('[result:extension-action] blocked', {
              actionType: costActionType,
              rawActionType: actionType,
              costActionType,
              taskId: this.currentTaskIdValue || '',
              reason: (fabricResult && fabricResult.reasonText) || 'fabric_replace_placeholder_failed',
              remoteQuotaEnabled
            })
            uni.showToast({
              title: (fabricResult && fabricResult.reasonText) || 'AI面料替换占位调用失败',
              icon: 'none'
            })
            return null
          }

          const result = this.createExtensionResult(
            actionType,
            {
              ...options,
              previewUrl: fabricResult.resultImageUrl || this.resultImageUrl || ''
            },
            pointsConsumed,
            sourceIsMockOrFallback
          )
          this.extensionResults = [result].concat(this.extensionResults || [])
          console.log('[result:extension-action] fabric placeholder result created', {
            actionType,
            rawActionType: actionType,
            costActionType,
            extensionTaskId: result.extensionTaskId,
            sourceTaskId: result.sourceTaskId,
            pointsConsumed: result.pointsConsumed,
            hasPreviewUrl: !!result.previewUrl
          })
          uni.showToast({
            title: 'AI面料替换占位结果已生成',
            icon: 'success'
          })
          return result
        }
      }

      const result = this.createExtensionResult(actionType, options, pointsConsumed, sourceIsMockOrFallback)
      this.extensionResults = [result].concat(this.extensionResults || [])

      console.log('[result:extension-action] mock result created', {
        actionType,
        rawActionType: actionType,
        costActionType,
        extensionTaskId: result.extensionTaskId,
        sourceTaskId: result.sourceTaskId,
        sourceIsMockOrFallback: result.sourceIsMockOrFallback,
        pointsConsumed: result.pointsConsumed,
        status: result.status,
        hasPreviewUrl: !!result.previewUrl,
        hasVideoUrl: !!result.videoUrl
      })

      if (!sourceIsMockOrFallback) {
        uni.showToast({
          title: '已生成体验结果',
          icon: 'success'
        })
      }
      return result
    },
    canConsumeForAction(actionType, options = {}) {
      const costActionType = resolveCostActionType(actionType, options)
      const costValue = getAiPointCost(costActionType)
      const result = canConsumeAiPoints(costActionType, 1) || {}
      return {
        ...result,
        ok: !!result.ok,
        rawActionType: actionType,
        costActionType,
        actionType: costActionType,
        costValue,
        pointsConsumed: costValue,
        reason: result.reason || '',
        reasonText: result.reasonText || ''
      }
    },
    isRemoteQuotaGuardEnabled() {
      return !!(ENABLE_REMOTE_QUOTA_GUARD || remoteQuotaGuardEnabledForDevRuntime || this.remoteQuotaGuardEnabledForDev)
    },
    setRemoteQuotaGuardEnabledForDev(enabled) {
      const nextEnabled = !!enabled
      remoteQuotaGuardEnabledForDevRuntime = nextEnabled
      this.remoteQuotaGuardEnabledForDev = nextEnabled
      if (this.$set) {
        this.$set(this, 'remoteQuotaGuardEnabledForDev', nextEnabled)
      }
      console.log('[result:remote-quota-dev] set enabled', {
        enabled: this.remoteQuotaGuardEnabledForDev
      })
      return this.getRemoteQuotaGuardDebugInfo()
    },
    buildQuotaGuardIdempotencyKey(actionType = '') {
      const taskId = this.currentTaskIdValue || 'no_task'
      return `result_${actionType}_${taskId}_${Date.now()}`
    },
    async callRemoteQuotaGuard(action, payload = {}) {
      console.log('[result:remote-quota] call', {
        action,
        actionType: payload.actionType || '',
        sourceTaskId: payload.sourceTaskId || '',
        hasIdempotencyKey: !!payload.idempotencyKey
      })

      try {
        const response = await wx.cloud.callFunction({
          name: 'quota_guard',
          data: {
            action,
            ...payload
          }
        })
        const rawResult = response && response.result ? response.result : {}
        const record = rawResult && rawResult.data && rawResult.data.record
          ? rawResult.data.record
          : {}
        const usage = rawResult && rawResult.data && rawResult.data.usage
          ? rawResult.data.usage
          : {}
        console.log('[result:remote-quota] result', {
          ok: !!(rawResult.ok || rawResult.success),
          reason: rawResult.reason || '',
          costValue: record.costValue,
          beforeValue: record.beforeValue,
          afterValue: record.afterValue,
          monthlyAiPointsUsed: usage.monthlyAiPointsUsed
        })
        return {
          ok: !!(rawResult.ok || rawResult.success),
          reason: rawResult.reason || '',
          reasonText: rawResult.reasonText || '',
          result: rawResult
        }
      } catch (error) {
        console.warn('[result:remote-quota] failed', {
          action,
          actionType: payload.actionType || '',
          message: (error && (error.errMsg || error.message)) || 'quota guard failed'
        })
        return {
          ok: false,
          reason: 'remote_quota_guard_failed',
          reasonText: '远程额度校验失败',
          result: null
        }
      }
    },
    async handleConsumeForAction(actionType, options = {}) {
      const costActionType = resolveCostActionType(actionType, options)
      const costValue = getAiPointCost(costActionType)
      if (this.isRemoteQuotaGuardEnabled()) {
        const remoteResult = await this.callRemoteQuotaGuard('consumeAiPoints', {
          actionType: costActionType,
          sourceTaskId: this.currentTaskIdValue || '',
          idempotencyKey: this.buildQuotaGuardIdempotencyKey(costActionType)
        })
        if (!remoteResult.ok) {
          uni.showToast({
            title: remoteResult.reasonText || 'AI 点数不足，可购买点数包或升级套餐',
            icon: 'none'
          })
          return {
            ...remoteResult,
            ok: false,
            rawActionType: actionType,
            costActionType,
            actionType: costActionType,
            costValue,
            pointsConsumed: 0,
            reason: remoteResult.reason || '',
            reasonText: remoteResult.reasonText || ''
          }
        }
        const record = remoteResult.result && remoteResult.result.data && remoteResult.result.data.record
          ? remoteResult.result.data.record
          : {}
        console.log('[result:ai-points] consumed', {
          actionType: costActionType,
          rawActionType: actionType,
          costActionType,
          pointsConsumed: record.costValue,
          pointsBefore: record.beforeValue,
          pointsAfter: record.afterValue,
          membershipTier: record.membershipTier || ''
        })
        return {
          ...remoteResult,
          ok: true,
          rawActionType: actionType,
          costActionType,
          actionType: costActionType,
          costValue: record.costValue || costValue,
          pointsConsumed: record.costValue || costValue,
          pointsBefore: record.beforeValue,
          pointsAfter: record.afterValue,
          reason: '',
          reasonText: ''
        }
      }

      const checkResult = this.canConsumeForAction(actionType, options)
      if (!checkResult || !checkResult.ok) {
        uni.showToast({
          title: (checkResult && checkResult.reasonText) || 'AI 点数不足',
          icon: 'none'
        })
        return {
          ...(checkResult || {}),
          ok: false,
          rawActionType: actionType,
          costActionType,
          actionType: costActionType,
          costValue,
          pointsConsumed: 0,
          reason: (checkResult && checkResult.reason) || '',
          reasonText: (checkResult && checkResult.reasonText) || ''
        }
      }
      const result = consumeAiPoints(costActionType, 1)

      console.log('[result:ai-points] consumed', {
        actionType: costActionType,
        rawActionType: actionType,
        costActionType,
        pointsConsumed: result.cost,
        pointsBefore: result.quotaBefore,
        pointsAfter: result.quotaAfter,
        membershipTier: result.membershipTier
      })
      return {
        ...result,
        ok: true,
        rawActionType: actionType,
        costActionType,
        actionType: costActionType,
        costValue: result.cost || costValue,
        pointsConsumed: result.cost || costValue,
        pointsBefore: result.quotaBefore,
        pointsAfter: result.quotaAfter,
        reason: '',
        reasonText: ''
      }
    },
    async buildRefineQuotaContext() {
      const summary = getMembershipUsageSummary()
      const membershipTier = summary.membershipTier || this.currentMembershipTier
      if (membershipTier === 'self_799') {
        uni.showToast({
          title: '自助会员精修需按张购买',
          icon: 'none'
        })
        return {
          ok: true,
          membershipTier,
          quotaBefore: summary.monthlyRefineUsed || 0,
          quotaAfter: summary.monthlyRefineUsed || 0,
          quotaConsumed: 0,
          quotaConsumeReason: this.isCurrentTaskMockOrFallback ? 'mock_or_fallback_intent' : 'self_pay_per_image_intent'
        }
      }
      if (this.isCurrentTaskMockOrFallback) {
        return {
          ok: true,
          membershipTier,
          quotaBefore: summary.monthlyRefineUsed || 0,
          quotaAfter: summary.monthlyRefineUsed || 0,
          quotaConsumed: 0,
          quotaConsumeReason: 'mock_or_fallback_intent'
        }
      }

      if (this.isRemoteQuotaGuardEnabled()) {
        const remoteResult = await this.callRemoteQuotaGuard('consumeRefineQuota', {
          sourceTaskId: this.currentTaskIdValue || '',
          idempotencyKey: this.buildQuotaGuardIdempotencyKey('basic_refine')
        })
        if (!remoteResult.ok) {
          uni.showToast({
            title: remoteResult.reasonText || '本月精修额度不足，可按张购买或升级套餐',
            icon: 'none'
          })
          return {
            ok: false,
            membershipTier,
            quotaBefore: 0,
            quotaAfter: 0,
            quotaConsumed: 0,
            quotaConsumeReason: remoteResult.reason || 'remote_refine_quota_failed'
          }
        }
        const record = remoteResult.result && remoteResult.result.data && remoteResult.result.data.record
          ? remoteResult.result.data.record
          : {}
        console.log('[result:refine-quota] consumed', {
          membershipTier: record.membershipTier || '',
          quotaBefore: record.beforeValue,
          quotaAfter: record.afterValue,
          quotaConsumed: record.costValue
        })
        return {
          ok: true,
          membershipTier: record.membershipTier || membershipTier,
          quotaBefore: record.beforeValue || 0,
          quotaAfter: record.afterValue || 0,
          quotaConsumed: record.costValue || 0,
          quotaConsumeReason: ''
        }
      }

      const consumeResult = consumeRefineQuota(1)
      if (!consumeResult || !consumeResult.ok) {
        uni.showToast({
          title: '本月精修额度不足，可按张购买或升级套餐',
          icon: 'none'
        })
        return {
          ok: false,
          membershipTier,
          quotaBefore: consumeResult && consumeResult.quotaBefore,
          quotaAfter: consumeResult && consumeResult.quotaAfter,
          quotaConsumed: 0,
          quotaConsumeReason: (consumeResult && consumeResult.reason) || 'insufficient_refine_quota'
        }
      }

      console.log('[result:refine-quota] consumed', {
        membershipTier: consumeResult.membershipTier,
        quotaBefore: consumeResult.quotaBefore,
        quotaAfter: consumeResult.quotaAfter,
        quotaConsumed: consumeResult.cost
      })
      return {
        ok: true,
        membershipTier: consumeResult.membershipTier,
        quotaBefore: consumeResult.quotaBefore,
        quotaAfter: consumeResult.quotaAfter,
        quotaConsumed: consumeResult.cost,
        quotaConsumeReason: ''
      }
    },
    async handleCreateRefineOrder() {
      const quotaContext = await this.buildRefineQuotaContext()
      if (!quotaContext || !quotaContext.ok) {
        return
      }

      const result = createRefineWorkOrderFromTask(this.currentTaskValue, {
        orderType: 'basic_refine',
        membershipTier: quotaContext.membershipTier,
        quotaConsumed: quotaContext.quotaConsumed,
        quotaBefore: quotaContext.quotaBefore,
        quotaAfter: quotaContext.quotaAfter,
        quotaConsumeReason: quotaContext.quotaConsumeReason
      })

      if (!result || !result.ok) {
        uni.showToast({
          title: (result && result.reasonText) || '无法申请人工精修',
          icon: 'none'
        })
        return
      }

      const order = result.order || {}
      console.log('[result:refine-order] created', {
        orderId: order.orderId,
        taskId: order.taskId,
        status: order.status,
        orderType: order.orderType,
        sourceIsMockOrFallback: !!order.sourceIsMockOrFallback,
        quotaConsumed: order.quotaConsumed || 0,
        quotaConsumeReason: order.quotaConsumeReason || ''
      })
      uni.showToast({
        title: '已提交人工精修意向',
        icon: 'none'
      })
    },
    handleSetBatchTemplate() {
      uni.showToast({
        title: '批量模板能力即将开放',
        icon: 'none'
      })
    },
    handleContinueDesignRemix() {
      uni.showToast({
        title: '线稿在线改款能力即将开放',
        icon: 'none'
      })
    },
    handleGenerateTechPack() {
      uni.showToast({
        title: 'AI 参考工艺单能力即将开放',
        icon: 'none'
      })
    },
    handleCreateOriginalProtectionPackage() {
      if (this.isCurrentTaskMockOrFallback) {
        uni.showToast({
          title: '占位/mock 结果不可生成原创保护材料包',
          icon: 'none'
        })
        return
      }

      if (!canUseFeature(this.currentMembershipTier, 'canCreateOriginalProtectionPackage')) {
        uni.showToast({
          title: '企业尊享会员可生成原创保护材料包',
          icon: 'none'
        })
        return
      }

      uni.showToast({
        title: '原创保护材料包能力即将开放',
        icon: 'none'
      })
    },
    setMockMembershipTier(tier) {
      const usage = setRepositoryMembershipTier(tier)
      this.currentMembershipTier = usage.currentTier
      return this.getMockMembershipUsageSummary()
    },
    setMockAiPointsUsed(points) {
      setRepositoryMockAiPointsUsed(points)
      return this.getMockMembershipUsageSummary()
    },
    setMockRefineUsed(count) {
      setRepositoryMockRefineUsed(count)
      return this.getMockMembershipUsageSummary()
    },
    getMockMembershipUsageSummary() {
      const summary = getMembershipUsageSummary()
      this.currentMembershipTier = summary.membershipTier || this.currentMembershipTier
      console.log('[result:membership-usage] summary', summary)
      return summary
    },
    getRemoteQuotaGuardDebugInfo() {
      return {
        enabled: this.isRemoteQuotaGuardEnabled(),
        hasCallRemoteQuotaGuard: typeof this.callRemoteQuotaGuard === 'function',
        currentTaskId: this.currentTaskIdValue || (this.currentTaskValue && this.currentTaskValue.taskId) || '',
        currentMembershipTier: this.currentMembershipTier || ''
      }
    },
    getFabricReplaceDebugInfo() {
      const currentTask = this.currentTaskValue || this.currentTask || {}
      return {
        enabled: ENABLE_REAL_FABRIC_REPLACE,
        actionType: AI_POINT_ACTION_TYPES.FABRIC_REPLACE,
        sourceIsMockOrFallback: this.isMockOrFallbackTask(currentTask),
        hasHandleExtensionAction: typeof this.handleExtensionAction === 'function',
        hasCallRemoteQuotaGuard: typeof this.callRemoteQuotaGuard === 'function',
        currentTaskId: this.currentTaskIdValue || (this.currentTaskValue && this.currentTaskValue.taskId) || ''
      }
    },
    goToServiceRequest() {
      const query = []
      if (this.currentTaskIdValue) {
        query.push(`taskId=${encodeURIComponent(this.currentTaskIdValue)}`)
      }
      if (this.resultImageUrl) {
        query.push('useCurrentResult=1')
      }
      uni.navigateTo({
        url: `/pages/service-request/service-request${query.length ? `?${query.join('&')}` : ''}`
      })
    },
    goToProjectDetail() {
      if (!this.currentProjectId) {
        return
      }

      const project = getProjectById(this.currentProjectId)
      if (!project) {
        uni.showToast({
          title: '未找到项目',
          icon: 'none'
        })
        return
      }

      const query = [`projectId=${encodeURIComponent(this.currentProjectId)}`]
      const mode = this.returnContext.mode || this.entryMode
      const reviewContext = this.returnContext.reviewContext || this.reviewContext
      if (mode) {
        query.push(`mode=${encodeURIComponent(mode)}`)
      }
      if (reviewContext) {
        query.push(`reviewContext=${encodeURIComponent(reviewContext)}`)
      }
      uni.navigateTo({
        url: `/package-mobile-enterprise/project-detail/project-detail?${query.join('&')}`
      })
    },
    goToBatchDetail() {
      if (!this.currentBatchId) {
        return
      }

      const batch = getBatchById(this.currentBatchId)
      if (!batch) {
        uni.showToast({
          title: '未找到批次',
          icon: 'none'
        })
        return
      }

      const query = [`batchId=${encodeURIComponent(this.currentBatchId)}`]
      const mode = this.returnContext.mode || this.entryMode
      const reviewContext = this.returnContext.reviewContext || this.reviewContext
      if (mode) {
        query.push(`mode=${encodeURIComponent(mode)}`)
      }
      if (reviewContext) {
        query.push(`reviewContext=${encodeURIComponent(reviewContext)}`)
      }
      uni.navigateTo({
        url: `/package-mobile-enterprise/batch-detail/batch-detail?${query.join('&')}`
      })
    },
    goBackToBatchReview() {
      if (!this.currentBatchId) {
        return
      }
      const reviewContext = this.returnContext.reviewContext || this.reviewContext || 'pending_review'
      uni.navigateTo({
        url: `/package-mobile-enterprise/batch-detail/batch-detail?batchId=${encodeURIComponent(this.currentBatchId)}&mode=delivery-review&reviewContext=${encodeURIComponent(reviewContext)}`
      })
    },
    goBackToBatchDelivery() {
      if (!this.currentBatchId) {
        return
      }
      uni.navigateTo({
        url: `/package-mobile-enterprise/batch-detail/batch-detail?batchId=${encodeURIComponent(this.currentBatchId)}&mode=delivery-view`
      })
    },
    goBackToProjectReview() {
      if (!this.currentProjectId) {
        return
      }
      const reviewContext = this.returnContext.reviewContext || this.reviewContext || 'pending_review'
      uni.navigateTo({
        url: `/package-mobile-enterprise/project-detail/project-detail?projectId=${encodeURIComponent(this.currentProjectId)}&mode=delivery-review&reviewContext=${encodeURIComponent(reviewContext)}`
      })
    },
    getTaskDeliveryStatus(task) {
      return (task && task.deliveryStatus) || 'pending_review'
    },
    buildCurrentResultTaskSnapshot(task = {}) {
      const pageTask = this.task || {}
      const pageResult = this.result || {}
      const currentTask = this.currentTask || {}
      const currentTaskValue = this.currentTaskValue || {}
      const currentResult = this.currentResult || {}
      const result = task.result || currentTask.result || currentTaskValue.result || pageResult || currentResult || {}

      return {
        ...pageTask,
        ...currentTaskValue,
        ...currentTask,
        ...task,
        taskId: task.taskId ||
          task.task_id ||
          task.id ||
          task.clientTaskId ||
          currentTask.taskId ||
          currentTask.task_id ||
          currentTask.id ||
          currentTaskValue.taskId ||
          currentTaskValue.task_id ||
          currentTaskValue.id ||
          pageTask.taskId ||
          pageTask.task_id ||
          this.taskId ||
          this.currentTaskId ||
          this.currentTaskIdValue ||
          '',
        task_id: task.task_id || currentTask.task_id || currentTaskValue.task_id || pageTask.task_id || this.task_id || '',
        provider: task.provider || currentTask.provider || currentTaskValue.provider || pageTask.provider || pageResult.provider || this.provider || '',
        source: task.source || currentTask.source || currentTaskValue.source || pageTask.source || pageResult.source || this.source || '',
        resultImageUrl: task.resultImageUrl ||
          task.result_image_url ||
          currentTask.resultImageUrl ||
          currentTask.result_image_url ||
          currentTaskValue.resultImageUrl ||
          currentTaskValue.result_image_url ||
          pageTask.resultImageUrl ||
          pageTask.result_image_url ||
          pageResult.resultImageUrl ||
          pageResult.result_image_url ||
          this.resultImageUrl ||
          this.result_image_url ||
          '',
        result_image_url: task.result_image_url || currentTask.result_image_url || currentTaskValue.result_image_url || pageTask.result_image_url || pageResult.result_image_url || this.result_image_url || '',
        task: task.task || currentTask || currentTaskValue || pageTask || {},
        result
      }
    },
    isMockOrFallbackTask(task = null) {
      const taskSnapshot = task || this.currentTaskValue || this.currentTask || {}
      const candidate = this.buildCurrentResultTaskSnapshot(taskSnapshot)
      const data = candidate.data || {}
      const result = candidate.result || {}
      return !!(
        this.isMockOrFallbackTaskId(candidate.taskId || candidate.id || candidate.clientTaskId) ||
        candidate.mock === true ||
        candidate.fallback === true ||
        data.mock === true ||
        data.fallback === true ||
        result.mock === true ||
        result.fallback === true ||
        candidate.provider === 'mock' ||
        data.provider === 'mock' ||
        result.provider === 'mock' ||
        (candidate.requestedProvider && candidate.provider && candidate.requestedProvider !== candidate.provider) ||
        (data.requestedProvider && data.provider && data.requestedProvider !== data.provider) ||
        (result.requestedProvider && result.provider && result.requestedProvider !== result.provider) ||
        candidate.fallbackReason ||
        data.fallbackReason ||
        result.fallbackReason
      )
    },
    isMockOrFallbackTaskId(taskId = '') {
      return /^mock_generate_/.test(String(taskId || ''))
    },
    shouldSkipDeliveryReconcileForMockTask(taskId = '') {
      if (this.isMockOrFallbackTaskId(taskId)) {
        return true
      }

      const state = getMainChainState()
      const tasks = state.tasks || {}
      const byId = tasks.byId || {}
      const draftTask = this.draftTaskValue || {}
      const candidates = [
        this.currentTaskValue,
        this.currentTask,
        byId[taskId],
        this.getTaskIdentity(draftTask) === String(taskId || '').trim() ? draftTask : null
      ].filter(Boolean)
      return candidates.some((task) => this.isMockOrFallbackTask(task))
    },
    getTaskUpdatedAtValue(task = {}) {
      const value =
        task.updatedAt ||
        task.deliveryConfirmedAt ||
        task.reviewedAt ||
        task.completedAt ||
        task.createdAt ||
        ''
      const time = value ? new Date(value).getTime() : 0
      return Number.isFinite(time) ? time : 0
    },
    hasPendingDeliveryCompensation(taskId = '') {
      if (!taskId) {
        return false
      }
      return getTaskDeliveryQueue(taskId, ['pending', 'failed', 'retrying']).length > 0
    },
    hasTaskResult(task) {
      if (!task) return false
      const result = task.result || {}
      const items = Array.isArray(result.items) ? result.items : (result.items ? [result.items] : [])
      const hasItemOutput = items.some((item) => {
        if (typeof item === 'string') return Boolean(item.trim())
        return Boolean(item && (item.imageUrl || item.image_url || item.fileUrl || item.file_url || item.url || item.videoUrl || item.video_url))
      })
      return Boolean(
        task.resultImageUrl ||
        task.result_image_url ||
        (typeof result === 'string' && result.trim()) ||
        result.coverUrl ||
        result.image ||
        result.imageUrl ||
        result.image_url ||
        result.fileUrl ||
        result.file_url ||
        result.videoUrl ||
        result.video_url ||
        hasItemOutput
      )
    },
    taskMatchesSiblingGroup(task, groupKey = '') {
      if (!task || !groupKey || groupKey === 'all') {
        return true
      }
      const status = this.getTaskDeliveryStatus(task)
      const hasResult = this.hasTaskResult(task)
      if (groupKey === 'pending_review') {
        return hasResult && status === 'pending_review'
      }
      if (groupKey === 'needs_revision') {
        return hasResult && status === 'needs_revision'
      }
      if (groupKey === 'deliverable') {
        return hasResult && status === 'approved'
      }
      return true
    },
    getTaskTimeValue(task) {
      return (task && (task.completedAt || task.updatedAt || task.submittedAt || task.createdAt)) || ''
    },
    getTaskDisplayTime(task) {
      return this.getTaskTimeValue(task) || '暂无'
    },
    goToSiblingTask(task) {
      if (!task || !task.taskId) {
        return
      }

      patchMainChainState({
        currentTaskId: task.taskId
      })

      const query = [`taskId=${encodeURIComponent(task.taskId)}`]
      if (this.currentBatchId) {
        query.push(`batchId=${encodeURIComponent(this.currentBatchId)}`)
      }
      if (this.currentProjectId) {
        query.push(`projectId=${encodeURIComponent(this.currentProjectId)}`)
      }
      if (this.entryMode) {
        query.push(`mode=${encodeURIComponent(this.entryMode)}`)
      }
      if (this.reviewContext) {
        query.push(`reviewContext=${encodeURIComponent(this.reviewContext)}`)
      }
      uni.redirectTo({
        url: `/package-ai/result/result?${query.join('&')}`
      })
    },
    isFocusedSiblingGroup(groupKey) {
      if (!this.hasSiblingFocus) {
        return false
      }
      return this.effectiveSiblingFocusGroup === groupKey
    },
    getVisibleSiblingGroupTasks(group) {
      const tasks = Array.isArray(group && group.tasks) ? group.tasks : []
      if (!this.hasSiblingFocus) {
        return tasks
      }
      if (this.isFocusedSiblingGroup(group.key)) {
        return tasks
      }
      return tasks.slice(0, this.compactSiblingLimit)
    },
    isRecommendedSiblingTask(groupKey, task) {
      if (!task || !task.taskId || !this.recommendedSiblingTask) {
        return false
      }
      if (groupKey !== this.effectiveSiblingFocusGroup) {
        return false
      }
      return task.taskId === this.recommendedSiblingTask.taskId
    },
    focusSiblingGroup(groupKey = '') {
      this.siblingManualFocusGroup = groupKey || ''
      this.$nextTick(() => {
        uni.pageScrollTo({
          selector: '#section-sibling-groups',
          duration: 220
        })
      })
    },
    resetSiblingFocus() {
      this.focusSiblingGroup('')
    },
    openNextFocusedSibling() {
      const task = this.nextFocusedSiblingTask
      if (!task || !task.taskId) {
        return
      }
      if (this.flowGroupKey === 'pending_review') {
        this.goToTaskWithContext(task, 'delivery-review', 'pending_review')
        return
      }
      if (this.flowGroupKey === 'needs_revision') {
        this.goToTaskWithContext(task, 'delivery-review', 'needs_revision')
        return
      }
      if (this.flowGroupKey === 'deliverable') {
        this.goToTaskWithContext(task, 'delivery-view', '')
        return
      }
      this.goToTaskWithContext(task, this.entryMode || '', this.reviewContext || '')
    },
    goToNextPendingReviewTask() {
      if (!this.nextPendingReviewTask) {
        return
      }
      this.goToTaskWithContext(this.nextPendingReviewTask, 'delivery-review', 'pending_review')
    },
    goToNextNeedsRevisionTask() {
      if (!this.nextNeedsRevisionTask) {
        return
      }
      this.goToTaskWithContext(this.nextNeedsRevisionTask, 'delivery-review', 'needs_revision')
    },
    openRecommendedSibling() {
      if (!this.recommendedSiblingTask) {
        uni.showToast({
          title: '暂无推荐同批任务',
          icon: 'none'
        })
        return
      }
      this.goToTaskWithContext(
        this.recommendedSiblingTask,
        this.recommendedSiblingActionMode,
        this.recommendedSiblingActionReviewContext
      )
    },
    openNextRecommendedSibling() {
      if (!this.nextRecommendedSiblingTask) {
        uni.showToast({
          title: '暂无下一个推荐任务',
          icon: 'none'
        })
        return
      }
      this.goToTaskWithContext(
        this.nextRecommendedSiblingTask,
        this.recommendedSiblingActionMode,
        this.recommendedSiblingActionReviewContext
      )
    },
    triggerPrioritySiblingAction() {
      if (this.prioritySiblingGroup === 'needs_revision' && this.nextNeedsRevisionTask) {
        this.goToNextNeedsRevisionTask()
        return
      }
      if (this.prioritySiblingGroup === 'pending_review' && this.nextPendingReviewTask) {
        this.goToNextPendingReviewTask()
        return
      }
      if (this.prioritySiblingGroup === 'deliverable' && this.nextDeliverableSiblingTask) {
        this.goToTaskWithContext(this.nextDeliverableSiblingTask, 'delivery-view', '')
        return
      }
      uni.showToast({
        title: '暂无优先同批任务',
        icon: 'none'
      })
    },
    goToTaskWithContext(task, mode = '', reviewContext = '') {
      if (!task || !task.taskId) {
        return
      }
      patchMainChainState({
        currentTaskId: task.taskId
      })
      const query = [`taskId=${encodeURIComponent(task.taskId)}`]
      const batchId = (task && task.batchId) || this.currentBatchId
      const projectId = (task && task.projectId) || this.currentProjectId
      if (batchId) {
        query.push(`batchId=${encodeURIComponent(batchId)}`)
      }
      if (projectId) {
        query.push(`projectId=${encodeURIComponent(projectId)}`)
      }
      if (mode) {
        query.push(`mode=${encodeURIComponent(mode)}`)
      }
      if (reviewContext) {
        query.push(`reviewContext=${encodeURIComponent(reviewContext)}`)
      }
      uni.redirectTo({
        url: `/package-ai/result/result?${query.join('&')}`
      })
    },
    formatAuditAction(action) {
      if (action === 'approve_result') {
        return 'approve_result'
      }
      if (action === 'mark_needs_revision') {
        return 'mark_needs_revision'
      }
      if (action === 'approve_deliverable_results') {
        return 'approve_deliverable_results'
      }
      return action || 'info'
    },
    enqueueDeliveryCompensation(type, taskId, payload, errorMessage) {
      const queueItem = appendDeliveryQueueItem({
        taskId: taskId || '',
        type,
        payload: payload || {},
        status: 'pending'
      })
      appendDeliveryAudit(
        createDeliveryAudit(
          'delivery_compensation_enqueued',
          taskId || '',
          `${type} queued: ${errorMessage || 'unknown error'}`,
          {
            queueId: queueItem.queueId
          }
        )
      )
      this.refreshState()
      return queueItem
    },
    async retryCurrentTaskDeliveryQueue() {
      const queueItems = getTaskDeliveryQueue(this.currentTaskIdValue, ['pending', 'failed'])
      if (!queueItems.length) {
        uni.showToast({
          title: '暂无可重试队列',
          icon: 'none'
        })
        return
      }

      let resolvedCount = 0
      let failedCount = 0

      for (const item of queueItems) {
        const next = updateDeliveryQueueItem(item.queueId, {
          status: 'retrying'
        }) || item

        try {
          if (next.type === 'sync') {
            const payload = next.payload || {}
            await syncTaskDeliveryStatus({
              taskId: payload.taskId || next.taskId,
              deliveryStatus: payload.deliveryStatus || 'pending_review',
              deliveryConfirmedAt: payload.deliveryConfirmedAt || '',
              deliveryNote: payload.deliveryNote || ''
            })
            this.patchCurrentTaskVisibility(next.taskId, {
              lastDeliverySyncAt: new Date().toISOString(),
              lastDeliverySyncStatus: 'success'
            })
          } else {
            await this.reconcileDeliveryStatusFromServer()
            const state = getMainChainState()
            const task = state.tasks && state.tasks.byId && state.tasks.byId[next.taskId]
            if (!task || task.lastDeliveryReconcileStatus === 'failed') {
              throw new Error('校准重试仍失败')
            }
          }

          updateDeliveryQueueItem(next.queueId, {
            status: 'resolved'
          })
          resolvedCount += 1
        } catch (error) {
          updateDeliveryQueueItem(next.queueId, {
            status: 'failed',
            payload: {
              ...(next.payload || {}),
              lastError: (error && error.message) || '重试失败'
            }
          })
          failedCount += 1
        }
      }

      this.refreshState()
      uni.showToast({
        title: `已恢复 ${resolvedCount}，失败 ${failedCount}`,
        icon: 'none'
      })
    },
    patchCurrentTaskVisibility(taskId, visibilityPatch = {}) {
      if (!taskId) {
        return null
      }

      const state = getMainChainState()
      const tasks = state.tasks || {}
      const byId = tasks.byId || {}
      const currentTask = byId[taskId]
      if (!currentTask) {
        return null
      }

      const nextTask = {
        ...currentTask,
        ...visibilityPatch
      }

      const patch = {
        tasks: {
          ...tasks,
          byId: {
            ...byId,
            [taskId]: nextTask
          }
        }
      }

      if (state.draftTask && state.draftTask.taskId === taskId) {
        patch.draftTask = {
          ...state.draftTask,
          ...visibilityPatch
        }
      }

      patchMainChainState(patch)
      this.refreshState()
      return nextTask
    },
    syncDeliveryStatusToServer(task) {
      if (!task || !task.taskId) {
        return
      }

      const pendingAt = new Date().toISOString()
      const pendingTask = this.patchCurrentTaskVisibility(task.taskId, {
        lastDeliverySyncAt: pendingAt,
        lastDeliverySyncStatus: 'pending'
      }) || task

      syncTaskDeliveryStatus({
        taskId: pendingTask.taskId,
        deliveryStatus: pendingTask.deliveryStatus || 'pending_review',
        deliveryConfirmedAt: pendingTask.deliveryConfirmedAt || '',
        deliveryNote: pendingTask.deliveryNote || ''
      }).then(() => {
        this.patchCurrentTaskVisibility(pendingTask.taskId, {
          lastDeliverySyncAt: new Date().toISOString(),
          lastDeliverySyncStatus: 'success'
        })
      }).catch((error) => {
        this.patchCurrentTaskVisibility(pendingTask.taskId, {
          lastDeliverySyncAt: new Date().toISOString(),
          lastDeliverySyncStatus: 'failed'
        })
        this.enqueueDeliveryCompensation(
          'sync',
          pendingTask.taskId,
          {
            taskId: pendingTask.taskId,
            deliveryStatus: pendingTask.deliveryStatus || 'pending_review',
            deliveryConfirmedAt: pendingTask.deliveryConfirmedAt || '',
            deliveryNote: pendingTask.deliveryNote || ''
          },
          (error && error.message) || 'delivery sync failed'
        )
        uni.showToast({
          title: '交付同步失败',
          icon: 'none'
        })
        appendDeliveryAudit(
          createDeliveryAudit(
            'delivery_sync_failed',
            task.taskId,
            (error && error.message) || 'delivery sync failed',
            {
              batchId: task.batchId || '',
              projectId: task.projectId || ''
            }
          )
        )
        this.refreshState()
      })
    },
    async reconcileDeliveryStatusFromServer() {
      const taskId = this.currentTaskIdValue
      if (this.reconcilingDelivery || !taskId) {
        return
      }

      const reconcileAt = new Date().toISOString()
      if (this.shouldSkipDeliveryReconcileForMockTask(taskId)) {
        console.log('[result:delivery-reconcile] skipped mock/fallback task', {
          taskId,
          skipReason: 'mock_or_fallback'
        })
        this.patchCurrentTaskVisibility(taskId, {
          lastDeliveryReconcileAt: reconcileAt,
          lastDeliveryReconcileStatus: 'skipped'
        })
        return
      }

      this.reconcilingDelivery = true
      try {
        if (this.isMockOrFallbackTask(this.currentTaskValue)) {
          console.log('[result:delivery-reconcile] skipped mock/fallback task', {
            taskId,
            skipReason: 'mock_or_fallback'
          })
          this.patchCurrentTaskVisibility(taskId, {
            lastDeliveryReconcileAt: reconcileAt,
            lastDeliveryReconcileStatus: 'skipped'
          })
          return
        }

        if (this.hasPendingDeliveryCompensation(taskId)) {
          console.log('[result:delivery-reconcile] skipped local pending compensation', {
            taskId,
            skipReason: 'pending_compensation'
          })
          this.patchCurrentTaskVisibility(taskId, {
            lastDeliveryReconcileAt: reconcileAt,
            lastDeliveryReconcileStatus: 'skipped'
          })
          return
        }

        const serverDelivery = await fetchTaskDeliveryStatus(taskId)
        const hasServerField = (field) =>
          !!serverDelivery &&
          Object.prototype.hasOwnProperty.call(serverDelivery, field) &&
          serverDelivery[field] !== undefined
        const serverStatus = hasServerField('deliveryStatus') ? serverDelivery.deliveryStatus : undefined
        const serverConfirmedAt = hasServerField('deliveryConfirmedAt') ? serverDelivery.deliveryConfirmedAt : undefined
        const serverNote = hasServerField('deliveryNote') ? serverDelivery.deliveryNote : undefined
        const hasServerDeliveryValue = hasServerField('deliveryStatus') || hasServerField('deliveryConfirmedAt') || hasServerField('deliveryNote')
        if (!hasServerDeliveryValue) {
          this.patchCurrentTaskVisibility(this.currentTaskIdValue, {
            lastDeliveryReconcileAt: reconcileAt,
            lastDeliveryReconcileStatus: 'skipped'
          })
          return
        }

        const state = getMainChainState()
        const tasks = state.tasks || {}
        const byId = tasks.byId || {}
        const currentTask = byId[this.currentTaskIdValue]
        if (!currentTask) {
          return
        }

        const localStatus = currentTask.deliveryStatus || ''
        const localConfirmedAt = currentTask.deliveryConfirmedAt || ''
        const localNote = currentTask.deliveryNote || ''
        const localUpdatedAt = this.getTaskUpdatedAtValue(currentTask)
        const serverUpdatedAt = this.getTaskUpdatedAtValue(serverDelivery)
        const useServerDelivery = serverUpdatedAt > localUpdatedAt
        if (!useServerDelivery) {
          console.log('[result:delivery-reconcile] skipped local newer', {
            taskId: this.currentTaskIdValue,
            localUpdatedAt,
            serverUpdatedAt,
            skipReason: 'local_newer_or_equal',
            useServerDelivery: false
          })
          this.patchCurrentTaskVisibility(this.currentTaskIdValue, {
            lastDeliveryReconcileAt: reconcileAt,
            lastDeliveryReconcileStatus: 'skipped'
          })
          return
        }

        const hasDiff =
          (hasServerField('deliveryStatus') && localStatus !== serverStatus) ||
          (hasServerField('deliveryConfirmedAt') && localConfirmedAt !== serverConfirmedAt) ||
          (hasServerField('deliveryNote') && localNote !== serverNote)

        if (!hasDiff) {
          this.patchCurrentTaskVisibility(this.currentTaskIdValue, {
            lastDeliveryReconcileAt: reconcileAt,
            lastDeliveryReconcileStatus: 'skipped'
          })
          return
        }

        const nextTask = {
          ...currentTask,
          deliveryStatus: hasServerField('deliveryStatus')
            ? (serverStatus === null ? null : (serverStatus || localStatus || 'pending_review'))
            : (localStatus || 'pending_review'),
          deliveryConfirmedAt: hasServerField('deliveryConfirmedAt') ? serverConfirmedAt : (localConfirmedAt || ''),
          deliveryNote: hasServerField('deliveryNote') ? serverNote : (localNote || '')
        }

        const patch = {
          tasks: {
            ...tasks,
            byId: {
              ...byId,
              [this.currentTaskIdValue]: nextTask
            }
          }
        }

        if (state.draftTask && state.draftTask.taskId === this.currentTaskIdValue) {
          patch.draftTask = {
            ...state.draftTask,
            deliveryStatus: nextTask.deliveryStatus,
            deliveryConfirmedAt: nextTask.deliveryConfirmedAt,
            deliveryNote: nextTask.deliveryNote,
            lastDeliveryReconcileAt: reconcileAt,
            lastDeliveryReconcileStatus: 'success'
          }
        }

        patch.tasks.byId[this.currentTaskIdValue] = {
          ...patch.tasks.byId[this.currentTaskIdValue],
          lastDeliveryReconcileAt: reconcileAt,
          lastDeliveryReconcileStatus: 'success'
        }

        patchMainChainState(patch)
        appendDeliveryAudit(
          createDeliveryAudit(
            'delivery_reconcile_applied',
            this.currentTaskIdValue,
            'Delivery status reconciled from server',
            {
              batchId: nextTask.batchId || '',
              projectId: nextTask.projectId || ''
            }
          )
        )
        this.refreshState()
      } catch (error) {
        this.patchCurrentTaskVisibility(this.currentTaskIdValue, {
          lastDeliveryReconcileAt: reconcileAt,
          lastDeliveryReconcileStatus: 'failed'
        })
        this.enqueueDeliveryCompensation(
          'reconcile',
          this.currentTaskIdValue,
          {
            taskId: this.currentTaskIdValue
          },
          (error && error.message) || 'delivery reconcile failed'
        )
        appendDeliveryAudit(
          createDeliveryAudit(
            'delivery_reconcile_failed',
            this.currentTaskIdValue,
            (error && error.message) || 'delivery reconcile failed',
            {
              batchId: this.currentBatchId || '',
              projectId: this.currentProjectId || ''
            }
          )
        )
      } finally {
        this.reconcilingDelivery = false
        this.scheduleContextAutoFocus()
      }
    },
    updateDeliveryStatus(nextStatus, currentTaskSnapshot = null) {
      const currentTaskId = this.currentTaskIdValue
      if (!currentTaskId || !nextStatus) {
        return false
      }

      const state = getMainChainState()
      const tasks = state.tasks || {}
      const byId = tasks.byId || {}
      const currentTask = byId[currentTaskId]
      if (!currentTask) {
        return false
      }

      const resolvedCurrentTaskSnapshot = currentTaskSnapshot || this.buildCurrentResultTaskSnapshot(currentTask)

      if (nextStatus === 'approved' && this.isMockOrFallbackTask(resolvedCurrentTaskSnapshot)) {
        console.warn('[result:delivery] blocked mock approve', {
          taskId: currentTaskId
        })
        uni.showToast({
          title: '测试图不可审核通过',
          icon: 'none'
        })
        return false
      }
      if (nextStatus === 'approved' && !this.hasTaskResult(currentTask)) {
        uni.showToast({
          title: '暂无可通过的结果',
          icon: 'none'
        })
        return false
      }

      const noteByStatus = {
        approved: '结果已审核通过',
        needs_revision: '结果需要修改',
        pending_review: '等待审核'
      }
      const confirmedAt = new Date().toISOString()
      const nextTask = {
        ...currentTask,
        deliveryStatus: nextStatus,
        deliveryConfirmedAt: confirmedAt,
        deliveryNote: noteByStatus[nextStatus] || ''
      }

      const nextById = {
        ...byId,
        [currentTaskId]: nextTask
      }

      const patch = {
        tasks: {
          ...tasks,
          byId: nextById
        }
      }

      if (state.draftTask && state.draftTask.taskId === currentTaskId) {
        patch.draftTask = {
          ...state.draftTask,
          deliveryStatus: nextTask.deliveryStatus,
          deliveryConfirmedAt: nextTask.deliveryConfirmedAt,
          deliveryNote: nextTask.deliveryNote
        }
      }

      patchMainChainState(patch)
      const auditAction = nextStatus === 'approved' ? 'approve_result' : 'mark_needs_revision'
      appendDeliveryAudit(
        createDeliveryAudit(auditAction, currentTaskId, noteByStatus[nextStatus] || '', {
          batchId: nextTask.batchId || '',
          projectId: nextTask.projectId || ''
        })
      )
      this.syncDeliveryStatusToServer(nextTask)
      this.refreshState()
      return true
    },
    markDeliveryApproved() {
      if (this.queryingTask || this.detailLoading) {
        return
      }
      if (this.isCurrentTaskMockOrFallback) {
        uni.showToast({ title: '体验结果不可审核交付', icon: 'none' })
        return
      }

      const currentTaskSnapshot = this.buildCurrentResultTaskSnapshot(this.currentTaskValue || this.currentTask || {})
      const success = this.updateDeliveryStatus('approved', currentTaskSnapshot)
      if (!success) {
        return
      }

      uni.showToast({
        title: '结果已通过',
        icon: 'success'
      })
    },
    markNeedsRevision() {
      if (this.queryingTask || this.detailLoading) {
        return
      }

      const success = this.updateDeliveryStatus('needs_revision')
      if (!success) {
        return
      }

      uni.showToast({
        title: '已标记需要修改',
        icon: 'none'
      })
    },
    saveImage() {
      this.downloadHighResolutionImage(this.resultImageUrl)
    },
    downloadHighResolutionImage(value = '') {
      if (this.downloadingImage) return
      if (this.isCurrentTaskMockOrFallback) {
        uni.showToast({ title: '体验结果不支持下载', icon: 'none' })
        return
      }
      const imageUrl = resolveWorkImageUrl({ coverUrl: value })
      if (!isDownloadableWorkImageUrl(imageUrl)) {
        uni.showToast({
          title: '暂无可下载的真实图片',
          icon: 'none'
        })
        return
      }
      this.downloadingImage = true
      const onDownloadFailure = () => {
        this.downloadingImage = false
        uni.showToast({ title: '图片下载失败，请稍后重试', icon: 'none' })
      }
      if (/^cloud:\/\//.test(imageUrl) && typeof wx !== 'undefined' && wx.cloud && typeof wx.cloud.downloadFile === 'function') {
        wx.cloud.downloadFile({
          fileID: imageUrl,
          success: (result = {}) => {
            if (result.tempFilePath) this.ensureAlbumPermission(result.tempFilePath)
            else onDownloadFailure()
          },
          fail: onDownloadFailure
        })
        return
      }
      if (/^https?:\/\//.test(imageUrl)) {
        const api = typeof wx !== 'undefined' ? wx : uni
        api.downloadFile({
          url: imageUrl,
          success: (result = {}) => {
            if (Number(result.statusCode) === 200 && result.tempFilePath) this.ensureAlbumPermission(result.tempFilePath)
            else onDownloadFailure()
          },
          fail: onDownloadFailure
        })
        return
      }
      this.ensureAlbumPermission(imageUrl)
    },
    ensureAlbumPermission(filePath = '') {
      const api = typeof wx !== 'undefined' ? wx : uni
      if (!api || typeof api.getSetting !== 'function') {
        this.saveDownloadedImage(filePath)
        return
      }
      api.getSetting({
        success: (setting = {}) => {
          const permission = setting.authSetting && setting.authSetting['scope.writePhotosAlbum']
          if (permission === true) {
            this.saveDownloadedImage(filePath)
            return
          }
          if (permission === false) {
            this.downloadingImage = false
            this.showAlbumPermissionSettings()
            return
          }
          if (typeof api.authorize !== 'function') {
            this.saveDownloadedImage(filePath)
            return
          }
          api.authorize({
            scope: 'scope.writePhotosAlbum',
            success: () => this.saveDownloadedImage(filePath),
            fail: () => {
              this.downloadingImage = false
              this.showAlbumPermissionSettings()
            }
          })
        },
        fail: () => {
          this.downloadingImage = false
          uni.showToast({ title: '暂时无法检查相册权限', icon: 'none' })
        }
      })
    },
    saveDownloadedImage(filePath = '') {
      const api = typeof wx !== 'undefined' ? wx : uni
      if (!filePath || !api || typeof api.saveImageToPhotosAlbum !== 'function') {
        this.downloadingImage = false
        uni.showToast({ title: '当前环境无法保存图片', icon: 'none' })
        return
      }
      api.saveImageToPhotosAlbum({
        filePath,
        success: () => {
          this.downloadingImage = false
          uni.showToast({
            title: '已保存到相册',
            icon: 'success'
          })
        },
        fail: (error = {}) => {
          this.downloadingImage = false
          this.handleAlbumPermissionFailure(error)
        }
      })
    },
    showAlbumPermissionSettings() {
      const api = typeof wx !== 'undefined' ? wx : uni
      uni.showModal({
        title: '需要相册权限',
        content: '请在设置中开启相册权限。',
        confirmText: '打开设置',
        success: (result) => {
          if (result.confirm && api && typeof api.openSetting === 'function') api.openSetting()
        }
      })
    },
    handleAlbumPermissionFailure(error = {}) {
      const message = String(error.errMsg || error.message || '')
      if (/auth|authorize|permission|deny/i.test(message)) {
        this.showAlbumPermissionSettings()
        return
      }
      uni.showToast({ title: '保存失败，请稍后重试', icon: 'none' })
    },
    openShare() {
      this.showShare = true
    },
    copySharePath() {
      const taskId = this.currentTaskIdValue || ''
      const path = taskId ? `/package-ai/result/result?taskId=${encodeURIComponent(taskId)}` : '/pages/index/index'
      uni.setClipboardData({
        data: path,
        success: () => {
          this.closeShare()
          uni.showToast({
            title: '作品路径已复制',
            icon: 'success'
          })
        }
      })
    },
    closeShare() {
      this.showShare = false
    },
    buildGeneratePayload() {
      return {
        cloth_image: {
          file_id: this.clothImageValue.fileId || '',
          file_url: this.clothImageValue.fileUrl || ''
        },
        style_image: {
          file_id: this.styleImageValue.fileId || '',
          file_url: this.styleImageValue.fileUrl || ''
        },
        modelType: this.taskParamsValue.modelType,
        body: this.taskParamsValue.bodyType,
        kidsAge: this.taskParamsValue.kidsAgeGroup,
        styleTag: this.taskParamsValue.styleTag,
        scene: this.taskParamsValue.sceneType,
        neck: this.taskParamsValue.neckType,
        sleeve: this.taskParamsValue.sleeveType,
        fit: this.taskParamsValue.fitType,
        bg: this.taskOptionsValue.backgroundType,
        output: this.taskOptionsValue.outputType,
        promptDraft: this.taskParamsValue.promptDraft || '',
        promptPlan: this.taskParamsValue.promptPlan || null,
        generationMode: this.taskParamsValue.generationMode || '',
        negativePrompt: this.taskParamsValue.negativePrompt || '',
        outputUsage: this.taskParamsValue.outputUsage || '',
        input: {
          params: {
            promptDraft: this.taskParamsValue.promptDraft || '',
            promptPlan: this.taskParamsValue.promptPlan || null,
            generationMode: this.taskParamsValue.generationMode || '',
            negativePrompt: this.taskParamsValue.negativePrompt || '',
            outputUsage: this.taskParamsValue.outputUsage || ''
          }
        }
      }
    },
    async retryGenerate() {
      if (this.queryingTask || this.detailLoading) {
        return
      }

      this.queryingTask = true
      try {
        this.refreshState()
        this.startLocalTaskRefresh()
        uni.showToast({
          title: '请从上传页重新创建任务',
          icon: 'none'
        })
      } catch (error) {
        uni.showToast({
          title: '刷新任务失败',
          icon: 'none'
        })
      } finally {
        this.refreshState()
        this.queryingTask = false
      }
    },
    async continueQueryTask() {
      const taskId =
        this.currentTaskIdValue ||
        (this.taskControlValue && this.taskControlValue.lastTaskId) ||
        this.chainState.taskId ||
        this.chainState.lastTaskId

      if (!taskId || this.queryingTask || this.detailLoading) {
        return
      }

      this.queryingTask = true
      try {
        const localTask = getTask(taskId)
        if (localTask) {
          this.currentTask = localTask
          this.refreshState()
          this.startLocalTaskRefresh()
        } else {
          await this.ensureTaskDetailLoaded()
        }
      } catch (error) {
        uni.showToast({
          title: '查询失败',
          icon: 'none'
        })
      } finally {
        this.refreshState()
        this.queryingTask = false
      }
    },
    handlePollingResult(pollResult) {
      if (!pollResult) {
        return
      }

      if (pollResult.reason === 'query_error') {
        uni.showToast({
          title: '任务查询失败',
          icon: 'none'
        })
        return
      }

      if (pollResult.reason === 'task_failed') {
        uni.showToast({
          title: '任务执行失败',
          icon: 'none'
        })
        return
      }

      if (pollResult.reason === 'timeout') {
        uni.showToast({
          title: '任务超时',
          icon: 'none'
        })
      }
    }
  }
}
</script>

<style scoped>
.result-page-simple {
  min-height: 100vh;
  padding: 0 24rpx;
  color: #111827;
  background: #f6f7fb;
  box-sizing: border-box;
}

.top-nav {
  display: grid;
  grid-template-columns: 250rpx 1fr 250rpx;
  align-items: center;
  min-height: 104rpx;
}

.nav-back-btn {
  width: 242rpx;
  height: 64rpx;
  margin: 0;
  padding: 0;
  border: 0;
  color: #2563eb;
  background: transparent;
  font-size: 24rpx;
  font-weight: 600;
  line-height: 64rpx;
}

.nav-back-btn::after,
.simple-primary-btn::after,
.simple-secondary-btn::after,
.continue-chip::after,
.share-text-btn::after,
.inline-retry::after,
.light-action::after {
  border: 0;
}

.nav-title {
  text-align: center;
  color: #111827;
  font-size: 32rpx;
  font-weight: 800;
}

.simple-overview,
.simple-section {
  margin-bottom: 24rpx;
  border-radius: 28rpx;
  background: #ffffff;
  box-shadow: 0 12rpx 34rpx rgba(17, 24, 39, 0.06);
}

.simple-overview {
  display: flex;
  justify-content: space-between;
  gap: 24rpx;
  padding: 30rpx;
  border: 1rpx solid #e5e7eb;
}

.simple-overview.tone-success { border-color: #bbf7d0; }
.simple-overview.tone-warning { border-color: #fed7aa; }
.simple-overview.tone-failed { border-color: #fecaca; }
.simple-overview.tone-processing { border-color: #bfdbfe; }
.simple-overview.tone-pending, .simple-overview.tone-muted { border-color: #d1d5db; }

.simple-overview-copy,
.simple-overview-meta,
.simple-section-head,
.material-caption > view,
.simple-fold-head > view,
.development-info {
  display: flex;
  flex-direction: column;
}

.simple-eyebrow,
.simple-section-note,
.material-tab-status,
.material-caption-status,
.simple-quota {
  color: #6b7280;
  font-size: 22rpx;
}

.simple-title {
  margin: 8rpx 0;
  font-size: 38rpx;
  font-weight: 900;
}

.simple-subtitle {
  color: #4b5563;
  font-size: 25rpx;
}

.simple-overview-meta {
  align-items: flex-end;
  justify-content: space-between;
  flex-shrink: 0;
}

.simple-status {
  padding: 8rpx 14rpx;
  border-radius: 999rpx;
  color: #2563eb;
  background: #eff6ff;
  font-size: 22rpx;
  font-weight: 700;
}

.simple-section {
  padding: 28rpx;
}

.simple-section-head,
.simple-fold-head {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
}

.simple-section-title {
  display: block;
  color: #111827;
  font-size: 30rpx;
  font-weight: 800;
}

.material-tabs {
  width: 100%;
  margin: 22rpx 0;
  white-space: nowrap;
}

.material-tabs-inner {
  display: inline-flex;
  gap: 12rpx;
}

.material-tab {
  display: inline-flex;
  flex-direction: column;
  min-width: 168rpx;
  padding: 16rpx 20rpx;
  border: 1rpx solid #e5e7eb;
  border-radius: 18rpx;
  color: #374151;
  background: #ffffff;
  box-sizing: border-box;
}

.material-tab.active {
  border-color: #4f46e5;
  color: #4338ca;
  background: #eef2ff;
}

.material-tab.failed { border-color: #fecaca; }

.material-viewer {
  overflow: hidden;
  border-radius: 22rpx;
  background: #f3f4f6;
}

.material-image {
  display: block;
  width: 100%;
  height: 620rpx;
  background: #f8fafc;
}

.scene-comparison {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 2rpx;
  background: #e5e7eb;
}

.scene-comparison.identity {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.scene-comparison.identity .scene-comparison-image {
  height: 390rpx;
}

.scene-comparison-item {
  position: relative;
  min-width: 0;
  background: #f8fafc;
}

.scene-comparison-image {
  display: block;
  width: 100%;
  height: 520rpx;
}

.scene-comparison-label {
  position: absolute;
  z-index: 1;
  top: 16rpx;
  left: 16rpx;
  padding: 7rpx 13rpx;
  border-radius: 999rpx;
  color: #ffffff;
  background: rgba(17, 24, 39, 0.72);
  font-size: 20rpx;
  font-weight: 700;
}

.scene-comparison-item.result .scene-comparison-label { background: #4f46e5; }

.material-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 360rpx;
  padding: 32rpx;
  text-align: center;
  background: linear-gradient(145deg, #f8fafc, #eef2ff);
}

.material-state.failed { background: #fff7f7; }
.material-state-title { font-size: 30rpx; font-weight: 800; }
.material-state-desc { margin-top: 12rpx; color: #6b7280; font-size: 24rpx; }

.material-caption {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20rpx 22rpx;
  background: #ffffff;
}

.material-name { font-size: 28rpx; font-weight: 800; }

.simple-primary-btn {
  height: 88rpx;
  margin: 24rpx 0 14rpx;
  border-radius: 18rpx;
  color: #ffffff;
  background: #4f46e5;
  font-size: 29rpx;
  font-weight: 800;
  line-height: 88rpx;
}

.simple-primary-btn[disabled] { color: #9ca3af; background: #e5e7eb; }

.simple-secondary-actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14rpx;
}

.simple-secondary-btn,
.light-action,
.inline-retry {
  margin: 0;
  border: 1rpx solid #d1d5db;
  border-radius: 16rpx;
  color: #374151;
  background: #ffffff;
  font-size: 25rpx;
}

.simple-secondary-btn { height: 76rpx; line-height: 74rpx; }
.save-destination-hint {
  display: block;
  margin-top: 12rpx;
  color: #6b7280;
  font-size: 21rpx;
  line-height: 1.5;
  text-align: center;
}
.light-action { margin-top: 24rpx; padding: 0 24rpx; }
.light-action.danger, .inline-retry { color: #dc2626; border-color: #fecaca; }

.continue-menu {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
  margin-top: 18rpx;
}

.continue-chip {
  width: auto;
  min-width: 138rpx;
  height: 62rpx;
  margin: 0;
  padding: 0 20rpx;
  border: 1rpx solid #e5e7eb;
  border-radius: 999rpx;
  color: #4b5563;
  background: #ffffff;
  font-size: 23rpx;
  line-height: 60rpx;
}

.share-text-btn {
  height: 66rpx;
  margin-top: 12rpx;
  color: #4f46e5;
  background: transparent;
  font-size: 24rpx;
  line-height: 66rpx;
}

.simple-fold-toggle { color: #4f46e5; font-size: 24rpx; }
.more-content { margin-top: 22rpx; }

.simple-info-row {
  display: flex;
  justify-content: space-between;
  gap: 24rpx;
  padding: 16rpx 0;
  border-bottom: 1rpx solid #f3f4f6;
  color: #6b7280;
  font-size: 24rpx;
}

.simple-info-row text:last-child {
  max-width: 66%;
  color: #111827;
  text-align: right;
  word-break: break-all;
}

.delivery-compact,
.development-info {
  margin-top: 22rpx;
  padding-top: 22rpx;
  border-top: 1rpx solid #e5e7eb;
}

.delivery-compact-title { display: block; margin-bottom: 14rpx; font-weight: 800; }
.pattern-package-summary { margin-top: 20rpx; padding-top: 20rpx; border-top: 1rpx solid #e7eaf0; }
.simple-info-row.warning { color: #9a5b00; }
.pattern-library-btn { height: 76rpx; margin: 20rpx 0 0; border: 1rpx solid #b9d9ff; border-radius: 12rpx; background: #edf6ff; color: #1677ff; font-size: 23rpx; font-weight: 700; line-height: 76rpx; }
.pattern-library-btn::after { border: 0; }
.development-info { gap: 8rpx; color: #6b7280; font-size: 22rpx; }
.result-safe-space { height: calc(40rpx + env(safe-area-inset-bottom)); }

.container {
  min-height: 100vh;
  background: #f5f7fa;
  padding: 0 20rpx 80rpx;
}

.nav-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 28rpx 0;
}

.nav-link {
  color: #1677ff;
  font-size: 26rpx;
}

.nav-link-right {
  text-align: right;
}

.nav-title {
  font-size: 34rpx;
  font-weight: 700;
  color: #222;
}

.loading-card,
.summary-card,
.tool-action-card,
.prompt-result-card,
.manual-service-card,
.next-action-card,
.extension-action-card,
.extension-result-card,
.image-card,
.info-card,
.action-card {
  background: #fff;
  border-radius: 24rpx;
  padding: 24rpx;
  margin-bottom: 24rpx;
}

.prompt-result-card {
  border: 1rpx solid rgba(91, 108, 255, 0.14);
  background: linear-gradient(180deg, #ffffff 0%, #f8f7ff 100%);
}

.result-hero-card {
  padding: 26rpx;
  border-radius: 28rpx;
  box-shadow: 0 14rpx 34rpx rgba(31, 72, 128, 0.08);
}

.result-section-title {
  font-size: 34rpx;
  font-weight: 800;
  color: #1f2937;
}

.mock-result-tip {
  display: block;
  margin-top: 16rpx;
  padding: 14rpx 16rpx;
  border-radius: 14rpx;
  background: #fff7e6;
  color: #b45309;
  font-size: 23rpx;
  line-height: 1.5;
}

.result-thumb-row {
  display: flex;
  gap: 12rpx;
  margin-top: 16rpx;
  overflow-x: auto;
}

.result-thumb {
  flex-shrink: 0;
  width: 108rpx;
  height: 108rpx;
  border-radius: 14rpx;
  background: #f2f4f7;
  border: 2rpx solid #e5e7eb;
}

.fold-card {
  background: #fbfcff;
}

.fold-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18rpx;
}

.fold-toggle {
  flex-shrink: 0;
  padding: 8rpx 18rpx;
  border-radius: 999rpx;
  background: #eef6ff;
  color: #1677ff;
  font-size: 24rpx;
  font-weight: 700;
}

.fold-body {
  margin-top: 16rpx;
}

.prompt-result-head {
  display: flex;
  justify-content: space-between;
  gap: 20rpx;
  align-items: flex-start;
}

.prompt-result-desc {
  display: block;
  margin-top: 8rpx;
  color: #667085;
  font-size: 23rpx;
  line-height: 1.6;
}

.prompt-result-toggle {
  flex-shrink: 0;
  color: #4f46e5;
  font-size: 24rpx;
  font-weight: 700;
}

.prompt-result-body {
  margin-top: 20rpx;
}

.prompt-result-row {
  padding: 18rpx;
  margin-bottom: 12rpx;
  border-radius: 16rpx;
  background: rgba(255, 255, 255, 0.82);
  border: 1rpx solid #edf0f7;
}

.prompt-result-label {
  display: block;
  margin-bottom: 8rpx;
  color: #4f46e5;
  font-size: 23rpx;
  font-weight: 800;
}

.prompt-result-text {
  display: block;
  color: #1f2937;
  font-size: 24rpx;
  line-height: 1.65;
}

.prompt-result-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
  margin-top: 18rpx;
}

.prompt-action-btn {
  flex: 1;
  min-width: 190rpx;
}

.entry-context-hint {
  display: block;
  margin-bottom: 10rpx;
  font-size: 22rpx;
  color: #1677ff;
}

.summary-top {
  display: flex;
  justify-content: space-between;
  gap: 20rpx;
  align-items: flex-start;
}

.summary-label,
.section-title,
.summary-item-label {
  display: block;
  font-size: 24rpx;
  color: #888;
}

.summary-value {
  display: block;
  margin-top: 8rpx;
  font-size: 28rpx;
  font-weight: 600;
  color: #222;
  word-break: break-all;
}

.status-badge {
  padding: 10rpx 18rpx;
  border-radius: 999rpx;
  font-size: 22rpx;
  flex-shrink: 0;
}

.status-draft {
  background: #f5f5f5;
  color: #666;
}

.status-processing {
  background: #e6f4ff;
  color: #1677ff;
}

.status-success {
  background: #f6ffed;
  color: #389e0d;
}

.status-failed {
  background: #fff2f0;
  color: #cf1322;
}

.summary-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
  margin-top: 24rpx;
}

.summary-item {
  width: calc(50% - 8rpx);
  background: #fafafa;
  border-radius: 18rpx;
  padding: 18rpx;
}

.summary-item-wide {
  width: 100%;
}

.tool-action-head {
  margin-bottom: 16rpx;
}

.tool-action-desc {
  display: block;
  margin-top: 8rpx;
  font-size: 24rpx;
  line-height: 1.6;
  color: #666;
}

.tool-action-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14rpx;
}

.context-action-row {
  display: flex;
  gap: 12rpx;
  margin-top: 12rpx;
  flex-wrap: wrap;
}

.context-btn {
  min-width: 220rpx;
}

.sibling-action-row .info-line {
  margin-top: 0;
}

.sibling-groups {
  margin-top: 10rpx;
}

.sibling-group-card {
  margin-top: 10rpx;
  background: #f8fafc;
  border-radius: 14rpx;
  padding: 14rpx;
}

.sibling-group-card.focused {
  border: 1rpx solid #1677ff;
}

.sibling-group-card.muted {
  opacity: 0.82;
}

.group-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10rpx;
}

.group-title {
  font-size: 24rpx;
  font-weight: 600;
  color: #222;
}

.group-count {
  font-size: 22rpx;
  color: #666;
}

.sibling-list {
  margin-top: 12rpx;
  display: flex;
  flex-direction: column;
  gap: 10rpx;
}

.sibling-item {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12rpx;
  padding: 14rpx;
  border-radius: 14rpx;
  background: #fafafa;
}

.sibling-item.recommended {
  border: 1rpx solid #16a34a;
  box-shadow: 0 0 0 1rpx rgba(22, 163, 74, 0.1);
}

.sibling-id {
  display: block;
  font-size: 24rpx;
  font-weight: 600;
  color: #222;
}

.sibling-meta {
  display: block;
  margin-top: 6rpx;
  font-size: 22rpx;
  color: #666;
}

.sibling-time {
  font-size: 22rpx;
  color: #888;
}

.result-hint {
  display: block;
  margin-top: 8rpx;
  font-size: 22rpx;
  color: #1677ff;
}

.audit-list {
  display: flex;
  flex-direction: column;
  gap: 10rpx;
  margin-top: 8rpx;
}

.audit-item {
  background: #fafafa;
  border-radius: 14rpx;
  padding: 12rpx;
}

.audit-action {
  display: block;
  font-size: 22rpx;
  color: #1677ff;
}

.audit-time {
  display: block;
  margin-top: 4rpx;
  font-size: 20rpx;
  color: #999;
}

.audit-note {
  display: block;
  margin-top: 6rpx;
  font-size: 24rpx;
  color: #333;
}

.review-summary-block {
  margin-top: 10rpx;
  border: 1rpx solid #dbeafe;
  border-radius: 16rpx;
  background: #f8fbff;
  padding: 14rpx;
}

.review-summary-block.review-summary-success {
  border-color: #bbf7d0;
  background: #f0fdf4;
}

.review-summary-block.review-summary-warning {
  border-color: #fed7aa;
  background: #fff7ed;
}

.review-summary-last-action {
  font-weight: 600;
}

.review-summary-source-badge {
  display: inline-block;
  margin-left: 6rpx;
  padding: 2rpx 10rpx;
  border-radius: 999rpx;
  font-size: 20rpx;
  color: #1677ff;
  background: #e6f4ff;
}

.review-summary-time {
  margin-top: 14rpx;
}

.review-summary-empty {
  margin-top: 10rpx;
  border: 1rpx dashed #d0d7de;
  border-radius: 16rpx;
  background: #fafafa;
  padding: 14rpx;
}

.review-history-block {
  margin-top: 14rpx;
}

.review-history-list {
  display: flex;
  flex-direction: column;
  gap: 10rpx;
  margin-top: 8rpx;
}

.review-history-item {
  border-radius: 12rpx;
  background: #fff;
  padding: 12rpx;
}

.review-history-item.active {
  border: 1rpx solid #1677ff;
  box-shadow: 0 0 0 1rpx rgba(22, 119, 255, 0.08);
}

.summary-item-value {
  display: block;
  margin-top: 8rpx;
  font-size: 28rpx;
  color: #222;
}

.progress-track {
  margin-top: 20rpx;
  width: 100%;
  height: 14rpx;
  border-radius: 999rpx;
  background: #eef2f6;
  overflow: hidden;
}

.progress-bar {
  height: 100%;
  background: linear-gradient(90deg, #1677ff 0%, #69b1ff 100%);
  border-radius: 999rpx;
}

.image-section {
  margin-bottom: 24rpx;
}

.image-section-priority {
  margin-top: -4rpx;
}

.manual-service-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18rpx;
  background: #fff7e6;
  border: 2rpx solid #ffd591;
}

.manual-service-title {
  display: block;
  font-size: 30rpx;
  font-weight: 700;
  color: #7c3f00;
}

.manual-service-desc {
  display: block;
  margin-top: 8rpx;
  font-size: 24rpx;
  line-height: 1.6;
  color: #8a5a19;
}

.manual-service-btn {
  flex-shrink: 0;
  width: 220rpx;
  height: 76rpx;
  line-height: 76rpx;
  border-radius: 14rpx;
  background: #d46b08;
  color: #fff;
  font-size: 24rpx;
}

.next-action-card {
  display: flex;
  flex-direction: column;
  gap: 18rpx;
}

.next-action-head {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}

.next-action-desc,
.next-action-tip {
  display: block;
  font-size: 24rpx;
  color: #666;
  line-height: 1.6;
}

.next-action-tip {
  color: #d46b08;
}

.next-action-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16rpx;
}

.extension-action-card,
.extension-result-card {
  display: flex;
  flex-direction: column;
  gap: 18rpx;
}

.extension-action-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16rpx;
}

.extension-action-btn {
  min-height: 132rpx;
  height: auto;
  padding: 18rpx;
  border-radius: 18rpx;
  border: 2rpx solid #91caff;
  background: #f8fbff;
  color: #1f2937;
  line-height: 1.4;
  text-align: left;
}

.extension-action-btn[disabled] {
  opacity: 0.6;
}

.extension-action-title {
  display: block;
  font-size: 26rpx;
  font-weight: 700;
  color: #1677ff;
}

.extension-action-badge {
  display: inline-block;
  margin-top: 8rpx;
  padding: 4rpx 10rpx;
  border-radius: 999rpx;
  background: #eef2ff;
  color: #4f46e5;
  font-size: 20rpx;
}

.extension-action-subtitle {
  display: block;
  margin-top: 8rpx;
  font-size: 22rpx;
  color: #666;
  line-height: 1.45;
}

.extension-result-list {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.extension-result-item,
.extension-result-empty {
  padding: 18rpx;
  border-radius: 16rpx;
  background: #fafafa;
}

.extension-result-head {
  display: flex;
  justify-content: space-between;
  gap: 12rpx;
  align-items: flex-start;
}

.extension-result-title {
  font-size: 28rpx;
  font-weight: 700;
  color: #1f2937;
}

.extension-result-badge {
  flex-shrink: 0;
  padding: 4rpx 12rpx;
  border-radius: 999rpx;
  background: #fff7e6;
  color: #d46b08;
  font-size: 20rpx;
}

.extension-result-status,
.extension-result-meta,
.extension-result-empty {
  display: block;
  margin-top: 8rpx;
  font-size: 24rpx;
  color: #666;
  line-height: 1.5;
}

.extension-preview-image,
.extension-video-placeholder {
  width: 100%;
  height: 280rpx;
  margin-top: 14rpx;
  border-radius: 16rpx;
  background: #f0f5ff;
}

.extension-video-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  padding: 20rpx;
  color: #1677ff;
  font-size: 24rpx;
  text-align: center;
}

.compare-card {
  margin-top: 24rpx;
  padding: 24rpx;
  border-radius: 18rpx;
  background: #fff;
}

.compare-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 20rpx;
  margin-top: 18rpx;
}

.compare-image-card {
  flex: 1;
  min-width: 300rpx;
}

.compare-title {
  display: block;
  font-size: 26rpx;
  font-weight: 700;
  color: #1f2937;
}

.compare-image,
.compare-empty {
  width: 100%;
  height: 360rpx;
  margin-top: 12rpx;
  border-radius: 16rpx;
  background: #f5f5f5;
}

.compare-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  padding: 20rpx;
  color: #8a8a8a;
  font-size: 24rpx;
  line-height: 1.5;
  text-align: center;
}

.fidelity-card {
  margin-top: 20rpx;
  padding: 18rpx;
  border: 1rpx solid #dbeafe;
  border-radius: 16rpx;
  background: #f8fbff;
}

.fidelity-title {
  display: block;
  font-size: 28rpx;
  font-weight: 700;
  color: #1d4ed8;
}

.fidelity-line,
.fidelity-tip {
  display: block;
  margin-top: 8rpx;
  font-size: 24rpx;
  line-height: 1.5;
  color: #374151;
}

.fidelity-tip {
  color: #b45309;
  font-weight: 600;
}

.main-image {
  width: 100%;
  height: 520rpx;
  margin-top: 18rpx;
  border-radius: 18rpx;
  background: #f5f5f5;
}

.image-empty,
.small-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  color: #999;
  background: #f5f5f5;
}

.image-empty {
  height: 520rpx;
  margin-top: 18rpx;
  border-radius: 18rpx;
}

.image-grid {
  display: flex;
  gap: 20rpx;
}

.small-card {
  flex: 1;
}

.small-image,
.small-empty {
  width: 100%;
  height: 220rpx;
  margin-top: 18rpx;
  border-radius: 18rpx;
}

.tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
  margin-top: 18rpx;
}

.tag-item {
  padding: 12rpx 18rpx;
  border-radius: 999rpx;
  background: #f5f7fa;
  color: #333;
  font-size: 24rpx;
}

.info-line {
  display: block;
  margin-top: 14rpx;
  font-size: 26rpx;
  color: #333;
  line-height: 1.7;
  word-break: break-all;
}

.error-card {
  border: 2rpx solid #ffd8bf;
  background: #fff7e6;
}

.error-message {
  display: block;
  margin-top: 14rpx;
  color: #d4380d;
  font-size: 26rpx;
  line-height: 1.7;
}

.action-card {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.action-btn {
  border-radius: 999rpx;
  height: 88rpx;
  font-size: 28rpx;
  border: none;
}

.action-btn[disabled] {
  opacity: 0.6;
}

.primary {
  background: #1677ff;
  color: #fff;
}

.secondary {
  background: #e6f4ff;
  color: #1677ff;
  border: 2rpx solid #91caff;
}

.warning {
  background: #fff7e6;
  color: #d46b08;
  border: 2rpx solid #ffd591;
}

.ghost {
  background: #f5f5f5;
  color: #333;
  border: 2rpx solid #d9d9d9;
}

.share-panel {
  position: fixed;
  inset: 0;
}

.share-mask {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
}

.share-card {
  position: absolute;
  left: 24rpx;
  right: 24rpx;
  bottom: 40rpx;
  background: #fff;
  border-radius: 24rpx;
  padding: 28rpx;
}

.share-title {
  display: block;
  font-size: 30rpx;
  font-weight: 600;
  color: #222;
}

.share-desc {
  display: block;
  margin: 14rpx 0 22rpx;
  font-size: 24rpx;
  color: #666;
  line-height: 1.6;
}

/* Design system final pass */
.container {
  background: #f7f8fc;
  padding: 0 32rpx 80rpx;
}

.nav-link {
  color: #4f46e5;
}

.nav-title,
.section-title,
.result-section-title,
.share-title {
  color: #111827;
  font-weight: 800;
}

.loading-card,
.summary-card,
.tool-action-card,
.prompt-result-card,
.manual-service-card,
.next-action-card,
.extension-action-card,
.extension-result-card,
.image-card,
.info-card,
.action-card,
.compare-card {
  border: 1rpx solid rgba(229, 231, 235, 0.9);
  border-radius: 32rpx;
  background: #ffffff;
  box-shadow: 0 12rpx 28rpx rgba(17, 24, 39, 0.06);
}

.result-hero-card {
  border-radius: 40rpx;
  box-shadow: 0 18rpx 38rpx rgba(17, 24, 39, 0.08);
}

.prompt-result-card {
  background: linear-gradient(180deg, #ffffff 0%, #f7f7ff 100%);
}

.fold-card {
  background: #ffffff;
  box-shadow: 0 8rpx 20rpx rgba(17, 24, 39, 0.035);
}

.main-image,
.image-empty,
.compare-image,
.compare-empty,
.small-image,
.small-empty,
.result-thumb,
.extension-preview-image,
.extension-video-placeholder,
.prompt-result-row,
.fidelity-card,
.extension-result-item {
  border-radius: 24rpx;
}

.main-image,
.image-empty {
  background: #f6f7fb;
}

.section-title {
  font-size: 32rpx;
}

.compare-title,
.fidelity-title,
.extension-action-title,
.extension-result-title {
  color: #111827;
  font-weight: 800;
}

.prompt-result-desc,
.next-action-desc,
.extension-action-subtitle,
.extension-result-status,
.extension-result-meta,
.extension-result-empty,
.fidelity-line,
.info-line,
.share-desc {
  color: #6b7280;
  font-size: 24rpx;
}

.action-btn {
  height: 88rpx;
  border-radius: 24rpx;
  font-size: 28rpx;
  font-weight: 700;
}

.primary {
  background: #2563eb;
  color: #ffffff;
  box-shadow: 0 10rpx 22rpx rgba(37, 99, 235, 0.14);
}

.secondary {
  border: 1rpx solid rgba(79, 70, 229, 0.22);
  background: #eef2ff;
  color: #4f46e5;
}

.warning {
  border: 1rpx solid rgba(249, 115, 22, 0.24);
  background: #fff7ed;
  color: #c2410c;
}

.ghost,
.fold-toggle,
.tag-item {
  border: 1rpx solid rgba(229, 231, 235, 0.9);
  background: #f8fafc;
  color: #6b7280;
}

.mock-result-tip {
  border-radius: 24rpx;
  background: #fff7ed;
  color: #c2410c;
}

.share-card {
  border-radius: 32rpx;
  box-shadow: 0 20rpx 46rpx rgba(17, 24, 39, 0.12);
}

.continue-optimize-card {
  margin-bottom: 24rpx;
  padding: 24rpx;
  border-radius: 28rpx;
  background: #ffffff;
  box-shadow: 0 14rpx 34rpx rgba(17, 24, 39, 0.08);
}

.continue-optimize-desc {
  display: block;
  margin-top: 8rpx;
  color: #6b7280;
  font-size: 23rpx;
  line-height: 1.45;
}

.continue-option-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12rpx;
  margin-top: 18rpx;
}

.continue-option-btn {
  height: 68rpx;
  line-height: 68rpx;
  border: 1rpx solid rgba(79, 70, 229, 0.18);
  border-radius: 999rpx;
  background: #eef2ff;
  color: #4f46e5;
  font-size: 24rpx;
  font-weight: 800;
}

.continue-option-btn::after {
  border: 0;
}

.result-overview-card,
.result-state-card,
.result-quota-card {
  margin-bottom: 24rpx;
  padding: 24rpx;
  border: 1rpx solid rgba(226, 232, 240, 0.9);
  border-radius: 28rpx;
  background: #ffffff;
  box-shadow: 0 12rpx 28rpx rgba(17, 24, 39, 0.055);
}

.result-overview-card.is-success {
  border-color: rgba(22, 163, 74, 0.18);
  background: linear-gradient(145deg, #ffffff 0%, #f0fdf4 100%);
}

.result-overview-card.is-failed {
  border-color: rgba(220, 38, 38, 0.18);
  background: linear-gradient(145deg, #ffffff 0%, #fef2f2 100%);
}

.result-overview-head,
.result-quota-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18rpx;
}

.result-overview-status,
.result-overview-plan,
.result-overview-time,
.result-state-title,
.result-state-desc,
.result-action-recommendation,
.result-quota-title,
.result-quota-desc,
.result-quota-warning {
  display: block;
}

.result-overview-status {
  color: #111827;
  font-size: 36rpx;
  font-weight: 800;
}

.result-overview-plan {
  margin-top: 8rpx;
  color: #4b5563;
  font-size: 24rpx;
}

.result-overview-type {
  flex-shrink: 0;
  padding: 8rpx 14rpx;
  border-radius: 999rpx;
  background: #eef2ff;
  color: #4f46e5;
  font-size: 21rpx;
  font-weight: 700;
}

.result-overview-time {
  margin-top: 16rpx;
  color: #6b7280;
  font-size: 22rpx;
}

.result-state-card {
  text-align: center;
}

.result-state-card.is-generating {
  background: linear-gradient(145deg, #ffffff 0%, #eff6ff 100%);
}

.result-state-card.is-failed {
  background: linear-gradient(145deg, #ffffff 0%, #fef2f2 100%);
}

.result-state-title {
  color: #111827;
  font-size: 32rpx;
  font-weight: 800;
}

.result-state-desc {
  margin-top: 10rpx;
  color: #6b7280;
  font-size: 23rpx;
  line-height: 1.55;
}

.result-state-action,
.result-related-action,
.result-quota-action {
  border: 0;
  border-radius: 20rpx;
  background: #4f46e5;
  color: #ffffff;
  font-weight: 700;
}

.result-state-action {
  height: 72rpx;
  line-height: 72rpx;
  margin-top: 20rpx;
  font-size: 25rpx;
}

.result-action-recommendation {
  margin-top: 8rpx;
  color: #6b7280;
  font-size: 22rpx;
  line-height: 1.5;
}

.result-related-action {
  width: 100%;
  height: 72rpx;
  line-height: 72rpx;
  margin-top: 14rpx;
  background: #111827;
  font-size: 24rpx;
}

.result-state-action::after,
.result-related-action::after,
.result-quota-action::after {
  border: 0;
}

.result-quota-card {
  position: relative;
  flex-wrap: wrap;
  background: #f8fafc;
}

.result-quota-card.is-insufficient {
  border-color: rgba(234, 88, 12, 0.22);
  background: #fff7ed;
}

.result-quota-title {
  color: #111827;
  font-size: 26rpx;
  font-weight: 800;
}

.result-quota-desc {
  margin-top: 6rpx;
  color: #6b7280;
  font-size: 21rpx;
}

.result-quota-status {
  flex-shrink: 0;
  color: #16803c;
  font-size: 21rpx;
  font-weight: 700;
}

.result-quota-action {
  flex-shrink: 0;
  width: 156rpx;
  height: 64rpx;
  line-height: 64rpx;
  margin: 0;
  padding: 0;
  font-size: 22rpx;
}

.result-quota-warning {
  width: 100%;
  color: #c2410c;
  font-size: 21rpx;
  font-weight: 700;
}

.style-result-summary {
  margin-top: 18rpx;
  padding: 20rpx;
  border-radius: 14rpx;
  background: #f6f8fc;
}

.style-result-summary-title,
.style-result-summary-line {
  display: block;
}

.style-result-summary-title {
  color: #1f2937;
  font-size: 26rpx;
  font-weight: 700;
}

.style-result-summary-line {
  margin-top: 10rpx;
  color: #4b5563;
  font-size: 22rpx;
  line-height: 1.5;
}

.style-result-summary-line.muted { color: #16803c; }

.fabric-result-reference {
  width: 144rpx;
  height: 144rpx;
  margin-top: 12rpx;
  border: 2rpx solid #e2e8f0;
  border-radius: 14rpx;
  background: #f8fafc;
}

.color-result-target {
  display: flex;
  align-items: center;
  gap: 12rpx;
  margin: 16rpx 0 6rpx;
  color: #1f2937;
  font-size: 23rpx;
  font-weight: 650;
}

.color-result-target > view {
  width: 44rpx;
  height: 44rpx;
  border: 1rpx solid #cbd5e1;
  border-radius: 10rpx;
}
</style>
