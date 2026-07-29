const WORKSPACE_PLAN_VERSION_STORAGE_KEY = 'diebiandesign_workspace_plan_versions'

function clone(value) {
  return JSON.parse(JSON.stringify(value === undefined ? null : value))
}

function readVersions() {
  try {
    const value = uni.getStorageSync(WORKSPACE_PLAN_VERSION_STORAGE_KEY)
    return Array.isArray(value) ? value : []
  } catch (error) {
    return []
  }
}

function writeVersions(versions = []) {
  try {
    uni.setStorageSync(WORKSPACE_PLAN_VERSION_STORAGE_KEY, versions)
  } catch (error) {}
  return versions
}

function snapshotPlan(plan = {}) {
  return {
    guideId: String(plan.guideId || ''),
    category: String(plan.category || ''),
    title: String(plan.title || ''),
    entryType: String(plan.entryType || ''),
    recommendationId: String(plan.recommendationId || ''),
    actions: clone(Array.isArray(plan.actions) ? plan.actions : []),
    estimatedCost: Math.max(0, Number(plan.estimatedCost) || 0),
    outputCount: Math.max(0, Number(plan.outputCount) || 0),
    editableParams: clone(plan.editableParams || {})
  }
}

function planFromSnapshot(planId, snapshot = {}, basePlan = {}) {
  return {
    ...basePlan,
    planId,
    guideId: snapshot.guideId || '',
    category: snapshot.category || '',
    title: snapshot.title || '智能生产方案',
    entryType: snapshot.entryType || 'model',
    recommendationId: snapshot.recommendationId || '',
    actions: clone(snapshot.actions || []),
    estimatedCost: Math.max(0, Number(snapshot.estimatedCost) || 0),
    outputCount: Math.max(0, Number(snapshot.outputCount) || 0),
    editableParams: clone(snapshot.editableParams || {})
  }
}

function normalizeVersion(version = {}) {
  return {
    versionId: String(version.versionId || ''),
    planId: String(version.planId || ''),
    version: Math.max(1, Number(version.version) || 1),
    title: String(version.title || '智能生产方案'),
    params: clone(version.params || {}),
    changeSummary: String(version.changeSummary || '方案版本'),
    createdAt: version.createdAt || new Date().toISOString()
  }
}

function logVersion(version = {}) {
  if (!version.versionId) return
  console.log('[workspace:plan-version]', {
    versionId: version.versionId
  })
}

export function getWorkspacePlanVersions(planId = '') {
  return readVersions()
    .map(normalizeVersion)
    .filter((item) => item.planId === planId)
    .sort((left, right) => right.version - left.version)
}

export function getWorkspacePlanVersion(versionId = '') {
  return readVersions().map(normalizeVersion).find((item) => item.versionId === versionId) || null
}

export function createWorkspacePlanVersion(plan = {}, changeSummary = '方案版本') {
  if (!plan.planId) return null
  const versions = readVersions().map(normalizeVersion)
  const currentVersions = versions.filter((item) => item.planId === plan.planId)
  const versionNumber = currentVersions.reduce((max, item) => Math.max(max, item.version), 0) + 1
  const version = normalizeVersion({
    versionId: `workspace_plan_version_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    planId: plan.planId,
    version: versionNumber,
    title: plan.title,
    params: snapshotPlan(plan),
    changeSummary,
    createdAt: new Date().toISOString()
  })
  writeVersions([version, ...versions])
  logVersion(version)
  return version
}

export function ensureWorkspacePlanVersion(plan = {}) {
  const versions = getWorkspacePlanVersions(plan.planId)
  return versions.length ? versions[versions.length - 1] : createWorkspacePlanVersion(plan, '初始方案')
}

function getEditSummary(changes = {}) {
  const labels = {
    model: '模特',
    color: '颜色',
    scene: '场景',
    purpose: '用途',
    quantity: '数量'
  }
  const fields = Object.keys(changes).map((key) => labels[key] || key)
  return fields.length ? `修改${fields.join('、')}` : '编辑方案'
}

export function createWorkspacePlanEditVersion(plan = {}, edit = {}) {
  if (!plan.planId || !edit.beforeParams) return null
  if (!getWorkspacePlanVersions(plan.planId).length) {
    const originalPlan = planFromSnapshot(plan.planId, edit.beforeParams, plan)
    createWorkspacePlanVersion(originalPlan, '初始方案')
  }
  return createWorkspacePlanVersion(plan, getEditSummary(edit.changes))
}

export function switchWorkspacePlanVersion(plan = {}, versionId = '') {
  const version = getWorkspacePlanVersion(versionId)
  if (!version || version.planId !== plan.planId) return null
  logVersion(version)
  return {
    plan: planFromSnapshot(plan.planId, version.params, plan),
    version
  }
}

export function restoreWorkspacePlanVersion(plan = {}, versionId = '') {
  const switched = switchWorkspacePlanVersion(plan, versionId)
  if (!switched) return null
  const version = createWorkspacePlanVersion(
    switched.plan,
    `恢复自 V${switched.version.version}`
  )
  return {
    plan: switched.plan,
    sourceVersion: switched.version,
    version
  }
}

export function formatWorkspacePlanVersionTime(value = '') {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '--'
  const pad = (number) => String(number).padStart(2, '0')
  return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}
