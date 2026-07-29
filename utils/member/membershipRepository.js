import { MEMBERSHIP_PLAN_CONFIG, MEMBERSHIP_TIERS } from '../constants/membershipPlans'
import { getCurrentPlan as getPlanByUsage, getPlans } from './planRepository'

const MEMBERSHIP_USAGE_KEY = 'membership_usage'
const LEGACY_MEMBERSHIP_USAGE_KEY = 'membership_usage_mock'
const WECHAT_IDENTITY_STORAGE_KEY = 'diebiandesign_wechat_identity'

const LEVEL_LABELS = Object.freeze({
  trial: '体验会员',
  basic: '基础会员',
  professional: '专业会员',
  enterprise: '企业会员'
})

function toNumber(value, fallback = 0) {
  const number = Number(value)
  return Number.isFinite(number) && number >= 0 ? number : fallback
}

function toOptionalNumber(value) {
  if (!hasValue(value)) return null
  const number = Number(value)
  return Number.isFinite(number) && number >= 0 ? number : null
}

function hasValue(value) {
  return value !== undefined && value !== null && value !== ''
}

function firstValue(source = {}, keys = [], fallback = '') {
  for (const key of keys) {
    if (hasValue(source[key])) return source[key]
  }
  return fallback
}

function readUsageStorage() {
  if (typeof uni === 'undefined' || !uni || typeof uni.getStorageSync !== 'function') {
    return { ok: false, data: null, errorCode: 'storage_unavailable' }
  }
  try {
    const current = uni.getStorageSync(MEMBERSHIP_USAGE_KEY)
    if (current && typeof current === 'object') {
      return { ok: true, data: current, source: MEMBERSHIP_USAGE_KEY }
    }
    const legacy = uni.getStorageSync(LEGACY_MEMBERSHIP_USAGE_KEY)
    if (legacy && typeof legacy === 'object') {
      return { ok: true, data: legacy, source: LEGACY_MEMBERSHIP_USAGE_KEY }
    }
    return { ok: true, data: {}, source: MEMBERSHIP_USAGE_KEY }
  } catch (error) {
    return { ok: false, data: null, errorCode: 'membership_usage_read_failed' }
  }
}

function cacheServerIdentity(usage = {}) {
  const openId = String(usage.openId || usage.openid || usage._openid || '').trim()
  if (!openId || openId.startsWith('mock_')) return
  try {
    if (typeof uni === 'undefined' || !uni || typeof uni.setStorageSync !== 'function') return
    const current = uni.getStorageSync(WECHAT_IDENTITY_STORAGE_KEY) || {}
    uni.setStorageSync(WECHAT_IDENTITY_STORAGE_KEY, {
      ...current,
      openId
    })
  } catch (error) {
    // Identity caching is best-effort; the server-authenticated summary remains authoritative.
  }
}

function resolveTier(rawUsage = {}) {
  const tier = String(firstValue(rawUsage, ['currentTier', 'membershipTier', 'tier', 'planId'], MEMBERSHIP_TIERS.FREE_TRIAL))
  return MEMBERSHIP_PLAN_CONFIG[tier] ? tier : MEMBERSHIP_TIERS.FREE_TRIAL
}

function isMiniProgramDevelopment() {
  try {
    if (typeof wx !== 'undefined' && wx && typeof wx.getAccountInfoSync === 'function') {
      const accountInfo = wx.getAccountInfoSync()
      return accountInfo && accountInfo.miniProgram && accountInfo.miniProgram.envVersion === 'develop'
    }
  } catch (error) {
    return isDevelopment()
  }
  return isDevelopment()
}

export function normalizeMembershipUsage(rawUsage = {}, source = MEMBERSHIP_USAGE_KEY) {
  const usage = rawUsage.usage && typeof rawUsage.usage === 'object' ? rawUsage.usage : rawUsage
  const hasUsageRecord = Object.keys(usage || {}).length > 0
  const tier = resolveTier(usage)
  const planConfig = MEMBERSHIP_PLAN_CONFIG[tier] || MEMBERSHIP_PLAN_CONFIG[MEMBERSHIP_TIERS.FREE_TRIAL] || {}
  const explicitTotal = toOptionalNumber(firstValue(usage, [
    'monthlyAiPoints',
    'monthlyAiPointsLimit',
    'monthlyAiPointsQuota',
    'monthlyAiQuota',
    'totalQuota',
    'quotaLimit',
    'total'
  ], null))
  const explicitUsed = toOptionalNumber(firstValue(usage, [
    'monthlyAiPointsUsed',
    'usedQuota',
    'usedCount',
    'consumed',
    'used'
  ], null))
  const explicitRemaining = toOptionalNumber(firstValue(usage, [
    'monthlyAiPointsRemaining',
    'remainingQuota',
    'remainingCount',
    'remaining'
  ], null))
  const planTotal = toOptionalNumber(planConfig.monthlyAiPoints || planConfig.monthlyAiQuota)
  let total = explicitTotal
  if (total === null && explicitUsed !== null && explicitRemaining !== null) total = explicitUsed + explicitRemaining
  if (total === null && hasUsageRecord && planTotal !== null) total = planTotal
  let used = explicitUsed
  let remaining = explicitRemaining
  if (total !== null && used !== null) remaining = Math.max(0, total - used)
  else if (total !== null && remaining !== null) used = Math.max(0, total - remaining)
  const metricsValid = total !== null && used !== null && remaining !== null
  total = metricsValid ? Math.max(0, total) : 0
  used = metricsValid ? Math.min(total, Math.max(0, used)) : 0
  remaining = metricsValid ? Math.max(0, total - used) : 0
  const resetAt = String(firstValue(usage, [
    'resetAt',
    'resetTime',
    'nextResetAt',
    'periodEnd',
    'expiresAt'
  ], ''))
  const mock = rawUsage.mock === true || usage.mock === true
  const mockVisible = !mock || isMiniProgramDevelopment()
  return {
    tier,
    total,
    used,
    remaining,
    resetAt,
    period: String(usage.period || ''),
    source,
    available: hasUsageRecord && metricsValid && mockVisible,
    isFallback: !hasUsageRecord || !metricsValid || source === LEGACY_MEMBERSHIP_USAGE_KEY || !mockVisible,
    mock,
    status: String(usage.status || ''),
    effectiveAt: String(firstValue(usage, ['effectiveAt', 'startedAt', 'startAt'], '')),
    expiresAt: String(firstValue(usage, ['expiresAt', 'expiredAt', 'endAt'], '')),
    exhausted: remaining <= 0
  }
}

function isDevelopment() {
  try {
    return typeof process !== 'undefined' && ['development', 'dev'].includes(String(process.env && process.env.NODE_ENV || '').toLowerCase())
  } catch (error) {
    return false
  }
}

function logMembership(result = {}) {
  if (!isMiniProgramDevelopment() || typeof console === 'undefined' || typeof console.info !== 'function') return
  console.info('[membership:usage]', {
    planId: result.plan ? result.plan.planId || result.plan.tier : '',
    success: result.ok === true,
    errorCode: result.errorCode || '',
    stage: result.diagnostics ? result.diagnostics.stage || '' : '',
    hasOpenid: result.diagnostics ? result.diagnostics.hasOpenid === true : false,
    errCode: result.diagnostics ? result.diagnostics.errCode || '' : ''
  })
}

export function getCurrentPlan(usageInput = null) {
  const usage = usageInput && typeof usageInput === 'object' ? usageInput : getMembershipUsage().data
  const tier = usage && (usage.tier || usage.planId) ? usage.tier || usage.planId : MEMBERSHIP_TIERS.FREE_TRIAL
  const config = MEMBERSHIP_PLAN_CONFIG[tier] || MEMBERSHIP_PLAN_CONFIG[MEMBERSHIP_TIERS.FREE_TRIAL] || {}
  const plan = getPlanByUsage(usage || { tier })
  return {
    ...plan,
    tier,
    levelLabel: LEVEL_LABELS[plan.type] || LEVEL_LABELS.trial,
    monthlyQuota: toNumber(config.monthlyAiPoints || config.monthlyAiQuota || (usage && usage.total) || 0),
    billingCycle: config.billingCycle || 'trial'
  }
}

export function getMembershipUsage() {
  const stored = readUsageStorage()
  if (!stored.ok) {
    const result = {
      ok: false,
      status: 'error',
      data: null,
      plan: getCurrentPlan({ tier: MEMBERSHIP_TIERS.FREE_TRIAL }),
      errorCode: stored.errorCode || 'membership_usage_read_failed',
      message: '暂时无法获取额度'
    }
    logMembership(result)
    return result
  }
  const data = normalizeMembershipUsage(stored.data || {}, stored.source)
  const result = {
    ok: true,
    status: 'success',
    data,
    plan: getCurrentPlan(data),
    errorCode: '',
    message: ''
  }
  logMembership(result)
  return result
}

function buildRefreshFailure(errorCode = 'membership_usage_read_failed', message = '额度暂时无法获取', diagnostics = {}) {
  const safeDiagnostics = {
    stage: String(diagnostics.stage || ''),
    hasOpenid: diagnostics.hasOpenid === true,
    errCode: String(diagnostics.errCode || '')
  }
  const result = {
    ok: false,
    status: 'error',
    data: null,
    plan: getCurrentPlan({ tier: MEMBERSHIP_TIERS.FREE_TRIAL }),
    errorCode,
    message,
    diagnostics: safeDiagnostics
  }
  logMembership(result)
  return result
}

export async function refreshMembershipUsage() {
  if (
    typeof wx === 'undefined' ||
    !wx ||
    !wx.cloud ||
    typeof wx.cloud.callFunction !== 'function'
  ) {
    const cached = getMembershipUsage()
    return cached.ok && cached.data && cached.data.available
      ? cached
      : buildRefreshFailure('cloud_unavailable')
  }
  try {
    const response = await wx.cloud.callFunction({
      name: 'quota_guard',
      data: { action: 'getUsageSummary' }
    })
    const result = response && response.result
    if (!result || typeof result !== 'object') return buildRefreshFailure('cloud_response_invalid')
    if (result.ok !== true && result.success !== true) {
      const diagnostics = result.data && typeof result.data === 'object' ? result.data : result
      return buildRefreshFailure(
        String(result.errorCode || result.reason || 'membership_usage_read_failed'),
        '额度暂时无法获取',
        diagnostics
      )
    }
    const usage = result.data && result.data.usage
    if (!usage || typeof usage !== 'object') return buildRefreshFailure('usage_summary_missing')
    cacheServerIdentity(usage)
    const payload = {
      usage,
      mock: result.mock === true,
      fetchedAt: new Date().toISOString()
    }
    try {
      if (typeof uni !== 'undefined' && uni && typeof uni.setStorageSync === 'function') {
        uni.setStorageSync(MEMBERSHIP_USAGE_KEY, payload)
      }
    } catch (error) {
      // The live summary remains usable even when the local read cache cannot be updated.
    }
    const data = normalizeMembershipUsage(payload, 'quota_guard')
    if (!data.available) return buildRefreshFailure(data.mock ? 'mock_usage_hidden' : 'usage_summary_invalid')
    const normalized = {
      ok: true,
      status: 'success',
      data,
      plan: getCurrentPlan(data),
      errorCode: '',
      message: ''
    }
    logMembership(normalized)
    return normalized
  } catch (error) {
    return buildRefreshFailure('cloud_call_failed')
  }
}

export const MEMBERSHIP_PLAN_CARDS = Object.freeze(getPlans().map((plan) => Object.freeze({
  ...plan,
  tier: plan.planId,
  features: Object.freeze([...plan.features])
})))
