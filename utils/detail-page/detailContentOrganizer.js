export const DETAIL_CONTENT_ORGANIZER_VERSION = '1.0.0'
export const DETAIL_ASSET_CONFIDENCE_THRESHOLD = 0.78

export const DETAIL_ASSET_TYPES = Object.freeze([
  Object.freeze({ value: 'product_main', label: '商品主图', moduleId: 'hero' }),
  Object.freeze({ value: 'model_display', label: '模特展示图', moduleId: 'model_display' }),
  Object.freeze({ value: 'flat_front', label: '正面平铺图', moduleId: 'flat_display' }),
  Object.freeze({ value: 'flat_back', label: '背面平铺图', moduleId: 'flat_display' }),
  Object.freeze({ value: 'fabric_detail', label: '面料细节', moduleId: 'fabric' }),
  Object.freeze({ value: 'neckline_detail', label: '领口细节', moduleId: 'craft' }),
  Object.freeze({ value: 'cuff_detail', label: '袖口细节', moduleId: 'craft' }),
  Object.freeze({ value: 'hem_detail', label: '下摆细节', moduleId: 'craft' }),
  Object.freeze({ value: 'hardware_detail', label: '拉链/纽扣/金属链条', moduleId: 'craft' }),
  Object.freeze({ value: 'print_logo', label: '印花/刺绣/Logo', moduleId: 'craft' }),
  Object.freeze({ value: 'craft_detail', label: '工艺细节', moduleId: 'craft' }),
  Object.freeze({ value: 'size_chart_image', label: '尺码表图片', moduleId: 'size_chart' }),
  Object.freeze({ value: 'other', label: '其他素材', moduleId: 'custom' })
])

export const PRODUCT_FACT_FIELDS = Object.freeze([
  Object.freeze({ fieldId: 'productName', label: '商品名称', risk: 'normal' }),
  Object.freeze({ fieldId: 'category', label: '商品大类', risk: 'normal' }),
  Object.freeze({ fieldId: 'fit', label: '版型', risk: 'normal' }),
  Object.freeze({ fieldId: 'color', label: '颜色', risk: 'normal' }),
  Object.freeze({ fieldId: 'neckType', label: '领型', risk: 'normal' }),
  Object.freeze({ fieldId: 'sleeveType', label: '袖型', risk: 'normal' }),
  Object.freeze({ fieldId: 'lengthType', label: '衣长', risk: 'normal' }),
  Object.freeze({ fieldId: 'pattern', label: '图案', risk: 'normal' }),
  Object.freeze({ fieldId: 'decoration', label: '装饰与五金', risk: 'normal' }),
  Object.freeze({ fieldId: 'materialComposition', label: '面料成分', risk: 'high' }),
  Object.freeze({ fieldId: 'weight', label: '克重', risk: 'high' }),
  Object.freeze({ fieldId: 'care', label: '洗护参数', risk: 'high' }),
  Object.freeze({ fieldId: 'certification', label: '认证信息', risk: 'high' }),
  Object.freeze({ fieldId: 'origin', label: '产地', risk: 'high' }),
  Object.freeze({ fieldId: 'price', label: '价格', risk: 'high' }),
  Object.freeze({ fieldId: 'stock', label: '库存', risk: 'high' }),
  Object.freeze({ fieldId: 'sellingPoints', label: '真实卖点', risk: 'normal' }),
  Object.freeze({ fieldId: 'usageScene', label: '适用场景', risk: 'normal' })
])

const LEGACY_USAGE_MAP = Object.freeze({
  front: 'product_main',
  back: 'flat_back',
  model: 'model_display',
  flat: 'flat_front',
  fabric: 'fabric_detail',
  neckline: 'neckline_detail',
  cuff: 'cuff_detail',
  hardware: 'hardware_detail'
})

const FILE_NAME_RULES = Object.freeze([
  Object.freeze({ pattern: /model|模特|上身|穿着/i, assetType: 'model_display', details: ['人物穿着'] }),
  Object.freeze({ pattern: /back|背面/i, assetType: 'flat_back', details: ['背面'] }),
  Object.freeze({ pattern: /flat|平铺|正面/i, assetType: 'flat_front', details: ['平铺'] }),
  Object.freeze({ pattern: /fabric|面料|材质/i, assetType: 'fabric_detail', details: ['面料近照'] }),
  Object.freeze({ pattern: /neck|领口/i, assetType: 'neckline_detail', details: ['领口'] }),
  Object.freeze({ pattern: /cuff|袖口/i, assetType: 'cuff_detail', details: ['袖口'] }),
  Object.freeze({ pattern: /hem|下摆/i, assetType: 'hem_detail', details: ['下摆'] }),
  Object.freeze({ pattern: /chain|metal|zipper|button|链条|金属|拉链|纽扣/i, assetType: 'hardware_detail', details: ['金属链条或五金装饰'] }),
  Object.freeze({ pattern: /logo|print|embroidery|印花|刺绣/i, assetType: 'print_logo', details: ['印花、刺绣或Logo'] }),
  Object.freeze({ pattern: /size|尺码/i, assetType: 'size_chart_image', details: ['尺码表'] })
])

const MODULE_PRIORITY = Object.freeze([
  'hero', 'model_display', 'flat_display', 'fit', 'fabric', 'craft', 'selling_points', 'product_info', 'size_chart', 'care', 'brand', 'custom'
])

function text(value = '') {
  return String(value || '').trim()
}

function nowIso() {
  return new Date().toISOString()
}

function normalizedUsage(value = '') {
  const usage = text(value)
  return LEGACY_USAGE_MAP[usage] || (DETAIL_ASSET_TYPES.some((item) => item.value === usage) ? usage : 'other')
}

function typeMeta(assetType = '') {
  return DETAIL_ASSET_TYPES.find((item) => item.value === assetType) || DETAIL_ASSET_TYPES[DETAIL_ASSET_TYPES.length - 1]
}

function assetName(asset = {}) {
  return text(asset.fileName || asset.name || asset.originalName || asset.localPath || asset.fileUrl || asset.fileId)
}

function classifyAsset(asset = {}, previous = null, primary = false) {
  if (previous && previous.userConfirmed === true) return { ...previous }
  if (primary) {
    return {
      assetId: text(asset.assetId || asset.fileId),
      assetType: 'product_main',
      confidence: 1,
      detectedDetails: ['用户上传的商品主图'],
      recommendedModule: 'hero',
      userConfirmed: true,
      sourceType: 'user_upload_slot'
    }
  }
  const explicitUsage = normalizedUsage(asset.usage)
  if (asset.usageConfirmed === true && explicitUsage !== 'other') {
    const meta = typeMeta(explicitUsage)
    return {
      assetId: text(asset.assetId || asset.fileId),
      assetType: explicitUsage,
      confidence: 1,
      detectedDetails: [`用户确认为${meta.label}`],
      recommendedModule: meta.moduleId,
      userConfirmed: true,
      sourceType: 'user_confirmed'
    }
  }
  const matched = FILE_NAME_RULES.find((rule) => rule.pattern.test(assetName(asset)))
  const assetType = matched ? matched.assetType : explicitUsage
  const meta = typeMeta(assetType)
  const confidence = matched ? 0.62 : (assetType !== 'other' ? 0.68 : 0.2)
  return {
    assetId: text(asset.assetId || asset.fileId),
    assetType,
    confidence,
    detectedDetails: matched ? [...matched.details] : [],
    recommendedModule: meta.moduleId,
    userConfirmed: false,
    sourceType: matched ? 'local_filename_rule' : 'existing_usage_hint'
  }
}

export function classifyDetailAssets(assets = [], previousClassifications = []) {
  const previousMap = new Map((Array.isArray(previousClassifications) ? previousClassifications : []).map((item) => [item.assetId, item]))
  return (Array.isArray(assets) ? assets : []).filter((asset) => asset && (asset.assetId || asset.fileId)).map((asset, index) => {
    const id = text(asset.assetId || asset.fileId)
    return classifyAsset(asset, previousMap.get(id), index === 0 && asset.usage === 'product_main')
  })
}

export function normalizeProductFacts(input = {}, previousFacts = []) {
  const previousMap = new Map((Array.isArray(previousFacts) ? previousFacts : []).map((item) => [item.fieldId, item]))
  return PRODUCT_FACT_FIELDS.map((field) => {
    const previous = previousMap.get(field.fieldId) || {}
    const hasRaw = Object.prototype.hasOwnProperty.call(input || {}, field.fieldId)
    const raw = input[field.fieldId]
    const value = hasRaw ? text(raw && typeof raw === 'object' ? raw.value : raw) : text(previous.value)
    const explicitlyConfirmed = Boolean(value && ((raw && typeof raw === 'object' && raw.confirmedByUser === true) || (hasRaw && typeof raw === 'string') || (!hasRaw && previous.confirmedByUser === true)))
    return {
      ...field,
      value,
      status: explicitlyConfirmed ? 'confirmed' : (value ? 'ai_detected' : 'missing'),
      sourceType: explicitlyConfirmed ? 'user_confirmed' : (value ? text(previous.sourceType) || 'ai_detected' : 'missing'),
      confidence: explicitlyConfirmed ? 1 : Math.min(0.7, Number(previous.confidence) || 0),
      needsConfirmation: !explicitlyConfirmed,
      confirmedByUser: explicitlyConfirmed,
      userEdited: previous.userEdited === true || Boolean(raw && typeof raw === 'object' && raw.userEdited === true)
    }
  })
}

function confirmedFactMap(productFacts = []) {
  return Object.fromEntries((Array.isArray(productFacts) ? productFacts : [])
    .filter((item) => item.confirmedByUser === true && text(item.value))
    .map((item) => [item.fieldId, text(item.value)]))
}

function copyItem(copyId, title, content, sourceFieldIds, confidence = 1) {
  return {
    copyId,
    title,
    content: text(content),
    sourceType: 'confirmed_product_facts',
    sourceFieldIds: sourceFieldIds.filter(Boolean),
    confidence,
    needsConfirmation: false
  }
}

export function buildSafeGeneratedCopy(productFacts = [], previousCopy = []) {
  const facts = confirmedFactMap(productFacts)
  const previousMap = new Map((Array.isArray(previousCopy) ? previousCopy : []).map((item) => [item.copyId, item]))
  const keepManual = (copyId, fallback) => {
    const previous = previousMap.get(copyId)
    return previous && previous.userEdited === true ? { ...previous } : fallback
  }
  const titleParts = [facts.productName, facts.category, facts.color].filter(Boolean)
  const sellingPoints = text(facts.sellingPoints).split(/[，,；;\n]/).map(text).filter(Boolean).slice(0, 5)
  const fitParts = [facts.fit, facts.neckType, facts.sleeveType, facts.lengthType].filter(Boolean)
  const craftParts = [facts.pattern, facts.decoration].filter(Boolean)
  const items = [
    keepManual('product_title', copyItem('product_title', '商品标题建议', titleParts.join(' · ') || facts.productName, ['productName', 'category', 'color'])),
    keepManual('selling_points', copyItem('selling_points', '核心卖点', sellingPoints.join('；'), ['sellingPoints'])),
    keepManual('fit_description', copyItem('fit_description', '版型说明', fitParts.length ? `本款可见设计：${fitParts.join('、')}。` : '', ['fit', 'neckType', 'sleeveType', 'lengthType'])),
    keepManual('fabric_description', copyItem('fabric_description', '面料视觉说明', facts.materialComposition ? `已确认面料信息：${facts.materialComposition}。` : '', ['materialComposition'])),
    keepManual('craft_description', copyItem('craft_description', '细节工艺说明', craftParts.length ? `可见细节：${craftParts.join('、')}，以商品实物图片为准。` : '', ['pattern', 'decoration'])),
    keepManual('usage_scene', copyItem('usage_scene', '适用场景', facts.usageScene ? `适合${facts.usageScene}。` : '', ['usageScene']))
  ]
  return items.filter((item) => item.userEdited === true || item.content)
}

export function recommendDetailModules(classifications = [], productFacts = [], sizeRows = []) {
  const confirmedAssets = (Array.isArray(classifications) ? classifications : []).filter((item) => item.userConfirmed === true)
  const modules = new Set(['hero'])
  confirmedAssets.forEach((item) => modules.add(item.recommendedModule))
  const facts = confirmedFactMap(productFacts)
  if ([facts.fit, facts.neckType, facts.sleeveType, facts.lengthType].some(Boolean)) modules.add('fit')
  if (facts.sellingPoints) modules.add('selling_points')
  if ([facts.category, facts.color, facts.materialComposition].some(Boolean)) modules.add('product_info')
  if (facts.care) modules.add('care')
  if ((Array.isArray(sizeRows) ? sizeRows : []).some((row) => row.confirmedByUser === true)) modules.add('size_chart')
  return MODULE_PRIORITY.filter((id) => modules.has(id))
}

export function organizeDetailContent(input = {}, previous = {}) {
  const productFacts = normalizeProductFacts(input.productFacts || {}, previous.productFacts)
  const assetClassifications = classifyDetailAssets(input.assets, previous.assetClassifications)
  const generatedCopy = buildSafeGeneratedCopy(productFacts, previous.generatedCopy)
  const recommendedModuleIds = recommendDetailModules(assetClassifications, productFacts, input.sizeRows)
  const unresolvedFields = productFacts
    .filter((item) => item.status !== 'confirmed')
    .map((item) => ({ fieldId: item.fieldId, label: item.label, risk: item.risk, reason: item.value ? '待用户确认' : '待补充' }))
  const pendingAssets = assetClassifications.filter((item) => item.userConfirmed !== true || item.confidence < DETAIL_ASSET_CONFIDENCE_THRESHOLD)
  return {
    contentVersion: Math.max(0, Number(previous.contentVersion) || 0) + 1,
    organizerVersion: DETAIL_CONTENT_ORGANIZER_VERSION,
    organizerMode: 'local_safe_rules',
    assetClassifications,
    productFacts,
    recommendedModuleIds,
    generatedCopy,
    confirmationStatus: pendingAssets.length || unresolvedFields.some((item) => item.risk === 'high') ? 'needs_confirmation' : 'ready',
    unresolvedFields,
    pendingAssetIds: pendingAssets.map((item) => item.assetId),
    createdAt: nowIso(),
    updatedAt: nowIso()
  }
}

export function validateOrganizationForRender(organization = {}) {
  const errors = []
  if (Math.max(0, Number(organization.contentVersion) || 0) < 1) errors.push('请先完成AI内容整理')
  const classifications = Array.isArray(organization.assetClassifications) ? organization.assetClassifications : []
  if (classifications.some((item) => item.userConfirmed !== true && item.recommendedModule !== 'custom')) errors.push('请确认待确认素材的用途')
  const copy = Array.isArray(organization.generatedCopy) ? organization.generatedCopy : []
  if (copy.some((item) => item.needsConfirmation === true)) errors.push('请确认待确认文案')
  return { ok: errors.length === 0, errors }
}

export function validateDetailContentTruthfulness(input = {}) {
  const errors = []
  const primaryAsset = input.primaryAsset || {}
  const facts = Array.isArray(input.productFacts) ? input.productFacts : []
  const copy = Array.isArray(input.generatedCopy) ? input.generatedCopy : []
  const modules = Array.isArray(input.modules) ? input.modules.filter((item) => item.enabled) : []
  const sizeRows = Array.isArray(input.sizeRows) ? input.sizeRows : []
  const confirmedFactIds = new Set(facts.filter((item) => item.confirmedByUser === true && text(item.value)).map((item) => item.fieldId))

  if (!text(primaryAsset.fileId)) errors.push('请上传商品主图')
  if (sizeRows.some((row) => Object.keys(row || {}).some((key) => !['unit', 'source', 'confirmedByUser', 'measurementNote'].includes(key) && text(row[key])) && row.confirmedByUser !== true)) {
    errors.push('存在未确认的尺码数据，请确认或删除后再生成')
  }
  if (facts.some((item) => ['materialComposition', 'weight', 'care', 'certification', 'origin', 'price', 'stock', 'functionalClaims'].includes(item.fieldId) && text(item.value) && item.confirmedByUser !== true)) {
    errors.push('面料成分、克重、洗护、认证、产地、价格、库存或功能信息必须由用户确认')
  }
  if (copy.some((item) => item.needsConfirmation === true || (item.sourceFieldIds || []).some((id) => !confirmedFactIds.has(id)))) {
    errors.push('AI整理文案存在未确认或无来源内容')
  }
  if (modules.some((item) => item.imageSource === 'ai_reference' && item.sourceConfirmed !== true)) {
    errors.push('AI参考图必须经用户确认后才能进入正式长图')
  }
  const riskyCopy = modules.map((item) => text(item.text || item.content)).join(' ')
  const riskRules = [
    { pattern: /100%|纯棉|真丝含量|羊毛含量|成分[:：]?\s*\d/i, factId: 'materialComposition', label: '面料成分' },
    { pattern: /抗菌|防晒|防水|防皱|阻燃/i, factId: 'functionalClaims', label: '功能' },
    { pattern: /认证|检测报告/i, factId: 'certification', label: '认证' },
    { pattern: /产地[:：]|原产地/i, factId: 'origin', label: '产地' },
    { pattern: /价格[:：]|￥|¥/i, factId: 'price', label: '价格' },
    { pattern: /库存[:：]|现货\d+/i, factId: 'stock', label: '库存' }
  ]
  riskRules.forEach((rule) => {
    if (rule.pattern.test(riskyCopy) && !confirmedFactIds.has(rule.factId)) errors.push(`${rule.label}缺少已确认的数据来源`)
  })
  return { ok: errors.length === 0, errors: Array.from(new Set(errors)) }
}
