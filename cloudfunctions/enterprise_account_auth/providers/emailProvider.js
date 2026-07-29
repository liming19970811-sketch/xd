const https = require('https')
const { URL } = require('url')
const { buildLoginCodeTemplate } = require('../templates/loginCodeTemplate')

const DEFAULT_TIMEOUT_MS = 8000

function postJson(endpoint = '', headers = {}, payload = {}, timeoutMs = DEFAULT_TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(endpoint)
    const body = JSON.stringify(payload)
    const req = https.request({
      protocol: parsed.protocol,
      hostname: parsed.hostname,
      port: parsed.port || 443,
      path: `${parsed.pathname}${parsed.search}`,
      method: 'POST',
      timeout: timeoutMs,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        ...headers
      }
    }, (res) => {
      let responseBody = ''
      res.on('data', (chunk) => {
        responseBody += chunk
      })
      res.on('end', () => {
        let data = {}
        try {
          data = responseBody ? JSON.parse(responseBody) : {}
        } catch (error) {
          reject(Object.assign(new Error('email_provider_response_invalid'), {
            errorCode: 'email_provider_response_invalid',
            statusCode: res.statusCode
          }))
          return
        }
        resolve({ statusCode: res.statusCode, data })
      })
    })
    req.on('timeout', () => {
      req.destroy(Object.assign(new Error('email_provider_timeout'), { errorCode: 'email_provider_timeout' }))
    })
    req.on('error', reject)
    req.write(body)
    req.end()
  })
}

function normalizeProviderResponse(response = {}) {
  const data = response.data || {}
  if (response.statusCode < 200 || response.statusCode >= 300) {
    return {
      ok: false,
      provider: 'configured_provider',
      status: 'failed',
      errorCode: data.errorCode || 'email_provider_rejected',
      message: '邮件服务商拒绝发送'
    }
  }
  if (data.ok === false || data.success === false) {
    return {
      ok: false,
      provider: 'configured_provider',
      status: 'failed',
      errorCode: data.errorCode || 'email_send_failed',
      message: '邮件发送失败'
    }
  }
  const providerMessageId = data.providerMessageId || data.messageId || data.id || ''
  return {
    ok: true,
    provider: data.provider || 'configured_provider',
    providerMessageId,
    status: data.status || 'sent',
    message: '验证码邮件已发送'
  }
}

function createEmailProvider(config = {}) {
  return {
    provider: 'configured_provider',
    async sendLoginCode(input = {}) {
      const template = buildLoginCodeTemplate({
        code: input.code,
        expiresInMinutes: input.expiresInMinutes
      })
      const payload = {
        to: input.to,
        from: {
          address: config.fromAddress,
          name: config.fromName
        },
        templateId: config.templateId,
        subject: template.subject,
        text: template.text,
        html: template.html,
        requestId: input.requestId
      }
      try {
        const transport = config.transport || postJson
        const response = await transport(config.endpoint, {
          Authorization: `Bearer ${config.apiKey}`,
          'X-Provider-Secret': config.apiSecret,
          'X-Request-Id': input.requestId || ''
        }, payload, config.timeoutMs)
        return normalizeProviderResponse(response)
      } catch (error) {
        if (error && error.errorCode === 'email_provider_timeout') {
          return { ok: false, provider: 'configured_provider', status: 'failed', errorCode: 'email_provider_timeout', message: '邮件服务商响应超时' }
        }
        if (error && error.errorCode === 'email_provider_response_invalid') {
          return { ok: false, provider: 'configured_provider', status: 'failed', errorCode: 'email_provider_response_invalid', message: '邮件服务商响应非法' }
        }
        return { ok: false, provider: 'configured_provider', status: 'failed', errorCode: 'email_send_failed', message: '邮件发送失败' }
      }
    }
  }
}

module.exports = { createEmailProvider, normalizeProviderResponse }
