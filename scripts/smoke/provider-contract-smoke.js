const Module = require('module')

const originalLoad = Module._load
Module._load = function patchedLoad(request, parent, isMain) {
  if (request === 'wx-server-sdk') {
    return {
      getTempFileURL: async () => ({ fileList: [] })
    }
  }
  return originalLoad.call(this, request, parent, isMain)
}

const {
  buildProviderPromptPayload
} = require('../../cloudfunctions/ai_generate/utils/providerPromptAdapter')
const {
  buildProviderContractError,
  buildRealProviderRequestPlan,
  normalizeRealProviderResponse,
  runRealProviderDryRun,
  validateRealProviderRequestPlan
} = require('../../cloudfunctions/ai_generate/adapters/real')

function summarizePrompt(promptPayload = {}) {
  const meta = promptPayload.promptMeta || {}
  return {
    providerTaskType: promptPayload.providerTaskType || meta.providerTaskType || '',
    promptVersion: meta.promptVersion || '',
    hasFullAdvancedPromptSummary: !!meta.hasFullAdvancedPromptSummary,
    positivePromptLength: Number(meta.positivePromptLength || 0),
    negativePromptLength: Number(meta.negativePromptLength || 0),
    costActionType: meta.costActionType || ''
  }
}

function buildPlan(input = {}, config = {}) {
  const promptPayload = buildProviderPromptPayload(input)
  const retryTimes = typeof config.retryTimes === 'number' ? config.retryTimes : 0
  const plan = buildRealProviderRequestPlan(
    {
      ...input,
      providerTaskType: promptPayload.providerTaskType,
      providerPromptMeta: promptPayload.promptMeta
    },
    {
      endpoint: config.endpoint || '',
      apiKey: config.apiKey || '',
      model: config.model || 'wanx-image-edit',
      timeoutMs: config.timeoutMs || 65000,
      retryTimes,
      effectiveRetryTimes: typeof config.effectiveRetryTimes === 'number' ? config.effectiveRetryTimes : Math.min(retryTimes, 1),
      retryBaseDelayMs: config.retryBaseDelayMs || 500,
      pollEndpoint: config.pollEndpoint || '',
      pollIntervalMs: config.pollIntervalMs || 2500,
      pollMaxAttempts: config.pollMaxAttempts || 20,
      enableRealProviderCall: config.enableRealProviderCall === true
    },
    {
      clothImageUrl: config.clothImageUrl || '',
      clothImageSource: config.clothImageSource || 'manual_contract_smoke'
    }
  )

  return {
    promptPayload,
    plan
  }
}

function buildSwitchMatrix(config = {}) {
  const enableRealQuotaGuard = config.enableRealQuotaGuard === true
  const providerDryRun = config.providerDryRun === true
  const enableRealProviderCall = config.enableRealProviderCall === true
  let modeName = 'A_DEFAULT_SAFE_MOCK'
  let allowed = true
  const blockers = []

  if (!enableRealQuotaGuard && !providerDryRun && !enableRealProviderCall) {
    modeName = 'A_DEFAULT_SAFE_MOCK'
  } else if (enableRealQuotaGuard && !providerDryRun && !enableRealProviderCall) {
    modeName = 'B_QUOTA_REAL_ALPHA_ONLY'
  } else if (enableRealQuotaGuard && providerDryRun && !enableRealProviderCall) {
    modeName = 'C_PROVIDER_DRY_RUN_WITH_REAL_QUOTA'
  } else if (!enableRealQuotaGuard && providerDryRun && !enableRealProviderCall) {
    modeName = 'D_BLOCKED_DRY_RUN_WITHOUT_REAL_QUOTA'
    allowed = false
    blockers.push('ENABLE_REAL_QUOTA_GUARD_REQUIRED_FOR_PROVIDER_DRY_RUN')
  } else if (!enableRealQuotaGuard && !providerDryRun && enableRealProviderCall) {
    modeName = 'E_BLOCKED_REAL_PROVIDER_WITHOUT_REAL_QUOTA'
    allowed = false
    blockers.push('REAL_QUOTA_GUARD_REQUIRED')
  } else if (enableRealQuotaGuard && providerDryRun && enableRealProviderCall) {
    modeName = 'F_BLOCKED_REAL_PROVIDER_AND_DRY_RUN_CONFLICT'
    allowed = false
    blockers.push('PROVIDER_SWITCH_CONFLICT')
  } else if (enableRealQuotaGuard && !providerDryRun && enableRealProviderCall) {
    modeName = 'G_REAL_PROVIDER_GRAY_ALLOWED'
  } else {
    modeName = 'UNKNOWN_BLOCKED_PROVIDER_SWITCH_MATRIX'
    allowed = false
    blockers.push('PROVIDER_SWITCH_MATRIX_UNKNOWN')
  }

  return {
    modeName,
    allowed,
    blockers
  }
}

function assertCondition(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

function toRow(name, ok, details = {}) {
  return {
    name,
    ok: !!ok,
    providerTaskType: details.providerTaskType || '',
    errorCode: details.errorCode || '',
    shouldRollbackQuota:
      typeof details.shouldRollbackQuota === 'boolean' ? details.shouldRollbackQuota : undefined,
    shouldEnterPolling:
      typeof details.shouldEnterPolling === 'boolean' ? details.shouldEnterPolling : undefined,
    providerAcceptedTask:
      typeof details.providerAcceptedTask === 'boolean' ? details.providerAcceptedTask : undefined,
    providerDryRun:
      typeof details.providerDryRun === 'boolean' ? details.providerDryRun : undefined,
    hasQuotaRecordId:
      typeof details.hasQuotaRecordId === 'boolean' ? details.hasQuotaRecordId : undefined
  }
}

function runCase(name, fn) {
  try {
    const details = fn() || {}
    return toRow(name, true, details)
  } catch (error) {
    return toRow(name, false, {
      errorCode: (error && error.message) || 'SMOKE_CASE_FAILED'
    })
  }
}

const rows = []

rows.push(runCase('P18 blocks real provider when quota guard disabled', () => {
  const matrix = buildSwitchMatrix({
    enableRealQuotaGuard: false,
    providerDryRun: false,
    enableRealProviderCall: true
  })

  assertCondition(matrix.allowed === false, 'real provider must be blocked without real quota guard')
  assertCondition(matrix.blockers.includes('REAL_QUOTA_GUARD_REQUIRED'), 'expected REAL_QUOTA_GUARD_REQUIRED')

  return {
    errorCode: 'REAL_QUOTA_GUARD_REQUIRED',
    shouldRollbackQuota: false,
    shouldEnterPolling: false,
    providerAcceptedTask: false
  }
}))

rows.push(runCase('P18 blocks real provider and dryRun switch conflict', () => {
  const matrix = buildSwitchMatrix({
    enableRealQuotaGuard: true,
    providerDryRun: true,
    enableRealProviderCall: true
  })

  assertCondition(matrix.allowed === false, 'real provider and dryRun must not be enabled together')
  assertCondition(matrix.blockers.includes('PROVIDER_SWITCH_CONFLICT'), 'expected PROVIDER_SWITCH_CONFLICT')

  return {
    errorCode: 'PROVIDER_SWITCH_CONFLICT',
    shouldRollbackQuota: false,
    shouldEnterPolling: false,
    providerAcceptedTask: false
  }
}))

rows.push(runCase('P18 allows dryRun only with real quota guard and consumed record', () => {
  const matrix = buildSwitchMatrix({
    enableRealQuotaGuard: true,
    providerDryRun: true,
    enableRealProviderCall: false
  })

  assertCondition(matrix.allowed === true, 'dryRun with real quota guard should be allowed')
  assertCondition(matrix.modeName === 'C_PROVIDER_DRY_RUN_WITH_REAL_QUOTA', 'expected C dryRun mode')

  return {
    errorCode: '',
    shouldRollbackQuota: false,
    shouldEnterPolling: false,
    providerAcceptedTask: false,
    providerDryRun: true
  }
}))

rows.push(runCase('P18 real mode contract requires consumed quota and request id', () => {
  const matrix = buildSwitchMatrix({
    enableRealQuotaGuard: true,
    providerDryRun: false,
    enableRealProviderCall: true
  })
  const { plan } = buildPlan(
    {
      action: 'fabricReplace',
      entryScene: 'fabric_replace',
      costActionType: 'fabric_replace',
      taskId: 'manual_p18_real_contract',
      quotaRecordId: 'quota_record_p18_real_contract',
      quotaRecordStatus: 'consumed',
      idempotencyKey: 'manual_p18_real_contract_key',
      clothImage: {
        fileUrl: 'https://example.com/mock-source.jpg'
      }
    },
    {
      enableRealProviderCall: true,
      endpoint: 'https://provider.example.invalid/generate',
      apiKey: 'hidden-test-key',
      clothImageUrl: 'https://example.com/mock-source.jpg'
    }
  )
  const validation = validateRealProviderRequestPlan(plan)

  assertCondition(matrix.allowed === true, 'real gray mode should be allowed by matrix only after checklist')
  assertCondition(validation.ok === true, 'real request plan should validate with consumed quota record')
  assertCondition(!!plan.quotaRecordId, 'quotaRecordId should exist')
  assertCondition(!!plan.headers && !!plan.headers['X-Request-Id'], 'X-Request-Id should exist')

  return {
    providerTaskType: plan.providerTaskType,
    errorCode: validation.errorCode,
    shouldRollbackQuota: validation.shouldRollbackQuota,
    shouldEnterPolling: validation.shouldEnterPolling,
    providerAcceptedTask: validation.providerAcceptedTask,
    hasQuotaRecordId: !!plan.quotaRecordId
  }
}))

rows.push(runCase('fabric_replace requestPlan contract', () => {
  const input = {
    action: 'fabricReplace',
    entryScene: 'fabric_replace',
    costActionType: 'fabric_replace',
    sourceTaskId: 'manual_provider_contract_fabric',
    taskId: 'manual_provider_contract_fabric',
    idempotencyKey: 'manual_provider_contract_fabric_key',
    sourceImageUrl: 'https://example.com/mock-source.jpg',
    fullAdvancedPromptSummary: '[fabric_texture] 面料：牛仔；质感强度：强',
    clothImage: {
      fileUrl: 'https://example.com/mock-source.jpg'
    }
  }
  const { promptPayload, plan } = buildPlan(input, {
    enableRealProviderCall: false
  })
  const promptSummary = summarizePrompt(promptPayload)
  const validation = validateRealProviderRequestPlan(plan)

  assertCondition(promptSummary.providerTaskType === 'image_edit_fabric_replace', 'providerTaskType mismatch')
  assertCondition(promptSummary.hasFullAdvancedPromptSummary === true, 'missing advanced prompt meta')
  assertCondition(plan.safety.allowRealProviderCall === false, 'real provider should be disabled by default')
  assertCondition(validation.ok === false, 'disabled real provider should not validate ok')
  assertCondition(validation.errorCode === 'REAL_PROVIDER_DISABLED', 'expected REAL_PROVIDER_DISABLED')

  return {
    providerTaskType: promptSummary.providerTaskType,
    errorCode: validation.errorCode,
    shouldRollbackQuota: validation.shouldRollbackQuota,
    shouldEnterPolling: validation.shouldEnterPolling,
    providerAcceptedTask: validation.providerAcceptedTask
  }
}))

rows.push(runCase('runway_video_10s prompt contract', () => {
  const { promptPayload } = buildPlan({
    action: 'generateResult',
    entryScene: 'runway_video',
    costActionType: 'runway_video_10s',
    durationSec: 10,
    taskId: 'manual_provider_contract_runway',
    fullAdvancedPromptSummary: '[runway_video] 时长：10秒；动作：自然走秀'
  })
  const promptSummary = summarizePrompt(promptPayload)

  assertCondition(promptSummary.providerTaskType === 'image_to_runway_video', 'providerTaskType mismatch')
  assertCondition(promptSummary.positivePromptLength > 0, 'positive prompt length should be positive')
  assertCondition(promptSummary.negativePromptLength > 0, 'negative prompt length should be positive')

  return {
    providerTaskType: promptSummary.providerTaskType
  }
}))

rows.push(runCase('image_to_sketch prompt contract', () => {
  const { promptPayload } = buildPlan({
    action: 'generateResult',
    entryScene: 'image_to_sketch',
    costActionType: 'image_to_sketch',
    taskId: 'manual_provider_contract_sketch',
    fullAdvancedPromptSummary: '[image_to_sketch] 线稿精度：精细'
  })
  const promptSummary = summarizePrompt(promptPayload)

  assertCondition(promptSummary.providerTaskType === 'image_to_structure_sketch', 'providerTaskType mismatch')
  assertCondition(promptSummary.negativePromptLength > 0, 'negative prompt length should be positive')

  return {
    providerTaskType: promptSummary.providerTaskType
  }
}))

rows.push(runCase('missing quota record blocks real provider', () => {
  const { promptPayload, plan } = buildPlan(
    {
      action: 'generateResult',
      entryScene: 'fabric_replace',
      costActionType: 'fabric_replace',
      taskId: 'manual_provider_contract_missing_quota',
      fullAdvancedPromptSummary: '[fabric_texture] 面料：牛仔'
    },
    {
      enableRealProviderCall: true,
      endpoint: 'https://provider.example.invalid/generate',
      apiKey: 'hidden-test-key',
      clothImageUrl: 'https://example.com/mock-source.jpg'
    }
  )
  const validation = validateRealProviderRequestPlan(plan)

  assertCondition(promptPayload.providerTaskType === 'image_edit_fabric_replace', 'providerTaskType mismatch')
  assertCondition(validation.ok === false, 'missing quota should fail validation')
  assertCondition(validation.errorCode === 'REAL_QUOTA_GUARD_REQUIRED', 'expected quota guard error')
  assertCondition(validation.providerReceivedRequest === false, 'provider should not receive request')
  assertCondition(validation.providerAcceptedTask === false, 'provider task should not be accepted')
  assertCondition(validation.shouldRollbackQuota === false, 'missing quota should not rollback without consumed record')

  return {
    providerTaskType: promptPayload.providerTaskType,
    errorCode: validation.errorCode,
    shouldRollbackQuota: validation.shouldRollbackQuota,
    shouldEnterPolling: validation.shouldEnterPolling,
    providerAcceptedTask: validation.providerAcceptedTask
  }
}))

rows.push(runCase('missing quotaRecordId blocks dryRun real provider', () => {
  const { promptPayload, plan } = buildPlan(
    {
      action: 'fabricReplace',
      entryScene: 'fabric_replace',
      costActionType: 'fabric_replace',
      sourceTaskId: 'manual_provider_contract_missing_dry_quota',
      taskId: 'manual_provider_contract_missing_dry_quota',
      idempotencyKey: 'manual_provider_contract_missing_dry_quota_key',
      fullAdvancedPromptSummary: '[fabric_texture] option summary only',
      clothImage: {
        fileUrl: 'https://example.com/mock-source.jpg'
      }
    },
    {
      enableRealProviderCall: true,
      endpoint: 'https://provider.example.invalid/dry-run',
      apiKey: 'hidden-dry-run-key',
      clothImageUrl: 'https://example.com/mock-source.jpg'
    }
  )
  const validation = validateRealProviderRequestPlan(plan)

  assertCondition(promptPayload.providerTaskType === 'image_edit_fabric_replace', 'providerTaskType mismatch')
  assertCondition(validation.ok === false, 'missing quota should block dryRun real path')
  assertCondition(validation.errorCode === 'REAL_QUOTA_GUARD_REQUIRED', 'expected REAL_QUOTA_GUARD_REQUIRED')
  assertCondition(validation.providerReceivedRequest === false, 'provider should not receive request')
  assertCondition(validation.providerAcceptedTask === false, 'provider task should not be accepted')
  assertCondition(validation.shouldRollbackQuota === false, 'missing quota record should not rollback')

  return {
    providerTaskType: promptPayload.providerTaskType,
    errorCode: validation.errorCode,
    shouldRollbackQuota: validation.shouldRollbackQuota,
    shouldEnterPolling: validation.shouldEnterPolling,
    providerAcceptedTask: validation.providerAcceptedTask,
    providerDryRun: true,
    hasQuotaRecordId: false
  }
}))

rows.push(runCase('real provider dryRun requestPlan contract', () => {
  const { promptPayload, plan } = buildPlan(
    {
      action: 'fabricReplace',
      entryScene: 'fabric_replace',
      costActionType: 'fabric_replace',
      sourceTaskId: 'manual_provider_contract_dry_run',
      taskId: 'manual_provider_contract_dry_run',
      idempotencyKey: 'manual_provider_contract_dry_run_key',
      quotaRecordId: 'manual_quota_record_dry_run',
      quotaRecordStatus: 'consumed',
      sourceImageUrl: 'https://example.com/mock-source.jpg',
      fullAdvancedPromptSummary: '[fabric_texture] 面料：牛仔；质感强度：强',
      clothImage: {
        fileUrl: 'https://example.com/mock-source.jpg'
      }
    },
    {
      enableRealProviderCall: true,
      endpoint: 'https://provider.example.invalid/dry-run',
      apiKey: 'hidden-dry-run-key',
      clothImageUrl: 'https://example.com/mock-source.jpg'
    }
  )
  const promptSummary = summarizePrompt(promptPayload)
  const validation = validateRealProviderRequestPlan(plan)
  const dryRun = runRealProviderDryRun(plan)

  assertCondition(validation.ok === true, 'dryRun requestPlan should validate with consumed quota record')
  assertCondition(plan.quotaRecordId === 'manual_quota_record_dry_run', 'quotaRecordId should pass through requestPlan')
  assertCondition(dryRun.ok === true, 'dryRun should return ok')
  assertCondition(dryRun.meta && dryRun.meta.dryRun === true, 'dryRun meta should be true')
  assertCondition(dryRun.meta && dryRun.meta.quotaRecordId === 'manual_quota_record_dry_run', 'dryRun meta should keep quotaRecordId')
  assertCondition(dryRun.providerReceivedRequest === false, 'dryRun must not send provider request')
  assertCondition(dryRun.providerAcceptedTask === false, 'dryRun must not accept provider task')
  assertCondition(dryRun.shouldRollbackQuota === false, 'dryRun should not rollback automatically')
  assertCondition(promptSummary.positivePromptLength > 0, 'positive prompt length should be positive')

  return {
    providerTaskType: dryRun.providerTaskType,
    errorCode: dryRun.errorCode,
    shouldRollbackQuota: dryRun.shouldRollbackQuota,
    shouldEnterPolling: dryRun.shouldEnterPolling,
    providerAcceptedTask: dryRun.providerAcceptedTask,
    providerDryRun: true,
    hasQuotaRecordId: !!plan.quotaRecordId
  }
}))

rows.push(runCase('normalize provider accepted async task', () => {
  const { plan } = buildPlan(
    {
      action: 'generateResult',
      entryScene: 'runway_video',
      costActionType: 'runway_video_10s',
      taskId: 'manual_provider_contract_async',
      quotaRecordId: 'quota_record_contract_async'
    },
    {
      enableRealProviderCall: true,
      endpoint: 'https://provider.example.invalid/generate',
      apiKey: 'hidden-test-key',
      clothImageUrl: 'https://example.com/mock-source.jpg'
    }
  )
  const normalized = normalizeRealProviderResponse(
    {
      task_id: 'provider_task_xxx',
      status: 'submitted'
    },
    plan
  )

  assertCondition(normalized.ok === true, 'accepted async task should return a pending real task instead of fallback mock')
  assertCondition(normalized.status === 'pending', 'async task should be pending')
  assertCondition(normalized.providerAcceptedTask === true, 'provider task should be accepted')
  assertCondition(normalized.shouldEnterPolling === true, 'async task should enter polling')
  assertCondition(normalized.shouldRollbackQuota === false, 'async task should not rollback immediately')
  assertCondition(normalized.fallback !== true, 'accepted async task must not fallback')
  assertCondition(normalized.mock !== true, 'accepted async task must not be mock')
  assertCondition(normalized.provider !== 'mock', 'accepted async provider must not be mock')
  assertCondition(!String(normalized.providerTaskId || '').startsWith('mock_generate_'), 'accepted async taskId must not be mock_generate')

  return {
    providerTaskType: normalized.providerTaskType,
    errorCode: normalized.errorCode,
    shouldRollbackQuota: normalized.shouldRollbackQuota,
    shouldEnterPolling: normalized.shouldEnterPolling,
    providerAcceptedTask: normalized.providerAcceptedTask
  }
}))

rows.push(runCase('retry timeout contract uses bounded retries and stable request id', () => {
  const input = {
    action: 'generateResult',
    entryScene: 'fabric_replace',
    costActionType: 'fabric_replace',
    taskId: 'manual_provider_contract_retry',
    modelType: 'female',
    scene: 'white',
    quotaRecordId: 'quota_record_retry_contract',
    quotaRecordStatus: 'consumed',
    idempotencyKey: 'manual_provider_contract_retry_key',
    clothImage: {
      fileUrl: 'https://example.com/mock-source.jpg'
    }
  }
  const { plan } = buildPlan(input, {
    enableRealProviderCall: true,
    endpoint: 'https://provider.example.invalid/generate',
    apiKey: 'hidden-test-key',
    clothImageUrl: 'https://example.com/mock-source.jpg',
    timeoutMs: 65000,
    retryTimes: 9
  })
  const { plan: samePlan } = buildPlan(input, {
    enableRealProviderCall: true,
    endpoint: 'https://provider.example.invalid/generate',
    apiKey: 'hidden-test-key',
    clothImageUrl: 'https://example.com/mock-source.jpg',
    timeoutMs: 65000,
    retryTimes: 9
  })

  assertCondition(plan.timeoutMs >= 60000, 'default timeout should match real generation window')
  assertCondition(plan.effectiveRetryTimes <= 1, 'retry must be bounded')
  assertCondition(plan.headers && plan.headers['X-Request-Id'], 'request idempotency header should exist')
  assertCondition(plan.headers['X-Request-Id'] === samePlan.headers['X-Request-Id'], 'same logical request should reuse request id')

  return {
    providerTaskType: plan.providerTaskType,
    errorCode: '',
    shouldRollbackQuota: false,
    shouldEnterPolling: false,
    providerAcceptedTask: false,
    hasQuotaRecordId: !!plan.quotaRecordId
  }
}))

rows.push(runCase('validation failure before submit rollback decision', () => {
  const error = buildProviderContractError(
    'PROVIDER_REQUEST_VALIDATION_FAILED',
    'provider request validation failed',
    {
      providerTaskType: 'image_edit_fabric_replace',
      costActionType: 'fabric_replace',
      providerReceivedRequest: false,
      providerAcceptedTask: false,
      shouldRollbackQuota: true
    }
  )

  assertCondition(error.ok === false, 'contract error should fail')
  assertCondition(error.providerReceivedRequest === false, 'provider should not receive request')
  assertCondition(error.providerAcceptedTask === false, 'provider task should not be accepted')
  assertCondition(error.shouldRollbackQuota === true, 'validation failure before submit should rollback')

  return {
    providerTaskType: error.providerTaskType,
    errorCode: error.errorCode,
    shouldRollbackQuota: error.shouldRollbackQuota,
    shouldEnterPolling: error.shouldEnterPolling,
    providerAcceptedTask: error.providerAcceptedTask
  }
}))

const summary = {
  total: rows.length,
  passed: rows.filter((row) => row.ok).length,
  failed: rows.filter((row) => !row.ok).length,
  rows
}

console.log('[provider-contract-smoke:summary]')
console.log(JSON.stringify(summary, null, 2))

if (summary.failed > 0) {
  process.exitCode = 1
}
