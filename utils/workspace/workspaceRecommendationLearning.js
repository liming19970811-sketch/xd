import { getWorkspaceContexts } from './workspaceContext'
import { getWorkspacePlanHistories } from './workspacePlanHistory'
import { getWorkspaceProductions } from './workspaceProduction'
import { getWorkspaceProductionAnalytics } from './workspaceProductionAnalytics'
import { getWorkspaceRecommendations } from './workspaceRecommendation'

const ENTRY_ACTION_MAP = Object.freeze({
  model: 'model_replace',
  color: 'color_replace',
  pattern: 'pattern_replace',
  scene: 'scene_replace',
  refine: 'design_template',
  ecommerce: 'detail_asset',
  social: 'marketing_asset',
  batch: 'batch_generate'
})

function createStableId(value = '') {
  let hash = 2166136261
  const text = String(value || '')
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(36)
}

function resolveGuideId(value = '', guideIds = []) {
  const source = String(value || '')
  return guideIds.find((guideId) => source.includes(guideId)) || ''
}

function createLearningRecord(input = {}) {
  const usageCount = Math.max(0, Number(input.usageCount) || 0)
  const successRate = Math.max(0, Math.min(100, Number(input.successRate) || 0))
  const weight = Number((usageCount * 10 + successRate * 0.5 + Number(input.bonus || 0)).toFixed(1))
  return {
    learningId: `workspace_learning_${createStableId(`${input.userId}:${input.sourceType}:${input.sourceId}`)}`,
    userId: String(input.userId || ''),
    sourceType: String(input.sourceType || ''),
    sourceId: String(input.sourceId || ''),
    usageCount,
    successRate,
    weight,
    updatedAt: new Date().toISOString()
  }
}

function getSuccessRate(records = [], fallback = 0) {
  const completed = records.filter((item) => item.status === 'completed').length
  const failed = records.filter((item) => item.status === 'failed').length
  const terminal = completed + failed
  return terminal ? Number(((completed / terminal) * 100).toFixed(1)) : fallback
}

function getUserProductions(userId, productions, histories) {
  if (!userId) return productions
  const historyIds = new Set(histories
    .filter((history) => history.userId === userId)
    .map((history) => history.historyId))
  return productions.filter((production) => historyIds.has(production.historyId))
}

export function calculateWorkspaceRecommendationLearning(input = {}) {
  const userId = String(input.userId || '')
  const recommendations = Array.isArray(input.recommendations) ? input.recommendations : []
  const histories = Array.isArray(input.histories) ? input.histories : []
  const productions = Array.isArray(input.productions) ? input.productions : []
  const contexts = Array.isArray(input.contexts) ? input.contexts : []
  const analytics = input.analytics || {}
  const guideIds = recommendations.map((item) => item.guideId).filter(Boolean)
  const userProductions = getUserProductions(userId, productions, histories)
  const fallbackSuccessRate = Number(analytics.successRate) || 0
  const records = []

  guideIds.forEach((guideId) => {
    const matches = userProductions.filter((item) => (
      item.guideId === guideId || resolveGuideId(item.planId, guideIds) === guideId
    ))
    if (!matches.length) return
    records.push(createLearningRecord({
      userId,
      sourceType: 'plan',
      sourceId: guideId,
      usageCount: matches.length,
      successRate: getSuccessRate(matches, fallbackSuccessRate)
    }))
  })

  const actionMap = userProductions.reduce((result, production) => {
    const actions = Array.isArray(production.actions) ? production.actions : []
    actions.forEach((action) => {
      const actionId = String(action.action || action.label || '')
      if (!actionId) return
      if (!result[actionId]) result[actionId] = []
      result[actionId].push(production)
    })
    return result
  }, {})

  Object.keys(actionMap).forEach((actionId) => {
    const analyticsAction = (analytics.popularActions || []).find((item) => item.action === actionId)
    const matches = actionMap[actionId]
    records.push(createLearningRecord({
      userId,
      sourceType: 'action',
      sourceId: actionId,
      usageCount: Math.max(matches.length, Number(analyticsAction && analyticsAction.count) || 0),
      successRate: getSuccessRate(matches, fallbackSuccessRate)
    }))
  })

  const userContexts = contexts.filter((context) => !userId || context.userId === userId)
  const latestContext = userContexts[0]
  if (latestContext) {
    const contextGuideId = resolveGuideId(latestContext.planId || latestContext.lastPlanId, guideIds)
    const contextAction = ENTRY_ACTION_MAP[latestContext.entryType || latestContext.lastEntry]
    if (contextGuideId) {
      records.push(createLearningRecord({
        userId,
        sourceType: 'context',
        sourceId: contextGuideId,
        usageCount: 1,
        successRate: fallbackSuccessRate,
        bonus: 15
      }))
    }
    if (contextAction) {
      records.push(createLearningRecord({
        userId,
        sourceType: 'context_action',
        sourceId: contextAction,
        usageCount: 1,
        successRate: fallbackSuccessRate,
        bonus: 15
      }))
    }
  }

  return records.sort((left, right) => right.weight - left.weight || left.sourceId.localeCompare(right.sourceId))
}

export function applyWorkspaceRecommendationLearning(recommendations = [], learningRecords = []) {
  const learnedWeight = (sourceTypes, sourceId) => learningRecords
    .filter((record) => sourceTypes.includes(record.sourceType) && record.sourceId === sourceId)
    .reduce((total, record) => total + record.weight, 0)

  return recommendations.map((recommendation, originalIndex) => {
    const actions = (recommendation.recommendedActions || []).map((action, actionIndex) => ({
      ...action,
      _originalIndex: actionIndex,
      learningWeight: learnedWeight(['action', 'context_action'], action.action)
    })).sort((left, right) => (
      right.learningWeight - left.learningWeight || left._originalIndex - right._originalIndex
    )).map((action, index) => {
      const { _originalIndex, ...cleanAction } = action
      return {
        ...cleanAction,
        priority: index === 0,
        categoryHint: cleanAction.learningWeight > 0 && index === 0 ? '常用推荐' : cleanAction.categoryHint
      }
    })
    const actionWeight = actions.reduce((total, action) => total + action.learningWeight, 0)
    return {
      ...recommendation,
      recommendedActions: actions,
      learningWeight: learnedWeight(['plan', 'context'], recommendation.guideId) + actionWeight * 0.15,
      _originalIndex: originalIndex
    }
  }).sort((left, right) => (
    right.learningWeight - left.learningWeight || left._originalIndex - right._originalIndex
  )).map((recommendation => {
    const { _originalIndex, ...cleanRecommendation } = recommendation
    return cleanRecommendation
  }))
}

export function getWorkspaceRecommendationLearning(userId = '', inputType = '女装', sourceAnalytics = null) {
  const recommendations = getWorkspaceRecommendations(inputType)
  const analytics = sourceAnalytics || getWorkspaceProductionAnalytics(userId)
  const records = calculateWorkspaceRecommendationLearning({
    userId,
    recommendations,
    analytics,
    histories: getWorkspacePlanHistories(),
    productions: getWorkspaceProductions(),
    contexts: getWorkspaceContexts()
  })
  const learningId = `workspace_learning_${createStableId(`${userId}:summary`)}`
  console.log('[workspace:recommend-learning]', { learningId })
  return {
    learningId,
    records,
    recommendations: applyWorkspaceRecommendationLearning(recommendations, records)
  }
}
