const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')

function read(file) {
  return fs.readFileSync(path.join(root, file), 'utf8')
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

function assertIncludes(text, values, label) {
  values.forEach((value) => {
    assert(text.includes(value), `${label} missing: ${value}`)
  })
}

const catalog = read('utils/schema/schemaCatalog.js')
const migration = read('utils/schema/migrationGovernance.js')
const page = read('pages/admin-schema-governance/admin-schema-governance.vue')
const docs = read('docs/database-governance-v1.md')

assertIncludes(catalog, [
  'users',
  'enterprises',
  'memberships',
  'usageRecords',
  'projects',
  'batches',
  'tasks',
  'assets',
  'deliveries',
  'patternMasters',
  'patternVersions',
  'reviews',
  'leads',
  'tickets',
  'auditLogs',
  'notifications'
], 'data dictionary')

assertIncludes(catalog, [
  'id',
  'ownerId',
  'enterpriseId',
  'createdBy',
  'createdAt',
  'updatedAt',
  'status',
  'schemaVersion',
  'deletedAt',
  'deletedBy',
  'deleteReason'
], 'common fields')

assertIncludes(catalog, [
  'enterpriseId',
  'updatedAt',
  'ownerId',
  'status',
  'createdAt',
  'projectId',
  'batchId',
  'patternMasterId',
  'version',
  'idempotencyKey',
  'leadId'
], 'index fields')

assertIncludes(migration, [
  'previewMigration',
  'runMigrationBatch',
  'runSchemaIntegrityCheck',
  'dryRun',
  'manual_migration',
  'createDataBackup'
], 'migration governance')

assertIncludes(page, [
  '数据字典',
  '状态枚举',
  '索引分页',
  '迁移治理',
  'Dry-run'
], 'schema governance page')

assertIncludes(docs, [
  '不在页面加载时静默改写历史记录',
  '大列表必须分页',
  '无法自动迁移的数据进入人工处理清单',
  '/#/admin/schema-governance'
], 'governance docs')

console.log('[schema-governance-smoke] ok')
