export const PATTERN_LIBRARY = [
  {
    patternId: 'pattern_floral',
    name: '花卉',
    coverUrl: '/static/patterns/pattern-floral.jpg',
    type: 'floral',
    prompt: '花卉印花，柔和自然，适合女装连衣裙、衬衫和上新主图'
  },
  {
    patternId: 'pattern_plaid',
    name: '格纹',
    coverUrl: '/static/patterns/pattern-plaid.jpg',
    type: 'plaid',
    prompt: '经典格纹图案，线条清晰，适合衬衫、外套和通勤款'
  },
  {
    patternId: 'pattern_stripe',
    name: '条纹',
    coverUrl: '/static/patterns/pattern-stripe.jpg',
    type: 'stripe',
    prompt: '简洁条纹图案，规律排列，适合基础款、休闲款和针织款'
  },
  {
    patternId: 'pattern_geometric',
    name: '几何',
    coverUrl: '/static/patterns/pattern-geometric.jpg',
    type: 'geometric',
    prompt: '现代几何图案，结构感强，适合潮流款、运动款和设计师款'
  },
  {
    patternId: 'pattern_embroidery',
    name: '刺绣',
    coverUrl: '/static/patterns/pattern-embroidery.jpg',
    type: 'embroidery',
    prompt: '精致刺绣图案，局部点缀，适合领口、胸前、袖口和国风款'
  },
  {
    patternId: 'pattern_logo',
    name: 'LOGO',
    coverUrl: '/static/patterns/pattern-logo.jpg',
    type: 'logo',
    prompt: '品牌 LOGO 图案，位置清晰，适合胸前、袖子和局部标识'
  },
  {
    patternId: 'pattern_animal',
    name: '动物纹',
    coverUrl: '/static/patterns/pattern-animal.jpg',
    type: 'animal',
    prompt: '动物纹样，商业时装质感，适合外套、半裙和个性上新款'
  },
  {
    patternId: 'pattern_chinoiserie',
    name: '国风纹样',
    coverUrl: '/static/patterns/pattern-chinoiserie.jpg',
    type: 'chinoiserie',
    prompt: '国风纹样，东方审美与服装面料结合，适合新中式和节日款'
  }
]

export const REPLACE_AREA_OPTIONS = [
  { label: '整件衣服', value: 'whole_garment' },
  { label: '上衣', value: 'top' },
  { label: '裤子', value: 'pants' },
  { label: '袖子', value: 'sleeve' },
  { label: '领口', value: 'collar' },
  { label: '局部', value: 'partial' }
]

export const PATTERN_STRENGTH_OPTIONS = [
  { label: '轻微', value: 'soft' },
  { label: '标准', value: 'standard' },
  { label: '强烈', value: 'strong' }
]

export const PRESERVE_TEXTURE_OPTIONS = [
  { label: '强保留', value: 'strong' },
  { label: '标准保留', value: 'standard' },
  { label: '轻微重绘', value: 'soft' }
]

export function getPatternLibrary() {
  return PATTERN_LIBRARY
}

export function getPatternById(patternId) {
  return PATTERN_LIBRARY.find((item) => item.patternId === patternId) || null
}

export function buildPatternPrompt(pattern = {}) {
  const patternName = pattern.patternName || '图案'
  const replaceArea = pattern.replaceAreaLabel || '指定区域'
  const strength = pattern.patternStrengthLabel || '标准'
  const preserveText = pattern.preserveTextureLabel || '保留面料纹理'
  return `保持服装原版型和褶皱，将${replaceArea}替换为${patternName}图案，效果强度为${strength}，${preserveText}原面料纹理和真实光影。`
}
