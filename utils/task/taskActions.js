import { getMainChainState, patchMainChainState } from '../mainChainState'
import { generateResult } from '../api/generate'
import { queryTaskResult } from '../api/task'
import { TASK_STATUS, TASK_TYPES } from '../constants'
import { createDraftTaskFromLegacyState, mapLegacyStateToTaskEntity } from './taskMapper'
import { appendTaskToProject } from '../service/projectStore'
import { appendBatchLog, appendTaskToBatch, getBatchAssets, getBatchById, markBatchAssetsOrchestrated, setBatchRuntimeState, updateBatch } from '../service/batchStore'
import { syncAdminBatchToCloud } from '../service/adminRepository'
import { createTaskEntity } from './taskFactory'
import { GENERATION_STATUSES, normalizeGenerationStatus } from './generationContract'

const LEGACY_PARAM_FIELD_MAP = {
  modelType: 'modelType',
  body: 'bodyType',
  kidsAge: 'kidsAgeGroup',
  styleTag: 'styleTag',
  scene: 'sceneType',
  neck: 'neckType',
  sleeve: 'sleeveType',
  fit: 'fitType'
}

const LEGACY_OPTION_FIELD_MAP = {
  bg: 'backgroundType',
  output: 'outputType'
}

const STOP_WRITING_LEGACY_INPUT_FIELDS = [
  'currentStep',
  'modelType',
  'body',
  'kidsAge',
  'styleTag',
  'scene',
  'neck',
  'sleeve',
  'fit',
  'bg',
  'output'
]

const STOP_WRITING_LEGACY_ASSET_FIELDS = [
  'clothImage',
  'styleImage',
  'resultImageUrl'
]

const STOP_WRITING_LEGACY_RUNTIME_FIELDS = [
  'generating',
  'taskStatus',
  'genText',
  'progress',
  'errorMessage',
  'generateError',
  'pollingError',
  'canContinuePolling',
  'lastTaskId'
]

function getRuntimeTask(state = {}) {
  const taskKey = state.currentTaskId || state.taskId || state.lastTaskId || ''
  const currentTask = taskKey && state.tasks && state.tasks.byId && state.tasks.byId[taskKey]
  return currentTask || state.draftTask || {}
}

function getRuntimeTaskError(state = {}) {
  return getRuntimeTask(state).error || {}
}

function getRuntimeTaskControl(state = {}) {
  return getRuntimeTask(state).control || {}
}

function mergeLegacyState(state, patch = {}) {
  const nextState = {
    ...state,
    ...patch
  }

  if (patch.clothImage || patch.styleImage) {
    nextState.clothImage = patch.clothImage ? { ...state.clothImage, ...patch.clothImage } : state.clothImage
    nextState.styleImage = patch.styleImage ? { ...state.styleImage, ...patch.styleImage } : state.styleImage
  }

  if (patch.uiState) {
    nextState.uiState = {
      ...state.uiState,
      ...patch.uiState
    }
  }

  return nextState
}

function buildDraftTaskPatchFromLegacyPatch(patch = {}, currentState) {
  const currentDraftTask = currentState.draftTask || {}
  const currentInput = currentDraftTask.input || {}
  const currentAssets = currentInput.assets || {}
  const currentParams = currentInput.params || {}
  const currentOptions = currentInput.options || {}
  const currentResult = currentDraftTask.result || {}
  const currentError = currentDraftTask.error || {}
  const currentControl = currentDraftTask.control || {}

  const nextAssets = {
    ...currentAssets
  }
  const nextParams = {
    ...currentParams
  }

  const nextOptions = {
    ...currentOptions
  }

  let hasAssetPatch = false
  let hasParamPatch = false
  let hasOptionPatch = false

  if (Object.prototype.hasOwnProperty.call(patch, 'clothImage')) {
    nextAssets.clothImage = {
      ...(currentAssets.clothImage || {}),
      ...(patch.clothImage || {})
    }
    hasAssetPatch = true
  }

  if (Object.prototype.hasOwnProperty.call(patch, 'styleImage')) {
    nextAssets.styleImage = {
      ...(currentAssets.styleImage || {}),
      ...(patch.styleImage || {})
    }
    hasAssetPatch = true
  }

  Object.keys(LEGACY_PARAM_FIELD_MAP).forEach((legacyKey) => {
    if (Object.prototype.hasOwnProperty.call(patch, legacyKey)) {
      nextParams[LEGACY_PARAM_FIELD_MAP[legacyKey]] = patch[legacyKey]
      hasParamPatch = true
    }
  })

  Object.keys(LEGACY_OPTION_FIELD_MAP).forEach((legacyKey) => {
    if (Object.prototype.hasOwnProperty.call(patch, legacyKey)) {
      nextOptions[LEGACY_OPTION_FIELD_MAP[legacyKey]] = patch[legacyKey]
      hasOptionPatch = true
    }
  })

  return {
    projectId: Object.prototype.hasOwnProperty.call(patch, 'projectId')
      ? patch.projectId || ''
      : currentDraftTask.projectId || '',
    batchId: Object.prototype.hasOwnProperty.call(patch, 'batchId')
      ? patch.batchId || ''
      : currentDraftTask.batchId || '',
    input: {
      ...currentInput,
      assets: hasAssetPatch ? nextAssets : currentAssets,
      params: hasParamPatch ? nextParams : currentParams,
      options: hasOptionPatch ? nextOptions : currentOptions
    },
    result: Object.prototype.hasOwnProperty.call(patch, 'resultImageUrl')
      ? {
          ...currentResult,
          coverUrl: patch.resultImageUrl || '',
          items: patch.resultImageUrl
            ? [
                {
                  resultId: currentState.taskId ? `${currentState.taskId}_result_1` : '',
                  fileId: '',
                  fileUrl: patch.resultImageUrl,
                  type: 'image'
                }
              ]
            : []
        }
      : currentResult,
    status: mapRuntimeStatus(patch, currentDraftTask),
    stage: mapRuntimeStage(patch, currentDraftTask),
    progress: typeof patch.progress === 'number' ? patch.progress : currentDraftTask.progress,
    statusText: Object.prototype.hasOwnProperty.call(patch, 'genText')
      ? patch.genText || ''
      : currentDraftTask.statusText,
    error: buildRuntimeErrorPatch(patch, currentError, currentState),
    control: buildRuntimeControlPatch(patch, currentControl, currentState)
  }
}

function buildTaskEntityPatchFromLegacyPatch(patch = {}, currentState) {
  const taskKey = patch.taskId || patch.lastTaskId || currentState.taskId || currentState.lastTaskId || currentState.currentTaskId || ''
  if (!taskKey) {
    return null
  }

  const currentTask = (currentState.tasks && currentState.tasks.byId && currentState.tasks.byId[taskKey]) || {}
  const currentTaskInput = currentTask.input || {}
  const currentTaskAssets = currentTaskInput.assets || {}
  const currentTaskResult = currentTask.result || {}
  const currentTaskError = currentTask.error || {}
  const currentTaskControl = currentTask.control || {}

  const taskPatch = {}

  if (Object.prototype.hasOwnProperty.call(patch, 'projectId')) {
    taskPatch.projectId = patch.projectId || ''
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'batchId')) {
    taskPatch.batchId = patch.batchId || ''
  }

  if (Object.prototype.hasOwnProperty.call(patch, 'clothImage') || Object.prototype.hasOwnProperty.call(patch, 'styleImage')) {
    taskPatch.input = {
      ...currentTaskInput,
      assets: {
        ...currentTaskAssets,
        clothImage: Object.prototype.hasOwnProperty.call(patch, 'clothImage')
          ? {
              ...(currentTaskAssets.clothImage || {}),
              ...(patch.clothImage || {})
            }
          : currentTaskAssets.clothImage,
        styleImage: Object.prototype.hasOwnProperty.call(patch, 'styleImage')
          ? {
              ...(currentTaskAssets.styleImage || {}),
              ...(patch.styleImage || {})
            }
          : currentTaskAssets.styleImage
      }
    }
  }

  if (Object.prototype.hasOwnProperty.call(patch, 'resultImageUrl')) {
    taskPatch.result = {
      ...currentTaskResult,
      coverUrl: patch.resultImageUrl || '',
      items: patch.resultImageUrl
        ? [
            {
              resultId: taskKey ? `${taskKey}_result_1` : '',
              fileId: '',
              fileUrl: patch.resultImageUrl,
              type: 'image'
            }
          ]
        : []
    }
  }

  taskPatch.status = mapRuntimeStatus(patch, currentTask)
  taskPatch.stage = mapRuntimeStage(patch, currentTask)
  taskPatch.progress = typeof patch.progress === 'number' ? patch.progress : currentTask.progress
  taskPatch.statusText = Object.prototype.hasOwnProperty.call(patch, 'genText')
    ? patch.genText || ''
    : currentTask.statusText
  taskPatch.error = buildRuntimeErrorPatch(patch, currentTaskError, currentState)
  taskPatch.control = buildRuntimeControlPatch(patch, currentTaskControl, currentState)

  return taskPatch
}

function buildUiStatePatchFromLegacyPatch(patch = {}, currentState) {
  const currentUiState = currentState.uiState || {}
  if (!Object.prototype.hasOwnProperty.call(patch, 'currentStep')) {
    return currentUiState
  }

  return {
    ...currentUiState,
    currentStep: patch.currentStep
  }
}

function omitStoppedLegacyInputFields(patch = {}) {
  const nextPatch = {
    ...patch
  }

  STOP_WRITING_LEGACY_INPUT_FIELDS.forEach((field) => {
    if (Object.prototype.hasOwnProperty.call(nextPatch, field)) {
      delete nextPatch[field]
    }
  })

  return nextPatch
}

function omitStoppedLegacyAssetFields(patch = {}) {
  const nextPatch = {
    ...patch
  }

  STOP_WRITING_LEGACY_ASSET_FIELDS.forEach((field) => {
    if (Object.prototype.hasOwnProperty.call(nextPatch, field)) {
      delete nextPatch[field]
    }
  })

  return nextPatch
}

function omitStoppedLegacyRuntimeFields(patch = {}) {
  const nextPatch = {
    ...patch
  }

  STOP_WRITING_LEGACY_RUNTIME_FIELDS.forEach((field) => {
    if (Object.prototype.hasOwnProperty.call(nextPatch, field)) {
      delete nextPatch[field]
    }
  })

  return nextPatch
}

function omitStructuredTaskPatchFields(patch = {}) {
  const nextPatch = {
    ...patch
  }

  delete nextPatch.taskError
  delete nextPatch.taskControl
  delete nextPatch.projectId
  delete nextPatch.batchId

  return nextPatch
}

function normalizeLegacyTaskStatus(status, fallbackStatus) {
  if (status === 'submitting') {
    return TASK_STATUS.SUBMITTED
  }
  if (status === 'error') {
    return TASK_STATUS.FAILED
  }
  return status || fallbackStatus || TASK_STATUS.DRAFT
}

function mapRuntimeStatus(patch = {}, currentTask = {}) {
  const fallbackStatus = currentTask.status || TASK_STATUS.DRAFT

  if (Object.prototype.hasOwnProperty.call(patch, 'taskStatus')) {
    return normalizeLegacyTaskStatus(patch.taskStatus, fallbackStatus)
  }

  if (Object.prototype.hasOwnProperty.call(patch, 'generating')) {
    return patch.generating ? TASK_STATUS.PROCESSING : fallbackStatus
  }

  return fallbackStatus
}

function mapRuntimeStage(patch = {}, currentTask = {}) {
  const currentControl = currentTask.control || {}
  const currentUploading = currentControl.uploading || {}
  const taskControlPatch = patch.taskControl || {}
  const nextUploading = Object.prototype.hasOwnProperty.call(taskControlPatch, 'uploading')
    ? {
        ...currentUploading,
        ...(taskControlPatch.uploading || {})
      }
    : currentUploading

  if (nextUploading.clothImage || nextUploading.styleImage) {
    return 'uploading'
  }

  const status = mapRuntimeStatus(patch, currentTask)
  const canContinuePolling = Object.prototype.hasOwnProperty.call(taskControlPatch, 'canContinuePolling')
    ? !!taskControlPatch.canContinuePolling
    : Object.prototype.hasOwnProperty.call(patch, 'canContinuePolling')
      ? !!patch.canContinuePolling
      : !!currentControl.canContinuePolling

  if (status === TASK_STATUS.SUBMITTED) {
    return 'submitting'
  }
  if (status === TASK_STATUS.QUEUED) {
    return TASK_STATUS.QUEUED
  }
  if (status === TASK_STATUS.PROCESSING && canContinuePolling) {
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
  return currentTask.stage || 'editing'
}

function buildRuntimeErrorPatch(patch = {}, currentError = {}, currentState) {
  const taskErrorPatch = patch.taskError || {}
  const taskErrorDetailsPatch = taskErrorPatch.details || {}
  const currentDetails = currentError.details || {}
  const currentUploadDetails = currentDetails.upload || {}
  const runtimeError = getRuntimeTaskError(currentState)
  const runtimeErrorDetails = runtimeError.details || {}
  const fallbackUploadError = runtimeErrorDetails.upload || {}
  const fallbackGenerateError = runtimeErrorDetails.generate || ''
  const fallbackPollingError = runtimeErrorDetails.polling || ''
  const fallbackMessage = runtimeError.message || currentError.message || ''

  const uploadPatch = Object.prototype.hasOwnProperty.call(taskErrorDetailsPatch, 'upload')
    ? taskErrorDetailsPatch.upload || {}
    : {}
  const clothUploadError = Object.prototype.hasOwnProperty.call(uploadPatch, 'clothImage')
    ? uploadPatch.clothImage || ''
    : currentUploadDetails.clothImage || fallbackUploadError.clothImage || ''
  const styleUploadError = Object.prototype.hasOwnProperty.call(uploadPatch, 'styleImage')
    ? uploadPatch.styleImage || ''
    : currentUploadDetails.styleImage || fallbackUploadError.styleImage || ''
  const generateError = Object.prototype.hasOwnProperty.call(patch, 'generateError')
    ? patch.generateError || ''
    : Object.prototype.hasOwnProperty.call(taskErrorDetailsPatch, 'generate')
      ? taskErrorDetailsPatch.generate || ''
    : currentDetails.generate || fallbackGenerateError
  const pollingError = Object.prototype.hasOwnProperty.call(patch, 'pollingError')
    ? patch.pollingError || ''
    : Object.prototype.hasOwnProperty.call(taskErrorDetailsPatch, 'polling')
      ? taskErrorDetailsPatch.polling || ''
    : currentDetails.polling || fallbackPollingError
  const generalError = Object.prototype.hasOwnProperty.call(taskErrorPatch, 'message')
    ? taskErrorPatch.message || ''
    : Object.prototype.hasOwnProperty.call(patch, 'errorMessage')
      ? patch.errorMessage || ''
    : fallbackMessage

  let type = Object.prototype.hasOwnProperty.call(taskErrorPatch, 'type')
    ? taskErrorPatch.type || ''
    : currentError.type || ''
  if (clothUploadError || styleUploadError) {
    type = 'upload'
  } else if (generateError) {
    type = 'generate'
  } else if (pollingError) {
    type = 'polling'
  } else if (generalError) {
    type = 'unknown'
  } else if (
    Object.prototype.hasOwnProperty.call(taskErrorPatch, 'message') ||
    Object.prototype.hasOwnProperty.call(taskErrorPatch, 'type') ||
    Object.prototype.hasOwnProperty.call(taskErrorPatch, 'retryable') ||
    Object.prototype.hasOwnProperty.call(taskErrorDetailsPatch, 'upload') ||
    Object.prototype.hasOwnProperty.call(taskErrorDetailsPatch, 'generate') ||
    Object.prototype.hasOwnProperty.call(taskErrorDetailsPatch, 'polling') ||
    Object.prototype.hasOwnProperty.call(patch, 'errorMessage') ||
    Object.prototype.hasOwnProperty.call(patch, 'generateError') ||
    Object.prototype.hasOwnProperty.call(patch, 'pollingError')
  ) {
    type = ''
  }

  const message = clothUploadError || styleUploadError || generateError || pollingError || generalError || ''
  const runtimeControl = getRuntimeTaskControl(currentState)
  const taskControlPatch = patch.taskControl || {}
  const retryState = Object.prototype.hasOwnProperty.call(taskControlPatch, 'retryState')
    ? {
        ...((runtimeControl.retryState || {})),
        ...(taskControlPatch.retryState || {})
      }
    : (runtimeControl.retryState || {})

  return {
    ...currentError,
    type,
    code: Object.prototype.hasOwnProperty.call(taskErrorPatch, 'code')
      ? taskErrorPatch.code || ''
      : currentError.code || '',
    message,
    retryable: Object.prototype.hasOwnProperty.call(taskErrorPatch, 'retryable')
      ? !!taskErrorPatch.retryable
      : !!(retryState.clothImage || retryState.styleImage || retryState.generate || retryState.polling),
    details: {
      ...currentDetails,
      upload: {
        ...currentUploadDetails,
        clothImage: clothUploadError,
        styleImage: styleUploadError
      },
      generate: generateError,
      polling: pollingError
    }
  }
}

function buildRuntimeControlPatch(patch = {}, currentControl = {}, currentState) {
  const taskControlPatch = patch.taskControl || {}
  const currentRetryState = currentControl.retryState || {}
  const currentUploading = currentControl.uploading || {}
  const nextRetryState = Object.prototype.hasOwnProperty.call(taskControlPatch, 'retryState')
    ? {
        ...currentRetryState,
        ...(taskControlPatch.retryState || {})
      }
    : currentRetryState
  const nextUploading = Object.prototype.hasOwnProperty.call(taskControlPatch, 'uploading')
    ? {
        ...currentUploading,
        ...(taskControlPatch.uploading || {})
      }
    : currentUploading

  return {
    ...currentControl,
    ...taskControlPatch,
    canRetry: Object.prototype.hasOwnProperty.call(taskControlPatch, 'canRetry')
      ? !!taskControlPatch.canRetry
      : !!(nextRetryState.clothImage || nextRetryState.styleImage || nextRetryState.generate || nextRetryState.polling),
    canContinuePolling: Object.prototype.hasOwnProperty.call(taskControlPatch, 'canContinuePolling')
      ? !!taskControlPatch.canContinuePolling
      : Object.prototype.hasOwnProperty.call(patch, 'canContinuePolling')
      ? !!patch.canContinuePolling
      : !!currentControl.canContinuePolling,
    lastTaskId: Object.prototype.hasOwnProperty.call(taskControlPatch, 'lastTaskId')
      ? taskControlPatch.lastTaskId || ''
      : Object.prototype.hasOwnProperty.call(patch, 'lastTaskId')
      ? patch.lastTaskId || ''
      : (currentControl.lastTaskId || currentState.lastTaskId || ''),
    pollingCount: currentControl.pollingCount || 0,
    maxPollingCount: currentControl.maxPollingCount || 10,
    retryState: nextRetryState,
    uploading: nextUploading
  }
}

function buildTaskStructures(nextLegacyState, currentState, nextDraftTask, nextUiState, taskEntityPatch) {
  const taskKey =
    nextLegacyState.taskId ||
    nextLegacyState.lastTaskId ||
    nextLegacyState.currentTaskId ||
    currentState.currentTaskId ||
    ''
  const nextTasks = {
    byId: { ...((currentState.tasks && currentState.tasks.byId) || {}) },
    allIds: Array.isArray(currentState.tasks && currentState.tasks.allIds) ? [...currentState.tasks.allIds] : []
  }

  if (taskKey) {
    const mappedTaskEntity = mapLegacyStateToTaskEntity(nextLegacyState)
    nextTasks.byId[taskKey] = createTaskEntity({
      ...mappedTaskEntity,
      ...(taskEntityPatch || {}),
      input: {
        ...((mappedTaskEntity && mappedTaskEntity.input) || {}),
        ...((taskEntityPatch && taskEntityPatch.input) || {}),
        assets: {
          ...(((mappedTaskEntity && mappedTaskEntity.input && mappedTaskEntity.input.assets) || {})),
          ...((taskEntityPatch && taskEntityPatch.input && taskEntityPatch.input.assets) || {})
        }
      },
      result: {
        ...(((mappedTaskEntity && mappedTaskEntity.result) || {})),
        ...((taskEntityPatch && taskEntityPatch.result) || {})
      },
      error: {
        ...(((mappedTaskEntity && mappedTaskEntity.error) || {})),
        ...((taskEntityPatch && taskEntityPatch.error) || {}),
        details: {
          ...((((mappedTaskEntity && mappedTaskEntity.error) || {}).details || {})),
          ...((((taskEntityPatch && taskEntityPatch.error) || {}).details || {})),
          upload: {
            ...(((((mappedTaskEntity && mappedTaskEntity.error) || {}).details || {}).upload || {})),
            ...((((((taskEntityPatch && taskEntityPatch.error) || {}).details || {}).upload) || {}))
          }
        }
      },
      control: {
        ...(((mappedTaskEntity && mappedTaskEntity.control) || {})),
        ...((taskEntityPatch && taskEntityPatch.control) || {}),
        retryState: {
          ...((((mappedTaskEntity && mappedTaskEntity.control) || {}).retryState || {})),
          ...((((taskEntityPatch && taskEntityPatch.control) || {}).retryState || {}))
        },
        uploading: {
          ...((((mappedTaskEntity && mappedTaskEntity.control) || {}).uploading || {})),
          ...((((taskEntityPatch && taskEntityPatch.control) || {}).uploading || {}))
        }
      }
    })
    if (!nextTasks.allIds.includes(taskKey)) {
      nextTasks.allIds.unshift(taskKey)
    }
  }

  return {
    currentTaskId: taskKey || currentState.currentTaskId || '',
    draftTask: nextDraftTask || createDraftTaskFromLegacyState(nextLegacyState),
    tasks: nextTasks,
    uiState: nextUiState || {
      ...((currentState.uiState || {})),
      currentStep:
        typeof nextLegacyState.currentStep === 'number'
          ? nextLegacyState.currentStep
          : (currentState.uiState && currentState.uiState.currentStep) || 1
    }
  }
}

export function syncDraftTaskToState(legacyPatch = {}) {
  const currentState = getMainChainState()
  const legacyPatchWithoutStoppedInputFields = omitStoppedLegacyInputFields(legacyPatch)
  const legacyPatchWithoutStoppedAssetFields = omitStoppedLegacyAssetFields(legacyPatchWithoutStoppedInputFields)
  const filteredLegacyPatch = omitStoppedLegacyRuntimeFields(legacyPatchWithoutStoppedAssetFields)
  const filteredPatch = omitStructuredTaskPatchFields(filteredLegacyPatch)
  const nextLegacyState = mergeLegacyState(currentState, filteredPatch)
  const draftTaskPatch = buildDraftTaskPatchFromLegacyPatch(legacyPatch, currentState)
  const nextDraftTask = {
    ...(currentState.draftTask || {}),
    ...draftTaskPatch,
    input: {
      ...((currentState.draftTask && currentState.draftTask.input) || {}),
      ...((draftTaskPatch && draftTaskPatch.input) || {}),
      params: {
        ...((currentState.draftTask && currentState.draftTask.input && currentState.draftTask.input.params) || {}),
        ...((draftTaskPatch &&
          draftTaskPatch.input &&
          draftTaskPatch.input.params) || {})
      },
      options: {
        ...((currentState.draftTask && currentState.draftTask.input && currentState.draftTask.input.options) || {}),
        ...((draftTaskPatch &&
          draftTaskPatch.input &&
          draftTaskPatch.input.options) || {})
      }
    },
    result: {
      ...((currentState.draftTask && currentState.draftTask.result) || {}),
      ...((draftTaskPatch && draftTaskPatch.result) || {})
    },
    error: {
      ...((currentState.draftTask && currentState.draftTask.error) || {}),
      ...((draftTaskPatch && draftTaskPatch.error) || {}),
      details: {
        ...((((currentState.draftTask && currentState.draftTask.error) || {}).details || {})),
        ...((((draftTaskPatch && draftTaskPatch.error) || {}).details || {})),
        upload: {
          ...((((((currentState.draftTask && currentState.draftTask.error) || {}).details || {}).upload) || {})),
          ...((((((draftTaskPatch && draftTaskPatch.error) || {}).details || {}).upload) || {}))
        }
      }
    },
    control: {
      ...((currentState.draftTask && currentState.draftTask.control) || {}),
      ...((draftTaskPatch && draftTaskPatch.control) || {}),
      retryState: {
        ...((((currentState.draftTask && currentState.draftTask.control) || {}).retryState || {})),
        ...((((draftTaskPatch && draftTaskPatch.control) || {}).retryState || {}))
      },
      uploading: {
        ...((((currentState.draftTask && currentState.draftTask.control) || {}).uploading || {})),
        ...((((draftTaskPatch && draftTaskPatch.control) || {}).uploading || {}))
      }
    }
  }
  const nextUiState = buildUiStatePatchFromLegacyPatch(legacyPatch, currentState)
  const taskEntityPatch = buildTaskEntityPatchFromLegacyPatch(legacyPatch, currentState)
  const taskStructures = buildTaskStructures(nextLegacyState, currentState, nextDraftTask, nextUiState, taskEntityPatch)

  return patchMainChainState({
    ...filteredPatch,
    ...taskStructures
  })
}

export function updateTaskStatus(statusPatch = {}) {
  return syncDraftTaskToState(statusPatch)
}

export function mergeTaskResult(resultPatch = {}) {
  return syncDraftTaskToState(resultPatch)
}

function createBatchDraftTaskId(batchId, assetId) {
  const safeBatchId = String(batchId || 'batch').replace(/[^a-zA-Z0-9_-]/g, '')
  const safeAssetId = String(assetId || 'asset').replace(/[^a-zA-Z0-9_-]/g, '')
  return `draft_${safeBatchId}_${safeAssetId}`
}

export function orchestrateBatchTasks(batchId, options = {}) {
  if (!batchId) {
    throw new Error('Batch ID is required')
  }

  const state = getMainChainState()
  const batch = getBatchById(batchId)
  const assets = getBatchAssets(batchId)
  const byId = { ...((state.tasks && state.tasks.byId) || {}) }
  const allIds = Array.isArray(state.tasks && state.tasks.allIds) ? [...state.tasks.allIds] : []

  if (!batch) {
    throw new Error('Batch not found')
  }

  if (!assets.length) {
    return {
      createdTaskIds: [],
      skippedAssetIds: [],
      totalAssets: 0
    }
  }

  const draftTask = state.draftTask || {}
  const draftInput = draftTask.input || {}
  const draftAssets = draftInput.assets || {}
  const defaultStyleImage = draftAssets.styleImage || {}
  const defaultParams = draftInput.params || {}
  const defaultOptions = draftInput.options || {}
  const projectId = options.projectId || batch.projectId || draftTask.projectId || ''

  const existingByAssetId = new Set()
  const existingByLocalPath = new Set()
  Object.keys(byId).forEach((taskId) => {
    const task = byId[taskId]
    if (!task || task.batchId !== batchId) {
      return
    }
    const clothImage = (((task.input || {}).assets || {}).clothImage) || {}
    if (clothImage.assetId) {
      existingByAssetId.add(clothImage.assetId)
    }
    if (clothImage.localPath) {
      existingByLocalPath.add(clothImage.localPath)
    }
  })

  const createdTaskIds = []
  const createdAssetIds = []
  const skippedAssetIds = []

  assets.forEach((asset, index) => {
    const assetId = asset && asset.assetId
    const localPath = asset && asset.localPath
    const isDuplicate = (assetId && existingByAssetId.has(assetId)) || (localPath && existingByLocalPath.has(localPath))

    if (isDuplicate) {
      if (assetId) {
        skippedAssetIds.push(assetId)
      }
      return
    }

    const taskId = createBatchDraftTaskId(batchId, assetId || `${Date.now()}_${index}`)
    const now = new Date().toISOString()
    const task = createTaskEntity({
      taskId,
      source: 'batch_orchestration',
      taskType: draftTask.taskType || TASK_TYPES.MODEL_REPLACE,
      projectId,
      batchId,
      input: {
        assets: {
          clothImage: buildTaskAssetFromBatchAsset(asset, assetId),
          styleImage: {
            ...(defaultStyleImage || {})
          }
        },
        params: {
          ...(defaultParams || {})
        },
        options: {
          ...(defaultOptions || {})
        }
      },
      status: TASK_STATUS.DRAFT,
      stage: 'editing',
      progress: 0,
      statusText: 'Batch task drafted',
      createdAt: now,
      updatedAt: now
    })

    byId[taskId] = task
    if (!allIds.includes(taskId)) {
      allIds.unshift(taskId)
    }
    createdTaskIds.push(taskId)
    if (assetId) {
      createdAssetIds.push(assetId)
    }
    if (assetId) {
      existingByAssetId.add(assetId)
    }
    if (localPath) {
      existingByLocalPath.add(localPath)
    }
  })

  if (createdTaskIds.length) {
    patchMainChainState({
      tasks: {
        byId,
        allIds
      }
    })

    createdTaskIds.forEach((taskId) => {
      appendTaskToBatch(batchId, taskId)
    })

    if (createdAssetIds.length) {
      markBatchAssetsOrchestrated(batchId, createdAssetIds)
    }
  }

  return {
    createdTaskIds,
    skippedAssetIds,
    totalAssets: assets.length
  }
}

const BATCH_RUNNING_STATUS_SET = new Set([TASK_STATUS.SUBMITTED, TASK_STATUS.QUEUED, TASK_STATUS.PROCESSING])
const BATCH_FINISHED_STATUS_SET = new Set([TASK_STATUS.SUCCESS])
const BATCH_FAILED_STATUS_SET = new Set([TASK_STATUS.FAILED, 'error', TASK_STATUS.TIMEOUT])
const ACTIVE_BATCH_RUNNER_SET = new Set()
const DEFAULT_BATCH_POLL_INTERVAL_MS = 3000
const DEFAULT_BATCH_MAX_POLL_COUNT = 10

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

function getStableAssetFileId(asset = {}) {
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
  return candidates.find((value) => isCloudFileId(value)) || ''
}

function isHttpsUrl(value) {
  return /^https:\/\//.test(String(value || ''))
}

function isCloudFileId(value) {
  return /^cloud:\/\//.test(String(value || ''))
}

function getStableAssetFileUrl(asset = {}) {
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
  return candidates.find((value) => isHttpsUrl(value)) || ''
}

function buildTaskAssetFromBatchAsset(asset = {}, assetId = '') {
  const localPath = asset.localPath || asset.tempFilePath || asset.path || ''
  const fileId = getStableAssetFileId(asset)
  const fileUrl = getStableAssetFileUrl(asset)
  const imageUrl = asset.imageUrl || asset.image_url || fileUrl
  const url = asset.url && isHttpsUrl(asset.url) ? asset.url : fileUrl

  return {
    ...(asset || {}),
    localPath,
    tempFilePath: asset.tempFilePath || '',
    path: asset.path || '',
    fileId,
    file_id: fileId,
    fileUrl,
    file_url: fileUrl,
    imageUrl,
    image_url: imageUrl,
    url,
    assetId: assetId || asset.assetId || ''
  }
}

function summarizeAssetRemoteFields(asset = {}) {
  const fileId = getStableAssetFileId(asset)
  const fileUrl = getStableAssetFileUrl(asset)
  const localPath = asset.localPath || asset.tempFilePath || asset.path || ''
  return {
    hasLocalPath: !!localPath,
    hasFileId: !!fileId,
    hasFileUrl: !!fileUrl,
    hasHttpsUrl: isHttpsUrl(fileUrl),
    hasCloudFileId: isCloudFileId(fileId)
  }
}

function buildGeneratePayloadFromTask(task = {}) {
  const input = task.input || {}
  const assets = input.assets || {}
  const params = input.params || {}
  const options = input.options || {}
  const clothImage = assets.clothImage || {}
  const styleImage = assets.styleImage || {}

  return {
    projectId: task.projectId || '',
    batchId: task.batchId || '',
    cloth_image: {
      file_id: getStableAssetFileId(clothImage),
      file_url: getStableAssetFileUrl(clothImage)
    },
    style_image: {
      file_id: getStableAssetFileId(styleImage),
      file_url: getStableAssetFileUrl(styleImage)
    },
    modelType: params.modelType || 'female',
    body: params.bodyType || 'normal',
    kidsAge: params.kidsAgeGroup || 'middle',
    styleTag: params.styleTag || 'simple',
    scene: params.sceneType || 'white',
    neck: params.neckType || 'round',
    sleeve: params.sleeveType || 'long',
    fit: params.fitType || 'loose',
    bg: options.backgroundType || 'normal',
    output: options.outputType || 'main'
  }
}

function getGenerateResultImageUrl(response = {}) {
  const payload = response || {}
  return (
    payload.resultImageUrl ||
    payload.result_image_url ||
    (payload.data && payload.data.resultImageUrl) ||
    (payload.data && payload.data.result_image_url) ||
    ''
  )
}

async function syncBatchAfterTaskSuccess(batchId, taskId) {
  console.log('[batch-run] sync batch after task success start', {
    batchId,
    taskId
  })
  try {
    const result = await syncAdminBatchToCloud(batchId)
    console.log('[batch-run] sync batch after task success done', {
      batchId,
      taskId,
      success: !!result
    })
  } catch (error) {
    console.warn('[batch-run] sync batch after task success failed', {
      batchId,
      taskId,
      message: (error && error.message) || 'unknown'
    })
  }
}

function countBatchTaskStatuses(taskIds = []) {
  const state = getMainChainState()
  const byId = (state.tasks && state.tasks.byId) || {}
  const counts = {
    successCount: 0,
    failedCount: 0,
    runningCount: 0,
    pendingCount: 0,
    totalCount: 0
  }

  taskIds.forEach((taskId) => {
    const task = byId[taskId]
    counts.totalCount += 1
    if (!task) {
      counts.pendingCount += 1
      return
    }

    const status = normalizeGenerationStatus(task.status || '')
    if (status === GENERATION_STATUSES.COMPLETED) {
      counts.successCount += 1
      return
    }
    if (BATCH_FAILED_STATUS_SET.has(status)) {
      counts.failedCount += 1
      return
    }
    if (BATCH_RUNNING_STATUS_SET.has(status)) {
      counts.runningCount += 1
      return
    }
    counts.pendingCount += 1
  })

  return counts
}

export async function normalizeBatchStatus(batchId) {
  if (!batchId) {
    return null
  }

  const batch = getBatchById(batchId)
  if (!batch) {
    console.warn('[batch-status] evaluate skipped', {
      batchId,
      reason: 'batch_not_found'
    })
    return null
  }

  const taskIds = Array.isArray(batch.taskIds) ? batch.taskIds.filter(Boolean) : []
  const currentBatchStatus = batch.status || 'draft'
  const counts = countBatchTaskStatuses(taskIds)

  console.log('[batch-status] evaluate start', {
    batchId,
    taskIdsCount: taskIds.length,
    taskCount: counts.totalCount,
    currentBatchStatus
  })

  let nextBatchStatus = currentBatchStatus
  if (counts.totalCount > 0 && counts.successCount === counts.totalCount) {
    nextBatchStatus = 'completed'
  } else if (counts.totalCount > 0 && counts.failedCount === counts.totalCount) {
    nextBatchStatus = 'failed'
  }

  console.log('[batch-status] evaluate result', {
    batchId,
    nextBatchStatus,
    successCount: counts.successCount,
    failedCount: counts.failedCount,
    runningCount: counts.runningCount,
    pendingCount: counts.pendingCount,
    totalCount: counts.totalCount
  })

  if (nextBatchStatus === currentBatchStatus) {
    return {
      batchId,
      changed: false,
      oldStatus: currentBatchStatus,
      newStatus: nextBatchStatus,
      counts
    }
  }

  const now = new Date().toISOString()
  const updatedBatch = updateBatch(batchId, {
    status: nextBatchStatus,
    updatedAt: now,
    completedAt: nextBatchStatus === 'completed' ? now : batch.completedAt
  })

  console.log('[batch-status] update', {
    batchId,
    oldStatus: currentBatchStatus,
    newStatus: nextBatchStatus
  })

  try {
    const syncResult = await syncAdminBatchToCloud(batchId)
    console.log('[batch-status] sync done', {
      batchId,
      success: !!syncResult
    })
  } catch (error) {
    console.warn('[batch-status] sync failed', {
      batchId,
      message: (error && error.message) || 'unknown'
    })
  }

  return {
    batchId,
    changed: true,
    oldStatus: currentBatchStatus,
    newStatus: nextBatchStatus,
    batch: updatedBatch,
    counts
  }
}

function patchTaskEntityById(taskId, patch = {}) {
  if (!taskId) {
    return
  }

  const state = getMainChainState()
  const tasks = state.tasks || {}
  const byId = { ...(tasks.byId || {}) }
  const currentTask = byId[taskId]
  if (!currentTask) {
    return
  }

  byId[taskId] = createTaskEntity({
    ...currentTask,
    ...patch,
    result: {
      ...((currentTask && currentTask.result) || {}),
      ...((patch && patch.result) || {}),
      items: Array.isArray(patch && patch.result && patch.result.items)
        ? patch.result.items
        : ((currentTask && currentTask.result && currentTask.result.items) || []),
      meta: {
        ...(((currentTask && currentTask.result) || {}).meta || {}),
        ...((((patch && patch.result) || {}).meta) || {})
      }
    },
    control: {
      ...((currentTask && currentTask.control) || {}),
      ...((patch && patch.control) || {})
    },
    error: {
      ...((currentTask && currentTask.error) || {}),
      ...((patch && patch.error) || {})
    },
    updatedAt: new Date().toISOString()
  })

  const allIds = Array.isArray(tasks.allIds) ? [...tasks.allIds] : []
  if (!allIds.includes(taskId)) {
    allIds.unshift(taskId)
  }

  patchMainChainState({
    tasks: {
      byId,
      allIds
    }
  })

  return byId[taskId]
}

async function pollBatchGeneratedTaskResult(taskId, options = {}) {
  const pollIntervalMs = options.pollIntervalMs || DEFAULT_BATCH_POLL_INTERVAL_MS
  const maxPollCount = options.maxPollCount || DEFAULT_BATCH_MAX_POLL_COUNT
  let finalTaskResult = null

  for (let attempt = 0; attempt < maxPollCount; attempt += 1) {
    await sleep(pollIntervalMs)

    const taskResult = await queryTaskResult(taskId)
    finalTaskResult = taskResult
    const taskStatus = taskResult.taskStatus || TASK_STATUS.PROCESSING
    console.log('[batch-run] queryTaskResult poll', {
      pollCount: attempt + 1,
      serverTaskId: taskId,
      status: taskResult.status || taskStatus
    })

    if (taskResult.resultImageUrl) {
      return {
        status: TASK_STATUS.SUCCESS,
        reason: 'result_ready',
        taskResult
      }
    }

    if (taskStatus === TASK_STATUS.FAILED || taskStatus === 'error') {
      return {
        status: TASK_STATUS.FAILED,
        reason: 'task_failed',
        taskResult,
        errorMessage: taskResult.errorMessage || 'Batch run polling failed'
      }
    }

    if (taskStatus === TASK_STATUS.TIMEOUT) {
      return {
        status: TASK_STATUS.TIMEOUT,
        reason: 'timeout',
        taskResult,
        errorMessage: taskResult.errorMessage || 'Batch run polling timeout'
      }
    }
  }

  return {
    status: TASK_STATUS.TIMEOUT,
    reason: 'timeout',
    errorMessage: 'Batch run polling timeout',
    taskResult: finalTaskResult
  }
}

function updateTaskBatchRunInfo(taskId, batchId, patch = {}, options = {}) {
  if (!taskId) {
    return
  }

  const state = getMainChainState()
  const task = state.tasks && state.tasks.byId && state.tasks.byId[taskId]
  if (!task) {
    return
  }

  const currentInfo = task.batchRunInfo || {}
  const currentRetryCount = Number(currentInfo.retryCount || 0)
  const nextRetryCount = options.incrementRetry ? currentRetryCount + 1 : currentRetryCount
  const nextInfo = {
    taskId: currentInfo.taskId || taskId,
    batchId: currentInfo.batchId || batchId || task.batchId || '',
    lastRunAt: currentInfo.lastRunAt || '',
    retryCount: nextRetryCount,
    lastErrorType: currentInfo.lastErrorType || '',
    lastErrorMessage: currentInfo.lastErrorMessage || '',
    ...patch
  }

  patchTaskEntityById(taskId, {
    batchRunInfo: nextInfo
  })
}

function canRunBatchTask(task = {}) {
  if (!task || !task.taskId) {
    return false
  }
  if (BATCH_FINISHED_STATUS_SET.has(task.status)) {
    return false
  }
  if (BATCH_RUNNING_STATUS_SET.has(task.status)) {
    return false
  }
  return true
}

function canRetryFailedBatchTask(task = {}) {
  if (!task || !task.taskId) {
    return false
  }
  if (!BATCH_FAILED_STATUS_SET.has(task.status)) {
    return false
  }
  if (BATCH_FINISHED_STATUS_SET.has(task.status)) {
    return false
  }
  if (BATCH_RUNNING_STATUS_SET.has(task.status)) {
    return false
  }
  return true
}

export async function runBatchTasks(batchId, options = {}) {
  if (!batchId) {
    throw new Error('Batch ID is required')
  }

  const batch = getBatchById(batchId)
  if (!batch) {
    throw new Error('Batch not found')
  }

  const rawConcurrency = Number(options.concurrency || 2)
  const concurrency = Number.isFinite(rawConcurrency) ? Math.max(1, Math.min(3, Math.floor(rawConcurrency))) : 2
  if (ACTIVE_BATCH_RUNNER_SET.has(batchId)) {
    throw new Error('Batch is already running')
  }

  ACTIVE_BATCH_RUNNER_SET.add(batchId)
  setBatchRuntimeState(batchId, {
    state: 'running',
    running: true
  })
  appendBatchLog(batchId, {
    type: 'run',
    action: 'run_start',
    message: `Run batch started: concurrency ${concurrency}`,
    summary: `concurrency ${concurrency}`,
    meta: {
      concurrency
    }
  })

  const sourceTaskIds = Array.isArray(batch.taskIds) ? batch.taskIds : []
  console.log('[batch-run] start', {
    batchId,
    taskIds: sourceTaskIds,
    taskCount: sourceTaskIds.length
  })

  const summary = {
    totalTaskIds: sourceTaskIds.length,
    runnableTaskIds: [],
    triggeredTaskIds: [],
    succeededTaskIds: [],
    skipped: [],
    failed: [],
    concurrency
  }

  try {
    const runnableTasks = []
    for (let i = 0; i < sourceTaskIds.length; i += 1) {
      const sourceTaskId = sourceTaskIds[i]
      const currentState = getMainChainState()
      const task = currentState.tasks && currentState.tasks.byId && currentState.tasks.byId[sourceTaskId]
      console.log('[batch-run] inspect task', {
        taskId: sourceTaskId,
        taskStatus: task && task.status,
        taskStage: task && task.stage,
        taskDeliveryStatus: task && task.deliveryStatus
      })

      if (!task) {
        console.warn('[batch-run] task skipped', {
          batchId,
          taskId: sourceTaskId,
          reason: 'task_not_found',
          canRunStatuses: ['draft', 'pending', 'failed', 'timeout'],
          currentStatus: ''
        })
        summary.skipped.push({
          taskId: sourceTaskId,
          reason: 'task_not_found'
        })
        continue
      }

      if (!canRunBatchTask(task)) {
        console.warn('[batch-run] task skipped', {
          batchId,
          taskId: sourceTaskId,
          taskStatus: task.status || '',
          reason: `status_${task.status || 'unknown'}`,
          canRunStatuses: ['draft', 'pending', 'failed', 'timeout'],
          currentStatus: task.status || ''
        })
        summary.skipped.push({
          taskId: sourceTaskId,
          reason: `status_${task.status || 'unknown'}`
        })
        continue
      }

      const payload = buildGeneratePayloadFromTask(task)
      const missingPayloadFields = []
      if (!payload.cloth_image.file_id && !payload.cloth_image.file_url) {
        missingPayloadFields.push('cloth_image.file_id/file_url')
      }
      if (!payload.style_image.file_id && !payload.style_image.file_url) {
        missingPayloadFields.push('style_image.file_id/file_url')
      }
      if (!payload.scene) {
        missingPayloadFields.push('scene')
      }
      if (missingPayloadFields.length) {
        console.warn('[batch-run] payload missing fields', {
          batchId,
          taskId: sourceTaskId,
          missingFields: missingPayloadFields,
          scene: payload.scene,
          modelType: payload.modelType,
          clothImage: summarizeAssetRemoteFields((((task.input || {}).assets || {}).clothImage) || {}),
          styleImage: summarizeAssetRemoteFields((((task.input || {}).assets || {}).styleImage) || {})
        })
      }
      if (!payload.cloth_image.file_id && !payload.cloth_image.file_url) {
        console.warn('[batch-run] task skipped', {
          batchId,
          taskId: sourceTaskId,
          reason: 'missing_cloth_image',
          clothImage: summarizeAssetRemoteFields((((task.input || {}).assets || {}).clothImage) || {})
        })
        summary.skipped.push({
          taskId: sourceTaskId,
          reason: 'missing_cloth_image'
        })
        continue
      }

      summary.runnableTaskIds.push(sourceTaskId)
      runnableTasks.push({
        sourceTaskId,
        task,
        payload
      })
    }

    let cursor = 0
    const workers = new Array(Math.min(concurrency, runnableTasks.length)).fill(null).map(async () => {
      while (cursor < runnableTasks.length) {
        const index = cursor
        cursor += 1
        const item = runnableTasks[index]
        if (!item) {
          return
        }

        const sourceTaskId = item.sourceTaskId
        const task = item.task || {}
        const payload = item.payload

        patchTaskEntityById(sourceTaskId, {
          status: TASK_STATUS.SUBMITTED,
          stage: 'submitting',
          statusText: 'Batch run started',
          error: {
            type: '',
            code: '',
            message: '',
            retryable: false
          }
        })
        updateTaskBatchRunInfo(sourceTaskId, batchId, {
          lastRunAt: new Date().toISOString()
        })

        try {
          console.log('[batch-run] generateResult start', {
            batchId,
            taskId: sourceTaskId,
            taskStatus: task.status || '',
            scene: payload.scene,
            modelType: payload.modelType,
            clothImage: summarizeAssetRemoteFields((((task.input || {}).assets || {}).clothImage) || {}),
            styleImage: summarizeAssetRemoteFields((((task.input || {}).assets || {}).styleImage) || {}),
            inputKeys: Object.keys(payload || {}),
            clothImageKeys: Object.keys((payload && payload.cloth_image) || {}),
            styleImageKeys: Object.keys((payload && payload.style_image) || {})
          })
          const result = await generateResult(payload)
          const serverTaskId = result && result.taskId ? result.taskId : ''
          console.log('[batch-run] generateResult success', {
            batchId,
            taskId: sourceTaskId,
            response: result,
            resultImageUrl: result && result.resultImageUrl,
            serverTaskId
          })

          const resultImageUrl = getGenerateResultImageUrl(result)
          if (resultImageUrl) {
            const now = new Date().toISOString()
            const updatedTask = patchTaskEntityById(sourceTaskId, {
              status: TASK_STATUS.SUCCESS,
              stage: 'result_ready',
              progress: typeof result.progress === 'number' ? result.progress : 100,
              statusText: 'Batch run success',
              resultImageUrl,
              result: {
                coverUrl: resultImageUrl,
                outputType: (task.input && task.input.options && task.input.options.outputType) || payload.output || 'main',
                items: resultImageUrl
                  ? [
                      {
                        resultId: serverTaskId ? `${serverTaskId}_result_1` : `${sourceTaskId}_result_1`,
                        fileId: '',
                        fileUrl: resultImageUrl,
                        imageUrl: resultImageUrl,
                        type: 'image'
                      }
                    ]
                  : []
              },
              updatedAt: now,
              completedAt: now,
              control: {
                canContinuePolling: false,
                canRetry: false,
                lastTaskId: serverTaskId || sourceTaskId
              }
            })
            summary.triggeredTaskIds.push(sourceTaskId)
            summary.succeededTaskIds.push(sourceTaskId)
            updateTaskBatchRunInfo(sourceTaskId, batchId, {
              lastErrorType: '',
              lastErrorMessage: ''
            })
            console.log('[batch-run] task state updated', {
              batchId,
              taskId: sourceTaskId,
              status: updatedTask && updatedTask.status,
              stage: updatedTask && updatedTask.stage,
              resultImageUrl,
              progress: updatedTask && updatedTask.progress
            })
            await syncBatchAfterTaskSuccess(batchId, sourceTaskId)
            continue
          }

          const nextStatus = (result && result.taskStatus) || TASK_STATUS.QUEUED
          if (!serverTaskId) {
            patchTaskEntityById(sourceTaskId, {
              status: TASK_STATUS.FAILED,
              stage: 'error',
              statusText: 'Batch run failed',
              error: {
                type: 'generate',
                message: 'Batch run missing server taskId'
              },
              control: {
                canRetry: true,
                canContinuePolling: false,
                lastTaskId: sourceTaskId
              }
            })
            summary.failed.push({
              taskId: sourceTaskId,
              message: 'Batch run missing server taskId'
            })
            continue
          }

          if (nextStatus === TASK_STATUS.FAILED || nextStatus === 'error' || nextStatus === TASK_STATUS.TIMEOUT) {
            console.error('[batch-run] generateResult final failed', {
              taskId: sourceTaskId,
              serverTaskId,
              response: result
            })
            patchTaskEntityById(sourceTaskId, {
              status: TASK_STATUS.FAILED,
              stage: 'error',
              statusText: 'Batch run failed',
              error: {
                type: 'generate',
                message: (result && result.errorMessage) || 'Batch run failed'
              },
              control: {
                canRetry: true,
                canContinuePolling: false,
                lastTaskId: serverTaskId || sourceTaskId
              }
            })
            summary.failed.push({
              taskId: sourceTaskId,
              message: (result && result.errorMessage) || 'Batch run failed'
            })
            continue
          }

          patchTaskEntityById(sourceTaskId, {
            status: nextStatus === TASK_STATUS.PROCESSING ? TASK_STATUS.PROCESSING : TASK_STATUS.QUEUED,
            stage: nextStatus === TASK_STATUS.PROCESSING ? 'generating' : TASK_STATUS.QUEUED,
            progress: typeof result.progress === 'number' ? result.progress : 60,
            statusText: 'Batch run accepted',
            control: {
              canContinuePolling: true,
              canRetry: false,
              lastTaskId: serverTaskId || sourceTaskId
            }
          })
          summary.triggeredTaskIds.push(sourceTaskId)

          const polled = await pollBatchGeneratedTaskResult(serverTaskId, {
            pollIntervalMs: options.pollIntervalMs,
            maxPollCount: options.maxPollCount
          })

          const polledResultImageUrl = getGenerateResultImageUrl(polled.taskResult)
          if (polled.status === TASK_STATUS.SUCCESS && polledResultImageUrl) {
            const now = new Date().toISOString()
            const updatedTask = patchTaskEntityById(sourceTaskId, {
              status: TASK_STATUS.SUCCESS,
              stage: 'result_ready',
              progress: typeof polled.taskResult.progress === 'number' ? polled.taskResult.progress : 100,
              statusText: 'Batch run success',
              resultImageUrl: polledResultImageUrl,
              result: {
                coverUrl: polledResultImageUrl,
                outputType: (task.input && task.input.options && task.input.options.outputType) || payload.output || 'main',
                items: polledResultImageUrl
                  ? [
                      {
                        resultId: `${serverTaskId}_result_1`,
                        fileId: '',
                        fileUrl: polledResultImageUrl,
                        imageUrl: polledResultImageUrl,
                        type: 'image'
                      }
                    ]
                  : []
              },
              updatedAt: now,
              completedAt: now,
              control: {
                canContinuePolling: false,
                canRetry: false,
                lastTaskId: serverTaskId
              }
            })
            summary.succeededTaskIds.push(sourceTaskId)
            updateTaskBatchRunInfo(sourceTaskId, batchId, {
              lastErrorType: '',
              lastErrorMessage: ''
            })
            console.log('[batch-run] task state updated', {
              batchId,
              taskId: sourceTaskId,
              status: updatedTask && updatedTask.status,
              stage: updatedTask && updatedTask.stage,
              resultImageUrl: polledResultImageUrl,
              progress: updatedTask && updatedTask.progress
            })
            await syncBatchAfterTaskSuccess(batchId, sourceTaskId)
            continue
          }

          const failedStatus = polled.status === TASK_STATUS.TIMEOUT ? TASK_STATUS.TIMEOUT : TASK_STATUS.FAILED
          const failedMessage = polled.errorMessage || (polled.taskResult && polled.taskResult.errorMessage) || 'Batch run polling failed'
          console.error('[batch-run] polling final failed', {
            taskId: sourceTaskId,
            serverTaskId,
            response: polled.taskResult || polled
          })
          patchTaskEntityById(sourceTaskId, {
            status: failedStatus,
            stage: failedStatus === TASK_STATUS.TIMEOUT ? 'timeout' : 'error',
            statusText: failedStatus === TASK_STATUS.TIMEOUT ? 'Batch run timeout' : 'Batch run failed',
            error: {
              type: failedStatus === TASK_STATUS.TIMEOUT ? 'timeout' : 'polling',
              message: failedMessage,
              retryable: true
            },
            control: {
              canContinuePolling: failedStatus === TASK_STATUS.TIMEOUT,
              canRetry: true,
              lastTaskId: serverTaskId
            }
          })
          summary.failed.push({
            taskId: sourceTaskId,
            message: failedMessage
          })
          updateTaskBatchRunInfo(sourceTaskId, batchId, {
            lastErrorType: failedStatus === TASK_STATUS.TIMEOUT ? 'timeout' : 'polling',
            lastErrorMessage: failedMessage
          })
        } catch (error) {
          console.error('[batch-run] generateResult failed', {
            batchId,
            taskId: sourceTaskId,
            message: error && error.message,
            stack: error && error.stack
          })
          patchTaskEntityById(sourceTaskId, {
            status: TASK_STATUS.FAILED,
            stage: 'error',
            statusText: 'Batch run failed',
            error: {
              type: 'generate',
              message: (error && error.message) || 'Batch run failed'
            },
            control: {
              canRetry: true
            }
          })
          summary.failed.push({
            taskId: sourceTaskId,
            message: (error && error.message) || 'Batch run failed'
          })
          updateTaskBatchRunInfo(sourceTaskId, batchId, {
            lastErrorType: 'generate',
            lastErrorMessage: (error && error.message) || 'Batch run failed'
          })
        }
      }
    })

    await Promise.all(workers)

    if (options.resetCurrentTaskId) {
      patchMainChainState({
        currentTaskId: ''
      })
    }

    const hasRunnable = summary.runnableTaskIds.length > 0
    const hasFailure = summary.failed.length > 0
    let runState = 'completed'
    if (!hasRunnable && summary.skipped.length) {
      runState = 'idle'
    } else if (hasFailure && summary.succeededTaskIds.length === 0) {
      runState = 'failed'
    } else if (hasFailure) {
      runState = 'partially_failed'
    }

    setBatchRuntimeState(batchId, {
      state: runState,
      running: false,
      lastRunSummary: {
        total: summary.totalTaskIds,
        executed: summary.triggeredTaskIds.length,
        success: summary.succeededTaskIds.length,
        failed: summary.failed.length,
        skipped: summary.skipped.length,
        concurrency
      }
    })

    const runFailReason = summary.failed.length
      ? `; reason ${summary.failed.slice(0, 2).map((item) => item.message || 'unknown').join(' | ')}`
      : ''
    const runMessage = `Run batch done: runnable ${summary.runnableTaskIds.length}, executed ${summary.triggeredTaskIds.length}, success ${summary.succeededTaskIds.length}, failed ${summary.failed.length}, skipped ${summary.skipped.length}, concurrency ${concurrency}${runFailReason}`
    appendBatchLog(batchId, {
      type: summary.failed.length ? 'error' : 'run',
      action: 'run_finish',
      message: runMessage,
      summary: `executed ${summary.triggeredTaskIds.length}, success ${summary.succeededTaskIds.length}, failed ${summary.failed.length}, skipped ${summary.skipped.length}`,
      meta: {
        total: summary.totalTaskIds,
        runnable: summary.runnableTaskIds.length,
        executed: summary.triggeredTaskIds.length,
        success: summary.succeededTaskIds.length,
        failed: summary.failed.length,
        skipped: summary.skipped.length,
        concurrency
      }
    })

    await normalizeBatchStatus(batchId)

    return summary
  } finally {
    ACTIVE_BATCH_RUNNER_SET.delete(batchId)
    setBatchRuntimeState(batchId, {
      running: false
    })
  }
}

export async function retryFailedBatchTasks(batchId, options = {}) {
  if (!batchId) {
    throw new Error('Batch ID is required')
  }

  const batch = getBatchById(batchId)
  if (!batch) {
    throw new Error('Batch not found')
  }

  const sourceTaskIds = Array.isArray(batch.taskIds) ? batch.taskIds : []
  if (ACTIVE_BATCH_RUNNER_SET.has(batchId)) {
    console.warn('[taskActions:retryFailedBatchTasks] skipped active batch runner', {
      batchId
    })
    throw new Error('Batch is already running')
  }

  ACTIVE_BATCH_RUNNER_SET.add(batchId)
  setBatchRuntimeState(batchId, {
    state: 'running',
    running: true
  })
  appendBatchLog(batchId, {
    type: 'retry',
    action: 'retry_start',
    message: 'Retry failed batch tasks started',
    summary: `total ${sourceTaskIds.length}`,
    meta: {
      total: sourceTaskIds.length
    }
  })

  const summary = {
    totalTaskIds: sourceTaskIds.length,
    failedTaskIds: [],
    retriedTaskIds: [],
    retriedSuccessTaskIds: [],
    skipped: [],
    failed: []
  }

  try {
    for (let i = 0; i < sourceTaskIds.length; i += 1) {
      const sourceTaskId = sourceTaskIds[i]
      const currentState = getMainChainState()
      const task = currentState.tasks && currentState.tasks.byId && currentState.tasks.byId[sourceTaskId]

      if (!task) {
        summary.skipped.push({
          taskId: sourceTaskId,
          reason: 'task_not_found'
        })
        continue
      }

      if (!canRetryFailedBatchTask(task)) {
        summary.skipped.push({
          taskId: sourceTaskId,
          reason: `status_${task.status || 'unknown'}`
        })
        continue
      }

      summary.failedTaskIds.push(sourceTaskId)
      const payload = buildGeneratePayloadFromTask(task)
      if (!payload.cloth_image.file_id && !payload.cloth_image.file_url) {
        console.warn('[taskActions:retryFailedBatchTasks] task skipped missing cloth image', {
          batchId,
          taskId: sourceTaskId,
          reason: 'missing_cloth_image',
          clothImage: summarizeAssetRemoteFields((((task.input || {}).assets || {}).clothImage) || {})
        })
        summary.skipped.push({
          taskId: sourceTaskId,
          reason: 'missing_cloth_image'
        })
        continue
      }

      patchMainChainState({
        currentTaskId: sourceTaskId,
        draftTask: {
          ...task,
          projectId: task.projectId || batch.projectId || '',
          batchId: task.batchId || batchId
        }
      })
      patchTaskEntityById(sourceTaskId, {
        status: TASK_STATUS.SUBMITTED,
        stage: 'submitting',
        statusText: 'Batch retry started',
        error: {
          type: '',
          code: '',
          message: '',
          retryable: false
        }
      })
      updateTaskBatchRunInfo(sourceTaskId, batchId, {
        lastRunAt: new Date().toISOString()
      }, {
        incrementRetry: true
      })

      try {
        const taskResponse = await submitTask(payload)
        summary.retriedTaskIds.push((taskResponse && taskResponse.taskId) || sourceTaskId)
        summary.retriedSuccessTaskIds.push((taskResponse && taskResponse.taskId) || sourceTaskId)
        updateTaskBatchRunInfo(sourceTaskId, batchId, {
          lastErrorType: '',
          lastErrorMessage: ''
        })
      } catch (error) {
        patchTaskEntityById(sourceTaskId, {
          status: TASK_STATUS.FAILED,
          stage: 'error',
          statusText: 'Batch retry failed',
          error: {
            type: 'generate',
            message: (error && error.message) || 'Batch retry failed'
          },
          control: {
            canRetry: true
          }
        })
        summary.failed.push({
          taskId: sourceTaskId,
          message: (error && error.message) || 'Batch retry failed'
        })
        updateTaskBatchRunInfo(sourceTaskId, batchId, {
          lastErrorType: 'generate',
          lastErrorMessage: (error && error.message) || 'Batch retry failed'
        })
      }
    }

    if (options.resetCurrentTaskId) {
      patchMainChainState({
        currentTaskId: ''
      })
    }

    const retryFailReason = summary.failed.length
      ? `; reason ${summary.failed.slice(0, 2).map((item) => item.message || 'unknown').join(' | ')}`
      : ''
    const retryMessage = `Retry failed: found ${summary.failedTaskIds.length}, retried ${summary.retriedTaskIds.length}, skipped ${summary.skipped.length}, failed ${summary.failed.length}${retryFailReason}`
    appendBatchLog(batchId, {
      type: summary.failed.length ? 'error' : 'retry',
      action: 'retry_finish',
      message: retryMessage,
      summary: `found ${summary.failedTaskIds.length}, retried ${summary.retriedTaskIds.length}, success ${summary.retriedSuccessTaskIds.length}, failed ${summary.failed.length}, skipped ${summary.skipped.length}`,
      meta: {
        total: summary.totalTaskIds,
        found: summary.failedTaskIds.length,
        retried: summary.retriedTaskIds.length,
        success: summary.retriedSuccessTaskIds.length,
        failed: summary.failed.length,
        skipped: summary.skipped.length
      }
    })
    const retryRuntimeSummary = {
      total: summary.totalTaskIds,
      executed: summary.retriedTaskIds.length,
      success: summary.retriedSuccessTaskIds.length,
      failed: summary.failed.length,
      skipped: summary.skipped.length,
      concurrency: 1
    }
    setBatchRuntimeState(batchId, {
      state: summary.failed.length ? 'failed' : 'idle',
      running: false,
      lastRunSummary: retryRuntimeSummary,
      lastRetrySummary: {
        ...retryRuntimeSummary,
        total: summary.totalTaskIds,
        found: summary.failedTaskIds.length,
        retried: summary.retriedTaskIds.length,
        success: summary.retriedSuccessTaskIds.length,
        failed: summary.failed.length,
        skipped: summary.skipped.length
      }
    })

    return summary
  } finally {
    ACTIVE_BATCH_RUNNER_SET.delete(batchId)
    setBatchRuntimeState(batchId, {
      running: false
    })
  }
}

export async function submitTask(payload) {
  const state = getMainChainState()
  const projectId = (state.draftTask && state.draftTask.projectId) || ''
  const batchId = (state.draftTask && state.draftTask.batchId) || ''

  updateTaskStatus({
    generating: true,
    genText: '提交生成任务中...',
    progress: 15,
    resultImageUrl: '',
    taskId: '',
    lastTaskId: state.taskId || state.lastTaskId || '',
    taskStatus: TASK_STATUS.SUBMITTED,
    errorMessage: '',
    generateError: '',
    pollingError: '',
    canContinuePolling: false,
    taskControl: {
      retryState: {
        ...(getRuntimeTaskControl(state).retryState || {}),
        generate: false,
        polling: false
      }
    }
  })

  try {
    updateTaskStatus({
      generating: true,
      genText: 'AI 生成处理中...',
      progress: 45,
      taskStatus: TASK_STATUS.PROCESSING
    })

    const result = await generateResult(payload)

    if (result.resultImageUrl) {
      mergeTaskResult({
        projectId,
        batchId,
        generating: false,
        genText: '生成完成',
        progress: result.progress || 100,
        taskId: result.taskId || '',
        lastTaskId: result.taskId || '',
        taskStatus: result.taskStatus || TASK_STATUS.SUCCESS,
        resultImageUrl: result.resultImageUrl,
        errorMessage: '',
        generateError: '',
        pollingError: '',
        canContinuePolling: false,
        taskControl: {
          retryState: {
            ...(getRuntimeTaskControl(getMainChainState()).retryState || {}),
            generate: false,
            polling: false
          }
        }
      })

      if (projectId && result.taskId) {
        appendTaskToProject(projectId, result.taskId)
      }
      if (batchId && result.taskId) {
        appendTaskToBatch(batchId, result.taskId)
      }

      return {
        mode: 'direct_success',
        result
      }
    }

    if (!result.taskId) {
      throw new Error('生成接口未返回 taskId')
    }

    updateTaskStatus({
      projectId,
      batchId,
      generating: true,
      genText: '任务已提交，等待结果...',
      progress: result.progress || 60,
      taskId: result.taskId || '',
      lastTaskId: result.taskId || '',
      taskStatus: result.taskStatus || TASK_STATUS.QUEUED,
      resultImageUrl: '',
      errorMessage: result.errorMessage || '',
      generateError: '',
      pollingError: '',
      canContinuePolling: true
    })

    if (projectId && result.taskId) {
      appendTaskToProject(projectId, result.taskId)
    }
    if (batchId && result.taskId) {
      appendTaskToBatch(batchId, result.taskId)
    }

    return {
      mode: 'polling',
      taskId: result.taskId,
      result
    }
  } catch (error) {
    updateTaskStatus({
      generating: false,
      genText: '生成失败',
      progress: 0,
      taskStatus: TASK_STATUS.FAILED,
      errorMessage: error && error.message ? error.message : '生成请求失败',
      generateError: error && error.message ? error.message : '生成请求失败',
      pollingError: '',
      taskControl: {
        canContinuePolling: false,
        retryState: {
          ...(getRuntimeTaskControl(getMainChainState()).retryState || {}),
          generate: true,
          polling: false
        }
      }
    })
    throw error
  }
}
