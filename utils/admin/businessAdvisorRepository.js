import { buildBusinessAlerts } from './businessAlertRepository'
import { buildBusinessInsights } from './businessInsightRepository'
import { buildBusinessReport } from './businessReportRepository'
import { listLeadPipelines } from './leadPipelineRepository'
import { buildSalesForecastRows } from './salesForecastRepository'

const ADVICE_TYPE_MAP = {
  sales: 'sales_action',
  project: 'project_action',
  delivery: 'delivery_action',
  growth: 'growth_action',
  risk: 'risk_action'
}

const PRIORITY_BY_TYPE = {
  risk_action: 'high',
  sales_action: 'high',
  project_action: 'medium',
  delivery_action: 'medium',
  growth_action: 'low'
}

function createAdvisor(insight = {}, overrides = {}) {
  const adviceType = overrides.adviceType || ADVICE_TYPE_MAP[insight.type] || 'growth_action'
  const advisor = {
    advisorId: `advisor_${adviceType}_${String(insight.insightId || Date.now()).replace(/[^\w-]/g, '_')}`,
    insightId: String(insight.insightId || ''),
    priority: overrides.priority || PRIORITY_BY_TYPE[adviceType] || 'medium',
    adviceType,
    title: overrides.title || insight.title || '经营行动建议',
    description: overrides.description || insight.description || '',
    action: overrides.action || insight.suggestion || '请结合当前经营数据安排下一步动作。',
    createdAt: new Date().toISOString()
  }
  console.log('[business:advisor]', {
    advisorId: advisor.advisorId
  })
  return advisor
}

function getTopForecast(forecasts = []) {
  return [...forecasts]
    .filter((item) => item.stage !== 'lost')
    .sort((left, right) => Number(right.expectedAmount || 0) - Number(left.expectedAmount || 0))[0] || null
}

function getHighRiskAlert(alerts = []) {
  return alerts.find((alert) => alert.level === 'high') || alerts[0] || null
}

function getActiveProject(projects = []) {
  return (projects || []).find((project) => !['done', 'completed', 'closed'].includes(project.status)) || projects[0] || null
}

export function buildBusinessAdvisors(input = {}) {
  const leads = Array.isArray(input.leads) ? input.leads : []
  const projects = Array.isArray(input.projects) ? input.projects : []
  const pipelines = Array.isArray(input.pipelines) ? input.pipelines : listLeadPipelines()
  const report = input.report || buildBusinessReport({
    period: input.period,
    leads,
    projects,
    pipelines,
    alerts: input.alerts,
    apiUsage: input.apiUsage
  })
  const insights = Array.isArray(input.insights)
    ? input.insights
    : buildBusinessInsights({
      period: report.period,
      leads,
      projects,
      pipelines,
      report,
      alerts: input.alerts,
      apiUsage: input.apiUsage
    })
  const forecasts = buildSalesForecastRows(leads, projects, pipelines)
  const alerts = Array.isArray(input.alerts)
    ? input.alerts
    : buildBusinessAlerts({
      period: report.period,
      leads,
      projects,
      pipelines,
      apiUsage: input.apiUsage
    })
  const topForecast = getTopForecast(forecasts)
  const highRiskAlert = getHighRiskAlert(alerts)
  const activeProject = getActiveProject(projects)

  return insights.map((insight) => {
    if (insight.type === 'sales' && topForecast) {
      return createAdvisor(insight, {
        title: '跟进重点客户',
        description: `${topForecast.customerName || topForecast.leadId || '重点客户'} 预计成交金额 ${topForecast.expectedAmount || 0}，当前阶段 ${topForecast.stage || '待确认'}。`,
        action: '今天完成一次客户跟进，确认报价、方案或合同的下一步时间。',
        priority: topForecast.riskLevel === 'high' ? 'high' : 'medium'
      })
    }
    if (insight.type === 'project' && activeProject) {
      return createAdvisor(insight, {
        title: '推进重点项目',
        description: `${activeProject.projectName || activeProject.name || activeProject.projectId} 需要保持状态更新。`,
        action: '今天检查项目进度、负责人和交付节点，补齐缺失状态。',
        priority: 'medium'
      })
    }
    if (insight.type === 'risk' && highRiskAlert) {
      return createAdvisor(insight, {
        title: '处理高风险预警',
        description: `${highRiskAlert.title || '经营风险'}：${highRiskAlert.description || highRiskAlert.targetId}`,
        action: '优先分配处理人，并补充一条处理记录或状态更新。',
        priority: highRiskAlert.level === 'high' ? 'high' : 'medium'
      })
    }
    return createAdvisor(insight)
  }).sort((left, right) => {
    const weight = { high: 3, medium: 2, low: 1 }
    return (weight[right.priority] || 0) - (weight[left.priority] || 0)
  })
}

export function buildBusinessAdvisorSummary(advisors = []) {
  return {
    total: advisors.length,
    todayCount: advisors.filter((advisor) => ['high', 'medium'].includes(advisor.priority)).length,
    highCount: advisors.filter((advisor) => advisor.priority === 'high').length,
    riskActionCount: advisors.filter((advisor) => advisor.adviceType === 'risk_action').length
  }
}
