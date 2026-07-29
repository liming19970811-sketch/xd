const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

function success(data, message = 'ok') {
  return {
    code: 0,
    success: true,
    message,
    data
  }
}

function fail(code, message) {
  return {
    code,
    success: false,
    message,
    data: null
  }
}

function normalizeLeadPayload(payload = {}) {
  const source = payload.source || payload.sourceChannel || 'miniapp'
  const contactName = String(payload.contactName || '').trim()
  const mobile = String(payload.mobile || payload.phone || '').trim()
  const expectedDeliveryDate = payload.expectedDeliveryDate || payload.expectedDeliveryTime || ''
  const requirementText = payload.requirementText || payload.description || ''

  return {
    source,
    sourceChannel: payload.sourceChannel || source,
    sourcePage: payload.sourcePage || (source === 'website' ? 'website-demand' : 'service-request'),
    sourceContext: payload.sourceContext || {},
    contactName,
    mobile,
    phone: mobile,
    wechat: payload.wechat || '',
    companyName: payload.companyName || '',
    demandType: payload.demandType || 'design_service',
    budgetRange: payload.budgetRange || '',
    expectedDeliveryDate,
    expectedDeliveryTime: expectedDeliveryDate,
    requirementText,
    description: requirementText,
    needSample: !!payload.needSample,
    referenceImages: Array.isArray(payload.referenceImages) ? payload.referenceImages : [],
    attachmentUrls: Array.isArray(payload.attachmentUrls) ? payload.attachmentUrls : [],
    attachmentFileIds: Array.isArray(payload.attachmentFileIds) ? payload.attachmentFileIds : [],
    resultImageUrl: payload.resultImageUrl || '',
    taskId: payload.taskId || '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: payload.status || 'new',
    followStatus: payload.followStatus || payload.status || 'new'
  }
}

async function createLead(payload = {}) {
  const lead = normalizeLeadPayload(payload)
  if (!lead.contactName) {
    return fail(400, 'contactName is required')
  }
  if (!lead.mobile) {
    return fail(400, 'mobile is required')
  }

  const writeResult = await db.collection('leads').add({
    data: lead
  })
  const leadId = (writeResult && (writeResult._id || writeResult.id)) || ''

  return success(
    {
      leadId,
      status: lead.status
    },
    'created'
  )
}

exports.main = async (event = {}) => {
  try {
    if (event.action !== 'createLead') {
      return fail(400, 'Unsupported action')
    }

    return createLead(event.payload || {})
  } catch (error) {
    return fail(500, (error && error.message) || 'Internal Error')
  }
}
