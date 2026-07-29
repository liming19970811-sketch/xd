export function createEmptyAsset(overrides = {}) {
  return {
    localPath: '',
    fileId: '',
    fileUrl: '',
    ...overrides
  }
}

export function createTaskEntity(overrides = {}) {
  const baseTask = {
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
      retryable: false,
      details: {
        upload: {
          clothImage: '',
          styleImage: ''
        },
        generate: '',
        polling: ''
      }
    },
    control: {
      canRetry: false,
      canContinuePolling: false,
      lastTaskId: '',
      pollingCount: 0,
      maxPollingCount: 10,
      retryState: {
        clothImage: false,
        styleImage: false,
        generate: false,
        polling: false
      },
      uploading: {
        clothImage: false,
        styleImage: false
      }
    },
    createdAt: '',
    updatedAt: '',
    submittedAt: '',
    completedAt: ''
  }

  const nextTask = {
    ...baseTask,
    ...overrides
  }

  nextTask.input = {
    ...baseTask.input,
    ...(overrides.input || {}),
    assets: {
      ...baseTask.input.assets,
      ...((overrides.input && overrides.input.assets) || {}),
      clothImage: createEmptyAsset(overrides.input && overrides.input.assets && overrides.input.assets.clothImage),
      styleImage: createEmptyAsset(overrides.input && overrides.input.assets && overrides.input.assets.styleImage)
    },
    params: {
      ...baseTask.input.params,
      ...((overrides.input && overrides.input.params) || {})
    },
    options: {
      ...baseTask.input.options,
      ...((overrides.input && overrides.input.options) || {})
    }
  }

  nextTask.result = {
    ...baseTask.result,
    ...(overrides.result || {}),
    items: Array.isArray(overrides.result && overrides.result.items) ? overrides.result.items : baseTask.result.items,
    meta: {
      ...baseTask.result.meta,
      ...((overrides.result && overrides.result.meta) || {})
    }
  }

  nextTask.error = {
    ...baseTask.error,
    ...(overrides.error || {}),
    details: {
      ...baseTask.error.details,
      ...((overrides.error && overrides.error.details) || {}),
      upload: {
        ...baseTask.error.details.upload,
        ...((overrides.error && overrides.error.details && overrides.error.details.upload) || {})
      }
    }
  }

  nextTask.control = {
    ...baseTask.control,
    ...(overrides.control || {}),
    retryState: {
      ...baseTask.control.retryState,
      ...((overrides.control && overrides.control.retryState) || {})
    },
    uploading: {
      ...baseTask.control.uploading,
      ...((overrides.control && overrides.control.uploading) || {})
    }
  }

  return nextTask
}

export function createDraftTask(overrides = {}) {
  return createTaskEntity({
    status: 'draft',
    stage: 'editing',
    ...overrides
  })
}
