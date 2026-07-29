import { getCurrentEnterpriseId } from '../tenant/tenantContext'
import { getCurrentUser } from '../user/userRepository'

export const PRODUCT_PROFILE_SELECTION_KEY = 'diebiandesign_selected_product_profile_v1'
export const PRODUCT_PROFILE_STORAGE_KEY = 'diebiandesign_product_profiles_v1'
export const PRODUCT_PROFILE_VERSION_STORAGE_KEY = 'diebiandesign_product_profile_versions_v1'
export const SIZE_CHART_STORAGE_KEY = 'diebiandesign_size_charts_v1'
export const SIZE_CHART_TEMPLATE_STORAGE_KEY = 'diebiandesign_size_chart_templates_v1'

export const PRODUCT_PROFILE_FIELD_DEFINITIONS = Object.freeze([
  ['productName', '商品名称'], ['productCode', '商品款号'], ['category', '商品品类'], ['gender', '适用人群'],
  ['season', '适用季节'], ['colorName', '颜色名称'], ['colorHex', '颜色色值'], ['fabricComposition', '面料成分'],
  ['fabricDescription', '面料说明'], ['fitType', '版型'], ['neckType', '领型'], ['sleeveType', '袖型'],
  ['sleeveLength', '袖长类型'], ['garmentLength', '衣长类型'], ['pattern', '图案'], ['craftsmanship', '工艺'],
  ['decoration', '装饰与五金'], ['sellingPoints', '商品卖点'], ['careInstruction', '洗护说明']
].map(([key, label]) => Object.freeze({ key, label })))

export const DEFAULT_SIZE_COLUMNS = Object.freeze([
  Object.freeze({ key: 'size', label: '尺码', type: 'text' }),
  Object.freeze({ key: 'garmentLength', label: '衣长', type: 'number' }),
  Object.freeze({ key: 'bust', label: '胸围', type: 'number' }),
  Object.freeze({ key: 'shoulder', label: '肩宽', type: 'number' }),
  Object.freeze({ key: 'sleeveLength', label: '袖长', type: 'number' })
])

const FIELD_SOURCES = new Set(['manual', 'image_ocr', 'ai_detected', 'imported'])

function text(value = '') { return String(value || '').trim() }
function nowIso() { return new Date().toISOString() }
function id(prefix) { return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}` }
function clone(value, fallback) { try { return JSON.parse(JSON.stringify(value)) } catch (error) { return fallback } }
function read(key) { try { const value = uni.getStorageSync(key); return Array.isArray(value) ? value : [] } catch (error) { return [] } }
function write(key, value) { uni.setStorageSync(key, Array.isArray(value) ? value : []) }

function scope() {
  const user = getCurrentUser()
  return {
    ownerId: text(user.userId || user.openId || user.openid),
    enterpriseId: text(user.enterpriseId) || text(getCurrentEnterpriseId())
  }
}

function allowed(record = {}) {
  const current = scope()
  return Boolean(current.ownerId && record.ownerId === current.ownerId && record.enterpriseId === current.enterpriseId)
}

export function createProfileField(value = '', options = {}) {
  const confirmed = options.confirmed === true
  return {
    value: text(value),
    source: FIELD_SOURCES.has(options.source) ? options.source : 'manual',
    confidence: Math.max(0, Math.min(1, Number(options.confidence) || (confirmed ? 1 : 0))),
    confirmed,
    confirmedAt: confirmed ? text(options.confirmedAt) || nowIso() : ''
  }
}

function normalizeField(value, previous = {}) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return createProfileField(value.value, { ...previous, ...value })
  }
  return createProfileField(value, previous)
}

function normalizeProfile(input = {}, previous = {}) {
  const current = scope()
  const createdAt = text(previous.createdAt || input.createdAt) || nowIso()
  const profile = {
    productId: text(previous.productId || input.productId) || id('product'),
    ownerId: current.ownerId,
    enterpriseId: current.enterpriseId,
    version: Math.max(1, Number(input.version || previous.version) || 1),
    profileVersionId: text(input.profileVersionId || previous.profileVersionId),
    sizeChartId: text(input.sizeChartId || previous.sizeChartId),
    careInstructionId: text(input.careInstructionId || previous.careInstructionId),
    sourceAssetIds: Array.from(new Set((Array.isArray(input.sourceAssetIds) ? input.sourceAssetIds : previous.sourceAssetIds || []).map(text).filter(Boolean))),
    styleTemplate: input.styleTemplate === true || previous.styleTemplate === true,
    colorVariantOf: text(input.colorVariantOf || previous.colorVariantOf),
    createdAt,
    updatedAt: nowIso()
  }
  PRODUCT_PROFILE_FIELD_DEFINITIONS.forEach(({ key }) => { profile[key] = normalizeField(input[key], previous[key]) })
  const fields = PRODUCT_PROFILE_FIELD_DEFINITIONS.map((item) => item.key)
  profile.confirmedFields = fields.filter((key) => profile[key].value && profile[key].confirmed)
  profile.unconfirmedFields = fields.filter((key) => profile[key].value && !profile[key].confirmed)
  profile.confirmationStatus = profile.unconfirmedFields.length ? 'needs_confirmation' : (profile.confirmedFields.length ? 'confirmed' : 'draft')
  return profile
}

export function saveProductProfile(input = {}) {
  const records = read(PRODUCT_PROFILE_STORAGE_KEY)
  const requestedId = text(input.productId)
  const previous = requestedId ? records.find((item) => item.productId === requestedId && allowed(item)) : null
  const profile = normalizeProfile(input, previous || {})
  write(PRODUCT_PROFILE_STORAGE_KEY, [profile, ...records.filter((item) => item.productId !== profile.productId)])
  return clone(profile, {})
}

export function getProductProfile(productId = '') {
  const record = read(PRODUCT_PROFILE_STORAGE_KEY).find((item) => item.productId === text(productId))
  return record && allowed(record) ? clone(record, null) : null
}

export function listProductProfiles() {
  return read(PRODUCT_PROFILE_STORAGE_KEY).filter(allowed).sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt))).map((item) => clone(item, {}))
}

export function createProductProfileVersion(productId = '') {
  const profile = getProductProfile(productId)
  if (!profile) throw new Error('商品档案不存在或无权访问')
  const versions = read(PRODUCT_PROFILE_VERSION_STORAGE_KEY)
  const versionNumber = versions.filter((item) => item.productId === productId && allowed(item)).length + 1
  const sizeChartSnapshot = profile.sizeChartId ? getSizeChart(profile.sizeChartId) : null
  const snapshot = Object.freeze({ ...clone(profile, {}), version: versionNumber, profileVersionId: id('product_profile_version'), sizeChartSnapshot: clone(sizeChartSnapshot, null), snapshotAt: nowIso() })
  write(PRODUCT_PROFILE_VERSION_STORAGE_KEY, [snapshot, ...versions])
  const updated = saveProductProfile({ ...profile, version: versionNumber, profileVersionId: snapshot.profileVersionId })
  return { profile: updated, version: clone(snapshot, {}) }
}

export function listProductProfileVersions(productId = '') {
  return read(PRODUCT_PROFILE_VERSION_STORAGE_KEY).filter((item) => item.productId === text(productId) && allowed(item)).sort((a, b) => Number(b.version) - Number(a.version)).map((item) => clone(item, {}))
}

export function getProductProfileVersion(productId = '', version = 0) {
  const versions = listProductProfileVersions(productId)
  return versions.find((item) => item.version === Number(version) || item.profileVersionId === text(version)) || null
}

export function restoreProductProfileVersion(productId = '', version = 0) {
  const snapshot = getProductProfileVersion(productId, version)
  if (!snapshot) throw new Error('商品档案历史版本不存在')
  let profile = saveProductProfile({ ...clone(snapshot, {}), productId, profileVersionId: '', version: Math.max(1, Number(snapshot.version) || 1) })
  if (snapshot.sizeChartSnapshot) {
    const chart = saveSizeChart({ ...clone(snapshot.sizeChartSnapshot, {}), sizeChartId: '', productId })
    profile = saveProductProfile({ ...profile, sizeChartId: chart.sizeChartId })
  }
  return createProductProfileVersion(profile.productId)
}

export function copyProductProfile(productId = '', options = {}) {
  const source = getProductProfile(productId)
  if (!source) throw new Error('商品档案不存在或无权访问')
  const keepColor = options.colorVariant !== true
  let copied = saveProductProfile({
    ...clone(source, {}), productId: '', profileVersionId: '', version: 1, sizeChartId: '',
    productName: createProfileField(`${source.productName.value || '商品'}副本`, { source: 'imported', confirmed: true }),
    productCode: createProfileField('', { source: 'manual', confirmed: false }),
    colorName: keepColor ? source.colorName : createProfileField('', { source: 'manual', confirmed: false }),
    colorHex: keepColor ? source.colorHex : createProfileField('', { source: 'manual', confirmed: false }),
    sourceAssetIds: keepColor ? source.sourceAssetIds : [],
    colorVariantOf: options.colorVariant === true ? source.productId : ''
  })
  const sourceChart = source.sizeChartId ? getSizeChart(source.sizeChartId) : null
  if (sourceChart) {
    const copiedChart = saveSizeChart({ ...sourceChart, sizeChartId: '', productId: copied.productId, version: 1 })
    copied = saveProductProfile({ ...copied, sizeChartId: copiedChart.sizeChartId })
  }
  return copied
}

function normalizeColumns(columns = []) {
  return (Array.isArray(columns) && columns.length ? columns : DEFAULT_SIZE_COLUMNS).map((column, index) => ({
    key: text(column.key) || `custom_${index + 1}`,
    label: text(column.label) || `字段${index + 1}`,
    type: column.type === 'text' || text(column.key) === 'size' ? 'text' : 'number'
  }))
}

function normalizeRows(rows = [], columns = []) {
  return (Array.isArray(rows) ? rows : []).map((row) => {
    const next = {}
    columns.forEach((column) => { next[column.key] = text((row || {})[column.key]) })
    return next
  }).filter((row) => Object.values(row).some(Boolean))
}

export function saveSizeChart(input = {}) {
  const records = read(SIZE_CHART_STORAGE_KEY)
  const requestedId = text(input.sizeChartId)
  const previous = requestedId ? records.find((item) => item.sizeChartId === requestedId && allowed(item)) : null
  const current = scope()
  const columns = normalizeColumns(input.columns || (previous || {}).columns)
  const chart = {
    sizeChartId: text((previous || {}).sizeChartId || input.sizeChartId) || id('size_chart'),
    ownerId: current.ownerId,
    enterpriseId: current.enterpriseId,
    productId: text(input.productId || (previous || {}).productId),
    sizeSystem: text(input.sizeSystem || (previous || {}).sizeSystem) || 'CN',
    unit: ['cm', 'inch'].includes(input.unit) ? input.unit : ((previous || {}).unit || 'cm'),
    columns,
    rows: normalizeRows(input.rows, columns),
    measurementNotes: text(input.measurementNotes || (previous || {}).measurementNotes),
    sourceImageAssetId: text(input.sourceImageAssetId || (previous || {}).sourceImageAssetId),
    ocrRawData: clone(input.ocrRawData || (previous || {}).ocrRawData || null, null),
    ocrStatus: text(input.ocrStatus || (previous || {}).ocrStatus) || 'not_requested',
    confirmed: input.confirmed === true,
    confirmedAt: input.confirmed === true ? text(input.confirmedAt) || nowIso() : '',
    version: Math.max(1, Number(input.version || (previous || {}).version) || 1),
    createdAt: text((previous || {}).createdAt || input.createdAt) || nowIso(),
    updatedAt: nowIso()
  }
  write(SIZE_CHART_STORAGE_KEY, [chart, ...records.filter((item) => item.sizeChartId !== chart.sizeChartId)])
  return clone(chart, {})
}

export function getSizeChart(sizeChartId = '') {
  const chart = read(SIZE_CHART_STORAGE_KEY).find((item) => item.sizeChartId === text(sizeChartId))
  return chart && allowed(chart) ? clone(chart, null) : null
}

export function createSizeChartOcrDraft(input = {}) {
  const raw = input.ocrRawData && typeof input.ocrRawData === 'object' ? input.ocrRawData : null
  const rawColumns = raw && Array.isArray(raw.columns) ? raw.columns : []
  const rawRows = raw && Array.isArray(raw.rows) ? raw.rows : []
  const columns = rawColumns.length ? rawColumns : DEFAULT_SIZE_COLUMNS
  return saveSizeChart({
    ...input,
    columns,
    rows: rawRows,
    confirmed: false,
    ocrStatus: rawRows.length ? 'recognized_needs_confirmation' : 'unavailable_needs_manual_entry'
  })
}

export function validateSizeChart(chart = {}, expectedProductId = '') {
  const errors = []
  if (!chart.sizeChartId) errors.push('请选择尺码表')
  if (expectedProductId && chart.productId !== expectedProductId) errors.push('当前尺码表不属于所选商品')
  if (chart.confirmed !== true) errors.push('尺码表尚未确认')
  const columns = normalizeColumns(chart.columns)
  const rows = normalizeRows(chart.rows, columns)
  if (!rows.length) errors.push('尺码表没有有效数据')
  const sizeColumn = columns.find((item) => item.key === 'size')
  if (!sizeColumn) errors.push('尺码表缺少“尺码”列')
  const sizeValues = rows.map((row) => text(row.size))
  if (sizeValues.some((value) => !value)) errors.push('尺码名称不能为空')
  if (new Set(sizeValues).size !== sizeValues.length) errors.push('尺码名称不能重复')
  columns.filter((item) => item.type === 'number').forEach((column) => {
    rows.forEach((row, index) => {
      const value = text(row[column.key])
      if (!value) errors.push(`${column.label}第${index + 1}行不能为空`)
      else if (!Number.isFinite(Number(value)) || Number(value) <= 0 || Number(value) > 500) errors.push(`${column.label}第${index + 1}行数值异常`)
    })
  })
  const standardOrder = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL', '4XL']
  const order = sizeValues.map((value) => standardOrder.indexOf(value.toUpperCase())).filter((value) => value >= 0)
  if (order.some((value, index) => index > 0 && value < order[index - 1])) errors.push('尺码顺序不合理')
  return { ok: errors.length === 0, errors: Array.from(new Set(errors)) }
}

export function confirmSizeChart(sizeChartId = '', expectedProductId = '') {
  const chart = getSizeChart(sizeChartId)
  if (!chart) throw new Error('尺码表不存在或无权访问')
  const check = validateSizeChart({ ...chart, confirmed: true }, expectedProductId)
  if (!check.ok) throw new Error(check.errors[0])
  return saveSizeChart({ ...chart, confirmed: true })
}

export function convertSizeChartUnit(chart = {}, nextUnit = 'cm') {
  if (!['cm', 'inch'].includes(nextUnit)) throw new Error('不支持的尺码单位')
  if (chart.unit === nextUnit) return clone(chart, {})
  const factor = nextUnit === 'inch' ? 1 / 2.54 : 2.54
  const numericKeys = normalizeColumns(chart.columns).filter((item) => item.type === 'number').map((item) => item.key)
  return {
    ...clone(chart, {}), unit: nextUnit, confirmed: false, confirmedAt: '',
    rows: (chart.rows || []).map((row) => ({ ...row, ...Object.fromEntries(numericKeys.map((key) => [key, text(row[key]) ? String(Math.round(Number(row[key]) * factor * 10) / 10) : ''])) }))
  }
}

export function saveSizeChartTemplate(chart = {}, name = '') {
  const check = validateSizeChart(chart, chart.productId)
  if (!check.ok) throw new Error(check.errors[0])
  const current = scope()
  const templates = read(SIZE_CHART_TEMPLATE_STORAGE_KEY)
  const template = { ...clone(chart, {}), templateId: id('size_template'), name: text(name) || '常用尺码模板', ownerId: current.ownerId, enterpriseId: current.enterpriseId, productId: '', createdAt: nowIso(), updatedAt: nowIso() }
  write(SIZE_CHART_TEMPLATE_STORAGE_KEY, [template, ...templates])
  return clone(template, {})
}

export function buildProductProfileSnapshot(productId = '', version = 0) {
  const profile = version ? getProductProfileVersion(productId, version) : getProductProfile(productId)
  if (!profile) throw new Error('商品档案版本不存在或无权访问')
  const chart = profile.sizeChartSnapshot || (profile.sizeChartId ? getSizeChart(profile.sizeChartId) : null)
  if (chart && chart.productId !== profile.productId) throw new Error('商品档案与尺码表不匹配')
  return Object.freeze({
    snapshotId: id('product_content_snapshot'),
    productId: profile.productId,
    productProfileVersion: profile.version,
    profileVersionId: profile.profileVersionId,
    profile: clone(profile, {}),
    sizeChart: chart ? clone(chart, {}) : null,
    sizeChartId: chart ? chart.sizeChartId : '',
    createdAt: nowIso()
  })
}

export function validateProductProfileForDetail(productId = '', version = 0, options = {}) {
  const errors = []
  let snapshot = null
  try { snapshot = buildProductProfileSnapshot(productId, version) } catch (error) { errors.push(error.message); return { ok: false, errors, snapshot: null } }
  const profile = snapshot.profile
  if (profile.productName.confirmed !== true || !profile.productName.value) errors.push('请确认商品名称')
  if (profile.fabricComposition.value && profile.fabricComposition.confirmed !== true) errors.push('面料成分待确认')
  if (profile.careInstruction.value && profile.careInstruction.confirmed !== true) errors.push('洗护说明待确认')
  if (options.requireSizeChart === true) {
    if (!snapshot.sizeChart) errors.push('缺少尺码表')
    else errors.push(...validateSizeChart(snapshot.sizeChart, profile.productId).errors)
  }
  return { ok: errors.length === 0, errors: Array.from(new Set(errors)), snapshot }
}
