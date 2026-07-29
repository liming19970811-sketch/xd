const fs = require('fs')
const path = require('path')

const VALID_STAGES = new Set(['draft', 'design', 'production', 'review', 'delivery', 'completed'])
const STAGE_ALIASES = {
  requirement: 'draft',
  requirement_confirmation: 'draft',
  pending: 'draft',
  planning: 'draft',
  designing: 'design',
  generating: 'production',
  processing: 'production',
  in_progress: 'production',
  reviewing: 'review',
  pending_review: 'review',
  delivered: 'delivery',
  confirmed: 'completed',
  archived: 'completed'
}

function parseArgs(argv = process.argv.slice(2)) {
  const args = { dryRun: true, enterpriseId: '', limit: 100, input: '' }
  argv.forEach((arg, index) => {
    if (arg === '--dry-run') args.dryRun = true
    if (arg === '--execute') args.dryRun = false
    if (arg === '--enterprise-id') args.enterpriseId = argv[index + 1] || ''
    if (arg === '--limit') args.limit = Number(argv[index + 1] || 100)
    if (arg === '--input') args.input = argv[index + 1] || ''
  })
  return args
}

function normalizeStage(value = '') {
  const key = String(value || '').trim().toLowerCase()
  return VALID_STAGES.has(key) ? key : (STAGE_ALIASES[key] || 'draft')
}

function readInput(file = '') {
  if (!file) return { projects: [], history: [] }
  const absolute = path.resolve(file)
  const value = JSON.parse(fs.readFileSync(absolute, 'utf8'))
  if (Array.isArray(value)) return { projects: value, history: [] }
  return {
    projects: Array.isArray(value.projects) ? value.projects : [],
    history: Array.isArray(value.history) ? value.history : []
  }
}

function normalizeProject(record = {}, enterpriseId = '') {
  const now = new Date().toISOString()
  const projectId = String(record.projectId || '').trim()
  if (!projectId) return null
  const stage = normalizeStage(record.stage || record.status)
  return {
    projectId,
    enterpriseId: enterpriseId || record.enterpriseId || '',
    name: String(record.name || record.projectName || record.title || '未命名项目').slice(0, 80),
    description: String(record.description || '').slice(0, 500),
    stage,
    status: record.status || stage,
    customerName: String(record.customerName || record.clientName || '').slice(0, 80),
    ownerMemberId: record.ownerMemberId || '',
    ownerName: String(record.ownerName || record.owner || '').slice(0, 60),
    startDate: record.startDate || '',
    dueDate: record.dueDate || record.deadline || '',
    createdByMemberId: record.createdByMemberId || '',
    createdAt: record.createdAt || now,
    updatedAt: record.updatedAt || record.createdAt || now,
    version: Number(record.version || 1)
  }
}

function normalizeHistory(record = {}, enterpriseId = '') {
  const projectId = String(record.projectId || '').trim()
  if (!projectId) return null
  return {
    historyId: record.historyId || '',
    enterpriseId: enterpriseId || record.enterpriseId || '',
    projectId,
    fromStage: normalizeStage(record.fromStage),
    toStage: normalizeStage(record.toStage),
    operatorMemberId: record.operatorMemberId || '',
    operatorName: record.operatorName || '',
    reason: String(record.reason || '').slice(0, 200),
    idempotencyKey: record.idempotencyKey || `migrate_${projectId}_${record.createdAt || Date.now()}`,
    projectVersion: Number(record.projectVersion || 0),
    createdAt: record.createdAt || new Date().toISOString()
  }
}

function main() {
  const args = parseArgs()
  const source = readInput(args.input)
  const projects = source.projects
    .slice(0, Number.isFinite(args.limit) ? args.limit : 100)
    .map((item) => normalizeProject(item, args.enterpriseId))
    .filter(Boolean)
  const projectIds = new Set(projects.map((item) => item.projectId))
  const history = source.history
    .map((item) => normalizeHistory(item, args.enterpriseId))
    .filter((item) => item && projectIds.has(item.projectId))

  const result = {
    dryRun: args.dryRun,
    enterpriseIdProvided: Boolean(args.enterpriseId),
    projectCount: projects.length,
    historyCount: history.length,
    successCount: 0,
    skippedCount: 0,
    failedCount: 0
  }

  if (!args.dryRun) {
    result.failedCount = projects.length + history.length
    result.message = '真实写入需在接入 CloudBase 管理凭证后执行；当前脚本默认仅做结构校验和 dry-run。'
  }

  console.log('[enterprise-project-migrate]', result)
}

main()
