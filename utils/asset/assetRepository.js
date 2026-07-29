import { getMainChainState } from '../mainChainState'
import { getMyModels } from '../model/modelLibrary'

export const ASSET_TYPES = Object.freeze({
  IMAGE: 'image',
  CLOTHING: 'clothing',
  MODEL: 'model',
  BATCH: 'batch'
})

const HIDDEN_ASSET_IDS_KEY = 'diebiandesign_hidden_asset_ids'

const TASK_TYPE_LABELS = Object.freeze({
  model_replace: '换模特',
  garment_replace: 'AI换衣服',
  pattern_structure_generate: '打版结构图',
  model: '换模特',
  change_model: '换模特',
  color_replace: '换颜色',
  color: '换颜色',
  color_change: '换颜色',
  change_color: '换颜色',
  pattern_replace: '换图案',
  pattern: '换图案',
  ai_print: 'AI 印花',
  scene_replace: '换场景',
  scene: '换场景',
  scene_change: '换场景',
  change_scene: '换场景',
  pose_replace: 'AI换姿势',
  pose_adjust: 'AI换姿势',
  pose_variation: 'AI换姿势',
  pose_variant: 'AI换姿势',
  pose_change: 'AI换姿势',
  micro_redesign: '微改款',
  refine: '微改款',
  minor_redesign: '微改款',
  ecommerce_main: '电商主图',
  xiaohongshu_seed: '小红书种草图',
  cross_border_white: '跨境白底图',
  new_arrival: '新品上新图',
  batch_model: '批量模特图'
})

function readHiddenAssetIds() {
  try {
    const value = uni.getStorageSync(HIDDEN_ASSET_IDS_KEY)
    return Array.isArray(value) ? value.filter(Boolean) : []
  } catch (error) {
    return []
  }
}

function writeHiddenAssetIds(assetIds = []) {
  try {
    uni.setStorageSync(HIDDEN_ASSET_IDS_KEY, [...new Set(assetIds.filter(Boolean))])
  } catch (error) {}
}

function getTaskResultImageUrl(task = {}) {
  const result = task.result || {}
  const firstItem = Array.isArray(result.items) ? result.items[0] : null
  const resultImage = typeof result.image === 'string'
    ? result.image
    : (result.image && (result.image.url || result.image.imageUrl || result.image.fileUrl)) || ''
  const firstItemUrl = typeof firstItem === 'string'
    ? firstItem
    : (firstItem && (firstItem.url || firstItem.imageUrl || firstItem.fileUrl)) || ''
  return task.resultImageUrl ||
    task.result_image_url ||
    resultImage ||
    result.imageUrl ||
    result.coverUrl ||
    firstItemUrl ||
    ''
}

function getAssetUrl(asset = {}) {
  if (typeof asset === 'string') {
    return asset
  }
  return asset.fileUrl || asset.localPath || asset.url || asset.fileId || ''
}

function getTaskTypeLabel(task = {}) {
  const params = (task.input && task.input.params) || task.params || {}
  const candidates = [
    params.entryScene,
    params.workspaceType,
    params.toolType,
    params.taskType,
    task.type,
    task.taskType
  ].filter(Boolean)
  const matchedType = candidates.find((value) => TASK_TYPE_LABELS[value])
  return TASK_TYPE_LABELS[matchedType] || 'AI 出图'
}

function getTaskStatusText(status = '') {
  const statusMap = {
    success: '已完成',
    completed: '已完成',
    processing: '生成中',
    queued: '生成中',
    submitted: '生成中',
    failed: '失败',
    timeout: '失败',
    pending: '待处理',
    draft: '待处理'
  }
  return statusMap[status] || '待处理'
}

function getSortedTasks(state = {}) {
  const tasksState = state.tasks || {}
  const tasksById = tasksState.byId || {}
  const ids = Array.isArray(tasksState.allIds) && tasksState.allIds.length
    ? tasksState.allIds
    : Object.keys(tasksById)
  return ids
    .map((taskId) => tasksById[taskId])
    .filter(Boolean)
    .sort((left, right) => String(right.completedAt || right.updatedAt || right.createdAt || '').localeCompare(String(left.completedAt || left.updatedAt || left.createdAt || '')))
}

function buildWorkAssets(tasks = []) {
  return tasks.filter((task) => !task.batchId).map((task) => {
    const taskId = task.taskId || ''
    const input = task.input || {}
    const params = input.params || task.params || {}
    return {
      assetId: `work_${taskId}`,
      assetType: ASSET_TYPES.IMAGE,
      coverUrl: getTaskResultImageUrl(task),
      sourceId: taskId,
      createdAt: task.completedAt || task.updatedAt || task.createdAt || task.submittedAt || '',
      taskId,
      batchId: task.batchId || '',
      taskType: getTaskTypeLabel(task),
      status: task.status || 'pending',
      statusText: getTaskStatusText(task.status || 'pending'),
      clothImage: getAssetUrl(input.assets && input.assets.clothImage),
      params: { ...params }
    }
  })
}

function buildBatchAssets(tasks = [], batchesState = {}) {
  const groups = {}
  tasks.filter((task) => task.batchId).forEach((task) => {
    if (!groups[task.batchId]) {
      groups[task.batchId] = []
    }
    groups[task.batchId].push(task)
  })

  return Object.keys(groups).map((batchId) => {
    const batchTasks = groups[batchId]
    const sourceBatch = (batchesState.byId && batchesState.byId[batchId]) || {}
    const successCount = batchTasks.filter((task) => task.status === 'success' || task.status === 'completed').length
    const failedCount = batchTasks.filter((task) => task.status === 'failed' || task.status === 'timeout').length
    const status = sourceBatch.status || (successCount === batchTasks.length ? 'completed' : failedCount === batchTasks.length ? 'failed' : 'processing')
    const coverTask = batchTasks.find((task) => getTaskResultImageUrl(task)) || batchTasks[0] || {}
    return {
      assetId: `batch_${batchId}`,
      assetType: ASSET_TYPES.BATCH,
      coverUrl: getTaskResultImageUrl(coverTask),
      sourceId: batchId,
      createdAt: sourceBatch.createdAt || coverTask.createdAt || '',
      batchId,
      name: sourceBatch.batchName || '批量素材',
      taskCount: batchTasks.length,
      successCount,
      failedCount,
      status,
      statusText: status === 'completed' ? '已完成' : status === 'failed' ? '失败' : '生成中'
    }
  })
}

function buildClothingAssets(tasks = []) {
  const seenUrls = new Set()
  return tasks.reduce((assets, task) => {
    const input = task.input || {}
    const params = input.params || task.params || {}
    const clothImage = input.assets && input.assets.clothImage
    const coverUrl = getAssetUrl(clothImage)
    if (!coverUrl || seenUrls.has(coverUrl)) {
      return assets
    }
    seenUrls.add(coverUrl)
    const taskId = task.taskId || ''
    assets.push({
      assetId: `clothing_${taskId}`,
      assetType: ASSET_TYPES.CLOTHING,
      coverUrl,
      sourceId: taskId,
      createdAt: task.createdAt || task.submittedAt || task.updatedAt || '',
      name: params.clothingName || params.garmentName || params.productName || '服装素材',
      clothImage: coverUrl,
      params: { ...params }
    })
    return assets
  }, [])
}

function buildModelAssets() {
  return getMyModels().map((model) => ({
    assetId: `model_${model.modelId}`,
    assetType: ASSET_TYPES.MODEL,
    coverUrl: model.avatarUrl || model.coverUrl || '',
    sourceId: model.modelId,
    createdAt: model.createdAt || '',
    modelId: model.modelId,
    name: model.name || '我的模特',
    tags: Array.isArray(model.styleTags) ? model.styleTags : [],
    modelName: model.name || '我的模特',
    modelPrompt: model.modelPrompt || '',
    modelAvatarUrl: model.avatarUrl || model.coverUrl || '',
    params: {
      modelId: model.modelId,
      modelName: model.name || '我的模特',
      modelPrompt: model.modelPrompt || '',
      modelAvatarUrl: model.avatarUrl || model.coverUrl || ''
    }
  }))
}

export function getUserAssets() {
  const state = getMainChainState()
  const hiddenIds = new Set(readHiddenAssetIds())
  const tasks = getSortedTasks(state)
  const works = buildWorkAssets(tasks).filter((asset) => !hiddenIds.has(asset.assetId))
  const clothing = buildClothingAssets(tasks).filter((asset) => !hiddenIds.has(asset.assetId))
  const models = buildModelAssets().filter((asset) => !hiddenIds.has(asset.assetId))
  const batches = buildBatchAssets(tasks, state.batches || {}).filter((asset) => !hiddenIds.has(asset.assetId))

  return {
    works,
    clothing,
    models,
    batches,
    all: [...works, ...clothing, ...models, ...batches]
  }
}

export function getAssetSourceTask(taskId = '') {
  const state = getMainChainState()
  return (state.tasks && state.tasks.byId && state.tasks.byId[taskId]) || null
}

export function deleteAssetRecord(assetId = '') {
  const normalizedAssetId = String(assetId || '').trim()
  if (!normalizedAssetId) {
    return false
  }
  const hiddenIds = readHiddenAssetIds()
  writeHiddenAssetIds([...hiddenIds, normalizedAssetId])
  return true
}

export function formatAssetTime(value = '') {
  const date = value ? new Date(value) : null
  if (!date || Number.isNaN(date.getTime())) {
    return '刚刚'
  }
  const pad = (number) => String(number).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}
