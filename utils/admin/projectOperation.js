import { getMainChainState } from '../mainChainState'
import { getUserAssets } from '../asset/assetRepository'
import { getProjectDeliveries } from '../project/deliveryRepository'
import { getProjectLeadSnapshots } from '../project/projectFromLead'
import { getProjectById, getProjectDetail, updateProject } from '../project/projectRepository'
import { getAdminLeadList, getAdminProjectById } from '../service/adminRepository'
import { assertAdminPermission, getCurrentAdminUser } from './roleRepository'

const PROJECT_OPERATION_STORAGE_KEY = 'diebiandesign_project_operations'

export const ADMIN_PROJECT_STATUS_OPTIONS = Object.freeze([
  { value: 'requirement_confirmation', label: '需求确认' },
  { value: 'designing', label: '设计中' },
  { value: 'generating', label: '生成中' },
  { value: 'pending_review', label: '待审核' },
  { value: 'delivered', label: '已交付' }
])

const STATUS_ALIASES = Object.freeze({
  active: 'requirement_confirmation',
  pending: 'requirement_confirmation',
  requirement_confirmed: 'requirement_confirmation',
  quoted: 'requirement_confirmation',
  planning: 'requirement_confirmation',
  design: 'designing',
  draft: 'designing',
  in_progress: 'designing',
  execution: 'generating',
  processing: 'generating',
  first_draft_ready: 'pending_review',
  review: 'pending_review',
  revising: 'pending_review',
  completed: 'delivered',
  final_delivery: 'delivered',
  closed: 'delivered'
})

function uniqueIds(values = []) {
  return [...new Set((Array.isArray(values) ? values : []).filter(Boolean))]
}

function normalizeStatus(status = '') {
  const normalized = STATUS_ALIASES[status] || status
  return ADMIN_PROJECT_STATUS_OPTIONS.some((option) => option.value === normalized)
    ? normalized
    : 'requirement_confirmation'
}

function readOperations() {
  try {
    const operations = uni.getStorageSync(PROJECT_OPERATION_STORAGE_KEY)
    return Array.isArray(operations) ? operations : []
  } catch (error) {
    return []
  }
}

function writeOperations(operations = []) {
  uni.setStorageSync(PROJECT_OPERATION_STORAGE_KEY, operations)
}

function getProjectOperationLogs(projectId = '') {
  return readOperations()
    .filter((operation) => operation.projectId === projectId)
    .sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt)))
}

function getEffectiveStatus(project = {}, operations = []) {
  return operations.length ? normalizeStatus(operations[0].afterStatus) : normalizeStatus(project.status || project.stage)
}

function getTaskImageUrl(task = {}) {
  const result = task.result || {}
  const firstItem = Array.isArray(result.items) ? result.items[0] : null
  return task.resultImageUrl ||
    (typeof result.image === 'string' ? result.image : result.image && (result.image.url || result.image.imageUrl)) ||
    (typeof firstItem === 'string' ? firstItem : firstItem && (firstItem.url || firstItem.imageUrl)) ||
    ''
}

function normalizeTask(task = {}) {
  return {
    taskId: String(task.taskId || ''),
    batchId: String(task.batchId || ''),
    status: task.status || 'pending',
    coverUrl: getTaskImageUrl(task),
    createdAt: task.createdAt || task.updatedAt || ''
  }
}

function normalizeBatch(batch = {}, batchId = '') {
  return {
    batchId: String(batch.batchId || batchId || ''),
    batchName: batch.batchName || batch.name || '批量任务',
    status: batch.status || 'pending',
    taskIds: uniqueIds(batch.taskIds),
    createdAt: batch.createdAt || batch.updatedAt || ''
  }
}

function findLead(leadId = '') {
  if (!leadId) return null
  const leads = [...getAdminLeadList(), ...getProjectLeadSnapshots()]
  return leads.reverse().find((lead) => lead.leadId === leadId) || null
}

export function getAdminProjectOperationDetail(projectId = '', fallbackProject = {}) {
  const localProject = getProjectById(projectId)
  const adminProject = getAdminProjectById(projectId)
  const project = localProject || adminProject || fallbackProject
  if (!project || !projectId) return null

  const localDetail = localProject ? getProjectDetail(projectId) : null
  const state = getMainChainState()
  const tasksById = (state.tasks && state.tasks.byId) || {}
  const batchesById = (state.batches && state.batches.byId) || {}
  const assetIds = uniqueIds(project.assetIds)
  const taskIds = uniqueIds(project.taskIds)
  const batchIds = uniqueIds(project.batchIds)
  const assets = localDetail
    ? localDetail.assets
    : getUserAssets().all.filter((asset) => assetIds.includes(asset.assetId))
  const tasks = localDetail
    ? localDetail.tasks
    : taskIds.map((taskId) => tasksById[taskId]).filter(Boolean).map(normalizeTask)
  const batches = localDetail
    ? localDetail.batches
    : batchIds.map((batchId) => normalizeBatch(batchesById[batchId] || {}, batchId))
  const operations = getProjectOperationLogs(projectId)
  const lead = findLead(project.leadId)

  return {
    project: {
      ...project,
      projectId,
      projectName: project.projectName || project.name || '未命名项目',
      customerName: project.customerName || project.contactName || (lead && (lead.customerName || lead.contactName)) || '未填写客户',
      customerContact: project.customerContact || (lead && (lead.customerContact || lead.mobile || lead.phone || lead.wechat)) || '暂无',
      deadline: project.deadline || project.expectedDeliveryDate || project.expectedDeliveryTime || '',
      status: getEffectiveStatus(project, operations)
    },
    lead: lead ? {
      leadId: lead.leadId,
      companyName: lead.companyName || lead.brandName || '未填写公司',
      demandType: lead.demandType || 'design_service',
      clothingCategory: lead.clothingCategory || lead.productCategory || '',
      quantity: lead.quantity || lead.expectedVolume || '',
      description: lead.description || lead.requirementText || '',
      createdAt: lead.createdAt || lead.updatedAt || ''
    } : null,
    assets,
    tasks,
    batches,
    deliveries: getProjectDeliveries(projectId),
    operations
  }
}

export function updateAdminProjectLifecycle(input = {}) {
  const operatorUser = input.operatorUser || getCurrentAdminUser()
  assertAdminPermission(operatorUser, 'project:update')
  const projectId = String(input.projectId || '').trim()
  const afterStatus = normalizeStatus(input.afterStatus)
  const detail = getAdminProjectOperationDetail(projectId, input.project)
  if (!detail) throw new Error('项目不存在')
  const beforeStatus = detail.project.status
  if (beforeStatus === afterStatus) return detail

  const localProject = getProjectById(projectId)
  if (localProject) {
    updateProject(projectId, { status: afterStatus })
  }

  const operation = {
    actionId: `action_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    projectId,
    actionType: 'status_change',
    beforeStatus,
    afterStatus,
    operator: String(input.operator || operatorUser.name || '管理员').trim() || '管理员',
    operatorId: String(operatorUser.userId || ''),
    operatorRole: String(operatorUser.role || ''),
    remark: String(input.remark || '').trim(),
    createdAt: new Date().toISOString()
  }
  writeOperations([operation, ...readOperations()])
  console.log('[project:operation]', {
    projectId,
    operatorId: operation.operatorId,
    role: operation.operatorRole,
    actionType: operation.actionType,
    beforeStatus,
    afterStatus
  })
  return getAdminProjectOperationDetail(projectId, input.project)
}

export function getAdminProjectStatusLabel(status = '') {
  const option = ADMIN_PROJECT_STATUS_OPTIONS.find((item) => item.value === normalizeStatus(status))
  return option ? option.label : '需求确认'
}

export function formatProjectOperationTime(value = '') {
  const date = value ? new Date(value) : null
  if (!date || Number.isNaN(date.getTime())) return '刚刚'
  const pad = (number) => String(number).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}
