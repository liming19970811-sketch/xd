import { API_CONFIG } from './config'
import { request } from './request'
import { createAdminLead } from '../service/adminRepository'
// #ifdef MP-WEIXIN
import { canUseCloudCreateLead, createLeadByCloud } from '../cloudbase/leadsRepository'
// #endif

function getLeadApiUrl() {
  if (API_CONFIG.leads && API_CONFIG.leads.url) {
    return API_CONFIG.leads.url
  }

  if (API_CONFIG.generate && API_CONFIG.generate.url) {
    return API_CONFIG.generate.url.replace(/\/api\/generate$/, '/api/leads')
  }

  return '/api/leads'
}

function parseResponseData(response) {
  const data = response && Object.prototype.hasOwnProperty.call(response, 'data') ? response.data : response
  if (typeof data === 'string') {
    try {
      return JSON.parse(data)
    } catch (error) {
      return {
        data
      }
    }
  }
  return data || {}
}

function buildLocalLeadPayload(payload = {}, source = 'mock') {
  const normalizedSource = payload.source || payload.sourceChannel || 'miniapp'
  const normalizedSourcePage = payload.sourcePage || (normalizedSource === 'website' ? 'website-demand' : 'service-request')
  const mobile = payload.mobile || payload.phone || ''
  const expectedDeliveryDate = payload.expectedDeliveryDate || payload.expectedDeliveryTime || ''
  const requirementText = payload.requirementText || payload.description || ''
  const attachmentUrls = Array.isArray(payload.attachmentUrls) ? payload.attachmentUrls : []
  const attachmentFileIds = Array.isArray(payload.attachmentFileIds) ? payload.attachmentFileIds : []
  const attachments = Array.isArray(payload.attachments) ? payload.attachments : []

  return {
    source: normalizedSource,
    sourceChannel: payload.sourceChannel || normalizedSource,
    sourcePage: normalizedSourcePage,
    companyName: payload.companyName || '',
    contactName: payload.contactName || '',
    mobile,
    phone: mobile,
    wechat: payload.wechat || '',
    demandType: payload.demandType || 'design_service',
    budgetRange: payload.budgetRange || '',
    expectedDeliveryDate,
    expectedDeliveryTime: expectedDeliveryDate,
    requirementText,
    description: requirementText,
    referenceImages: Array.isArray(payload.referenceImages) ? payload.referenceImages : attachmentUrls,
    attachmentUrls,
    attachmentFileIds,
    attachments,
    privacyConfirmed: !!payload.privacyConfirmed,
    leadSnapshot: payload.leadSnapshot || null,
    possibleDuplicateLeadIds: Array.isArray(payload.possibleDuplicateLeadIds) ? payload.possibleDuplicateLeadIds : [],
    ownerName: payload.ownerName || '',
    nextFollowAt: payload.nextFollowAt || '',
    lastFollowContent: payload.lastFollowContent || '',
    utm: payload.utm || {},
    companyAccount: payload.companyAccount || payload.companyName || '',
    sourceContext: {
      ...(payload.sourceContext || {}),
      taskId: payload.taskId || '',
      sourcePage: normalizedSourcePage,
      submitSource: source
    }
  }
}

function logSubmitResult(result) {
  const lead = result && result.lead ? result.lead : {}
  console.log('[leads:submit] final', {
    mode: (result && result.mode) || '',
    source: (result && result.source) || '',
    success: Boolean(result && result.lead),
    hasLeadId: Boolean(lead.leadId)
  })
}

export async function submitLead(payload = {}) {
  const requestPayload = {
    ...payload
  }
  let fallbackFromCloud = false

  // #ifdef MP-WEIXIN
  console.log('[leads:submit] platform=mp-weixin begin')
  if (canUseCloudCreateLead()) {
    console.log('[leads:submit] route=cloud attempt')
    try {
      const cloudResponse = await createLeadByCloud(requestPayload)
      const cloudSuccess = typeof cloudResponse.success === 'boolean' ? cloudResponse.success : true
      const cloudCode = typeof cloudResponse.code === 'number' ? cloudResponse.code : 0
      const cloudMessage = cloudResponse.message || cloudResponse.errorMessage || cloudResponse.error_message || ''
      if (!cloudSuccess || cloudCode !== 0) {
        throw new Error(cloudMessage || 'Cloud lead submission failed')
      }

      const cloudData = cloudResponse.data || cloudResponse
      const nextLocalLeadPayload = {
        ...buildLocalLeadPayload(requestPayload, 'cloud'),
        status: cloudData.status || 'new'
      }
      const cloudLeadId = cloudData.leadId || cloudData.id || ''
      if (cloudLeadId) {
        nextLocalLeadPayload.leadId = cloudLeadId
      }

      const localLead = createAdminLead(nextLocalLeadPayload)
      console.log('[leads:submit] route=cloud success')
      const result = {
        mode: 'cloud',
        source: 'cloud',
        debug: {
          route: 'cloud',
          fellBack: false
        },
        lead: localLead,
        raw: cloudResponse
      }
      logSubmitResult(result)
      return result
    } catch (error) {
      console.log(`[leads:submit] route=cloud failed message=${(error && error.message) || 'unknown'}`)
      console.log('[leads:submit] fallback -> api/mock')
      fallbackFromCloud = true
      // Fall through to existing API/mock flow to keep backward compatibility.
    }
  } else {
    console.log('[leads:submit] route=cloud skipped')
  }
  // #endif

  try {
    console.log('[leads:submit] route=api attempt')
    const response = await request({
      url: getLeadApiUrl(),
      method: 'POST',
      data: requestPayload,
      header: {
        'content-type': 'application/json'
      }
    })

    const parsed = parseResponseData(response)
    const success = typeof parsed.success === 'boolean' ? parsed.success : true
    const code = typeof parsed.code === 'number' ? parsed.code : 0
    const message = parsed.message || parsed.errorMessage || parsed.error_message || ''
    if (!success || code !== 0) {
      throw new Error(message || 'Lead submission failed')
    }

    const payloadData = parsed.data || parsed
    const nextLocalLeadPayload = {
      ...buildLocalLeadPayload(requestPayload, 'api'),
      status: payloadData.status || 'new'
    }
    const serverLeadId = payloadData.leadId || payloadData.id || ''
    if (serverLeadId) {
      nextLocalLeadPayload.leadId = serverLeadId
    }

    const localLead = createAdminLead(nextLocalLeadPayload)
    console.log('[leads:submit] route=api success')

    const result = {
      mode: 'api',
      source: 'api',
      debug: {
        route: 'api',
        fellBack: fallbackFromCloud
      },
      lead: localLead,
      raw: parsed
    }
    logSubmitResult(result)
    return result
  } catch (error) {
    console.log(`[leads:submit] route=api failed message=${(error && error.message) || 'unknown'}`)
    console.log('[leads:submit] route=mock fallback success')
    // TODO: replace this local fallback once /api/leads is confirmed online in every environment.
    const localLead = createAdminLead(buildLocalLeadPayload(requestPayload, 'mock'))

    const result = {
      mode: 'mock',
      source: 'mock',
      debug: {
        route: 'mock',
        fellBack: true,
        fromCloudAttempt: fallbackFromCloud
      },
      lead: localLead,
      error
    }
    logSubmitResult(result)
    return result
  }
}
