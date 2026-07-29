import { createTaskEntity } from './task/taskFactory'

const STORAGE_KEY = 'main_chain_state'

function createDefaultState() {
  return {
    currentTaskId: '',
    draftTask: createTaskEntity(),
    tasks: {
      byId: {},
      allIds: []
    },
    deliveryAudits: [],
    deliveryCompensationQueue: [],
    uiState: {
      currentStep: 1,
      currentView: 'upload',
      taskListFilter: 'all',
      taskListKeyword: '',
      loading: false,
      historyReady: false,
      serviceEntry: ''
    },
    taskId: '',
    lastTaskId: ''
  }
}

function mergeTaskEntity(task) {
  return createTaskEntity(task || {})
}

function mergeTasks(tasks) {
  const byId = {}
  const sourceById = tasks && tasks.byId ? tasks.byId : {}
  Object.keys(sourceById).forEach((taskId) => {
    byId[taskId] = mergeTaskEntity(sourceById[taskId])
  })

  return {
    byId,
    allIds: Array.isArray(tasks && tasks.allIds)
      ? tasks.allIds.filter((taskId) => !!byId[taskId])
      : Object.keys(byId)
  }
}

let mainChainState = null

function cloneState(state) {
  const defaults = createDefaultState()
  const sourceState = state || {}
  const {
    clothImage: _legacyClothImage,
    styleImage: _legacyStyleImage,
    resultImageUrl: _legacyResultImageUrl,
    generating: _legacyGenerating,
    genText: _legacyGenText,
    progress: _legacyProgress,
    taskStatus: _legacyTaskStatus,
    errorMessage: _legacyErrorMessage,
    generateError: _legacyGenerateError,
    pollingError: _legacyPollingError,
    canContinuePolling: _legacyCanContinuePolling,
    uploadError: _legacyUploadError,
    retryable: _legacyRetryable,
    uploading: _legacyUploading,
    ...restSourceState
  } = sourceState

  return {
    ...defaults,
    ...restSourceState,
    draftTask: mergeTaskEntity(sourceState.draftTask),
    tasks: mergeTasks(sourceState.tasks),
    deliveryAudits: Array.isArray(sourceState.deliveryAudits) ? sourceState.deliveryAudits.filter(Boolean) : [],
    deliveryCompensationQueue: Array.isArray(sourceState.deliveryCompensationQueue)
      ? sourceState.deliveryCompensationQueue.filter(Boolean)
      : [],
    uiState: {
      ...defaults.uiState,
      ...(sourceState.uiState || {})
    }
  }
}

function ensureState() {
  if (mainChainState) {
    return mainChainState
  }

  const cachedState = uni.getStorageSync(STORAGE_KEY)
  mainChainState = cloneState(cachedState || {})
  return mainChainState
}

export function getMainChainState() {
  return ensureState()
}

export function patchMainChainState(patch) {
  const state = ensureState()
  Object.assign(state, patch)
  mainChainState = cloneState(state)
  uni.setStorageSync(STORAGE_KEY, mainChainState)
  return mainChainState
}

export function resetMainChainState() {
  mainChainState = createDefaultState()
  uni.setStorageSync(STORAGE_KEY, cloneState(mainChainState))
  return mainChainState
}
