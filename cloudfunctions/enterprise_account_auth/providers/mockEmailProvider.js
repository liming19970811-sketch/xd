function createMockEmailProvider(config = {}) {
  return {
    provider: 'mock',
    async sendLoginCode(input = {}) {
      return {
        ok: true,
        provider: 'mock',
        providerMessageId: `mock_email_${input.requestId || Date.now()}`,
        status: 'sent',
        devCodeAvailable: Boolean(config.devCodeAvailable),
        debug: config.devCodeAvailable ? { devCode: input.code } : undefined,
        message: '开发 Mock 邮件已生成'
      }
    }
  }
}

module.exports = { createMockEmailProvider }
