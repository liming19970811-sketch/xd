import { getMainChainState, patchMainChainState } from '../mainChainState'
import { initCloudBase, isCloudBaseReady } from '../cloudbase/init'
import { TASK_SOURCE, TASK_STATUS, TASK_TYPES } from '../constants'
import { createTaskEntity } from './taskFactory'
import {
  buildGarmentReplaceCloudParams,
  isGarmentReplaceTask
} from './garmentReplaceContract'
import {
  buildPatternStructureCloudParams,
  isPatternStructureTask
} from './patternStructureContract'
import { upsertWorkRecordFromTask } from '../work/workRecordRepository'
import { assertIdentityProviderCapability } from '../provider/identityProviderCapability'
import { assertGarmentProviderCapability } from '../provider/garmentProviderCapability'
import {
  GENERATION_STATUSES,
  normalizeGenerationStatus,
  normalizeGenerationTaskOptions
} from './generationContract'

const ACTIVE_SIMULATORS = {}
const WANX_FUNCTION_NAME = 'generate_wanx'
const LOCAL_PATH_PATTERN = /^(http:\/\/tmp\/|wxfile:\/\/|file:\/\/|\/|[a-zA-Z]:\\)/

function nowIso() {
  return new Date().toISOString()
}

function createTaskId() {
  return `task_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

function normalizeImageUrl(value) {
  if (!value) {
    return ''
  }
  if (typeof value === 'string') {
    return value
  }
  const fileId = value.fileId || value.file_id || value.fileID || ''
  if (isCloudFileId(fileId)) {
    return fileId
  }
  return value.fileUrl ||
    value.file_url ||
    value.imageUrl ||
    value.image_url ||
    value.url ||
    value.tempFilePath ||
    value.localPath ||
    value.path ||
    ''
}

function normalizeTaskType(type = '') {
  const value = String(type || '').trim()
  return value || TASK_TYPES.MODEL_REPLACE
}

function hasCloudCallFunction() {
  return (
    typeof wx !== 'undefined' &&
    wx &&
    wx.cloud &&
    typeof wx.cloud.callFunction === 'function'
  )
}

function ensureCloudReady() {
  if (!isCloudBaseReady()) {
    initCloudBase()
  }
  return isCloudBaseReady()
}

function hasCloudUploadFile() {
  return (
    typeof wx !== 'undefined' &&
    wx &&
    wx.cloud &&
    typeof wx.cloud.uploadFile === 'function'
  )
}

function isCloudFileId(value = '') {
  return /^cloud:\/\//.test(String(value || ''))
}

function isHttpsUrl(value = '') {
  return /^https:\/\//.test(String(value || ''))
}

function isLocalImagePath(value = '') {
  return LOCAL_PATH_PATTERN.test(String(value || ''))
}

function getImageExt(path = '') {
  const cleanPath = String(path || '').split('?')[0]
  const match = cleanPath.match(/\.([a-zA-Z0-9]+)$/)
  const ext = match ? match[1].toLowerCase() : 'jpg'
  return ['jpg', 'jpeg', 'png', 'webp'].includes(ext) ? ext : 'jpg'
}

function uploadFileToCloud(localPath, taskId) {
  return new Promise((resolve, reject) => {
    const cloudPath = `wanx-inputs/${taskId || 'task'}_${Date.now()}.${getImageExt(localPath)}`
    wx.cloud.uploadFile({
      cloudPath,
      filePath: localPath,
      success: resolve,
      fail: reject
    })
  })
}

function downloadHttpsFile(url = '') {
  return new Promise((resolve, reject) => {
    if (typeof wx === 'undefined' || !wx || typeof wx.downloadFile !== 'function') {
      reject({ errorCode: 'WX_DOWNLOAD_UNAVAILABLE', message: 'wx.downloadFile is unavailable' })
      return
    }
    wx.downloadFile({
      url,
      success(result = {}) {
        if (Number(result.statusCode) !== 200 || !result.tempFilePath) {
          reject({ errorCode: 'RESULT_DOWNLOAD_FAILED', message: 'Provider result download failed' })
          return
        }
        resolve(result.tempFilePath)
      },
      fail(error) {
        reject({
          errorCode: 'RESULT_DOWNLOAD_FAILED',
          message: (error && error.errMsg) || 'Provider result download failed'
        })
      }
    })
  })
}

function uploadResultFileToCloud(localPath, taskId, index = 0) {
  return new Promise((resolve, reject) => {
    const safeTaskId = String(taskId || 'task').replace(/[^a-zA-Z0-9_-]/g, '_')
    const cloudPath = `wanx-results/${safeTaskId}/${Date.now()}_${index + 1}.${getImageExt(localPath)}`
    wx.cloud.uploadFile({
      cloudPath,
      filePath: localPath,
      success: resolve,
      fail: reject
    })
  })
}

function verifyCloudResultFile(fileId = '') {
  return new Promise((resolve, reject) => {
    if (!isCloudFileId(fileId) || typeof wx === 'undefined' || !wx.cloud || typeof wx.cloud.getTempFileURL !== 'function') {
      reject({ errorCode: 'RESULT_ACCESS_CHECK_UNAVAILABLE', message: 'Result access check is unavailable' })
      return
    }
    wx.cloud.getTempFileURL({
      fileList: [fileId],
      success(response = {}) {
        const item = (response.fileList || [])[0] || {}
        if (Number(item.status) === 0 && item.tempFileURL) {
          resolve(true)
          return
        }
        reject({ errorCode: 'RESULT_FILE_UNAVAILABLE', message: 'Stored result file is not accessible' })
      },
      fail() {
        reject({ errorCode: 'RESULT_FILE_UNAVAILABLE', message: 'Stored result file is not accessible' })
      }
    })
  })
}

async function persistWanxResultItems(task = {}, resultItems = []) {
  if (!hasCloudUploadFile() || !ensureCloudReady()) {
    throw { errorCode: 'RESULT_STORAGE_UNAVAILABLE', message: 'Result cloud storage is unavailable' }
  }
  const sourceItems = Array.isArray(resultItems) ? resultItems : []
  const persistedItems = []
  for (let index = 0; index < sourceItems.length; index += 1) {
    const source = sourceItems[index] || {}
    const sourceUrl = normalizeImageUrl(source)
    if (!sourceUrl || (!isCloudFileId(sourceUrl) && !isHttpsUrl(sourceUrl))) continue
    let fileId = sourceUrl
    if (isHttpsUrl(sourceUrl)) {
      const localPath = await downloadHttpsFile(sourceUrl)
      const uploadResult = await uploadResultFileToCloud(localPath, task.taskId, index)
      fileId = uploadResult.fileID || uploadResult.fileId || ''
    }
    if (!isCloudFileId(fileId)) {
      throw { errorCode: 'RESULT_STORAGE_NO_FILE_ID', message: 'Result storage did not return a stable file ID' }
    }
    await verifyCloudResultFile(fileId)
    persistedItems.push({
      ...source,
      resultId: source.resultId || `${task.taskId}_wanx_result_${index + 1}`,
      assetId: source.assetId || `asset_${task.taskId}_${index + 1}`,
      fileId,
      fileUrl: fileId,
      imageUrl: fileId,
      url: fileId,
      type: source.type || 'image',
      provider: source.provider || 'wanx'
    })
  }
  if (!persistedItems.length) {
    throw { errorCode: 'RESULT_MISSING', message: 'Provider result did not contain a persistable image' }
  }
  return persistedItems
}

function normalizeTaskInput(input = {}, params = {}) {
  const sourceAssets = input.assets || {}
  const inputImageUrl = input.imageUrl || input.image_url || ''
  return {
    ...input,
    imageUrl: inputImageUrl,
    image_url: inputImageUrl,
    assets: {
      ...(sourceAssets || {}),
      clothImage: {
        ...((sourceAssets && sourceAssets.clothImage) || {}),
        ...((sourceAssets && sourceAssets.cloth_image) || {})
      },
      styleImage: {
        ...((sourceAssets && sourceAssets.styleImage) || {}),
        ...((sourceAssets && sourceAssets.style_image) || {})
      }
    },
    params: {
      ...((input && input.params) || {}),
      ...(params || {})
    },
    options: {
      ...((input && input.options) || {})
    }
  }
}

function upsertTask(task) {
  const state = getMainChainState()
  const tasks = state.tasks || {}
  const byId = {
    ...(tasks.byId || {}),
    [task.taskId]: createTaskEntity(task)
  }
  const allIds = Array.isArray(tasks.allIds) ? [...tasks.allIds] : []
  if (!allIds.includes(task.taskId)) {
    allIds.unshift(task.taskId)
  }
  const persistedTask = patchMainChainState({
    currentTaskId: task.taskId,
    taskId: task.taskId,
    lastTaskId: task.taskId,
    draftTask: byId[task.taskId],
    tasks: {
      ...tasks,
      byId,
      allIds
    }
  }).tasks.byId[task.taskId]
  // Work records are a projection of tasks. A failed work-index write must never block generation.
  try {
    upsertWorkRecordFromTask(persistedTask)
  } catch (error) {}
  return persistedTask
}

export function getTask(taskId) {
  const normalizedTaskId = String(taskId || '').trim()
  if (!normalizedTaskId) {
    return null
  }
  const state = getMainChainState()
  return (state.tasks && state.tasks.byId && state.tasks.byId[normalizedTaskId]) || null
}

export function listTasks() {
  const state = getMainChainState()
  const tasks = (state.tasks && state.tasks.byId) || {}
  const allIds = Array.isArray(state.tasks && state.tasks.allIds)
    ? state.tasks.allIds
    : Object.keys(tasks)
  return allIds.map((taskId) => tasks[taskId]).filter(Boolean)
}

export function patchTask(taskId, patch = {}) {
  const current = getTask(taskId)
  if (!current) {
    return null
  }
  const nextTask = createTaskEntity({
    ...current,
    ...patch,
    input: {
      ...((current && current.input) || {}),
      ...((patch && patch.input) || {}),
      assets: {
        ...(((current && current.input && current.input.assets) || {})),
        ...(((patch && patch.input && patch.input.assets) || {}))
      },
      params: {
        ...(((current && current.input && current.input.params) || {})),
        ...(((patch && patch.input && patch.input.params) || {}))
      },
      options: {
        ...(((current && current.input && current.input.options) || {})),
        ...(((patch && patch.input && patch.input.options) || {}))
      }
    },
    result: {
      ...((current && current.result) || {}),
      ...((patch && patch.result) || {}),
      items: Array.isArray(patch && patch.result && patch.result.items)
        ? patch.result.items
        : (((current && current.result && current.result.items) || [])),
      meta: {
        ...(((current && current.result && current.result.meta) || {})),
        ...(((patch && patch.result && patch.result.meta) || {}))
      }
    },
    control: {
      ...((current && current.control) || {}),
      ...((patch && patch.control) || {})
    },
    updatedAt: nowIso()
  })
  return upsertTask(nextTask)
}

function refreshBatchStatus(batchId = '') {
  if (!batchId) {
    return null
  }
  const state = getMainChainState()
  const batches = state.batches || {}
  const batch = batches.byId && batches.byId[batchId]
  if (!batch) {
    return null
  }
  const taskIds = Array.isArray(batch.taskIds) ? batch.taskIds : []
  const tasks = (state.tasks && state.tasks.byId) || {}
  const completedCount = taskIds.filter((taskId) => tasks[taskId] && normalizeGenerationStatus(tasks[taskId].status) === GENERATION_STATUSES.COMPLETED).length
  const failedCount = taskIds.filter((taskId) => {
    const status = tasks[taskId] && normalizeGenerationStatus(tasks[taskId].status)
    return status === GENERATION_STATUSES.FAILED || status === GENERATION_STATUSES.RESULT_MISSING
  }).length
  const finishedCount = completedCount + failedCount
  let status = GENERATION_STATUSES.GENERATING
  let statusText = '生成中'

  if (!taskIds.length) {
    status = GENERATION_STATUSES.PENDING
    statusText = '等待生成'
  } else if (finishedCount >= taskIds.length && completedCount === taskIds.length) {
    status = GENERATION_STATUSES.COMPLETED
    statusText = '全部完成'
  } else if (finishedCount >= taskIds.length && completedCount === 0) {
    status = GENERATION_STATUSES.FAILED
    statusText = '失败'
  } else if (finishedCount > 0) {
    status = GENERATION_STATUSES.PARTIAL_SUCCESS
    statusText = '部分完成'
  }

  const nextBatch = {
    ...batch,
    totalCount: taskIds.length,
    completedCount,
    failedCount,
    status,
    statusText,
    updatedAt: nowIso()
  }
  return patchMainChainState({
    batches: {
      ...batches,
      byId: {
        ...(batches.byId || {}),
        [batchId]: nextBatch
      },
      allIds: Array.isArray(batches.allIds) ? batches.allIds : Object.keys(batches.byId || {})
    }
  }).batches.byId[batchId]
}

export function createTask(options = {}) {
  const normalizedOptions = normalizeGenerationTaskOptions(options)
  const taskId = normalizedOptions.taskId || createTaskId()
  const createdAt = nowIso()
  const type = normalizeTaskType(normalizedOptions.type || normalizedOptions.taskType)
  const input = normalizeTaskInput(normalizedOptions.input || {}, normalizedOptions.params || {})
  return upsertTask(createTaskEntity({
    taskId,
    clientTaskId: normalizedOptions.clientTaskId || taskId,
    type,
    taskType: type,
    taskSource: normalizedOptions.taskSource || normalizedOptions.source || TASK_SOURCE.MINIAPP,
    source: normalizedOptions.taskSource || normalizedOptions.source || TASK_SOURCE.MINIAPP,
    projectId: normalizedOptions.projectId || '',
    batchId: normalizedOptions.batchId || '',
    channel: normalizedOptions.channel || '',
    input,
    expectedOutputCount: normalizedOptions.expectedOutputCount,
    completedOutputCount: 0,
    failedOutputCount: 0,
    params: {
      ...(normalizedOptions.params || {})
    },
    status: GENERATION_STATUSES.PENDING,
    stage: GENERATION_STATUSES.PENDING,
    progress: 5,
    statusText: '任务已创建，等待执行',
    result: {
      image: '',
      coverUrl: '',
      items: [],
      outputType: (input.options && input.options.outputType) || '',
      meta: {
        mock: normalizedOptions.mock !== false,
        provider: normalizedOptions.provider || 'mock'
      }
    },
    mock: normalizedOptions.mock !== false,
    provider: normalizedOptions.provider || 'mock',
    createdAt,
    updatedAt: createdAt,
    submittedAt: createdAt,
    control: {
      canRetry: false,
      canContinuePolling: false,
      lastTaskId: taskId
    }
  }))
}

function getTaskImageUrl(task = {}) {
  const input = task.input || {}
  const assets = input.assets || {}
  return input.imageUrl ||
    input.image_url ||
    normalizeImageUrl(assets.frontImage) ||
    normalizeImageUrl(assets.personImage) ||
    normalizeImageUrl(assets.modelImage) ||
    normalizeImageUrl(assets.clothImage) ||
    normalizeImageUrl(assets.cloth_image) ||
    normalizeImageUrl(assets.styleImage) ||
    normalizeImageUrl(assets.style_image)
}

async function ensureWanxInputImage(task) {
  const taskId = task.taskId || ''
  const input = task.input || {}
  const assets = input.assets || {}
  const clothImage = assets.clothImage || assets.cloth_image || {}
  const currentImageUrl = getTaskImageUrl(task)

  if (isCloudFileId(currentImageUrl) || isHttpsUrl(currentImageUrl)) {
    patchTask(taskId, {
      input: {
        imageUrl: currentImageUrl,
        image_url: currentImageUrl
      }
    })
    return currentImageUrl
  }

  const localPath = clothImage.localPath ||
    clothImage.path ||
    clothImage.tempFilePath ||
    currentImageUrl ||
    ''

  if (!localPath || !isLocalImagePath(localPath)) {
    return currentImageUrl
  }

  if (!hasCloudUploadFile() || !ensureCloudReady()) {
    throw {
      errorCode: 'WX_CLOUD_UPLOAD_UNAVAILABLE',
      message: 'wx.cloud.uploadFile is unavailable'
    }
  }

  console.log('[taskLayer:wanx] upload input image start', {
    taskId,
    hasLocalPath: !!localPath
  })

  const uploadResult = await uploadFileToCloud(localPath, taskId)
  const fileId = uploadResult.fileID || uploadResult.fileId || ''
  if (!fileId) {
    throw {
      errorCode: 'WX_CLOUD_UPLOAD_NO_FILE_ID',
      message: 'wx.cloud.uploadFile did not return fileID'
    }
  }

  patchTask(taskId, {
    input: {
      imageUrl: fileId,
      image_url: fileId,
      assets: {
        clothImage: {
          ...clothImage,
          localPath,
          fileId,
          fileID: fileId,
          fileUrl: ''
        }
      }
    }
  })

  console.log('[taskLayer:wanx] upload input image success', {
    taskId,
    hasFileId: !!fileId
  })

  return fileId
}

function buildWanxPrompt(task = {}) {
  const input = task.input || {}
  const params = input.params || {}
  const options = input.options || {}
  const promptDraft = params.promptDraft || ''
  if (promptDraft) {
    return promptDraft
  }
  return [
    '服装商品图，主体清晰，商业摄影质感',
    task.type || task.taskType ? `任务类型：${task.type || task.taskType}` : '',
    params.outputUsage || options.outputType ? `用途：${params.outputUsage || options.outputType}` : '',
    params.sceneType ? `场景：${params.sceneType}` : '',
    params.styleTag ? `风格：${params.styleTag}` : '',
    params.fullAdvancedPromptSummary || params.optionPromptSummary || params.customPromptSummary || ''
  ].filter(Boolean).join('，')
}

function normalizeCloudFunctionResult(response = {}) {
  const result = response.result || response
  const data = result.data || result
  const rawItems = Array.isArray((data.result || {}).items)
    ? data.result.items
    : Array.isArray(data.items)
      ? data.items
      : []
  const resultImageUrl = data.resultImageUrl || data.result_image_url || data.imageUrl || data.image_url || ''
  return {
    ok: data.ok === true || data.success === true,
    success: data.success === true || data.ok === true,
    taskId: data.taskId || data.task_id || '',
    status: data.status || '',
    provider: data.provider || 'wanx',
    resultImageUrl,
    resultItems: rawItems.length ? rawItems : (resultImageUrl ? [{ imageUrl: resultImageUrl }] : []),
    errorCode: data.errorCode || data.error_code || data.code || '',
    message: data.message || data.errorMessage || data.error_message || '',
    modelVersion: data.modelVersion || data.model || '',
    providerRequestId: data.providerRequestId || data.requestId || '',
    providerCode: data.providerCode || '',
    providerMessage: data.providerMessage || '',
    failureStage: data.failureStage || '',
    httpStatus: Number(data.httpStatus || 0),
    timedOut: data.timedOut === true,
    quotaRecordId: data.quotaRecordId || '',
    quotaStatus: data.quotaStatus || '',
    quotaErrorCode: data.quotaErrorCode || '',
    resultMode: data.resultMode || '',
    isExperimental: data.isExperimental === true,
    raw: data.raw || null
  }
}

function getExpectedOutputCount(task = {}) {
  const input = task.input || {}
  const params = input.params || task.params || {}
  const options = input.options || {}
  const values = [task.expectedOutputCount, task.outputCount, params.expectedOutputCount, params.outputCount, options.expectedOutputCount, options.outputCount]
  const count = values.map(Number).find((value) => Number.isFinite(value) && value > 0)
  return Math.max(1, count || 1)
}

function buildWanxSuccessPatch(task, wanxResult, persistedItems = []) {
  const first = persistedItems[0] || {}
  const imageUrl = first.fileId || first.fileUrl || first.imageUrl || ''
  const assetIds = persistedItems.map((item) => item.assetId).filter(Boolean)
  const expectedOutputCount = getExpectedOutputCount(task)
  const completedOutputCount = persistedItems.length
  const failedOutputCount = Math.max(0, expectedOutputCount - completedOutputCount)
  const allCompleted = completedOutputCount >= expectedOutputCount
  const completedAt = nowIso()
  return {
    status: allCompleted ? GENERATION_STATUSES.COMPLETED : GENERATION_STATUSES.PARTIAL_SUCCESS,
    stage: allCompleted ? 'result_ready' : 'partial_success',
    progress: Math.min(100, Math.round((completedOutputCount / expectedOutputCount) * 100)),
    statusText: allCompleted ? '已完成' : '部分完成',
    resultImageUrl: imageUrl,
    result_image_url: imageUrl,
    coverFileId: imageUrl,
    assetIds,
    expectedOutputCount,
    completedOutputCount,
    failedOutputCount,
    resultAccessInvalid: false,
    provider: 'wanx',
    mock: false,
    result: {
      image: imageUrl,
      imageUrl,
      image_url: imageUrl,
      coverUrl: imageUrl,
      outputType: ((task.input || {}).options || {}).outputType || '',
      provider: 'wanx',
      mock: false,
      expectedOutputCount,
      completedOutputCount,
      failedOutputCount,
      items: persistedItems,
      meta: {
        provider: 'wanx',
        modelVersion: wanxResult.modelVersion || '',
        providerRequestId: wanxResult.providerRequestId || '',
        quotaRecordId: wanxResult.quotaRecordId || '',
        quotaStatus: wanxResult.quotaStatus || '',
        quotaErrorCode: wanxResult.quotaErrorCode || '',
        resultMode: wanxResult.resultMode || '',
        isExperimental: wanxResult.isExperimental === true,
        deliveryEligible: wanxResult.isExperimental !== true,
        raw: wanxResult.raw || null,
        completedAt
      }
    },
    completedAt: allCompleted ? completedAt : '',
    updatedAt: completedAt,
    error: {
      type: '',
      code: '',
      message: '',
      retryable: false
    },
    control: {
      canRetry: false,
      canContinuePolling: false,
      lastTaskId: task.taskId
    }
  }
}

function buildWanxResultMissingPatch(task, error = {}) {
  const originalErrorCode = error.errorCode || error.code || 'RESULT_MISSING'
  return {
    status: GENERATION_STATUSES.RESULT_MISSING,
    stage: GENERATION_STATUSES.RESULT_MISSING,
    progress: 0,
    statusText: '生成结果未保存，请检查或重试',
    expectedOutputCount: getExpectedOutputCount(task),
    completedOutputCount: 0,
    resultAccessInvalid: true,
    resultImageUrl: '',
    result_image_url: '',
    coverFileId: '',
    assetIds: [],
    result: {
      items: [],
      expectedOutputCount: getExpectedOutputCount(task),
      completedOutputCount: 0,
      provider: 'wanx',
      mock: false
    },
    error: {
      type: 'result_persistence',
      code: 'result_persist_failed',
      message: error.message || '生成结果未保存，请检查或重试',
      retryable: true,
      providerCode: originalErrorCode,
      failureStage: 'result_persist'
    },
    control: {
      canRetry: true,
      canContinuePolling: false,
      lastTaskId: task.taskId
    },
    completedAt: '',
    updatedAt: nowIso()
  }
}

function buildWanxFailurePatch(task, error) {
  const previousResult = task.result || {}
  const previousMeta = previousResult.meta || {}
  return {
    status: GENERATION_STATUSES.FAILED,
    stage: 'error',
    progress: 0,
    statusText: 'Wanx 生成失败',
    provider: 'wanx',
    result: {
      ...previousResult,
      items: Array.isArray(previousResult.items) ? previousResult.items : [],
      meta: {
        ...previousMeta,
        provider: 'wanx',
        quotaRecordId: (error && error.quotaRecordId) || previousMeta.quotaRecordId || '',
        quotaStatus: (error && error.quotaStatus) || previousMeta.quotaStatus || '',
        quotaErrorCode: (error && error.quotaErrorCode) || previousMeta.quotaErrorCode || '',
        providerCode: (error && error.providerCode) || previousMeta.providerCode || '',
        providerMessage: (error && error.providerMessage) || previousMeta.providerMessage || '',
        failureStage: (error && error.failureStage) || previousMeta.failureStage || '',
        httpStatus: Number((error && error.httpStatus) || previousMeta.httpStatus || 0),
        timedOut: Boolean((error && error.timedOut) || previousMeta.timedOut)
      }
    },
    error: {
      type: 'generate',
      code: (error && (error.errorCode || error.code)) || 'WANX_CALL_FAILED',
      message: (error && error.message) || 'Wanx call failed',
      retryable: true
    },
    control: {
      canRetry: true,
      canContinuePolling: false,
      lastTaskId: task.taskId
    }
  }
}

function fallbackToLocalMock(task, error) {
  console.warn('[taskLayer:wanx] cloud call failed, fallback to local mock', {
    taskId: task && task.taskId,
    type: task && (task.type || task.taskType),
    errorCode: (error && (error.errorCode || error.code)) || 'WANX_CALL_FAILED'
  })
  patchTask(task.taskId, {
    ...buildWanxFailurePatch(task, error),
    fallbackReason: (error && error.message) || 'Wanx call failed'
  })
  return simulateTask(task.taskId, {
    delay: 600
  })
}

export async function runWanxTask(task, options = {}) {
  const sourceTask = typeof task === 'string' ? getTask(task) : task
  if (!sourceTask || !sourceTask.taskId) {
    throw new Error('task is required')
  }

  const taskId = sourceTask.taskId
  patchTask(taskId, {
    status: GENERATION_STATUSES.GENERATING,
    stage: 'generating',
    progress: 35,
    statusText: 'Wanx 生成处理中',
    provider: 'wanx',
    mock: false,
    control: {
      canRetry: false,
      canContinuePolling: false,
      lastTaskId: taskId
    }
  })

  if (!hasCloudCallFunction() || !ensureCloudReady()) {
    if (options.fallbackToMock === false) {
      const failedTask = patchTask(taskId, buildWanxFailurePatch(sourceTask, {
        errorCode: 'WX_CLOUD_UNAVAILABLE',
        message: 'wx.cloud.callFunction is unavailable'
      }))
      refreshBatchStatus(failedTask && failedTask.batchId)
      return failedTask
    }
    return fallbackToLocalMock(sourceTask, {
      errorCode: 'WX_CLOUD_UNAVAILABLE',
      message: 'wx.cloud.callFunction is unavailable'
    })
  }

  try {
    const latestTask = getTask(taskId) || sourceTask
    const garmentContract = isGarmentReplaceTask(latestTask)
      ? buildGarmentReplaceCloudParams(latestTask)
      : null
    const patternContract = isPatternStructureTask(latestTask)
      ? buildPatternStructureCloudParams(latestTask)
      : null
    if (garmentContract && !garmentContract.ok) {
      throw {
        errorCode: garmentContract.errorCode || 'GARMENT_REPLACE_INVALID_INPUT',
        message: garmentContract.message || 'Garment replacement input is invalid'
      }
    }
    if (patternContract && !patternContract.ok) {
      throw {
        errorCode: patternContract.errorCode || 'PATTERN_STRUCTURE_INVALID_INPUT',
        message: patternContract.message || 'Pattern structure input is invalid'
      }
    }
    const imageUrl = garmentContract
      ? garmentContract.input.personImage
      : patternContract
        ? patternContract.input.frontImage
        : await ensureWanxInputImage(latestTask)
    const finalPrompt = buildWanxPrompt(latestTask)
    const inputAssets = ((latestTask.input || {}).assets) || {}
    const referenceParams = {
      poseReferenceImage: normalizeImageUrl(inputAssets.poseReferenceImage),
      patternReferenceImage: normalizeImageUrl(inputAssets.patternReferenceImage),
      styleReferenceImage: normalizeImageUrl(inputAssets.styleReferenceImage),
      fabricReferenceImage: normalizeImageUrl(inputAssets.fabricReferenceImage),
      sceneReferenceImage: normalizeImageUrl(inputAssets.sceneImage || inputAssets.sceneReferenceImage),
      identityReferenceImage: normalizeImageUrl(inputAssets.identityReferenceImage || inputAssets.headReferenceImage || inputAssets.faceReferenceImage)
    }
    console.log('[taskLayer:wanx] cloud call start', {
      taskId,
      type: latestTask.type || latestTask.taskType,
      hasImageUrl: !!imageUrl,
      imageSource: isCloudFileId(imageUrl) ? 'cloud_file_id' : (isHttpsUrl(imageUrl) ? 'https_url' : 'other')
    })
    const response = await wx.cloud.callFunction({
      name: WANX_FUNCTION_NAME,
      data: {
        taskId,
        type: latestTask.type || latestTask.taskType || '',
        prompt: finalPrompt,
        imageUrl,
        params: {
          ...(((latestTask.input || {}).params) || {}),
          ...(((latestTask.input || {}).options) || {}),
          ...Object.fromEntries(Object.entries(referenceParams).filter(([, value]) => Boolean(value))),
          ...((garmentContract && garmentContract.params) || {}),
          ...((patternContract && patternContract.params) || {})
        }
      }
    })
    const wanxResult = normalizeCloudFunctionResult(response)
    if (!wanxResult.ok) {
      throw {
        errorCode: wanxResult.errorCode || 'WANX_EMPTY_RESULT',
        message: wanxResult.message || 'Wanx did not return result image',
        raw: wanxResult.raw,
        quotaRecordId: wanxResult.quotaRecordId,
        quotaStatus: wanxResult.quotaStatus,
        quotaErrorCode: wanxResult.quotaErrorCode,
        providerCode: wanxResult.providerCode,
        providerMessage: wanxResult.providerMessage,
        failureStage: wanxResult.failureStage,
        httpStatus: wanxResult.httpStatus,
        timedOut: wanxResult.timedOut
      }
    }
    if (!wanxResult.resultItems.length) {
      const missingTask = patchTask(taskId, buildWanxResultMissingPatch(latestTask, {
        errorCode: 'WANX_EMPTY_RESULT',
        message: wanxResult.message || 'Provider reported success without an image'
      }))
      refreshBatchStatus(missingTask && missingTask.batchId)
      return missingTask
    }
    let persistedItems = []
    try {
      persistedItems = await persistWanxResultItems(latestTask, wanxResult.resultItems)
    } catch (persistError) {
      const missingTask = patchTask(taskId, buildWanxResultMissingPatch(latestTask, persistError))
      refreshBatchStatus(missingTask && missingTask.batchId)
      return missingTask
    }
    const nextTask = patchTask(taskId, buildWanxSuccessPatch(latestTask, wanxResult, persistedItems))
    refreshBatchStatus(nextTask && nextTask.batchId)
    console.log('[taskLayer:wanx] success', {
      taskId,
      hasResultImageUrl: !!wanxResult.resultImageUrl
    })
    return nextTask
  } catch (error) {
    if (options.fallbackToMock === false || isGarmentReplaceTask(sourceTask) || isPatternStructureTask(sourceTask)) {
      const failedTask = patchTask(taskId, buildWanxFailurePatch(sourceTask, error))
      refreshBatchStatus(failedTask && failedTask.batchId)
      return failedTask
    }
    return fallbackToLocalMock(sourceTask, error)
  }
}

function buildMockResult(task) {
  const input = task.input || {}
  const assets = input.assets || {}
  const params = input.params || task.params || {}
  const existingMeta = (task.result && task.result.meta) || {}
  const sourceImage =
    normalizeImageUrl(assets.baseImage) ||
    normalizeImageUrl(assets.personImage) ||
    normalizeImageUrl(assets.modelImage) ||
    normalizeImageUrl(assets.clothImage) ||
    normalizeImageUrl(assets.cloth_image) ||
    normalizeImageUrl(assets.styleImage) ||
    normalizeImageUrl(assets.style_image)
  const resultImage = sourceImage || '/static/ui/work-placeholder.png'
  const completedAt = nowIso()
  return {
    status: GENERATION_STATUSES.COMPLETED,
    stage: 'result_ready',
    progress: 100,
    statusText: 'mock 生成完成',
    resultImageUrl: resultImage,
    result_image_url: resultImage,
    result: {
      image: resultImage,
      imageUrl: resultImage,
      image_url: resultImage,
      coverUrl: resultImage,
      outputType: (input.options && input.options.outputType) || '',
      provider: task.provider || 'mock_flow',
      mock: true,
      items: [
        {
          resultId: `${task.taskId}_result_1`,
          assetId: `mock_asset_${task.taskId}_1`,
          fileId: /^cloud:\/\//.test(resultImage) ? resultImage : '',
          fileUrl: resultImage,
          imageUrl: resultImage,
          type: 'image',
          mock: true,
          environment: params.environment || '',
          capabilityStatus: params.capabilityStatus || 'mock_only',
          isExperimental: false
        }
      ],
      meta: {
        ...existingMeta,
        mock: true,
        provider: task.provider || 'mock_flow',
        environment: params.environment || existingMeta.environment || '',
        capabilityStatus: params.capabilityStatus || existingMeta.capabilityStatus || 'mock_only',
        isExperimental: false,
        testAccountId: params.testAccountId || existingMeta.testAccountId || '',
        deliveryEligible: false,
        simulatedAt: completedAt
      }
    },
    mock: true,
    provider: task.provider || 'mock_flow',
    completedAt,
    updatedAt: completedAt,
    control: {
      canRetry: false,
      canContinuePolling: false,
      lastTaskId: task.taskId
    }
  }
}

export function simulateTask(taskId, options = {}) {
  const normalizedTaskId = String(taskId || '').trim()
  const task = getTask(normalizedTaskId)
  if (!task) {
    return null
  }

  if (ACTIVE_SIMULATORS[normalizedTaskId]) {
    return task
  }

  patchTask(normalizedTaskId, {
    status: GENERATION_STATUSES.GENERATING,
    stage: 'generating',
    progress: 35,
    statusText: 'mock 生成处理中',
    control: {
      canRetry: false,
      canContinuePolling: false,
      lastTaskId: normalizedTaskId
    }
  })

  const delay = typeof options.delay === 'number' ? options.delay : 900
  ACTIVE_SIMULATORS[normalizedTaskId] = setTimeout(() => {
    delete ACTIVE_SIMULATORS[normalizedTaskId]
    const latestTask = getTask(normalizedTaskId)
    if (!latestTask || [GENERATION_STATUSES.COMPLETED, GENERATION_STATUSES.FAILED].includes(normalizeGenerationStatus(latestTask.status))) {
      return
    }
    if (options.shouldFail) {
      const failedTask = patchTask(normalizedTaskId, {
        status: GENERATION_STATUSES.FAILED,
        stage: 'error',
        progress: 0,
        statusText: options.errorMessage || 'mock 生成失败',
        error: {
          type: 'generate',
          message: options.errorMessage || 'mock 生成失败',
          retryable: true
        },
        control: {
          canRetry: true,
          canContinuePolling: false,
          lastTaskId: normalizedTaskId
        }
      })
      refreshBatchStatus(failedTask && failedTask.batchId)
      return
    }
    const nextTask = patchTask(normalizedTaskId, buildMockResult(latestTask))
    refreshBatchStatus(nextTask && nextTask.batchId)
  }, delay)

  return getTask(normalizedTaskId)
}

export function createTaskAndRun(options = {}) {
  const normalizedOptions = normalizeGenerationTaskOptions(options)
  const actionType = normalizedOptions.type || normalizedOptions.taskType || ''
  const params = ((normalizedOptions.input || {}).params) || normalizedOptions.params || {}
  const isRealProviderTest = params.realProviderTest === true && params.resultMode === 'real_provider_test'
  if (!isRealProviderTest) {
    assertIdentityProviderCapability(actionType)
    assertGarmentProviderCapability(actionType, params.garmentMode || params.replaceMode || '')
  }
  const idempotencyKey = String(
    normalizedOptions.clientTaskId ||
    ((normalizedOptions.input || {}).params || {}).idempotencyKey ||
    ''
  )
  if (idempotencyKey) {
    const existingTask = listTasks().find((candidate = {}) => {
      const candidateParams = ((candidate.input || {}).params) || candidate.params || {}
      return candidate.clientTaskId === idempotencyKey || candidateParams.idempotencyKey === idempotencyKey
    })
    if (existingTask) return existingTask
  }
  const task = createTask({
    ...normalizedOptions,
    provider: 'wanx',
    mock: false
  })
  runWanxTask(task, normalizedOptions.run || {}).catch((error) => {
    console.warn('[taskLayer:wanx] async run failed', {
      taskId: task.taskId,
      type: task.type || task.taskType,
      errorCode: (error && (error.errorCode || error.code)) || 'WANX_ASYNC_RUN_FAILED'
    })
  })
  return task
}

export function createTaskAndSimulate(options = {}) {
  const normalizedOptions = normalizeGenerationTaskOptions(options)
  const idempotencyKey = String(
    normalizedOptions.clientTaskId ||
    ((normalizedOptions.input || {}).params || {}).idempotencyKey ||
    ''
  )
  if (idempotencyKey) {
    const existingTask = listTasks().find((candidate = {}) => {
      const candidateParams = ((candidate.input || {}).params) || candidate.params || {}
      return candidate.clientTaskId === idempotencyKey || candidateParams.idempotencyKey === idempotencyKey
    })
    if (existingTask) return existingTask
  }
  const task = createTask({
    ...normalizedOptions,
    provider: normalizedOptions.provider || 'mock_flow',
    mock: true
  })
  return simulateTask(task.taskId, normalizedOptions.simulate || {})
}
