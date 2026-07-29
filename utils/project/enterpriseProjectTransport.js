import { getCurrentSession } from '../auth/authSessionService.js'
import { callCloudWebFunction, ensureCloudWebAuth } from '../cloud/cloudWebClient.js'

function isH5Platform() {
  // #ifdef H5
  return true
  // #endif
  return false
}

function canUseWxCloud() {
  return typeof wx !== 'undefined' && wx && wx.cloud && typeof wx.cloud.callFunction === 'function'
}

function fail(errorCode = 'cloud_call_failed', message = 'enterprise_project cloud function call failed') {
  return { success: false, ok: false, errorCode, message }
}

function normalizeCloudError(error = {}) {
  const code = String(error.code || error.errCode || error.errorCode || '')
  const message = String(error.message || error.errMsg || error.msg || code || 'enterprise_project cloud function call failed')
  const text = `${code} ${message}`.toLowerCase()
  if (text.includes('function not found') || text.includes('not exist')) return fail('function_not_found', message)
  if (text.includes('network')) return fail('cloud_network_error', message)
  return fail(code || 'cloud_call_failed', message)
}

function normalizeResponse(response = {}) {
  if (!response || typeof response !== 'object' || !('result' in response)) {
    return fail('cloud_response_invalid', 'enterprise_project cloud function response is invalid')
  }
  return response.result && typeof response.result === 'object'
    ? response.result
    : fail('cloud_response_invalid', 'enterprise_project cloud function result is invalid')
}

export async function callEnterpriseProject(action = '', data = {}) {
  const session = getCurrentSession()
  const sessionToken = session && session.token ? session.token : ''
  const payload = { action, sessionToken, data }

  if (isH5Platform()) {
    const authResult = await ensureCloudWebAuth()
    if (!authResult.ok) {
      return fail(authResult.errorCode || 'cloud_web_auth_required', authResult.message || 'CloudBase Web auth is required')
    }
    try {
      return normalizeResponse(await callCloudWebFunction('enterprise_project', payload))
    } catch (error) {
      return normalizeCloudError(error)
    }
  }

  if (!canUseWxCloud()) return fail('cloud_unavailable', '当前环境不可调用 enterprise_project 云函数')
  try {
    return normalizeResponse(await wx.cloud.callFunction({
      name: 'enterprise_project',
      data: payload
    }))
  } catch (error) {
    return normalizeCloudError(error)
  }
}
