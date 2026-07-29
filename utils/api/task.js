import { API_CONFIG, VALID_TASK_STATUS } from './config'
import { request } from './request'

function parseMaybeJson(rawData) {
  if (typeof rawData !== 'string') {
    return rawData
  }

  return JSON.parse(rawData)
}

function getPayload(rawData) {
  const parsed = parseMaybeJson(rawData)
  return {
    parsed,
    payload: parsed && parsed.data ? parsed.data : parsed
  }
}

function ensureSuccess(payload, fallbackMessage) {
  const success = typeof payload.success === 'boolean' ? payload.success : true
  const code = payload.code
  const message = (payload && (payload.message || payload.error_message || payload.errorMessage || '')) || ''

  if (!success || (typeof code === 'number' && code !== 0)) {
    throw new Error(message || fallbackMessage)
  }
}

function normalizeTaskStatus(taskStatus) {
  if (!taskStatus) {
    return ''
  }

  if (!VALID_TASK_STATUS.includes(taskStatus)) {
    throw new Error(`任务状态异常: ${taskStatus}`)
  }

  return taskStatus
}

function getTaskList(rawListPayload) {
  if (Array.isArray(rawListPayload)) {
    return rawListPayload
  }

  if (!rawListPayload || typeof rawListPayload !== 'object') {
    return []
  }

  return rawListPayload.list || rawListPayload.items || rawListPayload.tasks || rawListPayload.records || []
}

function getTaskDetailPayload(payload) {
  if (!payload || typeof payload !== 'object') {
    return {}
  }

  return payload.task || payload.item || payload.detail || payload.record || payload
}

export function normalizeTaskResponse(rawData) {
  const { parsed, payload } = getPayload(rawData)
  ensureSuccess(payload, '任务查询接口业务失败')

  const taskStatus = normalizeTaskStatus(
    (payload && (payload.status || payload.task_status || payload.taskStatus || '')) || ''
  )

  return {
    taskId: payload && (payload.task_id || payload.taskId || ''),
    taskStatus,
    progress: payload && typeof payload.progress === 'number' ? payload.progress : 0,
    resultImageUrl:
      (payload && (payload.result_image_url || payload.resultImageUrl || payload.image_url || payload.imageUrl)) || '',
    errorMessage: (payload && (payload.error_message || payload.errorMessage || '')) || '',
    raw: parsed
  }
}

export function normalizeTaskListResponse(rawData) {
  const { parsed, payload } = getPayload(rawData)
  ensureSuccess(payload, '历史任务列表接口业务失败')

  const taskList = getTaskList(payload)

  return {
    tasks: Array.isArray(taskList) ? taskList : [],
    nextCursor:
      (payload &&
        (payload.next_cursor || payload.nextCursor || payload.cursor || '')) ||
      '',
    hasMore:
      payload && typeof payload.has_more === 'boolean'
        ? payload.has_more
        : payload && typeof payload.hasMore === 'boolean'
          ? payload.hasMore
          : false,
    raw: parsed
  }
}

export function normalizeTaskDetailResponse(rawData) {
  const { parsed, payload } = getPayload(rawData)
  ensureSuccess(payload, '任务详情接口业务失败')

  const detailPayload = getTaskDetailPayload(payload)
  const taskStatus = (detailPayload && (detailPayload.status || detailPayload.task_status || detailPayload.taskStatus || '')) || ''

  if (taskStatus) {
    normalizeTaskStatus(taskStatus)
  }

  return {
    task: detailPayload || {},
    raw: parsed
  }
}

export async function queryTaskResult(taskId) {
  const response = await request({
    url: `${API_CONFIG.taskQuery.url}/${encodeURIComponent(taskId)}`,
    method: 'GET'
  })

  return normalizeTaskResponse(response.data)
}

export async function fetchTaskHistory(params = {}) {
  const requestParams = {}

  if (params.cursor) {
    requestParams.cursor = params.cursor
  }

  if (typeof params.pageSize === 'number') {
    requestParams.page_size = params.pageSize
  }

  if (params.status && params.status !== 'all') {
    requestParams.status = params.status
  }

  const response = await request({
    url: API_CONFIG.taskList.url,
    method: 'GET',
    data: requestParams
  })

  return normalizeTaskListResponse(response.data)
}

export async function fetchTaskDetail(taskId) {
  const response = await request({
    url: `${API_CONFIG.taskQuery.url}/${encodeURIComponent(taskId)}`,
    method: 'GET'
  })

  return normalizeTaskDetailResponse(response.data)
}

export async function syncTaskDeliveryStatus(payload = {}) {
  const taskId = payload.taskId || ''
  const deliveryStatus = payload.deliveryStatus || ''
  if (!taskId) {
    throw new Error('taskId is required for delivery sync')
  }
  if (!deliveryStatus) {
    throw new Error('deliveryStatus is required for delivery sync')
  }

  const response = await request({
    url: API_CONFIG.taskDeliverySync && API_CONFIG.taskDeliverySync.url
      ? API_CONFIG.taskDeliverySync.url
      : `${API_CONFIG.taskQuery.url}/delivery`,
    method: 'POST',
    data: {
      task_id: taskId,
      delivery_status: deliveryStatus,
      delivery_confirmed_at: payload.deliveryConfirmedAt || '',
      delivery_note: payload.deliveryNote || ''
    }
  })

  const { parsed, payload: responsePayload } = getPayload(response.data)
  ensureSuccess(responsePayload || {}, 'delivery sync failed')

  return {
    ok: true,
    taskId,
    deliveryStatus,
    raw: parsed
  }
}

export async function fetchTaskDeliveryStatus(taskId) {
  if (!taskId) {
    throw new Error('taskId is required for delivery query')
  }

  const response = await request({
    url: API_CONFIG.taskDeliverySync && API_CONFIG.taskDeliverySync.url
      ? `${API_CONFIG.taskDeliverySync.url}/${encodeURIComponent(taskId)}`
      : `${API_CONFIG.taskQuery.url}/${encodeURIComponent(taskId)}`,
    method: 'GET'
  })

  const { parsed, payload } = getPayload(response.data)
  ensureSuccess(payload || {}, 'delivery query failed')
  const detailPayload = getTaskDetailPayload(payload)
  const source = detailPayload || {}

  return {
    taskId: source.task_id || source.taskId || taskId,
    deliveryStatus: source.delivery_status || source.deliveryStatus || '',
    deliveryConfirmedAt: source.delivery_confirmed_at || source.deliveryConfirmedAt || '',
    deliveryNote: source.delivery_note || source.deliveryNote || '',
    raw: parsed
  }
}

export async function fetchTaskDeliveryStatusBatch(taskIds = [], options = {}) {
  const list = Array.isArray(taskIds) ? taskIds.filter(Boolean) : []
  if (!list.length) {
    return {
      items: [],
      failed: []
    }
  }

  const concurrency = Math.max(1, Number(options.concurrency) || 3)
  const results = []
  const failed = []
  let cursor = 0

  async function worker() {
    while (cursor < list.length) {
      const currentIndex = cursor
      cursor += 1
      const taskId = list[currentIndex]

      try {
        const item = await fetchTaskDeliveryStatus(taskId)
        results.push(item)
      } catch (error) {
        failed.push({
          taskId,
          message: (error && error.message) || 'delivery query failed'
        })
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, list.length) }, () => worker()))

  return {
    items: results,
    failed
  }
}
