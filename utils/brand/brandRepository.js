import { getColorById } from '../color/colorLibrary'
import { getBrandColors, getMyColors } from '../color/colorPicker'
import { getModelById } from '../model/modelLibrary'
import { getSceneById } from '../scene/sceneLibrary'
import { getBrandMembers } from './brandMemberRepository'

const BRAND_STORAGE_KEY = 'diebiandesign_brand_profiles'

function nowIso() {
  return new Date().toISOString()
}

function normalizeIds(value) {
  return Array.isArray(value) ? [...new Set(value.map((item) => String(item || '').trim()).filter(Boolean))] : []
}

function normalizeBrand(brand = {}) {
  const createdAt = brand.createdAt || nowIso()
  return {
    brandId: brand.brandId || `brand_${Date.now()}`,
    brandName: String(brand.brandName || '未命名品牌').trim() || '未命名品牌',
    logoUrl: brand.logoUrl || '',
    colorIds: normalizeIds(brand.colorIds),
    modelIds: normalizeIds(brand.modelIds),
    sceneIds: normalizeIds(brand.sceneIds),
    templateIds: normalizeIds(brand.templateIds),
    projectIds: normalizeIds(brand.projectIds),
    apiAppIds: normalizeIds(brand.apiAppIds),
    createdAt,
    updatedAt: brand.updatedAt || createdAt
  }
}

function readBrands() {
  try {
    if (typeof uni === 'undefined' || !uni.getStorageSync) return []
    const value = uni.getStorageSync(BRAND_STORAGE_KEY)
    return Array.isArray(value) ? value.map(normalizeBrand) : []
  } catch (error) {
    return []
  }
}

function writeBrands(brands = []) {
  try {
    if (typeof uni !== 'undefined' && uni.setStorageSync) {
      uni.setStorageSync(BRAND_STORAGE_KEY, brands.map(normalizeBrand))
    }
  } catch (error) {}
  return brands
}

function logBrandProfile(brand = {}) {
  console.log('[brand:profile]', {
    brandId: brand.brandId || '',
    brandName: brand.brandName || ''
  })
}

function logBrandWorkspace(brand = {}) {
  console.log('[brand:workspace]', {
    brandId: brand.brandId || '',
    brandName: brand.brandName || ''
  })
}

function getColorAssetById(colorId = '') {
  return getColorById(colorId) ||
    [...getBrandColors(), ...getMyColors()].find((color) => color.colorId === colorId) ||
    null
}

export function getBrands() {
  return readBrands().sort((left, right) => String(right.updatedAt).localeCompare(String(left.updatedAt)))
}

export function getBrandById(brandId = '') {
  return getBrands().find((brand) => brand.brandId === brandId) || null
}

export function createBrand(brand = {}) {
  const nextBrand = normalizeBrand({
    ...brand,
    brandId: brand.brandId || `brand_${Date.now()}`,
    createdAt: brand.createdAt || nowIso(),
    updatedAt: nowIso()
  })
  writeBrands([nextBrand, ...getBrands().filter((item) => item.brandId !== nextBrand.brandId)])
  logBrandProfile(nextBrand)
  logBrandWorkspace(nextBrand)
  return nextBrand
}

export function updateBrand(brandId = '', patch = {}) {
  const current = getBrandById(brandId)
  if (!current) return null
  const nextBrand = normalizeBrand({
    ...current,
    ...patch,
    brandId: current.brandId,
    createdAt: current.createdAt,
    updatedAt: nowIso()
  })
  writeBrands(getBrands().map((brand) => brand.brandId === brandId ? nextBrand : brand))
  logBrandProfile(nextBrand)
  logBrandWorkspace(nextBrand)
  return nextBrand
}

export function deleteBrand(brandId = '') {
  const brands = getBrands()
  const current = brands.find((brand) => brand.brandId === brandId)
  if (!current) return false
  writeBrands(brands.filter((brand) => brand.brandId !== brandId))
  logBrandProfile(current)
  return true
}

export function getBrandAssetRelations(brandId = '') {
  const brand = getBrandById(brandId)
  if (!brand) return null
  return {
    brand,
    colors: brand.colorIds.map(getColorAssetById).filter(Boolean),
    models: brand.modelIds.map(getModelById).filter(Boolean),
    scenes: brand.sceneIds.map(getSceneById).filter(Boolean),
    templateIds: [...brand.templateIds],
    projectIds: [...brand.projectIds],
    apiAppIds: [...brand.apiAppIds]
  }
}

export function getBrandWorkspace(brandId = '') {
  const brand = getBrandById(brandId)
  if (!brand) return null
  logBrandWorkspace(brand)
  return {
    ...brand,
    assetCount: brand.colorIds.length + brand.modelIds.length + brand.sceneIds.length,
    templateCount: brand.templateIds.length,
    projectCount: brand.projectIds.length,
    apiAppCount: brand.apiAppIds.length,
    memberCount: getBrandMembers(brand.brandId).length
  }
}

export function updateBrandWorkspaceRelations(brandId = '', relations = {}) {
  const current = getBrandById(brandId)
  if (!current) return null
  return updateBrand(brandId, {
    templateIds: relations.templateIds === undefined ? current.templateIds : normalizeIds(relations.templateIds),
    projectIds: relations.projectIds === undefined ? current.projectIds : normalizeIds(relations.projectIds),
    apiAppIds: relations.apiAppIds === undefined ? current.apiAppIds : normalizeIds(relations.apiAppIds)
  })
}

export function getBrandGenerationParams(brandId = '') {
  const relations = getBrandAssetRelations(brandId)
  if (!relations) return {}
  const color = relations.colors[0] || null
  const model = relations.models[0] || null
  const scene = relations.scenes[0] || null
  return {
    brandId: relations.brand.brandId,
    brandColorId: color ? color.colorId : '',
    brandModelId: model ? model.modelId : '',
    brandSceneId: scene ? scene.sceneId : '',
    colorId: color ? color.colorId : '',
    modelId: model ? model.modelId : '',
    sceneId: scene ? scene.sceneId : ''
  }
}

export function getBrandTemplateContext(brandId = '') {
  const relations = getBrandAssetRelations(brandId)
  if (!relations) return null
  return {
    brand: relations.brand,
    relations,
    params: getBrandGenerationParams(brandId)
  }
}
