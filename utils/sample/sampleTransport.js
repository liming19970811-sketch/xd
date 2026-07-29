import { getCurrentSession } from '../auth/authSessionService.js'

function fail(status, errorCode, message) { return { ok: false, success: false, status, errorCode, message, data: null } }

export async function callSampleWorkflow(action = '', data = {}) {
  const session = getCurrentSession()
  if (!session || session.authSource !== 'cloud_authenticated' || !session.token) return fail('auth_required', 'CLOUD_ENTERPRISE_SESSION_REQUIRED', '请先使用企业云端身份登录。')
  if (typeof wx === 'undefined' || !wx.cloud || typeof wx.cloud.callFunction !== 'function') return fail('cloud_unavailable', 'CLOUD_UNAVAILABLE', '当前环境无法连接样衣服务。')
  try {
    const response = await wx.cloud.callFunction({ name: 'sample_workflow', data: { action, sessionToken: session.token, data } })
    return response && response.result && typeof response.result === 'object' ? response.result : fail('cloud_response_invalid', 'CLOUD_RESPONSE_INVALID', '样衣服务响应无效。')
  } catch (error) { return fail('cloud_call_failed', 'CLOUD_CALL_FAILED', '样衣服务暂时不可用，请稍后重试。') }
}
