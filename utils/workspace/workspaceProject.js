const STORAGE_KEY = 'diebi_workspace_project_v1'

function nowIso() {
  return new Date().toISOString()
}

function safeGetStorage() {
  try {
    return uni.getStorageSync(STORAGE_KEY) || null
  } catch (error) {
    return null
  }
}

function safeSetStorage(payload) {
  try {
    uni.setStorageSync(STORAGE_KEY, payload)
  } catch (error) {
    // Project space is a local workspace index; failures should not block creation.
  }
}

function normalizeProject(input = {}) {
  const projectId = input.projectId || ''
  const workspaceProjectId = input.workspaceProjectId || `workspace_project_${projectId || Date.now()}`
  const contextIds = Array.isArray(input.contextIds)
    ? [...new Set(input.contextIds.filter(Boolean))]
    : []
  const updatedAt = input.updatedAt || nowIso()
  return {
    workspaceProjectId,
    projectId,
    brandId: input.brandId || '',
    customerId: input.customerId || '',
    title: input.title || projectId || '未命名项目',
    contextIds,
    assetCount: Math.max(0, Number(input.assetCount) || contextIds.length || 0),
    status: input.status || 'active',
    updatedAt
  }
}

function normalizeProjectList(raw) {
  const list = raw && Array.isArray(raw.projects) ? raw.projects : Array.isArray(raw) ? raw : []
  return list
    .map(normalizeProject)
    .filter((item) => item.workspaceProjectId && item.projectId)
    .sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')))
}

function buildProjectsFromContexts(contexts = []) {
  const map = {}
  contexts.forEach((context) => {
    const projectId = context.projectId || context.lastProjectId || ''
    if (!projectId) return
    const workspaceProjectId = `workspace_project_${projectId}`
    const previous = map[workspaceProjectId] || {
      workspaceProjectId,
      projectId,
      brandId: context.brandId || context.lastBrandId || '',
      customerId: context.customerId || context.lastCustomerId || '',
      title: context.projectTitle || context.projectName || projectId,
      contextIds: [],
      assetCount: 0,
      status: 'active',
      updatedAt: context.lastUsedAt || context.updatedAt || context.createdAt || nowIso()
    }
    previous.contextIds = [...new Set([...previous.contextIds, context.contextId].filter(Boolean))]
    previous.assetCount = Math.max(previous.assetCount, Number(context.assetCount || 0), previous.contextIds.length)
    previous.updatedAt = String(context.lastUsedAt || context.updatedAt || context.createdAt || '').localeCompare(String(previous.updatedAt || '')) > 0
      ? (context.lastUsedAt || context.updatedAt || context.createdAt)
      : previous.updatedAt
    if (!previous.brandId) previous.brandId = context.brandId || context.lastBrandId || ''
    if (!previous.customerId) previous.customerId = context.customerId || context.lastCustomerId || ''
    map[workspaceProjectId] = previous
  })
  return Object.values(map).map(normalizeProject)
}

export function getWorkspaceProjects(contexts = []) {
  const stored = normalizeProjectList(safeGetStorage())
  const derived = buildProjectsFromContexts(contexts)
  const map = {}
  ;[...stored, ...derived].forEach((project) => {
    const key = project.workspaceProjectId
    const previous = map[key] || {}
    map[key] = normalizeProject({
      ...previous,
      ...project,
      contextIds: [...new Set([...(previous.contextIds || []), ...(project.contextIds || [])])],
      assetCount: Math.max(Number(previous.assetCount || 0), Number(project.assetCount || 0)),
      updatedAt: String(project.updatedAt || '').localeCompare(String(previous.updatedAt || '')) > 0
        ? project.updatedAt
        : previous.updatedAt || project.updatedAt
    })
  })
  const projects = Object.values(map)
    .filter((item) => item.projectId)
    .sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')))
  safeSetStorage({ version: 1, projects })
  return projects
}

export function upsertWorkspaceProject(project = {}, contexts = []) {
  if (!project.projectId && !project.workspaceProjectId) return null
  const projects = getWorkspaceProjects(contexts)
  const workspaceProjectId = project.workspaceProjectId || `workspace_project_${project.projectId}`
  const index = projects.findIndex((item) => item.workspaceProjectId === workspaceProjectId || item.projectId === project.projectId)
  const previous = index >= 0 ? projects[index] : {}
  const next = normalizeProject({
    ...previous,
    ...project,
    workspaceProjectId,
    contextIds: [...new Set([...(previous.contextIds || []), ...(project.contextIds || [])])],
    updatedAt: nowIso()
  })
  const updated = index >= 0
    ? projects.map((item, itemIndex) => (itemIndex === index ? next : item))
    : [next, ...projects]
  safeSetStorage({ version: 1, projects: updated })
  return next
}

export function filterWorkspaceProjectContexts(contexts = [], project = {}) {
  const contextIds = Array.isArray(project.contextIds) ? project.contextIds : []
  return contexts.filter((context) => {
    const projectId = context.projectId || context.lastProjectId || ''
    return projectId === project.projectId || contextIds.includes(context.contextId)
  })
}
