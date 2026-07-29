import { get, set } from '../data-provider/dataProvider.js'
import { getCurrentMember, getCurrentUser } from '../auth/authRepository.js'
import { getCurrentEnterpriseId } from '../tenant/tenantContext.js'
import { recordAudit } from '../audit/auditService.js'

const FILE_RECORD_KEY = 'diebians_file_records_v1'
const FILE_REFERENCE_KEY = 'diebians_file_references_v1'
const FILE_DOWNLOAD_AUDIT_KEY = 'diebians_file_download_audit_v1'

export const FILE_STATUSES = Object.freeze(['uploading', 'active', 'quarantined', 'archived', 'pending_delete', 'deleted'])
export const FILE_PERMISSION_SCOPES = Object.freeze(['private', 'project', 'enterprise', 'delivery', 'system'])
export const FILE_ASSET_TYPES = Object.freeze([
  { key: 'garment_image', label: '服装图' },
  { key: 'model_image', label: '模特图' },
  { key: 'top_reference', label: '上装参考图' },
  { key: 'bottom_reference', label: '下装参考图' },
  { key: 'accessory_reference', label: '配饰参考图' },
  { key: 'fabric_pattern', label: '面料与图案图' },
  { key: 'pattern_file', label: '版型文件' },
  { key: 'sample_image', label: '样衣照片' },
  { key: 'production_image', label: '生产质检与交付照片' },
  { key: 'document', label: 'PDF与表格' },
  { key: 'delivery_file', label: '正式交付文件' }
])

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

function readArray(key) {
  const value = get(key, [])
  return Array.isArray(value) ? value : []
}

function writeArray(key, value = []) {
  set(key, Array.isArray(value) ? value : [])
}

export function sanitizeFileName(fileName = '') {
  const text = String(fileName || 'file').trim()
  return text
    .replace(/[\\/:*?"<>|#%{}^~[\]`]/g, '_')
    .replace(/\s+/g, '_')
    .slice(0, 120) || 'file'
}

export function normalizeFileRecord(record = {}) {
  const status = FILE_STATUSES.includes(record.status) ? record.status : 'active'
  const permissionScope = FILE_PERMISSION_SCOPES.includes(record.permissionScope) ? record.permissionScope : 'private'
  return {
    fileId: String(record.fileId || record.fileID || ''),
    ownerId: String(record.ownerId || currentOwnerId()),
    enterpriseId: String(record.enterpriseId || currentEnterpriseId()),
    projectId: String(record.projectId || ''),
    assetType: String(record.assetType || 'garment_image'),
    fileName: sanitizeFileName(record.fileName || record.name || 'file'),
    mimeType: String(record.mimeType || record.type || 'application/octet-stream'),
    fileSize: Math.max(0, Number(record.fileSize || record.size) || 0),
    fileDigest: String(record.fileDigest || record.digest || ''),
    storagePath: String(record.storagePath || record.cloudPath || ''),
    permissionScope,
    status,
    preprocessing: {
      thumbnailFileId: String(record.preprocessing?.thumbnailFileId || ''),
      previewFileId: String(record.preprocessing?.previewFileId || ''),
      width: Math.max(0, Number(record.preprocessing?.width) || 0),
      height: Math.max(0, Number(record.preprocessing?.height) || 0),
      orientationFixed: Boolean(record.preprocessing?.orientationFixed),
      hasAlpha: Boolean(record.preprocessing?.hasAlpha),
      clarityScore: Math.max(0, Number(record.preprocessing?.clarityScore) || 0),
      clarityStatus: String(record.preprocessing?.clarityStatus || 'unchecked')
    },
    source: String(record.source || 'unified_upload'),
    createdAt: record.createdAt || nowIso(),
    updatedAt: record.updatedAt || record.createdAt || nowIso()
  }
}

export function listFileRecords(filters = {}) {
  const records = readArray(FILE_RECORD_KEY).map(normalizeFileRecord)
  return records.filter((record) => {
    if (filters.enterpriseId && record.enterpriseId !== filters.enterpriseId) return false
    if (filters.ownerId && record.ownerId !== filters.ownerId) return false
    if (filters.projectId && record.projectId !== filters.projectId) return false
    if (filters.assetType && filters.assetType !== 'all' && record.assetType !== filters.assetType) return false
    if (filters.status && filters.status !== 'all' && record.status !== filters.status) return false
    if (filters.keyword) {
      const keyword = String(filters.keyword).toLowerCase()
      const haystack = `${record.fileId} ${record.fileName} ${record.fileDigest} ${record.storagePath}`.toLowerCase()
      if (!haystack.includes(keyword)) return false
    }
    return true
  }).sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt)))
}

export function getFileRecord(fileId = '') {
  return listFileRecords().find((record) => record.fileId === fileId) || null
}

export function findDuplicateFile(input = {}) {
  const digest = String(input.fileDigest || '').trim()
  if (!digest) return null
  const ownerId = String(input.ownerId || currentOwnerId())
  const enterpriseId = String(input.enterpriseId || currentEnterpriseId())
  return listFileRecords().find((record) => (
    record.fileDigest === digest &&
    record.ownerId === ownerId &&
    record.enterpriseId === enterpriseId &&
    record.assetType === String(input.assetType || record.assetType) &&
    record.status !== 'deleted'
  )) || null
}

export function saveFileRecord(input = {}) {
  const record = normalizeFileRecord(input)
  if (!record.fileId) return { success: false, errorCode: 'file_id_required' }
  const records = listFileRecords()
  const index = records.findIndex((item) => item.fileId === record.fileId)
  if (index >= 0) records.splice(index, 1, { ...records[index], ...record, createdAt: records[index].createdAt, updatedAt: nowIso() })
  else records.unshift(record)
  writeArray(FILE_RECORD_KEY, records)
  return { success: true, record: getFileRecord(record.fileId) || record }
}

export function linkFileReference(input = {}) {
  const fileId = String(input.fileId || '').trim()
  if (!fileId) return { success: false, errorCode: 'file_id_required' }
  const references = readArray(FILE_REFERENCE_KEY)
  const reference = {
    referenceId: String(input.referenceId || `file_ref_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`),
    fileId,
    enterpriseId: String(input.enterpriseId || currentEnterpriseId()),
    ownerId: String(input.ownerId || currentOwnerId()),
    projectId: String(input.projectId || ''),
    targetType: String(input.targetType || 'asset'),
    targetId: String(input.targetId || ''),
    relation: String(input.relation || 'source'),
    createdAt: input.createdAt || nowIso()
  }
  const exists = references.some((item) => item.fileId === reference.fileId && item.targetType === reference.targetType && item.targetId === reference.targetId && item.relation === reference.relation)
  if (!exists) writeArray(FILE_REFERENCE_KEY, [reference, ...references])
  return { success: true, reference, idempotent: exists }
}

export function listFileReferences(fileId = '') {
  const references = readArray(FILE_REFERENCE_KEY)
  return references.filter((item) => !fileId || item.fileId === fileId)
}

export function requestFileDelete(fileId = '') {
  const record = getFileRecord(fileId)
  if (!record) return { success: false, errorCode: 'file_not_found' }
  if (['delivery_file', 'pattern_file'].includes(record.assetType) && ['active', 'archived'].includes(record.status)) {
    return { success: false, errorCode: 'protected_file' }
  }
  const references = listFileReferences(fileId)
  const nextStatus = references.length ? 'archived' : 'pending_delete'
  const result = saveFileRecord({ ...record, status: nextStatus })
  auditFileAction('申请删除文件', record.fileId, { status: nextStatus, referenceCount: references.length })
  return result
}

export function recordFileDownloadAudit(input = {}) {
  const record = {
    auditId: String(input.auditId || `file_download_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`),
    fileId: String(input.fileId || ''),
    enterpriseId: String(input.enterpriseId || currentEnterpriseId()),
    ownerId: String(input.ownerId || currentOwnerId()),
    projectId: String(input.projectId || ''),
    action: String(input.action || 'download'),
    success: input.success !== false,
    createdAt: input.createdAt || nowIso()
  }
  writeArray(FILE_DOWNLOAD_AUDIT_KEY, [record, ...readArray(FILE_DOWNLOAD_AUDIT_KEY)].slice(0, 500))
  auditFileAction('文件下载或导出', record.fileId, { action: record.action, success: record.success })
  return { success: true, audit: record }
}

export function listFileDownloadAudits(fileId = '') {
  return readArray(FILE_DOWNLOAD_AUDIT_KEY).filter((item) => !fileId || item.fileId === fileId)
}

function auditFileAction(action = '', fileId = '', after = {}) {
  const member = getCurrentMember()
  recordAudit({
    enterpriseId: currentEnterpriseId(),
    userId: member.userId || member.memberId || '',
    operatorId: member.memberId || member.userId || '',
    operator: member.name || member.role || '当前用户',
    action,
    targetType: 'file',
    targetId: fileId,
    resourceType: 'file',
    resourceId: fileId,
    after,
    createdAt: nowIso()
  })
}
