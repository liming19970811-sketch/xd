import { getUserAssets } from '../asset/assetRepository'
import { getMainChainState } from '../mainChainState'

const PROJECT_STORAGE_KEY = 'diebiandesign_projects'

export const PROJECT_STATUS = Object.freeze({
  REQUIREMENT_CONFIRMATION: 'requirement_confirmation',
  DESIGNING: 'designing',
  GENERATING: 'generating',
  PENDING_REVIEW: 'pending_review',
  DELIVERED: 'delivered'
})

export const PROJECT_STATUS_OPTIONS = Object.freeze([
  { value: PROJECT_STATUS.REQUIREMENT_CONFIRMATION, label: '需求确认' },
  { value: PROJECT_STATUS.DESIGNING, label: '设计中' },
  { value: PROJECT_STATUS.GENERATING, label: '生成中' },
  { value: PROJECT_STATUS.PENDING_REVIEW, label: '待审核' },
  { value: PROJECT_STATUS.DELIVERED, label: '已交付' }
])

export const PROJECT_VERSION_OPTIONS = Object.freeze([
  { value: 'draft', label: '初稿' },
  { value: 'revision', label: '修改版' },
  { value: 'final', label: '最终版' }
])

const LEGACY_STATUS_MAP = Object.freeze({
  active: PROJECT_STATUS.REQUIREMENT_CONFIRMATION,
  completed: PROJECT_STATUS.DELIVERED,
  archived: PROJECT_STATUS.DELIVERED
})

function normalizeStatus(status = '') {
  const normalizedStatus = LEGACY_STATUS_MAP[status] || status
  return PROJECT_STATUS_OPTIONS.some((option) => option.value === normalizedStatus)
    ? normalizedStatus
    : PROJECT_STATUS.REQUIREMENT_CONFIRMATION
}

function normalizeVersion(version = '') {
  return PROJECT_VERSION_OPTIONS.some((option) => option.value === version) ? version : 'draft'
}

function getDeliveryStatus(status = '', deliveryStatus = '') {
  if (deliveryStatus) {
    return deliveryStatus
  }
  if (status === PROJECT_STATUS.DELIVERED) {
    return 'delivered'
  }
  if (status === PROJECT_STATUS.PENDING_REVIEW) {
    return 'ready'
  }
  return 'pending'
}

function readProjects() {
  try {
    const projects = uni.getStorageSync(PROJECT_STORAGE_KEY)
    return Array.isArray(projects) ? projects.map(normalizeProject) : []
  } catch (error) {
    return []
  }
}

function writeProjects(projects = []) {
  uni.setStorageSync(PROJECT_STORAGE_KEY, projects.map(normalizeProject))
}

function uniqueIds(values = []) {
  return [...new Set((Array.isArray(values) ? values : []).filter(Boolean))]
}

function normalizeProject(project = {}) {
  const now = new Date().toISOString()
  return {
    projectId: String(project.projectId || ''),
    projectName: String(project.projectName || '未命名项目'),
    coverUrl: String(project.coverUrl || ''),
    assetIds: uniqueIds(project.assetIds),
    batchIds: uniqueIds(project.batchIds),
    taskIds: uniqueIds(project.taskIds),
    leadId: String(project.leadId || ''),
    status: normalizeStatus(project.status),
    customerName: String(project.customerName || ''),
    customerContact: String(project.customerContact || ''),
    description: String(project.description || ''),
    deadline: String(project.deadline || ''),
    deliveryStatus: getDeliveryStatus(normalizeStatus(project.status), project.deliveryStatus),
    projectVersion: normalizeVersion(project.projectVersion),
    createdAt: project.createdAt || now,
    updatedAt: project.updatedAt || project.createdAt || now
  }
}

function getTasks(state = {}) {
  const tasksState = state.tasks || {}
  return tasksState.byId || {}
}

function getBatchTaskIds(batchIds = [], state = {}) {
  const selectedBatchIds = new Set(uniqueIds(batchIds))
  const batchesById = (state.batches && state.batches.byId) || {}
  const taskIds = []

  selectedBatchIds.forEach((batchId) => {
    const batch = batchesById[batchId] || {}
    taskIds.push(...uniqueIds(batch.taskIds))
  })

  Object.values(getTasks(state)).forEach((task) => {
    if (task && selectedBatchIds.has(task.batchId)) {
      taskIds.push(task.taskId)
    }
  })

  return uniqueIds(taskIds)
}

function getTaskImageUrl(task = {}) {
  const result = task.result || {}
  const firstItem = Array.isArray(result.items) ? result.items[0] : null
  const firstItemUrl = typeof firstItem === 'string'
    ? firstItem
    : (firstItem && (firstItem.url || firstItem.imageUrl || firstItem.fileUrl)) || ''
  const resultImage = typeof result.image === 'string'
    ? result.image
    : (result.image && (result.image.url || result.image.imageUrl || result.image.fileUrl)) || ''
  return task.resultImageUrl || resultImage || firstItemUrl || ''
}

function getStatusText(status = '') {
  const statusMap = {
    success: '已完成',
    completed: '已完成',
    processing: '生成中',
    queued: '等待生成',
    submitted: '等待生成',
    pending: '等待生成',
    failed: '失败',
    timeout: '失败'
  }
  return statusMap[status] || '待处理'
}

function normalizeTask(task = {}) {
  const params = (task.input && task.input.params) || task.params || {}
  return {
    taskId: task.taskId || '',
    batchId: task.batchId || '',
    coverUrl: getTaskImageUrl(task),
    status: task.status || 'pending',
    statusText: getStatusText(task.status),
    createdAt: task.completedAt || task.updatedAt || task.createdAt || '',
    modelName: params.modelName || '默认模特',
    colorName: params.targetColorName || params.colorName || '原色',
    sceneName: params.sceneName || params.sceneType || '默认场景'
  }
}

export function getProjects() {
  return readProjects().sort((left, right) => String(right.updatedAt).localeCompare(String(left.updatedAt)))
}

export function getProjectById(projectId = '') {
  return getProjects().find((project) => project.projectId === projectId) || null
}

export function getProjectByLeadId(leadId = '') {
  const normalizedLeadId = String(leadId || '').trim()
  if (!normalizedLeadId) {
    return null
  }
  return getProjects().find((project) => project.leadId === normalizedLeadId) || null
}

export function getProjectStatusLabel(status = '') {
  const option = PROJECT_STATUS_OPTIONS.find((item) => item.value === normalizeStatus(status))
  return option ? option.label : '需求确认'
}

export function getProjectVersionLabel(version = '') {
  const option = PROJECT_VERSION_OPTIONS.find((item) => item.value === normalizeVersion(version))
  return option ? option.label : '初稿'
}

export function createProject(input = {}) {
  const state = getMainChainState()
  const assets = getUserAssets().all || []
  const assetIds = uniqueIds(input.assetIds)
  const batchIds = uniqueIds(input.batchIds)
  const selectedAssets = assets.filter((asset) => assetIds.includes(asset.assetId))
  const sourceTaskIds = selectedAssets
    .filter((asset) => asset.assetType === 'clothing' || asset.assetType === 'image')
    .map((asset) => asset.sourceId)
  const taskIds = uniqueIds([
    ...input.taskIds || [],
    ...sourceTaskIds,
    ...getBatchTaskIds(batchIds, state)
  ])
  const now = new Date().toISOString()
  const project = normalizeProject({
    projectId: `project_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    projectName: input.projectName,
    coverUrl: input.coverUrl || (selectedAssets.find((asset) => asset.coverUrl) || {}).coverUrl || '',
    assetIds,
    batchIds,
    taskIds,
    leadId: input.leadId,
    status: input.status || PROJECT_STATUS.REQUIREMENT_CONFIRMATION,
    customerName: input.customerName,
    customerContact: input.customerContact,
    description: input.description,
    deadline: input.deadline,
    deliveryStatus: input.deliveryStatus,
    projectVersion: input.projectVersion || 'draft',
    createdAt: now,
    updatedAt: now
  })
  const projects = readProjects()
  writeProjects([project, ...projects])
  console.log('[project:create]', {
    projectId: project.projectId,
    assetCount: project.assetIds.length,
    taskCount: project.taskIds.length
  })
  return project
}

export function updateProject(projectId = '', patch = {}) {
  const projects = readProjects()
  const projectIndex = projects.findIndex((project) => project.projectId === projectId)
  if (projectIndex < 0) {
    return null
  }
  const currentProject = projects[projectIndex]
  const nextStatus = patch.status ? normalizeStatus(patch.status) : currentProject.status
  const nextProject = normalizeProject({
    ...currentProject,
    ...patch,
    projectId: currentProject.projectId,
    assetIds: currentProject.assetIds,
    batchIds: currentProject.batchIds,
    taskIds: currentProject.taskIds,
    leadId: currentProject.leadId,
    status: nextStatus,
    deliveryStatus: patch.deliveryStatus || getDeliveryStatus(nextStatus),
    updatedAt: new Date().toISOString()
  })
  projects.splice(projectIndex, 1, nextProject)
  writeProjects(projects)
  console.log('[project:update]', {
    projectId: nextProject.projectId,
    status: nextProject.status,
    version: nextProject.projectVersion
  })
  return nextProject
}

export function getProjectDetail(projectId = '') {
  const project = getProjectById(projectId)
  if (!project) {
    return null
  }
  const state = getMainChainState()
  const assets = getUserAssets().all || []
  const tasksById = getTasks(state)
  const batchesById = (state.batches && state.batches.byId) || {}
  const projectAssets = assets.filter((asset) => project.assetIds.includes(asset.assetId))
  const tasks = project.taskIds.map((taskId) => tasksById[taskId]).filter(Boolean).map(normalizeTask)
  const batches = project.batchIds.map((batchId) => {
    const source = batchesById[batchId] || {}
    const batchTasks = tasks.filter((task) => task.batchId === batchId)
    return {
      batchId,
      name: source.batchName || '批量素材',
      status: source.status || 'processing',
      statusText: getStatusText(source.status),
      taskCount: uniqueIds(source.taskIds).length || batchTasks.length,
      createdAt: source.createdAt || project.createdAt
    }
  })

  return {
    project,
    assets: projectAssets,
    tasks,
    batches,
    works: tasks.filter((task) => task.coverUrl)
  }
}

export function formatProjectTime(value = '') {
  const date = value ? new Date(value) : null
  if (!date || Number.isNaN(date.getTime())) {
    return '刚刚'
  }
  const pad = (number) => String(number).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}
