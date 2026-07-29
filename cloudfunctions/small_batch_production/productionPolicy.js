const STATUSES = Object.freeze([
  'draft', 'pending_quote', 'quoted', 'quote_confirmed', 'pending_material', 'material_ready',
  'production_scheduled', 'producing', 'quality_check', 'rework_required',
  'ready_to_deliver', 'delivered', 'completed', 'cancelled'
])

const TRANSITIONS = Object.freeze({
  draft: ['pending_quote', 'cancelled'], pending_quote: ['quoted', 'cancelled'],
  quoted: ['quote_confirmed', 'cancelled'], quote_confirmed: ['pending_material', 'cancelled'],
  pending_material: ['material_ready', 'cancelled'], material_ready: ['production_scheduled', 'cancelled'],
  production_scheduled: ['producing', 'cancelled'], producing: ['quality_check', 'cancelled'],
  quality_check: ['rework_required', 'ready_to_deliver', 'cancelled'],
  rework_required: ['producing', 'cancelled'], ready_to_deliver: ['delivered', 'cancelled'],
  delivered: ['completed', 'cancelled'], completed: [], cancelled: []
})

function canTransition(from = '', to = '') { return Boolean(TRANSITIONS[from] && TRANSITIONS[from].includes(to)) }
function isTerminal(status = '') { return ['completed', 'cancelled'].includes(status) }
function stableAsset(value = '') { return /^(cloud:\/\/|https:\/\/)/i.test(String(value || '').trim()) }

module.exports = { STATUSES, TRANSITIONS, canTransition, isTerminal, stableAsset }
