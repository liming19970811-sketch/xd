const IDENTITY_REPLACE_ACTIONS = new Set(['head_replace', 'face_replace'])

function normalizeAction(value = '') {
  return String(value || '').trim().toLowerCase()
}

function isIdentityReplaceAction(value = '') {
  return IDENTITY_REPLACE_ACTIONS.has(normalizeAction(value))
}

function getIdentityReferenceImage(params = {}, actionType = '') {
  const isFaceReplace = normalizeAction(actionType) === 'face_replace'
  return String(
    params.identityReferenceImage ||
    params.identity_reference_image ||
    (isFaceReplace
      ? params.faceReferenceImage || params.faceReferenceUrl
      : params.headReferenceImage || params.headReferenceUrl) ||
    params.targetPersonImage ||
    params.target_person_image ||
    ''
  ).trim()
}

function getIdentityProviderCapabilities(modelName = '') {
  const value = String(modelName || '').trim().toLowerCase()
  const qwenImageEditor = /^qwen-image-(2\.0|edit)/.test(value)
  return {
    modelName: value,
    supportsIdentityReference: false,
    supportsMultipleImages: qwenImageEditor,
    supportsFaceSwap: false,
    supportsHeadReplace: false,
    supportsMaskEdit: false,
    maxReferenceImages: qwenImageEditor ? 2 : 0
  }
}

function supportsIdentityReference(modelName = '') {
  return getIdentityProviderCapabilities(modelName).supportsIdentityReference
}

function validateIdentityProviderCapabilities(modelName = '', actionType = '') {
  const normalizedAction = normalizeAction(actionType)
  const capability = getIdentityProviderCapabilities(modelName)
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
    message: ok ? '' : 'Current provider does not support high-consistency identity replacement'
  }
}

function validateIdentityReplaceParams(params = {}, baseImage = '', actionType = '') {
  const normalizedAction = normalizeAction(actionType)
  if (!isIdentityReplaceAction(normalizedAction)) {
    return { ok: false, errorCode: 'IDENTITY_REPLACE_ACTION_INVALID', message: 'Identity replacement action is invalid' }
  }
  const normalizedBaseImage = String(params.baseImage || params.sourceImage || baseImage || '').trim()
  const referenceImage = getIdentityReferenceImage(params, normalizedAction)
  if (!normalizedBaseImage) {
    return { ok: false, errorCode: 'IDENTITY_BASE_IMAGE_REQUIRED', message: 'Base image is required' }
  }
  if (!referenceImage) {
    return { ok: false, errorCode: 'IDENTITY_REFERENCE_REQUIRED', message: 'Identity reference image is required' }
  }
  if (normalizedBaseImage === referenceImage) {
    return { ok: false, errorCode: 'SOURCE_TARGET_IMAGE_MUST_DIFFER', message: 'Base image and identity reference image must be different' }
  }
  return {
    ok: true,
    input: {
      actionType: normalizedAction,
      replaceMode: normalizedAction === 'face_replace' ? 'face_only' : 'full_head',
      baseImage: normalizedBaseImage,
      identityReferenceImage: referenceImage,
      referenceImage,
      preserveGarment: true,
      preserveBody: true,
      preservePose: true,
      preserveComposition: true,
      preserveBackground: true,
      preserveScene: true,
      identityStrength: 'high',
      sourceWidth: Number(params.sourceWidth || 0),
      sourceHeight: Number(params.sourceHeight || 0)
    }
  }
}

function buildIdentityReplacePrompt(input = {}) {
  const target = input.actionType === 'face_replace'
    ? '仅替换原图人物的脸部身份与必要的面部光影融合，不改变头型和发型。'
    : '仅替换原图人物的头部与面部身份，允许调整头发和必要的颈部衔接。'
  return [
    '执行双图局部身份替换。图一是必须保留的原始人物图，图二是目标头部或面部身份参考图。',
    target,
    '严格保留图一的服装、身体、坐姿或站姿、手臂、腿部、构图、背景、家具、光线和画面比例。',
    '不得生成白底或影棚白底，不得更换或简化场景，不得重新构图，不得重新设计服装，不得改变身体姿势。',
    '图二仅用于头部或脸部身份、五官和发型参考，不复制图二的服装、身体、姿势与背景。',
    '让替换后的头部尺度、视角、肤色、颈部衔接和光影与图一自然一致。'
  ].join('\n')
}

function buildIdentityOutputSize(input = {}) {
  return '1024*1536'
}

module.exports = {
  buildIdentityOutputSize,
  buildIdentityReplacePrompt,
  getIdentityReferenceImage,
  getIdentityProviderCapabilities,
  isIdentityReplaceAction,
  supportsIdentityReference,
  validateIdentityProviderCapabilities,
  validateIdentityReplaceParams
}
