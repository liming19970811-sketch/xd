import { getPatternLibraryDetail, getPatternLibraryVersionDetail } from './patternLibraryRepository.js'
import { callPatternReview } from './patternReviewTransport.js'
import { applyTrustedPatternReviewStatus } from '../workspace/patternMakingRepository.js'

function text(value = '') { return String(value || '').trim() }

function sanitizePart(part = {}) {
  return {
    patternPartId: text(part.patternPartId), partCode: text(part.partCode), name: text(part.name),
    quantity: Math.max(1, Number(part.quantity) || 1), cutQuantity: Math.max(1, Number(part.cutQuantity) || 1),
    materialLayer: text(part.materialLayer), grainDirection: text(part.grainDirection), seamAllowanceStatus: text(part.seamAllowanceStatus)
  }
}

function sanitizeSize(spec = {}) {
  const values = spec.values && typeof spec.values === 'object' ? spec.values : {}
  return {
    sizeSpecId: text(spec.sizeSpecId), baseSize: text(spec.baseSize), measurementBasis: text(spec.measurementBasis), unit: 'cm',
    precisionStatus: text(spec.precisionStatus), values: Object.keys(values).reduce((result, key) => {
      const numeric = Number(values[key])
      if (Number.isFinite(numeric)) result[key] = numeric
      return result
    }, {})
  }
}

export function buildPatternReviewSubmission(patternId = '', versionId = '') {
  const detail = getPatternLibraryDetail(text(patternId))
  if (!detail.ok) return detail
  const version = versionId
    ? detail.data.versions.find((item) => item.versionId === text(versionId))
    : detail.data.currentVersion
  if (!version) return { ok: false, status: 'not_found', errorCode: 'VERSION_NOT_FOUND', message: '版型版本不存在。' }
  const versionDetail = getPatternLibraryVersionDetail(patternId, version.versionId)
  if (!versionDetail.ok) return versionDetail
  const parts = versionDetail.data.parts || []
  const sizeSpecs = versionDetail.data.sizeSpecs || []
  return {
    ok: true,
    data: {
      master: {
        patternMasterId: text(detail.data.master.patternMasterId), patternCode: text(detail.data.master.patternCode),
        title: text(detail.data.master.title), category: text(detail.data.master.category), patternLevel: text(detail.data.master.patternLevel || 'A'),
        source: text(detail.data.master.source), taxonomy: detail.data.master.taxonomy || {}, tags: detail.data.master.tags || [],
        linkedAssetIds: detail.data.master.linkedAssetIds || []
      },
      version: {
        versionId: text(version.versionId), versionNo: text(version.versionNo), status: text(version.status),
        reviewStatus: text(version.reviewStatus), assetIds: version.assetIds || [], requestedOutputs: version.requestedOutputs || [],
        generatedOutputs: version.generatedOutputs || [], sizeParams: version.sizeParams || {}, craftNote: text(version.craftNote),
        aiDraft: version.aiDraft || {}, historyId: text(version.historyId), batchId: text(version.batchId), taskIds: version.taskIds || []
      },
      parts: parts.map(sanitizePart),
      sizeSpecs: sizeSpecs.map(sanitizeSize)
    }
  }
}

export async function submitPatternForReview(patternId = '', versionId = '') {
  const submission = buildPatternReviewSubmission(patternId, versionId)
  if (!submission.ok) return submission
  const result = await callPatternReview('submit', submission.data)
  if (result.ok && result.data && result.data.pattern) applyTrustedPatternReviewStatus(patternId, result.data.pattern)
  return result
}

export function getPatternReviewQueue(options = {}) { return callPatternReview('queue', options) }
export function getPatternReviewDetail(patternId = '', versionId = '') { return callPatternReview('get', { patternId, versionId }) }
export function claimPatternReview(patternId = '', versionId = '') { return callPatternReview('claim', { patternId, versionId }) }
export function savePatternReviewRevision(input = {}) { return callPatternReview('save_revision', input) }
export function requestPatternChanges(input = {}) { return callPatternReview('request_changes', input) }
export function markPatternReviewed(input = {}) { return callPatternReview('mark_reviewed', input) }
export function approvePatternVersion(input = {}) { return callPatternReview('approve', input) }
