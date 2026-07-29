const assert = require('assert')
const fs = require('fs')
const path = require('path')
const vm = require('vm')

const ROOT = path.resolve(__dirname, '..')

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8')
}

function loadContract() {
  const source = `${read('utils/task/generationContract.js')
    .replace(/export const /g, 'const ')
    .replace(/export function /g, 'function ')
    .replace(/export \{[^}]+\}\s*$/m, '')}
module.exports = { GENERATION_FEATURE_RULES, GENERATION_STATUSES, normalizeGenerationStatus, normalizeGenerationTaskOptions, resolveExpectedOutputCount, aggregateGenerationResults }`
  const context = { module: { exports: {} }, exports: {}, Object, Array, Set, String, Number, Boolean, RegExp, Math }
  vm.runInNewContext(source, context, { filename: 'generationContract.js' })
  return context.module.exports
}

function run() {
  const contract = loadContract()
  assert.strictEqual(contract.GENERATION_FEATURE_RULES.length, 13)

  const cases = [
    ['AI模特', { type: 'model_replace' }, 1],
    ['换衣服', { type: 'garment_replace' }, 1],
    ['换姿势', { type: 'pose_replace' }, 1],
    ['换场景', { type: 'scene_replace' }, 1],
    ['换颜色', { type: 'color_replace' }, 1],
    ['换面料', { type: 'fabric_replace' }, 1],
    ['换图案', { type: 'pattern_replace' }, 1],
    ['改款式', { type: 'style_redesign', outputCount: 4 }, 4],
    ['平铺细节', { type: 'flat_lay' }, 1],
    ['服装细节图', { type: 'garment_detail_batch', selectedDetails: ['neckline', 'cuff', 'hem'] }, 3],
    ['自动排版详情长图', { type: 'detail_page_long_image' }, 1],
    ['批量模特图', { type: 'batch_model', batchImages: [{}, {}, {}], perItemOutputCount: 2 }, 6],
    ['AI服装生产方案', { type: 'ai_production_plan', deliverables: [{ quantity: 1 }, { quantity: 2 }, { quantity: 3 }] }, 6]
  ]

  cases.forEach(([label, input, expected]) => {
    assert.strictEqual(contract.resolveExpectedOutputCount(input), expected, `${label} count mismatch`)
  })

  const child = contract.normalizeGenerationTaskOptions({
    type: 'style_redesign',
    batchId: 'batch_1',
    input: { params: { expectedOutputCount: 4, outputIndex: 2 }, options: { expectedOutputCount: 4, outputIndex: 2 } }
  })
  assert.strictEqual(child.expectedOutputCount, 1)
  assert.strictEqual(child.input.options.expectedOutputCount, 1)
  assert.strictEqual(child.input.options.parentExpectedOutputCount, 4)

  const status = contract.aggregateGenerationResults([
    { status: 'success' },
    { status: 'completed' },
    { status: 'failed' }
  ], 3)
  assert.deepStrictEqual(JSON.parse(JSON.stringify(status)), {
    expectedOutputCount: 3,
    completedOutputCount: 2,
    failedOutputCount: 1,
    generatingOutputCount: 0,
    status: 'partial_success'
  })

  const taskLayer = read('utils/task/taskLayer.js')
  const persistenceIndex = taskLayer.indexOf('await persistWanxResultItems')
  const completedIndex = taskLayer.indexOf('buildWanxSuccessPatch(latestTask, wanxResult, persistedItems)')
  assert.ok(persistenceIndex >= 0 && completedIndex > persistenceIndex)
  assert.ok(taskLayer.includes('upsertWorkRecordFromTask(persistedTask)'))
  assert.ok(taskLayer.includes('normalizeGenerationTaskOptions(options)'))
  assert.ok(taskLayer.includes('existingTask) return existingTask'))

  const execution = read('utils/task/generationExecution.js')
  const workspace = read('utils/workspace/workspaceProduction.js')
  const workbench = read('package-ai/simple-ai-workbench/simple-ai-workbench.vue')
  const upload = read('package-ai/upload/upload.vue')
  const marketing = read('package-ai/marketing-workbench/marketing-workbench.vue')
  assert.ok(execution.includes('createGenerationTaskAndRun'))
  assert.ok(execution.includes('createGenerationExecution'))
  assert.ok(workspace.includes('createGenerationExecution'))
  assert.ok(workbench.includes('createGenerationTaskAndRun'))
  assert.ok(upload.includes('createInternalRealGenerationTask'))
  assert.ok(marketing.includes('createGenerationTaskAndRun'))

  console.log('FULL_GENERATION_LOOP_SMOKE_OK features=13 counts=single,multi,batch statuses=canonical')
}

try {
  run()
} catch (error) {
  console.error(error.stack || error.message || error)
  process.exitCode = 1
}
