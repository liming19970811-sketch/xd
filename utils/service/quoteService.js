import { create as createQuoteRecord, getById as getQuoteById, getList as getQuoteList, update as updateQuote } from '../repository/quoteRepository.js'
import { emit } from '../events/eventBus.js'
import { QUOTE_CONFIRMED } from '../events/businessEvents.js'
import { recordAudit } from '../audit/auditService.js'

export const QUOTE_STATUS_FLOW = Object.freeze(['draft', 'sent', 'confirmed', 'rejected'])

const QUOTE_ACTION_LABELS = Object.freeze({
  create: '\u521b\u5efa\u62a5\u4ef7',
  sent: '\u53d1\u9001\u62a5\u4ef7',
  confirmed: '\u786e\u8ba4\u62a5\u4ef7',
  rejected: '\u62d2\u7edd\u62a5\u4ef7'
})

function logQuoteAction(payload = {}) {
  if (typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'production') return
  console.log('[quote:flow]', {
    entityId: payload.entityId || '',
    action: payload.action || '',
    success: Boolean(payload.success),
    errorCode: payload.errorCode || ''
  })
}

function auditQuote(actionKey = '', quote = {}, actor = {}, before = {}) {
  if (!quote || !quote.quoteId) return null
  return recordAudit({
    enterpriseId: quote.enterpriseId || actor.enterpriseId,
    userId: actor.userId,
    operator: actor.operator,
    action: QUOTE_ACTION_LABELS[actionKey] || '\u66f4\u65b0\u62a5\u4ef7',
    targetType: 'quote',
    targetId: quote.quoteId,
    before: before && before.quoteId ? { status: before.status || 'draft' } : {},
    after: {
      status: quote.status || 'draft',
      projectId: quote.projectId || '',
      amount: Number(quote.amount || 0)
    }
  })
}

export function getQuotes(filters = {}) {
  const records = getQuoteList()
  return filters.projectId ? records.filter((item) => item.projectId === filters.projectId) : records
}

export function createQuote(input = {}, actor = {}) {
  const quote = createQuoteRecord({
    ...input,
    status: 'draft',
    enterpriseId: input.enterpriseId || actor.enterpriseId,
    userId: input.userId || actor.userId,
    createdBy: input.createdBy || actor.userId
  })
  if (quote) {
    auditQuote('create', quote, actor)
    logQuoteAction({ entityId: quote.quoteId, action: 'create', success: true })
  } else {
    logQuoteAction({ action: 'create', success: false, errorCode: 'create_failed' })
  }
  return quote
}

export function transitionQuote(quoteId = '', status = 'draft', actor = {}) {
  if (!quoteId || !QUOTE_STATUS_FLOW.includes(status)) {
    logQuoteAction({ entityId: quoteId, action: status, success: false, errorCode: 'invalid_status' })
    return null
  }
  const previous = getQuoteById(quoteId)
  if (!previous) {
    logQuoteAction({ entityId: quoteId, action: status, success: false, errorCode: 'not_found' })
    return null
  }
  const quote = updateQuote(quoteId, { status, updatedBy: actor.userId })
  if (!quote) {
    logQuoteAction({ entityId: quoteId, action: status, success: false, errorCode: 'update_failed' })
    return null
  }

  if (previous.status !== status) {
    auditQuote(status, quote, actor, previous)
  }
  if (status === 'confirmed' && previous.status !== 'confirmed') {
    emit(QUOTE_CONFIRMED, { quote, actor, before: previous, after: quote })
  }
  logQuoteAction({ entityId: quote.quoteId, action: status, success: true })
  return quote
}

export function sendQuote(quoteId = '', actor = {}) {
  return transitionQuote(quoteId, 'sent', actor)
}

export function confirmQuote(quoteId = '', actor = {}) {
  return transitionQuote(quoteId, 'confirmed', actor)
}

export function rejectQuote(quoteId = '', actor = {}) {
  return transitionQuote(quoteId, 'rejected', actor)
}

export function getQuote(quoteId = '') {
  return getQuoteById(quoteId)
}
