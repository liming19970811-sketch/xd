import { aggregateGenerationResults } from './generationContract'

const FORBIDDEN_COMPOSITE_LAYOUT = /(collage|contact\s*sheet|nine[-_\s]*panel|multi[-_\s]*panel|moodboard|九宫格|多宫格|拼图|拼贴)/i

function text(value = '') {
  return String(value || '').trim()
}

function positiveInteger(value, fallback = 1) {
  const number = Number(value)
  return Number.isFinite(number) && number > 0 ? Math.floor(number) : fallback
}

function stableHash(value = '') {
  let hash = 5381
  const source = text(value)
  for (let index = 0; index < source.length; index += 1) {
    hash = ((hash << 5) + hash) ^ source.charCodeAt(index)
  }
  return (hash >>> 0).toString(36)
}

export function normalizeDeliverable(item = {}, index = 0) {
  const deliverableId = text(item.deliverableId)
  const outputType = text(item.outputType || item.itemType)
  const title = text(item.title || item.name)
  return {
    deliverableId,
    outputType,
    title,
    quantity: positiveInteger(item.quantity, 0),
    ratio: text(item.ratio || '1:1'),
    scene: text(item.scene),
    purpose: text(item.purpose),
    prompt: text(item.prompt || item.promptDraft),
    status: text(item.status || 'pending'),
    taskType: text(item.taskType || item.actionType),
    actionType: text(item.actionType || item.taskType),
    toolType: text(item.toolType),
    itemType: text(item.itemType || outputType || `deliverable_${index + 1}`),
    quotaAction: text(item.quotaAction),
    unitCost: Math.max(0, Number(item.unitCost) || 0),
    params: item.params && typeof item.params === 'object' ? { ...item.params } : {}
  }
}

export function validateDeliverables(items = []) {
  const deliverables = (Array.isArray(items) ? items : []).map(normalizeDeliverable)
  if (!deliverables.length) return { ok: false, code: 'DELIVERABLES_REQUIRED', message: 'AI方案缺少交付清单', deliverables: [] }
  const ids = new Set()
  for (const item of deliverables) {
    if (!item.deliverableId || !item.outputType || !item.title || !item.quantity || !item.taskType || !item.prompt) {
      return { ok: false, code: 'DELIVERABLE_INCOMPLETE', message: `请先补全“${item.title || '未命名交付项'}”的类型、数量和生成要求`, deliverables }
    }
    if (FORBIDDEN_COMPOSITE_LAYOUT.test(item.prompt)) {
      return { ok: false, code: 'COMPOSITE_LAYOUT_FORBIDDEN', message: `“${item.title}”必须输出独立文件，不能使用拼图或宫格`, deliverables }
    }
    if (ids.has(item.deliverableId)) return { ok: false, code: 'DELIVERABLE_ID_DUPLICATED', message: '交付项目编号重复', deliverables }
    ids.add(item.deliverableId)
  }
  return { ok: true, code: '', message: '', deliverables }
}

export function getExpectedOutputCount(items = []) {
  return (Array.isArray(items) ? items : []).reduce((sum, item) => sum + positiveInteger(item.quantity, 0), 0)
}

export function getEstimatedQuotaCost(items = []) {
  return (Array.isArray(items) ? items : []).reduce((sum, item) => (
    sum + positiveInteger(item.quantity, 0) * Math.max(0, Number(item.unitCost) || 0)
  ), 0)
}

export function expandDeliverables(items = [], submissionKey = '') {
  const validation = validateDeliverables(items)
  if (!validation.ok) {
    const error = new Error(validation.message)
    error.code = validation.code
    throw error
  }
  const expectedOutputCount = getExpectedOutputCount(validation.deliverables)
  let outputIndex = 0
  return validation.deliverables.flatMap((deliverable) => (
    Array.from({ length: deliverable.quantity }, (_, sequenceIndex) => {
      outputIndex += 1
      const sequence = sequenceIndex + 1
      const idempotencyKey = `${text(submissionKey)}:${deliverable.deliverableId}:${sequence}`
      return {
        ...deliverable,
        sequence,
        outputIndex,
        outputCount: 1,
        expectedOutputCount,
        idempotencyKey,
        clientRequestId: idempotencyKey
      }
    })
  ))
}

export function createMultiResultExecution(options = {}) {
  const submissionKey = text(options.submissionKey)
  if (!submissionKey) throw Object.assign(new Error('MULTI_RESULT_SUBMISSION_KEY_REQUIRED'), { code: 'MULTI_RESULT_SUBMISSION_KEY_REQUIRED' })
  if (typeof options.buildTaskOptions !== 'function' || typeof options.createBatch !== 'function') {
    throw Object.assign(new Error('MULTI_RESULT_EXECUTOR_DEPENDENCY_REQUIRED'), { code: 'MULTI_RESULT_EXECUTOR_DEPENDENCY_REQUIRED' })
  }
  const slots = expandDeliverables(options.deliverables, submissionKey)
  const hash = stableHash(submissionKey)
  const productionId = text(options.productionId || `production_${hash}`)
  const batchId = text(options.batchId || `batch_${hash}`)
  const planId = text(options.planId)
  const projectId = text(options.projectId)
  const children = slots.map((slot) => {
    const base = options.buildTaskOptions(slot) || {}
    const baseInput = base.input || {}
      const params = {
      ...((baseInput && baseInput.params) || {}),
      ...(base.params || {}),
      productionId,
      parentTaskId: productionId,
      batchId,
      planId,
      projectId,
      deliverableId: slot.deliverableId,
      outputType: slot.outputType,
      outputIndex: slot.outputIndex,
      sequence: slot.sequence,
      quantity: slot.quantity,
      outputCount: 1,
      expectedOutputCount: 1,
      parentExpectedOutputCount: slot.expectedOutputCount,
      clientRequestId: slot.clientRequestId,
      idempotencyKey: slot.idempotencyKey
    }
    return {
      ...base,
      type: base.type || slot.taskType,
      clientTaskId: slot.clientRequestId,
      batchId,
      projectId,
      input: {
        ...baseInput,
        params,
        options: {
          ...(baseInput.options || {}),
          outputCount: 1,
          expectedOutputCount: 1,
          parentExpectedOutputCount: slot.expectedOutputCount,
          outputIndex: slot.outputIndex
        }
      },
      params
    }
  })
  const batch = options.createBatch({
    batchId,
    batchConfig: { modelCount: slots.length, colorCount: 1, sceneCount: 1 },
    children,
    metadata: {
      productionId,
      planId,
      projectId,
      expectedOutputCount: slots.length,
      deliverables: slots.map((slot) => ({
        deliverableId: slot.deliverableId,
        outputType: slot.outputType,
        title: slot.title,
        sequence: slot.sequence,
        status: 'pending'
      }))
    }
  })
  return {
    productionId,
    batchId,
    planId,
    projectId,
    submissionKey,
    expectedOutputCount: slots.length,
    completedOutputCount: 0,
    failedOutputCount: 0,
    childTaskIds: [...(batch.taskIds || [])],
    status: 'generating',
    slots,
    children,
    batch
  }
}

export function aggregateMultiResultStatus(items = []) {
  const list = Array.isArray(items) ? items : []
  return aggregateGenerationResults(list, list.length || 1)
}
