import { get, set } from '../data-provider/dataProvider.js'
import { listTasks } from '../task/taskLayer.js'
import { getProjects } from '../project/projectRepository.js'
import { listFileRecords } from '../upload/fileRepository.js'
import { createDataBackup, requireDataRecoveryAdmin } from '../admin/dataRecoveryCenter.js'
import { getDataDictionary, normalizeStandardStatus, STATUS_ENUMS } from './schemaCatalog.js'

const MIGRATION_RUN_KEY = 'diebians_schema_migration_runs_v1'
const MANUAL_QUEUE_KEY = 'diebians_schema_manual_queue_v1'

export const MIGRATION_STATUSES = Object.freeze(['pending', 'dry_run', 'running', 'paused', 'completed', 'failed'])

export const MIGRATION_DEFINITIONS = Object.freeze([
  {
    migrationId: '2026_07_schema_common_fields_v1',
    version: 1,
    title: '补齐公共字段',
    targetCollections: ['projects', 'tasks', 'assets', 'deliveries', 'patternMasters', 'patternVersions'],
    batchSize: 100,
    safeRerun: true,
    requiresBackup: true
  },
  {
    migrationId: '2026_07_task_status_standard_v1',
    version: 1,
    title: '任务状态标准化',
    targetCollections: ['tasks'],
    batchSize: 200,
    safeRerun: true,
    requiresBackup: true
  },
  {
    migrationId: '2026_07_batch_task_snapshot_v1',
    version: 1,
    title: '旧批次 taskIds 快照兼容',
    targetCollections: ['batches'],
    batchSize: 100,
    safeRerun: true,
    requiresBackup: true
  },
  {
    migrationId: '2026_07_asset_file_id_v1',
    version: 1,
    title: '旧资产临时 URL 治理',
    targetCollections: ['assets'],
    batchSize: 100,
    safeRerun: true,
    requiresBackup: true
  },
  {
    migrationId: '2026_07_project_enterprise_v1',
    version: 1,
    title: '项目 enterpriseId 缺失清单',
    targetCollections: ['projects'],
    batchSize: 100,
    safeRerun: true,
    requiresBackup: true
  },
  {
    migrationId: '2026_07_pattern_versions_v1',
    version: 1,
    title: '版型主体与版本结构兼容',
    targetCollections: ['patternMasters', 'patternVersions'],
    batchSize: 100,
    safeRerun: true,
    requiresBackup: true
  },
  {
    migrationId: '2026_07_usage_records_v1',
    version: 1,
    title: '旧额度字段迁移为流水计划',
    targetCollections: ['usageRecords'],
    batchSize: 100,
    safeRerun: true,
    requiresBackup: true
  }
])

function nowIso() {
  return new Date().toISOString()
}

function createId(prefix = 'migration') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

function asArray(value, nestedKey = '') {
  if (Array.isArray(value)) return value
  if (value && nestedKey && Array.isArray(value[nestedKey])) return value[nestedKey]
  return []
}

function readList(key = '') {
  const value = get(key, [])
  return Array.isArray(value) ? value : []
}

function writeList(key = '', records = []) {
  set(key, Array.isArray(records) ? records : [])
}

function getMainChainState() {
  return get('diebiandesign_main_chain_state', {})
}

function getBatchesFromState() {
  const state = getMainChainState()
  const byId = (state.batches && state.batches.byId) || {}
  return Object.values(byId)
}

function getPatternMasters() {
  return asArray(get('diebians_pattern_library_masters_v1', []))
}

function getPatternVersions() {
  return asArray(get('diebians_pattern_library_versions_v1', []))
}

function getUsageRecords() {
  const records = get('usageRecords', [])
  if (Array.isArray(records)) return records
  const legacy = get('membership_usage', {})
  return Object.entries(legacy && typeof legacy === 'object' ? legacy : {}).map(([accountId, value]) => ({
    recordId: `legacy_usage_${accountId}`,
    accountId,
    legacyValue: value,
    status: 'legacy'
  }))
}

function getCollectionRecords(collection = '') {
  if (collection === 'projects') return getProjects()
  if (collection === 'tasks') return listTasks()
  if (collection === 'assets') return listFileRecords()
  if (collection === 'batches') return getBatchesFromState()
  if (collection === 'patternMasters') return getPatternMasters()
  if (collection === 'patternVersions') return getPatternVersions()
  if (collection === 'usageRecords') return getUsageRecords()
  return asArray(get(collection, []))
}

function getDefinition(migrationId = '') {
  return MIGRATION_DEFINITIONS.find((item) => item.migrationId === migrationId) || null
}

function normalizeRun(run = {}) {
  return {
    runId: String(run.runId || createId('migration_run')),
    migrationId: String(run.migrationId || ''),
    status: MIGRATION_STATUSES.includes(run.status) ? run.status : 'pending',
    dryRun: run.dryRun !== false,
    batchSize: Math.max(1, Number(run.batchSize) || 100),
    estimatedCount: Math.max(0, Number(run.estimatedCount) || 0),
    successCount: Math.max(0, Number(run.successCount) || 0),
    failedCount: Math.max(0, Number(run.failedCount) || 0),
    skippedCount: Math.max(0, Number(run.skippedCount) || 0),
    manualCount: Math.max(0, Number(run.manualCount) || 0),
    backupId: String(run.backupId || ''),
    startedAt: run.startedAt || run.createdAt || nowIso(),
    completedAt: run.completedAt || '',
    cursor: String(run.cursor || ''),
    errors: Array.isArray(run.errors) ? run.errors : []
  }
}

function saveRun(run = {}) {
  const next = normalizeRun(run)
  const runs = readList(MIGRATION_RUN_KEY).map(normalizeRun)
  writeList(MIGRATION_RUN_KEY, [next, ...runs.filter((item) => item.runId !== next.runId)])
  return next
}

function addManualQueue(items = []) {
  if (!items.length) return []
  const current = readList(MANUAL_QUEUE_KEY)
  const next = [...items, ...current]
  writeList(MANUAL_QUEUE_KEY, next)
  return items
}

function hasCommonFieldGap(record = {}) {
  return !record.schemaVersion || !record.createdAt || !record.updatedAt || (!record.id && !record.taskId && !record.projectId && !record.fileId)
}

function isTemporaryUrl(value = '') {
  return /^(http:\/\/tmp\/|wxfile:\/\/|blob:|file:)/.test(String(value || '')) || /tmp|tempFileURL/i.test(String(value || ''))
}

function inspectRecord(definition = {}, collection = '', record = {}) {
  const id = record.id || record.taskId || record.projectId || record.batchId || record.fileId || record.patternMasterId || record.versionId || record.recordId || ''
  const issues = []
  let canAutoFix = true

  if (definition.migrationId === '2026_07_schema_common_fields_v1' && hasCommonFieldGap(record)) {
    issues.push('missing_common_fields')
  }

  if (definition.migrationId === '2026_07_task_status_standard_v1') {
    const raw = String(record.status || '').trim().toLowerCase()
    const nextStatus = normalizeStandardStatus('task', raw)
    if (raw && raw !== nextStatus) issues.push(`status_alias:${raw}->${nextStatus}`)
    if (raw && !STATUS_ENUMS.task.includes(raw) && nextStatus === STATUS_ENUMS.task[0]) {
      issues.push('illegal_task_status')
      canAutoFix = false
    }
  }

  if (definition.migrationId === '2026_07_batch_task_snapshot_v1') {
    if (collection === 'batches' && Array.isArray(record.taskIds) && record.taskIds.length && !record.snapshotVersion) {
      issues.push('legacy_task_ids_without_snapshot_version')
    }
  }

  if (definition.migrationId === '2026_07_asset_file_id_v1') {
    const url = record.fileUrl || record.url || record.imageUrl || record.tempUrl || ''
    if (!record.fileId && isTemporaryUrl(url)) {
      issues.push('temporary_url_without_file_id')
      canAutoFix = false
    }
  }

  if (definition.migrationId === '2026_07_project_enterprise_v1') {
    if (!record.enterpriseId) {
      issues.push('missing_enterprise_id')
      canAutoFix = false
    }
  }

  if (definition.migrationId === '2026_07_pattern_versions_v1') {
    if (collection === 'patternMasters' && !record.currentVersionId) issues.push('pattern_master_missing_current_version')
    if (collection === 'patternVersions' && (!record.patternMasterId || !record.versionId)) {
      issues.push('pattern_version_relation_incomplete')
      canAutoFix = false
    }
  }

  if (definition.migrationId === '2026_07_usage_records_v1') {
    if (!record.recordId || !record.idempotencyKey) {
      issues.push('usage_record_missing_immutable_fields')
      canAutoFix = false
    }
  }

  return {
    id,
    collection,
    issues,
    canAutoFix,
    needsMigration: issues.length > 0
  }
}

export function previewMigration(migrationId = '') {
  const guard = requireDataRecoveryAdmin()
  if (!guard.allowed) return { success: false, errorCode: guard.reason, message: '仅平台最高权限管理员可预览迁移。' }
  const definition = getDefinition(migrationId)
  if (!definition) return { success: false, errorCode: 'migration_not_found', message: '迁移脚本不存在。' }
  const inspections = definition.targetCollections.flatMap((collection) => (
    getCollectionRecords(collection).map((record) => inspectRecord(definition, collection, record))
  ))
  const targets = inspections.filter((item) => item.needsMigration)
  const manualItems = targets.filter((item) => !item.canAutoFix)
  return {
    success: true,
    dryRun: true,
    migration: definition,
    estimatedCount: targets.length,
    manualCount: manualItems.length,
    autoFixCount: targets.length - manualItems.length,
    skippedCount: inspections.length - targets.length,
    sampleIssues: targets.slice(0, 20)
  }
}

export function runMigrationBatch(input = {}) {
  const guard = requireDataRecoveryAdmin()
  if (!guard.allowed) return { success: false, errorCode: guard.reason, message: '仅平台最高权限管理员可执行迁移。' }
  const preview = previewMigration(input.migrationId)
  if (!preview.success) return preview
  const definition = preview.migration
  const dryRun = input.dryRun !== false
  const backup = definition.requiresBackup
    ? createDataBackup({ reason: 'before_schema_upgrade', scopeIds: [] })
    : { success: true, backup: {} }
  if (!backup.success) return backup
  const targetItems = preview.sampleIssues.length < preview.estimatedCount
    ? definition.targetCollections.flatMap((collection) => getCollectionRecords(collection).map((record) => inspectRecord(definition, collection, record))).filter((item) => item.needsMigration)
    : preview.sampleIssues
  const batchSize = Math.max(1, Number(input.batchSize) || definition.batchSize || 100)
  const batch = targetItems.slice(0, batchSize)
  const manualItems = batch.filter((item) => !item.canAutoFix).map((item) => ({
    queueId: createId('manual_migration'),
    migrationId: definition.migrationId,
    collection: item.collection,
    resourceId: item.id,
    issues: item.issues,
    status: 'pending_manual_review',
    createdAt: nowIso()
  }))
  addManualQueue(manualItems)
  const run = saveRun({
    runId: input.runId || createId('migration_run'),
    migrationId: definition.migrationId,
    status: dryRun ? 'dry_run' : 'paused',
    dryRun,
    batchSize,
    estimatedCount: preview.estimatedCount,
    successCount: dryRun ? 0 : batch.filter((item) => item.canAutoFix).length,
    failedCount: 0,
    skippedCount: preview.skippedCount,
    manualCount: manualItems.length,
    backupId: backup.backup.backupId || '',
    startedAt: nowIso(),
    completedAt: nowIso(),
    cursor: batch.length < targetItems.length ? String(batch.length) : '',
    errors: dryRun ? [] : ['V1 默认不直接写历史业务数据，执行结果进入 paused，需专项脚本确认后再落库。']
  })
  console.log('[schema:migration]', {
    migrationId: definition.migrationId,
    dryRun,
    estimatedCount: preview.estimatedCount,
    manualCount: manualItems.length
  })
  return { success: true, run, manualItems, preview }
}

function findDuplicates(records = [], idKeys = []) {
  const seen = new Map()
  const duplicates = []
  records.forEach((record) => {
    idKeys.forEach((key) => {
      const value = String(record[key] || '')
      if (!value) return
      const composite = `${key}:${value}`
      if (seen.has(composite)) duplicates.push({ key, value, first: seen.get(composite), duplicate: record })
      else seen.set(composite, record)
    })
  })
  return duplicates
}

export function runSchemaIntegrityCheck() {
  const guard = requireDataRecoveryAdmin()
  if (!guard.allowed) return { canAccess: false, errorCode: guard.reason, issues: [], summary: {} }
  const tasks = listTasks()
  const projects = getProjects()
  const batches = getBatchesFromState()
  const files = listFileRecords()
  const patterns = getPatternVersions()
  const issues = []
  const duplicateTasks = findDuplicates(tasks, ['taskId', 'idempotencyKey'])
  duplicateTasks.forEach((item) => issues.push({
    issueId: createId('schema_issue'),
    type: item.key === 'idempotencyKey' ? 'duplicate_idempotency_key' : 'duplicate_id',
    level: 'high',
    collection: 'tasks',
    targetId: item.value,
    suggestion: '保留最早创建记录，后续记录进入人工确认，禁止重复扣费。'
  }))
  projects.filter((project) => !project.enterpriseId).forEach((project) => issues.push({
    issueId: createId('schema_issue'),
    type: 'missing_enterprise_id',
    level: 'high',
    collection: 'projects',
    targetId: project.projectId,
    suggestion: '不要自动归属默认企业，进入人工处理清单。'
  }))
  tasks.forEach((task) => {
    const raw = String(task.status || '').trim().toLowerCase()
    const nextStatus = normalizeStandardStatus('task', raw)
    if (raw && raw !== nextStatus) {
      issues.push({
        issueId: createId('schema_issue'),
        type: STATUS_ENUMS.task.includes(nextStatus) ? 'legacy_status_alias' : 'illegal_status',
        level: STATUS_ENUMS.task.includes(nextStatus) ? 'low' : 'medium',
        collection: 'tasks',
        targetId: task.taskId,
        suggestion: '在数据层统一状态转换，页面只读取标准状态。'
      })
    }
  })
  batches.filter((batch) => Array.isArray(batch.taskIds) && batch.taskIds.length && !batch.snapshotVersion).forEach((batch) => issues.push({
    issueId: createId('schema_issue'),
    type: 'legacy_batch_snapshot',
    level: 'medium',
    collection: 'batches',
    targetId: batch.batchId,
    suggestion: '补充批次快照版本，避免只依赖实时任务列表。'
  }))
  files.filter((file) => !file.fileId || isTemporaryUrl(file.fileUrl || file.url || '')).forEach((file) => issues.push({
    issueId: createId('schema_issue'),
    type: 'orphan_or_temp_file',
    level: 'high',
    collection: 'assets',
    targetId: file.fileId || file.fileName,
    suggestion: '业务数据保存稳定 fileId，临时 URL 进入补传或授权处理。'
  }))
  const patternVersionKeys = new Set()
  patterns.forEach((version) => {
    const key = `${version.patternMasterId || ''}:${version.version || version.versionNo || ''}`
    if (patternVersionKeys.has(key)) {
      issues.push({
        issueId: createId('schema_issue'),
        type: 'pattern_version_conflict',
        level: 'high',
        collection: 'patternVersions',
        targetId: key,
        suggestion: '已审核或已批准版本不可覆盖，创建新版本并保留历史。'
      })
    }
    patternVersionKeys.add(key)
  })
  const summary = issues.reduce((acc, issue) => {
    acc[issue.level] = (acc[issue.level] || 0) + 1
    return acc
  }, { high: 0, medium: 0, low: 0 })
  return {
    canAccess: true,
    checkedAt: nowIso(),
    summary,
    counts: {
      tasks: tasks.length,
      projects: projects.length,
      batches: batches.length,
      files: files.length,
      patternVersions: patterns.length
    },
    issues
  }
}

export function loadSchemaGovernanceCenter() {
  const guard = requireDataRecoveryAdmin()
  if (!guard.allowed) {
    return {
      canAccess: false,
      reason: guard.reason,
      dictionary: getDataDictionary(),
      migrations: [],
      runs: [],
      manualQueue: [],
      integrity: { issues: [], summary: {} }
    }
  }
  return {
    canAccess: true,
    reason: '',
    dictionary: getDataDictionary(),
    migrations: MIGRATION_DEFINITIONS.map((item) => ({ ...item })),
    runs: readList(MIGRATION_RUN_KEY).map(normalizeRun),
    manualQueue: readList(MANUAL_QUEUE_KEY),
    integrity: runSchemaIntegrityCheck(),
    updatedAt: nowIso()
  }
}
