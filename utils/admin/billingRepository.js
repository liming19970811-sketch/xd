import { getApiAuditRecords } from './apiAuditRepository'
import { summarizeApiAuditRecords } from './apiAnalyticsRepository'
import { getBrandApiUsageRecords } from './apiUsageRepository'

export const API_BILLING_PERIOD_TYPES = Object.freeze([
  Object.freeze({ value: 'day', label: '日账单' }),
  Object.freeze({ value: 'month', label: '月账单' })
])

function pad(number) {
  return String(number).padStart(2, '0')
}

function getPeriodKey(value = '', periodType = 'day') {
  const date = value ? new Date(value) : new Date()
  if (Number.isNaN(date.getTime())) return ''
  const month = `${date.getFullYear()}-${pad(date.getMonth() + 1)}`
  return periodType === 'month' ? month : `${month}-${pad(date.getDate())}`
}

function normalizePeriodType(periodType = 'day') {
  return API_BILLING_PERIOD_TYPES.some((item) => item.value === periodType) ? periodType : 'day'
}

function getRecordKey(record = {}) {
  return `${String(record.brandId || '')}::${String(record.appId || '')}`
}

function splitRecordKey(key = '') {
  const [brandId = '', appId = ''] = String(key).split('::')
  return { brandId, appId }
}

function createBilling(input = {}) {
  const auditSummary = summarizeApiAuditRecords(input.auditRecords)
  const quotaUsed = input.usageRecords.reduce((total, record) => total + record.cost, 0)
  const billing = {
    billingId: `api_billing_${input.periodType}_${input.period}_${input.brandId || 'unknown'}_${input.appId || 'unknown'}`,
    brandId: input.brandId,
    appId: input.appId,
    period: input.period,
    totalCalls: auditSummary.totalCalls,
    successCalls: auditSummary.successCalls,
    failedCalls: auditSummary.failedCalls,
    quotaUsed,
    totalCost: auditSummary.totalCost,
    createdAt: new Date().toISOString(),
    periodType: input.periodType,
    auditIds: input.auditRecords.map((record) => record.auditId),
    usageIds: input.usageRecords.map((record) => record.usageId)
  }
  console.log('[api:billing]', {
    billingId: billing.billingId,
    brandId: billing.brandId,
    period: billing.period
  })
  return billing
}

export function getApiBillingPeriodOptions() {
  return API_BILLING_PERIOD_TYPES.map((item) => ({ ...item }))
}

export function getCurrentApiBillingPeriod(periodType = 'day') {
  return getPeriodKey('', normalizePeriodType(periodType))
}

export function getApiBillings(input = {}) {
  const periodType = normalizePeriodType(input.periodType)
  const period = String(input.period || getCurrentApiBillingPeriod(periodType))
  const auditRecords = getApiAuditRecords().filter((record) => getPeriodKey(record.createdAt, periodType) === period)
  const usageRecords = getBrandApiUsageRecords().filter((record) => getPeriodKey(record.createdAt, periodType) === period)
  const recordKeys = new Set([
    ...auditRecords.map(getRecordKey),
    ...usageRecords.map(getRecordKey)
  ])

  return Array.from(recordKeys)
    .filter((key) => key !== '::')
    .map((key) => {
      const { brandId, appId } = splitRecordKey(key)
      return createBilling({
        brandId,
        appId,
        period,
        periodType,
        auditRecords: auditRecords.filter((record) => getRecordKey(record) === key),
        usageRecords: usageRecords.filter((record) => getRecordKey(record) === key)
      })
    })
    .sort((left, right) => right.totalCalls - left.totalCalls || right.quotaUsed - left.quotaUsed)
}

export function getApiBillingDetail(billingId = '', input = {}) {
  return getApiBillings(input).find((billing) => billing.billingId === billingId) || null
}
