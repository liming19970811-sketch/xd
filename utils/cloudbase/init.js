import { getCloudBaseConfig, hasCloudBaseEnvId, isCloudBaseEnabled } from './config'

let initialized = false

function hasWxCloud() {
  return typeof wx !== 'undefined' && wx && wx.cloud && typeof wx.cloud.init === 'function'
}

export function initCloudBase() {
  const enabled = isCloudBaseEnabled()
  const hasWx = hasWxCloud()

  console.log(`[cloudbase:init] init start enabled=${enabled} initialized=${initialized} wxCloudAvailable=${hasWx}`)
  if (!enabled || initialized || !hasWx) {
    console.log(`[cloudbase:init] init skipped enabled=${enabled} initialized=${initialized} wxCloudAvailable=${hasWx}`)
    return false
  }

  const config = getCloudBaseConfig()
  const envId = String(config.env || '').trim()
  console.log(`[cloudbase:init] envConfigured=${Boolean(envId)} envValid=${hasCloudBaseEnvId()}`)
  wx.cloud.init({
    env: envId || undefined,
    traceUser: config.traceUser !== false
  })
  initialized = true
  console.log('[cloudbase:init] init success')
  return true
}

export function isCloudBaseReady() {
  return initialized && hasWxCloud()
}
