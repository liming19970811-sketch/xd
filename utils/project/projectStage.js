export const PROJECT_STAGES = Object.freeze([
  { key: 'draft', label: '\u9700\u6c42\u9636\u6bb5', index: 0 },
  { key: 'design', label: '\u8bbe\u8ba1\u9636\u6bb5', index: 1 },
  { key: 'production', label: '\u751f\u4ea7\u9636\u6bb5', index: 2 },
  { key: 'review', label: '\u5ba1\u6838\u9636\u6bb5', index: 3 },
  { key: 'delivery', label: '\u4ea4\u4ed8\u9636\u6bb5', index: 4 },
  { key: 'completed', label: '\u5b8c\u6210\u9636\u6bb5', index: 5 }
])

const STAGE_ALIASES = Object.freeze({
  draft: 'draft',
  requirement: 'draft',
  requirement_confirmation: 'draft',
  pending: 'draft',
  planning: 'draft',
  design: 'design',
  designing: 'design',
  production: 'production',
  generating: 'production',
  processing: 'production',
  in_progress: 'production',
  review: 'review',
  reviewing: 'review',
  pending_review: 'review',
  approved: 'review',
  delivery: 'delivery',
  delivered: 'delivery',
  confirmed: 'completed',
  completed: 'completed',
  archived: 'completed',
  done: 'completed'
})

const STATUS_LABELS = Object.freeze({
  draft: '\u8349\u7a3f',
  requirement: '\u9700\u6c42\u786e\u8ba4',
  requirement_confirmation: '\u9700\u6c42\u786e\u8ba4',
  pending: '\u5f85\u5904\u7406',
  planning: '\u89c4\u5212\u4e2d',
  design: '\u8bbe\u8ba1\u4e2d',
  designing: '\u8bbe\u8ba1\u4e2d',
  production: '\u751f\u4ea7\u4e2d',
  generating: '\u751f\u6210\u4e2d',
  processing: '\u5904\u7406\u4e2d',
  in_progress: '\u8fdb\u884c\u4e2d',
  review: '\u5ba1\u6838\u4e2d',
  reviewing: '\u5ba1\u6838\u4e2d',
  pending_review: '\u5f85\u5ba1\u6838',
  approved: '\u5df2\u5ba1\u6838',
  delivery: '\u4ea4\u4ed8\u4e2d',
  delivered: '\u5df2\u4ea4\u4ed8',
  confirmed: '\u5df2\u786e\u8ba4',
  completed: '\u5df2\u5b8c\u6210',
  archived: '\u5df2\u5f52\u6863'
})

function normalizeKey(value = '') {
  return String(value || '').trim().toLowerCase()
}

export function getProjectStages() {
  return PROJECT_STAGES.map((item) => ({ ...item }))
}

export function normalizeProjectStage(value = '') {
  const key = normalizeKey(value)
  return STAGE_ALIASES[key] || 'draft'
}

export function getProjectStage(value = '') {
  const key = normalizeProjectStage(value)
  return PROJECT_STAGES.find((item) => item.key === key) || PROJECT_STAGES[0]
}

export function getProjectStageLabel(value = '') {
  return getProjectStage(value).label
}

export function getProjectStatusLabel(value = '') {
  const key = normalizeKey(value)
  return STATUS_LABELS[key] || getProjectStageLabel(value)
}

export function getProjectStageIndex(value = '') {
  return getProjectStage(value).index
}

export function buildProjectStageProgress(value = '', options = {}) {
  const delivered = Array.isArray(options.deliveries) && options.deliveries.some((item) => item.status === 'confirmed')
  const stageKey = delivered ? 'completed' : normalizeProjectStage(value)
  const currentIndex = getProjectStageIndex(stageKey)
  return PROJECT_STAGES.map((stage) => ({
    ...stage,
    state: stage.index < currentIndex ? 'done' : (stage.index === currentIndex ? 'current' : 'pending')
  }))
}
