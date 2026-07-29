import { createWorkspacePlan } from './workspacePlan'
import { saveWorkspaceContext } from './workspaceContext'
import { createWorkspacePlanVersion } from './workspacePlanVersion'

const STORAGE_KEY = 'diebiandesign_workspace_recommendation_apply'

function nowIso() {
  return new Date().toISOString()
}

function createApplyId() {
  return `workspace_recommend_apply_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
}

function readApplies() {
  try {
    const value = uni.getStorageSync(STORAGE_KEY)
    return Array.isArray(value) ? value : []
  } catch (error) {
    return []
  }
}

function writeApplies(applies = []) {
  try {
    uni.setStorageSync(STORAGE_KEY, applies)
  } catch (error) {}
  return applies
}

function normalizeApply(apply = {}) {
  return {
    applyId: String(apply.applyId || createApplyId()),
    recommendationId: String(apply.recommendationId || ''),
    planId: String(apply.planId || ''),
    contextId: String(apply.contextId || ''),
    createdAt: apply.createdAt || nowIso()
  }
}

function getRecommendationId(display = {}, guide = {}) {
  return display.recommendationId || guide.recommendationId || display.displayId || guide.guideId || ''
}

export function getWorkspaceRecommendationApplies() {
  return readApplies().map(normalizeApply)
}

export function applyWorkspaceRecommendation(input = {}) {
  const display = input.display || {}
  const guide = input.guide || display.guide || {}
  const primaryAction = input.primaryAction || display.primaryAction || null
  if (!guide.guideId || !primaryAction) return null

  const plan = createWorkspacePlan({
    recommendation: guide,
    category: input.category || guide.inputType || '',
    selectedAction: primaryAction
  })
  if (!plan || !plan.planId) return null

  const context = saveWorkspaceContext({
    ...(input.contextPatch || {}),
    title: plan.title,
    entryType: plan.entryType,
    planId: plan.planId,
    lastEntry: plan.entryType,
    lastPlanId: plan.planId
  })
  const version = createWorkspacePlanVersion(plan, '采用推荐方案 V1')
  const apply = normalizeApply({
    applyId: createApplyId(),
    recommendationId: getRecommendationId(display, guide),
    planId: plan.planId,
    contextId: context ? context.contextId : '',
    createdAt: nowIso()
  })
  writeApplies([apply, ...getWorkspaceRecommendationApplies()].slice(0, 50))
  return {
    apply,
    plan,
    context,
    version
  }
}
