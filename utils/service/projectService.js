import { getById as getProjectById, update as updateProject } from '../repository/projectRepository.js'
import { emit, on } from '../events/eventBus.js'
import { CUSTOMER_FEEDBACK_CREATED, DELIVERY_CONFIRMED, ORDER_CREATED, PRODUCT_READY, PROJECT_STATUS_CHANGED } from '../events/businessEvents.js'

export const PROJECT_STATUS_FLOW = Object.freeze(['draft', 'planning', 'in_progress', 'reviewing', 'completed', 'archived'])

export function getProjectStatus(project = {}) {
  return PROJECT_STATUS_FLOW.includes(project.status) ? project.status : 'draft'
}

export function updateProjectStatus(projectId = '', status = 'draft', patch = {}) {
  if (!projectId || !PROJECT_STATUS_FLOW.includes(status)) return null
  const previous = getProjectById(projectId)
  const project = updateProject(projectId, { ...patch, status })
  if (project && previous?.status !== status) {
    emit(PROJECT_STATUS_CHANGED, { project, previousStatus: previous?.status || 'draft', status, before: previous, after: project })
  }
  return project
}

function syncProjectStatus(projectId = '', status = 'draft', sourceEvent = '') {
  const project = getProjectById(projectId)
  if (!project || ['completed', 'archived'].includes(project.status)) return project
  return updateProjectStatus(projectId, status, { statusSource: sourceEvent })
}

export function calculateProjectProgress(project = {}, related = {}) {
  const lifecycleEvents = Array.isArray(related.lifecycleEvents) ? related.lifecycleEvents : []
  if (lifecycleEvents.length) {
    return Math.round((lifecycleEvents.filter((item) => item.completed).length / lifecycleEvents.length) * 100)
  }
  const products = Array.isArray(related.products) ? related.products : []
  const deliveries = Array.isArray(related.deliveries) ? related.deliveries : []
  if (getProjectStatus(project) === 'completed') return 100
  if (deliveries.some((item) => ['delivered', 'confirmed'].includes(item.status))) return 90
  if (products.length) return Math.min(80, 25 + products.length * 10)
  if (project.projectGoal || project.goal || project.requirement) return 20
  return 10
}

export function buildProjectTimeline(project = {}, related = {}) {
  const events = []
  const append = (time, name, description) => {
    if (time) events.push({ time, name, description })
  }
  append(project.createdAt, '创建项目', project.title || project.projectName || '企业项目')
  ;(Array.isArray(related.products) ? related.products : []).forEach((item) => {
    append(item.createdAt, '生成商品', item.title || item.productInfo?.productTitle || '商品资料包')
  })
  ;(Array.isArray(related.deliveries) ? related.deliveries : []).forEach((item) => {
    append(item.createdAt, '开始交付', item.deliveryId || '交付记录')
    append(item.completedAt, '客户确认', item.deliveryId || '交付记录')
  })
  append(project.updatedAt, '更新项目', project.statusText || project.description || '')
  return events.sort((left, right) => String(right.time).localeCompare(String(left.time)))
}

export function getProjectOverview(projectId = '', related = {}) {
  const project = getProjectById(projectId)
  if (!project) return null
  return {
    ...project,
    status: getProjectStatus(project),
    progress: calculateProjectProgress(project, related),
    timeline: buildProjectTimeline(project, related)
  }
}

on(ORDER_CREATED, ({ order = {} } = {}) => syncProjectStatus(order.projectId, 'in_progress', ORDER_CREATED))
on(PRODUCT_READY, ({ projectId = '', product = {} } = {}) => syncProjectStatus(projectId || product.projectId, 'reviewing', PRODUCT_READY))
on(DELIVERY_CONFIRMED, ({ delivery = {} } = {}) => {
  if (!delivery.projectId) return null
  return updateProjectStatus(delivery.projectId, 'completed', { statusSource: DELIVERY_CONFIRMED })
})
on(CUSTOMER_FEEDBACK_CREATED, ({ delivery = {}, feedback = {} } = {}) => {
  const revisionRequired = feedback.type === '修改建议' || feedback.status === 'revision_required'
  return revisionRequired ? syncProjectStatus(delivery.projectId, 'reviewing', CUSTOMER_FEEDBACK_CREATED) : null
})
