import { getCurrentEnterpriseId } from '../tenant/tenantContext.js'
import { requirePermission } from '../enterprise-web/enterpriseWebGuard.js'

const EXPERIMENT_KEY = 'diebians_product_experiments_v1'

export const EXPERIMENT_STATUSES = Object.freeze(['draft', 'running', 'paused', 'completed', 'stopped'])

function nowIso() {
  return new Date().toISOString()
}

function readExperiments() {
  try {
    const value = uni.getStorageSync(EXPERIMENT_KEY)
    return Array.isArray(value) ? value.map(normalizeExperiment) : []
  } catch (error) {
    return []
  }
}

function writeExperiments(items = []) {
  try {
    uni.setStorageSync(EXPERIMENT_KEY, items.map(normalizeExperiment))
  } catch (error) {}
}

function normalizeExperiment(item = {}) {
  return {
    experimentId: String(item.experimentId || `exp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`),
    enterpriseId: String(item.enterpriseId || getCurrentEnterpriseId()),
    name: String(item.name || '未命名实验'),
    hypothesis: String(item.hypothesis || ''),
    targetMetric: String(item.targetMetric || '用户完成第一个任务的比例'),
    scope: String(item.scope || 'internal'),
    status: EXPERIMENT_STATUSES.includes(item.status) ? item.status : 'draft',
    variants: Array.isArray(item.variants) ? item.variants.map((variant) => ({
      key: String(variant.key || ''),
      name: String(variant.name || ''),
      traffic: Number(variant.traffic || 0)
    })) : [],
    createdAt: item.createdAt || nowIso(),
    updatedAt: item.updatedAt || item.createdAt || nowIso()
  }
}

export function createProductExperiment(input = {}) {
  const guard = requirePermission('analytics.view')
  if (!guard.allowed) return { success: false, errorCode: guard.reason || 'permission_denied' }
  const item = normalizeExperiment({
    ...input,
    enterpriseId: getCurrentEnterpriseId(),
    createdAt: nowIso(),
    updatedAt: nowIso()
  })
  writeExperiments([item, ...readExperiments()])
  return { success: true, experiment: item }
}

export function listProductExperiments() {
  const enterpriseId = getCurrentEnterpriseId()
  return readExperiments()
    .filter((item) => item.enterpriseId === enterpriseId)
    .sort((left, right) => String(right.updatedAt).localeCompare(String(left.updatedAt)))
}

export function loadProductExperimentCenter() {
  const guard = requirePermission('analytics.view')
  const experiments = guard.allowed ? listProductExperiments() : []
  return {
    canAccess: guard.allowed,
    reason: guard.reason || '',
    experiments,
    statusOptions: EXPERIMENT_STATUSES,
    stats: {
      total: experiments.length,
      running: experiments.filter((item) => item.status === 'running').length,
      paused: experiments.filter((item) => item.status === 'paused').length,
      completed: experiments.filter((item) => item.status === 'completed').length
    }
  }
}
