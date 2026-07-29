import {
  callCloudWebFunction,
  ensureCloudWebAuth,
  getCloudWebClientStatus
} from '../cloud/cloudWebClient.js'

function isH5Platform() {
  // #ifdef H5
  return true
  // #endif
  return false
}

function canUseWxCloud() {
  return typeof wx !== 'undefined' && wx && wx.cloud && typeof wx.cloud.callFunction === 'function'
}

function normalizeError(errorCode = 'cloud_call_failed', message = 'enterprise_auth cloud function call failed') {
  return {
    success: false,
    ok: false,
    errorCode,
    message
  }
}

function normalizeCloudError(error = {}) {
  const code = String(error.code || error.errCode || error.errorCode || '')
  const message = String(error.message || error.errMsg || error.msg || code || 'enterprise_auth cloud function call failed')
  const text = `${code} ${message}`.toLowerCase()
  if (code === 'cloudbase_env_not_configured' || code === 'cloudbase_web_sdk_unavailable' || code === 'cloudbase_web_sdk_load_failed') {
    return normalizeError('cloud_sdk_not_ready', message)
  }
  if (code === 'CLOUD_ANONYMOUS_AUTH_DISABLED' || code === 'CLOUD_ANONYMOUS_AUTH_FAILED') {
    return normalizeError('cloud_web_auth_required', message)
  }
  if (text.includes('function not found') || text.includes('function_not_found') || text.includes('not exist')) {
    return normalizeError('function_not_found', message)
  }
  return normalizeError('cloud_call_failed', message)
}

function normalizeResponse(response = {}) {
  if (!response || typeof response !== 'object' || !('result' in response)) {
    return normalizeError('cloud_response_invalid', 'enterprise_auth cloud function response is invalid')
  }
  return response.result && typeof response.result === 'object'
    ? response.result
    : normalizeError('cloud_response_invalid', 'enterprise_auth cloud function result is invalid')
}

export async function getEnterpriseAuthTransportStatus() {
  if (isH5Platform()) {
    return {
      platform: 'h5',
      ...getCloudWebClientStatus()
    }
  }
  return {
    platform: 'mp-weixin',
    initialized: canUseWxCloud(),
    authenticated: canUseWxCloud(),
    authType: canUseWxCloud() ? 'wx_cloud' : 'none',
    hasCallFunction: canUseWxCloud(),
    errorCode: canUseWxCloud() ? '' : 'cloud_unavailable',
    errorMessage: canUseWxCloud() ? '' : 'wx.cloud.callFunction is unavailable'
  }
}

export async function ensureEnterpriseAuthTransportReady() {
  if (isH5Platform()) {
    const authResult = await ensureCloudWebAuth()
    const status = await getEnterpriseAuthTransportStatus()
    return {
      ...status,
      ready: !!authResult.ok,
      errorCode: authResult.ok ? (status.errorCode || '') : (authResult.errorCode || 'cloud_web_auth_required'),
      errorMessage: authResult.ok ? (status.errorMessage || '') : (authResult.message || 'CloudBase Web auth is required')
    }
  }
  const status = await getEnterpriseAuthTransportStatus()
  return {
    ...status,
    ready: !!status.hasCallFunction
  }
}

export async function callEnterpriseAuth(action = '', data = {}) {
  if (isH5Platform()) {
    const authResult = await ensureCloudWebAuth()
    if (!authResult.ok) {
      return normalizeError('cloud_web_auth_required', authResult.message || 'CloudBase Web auth is required')
    }
    try {
      const response = await callCloudWebFunction('enterprise_auth', { action, ...data })
      return normalizeResponse(response)
    } catch (error) {
      return normalizeCloudError(error)
    }
  }

  if (!canUseWxCloud()) {
    return normalizeError('cloud_unavailable', '当前环境不可调用 enterprise_auth 云函数')
  }
  try {
    const response = await wx.cloud.callFunction({
      name: 'enterprise_auth',
      data: { action, ...data }
    })
    return normalizeResponse(response)
  } catch (error) {
    return normalizeCloudError(error)
  }
}
