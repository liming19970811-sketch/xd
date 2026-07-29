const crypto = require('crypto')
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

const COLLECTIONS = Object.freeze({
  enterprises: { name: 'enterprises', idField: 'enterpriseId' },
  members: { name: 'enterprise_members', idField: 'memberId' },
  projects: { name: 'enterprise_projects', idField: 'projectId' }
})
const ACTIONS = new Set(['get', 'set', 'remove', 'query'])
const MEMBER_STATUSES = new Set(['pending', 'active', 'disabled'])
const ADMIN_ROLES = new Set(['admin', '管理员'])
const MEMBER_OPEN_ID_FIELDS = Object.freeze(['openId', 'openid', '_openid'])

function response(ok, status, data = null, errorCode = '', message = '') {
  return { ok, status, data, errorCode, message }
}

function fail(status, errorCode, message) {
  return response(false, status, null, errorCode, message)
}

function cleanString(value = '', maxLength = 128) {
  return String(value || '').trim().slice(0, maxLength)
}

function publicRecord(record = {}) {
  const value = { ...record }
  delete value._openid
  delete value.openId
  delete value.openid
  delete value.ownerOpenId
  delete value.targetOpenId
  return value
}

function sanitizeRecord(data = {}, enterpriseId = '') {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null
  const record = { ...data }
  delete record._id
  delete record._openid
  delete record.openId
  delete record.openid
  delete record.ownerOpenId
  delete record.targetOpenId
  record.enterpriseId = enterpriseId
  return record
}

function sanitizeFilters(filters = {}) {
  if (!filters || typeof filters !== 'object' || Array.isArray(filters)) return {}
  return Object.keys(filters).reduce((output, key) => {
    if (['enterpriseId', '_id', '_openid', 'openId', 'openid', 'ownerOpenId'].includes(key)) return output
    const value = filters[key]
    if (['string', 'number', 'boolean'].includes(typeof value) || value === null) output[key] = value
    return output
  }, {})
}

function isAdmin(member = {}) {
  return ADMIN_ROLES.has(cleanString(member.role, 32))
}

function memberIdFor(enterpriseId, openId) {
  const digest = crypto.createHash('sha256').update(`${enterpriseId}:${openId}`).digest('hex').slice(0, 24)
  return `member_${digest}`
}

async function queryRecords(database, collectionName, where, limit = 100) {
  const result = await database.collection(collectionName).where(where).limit(limit).get()
  return Array.isArray(result.data) ? result.data : []
}

async function findRecords(database, config, enterpriseId, recordId = '', filters = {}) {
  const where = { enterpriseId, ...sanitizeFilters(filters) }
  if (recordId) where[config.idField] = recordId
  return queryRecords(database, config.name, where, recordId ? 1 : 100)
}

async function findMemberByOpenId(database, enterpriseId, callerOpenId) {
  if (!enterpriseId || !callerOpenId) return null
  for (const identityField of MEMBER_OPEN_ID_FIELDS) {
    const records = await queryRecords(database, COLLECTIONS.members.name, {
      enterpriseId,
      [identityField]: callerOpenId
    }, 1)
    if (records[0]?.enterpriseId === enterpriseId) return records[0]
  }
  return null
}

async function findAnyMembershipByOpenId(database, callerOpenId) {
  if (!callerOpenId) return null
  for (const identityField of MEMBER_OPEN_ID_FIELDS) {
    const records = await queryRecords(database, COLLECTIONS.members.name, { [identityField]: callerOpenId }, 1)
    if (records[0]) return records[0]
  }
  return null
}

async function authorizeActiveMember(enterpriseId, callerOpenId, logMeta = {}) {
  if (!callerOpenId) return { error: fail('unauthorized', 'CALLER_ID_UNAVAILABLE', 'Caller identity is unavailable') }
  const membership = await findMemberByOpenId(db, enterpriseId, callerOpenId)
  logMeta.memberFound = Boolean(membership)
  logMeta.memberStatus = cleanString(membership?.status, 32)
  if (!membership) return { error: fail('member_not_found', 'MEMBER_NOT_FOUND', 'Enterprise membership was not found') }
  if (membership.status !== 'active') {
    return { error: fail('member_inactive', 'MEMBER_INACTIVE', 'Enterprise membership is not active') }
  }
  return { membership }
}

async function bootstrapEnterprise(enterpriseId, callerOpenId, input = {}, logMeta = {}) {
  if (!db || typeof db.runTransaction !== 'function') {
    return fail('cloud_call_failed', 'TRANSACTION_UNAVAILABLE', 'Cloud database transaction is unavailable')
  }
  const now = new Date().toISOString()
  return db.runTransaction(async (transaction) => {
    const existingEnterprise = await findRecords(transaction, COLLECTIONS.enterprises, enterpriseId, enterpriseId)
    const existingMember = await findMemberByOpenId(transaction, enterpriseId, callerOpenId)

    if (existingEnterprise.length) {
      logMeta.memberFound = Boolean(existingMember)
      logMeta.memberStatus = cleanString(existingMember?.status, 32)
      if (!existingMember) return fail('member_not_found', 'MEMBER_NOT_FOUND', 'Existing enterprise cannot be joined by bootstrap')
      if (existingMember.status !== 'active') return fail('member_inactive', 'MEMBER_INACTIVE', 'Enterprise membership is not active')
      return response(true, 'ok', {
        enterprise: publicRecord(existingEnterprise[0]),
        member: publicRecord(existingMember)
      }, '', 'already_exists')
    }

    const otherMembership = await findAnyMembershipByOpenId(transaction, callerOpenId)
    if (otherMembership) {
      logMeta.memberFound = true
      logMeta.memberStatus = cleanString(otherMembership.status, 32)
      return fail('unauthorized', 'FIRST_ENTERPRISE_ALREADY_CREATED', 'Caller already belongs to an enterprise')
    }

    const enterprise = sanitizeRecord(input, enterpriseId)
    if (!enterprise) return fail('invalid_params', 'INVALID_DATA', 'data is required')
    delete enterprise.members
    delete enterprise.currentMemberId
    enterprise.enterpriseId = enterpriseId
    enterprise.createdAt = enterprise.createdAt || now
    enterprise.updatedAt = now
    enterprise.createdBy = 'current_user'

    const memberId = memberIdFor(enterpriseId, callerOpenId)
    const member = {
      memberId,
      enterpriseId,
      userId: memberId,
      openId: callerOpenId,
      name: '默认管理员',
      role: 'admin',
      status: 'active',
      createdAt: now,
      updatedAt: now
    }

    await transaction.collection(COLLECTIONS.enterprises.name).add({ data: enterprise })
    await transaction.collection(COLLECTIONS.members.name).add({ data: member })
    logMeta.memberFound = true
    logMeta.memberStatus = 'active'
    return response(true, 'ok', {
      enterprise: publicRecord(enterprise),
      member: publicRecord(member)
    }, '', 'created')
  })
}

async function handleEnterpriseSet(enterpriseId, callerOpenId, recordId, data, logMeta = {}) {
  if (data?.enterpriseId && cleanString(data.enterpriseId) !== enterpriseId) {
    return fail('tenant_mismatch', 'TENANT_MISMATCH', 'Record tenant does not match')
  }
  const id = cleanString(recordId || data?.enterpriseId || enterpriseId)
  if (id !== enterpriseId) return fail('tenant_mismatch', 'TENANT_MISMATCH', 'Enterprise record must match current tenant')

  const existing = await findRecords(db, COLLECTIONS.enterprises, enterpriseId, enterpriseId)
  if (!existing.length) return bootstrapEnterprise(enterpriseId, callerOpenId, data, logMeta)

  const authorization = await authorizeActiveMember(enterpriseId, callerOpenId, logMeta)
  if (authorization.error) return authorization.error
  if (!isAdmin(authorization.membership)) return fail('unauthorized', 'ADMIN_REQUIRED', 'Administrator permission is required')

  const record = sanitizeRecord(data, enterpriseId)
  if (!record) return fail('invalid_params', 'INVALID_DATA', 'data is required')
  delete record.members
  delete record.currentMemberId
  delete record.createdAt
  delete record.createdBy
  record.enterpriseId = enterpriseId
  record.updatedAt = new Date().toISOString()
  await db.collection(COLLECTIONS.enterprises.name).doc(existing[0]._id).update({ data: record })
  return response(true, 'ok', {
    enterprise: publicRecord({ ...existing[0], ...record }),
    member: publicRecord(authorization.membership)
  }, '', 'already_exists')
}

async function findCrossTenantRecord(config, recordId) {
  if (!recordId) return null
  const records = await queryRecords(db, config.name, { [config.idField]: recordId }, 1)
  return records[0] || null
}

async function handleGet(config, enterpriseId, recordId) {
  const id = cleanString(recordId || (config === COLLECTIONS.enterprises ? enterpriseId : ''))
  if (!id) return fail('invalid_params', 'RECORD_ID_REQUIRED', 'recordId is required')
  const records = await findRecords(db, config, enterpriseId, id)
  if (!records.length) {
    const crossTenant = await findCrossTenantRecord(config, id)
    if (crossTenant && crossTenant.enterpriseId !== enterpriseId) {
      return fail('tenant_mismatch', 'TENANT_MISMATCH', 'Record belongs to another enterprise')
    }
    return fail('not_found', 'NOT_FOUND', 'Record was not found')
  }
  return response(true, 'ok', publicRecord(records[0]), '', 'found')
}

async function handleQuery(config, enterpriseId, filters) {
  const records = await findRecords(db, config, enterpriseId, '', filters)
  return response(true, 'ok', records.filter((item) => item.enterpriseId === enterpriseId).map(publicRecord), '', 'queried')
}

async function countActiveAdmins(database, enterpriseId) {
  const records = await queryRecords(database, COLLECTIONS.members.name, { enterpriseId, status: 'active' }, 100)
  return records.filter(isAdmin).length
}

async function handleMemberSet(enterpriseId, caller, recordId, data) {
  if (!isAdmin(caller)) return fail('unauthorized', 'ADMIN_REQUIRED', 'Administrator permission is required')
  if (data?.enterpriseId && cleanString(data.enterpriseId) !== enterpriseId) {
    return fail('tenant_mismatch', 'TENANT_MISMATCH', 'Record tenant does not match')
  }
  const id = cleanString(recordId || data?.memberId)
  if (!id) return fail('invalid_params', 'RECORD_ID_REQUIRED', 'recordId is required')
  const existing = await findRecords(db, COLLECTIONS.members, enterpriseId, id)
  const current = existing[0] || null
  const requestedRole = cleanString(data?.role || current?.role || 'member', 32)
  const requestedStatus = cleanString(data?.status || current?.status || 'pending', 32)
  if (!MEMBER_STATUSES.has(requestedStatus)) return fail('invalid_params', 'INVALID_MEMBER_STATUS', 'Member status is invalid')
  if (!['admin', 'member'].includes(requestedRole)) return fail('invalid_params', 'INVALID_MEMBER_ROLE', 'Member role is invalid')

  if (current && isAdmin(current) && current.status === 'active' && (requestedRole !== 'admin' || requestedStatus !== 'active')) {
    if (await countActiveAdmins(db, enterpriseId) <= 1) {
      return fail('unauthorized', 'LAST_ADMIN_PROTECTED', 'The last active administrator cannot be changed')
    }
  }

  const targetOpenId = cleanString(
    current?.openId || current?.openid || current?._openid || data?.targetOpenId || data?.openId,
    128
  )
  if (!current && !targetOpenId) return fail('invalid_params', 'TARGET_OPENID_REQUIRED', 'Target member identity is required')
  if (!current) {
    const duplicate = await findMemberByOpenId(db, enterpriseId, targetOpenId)
    if (duplicate) return fail('duplicate_record', 'DUPLICATE_MEMBER', 'Member already exists')
  }

  const now = new Date().toISOString()
  const record = sanitizeRecord(data, enterpriseId)
  delete record.openId
  record.memberId = id
  record.userId = cleanString(record.userId || current?.userId || id)
  record.openId = targetOpenId
  record.role = requestedRole
  record.status = requestedStatus
  record.updatedAt = now
  if (current) {
    delete record.createdAt
    await db.collection(COLLECTIONS.members.name).doc(current._id).update({ data: record })
  } else {
    record.createdAt = now
    await db.collection(COLLECTIONS.members.name).add({ data: record })
  }
  return response(true, 'ok', publicRecord({ ...(current || {}), ...record }), '', current ? 'updated' : 'created')
}

async function handleProjectSet(enterpriseId, recordId, data) {
  if (data?.enterpriseId && cleanString(data.enterpriseId) !== enterpriseId) {
    return fail('tenant_mismatch', 'TENANT_MISMATCH', 'Record tenant does not match')
  }
  const record = sanitizeRecord(data, enterpriseId)
  if (!record) return fail('invalid_params', 'INVALID_DATA', 'data is required')
  const id = cleanString(recordId || record.projectId)
  if (!id) return fail('invalid_params', 'RECORD_ID_REQUIRED', 'recordId is required')
  const crossTenant = await findCrossTenantRecord(COLLECTIONS.projects, id)
  if (crossTenant && crossTenant.enterpriseId !== enterpriseId) {
    return fail('tenant_mismatch', 'TENANT_MISMATCH', 'Project belongs to another enterprise')
  }

  const existing = await findRecords(db, COLLECTIONS.projects, enterpriseId, id)
  const now = new Date().toISOString()
  record.projectId = id
  record.enterpriseId = enterpriseId
  record.updatedAt = now
  if (existing.length) {
    delete record.createdAt
    await db.collection(COLLECTIONS.projects.name).doc(existing[0]._id).update({ data: record })
  } else {
    record.createdAt = record.createdAt || now
    await db.collection(COLLECTIONS.projects.name).add({ data: record })
  }
  return response(true, 'ok', publicRecord({ ...(existing[0] || {}), ...record }), '', existing.length ? 'updated' : 'created')
}

async function handleRemove(config, enterpriseId, recordId, caller) {
  const id = cleanString(recordId)
  if (!id) return fail('invalid_params', 'RECORD_ID_REQUIRED', 'recordId is required')
  const existing = await findRecords(db, config, enterpriseId, id)
  if (!existing.length) {
    const crossTenant = await findCrossTenantRecord(config, id)
    if (crossTenant && crossTenant.enterpriseId !== enterpriseId) {
      return fail('tenant_mismatch', 'TENANT_MISMATCH', 'Record belongs to another enterprise')
    }
    return fail('not_found', 'NOT_FOUND', 'Record was not found')
  }

  if (config === COLLECTIONS.enterprises) return fail('unauthorized', 'ENTERPRISE_REMOVE_DISABLED', 'Enterprise removal is not available in Alpha')
  if (config === COLLECTIONS.members) {
    if (!isAdmin(caller)) return fail('unauthorized', 'ADMIN_REQUIRED', 'Administrator permission is required')
    const target = existing[0]
    if (isAdmin(target) && target.status === 'active' && await countActiveAdmins(db, enterpriseId) <= 1) {
      return fail('unauthorized', 'LAST_ADMIN_PROTECTED', 'The last active administrator cannot be removed')
    }
  }
  await db.collection(config.name).doc(existing[0]._id).remove()
  return response(true, 'ok', { recordId: id }, '', 'removed')
}

exports.main = async (event = {}) => {
  const action = cleanString(event.action, 32)
  const collection = cleanString(event.collection, 64)
  const enterpriseId = cleanString(event.enterpriseId)
  const recordId = cleanString(event.recordId)
  const logMeta = { memberFound: false, memberStatus: '' }
  let output

  try {
    if (!enterpriseId) {
      output = fail('invalid_params', 'ENTERPRISE_ID_REQUIRED', 'enterpriseId is required')
    } else if (!ACTIONS.has(action) || !COLLECTIONS[collection]) {
      output = fail('not_implemented', 'NOT_IMPLEMENTED', 'Action or collection is not implemented')
    } else {
      const callerOpenId = cleanString(cloud.getWXContext()?.OPENID, 128)
      const config = COLLECTIONS[collection]
      if (!callerOpenId) {
        output = fail('unauthorized', 'CALLER_ID_UNAVAILABLE', 'Caller identity is unavailable')
      } else if (action === 'set' && config === COLLECTIONS.enterprises) {
        output = await handleEnterpriseSet(enterpriseId, callerOpenId, recordId, event.data, logMeta)
      } else {
        const authorization = await authorizeActiveMember(enterpriseId, callerOpenId, logMeta)
        if (authorization.error) output = authorization.error
        else if (action === 'get') output = await handleGet(config, enterpriseId, recordId)
        else if (action === 'query') output = await handleQuery(config, enterpriseId, event.filters)
        else if (action === 'set' && config === COLLECTIONS.members) {
          output = await handleMemberSet(enterpriseId, authorization.membership, recordId, event.data)
        } else if (action === 'set' && config === COLLECTIONS.projects) {
          output = await handleProjectSet(enterpriseId, recordId, event.data)
        } else if (action === 'set') {
          output = fail('not_implemented', 'NOT_IMPLEMENTED', 'Set operation is not implemented for this resource')
        } else {
          output = await handleRemove(config, enterpriseId, recordId, authorization.membership)
        }
      }
    }
  } catch (error) {
    output = fail('cloud_call_failed', 'CLOUD_OPERATION_FAILED', 'Cloud data operation failed')
  }

  console.log({
    action,
    collection,
    hasEnterpriseId: Boolean(enterpriseId),
    hasRecordId: Boolean(recordId),
    memberFound: logMeta.memberFound,
    memberStatus: logMeta.memberStatus,
    success: output.ok === true
  })
  return output
}
