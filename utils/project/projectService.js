import { getCurrentSession } from '../auth/authSessionService.js'
import { create as createLocalProject, getById as getLocalProjectById, getList as getLocalProjects, update as updateLocalProject } from '../repository/projectRepository.js'
import { callEnterpriseProject } from './enterpriseProjectTransport.js'
import { normalizeProjectStage } from './projectStage.js'

function isLocalMockSession() {
  const session = getCurrentSession()
  return !session || session.authSource === 'local_mock'
}

function buildError(result = {}, fallback = '项目操作失败') {
  return Object.assign(new Error(result.message || fallback), {
    errorCode: result.errorCode || 'cloud_call_failed'
  })
}

function normalizeProject(record = {}) {
  const stage = normalizeProjectStage(record.stage || record.status)
  const name = record.name || record.projectName || record.title || '未命名项目'
  return {
    ...record,
    projectId: record.projectId || '',
    name,
    projectName: name,
    stage,
    status: record.status || stage,
    customerName: record.customerName || record.clientName || '',
    ownerName: record.ownerName || record.owner || record.managerName || '',
    version: Number(record.version || 0)
  }
}

export async function getProjects(filters = {}) {
  if (isLocalMockSession()) {
    return {
      success: true,
      projects: getLocalProjects().map(normalizeProject),
      source: 'local_mock'
    }
  }
  const result = await callEnterpriseProject('getProjectList', { filters })
  if (!result || !result.success) throw buildError(result, '项目列表加载失败')
  return {
    success: true,
    projects: ((result.data && result.data.projects) || []).map(normalizeProject),
    source: 'cloud'
  }
}

export async function getProjectDetail(projectId = '') {
  if (isLocalMockSession()) {
    const project = getLocalProjectById(projectId)
    return project
      ? { success: true, project: normalizeProject(project), source: 'local_mock' }
      : { success: false, errorCode: 'PROJECT_NOT_FOUND', message: '项目不存在', source: 'local_mock' }
  }
  const result = await callEnterpriseProject('getProjectDetail', { projectId })
  if (!result || !result.success) return { success: false, errorCode: result?.errorCode || 'cloud_call_failed', message: result?.message || '项目详情加载失败' }
  return {
    success: true,
    project: normalizeProject(result.data && result.data.project),
    source: 'cloud'
  }
}

export async function createProject(payload = {}) {
  if (isLocalMockSession()) {
    const project = createLocalProject(payload)
    return project
      ? { success: true, project: normalizeProject(project), source: 'local_mock' }
      : { success: false, errorCode: 'create_failed', message: '项目创建失败', source: 'local_mock' }
  }
  const result = await callEnterpriseProject('createProject', payload)
  if (!result || !result.success) return { success: false, errorCode: result?.errorCode || 'cloud_call_failed', message: result?.message || '项目创建失败' }
  return { success: true, project: normalizeProject(result.data && result.data.project), source: 'cloud' }
}

export async function updateProject(projectId = '', patch = {}, expectedVersion = 0) {
  if (isLocalMockSession()) {
    const project = updateLocalProject(projectId, patch)
    return project
      ? { success: true, project: normalizeProject(project), source: 'local_mock' }
      : { success: false, errorCode: 'PROJECT_NOT_FOUND', message: '项目不存在', source: 'local_mock' }
  }
  const result = await callEnterpriseProject('updateProject', { projectId, patch, expectedVersion })
  if (!result || !result.success) return { success: false, errorCode: result?.errorCode || 'cloud_call_failed', message: result?.message || '项目更新失败' }
  return { success: true, project: normalizeProject(result.data && result.data.project), source: 'cloud' }
}

export async function deleteProject(projectId = '', expectedVersion = 0) {
  if (isLocalMockSession()) {
    const project = updateLocalProject(projectId, { status: 'deleted', deletedAt: new Date().toISOString() })
    return project
      ? { success: true, project: normalizeProject(project), source: 'local_mock' }
      : { success: false, errorCode: 'PROJECT_NOT_FOUND', message: '项目不存在', source: 'local_mock' }
  }
  const result = await callEnterpriseProject('deleteProject', { projectId, expectedVersion })
  if (!result || !result.success) return { success: false, errorCode: result?.errorCode || 'cloud_call_failed', message: result?.message || '项目删除失败' }
  return { success: true, project: normalizeProject(result.data && result.data.project), source: 'cloud' }
}
