const cloud = require('wx-server-sdk')
const crypto = require('crypto')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const DEFAULT_MOCK_TIER = 'self_799'
const ENABLE_REAL_QUOTA_GUARD = String(process.env.ENABLE_REAL_QUOTA_GUARD || '').trim().toLowerCase() === 'true'
const REAL_MODE_IMPLEMENTED = true
const USAGE_COLLECTION = 'membership_usage'
const RECORDS_COLLECTION = 'membership_usage_records'

const SUPPORTED_ACTIONS = Object.freeze([
  'debugConfig',
  'getUsageSummary',
  'checkAiPoints',
  'consumeAiPoints',
  'checkRefineQuota',
  'consumeRefineQuota',
  'checkRunwayVideoQuota',
  'consumeRunwayVideoQuota',
  'rollbackUsage',
  'finalizeUsage'
])

const PLAN_QUOTA = Object.freeze({
  free_trial: Object.freeze({
    monthlyAiPoints: 20,
    monthlyRefineQuota: 0,
    monthlyRunwayVideoQuota: 1,
    monthlySampleQuota: 0
  }),
  self_799: Object.freeze({
    monthlyAiPoints: 600,
    monthlyRefineQuota: 0,
    monthlyRunwayVideoQuota: 3,
    monthlySampleQuota: 0
  }),
  pro_1699: Object.freeze({
    monthlyAiPoints: 1200,
    monthlyRefineQuota: 50,
    monthlyRunwayVideoQuota: 10,
    monthlySampleQuota: 0
  }),
  enterprise_5999: Object.freeze({
    monthlyAiPoints: 4000,
    monthlyRefineQuota: 100,
    monthlyRunwayVideoQuota: 30,
    monthlySampleQuota: 2
  }),
  enterprise_year_56800: Object.freeze({
    monthlyAiPoints: 4000,
    monthlyRefineQuota: 100,
    monthlyRunwayVideoQuota: 30,
    monthlySampleQuota: 2
  })
})

const AI_POINT_COST = Object.freeze({
  basic_background: 1,
  basic_recolor: 1,
  fabric_replace: 2,
  detail_closeup: 2,
  print_generate: 3,
  print_placement: 4,
  sketch_to_model: 5,
  ai_model_image: 5,
  image_to_sketch: 5,
  hot_style_remix: 6,
  detail_long_image: 3,
  runway_video_3s: 25,
  runway_video_5s: 45,
  runway_video_10s: 90
})

function getCurrentPeriod(date = new Date()) {
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

function getServerResolvedTier() {
  // P0 placeholder: real launch must query membership by OPENID/userId.
  return DEFAULT_MOCK_TIER
}

function getPlanQuota(tier = DEFAULT_MOCK_TIER) {
  return PLAN_QUOTA[tier] || PLAN_QUOTA[DEFAULT_MOCK_TIER]
}

function buildMockUsage(openid = '', userId = '') {
  const membershipTier = getServerResolvedTier(openid, userId)
  const quota = getPlanQuota(membershipTier)
  const now = new Date().toISOString()
  return {
    _id: `mock_usage_${openid || userId || 'anonymous'}_${getCurrentPeriod()}`,
    userId,
    openid,
    membershipTier,
    period: getCurrentPeriod(),
    monthlyAiPoints: quota.monthlyAiPoints,
    monthlyAiPointsUsed: 0,
    monthlyRefineQuota: quota.monthlyRefineQuota,
    monthlyRefineUsed: 0,
    monthlyRunwayVideoQuota: quota.monthlyRunwayVideoQuota,
    monthlyRunwayVideoUsed: 0,
    monthlySampleQuota: quota.monthlySampleQuota,
    monthlySampleUsed: 0,
    createdAt: now,
    updatedAt: now
  }
}

function normalizeCount(value = 1) {
  const count = Number(value)
  return Number.isFinite(count) && count > 0 ? count : 1
}

function getAiPointCost(actionType = '', count = 1) {
  return (AI_POINT_COST[actionType] || 0) * normalizeCount(count)
}

function getCostActionType(event = {}) {
  return String(event.costActionType || event.actionType || '').trim()
}

function createRecordId() {
  return `murl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

function hashKey(value = '') {
  return crypto.createHash('sha256').update(String(value || '')).digest('hex').slice(0, 32)
}

function getUsageDocId(openid = '', period = getCurrentPeriod()) {
  return `${String(openid || '').replace(/[^a-zA-Z0-9_-]/g, '_')}_${period}`
}

function getRecordDocId(idempotencyKey = '') {
  return `idem_${hashKey(idempotencyKey)}`
}

function getDatabase() {
  return cloud.database()
}

function buildDefaultRealUsage(openid = '', userId = '', period = getCurrentPeriod()) {
  const membershipTier = getServerResolvedTier(openid, userId)
  const quota = getPlanQuota(membershipTier)
  const now = new Date().toISOString()
  return {
    _id: getUsageDocId(openid, period),
    _openid: openid,
    openid,
    userId: '',
    membershipTier,
    period,
    monthlyAiPoints: quota.monthlyAiPoints,
    monthlyAiPointsLimit: quota.monthlyAiPoints,
    monthlyAiPointsUsed: 0,
    remaining: quota.monthlyAiPoints,
    monthlyRefineQuota: quota.monthlyRefineQuota,
    monthlyRefineUsed: 0,
    monthlyRunwayVideoQuota: quota.monthlyRunwayVideoQuota,
    monthlyRunwayVideoUsed: 0,
    monthlySampleQuota: quota.monthlySampleQuota,
    monthlySampleUsed: 0,
    status: 'active',
    createdAt: now,
    updatedAt: now
  }
}

function buildRealFailure(action = '', reason = '', reasonText = '', data = {}) {
  return {
    success: false,
    ok: false,
    action,
    mock: false,
    errorCode: reason,
    reason,
    reasonText,
    data
  }
}

function getSafeErrorMeta(error) {
  const rawMessage = error && (error.message || error.errMsg || String(error))
  return {
    errCode: error && (error.code || error.errCode) ? String(error.code || error.errCode) : '',
    errorMessage: String(rawMessage || '').slice(0, 300)
  }
}

function classifyUsageInitError(error, fallbackCode = 'usage_init_failed') {
  const meta = getSafeErrorMeta(error)
  const text = `${meta.errCode} ${meta.errorMessage}`.toLowerCase()
  if (text.includes('permission') || text.includes('access denied') || text.includes('forbidden') || text.includes('unauthorized')) {
    return 'usage_permission_denied'
  }
  if (text.includes('collection') && (text.includes('not exist') || text.includes('not found') || text.includes('missing') || text.includes('does not exist'))) {
    return 'usage_collection_missing'
  }
  return fallbackCode
}

function isUsageDocNotFoundError(error) {
  const meta = getSafeErrorMeta(error)
  const text = `${meta.errCode} ${meta.errorMessage}`.toLowerCase()
  return !text.includes('collection') &&
    (text.includes('document') || text.includes('doc')) &&
    (text.includes('not exist') || text.includes('not found') || text.includes('does not exist'))
}

function buildUsageInitFailure({
  action = '',
  openid = '',
  stage = 'get_or_create_usage',
  error = null,
  errorCode = ''
} = {}) {
  const meta = getSafeErrorMeta(error)
  const resolvedCode = errorCode || classifyUsageInitError(error)
  console.error('[quota_guard:usage-init] failed', {
    action,
    stage,
    hasOpenid: !!openid,
    collectionName: USAGE_COLLECTION,
    errCode: meta.errCode,
    errMessage: meta.errorMessage
  })
  return {
    success: false,
    ok: false,
    action,
    mock: false,
    errorCode: resolvedCode,
    reason: resolvedCode,
    reasonText: resolvedCode === 'missing_openid' ? 'Missing OPENID' : 'Usage init failed',
    stage,
    hasOpenid: !!openid,
    collectionName: USAGE_COLLECTION,
    errCode: meta.errCode,
    errorMessage: meta.errorMessage,
    data: {
      stage,
      hasOpenid: !!openid,
      collectionName: USAGE_COLLECTION,
      errCode: meta.errCode,
      errorMessage: meta.errorMessage
    }
  }
}

function buildConsumeTransactionFailure({
  action = '',
  stage = 'transaction_start',
  collectionName = '',
  usageId = '',
  idempotencyKey = '',
  error = null,
  errorCode = 'transaction_failed',
  reasonText = '真实扣点事务失败'
} = {}) {
  const meta = getSafeErrorMeta(error)
  console.error('[quota_guard:consume-transaction] failed', {
    action,
    stage,
    collectionName,
    hasUsageId: !!usageId,
    hasIdempotencyKey: !!idempotencyKey,
    errCode: meta.errCode,
    errMessage: meta.errorMessage
  })
  return {
    success: false,
    ok: false,
    action,
    mock: false,
    errorCode,
    reason: errorCode,
    reasonText,
    stage,
    collectionName,
    hasUsageId: !!usageId,
    hasIdempotencyKey: !!idempotencyKey,
    errCode: meta.errCode,
    errorMessage: meta.errorMessage,
    data: {
      stage,
      collectionName,
      hasUsageId: !!usageId,
      hasIdempotencyKey: !!idempotencyKey,
      errCode: meta.errCode,
      errorMessage: meta.errorMessage
    }
  }
}

function omitDocumentIdField(document = {}) {
  const payload = {
    ...(document || {})
  }
  delete payload._id
  return payload
}

function buildUsageRecord({
  openid = '',
  userId = '',
  actionType = '',
  sourceTaskId = '',
  extensionTaskId = '',
  costType = '',
  costValue = 0,
  beforeValue = 0,
  afterValue = 0,
  membershipTier = '',
  status = 'checked',
  idempotencyKey = ''
} = {}) {
  return {
    recordId: createRecordId(),
    userId,
    openid,
    actionType,
    sourceTaskId,
    extensionTaskId,
    costType,
    costValue,
    beforeValue,
    afterValue,
    membershipTier,
    status,
    idempotencyKey,
    createdAt: new Date().toISOString()
  }
}

function createQuotaResult({
  ok,
  action,
  usage,
  costType,
  costValue,
  beforeValue,
  afterValue,
  status = 'checked',
  reason = '',
  reasonText = '',
  idempotencyKey = '',
  event = {}
} = {}) {
  return {
    success: !!ok,
    ok: !!ok,
    action,
    mock: true,
    reason,
    reasonText,
    data: {
      usage,
      record: buildUsageRecord({
        openid: usage && usage.openid,
        userId: usage && usage.userId,
        actionType: event.actionType,
        sourceTaskId: event.sourceTaskId || event.taskId || '',
        extensionTaskId: event.extensionTaskId || '',
        costType,
        costValue,
        beforeValue,
        afterValue,
        membershipTier: usage && usage.membershipTier,
        status,
        idempotencyKey
      })
    }
  }
}

function syncUsageAfterValue(result = {}, costType = '', afterValue = 0) {
  const usage = result && result.data && result.data.usage
  if (!usage) {
    return result
  }

  if (costType === 'ai_points') {
    usage.monthlyAiPointsUsed = afterValue
  }
  if (costType === 'refine_quota') {
    usage.monthlyRefineUsed = afterValue
  }
  if (costType === 'runway_video_quota') {
    usage.monthlyRunwayVideoUsed = afterValue
  }
  if (costType === 'sample_quota') {
    usage.monthlySampleUsed = afterValue
  }
  usage.updatedAt = new Date().toISOString()
  return result
}

function forceSyncUsageFromRecord(result = {}) {
  const record = result && result.data && result.data.record
  if (!record) {
    return result
  }
  return syncUsageAfterValue(result, record.costType, record.afterValue)
}

function getIdentity(event = {}, context = {}) {
  const wxContext = cloud.getWXContext ? cloud.getWXContext() : {}
  return {
    openid: wxContext.OPENID || event.openid || '',
    userId: event.userId || ''
  }
}

function shouldRecordIntent(event = {}) {
  return event.mock === true ||
    event.fallback === true ||
    event.sourceIsMockOrFallback === true ||
    /^mock_generate_/.test(String(event.sourceTaskId || event.taskId || ''))
}

function getIdempotencyKey(event = {}) {
  return String(event.idempotencyKey || '').trim()
}

function buildRealQuotaGuardNotImplemented(action = '') {
  return {
    success: false,
    ok: false,
    action,
    mock: false,
    reason: 'REAL_QUOTA_GUARD_NOT_IMPLEMENTED',
    reasonText: 'Real quota guard action is not implemented.',
    data: {
      enableRealQuotaGuard: true,
      realModeImplemented: REAL_MODE_IMPLEMENTED,
      supportedActions: SUPPORTED_ACTIONS,
      costSource: 'server_action_type',
      idempotencyRequiredForConsume: true
    }
  }
}

async function getOrCreateRealUsage(identity = {}, action = '') {
  const openid = identity.openid || ''
  if (!openid) {
    return buildUsageInitFailure({
      action,
      openid,
      stage: 'get_wx_context',
      errorCode: 'missing_openid'
    })
  }

  const db = getDatabase()
  const period = getCurrentPeriod()
  const usageId = getUsageDocId(openid, period)
  const usageRef = db.collection(USAGE_COLLECTION).doc(usageId)
  const usageCollection = db.collection(USAGE_COLLECTION)

  try {
    const existing = await usageRef.get()
    if (existing && existing.data) {
      return {
        success: true,
        ok: true,
        data: {
          usage: existing.data
        }
      }
    }
  } catch (error) {
    if (!isUsageDocNotFoundError(error)) {
      return buildUsageInitFailure({
        action,
        openid,
        stage: 'read_usage_doc',
        error
      })
    }
  }

  const usage = buildDefaultRealUsage(openid, '', period)
  try {
    await usageRef.set({
      data: omitDocumentIdField(usage)
    })
    return {
      success: true,
      ok: true,
      data: {
        usage
      }
    }
  } catch (error) {
    let lastError = error
    try {
      const existing = await usageRef.get()
      if (existing && existing.data) {
        return {
          success: true,
          ok: true,
          data: {
            usage: existing.data
          }
        }
      }
    } catch (readError) {
      lastError = readError
    }

    try {
      await usageCollection.add({
        data: usage
      })
      return {
        success: true,
        ok: true,
        data: {
          usage
        }
      }
    } catch (addError) {
      lastError = addError
      try {
        const existing = await usageRef.get()
        if (existing && existing.data) {
          return {
            success: true,
            ok: true,
            data: {
              usage: existing.data
            }
          }
        }
      } catch (readAfterAddError) {
        lastError = readAfterAddError
      }
    }
    return buildUsageInitFailure({
      action,
      openid,
      stage: 'create_usage_doc',
      error: lastError
    })
  }
}

function buildRealRecord({
  recordId = createRecordId(),
  openid = '',
  userId = '',
  period = getCurrentPeriod(),
  membershipTier = '',
  action = '',
  actionType = '',
  costActionType = '',
  costType = 'ai_points',
  costValue = 0,
  beforeValue = 0,
  afterValue = 0,
  sourceTaskId = '',
  extensionTaskId = '',
  providerTaskId = '',
  idempotencyKey = '',
  status = 'checked',
  statusReason = '',
  rollbackOfRecordId = ''
} = {}) {
  const now = new Date().toISOString()
  return {
    recordId,
    openid,
    userId,
    period,
    membershipTier,
    action,
    actionType,
    costActionType,
    costType,
    costValue,
    beforeValue,
    afterValue,
    sourceTaskId,
    extensionTaskId,
    providerTaskId,
    idempotencyKey,
    status,
    statusReason,
    rollbackOfRecordId,
    createdAt: now,
    updatedAt: now
  }
}

function buildRealQuotaResult({
  ok = false,
  action = '',
  usage = null,
  record = null,
  reason = '',
  reasonText = ''
} = {}) {
  const recordId = record && record.recordId ? record.recordId : ''
  const usageRecordId = recordId
  const usageRecordDocId = record && record._id ? record._id : ''
  return {
    success: !!ok,
    ok: !!ok,
    action,
    mock: false,
    reason,
    reasonText,
    recordId,
    usageRecordId,
    usageRecordDocId,
    data: {
      usage,
      record,
      recordId,
      usageRecordId,
      usageRecordDocId
    }
  }
}

async function findExistingRollbackRecordForOriginal(originalRecord = {}, fallbackRecordId = '') {
  if (originalRecord.status === 'rolled_back' && originalRecord.rollbackOfRecordId) {
    return originalRecord
  }

  const originalRecordId = originalRecord.recordId || fallbackRecordId || originalRecord.rollbackOfRecordId || ''
  if (!originalRecordId && !originalRecord.idempotencyKey) {
    return null
  }

  const db = getDatabase()
  const records = db.collection(RECORDS_COLLECTION)
  const rollbackDocId = `rollback_${hashKey(originalRecordId || originalRecord.idempotencyKey)}`
  try {
    const response = await records.doc(rollbackDocId).get()
    if (response && response.data && response.data.status === 'rolled_back') {
      return {
        ...response.data,
        rollbackOfRecordId: response.data.rollbackOfRecordId || originalRecordId
      }
    }
  } catch (error) {
    // Continue with field lookup for legacy rollback records.
  }

  if (!originalRecordId) {
    return null
  }

  try {
    const response = await records
      .where({
        rollbackOfRecordId: originalRecordId,
        status: 'rolled_back',
        action: 'rollbackUsage'
      })
      .limit(1)
      .get()
    const rollbackRecord = response && response.data && response.data[0]
    return rollbackRecord ? {
      ...rollbackRecord,
      rollbackOfRecordId: rollbackRecord.rollbackOfRecordId || originalRecordId
    } : null
  } catch (error) {
    return null
  }
}

function buildExistingRollbackResponse({
  action = 'rollbackUsage',
  usage = null,
  rollbackRecord = {},
  originalRecordId = ''
} = {}) {
  const rollbackRecordId = rollbackRecord.recordId || ''
  const rollbackOfRecordId = rollbackRecord.rollbackOfRecordId || originalRecordId || ''
  return {
    success: true,
    ok: true,
    action,
    mock: false,
    status: 'rolled_back',
    reason: 'already_rolled_back',
    reasonText: 'Already rolled back',
    recordId: rollbackRecordId,
    rollbackRecordId,
    rollbackOfRecordId,
    beforeValue: rollbackRecord.beforeValue,
    afterValue: rollbackRecord.afterValue,
    data: {
      usage,
      status: 'rolled_back',
      reason: 'already_rolled_back',
      recordId: rollbackRecordId,
      rollbackRecordId,
      rollbackOfRecordId,
      beforeValue: rollbackRecord.beforeValue,
      afterValue: rollbackRecord.afterValue,
      record: rollbackRecord
    }
  }
}

function buildRollbackRecordMissingFailure(action = 'rollbackUsage', originalRecordId = '') {
  return {
    success: false,
    ok: false,
    action,
    mock: false,
    errorCode: 'rollback_record_missing',
    reason: 'rollback_record_missing',
    reasonText: 'Rollback record is missing.',
    rollbackOfRecordId: originalRecordId,
    data: {
      rollbackOfRecordId: originalRecordId
    }
  }
}

async function getRealUsageSummary(event = {}, identity = {}) {
  const result = await getOrCreateRealUsage(identity, event.action)
  if (!result.ok) {
    return {
      ...result,
      action: event.action
    }
  }
  return {
    success: true,
    ok: true,
    action: event.action,
    mock: false,
    data: result.data
  }
}

async function realCheckAiPoints(event = {}, identity = {}) {
  const actionType = String(event.actionType || '').trim()
  const costActionType = getCostActionType(event)
  const costValue = getAiPointCost(costActionType, event.count)
  const usageResult = await getOrCreateRealUsage(identity, event.action)
  if (!usageResult.ok) {
    return {
      ...usageResult,
      action: event.action
    }
  }

  const usage = usageResult.data.usage
  const beforeValue = Number(usage.monthlyAiPointsUsed || 0)
  const afterValue = beforeValue + costValue
  const record = buildRealRecord({
    openid: usage.openid,
    userId: usage.userId || '',
    period: usage.period,
    membershipTier: usage.membershipTier,
    action: event.action,
    actionType,
    costActionType,
    costValue,
    beforeValue,
    afterValue: costValue ? afterValue : beforeValue,
    sourceTaskId: event.sourceTaskId || event.taskId || '',
    extensionTaskId: event.extensionTaskId || '',
    status: 'checked',
    statusReason: ''
  })

  if (!costValue) {
    return buildRealQuotaResult({
      ok: false,
      action: event.action,
      usage,
      record: {
        ...record,
        status: 'failed',
        statusReason: 'unknown_action_type'
      },
      reason: 'unknown_action_type',
      reasonText: '鏈煡鎵ｇ偣绫诲瀷'
    })
  }

  if (afterValue > Number(usage.monthlyAiPoints || 0)) {
    return buildRealQuotaResult({
      ok: false,
      action: event.action,
      usage,
      record: {
        ...record,
        afterValue: beforeValue,
        status: 'failed',
        statusReason: 'insufficient_quota'
      },
      reason: 'insufficient_quota',
      reasonText: '棰濆害涓嶈冻'
    })
  }

  return buildRealQuotaResult({
    ok: true,
    action: event.action,
    usage,
    record
  })
}

async function getExistingRealRecord(idempotencyKey = '') {
  if (!idempotencyKey) {
    return null
  }
  const db = getDatabase()
  try {
    const response = await db.collection(RECORDS_COLLECTION).doc(getRecordDocId(idempotencyKey)).get()
    if (response && response.data) {
      return response.data
    }
  } catch (error) {
    // Continue with field lookup for records created before the stable doc id.
  }
  try {
    const response = await db.collection(RECORDS_COLLECTION)
      .where({ idempotencyKey })
      .limit(1)
      .get()
    return response && response.data && response.data[0] ? response.data[0] : null
  } catch (error) {
    return null
  }
}

async function findRealRecordByRecordIdOrIdempotency({ recordId = '', idempotencyKey = '' } = {}) {
  const db = getDatabase()
  const records = db.collection(RECORDS_COLLECTION)
  if (idempotencyKey) {
    const existing = await getExistingRealRecord(idempotencyKey)
    if (existing) return existing
  }
  if (recordId) {
    try {
      const response = await records.where({ recordId }).limit(1).get()
      return response && response.data && response.data[0] ? response.data[0] : null
    } catch (error) {
      return null
    }
  }
  return null
}

async function realConsumeAiPoints(event = {}, identity = {}) {
  const idempotencyKey = getIdempotencyKey(event)
  if (!idempotencyKey) {
    return buildRealFailure(event.action, 'missing_idempotency_key', 'Missing idempotency key')
  }
  if (!(event.sourceTaskId || event.taskId)) {
    return buildRealFailure(event.action, 'missing_source_task_id', 'Missing source task id')
  }

  const existingRecord = await getExistingRealRecord(idempotencyKey)
  if (existingRecord) {
    const usageResult = await getOrCreateRealUsage(identity, event.action)
    const usage = usageResult.ok ? usageResult.data.usage : null
    if (existingRecord.status === 'rolled_back') {
      return buildRealQuotaResult({
        ok: false,
        action: event.action,
        usage,
        record: existingRecord,
        reason: 'already_rolled_back',
        reasonText: '璇ユ祦姘村凡鍥炴粴'
      })
    }
    return buildRealQuotaResult({
      ok: existingRecord.status === 'consumed' || existingRecord.status === 'finalized',
      action: event.action,
      usage,
      record: existingRecord,
      reason: existingRecord.status === 'pending' ? 'pending' : '',
      reasonText: existingRecord.status === 'pending' ? 'Record is pending' : ''
    })
  }

  const actionType = String(event.actionType || '').trim()
  const costActionType = getCostActionType(event)
  const costValue = getAiPointCost(costActionType, event.count)
  if (!costValue) {
    return buildRealFailure(event.action, 'unknown_action_type', 'Unknown action type', {
      costActionType
    })
  }

  const usageResult = await getOrCreateRealUsage(identity, event.action)
  if (!usageResult.ok) {
    return {
      ...usageResult,
      action: event.action
    }
  }

  const db = getDatabase()
  const period = getCurrentPeriod()
  const usageId = getUsageDocId(identity.openid, period)
  const recordDocId = getRecordDocId(idempotencyKey)
  const _ = db.command
  if (typeof db.runTransaction !== 'function') {
    return buildConsumeTransactionFailure({
      action: event.action,
      stage: 'transaction_start',
      collectionName: '',
      usageId,
      idempotencyKey,
      errorCode: 'transaction_not_supported',
      reasonText: '真实扣点事务不可用',
      error: new Error('db.runTransaction is not available')
    })
  }

  let transactionStage = 'transaction_start'
  let transactionCollectionName = ''
  const setTransactionStage = (stage, collectionName = '') => {
    transactionStage = stage
    transactionCollectionName = collectionName
  }
  try {
    setTransactionStage('transaction_start')
    const result = await db.runTransaction(async (transaction) => {
      const usageRef = transaction.collection(USAGE_COLLECTION).doc(usageId)
      const recordRef = transaction.collection(RECORDS_COLLECTION).doc(recordDocId)

      try {
        setTransactionStage('transaction_check_existing_record', RECORDS_COLLECTION)
        const duplicate = await recordRef.get()
        if (duplicate && duplicate.data) {
          setTransactionStage('transaction_read_usage', USAGE_COLLECTION)
          const usageSnapshot = await usageRef.get()
          return {
            usage: usageSnapshot.data,
            record: duplicate.data,
            duplicate: true
          }
        }
      } catch (error) {
        // No record exists; continue with first consume.
      }
      try {
        setTransactionStage('transaction_check_existing_record', RECORDS_COLLECTION)
        const duplicateByKey = await transaction.collection(RECORDS_COLLECTION)
          .where({ idempotencyKey })
          .limit(1)
          .get()
        const duplicateRecord = duplicateByKey && duplicateByKey.data && duplicateByKey.data[0]
        if (duplicateRecord) {
          setTransactionStage('transaction_read_usage', USAGE_COLLECTION)
          const usageSnapshot = await usageRef.get()
          return {
            usage: usageSnapshot.data,
            record: duplicateRecord,
            duplicate: true
          }
        }
      } catch (error) {
        // Field lookup is a secondary guard; continue when unsupported.
      }

      setTransactionStage('transaction_read_usage', USAGE_COLLECTION)
      const usageSnapshot = await usageRef.get()
      const usage = usageSnapshot.data
      const beforeValue = Number(usage.monthlyAiPointsUsed || 0)
      const afterValue = beforeValue + costValue
      if (afterValue > Number(usage.monthlyAiPoints || 0)) {
        throw Object.assign(new Error('insufficient_quota'), {
          reason: 'insufficient_quota',
          usage,
          beforeValue,
          afterValue: beforeValue
        })
      }

      const now = new Date().toISOString()
      const record = {
        _id: recordDocId,
        ...buildRealRecord({
          openid: usage.openid,
          userId: usage.userId || '',
          period: usage.period,
          membershipTier: usage.membershipTier,
          action: event.action,
          actionType,
          costActionType,
          costValue,
          beforeValue,
          afterValue,
          sourceTaskId: event.sourceTaskId || event.taskId || '',
          extensionTaskId: event.extensionTaskId || '',
          providerTaskId: event.providerTaskId || '',
          idempotencyKey,
          status: 'consumed'
        })
      }

      setTransactionStage('transaction_update_usage', USAGE_COLLECTION)
      await usageRef.update({
        data: {
          monthlyAiPointsUsed: _.inc(costValue),
          updatedAt: now
        }
      })
      setTransactionStage('transaction_create_record', RECORDS_COLLECTION)
      const recordPayload = omitDocumentIdField(record)
      await recordRef.set({
        data: recordPayload
      })

      setTransactionStage('transaction_commit')
      return {
        usage: {
          ...usage,
          monthlyAiPointsUsed: afterValue,
          updatedAt: now
        },
        record
      }
    })

    return buildRealQuotaResult({
      ok: result.record && result.record.status === 'consumed',
      action: event.action,
      usage: result.usage,
      record: result.record,
      reason: result.record && result.record.status === 'pending' ? 'pending' : '',
      reasonText: result.record && result.record.status === 'pending' ? 'Record is pending' : ''
    })
  } catch (error) {
    if (error && error.reason === 'insufficient_quota') {
      return buildRealQuotaResult({
        ok: false,
        action: event.action,
        usage: error.usage,
        record: buildRealRecord({
          openid: identity.openid,
          action: event.action,
          actionType,
          costActionType,
          costValue,
          beforeValue: error.beforeValue,
          afterValue: error.afterValue,
          sourceTaskId: event.sourceTaskId || event.taskId || '',
          idempotencyKey,
          status: 'failed',
          statusReason: 'insufficient_quota'
        }),
        reason: 'insufficient_quota',
        reasonText: '棰濆害涓嶈冻'
      })
    }
    return buildConsumeTransactionFailure({
      action: event.action,
      stage: transactionStage,
      collectionName: transactionCollectionName,
      usageId,
      idempotencyKey,
      error,
      errorCode: 'transaction_failed',
      reasonText: '真实扣点事务失败'
    })
  }
}

async function realRollbackUsage(event = {}, identity = {}) {
  const idempotencyKey = getIdempotencyKey(event)
  const recordId = String(event.recordId || '').trim()
  if (!recordId && !idempotencyKey) {
    return buildRealFailure(event.action, 'record_not_found', 'Missing original record')
  }

  const db = getDatabase()
  const records = db.collection(RECORDS_COLLECTION)
  let originalRecord = null
  if (idempotencyKey) {
    originalRecord = await getExistingRealRecord(idempotencyKey)
  }
  if (!originalRecord && recordId) {
    try {
      const response = await records.where({ recordId }).limit(1).get()
      originalRecord = response && response.data && response.data[0]
    } catch (error) {
      originalRecord = null
    }
  }
  if (!originalRecord && event.rollbackOfRecordId) {
    try {
      const response = await records.where({ recordId: event.rollbackOfRecordId }).limit(1).get()
      originalRecord = response && response.data && response.data[0]
    } catch (error) {
      originalRecord = null
    }
  }

  if (!originalRecord) {
    return buildRealFailure(event.action, 'record_not_found', 'Original quota record not found')
  }
  if (originalRecord.status === 'finalized') {
    return buildRealFailure(event.action, 'QUOTA_RECORD_FINALIZED', 'Finalized quota record cannot be rolled back', {
      recordId: originalRecord.recordId,
      status: originalRecord.status
    })
  }
  if (originalRecord.status === 'rolled_back' || originalRecord.rollbackStatus === 'rolled_back') {
    const usageResult = await getOrCreateRealUsage(identity, event.action)
    const rollbackRecord = await findExistingRollbackRecordForOriginal(originalRecord, recordId)
    if (!rollbackRecord) {
      return buildRollbackRecordMissingFailure(event.action, originalRecord.recordId || recordId)
    }
    return buildExistingRollbackResponse({
      action: event.action,
      usage: usageResult.ok ? usageResult.data.usage : null,
      rollbackRecord,
      originalRecordId: originalRecord.recordId || recordId
    })
  }
  if (originalRecord.status !== 'consumed') {
    return buildRealFailure(event.action, 'QUOTA_RECORD_NOT_ROLLBACKABLE', 'Only consumed quota record can be rolled back', {
      recordId: originalRecord.recordId,
      status: originalRecord.status
    })
  }

  if (typeof db.runTransaction !== 'function') {
    return buildRealFailure(event.action, 'transaction_failed', 'Transaction is not available')
  }

  const period = originalRecord.period || getCurrentPeriod()
  const usageId = getUsageDocId(originalRecord.openid || identity.openid, period)
  const rollbackRecordDocId = `rollback_${hashKey(originalRecord.recordId || originalRecord.idempotencyKey)}`
  const _ = db.command

  try {
    const result = await db.runTransaction(async (transaction) => {
      const usageRef = transaction.collection(USAGE_COLLECTION).doc(usageId)
      const rollbackRef = transaction.collection(RECORDS_COLLECTION).doc(rollbackRecordDocId)
      const originalDocId = originalRecord._id || getRecordDocId(originalRecord.idempotencyKey)
      const originalRef = transaction.collection(RECORDS_COLLECTION).doc(originalDocId)

      try {
        const existingRollback = await rollbackRef.get()
        if (existingRollback && existingRollback.data) {
          const usageSnapshot = await usageRef.get()
          return {
            usage: usageSnapshot.data,
            record: {
              ...existingRollback.data,
              rollbackOfRecordId: existingRollback.data.rollbackOfRecordId || originalRecord.recordId || recordId
            }
          }
        }
      } catch (error) {
        // No rollback record exists; continue.
      }

      const latestOriginalSnapshot = await originalRef.get()
      const latestOriginal = (latestOriginalSnapshot && latestOriginalSnapshot.data) || originalRecord
      if (latestOriginal.status === 'finalized') {
        throw Object.assign(new Error('finalized'), {
          reason: 'QUOTA_RECORD_FINALIZED',
          record: latestOriginal
        })
      }
      if (latestOriginal.status === 'rolled_back' || latestOriginal.rollbackStatus === 'rolled_back') {
        const rollbackSnapshot = await rollbackRef.get()
        if (rollbackSnapshot && rollbackSnapshot.data) {
          return {
            usage: (await usageRef.get()).data,
            record: {
              ...rollbackSnapshot.data,
              rollbackOfRecordId: rollbackSnapshot.data.rollbackOfRecordId || latestOriginal.recordId || recordId
            },
            alreadyRolledBack: true
          }
        }
        throw Object.assign(new Error('rollback_record_missing'), {
          reason: 'rollback_record_missing',
          record: latestOriginal
        })
      }
      if (latestOriginal.status !== 'consumed') {
        throw Object.assign(new Error('not_rollbackable'), {
          reason: 'QUOTA_RECORD_NOT_ROLLBACKABLE',
          record: latestOriginal
        })
      }

      const usageSnapshot = await usageRef.get()
      const usage = usageSnapshot.data
      const costValue = Number(latestOriginal.costValue || 0)
      const beforeValue = Math.max(
        Number(usage.monthlyAiPointsUsed || 0),
        Number(latestOriginal.afterValue || 0),
        costValue
      )
      const afterValue = Math.max(0, beforeValue - costValue)
      const now = new Date().toISOString()
      const rollbackRecord = {
        _id: rollbackRecordDocId,
        ...buildRealRecord({
          recordId: createRecordId(),
          openid: usage.openid,
          userId: usage.userId || '',
          period: usage.period,
          membershipTier: usage.membershipTier,
          action: event.action,
          actionType: latestOriginal.actionType,
          costActionType: latestOriginal.costActionType,
          costValue,
          beforeValue,
          afterValue,
          sourceTaskId: latestOriginal.sourceTaskId || '',
          extensionTaskId: latestOriginal.extensionTaskId || '',
          providerTaskId: latestOriginal.providerTaskId || '',
          idempotencyKey: event.rollbackIdempotencyKey || `rollback:${latestOriginal.idempotencyKey || latestOriginal.recordId}`,
          status: 'rolled_back',
          statusReason: event.statusReason || event.reason || 'manual_rollback',
          rollbackOfRecordId: latestOriginal.recordId || recordId
        })
      }

      await usageRef.update({
        data: {
          monthlyAiPointsUsed: afterValue,
          updatedAt: now
        }
      })
      await originalRef.update({
        data: {
          rollbackStatus: 'rolled_back',
          updatedAt: now
        }
      })
      await rollbackRef.set({
        data: omitDocumentIdField(rollbackRecord)
      })

      return {
        usage: {
          ...usage,
          monthlyAiPointsUsed: afterValue,
          updatedAt: now
        },
        record: rollbackRecord
      }
    })

    if (result.alreadyRolledBack) {
      return buildExistingRollbackResponse({
        action: event.action,
        usage: result.usage,
        rollbackRecord: result.record,
        originalRecordId: originalRecord.recordId || recordId
      })
    }
    const rollbackRecordId = result.record && result.record.recordId
    const rollbackOfRecordId = result.record && result.record.rollbackOfRecordId
    return {
      ...buildRealQuotaResult({
        ok: true,
        action: event.action,
        usage: result.usage,
        record: result.record
      }),
      status: 'rolled_back',
      recordId: rollbackRecordId,
      rollbackRecordId,
      rollbackOfRecordId,
      beforeValue: result.record && result.record.beforeValue,
      afterValue: result.record && result.record.afterValue,
      data: {
        usage: result.usage,
        status: 'rolled_back',
        recordId: rollbackRecordId,
        rollbackRecordId,
        rollbackOfRecordId,
        beforeValue: result.record && result.record.beforeValue,
        afterValue: result.record && result.record.afterValue,
        record: result.record
      }
    }
  } catch (error) {
    if (error && error.reason) {
      if (error.reason === 'rollback_record_missing') {
        return buildRollbackRecordMissingFailure(event.action, error.record && (error.record.recordId || recordId))
      }
      return buildRealFailure(event.action, error.reason, error.reason, {
        recordId: error.record && error.record.recordId,
        status: error.record && error.record.status
      })
    }
    return buildRealFailure(event.action, 'transaction_failed', '鐪熷疄鍥炴粴浜嬪姟澶辫触')
  }
}

async function realFinalizeUsage(event = {}, identity = {}) {
  const recordId = String(event.recordId || '').trim()
  const idempotencyKey = getIdempotencyKey(event)
  if (!recordId && !idempotencyKey) {
    return buildRealFailure(event.action, 'QUOTA_RECORD_NOT_FOUND', 'Missing quota record')
  }

  const originalRecord = await findRealRecordByRecordIdOrIdempotency({ recordId, idempotencyKey })
  if (!originalRecord) {
    return buildRealFailure(event.action, 'QUOTA_RECORD_NOT_FOUND', 'Quota record not found')
  }
  if (originalRecord.status === 'finalized') {
    const usageResult = await getOrCreateRealUsage(identity, event.action)
    return buildRealQuotaResult({
      ok: true,
      action: event.action,
      usage: usageResult.ok ? usageResult.data.usage : null,
      record: originalRecord,
      reason: 'already_finalized',
      reasonText: 'Quota record already finalized'
    })
  }
  if (originalRecord.status === 'rolled_back' || originalRecord.rollbackStatus === 'rolled_back') {
    return buildRealFailure(event.action, 'QUOTA_RECORD_ALREADY_ROLLED_BACK', 'Rolled back quota record cannot be finalized', {
      recordId: originalRecord.recordId,
      status: originalRecord.status
    })
  }
  if (originalRecord.rollbackOfRecordId) {
    return buildRealFailure(event.action, 'QUOTA_RECORD_ALREADY_ROLLED_BACK', 'Rollback record cannot be finalized', {
      recordId: originalRecord.recordId,
      rollbackOfRecordId: originalRecord.rollbackOfRecordId
    })
  }
  if (originalRecord.status !== 'consumed') {
    return buildRealFailure(event.action, 'QUOTA_RECORD_NOT_CONSUMABLE', 'Only consumed quota record can be finalized', {
      recordId: originalRecord.recordId,
      status: originalRecord.status
    })
  }

  const db = getDatabase()
  if (typeof db.runTransaction !== 'function') {
    return buildRealFailure(event.action, 'transaction_failed', 'Transaction is not available')
  }

  const originalDocId = originalRecord._id || getRecordDocId(originalRecord.idempotencyKey)
  const period = originalRecord.period || getCurrentPeriod()
  const usageId = getUsageDocId(originalRecord.openid || identity.openid, period)

  try {
    const result = await db.runTransaction(async (transaction) => {
      const originalRef = transaction.collection(RECORDS_COLLECTION).doc(originalDocId)
      const usageRef = transaction.collection(USAGE_COLLECTION).doc(usageId)
      const originalSnapshot = await originalRef.get()
      const latestRecord = (originalSnapshot && originalSnapshot.data) || originalRecord

      if (latestRecord.status === 'finalized') {
        const usageSnapshot = await usageRef.get()
        return {
          usage: usageSnapshot.data,
          record: latestRecord,
          duplicate: true
        }
      }
      if (latestRecord.status === 'rolled_back' || latestRecord.rollbackStatus === 'rolled_back' || latestRecord.rollbackOfRecordId) {
        throw Object.assign(new Error('already_rolled_back'), {
          reason: 'QUOTA_RECORD_ALREADY_ROLLED_BACK',
          record: latestRecord
        })
      }
      if (latestRecord.status !== 'consumed') {
        throw Object.assign(new Error('not_consumable'), {
          reason: 'QUOTA_RECORD_NOT_CONSUMABLE',
          record: latestRecord
        })
      }

      const now = new Date().toISOString()
      const finalizeReason = event.reason || event.statusReason || 'provider_success'
      await originalRef.update({
        data: {
          status: 'finalized',
          finalizedAt: now,
          finalizeReason,
          providerTaskId: event.providerTaskId || latestRecord.providerTaskId || '',
          updatedAt: now
        }
      })
      const usageSnapshot = await usageRef.get()
      return {
        usage: usageSnapshot.data,
        record: {
          ...latestRecord,
          status: 'finalized',
          finalizedAt: now,
          finalizeReason,
          providerTaskId: event.providerTaskId || latestRecord.providerTaskId || '',
          updatedAt: now
        }
      }
    })

    return buildRealQuotaResult({
      ok: true,
      action: event.action,
      usage: result.usage,
      record: result.record,
      reason: result.duplicate ? 'already_finalized' : '',
      reasonText: result.duplicate ? 'Quota record already finalized' : ''
    })
  } catch (error) {
    if (error && error.reason) {
      return buildRealFailure(event.action, error.reason, error.reason, {
        recordId: error.record && error.record.recordId,
        status: error.record && error.record.status
      })
    }
    return buildRealFailure(event.action, 'transaction_failed', 'Finalize transaction failed')
  }
}

function checkAiPoints(event = {}, identity = {}) {
  const usage = buildMockUsage(identity.openid, identity.userId)
  const costValue = getAiPointCost(event.actionType, event.count)
  const beforeValue = usage.monthlyAiPointsUsed
  const afterValue = beforeValue + costValue

  if (!costValue) {
    return createQuotaResult({
      ok: false,
      action: event.action,
      usage,
      costType: 'ai_points',
      costValue,
      beforeValue,
      afterValue: beforeValue,
      reason: 'unknown_action_type',
      reasonText: '鏈煡鍔熻兘鎵ｇ偣绫诲瀷',
      event
    })
  }

  if (afterValue > usage.monthlyAiPoints) {
    return createQuotaResult({
      ok: false,
      action: event.action,
      usage,
      costType: 'ai_points',
      costValue,
      beforeValue,
      afterValue: beforeValue,
      reason: 'insufficient_ai_points',
      reasonText: 'AI 鐐规暟涓嶈冻',
      event
    })
  }

  return createQuotaResult({
    ok: true,
    action: event.action,
    usage,
    costType: 'ai_points',
    costValue,
    beforeValue,
    afterValue,
    event
  })
}

function consumeAiPoints(event = {}, identity = {}) {
  const idempotencyKey = getIdempotencyKey(event)
  if (!idempotencyKey) {
    return {
      success: false,
      ok: false,
      action: event.action,
      reason: 'missing_idempotency_key',
      reasonText: 'Missing idempotency key',
      mock: true
    }
  }

  if (shouldRecordIntent(event)) {
    const usage = buildMockUsage(identity.openid, identity.userId)
    return createQuotaResult({
      ok: true,
      action: event.action,
      usage,
      costType: 'ai_points',
      costValue: 0,
      beforeValue: usage.monthlyAiPointsUsed,
      afterValue: usage.monthlyAiPointsUsed,
      status: 'intent_recorded',
      idempotencyKey,
      event
    })
  }

  const result = checkAiPoints(event, identity)
  result.action = event.action
  result.data.record.status = result.ok ? 'consumed' : 'failed'
  result.data.record.idempotencyKey = idempotencyKey
  if (result.ok) {
    syncUsageAfterValue(result, 'ai_points', result.data.record.afterValue)
  }
  return forceSyncUsageFromRecord(result)
}

function checkRefineQuota(event = {}, identity = {}) {
  const usage = buildMockUsage(identity.openid, identity.userId)
  const costValue = normalizeCount(event.count)
  const beforeValue = usage.monthlyRefineUsed
  const afterValue = beforeValue + costValue

  if (afterValue > usage.monthlyRefineQuota) {
    return createQuotaResult({
      ok: false,
      action: event.action,
      usage,
      costType: 'refine_quota',
      costValue,
      beforeValue,
      afterValue: beforeValue,
      reason: 'insufficient_refine_quota',
      reasonText: '鏈湀绮句慨棰濆害涓嶈冻',
      event
    })
  }

  return createQuotaResult({
    ok: true,
    action: event.action,
    usage,
    costType: 'refine_quota',
    costValue,
    beforeValue,
    afterValue,
    event
  })
}

function consumeRefineQuota(event = {}, identity = {}) {
  const idempotencyKey = getIdempotencyKey(event)
  if (!idempotencyKey) {
    return {
      success: false,
      ok: false,
      action: event.action,
      reason: 'missing_idempotency_key',
      reasonText: 'Missing idempotency key',
      mock: true
    }
  }

  if (shouldRecordIntent(event)) {
    const usage = buildMockUsage(identity.openid, identity.userId)
    return createQuotaResult({
      ok: true,
      action: event.action,
      usage,
      costType: 'refine_quota',
      costValue: 0,
      beforeValue: usage.monthlyRefineUsed,
      afterValue: usage.monthlyRefineUsed,
      status: 'intent_recorded',
      idempotencyKey,
      event
    })
  }

  const result = checkRefineQuota(event, identity)
  result.data.record.status = result.ok ? 'consumed' : 'failed'
  result.data.record.idempotencyKey = idempotencyKey
  if (result.ok) {
    syncUsageAfterValue(result, 'refine_quota', result.data.record.afterValue)
  }
  return forceSyncUsageFromRecord(result)
}

function checkRunwayVideoQuota(event = {}, identity = {}) {
  const usage = buildMockUsage(identity.openid, identity.userId)
  const beforeValue = usage.monthlyRunwayVideoUsed
  const afterValue = beforeValue + 1

  if (afterValue > usage.monthlyRunwayVideoQuota) {
    return createQuotaResult({
      ok: false,
      action: event.action,
      usage,
      costType: 'runway_video_quota',
      costValue: 1,
      beforeValue,
      afterValue: beforeValue,
      reason: 'insufficient_runway_video_quota',
      reasonText: '鏈湀璧扮瑙嗛棰濆害涓嶈冻',
      event
    })
  }

  return createQuotaResult({
    ok: true,
    action: event.action,
    usage,
    costType: 'runway_video_quota',
    costValue: 1,
    beforeValue,
    afterValue,
    event
  })
}

function consumeRunwayVideoQuota(event = {}, identity = {}) {
  const idempotencyKey = getIdempotencyKey(event)
  if (!idempotencyKey) {
    return {
      success: false,
      ok: false,
      action: event.action,
      reason: 'missing_idempotency_key',
      reasonText: 'Missing idempotency key',
      mock: true
    }
  }
  const result = checkRunwayVideoQuota(event, identity)
  result.data.record.status = result.ok ? 'consumed' : 'failed'
  result.data.record.idempotencyKey = idempotencyKey
  if (result.ok) {
    syncUsageAfterValue(result, 'runway_video_quota', result.data.record.afterValue)
  }
  return forceSyncUsageFromRecord(result)
}

function rollbackUsage(event = {}, identity = {}) {
  const usage = buildMockUsage(identity.openid, identity.userId)
  const costType = event.costType || ''
  const afterValue = Number(event.afterValue || 0) || 0
  const result = {
    success: true,
    ok: true,
    action: event.action,
    mock: true,
    reason: '',
    reasonText: '',
    data: {
      usage,
      record: buildUsageRecord({
        openid: usage.openid,
        userId: usage.userId,
        actionType: event.actionType || '',
        sourceTaskId: event.sourceTaskId || event.taskId || '',
        extensionTaskId: event.extensionTaskId || '',
        costType: event.costType || '',
        costValue: Number(event.costValue || 0) || 0,
        beforeValue: Number(event.beforeValue || 0) || 0,
        afterValue,
        membershipTier: usage.membershipTier,
        status: 'rolled_back',
        idempotencyKey: getIdempotencyKey(event)
      })
    }
  }
  return syncUsageAfterValue(result, costType, afterValue)
}

function finalizeUsage(event = {}, identity = {}) {
  const usage = buildMockUsage(identity.openid, identity.userId)
  return {
    success: true,
    ok: true,
    action: event.action,
    mock: true,
    status: 'finalized_mock',
    data: {
      status: 'finalized_mock',
      usage,
      record: buildUsageRecord({
        openid: usage.openid,
        userId: usage.userId,
        actionType: event.actionType || event.costActionType || '',
        sourceTaskId: event.sourceTaskId || event.taskId || '',
        extensionTaskId: event.extensionTaskId || '',
        costType: event.costType || 'ai_points',
        costValue: Number(event.costValue || 0) || 0,
        beforeValue: Number(event.beforeValue || 0) || 0,
        afterValue: Number(event.afterValue || 0) || 0,
        membershipTier: usage.membershipTier,
        status: 'finalized_mock',
        idempotencyKey: getIdempotencyKey(event)
      })
    }
  }
}

exports.main = async (event = {}, context = {}) => {
  const action = event.action || ''
  const identity = getIdentity(event, context)
  console.log('[quota_guard] action received', {
    action,
    enableRealQuotaGuard: ENABLE_REAL_QUOTA_GUARD,
    realModeImplemented: REAL_MODE_IMPLEMENTED,
    hasOpenid: !!identity.openid,
    hasUserId: !!identity.userId,
    hasIdempotencyKey: !!getIdempotencyKey(event),
    actionType: event.actionType || ''
  })

  if (action === 'debugConfig') {
    return {
      success: true,
      ok: true,
      action,
      mock: !ENABLE_REAL_QUOTA_GUARD,
      enableRealQuotaGuard: ENABLE_REAL_QUOTA_GUARD,
      realModeImplemented: REAL_MODE_IMPLEMENTED,
      supportedActions: SUPPORTED_ACTIONS,
      costSource: 'server_action_type',
      idempotencyRequiredForConsume: true,
      finalizeImplemented: true,
      usageInitImplemented: true,
      usageDefaultLimit: PLAN_QUOTA[DEFAULT_MOCK_TIER].monthlyAiPoints,
      usageInitRequiresOpenid: true,
      consumeTransactionImplemented: true,
      consumeTransactionRequiresIdempotency: true,
      terminalStates: ['finalized', 'rolled_back'],
      rollbackForbiddenStatuses: ['finalized'],
      collections: {
        usage: USAGE_COLLECTION,
        records: RECORDS_COLLECTION
      },
      data: {
        mock: !ENABLE_REAL_QUOTA_GUARD,
        enableRealQuotaGuard: ENABLE_REAL_QUOTA_GUARD,
        realModeImplemented: REAL_MODE_IMPLEMENTED,
        version: 'quota_guard_20260605_sync_usage_v2',
        supportedActions: SUPPORTED_ACTIONS,
        costSource: 'server_action_type',
        idempotencyRequiredForConsume: true,
        finalizeImplemented: true,
        usageInitImplemented: true,
        usageDefaultLimit: PLAN_QUOTA[DEFAULT_MOCK_TIER].monthlyAiPoints,
        usageInitRequiresOpenid: true,
        consumeTransactionImplemented: true,
        consumeTransactionRequiresIdempotency: true,
        terminalStates: ['finalized', 'rolled_back'],
        rollbackForbiddenStatuses: ['finalized'],
        collections: {
          usage: USAGE_COLLECTION,
          records: RECORDS_COLLECTION
        }
      }
    }
  }

  if (ENABLE_REAL_QUOTA_GUARD) {
    if (action === 'getUsageSummary') return getRealUsageSummary(event, identity)
    if (action === 'checkAiPoints') return realCheckAiPoints(event, identity)
    if (action === 'consumeAiPoints') return realConsumeAiPoints(event, identity)
    if (action === 'rollbackUsage') return realRollbackUsage(event, identity)
    if (action === 'finalizeUsage') return realFinalizeUsage(event, identity)
    if (
      action === 'checkRefineQuota' ||
      action === 'consumeRefineQuota' ||
      action === 'checkRunwayVideoQuota' ||
      action === 'consumeRunwayVideoQuota'
    ) {
      return {
        ...buildRealQuotaGuardNotImplemented(action),
        reason: 'REAL_QUOTA_ACTION_NOT_IMPLEMENTED',
        reasonText: 'This real quota action is not implemented.'
      }
    }
    return buildRealQuotaGuardNotImplemented(action)
  }

  if (action === 'getUsageSummary') {
    return {
      success: true,
      ok: true,
      action,
      mock: true,
      data: {
        usage: buildMockUsage(identity.openid, identity.userId)
      }
    }
  }

  if (action === 'checkAiPoints') return checkAiPoints(event, identity)
  if (action === 'consumeAiPoints') return consumeAiPoints(event, identity)
  if (action === 'checkRefineQuota') return checkRefineQuota(event, identity)
  if (action === 'consumeRefineQuota') return consumeRefineQuota(event, identity)
  if (action === 'checkRunwayVideoQuota') return checkRunwayVideoQuota(event, identity)
  if (action === 'consumeRunwayVideoQuota') return consumeRunwayVideoQuota(event, identity)
  if (action === 'rollbackUsage') return rollbackUsage(event, identity)
  if (action === 'finalizeUsage') return finalizeUsage(event, identity)

  return {
    success: false,
    ok: false,
    action,
    mock: true,
    reason: 'unsupported_action',
    reasonText: '涓嶆敮鎸佺殑棰濆害鏍￠獙鍔ㄤ綔'
  }
}
