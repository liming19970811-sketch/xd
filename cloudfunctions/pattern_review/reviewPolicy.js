const STATES = Object.freeze(['draft', 'ai_generated', 'under_review', 'changes_requested', 'reviewed', 'approved', 'archived'])
const REVIEW_ROLES = Object.freeze(['pattern_maker', 'reviewer', 'admin'])
const APPROVE_ROLES = Object.freeze(['pattern_maker', 'reviewer', 'admin'])
const TRANSITIONS = Object.freeze({
  draft: Object.freeze(['ai_generated']),
  ai_generated: Object.freeze(['under_review']),
  under_review: Object.freeze(['changes_requested', 'reviewed']),
  changes_requested: Object.freeze(['under_review']),
  reviewed: Object.freeze(['changes_requested', 'approved']),
  approved: Object.freeze(['archived']),
  archived: Object.freeze([])
})

function canReview(role = '') { return REVIEW_ROLES.includes(String(role || '')) }
function canApprove(role = '') { return APPROVE_ROLES.includes(String(role || '')) }
function canTransition(from = '', to = '') { return Boolean(TRANSITIONS[from] && TRANSITIONS[from].includes(to)) }
function approvedSafetyState() { return { productionAvailable: false, factoryReady: false, sampleValidationStatus: 'not_started' } }

module.exports = { STATES, REVIEW_ROLES, APPROVE_ROLES, TRANSITIONS, canReview, canApprove, canTransition, approvedSafetyState }
