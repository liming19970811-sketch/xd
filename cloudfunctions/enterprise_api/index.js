const crypto = require('crypto')
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const _ = db.command

const COLLECTIONS = Object.freeze({
  sessions: 'enterprise_auth_sessions',
  enterprises: 'enterprises',
  members: 'enterprise_members',
  access: 'enterprise_api_access',
  apps: 'enterprise_api_apps',
  keys: 'enterprise_api_keys',
  logs: 'enterprise_api_call_logs',
  tasks: 'enterprise_api_tasks',
  batches: 'enterprise_api_batches',
  idempotency: 'enterprise_api_idempotency',
  callbacks: 'enterprise_api_callbacks'
})

const APP_STATUSES = Object.freeze(['draft', 'active', 'suspended', 'revoked'])
const KEY_STATUSES = Object.freeze(['active', 'suspended', 'revoked'])
const STABLE_SCOPES = Object.freeze(['task.create', 'task.read', 'result.read', 'batch.create', 'batch.read', 'usage.read'])
const DEFAULT_LIMITS = Object.freeze({
  perMinute: 60,
  dailyTasks: 500,
  concurrentTasks: 20,
  batchLimit: 100,
  fileSizeMb: 20
})

function nowIso() {
  return new Date().toISOString()
}

function sha256(value = '') {
  return crypto.createHash('sha256').update(String(value || '')).digest('hex')
}

function randomId(prefix = 'id') {
  return `${prefix}_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`
}

function createRequestId() {
  return `req_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`
}

function createSecret(appId = '') {
  const appPart = String(appId || 'app').replace(/[^a-zA-Z0-9]/g, '').slice(-10) || 'app'
  return `db_live_${appPart}_${crypto.randomBytes(24).toString('base64url')}`
}

function ok(data = {}, requestId = createRequestId()) {
  return {
    requestId,
    success: true,
    ok: true,
    code: 'ok',
    message: 'ok',
    data,
    timestamp: nowIso()
  }
}

function fail(code = 'unknown_error', message = 'request failed', requestId = createRequestId(), data = {}) {
  return {
    requestId,
    success: false,
    ok: false,
    errorCode: code,
    code,
    message,
    data,
    timestamp: nowIso()
  }
}

function sanitizeApp(app = {}) {
  return {
    appId: String(app.appId || ''),
    enterpriseId: String(app.enterpriseId || ''),
    name: String(app.name || ''),
    scene: String(app.scene || ''),
    callbackUrl: String(app.callbackUrl || ''),
    allowedScopes: Array.isArray(app.allowedScopes) ? app.allowedScopes.filter((scope) => STABLE_SCOPES.includes(scope)) : [],
    owner: String(app.owner || ''),
    status: APP_STATUSES.includes(app.status) ? app.status : 'draft',
    limits: normalizeLimits(app.limits),
    createdAt: app.createdAt || '',
    updatedAt: app.updatedAt || ''
  }
}

function sanitizeKey(key = {}) {
  return {
    keyId: String(key.keyId || ''),
    appId: String(key.appId || ''),
    enterpriseId: String(key.enterpriseId || ''),
    keyPrefix: String(key.keyPrefix || ''),
    status: KEY_STATUSES.includes(key.status) ? key.status : 'active',
    lastUsedAt: key.lastUsedAt || '',
    createdAt: key.createdAt || '',
    updatedAt: key.updatedAt || ''
  }
}

function sanitizeLog(log = {}) {
  return {
    requestId: String(log.requestId || ''),
    appId: String(log.appId || ''),
    enterpriseId: String(log.enterpriseId || ''),
    endpoint: String(log.endpoint || ''),
    code: String(log.code || ''),
    statusCode: Number(log.statusCode || 0),
    success: Boolean(log.success),
    durationMs: Number(log.durationMs || 0),
    taskId: String(log.taskId || ''),
    batchId: String(log.batchId || ''),
    quotaRecordId: String(log.quotaRecordId || ''),
    createdAt: log.createdAt || ''
  }
}

function normalizeLimits(limits = {}) {
  return {
    perMinute: Math.max(1, Number(limits.perMinute || DEFAULT_LIMITS.perMinute)),
    dailyTasks: Math.max(1, Number(limits.dailyTasks || DEFAULT_LIMITS.dailyTasks)),
    concurrentTasks: Math.max(1, Number(limits.concurrentTasks || DEFAULT_LIMITS.concurrentTasks)),
    batchLimit: Math.max(1, Number(limits.batchLimit || DEFAULT_LIMITS.batchLimit)),
    fileSizeMb: Math.max(1, Number(limits.fileSizeMb || DEFAULT_LIMITS.fileSizeMb))
  }
}

function normalizeScopes(scopes = []) {
  return [...new Set((Array.isArray(scopes) ? scopes : []).filter((scope) => STABLE_SCOPES.includes(scope)))]
}

async function getFirst(collection, where = {}) {
  const result = await db.collection(collection).where(where).limit(1).get()
  return result.data && result.data.length ? result.data[0] : null
}

async function getDoc(collection, id = '') {
  if (!id) return null
  try {
    const result = await db.collection(collection).doc(id).get()
    return result.data || null
  } catch (error) {
    return null
  }
}

async function getSession(sessionToken = '') {
  const token = String(sessionToken || '').trim()
  if (!token) return null
  return getFirst(COLLECTIONS.sessions, { sessionTokenHash: sha256(token) })
}

async function requireConsoleContext(event = {}) {
  const session = await getSession(event.sessionToken)
  if (!session || session.status !== 'active') return { ok: false, code: 'session_invalid', message: '登录状态已失效' }
  if (session.expiresAt && new Date(session.expiresAt).getTime() <= Date.now()) {
    return { ok: false, code: 'session_expired', message: '登录已过期' }
  }
  const member = session.memberId
    ? await getFirst(COLLECTIONS.members, { memberId: session.memberId, userId: session.userId })
    : await getFirst(COLLECTIONS.members, { enterpriseId: session.enterpriseId, userId: session.userId })
  if (!member || member.status !== 'active') return { ok: false, code: 'member_inactive', message: '当前成员不可用' }
  const enterprise = await getFirst(COLLECTIONS.enterprises, { enterpriseId: member.enterpriseId })
  if (!enterprise) return { ok: false, code: 'enterprise_not_found', message: '企业不存在' }
  if (member.role !== 'admin' && member.role !== 'owner') {
    return { ok: false, code: 'permission_denied', message: '仅企业管理员可管理 API 开放平台' }
  }
  const apiAccess = await getApiAccess(member.enterpriseId, enterprise)
  if (!apiAccess.enabled) return { ok: false, code: 'api_access_required', message: apiAccess.message, enterprise, member, apiAccess }
  return { ok: true, enterprise, member, apiAccess }
}

async function getApiAccess(enterpriseId = '', enterprise = {}) {
  const access = await getFirst(COLLECTIONS.access, { enterpriseId, status: 'active' })
  const enabled = Boolean(
    access ||
    enterprise.apiAccessEnabled ||
    enterprise.apiEnabled ||
    process.env.ENTERPRISE_API_AUTO_ENABLE === 'true'
  )
  return {
    enabled,
    message: enabled ? '当前企业已开通 API 权限' : '当前企业未开通 API 权限，请联系蝶变开通。',
    source: access ? 'access_collection' : (enterprise.apiAccessEnabled || enterprise.apiEnabled ? 'enterprise_flag' : 'env_or_disabled')
  }
}

async function listApps(enterpriseId = '') {
  const result = await db.collection(COLLECTIONS.apps).where({ enterpriseId }).orderBy('createdAt', 'desc').get()
  return (result.data || []).map(sanitizeApp)
}

async function listKeys(enterpriseId = '', appId = '') {
  const where = appId ? { enterpriseId, appId } : { enterpriseId }
  const result = await db.collection(COLLECTIONS.keys).where(where).orderBy('createdAt', 'desc').get()
  return (result.data || []).map(sanitizeKey)
}

async function listLogs(enterpriseId = '') {
  const result = await db.collection(COLLECTIONS.logs).where({ enterpriseId }).orderBy('createdAt', 'desc').limit(80).get()
  return (result.data || []).map(sanitizeLog)
}

function buildUsage(logs = []) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayTime = today.getTime()
  const todayLogs = logs.filter((log) => new Date(log.createdAt).getTime() >= todayTime)
  return {
    callCount: todayLogs.length,
    taskCount: todayLogs.filter((log) => ['apiCreateImageTask', 'apiCreateBatch'].includes(log.endpoint)).length,
    failedCount: todayLogs.filter((log) => !log.success).length,
    quotaRecordCount: todayLogs.filter((log) => log.quotaRecordId).length
  }
}

async function getConsoleData(event = {}) {
  const context = await requireConsoleContext(event)
  if (!context.ok) return fail(context.code, context.message)
  const enterpriseId = context.enterprise.enterpriseId
  const apps = await listApps(enterpriseId)
  const keys = await listKeys(enterpriseId)
  const logs = await listLogs(enterpriseId)
  return ok({
    apiAccess: context.apiAccess,
    enterprise: {
      enterpriseId,
      enterpriseName: context.enterprise.enterpriseName || ''
    },
    apps,
    keys,
    logs,
    usage: buildUsage(logs)
  })
}

async function createApp(event = {}) {
  const context = await requireConsoleContext(event)
  if (!context.ok) return fail(context.code, context.message)
  const input = event.app || {}
  const name = String(input.name || '').trim()
  if (name.length < 2) return fail('app_name_invalid', '应用名称至少需要 2 个字符')
  const scopes = normalizeScopes(input.scopes || input.allowedScopes)
  if (!scopes.length) return fail('scope_required', '请至少选择一个稳定 API 范围')
  const now = nowIso()
  const app = {
    appId: randomId('api_app'),
    enterpriseId: context.enterprise.enterpriseId,
    name: name.slice(0, 60),
    scene: String(input.scene || '').trim().slice(0, 120),
    callbackUrl: String(input.callbackUrl || '').trim().slice(0, 300),
    allowedScopes: scopes,
    owner: String(input.owner || '').trim().slice(0, 60),
    status: 'draft',
    limits: normalizeLimits(input.limits),
    createdByMemberId: context.member.memberId,
    createdAt: now,
    updatedAt: now
  }
  await db.collection(COLLECTIONS.apps).add({ data: app })
  return ok({ app: sanitizeApp(app) })
}

async function updateAppStatus(event = {}) {
  const context = await requireConsoleContext(event)
  if (!context.ok) return fail(context.code, context.message)
  const app = await getFirst(COLLECTIONS.apps, { appId: event.appId, enterpriseId: context.enterprise.enterpriseId })
  if (!app) return fail('app_not_found', 'API 应用不存在')
  const status = String(event.status || '')
  if (!APP_STATUSES.includes(status)) return fail('app_status_invalid', '应用状态无效')
  await db.collection(COLLECTIONS.apps).doc(app._id).update({ data: { status, updatedAt: nowIso() } })
  return ok({ app: sanitizeApp({ ...app, status, updatedAt: nowIso() }) })
}

async function createApiKey(event = {}) {
  const context = await requireConsoleContext(event)
  if (!context.ok) return fail(context.code, context.message)
  const app = await getFirst(COLLECTIONS.apps, { appId: event.appId, enterpriseId: context.enterprise.enterpriseId })
  if (!app || app.status === 'revoked') return fail('app_not_found', 'API 应用不存在或已撤销')
  const secret = createSecret(app.appId)
  const now = nowIso()
  const key = {
    keyId: randomId('api_key'),
    appId: app.appId,
    enterpriseId: app.enterpriseId,
    keyPrefix: secret.slice(0, 18),
    secretHash: sha256(secret),
    status: 'active',
    createdByMemberId: context.member.memberId,
    lastUsedAt: '',
    createdAt: now,
    updatedAt: now
  }
  await db.collection(COLLECTIONS.keys).add({ data: key })
  return ok({ key: sanitizeKey(key), plainTextKey: secret })
}

async function updateApiKeyStatus(event = {}) {
  const context = await requireConsoleContext(event)
  if (!context.ok) return fail(context.code, context.message)
  const key = await getFirst(COLLECTIONS.keys, { keyId: event.keyId, enterpriseId: context.enterprise.enterpriseId })
  if (!key) return fail('key_not_found', 'API Key 不存在')
  const status = String(event.status || '')
  if (!KEY_STATUSES.includes(status)) return fail('key_status_invalid', 'API Key 状态无效')
  await db.collection(COLLECTIONS.keys).doc(key._id).update({ data: { status, updatedAt: nowIso() } })
  return ok({ key: sanitizeKey({ ...key, status, updatedAt: nowIso() }) })
}

async function rotateApiKey(event = {}) {
  const context = await requireConsoleContext(event)
  if (!context.ok) return fail(context.code, context.message)
  const key = await getFirst(COLLECTIONS.keys, { keyId: event.keyId, enterpriseId: context.enterprise.enterpriseId })
  if (!key) return fail('key_not_found', 'API Key 不存在')
  if (key.status === 'revoked') return fail('key_revoked', '已撤销密钥不能轮换')
  await db.collection(COLLECTIONS.keys).doc(key._id).update({
    data: { status: 'revoked', updatedAt: nowIso() }
  })
  return createApiKey({ ...event, appId: key.appId })
}

function getBearerKey(event = {}) {
  const header = event.headers || event.header || {}
  const authorization = header.authorization || header.Authorization || ''
  const fromHeader = String(authorization).replace(/^Bearer\s+/i, '').trim()
  return String(event.apiKey || fromHeader || '').trim()
}

async function authenticateApiCall(event = {}, requestId = '') {
  const apiKey = getBearerKey(event)
  if (!apiKey) return { ok: false, response: fail('api_key_required', '缺少 API Key', requestId) }
  const key = await getFirst(COLLECTIONS.keys, { secretHash: sha256(apiKey) })
  if (!key || key.status !== 'active') return { ok: false, response: fail('api_key_invalid', 'API Key 无效或已撤销', requestId) }
  const app = await getFirst(COLLECTIONS.apps, { appId: key.appId, enterpriseId: key.enterpriseId })
  if (!app || app.status !== 'active') return { ok: false, response: fail('app_inactive', 'API 应用未启用', requestId) }
  const enterprise = await getFirst(COLLECTIONS.enterprises, { enterpriseId: key.enterpriseId })
  const access = await getApiAccess(key.enterpriseId, enterprise || {})
  if (!access.enabled) return { ok: false, response: fail('api_access_required', '企业 API 权限未开通', requestId) }
  return { ok: true, key, app: sanitizeApp(app), access }
}

function requireScope(app = {}, scope = '', requestId = '') {
  if (!app.allowedScopes.includes(scope)) return fail('scope_denied', 'API 应用无权调用该接口', requestId)
  return null
}

async function countRecentLogs(appId = '', sinceIso = '') {
  const result = await db.collection(COLLECTIONS.logs).where({
    appId,
    createdAt: _.gte(sinceIso)
  }).count()
  return result.total || 0
}

async function enforceLimits(app = {}, action = '', payload = {}, requestId = '') {
  const limits = normalizeLimits(app.limits)
  const minuteAgo = new Date(Date.now() - 60 * 1000).toISOString()
  const minuteCount = await countRecentLogs(app.appId, minuteAgo)
  if (minuteCount >= limits.perMinute) return fail('rate_limited', '调用频率超过限制', requestId)

  if (action === 'apiCreateBatch') {
    const items = Array.isArray(payload.items) ? payload.items : []
    if (items.length > limits.batchLimit) return fail('batch_limit_exceeded', '单批次任务数量超过限制', requestId)
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const taskCount = await db.collection(COLLECTIONS.tasks).where({
    appId: app.appId,
    createdAt: _.gte(today.toISOString())
  }).count()
  if (taskCount.total >= limits.dailyTasks) return fail('daily_task_limit_exceeded', '每日任务数量超过限制', requestId)

  const concurrent = await db.collection(COLLECTIONS.tasks).where({
    appId: app.appId,
    status: _.in(['pending', 'processing'])
  }).count()
  if (concurrent.total >= limits.concurrentTasks) return fail('concurrent_task_limit_exceeded', '并发任务数量超过限制', requestId)
  return null
}

async function findIdempotentResponse(app = {}, action = '', idempotencyKey = '') {
  if (!idempotencyKey) return null
  const id = sha256(`${app.enterpriseId}:${app.appId}:${action}:${idempotencyKey}`)
  const record = await getDoc(COLLECTIONS.idempotency, id)
  return record && record.response ? record.response : null
}

async function saveIdempotentResponse(app = {}, action = '', idempotencyKey = '', response = {}) {
  if (!idempotencyKey) return
  const id = sha256(`${app.enterpriseId}:${app.appId}:${action}:${idempotencyKey}`)
  await db.collection(COLLECTIONS.idempotency).doc(id).set({
    data: {
      idempotencyId: id,
      enterpriseId: app.enterpriseId,
      appId: app.appId,
      action,
      idempotencyKeyHash: sha256(idempotencyKey),
      response,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      createdAt: nowIso()
    }
  })
}

async function writeLog(input = {}) {
  const log = {
    requestId: input.requestId,
    enterpriseId: input.enterpriseId || '',
    appId: input.appId || '',
    endpoint: input.endpoint || '',
    code: input.code || '',
    statusCode: input.statusCode || (input.success ? 200 : 400),
    success: Boolean(input.success),
    durationMs: Math.max(0, Number(input.durationMs || 0)),
    taskId: input.taskId || '',
    batchId: input.batchId || '',
    quotaRecordId: input.quotaRecordId || '',
    createdAt: nowIso()
  }
  await db.collection(COLLECTIONS.logs).add({ data: log })
  return sanitizeLog(log)
}

async function logApiResponse(auth = {}, endpoint = '', response = {}, extra = {}) {
  if (!auth || !auth.app) return response
  await writeLog({
    requestId: response.requestId,
    enterpriseId: auth.app.enterpriseId,
    appId: auth.app.appId,
    endpoint,
    code: response.code,
    statusCode: response.success ? 200 : 400,
    success: response.success,
    taskId: extra.taskId || '',
    batchId: extra.batchId || '',
    quotaRecordId: extra.quotaRecordId || '',
    durationMs: extra.durationMs || 0
  })
  return response
}

function buildPollingUrl(type = 'tasks', id = '') {
  return `/developer/api/${type}/${encodeURIComponent(id)}`
}

async function apiCreateImageTask(event = {}, requestId = '') {
  const auth = await authenticateApiCall(event, requestId)
  if (!auth.ok) return auth.response
  const scopeError = requireScope(auth.app, 'task.create', requestId)
  if (scopeError) return logApiResponse(auth, 'apiCreateImageTask', scopeError)
  if (!event.idempotencyKey) return logApiResponse(auth, 'apiCreateImageTask', fail('idempotency_key_required', '创建任务必须提供 idempotencyKey', requestId))
  const existed = await findIdempotentResponse(auth.app, 'apiCreateImageTask', event.idempotencyKey)
  if (existed) return existed
  const limitError = await enforceLimits(auth.app, 'apiCreateImageTask', event, requestId)
  if (limitError) return logApiResponse(auth, 'apiCreateImageTask', limitError)
  const now = nowIso()
  const task = {
    taskId: randomId('api_task'),
    enterpriseId: auth.app.enterpriseId,
    appId: auth.app.appId,
    type: String(event.type || 'model').slice(0, 40),
    input: sanitizeTaskInput(event.input || {}),
    params: sanitizeParams(event.params || {}),
    status: 'pending',
    result: {},
    idempotencyKeyHash: sha256(event.idempotencyKey),
    createdAt: now,
    updatedAt: now
  }
  await db.collection(COLLECTIONS.tasks).add({ data: task })
  await db.collection(COLLECTIONS.keys).doc(auth.key._id).update({ data: { lastUsedAt: now } })
  const response = ok({
    taskId: task.taskId,
    status: task.status,
    pollingUrl: buildPollingUrl('tasks', task.taskId)
  }, requestId)
  await saveIdempotentResponse(auth.app, 'apiCreateImageTask', event.idempotencyKey, response)
  return logApiResponse(auth, 'apiCreateImageTask', response, { taskId: task.taskId })
}

function sanitizeTaskInput(input = {}) {
  return {
    hasImageUrl: Boolean(input.imageUrl),
    imageUrlHash: input.imageUrl ? sha256(input.imageUrl).slice(0, 24) : '',
    imageSource: input.imageSource ? String(input.imageSource).slice(0, 40) : '',
    fileSizeMb: Math.max(0, Number(input.fileSizeMb || 0))
  }
}

function sanitizeParams(params = {}) {
  return {
    prompt: String(params.prompt || '').slice(0, 300),
    ratio: String(params.ratio || '').slice(0, 20),
    style: String(params.style || '').slice(0, 40)
  }
}

async function apiGetTaskStatus(event = {}, requestId = '') {
  const auth = await authenticateApiCall(event, requestId)
  if (!auth.ok) return auth.response
  const scopeError = requireScope(auth.app, 'task.read', requestId)
  if (scopeError) return logApiResponse(auth, 'apiGetTaskStatus', scopeError)
  const task = await getFirst(COLLECTIONS.tasks, { taskId: event.taskId, enterpriseId: auth.app.enterpriseId, appId: auth.app.appId })
  if (!task) return logApiResponse(auth, 'apiGetTaskStatus', fail('task_not_found', '任务不存在', requestId))
  return logApiResponse(auth, 'apiGetTaskStatus', ok({ taskId: task.taskId, status: task.status, pollingUrl: buildPollingUrl('tasks', task.taskId) }, requestId), { taskId: task.taskId })
}

async function apiGetResult(event = {}, requestId = '') {
  const auth = await authenticateApiCall(event, requestId)
  if (!auth.ok) return auth.response
  const scopeError = requireScope(auth.app, 'result.read', requestId)
  if (scopeError) return logApiResponse(auth, 'apiGetResult', scopeError)
  const task = await getFirst(COLLECTIONS.tasks, { taskId: event.taskId, enterpriseId: auth.app.enterpriseId, appId: auth.app.appId })
  if (!task) return logApiResponse(auth, 'apiGetResult', fail('task_not_found', '任务不存在', requestId))
  return logApiResponse(auth, 'apiGetResult', ok({ taskId: task.taskId, status: task.status, result: task.result || {} }, requestId), { taskId: task.taskId })
}

async function apiCreateBatch(event = {}, requestId = '') {
  const auth = await authenticateApiCall(event, requestId)
  if (!auth.ok) return auth.response
  const scopeError = requireScope(auth.app, 'batch.create', requestId)
  if (scopeError) return logApiResponse(auth, 'apiCreateBatch', scopeError)
  if (!event.idempotencyKey) return logApiResponse(auth, 'apiCreateBatch', fail('idempotency_key_required', '创建批量任务必须提供 idempotencyKey', requestId))
  const existed = await findIdempotentResponse(auth.app, 'apiCreateBatch', event.idempotencyKey)
  if (existed) return existed
  const items = Array.isArray(event.items) ? event.items : []
  if (!items.length) return logApiResponse(auth, 'apiCreateBatch', fail('batch_items_required', '批量任务不能为空', requestId))
  const limitError = await enforceLimits(auth.app, 'apiCreateBatch', event, requestId)
  if (limitError) return logApiResponse(auth, 'apiCreateBatch', limitError)
  const now = nowIso()
  const batchId = randomId('api_batch')
  const taskIds = []
  for (const item of items) {
    const task = {
      taskId: randomId('api_task'),
      batchId,
      enterpriseId: auth.app.enterpriseId,
      appId: auth.app.appId,
      type: String(item.type || 'model').slice(0, 40),
      input: sanitizeTaskInput(item.input || {}),
      params: sanitizeParams(item.params || {}),
      status: 'pending',
      result: {},
      idempotencyKeyHash: sha256(`${event.idempotencyKey}:${taskIds.length}`),
      createdAt: now,
      updatedAt: now
    }
    taskIds.push(task.taskId)
    await db.collection(COLLECTIONS.tasks).add({ data: task })
  }
  const batch = {
    batchId,
    enterpriseId: auth.app.enterpriseId,
    appId: auth.app.appId,
    taskIds,
    status: 'pending',
    idempotencyKeyHash: sha256(event.idempotencyKey),
    callbackUrl: String(event.callbackUrl || '').slice(0, 300),
    createdAt: now,
    updatedAt: now
  }
  await db.collection(COLLECTIONS.batches).add({ data: batch })
  const response = ok({ batchId, status: batch.status, taskIds, pollingUrl: buildPollingUrl('batches', batchId) }, requestId)
  await saveIdempotentResponse(auth.app, 'apiCreateBatch', event.idempotencyKey, response)
  return logApiResponse(auth, 'apiCreateBatch', response, { batchId })
}

async function apiGetBatchStatus(event = {}, requestId = '') {
  const auth = await authenticateApiCall(event, requestId)
  if (!auth.ok) return auth.response
  const scopeError = requireScope(auth.app, 'batch.read', requestId)
  if (scopeError) return logApiResponse(auth, 'apiGetBatchStatus', scopeError)
  const batch = await getFirst(COLLECTIONS.batches, { batchId: event.batchId, enterpriseId: auth.app.enterpriseId, appId: auth.app.appId })
  if (!batch) return logApiResponse(auth, 'apiGetBatchStatus', fail('batch_not_found', '批次不存在', requestId))
  return logApiResponse(auth, 'apiGetBatchStatus', ok({ batchId: batch.batchId, status: batch.status, taskIds: batch.taskIds || [], pollingUrl: buildPollingUrl('batches', batch.batchId) }, requestId), { batchId: batch.batchId })
}

async function apiGetUsage(event = {}, requestId = '') {
  const auth = await authenticateApiCall(event, requestId)
  if (!auth.ok) return auth.response
  const scopeError = requireScope(auth.app, 'usage.read', requestId)
  if (scopeError) return logApiResponse(auth, 'apiGetUsage', scopeError)
  const logs = await listLogs(auth.app.enterpriseId)
  return logApiResponse(auth, 'apiGetUsage', ok({ usage: buildUsage(logs), limits: auth.app.limits }, requestId))
}

async function dispatch(event = {}) {
  const action = String(event.action || '')
  const requestId = String(event.requestId || '') || createRequestId()
  const startedAt = Date.now()
  let response
  if (action === 'getConsoleData') response = await getConsoleData(event)
  else if (action === 'createApp') response = await createApp(event)
  else if (action === 'updateAppStatus') response = await updateAppStatus(event)
  else if (action === 'createApiKey') response = await createApiKey(event)
  else if (action === 'updateApiKeyStatus') response = await updateApiKeyStatus(event)
  else if (action === 'rotateApiKey') response = await rotateApiKey(event)
  else if (action === 'apiCreateImageTask') response = await apiCreateImageTask(event, requestId)
  else if (action === 'apiGetTaskStatus') response = await apiGetTaskStatus(event, requestId)
  else if (action === 'apiGetResult') response = await apiGetResult(event, requestId)
  else if (action === 'apiCreateBatch') response = await apiCreateBatch(event, requestId)
  else if (action === 'apiGetBatchStatus') response = await apiGetBatchStatus(event, requestId)
  else if (action === 'apiGetUsage') response = await apiGetUsage(event, requestId)
  else response = fail('invalid_action', '未知 API 动作', requestId)

  response.data = response.data || {}
  response.data.elapsedMs = Date.now() - startedAt
  return response
}

exports.main = async (event = {}) => {
  const action = String(event.action || '')
  let response
  try {
    response = await dispatch(event)
  } catch (error) {
    response = fail('enterprise_api_failed', '企业 API 服务处理失败')
  }
  console.log('[enterprise_api]', {
    action,
    requestId: response.requestId,
    success: Boolean(response.success),
    code: response.code,
    hasSessionToken: Boolean(event.sessionToken),
    hasApiKey: Boolean(getBearerKey(event))
  })
  return response
}
