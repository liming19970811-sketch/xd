import { listTasks, patchTask } from '../task/taskLayer'
import { createGenerationTaskAndRun } from '../task/generationExecution'
import { getWorkspaceProductions } from '../workspace/workspaceProduction'
import { createWorkspacePlanHistory, failWorkspacePlanHistory, linkWorkspacePlanTasks } from '../workspace/workspacePlanHistory'
import {
  getWorkRecordByTaskId,
  getWorkRecordsForCurrentUser,
  markWorkRecordRead,
  moveWorkRecordToTrash,
  restoreWorkRecord,
  syncWorkRecordsFromTasks
} from './workRecordRepository'
import { getAvailableWorkCategories, getWorkCategoryLabel } from './workTypeCatalog'
import {
  isStableWorkResultUrl,
  normalizeWorkIntegrityStatus,
  normalizeWorkResultItems
} from './workResultIntegrity'

export const WORK_PAGE_SIZE = 20
const WORK_PREFERENCE_KEY = 'diebiandesign_work_preferences_v1'

const WORK_TYPE = Object.freeze({
  ALL: 'all',
  IMAGE: 'image',
  VIDEO: 'video',
  DESIGN: 'design'
})

const TYPE_LABELS = Object.freeze({
  [WORK_TYPE.IMAGE]: '图片',
  [WORK_TYPE.VIDEO]: '视频',
  [WORK_TYPE.DESIGN]: '设计素材'
})

const ITEM_TYPE_LABELS = Object.freeze({
  model_image: '换模特',
  garment_replace: 'AI换衣服',
  garment_replace_image: 'AI换衣服',
  pattern_structure_front_technical: '正面技术结构图',
  pattern_structure_back_technical: '背面技术结构图',
  pattern_structure_pattern_pieces: '纸样部件示意',
  white_background: '商品白底图',
  detail_page: '详情页素材',
  marketing_image: '营销素材',
  fabric_replace: '换面料',
  fabric_variation: '换面料',
  pattern_replace: '换图案',
  pattern_variation: '换图案',
  garment_detail_neckline: '领口细节图',
  garment_detail_cuff: '袖口细节图',
  garment_detail_button: '纽扣细节图',
  garment_detail_zipper: '拉链细节图',
  garment_detail_stitching: '车线细节图',
  garment_detail_hem: '裙摆细节图'
})

const ACTION_LABEL_RULES = Object.freeze([
  { label: '批量模特图', pattern: /batch_model|model_batch/ },
  { label: 'AI换衣服', pattern: /garment_replace|clothes_replace|outfit_replace|virtual_try_on|换衣服/ },
  { label: '打版结构图', pattern: /pattern_structure_generate|pattern_structure_|打版结构图/ },
  { label: '换模特', pattern: /model_replace|ai_model|head_replace|face_replace|换模特|换脸|换头/ },
  { label: '换场景', pattern: /scene_replace|replace_scene|scene_change|background_replace|basic_background|换场景/ },
  { label: 'AI换姿势', pattern: /pose_replace|pose_adjust|pose_variation|pose_variant|pose_change|换姿势|姿势/ },
  { label: '换颜色', pattern: /color_replace|basic_recolor|color_batch|换颜色|换色/ },
  { label: '换面料', pattern: /fabric_replace|fabric_variation|换面料/ },
  { label: '换图案', pattern: /pattern_replace|pattern_variation|print_generate|print_placement|换图案/ },
  { label: '结构线稿', pattern: /image_to_sketch|structure_sketch|结构线稿|结构稿/ },
  { label: '款式起稿', pattern: /text_to_sketch|style_draft|款式起稿|文字生成款式/ },
  { label: '线稿效果图', pattern: /sketch_to_model|sketch_render|线稿效果/ },
  { label: '改款式', pattern: /style_redesign|hot_style|(^|\s)refine($|\s)|改爆款|微改款|服装改款|改款式/ },
  { label: '服装细节图', pattern: /garment_detail_/ },
  { label: '平铺细节', pattern: /flat_lay|detail_closeup|平铺|细节/ },
  { label: '详情页', pattern: /detail_page|detail_long|page_material|product_page|详情页/ },
  { label: '营销素材', pattern: /marketing|poster|series|xiaohongshu|campaign|营销|海报|种草/ },
  { label: '走秀视频', pattern: /runway_video|short_video|video|走秀视频/ }
])

const DESIGN_TYPE_PATTERN = /pattern_structure|image_to_sketch|structure_sketch|text_to_sketch|style_draft|sketch_to_model|sketch_render|style_redesign|hot_style|(^|\s)refine($|\s)|打版结构|结构线稿|结构稿|款式起稿|线稿效果|微改款|改爆款/

function toText(value = '') {
  return String(value || '').trim()
}

function readWorkPreferences() {
  if (typeof uni === 'undefined' || !uni || typeof uni.getStorageSync !== 'function') return {}
  try {
    const value = uni.getStorageSync(WORK_PREFERENCE_KEY)
    return value && typeof value === 'object' ? value : {}
  } catch (error) {
    return {}
  }
}

function writeWorkPreferences(preferences = {}) {
  if (typeof uni === 'undefined' || !uni || typeof uni.setStorageSync !== 'function') return false
  try {
    uni.setStorageSync(WORK_PREFERENCE_KEY, preferences)
    return true
  } catch (error) {
    return false
  }
}

function pickUrl(value) {
  if (!value) return ''
  if (typeof value === 'string') return value
  return value.imageUrl || value.image_url || value.fileUrl || value.file_url || value.videoUrl || value.video_url || value.url || value.localPath || ''
}

export function resolveWorkImageUrl(work = {}) {
  const result = work.result || {}
  const rawResultItems = work.resultItems || result.items || (Array.isArray(result) ? result : [])
  const resultItems = Array.isArray(rawResultItems)
    ? rawResultItems
    : (rawResultItems ? [rawResultItems] : [])
  const candidates = [
    work.coverUrl,
    resultItems[0],
    work.imageUrl,
    work.image_url,
    work.resultImageUrl,
    work.result_image_url,
    result,
    work.previewUrl
  ]
  return candidates.map(pickUrl).find(isDownloadableWorkImageUrl) || ''
}

export function isDownloadableWorkImageUrl(value = '') {
  const url = toText(value)
  if (!url || /\s/.test(url)) return false
  const normalized = url.toLowerCase()
  if (/mock|placeholder|fallback|\/static\//.test(normalized)) return false
  return /^(https:\/\/|cloud:\/\/)/.test(normalized)
}

function getTaskId(task = {}) {
  return toText(task.taskId || task.task_id || task.id || task.clientTaskId || task.client_task_id)
}

function getTaskOwnerId(task = {}) {
  const input = task.input || {}
  const params = input.params || task.params || {}
  return toText(
    task.userId || task.ownerId || task.createdBy || task.openId || task.openid || task._openid ||
    input.userId || input.openId || params.userId || params.openId
  )
}

function getCurrentIdentity() {
  let user = {}
  let identity = {}
  try {
    if (typeof uni !== 'undefined' && uni && typeof uni.getStorageSync === 'function') {
      user = uni.getStorageSync('diebiandesign_current_user') || {}
      identity = uni.getStorageSync('diebiandesign_wechat_identity') || {}
    }
  } catch (error) {
    user = {}
    identity = {}
  }
  const openId = toText(identity.openId || identity.openid || user.openId || user.openid)
  const userId = toText(user.userId || identity.userId)
  return {
    available: Boolean(openId && !openId.startsWith('mock_')),
    userId,
    ids: new Set([userId, openId].filter(Boolean))
  }
}

function canAccessTask(task = {}, identity = {}) {
  if (!identity.available) return false
  const ownerId = getTaskOwnerId(task)
  if (ownerId) return identity.ids.has(ownerId)
  const source = toText(task.taskSource || task.source || 'miniapp').toLowerCase()
  return !/admin|enterprise|shared|public/.test(source)
}

function getTaskParams(task = {}) {
  const input = task.input || {}
  return {
    ...(input.options || {}),
    ...(input.params || {}),
    ...(task.params || {})
  }
}

function getResultItems(task = {}) {
  const result = task.result || {}
  if (Array.isArray(result)) return result
  if (Array.isArray(result.items)) return result.items
  if (result.items && typeof result.items === 'object') return [result.items]
  if (typeof result === 'string') return result ? [result] : []
  return pickUrl(result) ? [result] : []
}

function isMockOrFallbackResult(task = {}, item = {}) {
  const result = task.result && typeof task.result === 'object' ? task.result : {}
  const meta = result.meta && typeof result.meta === 'object' ? result.meta : {}
  const provider = [task.provider, result.provider, meta.provider, item.provider].map(toText).join(' ').toLowerCase()
  return Boolean(
    task.mock === true ||
    task.isMock === true ||
    task.fallback === true ||
    task.isFallback === true ||
    result.mock === true ||
    result.isMock === true ||
    result.fallback === true ||
    result.isFallback === true ||
    meta.mock === true ||
    meta.fallback === true ||
    item.mock === true ||
    item.fallback === true ||
    /mock|fallback/.test(provider)
  )
}

function getItemMediaType(item = {}, task = {}) {
  const source = [
    item.mediaType,
    item.type,
    item.outputType,
    item.mimeType,
    item.videoUrl,
    item.video_url,
    pickUrl(item),
    task.taskType,
    task.type
  ].filter(Boolean).join(' ').toLowerCase()
  return /video|\.mp4(?:$|\?)/.test(source) ? WORK_TYPE.VIDEO : WORK_TYPE.IMAGE
}

function getResultEntries(task = {}, production = {}) {
  if (task.resultAccessInvalid === true) return []
  const taskId = getTaskId(task)
  const resultItems = getResultItems(task)
  const taskAssetIds = Array.isArray(task.assetIds) ? task.assetIds : []
  const productionAssetIds = taskAssetIds.length ? taskAssetIds : (Array.isArray(production.assetIds) ? production.assetIds : [])
  const rawEntries = resultItems.length ? resultItems : [task.result || task]
  const seen = new Set()
  return normalizeWorkResultItems(rawEntries, productionAssetIds).map((value, index) => {
    const url = pickUrl(value)
    const assetId = toText(value.assetId)
    const duplicateKey = assetId || url
    if (!url || !isDownloadableWorkImageUrl(url) || !duplicateKey || seen.has(duplicateKey)) return null
    seen.add(duplicateKey)
    const workId = index === 0 ? taskId : `${taskId}__${assetId || index + 1}`
    return {
      workId,
      assetId,
      index,
      url,
      itemType: toText(value.itemType || value.outputType || value.type),
      displayName: toText(value.displayName || value.itemDisplayName || value.name),
      mediaType: getItemMediaType(value, task),
      isMock: isMockOrFallbackResult(task, value),
      isFallback: Boolean(task.fallback || task.isFallback || value.fallback || (task.result || {}).fallback),
      schemeName: toText(value.schemeName || value.variantName || value.planName),
      changeSummary: toText(value.changeSummary || value.featureSummary || value.description)
    }
  }).filter(Boolean)
}

function getSourceUrl(task = {}) {
  const input = task.input || {}
  const assets = input.assets || {}
  if (Array.isArray(assets)) return pickUrl(assets[0])
  return pickUrl(assets.baseImage) ||
    pickUrl(assets.modelImage) ||
    pickUrl(assets.personImage) ||
    pickUrl(assets.frontImage) ||
    pickUrl(assets.clothImage) ||
    pickUrl(assets.cloth_image) ||
    pickUrl(assets.styleImage) ||
    pickUrl(assets.style_image) ||
    pickUrl(input.imageUrl) ||
    pickUrl(input.image_url) ||
    pickUrl(task.sourceImage)
}

function getInputAssetSummary(task = {}, params = {}) {
  const assets = (task.input || {}).assets || {}
  return {
    hasTopGarment: Boolean(pickUrl(assets.topGarmentImage || assets.upperGarment) || params.topGarmentImage || params.upperGarment),
    hasBottomGarment: Boolean(pickUrl(assets.bottomGarmentImage || assets.lowerGarment) || params.bottomGarmentImage || params.lowerGarment),
    hasOnePieceGarment: Boolean(pickUrl(assets.onePieceGarmentImage || assets.outfitGarment) || params.onePieceGarmentImage || params.outfitGarment),
    hasSceneReference: Boolean(pickUrl(assets.sceneImage || assets.sceneReferenceImage) || params.sceneReferenceImage),
    hasPersonReference: Boolean(pickUrl(assets.headReferenceImage || assets.targetPersonImage || assets.referenceImage) || params.headReferenceImage || params.targetPersonImage)
  }
}

function normalizeStatus(task = {}) {
  const value = toText(task.status || task.taskStatus || task.task_status || task.stage).toLowerCase()
  if (['success', 'completed', 'done', 'result_ready'].includes(value)) return 'completed'
  if (['failed', 'error', 'timeout'].includes(value)) return 'failed'
  if (['cancelled', 'canceled'].includes(value)) return 'cancelled'
  if (['partial_failed', 'partial_success'].includes(value)) return 'partial_success'
  if (['needs_review', 'pending_review'].includes(value)) return 'needs_review'
  if (value === 'archived') return 'archived'
  if (value === 'draft' || value === 'pending') return 'pending'
  return 'generating'
}

function getStatusLabel(status = '') {
  if (status === 'completed') return '已完成'
  if (status === 'failed') return '生成失败'
  if (status === 'partial_success') return '部分完成'
  if (status === 'needs_review') return '待检查'
  if (status === 'result_missing') return '结果缺失'
  if (status === 'cancelled') return '已取消'
  if (status === 'archived') return '已归档'
  if (status === 'pending') return '等待处理'
  if (status === 'uploading') return '素材上传中'
  return '生成中'
}

function getTimeValue(task = {}) {
  return task.completedAt || task.completed_at || task.updatedAt || task.updated_at || task.createdAt || task.created_at || task.submittedAt || task.timestamp || ''
}

function getTimeStamp(value = '') {
  const timestamp = value ? new Date(value).getTime() : 0
  return Number.isFinite(timestamp) ? timestamp : 0
}

function formatTime(value = '') {
  const date = value ? new Date(value) : null
  if (!date || !Number.isFinite(date.getTime())) return '刚刚'
  const now = new Date()
  const pad = (number) => String(number).padStart(2, '0')
  const targetDay = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const clock = `${pad(date.getHours())}:${pad(date.getMinutes())}`
  if (targetDay === today) return `今天 ${clock}`
  if (targetDay === today - 86400000) return `昨天 ${clock}`
  if (date.getFullYear() === now.getFullYear()) return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${clock}`
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function getTypeSource(task = {}, production = {}) {
  const params = getTaskParams(task)
  const promptPlan = params.promptPlan || task.promptPlan || {}
  return [
    task.taskType,
    task.type,
    task.toolType,
    task.entryScene,
    task.outputType,
    params.itemType,
    params.itemDisplayName,
    params.actionType,
    params.toolType,
    params.taskType,
    params.entryScene,
    params.outputType,
    params.outputUsage,
    promptPlan.outputUsage,
    production.planType,
    production.entryType
  ].filter(Boolean).join(' ').toLowerCase()
}

function getWorkType(task = {}, production = {}, entry = {}) {
  if (entry.mediaType === WORK_TYPE.VIDEO) return WORK_TYPE.VIDEO
  const typeSource = `${getTypeSource(task, production)} ${toText(entry.itemType)}`.toLowerCase()
  return DESIGN_TYPE_PATTERN.test(typeSource) ? WORK_TYPE.DESIGN : WORK_TYPE.IMAGE
}

function getHumanLabel(value = '') {
  const label = toText(value)
  if (!label || /^[a-z0-9_-]+$/i.test(label)) return ''
  return label
}

function getWorkTitle(task = {}, production = {}, entry = {}) {
  const params = getTaskParams(task)
  const itemType = toText(entry.itemType || params.itemType)
  const source = `${getTypeSource(task, production)} ${itemType}`.toLowerCase()
  const matched = ACTION_LABEL_RULES.find((rule) => rule.pattern.test(source))
  return getHumanLabel(entry.displayName) ||
    getHumanLabel(params.itemDisplayName) ||
    ITEM_TYPE_LABELS[itemType] ||
    (matched && matched.label) ||
    'AI生成作品'
}

function getPlanName(task = {}, production = {}) {
  const params = getTaskParams(task)
  const promptPlan = params.promptPlan || task.promptPlan || {}
  return toText(
    task.planName ||
    params.planName ||
    production.planName ||
    promptPlan.planName ||
    promptPlan.title ||
    params.outputUsage ||
    '快速生成方案'
  )
}

function buildProductionIndex(productions = []) {
  const byTaskId = {}
  ;(Array.isArray(productions) ? productions : []).forEach((production) => {
    ;(Array.isArray(production.taskIds) ? production.taskIds : []).forEach((taskId) => {
      if (taskId && !byTaskId[taskId]) byTaskId[taskId] = production
    })
  })
  return byTaskId
}

function normalizeWorkRecord(record = {}, task = {}, production = {}, preferences = null) {
  const taskId = toText(record.taskId || getTaskId(task))
  if (!taskId || !record.workId) return null
  const completedAt = record.completedAt || task.completedAt || task.completed_at || production.completedAt || ''
  const createdAt = record.createdAt || task.createdAt || task.created_at || task.submittedAt || production.createdAt || ''
  const updatedAt = record.updatedAt || getTimeValue(task) || createdAt
  const timeValue = updatedAt || completedAt || createdAt
  const sourceUrl = record.sourceUrl || getSourceUrl(task)
  const allPreferences = preferences || readWorkPreferences()
  const taskPreference = allPreferences[taskId] || {}
  const preference = { ...taskPreference, ...(allPreferences[record.workId] || {}) }
  const entries = taskId && Object.keys(task || {}).length
    ? getResultEntries(task, production)
    : normalizeWorkResultItems(record.resultItems, record.assetIds).map((item, index) => ({
        workId: `${record.workId}_${index + 1}`,
        assetId: toText(item.assetId),
        index,
        url: pickUrl(item),
        mediaType: getItemMediaType(item, task),
        isMock: record.isMock === true,
        isFallback: record.isFallback === true
      }))
  const primaryEntry = entries[0] || null
  const expectedOutputCount = Math.max(1, Number(record.expectedOutputCount) || 1)
  const completedOutputCount = entries.length
  const status = normalizeWorkIntegrityStatus({ ...task, status: record.status || normalizeStatus(task) }, completedOutputCount, expectedOutputCount)
  const linkedCover = Array.isArray(record.assetIds) && record.assetIds.length
    ? [record.coverFileId, record.coverUrl].find((value) => isStableWorkResultUrl(value)) || ''
    : ''
  const resultPreviewUrl = (primaryEntry && primaryEntry.url) || linkedCover
  const canUseSourcePreview = ['pending', 'uploading', 'generating', 'failed', 'cancelled'].includes(status)
  const previewUrl = resultPreviewUrl || (canUseSourcePreview ? sourceUrl : '')
  const mediaType = primaryEntry ? primaryEntry.mediaType : getItemMediaType(record, task)
  const type = mediaType === WORK_TYPE.VIDEO ? WORK_TYPE.VIDEO : getWorkType(task, production, primaryEntry || {})
  const failedOutputCount = Math.max(0, Number(record.failedOutputCount) || 0)
  const error = record.error && typeof record.error === 'object' ? record.error : {}
  return {
    id: record.workId,
    workId: record.workId,
    ownerId: toText(record.ownerId),
    enterpriseId: toText(record.enterpriseId),
    historyId: toText(record.historyId || task.historyId || ((task.input || {}).params || {}).historyId || production.historyId),
    planId: toText(record.planId || ((task.input || {}).params || {}).planId || (task.params || {}).planId || production.planId),
    taskId,
    parentTaskId: toText(record.parentTaskId || task.parentTaskId),
    batchId: toText(record.batchId || task.batchId || task.batch_id || production.batchId),
    projectId: toText(record.projectId || task.projectId || production.projectId),
    assetId: toText(record.assetIds && record.assetIds[0]),
    assetIds: Array.isArray(record.assetIds) ? record.assetIds : [],
    taskType: toText(task.taskType || task.type || record.workType),
    workType: toText(record.workType),
    category: toText(record.category),
    categoryLabel: toText(record.categoryLabel) || getWorkCategoryLabel(record.category),
    title: toText(record.title) || getWorkTitle(task, production, primaryEntry || {}),
    planName: getPlanName(task, production),
    type,
    typeLabel: toText(record.typeLabel) || getWorkTitle(task, production, primaryEntry || {}),
    detailPageId: toText(record.detailPageId || ((task.input || {}).params || {}).detailPageId),
    productId: toText(record.productId || ((task.input || {}).params || {}).productId),
    productProfileVersion: Math.max(0, Number(record.productProfileVersion || ((task.input || {}).params || {}).productProfileVersion) || 0),
    sizeChartId: toText(record.sizeChartId || ((task.input || {}).params || {}).sizeChartId),
    contentSnapshotId: toText(record.contentSnapshotId || ((task.input || {}).params || {}).contentSnapshotId),
    templateName: toText(record.templateName || ((task.input || {}).params || {}).templateName),
    productName: toText(record.productName || ((task.input || {}).params || {}).productName),
    mediaType,
    mediaTypeLabel: TYPE_LABELS[type] || TYPE_LABELS[WORK_TYPE.IMAGE],
    coverUrl: previewUrl,
    coverFileId: toText(record.coverFileId),
    previewUrl,
    sourceUrl,
    resultItems: entries.map((entry) => ({
      assetId: entry.assetId,
      url: entry.url,
      mediaType: entry.mediaType,
      schemeName: entry.schemeName,
      changeSummary: entry.changeSummary
    })),
    usesSourcePreview: !resultPreviewUrl && canUseSourcePreview && Boolean(sourceUrl),
    hasValidResult: Boolean(resultPreviewUrl && completedOutputCount > 0),
    status,
    statusLabel: getStatusLabel(status),
    statusText: toText(record.statusText) || getStatusLabel(status),
    progress: Math.max(0, Math.min(100, Number(record.progress) || 0)),
    expectedOutputCount,
    completedOutputCount,
    failedOutputCount,
    generatingOutputCount: Math.max(0, expectedOutputCount - completedOutputCount - failedOutputCount),
    createdAt,
    updatedAt,
    completedAt,
    timeLabel: formatTime(timeValue),
    sortTime: getTimeStamp(timeValue),
    resultCount: completedOutputCount,
    error: {
      code: toText(error.code),
      message: toText(error.message),
      retryable: error.retryable === true
    },
    canRetry: error.retryable === true || (task.control || {}).canRetry === true,
    isMock: record.isMock === true,
    isExperimental: record.isExperimental === true,
    environment: toText(record.environment),
    provider: toText(record.provider),
    model: toText(record.model),
    resultMode: toText(record.resultMode),
    providerRequestId: toText(record.providerRequestId),
    quotaRecordId: toText(record.quotaRecordId),
    quotaStatus: toText(record.quotaStatus),
    capabilityStatus: toText(record.capabilityStatus),
    resultBadge: toText(record.resultBadge) || (record.isMock === true || record.isExperimental === true ? '不可交付' : '正式结果'),
    deliveryEligible: record.deliveryEligible === true,
    isFallback: record.isFallback === true,
    isFavorite: preference.isFavorite === true,
    isSaved: true,
    isHidden: preference.isHidden === true,
    isUnread: record.unread === true,
    deletedAt: toText(record.deletedAt),
    savedAt: toText(preference.savedAt || createdAt),
    useCount: Math.max(0, Number(preference.useCount) || 0),
    lastUsedAt: toText(preference.lastUsedAt)
  }
}

function aggregateWorkStatus(works = []) {
  const statuses = works.map((work) => work.status)
  if (statuses.every((status) => status === 'completed')) return 'completed'
  if (statuses.every((status) => status === 'failed')) return 'failed'
  if (statuses.some((status) => status === 'needs_review')) return 'needs_review'
  if (statuses.every((status) => status === 'result_missing')) return 'result_missing'
  if (works.some((work) => work.completedOutputCount > 0) || statuses.some((status) => status === 'partial_success')) return 'partial_success'
  if (statuses.some((status) => ['pending', 'uploading', 'generating'].includes(status))) return 'generating'
  if (statuses.every((status) => status === 'cancelled')) return 'cancelled'
  return statuses[0] || 'pending'
}

function groupBatchWorks(works = []) {
  const grouped = new Map()
  const singles = []
  works.forEach((work) => {
    const groupId = toText(work.parentTaskId || work.batchId)
    if (!groupId) {
      singles.push(work)
      return
    }
    if (!grouped.has(groupId)) grouped.set(groupId, [])
    grouped.get(groupId).push(work)
  })
  grouped.forEach((items, groupId) => {
    if (items.length === 1) {
      singles.push(items[0])
      return
    }
    const ordered = [...items].sort((left, right) => left.sortTime - right.sortTime)
    const first = ordered[0]
    const status = aggregateWorkStatus(ordered)
    const expectedOutputCount = ordered.reduce((sum, item) => sum + Math.max(1, Number(item.expectedOutputCount) || 1), 0)
    const completedOutputCount = ordered.reduce((sum, item) => sum + Math.max(0, Number(item.completedOutputCount) || 0), 0)
    const failedOutputCount = ordered.reduce((sum, item) => sum + Math.max(0, Number(item.failedOutputCount) || 0), 0)
    const resultItems = ordered.reduce((list, item) => list.concat(item.resultItems || []), [])
    const category = ordered.every((item) => item.category === first.category) ? first.category : 'product_display'
    singles.push({
      ...first,
      id: `work_group_${groupId}`,
      workId: `work_group_${groupId}`,
      taskId: first.taskId,
      childTaskIds: ordered.map((item) => item.taskId),
      childWorks: ordered,
      parentTaskId: first.parentTaskId || groupId,
      batchId: first.batchId || groupId,
      category,
      categoryLabel: getWorkCategoryLabel(category),
      title: first.planName && first.planName !== '快速生成方案' ? first.planName : `${first.typeLabel}批次`,
      typeLabel: ordered.every((item) => item.typeLabel === first.typeLabel) ? first.typeLabel : '多项生产批次',
      coverUrl: resultItems[0] ? resultItems[0].url : first.coverUrl,
      previewUrl: resultItems[0] ? resultItems[0].url : first.previewUrl,
      resultItems,
      expectedOutputCount,
      completedOutputCount,
      failedOutputCount,
      generatingOutputCount: Math.max(0, expectedOutputCount - completedOutputCount - failedOutputCount),
      status,
      statusLabel: getStatusLabel(status),
      statusText: getStatusLabel(status),
      progress: expectedOutputCount ? Math.round(((completedOutputCount + failedOutputCount) / expectedOutputCount) * 100) : 0,
      canRetry: ordered.some((item) => item.canRetry),
      isMock: ordered.some((item) => item.isMock),
      isFallback: ordered.some((item) => item.isFallback),
      isFavorite: ordered.some((item) => item.isFavorite),
      isUnread: ordered.some((item) => item.isUnread),
      sortTime: Math.max(...ordered.map((item) => item.sortTime || 0)),
      updatedAt: [...ordered].sort((left, right) => right.sortTime - left.sortTime)[0].updatedAt
    })
  })
  return singles
}

function readWorks(options = {}) {
  const identity = getCurrentIdentity()
  if (!identity.available) return []
  const productions = getWorkspaceProductions()
  const productionByTaskId = buildProductionIndex(productions)
  const preferences = readWorkPreferences()
  const tasks = listTasks().filter((task) => canAccessTask(task, identity))
  syncWorkRecordsFromTasks(tasks)
  const taskById = Object.fromEntries(tasks.map((task) => [getTaskId(task), task]))
  const works = groupBatchWorks(getWorkRecordsForCurrentUser({ includeDeleted: options.includeDeleted === true })
    .map((record) => normalizeWorkRecord(record, taskById[record.taskId] || {}, productionByTaskId[record.taskId] || {}, preferences))
    .filter((work) => work && !work.isHidden))
    .sort((left, right) => right.sortTime - left.sortTime)
  return works
}

function normalizePaging(options = {}) {
  return {
    page: Math.max(1, Number(options.page) || 1),
    pageSize: Math.min(WORK_PAGE_SIZE, Math.max(1, Number(options.pageSize) || WORK_PAGE_SIZE)),
    type: toText(options.type || WORK_TYPE.ALL) || WORK_TYPE.ALL,
    status: toText(options.status || 'all') || 'all',
    category: toText(options.category || 'all') || 'all',
    keyword: toText(options.keyword).toLowerCase(),
    sort: toText(options.sort || 'updated_desc') || 'updated_desc',
    quickFilter: toText(options.quickFilter || 'recent') || 'recent'
  }
}

function buildPage(works = [], options = {}) {
  const paging = normalizePaging(options)
  const availableTypes = [WORK_TYPE.IMAGE, WORK_TYPE.VIDEO, WORK_TYPE.DESIGN]
    .filter((type) => works.some((work) => work.type === type))
  const effectiveType = paging.type === WORK_TYPE.ALL || availableTypes.includes(paging.type)
    ? paging.type
    : WORK_TYPE.ALL
  let filtered = effectiveType === WORK_TYPE.ALL
    ? works
    : works.filter((work) => work.type === effectiveType)
  if (paging.status === 'trash') filtered = filtered.filter((work) => Boolean(work.deletedAt))
  else {
    filtered = filtered.filter((work) => !work.deletedAt)
    if (paging.status === 'generating') filtered = filtered.filter((work) => ['pending', 'uploading', 'generating', 'partial_success'].includes(work.status))
    else if (paging.status !== 'all') filtered = filtered.filter((work) => work.status === paging.status)
  }
  if (paging.category !== 'all') filtered = filtered.filter((work) => work.category === paging.category)
  if (paging.keyword) {
    filtered = filtered.filter((work) => [work.title, work.typeLabel, work.categoryLabel, work.planName]
      .some((value) => toText(value).toLowerCase().includes(paging.keyword)))
  }
  if (paging.sort === 'created_asc') filtered.sort((left, right) => getTimeStamp(left.createdAt) - getTimeStamp(right.createdAt))
  else filtered.sort((left, right) => right.sortTime - left.sortTime)
  let visibleWorks = filtered
  if (paging.quickFilter === 'favorite') {
    visibleWorks = filtered.filter((work) => work.isFavorite)
  } else if (paging.quickFilter === 'frequent') {
    visibleWorks = filtered
      .filter((work) => work.useCount > 0)
      .sort((left, right) => right.useCount - left.useCount || right.sortTime - left.sortTime)
  }
  const start = (paging.page - 1) * paging.pageSize
  const items = visibleWorks.slice(start, start + paging.pageSize)
  return {
    items,
    page: paging.page,
    pageSize: paging.pageSize,
    total: visibleWorks.length,
    generatedCount: works.length,
    type: effectiveType,
    availableTypes,
    status: paging.status,
    category: paging.category,
    availableCategories: getAvailableWorkCategories(works),
    hasMore: start + items.length < visibleWorks.length
  }
}

function logWorksPage(result = {}, type = WORK_TYPE.ALL) {
  let development = false
  try {
    development = typeof process !== 'undefined' && ['development', 'dev'].includes(String(process.env && process.env.NODE_ENV || '').toLowerCase())
  } catch (error) {
    development = false
  }
  if (!development || typeof console === 'undefined' || typeof console.info !== 'function') return
  console.info('[works:list]', {
    count: result.items ? result.items.length : 0,
    status: 'loaded',
    type
  })
}

export function getMyWorks(options = {}) {
  const paging = normalizePaging(options)
  const result = buildPage(readWorks({ includeDeleted: paging.status === 'trash' }), paging)
  logWorksPage(result, paging.type)
  return result
}

export function getWorksByType(type = WORK_TYPE.ALL, options = {}) {
  return getMyWorks({ ...options, type })
}

export function getWorksByTaskIds(taskIds = []) {
  const selectedIds = new Set((Array.isArray(taskIds) ? taskIds : [])
    .map((taskId) => toText(taskId))
    .filter(Boolean))
  if (!selectedIds.size) return []
  return readWorks().filter((work) => selectedIds.has(work.taskId))
}

export function markWorkResultUnavailable(taskId = '', message = '') {
  const normalizedTaskId = toText(taskId)
  if (!normalizedTaskId) return null
  const task = listTasks().find((item) => getTaskId(item) === normalizedTaskId)
  if (!task) return null
  return patchTask(normalizedTaskId, {
    status: 'result_missing',
    stage: 'result_missing',
    statusText: '生成结果未保存，请检查或重试',
    resultAccessInvalid: true,
    completedAt: '',
    error: {
      type: 'result_access',
      code: 'RESULT_FILE_UNAVAILABLE',
      message: toText(message) || '生成结果文件暂时无法访问',
      retryable: true
    },
    control: {
      ...(task.control || {}),
      canRetry: true,
      canContinuePolling: false,
      lastTaskId: normalizedTaskId
    }
  })
}

export function getWorkDetail(id = '') {
  const workId = toText(id)
  if (!workId) return null
  const identity = getCurrentIdentity()
  if (!identity.available) return null
  const visibleWork = readWorks().find((work) => work.id === workId || work.workId === workId || work.taskId === workId)
  if (!visibleWork) return null
  if (Array.isArray(visibleWork.childTaskIds) && visibleWork.childTaskIds.length > 1) {
    const childTasks = listTasks().filter((task) => visibleWork.childTaskIds.includes(getTaskId(task)))
    const firstTask = childTasks[0] || {}
    if (Object.keys(firstTask).length && !canAccessTask(firstTask, identity)) return null
    const params = getTaskParams(firstTask)
    const result = firstTask.result || {}
    return {
      ...visibleWork,
      sourceImage: visibleWork.sourceUrl || getSourceUrl(firstTask),
      params,
      inputAssetSummary: getInputAssetSummary(firstTask, params),
      provider: toText(firstTask.provider || result.provider || ((result.meta || {}).provider)),
      modelVersion: toText(firstTask.modelVersion || params.modelVersion || result.modelVersion || ((result.meta || {}).modelVersion)),
      quotaConsumed: ''
    }
  }
  const productions = getWorkspaceProductions()
  const productionByTaskId = buildProductionIndex(productions)
  const tasks = listTasks()
  const task = tasks.find((item) => getTaskId(item) === visibleWork.taskId)
  if (!task) return visibleWork
  if (!canAccessTask(task, identity)) return null
  const record = getWorkRecordByTaskId(visibleWork.taskId)
  const normalized = record
    ? normalizeWorkRecord(record, task, productionByTaskId[getTaskId(task)] || {}, readWorkPreferences())
    : visibleWork
  if (!normalized || normalized.isHidden) return null
  const params = getTaskParams(task)
  const result = task.result || {}
  const detailEntries = getResultEntries(task, productionByTaskId[getTaskId(task)] || {})
  const costValues = [task.quotaConsumed, task.pointsConsumed, result.quotaConsumed, result.pointsConsumed]
  const quotaConsumed = costValues.find((value) => value !== undefined && value !== null && value !== '')
  return {
    ...normalized,
    sourceImage: getSourceUrl(task),
    resultItems: detailEntries.length
      ? detailEntries.map((entry) => ({
          assetId: entry.assetId,
          url: entry.url,
          mediaType: entry.mediaType,
          schemeName: entry.schemeName,
          changeSummary: entry.changeSummary
        }))
      : normalized.resultItems,
    params,
    inputAssetSummary: getInputAssetSummary(task, params),
    provider: toText(task.provider || result.provider || ((result.meta || {}).provider)),
    modelVersion: toText(task.modelVersion || params.modelVersion || result.modelVersion || ((result.meta || {}).modelVersion)),
    quotaConsumed: quotaConsumed === undefined ? '' : quotaConsumed
  }
}

export function setWorkFavorite(id = '', favorite = true) {
  const workId = toText(id)
  if (!workId) return null
  const work = getWorkDetail(workId)
  if (!work) return null
  const preferences = readWorkPreferences()
  const targetIds = Array.isArray(work.childWorks) && work.childWorks.length
    ? work.childWorks.map((item) => item.id)
    : [workId]
  targetIds.forEach((targetId) => {
    const current = preferences[targetId] || {}
    preferences[targetId] = { ...current, isFavorite: favorite === true }
  })
  if (!writeWorkPreferences(preferences)) return null
  return getWorkDetail(workId)
}

export function setWorkSaved(id = '', saved = true) {
  const workId = toText(id)
  if (!workId) return null
  const work = getWorkDetail(workId)
  if (!work) return null
  const preferences = readWorkPreferences()
  const current = preferences[workId] || {}
  preferences[workId] = {
    ...current,
    taskId: work.taskId,
    historyId: toText(work.historyId),
    assetId: toText(work.assetId),
    isSaved: true,
    savedAt: current.savedAt || new Date().toISOString()
  }
  if (!writeWorkPreferences(preferences)) return null
  return getWorkDetail(workId)
}

export function markWorkUsed(id = '') {
  const workId = toText(id)
  if (!workId) return null
  if (!getWorkDetail(workId)) return null
  const preferences = readWorkPreferences()
  const current = preferences[workId] || {}
  preferences[workId] = {
    ...current,
    useCount: Math.max(0, Number(current.useCount) || 0) + 1,
    lastUsedAt: new Date().toISOString()
  }
  writeWorkPreferences(preferences)
  return getWorkDetail(workId)
}

export function removeWorkLocalReference(id = '') {
  const workId = toText(id)
  if (!workId) return false
  const work = getWorkDetail(workId)
  if (!work) return false
  const targets = Array.isArray(work.childWorks) && work.childWorks.length ? work.childWorks : [work]
  if (targets.some((item) => item.projectId || ['pending', 'uploading', 'generating'].includes(item.status))) return false
  return targets.every((item) => Boolean(moveWorkRecordToTrash(item.taskId)))
}

export function restoreWorkLocalReference(id = '') {
  const workId = toText(id)
  if (!workId) return false
  const records = getWorkRecordsForCurrentUser({ includeDeleted: true })
  if (workId.startsWith('work_group_')) {
    const groupId = workId.slice('work_group_'.length)
    const targets = records.filter((item) => item.parentTaskId === groupId || item.batchId === groupId)
    return targets.length > 0 && targets.every((item) => Boolean(restoreWorkRecord(item.taskId)))
  }
  const record = records.find((item) => item.workId === workId)
  return Boolean(record && restoreWorkRecord(record.taskId))
}

export function markWorkRead(id = '') {
  const work = getWorkDetail(id)
  if (!work) return false
  const targets = Array.isArray(work.childWorks) && work.childWorks.length ? work.childWorks : [work]
  return targets.every((item) => Boolean(markWorkRecordRead(item.taskId)))
}

export function regenerateWork(id = '') {
  const work = getWorkDetail(id)
  if (!work || !work.taskId) return null
  const sourceTask = listTasks().find((task) => getTaskId(task) === work.taskId)
  if (!sourceTask) return null
  markWorkUsed(work.id)
  const sourceInput = sourceTask.input || {}
  const sourceParams = sourceInput.params || {}
  const taskParams = sourceTask.params || {}
  const identity = getCurrentIdentity()
  const history = createWorkspacePlanHistory({
    planId: sourceParams.planId || taskParams.planId || 'repeat_generation',
    userId: identity.userId || ''
  })
  try {
    const nextTask = createGenerationTaskAndRun({
      type: sourceTask.type || sourceTask.taskType,
      taskType: sourceTask.taskType || sourceTask.type,
      taskSource: sourceTask.taskSource || sourceTask.source,
      projectId: sourceTask.projectId || '',
      channel: sourceTask.channel || '',
      input: {
        ...sourceInput,
        assets: { ...(sourceInput.assets || {}) },
        params: {
          ...sourceParams,
          sourceHistoryId: work.historyId || sourceParams.historyId || '',
          historyId: history.historyId,
          batchId: ''
        },
        options: { ...(sourceInput.options || {}) }
      },
      params: {
        ...taskParams,
        sourceHistoryId: work.historyId || taskParams.historyId || '',
        historyId: history.historyId,
        batchId: ''
      }
    })
    if (nextTask && nextTask.taskId) linkWorkspacePlanTasks(history.historyId, [nextTask.taskId])
    return nextTask
  } catch (error) {
    failWorkspacePlanHistory(history.historyId)
    throw error
  }
}

export { WORK_TYPE }
