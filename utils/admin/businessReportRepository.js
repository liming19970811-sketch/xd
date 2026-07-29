import { buildBusinessAlerts } from './businessAlertRepository'
import { listBusinessAlertActions } from './businessAlertActionRepository'
import { buildBusinessDashboard } from './businessDashboardRepository'
import { listLeadPipelines } from './leadPipelineRepository'
import { buildSalesForecastRows, buildSalesForecastSummary } from './salesForecastRepository'

export const BUSINESS_REPORT_PERIODS = [
  { value: '7d', label: '7天' },
  { value: '30d', label: '30天' }
]

function normalizePeriod(period = '7d') {
  return BUSINESS_REPORT_PERIODS.some((item) => item.value === period) ? period : '7d'
}

function countBy(records = [], key = 'status') {
  return records.reduce((result, record) => {
    const value = record[key] || 'unknown'
    result[value] = (result[value] || 0) + 1
    return result
  }, {})
}

function getLatestActionMap(actions = []) {
  return actions.reduce((result, action) => {
    if (!result[action.alertId] || String(action.createdAt).localeCompare(String(result[action.alertId].createdAt)) > 0) {
      result[action.alertId] = action
    }
    return result
  }, {})
}

function buildRiskSummary(alerts = [], actions = []) {
  const latestActionMap = getLatestActionMap(actions)
  const alertIds = new Set(alerts.map((alert) => alert.alertId))
  const relatedActions = actions.filter((action) => alertIds.has(action.alertId))
  const statusCounts = alerts.reduce((result, alert) => {
    const latestAction = latestActionMap[alert.alertId]
    const status = latestAction ? latestAction.status : alert.status || 'open'
    result[status] = (result[status] || 0) + 1
    return result
  }, {})

  return {
    total: alerts.length,
    high: alerts.filter((alert) => alert.level === 'high').length,
    medium: alerts.filter((alert) => alert.level === 'medium').length,
    low: alerts.filter((alert) => alert.level === 'low').length,
    open: statusCounts.open || 0,
    processing: statusCounts.processing || 0,
    resolved: statusCounts.resolved || 0,
    ignored: statusCounts.ignored || 0,
    actionCount: relatedActions.length
  }
}

function buildProjectSummary(projects = [], dashboard = {}) {
  const statusCounts = countBy(projects, 'status')
  return {
    projectCount: dashboard.projectCount || 0,
    totalProjectCount: projects.length,
    statusCounts,
    activeCount: projects.filter((project) => !['done', 'completed', 'closed'].includes(project.status)).length
  }
}

export function buildBusinessReport(input = {}) {
  const period = normalizePeriod(input.period)
  const leads = Array.isArray(input.leads) ? input.leads : []
  const projects = Array.isArray(input.projects) ? input.projects : []
  const pipelines = Array.isArray(input.pipelines) ? input.pipelines : listLeadPipelines()
  const dashboard = input.dashboard || buildBusinessDashboard({
    period,
    leads,
    projects,
    orders: input.orders,
    deliveries: input.deliveries,
    pipelines,
    apiUsage: input.apiUsage
  })
  const forecasts = buildSalesForecastRows(leads, projects, pipelines)
  const forecastSummary = buildSalesForecastSummary(forecasts)
  const alerts = Array.isArray(input.alerts) ? input.alerts : buildBusinessAlerts({
    period,
    leads,
    projects,
    pipelines,
    deliveries: input.deliveries,
    apiUsage: input.apiUsage
  })
  const actions = Array.isArray(input.actions) ? input.actions : listBusinessAlertActions()
  const riskSummary = buildRiskSummary(alerts, actions)
  const report = {
    reportId: `business_report_${period}_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`,
    period,
    summary: `本周期新增客户 ${dashboard.leadCount || 0} 个，预计成交金额 ${dashboard.forecastAmount || 0}，发现风险 ${riskSummary.total} 条，已解决 ${riskSummary.resolved} 条。`,
    leadSummary: {
      newLeadCount: dashboard.leadCount || 0,
      totalLeadCount: leads.length
    },
    salesSummary: {
      pipelineAmount: dashboard.pipelineAmount || 0,
      forecastAmount: dashboard.forecastAmount || forecastSummary.expectedAmount || 0,
      wonAmount: forecastSummary.wonAmount || 0,
      highRiskCount: forecastSummary.highRiskCount || 0,
      mediumRiskCount: forecastSummary.mediumRiskCount || 0,
      stageStats: dashboard.pipelineStats || []
    },
    projectSummary: buildProjectSummary(projects, dashboard),
    deliverySummary: {
      deliveryCount: dashboard.deliveryCount || 0,
      pendingReviewCount: Array.isArray(input.deliveries)
        ? input.deliveries.filter((delivery) => delivery.status === 'pending_review').length
        : 0
    },
    riskSummary,
    createdAt: new Date().toISOString()
  }

  console.log('[business:report]', {
    reportId: report.reportId,
    period: report.period
  })
  return report
}
