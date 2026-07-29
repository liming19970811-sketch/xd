import { getMainChainState } from '../mainChainState'
import { getBatchList, getBatchLogs } from '../service/batchStore'
import { getProjectList, getProjectNotes } from '../service/projectStore'

const PROJECT_ACTIONS = new Set([
  'approve_deliverable_batches_in_project',
  'mark_pending_review_batches_as_needs_revision_in_project'
])

const BATCH_ACTIONS = new Set([
  'approve_deliverable_results',
  'mark_pending_review_as_needs_revision'
])

const RESULT_ACTIONS = new Set([
  'approve_result',
  'mark_needs_revision'
])

function hasTaskResult(task) {
  return !!(
    (task && task.result && task.result.coverUrl) ||
    (task && task.result && Array.isArray(task.result.items) && task.result.items.length)
  )
}

function getTaskTime(task) {
  return (task && (task.updatedAt || task.completedAt || task.submittedAt || task.createdAt)) || ''
}

function getBatchReviewableTasks(batch, tasksById = {}) {
  const taskIds = Array.isArray(batch && batch.taskIds) ? batch.taskIds : []
  return taskIds
    .map((taskId) => tasksById[taskId])
    .filter((task) => task && hasTaskResult(task))
}

function pickBatchTargetTask(batch, actionType, tasksById = {}) {
  const reviewableTasks = getBatchReviewableTasks(batch, tasksById)
  if (!reviewableTasks.length) {
    return null
  }
  const sortedTasks = reviewableTasks.slice().sort((left, right) => String(getTaskTime(right)).localeCompare(String(getTaskTime(left))))
  if (actionType === 'mark_pending_review_as_needs_revision') {
    return (
      sortedTasks.find((task) => (task.deliveryStatus || 'pending_review') === 'needs_revision') ||
      sortedTasks.find((task) => (task.deliveryStatus || 'pending_review') === 'pending_review') ||
      sortedTasks[0]
    )
  }
  if (actionType === 'approve_deliverable_results') {
    return (
      sortedTasks.find((task) => (task.deliveryStatus || 'pending_review') === 'approved') ||
      sortedTasks.find((task) => (task.deliveryStatus || 'pending_review') === 'pending_review') ||
      sortedTasks[0]
    )
  }
  return sortedTasks[0]
}

function pickProjectTargetBatch(project, actionType, batchList = [], tasksById = {}) {
  const batchIds = Array.isArray(project && project.batchIds) ? project.batchIds : []
  const projectBatches = batchList
    .filter((batch) => batch && batch.projectId === project.projectId)
    .filter((batch) => !batchIds.length || batchIds.includes(batch.batchId))
  if (!projectBatches.length) {
    return null
  }
  const sortedBatches = projectBatches
    .slice()
    .sort((left, right) => String((right && (right.updatedAt || right.createdAt)) || '').localeCompare(String((left && (left.updatedAt || left.createdAt)) || '')))
  if (actionType === 'mark_pending_review_batches_as_needs_revision_in_project') {
    return (
      sortedBatches.find((batch) => {
        const tasks = getBatchReviewableTasks(batch, tasksById)
        return tasks.some((task) => (task.deliveryStatus || 'pending_review') === 'needs_revision')
      }) || sortedBatches[0]
    )
  }
  if (actionType === 'approve_deliverable_batches_in_project') {
    return (
      sortedBatches.find((batch) => {
        const tasks = getBatchReviewableTasks(batch, tasksById)
        return tasks.some((task) => (task.deliveryStatus || 'pending_review') === 'approved')
      }) || sortedBatches[0]
    )
  }
  return sortedBatches[0]
}

function getModeByAction(actionType = '') {
  if (actionType === 'approve_deliverable_batches_in_project' || actionType === 'approve_deliverable_results' || actionType === 'approve_result') {
    return {
      mode: 'delivery-view',
      reviewContext: ''
    }
  }
  if (
    actionType === 'mark_pending_review_batches_as_needs_revision_in_project' ||
    actionType === 'mark_pending_review_as_needs_revision' ||
    actionType === 'mark_needs_revision'
  ) {
    return {
      mode: 'delivery-review',
      reviewContext: 'needs_revision'
    }
  }
  return {
    mode: '',
    reviewContext: ''
  }
}

function parseProjectActionType(content = '') {
  const matched = String(content).match(/^\[([^\]]+)\]/)
  return (matched && matched[1]) || ''
}

function normalizeAction(item = {}) {
  const createdAt = item.createdAt || item.time || ''
  const actionLevel = item.actionLevel || item.level || 'unknown'
  return {
    actionLevel,
    actionType: item.actionType || '',
    actionSource: item.actionSource || '',
    triggeredFrom: item.triggeredFrom || '',
    projectId: item.projectId || '',
    batchId: item.batchId || '',
    taskId: item.taskId || '',
    createdAt,
    targetMode: item.targetMode || '',
    targetReviewContext: item.targetReviewContext || '',
    // backward-compatible fields for existing pages
    level: actionLevel,
    time: createdAt
  }
}

function buildDeliveryActions(state = getMainChainState()) {
  const tasksById = (state.tasks && state.tasks.byId) || {}
  const batchList = getBatchList()
  const projectList = getProjectList()
  const deliveryAudits = Array.isArray(state.deliveryAudits) ? state.deliveryAudits : []
  const actions = []

  projectList.forEach((project) => {
    const notes = getProjectNotes(project.projectId).slice(0, 5)
    notes.forEach((note) => {
      const actionType = parseProjectActionType(note.content || '')
      if (!PROJECT_ACTIONS.has(actionType)) {
        return
      }
      const targetBatch = pickProjectTargetBatch(project, actionType, batchList, tasksById)
      const modePair = getModeByAction(actionType)
      actions.push({
        actionLevel: 'project',
        actionType,
        actionSource: 'Project Level Batch Review',
        triggeredFrom: 'project-detail / Project Batch Review Actions',
        createdAt: note.createdAt || '',
        projectId: project.projectId || '',
        batchId: targetBatch && targetBatch.batchId ? targetBatch.batchId : '',
        taskId: '',
        targetMode: modePair.mode,
        targetReviewContext: modePair.reviewContext
      })
    })
  })

  batchList.forEach((batch) => {
    const logs = getBatchLogs(batch.batchId).slice(0, 8)
    logs.forEach((log) => {
      const actionType = (log && log.action) || ''
      if (!BATCH_ACTIONS.has(actionType)) {
        return
      }
      const modePair = getModeByAction(actionType)
      const linkedTask = (log && log.relatedTaskId && tasksById[log.relatedTaskId]) || pickBatchTargetTask(batch, actionType, tasksById) || null
      actions.push({
        actionLevel: 'batch',
        actionType,
        actionSource: 'Batch Level Quick Review',
        triggeredFrom: 'batch-detail / Batch Actions quick review buttons',
        createdAt: (log && log.createdAt) || '',
        projectId: batch.projectId || '',
        batchId: batch.batchId || '',
        taskId: (linkedTask && linkedTask.taskId) || '',
        targetMode: modePair.mode,
        targetReviewContext: modePair.reviewContext
      })
    })
  })

  deliveryAudits.forEach((audit) => {
    const actionType = (audit && audit.action) || ''
    if (!RESULT_ACTIONS.has(actionType)) {
      return
    }
    const modePair = getModeByAction(actionType)
    const task = tasksById[audit.taskId] || null
    actions.push({
      actionLevel: 'result',
      actionType,
      actionSource: 'Single Task Review',
      triggeredFrom: 'result / Delivery Status actions',
      createdAt: (audit && audit.createdAt) || '',
      projectId: (audit && audit.projectId) || (task && task.projectId) || '',
      batchId: (audit && audit.batchId) || (task && task.batchId) || '',
      taskId: (audit && audit.taskId) || '',
      targetMode: modePair.mode,
      targetReviewContext: modePair.reviewContext
    })
  })

  return actions.map((item) => normalizeAction(item))
}

export function getRecentDeliveryActions(limit = 30) {
  const actions = buildDeliveryActions(getMainChainState())

  return actions
    .filter((item) => item && item.actionType && item.createdAt)
    .sort((left, right) => String(right.createdAt || '').localeCompare(String(left.createdAt || '')))
    .slice(0, Math.max(1, limit))
}

export function getProjectRecentDeliveryActions(projectId = '', limit = 5) {
  if (!projectId) {
    return []
  }
  return getRecentDeliveryActions(200)
    .filter((item) => item.actionLevel === 'project' && item.projectId === projectId)
    .slice(0, Math.max(1, limit))
}

export function getBatchRecentDeliveryActions(batchId = '', limit = 5) {
  if (!batchId) {
    return []
  }
  return getRecentDeliveryActions(200)
    .filter((item) => item.actionLevel === 'batch' && item.batchId === batchId)
    .slice(0, Math.max(1, limit))
}

export function getResultRecentDeliveryActions(taskId = '', limit = 5) {
  if (!taskId) {
    return []
  }
  return getRecentDeliveryActions(200)
    .filter((item) => item.actionLevel === 'result' && item.taskId === taskId)
    .slice(0, Math.max(1, limit))
}

export function getDeliveryActionTarget(item = {}) {
  if (!item || !(item.actionLevel || item.level)) {
    return null
  }
  const actionLevel = item.actionLevel || item.level || ''
  const mode = item.targetMode || ''
  const reviewContext = item.targetReviewContext || ''
  if (actionLevel === 'project') {
    if (item.batchId) {
      return {
        page: 'batch-detail',
        url: `/package-mobile-enterprise/batch-detail/batch-detail?batchId=${encodeURIComponent(item.batchId)}${mode ? `&mode=${encodeURIComponent(mode)}` : ''}${reviewContext ? `&reviewContext=${encodeURIComponent(reviewContext)}` : ''}`
      }
    }
    if (item.projectId) {
      return {
        page: 'project-detail',
        url: `/package-mobile-enterprise/project-detail/project-detail?projectId=${encodeURIComponent(item.projectId)}${mode ? `&mode=${encodeURIComponent(mode)}` : ''}${reviewContext ? `&reviewContext=${encodeURIComponent(reviewContext)}` : ''}`
      }
    }
    return null
  }
  if (actionLevel === 'batch') {
    if (item.taskId) {
      return {
        page: 'result',
        url: `/package-ai/result/result?taskId=${encodeURIComponent(item.taskId)}${item.batchId ? `&batchId=${encodeURIComponent(item.batchId)}` : ''}${item.projectId ? `&projectId=${encodeURIComponent(item.projectId)}` : ''}${mode ? `&mode=${encodeURIComponent(mode)}` : ''}${reviewContext ? `&reviewContext=${encodeURIComponent(reviewContext)}` : ''}`
      }
    }
    if (item.batchId) {
      return {
        page: 'batch-detail',
        url: `/package-mobile-enterprise/batch-detail/batch-detail?batchId=${encodeURIComponent(item.batchId)}${mode ? `&mode=${encodeURIComponent(mode)}` : ''}${reviewContext ? `&reviewContext=${encodeURIComponent(reviewContext)}` : ''}`
      }
    }
    return null
  }
  if (actionLevel === 'result') {
    if (!item.taskId) {
      return null
    }
    return {
      page: 'result',
      url: `/package-ai/result/result?taskId=${encodeURIComponent(item.taskId)}${item.batchId ? `&batchId=${encodeURIComponent(item.batchId)}` : ''}${item.projectId ? `&projectId=${encodeURIComponent(item.projectId)}` : ''}${mode ? `&mode=${encodeURIComponent(mode)}` : ''}${reviewContext ? `&reviewContext=${encodeURIComponent(reviewContext)}` : ''}`
    }
  }
  return null
}
