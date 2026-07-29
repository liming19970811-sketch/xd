import { createBatchTasks } from '../task/batchTask'
import { listTasks } from '../task/taskLayer'
import { createGenerationTaskAndRun } from '../task/generationExecution'
import {
  getTaskPrimaryAction,
  getTaskProgressSummary,
  getTaskStatusMeta,
  normalizeTaskDisplayStatus
} from '../task/taskDisplay'
import { getCurrentUser } from '../user/userRepository'
import { getWorksByTaskIds } from '../work/workRepository'
import {
  getWorkspaceProductionResultSummary,
  getWorkspaceProductions,
  retryWorkspaceProductionItem
} from './workspaceProduction'
import {
  createWorkspacePlanHistory,
  failWorkspacePlanHistory,
  getWorkspacePlanHistories,
  linkWorkspacePlanTasks
} from './workspacePlanHistory'

export const PRODUCTION_RECORD_PAGE_SIZE = 10

const ACTIVE_STATUSES = new Set(['pending', 'generating', 'unknown'])
const TERMINAL_STATUSES = new Set(['completed', 'failed', 'partial_success', 'cancelled'])
const OPERATION_LOCKS = new Set()

const TYPE_RULES = Object.freeze([
  { label: '批量模特图', pattern: /batch_model|model_batch/ },
  { label: 'AI换衣服', pattern: /garment_replace|clothes_replace|outfit_replace|virtual_try_on/ },
  { label: '打版结构图', pattern: /pattern_structure_generate|pattern_structure_/ },
  { label: '换模特', pattern: /model_replace|head_replace|face_replace|ai_model/ },
  { label: '换场景', pattern: /scene_replace|replace_scene|scene_change|background_replace/ },
  { label: 'AI换姿势', pattern: /pose_replace|pose_adjust|pose_variation|pose_variant|pose_change/ },
  { label: '换颜色', pattern: /color_replace|basic_recolor|color_batch/ },
  { label: '换面料', pattern: /fabric_replace|fabric_variation/ },
  { label: '换图案', pattern: /pattern_replace|pattern_variation|print_generate|print_placement/ },
  { label: '结构线稿', pattern: /image_to_sketch|structure_sketch/ },
  { label: '款式起稿', pattern: /text_to_sketch|style_draft/ },
  { label: '线稿效果图', pattern: /sketch_to_model|sketch_render/ },
  { label: '微改款', pattern: /style_redesign|hot_style|(^|\s)refine($|\s)/ },
  { label: '平铺细节', pattern: /flat_lay|detail_closeup/ },
  { label: '详情页', pattern: /detail_page|detail_long|page_material|product_page|marketing_asset/ },
  { label: '营销素材', pattern: /marketing|poster|series|campaign/ },
  { label: '展示图', pattern: /display|image_enhance/ }
])

function text(value = '') {
  return String(value || '').trim()
}

function unique(values = []) {
  return [...new Set((Array.isArray(values) ? values : []).map(text).filter(Boolean))]
}

function toTimestamp(value) {
  if (!value) return 0
  if (value && typeof value.toDate === 'function') return toTimestamp(value.toDate())
  if (value && typeof value === 'object') {
    const seconds = Number(value.seconds || value._seconds)
    if (Number.isFinite(seconds) && seconds > 0) return seconds * 1000
  }
  if (typeof value === 'number') return value < 100000000000 ? value * 1000 : value
  const timestamp = new Date(value).getTime()
  return Number.isFinite(timestamp) ? timestamp : 0
}

function formatFullTime(value) {
  const timestamp = toTimestamp(value)
  if (!timestamp) return '—'
  const date = new Date(timestamp)
  const pad = (number) => String(number).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function formatRelativeTime(value) {
  const timestamp = toTimestamp(value)
  if (!timestamp) return '—'
  const diff = Math.max(0, Date.now() - timestamp)
  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}天前`
  return formatFullTime(timestamp)
}

function getTaskId(task = {}) {
  return text(task.taskId || task.id || task.clientTaskId)
}

function getTaskOwner(task = {}) {
  const input = task.input || {}
  const params = input.params || task.params || {}
  return text(task.userId || task.ownerId || task.createdBy || task.openId || task.openid || task._openid || input.userId || params.userId)
}

function getIdentity() {
  const user = getCurrentUser() || {}
  return {
    user,
    available: Boolean(text(user.openId) && !text(user.openId).startsWith('mock_')),
    ids: new Set([text(user.userId), text(user.openId)].filter(Boolean))
  }
}

function canAccessTask(task = {}, identity = {}) {
  const owner = getTaskOwner(task)
  if (owner) return identity.ids.has(owner)
  const source = text(task.taskSource || task.source || 'miniapp').toLowerCase()
  return !/admin|enterprise|shared|public/.test(source)
}

function canAccessHistory(history = {}, identity = {}) {
  const owner = text(history.userId || history.ownerId || history.createdBy)
  return !owner || identity.ids.has(owner)
}

function normalizeTaskStatus(value = '') {
  return normalizeTaskDisplayStatus(value)
}

function aggregateStatus(tasks = [], fallback = 'pending') {
  if (!tasks.length) return normalizeTaskStatus(fallback)
  const statuses = tasks.map((task) => normalizeTaskStatus(task.status || task.stage))
  const completed = statuses.filter((status) => status === 'completed').length
  const failed = statuses.filter((status) => status === 'failed').length
  const active = statuses.filter((status) => ACTIVE_STATUSES.has(status)).length
  const cancelled = statuses.filter((status) => status === 'cancelled').length
  if (active) return completed || failed ? 'generating' : (statuses.every((status) => status === 'pending') ? 'pending' : 'generating')
  if (completed === statuses.length) return 'completed'
  if (failed === statuses.length) return 'failed'
  if (cancelled === statuses.length) return 'cancelled'
  if (completed > 0 && (failed > 0 || cancelled > 0)) return 'partial_success'
  if (failed > 0) return 'failed'
  return normalizeTaskStatus(fallback)
}

function getTaskTypeSource(task = {}) {
  const input = task.input || {}
  const params = input.params || task.params || {}
  return [task.taskType, task.type, params.actionType, params.toolType, params.itemType, params.outputType]
    .filter(Boolean).join(' ').toLowerCase()
}

function getTaskTypeLabel(task = {}) {
  const source = getTaskTypeSource(task)
  const matched = TYPE_RULES.find((rule) => rule.pattern.test(source))
  return (matched && matched.label) || 'AI生成'
}

function getErrorInfo(task = {}) {
  const error = task.error && typeof task.error === 'object' ? task.error : {}
  const code = text(error.code || error.errorCode || task.errorCode).toUpperCase()
  const type = text(error.type).toLowerCase()
  const rawMessage = text(error.message || task.errorMessage || task.statusText)
  const source = `${code} ${type} ${rawMessage}`.toLowerCase()
  let message = '生成未完成，请稍后重试。'
  if (/upload/.test(source)) message = '图片上传失败，请重新上传后再试。'
  else if (/file.*not|image.*access|expired|download/.test(source)) message = '图片暂不可访问，请重新上传后再试。'
  else if (/invalid|input|parameter|param/.test(source)) message = '输入不符合要求，请检查图片和生成设置。'
  else if (/quota|point|balance|limit/.test(source)) message = '额度不足，请先查看当前可用额度。'
  else if (/timeout|network|request/.test(source)) message = '网络或服务超时，请稍后重试。'
  else if (/safety|content|moderation|risk/.test(source)) message = '内容未通过安全检查，请调整图片或描述。'
  else if (/provider|wanx|service|unavailable/.test(source)) message = 'AI服务暂时不可用，请稍后重试。'
  const retryable = error.retryable === true || (task.control || {}).canRetry === true || /timeout|network|request|provider|service|unavailable/.test(source)
  return { code: code || 'UNKNOWN', type: type || 'generate', message, retryable }
}

function getAssetUrl(value) {
  if (!value) return ''
  if (typeof value === 'string') return value
  return text(value.fileId || value.fileID || value.fileUrl || value.url || value.imageUrl || value.localPath)
}

function hasStableInputs(task = {}) {
  const assets = ((task.input || {}).assets) || {}
  const urls = [
    assets.personImage,
    assets.upperGarment,
    assets.lowerGarment,
    assets.outfitGarment,
    assets.garmentImage,
    ...(Array.isArray(assets.accessoryReferences) ? assets.accessoryReferences : []),
    assets.frontImage,
    assets.backImage,
    assets.sideImage,
    assets.structureSketch,
    assets.designSketch,
    assets.clothImage,
    assets.styleImage,
    assets.referenceImage,
    (task.input || {}).imageUrl
  ]
    .map(getAssetUrl).filter(Boolean)
  if (!urls.length) return /text_to_sketch|text_generate/.test(getTaskTypeSource(task))
  return urls.every((url) => /^(cloud:\/\/|https:\/\/)/i.test(url))
}

function getTaskTime(task = {}, field = '') {
  const fields = field ? [field] : ['updatedAt', 'completedAt', 'failedAt', 'submittedAt', 'createdAt']
  return fields.map((key) => task[key]).find((value) => toTimestamp(value)) || ''
}

function normalizeTask(task = {}, index = 0, works = []) {
  const taskId = getTaskId(task)
  const status = normalizeTaskStatus(task.status || task.stage)
  const taskWorks = works.filter((work) => work.taskId === taskId)
  const resultCount = taskWorks.reduce((count, work) => count + Math.max(0, Number(work.completedOutputCount) || 0), 0)
  const error = status === 'failed' ? getErrorInfo(task) : null
  return {
    taskId,
    index: index + 1,
    typeLabel: getTaskTypeLabel(task),
    status,
    statusLabel: getTaskStatusMeta(status).label,
    progressLabel: getTaskProgressSummary(task),
    createdAt: getTaskTime(task, 'createdAt') || getTaskTime(task, 'submittedAt'),
    finishedAt: getTaskTime(task, status === 'failed' ? 'failedAt' : 'completedAt') || (TERMINAL_STATUSES.has(status) ? getTaskTime(task, 'updatedAt') : ''),
    createdTimeLabel: formatFullTime(getTaskTime(task, 'createdAt') || getTaskTime(task, 'submittedAt')),
    finishedTimeLabel: formatFullTime(getTaskTime(task, status === 'failed' ? 'failedAt' : 'completedAt') || (TERMINAL_STATUSES.has(status) ? getTaskTime(task, 'updatedAt') : '')),
    hasResult: resultCount > 0,
    resultCount,
    canRetry: status === 'failed' && Boolean(error && error.retryable) && hasStableInputs(task),
    inputAvailable: hasStableInputs(task),
    error,
    raw: task
  }
}

function normalizeMissingTask(taskId = '', index = 0) {
  return {
    taskId: text(taskId),
    index: index + 1,
    typeLabel: '任务信息暂不可用',
    status: 'pending',
    statusLabel: getTaskStatusMeta('unknown').label,
    progressLabel: '任务信息暂不可用',
    createdAt: '',
    finishedAt: '',
    createdTimeLabel: '—',
    finishedTimeLabel: '—',
    hasResult: false,
    resultCount: 0,
    canRetry: false,
    inputAvailable: false,
    error: null,
    raw: null
  }
}

function buildTimeline(record = {}, production = {}) {
  const nodes = []
  const add = (status, time, description = '', label = '') => {
    const timestamp = toTimestamp(time)
    if (!timestamp) return
    nodes.push({ status, label: label || getTaskStatusMeta(status).label, time, timestamp, timeLabel: formatFullTime(time), description })
  }
  add('pending', record.createdAt, '生产记录已创建', '已创建')
  ;(Array.isArray(production.statusChanges) ? production.statusChanges : []).forEach((item) => {
    add(normalizeTaskStatus(item.status), item.createdAt || item.time, '')
  })
  record.tasks.forEach((task) => {
    add('generating', task.raw.startedAt, '开始处理生成任务')
    if (task.status === 'completed') add('completed', task.raw.completedAt || task.raw.updatedAt, '生成任务已完成')
    if (task.status === 'failed') add('failed', task.raw.failedAt || task.raw.updatedAt, task.error && task.error.message)
    if (task.status === 'cancelled') add('cancelled', task.raw.cancelledAt || task.raw.updatedAt, '任务已取消')
  })
  const seen = new Set()
  return nodes.sort((left, right) => left.timestamp - right.timestamp).filter((node) => {
    const key = `${node.status}:${node.timestamp}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function safeProductionSummary(production = {}, taskIds = []) {
  try {
    const summary = getWorkspaceProductionResultSummary({
      historyId: production.historyId || '',
      batchId: production.batchId || '',
      taskId: taskIds[0] || ''
    })
    if (!summary || !Array.isArray(summary.items) || !summary.items.length) return null
    if (!summary.batchId && taskIds.length > 1 && summary.items.length === 1) return null
    return summary
  } catch (error) {
    return null
  }
}

function getRecordPlanName(history = {}, production = {}, tasks = []) {
  const first = tasks[0] || {}
  const params = ((first.input || {}).params) || first.params || {}
  return text(production.planName || params.planName || history.planName || 'AI生成方案')
}

function buildRecord(history = {}, production = {}, sourceTasks = [], availableWorks = []) {
  const historyTaskIds = unique([...(history.taskIds || []), ...(production.taskIds || [])])
  const allTasks = sourceTasks.filter((task) => historyTaskIds.includes(getTaskId(task)))
  const summary = safeProductionSummary(production, historyTaskIds)
  const supersededTaskIds = new Set(allTasks.map((task) => text(((task.input || {}).params || {}).retryOfTaskId || (task.params || {}).retryOfTaskId)).filter(Boolean))
  const derivedCurrentIds = historyTaskIds.filter((taskId) => !supersededTaskIds.has(taskId))
  const currentIds = summary && summary.items.length ? unique(summary.items.map((item) => item.taskId)) : derivedCurrentIds
  const currentTasks = currentIds.map((taskId) => allTasks.find((task) => getTaskId(task) === taskId)).filter(Boolean)
  const effectiveTasks = currentTasks.length ? currentTasks : allTasks
  const selectedTaskIds = new Set(historyTaskIds)
  const works = availableWorks.filter((work) => selectedTaskIds.has(work.taskId))
  const tasks = historyTaskIds.map((taskId, index) => {
    const task = allTasks.find((candidate) => getTaskId(candidate) === taskId)
    return task ? normalizeTask(task, index, works) : normalizeMissingTask(taskId, index)
  })
  const currentTaskIdSet = new Set(currentIds)
  const currentNormalizedTasks = tasks.filter((task) => currentTaskIdSet.has(task.taskId))
  const status = aggregateStatus(effectiveTasks.length ? effectiveTasks : allTasks, history.status || production.status)
  const createdAt = history.createdAt || production.createdAt || getTaskTime(allTasks[0] || {}, 'createdAt')
  const updatedAt = production.updatedAt || [...allTasks].sort((left, right) => toTimestamp(getTaskTime(right)) - toTimestamp(getTaskTime(left)))[0]?.updatedAt || createdAt
  const completedAt = status === 'completed' ? (production.completedAt || getTaskTime(effectiveTasks[effectiveTasks.length - 1] || {}, 'completedAt')) : ''
  const failedTasks = currentNormalizedTasks.filter((task) => task.status === 'failed')
  const taskExecutionCount = allTasks.reduce((max, task) => {
    const params = ((task.input || {}).params) || task.params || {}
    return Math.max(max, Number(params.executionCount) || 1)
  }, 1)
  const record = {
    recordId: text(history.historyId || production.historyId),
    historyId: text(history.historyId || production.historyId),
    planId: text(history.planId || production.planId),
    batchId: text(production.batchId || effectiveTasks[0]?.batchId),
    planName: getRecordPlanName(history, production, allTasks),
    typeLabel: getTaskTypeLabel(effectiveTasks[0] || allTasks[0] || {}),
    status,
    statusLabel: getTaskStatusMeta(status).label,
    statusTone: status === 'completed' ? 'success' : (status === 'failed' ? 'failed' : (status === 'partial_success' ? 'partial' : (status === 'cancelled' ? 'muted' : 'processing'))),
    createdAt,
    updatedAt,
    completedAt,
    createdTimeLabel: formatFullTime(createdAt),
    createdRelativeLabel: formatRelativeTime(createdAt),
    updatedTimeLabel: formatFullTime(updatedAt),
    updatedRelativeLabel: formatRelativeTime(updatedAt),
    completedTimeLabel: formatFullTime(completedAt),
    taskCount: currentNormalizedTasks.length || unique(historyTaskIds).length,
    attemptCount: tasks.length,
    completedTaskCount: currentNormalizedTasks.filter((task) => task.status === 'completed').length,
    failedTaskCount: failedTasks.length,
    workCount: works.length,
    tasks,
    currentTaskIds: currentIds,
    works,
    assetIds: unique(history.assetIds || production.assetIds),
    executionCount: Math.max(1, Number(history.executionCount) || taskExecutionCount),
    canRetry: failedTasks.some((task) => task.canRetry),
    canRerun: effectiveTasks.length > 0 && effectiveTasks.every(hasStableInputs),
    failureMessage: failedTasks[0] && failedTasks[0].error ? failedTasks[0].error.message : '',
    production
  }
  record.timeline = buildTimeline(record, production)
  return record
}

function buildOrphanRecord(task = {}, availableWorks = []) {
  const taskId = getTaskId(task)
  const works = availableWorks.filter((work) => work.taskId === taskId)
  const normalizedTask = normalizeTask(task, 0, works)
  const status = normalizedTask.status
  const createdAt = getTaskTime(task, 'createdAt') || getTaskTime(task, 'submittedAt')
  const updatedAt = getTaskTime(task)
  const record = {
    recordId: `task:${taskId}`,
    historyId: '',
    planId: text(((task.input || {}).params || {}).planId),
    batchId: text(task.batchId),
    planName: text(((task.input || {}).params || {}).planName || '单次AI生成'),
    typeLabel: normalizedTask.typeLabel,
    status,
    statusLabel: getTaskStatusMeta(status).label,
    statusTone: status === 'completed' ? 'success' : (status === 'failed' ? 'failed' : (status === 'cancelled' ? 'muted' : 'processing')),
    createdAt,
    updatedAt,
    completedAt: status === 'completed' ? (task.completedAt || task.updatedAt) : '',
    createdTimeLabel: formatFullTime(createdAt),
    createdRelativeLabel: formatRelativeTime(createdAt),
    updatedTimeLabel: formatFullTime(updatedAt),
    updatedRelativeLabel: formatRelativeTime(updatedAt),
    completedTimeLabel: formatFullTime(status === 'completed' ? (task.completedAt || task.updatedAt) : ''),
    taskCount: 1,
    completedTaskCount: status === 'completed' ? 1 : 0,
    failedTaskCount: status === 'failed' ? 1 : 0,
    workCount: works.length,
    tasks: [normalizedTask],
    currentTaskIds: [taskId],
    works,
    assetIds: [],
    executionCount: 1,
    canRetry: false,
    canRerun: hasStableInputs(task),
    failureMessage: normalizedTask.error ? normalizedTask.error.message : '',
    production: {}
  }
  record.timeline = buildTimeline(record, {})
  return record
}

function readRecords() {
  const identity = getIdentity()
  if (!identity.available) return { identityAvailable: false, records: [] }
  const tasks = listTasks().filter((task) => canAccessTask(task, identity))
  const taskMap = new Map(tasks.map((task) => [getTaskId(task), task]))
  const availableWorks = getWorksByTaskIds(tasks.map(getTaskId))
  const productions = getWorkspaceProductions()
  const productionMap = new Map(productions.map((production) => [production.historyId, production]))
  const histories = getWorkspacePlanHistories().filter((history) => canAccessHistory(history, identity))
  const linkedTaskIds = new Set()
  const records = histories.map((history) => {
    const production = productionMap.get(history.historyId) || {}
    const extraTaskIds = tasks.filter((task) => text(((task.input || {}).params || {}).historyId || (task.params || {}).historyId) === history.historyId).map(getTaskId)
    const taskIds = unique([...(history.taskIds || []), ...extraTaskIds])
    taskIds.forEach((taskId) => linkedTaskIds.add(taskId))
    const selectedTasks = taskIds.map((taskId) => taskMap.get(taskId)).filter(Boolean)
    return buildRecord({ ...history, taskIds }, production, selectedTasks, availableWorks)
  })
  tasks.forEach((task) => {
    const taskId = getTaskId(task)
    if (taskId && !linkedTaskIds.has(taskId)) records.push(buildOrphanRecord(task, availableWorks))
  })
  const seen = new Set()
  return {
    identityAvailable: true,
    records: records.filter((record) => {
      if (!record.recordId || seen.has(record.recordId)) return false
      seen.add(record.recordId)
      return true
    })
  }
}

function filterRecords(records = [], filter = 'all') {
  if (filter === 'processing') return records.filter((record) => ACTIVE_STATUSES.has(record.status))
  if (filter === 'completed') return records.filter((record) => record.status === 'completed')
  if (filter === 'failed') return records.filter((record) => ['failed', 'partial_success'].includes(record.status))
  return records
}

function sortRecords(records = [], sort = 'created') {
  const field = sort === 'updated' ? 'updatedAt' : 'createdAt'
  return records.slice().sort((left, right) => {
    const timeDiff = toTimestamp(right[field]) - toTimestamp(left[field])
    return timeDiff || right.recordId.localeCompare(left.recordId)
  })
}

export function getProductionRecordPage(options = {}) {
  const source = readRecords()
  const filter = text(options.filter || 'all') || 'all'
  const sort = text(options.sort || 'created') || 'created'
  const pageSize = Math.min(PRODUCTION_RECORD_PAGE_SIZE, Math.max(1, Number(options.pageSize) || PRODUCTION_RECORD_PAGE_SIZE))
  const filtered = sortRecords(filterRecords(source.records, filter), sort)
  const cursorId = text(options.cursor)
  const cursorIndex = cursorId ? filtered.findIndex((record) => record.recordId === cursorId) : -1
  const offset = cursorIndex >= 0 ? cursorIndex + 1 : 0
  const items = filtered.slice(offset, offset + pageSize)
  const hasMore = offset + items.length < filtered.length
  const allRecords = source.records
  return {
    ok: true,
    identityAvailable: source.identityAvailable,
    items,
    cursor: hasMore && items.length ? items[items.length - 1].recordId : '',
    hasMore,
    loadedCount: offset + items.length,
    stats: {
      all: allRecords.length,
      processing: allRecords.filter((record) => ACTIVE_STATUSES.has(record.status)).length,
      completed: allRecords.filter((record) => record.status === 'completed').length,
      failed: allRecords.filter((record) => ['failed', 'partial_success'].includes(record.status)).length
    }
  }
}

export function getTaskCenterSnapshot(options = {}) {
  const source = readRecords()
  const limit = Math.max(1, Math.min(3, Number(options.limit) || 3))
  const priority = { generating: 0, pending: 1, failed: 2, partial_success: 2, completed: 3, unknown: 4, cancelled: 5 }
  const sorted = source.records.slice().sort((left, right) => {
    const statusDiff = (priority[left.status] ?? 9) - (priority[right.status] ?? 9)
    if (statusDiff) return statusDiff
    return toTimestamp(right.updatedAt || right.createdAt) - toTimestamp(left.updatedAt || left.createdAt)
  })
  const items = sorted.slice(0, limit).map((record) => ({
    recordId: record.recordId,
    historyId: record.historyId,
    taskId: record.currentTaskIds[0] || '',
    planName: record.planName,
    typeLabel: record.typeLabel,
    status: record.status,
    statusLabel: getTaskStatusMeta(record.status).label,
    statusTone: getTaskStatusMeta(record.status).tone,
    progressLabel: record.status === 'completed' && !record.workCount
      ? '已完成，结果暂不可用'
      : (record.taskCount > 1
        ? `${record.completedTaskCount}/${record.taskCount} 项已完成`
        : ((record.tasks[0] && record.tasks[0].progressLabel) || getTaskStatusMeta(record.status).label)),
    timeLabel: record.updatedRelativeLabel || record.createdRelativeLabel,
    previewUrl: record.works[0] ? (record.works[0].coverUrl || record.works[0].previewUrl || '') : '',
    canRetry: record.canRetry,
    primaryActionLabel: getTaskPrimaryAction(record.status, record.canRetry)
  }))
  return {
    ok: true,
    identityAvailable: source.identityAvailable,
    items,
    stats: {
      all: source.records.length,
      processing: source.records.filter((record) => ACTIVE_STATUSES.has(record.status) || record.status === 'unknown').length,
      completed: source.records.filter((record) => record.status === 'completed').length,
      failed: source.records.filter((record) => ['failed', 'partial_success'].includes(record.status)).length
    }
  }
}

export function getProductionRecordDetail(recordId = '') {
  const source = readRecords()
  return source.records.find((record) => record.recordId === text(recordId)) || null
}

export function getProductionRecordsByIds(recordIds = []) {
  const selectedIds = new Set(unique(recordIds))
  if (!selectedIds.size) return []
  const source = readRecords()
  const byId = new Map(source.records.map((record) => [record.recordId, record]))
  return [...selectedIds].map((recordId) => byId.get(recordId)).filter(Boolean)
}

function getSourceTasks(record = {}) {
  const currentIds = new Set(record.currentTaskIds || [])
  return (record.tasks || []).filter((task) => currentIds.has(task.taskId)).map((task) => task.raw).filter(Boolean)
}

function cloneTaskOptions(task = {}, context = {}) {
  const input = task.input || {}
  const params = input.params || task.params || {}
  const nextInputParams = {
    ...params,
    historyId: context.historyId,
    sourceHistoryId: context.sourceHistoryId,
    retryOfTaskId: context.retryOfTaskId || '',
    rerunOfTaskId: context.rerunOfTaskId || '',
    clientRequestId: context.clientRequestId,
    idempotencyKey: context.clientRequestId,
    executionCount: context.executionCount || 1,
    quotaRecordId: '',
    quota_record_id: '',
    batchId: ''
  }
  return {
    type: task.type || task.taskType,
    taskType: task.taskType || task.type,
    taskSource: task.taskSource || task.source,
    channel: task.channel || 'production_record',
    projectId: task.projectId || '',
    clientTaskId: context.clientRequestId,
    input: {
      ...input,
      assets: { ...(input.assets || {}) },
      params: nextInputParams,
      options: { ...(input.options || {}) }
    },
    params: {
      ...(task.params || {}),
      ...nextInputParams
    }
  }
}

function withOperationLock(key, handler) {
  if (OPERATION_LOCKS.has(key)) return { ok: false, status: 'submitting', message: '操作正在提交，请勿重复点击。' }
  OPERATION_LOCKS.add(key)
  try {
    return handler()
  } catch (error) {
    return { ok: false, status: 'create_failed', message: '任务创建失败，请稍后重试。' }
  } finally {
    setTimeout(() => OPERATION_LOCKS.delete(key), 1200)
  }
}

export function retryProductionRecord(recordId = '') {
  const record = getProductionRecordDetail(recordId)
  if (!record) return { ok: false, status: 'not_found', message: '生产记录不存在或无权访问。' }
  const currentTaskIds = new Set(record.currentTaskIds || [])
  const failedTasks = (record.tasks || []).filter((task) => currentTaskIds.has(task.taskId) && task.status === 'failed' && task.canRetry)
  if (!failedTasks.length) return { ok: false, status: 'not_retryable', message: '当前失败项不支持直接重试。' }
  const key = `retry:${record.recordId}`
  return withOperationLock(key, () => {
    const createdTaskIds = []
    failedTasks.forEach((task, index) => {
      let result = null
      if (record.historyId && record.batchId) {
        result = retryWorkspaceProductionItem({
          historyId: record.historyId,
          batchId: record.batchId,
          taskId: task.taskId,
          clientRequestId: `retry_${record.historyId}_${task.taskId}_${Date.now()}_${index}`
        })
      }
      if (result && result.ok && result.taskId) {
        createdTaskIds.push(result.taskId)
        return
      }
      if (!record.historyId) return
      const clientRequestId = `retry_${record.historyId}_${task.taskId}_${Date.now()}_${index}`
      const created = createGenerationTaskAndRun(cloneTaskOptions(task.raw, {
        historyId: record.historyId,
        sourceHistoryId: record.historyId,
        retryOfTaskId: task.taskId,
        executionCount: record.executionCount || 1,
        clientRequestId
      }))
      if (created && created.taskId) createdTaskIds.push(created.taskId)
    })
    if (!createdTaskIds.length) return { ok: false, status: 'create_failed', message: '失败项暂时无法重试。' }
    if (record.historyId) linkWorkspacePlanTasks(record.historyId, createdTaskIds)
    return { ok: true, status: 'created', historyId: record.historyId, taskIds: createdTaskIds, message: `已重试 ${createdTaskIds.length} 个失败项。` }
  })
}

export function rerunProductionRecord(recordId = '') {
  const record = getProductionRecordDetail(recordId)
  if (!record) return { ok: false, status: 'not_found', message: '生产记录不存在或无权访问。' }
  const sourceTasks = getSourceTasks(record)
  if (!sourceTasks.length) return { ok: false, status: 'input_missing', message: '原任务配置暂时不可复用。' }
  if (!sourceTasks.every(hasStableInputs)) return { ok: false, status: 'input_expired', message: '原输入图片已失效，请重新上传后再执行。' }
  const key = `rerun:${record.recordId}`
  return withOperationLock(key, () => {
    const identity = getIdentity()
    const history = createWorkspacePlanHistory({ planId: record.planId || 'repeat_generation', userId: text(identity.user.userId), cost: 0 })
    const operationId = `rerun_${history.historyId}_${Date.now()}`
    const children = sourceTasks.map((task, index) => cloneTaskOptions(task, {
      historyId: history.historyId,
      sourceHistoryId: record.historyId,
      rerunOfTaskId: getTaskId(task),
      executionCount: (record.executionCount || 1) + 1,
      clientRequestId: `${operationId}_${index + 1}`
    }))
    let taskIds = []
    let batchId = ''
    try {
      if (children.length > 1) {
        const batch = createBatchTasks({ children })
        taskIds = unique(batch.taskIds)
        batchId = text(batch.batchId)
      } else {
        const task = createGenerationTaskAndRun(children[0])
        taskIds = task && task.taskId ? [task.taskId] : []
      }
    } catch (error) {
      failWorkspacePlanHistory(history.historyId)
      throw error
    }
    if (!taskIds.length) {
      failWorkspacePlanHistory(history.historyId)
      return { ok: false, status: 'create_failed', message: '任务创建失败，请稍后重试。' }
    }
    linkWorkspacePlanTasks(history.historyId, taskIds)
    return { ok: true, status: 'created', historyId: history.historyId, batchId, taskIds, message: '已创建新的生产记录。' }
  })
}

export function isProductionRecordTerminal(status = '') {
  return TERMINAL_STATUSES.has(text(status))
}

export { aggregateStatus, formatFullTime, formatRelativeTime, getErrorInfo, normalizeTaskStatus }
