const CLOUD_BASE_CONFIG = Object.freeze({
  enabled: true,
  env: 'cloudbase-d8ghr94wg306011e0',
  traceUser: true
})

export function getCloudBaseConfig() {
  return CLOUD_BASE_CONFIG
}

export function isCloudBaseEnabled() {
  return !!CLOUD_BASE_CONFIG.enabled
}

export function hasCloudBaseEnvId() {
  return !!String(CLOUD_BASE_CONFIG.env || '').trim()
}
