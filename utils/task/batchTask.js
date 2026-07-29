import { getMainChainState, patchMainChainState } from '../mainChainState'
import { createTaskAndRun } from './taskLayer'

export const BATCH_STATUS = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  SUCCESS: 'success',
  FAILED: 'failed',
  COMPLETED: 'completed'
}

function nowIso() {
  return new Date().toISOString()
}

export function createBatchId() {
  return `batch_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

export function normalizeBatchConfig(config = {}) {
  const modelCount = Math.max(1, Number(config.modelCount) || 1)
  const colorCount = Math.max(1, Number(config.colorCount) || 1)
  const sceneCount = Math.max(1, Number(config.sceneCount) || 1)
  return {
    modelCount,
    colorCount,
    sceneCount,
    totalCount: modelCount * colorCount * sceneCount
  }
}

function upsertBatch(batch) {
  const state = getMainChainState()
  const batches = state.batches || {}
  const byId = {
    ...(batches.byId || {}),
    [batch.batchId]: batch
  }
  const allIds = Array.isArray(batches.allIds) ? [...batches.allIds] : []
  if (!allIds.includes(batch.batchId)) {
    allIds.unshift(batch.batchId)
  }
  return patchMainChainState({
    currentBatchId: batch.batchId,
    batches: {
      ...batches,
      byId,
      allIds
    }
  }).batches.byId[batch.batchId]
}

export function getBatch(batchId) {
  const state = getMainChainState()
  return (state.batches && state.batches.byId && state.batches.byId[batchId]) || null
}

export function createBatchRecord(options = {}) {
  const batchId = options.batchId || createBatchId()
  const createdAt = nowIso()
  const totalCount = Math.max(0, Number(options.totalCount) || 0)
  return upsertBatch({
    batchId,
    ...((options.metadata && typeof options.metadata === 'object') ? options.metadata : {}),
    batchConfig: normalizeBatchConfig(options.batchConfig || { modelCount: Math.max(1, totalCount) }),
    totalCount,
    completedCount: 0,
    failedCount: 0,
    taskIds: [],
    status: BATCH_STATUS.PENDING,
    statusText: '等待生成',
    createdAt,
    updatedAt: createdAt
  })
}

export function attachBatchTask(batchId = '', taskId = '') {
  const batch = getBatch(batchId)
  if (!batch || !taskId) return batch
  const taskIds = Array.from(new Set([...(batch.taskIds || []), taskId]))
  return upsertBatch({
    ...batch,
    taskIds,
    totalCount: Math.max(Number(batch.totalCount) || 0, taskIds.length),
    status: BATCH_STATUS.PROCESSING,
    statusText: '生成中',
    updatedAt: nowIso()
  })
}

export function createBatchTasks(options = {}) {
  const batchId = options.batchId || createBatchId()
  const batchConfig = normalizeBatchConfig(options.batchConfig || {})
  const children = Array.isArray(options.children) && options.children.length
    ? options.children
    : [options.taskOptions || {}]
  const createdAt = nowIso()
  const taskIds = []

  const batch = upsertBatch({
    batchId,
    ...((options.metadata && typeof options.metadata === 'object') ? options.metadata : {}),
    batchConfig,
    totalCount: children.length || batchConfig.totalCount,
    completedCount: 0,
    failedCount: 0,
    taskIds,
    status: BATCH_STATUS.PENDING,
    statusText: '等待生成',
    createdAt,
    updatedAt: createdAt
  })

  console.log('[batch:create]', {
    batchId,
    totalCount: batch.totalCount,
    config: batchConfig
  })

  children.forEach((childOptions) => {
    const childParams = (childOptions && childOptions.input && childOptions.input.params) || (childOptions && childOptions.params) || {}
    const idempotencyKey = String((childOptions && childOptions.clientTaskId) || childParams.idempotencyKey || '')
    const state = getMainChainState()
    const existingTask = idempotencyKey
      ? Object.values(((state.tasks || {}).byId) || {}).find((candidate) => {
          const candidateParams = ((candidate.input || {}).params) || candidate.params || {}
          return candidate.clientTaskId === idempotencyKey || candidateParams.idempotencyKey === idempotencyKey
        })
      : null
    const task = existingTask || createTaskAndRun({
      ...(childOptions || {}),
      batchId,
      params: {
        ...((childOptions && childOptions.params) || {}),
        batchId
      },
      input: {
        ...((childOptions && childOptions.input) || {}),
        params: {
          ...(((childOptions && childOptions.input && childOptions.input.params) || {})),
          batchId
        }
      }
    })
    taskIds.push(task.taskId)
    console.log('[batch:task]', {
      batchId,
      taskId: task.taskId,
      reused: Boolean(existingTask)
    })
  })

  return upsertBatch({
    ...batch,
    taskIds,
    totalCount: taskIds.length,
    status: BATCH_STATUS.PROCESSING,
    statusText: '生成中',
    updatedAt: nowIso()
  })
}
