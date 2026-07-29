import { requirePlatformAdmin } from './platformAdminRepository.js'

export const V1_READINESS_STATUSES = Object.freeze([
  { key: 'not_started', label: '未开始' },
  { key: 'in_progress', label: '开发中' },
  { key: 'testable', label: '可测试' },
  { key: 'verified', label: '已验证' },
  { key: 'blocked', label: '被阻塞' },
  { key: 'completed', label: '已完成' }
])

export const V1_COMPLETION_REQUIREMENTS = Object.freeze([
  { key: 'pageEntry', label: '真实页面入口' },
  { key: 'backendInterface', label: '真实后端接口' },
  { key: 'permissionCheck', label: '权限校验' },
  { key: 'taskStatus', label: '任务状态' },
  { key: 'quotaHandling', label: '额度处理' },
  { key: 'errorMessage', label: '错误提示' },
  { key: 'dataPersistence', label: '数据保存' },
  { key: 'resultView', label: '结果查看' },
  { key: 'regressionTest', label: '最小回归测试' }
])

export const V1_EXECUTION_ORDER = Object.freeze([
  { order: 1, title: '登录、权限、上传和任务主链' },
  { order: 2, title: '上下装分开换衣' },
  { order: 3, title: '其他核心 AI 出图功能' },
  { order: 4, title: 'AI 制版与版型版本' },
  { order: 5, title: '项目、作品和审核交付' },
  { order: 6, title: '额度与错误保护' },
  { order: 7, title: '网站导航与工作台' },
  { order: 8, title: '全链路验收' },
  { order: 9, title: '灰度上线' }
])

export const V1_RELEASE_BLOCKERS = Object.freeze([
  '重复扣费',
  '跨用户或跨企业越权',
  'mock/fallback 可以交付',
  '任务状态无法结束',
  '图片临时地址失效',
  '已审核版本可被覆盖',
  '核心入口无法快速找到',
  '工作台只有 UI 没有真实功能'
])

export const V1_DEFERRED_FEATURES = Object.freeze([
  { key: 'factory_matching', title: '自动工厂匹配', reason: '与 V1 服装 AI 生成闭环不直接相关，避免拉长交付线。' },
  { key: 'online_production_order', title: '在线生产下单', reason: '涉及履约、合同和供应链，暂缓到核心生成闭环稳定后。' },
  { key: 'complex_finance', title: '复杂财务系统', reason: 'V1 只保留额度与记录，不进入复杂财务。' },
  { key: 'full_auto_training', title: '全自动模型训练', reason: '训练需审核、授权和灰度，V1 不做全自动上线。' },
  { key: 'large_api_platform', title: '大规模企业 API', reason: '保留规划，不制作空入口，核心任务稳定后再扩展。' },
  { key: 'heavy_ops_dashboard', title: '过度复杂的运营看板', reason: '保留必要 readiness、错误和日志视图，其余暂缓。' },
  { key: 'non_core_extensions', title: '与服装 AI 核心无关的扩展功能', reason: '不进入 V1，避免功能无限堆积。' }
])

const CORE_ITEMS = Object.freeze([
  {
    featureId: 'auth_permission_upload_task_chain',
    area: '基础系统',
    title: '登录、权限、上传和任务主链',
    executionOrder: 1,
    owner: '核心工程',
    status: 'testable',
    files: [
      'pages/enterprise-web/login.vue',
      'pages/enterprise-web/miniapp-login.vue',
      'utils/auth/authSessionService.js',
      'utils/upload/unifiedUploadService.js',
      'utils/task/taskLayer.js'
    ],
    tests: ['enterprise auth smoke', 'miniapp login smoke', 'task/result smoke'],
    evidence: {
      pageEntry: true,
      backendInterface: true,
      permissionCheck: true,
      taskStatus: true,
      quotaHandling: false,
      errorMessage: true,
      dataPersistence: true,
      resultView: true,
      regressionTest: true
    },
    blockers: ['额度预扣、确认、回滚需要与真实生成链路完成最终联调。']
  },
  {
    featureId: 'garment_replace_top_bottom',
    area: 'AI出图',
    title: '上下装分开换衣',
    executionOrder: 2,
    owner: 'AI 出图',
    status: 'in_progress',
    files: ['utils/task/garmentReplaceContract.js', 'utils/task/taskLayer.js', 'pages/workspace/workspace.vue'],
    tests: ['provider contract smoke'],
    evidence: {
      pageEntry: true,
      backendInterface: false,
      permissionCheck: true,
      taskStatus: true,
      quotaHandling: false,
      errorMessage: true,
      dataPersistence: true,
      resultView: true,
      regressionTest: false
    },
    blockers: ['真实 provider 能力与参数契约尚未冻结。']
  },
  {
    featureId: 'core_ai_output_tools',
    area: 'AI出图',
    title: '换模特、换颜色、换场景、改款、换面料、换图案',
    executionOrder: 3,
    owner: 'AI 出图',
    status: 'in_progress',
    files: ['pages/workspace/workspace.vue', 'utils/task/taskLayer.js', 'cloudfunctions/generate_wanx/index.js'],
    tests: ['business metrics smoke', 'provider contract smoke'],
    evidence: {
      pageEntry: true,
      backendInterface: true,
      permissionCheck: true,
      taskStatus: true,
      quotaHandling: false,
      errorMessage: true,
      dataPersistence: true,
      resultView: true,
      regressionTest: false
    },
    blockers: ['各能力需要逐项确认真实 provider 支持范围，mock/fallback 不得进入正式交付。']
  },
  {
    featureId: 'pattern_making_core',
    area: 'AI制版',
    title: '结构识别、技术结构图、AI 制版初稿、版师修订、版型版本管理',
    executionOrder: 4,
    owner: 'AI 制版',
    status: 'blocked',
    files: [
      'pages/workspace/pattern-making.vue',
      'utils/pattern/patternLibraryRepository.js',
      'utils/workspace/workspacePatternTrainingCenter.js'
    ],
    tests: ['pattern library smoke', 'training/evaluation manual checks'],
    evidence: {
      pageEntry: true,
      backendInterface: false,
      permissionCheck: true,
      taskStatus: true,
      quotaHandling: false,
      errorMessage: true,
      dataPersistence: true,
      resultView: true,
      regressionTest: false
    },
    blockers: ['制版真实后端接口、额度、审核版本不可覆盖规则仍需端到端验收。']
  },
  {
    featureId: 'business_project_asset_delivery',
    area: '业务管理',
    title: '项目中心、批量任务、作品资产、审核与交付、版型库',
    executionOrder: 5,
    owner: '业务工作台',
    status: 'testable',
    files: [
      'pages/workspace/workspace.vue',
      'utils/workspace/workspaceBatchDeliveryCenter.js',
      'utils/asset/assetRepository.js',
      'utils/pattern/patternLibraryRepository.js'
    ],
    tests: ['batch delivery smoke', 'result approval smoke', 'project smoke'],
    evidence: {
      pageEntry: true,
      backendInterface: true,
      permissionCheck: true,
      taskStatus: true,
      quotaHandling: false,
      errorMessage: true,
      dataPersistence: true,
      resultView: true,
      regressionTest: true
    },
    blockers: ['交付红线和额度回滚仍需全链路回归锁定。']
  },
  {
    featureId: 'quota_error_observability',
    area: '基础系统',
    title: '额度与记录、错误与日志',
    executionOrder: 6,
    owner: '平台稳定性',
    status: 'in_progress',
    files: [
      'utils/quota/quotaFlow.js',
      'utils/admin/errorAlertCenter.js',
      'utils/admin/businessMetricsCenter.js'
    ],
    tests: ['observability smoke', 'business metrics smoke'],
    evidence: {
      pageEntry: true,
      backendInterface: true,
      permissionCheck: true,
      taskStatus: true,
      quotaHandling: false,
      errorMessage: true,
      dataPersistence: true,
      resultView: true,
      regressionTest: true
    },
    blockers: ['真实扣费幂等、终态禁止重复回滚需要作为上线红线验证。']
  },
  {
    featureId: 'workspace_navigation_settings_notifications',
    area: '基础系统',
    title: '网站导航与工作台、设置、通知',
    executionOrder: 7,
    owner: '工作台体验',
    status: 'testable',
    files: ['pages/workspace/workspace.vue', 'pages/enterprise-web/layout.vue', 'utils/notification'],
    tests: ['Vue template check', 'H5 navigation manual smoke'],
    evidence: {
      pageEntry: true,
      backendInterface: true,
      permissionCheck: true,
      taskStatus: false,
      quotaHandling: false,
      errorMessage: true,
      dataPersistence: true,
      resultView: true,
      regressionTest: false
    },
    blockers: ['核心入口两次点击内到达需要 H5 人工验收。']
  },
  {
    featureId: 'full_chain_acceptance_canary',
    area: '发布验收',
    title: '全链路验收与灰度上线',
    executionOrder: 8,
    owner: '发布负责人',
    status: 'not_started',
    files: ['docs', 'scripts'],
    tests: ['H5 production build', 'manual canary checklist'],
    evidence: {
      pageEntry: false,
      backendInterface: false,
      permissionCheck: false,
      taskStatus: false,
      quotaHandling: false,
      errorMessage: false,
      dataPersistence: false,
      resultView: false,
      regressionTest: false
    },
    blockers: ['P0/P1 红线清零前不得启动正式灰度。']
  }
])

function nowIso() {
  return new Date().toISOString()
}

function getStatusLabel(status = '') {
  const found = V1_READINESS_STATUSES.find((item) => item.key === status)
  return found ? found.label : '开发中'
}

function completionRate(evidence = {}) {
  const total = V1_COMPLETION_REQUIREMENTS.length
  const done = V1_COMPLETION_REQUIREMENTS.filter((item) => evidence[item.key]).length
  return total ? Math.round((done / total) * 100) : 0
}

function missingRequirements(evidence = {}) {
  return V1_COMPLETION_REQUIREMENTS.filter((item) => !evidence[item.key])
}

function canMarkCompleted(item = {}) {
  return missingRequirements(item.evidence || {}).length === 0 && ['verified', 'completed'].includes(item.status)
}

function normalizeItem(item = {}) {
  const missing = missingRequirements(item.evidence || {})
  return {
    ...item,
    statusLabel: getStatusLabel(item.status),
    completionRate: completionRate(item.evidence || {}),
    missingRequirements: missing,
    completedAllowed: canMarkCompleted(item),
    hasReleaseBlocker: missing.length > 0 || item.status === 'blocked' || item.blockers.length > 0
  }
}

function buildAreaSummary(items = []) {
  const map = {}
  items.forEach((item) => {
    if (!map[item.area]) {
      map[item.area] = { area: item.area, total: 0, completed: 0, blocked: 0, averageCompletion: 0 }
    }
    map[item.area].total += 1
    if (item.completedAllowed) map[item.area].completed += 1
    if (item.status === 'blocked') map[item.area].blocked += 1
    map[item.area].averageCompletion += item.completionRate
  })
  return Object.values(map).map((item) => ({
    ...item,
    averageCompletion: item.total ? Math.round(item.averageCompletion / item.total) : 0
  }))
}

function buildReleaseGate(items = []) {
  const unresolved = items.filter((item) => item.hasReleaseBlocker)
  return {
    canRelease: unresolved.length === 0,
    unresolvedCount: unresolved.length,
    message: unresolved.length ? 'V1 核心闭环尚未冻结，禁止正式上线。' : 'V1 核心范围已满足上线检查。'
  }
}

export function loadV1ReadinessCenter() {
  const guard = requirePlatformAdmin()
  if (!guard.allowed) {
    return {
      canAccess: false,
      reason: guard.reason || 'platform_admin_required',
      items: [],
      areaSummary: [],
      completionRequirements: V1_COMPLETION_REQUIREMENTS,
      executionOrder: V1_EXECUTION_ORDER,
      releaseBlockers: V1_RELEASE_BLOCKERS,
      deferredFeatures: V1_DEFERRED_FEATURES,
      releaseGate: buildReleaseGate([]),
      updatedAt: nowIso()
    }
  }
  const items = CORE_ITEMS.map(normalizeItem).sort((left, right) => left.executionOrder - right.executionOrder)
  return {
    canAccess: true,
    reason: '',
    items,
    areaSummary: buildAreaSummary(items),
    completionRequirements: V1_COMPLETION_REQUIREMENTS,
    executionOrder: V1_EXECUTION_ORDER,
    releaseBlockers: V1_RELEASE_BLOCKERS,
    deferredFeatures: V1_DEFERRED_FEATURES,
    releaseGate: buildReleaseGate(items),
    summary: {
      total: items.length,
      completed: items.filter((item) => item.completedAllowed).length,
      testable: items.filter((item) => item.status === 'testable').length,
      blocked: items.filter((item) => item.status === 'blocked').length,
      averageCompletion: items.length ? Math.round(items.reduce((sum, item) => sum + item.completionRate, 0) / items.length) : 0
    },
    updatedAt: nowIso()
  }
}
