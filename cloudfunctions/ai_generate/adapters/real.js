const http = require('http')
const https = require('https')
const { URL } = require('url')
const { resolveProviderImageUrl } = require('../utils/resolveImageUrl')

const REAL_PROVIDER_ERROR_CODE = Object.freeze({
  MISSING_ENDPOINT: 'REAL_PROVIDER_MISSING_ENDPOINT',
  MISSING_API_KEY: 'REAL_PROVIDER_MISSING_API_KEY',
  MISSING_CLOTH_IMAGE: 'REAL_PROVIDER_MISSING_CLOTH_IMAGE',
  IMAGE_URL_RESOLVE_FAILED: 'REAL_PROVIDER_IMAGE_URL_RESOLVE_FAILED',
  HTTP_ERROR: 'REAL_PROVIDER_HTTP_ERROR',
  DISABLED: 'REAL_PROVIDER_DISABLED',
  NO_RESULT_IMAGE: 'REAL_PROVIDER_NO_RESULT_IMAGE',
  NOT_IMPLEMENTED: 'REAL_PROVIDER_NOT_IMPLEMENTED',
  TIMEOUT: 'REAL_PROVIDER_TIMEOUT',
  ASYNC_NOT_SUPPORTED: 'REAL_PROVIDER_ASYNC_NOT_SUPPORTED',
  UNSUPPORTED_RESULT_IMAGE_TYPE: 'UNSUPPORTED_RESULT_IMAGE_TYPE',
  ERROR: 'REAL_PROVIDER_ERROR'
})

const MAX_SAFE_RETRY_TIMES = 1
const PROVIDER_CONTRACT_VERSION = 'p8_provider_contract_v1'
const DEFAULT_REAL_REQUEST_TIMEOUT_MS = 65000
const MAX_PROVIDER_TOTAL_RUNTIME_MS = 90000
const DEFAULT_PROVIDER_POLL_INTERVAL_MS = 2500
const DEFAULT_PROVIDER_POLL_MAX_ATTEMPTS = 20
const PROVIDER_POLL_STATUS = Object.freeze({
  SUCCESS: new Set(['success', 'succeeded', 'completed', 'finished', 'done']),
  FAILED: new Set(['failed', 'error', 'cancelled', 'canceled', 'rejected']),
  PENDING: new Set(['pending', 'running', 'processing', 'submitted', 'queued', 'created'])
})

function validateRealProviderConfig(config = {}) {
  if (!config.endpoint) {
    return {
      ok: false,
      reason: 'missing_ai_api_endpoint',
      errorCode: REAL_PROVIDER_ERROR_CODE.MISSING_ENDPOINT
    }
  }

  if (!config.apiKey) {
    return {
      ok: false,
      reason: 'missing_ai_api_key',
      errorCode: REAL_PROVIDER_ERROR_CODE.MISSING_API_KEY
    }
  }

  return {
    ok: true,
    reason: '',
    errorCode: ''
  }
}

function validateRealProviderInput(input = {}) {
  const clothImage = input.clothImage || {}
  if (!clothImage.fileUrl && !clothImage.fileId && !clothImage.imageUrl && !clothImage.url) {
    return {
      ok: false,
      reason: 'missing_cloth_image',
      errorCode: REAL_PROVIDER_ERROR_CODE.MISSING_CLOTH_IMAGE
    }
  }

  return {
    ok: true,
    reason: '',
    errorCode: ''
  }
}

function validateFabricReplaceRealInput(input = {}) {
  if (!input.sourceTaskId) {
    return {
      ok: false,
      reason: 'missing_source_task_id',
      errorCode: 'FABRIC_REPLACE_MISSING_SOURCE_TASK_ID'
    }
  }

  if (!input.sourceImageUrl || !/^https:\/\//.test(input.sourceImageUrl)) {
    return {
      ok: false,
      reason: 'missing_or_invalid_source_image_url',
      errorCode: 'FABRIC_REPLACE_INVALID_SOURCE_IMAGE_URL'
    }
  }

  if (!input.fabricType) {
    return {
      ok: false,
      reason: 'missing_fabric_type',
      errorCode: 'FABRIC_REPLACE_MISSING_FABRIC_TYPE'
    }
  }

  if (!input.idempotencyKey) {
    return {
      ok: false,
      reason: 'missing_idempotency_key',
      errorCode: 'FABRIC_REPLACE_MISSING_IDEMPOTENCY_KEY'
    }
  }

  return {
    ok: true,
    reason: '',
    errorCode: ''
  }
}

function createFabricReplaceRealFailure(input = {}, validation = {}) {
  return {
    success: false,
    ok: false,
    action: 'fabricReplace',
    taskId: input.taskId || '',
    status: 'failed',
    resultImageUrl: '',
    message: validation.reason || 'fabric_replace_real_placeholder_invalid_input',
    data: {
      provider: 'real_placeholder',
      requestedProvider: 'fabric_replace',
      mock: false,
      fallback: false,
      actionType: 'fabric_replace',
      fabricType: input.fabricType || '',
      realProviderReady: false,
      errorCode: validation.errorCode || REAL_PROVIDER_ERROR_CODE.ERROR
    }
  }
}

function generateFabricReplaceRealPlaceholder(input = {}, config = {}) {
  const validation = validateFabricReplaceRealInput(input)
  if (!validation.ok) {
    console.warn('[ai_generate:fabricReplace] real placeholder input invalid', {
      taskId: input.taskId || '',
      sourceTaskId: input.sourceTaskId || '',
      fabricType: input.fabricType || '',
      reason: validation.reason,
      errorCode: validation.errorCode,
      hasSourceImageUrl: !!input.sourceImageUrl,
      hasIdempotencyKey: !!input.idempotencyKey
    })
    return createFabricReplaceRealFailure(input, validation)
  }

  console.warn('[ai_generate:fabricReplace] real route unavailable', {
    taskId: input.taskId || '',
    sourceTaskId: input.sourceTaskId || '',
    fabricType: input.fabricType || '',
    provider: config.provider || '',
    hasEndpoint: !!config.endpoint,
    hasApiKey: !!config.apiKey,
    hasSourceImageUrl: true,
    hasIdempotencyKey: true
  })

  return createFabricReplaceRealFailure(input, {
    reason: 'fabric_replace_provider_route_unavailable',
    errorCode: 'PROVIDER_ROUTE_NOT_IMPLEMENTED'
  })
}

function createFallbackResult(reason, errorCode, details = {}) {
  const publicErrorCode = getPublicErrorCode(errorCode)
  return {
    ok: false,
    success: false,
    reason,
    errorCode: publicErrorCode,
    fallbackErrorCode: publicErrorCode,
    details,
    fallbackToMock: false
  }
}

function getPublicErrorCode(errorCode) {
  if (errorCode === REAL_PROVIDER_ERROR_CODE.DISABLED) {
    return 'REAL_PROVIDER_DISABLED'
  }
  if (errorCode === REAL_PROVIDER_ERROR_CODE.MISSING_ENDPOINT) {
    return 'MISSING_AI_API_ENDPOINT'
  }
  if (errorCode === REAL_PROVIDER_ERROR_CODE.MISSING_API_KEY) {
    return 'MISSING_AI_API_KEY'
  }
  return errorCode || REAL_PROVIDER_ERROR_CODE.ERROR
}

function buildIdempotencyKey(input = {}) {
  const taskId = input.taskId || `task_${Date.now()}`
  const modelType = input.modelType || 'female'
  const scene = input.scene || 'white'
  return `ai_generate:${taskId}:${modelType}:${scene}`
}

function buildPrompt(input = {}) {
  const scene = input.scene || 'white'
  const modelType = input.modelType || 'female'
  return [
    'Generate a commercial fashion product image from the provided clothing reference image.',
    `Scene: ${scene}.`,
    `Model type: ${modelType}.`,
    'Keep the clothing color, print, silhouette, neckline, sleeves, hem, and fabric texture faithful.'
  ].join(' ')
}

function buildAliyunFluxRequestBody(input = {}, config = {}, resolvedInput = {}) {
  return {
    model: config.model || 'flux.1-dev',
    input: {
      messages: [
        {
          role: 'user',
          content: [
            {
              text: buildPrompt(input)
            },
            {
              image: resolvedInput.clothImageUrl
            }
          ]
        }
      ]
    },
    parameters: {
      n: 1,
      size: '1024*1024',
      prompt_extend: true,
      watermark: false
    }
  }
}

function buildRealProviderRequestPlan(input = {}, config = {}, resolvedInput = {}) {
  const body = buildAliyunFluxRequestBody(input, config, resolvedInput)
  const providerPromptMeta = input.providerPromptMeta || {}
  const quotaConsumedRecord = input.quotaConsumedRecord || {}
  const quotaRecordId =
    input.quotaRecordId ||
    quotaConsumedRecord.recordId ||
    quotaConsumedRecord._id ||
    ''
  const quotaRecordStatus =
    input.quotaRecordStatus ||
    quotaConsumedRecord.status ||
    ''
  const hasQuotaConsumeRecord =
    !!quotaRecordId &&
    String(quotaRecordStatus || '').toLowerCase() === 'consumed'
  return {
    contractVersion: PROVIDER_CONTRACT_VERSION,
    providerTaskType: providerPromptMeta.providerTaskType || input.providerTaskType || 'generic_fashion_image',
    costActionType: input.costActionType || providerPromptMeta.costActionType || '',
    sourceTaskId: input.sourceTaskId || input.taskId || '',
    clientTaskId: input.clientTaskId || input.taskId || '',
    quotaRecordId,
    quotaRecordStatus,
    providerReceivedRequest: false,
    providerAcceptedTask: false,
    endpoint: config.endpoint,
    pollEndpoint: config.pollEndpoint || config.statusEndpoint || '',
    pollIntervalMs: config.pollIntervalMs || DEFAULT_PROVIDER_POLL_INTERVAL_MS,
    pollMaxAttempts: config.pollMaxAttempts || DEFAULT_PROVIDER_POLL_MAX_ATTEMPTS,
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
      'X-Request-Id': buildIdempotencyKey(input)
    },
    body,
    timeoutMs: config.timeoutMs,
    retryTimes: config.retryTimes,
    effectiveRetryTimes: config.effectiveRetryTimes,
    retryBaseDelayMs: config.retryBaseDelayMs,
    idempotencyKey: buildIdempotencyKey(input),
    imageInputs: {
      hasSourceImageUrl: !!input.sourceImageUrl,
      hasClothImageUrl: !!resolvedInput.clothImageUrl,
      hasStyleImageUrl: !!resolvedInput.styleImageUrl
    },
    prompt: {
      promptMeta: providerPromptMeta,
      positivePromptLength: Number(providerPromptMeta.positivePromptLength || 0),
      negativePromptLength: Number(providerPromptMeta.negativePromptLength || 0)
    },
    params: {
      templateType: input.templateType || '',
      entryScene: input.entryScene || '',
      modelType: input.modelType || 'female',
      scene: input.scene || 'white',
      styleCode: input.styleCode || '',
      sceneCode: input.sceneCode || '',
      bodyType: input.bodyType || '',
      durationSec: input.durationSec || '',
      outputType: input.outputType || ''
    },
    safety: {
      allowRealProviderCall: config.enableRealProviderCall === true,
      hasQuotaConsumeRecord
    },
    model: config.model || 'flux.1-dev',
    resultCarrier: {
      type: 'image_url',
      fields: ['result_image_url', 'resultImageUrl', 'image_url', 'imageUrl']
    },
    payloadSummary: {
      taskId: input.taskId,
      modelType: input.modelType || 'female',
      scene: input.scene || 'white',
      hasClothImage: !!(input.clothImage && (input.clothImage.fileId || input.clothImage.fileUrl)),
      hasStyleImage: !!(input.styleImage && (input.styleImage.fileId || input.styleImage.fileUrl)),
      hasResolvedClothImageUrl: !!resolvedInput.clothImageUrl,
      clothImageSource: resolvedInput.clothImageSource || ''
    }
  }
}

function buildProviderContractError(errorCode, message = '', extra = {}) {
  return {
    ok: false,
    provider: 'real',
    providerTaskType: extra.providerTaskType || '',
    providerTaskId: extra.providerTaskId || '',
    status: 'failed',
    resultImageUrl: '',
    resultVideoUrl: '',
    resultItems: [],
    rawStatus: extra.rawStatus || '',
    providerReceivedRequest: !!extra.providerReceivedRequest,
    providerAcceptedTask: !!extra.providerAcceptedTask,
    shouldRollbackQuota: extra.shouldRollbackQuota !== undefined
      ? !!extra.shouldRollbackQuota
      : !extra.providerReceivedRequest && !extra.providerAcceptedTask,
    shouldEnterPolling: !!extra.shouldEnterPolling,
    errorCode,
    message,
    meta: {
      contractVersion: PROVIDER_CONTRACT_VERSION,
      costActionType: extra.costActionType || '',
      hasQuotaConsumeRecord: !!extra.hasQuotaConsumeRecord
    }
  }
}

function validateRealProviderRequestPlan(requestPlan = {}) {
  if (!requestPlan.safety || requestPlan.safety.allowRealProviderCall !== true) {
    return buildProviderContractError(
      'REAL_PROVIDER_DISABLED',
      '鐪熷疄 AI 鏈嶅姟鏆傛湭鍚敤',
      {
        providerTaskType: requestPlan.providerTaskType,
        costActionType: requestPlan.costActionType,
        providerReceivedRequest: false,
        providerAcceptedTask: false,
        shouldRollbackQuota: true,
        hasQuotaConsumeRecord: !!(requestPlan.safety && requestPlan.safety.hasQuotaConsumeRecord)
      }
    )
  }

  if (!requestPlan.safety.hasQuotaConsumeRecord) {
    return buildProviderContractError(
      'REAL_QUOTA_GUARD_REQUIRED',
      '缂哄皯 quota_guard consumed 娴佹按',
      {
        providerTaskType: requestPlan.providerTaskType,
        costActionType: requestPlan.costActionType,
        providerReceivedRequest: false,
        providerAcceptedTask: false,
        shouldRollbackQuota: false,
        hasQuotaConsumeRecord: false
      }
    )
  }

  if (!requestPlan.endpoint || !requestPlan.headers || !requestPlan.headers.Authorization) {
    return buildProviderContractError(
      'PROVIDER_CONFIG_MISSING',
      'provider 閰嶇疆缂哄け',
      {
        providerTaskType: requestPlan.providerTaskType,
        costActionType: requestPlan.costActionType,
        providerReceivedRequest: false,
        providerAcceptedTask: false,
        shouldRollbackQuota: true,
        hasQuotaConsumeRecord: requestPlan.safety.hasQuotaConsumeRecord
      }
    )
  }

  if (!requestPlan.body) {
    return buildProviderContractError(
      'PROVIDER_REQUEST_VALIDATION_FAILED',
      'provider 璇锋眰鍙傛暟鏍￠獙澶辫触',
      {
        providerTaskType: requestPlan.providerTaskType,
        costActionType: requestPlan.costActionType,
        providerReceivedRequest: false,
        providerAcceptedTask: false,
        shouldRollbackQuota: true,
        hasQuotaConsumeRecord: requestPlan.safety.hasQuotaConsumeRecord
      }
    )
  }

  return {
    ok: true,
    errorCode: '',
    message: ''
  }
}

function isRetryableStatusCode(statusCode) {
  return statusCode === 429 || statusCode >= 500
}

function getSafeTimeoutMs(value, fallback = DEFAULT_REAL_REQUEST_TIMEOUT_MS) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback
  }
  return Math.max(1000, Math.floor(parsed))
}

function getRemainingRuntimeMs(startedAt, maxTotalRuntimeMs) {
  return Math.max(0, maxTotalRuntimeMs - (Date.now() - startedAt))
}

function withAbortableTimeout(request, timeoutMs) {
  // P0-A: abort the underlying HTTP request on timeout; do not leave provider work running.
  const safeTimeoutMs = getSafeTimeoutMs(timeoutMs)
  let abortedByTimeout = false
  const timer = setTimeout(() => {
    abortedByTimeout = true
    const error = new Error('real provider request timeout')
    error.code = REAL_PROVIDER_ERROR_CODE.TIMEOUT
    error.abortConfirmed = true
    request.destroy(error)
  }, safeTimeoutMs)

  return {
    wasAbortedByTimeout: () => abortedByTimeout,
    clear: () => clearTimeout(timer)
  }
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

function parseJson(text) {
  if (!text) {
    return {}
  }
  try {
    return JSON.parse(text)
  } catch (error) {
    return {
      rawText: text
    }
  }
}

function isSafeNetworkRetryError(error) {
  const code = error && error.code
  return code === 'ENOTFOUND' ||
    code === 'ECONNREFUSED' ||
    code === 'EAI_AGAIN' ||
    code === 'ECONNRESET' ||
    code === 'ETIMEDOUT'
}

function sendJsonRequest(requestPlan = {}) {
  return new Promise((resolve, reject) => {
    let parsedUrl
    try {
      parsedUrl = new URL(requestPlan.endpoint)
    } catch (error) {
      reject(error)
      return
    }

    const client = parsedUrl.protocol === 'http:' ? http : https
    const bodyText = requestPlan.body ? JSON.stringify(requestPlan.body) : ''
    let settled = false
    const request = client.request({
      method: requestPlan.method || 'POST',
      protocol: parsedUrl.protocol,
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || undefined,
      path: `${parsedUrl.pathname}${parsedUrl.search}`,
      headers: bodyText
        ? {
            ...(requestPlan.headers || {}),
            'Content-Length': Buffer.byteLength(bodyText)
          }
        : {
            ...(requestPlan.headers || {})
          }
    }, (response) => {
      const chunks = []
      response.on('data', (chunk) => chunks.push(chunk))
      response.on('end', () => {
        if (settled) {
          return
        }
        settled = true
        abortTimer.clear()
        const text = Buffer.concat(chunks).toString('utf8')
        resolve({
          statusCode: response.statusCode,
          data: parseJson(text),
          canAbortRequest: true
        })
      })
    })

    request.on('error', (error) => {
      if (settled) {
        return
      }
      settled = true
      abortTimer.clear()
      if (abortTimer.wasAbortedByTimeout()) {
        error.code = REAL_PROVIDER_ERROR_CODE.TIMEOUT
        error.abortConfirmed = true
      }
      reject(error)
    })

    const abortTimer = withAbortableTimeout(request, requestPlan.timeoutMs || DEFAULT_REAL_REQUEST_TIMEOUT_MS)

    if (bodyText) {
      request.write(bodyText)
    }
    request.end()
  })
}

async function requestWithTimeoutAndRetry(requestPlan = {}) {
  const timeoutMs = getSafeTimeoutMs(requestPlan.timeoutMs)
  const requestedRetryTimes = requestPlan.retryTimes || 0
  const effectiveRetryTimes = Math.min(
    typeof requestPlan.effectiveRetryTimes === 'number' ? requestPlan.effectiveRetryTimes : requestedRetryTimes,
    MAX_SAFE_RETRY_TIMES
  )
  const retryBaseDelayMs = requestPlan.retryBaseDelayMs || 500
  const maxTotalRuntimeMs = getSafeTimeoutMs(
    requestPlan.maxTotalRuntimeMs,
    Math.min(MAX_PROVIDER_TOTAL_RUNTIME_MS, timeoutMs + retryBaseDelayMs * effectiveRetryTimes + 5000)
  )
  const startedAt = Date.now()
  const canAbortRequest = true
  let lastError = null
  let lastResponse = null
  let retrySkippedReason = ''

  for (let attempt = 0; attempt <= effectiveRetryTimes; attempt += 1) {
    const remainingMs = getRemainingRuntimeMs(startedAt, maxTotalRuntimeMs)
    if (remainingMs <= 1000) {
      retrySkippedReason = 'total_runtime_budget_exhausted'
      break
    }
    const attemptTimeoutMs = Math.min(timeoutMs, Math.max(1000, remainingMs - 500))
    console.info('[ai_generate] real provider request attempt', {
      taskId: requestPlan.payloadSummary && requestPlan.payloadSummary.taskId,
      model: requestPlan.model,
      attempt: attempt + 1,
      timeoutMs: attemptTimeoutMs,
      maxTotalRuntimeMs,
      retryTimes: requestedRetryTimes,
      effectiveRetryTimes,
      canAbortRequest
    })

    try {
      const response = await sendJsonRequest({
        ...requestPlan,
        timeoutMs: attemptTimeoutMs
      })
      lastResponse = response
      const statusCode = Number(response.statusCode || 0)
      if (statusCode >= 200 && statusCode < 300) {
        return {
          ok: true,
          statusCode,
          data: response.data
        }
      }

      const error = new Error(`real provider http status ${statusCode}`)
      error.statusCode = statusCode
      error.responseData = response.data
      lastError = error

      const retryable = isRetryableStatusCode(statusCode)
      console.warn('[ai_generate] real provider request failed', {
        taskId: requestPlan.payloadSummary && requestPlan.payloadSummary.taskId,
        model: requestPlan.model,
        attempt: attempt + 1,
        statusCode,
        retryable,
        timeoutMs: attemptTimeoutMs,
        maxTotalRuntimeMs,
        retryTimes: requestedRetryTimes,
        effectiveRetryTimes,
        canAbortRequest,
        fallbackReason: retryable ? 'real_provider_http_error' : 'real_provider_http_error'
      })

      if (!retryable || attempt >= effectiveRetryTimes) {
        retrySkippedReason = retryable ? 'retry_limit_reached' : 'non_retryable_status'
        break
      }
    } catch (error) {
      lastError = error
      const isTimeout = error && error.code === REAL_PROVIDER_ERROR_CODE.TIMEOUT
      const retryable = !isTimeout && isSafeNetworkRetryError(error)
      // P0-A: timeout means the request was aborted locally; do not retry this branch to avoid duplicate provider cost.
      console.warn('[ai_generate] real provider request failed', {
        taskId: requestPlan.payloadSummary && requestPlan.payloadSummary.taskId,
        model: requestPlan.model,
        attempt: attempt + 1,
        statusCode: 0,
        retryable,
        timeoutMs: attemptTimeoutMs,
        maxTotalRuntimeMs,
        retryTimes: requestedRetryTimes,
        effectiveRetryTimes,
        canAbortRequest,
        abortConfirmed: !!(error && error.abortConfirmed),
        fallbackReason: isTimeout ? 'real_provider_timeout' : 'real_provider_http_error',
        retrySkippedReason: isTimeout ? 'timeout_without_safe_retry' : ''
      })

      if (isTimeout) {
        retrySkippedReason = 'timeout_without_safe_retry'
        break
      }

      if (!retryable || attempt >= effectiveRetryTimes) {
        retrySkippedReason = retryable ? 'retry_limit_reached' : 'network_error_reach_unknown'
        break
      }
    }

    if (attempt < effectiveRetryTimes) {
      const delayMs = retryBaseDelayMs * Math.pow(2, attempt)
      if (getRemainingRuntimeMs(startedAt, maxTotalRuntimeMs) <= delayMs + 1000) {
        retrySkippedReason = 'total_runtime_budget_exhausted'
        break
      }
      // P0-B: retry only network/429/5xx within a strict retry and total-runtime budget.
      await sleep(delayMs)
    }
  }

  return {
    ok: false,
    reason: lastError && lastError.code === REAL_PROVIDER_ERROR_CODE.TIMEOUT
      ? 'real_provider_timeout'
      : 'real_provider_http_error',
    errorCode: lastError && lastError.code === REAL_PROVIDER_ERROR_CODE.TIMEOUT
      ? REAL_PROVIDER_ERROR_CODE.TIMEOUT
      : REAL_PROVIDER_ERROR_CODE.HTTP_ERROR,
    statusCode: (lastError && lastError.statusCode) || (lastResponse && lastResponse.statusCode) || 0,
    responseData: (lastError && lastError.responseData) || (lastResponse && lastResponse.data) || null,
    canAbortRequest,
    retrySkippedReason,
    effectiveRetryTimes,
    maxTotalRuntimeMs
  }
}

function firstArrayItem(value) {
  return Array.isArray(value) && value.length ? value[0] : null
}

function getNestedResultImageUrl(providerResponse = {}) {
  const output = providerResponse.output || {}
  const data = providerResponse.data || {}
  const result = providerResponse.result || {}
  const taskResult = providerResponse.task_result || providerResponse.taskResult || {}
  const firstChoice = firstArrayItem(output.choices) || firstArrayItem(data.choices)
  const firstChoiceMessage = (firstChoice && firstChoice.message) || {}
  const firstChoiceContent = firstArrayItem(firstChoiceMessage.content)
  const firstOutputResult = firstArrayItem(output.results)
  const firstDataResult = firstArrayItem(data.results)
  const firstOutputTaskResult = firstArrayItem(output.task_results) || firstArrayItem(output.taskResults)
  const firstDataTaskResult = firstArrayItem(data.task_results) || firstArrayItem(data.taskResults)
  const firstResultItem = firstArrayItem(result.items)
  const firstTaskResultItem = firstArrayItem(taskResult.items)
  const firstImage = firstArrayItem(output.images) || firstArrayItem(data.images) || firstArrayItem(result.images)

  return (
    providerResponse.resultImageUrl ||
    providerResponse.result_image_url ||
    providerResponse.image ||
    providerResponse.imageUrl ||
    providerResponse.image_url ||
    providerResponse.finalImageUrl ||
    providerResponse.final_image_url ||
    providerResponse.url ||
    output.resultImageUrl ||
    output.result_image_url ||
    output.image ||
    output.imageUrl ||
    output.image_url ||
    output.finalImageUrl ||
    output.final_image_url ||
    output.url ||
    data.resultImageUrl ||
    data.result_image_url ||
    data.image ||
    data.imageUrl ||
    data.image_url ||
    data.finalImageUrl ||
    data.final_image_url ||
    data.url ||
    taskResult.resultImageUrl ||
    taskResult.result_image_url ||
    taskResult.imageUrl ||
    taskResult.image_url ||
    taskResult.url ||
    result.coverUrl ||
    result.imageUrl ||
    result.image_url ||
    result.resultImageUrl ||
    result.result_image_url ||
    result.url ||
    (firstChoiceContent && (firstChoiceContent.image || firstChoiceContent.image_url || firstChoiceContent.url)) ||
    (firstOutputResult && (firstOutputResult.url || firstOutputResult.image || firstOutputResult.imageUrl || firstOutputResult.image_url || firstOutputResult.result_image_url)) ||
    (firstDataResult && (firstDataResult.url || firstDataResult.image || firstDataResult.imageUrl || firstDataResult.image_url || firstDataResult.result_image_url)) ||
    (firstOutputTaskResult && (firstOutputTaskResult.url || firstOutputTaskResult.image || firstOutputTaskResult.imageUrl || firstOutputTaskResult.image_url || firstOutputTaskResult.result_image_url)) ||
    (firstDataTaskResult && (firstDataTaskResult.url || firstDataTaskResult.image || firstDataTaskResult.imageUrl || firstDataTaskResult.image_url || firstDataTaskResult.result_image_url)) ||
    (firstResultItem && (firstResultItem.url || firstResultItem.fileUrl || firstResultItem.imageUrl || firstResultItem.image_url)) ||
    (firstTaskResultItem && (firstTaskResultItem.url || firstTaskResultItem.fileUrl || firstTaskResultItem.imageUrl || firstTaskResultItem.image_url)) ||
    (firstImage && (firstImage.url || firstImage.imageUrl || firstImage.image_url)) ||
    ''
  )
}

function extractResultImageUrl(providerResponse = {}) {
  const imageUrl = getNestedResultImageUrl(providerResponse)

  if (!imageUrl) {
    return {
      ok: false,
      reason: 'real_provider_no_result_image',
      errorCode: REAL_PROVIDER_ERROR_CODE.NO_RESULT_IMAGE
    }
  }

  if (!/^https:\/\//.test(imageUrl)) {
    return {
      ok: false,
      reason: 'unsupported_result_image_type',
      errorCode: REAL_PROVIDER_ERROR_CODE.UNSUPPORTED_RESULT_IMAGE_TYPE
    }
  }

  return {
    ok: true,
    imageUrl
  }
}

function getProviderTaskId(providerResponse = {}) {
  const output = providerResponse.output || {}
  const data = providerResponse.data || {}
  return (
    providerResponse.taskId ||
    providerResponse.task_id ||
    output.taskId ||
    output.task_id ||
    data.taskId ||
    data.task_id ||
    ''
  )
}

function getProviderRawStatus(providerResponse = {}) {
  const output = providerResponse.output || {}
  const data = providerResponse.data || {}
  const result = providerResponse.result || {}
  return String(
    providerResponse.status ||
    providerResponse.task_status ||
    providerResponse.taskStatus ||
    output.status ||
    output.task_status ||
    output.taskStatus ||
    data.status ||
    data.task_status ||
    data.taskStatus ||
    result.status ||
    result.task_status ||
    result.taskStatus ||
    ''
  ).trim().toLowerCase()
}

function buildProviderPollEndpoint(requestPlan = {}, providerTaskId = '') {
  const template = requestPlan.pollEndpoint || requestPlan.statusEndpoint || ''
  if (!template || !providerTaskId) {
    return ''
  }
  return template
    .replace('{taskId}', encodeURIComponent(providerTaskId))
    .replace(':taskId', encodeURIComponent(providerTaskId))
}

function buildPendingProviderResult(providerResponse = {}, requestPlan = {}) {
  const providerTaskId = getProviderTaskId(providerResponse)
  return {
    ok: true,
    success: true,
    provider: 'real',
    providerTaskType: requestPlan.providerTaskType || '',
    providerTaskId,
    status: 'pending',
    taskStatus: 'pending',
    resultImageUrl: '',
    resultVideoUrl: '',
    resultItems: [],
    rawStatus: getProviderRawStatus(providerResponse),
    providerReceivedRequest: true,
    providerAcceptedTask: true,
    shouldRollbackQuota: false,
    shouldEnterPolling: true,
    errorCode: 'PROVIDER_ACCEPTED_ASYNC_TASK',
    message: 'provider accepted async task; waiting for polling or finalize',
    meta: {
      contractVersion: PROVIDER_CONTRACT_VERSION,
      costActionType: requestPlan.costActionType || '',
      hasQuotaConsumeRecord: !!(requestPlan.safety && requestPlan.safety.hasQuotaConsumeRecord)
    }
  }
}

async function pollProviderTaskUntilDone(requestPlan = {}, providerTaskId = '') {
  // P0-B: async providers use submit task_id + poll; accepted tasks must not fallback to mock.
  const pollEndpoint = buildProviderPollEndpoint(requestPlan, providerTaskId)
  if (!pollEndpoint) {
    return {
      ok: false,
      reason: 'provider_poll_endpoint_missing',
      errorCode: 'PROVIDER_ACCEPTED_ASYNC_TASK',
      providerTaskId,
      shouldEnterPolling: true
    }
  }

  const maxAttempts = Math.min(
    DEFAULT_PROVIDER_POLL_MAX_ATTEMPTS,
    Math.max(1, Number(requestPlan.pollMaxAttempts || DEFAULT_PROVIDER_POLL_MAX_ATTEMPTS))
  )
  const pollIntervalMs = Math.max(1000, Number(requestPlan.pollIntervalMs || DEFAULT_PROVIDER_POLL_INTERVAL_MS))
  const startedAt = Date.now()
  const maxTotalRuntimeMs = getSafeTimeoutMs(requestPlan.maxTotalRuntimeMs, MAX_PROVIDER_TOTAL_RUNTIME_MS)
  let lastProviderResponse = null

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const remainingMs = getRemainingRuntimeMs(startedAt, maxTotalRuntimeMs)
    if (remainingMs <= 1500) {
      break
    }

    const response = await requestWithTimeoutAndRetry({
      ...requestPlan,
      endpoint: pollEndpoint,
      method: 'GET',
      body: null,
      timeoutMs: Math.min(10000, remainingMs - 500),
      retryTimes: 0,
      effectiveRetryTimes: 0
    })

    if (!response.ok) {
      return {
        ok: false,
        reason: response.reason || 'provider_poll_failed',
        errorCode: response.errorCode || REAL_PROVIDER_ERROR_CODE.HTTP_ERROR,
        providerTaskId,
        shouldEnterPolling: true
      }
    }

    lastProviderResponse = response.data || {}
    const normalized = normalizeRealProviderResponse(lastProviderResponse, requestPlan)
    const rawStatus = getProviderRawStatus(lastProviderResponse)

    if (normalized.ok && normalized.resultImageUrl) {
      return {
        ok: true,
        normalizedProviderResult: normalized
      }
    }

    if (PROVIDER_POLL_STATUS.SUCCESS.has(rawStatus) && !normalized.resultImageUrl) {
      return {
        ok: false,
        reason: 'provider_final_result_missing_image',
        errorCode: 'PROVIDER_RESPONSE_NORMALIZE_FAILED',
        providerTaskId,
        rawStatus,
        shouldEnterPolling: false
      }
    }

    if (PROVIDER_POLL_STATUS.FAILED.has(rawStatus)) {
      return {
        ok: false,
        reason: 'provider_final_failed',
        errorCode: 'PROVIDER_FINAL_FAILED',
        providerTaskId,
        rawStatus,
        shouldEnterPolling: false
      }
    }

    if (attempt < maxAttempts - 1) {
      const nextDelayMs = Math.min(
        pollIntervalMs,
        Math.max(0, getRemainingRuntimeMs(startedAt, maxTotalRuntimeMs) - 1000)
      )
      await sleep(nextDelayMs)
    }
  }

  return {
    ok: false,
    reason: 'provider_poll_timeout',
    errorCode: 'PROVIDER_ACCEPTED_ASYNC_TASK',
    providerTaskId,
    rawStatus: getProviderRawStatus(lastProviderResponse || {}),
    shouldEnterPolling: true
  }
}

function normalizeRealProviderResponse(providerResponse = {}, requestPlan = {}) {
  const providerTaskId = getProviderTaskId(providerResponse)
  const extracted = extractResultImageUrl(providerResponse)
  const providerAcceptedTask = !!providerTaskId

  if (!extracted.ok && providerAcceptedTask) {
    return buildPendingProviderResult(providerResponse, requestPlan)
  }

  if (!extracted.ok) {
    return buildProviderContractError(
      'PROVIDER_RESPONSE_NORMALIZE_FAILED',
      extracted.reason || 'provider response normalize failed',
      {
        providerTaskType: requestPlan.providerTaskType,
        costActionType: requestPlan.costActionType,
        rawStatus: getProviderRawStatus(providerResponse),
        providerReceivedRequest: true,
        providerAcceptedTask: false,
        shouldRollbackQuota: false,
        hasQuotaConsumeRecord: !!(requestPlan.safety && requestPlan.safety.hasQuotaConsumeRecord)
      }
    )
  }

  return {
    ok: true,
    provider: 'real',
    providerTaskType: requestPlan.providerTaskType || '',
    providerTaskId,
    status: 'success',
    resultImageUrl: extracted.imageUrl,
    resultVideoUrl: '',
    resultItems: [
      {
        type: 'image',
        hasUrl: true
      }
    ],
    rawStatus: getProviderRawStatus(providerResponse),
    providerReceivedRequest: true,
    providerAcceptedTask,
    shouldRollbackQuota: false,
    shouldEnterPolling: false,
    errorCode: '',
    message: '',
    meta: {
      contractVersion: PROVIDER_CONTRACT_VERSION,
      costActionType: requestPlan.costActionType || '',
      hasQuotaConsumeRecord: !!(requestPlan.safety && requestPlan.safety.hasQuotaConsumeRecord)
    }
  }
}
function runRealProviderDryRun(requestPlan = {}) {
  const now = Date.now()
  const prompt = requestPlan.prompt || {}
  return {
    ok: true,
    provider: 'real',
    providerTaskType: requestPlan.providerTaskType || 'generic_fashion_image',
    providerTaskId: `dry_run_${now}`,
    status: 'dry_run',
    resultImageUrl: '',
    resultVideoUrl: '',
    resultItems: [],
    rawStatus: 'dry_run',
    providerReceivedRequest: false,
    providerAcceptedTask: false,
    shouldRollbackQuota: false,
    shouldEnterPolling: false,
    errorCode: '',
    message: 'provider dry run only; no external request sent',
    meta: {
      dryRun: true,
      positivePromptLength: Number(prompt.positivePromptLength || 0),
      negativePromptLength: Number(prompt.negativePromptLength || 0),
      costActionType: requestPlan.costActionType || '',
      quotaRecordId: requestPlan.quotaRecordId || ''
    }
  }
}

async function generateRealResult(input = {}, config = {}) {
  try {
    if (config.enableRealProviderCall !== true) {
      console.warn('[ai_generate] real provider disabled', {
        provider: config.provider || '',
        requestedProvider: 'real',
        enableRealProviderCall: !!config.enableRealProviderCall,
        blockedReason: 'REAL_PROVIDER_DISABLED'
      })
      return createFallbackResult('real_provider_disabled', REAL_PROVIDER_ERROR_CODE.DISABLED, {
        provider: config.provider || '',
        requestedProvider: 'real',
        enableRealProviderCall: !!config.enableRealProviderCall,
        blockedReason: 'REAL_PROVIDER_DISABLED',
        providerReceivedRequest: false,
        providerAcceptedTask: false,
        shouldRollbackQuota: true,
        shouldEnterPolling: false
      })
    }

    // TODO(provider-cost-guard): before enabling any paid real provider call,
    // require a quota_guard consume record with a stable idempotencyKey.
    const inputValidation = validateRealProviderInput(input)
    if (!inputValidation.ok) {
      console.warn('[ai_generate] real provider input invalid', {
        reason: inputValidation.reason,
        taskId: input.taskId,
        modelType: input.modelType || 'female',
        scene: input.scene || 'white'
      })
      return createFallbackResult(inputValidation.reason, inputValidation.errorCode)
    }

    const resolvedClothImage = await resolveProviderImageUrl(input.clothImage || {})
    console.info('[ai_generate] real provider image resolved', {
      taskId: input.taskId,
      hasResolvedImageUrl: !!resolvedClothImage.ok,
      inputImageSource: resolvedClothImage.source || '',
      hasCloudFileId: !!resolvedClothImage.hasCloudFileId,
      cloudStatus: resolvedClothImage.cloudStatus || ''
    })

    if (!resolvedClothImage.ok) {
      return createFallbackResult(resolvedClothImage.reason, resolvedClothImage.errorCode)
    }

    const configValidation = validateRealProviderConfig(config)
    if (!configValidation.ok) {
      console.warn('[ai_generate] real provider config invalid', {
        reason: configValidation.reason,
        provider: config.provider,
        hasEndpoint: !!config.endpoint,
        hasApiKey: !!config.apiKey
      })
      return createFallbackResult(configValidation.reason, configValidation.errorCode, {
        hasEndpoint: !!config.endpoint,
        hasApiKey: !!config.apiKey
      })
    }

    const requestPlan = buildRealProviderRequestPlan(input, config, {
      clothImageUrl: resolvedClothImage.url,
      clothImageSource: resolvedClothImage.source
    })
    const requestPlanValidation = validateRealProviderRequestPlan(requestPlan)
    if (!requestPlanValidation.ok) {
      console.warn('[ai_generate] real provider contract invalid', {
        providerTaskType: requestPlan.providerTaskType,
        costActionType: requestPlan.costActionType,
        errorCode: requestPlanValidation.errorCode,
        providerReceivedRequest: requestPlanValidation.providerReceivedRequest,
        providerAcceptedTask: requestPlanValidation.providerAcceptedTask,
        shouldRollbackQuota: requestPlanValidation.shouldRollbackQuota,
        shouldEnterPolling: requestPlanValidation.shouldEnterPolling
      })
      return createFallbackResult(
        requestPlanValidation.errorCode,
        requestPlanValidation.errorCode,
        {
          providerReceivedRequest: requestPlanValidation.providerReceivedRequest,
          providerAcceptedTask: requestPlanValidation.providerAcceptedTask,
          shouldRollbackQuota: requestPlanValidation.shouldRollbackQuota,
          shouldEnterPolling: requestPlanValidation.shouldEnterPolling,
          hasQuotaConsumeRecord: requestPlanValidation.meta && requestPlanValidation.meta.hasQuotaConsumeRecord
        }
      )
    }
    console.info('[ai_generate] real provider request plan', {
      taskId: input.taskId,
      model: requestPlan.model,
      providerTaskType: requestPlan.providerTaskType,
      costActionType: requestPlan.costActionType,
      hasResolvedImageUrl: true,
      inputImageSource: resolvedClothImage.source,
      hasEndpoint: !!config.endpoint,
      hasApiKey: !!config.apiKey,
      timeoutMs: requestPlan.timeoutMs,
      retryTimes: requestPlan.retryTimes,
      effectiveRetryTimes: requestPlan.effectiveRetryTimes,
      canAbortRequest: true
    })

    const submitResponse = await requestWithTimeoutAndRetry(requestPlan)
    if (!submitResponse.ok) {
      console.warn('[ai_generate] real provider request failed', {
        taskId: input.taskId,
        model: requestPlan.model,
        statusCode: submitResponse.statusCode || 0,
        fallbackReason: submitResponse.reason,
        fallbackErrorCode: submitResponse.errorCode,
        retrySkippedReason: submitResponse.retrySkippedReason || '',
        effectiveRetryTimes: submitResponse.effectiveRetryTimes,
        canAbortRequest: !!submitResponse.canAbortRequest
      })
      return createFallbackResult(submitResponse.reason, submitResponse.errorCode, {
        statusCode: submitResponse.statusCode || 0,
        retrySkippedReason: submitResponse.retrySkippedReason || '',
        effectiveRetryTimes: submitResponse.effectiveRetryTimes,
        canAbortRequest: !!submitResponse.canAbortRequest
      })
    }

    let normalizedProviderResult = normalizeRealProviderResponse(submitResponse.data, requestPlan)
    if (normalizedProviderResult.shouldEnterPolling && normalizedProviderResult.providerTaskId) {
      const pollResult = await pollProviderTaskUntilDone(requestPlan, normalizedProviderResult.providerTaskId)
      if (pollResult.ok && pollResult.normalizedProviderResult) {
        normalizedProviderResult = pollResult.normalizedProviderResult
      } else if (pollResult.errorCode === 'PROVIDER_ACCEPTED_ASYNC_TASK') {
        console.warn('[ai_generate] real provider accepted async task', {
          taskId: input.taskId,
          model: requestPlan.model,
          statusCode: submitResponse.statusCode,
          providerAcceptedTask: true,
          shouldEnterPolling: true,
          hasProviderTaskId: true,
          hasPollEndpoint: !!requestPlan.pollEndpoint
        })
        normalizedProviderResult = {
          ...normalizedProviderResult,
          ok: true,
          status: 'pending',
          taskStatus: 'pending',
          shouldRollbackQuota: false,
          shouldEnterPolling: true
        }
      } else {
        console.warn('[ai_generate] real provider poll failed', {
          taskId: input.taskId,
          model: requestPlan.model,
          statusCode: submitResponse.statusCode,
          fallbackReason: pollResult.reason,
          fallbackErrorCode: pollResult.errorCode,
          providerAcceptedTask: true,
          shouldRollbackQuota: false,
          shouldEnterPolling: !!pollResult.shouldEnterPolling
        })
        return createFallbackResult(pollResult.reason, pollResult.errorCode, {
          statusCode: submitResponse.statusCode,
          hasProviderTaskId: true,
          providerAcceptedTask: true,
          shouldRollbackQuota: false,
          shouldEnterPolling: !!pollResult.shouldEnterPolling
        })
      }
    }

    if (!normalizedProviderResult.ok) {
      console.warn('[ai_generate] real provider request failed', {
        taskId: input.taskId,
        model: requestPlan.model,
        statusCode: submitResponse.statusCode,
        fallbackReason: normalizedProviderResult.errorCode
      })
      return createFallbackResult(normalizedProviderResult.errorCode, normalizedProviderResult.errorCode, {
        statusCode: submitResponse.statusCode,
        providerReceivedRequest: normalizedProviderResult.providerReceivedRequest,
        providerAcceptedTask: normalizedProviderResult.providerAcceptedTask,
        shouldRollbackQuota: normalizedProviderResult.shouldRollbackQuota
      })
    }

    console.info('[ai_generate] real provider request success', {
      taskId: input.taskId,
      model: requestPlan.model,
      statusCode: submitResponse.statusCode,
      status: normalizedProviderResult.status,
      hasResultImage: !!normalizedProviderResult.resultImageUrl,
      providerAcceptedTask: !!normalizedProviderResult.providerAcceptedTask,
      shouldEnterPolling: !!normalizedProviderResult.shouldEnterPolling
    })

    return {
      ok: true,
      success: true,
      taskId: normalizedProviderResult.providerTaskId || input.taskId,
      task_id: normalizedProviderResult.providerTaskId || input.taskId,
      status: normalizedProviderResult.status || 'success',
      taskStatus: normalizedProviderResult.taskStatus || normalizedProviderResult.status || 'success',
      resultImageUrl: normalizedProviderResult.resultImageUrl,
      result_image_url: normalizedProviderResult.resultImageUrl,
      imageUrl: normalizedProviderResult.resultImageUrl,
      image_url: normalizedProviderResult.resultImageUrl,
      mock: false,
      provider: 'real',
      requestedProvider: 'real',
      fallback: false,
      fallbackReason: '',
      fallbackErrorCode: '',
      inputSummary: {
        modelType: input.modelType || 'female',
        scene: input.scene || 'white',
        hasClothImage: true,
        hasStyleImage: !!(input.styleImage && (input.styleImage.fileId || input.styleImage.fileUrl))
      }
    }
  } catch (error) {
    console.error('[ai_generate] real provider request failed', {
      message: (error && error.message) || 'unknown',
      fallbackReason: 'real_provider_error'
    })
    return createFallbackResult('real_provider_error', REAL_PROVIDER_ERROR_CODE.ERROR)
  }
}

module.exports = {
  REAL_PROVIDER_ERROR_CODE,
  buildAliyunFluxRequestBody,
  buildIdempotencyKey,
  buildProviderContractError,
  buildRealProviderRequestPlan,
  createFallbackResult,
  extractResultImageUrl,
  generateFabricReplaceRealPlaceholder,
  generateRealResult,
  normalizeRealProviderResponse,
  requestWithTimeoutAndRetry,
  runRealProviderDryRun,
  validateFabricReplaceRealInput,
  validateRealProviderConfig,
  validateRealProviderInput,
  validateRealProviderRequestPlan
}
