import { getBrandGenerationParams } from '../brand/brandRepository'

const DESIGN_STORAGE_KEY = 'diebiandesign_design_assets'
const DESIGN_REUSE_KEY = 'diebiandesign_pending_design_reuse'
const TEMPLATE_USAGE_STORAGE_KEY = 'diebiandesign_design_template_usage'
const BRAND_TEMPLATE_STORAGE_KEY = 'diebiandesign_brand_design_templates'

export const DESIGN_TEMPLATE_TYPES = Object.freeze({
  SYSTEM: 'system_template',
  PERSONAL: 'personal_template',
  BRAND: 'brand_template'
})

export const DESIGN_TEMPLATE_CATEGORIES = Object.freeze(['全部', '女装', '男装', '童装', '针织', '牛仔', '运动'])

const OFFICIAL_DESIGN_TEMPLATES = Object.freeze([
  Object.freeze({ templateId: 'template_womens_lifestyle', name: '清新女装种草', coverUrl: '/static/scenes/scene-lifestyle-001.jpg', category: '女装', modelId: 'sys_model_001', colorId: 'womens_mist_blue', patternId: 'pattern_floral', sceneId: 'scene_lifestyle_001', promptSummary: '年轻女模，雾霾蓝花卉女装，日光生活方式种草场景', usageCount: 128, createdAt: '2026-07-19T00:00:00.000Z' }),
  Object.freeze({ templateId: 'template_mens_business', name: '商务男装画册', coverUrl: '/static/scenes/scene-studio-002.jpg', category: '男装', modelId: 'sys_model_006', colorId: 'base_navy', patternId: 'pattern_stripe', sceneId: 'scene_studio_002', promptSummary: '商务男模，藏蓝条纹男装，高级灰影棚画册质感', usageCount: 96, createdAt: '2026-07-19T00:00:00.000Z' }),
  Object.freeze({ templateId: 'template_kids_spring', name: '童装春日上新', coverUrl: '/static/scenes/scene-nature-001.jpg', category: '童装', modelId: 'sys_model_009', colorId: 'kids_peach', patternId: 'pattern_floral', sceneId: 'scene_nature_001', promptSummary: '女童模特，蜜桃粉花卉童装，清新自然上新场景', usageCount: 84, createdAt: '2026-07-19T00:00:00.000Z' }),
  Object.freeze({ templateId: 'template_knit_commute', name: '针织通勤系列', coverUrl: '/static/scenes/scene-lifestyle-002.jpg', category: '针织', modelId: 'sys_model_002', colorId: 'knit_oat', patternId: 'pattern_stripe', sceneId: 'scene_lifestyle_002', promptSummary: '通勤女模，燕麦色简洁针织，松弛居家商业场景', usageCount: 73, createdAt: '2026-07-19T00:00:00.000Z' }),
  Object.freeze({ templateId: 'template_denim_street', name: '牛仔街拍系列', coverUrl: '/static/scenes/scene-street-001.jpg', category: '牛仔', modelId: 'sys_model_010', colorId: 'denim_mid_blue', patternId: 'pattern_geometric', sceneId: 'scene_street_001', promptSummary: '潮流女模，中蓝牛仔几何细节，都市街拍内容视觉', usageCount: 112, createdAt: '2026-07-19T00:00:00.000Z' }),
  Object.freeze({ templateId: 'template_sport_city', name: '城市运动新品', coverUrl: '/static/scenes/scene-sport-002.jpg', category: '运动', modelId: 'sys_model_007', colorId: 'base_pure_black', patternId: 'pattern_logo', sceneId: 'scene_sport_002', promptSummary: '休闲男模，纯黑运动服装与品牌标识，城市跑道新品视觉', usageCount: 105, createdAt: '2026-07-19T00:00:00.000Z' })
])

function nowIso() {
  return new Date().toISOString()
}

function cloneValue(value) {
  try {
    return JSON.parse(JSON.stringify(value))
  } catch (error) {
    return value
  }
}

function normalizeDesign(design = {}) {
  const createdAt = design.createdAt || nowIso()
  return {
    designId: design.designId || `design_${Date.now()}`,
    templateId: design.templateId || '',
    templateType: design.templateType || DESIGN_TEMPLATE_TYPES.PERSONAL,
    brandId: design.brandId || '',
    name: String(design.name || '未命名设计方案').trim() || '未命名设计方案',
    coverUrl: design.coverUrl || '',
    modelId: design.modelId || '',
    colorId: design.colorId || '',
    patternId: design.patternId || '',
    sceneId: design.sceneId || '',
    brandColorId: design.brandColorId || (design.params && design.params.brandColorId) || '',
    brandModelId: design.brandModelId || (design.params && design.params.brandModelId) || '',
    brandSceneId: design.brandSceneId || (design.params && design.params.brandSceneId) || '',
    modelPrompt: design.modelPrompt || '',
    colorPrompt: design.colorPrompt || design.targetColorPrompt || '',
    patternPrompt: design.patternPrompt || '',
    scenePrompt: design.scenePrompt || '',
    optionPromptSummary: design.optionPromptSummary || '',
    params: cloneValue(design.params || {}),
    createdAt,
    updatedAt: design.updatedAt || createdAt
  }
}

function readDesigns() {
  try {
    if (typeof uni === 'undefined' || !uni.getStorageSync) return []
    const value = uni.getStorageSync(DESIGN_STORAGE_KEY)
    return Array.isArray(value) ? value.map(normalizeDesign) : []
  } catch (error) {
    return []
  }
}

function writeDesigns(designs = []) {
  try {
    if (typeof uni !== 'undefined' && uni.setStorageSync) {
      uni.setStorageSync(DESIGN_STORAGE_KEY, designs.map(normalizeDesign))
    }
  } catch (error) {}
  return designs
}

function readTemplateUsage() {
  try {
    if (typeof uni === 'undefined' || !uni.getStorageSync) return {}
    const value = uni.getStorageSync(TEMPLATE_USAGE_STORAGE_KEY)
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
  } catch (error) {
    return {}
  }
}

function writeTemplateUsage(usage = {}) {
  try {
    if (typeof uni !== 'undefined' && uni.setStorageSync) uni.setStorageSync(TEMPLATE_USAGE_STORAGE_KEY, usage)
  } catch (error) {}
  return usage
}

function normalizeTemplate(template = {}, usage = {}) {
  return {
    templateId: template.templateId || '',
    templateType: DESIGN_TEMPLATE_TYPES.SYSTEM,
    brandId: '',
    name: template.name || '官方设计模板',
    coverUrl: template.coverUrl || '',
    category: template.category || '女装',
    modelId: template.modelId || '',
    colorId: template.colorId || '',
    patternId: template.patternId || '',
    sceneId: template.sceneId || '',
    brandColorId: '',
    brandModelId: '',
    brandSceneId: '',
    promptSummary: template.promptSummary || '',
    usageCount: Number(template.usageCount || 0) + Number(usage[template.templateId] || 0),
    createdAt: template.createdAt || nowIso()
  }
}

function normalizeBrandTemplate(template = {}) {
  const createdAt = template.createdAt || nowIso()
  return {
    templateId: template.templateId || `brand_template_${Date.now()}`,
    templateType: DESIGN_TEMPLATE_TYPES.BRAND,
    brandId: template.brandId || '',
    name: String(template.name || '未命名品牌模板').trim() || '未命名品牌模板',
    coverUrl: template.coverUrl || '',
    category: template.category || '女装',
    modelId: template.modelId || template.brandModelId || '',
    colorId: template.colorId || template.brandColorId || '',
    patternId: template.patternId || '',
    sceneId: template.sceneId || template.brandSceneId || '',
    brandColorId: template.brandColorId || template.colorId || '',
    brandModelId: template.brandModelId || template.modelId || '',
    brandSceneId: template.brandSceneId || template.sceneId || '',
    promptSummary: template.promptSummary || '',
    usageCount: Number(template.usageCount) || 0,
    createdAt,
    updatedAt: template.updatedAt || createdAt
  }
}

function readBrandTemplates() {
  try {
    if (typeof uni === 'undefined' || !uni.getStorageSync) return []
    const value = uni.getStorageSync(BRAND_TEMPLATE_STORAGE_KEY)
    return Array.isArray(value) ? value.map(normalizeBrandTemplate) : []
  } catch (error) {
    return []
  }
}

function writeBrandTemplates(templates = []) {
  try {
    if (typeof uni !== 'undefined' && uni.setStorageSync) {
      uni.setStorageSync(BRAND_TEMPLATE_STORAGE_KEY, templates.map(normalizeBrandTemplate))
    }
  } catch (error) {}
  return templates
}

function logBrandTemplate(template = {}) {
  console.log('[design:brand-template]', {
    templateId: template.templateId || '',
    brandId: template.brandId || '',
    name: template.name || ''
  })
}

export function getBrandTemplates(brandId = '') {
  const normalizedBrandId = String(brandId || '').trim()
  return readBrandTemplates()
    .filter((template) => !normalizedBrandId || template.brandId === normalizedBrandId)
    .sort((left, right) => String(right.updatedAt).localeCompare(String(left.updatedAt)))
}

export function getBrandTemplateById(templateId = '') {
  return getBrandTemplates().find((template) => template.templateId === templateId) || null
}

export function createBrandTemplate(template = {}) {
  const brandParams = getBrandGenerationParams(template.brandId)
  const nextTemplate = normalizeBrandTemplate({
    ...brandParams,
    ...template,
    templateId: template.templateId || `brand_template_${Date.now()}`,
    brandColorId: template.brandColorId || template.colorId || brandParams.brandColorId,
    brandModelId: template.brandModelId || template.modelId || brandParams.brandModelId,
    brandSceneId: template.brandSceneId || template.sceneId || brandParams.brandSceneId,
    createdAt: template.createdAt || nowIso(),
    updatedAt: nowIso()
  })
  writeBrandTemplates([nextTemplate, ...getBrandTemplates().filter((item) => item.templateId !== nextTemplate.templateId)])
  logBrandTemplate(nextTemplate)
  return nextTemplate
}

export function updateBrandTemplate(templateId = '', patch = {}) {
  const current = getBrandTemplateById(templateId)
  if (!current) return null
  const nextTemplate = normalizeBrandTemplate({
    ...current,
    ...patch,
    templateId: current.templateId,
    createdAt: current.createdAt,
    updatedAt: nowIso()
  })
  writeBrandTemplates(getBrandTemplates().map((template) => template.templateId === templateId ? nextTemplate : template))
  logBrandTemplate(nextTemplate)
  return nextTemplate
}

export function deleteBrandTemplate(templateId = '') {
  const templates = getBrandTemplates()
  const current = templates.find((template) => template.templateId === templateId)
  if (!current) return false
  writeBrandTemplates(templates.filter((template) => template.templateId !== templateId))
  logBrandTemplate(current)
  return true
}

export function useBrandTemplate(templateId = '') {
  const current = getBrandTemplateById(templateId)
  if (!current) return null
  const nextTemplate = normalizeBrandTemplate({
    ...current,
    usageCount: current.usageCount + 1,
    updatedAt: nowIso()
  })
  writeBrandTemplates(getBrandTemplates().map((template) => template.templateId === templateId ? nextTemplate : template))
  logBrandTemplate(nextTemplate)
  return {
    designId: `brand_${nextTemplate.templateId}`,
    templateId: nextTemplate.templateId,
    templateType: DESIGN_TEMPLATE_TYPES.BRAND,
    brandId: nextTemplate.brandId,
    name: nextTemplate.name,
    coverUrl: nextTemplate.coverUrl,
    modelId: nextTemplate.modelId,
    colorId: nextTemplate.colorId,
    patternId: nextTemplate.patternId,
    sceneId: nextTemplate.sceneId,
    brandColorId: nextTemplate.brandColorId,
    brandModelId: nextTemplate.brandModelId,
    brandSceneId: nextTemplate.brandSceneId,
    modelPrompt: '',
    colorPrompt: '',
    patternPrompt: '',
    scenePrompt: '',
    optionPromptSummary: nextTemplate.promptSummary,
    params: {
      workspaceType: 'model',
      brandId: nextTemplate.brandId,
      modelId: nextTemplate.modelId,
      colorId: nextTemplate.colorId,
      patternId: nextTemplate.patternId,
      sceneId: nextTemplate.sceneId,
      brandColorId: nextTemplate.brandColorId,
      brandModelId: nextTemplate.brandModelId,
      brandSceneId: nextTemplate.brandSceneId,
      optionPromptSummary: nextTemplate.promptSummary
    },
    createdAt: nextTemplate.createdAt,
    updatedAt: nextTemplate.updatedAt,
    usageCount: nextTemplate.usageCount
  }
}

export function getOfficialTemplates(category = '全部') {
  const usage = readTemplateUsage()
  return OFFICIAL_DESIGN_TEMPLATES
    .filter((template) => category === '全部' || template.category === category)
    .map((template) => normalizeTemplate(template, usage))
}

export function getOfficialTemplateById(templateId = '') {
  return getOfficialTemplates().find((template) => template.templateId === templateId) || null
}

export function useOfficialTemplate(templateId = '') {
  const template = getOfficialTemplateById(templateId)
  if (!template) return null
  const usage = readTemplateUsage()
  usage[templateId] = Number(usage[templateId] || 0) + 1
  writeTemplateUsage(usage)
  const usedTemplate = normalizeTemplate(template, { [templateId]: 1 })
  console.log('[design:template]', {
    templateId: template.templateId,
    name: template.name
  })
  return {
    designId: `official_${template.templateId}`,
    templateId: template.templateId,
    templateType: DESIGN_TEMPLATE_TYPES.SYSTEM,
    name: template.name,
    coverUrl: template.coverUrl,
    modelId: template.modelId,
    colorId: template.colorId,
    patternId: template.patternId,
    sceneId: template.sceneId,
    modelPrompt: '',
    colorPrompt: '',
    patternPrompt: '',
    scenePrompt: '',
    optionPromptSummary: template.promptSummary,
    params: {
      workspaceType: 'model',
      modelId: template.modelId,
      colorId: template.colorId,
      patternId: template.patternId,
      sceneId: template.sceneId,
      optionPromptSummary: template.promptSummary
    },
    createdAt: template.createdAt,
    updatedAt: nowIso(),
    usageCount: usedTemplate.usageCount
  }
}

export function getDesigns() {
  return readDesigns().sort((left, right) => String(right.updatedAt).localeCompare(String(left.updatedAt)))
}

export function getDesignById(designId = '') {
  return getDesigns().find((design) => design.designId === designId) || null
}

export function saveDesign(design = {}) {
  const designs = getDesigns()
  const current = designs.find((item) => item.designId === design.designId)
  const nextDesign = normalizeDesign({
    ...(current || {}),
    ...design,
    designId: design.designId || (current && current.designId) || `design_${Date.now()}`,
    createdAt: (current && current.createdAt) || design.createdAt || nowIso(),
    updatedAt: nowIso()
  })
  writeDesigns([nextDesign, ...designs.filter((item) => item.designId !== nextDesign.designId)])
  console.log('[design:save]', {
    designId: nextDesign.designId,
    name: nextDesign.name
  })
  return nextDesign
}

export function deleteDesign(designId = '') {
  const designs = getDesigns()
  if (!designs.some((design) => design.designId === designId)) return false
  writeDesigns(designs.filter((design) => design.designId !== designId))
  return true
}

export function copyDesign(designId = '') {
  const source = getDesignById(designId)
  if (!source) return null
  return saveDesign({
    ...source,
    designId: `design_${Date.now()}`,
    name: `${source.name} 副本`,
    createdAt: nowIso(),
    updatedAt: nowIso()
  })
}

export function queueDesignReuse(design = {}) {
  const normalized = normalizeDesign(design)
  try {
    if (typeof uni !== 'undefined' && uni.setStorageSync) {
      uni.setStorageSync(DESIGN_REUSE_KEY, normalized)
    }
  } catch (error) {}
  return normalized
}

export function consumeDesignReuse() {
  try {
    if (typeof uni === 'undefined' || !uni.getStorageSync) return null
    const value = uni.getStorageSync(DESIGN_REUSE_KEY)
    if (uni.removeStorageSync) uni.removeStorageSync(DESIGN_REUSE_KEY)
    return value && value.designId ? normalizeDesign(value) : null
  } catch (error) {
    return null
  }
}
