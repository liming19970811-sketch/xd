const LEAD_FOLLOW_STORAGE_KEY = 'diebiandesign_admin_lead_follows'

export const LEAD_FOLLOW_ACTION_TYPES = [
  '首次联系',
  '需求确认',
  '方案发送',
  '报价沟通',
  '合同跟进',
  '成交',
  '流失'
]

function safeReadFollows() {
  try {
    const records = uni.getStorageSync(LEAD_FOLLOW_STORAGE_KEY)
    return Array.isArray(records) ? records : []
  } catch (error) {
    return []
  }
}

function safeWriteFollows(records = []) {
  try {
    uni.setStorageSync(LEAD_FOLLOW_STORAGE_KEY, Array.isArray(records) ? records : [])
  } catch (error) {
    // Local storage may be unavailable in some previews; keep the page readable.
  }
}

function normalizeActionType(actionType = '') {
  return LEAD_FOLLOW_ACTION_TYPES.includes(actionType) ? actionType : LEAD_FOLLOW_ACTION_TYPES[0]
}

function normalizeFollow(input = {}) {
  const now = new Date().toISOString()
  const actionType = normalizeActionType(input.actionType)
  return {
    followId: String(input.followId || `follow_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`),
    leadId: String(input.leadId || ''),
    projectId: String(input.projectId || ''),
    actionType,
    content: String(input.content || actionType),
    operator: String(input.operator || '销售顾问'),
    nextFollowAt: String(input.nextFollowAt || ''),
    createdAt: String(input.createdAt || now)
  }
}

function getLeadSourceContext(lead = {}) {
  const leadSnapshot = lead.leadSnapshot || {}
  const sourceContext = lead.sourceContext || {}
  return {
    sourceType: lead.sourceType || leadSnapshot.sourceType || sourceContext.sourceType || sourceContext.mode || lead.sourcePage || 'website',
    sourceId: lead.sourceId || leadSnapshot.sourceId || sourceContext.sourceId || sourceContext.articleId || sourceContext.caseId || sourceContext.planId || sourceContext.mode || '',
    interestType: lead.interestType || leadSnapshot.interestType || sourceContext.interestType || lead.demandType || '',
    interestSnapshot: lead.interestSnapshot || leadSnapshot.interestSnapshot || sourceContext.interestSnapshot || sourceContext.articleSnapshot || sourceContext.servicePlanSnapshot || sourceContext.demandSnapshot || {}
  }
}

function getLeadProject(lead = {}, projects = []) {
  return (projects || []).find((project) => project.leadId === lead.leadId) || null
}

function sortByCreatedAtDesc(records = []) {
  return [...records].sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt)))
}

export function listLeadFollows() {
  return sortByCreatedAtDesc(safeReadFollows().map(normalizeFollow))
}

export function getLeadFollowsByLeadId(leadId = '') {
  return listLeadFollows().filter((follow) => follow.leadId === leadId)
}

export function createLeadFollow(input = {}) {
  const follow = normalizeFollow(input)
  const records = [follow, ...listLeadFollows().filter((item) => item.followId !== follow.followId)]
  safeWriteFollows(records)
  console.log('[lead:follow]', {
    leadId: follow.leadId,
    followId: follow.followId,
    actionType: follow.actionType
  })
  return follow
}

export function buildLeadFollowRows(leads = [], projects = [], follows = listLeadFollows()) {
  const followMap = follows.reduce((result, follow) => {
    if (!result[follow.leadId]) {
      result[follow.leadId] = []
    }
    result[follow.leadId].push(follow)
    return result
  }, {})

  return (Array.isArray(leads) ? leads : []).map((lead) => {
    const project = getLeadProject(lead, projects)
    const leadFollows = sortByCreatedAtDesc(followMap[lead.leadId] || [])
    const latestFollow = leadFollows[0] || null
    const sourceContext = getLeadSourceContext(lead)
    return {
      leadId: lead.leadId || '',
      projectId: (project && project.projectId) || '',
      customerName: lead.customerName || lead.contactName || lead.companyName || '未填写客户',
      companyName: lead.companyName || lead.brandName || '未填写公司',
      sourceType: sourceContext.sourceType,
      sourceId: sourceContext.sourceId,
      interestType: sourceContext.interestType,
      interestSnapshot: sourceContext.interestSnapshot,
      projectName: (project && (project.projectName || project.name)) || '未转项目',
      followStatus: latestFollow ? latestFollow.actionType : '待首次联系',
      latestFollow,
      latestContent: latestFollow ? latestFollow.content : '暂无跟进记录',
      nextFollowAt: latestFollow ? latestFollow.nextFollowAt : '',
      followCount: leadFollows.length,
      createdAt: lead.createdAt || lead.updatedAt || ''
    }
  }).sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt)))
}
