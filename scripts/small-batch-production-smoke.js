const assert = require('assert')
const fs = require('fs')
const path = require('path')
const policy = require('../cloudfunctions/small_batch_production/productionPolicy')

const root = path.resolve(__dirname, '..')
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8')
const pathFlow = [
  ['draft','pending_quote'], ['pending_quote','quoted'], ['quoted','quote_confirmed'],
  ['quote_confirmed','pending_material'], ['pending_material','material_ready'],
  ['material_ready','production_scheduled'], ['production_scheduled','producing'],
  ['producing','quality_check'], ['quality_check','ready_to_deliver'],
  ['ready_to_deliver','delivered'], ['delivered','completed']
]
pathFlow.forEach(([from,to]) => assert(policy.canTransition(from,to), `${from} -> ${to}`))
assert(policy.canTransition('quality_check','rework_required'))
assert(policy.canTransition('rework_required','producing'))
assert(!policy.canTransition('draft','producing'))
assert(!policy.canTransition('quality_check','completed'))
assert(!policy.canTransition('completed','cancelled'))
assert(policy.stableAsset('cloud://production/qc.jpg'))
assert(policy.stableAsset('https://example.com/delivery.jpg'))
assert(!policy.stableAsset('wxfile://tmp/qc.jpg'))
assert(!policy.stableAsset('http://tmp/qc.jpg'))

const cloudSource = read('cloudfunctions/small_batch_production/index.js')
for (const contract of [
  "sample.status !== 'confirmed'", "version.reviewStatus !== 'approved'", 'SAMPLE_BLOCKING_ISSUES',
  'SIZE_QUANTITY_REQUIRED', 'MATERIAL_REQUIRED', 'CRAFT_REQUIRED', 'FACTORY_REQUIRED',
  'QUOTE_REQUIRED', 'QUALITY_RESULT_REQUIRED', 'DELIVERY_REQUIRED', 'STABLE_ASSET_REQUIRED'
]) assert(cloudSource.includes(contract), `${contract} gate exists`)
assert(cloudSource.includes('idempotencyKey'))
assert(cloudSource.includes("status !== 'cancelled'"), 'active order is unique per confirmed sample')
assert(cloudSource.includes("assignedFactoryMemberId: ctx.memberId"), 'factory collaborator is bound after quote')
assert(cloudSource.includes("productionReady: true") && cloudSource.includes("['delivered'],'completed"), 'production becomes complete only after delivery')
assert(!/requestPayment|wx\.requestPayment|autoDelivery|createTaskAndRun|taskLayer|quota/i.test(cloudSource), 'production workflow does not invoke payment, AI or quota')
assert(!/event\.(openId|openid|_openid|role|isAdmin)/.test(cloudSource), 'client identity is not trusted')
assert(cloudSource.includes("session.status !== 'active'") && cloudSource.includes("member.status !== 'active'"))

const pages = read('pages.json')
for (const route of ['small-batch-list/small-batch-list','small-batch-create/small-batch-create','small-batch-detail/small-batch-detail']) assert(pages.includes(route), `${route} registered`)
const createPage = read('package-mobile-enterprise/small-batch-create/small-batch-create.vue')
const detailPage = read('package-mobile-enterprise/small-batch-detail/small-batch-detail.vue')
assert(createPage.includes('尺码和数量已确认') && createPage.includes('面辅料要求已确认') && createPage.includes('工艺要求已确认'))
assert(createPage.includes('系统不会自动选择工厂') && createPage.includes('idempotencyKey'))
assert(detailPage.includes("assetType:'production_image'") && detailPage.includes('质检记录') && detailPage.includes('交付记录'))
assert(!/openid|OPENID|sessionToken/.test(createPage + detailPage))

console.log('[PASS] small-batch admission gates')
console.log('[PASS] quote, production, quality, rework and delivery states')
console.log('[PASS] tenant role and stable asset boundaries')
console.log('[PASS] no automatic payment, AI generation or delivery')
console.log('[PASS] routes and mobile production UI contract')
