import { callCloudWebFunction } from '../cloud/cloudWebClient.js'
import { getCurrentSession } from '../auth/authSessionService.js'

function createFailure(errorCode = 'cloud_call_failed', message = '企业 API 服务调用失败') {
  return { success: false, ok: false, errorCode, code: errorCode, message }
}

function normalizeResult(response = {}) {
  const result = response && response.result ? response.result : response
  if (!result || typeof result !== 'object') {
    return createFailure('cloud_response_invalid', '企业 API 服务响应格式错误')
  }
  return {
    ...result,
    ok: result.ok !== undefined ? result.ok : Boolean(result.success),
    code: result.code || result.errorCode || (result.success ? 'ok' : 'unknown_error')
  }
}

function normalizeCloudError(error = {}) {
  const text = `${error.code || ''} ${error.message || ''}`.toLowerCase()
  if (text.includes('not found') || text.includes('functionnotfound')) {
    return createFailure('function_not_found', 'enterprise_api 云函数未部署')
  }
  if (text.includes('network')) return createFailure('cloud_network_error', '网络异常，请稍后重试')
  return createFailure(error.code || error.errorCode || 'cloud_call_failed', error.message || '企业 API 服务调用失败')
}

export async function callDeveloperApi(action = '', data = {}) {
  const session = getCurrentSession()
  const sessionToken = session && session.token ? session.token : ''
  try {
    const startedAt = Date.now()
    const result = await callCloudWebFunction('enterprise_api', {
      action,
      sessionToken,
      ...data
    })
    const normalized = normalizeResult(result)
    if (process.env.NODE_ENV !== 'production') {
      console.info('[developer:api]', {
        action,
        success: Boolean(normalized.success),
        errorCode: normalized.errorCode || normalized.code || '',
        elapsedMs: Date.now() - startedAt
      })
    }
    return normalized
  } catch (error) {
    const normalized = normalizeCloudError(error)
    if (process.env.NODE_ENV !== 'production') {
      console.info('[developer:api]', {
        action,
        success: false,
        errorCode: normalized.errorCode,
        elapsedMs: 0
      })
    }
    return normalized
  }
}
