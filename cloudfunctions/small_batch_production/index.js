const cloud = require('wx-server-sdk')
const crypto = require('crypto')
const { STATUSES, canTransition, isTerminal, stableAsset } = require('./productionPolicy')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

const C = Object.freeze({
  sessions: 'enterprise_auth_sessions', members: 'enterprise_members', roles: 'enterprise_role_permissions',
  patterns: 'enterprise_pattern_masters', versions: 'enterprise_pattern_versions',
  samples: 'enterprise_sample_orders', sampleIssues: 'enterprise_sample_issues',
  orders: 'enterprise_small_batch_orders', quotes: 'enterprise_small_batch_quotes',
  progress: 'enterprise_small_batch_progress', quality: 'enterprise_small_batch_quality_checks',
  deliveries: 'enterprise_small_batch_deliveries', events: 'enterprise_small_batch_events'
})

const DEFAULTS = Object.freeze({
  admin: ['order.view', 'order.manage', 'factory.quote', 'factory.collaborate', 'delivery.approve'],
  designer: ['order.view'], project_owner: ['order.view', 'order.manage', 'factory.quote'],
  operator: ['order.view', 'factory.quote', 'factory.collaborate'],
  reviewer: ['order.view', 'delivery.approve'], delivery_specialist: ['order.view', 'delivery.approve'],
  finance: ['order.view'], viewer: []
})

function now() { return new Date().toISOString() }
function id(prefix) { return `${prefix}_${Date.now()}_${crypto.randomBytes(6).toString('hex')}` }
function hash(value) { return crypto.createHash('sha256').update(String(value || '')).digest('hex') }
function text(value, max = 300) { return String(value || '').trim().slice(0, max) }
function ok(data = {}, status = 'success') { return { ok: true, success: true, status, errorCode: '', message: '', data } }
function fail(status, errorCode, message) { return { ok: false, success: false, status, errorCode, message, data: null } }
function err(errorCode, message) { return Object.assign(new Error(message), { errorCode }) }
function safeDoc(doc) { if (!doc) return null; const { _id, openId, openid, _openid, ...value } = doc; return { ...value, id: _id } }
async function one(collection, where) { const result = await db.collection(collection).where(where).limit(1).get(); return result.data && result.data.length ? safeDoc(result.data[0]) : null }
async function many(collection, where, limit = 100) { const result = await db.collection(collection).where(where).limit(limit).get(); return (result.data || []).map(safeDoc) }

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
async function requirePermission(ctx, allowed) { const current = await permissions(ctx); if (!allowed.some((item) => current.includes(item))) throw err('FORBIDDEN', '当前企业角色无此生产操作权限。'); return current }

function cleanAssets(values, max = 12) { return Array.from(new Set((Array.isArray(values) ? values : []).map((value) => text(value, 500)).filter(stableAsset))).slice(0, max) }
function assetsValid(values, cleaned) { const raw = (Array.isArray(values) ? values : []).map((value) => text(value, 500)).filter(Boolean); return raw.length === cleaned.length }
function cleanSizes(values) {
  const seen = new Set()
  return (Array.isArray(values) ? values : []).slice(0, 30).map((item) => ({ size: text(item.size, 20), quantity: Math.max(0, Math.floor(Number(item.quantity) || 0)) })).filter((item) => item.size && item.quantity > 0 && !seen.has(item.size) && seen.add(item.size))
}
function cleanMaterials(value = {}) {
  return {
    mainFabric: text(value.mainFabric, 160), lining: text(value.lining, 160), accessories: text(value.accessories, 500),
    color: text(value.color, 80), supplier: text(value.supplier, 120), requirement: text(value.requirement, 1000),
    assetIds: cleanAssets(value.assetIds, 12)
  }
}
function totalQuantity(sizes = []) { return sizes.reduce((sum, item) => sum + Number(item.quantity || 0), 0) }
function summary(order = {}) { return { productionOrderId: order.productionOrderId, productionOrderNo: order.productionOrderNo, sampleOrderId: order.sampleOrderId, patternTitle: order.patternTitle, patternVersionNo: order.patternVersionNo, factoryId: order.factoryId || '', factoryName: order.factoryName || '', status: order.status, totalQuantity: order.totalQuantity || 0, currentQuoteId: order.currentQuoteId || '', promisedDeliveryAt: order.promisedDeliveryAt || '', deliveryRisk: order.deliveryRisk || 'none', updatedAt: order.updatedAt } }

async function event(ctx, order, action, fromStatus, toStatus, note = '') {
  await db.collection(C.events).add({ data: { eventId: id('production_event'), enterpriseId: ctx.enterpriseId, productionOrderId: order.productionOrderId, action, fromStatus, toStatus, operatorMemberId: ctx.memberId, note: text(note, 800), createdAt: now() } })
}

async function load(ctx, data, allowed = ['order.view']) {
  await requirePermission(ctx, allowed)
  const productionOrderId = text(data.productionOrderId, 100)
  const order = await one(C.orders, { enterpriseId: ctx.enterpriseId, productionOrderId })
  if (!order) throw err('NOT_FOUND', '小单生产单不存在或无权访问。')
  const perms = await permissions(ctx)
  if (order.assignedFactoryMemberId && perms.includes('factory.collaborate') && !perms.includes('order.manage') && order.assignedFactoryMemberId !== ctx.memberId) throw err('ASSIGNED_TO_OTHER', '该生产单已由其他工厂协作成员处理。')
  return { order, perms }
}

async function createDraft(ctx, data) {
  await requirePermission(ctx, ['order.manage'])
  const sampleOrderId = text(data.sampleOrderId, 100)
  const sample = await one(C.samples, { enterpriseId: ctx.enterpriseId, sampleOrderId })
  if (!sample) return fail('not_found', 'SAMPLE_NOT_FOUND', '已确认样衣单不存在。')
  if (sample.status !== 'confirmed' || sample.sampleValidationStatus !== 'sample_confirmed') return fail('invalid_state', 'SAMPLE_NOT_CONFIRMED', '只能基于已确认样衣创建小单生产单。')
  const master = await one(C.patterns, { enterpriseId: ctx.enterpriseId, patternMasterId: sample.patternMasterId })
  const version = await one(C.versions, { enterpriseId: ctx.enterpriseId, patternMasterId: sample.patternMasterId, versionId: sample.patternVersionId })
  if (!master || !version || version.reviewStatus !== 'approved' || master.approvedVersionId !== sample.patternVersionId) return fail('invalid_state', 'PATTERN_NOT_APPROVED', '样衣关联版型版本不是当前已批准版本。')
  const openIssues = await many(C.sampleIssues, { enterpriseId: ctx.enterpriseId, sampleOrderId, status: 'open' }, 1)
  if (openIssues.length) return fail('invalid_state', 'SAMPLE_BLOCKING_ISSUES', '样衣仍有未解决问题，不能创建生产单。')
  const sizes = cleanSizes(data.sizeBreakdown); const quantity = totalQuantity(sizes); const materials = cleanMaterials(data.materials)
  if (!data.sizesConfirmed || !sizes.length || quantity <= 0) return fail('invalid_params', 'SIZE_QUANTITY_REQUIRED', '请确认尺码和数量。')
  if (!data.materialsConfirmed || !materials.mainFabric) return fail('invalid_params', 'MATERIAL_REQUIRED', '请确认面辅料要求。')
  const craftRequirements = text(data.craftRequirements, 1500)
  if (!data.craftConfirmed || !craftRequirements) return fail('invalid_params', 'CRAFT_REQUIRED', '请确认生产工艺要求。')
  const factoryId = text(data.factoryId, 100); const factoryName = text(data.factoryName, 120)
  if (!factoryId && !factoryName) return fail('invalid_params', 'FACTORY_REQUIRED', '请选择实际询价工厂。')
  const existing = (await many(C.orders, { enterpriseId: ctx.enterpriseId, sampleOrderId }, 20)).find((item) => item.status !== 'cancelled')
  if (existing) return ok({ order: summary(existing), idempotent: true }, existing.status)
  const key = text(data.idempotencyKey, 120)
  if (key) { const same = await one(C.orders, { enterpriseId: ctx.enterpriseId, createdByMemberId: ctx.memberId, idempotencyKey: key }); if (same) return ok({ order: summary(same), idempotent: true }, same.status) }
  const createdAt = now(); const productionOrderId = id('small_batch_order')
  const order = {
    productionOrderId, productionOrderNo: `SPO-${String(Date.now()).slice(-10)}`, enterpriseId: ctx.enterpriseId,
    sampleOrderId, patternMasterId: sample.patternMasterId, patternVersionId: sample.patternVersionId,
    patternTitle: sample.patternTitle, patternVersionNo: sample.patternVersionNo, projectId: sample.projectId || '', commercialOrderId: sample.orderId || '',
    factoryId, factoryName, factoryVerificationClaimed: false, assignedFactoryMemberId: '',
    sizeBreakdown: sizes, totalQuantity: quantity, sizesConfirmed: true, materials, materialsConfirmed: true,
    craftRequirements, craftConfirmed: true, status: 'draft', currentQuoteId: '', amount: 0, currency: 'CNY',
    promisedDeliveryAt: '', latestEstimatedDeliveryAt: '', deliveryRisk: 'none', qualityStatus: 'pending', productionReady: false,
    idempotencyKey: key, createdByMemberId: ctx.memberId, createdAt, updatedAt: createdAt
  }
  await db.collection(C.orders).add({ data: order })
  await db.collection(C.samples).where({ enterpriseId: ctx.enterpriseId, sampleOrderId }).update({ data: { productionOrderId, updatedAt: createdAt } })
  await event(ctx, order, 'create_draft', '', 'draft')
  return ok({ order: summary(order) }, 'draft')
}

async function list(ctx, data) {
  await requirePermission(ctx, ['order.view', 'order.manage', 'factory.collaborate', 'delivery.approve'])
  const where = { enterpriseId: ctx.enterpriseId }; if (STATUSES.includes(data.status)) where.status = data.status
  const items = (await many(C.orders, where, 50)).map(summary).sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))
  return ok({ items })
}

async function get(ctx, data) {
  const loaded = await load(ctx, data, ['order.view', 'order.manage', 'factory.collaborate', 'delivery.approve'])
  const orderId = loaded.order.productionOrderId
  const [quotes, progress, quality, deliveries, events] = await Promise.all([
    many(C.quotes, { enterpriseId: ctx.enterpriseId, productionOrderId: orderId }, 20),
    many(C.progress, { enterpriseId: ctx.enterpriseId, productionOrderId: orderId }, 100),
    many(C.quality, { enterpriseId: ctx.enterpriseId, productionOrderId: orderId }, 50),
    many(C.deliveries, { enterpriseId: ctx.enterpriseId, productionOrderId: orderId }, 20),
    many(C.events, { enterpriseId: ctx.enterpriseId, productionOrderId: orderId }, 100)
  ])
  const p = loaded.perms; const status = loaded.order.status
  return ok({ order: safeDoc(loaded.order), quotes, progress: progress.sort((a,b) => String(b.createdAt).localeCompare(String(a.createdAt))), qualityChecks: quality.sort((a,b) => String(b.createdAt).localeCompare(String(a.createdAt))), deliveries, events: events.sort((a,b) => String(b.createdAt).localeCompare(String(a.createdAt))), access: {
    canInquiry: p.includes('factory.quote') || p.includes('order.manage'), canQuote: p.includes('factory.collaborate') || p.includes('factory.quote'),
    canConfirmQuote: p.includes('order.manage'), canMaterial: p.includes('factory.collaborate'), canSchedule: p.includes('order.manage'),
    canProduce: p.includes('factory.collaborate'), canQuality: p.includes('delivery.approve'), canDeliver: p.includes('factory.collaborate'),
    canComplete: p.includes('delivery.approve') || p.includes('order.manage'), canCancel: !isTerminal(status) && p.includes('order.manage')
  } })
}

async function move(ctx, data, action, from, to, allowed, patch = {}) {
  const loaded = await load(ctx, data, allowed); const order = loaded.order
  if (!from.includes(order.status) || !canTransition(order.status, to)) return fail('invalid_state', 'INVALID_STATE_TRANSITION', '当前生产状态不能执行该操作。')
  const updatedAt = now(); const next = { status: to, updatedAt, ...patch }
  await db.collection(C.orders).where({ enterpriseId: ctx.enterpriseId, productionOrderId: order.productionOrderId }).update({ data: next })
  await event(ctx, order, action, order.status, to, data.note)
  return ok({ order: summary({ ...order, ...next }) }, to)
}

async function sendInquiry(ctx, data) {
  const loaded = await load(ctx, data, ['factory.quote', 'order.manage']); const order = loaded.order
  if (order.status !== 'draft' || !canTransition('draft', 'pending_quote')) return fail('invalid_state', 'INVALID_STATE_TRANSITION', '当前生产单不能发起询价。')
  const quoteDueAt = text(data.quoteDueAt, 40); const requestedDeliveryAt = text(data.requestedDeliveryAt, 40)
  if (!quoteDueAt || !requestedDeliveryAt) return fail('invalid_params', 'QUOTE_DATES_REQUIRED', '请填写报价截止日期和期望交期。')
  const createdAt = now(); const quote = { quoteId: id('small_batch_quote'), enterpriseId: ctx.enterpriseId, productionOrderId: order.productionOrderId, factoryId: order.factoryId, factoryName: order.factoryName, status: 'invited', items: order.sizeBreakdown, totalQuantity: order.totalQuantity, requestedDeliveryAt, quoteDueAt, amount: 0, currency: 'CNY', leadTimeDays: 0, estimatedDeliveryAt: '', createdByMemberId: ctx.memberId, createdAt, updatedAt: createdAt }
  await db.collection(C.quotes).add({ data: quote })
  await db.collection(C.orders).where({ enterpriseId: ctx.enterpriseId, productionOrderId: order.productionOrderId }).update({ data: { status: 'pending_quote', currentQuoteId: quote.quoteId, requestedDeliveryAt, updatedAt: createdAt } })
  await event(ctx, order, 'send_inquiry', 'draft', 'pending_quote')
  return ok({ order: summary({ ...order, status: 'pending_quote', currentQuoteId: quote.quoteId, updatedAt: createdAt }), quote: safeDoc(quote) }, 'pending_quote')
}

async function submitQuote(ctx, data) {
  const loaded = await load(ctx, data, ['factory.collaborate', 'factory.quote']); const order = loaded.order
  if (order.status !== 'pending_quote' || !canTransition('pending_quote', 'quoted')) return fail('invalid_state', 'INVALID_STATE_TRANSITION', '当前生产单不在报价阶段。')
  const amount = Number(data.amount); const leadTimeDays = Math.floor(Number(data.leadTimeDays)); const estimatedDeliveryAt = text(data.estimatedDeliveryAt, 40)
  if (!(amount > 0) || !(leadTimeDays > 0) || !estimatedDeliveryAt) return fail('invalid_params', 'QUOTE_REQUIRED', '请填写有效报价、生产周期和预计交期。')
  const quote = await one(C.quotes, { enterpriseId: ctx.enterpriseId, productionOrderId: order.productionOrderId, quoteId: order.currentQuoteId })
  if (!quote) throw err('QUOTE_NOT_FOUND', '询价记录不存在。')
  const submittedAt = now(); const quotePatch = { status: 'submitted', amount, currency: 'CNY', leadTimeDays, estimatedDeliveryAt, minimumOrderQuantity: Math.max(0, Math.floor(Number(data.minimumOrderQuantity) || 0)), factoryComment: text(data.factoryComment, 800), submittedByMemberId: ctx.memberId, submittedAt, updatedAt: submittedAt }
  await db.collection(C.quotes).where({ enterpriseId: ctx.enterpriseId, quoteId: quote.quoteId }).update({ data: quotePatch })
  await db.collection(C.orders).where({ enterpriseId: ctx.enterpriseId, productionOrderId: order.productionOrderId }).update({ data: { status: 'quoted', assignedFactoryMemberId: ctx.memberId, amount, promisedDeliveryAt: estimatedDeliveryAt, latestEstimatedDeliveryAt: estimatedDeliveryAt, updatedAt: submittedAt } })
  await event(ctx, order, 'submit_quote', 'pending_quote', 'quoted')
  return ok({ order: summary({ ...order, status: 'quoted', amount, promisedDeliveryAt: estimatedDeliveryAt, updatedAt: submittedAt }), quote: safeDoc({ ...quote, ...quotePatch }) }, 'quoted')
}

async function confirmQuote(ctx, data) {
  const loaded = await load(ctx, data, ['order.manage']); const order = loaded.order
  const quote = await one(C.quotes, { enterpriseId: ctx.enterpriseId, productionOrderId: order.productionOrderId, quoteId: order.currentQuoteId })
  if (!quote || quote.status !== 'submitted') return fail('invalid_state', 'QUOTE_NOT_SUBMITTED', '工厂尚未提交有效报价。')
  if (order.status !== 'quoted') return fail('invalid_state', 'INVALID_STATE_TRANSITION', '当前报价不能确认。')
  const confirmedAt = now(); await db.collection(C.quotes).where({ enterpriseId: ctx.enterpriseId, quoteId: quote.quoteId }).update({ data: { status: 'accepted', acceptedByMemberId: ctx.memberId, acceptedAt: confirmedAt, updatedAt: confirmedAt } })
  return move(ctx, data, 'confirm_quote', ['quoted'], 'quote_confirmed', ['order.manage'], { quoteConfirmedAt: confirmedAt })
}

async function recordProgress(ctx, data) {
  const loaded = await load(ctx, data, ['factory.collaborate']); const order = loaded.order
  if (!['production_scheduled', 'producing', 'rework_required'].includes(order.status)) return fail('invalid_state', 'PROGRESS_NOT_ALLOWED', '当前阶段不能记录生产进度。')
  const content = text(data.content, 800); if (!content) return fail('invalid_params', 'PROGRESS_REQUIRED', '请填写生产进度。')
  const assetIds = cleanAssets(data.assetIds, 9); if (!assetsValid(data.assetIds, assetIds)) return fail('invalid_params', 'STABLE_ASSET_REQUIRED', '生产凭证必须先上传为稳定云文件。')
  const createdAt = now(); const progress = { progressId: id('production_progress'), enterpriseId: ctx.enterpriseId, productionOrderId: order.productionOrderId, stage: text(data.stage, 60) || order.status, percent: Math.max(0, Math.min(100, Number(data.percent) || 0)), content, estimatedDeliveryAt: text(data.estimatedDeliveryAt, 40), risk: ['none','low','medium','high'].includes(data.risk) ? data.risk : 'none', assetIds, operatorMemberId: ctx.memberId, createdAt }
  await db.collection(C.progress).add({ data: progress })
  const patch = { latestProgress: progress.percent, deliveryRisk: progress.risk, updatedAt: createdAt }; if (progress.estimatedDeliveryAt) patch.latestEstimatedDeliveryAt = progress.estimatedDeliveryAt
  await db.collection(C.orders).where({ enterpriseId: ctx.enterpriseId, productionOrderId: order.productionOrderId }).update({ data: patch })
  return ok({ progress: safeDoc(progress) }, 'progress_recorded')
}

async function qualityResult(ctx, data) {
  const loaded = await load(ctx, data, ['delivery.approve']); const order = loaded.order
  if (order.status !== 'quality_check') return fail('invalid_state', 'QUALITY_NOT_READY', '当前生产单不在质检阶段。')
  const result = data.result === 'passed' ? 'passed' : (data.result === 'failed' ? 'failed' : '')
  const note = text(data.note, 1000); if (!result || !note) return fail('invalid_params', 'QUALITY_RESULT_REQUIRED', '请填写质检结果和说明。')
  const assetIds = cleanAssets(data.assetIds, 12); if (!assetsValid(data.assetIds, assetIds)) return fail('invalid_params', 'STABLE_ASSET_REQUIRED', '质检照片必须先上传为稳定云文件。'); const createdAt = now(); const target = result === 'passed' ? 'ready_to_deliver' : 'rework_required'
  const check = { qualityCheckId: id('quality_check'), enterpriseId: ctx.enterpriseId, productionOrderId: order.productionOrderId, result, note, assetIds, inspectorMemberId: ctx.memberId, createdAt }
  await db.collection(C.quality).add({ data: check })
  await db.collection(C.orders).where({ enterpriseId: ctx.enterpriseId, productionOrderId: order.productionOrderId }).update({ data: { status: target, qualityStatus: result, updatedAt: createdAt } })
  await event(ctx, order, result === 'passed' ? 'quality_passed' : 'quality_failed', 'quality_check', target, note)
  return ok({ order: summary({ ...order, status: target, updatedAt: createdAt }), qualityCheck: safeDoc(check) }, target)
}

async function submitDelivery(ctx, data) {
  const loaded = await load(ctx, data, ['factory.collaborate']); const order = loaded.order
  if (order.status !== 'ready_to_deliver' || !canTransition('ready_to_deliver', 'delivered')) return fail('invalid_state', 'DELIVERY_NOT_READY', '当前生产单尚不可交付。')
  const quantity = Math.floor(Number(data.quantity) || 0); const note = text(data.note, 800); const assetIds = cleanAssets(data.assetIds, 12)
  if (!assetsValid(data.assetIds, assetIds)) return fail('invalid_params', 'STABLE_ASSET_REQUIRED', '交付凭证必须先上传为稳定云文件。')
  if (quantity !== order.totalQuantity || !note) return fail('invalid_params', 'DELIVERY_REQUIRED', '交付数量必须与生产数量一致，并填写交付说明。')
  const deliveredAt = now(); const delivery = { deliveryId: id('small_batch_delivery'), enterpriseId: ctx.enterpriseId, productionOrderId: order.productionOrderId, quantity, note, trackingNo: text(data.trackingNo, 100), carrier: text(data.carrier, 80), assetIds, deliveredByMemberId: ctx.memberId, deliveredAt, createdAt: deliveredAt }
  await db.collection(C.deliveries).add({ data: delivery })
  await db.collection(C.orders).where({ enterpriseId: ctx.enterpriseId, productionOrderId: order.productionOrderId }).update({ data: { status: 'delivered', latestDeliveryId: delivery.deliveryId, deliveredAt, updatedAt: deliveredAt } })
  await event(ctx, order, 'submit_delivery', 'ready_to_deliver', 'delivered', note)
  return ok({ order: summary({ ...order, status: 'delivered', updatedAt: deliveredAt }), delivery: safeDoc(delivery) }, 'delivered')
}

async function cancel(ctx, data) {
  const loaded = await load(ctx, data, ['order.manage']); const reason = text(data.reason, 500)
  if (!reason) return fail('invalid_params', 'CANCEL_REASON_REQUIRED', '请填写取消原因。')
  if (isTerminal(loaded.order.status) || !canTransition(loaded.order.status, 'cancelled')) return fail('invalid_state', 'INVALID_STATE_TRANSITION', '当前生产单不能取消。')
  return move(ctx, { ...data, note: reason }, 'cancel', [loaded.order.status], 'cancelled', ['order.manage'], { cancelReason: reason, cancelledAt: now() })
}

const ACTIONS = {
  create_draft: createDraft, list, get, send_inquiry: sendInquiry, submit_quote: submitQuote, confirm_quote: confirmQuote,
  start_material: (ctx,data) => move(ctx,data,'start_material',['quote_confirmed'],'pending_material',['order.manage']),
  confirm_material: (ctx,data) => move(ctx,data,'confirm_material',['pending_material'],'material_ready',['factory.collaborate'],{ materialConfirmedAt: now() }),
  schedule_production: (ctx,data) => move(ctx,data,'schedule_production',['material_ready'],'production_scheduled',['order.manage'],{ scheduledAt: now() }),
  start_production: (ctx,data) => move(ctx,data,'start_production',['production_scheduled','rework_required'],'producing',['factory.collaborate'],{ productionStartedAt: now() }),
  record_progress: recordProgress,
  submit_quality: (ctx,data) => move(ctx,data,'submit_quality',['producing'],'quality_check',['factory.collaborate'],{ qualitySubmittedAt: now() }),
  quality_result: qualityResult, submit_delivery: submitDelivery,
  complete: (ctx,data) => move(ctx,data,'complete',['delivered'],'completed',['delivery.approve','order.manage'],{ completedAt: now(), productionReady: true }),
  cancel
}

exports.main = async (event = {}) => {
  const startedAt = Date.now(); const action = text(event.action, 50); let success = false; let errorCode = ''
  try {
    if (!ACTIONS[action]) return fail('invalid_action', 'INVALID_ACTION', '未知小单生产操作。')
    const ctx = await context(event.sessionToken); const result = await ACTIONS[action](ctx, event.data || {})
    success = Boolean(result && result.ok); errorCode = result && result.errorCode || ''; return result
  } catch (cause) {
    errorCode = cause.errorCode || 'INTERNAL_ERROR'; return fail(errorCode === 'FORBIDDEN' ? 'forbidden' : 'error', errorCode, cause.message || '小单生产操作失败。')
  } finally { console.log('[small-batch-production]', { action, success, errorCode, durationMs: Date.now() - startedAt }) }
}
