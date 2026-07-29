export const AUTH_CAPABILITIES = Object.freeze({
  PLACEHOLDER: 'placeholder',
  WECHAT_WEB_OAUTH: 'wechat_web_oauth'
})

export function normalizeAuthCapability(value = '') {
  return Object.values(AUTH_CAPABILITIES).includes(value)
    ? value
    : AUTH_CAPABILITIES.PLACEHOLDER
}

export function getAuthCapabilityLabel(value = '') {
  const capability = normalizeAuthCapability(value)
  if (capability === AUTH_CAPABILITIES.WECHAT_WEB_OAUTH) {
    return '已启用微信开放平台扫码登录'
  }
  return '微信开放平台网站应用尚未配置完成'
}

export function isWechatBrowser() {
  if (typeof navigator === 'undefined') return false
  return /micromessenger/i.test(navigator.userAgent || '')
}
