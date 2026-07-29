import { buildBusinessAlerts } from './businessAlertRepository'
import { listBusinessAlertActions } from './businessAlertActionRepository'
import { buildBusinessReport } from './businessReportRepository'
import { listLeadPipelines } from './leadPipelineRepository'
import { buildSalesForecastRows, buildSalesForecastSummary } from './salesForecastRepository'

function createInsight(reportId = '', type = 'growth', title = '', description = '', suggestion = '') {
  const insight = {
    insightId: `insight_${type}_${String(reportId || 'report').replace(/[^\w-]/g, '_')}`,
    reportId,
    type,
    title,
    description,
    suggestion,
    createdAt: new Date().toISOString()
  }
  console.log('[business:insight]', {
    insightId: insight.insightId
  })
  return insight
}

function getTopStage(stageStats = []) {
  return [...stageStats].sort((left, right) => Number(right.amount || 0) - Number(left.amount || 0))[0] || null
}

function buildSalesInsight(report = {}, forecasts = []) {
  const sales = report.salesSummary || {}
  const topStage = getTopStage(sales.stageStats || [])
  const highValueCount = forecasts.filter((item) => Number(item.expectedAmount || 0) > 0 && item.riskLevel !== 'high').length
  return createInsight(
    report.reportId,
    'sales',
    '销售机会需要集中推进',
    `当前预计成交金额 ${sales.forecastAmount || 0}，高风险客户 ${sales.highRiskCount || 0} 个，可推进机会 ${highValueCount} 个。`,
    topStage
      ? `优先复盘 ${topStage.label} 阶段客户，明确下一步报价、方案或合同动作。`
      : '先补齐销售阶段数据，再判断重点机会。'
  )
}

function buildProjectInsight(report = {}) {
  const project = report.projectSummary || {}
  return createInsight(
    report.reportId,
    'project',
    '项目状态需要保持节奏',
    `本周期项目数 ${project.projectCount || 0}，当前进行中 ${project.activeCount || 0}，累计项目 ${project.totalProjectCount || 0}。`,
    project.activeCount > project.projectCount
      ? '建议按项目优先级排期，避免进行中项目堆积影响交付。'
      : '保持项目状态更新，让销售、交付和客户预期保持一致。'
  )
}

function buildDeliveryInsight(report = {}) {
  const delivery = report.deliverySummary || {}
  return createInsight(
    report.reportId,
    'delivery',
    '交付审核要前置管理',
    `本周期交付 ${delivery.deliveryCount || 0} 次，待审核 ${delivery.pendingReviewCount || 0} 项。`,
    delivery.pendingReviewCount > 0
      ? '建议每天集中清理待审核交付，减少客户等待时间。'
      : '当前交付审核压力可控，可以继续沉淀标准交付模板。'
  )
}

function buildRiskInsight(report = {}, alerts = [], actions = []) {
  const risk = report.riskSummary || {}
  const unresolved = Number(risk.open || 0) + Number(risk.processing || 0)
  return createInsight(
    report.reportId,
    'risk',
    '风险处理需要形成闭环',
    `当前风险 ${risk.total || 0} 条，待处理 ${risk.open || 0} 条，处理中 ${risk.processing || 0} 条，处理记录 ${actions.length || risk.actionCount || 0} 条。`,
    unresolved > 0 || alerts.some((alert) => alert.level === 'high')
      ? '建议先处理高风险预警，并为每条预警补充分配人和下一步记录。'
      : '风险闭环状态较好，可以定期复盘已解决预警的触发原因。'
  )
}

function buildGrowthInsight(report = {}) {
  const lead = report.leadSummary || {}
  const sales = report.salesSummary || {}
  const hasGrowth = Number(lead.newLeadCount || 0) > 0 || Number(sales.pipelineAmount || 0) > 0
  return createInsight(
    report.reportId,
    'growth',
    '增长动作要连接线索和成交',
    `本周期新增客户 ${lead.newLeadCount || 0} 个，销售阶段金额 ${sales.pipelineAmount || 0}。`,
    hasGrowth
      ? '建议把高意向线索与服务方案、案例素材关联，提升咨询到成交的转化效率。'
      : '建议加强官网内容入口和企业案例露出，为下个周期补充有效线索。'
  )
}

export function buildBusinessInsights(input = {}) {
  const leads = Array.isArray(input.leads) ? input.leads : []
  const projects = Array.isArray(input.projects) ? input.projects : []
  const pipelines = Array.isArray(input.pipelines) ? input.pipelines : listLeadPipelines()
  const report = input.report || buildBusinessReport({
    period: input.period,
    leads,
    projects,
    pipelines,
    alerts: input.alerts,
    actions: input.actions,
    apiUsage: input.apiUsage
  })
  const forecasts = buildSalesForecastRows(leads, projects, pipelines)
  const forecastSummary = buildSalesForecastSummary(forecasts)
  const alerts = Array.isArray(input.alerts)
    ? input.alerts
    : buildBusinessAlerts({
      period: report.period,
      leads,
      projects,
      pipelines,
      apiUsage: input.apiUsage
    })
  const actions = Array.isArray(input.actions) ? input.actions : listBusinessAlertActions()

  return [
    buildGrowthInsight(report),
    buildSalesInsight({
      ...report,
      salesSummary: {
        ...(report.salesSummary || {}),
        highRiskCount: forecastSummary.highRiskCount,
        mediumRiskCount: forecastSummary.mediumRiskCount
      }
    }, forecasts),
    buildProjectInsight(report),
    buildDeliveryInsight(report),
    buildRiskInsight(report, alerts, actions)
  ]
}

export function buildBusinessInsightSummary(insights = []) {
  return {
    total: insights.length,
    opportunityCount: insights.filter((insight) => ['growth', 'sales'].includes(insight.type)).length,
    riskCount: insights.filter((insight) => insight.type === 'risk').length,
    actionCount: insights.filter((insight) => insight.suggestion).length
  }
}
