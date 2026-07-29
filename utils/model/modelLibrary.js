const STORAGE_KEY = 'diebiandesign_custom_models'

export const MODEL_TYPES = Object.freeze({
  SYSTEM: 'system',
  PERSONAL: 'personal',
  BRAND: 'brand'
})

export const MODEL_CATEGORY_TAGS = Object.freeze(['女装', '男装', '童装', '运动'])
export const MODEL_PLATFORM_TAGS = Object.freeze(['淘宝', '小红书', '抖音', '跨境'])

function nowIso() {
  return new Date().toISOString()
}

function normalizeTags(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || '').trim()).filter(Boolean)
  }
  return String(value || '')
    .split(/[,，、]/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function getGenderPrompt(gender) {
  const labels = {
    female: '女性',
    male: '男性',
    kids: '儿童'
  }
  return labels[gender] || '人物'
}

function buildCustomModelPrompt(model = {}) {
  const styleTags = normalizeTags(model.styleTags)
  const categoryTags = normalizeTags(model.categoryTags)
  const identity = [model.ageRange, model.region, getGenderPrompt(model.gender)].filter(Boolean).join('')
  const body = [model.height, model.bodyType ? `${model.bodyType}身材` : ''].filter(Boolean).join('，')
  const style = styleTags.length ? `${styleTags.join('、')}风格` : '品牌商业展示风格'
  const category = categoryTags.length ? `，适合${categoryTags.join('、')}` : ''
  return `${identity || '品牌专属人物'}模特，${body || '自然身材比例'}，${style}${category}，商业服装摄影质感，保持固定人物身份和外观特征。`
}

function normalizeModelType(value, isCustom) {
  if (Object.values(MODEL_TYPES).includes(value)) return value
  return isCustom ? MODEL_TYPES.PERSONAL : MODEL_TYPES.SYSTEM
}

function inferPlatformTags(model = {}) {
  const source = [...normalizeTags(model.sceneTags), ...normalizeTags(model.styleTags)].join('')
  const tags = []
  if (/小红书|种草|街拍/.test(source)) tags.push('小红书')
  if (/白底|跨境/.test(source)) tags.push('跨境')
  if (/直播|短视频|抖音/.test(source)) tags.push('抖音')
  if (/电商|棚拍|详情|主图/.test(source)) tags.push('淘宝')
  return tags.length ? tags : ['淘宝', '抖音']
}

function cloneVersion(version = {}) {
  return {
    modelVersion: String(version.modelVersion || 'v1'),
    name: version.name || version.modelName || '',
    avatarUrl: version.avatarUrl || version.coverUrl || '',
    frontImageUrl: version.frontImageUrl || version.avatarUrl || '',
    sideImageUrl: version.sideImageUrl || version.avatarUrl || '',
    fullBodyUrl: version.fullBodyUrl || version.fullBodyImageUrl || '',
    gender: version.gender || '',
    ageRange: version.ageRange || '',
    height: version.height || '',
    bodyType: version.bodyType || '',
    skinTone: version.skinTone || '',
    region: version.region || '',
    hairStyle: version.hairStyle || '',
    faceStyle: version.faceStyle || '',
    modelPrompt: version.modelPrompt || '',
    styleTags: normalizeTags(version.styleTags),
    categoryTags: normalizeTags(version.categoryTags),
    platformTags: normalizeTags(version.platformTags),
    usageScope: version.usageScope || '',
    commercialUse: version.commercialUse === undefined ? true : !!version.commercialUse,
    createdAt: version.createdAt || nowIso()
  }
}

function createVersionSnapshot(model = {}) {
  return cloneVersion({
    ...model,
    modelVersion: model.modelVersion || 'v1'
  })
}

function cloneModel(model = {}) {
  const avatarUrl = model.avatarUrl || model.coverUrl || ''
  const fullBodyUrl = model.fullBodyUrl || model.fullBodyImageUrl || avatarUrl
  const isCustom = !!model.isCustom
  const modelType = normalizeModelType(model.modelType, isCustom)
  const modelVersion = String(model.modelVersion || 'v1')
  const versionHistory = Array.isArray(model.versionHistory)
    ? model.versionHistory.map(cloneVersion)
    : []
  return {
    modelId: model.modelId || '',
    name: model.name || model.modelName || '',
    modelName: model.name || model.modelName || '',
    avatarUrl,
    frontImageUrl: model.frontImageUrl || avatarUrl,
    sideImageUrl: model.sideImageUrl || avatarUrl,
    fullBodyUrl,
    fullBodyImageUrl: fullBodyUrl,
    gender: model.gender || '',
    ageRange: model.ageRange || '',
    height: model.height || '',
    bodyType: model.bodyType || '',
    skinTone: model.skinTone || '',
    region: model.region || '',
    hairStyle: model.hairStyle || '',
    faceStyle: model.faceStyle || '',
    styleTags: normalizeTags(model.styleTags),
    categoryTags: normalizeTags(model.categoryTags),
    platformTags: normalizeTags(model.platformTags).length
      ? normalizeTags(model.platformTags)
      : inferPlatformTags(model),
    sceneTags: normalizeTags(model.sceneTags),
    modelPrompt: model.modelPrompt || '',
    coverUrl: avatarUrl,
    modelType,
    modelVersion,
    versionHistory,
    companyId: model.companyId || '',
    usageScope: model.usageScope || (modelType === MODEL_TYPES.SYSTEM ? '平台公共资产' : '个人生成使用'),
    isCustom,
    commercialUse: model.commercialUse === undefined ? true : !!model.commercialUse,
    createdAt: model.createdAt || nowIso()
  }
}

function readCustomModels() {
  try {
    if (typeof uni === 'undefined' || !uni.getStorageSync) {
      return []
    }
    const value = uni.getStorageSync(STORAGE_KEY)
    return Array.isArray(value) ? value.map(cloneModel) : []
  } catch (error) {
    return []
  }
}

function writeCustomModels(models = []) {
  try {
    if (typeof uni !== 'undefined' && uni.setStorageSync) {
      uni.setStorageSync(STORAGE_KEY, models.map(cloneModel))
    }
  } catch (error) {}
}

const SYSTEM_MODELS = [
  {
    modelId: 'sys_model_001',
    name: '亚洲女模001',
    avatarUrl: '/static/models/model-001-avatar.jpg',
    frontImageUrl: '/static/models/model-001-front.jpg',
    fullBodyImageUrl: '/static/models/model-001-full.jpg',
    gender: 'female',
    ageRange: '18-25岁',
    height: '165cm',
    bodyType: '标准',
    faceStyle: '鹅蛋脸',
    hairStyle: '黑色长发',
    skinTone: '自然肤色',
    region: '亚洲',
    styleTags: ['年轻', '清新', '白底棚拍'],
    categoryTags: ['女装', 'T恤', '连衣裙'],
    sceneTags: ['电商主图', '白底图', '小红书'],
    modelPrompt: '18-25岁亚洲女性商业模特，鹅蛋脸，黑色长发，165cm，标准身材，清新自然气质，适合女装、电商白底棚拍、主图和小红书展示。',
    isCustom: false,
    commercialUse: true,
    createdAt: '2026-07-17T00:00:00.000Z'
  },
  {
    modelId: 'sys_model_002',
    name: '亚洲女模002',
    avatarUrl: '/static/models/model-002-avatar.jpg',
    frontImageUrl: '/static/models/model-002-front.jpg',
    fullBodyImageUrl: '/static/models/model-002-full.jpg',
    gender: 'female',
    ageRange: '25-35岁',
    height: '166cm',
    bodyType: '标准',
    faceStyle: '椭圆脸',
    hairStyle: '锁骨发',
    skinTone: '自然肤色',
    region: '亚洲',
    styleTags: ['通勤风', '职业感', '简洁'],
    categoryTags: ['女装', '衬衫', '西装', '半裙'],
    sceneTags: ['电商棚拍', '详情页', '品牌画册'],
    modelPrompt: '25-35岁亚洲女性商业模特，椭圆脸，锁骨发，166cm，标准身材，通勤职业气质，适合女装、西装、衬衫、电商棚拍和详情页展示。',
    isCustom: false,
    commercialUse: true,
    createdAt: '2026-07-17T00:00:00.000Z'
  },
  {
    modelId: 'sys_model_003',
    name: '亚洲女模003',
    avatarUrl: '/static/models/model-003-avatar.jpg',
    frontImageUrl: '/static/models/model-003-front.jpg',
    fullBodyImageUrl: '/static/models/model-003-full.jpg',
    gender: 'female',
    ageRange: '35-45岁',
    height: '166cm',
    bodyType: '标准',
    faceStyle: '高级脸',
    hairStyle: '低发髻',
    skinTone: '自然肤色',
    region: '亚洲',
    styleTags: ['轻熟', '轻奢', '高级感'],
    categoryTags: ['女装', '西装', '大衣'],
    sceneTags: ['棚拍', '品牌画册', '详情页'],
    modelPrompt: '35-45岁亚洲女性商业模特，高级脸，低发髻，166cm，标准身材，轻熟轻奢气质，适合女装、大衣、西装、品牌画册和电商详情页展示。',
    isCustom: false,
    commercialUse: true,
    createdAt: '2026-07-17T00:00:00.000Z'
  },
  {
    modelId: 'sys_model_004',
    name: '亚洲女模004',
    avatarUrl: '/static/models/model-004-avatar.jpg',
    frontImageUrl: '/static/models/model-004-front.jpg',
    fullBodyImageUrl: '/static/models/model-004-full.jpg',
    gender: 'female',
    ageRange: '25-35',
    height: '163cm',
    bodyType: '大码',
    faceStyle: '圆脸',
    hairStyle: '中长发',
    skinTone: '自然肤色',
    region: '亚洲',
    styleTags: ['大码', '亲和', '生活方式'],
    categoryTags: ['大码女装', '连衣裙', '休闲装'],
    sceneTags: ['电商棚拍', '详情页', '多色SKU'],
    modelPrompt: '25-35岁亚洲女性商业模特，圆脸，中长发，163cm，大码身材，亲和自信气质，适合大码女装、连衣裙、休闲装、电商棚拍和详情页展示。',
    isCustom: false,
    commercialUse: true,
    createdAt: '2026-07-17T00:00:00.000Z'
  },
  {
    modelId: 'sys_model_005',
    name: '国风女模005',
    avatarUrl: '/static/models/model-005-avatar.jpg',
    frontImageUrl: '/static/models/model-005-front.jpg',
    fullBodyImageUrl: '/static/models/model-005-full.jpg',
    gender: 'female',
    ageRange: '25-35岁',
    height: '168cm',
    bodyType: '高挑',
    faceStyle: '鹅蛋脸',
    hairStyle: '黑色盘发',
    skinTone: '自然肤色',
    region: '亚洲',
    styleTags: ['国风', '雅致', '东方感'],
    categoryTags: ['汉服', '新中式', '旗袍', '国风女装'],
    sceneTags: ['棚拍', '国风场景', '品牌画册'],
    modelPrompt: '25-35岁亚洲女性商业模特，鹅蛋脸，黑色盘发，168cm，高挑身材，雅致东方气质，适合汉服、新中式、旗袍、国风女装和品牌画册展示。',
    isCustom: false,
    commercialUse: true,
    createdAt: '2026-07-17T00:00:00.000Z'
  },
  {
    modelId: 'sys_model_006',
    name: '商务男模006',
    avatarUrl: '/static/models/model-006-avatar.jpg',
    frontImageUrl: '/static/models/model-006-front.jpg',
    fullBodyImageUrl: '/static/models/model-006-full.jpg',
    gender: 'male',
    ageRange: '30-40岁',
    height: '180cm',
    bodyType: '标准',
    faceStyle: '成熟轮廓',
    hairStyle: '黑色短发',
    skinTone: '自然肤色',
    region: '亚洲',
    styleTags: ['商务', '稳重', '高级感'],
    categoryTags: ['男装', '西装', '衬衫', '大衣'],
    sceneTags: ['商务棚拍', '详情页', '品牌画册'],
    modelPrompt: '30-40岁亚洲男性商业模特，成熟轮廓，黑色短发，180cm，标准身材，商务稳重气质，适合男装、西装、衬衫、大衣和品牌画册展示。',
    isCustom: false,
    commercialUse: true,
    createdAt: '2026-07-17T00:00:00.000Z'
  },
  {
    modelId: 'sys_model_007',
    name: '休闲男模007',
    avatarUrl: '/static/models/model-007-avatar.jpg',
    frontImageUrl: '/static/models/model-007-front.jpg',
    fullBodyImageUrl: '/static/models/model-007-full.jpg',
    gender: 'male',
    ageRange: '20-30岁',
    height: '178cm',
    bodyType: '高挑',
    faceStyle: '阳光脸',
    hairStyle: '自然短发',
    skinTone: '健康肤色',
    region: '亚洲',
    styleTags: ['休闲', '街拍', '运动'],
    categoryTags: ['男装', '卫衣', '夹克', '休闲裤'],
    sceneTags: ['街拍', '户外', '直播封面'],
    modelPrompt: '20-30岁亚洲男性商业模特，阳光脸，自然短发，178cm，高挑身材，休闲街拍气质，适合男装、卫衣、夹克、休闲裤、户外和直播封面展示。',
    isCustom: false,
    commercialUse: true,
    createdAt: '2026-07-17T00:00:00.000Z'
  },
  {
    modelId: 'sys_model_008',
    name: '男童模特008',
    avatarUrl: '/static/models/model-008-avatar.jpg',
    frontImageUrl: '/static/models/model-008-front.jpg',
    fullBodyImageUrl: '/static/models/model-008-full.jpg',
    gender: 'kids',
    ageRange: '6-9岁',
    height: '125cm',
    bodyType: '标准',
    faceStyle: '圆脸',
    hairStyle: '自然短发',
    skinTone: '自然肤色',
    region: '亚洲',
    styleTags: ['男童', '活力', '运动'],
    categoryTags: ['男童装', '运动套装', '卫衣'],
    sceneTags: ['儿童棚拍', '户外', '上新图'],
    modelPrompt: '6-9岁亚洲男童商业模特，圆脸，自然短发，125cm，标准身材，活力运动气质，适合男童装、运动套装、卫衣、儿童棚拍和上新图展示。',
    isCustom: false,
    commercialUse: true,
    createdAt: '2026-07-17T00:00:00.000Z'
  },
  {
    modelId: 'sys_model_009',
    name: '女童模特009',
    avatarUrl: '/static/models/model-009-avatar.jpg',
    frontImageUrl: '/static/models/model-009-front.jpg',
    fullBodyImageUrl: '/static/models/model-009-full.jpg',
    gender: 'kids',
    ageRange: '5-8岁',
    height: '118cm',
    bodyType: '标准',
    faceStyle: '甜美圆脸',
    hairStyle: '黑色中长发',
    skinTone: '自然肤色',
    region: '亚洲',
    styleTags: ['女童', '甜美', '清新'],
    categoryTags: ['女童装', '连衣裙', '针织衫'],
    sceneTags: ['儿童棚拍', '亲子场景', '上新图'],
    modelPrompt: '5-8岁亚洲女童商业模特，甜美圆脸，黑色中长发，118cm，标准身材，清新亲和气质，适合女童装、连衣裙、针织衫、儿童棚拍和亲子场景展示。',
    isCustom: false,
    commercialUse: true,
    createdAt: '2026-07-17T00:00:00.000Z'
  },
  {
    modelId: 'sys_model_010',
    name: '亚洲女模010',
    avatarUrl: '/static/models/model-010-avatar.jpg',
    frontImageUrl: '/static/models/model-010-front.jpg',
    fullBodyImageUrl: '/static/models/model-010-full.jpg',
    gender: 'female',
    ageRange: '20-30岁',
    height: '170cm',
    bodyType: '高挑',
    faceStyle: '小方脸',
    hairStyle: '黑色直发',
    skinTone: '自然肤色',
    region: '亚洲',
    styleTags: ['街拍', '潮流', '小红书'],
    categoryTags: ['女装', '牛仔', '夹克', '休闲装'],
    sceneTags: ['街拍', '小红书', '内容封面'],
    modelPrompt: '20-30岁亚洲女性商业模特，小方脸，黑色直发，170cm，高挑身材，潮流街拍气质，适合女装、牛仔、夹克、休闲装、小红书和内容封面展示。',
    isCustom: false,
    commercialUse: true,
    createdAt: '2026-07-17T00:00:00.000Z'
  }
]

export function getSystemModels() {
  return SYSTEM_MODELS.map(cloneModel)
}

export function getMyModels() {
  return readCustomModels()
}

export function getPersonalModels() {
  return getMyModels().filter((model) => model.modelType === MODEL_TYPES.PERSONAL)
}

export function getBrandModels(companyId = '') {
  const normalizedCompanyId = String(companyId || '').trim()
  return getMyModels().filter((model) => {
    if (model.modelType !== MODEL_TYPES.BRAND) return false
    return !normalizedCompanyId || model.companyId === normalizedCompanyId
  })
}

export function getModelById(modelId) {
  const normalizedId = String(modelId || '').trim()
  if (!normalizedId) {
    return null
  }
  return [...getSystemModels(), ...getMyModels()].find((model) => model.modelId === normalizedId) || null
}

export function createCustomModel(model = {}) {
  const modelType = normalizeModelType(model.modelType, true)
  const nextModel = cloneModel({
    ...model,
    modelId: model.modelId || `custom_model_${Date.now()}`,
    modelPrompt: model.modelPrompt || buildCustomModelPrompt(model),
    modelType,
    modelVersion: model.modelVersion || 'v1',
    isCustom: true,
    createdAt: model.createdAt || nowIso()
  })
  nextModel.versionHistory = [createVersionSnapshot(nextModel)]
  const models = getMyModels()
  const nextModels = [nextModel, ...models.filter((item) => item.modelId !== nextModel.modelId)]
  writeCustomModels(nextModels)
  console.log('[model:custom]', {
    modelId: nextModel.modelId,
    name: nextModel.name
  })
  if (nextModel.modelType === MODEL_TYPES.BRAND) {
    console.log('[model:brand]', {
      modelId: nextModel.modelId,
      companyId: nextModel.companyId
    })
  }
  return nextModel
}

export function createBrandModel(model = {}) {
  return createCustomModel({
    ...model,
    modelType: MODEL_TYPES.BRAND,
    usageScope: model.usageScope || '企业品牌视觉资产',
    commercialUse: model.commercialUse === undefined ? true : model.commercialUse
  })
}

export function updateCustomModel(modelId, patch = {}) {
  const current = getMyModels().find((model) => model.modelId === modelId)
  if (!current) {
    return null
  }
  const merged = {
    ...current,
    ...patch,
    modelId: current.modelId,
    modelType: current.modelType,
    modelVersion: current.modelVersion,
    versionHistory: current.versionHistory,
    isCustom: true,
    createdAt: current.createdAt
  }
  const nextModel = cloneModel({
    ...merged,
    modelPrompt: patch.modelPrompt || buildCustomModelPrompt(merged)
  })
  const models = getMyModels().map((model) => model.modelId === modelId ? nextModel : model)
  writeCustomModels(models)
  console.log('[model:custom]', {
    modelId: nextModel.modelId,
    name: nextModel.name
  })
  if (nextModel.modelType === MODEL_TYPES.BRAND) {
    console.log('[model:brand]', {
      modelId: nextModel.modelId,
      companyId: nextModel.companyId
    })
  }
  return nextModel
}

export function getModelVersions(modelId) {
  const model = getModelById(modelId)
  if (!model) return []
  const versions = Array.isArray(model.versionHistory) ? model.versionHistory : []
  const current = createVersionSnapshot(model)
  const merged = [...versions.filter((item) => item.modelVersion !== current.modelVersion), current]
  return merged.sort((left, right) => String(left.modelVersion).localeCompare(String(right.modelVersion), undefined, { numeric: true }))
}

export function createModelVersion(modelId, patch = {}) {
  const current = getMyModels().find((model) => model.modelId === modelId)
  if (!current) return null
  const versions = getModelVersions(modelId)
  const nextNumber = versions.reduce((max, item) => {
    const matched = String(item.modelVersion || '').match(/(\d+)/)
    return Math.max(max, matched ? Number(matched[1]) : 0)
  }, 0) + 1
  const nextVersion = String(patch.modelVersion || `v${nextNumber}`)
  const merged = {
    ...current,
    ...patch,
    modelId: current.modelId,
    modelType: current.modelType,
    modelVersion: nextVersion,
    isCustom: true,
    createdAt: current.createdAt
  }
  const nextModel = cloneModel({
    ...merged,
    modelPrompt: patch.modelPrompt || buildCustomModelPrompt(merged),
    versionHistory: [...versions, createVersionSnapshot({ ...merged, modelVersion: nextVersion })]
  })
  writeCustomModels(getMyModels().map((model) => model.modelId === modelId ? nextModel : model))
  if (nextModel.modelType === MODEL_TYPES.BRAND) {
    console.log('[model:brand]', { modelId: nextModel.modelId, companyId: nextModel.companyId })
  }
  return nextModel
}

export function switchModelVersion(modelId, modelVersion) {
  const current = getMyModels().find((model) => model.modelId === modelId)
  if (!current) return null
  const versions = getModelVersions(modelId)
  const target = versions.find((item) => item.modelVersion === modelVersion)
  if (!target) return null
  const nextModel = cloneModel({
    ...current,
    ...target,
    modelId: current.modelId,
    name: target.name || current.name,
    modelType: current.modelType,
    companyId: current.companyId,
    versionHistory: versions,
    isCustom: true,
    createdAt: current.createdAt
  })
  writeCustomModels(getMyModels().map((model) => model.modelId === modelId ? nextModel : model))
  return nextModel
}

export function deleteCustomModel(modelId) {
  const models = getMyModels()
  const target = models.find((model) => model.modelId === modelId)
  if (!target) {
    return false
  }
  writeCustomModels(models.filter((model) => model.modelId !== modelId))
  console.log('[model:custom]', {
    modelId: target.modelId,
    name: target.name
  })
  return true
}
