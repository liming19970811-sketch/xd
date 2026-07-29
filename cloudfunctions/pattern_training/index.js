const cloud = require('wx-server-sdk')
const crypto = require('crypto')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

const C = Object.freeze({
  sessions: 'enterprise_auth_sessions', members: 'enterprise_members', rolePermissions: 'enterprise_role_permissions',
  masters: 'enterprise_pattern_masters', versions: 'enterprise_pattern_versions', parts: 'enterprise_pattern_parts', sizes: 'enterprise_pattern_size_specs',
  consents: 'enterprise_pattern_training_consents', samples: 'enterprise_pattern_training_samples', diffs: 'enterprise_pattern_revision_diffs',
  datasets: 'enterprise_pattern_datasets', datasetItems: 'enterprise_pattern_dataset_items', models: 'enterprise_pattern_model_versions',
  evaluations: 'enterprise_pattern_evaluations', evaluationResults: 'enterprise_pattern_evaluation_results',
  evaluationReviews: 'enterprise_pattern_evaluation_reviews', events: 'enterprise_pattern_training_events'
})

const EVALUATION_CATEGORIES = Object.freeze(['tshirt', 'shirt', 'dress', 'skirt', 'pants', 'coat'])
const EVALUATION_METRIC_VERSION = 'pattern-evaluation-metrics-v1'
const BLIND_REVIEW_FIELDS = Object.freeze(['structureAccuracy', 'sizeAccuracy', 'partAccuracy', 'constructionAccuracy'])

function now() { return new Date().toISOString() }
function id(prefix) { return `${prefix}_${Date.now()}_${crypto.randomBytes(6).toString('hex')}` }
function hash(value) { return crypto.createHash('sha256').update(String(value || '')).digest('hex') }
function text(value, max = 300) { return String(value || '').trim().slice(0, max) }
function ok(data = {}, status = 'success') { return { ok: true, success: true, status, errorCode: '', message: '', data } }
function fail(status, errorCode, message) { return { ok: false, success: false, status, errorCode, message, data: null } }
function err(errorCode, message) { return Object.assign(new Error(message), { errorCode }) }
function safe(doc) { if (!doc) return null; const { _id, openId, openid, _openid, sessionTokenHash, ...rest } = doc; return { ...rest, id: _id } }
function list(value, max = 100) { return Array.isArray(value) ? value.slice(0, max) : [] }
function object(value) { return value && typeof value === 'object' && !Array.isArray(value) ? value : {} }
function average(values) { const numbers = values.map(Number).filter(Number.isFinite); return numbers.length ? numbers.reduce((sum, value) => sum + value, 0) / numbers.length : 0 }

async function one(collection, where) {
  const result = await db.collection(collection).where(where).limit(1).get()
  return result.data && result.data.length ? safe(result.data[0]) : null
}

async function many(collection, where, limit = 100) {
  const result = await db.collection(collection).where(where).limit(limit).get()
  return (result.data || []).map(safe)
}

async function requireContext(sessionToken) {
  const token = text(sessionToken, 1000)
  if (!token) throw err('AUTH_REQUIRED', '请先登录企业账号。')
  const session = await one(C.sessions, { sessionTokenHash: hash(token) })
  if (!session || session.status !== 'active') throw err('SESSION_INVALID', '登录状态无效。')
  if (session.expiresAt && new Date(session.expiresAt).getTime() <= Date.now()) throw err('SESSION_EXPIRED', '登录已过期。')
  const member = await one(C.members, { enterpriseId: session.enterpriseId, memberId: session.memberId })
  if (!member) throw err('MEMBER_NOT_FOUND', '企业成员不存在。')
  if (member.status !== 'active') throw err('MEMBER_INACTIVE', '当前成员不可用。')
  if (member.userId !== session.userId) throw err('TENANT_MISMATCH', '企业身份不匹配。')
  return { enterpriseId: session.enterpriseId, userId: session.userId, memberId: member.memberId, role: text(member.role, 60) }
}

async function permissionList(ctx) {
  if (ctx.role === 'admin') return ['pattern_making.view', 'pattern_making.edit', 'pattern_making.approve', 'analytics.view', 'settings.manage']
  const record = await one(C.rolePermissions, { enterpriseId: ctx.enterpriseId, roleCode: ctx.role })
    || await one(C.rolePermissions, { enterpriseId: ctx.enterpriseId, role: ctx.role })
  if (record && Array.isArray(record.permissions)) return record.permissions.map(String)
  if (ctx.role === 'pattern_maker') return ['pattern_making.view', 'pattern_making.edit', 'pattern_making.approve']
  if (ctx.role === 'reviewer') return ['pattern_making.view', 'pattern_making.approve']
  return []
}

async function requireTrainingAccess(ctx, permission = 'pattern_making.view') {
  const permissions = await permissionList(ctx)
  if (!permissions.includes(permission) && !permissions.includes('analytics.view') && !permissions.includes('settings.manage')) {
    throw err('FORBIDDEN', '当前角色无权管理AI制版训练数据。')
  }
  return permissions
}

async function requireExactPermission(ctx, accepted = []) {
  const permissions = await permissionList(ctx)
  if (!list(accepted, 20).some((permission) => permissions.includes(permission))) throw err('FORBIDDEN', '当前角色无权执行该评测操作。')
  return permissions
}

async function canManageTraining(ctx) {
  const permissions = await permissionList(ctx)
  return permissions.includes('pattern_making.view') || permissions.includes('analytics.view') || permissions.includes('settings.manage')
}

async function event(ctx, action, targetType, targetId, status, metadata = {}) {
  await db.collection(C.events).add({ data: {
    eventId: id('pattern_training_event'), enterpriseId: ctx.enterpriseId, operatorMemberId: ctx.memberId,
    action: text(action, 80), targetType: text(targetType, 60), targetId: text(targetId, 120), status: text(status, 40),
    metadata: object(metadata), createdAt: now()
  } })
}

function cleanMeasurements(value) {
  return Object.keys(object(value)).slice(0, 50).reduce((result, key) => {
    const number = Number(value[key])
    if (Number.isFinite(number) && number >= 0 && number <= 500) result[text(key, 60)] = number
    return result
  }, {})
}

function assetReference(value) {
  const normalized = text(value, 300)
  if (!normalized || /^https?:\/\//i.test(normalized) || /^(wxfile|blob):/i.test(normalized)) return ''
  return normalized
}

function buildPatternInput(master, aiVersion) {
  const draft = object(aiVersion.aiDraft)
  const existing = object(draft.patternInput)
  const source = object(draft.sourceImages)
  return {
    inputType: text(existing.inputType || draft.inputMode, 40) || 'garment_photo',
    garmentCategory: text(existing.garmentCategory || master.category, 60),
    frontImageAssetId: assetReference(existing.frontImageAssetId || source.frontImage),
    backImageAssetId: assetReference(existing.backImageAssetId || source.backImage),
    sideImageAssetIds: list(existing.sideImageAssetIds, 10).map((item) => text(item, 120)).filter(Boolean),
    detailImageAssetIds: list(existing.detailImageAssetIds, 20).map((item) => text(item, 120)).filter(Boolean),
    sketchAssetId: assetReference(existing.sketchAssetId || source.structureSketch || source.designSketch),
    bodyMeasurements: cleanMeasurements(existing.bodyMeasurements || (draft.measurementBasis === 'body' ? draft.measurements : {})),
    garmentMeasurements: cleanMeasurements(existing.garmentMeasurements || (draft.measurementBasis === 'garment' ? draft.measurements : {})),
    baseSize: text(existing.baseSize || aiVersion.sizeParams && aiVersion.sizeParams.baseSize, 30),
    materialProperties: object(existing.materialProperties),
    structureOptions: object(existing.structureOptions || draft.structureRequirements),
    constructionRequirements: text(existing.constructionRequirements || draft.notes || aiVersion.craftNote, 2000)
  }
}

function cleanPart(part) {
  return { partCode: text(part.partCode, 60), name: text(part.name, 80), quantity: Number(part.quantity) || 1, cutQuantity: Number(part.cutQuantity) || 1, materialLayer: text(part.materialLayer, 40), grainDirection: text(part.grainDirection, 60), seamAllowanceStatus: text(part.seamAllowanceStatus, 60) }
}

function cleanSize(spec) {
  return { baseSize: text(spec.baseSize, 30), measurementBasis: spec.measurementBasis === 'garment' ? 'garment' : 'body', unit: 'cm', values: cleanMeasurements(spec.values), precisionStatus: text(spec.precisionStatus, 60) }
}

function buildOutput(version, parts, sizes) {
  return {
    technicalDrawingAssetIds: list(version.assetIds, 30).map((item) => text(item, 120)).filter(Boolean),
    generatedOutputs: list(version.generatedOutputs, 30),
    patternPieces: parts.map(cleanPart), sizeSpecs: sizes.map(cleanSize),
    constructionNotes: text(version.craftNote || version.reviewNotes, 3000),
    modelVersion: text(object(version.aiDraft).modelVersion, 100), providerRunId: text(object(version.aiDraft).providerRunId, 120),
    humanReviewRequired: true, productionReady: false
  }
}

function same(left, right) { return JSON.stringify(left == null ? null : left) === JSON.stringify(right == null ? null : right) }
function keyed(items, keys) { return new Map(items.map((item, index) => [keys.map((key) => text(item[key])).find(Boolean) || `item_${index}`, item])) }
function diffOutputs(before, after) {
  const fieldChanges = ['constructionNotes', 'generatedOutputs'].filter((key) => !same(before[key], after[key])).map((key) => ({ field: key, before: before[key], after: after[key] }))
  const makeChanges = (beforeItems, afterItems, keys) => {
    const a = keyed(beforeItems, keys); const b = keyed(afterItems, keys); const all = [...new Set([...a.keys(), ...b.keys()])]
    return all.filter((key) => !same(a.get(key), b.get(key))).map((key) => ({ key, changeType: !a.has(key) ? 'added' : (!b.has(key) ? 'removed' : 'updated'), before: a.get(key) || null, after: b.get(key) || null }))
  }
  const partChanges = makeChanges(before.patternPieces, after.patternPieces, ['partCode', 'name'])
  const sizeChanges = makeChanges(before.sizeSpecs, after.sizeSpecs, ['baseSize'])
  return { fieldChanges, partChanges, sizeChanges, changeCount: fieldChanges.length + partChanges.length + sizeChanges.length }
}

function partKey(item = {}, index = 0) { return text(item.partCode || item.code || item.name || `part_${index}`, 120).toLowerCase() }
function sizeValueMap(items = []) {
  const result = {}
  list(items, 30).forEach((spec) => {
    const size = text(spec.baseSize || spec.sizeCode || 'base', 30)
    Object.keys(object(spec.values)).slice(0, 50).forEach((key) => {
      const value = Number(spec.values[key])
      if (Number.isFinite(value)) result[`${size}:${text(key, 60)}`] = value
    })
  })
  return result
}
function automaticMetrics(candidateValue = {}, approvedValue = {}) {
  const candidate = object(candidateValue); const approved = object(approvedValue)
  const candidateParts = new Map(list(candidate.patternPieces, 100).map((item, index) => [partKey(item, index), item]))
  const approvedParts = new Map(list(approved.patternPieces, 100).map((item, index) => [partKey(item, index), item]))
  const matched = [...candidateParts.keys()].filter((key) => approvedParts.has(key)).length
  const precision = candidateParts.size ? matched / candidateParts.size : 0
  const recall = approvedParts.size ? matched / approvedParts.size : 0
  const partF1 = precision + recall ? (2 * precision * recall) / (precision + recall) : 0
  const candidateSizes = sizeValueMap(candidate.sizeSpecs); const approvedSizes = sizeValueMap(approved.sizeSpecs)
  const sizeKeys = Object.keys(approvedSizes).filter((key) => Number.isFinite(candidateSizes[key]))
  const errors = sizeKeys.map((key) => Math.abs(candidateSizes[key] - approvedSizes[key]))
  return {
    metricVersion: EVALUATION_METRIC_VERSION,
    partPrecision: Number(precision.toFixed(4)), partRecall: Number(recall.toFixed(4)), partF1: Number(partF1.toFixed(4)),
    approvedPartCount: approvedParts.size, candidatePartCount: candidateParts.size,
    comparableSizeFieldCount: errors.length,
    sizeMeanAbsoluteError: errors.length ? Number(average(errors).toFixed(4)) : null,
    sizeWithinToleranceRate: errors.length ? Number((errors.filter((value) => value <= 1).length / errors.length).toFixed(4)) : 0,
    hasConstructionNotes: Boolean(text(candidate.constructionNotes, 3000)),
    outputComplete: Boolean(candidateParts.size && errors.length)
  }
}
async function findLineageRoot(ctx, master) {
  let current = master; let rootId = text(master.patternMasterId, 120)
  for (let index = 0; index < 20 && current && current.parentPatternMasterId; index += 1) {
    const parent = await one(C.masters, { enterpriseId: ctx.enterpriseId, patternMasterId: current.parentPatternMasterId })
    if (!parent) break
    current = parent; rootId = text(parent.patternMasterId, 120) || rootId
  }
  return rootId
}
function sampleLineage(sample = {}) { return text(sample.lineageRootId || sample.patternMasterId, 120) }
function datasetKind(dataset = {}) { return dataset.datasetType === 'evaluation' || dataset.split === 'evaluation' ? 'evaluation' : 'training' }
async function getDatasetSamples(ctx, dataset) {
  const items = await many(C.datasetItems, { enterpriseId: ctx.enterpriseId, datasetId: dataset.datasetId }, 100)
  const samples = []
  for (const item of items) {
    const sample = await one(C.samples, { enterpriseId: ctx.enterpriseId, sampleId: item.sampleId })
    if (sample) samples.push(sample)
  }
  return samples
}
function coverageFor(samples = []) {
  const coverage = { categoryCounts: {}, neckTypes: [], sleeveTypes: [], fitTypes: [], lengthTypes: [], materialTypes: [], baseSizes: [], complexityLevels: [] }
  samples.forEach((sample) => {
    const input = object(sample.patternInput); const options = object(input.structureOptions); const material = object(input.materialProperties)
    const category = text(input.garmentCategory, 60)
    if (category) coverage.categoryCounts[category] = Number(coverage.categoryCounts[category] || 0) + 1
    ;[['neckTypes', options.neckType || options.collar], ['sleeveTypes', options.sleeveType || options.sleeve], ['fitTypes', options.fitType || options.fit], ['lengthTypes', options.lengthType || options.length], ['materialTypes', material.type || material.name], ['baseSizes', input.baseSize], ['complexityLevels', options.complexity || options.structureComplexity]].forEach(([key, value]) => {
      const normalized = text(value, 80); if (normalized && !coverage[key].includes(normalized)) coverage[key].push(normalized)
    })
  })
  coverage.categoryCount = Object.keys(coverage.categoryCounts).length
  coverage.missingCategories = EVALUATION_CATEGORIES.filter((category) => !coverage.categoryCounts[category])
  return coverage
}
async function conflictingLineages(ctx, samples, requestedKind) {
  const requested = new Set(samples.map(sampleLineage).filter(Boolean)); const conflicts = new Set()
  const datasets = await many(C.datasets, { enterpriseId: ctx.enterpriseId }, 100)
  for (const dataset of datasets.filter((item) => item.status === 'frozen_snapshot' && datasetKind(item) !== requestedKind)) {
    const existingSamples = await getDatasetSamples(ctx, dataset)
    existingSamples.forEach((sample) => { if (requested.has(sampleLineage(sample))) conflicts.add(sampleLineage(sample)) })
  }
  return [...conflicts]
}

async function findAiVersion(ctx, approvedVersion) {
  let current = approvedVersion
  let earliestAiVersion = null
  for (let index = 0; index < 20 && current; index += 1) {
    if (current.aiDraft && Object.keys(current.aiDraft).length) earliestAiVersion = current
    if (!current.parentVersionId) break
    current = await one(C.versions, { enterpriseId: ctx.enterpriseId, versionId: current.parentVersionId })
  }
  return earliestAiVersion
}

async function consentFor(ctx, userId) {
  return one(C.consents, { enterpriseId: ctx.enterpriseId, userId, consentType: 'ai_pattern_training' })
}

async function setConsent(ctx, data) {
  const granted = data.granted === true
  const at = now(); const existing = await consentFor(ctx, ctx.userId)
  const record = {
    consentId: existing && existing.consentId || id('pattern_training_consent'), enterpriseId: ctx.enterpriseId, userId: ctx.userId,
    consentType: 'ai_pattern_training', protocolVersion: 'pattern-training-consent-v1', status: granted ? 'granted' : 'withdrawn',
    dataScope: 'approved_owned_pattern_versions_only', grantedAt: granted ? (existing && existing.grantedAt || at) : (existing && existing.grantedAt || ''),
    withdrawnAt: granted ? '' : at, sourcePage: 'pattern_training_center', updatedAt: at, createdAt: existing && existing.createdAt || at
  }
  if (existing) await db.collection(C.consents).where({ enterpriseId: ctx.enterpriseId, consentId: existing.consentId }).update({ data: record })
  else await db.collection(C.consents).add({ data: record })
  if (!granted) await db.collection(C.samples).where({ enterpriseId: ctx.enterpriseId, ownerUserId: ctx.userId, authorizationStatus: 'granted' }).update({ data: { authorizationStatus: 'withdrawn', updatedAt: at } })
  await event(ctx, granted ? 'grant_consent' : 'withdraw_consent', 'consent', record.consentId, record.status, { protocolVersion: record.protocolVersion })
  return ok({ consent: safe(record) }, record.status)
}

async function approvedCandidates(ctx) {
  const canManage = await canManageTraining(ctx)
  const versions = await many(C.versions, { enterpriseId: ctx.enterpriseId, reviewStatus: 'approved' }, 100)
  const items = []
  for (const version of versions) {
    const master = await one(C.masters, { enterpriseId: ctx.enterpriseId, patternMasterId: version.patternMasterId })
    if (!master) continue
    const ownerUserId = text(master.ownerUserId, 120)
    if (!canManage && ownerUserId !== ctx.userId) continue
    const consent = ownerUserId ? await consentFor(ctx, ownerUserId) : null
    const sample = await one(C.samples, { enterpriseId: ctx.enterpriseId, approvedVersionId: version.versionId })
    items.push({ patternId: master.patternMasterId, versionId: version.versionId, title: master.title, category: master.category, versionNo: version.versionNo, consentStatus: consent && consent.status || 'not_granted', sampleStatus: sample && sample.status || 'not_created', updatedAt: version.updatedAt || master.updatedAt })
  }
  return items.sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')))
}

async function createSample(ctx, data) {
  const patternId = text(data.patternId, 120); const versionId = text(data.versionId, 120)
  const master = await one(C.masters, { enterpriseId: ctx.enterpriseId, patternMasterId: patternId })
  const approved = await one(C.versions, { enterpriseId: ctx.enterpriseId, patternMasterId: patternId, versionId })
  if (!master || !approved) return fail('not_found', 'PATTERN_NOT_FOUND', '版型或版本不存在。')
  const canManage = await canManageTraining(ctx)
  if (!canManage && master.ownerUserId !== ctx.userId) return fail('forbidden', 'FORBIDDEN', '只能为本人拥有的版型创建训练候选样本。')
  if (approved.reviewStatus !== 'approved' || master.approvedVersionId !== approved.versionId) return fail('invalid_state', 'APPROVED_PATTERN_REQUIRED', '仅可使用已批准且当前有效的版型版本。')
  const ownerUserId = text(master.ownerUserId, 120)
  const consent = ownerUserId ? await consentFor(ctx, ownerUserId) : null
  if (!consent || consent.status !== 'granted') return fail('consent_required', 'TRAINING_CONSENT_REQUIRED', '版型所有者尚未授权该批准版型用于AI制版训练。')
  const existing = await one(C.samples, { enterpriseId: ctx.enterpriseId, approvedVersionId: approved.versionId })
  if (existing) return ok({ sample: existing }, 'existing_sample')
  const aiVersion = await findAiVersion(ctx, approved)
  if (!aiVersion) return fail('invalid_state', 'AI_DRAFT_REQUIRED', '该版本链缺少可追溯的AI初稿。')
  if (aiVersion.versionId === approved.versionId) return fail('invalid_state', 'HUMAN_REVISION_REQUIRED', '该批准版本缺少独立的打版师修订版本，暂不能进入训练样本。')
  const [aiParts, aiSizes, approvedParts, approvedSizes] = await Promise.all([
    many(C.parts, { enterpriseId: ctx.enterpriseId, versionId: aiVersion.versionId }, 100),
    many(C.sizes, { enterpriseId: ctx.enterpriseId, versionId: aiVersion.versionId }, 30),
    many(C.parts, { enterpriseId: ctx.enterpriseId, versionId: approved.versionId }, 100),
    many(C.sizes, { enterpriseId: ctx.enterpriseId, versionId: approved.versionId }, 30)
  ])
  const aiOutput = buildOutput(aiVersion, aiParts, aiSizes); const approvedOutput = buildOutput(approved, approvedParts, approvedSizes)
  const revisionDiff = diffOutputs(aiOutput, approvedOutput)
  const patternInput = buildPatternInput(master, aiVersion)
  if (!patternInput.frontImageAssetId) return fail('invalid_state', 'SOURCE_ASSET_REFERENCE_REQUIRED', 'AI初稿缺少稳定且可追溯的正面输入资产，不能进入训练样本。')
  const lineageRootId = await findLineageRoot(ctx, master)
  const at = now(); const sample = {
    sampleId: `pattern_training_sample_${hash(`${ctx.enterpriseId}:${approved.versionId}`).slice(0, 32)}`, enterpriseId: ctx.enterpriseId, ownerUserId, patternMasterId: master.patternMasterId,
    aiVersionId: aiVersion.versionId, approvedVersionId: approved.versionId, lineageRootId, modelVersion: aiOutput.modelVersion,
    patternInput, aiDraft: aiOutput, approvedPattern: approvedOutput, revisionDiff,
    status: 'eligible', authorizationStatus: 'granted', consentId: consent.consentId, consentVersion: consent.protocolVersion,
    trace: { historyId: text(aiVersion.historyId, 120), batchId: text(aiVersion.batchId, 120), taskIds: list(aiVersion.taskIds, 30).map((item) => text(item, 120)) },
    quality: { humanApproved: true, productionReady: false, requiresSampleValidation: true }, createdByMemberId: ctx.memberId, createdAt: at, updatedAt: at
  }
  await db.collection(C.samples).doc(sample.sampleId).set({ data: sample })
  await db.collection(C.diffs).add({ data: { diffId: id('pattern_revision_diff'), enterpriseId: ctx.enterpriseId, patternMasterId: master.patternMasterId, fromVersionId: aiVersion.versionId, toVersionId: approved.versionId, sampleId: sample.sampleId, ...revisionDiff, createdAt: at } })
  await event(ctx, 'create_training_sample', 'sample', sample.sampleId, 'eligible', { changeCount: revisionDiff.changeCount })
  return ok({ sample: safe(sample) }, 'sample_created')
}

async function createDataset(ctx, data) {
  await requireTrainingAccess(ctx)
  const requested = [...new Set(list(data.sampleIds, 500).map((item) => text(item, 120)).filter(Boolean))]
  if (!requested.length) return fail('invalid_params', 'SAMPLES_REQUIRED', '请至少选择一个已授权训练样本。')
  const samples = []
  for (const sampleId of requested) {
    const sample = await one(C.samples, { enterpriseId: ctx.enterpriseId, sampleId })
    if (!sample || sample.status !== 'eligible' || sample.authorizationStatus !== 'granted') return fail('invalid_state', 'SAMPLE_NOT_ELIGIBLE', '所选样本中包含未授权或不可用数据。')
    samples.push(sample)
  }
  const conflicts = await conflictingLineages(ctx, samples, 'training')
  if (conflicts.length) return fail('invalid_state', 'EVALUATION_LINEAGE_CONFLICT', '所选版型或派生版本已进入固定评测集，不能再加入训练集。')
  const at = now(); const datasetId = id('pattern_dataset'); const dataset = { datasetId, datasetVersionId: id('pattern_dataset_version'), enterpriseId: ctx.enterpriseId, name: text(data.name, 100) || `AI制版数据集 ${at.slice(0, 10)}`, version: text(data.version, 30) || 'V1', datasetType: 'training', split: 'train', splitRuleVersion: 'pattern-lineage-split-v1', status: 'frozen_snapshot', frozenAt: at, sampleCount: samples.length, authorizedOnly: true, trainingExecuted: false, createdByMemberId: ctx.memberId, createdAt: at, updatedAt: at }
  await db.collection(C.datasets).add({ data: dataset })
  for (let index = 0; index < samples.length; index += 1) await db.collection(C.datasetItems).add({ data: { datasetItemId: id('pattern_dataset_item'), enterpriseId: ctx.enterpriseId, datasetId: dataset.datasetId, datasetVersionId: dataset.datasetVersionId, sampleId: samples[index].sampleId, lineageRootId: sampleLineage(samples[index]), split: 'train', createdAt: at } })
  await event(ctx, 'create_dataset_snapshot', 'dataset', dataset.datasetId, dataset.status, { sampleCount: samples.length })
  return ok({ dataset }, 'dataset_created')
}

async function createEvaluationDataset(ctx, data) {
  await requireExactPermission(ctx, ['settings.manage'])
  const requested = [...new Set(list(data.sampleIds, 100).map((item) => text(item, 120)).filter(Boolean))]
  if (!requested.length) return fail('invalid_params', 'SAMPLES_REQUIRED', '请至少选择一个已授权评测样本。')
  const samples = []
  for (const sampleId of requested) {
    const sample = await one(C.samples, { enterpriseId: ctx.enterpriseId, sampleId })
    if (!sample || sample.status !== 'eligible' || sample.authorizationStatus !== 'granted') return fail('invalid_state', 'SAMPLE_NOT_ELIGIBLE', '固定评测集只能包含已批准且已授权样本。')
    samples.push(sample)
  }
  const coverage = coverageFor(samples)
  if (coverage.missingCategories.length) return fail('invalid_state', 'EVALUATION_CATEGORY_COVERAGE_REQUIRED', `固定评测集尚缺少品类：${coverage.missingCategories.join('、')}`)
  const conflicts = await conflictingLineages(ctx, samples, 'evaluation')
  if (conflicts.length) return fail('invalid_state', 'TRAINING_LINEAGE_CONFLICT', '所选版型或派生版本已进入训练集，不能再加入固定评测集。')
  const at = now(); const datasetId = id('pattern_evaluation_dataset')
  const dataset = {
    datasetId, datasetVersionId: id('pattern_dataset_version'), enterpriseId: ctx.enterpriseId,
    name: text(data.name, 100) || `AI制版固定评测集 ${at.slice(0, 10)}`, version: text(data.version, 30) || 'V1',
    datasetType: 'evaluation', split: 'evaluation', splitRuleVersion: 'pattern-lineage-split-v1', status: 'frozen_snapshot', frozenAt: at,
    sampleCount: samples.length, authorizedOnly: true, immutable: true, coverage,
    createdByMemberId: ctx.memberId, createdAt: at, updatedAt: at
  }
  await db.collection(C.datasets).add({ data: dataset })
  for (const sample of samples) await db.collection(C.datasetItems).add({ data: { datasetItemId: id('pattern_dataset_item'), enterpriseId: ctx.enterpriseId, datasetId, datasetVersionId: dataset.datasetVersionId, sampleId: sample.sampleId, lineageRootId: sampleLineage(sample), split: 'evaluation', createdAt: at } })
  await event(ctx, 'create_fixed_evaluation_dataset', 'dataset', datasetId, dataset.status, { sampleCount: samples.length, categoryCount: coverage.categoryCount, splitRuleVersion: dataset.splitRuleVersion })
  return ok({ dataset }, 'evaluation_dataset_created')
}

async function registerModel(ctx, data) {
  await requireTrainingAccess(ctx, 'settings.manage')
  const datasetId = text(data.datasetId, 120); const dataset = await one(C.datasets, { enterpriseId: ctx.enterpriseId, datasetId })
  if (!dataset) return fail('not_found', 'DATASET_NOT_FOUND', '数据集不存在。')
  const at = now(); const modelId = id('pattern_model'); const model = { modelId, modelVersionId: modelId, enterpriseId: ctx.enterpriseId, name: text(data.name, 100) || 'AI制版模型记录', version: text(data.version, 80), provider: text(data.provider, 80), datasetId, promptVersion: text(data.promptVersion, 80), parserVersion: text(data.parserVersion, 80), status: 'registered_not_trained', trainingExecuted: false, active: false, createdByMemberId: ctx.memberId, createdAt: at, updatedAt: at }
  if (!model.version) return fail('invalid_params', 'MODEL_VERSION_REQUIRED', '请填写可追溯的模型版本。')
  await db.collection(C.models).add({ data: model })
  await event(ctx, 'register_model_metadata', 'model', model.modelId, model.status, { datasetId })
  return ok({ model }, 'model_registered')
}

function cleanEvaluationOutput(value = {}) {
  const output = object(value)
  return {
    patternPieces: list(output.patternPieces, 100).map(cleanPart),
    sizeSpecs: list(output.sizeSpecs, 30).map(cleanSize),
    constructionNotes: text(output.constructionNotes || output.craftNote, 3000),
    technicalDrawingAssetIds: list(output.technicalDrawingAssetIds, 30).map((item) => text(item, 120)).filter(Boolean),
    parserWarnings: list(output.parserWarnings, 30).map((item) => text(item, 160)).filter(Boolean),
    productionReady: false
  }
}

async function createEvaluationRun(ctx, data) {
  await requireExactPermission(ctx, ['settings.manage'])
  const datasetVersionId = text(data.datasetVersionId, 120); const modelVersionId = text(data.modelVersionId || data.modelId, 120)
  const dataset = await one(C.datasets, { enterpriseId: ctx.enterpriseId, datasetVersionId })
    || await one(C.datasets, { enterpriseId: ctx.enterpriseId, datasetId: datasetVersionId })
  const model = await one(C.models, { enterpriseId: ctx.enterpriseId, modelVersionId })
    || await one(C.models, { enterpriseId: ctx.enterpriseId, modelId: modelVersionId })
  if (!dataset || datasetKind(dataset) !== 'evaluation' || dataset.status !== 'frozen_snapshot') return fail('invalid_state', 'FROZEN_EVALUATION_DATASET_REQUIRED', '请选择已冻结的固定评测集。')
  if (!model) return fail('not_found', 'MODEL_NOT_FOUND', '模型版本记录不存在。')
  const promptVersion = text(data.promptVersion || model.promptVersion, 80); const parserVersion = text(data.parserVersion || model.parserVersion, 80)
  const externalRunReference = text(data.externalRunReference, 160)
  if (!promptVersion || !parserVersion || !externalRunReference) return fail('invalid_params', 'EVALUATION_VERSION_TRACE_REQUIRED', '请填写提示词版本、解析器版本和外部运行依据。')
  const samples = await getDatasetSamples(ctx, dataset)
  if (!samples.length || samples.some((sample) => sample.authorizationStatus !== 'granted')) return fail('invalid_state', 'AUTHORIZED_EVALUATION_SAMPLES_REQUIRED', '固定评测集包含未授权或不可用样本。')
  const at = now(); const run = {
    evaluationRunId: id('pattern_evaluation_run'), evaluationId: '', enterpriseId: ctx.enterpriseId,
    datasetId: dataset.datasetId, datasetVersionId: dataset.datasetVersionId || dataset.datasetId,
    modelId: model.modelId, modelVersionId: model.modelVersionId || model.modelId,
    promptVersion, parserVersion, externalRunReference, sampleCount: samples.length,
    status: 'awaiting_external_results', metrics: {}, reviewerSummary: {}, candidateGate: { passed: false, failures: ['evaluation_not_completed'] },
    deploymentStatus: 'not_deployed', startedAt: at, completedAt: '', createdBy: ctx.memberId, createdByMemberId: ctx.memberId, createdAt: at, updatedAt: at
  }
  run.evaluationId = run.evaluationRunId
  await db.collection(C.evaluations).add({ data: run })
  await db.collection(C.models).where({ enterpriseId: ctx.enterpriseId, modelId: model.modelId }).update({ data: { status: 'evaluation_pending', updatedAt: at } })
  await event(ctx, 'create_evaluation_run', 'evaluation_run', run.evaluationRunId, run.status, { sampleCount: run.sampleCount, promptVersion, parserVersion })
  return ok({ evaluationRun: run }, 'evaluation_run_created')
}

async function recordEvaluationResult(ctx, data) {
  await requireExactPermission(ctx, ['settings.manage'])
  const evaluationRunId = text(data.evaluationRunId, 120); const sampleId = text(data.sampleId, 120)
  const run = await one(C.evaluations, { enterpriseId: ctx.enterpriseId, evaluationRunId })
  if (!run) return fail('not_found', 'EVALUATION_RUN_NOT_FOUND', '评测运行不存在。')
  if (['completed', 'candidate_selected'].includes(run.status)) return fail('invalid_state', 'EVALUATION_RUN_FROZEN', '已完成评测不可覆盖结果。')
  const dataset = await one(C.datasets, { enterpriseId: ctx.enterpriseId, datasetId: run.datasetId })
  const items = dataset ? await many(C.datasetItems, { enterpriseId: ctx.enterpriseId, datasetId: dataset.datasetId }, 100) : []
  if (!items.some((item) => item.sampleId === sampleId)) return fail('forbidden', 'SAMPLE_NOT_IN_EVALUATION_SET', '样本不属于当前固定评测集。')
  const sample = await one(C.samples, { enterpriseId: ctx.enterpriseId, sampleId })
  if (!sample || sample.authorizationStatus !== 'granted') return fail('invalid_state', 'SAMPLE_AUTHORIZATION_REQUIRED', '样本授权状态不可用于本次评测。')
  const existing = await one(C.evaluationResults, { enterpriseId: ctx.enterpriseId, evaluationRunId, sampleId })
  if (existing) return ok({ result: existing }, 'existing_evaluation_result')
  const candidateOutput = cleanEvaluationOutput(data.candidateOutput)
  if (!candidateOutput.patternPieces.length && !candidateOutput.sizeSpecs.length) return fail('invalid_params', 'EVALUATION_OUTPUT_REQUIRED', '请提交真实解析得到的部件或尺寸结果。')
  const metrics = automaticMetrics(candidateOutput, sample.approvedPattern)
  const at = now(); const result = {
    evaluationResultId: id('pattern_evaluation_result'), enterpriseId: ctx.enterpriseId, evaluationRunId, sampleId,
    blindedCandidateCode: `candidate_${hash(`${evaluationRunId}:${sampleId}`).slice(0, 12)}`,
    category: text(object(sample.patternInput).garmentCategory, 60), candidateOutput, automaticMetrics: metrics,
    executionReference: text(data.executionReference || run.externalRunReference, 160), status: metrics.outputComplete ? 'ready_for_blind_review' : 'incomplete_output',
    createdByMemberId: ctx.memberId, createdAt: at, updatedAt: at
  }
  await db.collection(C.evaluationResults).add({ data: result })
  await db.collection(C.evaluations).where({ enterpriseId: ctx.enterpriseId, evaluationRunId }).update({ data: { status: 'awaiting_blind_review', updatedAt: at } })
  await event(ctx, 'record_evaluation_result', 'evaluation_result', result.evaluationResultId, result.status, { category: result.category, outputComplete: metrics.outputComplete })
  return ok({ result: safe(result) }, 'evaluation_result_recorded')
}

async function recordBlindReview(ctx, data) {
  await requireExactPermission(ctx, ['pattern_making.approve', 'settings.manage'])
  const evaluationRunId = text(data.evaluationRunId, 120); const evaluationResultId = text(data.evaluationResultId, 120)
  const run = await one(C.evaluations, { enterpriseId: ctx.enterpriseId, evaluationRunId })
  const result = await one(C.evaluationResults, { enterpriseId: ctx.enterpriseId, evaluationRunId, evaluationResultId })
  if (!run || !result) return fail('not_found', 'BLIND_REVIEW_TARGET_NOT_FOUND', '盲评对象不存在。')
  if (run.status !== 'awaiting_blind_review' || result.status !== 'ready_for_blind_review') return fail('invalid_state', 'BLIND_REVIEW_NOT_READY', '当前结果尚未进入盲评阶段。')
  if (run.createdByMemberId === ctx.memberId) return fail('forbidden', 'INDEPENDENT_REVIEWER_REQUIRED', '评测创建人不能评审自己创建的候选结果。')
  const existing = await one(C.evaluationReviews, { enterpriseId: ctx.enterpriseId, evaluationRunId, evaluationResultId, reviewerMemberId: ctx.memberId })
  if (existing) return fail('duplicate_record', 'BLIND_REVIEW_ALREADY_SUBMITTED', '当前结果已完成盲评，不能重复提交。')
  const scores = BLIND_REVIEW_FIELDS.reduce((output, field) => { const value = Number(object(data.scores)[field] || data[field]); if (Number.isInteger(value) && value >= 1 && value <= 5) output[field] = value; return output }, {})
  if (Object.keys(scores).length !== BLIND_REVIEW_FIELDS.length) return fail('invalid_params', 'BLIND_REVIEW_SCORES_REQUIRED', '请完成结构、尺寸、部件和工艺四项评分。')
  const at = now(); const review = {
    blindReviewId: id('pattern_blind_review'), enterpriseId: ctx.enterpriseId, evaluationRunId, evaluationResultId,
    blindedCandidateCode: result.blindedCandidateCode, reviewerMemberId: ctx.memberId, scores,
    issueTags: list(data.issueTags, 20).map((item) => text(item, 80)).filter(Boolean), notes: text(data.notes, 1000), recommendCandidate: data.recommendCandidate === true,
    createdAt: at
  }
  await db.collection(C.evaluationReviews).add({ data: review })
  await event(ctx, 'record_blind_review', 'evaluation_result', evaluationResultId, 'reviewed', { scoreCount: Object.keys(scores).length, recommendCandidate: review.recommendCandidate })
  return ok({ review: safe(review) }, 'blind_review_recorded')
}

function candidateGate(metrics = {}, context = {}) {
  const automatic = object(metrics.automatic); const human = object(metrics.humanScores); const failures = []
  if (Number(context.categoryCount || 0) < EVALUATION_CATEGORIES.length) failures.push('category_coverage_incomplete')
  if (Number(context.resultCoverage || 0) < 1) failures.push('sample_results_incomplete')
  if (Number(context.reviewCoverage || 0) < 1) failures.push('blind_reviews_incomplete')
  if (Number(automatic.outputCompleteRate || 0) < 1) failures.push('output_incomplete')
  if (Number(automatic.partF1 || 0) < 0.85) failures.push('part_f1_below_threshold')
  if (Number(automatic.sizeWithinToleranceRate || 0) < 0.9) failures.push('size_tolerance_below_threshold')
  BLIND_REVIEW_FIELDS.forEach((field) => { if (Number(human[field] || 0) < 4) failures.push(`${field}_below_threshold`) })
  return { passed: !failures.length, failures }
}

async function completeEvaluationRun(ctx, data) {
  await requireExactPermission(ctx, ['settings.manage'])
  const evaluationRunId = text(data.evaluationRunId, 120); const run = await one(C.evaluations, { enterpriseId: ctx.enterpriseId, evaluationRunId })
  if (!run) return fail('not_found', 'EVALUATION_RUN_NOT_FOUND', '评测运行不存在。')
  if (['completed', 'candidate_selected'].includes(run.status)) return ok({ evaluationRun: run }, 'evaluation_run_already_completed')
  const results = await many(C.evaluationResults, { enterpriseId: ctx.enterpriseId, evaluationRunId }, 100)
  const reviews = await many(C.evaluationReviews, { enterpriseId: ctx.enterpriseId, evaluationRunId }, 100)
  if (results.length !== Number(run.sampleCount || 0)) return fail('invalid_state', 'EVALUATION_RESULTS_INCOMPLETE', '固定评测集尚有样本未提交真实结果。')
  const reviewedResultIds = new Set(reviews.map((item) => item.evaluationResultId))
  if (results.some((item) => !reviewedResultIds.has(item.evaluationResultId))) return fail('invalid_state', 'BLIND_REVIEWS_INCOMPLETE', '每个样本至少需要一份独立打版师盲评。')
  const automatic = {
    partF1: Number(average(results.map((item) => object(item.automaticMetrics).partF1)).toFixed(4)),
    sizeWithinToleranceRate: Number(average(results.map((item) => object(item.automaticMetrics).sizeWithinToleranceRate)).toFixed(4)),
    sizeMeanAbsoluteError: Number(average(results.map((item) => object(item.automaticMetrics).sizeMeanAbsoluteError).filter((value) => value != null)).toFixed(4)),
    outputCompleteRate: Number((results.filter((item) => object(item.automaticMetrics).outputComplete).length / results.length).toFixed(4))
  }
  const humanScores = BLIND_REVIEW_FIELDS.reduce((output, field) => { output[field] = Number(average(reviews.map((item) => object(item.scores)[field])).toFixed(4)); return output }, {})
  const categoryCount = new Set(results.map((item) => item.category).filter(Boolean)).size
  const metrics = { metricVersion: EVALUATION_METRIC_VERSION, automatic, humanScores }
  const gate = candidateGate(metrics, { categoryCount, resultCoverage: results.length / run.sampleCount, reviewCoverage: reviewedResultIds.size / results.length })
  const reviewerSummary = { reviewCount: reviews.length, reviewerCount: new Set(reviews.map((item) => item.reviewerMemberId)).size, recommendCount: reviews.filter((item) => item.recommendCandidate).length, issueTags: [...new Set(reviews.flatMap((item) => list(item.issueTags, 20)))].slice(0, 30) }
  const at = now(); const patch = { status: 'completed', metrics, reviewerSummary, candidateGate: gate, completedAt: at, updatedAt: at }
  await db.collection(C.evaluations).where({ enterpriseId: ctx.enterpriseId, evaluationRunId }).update({ data: patch })
  await db.collection(C.models).where({ enterpriseId: ctx.enterpriseId, modelId: run.modelId }).update({ data: { status: gate.passed ? 'evaluation_passed_not_active' : 'evaluation_recorded', latestEvaluationId: evaluationRunId, updatedAt: at } })
  await event(ctx, 'complete_evaluation_run', 'evaluation_run', evaluationRunId, 'completed', { sampleCount: run.sampleCount, candidateGatePassed: gate.passed })
  return ok({ evaluationRun: { ...run, ...patch } }, 'evaluation_run_completed')
}

async function selectCandidateModel(ctx, data) {
  await requireExactPermission(ctx, ['settings.manage'])
  const evaluationRunId = text(data.evaluationRunId, 120); const run = await one(C.evaluations, { enterpriseId: ctx.enterpriseId, evaluationRunId })
  if (!run || run.status !== 'completed') return fail('invalid_state', 'COMPLETED_EVALUATION_REQUIRED', '只有已完成评测运行可以进入候选版本。')
  if (!object(run.candidateGate).passed) return fail('invalid_state', 'CANDIDATE_GATE_NOT_PASSED', '当前版本未达到候选门槛。')
  const at = now()
  await db.collection(C.models).where({ enterpriseId: ctx.enterpriseId, modelId: run.modelId }).update({ data: { status: 'candidate_not_active', selectedEvaluationRunId: evaluationRunId, active: false, updatedAt: at } })
  await db.collection(C.evaluations).where({ enterpriseId: ctx.enterpriseId, evaluationRunId }).update({ data: { status: 'candidate_selected', candidateSelectedAt: at, deploymentStatus: 'not_deployed', updatedAt: at } })
  await event(ctx, 'select_candidate_model', 'model', run.modelId, 'candidate_not_active', { evaluationRunId })
  return ok({ modelId: run.modelId, evaluationRunId, active: false, deploymentStatus: 'not_deployed' }, 'candidate_selected_not_deployed')
}

async function recordEvaluation(ctx, data) {
  await requireTrainingAccess(ctx)
  const modelId = text(data.modelId, 120); const model = await one(C.models, { enterpriseId: ctx.enterpriseId, modelId })
  if (!model) return fail('not_found', 'MODEL_NOT_FOUND', '模型版本记录不存在。')
  const rawMetrics = object(data.metrics); const metrics = Object.keys(rawMetrics).slice(0, 30).reduce((result, key) => { const value = Number(rawMetrics[key]); if (Number.isFinite(value)) result[text(key, 60)] = value; return result }, {})
  const sampleCount = Math.max(0, Number(data.sampleCount) || 0); const externalRunReference = text(data.externalRunReference, 160)
  if (!Object.keys(metrics).length || !sampleCount || !externalRunReference) return fail('invalid_params', 'EVALUATION_EVIDENCE_REQUIRED', '请填写真实评测样本数、至少一项指标和外部运行依据。')
  const at = now(); const evaluation = { evaluationId: id('pattern_evaluation'), enterpriseId: ctx.enterpriseId, modelId, datasetId: model.datasetId, status: 'externally_recorded', sampleCount, metrics, evaluatorNote: text(data.evaluatorNote, 1000), externalRunReference, passed: data.passed === true, createdByMemberId: ctx.memberId, createdAt: at }
  await db.collection(C.evaluations).add({ data: evaluation })
  await db.collection(C.models).where({ enterpriseId: ctx.enterpriseId, modelId }).update({ data: { status: evaluation.passed ? 'evaluation_passed_not_active' : 'evaluation_recorded', latestEvaluationId: evaluation.evaluationId, updatedAt: at } })
  await event(ctx, 'record_external_evaluation', 'evaluation', evaluation.evaluationId, evaluation.status, { sampleCount, metricCount: Object.keys(metrics).length, passed: evaluation.passed })
  return ok({ evaluation }, 'evaluation_recorded')
}

async function summary(ctx) {
  const canManage = await canManageTraining(ctx)
  const summaryPermissions = await permissionList(ctx)
  const canReview = summaryPermissions.includes('pattern_making.approve') || summaryPermissions.includes('settings.manage')
  const canConfigureEvaluation = summaryPermissions.includes('settings.manage')
  const [consent, candidates, allSamples] = await Promise.all([consentFor(ctx, ctx.userId), approvedCandidates(ctx), many(C.samples, { enterpriseId: ctx.enterpriseId }, 100)])
  const samples = canManage ? allSamples : allSamples.filter((item) => item.ownerUserId === ctx.userId)
  const [datasets, models, evaluationRuns] = canManage
    ? await Promise.all([many(C.datasets, { enterpriseId: ctx.enterpriseId }, 100), many(C.models, { enterpriseId: ctx.enterpriseId }, 100), many(C.evaluations, { enterpriseId: ctx.enterpriseId }, 100)])
    : [[], [], []]
  const reviewRuns = canReview && !canManage ? await many(C.evaluations, { enterpriseId: ctx.enterpriseId }, 100) : evaluationRuns
  const [evaluationResults, evaluationReviews] = canReview || canManage
    ? await Promise.all([many(C.evaluationResults, { enterpriseId: ctx.enterpriseId }, 100), many(C.evaluationReviews, { enterpriseId: ctx.enterpriseId }, 100)])
    : [[], []]
  const reviewedIds = new Set(evaluationReviews.filter((item) => item.reviewerMemberId === ctx.memberId).map((item) => item.evaluationResultId))
  const runsById = new Map(reviewRuns.filter((item) => item.evaluationRunId).map((item) => [item.evaluationRunId, item]))
  const allDatasetItems = canManage ? await many(C.datasetItems, { enterpriseId: ctx.enterpriseId }, 100) : []
  const datasetsById = new Map(datasets.map((item) => [item.datasetId, item]))
  const membershipsBySample = allDatasetItems.reduce((map, item) => {
    const dataset = datasetsById.get(item.datasetId) || {}; const current = map.get(item.sampleId) || []
    current.push({ datasetId: item.datasetId, datasetVersionId: item.datasetVersionId || dataset.datasetVersionId || item.datasetId, split: item.split || dataset.split || 'train', datasetType: datasetKind(dataset) })
    map.set(item.sampleId, current); return map
  }, new Map())
  const blindReviewQueue = canReview ? evaluationResults.filter((item) => item.status === 'ready_for_blind_review' && !reviewedIds.has(item.evaluationResultId) && object(runsById.get(item.evaluationRunId)).createdByMemberId !== ctx.memberId).map((item) => ({
    evaluationRunId: item.evaluationRunId, evaluationResultId: item.evaluationResultId, blindedCandidateCode: item.blindedCandidateCode,
    category: item.category, automaticMetrics: item.automaticMetrics, candidateOutput: item.candidateOutput, createdAt: item.createdAt
  })) : []
  return ok({
    consent: consent || { status: 'not_granted', protocolVersion: 'pattern-training-consent-v1' }, candidates,
    samples: samples.map((item) => ({ sampleId: item.sampleId, patternMasterId: item.patternMasterId, approvedVersionId: item.approvedVersionId, lineageRootId: item.lineageRootId || item.patternMasterId, category: object(item.patternInput).garmentCategory || '', baseSize: object(item.patternInput).baseSize || '', structureOptions: object(item.patternInput).structureOptions, materialProperties: object(item.patternInput).materialProperties, datasetMemberships: membershipsBySample.get(item.sampleId) || [], status: item.status, authorizationStatus: item.authorizationStatus, changeCount: object(item.revisionDiff).changeCount || 0, modelVersion: item.modelVersion || '', createdAt: item.createdAt })),
    datasets, models, evaluations: evaluationRuns, blindReviewQueue,
    stats: { candidateCount: candidates.length, eligibleSampleCount: samples.filter((item) => item.status === 'eligible' && item.authorizationStatus === 'granted').length, datasetCount: datasets.length, modelCount: models.length, evaluationCount: evaluationRuns.length, fixedEvaluationDatasetCount: datasets.filter((item) => datasetKind(item) === 'evaluation').length, blindReviewPendingCount: blindReviewQueue.length },
    capabilities: { canManage, canReview, canConfigureEvaluation, trainingExecution: false, evaluationExecution: false, modelDeployment: false, automaticFactoryMatching: false, automaticQuotation: false, automaticOrdering: false }
  })
}

const ACTIONS = {
  summary,
  set_consent: setConsent,
  create_sample: createSample,
  create_dataset: createDataset,
  create_evaluation_dataset: createEvaluationDataset,
  register_model: registerModel,
  record_evaluation: recordEvaluation,
  create_evaluation_run: createEvaluationRun,
  record_evaluation_result: recordEvaluationResult,
  record_blind_review: recordBlindReview,
  complete_evaluation_run: completeEvaluationRun,
  select_candidate_model: selectCandidateModel
}

exports.main = async (eventInput = {}) => {
  const startedAt = Date.now(); const action = text(eventInput.action, 50); let success = false; let errorCode = ''
  try {
    if (!ACTIONS[action]) return fail('invalid_action', 'INVALID_ACTION', '未知AI制版训练数据操作。')
    const ctx = await requireContext(eventInput.sessionToken)
    const result = await ACTIONS[action](ctx, eventInput.data || {})
    success = Boolean(result && result.ok); errorCode = result && result.errorCode || ''
    return result
  } catch (cause) {
    errorCode = cause.errorCode || 'INTERNAL_ERROR'
    return fail(errorCode === 'FORBIDDEN' ? 'forbidden' : 'error', errorCode, cause.message || 'AI制版训练数据操作失败。')
  } finally {
    console.log('[pattern-training]', { action, success, errorCode, durationMs: Date.now() - startedAt })
  }
}
