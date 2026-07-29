import { createDraftTask, createEmptyAsset, createTaskEntity } from './taskFactory'

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
  if (taskStatus === 'success' || hasResult) {
    return 'success'
  }
  if (taskStatus === 'failed' || taskStatus === 'error') {
    return 'failed'
  }
  if (taskStatus === 'timeout') {
    return 'timeout'
  }
  if (taskStatus === 'queued') {
    return 'queued'
  }
  if (taskStatus === 'submitting') {
    return 'submitted'
  }
  if (taskStatus === 'processing') {
    return 'processing'
  }
  return 'draft'
}

function mapTaskStage(state, status) {
  const runtimeTask = getLegacyCompatibleRuntimeTask(state)
  const runtimeControl = (runtimeTask && runtimeTask.control) || {}
  const runtimeUploading = runtimeControl.uploading || {}

  if (runtimeUploading.clothImage || runtimeUploading.styleImage) {
    return 'uploading'
  }
  if (status === 'submitted') {
    return 'submitting'
  }
  if (status === 'queued') {
    return 'queued'
  }
  if (status === 'processing' && runtimeControl.canContinuePolling) {
    return 'polling'
  }
  if (status === 'processing') {
    return 'generating'
  }
  if (status === 'success') {
    return 'result_ready'
  }
  if (status === 'failed' || status === 'timeout') {
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
    taskType: 'model_replace',
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
    status: 'draft',
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
