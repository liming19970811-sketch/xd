import { getMainChainState } from '../mainChainState'
import { queryTaskResult } from '../api/task'
import { TASK_STATUS } from '../constants'
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
  if (taskStatus === TASK_STATUS.QUEUED) {
    return 'Task queued...'
  }
  if (taskStatus === TASK_STATUS.PROCESSING) {
    return `AI generating... ${progress}%`
  }
  if (taskStatus === TASK_STATUS.SUCCESS) {
    return 'Generation complete'
  }
  if (taskStatus === TASK_STATUS.FAILED) {
    return 'Generation failed'
  }
  if (taskStatus === TASK_STATUS.TIMEOUT) {
    return 'Generation timeout'
  }
  return 'Waiting for task result...'
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
        taskStatus: TASK_STATUS.FAILED,
        genText: 'Task query failed',
        pollingError: error && error.message ? error.message : 'Polling network error',
        errorMessage: error && error.message ? error.message : 'Polling network error',
        taskControl: {
          canContinuePolling: true,
          retryState: {
            ...(getRuntimeTaskControl(getMainChainState()).retryState || {}),
            polling: true,
            generate: false
          }
        }
      })

      return {
        status: TASK_STATUS.FAILED,
        reason: 'query_error',
        error
      }
    }

    const taskStatus = taskResult.taskStatus || TASK_STATUS.PROCESSING
    const taskProgress = taskResult.progress || Math.min(70 + attempt * 5, 95)

    updateTaskStatus({
      taskId: taskResult.taskId || taskId,
      lastTaskId: taskResult.taskId || taskId,
      taskStatus,
      progress: taskProgress,
      genText: getTaskStatusText(taskStatus, taskProgress),
      errorMessage: taskResult.errorMessage || '',
      pollingError: '',
      taskControl: {
        canContinuePolling: true
      }
    })

    if (taskResult.resultImageUrl) {
      mergeTaskResult({
        generating: false,
        taskStatus: TASK_STATUS.SUCCESS,
        progress: 100,
        genText: 'Generation complete',
        taskId: taskResult.taskId || taskId,
        lastTaskId: taskResult.taskId || taskId,
        resultImageUrl: taskResult.resultImageUrl,
        errorMessage: '',
        pollingError: '',
        taskControl: {
          canContinuePolling: false,
          retryState: {
            ...(getRuntimeTaskControl(getMainChainState()).retryState || {}),
            polling: false,
            generate: false
          }
        }
      })

      return {
        status: TASK_STATUS.SUCCESS,
        reason: 'result_ready',
        taskResult
      }
    }

    if (taskStatus === TASK_STATUS.FAILED || taskStatus === 'error') {
      updateTaskStatus({
        generating: false,
        taskStatus: TASK_STATUS.FAILED,
        genText: 'Generation failed',
        errorMessage: taskResult.errorMessage || 'Task execution failed',
        pollingError: taskResult.errorMessage || 'Task execution failed',
        taskControl: {
          canContinuePolling: false,
          retryState: {
            ...(getRuntimeTaskControl(getMainChainState()).retryState || {}),
            polling: false,
            generate: true
          }
        }
      })

      return {
        status: TASK_STATUS.FAILED,
        reason: 'task_failed',
        taskResult
      }
    }
  }

  updateTaskStatus({
    generating: false,
    taskStatus: TASK_STATUS.TIMEOUT,
    genText: 'Generation timeout',
    errorMessage: 'Task polling timeout',
    pollingError: 'Task polling timeout',
    taskControl: {
      canContinuePolling: true,
      retryState: {
        ...(getRuntimeTaskControl(getMainChainState()).retryState || {}),
        polling: true,
        generate: true
      }
    }
  })

  return {
    status: TASK_STATUS.TIMEOUT,
    reason: 'timeout'
  }
}

export async function continuePollingTask(taskId, options = {}) {
  if (!taskId) {
    throw new Error('No task to continue polling')
  }

  updateTaskStatus({
    generating: true,
    taskStatus: TASK_STATUS.PROCESSING,
    genText: options.statusText || 'Continue polling task result...',
    pollingError: '',
    errorMessage: '',
    taskControl: {
      canContinuePolling: true,
      retryState: {
        ...(getRuntimeTaskControl(getMainChainState()).retryState || {}),
        polling: false
      }
    }
  })

  return pollTaskResult(taskId, options)
}
