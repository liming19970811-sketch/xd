import { initCloudBase, isCloudBaseReady } from './init'
import { isCloudBaseEnabled } from './config'

const BATCHES_COLLECTION_NAME = 'batches'

function hasCloudDatabase() {
  return (
    typeof wx !== 'undefined' &&
    wx &&
    wx.cloud &&
    typeof wx.cloud.database === 'function'
  )
}

function ensureCloudReady() {
  if (!isCloudBaseReady()) {
    initCloudBase()
  }
  return isCloudBaseReady()
}

function getTaskSnapshotField(task, field, fallback = '') {
  if (task && Object.prototype.hasOwnProperty.call(task, field) && task[field] !== undefined) {
    return task[field]
  }
  return fallback
}

function stripPreviousResultFromTaskSnapshot(task = {}) {
  if (!task || typeof task !== 'object') {
    return task
  }
  const nextTask = { ...task }
  delete nextTask.previousResult
  return nextTask
}

export function canUseCloudReadBatches() {
  const enabled = isCloudBaseEnabled()
  const ready = ensureCloudReady()
  const databaseAvailable = hasCloudDatabase()
  const available = enabled && ready && databaseAvailable
  console.log(`[cloudbase:batches] read available=${available} enabled=${enabled} ready=${ready} database=${databaseAvailable}`)
  return available
}

export function canUseCloudWriteBatches() {
  const available = canUseCloudReadBatches()
  console.log(`[cloudbase:batches] write available=${available}`)
  return available
}

function normalizeBatchForCloud(batch = {}) {
  const now = new Date().toISOString()
  const batchId = String(batch.batchId || '').trim()
  const tasks = Array.isArray(batch.tasks)
    ? batch.tasks.map((task) => stripPreviousResultFromTaskSnapshot(normalizeTaskSnapshotForCloud(task))).filter(Boolean)
    : []
  return {
    batchId,
    batchName: String(batch.batchName || ''),
    projectId: String(batch.projectId || ''),
    status: String(batch.status || 'draft'),
    taskIds: Array.isArray(batch.taskIds) ? [...batch.taskIds] : [],
    tasks,
    createdAt: batch.createdAt || now,
    updatedAt: batch.updatedAt || now
  }
}

function normalizeTaskSnapshotForCloud(task = {}) {
  const taskId = String((task && (task.taskId || task.id || task.clientTaskId)) || '').trim()
  if (!taskId) {
    return null
  }
  const snapshot = {
    taskId,
    clientTaskId: task.clientTaskId || taskId,
    batchId: task.batchId || '',
    status: task.status || 'pending',
    stage: task.stage || '',
    progress: typeof task.progress === 'number' ? task.progress : 0,
    statusText: task.statusText || '',
    deliveryStatus: task.deliveryStatus || '',
    reviewStatus: task.reviewStatus || '',
    reviewedAt: getTaskSnapshotField(task, 'reviewedAt', ''),
    deliveryConfirmedAt: getTaskSnapshotField(task, 'deliveryConfirmedAt', ''),
    deliveryNote: getTaskSnapshotField(task, 'deliveryNote', ''),
    input: task.input || {},
    result: task.result || {},
    resultImageUrl: task.resultImageUrl || (task.result && task.result.coverUrl) || '',
    previousResultImageUrl: task.previousResultImageUrl || '',
    error: task.error || null,
    createdAt: task.createdAt || '',
    updatedAt: task.updatedAt || '',
    completedAt: task.completedAt || ''
  }
  return stripPreviousResultFromTaskSnapshot(snapshot)
}

export async function getBatchListByCloud(query = {}) {
  if (!canUseCloudReadBatches()) {
    console.log('[cloudbase:batches] list skipped: cloud unavailable')
    throw new Error('Cloud read batch list is unavailable')
  }

  const page = Math.max(Number(query.page || 1), 1)
  const pageSize = Math.max(Number(query.pageSize || 50), 1)
  const skip = (page - 1) * pageSize
  const projectId = String(query.projectId || '').trim()
  const db = wx.cloud.database()
  console.log(`[cloudbase:batches] list start page=${page} pageSize=${pageSize} projectId=${projectId || 'all'}`)

  let collection = db.collection(BATCHES_COLLECTION_NAME)
  if (projectId) {
    collection = collection.where({ projectId })
  }

  const response = await collection
    .orderBy('updatedAt', 'desc')
    .skip(skip)
    .limit(pageSize)
    .get()

  const list = response && Array.isArray(response.data) ? response.data : []
  console.log(`[cloudbase:batches] list success count=${list.length}`)
  return {
    code: 0,
    message: 'ok',
    data: {
      list,
      total: list.length,
      page,
      pageSize
    }
  }
}

export async function upsertBatchByCloud(batch = {}) {
  const payload = normalizeBatchForCloud(batch)
  if (!payload.batchId) {
    return {
      code: 400,
      message: 'batchId is required',
      data: null
    }
  }

  if (!canUseCloudWriteBatches()) {
    console.log('[cloudbase:batches] upsert skipped: cloud unavailable')
    throw new Error('Cloud write batch is unavailable')
  }

  const db = wx.cloud.database()
  console.log(`[cloudbase:batches] upsert start batchId=${payload.batchId} taskIds=${payload.taskIds.length}`)
  console.log('[cloudbase:batches] save payload summary', {
    batchId: payload.batchId,
    taskIdsCount: payload.taskIds.length,
    tasksCount: payload.tasks.length,
    hasTasks: payload.tasks.length > 0,
    hasPreviousResult: payload.tasks.some((task) => !!(task && task.previousResult))
  })

  try {
    const existingResponse = await db
      .collection(BATCHES_COLLECTION_NAME)
      .where({
        batchId: payload.batchId
      })
      .limit(1)
      .get()
    const existingBatch = existingResponse && Array.isArray(existingResponse.data)
      ? existingResponse.data[0]
      : null

    if (existingBatch && existingBatch._id) {
      await db
        .collection(BATCHES_COLLECTION_NAME)
        .doc(existingBatch._id)
        .set({
          data: payload
        })
      console.log('[cloudbase:batches] upsert persisted', {
        operation: 'set',
        success: true
      })
      console.log(`[cloudbase:batches] upsert success source=set batchId=${payload.batchId}`)
      return {
        code: 0,
        message: 'set',
        data: payload
      }
    }
  } catch (error) {
    console.error('[cloudbase:batches] upsert set failed', {
      errCode: error && error.errCode,
      errMsg: error && error.errMsg,
      message: error && error.message
    })
  }

  try {
    await db.collection(BATCHES_COLLECTION_NAME).add({
      data: payload
    })
    console.log('[cloudbase:batches] upsert persisted', {
      operation: 'add',
      success: true
    })
    console.log(`[cloudbase:batches] upsert success source=add batchId=${payload.batchId}`)
    return {
      code: 0,
      message: 'created',
      data: payload
    }
  } catch (error) {
    console.error('[cloudbase:batches] upsert add failed', {
      errCode: error && error.errCode,
      errMsg: error && error.errMsg,
      message: error && error.message
    })
    throw error
  }
}

export async function getBatchByIdByCloud(batchId) {
  const normalizedBatchId = String(batchId || '').trim()
  if (!normalizedBatchId) {
    return {
      code: 0,
      message: 'batch not found',
      data: null
    }
  }

  if (!canUseCloudReadBatches()) {
    console.log('[cloudbase:batches] detail skipped: cloud unavailable')
    throw new Error('Cloud read batch detail is unavailable')
  }

  const db = wx.cloud.database()
  console.log(`[cloudbase:batches] detail start batchId=${normalizedBatchId}`)

  try {
    const queryResponse = await db
      .collection(BATCHES_COLLECTION_NAME)
      .where({
        batchId: normalizedBatchId
      })
      .limit(1)
      .get()
    const list = queryResponse && Array.isArray(queryResponse.data) ? queryResponse.data : []
    const batch = list[0] || null
    if (batch) {
      console.log(`[cloudbase:batches] detail success source=query batchId=${normalizedBatchId}`)
      return {
        code: 0,
        message: 'ok',
        data: batch
      }
    }
  } catch (error) {
    console.log(`[cloudbase:batches] detail query fallback message=${(error && error.message) || 'unknown'}`)
  }

  try {
    const docResponse = await db.collection(BATCHES_COLLECTION_NAME).doc(normalizedBatchId).get()
    const batch = docResponse && docResponse.data ? docResponse.data : null
    console.log(`[cloudbase:batches] detail success source=doc found=${!!batch}`)
    return {
      code: 0,
      message: batch ? 'ok' : 'batch not found',
      data: batch
    }
  } catch (error) {
    console.log(`[cloudbase:batches] detail doc failed message=${(error && error.message) || 'unknown'}`)
    return {
      code: 0,
      message: 'batch not found',
      data: null
    }
  }
}
