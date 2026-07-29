export const QUOTA_PREVIEW_COST_CONFIG = Object.freeze({
  model_replace: 5,
  color_replace: 3,
  pattern_replace: 8,
  scene_replace: 2,
  batch_generate: 5
})

const TASK_TYPE_ALIASES = Object.freeze({
  color_change: 'color_replace',
  scene_change: 'scene_replace'
})

export function normalizeQuotaTaskType(taskType = '') {
  return TASK_TYPE_ALIASES[taskType] || taskType
}

export function getEstimatedCost(taskType = '', totalCount = 1) {
  const normalizedTaskType = normalizeQuotaTaskType(taskType)
  const unitCost = QUOTA_PREVIEW_COST_CONFIG[normalizedTaskType] || 0
  const count = Math.max(1, Number(totalCount) || 1)
  return unitCost * count
}

export function estimateQuota(action = '', count = 1, user = {}) {
  const normalizedAction = normalizeQuotaTaskType(action)
  const normalizedCount = Math.max(1, Math.floor(Number(count) || 1))
  const unitCost = QUOTA_PREVIEW_COST_CONFIG[normalizedAction] || 0
  const totalCost = unitCost * normalizedCount
  const remaining = Math.max(0, Number(user.remaining ?? user.points ?? user.availablePoints) || 0)
  const result = {
    action: normalizedAction,
    count: normalizedCount,
    unitCost,
    totalCost,
    remaining,
    enough: totalCost <= remaining
  }
  console.log('[quota:preview]', {
    action: result.action,
    count: result.count,
    totalCost: result.totalCost,
    remaining: result.remaining
  })
  return result
}

export function buildQuotaPreview({ taskType = '', totalCount = 1, availablePoints = 0 } = {}) {
  const estimate = estimateQuota(taskType, totalCount, { availablePoints })

  return {
    taskType: estimate.action,
    unitCost: estimate.unitCost,
    totalCount: estimate.count,
    estimatedCost: estimate.totalCost,
    availablePoints: estimate.remaining,
    isInsufficient: !estimate.enough
  }
}
