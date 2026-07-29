const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')
const sourcePath = path.join(root, 'utils', 'admin', 'businessMetricsCenter.js')
const source = fs.readFileSync(sourcePath, 'utf8')

let allowPlatform = true
let allowAnalytics = true
let currentEnterpriseId = 'enterprise_a'

const tasks = [
  {
    taskId: 'task_real_1',
    enterpriseId: 'enterprise_a',
    projectId: 'project_a',
    userId: 'user_a',
    type: 'model_replace',
    provider: 'wanx',
    status: 'success',
    result: { items: [{ url: 'cloud://result-a' }] },
    reviewStatus: 'approved',
    quotaCost: 8,
    createdAt: '2026-07-20T00:00:00.000Z',
    updatedAt: '2026-07-20T01:00:00.000Z'
  },
  {
    taskId: 'task_real_retry',
    enterpriseId: 'enterprise_a',
    projectId: 'project_a',
    userId: 'user_a',
    type: 'model_replace',
    provider: 'wanx',
    status: 'failed',
    retryCount: 2,
    errorCode: 'provider_timeout',
    quotaStatus: 'rollback_failed',
    createdAt: '2026-07-20T02:00:00.000Z'
  },
  {
    taskId: 'task_empty',
    enterpriseId: 'enterprise_a',
    projectId: 'project_a',
    userId: 'user_b',
    type: 'color_replace',
    provider: 'wanx',
    status: 'success',
    result: { items: [] },
    createdAt: '2026-07-20T03:00:00.000Z'
  },
  {
    taskId: 'task_mock',
    enterpriseId: 'enterprise_a',
    projectId: 'project_a',
    userId: 'user_a',
    type: 'model_replace',
    provider: 'mock',
    status: 'success',
    mock: true,
    createdAt: '2026-07-20T04:00:00.000Z'
  },
  {
    taskId: 'task_other_tenant',
    enterpriseId: 'enterprise_b',
    projectId: 'project_b',
    userId: 'user_c',
    type: 'scene_replace',
    provider: 'wanx',
    status: 'success',
    resultImageUrl: 'cloud://result-b',
    createdAt: '2026-07-20T05:00:00.000Z'
  }
]

const costRecords = [
  { costRecordId: 'cost_1', taskId: 'task_real_1', enterpriseId: 'enterprise_a', providerId: 'wanx', functionType: 'model_replace', actualCost: 1.2, status: 'success', outputCount: 1, createdAt: '2026-07-20T00:00:00.000Z' },
  { costRecordId: 'cost_retry', taskId: 'task_real_retry', enterpriseId: 'enterprise_a', providerId: 'wanx', functionType: 'model_replace', actualCost: 4.5, status: 'timeout', outputCount: 0, retryCount: 2, createdAt: '2026-07-20T02:00:00.000Z' },
  { costRecordId: 'cost_other', taskId: 'task_other_tenant', enterpriseId: 'enterprise_b', providerId: 'wanx', functionType: 'scene_replace', actualCost: 2, status: 'success', outputCount: 1, createdAt: '2026-07-20T05:00:00.000Z' }
]

const projects = [
  { projectId: 'project_a', enterpriseId: 'enterprise_a', projectName: 'A 项目', status: 'active', createdAt: '2026-07-18T00:00:00.000Z', updatedAt: '2026-07-21T00:00:00.000Z' },
  { projectId: 'project_b', enterpriseId: 'enterprise_b', projectName: 'B 项目', status: 'active', createdAt: '2026-07-18T00:00:00.000Z', updatedAt: '2026-07-21T00:00:00.000Z' }
]

const deliveries = [
  { deliveryId: 'delivery_a', enterpriseId: 'enterprise_a', projectId: 'project_a', assetIds: ['asset_a'], deliveredAt: '2026-07-22T00:00:00.000Z', createdAt: '2026-07-22T00:00:00.000Z' }
]

function loadModule() {
  const transformed = source
    .replace(/^import .+$/gm, '')
    .replace(/export const /g, 'const ')
    .replace(/export function /g, 'function ')
    .replace(/export default /g, 'const __default = ')

  const factory = new Function(
    'requirePlatformAdmin',
    'getCostRecords',
    'requirePermission',
    'getCurrentEnterpriseId',
    'listTasks',
    'getLegacyProjects',
    'getEnterpriseProjects',
    'listWorkspaceBatches',
    'listWorkspaceDeliveries',
    'loadPatternTrainingCenter',
    `${transformed}
return {
  BUSINESS_VALUE_SEGMENTS,
  BUSINESS_METRIC_PERIODS,
  loadBusinessMetricsCenter,
  loadProjectEfficiencyCenter
}`
  )

  return factory(
    () => ({ allowed: allowPlatform, reason: allowPlatform ? '' : 'platform_admin_required' }),
    () => costRecords,
    () => ({ allowed: allowAnalytics, reason: allowAnalytics ? '' : 'analytics_permission_required' }),
    () => currentEnterpriseId,
    () => tasks,
    () => [],
    () => projects,
    () => [],
    () => deliveries,
    () => ({ samples: [{ sampleId: 'sample_a', eligible: true }, { sampleId: 'sample_b', authorizationStatus: 'not_authorized' }] })
  )
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function run() {
  const mod = loadModule()

  allowPlatform = false
  const denied = mod.loadBusinessMetricsCenter({ period: '30d' })
  assert(!denied.canAccess && denied.reason === 'platform_admin_required', 'platform admin guard should deny')

  allowPlatform = true
  const platform = mod.loadBusinessMetricsCenter({ period: '30d' })
  assert(platform.canAccess, 'platform center should be accessible')
  assert(platform.summary.taskCount === 4, 'platform should exclude mock task but include real tenants')
  assert(!platform.featureMetrics.some((item) => item.functionType === 'mock'), 'mock feature should not appear')
  assert(platform.anomalies.some((item) => item.type === 'empty_result'), 'empty result anomaly should be detected')
  assert(platform.anomalies.some((item) => item.type === 'quota_rollback_abnormal'), 'quota rollback anomaly should be detected')

  allowAnalytics = true
  currentEnterpriseId = 'enterprise_a'
  const enterprise = mod.loadProjectEfficiencyCenter({ period: '30d' })
  assert(enterprise.canAccess, 'enterprise center should be accessible with analytics.view')
  assert(enterprise.summary.taskCount === 3, 'enterprise center should only include current enterprise real tasks')
  assert(enterprise.projectMetrics.length === 1 && enterprise.projectMetrics[0].projectId === 'project_a', 'project metrics should be tenant isolated')
  assert(enterprise.projectMetrics[0].timeComparisonLabel.includes('暂无真实传统制作基准'), 'missing traditional baseline must not create fake savings')

  allowAnalytics = false
  const forbidden = mod.loadProjectEfficiencyCenter({ period: '30d' })
  assert(!forbidden.canAccess, 'enterprise analytics guard should deny')

  const pagesJson = fs.readFileSync(path.join(root, 'pages.json'), 'utf8')
  assert(pagesJson.includes('"root": "pages/admin-business-metrics"'), 'admin business metrics route should be registered')
  assert(pagesJson.includes('"path": "project-efficiency"'), 'project efficiency route should be registered')

  console.log('business metrics smoke passed')
}

run()
