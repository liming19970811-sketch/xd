const CURRENT_GARMENT_PROVIDER_CAPABILITY = Object.freeze({
  provider: 'wanx',
  modelName: 'qwen-image-2.0-pro',
  supportsVirtualTryOn: true,
  supportsGarmentReference: true,
  supportsMultipleImages: true,
  supportsTopReplacement: true,
  supportsBottomReplacement: true,
  supportsOnePieceReplacement: true,
  supportsGarmentMask: true,
  maxReferenceImages: 2
})

const GARMENT_REPLACE_ACTIONS = new Set([
  'garment_replace',
  'clothes_replace',
  'outfit_replace',
  'virtual_try_on'
])

export function isGarmentReplaceAction(value = '') {
  return GARMENT_REPLACE_ACTIONS.has(String(value || '').trim().toLowerCase())
}

export function getGarmentProviderCapability() {
  return { ...CURRENT_GARMENT_PROVIDER_CAPABILITY }
}

export function validateGarmentProviderCapability(actionType = '', replaceMode = '') {
  if (!isGarmentReplaceAction(actionType)) {
    return { ok: true, capability: getGarmentProviderCapability(), errorCode: '', message: '' }
  }

  const capability = getGarmentProviderCapability()
  const normalizedMode = String(replaceMode || '').trim().toLowerCase()
  const modeSupported = normalizedMode === 'upper_only'
    ? capability.supportsTopReplacement
    : normalizedMode === 'lower_only'
      ? capability.supportsBottomReplacement
      : normalizedMode === 'full_outfit'
        ? capability.supportsOnePieceReplacement
        : capability.supportsTopReplacement && capability.supportsBottomReplacement
  const requiredReferences = normalizedMode === 'separate' ? 2 : 1
  const ok = capability.supportsVirtualTryOn &&
    capability.supportsGarmentReference &&
    capability.supportsMultipleImages &&
    capability.supportsGarmentMask &&
    capability.maxReferenceImages >= requiredReferences &&
    modeSupported

  return {
    ok,
    capability,
    errorCode: ok ? '' : 'GARMENT_PROVIDER_NOT_SUPPORTED',
    message: ok ? '' : '当前模型没有可用的换衣服真实路由'
  }
}

export function assertGarmentProviderCapability(actionType = '', replaceMode = '') {
  const validation = validateGarmentProviderCapability(actionType, replaceMode)
  if (validation.ok) return validation.capability
  const error = new Error(validation.message)
  error.code = validation.errorCode
  error.errorCode = validation.errorCode
  error.capability = validation.capability
  throw error
}
