const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')
const source = fs.readFileSync(path.join(root, 'utils', 'admin', 'v1ReadinessCenter.js'), 'utf8')

let allowPlatform = true

function loadModule() {
  const transformed = source
    .replace(/^import .+$/gm, '')
    .replace(/export const /g, 'const ')
    .replace(/export function /g, 'function ')

  const factory = new Function(
    'requirePlatformAdmin',
    `${transformed}
return {
  V1_READINESS_STATUSES,
  V1_COMPLETION_REQUIREMENTS,
  V1_EXECUTION_ORDER,
  V1_RELEASE_BLOCKERS,
  V1_DEFERRED_FEATURES,
  loadV1ReadinessCenter
}`
  )
  return factory(() => ({ allowed: allowPlatform, reason: allowPlatform ? '' : 'platform_admin_required' }))
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function run() {
  const mod = loadModule()

  allowPlatform = false
  const denied = mod.loadV1ReadinessCenter()
  assert(!denied.canAccess, 'platform guard should deny V1 readiness')

  allowPlatform = true
  const center = mod.loadV1ReadinessCenter()
  assert(center.canAccess, 'platform admin should access V1 readiness')
  assert(center.completionRequirements.length === 9, 'completion standard should keep nine required checks')
  assert(center.executionOrder.length === 9, 'execution order should contain nine steps')
  assert(center.releaseBlockers.includes('重复扣费'), 'release blockers should include duplicate charge redline')
  assert(center.releaseBlockers.includes('mock/fallback 可以交付'), 'release blockers should include mock/fallback delivery redline')
  assert(center.deferredFeatures.some((item) => item.key === 'large_api_platform'), 'large API platform should be deferred')
  assert(!center.items.some((item) => item.title.includes('自动工厂匹配')), 'deferred features must not enter V1 core items')
  assert(center.items.every((item) => item.completedAllowed === false), 'no item should be marked completed without full evidence')
  assert(center.releaseGate.canRelease === false, 'release gate should be blocked while redlines remain')
  assert(center.items.some((item) => item.featureId === 'garment_replace_top_bottom'), 'top/bottom garment replace must stay in V1 scope')
  assert(center.items.some((item) => item.featureId === 'pattern_making_core'), 'AI pattern making must stay in V1 scope')

  const pagesJson = fs.readFileSync(path.join(root, 'pages.json'), 'utf8')
  assert(pagesJson.includes('pages/admin-v1-readiness'), 'V1 readiness route should be registered')

  console.log('v1 readiness smoke passed')
}

run()
