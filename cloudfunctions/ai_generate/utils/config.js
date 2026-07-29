const DEFAULT_PROVIDER = 'real'
const DEFAULT_TIMEOUT_MS = 65000
const DEFAULT_RETRY_TIMES = 0
const DEFAULT_RETRY_BASE_DELAY_MS = 500
const DEFAULT_POLL_INTERVAL_MS = 2500
const DEFAULT_POLL_MAX_ATTEMPTS = 20
const DEFAULT_MODEL = 'flux.1-dev'
const DEFAULT_FABRIC_REPLACE_PROVIDER = 'real'
const DEFAULT_FABRIC_REPLACE_MODEL = 'wanx-image-edit'
const DEFAULT_FABRIC_REPLACE_TIMEOUT_MS = 65000
const MAX_SAFE_RETRY_TIMES = 1

function isExplicitTrue(value) {
  return String(value || '').trim().toLowerCase() === 'true'
}

function toPositiveInteger(value, fallback) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 0) {
    return fallback
  }
  return Math.floor(parsed)
}

function getAiProvider(env = process.env) {
  const provider = String((env && env.AI_PROVIDER) || DEFAULT_PROVIDER)
    .trim()
    .toLowerCase()

  if (provider === 'real') {
    return provider
  }

  return DEFAULT_PROVIDER
}

function getFabricReplaceProvider(env = process.env) {
  const provider = String((env && env.FABRIC_REPLACE_PROVIDER) || DEFAULT_FABRIC_REPLACE_PROVIDER)
    .trim()
    .toLowerCase()

  if (provider === 'real') {
    return provider
  }

  return DEFAULT_FABRIC_REPLACE_PROVIDER
}

function getAiConfig(env = process.env) {
  const provider = getAiProvider(env)
  const endpoint = String((env && env.AI_API_ENDPOINT) || '').trim()
  const apiKey = String((env && env.AI_API_KEY) || '').trim()
  const timeoutMs = toPositiveInteger(env && env.AI_REQUEST_TIMEOUT_MS, DEFAULT_TIMEOUT_MS)
  const retryTimes = toPositiveInteger(env && env.AI_RETRY_TIMES, DEFAULT_RETRY_TIMES)
  const effectiveRetryTimes = Math.min(retryTimes, MAX_SAFE_RETRY_TIMES)
  const retryBaseDelayMs = toPositiveInteger(env && env.AI_RETRY_BASE_DELAY_MS, DEFAULT_RETRY_BASE_DELAY_MS)
  const pollEndpoint = String((env && env.AI_POLL_ENDPOINT) || '').trim()
  const pollIntervalMs = toPositiveInteger(env && env.AI_POLL_INTERVAL_MS, DEFAULT_POLL_INTERVAL_MS)
  const pollMaxAttempts = toPositiveInteger(env && env.AI_POLL_MAX_ATTEMPTS, DEFAULT_POLL_MAX_ATTEMPTS)
  const model = String((env && env.AI_MODEL) || DEFAULT_MODEL).trim() || DEFAULT_MODEL
  const fabricReplaceProvider = getFabricReplaceProvider(env)
  const fabricReplaceEndpoint = String((env && env.FABRIC_REPLACE_ENDPOINT) || '').trim()
  const fabricReplaceApiKey = String((env && env.FABRIC_REPLACE_API_KEY) || '').trim()
  const fabricReplaceModel = String((env && env.FABRIC_REPLACE_MODEL) || DEFAULT_FABRIC_REPLACE_MODEL).trim() || DEFAULT_FABRIC_REPLACE_MODEL
  const fabricReplaceTimeoutMs = toPositiveInteger(
    env && env.FABRIC_REPLACE_TIMEOUT_MS,
    DEFAULT_FABRIC_REPLACE_TIMEOUT_MS
  )
  const enableRealProviderCall = !env || env.ENABLE_REAL_PROVIDER_CALL === undefined
    ? true
    : isExplicitTrue(env.ENABLE_REAL_PROVIDER_CALL)
  const disableMockFallback = true

  return {
    provider,
    enableRealProviderCall,
    disableMockFallback,
    endpoint,
    apiKey,
    hasEndpoint: !!endpoint,
    hasApiKey: !!apiKey,
    timeoutMs,
    retryTimes,
    effectiveRetryTimes,
    retryBaseDelayMs,
    pollEndpoint,
    hasPollEndpoint: !!pollEndpoint,
    pollIntervalMs,
    pollMaxAttempts,
    model,
    fabricReplace: {
      provider: fabricReplaceProvider,
      endpoint: fabricReplaceEndpoint,
      apiKey: fabricReplaceApiKey,
      hasEndpoint: !!fabricReplaceEndpoint,
      hasApiKey: !!fabricReplaceApiKey,
      model: fabricReplaceModel,
      timeoutMs: fabricReplaceTimeoutMs
    }
  }
}

function getAiConfigSummary(config = {}, action = '') {
  const fabricReplace = config.fabricReplace || {}
  return {
    provider: config.provider,
    enableRealProviderCall: !!config.enableRealProviderCall,
    mockFallbackEnabled: config.disableMockFallback !== true,
    hasEndpoint: !!config.endpoint,
    hasApiKey: !!config.apiKey,
    timeoutMs: config.timeoutMs,
    retryTimes: config.retryTimes,
    effectiveRetryTimes: config.effectiveRetryTimes,
    retryBaseDelayMs: config.retryBaseDelayMs,
    hasPollEndpoint: !!config.hasPollEndpoint,
    pollIntervalMs: config.pollIntervalMs,
    pollMaxAttempts: config.pollMaxAttempts,
    model: config.model,
    fabricReplaceProvider: fabricReplace.provider || DEFAULT_FABRIC_REPLACE_PROVIDER,
    hasFabricReplaceEndpoint: !!fabricReplace.hasEndpoint,
    hasFabricReplaceApiKey: !!fabricReplace.hasApiKey,
    fabricReplaceModel: fabricReplace.model || DEFAULT_FABRIC_REPLACE_MODEL,
    fabricReplaceTimeoutMs: fabricReplace.timeoutMs || DEFAULT_FABRIC_REPLACE_TIMEOUT_MS,
    action
  }
}

module.exports = {
  DEFAULT_FABRIC_REPLACE_MODEL,
  DEFAULT_FABRIC_REPLACE_PROVIDER,
  DEFAULT_FABRIC_REPLACE_TIMEOUT_MS,
  DEFAULT_MODEL,
  DEFAULT_POLL_INTERVAL_MS,
  DEFAULT_POLL_MAX_ATTEMPTS,
  MAX_SAFE_RETRY_TIMES,
  DEFAULT_RETRY_BASE_DELAY_MS,
  DEFAULT_RETRY_TIMES,
  DEFAULT_TIMEOUT_MS,
  DEFAULT_PROVIDER,
  isExplicitTrue,
  getAiConfig,
  getAiConfigSummary,
  getAiProvider,
  getFabricReplaceProvider
}
