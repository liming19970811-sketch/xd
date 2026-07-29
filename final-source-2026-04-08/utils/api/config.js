export const API_CONFIG = {
  upload: {
    url: 'https://你的域名.com/api/upload',
    fileFieldName: 'file',
    sceneFieldName: 'scene'
  },
  generate: {
    url: 'https://你的域名.com/api/generate'
  },
  taskQuery: {
    url: 'https://你的域名.com/api/task'
  }
}

export const TASK_STATUS = {
  queued: 'queued',
  processing: 'processing',
  success: 'success',
  failed: 'failed',
  error: 'error'
}

export const VALID_TASK_STATUS = Object.values(TASK_STATUS)
