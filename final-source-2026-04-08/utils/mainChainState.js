const STORAGE_KEY = 'main_chain_state'

function createEmptyAsset() {
  return {
    localPath: '',
    fileId: '',
    fileUrl: ''
  }
}

function createTaskEntity(overrides = {}) {
  return {
    taskId: '',
    clientTaskId: '',
    taskType: 'model_replace',
    source: 'miniapp',
    bizType: 'ai_listing',
    projectId: '',
    batchId: '',
    userId: '',
    enterpriseId: '',
    channel: '',
    input: {
      assets: {
        clothImage: createEmptyAsset(),
        styleImage: createEmptyAsset()
      },
      params: {
        modelType: 'female',
        bodyType: 'normal',
        kidsAgeGroup: 'middle',
        styleTag: 'simple',
        sceneType: 'white',
        neckType: 'round',
        sleeveType: 'long',
        fitType: 'loose'
      },
      options: {
        backgroundType: 'normal',
        outputType: 'main'
      }
    },
    status: 'draft',
    stage: 'editing',
    progress: 0,
    statusText: '',
    result: {
      items: [],
      coverUrl: '',
      outputType: 'main',
      meta: {}
    },
    error: {
      type: '',
      code: '',
      message: '',
      retryable: false
    },
    control: {
      canRetry: false,
      canContinuePolling: false,
      lastTaskId: '',
      pollingCount: 0,
      maxPollingCount: 10
    },
    createdAt: '',
    updatedAt: '',
    submittedAt: '',
    completedAt: '',
    ...overrides
  }
}

function createDefaultState() {
  const defaultTask = createTaskEntity()

  return {
    currentTaskId: '',
    draftTask: defaultTask,
    tasks: {
      byId: {},
      allIds: []
    },
    uiState: {
      currentStep: 1,
      currentView: 'upload',
      taskListFilter: 'all',
      taskListKeyword: '',
      loading: false
    },
    taskId: '',
    lastTaskId: '',
    uploadError: {
      clothImage: '',
      styleImage: ''
    },
    retryable: {
      clothImage: false,
      styleImage: false,
      generate: false,
      polling: false
    },
    uploading: {
      clothImage: false,
      styleImage: false
    }
  }
}

function mergeAsset(asset) {
  return {
    ...createEmptyAsset(),
    ...(asset || {})
  }
}

function mergeTaskEntity(task) {
  const defaultTask = createTaskEntity()
  const sourceTask = task || {}

  return {
    ...defaultTask,
    ...sourceTask,
    input: {
      ...defaultTask.input,
      ...(sourceTask.input || {}),
      assets: {
        ...defaultTask.input.assets,
        ...((sourceTask.input && sourceTask.input.assets) || {}),
        clothImage: mergeAsset(sourceTask.input && sourceTask.input.assets && sourceTask.input.assets.clothImage),
        styleImage: mergeAsset(sourceTask.input && sourceTask.input.assets && sourceTask.input.assets.styleImage)
      },
      params: {
        ...defaultTask.input.params,
        ...((sourceTask.input && sourceTask.input.params) || {})
      },
      options: {
        ...defaultTask.input.options,
        ...((sourceTask.input && sourceTask.input.options) || {})
      }
    },
    result: {
      ...defaultTask.result,
      ...(sourceTask.result || {}),
      items: Array.isArray(sourceTask.result && sourceTask.result.items) ? sourceTask.result.items : defaultTask.result.items,
      meta: {
        ...defaultTask.result.meta,
        ...((sourceTask.result && sourceTask.result.meta) || {})
      }
    },
    error: {
      ...defaultTask.error,
      ...(sourceTask.error || {})
    },
    control: {
      ...defaultTask.control,
      ...(sourceTask.control || {})
    }
  }
}

function mergeTasks(tasks) {
  const byId = {}
  const sourceById = tasks && tasks.byId ? tasks.byId : {}
  Object.keys(sourceById).forEach((taskId) => {
    byId[taskId] = mergeTaskEntity(sourceById[taskId])
  })

  return {
    byId,
    allIds: Array.isArray(tasks && tasks.allIds) ? tasks.allIds : []
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
    ...restSourceState
  } = sourceState

  return {
    ...defaults,
    ...restSourceState,
    draftTask: mergeTaskEntity(sourceState.draftTask),
    tasks: mergeTasks(sourceState.tasks),
    uiState: {
      ...defaults.uiState,
      ...(sourceState.uiState || {})
    },
    uploadError: {
      ...defaults.uploadError,
      ...(sourceState.uploadError || {})
    },
    retryable: {
      ...defaults.retryable,
      ...(sourceState.retryable || {})
    },
    uploading: {
      ...defaults.uploading,
      ...(sourceState.uploading || {})
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
  uni.setStorageSync(STORAGE_KEY, cloneState(state))
  return state
}

export function resetMainChainState() {
  mainChainState = createDefaultState()
  uni.setStorageSync(STORAGE_KEY, cloneState(mainChainState))
  return mainChainState
}
