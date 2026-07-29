export const SCHEMA_VERSION = 1

export const COMMON_FIELDS = Object.freeze([
  { key: 'id', type: 'string', required: true, defaultValue: '', description: '统一主键，兼容历史 xxxId 字段。' },
  { key: 'ownerId', type: 'string', required: false, defaultValue: '', description: '个人数据归属用户。' },
  { key: 'enterpriseId', type: 'string', required: false, defaultValue: '', description: '企业数据隔离字段。' },
  { key: 'createdBy', type: 'string', required: false, defaultValue: '', description: '创建人用户或成员 ID。' },
  { key: 'createdAt', type: 'datetime', required: true, defaultValue: 'now', description: '创建时间，ISO 字符串。' },
  { key: 'updatedAt', type: 'datetime', required: true, defaultValue: 'createdAt', description: '更新时间，列表稳定排序字段。' },
  { key: 'status', type: 'enum', required: true, defaultValue: 'draft', description: '标准状态，历史状态在数据层转换。' },
  { key: 'schemaVersion', type: 'number', required: true, defaultValue: SCHEMA_VERSION, description: '数据结构版本。' }
])

export const SOFT_DELETE_FIELDS = Object.freeze([
  { key: 'deletedAt', type: 'datetime', required: false, defaultValue: '', description: '软删除时间。' },
  { key: 'deletedBy', type: 'string', required: false, defaultValue: '', description: '删除操作人。' },
  { key: 'deleteReason', type: 'string', required: false, defaultValue: '', description: '删除原因。' }
])

export const STATUS_ENUMS = Object.freeze({
  task: ['draft', 'pending', 'submitted', 'queued', 'processing', 'success', 'failed', 'timeout', 'cancelled'],
  project: ['draft', 'active', 'reviewing', 'delivering', 'completed', 'archived'],
  batch: ['draft', 'pending', 'processing', 'partial_failed', 'reviewing', 'ready_to_deliver', 'delivered', 'failed', 'completed'],
  pattern: ['draft', 'ai_generated', 'under_review', 'changes_requested', 'reviewed', 'approved', 'archived'],
  review: ['pending', 'approved', 'rejected', 'changes_requested', 'cancelled'],
  delivery: ['draft', 'preparing', 'pending_review', 'confirmed', 'delivered', 'expired', 'archived'],
  ticket: ['new', 'assigned', 'investigating', 'waiting_user', 'resolved', 'closed', 'reopened'],
  lead: ['new', 'contacted', 'qualified', 'proposal', 'converted', 'closed'],
  backup: ['pending', 'running', 'completed', 'failed', 'expired', 'deleted'],
  migration: ['pending', 'dry_run', 'running', 'paused', 'completed', 'failed']
})

const COMMON_MODEL_FIELDS = COMMON_FIELDS.map((field) => ({ ...field }))
const SOFT_DELETE_MODEL_FIELDS = SOFT_DELETE_FIELDS.map((field) => ({ ...field }))

function field(key, type, required, defaultValue, description, options = {}) {
  return { key, type, required: Boolean(required), defaultValue, description, ...options }
}

export const DATA_MODELS = Object.freeze([
  {
    collection: 'users',
    idField: 'userId',
    softDelete: false,
    fields: [
      ...COMMON_MODEL_FIELDS,
      field('userId', 'string', true, '', '用户 ID。'),
      field('name', 'string', true, '', '用户展示名。'),
      field('avatar', 'string', false, '', '头像 fileId 或安全 URL。'),
      field('phoneHash', 'string', false, '', '手机号脱敏哈希。'),
      field('emailHash', 'string', false, '', '邮箱脱敏哈希。')
    ],
    relations: ['enterprise_members.userId', 'tasks.ownerId', 'auditLogs.createdBy']
  },
  {
    collection: 'enterprises',
    idField: 'enterpriseId',
    softDelete: false,
    fields: [
      ...COMMON_MODEL_FIELDS,
      field('enterpriseId', 'string', true, '', '企业 ID。'),
      field('enterpriseName', 'string', true, '', '企业名称。'),
      field('industry', 'string', false, '', '行业类型。'),
      field('teamSize', 'string', false, '', '团队规模。')
    ],
    relations: ['enterprise_members.enterpriseId', 'projects.enterpriseId']
  },
  {
    collection: 'memberships',
    idField: 'membershipId',
    softDelete: false,
    fields: [
      ...COMMON_MODEL_FIELDS,
      field('membershipId', 'string', true, '', '会员权益记录 ID。'),
      field('accountId', 'string', true, '', '用户或企业账户 ID。'),
      field('planId', 'string', true, '', '套餐 ID。'),
      field('validUntil', 'datetime', false, '', '权益到期时间。')
    ],
    relations: ['usageRecords.accountId']
  },
  {
    collection: 'usageRecords',
    idField: 'recordId',
    softDelete: false,
    fields: [
      ...COMMON_MODEL_FIELDS,
      field('recordId', 'string', true, '', '不可变额度流水 ID。'),
      field('accountId', 'string', true, '', '额度账户 ID。'),
      field('actionType', 'enum', true, 'consume', 'consume / pre_hold / confirm / rollback / compensation。'),
      field('amount', 'number', true, 0, '变动数量。'),
      field('before', 'number', true, 0, '变动前余额。'),
      field('after', 'number', true, 0, '变动后余额。'),
      field('taskId', 'string', false, '', '关联任务。'),
      field('orderId', 'string', false, '', '关联订单。'),
      field('idempotencyKey', 'string', true, '', '幂等键。')
    ],
    relations: ['tasks.taskId', 'orders.orderId']
  },
  {
    collection: 'projects',
    idField: 'projectId',
    softDelete: true,
    fields: [
      ...COMMON_MODEL_FIELDS,
      ...SOFT_DELETE_MODEL_FIELDS,
      field('projectId', 'string', true, '', '项目 ID。'),
      field('name', 'string', true, '', '项目名称，兼容 projectName。'),
      field('customerName', 'string', false, '', '客户名称。'),
      field('taskIds', 'array<string>', false, [], '关联任务。'),
      field('batchIds', 'array<string>', false, [], '关联批次。'),
      field('assetIds', 'array<string>', false, [], '关联资产。')
    ],
    relations: ['tasks.projectId', 'batches.projectId', 'deliveries.projectId']
  },
  {
    collection: 'batches',
    idField: 'batchId',
    softDelete: true,
    fields: [
      ...COMMON_MODEL_FIELDS,
      ...SOFT_DELETE_MODEL_FIELDS,
      field('batchId', 'string', true, '', '批次 ID。'),
      field('projectId', 'string', false, '', '所属项目。'),
      field('taskIds', 'array<string>', false, [], '批次任务快照。'),
      field('totalCount', 'number', true, 0, '任务总数。'),
      field('completedCount', 'number', true, 0, '完成数。'),
      field('failedCount', 'number', true, 0, '失败数。')
    ],
    relations: ['projects.projectId', 'tasks.batchId']
  },
  {
    collection: 'tasks',
    idField: 'taskId',
    softDelete: false,
    fields: [
      ...COMMON_MODEL_FIELDS,
      field('taskId', 'string', true, '', '任务 ID。'),
      field('type', 'string', true, '', '功能类型。'),
      field('projectId', 'string', false, '', '所属项目。'),
      field('batchId', 'string', false, '', '所属批次。'),
      field('input', 'object', true, {}, '输入参数，保存 fileId，不长期保存临时 URL。'),
      field('result', 'object', false, {}, '结果对象。'),
      field('provider', 'string', false, '', '供应商。'),
      field('modelVersion', 'string', false, '', '模型版本。'),
      field('idempotencyKey', 'string', false, '', '创建幂等键。')
    ],
    relations: ['projects.projectId', 'batches.batchId', 'assets.taskId']
  },
  {
    collection: 'assets',
    idField: 'assetId',
    softDelete: true,
    fields: [
      ...COMMON_MODEL_FIELDS,
      ...SOFT_DELETE_MODEL_FIELDS,
      field('assetId', 'string', true, '', '资产 ID。'),
      field('fileId', 'string', false, '', '稳定云存储 fileId。'),
      field('assetType', 'enum', true, 'source_material', '资产类型。'),
      field('projectId', 'string', false, '', '所属项目。'),
      field('taskId', 'string', false, '', '来源任务。'),
      field('batchId', 'string', false, '', '来源批次。'),
      field('currentVersionId', 'string', false, '', '当前版本。')
    ],
    relations: ['tasks.taskId', 'projects.projectId', 'fileRecords.fileId']
  },
  {
    collection: 'deliveries',
    idField: 'deliveryId',
    softDelete: true,
    fields: [
      ...COMMON_MODEL_FIELDS,
      ...SOFT_DELETE_MODEL_FIELDS,
      field('deliveryId', 'string', true, '', '交付 ID。'),
      field('projectId', 'string', true, '', '项目 ID。'),
      field('batchId', 'string', false, '', '批次 ID。'),
      field('assetIds', 'array<string>', false, [], '交付资产。'),
      field('version', 'string', true, 'V1', '交付版本。')
    ],
    relations: ['projects.projectId', 'assets.assetId']
  },
  {
    collection: 'patternMasters',
    idField: 'patternMasterId',
    softDelete: true,
    fields: [
      ...COMMON_MODEL_FIELDS,
      ...SOFT_DELETE_MODEL_FIELDS,
      field('patternMasterId', 'string', true, '', '版型主体 ID。'),
      field('title', 'string', true, '', '版型名称。'),
      field('scope', 'enum', true, 'personal', 'system / personal / enterprise。'),
      field('currentVersionId', 'string', false, '', '当前版本 ID。')
    ],
    relations: ['patternVersions.patternMasterId']
  },
  {
    collection: 'patternVersions',
    idField: 'versionId',
    softDelete: false,
    fields: [
      ...COMMON_MODEL_FIELDS,
      field('versionId', 'string', true, '', '不可变版本 ID。'),
      field('patternMasterId', 'string', true, '', '版型主体 ID。'),
      field('version', 'string', true, 'V1', '版本号。'),
      field('reviewStatus', 'enum', true, 'draft', '审核状态。'),
      field('aiDraft', 'object', false, {}, 'AI 原稿。'),
      field('revisedDraft', 'object', false, {}, '版师修订稿。')
    ],
    relations: ['patternMasters.patternMasterId']
  },
  {
    collection: 'reviews',
    idField: 'reviewId',
    softDelete: false,
    fields: [
      ...COMMON_MODEL_FIELDS,
      field('reviewId', 'string', true, '', '审核 ID。'),
      field('resourceType', 'string', true, '', '审核资源类型。'),
      field('resourceId', 'string', true, '', '审核资源 ID。'),
      field('comment', 'string', false, '', '审核意见。')
    ],
    relations: ['assets.assetId', 'patternVersions.versionId']
  },
  {
    collection: 'leads',
    idField: 'leadId',
    softDelete: false,
    fields: [
      ...COMMON_MODEL_FIELDS,
      field('leadId', 'string', true, '', '线索 ID。'),
      field('contactName', 'string', true, '', '联系人。'),
      field('contactHash', 'string', true, '', '联系方式脱敏哈希。'),
      field('sourceType', 'string', false, 'website', '来源页面类型。'),
      field('projectId', 'string', false, '', '转项目后的项目 ID。')
    ],
    relations: ['projects.leadId']
  },
  {
    collection: 'tickets',
    idField: 'ticketId',
    softDelete: false,
    fields: [
      ...COMMON_MODEL_FIELDS,
      field('ticketId', 'string', true, '', '工单 ID。'),
      field('type', 'enum', true, 'product_suggestion', '工单类型。'),
      field('priority', 'enum', true, 'P3', '优先级。'),
      field('resourceId', 'string', false, '', '关联资源。')
    ],
    relations: ['tasks.taskId', 'projects.projectId', 'assets.assetId']
  },
  {
    collection: 'auditLogs',
    idField: 'auditId',
    softDelete: false,
    fields: [
      ...COMMON_MODEL_FIELDS,
      field('auditId', 'string', true, '', '审计 ID。'),
      field('operatorId', 'string', true, '', '操作人。'),
      field('action', 'string', true, '', '动作。'),
      field('targetType', 'string', true, '', '对象类型。'),
      field('targetId', 'string', false, '', '对象 ID。'),
      field('before', 'object', false, {}, '变更前摘要。'),
      field('after', 'object', false, {}, '变更后摘要。')
    ],
    relations: []
  },
  {
    collection: 'notifications',
    idField: 'notificationId',
    softDelete: false,
    fields: [
      ...COMMON_MODEL_FIELDS,
      field('notificationId', 'string', true, '', '通知 ID。'),
      field('receiverId', 'string', true, '', '接收人。'),
      field('type', 'string', true, '', '通知类型。'),
      field('resourceType', 'string', false, '', '跳转资源类型。'),
      field('resourceId', 'string', false, '', '跳转资源 ID。'),
      field('readAt', 'datetime', false, '', '已读时间。')
    ],
    relations: ['users.userId']
  }
])

export const INDEX_DEFINITIONS = Object.freeze([
  { collection: 'projects', fields: ['enterpriseId', 'updatedAt'], scenario: '企业项目列表按更新时间分页。' },
  { collection: 'tasks', fields: ['ownerId', 'status', 'createdAt'], scenario: '个人任务列表和失败任务筛选。' },
  { collection: 'tasks', fields: ['projectId', 'status', 'updatedAt'], scenario: '项目详情内按状态查看任务。' },
  { collection: 'tasks', fields: ['batchId', 'status'], scenario: '批次详情统计任务状态。' },
  { collection: 'patternVersions', fields: ['patternMasterId', 'version'], scenario: '版型详情加载版本历史并检测版本冲突。' },
  { collection: 'tasks', fields: ['taskId', 'createdAt'], scenario: '任务详情和任务链路追踪。' },
  { collection: 'usageRecords', fields: ['idempotencyKey'], unique: true, scenario: '额度预扣、确认和回滚幂等。' },
  { collection: 'leads', fields: ['leadId', 'status'], scenario: '线索跟进和需求编号查询。' },
  { collection: 'assets', fields: ['projectId', 'status', 'updatedAt'], scenario: '项目资产中心分页。' },
  { collection: 'tickets', fields: ['enterpriseId', 'status', 'updatedAt'], scenario: '企业工单列表。' },
  { collection: 'auditLogs', fields: ['enterpriseId', 'createdAt'], scenario: '审计日志倒序查询。' },
  { collection: 'notifications', fields: ['receiverId', 'status', 'createdAt'], scenario: '通知中心未读列表。' }
])

export const PAGINATION_RULES = Object.freeze([
  { collection: 'tasks', defaultPageSize: 20, maxPageSize: 100, orderBy: ['updatedAt', 'taskId'], cursor: 'updatedAt_taskId' },
  { collection: 'projects', defaultPageSize: 20, maxPageSize: 100, orderBy: ['updatedAt', 'projectId'], cursor: 'updatedAt_projectId' },
  { collection: 'assets', defaultPageSize: 30, maxPageSize: 120, orderBy: ['updatedAt', 'assetId'], cursor: 'updatedAt_assetId' },
  { collection: 'patternMasters', defaultPageSize: 20, maxPageSize: 80, orderBy: ['updatedAt', 'patternMasterId'], cursor: 'updatedAt_patternMasterId' },
  { collection: 'auditLogs', defaultPageSize: 30, maxPageSize: 100, orderBy: ['createdAt', 'auditId'], cursor: 'createdAt_auditId' }
])

export const LEGACY_COMPATIBILITY_RULES = Object.freeze([
  { ruleId: 'legacy_task_status', target: 'tasks.status', description: '旧任务状态映射到标准状态；无法识别时进入人工清单。' },
  { ruleId: 'legacy_batch_task_ids', target: 'batches.taskIds', description: '旧批次仅保存 taskIds 时保留快照并补充 batchId 反查建议。' },
  { ruleId: 'legacy_asset_temp_url', target: 'assets.fileId', description: '旧资产临时 URL 不伪造 fileId，进入人工补传或重新授权清单。' },
  { ruleId: 'legacy_quota_fields', target: 'usageRecords', description: '旧额度余额字段迁移为不可变 usageRecords 流水。' },
  { ruleId: 'legacy_project_enterprise', target: 'projects.enterpriseId', description: '缺少 enterpriseId 的项目先进入人工确认，不自动跨租户默认。' },
  { ruleId: 'legacy_pattern_versions', target: 'patternVersions', description: '旧版型缺少版本结构时创建待审核版本计划，已审核版本禁止覆盖。' }
])

const STATUS_ALIASES = Object.freeze({
  task: { done: 'success', completed: 'success', error: 'failed', generating: 'processing' },
  project: { requirement_confirmation: 'draft', designing: 'active', generating: 'active', pending_review: 'reviewing', delivered: 'completed' },
  batch: { success: 'completed', partial: 'partial_failed' },
  pattern: { confirmed: 'approved' },
  review: { pass: 'approved', fail: 'rejected' },
  delivery: { success: 'delivered', completed: 'delivered' },
  ticket: { open: 'new', processing: 'investigating' },
  lead: { qualifying: 'qualified' }
})

export function normalizeStandardStatus(domain = '', value = '') {
  const normalizedDomain = String(domain || '').trim()
  const raw = String(value || '').trim().toLowerCase()
  const aliases = STATUS_ALIASES[normalizedDomain] || {}
  const next = aliases[raw] || raw
  const allowed = STATUS_ENUMS[normalizedDomain] || []
  return allowed.includes(next) ? next : (allowed[0] || next)
}

export function getDataDictionary() {
  return {
    schemaVersion: SCHEMA_VERSION,
    commonFields: COMMON_FIELDS.map((item) => ({ ...item })),
    softDeleteFields: SOFT_DELETE_FIELDS.map((item) => ({ ...item })),
    statusEnums: { ...STATUS_ENUMS },
    models: DATA_MODELS.map((model) => ({
      ...model,
      fields: model.fields.map((item) => ({ ...item })),
      relations: [...model.relations]
    })),
    indexes: INDEX_DEFINITIONS.map((item) => ({ ...item, fields: [...item.fields] })),
    paginationRules: PAGINATION_RULES.map((item) => ({ ...item, orderBy: [...item.orderBy] })),
    legacyCompatibilityRules: LEGACY_COMPATIBILITY_RULES.map((item) => ({ ...item }))
  }
}

export function getModelDefinition(collection = '') {
  return DATA_MODELS.find((model) => model.collection === collection) || null
}

export function getIndexPlan(collection = '') {
  return INDEX_DEFINITIONS.filter((item) => !collection || item.collection === collection)
}
