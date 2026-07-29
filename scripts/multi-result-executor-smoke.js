const assert = require('assert')
const fs = require('fs')
const path = require('path')
const vm = require('vm')

const ROOT = path.resolve(__dirname, '..')

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8')
}

async function loadExecutor() {
  const contractSource = `${read('utils/task/generationContract.js')
    .replace(/export const /g, 'const ')
    .replace(/export function /g, 'function ')
    .replace(/export \{[^}]+\}\s*$/m, '')}
module.exports = { aggregateGenerationResults }`
  const contractContext = { module: { exports: {} }, exports: {}, Object, Array, Set, String, Number, Boolean, Math }
  vm.runInNewContext(contractSource, contractContext, { filename: 'generationContract.js' })
  const source = `${read('utils/task/multiResultExecutor.js')
    .replace("import { aggregateGenerationResults } from './generationContract'", 'const { aggregateGenerationResults } = generationContract')
    .replace(/export function /g, 'function ')}
module.exports = { createMultiResultExecution, aggregateMultiResultStatus, validateDeliverables }`
  const context = {
    module: { exports: {} },
    exports: {},
    generationContract: contractContext.module.exports,
    Object,
    Array,
    Set,
    String,
    Number,
    Boolean,
    RegExp,
    Math
  }
  vm.runInNewContext(source, context, { filename: 'multiResultExecutor.js' })
  return context.module.exports
}

function deliverable(id, quantity, outputType = id) {
  return {
    deliverableId: id,
    outputType,
    title: id,
    quantity,
    ratio: '1:1',
    scene: '测试场景',
    purpose: '测试交付',
    prompt: `生成独立的${id}图片`,
    status: 'pending',
    taskType: `${id}_generate`,
    actionType: `${id}_generate`,
    itemType: outputType,
    unitCost: 1
  }
}

function execute(executor, deliverables, submissionKey) {
  const calls = []
  const result = executor.createMultiResultExecution({
    submissionKey,
    planId: 'smoke_plan',
    projectId: 'smoke_project',
    deliverables,
    buildTaskOptions: (slot) => ({
      type: slot.taskType,
      input: { params: { promptDraft: slot.prompt }, options: {} }
    }),
    createBatch: (options) => {
      calls.push(options)
      return { batchId: options.batchId, taskIds: options.children.map((item, index) => `task_${index + 1}`) }
    }
  })
  return { result, call: calls[0] }
}

async function main() {
  const executor = await loadExecutor()
  const cases = [
    { count: 1, items: [deliverable('main_image', 1)] },
    { count: 3, items: [deliverable('model_image', 2), deliverable('scene_image', 1)] },
    {
      count: 9,
      items: [
        deliverable('main_image', 1),
        deliverable('model_image', 2),
        deliverable('scene_image', 2),
        deliverable('garment_detail', 3),
        deliverable('detail_long_image', 1)
      ]
    }
  ]

  cases.forEach(({ count, items }) => {
    const first = execute(executor, items, `submission_${count}`)
    const second = execute(executor, items, `submission_${count}`)
    assert.strictEqual(first.result.expectedOutputCount, count)
    assert.strictEqual(first.result.childTaskIds.length, count)
    assert.strictEqual(first.call.children.length, count)
    assert.ok(first.call.children.every((child) => child.input.options.outputCount === 1))
    assert.ok(first.call.children.every((child) => child.input.options.expectedOutputCount === 1))
    assert.ok(first.call.children.every((child) => child.input.options.parentExpectedOutputCount === count))
    assert.strictEqual(new Set(first.call.children.map((child) => child.params.idempotencyKey)).size, count)
    assert.deepStrictEqual(
      first.call.children.map((child) => child.params.idempotencyKey),
      second.call.children.map((child) => child.params.idempotencyKey)
    )
  })

  const partial = executor.aggregateMultiResultStatus([
    { status: 'completed' },
    { status: 'completed' },
    { status: 'failed' }
  ])
  assert.deepStrictEqual(JSON.parse(JSON.stringify(partial)), {
    expectedOutputCount: 3,
    completedOutputCount: 2,
    failedOutputCount: 1,
    generatingOutputCount: 0,
    status: 'partial_success'
  })

  const invalid = executor.validateDeliverables([{ ...deliverable('bad', 1), prompt: '生成九宫格拼图' }])
  assert.strictEqual(invalid.ok, false)
  assert.strictEqual(invalid.code, 'COMPOSITE_LAYOUT_FORBIDDEN')

  const workspace = read('utils/workspace/workspaceProduction.js')
  const guide = read('package-ai/production-guide/production-guide.vue')
  const batchTask = read('utils/task/batchTask.js')
  const taskLayer = read('utils/task/taskLayer.js')
  const provider = read('cloudfunctions/generate_wanx/index.js')
  assert.ok(workspace.includes('createGenerationExecution'))
  assert.ok(workspace.includes('restoreRunBySubmissionKey'))
  assert.ok(workspace.includes('createWorkspaceOutputVariantBatch'))
  assert.ok(workspace.includes('createWorkspaceGarmentDetailBatch'))
  assert.ok(guide.includes('确认生成{{ adoptedPlanExpectedOutputCount }}个独立结果') || guide.includes('确认生成${this.adoptedPlanExpectedOutputCount}个独立结果'))
  assert.ok(guide.includes('deliverables: this.getExecutablePlanItems(plan)'))
  assert.ok(guide.includes('const deliverableCount = Math.max(actions.length, outputs.length)'))
  assert.ok(guide.includes("const title = outputs[index] || item.title"))
  assert.ok(batchTask.includes('candidateParams.idempotencyKey === idempotencyKey'))
  assert.ok(taskLayer.includes('upsertWorkRecordFromTask(persistedTask)'))
  assert.ok(/\bn\s*:\s*1\b/.test(provider))
  console.log('MULTI_RESULT_EXECUTOR_SMOKE_OK counts=1,3,9 provider=single-image')
}

main().catch((error) => {
  console.error(error.stack || error.message || error)
  process.exitCode = 1
})
