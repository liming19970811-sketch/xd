import { buildApiAnalytics } from './apiAnalyticsRepository'
import { listLeadPipelines } from './leadPipelineRepository'
import { getProjectDeliveries } from '../project/deliveryRepository'

const DAY_MS = 24 * 60 * 60 * 1000

function getAgeDays(value = '') {
  const date = value ? new Date(value) : null
  if (!date || Number.isNaN(date.getTime())) {
    return 0
  }
  return (Date.now() - date.getTime()) / DAY_MS
}

function isPastDate(value = '') {
  const date = value ? new Date(value) : null
  if (!date || Number.isNaN(date.getTime())) {
    return false
  }
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  date.setHours(0, 0, 0, 0)
  return date.getTime() < today.getTime()
}

function createAlert({ type, level, targetId, title, description, createdAt = new Date().toISOString(), status = 'open' }) {
  const alert = {
    alertId: `alert_${type}_${String(targetId || 'unknown').replace(/[^\w-]/g, '_')}`,
    type,
    level,
    targetId: String(targetId || ''),
    title,
    description,
    createdAt,
    status
  }
  console.log('[business:alert]', {
    alertId: alert.alertId,
    type: alert.type
  })
  return alert
}

function getLeadLabel(lead = {}) {
  return lead.companyName || lead.brandName || lead.contactName || lead.leadId || '未知客户'
}

function buildSalesAlerts(leads = [], pipelines = []) {
  const leadMap = leads.reduce((result, lead) => {
    result[lead.leadId] = lead
    return result
  }, {})
  return pipelines
    .filter((pipeline) => pipeline.stage === 'quotation' && getAgeDays(pipeline.updatedAt) > 14)
    .map((pipeline) => createAlert({
      type: 'sales',
      level: 'high',
      targetId: pipeline.leadId,
      title: '报价阶段长时间未更新',
      description: `${getLeadLabel(leadMap[pipeline.leadId] || {})} 已在报价阶段超过14天未更新。`,
      createdAt: pipeline.updatedAt || new Date().toISOString()
    }))
}

function buildProjectAlerts(projects = []) {
  return (Array.isArray(projects) ? projects : [])
    .filter((project) => isPastDate(project.deadline || project.expectedDeliveryDate || project.expectedDeliveryTime))
    .map((project) => createAlert({
      type: 'project',
      level: 'high',
      targetId: project.projectId,
      title: '项目截止时间已超期',
      description: `${project.projectName || project.name || project.projectId} 的截止时间已超过计划日期。`,
      createdAt: project.deadline || project.expectedDeliveryDate || project.expectedDeliveryTime || new Date().toISOString()
    }))
}

function getDeliveries(projects = [], providedDeliveries = null) {
  if (Array.isArray(providedDeliveries)) {
    return providedDeliveries
  }
  return (Array.isArray(projects) ? projects : []).flatMap((project) => getProjectDeliveries(project.projectId))
}

function buildDeliveryAlerts(projects = [], deliveries = null) {
  return getDeliveries(projects, deliveries)
    .filter((delivery) => delivery.status === 'pending_review' && getAgeDays(delivery.updatedAt || delivery.createdAt) > 7)
    .map((delivery) => createAlert({
      type: 'delivery',
      level: 'medium',
      targetId: delivery.deliveryId,
      title: '交付待审核时间过长',
      description: `${delivery.deliveryId} 已待审核超过7天，请确认审核进度。`,
      createdAt: delivery.updatedAt || delivery.createdAt || new Date().toISOString()
    }))
}

function buildApiAlerts(apiUsage = {}) {
  const totalCalls = Number(apiUsage.totalCalls || 0)
  const failedCalls = Number(apiUsage.failedCalls || 0)
  if (totalCalls < 5) {
    return []
  }
  const failureRate = Math.round((failedCalls / totalCalls) * 1000) / 10
  if (failureRate < 30) {
    return []
  }
  return [createAlert({
    type: 'api',
    level: failureRate >= 50 ? 'high' : 'medium',
    targetId: `api_${apiUsage.period || 'current'}`,
    title: 'API 失败率异常',
    description: `当前 API 失败率为 ${failureRate}%，请检查权限、额度或调用参数。`
  })]
}

export function buildBusinessAlerts(input = {}) {
  const leads = Array.isArray(input.leads) ? input.leads : []
  const projects = Array.isArray(input.projects) ? input.projects : []
  const pipelines = Array.isArray(input.pipelines) ? input.pipelines : listLeadPipelines()
  const apiUsage = input.apiUsage || buildApiAnalytics({ period: input.period || '7d' })
  const alerts = [
    ...buildSalesAlerts(leads, pipelines),
    ...buildProjectAlerts(projects),
    ...buildDeliveryAlerts(projects, input.deliveries),
    ...buildApiAlerts(apiUsage)
  ]
  return alerts.sort((left, right) => {
    const levelWeight = { high: 3, medium: 2, low: 1 }
    return (levelWeight[right.level] || 0) - (levelWeight[left.level] || 0) ||
      String(right.createdAt).localeCompare(String(left.createdAt))
  })
}

export function buildBusinessAlertSummary(alerts = []) {
  return {
    total: alerts.length,
    high: alerts.filter((alert) => alert.level === 'high').length,
    medium: alerts.filter((alert) => alert.level === 'medium').length,
    low: alerts.filter((alert) => alert.level === 'low').length,
    open: alerts.filter((alert) => alert.status === 'open').length
  }
}
