export const REPLACE_AREA_OPTIONS = [
  { label: '整件衣服', value: 'whole_garment' },
  { label: '上衣', value: 'top' },
  { label: '裤子', value: 'pants' },
  { label: '袖子', value: 'sleeve' },
  { label: '局部', value: 'partial' }
]

export const PATTERN_TYPE_OPTIONS = [
  { label: '花纹', value: 'floral' },
  { label: '条纹', value: 'stripe' },
  { label: '格纹', value: 'plaid' },
  { label: '刺绣', value: 'embroidery' },
  { label: 'LOGO', value: 'logo' }
]

export const PRESERVE_TEXTURE_OPTIONS = [
  { label: '强保留', value: 'strong' },
  { label: '标准保留', value: 'standard' },
  { label: '轻微重绘', value: 'soft' }
]

export function buildPatternPrompt(pattern = {}) {
  const patternType = pattern.patternTypeLabel || '图案'
  const replaceArea = pattern.replaceAreaLabel || '整件衣服'
  const preserveText = pattern.preserveTextureLabel || '标准保留'
  return `将${patternType}应用到${replaceArea}，${preserveText}原服装面料纹理、版型轮廓、光影和商业摄影质感。`
}
