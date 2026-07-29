const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')

function resolvePath(relativePath) {
  return path.join(root, relativePath)
}

function exists(relativePath) {
  return fs.existsSync(resolvePath(relativePath))
}

function read(relativePath) {
  return fs.readFileSync(resolvePath(relativePath), 'utf8')
}

function walk(relativePath, result = []) {
  const absolute = resolvePath(relativePath)
  if (!fs.existsSync(absolute)) return result
  const stat = fs.statSync(absolute)
  if (stat.isFile()) {
    result.push(relativePath.replace(/\\/g, '/'))
    return result
  }
  fs.readdirSync(absolute).forEach((name) => walk(path.join(relativePath, name), result))
  return result
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function includesAll(source, values, label) {
  values.forEach((value) => assert(source.includes(value), `${label} missing: ${value}`))
}

function findUnsafeConsole(source, label) {
  const unsafe = /(sessionToken|OPENID|openid|UNIONID|accessToken|Secret|secretId|secretKey|authorization|inviteToken|confirmToken|phone|email|targetAccount|fileUrl|previewUrl)/i
  return source
    .split(/\r?\n/)
    .map((line, index) => ({ line, lineNumber: index + 1 }))
    .find((item) => item.line.includes('console.') && unsafe.test(item.line))
    ? `${label}: unsafe console output`
    : ''
}

const requiredFunctions = [
  'enterprise_auth',
  'enterprise_web_login',
  'enterprise_member',
  'enterprise_project',
  'enterprise_delivery'
]

const functionActions = {
  enterprise_auth: ['registerEnterprise', 'listEnterprises', 'switchEnterprise', 'restoreSession', 'logout'],
  enterprise_web_login: ['createTicket', 'getTicketStatus', 'consumeTicket', 'cancelTicket', 'getConfirmContext', 'confirmTicket'],
  enterprise_member: ['listMembers', 'createInvite', 'cancelInvite', 'acceptInvite', 'listRolePermissions', 'updateRolePermissions', 'updateMemberRole', 'updateMemberStatus'],
  enterprise_project: ['getProjectList', 'getProjectDetail', 'createProject', 'updateProject', 'advanceProjectStage', 'getProjectStageHistory'],
  enterprise_delivery: ['getDeliveryDashboard', 'listDeliveries', 'getDeliveryDetail', 'createDeliveryFromOrder', 'submitDelivery', 'startDeliveryReview', 'approveDelivery', 'rejectDelivery', 'confirmDeliveryByCustomer', 'completeDelivery', 'cancelDelivery']
}

const requiredPermissions = [
  'member.view',
  'member.manage',
  'role.view',
  'role.manage',
  'project.view',
  'project.manage',
  'project.delete',
  'quote.view',
  'quote.manage',
  'order.view',
  'order.manage',
  'delivery.view',
  'delivery.manage',
  'delivery.approve',
  'audit.view',
  'analytics.view'
]

const requiredCollections = [
  'enterprises',
  'enterprise_members',
  'enterprise_auth_sessions',
  'enterprise_auth_users',
  'enterprise_auth_identities',
  'enterprise_member_invites',
  'enterprise_role_permissions',
  'enterprise_projects',
  'enterprise_project_stage_history',
  'enterprise_quotes',
  'enterprise_orders',
  'enterprise_deliveries',
  'enterprise_delivery_items',
  'enterprise_delivery_action_history'
]

const cloudFiles = requiredFunctions.map((name) => `cloudfunctions/${name}/index.js`)
const cloudSources = cloudFiles.map((file) => [file, exists(file) ? read(file) : ''])
const allSourceFiles = [
  ...walk('cloudfunctions/enterprise_auth'),
  ...walk('cloudfunctions/enterprise_web_login'),
  ...walk('cloudfunctions/enterprise_member'),
  ...walk('cloudfunctions/enterprise_project'),
  ...walk('cloudfunctions/enterprise_delivery'),
  ...walk('utils/auth'),
  ...walk('utils/member'),
  ...walk('utils/project'),
  ...walk('utils/service'),
  ...walk('utils/delivery'),
  ...walk('utils/permission'),
  ...walk('pages/enterprise-web')
].filter((file) => /\.(js|vue|json|md)$/.test(file))

const joinedSources = allSourceFiles.map((file) => exists(file) ? read(file) : '').join('\n')

requiredFunctions.forEach((name) => {
  const dir = `cloudfunctions/${name}`
  const index = `${dir}/index.js`
  const packageJson = `${dir}/package.json`
  assert(exists(dir), `${name} directory missing`)
  assert(exists(index), `${name} index.js missing`)
  assert(exists(packageJson), `${name} package.json missing`)
  JSON.parse(read(packageJson))
  const source = walk(dir).filter((file) => file.endsWith('.js')).map(read).join('\n')
  includesAll(source, functionActions[name], `${name} action`)
  assert(!/Hello World|hello world|mock hello|sample response/i.test(source), `${name} contains sample or hello world logic`)
  assert(!source.includes('�'), `${name} contains replacement characters`)
  const unsafeLog = findUnsafeConsole(source, name)
  assert(!unsafeLog, unsafeLog)
})

includesAll(read('utils/permission/permissionCatalog.js'), requiredPermissions, 'permission catalog')
includesAll(read('utils/delivery/deliveryStatus.js'), ['draft', 'preparing', 'submitted', 'reviewing', 'approved', 'rejected', 'customer_confirmed', 'completed', 'cancelled', 'canTransitionDelivery'], 'delivery status machine')
includesAll(read('utils/project/projectStage.js'), ['draft', 'design', 'production', 'review', 'delivery', 'completed'], 'project stage machine')
includesAll(read('utils/service/orderService.js'), ['sourceQuoteId', 'createOrderFromQuote'], 'quote/order idempotency')
includesAll(read('cloudfunctions/enterprise_delivery/index.js'), ['DELIVERY_ITEM_REQUIRED', 'DELIVERY_ITEM_NOT_ELIGIBLE', 'isMock', 'isFallback', 'sourceType', 'deliveryEligible'], 'formal delivery redline')
includesAll(read('cloudfunctions/enterprise_delivery/index.js'), ['expectedVersion', 'idempotencyKey', 'DELIVERY_VERSION_CONFLICT', 'DELIVERY_STATUS_CONFLICT'], 'delivery concurrency')
includesAll(read('cloudfunctions/enterprise_project/index.js'), ['expectedStage', 'expectedVersion', 'idempotencyKey'], 'project concurrency')
includesAll(read('cloudfunctions/enterprise_member/index.js'), ['PERMISSION_VERSION_CONFLICT', 'LAST_ADMIN_PROTECTION'], 'member RBAC safety')

requiredCollections.forEach((collection) => {
  assert(joinedSources.includes(collection), `collection usage missing: ${collection}`)
})

walk('pages/enterprise-web').filter((file) => file.endsWith('.vue')).forEach((file) => {
  const source = read(file)
  assert(!source.includes('enterpriseId:'), `${file} must not assemble enterpriseId`)
  assert(!source.includes('�'), `${file} contains replacement characters`)
  const openViews = (source.match(/<view\b/g) || []).length
  const closeViews = (source.match(/<\/view>/g) || []).length
  assert(openViews === closeViews, `${file} view tag mismatch ${openViews}/${closeViews}`)
})

allSourceFiles.forEach((file) => {
  const source = read(file)
  assert(!source.includes('�'), `${file} contains replacement characters`)
  assert(!/(DASHSCOPE_API_KEY\s*=\s*['"][^'"]+|secretKey\s*:\s*['"][^'"]+|sessionToken\s*:\s*['"][^'"]+)/i.test(source), `${file} appears to contain hardcoded credential`)
})

const manualRequired = [
  'cloud function deployment evidence',
  'cloud database collection existence',
  'cloud database index existence',
  'single-account cloud flow test',
  'multi-account RBAC test',
  'cross-enterprise isolation test',
  'real customer confirmation credential test',
  'device-level end-to-end test'
]

console.log('[enterprise-cloud-release-smoke] static checks passed')
console.log(`[enterprise-cloud-release-smoke] checked functions: ${requiredFunctions.join(', ')}`)
console.log(`[enterprise-cloud-release-smoke] manual_required: ${manualRequired.join(', ')}`)
