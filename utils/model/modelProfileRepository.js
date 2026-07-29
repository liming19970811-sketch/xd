const FUNCTION_NAME = 'model_profile'

function canUseCloud() {
  return typeof wx !== 'undefined' && wx && wx.cloud && typeof wx.cloud.callFunction === 'function'
}

function normalizeResponse(response = {}) {
  const result = response && response.result ? response.result : response
  if (result && result.ok === true) return result
  return {
    ok: false,
    success: false,
    errorCode: String((result && result.errorCode) || 'MODEL_PROFILE_REQUEST_FAILED'),
    message: String((result && result.message) || '常用模特服务暂时不可用。'),
    data: null
  }
}

async function callModelProfile(action, data = {}) {
  if (!canUseCloud()) {
    return { ok: false, success: false, errorCode: 'CLOUD_UNAVAILABLE', message: '当前环境无法连接常用模特服务。', data: null }
  }
  try {
    return normalizeResponse(await wx.cloud.callFunction({ name: FUNCTION_NAME, data: { action, data } }))
  } catch (error) {
    return { ok: false, success: false, errorCode: String(error && (error.errCode || error.code) || 'CLOUD_CALL_FAILED'), message: '常用模特服务连接失败，请稍后重试。', data: null }
  }
}

export async function getModelProfiles(options = {}) {
  return callModelProfile('list', {
    scope: options.scope || 'personal',
    enterpriseId: options.enterpriseId || '',
    sessionToken: options.sessionToken || '',
    status: options.status || 'active',
    limit: Math.min(50, Math.max(1, Number(options.limit) || 30))
  })
}

export async function getModelProfile(modelProfileId, options = {}) {
  return callModelProfile('get', { modelProfileId, sessionToken: options.sessionToken || '' })
}

export async function saveModelProfile(profile = {}) {
  return callModelProfile('create', profile)
}

export async function updateModelProfile(modelProfileId, patch = {}) {
  return callModelProfile('update', { modelProfileId, ...patch })
}

export async function setDefaultModelProfile(modelProfileId) {
  return callModelProfile('set_default', { modelProfileId })
}

export async function archiveModelProfile(modelProfileId) {
  return callModelProfile('archive', { modelProfileId })
}

export async function deleteModelProfile(modelProfileId) {
  return callModelProfile('delete', { modelProfileId })
}

export async function resolveModelProfileForTask(modelProfileId) {
  return callModelProfile('resolve_for_task', { modelProfileId })
}

export const MODEL_PROFILE_CONSENT_TEXT = '我确认拥有该人物图片的使用授权，并同意将图片保存为我的常用模特，仅用于我主动发起的图片生成任务。'
export const MODEL_PROFILE_SELECTION_KEY = 'diebiandesign_selected_model_profile_v1'
