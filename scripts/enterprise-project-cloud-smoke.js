const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8')
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function includesAll(source, values, label) {
  values.forEach((value) => {
    assert(source.includes(value), `${label} missing: ${value}`)
  })
}

const cloudFunction = read('cloudfunctions/enterprise_project/index.js')
const transport = read('utils/project/enterpriseProjectTransport.js')
const service = read('utils/project/projectService.js')
const stageService = read('utils/project/projectStageService.js')
const projectsPage = read('pages/enterprise-web/projects.vue')
const detailPage = read('pages/enterprise-web/project-detail.vue')

includesAll(cloudFunction, [
  'getProjectList',
  'getProjectDetail',
  'createProject',
  'updateProject',
  'deleteProject',
  'advanceProjectStage',
  'getProjectStageHistory'
], 'enterprise_project action')

includesAll(cloudFunction, [
  'INVALID_ACTION',
  'INVALID_ARGUMENT',
  'AUTH_REQUIRED',
  'SESSION_INVALID',
  'SESSION_EXPIRED',
  'SESSION_REVOKED',
  'MEMBER_NOT_FOUND',
  'MEMBER_NOT_ACTIVE',
  'FORBIDDEN',
  'PROJECT_NOT_FOUND',
  'PROJECT_STAGE_INVALID',
  'PROJECT_STAGE_CONFLICT',
  'PROJECT_VERSION_CONFLICT',
  'PROJECT_ALREADY_COMPLETED',
  'PROJECT_HAS_RELATED_BUSINESS',
  'IDEMPOTENCY_KEY_REQUIRED',
  'TENANT_MISMATCH',
  'INTERNAL_ERROR'
], 'enterprise_project error code')

includesAll(cloudFunction, [
  'PROJECT_CREATED',
  'PROJECT_UPDATED',
  'PROJECT_DELETED',
  'PROJECT_STAGE_ADVANCED'
], 'project audit action')

includesAll(cloudFunction, [
  'project.view',
  'project.manage',
  'project.delete',
  'enterprise_project_stage_history',
  'idempotencyKey',
  'expectedStage',
  'expectedVersion'
], 'project cloud contract')

includesAll(transport, ['enterprise_project', 'sessionToken', 'callCloudWebFunction'], 'project transport')
includesAll(service, ['getProjects', 'getProjectDetail', 'createProject', 'updateProject', 'deleteProject'], 'project service')
includesAll(stageService, ['advanceProjectStage', 'getProjectStageHistory', 'idempotencyKey', 'expectedVersion'], 'project stage service')

assert(!projectsPage.includes('enterpriseId:'), 'projects page must not assemble enterpriseId')
assert(!detailPage.includes('enterpriseId:'), 'project detail page must not assemble enterpriseId')
assert(detailPage.includes('expectedStage'), 'project detail must send expectedStage')
assert(detailPage.includes('expectedVersion'), 'project detail must send expectedVersion')
assert(detailPage.includes('idempotencyKey'), 'project detail must send idempotencyKey')

const logLines = cloudFunction.split(/\r?\n/).filter((line) => line.includes('console.'))
const unsafeLogPattern = /(sessionToken|OPENID|openid|UNIONID|accessToken|Secret|description|customerContact)/i
const unsafeLog = logLines.find((line) => unsafeLogPattern.test(line))
assert(!unsafeLog, `unsafe log field found: ${unsafeLog || ''}`)

console.log('[enterprise-project-cloud-smoke] passed')
