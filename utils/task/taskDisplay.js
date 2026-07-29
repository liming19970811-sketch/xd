const STATUS_META = Object.freeze({
  pending: Object.freeze({ label: '等待处理', tone: 'pending', terminal: false }),
  generating: Object.freeze({ label: '生成中', tone: 'processing', terminal: false }),
  completed: Object.freeze({ label: '已完成', tone: 'success', terminal: true }),
  failed: Object.freeze({ label: '生成失败', tone: 'failed', terminal: true }),
  partial_success: Object.freeze({ label: '部分完成', tone: 'warning', terminal: true }),
  result_missing: Object.freeze({ label: '结果缺失', tone: 'warning', terminal: true }),
  cancelled: Object.freeze({ label: '已取消', tone: 'muted', terminal: true }),
  unknown: Object.freeze({ label: '状态确认中', tone: 'muted', terminal: false })
})

const STATUS_ALIASES = Object.freeze({
  draft: 'pending',
  pending: 'pending',
  submitted: 'generating',
  accepted: 'generating',
  provider_accepted: 'generating',
  queued: 'generating',
  processing: 'generating',
  generating: 'generating',
  running: 'generating',
  polling: 'generating',
  success: 'completed',
  completed: 'completed',
  done: 'completed',
  result_ready: 'completed',
  failed: 'failed',
  error: 'failed',
  timeout: 'failed',
  partial_failed: 'partial_success',
  partial_success: 'partial_success',
  result_missing: 'result_missing',
  cancelled: 'cancelled',
  canceled: 'cancelled'
})

function text(value = '') {
  return String(value || '').trim()
}

function resolveUrl(value) {
  if (!value) return ''
  if (typeof value === 'string') return value
  if (Array.isArray(value)) return resolveUrl(value[0])
  return text(value.imageUrl || value.image_url || value.fileUrl || value.file_url || value.coverUrl || value.url)
}

export function normalizeTaskDisplayStatus(status = '') {
  return STATUS_ALIASES[text(status).toLowerCase()] || 'unknown'
}

export function getTaskStatusMeta(status = '') {
  return STATUS_META[normalizeTaskDisplayStatus(status)] || STATUS_META.unknown
}

export function isTaskTerminal(status = '') {
  return getTaskStatusMeta(status).terminal
}

export function shouldPollTask(status = '') {
  const normalized = normalizeTaskDisplayStatus(status)
  return normalized === 'pending' || normalized === 'generating' || normalized === 'unknown'
}

export function hasUsableTaskResult(task = {}) {
  const result = task.result
  const resultObject = result && typeof result === 'object' && !Array.isArray(result) ? result : {}
  const items = Array.isArray(resultObject.items) ? resultObject.items : (Array.isArray(result) ? result : [])
  return Boolean(
    resolveUrl(task.resultImageUrl) ||
    resolveUrl(task.result_image_url) ||
    resolveUrl(resultObject.image) ||
    resolveUrl(resultObject.coverUrl) ||
    items.some((item) => Boolean(resolveUrl(item)))
  )
}

export function canRetryTask(task = {}) {
  if (normalizeTaskDisplayStatus(task.status || task.stage) !== 'failed') return false
  const control = task.control || {}
  const error = task.error || {}
  return control.canRetry === true || error.retryable === true
}

export function getTaskProgressSummary(task = {}) {
  const rawStatus = text(task.status || task.stage).toLowerCase()
  const status = normalizeTaskDisplayStatus(rawStatus)
  if (status === 'completed' && !hasUsableTaskResult(task)) return '已完成，结果暂不可用'
  if (status === 'result_missing') return '生成结果未保存，请检查或重试'
  if (status === 'completed') return '结果已生成'
  if (status === 'partial_success') return '部分结果已生成'
  if (status === 'failed') return '任务未完成，可查看原因'
  if (status === 'cancelled') return '任务已取消'
  if (status === 'generating') {
    if (['submitted', 'accepted', 'provider_accepted'].includes(rawStatus)) return '任务已提交，等待生成'
    if (rawStatus === 'queued') return '正在排队等待生成'
    if (rawStatus === 'polling' || (task.control || {}).canContinuePolling === true) return '正在确认生成结果'
    return '正在生成素材'
  }
  if (status === 'pending') return '任务已创建，等待处理'
  return '正在确认最新状态'
}

export function getTaskPrimaryAction(status = '', canRetry = false) {
  const normalized = normalizeTaskDisplayStatus(status)
  if (normalized === 'completed') return '查看结果'
  if (normalized === 'partial_success') return canRetry ? '查看结果并处理失败项' : '查看结果'
  if (normalized === 'result_missing') return canRetry ? '查看任务并重试' : '查看任务'
  if (normalized === 'failed') return canRetry ? '查看原因并重试' : '查看原因'
  return '查看进度'
}

export { STATUS_META as TASK_DISPLAY_STATUS_META }
