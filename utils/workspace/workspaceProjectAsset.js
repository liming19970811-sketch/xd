const ASSET_TYPE_LABELS = Object.freeze({
  design: '设计方案',
  image: '图片作品',
  model: '模特资产',
  color: '颜色资产',
  scene: '场景资产',
  template: '模板方案'
})

function getProjectId(context = {}) {
  return context.projectId || context.lastProjectId || ''
}

function getPlanId(context = {}) {
  return context.planId || context.lastPlanId || ''
}

function getContextCreatedAt(context = {}) {
  return context.createdAt || context.lastUsedAt || context.updatedAt || new Date().toISOString()
}

function getProductionCreatedAt(production = {}) {
  return production.completedAt || production.createdAt || new Date().toISOString()
}

function normalizeAsset(input = {}) {
  const projectId = input.projectId || ''
  const assetType = input.assetType || 'template'
  const assetId = input.assetId || `${assetType}_${input.sourceContextId || Date.now()}`
  return {
    projectAssetId: input.projectAssetId || `project_asset_${projectId}_${assetType}_${assetId}_${input.sourceContextId || 'source'}`,
    projectId,
    assetId,
    assetType,
    title: input.title || ASSET_TYPE_LABELS[assetType] || '项目资产',
    sourceContextId: input.sourceContextId || '',
    createdAt: input.createdAt || new Date().toISOString()
  }
}

function isProjectContext(context = {}, project = {}) {
  const contextIds = Array.isArray(project.contextIds) ? project.contextIds : []
  return getProjectId(context) === project.projectId || contextIds.includes(context.contextId)
}

function pushContextAsset(assets, context, project, assetType, assetId, title) {
  if (!assetId) return
  assets.push(normalizeAsset({
    projectId: project.projectId || getProjectId(context),
    assetId,
    assetType,
    title,
    sourceContextId: context.contextId || '',
    createdAt: getContextCreatedAt(context)
  }))
}

function getProjectContexts(contexts = [], project = {}) {
  return contexts.filter((context) => isProjectContext(context, project))
}

function getProjectProductions(productions = [], contexts = []) {
  const planIds = new Set(contexts.map(getPlanId).filter(Boolean))
  return productions.filter((production) => planIds.has(production.planId))
}

function buildContextAssets(contexts = [], project = {}) {
  const assets = []
  contexts.forEach((context) => {
    const title = context.title || context.planId || context.lastPlanId || '项目创作'
    pushContextAsset(assets, context, project, 'template', getPlanId(context), title)
    pushContextAsset(assets, context, project, 'design', context.designId || context.lastDesignId || '', `${title} · 设计`)
    pushContextAsset(assets, context, project, 'model', context.modelId || context.lastModelId || '', `${title} · 模特`)
    pushContextAsset(assets, context, project, 'color', context.colorId || context.lastColorId || '', `${title} · 颜色`)
    pushContextAsset(assets, context, project, 'scene', context.sceneId || context.lastSceneId || '', `${title} · 场景`)
  })
  return assets
}

function buildProductionAssets(productions = [], contexts = [], project = {}) {
  const contextByPlanId = contexts.reduce((result, context) => {
    const planId = getPlanId(context)
    if (planId && !result[planId]) result[planId] = context
    return result
  }, {})
  const assets = []
  productions.forEach((production) => {
    const sourceContext = contextByPlanId[production.planId] || {}
    const assetIds = Array.isArray(production.assetIds) ? production.assetIds : []
    assetIds.forEach((assetId, index) => {
      assets.push(normalizeAsset({
        projectId: project.projectId || getProjectId(sourceContext),
        assetId,
        assetType: 'image',
        title: `${production.planName || sourceContext.title || '生成作品'} ${index + 1}`,
        sourceContextId: sourceContext.contextId || '',
        createdAt: getProductionCreatedAt(production)
      }))
    })
  })
  return assets
}

export function buildWorkspaceProjectAssets({
  project = {},
  contexts = [],
  productions = []
} = {}) {
  const projectContexts = getProjectContexts(contexts, project)
  const projectProductions = getProjectProductions(productions, projectContexts)
  const assets = [
    ...buildContextAssets(projectContexts, project),
    ...buildProductionAssets(projectProductions, projectContexts, project)
  ]
  const map = {}
  assets.forEach((asset) => {
    if (!asset.projectId || !asset.assetId) return
    map[asset.projectAssetId] = asset
  })
  return Object.values(map).sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))
}

export function getWorkspaceProjectAssetTypeLabel(assetType = '') {
  return ASSET_TYPE_LABELS[assetType] || '项目资产'
}

export function getWorkspaceProjectAssetSource(asset = {}, contexts = [], productions = []) {
  const context = contexts.find((item) => item.contextId === asset.sourceContextId) || {}
  const planId = getPlanId(context)
  const production = productions.find((item) => (
    (Array.isArray(item.assetIds) && item.assetIds.includes(asset.assetId)) ||
    (planId && item.planId === planId)
  )) || null
  return {
    contextId: asset.sourceContextId || '',
    planId,
    generationRecord: production ? (production.historyId || production.planName || production.status || '生成记录') : '暂无生成记录'
  }
}
