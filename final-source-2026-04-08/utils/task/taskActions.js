import { getMainChainState, patchMainChainState } from '../mainChainState'
import { generateResult } from '../api/generate'
import { createDraftTaskFromLegacyState, mapLegacyStateToTaskEntity } from './taskMapper'

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
  'uploadError',
  'generateError',
  'pollingError',
  'retryable',
  'canContinuePolling',
  'uploading',
  'lastTaskId'
]

function mergeLegacyState(state, patch = {}) {
  const nextState = {
    ...state,
    ...patch
  }

  if (patch.clothImage || patch.styleImage) {
    nextState.clothImage = patch.clothImage ? { ...state.clothImage, ...patch.clothImage } : state.clothImage
    nextState.styleImage = patch.styleImage ? { ...state.styleImage, ...patch.styleImage } : state.styleImage
  }

  if (patch.uploadError) {
    nextState.uploadError = {
      ...state.uploadError,
      ...patch.uploadError
    }
  }

  if (patch.retryable) {
    nextState.retryable = {
      ...state.retryable,
      ...patch.retryable
    }
  }

  if (patch.uploading) {
    nextState.uploading = {
      ...state.uploading,
      ...patch.uploading
    }
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

function normalizeLegacyTaskStatus(status, fallbackStatus) {
  if (status === 'submitting') {
    return 'submitted'
  }
  if (status === 'error') {
    return 'failed'
  }
  return status || fallbackStatus || 'draft'
}

function mapRuntimeStatus(patch = {}, currentTask = {}) {
  const fallbackStatus = currentTask.status || 'draft'

  if (Object.prototype.hasOwnProperty.call(patch, 'taskStatus')) {
    return normalizeLegacyTaskStatus(patch.taskStatus, fallbackStatus)
  }

  if (Object.prototype.hasOwnProperty.call(patch, 'generating')) {
    return patch.generating ? 'processing' : fallbackStatus
  }

  return fallbackStatus
}

function mapRuntimeStage(patch = {}, currentTask = {}) {
  const currentControl = currentTask.control || {}
  const currentUploading = currentControl.uploading || {}
  const nextUploading = Object.prototype.hasOwnProperty.call(patch, 'uploading')
    ? {
        ...currentUploading,
        ...(patch.uploading || {})
      }
    : currentUploading

  if (nextUploading.clothImage || nextUploading.styleImage) {
    return 'uploading'
  }

  const status = mapRuntimeStatus(patch, currentTask)
  const canContinuePolling = Object.prototype.hasOwnProperty.call(patch, 'canContinuePolling')
    ? !!patch.canContinuePolling
    : !!currentControl.canContinuePolling

  if (status === 'submitted') {
    return 'submitting'
  }
  if (status === 'queued') {
    return 'queued'
  }
  if (status === 'processing' && canContinuePolling) {
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
  return currentTask.stage || 'editing'
}

function buildRuntimeErrorPatch(patch = {}, currentError = {}, currentState) {
  const currentDetails = currentError.details || {}
  const currentUploadDetails = currentDetails.upload || {}
  const fallbackUploadError = currentState.uploadError || {}
  const fallbackGenerateError = currentState.generateError || ''
  const fallbackPollingError = currentState.pollingError || ''
  const fallbackMessage = currentState.errorMessage || currentError.message || ''

  const uploadPatch = Object.prototype.hasOwnProperty.call(patch, 'uploadError')
    ? patch.uploadError || {}
    : {}
  const clothUploadError = Object.prototype.hasOwnProperty.call(uploadPatch, 'clothImage')
    ? uploadPatch.clothImage || ''
    : currentUploadDetails.clothImage || fallbackUploadError.clothImage || ''
  const styleUploadError = Object.prototype.hasOwnProperty.call(uploadPatch, 'styleImage')
    ? uploadPatch.styleImage || ''
    : currentUploadDetails.styleImage || fallbackUploadError.styleImage || ''
  const generateError = Object.prototype.hasOwnProperty.call(patch, 'generateError')
    ? patch.generateError || ''
    : currentDetails.generate || fallbackGenerateError
  const pollingError = Object.prototype.hasOwnProperty.call(patch, 'pollingError')
    ? patch.pollingError || ''
    : currentDetails.polling || fallbackPollingError
  const generalError = Object.prototype.hasOwnProperty.call(patch, 'errorMessage')
    ? patch.errorMessage || ''
    : fallbackMessage

  let type = currentError.type || ''
  if (clothUploadError || styleUploadError) {
    type = 'upload'
  } else if (generateError) {
    type = 'generate'
  } else if (pollingError) {
    type = 'polling'
  } else if (generalError) {
    type = 'unknown'
  } else if (
    Object.prototype.hasOwnProperty.call(patch, 'errorMessage') ||
    Object.prototype.hasOwnProperty.call(patch, 'generateError') ||
    Object.prototype.hasOwnProperty.call(patch, 'pollingError') ||
    Object.prototype.hasOwnProperty.call(patch, 'uploadError')
  ) {
    type = ''
  }

  const message = clothUploadError || styleUploadError || generateError || pollingError || generalError || ''
  const retryState = (patch.retryable || currentState.retryable || {}) || {}

  return {
    ...currentError,
    type,
    code: currentError.code || '',
    message,
    retryable: !!(retryState.clothImage || retryState.styleImage || retryState.generate || retryState.polling),
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
  const currentRetryState = currentControl.retryState || {}
  const currentUploading = currentControl.uploading || {}
  const nextRetryState = Object.prototype.hasOwnProperty.call(patch, 'retryable')
    ? {
        ...currentRetryState,
        ...(patch.retryable || {})
      }
    : currentRetryState
  const nextUploading = Object.prototype.hasOwnProperty.call(patch, 'uploading')
    ? {
        ...currentUploading,
        ...(patch.uploading || {})
      }
    : currentUploading

  return {
    ...currentControl,
    canRetry: !!(nextRetryState.clothImage || nextRetryState.styleImage || nextRetryState.generate || nextRetryState.polling),
    canContinuePolling: Object.prototype.hasOwnProperty.call(patch, 'canContinuePolling')
      ? !!patch.canContinuePolling
      : !!currentControl.canContinuePolling,
    lastTaskId: Object.prototype.hasOwnProperty.call(patch, 'lastTaskId')
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
    nextTasks.byId[taskKey] = {
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
    }
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
  const nextLegacyState = mergeLegacyState(currentState, filteredLegacyPatch)
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
    ...filteredLegacyPatch,
    ...taskStructures
  })
}

export function updateTaskStatus(statusPatch = {}) {
  return syncDraftTaskToState(statusPatch)
}

export function mergeTaskResult(resultPatch = {}) {
  return syncDraftTaskToState(resultPatch)
}

export async function submitTask(payload) {
  const state = getMainChainState()

  updateTaskStatus({
    generating: true,
    genText: '提交生成任务中...',
    progress: 15,
    resultImageUrl: '',
    taskId: '',
    lastTaskId: state.taskId || state.lastTaskId || '',
    taskStatus: 'submitting',
    errorMessage: '',
    generateError: '',
    pollingError: '',
    canContinuePolling: false,
    retryable: {
      ...state.retryable,
      generate: false,
      polling: false
    }
  })

  try {
    updateTaskStatus({
      generating: true,
      genText: 'AI 生成处理中...',
      progress: 45,
      taskStatus: 'processing'
    })

    const result = await generateResult(payload)

    if (result.resultImageUrl) {
      mergeTaskResult({
        generating: false,
        genText: '生成完成',
        progress: result.progress || 100,
        taskId: result.taskId || '',
        lastTaskId: result.taskId || '',
        taskStatus: result.taskStatus || 'success',
        resultImageUrl: result.resultImageUrl,
        errorMessage: '',
        generateError: '',
        pollingError: '',
        canContinuePolling: false,
        retryable: {
          ...getMainChainState().retryable,
          generate: false,
          polling: false
        }
      })

      return {
        mode: 'direct_success',
        result
      }
    }

    if (!result.taskId) {
      throw new Error('生成接口未返回 taskId')
    }

    updateTaskStatus({
      generating: true,
      genText: '任务已提交，等待结果...',
      progress: result.progress || 60,
      taskId: result.taskId || '',
      lastTaskId: result.taskId || '',
      taskStatus: result.taskStatus || 'queued',
      resultImageUrl: '',
      errorMessage: result.errorMessage || '',
      generateError: '',
      pollingError: '',
      canContinuePolling: true
    })

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
      taskStatus: 'failed',
      errorMessage: error && error.message ? error.message : '生成请求失败',
      generateError: error && error.message ? error.message : '生成请求失败',
      pollingError: '',
      canContinuePolling: false,
      retryable: {
        ...getMainChainState().retryable,
        generate: true,
        polling: false
      }
    })
    throw error
  }
}
