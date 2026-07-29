const ACTION = 'pattern_structure_generate'
const OUTPUTS = new Set(['front_technical', 'back_technical', 'pattern_pieces'])
const CATEGORIES = new Set(['tshirt', 'shirt', 'dress', 'skirt', 'pants', 'coat'])

function text(value = '') {
  return String(value || '').trim()
}

function isPatternStructureAction(actionType = '') {
  return text(actionType).toLowerCase() === ACTION
}

function normalizePatternStructureParams(params = {}, fallbackImage = '') {
  const references = Array.isArray(params.referenceImages) ? params.referenceImages.map(text).filter(Boolean).slice(0, 3) : []
  const frontImage = text(params.frontImage || params.frontImageUrl || fallbackImage || references[0])
  if (frontImage && !references.includes(frontImage)) references.unshift(frontImage)
  return {
    frontImage,
    referenceImages: references.slice(0, 3),
    inputMode: ['garment_photo', 'design_render', 'structure_sketch'].includes(params.inputMode) ? params.inputMode : 'garment_photo',
    category: CATEGORIES.has(params.category) ? params.category : '',
    outputTarget: OUTPUTS.has(params.outputTarget) ? params.outputTarget : 'front_technical',
    baseSize: text(params.baseSize),
    measurementBasis: params.measurementBasis === 'garment' ? 'garment' : 'body',
    measurements: params.measurements && typeof params.measurements === 'object' ? params.measurements : {},
    structureRequirements: params.structureRequirements && typeof params.structureRequirements === 'object' ? params.structureRequirements : {},
    notes: text(params.notes)
  }
}

function validatePatternStructureParams(params = {}, fallbackImage = '') {
  const input = normalizePatternStructureParams(params, fallbackImage)
  if (!input.frontImage) return { ok: false, errorCode: 'PATTERN_FRONT_IMAGE_REQUIRED', message: 'Front garment reference is required', input }
  if (!input.category) return { ok: false, errorCode: 'PATTERN_CATEGORY_REQUIRED', message: 'Garment category is required', input }
  return { ok: true, errorCode: '', message: '', input }
}

function buildPatternStructurePrompt(input = {}, prompt = '') {
  const categoryLabels = { tshirt: 'T-shirt', shirt: 'shirt', dress: 'dress', skirt: 'skirt', pants: 'pants', coat: 'coat' }
  const outputInstructions = {
    front_technical: 'Create a clean front-view fashion technical flat drawing with clear seam, panel, neckline, sleeve, closure, pocket and hem construction lines.',
    back_technical: 'Create a clean back-view fashion technical flat drawing. Infer hidden construction conservatively and do not invent decorative details not supported by references.',
    pattern_pieces: 'Create a labeled pattern-piece reference board showing the likely major component shapes and assembly relationships. It is a non-scale visual reference, not an industrial cutting pattern.'
  }
  const measurementSummary = Object.keys(input.measurements || {})
    .filter((key) => input.measurements[key] !== '' && input.measurements[key] !== null && input.measurements[key] !== undefined)
    .map((key) => `${key}: ${input.measurements[key]} cm`)
    .join(', ')
  const structureSummary = Object.keys(input.structureRequirements || {})
    .filter((key) => input.structureRequirements[key])
    .map((key) => `${key}: ${input.structureRequirements[key]}`)
    .join(', ')
  return [
    'Generate a garment pattern-making reference illustration for design communication.',
    `Garment category: ${categoryLabels[input.category] || input.category}. Input mode: ${input.inputMode}.`,
    outputInstructions[input.outputTarget],
    'Use Image 1 as the primary front reference. Additional images are supplementary back, sketch or detail references only.',
    'Use black technical linework on a plain white background. Keep front/back orientation, construction lines and component labels legible.',
    input.baseSize ? `User-selected base size: ${input.baseSize}.` : 'No precise base size was supplied.',
    measurementSummary ? `User-provided ${input.measurementBasis} measurements: ${measurementSummary}. Do not infer missing measurements.` : 'No precise measurements were supplied; do not fabricate numeric dimensions.',
    structureSummary ? `Requested structure: ${structureSummary}.` : '',
    input.notes ? `Additional user notes: ${input.notes}.` : '',
    'Add a visible note: AI STRUCTURE REFERENCE - HUMAN PATTERN MAKER REVIEW REQUIRED - NOT FOR DIRECT CUTTING.',
    'Do not claim production accuracy, grading, seam allowance, notches, grainline precision, DXF or industrial readiness.',
    text(prompt)
  ].filter(Boolean).join('\n')
}

module.exports = {
  ACTION,
  buildPatternStructurePrompt,
  isPatternStructureAction,
  normalizePatternStructureParams,
  validatePatternStructureParams
}
