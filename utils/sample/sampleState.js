export const SAMPLE_STATUSES = Object.freeze({
  DRAFT: 'draft', PENDING_FACTORY_ACCEPTANCE: 'pending_factory_acceptance', SAMPLING: 'sampling',
  SAMPLE_COMPLETED: 'sample_completed', PENDING_REVIEW: 'pending_review', CHANGES_REQUESTED: 'changes_requested',
  RESAMPLING: 'resampling', CONFIRMED: 'confirmed', CANCELLED: 'cancelled'
})
export const SAMPLE_STATUS_LABELS = Object.freeze({
  draft: '待提交', pending_factory_acceptance: '待接单', sampling: '打样中', sample_completed: '样衣已完成',
  pending_review: '待验收', changes_requested: '需要修改', resampling: '再次打样', confirmed: '样衣已确认', cancelled: '已取消'
})
export function getSampleStatusLabel(status = '') { return SAMPLE_STATUS_LABELS[String(status || '')] || '状态待确认' }
export function isSampleTerminal(status = '') { return ['confirmed', 'cancelled'].includes(String(status || '')) }
