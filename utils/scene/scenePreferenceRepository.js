const STORAGE_KEY = 'diebiandesign_scene_preferences_v1'
const LEGACY_STORAGE_KEY = 'diebiandesign_custom_scenes'
const LAST_SELECTED_KEY = 'diebiandesign_scene_last_selected_v1'

export const MAX_MY_SCENES = 20

function nowIso() {
  return new Date().toISOString()
}

function getStorageValue(key, fallback) {
  try {
    if (typeof uni === 'undefined' || typeof uni.getStorageSync !== 'function') return fallback
    const value = uni.getStorageSync(key)
    return value === undefined || value === null || value === '' ? fallback : value
  } catch (error) {
    return fallback
  }
}

function setStorageValue(key, value) {
  try {
    if (typeof uni === 'undefined' || typeof uni.setStorageSync !== 'function') return false
    uni.setStorageSync(key, value)
    return true
  } catch (error) {
    return false
  }
}

function createError(code, message) {
  const error = new Error(message)
  error.code = code
  return error
}

function normalizeRemoteIdentity(value = '') {
  const source = String(value || '').trim()
  if (!source) return ''
  return /^https:\/\//i.test(source) ? source.split('?')[0].split('#')[0] : source
}

function createFingerprint(scene = {}) {
  const source = normalizeRemoteIdentity(
    scene.cloudFileId || scene.fileID || scene.fileId || scene.previewUrl || scene.coverUrl || ''
  )
  let hash = 0
  for (let index = 0; index < source.length; index += 1) {
    hash = ((hash << 5) - hash + source.charCodeAt(index)) | 0
  }
  return source ? `scene_${Math.abs(hash)}` : ''
}

function normalizeScene(scene = {}, index = 0) {
  const timestamp = nowIso()
  const cloudFileId = String(scene.cloudFileId || scene.fileID || scene.fileId || '').trim()
  const previewUrl = String(scene.previewUrl || scene.coverUrl || scene.fileUrl || cloudFileId || '').trim()
  const localPath = String(scene.localPath || '').trim()
  const fingerprint = String(scene.fingerprint || createFingerprint({ cloudFileId, previewUrl })).trim()
  return {
    sceneId: String(scene.sceneId || `my_scene_${Date.now()}_${index}`).trim(),
    name: String(scene.name || `我的场景 ${index + 1}`).trim(),
    localPath,
    cloudFileId,
    previewUrl,
    fingerprint,
    prompt: String(scene.prompt || '').trim(),
    createdAt: scene.createdAt || timestamp,
    updatedAt: scene.updatedAt || scene.createdAt || timestamp,
    lastUsedAt: scene.lastUsedAt || '',
    useCount: Math.max(0, Number(scene.useCount || 0)),
    isDurable: Boolean(/^cloud:\/\//i.test(cloudFileId) || /^https:\/\//i.test(previewUrl))
  }
}

function sortScenes(scenes = []) {
  return [...scenes].sort((left, right) => {
    const leftTime = Date.parse(left.lastUsedAt || left.createdAt || 0) || 0
    const rightTime = Date.parse(right.lastUsedAt || right.createdAt || 0) || 0
    return rightTime - leftTime
  })
}

function readScenes() {
  const current = getStorageValue(STORAGE_KEY, null)
  if (Array.isArray(current)) return current.map(normalizeScene)

  const legacy = getStorageValue(LEGACY_STORAGE_KEY, [])
  const migrated = Array.isArray(legacy)
    ? legacy.map((scene, index) => normalizeScene({
      ...scene,
      previewUrl: scene.previewUrl || scene.coverUrl || '',
      localPath: scene.localPath || scene.coverUrl || ''
    }, index))
    : []
  if (migrated.length) setStorageValue(STORAGE_KEY, migrated)
  return migrated
}

function writeScenes(scenes = []) {
  const normalized = scenes.slice(0, MAX_MY_SCENES).map(normalizeScene)
  if (!setStorageValue(STORAGE_KEY, normalized)) {
    throw createError('SCENE_STORAGE_FAILED', '场景保存失败')
  }
  return normalized
}

export function getMyScenes() {
  return sortScenes(readScenes())
}

export function addScene(scene = {}) {
  const scenes = getMyScenes()
  const nextScene = normalizeScene({
    ...scene,
    sceneId: scene.sceneId || `my_scene_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    createdAt: scene.createdAt || nowIso(),
    updatedAt: nowIso()
  }, scenes.length)

  if (!nextScene.isDurable) {
    throw createError('SCENE_REMOTE_REQUIRED', '场景图片尚未上传完成')
  }

  const duplicate = scenes.find((item) => (
    (nextScene.cloudFileId && item.cloudFileId === nextScene.cloudFileId)
    || (nextScene.fingerprint && item.fingerprint === nextScene.fingerprint)
  ))
  if (duplicate) return { ...duplicate, duplicate: true }

  if (scenes.length >= MAX_MY_SCENES) {
    throw createError('SCENE_LIMIT_REACHED', '场景数量已达上限')
  }

  writeScenes([nextScene, ...scenes])
  return nextScene
}

export function removeScene(sceneId = '') {
  const normalizedId = String(sceneId || '').trim()
  if (!normalizedId) return false
  const scenes = getMyScenes()
  const nextScenes = scenes.filter((item) => item.sceneId !== normalizedId)
  if (nextScenes.length === scenes.length) return false
  writeScenes(nextScenes)
  if (getStorageValue(LAST_SELECTED_KEY, '') === normalizedId) setStorageValue(LAST_SELECTED_KEY, '')
  return true
}

export function updateSceneName(sceneId = '', name = '') {
  const normalizedId = String(sceneId || '').trim()
  const normalizedName = String(name || '').trim()
  if (!normalizedId || !normalizedName) return null
  const scenes = getMyScenes()
  let updated = null
  const nextScenes = scenes.map((item) => {
    if (item.sceneId !== normalizedId) return item
    updated = normalizeScene({ ...item, name: normalizedName, updatedAt: nowIso() })
    return updated
  })
  if (!updated) return null
  writeScenes(nextScenes)
  return updated
}

export function setLastSelectedScene(sceneId = '') {
  const normalizedId = String(sceneId || '').trim()
  setStorageValue(LAST_SELECTED_KEY, normalizedId)
  return normalizedId
}

export function getLastSelectedScene() {
  const sceneId = String(getStorageValue(LAST_SELECTED_KEY, '') || '').trim()
  return getMyScenes().find((item) => item.sceneId === sceneId) || null
}

export function markSceneUsed(sceneId = '') {
  const normalizedId = String(sceneId || '').trim()
  if (!normalizedId) return null
  const timestamp = nowIso()
  let updated = null
  const nextScenes = getMyScenes().map((item) => {
    if (item.sceneId !== normalizedId) return item
    updated = normalizeScene({
      ...item,
      lastUsedAt: timestamp,
      updatedAt: timestamp,
      useCount: Number(item.useCount || 0) + 1
    })
    return updated
  })
  if (!updated) return null
  writeScenes(nextScenes)
  setLastSelectedScene(normalizedId)
  return updated
}

