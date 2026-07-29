export const ORIGINAL_PROTECTION_PACKAGE_VERSION = '1.0.0'

export const ORIGINAL_PROTECTION_PACKAGE_TYPE = 'original_protection_package'

export const ORIGINAL_PROTECTION_PACKAGE_STATUS = {
  DRAFT: 'draft',
  GENERATED: 'generated',
  DELIVERED: 'delivered',
  ARCHIVED: 'archived'
}

export const ORIGINAL_PROTECTION_BLOCK_REASONS = {
  MISSING_TASK: 'missing_task',
  MOCK_RESULT: 'mock_result',
  FALLBACK_RESULT: 'fallback_result',
  MOCK_PROVIDER: 'mock_provider',
  NOT_APPROVED: 'not_approved',
  MISSING_RESULT_IMAGE: 'missing_result_image'
}

export const ORIGINAL_PROTECTION_BLOCK_REASON_TEXT = {
  [ORIGINAL_PROTECTION_BLOCK_REASONS.MISSING_TASK]: '任务不存在',
  [ORIGINAL_PROTECTION_BLOCK_REASONS.MOCK_RESULT]: '占位/mock 结果不可生成原创保护材料包',
  [ORIGINAL_PROTECTION_BLOCK_REASONS.FALLBACK_RESULT]: 'fallback 结果不可生成原创保护材料包',
  [ORIGINAL_PROTECTION_BLOCK_REASONS.MOCK_PROVIDER]: 'mock provider 结果不可生成原创保护材料包',
  [ORIGINAL_PROTECTION_BLOCK_REASONS.NOT_APPROVED]: '任务尚未审核通过',
  [ORIGINAL_PROTECTION_BLOCK_REASONS.MISSING_RESULT_IMAGE]: '缺少最终交付图'
}

function getTaskIdentity(task = {}) {
  return task.taskId || task.id || task.clientTaskId || ''
}

function createPackageId() {
  return `opp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

function getFirstResultItem(task = {}) {
  const items = task.result && Array.isArray(task.result.items) ? task.result.items : []
  return items[0] || {}
}

export function getTaskResultImageUrl(task = {}) {
  const firstItem = getFirstResultItem(task)
  return (
    task.resultImageUrl ||
    task.result_image_url ||
    task.imageUrl ||
    task.image_url ||
    (task.result && task.result.coverUrl) ||
    (task.result && task.result.imageUrl) ||
    (task.result && task.result.image_url) ||
    firstItem.imageUrl ||
    firstItem.url ||
    ''
  )
}

export function isMockOrFallbackTask(task = {}) {
  const taskId = getTaskIdentity(task)
  const result = task.result || {}
  const data = task.data || {}
  return !!(
    task.mock === true ||
    task.fallback === true ||
    task.provider === 'mock' ||
    result.mock === true ||
    result.fallback === true ||
    result.provider === 'mock' ||
    data.mock === true ||
    data.fallback === true ||
    data.provider === 'mock' ||
    /^mock_generate_/.test(String(taskId || '')) ||
    task.fallbackReason ||
    result.fallbackReason ||
    data.fallbackReason
  )
}

function isFallbackTask(task = {}) {
  const result = task.result || {}
  const data = task.data || {}
  return !!(
    task.fallback === true ||
    result.fallback === true ||
    data.fallback === true ||
    task.fallbackReason ||
    result.fallbackReason ||
    data.fallbackReason
  )
}

function isMockTask(task = {}) {
  const taskId = getTaskIdentity(task)
  const result = task.result || {}
  const data = task.data || {}
  return !!(
    task.mock === true ||
    result.mock === true ||
    data.mock === true ||
    /^mock_generate_/.test(String(taskId || ''))
  )
}

function isMockProviderTask(task = {}) {
  const result = task.result || {}
  const data = task.data || {}
  return task.provider === 'mock' || result.provider === 'mock' || data.provider === 'mock'
}

export function getOriginalProtectionBlockReason(task) {
  if (!task) {
    return ORIGINAL_PROTECTION_BLOCK_REASONS.MISSING_TASK
  }
  if (isMockTask(task)) {
    return ORIGINAL_PROTECTION_BLOCK_REASONS.MOCK_RESULT
  }
  if (isFallbackTask(task)) {
    return ORIGINAL_PROTECTION_BLOCK_REASONS.FALLBACK_RESULT
  }
  if (isMockProviderTask(task)) {
    return ORIGINAL_PROTECTION_BLOCK_REASONS.MOCK_PROVIDER
  }
  if (task.deliveryStatus !== 'approved') {
    return ORIGINAL_PROTECTION_BLOCK_REASONS.NOT_APPROVED
  }
  if (!getTaskResultImageUrl(task)) {
    return ORIGINAL_PROTECTION_BLOCK_REASONS.MISSING_RESULT_IMAGE
  }
  return ''
}

export function canCreateOriginalProtectionPackage(task) {
  const reason = getOriginalProtectionBlockReason(task)
  return {
    ok: !reason,
    reason,
    reasonText: reason ? ORIGINAL_PROTECTION_BLOCK_REASON_TEXT[reason] || reason : ''
  }
}

function clonePlain(value, fallback) {
  if (value === undefined || value === null) {
    return fallback
  }
  try {
    return JSON.parse(JSON.stringify(value))
  } catch (error) {
    return fallback
  }
}

function getCustomerSnapshot(project = {}, options = {}) {
  return {
    customerId: options.customerId || project.customerId || project.leadId || '',
    companyName: options.companyName || project.companyName || project.customerName || '',
    contactName: options.contactName || project.contactName || '',
    mobile: options.mobile || project.mobile || project.phone || '',
    membershipTier: options.membershipTier || project.membershipTier || '',
    contractId: options.contractId || project.contractId || '',
    servicePeriod: options.servicePeriod || project.servicePeriod || ''
  }
}

function getCustomerDemandSnapshot(task = {}, project = {}, options = {}) {
  const input = task.input || {}
  return {
    requirementText: options.requirementText || project.requirementText || project.description || input.prompt || '',
    referenceDescription: options.referenceDescription || project.referenceDescription || '',
    targetPlatform: options.targetPlatform || project.targetPlatform || '',
    targetUseCase: options.targetUseCase || project.targetUseCase || '',
    expectedStyle: options.expectedStyle || '',
    expectedScene: options.expectedScene || '',
    specialNotes: options.specialNotes || ''
  }
}

export function createOriginalProtectionPackageDraft(task = {}, project = {}, options = {}) {
  const safeTask = task || {}
  const input = safeTask.input || {}
  const assets = input.assets || {}
  const params = input.params || {}
  const resultImageUrl = getTaskResultImageUrl(safeTask)
  const now = new Date().toISOString()
  const taskId = getTaskIdentity(safeTask)
  const packageId = options.packageId || createPackageId()

  return {
    packageId,
    packageType: ORIGINAL_PROTECTION_PACKAGE_TYPE,
    version: ORIGINAL_PROTECTION_PACKAGE_VERSION,
    status: ORIGINAL_PROTECTION_PACKAGE_STATUS.DRAFT,

    customer: getCustomerSnapshot(project, options),

    project: {
      projectId: project.projectId || safeTask.projectId || '',
      projectName: project.projectName || '',
      batchId: safeTask.batchId || project.batchId || '',
      taskId: safeTask.taskId || '',
      clientTaskId: safeTask.clientTaskId || '',
      entryScene: params.entryScene || '',
      templateType: params.templateType || '',
      createdAt: safeTask.createdAt || project.createdAt || '',
      completedAt: safeTask.completedAt || project.completedAt || ''
    },

    customerDemand: getCustomerDemandSnapshot(task, project, options),

    sourceMaterials: {
      clothImage: clonePlain(assets.clothImage, {}),
      styleImage: clonePlain(assets.styleImage, {}),
      additionalFiles: clonePlain(assets.additionalFiles, [])
    },

    generationParams: clonePlain(params, {}),
    aiGenerationRecords: [
      {
        provider: safeTask.provider || (safeTask.result && safeTask.result.provider) || '',
        requestedProvider: safeTask.requestedProvider || '',
        fallback: !!safeTask.fallback,
        fallbackReason: safeTask.fallbackReason || '',
        resultImageUrl,
        createdAt: safeTask.completedAt || safeTask.updatedAt || now
      }
    ],
    designerWorkRecords: clonePlain(options.designerWorkRecords, []),
    sampleMakingRecords: clonePlain(options.sampleMakingRecords, []),
    photoshootRecords: clonePlain(options.photoshootRecords, []),
    finalDeliverables: resultImageUrl
      ? [
          {
            type: 'final_image',
            url: resultImageUrl,
            confirmedAt: safeTask.deliveryConfirmedAt || safeTask.reviewedAt || safeTask.completedAt || ''
          }
        ]
      : [],
    copyrightSupport: {
      statementTemplate: 'original_protection_statement_v1',
      registrationAssistance: false,
      notes: options.copyrightNotes || ''
    },
    auditTrail: [
      {
        action: 'task_created',
        taskId,
        createdAt: safeTask.createdAt || now
      },
      {
        action: 'ai_generated',
        taskId,
        createdAt: safeTask.completedAt || safeTask.updatedAt || now
      },
      {
        action: 'package_draft_created',
        packageId,
        taskId,
        createdAt: now
      }
    ],
    integrity: {
      packageSha256: '',
      fileHashes: [],
      generatedAt: '',
      timestamp: now
    },

    createdAt: now,
    updatedAt: now
  }
}
