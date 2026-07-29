export const DEVELOPER_TABS = Object.freeze([
  { key: 'overview', label: '开放平台', path: '/developer' },
  { key: 'apps', label: '企业应用', path: '/developer/apps' },
  { key: 'api-keys', label: '密钥管理', path: '/developer/api-keys' },
  { key: 'usage', label: '调用用量', path: '/developer/usage' },
  { key: 'logs', label: '调用日志', path: '/developer/logs' },
  { key: 'docs', label: '开发文档', path: '/developer/docs' }
])

export const API_APP_STATUSES = Object.freeze([
  { value: 'draft', label: '草稿' },
  { value: 'active', label: '启用' },
  { value: 'suspended', label: '暂停' },
  { value: 'revoked', label: '撤销' }
])

export const API_KEY_STATUSES = Object.freeze([
  { value: 'active', label: '有效' },
  { value: 'suspended', label: '暂停' },
  { value: 'revoked', label: '撤销' }
])

export const API_SCOPES = Object.freeze([
  { value: 'task.create', label: '创建单个 AI 出图任务', stable: true },
  { value: 'task.read', label: '查询任务状态', stable: true },
  { value: 'result.read', label: '获取生成结果', stable: true },
  { value: 'batch.create', label: '创建批量任务', stable: true },
  { value: 'batch.read', label: '查询批次状态', stable: true },
  { value: 'usage.read', label: '获取额度使用情况', stable: true },
  { value: 'pattern.create', label: 'AI 制版任务', stable: false },
  { value: 'pattern.download', label: '版型下载', stable: false },
  { value: 'model.manage', label: '模型管理', stable: false },
  { value: 'training.manage', label: '训练数据', stable: false }
])

export const STABLE_API_SCOPES = Object.freeze(API_SCOPES.filter((item) => item.stable).map((item) => item.value))

export const DEFAULT_API_LIMITS = Object.freeze({
  perMinute: 60,
  dailyTasks: 500,
  concurrentTasks: 20,
  batchLimit: 100,
  fileSizeMb: 20
})

export const API_DOCS = Object.freeze([
  {
    key: 'auth',
    title: '身份验证',
    summary: '使用 Authorization: Bearer <API_KEY> 调用企业 API。密钥只在创建时完整显示一次，之后只能轮换。',
    code: 'Authorization: Bearer db_live_xxx'
  },
  {
    key: 'task-create',
    title: '创建任务',
    summary: '创建单个 AI 出图任务，必须传 idempotencyKey，相同键不会重复创建任务或重复计量。',
    code: JSON.stringify({
      action: 'apiCreateImageTask',
      idempotencyKey: 'client-order-20260728-001',
      type: 'model',
      input: { imageUrl: 'https://example.com/cloth.jpg' },
      params: { prompt: '生成电商模特展示图' }
    }, null, 2)
  },
  {
    key: 'task-status',
    title: '查询状态与结果',
    summary: '异步任务返回 taskId、status 和 pollingUrl。完成后通过结果接口读取 resultImageUrl 或 items。',
    code: JSON.stringify({ action: 'apiGetTaskStatus', taskId: 'api_task_xxx' }, null, 2)
  },
  {
    key: 'batch',
    title: '批量任务',
    summary: '批量任务必须传 idempotencyKey，单批次数量受企业应用限制控制。',
    code: JSON.stringify({ action: 'apiCreateBatch', idempotencyKey: 'batch-001', items: [{ type: 'model' }] }, null, 2)
  },
  {
    key: 'callback',
    title: '回调验证',
    summary: '任务状态 completed、failed、needs_review 可回调企业系统。回调需验证签名并按 requestId 幂等处理。',
    code: 'X-Diebian-Signature: sha256=<signature>'
  },
  {
    key: 'errors',
    title: '错误码与限流',
    summary: '未开通、密钥失效、范围不足、频率超限、批次数超限都会返回明确 code，不继续计量。',
    code: JSON.stringify({ requestId: 'req_xxx', success: false, code: 'rate_limited', message: '调用频率超过限制' }, null, 2)
  }
])

export function getDeveloperTabByPath(path = '') {
  const normalized = String(path || '').replace(/\/$/, '')
  return DEVELOPER_TABS.find((item) => item.path === normalized) || DEVELOPER_TABS[0]
}

export function getStatusLabel(status = '', options = API_APP_STATUSES) {
  const item = options.find((option) => option.value === status)
  return item ? item.label : status || '未知'
}
