export const GARMENT_DETAIL_PARENT_TASK_TYPE = 'garment_detail_batch'

export const GARMENT_DETAIL_MODES = Object.freeze({
  FAITHFUL: 'faithful_crop_enhance',
  AI_REFERENCE: 'ai_completion_reference'
})

const DETAIL_TYPE_ALIASES = Object.freeze({
  collar: 'neckline',
  cuff: 'cuff',
  button: 'button',
  zipper: 'zipper',
  stitching: 'stitching',
  skirt_hem: 'hem'
})

const FORBIDDEN_LAYOUT_TERMS = Object.freeze([
  'collage',
  'grid',
  'contact sheet',
  'nine-panel',
  'multi-panel',
  'moodboard',
  'detail collection'
])

const STRUCTURE_PRESERVE_PROMPT = [
  '只展示一个目标细节，输出一张独立图片',
  '忠实保留原始颜色、材质、五金、车线、装饰数量、位置、连接方式和版型结构',
  '不得新增、删除或替换金属链、纽扣、拉链、包边、蕾丝、腰带、装饰条或拼接线',
  '不得生成九宫格、多宫格、拼贴图、联系表、情绪板或白色分隔线'
].join('；')

const METAL_CHAIN_PROMPT = '忠实保留原图领口的金属链条装饰，包括链条位置、连接关系、链节形态、金属颜色和反光质感。不得替换为白色包边、布条、滚边、蕾丝、肩带或其他装饰。'

const METAL_CHAIN_NEGATIVE_PROMPT = [
  'white piping',
  'white trim',
  'fabric edging',
  'cloth strap',
  'lace border',
  'redesigned neckline',
  'missing metal chain'
].join(', ')

function normalizeDetailType(value = '') {
  const normalized = String(value || '').trim().toLowerCase()
  return DETAIL_TYPE_ALIASES[normalized] || normalized.replace(/[^a-z0-9_]/g, '_')
}

export function getGarmentDetailTaskType(detailType = '') {
  return `garment_detail_${normalizeDetailType(detailType) || 'unknown'}`
}

export function getGarmentDetailReference(detailReferences = {}, detailType = '') {
  const reference = detailReferences && detailReferences[detailType]
  if (!reference) return ''
  if (typeof reference === 'string') return reference
  return String(reference.url || reference.fileUrl || reference.fileId || reference.localPath || '')
}

export function buildGarmentDetailPrompt(detail = {}, options = {}) {
  const detailType = String(detail.value || detail.detailType || '')
  const detailName = String(detail.label || detail.displayName || '服装细节')
  const mode = options.mode === GARMENT_DETAIL_MODES.AI_REFERENCE
    ? GARMENT_DETAIL_MODES.AI_REFERENCE
    : GARMENT_DETAIL_MODES.FAITHFUL
  const modePrompt = mode === GARMENT_DETAIL_MODES.FAITHFUL
    ? '以对应细节近照的真实像素为依据，仅做真实裁切、放大、清晰度增强和轻微构图整理，不重新设计结构'
    : '原图细节不完整，仅根据对应细节近照进行有限补全；结果必须标记为AI推测参考，不得作为精确商品细节交付'
  const prompt = [
    `${detailName}局部特写`,
    modePrompt,
    STRUCTURE_PRESERVE_PROMPT,
    detailType === 'collar' ? METAL_CHAIN_PROMPT : '',
    String(detail.prompt || ''),
    String(options.additionalRequirements || '')
  ].filter(Boolean).join('；')
  return {
    prompt,
    negativePrompt: [
      'divided layout',
      'multiple garment details in one image',
      detailType === 'collar' ? METAL_CHAIN_NEGATIVE_PROMPT : ''
    ].filter(Boolean).join(', ')
  }
}

export function validateGarmentDetailSelection(options = {}) {
  const selectedDetails = Array.isArray(options.selectedDetails) ? options.selectedDetails : []
  if (!selectedDetails.length) {
    return { ok: false, code: 'GARMENT_DETAIL_REQUIRED', message: '请至少选择一个细节部位' }
  }
  const missing = selectedDetails.find((detail) => !getGarmentDetailReference(options.detailReferences, detail.value))
  if (missing) {
    return {
      ok: false,
      code: 'GARMENT_DETAIL_REFERENCE_REQUIRED',
      detailType: missing.value,
      message: `请补充${missing.label || '所选细节'}近照，避免随机生成不一致结构`
    }
  }
  return { ok: true, code: '', message: '' }
}

export function buildGarmentDetailChildren(options = {}) {
  const selectedDetails = Array.isArray(options.selectedDetails) ? options.selectedDetails : []
  const expectedOutputCount = selectedDetails.length
  const submissionKey = String(options.submissionKey || 'garment_detail_submit')
  return selectedDetails.map((detail, index) => {
    const detailType = String(detail.value || '')
    const detailReferenceImage = getGarmentDetailReference(options.detailReferences, detailType)
    const prompts = buildGarmentDetailPrompt(detail, options)
    return {
      detailType,
      displayName: `${detail.label || '服装'}细节图`,
      taskType: getGarmentDetailTaskType(detailType),
      itemType: getGarmentDetailTaskType(detailType),
      outputIndex: index,
      outputCount: 1,
      expectedOutputCount,
      detailReferenceImage,
      promptDraft: prompts.prompt,
      negativePrompt: prompts.negativePrompt,
      idempotencyKey: `${submissionKey}_${detailType}`
    }
  })
}

export function containsForbiddenGarmentDetailLayoutPrompt(value = '') {
  const normalized = String(value || '').toLowerCase()
  return FORBIDDEN_LAYOUT_TERMS.some((term) => normalized.includes(term))
}
