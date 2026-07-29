const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')
const source = fs.readFileSync(path.join(root, 'utils', 'admin', 'productRoadmapCenter.js'), 'utf8')
const storage = {}
let allowPlatform = true

global.uni = {
  getStorageSync(key) {
    return storage[key]
  },
  setStorageSync(key, value) {
    storage[key] = value
  }
}

storage.diebians_product_feedback_v1 = [
  {
    feedbackId: 'feedback_1',
    type: 'generation_error',
    severity: 'high',
    description: 'AI出图生成失败，需要优化换模特稳定性',
    createdAt: '2026-07-20T00:00:00.000Z'
  }
]

storage.diebians_support_tickets_v1 = [
  {
    ticketId: 'ticket_1',
    type: 'ai_generation_failed',
    title: 'AI出图生成失败',
    description: '换模特任务失败',
    priority: 'P1',
    status: 'new',
    createdAt: '2026-07-20T01:00:00.000Z'
  }
]

storage.service_leads = [
  {
    leadId: 'lead_1',
    demandType: 'AI制版',
    requirementText: '希望批量识别结构图并进入版型库',
    createdAt: '2026-07-20T02:00:00.000Z'
  }
]

storage.diebians_product_analytics_events_v1 = [
  { eventId: 'event_1', eventName: 'search_empty', searchKeyword: '查看待审核版型', env: 'production', createdAt: '2026-07-20T03:00:00.000Z' },
  { eventId: 'event_2', eventName: 'task_submit', functionType: 'model_replace', env: 'production', userId: 'user_a', createdAt: '2026-07-20T04:00:00.000Z' },
  { eventId: 'event_dev', eventName: 'search_empty', searchKeyword: '开发测试', env: 'development', createdAt: '2026-07-20T05:00:00.000Z' }
]

storage.diebians_internal_product_suggestions_v1 = [
  {
    suggestionId: 'suggestion_1',
    title: '优化小程序包体积',
    category: 'miniapp_experience',
    description: '专业功能应迁移到网站工作台',
    userImpact: 2,
    urgency: 4,
    createdAt: '2026-07-20T06:00:00.000Z'
  }
]

function loadModule() {
  const transformed = source
    .replace(/^import .+$/gm, '')
    .replace(/export const /g, 'const ')
    .replace(/export function /g, 'function ')

  const factory = new Function(
    'requirePlatformAdmin',
    'loadBusinessMetricsCenter',
    'loadPatternTrainingCenter',
    'listTasks',
    `${transformed}
return {
  FEATURE_REQUEST_CATEGORIES,
  ROADMAP_STATUSES,
  loadProductRoadmapCenter,
  loadFeatureRequestCenter,
  confirmFeatureRequestPriority,
  updateRoadmapItem
}`
  )

  return factory(
    () => ({ allowed: allowPlatform, reason: allowPlatform ? '' : 'platform_admin_required' }),
    () => ({
      canAccess: true,
      featureMetrics: [
        {
          functionType: 'model_replace',
          taskCount: 4,
          aiCost: 20,
          quotaIncome: 8,
          failureRate: 50,
          approvalRate: 20,
          approvedImageCount: 0,
          segmentLabel: '高使用、低通过',
          recommendedAction: '优化模型或流程'
        }
      ]
    }),
    () => ({
      samples: [{ sampleId: 'sample_1', revisionDiff: [{ changed: true }, { changed: true }, { changed: true }] }],
      qualityQueue: [{ sampleId: 'sample_2', issues: ['未获得 AI 训练授权'] }]
    }),
    () => [
      {
        taskId: 'task_failed_1',
        type: 'model_replace',
        provider: 'wanx',
        status: 'failed',
        createdAt: '2026-07-20T07:00:00.000Z'
      },
      {
        taskId: 'task_mock_1',
        type: 'model_replace',
        provider: 'mock',
        status: 'failed',
        mock: true,
        createdAt: '2026-07-20T08:00:00.000Z'
      }
    ]
  )
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function run() {
  const mod = loadModule()

  allowPlatform = false
  const denied = mod.loadProductRoadmapCenter()
  assert(!denied.canAccess, 'platform guard should deny')

  allowPlatform = true
  const center = mod.loadProductRoadmapCenter()
  assert(center.canAccess, 'roadmap center should be accessible')
  assert(center.summary.requestCount > 0, 'should build requests from real sources')
  assert(center.summary.linkedSourceCount >= center.summary.requestCount, 'requests should keep source evidence')
  assert(center.requests.some((item) => item.sourceTypes.includes('task_failure')), 'task failure source should be included')
  assert(center.requests.every((item) => item.platformAllocation && item.platformAllocation.platform), 'each request should have platform allocation')
  assert(!JSON.stringify(center).includes('开发测试'), 'development analytics should be excluded')

  const patternRequest = center.requests.find((item) => item.category === 'pattern_making')
  assert(patternRequest && patternRequest.platformAllocation.platform === 'workspace', 'pattern work should be assigned to workspace')

  const miniappRequest = center.requests.find((item) => item.category === 'miniapp_experience')
  assert(miniappRequest && miniappRequest.platformAllocation.platform === 'miniapp', 'miniapp experience should be assigned to miniapp')

  const first = center.requests[0]
  const confirm = mod.confirmFeatureRequestPriority(first.requestId, 'P1')
  assert(confirm.success, 'manual priority confirm should succeed')
  const afterConfirm = mod.loadFeatureRequestCenter({ priority: 'P1' })
  assert(afterConfirm.requests.some((item) => item.requestId === first.requestId && item.score.manuallyConfirmed), 'manual priority should override suggested priority')

  const move = mod.updateRoadmapItem(first.requestId, { status: 'paused' })
  assert(move.success, 'roadmap status update should succeed')
  const afterMove = mod.loadProductRoadmapCenter()
  assert(afterMove.roadmapItems.some((item) => item.requestId === first.requestId && item.status === 'paused'), 'roadmap status should persist')

  const pagesJson = fs.readFileSync(path.join(root, 'pages.json'), 'utf8')
  assert(pagesJson.includes('pages/admin-product-roadmap'), 'product roadmap route should be registered')
  assert(pagesJson.includes('pages/admin-feature-requests'), 'feature requests route should be registered')

  console.log('product roadmap smoke passed')
}

run()
