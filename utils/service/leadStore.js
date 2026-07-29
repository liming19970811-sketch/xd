import { createLeadEntity, LEAD_STATUS_OPTIONS } from './entities'

const LEAD_STORAGE_KEY = 'service_leads'
const LEAD_NOTE_STORAGE_KEY = 'service_lead_notes'

function normalizeLeadList(list) {
  if (!Array.isArray(list)) {
    return []
  }

  return list.map((lead) =>
    createLeadEntity({
      source: lead && lead.source ? lead.source : lead && lead.sourceChannel ? lead.sourceChannel : 'website',
      sourcePage: lead && lead.sourcePage ? lead.sourcePage : 'website-demand',
      demandType: lead && lead.demandType ? lead.demandType : 'design_service',
      ...lead
    })
  )
}

function saveLeadList(leads) {
  uni.setStorageSync(LEAD_STORAGE_KEY, leads)
}

export function getLeadList() {
  const leads = uni.getStorageSync(LEAD_STORAGE_KEY)
  return normalizeLeadList(leads)
    .sort((left, right) => String(right.updatedAt || right.createdAt || '').localeCompare(String(left.updatedAt || left.createdAt || '')))
}

export function createLead(payload = {}) {
  const lead = createLeadEntity({
    source: payload && payload.source ? payload.source : payload && payload.sourceChannel ? payload.sourceChannel : 'website',
    sourcePage: payload && payload.sourcePage ? payload.sourcePage : 'website-demand',
    demandType: payload && payload.demandType ? payload.demandType : 'design_service',
    ...payload,
    updatedAt: new Date().toISOString()
  })

  const leads = getLeadList()
  leads.unshift(lead)
  saveLeadList(leads)
  return lead
}

export function getLeadById(leadId) {
  if (!leadId) {
    return null
  }

  return getLeadList().find((lead) => lead.leadId === leadId) || null
}

export function updateLeadStatus(leadId, nextStatus) {
  if (!LEAD_STATUS_OPTIONS.includes(nextStatus)) {
    throw new Error('Invalid lead status')
  }

  const leads = getLeadList().map((lead) => {
    if (lead.leadId !== leadId) {
      return lead
    }

    return {
      ...lead,
      status: nextStatus,
      updatedAt: new Date().toISOString()
    }
  })

  saveLeadList(leads)
  return leads.find((lead) => lead.leadId === leadId) || null
}

function normalizeLeadNoteList(list, leadId) {
  if (!Array.isArray(list)) {
    return []
  }

  return list
    .map((note) => ({
      noteId: note && note.noteId ? String(note.noteId) : `note_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      leadId: note && note.leadId ? String(note.leadId) : String(leadId || ''),
      content: note && note.content ? String(note.content) : '',
      createdAt: note && note.createdAt ? String(note.createdAt) : new Date().toISOString()
    }))
    .filter((note) => note.content)
    .sort((left, right) => String(right.createdAt || '').localeCompare(String(left.createdAt || '')))
}

function getLeadNoteMap() {
  const data = uni.getStorageSync(LEAD_NOTE_STORAGE_KEY)
  if (!data || typeof data !== 'object') {
    return {}
  }
  return data
}

function saveLeadNoteMap(noteMap) {
  uni.setStorageSync(LEAD_NOTE_STORAGE_KEY, noteMap)
}

export function getLeadNotes(leadId) {
  if (!leadId) {
    return []
  }

  const noteMap = getLeadNoteMap()
  return normalizeLeadNoteList(noteMap[leadId], leadId)
}

export function appendLeadNote(leadId, content) {
  const normalizedLeadId = String(leadId || '').trim()
  const normalizedContent = String(content || '').trim()

  if (!normalizedLeadId) {
    throw new Error('Lead ID is required')
  }

  if (!normalizedContent) {
    throw new Error('Note content is required')
  }

  const noteMap = getLeadNoteMap()
  const existingNotes = normalizeLeadNoteList(noteMap[normalizedLeadId], normalizedLeadId)

  const nextNote = {
    noteId: `note_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    leadId: normalizedLeadId,
    content: normalizedContent,
    createdAt: new Date().toISOString()
  }

  const nextNotes = [nextNote, ...existingNotes]
  noteMap[normalizedLeadId] = nextNotes
  saveLeadNoteMap(noteMap)

  return nextNote
}
