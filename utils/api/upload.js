import { uploadFile } from './request'
import { uploadUnifiedFile } from '../upload/unifiedUploadService.js'

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

  const fileId = payload && (payload.file_id || payload.fileId || payload.fileID || payload.id || '')
  const fileUrl = payload && (
    payload.file_url ||
    payload.fileUrl ||
    payload.url ||
    payload.downloadUrl ||
    payload.download_url ||
    payload.tempFileURL ||
    payload.tempFileUrl ||
    ''
  )

  if (!fileId && !fileUrl) {
    throw new Error('上传接口返回缺少 file_id 或 file_url')
  }

  return {
    fileId,
    file_id: fileId,
    fileUrl,
    file_url: fileUrl,
    imageUrl: fileUrl,
    image_url: fileUrl,
    url: fileUrl,
    raw: parsed
  }
}

async function uploadImageByUnifiedService(payload = {}) {
  const result = await uploadUnifiedFile({
    filePath: payload.filePath,
    path: payload.filePath,
    name: payload.fileName || ''
  }, {
    assetType: payload.assetType || 'garment_image',
    projectId: payload.projectId || '',
    targetType: payload.targetType || 'task',
    targetId: payload.targetId || payload.taskId || '',
    relation: payload.relation || 'input',
    source: payload.scene || 'main_chain'
  })
  if (!result.success) {
    throw new Error(result.message || result.errorCode || '统一上传失败')
  }
  return {
    success: true,
    fileId: result.fileId,
    file_id: result.fileId,
    fileUrl: result.tempUrl || '',
    file_url: result.tempUrl || '',
    imageUrl: result.tempUrl || '',
    image_url: result.tempUrl || '',
    url: result.tempUrl || '',
    localPath: payload.filePath || '',
    assetRecord: result.file,
    duplicate: Boolean(result.duplicate),
    source: 'unified_cloud_upload'
  }
}

async function uploadImageByHttp(payload = {}) {
  const response = await uploadFile({
    url: payload.url,
    filePath: payload.filePath,
    name: payload.name || 'file',
    formData: payload.formData || {}
  })

  return {
    ...normalizeUploadResponse(response.data),
    localPath: payload.filePath || '',
    source: 'https_upload_api'
  }
}

export async function uploadImage(payload = {}) {
  try {
    return await uploadImageByUnifiedService(payload)
  } catch (error) {
    if (payload.allowHttpFallback && payload.url) {
      return uploadImageByHttp(payload)
    }
    throw error
  }
}

export { normalizeUploadResponse }
