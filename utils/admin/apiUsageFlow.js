import {
  ENTERPRISE_API_STATUS,
  consumeBrandApiQuota,
  getBrandApiAppById
} from './apiRepository'
import { API_CALL_STATUS, createBrandApiUsageRecord } from './apiUsageRepository'

export const API_ACTION_PERMISSIONS = Object.freeze({
  image_generate: 'image_generate',
  batch_generate: 'batch_generate',
  asset_access: 'asset_access',
  project_access: 'project_access'
})

export const API_ACTION_COSTS = Object.freeze({
  image_generate: 5,
  batch_generate: 20,
  asset_access: 1,
  project_access: 1
})

export function getBrandApiActionCost(action = '') {
  return API_ACTION_COSTS[String(action || '')] || 0
}

function createUsageError(code, message) {
  const error = new Error(message)
  error.code = code
  return error
}

export function validateBrandApiUsage(input = {}) {
  const app = getBrandApiAppById(input.appId)
  const action = String(input.action || '')
  const cost = Math.max(0, Number(input.cost) || 0)
  const permission = API_ACTION_PERMISSIONS[action]
  if (!app) return { allowed: false, code: 'APP_NOT_FOUND', reason: 'API 应用不存在', app: null, action, cost }
  if (app.status !== ENTERPRISE_API_STATUS.ENABLED) {
    return { allowed: false, code: 'APP_PAUSED', reason: 'API 应用已暂停', app, action, cost }
  }
  if (!permission || !app.permissions.includes(permission)) {
    return { allowed: false, code: 'PERMISSION_DENIED', reason: 'API 应用权限不足', app, action, cost }
  }
  if (!cost) return { allowed: false, code: 'INVALID_COST', reason: '调用消耗必须大于 0', app, action, cost }
  if (app.remainingQuota < cost) {
    return { allowed: false, code: 'QUOTA_NOT_ENOUGH', reason: 'API 应用额度不足', app, action, cost }
  }
  return { allowed: true, code: '', reason: '', app, action, permission, cost }
}

export function consumeBrandApiUsage(input = {}) {
  const validation = validateBrandApiUsage(input)
  if (!validation.allowed) throw createUsageError(validation.code, validation.reason)
  const quotaResult = consumeBrandApiQuota(validation.app.appId, validation.cost)
  const usage = createBrandApiUsageRecord({
    appId: quotaResult.app.appId,
    brandId: quotaResult.app.brandId,
    action: validation.action,
    cost: quotaResult.cost,
    beforeQuota: quotaResult.beforeQuota,
    afterQuota: quotaResult.afterQuota,
    status: API_CALL_STATUS.SUCCESS
  })
  console.log('[api:consume]', {
    appId: quotaResult.app.appId,
    brandId: quotaResult.app.brandId,
    action: validation.action,
    cost: quotaResult.cost
  })
  return {
    success: true,
    app: quotaResult.app,
    usage
  }
}
