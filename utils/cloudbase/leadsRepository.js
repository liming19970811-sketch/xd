import { isCloudBaseEnabled } from './config'
import { initCloudBase, isCloudBaseReady } from './init'

const CREATE_LEAD_FUNCTION_NAME = 'leads_create'
const LEADS_COLLECTION_NAME = 'leads'

function hasCloudCallFunction() {
  return (
    typeof wx !== 'undefined' &&
    wx &&
    wx.cloud &&
    typeof wx.cloud.callFunction === 'function'
  )
}

function hasCloudDatabase() {
  return (
    typeof wx !== 'undefined' &&
    wx &&
    wx.cloud &&
    typeof wx.cloud.database === 'function'
  )
}

function ensureCloudReady() {
  if (!isCloudBaseReady()) {
    initCloudBase()
  }
  return isCloudBaseReady()
}

export function canUseCloudCreateLead() {
  const enabled = isCloudBaseEnabled()
  const ready = isCloudBaseReady()
  const callable = hasCloudCallFunction()
  const available = enabled && ready && callable
  console.log(`[cloudbase:leads] create available=${available} enabled=${enabled} ready=${ready} callable=${callable}`)
  return available
}

export function canUseCloudReadLeads() {
  const enabled = isCloudBaseEnabled()
  const ready = ensureCloudReady()
  const databaseAvailable = hasCloudDatabase()
  const available = enabled && ready && databaseAvailable
  console.log(`[cloudbase:leads] read available=${available} enabled=${enabled} ready=${ready} database=${databaseAvailable}`)
  return available
}

export function canUseCloudUpdateLead() {
  const available = canUseCloudReadLeads()
  console.log(`[cloudbase:leads] update available=${available}`)
  return available
}

export async function createLeadByCloud(payload = {}) {
  if (!canUseCloudCreateLead()) {
    console.log('[cloudbase:leads] create skipped: cloud unavailable')
    throw new Error('Cloud create lead is unavailable')
  }

  console.log(`[cloudbase:leads] callFunction start name=${CREATE_LEAD_FUNCTION_NAME}`)
  const response = await wx.cloud.callFunction({
    name: CREATE_LEAD_FUNCTION_NAME,
    data: {
      action: 'createLead',
      payload
    }
  })

  const result = response && Object.prototype.hasOwnProperty.call(response, 'result')
    ? response.result
    : response

  const normalizedResult = result || {}
  const code = typeof normalizedResult.code === 'number' ? normalizedResult.code : 0
  const success = typeof normalizedResult.success === 'boolean' ? normalizedResult.success : code === 0
  const data = normalizedResult.data || {}
  console.log(`[cloudbase:leads] callFunction done success=${success} code=${code} leadId=${data.leadId || data.id || ''}`)
  return normalizedResult
}

export async function getLeadListByCloud(query = {}) {
  if (!canUseCloudReadLeads()) {
    console.log('[cloudbase:leads] list skipped: cloud unavailable')
    throw new Error('Cloud read leads is unavailable')
  }

  const page = Math.max(Number(query.page || 1), 1)
  const pageSize = Math.max(Number(query.pageSize || 50), 1)
  const skip = (page - 1) * pageSize
  console.log(`[cloudbase:leads] list start page=${page} pageSize=${pageSize}`)

  const db = wx.cloud.database()
  const response = await db
    .collection(LEADS_COLLECTION_NAME)
    .orderBy('createdAt', 'desc')
    .skip(skip)
    .limit(pageSize)
    .get()

  const list = response && Array.isArray(response.data) ? response.data : []
  console.log(`[cloudbase:leads] list success count=${list.length}`)
  return {
    code: 0,
    message: 'ok',
    data: {
      list,
      total: list.length,
      page,
      pageSize
    }
  }
}

export async function getLeadByIdByCloud(leadId) {
  const normalizedLeadId = String(leadId || '').trim()
  if (!normalizedLeadId) {
    return {
      code: 0,
      message: 'lead not found',
      data: null
    }
  }

  if (!canUseCloudReadLeads()) {
    console.log('[cloudbase:leads] detail skipped: cloud unavailable')
    throw new Error('Cloud read lead detail is unavailable')
  }

  const db = wx.cloud.database()
  console.log(`[cloudbase:leads] detail start leadId=${normalizedLeadId}`)

  try {
    const docResponse = await db.collection(LEADS_COLLECTION_NAME).doc(normalizedLeadId).get()
    const doc = docResponse && docResponse.data ? docResponse.data : null
    if (doc) {
      console.log(`[cloudbase:leads] detail success source=doc leadId=${normalizedLeadId}`)
      return {
        code: 0,
        message: 'ok',
        data: doc
      }
    }
  } catch (error) {
    console.log(`[cloudbase:leads] detail doc fallback message=${(error && error.message) || 'unknown'}`)
  }

  const queryResponse = await db
    .collection(LEADS_COLLECTION_NAME)
    .where({
      leadId: normalizedLeadId
    })
    .limit(1)
    .get()
  const list = queryResponse && Array.isArray(queryResponse.data) ? queryResponse.data : []
  const lead = list[0] || null
  console.log(`[cloudbase:leads] detail success source=query found=${!!lead}`)
  return {
    code: 0,
    message: lead ? 'ok' : 'lead not found',
    data: lead
  }
}

export async function updateLeadFollowStatusByCloud(leadId, followStatus) {
  const normalizedLeadId = String(leadId || '').trim()
  const normalizedFollowStatus = String(followStatus || '').trim()

  if (!normalizedLeadId || !normalizedFollowStatus) {
    return {
      code: 400,
      message: 'leadId and followStatus are required',
      data: null
    }
  }

  if (!canUseCloudUpdateLead()) {
    console.log('[cloudbase:leads] update skipped: cloud unavailable')
    throw new Error('Cloud update lead is unavailable')
  }

  const updatedAt = new Date().toISOString()
  const patch = {
    followStatus: normalizedFollowStatus,
    status: normalizedFollowStatus,
    updatedAt
  }
  const db = wx.cloud.database()
  console.log(`[cloudbase:leads] update start leadId=${normalizedLeadId} followStatus=${normalizedFollowStatus}`)

  try {
    const docResponse = await db.collection(LEADS_COLLECTION_NAME).doc(normalizedLeadId).update({
      data: patch
    })
    const updated = docResponse && docResponse.stats && docResponse.stats.updated ? docResponse.stats.updated : 0
    if (updated) {
      console.log(`[cloudbase:leads] update success source=doc leadId=${normalizedLeadId}`)
      return {
        code: 0,
        message: 'ok',
        data: {
          leadId: normalizedLeadId,
          ...patch
        }
      }
    }
  } catch (error) {
    console.log(`[cloudbase:leads] update doc fallback message=${(error && error.message) || 'unknown'}`)
  }

  const queryResponse = await db
    .collection(LEADS_COLLECTION_NAME)
    .where({
      leadId: normalizedLeadId
    })
    .update({
      data: patch
    })
  const updated = queryResponse && queryResponse.stats && queryResponse.stats.updated ? queryResponse.stats.updated : 0
  console.log(`[cloudbase:leads] update success source=query updated=${updated}`)

  return {
    code: updated ? 0 : 404,
    message: updated ? 'ok' : 'lead not found',
    data: updated
      ? {
          leadId: normalizedLeadId,
          ...patch
        }
      : null
  }
}
