export const GENERATION_STATUSES = Object.freeze({
  PENDING: 'pending',
  UPLOADING: 'uploading',
  GENERATING: 'generating',
  PARTIAL_SUCCESS: 'partial_success',
  NEEDS_REVIEW: 'needs_review',
  RESULT_MISSING: 'result_missing',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled'
})

export const GENERATION_FEATURE_RULES = Object.freeze([
  Object.freeze({ key: 'ai_model', label: 'AI模特', countMode: 'single', pattern: /model_replace|head_replace|face_replace|ai_model/ }),
  Object.freeze({ key: 'clothes_replace', label: '换衣服', countMode: 'single', pattern: /garment_replace|clothes_replace|outfit_replace|virtual_try_on/ }),
  Object.freeze({ key: 'pose_replace', label: '换姿势', countMode: 'single', pattern: /pose_replace|pose_adjust|pose_variation|pose_variant/ }),
  Object.freeze({ key: 'scene_replace', label: '换场景', countMode: 'single', pattern: /scene_replace|replace_scene|scene_change|background_replace/ }),
  Object.freeze({ key: 'color_replace', label: '换颜色', countMode: 'single', pattern: /color_replace|basic_recolor|color_change/ }),
  Object.freeze({ key: 'fabric_replace', label: '换面料', countMode: 'single', pattern: /fabric_replace|fabric_variation/ }),
  Object.freeze({ key: 'pattern_replace', label: '换图案', countMode: 'single', pattern: /pattern_replace|pattern_variation|print_generate/ }),
  Object.freeze({ key: 'style_redesign', label: '改款式', countMode: 'output_count', pattern: /style_redesign|hot_style|micro_redesign|(^|_)refine($|_)/ }),
  Object.freeze({ key: 'flat_detail', label: '平铺细节', countMode: 'single', pattern: /flat_lay|detail_closeup/ }),
  Object.freeze({ key: 'garment_detail', label: '服装细节图', countMode: 'selected_details', pattern: /garment_detail/ }),
  Object.freeze({ key: 'detail_page_long_image', label: '自动排版详情长图', countMode: 'single', pattern: /detail_page_long_image|detail_long_image|detail_page|page_material/ }),
  Object.freeze({ key: 'batch_model', label: '批量模特图', countMode: 'batch_items', pattern: /batch_model|model_batch/ }),
  Object.freeze({ key: 'ai_production_plan', label: 'AI服装生产方案', countMode: 'deliverables', pattern: /production_plan|ai_production|workspace_plan/ })
])

const STATUS_ALIASES = Object.freeze({
  draft: GENERATION_STATUSES.PENDING,
  submitted: GENERATION_STATUSES.GENERATING,
  accepted: GENERATION_STATUSES.GENERATING,
  provider_accepted: GENERATION_STATUSES.GENERATING,
  queued: GENERATION_STATUSES.GENERATING,
  processing: GENERATION_STATUSES.GENERATING,
  running: GENERATION_STATUSES.GENERATING,
  polling: GENERATION_STATUSES.GENERATING,
  success: GENERATION_STATUSES.COMPLETED,
  done: GENERATION_STATUSES.COMPLETED,
  result_ready: GENERATION_STATUSES.COMPLETED,
  partial_failed: GENERATION_STATUSES.PARTIAL_SUCCESS,
  pending_review: GENERATION_STATUSES.NEEDS_REVIEW,
  error: GENERATION_STATUSES.FAILED,
  timeout: GENERATION_STATUSES.FAILED,
  canceled: GENERATION_STATUSES.CANCELLED
})

const TERMINAL_STATUSES = new Set([
  GENERATION_STATUSES.PARTIAL_SUCCESS,
  GENERATION_STATUSES.NEEDS_REVIEW,
  GENERATION_STATUSES.RESULT_MISSING,
  GENERATION_STATUSES.COMPLETED,
  GENERATION_STATUSES.FAILED,
  GENERATION_STATUSES.CANCELLED
])

function positiveInteger(value, fallback = 0) {
  const number = Number(value)
  return Number.isFinite(number) && number > 0 ? Math.floor(number) : fallback
}

function firstPositive(values = [], fallback = 1) {
  for (const value of values) {
    const count = positiveInteger(value)
    if (count) return count
  }
  return fallback
}

export function normalizeGenerationStatus(status = '', fallback = GENERATION_STATUSES.PENDING) {
  const value = String(status || '').trim().toLowerCase()
  if (Object.values(GENERATION_STATUSES).includes(value)) return value
  return STATUS_ALIASES[value] || fallback
}

export function isGenerationTerminalStatus(status = '') {
  return TERMINAL_STATUSES.has(normalizeGenerationStatus(status))
}

export function resolveGenerationFeatureRule(taskType = '') {
  const value = String(taskType || '').trim().toLowerCase()
  return GENERATION_FEATURE_RULES.find((rule) => rule.pattern.test(value)) || null
}

export function resolveExpectedOutputCount(source = {}) {
  const input = source.input || {}
  const params = input.params || source.params || {}
  const options = input.options || source.options || {}
  const selectedDetails = source.selectedDetailTypes || source.selectedDetails || params.selectedDetailTypes || params.selectedDetails
  const deliverables = source.deliverables || params.deliverables
  const batchItems = source.batchImages || source.items || params.batchImages

  if (Array.isArray(deliverables) && deliverables.length) {
    return Math.max(1, deliverables.reduce((sum, item) => sum + positiveInteger(item && item.quantity, 1), 0))
  }
  if (Array.isArray(selectedDetails) && selectedDetails.length) return selectedDetails.length
  if (Array.isArray(batchItems) && batchItems.length) {
    const perItemCount = firstPositive([source.perItemOutputCount, params.perItemOutputCount, options.perItemOutputCount], 1)
    return batchItems.length * perItemCount
  }

  return firstPositive([
    source.expectedOutputCount,
    source.outputCount,
    params.expectedOutputCount,
    params.outputCount,
    options.expectedOutputCount,
    options.outputCount
  ], 1)
}

export function normalizeGenerationTaskOptions(options = {}) {
  const input = options.input || {}
  const params = input.params || options.params || {}
  const inputOptions = input.options || {}
  const parentTaskId = String(params.parentTaskId || options.parentTaskId || '')
  const batchId = String(options.batchId || params.batchId || '')
  const isChildTask = Boolean(parentTaskId || batchId || params.outputIndex || inputOptions.outputIndex)
  const requestedCount = resolveExpectedOutputCount(options)
  const expectedOutputCount = isChildTask ? 1 : requestedCount
  const parentExpectedOutputCount = isChildTask
    ? firstPositive([params.parentExpectedOutputCount, inputOptions.parentExpectedOutputCount, requestedCount], 1)
    : expectedOutputCount
  const idempotencyKey = String(
    options.idempotencyKey ||
    options.clientTaskId ||
    params.idempotencyKey ||
    params.clientRequestId ||
    ''
  )

  return {
    ...options,
    clientTaskId: options.clientTaskId || idempotencyKey,
    expectedOutputCount,
    outputCount: expectedOutputCount,
    input: {
      ...input,
      params: {
        ...params,
        expectedOutputCount,
        outputCount: expectedOutputCount,
        parentExpectedOutputCount,
        ...(idempotencyKey ? { idempotencyKey, clientRequestId: idempotencyKey } : {})
      },
      options: {
        ...inputOptions,
        expectedOutputCount,
        outputCount: expectedOutputCount,
        parentExpectedOutputCount
      }
    },
    params: {
      ...(options.params || {}),
      expectedOutputCount,
      outputCount: expectedOutputCount,
      parentExpectedOutputCount,
      ...(idempotencyKey ? { idempotencyKey, clientRequestId: idempotencyKey } : {})
    }
  }
}

export function aggregateGenerationResults(items = [], expectedOutputCount = 1) {
  const list = Array.isArray(items) ? items : []
  const expected = Math.max(1, positiveInteger(expectedOutputCount, list.length || 1))
  const completedOutputCount = list.filter((item) => normalizeGenerationStatus(item && item.status) === GENERATION_STATUSES.COMPLETED).length
  const failedOutputCount = list.filter((item) => {
    const status = normalizeGenerationStatus(item && item.status)
    return status === GENERATION_STATUSES.FAILED || status === GENERATION_STATUSES.RESULT_MISSING
  }).length
  const terminalCount = list.filter((item) => isGenerationTerminalStatus(item && item.status)).length
  let status = list.length ? GENERATION_STATUSES.GENERATING : GENERATION_STATUSES.PENDING

  if (completedOutputCount >= expected) status = GENERATION_STATUSES.COMPLETED
  else if (terminalCount >= expected && completedOutputCount === 0) status = GENERATION_STATUSES.FAILED
  else if (completedOutputCount > 0 && (terminalCount >= expected || failedOutputCount > 0)) status = GENERATION_STATUSES.PARTIAL_SUCCESS

  return {
    expectedOutputCount: expected,
    completedOutputCount,
    failedOutputCount,
    generatingOutputCount: Math.max(0, expected - terminalCount),
    status
  }
}

export { STATUS_ALIASES as GENERATION_STATUS_ALIASES }
