import { initCloudBase, isCloudBaseReady } from './init'
import { isCloudBaseEnabled } from './config'

const TASKS_COLLECTION_NAME = 'tasks'

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

export function canUseCloudReadTasks() {
  const enabled = isCloudBaseEnabled()
  const ready = ensureCloudReady()
  const databaseAvailable = hasCloudDatabase()
  const available = enabled && ready && databaseAvailable
  console.log(`[cloudbase:tasks] read available=${available} enabled=${enabled} ready=${ready} database=${databaseAvailable}`)
  return available
}

export async function getTaskListByCloud(query = {}) {
  if (!canUseCloudReadTasks()) {
    console.log('[cloudbase:tasks] list skipped: cloud unavailable')
    throw new Error('Cloud read task list is unavailable')
  }

  const page = Math.max(Number(query.page || 1), 1)
  const pageSize = Math.max(Number(query.pageSize || 50), 1)
  const skip = (page - 1) * pageSize
  const db = wx.cloud.database()
  console.log(`[cloudbase:tasks] list start page=${page} pageSize=${pageSize}`)

  const response = await db
    .collection(TASKS_COLLECTION_NAME)
    .orderBy('updatedAt', 'desc')
    .skip(skip)
    .limit(pageSize)
    .get()

  const list = response && Array.isArray(response.data) ? response.data : []
  console.log(`[cloudbase:tasks] list success count=${list.length}`)
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

export async function getTaskByIdByCloud(taskId) {
  const normalizedTaskId = String(taskId || '').trim()
  if (!normalizedTaskId) {
    return {
      code: 0,
      message: 'task not found',
      data: null
    }
  }

  if (!canUseCloudReadTasks()) {
    console.log('[cloudbase:tasks] detail skipped: cloud unavailable')
    throw new Error('Cloud read task detail is unavailable')
  }

  const db = wx.cloud.database()
  console.log(`[cloudbase:tasks] detail start taskId=${normalizedTaskId}`)

  try {
    const queryResponse = await db
      .collection(TASKS_COLLECTION_NAME)
      .where({
        taskId: normalizedTaskId
      })
      .limit(1)
      .get()
    const list = queryResponse && Array.isArray(queryResponse.data) ? queryResponse.data : []
    const task = list[0] || null
    if (task) {
      console.log(`[cloudbase:tasks] detail success source=query taskId=${normalizedTaskId}`)
      return {
        code: 0,
        message: 'ok',
        data: task
      }
    }
  } catch (error) {
    console.log(`[cloudbase:tasks] detail query fallback message=${(error && error.message) || 'unknown'}`)
  }

  try {
    const docResponse = await db.collection(TASKS_COLLECTION_NAME).doc(normalizedTaskId).get()
    const task = docResponse && docResponse.data ? docResponse.data : null
    console.log(`[cloudbase:tasks] detail success source=doc found=${!!task}`)
    return {
      code: 0,
      message: task ? 'ok' : 'task not found',
      data: task
    }
  } catch (error) {
    console.log(`[cloudbase:tasks] detail doc failed message=${(error && error.message) || 'unknown'}`)
    return {
      code: 0,
      message: 'task not found',
      data: null
    }
  }
}
