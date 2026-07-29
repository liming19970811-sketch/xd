const http = require('http')
const { handleWebAction, fail, safeLog, shortHash } = require('../enterprise_web_login/core')

const PORT = 9000
const MAX_BODY_BYTES = 16 * 1024
const ALLOWED_ACTIONS = new Set(['createTicket', 'getTicketStatus', 'consumeTicket', 'cancelTicket'])
const BLOCKED_ACTIONS = new Set(['getConfirmContext', 'confirmTicket'])
const RATE_LIMIT_WINDOW_MS = 60 * 1000
const RATE_LIMIT_COUNT = 60
const requestBuckets = new Map()

function isEnabled(value = '') {
  return ['1', 'true', 'yes', 'on', 'enabled'].includes(String(value || '').toLowerCase())
}

function getRuntimeMode() {
  return String(process.env.NODE_ENV || process.env.TCB_ENV || process.env.ENV || 'development').toLowerCase()
}

function isProductionLike() {
  return ['production', 'prod', 'release', 'trial'].includes(getRuntimeMode())
}

function parseAllowedOrigins() {
  return String(process.env.ENTERPRISE_WEB_ALLOWED_ORIGINS || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

function isLocalhostOrigin(origin = '') {
  try {
    const url = new URL(origin)
    return ['localhost', '127.0.0.1', '::1'].includes(url.hostname)
  } catch (error) {
    return false
  }
}

function isOriginAllowed(origin = '') {
  if (!origin) return false
  const allowed = parseAllowedOrigins()
  if (allowed.includes(origin)) return true
  if (!isProductionLike() && isLocalhostOrigin(origin)) return true
  if (!isProductionLike() && allowed.includes('*')) return true
  return false
}

function writeJson(res, statusCode = 200, payload = {}, origin = '') {
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Vary': 'Origin'
  }
  if (origin && isOriginAllowed(origin)) {
    headers['Access-Control-Allow-Origin'] = origin
    headers['Access-Control-Allow-Methods'] = 'POST, OPTIONS'
    headers['Access-Control-Allow-Headers'] = 'Content-Type'
    headers['Access-Control-Max-Age'] = '600'
  }
  res.writeHead(statusCode, headers)
  res.end(JSON.stringify(payload))
}

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0
    let body = ''
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > MAX_BODY_BYTES) {
        reject(Object.assign(new Error('request_too_large'), { errorCode: 'request_too_large' }))
        req.destroy()
        return
      }
      body += chunk.toString('utf8')
    })
    req.on('end', () => {
      if (!body) return resolve({})
      try {
        resolve(JSON.parse(body))
      } catch (error) {
        reject(Object.assign(new Error('cloud_response_invalid'), { errorCode: 'cloud_response_invalid' }))
      }
    })
    req.on('error', reject)
  })
}

function resolveAction(req, body = {}) {
  if (body.action) return String(body.action)
  const path = (req.url || '').split('?')[0]
  const map = {
    '/create-ticket': 'createTicket',
    '/ticket-status': 'getTicketStatus',
    '/consume-ticket': 'consumeTicket',
    '/cancel-ticket': 'cancelTicket'
  }
  return map[path] || ''
}

function getClientKey(req, body = {}) {
  const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim()
  const ip = forwarded || req.socket.remoteAddress || 'unknown'
  return shortHash(`${ip}:${body.clientId || ''}`)
}

function isRateLimited(clientKey = '') {
  const now = Date.now()
  const bucket = requestBuckets.get(clientKey) || []
  const fresh = bucket.filter((time) => now - time < RATE_LIMIT_WINDOW_MS)
  fresh.push(now)
  requestBuckets.set(clientKey, fresh)
  return fresh.length > RATE_LIMIT_COUNT
}

async function handleRequest(req, res) {
  const origin = String(req.headers.origin || '')
  if (!isOriginAllowed(origin)) {
    const payload = fail('invalid_origin', '当前 H5 域名未允许访问网页登录接口', { status: 'failed' })
    safeLog('http_origin_rejected', { status: 'failed', errorCode: 'invalid_origin' })
    return writeJson(res, 403, payload, origin)
  }

  if (req.method === 'OPTIONS') {
    return writeJson(res, 204, {}, origin)
  }

  if (req.method !== 'POST') {
    return writeJson(res, 405, fail('invalid_method', '仅支持 POST 请求', { status: 'failed' }), origin)
  }

  const contentType = String(req.headers['content-type'] || '').toLowerCase()
  if (!contentType.includes('application/json')) {
    return writeJson(res, 415, fail('invalid_content_type', '请求 Content-Type 必须为 application/json', { status: 'failed' }), origin)
  }

  let body
  try {
    body = await readRequestBody(req)
  } catch (error) {
    const errorCode = error && error.errorCode === 'request_too_large' ? 'request_too_large' : 'cloud_response_invalid'
    const statusCode = errorCode === 'request_too_large' ? 413 : 400
    return writeJson(res, statusCode, fail(errorCode, errorCode === 'request_too_large' ? '请求体过大' : '请求体不是合法 JSON', { status: 'failed' }), origin)
  }

  const clientKey = getClientKey(req, body)
  if (isRateLimited(clientKey)) {
    return writeJson(res, 429, fail('rate_limited', '请求过于频繁，请稍后再试', { status: 'failed' }), origin)
  }

  const action = resolveAction(req, body)
  if (BLOCKED_ACTIONS.has(action) || !ALLOWED_ACTIONS.has(action)) {
    return writeJson(res, 400, fail('invalid_action', 'HTTP 登录接口不支持该动作', { status: 'failed' }), origin)
  }

  const result = await handleWebAction({
    ...body,
    action,
    clientId: body.clientId || clientKey
  })
  return writeJson(res, result && result.success ? 200 : 400, result, origin)
}

const server = http.createServer((req, res) => {
  handleRequest(req, res).catch((error) => {
    safeLog('http_unhandled', { status: 'failed', errorCode: error && error.code ? error.code : 'cloud_call_failed' })
    writeJson(res, 500, fail('cloud_call_failed', '网页登录 HTTP 接口调用失败', { status: 'failed' }), String(req.headers.origin || ''))
  })
})

server.listen(PORT)
