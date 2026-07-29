import { ASSET_TYPES, getAssetSourceTask } from './assetRepository'

const WORKSPACE_REUSE_STORAGE_KEY = 'diebiandesign_workspace_asset_reuse'

export const COPY_PARAM_FIELDS = Object.freeze([
  'modelId',
  'modelPrompt',
  'targetColorHex',
  'targetColorPrompt',
  'patternId',
  'patternPrompt',
  'sceneType',
  'optionPromptSummary'
])

const TASK_TYPE_TO_WORKSPACE_TYPE = Object.freeze({
  model_replace: 'model',
  change_model: 'model',
  color_replace: 'color',
  color_change: 'color',
  change_color: 'color',
  pattern_replace: 'pattern',
  ai_print: 'pattern',
  scene_replace: 'scene',
  scene_change: 'scene',
  change_scene: 'scene',
  micro_redesign: 'refine',
  minor_redesign: 'refine',
  ecommerce_main: 'ecommerce',
  xiaohongshu_seed: 'social',
  cross_border_white: 'crossborder',
  new_arrival: 'batch'
})

function getSourceTask(asset = {}) {
  if (!asset.sourceId || asset.assetType === ASSET_TYPES.MODEL || asset.assetType === ASSET_TYPES.BATCH) {
    return null
  }
  return getAssetSourceTask(asset.sourceId)
}

function getSourceParams(asset = {}, sourceTask = null) {
  const taskParams = (sourceTask && sourceTask.input && sourceTask.input.params) || (sourceTask && sourceTask.params) || {}
  return {
    ...taskParams,
    ...(asset.params || {})
  }
}

function getSourceClothImage(asset = {}, sourceTask = null) {
  if (asset.clothImage || asset.assetType === ASSET_TYPES.CLOTHING) {
    return asset.clothImage || asset.coverUrl || ''
  }
  const clothAsset = sourceTask && sourceTask.input && sourceTask.input.assets && sourceTask.input.assets.clothImage
  if (typeof clothAsset === 'string') {
    return clothAsset
  }
  return (clothAsset && (clothAsset.fileUrl || clothAsset.localPath || clothAsset.url || clothAsset.fileId)) || ''
}

function resolveWorkspaceType(asset = {}, params = {}, requestedType = '', sourceTask = null) {
  if (requestedType) {
    return requestedType
  }
  if (asset.assetType === ASSET_TYPES.MODEL) {
    return 'model'
  }
  return params.workspaceType ||
    TASK_TYPE_TO_WORKSPACE_TYPE[params.toolType] ||
    TASK_TYPE_TO_WORKSPACE_TYPE[params.taskType] ||
    TASK_TYPE_TO_WORKSPACE_TYPE[sourceTask && sourceTask.type] ||
    TASK_TYPE_TO_WORKSPACE_TYPE[sourceTask && sourceTask.taskType] ||
    'model'
}

function buildReusePayload(asset = {}, options = {}) {
  const sourceTask = getSourceTask(asset)
  const params = getSourceParams(asset, sourceTask)
  const workspaceType = resolveWorkspaceType(asset, params, options.type || '', sourceTask)
  return {
    reuseId: `asset_reuse_${Date.now()}`,
    sourceAssetId: asset.assetId || '',
    sourceAssetType: asset.assetType || '',
    sourceId: asset.sourceId || '',
    sourceTaskId: sourceTask && sourceTask.taskId ? sourceTask.taskId : '',
    workspaceType,
    clothImage: getSourceClothImage(asset, sourceTask),
    params: {
      ...params,
      ...(asset.assetType === ASSET_TYPES.MODEL
        ? {
            modelId: asset.modelId || params.modelId || '',
            modelName: asset.modelName || asset.name || params.modelName || '',
            modelPrompt: asset.modelPrompt || params.modelPrompt || '',
            modelAvatarUrl: asset.modelAvatarUrl || asset.coverUrl || params.modelAvatarUrl || ''
          }
        : {})
    },
    createdAt: new Date().toISOString()
  }
}

function applyPayloadToWorkspace(payload = {}, attempt = 0) {
  if (typeof getCurrentPages !== 'function') {
    return
  }
  const pages = getCurrentPages()
  const page = pages[pages.length - 1]
  const workspace = page && (page.$vm || page)
  if (!workspace || !workspace.form || !Object.prototype.hasOwnProperty.call(workspace, 'referenceImage')) {
    if (attempt < 6) {
      setTimeout(() => applyPayloadToWorkspace(payload, attempt + 1), 60)
    }
    return
  }

  if (payload.workspaceType && typeof workspace.selectType === 'function') {
    workspace.selectType(payload.workspaceType)
  }
  if (payload.clothImage) {
    workspace.referenceImage = payload.clothImage
  }

  const params = payload.params || {}
  workspace.form = {
    ...workspace.form,
    ratio: params.ratio || workspace.form.ratio,
    note: params.note || workspace.form.note,
    params: {
      ...(workspace.form.params || {}),
      ...params
    }
  }

  if (params.modelId) {
    workspace.modelLibraryType = params.modelType || 'custom'
    workspace.selectedModelId = params.modelId
  }
  if (params.targetColorHex) {
    workspace.selectedColorValue = workspace.customColorValue || workspace.selectedColorValue
    workspace.colorSource = 'custom'
    workspace.pickerHex = params.targetColorHex
    workspace.pickerRgb = params.targetColorRgb || workspace.pickerRgb
  }
  if (params.patternId && workspace.patternForm) {
    workspace.patternForm = {
      ...workspace.patternForm,
      patternId: params.patternId,
      patternType: params.patternType || workspace.patternForm.patternType,
      patternImage: params.patternImage || workspace.patternForm.patternImage,
      replaceArea: params.replaceArea || workspace.patternForm.replaceArea,
      patternStrength: params.patternStrength || workspace.patternForm.patternStrength,
      preserveTexture: params.preserveTexture === undefined ? workspace.patternForm.preserveTexture : params.preserveTexture
    }
  }
}

function navigateToWorkspace(payload = {}) {
  try {
    uni.setStorageSync(WORKSPACE_REUSE_STORAGE_KEY, payload)
  } catch (error) {}

  const query = [
    `type=${encodeURIComponent(payload.workspaceType || 'model')}`,
    `sourceAssetId=${encodeURIComponent(payload.sourceAssetId || '')}`,
    `sourceTaskId=${encodeURIComponent(payload.sourceTaskId || '')}`,
    `reuseId=${encodeURIComponent(payload.reuseId || '')}`
  ]
  if (payload.clothImage) {
    query.push(`clothImage=${encodeURIComponent(payload.clothImage)}`)
  }

  // #ifdef MP-WEIXIN
  uni.navigateTo({
    url: `/package-ai/simple-ai-workbench/simple-ai-workbench?toolType=${encodeURIComponent(payload.workspaceType || 'model')}&sourceAssetId=${encodeURIComponent(payload.sourceAssetId || '')}&sourceTaskId=${encodeURIComponent(payload.sourceTaskId || '')}&reuseId=${encodeURIComponent(payload.reuseId || '')}`
  })
  // #endif
  // #ifdef H5
  uni.navigateTo({
    url: `/pages/workspace/workspace?${query.join('&')}`,
    success: () => applyPayloadToWorkspace(payload)
  })
  // #endif
  return payload
}

export function openAsset(asset = {}) {
  if (asset.assetType === ASSET_TYPES.IMAGE && asset.sourceId) {
    uni.navigateTo({
      url: `/package-ai/result/result?taskId=${encodeURIComponent(asset.sourceId)}`
    })
    return asset
  }
  if (asset.assetType === ASSET_TYPES.BATCH && asset.sourceId) {
    uni.navigateTo({
      url: `/package-mobile-enterprise/batch-detail/batch-detail?batchId=${encodeURIComponent(asset.sourceId)}`
    })
    return asset
  }
  return reuseAsset(asset)
}

export function editAsset(asset = {}) {
  return reuseAsset(asset)
}

export function reuseAsset(asset = {}, options = {}) {
  const payload = buildReusePayload(asset, options)
  console.log('[asset:reuse]', {
    assetId: asset.assetId || '',
    assetType: asset.assetType || '',
    sourceId: asset.sourceId || ''
  })
  return navigateToWorkspace(payload)
}

export function copyAssetParams(asset = {}) {
  const sourceTask = getSourceTask(asset)
  const params = getSourceParams(asset, sourceTask)
  const copiedParams = COPY_PARAM_FIELDS.reduce((result, field) => {
    result[field] = params[field] === undefined ? '' : params[field]
    return result
  }, {})
  uni.setClipboardData({
    data: JSON.stringify(copiedParams, null, 2)
  })
  return copiedParams
}
