import { get, set } from '../data-provider/dataProvider.js'
import { getUserAssets } from '../asset/assetRepository.js'
import { recordAudit } from '../audit/auditService.js'
import { getCurrentMember } from '../auth/authRepository.js'
import { hasPermission } from '../auth/permissionService.js'
import { getCurrentEnterpriseId } from '../tenant/tenantContext.js'

const ASSET_CENTER_META_KEY = 'diebians_workspace_asset_center_meta_v1'

export const WORKSPACE_ASSET_TYPES = Object.freeze([
  { key: 'all', label: '全部资产' },
  { key: 'ai_image', label: 'AI 出图作品' },
  { key: 'technical_drawing', label: '服装技术图' },
  { key: 'pattern_file', label: '版型文件' },
  { key: 'source_material', label: '原始素材' },
  { key: 'retouched', label: '人工精修稿' },
  { key: 'delivery_file', label: '正式交付文件' },
  { key: 'archived', label: '已归档资产' }
])

export const ASSET_VIEW_MODES = Object.freeze([
  { key: 'grid', label: '网格视图' },
  { key: 'list', label: '列表视图' },
  { key: 'project', label: '项目分组' },
  { key: 'batch', label: '批次分组' },
  { key: 'time', label: '时间分组' }
])

export const ASSET_DETAIL_TABS = Object.freeze([
  { key: 'preview', label: '预览' },
  { key: 'info', label: '基本信息' },
  { key: 'source', label: '来源任务' },
  { key: 'project', label: '关联项目' },
  { key: 'versions', label: '版本历史' },
  { key: 'review', label: '审核记录' },
  { key: 'delivery', label: '交付记录' },
  { key: 'logs', label: '操作日志' }
])

function nowIso() {
  return new Date().toISOString()
}

function currentEnterpriseId() {
  return String(getCurrentEnterpriseId() || 'local_enterprise')
}

function readMeta() {
  const value = get(ASSET_CENTER_META_KEY, [])
  return Array.isArray(value) ? value : []
}

function writeMeta(records = []) {
  set(ASSET_CENTER_META_KEY, Array.isArray(records) ? records : [])
}

function currentMember() {
  return getCurrentMember() || {}
}

function canOperate(permission = '') {
  return hasPermission(permission, { member: currentMember() })
}

function createAudit(action = '', asset = {}, before = {}, after = {}) {
  const member = currentMember()
  recordAudit({
    enterpriseId: currentEnterpriseId(),
    userId: member.userId || member.memberId || '',
    operatorId: member.memberId || member.userId || '',
    operator: member.name || member.role || '当前成员',
    action,
    targetType: 'workspace_asset',
    targetId: asset.assetId || '',
    resourceType: 'workspace_asset',
    resourceId: asset.assetId || '',
    before,
    after,
    createdAt: nowIso()
  })
}

function getTaskResultImageUrl(task = {}) {
  const result = task.result || {}
  const firstItem = Array.isArray(result.items) ? result.items[0] : null
  if (typeof firstItem === 'string') return firstItem
  return task.resultImageUrl ||
    result.imageUrl ||
    result.coverUrl ||
    (typeof result.image === 'string' ? result.image : '') ||
    (result.image && (result.image.url || result.image.fileUrl)) ||
    (firstItem && (firstItem.url || firstItem.imageUrl || firstItem.fileUrl)) ||
    ''
}

function normalizeMeta(record = {}) {
  return {
    enterpriseId: String(record.enterpriseId || currentEnterpriseId()),
    assetId: String(record.assetId || ''),
    archived: Boolean(record.archived),
    tags: Array.isArray(record.tags) ? record.tags : [],
    reviewStatus: String(record.reviewStatus || ''),
    deliveryStatus: String(record.deliveryStatus || ''),
    currentVersionId: String(record.currentVersionId || ''),
    folderName: String(record.folderName || ''),
    logs: Array.isArray(record.logs) ? record.logs : [],
    updatedAt: record.updatedAt || record.createdAt || ''
  }
}

function getMetaMap() {
  const enterpriseId = currentEnterpriseId()
  return new Map(readMeta().map(normalizeMeta).filter((item) => item.enterpriseId === enterpriseId).map((item) => [item.assetId, item]))
}

function saveAssetMeta(assetId = '', patch = {}) {
  const enterpriseId = currentEnterpriseId()
  const records = readMeta().map(normalizeMeta)
  const current = records.find((item) => item.enterpriseId === enterpriseId && item.assetId === assetId) || { enterpriseId, assetId }
  const next = normalizeMeta({
    ...current,
    ...patch,
    updatedAt: nowIso()
  })
  writeMeta([next, ...records.filter((item) => !(item.enterpriseId === enterpriseId && item.assetId === assetId))])
  return next
}

function getProjectName(projectId = '', projects = []) {
  const project = projects.find((item) => item.projectId === projectId || item.id === projectId)
  return project ? (project.name || project.projectName || '未命名项目') : '无所属项目'
}

function createVersion(versionNo = 'V1', source = 'origin', fileUrl = '', createdAt = '') {
  return {
    versionId: `${versionNo}_${source}`,
    versionNo,
    source,
    fileUrl,
    status: source === 'delivery' ? 'delivered' : 'draft',
    createdAt: createdAt || nowIso()
  }
}

function normalizeTaskAsset(task = {}, projects = [], batches = [], meta = {}) {
  const taskId = task.taskId || ''
  const projectId = task.projectId || task.input?.projectId || ''
  const batchId = task.batchId || ''
  const imageUrl = getTaskResultImageUrl(task)
  const status = String(task.status || '').toLowerCase()
  const assetType = imageUrl ? 'ai_image' : 'source_material'
  return {
    assetId: `task_asset_${taskId}`,
    name: task.name || task.taskName || task.type || 'AI 出图作品',
    type: meta.archived ? 'archived' : assetType,
    fileFormat: imageUrl ? 'image' : 'unknown',
    dimensions: task.result?.size || task.params?.ratio || '未记录',
    thumbnail: imageUrl,
    projectId,
    projectName: getProjectName(projectId, projects),
    taskId,
    batchId,
    batchName: batches.find((item) => item.batchId === batchId)?.title || '',
    creatorName: task.creatorName || task.ownerName || '当前用户',
    reviewStatus: meta.reviewStatus || task.reviewStatus || (status === 'success' ? 'not_submitted' : 'pending'),
    deliveryStatus: meta.deliveryStatus || task.deliveryStatus || 'not_delivered',
    generationMode: task.provider || task.result?.provider || 'task_result',
    currentVersion: meta.currentVersionId || 'V1',
    createdAt: task.createdAt || task.completedAt || task.updatedAt || '',
    updatedAt: meta.updatedAt || task.updatedAt || task.completedAt || task.createdAt || '',
    versions: [createVersion('V1', 'ai_result', imageUrl, task.completedAt || task.createdAt)],
    sourceChain: [
      { label: '原始素材', value: task.input?.assets?.clothImage ? '已关联' : '未记录' },
      { label: 'AI任务', value: taskId || '未记录' },
      { label: '生成结果', value: imageUrl ? '已生成' : '暂无结果' },
      { label: '人工修订', value: meta.tags?.includes('retouched') ? '已精修' : '未精修' },
      { label: '审核', value: meta.reviewStatus || task.reviewStatus || '未提交' },
      { label: '正式交付', value: meta.deliveryStatus || task.deliveryStatus || '未交付' }
    ],
    logs: meta.logs || []
  }
}

function normalizePatternAsset(pattern = {}, versions = [], projects = [], meta = {}) {
  const currentVersion = versions.find((item) => item.versionId === pattern.currentVersionId) || versions[0] || {}
  return {
    assetId: `pattern_asset_${pattern.patternMasterId}`,
    name: pattern.title || '版型文件',
    type: meta.archived ? 'archived' : 'pattern_file',
    fileFormat: 'pattern',
    dimensions: pattern.sizeRange || '未记录',
    thumbnail: '',
    projectId: Array.isArray(pattern.linkedProjectIds) ? pattern.linkedProjectIds[0] : '',
    projectName: getProjectName(Array.isArray(pattern.linkedProjectIds) ? pattern.linkedProjectIds[0] : '', projects),
    taskId: currentVersion.taskId || '',
    batchId: '',
    batchName: '',
    creatorName: pattern.creatorName || '版师',
    reviewStatus: meta.reviewStatus || pattern.reviewStatus || currentVersion.reviewStatus || 'draft',
    deliveryStatus: meta.deliveryStatus || 'not_delivered',
    generationMode: pattern.source || 'pattern_library',
    currentVersion: currentVersion.versionNo || 'V1',
    createdAt: pattern.createdAt || currentVersion.createdAt || '',
    updatedAt: meta.updatedAt || pattern.updatedAt || currentVersion.updatedAt || '',
    versions: versions.map((item) => createVersion(item.versionNo || 'V1', item.source || item.status || 'pattern_version', item.fileUrl || '', item.createdAt)),
    sourceChain: [
      { label: '原始素材', value: currentVersion.sourceTaskId || '未记录' },
      { label: 'AI任务', value: currentVersion.taskId || '未记录' },
      { label: '生成结果', value: currentVersion.aiDraft ? 'AI 原稿已保存' : '未记录' },
      { label: '人工修订', value: currentVersion.revisedDraft ? '已修订' : '未修订' },
      { label: '审核', value: pattern.reviewStatus || currentVersion.reviewStatus || '草稿' },
      { label: '正式交付', value: meta.deliveryStatus || '未交付' }
    ],
    logs: meta.logs || []
  }
}

function normalizeDeliveryAsset(delivery = {}, projects = [], meta = {}) {
  return {
    assetId: `delivery_asset_${delivery.deliveryId}`,
    name: delivery.title || '正式交付文件',
    type: meta.archived ? 'archived' : 'delivery_file',
    fileFormat: delivery.fileFormat || 'JPG/PNG',
    dimensions: delivery.sizeSpec || '平台通用尺寸',
    thumbnail: '',
    projectId: delivery.projectId || '',
    projectName: getProjectName(delivery.projectId, projects),
    taskId: Array.isArray(delivery.taskIds) ? delivery.taskIds[0] : '',
    batchId: delivery.batchId || '',
    batchName: '',
    creatorName: delivery.deliverer || '交付人',
    reviewStatus: 'approved',
    deliveryStatus: delivery.status || 'delivered',
    generationMode: 'delivery_package',
    currentVersion: delivery.versionNo || 'V1',
    createdAt: delivery.createdAt || delivery.deliveredAt || '',
    updatedAt: meta.updatedAt || delivery.deliveredAt || delivery.createdAt || '',
    versions: [createVersion(delivery.versionNo || 'V1', 'delivery', '', delivery.createdAt || delivery.deliveredAt)],
    sourceChain: [
      { label: '原始素材', value: '按任务追溯' },
      { label: 'AI任务', value: Array.isArray(delivery.taskIds) ? `${delivery.taskIds.length} 个任务` : '未记录' },
      { label: '生成结果', value: Array.isArray(delivery.assetIds) ? `${delivery.assetIds.length} 个资产` : '已汇总' },
      { label: '人工修订', value: '按版本记录' },
      { label: '审核', value: delivery.reviewer || '已审核' },
      { label: '正式交付', value: delivery.deliveredAt || '已交付' }
    ],
    logs: meta.logs || []
  }
}

export function buildWorkspaceAssets({ tasks = [], projects = [], batches = [], deliveries = [], patternDashboard = {} } = {}) {
  const metaMap = getMetaMap()
  const taskAssets = tasks.map((task) => {
    const assetId = `task_asset_${task.taskId || ''}`
    return normalizeTaskAsset(task, projects, batches, metaMap.get(assetId) || {})
  })
  const userAssets = getUserAssets().clothing.map((asset) => {
    const assetId = `source_${asset.assetId}`
    const meta = metaMap.get(assetId) || {}
    return {
      assetId,
      name: asset.name || '原始素材',
      type: meta.archived ? 'archived' : 'source_material',
      fileFormat: 'image',
      dimensions: '原始尺寸',
      thumbnail: asset.coverUrl || '',
      projectId: '',
      projectName: '无所属项目',
      taskId: asset.sourceId || '',
      batchId: '',
      batchName: '',
      creatorName: '当前用户',
      reviewStatus: meta.reviewStatus || 'not_submitted',
      deliveryStatus: meta.deliveryStatus || 'not_delivered',
      generationMode: 'upload',
      currentVersion: meta.currentVersionId || 'V1',
      createdAt: asset.createdAt || '',
      updatedAt: meta.updatedAt || asset.createdAt || '',
      versions: [createVersion('V1', 'source_material', asset.coverUrl, asset.createdAt)],
      sourceChain: [
        { label: '原始素材', value: '已保存' },
        { label: 'AI任务', value: asset.sourceId || '未关联' },
        { label: '生成结果', value: '未生成' },
        { label: '人工修订', value: '未精修' },
        { label: '审核', value: '未提交' },
        { label: '正式交付', value: '未交付' }
      ],
      logs: meta.logs || []
    }
  })
  const patternAssets = (patternDashboard.masters || []).map((pattern) => {
    const assetId = `pattern_asset_${pattern.patternMasterId}`
    const versions = (patternDashboard.versions || []).filter((item) => item.patternMasterId === pattern.patternMasterId)
    return normalizePatternAsset(pattern, versions, projects, metaMap.get(assetId) || {})
  })
  const deliveryAssets = deliveries.map((delivery) => {
    const assetId = `delivery_asset_${delivery.deliveryId}`
    return normalizeDeliveryAsset(delivery, projects, metaMap.get(assetId) || {})
  })
  return [...taskAssets, ...userAssets, ...patternAssets, ...deliveryAssets]
    .filter((asset) => asset.assetId)
    .sort((left, right) => String(right.updatedAt || right.createdAt || '').localeCompare(String(left.updatedAt || left.createdAt || '')))
}

export function patchWorkspaceAsset(asset = {}, action = '', patch = {}) {
  const before = { reviewStatus: asset.reviewStatus, deliveryStatus: asset.deliveryStatus, type: asset.type, currentVersion: asset.currentVersion }
  const next = saveAssetMeta(asset.assetId, {
    ...patch,
    logs: [{
      action,
      operatorName: currentMember().name || currentMember().role || '当前成员',
      createdAt: nowIso()
    }, ...(asset.logs || [])]
  })
  createAudit(action, asset, before, patch)
  return next
}

export function archiveWorkspaceAsset(asset = {}) {
  if (!canOperate('pattern_library.delete') && !canOperate('project.manage')) {
    return { success: false, errorCode: 'forbidden' }
  }
  patchWorkspaceAsset(asset, '归档资产', { archived: true })
  return { success: true }
}

export function submitWorkspaceAssetReview(asset = {}) {
  patchWorkspaceAsset(asset, '提交审核', { reviewStatus: 'pending' })
  return { success: true }
}

export function addWorkspaceAssetToProject(asset = {}, projectId = '') {
  if (!projectId) return { success: false, errorCode: 'project_required' }
  patchWorkspaceAsset(asset, '加入项目', { projectId })
  return { success: true }
}

export function batchPatchWorkspaceAssets(assets = [], action = '', patch = {}) {
  let success = 0
  let failed = 0
  let skipped = 0
  assets.forEach((asset) => {
    if (!asset || !asset.assetId) {
      failed += 1
      return
    }
    if (asset.deliveryStatus === 'delivered' && ['归档资产', '批量归档'].includes(action)) {
      skipped += 1
      return
    }
    patchWorkspaceAsset(asset, action, patch)
    success += 1
  })
  return { success: true, successCount: success, failedCount: failed, skippedCount: skipped }
}
