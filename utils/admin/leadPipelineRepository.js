import { createLeadFollow } from './leadFollowRepository'

const LEAD_PIPELINE_STORAGE_KEY = 'diebiandesign_admin_lead_pipeline'

export const LEAD_PIPELINE_STAGES = [
  { value: 'new_lead', label: '新线索', probability: 10 },
  { value: 'contacted', label: '已联系', probability: 20 },
  { value: 'requirement_confirmed', label: '需求确认', probability: 40 },
  { value: 'solution_sent', label: '方案发送', probability: 55 },
  { value: 'quotation', label: '报价沟通', probability: 70 },
  { value: 'won', label: '成交', probability: 100 },
  { value: 'lost', label: '流失', probability: 0 }
]

const STAGE_FOLLOW_ACTION_MAP = {
  new_lead: '首次联系',
  contacted: '首次联系',
  requirement_confirmed: '需求确认',
  solution_sent: '方案发送',
  quotation: '报价沟通',
  won: '成交',
  lost: '流失'
}

function safeReadPipelines() {
  try {
    const records = uni.getStorageSync(LEAD_PIPELINE_STORAGE_KEY)
    return Array.isArray(records) ? records : []
  } catch (error) {
    return []
  }
}

function safeWritePipelines(records = []) {
  try {
    uni.setStorageSync(LEAD_PIPELINE_STORAGE_KEY, Array.isArray(records) ? records : [])
  } catch (error) {
    // Keep admin readable if local storage is unavailable in preview.
  }
}

export function getLeadPipelineStage(stage = '') {
  return LEAD_PIPELINE_STAGES.find((item) => item.value === stage) || LEAD_PIPELINE_STAGES[0]
}

export function getLeadPipelineStageLabel(stage = '') {
  return getLeadPipelineStage(stage).label
}

function parseAmount(value = '') {
  const matched = String(value || '').match(/\d+(\.\d+)?/)
  return matched ? Number(matched[0]) : 0
}

function normalizePipeline(input = {}, lead = {}, project = {}) {
  const stageConfig = getLeadPipelineStage(input.stage)
  const now = new Date().toISOString()
  return {
    pipelineId: String(input.pipelineId || `pipeline_${String(input.leadId || lead.leadId || '').trim()}`),
    leadId: String(input.leadId || lead.leadId || ''),
    projectId: String(input.projectId || (project && project.projectId) || ''),
    stage: stageConfig.value,
    probability: Number.isFinite(Number(input.probability)) ? Number(input.probability) : stageConfig.probability,
    amount: Number.isFinite(Number(input.amount)) ? Number(input.amount) : parseAmount(lead.budgetRange),
    updatedAt: String(input.updatedAt || now)
  }
}

export function listLeadPipelines() {
  return safeReadPipelines().map((item) => normalizePipeline(item))
}

export function getLeadPipelineByLeadId(leadId = '') {
  return listLeadPipelines().find((item) => item.leadId === leadId) || null
}

export function updateLeadPipeline(input = {}, options = {}) {
  const current = getLeadPipelineByLeadId(input.leadId) || {}
  const nextInput = {
    ...current,
    ...input,
    updatedAt: new Date().toISOString()
  }
  if (input.stage && input.stage !== current.stage && input.probability === undefined) {
    nextInput.probability = getLeadPipelineStage(input.stage).probability
  }
  const pipeline = normalizePipeline(nextInput)
  const records = listLeadPipelines().filter((item) => item.leadId !== pipeline.leadId)
  safeWritePipelines([pipeline, ...records])

  if (options.recordFollow !== false) {
    createLeadFollow({
      leadId: pipeline.leadId,
      projectId: pipeline.projectId,
      actionType: STAGE_FOLLOW_ACTION_MAP[pipeline.stage],
      content: `销售阶段更新为：${getLeadPipelineStageLabel(pipeline.stage)}`,
      operator: options.operator || '销售顾问',
      nextFollowAt: ['won', 'lost'].includes(pipeline.stage)
        ? ''
        : new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString()
    })
  }

  console.log('[lead:pipeline]', {
    leadId: pipeline.leadId,
    stage: pipeline.stage
  })
  return pipeline
}

function getLeadProject(lead = {}, projects = []) {
  return (projects || []).find((project) => project.leadId === lead.leadId) || null
}

export function buildLeadPipelineRows(leads = [], projects = [], pipelines = listLeadPipelines()) {
  const pipelineMap = pipelines.reduce((result, pipeline) => {
    result[pipeline.leadId] = pipeline
    return result
  }, {})

  return (Array.isArray(leads) ? leads : []).map((lead) => {
    const project = getLeadProject(lead, projects)
    const pipeline = normalizePipeline(pipelineMap[lead.leadId] || {
      leadId: lead.leadId,
      projectId: project ? project.projectId : '',
      stage: 'new_lead',
      amount: parseAmount(lead.budgetRange)
    }, lead, project)
    return {
      ...pipeline,
      customerName: lead.customerName || lead.contactName || lead.companyName || '未填写客户',
      companyName: lead.companyName || lead.brandName || '未填写公司',
      projectName: project ? project.projectName || project.name || project.projectId : '未转项目',
      interestType: lead.interestType || (lead.leadSnapshot && lead.leadSnapshot.interestType) || lead.demandType || '',
      createdAt: lead.createdAt || lead.updatedAt || pipeline.updatedAt
    }
  }).sort((left, right) => String(right.updatedAt).localeCompare(String(left.updatedAt)))
}

export function buildLeadPipelineStats(rows = []) {
  return LEAD_PIPELINE_STAGES.map((stage) => {
    const items = rows.filter((row) => row.stage === stage.value)
    const amount = items.reduce((sum, item) => sum + Number(item.amount || 0), 0)
    return {
      ...stage,
      count: items.length,
      amount
    }
  })
}
