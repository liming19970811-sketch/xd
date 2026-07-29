export const PATTERN_TRAINING_CONSENT_VERSION = 'pattern-training-consent-v1'

const INPUT_TYPES = Object.freeze(['garment_photo', 'design_render', 'structure_sketch'])
const CATEGORIES = Object.freeze(['tshirt', 'shirt', 'dress', 'skirt', 'pants', 'coat'])
export const PATTERN_EVALUATION_CATEGORIES = CATEGORIES
export const PATTERN_EVALUATION_DATASET_SPLIT = 'evaluation'
export const PATTERN_EVALUATION_METRIC_VERSION = 'pattern-evaluation-metrics-v1'

const BLIND_REVIEW_FIELDS = Object.freeze(['structureAccuracy', 'sizeAccuracy', 'partAccuracy', 'constructionAccuracy'])

function text(value = '', max = 500) {
  return String(value || '').trim().slice(0, max)
}

function stringList(value, max = 20) {
  return Array.isArray(value) ? [...new Set(value.map((item) => text(item, 120)).filter(Boolean))].slice(0, max) : []
}

function object(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
}

function numericObject(value) {
  return Object.keys(object(value)).reduce((result, key) => {
    const number = Number(value[key])
    if (Number.isFinite(number) && number >= 0 && number <= 500) result[text(key, 60)] = number
    return result
  }, {})
}

export function normalizePatternTrainingInput(source = {}) {
  const input = object(source.patternInput || source)
  const legacyImages = object(input.sourceImages)
  return {
    inputType: INPUT_TYPES.includes(input.inputType || input.inputMode) ? (input.inputType || input.inputMode) : 'garment_photo',
    garmentCategory: CATEGORIES.includes(input.garmentCategory || input.category) ? (input.garmentCategory || input.category) : '',
    frontImageAssetId: text(input.frontImageAssetId || legacyImages.frontImageAssetId || legacyImages.frontImage),
    backImageAssetId: text(input.backImageAssetId || legacyImages.backImageAssetId || legacyImages.backImage),
    sideImageAssetIds: stringList(input.sideImageAssetIds || [legacyImages.sideImageAssetId || legacyImages.sideImage]),
    detailImageAssetIds: stringList(input.detailImageAssetIds),
    sketchAssetId: text(input.sketchAssetId || legacyImages.structureSketchAssetId || legacyImages.structureSketch || legacyImages.designSketch),
    bodyMeasurements: numericObject(input.bodyMeasurements || (input.measurementBasis === 'body' ? input.measurements : {})),
    garmentMeasurements: numericObject(input.garmentMeasurements || (input.measurementBasis === 'garment' ? input.measurements : {})),
    baseSize: text(input.baseSize, 30),
    materialProperties: object(input.materialProperties),
    structureOptions: object(input.structureOptions || input.structureRequirements),
    constructionRequirements: text(input.constructionRequirements || input.notes, 2000)
  }
}

export function normalizePatternTrainingOutput(source = {}) {
  const output = object(source.patternOutput || source)
  return {
    technicalDrawingAssetIds: stringList(output.technicalDrawingAssetIds || output.assetIds, 30),
    patternPieces: Array.isArray(output.patternPieces) ? output.patternPieces.slice(0, 100) : [],
    sizeSpecs: Array.isArray(output.sizeSpecs) ? output.sizeSpecs.slice(0, 30) : [],
    constructionNotes: text(output.constructionNotes || output.craftNote, 3000),
    generatedOutputs: Array.isArray(output.generatedOutputs) ? output.generatedOutputs.slice(0, 30) : [],
    modelVersion: text(output.modelVersion, 100),
    providerRunId: text(output.providerRunId, 120),
    humanReviewRequired: true,
    productionReady: false
  }
}

function comparable(value) {
  if (Array.isArray(value)) return value.map(comparable)
  if (!value || typeof value !== 'object') return value == null ? '' : value
  return Object.keys(value).sort().reduce((result, key) => {
    result[key] = comparable(value[key])
    return result
  }, {})
}

function same(left, right) {
  return JSON.stringify(comparable(left)) === JSON.stringify(comparable(right))
}

function keyed(items = [], keyNames = []) {
  return new Map((Array.isArray(items) ? items : []).map((item, index) => {
    const key = keyNames.map((name) => text(item && item[name])).find(Boolean) || `item_${index}`
    return [key, item || {}]
  }))
}

export function buildPatternRevisionDiff(before = {}, after = {}) {
  const beforeOutput = normalizePatternTrainingOutput(before)
  const afterOutput = normalizePatternTrainingOutput(after)
  const fieldChanges = ['constructionNotes', 'generatedOutputs'].filter((field) => !same(beforeOutput[field], afterOutput[field])).map((field) => ({
    field,
    before: beforeOutput[field],
    after: afterOutput[field]
  }))
  const partBefore = keyed(beforeOutput.patternPieces, ['partCode', 'name'])
  const partAfter = keyed(afterOutput.patternPieces, ['partCode', 'name'])
  const partKeys = [...new Set([...partBefore.keys(), ...partAfter.keys()])]
  const partChanges = partKeys.filter((key) => !same(partBefore.get(key), partAfter.get(key))).map((key) => ({
    key,
    changeType: !partBefore.has(key) ? 'added' : (!partAfter.has(key) ? 'removed' : 'updated'),
    before: partBefore.get(key) || null,
    after: partAfter.get(key) || null
  }))
  const sizeBefore = keyed(beforeOutput.sizeSpecs, ['baseSize', 'sizeCode'])
  const sizeAfter = keyed(afterOutput.sizeSpecs, ['baseSize', 'sizeCode'])
  const sizeKeys = [...new Set([...sizeBefore.keys(), ...sizeAfter.keys()])]
  const sizeChanges = sizeKeys.filter((key) => !same(sizeBefore.get(key), sizeAfter.get(key))).map((key) => ({
    key,
    changeType: !sizeBefore.has(key) ? 'added' : (!sizeAfter.has(key) ? 'removed' : 'updated'),
    before: sizeBefore.get(key) || null,
    after: sizeAfter.get(key) || null
  }))
  return {
    fieldChanges,
    partChanges,
    sizeChanges,
    changeCount: fieldChanges.length + partChanges.length + sizeChanges.length
  }
}

export function evaluatePatternTrainingEligibility(input = {}) {
  const reasons = []
  if (input.consentStatus !== 'granted') reasons.push('training_consent_required')
  if (input.reviewStatus !== 'approved') reasons.push('approved_pattern_required')
  if (!input.patternId || !input.versionId) reasons.push('traceability_required')
  if (!input.hasAiDraft) reasons.push('ai_draft_required')
  if (!input.hasHumanRevision) reasons.push('human_revision_required')
  if (!input.sourceKnown) reasons.push('source_authorization_required')
  return { eligible: reasons.length === 0, reasons }
}

function itemKey(item = {}, index = 0) {
  return text(item.partCode || item.code || item.name || `part_${index}`, 120).toLowerCase()
}

function sizeValueMap(items = []) {
  const result = {}
  ;(Array.isArray(items) ? items : []).forEach((spec = {}) => {
    const size = text(spec.baseSize || spec.sizeCode || 'base', 30)
    Object.keys(object(spec.values)).forEach((key) => {
      const value = Number(spec.values[key])
      if (Number.isFinite(value)) result[`${size}:${text(key, 60)}`] = value
    })
  })
  return result
}

export function buildPatternAutomaticMetrics(candidate = {}, approved = {}) {
  const candidateOutput = normalizePatternTrainingOutput(candidate)
  const approvedOutput = normalizePatternTrainingOutput(approved)
  const candidateParts = new Map(candidateOutput.patternPieces.map((item, index) => [itemKey(item, index), item]))
  const approvedParts = new Map(approvedOutput.patternPieces.map((item, index) => [itemKey(item, index), item]))
  const matchedParts = [...candidateParts.keys()].filter((key) => approvedParts.has(key))
  const precision = candidateParts.size ? matchedParts.length / candidateParts.size : 0
  const recall = approvedParts.size ? matchedParts.length / approvedParts.size : 0
  const partF1 = precision + recall ? (2 * precision * recall) / (precision + recall) : 0

  const candidateSizes = sizeValueMap(candidateOutput.sizeSpecs)
  const approvedSizes = sizeValueMap(approvedOutput.sizeSpecs)
  const comparableKeys = Object.keys(approvedSizes).filter((key) => Number.isFinite(candidateSizes[key]))
  const errors = comparableKeys.map((key) => Math.abs(candidateSizes[key] - approvedSizes[key]))
  const sizeMeanAbsoluteError = errors.length ? errors.reduce((sum, value) => sum + value, 0) / errors.length : null
  const sizeWithinToleranceRate = errors.length ? errors.filter((value) => value <= 1).length / errors.length : 0

  return {
    metricVersion: PATTERN_EVALUATION_METRIC_VERSION,
    partPrecision: Number(precision.toFixed(4)),
    partRecall: Number(recall.toFixed(4)),
    partF1: Number(partF1.toFixed(4)),
    approvedPartCount: approvedParts.size,
    candidatePartCount: candidateParts.size,
    comparableSizeFieldCount: errors.length,
    sizeMeanAbsoluteError: sizeMeanAbsoluteError == null ? null : Number(sizeMeanAbsoluteError.toFixed(4)),
    sizeWithinToleranceRate: Number(sizeWithinToleranceRate.toFixed(4)),
    hasConstructionNotes: Boolean(candidateOutput.constructionNotes),
    outputComplete: Boolean(candidateParts.size && errors.length)
  }
}

export function normalizePatternBlindReview(source = {}) {
  const scores = BLIND_REVIEW_FIELDS.reduce((result, field) => {
    const value = Number(source[field] || object(source.scores)[field])
    if (Number.isInteger(value) && value >= 1 && value <= 5) result[field] = value
    return result
  }, {})
  return {
    scores,
    issueTags: stringList(source.issueTags, 20),
    notes: text(source.notes, 1000),
    recommendCandidate: source.recommendCandidate === true
  }
}

export function validatePatternBlindReview(source = {}) {
  const review = normalizePatternBlindReview(source)
  const missing = BLIND_REVIEW_FIELDS.filter((field) => !review.scores[field])
  return {
    ok: missing.length === 0,
    errorCode: missing.length ? 'BLIND_REVIEW_SCORES_REQUIRED' : '',
    message: missing.length ? '请完成结构、尺寸、部件和工艺四项评分。' : '',
    review
  }
}

export function evaluatePatternCandidateGates(metrics = {}, context = {}) {
  const human = object(metrics.humanScores)
  const automatic = object(metrics.automatic)
  const failures = []
  if (Number(context.categoryCount || 0) < CATEGORIES.length) failures.push('category_coverage_incomplete')
  if (Number(context.resultCoverage || 0) < 1) failures.push('sample_results_incomplete')
  if (Number(context.reviewCoverage || 0) < 1) failures.push('blind_reviews_incomplete')
  if (Number(automatic.outputCompleteRate || 0) < 1) failures.push('output_incomplete')
  if (Number(automatic.partF1 || 0) < 0.85) failures.push('part_f1_below_threshold')
  if (Number(automatic.sizeWithinToleranceRate || 0) < 0.9) failures.push('size_tolerance_below_threshold')
  BLIND_REVIEW_FIELDS.forEach((field) => {
    if (Number(human[field] || 0) < 4) failures.push(`${field}_below_threshold`)
  })
  return { passed: failures.length === 0, failures }
}
