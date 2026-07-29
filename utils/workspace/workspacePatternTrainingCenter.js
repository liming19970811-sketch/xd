import { get, set } from '../data-provider/dataProvider.js'
import { getCurrentMember } from '../auth/authRepository.js'
import { hasPermission } from '../auth/permissionService.js'
import { getCurrentEnterpriseId } from '../tenant/tenantContext.js'
import { recordAudit } from '../audit/auditService.js'

const DATASET_KEY = 'diebians_workspace_pattern_training_datasets_v1'
const MODEL_KEY = 'diebians_workspace_pattern_training_models_v1'

export const TRAINING_TABS = Object.freeze([
  { key: 'overview', label: '训练概览' },
  { key: 'datasets', label: '数据集' },
  { key: 'evaluations', label: '模型评估' },
  { key: 'models', label: '模型版本' }
])

export const DATASET_STATUSES = Object.freeze(['draft', 'validating', 'ready', 'frozen', 'archived'])
export const DATASET_SPLITS = Object.freeze(['train', 'validation', 'test'])
export const MODEL_STATUSES = Object.freeze(['registered_not_trained', 'evaluation_pending', 'evaluation_recorded', 'candidate', 'deprecated'])

function nowIso() {
  return new Date().toISOString()
}

function createId(prefix = 'id') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

function currentEnterpriseId() {
  return String(getCurrentEnterpriseId() || 'local_enterprise')
}

function currentMember() {
  return getCurrentMember() || {}
}

function readList(key = '') {
  const value = get(key, [])
  return Array.isArray(value) ? value : []
}

function writeList(key = '', list = []) {
  set(key, Array.isArray(list) ? list : [])
}

function canAccessTraining() {
  const member = currentMember()
  const role = String(member.role || '').toLowerCase()
  if (!member || member.status !== 'active') return false
  if (hasPermission('pattern_making.approve', { member }) || hasPermission('analytics.view', { member }) || hasPermission('settings.manage', { member })) return true
  return ['admin', '管理员', 'pattern_maker', '版师', 'algorithm', '算法'].some((item) => role.includes(item))
}

function audit(action = '', targetId = '', after = {}) {
  const member = currentMember()
  recordAudit({
    enterpriseId: currentEnterpriseId(),
    userId: member.userId || '',
    operatorId: member.memberId || member.userId || '',
    operator: member.name || member.role || '当前成员',
    action,
    targetType: 'pattern_training',
    targetId,
    resourceType: 'pattern_training',
    resourceId: targetId,
    after,
    createdAt: nowIso()
  })
}

function normalizeDataset(record = {}) {
  return {
    datasetId: String(record.datasetId || ''),
    enterpriseId: String(record.enterpriseId || currentEnterpriseId()),
    name: String(record.name || 'AI 制版训练数据集'),
    split: DATASET_SPLITS.includes(record.split) ? record.split : 'train',
    status: DATASET_STATUSES.includes(record.status) ? record.status : 'draft',
    version: String(record.version || 'V1'),
    sampleIds: Array.isArray(record.sampleIds) ? record.sampleIds : [],
    source: String(record.source || 'pattern_training_candidates'),
    authorizedOnly: record.authorizedOnly !== false,
    createdBy: String(record.createdBy || currentMember().name || currentMember().memberId || ''),
    createdAt: record.createdAt || nowIso(),
    updatedAt: record.updatedAt || record.createdAt || nowIso()
  }
}

function normalizeModel(record = {}) {
  return {
    modelId: String(record.modelId || ''),
    enterpriseId: String(record.enterpriseId || currentEnterpriseId()),
    name: String(record.name || 'AI 制版候选模型'),
    version: String(record.version || 'candidate-1'),
    status: MODEL_STATUSES.includes(record.status) ? record.status : 'registered_not_trained',
    datasetId: String(record.datasetId || ''),
    metrics: record.metrics && typeof record.metrics === 'object' ? record.metrics : {},
    riskConfirmed: Boolean(record.riskConfirmed),
    patternMakerChecked: Boolean(record.patternMakerChecked),
    adminApproved: Boolean(record.adminApproved),
    grayReleased: Boolean(record.grayReleased),
    createdAt: record.createdAt || nowIso(),
    updatedAt: record.updatedAt || record.createdAt || nowIso()
  }
}

function getEnterpriseDatasets() {
  const enterpriseId = currentEnterpriseId()
  return readList(DATASET_KEY).map(normalizeDataset).filter((item) => item.enterpriseId === enterpriseId)
}

function saveEnterpriseDatasets(next = []) {
  const enterpriseId = currentEnterpriseId()
  const other = readList(DATASET_KEY).map(normalizeDataset).filter((item) => item.enterpriseId !== enterpriseId)
  writeList(DATASET_KEY, [...next.map(normalizeDataset), ...other])
}

function getEnterpriseModels() {
  const enterpriseId = currentEnterpriseId()
  return readList(MODEL_KEY).map(normalizeModel).filter((item) => item.enterpriseId === enterpriseId)
}

function saveEnterpriseModels(next = []) {
  const enterpriseId = currentEnterpriseId()
  const other = readList(MODEL_KEY).map(normalizeModel).filter((item) => item.enterpriseId !== enterpriseId)
  writeList(MODEL_KEY, [...next.map(normalizeModel), ...other])
}

function getRevisionDiff(version = {}) {
  const baseDiff = Array.isArray(version.diff) ? version.diff : []
  const fields = [
    '领型调整',
    '袖型调整',
    '衣长调整',
    '松量调整',
    '结构线调整',
    '版片增删',
    '尺寸修改',
    '工艺修订'
  ]
  return fields.map((field, index) => ({
    type: field,
    changed: Boolean(baseDiff[index] || (index === 6 && version.sizeParams && Object.keys(version.sizeParams).length)),
    reason: baseDiff[index] || (version.humanRevision && version.humanRevision.note) || '待版师补充修改原因'
  }))
}

function getSampleQuality(master = {}, version = {}, privacy = {}) {
  const issues = []
  const authorized = Boolean(privacy.aiTrainingAuthorized || version.trainingAuthorized || master.trainingAuthorized)
  if (!authorized) issues.push('未获得 AI 训练授权')
  if (version.reviewStatus !== 'approved' || !version.trainingCandidate) issues.push('未审核通过或未进入训练候选')
  if (!version.aiDraft || !Object.keys(version.aiDraft).length) issues.push('缺少 AI 制版初稿')
  if (!version.humanRevision) issues.push('缺少版师修订稿')
  if (!Array.isArray(version.diff) || !version.diff.length) issues.push('缺少结构化修改差异')
  if (!master.category || !master.silhouette || !master.collar || !master.sleeve) issues.push('品类与结构标签不完整')
  if (master.scope === 'enterprise' && !authorized) issues.push('企业数据未授权训练')
  return {
    authorized,
    clearImage: Boolean(version.aiDraft && Object.keys(version.aiDraft.images || {}).length),
    tagComplete: Boolean(master.category && master.silhouette && master.collar && master.sleeve),
    sizeNormal: Boolean(version.sizeParams && Object.keys(version.sizeParams).length),
    patternClosed: Boolean(version.productionAvailable),
    relationComplete: Boolean(master.patternMasterId && version.versionId),
    duplicated: false,
    leakageRisk: Boolean(master.parentPatternMasterId),
    issues,
    status: issues.length ? 'needs_fix' : 'ready'
  }
}

function buildSamples(patternDashboard = {}, privacy = {}) {
  const masters = Array.isArray(patternDashboard.masters) ? patternDashboard.masters : []
  const versions = Array.isArray(patternDashboard.versions) ? patternDashboard.versions : []
  return versions.map((version) => {
    const master = masters.find((item) => item.patternMasterId === version.patternMasterId) || {}
    const quality = getSampleQuality(master, version, privacy)
    return {
      sampleId: `sample_${version.versionId}`,
      enterpriseId: currentEnterpriseId(),
      patternMasterId: version.patternMasterId,
      versionId: version.versionId,
      title: master.title || '未命名版型样本',
      category: master.category || '未分类',
      sourceImageCount: Object.keys((version.aiDraft && version.aiDraft.images) || {}).length,
      aiRecognition: version.aiDraft || {},
      aiDraft: version.aiDraft || {},
      humanRevision: version.humanRevision || null,
      approvedVersion: version.reviewStatus === 'approved',
      revisionDiff: getRevisionDiff(version),
      tags: [master.category, master.silhouette, master.collar, master.sleeve, master.length, master.ease].filter(Boolean),
      authorizationStatus: quality.authorized ? 'authorized' : 'not_authorized',
      quality,
      eligible: quality.status === 'ready',
      createdAt: version.createdAt,
      updatedAt: version.updatedAt || master.updatedAt
    }
  }).sort((left, right) => String(right.updatedAt || '').localeCompare(String(left.updatedAt || '')))
}

function buildQualityQueue(samples = []) {
  return samples
    .filter((sample) => !sample.eligible)
    .map((sample) => ({
      sampleId: sample.sampleId,
      title: sample.title,
      issues: sample.quality.issues,
      level: sample.quality.issues.some((item) => item.includes('授权') || item.includes('泄漏')) ? 'high' : 'medium'
    }))
}

function createEvaluations(models = [], datasets = [], samples = []) {
  // Evaluations must come from a real external run; never synthesize quality metrics.
  return models.filter((model) => model.metrics && Object.keys(model.metrics).length).map((model) => ({
    evaluationId: `eval_${model.modelId}`,
    modelId: model.modelId,
    modelName: `${model.name} ${model.version}`,
    datasetId: model.datasetId,
    sampleCount: Number(model.metrics.sampleCount) || 0,
    metrics: model.metrics,
    failedCases: [],
    comparedWith: '',
    createdAt: model.updatedAt || model.createdAt
  }))
}

function ensureDefaults(samples = []) {
  // No default dataset, score, or active model may be fabricated.
  return Array.isArray(samples) ? samples.length : 0
}

export function loadPatternTrainingCenter(patternDashboard = {}, privacy = {}) {
  const access = canAccessTraining()
  if (!access) {
    return {
      canAccess: false,
      samples: [],
      eligibleSamples: [],
      qualityQueue: [],
      datasets: [],
      evaluations: [],
      models: [],
      privacyAuthorized: Boolean(privacy.aiTrainingAuthorized),
      stats: { sampleCount: 0, eligibleCount: 0, blockedCount: 0, datasetCount: 0, modelCount: 0 }
    }
  }
  const samples = buildSamples(patternDashboard, privacy)
  ensureDefaults(samples)
  const datasets = getEnterpriseDatasets()
  const models = getEnterpriseModels()
  return {
    canAccess: access,
    samples,
    eligibleSamples: samples.filter((item) => item.eligible),
    qualityQueue: buildQualityQueue(samples),
    datasets,
    evaluations: createEvaluations(models, datasets, samples),
    models,
    privacyAuthorized: Boolean(privacy.aiTrainingAuthorized),
    stats: {
      sampleCount: samples.length,
      eligibleCount: samples.filter((item) => item.eligible).length,
      blockedCount: samples.filter((item) => !item.eligible).length,
      datasetCount: datasets.length,
      modelCount: models.length
    }
  }
}

export function createTrainingDataset(input = {}, patternDashboard = {}, privacy = {}) {
  if (!canAccessTraining()) return { success: false, errorCode: 'forbidden' }
  const samples = buildSamples(patternDashboard, privacy)
  const eligibleIds = samples.filter((item) => item.eligible).map((item) => item.sampleId)
  const split = DATASET_SPLITS.includes(input.split) ? input.split : 'train'
  const dataset = normalizeDataset({
    datasetId: createId('dataset'),
    name: input.name || (split === 'test' ? '固定测试集' : 'AI 制版训练数据集'),
    split,
    status: split === 'test' ? 'frozen' : 'draft',
    sampleIds: eligibleIds,
    version: input.version || 'V1',
    createdAt: nowIso(),
    updatedAt: nowIso()
  })
  saveEnterpriseDatasets([dataset, ...getEnterpriseDatasets()])
  audit('创建制版训练数据集', dataset.datasetId, { split: dataset.split, sampleCount: dataset.sampleIds.length })
  return { success: true, dataset }
}

export function updateTrainingDatasetStatus(datasetId = '', status = 'validating') {
  if (!canAccessTraining()) return { success: false, errorCode: 'forbidden' }
  if (!DATASET_STATUSES.includes(status)) return { success: false, errorCode: 'invalid_status' }
  const list = getEnterpriseDatasets()
  const target = list.find((item) => item.datasetId === datasetId)
  if (!target) return { success: false, errorCode: 'dataset_not_found' }
  const next = { ...target, status, updatedAt: nowIso() }
  saveEnterpriseDatasets(list.map((item) => item.datasetId === datasetId ? next : item))
  audit('更新数据集状态', datasetId, { status })
  return { success: true, dataset: next }
}

export function createCandidateModel(datasetId = '') {
  if (!canAccessTraining()) return { success: false, errorCode: 'forbidden' }
  const dataset = getEnterpriseDatasets().find((item) => item.datasetId === datasetId) || getEnterpriseDatasets()[0]
  if (!dataset) return { success: false, errorCode: 'dataset_required' }
  const model = normalizeModel({
    modelId: createId('pattern_model'),
    name: 'AI 制版候选模型',
    version: `candidate-${Date.now().toString().slice(-4)}`,
    status: 'registered_not_trained',
    datasetId: dataset.datasetId,
    createdAt: nowIso(),
    updatedAt: nowIso()
  })
  saveEnterpriseModels([model, ...getEnterpriseModels()])
  audit('创建候选模型', model.modelId, { datasetId: dataset.datasetId })
  return { success: true, model }
}

export function approveCandidateModel(modelId = '') {
  return { success: false, errorCode: 'training_execution_not_implemented', modelId }
}

export function activateModel(modelId = '') {
  return { success: false, errorCode: 'model_activation_not_implemented', modelId }
}

export function rollbackActiveModel(modelId = '') {
  return { success: false, errorCode: 'model_activation_not_implemented', modelId }
}
