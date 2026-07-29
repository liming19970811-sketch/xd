function createId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

export const LEAD_STATUS_OPTIONS = [
  'new',
  'contacted',
  'qualifying',
  'qualified',
  'proposal',
  'converted',
  'closed'
]

export const PROJECT_STATUS_OPTIONS = [
  'pending',
  'confirmed',
  'in_progress',
  'reviewing',
  'completed'
]

export const BATCH_STATUS_OPTIONS = [
  'draft',
  'pending',
  'processing',
  'completed',
  'failed'
]

export function createLeadEntity(overrides = {}) {
  const now = new Date().toISOString()

  return {
    leadId: createId('lead'),
    source: 'website',
    sourcePage: 'website-demand',
    companyName: '',
    brandName: '',
    contactName: '',
    phone: '',
    wechat: '',
    email: '',
    demandType: 'design_service',
    serviceScope: [],
    productCategory: '',
    expectedVolume: '',
    expectedDeliveryTime: '',
    budgetRange: '',
    needSample: false,
    description: '',
    referenceImages: [],
    attachmentUrls: [],
    attachmentFileIds: [],
    attachments: [],
    privacyConfirmed: false,
    sourceContext: {},
    leadSnapshot: null,
    possibleDuplicateLeadIds: [],
    ownerName: '',
    nextFollowAt: '',
    lastFollowContent: '',
    sourceChannel: 'website',
    status: 'new',
    createdAt: now,
    updatedAt: now,
    ...overrides
  }
}

export function createProjectEntity(overrides = {}) {
  const now = new Date().toISOString()

  return {
    projectId: createId('project'),
    leadId: '',
    enterpriseId: '',
    projectName: '',
    projectType: 'design_service',
    status: 'pending',
    stage: 'discovery',
    serviceScope: [],
    ownerId: '',
    taskIds: [],
    batchIds: [],
    createdAt: now,
    updatedAt: now,
    startedAt: '',
    completedAt: '',
    ...overrides
  }
}

export function createBatchEntity(overrides = {}) {
  const now = new Date().toISOString()

  return {
    batchId: createId('batch'),
    projectId: '',
    batchName: '',
    status: 'draft',
    taskIds: [],
    createdAt: now,
    updatedAt: now,
    startedAt: '',
    completedAt: '',
    ...overrides
  }
}

export function createBatchAssetEntity(overrides = {}) {
  const now = new Date().toISOString()

  return {
    assetId: createId('asset'),
    batchId: '',
    localPath: '',
    fileId: '',
    fileUrl: '',
    status: 'local_selected',
    createdAt: now,
    ...overrides
  }
}
