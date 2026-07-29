export const SMALL_BATCH_STATUSES = Object.freeze({
  DRAFT: 'draft', PENDING_QUOTE: 'pending_quote', QUOTED: 'quoted', QUOTE_CONFIRMED: 'quote_confirmed',
  PENDING_MATERIAL: 'pending_material', MATERIAL_READY: 'material_ready', PRODUCTION_SCHEDULED: 'production_scheduled',
  PRODUCING: 'producing', QUALITY_CHECK: 'quality_check', REWORK_REQUIRED: 'rework_required',
  READY_TO_DELIVER: 'ready_to_deliver', DELIVERED: 'delivered', COMPLETED: 'completed', CANCELLED: 'cancelled'
})

export const SMALL_BATCH_STATUS_LABELS = Object.freeze({
  draft: '草稿', pending_quote: '待报价', quoted: '已报价', quote_confirmed: '报价已确认',
  pending_material: '待备料', material_ready: '面辅料已就绪', production_scheduled: '已排产',
  producing: '生产中', quality_check: '质检中', rework_required: '需要返工',
  ready_to_deliver: '待交付', delivered: '已交付', completed: '已完成', cancelled: '已取消'
})

export function getSmallBatchStatusLabel(status = '') { return SMALL_BATCH_STATUS_LABELS[String(status || '')] || '状态待确认' }
export function isSmallBatchTerminal(status = '') { return ['completed', 'cancelled'].includes(String(status || '')) }
