const assert = require('assert')
const { getEmailCapability, hasConfiguredProvider } = require('../cloudfunctions/enterprise_account_auth/providers/providerFactory')
const { createEmailProvider, normalizeProviderResponse } = require('../cloudfunctions/enterprise_account_auth/providers/emailProvider')
const { createMockEmailProvider } = require('../cloudfunctions/enterprise_account_auth/providers/mockEmailProvider')
const { buildLoginCodeTemplate } = require('../cloudfunctions/enterprise_account_auth/templates/loginCodeTemplate')

async function run() {
  const disabled = getEmailCapability({})
  assert.strictEqual(disabled.status, 'disabled', 'provider disabled when not enabled')

  const incomplete = getEmailCapability({
    EMAIL_AUTH_ENABLED: 'true',
    EMAIL_PROVIDER_MODE: 'configured_provider',
    EMAIL_PROVIDER_API_KEY: 'key',
    EMAIL_FROM_ADDRESS: 'noreply@example.com'
  })
  assert.strictEqual(incomplete.status, 'disabled', 'incomplete configured provider rejected')
  assert.strictEqual(incomplete.errorCode, 'auth_provider_not_configured', 'incomplete provider returns config error')

  const mock = getEmailCapability({
    EMAIL_AUTH_ENABLED: 'true',
    EMAIL_PROVIDER_MODE: 'mock',
    ACCOUNT_AUTH_DEV_MOCK_ENABLED: 'true',
    NODE_ENV: 'development'
  })
  assert.strictEqual(mock.status, 'development_mock', 'mock requires explicit dev enable')

  const prodMock = getEmailCapability({
    EMAIL_AUTH_ENABLED: 'true',
    EMAIL_PROVIDER_MODE: 'mock',
    ACCOUNT_AUTH_DEV_MOCK_ENABLED: 'true',
    NODE_ENV: 'production'
  })
  assert.strictEqual(prodMock.status, 'disabled', 'production mock disabled')

  assert.strictEqual(hasConfiguredProvider({
    apiKey: 'key',
    apiSecret: 'secret',
    endpoint: 'https://email.example.com/send',
    fromAddress: 'noreply@example.com'
  }), true, 'configured provider requirements')

  const ok = normalizeProviderResponse({ statusCode: 200, data: { ok: true, providerMessageId: 'msg_1' } })
  assert.strictEqual(ok.ok, true, 'provider success normalized')
  assert.strictEqual(ok.providerMessageId, 'msg_1', 'provider message id preserved')
  const rejected = normalizeProviderResponse({ statusCode: 403, data: { errorCode: 'email_provider_rejected' } })
  assert.strictEqual(rejected.errorCode, 'email_provider_rejected', 'provider rejection normalized')
  const failed = normalizeProviderResponse({ statusCode: 200, data: { ok: false } })
  assert.strictEqual(failed.errorCode, 'email_send_failed', 'provider failure normalized')

  const injectedOk = createEmailProvider({
    endpoint: 'https://email.example.com/send',
    apiKey: 'key',
    apiSecret: 'secret',
    fromAddress: 'noreply@example.com',
    transport: async () => ({ statusCode: 200, data: { ok: true, providerMessageId: 'msg_2' } })
  })
  const injectedSent = await injectedOk.sendLoginCode({ to: 'real@example.com', code: '654321', requestId: 'req_ok' })
  assert.strictEqual(injectedSent.providerMessageId, 'msg_2', 'configured provider success via injected transport')

  const timeoutProvider = createEmailProvider({
    endpoint: 'https://email.example.com/send',
    apiKey: 'key',
    apiSecret: 'secret',
    fromAddress: 'noreply@example.com',
    transport: async () => {
      const error = new Error('timeout')
      error.errorCode = 'email_provider_timeout'
      throw error
    }
  })
  assert.strictEqual((await timeoutProvider.sendLoginCode({ to: 'real@example.com', code: '654321', requestId: 'req_timeout' })).errorCode, 'email_provider_timeout', 'provider timeout')

  const invalidProvider = createEmailProvider({
    endpoint: 'https://email.example.com/send',
    apiKey: 'key',
    apiSecret: 'secret',
    fromAddress: 'noreply@example.com',
    transport: async () => {
      const error = new Error('invalid')
      error.errorCode = 'email_provider_response_invalid'
      throw error
    }
  })
  assert.strictEqual((await invalidProvider.sendLoginCode({ to: 'real@example.com', code: '654321', requestId: 'req_invalid' })).errorCode, 'email_provider_response_invalid', 'provider invalid response')

  const mockProvider = createMockEmailProvider({ devCodeAvailable: true })
  const sent = await mockProvider.sendLoginCode({ to: 'demo@example.com', code: '123456', requestId: 'req_1' })
  assert.strictEqual(sent.debug.devCode, '123456', 'mock provider returns debug devCode only in debug field')

  const template = buildLoginCodeTemplate({ code: '<123456>', expiresInMinutes: 5 })
  assert(template.html.includes('&lt;123456&gt;'), 'template escapes html')
  assert(!template.html.includes('sessionToken'), 'template has no session token')

  const logs = JSON.stringify({ provider: 'configured_provider', accountHashPrefix: 'abcdef12', sendSuccess: true })
  assert(!/demo@example\.com|123456|secret/.test(logs), 'safe log payload only')
  console.log('enterprise-email-provider smoke passed')
}

run()
