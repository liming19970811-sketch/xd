const COLOR_FAMILIES = Object.freeze(['黑白灰', '红色', '橙色', '黄色', '绿色', '青绿色', '青蓝色', '蓝色', '靛蓝色', '紫色'])
const COLOR_TONES = Object.freeze(['极浅', '浅色', '柔和', '明亮', '标准', '深色', '更深', '极深'])

// 固定 10 列 x 8 行色表。行表示明度层级，列表示色相家族，禁止运行时随机生成。
export const SYSTEM_COLOR_HEX_MATRIX = Object.freeze([
  Object.freeze(['#FFFFFF', '#FFF1F2', '#FFF7ED', '#FEFCE8', '#F0FDF4', '#ECFDF5', '#ECFEFF', '#EFF6FF', '#EEF2FF', '#FAF5FF']),
  Object.freeze(['#F3F4F6', '#FFE4E6', '#FFEDD5', '#FEF9C3', '#DCFCE7', '#D1FAE5', '#CFFAFE', '#DBEAFE', '#E0E7FF', '#F3E8FF']),
  Object.freeze(['#D1D5DB', '#FECDD3', '#FED7AA', '#FEF08A', '#BBF7D0', '#A7F3D0', '#A5F3FC', '#BFDBFE', '#C7D2FE', '#E9D5FF']),
  Object.freeze(['#9CA3AF', '#FB7185', '#FB923C', '#FACC15', '#4ADE80', '#34D399', '#22D3EE', '#60A5FA', '#818CF8', '#C084FC']),
  Object.freeze(['#6B7280', '#E11D48', '#EA580C', '#CA8A04', '#16A34A', '#059669', '#0891B2', '#2563EB', '#4F46E5', '#9333EA']),
  Object.freeze(['#4B5563', '#BE123C', '#C2410C', '#A16207', '#15803D', '#047857', '#0E7490', '#1D4ED8', '#4338CA', '#7E22CE']),
  Object.freeze(['#374151', '#9F1239', '#9A3412', '#854D0E', '#166534', '#065F46', '#155E75', '#1E40AF', '#3730A3', '#6B21A8']),
  Object.freeze(['#111827', '#4C0519', '#431407', '#422006', '#052E16', '#022C22', '#083344', '#172554', '#1E1B4B', '#3B0764'])
])

function hexToRgbString(hex = '') {
  const value = String(hex).replace('#', '')
  return [0, 2, 4].map((offset) => parseInt(value.slice(offset, offset + 2), 16)).join(',')
}

function createColor(colorId, name, hex, category) {
  return Object.freeze({
    colorId,
    name,
    hex,
    rgb: hexToRgbString(hex),
    category,
    fabricTags: Object.freeze([]),
    prompt: `将指定服装区域替换为${hex}，保留原面料纹理、光泽、编织结构和褶皱。`,
    colorType: 'system',
    sourceType: 'system_palette',
    brandName: '',
    usage: '',
    createdAt: '2026-07-29T00:00:00.000Z'
  })
}

export const SYSTEM_COLOR_MATRIX = Object.freeze(SYSTEM_COLOR_HEX_MATRIX.map((row, rowIndex) => Object.freeze(
  row.map((hex, columnIndex) => createColor(
    `system_${String(rowIndex + 1).padStart(2, '0')}_${String(columnIndex + 1).padStart(2, '0')}`,
    `${COLOR_TONES[rowIndex]}${COLOR_FAMILIES[columnIndex]}`,
    hex,
    COLOR_FAMILIES[columnIndex]
  ))
)))

export const COLOR_REPLACE_AREAS = Object.freeze([
  Object.freeze({ label: '整件服装', value: 'whole_garment' }),
  Object.freeze({ label: '上衣', value: 'top' }),
  Object.freeze({ label: '裤子', value: 'pants' }),
  Object.freeze({ label: '袖子', value: 'sleeves' }),
  Object.freeze({ label: '领口', value: 'collar' }),
  Object.freeze({ label: '局部', value: 'local' })
])

export const COLOR_GROUPS = Object.freeze([
  Object.freeze({
    title: '系统颜色',
    colors: Object.freeze(SYSTEM_COLOR_MATRIX.reduce((items, row) => items.concat(row), []))
  })
])

export function getColorGroups() {
  return COLOR_GROUPS.map((group) => ({
    title: group.title,
    colors: group.colors.map((color) => ({ ...color, fabricTags: [...color.fabricTags] }))
  }))
}

export function getSystemColorMatrix() {
  return SYSTEM_COLOR_MATRIX.map((row) => row.map((color) => ({ ...color, fabricTags: [...color.fabricTags] })))
}

export function getColorById(colorId = '') {
  for (const row of SYSTEM_COLOR_MATRIX) {
    const color = row.find((item) => item.colorId === colorId)
    if (color) return { ...color, fabricTags: [...color.fabricTags] }
  }
  return null
}
