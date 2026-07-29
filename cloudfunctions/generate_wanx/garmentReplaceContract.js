const GARMENT_REPLACE_ACTIONS = new Set(['garment_replace', 'clothes_replace', 'outfit_replace', 'virtual_try_on'])
const MODES = new Set(['upper_only', 'lower_only', 'separate', 'full_outfit'])
const ACCESSORY_TYPES = new Set(['shoes', 'bag', 'hat', 'belt', 'scarf', 'jewelry'])
const MAX_PROVIDER_INPUT_IMAGES = 3
const MAX_ACCESSORY_REFERENCES = 1

function getGarmentProviderCapabilities(modelName = '') {
  const value = text(modelName).toLowerCase()
  const supportsMultipleImages = /^qwen-image-(2\.0|edit)/.test(value)
  return {
    modelName: value,
    supportsVirtualTryOn: false,
    supportsGarmentReference: false,
    supportsMultipleImages,
    supportsTopReplacement: false,
    supportsBottomReplacement: false,
    supportsOnePieceReplacement: false,
    supportsGarmentMask: false,
    maxReferenceImages: supportsMultipleImages ? 2 : 0
  }
}

function validateGarmentProviderCapabilities(modelName = '', replaceMode = '') {
  const capability = getGarmentProviderCapabilities(modelName)
  const modeSupported = replaceMode === 'upper_only'
    ? capability.supportsTopReplacement
    : replaceMode === 'lower_only'
      ? capability.supportsBottomReplacement
      : replaceMode === 'full_outfit'
        ? capability.supportsOnePieceReplacement
        : capability.supportsTopReplacement && capability.supportsBottomReplacement
  const ok = capability.supportsVirtualTryOn &&
    capability.supportsGarmentReference &&
    capability.supportsMultipleImages &&
    capability.supportsGarmentMask &&
    modeSupported
  return {
    ok,
    capability,
    errorCode: ok ? '' : 'GARMENT_PROVIDER_NOT_SUPPORTED',
    message: ok ? '' : 'Current model does not support high-consistency virtual try-on'
  }
}

const ACCESSORY_LABELS = Object.freeze({
  shoes: 'shoes',
  bag: 'bag',
  hat: 'hat',
  belt: 'belt',
  scarf: 'scarf',
  jewelry: 'jewelry'
})

function text(value = '') {
  return String(value || '').trim()
}

function isGarmentReplaceAction(actionType = '') {
  return GARMENT_REPLACE_ACTIONS.has(text(actionType).toLowerCase())
}

function normalizeMode(value = '') {
  const mode = text(value).toLowerCase()
  if (MODES.has(mode)) return mode
  if (['upper', 'top'].includes(mode)) return 'upper_only'
  if (['lower', 'bottom'].includes(mode)) return 'lower_only'
  if (['both', 'upper_lower'].includes(mode)) return 'separate'
  if (['outfit', 'one_piece', 'dress'].includes(mode)) return 'full_outfit'
  return 'upper_only'
}

function normalizeGarmentParams(params = {}) {
  const mode = normalizeMode(params.replaceMode || params.garmentReplaceMode || params.mode)
  const legacy = text(params.garmentImage || params.garmentImageUrl || params.referenceImage || params.referenceImageUrl)
  const rawAccessories = Array.isArray(params.accessoryReferences)
    ? params.accessoryReferences
    : (Array.isArray(params.accessories) ? params.accessories : [])
  const accessoryReferences = rawAccessories.map((item = {}, index) => ({
    accessoryId: text(item.accessoryId || `accessory_reference_${index + 1}`),
    type: text(item.type || item.accessoryType).toLowerCase(),
    name: text(item.name),
    imageUrl: text(typeof item === 'string' ? item : (item.imageUrl || item.referenceImage || item.fileId || item.fileID || item.fileUrl || item.url))
  })).filter((item) => item.type || item.imageUrl)
  return {
    replaceMode: mode,
    personImage: text(params.personImage || params.personImageUrl || params.sourceImage || params.sourceImageUrl),
    upperGarment: text(params.upperGarment || params.upperGarmentUrl || (mode === 'upper_only' ? legacy : '')),
    lowerGarment: text(params.lowerGarment || params.lowerGarmentUrl || (mode === 'lower_only' ? legacy : '')),
    outfitGarment: text(params.outfitGarment || params.outfitGarmentUrl || (mode === 'full_outfit' ? legacy : '')),
    accessoryReferences,
    preserveIdentity: params.preserveIdentity !== false,
    preservePerson: params.preservePerson !== false,
    preserveFace: params.preserveFace !== false,
    preserveHair: params.preserveHair !== false,
    preserveBody: params.preserveBody !== false,
    preservePose: params.preservePose !== false,
    preserveBackground: params.preserveBackground !== false,
    preserveScene: params.preserveScene !== false,
    preserveComposition: params.preserveComposition !== false,
    preserveGarmentColor: params.preserveGarmentColor !== false,
    preserveGarmentPattern: params.preserveGarmentPattern !== false,
    preserveGarmentDetails: params.preserveGarmentDetails !== false,
    preserveUnchangedGarment: params.preserveUnchangedGarment !== false
  }
}

function validateGarmentParams(params = {}, fallbackPersonImage = '') {
  const input = normalizeGarmentParams(params)
  input.personImage = input.personImage || text(fallbackPersonImage)
  if (!input.personImage) return { ok: false, errorCode: 'GARMENT_PERSON_IMAGE_REQUIRED', message: 'Person image is required', input }
  const required = input.replaceMode === 'upper_only'
    ? ['upperGarment']
    : input.replaceMode === 'lower_only'
      ? ['lowerGarment']
      : input.replaceMode === 'separate'
        ? ['upperGarment', 'lowerGarment']
        : ['outfitGarment']
  if (required.some((key) => !input[key])) {
    return { ok: false, errorCode: 'GARMENT_REFERENCE_REQUIRED', message: 'Required garment reference image is missing', input }
  }
  if (required.some((key) => input[key] === input.personImage)) {
    return { ok: false, errorCode: 'GARMENT_REFERENCE_MUST_DIFFER', message: 'Person and garment images must be different', input }
  }
  if (input.replaceMode === 'separate' && input.upperGarment === input.lowerGarment) {
    return { ok: false, errorCode: 'GARMENT_REFERENCES_MUST_DIFFER', message: 'Upper and lower garment images must be different', input }
  }
  if (input.accessoryReferences.length > MAX_ACCESSORY_REFERENCES) {
    return { ok: false, errorCode: 'GARMENT_ACCESSORY_LIMIT_EXCEEDED', message: 'Only one accessory reference is supported per task', input }
  }
  if (input.accessoryReferences.some((item) => !ACCESSORY_TYPES.has(item.type))) {
    return { ok: false, errorCode: 'GARMENT_ACCESSORY_TYPE_INVALID', message: 'Accessory type is not supported', input }
  }
  if (input.accessoryReferences.some((item) => !item.imageUrl)) {
    return { ok: false, errorCode: 'GARMENT_ACCESSORY_IMAGE_REQUIRED', message: 'Accessory reference image is required', input }
  }
  const garmentReferences = required.map((key) => input[key])
  const accessoryImages = input.accessoryReferences.map((item) => item.imageUrl)
  const allReferences = [...garmentReferences, ...accessoryImages]
  if (new Set([input.personImage, ...allReferences]).size !== allReferences.length + 1) {
    return { ok: false, errorCode: 'GARMENT_ACCESSORY_REFERENCE_MUST_DIFFER', message: 'Person, garment and accessory images must be different', input }
  }
  if (allReferences.length + 1 > MAX_PROVIDER_INPUT_IMAGES) {
    return { ok: false, errorCode: 'GARMENT_REFERENCE_LIMIT_EXCEEDED', message: 'Current model supports at most three input images', input }
  }
  return { ok: true, errorCode: '', message: '', input, required }
}

function buildGarmentPrompt(input = {}, prompt = '') {
  const instructions = {
    upper_only: 'Use Image 2 as the upper-garment reference. Replace only the upper garment and preserve the original lower garment.',
    lower_only: 'Use Image 2 as the lower-garment reference. Replace only the lower garment and preserve the original upper garment.',
    separate: 'Use Image 2 as the upper-garment reference and Image 3 as the lower-garment reference. Replace the two regions independently.',
    full_outfit: 'Use Image 2 as one complete outfit or one-piece garment reference. Replace the full outfit as a single design.'
  }
  const garmentImageCount = input.replaceMode === 'separate' ? 2 : 1
  const accessoryInstructions = (input.accessoryReferences || []).map((item, index) => {
    const imageNumber = 2 + garmentImageCount + index
    const label = ACCESSORY_LABELS[item.type] || 'accessory'
    return `Use Image ${imageNumber} only as the ${label} accessory reference. Add that accessory naturally to the person without replacing unrelated garments or accessories.`
  })
  return [
    'Image 1 is the base person photo. Perform a realistic virtual garment replacement.',
    instructions[input.replaceMode],
    input.preservePerson ? 'Preserve the person identity, face, body proportions and visible skin.' : '',
    input.preservePose ? 'Preserve the original body pose and camera composition.' : '',
    input.preserveBackground ? 'Preserve the original background and lighting environment.' : '',
    input.preserveUnchangedGarment ? 'Keep every garment region that was not selected for replacement unchanged.' : '',
    ...accessoryInstructions,
    'Match garment structure, color, pattern, material and details from each reference. Fit naturally with correct occlusion, folds, perspective, shadows and lighting.',
    'Do not copy people, faces, hands, backgrounds or unrelated objects from garment or accessory reference images.',
    text(prompt)
  ].filter(Boolean).join('\n')
}

module.exports = {
  buildGarmentPrompt,
  getGarmentProviderCapabilities,
  isGarmentReplaceAction,
  normalizeGarmentParams,
  validateGarmentParams,
  validateGarmentProviderCapabilities
}
