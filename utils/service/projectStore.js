import { createProjectEntity } from './entities'
import { getLeadList, updateLeadStatus } from './leadStore'

const PROJECT_STORAGE_KEY = 'service_projects'
const PROJECT_NOTE_STORAGE_KEY = 'service_project_notes'

function normalizeProjectList(list) {
  if (!Array.isArray(list)) {
    return []
  }

  return list.map((project) => createProjectEntity(project))
}

function saveProjectList(projects) {
  uni.setStorageSync(PROJECT_STORAGE_KEY, projects)
}

function normalizeProjectNoteList(list, projectId) {
  if (!Array.isArray(list)) {
    return []
  }

  return list
    .map((note) => ({
      noteId: note && note.noteId ? String(note.noteId) : `pnote_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      projectId: note && note.projectId ? String(note.projectId) : String(projectId || ''),
      content: note && note.content ? String(note.content) : '',
      createdAt: note && note.createdAt ? String(note.createdAt) : new Date().toISOString()
    }))
    .filter((note) => note.content)
    .sort((left, right) => String(right.createdAt || '').localeCompare(String(left.createdAt || '')))
}

function getProjectNoteMap() {
  const data = uni.getStorageSync(PROJECT_NOTE_STORAGE_KEY)
  if (!data || typeof data !== 'object') {
    return {}
  }
  return data
}

function saveProjectNoteMap(noteMap) {
  uni.setStorageSync(PROJECT_NOTE_STORAGE_KEY, noteMap)
}

function buildProjectNameFromLead(lead) {
  const brandName = String(lead.brandName || '').trim()
  const companyName = String(lead.companyName || '').trim()
  const demandType = String(lead.demandType || 'design_service').trim()

  if (brandName) {
    return `${brandName} ${demandType}`
  }

  if (companyName) {
    return `${companyName} ${demandType}`
  }

  return `Project ${lead.leadId || Date.now()}`
}

export function getProjectList() {
  const projects = uni.getStorageSync(PROJECT_STORAGE_KEY)
  return normalizeProjectList(projects).sort((left, right) =>
    String(right.updatedAt || right.createdAt || '').localeCompare(String(left.updatedAt || left.createdAt || ''))
  )
}

export function createProject(payload = {}) {
  const project = createProjectEntity({
    ...payload,
    updatedAt: new Date().toISOString()
  })

  const projects = getProjectList()
  projects.unshift(project)
  saveProjectList(projects)
  return project
}

export function findProjectByLeadId(leadId) {
  return getProjectList().find((project) => project.leadId === leadId) || null
}

export function getProjectById(projectId) {
  return getProjectList().find((project) => project.projectId === projectId) || null
}

export function updateProject(projectId, patch = {}) {
  const normalizedProjectId = String(projectId || '').trim()
  if (!normalizedProjectId) {
    throw new Error('Project ID is required')
  }

  const projects = getProjectList()
  let updatedProject = null

  const nextProjects = projects.map((project) => {
    if (project.projectId !== normalizedProjectId) {
      return project
    }

    updatedProject = createProjectEntity({
      ...project,
      ...patch,
      projectId: project.projectId,
      updatedAt: new Date().toISOString()
    })

    return updatedProject
  })

  if (!updatedProject) {
    throw new Error('Project not found')
  }

  saveProjectList(nextProjects)
  return updatedProject
}

export function getProjectNotes(projectId) {
  if (!projectId) {
    return []
  }

  const noteMap = getProjectNoteMap()
  return normalizeProjectNoteList(noteMap[projectId], projectId)
}

export function appendProjectNote(projectId, content) {
  const normalizedProjectId = String(projectId || '').trim()
  const normalizedContent = String(content || '').trim()

  if (!normalizedProjectId) {
    throw new Error('Project ID is required')
  }

  if (!normalizedContent) {
    throw new Error('Note content is required')
  }

  const noteMap = getProjectNoteMap()
  const existingNotes = normalizeProjectNoteList(noteMap[normalizedProjectId], normalizedProjectId)

  const nextNote = {
    noteId: `pnote_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    projectId: normalizedProjectId,
    content: normalizedContent,
    createdAt: new Date().toISOString()
  }

  const nextNotes = [nextNote, ...existingNotes]
  noteMap[normalizedProjectId] = nextNotes
  saveProjectNoteMap(noteMap)

  return nextNote
}

export function appendTaskToProject(projectId, taskId) {
  if (!projectId || !taskId) {
    throw new Error('Project ID and task ID are required')
  }

  const projects = getProjectList()
  let updatedProject = null

  const nextProjects = projects.map((project) => {
    if (project.projectId !== projectId) {
      return project
    }

    const nextTaskIds = Array.isArray(project.taskIds) ? [...project.taskIds] : []
    if (!nextTaskIds.includes(taskId)) {
      nextTaskIds.unshift(taskId)
    }

    updatedProject = {
      ...project,
      taskIds: nextTaskIds,
      updatedAt: new Date().toISOString()
    }

    return updatedProject
  })

  if (!updatedProject) {
    throw new Error('Project not found')
  }

  saveProjectList(nextProjects)
  return updatedProject
}

export function appendBatchToProject(projectId, batchId) {
  if (!projectId || !batchId) {
    throw new Error('Project ID and batch ID are required')
  }

  const projects = getProjectList()
  let updatedProject = null

  const nextProjects = projects.map((project) => {
    if (project.projectId !== projectId) {
      return project
    }

    const nextBatchIds = Array.isArray(project.batchIds) ? [...project.batchIds] : []
    if (!nextBatchIds.includes(batchId)) {
      nextBatchIds.unshift(batchId)
    }

    updatedProject = {
      ...project,
      batchIds: nextBatchIds,
      updatedAt: new Date().toISOString()
    }

    return updatedProject
  })

  if (!updatedProject) {
    throw new Error('Project not found')
  }

  saveProjectList(nextProjects)
  return updatedProject
}

export function createProjectFromLead(leadId, overrides = {}) {
  const lead = getLeadList().find((item) => item.leadId === leadId)

  if (!lead) {
    throw new Error('Lead not found')
  }

  const existingProject = findProjectByLeadId(leadId)
  if (existingProject) {
    return {
      project: existingProject,
      duplicated: true
    }
  }

  const project = createProject({
    leadId: lead.leadId,
    projectName: buildProjectNameFromLead(lead),
    projectType: lead.demandType || 'design_service',
    serviceScope: Array.isArray(lead.serviceScope) ? [...lead.serviceScope] : [],
    source: lead.source || lead.sourceChannel || 'manual',
    companyName: lead.companyName || '',
    contactName: lead.contactName || '',
    mobile: lead.mobile || lead.phone || '',
    phone: lead.mobile || lead.phone || '',
    wechat: lead.wechat || '',
    budgetRange: lead.budgetRange || '',
    expectedDeliveryDate: lead.expectedDeliveryDate || lead.expectedDeliveryTime || '',
    expectedDeliveryTime: lead.expectedDeliveryDate || lead.expectedDeliveryTime || '',
    requirementText: lead.requirementText || lead.description || '',
    description: lead.requirementText || lead.description || '',
    attachmentFileIds: Array.isArray(lead.attachmentFileIds) ? [...lead.attachmentFileIds] : [],
    leadSnapshot: {
      source: lead.source || lead.sourceChannel || 'manual',
      contactName: lead.contactName || '',
      mobile: lead.mobile || lead.phone || '',
      wechat: lead.wechat || '',
      companyName: lead.companyName || '',
      demandType: lead.demandType || 'design_service',
      budgetRange: lead.budgetRange || '',
      expectedDeliveryDate: lead.expectedDeliveryDate || lead.expectedDeliveryTime || '',
      requirementText: lead.requirementText || lead.description || '',
      attachmentFileIds: Array.isArray(lead.attachmentFileIds) ? [...lead.attachmentFileIds] : []
    },
    ...overrides
  })

  updateLeadStatus(leadId, 'converted')

  return {
    project,
    duplicated: false
  }
}
