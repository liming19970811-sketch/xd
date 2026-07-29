import { listLeadPipelines } from './leadPipelineRepository'

export const SALES_FORECAST_PROBABILITY_MAP = {
  new_lead: 10,
  contacted: 20,
  requirement_confirmed: 40,
  solution_sent: 60,
  quotation: 70,
  won: 100,
  lost: 0
}

const SALES_FORECAST_STAGE_LABELS = {
  new_lead: '新线索',
  contacted: '已联系',
  requirement_confirmed: '需求确认',
  solution_sent: '方案发送',
  quotation: '报价沟通',
  won: '成交',
  lost: '流失'
}

const EXPECTED_DAYS_BY_STAGE = {
  new_lead: 21,
  contacted: 14,
  requirement_confirmed: 10,
  solution_sent: 7,
  quotation: 5,
  won: 0,
  lost: 0
}

function parseAmount(value = '') {
  const matched = String(value || '').match(/\d+(\.\d+)?/)
  return matched ? Number(matched[0]) : 0
}

function addDays(value = '', days = 0) {
  const date = value ? new Date(value) : new Date()
  if (Number.isNaN(date.getTime()) || days <= 0) {
    return ''
  }
  date.setDate(date.getDate() + days)
  return date.toISOString()
}

export function getSalesForecastProbability(stage = '') {
  return SALES_FORECAST_PROBABILITY_MAP[stage] === undefined
    ? SALES_FORECAST_PROBABILITY_MAP.new_lead
    : SALES_FORECAST_PROBABILITY_MAP[stage]
}

export function getSalesForecastStageLabel(stage = '') {
  return SALES_FORECAST_STAGE_LABELS[stage] || SALES_FORECAST_STAGE_LABELS.new_lead
}

export function getSalesForecastRiskLevel(updatedAt = '', stage = '') {
  if (['won', 'lost'].includes(stage)) {
    return 'low'
  }
  const date = updatedAt ? new Date(updatedAt) : null
  if (!date || Number.isNaN(date.getTime())) {
    return 'high'
  }
  const ageDays = (Date.now() - date.getTime()) / (24 * 60 * 60 * 1000)
  if (ageDays >= 14) {
    return 'high'
  }
  if (ageDays >= 7) {
    return 'medium'
  }
  return 'low'
}

function getLeadProject(lead = {}, projects = []) {
  return (projects || []).find((project) => project.leadId === lead.leadId) || null
}

function normalizeForecast(input = {}, lead = {}, project = {}) {
  const stage = input.stage || 'new_lead'
  const probability = getSalesForecastProbability(stage)
  const baseAmount = Number.isFinite(Number(input.amount)) ? Number(input.amount) : parseAmount(lead.budgetRange)
  const expectedAmount = Math.round(baseAmount * probability / 100)
  const updatedAt = input.updatedAt || lead.updatedAt || lead.createdAt || new Date().toISOString()
  const riskLevel = getSalesForecastRiskLevel(updatedAt, stage)
  const forecast = {
    forecastId: `forecast_${String(input.leadId || lead.leadId || '').trim()}`,
    leadId: String(input.leadId || lead.leadId || ''),
    projectId: String(input.projectId || (project && project.projectId) || ''),
    stage,
    probability,
    expectedAmount,
    expectedDate: addDays(updatedAt, EXPECTED_DAYS_BY_STAGE[stage]),
    riskLevel,
    updatedAt: String(updatedAt)
  }
  console.log('[lead:forecast]', {
    leadId: forecast.leadId,
    riskLevel: forecast.riskLevel
  })
  return forecast
}

export function buildSalesForecastRows(leads = [], projects = [], pipelines = listLeadPipelines()) {
  const pipelineMap = pipelines.reduce((result, pipeline) => {
    result[pipeline.leadId] = pipeline
    return result
  }, {})

  return (Array.isArray(leads) ? leads : []).map((lead) => {
    const project = getLeadProject(lead, projects)
    const pipeline = pipelineMap[lead.leadId] || {
      leadId: lead.leadId,
      projectId: project ? project.projectId : '',
      stage: 'new_lead',
      amount: parseAmount(lead.budgetRange),
      updatedAt: lead.updatedAt || lead.createdAt || ''
    }
    const forecast = normalizeForecast(pipeline, lead, project)
    return {
      ...forecast,
      customerName: lead.customerName || lead.contactName || lead.companyName || '未填写客户',
      companyName: lead.companyName || lead.brandName || '未填写公司',
      projectName: project ? project.projectName || project.name || project.projectId : '未转项目'
    }
  }).sort((left, right) => String(right.expectedAmount).localeCompare(String(left.expectedAmount)))
}

export function buildSalesForecastSummary(rows = []) {
  return {
    forecastCount: rows.length,
    expectedAmount: rows.reduce((sum, row) => sum + Number(row.expectedAmount || 0), 0),
    highRiskCount: rows.filter((row) => row.riskLevel === 'high').length,
    mediumRiskCount: rows.filter((row) => row.riskLevel === 'medium').length,
    wonAmount: rows
      .filter((row) => row.stage === 'won')
      .reduce((sum, row) => sum + Number(row.expectedAmount || 0), 0)
  }
}
