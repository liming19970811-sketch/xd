const STATUS_ALIASES = Object.freeze({
  draft: 'pending',
  pending: 'pending',
  submitted: 'generating',
  accepted: 'generating',
  provider_accepted: 'generating',
  queued: 'generating',
  processing: 'generating',
  generating: 'generating',
  running: 'generating',
  polling: 'generating',
  success: 'completed',
  completed: 'completed',
  done: 'completed',
  result_ready: 'completed',
  partial_failed: 'partial_success',
  partial_success: 'partial_success',
  needs_review: 'needs_review',
  pending_review: 'needs_review',
  result_missing: 'result_missing',
  failed: 'failed',
  error: 'failed',
  timeout: 'failed',
  cancelled: 'cancelled',
  canceled: 'cancelled',
  archived: 'archived'
})

function text(value = '') {
  return String(value || '').trim()
}

export function pickWorkResultUrl(value) {
  if (!value) return ''
  if (typeof value === 'string') return text(value)
  return text(
    value.fileId ||
    value.fileID ||
    value.fileUrl ||
    value.file_url ||
    value.imageUrl ||
    value.image_url ||
    value.videoUrl ||
    value.video_url ||
    value.coverUrl ||
    value.url
  )
}

export function isStableWorkResultUrl(value = '') {
  const url = text(value)
  return /^cloud:\/\//.test(url) || /^https:\/\//.test(url)
}

export function normalizeWorkResultItems(items = [], fallbackAssetIds = []) {
  const sourceItems = Array.isArray(items) ? items : (items ? [items] : [])
  const assets = Array.isArray(fallbackAssetIds) ? fallbackAssetIds : []
  const seen = new Set()
  return sourceItems.map((item, index) => {
    const source = typeof item === 'string' ? { url: item } : (item || {})
    const url = pickWorkResultUrl(source)
    const explicitAssetId = text(source.assetId || assets[index])
    if (!url || !isStableWorkResultUrl(url) || !explicitAssetId) return null
    const duplicateKey = `${explicitAssetId}|${url}`
    if (seen.has(duplicateKey)) return null
    seen.add(duplicateKey)
    return {
      ...source,
      assetId: explicitAssetId,
      fileId: text(source.fileId || source.fileID || (/^cloud:\/\//.test(url) ? url : '')),
      fileUrl: url,
      imageUrl: text(source.imageUrl || source.image_url || url),
      url
    }
  }).filter(Boolean)
}

export function normalizeWorkIntegrityStatus(task = {}, completedOutputCount = 0, expectedOutputCount = 1) {
  const control = task.control || {}
  if (control.uploading && Object.values(control.uploading).some(Boolean)) return 'uploading'

  const raw = text(task.status || task.taskStatus || task.task_status || task.stage).toLowerCase()
  const normalized = STATUS_ALIASES[raw] || 'pending'
  const completed = Math.max(0, Number(completedOutputCount) || 0)
  const expected = Math.max(1, Number(expectedOutputCount) || 1)

  if (normalized === 'result_missing') return 'result_missing'
  if (normalized === 'failed') return completed > 0 ? 'partial_success' : 'failed'
  if (normalized === 'cancelled' || normalized === 'archived') return normalized
  if (normalized === 'completed' && completed === 0) return 'result_missing'
  if (completed > 0 && completed < expected) return 'partial_success'
  if (['pending', 'generating'].includes(normalized)) return normalized

  if (completed >= expected) {
    const options = (task.input || {}).options || {}
    if (
      normalized === 'needs_review' ||
      task.deliveryStatus === 'needs_review' ||
      task.reviewStatus === 'needs_review' ||
      (task.result || {}).needsReview === true ||
      options.requiresReview === true ||
      options.deliveryEligible === false
    ) return 'needs_review'
    return 'completed'
  }

  return normalized
}

export function hasCompleteWorkResult(items = [], expectedOutputCount = 1) {
  const normalizedItems = normalizeWorkResultItems(items)
  return normalizedItems.length >= Math.max(1, Number(expectedOutputCount) || 1)
}

export { STATUS_ALIASES as WORK_INTEGRITY_STATUS_ALIASES }
