import { API_CONFIG } from './config'
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

function normalizeGenerateResponse(rawData) {
  const { parsed, payload } = getPayload(rawData)
  const success = typeof payload.success === 'boolean' ? payload.success : true
  const code = payload.code
  const message = (payload && (payload.message || payload.error_message || payload.errorMessage || '')) || ''

  if (!success || (typeof code === 'number' && code !== 0)) {
    throw new Error(message || '生成接口业务失败')
  }

  return {
    taskId: payload && (payload.task_id || payload.taskId || ''),
    taskStatus: payload && (payload.status || payload.task_status || payload.taskStatus || ''),
    resultImageUrl:
      (payload && (payload.result_image_url || payload.resultImageUrl || payload.image_url || payload.imageUrl)) || '',
    progress: payload && typeof payload.progress === 'number' ? payload.progress : 0,
    errorMessage: (payload && (payload.error_message || payload.errorMessage || '')) || '',
    raw: parsed
  }
}

export async function generateResult(payload) {
  const response = await request({
    url: API_CONFIG.generate.url,
    method: 'POST',
    data: payload
  })

  return normalizeGenerateResponse(response.data)
}

export { normalizeGenerateResponse }
