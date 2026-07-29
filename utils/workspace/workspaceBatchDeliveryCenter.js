import { getMainChainState } from '../mainChainState'
import { getBatchDetail, getTaskResultImageUrl, retryFailedBatchTasks } from '../task/batchRepository.js'
import { getCurrentEnterpriseId } from '../tenant/tenantContext.js'
import { getCurrentMember } from '../auth/authRepository.js'

const BATCH_META_KEY = 'diebians_workspace_batch_center_meta_v1'
const DELIVERY_KEY = 'diebians_workspace_delivery_center_v1'
const IDEMPOTENCY_KEY = 'diebians_workspace_batch_idempotency_v1'

export const WORKSPACE_BATCH_TABS = Object.freeze([
  { key: 'draft', label: '草稿批次' },
  { key: 'processing', label: '生成中' },
  { key: 'review', label: '待审核' },
  { key: 'partial_failed', label: '部分失败' },
  { key: 'delivering', label: '待交付' },
  { key: 'delivered', label: '已交付' }
])

function nowIso() {
  return new Date().toISOString()
}

function createId(prefix = 'id') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

function currentEnterpriseId() {
  return String(getCurrentEnterpriseId() || 'local_enterprise')
}

function currentMember() {
  return getCurrentMember() || {}
}

function readStore(key = '') {
  try {
    const value = uni.getStorageSync(key)
    return Array.isArray(value) ? value : []
  } catch (error) {
    return []
  }
}

function writeStore(key = '', value = []) {
  try {
    uni.setStorageSync(key, Array.isArray(value) ? value : [])
  } catch (error) {}
}

function unique(values = []) {
  return [...new Set(values.filter(Boolean))]
}

function normalizeMeta(meta = {}) {
  return {
    batchId: String(meta.batchId || ''),
    enterpriseId: String(meta.enterpriseId || currentEnterpriseId()),
    projectId: String(meta.projectId || ''),
    taskType: String(meta.taskType || 'batch'),
    source: String(meta.source || 'workspace_batch'),
    status: String(meta.status || 'draft'),
    title: String(meta.title || '批量任务'),
    idempotencyKey: String(meta.idempotencyKey || ''),
    estimatedQuota: Number(meta.estimatedQuota || 0),
    actualQuota: Number(meta.actualQuota || 0),
    approvedTaskIds: Array.isArray(meta.approvedTaskIds) ? meta.approvedTaskIds : [],
    rejectedTaskIds: Array.isArray(meta.rejectedTaskIds) ? meta.rejectedTaskIds : [],
    retouchTaskIds: Array.isArray(meta.retouchTaskIds) ? meta.retouchTaskIds : [],
    pausedTaskIds: Array.isArray(meta.pausedTaskIds) ? meta.pausedTaskIds : [],
    deliveryIds: Array.isArray(meta.deliveryIds) ? meta.deliveryIds : [],
    activity: Array.isArray(meta.activity) ? meta.activity : [],
    createdAt: meta.createdAt || nowIso(),
    updatedAt: meta.updatedAt || meta.createdAt || nowIso()
  }
}

function readMetaList() {
  const enterpriseId = currentEnterpriseId()
  return readStore(BATCH_META_KEY).map(normalizeMeta).filter((item) => item.enterpriseId === enterpriseId)
}

function writeMetaList(next = []) {
  const enterpriseId = currentEnterpriseId()
  const other = readStore(BATCH_META_KEY).map(normalizeMeta).filter((item) => item.enterpriseId !== enterpriseId)
  writeStore(BATCH_META_KEY, [...next.map(normalizeMeta), ...other])
}

function normalizeDelivery(record = {}) {
  return {
    deliveryId: String(record.deliveryId || ''),
    enterpriseId: String(record.enterpriseId || currentEnterpriseId()),
    projectId: String(record.projectId || ''),
    batchId: String(record.batchId || ''),
    title: String(record.title || '交付批次'),
    usage: String(record.usage || '电商上新'),
    fileFormat: String(record.fileFormat || 'JPG/PNG'),
    sizeSpec: String(record.sizeSpec || '平台通用尺寸'),
    namingRule: String(record.namingRule || '项目-用途-序号'),
    note: String(record.note || ''),
    taskIds: Array.isArray(record.taskIds) ? record.taskIds : [],
    assetIds: Array.isArray(record.assetIds) ? record.assetIds : [],
    versionNo: String(record.versionNo || 'V1'),
    reviewer: String(record.reviewer || ''),
    deliverer: String(record.deliverer || ''),
    status: String(record.status || 'delivered'),
    deliveredAt: record.deliveredAt || nowIso(),
    createdAt: record.createdAt || nowIso()
  }
}

function readDeliveries() {
  const enterpriseId = currentEnterpriseId()
  return readStore(DELIVERY_KEY).map(normalizeDelivery).filter((item) => item.enterpriseId === enterpriseId)
}

function writeDeliveries(next = []) {
  const enterpriseId = currentEnterpriseId()
  const other = readStore(DELIVERY_KEY).map(normalizeDelivery).filter((item) => item.enterpriseId !== enterpriseId)
  writeStore(DELIVERY_KEY, [...next.map(normalizeDelivery), ...other])
}

function getExistingBatches() {
  const state = getMainChainState()
  const batches = (state.batches && state.batches.byId) || {}
  return Object.values(batches).filter(Boolean)
}

function getStatusFromDetail(detail = {}, meta = {}) {
  const tasks = detail.tasks || []
  if (meta.status === 'draft') return 'draft'
  if ((meta.deliveryIds || []).length) return 'delivered'
  if ((meta.approvedTaskIds || []).length) return 'delivering'
  const failed = tasks.filter((task) => ['failed', 'timeout'].includes(String(task.status || '').toLowerCase())).length
  const processing = tasks.filter((task) => ['pending', 'queued', 'submitted', 'processing'].includes(String(task.status || '').toLowerCase())).length
  const success = tasks.filter((task) => ['success', 'completed'].includes(String(task.status || '').toLowerCase())).length
  if (failed && success) return 'partial_failed'
  if (failed && !success && !processing) return 'partial_failed'
  if (success && !processing) return 'review'
  if (processing) return 'processing'
  return meta.status || 'draft'
}

function ensureMeta(batch = {}) {
  const metaList = readMetaList()
  const existing = metaList.find((item) => item.batchId === batch.batchId)
  if (existing) return existing
  const meta = normalizeMeta({
    batchId: batch.batchId,
    projectId: batch.projectId || '',
    taskType: batch.type || batch.taskType || 'batch',
    status: batch.status || 'processing',
    title: batch.batchName || batch.title || '批量任务',
    estimatedQuota: Number(batch.totalCount || 0),
    createdAt: batch.createdAt,
    updatedAt: batch.updatedAt || batch.createdAt
  })
  writeMetaList([meta, ...metaList])
  return meta
}

function mergeBatch(batch = {}, meta = {}) {
  const detail = batch.batchId ? getBatchDetail(batch.batchId) : { tasks: [], stats: {} }
  const tasks = detail.tasks || []
  const successCount = tasks.filter((task) => ['success', 'completed'].includes(String(task.status || '').toLowerCase())).length
  const failedCount = tasks.filter((task) => ['failed', 'timeout'].includes(String(task.status || '').toLowerCase())).length
  const processingCount = tasks.filter((task) => ['pending', 'queued', 'submitted', 'processing'].includes(String(task.status || '').toLowerCase())).length
  const reviewCount = tasks.filter((task) => canEnterReview(task) && !meta.approvedTaskIds.includes(task.taskId)).length
  const deliveredCount = meta.deliveryIds.length
  return {
    ...batch,
    ...meta,
    status: getStatusFromDetail({ tasks }, meta),
    totalCount: Number(batch.totalCount || tasks.length || 0),
    successCount,
    failedCount,
    processingCount,
    reviewCount,
    deliveredCount,
    tasks,
    estimatedQuota: meta.estimatedQuota || Number(batch.totalCount || tasks.length || 0),
    actualQuota: meta.actualQuota || successCount
  }
}

function getTaskAssetIds(task = {}) {
  const directIds = [
    task.assetId,
    task.resultAssetId,
    task.historyId,
    task.result && task.result.assetId
  ]
  const itemIds = task.result && Array.isArray(task.result.items)
    ? task.result.items.map((item) => item.assetId || item.resultAssetId || item.id)
    : []
  return unique([...directIds, ...itemIds].map((item) => item && String(item)))
}

export function canEnterReview(task = {}) {
  const status = String(task.status || '').toLowerCase()
  const provider = String(task.provider || task.resultProvider || (task.result && task.result.provider) || '').toLowerCase()
  const source = String(task.source || (task.result && task.result.source) || '').toLowerCase()
  if (!['success', 'completed'].includes(status)) return false
  if (!getTaskResultImageUrl(task)) return false
  if (provider.includes('mock') || provider.includes('fallback')) return false
  if (source.includes('mock') || source.includes('fallback') || source.includes('test')) return false
  return true
}

export function listWorkspaceBatches() {
  const existing = getExistingBatches().map((batch) => mergeBatch(batch, ensureMeta(batch)))
  const existingIds = new Set(existing.map((batch) => batch.batchId))
  const draftOnly = readMetaList()
    .filter((meta) => !existingIds.has(meta.batchId))
    .map((meta) => mergeBatch({ batchId: meta.batchId, title: meta.title, taskIds: [] }, meta))
  return [...draftOnly, ...existing].sort((left, right) => String(right.updatedAt).localeCompare(String(left.updatedAt)))
}

export function getWorkspaceBatch(batchId = '') {
  return listWorkspaceBatches().find((batch) => batch.batchId === batchId) || null
}

export function createWorkspaceBatchDraft(input = {}) {
  const idempotencyKey = String(input.idempotencyKey || '')
  const existingKey = readStore(IDEMPOTENCY_KEY).find((item) => item.enterpriseId === currentEnterpriseId() && item.idempotencyKey === idempotencyKey)
  if (idempotencyKey && existingKey) {
    return { ok: true, batch: getWorkspaceBatch(existingKey.batchId), idempotent: true }
  }
  const batchId = createId('workspace_batch')
  const now = nowIso()
  const meta = normalizeMeta({
    batchId,
    projectId: input.projectId,
    taskType: input.taskType || 'batch',
    source: input.source || 'workspace_batch_create',
    status: 'draft',
    title: input.title || '批量任务草稿',
    idempotencyKey,
    estimatedQuota: Number(input.estimatedQuota || 0),
    createdAt: now,
    updatedAt: now,
    activity: [{
      action: 'create_draft',
      operatorName: (currentMember() || {}).name || '当前用户',
      createdAt: now
    }]
  })
  writeMetaList([meta, ...readMetaList()])
  if (idempotencyKey) {
    writeStore(IDEMPOTENCY_KEY, [{ enterpriseId: currentEnterpriseId(), idempotencyKey, batchId, createdAt: now }, ...readStore(IDEMPOTENCY_KEY)])
  }
  console.info('[workspace:batch]', { action: 'create_draft', batchId, success: true })
  return { ok: true, batch: mergeBatch({ batchId, title: meta.title, taskIds: [] }, meta), idempotent: false }
}

function patchBatchMeta(batchId = '', patcher) {
  const metaList = readMetaList()
  const meta = metaList.find((item) => item.batchId === batchId)
  if (!meta) return { ok: false, errorCode: 'batch_not_found' }
  const next = normalizeMeta(patcher(meta))
  writeMetaList(metaList.map((item) => item.batchId === batchId ? next : item))
  return { ok: true, meta: next }
}

export function approveWorkspaceBatchTasks(batchId = '', taskIds = [], options = {}) {
  const batch = getWorkspaceBatch(batchId)
  if (!batch) return { ok: false, errorCode: 'batch_not_found' }
  const requestedIds = taskIds.length ? taskIds : batch.tasks.map((task) => task.taskId)
  let success = 0
  let failed = 0
  let skipped = 0
  const approvedIds = []
  requestedIds.forEach((taskId) => {
    const task = batch.tasks.find((item) => item.taskId === taskId)
    if (!task || batch.approvedTaskIds.includes(taskId)) {
      skipped += 1
      return
    }
    if (!canEnterReview(task)) {
      failed += 1
      return
    }
    approvedIds.push(taskId)
    success += 1
  })
  patchBatchMeta(batchId, (meta) => ({
    ...meta,
    status: 'delivering',
    approvedTaskIds: unique([...meta.approvedTaskIds, ...approvedIds]),
    activity: [{
      action: options.bulk ? 'bulk_approve' : 'approve',
      operatorName: (currentMember() || {}).name || '当前用户',
      success,
      failed,
      skipped,
      createdAt: nowIso()
    }, ...meta.activity],
    updatedAt: nowIso()
  }))
  console.info('[workspace:batch]', { action: 'approve', batchId, success, failed, skipped })
  return { ok: true, success, failed, skipped }
}

export function markWorkspaceBatchRetouch(batchId = '', taskId = '', note = '') {
  return patchBatchMeta(batchId, (meta) => ({
    ...meta,
    retouchTaskIds: unique([...meta.retouchTaskIds, taskId]),
    activity: [{
      action: 'mark_retouch',
      operatorName: (currentMember() || {}).name || '当前用户',
      targetId: taskId,
      note,
      createdAt: nowIso()
    }, ...meta.activity],
    updatedAt: nowIso()
  }))
}

export function rejectWorkspaceBatchTask(batchId = '', taskId = '', note = '') {
  return patchBatchMeta(batchId, (meta) => ({
    ...meta,
    rejectedTaskIds: unique([...meta.rejectedTaskIds, taskId]),
    activity: [{
      action: 'reject',
      operatorName: (currentMember() || {}).name || '当前用户',
      targetId: taskId,
      note,
      createdAt: nowIso()
    }, ...meta.activity],
    updatedAt: nowIso()
  }))
}

export function retryWorkspaceBatchFailures(batchId = '') {
  const before = getWorkspaceBatch(batchId)
  if (!before) return { ok: false, errorCode: 'batch_not_found' }
  const failedBefore = before.failedCount
  const result = retryFailedBatchTasks(batchId)
  const retried = Array.isArray(result.taskIds) ? result.taskIds.length : 0
  patchBatchMeta(batchId, (meta) => ({
    ...meta,
    status: retried ? 'processing' : meta.status,
    activity: [{
      action: 'retry_failed',
      operatorName: (currentMember() || {}).name || '当前用户',
      success: retried,
      failed: 0,
      skipped: Math.max(0, failedBefore - retried),
      createdAt: nowIso()
    }, ...meta.activity],
    updatedAt: nowIso()
  }))
  console.info('[workspace:batch]', { action: 'retry_failed', batchId, retried })
  return { ok: true, success: retried, failed: 0, skipped: Math.max(0, failedBefore - retried) }
}

export function pauseWorkspaceBatchPending(batchId = '') {
  const batch = getWorkspaceBatch(batchId)
  if (!batch) return { ok: false, errorCode: 'batch_not_found' }
  const pendingIds = batch.tasks
    .filter((task) => ['pending', 'queued', 'submitted'].includes(String(task.status || '').toLowerCase()))
    .map((task) => task.taskId)
  patchBatchMeta(batchId, (meta) => ({
    ...meta,
    pausedTaskIds: unique([...meta.pausedTaskIds, ...pendingIds]),
    activity: [{
      action: 'pause_pending',
      operatorName: (currentMember() || {}).name || '当前用户',
      success: pendingIds.length,
      createdAt: nowIso()
    }, ...meta.activity],
    updatedAt: nowIso()
  }))
  return { ok: true, success: pendingIds.length, failed: 0, skipped: 0 }
}

export function createWorkspaceDelivery(input = {}) {
  const batch = getWorkspaceBatch(input.batchId)
  if (!batch) return { ok: false, errorCode: 'batch_not_found' }
  const taskIds = input.taskIds && input.taskIds.length ? input.taskIds : batch.approvedTaskIds
  const approvedSet = new Set(batch.approvedTaskIds)
  const allowedTaskIds = taskIds.filter((taskId) => approvedSet.has(taskId))
  if (!allowedTaskIds.length) {
    return { ok: false, errorCode: 'no_approved_assets' }
  }
  const assetIds = unique(batch.tasks
    .filter((task) => allowedTaskIds.includes(task.taskId))
    .flatMap(getTaskAssetIds))
  const member = currentMember()
  const delivery = normalizeDelivery({
    deliveryId: createId('delivery'),
    enterpriseId: currentEnterpriseId(),
    projectId: input.projectId || batch.projectId,
    batchId: input.batchId,
    title: input.title || `${batch.title} 交付批次`,
    usage: input.usage,
    fileFormat: input.fileFormat,
    sizeSpec: input.sizeSpec,
    namingRule: input.namingRule,
    note: input.note,
    taskIds: allowedTaskIds,
    assetIds: input.assetIds || assetIds,
    versionNo: input.versionNo || 'V1',
    reviewer: input.reviewer || member.name || '审核人',
    deliverer: input.deliverer || member.name || '交付人',
    deliveredAt: nowIso()
  })
  writeDeliveries([delivery, ...readDeliveries()])
  patchBatchMeta(input.batchId, (meta) => ({
    ...meta,
    status: 'delivered',
    deliveryIds: unique([...meta.deliveryIds, delivery.deliveryId]),
    activity: [{
      action: 'create_delivery',
      operatorName: member.name || '当前用户',
      targetId: delivery.deliveryId,
      createdAt: nowIso()
    }, ...meta.activity],
    updatedAt: nowIso()
  }))
  console.info('[workspace:delivery]', { action: 'create', deliveryId: delivery.deliveryId, batchId: input.batchId, success: true })
  return { ok: true, delivery }
}

export function listWorkspaceDeliveries() {
  return readDeliveries().sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt)))
}
