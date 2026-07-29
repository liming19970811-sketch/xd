const STORAGE_KEY = 'diebiandesign_accessory_library_v1'

export const MAX_ACCESSORY_LIBRARY_ITEMS = 30

export const ACCESSORY_TYPES = Object.freeze([
  Object.freeze({ value: 'shoes', label: '鞋子' }),
  Object.freeze({ value: 'bag', label: '包包' }),
  Object.freeze({ value: 'hat', label: '帽子' }),
  Object.freeze({ value: 'belt', label: '腰带' }),
  Object.freeze({ value: 'scarf', label: '围巾' }),
  Object.freeze({ value: 'jewelry', label: '首饰' })
])

const ACCESSORY_TYPE_SET = new Set(ACCESSORY_TYPES.map((item) => item.value))

function nowIso() {
  return new Date().toISOString()
}

function readStorage() {
  try {
    if (typeof uni === 'undefined' || typeof uni.getStorageSync !== 'function') return []
    const value = uni.getStorageSync(STORAGE_KEY)
    return Array.isArray(value) ? value : []
  } catch (error) {
    return []
  }
}

function writeStorage(items = []) {
  if (typeof uni === 'undefined' || typeof uni.setStorageSync !== 'function') return false
  uni.setStorageSync(STORAGE_KEY, items.slice(0, MAX_ACCESSORY_LIBRARY_ITEMS))
  return true
}

function stableImageUrl(value = '') {
  const url = String(value || '').trim()
  return /^(cloud:\/\/|https:\/\/)/i.test(url) ? url : ''
}

function normalizeItem(item = {}, index = 0) {
  const type = ACCESSORY_TYPE_SET.has(String(item.type || '').trim()) ? String(item.type).trim() : 'shoes'
  const imageUrl = stableImageUrl(item.imageUrl || item.fileId || item.fileID || item.fileUrl || item.url)
  const typeMeta = ACCESSORY_TYPES.find((entry) => entry.value === type)
  const timestamp = nowIso()
  return {
    accessoryId: String(item.accessoryId || `accessory_${Date.now()}_${index}`).trim(),
    type,
    name: String(item.name || (typeMeta && typeMeta.label) || '配饰').trim(),
    imageUrl,
    createdAt: item.createdAt || timestamp,
    updatedAt: item.updatedAt || item.createdAt || timestamp,
    lastUsedAt: item.lastUsedAt || '',
    useCount: Math.max(0, Number(item.useCount || 0))
  }
}

function sortItems(items = []) {
  return [...items].sort((left, right) => {
    const leftTime = Date.parse(left.lastUsedAt || left.updatedAt || left.createdAt || 0) || 0
    const rightTime = Date.parse(right.lastUsedAt || right.updatedAt || right.createdAt || 0) || 0
    return rightTime - leftTime
  })
}

export function getAccessories(type = '') {
  const normalizedType = String(type || '').trim()
  const items = readStorage().map(normalizeItem).filter((item) => item.imageUrl)
  return sortItems(normalizedType ? items.filter((item) => item.type === normalizedType) : items)
}

export function saveAccessory(item = {}) {
  const nextItem = normalizeItem({
    ...item,
    accessoryId: item.accessoryId || `accessory_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    updatedAt: nowIso()
  })
  if (!nextItem.imageUrl) {
    const error = new Error('配饰图片尚未上传完成')
    error.code = 'ACCESSORY_REMOTE_IMAGE_REQUIRED'
    throw error
  }

  const items = getAccessories()
  const duplicate = items.find((entry) => entry.type === nextItem.type && entry.imageUrl === nextItem.imageUrl)
  if (duplicate) return { ...duplicate, duplicate: true }
  if (items.length >= MAX_ACCESSORY_LIBRARY_ITEMS) {
    const error = new Error('配饰库已满，请先删除不再使用的配饰')
    error.code = 'ACCESSORY_LIBRARY_LIMIT_REACHED'
    throw error
  }
  writeStorage([nextItem, ...items])
  return nextItem
}

export function removeAccessory(accessoryId = '') {
  const id = String(accessoryId || '').trim()
  if (!id) return false
  const items = getAccessories()
  const nextItems = items.filter((item) => item.accessoryId !== id)
  if (nextItems.length === items.length) return false
  writeStorage(nextItems)
  return true
}

export function markAccessoryUsed(accessoryId = '') {
  const id = String(accessoryId || '').trim()
  if (!id) return null
  const timestamp = nowIso()
  let updated = null
  const items = getAccessories().map((item) => {
    if (item.accessoryId !== id) return item
    updated = normalizeItem({
      ...item,
      updatedAt: timestamp,
      lastUsedAt: timestamp,
      useCount: Number(item.useCount || 0) + 1
    })
    return updated
  })
  if (updated) writeStorage(items)
  return updated
}
