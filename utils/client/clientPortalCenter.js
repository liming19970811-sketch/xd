import { getAdminLeadList } from '../service/adminRepository'
import { getProjectLeadSnapshots } from '../project/projectFromLead'
import { getProjects, getProjectStatusLabel, getProjectVersionLabel } from '../project/projectRepository'
import {
  confirmClientProposal,
  getClientPortalFeedback,
  getClientPortalView,
  submitClientFeedback
} from '../project/clientPortal'
import { getDeliveryPackageStatusLabel, getDeliveryPackages } from '../workspace/deliveryPackage'

const CLIENT_CONFIRM_STORAGE_KEY = 'diebiandesign_client_confirmations_v1'
const CLIENT_AUDIT_STORAGE_KEY = 'diebiandesign_client_audit_v1'

export const CLIENT_PORTAL_TABS = [
  { key: 'overview', label: '客户首页' },
  { key: 'requests', label: '需求进度' },
  { key: 'projects', label: '项目进度' },
  { key: 'deliveries', label: '交付文件' }
]

const REQUEST_STATUS_LABELS = {
  new: '已提交',
  contacted: '已受理',
  qualifying: '需求确认中',
  qualified: '方案准备中',
  proposal: '方案准备中',
  converted: '已转项目',
  closed: '已关闭'
}

const CONFIRM_TYPES = {
  requirement: '需求范围',
  visual_direction: '视觉方向',
  ai_draft: 'AI初稿',
  revision: '修订稿',
  final_delivery: '最终交付'
}

function nowIso() {
  return new Date().toISOString()
}

function readList(key) {
  try {
    const value = uni.getStorageSync(key)
    return Array.isArray(value) ? value : []
  } catch (error) {
    return []
  }
}

function writeList(key, list = []) {
  try {
    uni.setStorageSync(key, list)
  } catch (error) {
    // Customer portal audit is best-effort in local mode.
  }
}

function createId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

function safeText(value = '') {
  return String(value || '').trim()
}

function getClientKey(options = {}) {
  return safeText(options.clientId || options.leadId || options.projectId || options.enterpriseId || '')
}

function matchesClientScope(item = {}, options = {}) {
  const leadId = safeText(options.leadId)
  const projectId = safeText(options.projectId)
  const enterpriseId = safeText(options.enterpriseId)
  const contact = safeText(options.contact || options.phone || options.wechat)
  if (leadId && item.leadId === leadId) return true
  if (projectId && item.projectId === projectId) return true
  if (enterpriseId && item.enterpriseId === enterpriseId) return true
  if (contact && [item.phone, item.mobile, item.customerContact, item.wechat].map(safeText).includes(contact)) return true
  return !leadId && !projectId && !enterpriseId && !contact
}

function normalizeRequest(lead = {}, projectMap = {}) {
  const project = lead.leadId ? projectMap[lead.leadId] : null
  const status = lead.followStatus || lead.status || 'new'
  return {
    leadId: lead.leadId || '',
    companyName: lead.companyName || '',
    contactName: lead.contactName || '',
    demandType: lead.demandType || '',
    description: lead.description || lead.requirementText || '',
    status,
    statusLabel: REQUEST_STATUS_LABELS[status] || '已提交',
    ownerName: lead.ownerName || '待分配',
    nextStep: project ? '查看项目进度并确认下一阶段内容' : getRequestNextStep(status),
    updatedAt: lead.updatedAt || lead.createdAt || '',
    projectId: project ? project.projectId : '',
    attachmentCount: Array.isArray(lead.attachments) ? lead.attachments.length : 0
  }
}

function getRequestNextStep(status = '') {
  const map = {
    new: '等待负责人受理',
    contacted: '确认业务需求和交付目标',
    qualifying: '补充素材和方案细节',
    qualified: '等待方案建议',
    proposal: '确认方案范围',
    converted: '进入项目执行',
    closed: '流程已关闭'
  }
  return map[status] || '等待负责人受理'
}

function normalizeProject(project = {}) {
  const portalView = getClientPortalView(project.projectId, project)
  const confirmations = listClientConfirmations(project.projectId)
  const pendingConfirmations = getPendingConfirmationTypes(project, confirmations)
  return {
    projectId: project.projectId || '',
    projectName: project.projectName || '未命名项目',
    customerName: project.customerName || '',
    status: project.status || '',
    statusLabel: getProjectStatusLabel(project.status),
    versionLabel: getProjectVersionLabel(project.projectVersion),
    progress: getProjectProgress(project.status),
    ownerName: project.ownerName || '项目负责人待分配',
    updatedAt: project.updatedAt || project.createdAt || '',
    deadline: project.deadline || '',
    demand: portalView ? portalView.demand : null,
    works: portalView ? portalView.works.filter((item) => isClientVisibleWork(item)) : [],
    batches: portalView ? portalView.batches : [],
    deliveries: portalView ? portalView.deliveries : [],
    feedbacks: getClientPortalFeedback(project.projectId),
    confirmations,
    pendingConfirmations
  }
}

function getProjectProgress(status = '') {
  const steps = ['需求', '设计', '生产', '审核', '交付', '完成']
  const indexMap = {
    requirement_confirmation: 0,
    designing: 1,
    generating: 2,
    pending_review: 3,
    delivered: 4,
    completed: 5
  }
  const currentIndex = indexMap[status] === undefined ? 0 : indexMap[status]
  return steps.map((label, index) => ({
    label,
    completed: index <= currentIndex,
    active: index === currentIndex
  }))
}

function isClientVisibleWork(work = {}) {
  return ['ready', 'approved', 'delivered', 'success', 'completed'].includes(work.status)
}

function getPendingConfirmationTypes(project = {}, confirmations = []) {
  const confirmedTypes = new Set(confirmations.map((item) => item.confirmType))
  const result = []
  if (!confirmedTypes.has('requirement')) result.push({ key: 'requirement', label: CONFIRM_TYPES.requirement })
  if (['designing', 'generating', 'pending_review', 'delivered'].includes(project.status) && !confirmedTypes.has('visual_direction')) {
    result.push({ key: 'visual_direction', label: CONFIRM_TYPES.visual_direction })
  }
  if (['pending_review', 'delivered'].includes(project.status) && !confirmedTypes.has('ai_draft')) {
    result.push({ key: 'ai_draft', label: CONFIRM_TYPES.ai_draft })
  }
  if (project.projectVersion === 'revision' && !confirmedTypes.has('revision')) {
    result.push({ key: 'revision', label: CONFIRM_TYPES.revision })
  }
  if (project.status === 'delivered' && !confirmedTypes.has('final_delivery')) {
    result.push({ key: 'final_delivery', label: CONFIRM_TYPES.final_delivery })
  }
  return result
}

function normalizeDelivery(project = {}, delivery = {}, deliveryPackage = null) {
  return {
    deliveryId: delivery.deliveryId || (deliveryPackage && deliveryPackage.deliveryId) || '',
    deliveryPackageId: deliveryPackage ? deliveryPackage.deliveryPackageId : '',
    projectId: project.projectId,
    projectName: project.projectName,
    title: (deliveryPackage && deliveryPackage.title) || delivery.title || '项目交付批次',
    fileCount: Array.isArray(delivery.assets) ? delivery.assets.length : (deliveryPackage ? deliveryPackage.assetVersionIds.length : 0),
    fileTypes: delivery.fileTypes || '图片 / 交付文件',
    usageNote: delivery.usageNote || '请按项目约定用途使用，下载链接过期后需重新授权。',
    version: delivery.version || project.projectVersion || 'draft',
    status: (deliveryPackage && deliveryPackage.status) || delivery.status || 'preparing',
    statusLabel: deliveryPackage ? getDeliveryPackageStatusLabel(deliveryPackage.status) : (delivery.status || '准备中'),
    deliveredAt: delivery.deliveredAt || delivery.createdAt || deliveryPackage && deliveryPackage.createdAt || '',
    expiresAt: delivery.expiresAt || '',
    downloadAuthorized: ['delivered', 'confirmed'].includes((deliveryPackage && deliveryPackage.status) || delivery.status)
  }
}

export function listClientConfirmations(projectId = '') {
  return readList(CLIENT_CONFIRM_STORAGE_KEY)
    .filter((item) => !projectId || item.projectId === projectId)
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
}

export function listClientAuditLogs(projectId = '') {
  return readList(CLIENT_AUDIT_STORAGE_KEY)
    .filter((item) => !projectId || item.projectId === projectId)
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
}

export function recordClientAudit(input = {}) {
  const audit = {
    auditId: createId('client_audit'),
    projectId: input.projectId || '',
    deliveryId: input.deliveryId || '',
    action: input.action || '',
    summary: input.summary || '',
    createdAt: nowIso()
  }
  writeList(CLIENT_AUDIT_STORAGE_KEY, [audit, ...readList(CLIENT_AUDIT_STORAGE_KEY)])
  return audit
}

export function confirmClientVersion(input = {}) {
  const projectId = safeText(input.projectId)
  const confirmType = safeText(input.confirmType)
  if (!projectId || !confirmType) throw new Error('确认类型缺失')
  const project = getProjects().find((item) => item.projectId === projectId)
  if (!project) throw new Error('项目不存在')
  const version = input.version || project.projectVersion || 'draft'
  const confirmation = {
    confirmationId: createId('client_confirm'),
    projectId,
    confirmType,
    confirmLabel: CONFIRM_TYPES[confirmType] || confirmType,
    confirmedBy: input.confirmedBy || project.customerName || '企业客户',
    content: input.content || '客户已确认',
    version,
    createdAt: nowIso()
  }
  writeList(CLIENT_CONFIRM_STORAGE_KEY, [confirmation, ...readList(CLIENT_CONFIRM_STORAGE_KEY)])
  const portalView = getClientPortalView(projectId, project)
  if (portalView && portalView.portal) {
    confirmClientProposal(portalView.portal)
  }
  recordClientAudit({
    projectId,
    action: 'client_confirm',
    summary: `${confirmation.confirmLabel} · ${version}`
  })
  return confirmation
}

export function requestClientRevision(input = {}) {
  const projectId = safeText(input.projectId)
  const content = safeText(input.content)
  if (!projectId) throw new Error('项目不存在')
  if (!content) throw new Error('请填写修改意见')
  const project = getProjects().find((item) => item.projectId === projectId)
  const portalView = getClientPortalView(projectId, project || {})
  if (!portalView || !portalView.portal) throw new Error('客户门户不存在')
  const feedback = submitClientFeedback({
    portal: portalView.portal,
    content
  })
  recordClientAudit({
    projectId,
    action: 'client_revision_requested',
    summary: '客户要求修改'
  })
  return feedback
}

export function recordClientDownload(delivery = {}) {
  return recordClientAudit({
    projectId: delivery.projectId || '',
    deliveryId: delivery.deliveryId || '',
    action: 'client_delivery_download',
    summary: `${delivery.title || '交付文件'} 下载`
  })
}

export function buildClientPortalCenter(options = {}) {
  const projectMap = getProjects().reduce((result, project) => {
    if (project.leadId) result[project.leadId] = project
    return result
  }, {})
  const leads = getAdminLeadList()
    .filter((lead) => matchesClientScope(lead, options))
    .map((lead) => normalizeRequest(lead, projectMap))
  const leadSnapshots = getProjectLeadSnapshots()
  const projects = getProjects()
    .filter((project) => matchesClientScope(project, options) || leads.some((lead) => lead.leadId && lead.leadId === project.leadId))
    .map(normalizeProject)
  const deliveries = projects.flatMap((project) => {
    const packages = getDeliveryPackages(project.projectId)
    const rawDeliveries = Array.isArray(project.deliveries) ? project.deliveries : project.deliveries || []
    const portalView = getClientPortalView(project.projectId, project)
    const deliveriesFromPortal = portalView ? portalView.deliveries : []
    const normalizedRaw = (Array.isArray(rawDeliveries) ? rawDeliveries : deliveriesFromPortal).map((delivery) => normalizeDelivery(project, delivery, packages.find((item) => item.deliveryId === delivery.deliveryId)))
    const packageOnly = packages
      .filter((pkg) => !normalizedRaw.some((item) => item.deliveryPackageId === pkg.deliveryPackageId))
      .map((pkg) => normalizeDelivery(project, {}, pkg))
    return [...normalizedRaw, ...packageOnly]
  })
  const pendingConfirmCount = projects.reduce((count, project) => count + project.pendingConfirmations.length, 0)
  const pendingWorkCount = projects.reduce((count, project) => count + project.works.filter((work) => work.status === 'ready' || work.status === 'approved').length, 0)
  const unreadMessages = projects.reduce((count, project) => count + project.feedbacks.filter((item) => !item.readByClient).length, 0)

  return {
    clientKey: getClientKey(options),
    requests: leads,
    leadSnapshots,
    projects,
    deliveries,
    notifications: buildClientNotifications({ leads, projects, deliveries }),
    summary: {
      activeRequests: leads.filter((item) => !['converted', 'closed'].includes(item.status)).length,
      activeProjects: projects.filter((item) => item.status !== 'delivered').length,
      pendingConfirmations: pendingConfirmCount,
      pendingWorks: pendingWorkCount,
      recentDeliveries: deliveries.length,
      unreadMessages
    }
  }
}

function buildClientNotifications({ leads = [], projects = [], deliveries = [] } = {}) {
  const requestNotifications = leads.slice(0, 3).map((lead) => ({
    type: 'request',
    title: lead.statusLabel,
    desc: lead.nextStep,
    targetId: lead.leadId
  }))
  const projectNotifications = projects
    .filter((project) => project.pendingConfirmations.length)
    .map((project) => ({
      type: 'project',
      title: '待客户确认',
      desc: `${project.projectName} · ${project.pendingConfirmations.map((item) => item.label).join('、')}`,
      targetId: project.projectId
    }))
  const deliveryNotifications = deliveries.slice(0, 2).map((delivery) => ({
    type: 'delivery',
    title: '交付文件',
    desc: `${delivery.title} · ${delivery.statusLabel}`,
    targetId: delivery.deliveryId
  }))
  return [...requestNotifications, ...projectNotifications, ...deliveryNotifications].slice(0, 8)
}
