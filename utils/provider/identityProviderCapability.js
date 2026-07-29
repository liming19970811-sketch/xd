const CURRENT_IDENTITY_PROVIDER_MODEL = 'qwen-image-2.0-pro'

const CURRENT_IDENTITY_PROVIDER_CAPABILITY = Object.freeze({
  modelName: CURRENT_IDENTITY_PROVIDER_MODEL,
  supportsIdentityReference: false,
  supportsMultipleImages: true,
  supportsFaceSwap: false,
  supportsHeadReplace: false,
  supportsMaskEdit: false,
  maxReferenceImages: 2
})

const IDENTITY_REPLACE_ACTIONS = new Set(['head_replace', 'face_replace'])

export function isIdentityReplaceAction(value = '') {
  return IDENTITY_REPLACE_ACTIONS.has(String(value || '').trim().toLowerCase())
}

export function getIdentityProviderCapability() {
  return { ...CURRENT_IDENTITY_PROVIDER_CAPABILITY }
}

export function validateExperimentalIdentityProviderCapability(actionType = '') {
  const normalizedAction = String(actionType || '').trim().toLowerCase()
  if (!isIdentityReplaceAction(normalizedAction)) return { ok: true, capability: getIdentityProviderCapability() }
  const capability = getIdentityProviderCapability()
  const ok = capability.supportsMultipleImages && capability.maxReferenceImages >= 1
  return {
    ok,
    capability,
    errorCode: ok ? '' : 'PROVIDER_CAPABILITY_MISMATCH',
    message: ok ? '' : '当前 Provider 不支持人物原图与身份参考图的双图实验请求'
  }
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
    message: ok ? '' : '当前模型暂不支持高一致性人物替换'
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
