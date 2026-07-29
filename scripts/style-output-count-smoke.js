const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8')
}

function check(condition, message) {
  if (!condition) throw new Error(message)
  console.log(`PASS ${message}`)
}

async function main() {
  const contractSource = read('utils/task/outputVariantContract.js')
  const contract = await import(`data:text/javascript;base64,${Buffer.from(contractSource).toString('base64')}`)
  ;[1, 2, 4, 8].forEach((count) => {
    const slots = contract.buildOutputVariantSlots(count, `style_test_${count}`)
    check(slots.length === count, `${count} 个方案创建 ${count} 个输出槽位`)
    check(slots.every((slot) => slot.outputCount === 1), `${count} 个方案的 Provider 子任务均为单图`)
    check(slots.every((slot) => slot.expectedOutputCount === count), `${count} 个方案保留期望结果总数`)
    check(new Set(slots.map((slot) => slot.idempotencyKey)).size === count, `${count} 个方案使用独立幂等键`)
  })

  const workbench = read('package-ai/simple-ai-workbench/simple-ai-workbench.vue')
  const workspace = read('utils/workspace/workspaceProduction.js')
  const resultPage = read('package-ai/result/result.vue')
  const works = read('utils/work/workRepository.js')
  const provider = read('cloudfunctions/generate_wanx/index.js')

  check(/STYLE_OUTPUT_COUNT_OPTIONS\s*=\s*\[1,\s*2,\s*4,\s*8\]/.test(workbench), '内部调试支持默认 1 张，正式选项保留 2/4/8 个方案')
  check(workbench.includes('STYLE_OUTPUT_COUNT_OPTIONS.filter((count) => count !== 1)'), '正式用户不暴露内部单张调试选项')
  check(workbench.includes('STYLE_WIZARD_STEPS'), '改款式页面使用四步向导')
  check(workbench.includes('changeTargets: [...this.styleChangeTargets]'), '任务保存改动部位')
  check(workbench.includes('targetDirections: { ...this.styleTargetDirections }'), '任务保存部位目标方向')
  check(workbench.includes('preserveItems: [...this.stylePreserveItems]'), '任务保存保持不变项')
  check(workbench.includes('不得随机更换模特、人脸、姿势、背景或构图'), '结构化提示词保护人物与背景')
  check(workbench.includes('createWorkspaceOutputVariantBatch'), '多方案提交进入生产批次')
  check(workbench.includes('batchId=${encodeURIComponent(this.styleCreatedBatchId)}'), '结果页路由携带 batchId')
  check(workspace.includes('expectedOutputCount: slot.expectedOutputCount'), '批次记录期望结果数量')
  check(workspace.includes('retryRelations: []'), '批次保留失败重试关系')
  check(workspace.includes("summary.summaryStatus === 'partial_success'"), '部分失败进入稳定终态')
  check(resultPage.includes('productionProgressLabel'), '结果页展示批次真实进度')
  check(resultPage.includes('生成成功后会自动收录到作品库'), '结果页明确自动收录作品')
  const taskLayer = read('utils/task/taskLayer.js')
  check(taskLayer.includes('upsertWorkRecordFromTask(persistedTask)'), '任务状态写入时自动同步作品记录')
  check(/\bn\s*:\s*1\b/.test(provider), '当前 Provider 契约为单次单图')
}

main().catch((error) => {
  console.error(`FAIL ${error.message}`)
  process.exitCode = 1
})
