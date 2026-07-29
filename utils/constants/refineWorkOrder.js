import { getTaskResultImageUrl, isMockOrFallbackTask } from './originalProtectionPackage'

export const REFINE_ORDER_STATUS = Object.freeze({
  DRAFT: 'draft',
  SUBMITTED: 'submitted',
  ASSIGNED: 'assigned',
  PROCESSING: 'processing',
  DELIVERED: 'delivered',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  CANCELLED: 'cancelled'
})

export const REFINE_ORDER_TYPE = Object.freeze({
  BASIC: 'basic_refine',
  DEEP: 'deep_refine',
  DESIGNER_ASSIST: 'designer_assist'
})

export const REFINE_ORDER_TYPE_TEXT = Object.freeze({
  [REFINE_ORDER_TYPE.BASIC]: '基础精修',
  [REFINE_ORDER_TYPE.DEEP]: '深度精修',
  [REFINE_ORDER_TYPE.DESIGNER_ASSIST]: '设计师协助'
})

export const REFINE_ORDER_PRICE = Object.freeze({
  [REFINE_ORDER_TYPE.BASIC]: 3.99,
  [REFINE_ORDER_TYPE.DEEP]: 19.9,
  [REFINE_ORDER_TYPE.DESIGNER_ASSIST]: 99
})

export const REFINE_ORDER_STATUS_TEXT = Object.freeze({
  [REFINE_ORDER_STATUS.DRAFT]: '草稿',
  [REFINE_ORDER_STATUS.SUBMITTED]: '已提交',
  [REFINE_ORDER_STATUS.ASSIGNED]: '已领取',
  [REFINE_ORDER_STATUS.PROCESSING]: '处理中',
  [REFINE_ORDER_STATUS.DELIVERED]: '已交付',
  [REFINE_ORDER_STATUS.APPROVED]: '客户已确认',
  [REFINE_ORDER_STATUS.REJECTED]: '客户驳回',
  [REFINE_ORDER_STATUS.CANCELLED]: '已取消'
})

const REFINE_ORDER_REASON_TEXT = Object.freeze({
  missing_task: '任务不存在',
  missing_result_image: '缺少结果图，无法申请精修'
})

function createShortCode() {
  return Math.random().toString(36).slice(2, 8)
}

function getTaskIdentity(task = {}) {
  return task.taskId || task.id || task.clientTaskId || ''
}

function getTaskSourceImageUrl(task = {}) {
  const clothImage =
    task.input &&
    task.input.assets &&
    (task.input.assets.clothImage || task.input.assets.cloth_image)
  const image = clothImage || {}
  return image.fileUrl ||
    image.file_url ||
    image.imageUrl ||
    image.image_url ||
    image.url ||
    image.localPath ||
    image.tempFilePath ||
    image.path ||
    ''
}

export function canCreateRefineWorkOrder(task) {
  if (!task) {
    return {
      ok: false,
      reason: 'missing_task',
      reasonText: REFINE_ORDER_REASON_TEXT.missing_task
    }
  }

  if (!getTaskResultImageUrl(task)) {
    return {
      ok: false,
      reason: 'missing_result_image',
      reasonText: REFINE_ORDER_REASON_TEXT.missing_result_image
    }
  }

  return {
    ok: true,
    reason: '',
    reasonText: ''
  }
}

export function createRefineWorkOrderDraft(task, options = {}) {
  const now = new Date().toISOString()
  const input = (task && task.input) || {}
  const params = input.params || {}
  const orderType = options.orderType || REFINE_ORDER_TYPE.BASIC
  const taskId = getTaskIdentity(task)
  const sourceIsMockOrFallback = isMockOrFallbackTask(task)

  return {
    orderId: `rwo_${Date.now()}_${createShortCode()}`,
    orderType,
    status: options.status || REFINE_ORDER_STATUS.SUBMITTED,
    projectId: options.projectId || task.projectId || '',
    taskId,
    clientTaskId: task.clientTaskId || '',
    sourceResultImageUrl: getTaskResultImageUrl(task),
    sourceImageUrl: getTaskSourceImageUrl(task),
    provider: task.provider || (task.data && task.data.provider) || (task.result && task.result.provider) || '',
    mock: task.mock === true || (task.data && task.data.mock === true) || (task.result && task.result.mock === true),
    fallback: task.fallback === true || (task.data && task.data.fallback === true) || (task.result && task.result.fallback === true),
    sourceIsMockOrFallback,
    membershipTier: options.membershipTier || '',
    quotaConsumed: Number(options.quotaConsumed || 0) || 0,
    quotaBefore: Number(options.quotaBefore || 0) || 0,
    quotaAfter: Number(options.quotaAfter || 0) || 0,
    quotaConsumeReason: options.quotaConsumeReason || '',
    entryScene: params.entryScene || input.entryScene || task.entryScene || '',
    templateType: params.templateType || '',
    finalStyleCode: params.finalStyleCode || '',
    finalSceneCode: params.finalSceneCode || '',
    finalBodyType: params.finalBodyType || '',
    requirementText: options.requirementText || '',
    createdAt: now,
    updatedAt: now,
    auditTrail: [
      {
        eventType: 'refine_order_submitted',
        actorType: 'customer',
        actorId: options.actorId || 'miniapp_user',
        action: 'refine_order_draft_created',
        orderType,
        taskId,
        sourceIsMockOrFallback,
        createdAt: now,
        summary: '用户提交人工精修意向'
      }
    ]
  }
}
