const fs = require('fs')
const path = require('path')
const vm = require('vm')
const assert = require('assert')

const root = path.resolve(__dirname, '..')
const sourcePath = path.join(root, 'utils/admin/incidentContinuityCenter.js')
let source = fs.readFileSync(sourcePath, 'utf8')

source = source
  .replace(/^import .+$/gm, '')
  .replace(/export const /g, 'const ')
  .replace(/export function /g, 'function ')

source += `
globalThis.__incidentExports = {
  INCIDENT_LEVELS,
  PUBLIC_COMPONENTS,
  EMERGENCY_SWITCHES,
  TASK_RECOVERY_RULES,
  QUOTA_GUARDRAILS,
  DELIVERY_BLOCKERS,
  RECOVERY_CHECKLIST,
  loadPublicStatusPage,
  loadIncidentAdminCenter,
  createIncident,
  updateIncidentStatus,
  setEmergencySwitch,
  createRecoveryChecklist,
  getTaskRecoveryDecision,
  shouldPauseFormalDelivery
}
`

const memory = {}
const logs = []
let platformAllowed = true

const context = {
  console,
  Date,
  Math,
  String,
  Boolean,
  Array,
  Object,
  Map,
  Number,
  get(key, fallback) {
    return Object.prototype.hasOwnProperty.call(memory, key) ? memory[key] : fallback
  },
  set(key, value) {
    memory[key] = value
  },
  requirePlatformAdmin() {
    return { allowed: platformAllowed, reason: platformAllowed ? '' : 'platform_admin_required' }
  },
  writeStructuredLog(input) {
    logs.push(input)
    return { ok: true, log: input }
  },
  globalThis: {}
}

vm.createContext(context)
vm.runInContext(source, context, { filename: sourcePath })

const api = context.globalThis.__incidentExports

assert.strictEqual(api.INCIDENT_LEVELS.length, 4)
assert.ok(api.INCIDENT_LEVELS.some((item) => item.key === 'P0' && item.title.includes('重复扣费')))
assert.ok(api.EMERGENCY_SWITCHES.some((item) => item.key === 'formal_delivery'))
assert.ok(api.DELIVERY_BLOCKERS.includes('mock或fallback标记'))

let publicStatus = api.loadPublicStatusPage()
assert.strictEqual(publicStatus.overallStatus, 'operational')
assert.strictEqual(publicStatus.components.length, 7)
assert.ok(publicStatus.userNoticeRules.every((item) => !/provider|secret|token|server/i.test(item)))

platformAllowed = false
let denied = api.loadIncidentAdminCenter()
assert.strictEqual(denied.canAccess, false)
assert.strictEqual(api.createIncident({ level: 'P1', title: 'should fail' }).success, false)

platformAllowed = true
const incidentResult = api.createIncident({
  level: 'P0',
  title: '重复扣费保护演练',
  affectedComponents: ['ai_output', 'download_delivery'],
  affectedUserCount: 2,
  affectedTaskCount: 3,
  temporaryActions: ['暂停新任务创建', '暂停正式交付']
})
assert.strictEqual(incidentResult.success, true)
assert.strictEqual(incidentResult.incident.level, 'P0')
assert.ok(logs.some((item) => item.action === 'incident_created' && item.level === 'critical'))

publicStatus = api.loadPublicStatusPage()
assert.strictEqual(publicStatus.overallStatus, 'major_outage')
assert.ok(publicStatus.activeIncidents.every((item) => !Object.prototype.hasOwnProperty.call(item, 'rootCause')))
assert.ok(publicStatus.activeIncidents.every((item) => !Object.prototype.hasOwnProperty.call(item, 'dataRepair')))

const pause = api.setEmergencySwitch('formal_delivery', true, {
  reason: 'mock或fallback标记进入审核队列',
  incidentId: incidentResult.incident.incidentId
})
assert.strictEqual(pause.success, true)
assert.strictEqual(pause.switch.paused, true)

const admin = api.loadIncidentAdminCenter()
assert.strictEqual(admin.canAccess, true)
assert.strictEqual(admin.stats.p0p1Count, 1)
assert.strictEqual(admin.stats.pausedSwitchCount, 1)
assert.ok(admin.quotaGuardrails.includes('相同幂等键不重复扣费'))

const unknown = api.getTaskRecoveryDecision('called_unknown')
assert.strictEqual(unknown.action, '先查询供应商')
assert.ok(unknown.guardrail.includes('禁止重复提交'))
assert.strictEqual(api.shouldPauseFormalDelivery('存在mock或fallback标记'), true)
assert.strictEqual(api.shouldPauseFormalDelivery('普通样式问题'), false)

const checklist = api.RECOVERY_CHECKLIST.map((label) => ({ label, passed: true, note: 'smoke passed' }))
const recovery = api.createRecoveryChecklist(incidentResult.incident.incidentId, checklist)
assert.strictEqual(recovery.success, true)
assert.ok(recovery.recovery.verifiedAt)

const resolved = api.updateIncidentStatus(incidentResult.incident.incidentId, 'resolved')
assert.strictEqual(resolved.success, true)

const resume = api.setEmergencySwitch('formal_delivery', false, { reason: '恢复验收通过' })
assert.strictEqual(resume.success, true)
assert.strictEqual(resume.switch.paused, false)

publicStatus = api.loadPublicStatusPage()
assert.notStrictEqual(publicStatus.overallStatus, 'major_outage')

const pagesJson = fs.readFileSync(path.join(root, 'pages.json'), 'utf8')
assert.ok(pagesJson.includes('pages/status/status'))
assert.ok(pagesJson.includes('pages/admin-incidents'))

const statusPage = fs.readFileSync(path.join(root, 'pages/status/status.vue'), 'utf8')
assert.ok(statusPage.includes('不展示内部供应商'))
const adminPage = fs.readFileSync(path.join(root, 'pages/admin-incidents/admin-incidents.vue'), 'utf8')
assert.ok(adminPage.includes('紧急开关'))
assert.ok(adminPage.includes('恢复验收'))

console.log('[incident-continuity-smoke] ok')
