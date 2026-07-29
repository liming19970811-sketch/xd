import { createProject, getProjects, updateProject } from '../project/projectRepository.js'
import { getCurrentMember } from '../auth/authRepository.js'
import { getCurrentEnterpriseId } from '../tenant/tenantContext.js'

const PROJECT_META_KEY = 'diebians_workspace_project_center_meta_v1'
const PROJECT_STATUS_HISTORY_KEY = 'diebians_workspace_project_status_history_v1'

export const WORKSPACE_PROJECT_STATUSES = Object.freeze([
  { key: 'draft', label: '草稿' },
  { key: 'active', label: '进行中' },
  { key: 'reviewing', label: '待审核' },
  { key: 'delivering', label: '待交付' },
  { key: 'completed', label: '已完成' },
  { key: 'archived', label: '已归档' }
])

function nowIso() {
  return new Date().toISOString()
}

function currentEnterpriseId() {
  return String(getCurrentEnterpriseId() || 'local_enterprise')
}

function currentMember() {
  return getCurrentMember() || {}
}

function readStore(key = '') {
  try {
    const value = uni.getStorageSync(key)
    return Array.isArray(value) ? value : []
  } catch (error) {
    return []
  }
}

function writeStore(key = '', value = []) {
  try {
    uni.setStorageSync(key, Array.isArray(value) ? value : [])
  } catch (error) {}
}

function normalizeStatus(status = '') {
  const legacyMap = {
    requirement_confirmation: 'draft',
    designing: 'active',
    generating: 'active',
    pending_review: 'reviewing',
    delivered: 'completed'
  }
  const normalized = legacyMap[status] || status || 'draft'
  return WORKSPACE_PROJECT_STATUSES.some((item) => item.key === normalized) ? normalized : 'draft'
}

function normalizeMeta(meta = {}) {
  return {
    projectId: String(meta.projectId || ''),
    enterpriseId: String(meta.enterpriseId || currentEnterpriseId()),
    businessType: String(meta.businessType || '电商上新'),
    projectGoal: String(meta.projectGoal || '完成商业视觉资产'),
    ownerName: String(meta.ownerName || ''),
    ownerMemberId: String(meta.ownerMemberId || ''),
    members: Array.isArray(meta.members) ? meta.members : [],
    modules: Array.isArray(meta.modules) ? meta.modules : [],
    status: normalizeStatus(meta.status),
    linkedTaskIds: Array.isArray(meta.linkedTaskIds) ? meta.linkedTaskIds : [],
    linkedPatternIds: Array.isArray(meta.linkedPatternIds) ? meta.linkedPatternIds : [],
    linkedAssetIds: Array.isArray(meta.linkedAssetIds) ? meta.linkedAssetIds : [],
    deliveryBatchIds: Array.isArray(meta.deliveryBatchIds) ? meta.deliveryBatchIds : [],
    auditRecords: Array.isArray(meta.auditRecords) ? meta.auditRecords : [],
    activity: Array.isArray(meta.activity) ? meta.activity : [],
    archived: Boolean(meta.archived),
    createdAt: meta.createdAt || nowIso(),
    updatedAt: meta.updatedAt || meta.createdAt || nowIso()
  }
}

function readMetaList() {
  const enterpriseId = currentEnterpriseId()
  return readStore(PROJECT_META_KEY).map(normalizeMeta).filter((item) => item.enterpriseId === enterpriseId)
}

function writeMetaList(nextMeta = []) {
  const enterpriseId = currentEnterpriseId()
  const otherEnterpriseMeta = readStore(PROJECT_META_KEY).map(normalizeMeta).filter((item) => item.enterpriseId !== enterpriseId)
  writeStore(PROJECT_META_KEY, [...nextMeta.map(normalizeMeta), ...otherEnterpriseMeta])
}

function ensureMeta(project = {}) {
  const member = currentMember()
  const metaList = readMetaList()
  const existing = metaList.find((item) => item.projectId === project.projectId)
  if (existing) return existing
  const meta = normalizeMeta({
    projectId: project.projectId,
    enterpriseId: currentEnterpriseId(),
    status: normalizeStatus(project.status),
    ownerName: project.ownerName || member.name || '未设置',
    ownerMemberId: member.memberId || '',
    members: member.memberId ? [{ memberId: member.memberId, name: member.name || '当前用户', role: '项目负责人' }] : [],
    modules: [],
    linkedTaskIds: project.taskIds || [],
    linkedAssetIds: project.assetIds || [],
    createdAt: project.createdAt,
    updatedAt: project.updatedAt
  })
  writeMetaList([meta, ...metaList])
  return meta
}

function writeHistory(record = {}) {
  const history = readStore(PROJECT_STATUS_HISTORY_KEY)
  writeStore(PROJECT_STATUS_HISTORY_KEY, [{
    historyId: `project_status_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    enterpriseId: currentEnterpriseId(),
    projectId: record.projectId || '',
    operatorMemberId: record.operatorMemberId || '',
    operatorName: record.operatorName || '',
    fromStatus: record.fromStatus || '',
    toStatus: record.toStatus || '',
    note: record.note || '',
    createdAt: nowIso()
  }, ...history])
}

function mergeProject(project = {}, meta = {}) {
  return {
    ...project,
    ...meta,
    name: project.projectName || project.name || '未命名项目',
    customerName: project.customerName || '未设置客户',
    deadline: project.deadline || '',
    updatedAt: meta.updatedAt || project.updatedAt,
    createdAt: project.createdAt || meta.createdAt
  }
}

export function listWorkspaceProjects() {
  const metaList = readMetaList()
  return getProjects()
    .map((project) => mergeProject(project, ensureMeta(project)))
    .filter((project) => project.enterpriseId === currentEnterpriseId())
    .sort((left, right) => String(right.updatedAt).localeCompare(String(left.updatedAt)))
}

export function getWorkspaceProject(projectId = '') {
  return listWorkspaceProjects().find((project) => project.projectId === projectId) || null
}

export function createWorkspaceProject(input = {}) {
  const member = currentMember()
  const project = createProject({
    projectName: input.projectName,
    customerName: input.customerName,
    description: input.projectGoal,
    deadline: input.deadline,
    status: 'requirement_confirmation'
  })
  const now = nowIso()
  const meta = normalizeMeta({
    projectId: project.projectId,
    enterpriseId: currentEnterpriseId(),
    businessType: input.businessType,
    projectGoal: input.projectGoal,
    ownerName: input.ownerName || member.name || '未设置',
    ownerMemberId: input.ownerMemberId || member.memberId || '',
    members: input.members || [],
    modules: input.modules || [],
    status: 'draft',
    createdAt: now,
    updatedAt: now
  })
  writeMetaList([meta, ...readMetaList().filter((item) => item.projectId !== project.projectId)])
  writeHistory({
    projectId: project.projectId,
    operatorMemberId: member.memberId || '',
    operatorName: member.name || '当前用户',
    fromStatus: '',
    toStatus: 'draft',
    note: '创建项目'
  })
  console.info('[workspace:project]', { action: 'create', projectId: project.projectId, success: true })
  return mergeProject(project, meta)
}

export function changeWorkspaceProjectStatus(projectId = '', nextStatus = 'active', note = '') {
  const metaList = readMetaList()
  const meta = metaList.find((item) => item.projectId === projectId)
  if (!meta) return { ok: false, errorCode: 'project_not_found' }
  const member = currentMember()
  const normalizedNext = normalizeStatus(nextStatus)
  const now = nowIso()
  const nextMeta = normalizeMeta({
    ...meta,
    status: normalizedNext,
    archived: normalizedNext === 'archived',
    activity: [{
      action: 'status_change',
      operatorName: member.name || '当前用户',
      fromStatus: meta.status,
      toStatus: normalizedNext,
      note,
      createdAt: now
    }, ...meta.activity],
    updatedAt: now
  })
  writeMetaList(metaList.map((item) => item.projectId === projectId ? nextMeta : item))
  writeHistory({
    projectId,
    operatorMemberId: member.memberId || '',
    operatorName: member.name || '当前用户',
    fromStatus: meta.status,
    toStatus: normalizedNext,
    note
  })
  updateProject(projectId, { status: normalizedNext === 'completed' ? 'delivered' : 'requirement_confirmation' })
  console.info('[workspace:project]', { action: 'status', projectId, status: normalizedNext, success: true })
  return { ok: true, project: getWorkspaceProject(projectId) }
}

export function linkTaskToWorkspaceProject(projectId = '', task = {}) {
  const metaList = readMetaList()
  const meta = metaList.find((item) => item.projectId === projectId)
  if (!meta || !task.taskId) return { ok: false, errorCode: 'link_failed' }
  const now = nowIso()
  const linkedTask = {
    taskId: task.taskId,
    projectId,
    enterpriseId: currentEnterpriseId(),
    creatorId: (currentMember() || {}).memberId || '',
    taskType: task.type || task.taskType || 'ai_output',
    batchId: task.batchId || '',
    assetIds: Array.isArray(task.assetIds) ? task.assetIds : [],
    source: 'existing_task_reference',
    createdAt: now
  }
  const nextMeta = normalizeMeta({
    ...meta,
    linkedTaskIds: [...new Set([...meta.linkedTaskIds, task.taskId])],
    activity: [{
      action: 'link_task',
      operatorName: (currentMember() || {}).name || '当前用户',
      targetId: task.taskId,
      createdAt: now
    }, ...meta.activity],
    updatedAt: now
  })
  writeMetaList(metaList.map((item) => item.projectId === projectId ? nextMeta : item))
  console.info('[workspace:project]', { action: 'link_task', projectId, taskId: task.taskId, success: true })
  return { ok: true, linkedTask }
}

export function linkPatternToWorkspaceProject(projectId = '', patternMasterId = '') {
  const metaList = readMetaList()
  const meta = metaList.find((item) => item.projectId === projectId)
  if (!meta || !patternMasterId) return { ok: false, errorCode: 'link_failed' }
  const now = nowIso()
  const nextMeta = normalizeMeta({
    ...meta,
    linkedPatternIds: [...new Set([...meta.linkedPatternIds, patternMasterId])],
    activity: [{
      action: 'link_pattern',
      operatorName: (currentMember() || {}).name || '当前用户',
      targetId: patternMasterId,
      createdAt: now
    }, ...meta.activity],
    updatedAt: now
  })
  writeMetaList(metaList.map((item) => item.projectId === projectId ? nextMeta : item))
  console.info('[workspace:project]', { action: 'link_pattern', projectId, patternMasterId, success: true })
  return { ok: true }
}

export function createWorkspaceDeliveryBatch(projectId = '') {
  const metaList = readMetaList()
  const meta = metaList.find((item) => item.projectId === projectId)
  if (!meta) return { ok: false, errorCode: 'project_not_found' }
  const deliveryBatchId = `delivery_batch_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  const now = nowIso()
  const nextMeta = normalizeMeta({
    ...meta,
    status: meta.status === 'completed' ? meta.status : 'delivering',
    deliveryBatchIds: [...meta.deliveryBatchIds, deliveryBatchId],
    activity: [{
      action: 'create_delivery_batch',
      operatorName: (currentMember() || {}).name || '当前用户',
      targetId: deliveryBatchId,
      createdAt: now
    }, ...meta.activity],
    updatedAt: now
  })
  writeMetaList(metaList.map((item) => item.projectId === projectId ? nextMeta : item))
  writeHistory({
    projectId,
    operatorMemberId: (currentMember() || {}).memberId || '',
    operatorName: (currentMember() || {}).name || '当前用户',
    fromStatus: meta.status,
    toStatus: nextMeta.status,
    note: '创建交付批次'
  })
  console.info('[workspace:project]', { action: 'delivery_batch', projectId, deliveryBatchId, success: true })
  return { ok: true, deliveryBatchId }
}

export function listWorkspaceProjectStatusHistory(projectId = '') {
  return readStore(PROJECT_STATUS_HISTORY_KEY)
    .filter((item) => item.enterpriseId === currentEnterpriseId() && (!projectId || item.projectId === projectId))
    .sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt)))
}
