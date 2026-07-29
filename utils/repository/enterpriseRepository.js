import { get, getDataProviderName, set } from '../data-provider/dataProvider.js'
import { getCurrentAuthContext } from '../auth/authContext.js'

export const ENTERPRISE_SCHEMA_VERSION = 1
export const ENTERPRISE_DATA_SOURCE_LOCAL = 'local'
export const ENTERPRISE_DATA_SOURCE_MOCK = 'mock'
export const ENTERPRISE_DATA_SOURCE_CLOUD = 'cloud'
export const ENTERPRISE_LEGACY_TIMESTAMP = '1970-01-01T00:00:00.000Z'

const STORAGE_KEY = 'diebiandesign_enterprise_team_v1'

function getActiveEnterpriseId() {
  return getCurrentAuthContext().currentEnterprise.enterpriseId || 'default_enterprise'
}

export function readLocalStorage(storageKey, fallback = null) {
  return get(storageKey, fallback)
}

export function writeLocalStorage(storageKey, value) {
  return set(storageKey, value)
}

export function normalizeSaasRecord(record = {}, options = {}) {
  const value = record && typeof record === 'object' && !Array.isArray(record) ? record : {}
  const enterpriseId = value.enterpriseId || options.enterpriseId || 'default_enterprise'
  const userId = value.userId || options.userId || value.memberId || options.createdBy || 'default_admin'
  const createdAt = value.createdAt || value.updatedAt || options.createdAt || ENTERPRISE_LEGACY_TIMESTAMP
  const updatedAt = options.touchUpdatedAt || value.updatedAt || createdAt
  const inferredSource = value.demoId || value.isDemo || String(value.sourceType || '').includes('demo')
    ? ENTERPRISE_DATA_SOURCE_MOCK
    : getDataProviderName()
  return {
    ...value,
    enterpriseId,
    userId,
    createdBy: value.createdBy || options.createdBy || userId,
    updatedBy: options.updatedBy || value.updatedBy || value.createdBy || options.createdBy || userId,
    createdAt,
    updatedAt,
    dataSource: value.dataSource || options.dataSource || inferredSource,
    schemaVersion: value.schemaVersion || ENTERPRISE_SCHEMA_VERSION
  }
}

export function normalize(record = {}, options = {}) {
  const value = normalizeSaasRecord(record, options)
  const members = Array.isArray(value.members) && value.members.length
    ? value.members
    : [{ memberId: 'default_admin', userId: 'default_admin', name: '默认管理员', avatar: '', role: '管理员', status: 'active' }]
  const normalizedMembers = members.map((member) => ({
    ...normalizeSaasRecord(member, {
      enterpriseId: value.enterpriseId,
      userId: member.userId || member.memberId || value.userId
    }),
    memberId: member.memberId || member.userId || 'default_admin',
    enterpriseId: value.enterpriseId,
    userId: member.userId || member.memberId || value.userId || 'default_admin',
    name: member.name || '未命名成员',
    avatar: member.avatar || '',
    role: member.role || '成员',
    status: ['pending', 'active', 'disabled'].includes(member.status) ? member.status : 'active'
  }))
  const currentMemberId = normalizedMembers.some((member) => member.memberId === value.currentMemberId)
    ? value.currentMemberId
    : normalizedMembers[0].memberId
  return {
    ...value,
    enterpriseName: value.enterpriseName || '默认企业',
    planId: value.planId || 'basic',
    members: normalizedMembers,
    currentMemberId
  }
}

function readEnterpriseRecords() {
  const value = readLocalStorage(STORAGE_KEY, null)
  if (Array.isArray(value)) return value
  if (value && Array.isArray(value.enterprises)) return value.enterprises
  return value && typeof value === 'object' && Object.keys(value).length ? [value] : []
}

function writeEnterpriseRecords(records = []) {
  return writeLocalStorage(STORAGE_KEY, {
    schemaVersion: ENTERPRISE_SCHEMA_VERSION,
    dataSource: getDataProviderName(),
    enterprises: records.map((item) => normalize(item, { enterpriseId: item.enterpriseId }))
  })
}

export function getList() {
  const enterpriseId = getActiveEnterpriseId()
  const records = readEnterpriseRecords()
    .map((item) => normalize(item, { enterpriseId: item.enterpriseId || 'default_enterprise' }))
    .filter((item) => item.enterpriseId === enterpriseId)
  return records.length ? records : (readEnterpriseRecords().length ? [] : [normalize({}, { enterpriseId })])
}

export function getCurrentEnterpriseContext() {
  const enterprise = getList()[0] || normalize({}, { enterpriseId: getActiveEnterpriseId() })
  const currentMember = enterprise.members.find((member) => member.memberId === enterprise.currentMemberId) || enterprise.members[0]
  const auth = getCurrentAuthContext({
    currentUser: {
      userId: currentMember && currentMember.userId ? currentMember.userId : (enterprise.currentMemberId || enterprise.userId || 'default_admin'),
      name: currentMember && currentMember.name ? currentMember.name : '默认管理员'
    },
    currentEnterprise: {
      enterpriseId: enterprise.enterpriseId,
      enterpriseName: enterprise.enterpriseName
    },
    currentRole: currentMember && currentMember.role ? currentMember.role : '管理员',
    currentMember
  })
  return {
    enterpriseId: auth.currentEnterprise.enterpriseId || enterprise.enterpriseId,
    userId: auth.currentUser.userId || enterprise.currentMemberId || enterprise.userId || 'default_admin'
  }
}

export function getById(enterpriseId = '') {
  if (enterpriseId && enterpriseId !== getActiveEnterpriseId()) return null
  return getList().find((item) => item.enterpriseId === enterpriseId) || null
}

export function create(input = {}) {
  const enterpriseId = getActiveEnterpriseId()
  if (input.enterpriseId && input.enterpriseId !== enterpriseId) return null
  const now = new Date().toISOString()
  const record = normalize({
    ...input,
    enterpriseId,
    createdAt: input.createdAt || now,
    updatedAt: input.updatedAt || now
  }, { createdBy: input.createdBy || input.userId })
  const records = readEnterpriseRecords()
  writeEnterpriseRecords([record, ...records.filter((item) => (item.enterpriseId || 'default_enterprise') !== enterpriseId)])
  return record
}

export function update(enterpriseId = '', patch = {}) {
  const activeEnterpriseId = getActiveEnterpriseId()
  if ((enterpriseId && enterpriseId !== activeEnterpriseId) || (patch.enterpriseId && patch.enterpriseId !== activeEnterpriseId)) return null
  const current = getById(activeEnterpriseId) || getList()[0]
  if (!current) return null
  const record = normalize({ ...current, ...patch, enterpriseId: activeEnterpriseId }, {
    updatedBy: patch.updatedBy || patch.userId || current.currentMemberId,
    touchUpdatedAt: new Date().toISOString()
  })
  const records = readEnterpriseRecords()
  writeEnterpriseRecords([record, ...records.filter((item) => (item.enterpriseId || 'default_enterprise') !== activeEnterpriseId)])
  return record
}
