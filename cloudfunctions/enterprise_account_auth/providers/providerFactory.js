const { createEmailProvider } = require('./emailProvider')
const { createMockEmailProvider } = require('./mockEmailProvider')

function isEnabled(value = '') {
  return ['1', 'true', 'yes', 'on', 'enabled'].includes(String(value || '').toLowerCase())
}

function getRuntimeMode(env = process.env) {
  return String(env.NODE_ENV || env.TCB_ENV || env.ENV || 'development').toLowerCase()
}

function isProductionLike(env = process.env) {
  return ['production', 'prod', 'release', 'trial'].includes(getRuntimeMode(env))
}

function getEmailProviderConfig(env = process.env) {
  return {
    enabled: isEnabled(env.EMAIL_AUTH_ENABLED),
    mode: String(env.EMAIL_PROVIDER_MODE || '').trim(),
    apiKey: String(env.EMAIL_PROVIDER_API_KEY || '').trim(),
    apiSecret: String(env.EMAIL_PROVIDER_API_SECRET || '').trim(),
    endpoint: String(env.EMAIL_PROVIDER_ENDPOINT || '').trim(),
    fromAddress: String(env.EMAIL_FROM_ADDRESS || '').trim(),
    fromName: String(env.EMAIL_FROM_NAME || '蝶变企业工作台').trim(),
    templateId: String(env.EMAIL_TEMPLATE_ID || '').trim(),
    devMockEnabled: isEnabled(env.ACCOUNT_AUTH_DEV_MOCK_ENABLED) && !isProductionLike(env),
    productionLike: isProductionLike(env)
  }
}

function hasConfiguredProvider(config = {}) {
  return Boolean(
    config.apiKey &&
    config.apiSecret &&
    config.endpoint &&
    config.fromAddress
  )
}

function getEmailCapability(env = process.env) {
  const config = getEmailProviderConfig(env)
  if (!config.enabled) {
    return { status: 'disabled', devCodeAvailable: false, provider: 'disabled' }
  }
  if (config.mode === 'mock') {
    if (config.devMockEnabled) return { status: 'development_mock', devCodeAvailable: true, provider: 'mock' }
    return { status: 'disabled', devCodeAvailable: false, provider: 'disabled' }
  }
  if (['configured', 'configured_provider'].includes(config.mode)) {
    if (hasConfiguredProvider(config)) return { status: 'configured', devCodeAvailable: false, provider: 'configured_provider' }
    return { status: 'disabled', devCodeAvailable: false, provider: 'configured_provider', errorCode: 'auth_provider_not_configured' }
  }
  if (config.devMockEnabled && config.mode === 'development_mock') {
    return { status: 'development_mock', devCodeAvailable: true, provider: 'mock' }
  }
  return { status: 'disabled', devCodeAvailable: false, provider: 'disabled' }
}

function createEmailProviderByEnv(env = process.env) {
  const config = getEmailProviderConfig(env)
  const capability = getEmailCapability(env)
  if (!config.enabled || capability.status === 'disabled') {
    return {
      capability,
      provider: {
        provider: 'disabled',
        async sendLoginCode() {
          return {
            ok: false,
            provider: 'disabled',
            status: 'failed',
            errorCode: 'auth_provider_not_configured',
            message: '邮箱验证码服务暂未配置'
          }
        }
      }
    }
  }
  if (capability.provider === 'mock') {
    return { capability, provider: createMockEmailProvider({ devCodeAvailable: capability.devCodeAvailable }) }
  }
  if (!hasConfiguredProvider(config)) {
    return {
      capability,
      provider: {
        provider: 'configured_provider',
        async sendLoginCode() {
          return {
            ok: false,
            provider: 'configured_provider',
            status: 'failed',
            errorCode: 'auth_provider_not_configured',
            message: '邮箱验证码服务暂未配置'
          }
        }
      }
    }
  }
  return {
    capability,
    provider: createEmailProvider({
      apiKey: config.apiKey,
      apiSecret: config.apiSecret,
      endpoint: config.endpoint,
      fromAddress: config.fromAddress,
      fromName: config.fromName,
      templateId: config.templateId,
      timeoutMs: 8000
    })
  }
}

module.exports = {
  createEmailProviderByEnv,
  getEmailCapability,
  getEmailProviderConfig,
  hasConfiguredProvider,
  isProductionLike
}
