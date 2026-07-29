import { getMainChainState, patchMainChainState } from '../mainChainState'

const MAX_QUEUE_SIZE = 1200

function buildQueueId(type, taskId) {
  const randomPart = Math.random().toString(36).slice(2, 8)
  return `${type || 'queue'}_${taskId || 'na'}_${Date.now()}_${randomPart}`
}

function normalizeQueueItem(item = {}) {
  const now = new Date().toISOString()
  return {
    queueId: item.queueId || buildQueueId(item.type, item.taskId),
    taskId: item.taskId || '',
    type: item.type || 'sync',
    payload: item.payload && typeof item.payload === 'object' ? item.payload : {},
    status: item.status || 'pending',
    createdAt: item.createdAt || now,
    updatedAt: item.updatedAt || now
  }
}

function getQueueFromState(state) {
  return Array.isArray(state && state.deliveryCompensationQueue) ? state.deliveryCompensationQueue : []
}

export function appendDeliveryQueueItem(item = {}) {
  const state = getMainChainState()
  const queue = getQueueFromState(state)
  const nextItem = normalizeQueueItem(item)
  const nextQueue = [nextItem, ...queue].slice(0, MAX_QUEUE_SIZE)
  patchMainChainState({
    deliveryCompensationQueue: nextQueue
  })
  return nextItem
}

export function appendDeliveryQueueItems(items = []) {
  const normalized = Array.isArray(items) ? items.map((item) => normalizeQueueItem(item)) : []
  if (!normalized.length) {
    return []
  }

  const state = getMainChainState()
  const queue = getQueueFromState(state)
  const nextQueue = [...normalized, ...queue].slice(0, MAX_QUEUE_SIZE)
  patchMainChainState({
    deliveryCompensationQueue: nextQueue
  })
  return normalized
}

export function getTaskDeliveryQueue(taskId, statuses = ['pending', 'failed', 'retrying', 'resolved']) {
  if (!taskId) {
    return []
  }
  const statusSet = new Set(Array.isArray(statuses) ? statuses : [])
  const state = getMainChainState()
  return getQueueFromState(state).filter((item) => {
    if (!item || item.taskId !== taskId) {
      return false
    }
    if (!statusSet.size) {
      return true
    }
    return statusSet.has(item.status)
  })
}

export function getDeliveryQueueByTaskIds(taskIds = [], statuses = ['pending', 'failed', 'retrying']) {
  if (!Array.isArray(taskIds) || !taskIds.length) {
    return []
  }
  const taskIdSet = new Set(taskIds.filter(Boolean))
  const statusSet = new Set(Array.isArray(statuses) ? statuses : [])
  const state = getMainChainState()
  return getQueueFromState(state).filter((item) => {
    if (!item || !taskIdSet.has(item.taskId)) {
      return false
    }
    if (!statusSet.size) {
      return true
    }
    return statusSet.has(item.status)
  })
}

export function updateDeliveryQueueItem(queueId, patch = {}) {
  if (!queueId) {
    return null
  }

  const state = getMainChainState()
  const queue = getQueueFromState(state)
  let updated = null

  const nextQueue = queue.map((item) => {
    if (!item || item.queueId !== queueId) {
      return item
    }
    updated = {
      ...item,
      ...patch,
      updatedAt: new Date().toISOString()
    }
    return updated
  })

  if (!updated) {
    return null
  }

  patchMainChainState({
    deliveryCompensationQueue: nextQueue
  })
  return updated
}

