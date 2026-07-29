import { createProject, getProjectByLeadId, updateProject } from './projectRepository'

const PROJECT_LEADS_STORAGE_KEY = 'diebiandesign_project_leads'

function readLeadSnapshots() {
  try {
    const leads = uni.getStorageSync(PROJECT_LEADS_STORAGE_KEY)
    return Array.isArray(leads) ? leads : []
  } catch (error) {
    return []
  }
}

function writeLeadSnapshots(leads = []) {
  uni.setStorageSync(PROJECT_LEADS_STORAGE_KEY, leads)
}

export function normalizeProjectLead(lead = {}) {
  const now = new Date().toISOString()
  const phone = String(lead.customerContact || lead.mobile || lead.phone || '').trim()
  const wechat = String(lead.wechat || '').trim()
  const email = String(lead.email || '').trim()
  return {
    leadId: String(lead.leadId || lead.id || lead._id || '').trim(),
    customerName: String(lead.customerName || lead.contactName || '').trim(),
    customerContact: phone || wechat || email,
    companyName: String(lead.companyName || lead.brandName || '').trim(),
    demandType: String(lead.demandType || 'design_service'),
    clothingCategory: String(lead.clothingCategory || lead.productCategory || '').trim(),
    quantity: String(lead.quantity || lead.expectedVolume || '').trim(),
    deadline: String(lead.deadline || lead.expectedDeliveryDate || lead.expectedDeliveryTime || '').trim(),
    description: String(lead.description || lead.requirementText || '').trim(),
    createdAt: lead.createdAt || now
  }
}

export function saveProjectLead(lead = {}) {
  const normalizedLead = normalizeProjectLead(lead)
  if (!normalizedLead.leadId) {
    return null
  }
  const leads = readLeadSnapshots()
  const existingIndex = leads.findIndex((item) => item.leadId === normalizedLead.leadId)
  if (existingIndex >= 0) {
    leads.splice(existingIndex, 1, normalizedLead)
  } else {
    leads.unshift(normalizedLead)
  }
  writeLeadSnapshots(leads)
  return normalizedLead
}

export function createProjectFromLead(lead = {}) {
  const normalizedLead = saveProjectLead(lead)
  if (!normalizedLead) {
    throw new Error('leadId is required to create project')
  }
  const existingProject = getProjectByLeadId(normalizedLead.leadId)
  if (existingProject) {
    return updateProject(existingProject.projectId, {
      customerName: normalizedLead.customerName || normalizedLead.companyName,
      customerContact: normalizedLead.customerContact,
      description: normalizedLead.description,
      deadline: normalizedLead.deadline
    })
  }
  const projectOwner = normalizedLead.companyName || normalizedLead.customerName || '企业客户'
  const project = createProject({
    projectName: `${projectOwner}服装出图项目`,
    leadId: normalizedLead.leadId,
    customerName: normalizedLead.customerName || normalizedLead.companyName,
    customerContact: normalizedLead.customerContact,
    description: normalizedLead.description,
    deadline: normalizedLead.deadline,
    assetIds: [],
    batchIds: [],
    taskIds: []
  })
  console.log('[lead:project:create]', {
    leadId: normalizedLead.leadId,
    projectId: project.projectId
  })
  return project
}

export function getProjectLeadSnapshots() {
  return readLeadSnapshots().map(normalizeProjectLead)
}
