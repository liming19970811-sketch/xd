import { getWorkspacePlanHistories } from './workspacePlanHistory'
import { getWorkspaceProductions } from './workspaceProduction'

function rankItems(items = [], keyGetter, labelGetter) {
  const counts = items.reduce((result, item) => {
    const key = String(keyGetter(item) || '').trim()
    if (!key) return result
    if (!result[key]) {
      result[key] = {
        key,
        name: String(labelGetter(item) || key),
        count: 0
      }
    }
    result[key].count += 1
    return result
  }, {})

  return Object.values(counts).sort((left, right) => (
    right.count - left.count || left.name.localeCompare(right.name, 'zh-CN')
  ))
}

function normalizeUserRecords(userId, productions, histories) {
  if (!userId) return productions
  const historyIds = new Set(histories
    .filter((history) => history.userId === userId)
    .map((history) => history.historyId))
  return productions.filter((production) => historyIds.has(production.historyId))
}

function createAnalyticsId(userId = '') {
  const value = String(userId || 'local')
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return `workspace_analytics_${(hash >>> 0).toString(36)}`
}

export function calculateWorkspaceProductionAnalytics(input = {}) {
  const userId = String(input.userId || '')
  const productions = Array.isArray(input.productions) ? input.productions : []
  const histories = Array.isArray(input.histories) ? input.histories : []
  const records = normalizeUserRecords(userId, productions, histories)
  const completedCount = records.filter((item) => item.status === 'completed').length
  const failedCount = records.filter((item) => item.status === 'failed').length
  const terminalCount = completedCount + failedCount
  const popularPlans = rankItems(
    records,
    (item) => item.planId,
    (item) => item.planName || '智能生产方案'
  ).map((item) => ({
    planId: item.key,
    name: item.name,
    count: item.count
  }))
  const actions = records.reduce((result, record) => (
    result.concat((Array.isArray(record.actions) ? record.actions : []).map((action) => ({
      action: action.action || action.label,
      label: action.label || action.action
    })))
  ), [])
  const popularActions = rankItems(
    actions,
    (item) => item.action,
    (item) => item.label
  ).map((item) => ({
    action: item.key,
    name: item.name,
    count: item.count
  }))

  return {
    analyticsId: createAnalyticsId(userId),
    userId,
    totalProduction: records.length,
    completedCount,
    failedCount,
    successRate: terminalCount ? Number(((completedCount / terminalCount) * 100).toFixed(1)) : 0,
    popularPlans,
    popularActions,
    updatedAt: new Date().toISOString()
  }
}

export function getWorkspaceProductionAnalytics(userId = '') {
  const analytics = calculateWorkspaceProductionAnalytics({
    userId,
    productions: getWorkspaceProductions(),
    histories: getWorkspacePlanHistories()
  })
  console.log('[workspace:analytics]', {
    analyticsId: analytics.analyticsId
  })
  return analytics
}
