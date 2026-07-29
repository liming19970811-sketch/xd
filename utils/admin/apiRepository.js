import { API_PLAN_IDS, getApiPlanById } from './apiPlanRepository'

const ENTERPRISE_API_STORAGE_KEY = 'diebiandesign_enterprise_apis'
const BRAND_API_APP_STORAGE_KEY = 'diebiandesign_brand_api_apps'

export const ENTERPRISE_API_STATUS = Object.freeze({
  ENABLED: 'enabled',
  PAUSED: 'paused'
})

export const ENTERPRISE_API_PERMISSIONS = Object.freeze([
  'image_generate',
  'batch_generate',
  'asset_access',
  'project_access'
])

export const BRAND_API_APP_PERMISSIONS = ENTERPRISE_API_PERMISSIONS

export const ENTERPRISE_API_ENDPOINTS = Object.freeze([
  { value: 'model_replace', label: '换模特' },
  { value: 'color_replace', label: '换颜色' },
  { value: 'pattern_replace', label: '换图案' },
  { value: 'scene_replace', label: '换场景' },
  { value: 'batch_generate', label: '批量生成' }
])

const COMPANY_NAMES = Object.freeze({
  company_demo_001: '蝶变服饰示例企业',
  company_demo_002: '上新视觉示例品牌'
})

const MOCK_ENTERPRISE_APIS = Object.freeze([
  Object.freeze({
    apiId: 'api_demo_001',
    companyId: 'company_demo_001',
    keyPrefix: 'db_mock_company_001',
    permissions: ['image_generate', 'batch_generate', 'asset_access'],
    quota: 10000,
    usedCount: 1680,
    status: ENTERPRISE_API_STATUS.ENABLED,
    createdAt: '2026-07-01T08:00:00.000Z'
  }),
  Object.freeze({
    apiId: 'api_demo_002',
    companyId: 'company_demo_002',
    keyPrefix: 'db_mock_company_002',
    permissions: ['image_generate', 'asset_access'],
    quota: 3000,
    usedCount: 420,
    status: ENTERPRISE_API_STATUS.PAUSED,
    createdAt: '2026-07-08T08:00:00.000Z'
  })
])

function normalizeApi(api = {}) {
  return {
    apiId: String(api.apiId || ''),
    companyId: String(api.companyId || ''),
    keyPrefix: String(api.keyPrefix || api.apiKey || '').slice(0, 24),
    permissions: Array.isArray(api.permissions)
      ? api.permissions.filter((permission) => ENTERPRISE_API_PERMISSIONS.includes(permission))
      : [],
    quota: Math.max(0, Number(api.quota) || 0),
    usedCount: Math.max(0, Number(api.usedCount) || 0),
    status: api.status === ENTERPRISE_API_STATUS.PAUSED
      ? ENTERPRISE_API_STATUS.PAUSED
      : ENTERPRISE_API_STATUS.ENABLED,
    createdAt: api.createdAt || new Date().toISOString()
  }
}

function cloneApi(api = {}) {
  const normalized = normalizeApi(api)
  return {
    ...normalized,
    permissions: [...normalized.permissions]
  }
}

function readApis() {
  try {
    const apis = uni.getStorageSync(ENTERPRISE_API_STORAGE_KEY)
    if (Array.isArray(apis) && apis.length) {
      const normalizedApis = apis.map(cloneApi)
      if (apis.some((api) => Object.prototype.hasOwnProperty.call(api || {}, 'apiKey'))) {
        writeApis(normalizedApis)
      }
      return normalizedApis
    }
  } catch (error) {
    return MOCK_ENTERPRISE_APIS.map(cloneApi)
  }
  const initialApis = MOCK_ENTERPRISE_APIS.map(cloneApi)
  writeApis(initialApis)
  return initialApis
}

function writeApis(apis = []) {
  uni.setStorageSync(ENTERPRISE_API_STORAGE_KEY, apis.map(normalizeApi))
}

function logApiAction(api = {}, action = '') {
  console.log('[api:usage]', {
    apiId: api.apiId,
    companyId: api.companyId,
    action
  })
}

function normalizeBrandApiApp(app = {}) {
  const plan = getApiPlanById(app.planId || API_PLAN_IDS.BASIC)
  const quota = Math.max(0, Number(app.quota) || plan.apiQuota)
  const usedCount = Math.max(0, Math.min(Number(app.usedCount) || 0, quota))
  return {
    appId: String(app.appId || ''),
    brandId: String(app.brandId || ''),
    appName: String(app.appName || '未命名 API 应用').trim() || '未命名 API 应用',
    planId: plan.planId,
    permissions: Array.isArray(app.permissions)
      ? [...new Set(app.permissions.filter((permission) => BRAND_API_APP_PERMISSIONS.includes(permission)))]
      : [],
    quota,
    remainingQuota: Math.max(0, quota - usedCount),
    usedCount,
    status: app.status === ENTERPRISE_API_STATUS.PAUSED
      ? ENTERPRISE_API_STATUS.PAUSED
      : ENTERPRISE_API_STATUS.ENABLED,
    createdAt: app.createdAt || new Date().toISOString()
  }
}

function readBrandApiApps() {
  try {
    const apps = uni.getStorageSync(BRAND_API_APP_STORAGE_KEY)
    if (!Array.isArray(apps)) return []
    const normalizedApps = apps.map(normalizeBrandApiApp)
    if (apps.some((app) => Object.prototype.hasOwnProperty.call(app || {}, 'apiKey'))) {
      uni.setStorageSync(BRAND_API_APP_STORAGE_KEY, normalizedApps)
    }
    return normalizedApps
  } catch (error) {
    return []
  }
}

function writeBrandApiApps(apps = []) {
  try {
    uni.setStorageSync(BRAND_API_APP_STORAGE_KEY, apps.map(normalizeBrandApiApp))
  } catch (error) {}
  return apps
}

function logBrandApi(app = {}) {
  console.log('[brand:api]', {
    brandId: app.brandId || '',
    appId: app.appId || '',
    status: app.status || ''
  })
}

export function getBrandApiApps(brandId = '') {
  return readBrandApiApps()
    .filter((app) => !brandId || app.brandId === brandId)
    .sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt)))
}

export function getBrandApiAppById(appId = '') {
  const app = readBrandApiApps().find((item) => item.appId === appId)
  return app ? { ...app, permissions: [...app.permissions] } : null
}

export function getBrandApiDeveloperContext(appId = '') {
  const app = getBrandApiAppById(appId)
  if (!app) return null
  return {
    appId: app.appId,
    brandId: app.brandId,
    appName: app.appName,
    maskedApiKey: '请在凭证管理中查看',
    permissions: [...app.permissions],
    quota: app.quota,
    usedCount: app.usedCount,
    remainingQuota: app.remainingQuota,
    status: app.status
  }
}

export function createBrandApiApp(input = {}) {
  if (!input.brandId) throw new Error('请选择所属品牌')
  if (!String(input.appName || '').trim()) throw new Error('请填写应用名称')
  const plan = getApiPlanById(input.planId || API_PLAN_IDS.BASIC)
  const currentAppCount = readBrandApiApps().filter((app) => app.brandId === input.brandId).length
  if (currentAppCount >= plan.maxApps) throw new Error(`${plan.name}最多创建 ${plan.maxApps} 个应用`)
  const app = normalizeBrandApiApp({
    ...input,
    appId: input.appId || `brand_api_app_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    planId: plan.planId,
    quota: plan.apiQuota,
    permissions: Array.isArray(input.permissions) && input.permissions.length
      ? input.permissions.filter((permission) => plan.permissions.includes(permission))
      : plan.permissions,
    usedCount: input.usedCount || 0,
    createdAt: input.createdAt || new Date().toISOString()
  })
  writeBrandApiApps([app, ...readBrandApiApps().filter((item) => item.appId !== app.appId)])
  logBrandApi(app)
  return { ...app, permissions: [...app.permissions] }
}

export function updateBrandApiAppStatus(appId = '', status = '') {
  if (![ENTERPRISE_API_STATUS.ENABLED, ENTERPRISE_API_STATUS.PAUSED].includes(status)) {
    throw new Error('无效的 API 应用状态')
  }
  const apps = readBrandApiApps()
  const index = apps.findIndex((app) => app.appId === appId)
  if (index < 0) throw new Error('API 应用不存在')
  const nextApp = normalizeBrandApiApp({ ...apps[index], status })
  apps.splice(index, 1, nextApp)
  writeBrandApiApps(apps)
  logBrandApi(nextApp)
  return { ...nextApp, permissions: [...nextApp.permissions] }
}

export function consumeBrandApiQuota(appId = '', cost = 0) {
  const normalizedCost = Math.max(0, Number(cost) || 0)
  if (!normalizedCost) throw new Error('调用消耗必须大于 0')
  const apps = readBrandApiApps()
  const index = apps.findIndex((app) => app.appId === appId)
  if (index < 0) throw new Error('API 应用不存在')
  const current = normalizeBrandApiApp(apps[index])
  if (current.remainingQuota < normalizedCost) throw new Error('API 应用额度不足')
  const nextApp = normalizeBrandApiApp({
    ...current,
    usedCount: current.usedCount + normalizedCost
  })
  apps.splice(index, 1, nextApp)
  writeBrandApiApps(apps)
  return {
    app: { ...nextApp, permissions: [...nextApp.permissions] },
    beforeQuota: current.remainingQuota,
    afterQuota: nextApp.remainingQuota,
    cost: normalizedCost
  }
}

export function getEnterpriseApis() {
  return readApis().sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt)))
}

export function updateEnterpriseApiStatus(apiId = '', status = '') {
  if (![ENTERPRISE_API_STATUS.ENABLED, ENTERPRISE_API_STATUS.PAUSED].includes(status)) {
    throw new Error('无效的 API 状态')
  }
  const apis = readApis()
  const index = apis.findIndex((api) => api.apiId === apiId)
  if (index < 0) throw new Error('API 不存在')
  const nextApi = normalizeApi({ ...apis[index], status })
  apis.splice(index, 1, nextApi)
  writeApis(apis)
  logApiAction(nextApi, status === ENTERPRISE_API_STATUS.ENABLED ? 'enable' : 'pause')
  return cloneApi(nextApi)
}

export function getEnterpriseApiStatusLabel(status = '') {
  return status === ENTERPRISE_API_STATUS.PAUSED ? '暂停' : '启用'
}

export function getEnterpriseApiCompanyName(companyId = '') {
  return COMPANY_NAMES[companyId] || companyId || '未命名企业'
}

export function getEnterpriseApiName(api = {}) {
  return `${getEnterpriseApiCompanyName(api.companyId)} API`
}

export function maskEnterpriseApiKey(apiKey = '') {
  const value = String(apiKey || '')
  if (!value) return '未配置'
  if (value.length <= 10) return `${value.slice(0, 3)}***`
  return `${value.slice(0, 6)}••••••${value.slice(-4)}`
}
