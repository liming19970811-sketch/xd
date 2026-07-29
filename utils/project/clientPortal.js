import { getAdminProjectOperationDetail } from '../admin/projectOperation'

const CLIENT_PORTAL_STORAGE_KEY = 'diebiandesign_client_portals'
const CLIENT_FEEDBACK_STORAGE_KEY = 'diebiandesign_client_feedback'

export const CLIENT_PORTAL_PERMISSIONS = Object.freeze([
  'project:view',
  'work:view',
  'batch:view',
  'delivery:view',
  'proposal:confirm',
  'feedback:create'
])

function readList(storageKey) {
  try {
    const list = uni.getStorageSync(storageKey)
    return Array.isArray(list) ? list : []
  } catch (error) {
    return []
  }
}

function writeList(storageKey, list = []) {
  uni.setStorageSync(storageKey, list)
}

function uniqueImages(images = []) {
  const seen = new Set()
  return images.filter((image) => {
    const url = String(image && image.url || '').trim()
    if (!url || seen.has(url)) return false
    seen.add(url)
    return true
  })
}

function getAssetUrl(asset = {}) {
  return String(asset.coverUrl || asset.url || asset.imageUrl || '').trim()
}

function getDeliveryAssetUrl(asset = {}) {
  return typeof asset === 'string'
    ? asset
    : String(asset.url || asset.coverUrl || '').trim()
}

function normalizePortal(portal = {}) {
  return {
    portalId: String(portal.portalId || ''),
    projectId: String(portal.projectId || ''),
    customerName: String(portal.customerName || '企业客户'),
    viewToken: String(portal.viewToken || ''),
    permissions: Array.isArray(portal.permissions) ? [...portal.permissions] : [...CLIENT_PORTAL_PERMISSIONS],
    createdAt: portal.createdAt || new Date().toISOString()
  }
}

function normalizeFeedback(feedback = {}) {
  return {
    feedbackId: String(feedback.feedbackId || ''),
    projectId: String(feedback.projectId || ''),
    content: String(feedback.content || '').trim(),
    createdAt: feedback.createdAt || new Date().toISOString()
  }
}

function hasPortalPermission(portal = {}, permission = '') {
  return Array.isArray(portal.permissions) && portal.permissions.includes(permission)
}

function requirePortalPermission(portal = {}, permission = '') {
  if (!hasPortalPermission(portal, permission)) {
    throw new Error('客户门户无此操作权限')
  }
}

function getOrCreatePortal(project = {}) {
  const portals = readList(CLIENT_PORTAL_STORAGE_KEY).map(normalizePortal)
  const existing = portals.find((portal) => portal.projectId === project.projectId)
  if (existing) return existing
  const portal = normalizePortal({
    portalId: `portal_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    projectId: project.projectId,
    customerName: project.customerName,
    viewToken: `view_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`,
    permissions: CLIENT_PORTAL_PERMISSIONS,
    createdAt: new Date().toISOString()
  })
  writeList(CLIENT_PORTAL_STORAGE_KEY, [portal, ...portals])
  return portal
}

function collectWorks(detail = {}) {
  const taskWorks = (detail.tasks || []).map((task) => ({
    sourceId: task.taskId,
    url: task.coverUrl || '',
    status: task.status || 'pending'
  }))
  const assetWorks = (detail.assets || []).map((asset) => ({
    sourceId: asset.assetId,
    url: getAssetUrl(asset),
    status: asset.status || 'success'
  }))
  const deliveryWorks = (detail.deliveries || []).flatMap((delivery) => (
    (delivery.assets || []).map((asset) => ({
      sourceId: typeof asset === 'string' ? asset : asset.assetId || asset.taskId,
      url: getDeliveryAssetUrl(asset),
      status: delivery.status || 'pending_review'
    }))
  ))
  return uniqueImages([...deliveryWorks, ...taskWorks, ...assetWorks])
}

function getBatchProgress(detail = {}) {
  const taskMap = new Map((detail.tasks || []).map((task) => [task.taskId, task]))
  return (detail.batches || []).map((batch) => {
    const taskIds = Array.isArray(batch.taskIds) ? batch.taskIds : []
    const tasks = taskIds.length
      ? taskIds.map((taskId) => taskMap.get(taskId)).filter(Boolean)
      : (detail.tasks || []).filter((task) => task.batchId === batch.batchId)
    const completedCount = tasks.filter((task) => ['success', 'completed'].includes(task.status)).length
    const failedCount = tasks.filter((task) => task.status === 'failed').length
    const totalCount = Math.max(Number(batch.taskCount) || 0, taskIds.length, tasks.length)
    return {
      batchId: batch.batchId,
      status: batch.status || 'pending',
      totalCount,
      completedCount,
      failedCount
    }
  })
}

export function getClientPortalFeedback(projectId = '') {
  return readList(CLIENT_FEEDBACK_STORAGE_KEY)
    .map(normalizeFeedback)
    .filter((feedback) => feedback.projectId === projectId)
    .sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt)))
}

export function getClientPortalView(projectId = '', fallbackProject = {}) {
  const detail = getAdminProjectOperationDetail(projectId, fallbackProject)
  if (!detail) return null
  const portal = getOrCreatePortal(detail.project)
  const latestDelivery = detail.deliveries[0] || null
  return {
    portal,
    project: detail.project,
    demand: detail.lead,
    currentVersion: (latestDelivery && latestDelivery.version) || detail.project.projectVersion || 'draft',
    works: collectWorks(detail),
    batches: getBatchProgress(detail),
    deliveries: detail.deliveries,
    feedbacks: getClientPortalFeedback(projectId)
  }
}

export function submitClientFeedback(input = {}) {
  const portal = normalizePortal(input.portal)
  requirePortalPermission(portal, 'feedback:create')
  const content = String(input.content || '').trim()
  if (!content) throw new Error('请填写修改意见')
  const feedback = normalizeFeedback({
    feedbackId: `feedback_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    projectId: portal.projectId,
    content,
    createdAt: new Date().toISOString()
  })
  writeList(CLIENT_FEEDBACK_STORAGE_KEY, [feedback, ...readList(CLIENT_FEEDBACK_STORAGE_KEY)])
  console.log('[client:feedback]', {
    projectId: feedback.projectId,
    feedbackId: feedback.feedbackId
  })
  return feedback
}

export function confirmClientProposal(portal = {}) {
  requirePortalPermission(portal, 'proposal:confirm')
  return submitClientFeedback({
    portal,
    content: '客户已确认当前方案'
  })
}

export function getClientProjectStatusLabel(status = '') {
  const labels = {
    requirement_confirmation: '需求确认',
    designing: '设计中',
    generating: '生成中',
    pending_review: '待审核',
    delivered: '已交付'
  }
  return labels[status] || '需求确认'
}

export function getClientVersionLabel(version = '') {
  const labels = {
    draft: '初稿',
    revision: '修改版',
    final: '最终版'
  }
  return labels[version] || version || '初稿'
}
