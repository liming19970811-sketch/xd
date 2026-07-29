import { ENTERPRISE_API_ENDPOINTS } from './apiRepository'

const API_USAGE_STORAGE_KEY = 'diebiandesign_api_usage_logs'
const BRAND_API_USAGE_STORAGE_KEY = 'diebiandesign_brand_api_usage_records'

export const API_CALL_STATUS = Object.freeze({
  SUCCESS: 'success',
  FAILED: 'failed',
  PENDING: 'pending'
})

function createInitialLogs() {
  const now = Date.now()
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const getTodayTime = (minutesAgo) => new Date(Math.max(todayStart.getTime(), now - minutesAgo * 60 * 1000)).toISOString()
  return [
    {
      logId: 'api_log_demo_001',
      apiId: 'api_demo_001',
      companyId: 'company_demo_001',
      endpoint: 'model_replace',
      action: 'generate_image',
      status: API_CALL_STATUS.SUCCESS,
      cost: 5,
      createdAt: getTodayTime(18)
    },
    {
      logId: 'api_log_demo_002',
      apiId: 'api_demo_001',
      companyId: 'company_demo_001',
      endpoint: 'batch_generate',
      action: 'generate_batch',
      status: API_CALL_STATUS.PENDING,
      cost: 30,
      createdAt: getTodayTime(46)
    },
    {
      logId: 'api_log_demo_003',
      apiId: 'api_demo_002',
      companyId: 'company_demo_002',
      endpoint: 'pattern_replace',
      action: 'generate_image',
      status: API_CALL_STATUS.FAILED,
      cost: 0,
      createdAt: getTodayTime(92)
    }
  ]
}

function normalizeStatus(status = '') {
  return Object.values(API_CALL_STATUS).includes(status) ? status : API_CALL_STATUS.PENDING
}

function normalizeEndpoint(endpoint = '') {
  return ENTERPRISE_API_ENDPOINTS.some((item) => item.value === endpoint) ? endpoint : 'model_replace'
}

function normalizeLog(log = {}) {
  return {
    logId: String(log.logId || ''),
    apiId: String(log.apiId || ''),
    companyId: String(log.companyId || ''),
    endpoint: normalizeEndpoint(log.endpoint),
    action: String(log.action || 'generate_image'),
    status: normalizeStatus(log.status),
    cost: Math.max(0, Number(log.cost) || 0),
    createdAt: log.createdAt || new Date().toISOString()
  }
}

function readLogs() {
  try {
    const logs = uni.getStorageSync(API_USAGE_STORAGE_KEY)
    if (Array.isArray(logs) && logs.length) return logs.map(normalizeLog)
  } catch (error) {
    return createInitialLogs().map(normalizeLog)
  }
  const initialLogs = createInitialLogs().map(normalizeLog)
  writeLogs(initialLogs)
  return initialLogs
}

function writeLogs(logs = []) {
  uni.setStorageSync(API_USAGE_STORAGE_KEY, logs.map(normalizeLog))
}

function getLocalDateKey(value) {
  const date = value ? new Date(value) : new Date()
  if (Number.isNaN(date.getTime())) return ''
  const pad = (number) => String(number).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function normalizeBrandUsage(usage = {}) {
  return {
    usageId: String(usage.usageId || ''),
    appId: String(usage.appId || ''),
    credentialId: String(usage.credentialId || ''),
    auditId: String(usage.auditId || ''),
    brandId: String(usage.brandId || ''),
    action: String(usage.action || 'image_generate'),
    cost: Math.max(0, Number(usage.cost) || 0),
    beforeQuota: Math.max(0, Number(usage.beforeQuota) || 0),
    afterQuota: Math.max(0, Number(usage.afterQuota) || 0),
    status: normalizeStatus(usage.status || API_CALL_STATUS.SUCCESS),
    createdAt: usage.createdAt || new Date().toISOString()
  }
}

function readBrandUsageRecords() {
  try {
    const records = uni.getStorageSync(BRAND_API_USAGE_STORAGE_KEY)
    return Array.isArray(records) ? records.map(normalizeBrandUsage) : []
  } catch (error) {
    return []
  }
}

function writeBrandUsageRecords(records = []) {
  try {
    uni.setStorageSync(BRAND_API_USAGE_STORAGE_KEY, records.map(normalizeBrandUsage))
  } catch (error) {}
  return records
}

export function getApiUsageLogs() {
  return readLogs().sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt)))
}

export function getApiUsageStats(logs = getApiUsageLogs()) {
  const todayKey = getLocalDateKey(new Date())
  const todayLogs = logs.filter((log) => getLocalDateKey(log.createdAt) === todayKey)
  return {
    todayCount: todayLogs.length,
    successCount: todayLogs.filter((log) => log.status === API_CALL_STATUS.SUCCESS).length,
    failedCount: todayLogs.filter((log) => log.status === API_CALL_STATUS.FAILED).length,
    totalCost: todayLogs.reduce((total, log) => total + log.cost, 0)
  }
}

export function createMockApiUsageLog(input = {}) {
  const log = normalizeLog({
    logId: `api_log_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    apiId: input.apiId,
    companyId: input.companyId,
    endpoint: input.endpoint,
    action: input.action,
    status: input.status,
    cost: input.cost,
    createdAt: new Date().toISOString()
  })
  writeLogs([log, ...readLogs()])
  console.log('[api:call]', {
    apiId: log.apiId,
    companyId: log.companyId,
    action: log.action,
    status: log.status
  })
  return log
}

export function createBrandApiUsageRecord(input = {}) {
  const usage = normalizeBrandUsage({
    ...input,
    usageId: input.usageId || `brand_api_usage_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    status: input.status || API_CALL_STATUS.SUCCESS,
    createdAt: input.createdAt || new Date().toISOString()
  })
  writeBrandUsageRecords([usage, ...readBrandUsageRecords()])
  return usage
}

export function getBrandApiUsageRecords(appId = '') {
  return readBrandUsageRecords()
    .filter((usage) => !appId || usage.appId === appId)
    .sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt)))
}

export function linkBrandApiUsageAudit(input = {}) {
  const records = readBrandUsageRecords()
  const index = input.usageId
    ? records.findIndex((usage) => usage.usageId === input.usageId)
    : records.findIndex((usage) => (
        usage.appId === input.appId &&
        usage.action === input.action &&
        !usage.auditId
      ))
  if (index < 0) return null
  const usage = normalizeBrandUsage({
    ...records[index],
    credentialId: input.credentialId || records[index].credentialId,
    auditId: input.auditId || records[index].auditId
  })
  records.splice(index, 1, usage)
  writeBrandUsageRecords(records)
  return usage
}

export function getBrandApiUsageStats(records = getBrandApiUsageRecords()) {
  return {
    callCount: records.length,
    totalCost: records.reduce((total, usage) => total + usage.cost, 0),
    successCount: records.filter((usage) => usage.status === API_CALL_STATUS.SUCCESS).length
  }
}

export function getApiCallStatusLabel(status = '') {
  const labels = {
    success: '成功',
    failed: '失败',
    pending: '处理中'
  }
  return labels[normalizeStatus(status)]
}

export function getApiEndpointLabel(endpoint = '') {
  const item = ENTERPRISE_API_ENDPOINTS.find((option) => option.value === endpoint)
  return item ? `${item.value} · ${item.label}` : endpoint
}

export function formatApiUsageTime(value = '') {
  const date = value ? new Date(value) : null
  if (!date || Number.isNaN(date.getTime())) return '刚刚'
  const pad = (number) => String(number).padStart(2, '0')
  return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}
