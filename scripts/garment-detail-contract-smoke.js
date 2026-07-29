const assert = require('assert')
const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8')
}

async function loadContract() {
  const source = read('utils/task/garmentDetailContract.js')
  return import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`)
}

async function run() {
  const contract = await loadContract()
  const details = [
    { value: 'collar', label: '领口', prompt: '领口结构清晰' },
    { value: 'cuff', label: '袖口', prompt: '袖口结构清晰' },
    { value: 'button', label: '纽扣', prompt: '纽扣结构清晰' },
    { value: 'zipper', label: '拉链', prompt: '拉链结构清晰' },
    { value: 'stitching', label: '车线', prompt: '车线结构清晰' },
    { value: 'skirt_hem', label: '裙摆', prompt: '裙摆结构清晰' }
  ]

  ;[1, 4, 6].forEach((count) => {
    const selectedDetails = details.slice(0, count)
    const detailReferences = Object.fromEntries(selectedDetails.map((detail) => [detail.value, `cloud://detail/${detail.value}.jpg`]))
    const children = contract.buildGarmentDetailChildren({
      selectedDetails,
      detailReferences,
      submissionKey: `smoke_${count}`,
      mode: contract.GARMENT_DETAIL_MODES.FAITHFUL
    })
    assert.strictEqual(children.length, count, `${count}个细节应创建${count}个子任务`)
    assert.strictEqual(new Set(children.map((child) => child.taskType)).size, count, '子任务类型必须独立')
    assert.strictEqual(new Set(children.map((child) => child.idempotencyKey)).size, count, '幂等键必须独立')
    children.forEach((child) => {
      assert.strictEqual(child.outputCount, 1, '每个子任务只能输出一张图')
      assert.strictEqual(child.expectedOutputCount, count, '每个子任务必须记录父批次预期数量')
      assert.ok(child.detailReferenceImage, '每个子任务必须有对应近照')
      assert.strictEqual(contract.containsForbiddenGarmentDetailLayoutPrompt(child.promptDraft), false, '正向提示词不得要求拼图')
    })
  })

  const missingReference = contract.validateGarmentDetailSelection({
    selectedDetails: details.slice(0, 1),
    detailReferences: {}
  })
  assert.strictEqual(missingReference.ok, false, '缺少对应近照必须阻止任务')
  assert.strictEqual(missingReference.code, 'GARMENT_DETAIL_REFERENCE_REQUIRED')

  const neckline = contract.buildGarmentDetailPrompt(details[0], { mode: contract.GARMENT_DETAIL_MODES.FAITHFUL })
  assert.ok(neckline.prompt.includes('金属链条'), '领口提示词必须保留金属链条')
  assert.ok(neckline.negativePrompt.includes('white piping'), '领口负向提示词必须排除白色包边')
  assert.ok(neckline.negativePrompt.includes('missing metal chain'), '领口负向提示词必须排除金属链缺失')

  const page = read('package-ai/simple-ai-workbench/simple-ai-workbench.vue')
  assert.ok(!page.includes('detailGenerateCount'), '细节页不得保留手动生成张数字段')
  assert.ok(!page.includes('设置生成张数'), '细节页不得保留手动张数UI')
  assert.ok(page.includes('createWorkspaceGarmentDetailBatch'), '细节页必须创建独立子任务批次')
  assert.ok(page.includes('需要补充近照'), '未识别细节必须要求补充近照')

  const workspace = read('utils/workspace/workspaceProduction.js')
  assert.ok(workspace.includes("parentTaskType: GARMENT_DETAIL_PARENT_TASK_TYPE"), '子任务必须关联父任务类型')
  assert.ok(workspace.includes('createBatchTasks'), '父任务必须复用现有批次任务层')

  const result = read('package-ai/result/result.vue')
  assert.ok(result.includes('autoPersistCompletedWorks'), '完成结果必须自动保存到作品中心')
  assert.ok(result.includes('仅重试{{ activeProductionItem.displayName }}'), '结果页必须支持单项重试')

  console.log('GARMENT_DETAIL_CONTRACT_SMOKE_OK counts=1,4,6')
}

run().catch((error) => {
  console.error(error.stack || error.message || error)
  process.exitCode = 1
})
