const STORAGE_KEY = 'diebi_workspace_delivery_feedback_v1'

const FEEDBACK_STATUS_LABELS = Object.freeze({
  pending: '待反馈',
  accepted: '已确认',
  revision_required: '需修改'
})

function nowIso() {
  return new Date().toISOString()
}

function safeGetStorage() {
  try {
    return uni.getStorageSync(STORAGE_KEY) || null
  } catch (error) {
    return null
  }
}

function safeSetStorage(payload) {
  try {
    uni.setStorageSync(STORAGE_KEY, payload)
  } catch (error) {
    // Feedback is local delivery metadata and must not block workspace usage.
  }
}

function normalizeStatus(status = 'pending') {
  return FEEDBACK_STATUS_LABELS[status] ? status : 'pending'
}

function normalizeRating(rating = 0) {
  const value = Number(rating) || 0
  return Math.max(0, Math.min(5, value))
}

function normalizeFeedback(input = {}) {
  return {
    feedbackId: input.feedbackId || `delivery_feedback_${input.deliveryId || 'delivery'}_${Date.now()}`,
    deliveryId: input.deliveryId || '',
    customerId: input.customerId || '',
    status: normalizeStatus(input.status),
    content: input.content || '',
    rating: normalizeRating(input.rating),
    planId: input.planId || '',
    versionId: input.versionId || '',
    createdAt: input.createdAt || nowIso()
  }
}

function normalizeStore(raw) {
  const feedbacks = raw && Array.isArray(raw.feedbacks) ? raw.feedbacks : Array.isArray(raw) ? raw : []
  return feedbacks
    .map(normalizeFeedback)
    .filter((item) => item.feedbackId && item.deliveryId)
    .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))
}

function getStoreFeedbacks() {
  return normalizeStore(safeGetStorage())
}

function writeFeedbacks(feedbacks = []) {
  const normalized = normalizeStore({ feedbacks })
  safeSetStorage({ version: 1, feedbacks: normalized })
  return normalized
}

export function getDeliveryFeedbacks(deliveryId = '') {
  const feedbacks = getStoreFeedbacks()
  return deliveryId ? feedbacks.filter((item) => item.deliveryId === deliveryId) : feedbacks
}

export function createDeliveryFeedback(input = {}) {
  const feedback = normalizeFeedback(input)
  if (!feedback.deliveryId) return null
  const feedbacks = getStoreFeedbacks()
  writeFeedbacks([feedback, ...feedbacks])
  return feedback
}

export function getDeliveryFeedbackStatusLabel(status = '') {
  return FEEDBACK_STATUS_LABELS[status] || FEEDBACK_STATUS_LABELS.pending
}
