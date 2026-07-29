import {
  consumeBrandApiUsage,
  getBrandApiActionCost,
  validateBrandApiUsage
} from './apiUsageFlow'

const API_SANDBOX_STORAGE_KEY = 'diebiandesign_api_sandbox_records'

export const API_SANDBOX_STATUS = Object.freeze({
  SUCCESS: 'SUCCESS',
  APP_PAUSED: 'APP_PAUSED',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  QUOTA_NOT_ENOUGH: 'QUOTA_NOT_ENOUGH'
})

const API_SANDBOX_ACTIONS = Object.freeze([
  Object.freeze({
    action: 'image_generate',
    label: '图片生成',
    defaultRequest: Object.freeze({ prompt: '服装商品图，干净商业摄影风格', imageUrl: 'https://example.com/clothing.jpg' })
  }),
  Object.freeze({
    action: 'batch_generate',
    label: '批量生成',
    defaultRequest: Object.freeze({ count: 4, sceneType: 'ecommerce' })
  }),
  Object.freeze({
    action: 'asset_access',
    label: '资产读取',
    defaultRequest: Object.freeze({ assetType: 'image', page: 1, pageSize: 10 })
  }),
  Object.freeze({
    action: 'project_access',
    label: '项目读取',
    defaultRequest: Object.freeze({ projectId: 'project_demo_001' })
  })
])

function cloneValue(value, fallback) {
  try {
    return JSON.parse(JSON.stringify(value))
  } catch (error) {
    return fallback
  }
}

function normalizeSandboxRecord(record = {}) {
  return {
    sandboxId: String(record.sandboxId || ''),
    appId: String(record.appId || ''),
    action: String(record.action || ''),
    request: cloneValue(record.request, {}),
    response: cloneValue(record.response, {}),
    cost: Math.max(0, Number(record.cost) || 0),
    status: Object.values(API_SANDBOX_STATUS).includes(record.status)
      ? record.status
      : API_SANDBOX_STATUS.PERMISSION_DENIED,
    createdAt: record.createdAt || new Date().toISOString()
  }
}

function readSandboxRecords() {
  try {
    const records = uni.getStorageSync(API_SANDBOX_STORAGE_KEY)
    return Array.isArray(records) ? records.map(normalizeSandboxRecord) : []
  } catch (error) {
    return []
  }
}

function writeSandboxRecords(records = []) {
  try {
    uni.setStorageSync(API_SANDBOX_STORAGE_KEY, records.map(normalizeSandboxRecord))
  } catch (error) {}
  return records
}

function mapFailureStatus(code = '') {
  if (code === API_SANDBOX_STATUS.APP_PAUSED) return API_SANDBOX_STATUS.APP_PAUSED
  if (code === API_SANDBOX_STATUS.QUOTA_NOT_ENOUGH) return API_SANDBOX_STATUS.QUOTA_NOT_ENOUGH
  return API_SANDBOX_STATUS.PERMISSION_DENIED
}

function createMockSuccessResponse(action = '', request = {}, sandboxId = '') {
  const payloads = {
    image_generate: { accepted: true, outputType: 'image', previewMode: true },
    batch_generate: { accepted: true, totalCount: Math.max(1, Number(request.count) || 1), previewMode: true },
    asset_access: { items: [], total: 0, previewMode: true },
    project_access: { projectId: request.projectId || '', project: null, previewMode: true }
  }
  return {
    success: true,
    sandbox: true,
    requestId: sandboxId,
    action,
    data: payloads[action] || { accepted: true, previewMode: true }
  }
}

function saveSandboxRecord(input = {}) {
  const record = normalizeSandboxRecord({
    ...input,
    sandboxId: input.sandboxId || `api_sandbox_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    createdAt: input.createdAt || new Date().toISOString()
  })
  writeSandboxRecords([record, ...readSandboxRecords().filter((item) => item.sandboxId !== record.sandboxId)])
  console.log('[api:sandbox]', {
    sandboxId: record.sandboxId,
    appId: record.appId,
    action: record.action
  })
  return record
}

export function getApiSandboxActionOptions() {
  return API_SANDBOX_ACTIONS.map((item) => ({
    action: item.action,
    label: item.label,
    cost: getBrandApiActionCost(item.action),
    defaultRequest: cloneValue(item.defaultRequest, {})
  }))
}

export function getApiSandboxDefaultRequest(action = '') {
  const option = API_SANDBOX_ACTIONS.find((item) => item.action === action)
  return cloneValue(option ? option.defaultRequest : {}, {})
}

export function getApiSandboxRecords(appId = '') {
  return readSandboxRecords()
    .filter((record) => !appId || record.appId === appId)
    .sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt)))
}

export function getApiSandboxStatusLabel(status = '') {
  const labels = {
    SUCCESS: '调用成功',
    APP_PAUSED: '应用已暂停',
    PERMISSION_DENIED: '权限不足',
    QUOTA_NOT_ENOUGH: '额度不足'
  }
  return labels[status] || status || '未知状态'
}

export function runApiSandboxTest(input = {}) {
  const appId = String(input.appId || '')
  const action = String(input.action || '')
  const request = cloneValue(input.request, {})
  const cost = getBrandApiActionCost(action)
  const sandboxId = `api_sandbox_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
  const validation = validateBrandApiUsage({ appId, action, cost })

  if (!validation.allowed) {
    return saveSandboxRecord({
      sandboxId,
      appId,
      action,
      request,
      response: {
        success: false,
        sandbox: true,
        errorCode: validation.code,
        message: validation.reason
      },
      cost: 0,
      status: mapFailureStatus(validation.code)
    })
  }

  const usageResult = consumeBrandApiUsage({ appId, action, cost })
  return saveSandboxRecord({
    sandboxId,
    appId,
    action,
    request,
    response: {
      ...createMockSuccessResponse(action, request, sandboxId),
      remainingQuota: usageResult.usage.afterQuota
    },
    cost,
    status: API_SANDBOX_STATUS.SUCCESS
  })
}
