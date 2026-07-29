import { getWorkCategoryLabel, resolveWorkType } from './workTypeCatalog'
import {
  normalizeWorkIntegrityStatus,
  normalizeWorkResultItems,
  pickWorkResultUrl
} from './workResultIntegrity'

const WORK_RECORD_STORAGE_KEY = 'diebiandesign_work_records_v2'
const WORK_RECORD_VERSION = 2
let lastRepairSummary = { scanned: 0, recovered: 0, downgraded: 0 }

const STATUS_TEXT = Object.freeze({
  pending: '等待处理',
  uploading: '素材上传中',
  generating: '生成中',
  partial_success: '部分完成',
  needs_review: '待检查',
  result_missing: '结果缺失',
  completed: '已完成',
  failed: '生成失败',
  cancelled: '已取消',
  archived: '已归档'
})

function text(value = '') {
  return String(value || '').trim()
}

function nowIso() {
  return new Date().toISOString()
}

function readStorage() {
  if (typeof uni === 'undefined' || !uni || typeof uni.getStorageSync !== 'function') return { version: WORK_RECORD_VERSION, byTaskId: {} }
  try {
    const value = uni.getStorageSync(WORK_RECORD_STORAGE_KEY)
    if (value && typeof value === 'object' && value.byTaskId && typeof value.byTaskId === 'object') {
      return { version: WORK_RECORD_VERSION, byTaskId: { ...value.byTaskId } }
    }
  } catch (error) {}
  return { version: WORK_RECORD_VERSION, byTaskId: {} }
}

function writeStorage(state = {}) {
  if (typeof uni === 'undefined' || !uni || typeof uni.setStorageSync !== 'function') return false
  try {
    uni.setStorageSync(WORK_RECORD_STORAGE_KEY, {
      version: WORK_RECORD_VERSION,
      byTaskId: { ...(state.byTaskId || {}) }
    })
    return true
  } catch (error) {
    return false
  }
}

function readIdentity() {
  let user = {}
  let identity = {}
  try {
    if (typeof uni !== 'undefined' && uni && typeof uni.getStorageSync === 'function') {
      user = uni.getStorageSync('diebiandesign_current_user') || {}
      identity = uni.getStorageSync('diebiandesign_wechat_identity') || {}
    }
  } catch (error) {}
  const ownerId = text(user.userId || identity.userId || identity.openId || identity.openid || user.openId || user.openid)
  return {
    ownerId,
    enterpriseId: text(user.enterpriseId || identity.enterpriseId),
    available: Boolean(ownerId && !ownerId.startsWith('mock_'))
  }
}

function taskIdOf(task = {}) {
  return text(task.taskId || task.task_id || task.id || task.clientTaskId)
}

function pickUrl(value) {
  if (!value) return ''
  if (typeof value === 'string') return value
  return text(value.imageUrl || value.image_url || value.fileUrl || value.file_url || value.videoUrl || value.video_url || value.coverUrl || value.url)
}

function getResultItems(task = {}) {
  const result = task.result || {}
  if (Array.isArray(result)) return result
  if (Array.isArray(result.items) && result.items.length) return result.items
  if (result.items && typeof result.items === 'object') return [result.items]
  const single = pickUrl(result) || pickUrl(task.resultImageUrl) || pickUrl(task.result_image_url)
  return single ? [{ url: single }] : []
}

function getSourceUrl(task = {}) {
  const input = task.input || {}
  const assets = input.assets || {}
  const candidates = [
    assets.baseImage,
    assets.personImage,
    assets.modelImage,
    assets.frontImage,
    assets.clothImage,
    assets.cloth_image,
    assets.styleImage,
    assets.style_image,
    input.imageUrl,
    input.image_url,
    task.sourceImage
  ]
  return candidates.map(pickUrl).find(Boolean) || ''
}

function isMockOrFallback(task = {}) {
  const result = task.result && typeof task.result === 'object' ? task.result : {}
  const meta = result.meta && typeof result.meta === 'object' ? result.meta : {}
  const provider = [task.provider, result.provider, meta.provider].map(text).join(' ').toLowerCase()
  return Boolean(task.mock || task.isMock || task.fallback || task.isFallback || result.mock || result.fallback || meta.mock || meta.fallback || /mock|fallback/.test(provider))
}

export function normalizeWorkStatus(task = {}, completedOutputCount = 0, expectedOutputCount = 1) {
  return normalizeWorkIntegrityStatus(task, completedOutputCount, expectedOutputCount)
}

function expectedCountOf(task = {}) {
  const input = task.input || {}
  const params = input.params || task.params || {}
  const options = input.options || {}
  const result = task.result || {}
  const candidates = [task.outputCount, params.outputCount, options.outputCount, task.expectedOutputCount, result.expectedOutputCount, params.expectedOutputCount, options.expectedOutputCount]
  const count = candidates.map(Number).find((value) => Number.isFinite(value) && value > 0)
  return Math.max(1, count || 1)
}

function safeError(task = {}) {
  const error = task.error || {}
  return {
    code: text(error.code || task.errorCode),
    message: text(error.message || task.errorMessage || task.statusText),
    retryable: error.retryable === true || (task.control || {}).canRetry === true
  }
}

function buildDefaultTitle(typeLabel = 'AI生成作品', createdAt = '', sequence = 1) {
  const date = createdAt ? new Date(createdAt) : new Date()
  const validDate = Number.isFinite(date.getTime()) ? date : new Date()
  const month = String(validDate.getMonth() + 1).padStart(2, '0')
  const day = String(validDate.getDate()).padStart(2, '0')
  return `${typeLabel} · ${month}月${day}日 · ${String(sequence).padStart(2, '0')}`
}

function nextSequence(state = {}, ownerId = '', createdAt = '', workType = '') {
  const date = createdAt ? new Date(createdAt) : new Date()
  const dayKey = Number.isFinite(date.getTime()) ? date.toISOString().slice(0, 10) : nowIso().slice(0, 10)
  return Object.values(state.byTaskId || {}).filter((record) => (
    record.ownerId === ownerId && text(record.createdAt).slice(0, 10) === dayKey && record.workType === workType
  )).length + 1
}

export function upsertWorkRecordFromTask(task = {}, options = {}) {
  const taskId = taskIdOf(task)
  if (!taskId) return null
  const state = readStorage()
  const previous = state.byTaskId[taskId] || {}
  const identity = readIdentity()
  const ownerId = text(task.ownerId || task.userId || previous.ownerId || options.ownerId || identity.ownerId)
  if (!ownerId) return null
  const enterpriseId = text(task.enterpriseId || previous.enterpriseId || options.enterpriseId || identity.enterpriseId)
  const workType = resolveWorkType(task)
  const expectedOutputCount = expectedCountOf(task)
  const resultItems = task.resultAccessInvalid === true
    ? []
    : normalizeWorkResultItems(getResultItems(task), task.assetIds)
  const completedOutputCount = resultItems.length
  const status = normalizeWorkStatus(task, completedOutputCount, expectedOutputCount)
  const createdAt = text(task.createdAt || task.submittedAt || previous.createdAt) || nowIso()
  const sequence = previous.sequence || nextSequence(state, ownerId, createdAt, workType.key)
  const assetIds = Array.from(new Set(resultItems.map((item) => text(item.assetId)).filter(Boolean)))
  const resultUrls = resultItems.map(pickWorkResultUrl).filter(Boolean)
  const coverFileId = text(
    (resultItems[0] && (resultItems[0].fileId || resultItems[0].fileID)) ||
    (/^cloud:\/\//.test(resultUrls[0] || '') ? resultUrls[0] : '') ||
    task.coverFileId
  )
  const sourceUrl = getSourceUrl(task)
  const updatedAt = text(task.updatedAt) || nowIso()
  const taskParams = ((task.input || {}).params || task.params || {})
  const resultMeta = ((task.result || {}).meta || {})
  const environment = text(taskParams.environment || resultMeta.environment || task.environment || previous.environment)
  const capabilityStatus = text(taskParams.capabilityStatus || resultMeta.capabilityStatus || task.capabilityStatus || previous.capabilityStatus)
  const isExperimental = Boolean(taskParams.isExperimental || resultMeta.isExperimental || task.isExperimental || previous.isExperimental)
  const testAccountId = text(taskParams.testAccountId || resultMeta.testAccountId || previous.testAccountId)
  const isMock = isMockOrFallback(task)
  const resultBadge = isMock ? '流程测试' : isExperimental ? '实验结果' : '正式结果'
  const next = {
    workId: previous.workId || `work_${taskId}`,
    ownerId,
    enterpriseId,
    taskId,
    parentTaskId: text(task.parentTaskId || ((task.input || {}).params || {}).parentTaskId || previous.parentTaskId),
    batchId: text(task.batchId || task.batch_id || previous.batchId),
    projectId: text(task.projectId || previous.projectId),
    historyId: text(task.historyId || ((task.input || {}).params || {}).historyId || previous.historyId),
    planId: text(((task.input || {}).params || {}).planId || (task.params || {}).planId || previous.planId),
    workType: workType.key,
    category: workType.category,
    categoryLabel: getWorkCategoryLabel(workType.category),
    typeLabel: workType.label,
    detailPageId: text(taskParams.detailPageId || previous.detailPageId),
    productId: text(taskParams.productId || previous.productId),
    skuGroupId: text(taskParams.skuGroupId || previous.skuGroupId),
    skuId: text(taskParams.skuId || previous.skuId),
    skuCode: text(taskParams.skuCode || previous.skuCode),
    colorName: text(taskParams.colorName || previous.colorName),
    colorHex: text(taskParams.colorHex || previous.colorHex),
    productProfileVersion: Math.max(0, Number(taskParams.productProfileVersion || previous.productProfileVersion) || 0),
    sizeChartId: text(taskParams.sizeChartId || previous.sizeChartId),
    contentSnapshotId: text(taskParams.contentSnapshotId || previous.contentSnapshotId),
    productProfileSnapshot: taskParams.productProfileSnapshot || previous.productProfileSnapshot || null,
    contentSnapshot: taskParams.contentSnapshot || previous.contentSnapshot || [],
    templateName: text(taskParams.templateName || previous.templateName),
    productName: text(taskParams.productName || previous.productName),
    title: previous.customTitle || previous.title || (workType.key === 'detail_long_image' && text(taskParams.productName)
      ? `${text(taskParams.productName)} · 详情长图`
      : buildDefaultTitle(workType.label, createdAt, sequence)),
    customTitle: text(previous.customTitle),
    coverUrl: resultUrls[0] || '',
    coverFileId,
    sourceUrl,
    resultUrls,
    resultItems,
    assetIds,
    expectedOutputCount,
    completedOutputCount,
    failedOutputCount: Math.max(0, Number(task.failedOutputCount || (task.result || {}).failedOutputCount) || (status === 'failed' ? expectedOutputCount - completedOutputCount : 0)),
    status,
    progress: status === 'result_missing'
      ? 0
      : Math.max(0, Math.min(100, Number(task.progress) || Math.round((completedOutputCount / expectedOutputCount) * 100) || 0)),
    statusText: STATUS_TEXT[status] || text(task.statusText) || '状态确认中',
    error: status === 'result_missing'
      ? {
          code: text((task.error || {}).code || task.errorCode) || 'RESULT_MISSING',
          message: text((task.error || {}).message || task.errorMessage) || '生成结果未保存，请检查或重试',
          retryable: true
        }
      : safeError(task),
    environment,
    provider: text(taskParams.provider || resultMeta.provider || task.provider || previous.provider),
    model: text(taskParams.model || resultMeta.modelVersion || previous.model),
    resultMode: text(taskParams.resultMode || resultMeta.resultMode || previous.resultMode),
    providerRequestId: text(resultMeta.providerRequestId || previous.providerRequestId),
    quotaRecordId: text(taskParams.quotaRecordId || resultMeta.quotaRecordId || previous.quotaRecordId),
    quotaStatus: text(resultMeta.quotaStatus || taskParams.quotaRecordStatus || previous.quotaStatus),
    capabilityStatus,
    isMock,
    isExperimental,
    testAccountId,
    resultBadge,
    deliveryEligible: taskParams.deliveryEligible !== false && resultMeta.deliveryEligible !== false && !isMock && !isExperimental,
    isFallback: Boolean(task.fallback || task.isFallback || (task.result || {}).fallback),
    sequence,
    createdAt,
    updatedAt,
    completedAt: ['completed', 'needs_review'].includes(status) ? text(task.completedAt || previous.completedAt) : '',
    archivedAt: text(previous.archivedAt),
    deletedAt: text(previous.deletedAt),
    unread: previous.unread === true || (previous.status && previous.status !== status && ['completed', 'partial_success', 'needs_review', 'result_missing', 'failed'].includes(status))
  }
  state.byTaskId[taskId] = next
  writeStorage(state)
  return { ...next }
}

export function syncWorkRecordsFromTasks(tasks = []) {
  const sourceTasks = Array.isArray(tasks) ? tasks : []
  const previousByTaskId = readStorage().byTaskId || {}
  const summary = { scanned: 0, recovered: 0, downgraded: 0 }
  const records = sourceTasks.map((task) => {
    const taskId = taskIdOf(task)
    const previous = previousByTaskId[taskId] || {}
    const rawStatus = text(task.status || task.taskStatus || task.stage).toLowerCase()
    const taskClaimsCompletion = ['success', 'completed', 'done', 'result_ready'].includes(rawStatus)
    const taskValidResults = task.resultAccessInvalid === true
      ? []
      : normalizeWorkResultItems(getResultItems(task), task.assetIds)
    const wasInvalidCompleted = (
      previous.status === 'completed' && Math.max(0, Number(previous.completedOutputCount) || 0) === 0
    ) || (
      taskClaimsCompletion && taskValidResults.length === 0
    )
    if (wasInvalidCompleted) summary.scanned += 1
    const next = upsertWorkRecordFromTask(task)
    if (wasInvalidCompleted && next) {
      if (next.completedOutputCount > 0 && ['completed', 'needs_review', 'partial_success'].includes(next.status)) summary.recovered += 1
      else if (next.status === 'result_missing') summary.downgraded += 1
    }
    return next
  }).filter(Boolean)
  lastRepairSummary = summary
  return records
}

export function getLastWorkRepairSummary() {
  return { ...lastRepairSummary }
}

export function getWorkRecordsForCurrentUser(options = {}) {
  const identity = readIdentity()
  if (!identity.available) return []
  const includeDeleted = options.includeDeleted === true
  return Object.values(readStorage().byTaskId || {})
    .filter((record) => record.ownerId === identity.ownerId)
    .filter((record) => !record.enterpriseId || record.enterpriseId === identity.enterpriseId)
    .filter((record) => includeDeleted || !record.deletedAt)
}

export function getWorkRecordByTaskId(taskId = '') {
  const normalizedTaskId = text(taskId)
  if (!normalizedTaskId) return null
  return getWorkRecordsForCurrentUser({ includeDeleted: true }).find((record) => record.taskId === normalizedTaskId) || null
}

export function renameWorkRecord(taskId = '', title = '') {
  const record = getWorkRecordByTaskId(taskId)
  const nextTitle = text(title)
  if (!record || !nextTitle) return null
  const state = readStorage()
  state.byTaskId[record.taskId] = { ...record, title: nextTitle, customTitle: nextTitle, updatedAt: nowIso() }
  return writeStorage(state) ? { ...state.byTaskId[record.taskId] } : null
}

export function archiveWorkRecord(taskId = '') {
  const record = getWorkRecordByTaskId(taskId)
  if (!record || ['pending', 'uploading', 'generating'].includes(record.status)) return null
  const state = readStorage()
  const archivedAt = nowIso()
  state.byTaskId[record.taskId] = { ...record, status: 'archived', statusText: STATUS_TEXT.archived, archivedAt, updatedAt: archivedAt }
  return writeStorage(state) ? { ...state.byTaskId[record.taskId] } : null
}

export function moveWorkRecordToTrash(taskId = '') {
  const record = getWorkRecordByTaskId(taskId)
  if (!record || ['pending', 'uploading', 'generating'].includes(record.status) || record.projectId) return null
  const state = readStorage()
  const deletedAt = nowIso()
  state.byTaskId[record.taskId] = { ...record, deletedAt, updatedAt: deletedAt }
  return writeStorage(state) ? { ...state.byTaskId[record.taskId] } : null
}

export function restoreWorkRecord(taskId = '') {
  const record = getWorkRecordByTaskId(taskId)
  if (!record || !record.deletedAt) return null
  const state = readStorage()
  state.byTaskId[record.taskId] = { ...record, deletedAt: '', updatedAt: nowIso() }
  return writeStorage(state) ? { ...state.byTaskId[record.taskId] } : null
}

export function markWorkRecordRead(taskId = '') {
  const record = getWorkRecordByTaskId(taskId)
  if (!record || record.unread !== true) return record
  const state = readStorage()
  state.byTaskId[record.taskId] = { ...record, unread: false }
  return writeStorage(state) ? { ...state.byTaskId[record.taskId] } : null
}

export { STATUS_TEXT as WORK_STATUS_TEXT, WORK_RECORD_STORAGE_KEY }
