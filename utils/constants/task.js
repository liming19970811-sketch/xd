export const TASK_TYPES = Object.freeze({
  MODEL_REPLACE: 'model_replace',
  IMAGE_ENHANCE: 'image_enhance',
  BATCH_DELIVERY: 'batch_delivery'
})

export const TASK_STATUS = Object.freeze({
  DRAFT: 'draft',
  PENDING: 'pending',
  SUBMITTED: 'submitted',
  QUEUED: 'queued',
  PROCESSING: 'processing',
  SUCCESS: 'success',
  FAILED: 'failed',
  TIMEOUT: 'timeout'
})

export const TASK_SOURCE = Object.freeze({
  MINIAPP: 'miniapp',
  WEBSITE: 'website',
  ADMIN: 'admin',
  SERVER: 'server'
})
