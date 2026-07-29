const cloud = require('wx-server-sdk')
const crypto = require('crypto')
const { STATUSES, canTransition, isTerminal, stableAsset } = require('./samplePolicy')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

const C = Object.freeze({
  sessions: 'enterprise_auth_sessions', members: 'enterprise_members', roles: 'enterprise_role_permissions',
  patterns: 'enterprise_pattern_masters', versions: 'enterprise_pattern_versions',
  orders: 'enterprise_sample_orders', rounds: 'enterprise_sample_rounds', issues: 'enterprise_sample_issues', events: 'enterprise_sample_events'
})
const DEFAULTS = Object.freeze({
  admin: ['sample.view', 'sample.create', 'sample.collaborate', 'sample.approve'],
  designer: ['sample.view', 'sample.create'], pattern_maker: ['sample.view', 'sample.create', 'sample.approve'],
  reviewer: ['sample.view', 'sample.approve'], operator: ['sample.view', 'sample.collaborate'], viewer: []
})

function now() { return new Date().toISOString() }
function id(prefix) { return `${prefix}_${Date.now()}_${crypto.randomBytes(6).toString('hex')}` }
function hash(value) { return crypto.createHash('sha256').update(String(value || '')).digest('hex') }
function text(value, max = 300) { return String(value || '').trim().slice(0, max) }
function ok(data = {}, status = 'success') { return { ok: true, success: true, status, errorCode: '', message: '', data } }
function fail(status, errorCode, message) { return { ok: false, success: false, status, errorCode, message, data: null } }
function err(errorCode, message) { return Object.assign(new Error(message), { errorCode }) }
function safeDoc(doc) { if (!doc) return null; const { _id, openId, openid, _openid, ...value } = doc; return { ...value, id: _id } }

async function one(collection, where) { const r = await db.collection(collection).where(where).limit(1).get(); return r.data && r.data.length ? safeDoc(r.data[0]) : null }

async function context(tokenValue) {
  const token = text(tokenValue, 1000)
  if (!token) throw err('AUTH_REQUIRED', '请先登录企业账号。')
  const session = await one(C.sessions, { sessionTokenHash: hash(token) })
  if (!session || session.status !== 'active') throw err('SESSION_INVALID', '登录状态无效。')
  if (session.expiresAt && new Date(session.expiresAt).getTime() <= Date.now()) throw err('SESSION_EXPIRED', '登录已过期。')
  const member = await one(C.members, { enterpriseId: session.enterpriseId, memberId: session.memberId })
  if (!member) throw err('MEMBER_NOT_FOUND', '企业成员不存在。')
  if (member.status !== 'active') throw err('MEMBER_INACTIVE', '当前成员状态不可用。')
  if (member.userId !== session.userId) throw err('TENANT_MISMATCH', '企业身份不匹配。')
  return { enterpriseId: session.enterpriseId, userId: session.userId, memberId: member.memberId, role: text(member.role, 60) }
}

async function permissions(ctx) {
  if (ctx.role === 'admin') return DEFAULTS.admin
  const record = await one(C.roles, { enterpriseId: ctx.enterpriseId, roleCode: ctx.role }) || await one(C.roles, { enterpriseId: ctx.enterpriseId, role: ctx.role })
  return record && Array.isArray(record.permissions) ? record.permissions.map(String) : (DEFAULTS[ctx.role] || [])
}
async function requirePermission(ctx, permission) { if (!(await permissions(ctx)).includes(permission)) throw err('FORBIDDEN', '当前企业角色无此样衣操作权限。') }

function cleanAssets(values, max = 12) { return Array.from(new Set((Array.isArray(values) ? values : []).map((v) => text(v, 500)).filter(stableAsset))).slice(0, max) }
function cleanMaterial(value = {}) { return { name: text(value.name, 80), composition: text(value.composition, 120), color: text(value.color, 60), weight: text(value.weight, 60), supplier: text(value.supplier, 100), lotNo: text(value.lotNo, 80), referenceAssetIds: cleanAssets(value.referenceAssetIds, 6) } }
function summary(order = {}) { return { sampleOrderId: order.sampleOrderId, sampleOrderNo: order.sampleOrderNo, patternMasterId: order.patternMasterId, patternVersionId: order.patternVersionId, patternTitle: order.patternTitle, patternVersionNo: order.patternVersionNo, projectId: order.projectId || '', orderId: order.orderId || '', factoryId: order.factoryId || '', factoryName: order.factoryName || '', status: order.status, currentRound: order.currentRound || 1, expectedAt: order.expectedAt || '', updatedAt: order.updatedAt, sampleValidationStatus: order.sampleValidationStatus || 'not_started' } }

async function event(ctx, order, action, fromStatus, toStatus, note = '') {
  await db.collection(C.events).add({ data: { eventId: id('sample_event'), enterpriseId: ctx.enterpriseId, sampleOrderId: order.sampleOrderId, action, fromStatus, toStatus, operatorMemberId: ctx.memberId, note: text(note, 800), createdAt: now() } })
}

async function load(ctx, data, permission = 'sample.view') {
  await requirePermission(ctx, permission)
  const sampleOrderId = text(data.sampleOrderId, 100)
  const order = await one(C.orders, { enterpriseId: ctx.enterpriseId, sampleOrderId })
  if (!order) throw err('NOT_FOUND', '样衣单不存在或无权访问。')
  const owner = order.ownerMemberId === ctx.memberId || order.createdByMemberId === ctx.memberId
  const perms = await permissions(ctx)
  const collaborator = perms.includes('sample.collaborate')
  const approver = perms.includes('sample.approve')
  if (!(owner || collaborator || approver || perms.includes('sample.view'))) throw err('FORBIDDEN', '无权访问该样衣单。')
  if (collaborator && order.assignedFactoryMemberId && order.assignedFactoryMemberId !== ctx.memberId && !approver) throw err('ASSIGNED_TO_OTHER', '该样衣单已由其他协作成员接单。')
  return { order, owner, collaborator, approver }
}

async function createDraft(ctx, data) {
  await requirePermission(ctx, 'sample.create')
  const patternMasterId = text(data.patternMasterId, 100); const patternVersionId = text(data.patternVersionId, 100)
  if (!patternMasterId || !patternVersionId) return fail('invalid_params', 'PATTERN_REQUIRED', '请选择已批准版型。')
  const master = await one(C.patterns, { enterpriseId: ctx.enterpriseId, patternMasterId })
  const version = await one(C.versions, { enterpriseId: ctx.enterpriseId, patternMasterId, versionId: patternVersionId })
  if (!master || !version) return fail('not_found', 'PATTERN_NOT_FOUND', '版型或版本不存在。')
  if (version.reviewStatus !== 'approved' || master.approvedVersionId !== patternVersionId) return fail('invalid_state', 'PATTERN_NOT_APPROVED', '只能基于当前已批准版型版本创建样衣单。')
  const key = text(data.idempotencyKey, 120)
  if (key) { const existing = await one(C.orders, { enterpriseId: ctx.enterpriseId, createdByMemberId: ctx.memberId, idempotencyKey: key }); if (existing) return ok({ order: summary(existing), idempotent: true }, existing.status) }
  const createdAt = now(); const sampleOrderId = id('sample_order'); const material = cleanMaterial(data.material)
  const order = {
    sampleOrderId, sampleOrderNo: `SMP-${String(Date.now()).slice(-10)}`, enterpriseId: ctx.enterpriseId,
    patternMasterId, patternVersionId, patternTitle: text(master.title, 120), patternVersionNo: text(version.versionNo, 30),
    ownerMemberId: master.ownerMemberId || ctx.memberId, createdByMemberId: ctx.memberId, projectId: text(data.projectId, 100), orderId: text(data.orderId, 100),
    factoryId: text(data.factoryId, 100), factoryName: text(data.factoryName, 120), factoryVerificationClaimed: false,
    material, expectedAt: text(data.expectedAt, 40), requirements: text(data.requirements, 1200), status: 'draft', currentRound: 1,
    sampleValidationStatus: 'not_started', assignedFactoryMemberId: '', idempotencyKey: key, productionOrderId: '', productionReady: false,
    createdAt, updatedAt: createdAt
  }
  await db.collection(C.orders).add({ data: order })
  await db.collection(C.rounds).add({ data: { sampleRoundId: id('sample_round'), sampleOrderId, enterpriseId: ctx.enterpriseId, roundNo: 1, status: 'draft', material, photoAssetIds: [], createdAt, updatedAt: createdAt } })
  await event(ctx, order, 'create_draft', '', 'draft')
  return ok({ order: summary(order) }, 'draft')
}

async function list(ctx, data) {
  await requirePermission(ctx, 'sample.view')
  const where = { enterpriseId: ctx.enterpriseId }; if (STATUSES.includes(data.status)) where.status = data.status
  const result = await db.collection(C.orders).where(where).limit(50).get()
  const items = (result.data || []).map(safeDoc).map(summary).sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))
  return ok({ items })
}

async function updateDraft(ctx, data) {
  const loaded = await load(ctx, data, 'sample.create'); const order = loaded.order
  if (!loaded.owner || order.status !== 'draft') return fail('invalid_state', 'DRAFT_NOT_EDITABLE', '当前样衣单不能继续编辑。')
  const patch = { factoryId: text(data.factoryId, 100), factoryName: text(data.factoryName, 120), material: cleanMaterial(data.material), expectedAt: text(data.expectedAt, 40), requirements: text(data.requirements, 1200), updatedAt: now() }
  await db.collection(C.orders).where({ enterpriseId: ctx.enterpriseId, sampleOrderId: order.sampleOrderId }).update({ data: patch })
  await db.collection(C.rounds).where({ enterpriseId: ctx.enterpriseId, sampleOrderId: order.sampleOrderId, roundNo: 1 }).update({ data: { material: patch.material, updatedAt: patch.updatedAt } })
  await event(ctx, order, 'update_draft', 'draft', 'draft')
  return ok({ order: summary({ ...order, ...patch }) }, 'draft')
}

async function get(ctx, data) {
  const loaded = await load(ctx, data)
  const rounds = await db.collection(C.rounds).where({ enterpriseId: ctx.enterpriseId, sampleOrderId: loaded.order.sampleOrderId }).limit(30).get()
  const issues = await db.collection(C.issues).where({ enterpriseId: ctx.enterpriseId, sampleOrderId: loaded.order.sampleOrderId }).limit(100).get()
  const events = await db.collection(C.events).where({ enterpriseId: ctx.enterpriseId, sampleOrderId: loaded.order.sampleOrderId }).limit(100).get()
  const perms = await permissions(ctx); const status = loaded.order.status
  return ok({ order: safeDoc(loaded.order), rounds: (rounds.data || []).map(safeDoc).sort((a, b) => b.roundNo - a.roundNo), issues: (issues.data || []).map(safeDoc), events: (events.data || []).map(safeDoc).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))), access: {
    canSubmit: loaded.owner && status === 'draft', canAccept: perms.includes('sample.collaborate') && status === 'pending_factory_acceptance',
    canStart: perms.includes('sample.collaborate') && ['pending_factory_acceptance', 'changes_requested'].includes(status), canUpload: perms.includes('sample.collaborate') && ['sampling', 'resampling'].includes(status),
    canSubmitReview: perms.includes('sample.collaborate') && status === 'sample_completed', canReview: perms.includes('sample.approve') && status === 'pending_review',
    canCancel: !isTerminal(status) && (loaded.owner || perms.includes('sample.approve'))
  } })
}

async function transition(ctx, data, action, from, to, permission) {
  const loaded = await load(ctx, data, permission)
  const order = loaded.order
  if (!from.includes(order.status) || !canTransition(order.status, to)) return fail('invalid_state', 'INVALID_STATE_TRANSITION', '当前状态不能执行该操作。')
  const patch = { status: to, updatedAt: now() }
  if (action === 'submit') {
    if (!order.factoryName && !order.factoryId) return fail('invalid_params', 'FACTORY_REQUIRED', '请填写或选择打样工厂。')
    if (!order.material || !order.material.name) return fail('invalid_params', 'MATERIAL_REQUIRED', '请填写主要面料。')
    patch.submittedAt = now(); patch.sampleValidationStatus = 'sampling_pending'
  }
  if (action === 'accept') { patch.assignedFactoryMemberId = ctx.memberId; patch.acceptedAt = now() }
  if (action === 'start_sampling') patch.startedAt = now()
  if (action === 'submit_review') { patch.reviewSubmittedAt = now(); patch.sampleValidationStatus = 'pending_review' }
  await db.collection(C.orders).where({ enterpriseId: ctx.enterpriseId, sampleOrderId: order.sampleOrderId }).update({ data: patch })
  if (action === 'accept' || action === 'submit_review') {
    await db.collection(C.rounds).where({ enterpriseId: ctx.enterpriseId, sampleOrderId: order.sampleOrderId, roundNo: order.currentRound }).update({ data: { status: to, updatedAt: now() } })
  }
  await event(ctx, order, action, order.status, to, data.note)
  return ok({ order: summary({ ...order, ...patch }) }, to)
}

async function completeSample(ctx, data) {
  const loaded = await load(ctx, data, 'sample.collaborate'); const order = loaded.order
  if (!['sampling', 'resampling'].includes(order.status) || !canTransition(order.status, 'sample_completed')) return fail('invalid_state', 'INVALID_STATE_TRANSITION', '当前状态不能提交样衣照片。')
  const photoAssetIds = cleanAssets(data.photoAssetIds, 12)
  if (!photoAssetIds.length || photoAssetIds.length !== (Array.isArray(data.photoAssetIds) ? data.photoAssetIds.length : 0)) return fail('invalid_params', 'SAMPLE_PHOTO_REQUIRED', '请先上传至少一张稳定的样衣照片。')
  const round = await one(C.rounds, { enterpriseId: ctx.enterpriseId, sampleOrderId: order.sampleOrderId, roundNo: order.currentRound })
  if (!round) throw err('ROUND_NOT_FOUND', '当前修改轮次不存在。')
  const updatedAt = now(); await db.collection(C.rounds).where({ enterpriseId: ctx.enterpriseId, sampleRoundId: round.sampleRoundId }).update({ data: { status: 'sample_completed', photoAssetIds, factoryNote: text(data.factoryNote, 1000), completedAt: updatedAt, updatedAt } })
  await db.collection(C.orders).where({ enterpriseId: ctx.enterpriseId, sampleOrderId: order.sampleOrderId }).update({ data: { status: 'sample_completed', latestPhotoAssetIds: photoAssetIds, updatedAt } })
  await event(ctx, order, 'complete_sample', order.status, 'sample_completed')
  return ok({ order: summary({ ...order, status: 'sample_completed', updatedAt }) }, 'sample_completed')
}

async function requestChanges(ctx, data) {
  const loaded = await load(ctx, data, 'sample.approve'); const order = loaded.order
  if (order.status !== 'pending_review' || !canTransition(order.status, 'changes_requested')) return fail('invalid_state', 'INVALID_STATE_TRANSITION', '当前样衣不在待验收状态。')
  const inputIssues = Array.isArray(data.issues) ? data.issues.slice(0, 30) : []
  if (!inputIssues.length || inputIssues.some((item) => !text(item.description, 600))) return fail('invalid_params', 'ISSUE_REQUIRED', '请至少填写一个具体修改问题。')
  const createdAt = now()
  for (const item of inputIssues) await db.collection(C.issues).add({ data: { issueId: id('sample_issue'), sampleOrderId: order.sampleOrderId, sampleRoundNo: order.currentRound, enterpriseId: ctx.enterpriseId, category: text(item.category, 60) || 'other', severity: ['low', 'medium', 'high'].includes(item.severity) ? item.severity : 'medium', location: text(item.location, 100), description: text(item.description, 600), photoAssetIds: cleanAssets(item.photoAssetIds, 6), status: 'open', createdByMemberId: ctx.memberId, createdAt, updatedAt: createdAt } })
  await db.collection(C.orders).where({ enterpriseId: ctx.enterpriseId, sampleOrderId: order.sampleOrderId }).update({ data: { status: 'changes_requested', sampleValidationStatus: 'changes_requested', updatedAt: createdAt } })
  await db.collection(C.rounds).where({ enterpriseId: ctx.enterpriseId, sampleOrderId: order.sampleOrderId, roundNo: order.currentRound }).update({ data: { status: 'changes_requested', updatedAt: createdAt } })
  await event(ctx, order, 'request_changes', 'pending_review', 'changes_requested', data.note)
  return ok({ order: summary({ ...order, status: 'changes_requested', updatedAt: createdAt }), issueCount: inputIssues.length }, 'changes_requested')
}

async function startResampling(ctx, data) {
  const loaded = await load(ctx, data, 'sample.collaborate'); const order = loaded.order
  if (order.status !== 'changes_requested' || !canTransition(order.status, 'resampling')) return fail('invalid_state', 'INVALID_STATE_TRANSITION', '当前样衣不需要再次打样。')
  const unresolved = await db.collection(C.issues).where({ enterpriseId: ctx.enterpriseId, sampleOrderId: order.sampleOrderId, status: 'open' }).limit(100).get()
  if (!(unresolved.data || []).length) return fail('invalid_state', 'OPEN_ISSUE_REQUIRED', '没有待处理的修改问题。')
  const roundNo = Number(order.currentRound || 1) + 1; const createdAt = now()
  await db.collection(C.rounds).add({ data: { sampleRoundId: id('sample_round'), sampleOrderId: order.sampleOrderId, enterpriseId: ctx.enterpriseId, roundNo, parentRoundNo: order.currentRound, status: 'resampling', material: cleanMaterial(data.material && data.material.name ? data.material : order.material), photoAssetIds: [], modificationNote: text(data.note, 1000), createdAt, updatedAt: createdAt } })
  await db.collection(C.orders).where({ enterpriseId: ctx.enterpriseId, sampleOrderId: order.sampleOrderId }).update({ data: { status: 'resampling', currentRound: roundNo, material: cleanMaterial(data.material && data.material.name ? data.material : order.material), updatedAt: createdAt } })
  await event(ctx, order, 'start_resampling', 'changes_requested', 'resampling', data.note)
  return ok({ order: summary({ ...order, status: 'resampling', currentRound: roundNo, updatedAt: createdAt }) }, 'resampling')
}

async function resolveIssue(ctx, data) {
  const loaded = await load(ctx, data, 'sample.collaborate'); const issueId = text(data.issueId, 100)
  const issue = await one(C.issues, { enterpriseId: ctx.enterpriseId, sampleOrderId: loaded.order.sampleOrderId, issueId })
  if (!issue) return fail('not_found', 'ISSUE_NOT_FOUND', '修改问题不存在。')
  if (issue.status === 'resolved') return ok({ resolved: true }, 'resolved')
  await db.collection(C.issues).where({ enterpriseId: ctx.enterpriseId, issueId }).update({ data: { status: 'resolved', resolutionNote: text(data.resolutionNote, 600), resolvedByMemberId: ctx.memberId, resolvedAt: now(), updatedAt: now() } })
  return ok({ resolved: true }, 'resolved')
}

async function confirm(ctx, data) {
  const loaded = await load(ctx, data, 'sample.approve'); const order = loaded.order
  if (order.status !== 'pending_review' || !canTransition(order.status, 'confirmed')) return fail('invalid_state', 'INVALID_STATE_TRANSITION', '当前样衣不在待验收状态。')
  const openIssues = await db.collection(C.issues).where({ enterpriseId: ctx.enterpriseId, sampleOrderId: order.sampleOrderId, status: 'open' }).limit(1).get()
  if ((openIssues.data || []).length) return fail('invalid_state', 'OPEN_ISSUES_EXIST', '仍有未关闭的修改问题，不能确认样衣。')
  const confirmedAt = now(); const patch = { status: 'confirmed', sampleValidationStatus: 'sample_confirmed', confirmedByMemberId: ctx.memberId, confirmedAt, productionReady: false, updatedAt: confirmedAt }
  await db.collection(C.orders).where({ enterpriseId: ctx.enterpriseId, sampleOrderId: order.sampleOrderId }).update({ data: patch })
  await db.collection(C.rounds).where({ enterpriseId: ctx.enterpriseId, sampleOrderId: order.sampleOrderId, roundNo: order.currentRound }).update({ data: { status: 'confirmed', confirmedAt, updatedAt: confirmedAt } })
  await db.collection(C.patterns).where({ enterpriseId: ctx.enterpriseId, patternMasterId: order.patternMasterId }).update({ data: { sampleValidationStatus: 'sample_confirmed', latestSampleOrderId: order.sampleOrderId, productionAvailable: false, factoryReady: false, updatedAt: confirmedAt } })
  await event(ctx, order, 'confirm', 'pending_review', 'confirmed', data.note)
  return ok({ order: summary({ ...order, ...patch }), productionNotice: '样衣已确认，但仍未自动创建生产订单。' }, 'confirmed')
}

async function cancel(ctx, data) {
  const loaded = await load(ctx, data); const order = loaded.order; const perms = await permissions(ctx)
  if (isTerminal(order.status) || !canTransition(order.status, 'cancelled')) return fail('invalid_state', 'INVALID_STATE_TRANSITION', '当前样衣单不能取消。')
  if (!(loaded.owner || perms.includes('sample.approve'))) return fail('forbidden', 'FORBIDDEN', '无权取消该样衣单。')
  const reason = text(data.reason, 500); if (!reason) return fail('invalid_params', 'CANCEL_REASON_REQUIRED', '请填写取消原因。')
  const cancelledAt = now(); await db.collection(C.orders).where({ enterpriseId: ctx.enterpriseId, sampleOrderId: order.sampleOrderId }).update({ data: { status: 'cancelled', cancelReason: reason, cancelledByMemberId: ctx.memberId, cancelledAt, updatedAt: cancelledAt } })
  await event(ctx, order, 'cancel', order.status, 'cancelled', reason)
  return ok({ order: summary({ ...order, status: 'cancelled', updatedAt: cancelledAt }) }, 'cancelled')
}

const ACTIONS = {
  create_draft: createDraft, update_draft: updateDraft, list, get,
  submit: (ctx, data) => transition(ctx, data, 'submit', ['draft'], 'pending_factory_acceptance', 'sample.create'),
  accept: (ctx, data) => transition(ctx, data, 'accept', ['pending_factory_acceptance'], 'sampling', 'sample.collaborate'),
  complete_sample: completeSample,
  submit_review: (ctx, data) => transition(ctx, data, 'submit_review', ['sample_completed'], 'pending_review', 'sample.collaborate'),
  request_changes: requestChanges, start_resampling: startResampling, resolve_issue: resolveIssue, confirm, cancel
}

exports.main = async (event = {}) => {
  const startedAt = Date.now(); const action = text(event.action, 40); let success = false; let errorCode = ''
  try {
    if (!ACTIONS[action]) return fail('invalid_action', 'INVALID_ACTION', '未知样衣操作。')
    const ctx = await context(event.sessionToken); const result = await ACTIONS[action](ctx, event.data || {})
    success = Boolean(result && result.ok); errorCode = result && result.errorCode || ''; return result
  } catch (cause) {
    errorCode = cause.errorCode || 'INTERNAL_ERROR'; return fail(errorCode === 'FORBIDDEN' ? 'forbidden' : 'error', errorCode, cause.message || '样衣操作失败。')
  } finally { console.log('[sample-workflow]', { action, success, errorCode, durationMs: Date.now() - startedAt }) }
}
