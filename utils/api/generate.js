import { initCloudBase, isCloudBaseReady } from '../cloudbase/init'

const AI_GENERATE_FUNCTION_NAME = 'ai_generate'

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

function getPayload(rawData) {
  let parsed = rawData

  if (typeof rawData === 'string') {
    parsed = JSON.parse(rawData)
  }

  return {
    parsed,
    payload: parsed && parsed.data ? parsed.data : parsed
  }
}

function safeStringify(value) {
  try {
    return JSON.stringify(value)
  } catch (error) {
    return ''
  }
}

function normalizeGenerateErrorMessage(source) {
  const responseData = source && source.data
  const message =
    (source && source.message) ||
    (source && source.errMsg) ||
    (responseData && responseData.message) ||
    (responseData && responseData.msg) ||
    (responseData && responseData.error) ||
    safeStringify(responseData) ||
    safeStringify(source) ||
    'generateResult failed'
  return message || 'generateResult failed'
}

function normalizeGenerateResponse(rawData) {
  const { parsed, payload } = getPayload(rawData)
  const success = typeof payload.success === 'boolean' ? payload.success : true
  const code = payload.code
  const message = normalizeGenerateErrorMessage({ data: payload })

  if (!success || (typeof code === 'number' && code !== 0)) {
    throw new Error(message)
  }

  return {
    taskId: payload && (payload.task_id || payload.taskId || ''),
    taskStatus: payload && (payload.status || payload.task_status || payload.taskStatus || ''),
    resultImageUrl:
      (payload && (payload.result_image_url || payload.resultImageUrl || payload.image_url || payload.imageUrl)) || '',
    progress: payload && typeof payload.progress === 'number' ? payload.progress : 0,
    errorMessage: (payload && (payload.error_message || payload.errorMessage || '')) || '',
    raw: parsed
  }
}

function summarizeGenerateImageInput(image = {}) {
  const fileId = image.file_id || image.fileId || image.fileID || ''
  const fileUrl = image.file_url || image.fileUrl || image.image_url || image.imageUrl || image.url || ''
  return {
    hasFileId: !!fileId,
    hasFileUrl: !!fileUrl,
    hasHttpsUrl: /^https:\/\//.test(String(fileUrl || '')),
    hasCloudFileId: /^cloud:\/\//.test(String(fileId || ''))
  }
}

function summarizeAdvancedPromptPayload(payload = {}) {
  return {
    hasFullAdvancedPromptSummary: !!(payload && payload.fullAdvancedPromptSummary),
    fullAdvancedPromptSummaryLength: String((payload && payload.fullAdvancedPromptSummary) || '').length,
    hasPromptDraft: !!(payload && payload.promptDraft),
    promptDraftLength: String((payload && payload.promptDraft) || '').length,
    hasPromptPlan: !!(payload && payload.promptPlan),
    generationMode: (payload && payload.generationMode) || '',
    hasNegativePrompt: !!(payload && payload.negativePrompt),
    advancedCustomPromptCount: Object.keys((payload && payload.advancedCustomPrompts) || {}).length,
    advancedOptionPromptCount: Object.keys((payload && payload.advancedOptionPrompts) || {}).length,
    costActionType: (payload && payload.costActionType) || '',
    dryRun: !!(payload && payload.dryRun),
    provider: (payload && payload.provider) || '',
    hasQuotaRecordId: !!(payload && payload.quotaRecordId),
    hasIdempotencyKey: !!(payload && payload.idempotencyKey)
  }
}

function maskShortId(value = '') {
  const text = String(value || '')
  if (!text) {
    return ''
  }
  return text.length <= 12 ? text : `${text.slice(0, 4)}...${text.slice(-6)}`
}

function sanitizeLogText(value = '', maxLength = 120) {
  return String(value || '')
    .replace(/https?:\/\/\S+/g, '[url]')
    .replace(/cloud:\/\/\S+/g, '[file]')
    .replace(/fileID[:=]\s*\S+/gi, 'fileID=[hidden]')
    .replace(/localPath[:=]\s*\S+/gi, 'localPath=[hidden]')
    .slice(0, maxLength)
}

function summarizePromptMeta(meta = {}) {
  return {
    hasFullAdvancedPromptSummary: !!meta.hasFullAdvancedPromptSummary,
    fullAdvancedPromptSummaryLength: Number(meta.fullAdvancedPromptSummaryLength || 0),
    advancedCustomPromptCount: Number(meta.advancedCustomPromptCount || 0),
    advancedOptionPromptCount: Number(meta.advancedOptionPromptCount || 0),
    positivePromptLength: Number(meta.positivePromptLength || 0),
    negativePromptLength: Number(meta.negativePromptLength || 0),
    providerTaskType: meta.providerTaskType || '',
    costActionType: meta.costActionType || ''
  }
}

function summarizeGenerateCloudResponse(responseOrResult = {}) {
  const source = responseOrResult || {}
  const result = Object.prototype.hasOwnProperty.call(source, 'result')
    ? source.result || {}
    : source
  const data = result && result.data ? result.data : {}
  const taskId = result.taskId || result.task_id || data.taskId || data.task_id || ''
  const resultImageUrl = result.resultImageUrl || result.imageUrl || data.resultImageUrl || data.imageUrl || ''
  const resultImageUrlSnake = result.result_image_url || result.image_url || data.result_image_url || data.image_url || ''
  return {
    errMsg: source.errMsg || '',
    hasRequestID: !!(source.requestID || source.requestId || result.requestID || result.requestId),
    success: typeof result.success === 'boolean' ? result.success : undefined,
    ok: typeof result.ok === 'boolean' ? result.ok : undefined,
    code: result.code,
    status: result.status || result.taskStatus || result.task_status || data.status || '',
    hasTaskId: !!taskId,
    taskId: maskShortId(taskId),
    hasResultImageUrl: !!resultImageUrl,
    hasResultImageUrlSnake: !!resultImageUrlSnake,
    provider: data.provider || result.provider || '',
    mock: !!(data.mock || result.mock),
    fallback: !!(data.fallback || result.fallback),
    providerDryRunResult: summarizeDryRunResult(data.providerDryRunResult || result.providerDryRunResult || {}),
    advancedPromptMeta: summarizePromptMeta(data.advancedPromptMeta || result.advancedPromptMeta || {}),
    providerPromptMeta: summarizePromptMeta(data.providerPromptMeta || result.providerPromptMeta || {}),
    costActionType:
      (data.advancedPromptMeta && data.advancedPromptMeta.costActionType) ||
      (data.providerPromptMeta && data.providerPromptMeta.costActionType) ||
      data.costActionType ||
      result.costActionType ||
      '',
    errorCode: result.errorCode || data.errorCode || '',
    message: sanitizeLogText(result.message || data.message || result.errorMessage || '')
  }
}

function summarizeDryRunResult(result = {}) {
  return {
    ok: typeof result.ok === 'boolean' ? result.ok : undefined,
    dryRun: !!result.dryRun,
    providerTaskType: result.providerTaskType || '',
    status: result.status || '',
    providerReceivedRequest: !!result.providerReceivedRequest,
    providerAcceptedTask: !!result.providerAcceptedTask,
    shouldRollbackQuota: !!result.shouldRollbackQuota,
    shouldEnterPolling: !!result.shouldEnterPolling,
    errorCode: result.errorCode || ''
  }
}

function summarizeGenerateError(error) {
  return {
    errMsg: error && error.errMsg,
    code: error && (error.code || error.errCode || error.errorCode),
    message: sanitizeLogText(error && error.message)
  }
}

export async function generateResult(payload) {
  console.log('[generateResult] advanced prompt summary', summarizeAdvancedPromptPayload(payload || {}))
  console.log('[generateResult] cloud call start', {
    functionName: AI_GENERATE_FUNCTION_NAME,
    modelType: payload && payload.modelType,
    scene: payload && payload.scene,
    clothImage: summarizeGenerateImageInput((payload && payload.cloth_image) || {}),
    styleImage: summarizeGenerateImageInput((payload && payload.style_image) || {})
  })

  try {
    const cloudReady = ensureCloudReady()
    const callable = hasCloudCallFunction()
    if (!cloudReady || !callable) {
      throw new Error(`Cloud function unavailable ready=${cloudReady} callable=${callable}`)
    }

    const response = await wx.cloud.callFunction({
      name: AI_GENERATE_FUNCTION_NAME,
      data: {
        action: 'generateResult',
        payload,
        ...payload
      }
    })

    const result = response && Object.prototype.hasOwnProperty.call(response, 'result')
      ? response.result
      : response

    console.log('[generateResult] cloud response raw summary', summarizeGenerateCloudResponse(response))
    console.log('[generateResult] cloud response result summary', summarizeGenerateCloudResponse(result))
    return normalizeGenerateResponse(result)
  } catch (err) {
    const normalizedMessage = normalizeGenerateErrorMessage(err)
    console.error('[generateResult] cloud call failed', {
      ...summarizeGenerateError(err),
      message: sanitizeLogText(normalizedMessage)
    })
    throw new Error(normalizedMessage)
  }
}

export { normalizeGenerateResponse }
