import { createTaskAndRun, getTask } from './taskLayer'
import { createBatchTasks } from './batchTask'
import { createMultiResultExecution } from './multiResultExecutor'
import { normalizeGenerationTaskOptions } from './generationContract'
import { buildGenerationTaskMetadata } from '../runtime/appRuntimeConfig'
import { consumeQuota, createQuotaAlphaTaskId, rollbackQuota, settleQuotaByTask } from '../quota/quotaFlow'

function withFormalMetadata(options = {}) {
  const metadata = buildGenerationTaskMetadata({ provider: options.provider || 'wanx' })
  return {
    ...options,
    provider: options.provider || 'wanx',
    mock: false,
    run: { ...(options.run || {}), fallbackToMock: false },
    input: {
      ...(options.input || {}),
      params: { ...((options.input || {}).params || {}), ...metadata }
    },
    params: { ...(options.params || {}), ...metadata }
  }
}

export function createGenerationTaskAndRun(options = {}) {
  return createTaskAndRun(normalizeGenerationTaskOptions(withFormalMetadata(options)))
}

export function createGenerationExecution(options = {}) {
  return createMultiResultExecution({
    ...options,
    createBatch: options.createBatch || createBatchTasks,
    buildTaskOptions(slot) {
      const taskOptions = typeof options.buildTaskOptions === 'function' ? options.buildTaskOptions(slot) : {}
      return normalizeGenerationTaskOptions(withFormalMetadata(taskOptions))
    }
  })
}

export async function createRealGenerationTask(options = {}, runtime = {}) {
  if (!runtime || runtime.canSubmit !== true || runtime.useRealProvider !== true) {
    const error = new Error((runtime && runtime.disabledReason) || '正式 API 配置尚未就绪')
    error.code = 'REAL_PROVIDER_NOT_READY'
    throw error
  }

  const normalized = normalizeGenerationTaskOptions(options)
  const taskId = normalized.taskId || createQuotaAlphaTaskId()
  const action = String(normalized.type || normalized.taskType || (normalized.params || {}).actionType || '').trim()
  let quota = null
  try {
    quota = await consumeQuota({ taskId, action, count: 1 })
    const metadata = buildGenerationTaskMetadata(runtime)
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
          quotaRecordStatus: quota.quotaRecordStatus
        }
      },
      params: {
        ...(normalized.params || {}),
        ...metadata,
        quotaRecordId: quota.quotaRecordId,
        quotaRecordStatus: quota.quotaRecordStatus
      }
    }))
    settleQuotaByTask({ taskId: task.taskId, quotaRecordId: quota.quotaRecordId, taskReader: getTask })
    return task
  } catch (error) {
    if (quota && quota.quotaRecordId) {
      try { await rollbackQuota(quota.quotaRecordId, error.code || 'task_create_failed') } catch (rollbackError) {}
    }
    throw error
  }
}
