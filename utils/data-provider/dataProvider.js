import localProvider from './localProvider.js'
import cloudProvider from './cloudProvider.js'

export const DATA_PROVIDER_LOCAL = 'local'
export const DATA_PROVIDER_CLOUD = 'cloud'

const providers = {
  [DATA_PROVIDER_LOCAL]: localProvider,
  [DATA_PROVIDER_CLOUD]: cloudProvider
}

const LOCAL_CONTEXT_KEYS = new Set([
  'diebiandesign_auth_context_v1',
  'diebiandesign_role_permissions_v1',
  'diebiandesign_enterprise_roles_v1'
])

export function getConfiguredDataSourceMode() {
  if (typeof process !== 'undefined' && process?.env?.DATA_SOURCE_MODE) {
    return String(process.env.DATA_SOURCE_MODE).trim().toLowerCase() === DATA_PROVIDER_CLOUD
      ? DATA_PROVIDER_CLOUD
      : DATA_PROVIDER_LOCAL
  }
  if (typeof globalThis !== 'undefined' && globalThis.DATA_SOURCE_MODE) {
    return String(globalThis.DATA_SOURCE_MODE).trim().toLowerCase() === DATA_PROVIDER_CLOUD
      ? DATA_PROVIDER_CLOUD
      : DATA_PROVIDER_LOCAL
  }
  return DATA_PROVIDER_LOCAL
}

function normalizeProviderName(name = '') {
  return [DATA_PROVIDER_LOCAL, DATA_PROVIDER_CLOUD].includes(name) ? name : DATA_PROVIDER_LOCAL
}

let activeProviderName = normalizeProviderName(getConfiguredDataSourceMode())

function assertProvider(provider) {
  if (!provider || typeof provider.get !== 'function' || typeof provider.set !== 'function' || typeof provider.remove !== 'function') {
    throw new TypeError('Data provider must implement get, set and remove')
  }
  return provider
}

export function registerDataProvider(name, provider) {
  const providerName = String(name || '').trim()
  if (!providerName) throw new TypeError('Data provider name is required')
  providers[providerName] = assertProvider(provider)
  return providers[providerName]
}

export function useDataProvider(name = DATA_PROVIDER_LOCAL) {
  const providerName = String(name || DATA_PROVIDER_LOCAL).trim()
  if (!providers[providerName]) {
    throw new Error(`Data provider is not registered: ${providerName}`)
  }
  activeProviderName = providerName
  return providers[providerName]
}

export function configureDataProvider(options = {}) {
  if (options.cloudProvider) registerDataProvider(DATA_PROVIDER_CLOUD, options.cloudProvider)
  const explicitMode = String(options.mode || options.dataSourceMode || '').trim().toLowerCase()
  const environmentMode = getConfiguredDataSourceMode()
  const targetName = normalizeProviderName(explicitMode || environmentMode)
  return useDataProvider(targetName)
}

export function getDataSourceMode() {
  return activeProviderName
}

export function isDataProviderDevelopment() {
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

  let isDevelopment = false
  if (envVersion === 'trial' || envVersion === 'release') {
    isDevelopment = false
  } else if (envVersion === 'develop') {
    isDevelopment = true
  } else if (nodeEnv === 'development' || nodeEnv === 'dev') {
    isDevelopment = true
  }

  if (isDevelopment && typeof console !== 'undefined' && typeof console.info === 'function') {
    console.info('[cloud-alpha:environment]', {
      nodeEnv: ['development', 'dev', 'production'].includes(nodeEnv) ? nodeEnv : 'unknown',
      envVersion: ['develop', 'trial', 'release'].includes(envVersion) ? envVersion : 'unknown',
      isDevelopment
    })
  }

  return isDevelopment
}

export function getActiveDataProvider() {
  return providers[activeProviderName] || providers[DATA_PROVIDER_LOCAL]
}

export function getDataProviderName() {
  return activeProviderName
}

export function get(key, fallback = null) {
  if (typeof key === 'string' && LOCAL_CONTEXT_KEYS.has(key)) return localProvider.get(key, fallback)
  return getActiveDataProvider().get(key, fallback)
}

export function set(key, value) {
  if (typeof key === 'string' && LOCAL_CONTEXT_KEYS.has(key)) return localProvider.set(key, value)
  return getActiveDataProvider().set(key, value)
}

export function remove(key) {
  if (typeof key === 'string' && LOCAL_CONTEXT_KEYS.has(key)) return localProvider.remove(key)
  return getActiveDataProvider().remove(key)
}

export function query(collection = '', filters = {}) {
  const provider = getActiveDataProvider()
  if (typeof provider.query === 'function') return provider.query(collection, filters)
  const queryOptions = collection && typeof collection === 'object' && !Array.isArray(collection) ? collection : null
  const storageKey = queryOptions ? (queryOptions.key || queryOptions.collection || '') : collection
  const queryFilters = queryOptions ? (queryOptions.filters || {}) : filters
  const records = provider.get(storageKey, [])
  if (!Array.isArray(records)) return []
  const filterEntries = Object.entries(queryFilters && typeof queryFilters === 'object' ? queryFilters : {})
  return records.filter((record) => filterEntries.every(([key, value]) => record?.[key] === value))
}
