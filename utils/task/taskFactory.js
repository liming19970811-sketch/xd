import { TASK_SOURCE, TASK_STATUS, TASK_TYPES } from '../constants'
import { GENERATION_STATUSES } from './generationContract'

export function createEmptyAsset(overrides = {}) {
  return {
    localPath: '',
    fileId: '',
    fileUrl: '',
    ...overrides
  }
}

function safeString(value) {
  return typeof value === 'string' ? value : ''
}

export function normalizeTaskStatus(status, fallbackStatus = TASK_STATUS.DRAFT) {
  const value = safeString(status) || fallbackStatus || TASK_STATUS.DRAFT

  if (Object.values(GENERATION_STATUSES).includes(value)) {
    return value
  }

  if (value === 'submitting') {
    return TASK_STATUS.SUBMITTED
  }
  if (value === 'error') {
    return TASK_STATUS.FAILED
  }
  if (value === 'pending_review') {
    return TASK_STATUS.PENDING
  }
  if (Object.values(TASK_STATUS).includes(value)) {
    return value
  }

  return fallbackStatus || TASK_STATUS.DRAFT
}

export function normalizeTaskSource(source, fallbackSource = TASK_SOURCE.MINIAPP) {
  const value = safeString(source) || fallbackSource || TASK_SOURCE.MINIAPP
  return Object.values(TASK_SOURCE).includes(value) ? value : fallbackSource || TASK_SOURCE.MINIAPP
}

function getTaskTimestamp(task = {}) {
  return task.updatedAt || task.completedAt || task.submittedAt || task.createdAt || ''
}

function buildTaskSummary(task = {}) {
  const input = task.input || {}
  const params = input.params || {}
  const options = input.options || {}
  const result = task.result || {}
  const items = Array.isArray(result.items) ? result.items : []
  const hasResult = !!(result.coverUrl || (items[0] && items[0].fileUrl))

  return {
    primaryText: task.taskId || 'Draft Task',
    secondaryText: [
      params.modelType || 'female',
      params.styleTag || 'simple',
      params.sceneType || 'white',
      options.outputType || 'main'
    ].join(' / '),
    status: normalizeTaskStatus(task.status, TASK_STATUS.DRAFT),
    source: normalizeTaskSource(task.taskSource || task.source, TASK_SOURCE.MINIAPP),
    hasResult,
    progress: typeof task.progress === 'number' ? task.progress : 0,
    updatedAt: getTaskTimestamp(task)
  }
}

export function createTaskEntity(overrides = {}) {
  const normalizedSource = normalizeTaskSource(overrides.taskSource || overrides.source, TASK_SOURCE.MINIAPP)
  const normalizedStatus = normalizeTaskStatus(overrides.status, TASK_STATUS.DRAFT)
  const baseTask = {
    taskId: '',
    clientTaskId: '',
    taskType: TASK_TYPES.MODEL_REPLACE,
    taskSource: TASK_SOURCE.MINIAPP,
    source: TASK_SOURCE.MINIAPP,
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
    status: TASK_STATUS.DRAFT,
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
    summary: {
      primaryText: 'Draft Task',
      secondaryText: '',
      status: TASK_STATUS.DRAFT,
      source: TASK_SOURCE.MINIAPP,
      hasResult: false,
      progress: 0,
      updatedAt: ''
    },
    deliveryStatus: 'pending_review',
    deliveryConfirmedAt: '',
    deliveryNote: '',
    lastDeliverySyncAt: '',
    lastDeliverySyncStatus: 'unknown',
    lastDeliveryReconcileAt: '',
    lastDeliveryReconcileStatus: 'unknown',
    createdAt: '',
    updatedAt: '',
    submittedAt: '',
    completedAt: ''
  }

  const nextTask = {
    ...baseTask,
    ...overrides,
    taskSource: normalizedSource,
    source: normalizedSource,
    status: normalizedStatus
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

  nextTask.summary = buildTaskSummary(nextTask)

  return nextTask
}

export function createDraftTask(overrides = {}) {
  return createTaskEntity({
    status: TASK_STATUS.DRAFT,
    stage: 'editing',
    ...overrides
  })
}
