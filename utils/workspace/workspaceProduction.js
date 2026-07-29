import {
  WORKSPACE_PLAN_HISTORY_STATUS,
  createWorkspacePlanHistory,
  getWorkspacePlanHistories,
  getWorkspacePlanHistory,
  linkWorkspacePlanTasks,
  updateWorkspacePlanHistory
} from './workspacePlanHistory'
import { createBatchId, createBatchTasks } from '../task/batchTask'
import { getBatchDetail, retryBatchTask } from '../task/batchRepository'
import { getTask } from '../task/taskLayer'
import { buildOutputVariantSlots, normalizeOutputVariantCount } from '../task/outputVariantContract'
import {
  getEstimatedQuotaCost,
  getExpectedOutputCount,
  validateDeliverables
} from '../task/multiResultExecutor'
import { createGenerationExecution } from '../task/generationExecution'
import { AI_POINT_ACTION_TYPES, getAiPointCost } from '../constants/aiPointCost'
import {
  GARMENT_DETAIL_MODES,
  GARMENT_DETAIL_PARENT_TASK_TYPE,
  buildGarmentDetailChildren,
  validateGarmentDetailSelection
} from '../task/garmentDetailContract'

const WORKSPACE_PRODUCTION_STORAGE_KEY = 'diebiandesign_workspace_production'

const ITEM_TYPE_LABELS = Object.freeze({
  model_image: 'AI模特图',
  white_background: '商品白底图',
  detail_page: '详情页素材',
  marketing_image: '营销素材',
  fabric_replace: '换面料',
  fabric_variation: '换面料',
  pattern_replace: '换图案',
  pattern_variation: '换图案',
  garment_replace: 'AI换衣服',
  pose_replace: 'AI换姿势',
  pose_adjust: 'AI换姿势',
  pose_variation: 'AI换姿势',
  style_redesign: '改款方案',
  garment_detail_neckline: '领口细节图',
  garment_detail_cuff: '袖口细节图',
  garment_detail_button: '纽扣细节图',
  garment_detail_zipper: '拉链细节图',
  garment_detail_stitching: '车线细节图',
  garment_detail_hem: '裙摆细节图',
  pattern_structure_generate: '打版结构图'
})

const QUICK_LAUNCH_PLAN = Object.freeze({
  planId: 'quick_launch',
  guideId: 'product_launch',
  title: '快速上新',
  category: '商品上新',
  entryType: 'model',
  estimatedCost: 0,
  outputCount: 3,
  items: [
    {
      deliverableId: 'quick_launch_model_01',
      itemType: 'model_image',
      name: 'AI模特图',
      title: 'AI模特图',
      quantity: 1,
      ratio: '3:4',
      scene: '商品模特展示',
      purpose: '商品上新',
      actionType: 'model_replace',
      taskType: 'model_replace',
      toolType: 'model',
      outputType: 'model_image',
      available: true,
      promptDraft: '保留服装主体和设计细节，生成清晰自然的商业 AI 模特上身展示图。',
      prompt: '保留服装主体和设计细节，生成清晰自然的商业 AI 模特上身展示图。',
      status: 'pending',
      quotaAction: AI_POINT_ACTION_TYPES.AI_MODEL_IMAGE,
      unitCost: getAiPointCost(AI_POINT_ACTION_TYPES.AI_MODEL_IMAGE)
    },
    {
      deliverableId: 'quick_launch_main_01',
      itemType: 'white_background',
      name: '商品白底图',
      title: '商品主图',
      quantity: 1,
      ratio: '1:1',
      scene: '纯白商品展示',
      purpose: '电商主图',
      actionType: 'flat_lay_generate',
      taskType: 'flat_lay_generate',
      toolType: 'flat_lay',
      outputType: 'flat_lay_image',
      available: true,
      promptDraft: '保留服装版型、颜色与纹理，生成纯白背景、光线均匀、主体完整的电商商品白底图。',
      prompt: '保留服装版型、颜色与纹理，生成纯白背景、光线均匀、主体完整的电商商品白底图。',
      status: 'pending',
      quotaAction: AI_POINT_ACTION_TYPES.BASIC_BACKGROUND,
      unitCost: getAiPointCost(AI_POINT_ACTION_TYPES.BASIC_BACKGROUND),
      params: {
        displayType: 'flat_lay',
        backgroundType: 'white_bg',
        selectedDisplayModes: ['flat']
      }
    },
    {
      deliverableId: 'quick_launch_detail_01',
      itemType: 'detail_page',
      name: '详情页素材',
      title: '详情页素材',
      quantity: 1,
      ratio: '3:4',
      scene: '商品详情展示',
      purpose: '详情页',
      actionType: 'marketing_asset',
      taskType: 'marketing_asset',
      toolType: 'marketing',
      outputType: 'marketing_assets',
      available: true,
      promptDraft: '基于服装原图生成适合电商详情页使用的商品展示素材，突出款式、面料与设计细节。',
      prompt: '基于服装原图生成适合电商详情页使用的商品展示素材，突出款式、面料与设计细节。',
      status: 'pending',
      quotaAction: AI_POINT_ACTION_TYPES.DETAIL_LONG_IMAGE,
      unitCost: getAiPointCost(AI_POINT_ACTION_TYPES.DETAIL_LONG_IMAGE),
      params: {
        selectedMarketingTypes: ['detail_page'],
        pageMaterialTypes: ['main_image', 'detail_image'],
        detailModules: ['product_main', 'detail_display']
      }
    }
  ]
})

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

function normalizeStore(value = {}) {
  return {
    plans: value.plans && typeof value.plans === 'object' ? value.plans : {},
    timelines: value.timelines && typeof value.timelines === 'object' ? value.timelines : {},
    runs: value.runs && typeof value.runs === 'object' ? value.runs : {}
  }
}

const GUIDE_DEFAULTS = Object.freeze({
  'product-images': {
    title: '商品视觉生产方案',
    category: '商品图',
    entryType: 'model',
    actions: ['模特展示图', '场景图', '详情页素材']
  },
  'new-design': {
    title: '新款开发方案',
    category: '开发新款',
    entryType: 'color',
    actions: ['颜色方案', '图案方案', '设计方案']
  },
  'brand-marketing': {
    title: '品牌营销生产方案',
    category: '品牌营销',
    entryType: 'scene',
    actions: ['营销场景', '批量素材']
  },
  product_image_production: {
    title: '我要做商品图',
    category: '商品图生产',
    entryType: 'model',
    actions: ['模特展示图', '商品白底图', '详情页素材']
  },
  new_style_development: {
    title: '我要开发新款',
    category: '新款开发',
    entryType: 'color',
    actions: ['换颜色', '换图案', '微改款', '设计方案']
  },
  brand_marketing: {
    title: '我要做品牌营销',
    category: '品牌营销',
    entryType: 'scene',
    actions: ['换场景', '批量生成', '营销素材']
  },
  enterprise_assets: {
    title: '我要管理品牌资产',
    category: '企业资产',
    entryType: 'model',
    actions: ['品牌模特', '品牌颜色', '品牌模板', '品牌项目']
  }
})

function readStore() {
  try {
    const value = uni.getStorageSync(WORKSPACE_PRODUCTION_STORAGE_KEY)
    return value && typeof value === 'object' ? normalizeStore(value) : normalizeStore()
  } catch (error) {
    return normalizeStore()
  }
}

function writeStore(store) {
  try {
    uni.setStorageSync(WORKSPACE_PRODUCTION_STORAGE_KEY, store)
  } catch (error) {}
  return store
}

function inferGuideId(planId = '') {
  const value = String(planId || '')
  return Object.keys(GUIDE_DEFAULTS).find((guideId) => value.includes(guideId)) || ''
}

function sanitizeActions(actions = []) {
  return (Array.isArray(actions) ? actions : []).map((item) => ({
    action: String(item.action || ''),
    label: String(item.label || item.action || ''),
    workspaceType: String(item.workspaceType || '')
  })).filter((item) => item.label)
}

function sanitizeItems(items = []) {
  return (Array.isArray(items) ? items : []).map((item = {}) => ({
    deliverableId: String(item.deliverableId || ''),
    itemType: String(item.itemType || ''),
    name: String(item.name || ITEM_TYPE_LABELS[item.itemType] || '生成素材'),
    title: String(item.title || item.name || ITEM_TYPE_LABELS[item.itemType] || '生成素材'),
    quantity: Math.max(0, Number(item.quantity) || 0),
    ratio: String(item.ratio || ''),
    scene: String(item.scene || ''),
    purpose: String(item.purpose || ''),
    prompt: String(item.prompt || item.promptDraft || ''),
    status: String(item.status || 'pending'),
    actionType: String(item.actionType || item.taskType || ''),
    taskType: String(item.taskType || item.actionType || ''),
    toolType: String(item.toolType || ''),
    outputType: String(item.outputType || ''),
    available: item.available !== false,
    unavailableReason: String(item.unavailableReason || ''),
    promptDraft: String(item.promptDraft || ''),
    quotaAction: String(item.quotaAction || ''),
    unitCost: Math.max(0, Number(item.unitCost) || 0),
    params: item.params && typeof item.params === 'object' ? clone(item.params) : {}
  })).filter((item) => item.itemType && item.name)
}

function sanitizePlan(plan = {}) {
  const items = sanitizeItems(plan.items)
  return {
    planId: String(plan.planId || ''),
    guideId: String(plan.guideId || ''),
    title: String(plan.title || ''),
    category: String(plan.category || ''),
    entryType: String(plan.entryType || ''),
    actions: sanitizeActions(plan.actions),
    items,
    estimatedCost: Math.max(0, Number(plan.estimatedCost) || 0),
    outputCount: Math.max(getExpectedOutputCount(items), Number(plan.outputCount) || 0),
    createdAt: plan.createdAt || new Date().toISOString()
  }
}

function normalizeTaskStatus(status = '') {
  if (status === 'success' || status === 'completed') return 'completed'
  if (status === 'failed' || status === 'timeout' || status === 'error') return 'failed'
  if (status === 'processing' || status === 'queued' || status === 'submitted') return 'generating'
  return 'pending'
}

function getTaskError(task = {}) {
  const error = task.error && typeof task.error === 'object' ? task.error : {}
  return {
    errorCode: String(error.code || error.errorCode || task.errorCode || ''),
    errorMessage: String(error.message || task.errorMessage || task.statusText || '生成失败，请重试')
  }
}

function getTaskQuotaConsumed(task = {}) {
  const result = task.result && typeof task.result === 'object' ? task.result : {}
  const values = [task.quotaConsumed, task.pointsConsumed, result.quotaConsumed, result.pointsConsumed]
  const value = values.find((item) => item !== undefined && item !== null && item !== '')
  return value === undefined ? null : Math.max(0, Number(value) || 0)
}

function pickImageUrl(value) {
  if (!value) return ''
  if (typeof value === 'string') return value
  if (Array.isArray(value)) return pickImageUrl(value[0])
  return value.imageUrl || value.image_url || value.fileUrl || value.file_url || value.coverUrl || value.url || ''
}

function getTaskResultImageUrl(task = {}) {
  const result = task.result
  const resultObject = result && typeof result === 'object' && !Array.isArray(result) ? result : {}
  const items = Array.isArray(resultObject.items)
    ? resultObject.items
    : (resultObject.items ? [resultObject.items] : (Array.isArray(result) ? result : []))
  return pickImageUrl(task.resultImageUrl) ||
    pickImageUrl(task.result_image_url) ||
    pickImageUrl(result) ||
    pickImageUrl(resultObject.image) ||
    pickImageUrl(resultObject.coverUrl) ||
    pickImageUrl(items[0])
}

function findRun(store, options = {}) {
  const runs = Object.values(store.runs || {})
  return runs.find((run) => (
    (options.historyId && run.historyId === options.historyId) ||
    (options.batchId && run.batchId === options.batchId) ||
    (options.taskId && (run.items || []).some((item) => (
      item.currentTaskId === options.taskId || (item.attemptTaskIds || []).includes(options.taskId)
    )))
  )) || null
}

function restoreRunBySubmissionKey(submissionKey = '') {
  if (!submissionKey) return null
  const store = readStore()
  const run = Object.values(store.runs || {}).find((item) => item.submissionKey === submissionKey)
  if (!run) return null
  const batch = getBatchDetail(run.batchId).batch
  return {
    plan: getPlanSnapshot(run.planId, store),
    history: getWorkspacePlanHistory(run.historyId),
    batch,
    production: run,
    firstTask: getTask((run.childTaskIds || batch.taskIds || [])[0] || ''),
    summary: getWorkspaceProductionResultSummary({ historyId: run.historyId })
  }
}

function summarizeItems(items = []) {
  const completedCount = items.filter((item) => item.status === 'completed').length
  const failedCount = items.filter((item) => item.status === 'failed').length
  const finishedCount = completedCount + failedCount
  let summaryStatus = 'generating'
  if (!items.length || items.every((item) => item.status === 'pending')) summaryStatus = 'pending'
  else if (completedCount === items.length) summaryStatus = 'completed'
  else if (failedCount === items.length) summaryStatus = 'failed'
  else if (finishedCount === items.length && failedCount > 0) summaryStatus = 'partial_success'
  return { completedCount, failedCount, totalCount: items.length, summaryStatus }
}

function syncHistoryStatus(summary = {}, historyId = '') {
  if (!historyId || !getWorkspacePlanHistory(historyId)) return
  let status = WORKSPACE_PLAN_HISTORY_STATUS.GENERATING
  if (summary.summaryStatus === 'completed') status = WORKSPACE_PLAN_HISTORY_STATUS.COMPLETED
  if (summary.summaryStatus === 'partial_success' || summary.summaryStatus === 'partial_failed') status = WORKSPACE_PLAN_HISTORY_STATUS.PARTIAL_FAILED
  if (summary.summaryStatus === 'failed') status = WORKSPACE_PLAN_HISTORY_STATUS.FAILED
  const history = getWorkspacePlanHistory(historyId)
  if (history && history.status !== status) updateWorkspacePlanHistory(historyId, { status })
}

export function getProductionPlanDefinition(planId = '') {
  if (planId === 'quick_launch' || planId === 'product_quick_launch') return clone(QUICK_LAUNCH_PLAN)
  return null
}

function buildTaskOptions(item = {}, context = {}) {
  const clothPath = String(context.assets.cloth || '')
  const referencePath = String(context.assets.style || context.assets.design || '')
  const params = {
    ...(item.params || {}),
    ...(context.params || {}),
    historyId: context.historyId,
    planId: context.plan.planId,
    planName: context.plan.title,
    itemType: item.itemType,
    itemDisplayName: item.title || item.name,
    deliverableId: item.deliverableId,
    deliverableTitle: item.title || item.name,
    deliverableQuantity: item.quantity,
    ratio: item.ratio,
    scene: item.scene,
    purpose: item.purpose,
    quotaAction: item.quotaAction,
    costActionType: item.quotaAction,
    actionType: item.actionType,
    toolType: item.toolType,
    outputType: item.outputType,
    promptDraft: item.prompt || item.promptDraft,
    promptPlan: {
      planName: context.plan.title,
      outputUsage: item.title || item.name
    }
  }
  return {
    type: item.taskType,
    channel: 'production_guide_batch',
    input: {
      assets: {
        clothImage: { localPath: clothPath, fileUrl: clothPath },
        styleImage: { localPath: referencePath, fileUrl: referencePath }
      },
      params,
      options: { outputType: item.outputType }
    },
    params
  }
}

export function createWorkspaceProductionBatch(options = {}) {
  const plan = options.plan && typeof options.plan === 'object'
    ? sanitizePlan(options.plan)
    : getProductionPlanDefinition(options.planId || 'quick_launch')
  if (!plan) throw new Error('PRODUCTION_PLAN_NOT_FOUND')
  const availableItems = plan.items.filter((item) => item.available && item.taskType)
  if (!availableItems.length) throw new Error('PRODUCTION_PLAN_EMPTY')
  const deliverableValidation = validateDeliverables(availableItems)
  if (!deliverableValidation.ok) throw Object.assign(new Error(deliverableValidation.message), { code: deliverableValidation.code })
  const assets = options.assets && typeof options.assets === 'object' ? options.assets : {}
  if (!assets.cloth) throw new Error('CLOTH_IMAGE_REQUIRED')

  const submissionKey = String(options.submissionKey || '')
  if (!submissionKey) throw new Error('PRODUCTION_SUBMISSION_KEY_REQUIRED')
  const restored = restoreRunBySubmissionKey(submissionKey)
  if (restored) return restored

  saveWorkspaceProductionPlan(plan)
  const history = createWorkspacePlanHistory({
    planId: plan.planId,
    userId: options.userId || '',
    cost: 0
  })
  const context = {
    plan,
    historyId: history.historyId,
    assets,
    params: options.params && typeof options.params === 'object' ? options.params : {}
  }
  const execution = createGenerationExecution({
    submissionKey,
    planId: plan.planId,
    projectId: String(options.projectId || ''),
    deliverables: availableItems,
    buildTaskOptions: (slot) => buildTaskOptions(slot, context),
    createBatch: createBatchTasks
  })
  const batch = execution.batch
  const linkedHistory = linkWorkspacePlanTasks(history.historyId, batch.taskIds) || history
  const now = new Date().toISOString()
  const run = {
    productionId: execution.productionId,
    historyId: history.historyId,
    batchId: batch.batchId,
    planId: plan.planId,
    planName: plan.title,
    projectId: execution.projectId,
    submissionKey,
    expectedOutputCount: execution.expectedOutputCount,
    completedOutputCount: 0,
    failedOutputCount: 0,
    childTaskIds: [...execution.childTaskIds],
    deliverables: deliverableValidation.deliverables,
    estimatedQuotaCost: getEstimatedQuotaCost(deliverableValidation.deliverables),
    status: 'generating',
    createdAt: now,
    updatedAt: now,
    items: execution.slots.map((item, index) => ({
      deliverableId: item.deliverableId,
      outputType: item.outputType,
      sequence: item.sequence,
      quantity: item.quantity,
      itemType: item.itemType,
      displayName: item.quantity > 1 ? `${item.title} ${item.sequence}` : item.title,
      actionType: item.actionType,
      currentTaskId: batch.taskIds[index],
      attemptTaskIds: [batch.taskIds[index]],
      retryRelations: []
    }))
  }
  const store = readStore()
  store.runs[run.historyId] = run
  writeStore(store)
  return {
    plan,
    history: linkedHistory,
    batch,
    production: run,
    firstTask: getTask(batch.taskIds[0]),
    summary: getWorkspaceProductionResultSummary({ historyId: run.historyId })
  }
}

export function createWorkspaceOutputVariantBatch(options = {}) {
  const outputCount = normalizeOutputVariantCount(options.outputCount)
  const baseTaskOptions = options.taskOptions && typeof options.taskOptions === 'object'
    ? options.taskOptions
    : {}
  if (!baseTaskOptions.type) throw new Error('OUTPUT_VARIANT_TASK_TYPE_REQUIRED')

  const batchId = String(options.batchId || createBatchId())
  const submissionKey = String(options.submissionKey || `${batchId}_submit`)
  const plan = sanitizePlan({
    planId: String(options.planId || 'style_redesign_variants'),
    guideId: String(options.guideId || ''),
    title: String(options.planName || '改款式'),
    category: String(options.category || '服装改款'),
    entryType: String(options.entryType || 'style'),
    outputCount,
    items: Array.from({ length: outputCount }, (_, index) => ({
      deliverableId: `${String(options.itemType || 'style_redesign')}_${index + 1}`,
      itemType: String(options.itemType || 'style_redesign'),
      name: `${String(options.itemDisplayName || '改款方案')} ${index + 1}`,
      title: `${String(options.itemDisplayName || '改款方案')} ${index + 1}`,
      quantity: 1,
      ratio: String((((baseTaskOptions.input || {}).options || {}).ratio) || '1:1'),
      scene: '服装改款方案',
      purpose: '款式设计',
      prompt: String((((baseTaskOptions.input || {}).params || {}).promptDraft) || (baseTaskOptions.params || {}).promptDraft || '生成独立服装改款方案'),
      status: 'pending',
      actionType: String(baseTaskOptions.type),
      taskType: String(baseTaskOptions.type),
      toolType: 'refine',
      outputType: String(options.outputType || 'style_redesign_image'),
      available: true
    }))
  })
  const restored = restoreRunBySubmissionKey(submissionKey)
  if (restored) return restored
  saveWorkspaceProductionPlan(plan)

  const history = createWorkspacePlanHistory({
    planId: plan.planId,
    userId: options.userId || '',
    cost: Math.max(0, Number(options.cost) || 0)
  })
  const slots = buildOutputVariantSlots(outputCount, submissionKey)
  const items = plan.items.map((item, index) => {
    const slot = slots[index]
    const itemParams = {
      ...((baseTaskOptions.input && baseTaskOptions.input.params) || {}),
      ...(baseTaskOptions.params || {}),
      historyId: history.historyId,
      planId: plan.planId,
      planName: plan.title,
      itemType: item.itemType,
      itemDisplayName: item.name,
      outputIndex: slot.outputIndex,
      outputSlot: slot.outputSlot,
      outputCount: slot.outputCount,
      styleOutputCount: 1,
      count: 1,
      expectedOutputCount: slot.expectedOutputCount,
      parentTaskId: batchId,
      batchId,
      clientRequestId: slot.clientRequestId,
      idempotencyKey: slot.idempotencyKey
    }
    return {
      item,
      taskOptions: {
        ...baseTaskOptions,
        clientTaskId: itemParams.clientRequestId,
        batchId,
        input: {
          ...(baseTaskOptions.input || {}),
          params: itemParams,
          options: {
            ...((baseTaskOptions.input && baseTaskOptions.input.options) || {}),
            outputCount: slot.outputCount,
            expectedOutputCount: slot.expectedOutputCount,
            outputIndex: slot.outputIndex
          }
        },
        params: itemParams
      }
    }
  })
  const execution = createGenerationExecution({
    productionId: batchId,
    batchId,
    submissionKey,
    planId: plan.planId,
    deliverables: plan.items,
    buildTaskOptions: (slot) => {
      const entry = items[slot.outputIndex - 1]
      return entry ? entry.taskOptions : {}
    },
    createBatch: createBatchTasks
  })
  const batch = execution.batch
  const linkedHistory = linkWorkspacePlanTasks(history.historyId, batch.taskIds) || history
  const now = new Date().toISOString()
  const run = {
    productionId: execution.productionId,
    historyId: history.historyId,
    batchId: batch.batchId,
    planId: plan.planId,
    planName: plan.title,
    submissionKey,
    expectedOutputCount: execution.expectedOutputCount,
    completedOutputCount: 0,
    failedOutputCount: 0,
    childTaskIds: [...execution.childTaskIds],
    deliverables: plan.items,
    status: 'generating',
    createdAt: now,
    updatedAt: now,
    items: items.map((entry, index) => ({
      deliverableId: entry.item.deliverableId,
      outputType: entry.item.outputType,
      sequence: index + 1,
      quantity: 1,
      itemType: entry.item.itemType,
      displayName: entry.item.name,
      actionType: entry.item.actionType,
      currentTaskId: batch.taskIds[index],
      attemptTaskIds: [batch.taskIds[index]],
      retryRelations: []
    }))
  }
  const store = readStore()
  store.runs[run.historyId] = run
  writeStore(store)
  return {
    plan,
    history: linkedHistory,
    batch,
    production: run,
    firstTask: getTask(batch.taskIds[0]),
    summary: getWorkspaceProductionResultSummary({ historyId: run.historyId })
  }
}

export function createWorkspaceGarmentDetailBatch(options = {}) {
  const baseTaskOptions = options.taskOptions && typeof options.taskOptions === 'object'
    ? options.taskOptions
    : {}
  const selectedDetails = Array.isArray(options.selectedDetails) ? options.selectedDetails : []
  const detailReferences = options.detailReferences && typeof options.detailReferences === 'object'
    ? options.detailReferences
    : {}
  const validation = validateGarmentDetailSelection({ selectedDetails, detailReferences })
  if (!validation.ok) {
    const error = new Error(validation.message)
    error.code = validation.code
    error.detailType = validation.detailType || ''
    throw error
  }

  const batchId = String(options.batchId || createBatchId())
  const submissionKey = String(options.submissionKey || `${batchId}_submit`)
  const mode = options.mode === GARMENT_DETAIL_MODES.AI_REFERENCE
    ? GARMENT_DETAIL_MODES.AI_REFERENCE
    : GARMENT_DETAIL_MODES.FAITHFUL
  const children = buildGarmentDetailChildren({
    selectedDetails,
    detailReferences,
    submissionKey,
    mode,
    additionalRequirements: options.additionalRequirements
  })
  const outputCount = children.length
  const plan = sanitizePlan({
    planId: 'garment_detail_batch',
    title: '服装细节图',
    category: '商品素材',
    entryType: 'detail',
    outputCount,
    items: children.map((child) => ({
      deliverableId: child.itemType,
      itemType: child.itemType,
      name: child.displayName,
      title: child.displayName,
      quantity: 1,
      ratio: String((((baseTaskOptions.input || {}).options || {}).ratio) || '1:1'),
      scene: '商品细节展示',
      purpose: '商品详情页',
      prompt: child.promptDraft,
      status: 'pending',
      actionType: child.taskType,
      taskType: child.taskType,
      toolType: 'detail_photo',
      outputType: 'garment_detail_image',
      available: true
    }))
  })
  const restored = restoreRunBySubmissionKey(submissionKey)
  if (restored) return restored
  saveWorkspaceProductionPlan(plan)

  const history = createWorkspacePlanHistory({
    planId: plan.planId,
    userId: options.userId || '',
    cost: Math.max(0, Number(options.cost) || 0)
  })
  const originalAssets = (baseTaskOptions.input && baseTaskOptions.input.assets) || {}
  const originalImage = originalAssets.baseImage || originalAssets.clothImage || {}
  const taskEntries = children.map((child) => {
    const itemParams = {
      ...((baseTaskOptions.input && baseTaskOptions.input.params) || {}),
      ...(baseTaskOptions.params || {}),
      historyId: history.historyId,
      planId: plan.planId,
      planName: plan.title,
      parentTaskType: GARMENT_DETAIL_PARENT_TASK_TYPE,
      parentTaskId: batchId,
      batchId,
      itemType: child.itemType,
      itemDisplayName: child.displayName,
      actionType: child.taskType,
      taskType: child.taskType,
      detailType: child.detailType,
      detailGenerationMode: mode,
      outputIndex: child.outputIndex,
      outputCount: 1,
      count: 1,
      expectedOutputCount: outputCount,
      singleDetailOnly: true,
      promptDraft: child.promptDraft,
      negativePrompt: child.negativePrompt,
      clientRequestId: child.idempotencyKey,
      idempotencyKey: child.idempotencyKey,
      requiresQualityReview: true,
      qualityReviewReason: mode === GARMENT_DETAIL_MODES.AI_REFERENCE ? 'AI推测参考' : '关键商品细节需人工核对'
    }
    const detailAsset = {
      localPath: child.detailReferenceImage,
      fileUrl: child.detailReferenceImage
    }
    return {
      child,
      taskOptions: {
        ...baseTaskOptions,
        type: child.taskType,
        channel: 'garment_detail_batch',
        clientTaskId: child.idempotencyKey,
        batchId,
        input: {
          ...(baseTaskOptions.input || {}),
          imageUrl: child.detailReferenceImage,
          image_url: child.detailReferenceImage,
          assets: {
            ...originalAssets,
            baseImage: originalImage,
            detailReferenceImage: detailAsset
          },
          params: itemParams,
          options: {
            ...((baseTaskOptions.input && baseTaskOptions.input.options) || {}),
            detailType: child.detailType,
            detailGenerationMode: mode,
            outputCount: 1,
            expectedOutputCount: outputCount,
            singleDetailOnly: true,
            preserveColor: true,
            preserveMaterial: true,
            preserveHardware: true,
            preserveStitching: true,
            preserveStructure: true,
            requiresQualityReview: true
          }
        },
        params: itemParams
      }
    }
  })
  const execution = createGenerationExecution({
    productionId: batchId,
    batchId,
    submissionKey,
    planId: plan.planId,
    deliverables: plan.items,
    buildTaskOptions: (slot) => {
      const entry = taskEntries.find((candidate) => candidate.child.itemType === slot.deliverableId)
      return entry ? entry.taskOptions : {}
    },
    createBatch: createBatchTasks
  })
  const batch = execution.batch
  const linkedHistory = linkWorkspacePlanTasks(history.historyId, batch.taskIds) || history
  const now = new Date().toISOString()
  const run = {
    productionId: execution.productionId,
    historyId: history.historyId,
    batchId: batch.batchId,
    planId: plan.planId,
    planName: plan.title,
    submissionKey,
    expectedOutputCount: execution.expectedOutputCount,
    completedOutputCount: 0,
    failedOutputCount: 0,
    childTaskIds: [...execution.childTaskIds],
    deliverables: plan.items,
    status: 'generating',
    createdAt: now,
    updatedAt: now,
    items: taskEntries.map((entry, index) => ({
      deliverableId: entry.child.itemType,
      outputType: 'garment_detail_image',
      sequence: 1,
      quantity: 1,
      itemType: entry.child.itemType,
      displayName: entry.child.displayName,
      actionType: entry.child.taskType,
      currentTaskId: batch.taskIds[index],
      attemptTaskIds: [batch.taskIds[index]],
      retryRelations: []
    }))
  }
  const store = readStore()
  store.runs[run.historyId] = run
  writeStore(store)
  return {
    plan,
    history: linkedHistory,
    batch,
    production: run,
    firstTask: getTask(batch.taskIds[0]),
    summary: getWorkspaceProductionResultSummary({ historyId: run.historyId })
  }
}

export function getWorkspaceProductionResultSummary(options = {}) {
  const store = readStore()
  const run = findRun(store, options)
  const batchId = (run && run.batchId) || options.batchId || ''
  const batchDetail = batchId ? getBatchDetail(batchId) : null
  const batchTasks = batchDetail ? batchDetail.tasks : []
  let items = []

  if (run) {
    items = (run.items || []).map((runItem) => {
      const task = getTask(runItem.currentTaskId) || batchTasks.find((item) => item.taskId === runItem.currentTaskId) || {}
      const taskParams = (task.input && task.input.params) || task.params || {}
      const status = normalizeTaskStatus(task.status)
      const taskError = status === 'failed' ? getTaskError(task) : { errorCode: '', errorMessage: '' }
      return {
        deliverableId: runItem.deliverableId || taskParams.deliverableId || '',
        outputType: runItem.outputType || taskParams.outputType || '',
        sequence: Number(runItem.sequence || taskParams.sequence || taskParams.outputIndex) || 1,
        itemType: runItem.itemType,
        displayName: runItem.displayName || ITEM_TYPE_LABELS[runItem.itemType] || '生成素材',
        taskId: runItem.currentTaskId,
        status,
        imageUrl: getTaskResultImageUrl(task),
        quotaConsumed: getTaskQuotaConsumed(task),
        qualityStatus: taskParams.requiresQualityReview === true ? 'needs_review' : '',
        qualityReviewReason: taskParams.qualityReviewReason || '',
        ...taskError,
        canRetry: status === 'failed',
        attemptTaskIds: [...(runItem.attemptTaskIds || [])],
        retryRelations: [...(runItem.retryRelations || [])]
      }
    })
  } else if (batchTasks.length) {
    items = batchTasks.map((task) => {
      const params = (task.input && task.input.params) || task.params || {}
      const itemType = String(params.itemType || task.type || 'generated_image')
      const status = normalizeTaskStatus(task.status)
      return {
        itemType,
        displayName: params.itemDisplayName || ITEM_TYPE_LABELS[itemType] || '生成素材',
        taskId: task.taskId,
        status,
        imageUrl: getTaskResultImageUrl(task),
        quotaConsumed: getTaskQuotaConsumed(task),
        qualityStatus: params.requiresQualityReview === true ? 'needs_review' : '',
        qualityReviewReason: params.qualityReviewReason || '',
        ...(status === 'failed' ? getTaskError(task) : { errorCode: '', errorMessage: '' }),
        canRetry: status === 'failed',
        attemptTaskIds: [task.taskId],
        retryRelations: []
      }
    })
  } else {
    const task = getTask(options.taskId || '')
    if (task) {
      const params = (task.input && task.input.params) || task.params || {}
      const itemType = String(params.itemType || params.outputType || task.type || 'generated_image')
      const status = normalizeTaskStatus(task.status)
      items = [{
        itemType,
        displayName: params.itemDisplayName || ITEM_TYPE_LABELS[itemType] || '生成素材',
        taskId: task.taskId,
        status,
        imageUrl: getTaskResultImageUrl(task),
        quotaConsumed: getTaskQuotaConsumed(task),
        qualityStatus: params.requiresQualityReview === true ? 'needs_review' : '',
        qualityReviewReason: params.qualityReviewReason || '',
        ...(status === 'failed' ? getTaskError(task) : { errorCode: '', errorMessage: '' }),
        canRetry: status === 'failed',
        attemptTaskIds: [task.taskId],
        retryRelations: []
      }]
    }
  }

  const counts = summarizeItems(items)
  const firstTask = items.length ? getTask(items[0].taskId) : null
  const firstParams = firstTask && firstTask.input ? firstTask.input.params || {} : {}
  const summary = {
    planId: (run && run.planId) || firstParams.planId || '',
    planName: (run && run.planName) || firstParams.planName || 'AI生成方案',
    historyId: (run && run.historyId) || options.historyId || firstParams.historyId || '',
    batchId,
    ...counts,
    items
  }
  if (run) {
    run.status = summary.summaryStatus
    run.expectedOutputCount = Math.max(Number(run.expectedOutputCount) || 0, summary.totalCount)
    run.completedOutputCount = summary.completedCount
    run.failedOutputCount = summary.failedCount
    run.updatedAt = new Date().toISOString()
    store.runs[run.historyId] = run
    writeStore(store)
  }
  syncHistoryStatus(summary, summary.historyId)
  return summary
}

export function retryWorkspaceProductionItem(options = {}) {
  const store = readStore()
  const run = findRun(store, options)
  if (!run || !run.batchId) return { ok: false, status: 'not_found', taskId: '' }
  const candidates = (run.items || []).filter((candidate) => (
    options.taskId
      ? candidate.currentTaskId === options.taskId || (candidate.attemptTaskIds || []).includes(options.taskId)
      : candidate.itemType === options.itemType
  ))
  const item = candidates.length === 1 ? candidates[0] : null
  if (!item) return { ok: false, status: 'not_found', taskId: '' }
  const task = getTask(item.currentTaskId)
  if (!task || normalizeTaskStatus(task.status) !== 'failed') {
    return { ok: false, status: 'not_retryable', taskId: item.currentTaskId }
  }
  const nextAttempt = (item.attemptTaskIds || []).length + 1
  const clientRequestId = String(options.clientRequestId || `production_retry_${run.productionId || run.historyId}_${item.deliverableId || item.itemType}_${item.sequence || 1}_${nextAttempt}`)
  const retried = retryBatchTask(run.batchId, item.currentTaskId, {
    historyId: run.historyId,
    clientRequestId
  })
  const nextTaskId = retried.taskIds && retried.taskIds[0]
  if (!nextTaskId) return { ok: false, status: 'retry_failed', taskId: '' }
  item.retryRelations = [...(item.retryRelations || []), {
    previousTaskId: item.currentTaskId,
    retryTaskId: nextTaskId,
    createdAt: new Date().toISOString()
  }]
  item.attemptTaskIds = [...(item.attemptTaskIds || []), nextTaskId]
  item.currentTaskId = nextTaskId
  run.status = 'generating'
  run.updatedAt = new Date().toISOString()
  store.runs[run.historyId] = run
  writeStore(store)
  linkWorkspacePlanTasks(run.historyId, [nextTaskId])
  return { ok: true, status: 'generating', taskId: nextTaskId, batchId: run.batchId, historyId: run.historyId }
}

function getPlanSnapshot(planId, store) {
  const saved = store.plans[planId]
  if (saved) return sanitizePlan(saved)
  const guideId = inferGuideId(planId)
  const fallback = GUIDE_DEFAULTS[guideId] || {}
  return sanitizePlan({
    planId,
    guideId,
    title: fallback.title || '智能生产方案',
    category: fallback.category || '智能生产',
    entryType: fallback.entryType || 'model',
    actions: (fallback.actions || []).map((label) => ({ label }))
  })
}

function syncTimeline(history, store) {
  const timeline = Array.isArray(store.timelines[history.historyId])
    ? store.timelines[history.historyId]
    : []
  const latest = timeline[timeline.length - 1]
  if (!latest || latest.status !== history.status) {
    const eventTime = history.status === WORKSPACE_PLAN_HISTORY_STATUS.PENDING
      ? history.createdAt
      : history.updatedAt
    if (eventTime) {
      timeline.push({ status: history.status, createdAt: eventTime })
      store.timelines[history.historyId] = timeline
      console.log('[workspace:production]', {
        historyId: history.historyId,
        status: history.status
      })
    }
  }
  return timeline
}

function toProduction(history, store) {
  const plan = getPlanSnapshot(history.planId, store)
  const statusChanges = syncTimeline(history, store)
  const terminalEvent = [...statusChanges].reverse().find((item) => (
    item.status === WORKSPACE_PLAN_HISTORY_STATUS.COMPLETED ||
    item.status === WORKSPACE_PLAN_HISTORY_STATUS.PARTIAL_FAILED ||
    item.status === WORKSPACE_PLAN_HISTORY_STATUS.FAILED
  ))
  return {
    historyId: history.historyId,
    planId: history.planId,
    planName: plan.title,
    planType: plan.category,
    guideId: plan.guideId,
    entryType: plan.entryType,
    actions: plan.actions,
    taskIds: [...history.taskIds],
    assetIds: [...history.assetIds],
    cost: history.cost,
    status: history.status,
    createdAt: history.createdAt,
    updatedAt: history.updatedAt,
    completedAt: terminalEvent ? terminalEvent.createdAt : '',
    generationCount: history.taskIds.length,
    workCount: history.assetIds.length,
    statusChanges
  }
}

export function saveWorkspaceProductionPlan(plan = {}) {
  const snapshot = sanitizePlan(plan)
  if (!snapshot.planId) return null
  const store = readStore()
  store.plans[snapshot.planId] = snapshot
  writeStore(store)
  return snapshot
}

export function getWorkspaceProductions() {
  const store = readStore()
  const productions = getWorkspacePlanHistories().map((history) => toProduction(history, store))
  writeStore(store)
  return productions
}

export function getWorkspaceProductionDetail(historyId = '') {
  const history = getWorkspacePlanHistory(historyId)
  if (!history) return null
  const store = readStore()
  const production = toProduction(history, store)
  writeStore(store)
  return production
}

export function getWorkspaceProductionStats(productions = getWorkspaceProductions()) {
  const records = Array.isArray(productions) ? productions : []
  return {
    totalPlans: new Set(records.map((item) => item.planId).filter(Boolean)).size,
    totalGenerations: records.reduce((total, item) => total + item.generationCount, 0),
    successCount: records.filter((item) => item.status === WORKSPACE_PLAN_HISTORY_STATUS.COMPLETED).length,
    failedCount: records.filter((item) => item.status === WORKSPACE_PLAN_HISTORY_STATUS.FAILED).length
  }
}

export function createWorkspaceProductionRetry(historyId = '', userId = '') {
  const original = getWorkspaceProductionDetail(historyId)
  if (!original) return null
  const history = createWorkspacePlanHistory({
    planId: original.planId,
    userId,
    cost: original.cost
  })
  const production = getWorkspaceProductionDetail(history.historyId)
  return { original, history, production, entryType: original.entryType || 'model' }
}

export function getWorkspaceProductionStatusLabel(status = '') {
  const labels = {
    pending: '等待执行',
    generating: '生成中',
    completed: '已完成',
    partial_success: '部分完成',
    partial_failed: '部分完成',
    failed: '生成失败'
  }
  return labels[status] || '等待执行'
}

export function formatWorkspaceProductionTime(value = '') {
  if (!value) return '--'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '--'
  const pad = (number) => String(number).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}
