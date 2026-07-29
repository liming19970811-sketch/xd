import { getMainChainState, patchMainChainState } from '../mainChainState'
import { fetchTaskDetail, fetchTaskHistory } from '../api/task'
import { createTaskEntity } from './taskFactory'
import { mapServerTaskToTaskEntity } from './taskMapper'
import { upsertWorkRecordFromTask } from '../work/workRecordRepository'

export function getTaskSortTime(task = {}) {
  return task.completedAt || task.updatedAt || task.submittedAt || task.createdAt || ''
}

const REVIEW_FIELDS = [
  'deliveryStatus',
  'reviewStatus',
  'reviewedAt',
  'deliveryConfirmedAt',
  'deliveryNote',
  'statusText',
  'updatedAt'
]

const RESULT_FIELDS = [
  'resultImageUrl',
  'result_image_url',
  'imageUrl',
  'image_url',
  'result'
]

function hasOwn(object = {}, field) {
  return Object.prototype.hasOwnProperty.call(object, field)
}

function getTaskUpdatedAtValue(task = {}) {
  const value =
    task.updatedAt ||
    task.reviewedAt ||
    task.deliveryConfirmedAt ||
    task.completedAt ||
    task.createdAt
  const time = value ? new Date(value).getTime() : 0
  return Number.isFinite(time) ? time : 0
}

function getTaskResultImageUrl(task = {}) {
  const result = task.result || {}
  const items = Array.isArray(result.items) ? result.items : []
  const firstItem = items[0] || {}
  return (
    task.resultImageUrl ||
    task.result_image_url ||
    task.imageUrl ||
    task.image_url ||
    result.coverUrl ||
    result.imageUrl ||
    result.image_url ||
    result.fileUrl ||
    result.file_url ||
    firstItem.imageUrl ||
    firstItem.image_url ||
    firstItem.fileUrl ||
    firstItem.file_url ||
    firstItem.url ||
    ''
  )
}

function getTaskResultItems(task = {}) {
  const result = task.result || {}
  if (Array.isArray(result)) return result
  if (Array.isArray(result.items)) return result.items
  if (result.items && typeof result.items === 'object') return [result.items]
  return getTaskResultImageUrl(task) ? [{ imageUrl: getTaskResultImageUrl(task) }] : []
}

function getUsableResultCount(task = {}) {
  return getTaskResultItems(task).filter((item) => {
    if (typeof item === 'string') return Boolean(item.trim())
    return Boolean(item && (item.imageUrl || item.image_url || item.fileUrl || item.file_url || item.videoUrl || item.video_url || item.url))
  }).length
}

function isTerminalTask(task = {}) {
  return ['success', 'completed', 'done', 'result_ready', 'failed', 'error', 'timeout', 'partial_failed', 'partial_success', 'cancelled', 'canceled']
    .includes(String(task.status || task.stage || '').toLowerCase())
}

function isTaskPendingRegeneration(task = {}) {
  const status = String(task.status || '').toLowerCase()
  const stage = String(task.stage || '').toLowerCase()
  const deliveryStatus = String(task.deliveryStatus || '').toLowerCase()
  const reviewStatus = String(task.reviewStatus || '').toLowerCase()

  return (
    status === 'pending' ||
    status === 'draft' ||
    stage === 'editing' ||
    deliveryStatus === 'pending_review' ||
    reviewStatus === 'pending_review'
  )
}

function applyFieldsByFreshness(baseTask = {}, localTask = {}, serverTask = {}, fields = [], serverIsNewer) {
  const nextTask = {
    ...baseTask
  }
  fields.forEach((field) => {
    const preferredTask = serverIsNewer ? serverTask : localTask
    const fallbackTask = serverIsNewer ? localTask : serverTask
    if (hasOwn(preferredTask, field) && preferredTask[field] !== undefined) {
      nextTask[field] = preferredTask[field]
      return
    }
    if (hasOwn(fallbackTask, field) && fallbackTask[field] !== undefined) {
      nextTask[field] = fallbackTask[field]
    }
  })
  return nextTask
}

function shouldUseServerResult(localTask = {}, serverTask = {}) {
  const localUpdatedAt = getTaskUpdatedAtValue(localTask)
  const serverUpdatedAt = getTaskUpdatedAtValue(serverTask)
  const serverIsNewer = serverUpdatedAt > localUpdatedAt

  const localResultCount = getUsableResultCount(localTask)
  const serverResultCount = getUsableResultCount(serverTask)

  // Provider callbacks do not always advance updatedAt. A larger remote result
  // set or a terminal remote task is still authoritative for result progress.
  if (!serverIsNewer && serverResultCount <= localResultCount && !(isTerminalTask(serverTask) && serverResultCount > 0 && localResultCount === 0)) {
    return false
  }

  if (
    isTaskPendingRegeneration(localTask) &&
    !getTaskResultImageUrl(localTask) &&
    getTaskResultImageUrl(serverTask)
  ) {
    return false
  }

  return serverResultCount > 0 || !!getTaskResultImageUrl(serverTask)
}

function mergeResultItems(localTask = {}, serverTask = {}) {
  const localItems = getTaskResultItems(localTask)
  const serverItems = getTaskResultItems(serverTask)
  const merged = []
  const keys = new Set()
  ;[...serverItems, ...localItems].forEach((item, index) => {
    const value = item && typeof item === 'object' ? item : { url: item }
    const key = String(
      value.assetId || value.fileId || value.resultId || value.taskId ||
      value.imageUrl || value.image_url || value.fileUrl || value.file_url || value.url ||
      `${value.itemType || 'result'}_${index}`
    )
    if (keys.has(key)) return
    keys.add(key)
    merged.push(value)
  })
  return merged
}

function mergeResultByFreshness(localTask = {}, serverTask = {}) {
  const items = mergeResultItems(localTask, serverTask)
  if (!shouldUseServerResult(localTask, serverTask)) {
    return {
      ...((serverTask.result) || {}),
      ...((localTask.result) || {}),
      ...(items.length ? { items } : {})
    }
  }

  return {
    ...((localTask.result) || {}),
    ...((serverTask.result) || {}),
    ...(items.length ? { items } : {})
  }
}

function mergeTaskEntityWithServer(localTask = {}, serverTask = {}) {
  const localUpdatedAt = getTaskUpdatedAtValue(localTask)
  const serverUpdatedAt = getTaskUpdatedAtValue(serverTask)
  const serverIsNewer = serverUpdatedAt > localUpdatedAt
  const useServerResult = shouldUseServerResult(localTask, serverTask)
  const baseTask = {
    ...localTask,
    ...serverTask,
    input: {
      ...(localTask.input || {}),
      ...(serverTask.input || {}),
      assets: {
        ...(((localTask.input || {}).assets) || {}),
        ...(((serverTask.input || {}).assets) || {})
      },
      params: {
        ...(((localTask.input || {}).params) || {}),
        ...(((serverTask.input || {}).params) || {})
      },
      options: {
        ...(((localTask.input || {}).options) || {}),
        ...(((serverTask.input || {}).options) || {})
      }
    },
    result: mergeResultByFreshness(localTask, serverTask),
    error: {
      ...((localTask.error) || {}),
      ...((serverTask.error) || {})
    },
    control: {
      ...((localTask.control) || {}),
      ...((serverTask.control) || {})
    }
  }
  let mergedTask = applyFieldsByFreshness(baseTask, localTask, serverTask, REVIEW_FIELDS, serverIsNewer)
  mergedTask = applyFieldsByFreshness(mergedTask, localTask, serverTask, RESULT_FIELDS, useServerResult)

  if (serverTask.taskId) {
    console.log('[task-history] merge task detail', {
      taskId: serverTask.taskId,
      localUpdatedAt,
      serverUpdatedAt,
      useServerReviewFields: serverIsNewer,
      useServerResult,
      reason: serverIsNewer ? 'server_newer' : 'local_newer_or_equal'
    })
  }

  return createTaskEntity(mergedTask)
}

export function mergeServerTasksIntoState(serverTasks = []) {
  const state = getMainChainState()
  const currentTasks = (state.tasks && state.tasks.byId) || {}
  const mergedById = {
    ...currentTasks
  }

  serverTasks.forEach((serverTask) => {
    const taskEntity = mapServerTaskToTaskEntity(serverTask)
    if (!taskEntity.taskId) {
      return
    }

    const localTask = currentTasks[taskEntity.taskId] || {}
    mergedById[taskEntity.taskId] = mergeTaskEntityWithServer(localTask, taskEntity)
  })

  const mergedAllIds = Object.keys(mergedById).sort((leftId, rightId) => {
    const rightTime = getTaskSortTime(mergedById[rightId])
    const leftTime = getTaskSortTime(mergedById[leftId])
    return String(rightTime).localeCompare(String(leftTime))
  })

  patchMainChainState({
    tasks: {
      byId: mergedById,
      allIds: mergedAllIds
    }
  })

  serverTasks.forEach((serverTask) => {
    const taskId = serverTask && (serverTask.taskId || serverTask.task_id || serverTask.id)
    if (taskId && mergedById[taskId]) upsertWorkRecordFromTask(mergedById[taskId])
  })

  return getMainChainState().tasks
}

export async function loadHistoryTasksIntoState(params = {}) {
  const response = await fetchTaskHistory(params)
  mergeServerTasksIntoState(response.tasks || [])
  return {
    ...response,
    tasks: getMainChainState().tasks
  }
}

export function hasIncompleteTaskDetail(task = {}) {
  if (!task || !task.taskId) {
    return true
  }

  const input = task.input || {}
  const assets = input.assets || {}
  const params = input.params || {}
  const options = input.options || {}
  const result = task.result || {}
  const items = Array.isArray(result.items) ? result.items : []
  const control = task.control || {}
  const hasAssets = !!(assets.clothImage || assets.styleImage)
  const hasResult = !!(result.coverUrl || (items[0] && items[0].fileUrl))
  const hasTimeInfo = !!(task.createdAt || task.submittedAt || task.completedAt || task.updatedAt)
  const hasParamInfo = Object.keys(params).length > 0 && Object.keys(options).length > 0
  const hasDetailShell = Object.keys(control).length > 0 || !!(task.status || task.stage)

  return !(hasAssets && hasParamInfo && hasDetailShell && (hasResult || hasTimeInfo))
}

export async function loadTaskDetailIntoState(taskId) {
  const response = await fetchTaskDetail(taskId)
  mergeServerTasksIntoState([response.task || {}])
  patchMainChainState({
    currentTaskId: taskId
  })
  return {
    ...response,
    task: (getMainChainState().tasks.byId || {})[taskId] || null
  }
}
