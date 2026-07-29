function nowIso() {
  return new Date().toISOString()
}

function getContextProjectId(context = {}) {
  return context.projectId || context.lastProjectId || ''
}

function getContextPlanId(context = {}) {
  return context.planId || context.lastPlanId || ''
}

function getContextAssetCount(context = {}) {
  return Math.max(0, Number(context.assetCount || context.totalAssets || 0) || 0)
}

function getProductionAssetCount(production = {}) {
  if (Array.isArray(production.assetIds)) return production.assetIds.length
  return Math.max(0, Number(production.workCount || production.assetCount || 0) || 0)
}

function filterProjectContexts(contexts = [], project = {}) {
  const contextIds = Array.isArray(project.contextIds) ? project.contextIds : []
  return contexts.filter((context) => (
    getContextProjectId(context) === project.projectId ||
    contextIds.includes(context.contextId)
  ))
}

function filterProjectProductions(productions = [], contexts = []) {
  const planIds = new Set(contexts.map(getContextPlanId).filter(Boolean))
  return productions.filter((production) => planIds.has(production.planId))
}

export function buildWorkspaceProjectDashboard({
  project = {},
  contexts = [],
  productions = []
} = {}) {
  const projectContexts = filterProjectContexts(contexts, project)
  const projectProductions = filterProjectProductions(productions, projectContexts)
  const productionAssets = projectProductions.reduce((total, item) => total + getProductionAssetCount(item), 0)
  const contextAssets = projectContexts.reduce((total, item) => total + getContextAssetCount(item), 0)
  const totalAssets = Math.max(Number(project.assetCount || 0), productionAssets, contextAssets)
  const completedCount = projectProductions.filter((item) => item.status === 'completed').length
  const generatingCount = projectProductions.filter((item) => item.status === 'generating' || item.status === 'pending').length
  const failedCount = projectProductions.filter((item) => item.status === 'failed').length
  return {
    dashboardId: `workspace_dashboard_${project.projectId || project.workspaceProjectId || 'project'}`,
    projectId: project.projectId || '',
    brandId: project.brandId || '',
    totalContexts: projectContexts.length,
    totalAssets,
    completedCount,
    generatingCount,
    failedCount,
    updatedAt: project.updatedAt || nowIso()
  }
}

export function buildWorkspaceProjectDashboards({
  projects = [],
  contexts = [],
  productions = []
} = {}) {
  return projects.reduce((result, project) => {
    const dashboard = buildWorkspaceProjectDashboard({ project, contexts, productions })
    result[project.workspaceProjectId] = dashboard
    return result
  }, {})
}
