import { getMainChainState } from '../mainChainState'
import {
  LEAD_FOLLOW_STATUS,
  ORDER_STATUS,
  ORDER_TYPE,
  PAY_CHANNEL,
  PAY_STATUS,
  PROJECT_STATUS,
  TASK_SOURCE,
  TASK_STATUS,
  TASK_TYPES
} from '../constants'
import { createLead, getLeadList, updateLeadStatus } from './leadStore'
import { createProject, createProjectFromLead, findProjectByLeadId, getProjectById, getProjectList, updateProject } from './projectStore'
import { getBatchById, getBatchList } from './batchStore'
import { getOrderList, updateOrder } from './orderStore'
import { getLeadByIdByCloud, getLeadListByCloud, updateLeadFollowStatusByCloud } from '../cloudbase/leadsRepository'
import { getBatchByIdByCloud, getBatchListByCloud, upsertBatchByCloud } from '../cloudbase/batchesRepository'
import {
  createProjectFromLeadByCloud,
  getLeadProjectByCloud,
  getProjectListByCloud,
  getProjectByIdByCloud,
  updateProjectByCloud
} from '../cloudbase/projectsRepository'
import { getTaskByIdByCloud, getTaskListByCloud } from '../cloudbase/tasksRepository'
import {
  canCreateOriginalProtectionPackage,
  createOriginalProtectionPackageDraft
} from '../constants/originalProtectionPackage'
import {
  canCreateRefineWorkOrder,
  createRefineWorkOrderDraft,
  REFINE_ORDER_STATUS
} from '../constants/refineWorkOrder'
import { getAiPointCost } from '../constants/aiPointCost'
import {
  getDefaultMembershipTier,
  getMembershipPermissions,
  MEMBERSHIP_PLAN_CONFIG
} from '../constants/membershipPlans'

const ADMIN_MOCK_TASKS_KEY = 'admin_mock_tasks'
const ORIGINAL_PROTECTION_PACKAGES_KEY = 'original_protection_packages'
const REFINE_WORK_ORDERS_KEY = 'refine_work_orders'
const MEMBERSHIP_USAGE_MOCK_KEY = 'membership_usage_mock'

export const PROJECT_ADMIN_STAGE_OPTIONS = Object.freeze([
  'requirement_confirmed',
  'quoted',
  'designing',
  'first_draft_ready',
  'revising',
  'final_delivery',
  'closed'
])

const LEGACY_PROJECT_STAGE_MAP = Object.freeze({
  discovery: 'requirement_confirmed',
  planning: 'quoted',
  execution: 'designing',
  review: 'revising',
  delivery: 'final_delivery',
  done: 'closed'
})

const DEFAULT_ADMIN_TASKS = [
  {
    taskId: 'task_admin_seed_001',
    taskType: TASK_TYPES.MODEL_REPLACE,
    taskSource: TASK_SOURCE.ADMIN,
    status: TASK_STATUS.SUCCESS,
    summary: 'Demo task for admin list',
    createdAt: '2026-04-20T07:40:00.000Z',
    updatedAt: '2026-04-20T07:42:00.000Z',
    input: {
      prompt: 'demo'
    },
    result: {
      imageUrl: 'demo-result.png'
    }
  }
]

const LEAD_FOLLOW_STATUS_OPTIONS = Object.values(LEAD_FOLLOW_STATUS)
const ORDER_STATUS_OPTIONS = Object.values(ORDER_STATUS)
const PAY_STATUS_OPTIONS = Object.values(PAY_STATUS)
const PROJECT_STATUS_OPTIONS = Object.values(PROJECT_STATUS)

function createSuccessResponse(data, message = 'ok') {
  return {
    code: 0,
    message,
    data
  }
}

function ensureMockTasks() {
  const cached = uni.getStorageSync(ADMIN_MOCK_TASKS_KEY)
  if (Array.isArray(cached) && cached.length) {
    return cached
  }

  uni.setStorageSync(ADMIN_MOCK_TASKS_KEY, DEFAULT_ADMIN_TASKS)
  return DEFAULT_ADMIN_TASKS
}

function buildTaskSummary(task) {
  if (task && task.summary) {
    return String(task.summary)
  }

  if (task && task.result && (task.result.imageUrl || task.result.resultImageUrl)) {
    return 'Result image ready'
  }

  if (task && task.input && task.input.prompt) {
    return `Prompt: ${task.input.prompt}`
  }

  return 'No summary yet'
}

function normalizeTaskStatus(status) {
  return Object.values(TASK_STATUS).includes(status) ? status : TASK_STATUS.PENDING
}

function normalizeTaskSource(source) {
  if (source === 'mini_program') {
    return TASK_SOURCE.MINIAPP
  }
  return Object.values(TASK_SOURCE).includes(source) ? source : TASK_SOURCE.ADMIN
}

function normalizeTask(task, isMock = false) {
  return {
    taskId: String(task && task.taskId ? task.taskId : `task_${Date.now()}`),
    taskType: task && task.taskType ? task.taskType : TASK_TYPES.MODEL_REPLACE,
    taskSource: normalizeTaskSource(task && task.taskSource),
    status: normalizeTaskStatus(task && task.status),
    input: task && task.input ? task.input : {},
    result: task && task.result ? task.result : {},
    summary: buildTaskSummary(task),
    createdAt: task && task.createdAt ? task.createdAt : new Date().toISOString(),
    updatedAt: task && task.updatedAt ? task.updatedAt : new Date().toISOString(),
    isMock
  }
}

function normalizeLeadFollowStatus(value) {
  return LEAD_FOLLOW_STATUS_OPTIONS.includes(value) ? value : LEAD_FOLLOW_STATUS.NEW
}

function normalizeLeadCreatePayload(payload = {}) {
  const source = payload.source || payload.sourceChannel || 'manual'
  const mobile = String(payload.mobile || payload.phone || '').trim()
  const expectedDeliveryDate = payload.expectedDeliveryDate || payload.expectedDeliveryTime || ''
  const requirementText = payload.requirementText || payload.description || ''
  const attachmentUrls = Array.isArray(payload.attachmentUrls) ? payload.attachmentUrls : []
  const attachmentFileIds = Array.isArray(payload.attachmentFileIds) ? payload.attachmentFileIds : []
  const attachments = Array.isArray(payload.attachments) ? payload.attachments : []
  const referenceImages = Array.isArray(payload.referenceImages) ? payload.referenceImages : attachmentUrls
  const followStatus = normalizeLeadFollowStatus(payload.followStatus || payload.status)

  return {
    ...payload,
    source,
    sourceChannel: payload.sourceChannel || source,
    sourcePage: payload.sourcePage || (source === 'miniapp' ? 'service-request' : source === 'website' ? 'website-demand' : 'admin'),
    contactName: payload.contactName || '',
    mobile,
    phone: mobile,
    wechat: payload.wechat || '',
    companyName: payload.companyName || '',
    demandType: payload.demandType || 'design_service',
    budgetRange: payload.budgetRange || '',
    expectedDeliveryDate,
    expectedDeliveryTime: expectedDeliveryDate,
    requirementText,
    description: requirementText,
    attachmentFileIds,
    attachmentUrls,
    attachments,
    privacyConfirmed: !!payload.privacyConfirmed,
    leadSnapshot: payload.leadSnapshot || null,
    possibleDuplicateLeadIds: Array.isArray(payload.possibleDuplicateLeadIds) ? payload.possibleDuplicateLeadIds : [],
    ownerName: payload.ownerName || '',
    nextFollowAt: payload.nextFollowAt || '',
    lastFollowContent: payload.lastFollowContent || '',
    referenceImages,
    followStatus,
    status: followStatus
  }
}

function normalizeLead(lead) {
  const followStatus = normalizeLeadFollowStatus(lead && (lead.followStatus || lead.status))
  const source = lead && lead.source ? lead.source : lead && lead.sourceChannel ? lead.sourceChannel : 'website'
  const mobile = String((lead && (lead.mobile || lead.phone)) || '').trim()
  const expectedDeliveryDate = lead && (lead.expectedDeliveryDate || lead.expectedDeliveryTime) ? lead.expectedDeliveryDate || lead.expectedDeliveryTime : ''
  const requirementText = lead && (lead.requirementText || lead.description) ? lead.requirementText || lead.description : ''
  const leadId = String((lead && (lead.leadId || lead._id || lead.id)) || '')
  return {
    ...lead,
    leadId,
    source,
    sourceChannel: lead && lead.sourceChannel ? lead.sourceChannel : source,
    mobile,
    phone: mobile,
    expectedDeliveryDate,
    expectedDeliveryTime: expectedDeliveryDate,
    requirementText,
    description: requirementText,
    attachmentFileIds: Array.isArray(lead && lead.attachmentFileIds) ? lead.attachmentFileIds : [],
    attachmentUrls: Array.isArray(lead && lead.attachmentUrls) ? lead.attachmentUrls : [],
    attachments: Array.isArray(lead && lead.attachments) ? lead.attachments : [],
    privacyConfirmed: !!(lead && lead.privacyConfirmed),
    leadSnapshot: lead && lead.leadSnapshot ? lead.leadSnapshot : null,
    possibleDuplicateLeadIds: Array.isArray(lead && lead.possibleDuplicateLeadIds) ? lead.possibleDuplicateLeadIds : [],
    ownerName: lead && lead.ownerName ? lead.ownerName : '',
    nextFollowAt: lead && lead.nextFollowAt ? lead.nextFollowAt : '',
    lastFollowContent: lead && lead.lastFollowContent ? lead.lastFollowContent : '',
    referenceImages: Array.isArray(lead && lead.referenceImages)
      ? lead.referenceImages
      : Array.isArray(lead && lead.attachmentUrls)
        ? lead.attachmentUrls
        : [],
    followStatus,
    status: followStatus
  }
}

function buildAdminLeadList(list, query = {}) {
  const page = Number(query.page || 1)
  const pageSize = Number(query.pageSize || list.length || 10)

  return {
    list,
    total: list.length,
    page,
    pageSize
  }
}

function buildAdminProjectList(list, query = {}) {
  const page = Number(query.page || 1)
  const pageSize = Number(query.pageSize || list.length || 10)

  return {
    list,
    total: list.length,
    page,
    pageSize
  }
}

function buildAdminOrderList(list, query = {}) {
  const page = Number(query.page || 1)
  const pageSize = Number(query.pageSize || list.length || 10)

  return {
    list,
    total: list.length,
    page,
    pageSize
  }
}

function buildAdminTaskList(list, query = {}) {
  const page = Number(query.page || 1)
  const pageSize = Number(query.pageSize || list.length || 10)

  return {
    list,
    total: list.length,
    page,
    pageSize
  }
}

function normalizeProjectStage(stage) {
  const normalized = String(stage || '').trim()
  if (PROJECT_ADMIN_STAGE_OPTIONS.includes(normalized)) {
    return normalized
  }
  if (LEGACY_PROJECT_STAGE_MAP[normalized]) {
    return LEGACY_PROJECT_STAGE_MAP[normalized]
  }
  return PROJECT_ADMIN_STAGE_OPTIONS[0]
}

function normalizeProject(project) {
  return {
    ...project,
    status: PROJECT_STATUS_OPTIONS.includes(project && project.status) ? project.status : PROJECT_STATUS.PENDING,
    stage: normalizeProjectStage(project && project.stage),
    rawStage: project && project.stage ? project.stage : ''
  }
}

function normalizeBatch(batch) {
  return {
    ...batch,
    batchId: String(batch && batch.batchId ? batch.batchId : `batch_${Date.now()}`),
    projectId: batch && batch.projectId ? batch.projectId : '',
    batchName: batch && batch.batchName ? batch.batchName : '',
    status: batch && batch.status ? batch.status : 'draft',
    taskIds: Array.isArray(batch && batch.taskIds) ? batch.taskIds : [],
    createdAt: batch && batch.createdAt ? batch.createdAt : new Date().toISOString(),
    updatedAt: batch && batch.updatedAt
      ? batch.updatedAt
      : batch && batch.createdAt
        ? batch.createdAt
        : new Date().toISOString(),
    startedAt: batch && batch.startedAt ? batch.startedAt : '',
    completedAt: batch && batch.completedAt ? batch.completedAt : ''
  }
}

function getTaskIdentity(task) {
  return String((task && (task.taskId || task.id || task.clientTaskId)) || '').trim()
}

function getTaskSnapshotField(task, field, fallback = '') {
  if (task && Object.prototype.hasOwnProperty.call(task, field) && task[field] !== undefined) {
    return task[field]
  }
  return fallback
}

function stripPreviousResultFromTaskSnapshot(task = {}) {
  if (!task || typeof task !== 'object') {
    return task
  }
  const nextTask = { ...task }
  delete nextTask.previousResult
  return nextTask
}

function normalizeBatchTaskSnapshot(task = {}) {
  const taskId = getTaskIdentity(task)
  if (!taskId) {
    return null
  }
  const snapshot = {
    taskId,
    clientTaskId: task.clientTaskId || taskId,
    batchId: task.batchId || '',
    status: task.status || TASK_STATUS.PENDING,
    stage: task.stage || '',
    progress: typeof task.progress === 'number' ? task.progress : 0,
    statusText: task.statusText || '',
    deliveryStatus: task.deliveryStatus || '',
    reviewStatus: task.reviewStatus || '',
    reviewedAt: getTaskSnapshotField(task, 'reviewedAt', ''),
    deliveryConfirmedAt: getTaskSnapshotField(task, 'deliveryConfirmedAt', ''),
    deliveryNote: getTaskSnapshotField(task, 'deliveryNote', ''),
    input: task.input || {},
    result: task.result || {},
    resultImageUrl: task.resultImageUrl || (task.result && task.result.coverUrl) || '',
    previousResultImageUrl: task.previousResultImageUrl || '',
    error: task.error || null,
    createdAt: task.createdAt || '',
    updatedAt: task.updatedAt || '',
    completedAt: task.completedAt || ''
  }
  return stripPreviousResultFromTaskSnapshot(snapshot)
}

function getBatchEmbeddedTaskList(batch = {}) {
  const candidates = [
    batch.tasks,
    batch.taskList,
    batch.items
  ]
  return candidates.reduce((list, item) => {
    if (Array.isArray(item)) {
      item.forEach((task) => {
        if (task && typeof task === 'object' && getTaskIdentity(task)) {
          list.push(task)
        }
      })
    }
    return list
  }, [])
}

function buildBatchTaskSnapshots(batch = {}) {
  const taskIds = Array.isArray(batch.taskIds) ? batch.taskIds.filter(Boolean) : []
  const state = getMainChainState()
  const byId = (state.tasks && state.tasks.byId) || {}
  const embeddedTasks = getBatchEmbeddedTaskList(batch)
  const snapshots = []
  const missingTaskIds = []

  taskIds.forEach((taskId) => {
    const task =
      byId[taskId] ||
      embeddedTasks.find((item) => getTaskIdentity(item) === String(taskId))
    const snapshot = normalizeBatchTaskSnapshot(task)
    if (snapshot) {
      snapshots.push(snapshot)
    } else {
      missingTaskIds.push(taskId)
    }
  })

  console.log('[batch-create] tasks snapshot build', {
    batchId: batch.batchId || '',
    taskIds,
    snapshotCount: snapshots.length,
    missingTaskIds
  })

  return {
    snapshots,
    missingTaskIds
  }
}

function attachBatchTaskSnapshots(batch = {}) {
  const { snapshots } = buildBatchTaskSnapshots(batch)
  return {
    ...batch,
    tasks: snapshots
  }
}

function cacheProjectLocally(project) {
  if (!project || !project.projectId) {
    return null
  }

  const normalizedProject = normalizeProject(project)
  const existingProject = getProjectById(normalizedProject.projectId)
  if (existingProject) {
    return updateProject(normalizedProject.projectId, normalizedProject)
  }

  return createProject(normalizedProject)
}

function normalizeOrderStatus(value) {
  return ORDER_STATUS_OPTIONS.includes(value) ? value : ORDER_STATUS.PENDING
}

function normalizePayStatus(value) {
  return PAY_STATUS_OPTIONS.includes(value) ? value : PAY_STATUS.UNPAID
}

function normalizeOrder(order) {
  const orderStatus = normalizeOrderStatus(order && (order.orderStatus || order.status))
  const payStatus = normalizePayStatus(order && (order.payStatus || order.paymentStatus))

  return {
    ...order,
    orderType: order && order.orderType ? order.orderType : ORDER_TYPE.PACKAGE_PURCHASE,
    orderStatus,
    status: orderStatus,
    payStatus,
    paymentStatus: payStatus,
    payChannel: order && order.payChannel ? order.payChannel : PAY_CHANNEL.WECHAT
  }
}

export function getAdminTaskList(options = {}) {
  if (options && options.preferCloud) {
    console.log('[adminRepository:tasks] list route=cloud attempt')
    return getAdminTaskListFromCloud(options)
  }
  return getAdminTaskListResponse().data.list
}

function _resolveTaskLocalFallback(taskId = '') {
  const normalizedTaskId = String(taskId || '').trim()
  const state = getMainChainState()
  const taskIds = Array.isArray(state.tasks && state.tasks.allIds) ? state.tasks.allIds : []
  const byId = state.tasks && state.tasks.byId ? state.tasks.byId : {}
  const stateTasks = taskIds.map((id) => byId[id]).filter(Boolean)

  if (normalizedTaskId) {
    const stateTask = byId[normalizedTaskId]
    if (stateTask) {
      return {
        data: normalizeTask(stateTask, false),
        source: 'local',
        isMock: false,
        fallbackReason: ''
      }
    }

    const mockTask = ensureMockTasks().find((task) => task.taskId === normalizedTaskId) || null
    return {
      data: mockTask ? normalizeTask(mockTask, true) : null,
      source: 'mock',
      isMock: true,
      fallbackReason: ''
    }
  }

  if (stateTasks.length) {
    return {
      data: stateTasks.map((task) => normalizeTask(task, false)),
      source: 'local',
      isMock: false,
      fallbackReason: ''
    }
  }

  return {
    data: ensureMockTasks().map((task) => normalizeTask(task, true)),
    source: 'mock',
    isMock: true,
    fallbackReason: ''
  }
}

export async function getAdminTaskListFromCloud(query = {}) {
  try {
    const response = await getTaskListByCloud(query)
    const rawList = response && response.data && Array.isArray(response.data.list) ? response.data.list : []
    const list = rawList.map((task) => normalizeTask(task, false))
    console.log(`[adminRepository:tasks] list success source=cloud count=${list.length}`)
    return {
      data: list,
      source: 'cloud',
      isMock: false,
      fallbackReason: ''
    }
  } catch (error) {
    const fallbackReason = (error && error.message) || 'unknown'
    console.log(`[adminRepository:tasks] list fallback to local/mock message=${fallbackReason}`)
    return {
      ..._resolveTaskLocalFallback(),
      fallbackReason
    }
  }
}

export function getAdminTaskById(taskId, options = {}) {
  if (!taskId) {
    return null
  }
  if (options && options.preferCloud) {
    console.log(`[adminRepository:tasks] detail route=cloud attempt taskId=${taskId}`)
    return getAdminTaskByIdFromCloud(taskId)
  }
  const response = getAdminTaskDetailResponse(taskId)
  return response && response.data ? response.data : null
}

export async function getAdminTaskByIdFromCloud(taskId) {
  if (!taskId) {
    return {
      data: null,
      source: 'mock',
      isMock: true,
      fallbackReason: ''
    }
  }

  try {
    const response = await getTaskByIdByCloud(taskId)
    const task = response && response.data ? normalizeTask(response.data, false) : null
    console.log(`[adminRepository:tasks] detail success source=cloud taskId=${taskId} found=${!!task}`)
    if (task) {
      return {
        data: task,
        source: 'cloud',
        isMock: false,
        fallbackReason: ''
      }
    }

    return {
      ..._resolveTaskLocalFallback(taskId),
      fallbackReason: 'cloud returned empty task'
    }
  } catch (error) {
    const fallbackReason = (error && error.message) || 'unknown'
    console.log(`[adminRepository:tasks] detail fallback to local/mock message=${fallbackReason}`)
    return {
      ..._resolveTaskLocalFallback(taskId),
      fallbackReason
    }
  }
}

export function getAdminTaskListResponse(query = {}) {
  const state = getMainChainState()
  const taskIds = Array.isArray(state.tasks && state.tasks.allIds) ? state.tasks.allIds : []
  const byId = state.tasks && state.tasks.byId ? state.tasks.byId : {}
  const tasks = taskIds.map((taskId) => byId[taskId]).filter(Boolean)

  if (tasks.length) {
    return createSuccessResponse(buildAdminTaskList(tasks.map((task) => normalizeTask(task, false)), query))
  }

  return createSuccessResponse(buildAdminTaskList(ensureMockTasks().map((task) => normalizeTask(task, true)), query))
}

export function getAdminBatchList(options = {}) {
  if (options && options.preferCloud) {
    console.log('[adminRepository:batches] list route=cloud attempt')
    return getAdminBatchListFromCloud(options)
  }

  const projectId = String(options.projectId || '').trim()
  const list = getBatchList()
    .filter((batch) => !projectId || batch.projectId === projectId)
    .map((batch) => normalizeBatch(batch))
  return list
}

export async function getAdminBatchListFromCloud(query = {}) {
  try {
    const response = await getBatchListByCloud(query)
    const rawList = response && response.data && Array.isArray(response.data.list) ? response.data.list : []
    const list = rawList.map((batch) => normalizeBatch(batch))
    console.log(`[adminRepository:batches] list success source=cloud count=${list.length}`)
    return list
  } catch (error) {
    console.log(`[adminRepository:batches] list fallback to local/mock message=${(error && error.message) || 'unknown'}`)
    const { preferCloud: _pc, ...safeQuery } = query || {}
    return getAdminBatchList(safeQuery)
  }
}

export function getAdminBatchById(batchId, options = {}) {
  if (!batchId) {
    return null
  }
  if (options && options.preferCloud) {
    console.log(`[adminRepository:batches] detail route=cloud attempt batchId=${batchId}`)
    return getAdminBatchByIdFromCloud(batchId)
  }
  const batch = getBatchById(batchId)
  return batch ? normalizeBatch(batch) : null
}

export async function getAdminBatchByIdFromCloud(batchId) {
  if (!batchId) {
    return null
  }

  try {
    const response = await getBatchByIdByCloud(batchId)
    const batch = response && response.data ? normalizeBatch(response.data) : null
    console.log(`[adminRepository:batches] detail success source=cloud batchId=${batchId} found=${!!batch}`)
    return batch || getAdminBatchById(batchId)
  } catch (error) {
    console.log(`[adminRepository:batches] detail fallback to local/mock message=${(error && error.message) || 'unknown'}`)
    return getAdminBatchById(batchId)
  }
}

export async function syncAdminBatchToCloud(batchId) {
  const batch = getAdminBatchById(batchId)
  if (!batch || !batch.batchId) {
    console.error(`[adminRepository:batches] sync skipped: local batch not found batchId=${batchId || ''}`)
    return null
  }

  try {
    const batchWithTaskSnapshots = attachBatchTaskSnapshots(batch)
    console.log('[batch-create] save batch with tasks', {
      batchId: batchWithTaskSnapshots.batchId,
      taskIdsCount: Array.isArray(batchWithTaskSnapshots.taskIds) ? batchWithTaskSnapshots.taskIds.length : 0,
      tasksCount: Array.isArray(batchWithTaskSnapshots.tasks) ? batchWithTaskSnapshots.tasks.length : 0
    })
    console.log(`[adminRepository:batches] sync route=cloud attempt batchId=${batch.batchId}`)
    const response = await upsertBatchByCloud(batchWithTaskSnapshots)
    console.log(`[adminRepository:batches] sync success source=cloud batchId=${batch.batchId}`)
    return response && response.data ? normalizeBatch(response.data) : batchWithTaskSnapshots
  } catch (error) {
    console.error(`[adminRepository:batches] sync failed source=cloud message=${(error && error.message) || 'unknown'}`)
    return batch
  }
}

export function getAdminTaskDetailResponse(taskId) {
  if (!taskId) {
    return createSuccessResponse(null, 'task not found')
  }

  const state = getMainChainState()
  const byId = state.tasks && state.tasks.byId ? state.tasks.byId : {}
  const stateTask = byId[taskId]

  if (stateTask) {
    return createSuccessResponse(normalizeTask(stateTask, false))
  }

  const mockTask = ensureMockTasks().find((task) => task.taskId === taskId) || null
  return createSuccessResponse(mockTask ? normalizeTask(mockTask, true) : null, mockTask ? 'ok' : 'task not found')
}

export function retryAdminTask(taskId) {
  const tasks = ensureMockTasks()
  const target = tasks.find((task) => task.taskId === taskId)
  if (!target) {
    return getAdminTaskList().find((task) => task.taskId === taskId) || null
  }

  const nextTask = {
    ...target,
    status: TASK_STATUS.PENDING,
    updatedAt: new Date().toISOString(),
    summary: 'Retry requested from admin'
  }
  const nextTasks = tasks.map((task) => (task.taskId === taskId ? nextTask : task))
  uni.setStorageSync(ADMIN_MOCK_TASKS_KEY, nextTasks)
  return normalizeTask(nextTask, true)
}

export function getAdminLeadList(query = {}) {
  if (query && query.preferCloud) {
    console.log('[adminRepository:leads] list route=cloud attempt')
    return getAdminLeadListFromCloud(query)
  }
  console.log('[adminRepository:leads] list route=local/mock')
  return getAdminLeadListResponse().data.list
}

export async function getAdminLeadListFromCloud(query = {}) {
  try {
    const response = await getLeadListByCloud(query)
    const rawList = response && response.data && Array.isArray(response.data.list) ? response.data.list : []
    const list = rawList.map((lead) => normalizeLead(lead))
    console.log(`[adminRepository:leads] list success source=cloud count=${list.length}`)
    return list
  } catch (error) {
    console.log(`[adminRepository:leads] list fallback to local/mock message=${(error && error.message) || 'unknown'}`)
    return getAdminLeadList()
  }
}

export function createAdminLead(payload = {}) {
  return createAdminLeadResponse(payload).data
}

export function getAdminLeadById(leadId, options = {}) {
  if (!leadId) {
    return null
  }
  if (options && options.preferCloud) {
    console.log(`[adminRepository:leads] detail route=cloud attempt leadId=${leadId}`)
    return getAdminLeadByIdFromCloud(leadId)
  }
  console.log(`[adminRepository:leads] detail route=local/mock leadId=${leadId}`)
  const response = getAdminLeadDetailResponse(leadId)
  return response && response.data ? response.data : null
}

export async function getAdminLeadByIdFromCloud(leadId) {
  if (!leadId) {
    return null
  }

  try {
    const response = await getLeadByIdByCloud(leadId)
    const lead = response && response.data ? normalizeLead(response.data) : null
    console.log(`[adminRepository:leads] detail success source=cloud leadId=${leadId} found=${!!lead}`)
    return lead || getAdminLeadById(leadId)
  } catch (error) {
    console.log(`[adminRepository:leads] detail fallback to local/mock message=${(error && error.message) || 'unknown'}`)
    return getAdminLeadById(leadId)
  }
}

export function createAdminLeadResponse(payload = {}) {
  const createdLead = createLead(normalizeLeadCreatePayload(payload))
  return createSuccessResponse(normalizeLead(createdLead), 'created')
}

export function getAdminLeadListResponse(query = {}) {
  const list = getLeadList().map((lead) => normalizeLead(lead))
  return createSuccessResponse(buildAdminLeadList(list, query))
}

export function getAdminLeadDetailResponse(leadId) {
  if (!leadId) {
    return createSuccessResponse(null, 'lead not found')
  }

  const lead = getLeadList()
    .map((item) => normalizeLead(item))
    .find((item) => item.leadId === leadId) || null

  return createSuccessResponse(lead, lead ? 'ok' : 'lead not found')
}

function updateAdminLeadFollowStatusLocal(leadId, followStatus) {
  const normalizedFollowStatus = normalizeLeadFollowStatus(followStatus)
  const updatedLead = updateLeadStatus(leadId, normalizedFollowStatus)
  return updatedLead ? normalizeLead(updatedLead) : null
}

export function updateAdminLeadFollowStatus(leadId, followStatus, options = {}) {
  if (options && options.preferCloud) {
    console.log(`[adminRepository:leads] update route=cloud attempt leadId=${leadId}`)
    return updateAdminLeadFollowStatusByCloud(leadId, followStatus)
  }
  console.log(`[adminRepository:leads] update route=local/mock leadId=${leadId}`)
  return updateAdminLeadFollowStatusLocal(leadId, followStatus)
}

export async function updateAdminLeadFollowStatusByCloud(leadId, followStatus) {
  const normalizedFollowStatus = normalizeLeadFollowStatus(followStatus)
  try {
    const response = await updateLeadFollowStatusByCloud(leadId, normalizedFollowStatus)
    if (!response || response.code !== 0) {
      throw new Error((response && response.message) || 'Cloud update lead failed')
    }

    console.log(`[adminRepository:leads] update success source=cloud leadId=${leadId} followStatus=${normalizedFollowStatus}`)
    return getAdminLeadByIdFromCloud(leadId)
  } catch (error) {
    console.log(`[adminRepository:leads] update fallback to local/mock message=${(error && error.message) || 'unknown'}`)
    return updateAdminLeadFollowStatusLocal(leadId, normalizedFollowStatus)
  }
}

function convertAdminLeadToProjectLocal(leadId) {
  const result = createProjectFromLead(leadId)
  return {
    ...result,
    project: result && result.project ? normalizeProject(result.project) : null
  }
}

export function convertAdminLeadToProject(leadId, options = {}) {
  if (options && options.preferCloud) {
    console.log(`[adminRepository:projects] create route=cloud attempt leadId=${leadId}`)
    return convertAdminLeadToProjectByCloud(leadId)
  }
  console.log(`[adminRepository:projects] create route=local/mock leadId=${leadId}`)
  return convertAdminLeadToProjectLocal(leadId)
}

export async function convertAdminLeadToProjectByCloud(leadId) {
  try {
    const response = await createProjectFromLeadByCloud(leadId, {
      getLeadById: getAdminLeadById
    })
    const result = response && response.data ? response.data : {}
    const project = result && result.project ? normalizeProject(result.project) : null

    if (project) {
      cacheProjectLocally(project)
    }

    console.log(`[adminRepository:projects] create success source=cloud leadId=${leadId} duplicated=${!!result.duplicated}`)
    return {
      duplicated: !!result.duplicated,
      project
    }
  } catch (error) {
    console.log(`[adminRepository:projects] create fallback to local/mock message=${(error && error.message) || 'unknown'}`)
    return convertAdminLeadToProjectLocal(leadId)
  }
}

export function getAdminLeadProject(leadId, options = {}) {
  if (options && options.preferCloud) {
    console.log(`[adminRepository:projects] leadProject route=cloud attempt leadId=${leadId}`)
    return getAdminLeadProjectFromCloud(leadId)
  }
  const project = findProjectByLeadId(leadId)
  return project ? normalizeProject(project) : null
}

export async function getAdminLeadProjectFromCloud(leadId) {
  if (!leadId) {
    return null
  }

  try {
    const response = await getLeadProjectByCloud(leadId)
    const project = response && response.data ? normalizeProject(response.data) : null
    if (project) {
      cacheProjectLocally(project)
    }
    console.log(`[adminRepository:projects] leadProject success source=cloud leadId=${leadId} found=${!!project}`)
    return project || getAdminLeadProject(leadId)
  } catch (error) {
    console.log(`[adminRepository:projects] leadProject fallback to local/mock message=${(error && error.message) || 'unknown'}`)
    return getAdminLeadProject(leadId)
  }
}

export async function getAdminLeadProjectMap(leadIds = [], options = {}) {
  const normalizedLeadIds = Array.from(
    new Set(
      (Array.isArray(leadIds) ? leadIds : [])
        .map((leadId) => String(leadId || '').trim())
        .filter(Boolean)
    )
  )

  const projectPairs = await Promise.all(
    normalizedLeadIds.map(async (leadId) => {
      const project = await getAdminLeadProject(leadId, options)
      return [leadId, project || null]
    })
  )

  return projectPairs.reduce((result, [leadId, project]) => {
    if (project) {
      result[leadId] = project
    }
    return result
  }, {})
}

export async function getAdminLeadProjectState(leadId, options = {}) {
  const normalizedLeadId = String(leadId || '').trim()
  if (!normalizedLeadId) {
    return {
      leadId: '',
      hasProject: false,
      project: null,
      projectId: ''
    }
  }

  const project = await getAdminLeadProject(normalizedLeadId, options)
  return {
    leadId: normalizedLeadId,
    hasProject: !!project,
    project: project || null,
    projectId: project && project.projectId ? project.projectId : ''
  }
}

export async function getAdminLeadProjectStateMap(leadIds = [], options = {}) {
  const normalizedLeadIds = Array.from(
    new Set(
      (Array.isArray(leadIds) ? leadIds : [])
        .map((leadId) => String(leadId || '').trim())
        .filter(Boolean)
    )
  )

  const statePairs = await Promise.all(
    normalizedLeadIds.map(async (leadId) => {
      const state = await getAdminLeadProjectState(leadId, options)
      return [leadId, state]
    })
  )

  return statePairs.reduce((result, [leadId, state]) => {
    result[leadId] = state
    return result
  }, {})
}

export function getAdminProjectList(options = {}) {
  if (options && options.preferCloud) {
    console.log('[adminRepository:projects] list route=cloud attempt')
    return getAdminProjectListFromCloud(options)
  }
  return getAdminProjectListResponse().data.list
}

export async function getAdminProjectListFromCloud(query = {}) {
  try {
    const response = await getProjectListByCloud(query)
    const rawList = response && response.data && Array.isArray(response.data.list) ? response.data.list : []
    const list = rawList.map((project) => normalizeProject(project))
    list.forEach((project) => {
      cacheProjectLocally(project)
    })
    console.log(`[adminRepository:projects] list success source=cloud count=${list.length}`)
    return list
  } catch (error) {
    console.log(`[adminRepository:projects] list fallback to local/mock message=${(error && error.message) || 'unknown'}`)
    return getAdminProjectList()
  }
}

export function getAdminProjectById(projectId, options = {}) {
  if (!projectId) {
    return null
  }
  if (options && options.preferCloud) {
    console.log(`[adminRepository:projects] detail route=cloud attempt projectId=${projectId}`)
    return getAdminProjectByIdFromCloud(projectId)
  }
  const response = getAdminProjectDetailResponse(projectId)
  return response && response.data ? response.data : null
}

export async function getAdminProjectByIdFromCloud(projectId) {
  if (!projectId) {
    return null
  }

  try {
    const response = await getProjectByIdByCloud(projectId)
    const project = response && response.data ? normalizeProject(response.data) : null
    if (project) {
      cacheProjectLocally(project)
    }
    console.log(`[adminRepository:projects] detail success source=cloud projectId=${projectId} found=${!!project}`)
    return project || getAdminProjectById(projectId)
  } catch (error) {
    console.log(`[adminRepository:projects] detail fallback to local/mock message=${(error && error.message) || 'unknown'}`)
    return getAdminProjectById(projectId)
  }
}

export function getAdminProjectListResponse(query = {}) {
  const list = getProjectList().map((project) => normalizeProject(project))
  return createSuccessResponse(buildAdminProjectList(list, query))
}

export function getAdminProjectDetailResponse(projectId) {
  if (!projectId) {
    return createSuccessResponse(null, 'project not found')
  }

  const project = getProjectList()
    .map((item) => normalizeProject(item))
    .find((item) => item.projectId === projectId) || null

  return createSuccessResponse(project, project ? 'ok' : 'project not found')
}

export function updateAdminProject(projectId, patch = {}) {
  return updateAdminProjectWithOptions(projectId, patch)
}

export function updateAdminProjectWithOptions(projectId, patch = {}, options = {}) {
  if (options && options.preferCloud) {
    console.log(`[adminRepository:projects] update route=cloud attempt projectId=${projectId}`)
    return updateAdminProjectByCloud(projectId, patch)
  }
  console.log(`[adminRepository:projects] update route=local/mock projectId=${projectId}`)
  return updateAdminProjectLocal(projectId, patch)
}

function buildProjectUpdatePatch(patch = {}) {
  const nextPatch = {
    ...patch
  }

  if (Object.prototype.hasOwnProperty.call(nextPatch, 'projectName')) {
    nextPatch.projectName = String(nextPatch.projectName || '').trim()
  }

  if (Object.prototype.hasOwnProperty.call(nextPatch, 'stage')) {
    nextPatch.stage = normalizeProjectStage(nextPatch.stage)
  }

  if (Object.prototype.hasOwnProperty.call(nextPatch, 'status')) {
    nextPatch.status = PROJECT_STATUS_OPTIONS.includes(nextPatch.status) ? nextPatch.status : PROJECT_STATUS.PENDING
  }

  nextPatch.updatedAt = new Date().toISOString()
  return nextPatch
}

function updateAdminProjectLocal(projectId, patch = {}) {
  const nextPatch = buildProjectUpdatePatch(patch)
  const updatedProject = updateProject(projectId, nextPatch)
  return updatedProject ? normalizeProject(updatedProject) : null
}

export async function updateAdminProjectByCloud(projectId, patch = {}) {
  try {
    const nextPatch = buildProjectUpdatePatch(patch)
    const response = await updateProjectByCloud(projectId, nextPatch)
    const project = response && response.data
      ? normalizeProject({
          ...(getProjectById(projectId) || {}),
          ...response.data,
          projectId
        })
      : null

    if (project) {
      cacheProjectLocally(project)
    }

    console.log(`[adminRepository:projects] update success source=cloud projectId=${projectId}`)
    return project || getAdminProjectById(projectId)
  } catch (error) {
    console.log(`[adminRepository:projects] update fallback to local/mock message=${(error && error.message) || 'unknown'}`)
    return updateAdminProjectLocal(projectId, patch)
  }
}

export function getAdminOrderList() {
  return getAdminOrderListResponse().data.list
}

export function getAdminOrderById(orderId) {
  if (!orderId) {
    return null
  }
  const response = getAdminOrderDetailResponse(orderId)
  return response && response.data ? response.data : null
}

export function getAdminOrderListResponse(query = {}) {
  const list = getOrderList().map((order) => normalizeOrder(order))
  return createSuccessResponse(buildAdminOrderList(list, query))
}

export function getAdminOrderDetailResponse(orderId) {
  if (!orderId) {
    return createSuccessResponse(null, 'order not found')
  }

  const order = getOrderList()
    .map((item) => normalizeOrder(item))
    .find((item) => item.orderId === orderId) || null

  return createSuccessResponse(order, order ? 'ok' : 'order not found')
}

export function updateAdminOrder(orderId, patch = {}) {
  const nextPatch = {
    ...patch
  }

  if (Object.prototype.hasOwnProperty.call(nextPatch, 'orderStatus')) {
    nextPatch.orderStatus = normalizeOrderStatus(nextPatch.orderStatus)
    nextPatch.status = nextPatch.orderStatus
  }

  if (Object.prototype.hasOwnProperty.call(nextPatch, 'status')) {
    nextPatch.orderStatus = normalizeOrderStatus(nextPatch.status)
    nextPatch.status = nextPatch.orderStatus
  }

  if (Object.prototype.hasOwnProperty.call(nextPatch, 'payStatus')) {
    nextPatch.payStatus = normalizePayStatus(nextPatch.payStatus)
    nextPatch.paymentStatus = nextPatch.payStatus
  }

  if (Object.prototype.hasOwnProperty.call(nextPatch, 'paymentStatus')) {
    nextPatch.payStatus = normalizePayStatus(nextPatch.paymentStatus)
    nextPatch.paymentStatus = nextPatch.payStatus
  }

  const updatedOrder = updateOrder(orderId, nextPatch)
  return updatedOrder ? normalizeOrder(updatedOrder) : null
}

function getDefaultMembershipUsageMock() {
  return {
    currentTier: getDefaultMembershipTier(),
    monthlyAiPointsUsed: 0,
    monthlyRefineUsed: 0,
    monthlyRunwayVideoUsed: 0,
    period: '2026-06'
  }
}

function normalizeUsageNumber(value = 0) {
  const numberValue = Number(value)
  return Number.isFinite(numberValue) && numberValue >= 0 ? numberValue : 0
}

function normalizeMembershipUsage(rawUsage = {}) {
  const defaultUsage = getDefaultMembershipUsageMock()
  const tier = rawUsage.currentTier && MEMBERSHIP_PLAN_CONFIG[rawUsage.currentTier]
    ? rawUsage.currentTier
    : defaultUsage.currentTier
  return {
    ...defaultUsage,
    ...rawUsage,
    currentTier: tier,
    monthlyAiPointsUsed: normalizeUsageNumber(rawUsage.monthlyAiPointsUsed),
    monthlyRefineUsed: normalizeUsageNumber(rawUsage.monthlyRefineUsed),
    monthlyRunwayVideoUsed: normalizeUsageNumber(rawUsage.monthlyRunwayVideoUsed),
    period: rawUsage.period || defaultUsage.period
  }
}

function setMembershipUsageMock(nextUsage = {}) {
  const usage = normalizeMembershipUsage(nextUsage)
  uni.setStorageSync(MEMBERSHIP_USAGE_MOCK_KEY, usage)
  return usage
}

function createQuotaResult({
  ok,
  reason = '',
  reasonText = '',
  membershipTier = getDefaultMembershipTier(),
  quotaBefore = 0,
  quotaAfter = quotaBefore,
  cost = 0
} = {}) {
  return {
    ok: !!ok,
    reason,
    reasonText,
    membershipTier,
    quotaBefore,
    quotaAfter,
    cost
  }
}

export function getCurrentMembershipUsage() {
  const cached = uni.getStorageSync(MEMBERSHIP_USAGE_MOCK_KEY)
  return normalizeMembershipUsage(cached || getDefaultMembershipUsageMock())
}

export function setCurrentMembershipTier(tier) {
  const usage = getCurrentMembershipUsage()
  const nextTier = MEMBERSHIP_PLAN_CONFIG[tier] ? tier : getDefaultMembershipTier()
  return setMembershipUsageMock({
    ...usage,
    currentTier: nextTier
  })
}

export function setMockAiPointsUsed(points = 0) {
  const usage = getCurrentMembershipUsage()
  return setMembershipUsageMock({
    ...usage,
    monthlyAiPointsUsed: normalizeUsageNumber(points)
  })
}

export function setMockRefineUsed(count = 0) {
  const usage = getCurrentMembershipUsage()
  return setMembershipUsageMock({
    ...usage,
    monthlyRefineUsed: normalizeUsageNumber(count)
  })
}

export function setMockRunwayVideoUsed(count = 0) {
  const usage = getCurrentMembershipUsage()
  return setMembershipUsageMock({
    ...usage,
    monthlyRunwayVideoUsed: normalizeUsageNumber(count)
  })
}

export function getMembershipUsageSummary() {
  const usage = getCurrentMembershipUsage()
  const permissions = getMembershipPermissions(usage.currentTier)
  return {
    membershipTier: usage.currentTier,
    period: usage.period,
    monthlyAiPointsUsed: usage.monthlyAiPointsUsed,
    monthlyAiPointsQuota: permissions.monthlyAiPoints || 0,
    monthlyAiPointsRemaining: Math.max(0, (permissions.monthlyAiPoints || 0) - usage.monthlyAiPointsUsed),
    monthlyRefineUsed: usage.monthlyRefineUsed,
    monthlyRefineQuota: permissions.monthlyRefineQuota || 0,
    monthlyRefineRemaining: Math.max(0, (permissions.monthlyRefineQuota || 0) - usage.monthlyRefineUsed),
    monthlyRunwayVideoUsed: usage.monthlyRunwayVideoUsed,
    monthlyRunwayVideoQuota: permissions.monthlyRunwayVideoQuota || 0,
    monthlyRunwayVideoRemaining: Math.max(0, (permissions.monthlyRunwayVideoQuota || 0) - usage.monthlyRunwayVideoUsed),
    maxRunwayDurationSec: permissions.maxRunwayDurationSec || 0
  }
}

export function canConsumeAiPoints(actionType, count = 1) {
  const usage = getCurrentMembershipUsage()
  const permissions = getMembershipPermissions(usage.currentTier)
  const cost = getAiPointCost(actionType, { count })
  const quotaBefore = usage.monthlyAiPointsUsed
  const quotaAfter = quotaBefore + cost
  const quotaLimit = permissions.monthlyAiPoints || 0

  if (!cost) {
    return createQuotaResult({
      ok: false,
      reason: 'unknown_action_type',
      reasonText: '未知功能扣点类型',
      membershipTier: usage.currentTier,
      quotaBefore,
      quotaAfter,
      cost
    })
  }

  if (quotaAfter > quotaLimit) {
    return createQuotaResult({
      ok: false,
      reason: 'insufficient_ai_points',
      reasonText: 'AI 点数不足',
      membershipTier: usage.currentTier,
      quotaBefore,
      quotaAfter: quotaBefore,
      cost
    })
  }

  return createQuotaResult({
    ok: true,
    membershipTier: usage.currentTier,
    quotaBefore,
    quotaAfter,
    cost
  })
}

export function consumeAiPoints(actionType, count = 1) {
  const result = canConsumeAiPoints(actionType, count)
  if (!result.ok) {
    return result
  }
  const usage = getCurrentMembershipUsage()
  setMembershipUsageMock({
    ...usage,
    monthlyAiPointsUsed: result.quotaAfter
  })
  return result
}

export function canConsumeRefineQuota(count = 1) {
  const usage = getCurrentMembershipUsage()
  const permissions = getMembershipPermissions(usage.currentTier)
  const cost = Math.max(1, Number(count || 1) || 1)
  const quotaBefore = usage.monthlyRefineUsed
  const quotaAfter = quotaBefore + cost
  const quotaLimit = permissions.monthlyRefineQuota || 0

  if (quotaLimit <= 0) {
    return createQuotaResult({
      ok: false,
      reason: 'refine_quota_not_included',
      reasonText: '当前套餐不含正式精修额度',
      membershipTier: usage.currentTier,
      quotaBefore,
      quotaAfter: quotaBefore,
      cost
    })
  }

  if (quotaAfter > quotaLimit) {
    return createQuotaResult({
      ok: false,
      reason: 'insufficient_refine_quota',
      reasonText: '本月精修额度不足，可按张购买或升级套餐',
      membershipTier: usage.currentTier,
      quotaBefore,
      quotaAfter: quotaBefore,
      cost
    })
  }

  return createQuotaResult({
    ok: true,
    membershipTier: usage.currentTier,
    quotaBefore,
    quotaAfter,
    cost
  })
}

export function consumeRefineQuota(count = 1) {
  const result = canConsumeRefineQuota(count)
  if (!result.ok) {
    return result
  }
  const usage = getCurrentMembershipUsage()
  setMembershipUsageMock({
    ...usage,
    monthlyRefineUsed: result.quotaAfter
  })
  return result
}

export function canCreateRunwayVideo(durationSec = 3) {
  const usage = getCurrentMembershipUsage()
  const permissions = getMembershipPermissions(usage.currentTier)
  const duration = Number(durationSec) || 3
  const quotaBefore = usage.monthlyRunwayVideoUsed
  const quotaAfter = quotaBefore + 1
  const quotaLimit = permissions.monthlyRunwayVideoQuota || 0

  if (duration > (permissions.maxRunwayDurationSec || 0)) {
    return createQuotaResult({
      ok: false,
      reason: 'runway_duration_exceeded',
      reasonText: '走秀视频时长超过当前套餐上限',
      membershipTier: usage.currentTier,
      quotaBefore,
      quotaAfter: quotaBefore,
      cost: 1
    })
  }

  if (quotaAfter > quotaLimit) {
    return createQuotaResult({
      ok: false,
      reason: 'insufficient_runway_video_quota',
      reasonText: '本月走秀视频额度不足',
      membershipTier: usage.currentTier,
      quotaBefore,
      quotaAfter: quotaBefore,
      cost: 1
    })
  }

  return createQuotaResult({
    ok: true,
    membershipTier: usage.currentTier,
    quotaBefore,
    quotaAfter,
    cost: 1
  })
}

export function consumeRunwayVideoQuota(durationSec = 3) {
  const result = canCreateRunwayVideo(durationSec)
  if (!result.ok) {
    return result
  }
  const usage = getCurrentMembershipUsage()
  setMembershipUsageMock({
    ...usage,
    monthlyRunwayVideoUsed: result.quotaAfter
  })
  return result
}

function getOriginalProtectionPackageStorageList() {
  const cached = uni.getStorageSync(ORIGINAL_PROTECTION_PACKAGES_KEY)
  return Array.isArray(cached) ? cached.filter(Boolean) : []
}

function setOriginalProtectionPackageStorageList(list = []) {
  const nextList = Array.isArray(list) ? list.filter(Boolean) : []
  uni.setStorageSync(ORIGINAL_PROTECTION_PACKAGES_KEY, nextList)
  return nextList
}

function matchOriginalProtectionPackageFilters(item = {}, filters = {}) {
  if (filters.customerId && ((item.customer && item.customer.customerId) || '') !== filters.customerId) {
    return false
  }
  if (filters.projectId && ((item.project && item.project.projectId) || '') !== filters.projectId) {
    return false
  }
  if (filters.taskId && ((item.project && item.project.taskId) || '') !== filters.taskId) {
    return false
  }
  if (filters.status && item.status !== filters.status) {
    return false
  }
  return true
}

export function getOriginalProtectionPackageList(filters = {}) {
  return getOriginalProtectionPackageStorageList()
    .filter((item) => matchOriginalProtectionPackageFilters(item, filters))
    .sort((left, right) => {
      const leftTime = new Date(left.updatedAt || left.createdAt || 0).getTime() || 0
      const rightTime = new Date(right.updatedAt || right.createdAt || 0).getTime() || 0
      return rightTime - leftTime
    })
}

export function getOriginalProtectionPackageById(packageId) {
  if (!packageId) {
    return null
  }
  return getOriginalProtectionPackageStorageList()
    .find((item) => item && item.packageId === packageId) || null
}

export function appendOriginalProtectionPackage(packageDraft) {
  if (!packageDraft || !packageDraft.packageId) {
    return null
  }
  const list = getOriginalProtectionPackageStorageList()
  const nextList = [
    packageDraft,
    ...list.filter((item) => item && item.packageId !== packageDraft.packageId)
  ]
  setOriginalProtectionPackageStorageList(nextList)
  return packageDraft
}

export function createOriginalProtectionPackageDraftFromTask(task, project = {}, options = {}) {
  const validation = canCreateOriginalProtectionPackage(task)
  if (!validation.ok) {
    return {
      ok: false,
      reason: validation.reason,
      reasonText: validation.reasonText
    }
  }

  const draft = createOriginalProtectionPackageDraft(task, project, options)
  appendOriginalProtectionPackage(draft)
  return {
    ok: true,
    package: draft
  }
}

function getRefineWorkOrderStorageList() {
  const cached = uni.getStorageSync(REFINE_WORK_ORDERS_KEY)
  return Array.isArray(cached) ? cached.filter(Boolean) : []
}

function setRefineWorkOrderStorageList(list = []) {
  const nextList = Array.isArray(list) ? list.filter(Boolean) : []
  uni.setStorageSync(REFINE_WORK_ORDERS_KEY, nextList)
  return nextList
}

function matchRefineWorkOrderFilters(item = {}, filters = {}) {
  if (filters.status && item.status !== filters.status) {
    return false
  }
  if (filters.taskId && item.taskId !== filters.taskId) {
    return false
  }
  if (filters.orderType && item.orderType !== filters.orderType) {
    return false
  }
  if (filters.projectId && item.projectId !== filters.projectId) {
    return false
  }
  return true
}

export function getRefineWorkOrderList(filters = {}) {
  return getRefineWorkOrderStorageList()
    .filter((item) => matchRefineWorkOrderFilters(item, filters))
    .sort((left, right) => {
      const leftTime = new Date(left.updatedAt || left.createdAt || 0).getTime() || 0
      const rightTime = new Date(right.updatedAt || right.createdAt || 0).getTime() || 0
      return rightTime - leftTime
    })
}

export function getRefineWorkOrderById(orderId) {
  if (!orderId) {
    return null
  }
  return getRefineWorkOrderStorageList()
    .find((item) => item && item.orderId === orderId) || null
}

export function appendRefineWorkOrder(orderDraft) {
  if (!orderDraft || !orderDraft.orderId) {
    return null
  }
  const list = getRefineWorkOrderStorageList()
  const nextList = [
    orderDraft,
    ...list.filter((item) => item && item.orderId !== orderDraft.orderId)
  ]
  setRefineWorkOrderStorageList(nextList)
  return orderDraft
}

export function createRefineWorkOrderFromTask(task, options = {}) {
  const validation = canCreateRefineWorkOrder(task)
  if (!validation.ok) {
    return {
      ok: false,
      reason: validation.reason,
      reasonText: validation.reasonText
    }
  }

  const order = createRefineWorkOrderDraft(task, options)
  appendRefineWorkOrder(order)
  return {
    ok: true,
    order
  }
}

function buildRefineWorkOrderAuditEvent(event = {}) {
  const now = new Date().toISOString()
  return {
    eventType: event.eventType || 'status_updated',
    actorType: event.actorType || 'admin',
    actorId: event.actorId || 'admin_mock',
    createdAt: event.createdAt || now,
    summary: event.summary || ''
  }
}

function updateRefineWorkOrderWithAudit(orderId, status, patch = {}, auditEvent = null) {
  if (!orderId) {
    return null
  }
  const now = new Date().toISOString()
  const list = getRefineWorkOrderStorageList()
  let updatedOrder = null
  const nextList = list.map((item) => {
    if (!item || item.orderId !== orderId) {
      return item
    }
    const oldStatus = item.status
    const nextAuditTrail = auditEvent
      ? [
          ...(Array.isArray(item.auditTrail) ? item.auditTrail : []),
          buildRefineWorkOrderAuditEvent(auditEvent)
        ]
      : Object.prototype.hasOwnProperty.call(patch, 'auditTrail')
        ? patch.auditTrail
        : item.auditTrail
    updatedOrder = {
      ...item,
      ...patch,
      status,
      updatedAt: now,
      auditTrail: nextAuditTrail
    }
    console.log('[refine-order] status updated', {
      orderId,
      oldStatus,
      newStatus: status,
      actorType: (auditEvent && auditEvent.actorType) || 'admin'
    })
    return updatedOrder
  })
  setRefineWorkOrderStorageList(nextList)
  return updatedOrder
}

export function updateRefineWorkOrderStatus(orderId, status, patch = {}) {
  return updateRefineWorkOrderWithAudit(orderId, status, patch)
}

export function appendRefineWorkOrderAudit(orderId, event = {}) {
  const order = getRefineWorkOrderById(orderId)
  if (!order) {
    return null
  }
  const auditEvent = buildRefineWorkOrderAuditEvent(event)
  const nextAuditTrail = Array.isArray(order.auditTrail)
    ? [...order.auditTrail, auditEvent]
    : [auditEvent]
  return updateRefineWorkOrderStatus(orderId, order.status, {
    auditTrail: nextAuditTrail
  })
}

export function assignRefineWorkOrder(orderId, designer = {}) {
  const designerInfo = typeof designer === 'string'
    ? { designerId: designer, designerName: designer }
    : designer
  return updateRefineWorkOrderWithAudit(orderId, REFINE_ORDER_STATUS.ASSIGNED, {
    designer: {
      designerId: designerInfo.designerId || 'designer_mock',
      designerName: designerInfo.designerName || 'Mock Designer'
    },
    assignedAt: new Date().toISOString()
  }, {
    eventType: 'refine_order_assigned',
    actorType: 'designer',
    actorId: designerInfo.designerId || 'designer_mock',
    summary: '设计师领取人工精修工单'
  })
}

export function startRefineWorkOrder(orderId) {
  return updateRefineWorkOrderWithAudit(orderId, REFINE_ORDER_STATUS.PROCESSING, {
    processingStartedAt: new Date().toISOString()
  }, {
    eventType: 'refine_order_processing_started',
    actorType: 'designer',
    actorId: 'designer_mock',
    summary: '设计师开始处理人工精修工单'
  })
}

export function deliverRefineWorkOrder(orderId, deliverable = {}) {
  const deliverableUrl = deliverable.deliverableUrl || deliverable.url || `mock_refine_deliverable_${Date.now()}`
  return updateRefineWorkOrderWithAudit(orderId, REFINE_ORDER_STATUS.DELIVERED, {
    deliverable: {
      deliverableUrl,
      note: deliverable.note || '精修结果占位交付'
    },
    deliverableUrl,
    deliveredAt: new Date().toISOString()
  }, {
    eventType: 'refine_order_delivered',
    actorType: 'designer',
    actorId: 'designer_mock',
    summary: '设计师标记精修结果已交付'
  })
}

export function approveRefineWorkOrder(orderId) {
  return updateRefineWorkOrderWithAudit(orderId, REFINE_ORDER_STATUS.APPROVED, {
    approvedAt: new Date().toISOString()
  }, {
    eventType: 'refine_order_approved',
    actorType: 'customer',
    actorId: 'customer_mock',
    summary: '客户确认精修结果'
  })
}

export function rejectRefineWorkOrder(orderId, reason = '') {
  return updateRefineWorkOrderWithAudit(orderId, REFINE_ORDER_STATUS.REJECTED, {
    rejectedAt: new Date().toISOString(),
    rejectReason: reason || '客户驳回精修结果'
  }, {
    eventType: 'refine_order_rejected',
    actorType: 'customer',
    actorId: 'customer_mock',
    summary: reason || '客户驳回精修结果'
  })
}

export function cancelRefineWorkOrder(orderId, reason = '') {
  return updateRefineWorkOrderWithAudit(orderId, REFINE_ORDER_STATUS.CANCELLED, {
    cancelledAt: new Date().toISOString(),
    cancelReason: reason || '后台取消精修工单'
  }, {
    eventType: 'refine_order_cancelled',
    actorType: 'admin',
    actorId: 'admin_mock',
    summary: reason || '后台取消精修工单'
  })
}
