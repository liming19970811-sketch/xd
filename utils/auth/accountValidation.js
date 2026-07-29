export function normalizeEmail(value = '') {
  return String(value || '').trim().toLowerCase()
}

export function validateEmail(value = '') {
  const email = normalizeEmail(value)
  if (!email) return { valid: false, value: email, errorCode: 'invalid_email', message: '请输入邮箱地址' }
  if (email.length > 120) return { valid: false, value: email, errorCode: 'invalid_email', message: '邮箱地址过长' }
  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  return valid
    ? { valid: true, value: email }
    : { valid: false, value: email, errorCode: 'invalid_email', message: '邮箱格式不正确' }
}

export function normalizePhone(value = '') {
  const raw = String(value || '').trim().replace(/[\s-]/g, '')
  if (/^\+86\d{11}$/.test(raw)) return raw
  if (/^86\d{11}$/.test(raw)) return `+${raw}`
  if (/^1\d{10}$/.test(raw)) return `+86${raw}`
  return raw
}

export function validatePhone(value = '') {
  const phone = normalizePhone(value)
  const valid = /^\+861[3-9]\d{9}$/.test(phone)
  return valid
    ? { valid: true, value: phone }
    : { valid: false, value: phone, errorCode: 'invalid_phone', message: '请输入中国大陆手机号' }
}

export function maskAccount(provider = 'email', value = '') {
  const text = String(value || '')
  if (provider === 'phone') {
    return text.replace(/^(\+86)(\d{3})\d{4}(\d{4})$/, '$1 $2****$3')
  }
  const [name = '', domain = ''] = text.split('@')
  if (!domain) return text
  const maskedName = name.length <= 2 ? `${name[0] || '*'}*` : `${name.slice(0, 2)}***`
  return `${maskedName}@${domain}`
}
