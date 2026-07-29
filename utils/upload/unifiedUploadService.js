import { getCurrentMember, getCurrentUser } from '../auth/authRepository.js'
import { hasPermission } from '../auth/permissionService.js'
import { getCurrentEnterpriseId } from '../tenant/tenantContext.js'
import { getCloudWebApp, ensureCloudWebAuth } from '../cloud/cloudWebClient.js'
import {
  FILE_ASSET_TYPES,
  findDuplicateFile,
  linkFileReference,
  listFileRecords,
  normalizeFileRecord,
  recordFileDownloadAudit,
  sanitizeFileName,
  saveFileRecord
} from './fileRepository.js'

const IMAGE_EXTENSIONS = Object.freeze(['jpg', 'jpeg', 'png', 'webp'])
const DOCUMENT_EXTENSIONS = Object.freeze(['pdf', 'csv', 'xls', 'xlsx'])
const PATTERN_EXTENSIONS = Object.freeze(['dxf', 'plt', 'ai', 'pdf'])
const BLOCKED_EXTENSIONS = Object.freeze(['exe', 'bat', 'cmd', 'sh', 'js', 'msi', 'apk', 'zip', 'rar', '7z'])

const ASSET_TYPE_RULES = Object.freeze({
  garment_image: { extensions: IMAGE_EXTENSIONS, maxSizeMb: 20, mimePrefix: 'image/' },
  model_image: { extensions: IMAGE_EXTENSIONS, maxSizeMb: 20, mimePrefix: 'image/' },
  top_reference: { extensions: IMAGE_EXTENSIONS, maxSizeMb: 20, mimePrefix: 'image/' },
  bottom_reference: { extensions: IMAGE_EXTENSIONS, maxSizeMb: 20, mimePrefix: 'image/' },
  accessory_reference: { extensions: IMAGE_EXTENSIONS, maxSizeMb: 20, mimePrefix: 'image/' },
  fabric_pattern: { extensions: IMAGE_EXTENSIONS, maxSizeMb: 20, mimePrefix: 'image/' },
  sample_image: { extensions: IMAGE_EXTENSIONS, maxSizeMb: 20, mimePrefix: 'image/' },
  production_image: { extensions: IMAGE_EXTENSIONS, maxSizeMb: 20, mimePrefix: 'image/' },
  pattern_file: { extensions: PATTERN_EXTENSIONS, maxSizeMb: 50, mimePrefix: '' },
  document: { extensions: DOCUMENT_EXTENSIONS, maxSizeMb: 50, mimePrefix: '' },
  delivery_file: { extensions: [...IMAGE_EXTENSIONS, ...DOCUMENT_EXTENSIONS], maxSizeMb: 100, mimePrefix: '' }
})

function nowIso() {
  return new Date().toISOString()
}

function currentEnterpriseId() {
  return String(getCurrentEnterpriseId() || 'default_enterprise')
}

function currentOwnerId() {
  const member = getCurrentMember()
  const user = getCurrentUser()
  return String(member.memberId || user.userId || 'default_owner')
}

function hasUploadPermission(assetType = '') {
  const member = getCurrentMember()
  if (!member || member.status !== 'active') return false
  if (['pattern_file', 'delivery_file'].includes(assetType)) {
    return hasPermission('project.manage', { member }) || hasPermission('delivery.manage', { member }) || hasPermission('product.manage', { member }) || hasPermission('settings.manage', { member })
  }
  return true
}

export function isTemporaryLocalPath(value = '') {
  const text = String(value || '')
  return /^http:\/\/tmp\//i.test(text) || /^wxfile:\/\//i.test(text) || /^blob:/i.test(text) || /^file:\/\//i.test(text)
}

export function isStableCloudFileId(value = '') {
  return /^cloud:\/\//i.test(String(value || ''))
}

function getFileName(file = {}) {
  const value = file.name || file.fileName || file.path || file.filePath || file.tempFilePath || file.url || 'file.jpg'
  const clean = String(value).split('?')[0].split('#')[0]
  return sanitizeFileName(clean.split('/').pop() || clean.split('\\').pop() || 'file.jpg')
}

function getExtension(file = {}) {
  const name = getFileName(file)
  const match = name.match(/\.([a-zA-Z0-9]+)$/)
  return match ? match[1].toLowerCase() : 'jpg'
}

function getMimeType(file = {}, ext = '') {
  if (file.type) return String(file.type)
  if (['jpg', 'jpeg'].includes(ext)) return 'image/jpeg'
  if (ext === 'png') return 'image/png'
  if (ext === 'webp') return 'image/webp'
  if (ext === 'pdf') return 'application/pdf'
  if (ext === 'csv') return 'text/csv'
  if (['xls', 'xlsx'].includes(ext)) return 'application/vnd.ms-excel'
  return 'application/octet-stream'
}

function getFileSize(file = {}) {
  return Math.max(0, Number(file.size || file.fileSize || 0) || 0)
}

function getLocalPath(file = {}) {
  return String(file.path || file.filePath || file.tempFilePath || file.url || '')
}

function createCloudPath({ fileName = '', assetType = '', projectId = '' } = {}) {
  const date = new Date()
  const month = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}`
  const safeProject = String(projectId || 'unassigned').replace(/[^a-zA-Z0-9_-]/g, '_')
  const random = Math.random().toString(36).slice(2, 8)
  return `private-assets/${currentEnterpriseId()}/${assetType || 'asset'}/${month}/${safeProject}_${Date.now()}_${random}_${sanitizeFileName(fileName)}`
}

async function digestText(text = '') {
  const value = String(text || '')
  if (typeof crypto !== 'undefined' && crypto.subtle && typeof TextEncoder !== 'undefined') {
    const buffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
    return Array.from(new Uint8Array(buffer)).map((byte) => byte.toString(16).padStart(2, '0')).join('')
  }
  let hash = 0
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) - hash) + value.charCodeAt(index)
    hash |= 0
  }
  return `fallback_${Math.abs(hash)}`
}

export async function calculateFileDigest(file = {}, meta = {}) {
  const name = getFileName(file)
  const size = getFileSize(file)
  const path = getLocalPath(file)
  return digestText(`${name}|${size}|${path}|${meta.assetType || ''}`)
}

export function validateUploadFiles(files = [], options = {}) {
  const assetType = options.assetType || 'garment_image'
  const rule = ASSET_TYPE_RULES[assetType] || ASSET_TYPE_RULES.garment_image
  const maxCount = Math.max(1, Number(options.maxCount || 1))
  if (!Array.isArray(files) || !files.length) return { ok: false, errorCode: 'file_required', message: '请选择要上传的文件' }
  if (files.length > maxCount) return { ok: false, errorCode: 'file_count_exceeded', message: `最多上传 ${maxCount} 个文件` }
  for (const file of files) {
    const ext = getExtension(file)
    const mimeType = getMimeType(file, ext)
    const size = getFileSize(file)
    if (BLOCKED_EXTENSIONS.includes(ext)) return { ok: false, errorCode: 'dangerous_file_type', message: '不支持可执行文件或危险压缩包' }
    if (!rule.extensions.includes(ext)) return { ok: false, errorCode: 'invalid_file_extension', message: `不支持 .${ext} 文件` }
    if (rule.mimePrefix && !mimeType.startsWith(rule.mimePrefix)) return { ok: false, errorCode: 'invalid_mime_type', message: '文件 MIME 类型不匹配' }
    if (size && size > rule.maxSizeMb * 1024 * 1024) return { ok: false, errorCode: 'file_too_large', message: `单个文件不能超过 ${rule.maxSizeMb}MB` }
  }
  return { ok: true }
}

function hasWxCloudUpload() {
  return typeof wx !== 'undefined' && wx && wx.cloud && typeof wx.cloud.uploadFile === 'function'
}

function hasWxCloudTempFileUrl() {
  return typeof wx !== 'undefined' && wx && wx.cloud && typeof wx.cloud.getTempFileURL === 'function'
}

async function uploadByWxCloud(file = {}, cloudPath = '') {
  if (!hasWxCloudUpload()) throw new Error('wx_cloud_upload_unavailable')
  const filePath = getLocalPath(file)
  if (!filePath) throw new Error('local_path_required')
  const result = await wx.cloud.uploadFile({ cloudPath, filePath })
  return result.fileID || result.fileId || ''
}

async function uploadByWebCloud(file = {}, cloudPath = '') {
  const app = await getCloudWebApp()
  const auth = await ensureCloudWebAuth()
  if (!auth.ok) throw new Error(auth.errorCode || 'cloud_web_auth_required')
  if (!app || typeof app.uploadFile !== 'function') throw new Error('cloud_web_upload_unavailable')
  const filePath = file.rawFile || file.file || file
  const result = await app.uploadFile({ cloudPath, filePath })
  return result.fileID || result.fileId || ''
}

async function uploadToCloud(file = {}, cloudPath = '') {
  if (hasWxCloudUpload()) return uploadByWxCloud(file, cloudPath)
  return uploadByWebCloud(file, cloudPath)
}

export async function getTemporaryFileUrl(fileId = '', maxAge = 900) {
  if (!fileId) return { success: false, errorCode: 'file_id_required', tempUrl: '' }
  if (/^https:\/\//i.test(fileId)) {
    return { success: true, tempUrl: fileId, warning: 'temporary_https_input' }
  }
  if (!isStableCloudFileId(fileId)) return { success: false, errorCode: 'stable_file_id_required', tempUrl: '' }
  try {
    if (hasWxCloudTempFileUrl()) {
      const response = await wx.cloud.getTempFileURL({ fileList: [fileId] })
      const item = response && response.fileList && response.fileList[0]
      return { success: true, tempUrl: (item && (item.tempFileURL || item.download_url)) || '' }
    }
    const app = await getCloudWebApp()
    const auth = await ensureCloudWebAuth()
    if (!auth.ok) return { success: false, errorCode: auth.errorCode || 'cloud_web_auth_required', tempUrl: '' }
    const result = await app.getTempFileURL({ fileList: [{ fileID: fileId, maxAge }] })
    const item = result && result.fileList && result.fileList[0]
    return { success: true, tempUrl: (item && (item.tempFileURL || item.download_url)) || '' }
  } catch (error) {
    return { success: false, errorCode: error.code || error.message || 'temp_url_failed', tempUrl: '' }
  }
}

export async function resolveAiProviderImageUrl(fileId = '') {
  if (isTemporaryLocalPath(fileId)) {
    return { success: false, errorCode: 'temporary_path_not_allowed', imageUrl: '' }
  }
  const result = await getTemporaryFileUrl(fileId, 900)
  if (!result.success || !/^https:\/\//i.test(result.tempUrl || '')) {
    return { success: false, errorCode: result.errorCode || 'https_temp_url_required', imageUrl: '' }
  }
  return { success: true, imageUrl: result.tempUrl }
}

function buildPreprocessing(file = {}, mimeType = '') {
  const isImage = mimeType.startsWith('image/')
  return {
    thumbnailFileId: '',
    previewFileId: '',
    width: Number(file.width || 0) || 0,
    height: Number(file.height || 0) || 0,
    orientationFixed: false,
    hasAlpha: mimeType === 'image/png' || mimeType === 'image/webp',
    clarityScore: isImage ? 70 : 0,
    clarityStatus: isImage ? 'pending_manual_or_worker_check' : 'not_image'
  }
}

export async function uploadUnifiedFile(file = {}, options = {}) {
  const assetType = options.assetType || 'garment_image'
  if (!hasUploadPermission(assetType)) return { success: false, errorCode: 'forbidden', message: '当前账号无上传权限' }
  const validation = validateUploadFiles([file], { assetType, maxCount: 1 })
  if (!validation.ok) return { success: false, errorCode: validation.errorCode, message: validation.message }
  const fileName = getFileName(file)
  const ext = getExtension(file)
  const mimeType = getMimeType(file, ext)
  const fileSize = getFileSize(file)
  const fileDigest = await calculateFileDigest(file, { assetType })
  const duplicate = findDuplicateFile({ fileDigest, assetType, ownerId: currentOwnerId(), enterpriseId: currentEnterpriseId() })
  if (duplicate) {
    const referenceResult = linkFileReference({
      fileId: duplicate.fileId,
      projectId: options.projectId || duplicate.projectId,
      targetType: options.targetType || 'asset',
      targetId: options.targetId || '',
      relation: options.relation || 'duplicate_reference'
    })
    return { success: true, file: duplicate, fileId: duplicate.fileId, duplicate: true, reference: referenceResult.reference }
  }
  const cloudPath = createCloudPath({ fileName, assetType, projectId: options.projectId || '' })
  const uploadingRecord = normalizeFileRecord({
    fileId: `uploading_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    ownerId: currentOwnerId(),
    enterpriseId: currentEnterpriseId(),
    projectId: options.projectId || '',
    assetType,
    fileName,
    mimeType,
    fileSize,
    fileDigest,
    storagePath: cloudPath,
    permissionScope: options.permissionScope || 'private',
    status: 'uploading',
    preprocessing: buildPreprocessing(file, mimeType),
    source: options.source || 'unified_upload'
  })
  saveFileRecord(uploadingRecord)
  try {
    const fileId = await uploadToCloud(file, cloudPath)
    if (!fileId || !isStableCloudFileId(fileId)) throw new Error('stable_file_id_missing')
    const activeRecord = normalizeFileRecord({
      ...uploadingRecord,
      fileId,
      status: 'active',
      storagePath: cloudPath,
      updatedAt: nowIso()
    })
    saveFileRecord(activeRecord)
    const referenceResult = linkFileReference({
      fileId,
      projectId: options.projectId || '',
      targetType: options.targetType || 'asset',
      targetId: options.targetId || '',
      relation: options.relation || 'source'
    })
    const tempUrlResult = options.resolveTempUrl === false ? { tempUrl: '' } : await getTemporaryFileUrl(fileId, 900)
    console.log('[upload:unified]', {
      assetType,
      hasFileId: Boolean(fileId),
      hasTempUrl: Boolean(tempUrlResult.tempUrl),
      duplicate: false
    })
    return { success: true, file: activeRecord, fileId, tempUrl: tempUrlResult.tempUrl || '', reference: referenceResult.reference, duplicate: false }
  } catch (error) {
    saveFileRecord({ ...uploadingRecord, status: 'quarantined', updatedAt: nowIso() })
    return { success: false, errorCode: error.code || error.message || 'upload_failed', message: '上传失败，请检查云存储配置或文件类型' }
  }
}

export async function uploadUnifiedFiles(files = [], options = {}) {
  const validation = validateUploadFiles(files, { assetType: options.assetType || 'garment_image', maxCount: options.maxCount || files.length || 1 })
  if (!validation.ok) return { success: false, errorCode: validation.errorCode, message: validation.message, files: [] }
  const results = []
  for (const file of files) {
    // Keep uploads sequential so progress and partial failures stay predictable.
    results.push(await uploadUnifiedFile(file, options))
  }
  return {
    success: results.every((item) => item.success),
    files: results.filter((item) => item.success).map((item) => item.file),
    results
  }
}

export function loadFileGovernanceCenter(filters = {}) {
  const records = listFileRecords(filters)
  const typeMap = FILE_ASSET_TYPES.reduce((acc, item) => ({ ...acc, [item.key]: item.label }), {})
  const summary = {
    total: records.length,
    active: records.filter((item) => item.status === 'active').length,
    quarantined: records.filter((item) => item.status === 'quarantined').length,
    pendingDelete: records.filter((item) => item.status === 'pending_delete').length,
    privateCount: records.filter((item) => item.permissionScope === 'private').length
  }
  return { records, summary, typeMap, updatedAt: nowIso() }
}

export function auditFileDownload(fileId = '', options = {}) {
  return recordFileDownloadAudit({ fileId, projectId: options.projectId || '', action: options.action || 'download' })
}
