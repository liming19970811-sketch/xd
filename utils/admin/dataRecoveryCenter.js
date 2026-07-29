import { get, set } from '../data-provider/dataProvider.js'
import { getCurrentMember, getCurrentUser } from '../auth/authRepository.js'
import { requirePlatformAdmin } from './platformAdminRepository.js'
import { recordAudit } from '../audit/auditService.js'
import { getProjects } from '../project/projectRepository.js'
import { listTasks } from '../task/taskLayer.js'
import { listFileRecords, listFileReferences } from '../upload/fileRepository.js'

const BACKUP_RECORD_KEY = 'diebians_data_backup_records_v1'
const RECOVERY_RECORD_KEY = 'diebians_data_recovery_records_v1'
const RECOVERY_DRILL_KEY = 'diebians_data_recovery_drills_v1'
const RECYCLE_BIN_KEY = 'diebians_data_recycle_bin_v1'

export const BACKUP_STATUSES = Object.freeze(['pending', 'running', 'completed', 'failed', 'expired', 'deleted'])
export const BACKUP_REASONS = Object.freeze(['scheduled', 'before_release', 'before_schema_upgrade', 'manual_checkpoint'])

export const CORE_DATA_SCOPES = Object.freeze([
  {
    scopeId: 'identity_enterprise',
    label: '用户与企业',
    storageKeys: ['diebiandesign_auth_context_v1', 'enterprise_auth_users', 'enterprises', 'enterprise_members', 'diebiandesign_enterprise_team_v1']
  },
  {
    scopeId: 'membership_quota',
    label: '会员与额度记录',
    storageKeys: ['membership_usage', 'membership_usage_mock', 'diebians_membership_member_limits_v1', 'diebiandesign_commercial_orders']
  },
  {
    scopeId: 'project_batch',
    label: '项目与批次',
    storageKeys: ['diebiandesign_projects', 'diebians_workspace_project_center_meta_v1', 'diebians_workspace_project_status_history_v1', 'service_batches']
  },
  {
    scopeId: 'ai_tasks',
    label: 'AI任务',
    storageKeys: ['diebiandesign_main_chain_state', 'admin_mock_tasks', 'service_batch_runtime']
  },
  {
    scopeId: 'assets_files',
    label: '作品与资产元数据',
    storageKeys: ['diebians_file_records_v1', 'diebians_file_references_v1', 'diebians_workspace_asset_center_meta_v1', 'diebi_workspace_project_asset_version_v1']
  },
  {
    scopeId: 'patterns',
    label: '版型主体与版本',
    storageKeys: ['diebians_pattern_library_masters_v1', 'diebians_pattern_library_versions_v1', 'diebians_pattern_training_datasets_v1']
  },
  {
    scopeId: 'review_delivery',
    label: '审核与交付记录',
    storageKeys: ['diebi_workspace_delivery_v1', 'diebi_workspace_delivery_feedback_v1', 'diebi_workspace_delivery_package_v1', 'diebiandesign_project_deliveries']
  },
  {
    scopeId: 'support_leads',
    label: '工单与企业线索',
    storageKeys: ['diebians_support_tickets_v1', 'service_leads', 'service_lead_notes', 'diebiandesign_project_leads']
  },
  {
    scopeId: 'permission_audit',
    label: '权限与审计日志',
    storageKeys: ['diebiandesign_role_permissions_v1', 'diebiandesign_enterprise_roles_v1', 'diebiandesign_enterprise_audit_logs_v1']
  },
  {
    scopeId: 'system_config',
    label: '系统关键配置',
    storageKeys: ['diebians_provider_configs_v1', 'diebians_provider_routes_v1', 'diebians_model_operations_releases_v1']
  }
])

function nowIso() {
  return new Date().toISOString()
}

function createId(prefix = 'id') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

function asArray(value, nestedKey = '') {
  if (Array.isArray(value)) return value
  if (value && nestedKey && Array.isArray(value[nestedKey])) return value[nestedKey]
  if (value && typeof value === 'object' && Array.isArray(value.records)) return value.records
  if (value && typeof value === 'object' && Array.isArray(value.data)) return value.data
  return []
}

function safeRead(key = '') {
  return get(key, null)
}

function readList(key = '') {
  const value = get(key, [])
  return Array.isArray(value) ? value : []
}

function writeList(key = '', records = []) {
  set(key, Array.isArray(records) ? records : [])
}

function countValue(value) {
  if (Array.isArray(value)) return value.length
  if (!value || typeof value !== 'object') return value ? 1 : 0
  const commonKeys = ['records', 'data', 'items', 'tasks', 'projects', 'deliveries', 'orders', 'quotes', 'auditLogs', 'enterprises']
  const nestedCount = commonKeys.reduce((total, key) => total + (Array.isArray(value[key]) ? value[key].length : 0), 0)
  return nestedCount || Object.keys(value).length
}

function calculateChecksum(value) {
  const text = JSON.stringify(value || null)
  let hash = 0
  for (let index = 0; index < text.length; index += 1) {
    hash = ((hash << 5) - hash + text.charCodeAt(index)) | 0
  }
  return `chk_${Math.abs(hash).toString(16)}_${text.length}`
}

function getScopeDefinitions(scopeIds = []) {
  const selected = Array.isArray(scopeIds) && scopeIds.length
    ? new Set(scopeIds)
    : null
  return CORE_DATA_SCOPES.filter((scope) => !selected || selected.has(scope.scopeId))
}

function getOperator() {
  const member = getCurrentMember() || {}
  const user = getCurrentUser() || {}
  return {
    operatorId: member.memberId || member.userId || user.userId || '',
    operatorName: member.name || user.name || member.role || '平台管理员',
    role: member.role || member.roleId || ''
  }
}

function isHighestAdmin() {
  const role = String((getCurrentMember() || {}).role || (getCurrentMember() || {}).roleId || '')
  return ['super_admin', 'platform_admin', '平台管理员', '最高管理员'].includes(role)
}

export function requireDataRecoveryAdmin() {
  const platformGuard = requirePlatformAdmin()
  const production = typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'production'
  const allowed = platformGuard.allowed && (isHighestAdmin() || !production)
  return {
    allowed,
    reason: allowed ? '' : 'highest_admin_required',
    currentMember: getCurrentMember()
  }
}

function recordDataAudit(action = '', targetType = 'data_backup', targetId = '', after = {}) {
  const operator = getOperator()
  recordAudit({
    userId: operator.operatorId,
    operator: operator.operatorName,
    operatorId: operator.operatorId,
    action,
    targetType,
    targetId,
    before: {},
    after,
    createdAt: nowIso()
  })
}

function buildScopeSnapshot(scope = {}) {
  const entries = scope.storageKeys.map((storageKey) => {
    const value = safeRead(storageKey)
    return {
      storageKey,
      count: countValue(value),
      checksum: calculateChecksum(value),
      value
    }
  })
  return {
    scopeId: scope.scopeId,
    label: scope.label,
    storageKeys: scope.storageKeys,
    recordCount: entries.reduce((total, item) => total + item.count, 0),
    checksum: calculateChecksum(entries.map((item) => ({ storageKey: item.storageKey, checksum: item.checksum }))),
    entries
  }
}

function normalizeBackup(record = {}) {
  return {
    backupId: String(record.backupId || createId('backup')),
    scopes: Array.isArray(record.scopes) ? record.scopes : [],
    dataVersion: String(record.dataVersion || 'v1-local-snapshot'),
    startedAt: record.startedAt || record.createdAt || nowIso(),
    completedAt: record.completedAt || '',
    fileCount: Math.max(0, Number(record.fileCount) || 0),
    recordCount: Math.max(0, Number(record.recordCount) || 0),
    checksum: String(record.checksum || ''),
    checkResult: record.checkResult || { ok: false, issueCount: 0 },
    status: BACKUP_STATUSES.includes(record.status) ? record.status : 'pending',
    reason: BACKUP_REASONS.includes(record.reason) ? record.reason : 'manual_checkpoint',
    createdBy: record.createdBy || '',
    createdByName: record.createdByName || '',
    snapshot: record.snapshot && typeof record.snapshot === 'object' ? record.snapshot : null,
    storageStrategy: record.storageStrategy || {
      database: '数据库记录生成可校验快照，恢复时按范围写回。',
      cloudFiles: '云存储文件保留 fileId 与引用关系；正式文件需结合云存储生命周期策略做独立备份。'
    }
  }
}

function listBackupsRaw() {
  return readList(BACKUP_RECORD_KEY).map(normalizeBackup)
}

function saveBackups(records = []) {
  writeList(BACKUP_RECORD_KEY, records.map(normalizeBackup))
}

export function listBackups(filters = {}) {
  return listBackupsRaw()
    .filter((item) => !filters.status || item.status === filters.status)
    .sort((left, right) => String(right.startedAt).localeCompare(String(left.startedAt)))
}

export function createDataBackup(input = {}) {
  const guard = requireDataRecoveryAdmin()
  if (!guard.allowed) return { success: false, errorCode: guard.reason, message: '仅平台最高权限管理员可创建备份。' }
  const operator = getOperator()
  const startedAt = nowIso()
  const scopes = getScopeDefinitions(input.scopeIds).map(buildScopeSnapshot)
  const fileCount = listFileRecords().length
  const recordCount = scopes.reduce((total, scope) => total + scope.recordCount, 0)
  const backup = normalizeBackup({
    backupId: input.backupId || createId('backup'),
    scopes: scopes.map((scope) => ({
      scopeId: scope.scopeId,
      label: scope.label,
      storageKeys: scope.storageKeys,
      recordCount: scope.recordCount,
      checksum: scope.checksum
    })),
    startedAt,
    completedAt: nowIso(),
    fileCount,
    recordCount,
    checksum: calculateChecksum(scopes),
    checkResult: { ok: true, issueCount: 0 },
    status: 'completed',
    reason: input.reason || 'manual_checkpoint',
    createdBy: operator.operatorId,
    createdByName: operator.operatorName,
    snapshot: { scopes }
  })
  saveBackups([backup, ...listBackupsRaw().filter((item) => item.backupId !== backup.backupId)])
  recordDataAudit('创建数据备份', 'data_backup', backup.backupId, {
    reason: backup.reason,
    scopeCount: backup.scopes.length,
    recordCount,
    fileCount
  })
  console.log('[data:backup]', {
    backupId: backup.backupId,
    status: backup.status,
    recordCount,
    fileCount
  })
  return { success: true, backup }
}

function normalizeRecovery(record = {}) {
  return {
    recoveryId: String(record.recoveryId || createId('recovery')),
    backupId: String(record.backupId || ''),
    scopeIds: Array.isArray(record.scopeIds) ? record.scopeIds : [],
    reason: String(record.reason || ''),
    status: record.status || 'pending',
    currentSnapshotId: String(record.currentSnapshotId || ''),
    estimatedRecordCount: Math.max(0, Number(record.estimatedRecordCount) || 0),
    affectedStorageKeys: Array.isArray(record.affectedStorageKeys) ? record.affectedStorageKeys : [],
    executedBy: String(record.executedBy || ''),
    executedByName: String(record.executedByName || ''),
    createdAt: record.createdAt || nowIso(),
    completedAt: record.completedAt || '',
    checkResult: record.checkResult || { ok: false, issueCount: 0 }
  }
}

function listRecoveriesRaw() {
  return readList(RECOVERY_RECORD_KEY).map(normalizeRecovery)
}

function saveRecoveries(records = []) {
  writeList(RECOVERY_RECORD_KEY, records.map(normalizeRecovery))
}

export function buildRecoveryPreview(backupId = '', scopeIds = []) {
  const guard = requireDataRecoveryAdmin()
  if (!guard.allowed) return { success: false, errorCode: guard.reason, message: '仅平台最高权限管理员可预览恢复影响。' }
  const backup = listBackupsRaw().find((item) => item.backupId === backupId)
  if (!backup || backup.status !== 'completed' || !backup.snapshot) {
    return { success: false, errorCode: 'backup_not_found', message: '未找到可恢复的已完成备份。' }
  }
  const selected = getScopeDefinitions(scopeIds).map((scope) => scope.scopeId)
  const backupScopes = backup.snapshot.scopes.filter((scope) => selected.includes(scope.scopeId))
  const affectedStorageKeys = backupScopes.flatMap((scope) => scope.entries.map((entry) => entry.storageKey))
  return {
    success: true,
    backupId,
    scopeIds: backupScopes.map((scope) => scope.scopeId),
    affectedStorageKeys,
    estimatedRecordCount: backupScopes.reduce((total, scope) => total + scope.recordCount, 0),
    currentSnapshotRequired: true,
    warning: '恢复将按所选范围写回快照数据；不会默认整库覆盖，执行前会先创建当前状态快照。'
  }
}

export function executeScopedRecovery(input = {}) {
  const guard = requireDataRecoveryAdmin()
  if (!guard.allowed) return { success: false, errorCode: guard.reason, message: '仅平台最高权限管理员可执行恢复。' }
  if (String(input.confirmText || '').trim() !== '确认恢复') {
    return { success: false, errorCode: 'confirmation_required', message: '请输入“确认恢复”完成二次确认。' }
  }
  if (!String(input.reason || '').trim()) {
    return { success: false, errorCode: 'reason_required', message: '请填写恢复原因。' }
  }
  const preview = buildRecoveryPreview(input.backupId, input.scopeIds)
  if (!preview.success) return preview
  const currentSnapshot = createDataBackup({
    reason: 'before_schema_upgrade',
    backupId: createId('pre_restore_snapshot'),
    scopeIds: preview.scopeIds
  })
  if (!currentSnapshot.success) return currentSnapshot
  const backup = listBackupsRaw().find((item) => item.backupId === input.backupId)
  const backupScopes = backup.snapshot.scopes.filter((scope) => preview.scopeIds.includes(scope.scopeId))
  backupScopes.forEach((scope) => {
    scope.entries.forEach((entry) => set(entry.storageKey, entry.value))
  })
  const consistency = runDataConsistencyCheck()
  const operator = getOperator()
  const recovery = normalizeRecovery({
    recoveryId: createId('recovery'),
    backupId: input.backupId,
    scopeIds: preview.scopeIds,
    reason: input.reason,
    status: consistency.issueSummary.high > 0 ? 'completed_with_warnings' : 'completed',
    currentSnapshotId: currentSnapshot.backup.backupId,
    estimatedRecordCount: preview.estimatedRecordCount,
    affectedStorageKeys: preview.affectedStorageKeys,
    executedBy: operator.operatorId,
    executedByName: operator.operatorName,
    createdAt: nowIso(),
    completedAt: nowIso(),
    checkResult: { ok: consistency.issueSummary.high === 0, issueCount: consistency.issues.length }
  })
  saveRecoveries([recovery, ...listRecoveriesRaw()])
  recordDataAudit('执行范围恢复', 'data_recovery', recovery.recoveryId, {
    backupId: recovery.backupId,
    scopeCount: recovery.scopeIds.length,
    affectedStorageKeyCount: recovery.affectedStorageKeys.length,
    issueCount: consistency.issues.length
  })
  return { success: true, recovery, consistency }
}

function createIssue(type = '', level = 'medium', targetId = '', title = '', description = '', suggestion = '') {
  return {
    issueId: createId('data_issue'),
    type,
    level,
    targetId,
    title,
    description,
    suggestion,
    createdAt: nowIso(),
    status: 'open'
  }
}

export function runDataConsistencyCheck() {
  const guard = requireDataRecoveryAdmin()
  if (!guard.allowed) {
    return {
      canAccess: false,
      errorCode: guard.reason,
      issues: [],
      issueSummary: { high: 0, medium: 0, low: 0 },
      checkedAt: nowIso()
    }
  }
  const issues = []
  const projects = getProjects()
  const tasks = listTasks()
  const taskIds = new Set(tasks.map((task) => task.taskId).filter(Boolean))
  const projectsById = new Map(projects.map((project) => [project.projectId, project]))
  const files = listFileRecords()
  const fileIds = new Set(files.map((file) => file.fileId).filter(Boolean))
  const references = files.flatMap((file) => listFileReferences(file.fileId))
  const patternMasters = asArray(safeRead('diebians_pattern_library_masters_v1'))
  const patternVersions = asArray(safeRead('diebians_pattern_library_versions_v1'))
  const patternMasterIds = new Set(patternMasters.map((item) => item.patternMasterId).filter(Boolean))
  const deliveries = asArray(safeRead('diebi_workspace_delivery_v1'), 'deliveries')
  const quotaUsage = safeRead('membership_usage', {})

  projects.forEach((project) => {
    ;(project.taskIds || []).forEach((taskId) => {
      if (taskId && !taskIds.has(taskId)) {
        issues.push(createIssue('project_task_missing', 'high', project.projectId, '项目引用的任务不存在', `项目 ${project.projectId} 引用了缺失任务。`, '保留项目记录，人工确认是否移除引用或恢复任务快照。'))
      }
    })
  })

  tasks.forEach((task) => {
    if (task.projectId && !projectsById.has(task.projectId)) {
      issues.push(createIssue('task_project_missing', 'medium', task.taskId, '任务关联项目不存在', `任务 ${task.taskId} 指向的项目不存在。`, '先恢复项目记录，或将任务转入待归档队列。'))
    }
  })

  references.forEach((reference) => {
    if (reference.fileId && !fileIds.has(reference.fileId)) {
      issues.push(createIssue('file_reference_missing', 'high', reference.referenceId, '资产引用的文件不存在', '存在文件引用但找不到对应 fileId。', '恢复文件记录或取消无效引用，不要直接删除业务资产。'))
    }
  })

  patternVersions.forEach((version) => {
    if (version.patternMasterId && !patternMasterIds.has(version.patternMasterId)) {
      issues.push(createIssue('pattern_version_orphan', 'medium', version.versionId, '版型版本缺少主体', '发现 patternVersion 无法匹配 patternMaster。', '优先恢复 patternMaster，确认后再处理孤立版本。'))
    }
  })

  deliveries.forEach((delivery) => {
    ;(delivery.projectId ? [delivery.projectId] : []).forEach((projectId) => {
      if (projectId && !projectsById.has(projectId)) {
        issues.push(createIssue('delivery_project_missing', 'high', delivery.deliveryId, '交付记录关联项目不存在', '正式交付记录缺少项目上下文。', '恢复项目快照，禁止覆盖已交付文件。'))
      }
    })
  })

  if (quotaUsage && typeof quotaUsage === 'object') {
    Object.entries(quotaUsage).forEach(([accountId, value]) => {
      if (value && Number(value.used || 0) < 0) {
        issues.push(createIssue('quota_balance_invalid', 'high', accountId, '额度记录异常', '发现已用额度为负数。', '根据不可变流水重算余额，禁止直接修改余额。'))
      }
    })
  }

  const issueSummary = issues.reduce((summary, issue) => {
    summary[issue.level] = (summary[issue.level] || 0) + 1
    return summary
  }, { high: 0, medium: 0, low: 0 })

  const result = {
    canAccess: true,
    checkedAt: nowIso(),
    metrics: {
      projectCount: projects.length,
      taskCount: tasks.length,
      fileCount: files.length,
      fileReferenceCount: references.length,
      patternMasterCount: patternMasters.length,
      patternVersionCount: patternVersions.length,
      deliveryCount: deliveries.length
    },
    issueSummary,
    issues,
    suggestions: [
      '发现问题后先生成修复建议，不自动删除记录。',
      '正式恢复前先创建当前状态快照，并优先按项目、任务、版型或时间点恢复。',
      '云存储文件与数据库记录分开备份，业务数据长期保存稳定 fileId。'
    ]
  }
  console.log('[data:health]', {
    issueCount: issues.length,
    high: issueSummary.high,
    medium: issueSummary.medium
  })
  return result
}

function buildScopeSummaries() {
  return CORE_DATA_SCOPES.map((scope) => {
    const snapshot = buildScopeSnapshot(scope)
    return {
      scopeId: scope.scopeId,
      label: scope.label,
      storageKeyCount: scope.storageKeys.length,
      recordCount: snapshot.recordCount,
      checksum: snapshot.checksum,
      storageKeys: scope.storageKeys
    }
  })
}

export function listRecycleBin() {
  const manual = readList(RECYCLE_BIN_KEY)
  const fileItems = listFileRecords()
    .filter((file) => ['archived', 'pending_delete', 'deleted'].includes(file.status))
    .map((file) => ({
      recycleId: `file_${file.fileId}`,
      resourceType: 'file',
      resourceId: file.fileId,
      title: file.fileName || file.fileId,
      status: file.status,
      deletedBy: file.updatedBy || '',
      deletedAt: file.updatedAt || file.uploadedAt || '',
      plannedCleanupAt: file.status === 'pending_delete' ? '保留期后清理底层文件' : '保留引用，不立即清理'
    }))
  return [...manual, ...fileItems].sort((left, right) => String(right.deletedAt || '').localeCompare(String(left.deletedAt || '')))
}

export function recordRecoveryDrill(input = {}) {
  const guard = requireDataRecoveryAdmin()
  if (!guard.allowed) return { success: false, errorCode: guard.reason, message: '仅平台最高权限管理员可记录容灾演练。' }
  const drill = {
    drillId: createId('drill'),
    backupId: input.backupId || '',
    environment: input.environment || 'staging',
    status: input.status || 'completed',
    recordCheck: input.recordCheck || 'pending',
    fileAccessCheck: input.fileAccessCheck || 'pending',
    authPermissionCheck: input.authPermissionCheck || 'pending',
    quotaDeliveryCheck: input.quotaDeliveryCheck || 'pending',
    durationMinutes: Math.max(0, Number(input.durationMinutes) || 0),
    failedItems: Array.isArray(input.failedItems) ? input.failedItems : [],
    createdAt: nowIso(),
    createdByName: getOperator().operatorName
  }
  const records = [drill, ...readList(RECOVERY_DRILL_KEY)]
  writeList(RECOVERY_DRILL_KEY, records)
  recordDataAudit('记录恢复演练', 'data_recovery_drill', drill.drillId, {
    backupId: drill.backupId,
    status: drill.status,
    failedCount: drill.failedItems.length
  })
  return { success: true, drill }
}

export function loadDataRecoveryCenter(filters = {}) {
  const guard = requireDataRecoveryAdmin()
  if (!guard.allowed) {
    return {
      canAccess: false,
      reason: guard.reason,
      scopes: [],
      backups: [],
      recoveries: [],
      recycleBin: [],
      consistency: { issues: [], issueSummary: { high: 0, medium: 0, low: 0 }, metrics: {} },
      drills: [],
      policies: [],
      updatedAt: nowIso()
    }
  }
  const consistency = runDataConsistencyCheck()
  return {
    canAccess: true,
    reason: '',
    scopes: buildScopeSummaries(),
    backups: listBackups(filters),
    recoveries: listRecoveriesRaw().sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt))),
    recycleBin: listRecycleBin(),
    consistency,
    drills: readList(RECOVERY_DRILL_KEY),
    policies: [
      '备份失败必须进入预警，不只写日志。',
      '恢复前必须选择范围、创建当前快照、填写原因并二次确认。',
      '已交付记录、额度流水和审计日志不得由普通用户删除。',
      '一致性检查只生成修复建议，不自动删除数据。'
    ],
    updatedAt: nowIso()
  }
}

