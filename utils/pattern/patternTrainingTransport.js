import { getCurrentSession } from '../auth/authSessionService.js'
import { callCloudWebFunction, ensureCloudWebAuth } from '../cloud/cloudWebClient.js'

const FUNCTION_NAME = 'pattern_training'

function failure(status, errorCode, message) {
  return { ok: false, success: false, status, errorCode, message, data: null }
}

function isH5Platform() {
  // #ifdef H5
  return true
  // #endif
  return false
}

function canUseWxCloud() {
  return typeof wx !== 'undefined' && wx && wx.cloud && typeof wx.cloud.callFunction === 'function'
}

function normalizeResponse(response = {}) {
  if (!response || typeof response !== 'object' || !('result' in response)) {
    return failure('cloud_response_invalid', 'CLOUD_RESPONSE_INVALID', 'AI\u5236\u7248\u8bad\u7ec3\u6570\u636e\u670d\u52a1\u54cd\u5e94\u65e0\u6548\u3002')
  }
  return response.result && typeof response.result === 'object'
    ? response.result
    : failure('cloud_response_invalid', 'CLOUD_RESPONSE_INVALID', 'AI\u5236\u7248\u8bad\u7ec3\u6570\u636e\u670d\u52a1\u54cd\u5e94\u65e0\u6548\u3002')
}

function normalizeCloudError(error = {}) {
  const code = String(error.code || error.errCode || error.errorCode || 'CLOUD_CALL_FAILED')
  return failure('cloud_call_failed', code, 'AI\u5236\u7248\u8bad\u7ec3\u6570\u636e\u670d\u52a1\u6682\u65f6\u4e0d\u53ef\u7528\uff0c\u8bf7\u7a0d\u540e\u91cd\u8bd5\u3002')
}

export async function callPatternTraining(action = '', data = {}) {
  const session = getCurrentSession()
  if (!session || !session.token || session.authSource !== 'cloud_authenticated') {
    return failure('auth_required', 'CLOUD_ENTERPRISE_SESSION_REQUIRED', '\u8bf7\u5148\u4f7f\u7528\u4f01\u4e1a\u4e91\u7aef\u8eab\u4efd\u767b\u5f55\u3002')
  }

  const payload = { action, sessionToken: session.token, data }
  if (isH5Platform()) {
    const authResult = await ensureCloudWebAuth()
    if (!authResult.ok) {
      return failure('cloud_unavailable', authResult.errorCode || 'CLOUD_WEB_AUTH_REQUIRED', '\u5f53\u524d\u7f51\u9875\u65e0\u6cd5\u8fde\u63a5 AI \u5236\u7248\u8bad\u7ec3\u6570\u636e\u670d\u52a1\u3002')
    }
    try {
      return normalizeResponse(await callCloudWebFunction(FUNCTION_NAME, payload))
    } catch (error) {
      return normalizeCloudError(error)
    }
  }

  if (!canUseWxCloud()) {
    return failure('cloud_unavailable', 'CLOUD_UNAVAILABLE', '\u5f53\u524d\u73af\u5883\u65e0\u6cd5\u8fde\u63a5 AI \u5236\u7248\u8bad\u7ec3\u6570\u636e\u670d\u52a1\u3002')
  }
  try {
    return normalizeResponse(await wx.cloud.callFunction({ name: FUNCTION_NAME, data: payload }))
  } catch (error) {
    return normalizeCloudError(error)
  }
}
