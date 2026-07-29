import { getMainChainState } from '../mainChainState'
import { getUserAssets } from '../asset/assetRepository'
import { getProjectDeliveries } from '../project/deliveryRepository'
import { getProjectLeadSnapshots } from '../project/projectFromLead'
import { getProjects } from '../project/projectRepository'
import { getAdminLeadList, getAdminProjectList } from '../service/adminRepository'

const PROJECT_STATUS_LABELS = Object.freeze({
  requirement_confirmation: '需求确认',
  designing: '设计中',
  generating: '生成中',
  pending_review: '待审核',
  delivered: '已交付'
})

const DELIVERY_STATUS_LABELS = Object.freeze({
  pending_review: '待审核',
  revising: '修改中',
  confirmed: '已确认',
  delivered: '已交付'
})

const PROJECT_STATUS_ALIASES = Object.freeze({
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

function mergeById(lists = [], idKey = '') {
  const map = new Map()
  lists.forEach((list) => {
    ;(Array.isArray(list) ? list : []).forEach((item) => {
      const id = String((item && item[idKey]) || '').trim()
      if (!id) return
      map.set(id, { ...(map.get(id) || {}), ...item, [idKey]: id })
    })
  })
  return [...map.values()]
}

function normalizeProjectStatus(project = {}) {
  const candidates = [project.status, project.stage, project.rawStage].filter(Boolean)
  for (const candidate of candidates) {
    if (PROJECT_STATUS_LABELS[candidate]) return candidate
    if (PROJECT_STATUS_ALIASES[candidate]) return PROJECT_STATUS_ALIASES[candidate]
  }
  return 'requirement_confirmation'
}

function normalizeLead(lead = {}) {
  return {
    leadId: String(lead.leadId || ''),
    customerName: lead.customerName || lead.contactName || '未填写客户',
    companyName: lead.companyName || lead.brandName || '未填写公司',
    customerContact: lead.customerContact || lead.mobile || lead.phone || lead.wechat || lead.email || '暂无',
    demandType: lead.demandType || 'design_service',
    createdAt: lead.createdAt || lead.updatedAt || ''
  }
}

function normalizeProject(project = {}) {
  const status = normalizeProjectStatus(project)
  return {
    projectId: String(project.projectId || ''),
    leadId: String(project.leadId || ''),
    projectName: project.projectName || project.name || '未命名项目',
    customerName: project.customerName || project.contactName || project.companyName || '未填写客户',
    status,
    deadline: project.deadline || project.expectedDeliveryDate || project.expectedDeliveryTime || '',
    updatedAt: project.updatedAt || project.createdAt || ''
  }
}

function normalizeDelivery(delivery = {}) {
  return {
    deliveryId: String(delivery.deliveryId || ''),
    projectId: String(delivery.projectId || ''),
    version: delivery.version || 'draft',
    status: delivery.status || 'pending_review',
    createdAt: delivery.createdAt || delivery.updatedAt || ''
  }
}

function getTaskCount(state = {}) {
  const tasks = state.tasks || {}
  if (Array.isArray(tasks.allIds)) {
    return tasks.allIds.length
  }
  return Object.keys(tasks.byId || {}).length
}

export function getAdminDashboardData(source = {}) {
  const leads = mergeById([getAdminLeadList(), getProjectLeadSnapshots(), source.leads], 'leadId')
    .map(normalizeLead)
    .sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt)))
  const projects = mergeById([getAdminProjectList(), getProjects(), source.projects], 'projectId')
    .map(normalizeProject)
    .sort((left, right) => String(right.updatedAt).localeCompare(String(left.updatedAt)))
  const deliveries = mergeById(
    [projects.flatMap((project) => getProjectDeliveries(project.projectId))],
    'deliveryId'
  )
    .map(normalizeDelivery)
    .sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt)))
  const assets = getUserAssets()
  const state = getMainChainState()
  const stats = {
    leadCount: leads.length,
    projectCount: projects.length,
    activeProjectCount: projects.filter((project) => project.status !== 'delivered').length,
    pendingDeliveryCount: deliveries.filter((delivery) => delivery.status === 'pending_review').length,
    completedDeliveryCount: deliveries.filter((delivery) => delivery.status === 'delivered').length,
    assetCount: Array.isArray(assets.all) ? assets.all.length : 0,
    taskCount: getTaskCount(state)
  }

  console.log('[admin:dashboard]', {
    leadCount: stats.leadCount,
    projectCount: stats.projectCount,
    deliveryCount: deliveries.length
  })

  return { stats, leads, projects, deliveries }
}

export function getDashboardProjectStatusLabel(status = '') {
  return PROJECT_STATUS_LABELS[status] || '需求确认'
}

export function getDashboardDeliveryStatusLabel(status = '') {
  return DELIVERY_STATUS_LABELS[status] || '待审核'
}

export function getDashboardVersionLabel(version = '') {
  const labels = { draft: '初稿', revision: '修改版', final: '最终版' }
  return labels[version] || '初稿'
}

export function formatDashboardTime(value = '') {
  const date = value ? new Date(value) : null
  if (!date || Number.isNaN(date.getTime())) return '刚刚'
  const pad = (number) => String(number).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}
