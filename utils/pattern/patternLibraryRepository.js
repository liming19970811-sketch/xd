import { getCurrentContext, getCurrentMember, getCurrentUser } from '../auth/authRepository.js'
import { hasRolePermission } from '../permission/rolePermissionService.js'
import { getWorkDetail } from '../work/workRepository.js'
import { callPatternReview } from './patternReviewTransport.js'
import {
  createDerivedPattern,
  createPatternRevisionVersion,
  createPatternStructurePlan,
  getPatternMaster,
  getPatternStructurePackage,
  getPatternVersion,
  listPatternMasters,
  listPatternParts,
  listPatternSizeSpecs,
  listPatternVersions,
  linkPatternStructureAssets
} from '../workspace/patternMakingRepository.js'

export const PATTERN_LIBRARY_PAGE_SIZE = 12

export const PATTERN_CATEGORY_OPTIONS = Object.freeze([
  { value: 'all', label: '全部品类' },
  { value: 'tshirt', label: 'T恤' },
  { value: 'shirt', label: '衬衫' },
  { value: 'dress', label: '连衣裙' },
  { value: 'skirt', label: '半身裙' },
  { value: 'pants', label: '裤装' },
  { value: 'coat', label: '外套' }
])

export const PATTERN_STATUS_OPTIONS = Object.freeze([
  { value: 'all', label: '全部状态' },
  { value: 'draft', label: '草稿' },
  { value: 'ai_pending', label: 'AI生成待复核' },
  { value: 'review', label: '复核中' },
  { value: 'changes_requested', label: '需修改' },
  { value: 'reviewed', label: '已复核' },
  { value: 'approved', label: '已批准' },
  { value: 'archived', label: '已归档' }
])

export const PATTERN_QUALITY_STATUS_OPTIONS = Object.freeze([
  { value: 'all', label: '优先已批准' },
  { value: 'approved', label: '仅已批准' },
  { value: 'reviewed', label: '仅已复核' }
])

export const PATTERN_SORT_OPTIONS = Object.freeze([
  { value: 'updated_desc', label: '最近更新' },
  { value: 'created_desc', label: '最近创建' },
  { value: 'name_asc', label: '名称' }
])
export const PATTERN_SEARCH_SORT_OPTIONS = Object.freeze([{ value: 'match_desc', label: '匹配度优先' }])

export const PATTERN_SEARCH_FILTERS = Object.freeze({
  audience: [{ value: '', label: '全部人群' }, { value: 'women', label: '女装' }, { value: 'men', label: '男装' }, { value: 'kids', label: '童装' }],
  season: [{ value: '', label: '全部季节' }, { value: 'spring_summer', label: '春夏' }, { value: 'autumn_winter', label: '秋冬' }, { value: 'all_season', label: '四季' }],
  style: [{ value: '', label: '全部风格' }, { value: 'commuter', label: '通勤' }, { value: 'casual', label: '休闲' }, { value: 'fashion', label: '时尚' }, { value: 'minimal', label: '极简' }],
  fitType: [{ value: '', label: '全部版型' }, { value: 'slim', label: '修身' }, { value: 'regular', label: '常规' }, { value: 'loose', label: '宽松' }, { value: 'oversized', label: '廓形' }],
  neckType: [{ value: '', label: '全部领型' }, { value: 'round', label: '圆领' }, { value: 'v_neck', label: 'V领' }, { value: 'shirt_collar', label: '衬衫领' }, { value: 'stand_collar', label: '立领' }],
  sleeveType: [{ value: '', label: '全部袖型' }, { value: 'short', label: '短袖' }, { value: 'long', label: '长袖' }, { value: 'raglan', label: '插肩袖' }, { value: 'sleeveless', label: '无袖' }],
  lengthType: [{ value: '', label: '全部衣长' }, { value: 'cropped', label: '短款' }, { value: 'regular', label: '常规' }, { value: 'long', label: '长款' }],
  baseSize: [{ value: '', label: '全部尺码' }, ...['S', 'M', 'L', 'XL'].map((value) => ({ value, label: value }))],
  materialType: [{ value: '', label: '全部面料' }, { value: 'cotton', label: '棉' }, { value: 'linen', label: '麻' }, { value: 'denim', label: '牛仔' }, { value: 'knit', label: '针织' }, { value: 'silk', label: '真丝' }, { value: 'chiffon', label: '雪纺' }, { value: 'wool', label: '羊毛' }],
  elasticity: [{ value: '', label: '全部弹性' }, { value: 'none', label: '无弹' }, { value: 'low', label: '微弹' }, { value: 'medium', label: '中弹' }, { value: 'high', label: '高弹' }],
  thickness: [{ value: '', label: '全部厚度' }, { value: 'light', label: '轻薄' }, { value: 'medium', label: '适中' }, { value: 'heavy', label: '厚实' }],
  usageScene: [{ value: '', label: '全部场景' }, { value: 'daily', label: '日常' }, { value: 'commute', label: '通勤' }, { value: 'business', label: '商务' }, { value: 'sports', label: '运动' }, { value: 'occasion', label: '礼服' }]
})

const CATEGORY_LABELS = Object.freeze(PATTERN_CATEGORY_OPTIONS.reduce((map, item) => ({ ...map, [item.value]: item.label }), {}))
const STATUS_LABELS = Object.freeze(PATTERN_STATUS_OPTIONS.reduce((map, item) => ({ ...map, [item.value]: item.label }), {}))

function text(value = '') {
  return String(value || '').trim()
}

function getAccessContext() {
  const context = getCurrentContext()
  const member = getCurrentMember() || {}
  const user = getCurrentUser() || {}
  const enterpriseId = text((context.currentEnterprise || {}).enterpriseId || member.enterpriseId)
  const active = member.status === 'active' && Boolean(enterpriseId && member.memberId)
  return {
    active,
    enterpriseId,
    memberId: text(member.memberId),
    userId: text(user.userId || member.userId),
    role: member.role || context.currentRole || '',
    realEnterprise: active && context.authSource !== 'local_mock' && enterpriseId !== 'default_enterprise'
  }
}

export function shouldUseCloudPatternLibrary() { return getAccessContext().realEnterprise }

export async function searchApprovedPatternLibrary(input = {}) {
  const result = await callPatternReview('search_library', {
    garmentCategory: text(input.garmentCategory || input.category), audience: text(input.audience), season: text(input.season), style: text(input.style),
    fitType: text(input.fitType), neckType: text(input.neckType), sleeveType: text(input.sleeveType), lengthType: text(input.lengthType), baseSize: text(input.baseSize),
    materialProperties: { type: text(input.materialType || (input.materialProperties || {}).type), elasticity: text(input.elasticity || (input.materialProperties || {}).elasticity), thickness: text(input.thickness || (input.materialProperties || {}).thickness) },
    usageScene: text(input.usageScene), status: ['approved', 'reviewed'].includes(input.status) ? input.status : 'quality',
    tags: Array.isArray(input.tags) ? input.tags.map(text).filter(Boolean) : text(input.tags).split(/[\s,，]+/).filter(Boolean), keyword: text(input.keyword),
    scope: input.scope === 'enterprise' ? 'enterprise' : 'personal', page: input.page, pageSize: input.pageSize || PATTERN_LIBRARY_PAGE_SIZE
  })
  if (!result.ok) return { ...result, items: [], total: 0, hasMore: false }
  return { ok: true, status: result.status, ...result.data }
}

export async function getCloudPatternLibraryDetail(patternId = '', versionId = '') {
  return callPatternReview('library_get', { patternId: text(patternId), versionId: text(versionId) })
}

export async function deriveApprovedPatternLibraryItem(patternId = '', input = {}) {
  return callPatternReview('derive_approved', {
    patternId: text(patternId), title: text(input.title), note: text(input.note), changes: input.changes || {}, tags: input.tags || [],
    idempotencyKey: text(input.idempotencyKey)
  })
}

function isOwner(master = {}, access = getAccessContext()) {
  if (!access.active) return false
  if (text(master.ownerMemberId) && text(master.ownerMemberId) === access.memberId) return true
  return Boolean(text(master.ownerUserId) && text(master.ownerUserId) === access.userId)
}

function canViewEnterprise(access = getAccessContext()) {
  return access.realEnterprise && hasRolePermission(access.role, 'pattern_library.view')
}

function canCreatePattern(access = getAccessContext()) {
  return access.active && (isLocalCompatible(access) || hasRolePermission(access.role, 'pattern_library.create'))
}

function canEditPattern(master = {}, access = getAccessContext()) {
  if (!access.active || text(master.enterpriseId) !== access.enterpriseId) return false
  return isOwner(master, access) || hasRolePermission(access.role, 'pattern_library.edit')
}

function isLocalCompatible(access = getAccessContext()) {
  return access.active && !access.realEnterprise
}

function normalizeStatus(master = {}, version = {}) {
  if (master.archived || master.reviewStatus === 'archived') return 'archived'
  if (version.reviewStatus === 'approved' || master.reviewStatus === 'approved') return 'approved'
  if (master.productionStatus === 'reviewed_reference') return 'reviewed'
  if (version.reviewStatus === 'changes_requested' || master.reviewStatus === 'changes_requested') return 'changes_requested'
  if (['pending', 'under_review'].includes(version.reviewStatus) || ['pending', 'under_review'].includes(master.reviewStatus)) return 'review'
  if (version.reviewStatus === 'ai_generated' || master.reviewStatus === 'ai_generated' || (master.source === 'ai_pattern_structure' && ['draft', 'not_submitted'].includes(version.reviewStatus || master.reviewStatus))) return 'ai_pending'
  return 'draft'
}

function resolveCover(master = {}, version = {}) {
  const candidates = [...(version.assetIds || []), ...(master.linkedAssetIds || [])]
  for (const id of candidates) {
    const work = getWorkDetail(id)
    if (work && work.coverUrl) return work.coverUrl
  }
  const sourceImages = ((version.aiDraft || {}).sourceImages || {})
  return text(sourceImages.frontImage || sourceImages.structureSketch || '')
}

function normalizeCard(master = {}) {
  const version = getPatternVersion(master.currentVersionId) || listPatternVersions(master.patternMasterId)[0] || {}
  const sizeSpec = listPatternSizeSpecs(master.patternMasterId, version.versionId)[0] || {}
  const status = normalizeStatus(master, version)
  return {
    patternId: master.patternMasterId,
    title: master.title || '未命名版型',
    patternCode: master.patternCode || '',
    category: master.category || (master.taxonomy || {}).garmentCategory || '',
    categoryLabel: CATEGORY_LABELS[master.category] || master.category || '其他',
    currentVersion: version.versionNo || 'V1',
    baseSize: sizeSpec.baseSize || (version.sizeParams || {}).baseSize || master.sizeRange || '未设置',
    status,
    statusLabel: STATUS_LABELS[status] || '草稿',
    tags: Array.isArray(master.tags) ? master.tags.slice(0, 4) : [],
    taxonomy: master.taxonomy || {},
    coverUrl: resolveCover(master, version),
    scope: master.scope || 'personal',
    createdAt: master.createdAt || '',
    updatedAt: master.updatedAt || master.createdAt || '',
    canEdit: canEditPattern(master),
    humanReviewRequired: master.humanReviewRequired !== false,
    productionReady: false
  }
}

function getAllowedMasters(scope = 'personal', access = getAccessContext()) {
  if (!access.active) return []
  return listPatternMasters().filter((master) => {
    if (text(master.enterpriseId) !== access.enterpriseId) return false
    if (scope === 'personal') return isOwner(master, access)
    if (scope === 'enterprise') return canViewEnterprise(access) && master.scope === 'enterprise'
    if (scope === 'system') return master.scope === 'system'
    return false
  })
}

function matchesKeyword(card = {}, keyword = '') {
  const query = text(keyword).toLowerCase()
  if (!query) return true
  return [card.title, card.patternCode, ...(card.tags || [])].join(' ').toLowerCase().includes(query)
}

function sortCards(cards = [], sort = 'updated_desc') {
  const values = [...cards]
  if (sort === 'name_asc') return values.sort((a, b) => a.title.localeCompare(b.title, 'zh-CN'))
  const key = sort === 'created_desc' ? 'createdAt' : 'updatedAt'
  return values.sort((a, b) => text(b[key]).localeCompare(text(a[key])))
}

export function getPatternLibraryScopes() {
  const access = getAccessContext()
  if (!access.active) return []
  const masters = listPatternMasters()
  const scopes = [{ value: 'personal', label: '我的版型' }]
  if (canViewEnterprise(access) && masters.some((master) => master.scope === 'enterprise')) scopes.push({ value: 'enterprise', label: '企业版型' })
  if (masters.some((master) => master.scope === 'system')) scopes.push({ value: 'system', label: '系统基础版型' })
  return scopes
}

export function queryPatternLibrary(options = {}) {
  const access = getAccessContext()
  if (!access.active) return { ok: false, status: 'forbidden', errorCode: 'member_inactive', message: '当前成员状态不可用。', items: [], total: 0 }
  const page = Math.max(1, Number(options.page) || 1)
  const pageSize = Math.min(20, Math.max(1, Number(options.pageSize) || PATTERN_LIBRARY_PAGE_SIZE))
  const category = text(options.category || 'all')
  const status = text(options.status || 'all')
  let cards = getAllowedMasters(options.scope || 'personal', access).map(normalizeCard)
  cards = cards.filter((card) => matchesKeyword(card, options.keyword))
  if (category !== 'all') cards = cards.filter((card) => card.category === category)
  if (status !== 'all') cards = cards.filter((card) => card.status === status)
  cards = sortCards(cards, options.sort)
  const start = (page - 1) * pageSize
  return {
    ok: true,
    status: 'success',
    errorCode: '',
    message: '',
    items: cards.slice(start, start + pageSize),
    total: cards.length,
    page,
    pageSize,
    hasMore: start + pageSize < cards.length,
    scopes: getPatternLibraryScopes()
  }
}

export function getPatternLibraryDetail(patternId = '') {
  const access = getAccessContext()
  const master = getPatternMaster(text(patternId))
  if (!access.active) return { ok: false, status: 'forbidden', errorCode: 'member_inactive', message: '当前成员状态不可用。' }
  if (!master || text(master.enterpriseId) !== access.enterpriseId) return { ok: false, status: 'not_found', errorCode: 'pattern_not_found', message: '版型不存在或无权访问。' }
  const allowed = isOwner(master, access) || (master.scope === 'enterprise' && canViewEnterprise(access)) || master.scope === 'system'
  if (!allowed) return { ok: false, status: 'not_found', errorCode: 'pattern_not_found', message: '版型不存在或无权访问。' }
  const versions = listPatternVersions(master.patternMasterId)
  const currentVersion = getPatternVersion(master.currentVersionId) || versions[0] || null
  return {
    ok: true,
    status: 'success',
    data: {
      card: normalizeCard(master),
      master,
      currentVersion,
      versions,
      parts: listPatternParts(master.patternMasterId, currentVersion && currentVersion.versionId),
      sizeSpecs: listPatternSizeSpecs(master.patternMasterId, currentVersion && currentVersion.versionId),
      package: getPatternStructurePackage(master.patternMasterId),
      canEdit: canEditPattern(master, access),
      canCreate: canCreatePattern(access)
    }
  }
}

export function getPatternLibraryVersionDetail(patternId = '', versionId = '') {
  const detail = getPatternLibraryDetail(patternId)
  if (!detail.ok) return detail
  const version = detail.data.versions.find((item) => item.versionId === text(versionId))
  if (!version) return { ok: false, status: 'not_found', errorCode: 'version_not_found', message: '版本不存在或无权访问。' }
  return {
    ok: true,
    status: 'success',
    data: {
      version,
      parts: listPatternParts(patternId, version.versionId),
      sizeSpecs: listPatternSizeSpecs(patternId, version.versionId)
    }
  }
}

export function derivePatternLibraryItem(patternId = '', input = {}) {
  const detail = getPatternLibraryDetail(patternId)
  if (!detail.ok) return detail
  const access = getAccessContext()
  if (!canCreatePattern(access)) return { ok: false, status: 'forbidden', errorCode: 'permission_denied', message: '当前角色暂无创建版型权限。' }
  const result = createDerivedPattern(patternId, { ...input, scope: 'personal' })
  return result.ok ? { ok: true, status: 'created', data: result } : { ok: false, status: 'error', errorCode: result.errorCode || 'derive_failed', message: '派生新款失败。' }
}

export function createPatternLibraryRevision(patternId = '') {
  const detail = getPatternLibraryDetail(patternId)
  if (!detail.ok) return detail
  if (!detail.data.canEdit) return { ok: false, status: 'forbidden', errorCode: 'permission_denied', message: '当前角色暂无编辑版型权限。' }
  const result = createPatternRevisionVersion(patternId, { diff: ['从当前版本创建新草稿，历史版本保持不变'] })
  return result.ok ? { ok: true, status: 'created', data: result } : { ok: false, status: 'error', errorCode: result.errorCode || 'version_create_failed', message: '新版本创建失败。' }
}

export function findPatternLibraryItemByTaskId(taskId = '') {
  const id = text(taskId)
  if (!id) return null
  const access = getAccessContext()
  const version = listPatternVersions().find((item) => (item.taskIds || []).includes(id))
  if (!version) return null
  const detail = getPatternLibraryDetail(version.patternMasterId)
  return detail.ok && (isOwner(detail.data.master, access) || canViewEnterprise(access)) ? detail.data.master : null
}

export function savePatternStructureToLibrary(input = {}) {
  const access = getAccessContext()
  if (!canCreatePattern(access)) return { ok: false, status: 'forbidden', errorCode: 'permission_denied', message: '当前身份无法保存版型。' }
  const taskIds = Array.isArray(input.taskIds) ? input.taskIds.map(text).filter(Boolean) : []
  const existing = input.patternMasterId
    ? getPatternMaster(text(input.patternMasterId))
    : taskIds.map(findPatternLibraryItemByTaskId).find(Boolean)
  if (existing) {
    if (!getPatternLibraryDetail(existing.patternMasterId).ok) return { ok: false, status: 'not_found', errorCode: 'pattern_not_found', message: '版型不存在或无权访问。' }
    if (input.assetIds) linkPatternStructureAssets(existing.patternMasterId, input.assetIds)
    return { ok: true, status: 'existing', data: { master: existing } }
  }
  const result = createPatternStructurePlan({ ...input, taskIds, scope: 'personal' })
  if (!result.ok) return { ok: false, status: 'error', errorCode: result.errorCode || 'pattern_save_failed', message: '版型保存失败。' }
  if (input.assetIds) linkPatternStructureAssets(result.master.patternMasterId, input.assetIds)
  return { ok: true, status: 'created', data: result }
}
