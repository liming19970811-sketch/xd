import { get, set } from '../data-provider/dataProvider.js'
import { getCurrentMember, getCurrentUser } from '../auth/authRepository.js'
import { getCurrentEnterpriseId } from '../tenant/tenantContext.js'

const LOG_STORAGE_KEY = 'diebians_observability_logs_v1'
const TRACE_STORAGE_KEY = 'diebians_observability_traces_v1'
const MAX_LOG_RECORDS = 2000

export const LOG_LEVELS = Object.freeze(['debug', 'info', 'warn', 'error', 'critical'])

export const TRACE_MODULES = Object.freeze([
  'auth',
  'upload',
  'task',
  'provider',
  'polling',
  'quota',
  'asset',
  'review',
  'delivery',
  'pattern',
  'model',
  'permission',
  'admin'
])

function nowIso() {
  return new Date().toISOString()
}

function createId(prefix = 'trace') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

function getEnvironment() {
  if (typeof process !== 'undefined' && process && process.env && process.env.NODE_ENV) {
    return String(process.env.NODE_ENV)
  }
  try {
    if (typeof wx !== 'undefined' && wx && typeof wx.getAccountInfoSync === 'function') {
      return String(wx.getAccountInfoSync()?.miniProgram?.envVersion || 'miniapp')
    }
  } catch (error) {}
  return 'development'
}

function isDebugEnabled() {
  return getEnvironment() !== 'production'
}

function hashText(value = '') {
  const text = String(value || '')
  let hash = 0
  for (let index = 0; index < text.length; index += 1) {
    hash = ((hash << 5) - hash + text.charCodeAt(index)) | 0
  }
  return text ? `hash_${Math.abs(hash).toString(16)}` : ''
}

function maskAccount(value = '') {
  const text = String(value || '').trim()
  if (!text) return ''
  if (text.includes('@')) {
    const [name, domain] = text.split('@')
    return `${name.slice(0, 2)}***@${domain ? domain.replace(/^(.{2}).*?(\..+)$/, '$1***$2') : '***'}`
  }
  if (/^\d{7,}$/.test(text)) return `${text.slice(0, 3)}****${text.slice(-4)}`
  return hashText(text)
}

function maskUrl(value = '') {
  const text = String(value || '')
  if (!text) return ''
  if (/^cloud:\/\//i.test(text)) return 'cloud://***'
  if (/^https?:\/\//i.test(text)) {
    try {
      const url = new URL(text)
      return `${url.protocol}//${url.host}/***`
    } catch (error) {
      return 'https://***'
    }
  }
  if (/^(wxfile:\/\/|http:\/\/tmp\/|blob:|file:)/i.test(text)) return 'local://***'
  return text.length > 64 ? `${text.slice(0, 16)}***${text.slice(-8)}` : text
}

function redactValue(key = '', value) {
  const normalizedKey = String(key || '').toLowerCase()
  if (value === null || value === undefined) return value
  if (/(token|secret|apikey|api_key|privatekey|password|credential|authorization)/i.test(normalizedKey)) return '[REDACTED]'
  if (/(openid|unionid|userid|memberid|ownerid|createdby)/i.test(normalizedKey)) return hashText(value)
  if (/(phone|mobile|email|account)/i.test(normalizedKey)) return maskAccount(value)
  if (/(url|image|fileurl|download|temp)/i.test(normalizedKey) && typeof value === 'string') return maskUrl(value)
  if (typeof value === 'string' && /^(https?:\/\/|cloud:\/\/|wxfile:\/\/|http:\/\/tmp\/|blob:|file:)/i.test(value)) return maskUrl(value)
  if (Array.isArray(value)) return value.slice(0, 20).map((item) => redactSensitive(item))
  if (typeof value === 'object') return redactSensitive(value)
  return value
}

export function redactSensitive(payload = {}) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return payload
  return Object.keys(payload).reduce((result, key) => {
    result[key] = redactValue(key, payload[key])
    return result
  }, {})
}

function readLogs() {
  const value = get(LOG_STORAGE_KEY, [])
  return Array.isArray(value) ? value : []
}

function writeLogs(records = []) {
  set(LOG_STORAGE_KEY, records.slice(0, MAX_LOG_RECORDS))
}

function readTraces() {
  const value = get(TRACE_STORAGE_KEY, [])
  return Array.isArray(value) ? value : []
}

function writeTraces(records = []) {
  set(TRACE_STORAGE_KEY, records.slice(0, MAX_LOG_RECORDS))
}

export function createTraceContext(input = {}) {
  const requestId = String(input.requestId || createId('req'))
  const traceId = String(input.traceId || createId('trace'))
  const member = getCurrentMember() || {}
  const user = getCurrentUser() || {}
  const context = {
    requestId,
    traceId,
    environment: input.environment || getEnvironment(),
    userHash: input.userHash || hashText(input.userId || member.userId || user.userId || ''),
    enterpriseHash: input.enterpriseHash || hashText(input.enterpriseId || getCurrentEnterpriseId() || member.enterpriseId || ''),
    createdAt: input.createdAt || nowIso()
  }
  writeTraces([{ ...context, status: 'open' }, ...readTraces().filter((item) => item.traceId !== traceId)])
  return context
}

function normalizeLog(input = {}) {
  const trace = input.traceContext || {}
  const level = LOG_LEVELS.includes(input.level) ? input.level : 'info'
  const moduleName = TRACE_MODULES.includes(input.module) ? input.module : String(input.module || 'system')
  return {
    logId: input.logId || createId('log'),
    environment: input.environment || trace.environment || getEnvironment(),
    level,
    module: moduleName,
    action: String(input.action || ''),
    requestId: String(input.requestId || trace.requestId || createId('req')),
    traceId: String(input.traceId || trace.traceId || createId('trace')),
    userHash: input.userHash || trace.userHash || hashText(input.userId || ''),
    enterpriseHash: input.enterpriseHash || trace.enterpriseHash || hashText(input.enterpriseId || ''),
    taskId: String(input.taskId || ''),
    projectId: String(input.projectId || ''),
    batchId: String(input.batchId || ''),
    provider: String(input.provider || ''),
    modelVersion: String(input.modelVersion || ''),
    status: String(input.status || ''),
    durationMs: Math.max(0, Number(input.durationMs) || 0),
    errorCode: String(input.errorCode || ''),
    message: String(input.message || ''),
    data: redactSensitive(input.data || {}),
    createdAt: input.createdAt || nowIso()
  }
}

export function writeStructuredLog(input = {}) {
  const log = normalizeLog(input)
  if (log.level === 'debug' && !isDebugEnabled()) return { ok: true, skipped: true, log }
  writeLogs([log, ...readLogs().filter((item) => item.logId !== log.logId)])
  if (typeof console !== 'undefined') {
    const output = {
      level: log.level,
      module: log.module,
      action: log.action,
      requestId: log.requestId,
      traceId: log.traceId,
      taskId: log.taskId,
      projectId: log.projectId,
      batchId: log.batchId,
      provider: log.provider,
      modelVersion: log.modelVersion,
      status: log.status,
      durationMs: log.durationMs,
      errorCode: log.errorCode,
      createdAt: log.createdAt
    }
    const method = log.level === 'critical' || log.level === 'error' ? 'error' : (log.level === 'warn' ? 'warn' : 'info')
    if (typeof console[method] === 'function') console[method]('[observability]', output)
  }
  return { ok: true, log }
}

export function listStructuredLogs(filters = {}) {
  return readLogs()
    .filter((log) => !filters.level || log.level === filters.level)
    .filter((log) => !filters.module || log.module === filters.module)
    .filter((log) => !filters.errorCode || log.errorCode === filters.errorCode)
    .filter((log) => !filters.provider || log.provider === filters.provider)
    .filter((log) => !filters.modelVersion || log.modelVersion === filters.modelVersion)
    .filter((log) => !filters.taskId || log.taskId === filters.taskId)
    .filter((log) => !filters.projectId || log.projectId === filters.projectId)
    .filter((log) => !filters.batchId || log.batchId === filters.batchId)
    .filter((log) => !filters.traceId || log.traceId === filters.traceId)
    .sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt)))
}

export function getTraceTimeline(identifier = '') {
  const target = String(identifier || '')
  if (!target) return []
  return listStructuredLogs().filter((log) => (
    log.traceId === target ||
    log.requestId === target ||
    log.taskId === target ||
    log.projectId === target ||
    log.batchId === target
  ))
}

export function getLogRetentionPolicy() {
  return [
    { type: 'runtime', label: '普通运行日志', retentionDays: 30, protected: false },
    { type: 'error', label: '错误日志', retentionDays: 180, protected: false },
    { type: 'security', label: '安全日志', retentionDays: 365, protected: true },
    { type: 'quota', label: '额度日志', retentionDays: 730, protected: true },
    { type: 'audit_delivery', label: '审核与交付审计日志', retentionDays: 1095, protected: true }
  ]
}

export function getTraceCoveragePlan() {
  return [
    '用户登录与企业切换',
    '文件上传与临时 URL 生成',
    '任务创建与 provider 调用',
    '异步任务轮询',
    '额度预扣、确认、回滚',
    '审核通过与退回',
    '交付创建与下载',
    '版型版本与模型发布',
    '权限拒绝',
    '管理员高风险操作'
  ]
}

export function clearDevelopmentObservability() {
  if (!isDebugEnabled()) return { ok: false, errorCode: 'production_clear_blocked' }
  writeLogs([])
  writeTraces([])
  return { ok: true }
}
