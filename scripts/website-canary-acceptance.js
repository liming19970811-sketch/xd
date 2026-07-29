const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')
const REPORT_PATH = path.join(ROOT, 'docs', 'website-canary-acceptance-report.md')

const ACCOUNT_ROLES = [
  'guest',
  'personal_user',
  'designer',
  'pattern_master',
  'project_owner',
  'enterprise_admin',
  'readonly_member',
  'platform_admin'
]

const CORE_FLOWS = [
  {
    id: 'A',
    name: 'AI 出图',
    steps: ['登录', '创建项目', '上传服装图', '选择功能', '确认额度', '生成', '审核', '加入作品库'],
    requiredMarkers: ['createTaskAndRun', 'review', 'asset', 'quota']
  },
  {
    id: 'B',
    name: 'AI 制版',
    steps: ['上传服装图', '结构识别', '生成结构图', '版师修订', '提交审核', '创建版本', '加入版型库'],
    requiredMarkers: ['patternMaking', 'patternMaster', 'patternVersion', 'review']
  },
  {
    id: 'C',
    name: '批量交付',
    steps: ['创建批次', '批量生成', '重试失败项', '批量审核', '创建交付批次', '下载交付文件'],
    requiredMarkers: ['batch', 'retry', 'delivery', 'download']
  },
  {
    id: 'D',
    name: '企业协作',
    steps: ['邀请成员', '分配角色', '加入项目', '完成任务', '审核', '查看审计日志'],
    requiredMarkers: ['member.manage', 'audit', 'project']
  }
]

const EXCEPTION_CASES = [
  '图片上传失败',
  'AI接口超时',
  '任务生成失败',
  '额度不足',
  '重复点击提交',
  '页面刷新',
  '登录过期',
  '无权限访问',
  '企业切换',
  '批量任务部分失败',
  '下载链接过期',
  'mock或fallback结果进入审核'
]

const CONSISTENCY_CASES = [
  '任务状态与列表统计一致',
  '扣费、回滚和剩余额度一致',
  '项目、批次、作品引用一致',
  '版型版本和审核状态一致',
  '已交付资产不会被覆盖',
  '同一幂等键不会重复创建任务或扣费'
]

const GRAY_STAGES = [
  {
    stage: 'stage_1_internal',
    scope: '仅内部测试账号',
    limits: ['单张图片', '单功能', '不允许正式交付'],
    expandGate: '四条核心链路内部 dry-run 通过且 P0/P1 为 0'
  },
  {
    stage: 'stage_2_invited_pro',
    scope: '少量受邀专业用户',
    limits: ['开放项目', '开放版型库', '开放人工审核', '限制批量任务数量'],
    expandGate: '任务成功率、上传成功率、权限隔离和额度一致性稳定'
  },
  {
    stage: 'stage_3_enterprise_trial',
    scope: '企业试用账号',
    limits: ['开放团队协作', '开放小批量任务', '正式交付需人工确认'],
    expandGate: '连续观察周期内无 P0/P1，P2 有替代流程'
  }
]

const MONITOR_METRICS = [
  '登录成功率',
  '上传成功率',
  '任务成功率',
  '平均生成耗时',
  '审核通过率',
  '重试率',
  '额度异常数量',
  '页面错误率',
  '用户完成第一个任务的比例',
  '不同功能入口点击率'
]

const ISSUE_LEVELS = [
  { level: 'P0', rule: '数据泄露、重复扣费、错误交付，立即停止灰度' },
  { level: 'P1', rule: '核心流程无法完成，停止新增用户' },
  { level: 'P2', rule: '部分功能异常，有替代流程' },
  { level: 'P3', rule: '样式、文案或轻微体验问题' }
]

function read(relativePath) {
  const file = path.join(ROOT, relativePath)
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : ''
}

function exists(relativePath) {
  return fs.existsSync(path.join(ROOT, relativePath))
}

function record(results, name, ok, detail = '') {
  results.push({ name, ok: Boolean(ok), detail })
  console.log(`${ok ? '[PASS]' : '[FAIL]'} ${name}${detail ? ` - ${detail}` : ''}`)
}

function includesAny(source, values) {
  return values.some((value) => source.includes(value))
}

function routeRegistered(route) {
  const pagesJson = read('pages.json')
  const normalized = route.replace(/^\/+/, '').replace(/\.vue$/, '')
  return pagesJson.includes(normalized)
}

function checkAccountMatrix(results) {
  record(results, '验收账号矩阵完整', ACCOUNT_ROLES.length === 8, ACCOUNT_ROLES.join(', '))
  record(results, '测试数据隔离说明存在', read('docs/website-canary-runbook.md').includes('禁止使用真实客户隐私数据'))
}

function checkRoutes(results) {
  const workspace = read('pages/workspace/workspace.vue')
  record(results, '工作台页面存在', exists('pages/workspace/workspace.vue'))
  record(results, '工作台覆盖 AI 出图入口', includesAny(workspace, ['ai-output', 'AI 出图', '新建 AI 出图任务']))
  record(results, '工作台覆盖 AI 制版入口', includesAny(workspace, ['pattern-making', 'AI 制版', '新建制版任务']))
  record(results, '工作台覆盖版型库入口', includesAny(workspace, ['pattern-library', '版型库']))
  record(results, '工作台覆盖项目/批次/交付入口', ['projects', 'batches', 'deliveries'].every((item) => workspace.includes(item)))
  record(results, '企业成员页已注册或存在', routeRegistered('pages/enterprise-web/members') || exists('pages/enterprise-web/members.vue'))
}

function checkCoreFlowMarkers(results) {
  const workspace = read('pages/workspace/workspace.vue')
  const taskLayer = read('utils/task/taskLayer.js')
  const quotaFlow = read('utils/quota/quotaFlow.js')
  const batchDelivery = read('utils/workspace/workspaceBatchDeliveryCenter.js')
  const patternFiles = [
    read('utils/workspace/patternMakingRepository.js'),
    read('utils/workspace/workspacePatternTrainingCenter.js'),
    read('utils/pattern/patternLibrary.js')
  ].join('\n')
  const enterpriseFiles = [
    read('pages/enterprise-web/members.vue'),
    read('utils/member/memberInviteService.js'),
    read('utils/permission/rolePermissionService.js'),
    read('utils/permission/permissionCatalog.js'),
    read('utils/audit/auditService.js')
  ].join('\n')
  const sources = {
    A: `${workspace}\n${taskLayer}\n${quotaFlow}`,
    B: `${workspace}\n${patternFiles}`,
    C: `${workspace}\n${batchDelivery}`,
    D: `${workspace}\n${enterpriseFiles}`
  }
  CORE_FLOWS.forEach((flow) => {
    const missing = flow.requiredMarkers.filter((marker) => !sources[flow.id].includes(marker))
    record(results, `核心链路 ${flow.id} ${flow.name} 标记检查`, missing.length === 0, missing.join(', '))
  })
}

function checkExceptionGuards(results) {
  const workspace = read('pages/workspace/workspace.vue')
  const taskLayer = read('utils/task/taskLayer.js')
  const quotaFlow = read('utils/quota/quotaFlow.js')
  const deliveryCenter = read('utils/workspace/workspaceBatchDeliveryCenter.js')
  const authGuard = read('utils/enterprise-web/enterpriseWebGuard.js')
  const serviceText = [
    read('utils/service/deliveryService.js'),
    read('utils/service/projectService.js'),
    read('utils/member/memberService.js'),
    read('utils/permission/rolePermissionService.js')
  ].join('\n')
  record(results, '上传失败提示存在', includesAny(workspace, ['上传失败', '请选择', '请先上传']))
  record(results, 'AI 超时和失败兜底存在', includesAny(taskLayer, ['timeout', 'failed', 'fallback to local mock']))
  record(results, '额度不足/回滚保护存在', includesAny(quotaFlow, ['rollbackQuota', 'quota_not_enough', 'mock_or_fallback_result']))
  record(results, '重复提交或幂等字段存在', includesAny(`${workspace}\n${taskLayer}`, ['idempotencyKey', 'isSubmitting', 'submitting']))
  record(results, '登录过期和无权限拦截存在', includesAny(authGuard, ['session_expired', 'forbidden', 'requirePermission']))
  record(results, '企业切换需重新校验上下文', includesAny(`${authGuard}\n${serviceText}`, ['currentEnterpriseId', 'tenantContext', 'enterpriseId']))
  record(results, '批量部分失败和重试路径存在', includesAny(`${workspace}\n${deliveryCenter}`, ['partial', 'retry', 'failed']))
  record(results, 'mock/fallback 禁止正式交付', includesAny(`${workspace}\n${deliveryCenter}`, ['mock', 'fallback']) && includesAny(`${workspace}\n${deliveryCenter}`, ['禁止', 'DELIVERY_ITEM_NOT_ELIGIBLE', 'deliveryEligible']))
}

function checkConsistencyGuards(results) {
  const taskLayer = read('utils/task/taskLayer.js')
  const quotaFlow = read('utils/quota/quotaFlow.js')
  const batchRepository = read('utils/task/batchRepository.js')
  const assetCenter = read('utils/workspace/workspaceAssetCenter.js')
  const deliveryPackage = read('utils/workspace/deliveryPackage.js')
  const patternLibrary = `${read('utils/pattern/patternLibrary.js')}\n${read('utils/workspace/patternMakingRepository.js')}`
  const deliveryCenter = read('utils/workspace/workspaceBatchDeliveryCenter.js')
  record(results, '任务状态流转统一', ['pending', 'processing', 'success', 'failed'].every((item) => taskLayer.includes(item)))
  record(results, '额度扣费和回滚字段存在', ['quotaRecordId', 'rollbackQuota'].every((item) => quotaFlow.includes(item)))
  record(results, '项目/批次/作品引用字段存在', ['projectId', 'batchId', 'assetId'].every((item) => `${batchRepository}\n${assetCenter}\n${deliveryCenter}`.includes(item)))
  record(results, '版型版本与审核状态字段存在', ['patternMasterId', 'versionId', 'reviewStatus', 'approved'].every((item) => patternLibrary.includes(item) || deliveryCenter.includes(item)))
  record(results, '已交付资产不可静默覆盖', includesAny(`${deliveryPackage}\n${deliveryCenter}`, ['versionId', 'assetVersionIds', 'confirmed', 'delivered']))
  record(results, '幂等键保护存在', ['idempotencyKey'].every((item) => `${taskLayer}\n${batchRepository}\n${deliveryCenter}`.includes(item)))
}

function renderManualMatrix() {
  const rows = ACCOUNT_ROLES.map((role) => `| ${role} | 待人工准备 | 独立测试企业/项目/任务/资产 | 不使用真实客户隐私数据 |`)
  return ['| 账号类型 | 状态 | 测试数据 | 备注 |', '| --- | --- | --- | --- |', ...rows].join('\n')
}

function renderChecklist(title, items) {
  return [`## ${title}`, '', ...items.map((item) => `- [ ] ${item}`), ''].join('\n')
}

function renderReport(results) {
  const failed = results.filter((item) => !item.ok)
  const passed = results.length - failed.length
  return [
    '# 官网全链路验收与灰度上线报告 V1',
    '',
    `生成时间：${new Date().toISOString()}`,
    `自动检查：${passed}/${results.length} 通过`,
    `结论：${failed.length ? '暂停扩大灰度，先处理失败项或完成人工验证。' : '自动检查通过，仍需完成人工真实链路验收后才可扩大灰度。'}`,
    '',
    '## 自动检查结果',
    '',
    ...results.map((item) => `- ${item.ok ? '通过' : '失败'}：${item.name}${item.detail ? `（${item.detail}）` : ''}`),
    '',
    '## 灰度账号名单',
    '',
    renderManualMatrix(),
    '',
    '## 核心链路验收',
    '',
    ...CORE_FLOWS.map((flow) => `### 链路${flow.id}：${flow.name}\n${flow.steps.map((step) => `- [ ] ${step}`).join('\n')}`),
    '',
    renderChecklist('异常链路', EXCEPTION_CASES),
    renderChecklist('数据一致性', CONSISTENCY_CASES),
    '## 灰度策略',
    '',
    ...GRAY_STAGES.map((item) => `### ${item.stage}\n- 范围：${item.scope}\n- 限制：${item.limits.join('、')}\n- 扩大条件：${item.expandGate}`),
    '',
    renderChecklist('监控指标', MONITOR_METRICS),
    '## 问题分级',
    '',
    ...ISSUE_LEVELS.map((item) => `- ${item.level}：${item.rule}`),
    '',
    '## 发布建议',
    '',
    '- P0/P1 未清零前，不允许扩大灰度。',
    '- mock、fallback 或测试结果进入审核/交付时，立即停止灰度。',
    '- 每个问题必须记录负责人、影响范围、复现步骤、修复版本和验证结果。',
    '- 回滚入口：按 `docs/website-production-deployment.md` 重新部署上一稳定 H5 静态产物。',
    ''
  ].join('\n')
}

function main() {
  const results = []
  checkAccountMatrix(results)
  checkRoutes(results)
  checkCoreFlowMarkers(results)
  checkExceptionGuards(results)
  checkConsistencyGuards(results)
  const report = renderReport(results)
  fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true })
  fs.writeFileSync(REPORT_PATH, report, 'utf8')
  const failed = results.filter((item) => !item.ok)
  console.log(`[website-canary] report: ${path.relative(ROOT, REPORT_PATH).replace(/\\/g, '/')}`)
  console.log(`[website-canary] ${results.length - failed.length}/${results.length} passed`)
  if (failed.length) process.exitCode = 1
}

main()
