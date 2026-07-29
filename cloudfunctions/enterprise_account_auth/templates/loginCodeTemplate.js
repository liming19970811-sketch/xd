function escapeHtml(value = '') {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function buildLoginCodeTemplate(input = {}) {
  const code = escapeHtml(input.code)
  const expiresInMinutes = Number(input.expiresInMinutes || 5)
  const title = '蝶变企业工作台登录验证码'
  const text = [
    title,
    '',
    `登录验证码：${code}`,
    `${expiresInMinutes} 分钟内有效。`,
    '请不要向他人泄露验证码。',
    '如果不是你本人操作，可以忽略此邮件。'
  ].join('\n')
  const html = [
    '<div style="font-family:Arial,sans-serif;line-height:1.7;color:#111827">',
    `<h2>${escapeHtml(title)}</h2>`,
    '<p>你的登录验证码是：</p>',
    `<p style="font-size:28px;font-weight:700;letter-spacing:4px">${code}</p>`,
    `<p>${expiresInMinutes} 分钟内有效，请不要向他人泄露。</p>`,
    '<p style="color:#64748b">如果不是你本人操作，可以忽略此邮件。</p>',
    '</div>'
  ].join('')
  return { subject: title, text, html }
}

module.exports = { buildLoginCodeTemplate, escapeHtml }
