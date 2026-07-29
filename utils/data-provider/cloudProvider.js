import localProvider from './localProvider.js'

export const CLOUD_PROVIDER_STATUS = Object.freeze({
  OK: 'ok',
  NOT_IMPLEMENTED: 'not_implemented',
  INVALID_PARAMS: 'invalid_params',
  UNAUTHORIZED: 'unauthorized',
  MEMBER_NOT_FOUND: 'member_not_found',
  MEMBER_INACTIVE: 'member_inactive',
  TENANT_MISMATCH: 'tenant_mismatch',
  DUPLICATE_RECORD: 'duplicate_record',
  CLOUD_CALL_FAILED: 'cloud_call_failed',
  CLOUD_RESPONSE_INVALID: 'cloud_response_invalid',
  NOT_FOUND: 'not_found'
})

const AUTH_CONTEXT_STORAGE_KEY = 'diebiandesign_auth_context_v1'
const FUNCTION_NAME = 'enterprise_data'
const COLLECTION_ALIASES = Object.freeze({
  enterprises: 'enterprises',
  enterprise: 'enterprises',
  diebiandesign_enterprise_team_v1: 'enterprises',
  members: 'members',
  enterprise_members: 'members',
  projects: 'projects',
  enterprise_projects: 'projects',
  diebiandesign_projects: 'projects'
})
let cloudCallAdapter = null
let sessionEnterpriseId = ''

function result(ok, status, data = null, errorCode = '', message = '') {
  return { ok, status, data, errorCode, message }
}

function fail(status, errorCode, message) {
  return result(false, status, null, errorCode, message)
}

function notImplemented() {
  return fail(CLOUD_PROVIDER_STATUS.NOT_IMPLEMENTED, 'NOT_IMPLEMENTED', 'Cloud data type is not implemented')
}

export function isCloudProviderDevelopment() {
  let nodeEnv = ''
  let envVersion = ''
  try {
    if (typeof process !== 'undefined' && process && process.env) {
      nodeEnv = String(process.env.NODE_ENV || '').trim().toLowerCase()
    }
  } catch {
    nodeEnv = ''
  }
  try {
    if (typeof wx !== 'undefined' && wx && typeof wx.getAccountInfoSync === 'function') {
      const accountInfo = wx.getAccountInfoSync()
      envVersion = String(accountInfo?.miniProgram?.envVersion || '').trim().toLowerCase()
    }
  } catch {
    envVersion = ''
  }
  if (envVersion === 'trial' || envVersion === 'release') return false
  if (envVersion === 'develop') return true
  if (nodeEnv === 'development' || nodeEnv === 'dev') return true
  return typeof globalThis !== 'undefined' && globalThis.__DEV__ === true
}

function withDebug(output, input = {}, startedAt = Date.now()) {
  if (!isCloudProviderDevelopment()) return output
  return {
    ...output,
    debug: {
      providerMode: 'cloud',
      action: input.action || '',
      resourceType: input.collection || '',
      hasEnterpriseId: Boolean(input.enterpriseId),
      hasRecordId: Boolean(input.recordId),
      cloudFunctionName: FUNCTION_NAME,
      elapsedMs: Math.max(0, Date.now() - startedAt)
    }
  }
}

function getCurrentEnterpriseId() {
  if (sessionEnterpriseId) return sessionEnterpriseId
  const auth = localProvider.get(AUTH_CONTEXT_STORAGE_KEY, {})
  return String(auth?.currentEnterprise?.enterpriseId || 'default_enterprise').trim()
}

export function setCloudSessionEnterpriseId(enterpriseId = '') {
  sessionEnterpriseId = String(enterpriseId || '').trim()
  return sessionEnterpriseId
}

export function clearCloudSessionEnterpriseId() {
  sessionEnterpriseId = ''
}

export function getCloudSessionEnterpriseId() {
  return sessionEnterpriseId || getCurrentEnterpriseId()
}

export function getCloudFunctionName() {
  return FUNCTION_NAME
}

function normalizeCollection(value = '') {
  return COLLECTION_ALIASES[String(value || '').trim()] || ''
}

function normalizeOptions(input = {}, fallbackFilters = {}) {
  if (typeof input === 'string') {
    return { collection: normalizeCollection(input), sourceKey: input, filters: fallbackFilters || {} }
  }
  const value = input && typeof input === 'object' && !Array.isArray(input) ? input : {}
  return {
    ...value,
    collection: normalizeCollection(value.collection || value.key || value.type),
    sourceKey: value.key || value.collection || value.type || '',
    filters: value.filters && typeof value.filters === 'object' ? value.filters : fallbackFilters || {}
  }
}

function getRecordId(collection = '', value = {}) {
  if (!value || typeof value !== 'object') return ''
  if (value.recordId || value._id) return String(value.recordId || value._id)
  if (collection === 'enterprises') return String(value.enterpriseId || '')
  if (collection === 'members') return String(value.memberId || '')
  if (collection === 'projects') return String(value.projectId || '')
  return ''
}

function getCloudCaller() {
  if (typeof cloudCallAdapter === 'function') return cloudCallAdapter
  if (typeof wx !== 'undefined' && wx?.cloud && typeof wx.cloud.callFunction === 'function') {
    return (payload) => wx.cloud.callFunction({ name: FUNCTION_NAME, data: payload })
  }
  return null
}

export function setCloudCallAdapter(adapter = null) {
  cloudCallAdapter = typeof adapter === 'function' ? adapter : null
}

export function resetCloudCallAdapter() {
  cloudCallAdapter = null
}

function validateTenant(options = {}, records = []) {
  const enterpriseId = getCurrentEnterpriseId()
  if (options.enterpriseId && options.enterpriseId !== enterpriseId) {
    return { error: fail(CLOUD_PROVIDER_STATUS.TENANT_MISMATCH, 'TENANT_MISMATCH', 'Enterprise context does not match'), enterpriseId }
  }
  const list = Array.isArray(records) ? records : [records]
  if (list.some((item) => item?.enterpriseId && item.enterpriseId !== enterpriseId)) {
    return { error: fail(CLOUD_PROVIDER_STATUS.TENANT_MISMATCH, 'TENANT_MISMATCH', 'Record enterpriseId does not match'), enterpriseId }
  }
  return { error: null, enterpriseId }
}

async function callCloud(payload = {}) {
  const caller = getCloudCaller()
  if (!caller) return fail(CLOUD_PROVIDER_STATUS.CLOUD_CALL_FAILED, 'CLOUD_UNAVAILABLE', 'wx.cloud.callFunction is unavailable')

  let response
  try {
    response = await caller(payload)
  } catch {
    return fail(CLOUD_PROVIDER_STATUS.CLOUD_CALL_FAILED, 'CLOUD_CALL_FAILED', 'Cloud function call failed')
  }

  let hasResult = false
  let cloudResult = null
  try {
    hasResult = Boolean(response && Object.prototype.hasOwnProperty.call(response, 'result') && response.result !== undefined && response.result !== null)
    cloudResult = hasResult ? response.result : null
  } catch {
    hasResult = false
    cloudResult = null
  }

  const responseLog = { hasResult, ok: false, status: '', errorCode: '' }
  try {
    responseLog.ok = typeof cloudResult?.ok === 'boolean' ? cloudResult.ok : false
    responseLog.status = typeof cloudResult?.status === 'string' ? cloudResult.status : ''
    responseLog.errorCode = typeof cloudResult?.errorCode === 'string' ? cloudResult.errorCode : ''
  } catch {
    // Keep the response log structural and privacy-safe when a malformed result has throwing accessors.
  }
  if (isCloudProviderDevelopment() && typeof console !== 'undefined' && typeof console.info === 'function') {
    console.info('[cloud-provider:response]', responseLog)
  }

  if (!hasResult) {
    return fail(CLOUD_PROVIDER_STATUS.CLOUD_RESPONSE_INVALID, 'INVALID_CLOUD_RESPONSE', 'Cloud function response.result is missing')
  }
  if (!cloudResult || typeof cloudResult !== 'object' || typeof cloudResult.ok !== 'boolean' || typeof cloudResult.status !== 'string' || !cloudResult.status) {
    return fail(CLOUD_PROVIDER_STATUS.CLOUD_RESPONSE_INVALID, 'INVALID_CLOUD_RESPONSE', 'Cloud function returned an invalid response')
  }

  try {
    return result(
      cloudResult.ok,
      cloudResult.status,
      cloudResult.data ?? null,
      typeof cloudResult.errorCode === 'string' ? cloudResult.errorCode : '',
      typeof cloudResult.message === 'string' ? cloudResult.message : ''
    )
  } catch {
    return fail(CLOUD_PROVIDER_STATUS.CLOUD_RESPONSE_INVALID, 'INVALID_CLOUD_RESPONSE', 'Cloud function returned an invalid response')
  }
}

function getRecordsForSet(options = {}, value) {
  if (options.collection === 'enterprises' && Array.isArray(value?.enterprises)) return value.enterprises
  return Array.isArray(value) ? value : [value]
}

async function setRecords(options = {}, value) {
  const records = getRecordsForSet(options, value).filter((item) => item && typeof item === 'object')
  if (!records.length) return fail(CLOUD_PROVIDER_STATUS.INVALID_PARAMS, 'INVALID_PARAMS', 'Record data is required')
  const tenant = validateTenant(options, records)
  if (tenant.error) return tenant.error
  const responses = []
  for (const record of records) {
    const payloadRecord = { ...record }
    const embeddedMembers = options.collection === 'enterprises' && Array.isArray(payloadRecord.members)
      ? payloadRecord.members
      : []
    if (options.collection === 'enterprises') delete payloadRecord.members
    responses.push(await callCloud({
      action: 'set',
      collection: options.collection,
      enterpriseId: tenant.enterpriseId,
      recordId: getRecordId(options.collection, payloadRecord),
      data: { ...payloadRecord, enterpriseId: tenant.enterpriseId }
    }))
    for (const member of embeddedMembers) {
      responses.push(await callCloud({
        action: 'set',
        collection: 'members',
        enterpriseId: tenant.enterpriseId,
        recordId: getRecordId('members', member),
        data: { ...member, enterpriseId: tenant.enterpriseId }
      }))
    }
  }
  const failed = responses.find((item) => !item.ok)
  if (failed) return failed
  return result(true, CLOUD_PROVIDER_STATUS.OK, responses.length === 1 ? responses[0].data : responses.map((item) => item.data), '', 'saved')
}

export const cloudProvider = {
  name: 'cloud',

  async get(key) {
    const startedAt = Date.now()
    const options = normalizeOptions(key)
    const debugInput = { action: 'get', collection: options.collection, enterpriseId: getCurrentEnterpriseId(), recordId: options.recordId || getRecordId(options.collection, options) }
    if (!options.collection) return withDebug(notImplemented(), debugInput, startedAt)
    const tenant = validateTenant(options)
    if (tenant.error) return withDebug(tenant.error, debugInput, startedAt)
    const recordId = options.recordId || getRecordId(options.collection, options)
    const action = recordId || options.collection === 'enterprises' ? 'get' : 'query'
    const response = await callCloud({
      action,
      collection: options.collection,
      enterpriseId: tenant.enterpriseId,
      recordId: recordId || (options.collection === 'enterprises' ? tenant.enterpriseId : ''),
      filters: options.filters
    })
    return withDebug(response, { ...debugInput, enterpriseId: tenant.enterpriseId, recordId }, startedAt)
  },

  async set(key, value) {
    const startedAt = Date.now()
    const options = normalizeOptions(key)
    const records = getRecordsForSet(options, value)
    const recordId = getRecordId(options.collection, records[0])
    const debugInput = { action: 'set', collection: options.collection, enterpriseId: getCurrentEnterpriseId(), recordId }
    if (!options.collection) return withDebug(notImplemented(), debugInput, startedAt)
    return withDebug(await setRecords(options, value), debugInput, startedAt)
  },

  async remove(key) {
    const startedAt = Date.now()
    const options = normalizeOptions(key)
    const recordId = options.recordId || getRecordId(options.collection, options)
    const debugInput = { action: 'remove', collection: options.collection, enterpriseId: getCurrentEnterpriseId(), recordId }
    if (!options.collection) return withDebug(notImplemented(), debugInput, startedAt)
    const tenant = validateTenant(options)
    if (tenant.error) return withDebug(tenant.error, debugInput, startedAt)
    if (!recordId) return withDebug(fail(CLOUD_PROVIDER_STATUS.INVALID_PARAMS, 'INVALID_PARAMS', 'recordId is required'), { ...debugInput, enterpriseId: tenant.enterpriseId }, startedAt)
    return withDebug(await callCloud({ action: 'remove', collection: options.collection, enterpriseId: tenant.enterpriseId, recordId }), { ...debugInput, enterpriseId: tenant.enterpriseId }, startedAt)
  },

  async query(options = {}, filters = {}) {
    const startedAt = Date.now()
    const normalized = normalizeOptions(options, filters)
    const debugInput = { action: 'query', collection: normalized.collection, enterpriseId: getCurrentEnterpriseId(), recordId: '' }
    if (!normalized.collection) return withDebug(notImplemented(), debugInput, startedAt)
    const tenant = validateTenant(normalized)
    if (tenant.error) return withDebug(tenant.error, debugInput, startedAt)
    return withDebug(await callCloud({
      action: 'query',
      collection: normalized.collection,
      enterpriseId: tenant.enterpriseId,
      filters: normalized.filters
    }), { ...debugInput, enterpriseId: tenant.enterpriseId }, startedAt)
  }
}

export async function restoreCloudSessionIdentity(enterpriseId = '') {
  const candidate = String(enterpriseId || '').trim()
  if (!candidate) return fail(CLOUD_PROVIDER_STATUS.INVALID_PARAMS, 'INVALID_ENTERPRISE_ID', 'enterpriseId is required')

  const previousSessionEnterpriseId = sessionEnterpriseId
  const restorePreviousSession = () => {
    sessionEnterpriseId = previousSessionEnterpriseId
  }
  setCloudSessionEnterpriseId(candidate)

  const enterpriseResponse = await cloudProvider.get({ collection: 'enterprises', recordId: candidate })
  if (!enterpriseResponse?.ok) {
    restorePreviousSession()
    return enterpriseResponse
  }

  const enterprise = enterpriseResponse.data || {}
  const membershipResponse = await cloudProvider.set({ collection: 'enterprises' }, {
    enterpriseId: candidate,
    enterpriseName: enterprise.enterpriseName || enterprise.name || 'Alpha测试企业'
  })
  if (!membershipResponse?.ok) {
    restorePreviousSession()
    return membershipResponse
  }

  const returnedEnterprise = membershipResponse.data?.enterprise || membershipResponse.data || {}
  const member = membershipResponse.data?.member || {}
  if (returnedEnterprise.enterpriseId !== candidate || !member.memberId) {
    restorePreviousSession()
    return withDebug(
      fail(CLOUD_PROVIDER_STATUS.CLOUD_RESPONSE_INVALID, 'CLOUD_RESPONSE_INVALID', 'Validated membership was not returned'),
      { action: 'restore_identity', collection: 'members', enterpriseId: candidate, recordId: member.memberId || '' }
    )
  }
  if (member.status !== 'active') {
    restorePreviousSession()
    return withDebug(
      fail(CLOUD_PROVIDER_STATUS.MEMBER_INACTIVE, 'MEMBER_INACTIVE', 'Enterprise membership is not active'),
      { action: 'restore_identity', collection: 'members', enterpriseId: candidate, recordId: member.memberId }
    )
  }

  setCloudSessionEnterpriseId(candidate)
  return withDebug(result(true, 'existing_enterprise_restored', {
    enterpriseId: candidate,
    memberId: member.memberId
  }, '', 'Existing enterprise membership restored'), {
    action: 'restore_identity',
    collection: 'members',
    enterpriseId: candidate,
    recordId: member.memberId
  })
}

export default cloudProvider
