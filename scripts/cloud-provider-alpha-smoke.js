const assert = require('assert')
const fs = require('fs')
const os = require('os')
const path = require('path')
const Module = require('module')
const { pathToFileURL } = require('url')

const ROOT = path.resolve(__dirname, '..')
const AUTH_KEY = 'diebiandesign_auth_context_v1'

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

function createMemoryDatabase() {
  const state = {
    enterprises: [],
    enterprise_members: [],
    enterprise_projects: []
  }
  let sequence = 0
  let failNextCollection = ''

  function matches(record, where) {
    return Object.entries(where || {}).every(([key, value]) => record?.[key] === value)
  }

  function collectionApi(collectionName) {
    if (!state[collectionName]) state[collectionName] = []
    return {
      where(where) {
        let max = 100
        return {
          limit(value) {
            max = value
            return this
          },
          async get() {
            return { data: clone(state[collectionName].filter((item) => matches(item, where)).slice(0, max)) }
          }
        }
      },
      doc(id) {
        return {
          async update({ data }) {
            const index = state[collectionName].findIndex((item) => item._id === id)
            if (index < 0) throw new Error('document_not_found')
            state[collectionName][index] = { ...state[collectionName][index], ...clone(data) }
            return { stats: { updated: 1 } }
          },
          async remove() {
            const index = state[collectionName].findIndex((item) => item._id === id)
            if (index < 0) throw new Error('document_not_found')
            state[collectionName].splice(index, 1)
            return { stats: { removed: 1 } }
          }
        }
      },
      async add({ data }) {
        if (failNextCollection === collectionName) {
          failNextCollection = ''
          throw new Error('injected_write_failure')
        }
        const saved = { _id: `doc_${++sequence}`, ...clone(data) }
        state[collectionName].push(saved)
        return { _id: saved._id }
      }
    }
  }

  return {
    state,
    collection: collectionApi,
    failNextWrite(collectionName) {
      failNextCollection = collectionName
    },
    async runTransaction(handler) {
      const snapshot = clone(state)
      try {
        return await handler({ collection: collectionApi })
      } catch (error) {
        Object.keys(state).forEach((key) => { state[key] = clone(snapshot[key] || []) })
        throw error
      }
    }
  }
}

function installCloudFunctionMock(database) {
  let currentOpenId = 'openid_a'
  const logs = []
  const cloudMock = {
    DYNAMIC_CURRENT_ENV: 'mock-env',
    init() {},
    database() { return database },
    getWXContext() { return { OPENID: currentOpenId } }
  }
  const originalLoad = Module._load
  const originalLog = console.log
  Module._load = function patchedLoad(request, parent, isMain) {
    if (request === 'wx-server-sdk') return cloudMock
    return originalLoad.call(this, request, parent, isMain)
  }
  console.log = (...args) => logs.push(args)
  const functionPath = path.join(ROOT, 'cloudfunctions', 'enterprise_data', 'index.js')
  delete require.cache[require.resolve(functionPath)]
  const cloudFunction = require(functionPath)
  Module._load = originalLoad
  console.log = originalLog
  return {
    main: async (event) => {
      const savedLog = console.log
      console.log = (...args) => logs.push(args)
      try {
        return await cloudFunction.main(event)
      } finally {
        console.log = savedLog
      }
    },
    setOpenId(value) { currentOpenId = value },
    logs
  }
}

function createUniStorage() {
  const storage = new Map()
  return {
    storage,
    api: {
      getStorageSync(key) { return storage.has(key) ? storage.get(key) : '' },
      setStorageSync(key, value) { storage.set(key, value) },
      removeStorageSync(key) { storage.delete(key) }
    }
  }
}

async function loadProviderModules() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'diebi-cloud-alpha-'))
  fs.mkdirSync(path.join(tempDir, 'data-provider'), { recursive: true })
  fs.mkdirSync(path.join(tempDir, 'migration'), { recursive: true })
  const files = ['localProvider', 'cloudProvider', 'dataProvider']
  for (const name of files) {
    const sourcePath = path.join(ROOT, 'utils', 'data-provider', `${name}.js`)
    const source = fs.readFileSync(sourcePath, 'utf8').replace(/\.\/([A-Za-z]+Provider)\.js/g, './$1.mjs')
    fs.writeFileSync(path.join(tempDir, 'data-provider', `${name}.mjs`), source)
  }
  const migrationSource = fs.readFileSync(path.join(ROOT, 'utils', 'migration', 'migrationService.js'), 'utf8')
    .replace('../data-provider/localProvider.js', '../data-provider/localProvider.mjs')
  fs.writeFileSync(path.join(tempDir, 'migration', 'migrationService.mjs'), migrationSource)
  const cloudProviderModule = await import(`${pathToFileURL(path.join(tempDir, 'data-provider', 'cloudProvider.mjs')).href}?v=${Date.now()}`)
  const dataProviderModule = await import(`${pathToFileURL(path.join(tempDir, 'data-provider', 'dataProvider.mjs')).href}?v=${Date.now()}`)
  const migrationModule = await import(`${pathToFileURL(path.join(tempDir, 'migration', 'migrationService.mjs')).href}?v=${Date.now()}`)
  return { cloudProviderModule, dataProviderModule, migrationModule, tempDir }
}

function setTenant(storageApi, enterpriseId) {
  storageApi.setStorageSync(AUTH_KEY, { currentEnterprise: { enterpriseId } })
}

function assertResultShape(result) {
  assert.strictEqual(typeof result, 'object')
  for (const key of ['ok', 'status', 'data', 'errorCode', 'message']) {
    assert.ok(Object.prototype.hasOwnProperty.call(result, key), `missing result field: ${key}`)
  }
}

async function run() {
  const database = createMemoryDatabase()
  const cloudFunction = installCloudFunctionMock(database)
  const uniStorage = createUniStorage()
  global.uni = uniStorage.api
  const { cloudProviderModule, dataProviderModule, migrationModule, tempDir } = await loadProviderModules()
  const cloudProvider = cloudProviderModule.default
  const cleanup = () => fs.rmSync(tempDir, { recursive: true, force: true })
  let cloudCallCount = 0
  let lastPayload = null

  cloudProviderModule.setCloudCallAdapter(async (payload) => {
    cloudCallCount += 1
    lastPayload = clone(payload)
    return { result: await cloudFunction.main(payload) }
  })

  try {
    dataProviderModule.configureDataProvider({ mode: 'local' })
    dataProviderModule.set('local_probe', { ok: true })
    assert.deepStrictEqual(dataProviderModule.get('local_probe'), { ok: true })
    assert.strictEqual(cloudCallCount, 0, 'local mode must not call cloud function')

    dataProviderModule.configureDataProvider({ environment: 'production', cloudProvider })
    assert.strictEqual(dataProviderModule.getDataSourceMode(), 'local', 'production must not implicitly enable cloud mode')

    uniStorage.api.setStorageSync('diebiandesign_enterprise_team_v1', {
      enterprises: [{ enterpriseId: 'legacy_enterprise', members: [{ memberId: 'legacy_member' }] }]
    })
    uniStorage.api.setStorageSync('diebiandesign_projects', [{ projectId: 'legacy_project', enterpriseId: 'legacy_enterprise' }])
    const storageBeforePlan = clone([...uniStorage.storage.entries()])
    const callsBeforePlan = cloudCallCount
    const migrationPlan = migrationModule.buildCloudMigrationPlan()
    assert.strictEqual(migrationPlan.dryRun, true)
    assert.strictEqual(migrationPlan.enterpriseCount, 1)
    assert.strictEqual(migrationPlan.memberCount, 1)
    assert.strictEqual(migrationPlan.projectCount, 1)
    assert.strictEqual(cloudCallCount, callsBeforePlan, 'migration dry-run must not call cloud')
    assert.deepStrictEqual(clone([...uniStorage.storage.entries()]), storageBeforePlan, 'migration dry-run must not write local storage')

    dataProviderModule.configureDataProvider({ mode: 'cloud', cloudProvider })

    setTenant(uniStorage.api, 'enterprise_a')
    cloudFunction.setOpenId('openid_a')
    const firstCreate = await cloudProvider.set({ collection: 'enterprises' }, {
      enterpriseId: 'enterprise_a',
      enterpriseName: 'Enterprise A'
    })
    assertResultShape(firstCreate)
    assert.strictEqual(firstCreate.ok, true)
    assert.strictEqual(lastPayload.action, 'set')
    assert.strictEqual(lastPayload.collection, 'enterprises')
    assert.strictEqual(lastPayload.enterpriseId, 'enterprise_a')
    assert.strictEqual(database.state.enterprises.length, 1)
    assert.strictEqual(database.state.enterprise_members.length, 1)
    assert.strictEqual(database.state.enterprise_members[0].role, 'admin')
    assert.strictEqual(database.state.enterprise_members[0].status, 'active')

    const idempotentCreate = await cloudProvider.set({ collection: 'enterprises' }, {
      enterpriseId: 'enterprise_a',
      enterpriseName: 'Enterprise A'
    })
    assert.strictEqual(idempotentCreate.ok, true)
    assert.strictEqual(database.state.enterprises.length, 1)
    assert.strictEqual(database.state.enterprise_members.length, 1)

    setTenant(uniStorage.api, 'enterprise_second')
    const secondEnterpriseDenied = await cloudProvider.set({ collection: 'enterprises' }, {
      enterpriseId: 'enterprise_second', enterpriseName: 'Second Enterprise'
    })
    assert.strictEqual(secondEnterpriseDenied.status, 'unauthorized')
    assert.strictEqual(database.state.enterprises.some((item) => item.enterpriseId === 'enterprise_second'), false)
    setTenant(uniStorage.api, 'enterprise_a')

    const projectCreate = await cloudProvider.set({ collection: 'projects' }, {
      projectId: 'project_a',
      enterpriseId: 'enterprise_a',
      title: 'Project A'
    })
    assert.strictEqual(projectCreate.ok, true)
    const projectGet = await cloudProvider.get({ collection: 'projects', recordId: 'project_a' })
    assert.strictEqual(projectGet.data.title, 'Project A')
    const projectUpdate = await cloudProvider.set({ collection: 'projects' }, {
      projectId: 'project_a',
      enterpriseId: 'enterprise_a',
      title: 'Project A Updated'
    })
    assert.strictEqual(projectUpdate.data.title, 'Project A Updated')
    const projectQuery = await cloudProvider.query({ collection: 'projects' })
    assert.strictEqual(projectQuery.data.length, 1)

    setTenant(uniStorage.api, 'enterprise_b')
    cloudFunction.setOpenId('openid_b')
    assert.strictEqual((await cloudProvider.set({ collection: 'enterprises' }, {
      enterpriseId: 'enterprise_b', enterpriseName: 'Enterprise B'
    })).ok, true)
    assert.strictEqual((await cloudProvider.set({ collection: 'projects' }, {
      projectId: 'project_b', enterpriseId: 'enterprise_b', title: 'Project B'
    })).ok, true)

    setTenant(uniStorage.api, 'enterprise_a')
    cloudFunction.setOpenId('openid_a')
    const tenantMismatch = await cloudProvider.get({ collection: 'projects', recordId: 'project_b' })
    assert.strictEqual(tenantMismatch.status, 'tenant_mismatch')
    assert.strictEqual(tenantMismatch.data, null)

    const pendingCreate = await cloudProvider.set({ collection: 'members' }, {
      memberId: 'member_pending',
      targetOpenId: 'openid_pending',
      role: 'member',
      status: 'pending'
    })
    assert.strictEqual(pendingCreate.ok, true)
    cloudFunction.setOpenId('openid_pending')
    const pendingDenied = await cloudProvider.query({ collection: 'projects' })
    assert.strictEqual(pendingDenied.status, 'member_inactive')
    cloudFunction.setOpenId('openid_a')
    assert.strictEqual((await cloudProvider.set({ collection: 'members' }, {
      memberId: 'member_pending', role: 'member', status: 'disabled'
    })).ok, true)
    cloudFunction.setOpenId('openid_pending')
    const disabledDenied = await cloudProvider.query({ collection: 'projects' })
    assert.strictEqual(disabledDenied.status, 'member_inactive')

    cloudFunction.setOpenId('openid_outsider')
    const outsiderDenied = await cloudProvider.query({ collection: 'projects' })
    assert.strictEqual(outsiderDenied.status, 'member_not_found')
    cloudFunction.setOpenId('openid_a')
    assert.strictEqual((await cloudProvider.set({ collection: 'members' }, {
      memberId: 'member_active', targetOpenId: 'openid_member', role: 'member', status: 'active'
    })).ok, true)
    cloudFunction.setOpenId('openid_member')
    const memberAdminDenied = await cloudProvider.set({ collection: 'members' }, {
      memberId: 'member_active', role: 'admin', status: 'active'
    })
    assert.strictEqual(memberAdminDenied.status, 'unauthorized')
    cloudFunction.setOpenId('openid_a')
    const adminMemberId = database.state.enterprise_members.find((item) => item.enterpriseId === 'enterprise_a' && item.role === 'admin').memberId
    const lastAdminDenied = await cloudProvider.remove({ collection: 'members', recordId: adminMemberId })
    assert.strictEqual(lastAdminDenied.status, 'unauthorized')

    setTenant(uniStorage.api, 'enterprise_rollback')
    cloudFunction.setOpenId('openid_rollback')
    database.failNextWrite('enterprise_members')
    const rollbackResult = await cloudProvider.set({ collection: 'enterprises' }, {
      enterpriseId: 'enterprise_rollback', enterpriseName: 'Rollback Enterprise'
    })
    assert.strictEqual(rollbackResult.status, 'cloud_call_failed')
    assert.strictEqual(database.state.enterprises.some((item) => item.enterpriseId === 'enterprise_rollback'), false)
    assert.strictEqual(database.state.enterprise_members.some((item) => item.enterpriseId === 'enterprise_rollback'), false)

    const unsupported = await cloudProvider.query({ collection: 'orders' })
    assert.strictEqual(unsupported.status, 'not_implemented')
    assert.strictEqual(cloudCallCount > 0, true)

    global.__DEV__ = true
    cloudProviderModule.setCloudCallAdapter(async () => ({ result: { unexpected: true } }))
    const invalidCloudResponse = await cloudProvider.get({ collection: 'projects', recordId: 'invalid_response_probe' })
    assert.strictEqual(invalidCloudResponse.status, 'cloud_response_invalid')
    assert.deepStrictEqual(Object.keys(invalidCloudResponse.debug).sort(), [
      'action',
      'cloudFunctionName',
      'elapsedMs',
      'hasEnterpriseId',
      'hasRecordId',
      'providerMode',
      'resourceType'
    ].sort())
    assert.strictEqual(JSON.stringify(invalidCloudResponse.debug).includes('openid'), false)
    delete global.__DEV__

    uniStorage.api.setStorageSync('diebiandesign_projects', [{ projectId: 'local_only' }])
    setTenant(uniStorage.api, 'enterprise_a')
    cloudProviderModule.setCloudCallAdapter(async () => { throw new Error('network unavailable') })
    const cloudFailure = await cloudProvider.get({ collection: 'projects', recordId: 'missing' }, [{ projectId: 'fake_fallback' }])
    assertResultShape(cloudFailure)
    assert.strictEqual(cloudFailure.status, 'cloud_call_failed')
    assert.strictEqual(cloudFailure.ok, false)
    assert.strictEqual(cloudFailure.data, null)
    assert.deepStrictEqual(uniStorage.api.getStorageSync('diebiandesign_projects'), [{ projectId: 'local_only' }])

    cloudProviderModule.setCloudCallAdapter(async (payload) => ({ result: await cloudFunction.main(payload) }))
    cloudFunction.setOpenId('openid_a')
    const projectRemove = await cloudProvider.remove({ collection: 'projects', recordId: 'project_a' })
    assert.strictEqual(projectRemove.ok, true)
    assert.strictEqual((await cloudProvider.get({ collection: 'projects', recordId: 'project_a' })).status, 'not_found')

    for (const entry of [firstCreate, idempotentCreate, secondEnterpriseDenied, projectCreate, projectGet, tenantMismatch, pendingDenied, disabledDenied, outsiderDenied, memberAdminDenied, lastAdminDenied, rollbackResult, unsupported, invalidCloudResponse, cloudFailure]) {
      assertResultShape(entry)
    }
    assert.ok(cloudFunction.logs.every((entry) => {
      const keys = Object.keys(entry[0] || {}).sort()
      return JSON.stringify(keys) === JSON.stringify(['action', 'collection', 'enterpriseIdPresent', 'recordIdPresent', 'success'].sort())
    }), 'cloud logs must contain only approved fields')

    console.log('Cloud Provider Alpha smoke: PASS')
    console.log(JSON.stringify({
      localModeNoCloudCall: true,
      bootstrapIdempotent: true,
      transactionRollback: true,
      tenantIsolation: true,
      memberStateGuard: true,
      memberPermissionGuard: true,
      firstEnterpriseGuard: true,
      projectCrud: true,
      unsupportedGuard: true,
      noLocalFallback: true,
      unifiedResultShape: true
      , migrationDryRunNoWrites: true,
      safeDevelopmentDebug: true
    }, null, 2))
  } finally {
    cloudProviderModule.resetCloudCallAdapter()
    dataProviderModule.configureDataProvider({ mode: 'local' })
    cleanup()
    delete global.__DEV__
    delete global.uni
  }
}

run().catch((error) => {
  console.error('Cloud Provider Alpha smoke: FAIL')
  console.error(error && error.stack ? error.stack : error)
  process.exitCode = 1
})
