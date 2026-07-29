export const DELIVERY_STATUSES = Object.freeze([
  { key: 'draft', label: '\u8349\u7a3f', index: 0 },
  { key: 'preparing', label: '\u51c6\u5907\u4e2d', index: 1 },
  { key: 'submitted', label: '\u5f85\u63d0\u4ea4\u5ba1\u6838', index: 2 },
  { key: 'reviewing', label: '\u5ba1\u6838\u4e2d', index: 3 },
  { key: 'approved', label: '\u5df2\u5ba1\u6838', index: 4 },
  { key: 'rejected', label: '\u5df2\u9a73\u56de', index: 5 },
  { key: 'customer_confirmed', label: '\u5ba2\u6237\u5df2\u786e\u8ba4', index: 6 },
  { key: 'completed', label: '\u5df2\u5b8c\u6210', index: 7 },
  { key: 'cancelled', label: '\u5df2\u53d6\u6d88', index: 8 }
])

const STATUS_ALIASES = Object.freeze({
  pending: 'draft',
  delivered: 'approved',
  confirmed: 'completed'
})

const TRANSITIONS = Object.freeze({
  draft: ['preparing', 'cancelled'],
  preparing: ['submitted', 'cancelled'],
  submitted: ['reviewing'],
  reviewing: ['approved', 'rejected'],
  rejected: ['preparing'],
  approved: ['customer_confirmed'],
  customer_confirmed: ['completed'],
  completed: [],
  cancelled: []
})

export function normalizeDeliveryStatus(status = '') {
  const key = String(status || '').trim().toLowerCase()
  return STATUS_ALIASES[key] || (DELIVERY_STATUSES.some((item) => item.key === key) ? key : 'draft')
}

export function getDeliveryStatusLabel(status = '') {
  const key = normalizeDeliveryStatus(status)
  const target = DELIVERY_STATUSES.find((item) => item.key === key)
  return target ? target.label : '\u8349\u7a3f'
}

export function getNextDeliveryActions(status = '') {
  const key = normalizeDeliveryStatus(status)
  return (TRANSITIONS[key] || []).map((nextStatus) => ({
    status: nextStatus,
    label: getDeliveryStatusLabel(nextStatus)
  }))
}

export function canTransitionDelivery(fromStatus = '', toStatus = '') {
  const from = normalizeDeliveryStatus(fromStatus)
  const to = normalizeDeliveryStatus(toStatus)
  return (TRANSITIONS[from] || []).includes(to)
}
