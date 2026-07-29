import { getAdminLeadList } from '../service/adminRepository'

export const ENTERPRISE_REQUEST_ROUTE = '/pages/enterprise-request/enterprise-request'

export const ENTERPRISE_DEMAND_TYPES = [
  { label: 'AI出图', value: 'ai_output' },
  { label: 'AI制版', value: 'ai_pattern' },
  { label: '批量SKU', value: 'batch_sku' },
  { label: '品牌视觉', value: 'brand_visual' },
  { label: '版型数字化', value: 'pattern_digitalization' },
  { label: '企业API', value: 'enterprise_api' },
  { label: '其他', value: 'other' }
]

export const ENTERPRISE_LEAD_STATUSES = ['new', 'contacted', 'qualified', 'proposal', 'converted', 'closed']

const MAX_ATTACHMENT_COUNT = 6
const MAX_ATTACHMENT_SIZE = 20 * 1024 * 1024
const ALLOWED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'pdf', 'xls', 'xlsx', 'csv']

export function buildEnterpriseRequestUrl(params = {}) {
  const query = Object.keys(params)
    .filter((key) => params[key] !== undefined && params[key] !== null && params[key] !== '')
    .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
    .join('&')
  return query ? `${ENTERPRISE_REQUEST_ROUTE}?${query}` : ENTERPRISE_REQUEST_ROUTE
}

export function getUtmFromOptions(options = {}) {
  return ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'].reduce((result, key) => {
    if (options[key]) result[key] = options[key]
    return result
  }, {})
}

export function maskPhone(phone = '') {
  const value = String(phone || '').trim()
  if (value.length < 7) return value ? '已填写' : ''
  return `${value.slice(0, 3)}****${value.slice(-4)}`
}

export function validateContact(form = {}) {
  const contactName = String(form.contactName || '').trim()
  const phone = String(form.phone || '').trim()
  const wechat = String(form.wechat || '').trim()
  if (!contactName) {
    return { ok: false, message: '请填写联系人' }
  }
  if (!phone && !wechat) {
    return { ok: false, message: '请至少填写手机号或微信号' }
  }
  if (phone && !/^1\d{10}$/.test(phone)) {
    return { ok: false, message: '手机号格式不正确，也可以改填微信号' }
  }
  return { ok: true, message: '' }
}

export function validateAttachment(file = {}) {
  const name = String(file.name || file.path || file.tempFilePath || '').toLowerCase()
  const extension = name.includes('.') ? name.split('.').pop() : ''
  const size = Number(file.size || 0)
  if (!ALLOWED_EXTENSIONS.includes(extension)) {
    return { ok: false, message: '仅支持图片、PDF 和表格文件' }
  }
  if (size > MAX_ATTACHMENT_SIZE) {
    return { ok: false, message: '单个附件不能超过 20MB' }
  }
  return { ok: true, message: '' }
}

export function canAddAttachment(current = []) {
  return Array.isArray(current) && current.length < MAX_ATTACHMENT_COUNT
}

export function findPossibleDuplicateLeads({ phone = '', companyName = '', withinDays = 14 } = {}) {
  const now = Date.now()
  const normalizedPhone = String(phone || '').trim()
  const normalizedCompany = String(companyName || '').trim()
  if (!normalizedPhone && !normalizedCompany) return []
  return getAdminLeadList()
    .filter((lead) => {
      const createdAt = new Date(lead.createdAt || lead.updatedAt || 0).getTime()
      const inRange = createdAt && (now - createdAt) <= withinDays * 24 * 60 * 60 * 1000
      const samePhone = normalizedPhone && String(lead.phone || lead.mobile || '').trim() === normalizedPhone
      const sameCompany = normalizedCompany && String(lead.companyName || '').trim() === normalizedCompany
      return inRange && (samePhone || sameCompany)
    })
    .map((lead) => lead.leadId)
}

export function buildEnterpriseLeadPayload({ form = {}, attachments = [], routeOptions = {}, duplicateLeadIds = [] } = {}) {
  const demandTypes = Array.isArray(form.demandTypes) ? form.demandTypes : []
  const primaryDemandType = demandTypes[0] || 'enterprise_request'
  const sourceType = routeOptions.sourceType || routeOptions.source || 'enterprise_request'
  const sourceId = routeOptions.sourceId || routeOptions.caseId || routeOptions.articleId || ''
  const utm = getUtmFromOptions(routeOptions)
  return {
    source: 'website',
    sourceChannel: 'website',
    sourcePage: 'enterprise-request',
    leadSource: 'enterprise_request',
    sourceType,
    sourceId,
    interestType: primaryDemandType,
    contactName: form.contactName,
    mobile: form.phone,
    phone: form.phone,
    wechat: form.wechat,
    companyName: form.companyName,
    companyAccount: form.companyName,
    demandType: primaryDemandType,
    demandTypes,
    clothingCategory: form.clothingCategory,
    productCategory: form.clothingCategory,
    quantity: form.quantity,
    expectedVolume: form.quantity,
    platform: form.platform,
    expectedDeliveryTime: form.expectedTime,
    expectedDeliveryDate: form.expectedTime,
    requirementText: form.description,
    description: form.description,
    attachments,
    attachmentFileIds: attachments.map((item) => item.fileId).filter(Boolean),
    attachmentUrls: attachments.map((item) => item.tempUrl).filter(Boolean),
    privacyConfirmed: !!form.privacyConfirmed,
    status: 'new',
    followStatus: 'new',
    ownerName: '',
    nextFollowAt: '',
    lastFollowContent: '官网企业需求提交，待首次联系',
    possibleDuplicateLeadIds: duplicateLeadIds,
    utm,
    leadSnapshot: {
      sourcePage: 'enterprise-request',
      sourceType,
      sourceId,
      interestType: primaryDemandType,
      demandTypes,
      contact: {
        contactName: form.contactName,
        hasPhone: !!form.phone,
        hasWechat: !!form.wechat,
        maskedPhone: maskPhone(form.phone)
      },
      companyName: form.companyName,
      delivery: {
        clothingCategory: form.clothingCategory,
        quantity: form.quantity,
        platform: form.platform,
        expectedTime: form.expectedTime
      },
      attachmentCount: attachments.length,
      privacyConfirmed: !!form.privacyConfirmed,
      utm
    },
    sourceContext: {
      taskId: '',
      batchId: '',
      projectId: '',
      assetId: '',
      deliveryId: '',
      sourcePage: 'enterprise-request',
      sourceType,
      sourceId
    }
  }
}
