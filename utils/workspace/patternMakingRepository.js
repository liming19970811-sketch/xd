import { getCurrentEnterpriseId } from '../tenant/tenantContext.js'
import { getCurrentMember, getCurrentUser } from '../auth/authRepository.js'

const PATTERN_TASK_KEY = 'diebians_workspace_pattern_tasks_v1'
const PATTERN_MASTER_KEY = 'diebians_workspace_pattern_masters_v1'
const PATTERN_VERSION_KEY = 'diebians_workspace_pattern_versions_v1'
const PATTERN_PART_KEY = 'diebians_workspace_pattern_parts_v1'
const PATTERN_SIZE_SPEC_KEY = 'diebians_workspace_pattern_size_specs_v1'

const CATEGORY_PART_TEMPLATES = Object.freeze({
  tshirt: ['前衣片', '后衣片', '袖片', '领口螺纹'],
  shirt: ['前衣片', '后衣片', '过肩', '袖片', '袖克夫', '衣领', '门襟'],
  dress: ['前身片', '后身片', '袖片', '领口贴边', '裙身片'],
  skirt: ['前裙片', '后裙片', '腰头'],
  pants: ['前裤片', '后裤片', '腰头', '口袋布'],
  coat: ['前衣片', '后衣片', '侧片', '袖片', '衣领', '挂面', '口袋布']
})

function nowIso() {
  return new Date().toISOString()
}

function createId(prefix = 'pattern') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

function readStore(key = '') {
  try {
    const value = uni.getStorageSync(key)
    return Array.isArray(value) ? value : []
  } catch (error) {
    return []
  }
}

function writeStore(key = '', value = []) {
  try {
    uni.setStorageSync(key, Array.isArray(value) ? value : [])
  } catch (error) {}
}

function currentEnterpriseId() {
  return String(getCurrentEnterpriseId() || 'local_enterprise')
}

function normalizeTask(task = {}) {
  return {
    taskId: String(task.taskId || ''),
    enterpriseId: String(task.enterpriseId || currentEnterpriseId()),
    projectId: String(task.projectId || ''),
    patternMasterId: String(task.patternMasterId || ''),
    currentVersionId: String(task.currentVersionId || ''),
    historyId: String(task.historyId || ''),
    batchId: String(task.batchId || ''),
    taskIds: Array.isArray(task.taskIds) ? task.taskIds.map(String).filter(Boolean) : [],
    category: String(task.category || ''),
    status: String(task.status || 'draft'),
    reviewStatus: String(task.reviewStatus || 'not_submitted'),
    productionStatus: String(task.productionStatus || 'not_available'),
    title: String(task.title || 'AI 制版草稿'),
    createdBy: String(task.createdBy || ''),
    createdAt: task.createdAt || nowIso(),
    updatedAt: task.updatedAt || task.createdAt || nowIso()
  }
}

function normalizeMaster(master = {}) {
  const category = String(master.category || '')
  const taxonomy = master.taxonomy && typeof master.taxonomy === 'object' ? master.taxonomy : {}
  return {
    patternMasterId: String(master.patternMasterId || ''),
    enterpriseId: String(master.enterpriseId || currentEnterpriseId()),
    ownerMemberId: String(master.ownerMemberId || ''),
    ownerUserId: String(master.ownerUserId || ''),
    patternCode: String(master.patternCode || ''),
    category,
    title: String(master.title || '未命名版型'),
    source: String(master.source || 'ai_pattern'),
    patternLevel: String(master.patternLevel || 'A'),
    humanReviewRequired: master.humanReviewRequired !== false,
    factoryReady: master.factoryReady === true,
    industrialStatus: String(master.industrialStatus || 'not_implemented'),
    scope: String(master.scope || 'enterprise'),
    genderAge: String(master.genderAge || '成人女装'),
    silhouette: String(master.silhouette || '常规'),
    collar: String(master.collar || '常规领型'),
    sleeve: String(master.sleeve || '常规袖型'),
    length: String(master.length || '常规衣长'),
    ease: String(master.ease || '标准松量'),
    fabric: String(master.fabric || '常规面料'),
    season: String(master.season || '四季'),
    sizeRange: String(master.sizeRange || 'S-XL'),
    reviewStatus: String(master.reviewStatus || 'draft'),
    currentVersionId: String(master.currentVersionId || ''),
    approvedVersionId: String(master.approvedVersionId || ''),
    productionStatus: String(master.productionStatus || 'not_available'),
    favorite: Boolean(master.favorite),
    archived: Boolean(master.archived),
    parentPatternMasterId: String(master.parentPatternMasterId || ''),
    derivedPatternIds: Array.isArray(master.derivedPatternIds) ? master.derivedPatternIds : [],
    linkedProjectIds: Array.isArray(master.linkedProjectIds) ? master.linkedProjectIds : [],
    linkedAssetIds: Array.isArray(master.linkedAssetIds) ? master.linkedAssetIds : [],
    tags: Array.isArray(master.tags) ? master.tags : [category, master.silhouette, master.collar].filter(Boolean),
    taxonomy: {
      garmentCategory: String(taxonomy.garmentCategory || category),
      audience: String(taxonomy.audience || master.genderAge || ''),
      season: String(taxonomy.season || master.season || ''),
      style: String(taxonomy.style || ''),
      fitType: String(taxonomy.fitType || master.silhouette || ''),
      neckType: String(taxonomy.neckType || master.collar || ''),
      sleeveType: String(taxonomy.sleeveType || master.sleeve || ''),
      lengthType: String(taxonomy.lengthType || master.length || ''),
      materialCompatibility: Array.isArray(taxonomy.materialCompatibility) ? taxonomy.materialCompatibility.map(String).filter(Boolean) : [],
      usageScene: Array.isArray(taxonomy.usageScene) ? taxonomy.usageScene.map(String).filter(Boolean) : []
    },
    createdAt: master.createdAt || nowIso(),
    updatedAt: master.updatedAt || master.createdAt || nowIso()
  }
}

function normalizeVersion(version = {}) {
  return {
    versionId: String(version.versionId || ''),
    patternMasterId: String(version.patternMasterId || ''),
    enterpriseId: String(version.enterpriseId || currentEnterpriseId()),
    versionNo: String(version.versionNo || 'V1'),
    status: String(version.status || 'draft'),
    reviewStatus: String(version.reviewStatus || 'not_submitted'),
    reviewerId: String(version.reviewerId || ''),
    reviewNotes: String(version.reviewNotes || ''),
    assignedReviewerMemberId: String(version.assignedReviewerMemberId || ''),
    productionAvailable: Boolean(version.productionAvailable),
    trainingCandidate: Boolean(version.trainingCandidate),
    patternLevel: String(version.patternLevel || 'A'),
    humanReviewRequired: version.humanReviewRequired !== false,
    industrialStatus: String(version.industrialStatus || 'not_implemented'),
    historyId: String(version.historyId || ''),
    batchId: String(version.batchId || ''),
    taskIds: Array.isArray(version.taskIds) ? version.taskIds.map(String).filter(Boolean) : [],
    assetIds: Array.isArray(version.assetIds) ? version.assetIds.map(String).filter(Boolean) : [],
    requestedOutputs: Array.isArray(version.requestedOutputs) ? version.requestedOutputs : [],
    generatedOutputs: Array.isArray(version.generatedOutputs) ? version.generatedOutputs : [],
    aiDraft: version.aiDraft && typeof version.aiDraft === 'object' ? version.aiDraft : {},
    humanRevision: version.humanRevision && typeof version.humanRevision === 'object' ? version.humanRevision : null,
    diff: Array.isArray(version.diff) ? version.diff : [],
    sizeParams: version.sizeParams && typeof version.sizeParams === 'object' ? version.sizeParams : {},
    craftNote: String(version.craftNote || ''),
    createdAt: version.createdAt || nowIso(),
    updatedAt: version.updatedAt || version.createdAt || nowIso()
  }
}

export function applyTrustedPatternReviewStatus(patternMasterId = '', input = {}) {
  const allowed = ['under_review', 'changes_requested', 'reviewed', 'approved', 'archived']
  const status = String(input.reviewStatus || '')
  const versionId = String(input.versionId || '')
  if (!patternMasterId || !versionId || !allowed.includes(status)) return { ok: false, errorCode: 'trusted_review_snapshot_invalid' }
  const master = getPatternMaster(patternMasterId)
  if (!master) return { ok: false, errorCode: 'pattern_not_found' }
  if (!getPatternVersion(versionId)) return { ok: false, errorCode: 'version_snapshot_not_local' }
  const updatedAt = input.updatedAt || nowIso()
  updateRecord(PATTERN_MASTER_KEY, (item) => item.patternMasterId === patternMasterId, (item) => ({
    ...normalizeMaster(item), currentVersionId: versionId, reviewStatus: status,
    approvedVersionId: status === 'approved' ? versionId : normalizeMaster(item).approvedVersionId,
    productionStatus: status === 'approved' ? 'reviewed_reference' : 'not_available', factoryReady: false, updatedAt
  }))
  updateRecord(PATTERN_VERSION_KEY, (item) => item.versionId === versionId, (item) => ({
    ...normalizeVersion(item), status, reviewStatus: status, productionAvailable: false,
    reviewerId: String(input.reviewerId || normalizeVersion(item).reviewerId), reviewNotes: String(input.reviewNotes || normalizeVersion(item).reviewNotes), updatedAt
  }))
  return { ok: true }
}

function normalizePart(part = {}) {
  return {
    patternPartId: String(part.patternPartId || ''),
    patternMasterId: String(part.patternMasterId || ''),
    versionId: String(part.versionId || ''),
    enterpriseId: String(part.enterpriseId || currentEnterpriseId()),
    partCode: String(part.partCode || ''),
    name: String(part.name || '未命名部件'),
    quantity: Math.max(1, Number(part.quantity) || 1),
    cutQuantity: Math.max(1, Number(part.cutQuantity) || 1),
    materialLayer: String(part.materialLayer || 'shell'),
    grainDirection: String(part.grainDirection || 'pending_review'),
    seamAllowanceStatus: String(part.seamAllowanceStatus || 'suggested_only'),
    source: String(part.source || 'category_template'),
    reviewStatus: String(part.reviewStatus || 'not_submitted'),
    createdAt: part.createdAt || nowIso(),
    updatedAt: part.updatedAt || part.createdAt || nowIso()
  }
}

function normalizeSizeSpec(spec = {}) {
  return {
    sizeSpecId: String(spec.sizeSpecId || ''),
    patternMasterId: String(spec.patternMasterId || ''),
    versionId: String(spec.versionId || ''),
    enterpriseId: String(spec.enterpriseId || currentEnterpriseId()),
    baseSize: String(spec.baseSize || ''),
    measurementBasis: spec.measurementBasis === 'garment' ? 'garment' : 'body',
    unit: 'cm',
    values: spec.values && typeof spec.values === 'object' ? spec.values : {},
    precisionStatus: String(spec.precisionStatus || 'no_precise_measurements'),
    source: String(spec.source || 'user_input'),
    reviewStatus: String(spec.reviewStatus || 'not_submitted'),
    createdAt: spec.createdAt || nowIso(),
    updatedAt: spec.updatedAt || spec.createdAt || nowIso()
  }
}

function getEnterpriseRecords(records = []) {
  const enterpriseId = currentEnterpriseId()
  return records.filter((item) => String(item.enterpriseId || '') === enterpriseId)
}

function updateRecord(key = '', matcher, updater) {
  const next = readStore(key).map((item) => {
    if (!matcher(item)) return item
    return updater(item)
  })
  writeStore(key, next)
}

export function listPatternTasks() {
  return getEnterpriseRecords(readStore(PATTERN_TASK_KEY).map(normalizeTask))
    .sort((left, right) => String(right.updatedAt).localeCompare(String(left.updatedAt)))
}

export function listPatternMasters() {
  return getEnterpriseRecords(readStore(PATTERN_MASTER_KEY).map(normalizeMaster))
    .sort((left, right) => String(right.updatedAt).localeCompare(String(left.updatedAt)))
}

export function listPatternVersions(patternMasterId = '') {
  return getEnterpriseRecords(readStore(PATTERN_VERSION_KEY).map(normalizeVersion))
    .filter((version) => !patternMasterId || version.patternMasterId === patternMasterId)
    .sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt)))
}

export function listPatternParts(patternMasterId = '', versionId = '') {
  return getEnterpriseRecords(readStore(PATTERN_PART_KEY).map(normalizePart))
    .filter((part) => (!patternMasterId || part.patternMasterId === patternMasterId) && (!versionId || part.versionId === versionId))
}

export function listPatternSizeSpecs(patternMasterId = '', versionId = '') {
  return getEnterpriseRecords(readStore(PATTERN_SIZE_SPEC_KEY).map(normalizeSizeSpec))
    .filter((spec) => (!patternMasterId || spec.patternMasterId === patternMasterId) && (!versionId || spec.versionId === versionId))
}

export function getPatternTask(taskId = '') {
  return listPatternTasks().find((task) => task.taskId === taskId) || null
}

export function getPatternVersion(versionId = '') {
  return listPatternVersions().find((version) => version.versionId === versionId) || null
}

export function getPatternMaster(patternMasterId = '') {
  return listPatternMasters().find((master) => master.patternMasterId === patternMasterId) || null
}

export function getPatternDashboard() {
  const tasks = listPatternTasks()
  const masters = listPatternMasters()
  const versions = listPatternVersions()
  return {
    tasks,
    masters,
    versions,
    pendingReviewCount: versions.filter((version) => version.reviewStatus === 'pending').length,
    approvedCount: versions.filter((version) => version.reviewStatus === 'approved').length,
    archivedCount: masters.filter((master) => master.archived).length,
    favoriteCount: masters.filter((master) => master.favorite && !master.archived).length,
    draftCount: versions.filter((version) => version.status === 'draft').length,
    trainingCandidateCount: versions.filter((version) => version.trainingCandidate && version.reviewStatus === 'approved').length
  }
}

export function createPatternTaskDraft(input = {}) {
  const enterpriseId = currentEnterpriseId()
  const member = getCurrentMember()
  const now = nowIso()
  const patternMasterId = createId('pattern_master')
  const versionId = createId('pattern_version')
  const taskId = createId('pattern_task')
  const title = `${input.category || '服装'} AI 制版草稿`
  const patternCode = `DB-PAT-${Date.now().toString().slice(-6)}`
  const master = normalizeMaster({
    patternMasterId,
    enterpriseId,
    ownerMemberId: member.memberId || '',
    patternCode,
    category: input.category,
    title,
    source: 'ai_pattern',
    scope: 'enterprise',
    silhouette: input.silhouette || '常规',
    collar: input.collar || '常规领型',
    sleeve: input.sleeve || '常规袖型',
    length: input.length || input.patternDirection || '常规衣长',
    ease: input.patternDirection || '标准松量',
    reviewStatus: 'draft',
    currentVersionId: versionId,
    approvedVersionId: '',
    productionStatus: 'not_available',
    tags: [input.category, input.structureDirection, input.patternDirection].filter(Boolean),
    createdAt: now,
    updatedAt: now
  })
  const version = normalizeVersion({
    versionId,
    patternMasterId,
    enterpriseId,
    versionNo: 'V1',
    status: 'draft',
    reviewStatus: 'not_submitted',
    productionAvailable: false,
    trainingCandidate: false,
    aiDraft: {
      category: input.category || '',
      images: input.images || {},
      structureDirection: input.structureDirection || '',
      patternDirection: input.patternDirection || '',
      referencePatternId: input.referencePatternId || '',
      recognizedParts: ['品类', '廓形', '领型', '袖型', '衣长', '门襟', '结构线']
    },
    humanRevision: null,
    diff: [],
    sizeParams: input.sizeParams || {},
    craftNote: 'AI 生成工艺说明草稿，需要版师修订后才能进入生产判断。',
    createdAt: now,
    updatedAt: now
  })
  const task = normalizeTask({
    taskId,
    enterpriseId,
    projectId: input.projectId || '',
    patternMasterId,
    currentVersionId: versionId,
    category: input.category,
    status: 'draft',
    reviewStatus: 'not_submitted',
    productionStatus: 'not_available',
    title,
    createdBy: member.name || member.memberId || '',
    createdAt: now,
    updatedAt: now
  })

  writeStore(PATTERN_MASTER_KEY, [master, ...readStore(PATTERN_MASTER_KEY).map(normalizeMaster)])
  writeStore(PATTERN_VERSION_KEY, [version, ...readStore(PATTERN_VERSION_KEY).map(normalizeVersion)])
  writeStore(PATTERN_TASK_KEY, [task, ...readStore(PATTERN_TASK_KEY).map(normalizeTask)])
  console.info('[workspace:pattern]', {
    taskId,
    patternMasterId,
    versionId,
    reviewStatus: version.reviewStatus
  })
  return { task, master, version }
}

function buildPatternParts(category = '', context = {}) {
  const names = CATEGORY_PART_TEMPLATES[category] || []
  return names.map((name, index) => normalizePart({
    patternPartId: createId('pattern_part'),
    patternMasterId: context.patternMasterId,
    versionId: context.versionId,
    enterpriseId: context.enterpriseId,
    partCode: `${String(category || 'part').toUpperCase()}-${String(index + 1).padStart(2, '0')}`,
    name,
    quantity: 1,
    cutQuantity: /\u8896\u7247/.test(name) ? 2 : 1,
    source: 'category_template',
    reviewStatus: 'not_submitted',
    createdAt: context.createdAt,
    updatedAt: context.createdAt
  }))
}

export function createPatternStructurePlan(input = {}) {
  const enterpriseId = currentEnterpriseId()
  const member = getCurrentMember() || {}
  const user = getCurrentUser() || {}
  const createdAt = nowIso()
  const patternMasterId = createId('pattern_master')
  const versionId = createId('pattern_version')
  const taskIds = Array.isArray(input.taskIds) ? input.taskIds.map(String).filter(Boolean) : []
  const title = String(input.title || `${input.categoryLabel || input.category || '\u670d\u88c5'}\u6253\u7248\u7ed3\u6784\u65b9\u6848`)
  const patternCode = `DB-REF-${Date.now().toString().slice(-7)}`
  const master = normalizeMaster({
    patternMasterId,
    enterpriseId,
    ownerMemberId: member.memberId || '',
    ownerUserId: user.userId || member.userId || '',
    patternCode,
    category: input.category,
    title,
    source: 'ai_pattern_structure',
    scope: input.scope || 'personal',
    patternLevel: 'A',
    humanReviewRequired: true,
    factoryReady: false,
    industrialStatus: 'not_implemented',
    sizeRange: input.baseSize || '\u672a\u8bbe\u7cbe\u786e\u5c3a\u7801',
    reviewStatus: 'draft',
    currentVersionId: versionId,
    productionStatus: 'not_available',
    linkedProjectIds: input.projectId ? [String(input.projectId)] : [],
    linkedAssetIds: [],
    tags: [input.categoryLabel, '\u7b49\u7ea7A', '\u5f85\u7248\u5e08\u590d\u6838'].filter(Boolean),
    taxonomy: {
      garmentCategory: input.category || '',
      audience: input.audience || '',
      season: input.season || '',
      style: input.style || '',
      fitType: (input.structureRequirements || {}).fit || '',
      neckType: (input.structureRequirements || {}).collar || '',
      sleeveType: (input.structureRequirements || {}).sleeve || '',
      lengthType: (input.structureRequirements || {}).length || '',
      materialCompatibility: Array.isArray(input.materialCompatibility) ? input.materialCompatibility : [],
      usageScene: Array.isArray(input.usageScene) ? input.usageScene : []
    },
    createdAt,
    updatedAt: createdAt
  })
  const measurements = input.measurements && typeof input.measurements === 'object' ? input.measurements : {}
  const hasMeasurements = Object.values(measurements).some((value) => value !== '' && value !== null && value !== undefined)
  const version = normalizeVersion({
    versionId,
    patternMasterId,
    enterpriseId,
    versionNo: 'V1',
    status: 'draft',
    reviewStatus: 'not_submitted',
    productionAvailable: false,
    patternLevel: 'A',
    humanReviewRequired: true,
    industrialStatus: 'not_implemented',
    historyId: input.historyId || '',
    batchId: input.batchId || '',
    taskIds,
    assetIds: [],
    requestedOutputs: Array.isArray(input.requestedOutputs) ? input.requestedOutputs : [],
    generatedOutputs: [],
    aiDraft: {
      inputMode: input.inputMode || 'garment_photo',
      category: input.category || '',
      sourceImages: input.sourceImages && typeof input.sourceImages === 'object' ? input.sourceImages : {},
      patternInput: {
        inputType: input.inputMode || 'garment_photo',
        garmentCategory: input.category || '',
        frontImageAssetId: String(input.frontImageAssetId || ''),
        backImageAssetId: String(input.backImageAssetId || ''),
        sideImageAssetIds: Array.isArray(input.sideImageAssetIds) ? input.sideImageAssetIds.map(String).filter(Boolean) : [],
        detailImageAssetIds: Array.isArray(input.detailImageAssetIds) ? input.detailImageAssetIds.map(String).filter(Boolean) : [],
        sketchAssetId: String(input.sketchAssetId || ''),
        bodyMeasurements: input.measurementBasis === 'body' ? measurements : {},
        garmentMeasurements: input.measurementBasis === 'garment' ? measurements : {},
        baseSize: String(input.baseSize || ''),
        materialProperties: input.materialProperties && typeof input.materialProperties === 'object' ? input.materialProperties : {},
        structureOptions: input.structureRequirements && typeof input.structureRequirements === 'object' ? input.structureRequirements : {},
        constructionRequirements: String(input.notes || '')
      },
      structureRequirements: input.structureRequirements && typeof input.structureRequirements === 'object' ? input.structureRequirements : {},
      notes: String(input.notes || ''),
      outputLevel: 'reference_a',
      disclaimer: '\u4ec5\u4f9b\u7ed3\u6784\u6c9f\u901a\uff0c\u672a\u7ecf\u6253\u7248\u5e08\u590d\u6838\u4e0d\u53ef\u76f4\u63a5\u751f\u4ea7\u3002'
    },
    sizeParams: {
      baseSize: String(input.baseSize || ''),
      measurementBasis: input.measurementBasis === 'garment' ? 'garment' : 'body',
      measurements,
      precisionStatus: hasMeasurements ? 'user_provided_partial' : 'no_precise_measurements'
    },
    craftNote: '\u5de5\u827a\u3001\u7f1d\u4efd\u3001\u5200\u53e3\u3001\u4e1d\u7f15\u7ebf\u548c\u653e\u7801\u89c4\u5219\u5f85\u6253\u7248\u5e08\u8865\u5145\u3002',
    createdAt,
    updatedAt: createdAt
  })
  const task = normalizeTask({
    taskId: taskIds[0] || createId('pattern_task'),
    taskIds,
    historyId: input.historyId || '',
    batchId: input.batchId || '',
    enterpriseId,
    projectId: input.projectId || '',
    patternMasterId,
    currentVersionId: versionId,
    category: input.category,
    status: taskIds.length ? 'generating' : 'draft',
    reviewStatus: 'not_submitted',
    productionStatus: 'not_available',
    title,
    createdBy: member.name || member.memberId || '',
    createdAt,
    updatedAt: createdAt
  })
  const parts = buildPatternParts(input.category, { patternMasterId, versionId, enterpriseId, createdAt })
  const sizeSpec = normalizeSizeSpec({
    sizeSpecId: createId('pattern_size'),
    patternMasterId,
    versionId,
    enterpriseId,
    baseSize: input.baseSize || '',
    measurementBasis: input.measurementBasis,
    values: measurements,
    precisionStatus: hasMeasurements ? 'user_provided_partial' : 'no_precise_measurements',
    source: 'user_input',
    reviewStatus: 'not_submitted',
    createdAt,
    updatedAt: createdAt
  })
  writeStore(PATTERN_MASTER_KEY, [master, ...readStore(PATTERN_MASTER_KEY).map(normalizeMaster)])
  writeStore(PATTERN_VERSION_KEY, [version, ...readStore(PATTERN_VERSION_KEY).map(normalizeVersion)])
  writeStore(PATTERN_TASK_KEY, [task, ...readStore(PATTERN_TASK_KEY).map(normalizeTask)])
  writeStore(PATTERN_PART_KEY, [...parts, ...readStore(PATTERN_PART_KEY).map(normalizePart)])
  writeStore(PATTERN_SIZE_SPEC_KEY, [sizeSpec, ...readStore(PATTERN_SIZE_SPEC_KEY).map(normalizeSizeSpec)])
  console.info('[workspace:pattern-structure]', {
    action: 'create_reference_plan',
    partCount: parts.length,
    taskCount: taskIds.length,
    hasMeasurements,
    reviewRequired: true,
    productionReady: false
  })
  return { ok: true, master, version, task, parts, sizeSpec }
}

export function linkPatternStructureGeneration(patternMasterId = '', patch = {}) {
  const master = getPatternMaster(patternMasterId)
  if (!master) return { ok: false, errorCode: 'pattern_not_found' }
  const taskIds = Array.isArray(patch.taskIds) ? patch.taskIds.map(String).filter(Boolean) : []
  const updatedAt = nowIso()
  updateRecord(PATTERN_VERSION_KEY, (item) => item.patternMasterId === patternMasterId && item.versionId === master.currentVersionId, (item) => ({
    ...normalizeVersion(item),
    historyId: String(patch.historyId || normalizeVersion(item).historyId),
    batchId: String(patch.batchId || normalizeVersion(item).batchId),
    taskIds: taskIds.length ? taskIds : normalizeVersion(item).taskIds,
    status: patch.status || (taskIds.length ? 'generating' : normalizeVersion(item).status),
    updatedAt
  }))
  updateRecord(PATTERN_TASK_KEY, (item) => item.patternMasterId === patternMasterId, (item) => ({
    ...normalizeTask(item),
    taskId: taskIds[0] || normalizeTask(item).taskId,
    taskIds: taskIds.length ? taskIds : normalizeTask(item).taskIds,
    historyId: String(patch.historyId || normalizeTask(item).historyId),
    batchId: String(patch.batchId || normalizeTask(item).batchId),
    status: patch.status || (taskIds.length ? 'generating' : normalizeTask(item).status),
    updatedAt
  }))
  return { ok: true }
}

export function linkPatternStructureAssets(patternMasterId = '', assetIds = []) {
  const master = getPatternMaster(patternMasterId)
  if (!master) return { ok: false, errorCode: 'pattern_not_found' }
  const normalizedIds = [...new Set((Array.isArray(assetIds) ? assetIds : []).map(String).filter(Boolean))]
  const updatedAt = nowIso()
  updateRecord(PATTERN_MASTER_KEY, (item) => item.patternMasterId === patternMasterId, (item) => ({
    ...normalizeMaster(item),
    linkedAssetIds: [...new Set([...normalizeMaster(item).linkedAssetIds, ...normalizedIds])],
    reviewStatus: normalizedIds.length && ['draft', 'not_submitted'].includes(normalizeMaster(item).reviewStatus) ? 'ai_generated' : normalizeMaster(item).reviewStatus,
    updatedAt
  }))
  updateRecord(PATTERN_VERSION_KEY, (item) => item.patternMasterId === patternMasterId && item.versionId === master.currentVersionId, (item) => ({
    ...normalizeVersion(item),
    assetIds: [...new Set([...normalizeVersion(item).assetIds, ...normalizedIds])],
    reviewStatus: normalizedIds.length && ['draft', 'not_submitted'].includes(normalizeVersion(item).reviewStatus) ? 'ai_generated' : normalizeVersion(item).reviewStatus,
    updatedAt
  }))
  return { ok: true, assetCount: normalizedIds.length }
}

export function getPatternStructurePackage(patternMasterId = '') {
  const master = getPatternMaster(patternMasterId)
  if (!master) return null
  const version = getPatternVersion(master.currentVersionId)
  return {
    master,
    version,
    parts: listPatternParts(patternMasterId, master.currentVersionId),
    sizeSpecs: listPatternSizeSpecs(patternMasterId, master.currentVersionId),
    reviewRequired: true,
    productionReady: false,
    industrialStatus: 'not_implemented'
  }
}

export function listPatternLibraryRecords(options = {}) {
  const {
    tab = 'enterprise',
    keyword = '',
    filters = {}
  } = options
  const member = getCurrentMember()
  const normalizedKeyword = String(keyword || '').trim().toLowerCase()
  return listPatternMasters()
    .filter((master) => {
      if (tab === 'system' && master.scope !== 'system') return false
      if (tab === 'personal' && !(master.scope === 'personal' && (!master.ownerMemberId || master.ownerMemberId === member.memberId))) return false
      if (tab === 'enterprise' && master.scope !== 'enterprise') return false
      if (tab === 'favorite' && !master.favorite) return false
      if (tab === 'review' && !['pending', 'under_review', 'changes_requested'].includes(master.reviewStatus)) return false
      if (tab === 'archived' && !master.archived) return false
      if (tab !== 'archived' && master.archived) return false
      const text = [
        master.title,
        master.patternCode,
        master.category,
        master.genderAge,
        master.silhouette,
        master.collar,
        master.sleeve,
        master.length,
        master.ease,
        master.fabric,
        master.season,
        master.sizeRange,
        master.reviewStatus,
        master.source,
        ...(master.tags || [])
      ].join(' ').toLowerCase()
      if (normalizedKeyword && !text.includes(normalizedKeyword)) return false
      return Object.keys(filters || {}).every((key) => {
        const value = filters[key]
        return !value || value === 'all' || String(master[key] || '') === String(value)
      })
    })
}

export function togglePatternFavorite(patternMasterId = '') {
  const master = getPatternMaster(patternMasterId)
  if (!master) return { ok: false, errorCode: 'pattern_not_found' }
  const now = nowIso()
  updateRecord(PATTERN_MASTER_KEY, (item) => item.patternMasterId === patternMasterId, (item) => ({
    ...normalizeMaster(item),
    favorite: !normalizeMaster(item).favorite,
    updatedAt: now
  }))
  console.info('[workspace:pattern-library]', { action: 'favorite', patternMasterId, success: true })
  return { ok: true }
}

export function copyPatternToPersonal(patternMasterId = '') {
  const master = getPatternMaster(patternMasterId)
  if (!master) return { ok: false, errorCode: 'pattern_not_found' }
  const member = getCurrentMember()
  const now = nowIso()
  const copiedMasterId = createId('pattern_master')
  const sourceVersions = listPatternVersions(patternMasterId)
  const copiedVersionId = createId('pattern_version')
  const copiedMaster = normalizeMaster({
    ...master,
    patternMasterId: copiedMasterId,
    patternCode: `${master.patternCode || 'PAT'}-COPY`,
    title: `${master.title} 个人副本`,
    scope: 'personal',
    ownerMemberId: member.memberId || '',
    source: 'copied',
    parentPatternMasterId: patternMasterId,
    currentVersionId: copiedVersionId,
    approvedVersionId: '',
    reviewStatus: 'draft',
    productionStatus: 'not_available',
    favorite: false,
    archived: false,
    createdAt: now,
    updatedAt: now
  })
  const sourceVersion = sourceVersions[0] || {}
  const copiedVersion = normalizeVersion({
    ...sourceVersion,
    versionId: copiedVersionId,
    patternMasterId: copiedMasterId,
    versionNo: 'V1',
    status: 'draft',
    reviewStatus: 'not_submitted',
    productionAvailable: false,
    trainingCandidate: false,
    createdAt: now,
    updatedAt: now
  })
  writeStore(PATTERN_MASTER_KEY, [copiedMaster, ...readStore(PATTERN_MASTER_KEY).map(normalizeMaster)])
  writeStore(PATTERN_VERSION_KEY, [copiedVersion, ...readStore(PATTERN_VERSION_KEY).map(normalizeVersion)])
  updateRecord(PATTERN_MASTER_KEY, (item) => item.patternMasterId === patternMasterId, (item) => ({
    ...normalizeMaster(item),
    derivedPatternIds: [...new Set([...normalizeMaster(item).derivedPatternIds, copiedMasterId])],
    updatedAt: now
  }))
  console.info('[workspace:pattern-library]', { action: 'copy_personal', patternMasterId, success: true })
  return { ok: true, master: copiedMaster, version: copiedVersion }
}

export function createDerivedPattern(patternMasterId = '', input = {}) {
  const master = getPatternMaster(patternMasterId)
  if (!master) return { ok: false, errorCode: 'pattern_not_found' }
  const now = nowIso()
  const derivedMasterId = createId('pattern_master')
  const derivedVersionId = createId('pattern_version')
  const member = getCurrentMember() || {}
  const user = getCurrentUser() || {}
  const derivedMaster = normalizeMaster({
    ...master,
    patternMasterId: derivedMasterId,
    patternCode: `${master.patternCode || 'PAT'}-D${String(Date.now()).slice(-3)}`,
    title: input.title || `${master.title} 派生版`,
    source: 'derived',
    scope: input.scope || 'personal',
    ownerMemberId: member.memberId || '',
    ownerUserId: user.userId || member.userId || '',
    parentPatternMasterId: patternMasterId,
    currentVersionId: derivedVersionId,
    approvedVersionId: '',
    reviewStatus: 'draft',
    productionStatus: 'not_available',
    favorite: false,
    archived: false,
    collar: input.collar || master.collar,
    sleeve: input.sleeve || master.sleeve,
    length: input.length || master.length,
    ease: input.ease || master.ease,
    tags: [...new Set([...(master.tags || []), '派生版', input.ease, input.length].filter(Boolean))],
    createdAt: now,
    updatedAt: now
  })
  const baseVersion = listPatternVersions(patternMasterId)[0] || {}
  const derivedVersion = normalizeVersion({
    ...baseVersion,
    versionId: derivedVersionId,
    patternMasterId: derivedMasterId,
    versionNo: 'V1',
    status: 'draft',
    reviewStatus: 'not_submitted',
    productionAvailable: false,
    trainingCandidate: false,
    humanRevision: {
      note: '由版型库创建派生版本，需版师审核。',
      updatedBy: (getCurrentMember() || {}).name || ''
    },
    diff: ['创建派生版本', input.ease || '', input.length || ''].filter(Boolean),
    createdAt: now,
    updatedAt: now
  })
  const derivedParts = listPatternParts(patternMasterId, baseVersion.versionId).map((part) => normalizePart({
    ...part,
    patternPartId: createId('pattern_part'),
    patternMasterId: derivedMasterId,
    versionId: derivedVersionId,
    reviewStatus: 'not_submitted',
    createdAt: now,
    updatedAt: now
  }))
  const derivedSizeSpecs = listPatternSizeSpecs(patternMasterId, baseVersion.versionId).map((spec) => normalizeSizeSpec({
    ...spec,
    sizeSpecId: createId('pattern_size'),
    patternMasterId: derivedMasterId,
    versionId: derivedVersionId,
    reviewStatus: 'not_submitted',
    createdAt: now,
    updatedAt: now
  }))
  writeStore(PATTERN_MASTER_KEY, [derivedMaster, ...readStore(PATTERN_MASTER_KEY).map(normalizeMaster)])
  writeStore(PATTERN_VERSION_KEY, [derivedVersion, ...readStore(PATTERN_VERSION_KEY).map(normalizeVersion)])
  writeStore(PATTERN_PART_KEY, [...derivedParts, ...readStore(PATTERN_PART_KEY).map(normalizePart)])
  writeStore(PATTERN_SIZE_SPEC_KEY, [...derivedSizeSpecs, ...readStore(PATTERN_SIZE_SPEC_KEY).map(normalizeSizeSpec)])
  updateRecord(PATTERN_MASTER_KEY, (item) => item.patternMasterId === patternMasterId, (item) => ({
    ...normalizeMaster(item),
    derivedPatternIds: [...new Set([...normalizeMaster(item).derivedPatternIds, derivedMasterId])],
    updatedAt: now
  }))
  console.info('[workspace:pattern-library]', { action: 'derive', patternMasterId, success: true })
  return { ok: true, master: derivedMaster, version: derivedVersion }
}

export function archivePatternMaster(patternMasterId = '') {
  const master = getPatternMaster(patternMasterId)
  if (!master) return { ok: false, errorCode: 'pattern_not_found' }
  const now = nowIso()
  updateRecord(PATTERN_MASTER_KEY, (item) => item.patternMasterId === patternMasterId, (item) => ({
    ...normalizeMaster(item),
    archived: true,
    reviewStatus: 'archived',
    updatedAt: now
  }))
  console.info('[workspace:pattern-library]', { action: 'archive', patternMasterId, success: true })
  return { ok: true }
}

export function createPatternRevisionVersion(patternMasterId = '', input = {}) {
  const master = listPatternMasters().find((item) => item.patternMasterId === patternMasterId)
  if (!master) {
    return { ok: false, errorCode: 'pattern_not_found' }
  }
  const versions = listPatternVersions(patternMasterId)
  const now = nowIso()
  const nextNo = `V${versions.length + 1}`
  const baseVersion = versions[0] || {}
  const versionId = createId('pattern_version')
  const version = normalizeVersion({
    ...baseVersion,
    versionId,
    patternMasterId,
    enterpriseId: master.enterpriseId,
    versionNo: nextNo,
    status: 'draft',
    reviewStatus: 'not_submitted',
    productionAvailable: false,
    trainingCandidate: false,
    humanRevision: input.humanRevision || {
      note: '版师修订稿待补充',
      updatedBy: (getCurrentMember() || {}).name || ''
    },
    diff: input.diff || ['新增版本记录，未覆盖已审核版本'],
    createdAt: now,
    updatedAt: now
  })
  const copiedParts = listPatternParts(patternMasterId, baseVersion.versionId).map((part) => normalizePart({
    ...part,
    patternPartId: createId('pattern_part'),
    versionId,
    reviewStatus: 'not_submitted',
    createdAt: now,
    updatedAt: now
  }))
  const copiedSizeSpecs = listPatternSizeSpecs(patternMasterId, baseVersion.versionId).map((spec) => normalizeSizeSpec({
    ...spec,
    sizeSpecId: createId('pattern_size'),
    versionId,
    reviewStatus: 'not_submitted',
    createdAt: now,
    updatedAt: now
  }))
  writeStore(PATTERN_VERSION_KEY, [version, ...readStore(PATTERN_VERSION_KEY).map(normalizeVersion)])
  writeStore(PATTERN_PART_KEY, [...copiedParts, ...readStore(PATTERN_PART_KEY).map(normalizePart)])
  writeStore(PATTERN_SIZE_SPEC_KEY, [...copiedSizeSpecs, ...readStore(PATTERN_SIZE_SPEC_KEY).map(normalizeSizeSpec)])
  updateRecord(PATTERN_MASTER_KEY, (item) => item.patternMasterId === patternMasterId, (item) => ({
    ...normalizeMaster(item),
    currentVersionId: versionId,
    updatedAt: now
  }))
  updateRecord(PATTERN_TASK_KEY, (item) => item.patternMasterId === patternMasterId, (item) => ({
    ...normalizeTask(item),
    currentVersionId: versionId,
    status: 'draft',
    reviewStatus: 'not_submitted',
    productionStatus: 'not_available',
    updatedAt: now
  }))
  console.info('[workspace:pattern]', { patternMasterId, versionId, reviewStatus: version.reviewStatus })
  return { ok: true, version }
}

export function submitPatternVersionReview(versionId = '') {
  const version = getPatternVersion(versionId)
  if (!version) return { ok: false, errorCode: 'version_not_found' }
  const now = nowIso()
  updateRecord(PATTERN_VERSION_KEY, (item) => item.versionId === versionId, (item) => ({
    ...normalizeVersion(item),
    status: 'review',
    reviewStatus: 'pending',
    productionAvailable: false,
    trainingCandidate: false,
    updatedAt: now
  }))
  updateRecord(PATTERN_TASK_KEY, (item) => item.currentVersionId === versionId, (item) => ({
    ...normalizeTask(item),
    status: 'review',
    reviewStatus: 'pending',
    productionStatus: 'not_available',
    updatedAt: now
  }))
  updateRecord(PATTERN_MASTER_KEY, (item) => item.patternMasterId === version.patternMasterId, (item) => ({
    ...normalizeMaster(item),
    reviewStatus: 'pending',
    productionStatus: 'not_available',
    updatedAt: now
  }))
  console.info('[workspace:pattern]', { versionId, reviewStatus: 'pending' })
  return { ok: true }
}

export function reviewPatternVersion(versionId = '', decision = 'approved', comments = '') {
  const version = getPatternVersion(versionId)
  if (!version) return { ok: false, errorCode: 'version_not_found' }
  const master = getPatternMaster(version.patternMasterId)
  const approved = decision === 'approved'
  const referenceOnly = master && master.source === 'ai_pattern_structure'
  const now = nowIso()
  updateRecord(PATTERN_VERSION_KEY, (item) => item.versionId === versionId, (item) => ({
    ...normalizeVersion(item),
    status: approved ? 'approved' : 'draft',
    reviewStatus: approved ? 'approved' : 'rejected',
    productionAvailable: approved && !referenceOnly,
    trainingCandidate: approved,
    diff: [...normalizeVersion(item).diff, comments || (approved ? '审核通过' : '退回修改')],
    updatedAt: now
  }))
  updateRecord(PATTERN_MASTER_KEY, (item) => item.patternMasterId === version.patternMasterId, (item) => ({
    ...normalizeMaster(item),
    approvedVersionId: approved ? versionId : normalizeMaster(item).approvedVersionId,
    reviewStatus: approved ? 'approved' : 'rejected',
    productionStatus: approved ? 'reviewed_reference' : 'not_available',
    factoryReady: referenceOnly ? false : normalizeMaster(item).factoryReady,
    updatedAt: now
  }))
  updateRecord(PATTERN_TASK_KEY, (item) => item.currentVersionId === versionId, (item) => ({
    ...normalizeTask(item),
    status: approved ? 'completed' : 'draft',
    reviewStatus: approved ? 'approved' : 'rejected',
    productionStatus: approved ? 'reviewed_reference' : 'not_available',
    updatedAt: now
  }))
  console.info('[workspace:pattern]', { versionId, reviewStatus: approved ? 'approved' : 'rejected' })
  return { ok: true }
}
