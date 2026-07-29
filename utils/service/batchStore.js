import { createBatchAssetEntity, createBatchEntity } from './entities'

const BATCH_STORAGE_KEY = 'service_batches'
const BATCH_ASSET_STORAGE_KEY = 'service_batch_assets'
const BATCH_LOG_STORAGE_KEY = 'service_batch_logs'
const BATCH_RUNTIME_STORAGE_KEY = 'service_batch_runtime'

function normalizeBatchList(list) {
  if (!Array.isArray(list)) {
    return []
  }

  return list.map((batch) => createBatchEntity(batch))
}

function saveBatchList(batches) {
  uni.setStorageSync(BATCH_STORAGE_KEY, batches)
}

function normalizeBatchAssetList(list) {
  if (!Array.isArray(list)) {
    return []
  }

  return list.map((asset) => createBatchAssetEntity(asset))
}

function saveBatchAssetList(assets) {
  uni.setStorageSync(BATCH_ASSET_STORAGE_KEY, assets)
}

function getAssetFileId(asset = {}) {
  const directFileId = asset.fileId || asset.file_id || asset.fileID || ''
  if (directFileId) {
    return directFileId
  }
  const candidates = [
    asset.fileUrl,
    asset.file_url,
    asset.imageUrl,
    asset.image_url,
    asset.url,
    asset.downloadUrl,
    asset.download_url,
    asset.tempFileURL,
    asset.tempFileUrl
  ]
  return candidates.find((value) => /^cloud:\/\//.test(String(value || ''))) || ''
}

function getAssetFileUrl(asset = {}) {
  return (
    asset.fileUrl ||
    asset.file_url ||
    asset.imageUrl ||
    asset.image_url ||
    asset.url ||
    asset.downloadUrl ||
    asset.download_url ||
    asset.tempFileURL ||
    asset.tempFileUrl ||
    ''
  )
}

function createBatchLogEntity(overrides = {}) {
  return {
    logId: `log_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    batchId: '',
    type: 'info',
    action: '',
    message: '',
    summary: '',
    meta: {},
    relatedTaskId: '',
    createdAt: new Date().toISOString(),
    ...overrides
  }
}

function normalizeBatchLogList(list) {
  if (!Array.isArray(list)) {
    return []
  }
  return list.map((log) => createBatchLogEntity(log))
}

function saveBatchLogList(logs) {
  uni.setStorageSync(BATCH_LOG_STORAGE_KEY, logs)
}

function createBatchRuntimeEntity(overrides = {}) {
  return {
    batchId: '',
    state: 'idle',
    running: false,
    lastRunSummary: {
      total: 0,
      executed: 0,
      success: 0,
      failed: 0,
      skipped: 0,
      concurrency: 1
    },
    updatedAt: new Date().toISOString(),
    ...overrides
  }
}

function normalizeBatchRuntimeList(list) {
  if (!Array.isArray(list)) {
    return []
  }
  return list.map((item) => createBatchRuntimeEntity(item))
}

function saveBatchRuntimeList(list) {
  uni.setStorageSync(BATCH_RUNTIME_STORAGE_KEY, list)
}

export function getBatchList() {
  const batches = uni.getStorageSync(BATCH_STORAGE_KEY)
  return normalizeBatchList(batches).sort((left, right) =>
    String(right.updatedAt || right.createdAt || '').localeCompare(String(left.updatedAt || left.createdAt || ''))
  )
}

export function getBatchById(batchId) {
  return getBatchList().find((batch) => batch.batchId === batchId) || null
}

export function getBatchesByProjectId(projectId) {
  return getBatchList().filter((batch) => batch.projectId === projectId)
}

export function createBatch(payload = {}) {
  const batch = createBatchEntity({
    ...payload,
    updatedAt: new Date().toISOString()
  })

  const batches = getBatchList()
  batches.unshift(batch)
  saveBatchList(batches)
  return batch
}

export function updateBatch(batchId, patch = {}) {
  if (!batchId) {
    throw new Error('Batch ID is required')
  }

  const batches = getBatchList()
  let updatedBatch = null
  const now = new Date().toISOString()

  const nextBatches = batches.map((batch) => {
    if (batch.batchId !== batchId) {
      return batch
    }

    updatedBatch = createBatchEntity({
      ...batch,
      ...patch,
      batchId,
      updatedAt: patch.updatedAt || now
    })
    return updatedBatch
  })

  if (!updatedBatch) {
    throw new Error('Batch not found')
  }

  saveBatchList(nextBatches)
  return updatedBatch
}

export function getBatchAssets(batchId) {
  const assets = uni.getStorageSync(BATCH_ASSET_STORAGE_KEY)
  const normalized = normalizeBatchAssetList(assets)
  return normalized
    .filter((asset) => asset.batchId === batchId)
    .sort((left, right) => String(right.createdAt || '').localeCompare(String(left.createdAt || '')))
}

export function appendAssetsToBatch(batchId, assetPayloadList = []) {
  if (!batchId) {
    throw new Error('Batch ID is required')
  }

  const validPayloads = Array.isArray(assetPayloadList)
    ? assetPayloadList.filter((item) => item && item.localPath)
    : []

  if (!validPayloads.length) {
    return []
  }

  const currentAssets = normalizeBatchAssetList(uni.getStorageSync(BATCH_ASSET_STORAGE_KEY))
  const createdAssets = validPayloads.map((item) => {
    const fileId = getAssetFileId(item)
    const fileUrl = getAssetFileUrl(item)
    return createBatchAssetEntity({
      batchId,
      localPath: item.localPath || '',
      tempFilePath: item.tempFilePath || '',
      path: item.path || '',
      fileId,
      file_id: fileId,
      fileUrl,
      file_url: fileUrl,
      imageUrl: item.imageUrl || item.image_url || fileUrl,
      image_url: item.image_url || item.imageUrl || fileUrl,
      url: item.url || fileUrl,
      status: item.status || 'local_selected'
    })
  })

  saveBatchAssetList([...createdAssets, ...currentAssets])
  return createdAssets
}

export function markBatchAssetsOrchestrated(batchId, assetIds = []) {
  if (!batchId || !Array.isArray(assetIds) || !assetIds.length) {
    return []
  }

  const assetIdSet = new Set(assetIds.filter(Boolean))
  if (!assetIdSet.size) {
    return []
  }

  const currentAssets = normalizeBatchAssetList(uni.getStorageSync(BATCH_ASSET_STORAGE_KEY))
  const now = new Date().toISOString()
  const updatedAssets = []

  const nextAssets = currentAssets.map((asset) => {
    if (asset.batchId !== batchId || !assetIdSet.has(asset.assetId)) {
      return asset
    }

    const nextAsset = {
      ...asset,
      status: 'orchestrated',
      updatedAt: now
    }
    updatedAssets.push(nextAsset)
    return nextAsset
  })

  saveBatchAssetList(nextAssets)
  return updatedAssets
}

export function appendTaskToBatch(batchId, taskId) {
  if (!batchId || !taskId) {
    throw new Error('Batch ID and task ID are required')
  }

  const batches = getBatchList()
  let updatedBatch = null

  const nextBatches = batches.map((batch) => {
    if (batch.batchId !== batchId) {
      return batch
    }

    const nextTaskIds = Array.isArray(batch.taskIds) ? [...batch.taskIds] : []
    if (!nextTaskIds.includes(taskId)) {
      nextTaskIds.unshift(taskId)
    }

    updatedBatch = {
      ...batch,
      taskIds: nextTaskIds,
      updatedAt: new Date().toISOString()
    }

    return updatedBatch
  })

  if (!updatedBatch) {
    throw new Error('Batch not found')
  }

  saveBatchList(nextBatches)
  return updatedBatch
}

export function getBatchLogs(batchId) {
  const logs = normalizeBatchLogList(uni.getStorageSync(BATCH_LOG_STORAGE_KEY))
  return logs
    .filter((log) => log.batchId === batchId)
    .sort((left, right) => String(right.createdAt || '').localeCompare(String(left.createdAt || '')))
}

export function appendBatchLog(batchId, log = {}) {
  if (!batchId) {
    throw new Error('Batch ID is required')
  }

  const logs = normalizeBatchLogList(uni.getStorageSync(BATCH_LOG_STORAGE_KEY))
  const nextLog = createBatchLogEntity({
    ...log,
    batchId
  })

  saveBatchLogList([nextLog, ...logs])
  return nextLog
}

export function getBatchRuntimeState(batchId) {
  const list = normalizeBatchRuntimeList(uni.getStorageSync(BATCH_RUNTIME_STORAGE_KEY))
  const found = list.find((item) => item.batchId === batchId)
  return found || createBatchRuntimeEntity({ batchId })
}

export function setBatchRuntimeState(batchId, patch = {}) {
  if (!batchId) {
    throw new Error('Batch ID is required')
  }

  const list = normalizeBatchRuntimeList(uni.getStorageSync(BATCH_RUNTIME_STORAGE_KEY))
  const current = list.find((item) => item.batchId === batchId) || createBatchRuntimeEntity({ batchId })
  const next = createBatchRuntimeEntity({
    ...current,
    ...patch,
    batchId,
    updatedAt: new Date().toISOString(),
    lastRunSummary: {
      ...(current.lastRunSummary || {}),
      ...((patch && patch.lastRunSummary) || {})
    }
  })

  const nextList = list.filter((item) => item.batchId !== batchId)
  nextList.unshift(next)
  saveBatchRuntimeList(nextList)
  return next
}
