import { initCloudBase, isCloudBaseReady } from '../cloudbase/init'
import { GENERATION_STATUSES, normalizeGenerationStatus } from '../task/generationContract'

const QUOTA_FUNCTION_NAME = 'quota_guard'
const ALPHA_ACTION = 'model_replace'
const QUOTA_ACTION_TYPE_MAP = Object.freeze({
  [ALPHA_ACTION]: 'ai_model_image',
  head_replace: 'ai_model_image',
  face_replace: 'ai_model_image',
  clothes_replace: 'ai_model_image',
  garment_replace: 'ai_model_image',
  virtual_try_on: 'ai_model_image',
  pose_replace: 'ai_model_image',
  pose_adjust: 'ai_model_image',
  scene_replace: 'basic_background',
  color_replace: 'basic_recolor',
  fabric_replace: 'fabric_replace',
  pattern_replace: 'print_placement',
  micro_redesign: 'hot_style_remix',
  style_redesign: 'hot_style_remix',
  flat_lay_generate: 'detail_closeup',
  detail_photo_generate: 'detail_closeup',
  display_3d_generate: 'detail_closeup',
  hanging_photo_generate: 'detail_closeup',
  mannequin_generate: 'detail_closeup',
  detail_page_long_image: 'detail_long_image',
  ai_model_image: 'ai_model_image'
  ,image_to_sketch: 'image_to_sketch'
  ,sketch_to_model: 'sketch_to_model'
  ,sketch_remix: 'hot_style_remix'
  ,text_to_sketch: 'sketch_to_model'
  ,sketch_to_tech_pack: 'sketch_to_model'
  ,print_generate: 'print_generate'
  ,print_placement: 'print_placement'
  ,detail_closeup: 'detail_closeup'
})

function createQuotaError(code, message, raw = null) {
  const error = new Error(message || code || '额度服务调用失败')
  error.code = code || 'QUOTA_FLOW_FAILED'
  error.raw = raw
  return error
}

function ensureQuotaCloudReady() {
  if (typeof wx === 'undefined' || !wx || !wx.cloud || typeof wx.cloud.callFunction !== 'function') {
    return false
  }
  if (!isCloudBaseReady()) initCloudBase()
  return isCloudBaseReady()
}

async function callQuotaGuard(data = {}) {
  if (!ensureQuotaCloudReady()) {
    throw createQuotaError('QUOTA_CLOUD_UNAVAILABLE', '真实额度服务暂不可用')
  }
  const response = await wx.cloud.callFunction({
    name: QUOTA_FUNCTION_NAME,
    data
  })
  return (response && response.result) || {}
}

export function createQuotaAlphaTaskId() {
  return `task_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

export function isQuotaAlphaAction(action = '', count = 1) {
  return Boolean(QUOTA_ACTION_TYPE_MAP[action]) && Number(count) === 1
}

export async function consumeQuota({ taskId = '', action = '', count = 1, cost = 0 } = {}) {
  if (!taskId || !isQuotaAlphaAction(action, count)) {
    throw createQuotaError('QUOTA_ALPHA_ACTION_BLOCKED', '当前 Alpha 仅支持单张换模特')
  }
  const idempotencyKey = `${taskId}:${action}`
  const result = await callQuotaGuard({
    action: 'consumeAiPoints',
    actionType: QUOTA_ACTION_TYPE_MAP[action],
    costActionType: QUOTA_ACTION_TYPE_MAP[action],
    sourceTaskId: taskId,
    taskId,
    count: 1,
    idempotencyKey
  })
  const record = result && result.data && result.data.record
  if (!result.ok || !record || !record.recordId) {
    throw createQuotaError(result.errorCode || result.reason || 'QUOTA_CONSUME_FAILED', result.reasonText || '积分扣减失败', result)
  }
  if (result.mock) {
    throw createQuotaError('REAL_QUOTA_NOT_ENABLED', '真实额度 Alpha 尚未开启', result)
  }
  if (!['consumed', 'finalized'].includes(record.status)) {
    throw createQuotaError('QUOTA_RECORD_NOT_CONSUMED', '额度记录未进入已消费状态', result)
  }
  console.log('[quota:consume]', {
    action,
    cost: Number(record.costValue || cost || 0),
    quotaRecordId: record.recordId
  })
  return {
    quotaRecordId: record.recordId,
    quotaRecordStatus: record.status,
    idempotencyKey,
    cost: Number(record.costValue || cost || 0)
  }
}

export async function finalizeQuota(quotaRecordId = '') {
  if (!quotaRecordId) return null
  const result = await callQuotaGuard({
    action: 'finalizeUsage',
    recordId: quotaRecordId,
    reason: 'provider_success'
  })
  if (!result.ok) {
    throw createQuotaError(result.errorCode || result.reason || 'QUOTA_FINALIZE_FAILED', result.reasonText || '额度结算失败', result)
  }
  console.log('[quota:finalize]', { quotaRecordId })
  return result
}

export async function rollbackQuota(quotaRecordId = '', reason = 'task_failed') {
  if (!quotaRecordId) return null
  const result = await callQuotaGuard({
    action: 'rollbackUsage',
    recordId: quotaRecordId,
    statusReason: reason
  })
  if (!result.ok) {
    throw createQuotaError(result.errorCode || result.reason || 'QUOTA_ROLLBACK_FAILED', result.reasonText || '额度回滚失败', result)
  }
  console.log('[quota:rollback]', { quotaRecordId })
  return result
}

export function settleQuotaByTask({ taskId = '', quotaRecordId = '', taskReader, intervalMs = 800, maxAttempts = 180 } = {}) {
  if (typeof taskReader !== 'function') {
    throw createQuotaError('TASK_READER_REQUIRED', '额度结算缺少任务状态读取器')
  }
  let attempts = 0
  let settled = false
  const settle = async () => {
    if (settled) return
    attempts += 1
    const task = taskReader(taskId)
    const taskStatus = task ? normalizeGenerationStatus(task.status) : ''
    if (task && taskStatus === GENERATION_STATUSES.COMPLETED) {
      settled = true
      try {
        if (task.mock || task.provider === 'mock' || task.fallbackReason) {
          await rollbackQuota(quotaRecordId, 'mock_or_fallback_result')
        } else {
          await finalizeQuota(quotaRecordId)
        }
      } catch (error) {
        console.warn('[quota:settlement] failed', {
          taskId,
          errorCode: error && error.code ? error.code : 'QUOTA_SETTLEMENT_FAILED'
        })
      }
      return
    }
    if (task && [GENERATION_STATUSES.FAILED, GENERATION_STATUSES.RESULT_MISSING, GENERATION_STATUSES.CANCELLED].includes(taskStatus)) {
      settled = true
      try {
        await rollbackQuota(quotaRecordId, taskStatus)
      } catch (error) {
        console.warn('[quota:settlement] failed', {
          taskId,
          errorCode: error && error.code ? error.code : 'QUOTA_ROLLBACK_FAILED'
        })
      }
      return
    }
    if (attempts < maxAttempts) {
      setTimeout(settle, intervalMs)
    }
  }
  setTimeout(settle, intervalMs)
}
