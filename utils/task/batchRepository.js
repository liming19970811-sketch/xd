import { getMainChainState, patchMainChainState } from '../mainChainState'
import { TASK_STATUS } from '../constants'
import { createGenerationTaskAndRun } from './generationExecution'
import { GENERATION_STATUSES, normalizeGenerationStatus } from './generationContract'

function nowIso() {
  return new Date().toISOString()
}

function uniq(list = []) {
  const seen = {}
  return list.filter((item) => {
    if (!item || seen[item]) {
      return false
    }
    seen[item] = true
    return true
  })
}

export function getTaskResultImageUrl(task = {}) {
  const result = task.result || {}
  const items = Array.isArray(result.items) ? result.items : []
  const firstItem = items[0] || {}
  return task.resultImageUrl ||
    task.result_image_url ||
    result.image ||
    result.imageUrl ||
    result.image_url ||
    result.coverUrl ||
    firstItem.imageUrl ||
    firstItem.fileUrl ||
    firstItem.url ||
    ''
}

export function getBatchStatusText(status = '') {
  const map = {
    pending: '等待生成',
    processing: '生成中',
    success: '部分完成',
    completed: '全部完成',
    failed: '失败'
  }
  return map[status] || map.pending
}

export function getTaskStatusText(status = '') {
  const map = {
    draft: '等待',
    pending: '等待',
    submitted: '等待',
    queued: '等待',
    processing: '生成中',
    success: '成功',
    failed: '失败',
    timeout: '失败'
  }
  return map[status] || '等待'
}

export function formatBatchTime(value = '') {
  if (!value) {
    return '暂无时间'
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }
  const pad = (num) => String(num).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function calculateStatus(tasks = []) {
  const completedCount = tasks.filter((task) => normalizeGenerationStatus(task.status) === GENERATION_STATUSES.COMPLETED).length
  const failedCount = tasks.filter((task) => {
    const status = normalizeGenerationStatus(task.status)
    return status === GENERATION_STATUSES.FAILED || status === GENERATION_STATUSES.RESULT_MISSING
  }).length
  const finishedCount = completedCount + failedCount
  let status = 'generating'
  if (!tasks.length) {
    status = 'pending'
  } else if (finishedCount >= tasks.length && completedCount === tasks.length) {
    status = 'completed'
  } else if (finishedCount >= tasks.length && completedCount === 0) {
    status = 'failed'
  } else if (finishedCount > 0) {
    status = 'partial_success'
  }
  return {
    completedCount,
    failedCount,
    status
  }
}

export function getBatchDetail(batchId = '') {
  const state = getMainChainState()
  const batches = state.batches || {}
  const tasksState = state.tasks || {}
  const tasksById = tasksState.byId || {}
  const sourceBatch = (batches.byId && batches.byId[batchId]) || {
    batchId,
    batchConfig: {},
    taskIds: [],
    createdAt: '',
    status: 'pending'
  }
  const fallbackTaskIds = Object.keys(tasksById).filter((taskId) => tasksById[taskId] && tasksById[taskId].batchId === batchId)
  const taskIds = uniq([...(sourceBatch.taskIds || []), ...fallbackTaskIds])
  const tasks = taskIds.map((taskId) => tasksById[taskId]).filter(Boolean)
  const stats = calculateStatus(tasks)
  const totalCount = Number(sourceBatch.totalCount) || taskIds.length
  const batch = {
    ...sourceBatch,
    taskIds,
    totalCount,
    completedCount: stats.completedCount,
    failedCount: stats.failedCount,
    status: stats.status,
    statusText: getBatchStatusText(stats.status)
  }

  console.log('[batch:detail]', {
    batchId: batch.batchId || '',
    taskCount: tasks.length,
    successCount: stats.completedCount,
    failedCount: stats.failedCount
  })

  return {
    batch,
    tasks,
    stats: {
      taskCount: tasks.length,
      successCount: stats.completedCount,
      failedCount: stats.failedCount
    }
  }
}

export function retryFailedBatchTasks(batchId = '') {
  const detail = getBatchDetail(batchId)
  const failedTasks = detail.tasks.filter((task) => {
    const status = normalizeGenerationStatus(task.status)
    return status === GENERATION_STATUSES.FAILED || status === GENERATION_STATUSES.RESULT_MISSING
  })
  return retryBatchTaskList(batchId, failedTasks, detail)
}

export function retryBatchTask(batchId = '', taskId = '', options = {}) {
  const detail = getBatchDetail(batchId)
  const task = detail.tasks.find((item) => item.taskId === taskId)
  if (!task || ![GENERATION_STATUSES.FAILED, GENERATION_STATUSES.RESULT_MISSING].includes(normalizeGenerationStatus(task.status))) {
    return {
      batch: detail.batch,
      taskIds: []
    }
  }
  return retryBatchTaskList(batchId, [task], detail, options)
}

function retryBatchTaskList(batchId = '', failedTasks = [], detail = null, options = {}) {
  const batchDetail = detail || getBatchDetail(batchId)
  if (!failedTasks.length) {
    return {
      batch: batchDetail.batch,
      taskIds: []
    }
  }

  const retryTaskIds = failedTasks.map((task) => {
    const input = task.input || {}
    const clientRequestId = String(options.clientRequestId || `batch_retry_${batchId}_${task.taskId}_${Date.now()}`)
    const params = {
      ...((input && input.params) || {}),
      historyId: options.historyId || ((input && input.params && input.params.historyId) || ''),
      sourceHistoryId: options.historyId || ((input && input.params && input.params.sourceHistoryId) || ''),
      retryOfTaskId: task.taskId,
      clientRequestId,
      idempotencyKey: clientRequestId,
      quotaRecordId: '',
      quota_record_id: '',
      batchId
    }
    const retryTask = createGenerationTaskAndRun({
      type: task.type || task.taskType || '',
      channel: task.channel || 'batch-detail',
      clientTaskId: clientRequestId,
      batchId,
      input: {
        ...input,
        params
      },
      params
    })
    return retryTask.taskId
  })

  const state = getMainChainState()
  const batches = state.batches || {}
  const currentBatch = (batches.byId && batches.byId[batchId]) || batchDetail.batch
  const nextTaskIds = uniq([...(currentBatch.taskIds || []), ...retryTaskIds])
  const nextBatch = {
    ...currentBatch,
    taskIds: nextTaskIds,
    totalCount: nextTaskIds.length,
    status: 'processing',
    statusText: getBatchStatusText('processing'),
    updatedAt: nowIso()
  }

  const patchedState = patchMainChainState({
    currentBatchId: batchId,
    batches: {
      ...batches,
      byId: {
        ...(batches.byId || {}),
        [batchId]: nextBatch
      },
      allIds: uniq([batchId, ...((batches && batches.allIds) || [])])
    }
  })

  return {
    batch: patchedState.batches.byId[batchId],
    taskIds: retryTaskIds
  }
}
