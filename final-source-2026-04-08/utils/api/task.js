import { API_CONFIG, VALID_TASK_STATUS } from './config'
import { request } from './request'

function getPayload(rawData) {
  let parsed = rawData

  if (typeof rawData === 'string') {
    parsed = JSON.parse(rawData)
  }

  return {
    parsed,
    payload: parsed && parsed.data ? parsed.data : parsed
  }
}

function normalizeTaskResponse(rawData) {
  const { parsed, payload } = getPayload(rawData)
  const success = typeof payload.success === 'boolean' ? payload.success : true
  const code = payload.code
  const message = (payload && (payload.message || payload.error_message || payload.errorMessage || '')) || ''

  if (!success || (typeof code === 'number' && code !== 0)) {
    throw new Error(message || '任务查询接口业务失败')
  }

  const taskStatus = (payload && (payload.status || payload.task_status || payload.taskStatus || '')) || ''

  if (taskStatus && !VALID_TASK_STATUS.includes(taskStatus)) {
    throw new Error(`任务状态异常: ${taskStatus}`)
  }

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

export async function queryTaskResult(taskId) {
  const response = await request({
    url: `${API_CONFIG.taskQuery.url}/${encodeURIComponent(taskId)}`,
    method: 'GET'
  })

  return normalizeTaskResponse(response.data)
}

export { normalizeTaskResponse }
