const QUALITY_STATUSES = Object.freeze(['approved', 'reviewed'])

function text(value, max = 120) { return String(value || '').trim().slice(0, max) }
function object(value) { return value && typeof value === 'object' && !Array.isArray(value) ? value : {} }
function list(value, max = 20) { return (Array.isArray(value) ? value : []).slice(0, max).map((item) => text(item, 60)).filter(Boolean) }
const VALUE_ALIASES = Object.freeze({
  'T恤': 'tshirt', '衬衫': 'shirt', '连衣裙': 'dress', '半身裙': 'skirt', '裤装': 'pants', '外套': 'coat',
  '女装': 'women', '成人女装': 'women', '男装': 'men', '成人男装': 'men', '童装': 'kids',
  '春夏': 'spring_summer', '秋冬': 'autumn_winter', '四季': 'all_season', '通勤': 'commuter', '休闲': 'casual', '时尚': 'fashion', '极简': 'minimal',
  '修身': 'slim', '常规': 'regular', '宽松': 'loose', '廓形': 'oversized', '圆领': 'round', 'V领': 'v_neck', '衬衫领': 'shirt_collar', '立领': 'stand_collar',
  '短袖': 'short', '长袖': 'long', '插肩袖': 'raglan', '无袖': 'sleeveless', '短款': 'cropped', '长款': 'long',
  '棉': 'cotton', '麻': 'linen', '牛仔': 'denim', '针织': 'knit', '真丝': 'silk', '雪纺': 'chiffon', '羊毛': 'wool',
  '无弹': 'none', '微弹': 'low', '中弹': 'medium', '高弹': 'high', '轻薄': 'light', '适中': 'medium', '厚实': 'heavy',
  '日常': 'daily', '商务': 'business', '运动': 'sports', '礼服': 'occasion'
})
function normalized(value) { const raw = text(value); return text(VALUE_ALIASES[raw] || raw).toLowerCase() }
function equal(left, right) { return Boolean(normalized(left) && normalized(left) === normalized(right)) }
function includes(values, expected) { const target = normalized(expected); return Boolean(target && values.some((item) => normalized(item) === target)) }

function normalizePatternSearchRequest(input = {}) {
  const material = object(input.materialProperties)
  return {
    garmentCategory: text(input.garmentCategory, 60), audience: text(input.audience, 60), season: text(input.season, 60),
    style: text(input.style, 60), fitType: text(input.fitType, 60), neckType: text(input.neckType, 60),
    sleeveType: text(input.sleeveType, 60), lengthType: text(input.lengthType, 60), baseSize: text(input.baseSize, 20),
    materialProperties: { type: text(material.type || material.materialType, 60), elasticity: text(material.elasticity, 40), thickness: text(material.thickness, 40) },
    usageScene: text(input.usageScene, 60), status: QUALITY_STATUSES.includes(input.status) ? input.status : 'quality',
    tags: list(input.tags, 10), keyword: text(input.keyword, 80).toLowerCase(), scope: ['personal', 'enterprise'].includes(input.scope) ? input.scope : 'personal',
    page: Math.max(1, Number(input.page) || 1), pageSize: Math.min(20, Math.max(1, Number(input.pageSize) || 12))
  }
}

function candidateProfile(master = {}, version = {}, sizeSpecs = []) {
  const taxonomy = object(master.taxonomy); const aiInput = object(object(version.aiDraft).patternInput)
  const material = { ...object(aiInput.materialProperties), ...object(master.materialProperties) }
  const size = sizeSpecs.find((item) => item.baseSize) || {}
  return {
    garmentCategory: taxonomy.garmentCategory || master.category || '', audience: taxonomy.audience || master.genderAge || '',
    season: taxonomy.season || master.season || '', style: taxonomy.style || '', fitType: taxonomy.fitType || master.silhouette || '',
    neckType: taxonomy.neckType || master.collar || '', sleeveType: taxonomy.sleeveType || master.sleeve || '', lengthType: taxonomy.lengthType || master.length || '',
    baseSize: size.baseSize || object(version.sizeParams).baseSize || master.baseSize || '',
    materialTypes: [...new Set([...list(taxonomy.materialCompatibility, 20), text(material.type || master.fabric, 60)].filter(Boolean))],
    elasticity: text(material.elasticity, 40), thickness: text(material.thickness, 40), usageScenes: list(taxonomy.usageScene, 20), tags: list(master.tags, 20)
  }
}

const FIELDS = Object.freeze([
  ['garmentCategory', '服装品类', 24], ['fitType', '版型', 12], ['baseSize', '基础尺码', 10], ['neckType', '领型', 8],
  ['sleeveType', '袖型', 8], ['lengthType', '衣长', 6], ['audience', '适用人群', 6], ['style', '风格', 6], ['season', '季节', 4]
])

function scorePatternCandidate(request = {}, master = {}, version = {}, sizeSpecs = []) {
  const profile = candidateProfile(master, version, sizeSpecs); const reasons = []; const differences = []; let score = 0; let possible = 0
  FIELDS.forEach(([key, label, weight]) => {
    if (!request[key]) return
    possible += weight
    if (equal(request[key], profile[key])) { score += weight; reasons.push(`${label}一致`) }
    else differences.push({ field: key, label, requested: request[key], candidate: profile[key] || '未设置' })
  })
  const materialChecks = [['type', '面料类型', 7, profile.materialTypes], ['elasticity', '弹性', 4, [profile.elasticity]], ['thickness', '厚度', 4, [profile.thickness]]]
  materialChecks.forEach(([key, label, weight, values]) => {
    const expected = request.materialProperties[key]; if (!expected) return
    possible += weight
    if (includes(values, expected)) { score += weight; reasons.push(`${label}匹配`) }
    else differences.push({ field: `materialProperties.${key}`, label, requested: expected, candidate: values.filter(Boolean).join('、') || '未设置' })
  })
  if (request.usageScene) { possible += 5; if (includes(profile.usageScenes, request.usageScene)) { score += 5; reasons.push('使用场景匹配') } else differences.push({ field: 'usageScene', label: '使用场景', requested: request.usageScene, candidate: profile.usageScenes.join('、') || '未设置' }) }
  request.tags.forEach((tag) => { possible += 2; if (includes(profile.tags, tag)) { score += 2; reasons.push(`标签“${tag}”匹配`) } })
  if (request.keyword) {
    possible += 4
    const haystack = [master.title, master.patternCode, ...profile.tags].join(' ').toLowerCase()
    if (haystack.includes(request.keyword)) { score += 4; reasons.push('名称或标签匹配') }
  }
  const qualityBonus = version.reviewStatus === 'approved' && master.approvedVersionId === version.versionId ? 8 : 0
  const percent = possible ? Math.round((score / possible) * 92 + qualityBonus) : (qualityBonus ? 100 : 72)
  return { score: Math.max(0, Math.min(100, percent)), reasons: reasons.slice(0, 5), differences: differences.slice(0, 8), profile }
}

module.exports = { QUALITY_STATUSES, normalizePatternSearchRequest, candidateProfile, scorePatternCandidate }
