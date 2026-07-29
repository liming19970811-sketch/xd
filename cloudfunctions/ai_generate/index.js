const cloud = require('wx-server-sdk')
const { getAdapter } = require('./adapters')
const { getAiConfig, getAiConfigSummary } = require('./utils/config')
const {
  normalizeFabricReplaceInput,
  normalizeInput,
  getFabricReplaceLogSummary,
  getInputLogSummary
} = require('./utils/normalizeInput')
const { normalizeSuccessOutput, normalizeFailureOutput } = require('./utils/normalizeOutput')
const { buildProviderPromptPayload } = require('./utils/providerPromptAdapter')
const {
  buildRealProviderRequestPlan,
  runRealProviderDryRun
} = require('./adapters/real')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const QUOTA_RECORDS_COLLECTION = 'membership_usage_records'

function isExplicitTrue(value) {
  return String(value || '').trim().toLowerCase() === 'true'
}

function isProviderDryRunEnabled() {
  return isExplicitTrue(process.env.PROVIDER_DRY_RUN)
}

function isRealQuotaGuardEnabled() {
  return process.env.ENABLE_REAL_QUOTA_GUARD === undefined
    ? true
    : isExplicitTrue(process.env.ENABLE_REAL_QUOTA_GUARD)
}

function isProviderDryRunRequested(event = {}) {
  return isProviderDryRunEnabled()
}

function getEventPayload(event = {}) {
  return event.payload || event || {}
}

function getAdvancedPromptPayload(event = {}) {
  const payload = getEventPayload(event)
  return {
    advancedPanelValues: payload.advancedPanelValues || {},
    advancedCustomPrompts: payload.advancedCustomPrompts || {},
    advancedOptionPrompts: payload.advancedOptionPrompts || {},
    customPromptSummary: payload.customPromptSummary || '',
    optionPromptSummary: payload.optionPromptSummary || '',
    fullAdvancedPromptSummary: payload.fullAdvancedPromptSummary || '',
    costActionType: payload.costActionType || ''
  }
}

function getProviderSwitchMatrix(config = {}) {
  const enableRealQuotaGuard = isRealQuotaGuardEnabled()
  const providerDryRun = !!config.providerDryRun
  const enableRealProviderCall = !!config.enableRealProviderCall
  let switchMatrixMode = 'A_DEFAULT_SAFE_MOCK'
  let switchMatrixAllowed = true
  const switchMatrixBlockers = []

  if (!enableRealQuotaGuard && !providerDryRun && !enableRealProviderCall) {
    switchMatrixMode = 'A_DEFAULT_SAFE_MOCK'
  } else if (enableRealQuotaGuard && !providerDryRun && !enableRealProviderCall) {
    switchMatrixMode = 'B_QUOTA_REAL_ALPHA_ONLY'
  } else if (enableRealQuotaGuard && providerDryRun && !enableRealProviderCall) {
    switchMatrixMode = 'C_PROVIDER_DRY_RUN_WITH_REAL_QUOTA'
  } else if (!enableRealQuotaGuard && providerDryRun && !enableRealProviderCall) {
    switchMatrixMode = 'D_BLOCKED_DRY_RUN_WITHOUT_REAL_QUOTA'
    switchMatrixAllowed = false
    switchMatrixBlockers.push('ENABLE_REAL_QUOTA_GUARD_REQUIRED_FOR_PROVIDER_DRY_RUN')
  } else if (!enableRealQuotaGuard && !providerDryRun && enableRealProviderCall) {
    switchMatrixMode = 'E_BLOCKED_REAL_PROVIDER_WITHOUT_REAL_QUOTA'
    switchMatrixAllowed = false
    switchMatrixBlockers.push('REAL_QUOTA_GUARD_REQUIRED')
  } else if (enableRealQuotaGuard && providerDryRun && enableRealProviderCall) {
    switchMatrixMode = 'F_BLOCKED_REAL_PROVIDER_AND_DRY_RUN_CONFLICT'
    switchMatrixAllowed = false
    switchMatrixBlockers.push('PROVIDER_SWITCH_CONFLICT')
  } else if (enableRealQuotaGuard && !providerDryRun && enableRealProviderCall) {
    switchMatrixMode = 'G_REAL_PROVIDER_GRAY_ALLOWED'
  } else {
    switchMatrixMode = 'UNKNOWN_BLOCKED_PROVIDER_SWITCH_MATRIX'
    switchMatrixAllowed = false
    switchMatrixBlockers.push('PROVIDER_SWITCH_MATRIX_UNKNOWN')
  }

  return {
    enableRealQuotaGuard,
    providerDryRun,
    enableRealProviderCall,
    switchMatrixMode,
    switchMatrixAllowed,
    switchMatrixBlockers
  }
}

function getQuotaContractPayload(event = {}, input = {}) {
  const payload = getEventPayload(event)
  const eventInput = event.input || {}
  const payloadInput = payload.input || {}
  const quotaConsumedRecord =
    input.quotaConsumedRecord ||
    event.quotaConsumedRecord ||
    payload.quotaConsumedRecord ||
    eventInput.quotaConsumedRecord ||
    payloadInput.quotaConsumedRecord ||
    {}
  const quotaRecordId =
    event.quotaRecordId ||
    event.quota_record_id ||
    event.usageRecordId ||
    event.recordId ||
    payload.quotaRecordId ||
    payload.quota_record_id ||
    payload.usageRecordId ||
    payload.recordId ||
    eventInput.quotaRecordId ||
    eventInput.usageRecordId ||
    payloadInput.quotaRecordId ||
    payloadInput.usageRecordId ||
    input.quotaRecordId ||
    input.quota_record_id ||
    input.usageRecordId ||
    input.recordId ||
    quotaConsumedRecord.recordId ||
    quotaConsumedRecord.quotaRecordId ||
    quotaConsumedRecord.usageRecordId ||
    quotaConsumedRecord._id ||
    ''
  const quotaRecordStatus =
    event.quotaRecordStatus ||
    event.quota_record_status ||
    payload.quotaRecordStatus ||
    payload.quota_record_status ||
    eventInput.quotaRecordStatus ||
    payloadInput.quotaRecordStatus ||
    input.quotaRecordStatus ||
    input.quota_record_status ||
    quotaConsumedRecord.status ||
    ''
  const idempotencyKey =
    event.idempotencyKey ||
    payload.idempotencyKey ||
    eventInput.idempotencyKey ||
    payloadInput.idempotencyKey ||
    input.idempotencyKey ||
    quotaConsumedRecord.idempotencyKey ||
    ''
  const costActionType =
    event.costActionType ||
    event.actionType ||
    payload.costActionType ||
    payload.actionType ||
    eventInput.costActionType ||
    eventInput.actionType ||
    payloadInput.costActionType ||
    payloadInput.actionType ||
    input.costActionType ||
    input.actionType ||
    quotaConsumedRecord.costActionType ||
    quotaConsumedRecord.actionType ||
    ''

  return {
    quotaConsumedRecord,
    quotaRecordId,
    quotaRecordStatus,
    idempotencyKey,
    costActionType
  }
}

function getQuotaRequestTaskIds(event = {}, input = {}) {
  const payload = getEventPayload(event)
  const eventInput = event.input || {}
  const payloadInput = payload.input || {}
  return [
    event.sourceTaskId,
    event.taskId,
    event.clientTaskId,
    payload.sourceTaskId,
    payload.taskId,
    payload.clientTaskId,
    eventInput.sourceTaskId,
    eventInput.taskId,
    eventInput.clientTaskId,
    payloadInput.sourceTaskId,
    payloadInput.taskId,
    payloadInput.clientTaskId,
    input.sourceTaskId,
    input.taskId,
    input.clientTaskId
  ].map((value) => String(value || '').trim()).filter(Boolean)
}

function isQuotaRecordTaskCompatible(record = {}, taskIds = []) {
  const recordTaskIds = [
    record.sourceTaskId,
    record.taskId,
    record.clientTaskId
  ].map((value) => String(value || '').trim()).filter(Boolean)
  if (!recordTaskIds.length || !taskIds.length) {
    return false
  }
  return recordTaskIds.some((recordTaskId) => taskIds.includes(recordTaskId))
}

function isQuotaRecordCostCompatible(record = {}, costActionType = '') {
  const recordCostActionType = String(record.costActionType || record.actionType || '').trim()
  const requestCostActionType = String(costActionType || '').trim()
  return !!recordCostActionType && !!requestCostActionType && recordCostActionType === requestCostActionType
}

function buildQuotaPreflightDiagnostics(preflight = {}, input = {}, event = {}) {
  const taskIds = getQuotaRequestTaskIds(event, input)
  return {
    quotaRecordIdReceived: preflight.quotaRecordId || '',
    hasQuotaRecordId: !!preflight.hasQuotaRecordId,
    quotaRecordLookupStatus: preflight.quotaRecordLookupStatus || '',
    quotaRecordStatus: preflight.quotaRecordStatus || '',
    sourceTaskIdReceived: taskIds[0] || '',
    costActionTypeReceived: preflight.costActionType || ''
  }
}

async function findQuotaRecordByRecordId(quotaRecordId = '') {
  const recordId = String(quotaRecordId || '').trim()
  if (!recordId) {
    return {
      lookupStatus: 'missing_record_id',
      record: null
    }
  }
  try {
    const response = await cloud.database()
      .collection(QUOTA_RECORDS_COLLECTION)
      .where({ recordId })
      .limit(1)
      .get()
    const record = response && response.data && response.data[0] ? response.data[0] : null
    return {
      lookupStatus: record ? 'found' : 'not_found',
      record
    }
  } catch (error) {
    console.warn('[ai_generate:quota-preflight] lookup failed', {
      quotaRecordId: maskLogId(recordId),
      status: 'lookup_failed',
      errorCode: error && (error.code || error.errCode || error.errorCode) || 'QUOTA_RECORD_LOOKUP_FAILED'
    })
    return {
      lookupStatus: 'lookup_failed',
      record: null
    }
  }
}

async function hydrateRealProviderQuotaPreflight(preflight = {}, event = {}, input = {}, provider = '', config = {}) {
  if (
    preflight.preflightOk ||
    provider !== 'real' ||
    preflight.enableRealQuotaGuard !== true ||
    (config.enableRealProviderCall !== true && config.providerDryRun !== true)
  ) {
    return preflight
  }

  const lookup = await findQuotaRecordByRecordId(preflight.quotaRecordId)
  const record = lookup.record || null
  const taskIds = getQuotaRequestTaskIds(event, input)
  const recordStatus = String(record && record.status || preflight.quotaRecordStatus || '').toLowerCase()
  const costActionType = preflight.costActionType || input.costActionType || ''
  const hasValidConsumedRecord =
    !!record &&
    recordStatus === 'consumed' &&
    isQuotaRecordTaskCompatible(record, taskIds) &&
    isQuotaRecordCostCompatible(record, costActionType) &&
    record.rollbackStatus !== 'rolled_back' &&
    !record.rollbackOfRecordId &&
    record.status !== 'rolled_back' &&
    record.status !== 'finalized'

  const nextPreflight = {
    ...preflight,
    quotaRecordLookupStatus: lookup.lookupStatus,
    quotaRecordStatus: recordStatus || preflight.quotaRecordStatus || '',
    idempotencyKey: preflight.idempotencyKey || (record && record.idempotencyKey) || '',
    costActionType: costActionType || (record && (record.costActionType || record.actionType)) || '',
    hasIdempotencyKey: !!(preflight.idempotencyKey || (record && record.idempotencyKey)),
    hasConsumedRecord: hasValidConsumedRecord
  }

  if (record && !nextPreflight.costActionType) {
    nextPreflight.costActionType = record.costActionType || record.actionType || ''
  }
  if (hasValidConsumedRecord && nextPreflight.hasIdempotencyKey && nextPreflight.costActionType) {
    nextPreflight.preflightOk = true
    nextPreflight.errorCode = ''
    input.quotaRecordStatus = 'consumed'
    input.idempotencyKey = nextPreflight.idempotencyKey
    input.costActionType = nextPreflight.costActionType
  } else if (lookup.lookupStatus && lookup.lookupStatus !== 'found') {
    nextPreflight.errorCode = preflight.errorCode || 'REAL_QUOTA_GUARD_REQUIRED'
  }

  console.info('[ai_generate:quota-preflight] record lookup', {
    quotaRecordId: maskLogId(nextPreflight.quotaRecordId),
    status: nextPreflight.quotaRecordLookupStatus || '',
    quotaRecordStatus: nextPreflight.quotaRecordStatus || '',
    hasConsumedRecord: !!nextPreflight.hasConsumedRecord,
    hasIdempotencyKey: !!nextPreflight.hasIdempotencyKey,
    costActionType: nextPreflight.costActionType || ''
  })

  return nextPreflight
}

function getProviderPromptInput(event = {}, input = {}) {
  const payload = getEventPayload(event)
  const advancedPromptPayload = getAdvancedPromptPayload(event)
  return {
    action: event.action || payload.action || '',
    entryScene: payload.entryScene || '',
    taskType: payload.taskType || '',
    costActionType: advancedPromptPayload.costActionType,
    templateType: payload.templateType || '',
    modelType: input.modelType || payload.modelType || payload.model_type || '',
    scene: input.scene || payload.scene || '',
    styleCode: payload.styleCode || payload.style_code || payload.finalStyleCode || '',
    sceneCode: payload.sceneCode || payload.scene_code || payload.finalSceneCode || '',
    bodyType: payload.bodyType || payload.body_type || payload.finalBodyType || '',
    ...advancedPromptPayload
  }
}

function attachQuotaContractFields(input = {}, event = {}) {
  const quotaPayload = getQuotaContractPayload(event, input)
  input.quotaRecordId = quotaPayload.quotaRecordId
  input.quotaRecordStatus = quotaPayload.quotaRecordStatus
  input.quotaConsumedRecord = quotaPayload.quotaConsumedRecord
  input.idempotencyKey = quotaPayload.idempotencyKey || input.idempotencyKey || ''
  input.costActionType = quotaPayload.costActionType || input.costActionType || ''
  return input
}

function getAdvancedPromptMeta(event = {}) {
  const payload = getAdvancedPromptPayload(event)
  return {
    hasFullAdvancedPromptSummary: !!payload.fullAdvancedPromptSummary,
    fullAdvancedPromptSummaryLength: String(payload.fullAdvancedPromptSummary || '').length,
    advancedCustomPromptCount: Object.keys(payload.advancedCustomPrompts || {}).length,
    advancedOptionPromptCount: Object.keys(payload.advancedOptionPrompts || {}).length,
    costActionType: payload.costActionType || ''
  }
}

function buildRealProviderQuotaPreflight(event = {}, input = {}, provider = '', config = {}) {
  const quotaPayload = getQuotaContractPayload(event, input)
  const payload = getEventPayload(event)
  const switchMatrix = getProviderSwitchMatrix(config)
  const hasQuotaRecordId = !!quotaPayload.quotaRecordId
  const hasIdempotencyKey = !!quotaPayload.idempotencyKey
  const hasCostActionType = !!quotaPayload.costActionType
  const quotaRecordStatus = String(quotaPayload.quotaRecordStatus || '').toLowerCase()
  const hasConsumedRecord = hasQuotaRecordId && quotaRecordStatus === 'consumed'
  const debugSkipQuotaPreflight =
    config.providerDryRun === true &&
    payload.debugSkipQuotaPreflight === true
  const preflightOk =
    provider === 'real' &&
    switchMatrix.switchMatrixAllowed === true &&
    switchMatrix.enableRealQuotaGuard === true &&
    (config.enableRealProviderCall === true || config.providerDryRun === true) &&
    (
      debugSkipQuotaPreflight ||
      (hasConsumedRecord && hasIdempotencyKey && hasCostActionType)
    )
  const errorCode = preflightOk
    ? ''
    : switchMatrix.switchMatrixBlockers.includes('PROVIDER_SWITCH_CONFLICT')
      ? 'PROVIDER_SWITCH_CONFLICT'
      : 'REAL_QUOTA_GUARD_REQUIRED'

  return {
    preflightOk,
    errorCode,
    provider,
    enableRealProviderCall: !!config.enableRealProviderCall,
    enableRealQuotaGuard: switchMatrix.enableRealQuotaGuard,
    providerDryRun: switchMatrix.providerDryRun,
    switchMatrixMode: switchMatrix.switchMatrixMode,
    switchMatrixAllowed: switchMatrix.switchMatrixAllowed,
    switchMatrixBlockers: switchMatrix.switchMatrixBlockers,
    hasQuotaRecordId,
    hasIdempotencyKey,
    hasConsumedRecord,
    debugSkipQuotaPreflight,
    idempotencyKey: quotaPayload.idempotencyKey || '',
    costActionType: quotaPayload.costActionType || '',
    quotaRecordId: quotaPayload.quotaRecordId || '',
    quotaRecordStatus: quotaPayload.quotaRecordStatus || ''
  }
}

function getDryRunRequestPlanInput(input = {}, providerPromptPayload = {}) {
  const clothImage =
    input.clothImage ||
    (input.sourceImageUrl
      ? { fileUrl: input.sourceImageUrl }
      : {})
  return {
    ...input,
    clothImage,
    providerTaskType: providerPromptPayload.providerTaskType,
    providerPromptMeta: providerPromptPayload.promptMeta || input.providerPromptMeta || {}
  }
}

function buildDryRunResponse(dryRunResult = {}, advancedPromptMeta = {}, providerPromptMeta = {}, quotaPreflight = {}) {
  const quotaRecordId = quotaPreflight.quotaRecordId || (dryRunResult.meta && dryRunResult.meta.quotaRecordId) || ''
  const quotaRecordStatus = quotaPreflight.quotaRecordStatus || ''
  return {
    success: true,
    ok: true,
    provider: 'real',
    providerDryRun: true,
    enableRealProviderCall: !!quotaPreflight.enableRealProviderCall,
    switchMatrixMode: quotaPreflight.switchMatrixMode || '',
    switchMatrixAllowed: quotaPreflight.switchMatrixAllowed !== false,
    switchMatrixBlockers: quotaPreflight.switchMatrixBlockers || [],
    quotaRecordId,
    quotaRecordStatus: quotaRecordStatus || 'consumed',
    quotaPendingFinalization: true,
    quotaFinalized: false,
    quotaRolledBack: false,
    status: dryRunResult.status || 'dry_run',
    taskId: dryRunResult.providerTaskId || '',
    resultImageUrl: '',
    hasResultImage: false,
    data: {
      provider: 'real',
      requestedProvider: 'real',
      mock: false,
      fallback: false,
      providerDryRun: true,
      quotaRecordId,
      quotaRecordStatus: quotaRecordStatus || 'consumed',
      quotaPendingFinalization: true,
      quotaFinalized: false,
      quotaRolledBack: false,
      taskId: dryRunResult.providerTaskId || '',
      advancedPromptMeta,
      providerPromptMeta,
      providerDryRunResult: {
        ok: !!dryRunResult.ok,
        providerTaskType: dryRunResult.providerTaskType || '',
        providerTaskId: dryRunResult.providerTaskId || '',
        status: dryRunResult.status || '',
        providerReceivedRequest: !!dryRunResult.providerReceivedRequest,
        providerAcceptedTask: !!dryRunResult.providerAcceptedTask,
        shouldRollbackQuota: !!dryRunResult.shouldRollbackQuota,
        shouldEnterPolling: !!dryRunResult.shouldEnterPolling,
        errorCode: dryRunResult.errorCode || '',
        dryRun: !!(dryRunResult.meta && dryRunResult.meta.dryRun)
      }
    }
  }
}

function runDryRunForInput(input = {}, config = {}, providerPromptPayload = {}) {
  const dryRunPlan = buildRealProviderRequestPlan(
    getDryRunRequestPlanInput(input, providerPromptPayload),
    {
      ...config,
      enableRealProviderCall: true
    },
    {
      clothImageUrl: input.sourceImageUrl || '',
      clothImageSource: input.sourceImageUrl ? 'source_image_url' : 'dry_run'
    }
  )
  const dryRunResult = runRealProviderDryRun(dryRunPlan)
  console.info('[ai_generate:provider-dry-run] completed', {
    providerTaskType: dryRunResult.providerTaskType,
    costActionType: dryRunResult.meta && dryRunResult.meta.costActionType,
    dryRun: !!(dryRunResult.meta && dryRunResult.meta.dryRun),
    providerReceivedRequest: dryRunResult.providerReceivedRequest,
    providerAcceptedTask: dryRunResult.providerAcceptedTask,
    shouldRollbackQuota: dryRunResult.shouldRollbackQuota,
    positivePromptLength: dryRunResult.meta && dryRunResult.meta.positivePromptLength,
    negativePromptLength: dryRunResult.meta && dryRunResult.meta.negativePromptLength
  })
  return dryRunResult
}

function createRealQuotaGuardRequiredOutput(preflight = {}) {
  const errorCode = preflight.errorCode || 'REAL_QUOTA_GUARD_REQUIRED'
  const isSwitchConflict = errorCode === 'PROVIDER_SWITCH_CONFLICT'
  return {
    success: false,
    ok: false,
    provider: 'real',
    providerDryRun: !!preflight.providerDryRun,
    enableRealProviderCall: !!preflight.enableRealProviderCall,
    errorCode,
    quotaRecordIdReceived: preflight.quotaRecordIdReceived || preflight.quotaRecordId || '',
    hasQuotaRecordId: !!preflight.hasQuotaRecordId,
    quotaRecordLookupStatus: preflight.quotaRecordLookupStatus || '',
    quotaRecordStatus: preflight.quotaRecordStatus || '',
    sourceTaskIdReceived: preflight.sourceTaskIdReceived || '',
    costActionTypeReceived: preflight.costActionTypeReceived || preflight.costActionType || '',
    message: isSwitchConflict
      ? 'Provider switch conflict: real provider call and dryRun cannot be enabled together.'
      : 'Real provider requires a consumed quota_guard record before request.',
    data: {
      provider: 'real',
      providerReceivedRequest: false,
      providerAcceptedTask: false,
      shouldRollbackQuota: false,
      shouldEnterPolling: false,
      errorCode,
      enableRealProviderCall: !!preflight.enableRealProviderCall,
      enableRealQuotaGuard: !!preflight.enableRealQuotaGuard,
      providerDryRun: !!preflight.providerDryRun,
      switchMatrixMode: preflight.switchMatrixMode || '',
      switchMatrixAllowed: !!preflight.switchMatrixAllowed,
      switchMatrixBlockers: preflight.switchMatrixBlockers || [],
      hasQuotaRecordId: !!preflight.hasQuotaRecordId,
      hasIdempotencyKey: !!preflight.hasIdempotencyKey,
      costActionType: preflight.costActionType || '',
      quotaRecordIdReceived: preflight.quotaRecordIdReceived || preflight.quotaRecordId || '',
      quotaRecordLookupStatus: preflight.quotaRecordLookupStatus || '',
      quotaRecordStatus: preflight.quotaRecordStatus || '',
      sourceTaskIdReceived: preflight.sourceTaskIdReceived || '',
      costActionTypeReceived: preflight.costActionTypeReceived || preflight.costActionType || ''
    }
  }
}

function createRealProviderDisabledResult(input = {}, config = {}) {
  return {
    ok: false,
    success: false,
    reason: 'real_provider_disabled',
    errorCode: 'REAL_PROVIDER_DISABLED',
    fallbackErrorCode: 'REAL_PROVIDER_DISABLED',
    fallbackToMock: false,
    details: {
      provider: config.provider || '',
      requestedProvider: 'real',
      enableRealProviderCall: !!config.enableRealProviderCall,
      blockedReason: 'REAL_PROVIDER_DISABLED'
    }
  }
}

function maskLogId(value = '') {
  const text = String(value || '')
  if (!text) return ''
  if (text.length <= 8) return `${text.slice(0, 2)}***`
  return `${text.slice(0, 4)}***${text.slice(-4)}`
}

function getRealProviderTaskId(result = {}) {
  const data = result.data || {}
  return result.providerTaskId ||
    result.taskId ||
    result.task_id ||
    data.providerTaskId ||
    data.taskId ||
    data.task_id ||
    ''
}

function getRealProviderStatus(result = {}) {
  const data = result.data || {}
  return String(
    result.providerStatus ||
    result.rawStatus ||
    result.taskStatus ||
    result.task_status ||
    result.status ||
    data.providerStatus ||
    data.rawStatus ||
    data.taskStatus ||
    data.task_status ||
    data.status ||
    ''
  ).trim().toLowerCase()
}

function hasValidRealProviderResult(result = {}) {
  const data = result.data || {}
  const resultImageUrl =
    result.resultImageUrl ||
    result.result_image_url ||
    result.imageUrl ||
    result.image_url ||
    data.resultImageUrl ||
    data.result_image_url ||
    data.imageUrl ||
    data.image_url ||
    ''
  const items = Array.isArray(result.resultItems)
    ? result.resultItems
    : Array.isArray(data.resultItems)
      ? data.resultItems
      : []
  return !!resultImageUrl || items.some((item) => !!(item && (item.url || item.fileUrl || item.imageUrl || item.image_url || item.hasUrl)))
}

function isRealProviderPendingResult(result = {}) {
  const status = getRealProviderStatus(result)
  const pendingStatuses = new Set(['accepted', 'pending', 'queued', 'running', 'processing', 'submitted', 'created'])
  return pendingStatuses.has(status) ||
    result.shouldEnterPolling === true ||
    ((result.providerAcceptedTask === true || !!getRealProviderTaskId(result)) && !hasValidRealProviderResult(result))
}

function isRealProviderFailureResult(result = {}) {
  if (!result || result.fallbackToMock === true) return true
  const status = getRealProviderStatus(result)
  const failedStatuses = new Set(['failed', 'failure', 'error', 'rejected', 'provider_error', 'request_error', 'invalid_response', 'cancelled', 'canceled'])
  return failedStatuses.has(status) ||
    result.ok === false ||
    result.success === false ||
    (!!result.errorCode && !hasValidRealProviderResult(result))
}

async function finalizeRealQuotaUsage({
  quotaRecordId = '',
  idempotencyKey = '',
  taskId = '',
  costActionType = '',
  providerTaskId = ''
} = {}) {
  console.info('[ai_generate:quota-finalize] call', {
    action: 'finalizeUsage',
    taskId: maskLogId(taskId),
    quotaRecordId: maskLogId(quotaRecordId),
    status: 'start',
    errorCode: ''
  })
  try {
    const response = await cloud.callFunction({
      name: 'quota_guard',
      data: {
        action: 'finalizeUsage',
        recordId: quotaRecordId,
        idempotencyKey,
        taskId,
        costActionType,
        providerTaskId,
        reason: 'real_provider_success'
      }
    })
    const result = response && response.result ? response.result : {}
    console.info('[ai_generate:quota-finalize] result', {
      action: 'finalizeUsage',
      taskId: maskLogId(taskId),
      quotaRecordId: maskLogId(quotaRecordId),
      status: result.status || (result.data && result.data.status) || (result.ok ? 'finalized' : 'failed'),
      errorCode: result.errorCode || result.reason || ''
    })
    return result
  } catch (error) {
    console.warn('[ai_generate:quota-finalize] failed', {
      action: 'finalizeUsage',
      taskId: maskLogId(taskId),
      quotaRecordId: maskLogId(quotaRecordId),
      status: 'failed',
      errorCode: error && (error.code || error.errCode || error.errorCode) || 'QUOTA_FINALIZE_FAILED'
    })
    return {
      ok: false,
      success: false,
      status: 'failed',
      errorCode: 'QUOTA_FINALIZE_FAILED',
      reason: 'quota_finalize_failed'
    }
  }
}

async function rollbackRealQuotaUsage({
  quotaRecordId = '',
  idempotencyKey = '',
  taskId = '',
  costActionType = '',
  providerTaskId = '',
  reason = ''
} = {}) {
  console.warn('[ai_generate:quota-rollback] call', {
    action: 'rollbackUsage',
    taskId: maskLogId(taskId),
    quotaRecordId: maskLogId(quotaRecordId),
    status: 'start',
    errorCode: reason || 'real_provider_failed'
  })
  try {
    const response = await cloud.callFunction({
      name: 'quota_guard',
      data: {
        action: 'rollbackUsage',
        recordId: quotaRecordId,
        idempotencyKey,
        taskId,
        costActionType,
        providerTaskId,
        reason: reason || 'real_provider_failed'
      }
    })
    const result = response && response.result ? response.result : {}
    console.warn('[ai_generate:quota-rollback] result', {
      action: 'rollbackUsage',
      taskId: maskLogId(taskId),
      quotaRecordId: maskLogId(quotaRecordId),
      status: result.status || (result.data && result.data.status) || (result.ok ? 'rolled_back' : 'failed'),
      errorCode: result.errorCode || result.reason || ''
    })
    return result
  } catch (error) {
    console.warn('[ai_generate:quota-rollback] failed', {
      action: 'rollbackUsage',
      taskId: maskLogId(taskId),
      quotaRecordId: maskLogId(quotaRecordId),
      status: 'failed',
      errorCode: error && (error.code || error.errCode || error.errorCode) || 'QUOTA_ROLLBACK_FAILED'
    })
    return {
      ok: false,
      success: false,
      status: 'failed',
      errorCode: 'QUOTA_ROLLBACK_FAILED',
      reason: 'quota_rollback_failed'
    }
  }
}

function buildRealProviderFailureOutput({
  errorCode = 'REAL_PROVIDER_FAILED',
  reason = 'real_provider_failed',
  taskId = '',
  providerTaskId = '',
  providerStatus = '',
  quotaRecordId = '',
  quotaRecordStatus = 'consumed',
  quotaRolledBack = false,
  rollbackStatus = ''
} = {}) {
  return {
    code: -1,
    success: false,
    ok: false,
    status: 'failed',
    taskStatus: 'failed',
    taskId,
    errorCode,
    reason,
    message: reason,
    quotaRecordId,
    quotaRecordStatus,
    quotaRolledBack,
    rollbackStatus,
    providerTaskId,
    providerStatus,
    data: {
      provider: 'real',
      requestedProvider: 'real',
      mock: false,
      fallback: false,
      status: 'failed',
      taskStatus: 'failed',
      taskId,
      errorCode,
      reason,
      quotaRecordId,
      quotaRecordStatus,
      quotaRolledBack,
      rollbackStatus,
      providerTaskId,
      providerStatus
    }
  }
}

function buildRealProviderPendingOutput(result = {}, quotaPreflight = {}, advancedPromptMeta = {}, providerPromptMeta = {}) {
  const taskId = result.taskId || result.task_id || ''
  const providerTaskId = getRealProviderTaskId(result)
  const providerStatus = getRealProviderStatus(result) || 'pending'
  const status = providerStatus === 'accepted' ? 'accepted' : 'pending'
  return {
    code: 0,
    success: true,
    ok: true,
    provider: 'real',
    status,
    taskStatus: status,
    taskId: taskId || providerTaskId,
    providerTaskId,
    providerStatus,
    quotaRecordId: quotaPreflight.quotaRecordId || '',
    quotaRecordStatus: 'consumed',
    quotaPendingFinalization: true,
    resultImageUrl: '',
    data: {
      provider: 'real',
      requestedProvider: 'real',
      mock: false,
      fallback: false,
      status,
      taskStatus: status,
      taskId: taskId || providerTaskId,
      providerTaskId,
      providerStatus,
      quotaRecordId: quotaPreflight.quotaRecordId || '',
      quotaRecordStatus: 'consumed',
      quotaPendingFinalization: true,
      advancedPromptMeta,
      providerPromptMeta
    }
  }
}

function createFabricReplaceConfigMissingOutput(input = {}, fabricConfig = {}) {
  return {
    success: false,
    ok: false,
    action: 'fabricReplace',
    taskId: input.taskId || '',
    status: 'failed',
    resultImageUrl: '',
    errorCode: 'FABRIC_REPLACE_CONFIG_MISSING',
    message: '闈㈡枡鏇挎崲鏈嶅姟鏆傛湭閰嶇疆',
    data: {
      provider: 'real',
      requestedProvider: 'fabric_replace',
      actionType: 'fabric_replace',
      fabricType: input.fabricType || '',
      hasEndpoint: !!fabricConfig.hasEndpoint,
      hasApiKey: !!fabricConfig.hasApiKey
    }
  }
}

function createFabricReplaceInvalidInputOutput(input = {}, reason = 'invalid_input') {
  return {
    success: false,
    ok: false,
    action: 'fabricReplace',
    taskId: input.taskId || '',
    status: 'failed',
    resultImageUrl: '',
    errorCode: 'FABRIC_REPLACE_INVALID_INPUT',
    message: reason === 'missing_source_image_url'
      ? '缂哄皯闈㈡枡鏇挎崲婧愬浘'
      : '缂哄皯闈㈡枡绫诲瀷',
    data: {
      provider: 'real',
      requestedProvider: 'fabric_replace',
      actionType: 'fabric_replace',
      fabricType: input.fabricType || '',
      hasEndpoint: false,
      hasApiKey: false
    }
  }
}

function createFabricReplaceRealNotImplementedOutput(input = {}, fabricConfig = {}) {
  return {
    success: false,
    ok: false,
    action: 'fabricReplace',
    taskId: input.taskId || '',
    status: 'failed',
    resultImageUrl: '',
    errorCode: 'FABRIC_REPLACE_REAL_NOT_IMPLEMENTED',
    message: '闈㈡枡鏇挎崲鐪熷疄鎺ュ彛灏氭湭鍚敤',
    data: {
      provider: 'real',
      requestedProvider: 'fabric_replace',
      actionType: 'fabric_replace',
      fabricType: input.fabricType || '',
      hasEndpoint: !!fabricConfig.hasEndpoint,
      hasApiKey: !!fabricConfig.hasApiKey,
      model: fabricConfig.model || '',
      timeoutMs: fabricConfig.timeoutMs || 0,
      providerCallSkipped: true
    }
  }
}

exports.main = async (event = {}) => {
  try {
    console.log('[ai_generate] event received', getInputLogSummary(event))

    const action = event.action || ''
    const config = getAiConfig()
    config.providerDryRun = isProviderDryRunRequested(event)
    console.log('[ai_generate:config] provider summary', {
      ...getAiConfigSummary(config, action),
      nodeEnv: process.env.NODE_ENV || ''
    })
    const switchMatrix = getProviderSwitchMatrix(config)

    if (action === 'debugConfig') {
      const appStage = String(process.env.APP_STAGE || 'production').trim().toLowerCase()
      const mockFallbackEnabled = config.disableMockFallback !== true
      const endpointRegion = String(config.endpoint || '').includes('ap-southeast-1') ? 'ap-southeast-1' : (String(config.endpoint || '').includes('cn-beijing') || String(config.endpoint || '').includes('dashscope.aliyuncs.com') ? 'cn-beijing' : 'unknown')
      const supportedTaskTypes = ['identity_replace', 'head_replace', 'face_replace', 'virtual_try_on', 'garment_replace', 'top_replace', 'bottom_replace', 'full_outfit_replace', 'scene_replace', 'pose_replace', 'color_replace', 'fabric_replace', 'pattern_replace', 'style_remix', 'product_display', 'flat_lay', 'detail_image', 'batch_model']
      return {
        success: true,
        action: 'debugConfig',
        enableRealProviderCall: switchMatrix.enableRealProviderCall,
        providerDryRun: switchMatrix.providerDryRun,
        enableRealQuotaGuard: switchMatrix.enableRealQuotaGuard,
        switchMatrixMode: switchMatrix.switchMatrixMode,
        switchMatrixAllowed: switchMatrix.switchMatrixAllowed,
        switchMatrixBlockers: switchMatrix.switchMatrixBlockers,
        data: {
          appStage,
          provider: config.provider,
          model: config.model,
          realProviderEnabled: switchMatrix.enableRealProviderCall,
          realQuotaGuardEnabled: switchMatrix.enableRealQuotaGuard,
          dryRun: switchMatrix.providerDryRun,
          mockFallbackEnabled,
          hasEndpoint: config.hasEndpoint,
          hasApiKey: config.hasApiKey,
          endpointRegion,
          supportedTaskTypes,
          enableRealProviderCall: switchMatrix.enableRealProviderCall,
          providerDryRun: switchMatrix.providerDryRun,
          enableRealQuotaGuard: switchMatrix.enableRealQuotaGuard,
          switchMatrixMode: switchMatrix.switchMatrixMode,
          switchMatrixAllowed: switchMatrix.switchMatrixAllowed,
          switchMatrixBlockers: switchMatrix.switchMatrixBlockers,
          realProviderRequiresQuotaRecord: true,
          hasEndpoint: config.hasEndpoint,
          hasApiKey: config.hasApiKey,
          timeoutMs: config.timeoutMs,
          retryTimes: config.retryTimes,
          retryBaseDelayMs: config.retryBaseDelayMs,
          model: config.model,
          fabricReplaceProvider: config.fabricReplace.provider,
          hasFabricReplaceEndpoint: config.fabricReplace.hasEndpoint,
          hasFabricReplaceApiKey: config.fabricReplace.hasApiKey,
          fabricReplaceModel: config.fabricReplace.model,
          fabricReplaceTimeoutMs: config.fabricReplace.timeoutMs
        }
      }
    }

    if (action === 'fabricReplace') {
      const input = normalizeFabricReplaceInput(event)
      attachQuotaContractFields(input, event)
      const advancedPromptMeta = getAdvancedPromptMeta(event)
      const providerPromptPayload = buildProviderPromptPayload(getProviderPromptInput(event, input))
      const fabricConfig = config.fabricReplace || {}
      const eventPayload = getEventPayload(event)
      const fabricProvider =
        config.providerDryRun === true && eventPayload.provider === 'real'
          ? 'real'
          : fabricConfig.provider
      console.log('[ai_generate:fabricReplace] input normalized', {
        action,
        ...getFabricReplaceLogSummary(input),
        provider: fabricProvider || 'mock',
        hasEndpoint: !!fabricConfig.hasEndpoint,
        hasApiKey: !!fabricConfig.hasApiKey
      })
      console.log('[ai_generate:provider-prompt] built', {
        providerTaskType: providerPromptPayload.providerTaskType,
        costActionType: providerPromptPayload.promptMeta.costActionType,
        hasFullAdvancedPromptSummary: providerPromptPayload.promptMeta.hasFullAdvancedPromptSummary,
        fullAdvancedPromptSummaryLength: providerPromptPayload.promptMeta.fullAdvancedPromptSummaryLength,
        positivePromptLength: providerPromptPayload.promptMeta.positivePromptLength,
        negativePromptLength: providerPromptPayload.promptMeta.negativePromptLength,
        advancedCustomPromptCount: providerPromptPayload.promptMeta.advancedCustomPromptCount,
        advancedOptionPromptCount: providerPromptPayload.promptMeta.advancedOptionPromptCount
      })

      let response = null
      if (fabricProvider !== 'real') {
        response = createFabricReplaceConfigMissingOutput(input, fabricConfig)
      } else if (config.enableRealProviderCall !== true && config.providerDryRun !== true) {
        response = {
          success: false,
          ok: false,
          action: 'fabricReplace',
          taskId: input.taskId || '',
          status: 'failed',
          resultImageUrl: '',
          errorCode: 'REAL_PROVIDER_DISABLED',
          message: 'Real AI provider is disabled. Enable ENABLE_REAL_PROVIDER_CALL on the server.',
          data: {
            provider: 'real',
            requestedProvider: 'fabric_replace',
            actionType: 'fabric_replace',
            providerReceivedRequest: false,
            providerAcceptedTask: false,
            shouldRollbackQuota: false,
            shouldEnterPolling: false
          }
        }
      } else {
        let quotaPreflight = buildRealProviderQuotaPreflight(event, input, 'real', config)
        quotaPreflight = await hydrateRealProviderQuotaPreflight(quotaPreflight, event, input, 'real', config)
        Object.assign(quotaPreflight, buildQuotaPreflightDiagnostics(quotaPreflight, input, event))
        const quotaPreflightLog = {
          provider: quotaPreflight.provider,
          enableRealProviderCall: quotaPreflight.enableRealProviderCall,
          enableRealQuotaGuard: quotaPreflight.enableRealQuotaGuard,
          providerDryRun: quotaPreflight.providerDryRun,
          switchMatrixMode: quotaPreflight.switchMatrixMode,
          switchMatrixAllowed: quotaPreflight.switchMatrixAllowed,
          switchMatrixBlockers: quotaPreflight.switchMatrixBlockers,
          hasQuotaRecordId: quotaPreflight.hasQuotaRecordId,
          hasIdempotencyKey: quotaPreflight.hasIdempotencyKey,
          hasConsumedRecord: quotaPreflight.hasConsumedRecord,
          quotaRecordLookupStatus: quotaPreflight.quotaRecordLookupStatus,
          quotaRecordStatus: quotaPreflight.quotaRecordStatus,
          costActionType: quotaPreflight.costActionType,
          preflightOk: quotaPreflight.preflightOk,
          errorCode: quotaPreflight.errorCode
        }
        console.warn('[ai_generate:real-provider:quota-preflight]', quotaPreflightLog)
        if (config.providerDryRun === true) {
          console.warn('[ai_generate:provider-dry-run] quota preflight', {
            ...quotaPreflightLog,
            ok: quotaPreflight.preflightOk,
            dryRun: true
          })
        }
        if (!quotaPreflight.preflightOk) {
          response = createRealQuotaGuardRequiredOutput(quotaPreflight)
          response.action = 'fabricReplace'
          response.taskId = input.taskId || ''
          response.status = 'failed'
          response.resultImageUrl = ''
        } else if (config.providerDryRun === true) {
          const dryRunResult = runDryRunForInput(input, config, providerPromptPayload)
          response = buildDryRunResponse(
            dryRunResult,
            advancedPromptMeta,
            providerPromptPayload.promptMeta,
            quotaPreflight
          )
          response.action = 'fabricReplace'
        } else if (!input.sourceImageUrl) {
          response = createFabricReplaceInvalidInputOutput(input, 'missing_source_image_url')
        } else if (!input.fabricType) {
          response = createFabricReplaceInvalidInputOutput(input, 'missing_fabric_type')
        } else if (!fabricConfig.hasEndpoint || !fabricConfig.hasApiKey) {
          response = createFabricReplaceConfigMissingOutput(input, fabricConfig)
        } else {
          // P2 configuration gate only. P3 will implement the Wanxiang request.
          response = createFabricReplaceRealNotImplementedOutput(input, fabricConfig)
        }
      }

      console.log('[ai_generate:fabricReplace] response', {
        action,
        taskId: response.taskId,
        status: response.status,
        hasResultImage: !!response.resultImageUrl,
        provider: response.data && response.data.provider,
        requestedProvider: response.data && response.data.requestedProvider,
        actionType: response.data && response.data.actionType,
        hasEndpoint: !!(response.data && response.data.hasEndpoint),
        hasApiKey: !!(response.data && response.data.hasApiKey),
        errorCode: response.errorCode || '',
        ok: !!response.ok
      })
      response.data = response.data || {}
      response.data.advancedPromptMeta = advancedPromptMeta
      response.data.providerPromptMeta = providerPromptPayload.promptMeta
      return response
    }

    const isGenerateAction = action === 'generate' || action === 'generateResult' || !action
    if (!isGenerateAction) {
      return normalizeFailureOutput('unsupported action', 400)
    }

    const input = normalizeInput(event)
    const eventPayloadForGenerate = getEventPayload(event)
    const generateInputPayload = eventPayloadForGenerate.input || {}
    const generateParamsPayload = eventPayloadForGenerate.params || {}
    input.sourceImageUrl = input.sourceImageUrl ||
      generateInputPayload.sourceImageUrl ||
      generateInputPayload.imageUrl ||
      eventPayloadForGenerate.sourceImageUrl ||
      eventPayloadForGenerate.imageUrl ||
      ''
    input.prompt = generateInputPayload.prompt || eventPayloadForGenerate.prompt || ''
    input.taskType = eventPayloadForGenerate.taskType || input.taskType || ''
    input.outputType = generateParamsPayload.outputType || eventPayloadForGenerate.outputType || ''
    input.scene = generateParamsPayload.sceneType || generateParamsPayload.scene || input.scene || ''
    console.log('[ai_generate:generate] action routed', {
      action: action || 'generateResult',
      taskType: input.taskType || '',
      hasQuotaRecordId: !!eventPayloadForGenerate.quotaRecordId,
      quotaRecordStatus: eventPayloadForGenerate.quotaRecordStatus || '',
      switchMatrixMode: switchMatrix.switchMatrixMode,
      switchMatrixAllowed: switchMatrix.switchMatrixAllowed,
      providerDryRun: switchMatrix.providerDryRun,
      enableRealProviderCall: switchMatrix.enableRealProviderCall
    })
    const advancedPromptPayload = getAdvancedPromptPayload(event)
    const advancedPromptMeta = getAdvancedPromptMeta(event)
    const providerPromptPayload = buildProviderPromptPayload(getProviderPromptInput(event, input))
    Object.assign(input, advancedPromptPayload)
    attachQuotaContractFields(input, event)
    input.advancedPromptMeta = advancedPromptMeta
    input.providerPromptMeta = providerPromptPayload.promptMeta
    console.log('[ai_generate] input normalized', getInputLogSummary(input))
    console.log('[ai_generate] advanced prompt meta', advancedPromptMeta)
    console.log('[ai_generate:provider-prompt] built', {
      providerTaskType: providerPromptPayload.providerTaskType,
      costActionType: providerPromptPayload.promptMeta.costActionType,
      hasFullAdvancedPromptSummary: providerPromptPayload.promptMeta.hasFullAdvancedPromptSummary,
      fullAdvancedPromptSummaryLength: providerPromptPayload.promptMeta.fullAdvancedPromptSummaryLength,
      positivePromptLength: providerPromptPayload.promptMeta.positivePromptLength,
      negativePromptLength: providerPromptPayload.promptMeta.negativePromptLength,
      advancedCustomPromptCount: providerPromptPayload.promptMeta.advancedCustomPromptCount,
      advancedOptionPromptCount: providerPromptPayload.promptMeta.advancedOptionPromptCount
    })
    const payload = getEventPayload(event)
    const provider =
      config.providerDryRun === true
        ? 'real'
        : config.provider
    const adapter = getAdapter(provider)
    console.log('[ai_generate] provider selected', {
      provider: adapter.name,
      taskId: input.taskId,
      enableRealProviderCall: !!config.enableRealProviderCall,
      hasEndpoint: config.hasEndpoint,
      hasApiKey: config.hasApiKey
    })

    let generateResult = null
    let realQuotaPreflight = null
    try {
      // TODO(provider-cost-guard): before enabling paid real providers, require
      // a quota_guard consume record or consume server-side with an idempotencyKey.
      // On provider failure, rollback only when the provider did not receive the
      // request or clearly did not charge. Async task_id responses must not be
      // resubmitted or rolled back until final failure is confirmed.
      if (
        provider === 'real' &&
        config.enableRealProviderCall !== true &&
        config.providerDryRun !== true
      ) {
        console.warn('[ai_generate] real provider disabled', {
          provider,
          requestedProvider: 'real',
          enableRealProviderCall: !!config.enableRealProviderCall,
          blockedReason: 'REAL_PROVIDER_DISABLED'
        })
        generateResult = createRealProviderDisabledResult(input, config)
      } else if (provider === 'real') {
        let quotaPreflight = buildRealProviderQuotaPreflight(event, input, provider, config)
        quotaPreflight = await hydrateRealProviderQuotaPreflight(quotaPreflight, event, input, provider, config)
        Object.assign(quotaPreflight, buildQuotaPreflightDiagnostics(quotaPreflight, input, event))
        realQuotaPreflight = quotaPreflight
        const quotaPreflightLog = {
          provider: quotaPreflight.provider,
          enableRealProviderCall: quotaPreflight.enableRealProviderCall,
          enableRealQuotaGuard: quotaPreflight.enableRealQuotaGuard,
          providerDryRun: quotaPreflight.providerDryRun,
          switchMatrixMode: quotaPreflight.switchMatrixMode,
          switchMatrixAllowed: quotaPreflight.switchMatrixAllowed,
          switchMatrixBlockers: quotaPreflight.switchMatrixBlockers,
          hasQuotaRecordId: quotaPreflight.hasQuotaRecordId,
          hasIdempotencyKey: quotaPreflight.hasIdempotencyKey,
          hasConsumedRecord: quotaPreflight.hasConsumedRecord,
          quotaRecordLookupStatus: quotaPreflight.quotaRecordLookupStatus,
          quotaRecordStatus: quotaPreflight.quotaRecordStatus,
          costActionType: quotaPreflight.costActionType,
          preflightOk: quotaPreflight.preflightOk,
          errorCode: quotaPreflight.errorCode
        }
        console.warn('[ai_generate:real-provider:quota-preflight]', quotaPreflightLog)
        if (config.providerDryRun === true) {
          console.warn('[ai_generate:provider-dry-run] quota preflight', {
            ...quotaPreflightLog,
            ok: quotaPreflight.preflightOk,
            dryRun: true
          })
        }
        if (!quotaPreflight.preflightOk) {
          return createRealQuotaGuardRequiredOutput(quotaPreflight)
        }
        if (config.providerDryRun === true) {
          const dryRunResult = runDryRunForInput(input, config, providerPromptPayload)
          return buildDryRunResponse(
            dryRunResult,
            advancedPromptMeta,
            providerPromptPayload.promptMeta,
            quotaPreflight
          )
        }
        generateResult = await adapter.generate(input, config)
      } else {
        generateResult = await adapter.generate(input, config)
      }
    } catch (adapterError) {
      if (provider !== 'real') {
        throw adapterError
      }
      const errorCode = (adapterError && (adapterError.code || adapterError.errCode || adapterError.errorCode)) || 'request_error'
      console.warn('[ai_generate] real provider request failed', {
        taskId: maskLogId(input.taskId),
        status: 'failed',
        errorCode
      })
      if (config.enableRealProviderCall === true && config.providerDryRun !== true) {
        const quotaPayload = realQuotaPreflight || buildRealProviderQuotaPreflight(event, input, provider, config)
        const rollbackResult = await rollbackRealQuotaUsage({
          quotaRecordId: quotaPayload.quotaRecordId,
          idempotencyKey: quotaPayload.idempotencyKey || input.idempotencyKey,
          taskId: input.taskId,
          costActionType: quotaPayload.costActionType || input.costActionType,
          providerTaskId: '',
          reason: errorCode
        })
        if (!(rollbackResult && (rollbackResult.ok || rollbackResult.success))) {
          return buildRealProviderFailureOutput({
            errorCode: 'QUOTA_ROLLBACK_FAILED',
            reason: rollbackResult.reason || rollbackResult.errorCode || 'quota_rollback_failed',
            taskId: input.taskId,
            providerStatus: 'request_error',
            quotaRecordId: quotaPayload.quotaRecordId,
            quotaRecordStatus: quotaPayload.quotaRecordStatus || 'consumed',
            rollbackStatus: rollbackResult.status || (rollbackResult.data && rollbackResult.data.status) || 'failed'
          })
        }
        return buildRealProviderFailureOutput({
          errorCode,
          reason: errorCode,
          taskId: input.taskId,
          providerStatus: 'request_error',
          quotaRecordId: quotaPayload.quotaRecordId,
          quotaRecordStatus: 'rolled_back',
          quotaRolledBack: true,
          rollbackStatus: rollbackResult.status || (rollbackResult.data && rollbackResult.data.status) || 'rolled_back'
        })
      }
    }

    if (
      provider === 'real' &&
      (!generateResult || generateResult.fallbackToMock)
    ) {
      const fallbackReason =
        (generateResult && generateResult.reason) ||
        'empty_result'
      const fallbackErrorCode =
        (generateResult && generateResult.errorCode) ||
        (generateResult && generateResult.fallbackErrorCode) ||
        ''
      console.warn('[ai_generate] real provider fallback requested', {
        action: 'generate',
        taskId: maskLogId(input.taskId),
        status: 'failed',
        errorCode: fallbackErrorCode || fallbackReason
      })
      if (config.enableRealProviderCall === true) {
        const quotaPayload = realQuotaPreflight || buildRealProviderQuotaPreflight(event, input, provider, config)
        const rollbackResult = await rollbackRealQuotaUsage({
          quotaRecordId: quotaPayload.quotaRecordId,
          idempotencyKey: quotaPayload.idempotencyKey || input.idempotencyKey,
          taskId: input.taskId,
          costActionType: quotaPayload.costActionType || input.costActionType,
          providerTaskId: getRealProviderTaskId(generateResult || {}),
          reason: fallbackErrorCode || fallbackReason || 'real_provider_failed'
        })
        if (!(rollbackResult && (rollbackResult.ok || rollbackResult.success))) {
          return buildRealProviderFailureOutput({
            errorCode: 'QUOTA_ROLLBACK_FAILED',
            reason: rollbackResult.reason || rollbackResult.errorCode || 'quota_rollback_failed',
            taskId: input.taskId,
            providerTaskId: getRealProviderTaskId(generateResult || {}),
            providerStatus: getRealProviderStatus(generateResult || {}) || 'failed',
            quotaRecordId: quotaPayload.quotaRecordId,
            quotaRecordStatus: quotaPayload.quotaRecordStatus || 'consumed',
            rollbackStatus: rollbackResult.status || (rollbackResult.data && rollbackResult.data.status) || 'failed'
          })
        }
        return buildRealProviderFailureOutput({
          errorCode: fallbackErrorCode || 'REAL_PROVIDER_FAILED',
          reason: fallbackReason || 'real_provider_failed',
          taskId: input.taskId,
          providerTaskId: getRealProviderTaskId(generateResult || {}),
          providerStatus: getRealProviderStatus(generateResult || {}) || 'failed',
          quotaRecordId: quotaPayload.quotaRecordId,
          quotaRecordStatus: 'rolled_back',
          quotaRolledBack: true,
          rollbackStatus: rollbackResult.status || (rollbackResult.data && rollbackResult.data.status) || 'rolled_back'
        })
      }
      return buildRealProviderFailureOutput({
        errorCode: fallbackErrorCode || 'REAL_PROVIDER_FAILED',
        reason: fallbackReason || 'real_provider_failed',
        taskId: input.taskId,
        providerTaskId: getRealProviderTaskId(generateResult || {}),
        providerStatus: getRealProviderStatus(generateResult || {}) || 'failed',
        quotaRecordId: '',
        quotaRecordStatus: 'not_consumed',
        quotaRolledBack: false,
        rollbackStatus: 'not_required'
      })
    }

    if (!generateResult) {
      throw new Error('provider returned empty result')
    }

    if (provider === 'real' && config.enableRealProviderCall === true && config.providerDryRun !== true) {
      const quotaPayload = realQuotaPreflight || buildRealProviderQuotaPreflight(event, input, provider, config)
      const providerTaskId = getRealProviderTaskId(generateResult)
      const providerStatus = getRealProviderStatus(generateResult)
      if (isRealProviderPendingResult(generateResult)) {
        return buildRealProviderPendingOutput(
          generateResult,
          quotaPayload,
          advancedPromptMeta,
          providerPromptPayload.promptMeta
        )
      }
      if (isRealProviderFailureResult(generateResult) || !hasValidRealProviderResult(generateResult)) {
        const reason = generateResult.errorCode || generateResult.reason || providerStatus || 'invalid_response'
        const rollbackResult = await rollbackRealQuotaUsage({
          quotaRecordId: quotaPayload.quotaRecordId,
          idempotencyKey: quotaPayload.idempotencyKey || input.idempotencyKey,
          taskId: input.taskId,
          costActionType: quotaPayload.costActionType || input.costActionType,
          providerTaskId,
          reason
        })
        if (!(rollbackResult && (rollbackResult.ok || rollbackResult.success))) {
          return buildRealProviderFailureOutput({
            errorCode: 'QUOTA_ROLLBACK_FAILED',
            reason: rollbackResult.reason || rollbackResult.errorCode || 'quota_rollback_failed',
            taskId: input.taskId,
            providerTaskId,
            providerStatus: providerStatus || 'failed',
            quotaRecordId: quotaPayload.quotaRecordId,
            quotaRecordStatus: quotaPayload.quotaRecordStatus || 'consumed',
            rollbackStatus: rollbackResult.status || (rollbackResult.data && rollbackResult.data.status) || 'failed'
          })
        }
        return buildRealProviderFailureOutput({
          errorCode: generateResult.errorCode || 'REAL_PROVIDER_FAILED',
          reason,
          taskId: input.taskId,
          providerTaskId,
          providerStatus: providerStatus || 'failed',
          quotaRecordId: quotaPayload.quotaRecordId,
          quotaRecordStatus: 'rolled_back',
          quotaRolledBack: true,
          rollbackStatus: rollbackResult.status || (rollbackResult.data && rollbackResult.data.status) || 'rolled_back'
        })
      }
      const finalizeResult = await finalizeRealQuotaUsage({
        quotaRecordId: quotaPayload.quotaRecordId,
        idempotencyKey: quotaPayload.idempotencyKey || input.idempotencyKey,
        taskId: input.taskId,
        costActionType: quotaPayload.costActionType || input.costActionType,
        providerTaskId
      })
      if (!(finalizeResult && (finalizeResult.ok || finalizeResult.success))) {
        return buildRealProviderFailureOutput({
          errorCode: 'QUOTA_FINALIZE_FAILED',
          reason: finalizeResult.reason || finalizeResult.errorCode || 'quota_finalize_failed',
          taskId: input.taskId,
          providerTaskId,
          providerStatus: providerStatus || 'success',
          quotaRecordId: quotaPayload.quotaRecordId,
          quotaRecordStatus: quotaPayload.quotaRecordStatus || 'consumed'
        })
      }
      generateResult.quotaRecordId = quotaPayload.quotaRecordId
      generateResult.quotaRecordStatus = 'finalized'
      generateResult.quotaFinalized = true
      generateResult.finalizeStatus = finalizeResult.status || (finalizeResult.data && finalizeResult.data.status) || 'finalized'
      generateResult.providerStatus = providerStatus || generateResult.status || 'success'
    }

    generateResult.provider = generateResult.provider || adapter.name
    generateResult.requestedProvider = generateResult.requestedProvider || provider
    generateResult.fallback = !!generateResult.fallback
    generateResult.fallbackReason = generateResult.fallbackReason || ''
    generateResult.advancedPromptMeta = advancedPromptMeta
    generateResult.providerPromptMeta = providerPromptPayload.promptMeta

    console.log('[ai_generate] provider result', {
      taskId: generateResult.taskId,
      status: generateResult.status,
      hasResultImage: !!(generateResult.resultImageUrl || generateResult.result_image_url),
      mock: generateResult.mock,
      provider: generateResult.provider || adapter.name,
      fallback: !!generateResult.fallback
    })

    const response = normalizeSuccessOutput(generateResult)
    response.data = response.data || {}
    response.data.advancedPromptMeta = advancedPromptMeta
    response.data.providerPromptMeta = providerPromptPayload.promptMeta
    if (generateResult.quotaRecordId) {
      response.quotaRecordId = generateResult.quotaRecordId
      response.quotaRecordStatus = generateResult.quotaRecordStatus || ''
      response.quotaFinalized = !!generateResult.quotaFinalized
      response.finalizeStatus = generateResult.finalizeStatus || ''
      response.providerStatus = generateResult.providerStatus || ''
      response.data.quotaRecordId = response.quotaRecordId
      response.data.quotaRecordStatus = response.quotaRecordStatus
      response.data.quotaFinalized = response.quotaFinalized
      response.data.finalizeStatus = response.finalizeStatus
      response.data.providerStatus = response.providerStatus
    }
    console.log('[ai_generate] response normalized', {
      taskId: response.taskId,
      status: response.status,
      hasResultImage: !!response.resultImageUrl,
      advancedPromptMeta
    })

    return response
  } catch (error) {
    const message = (error && error.message) || 'ai_generate failed'
    console.error('[ai_generate] failed', {
      message,
      code: error && (error.code || error.errCode || error.errorCode)
    })
    return normalizeFailureOutput(message)
  }
}
