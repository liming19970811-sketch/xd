export const PATTERN_STRUCTURE_ACTION = 'pattern_structure_generate'

export const PATTERN_INPUT_MODES = Object.freeze(['garment_photo', 'design_render', 'structure_sketch'])
export const PATTERN_CATEGORIES = Object.freeze(['tshirt', 'shirt', 'dress', 'skirt', 'pants', 'coat'])
export const PATTERN_VISUAL_OUTPUTS = Object.freeze(['front_technical', 'back_technical', 'pattern_pieces'])

export function getPatternImageValue(value = '') {
  if (typeof value === 'string') return value.trim()
  if (!value || typeof value !== 'object') return ''
  return String(value.fileId || value.fileID || value.fileUrl || value.imageUrl || value.url || '').trim()
}

export function isStablePatternImage(value = '') {
  return /^(cloud:\/\/|https:\/\/)/i.test(getPatternImageValue(value))
}

export function isPatternStructureTask(task = {}) {
  const input = task.input || {}
  const params = input.params || task.params || {}
  return [task.type, task.taskType, params.actionType, params.taskType]
    .some((value) => String(value || '').trim().toLowerCase() === PATTERN_STRUCTURE_ACTION)
}

export function normalizePatternStructureInput(source = {}) {
  const input = source.input || source
  const assets = input.assets || source.assets || {}
  const params = input.params || source.params || {}
  const frontImage = getPatternImageValue(assets.frontImage || params.frontImage || params.frontImageUrl || input.imageUrl || assets.clothImage)
  const backImage = getPatternImageValue(assets.backImage || params.backImage || params.backImageUrl)
  const sideImage = getPatternImageValue(assets.sideImage || params.sideImage || params.sideImageUrl)
  const structureSketch = getPatternImageValue(assets.structureSketch || params.structureSketch || params.structureSketchUrl)
  const designSketch = getPatternImageValue(assets.designSketch || params.designSketch || params.designSketchUrl)
  const inputMode = PATTERN_INPUT_MODES.includes(params.inputMode) ? params.inputMode : 'garment_photo'
  const category = PATTERN_CATEGORIES.includes(params.category) ? params.category : ''
  const outputTarget = PATTERN_VISUAL_OUTPUTS.includes(params.outputTarget) ? params.outputTarget : 'front_technical'
  return {
    actionType: PATTERN_STRUCTURE_ACTION,
    frontImage,
    backImage,
    sideImage,
    structureSketch,
    designSketch,
    inputMode,
    category,
    outputTarget,
    baseSize: String(params.baseSize || '').trim(),
    measurementBasis: params.measurementBasis === 'garment' ? 'garment' : 'body',
    measurements: params.measurements && typeof params.measurements === 'object' ? params.measurements : {},
    structureRequirements: params.structureRequirements && typeof params.structureRequirements === 'object' ? params.structureRequirements : {},
    notes: String(params.notes || '').trim()
  }
}

export function validatePatternStructureInput(source = {}) {
  const input = normalizePatternStructureInput(source)
  if (!isStablePatternImage(input.frontImage)) {
    return { ok: false, errorCode: 'PATTERN_FRONT_IMAGE_REQUIRED', message: '请先上传服装正面参考图。', input }
  }
  if (!input.category) {
    return { ok: false, errorCode: 'PATTERN_CATEGORY_REQUIRED', message: '请选择服装品类。', input }
  }
  const optionalImages = [input.backImage, input.sideImage, input.structureSketch, input.designSketch].filter(Boolean)
  if (optionalImages.some((value) => !isStablePatternImage(value))) {
    return { ok: false, errorCode: 'PATTERN_REFERENCE_INVALID', message: '参考图尚未完成上传，请稍后重试。', input }
  }
  return { ok: true, errorCode: '', message: '', input }
}

export function buildPatternStructureCloudParams(source = {}) {
  const validation = validatePatternStructureInput(source)
  if (!validation.ok) return validation
  const input = validation.input
  const references = [input.frontImage]
  if (input.backImage) references.push(input.backImage)
  const thirdReference = input.structureSketch || input.designSketch || input.sideImage
  if (thirdReference && references.length < 3) references.push(thirdReference)
  return {
    ok: true,
    input,
    params: {
      actionType: PATTERN_STRUCTURE_ACTION,
      taskType: PATTERN_STRUCTURE_ACTION,
      inputMode: input.inputMode,
      category: input.category,
      outputTarget: input.outputTarget,
      frontImage: input.frontImage,
      referenceImages: references,
      referenceImageCount: references.length,
      baseSize: input.baseSize,
      measurementBasis: input.measurementBasis,
      measurements: input.measurements,
      structureRequirements: input.structureRequirements,
      notes: input.notes,
      outputLevel: 'reference_a',
      humanReviewRequired: true,
      productionReady: false
    }
  }
}
