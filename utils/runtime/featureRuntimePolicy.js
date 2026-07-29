export const APP_STAGES = Object.freeze({
  DEVELOPMENT: 'development',
  TESTING: 'testing',
  PRODUCTION: 'production'
})

export const CAPABILITY_STATUSES = Object.freeze({
  AVAILABLE: 'available',
  EXPERIMENTAL: 'experimental',
  MOCK_ONLY: 'mock_only',
  UNAVAILABLE: 'unavailable'
})

export const TEST_EXECUTION_MODES = Object.freeze({
  FLOW_MOCK: 'flow_mock',
  MODEL_EXPERIMENT: 'model_experiment'
})

const RUNTIME_STORAGE_KEY = 'diebiandesign_internal_runtime_config_v1'
const BACKEND_CACHE_MS = 30 * 1000

const EMPTY_BACKEND_STATE = Object.freeze({
  loaded: false,
  loading: false,
  errorCode: '',
  provider: '',
  model: '',
  realProviderEnabled: false,
  realQuotaGuardEnabled: false,
  dryRun: false,
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

function envValue(name = '') {
  try {
    return typeof process !== 'undefined' && process && process.env ? text(process.env[name]) : ''
  } catch (error) {
    return ''
  }
}

function booleanEnv(name = '', fallback = false) {
  const value = envValue(name).toLowerCase()
  if (!value) return fallback
  return ['1', 'true', 'yes', 'on'].includes(value)
}

function miniProgramEnvVersion() {
  try {
    if (typeof wx === 'undefined' || !wx || typeof wx.getAccountInfoSync !== 'function') return ''
    const account = wx.getAccountInfoSync() || {}
    return text((account.miniProgram || {}).envVersion).toLowerCase()
  } catch (error) {
    return ''
  }
}

function normalizeStage(value = '') {
  const normalized = text(value).toLowerCase()
  return Object.values(APP_STAGES).includes(normalized) ? normalized : ''
}

function readInternalConfig() {
  try {
    if (typeof uni === 'undefined' || !uni || typeof uni.getStorageSync !== 'function') return {}
    const value = uni.getStorageSync(RUNTIME_STORAGE_KEY)
    return value && typeof value === 'object' ? { ...value } : {}
  } catch (error) {
    return {}
  }
}

function readCurrentUser() {
  try {
    if (typeof uni === 'undefined' || !uni || typeof uni.getStorageSync !== 'function') return {}
    const user = uni.getStorageSync('diebiandesign_current_user')
    return user && typeof user === 'object' ? user : {}
  } catch (error) {
    return {}
  }
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
  const realQuotaGuardEnabled = provider.realQuotaGuardEnabled === true || provider.enableRealQuotaGuard === true || quota.enableRealQuotaGuard === true
  return {
    loaded: true,
    loading: false,
    errorCode: '',
    provider: text(provider.provider),
    model: text(provider.model),
    realProviderEnabled: provider.realProviderEnabled === true || provider.enableRealProviderCall === true,
    realQuotaGuardEnabled,
    dryRun: provider.dryRun === true || provider.providerDryRun === true,
    hasEndpoint: provider.hasEndpoint === true,
    hasApiKey: provider.hasApiKey === true,
    hasPollEndpoint: provider.hasPollEndpoint === true,
    mockFallbackEnabled: provider.mockFallbackEnabled !== false,
    switchMatrixAllowed: provider.switchMatrixAllowed !== false,
    supportedTaskTypes: Array.isArray(provider.supportedTaskTypes) ? provider.supportedTaskTypes.map((item) => text(item)).filter(Boolean) : [],
    updatedAt: Date.now()
  }
}

export function getAppStage() {
  const configured = normalizeStage(envValue('VUE_APP_APP_STAGE') || envValue('APP_STAGE'))
  if (configured) return configured
  const envVersion = miniProgramEnvVersion()
  if (envVersion === 'release') return APP_STAGES.PRODUCTION
  if (envVersion === 'trial') return APP_STAGES.TESTING
  if (envVersion === 'develop') return APP_STAGES.DEVELOPMENT
  return envValue('NODE_ENV') === 'production' ? APP_STAGES.PRODUCTION : APP_STAGES.DEVELOPMENT
}

export function isDevelopment() {
  return getAppStage() === APP_STAGES.DEVELOPMENT
}

export function isTesting() {
  return getAppStage() === APP_STAGES.TESTING
}

export function isProduction() {
  return getAppStage() === APP_STAGES.PRODUCTION
}

export function isInternalTestAccount(user = readCurrentUser()) {
  if (isProduction()) return false
  const userId = text(user.userId || user.id).toLowerCase()
  const role = text(user.role || user.memberRole).toLowerCase()
  return /^(user_demo_|test_|internal_|dev_)/.test(userId) || ['admin', 'super_admin', 'platform_admin', 'developer', 'tester', 'internal_tester', 'internaltester', 'tech', 'ops', 'algorithm'].includes(role)
}

export function isInternalTester(user = readCurrentUser()) {
  return isInternalTestAccount(user)
}

export function isInternalDebugMode(user = readCurrentUser()) {
  return (isDevelopment() || isTesting()) && isInternalTestAccount(user)
}

export function getFeatureRuntimeBackendState() {
  return {
    ...backendState,
    supportedTaskTypes: [...backendState.supportedTaskTypes]
  }
}

export async function refreshFeatureRuntimeBackendState(options = {}) {
  if (isProduction()) return getFeatureRuntimeBackendState()
  const force = options.force === true
  if (!force && backendState.loaded && Date.now() - backendState.updatedAt < BACKEND_CACHE_MS) return getFeatureRuntimeBackendState()
  if (backendRequest) return backendRequest
  if (!canCallCloudFunction()) {
    backendState = { ...backendState, loaded: false, loading: false, errorCode: 'CLOUD_FUNCTION_UNAVAILABLE' }
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
      errorCode: text(error && (error.code || error.errCode || error.message)) || 'RUNTIME_DEBUG_CONFIG_FAILED',
      updatedAt: Date.now()
    }
    return getFeatureRuntimeBackendState()
  }).finally(() => {
    backendRequest = null
  })
  return backendRequest
}

export function resolveCapabilityStatus(providerSupported = false, configuredStatus = '') {
  const requested = text(configuredStatus).toLowerCase()
  if (isProduction()) {
    if (requested === CAPABILITY_STATUSES.EXPERIMENTAL) return CAPABILITY_STATUSES.EXPERIMENTAL
    return providerSupported ? CAPABILITY_STATUSES.AVAILABLE : CAPABILITY_STATUSES.UNAVAILABLE
  }
  if (providerSupported || requested === CAPABILITY_STATUSES.EXPERIMENTAL) return CAPABILITY_STATUSES.EXPERIMENTAL
  return CAPABILITY_STATUSES.MOCK_ONLY
}

function taskTypeSupported(taskType = '', backend = backendState) {
  const normalized = text(taskType).toLowerCase()
  if (!normalized || !backend.loaded || !backend.supportedTaskTypes.length) return true
  return backend.supportedTaskTypes.some((item) => text(item).toLowerCase() === normalized)
}

export function getFeatureRuntimePolicy(options = {}) {
  const stage = getAppStage()
  const internalTester = isInternalTestAccount(options.user)
  const internalDebug = stage !== APP_STAGES.PRODUCTION && internalTester
  const providerSupported = options.providerSupported === true
  const experimentalProviderSupported = options.experimentalProviderSupported === true
  const capabilityStatus = resolveCapabilityStatus(
    providerSupported,
    options.capabilityStatus || (experimentalProviderSupported ? CAPABILITY_STATUSES.EXPERIMENTAL : '')
  )
  const backend = getFeatureRuntimeBackendState()
  const backendProviderReady = backend.realProviderEnabled && backend.hasEndpoint && backend.hasApiKey && !backend.dryRun
  const backendSafetyReady = backend.realQuotaGuardEnabled && backend.mockFallbackEnabled === false && backend.switchMatrixAllowed
  const backendKnownReady = backend.loaded && backendProviderReady && backendSafetyReady
  const providerCapabilityReady = providerSupported || experimentalProviderSupported
  const supportedTask = taskTypeSupported(options.taskType, backend)
  const featureEnabled = options.featureEnabled !== false
  const featureImplemented = options.featureImplemented !== false
  const inputReady = options.inputReady !== false
  const isSubmitting = options.isSubmitting === true
  const canAccess = internalDebug || featureEnabled
  const canSelectExperimental = internalDebug || (featureEnabled && capabilityStatus === CAPABILITY_STATUSES.AVAILABLE)
  const realApiDebug = internalDebug && providerCapabilityReady && supportedTask && backendKnownReady
  const productionSubmit = stage === APP_STAGES.PRODUCTION && featureEnabled && featureImplemented && capabilityStatus === CAPABILITY_STATUSES.AVAILABLE
  const realTaskSubmit = realApiDebug && featureImplemented && inputReady && !isSubmitting
  const canSubmit = productionSubmit || realTaskSubmit

  let disabledReason = ''
  if (isSubmitting) disabledReason = '正在提交，请勿重复点击'
  else if (!canAccess) disabledReason = '该功能尚未对当前用户开放'
  else if (!featureImplemented) disabledReason = '后端尚未实现'
  else if (!inputReady) disabledReason = text(options.inputDisabledReason) || '请先完成必填内容'
  else if (internalDebug && backend.loading) disabledReason = '正在确认真实 API 配置'
  else if (internalDebug && !backend.loaded && backend.errorCode === 'CLOUD_FUNCTION_UNAVAILABLE') disabledReason = '当前无法读取云端真实 API 配置'
  else if (internalDebug && !backend.loaded && backend.errorCode) disabledReason = '真实 API 配置读取失败，请稍后重试'
  else if (internalDebug && !backend.loaded) disabledReason = '尚未确认真实 API 配置'
  else if (internalDebug && backend.loaded && !backend.realProviderEnabled) disabledReason = '真实 Provider 尚未开启'
  else if (internalDebug && backend.loaded && !backend.hasEndpoint) disabledReason = '真实 API Endpoint 尚未配置'
  else if (internalDebug && backend.loaded && !backend.hasApiKey) disabledReason = '真实 API Key 尚未配置'
  else if (internalDebug && backend.loaded && backend.dryRun) disabledReason = 'Provider 当前仍为 dry-run'
  else if (internalDebug && backend.loaded && !backend.realQuotaGuardEnabled) disabledReason = '真实额度保护尚未开启'
  else if (internalDebug && backend.loaded && backend.mockFallbackEnabled) disabledReason = 'mock fallback 尚未关闭'
  else if (!supportedTask) disabledReason = '当前 Provider 未声明支持该任务类型'
  else if (!providerCapabilityReady) disabledReason = internalDebug ? '当前选项可调试，但 Provider 能力尚未接入' : '当前能力尚未开放'

  return {
    stage,
    isDevelopment: stage === APP_STAGES.DEVELOPMENT,
    isTesting: stage === APP_STAGES.TESTING,
    isProduction: stage === APP_STAGES.PRODUCTION,
    isInternalTester: internalTester,
    isInternalDebug: internalDebug,
    isRealApiDebug: realApiDebug,
    canAccessFeature: canAccess,
    canSelectExperimentalOption: canSelectExperimental,
    canSubmitRealTask: realTaskSubmit,
    allowExperimentalProvider: canSelectExperimental,
    allowRealProviderTest: realTaskSubmit,
    featureAvailable: canAccess,
    canSubmit,
    disabledReason,
    submitDisabledReason: disabledReason,
    capabilityStatus,
    providerSupported,
    experimentalProviderSupported,
    backend
  }
}

export function canAccessFeature(options = {}) {
  return getFeatureRuntimePolicy(options).canAccessFeature
}

export function canSelectExperimentalOption(options = {}) {
  return getFeatureRuntimePolicy(options).canSelectExperimentalOption
}

export function canSubmitRealTask(options = {}) {
  return getFeatureRuntimePolicy(options).canSubmitRealTask
}

export function getDisabledReason(options = {}) {
  return getFeatureRuntimePolicy(options).disabledReason
}

export function getRuntimeGenerationConfig(options = {}) {
  const internal = readInternalConfig()
  const policy = getFeatureRuntimePolicy(options)
  const isTestStage = !policy.isProduction
  const flowTestEnabled = policy.isInternalDebug && internal.flowTestEnabled === true
  const experimentFlag = internal.modelEffectTestEnabled !== false ||
    booleanEnv('VUE_APP_ENABLE_REAL_PROVIDER_TEST', false) ||
    booleanEnv('VUE_APP_ENABLE_MODEL_EFFECT_TEST', false)
  const modelEffectTestEnabled = policy.isInternalDebug && experimentFlag && options.experimentalProviderSupported === true
  const preferredMode = text(internal.executionMode)
  const executionMode = preferredMode === TEST_EXECUTION_MODES.FLOW_MOCK && flowTestEnabled && !policy.isRealApiDebug
    ? TEST_EXECUTION_MODES.FLOW_MOCK
    : TEST_EXECUTION_MODES.MODEL_EXPERIMENT
  const realProviderTest = isTestStage && executionMode === TEST_EXECUTION_MODES.MODEL_EXPERIMENT && policy.isRealApiDebug
  const usesMock = isTestStage && executionMode === TEST_EXECUTION_MODES.FLOW_MOCK && flowTestEnabled

  return {
    ...policy,
    isTestStage,
    provider: text(options.provider || policy.backend.provider || options.modelName) || 'unknown',
    model: text(options.modelName || policy.backend.model || options.provider) || 'unknown',
    flowTestEnabled,
    modelEffectTestEnabled,
    executionMode,
    canSubmit: policy.isProduction
      ? policy.canSubmit
      : (realProviderTest ? policy.canSubmitRealTask : usesMock),
    usesMock,
    isExperimental: realProviderTest,
    usesFormalQuota: policy.isProduction || realProviderTest,
    realProviderTest,
    canManageTesting: policy.isInternalTester
  }
}

export function setInternalRuntimeConfig(patch = {}) {
  if (!isInternalTestAccount()) return { ok: false, errorCode: 'INTERNAL_TEST_ACCOUNT_REQUIRED' }
  const previous = readInternalConfig()
  const next = {
    ...previous,
    ...(typeof patch.flowTestEnabled === 'boolean' ? { flowTestEnabled: patch.flowTestEnabled } : {}),
    ...(typeof patch.modelEffectTestEnabled === 'boolean' ? { modelEffectTestEnabled: patch.modelEffectTestEnabled } : {}),
    ...(Object.values(TEST_EXECUTION_MODES).includes(patch.executionMode) ? { executionMode: patch.executionMode } : {}),
    updatedAt: new Date().toISOString()
  }
  try {
    uni.setStorageSync(RUNTIME_STORAGE_KEY, next)
    return { ok: true, config: next }
  } catch (error) {
    return { ok: false, errorCode: 'RUNTIME_CONFIG_SAVE_FAILED' }
  }
}

export function buildTestTaskMetadata(runtime = {}) {
  const user = readCurrentUser()
  return {
    environment: runtime.stage || getAppStage(),
    provider: runtime.usesMock ? 'mock_flow' : text(runtime.provider),
    capabilityStatus: runtime.capabilityStatus || CAPABILITY_STATUSES.UNAVAILABLE,
    isMock: runtime.usesMock === true,
    isExperimental: runtime.isExperimental === true,
    resultMode: runtime.realProviderTest ? 'real_provider_test' : (runtime.usesMock ? 'flow_mock' : 'formal'),
    realProviderTest: runtime.realProviderTest === true,
    testAccountId: runtime.isTestStage ? text(user.userId || user.id) : '',
    testResultType: runtime.usesMock ? 'flow_test' : runtime.isExperimental ? 'experimental' : 'formal',
    deliveryEligible: !runtime.isTestStage,
    usesFormalQuota: runtime.usesFormalQuota === true
  }
}
