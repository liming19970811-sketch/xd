import { TASK_SOURCE, TASK_STATUS, TASK_TYPES } from '../constants'
import { createDraftTask, createEmptyAsset, createTaskEntity, normalizeTaskSource, normalizeTaskStatus } from './taskFactory'

function getTaskInputSource(state = {}) {
  if (state.currentTaskId && state.tasks && state.tasks.byId && state.tasks.byId[state.currentTaskId]) {
    const currentTask = state.tasks.byId[state.currentTaskId]
    if (currentTask && currentTask.input) {
      return currentTask.input
    }
  }

  if (state.draftTask && state.draftTask.input) {
    return state.draftTask.input
  }

  return {}
}

function getLegacyCompatibleParams(state = {}) {
  const input = getTaskInputSource(state)
  return input.params || {}
}

function getLegacyCompatibleOptions(state = {}) {
  const input = getTaskInputSource(state)
  return input.options || {}
}

function getLegacyCompatibleAssets(state = {}) {
  const input = getTaskInputSource(state)
  return input.assets || {}
}

function getLegacyCompatibleResult(state = {}) {
  if (state.currentTaskId && state.tasks && state.tasks.byId && state.tasks.byId[state.currentTaskId]) {
    const currentTask = state.tasks.byId[state.currentTaskId]
    if (currentTask && currentTask.result) {
      return currentTask.result
    }
  }

  if (state.draftTask && state.draftTask.result) {
    return state.draftTask.result
  }

  return {}
}

function getLegacyCompatibleRuntimeTask(state = {}) {
  if (state.currentTaskId && state.tasks && state.tasks.byId && state.tasks.byId[state.currentTaskId]) {
    return state.tasks.byId[state.currentTaskId] || {}
  }

  if (state.draftTask) {
    return state.draftTask
  }

  return {}
}

function mapAsset(asset) {
  return createEmptyAsset({
    localPath: asset && asset.localPath ? asset.localPath : '',
    fileId: asset && asset.fileId ? asset.fileId : '',
    fileUrl: asset && asset.fileUrl ? asset.fileUrl : ''
  })
}

function mapTaskStatus(taskStatus, hasResult) {
  if (taskStatus === TASK_STATUS.SUCCESS || hasResult) {
    return TASK_STATUS.SUCCESS
  }
  if (taskStatus === TASK_STATUS.FAILED || taskStatus === 'error') {
    return TASK_STATUS.FAILED
  }
  if (taskStatus === TASK_STATUS.TIMEOUT) {
    return TASK_STATUS.TIMEOUT
  }
  if (taskStatus === TASK_STATUS.QUEUED) {
    return TASK_STATUS.QUEUED
  }
  if (taskStatus === 'submitting') {
    return TASK_STATUS.SUBMITTED
  }
  if (taskStatus === TASK_STATUS.PROCESSING) {
    return TASK_STATUS.PROCESSING
  }
  return TASK_STATUS.DRAFT
}

function mapTaskStage(state, status) {
  const runtimeTask = getLegacyCompatibleRuntimeTask(state)
  const runtimeControl = (runtimeTask && runtimeTask.control) || {}
  const runtimeUploading = runtimeControl.uploading || {}

  if (runtimeUploading.clothImage || runtimeUploading.styleImage) {
    return 'uploading'
  }
  if (status === TASK_STATUS.SUBMITTED) {
    return 'submitting'
  }
  if (status === TASK_STATUS.QUEUED) {
    return TASK_STATUS.QUEUED
  }
  if (status === TASK_STATUS.PROCESSING && runtimeControl.canContinuePolling) {
    return 'polling'
  }
  if (status === TASK_STATUS.PROCESSING) {
    return 'generating'
  }
  if (status === TASK_STATUS.SUCCESS) {
    return 'result_ready'
  }
  if (status === TASK_STATUS.FAILED || status === TASK_STATUS.TIMEOUT) {
    return 'error'
  }
  return 'editing'
}

function mapStatusText(state) {
  const runtimeTask = getLegacyCompatibleRuntimeTask(state)
  const runtimeError = (runtimeTask && runtimeTask.error) || {}
  const runtimeErrorDetails = runtimeError.details || {}
  return runtimeTask.statusText || runtimeError.message || runtimeErrorDetails.generate || runtimeErrorDetails.polling || ''
}

function mapResult(state) {
  const taskResult = getLegacyCompatibleResult(state)
  const resultItems = Array.isArray(taskResult.items) ? taskResult.items : []
  const coverUrl = (taskResult && taskResult.coverUrl) || ((resultItems[0] && resultItems[0].fileUrl) || '')
  const options = getLegacyCompatibleOptions(state)
  return {
    items: resultItems,
    coverUrl,
    outputType: options.outputType || 'main',
    meta: (taskResult && taskResult.meta) || {}
  }
}

function mapError(state) {
  const runtimeTask = getLegacyCompatibleRuntimeTask(state)
  const runtimeError = (runtimeTask && runtimeTask.error) || {}
  const runtimeErrorDetails = runtimeError.details || {}
  const uploadError = runtimeErrorDetails.upload || {}
  const clothUploadError = uploadError && uploadError.clothImage
  const styleUploadError = uploadError && uploadError.styleImage
  const generateError = runtimeErrorDetails.generate || ''
  const pollingError = runtimeErrorDetails.polling || ''
  const generalError = runtimeError.message || ''
  const message = clothUploadError || styleUploadError || generateError || pollingError || generalError || ''

  let type = runtimeError.type || ''
  if (clothUploadError || styleUploadError) {
    type = 'upload'
  } else if (generateError) {
    type = 'generate'
  } else if (pollingError) {
    type = 'polling'
  } else if (generalError) {
    type = 'unknown'
  }

  return {
    type,
    code: runtimeError.code || '',
    message,
    retryable: !!(
      (runtimeError && runtimeError.retryable) ||
      clothUploadError ||
      styleUploadError
    ),
    details: {
      upload: {
        clothImage: clothUploadError || '',
        styleImage: styleUploadError || ''
      },
      generate: generateError || '',
      polling: pollingError || ''
    }
  }
}

function mapControl(state) {
  const runtimeTask = getLegacyCompatibleRuntimeTask(state)
  const runtimeControl = (runtimeTask && runtimeTask.control) || {}
  const runtimeRetryState = runtimeControl.retryState || {}
  const runtimeUploading = runtimeControl.uploading || {}

  return {
    canRetry: !!(
      runtimeControl.canRetry
    ),
    canContinuePolling: !!runtimeControl.canContinuePolling,
    lastTaskId: (state && (state.lastTaskId || state.taskId)) || '',
    pollingCount: 0,
    maxPollingCount: 10,
    retryState: {
      clothImage: !!runtimeRetryState.clothImage,
      styleImage: !!runtimeRetryState.styleImage,
      generate: !!runtimeRetryState.generate,
      polling: !!runtimeRetryState.polling
    },
    uploading: {
      clothImage: !!runtimeUploading.clothImage,
      styleImage: !!runtimeUploading.styleImage
    }
  }
}

export function mapLegacyStateToTaskEntity(state = {}) {
  const assets = getLegacyCompatibleAssets(state)
  const taskResult = getLegacyCompatibleResult(state)
  const runtimeTask = getLegacyCompatibleRuntimeTask(state)
  const resultItems = Array.isArray(taskResult.items) ? taskResult.items : []
  const hasResult = !!((taskResult && taskResult.coverUrl) || (resultItems[0] && resultItems[0].fileUrl))
  const status = mapTaskStatus(runtimeTask.status, hasResult)
  const params = getLegacyCompatibleParams(state)
  const options = getLegacyCompatibleOptions(state)

  return createTaskEntity({
    taskId: state.taskId || '',
    taskType: TASK_TYPES.MODEL_REPLACE,
    taskSource: TASK_SOURCE.MINIAPP,
    source: TASK_SOURCE.MINIAPP,
    input: {
      assets: {
        clothImage: mapAsset(assets.clothImage),
        styleImage: mapAsset(assets.styleImage)
      },
      params: {
        modelType: params.modelType || 'female',
        bodyType: params.bodyType || 'normal',
        kidsAgeGroup: params.kidsAgeGroup || 'middle',
        styleTag: params.styleTag || 'simple',
        sceneType: params.sceneType || 'white',
        neckType: params.neckType || 'round',
        sleeveType: params.sleeveType || 'long',
        fitType: params.fitType || 'loose'
      },
      options: {
        backgroundType: options.backgroundType || 'normal',
        outputType: options.outputType || 'main'
      }
    },
    status,
    stage: mapTaskStage(state, status),
    progress: typeof runtimeTask.progress === 'number' ? runtimeTask.progress : 0,
    statusText: mapStatusText(state),
    result: mapResult(state),
    error: mapError(state),
    control: mapControl(state)
  })
}

export function createDraftTaskFromLegacyState(state = {}) {
  const runtimeTask = getLegacyCompatibleRuntimeTask(state)
  return createDraftTask({
    ...mapLegacyStateToTaskEntity(state),
    status: TASK_STATUS.DRAFT,
    stage: 'editing',
    progress: typeof runtimeTask.progress === 'number' ? runtimeTask.progress : 0,
    statusText: runtimeTask.statusText || ''
  })
}

export function createTasksCollectionFromLegacyState(state = {}) {
  const taskId = state.taskId || state.lastTaskId || ''
  if (!taskId) {
    return {
      byId: {},
      allIds: []
    }
  }

  const taskEntity = mapLegacyStateToTaskEntity(state)
  return {
    byId: {
      [taskId]: taskEntity
    },
    allIds: [taskId]
  }
}

export function createDraftTaskPayloadFromLegacyState(state = {}) {
  return {
    currentTaskId: state.taskId || '',
    draftTask: createDraftTaskFromLegacyState(state),
    tasks: createTasksCollectionFromLegacyState(state),
    uiState: {
      currentStep: (state.uiState && typeof state.uiState.currentStep === 'number') ? state.uiState.currentStep : 1
    }
  }
}

function mapServerAsset(asset = {}) {
  return createEmptyAsset({
    localPath: asset.local_path || asset.localPath || '',
    fileId: asset.file_id || asset.fileId || '',
    fileUrl: asset.file_url || asset.fileUrl || asset.url || ''
  })
}

function mapServerResultItems(items = []) {
  if (!Array.isArray(items)) {
    return []
  }

  return items.map((item = {}, index) => ({
    resultId: item.result_id || item.resultId || item.id || `result_${index + 1}`,
    fileId: item.file_id || item.fileId || '',
    fileUrl: item.file_url || item.fileUrl || item.url || '',
    type: item.type || 'image'
  }))
}

export function mapServerTaskToTaskEntity(serverTask = {}) {
  const input = serverTask.input || {}
  const serverAssets = input.assets || {}
  const serverParams = input.params || {}
  const serverOptions = input.options || {}
  const clothImage = input.cloth_image || input.clothImage || serverAssets.clothImage || {}
  const styleImage = input.style_image || input.styleImage || serverAssets.styleImage || {}
  const personImage = input.person_image || input.personImage || serverAssets.personImage || {}
  const upperGarment = input.upper_garment || input.upperGarment || serverAssets.upperGarment || {}
  const lowerGarment = input.lower_garment || input.lowerGarment || serverAssets.lowerGarment || {}
  const outfitGarment = input.outfit_garment || input.outfitGarment || serverAssets.outfitGarment || {}
  const accessoryReferences = Array.isArray(serverAssets.accessoryReferences)
    ? serverAssets.accessoryReferences
    : (Array.isArray(serverParams.accessoryReferences) ? serverParams.accessoryReferences : [])
  const frontImage = input.front_image || input.frontImage || serverAssets.frontImage || {}
  const backImage = input.back_image || input.backImage || serverAssets.backImage || {}
  const sideImage = input.side_image || input.sideImage || serverAssets.sideImage || {}
  const structureSketch = input.structure_sketch || input.structureSketch || serverAssets.structureSketch || {}
  const designSketch = input.design_sketch || input.designSketch || serverAssets.designSketch || {}
  const result = serverTask.result || {}
  const resultItems = mapServerResultItems(result.items || result.images || [])
  const error = serverTask.error || {}
  const control = serverTask.control || {}
  const uploadDetails = (error.details && error.details.upload) || {}

  return createTaskEntity({
    taskId: serverTask.task_id || serverTask.taskId || '',
    clientTaskId: serverTask.client_task_id || serverTask.clientTaskId || '',
    taskType: serverTask.task_type || serverTask.taskType || TASK_TYPES.MODEL_REPLACE,
    taskSource: normalizeTaskSource(serverTask.task_source || serverTask.taskSource || serverTask.source, TASK_SOURCE.SERVER),
    source: normalizeTaskSource(serverTask.task_source || serverTask.taskSource || serverTask.source, TASK_SOURCE.SERVER),
    bizType: serverTask.biz_type || serverTask.bizType || 'ai_listing',
    projectId: serverTask.project_id || serverTask.projectId || '',
    batchId: serverTask.batch_id || serverTask.batchId || '',
    userId: serverTask.user_id || serverTask.userId || '',
    enterpriseId: serverTask.enterprise_id || serverTask.enterpriseId || '',
    channel: serverTask.channel || '',
    input: {
      assets: {
        clothImage: mapServerAsset(clothImage),
        styleImage: mapServerAsset(styleImage),
        personImage: mapServerAsset(personImage),
        upperGarment: mapServerAsset(upperGarment),
        lowerGarment: mapServerAsset(lowerGarment),
        outfitGarment: mapServerAsset(outfitGarment),
        accessoryReferences: accessoryReferences.map((item = {}) => ({
          accessoryId: item.accessoryId || '',
          type: item.type || item.accessoryType || '',
          name: item.name || '',
          ...mapServerAsset(item)
        })),
        frontImage: mapServerAsset(frontImage),
        backImage: mapServerAsset(backImage),
        sideImage: mapServerAsset(sideImage),
        structureSketch: mapServerAsset(structureSketch),
        designSketch: mapServerAsset(designSketch)
      },
      params: {
        ...serverParams,
        modelType: serverParams.modelType || serverParams.model_type || 'female',
        bodyType: serverParams.bodyType || serverParams.body_type || 'normal',
        kidsAgeGroup: serverParams.kidsAgeGroup || serverParams.kids_age_group || 'middle',
        styleTag: serverParams.styleTag || serverParams.style_tag || 'simple',
        sceneType: serverParams.sceneType || serverParams.scene_type || 'white',
        neckType: serverParams.neckType || serverParams.neck_type || 'round',
        sleeveType: serverParams.sleeveType || serverParams.sleeve_type || 'long',
        fitType: serverParams.fitType || serverParams.fit_type || 'loose'
      },
      options: {
        backgroundType: serverOptions.backgroundType || serverOptions.background_type || 'normal',
        outputType: serverOptions.outputType || serverOptions.output_type || 'main'
      }
    },
    status: normalizeTaskStatus(serverTask.status, TASK_STATUS.DRAFT),
    stage: serverTask.stage || 'editing',
    progress: typeof serverTask.progress === 'number' ? serverTask.progress : 0,
    statusText: serverTask.status_text || serverTask.statusText || '',
    result: {
      items: resultItems,
      coverUrl: result.cover_url || result.coverUrl || ((resultItems[0] && resultItems[0].fileUrl) || ''),
      outputType: result.output_type || result.outputType || 'main',
      meta: result.meta || {}
    },
    error: {
      type: error.type || '',
      code: error.code || '',
      message: error.message || '',
      retryable: typeof error.retryable === 'boolean' ? error.retryable : false,
      details: {
        upload: {
          clothImage: uploadDetails.clothImage || uploadDetails.cloth_image || '',
          styleImage: uploadDetails.styleImage || uploadDetails.style_image || ''
        },
        generate:
          (error.details && (error.details.generate || error.details.generate_error)) || '',
        polling:
          (error.details && (error.details.polling || error.details.polling_error)) || ''
      }
    },
    control: {
      canRetry: typeof control.can_retry === 'boolean' ? control.can_retry : !!control.canRetry,
      canContinuePolling:
        typeof control.can_continue_polling === 'boolean'
          ? control.can_continue_polling
          : !!control.canContinuePolling,
      lastTaskId: control.last_task_id || control.lastTaskId || '',
      pollingCount: typeof control.polling_count === 'number' ? control.polling_count : 0,
      maxPollingCount: typeof control.max_polling_count === 'number' ? control.max_polling_count : 10,
      retryState: {
        clothImage: !!(control.retry_state && (control.retry_state.clothImage || control.retry_state.cloth_image)),
        styleImage: !!(control.retry_state && (control.retry_state.styleImage || control.retry_state.style_image)),
        generate: !!(control.retry_state && control.retry_state.generate),
        polling: !!(control.retry_state && control.retry_state.polling)
      },
      uploading: {
        clothImage: !!(control.uploading && (control.uploading.clothImage || control.uploading.cloth_image)),
        styleImage: !!(control.uploading && (control.uploading.styleImage || control.uploading.style_image))
      }
    },
    createdAt: serverTask.created_at || serverTask.createdAt || '',
    updatedAt: serverTask.updated_at || serverTask.updatedAt || '',
    submittedAt: serverTask.submitted_at || serverTask.submittedAt || '',
    completedAt: serverTask.completed_at || serverTask.completedAt || ''
  })
}
