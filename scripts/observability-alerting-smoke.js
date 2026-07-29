const fs = require('fs')
const path = require('path')
const vm = require('vm')

const ROOT = path.resolve(__dirname, '..')

function read(file) {
  return fs.readFileSync(path.join(ROOT, file), 'utf8')
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function stripImportsAndExports(source) {
  return source
    .replace(/^import .*$/gm, '')
    .replace(/export\s+(const|function)\s+/g, '$1 ')
    .replace(/export\s*\{[^}]+\}\s*$/gm, '')
}

function createRuntime() {
  const storage = {}
  let traceLogger = stripImportsAndExports(read('utils/observability/traceLogger.js'))
  traceLogger += '\nmodule.exports = { LOG_LEVELS, TRACE_MODULES, createTraceContext, writeStructuredLog, listStructuredLogs, getTraceTimeline, redactSensitive, getLogRetentionPolicy, getTraceCoveragePlan, clearDevelopmentObservability };'
  const traceContext = {
    module: { exports: {} },
    exports: {},
    console: { info() {}, warn() {}, error() {}, log() {} },
    Date,
    Math,
    String,
    Number,
    Boolean,
    Array,
    Object,
    Set,
    URL,
    process: { env: { NODE_ENV: 'development' } },
    get(key, fallback) { return Object.prototype.hasOwnProperty.call(storage, key) ? storage[key] : fallback },
    set(key, value) { storage[key] = value },
    getCurrentMember() { return { memberId: 'member_1', userId: 'user_1', enterpriseId: 'enterprise_1', role: 'platform_admin', status: 'active' } },
    getCurrentUser() { return { userId: 'user_1', name: 'Test User' } },
    getCurrentEnterpriseId() { return 'enterprise_1' }
  }
  vm.runInNewContext(traceLogger, traceContext, { filename: 'traceLogger.js' })

  let alertCenter = stripImportsAndExports(read('utils/admin/errorAlertCenter.js'))
  alertCenter += '\nmodule.exports = { ALERT_STATUSES, ALERT_TYPES, evaluateAlertRules, updateAlertStatus, loadErrorAlertCenter };'
  const alertContext = {
    module: { exports: {} },
    exports: {},
    console: { info() {}, warn() {}, error() {}, log() {} },
    Date,
    Math,
    String,
    Number,
    Boolean,
    Array,
    Object,
    Set,
    get(key, fallback) { return Object.prototype.hasOwnProperty.call(storage, key) ? storage[key] : fallback },
    set(key, value) { storage[key] = value },
    requirePlatformAdmin() { return { allowed: true, currentMember: { role: 'platform_admin' } } },
    getTraceCoveragePlan: traceContext.module.exports.getTraceCoveragePlan,
    getTraceTimeline: traceContext.module.exports.getTraceTimeline,
    getLogRetentionPolicy: traceContext.module.exports.getLogRetentionPolicy,
    listStructuredLogs: traceContext.module.exports.listStructuredLogs,
    writeStructuredLog: traceContext.module.exports.writeStructuredLog,
    listTasks() { return storage.__tasks || [] },
    listWorkspaceDeliveries() { return storage.__deliveries || [] }
  }
  vm.runInNewContext(alertCenter, alertContext, { filename: 'errorAlertCenter.js' })
  return { storage, trace: traceContext.module.exports, alerts: alertContext.module.exports }
}

function assertIncludes(text, values, label) {
  values.forEach((value) => assert(text.includes(value), `${label} missing: ${value}`))
}

function main() {
  const runtime = createRuntime()
  const trace = runtime.trace.createTraceContext({ userId: 'user_real_001', enterpriseId: 'enterprise_real_001' })
  assert(trace.requestId && trace.traceId, 'trace context missing ids')

  const redacted = runtime.trace.redactSensitive({
    sessionToken: 'secret-token',
    openId: 'openid-real',
    phone: '13800138000',
    email: 'demo@example.com',
    imageUrl: 'https://private.example.com/a/b/c.png',
    fileId: 'cloud://private/file.png'
  })
  assert(redacted.sessionToken === '[REDACTED]', 'session token not redacted')
  assert(!String(redacted.openId).includes('openid-real'), 'openid not hashed')
  assert(!String(redacted.phone).includes('13800138000'), 'phone not masked')
  assert(!String(redacted.email).includes('demo@example.com'), 'email not masked')
  assert(redacted.imageUrl === 'https://private.example.com/***', 'private url not masked')

  runtime.trace.writeStructuredLog({
    level: 'error',
    module: 'provider',
    action: 'call_wanx',
    traceContext: trace,
    taskId: 'task_trace_001',
    provider: 'wanx',
    modelVersion: 'wanx-v1',
    status: 'failed',
    durationMs: 30000,
    errorCode: 'provider_timeout',
    message: 'provider timeout',
    data: { imageUrl: 'https://private.example.com/full/path.png', apiKey: 'should-hide' }
  })
  assert(runtime.trace.getTraceTimeline('task_trace_001').length === 1, 'taskId trace timeline missing')
  assert(runtime.trace.listStructuredLogs({ errorCode: 'provider_timeout' }).length === 1, 'errorCode filter missing')

  runtime.storage.__tasks = [
    { taskId: 'task_stuck_001', status: 'processing', updatedAt: '2020-01-01T00:00:00.000Z', provider: 'wanx' },
    { taskId: 'task_mock_review_001', status: 'success', provider: 'mock', reviewStatus: 'pending_review' }
  ]
  runtime.storage.__deliveries = [
    { deliveryId: 'delivery_failed_001', status: 'failed', projectId: 'project_1' }
  ]
  const alertResult = runtime.alerts.evaluateAlertRules()
  assert(alertResult.canAccess, 'alert rules not accessible')
  const center = runtime.alerts.loadErrorAlertCenter({ traceId: 'task_trace_001' })
  const alertTypes = center.alerts.map((item) => item.type)
  assert(alertTypes.includes('provider_timeout'), 'provider timeout alert missing')
  assert(alertTypes.includes('task_stuck_processing'), 'stuck task alert missing')
  assert(alertTypes.includes('mock_fallback_review'), 'mock review alert missing')
  assert(alertTypes.includes('delivery_failed'), 'delivery failed alert missing')
  const update = runtime.alerts.updateAlertStatus(center.alerts[0].alertId, 'resolved', { content: 'fixed' })
  assert(update.success && update.alert.status === 'resolved', 'alert status update failed')
  assert(center.retentionPolicies.some((item) => item.type === 'quota' && item.protected), 'quota retention policy missing')
  assert(center.coveragePlan.includes('额度预扣、确认、回滚'), 'coverage plan missing quota flow')

  assertIncludes(read('pages/admin-errors/admin-errors.vue'), ['错误日志', '系统告警', '链路追踪', '治理策略'], 'admin errors page')
  assertIncludes(read('main.js'), ['#/admin/errors', '/pages/admin-errors/admin-errors'], 'admin errors route')
  assertIncludes(read('pages.json'), ['pages/admin-errors', '错误与告警中心'], 'pages.json')
  assertIncludes(read('docs/observability-alerting-v1.md'), ['requestId', 'traceId', 'redactSensitive', '/#/admin/errors'], 'observability docs')

  console.log('[observability-alerting-smoke] ok')
}

main()
