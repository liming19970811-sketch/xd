import { COLOR_GROUPS } from './colorLibrary'

const HISTORY_KEY_PREFIX = 'diebiandesign_color_history_v2'
const MY_COLORS_KEY = 'diebiandesign_my_colors'
const BRAND_COLORS_KEY = 'diebiandesign_brand_colors'
const MAX_HISTORY = 30
const MAX_MY_COLORS = 24
const MAX_BRAND_COLORS = 48

export const CUSTOM_COLOR_VALUE = 'custom'
export { COLOR_GROUPS } from './colorLibrary'

export function flattenColorGroups(groups = COLOR_GROUPS) {
  return groups.reduce((items, group) => items.concat((group.colors || []).map((color) => ({
    ...color,
    value: color.value || color.colorId
  }))), [])
}

export function normalizeHexColor(value = '') {
  const text = String(value || '').trim()
  if (/^#[0-9A-Fa-f]{6}$/.test(text)) {
    return text.toUpperCase()
  }
  if (/^[0-9A-Fa-f]{6}$/.test(text)) {
    return `#${text.toUpperCase()}`
  }
  return ''
}

export function hexToRgb(hex = '') {
  const normalized = normalizeHexColor(hex)
  if (!normalized) {
    return null
  }
  const value = normalized.slice(1)
  return {
    r: parseInt(value.slice(0, 2), 16),
    g: parseInt(value.slice(2, 4), 16),
    b: parseInt(value.slice(4, 6), 16)
  }
}

export function hexToRgbString(hex = '') {
  const rgb = hexToRgb(hex)
  return rgb ? `${rgb.r},${rgb.g},${rgb.b}` : ''
}

export function rgbToHex(r, g, b) {
  const toHex = (value) => Math.max(0, Math.min(255, Number(value) || 0)).toString(16).padStart(2, '0')
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase()
}

export function normalizeRgb(value) {
  if (Array.isArray(value) && value.length === 3) {
    return value.map((item) => Math.max(0, Math.min(255, Math.round(Number(item) || 0))))
  }
  if (value && typeof value === 'object') {
    return normalizeRgb([value.r, value.g, value.b])
  }
  const parsed = parseRgbString(value)
  return parsed ? [parsed.r, parsed.g, parsed.b] : null
}

export function rgbToLab(value) {
  const rgb = normalizeRgb(value)
  if (!rgb) return null
  const linear = rgb.map((item) => {
    const channel = item / 255
    return channel > 0.04045 ? Math.pow((channel + 0.055) / 1.055, 2.4) : channel / 12.92
  })
  const x = (linear[0] * 0.4124 + linear[1] * 0.3576 + linear[2] * 0.1805) / 0.95047
  const y = (linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722)
  const z = (linear[0] * 0.0193 + linear[1] * 0.1192 + linear[2] * 0.9505) / 1.08883
  const pivot = (item) => item > 0.008856 ? Math.cbrt(item) : (7.787 * item) + (16 / 116)
  const fx = pivot(x)
  const fy = pivot(y)
  const fz = pivot(z)
  return [
    Number(((116 * fy) - 16).toFixed(2)),
    Number((500 * (fx - fy)).toFixed(2)),
    Number((200 * (fy - fz)).toFixed(2))
  ]
}

const COLOR_NAME_DICTIONARY = Object.freeze([
  ['经典黑', '#111111'], ['纯白', '#FFFFFF'], ['奶油白', '#F5F1E8'], ['炭灰', '#41454B'],
  ['中灰', '#8E939B'], ['藏青', '#17243E'], ['雾蓝', '#91AEC3'], ['天空蓝', '#60A5FA'],
  ['深酒红', '#7A263A'], ['豆沙粉', '#C7838E'], ['珊瑚橙', '#E98968'], ['焦糖棕', '#A56A43'],
  ['咖啡棕', '#6B4636'], ['卡其', '#B59A72'], ['奶油黄', '#F1D98B'], ['薄荷绿', '#A8D8C0'],
  ['墨绿色', '#2F5C4A'], ['青绿色', '#059669'], ['香芋紫', '#B7A3D7'], ['靛蓝', '#4F46E5']
].map(([displayName, hex]) => Object.freeze({ displayName, hex, lab: rgbToLab(hexToRgb(hex)) })))

export function colorLabDistance(left = [], right = []) {
  if (!Array.isArray(left) || !Array.isArray(right) || left.length !== 3 || right.length !== 3) return Number.POSITIVE_INFINITY
  return Math.sqrt(left.reduce((sum, value, index) => sum + Math.pow(Number(value) - Number(right[index]), 2), 0))
}

export function matchColorDisplayName(color = {}, threshold = 18) {
  const lab = Array.isArray(color.lab) && color.lab.length === 3
    ? color.lab.map(Number)
    : rgbToLab(normalizeRgb(color.rgb) || hexToRgb(color.hex))
  if (!lab) return '自定义颜色'
  const match = COLOR_NAME_DICTIONARY
    .map((item) => ({ ...item, distance: colorLabDistance(lab, item.lab) }))
    .sort((left, right) => left.distance - right.distance)[0]
  return match && match.distance <= Math.max(1, Number(threshold) || 18) ? match.displayName : '自定义颜色'
}

export function normalizeStandardColor(color = {}, sourceType = '') {
  const rgb = normalizeRgb(color.rgb) || normalizeRgb(hexToRgb(color.hex))
  if (!rgb) return null
  const hex = rgbToHex(rgb[0], rgb[1], rgb[2])
  const lab = Array.isArray(color.lab) && color.lab.length === 3 ? color.lab.map(Number) : rgbToLab(rgb)
  return {
    colorId: color.colorId || `color_${hex.slice(1).toLowerCase()}`,
    name: color.name || '自定义颜色',
    displayName: color.displayName || matchColorDisplayName({ rgb, lab }),
    hex,
    rgb,
    lab,
    sourceType: sourceType || color.sourceType || color.source || color.colorSource || 'system_palette',
    sourceImageFileId: String(color.sourceImageFileId || color.colorReferenceImageFileId || ''),
    colorType: color.colorType || 'personal',
    fabricTags: Array.isArray(color.fabricTags) ? [...color.fabricTags] : [],
    prompt: color.prompt || ''
  }
}

export function extractDominantColors(data = [], options = {}) {
  if (!data || data.length < 4) return []
  const limit = Math.max(3, Math.min(8, Number(options.limit) || 6))
  const step = Math.max(1, Number(options.pixelStep) || 3)
  const buckets = new Map()
  for (let index = 0; index + 3 < data.length; index += 4 * step) {
    const alpha = Number(data[index + 3])
    if (alpha < 180) continue
    const rgb = [Number(data[index]), Number(data[index + 1]), Number(data[index + 2])]
    const maxChannel = Math.max(...rgb)
    const minChannel = Math.min(...rgb)
    if (maxChannel >= 247 && minChannel >= 242) continue
    if (maxChannel <= 24) continue
    const quantized = rgb.map((item) => Math.min(255, Math.round(item / 32) * 32))
    const key = quantized.join(',')
    const bucket = buckets.get(key) || { count: 0, sum: [0, 0, 0] }
    bucket.count += 1
    bucket.sum = bucket.sum.map((value, channel) => value + rgb[channel])
    buckets.set(key, bucket)
  }
  const candidates = [...buckets.values()]
    .sort((left, right) => right.count - left.count)
    .map((bucket) => ({
      count: bucket.count,
      rgb: bucket.sum.map((value) => Math.round(value / bucket.count))
    }))
  const merged = []
  candidates.forEach((candidate) => {
    const close = merged.find((item) => Math.sqrt(item.rgb.reduce((sum, value, channel) => sum + Math.pow(value - candidate.rgb[channel], 2), 0)) < 34)
    if (!close) merged.push(candidate)
  })
  return merged
    .slice(0, limit)
    .map((bucket, index) => {
      const rgb = bucket.rgb
      return normalizeStandardColor({
        colorId: `palette_${index}_${rgbToHex(...rgb).slice(1).toLowerCase()}`,
        name: `色卡主色 ${index + 1}`,
        rgb
      }, 'dominant_color')
    })
    .filter(Boolean)
}

export function parseRgbString(value = '') {
  const parts = String(value || '').split(',').map((item) => Number(item.trim()))
  if (parts.length !== 3 || parts.some((item) => Number.isNaN(item) || item < 0 || item > 255)) {
    return null
  }
  return { r: parts[0], g: parts[1], b: parts[2] }
}

export function hslToHex(hue = 0, saturation = 68, lightness = 58) {
  const h = ((Number(hue) || 0) % 360) / 360
  const s = Math.max(0, Math.min(100, Number(saturation) || 0)) / 100
  const l = Math.max(0, Math.min(100, Number(lightness) || 0)) / 100
  const hueToRgb = (p, q, t) => {
    let next = t
    if (next < 0) next += 1
    if (next > 1) next -= 1
    if (next < 1 / 6) return p + (q - p) * 6 * next
    if (next < 1 / 2) return q
    if (next < 2 / 3) return p + (q - p) * (2 / 3 - next) * 6
    return p
  }
  let r
  let g
  let b
  if (s === 0) {
    r = l
    g = l
    b = l
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s
    const p = 2 * l - q
    r = hueToRgb(p, q, h + 1 / 3)
    g = hueToRgb(p, q, h)
    b = hueToRgb(p, q, h - 1 / 3)
  }
  return rgbToHex(Math.round(r * 255), Math.round(g * 255), Math.round(b * 255))
}

export function hsvToRgb(hue = 0, saturation = 100, value = 100) {
  const h = ((Number(hue) || 0) % 360 + 360) % 360
  const s = Math.max(0, Math.min(100, Number(saturation) || 0)) / 100
  const v = Math.max(0, Math.min(100, Number(value) || 0)) / 100
  const chroma = v * s
  const section = h / 60
  const x = chroma * (1 - Math.abs((section % 2) - 1))
  let channels = [0, 0, 0]
  if (section < 1) channels = [chroma, x, 0]
  else if (section < 2) channels = [x, chroma, 0]
  else if (section < 3) channels = [0, chroma, x]
  else if (section < 4) channels = [0, x, chroma]
  else if (section < 5) channels = [x, 0, chroma]
  else channels = [chroma, 0, x]
  const match = v - chroma
  return channels.map((channel) => Math.round((channel + match) * 255))
}

export function rgbToHsv(value) {
  const rgb = normalizeRgb(value)
  if (!rgb) return { h: 0, s: 0, v: 0 }
  const [red, green, blue] = rgb.map((channel) => channel / 255)
  const max = Math.max(red, green, blue)
  const min = Math.min(red, green, blue)
  const delta = max - min
  let hue = 0
  if (delta) {
    if (max === red) hue = 60 * (((green - blue) / delta) % 6)
    else if (max === green) hue = 60 * (((blue - red) / delta) + 2)
    else hue = 60 * (((red - green) / delta) + 4)
  }
  if (hue < 0) hue += 360
  return {
    h: Math.round(hue),
    s: Math.round((max ? delta / max : 0) * 100),
    v: Math.round(max * 100)
  }
}

export function buildTargetColorPrompt(color = {}, options = {}) {
  const replaceAreaLabel = options.replaceAreaLabel || '整件服装'
  const fabricText = Array.isArray(color.fabricTags) && color.fabricTags.length
    ? `，适配${color.fabricTags.join('、')}`
    : ''
  return `将${replaceAreaLabel}颜色替换为${color.name || '目标颜色'}${fabricText}，保留原面料纹理、光泽、编织结构和褶皱`
}

export function buildColorPayload(color = {}, source = 'preset', options = {}) {
  const normalized = normalizeStandardColor(color, source)
  const hex = normalized ? normalized.hex : ''
  const rgb = normalized ? normalized.rgb : []
  const name = color.name || (source === 'eyedropper' ? '吸管取色' : '自定义颜色')
  const fabricTags = Array.isArray(color.fabricTags) ? [...color.fabricTags] : []
  const sourceTypeMap = {
    preset: 'system',
    system: 'system',
    brand: 'brand',
    personal: 'personal',
    custom: 'personal',
    eyedropper: 'personal',
    recent: color.colorType || 'personal',
    frequent: color.colorType || 'personal',
    my: 'personal'
  }
  const colorType = ['system', 'personal', 'brand'].includes(color.colorType)
    ? color.colorType
    : (sourceTypeMap[source] || 'personal')
  const colorId = color.colorId || color.value || `custom_${hex.replace('#', '').toLowerCase()}`
  const usageText = colorType === 'brand' && color.usage ? `，用于${color.usage}` : ''
  return {
    colorId,
    targetColorName: name,
    targetColorHex: hex,
    targetColorRgb: rgb,
    targetColorLab: normalized ? normalized.lab : [],
    targetColorPrompt: `${buildTargetColorPrompt({ ...color, name, fabricTags }, options)}${usageText}`,
    fabricTags,
    colorSource: normalized ? normalized.sourceType : source,
    colorType,
    brandColorId: colorType === 'brand' ? colorId : '',
    brandName: color.brandName || '',
    usage: color.usage || ''
  }
}

export function averageImageColor(data = []) {
  if (!data || data.length < 4) return null
  let red = 0
  let green = 0
  let blue = 0
  let weight = 0
  for (let index = 0; index + 3 < data.length; index += 4) {
    const alpha = Number(data[index + 3]) / 255
    if (alpha <= 0) continue
    red += Number(data[index]) * alpha
    green += Number(data[index + 1]) * alpha
    blue += Number(data[index + 2]) * alpha
    weight += alpha
  }
  if (!weight) return null
  const rgb = {
    r: Math.round(red / weight),
    g: Math.round(green / weight),
    b: Math.round(blue / weight)
  }
  return {
    ...rgb,
    hex: rgbToHex(rgb.r, rgb.g, rgb.b),
    rgb: `${rgb.r},${rgb.g},${rgb.b}`
  }
}

function readColorList(storageKey) {
  try {
    if (typeof uni === 'undefined' || !uni.getStorageSync) return []
    const value = uni.getStorageSync(storageKey)
    return Array.isArray(value) ? value : []
  } catch (error) {
    return []
  }
}

function writeColorList(storageKey, colors) {
  try {
    if (typeof uni !== 'undefined' && uni.setStorageSync) uni.setStorageSync(storageKey, colors)
  } catch (error) {}
  return colors
}

function hashScope(value = '') {
  let hash = 2166136261
  const text = String(value || 'anonymous')
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(36)
}

function getColorHistoryStorageKey() {
  const user = readColorListValue('diebiandesign_current_user') || {}
  const auth = readColorListValue('diebiandesign_auth_context_v1') || {}
  const ownerId = user.userId || user.openId || (auth.currentUser || {}).userId || 'anonymous'
  const enterpriseId = (auth.currentEnterprise || {}).enterpriseId || user.enterpriseId || 'personal'
  return `${HISTORY_KEY_PREFIX}_${hashScope(`${ownerId}:${enterpriseId}`)}`
}

function readColorListValue(storageKey) {
  try {
    if (typeof uni === 'undefined' || !uni.getStorageSync) return null
    return uni.getStorageSync(storageKey) || null
  } catch (error) {
    return null
  }
}

function normalizeSavedColor(color = {}, fallbackName = '自定义颜色', fallbackType = 'personal') {
  const hex = normalizeHexColor(color.hex)
  if (!hex) return null
  const colorType = ['system', 'personal', 'brand'].includes(color.colorType) ? color.colorType : fallbackType
  const name = color.name || fallbackName
  const fabricTags = Array.isArray(color.fabricTags) ? [...color.fabricTags] : []
  return {
    colorId: color.colorId || `${colorType}_${hex.replace('#', '').toLowerCase()}`,
    name,
    displayName: color.displayName || matchColorDisplayName({ hex }),
    hex,
    rgb: color.rgb || hexToRgbString(hex),
    category: color.category || (colorType === 'brand' ? '品牌颜色' : '我的颜色'),
    fabricTags,
    prompt: color.prompt || buildTargetColorPrompt({ name, fabricTags }),
    colorType,
    brandName: color.brandName || '',
    usage: color.usage || '',
    createdAt: color.createdAt || new Date().toISOString(),
    usedAt: color.usedAt || color.createdAt || new Date().toISOString(),
    sourceType: color.sourceType || color.source || 'recent_color',
    sourceImageFileId: String(color.sourceImageFileId || ''),
    usedCount: Number(color.usedCount) || 0
  }
}

export function getColorHistory() {
  return readColorList(getColorHistoryStorageKey())
    .map((color) => normalizeSavedColor(color, color.name || '自定义颜色', color.colorType || 'personal'))
    .filter(Boolean)
}

export function saveColorHistory(color = {}) {
  const hex = normalizeHexColor(color.hex)
  if (!hex) {
    return getColorHistory()
  }
  const rgb = color.rgb || hexToRgbString(hex)
  const name = color.name || '自定义颜色'
  const history = getColorHistory()
  const existed = history.find((item) => item.hex === hex)
  const nextItem = {
    colorId: color.colorId || (existed && existed.colorId) || `recent_${hex.replace('#', '').toLowerCase()}`,
    name,
    displayName: color.displayName || matchColorDisplayName({ hex, rgb }),
    hex,
    rgb,
    category: color.category || '',
    fabricTags: Array.isArray(color.fabricTags) ? [...color.fabricTags] : [],
    prompt: color.prompt || '',
    colorType: color.colorType || 'personal',
    brandName: color.brandName || '',
    usage: color.usage || '',
    sourceType: color.sourceType || color.source || 'recent_color',
    sourceImageFileId: String(color.sourceImageFileId || ''),
    createdAt: new Date().toISOString(),
    usedAt: new Date().toISOString(),
    usedCount: existed ? (Number(existed.usedCount) || 0) + 1 : 1
  }
  const nextHistory = [nextItem, ...history.filter((item) => item.hex !== hex)].slice(0, MAX_HISTORY)
  return writeColorList(getColorHistoryStorageKey(), nextHistory)
}

export function removeColorHistory(hex = '') {
  const normalizedHex = normalizeHexColor(hex)
  const nextHistory = getColorHistory().filter((item) => item.hex !== normalizedHex)
  return writeColorList(getColorHistoryStorageKey(), nextHistory)
}

export function clearColorHistory() {
  return writeColorList(getColorHistoryStorageKey(), [])
}

export function replaceColorHistory(colors = []) {
  const normalized = (Array.isArray(colors) ? colors : [])
    .map((color) => normalizeSavedColor(color, color.name || '自定义颜色', color.colorType || 'personal'))
    .filter(Boolean)
    .sort((left, right) => String(right.usedAt || '').localeCompare(String(left.usedAt || '')))
    .slice(0, MAX_HISTORY)
  return writeColorList(getColorHistoryStorageKey(), normalized)
}

export function getMyColors() {
  return readColorList(MY_COLORS_KEY)
    .map((color) => normalizeSavedColor(color, '自定义颜色', 'personal'))
    .filter(Boolean)
}

export function saveMyColor(color = {}) {
  const normalized = normalizeSavedColor({ ...color, colorType: 'personal' }, '自定义颜色', 'personal')
  if (!normalized) return getMyColors()
  const colors = getMyColors()
  const nextColors = [normalized, ...colors.filter((item) => item.colorId !== normalized.colorId && item.hex !== normalized.hex)]
    .slice(0, MAX_MY_COLORS)
  return writeColorList(MY_COLORS_KEY, nextColors)
}

export function getBrandColors() {
  return readColorList(BRAND_COLORS_KEY)
    .map((color) => normalizeSavedColor(color, '品牌颜色', 'brand'))
    .filter(Boolean)
}

export function saveBrandColor(color = {}) {
  const normalized = normalizeSavedColor({ ...color, colorType: 'brand' }, '品牌颜色', 'brand')
  if (!normalized) return getBrandColors()
  const colors = getBrandColors()
  const nextColors = [normalized, ...colors.filter((item) => item.colorId !== normalized.colorId && item.hex !== normalized.hex)]
    .slice(0, MAX_BRAND_COLORS)
  writeColorList(BRAND_COLORS_KEY, nextColors)
  console.log('[color:brand]', {
    colorId: normalized.colorId,
    name: normalized.name
  })
  return nextColors
}

export function getFrequentColors(history = getColorHistory(), limit = 6) {
  return [...history]
    .filter((item) => (Number(item.usedCount) || 0) >= 2)
    .sort((left, right) => (Number(right.usedCount) || 0) - (Number(left.usedCount) || 0))
    .slice(0, Math.max(0, Number(limit) || 0))
}
