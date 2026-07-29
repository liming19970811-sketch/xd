const CURRENT_IDENTITY_PROVIDER_MODEL = 'qwen-image-2.0-pro'

const CURRENT_IDENTITY_PROVIDER_CAPABILITY = Object.freeze({
  provider: 'wanx',
  modelName: CURRENT_IDENTITY_PROVIDER_MODEL,
  supportsIdentityReference: true,
  supportsMultipleImages: true,
  supportsFaceSwap: true,
  supportsHeadReplace: true,
  supportsMaskEdit: true,
  maxReferenceImages: 2
})

const IDENTITY_REPLACE_ACTIONS = new Set(['head_replace', 'face_replace'])

export function isIdentityReplaceAction(value = '') {
  return IDENTITY_REPLACE_ACTIONS.has(String(value || '').trim().toLowerCase())
}

export function getIdentityProviderCapability() {
  return { ...CURRENT_IDENTITY_PROVIDER_CAPABILITY }
}

export function validateIdentityProviderCapability(actionType = '') {
  const normalizedAction = String(actionType || '').trim().toLowerCase()
  if (!isIdentityReplaceAction(normalizedAction)) return { ok: true, capability: getIdentityProviderCapability() }

  const capability = getIdentityProviderCapability()
  const supportsRequestedMode = normalizedAction === 'face_replace'
    ? capability.supportsFaceSwap
    : capability.supportsHeadReplace
  const ok = capability.supportsIdentityReference &&
    capability.supportsMultipleImages &&
    capability.maxReferenceImages >= 1 &&
    supportsRequestedMode

  return {
    ok,
    capability,
    errorCode: ok ? '' : 'IDENTITY_PROVIDER_NOT_SUPPORTED',
    message: ok ? '' : '当前模型没有可用的人物替换真实路由'
  }
}

export function assertIdentityProviderCapability(actionType = '') {
  const validation = validateIdentityProviderCapability(actionType)
  if (validation.ok) return validation.capability
  const error = new Error(validation.message)
  error.code = validation.errorCode
  error.errorCode = validation.errorCode
  error.capability = validation.capability
  throw error
}
