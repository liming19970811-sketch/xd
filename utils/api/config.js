const API_BASE_URL = 'https://www.diebiandesign.com'

export const API_CONFIG = {
  upload: {
    url: `${API_BASE_URL}/api/upload`,
    fileFieldName: 'file',
    sceneFieldName: 'scene'
  },
  generate: {
    url: `${API_BASE_URL}/api/generate`
  },
  taskList: {
    url: `${API_BASE_URL}/api/tasks`
  },
  taskQuery: {
    url: `${API_BASE_URL}/api/task`
  },
  taskDeliverySync: {
    url: `${API_BASE_URL}/api/task/delivery`
  },
  leads: {
    url: `${API_BASE_URL}/api/leads`
  },
  packages: {
    url: `${API_BASE_URL}/api/packages`
  },
  packageOrder: {
    url: `${API_BASE_URL}/api/orders/package`
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
