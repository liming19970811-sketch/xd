import { buildApiAnalytics } from './apiAnalyticsRepository'
import { buildLeadPipelineRows, buildLeadPipelineStats, listLeadPipelines } from './leadPipelineRepository'
import { buildSalesForecastRows, buildSalesForecastSummary } from './salesForecastRepository'
import { getOrders } from '../order/orderRepository'
import { getProjectDeliveries } from '../project/deliveryRepository'

export const BUSINESS_DASHBOARD_PERIODS = [
  { value: '7d', label: '7天', days: 7 },
  { value: '30d', label: '30天', days: 30 }
]

function getPeriodConfig(period = '7d') {
  return BUSINESS_DASHBOARD_PERIODS.find((item) => item.value === period) || BUSINESS_DASHBOARD_PERIODS[0]
}

function getPeriodStart(period = '7d') {
  const config = getPeriodConfig(period)
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  start.setDate(start.getDate() - config.days + 1)
  return start
}

function isWithinPeriod(value = '', period = '7d') {
  const date = value ? new Date(value) : null
  return Boolean(date && !Number.isNaN(date.getTime()) && date.getTime() >= getPeriodStart(period).getTime())
}

function sumAmount(records = [], key = 'amount') {
  return records.reduce((total, record) => total + Number(record[key] || 0), 0)
}

function getDeliveries(projects = [], period = '7d') {
  return (Array.isArray(projects) ? projects : [])
    .flatMap((project) => getProjectDeliveries(project.projectId))
    .filter((delivery) => isWithinPeriod(delivery.updatedAt || delivery.createdAt, period))
}

export function buildBusinessDashboard(input = {}) {
  const period = getPeriodConfig(input.period).value
  const leads = Array.isArray(input.leads) ? input.leads : []
  const projects = Array.isArray(input.projects) ? input.projects : []
  const pipelines = Array.isArray(input.pipelines) ? input.pipelines : listLeadPipelines()
  const orders = Array.isArray(input.orders) ? input.orders : getOrders()

  const periodLeads = leads.filter((lead) => isWithinPeriod(lead.createdAt || lead.updatedAt, period))
  const periodProjects = projects.filter((project) => isWithinPeriod(project.updatedAt || project.createdAt, period))
  const periodPipelines = pipelines.filter((pipeline) => isWithinPeriod(pipeline.updatedAt, period))
  const periodOrders = orders.filter((order) => isWithinPeriod(order.updatedAt || order.createdAt, period))
  const deliveries = Array.isArray(input.deliveries)
    ? input.deliveries.filter((delivery) => isWithinPeriod(delivery.updatedAt || delivery.createdAt, period))
    : getDeliveries(projects, period)

  const pipelineRows = buildLeadPipelineRows(leads, projects, periodPipelines)
  const pipelineStats = buildLeadPipelineStats(pipelineRows)
  const forecastRows = buildSalesForecastRows(leads, projects, periodPipelines)
  const forecastSummary = buildSalesForecastSummary(forecastRows)
  const apiUsage = input.apiUsage || buildApiAnalytics({ period })

  const dashboard = {
    dashboardId: `business_dashboard_${period}`,
    period,
    leadCount: periodLeads.length,
    pipelineAmount: sumAmount(pipelineRows),
    forecastAmount: forecastSummary.expectedAmount,
    orderAmount: sumAmount(periodOrders),
    projectCount: periodProjects.length,
    deliveryCount: deliveries.length,
    apiUsage: {
      totalCalls: apiUsage.totalCalls || 0,
      successCalls: apiUsage.successCalls || 0,
      failedCalls: apiUsage.failedCalls || 0,
      successRate: apiUsage.successRate || 0,
      totalCost: apiUsage.totalCost || 0,
      topActions: apiUsage.topActions || []
    },
    pipelineStats,
    updatedAt: new Date().toISOString()
  }

  console.log('[business:dashboard]', {
    period: dashboard.period
  })

  return dashboard
}
