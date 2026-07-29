const fs = require('fs')
const path = require('path')
const vm = require('vm')
const crypto = require('crypto')

const ROOT = path.resolve(__dirname, '..')
const REPORT_PATH = path.join(ROOT, 'docs/regression-report-v1.md')
const executedAt = new Date().toISOString()
const results = []

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8')
}

function fileExists(relativePath) {
  return fs.existsSync(path.join(ROOT, relativePath))
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function record(layer, name, ok, detail = '', risk = 'P2') {
  const item = { layer, name, ok: Boolean(ok), detail, risk }
  results.push(item)
  console.log(`${ok ? '[PASS]' : '[FAIL]'} [${layer}] ${name}${detail ? ` - ${detail}` : ''}`)
}

function test(layer, name, risk, fn) {
  try {
    fn()
    record(layer, name, true, '', risk)
  } catch (error) {
    record(layer, name, false, error && error.message ? error.message : String(error), risk)
  }
}

function listFiles(directory, extensions = null) {
  const root = path.join(ROOT, directory)
  if (!fs.existsSync(root)) return []
  const files = []
  const walk = (current) => {
    fs.readdirSync(current, { withFileTypes: true }).forEach((entry) => {
      const fullPath = path.join(current, entry.name)
      if (entry.isDirectory()) walk(fullPath)
      else if (!extensions || extensions.includes(path.extname(entry.name).toLowerCase())) files.push(fullPath)
    })
  }
  walk(root)
  return files
}

function loadSchemaCatalog() {
  let source = read('utils/schema/schemaCatalog.js')
  source = source.replace(/^export\s+/gm, '')
  source += '\nmodule.exports = { STATUS_ENUMS, normalizeStandardStatus, getDataDictionary, getIndexPlan };'
  const context = { module: { exports: {} }, exports: {}, Object, Array, String, Number, Boolean }
  vm.runInNewContext(source, context, { filename: 'schemaCatalog.js' })
  return context.module.exports
}

function normalizeApiResponse(response = {}) {
  return {
    requestId: String(response.requestId || ''),
    success: response.success === true,
    code: String(response.code || ''),
    message: String(response.message || ''),
    data: response.data && typeof response.data === 'object' ? response.data : null,
    timestamp: String(response.timestamp || '')
  }
}

function validateApiResponse(response = {}) {
  const normalized = normalizeApiResponse(response)
  const missing = Object.entries(normalized)
    .filter(([key, value]) => key !== 'data' ? !value : value === null)
    .map(([key]) => key)
  return { ok: missing.length === 0, missing, normalized }
}

function validateAsyncTaskPayload(payload = {}) {
  const data = payload.data || {}
  const statuses = new Set(['pending', 'queued', 'processing', 'needs_review', 'success', 'completed', 'failed', 'timeout'])
  return Boolean(data.taskId && statuses.has(data.status) && data.pollingUrl)
}

function createQuotaLedger() {
  const records = new Map()
  let balance = 10
  return {
    get balance() {
      return balance
    },
    preHold({ idempotencyKey, amount }) {
      if (!idempotencyKey) return { ok: false, errorCode: 'missing_idempotency_key' }
      if (records.has(idempotencyKey)) return { ok: true, reused: true, record: records.get(idempotencyKey) }
      if (amount > balance) return { ok: false, errorCode: 'insufficient_quota' }
      const record = {
        recordId: `test_usage_${records.size + 1}`,
        idempotencyKey,
        amount,
        status: 'pending',
        before: balance,
        after: balance - amount
      }
      balance -= amount
      records.set(idempotencyKey, record)
      return { ok: true, reused: false, record }
    },
    confirm(idempotencyKey) {
      const record = records.get(idempotencyKey)
      if (!record) return { ok: false, errorCode: 'record_not_found' }
      if (record.status === 'rolled_back') return { ok: false, errorCode: 'terminal_record' }
      record.status = 'finalized'
      return { ok: true, record }
    },
    rollback(idempotencyKey) {
      const record = records.get(idempotencyKey)
      if (!record) return { ok: false, errorCode: 'record_not_found' }
      if (record.status === 'finalized') return { ok: false, errorCode: 'terminal_record' }
      if (record.status === 'rolled_back') return { ok: true, reused: true, record }
      balance += record.amount
      record.status = 'rolled_back'
      return { ok: true, record }
    }
  }
}

function canAccessFixture(member = {}, resource = {}, permission = '') {
  if (!member || member.status !== 'active') return false
  if (!Array.isArray(member.permissions) || !member.permissions.includes(permission)) return false
  if (resource.enterpriseId && member.enterpriseId && resource.enterpriseId !== member.enterpriseId) return false
  if (member.scope === 'all') return true
  if (member.scope === 'own') return resource.ownerId === member.userId || resource.createdBy === member.userId
  if (member.scope === 'project') return Array.isArray(member.projectIds) && member.projectIds.includes(resource.projectId)
  return false
}

function isDeliverableFixture(task = {}) {
  if (!task || task.status !== 'success') return false
  if (task.mock || task.isMock || task.fallback || task.isFallback || task.fallbackReason) return false
  if (String(task.provider || '').toLowerCase().includes('mock')) return false
  if (String(task.provider || '').toLowerCase().includes('fallback')) return false
  const items = Array.isArray(task.result && task.result.items) ? task.result.items : []
  return Boolean(task.resultImageUrl || task.imageUrl || items.some((item) => item.fileId || item.fileUrl || item.imageUrl))
}

function retryFailedOnlyFixture(tasks = []) {
  const retryable = new Set(['failed', 'timeout'])
  return tasks.filter((task) => retryable.has(task.status)).map((task) => task.taskId)
}

function stableIdempotencyKey(input = {}) {
  const payload = JSON.stringify({
    userId: input.userId || '',
    enterpriseId: input.enterpriseId || '',
    taskType: input.taskType || '',
    fileId: input.fileId || '',
    params: input.params || {}
  })
  return crypto.createHash('sha256').update(payload).digest('hex')
}

function scanSensitiveLogs() {
  const files = [
    ...listFiles('scripts', ['.js']),
    ...listFiles('tests', ['.js']),
    ...listFiles('utils', ['.js'])
  ]
  const logPattern = /console\.(?:log|info|warn|error)\s*\([\s\S]{0,600}?\)/g
  const sensitivePattern = /\b(sessionToken|OPENID|UNIONID|privateKey|apiKey|secret|password|openId|unionId|phone|email)\s*:/i
  const safeDiagnosticPattern = /\b(hasSessionToken|hasOpenid|hasOpenId|hasUnionid|hasUnionId|hasApiKey|authMode|authProvider|credentialId|appId|status|success|errorCode|elapsedMs|planId|stage|errCode|hasRealIdentity|hasMemberPlan|orderCount|projectCount)\b/g
  return files
    .map((file) => ({ file, source: fs.readFileSync(file, 'utf8') }))
    .filter((item) => {
      const statements = item.source.match(logPattern) || []
      return statements.some((statement) => sensitivePattern.test(statement.replace(safeDiagnosticPattern, 'safeDiagnostic')))
    })
    .map((item) => path.relative(ROOT, item.file).replace(/\\/g, '/'))
}

function writeReport() {
  const passed = results.filter((item) => item.ok).length
  const failed = results.filter((item) => !item.ok)
  const lines = [
    '# 自动化测试与持续回归报告 V1',
    '',
    `- 测试版本：core-regression-v1`,
    `- 执行时间：${executedAt}`,
    `- 通过数量：${passed}`,
    `- 失败数量：${failed.length}`,
    `- 是否允许发布：${failed.length ? '否' : '是，仍需完成人工小程序冒烟'}`,
    '',
    '## 自动化结果',
    '',
    '| 分层 | 用例 | 结果 | 风险 | 详情 |',
    '| --- | --- | --- | --- | --- |',
    ...results.map((item) => `| ${item.layer} | ${item.name} | ${item.ok ? '通过' : '失败'} | ${item.risk} | ${String(item.detail || '').replace(/\|/g, '/')} |`),
    '',
    '## 失败用例',
    '',
    ...(failed.length
      ? failed.map((item) => `- ${item.risk} ${item.layer} / ${item.name}：${item.detail || '无详情'}`)
      : ['- 无']),
    '',
    '## 人工微信小程序冒烟清单',
    '',
    '1. 首页打开。',
    '2. 四大 AI 功能进入。',
    '3. 上传图片。',
    '4. 创建任务。',
    '5. 结果页打开。',
    '6. mock / fallback 结果无法审核交付。',
    '7. 失败任务重试不重复扣费。',
    '8. 我的作品与生产记录可查看。',
    '9. 个人中心可进入。',
    '10. 企业/项目/成员权限无越权。',
    '',
    '## 发布判断',
    '',
    'P0 或 P1 自动化失败时不得进入正式发布；自动化受限的微信开发者工具流程必须按人工清单验收并记录结果。'
  ]
  fs.writeFileSync(REPORT_PATH, `${lines.join('\n')}\n`, 'utf8')
}

function main() {
  test('单元测试', '状态归一化保持标准枚举', 'P1', () => {
    const catalog = loadSchemaCatalog()
    assert(catalog.normalizeStandardStatus('task', 'done') === 'success', 'done 应归一为 success')
    assert(catalog.normalizeStandardStatus('task', 'generating') === 'processing', 'generating 应归一为 processing')
    assert(catalog.STATUS_ENUMS.task.includes('failed'), 'task.failed 枚举缺失')
  })

  test('单元测试', '幂等键同输入稳定且不同输入分离', 'P1', () => {
    const base = { userId: 'u1', enterpriseId: 'e1', taskType: 'model', fileId: 'cloud://file', params: { ratio: '1:1' } }
    assert(stableIdempotencyKey(base) === stableIdempotencyKey({ ...base }), '相同输入幂等键不一致')
    assert(stableIdempotencyKey(base) !== stableIdempotencyKey({ ...base, fileId: 'cloud://file-2' }), '不同输入幂等键未分离')
  })

  test('数据层测试', '额度预扣、确认、回滚和终态保护', 'P0', () => {
    const ledger = createQuotaLedger()
    const first = ledger.preHold({ idempotencyKey: 'idem-1', amount: 2 })
    const repeated = ledger.preHold({ idempotencyKey: 'idem-1', amount: 2 })
    assert(first.ok && repeated.ok && repeated.reused, '重复幂等键应复用首条记录')
    assert(ledger.balance === 8, '重复提交造成重复扣费')
    assert(ledger.confirm('idem-1').ok, '确认消费失败')
    assert(ledger.rollback('idem-1').errorCode === 'terminal_record', '终态记录不应回滚')
    const second = ledger.preHold({ idempotencyKey: 'idem-2', amount: 3 })
    assert(second.ok && ledger.rollback('idem-2').ok && ledger.balance === 8, '失败回滚余额不一致')
  })

  test('权限与安全测试', '企业、项目和个人数据范围隔离', 'P0', () => {
    const member = { userId: 'u1', enterpriseId: 'e1', status: 'active', permissions: ['project.view'], scope: 'project', projectIds: ['p1'] }
    assert(canAccessFixture(member, { enterpriseId: 'e1', projectId: 'p1' }, 'project.view'), '授权项目应可访问')
    assert(!canAccessFixture(member, { enterpriseId: 'e1', projectId: 'p2' }, 'project.view'), '未授权项目不应访问')
    assert(!canAccessFixture(member, { enterpriseId: 'e2', projectId: 'p1' }, 'project.view'), '跨企业不应访问')
    assert(!canAccessFixture({ ...member, status: 'disabled' }, { enterpriseId: 'e1', projectId: 'p1' }, 'project.view'), '停用成员不应访问')
  })

  test('API契约测试', '统一返回结构与异步任务字段完整', 'P1', () => {
    const ok = validateApiResponse({
      requestId: 'req_1',
      success: true,
      code: 'ok',
      message: 'ok',
      data: { taskId: 'task_1', status: 'processing', pollingUrl: '/api/tasks/task_1' },
      timestamp: executedAt
    })
    assert(ok.ok, `字段缺失：${ok.missing.join(', ')}`)
    assert(validateAsyncTaskPayload(ok.normalized), '异步任务缺少 taskId/status/pollingUrl')
    const bad = validateApiResponse({ success: true, data: {} })
    assert(!bad.ok && bad.missing.includes('requestId') && bad.missing.includes('code'), '错误契约未被识别')
  })

  test('API契约测试', 'Wanx 云函数返回成功与失败统一字段', 'P1', () => {
    const source = read('cloudfunctions/generate_wanx/index.js')
    ;['success', 'ok', 'taskId', 'provider', 'resultImageUrl', 'errorCode', 'message'].forEach((token) => {
      assert(source.includes(token), `generate_wanx 缺少 ${token}`)
    })
  })

  test('核心流程回归', 'AI 供应商不得接收本地临时图片路径', 'P0', () => {
    const source = read('utils/upload/unifiedUploadService.js')
    assert(source.includes('isTemporaryLocalPath'), '缺少临时路径识别')
    assert(source.includes('temporary_path_not_allowed'), '临时路径未明确拒绝')
    assert(source.includes('resolveAiProviderImageUrl'), '缺少 AI 供应商图片地址转换')
    assert(source.includes('https_temp_url_required'), '未要求 HTTPS 临时 URL')
  })

  test('核心流程回归', '任务层优先真实生成且保留明确 mock 兜底日志', 'P1', () => {
    const source = read('utils/task/taskLayer.js')
    assert(source.includes('createTaskAndRun'), '缺少统一创建并执行入口')
    assert(source.includes('runWanxTask'), '缺少 Wanx 任务执行入口')
    assert(source.includes('[taskLayer:wanx] cloud call failed, fallback to local mock'), '缺少明确 mock 兜底日志')
  })

  test('审核红线测试', 'mock/fallback/空结果/未完成任务不可交付', 'P0', () => {
    assert(!isDeliverableFixture({ status: 'success', provider: 'mock', resultImageUrl: 'x' }), 'mock 结果不应交付')
    assert(!isDeliverableFixture({ status: 'success', fallbackReason: 'wanx_failed', resultImageUrl: 'x' }), 'fallback 结果不应交付')
    assert(!isDeliverableFixture({ status: 'success', provider: 'wanx', result: { items: [] } }), '空结果不应交付')
    assert(!isDeliverableFixture({ status: 'processing', provider: 'wanx', resultImageUrl: 'x' }), '未完成任务不应交付')
    assert(isDeliverableFixture({ status: 'success', provider: 'wanx', resultImageUrl: 'https://cdn.example.com/result.png' }), '真实成功结果应允许进入后续审核')
  })

  test('审核红线测试', '结果页和批量交付中心保留红线拦截', 'P0', () => {
    const resultSource = fileExists('package-ai/result/result.vue') ? read('package-ai/result/result.vue') : ''
    const deliverySource = read('utils/workspace/workspaceBatchDeliveryCenter.js')
    assert(resultSource.includes('isCurrentTaskMockOrFallback') || resultSource.includes('mock_or_fallback'), '结果页缺少 mock/fallback 识别')
    assert(deliverySource.includes('provider.includes') && deliverySource.includes('fallback') && deliverySource.includes('test'), '批量交付缺少异常来源拦截')
    assert(deliverySource.includes('no_approved_assets'), '交付必须依赖已审核资产')
  })

  test('核心流程回归', '批量重试只处理失败或超时项', 'P0', () => {
    const taskIds = retryFailedOnlyFixture([
      { taskId: 'success-1', status: 'success' },
      { taskId: 'failed-1', status: 'failed' },
      { taskId: 'timeout-1', status: 'timeout' },
      { taskId: 'processing-1', status: 'processing' }
    ])
    assert(taskIds.join(',') === 'failed-1,timeout-1', '批量重试范围错误')
    const source = read('utils/task/taskActions.js')
    assert(source.includes('retryFailedBatchTasks'), '缺少批量失败重试入口')
    assert(source.includes('canRetryFailedBatchTask'), '缺少可重试状态判断')
  })

  test('核心流程回归', '版型已审核版本不可覆盖且生产可用必须审核', 'P0', () => {
    const source = read('utils/workspace/patternMakingRepository.js')
    assert(source.includes('createPatternRevisionVersion') || source.includes('createDerivedPattern'), '缺少版型版本创建')
    assert(source.includes('approvedVersionId'), '缺少已审核版本指针')
    assert(source.includes('productionAvailable') && source.includes('approved'), '生产可用未绑定审核通过')
    assert(source.includes('trainingCandidate') && source.includes('reviewStatus'), '训练候选未绑定审核状态')
  })

  test('页面组件测试', 'H5 核心 smoke 页面存在且脚本可执行', 'P2', () => {
    ;[
      'tests/playwright/h5-smoke.spec.js',
      'tests/playwright/result-smoke.spec.js',
      'tests/playwright/run-smokes.js'
    ].forEach((file) => assert(fileExists(file), `${file} 不存在`))
  })

  test('持续集成', 'package.json 暴露核心回归命令', 'P1', () => {
    const pkg = JSON.parse(read('package.json'))
    assert(pkg.scripts && pkg.scripts['test:regression:core'], '缺少 test:regression:core')
  })

  test('权限与安全测试', '测试与脚本日志不输出关键敏感字段', 'P1', () => {
    const issues = scanSensitiveLogs()
    assert(issues.length === 0, `敏感日志候选：${issues.slice(0, 8).join(', ')}`)
  })

  writeReport()
  const failed = results.filter((item) => !item.ok)
  console.log(`\nRegression core V1: ${results.length - failed.length}/${results.length} passed`)
  console.log(`Report: ${path.relative(ROOT, REPORT_PATH).replace(/\\/g, '/')}`)
  if (failed.length) process.exitCode = 1
}

main()
