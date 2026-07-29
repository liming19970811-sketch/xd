const cloud = require('wx-server-sdk')
const crypto = require('crypto')
const { STATES, REVIEW_ROLES, APPROVE_ROLES, canTransition, approvedSafetyState } = require('./reviewPolicy')
const { QUALITY_STATUSES, normalizePatternSearchRequest, scorePatternCandidate } = require('./patternSearch')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const command = db.command

const COLLECTIONS = Object.freeze({
  sessions: 'enterprise_auth_sessions', members: 'enterprise_members', rolePermissions: 'enterprise_role_permissions',
  masters: 'enterprise_pattern_masters', versions: 'enterprise_pattern_versions', parts: 'enterprise_pattern_parts',
  sizes: 'enterprise_pattern_size_specs', reviews: 'enterprise_pattern_reviews', revisionDiffs: 'enterprise_pattern_revision_diffs'
})

function nowIso() { return new Date().toISOString() }
function id(prefix) { return `${prefix}_${Date.now()}_${crypto.randomBytes(6).toString('hex')}` }
function hash(value) { return crypto.createHash('sha256').update(String(value || '')).digest('hex') }
function text(value, max = 200) { return String(value || '').trim().slice(0, max) }
function ok(data = {}, status = 'success') { return { ok: true, success: true, status, errorCode: '', message: '', data } }
function fail(status, errorCode, message) { return { ok: false, success: false, status, errorCode, message, data: null } }
function error(code, message) { return Object.assign(new Error(message), { errorCode: code }) }
function normalizeDoc(doc) { if (!doc) return null; const { _id, openId, openid, _openid, ...safe } = doc; return { ...safe, id: _id } }

async function one(collection, where) {
  const result = await db.collection(collection).where(where).limit(1).get()
  return result.data && result.data.length ? normalizeDoc(result.data[0]) : null
}

async function many(collection, where, limit = 50) {
  const result = await db.collection(collection).where(where).orderBy('updatedAt', 'desc').limit(Math.min(100, Math.max(1, limit))).get()
  return (result.data || []).map(normalizeDoc)
}

async function requireContext(sessionToken) {
  const token = text(sessionToken, 1000)
  if (!token) throw error('AUTH_REQUIRED', '请先登录企业账号。')
  const session = await one(COLLECTIONS.sessions, { sessionTokenHash: hash(token) })
  if (!session || session.status !== 'active') throw error('SESSION_INVALID', '登录状态无效。')
  if (session.expiresAt && new Date(session.expiresAt).getTime() <= Date.now()) throw error('SESSION_EXPIRED', '登录已过期。')
  const member = await one(COLLECTIONS.members, { enterpriseId: session.enterpriseId, memberId: session.memberId })
  if (!member) throw error('MEMBER_NOT_FOUND', '企业成员不存在。')
  if (member.status !== 'active') throw error('MEMBER_INACTIVE', '当前成员状态不可用。')
  if (member.userId !== session.userId) throw error('TENANT_MISMATCH', '企业身份不匹配。')
  return { enterpriseId: session.enterpriseId, userId: session.userId, memberId: member.memberId, role: text(member.role, 60) }
}

async function permissions(ctx) {
  if (ctx.role === 'admin') return ['pattern_making.view', 'pattern_making.edit', 'pattern_making.approve', 'pattern_library.view', 'pattern_library.create', 'pattern_library.edit']
  const record = await one(COLLECTIONS.rolePermissions, { enterpriseId: ctx.enterpriseId, roleCode: ctx.role })
    || await one(COLLECTIONS.rolePermissions, { enterpriseId: ctx.enterpriseId, role: ctx.role })
  const stored = record && Array.isArray(record.permissions) ? record.permissions.map(String) : []
  const defaults = ctx.role === 'pattern_maker'
    ? ['pattern_making.view', 'pattern_making.edit', 'pattern_making.approve', 'pattern_library.view', 'pattern_library.create', 'pattern_library.edit']
    : (ctx.role === 'reviewer' ? ['pattern_making.view', 'pattern_making.approve', 'pattern_library.view'] : [])
  return Array.from(new Set(record ? stored : defaults))
}

async function requireReviewAccess(ctx, permission = 'pattern_making.view') {
  const allowed = await permissions(ctx)
  if (!REVIEW_ROLES.includes(ctx.role) || !allowed.includes(permission)) throw error('FORBIDDEN', '当前企业角色无版型复核权限。')
  return allowed
}

async function requireLibraryPermission(ctx, permission = 'pattern_library.view') {
  const allowed = await permissions(ctx)
  if (!allowed.includes(permission)) throw error('FORBIDDEN', '当前企业角色无版型库权限。')
  return allowed
}

function ownsPattern(ctx, master = {}) { return master.ownerMemberId === ctx.memberId || master.ownerUserId === ctx.userId }

async function canAccessLibraryPattern(ctx, master = {}) {
  if (!master || master.enterpriseId !== ctx.enterpriseId) return false
  if (ownsPattern(ctx, master)) return true
  const allowed = await permissions(ctx)
  return ['enterprise', 'system'].includes(master.scope) && allowed.includes('pattern_library.view')
}

function cleanValues(values) {
  if (!values || typeof values !== 'object') return {}
  return Object.keys(values).slice(0, 30).reduce((result, key) => {
    const number = Number(values[key])
    if (Number.isFinite(number) && number >= 0 && number <= 500) result[text(key, 40)] = number
    return result
  }, {})
}

function cleanPart(part, patternId, versionId, enterpriseId) {
  return {
    patternPartId: text(part.patternPartId, 100) || id('pattern_part'), patternMasterId: patternId, versionId, enterpriseId,
    partCode: text(part.partCode, 60), name: text(part.name, 80) || '未命名部件', quantity: Math.max(1, Math.min(20, Number(part.quantity) || 1)),
    cutQuantity: Math.max(1, Math.min(40, Number(part.cutQuantity) || 1)), materialLayer: text(part.materialLayer, 40),
    grainDirection: text(part.grainDirection, 60), seamAllowanceStatus: text(part.seamAllowanceStatus, 60), reviewStatus: 'under_review'
  }
}

function cleanSize(spec, patternId, versionId, enterpriseId) {
  return {
    sizeSpecId: text(spec.sizeSpecId, 100) || id('pattern_size'), patternMasterId: patternId, versionId, enterpriseId,
    baseSize: text(spec.baseSize, 20), measurementBasis: spec.measurementBasis === 'garment' ? 'garment' : 'body', unit: 'cm',
    values: cleanValues(spec.values), precisionStatus: text(spec.precisionStatus, 60), reviewStatus: 'under_review'
  }
}

function comparablePart(part = {}) {
  return {
    partCode: text(part.partCode, 60), name: text(part.name, 80), quantity: Number(part.quantity) || 1,
    cutQuantity: Number(part.cutQuantity) || 1, materialLayer: text(part.materialLayer, 40),
    grainDirection: text(part.grainDirection, 60), seamAllowanceStatus: text(part.seamAllowanceStatus, 60)
  }
}

function comparableSize(spec = {}) {
  return { baseSize: text(spec.baseSize, 20), measurementBasis: spec.measurementBasis === 'garment' ? 'garment' : 'body', unit: 'cm', values: cleanValues(spec.values), precisionStatus: text(spec.precisionStatus, 60) }
}

function buildCollectionDiff(beforeItems = [], afterItems = [], keyFields = []) {
  const keyed = (items) => new Map(items.map((item, index) => [keyFields.map((key) => text(item[key], 80)).find(Boolean) || `item_${index}`, item]))
  const before = keyed(beforeItems); const after = keyed(afterItems)
  return [...new Set([...before.keys(), ...after.keys()])].filter((key) => JSON.stringify(before.get(key) || null) !== JSON.stringify(after.get(key) || null)).map((key) => ({
    key, changeType: !before.has(key) ? 'added' : (!after.has(key) ? 'removed' : 'updated'), before: before.get(key) || null, after: after.get(key) || null
  }))
}

function buildRevisionDiff(beforeVersion, afterVersion, beforeParts, afterParts, beforeSizes, afterSizes) {
  const fieldChanges = ['craftNote'].filter((field) => String(beforeVersion[field] || '') !== String(afterVersion[field] || '')).map((field) => ({ field, before: text(beforeVersion[field], 1000), after: text(afterVersion[field], 1000) }))
  const partChanges = buildCollectionDiff(beforeParts.map(comparablePart), afterParts.map(comparablePart), ['partCode', 'name'])
  const sizeChanges = buildCollectionDiff(beforeSizes.map(comparableSize), afterSizes.map(comparableSize), ['baseSize'])
  return { fieldChanges, partChanges, sizeChanges, changeCount: fieldChanges.length + partChanges.length + sizeChanges.length }
}

function sanitizeMaster(master, ctx) {
  return {
    patternMasterId: text(master.patternMasterId, 100), enterpriseId: ctx.enterpriseId, ownerMemberId: ctx.memberId, ownerUserId: ctx.userId,
    patternCode: text(master.patternCode, 80), title: text(master.title, 120) || '未命名版型', category: text(master.category, 60),
    patternLevel: 'A', source: text(master.source, 60) || 'ai_pattern_structure', taxonomy: master.taxonomy && typeof master.taxonomy === 'object' ? master.taxonomy : {},
    tags: Array.isArray(master.tags) ? master.tags.map((item) => text(item, 40)).filter(Boolean).slice(0, 12) : [],
    linkedAssetIds: Array.isArray(master.linkedAssetIds) ? master.linkedAssetIds.map((item) => text(item, 100)).filter(Boolean).slice(0, 30) : [],
    factoryReady: false, productionAvailable: false, industrialStatus: 'not_implemented', sampleValidationStatus: 'not_started'
  }
}

function sanitizeVersion(version, patternId, ctx) {
  return {
    versionId: text(version.versionId, 100), patternMasterId: patternId, enterpriseId: ctx.enterpriseId, versionNo: text(version.versionNo, 30) || 'V1',
    status: 'under_review', reviewStatus: 'under_review', assetIds: Array.isArray(version.assetIds) ? version.assetIds.map((item) => text(item, 100)).filter(Boolean).slice(0, 30) : [],
    requestedOutputs: Array.isArray(version.requestedOutputs) ? version.requestedOutputs.slice(0, 20) : [], generatedOutputs: Array.isArray(version.generatedOutputs) ? version.generatedOutputs.slice(0, 20) : [],
    sizeParams: version.sizeParams && typeof version.sizeParams === 'object' ? version.sizeParams : {}, craftNote: text(version.craftNote, 1000),
    aiDraft: version.aiDraft && typeof version.aiDraft === 'object' ? version.aiDraft : {}, historyId: text(version.historyId, 100),
    batchId: text(version.batchId, 100), taskIds: Array.isArray(version.taskIds) ? version.taskIds.map((item) => text(item, 100)).filter(Boolean).slice(0, 30) : [],
    productionAvailable: false, factoryReady: false, sampleValidationStatus: 'not_started'
  }
}

async function upsert(collection, where, data) {
  const existing = await one(collection, where)
  if (existing) await db.collection(collection).where(where).update({ data })
  else await db.collection(collection).add({ data })
}

async function addReview(ctx, patternId, versionId, action, fromStatus, toStatus, notes = '') {
  await db.collection(COLLECTIONS.reviews).add({ data: {
    reviewId: id('pattern_review'), enterpriseId: ctx.enterpriseId, patternMasterId: patternId, versionId,
    reviewerMemberId: ctx.memberId, reviewerRole: ctx.role, action, fromStatus, toStatus, notes: text(notes, 1000), createdAt: nowIso()
  } })
}

function sanitizeSummary(master, version) {
  return {
    patternId: master.patternMasterId, versionId: version.versionId, title: master.title, category: master.category,
    versionNo: version.versionNo, reviewStatus: version.reviewStatus, assignedReviewerMemberId: version.assignedReviewerMemberId || '',
    updatedAt: version.updatedAt || master.updatedAt, productionAvailable: false, sampleValidationStatus: 'not_started'
  }
}

async function loadPattern(ctx, data, allowOwner = true) {
  const patternId = text(data.patternId || data.patternMasterId, 100)
  const versionId = text(data.versionId, 100)
  if (!patternId) throw error('INVALID_PARAMS', '缺少版型标识。')
  const master = await one(COLLECTIONS.masters, { enterpriseId: ctx.enterpriseId, patternMasterId: patternId })
  if (!master) throw error('NOT_FOUND', '版型不存在或无权访问。')
  const memberPermissions = await permissions(ctx)
  const canView = memberPermissions.includes('pattern_making.view')
  const reviewer = REVIEW_ROLES.includes(ctx.role) && canView
  const owner = master.ownerMemberId === ctx.memberId || master.ownerUserId === ctx.userId
  if (!(canView || (allowOwner && owner))) throw error('FORBIDDEN', '无权访问该版型。')
  const version = versionId
    ? await one(COLLECTIONS.versions, { enterpriseId: ctx.enterpriseId, patternMasterId: patternId, versionId })
    : await one(COLLECTIONS.versions, { enterpriseId: ctx.enterpriseId, patternMasterId: patternId, versionId: master.currentVersionId })
  if (!version) throw error('VERSION_NOT_FOUND', '版型版本不存在。')
  if (reviewer && version.assignedReviewerMemberId && version.assignedReviewerMemberId !== ctx.memberId && ctx.role !== 'admin') {
    throw error('REVIEW_ASSIGNED_TO_OTHER', '该版型已分配给其他复核人员。')
  }
  return { master, version, reviewer, owner }
}

async function submit(ctx, data) {
  const masterInput = data.master || {}; const versionInput = data.version || {}
  const patternId = text(masterInput.patternMasterId, 100); let versionId = text(versionInput.versionId, 100)
  if (!patternId || !versionId) return fail('invalid_params', 'INVALID_PARAMS', '版型主档或版本标识缺失。')
  const existingMaster = await one(COLLECTIONS.masters, { enterpriseId: ctx.enterpriseId, patternMasterId: patternId })
  if (existingMaster && existingMaster.ownerMemberId !== ctx.memberId && existingMaster.ownerUserId !== ctx.userId) return fail('forbidden', 'FORBIDDEN', '只能提交自己的版型。')
  const existingVersion = await one(COLLECTIONS.versions, { enterpriseId: ctx.enterpriseId, versionId })
  if (existingVersion && !['draft', 'ai_generated', 'changes_requested'].includes(existingVersion.reviewStatus)) return fail('invalid_state', 'INVALID_STATE_TRANSITION', '当前版本不能重复提交复核。')
  const hasGeneratedAsset = (Array.isArray(masterInput.linkedAssetIds) && masterInput.linkedAssetIds.length)
    || (Array.isArray(versionInput.assetIds) && versionInput.assetIds.length)
    || (Array.isArray(versionInput.generatedOutputs) && versionInput.generatedOutputs.length)
  if (!hasGeneratedAsset) return fail('invalid_params', 'PATTERN_OUTPUT_REQUIRED', '当前版本还没有可复核的结构图或结果资产。')
  const resubmitting = existingVersion && existingVersion.reviewStatus === 'changes_requested'
  let versionNo = text(versionInput.versionNo, 30) || 'V1'
  if (resubmitting) {
    const versionsResult = await db.collection(COLLECTIONS.versions).where({ enterpriseId: ctx.enterpriseId, patternMasterId: patternId }).limit(100).get()
    versionId = id('pattern_version')
    versionNo = `V${(versionsResult.data || []).length + 1}`
  }
  const now = nowIso(); const master = { ...sanitizeMaster(masterInput, ctx), currentVersionId: versionId, reviewStatus: 'under_review', updatedAt: now, createdAt: existingMaster ? existingMaster.createdAt : now }
  const version = { ...sanitizeVersion({ ...versionInput, versionId, versionNo }, patternId, ctx), parentVersionId: resubmitting ? existingVersion.versionId : text(versionInput.parentVersionId, 100), submittedByMemberId: ctx.memberId, submittedAt: now, updatedAt: now, createdAt: resubmitting ? now : (existingVersion ? existingVersion.createdAt : now) }
  await upsert(COLLECTIONS.masters, { enterpriseId: ctx.enterpriseId, patternMasterId: patternId }, master)
  await upsert(COLLECTIONS.versions, { enterpriseId: ctx.enterpriseId, versionId }, version)
  const parts = (Array.isArray(data.parts) ? data.parts : []).slice(0, 100).map((item) => ({ ...cleanPart(item, patternId, versionId, ctx.enterpriseId), patternPartId: resubmitting ? id('pattern_part') : (text(item.patternPartId, 100) || id('pattern_part')), createdAt: now, updatedAt: now }))
  const sizes = (Array.isArray(data.sizeSpecs) ? data.sizeSpecs : []).slice(0, 20).map((item) => ({ ...cleanSize(item, patternId, versionId, ctx.enterpriseId), sizeSpecId: resubmitting ? id('pattern_size') : (text(item.sizeSpecId, 100) || id('pattern_size')), createdAt: now, updatedAt: now }))
  for (const part of parts) await upsert(COLLECTIONS.parts, { enterpriseId: ctx.enterpriseId, patternPartId: part.patternPartId }, part)
  for (const spec of sizes) await upsert(COLLECTIONS.sizes, { enterpriseId: ctx.enterpriseId, sizeSpecId: spec.sizeSpecId }, spec)
  await addReview(ctx, patternId, versionId, resubmitting ? 'resubmit_revision' : 'submit', existingVersion ? existingVersion.reviewStatus : 'ai_generated', 'under_review')
  return ok({ pattern: sanitizeSummary(master, version), parentVersionId: resubmitting ? existingVersion.versionId : '' }, resubmitting ? 'revision_submitted' : 'under_review')
}

async function queue(ctx, data) {
  await requireReviewAccess(ctx, 'pattern_making.view')
  const status = STATES.includes(data.status) ? data.status : 'under_review'
  const result = await db.collection(COLLECTIONS.versions).where({ enterpriseId: ctx.enterpriseId, reviewStatus: status }).limit(50).get()
  const items = []
  for (const raw of result.data || []) {
    const version = normalizeDoc(raw)
    if (version.assignedReviewerMemberId && version.assignedReviewerMemberId !== ctx.memberId && ctx.role !== 'admin') continue
    const master = await one(COLLECTIONS.masters, { enterpriseId: ctx.enterpriseId, patternMasterId: version.patternMasterId })
    if (master) items.push(sanitizeSummary(master, version))
  }
  items.sort((a, b) => String(a.updatedAt).localeCompare(String(b.updatedAt)))
  return ok({ items, role: ctx.role, canApprove: APPROVE_ROLES.includes(ctx.role) }, 'success')
}

async function get(ctx, data) {
  const { master, version, reviewer, owner } = await loadPattern(ctx, data, true)
  const partsResult = await db.collection(COLLECTIONS.parts).where({ enterpriseId: ctx.enterpriseId, patternMasterId: master.patternMasterId, versionId: version.versionId }).limit(100).get()
  const sizesResult = await db.collection(COLLECTIONS.sizes).where({ enterpriseId: ctx.enterpriseId, patternMasterId: master.patternMasterId, versionId: version.versionId }).limit(20).get()
  const reviewsResult = await db.collection(COLLECTIONS.reviews).where({ enterpriseId: ctx.enterpriseId, patternMasterId: master.patternMasterId }).limit(100).get()
  const canOperate = reviewer && (!version.assignedReviewerMemberId || version.assignedReviewerMemberId === ctx.memberId || ctx.role === 'admin')
  return ok({
    master: normalizeDoc(master), version: normalizeDoc(version), parts: (partsResult.data || []).map(normalizeDoc), sizes: (sizesResult.data || []).map(normalizeDoc),
    reviews: (reviewsResult.data || []).map(normalizeDoc).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))),
    access: { owner, reviewer, canClaim: canOperate && !version.assignedReviewerMemberId, canRevise: canOperate && version.reviewStatus === 'under_review', canRequestChanges: canOperate && ['under_review', 'reviewed'].includes(version.reviewStatus), canMarkReviewed: canOperate && version.reviewStatus === 'under_review', canApprove: canOperate && APPROVE_ROLES.includes(ctx.role) && version.reviewStatus === 'reviewed' }
  })
}

async function claim(ctx, data) {
  await requireReviewAccess(ctx, 'pattern_making.view')
  const { master, version } = await loadPattern(ctx, data, false)
  if (version.reviewStatus !== 'under_review') return fail('invalid_state', 'INVALID_STATE_TRANSITION', '仅复核中的版本可以认领。')
  if (version.assignedReviewerMemberId && version.assignedReviewerMemberId !== ctx.memberId) return fail('conflict', 'REVIEW_ASSIGNED_TO_OTHER', '该版型已被其他复核人员认领。')
  const now = nowIso(); await db.collection(COLLECTIONS.versions).where({ enterpriseId: ctx.enterpriseId, versionId: version.versionId }).update({ data: { assignedReviewerMemberId: ctx.memberId, assignedAt: version.assignedAt || now, updatedAt: now } })
  await addReview(ctx, master.patternMasterId, version.versionId, 'claim', version.reviewStatus, version.reviewStatus)
  return ok({ assigned: true }, 'claimed')
}

async function saveRevision(ctx, data) {
  await requireReviewAccess(ctx, 'pattern_making.edit')
  const { master, version } = await loadPattern(ctx, data, false)
  if (version.reviewStatus !== 'under_review') return fail('invalid_state', 'INVALID_STATE_TRANSITION', '当前版本不能创建复核修订。')
  const partsInput = Array.isArray(data.parts) ? data.parts : []; const sizesInput = Array.isArray(data.sizes) ? data.sizes : []
  const notes = text(data.notes, 1000)
  if (!partsInput.length && !sizesInput.length && !notes) return fail('invalid_params', 'REVISION_EMPTY', '请至少填写一项尺寸、部件修订或复核说明。')
  const versionsResult = await db.collection(COLLECTIONS.versions).where({ enterpriseId: ctx.enterpriseId, patternMasterId: master.patternMasterId }).limit(100).get()
  const newVersionId = id('pattern_version'); const now = nowIso(); const nextNo = `V${(versionsResult.data || []).length + 1}`
  const nextVersion = { ...version, id: undefined, _id: undefined, versionId: newVersionId, versionNo: nextNo, parentVersionId: version.versionId, status: 'under_review', reviewStatus: 'under_review', reviewerId: ctx.memberId, reviewNotes: notes, productionAvailable: false, factoryReady: false, sampleValidationStatus: 'not_started', createdAt: now, updatedAt: now }
  delete nextVersion.id
  await db.collection(COLLECTIONS.versions).add({ data: nextVersion })
  const oldParts = await db.collection(COLLECTIONS.parts).where({ enterpriseId: ctx.enterpriseId, versionId: version.versionId }).limit(100).get()
  const oldSizes = await db.collection(COLLECTIONS.sizes).where({ enterpriseId: ctx.enterpriseId, versionId: version.versionId }).limit(20).get()
  const parts = (partsInput.length ? partsInput : oldParts.data || []).slice(0, 100).map((item) => ({ ...cleanPart(item, master.patternMasterId, newVersionId, ctx.enterpriseId), patternPartId: id('pattern_part'), reviewerId: ctx.memberId, createdAt: now, updatedAt: now }))
  const sizes = (sizesInput.length ? sizesInput : oldSizes.data || []).slice(0, 20).map((item) => ({ ...cleanSize(item, master.patternMasterId, newVersionId, ctx.enterpriseId), sizeSpecId: id('pattern_size'), reviewerId: ctx.memberId, createdAt: now, updatedAt: now }))
  for (const part of parts) await db.collection(COLLECTIONS.parts).add({ data: part })
  for (const spec of sizes) await db.collection(COLLECTIONS.sizes).add({ data: spec })
  const revisionDiff = buildRevisionDiff(version, nextVersion, oldParts.data || [], parts, oldSizes.data || [], sizes)
  const revisionDiffId = id('pattern_revision_diff')
  await db.collection(COLLECTIONS.revisionDiffs).add({ data: {
    revisionDiffId, enterpriseId: ctx.enterpriseId, patternMasterId: master.patternMasterId,
    fromVersionId: version.versionId, toVersionId: newVersionId, reviewerMemberId: ctx.memberId,
    ...revisionDiff, createdAt: now
  } })
  await db.collection(COLLECTIONS.masters).where({ enterpriseId: ctx.enterpriseId, patternMasterId: master.patternMasterId }).update({ data: { currentVersionId: newVersionId, reviewStatus: 'under_review', updatedAt: now } })
  await addReview(ctx, master.patternMasterId, newVersionId, 'save_revision', version.reviewStatus, 'under_review', notes)
  return ok({ pattern: sanitizeSummary(master, nextVersion), parentVersionId: version.versionId, revisionDiffId, changeCount: revisionDiff.changeCount }, 'revision_created')
}

async function transition(ctx, data, action, allowedFrom, toStatus, permission) {
  await requireReviewAccess(ctx, permission)
  const { master, version } = await loadPattern(ctx, data, false)
  if (!allowedFrom.includes(version.reviewStatus) || !canTransition(version.reviewStatus, toStatus)) return fail('invalid_state', 'INVALID_STATE_TRANSITION', `当前状态不能执行${action === 'approve' ? '批准' : '该操作'}。`)
  const notes = text(data.notes, 1000)
  if (action === 'request_changes' && !notes) return fail('invalid_params', 'REVIEW_NOTES_REQUIRED', '退回修改时必须填写具体审核意见。')
  if (action === 'mark_reviewed') {
    if (data.dimensionsChecked !== true || data.partsChecked !== true) return fail('invalid_params', 'REVIEW_CHECKLIST_INCOMPLETE', '请先完成尺寸和纸样部件复核。')
    const partsResult = await db.collection(COLLECTIONS.parts).where({ enterpriseId: ctx.enterpriseId, versionId: version.versionId }).limit(100).get()
    const sizesResult = await db.collection(COLLECTIONS.sizes).where({ enterpriseId: ctx.enterpriseId, versionId: version.versionId }).limit(20).get()
    const hasParts = (partsResult.data || []).length > 0
    const hasMeasuredValue = (sizesResult.data || []).some((item) => item.values && Object.keys(item.values).some((key) => Number.isFinite(Number(item.values[key])) && Number(item.values[key]) > 0))
    if (!hasParts || !hasMeasuredValue) return fail('invalid_params', 'REVIEW_DATA_INCOMPLETE', '当前版本缺少可核验的尺寸值或纸样部件。')
    await db.collection(COLLECTIONS.parts).where({ enterpriseId: ctx.enterpriseId, versionId: version.versionId }).update({ data: { reviewStatus: 'reviewed', reviewerId: ctx.memberId, updatedAt: nowIso() } })
    await db.collection(COLLECTIONS.sizes).where({ enterpriseId: ctx.enterpriseId, versionId: version.versionId }).update({ data: { reviewStatus: 'reviewed', reviewerId: ctx.memberId, updatedAt: nowIso() } })
  }
  const now = nowIso(); const patch = { status: toStatus, reviewStatus: toStatus, reviewerId: ctx.memberId, reviewNotes: notes, reviewedAt: action === 'mark_reviewed' ? now : version.reviewedAt || '', approvedAt: action === 'approve' ? now : version.approvedAt || '', ...approvedSafetyState(), updatedAt: now }
  await db.collection(COLLECTIONS.versions).where({ enterpriseId: ctx.enterpriseId, versionId: version.versionId }).update({ data: patch })
  const masterPatch = { reviewStatus: toStatus, updatedAt: now, productionAvailable: false, factoryReady: false, sampleValidationStatus: 'not_started' }
  if (action === 'approve') masterPatch.approvedVersionId = version.versionId
  await db.collection(COLLECTIONS.masters).where({ enterpriseId: ctx.enterpriseId, patternMasterId: master.patternMasterId }).update({ data: masterPatch })
  await addReview(ctx, master.patternMasterId, version.versionId, action, version.reviewStatus, toStatus, notes)
  return ok({ pattern: sanitizeSummary({ ...master, ...masterPatch }, { ...version, ...patch }), productionNotice: '已批准版本仍需样衣验证，不可直接用于生产。' }, toStatus)
}

async function archive(ctx, data) {
  if (ctx.role !== 'admin') return fail('forbidden', 'FORBIDDEN', '仅管理员可以归档已批准版本。')
  const { master, version } = await loadPattern(ctx, data, false)
  if (version.reviewStatus !== 'approved') return fail('invalid_state', 'INVALID_STATE_TRANSITION', '仅已批准版本可以归档。')
  const now = nowIso()
  await db.collection(COLLECTIONS.versions).where({ enterpriseId: ctx.enterpriseId, versionId: version.versionId }).update({ data: { status: 'archived', reviewStatus: 'archived', productionAvailable: false, updatedAt: now } })
  await db.collection(COLLECTIONS.masters).where({ enterpriseId: ctx.enterpriseId, patternMasterId: master.patternMasterId }).update({ data: { reviewStatus: 'archived', archived: true, productionAvailable: false, updatedAt: now } })
  await addReview(ctx, master.patternMasterId, version.versionId, 'archive', 'approved', 'archived', text(data.notes, 1000))
  return ok({ archived: true, approvedVersionId: master.approvedVersionId || version.versionId }, 'archived')
}

function safeLibraryMaster(master = {}) {
  const { ownerMemberId, ownerUserId, derivedPatternIds, derivationKeyHash, ...safe } = master
  return safe
}

function safeLibraryVersion(version = {}) {
  const { assignedReviewerMemberId, reviewerId, submittedByMemberId, ...safe } = version
  return safe
}

const CATEGORY_LABELS = Object.freeze({ tshirt: 'T恤', shirt: '衬衫', dress: '连衣裙', skirt: '半身裙', pants: '裤装', coat: '外套' })
function categoryLabel(value = '') { return CATEGORY_LABELS[value] || text(value, 60) || '其他' }

function resolvePatternCover(master = {}, version = {}) {
  const draft = version.aiDraft && typeof version.aiDraft === 'object' ? version.aiDraft : {}
  const sourceImages = draft.sourceImages && typeof draft.sourceImages === 'object' ? draft.sourceImages : {}
  return text(sourceImages.frontImage || sourceImages.structureSketch || master.coverUrl, 500)
}

async function loadLibraryVersion(master = {}) {
  const versionId = master.reviewStatus === 'approved' && master.approvedVersionId ? master.approvedVersionId : master.currentVersionId
  return versionId ? one(COLLECTIONS.versions, { enterpriseId: master.enterpriseId, patternMasterId: master.patternMasterId, versionId }) : null
}

async function collectSearchMasters(ctx, request) {
  const statuses = request.status === 'quality' ? QUALITY_STATUSES : [request.status]
  const base = { enterpriseId: ctx.enterpriseId, scope: request.scope, reviewStatus: command.in(statuses) }
  if (request.garmentCategory) base.category = request.garmentCategory
  if (request.scope === 'enterprise') {
    await requireLibraryPermission(ctx, 'pattern_library.view')
    return many(COLLECTIONS.masters, base, 60)
  }
  const byMember = await many(COLLECTIONS.masters, { ...base, ownerMemberId: ctx.memberId }, 60)
  const byUser = ctx.userId ? await many(COLLECTIONS.masters, { ...base, ownerUserId: ctx.userId }, 60) : []
  const unique = new Map([...byMember, ...byUser].map((item) => [item.patternMasterId, item]))
  return [...unique.values()].sort((left, right) => String(right.updatedAt || '').localeCompare(String(left.updatedAt || ''))).slice(0, 60)
}

async function searchLibrary(ctx, data) {
  await requireLibraryPermission(ctx, 'pattern_library.view')
  const request = normalizePatternSearchRequest(data)
  let masters
  try { masters = await collectSearchMasters(ctx, request) } catch (cause) {
    if (/index|索引/i.test(String(cause.message || ''))) return fail('configuration_required', 'PATTERN_SEARCH_INDEX_REQUIRED', '版型检索索引尚未配置，请联系管理员。')
    throw cause
  }
  const ranked = []
  for (const master of masters) {
    if (master.archived || !await canAccessLibraryPattern(ctx, master)) continue
    const version = await loadLibraryVersion(master)
    if (!version || !QUALITY_STATUSES.includes(version.reviewStatus)) continue
    if (master.reviewStatus === 'approved' && master.approvedVersionId !== version.versionId) continue
    const sizeResult = await db.collection(COLLECTIONS.sizes).where({ enterpriseId: ctx.enterpriseId, patternMasterId: master.patternMasterId, versionId: version.versionId }).limit(20).get()
    const sizes = (sizeResult.data || []).map(normalizeDoc)
    const match = scorePatternCandidate(request, master, version, sizes)
    ranked.push({
      patternId: master.patternMasterId, title: master.title || '未命名版型', patternCode: master.patternCode || '',
      category: master.category || (master.taxonomy || {}).garmentCategory || '', categoryLabel: categoryLabel(master.category || (master.taxonomy || {}).garmentCategory), currentVersion: version.versionNo || 'V1', versionId: version.versionId,
      baseSize: match.profile.baseSize || '未设置', status: version.reviewStatus, statusLabel: version.reviewStatus === 'approved' ? '已批准' : '已复核（次级候选）',
      tags: Array.isArray(master.tags) ? master.tags.slice(0, 4) : [], taxonomy: master.taxonomy || {}, coverUrl: resolvePatternCover(master, version),
      updatedAt: version.updatedAt || master.updatedAt || '', matchScore: match.score, matchReasons: match.reasons.length ? match.reasons : ['当前条件较少，按质量状态和更新时间推荐'],
      differences: match.differences, canDerive: version.reviewStatus === 'approved' && master.approvedVersionId === version.versionId,
      sourceMode: 'cloud', qualityNotice: version.reviewStatus === 'reviewed' ? '该版型已复核但尚未批准，仅作为次级参考。' : ''
    })
  }
  ranked.sort((left, right) => right.matchScore - left.matchScore || Number(right.status === 'approved') - Number(left.status === 'approved') || String(right.updatedAt).localeCompare(String(left.updatedAt)))
  const start = (request.page - 1) * request.pageSize; const items = ranked.slice(start, start + request.pageSize)
  return ok({ request, items, total: ranked.length, page: request.page, pageSize: request.pageSize, hasMore: start + request.pageSize < ranked.length, candidateWindowLimited: masters.length >= 60, scopes: [{ value: 'personal', label: '我的已批准版型' }, { value: 'enterprise', label: '企业已批准版型' }] }, 'success')
}

async function libraryGet(ctx, data) {
  await requireLibraryPermission(ctx, 'pattern_library.view')
  const patternId = text(data.patternId || data.patternMasterId, 100)
  const master = await one(COLLECTIONS.masters, { enterpriseId: ctx.enterpriseId, patternMasterId: patternId })
  if (!master || !await canAccessLibraryPattern(ctx, master)) return fail('not_found', 'PATTERN_NOT_FOUND', '版型不存在或无权访问。')
  const versionsResult = await db.collection(COLLECTIONS.versions).where({ enterpriseId: ctx.enterpriseId, patternMasterId: patternId }).limit(100).get()
  const versions = (versionsResult.data || []).map(normalizeDoc).sort((left, right) => String(right.createdAt || '').localeCompare(String(left.createdAt || '')))
  const requestedVersionId = text(data.versionId, 100); const version = versions.find((item) => item.versionId === requestedVersionId) || versions.find((item) => item.versionId === master.currentVersionId) || versions[0]
  if (!version) return fail('not_found', 'VERSION_NOT_FOUND', '版型版本不存在。')
  const [partsResult, sizesResult] = await Promise.all([
    db.collection(COLLECTIONS.parts).where({ enterpriseId: ctx.enterpriseId, patternMasterId: patternId, versionId: version.versionId }).limit(100).get(),
    db.collection(COLLECTIONS.sizes).where({ enterpriseId: ctx.enterpriseId, patternMasterId: patternId, versionId: version.versionId }).limit(20).get()
  ])
  const status = version.reviewStatus || master.reviewStatus || 'draft'; const size = (sizesResult.data || [])[0] || {}
  return ok({
    card: { patternId, title: master.title || '未命名版型', patternCode: master.patternCode || '', category: master.category || '', categoryLabel: categoryLabel(master.category), currentVersion: version.versionNo || 'V1', baseSize: size.baseSize || (version.sizeParams || {}).baseSize || '未设置', status, statusLabel: status === 'approved' ? '已批准' : (status === 'reviewed' ? '已复核' : '草稿'), tags: master.tags || [], taxonomy: master.taxonomy || {}, coverUrl: resolvePatternCover(master, version), updatedAt: version.updatedAt || master.updatedAt || '' },
    master: safeLibraryMaster(master), currentVersion: safeLibraryVersion(version), versions: versions.map(safeLibraryVersion),
    parts: (partsResult.data || []).map(normalizeDoc), sizeSpecs: (sizesResult.data || []).map(normalizeDoc),
    canEdit: ownsPattern(ctx, master) && !['approved', 'archived'].includes(status), canCreate: (await permissions(ctx)).includes('pattern_library.create'), sourceMode: 'cloud'
  }, 'success')
}

function applyTaxonomyChanges(base = {}, changes = {}) {
  const output = { ...(base && typeof base === 'object' ? base : {}) }
  ;['garmentCategory', 'audience', 'season', 'style', 'fitType', 'neckType', 'sleeveType', 'lengthType'].forEach((key) => { if (text(changes[key], 60)) output[key] = text(changes[key], 60) })
  if (Array.isArray(changes.materialCompatibility)) output.materialCompatibility = changes.materialCompatibility.map((item) => text(item, 60)).filter(Boolean).slice(0, 20)
  if (Array.isArray(changes.usageScene)) output.usageScene = changes.usageScene.map((item) => text(item, 60)).filter(Boolean).slice(0, 20)
  return output
}

async function deriveApproved(ctx, data) {
  await requireLibraryPermission(ctx, 'pattern_library.create')
  const sourcePatternId = text(data.patternId || data.patternMasterId, 100); const source = await one(COLLECTIONS.masters, { enterpriseId: ctx.enterpriseId, patternMasterId: sourcePatternId })
  if (!source || !await canAccessLibraryPattern(ctx, source)) return fail('not_found', 'PATTERN_NOT_FOUND', '基础版型不存在或无权访问。')
  if (source.reviewStatus !== 'approved' || !source.approvedVersionId) return fail('invalid_state', 'APPROVED_PATTERN_REQUIRED', '只能从当前已批准版型派生新款。')
  const sourceVersion = await one(COLLECTIONS.versions, { enterpriseId: ctx.enterpriseId, patternMasterId: sourcePatternId, versionId: source.approvedVersionId })
  if (!sourceVersion || sourceVersion.reviewStatus !== 'approved') return fail('invalid_state', 'APPROVED_PATTERN_REQUIRED', '批准版本不存在或状态已变化。')
  const idempotencyKey = text(data.idempotencyKey, 120)
  if (!idempotencyKey) return fail('invalid_params', 'IDEMPOTENCY_KEY_REQUIRED', '缺少派生请求标识，请重新操作。')
  const derivationKeyHash = hash(`${ctx.enterpriseId}:${ctx.memberId}:${sourceVersion.versionId}:${idempotencyKey}`)
  const existing = await one(COLLECTIONS.masters, { enterpriseId: ctx.enterpriseId, derivationKeyHash })
  if (existing && existing.derivationStatus === 'complete') return ok({ master: safeLibraryMaster(existing), existing: true }, 'existing_derivation')
  const at = nowIso(); const patternMasterId = `pattern_master_${derivationKeyHash.slice(0, 24)}`; const versionId = `pattern_version_${derivationKeyHash.slice(0, 24)}`; const changes = data.changes && typeof data.changes === 'object' ? data.changes : {}
  const lineageRootId = text(source.lineageRootId || source.parentPatternMasterId || source.patternMasterId, 100)
  const master = {
    ...source, _id: undefined, id: undefined, patternMasterId, enterpriseId: ctx.enterpriseId, ownerMemberId: ctx.memberId, ownerUserId: ctx.userId,
    patternCode: `${text(source.patternCode, 60) || 'PAT'}-D${String(Date.now()).slice(-4)}`, title: text(data.title, 120) || `${source.title || '版型'} 派生新款`,
    source: 'derived_from_approved', scope: 'personal', parentPatternMasterId: sourcePatternId, derivedFrom: { patternMasterId: sourcePatternId, versionId: sourceVersion.versionId }, lineageRootId,
    currentVersionId: versionId, approvedVersionId: '', reviewStatus: 'draft', archived: false, productionAvailable: false, factoryReady: false,
    sampleValidationStatus: 'not_started', taxonomy: applyTaxonomyChanges(source.taxonomy, changes),
    tags: [...new Set([...(source.tags || []), ...(Array.isArray(data.tags) ? data.tags : []), '派生新款'].map((item) => text(item, 40)).filter(Boolean))].slice(0, 12),
    derivedPatternIds: [], derivationKeyHash, derivationStatus: 'creating', createdAt: existing && existing.createdAt || at, updatedAt: at
  }
  delete master._id; delete master.id
  const version = {
    ...sourceVersion, _id: undefined, id: undefined, versionId, patternMasterId, enterpriseId: ctx.enterpriseId, versionNo: 'V1', status: 'draft', reviewStatus: 'draft',
    parentVersionId: '', sourceVersionId: sourceVersion.versionId, derivedFrom: { patternMasterId: sourcePatternId, versionId: sourceVersion.versionId },
    assignedReviewerMemberId: '', reviewerId: '', reviewedAt: '', approvedAt: '', productionAvailable: false, factoryReady: false, sampleValidationStatus: 'not_started',
    submittedByMemberId: '', submittedAt: '', reviewNotes: '', trainingCandidate: false,
    humanRevision: { note: '由批准版型派生，需重新复核。', updatedBy: '' }, diff: ['从批准版型派生新款'],
    derivationChanges: changes, derivationNote: text(data.note, 1000), createdAt: at, updatedAt: at
  }
  delete version._id; delete version.id
  await db.collection(COLLECTIONS.masters).doc(patternMasterId).set({ data: master }); await db.collection(COLLECTIONS.versions).doc(versionId).set({ data: version })
  const [partsResult, sizesResult] = await Promise.all([
    db.collection(COLLECTIONS.parts).where({ enterpriseId: ctx.enterpriseId, patternMasterId: sourcePatternId, versionId: sourceVersion.versionId }).limit(100).get(),
    db.collection(COLLECTIONS.sizes).where({ enterpriseId: ctx.enterpriseId, patternMasterId: sourcePatternId, versionId: sourceVersion.versionId }).limit(20).get()
  ])
  for (const [index, item] of (partsResult.data || []).entries()) { const patternPartId = `pattern_part_${hash(`${versionId}:${item.patternPartId || index}`).slice(0, 24)}`; const part = { ...normalizeDoc(item), _id: undefined, id: undefined, patternPartId, patternMasterId, versionId, enterpriseId: ctx.enterpriseId, reviewStatus: 'draft', sourcePatternPartId: item.patternPartId, createdAt: at, updatedAt: at }; delete part._id; delete part.id; await db.collection(COLLECTIONS.parts).doc(patternPartId).set({ data: part }) }
  for (const [index, item] of (sizesResult.data || []).entries()) { const sizeSpecId = `pattern_size_${hash(`${versionId}:${item.sizeSpecId || index}`).slice(0, 24)}`; const spec = { ...normalizeDoc(item), _id: undefined, id: undefined, sizeSpecId, patternMasterId, versionId, enterpriseId: ctx.enterpriseId, reviewStatus: 'draft', sourceSizeSpecId: item.sizeSpecId, createdAt: at, updatedAt: at }; delete spec._id; delete spec.id; await db.collection(COLLECTIONS.sizes).doc(sizeSpecId).set({ data: spec }) }
  await db.collection(COLLECTIONS.masters).where({ enterpriseId: ctx.enterpriseId, patternMasterId: sourcePatternId }).update({ data: { derivedPatternIds: [...new Set([...(source.derivedPatternIds || []), patternMasterId])], updatedAt: at } })
  await db.collection(COLLECTIONS.masters).where({ enterpriseId: ctx.enterpriseId, patternMasterId }).update({ data: { derivationStatus: 'complete', updatedAt: at } })
  await addReview(ctx, patternMasterId, versionId, 'derive_approved', 'approved', 'draft', text(data.note, 1000))
  return ok({ master: safeLibraryMaster({ ...master, derivationStatus: 'complete' }), version: safeLibraryVersion(version), source: { patternMasterId: sourcePatternId, versionId: sourceVersion.versionId }, existing: false }, 'derived_created')
}

const ACTIONS = {
  submit,
  queue,
  get,
  claim,
  save_revision: saveRevision,
  request_changes: (ctx, data) => transition(ctx, data, 'request_changes', ['under_review', 'reviewed'], 'changes_requested', 'pattern_making.approve'),
  mark_reviewed: (ctx, data) => transition(ctx, data, 'mark_reviewed', ['under_review'], 'reviewed', 'pattern_making.approve'),
  approve: (ctx, data) => transition(ctx, data, 'approve', ['reviewed'], 'approved', 'pattern_making.approve'),
  archive,
  search_library: searchLibrary,
  library_get: libraryGet,
  derive_approved: deriveApproved
}

exports.main = async (event = {}) => {
  const startedAt = Date.now(); const action = text(event.action, 40); let success = false; let errorCode = ''
  try {
    if (!ACTIONS[action]) return fail('invalid_action', 'INVALID_ACTION', '未知复核操作。')
    const ctx = await requireContext(event.sessionToken)
    const result = await ACTIONS[action](ctx, event.data || {})
    success = Boolean(result && result.ok); errorCode = result && result.errorCode || ''
    return result
  } catch (cause) {
    errorCode = cause.errorCode || 'INTERNAL_ERROR'
    return fail(errorCode === 'FORBIDDEN' ? 'forbidden' : 'error', errorCode, cause.message || '版型复核操作失败。')
  } finally {
    console.log('[pattern-review]', { action, success, errorCode, durationMs: Date.now() - startedAt })
  }
}
