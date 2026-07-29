import { API_AUDIT_STATUS, getApiAuditRecords } from './apiAuditRepository'

export const API_ANALYTICS_PERIODS = Object.freeze([
  Object.freeze({ value: 'today', label: '今天', days: 1 }),
  Object.freeze({ value: '7d', label: '近 7 天', days: 7 }),
  Object.freeze({ value: '30d', label: '近 30 天', days: 30 }),
  Object.freeze({ value: 'all', label: '全部', days: 0 })
])

export const API_ANALYTICS_ACTIONS = Object.freeze([
  'image_generate',
  'batch_generate',
  'asset_access',
  'project_access'
])

function getPeriodStart(period = '7d', now = new Date()) {
  const option = API_ANALYTICS_PERIODS.find((item) => item.value === period) || API_ANALYTICS_PERIODS[1]
  if (!option.days) return null
  const start = new Date(now)
  start.setHours(0, 0, 0, 0)
  if (option.days > 1) start.setDate(start.getDate() - option.days + 1)
  return start
}

function isWithinPeriod(value = '', period = '7d') {
  const start = getPeriodStart(period)
  if (!start) return true
  const date = value ? new Date(value) : null
  return Boolean(date && !Number.isNaN(date.getTime()) && date.getTime() >= start.getTime())
}

function createTopActions(records = []) {
  return API_ANALYTICS_ACTIONS.map((action) => {
    const actionRecords = records.filter((record) => record.action === action)
    return {
      action,
      totalCalls: actionRecords.length,
      successCalls: actionRecords.filter((record) => record.status === API_AUDIT_STATUS.SUCCESS).length,
      failedCalls: actionRecords.filter((record) => record.status !== API_AUDIT_STATUS.SUCCESS).length,
      totalCost: actionRecords.reduce((total, record) => total + record.cost, 0)
    }
  }).sort((left, right) => right.totalCalls - left.totalCalls || right.totalCost - left.totalCost)
}

function createFailureAnalysis(records = []) {
  const failures = [
    { code: 'APP_PAUSED', status: API_AUDIT_STATUS.APP_PAUSED },
    { code: 'PERMISSION_DENIED', status: API_AUDIT_STATUS.PERMISSION_DENIED },
    { code: 'QUOTA_NOT_ENOUGH', status: API_AUDIT_STATUS.QUOTA_NOT_ENOUGH }
  ]
  return failures.map((item) => ({
    code: item.code,
    count: records.filter((record) => record.status === item.status).length
  }))
}

export function getApiAnalyticsPeriodOptions() {
  return API_ANALYTICS_PERIODS.map((item) => ({ ...item }))
}

export function summarizeApiAuditRecords(records = []) {
  const normalizedRecords = Array.isArray(records) ? records : []
  const successCalls = normalizedRecords.filter((record) => record.status === API_AUDIT_STATUS.SUCCESS).length
  const failedCalls = normalizedRecords.length - successCalls
  return {
    totalCalls: normalizedRecords.length,
    successCalls,
    failedCalls,
    successRate: normalizedRecords.length ? Math.round((successCalls / normalizedRecords.length) * 1000) / 10 : 0,
    totalCost: normalizedRecords.reduce((total, record) => total + record.cost, 0),
    topActions: createTopActions(normalizedRecords),
    failureAnalysis: createFailureAnalysis(normalizedRecords)
  }
}

export function buildApiAnalytics(input = {}) {
  const brandId = String(input.brandId || '')
  const appId = String(input.appId || '')
  const action = String(input.action || '')
  const period = API_ANALYTICS_PERIODS.some((item) => item.value === input.period) ? input.period : '7d'
  const records = getApiAuditRecords().filter((record) => (
    (!brandId || record.brandId === brandId) &&
    (!appId || record.appId === appId) &&
    (!action || record.action === action) &&
    isWithinPeriod(record.createdAt, period)
  ))
  const summary = summarizeApiAuditRecords(records)
  const analytics = {
    analyticsId: `api_analytics_${brandId || 'all'}_${appId || 'all'}_${action || 'all'}_${period}`,
    brandId,
    appId,
    period,
    ...summary,
    createdAt: new Date().toISOString()
  }
  console.log('[api:analytics]', {
    brandId: analytics.brandId,
    appId: analytics.appId,
    period: analytics.period
  })
  return analytics
}
