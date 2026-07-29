import { createTaskAndRun } from './taskLayer'
import { createBatchTasks } from './batchTask'
import { createMultiResultExecution } from './multiResultExecutor'
import { normalizeGenerationTaskOptions } from './generationContract'
import { buildTestTaskMetadata } from '../runtime/appRuntimeConfig'
import { consumeQuota, createQuotaAlphaTaskId, rollbackQuota, settleQuotaByTask } from '../quota/quotaFlow'

export function createGenerationTaskAndRun(options = {}) {
  return createTaskAndRun(normalizeGenerationTaskOptions(options))
}

export function createGenerationExecution(options = {}) {
  return createMultiResultExecution({
    ...options,
    createBatch: options.createBatch || createBatchTasks,
    buildTaskOptions(slot) {
      const taskOptions = typeof options.buildTaskOptions === 'function'
        ? options.buildTaskOptions(slot)
        : {}
      return normalizeGenerationTaskOptions(taskOptions)
    }
  })
}

export async function createInternalRealGenerationTask(options = {}, runtime = {}) {
  if (!runtime || runtime.realProviderTest !== true || runtime.canManageTesting !== true) {
    const error = new Error('仅内部测试账号可调用真实 Provider')
    error.code = 'INTERNAL_REAL_TEST_REQUIRED'
    throw error
  }
  const normalized = normalizeGenerationTaskOptions(options)
  if (Number(normalized.expectedOutputCount || 1) !== 1) {
    const error = new Error('内部真实效果测试当前仅允许单张串行提交')
    error.code = 'REAL_TEST_SINGLE_OUTPUT_REQUIRED'
    throw error
  }
  const taskId = normalized.taskId || createQuotaAlphaTaskId()
  const action = String(normalized.type || normalized.taskType || (normalized.params || {}).actionType || '').trim()
  let quota = null
  try {
    quota = await consumeQuota({ taskId, action, count: 1 })
    const metadata = buildTestTaskMetadata(runtime)
    const task = createTaskAndRun(normalizeGenerationTaskOptions({
      ...normalized,
      taskId,
      clientTaskId: taskId,
      idempotencyKey: `${taskId}:${action}`,
      run: { ...(normalized.run || {}), fallbackToMock: false },
      input: {
        ...(normalized.input || {}),
        params: {
          ...((normalized.input || {}).params || {}),
          ...metadata,
          quotaRecordId: quota.quotaRecordId,
          quotaRecordStatus: quota.quotaRecordStatus,
          realProviderTest: true
        }
      },
      params: {
        ...(normalized.params || {}),
        ...metadata,
        quotaRecordId: quota.quotaRecordId,
        quotaRecordStatus: quota.quotaRecordStatus,
        realProviderTest: true
      }
    }))
    settleQuotaByTask({ taskId: task.taskId, quotaRecordId: quota.quotaRecordId })
    return task
  } catch (error) {
    if (quota && quota.quotaRecordId) {
      try { await rollbackQuota(quota.quotaRecordId, error.code || 'task_create_failed') } catch (rollbackError) {}
    }
    throw error
  }
}
