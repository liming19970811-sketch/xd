import { createTask, listTasks, patchTask } from '../task/taskLayer'
import { uploadImage } from '../api/upload'
import { getWorkRecordByTaskId } from '../work/workRecordRepository'
import { isLegacyInvalidDetailPageTask, DETAIL_PAGE_TASK_TYPE } from './detailPageContract'
import { completeDetailPageVersion, failDetailPageVersion, updateDetailPageRenderState } from './detailPageRepository'

const activeRenderJobs = new Map()

function nowIso() {
  return new Date().toISOString()
}

export function createDetailPageRenderTask(snapshot = {}, options = {}) {
  const productName = ((snapshot.productFacts || []).find((item) => item.fieldId === 'productName' && item.confirmedByUser) || {}).value || ''
  const templateName = (((snapshot.render || {}).template || {}).name) || ''
  const existing = options.idempotencyKey
    ? listTasks().find((item) => item.clientTaskId === options.idempotencyKey || (((item.input || {}).params || {}).idempotencyKey === options.idempotencyKey))
    : null
  if (existing) {
    const existingWork = getWorkRecordByTaskId(existing.taskId)
    return { ...existing, workId: (existingWork && existingWork.workId) || `work_${existing.taskId}` }
  }
  const task = createTask({
    type: DETAIL_PAGE_TASK_TYPE,
    taskType: DETAIL_PAGE_TASK_TYPE,
    expectedOutputCount: Math.max(1, Number(options.expectedOutputCount) || 1),
    idempotencyKey: options.idempotencyKey,
    clientTaskId: options.idempotencyKey,
    batchId: options.batchId || '',
    projectId: snapshot.projectId || options.projectId || '',
    mock: false,
    provider: 'deterministic_canvas',
    params: {
      workType: 'detail_long_image',
      productName,
      templateName,
      detailPageId: snapshot.detailPageId,
      productId: snapshot.productId,
      productProfileVersion: snapshot.productProfileVersion,
      sizeChartId: snapshot.sizeChartId,
      contentSnapshotId: snapshot.contentSnapshotId,
      skuGroupId: options.skuGroupId || snapshot.skuGroupId || '',
      skuId: options.skuId || snapshot.skuId || '',
      skuCode: options.skuCode || snapshot.skuCode || '',
      colorName: options.colorName || snapshot.colorName || '',
      colorHex: options.colorHex || snapshot.colorHex || '',
      batchId: options.batchId || '',
      idempotencyKey: options.idempotencyKey || ''
    },
    input: {
      assets: {
        baseImage: options.primaryAsset || {},
        sourceImages: options.sourceAssets || []
      },
      params: {
        taskType: DETAIL_PAGE_TASK_TYPE,
        workType: 'detail_long_image',
        detailPageId: snapshot.detailPageId,
        productId: snapshot.productId,
        productProfileVersion: snapshot.productProfileVersion,
        sizeChartId: snapshot.sizeChartId,
        contentSnapshotId: snapshot.contentSnapshotId,
        skuGroupId: options.skuGroupId || snapshot.skuGroupId || '',
        skuId: options.skuId || snapshot.skuId || '',
        skuCode: options.skuCode || snapshot.skuCode || '',
        colorName: options.colorName || snapshot.colorName || '',
        colorHex: options.colorHex || snapshot.colorHex || '',
        batchId: options.batchId || '',
        idempotencyKey: options.idempotencyKey || '',
        productProfileSnapshot: snapshot.productProfileSnapshot,
        detailPageVersionId: options.detailPageVersionId,
        templateId: snapshot.templateId,
        templateVersion: snapshot.templateVersion,
        templateName,
        productName,
        platformId: snapshot.platformId,
        moduleOrder: snapshot.moduleOrder,
        contentSnapshot: snapshot.contentSnapshot,
        sizeChartSnapshot: snapshot.sizeChartSnapshot,
        sourceAssetIds: snapshot.sourceAssetIds,
        contentVersion: snapshot.contentVersion,
        assetClassifications: snapshot.assetClassifications,
        productFacts: snapshot.productFacts,
        generatedCopy: snapshot.generatedCopy,
        confirmationStatus: snapshot.confirmationStatus,
        unresolvedFields: snapshot.unresolvedFields,
        editorSnapshot: snapshot.editorSnapshot,
        renderSnapshot: snapshot.render
      },
      options: {
        outputType: DETAIL_PAGE_TASK_TYPE,
        renderer: 'deterministic_canvas',
        providerCallDisabled: true,
        previewConfirmed: true,
        preserveOriginalGarment: true,
        allowGrid: false
      }
    }
  })
  const running = patchTask(task.taskId, {
    status: 'generating',
    stage: 'template_rendering',
    progress: 15,
    statusText: '正在排版详情长图',
    control: { canRetry: true, canContinuePolling: false }
  })
  const work = getWorkRecordByTaskId(task.taskId)
  updateDetailPageRenderState(snapshot.detailPageId, {
    taskId: task.taskId,
    workId: (work && work.workId) || `work_${task.taskId}`,
    status: 'rendering',
    renderStatus: 'rendering',
    renderProgress: 15
  })
  return { ...running, workId: (work && work.workId) || `work_${task.taskId}` }
}

export async function persistDetailPageSegments(taskId, tempPaths = [], options = {}) {
  const paths = (Array.isArray(tempPaths) ? tempPaths : []).filter(Boolean)
  if (!paths.length) throw new Error('未生成可保存的详情长图')
  const items = []
  for (let index = 0; index < paths.length; index += 1) {
    const result = await uploadImage({
      filePath: paths[index],
      assetType: 'production_image',
      targetType: 'task',
      targetId: taskId,
      relation: 'detail_page_rendered',
      scene: 'detail_page_template_renderer'
    })
    const fileId = result.fileId || ''
    if (!fileId) throw new Error('详情长图未获得稳定文件地址')
    items.push({
      resultId: `${taskId}_detail_page_${index + 1}`,
      assetId: (result.assetRecord && result.assetRecord.fileId) || `asset_${taskId}_${index + 1}`,
      fileId,
      fileUrl: fileId,
      imageUrl: fileId,
      url: fileId,
      type: 'image',
      outputType: DETAIL_PAGE_TASK_TYPE,
      sequence: index + 1,
      title: paths.length > 1 ? `详情长图${index + 1}/${paths.length}` : '详情长图'
    })
    patchTask(taskId, {
      completedOutputCount: items.length,
      progress: Math.min(90, 20 + Math.round((items.length / paths.length) * 70)),
      result: { items: [...items], meta: { renderer: 'deterministic_canvas', direction: 'vertical' } }
    })
    updateDetailPageRenderState(options.detailPageId, {
      status: items.length < paths.length ? 'partial_success' : 'rendering',
      renderStatus: items.length < paths.length ? 'partial_success' : 'rendering',
      renderProgress: Math.min(90, 20 + Math.round((items.length / paths.length) * 70)),
      renderedAssetIds: items.map((item) => item.assetId),
      coverAssetId: items[0].assetId,
      previewUrl: items[0].fileId
    })
  }
  const assetIds = items.map((item) => item.assetId)
  const completedAt = nowIso()
  if (options.detailPageVersionId) {
    completeDetailPageVersion(options.detailPageVersionId, {
      renderedAssetIds: assetIds,
      previewUrl: items[0].fileId,
      coverAssetId: assetIds[0]
    })
  }
  return patchTask(taskId, {
    status: 'completed',
    stage: 'result_ready',
    progress: 100,
    statusText: '详情长图已生成',
    expectedOutputCount: items.length,
    completedOutputCount: items.length,
    failedOutputCount: 0,
    assetIds,
    coverFileId: items[0].fileId,
    input: {
      params: { renderedAssetIds: assetIds }
    },
    completedAt,
    result: {
      items,
      coverUrl: items[0].fileId,
      outputType: DETAIL_PAGE_TASK_TYPE,
      meta: {
        renderer: 'deterministic_canvas',
        direction: 'vertical',
        garmentRedrawn: false,
        autoPersisted: true
      }
    },
    control: { canRetry: false, canContinuePolling: false }
  })
}

export function startDetailPageRenderJob(taskId, tempPaths = [], options = {}) {
  if (!taskId) return Promise.reject(new Error('缺少详情长图任务'))
  if (activeRenderJobs.has(taskId)) return activeRenderJobs.get(taskId)
  const job = persistDetailPageSegments(taskId, tempPaths, options)
    .catch((error) => {
      failDetailPageRenderTask(taskId, error)
      throw error
    })
    .finally(() => activeRenderJobs.delete(taskId))
  activeRenderJobs.set(taskId, job)
  return job
}

export function getActiveDetailPageRenderJob(taskId = '') {
  return activeRenderJobs.get(taskId) || null
}

export function failDetailPageRenderTask(taskId, error) {
  const task = listTasks().find((item) => item.taskId === taskId) || {}
  const versionId = (((task.input || {}).params || {}).detailPageVersionId) || ''
  const detailPageId = (((task.input || {}).params || {}).detailPageId) || ''
  if (versionId) failDetailPageVersion(versionId, (error && error.message) || '详情长图渲染失败')
  if (detailPageId) updateDetailPageRenderState(detailPageId, { status: 'failed', renderStatus: 'failed' })
  return patchTask(taskId, {
    status: 'failed',
    stage: 'render_failed',
    statusText: '详情长图渲染失败',
    error: {
      code: (error && (error.code || error.errorCode)) || 'DETAIL_PAGE_RENDER_FAILED',
      message: (error && error.message) || '详情长图渲染失败',
      retryable: true
    },
    control: { canRetry: true, canContinuePolling: false }
  })
}

export function repairLocalInvalidDetailPageTasks() {
  const tasks = listTasks()
  const detailTasks = tasks.filter((task) => /detail_page|detail_long_image|page_material/i.test(String(task.taskType || task.type || '')))
  const invalid = detailTasks.filter(isLegacyInvalidDetailPageTask)
  let recovered = 0
  let resultMissing = 0
  detailTasks.forEach((task) => {
    if (!['completed', 'success', 'done', 'result_ready'].includes(String(task.status || '').toLowerCase())) return
    const resultItems = Array.isArray((task.result || {}).items) ? task.result.items.filter((item) => item && (item.fileId || item.fileUrl || item.imageUrl || item.url) && item.assetId) : []
    if (resultItems.length) {
      const assetIds = resultItems.map((item) => item.assetId)
      const legacy = isLegacyInvalidDetailPageTask(task)
      const params = ((task.input || {}).params || {})
      const linkedAssets = Array.isArray(task.assetIds) ? task.assetIds : []
      const renderedAssets = Array.isArray(params.renderedAssetIds) ? params.renderedAssetIds : []
      if (!legacy && linkedAssets.length === assetIds.length && renderedAssets.length === assetIds.length && task.coverFileId) return
      patchTask(task.taskId, {
        assetIds,
        coverFileId: resultItems[0].fileId || resultItems[0].fileUrl || resultItems[0].imageUrl || resultItems[0].url,
        completedOutputCount: resultItems.length,
        input: { params: { renderedAssetIds: assetIds } },
        result: {
          ...((task && task.result) || {}),
          items: resultItems,
          meta: {
            ...(((task.result || {}).meta) || {}),
            ...(legacy ? { legacyDetailPage: true, legacyResultLabel: '旧版结果' } : {})
          }
        }
      })
      recovered += 1
      return
    }
    patchTask(task.taskId, {
      status: 'result_missing',
      stage: 'legacy_detail_page_result_missing',
      statusText: '旧版结果缺失，请检查',
      reviewStatus: 'invalid_detail_page',
      quotaReviewRequired: true,
      result: {
        ...((task && task.result) || {}),
        needsReview: true,
        meta: {
          ...(((task && task.result && task.result.meta) || {})),
          invalidReason: isLegacyInvalidDetailPageTask(task) ? 'legacy_generative_detail_page' : 'rendered_assets_missing',
          ...(isLegacyInvalidDetailPageTask(task) ? { legacyDetailPage: true, legacyResultLabel: '旧版结果' } : {})
        }
      }
    })
    resultMissing += 1
  })
  return { scanned: detailTasks.length, invalid: invalid.length, recovered, resultMissing, marked: recovered + resultMissing }
}
