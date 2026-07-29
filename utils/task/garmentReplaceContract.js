export const GARMENT_REPLACE_ACTION = 'garment_replace'
export const GARMENT_REPLACE_TASK_TYPE = 'clothes_replace'

export const GARMENT_REPLACE_MODES = Object.freeze({
  UPPER_ONLY: 'upper_only',
  LOWER_ONLY: 'lower_only',
  SEPARATE: 'separate',
  FULL_OUTFIT: 'full_outfit'
})

export const GARMENT_ACCESSORY_TYPES = Object.freeze(['shoes', 'bag', 'hat', 'belt', 'scarf', 'jewelry'])
export const GARMENT_PROVIDER_MAX_INPUT_IMAGES = 3
export const GARMENT_MAX_ACCESSORY_REFERENCES = 1

const GARMENT_ACCESSORY_TYPE_SET = new Set(GARMENT_ACCESSORY_TYPES)

const MODE_ALIASES = Object.freeze({
  upper: GARMENT_REPLACE_MODES.UPPER_ONLY,
  top: GARMENT_REPLACE_MODES.UPPER_ONLY,
  lower: GARMENT_REPLACE_MODES.LOWER_ONLY,
  bottom: GARMENT_REPLACE_MODES.LOWER_ONLY,
  both: GARMENT_REPLACE_MODES.SEPARATE,
  upper_lower: GARMENT_REPLACE_MODES.SEPARATE,
  outfit: GARMENT_REPLACE_MODES.FULL_OUTFIT,
  one_piece: GARMENT_REPLACE_MODES.FULL_OUTFIT,
  dress: GARMENT_REPLACE_MODES.FULL_OUTFIT
})

export function getImageValue(value = '') {
  if (typeof value === 'string') return value.trim()
  if (!value || typeof value !== 'object') return ''
  return String(value.fileId || value.fileID || value.fileUrl || value.imageUrl || value.url || '').trim()
}

export function isStableGarmentImage(value = '') {
  return /^(cloud:\/\/|https:\/\/)/i.test(getImageValue(value))
}

export function normalizeGarmentReplaceMode(value = '') {
  const normalized = String(value || '').trim().toLowerCase()
  if (Object.values(GARMENT_REPLACE_MODES).includes(normalized)) return normalized
  return MODE_ALIASES[normalized] || GARMENT_REPLACE_MODES.UPPER_ONLY
}

export function isGarmentReplaceTask(task = {}) {
  const input = task.input || {}
  const params = input.params || task.params || {}
  return [task.type, task.taskType, params.actionType, params.taskType]
    .some((value) => [GARMENT_REPLACE_ACTION, GARMENT_REPLACE_TASK_TYPE].includes(String(value || '').trim().toLowerCase()))
}

export function normalizeGarmentReplaceInput(source = {}) {
  const input = source.input || source
  const assets = input.assets || source.assets || {}
  const params = input.params || source.params || {}
  const mode = normalizeGarmentReplaceMode(params.garmentMode || params.replaceMode || params.garmentReplaceMode || params.mode)
  const legacyGarment = getImageValue(
    assets.garmentImage || assets.garmentReferenceImage || assets.referenceImage ||
    params.garmentImage || params.garmentImageUrl || params.referenceImage || params.referenceImageUrl
  )
  const personImage = getImageValue(
    assets.modelImage || assets.personImage || params.modelImage || params.personImage || params.personImageUrl ||
    input.imageUrl || input.image_url || assets.clothImage
  )
  const rawUpperGarment = getImageValue(assets.topGarmentImage || assets.upperGarment || params.topGarmentImage || params.upperGarment || params.upperGarmentUrl)
  const rawLowerGarment = getImageValue(assets.bottomGarmentImage || assets.lowerGarment || params.bottomGarmentImage || params.lowerGarment || params.lowerGarmentUrl)
  const rawOutfitGarment = getImageValue(
    assets.onePieceGarmentImage || assets.outfitGarment || params.onePieceGarmentImage || params.outfitGarment || params.outfitGarmentUrl ||
    (mode === GARMENT_REPLACE_MODES.FULL_OUTFIT ? legacyGarment : '')
  )
  const rawAccessories = Array.isArray(params.accessoryImages)
    ? params.accessoryImages
    : (Array.isArray(params.accessoryReferences)
        ? params.accessoryReferences
        : (Array.isArray(params.accessories) ? params.accessories : []))
  const accessoryReferences = rawAccessories.map((item = {}, index) => ({
    accessoryId: String(item.accessoryId || '').trim(),
    type: String(item.type || item.accessoryType || '').trim().toLowerCase(),
    name: String(item.name || '').trim(),
    imageUrl: getImageValue(item.imageUrl || item.referenceImage || item)
  })).filter((item) => item.type || item.imageUrl).map((item, index) => ({
    ...item,
    accessoryId: item.accessoryId || `accessory_reference_${index + 1}`
  }))

  return {
    actionType: GARMENT_REPLACE_ACTION,
    replaceMode: mode,
    personImage,
    upperGarment: [GARMENT_REPLACE_MODES.UPPER_ONLY, GARMENT_REPLACE_MODES.SEPARATE].includes(mode) ? (rawUpperGarment || (mode === GARMENT_REPLACE_MODES.UPPER_ONLY ? legacyGarment : '')) : '',
    lowerGarment: [GARMENT_REPLACE_MODES.LOWER_ONLY, GARMENT_REPLACE_MODES.SEPARATE].includes(mode) ? (rawLowerGarment || (mode === GARMENT_REPLACE_MODES.LOWER_ONLY ? legacyGarment : '')) : '',
    outfitGarment: mode === GARMENT_REPLACE_MODES.FULL_OUTFIT ? rawOutfitGarment : '',
    accessoryReferences,
    preserveIdentity: params.preserveIdentity !== false,
    preservePerson: params.preserveFace !== false && params.preservePerson !== false,
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
    preserveUnchangedGarment: params.preserveUnchangedGarment !== false,
    legacySingleReference: Boolean(legacyGarment && !rawUpperGarment && !rawLowerGarment && !rawOutfitGarment)
  }
}

export function validateGarmentReplaceInput(source = {}) {
  const input = normalizeGarmentReplaceInput(source)
  if (!isStableGarmentImage(input.personImage)) {
    return { ok: false, errorCode: 'GARMENT_PERSON_IMAGE_REQUIRED', message: '请先上传人物图片。', input }
  }
  const required = []
  if (input.replaceMode === GARMENT_REPLACE_MODES.UPPER_ONLY) required.push(['upperGarment', '请上传上装参考图。'])
  if (input.replaceMode === GARMENT_REPLACE_MODES.LOWER_ONLY) required.push(['lowerGarment', '请上传下装参考图。'])
  if (input.replaceMode === GARMENT_REPLACE_MODES.SEPARATE) {
    required.push(['upperGarment', '请上传上装参考图。'], ['lowerGarment', '请上传下装参考图。'])
  }
  if (input.replaceMode === GARMENT_REPLACE_MODES.FULL_OUTFIT) required.push(['outfitGarment', '请上传整套服装参考图。'])
  const missing = required.find(([key]) => !isStableGarmentImage(input[key]))
  if (missing) return { ok: false, errorCode: 'GARMENT_REFERENCE_REQUIRED', message: missing[1], input }

  const references = required.map(([key]) => input[key])
  if (references.some((url) => url === input.personImage)) {
    return { ok: false, errorCode: 'GARMENT_REFERENCE_MUST_DIFFER', message: '人物图片与服装参考图不能相同。', input }
  }
  if (input.replaceMode === GARMENT_REPLACE_MODES.SEPARATE && input.upperGarment === input.lowerGarment) {
    return { ok: false, errorCode: 'GARMENT_REFERENCES_MUST_DIFFER', message: '上装和下装请分别上传对应参考图。', input }
  }
  if (input.accessoryReferences.length > GARMENT_MAX_ACCESSORY_REFERENCES) {
    return { ok: false, errorCode: 'GARMENT_ACCESSORY_LIMIT_EXCEEDED', message: '当前每次最多添加 1 件配饰。', input }
  }
  const invalidType = input.accessoryReferences.find((item) => !GARMENT_ACCESSORY_TYPE_SET.has(item.type))
  if (invalidType) {
    return { ok: false, errorCode: 'GARMENT_ACCESSORY_TYPE_INVALID', message: '请选择支持的配饰类型。', input }
  }
  const invalidImage = input.accessoryReferences.find((item) => !isStableGarmentImage(item.imageUrl))
  if (invalidImage) {
    return { ok: false, errorCode: 'GARMENT_ACCESSORY_IMAGE_REQUIRED', message: '配饰参考图尚未上传完成。', input }
  }
  const allReferences = [...references, ...input.accessoryReferences.map((item) => item.imageUrl)]
  if (new Set([input.personImage, ...allReferences]).size !== allReferences.length + 1) {
    return { ok: false, errorCode: 'GARMENT_ACCESSORY_REFERENCE_MUST_DIFFER', message: '人物、服装和配饰参考图不能重复。', input }
  }
  if (allReferences.length + 1 > GARMENT_PROVIDER_MAX_INPUT_IMAGES) {
    return { ok: false, errorCode: 'GARMENT_REFERENCE_LIMIT_EXCEEDED', message: '上下装一起换已占满当前模型的参考图数量，暂不能同时添加配饰。', input }
  }
  return { ok: true, errorCode: '', message: '', input }
}

export function buildGarmentReplaceCloudParams(source = {}) {
  const validation = validateGarmentReplaceInput(source)
  if (!validation.ok) return validation
  const input = validation.input
  return {
    ok: true,
    input,
    params: {
      actionType: GARMENT_REPLACE_ACTION,
      taskType: GARMENT_REPLACE_TASK_TYPE,
      garmentMode: input.replaceMode,
      replaceMode: input.replaceMode,
      modelImage: input.personImage,
      personImage: input.personImage,
      personImageUrl: input.personImage,
      ...(input.upperGarment ? { topGarmentImage: input.upperGarment, upperGarment: input.upperGarment, upperGarmentUrl: input.upperGarment } : {}),
      ...(input.lowerGarment ? { bottomGarmentImage: input.lowerGarment, lowerGarment: input.lowerGarment, lowerGarmentUrl: input.lowerGarment } : {}),
      ...(input.outfitGarment ? { onePieceGarmentImage: input.outfitGarment, outfitGarment: input.outfitGarment, outfitGarmentUrl: input.outfitGarment } : {}),
      ...(input.accessoryReferences.length ? { accessoryImages: input.accessoryReferences, accessoryReferences: input.accessoryReferences } : {}),
      preserveIdentity: input.preserveIdentity,
      preserveFace: input.preserveFace,
      preserveHair: input.preserveHair,
      preserveBody: input.preserveBody,
      preservePerson: input.preservePerson,
      preservePose: input.preservePose,
      preserveBackground: input.preserveBackground,
      preserveScene: input.preserveScene,
      preserveComposition: input.preserveComposition,
      preserveGarmentColor: input.preserveGarmentColor,
      preserveGarmentPattern: input.preserveGarmentPattern,
      preserveGarmentDetails: input.preserveGarmentDetails,
      preserveUnchangedGarment: input.preserveUnchangedGarment,
      legacySingleReference: input.legacySingleReference
    }
  }
}
