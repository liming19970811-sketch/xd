const STATUSES = Object.freeze([
  'draft', 'pending_factory_acceptance', 'sampling', 'sample_completed', 'pending_review',
  'changes_requested', 'resampling', 'confirmed', 'cancelled'
])

const TRANSITIONS = Object.freeze({
  draft: Object.freeze(['pending_factory_acceptance', 'cancelled']),
  pending_factory_acceptance: Object.freeze(['sampling', 'cancelled']),
  sampling: Object.freeze(['sample_completed', 'cancelled']),
  sample_completed: Object.freeze(['pending_review', 'cancelled']),
  pending_review: Object.freeze(['changes_requested', 'confirmed', 'cancelled']),
  changes_requested: Object.freeze(['resampling', 'cancelled']),
  resampling: Object.freeze(['sample_completed', 'cancelled']),
  confirmed: Object.freeze([]),
  cancelled: Object.freeze([])
})

function canTransition(from = '', to = '') { return Boolean(TRANSITIONS[from] && TRANSITIONS[from].includes(to)) }
function isTerminal(status = '') { return ['confirmed', 'cancelled'].includes(status) }
function stableAsset(value = '') { return /^(cloud:\/\/|https:\/\/)/i.test(String(value || '').trim()) }

module.exports = { STATUSES, TRANSITIONS, canTransition, isTerminal, stableAsset }
