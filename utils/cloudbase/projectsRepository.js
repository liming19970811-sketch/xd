import { initCloudBase, isCloudBaseReady } from './init'
import { isCloudBaseEnabled } from './config'
import { createProjectEntity } from '../service/entities'

const PROJECTS_COLLECTION_NAME = 'projects'

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

export function canUseCloudReadProjects() {
  const enabled = isCloudBaseEnabled()
  const ready = ensureCloudReady()
  const databaseAvailable = hasCloudDatabase()
  const available = enabled && ready && databaseAvailable
  console.log(`[cloudbase:projects] read available=${available} enabled=${enabled} ready=${ready} database=${databaseAvailable}`)
  return available
}

export function canUseCloudCreateProject() {
  const available = canUseCloudReadProjects()
  console.log(`[cloudbase:projects] create available=${available}`)
  return available
}

export function canUseCloudUpdateProject() {
  const available = canUseCloudReadProjects()
  console.log(`[cloudbase:projects] update available=${available}`)
  return available
}

function normalizeLeadSnapshot(lead = {}) {
  const expectedDeliveryDate = lead.expectedDeliveryDate || lead.expectedDeliveryTime || ''
  const requirementText = lead.requirementText || lead.description || ''
  return {
    leadId: lead.leadId || '',
    source: lead.source || lead.sourceChannel || 'manual',
    contactName: lead.contactName || '',
    mobile: lead.mobile || lead.phone || '',
    phone: lead.mobile || lead.phone || '',
    wechat: lead.wechat || '',
    companyName: lead.companyName || '',
    brandName: lead.brandName || '',
    demandType: lead.demandType || 'design_service',
    budgetRange: lead.budgetRange || '',
    expectedDeliveryDate,
    expectedDeliveryTime: expectedDeliveryDate,
    requirementText,
    description: requirementText,
    attachmentFileIds: Array.isArray(lead.attachmentFileIds) ? [...lead.attachmentFileIds] : [],
    attachmentUrls: Array.isArray(lead.attachmentUrls) ? [...lead.attachmentUrls] : [],
    referenceImages: Array.isArray(lead.referenceImages) ? [...lead.referenceImages] : []
  }
}

function buildProjectFromLead(lead = {}) {
  const expectedDeliveryDate = lead.expectedDeliveryDate || lead.expectedDeliveryTime || ''
  const requirementText = lead.requirementText || lead.description || ''
  const brandName = String(lead.brandName || '').trim()
  const companyName = String(lead.companyName || '').trim()
  const demandType = String(lead.demandType || 'design_service').trim()
  let projectName = `Project ${lead.leadId || Date.now()}`

  if (brandName) {
    projectName = `${brandName} ${demandType}`
  } else if (companyName) {
    projectName = `${companyName} ${demandType}`
  }

  return createProjectEntity({
    leadId: lead.leadId || '',
    projectName,
    projectType: demandType,
    serviceScope: Array.isArray(lead.serviceScope) ? [...lead.serviceScope] : [],
    source: lead.source || lead.sourceChannel || 'manual',
    companyName: lead.companyName || '',
    brandName: lead.brandName || '',
    contactName: lead.contactName || '',
    mobile: lead.mobile || lead.phone || '',
    phone: lead.mobile || lead.phone || '',
    wechat: lead.wechat || '',
    budgetRange: lead.budgetRange || '',
    expectedDeliveryDate,
    expectedDeliveryTime: expectedDeliveryDate,
    requirementText,
    description: requirementText,
    attachmentFileIds: Array.isArray(lead.attachmentFileIds) ? [...lead.attachmentFileIds] : [],
    attachmentUrls: Array.isArray(lead.attachmentUrls) ? [...lead.attachmentUrls] : [],
    referenceImages: Array.isArray(lead.referenceImages) ? [...lead.referenceImages] : [],
    leadSnapshot: normalizeLeadSnapshot(lead)
  })
}

export async function getProjectByIdByCloud(projectId) {
  const normalizedProjectId = String(projectId || '').trim()
  if (!normalizedProjectId) {
    return {
      code: 0,
      message: 'project not found',
      data: null
    }
  }

  if (!canUseCloudReadProjects()) {
    console.log('[cloudbase:projects] detail skipped: cloud unavailable')
    throw new Error('Cloud read project detail is unavailable')
  }

  const db = wx.cloud.database()
  console.log(`[cloudbase:projects] detail start projectId=${normalizedProjectId}`)

  try {
    const queryResponse = await db
      .collection(PROJECTS_COLLECTION_NAME)
      .where({
        projectId: normalizedProjectId
      })
      .limit(1)
      .get()
    const list = queryResponse && Array.isArray(queryResponse.data) ? queryResponse.data : []
    const project = list[0] || null
    if (project) {
      console.log(`[cloudbase:projects] detail success source=query projectId=${normalizedProjectId}`)
      return {
        code: 0,
        message: 'ok',
        data: project
      }
    }
  } catch (error) {
    console.log(`[cloudbase:projects] detail query fallback message=${(error && error.message) || 'unknown'}`)
  }

  try {
    const docResponse = await db.collection(PROJECTS_COLLECTION_NAME).doc(normalizedProjectId).get()
    const project = docResponse && docResponse.data ? docResponse.data : null
    console.log(`[cloudbase:projects] detail success source=doc found=${!!project}`)
    return {
      code: 0,
      message: project ? 'ok' : 'project not found',
      data: project
    }
  } catch (error) {
    console.log(`[cloudbase:projects] detail doc failed message=${(error && error.message) || 'unknown'}`)
    return {
      code: 0,
      message: 'project not found',
      data: null
    }
  }
}

export async function getProjectListByCloud(query = {}) {
  if (!canUseCloudReadProjects()) {
    console.log('[cloudbase:projects] list skipped: cloud unavailable')
    throw new Error('Cloud read project list is unavailable')
  }

  const page = Math.max(Number(query.page || 1), 1)
  const pageSize = Math.max(Number(query.pageSize || 50), 1)
  const skip = (page - 1) * pageSize
  const db = wx.cloud.database()
  console.log(`[cloudbase:projects] list start page=${page} pageSize=${pageSize}`)

  const response = await db
    .collection(PROJECTS_COLLECTION_NAME)
    .orderBy('updatedAt', 'desc')
    .skip(skip)
    .limit(pageSize)
    .get()

  const list = response && Array.isArray(response.data) ? response.data : []
  console.log(`[cloudbase:projects] list success count=${list.length}`)
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

export async function getLeadProjectByCloud(leadId) {
  const normalizedLeadId = String(leadId || '').trim()
  if (!normalizedLeadId) {
    return {
      code: 0,
      message: 'project not found',
      data: null
    }
  }

  if (!canUseCloudReadProjects()) {
    console.log('[cloudbase:projects] leadProject skipped: cloud unavailable')
    throw new Error('Cloud read lead project is unavailable')
  }

  const db = wx.cloud.database()
  console.log(`[cloudbase:projects] leadProject start leadId=${normalizedLeadId}`)
  const response = await db
    .collection(PROJECTS_COLLECTION_NAME)
    .where({
      leadId: normalizedLeadId
    })
    .orderBy('updatedAt', 'desc')
    .limit(1)
    .get()
  const list = response && Array.isArray(response.data) ? response.data : []
  const project = list[0] || null
  console.log(`[cloudbase:projects] leadProject success leadId=${normalizedLeadId} found=${!!project}`)
  return {
    code: 0,
    message: project ? 'ok' : 'project not found',
    data: project
  }
}

export async function createProjectFromLeadByCloud(leadId, options = {}) {
  const normalizedLeadId = String(leadId || '').trim()
  if (!normalizedLeadId) {
    throw new Error('Lead ID is required')
  }

  if (!canUseCloudCreateProject()) {
    console.log('[cloudbase:projects] create skipped: cloud unavailable')
    throw new Error('Cloud create project is unavailable')
  }

  const getLeadById = options && typeof options.getLeadById === 'function' ? options.getLeadById : null
  if (!getLeadById) {
    throw new Error('Cloud project creation requires a lead getter')
  }

  const existingResponse = await getLeadProjectByCloud(normalizedLeadId)
  if (existingResponse && existingResponse.data) {
    console.log(`[cloudbase:projects] create duplicated leadId=${normalizedLeadId} projectId=${existingResponse.data.projectId || ''}`)
    return {
      code: 0,
      message: 'duplicated',
      data: {
        project: existingResponse.data,
        duplicated: true
      }
    }
  }

  const lead = await getLeadById(normalizedLeadId, { preferCloud: true })
  if (!lead || !lead.leadId) {
    throw new Error('Lead not found')
  }

  const project = buildProjectFromLead(lead)
  const db = wx.cloud.database()
  console.log(`[cloudbase:projects] create start leadId=${normalizedLeadId} projectId=${project.projectId}`)
  await db.collection(PROJECTS_COLLECTION_NAME).add({
    data: project
  })
  console.log(`[cloudbase:projects] create success source=cloud leadId=${normalizedLeadId} projectId=${project.projectId}`)
  return {
    code: 0,
    message: 'created',
    data: {
      project,
      duplicated: false
    }
  }
}

export async function updateProjectByCloud(projectId, patch = {}) {
  const normalizedProjectId = String(projectId || '').trim()
  if (!normalizedProjectId) {
    return {
      code: 400,
      message: 'projectId is required',
      data: null
    }
  }

  if (!canUseCloudUpdateProject()) {
    console.log('[cloudbase:projects] update skipped: cloud unavailable')
    throw new Error('Cloud update project is unavailable')
  }

  const nextPatch = {}
  if (Object.prototype.hasOwnProperty.call(patch, 'projectName')) {
    nextPatch.projectName = String(patch.projectName || '').trim()
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'status')) {
    nextPatch.status = patch.status
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'stage')) {
    nextPatch.stage = patch.stage
  }
  nextPatch.updatedAt = patch.updatedAt || new Date().toISOString()

  const db = wx.cloud.database()
  console.log(
    `[cloudbase:projects] update start projectId=${normalizedProjectId} fields=${Object.keys(nextPatch).join(',')}`
  )

  try {
    const docResponse = await db.collection(PROJECTS_COLLECTION_NAME).doc(normalizedProjectId).update({
      data: nextPatch
    })
    const updated = docResponse && docResponse.stats && docResponse.stats.updated ? docResponse.stats.updated : 0
    if (updated) {
      console.log(`[cloudbase:projects] update success source=doc projectId=${normalizedProjectId}`)
      return {
        code: 0,
        message: 'ok',
        data: {
          projectId: normalizedProjectId,
          ...nextPatch
        }
      }
    }
  } catch (error) {
    console.log(`[cloudbase:projects] update doc fallback message=${(error && error.message) || 'unknown'}`)
  }

  const queryResponse = await db
    .collection(PROJECTS_COLLECTION_NAME)
    .where({
      projectId: normalizedProjectId
    })
    .update({
      data: nextPatch
    })
  const updated = queryResponse && queryResponse.stats && queryResponse.stats.updated ? queryResponse.stats.updated : 0
  console.log(`[cloudbase:projects] update success source=query updated=${updated}`)

  return {
    code: updated ? 0 : 404,
    message: updated ? 'ok' : 'project not found',
    data: updated
      ? {
          projectId: normalizedProjectId,
          ...nextPatch
        }
      : null
  }
}
