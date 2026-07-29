export const CUSTOM_COLOR_VALUE = 'custom'

export const COLOR_OPTIONS = [
  { name: '纯黑', value: 'pure_black', hex: '#000000' },
  { name: '米白', value: 'warm_white', hex: '#F5F1E8' },
  { name: '高级灰', value: 'premium_gray', hex: '#666666' },
  { name: '雾霾蓝', value: 'mist_blue', hex: '#8FA8C9' },
  { name: '燕麦卡其', value: 'oat_khaki', hex: '#C8B89A' },
  { name: '焦糖棕', value: 'caramel_brown', hex: '#9A5B32' },
  { name: '松石绿', value: 'pine_green', hex: '#477A6B' },
  { name: '玫瑰粉', value: 'rose_pink', hex: '#D9A6B3' }
]

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

export function buildColorPrompt(color = {}) {
  const colorName = color.colorName || '目标颜色'
  const colorHex = color.colorHex || ''
  return `将服装主体调整为${colorName}${colorHex ? `（${colorHex}）` : ''}，保留服装版型、面料纹理、褶皱和商品摄影质感。`
}
