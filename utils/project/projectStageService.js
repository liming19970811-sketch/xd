import { getCurrentMember, getCurrentUser } from '../auth/authRepository.js'
import { getCurrentSession } from '../auth/authSessionService.js'
import { canAccessProject, requirePermission } from '../enterprise-web/enterpriseWebGuard.js'
import { PERMISSION_KEYS } from '../permission/permissionCatalog.js'
import { getById as getProjectById, update as updateProject } from '../repository/projectRepository.js'
import { getCurrentEnterpriseId } from '../tenant/tenantContext.js'
import { canAccessTenantData } from '../tenant/tenantGuard.js'
import { createStageHistory, listStageHistory } from './projectStageHistoryRepository.js'
import { getProjectStage, getProjectStageLabel, getProjectStages, normalizeProjectStage } from './projectStage.js'
import { callEnterpriseProject } from './enterpriseProjectTransport.js'

const STAGE_STATUS_MAP = Object.freeze({
  draft: 'draft',
  design: 'planning',
  production: 'in_progress',
  review: 'reviewing',
  delivery: 'in_progress',
  completed: 'completed'
})

function buildResult(success, payload = {}) {
  return {
    success,
    ok: success,
    ...payload
  }
}

function logStageChange(payload = {}) {
  if (typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'production') return
  console.log('[project:stage]', {
    hasProjectId: Boolean(payload.projectId),
    fromStage: payload.fromStage || '',
    toStage: payload.toStage || '',
    success: Boolean(payload.success),
    errorCode: payload.errorCode || ''
  })
}

function isLocalMockSession() {
  const session = getCurrentSession()
  return !session || session.authSource === 'local_mock'
}

function normalizeCloudHistory(record = {}) {
  const fromStage = normalizeProjectStage(record.fromStage)
  const toStage = normalizeProjectStage(record.toStage)
  return {
    ...record,
    fromStage,
    toStage,
    fromStageLabel: getProjectStageLabel(fromStage),
    toStageLabel: getProjectStageLabel(toStage)
  }
}

export function getNextStage(currentStage = '') {
  const stages = getProjectStages()
  const current = getProjectStage(currentStage)
  return stages.find((item) => item.index === current.index + 1) || null
}

export async function getStageHistory(projectId = '') {
  const viewGuard = requirePermission(PERMISSION_KEYS.PROJECT_VIEW)
  if (!viewGuard.allowed) return []
  if (isLocalMockSession()) return listStageHistory(projectId).map(normalizeCloudHistory)
  const result = await callEnterpriseProject('getProjectStageHistory', { projectId })
  if (!result || !result.success) {
    throw Object.assign(new Error(result?.message || '阶段历史加载失败'), {
      errorCode: result?.errorCode || 'cloud_call_failed'
    })
  }
  return ((result.data && result.data.history) || []).map(normalizeCloudHistory)
}

function advanceProjectStageLocal(projectId = '', nextStage = '') {
  const normalizedProjectId = String(projectId || '').trim()
  const manageGuard = requirePermission(PERMISSION_KEYS.PROJECT_MANAGE)
  if (!manageGuard.allowed) {
    logStageChange({ projectId: normalizedProjectId, toStage: nextStage, success: false, errorCode: manageGuard.reason || 'permission_denied' })
    return buildResult(false, { errorCode: manageGuard.reason || 'permission_denied', message: '\u65e0\u6743\u9650\u63a8\u8fdb\u9879\u76ee\u9636\u6bb5' })
  }

  const project = getProjectById(normalizedProjectId)
  if (!project) {
    logStageChange({ projectId: normalizedProjectId, toStage: nextStage, success: false, errorCode: 'not_found' })
    return buildResult(false, { errorCode: 'not_found', message: '\u9879\u76ee\u4e0d\u5b58\u5728' })
  }

  if (project.enterpriseId && !canAccessTenantData(project, getCurrentEnterpriseId())) {
    logStageChange({ projectId: normalizedProjectId, toStage: nextStage, success: false, errorCode: 'tenant_denied' })
    return buildResult(false, { errorCode: 'tenant_denied', message: '\u5df2\u62d2\u7edd\u8de8\u4f01\u4e1a\u9879\u76ee\u64cd\u4f5c' })
  }

  const projectGuard = canAccessProject(project)
  if (!projectGuard.allowed) {
    logStageChange({ projectId: normalizedProjectId, toStage: nextStage, success: false, errorCode: projectGuard.reason || 'project_permission_denied' })
    return buildResult(false, { errorCode: projectGuard.reason || 'project_permission_denied', message: '\u65e0\u6743\u9650\u8bbf\u95ee\u8be5\u9879\u76ee' })
  }

  const fromStage = normalizeProjectStage(project.stage || project.status)
  const expectedNext = getNextStage(fromStage)
  const targetStage = normalizeProjectStage(nextStage || (expectedNext && expectedNext.key))

  if (!expectedNext) {
    logStageChange({ projectId: normalizedProjectId, fromStage, toStage: targetStage, success: false, errorCode: 'already_completed' })
    return buildResult(false, { errorCode: 'already_completed', message: '\u9879\u76ee\u5df2\u5b8c\u6210' })
  }

  if (targetStage !== expectedNext.key) {
    logStageChange({ projectId: normalizedProjectId, fromStage, toStage: targetStage, success: false, errorCode: 'invalid_stage_transition' })
    return buildResult(false, { errorCode: 'invalid_stage_transition', message: '\u9879\u76ee\u9636\u6bb5\u53ea\u80fd\u6309\u987a\u5e8f\u63a8\u8fdb' })
  }

  const member = getCurrentMember()
  const user = getCurrentUser()
  const updatedProject = updateProject(normalizedProjectId, {
    stage: targetStage,
    status: STAGE_STATUS_MAP[targetStage],
    stageUpdatedAt: new Date().toISOString()
  })

  if (!updatedProject) {
    logStageChange({ projectId: normalizedProjectId, fromStage, toStage: targetStage, success: false, errorCode: 'update_failed' })
    return buildResult(false, { errorCode: 'update_failed', message: '\u9879\u76ee\u9636\u6bb5\u66f4\u65b0\u5931\u8d25' })
  }

  const history = createStageHistory({
    projectId: normalizedProjectId,
    fromStage,
    toStage: targetStage,
    operatorMemberId: member.memberId || '',
    operatorName: user.name || member.name || ''
  })

  logStageChange({ projectId: normalizedProjectId, fromStage, toStage: targetStage, success: true })
  return buildResult(true, {
    project: updatedProject,
    history,
    fromStage,
    toStage: targetStage,
    fromStageLabel: getProjectStageLabel(fromStage),
    toStageLabel: getProjectStageLabel(targetStage)
  })
}

export async function advanceProjectStage(projectId = '', nextStage = '', options = {}) {
  if (isLocalMockSession()) return advanceProjectStageLocal(projectId, nextStage)
  const result = await callEnterpriseProject('advanceProjectStage', {
    projectId,
    nextStage,
    expectedStage: options.expectedStage,
    expectedVersion: options.expectedVersion,
    idempotencyKey: options.idempotencyKey,
    reason: options.reason
  })
  if (!result || !result.success) {
    logStageChange({ projectId, toStage: nextStage, success: false, errorCode: result && result.errorCode })
    return buildResult(false, {
      errorCode: result?.errorCode || 'cloud_call_failed',
      message: result?.message || '\u9636\u6bb5\u63a8\u8fdb\u5931\u8d25'
    })
  }
  const history = normalizeCloudHistory(result.data && result.data.history)
  const project = result.data && result.data.project
  logStageChange({ projectId, fromStage: history.fromStage, toStage: history.toStage, success: true })
  return buildResult(true, {
    project,
    history,
    fromStage: history.fromStage,
    toStage: history.toStage,
    fromStageLabel: history.fromStageLabel,
    toStageLabel: history.toStageLabel
  })
}
