import { getCurrentEnterpriseId } from '../tenant/tenantContext'
import { getCurrentUser } from '../user/userRepository'

export const DETAIL_PAGE_STORAGE_KEY = 'diebiandesign_detail_pages_v1'
export const DETAIL_PAGE_VERSION_STORAGE_KEY = 'diebiandesign_detail_page_versions_v1'

function text(value = '') {
  return String(value || '').trim()
}

function nowIso() {
  return new Date().toISOString()
}

function createId(prefix = 'detail') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
}

function readList(key) {
  try {
    const value = uni.getStorageSync(key)
    return Array.isArray(value) ? value : []
  } catch (error) {
    return []
  }
}

function writeList(key, value) {
  uni.setStorageSync(key, Array.isArray(value) ? value : [])
}

function clone(value, fallback) {
  try {
    return JSON.parse(JSON.stringify(value))
  } catch (error) {
    return fallback
  }
}

function currentScope() {
  const user = getCurrentUser()
  return {
    ownerId: text(user.userId || user.openId || user.openid),
    enterpriseId: text(user.enterpriseId) || text(getCurrentEnterpriseId())
  }
}

function belongsToCurrentScope(record = {}) {
  const scope = currentScope()
  return Boolean(scope.ownerId && record.ownerId === scope.ownerId && record.enterpriseId === scope.enterpriseId)
}

function normalizeModules(modules = []) {
  return (Array.isArray(modules) ? modules : []).map((module, index) => ({
    moduleId: text(module.moduleId || module.id),
    moduleType: text(module.moduleType || module.kind),
    title: text(module.title),
    subtitle: text(module.subtitle || module.description),
    content: text(module.content || module.text),
    assetIds: Array.from(new Set(Array.isArray(module.assetIds) ? module.assetIds.map(text).filter(Boolean) : [text(module.assetId)].filter(Boolean))),
    layout: { ...(module.layout || {}) },
    visible: module.visible !== false,
    sortOrder: Number(module.sortOrder ?? module.order ?? index) || 0,
    dataSource: text(module.dataSource || module.imageSource) || 'manual_upload',
    confirmedByUser: module.confirmedByUser === true || module.sourceConfirmed === true
  }))
}

function normalizeDetailPage(input = {}, previous = {}) {
  const scope = currentScope()
  const now = nowIso()
  return {
    detailPageId: text(previous.detailPageId || input.detailPageId) || createId('detail_page'),
    workId: text(input.workId || previous.workId),
    taskId: text(input.taskId || previous.taskId),
    ownerId: scope.ownerId,
    enterpriseId: scope.enterpriseId,
    projectId: text(input.projectId || previous.projectId),
    productId: text(input.productId || previous.productId),
    productProfileVersion: Math.max(0, Number(input.productProfileVersion ?? previous.productProfileVersion) || 0),
    sizeChartId: text(input.sizeChartId || previous.sizeChartId),
    contentSnapshotId: text(input.contentSnapshotId || previous.contentSnapshotId),
    productProfileSnapshot: clone(input.productProfileSnapshot || previous.productProfileSnapshot || null, null),
    templateId: text(input.templateId) || 'simple_ecommerce',
    templateVersion: text(input.templateVersion) || '1.0.0',
    platform: text(input.platform || input.platformId) || 'taobao',
    width: Math.max(320, Number(input.width) || 750),
    modules: normalizeModules(input.modules || input.contentSnapshot),
    contentVersion: Math.max(0, Number(input.contentVersion ?? previous.contentVersion) || 0),
    assetClassifications: (Array.isArray(input.assetClassifications) ? input.assetClassifications : previous.assetClassifications || []).map((item) => ({ ...item })),
    productFacts: (Array.isArray(input.productFacts) ? input.productFacts : previous.productFacts || []).map((item) => ({ ...item })),
    generatedCopy: (Array.isArray(input.generatedCopy) ? input.generatedCopy : previous.generatedCopy || []).map((item) => ({ ...item, sourceFieldIds: [...(item.sourceFieldIds || [])] })),
    confirmationStatus: text(input.confirmationStatus || previous.confirmationStatus) || 'not_organized',
    unresolvedFields: (Array.isArray(input.unresolvedFields) ? input.unresolvedFields : previous.unresolvedFields || []).map((item) => ({ ...item })),
    contentVersions: (Array.isArray(input.contentVersions) ? input.contentVersions : previous.contentVersions || []).map((item) => ({ ...item })),
    sizeChartSnapshot: {
      ...((input.sizeChartSnapshot || previous.sizeChartSnapshot) || {}),
      rows: Array.isArray((input.sizeChartSnapshot || {}).rows)
        ? input.sizeChartSnapshot.rows.map((row) => ({ ...row }))
        : (((previous.sizeChartSnapshot || {}).rows || []).map((row) => ({ ...row })))
    },
    sourceAssetIds: Array.from(new Set((Array.isArray(input.sourceAssetIds) ? input.sourceAssetIds : []).map(text).filter(Boolean))),
    status: text(input.status) || text(previous.status) || 'draft',
    renderStatus: text(input.renderStatus || previous.renderStatus) || 'pending',
    renderProgress: Math.max(0, Math.min(100, Number(input.renderProgress ?? previous.renderProgress) || 0)),
    previewUrl: text(input.previewUrl || previous.previewUrl),
    renderedAssetIds: Array.from(new Set((Array.isArray(input.renderedAssetIds) ? input.renderedAssetIds : previous.renderedAssetIds || []).map(text).filter(Boolean))),
    coverAssetId: text(input.coverAssetId || previous.coverAssetId),
    editorSnapshot: clone(input.editorSnapshot || previous.editorSnapshot || {}, {}),
    createdAt: text(previous.createdAt || input.createdAt) || now,
    updatedAt: now
  }
}

export function saveDetailPageDraft(input = {}) {
  const records = readList(DETAIL_PAGE_STORAGE_KEY)
  const requestedId = text(input.detailPageId)
  const previous = requestedId ? records.find((item) => item.detailPageId === requestedId && belongsToCurrentScope(item)) : null
  const record = normalizeDetailPage({ ...input, status: 'draft', renderStatus: 'pending', renderProgress: 0 }, previous || {})
  const others = records.filter((item) => item.detailPageId !== record.detailPageId)
  writeList(DETAIL_PAGE_STORAGE_KEY, [record, ...others])
  return { ...record }
}

export function getDetailPage(detailPageId = '') {
  const id = text(detailPageId)
  if (!id) return null
  const record = readList(DETAIL_PAGE_STORAGE_KEY).find((item) => item.detailPageId === id)
  return record && belongsToCurrentScope(record) ? { ...record } : null
}

export function getDetailPageByTaskId(taskId = '') {
  const id = text(taskId)
  if (!id) return null
  const record = readList(DETAIL_PAGE_STORAGE_KEY).find((item) => item.taskId === id)
  return record && belongsToCurrentScope(record) ? { ...record } : null
}

export function updateDetailPageRenderState(detailPageId = '', patch = {}) {
  const id = text(detailPageId)
  const records = readList(DETAIL_PAGE_STORAGE_KEY)
  const current = records.find((item) => item.detailPageId === id)
  if (!current || !belongsToCurrentScope(current)) return null
  const updatedAt = nowIso()
  const next = normalizeDetailPage({
    ...current,
    ...patch,
    detailPageId: id,
    status: text(patch.status || current.status),
    renderStatus: text(patch.renderStatus || current.renderStatus),
    renderedAssetIds: Array.isArray(patch.renderedAssetIds) ? patch.renderedAssetIds : current.renderedAssetIds,
    updatedAt
  }, current)
  writeList(DETAIL_PAGE_STORAGE_KEY, records.map((item) => item.detailPageId === id ? next : item))
  return { ...next }
}

export function createDetailPageVersion(input = {}) {
  const draft = saveDetailPageDraft(input)
  const versions = readList(DETAIL_PAGE_VERSION_STORAGE_KEY)
  const sequence = versions.filter((item) => item.detailPageId === draft.detailPageId && belongsToCurrentScope(item)).length + 1
  const createdAt = nowIso()
  const version = Object.freeze({
    ...draft,
    detailPageVersionId: createId('detail_page_version'),
    versionNumber: sequence,
    status: 'rendering',
    renderStatus: 'rendering',
    renderProgress: 10,
    renderedAssetIds: [],
    createdAt,
    updatedAt: createdAt
  })
  writeList(DETAIL_PAGE_VERSION_STORAGE_KEY, [version, ...versions])
  const records = readList(DETAIL_PAGE_STORAGE_KEY)
  writeList(DETAIL_PAGE_STORAGE_KEY, records.map((item) => item.detailPageId === draft.detailPageId
    ? { ...item, status: 'rendering', renderStatus: 'rendering', renderProgress: 10, latestVersionId: version.detailPageVersionId, updatedAt: createdAt }
    : item))
  return { ...version }
}

export function completeDetailPageVersion(detailPageVersionId = '', patch = {}) {
  const id = text(detailPageVersionId)
  const versions = readList(DETAIL_PAGE_VERSION_STORAGE_KEY)
  const current = versions.find((item) => item.detailPageVersionId === id)
  if (!current || !belongsToCurrentScope(current)) return null
  const renderedAssetIds = Array.from(new Set((Array.isArray(patch.renderedAssetIds) ? patch.renderedAssetIds : []).map(text).filter(Boolean)))
  if (!renderedAssetIds.length) throw new Error('详情长图尚未保存为稳定资产')
  const updatedAt = nowIso()
  const completed = Object.freeze({
    ...current,
    status: 'completed',
    renderStatus: 'completed',
    renderProgress: 100,
    previewUrl: text(patch.previewUrl),
    renderedAssetIds,
    coverAssetId: text(patch.coverAssetId || renderedAssetIds[0]),
    updatedAt,
    completedAt: updatedAt
  })
  writeList(DETAIL_PAGE_VERSION_STORAGE_KEY, versions.map((item) => item.detailPageVersionId === id ? completed : item))
  const records = readList(DETAIL_PAGE_STORAGE_KEY)
  writeList(DETAIL_PAGE_STORAGE_KEY, records.map((item) => item.detailPageId === current.detailPageId
    ? { ...item, status: 'completed', renderStatus: 'completed', renderProgress: 100, previewUrl: completed.previewUrl, renderedAssetIds, coverAssetId: completed.coverAssetId, latestVersionId: id, updatedAt }
    : item))
  return { ...completed }
}

export function failDetailPageVersion(detailPageVersionId = '', message = '') {
  const id = text(detailPageVersionId)
  const versions = readList(DETAIL_PAGE_VERSION_STORAGE_KEY)
  const current = versions.find((item) => item.detailPageVersionId === id)
  if (!current || !belongsToCurrentScope(current)) return null
  const updatedAt = nowIso()
  const failed = Object.freeze({ ...current, status: 'failed', renderStatus: 'failed', errorMessage: text(message), updatedAt })
  writeList(DETAIL_PAGE_VERSION_STORAGE_KEY, versions.map((item) => item.detailPageVersionId === id ? failed : item))
  const records = readList(DETAIL_PAGE_STORAGE_KEY)
  writeList(DETAIL_PAGE_STORAGE_KEY, records.map((item) => item.detailPageId === current.detailPageId
    ? { ...item, status: 'failed', renderStatus: 'failed', errorMessage: failed.errorMessage, updatedAt }
    : item))
  return { ...failed }
}

export function listDetailPageVersions(detailPageId = '') {
  const id = text(detailPageId)
  return readList(DETAIL_PAGE_VERSION_STORAGE_KEY)
    .filter((item) => item.detailPageId === id && belongsToCurrentScope(item))
    .sort((a, b) => Number(b.versionNumber) - Number(a.versionNumber))
    .map((item) => ({ ...item }))
}

export function repairDetailPageRecords() {
  const records = readList(DETAIL_PAGE_STORAGE_KEY)
  let downgraded = 0
  let coversRestored = 0
  const next = records.map((record) => {
    if (!belongsToCurrentScope(record)) return record
    const renderedAssetIds = Array.isArray(record.renderedAssetIds) ? record.renderedAssetIds.filter(Boolean) : []
    if (record.status === 'completed' && !renderedAssetIds.length) {
      downgraded += 1
      return { ...record, status: 'failed', renderStatus: 'failed', legacyStatus: 'result_missing', errorMessage: '详情长图结果文件缺失，请检查或重新渲染', updatedAt: nowIso() }
    }
    if (renderedAssetIds.length && !record.coverAssetId) {
      coversRestored += 1
      return { ...record, coverAssetId: renderedAssetIds[0], updatedAt: nowIso() }
    }
    return record
  })
  if (downgraded || coversRestored) writeList(DETAIL_PAGE_STORAGE_KEY, next)
  return { scanned: records.filter(belongsToCurrentScope).length, downgraded, coversRestored }
}
