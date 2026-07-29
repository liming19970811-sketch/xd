import { API_CONFIG } from './config'
import { uploadFile } from './request'

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

function normalizeUploadResponse(rawData) {
  const { parsed, payload } = getPayload(rawData)
  const success = typeof payload.success === 'boolean' ? payload.success : true
  const code = payload.code
  const message = payload.message || payload.error_message || payload.errorMessage || ''

  if (!success || (typeof code === 'number' && code !== 0)) {
    throw new Error(message || '上传接口业务失败')
  }

  const fileId = payload && (payload.file_id || payload.fileId || payload.id || '')
  const fileUrl = payload && (payload.file_url || payload.fileUrl || payload.url || '')

  if (!fileId || !fileUrl) {
    throw new Error('上传接口返回缺少 file_id 或 file_url')
  }

  return {
    fileId,
    fileUrl,
    raw: parsed
  }
}

export async function uploadImage(payload) {
  const response = await uploadFile({
    url: API_CONFIG.upload.url,
    filePath: payload.filePath,
    name: API_CONFIG.upload.fileFieldName,
    formData: {
      [API_CONFIG.upload.sceneFieldName]: payload.scene || 'main_chain'
    }
  })

  return normalizeUploadResponse(response.data)
}

export { normalizeUploadResponse }
