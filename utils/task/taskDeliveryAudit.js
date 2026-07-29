import { getMainChainState, patchMainChainState } from '../mainChainState'

const MAX_DELIVERY_AUDITS = 600

function buildAuditId(action, taskId) {
  const randomPart = Math.random().toString(36).slice(2, 8)
  return `${action || 'audit'}_${taskId || 'na'}_${Date.now()}_${randomPart}`
}

function normalizeAudit(audit = {}) {
  return {
    auditId: audit.auditId || buildAuditId(audit.action, audit.taskId),
    taskId: audit.taskId || '',
    action: audit.action || '',
    note: audit.note || '',
    createdAt: audit.createdAt || new Date().toISOString(),
    batchId: audit.batchId || '',
    projectId: audit.projectId || ''
  }
}

function getAuditListFromState(state) {
  return Array.isArray(state && state.deliveryAudits) ? state.deliveryAudits : []
}

export function createDeliveryAudit(action, taskId, note = '', extras = {}) {
  return normalizeAudit({
    action,
    taskId,
    note,
    ...extras
  })
}

export function appendDeliveryAudit(audit) {
  const state = getMainChainState()
  const currentAudits = getAuditListFromState(state)
  const nextAudit = normalizeAudit(audit || {})
  const nextAudits = [nextAudit, ...currentAudits].slice(0, MAX_DELIVERY_AUDITS)
  patchMainChainState({
    deliveryAudits: nextAudits
  })
  return nextAudit
}

export function appendDeliveryAudits(audits = []) {
  const state = getMainChainState()
  const currentAudits = getAuditListFromState(state)
  const normalized = Array.isArray(audits) ? audits.map((audit) => normalizeAudit(audit)) : []
  if (!normalized.length) {
    return []
  }

  const nextAudits = [...normalized, ...currentAudits].slice(0, MAX_DELIVERY_AUDITS)
  patchMainChainState({
    deliveryAudits: nextAudits
  })
  return normalized
}

export function getTaskDeliveryAudits(taskId, limit = 10) {
  if (!taskId) {
    return []
  }
  const state = getMainChainState()
  const audits = getAuditListFromState(state)
  return audits
    .filter((audit) => audit && audit.taskId === taskId)
    .slice(0, Math.max(1, limit))
}

export function getDeliveryAuditsByTaskIds(taskIds = [], limit = 20) {
  if (!Array.isArray(taskIds) || !taskIds.length) {
    return []
  }

  const taskIdSet = new Set(taskIds.filter(Boolean))
  const state = getMainChainState()
  const audits = getAuditListFromState(state)
  return audits
    .filter((audit) => audit && taskIdSet.has(audit.taskId))
    .slice(0, Math.max(1, limit))
}

