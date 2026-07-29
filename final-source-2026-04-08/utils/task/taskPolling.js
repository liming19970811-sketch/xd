import { getMainChainState } from '../mainChainState'
import { queryTaskResult } from '../api/task'
import { mergeTaskResult, updateTaskStatus } from './taskActions'

const DEFAULT_POLL_INTERVAL_MS = 3000
const DEFAULT_MAX_POLL_COUNT = 10

function getRuntimeTaskControl(state) {
  const currentTaskId = state.currentTaskId || state.taskId || state.lastTaskId || ''
  const currentTask = currentTaskId && state.tasks && state.tasks.byId && state.tasks.byId[currentTaskId]
  const runtimeTask = currentTask || state.draftTask || {}
  return runtimeTask.control || {}
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

function getTaskStatusText(taskStatus, progress) {
  if (taskStatus === 'queued') {
    return '任务排队中...'
  }
  if (taskStatus === 'processing') {
    return `AI 生成处理中 ${progress}%`
  }
  if (taskStatus === 'success') {
    return '生成完成'
  }
  if (taskStatus === 'failed' || taskStatus === 'error') {
    return '生成失败'
  }
  return '等待任务结果...'
}

export async function pollTaskResult(taskId, options = {}) {
  const pollIntervalMs = options.pollIntervalMs || DEFAULT_POLL_INTERVAL_MS
  const maxPollCount = options.maxPollCount || DEFAULT_MAX_POLL_COUNT

  for (let attempt = 0; attempt < maxPollCount; attempt += 1) {
    await sleep(pollIntervalMs)

    let taskResult
    try {
      taskResult = await queryTaskResult(taskId)
    } catch (error) {
      updateTaskStatus({
        generating: false,
        taskStatus: 'failed',
        genText: '任务查询失败',
        pollingError: error && error.message ? error.message : '轮询网络错误',
        errorMessage: error && error.message ? error.message : '轮询网络错误',
        canContinuePolling: true,
        retryable: {
          ...(getRuntimeTaskControl(getMainChainState()).retryState || {}),
          polling: true,
          generate: false
        }
      })

      return {
        status: 'failed',
        reason: 'query_error',
        error
      }
    }

    const taskStatus = taskResult.taskStatus || 'processing'
    const taskProgress = taskResult.progress || Math.min(70 + attempt * 5, 95)

    updateTaskStatus({
      taskId: taskResult.taskId || taskId,
      lastTaskId: taskResult.taskId || taskId,
      taskStatus,
      progress: taskProgress,
      genText: getTaskStatusText(taskStatus, taskProgress),
      errorMessage: taskResult.errorMessage || '',
      pollingError: '',
      canContinuePolling: true
    })

    if (taskResult.resultImageUrl) {
      mergeTaskResult({
        generating: false,
        taskStatus: 'success',
        progress: 100,
        genText: '生成完成',
        taskId: taskResult.taskId || taskId,
        lastTaskId: taskResult.taskId || taskId,
        resultImageUrl: taskResult.resultImageUrl,
        errorMessage: '',
        pollingError: '',
        canContinuePolling: false,
        retryable: {
          ...(getRuntimeTaskControl(getMainChainState()).retryState || {}),
          polling: false,
          generate: false
        }
      })

      return {
        status: 'success',
        reason: 'result_ready',
        taskResult
      }
    }

    if (taskStatus === 'failed' || taskStatus === 'error') {
      updateTaskStatus({
        generating: false,
        taskStatus: 'failed',
        genText: '生成失败',
        errorMessage: taskResult.errorMessage || '任务执行失败',
        pollingError: taskResult.errorMessage || '任务执行失败',
        canContinuePolling: false,
        retryable: {
          ...(getRuntimeTaskControl(getMainChainState()).retryState || {}),
          polling: false,
          generate: true
        }
      })

      return {
        status: 'failed',
        reason: 'task_failed',
        taskResult
      }
    }
  }

  updateTaskStatus({
    generating: false,
    taskStatus: 'timeout',
    genText: '生成超时，请稍后重试',
    errorMessage: '任务轮询超时',
    pollingError: '任务轮询超时',
    canContinuePolling: true,
    retryable: {
      ...(getRuntimeTaskControl(getMainChainState()).retryState || {}),
      polling: true,
      generate: true
    }
  })

  return {
    status: 'timeout',
    reason: 'timeout'
  }
}

export async function continuePollingTask(taskId, options = {}) {
  if (!taskId) {
    throw new Error('暂无可继续查询的任务')
  }

  updateTaskStatus({
    generating: true,
    taskStatus: 'processing',
    genText: options.statusText || '继续查询任务结果...',
    pollingError: '',
    errorMessage: '',
    canContinuePolling: true,
    retryable: {
      ...(getRuntimeTaskControl(getMainChainState()).retryState || {}),
      polling: false
    }
  })

  return pollTaskResult(taskId, options)
}
