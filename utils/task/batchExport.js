export const BATCH_EXPORT_STATUS = Object.freeze({
  IDLE: 'idle',
  EXPORTING: 'exporting',
  COMPLETED: 'completed',
  FAILED: 'failed'
})

const FAILED_TASK_STATUSES = new Set(['failed', 'timeout'])

function getFirstValue(values = [], fallback = '') {
  return values.find((value) => value !== undefined && value !== null && String(value).trim()) || fallback
}

function getUniqueValues(tasks = [], resolver) {
  return [...new Set(tasks.map(resolver).filter(Boolean))]
}

export function getBatchExportImageUrl(task = {}) {
  const result = task.result || {}
  const firstItem = Array.isArray(result.items) ? result.items[0] : null
  const resultImage = typeof result.image === 'string'
    ? result.image
    : (result.image && result.image.url) || ''
  const itemUrl = typeof firstItem === 'string'
    ? firstItem
    : (firstItem && firstItem.url) || ''

  return task.resultImageUrl || resultImage || itemUrl || ''
}

export function buildBatchExportPackage(batch = {}, tasks = []) {
  const exportItems = []
  let skipFailedCount = 0
  let skipUnavailableCount = 0

  tasks.forEach((task) => {
    if (FAILED_TASK_STATUSES.has(task.status)) {
      skipFailedCount += 1
      return
    }

    const imageUrl = getBatchExportImageUrl(task)
    if (!imageUrl) {
      skipUnavailableCount += 1
      return
    }

    exportItems.push({
      taskId: task.taskId || '',
      imageUrl
    })
  })

  const modelInfo = getUniqueValues(tasks, (task) => {
    const params = (task.input && task.input.params) || {}
    return getFirstValue([params.modelName, params.modelId, params.modelType])
  })
  const colorInfo = getUniqueValues(tasks, (task) => {
    const params = (task.input && task.input.params) || {}
    return getFirstValue([params.targetColorName, params.colorName, params.targetColorHex, params.colorHex])
  })
  const sceneInfo = getUniqueValues(tasks, (task) => {
    const params = (task.input && task.input.params) || {}
    return getFirstValue([params.sceneTypeLabel, params.sceneType, params.outputUsage])
  })
  const batchId = batch.batchId || ''

  return {
    batchId,
    batchName: getFirstValue([batch.batchName, batch.name], batchId ? `商品素材包 ${batchId.slice(-8)}` : '商品素材包'),
    createdAt: batch.createdAt || '',
    imageCount: exportItems.length,
    modelInfo,
    colorInfo,
    sceneInfo,
    exportItems,
    skipFailedCount,
    skipUnavailableCount
  }
}
