export const PATTERN_REVIEW_STATES = Object.freeze({
  DRAFT: 'draft',
  AI_GENERATED: 'ai_generated',
  UNDER_REVIEW: 'under_review',
  CHANGES_REQUESTED: 'changes_requested',
  REVIEWED: 'reviewed',
  APPROVED: 'approved',
  ARCHIVED: 'archived'
})

export const PATTERN_REVIEW_LABELS = Object.freeze({
  draft: '草稿',
  ai_generated: 'AI 生成待复核',
  under_review: '复核中',
  changes_requested: '需修改',
  reviewed: '已复核',
  approved: '已批准',
  archived: '已归档'
})

export function normalizePatternReviewStatus(value = '') {
  const status = String(value || '').trim()
  const legacy = {
    not_submitted: PATTERN_REVIEW_STATES.DRAFT,
    pending: PATTERN_REVIEW_STATES.UNDER_REVIEW,
    review: PATTERN_REVIEW_STATES.UNDER_REVIEW,
    rejected: PATTERN_REVIEW_STATES.CHANGES_REQUESTED
  }
  const normalized = legacy[status] || status
  return Object.values(PATTERN_REVIEW_STATES).includes(normalized) ? normalized : PATTERN_REVIEW_STATES.DRAFT
}

export function getPatternReviewLabel(value = '') {
  return PATTERN_REVIEW_LABELS[normalizePatternReviewStatus(value)] || '状态待确认'
}

export function isPatternReviewTerminal(value = '') {
  return [PATTERN_REVIEW_STATES.APPROVED, PATTERN_REVIEW_STATES.ARCHIVED].includes(normalizePatternReviewStatus(value))
}
