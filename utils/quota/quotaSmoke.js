import { initCloudBase, isCloudBaseReady } from '../cloudbase/init'

const QUOTA_FUNCTION_NAME = 'quota_guard'
const BUSINESS_ACTION = 'model_replace'
const COST_ACTION_TYPE = 'ai_model_image'

function createSmokeTaskId(caseName = 'case') {
  return `quota_smoke_${caseName}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

function ensureCloudReady() {
  if (typeof wx === 'undefined' || !wx || !wx.cloud || typeof wx.cloud.callFunction !== 'function') {
    throw new Error('wx.cloud.callFunction is unavailable')
  }
  if (!isCloudBaseReady()) initCloudBase()
  if (!isCloudBaseReady()) throw new Error('CloudBase is not ready')
}

async function callQuotaGuard(data = {}) {
  ensureCloudReady()
  const response = await wx.cloud.callFunction({
    name: QUOTA_FUNCTION_NAME,
    data
  })
  return (response && response.result) || {}
}

function getRecord(result = {}) {
  return (result.data && result.data.record) || null
}

function assertRealResult(result = {}, expectedStatus = '') {
  const record = getRecord(result)
  if (!result.ok) {
    throw new Error(result.reasonText || result.reason || result.errorCode || 'quota_guard returned failure')
  }
  if (result.mock) throw new Error('quota_guard is still in mock mode')
  if (!record || !record.recordId) throw new Error('quotaRecordId is missing')
  if (expectedStatus && record.status !== expectedStatus) {
    throw new Error(`Expected ${expectedStatus}, received ${record.status || 'empty'}`)
  }
  return record
}

function logSmoke(caseName, quotaRecordId, status, result) {
  console.log('[quota:smoke]', {
    case: caseName,
    quotaRecordId: quotaRecordId || '',
    status: status || '',
    result
  })
}

async function consume(taskId, idempotencyKey) {
  return callQuotaGuard({
    action: 'consumeAiPoints',
    actionType: COST_ACTION_TYPE,
    costActionType: COST_ACTION_TYPE,
    sourceTaskId: taskId,
    taskId,
    count: 1,
    idempotencyKey
  })
}

async function finalize(recordId) {
  return callQuotaGuard({
    action: 'finalizeUsage',
    recordId,
    reason: 'quota_alpha_smoke_success'
  })
}

async function rollback(recordId, reason = 'quota_alpha_smoke_cleanup') {
  return callQuotaGuard({
    action: 'rollbackUsage',
    recordId,
    statusReason: reason
  })
}

function buildFailure(error) {
  return {
    passed: false,
    message: error && error.message ? error.message : 'Unknown smoke failure'
  }
}

export async function testConsumeSuccess(options = {}) {
  const caseName = 'consume_success'
  let record = null
  try {
    const taskId = createSmokeTaskId(caseName)
    const result = await consume(taskId, `${taskId}:${BUSINESS_ACTION}`)
    record = assertRealResult(result, 'consumed')
    const smokeResult = {
      passed: true,
      hasQuotaRecordId: true,
      consumed: true
    }
    logSmoke(caseName, record.recordId, record.status, smokeResult)
    if (options.cleanup !== false) await rollback(record.recordId)
    return { ...smokeResult, quotaRecordId: record.recordId, status: record.status }
  } catch (error) {
    const failure = buildFailure(error)
    logSmoke(caseName, record && record.recordId, 'failed', failure)
    throw error
  }
}

export async function testFinalize() {
  const caseName = 'finalize'
  let consumedRecord = null
  try {
    const taskId = createSmokeTaskId(caseName)
    const consumeResult = await consume(taskId, `${taskId}:${BUSINESS_ACTION}`)
    consumedRecord = assertRealResult(consumeResult, 'consumed')
    const finalizeResult = await finalize(consumedRecord.recordId)
    const finalizedRecord = assertRealResult(finalizeResult, 'finalized')
    const smokeResult = {
      passed: finalizedRecord.recordId === consumedRecord.recordId,
      transition: 'consumed -> finalized'
    }
    if (!smokeResult.passed) throw new Error('Finalize returned a different quotaRecordId')
    logSmoke(caseName, finalizedRecord.recordId, finalizedRecord.status, smokeResult)
    return { ...smokeResult, quotaRecordId: finalizedRecord.recordId, status: finalizedRecord.status }
  } catch (error) {
    if (consumedRecord) {
      try {
        await rollback(consumedRecord.recordId, 'quota_alpha_finalize_failed')
      } catch (rollbackError) {
        // Preserve the original assertion failure.
      }
    }
    const failure = buildFailure(error)
    logSmoke(caseName, consumedRecord && consumedRecord.recordId, 'failed', failure)
    throw error
  }
}

export async function testRollback() {
  const caseName = 'rollback'
  let consumedRecord = null
  try {
    const taskId = createSmokeTaskId(caseName)
    const consumeResult = await consume(taskId, `${taskId}:${BUSINESS_ACTION}`)
    consumedRecord = assertRealResult(consumeResult, 'consumed')
    const rollbackResult = await rollback(consumedRecord.recordId, 'quota_alpha_smoke_failure')
    const rollbackRecord = assertRealResult(rollbackResult, 'rolled_back')
    const smokeResult = {
      passed: rollbackRecord.rollbackOfRecordId === consumedRecord.recordId,
      transition: 'consumed -> rolled_back'
    }
    if (!smokeResult.passed) throw new Error('Rollback record does not reference the consumed record')
    logSmoke(caseName, consumedRecord.recordId, rollbackRecord.status, smokeResult)
    return { ...smokeResult, quotaRecordId: consumedRecord.recordId, status: rollbackRecord.status }
  } catch (error) {
    const failure = buildFailure(error)
    logSmoke(caseName, consumedRecord && consumedRecord.recordId, 'failed', failure)
    throw error
  }
}

export async function testIdempotent() {
  const caseName = 'idempotent'
  let firstRecord = null
  try {
    const taskId = createSmokeTaskId(caseName)
    const idempotencyKey = `${taskId}:${BUSINESS_ACTION}`
    const firstResult = await consume(taskId, idempotencyKey)
    firstRecord = assertRealResult(firstResult, 'consumed')
    const secondResult = await consume(taskId, idempotencyKey)
    const secondRecord = assertRealResult(secondResult, 'consumed')
    const sameRecord = firstRecord.recordId === secondRecord.recordId
    const sameAfterValue = Number(firstRecord.afterValue) === Number(secondRecord.afterValue)
    const smokeResult = {
      passed: sameRecord && sameAfterValue,
      sameRecord,
      noDuplicateCharge: sameAfterValue
    }
    if (!smokeResult.passed) throw new Error('Repeated consume was not idempotent')
    logSmoke(caseName, secondRecord.recordId, secondRecord.status, smokeResult)
    await rollback(firstRecord.recordId)
    return { ...smokeResult, quotaRecordId: secondRecord.recordId, status: secondRecord.status }
  } catch (error) {
    if (firstRecord) {
      try {
        await rollback(firstRecord.recordId, 'quota_alpha_idempotent_failed')
      } catch (rollbackError) {
        // Preserve the original assertion failure.
      }
    }
    const failure = buildFailure(error)
    logSmoke(caseName, firstRecord && firstRecord.recordId, 'failed', failure)
    throw error
  }
}
