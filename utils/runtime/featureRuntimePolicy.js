export const APP_STAGES = Object.freeze({ PRODUCTION: 'production' })

export const CAPABILITY_STATUSES = Object.freeze({
  AVAILABLE: 'available',
  UNAVAILABLE: 'unavailable'
})

const BACKEND_CACHE_MS = 30 * 1000
const EMPTY_BACKEND_STATE = Object.freeze({
  loaded: false,
  loading: false,
  errorCode: '',
  provider: '',
  model: '',
  realProviderEnabled: false,
  realQuotaGuardEnabled: false,
  dryRun: true,
  hasEndpoint: false,
  hasApiKey: false,
  hasPollEndpoint: false,
  mockFallbackEnabled: true,
  switchMatrixAllowed: false,
  supportedTaskTypes: [],
  updatedAt: 0
})

let backendState = { ...EMPTY_BACKEND_STATE }
let backendRequest = null

function text(value = '') {
  return String(value || '').trim()
}

function canCallCloudFunction() {
  return typeof wx !== 'undefined' && wx && wx.cloud && typeof wx.cloud.callFunction === 'function'
}

function unwrapCloudResult(response = {}) {
  const result = response && Object.prototype.hasOwnProperty.call(response, 'result') ? response.result : response
  return (result && (result.debugConfig || result.data)) || result || {}
}

function normalizeBackendState(providerResponse = {}, quotaResponse = {}) {
  const provider = unwrapCloudResult(providerResponse)
  const quota = unwrapCloudResult(quotaResponse)
  return {
    loaded: true,
    loading: false,
    errorCode: '',
    provider: text(provider.provider),
    model: text(provider.model),
    realProviderEnabled: provider.realProviderEnabled === true || provider.enableRealProviderCall === true,
    realQuotaGuardEnabled: provider.realQuotaGuardEnabled === true || provider.enableRealQuotaGuard === true || quota.enableRealQuotaGuard === true,
    dryRun: provider.dryRun === true || provider.providerDryRun === true,
    hasEndpoint: provider.hasEndpoint === true,
    hasApiKey: provider.hasApiKey === true,
    hasPollEndpoint: provider.hasPollEndpoint === true,
    mockFallbackEnabled: provider.mockFallbackEnabled !== false,
    switchMatrixAllowed: provider.switchMatrixAllowed !== false,
    supportedTaskTypes: Array.isArray(provider.supportedTaskTypes)
      ? provider.supportedTaskTypes.map((item) => text(item).toLowerCase()).filter(Boolean)
      : [],
    updatedAt: Date.now()
  }
}

export function getAppStage() {
  return APP_STAGES.PRODUCTION
}

export function isProduction() {
  return true
}

export function getFeatureRuntimeBackendState() {
  return { ...backendState, supportedTaskTypes: [...backendState.supportedTaskTypes] }
}

export async function refreshFeatureRuntimeBackendState(options = {}) {
  const force = options.force === true
  if (!force && backendState.loaded && Date.now() - backendState.updatedAt < BACKEND_CACHE_MS) return getFeatureRuntimeBackendState()
  if (backendRequest) return backendRequest
  if (!canCallCloudFunction()) {
    backendState = { ...EMPTY_BACKEND_STATE, errorCode: 'CLOUD_FUNCTION_UNAVAILABLE', updatedAt: Date.now() }
    return getFeatureRuntimeBackendState()
  }
  backendState = { ...backendState, loading: true, errorCode: '' }
  backendRequest = Promise.all([
    wx.cloud.callFunction({ name: 'generate_wanx', data: { action: 'debugConfig' } }),
    wx.cloud.callFunction({ name: 'quota_guard', data: { action: 'debugConfig' } })
  ]).then(([providerResponse, quotaResponse]) => {
    backendState = normalizeBackendState(providerResponse, quotaResponse)
    return getFeatureRuntimeBackendState()
  }).catch((error) => {
    backendState = {
      ...EMPTY_BACKEND_STATE,
      errorCode: text(error && (error.code || error.errCode || error.message)) || 'RUNTIME_CONFIG_FAILED',
      updatedAt: Date.now()
    }
    return getFeatureRuntimeBackendState()
  }).finally(() => {
    backendRequest = null
  })
  return backendRequest
}

function taskTypeSupported(taskType = '', backend = backendState) {
  const normalized = text(taskType).toLowerCase()
  if (!normalized || !backend.loaded || !backend.supportedTaskTypes.length) return true
  return backend.supportedTaskTypes.includes(normalized)
}

export function resolveCapabilityStatus(providerSupported = false, configuredStatus = '') {
  return providerSupported || text(configuredStatus) === CAPABILITY_STATUSES.AVAILABLE
    ? CAPABILITY_STATUSES.AVAILABLE
    : CAPABILITY_STATUSES.UNAVAILABLE
}

export function getFeatureRuntimePolicy(options = {}) {
  const backend = getFeatureRuntimeBackendState()
  const featureEnabled = options.featureEnabled !== false
  const featureImplemented = options.featureImplemented !== false
  const providerRouteSupported = options.providerSupported === true || options.providerRouteSupported === true
  const inputReady = options.inputReady !== false
  const isSubmitting = options.isSubmitting === true
  const supportedTask = taskTypeSupported(options.taskType, backend)
  const backendReady = backend.loaded && backend.realProviderEnabled && backend.realQuotaGuardEnabled &&
    backend.hasEndpoint && backend.hasApiKey && !backend.dryRun &&
    backend.mockFallbackEnabled === false && backend.switchMatrixAllowed

  let disabledReason = ''
  if (isSubmitting) disabledReason = '正在提交，请勿重复点击'
  else if (!featureEnabled) disabledReason = '该功能尚未开放'
  else if (!featureImplemented) disabledReason = '该功能后端尚未接通'
  else if (!inputReady) disabledReason = text(options.inputDisabledReason) || '请先完成必填内容'
  else if (backend.loading) disabledReason = '正在确认正式 API 配置'
  else if (!backend.loaded && backend.errorCode === 'CLOUD_FUNCTION_UNAVAILABLE') disabledReason = '当前无法读取云端 API 配置'
  else if (!backend.loaded && backend.errorCode) disabledReason = '正式 API 配置读取失败，请稍后重试'
  else if (!backend.loaded) disabledReason = '尚未确认正式 API 配置'
  else if (!backend.realProviderEnabled) disabledReason = '真实 Provider 尚未开启'
  else if (!backend.hasEndpoint) disabledReason = '真实 API Endpoint 尚未配置'
  else if (!backend.hasApiKey) disabledReason = '真实 API Key 尚未配置'
  else if (backend.dryRun) disabledReason = 'Provider 仍处于 dry-run'
  else if (!backend.realQuotaGuardEnabled) disabledReason = '真实额度保护尚未开启'
  else if (backend.mockFallbackEnabled) disabledReason = 'mock fallback 尚未关闭'
  else if (!backend.switchMatrixAllowed) disabledReason = '正式生成安全开关未通过'
  else if (!supportedTask) disabledReason = '当前 taskType 没有真实 Provider 路由'
  else if (!providerRouteSupported) disabledReason = '当前 taskType 没有可用的真实 Provider 能力'

  const canSubmit = !disabledReason && backendReady && supportedTask && providerRouteSupported
  return {
    stage: APP_STAGES.PRODUCTION,
    isProduction: true,
    canAccessFeature: featureEnabled,
    featureAvailable: featureEnabled,
    canSelectExperimentalOption: featureEnabled,
    canSubmitRealTask: canSubmit,
    canSubmit,
    disabledReason,
    submitDisabledReason: disabledReason,
    capabilityStatus: providerRouteSupported ? CAPABILITY_STATUSES.AVAILABLE : CAPABILITY_STATUSES.UNAVAILABLE,
    providerSupported: providerRouteSupported,
    backend
  }
}

export function canAccessFeature(options = {}) {
  return getFeatureRuntimePolicy(options).canAccessFeature
}

export function canSubmitRealTask(options = {}) {
  return getFeatureRuntimePolicy(options).canSubmitRealTask
}

export function getDisabledReason(options = {}) {
  return getFeatureRuntimePolicy(options).disabledReason
}

export function getRuntimeGenerationConfig(options = {}) {
  const policy = getFeatureRuntimePolicy(options)
  return {
    ...policy,
    provider: text(options.provider || policy.backend.provider || options.modelName) || 'unknown',
    model: text(options.modelName || policy.backend.model || options.provider) || 'unknown',
    useRealProvider: policy.canSubmit,
    usesFormalQuota: true,
    usesMock: false,
    isExperimental: false,
    resultMode: 'formal'
  }
}

export function buildGenerationTaskMetadata(runtime = {}) {
  return {
    environment: APP_STAGES.PRODUCTION,
    provider: text(runtime.provider),
    capabilityStatus: CAPABILITY_STATUSES.AVAILABLE,
    isMock: false,
    isExperimental: false,
    resultMode: 'formal',
    deliveryEligible: true,
    usesFormalQuota: true,
    formalProviderRequest: true,
    mockFallbackEnabled: false
  }
}
