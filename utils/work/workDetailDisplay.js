const VALUE_LABELS = Object.freeze({
  exact_composite: '精确替换',
  generative_reference: '风格生成',
  cover: '填满画面',
  contain: '完整显示',
  whole_garment: '整件服装',
  upper: '上衣',
  upper_body: '上衣',
  lower: '下装',
  lower_body: '下装',
  sleeves: '袖子',
  sleeve: '袖子',
  collar: '领口',
  neckline: '领口',
  local: '指定局部',
  standard: '标准',
  strong: '明显',
  subtle: '轻微',
  micro_adjust: '微调优化',
  obvious_redesign: '明显改款',
  structural_redesign: '结构重设计',
  commute: '通勤',
  korean: '韩系',
  premium: '高级感',
  sport: '运动',
  guochao: '国潮',
  chanel: '小香风',
  minimal: '极简',
  daily: '日常穿着',
  ecommerce: '电商上新',
  xiaohongshu: '小红书展示',
  marketing: '营销主推款',
  garment_subject: '原服装主体',
  color: '原颜色',
  fabric: '原面料质感',
  pattern: '原图案',
  model_pose: '模特与姿势',
  background_composition: '背景和构图',
  upper_only: '只换上装',
  top_only: '只换上装',
  lower_only: '只换下装',
  bottom_only: '只换下装',
  separate: '上下装一起换',
  upper_lower: '上下装一起换',
  full_outfit: '整套/连体服',
  one_piece: '整套/连体服',
  faithful: '忠实细节图',
  faithful_crop: '忠实裁切增强',
  ai_completion: 'AI补全参考',
  user_upload: '本次上传',
  model_profile: '我的常用模特',
  system: '系统人像',
  head_replace: '换整头',
  face_replace: '只换脸',
  original: '保持原样',
  round_neck: '圆领',
  v_neck: 'V领',
  square_neck: '方领',
  turn_down_collar: '翻领',
  boat_neck: '一字领',
  short_sleeve: '短袖',
  long_sleeve: '长袖',
  sleeveless: '无袖',
  puff_sleeve: '泡泡袖',
  drop_shoulder: '落肩袖',
  slim: '修身',
  regular: '标准',
  loose: '宽松',
  a_line: 'A型',
  straight: '直筒',
  cropped: '短款',
  regular_length: '常规',
  midi: '中长',
  long: '长款'
})

const TARGET_LABELS = Object.freeze({
  neckline: '领口',
  sleeve: '袖型',
  shoulder: '肩部',
  body_fit: '衣身版型',
  fit: '衣身版型',
  length: '衣长',
  placket: '门襟',
  pocket: '口袋',
  hem: '下摆',
  decoration: '装饰细节',
  silhouette: '整体廓形',
  cuff: '袖口',
  button: '纽扣',
  zipper: '拉链',
  stitching: '车线'
})

const ACCESSORY_LABELS = Object.freeze({
  shoes: '鞋子', bag: '包包', hat: '帽子', belt: '腰带', scarf: '围巾', jewelry: '首饰'
})

function text(value = '') {
  return String(value === undefined || value === null ? '' : value).trim()
}

function firstValue(source = {}, keys = []) {
  for (const key of keys) {
    const value = source[key]
    if (value !== undefined && value !== null && value !== '') return value
  }
  return ''
}

function valueLabel(value) {
  if (Array.isArray(value)) return value.map(valueLabel).filter(Boolean).join('、')
  if (typeof value === 'boolean') return value ? '是' : '否'
  if (value && typeof value === 'object') {
    return text(value.name || value.label || value.displayName || value.hex) || '已设置'
  }
  const normalized = text(value)
  if (!normalized) return ''
  return VALUE_LABELS[normalized] || TARGET_LABELS[normalized] || ACCESSORY_LABELS[normalized] || (/^[a-z0-9_-]+$/i.test(normalized) ? '已设置' : normalized)
}

function addField(list, label, value, options = {}) {
  const displayValue = valueLabel(value)
  if (!displayValue && !options.allowMissing) return
  list.push({ label, value: displayValue || '未记录' })
}

function addPreserveField(list, params = {}) {
  const selected = Array.isArray(params.preserveItems) ? params.preserveItems.map(valueLabel).filter(Boolean) : []
  const booleanRules = [
    ['preserveIdentity', '人物身份'],
    ['preserveFace', '人脸'],
    ['preserveExpression', '表情'],
    ['preserveBody', '体型'],
    ['preservePose', '姿势'],
    ['preserveGarment', '服装'],
    ['preserveTexture', '面料纹理'],
    ['preservePattern', '图案'],
    ['preserveColor', '颜色'],
    ['preserveBackground', '背景'],
    ['preserveScene', '场景'],
    ['preserveComposition', '构图']
  ]
  booleanRules.forEach(([key, label]) => {
    if (params[key] === true && !selected.includes(label)) selected.push(label)
  })
  if (selected.length) addField(list, '保持不变', selected)
}

function formatTargets(params = {}) {
  const targets = Array.isArray(params.changeTargets) ? params.changeTargets : []
  const directions = params.targetDirections && typeof params.targetDirections === 'object' ? params.targetDirections : {}
  return targets.map((target) => {
    const targetLabel = TARGET_LABELS[target] || valueLabel(target)
    const direction = valueLabel(directions[target])
    return direction ? `${targetLabel} → ${direction}` : targetLabel
  }).filter(Boolean)
}

function accessorySummary(params = {}) {
  const accessories = Array.isArray(params.accessoryImages)
    ? params.accessoryImages
    : (Array.isArray(params.accessoryReferences) ? params.accessoryReferences : [])
  return accessories.map((item) => {
    if (typeof item === 'string') return '已上传配饰'
    return ACCESSORY_LABELS[item.type || item.accessoryType] || valueLabel(item.name || item.label || item.type)
  }).filter(Boolean)
}

function detectKind(work = {}) {
  return [work.workType, work.taskType, work.typeLabel].map(text).join(' ').toLowerCase()
}

export function buildWorkChangeFields(work = {}) {
  const params = work.params && typeof work.params === 'object' ? work.params : {}
  const kind = detectKind(work)
  const fields = []
  addField(fields, '功能', work.typeLabel || work.title || 'AI生成作品')

  if (/color/.test(kind)) {
    const targetColor = params.targetColor && typeof params.targetColor === 'object' ? params.targetColor : {}
    addField(fields, '目标颜色', targetColor.displayName || targetColor.name || params.colorName, { allowMissing: true })
    addField(fields, '目标色值', targetColor.hex || params.targetColorHex, { allowMissing: true })
    addField(fields, '换色区域', firstValue(params, ['targetRegion', 'colorTargetArea']), { allowMissing: true })
    addField(fields, '颜色来源', params.colorSource)
    addField(fields, '纹理保留', params.textureRetention || (params.preserveTexture === true ? '标准' : ''))
  } else if (/style_redesign|hot_style|refine|改款/.test(kind)) {
    addField(fields, '改动部位', formatTargets(params), { allowMissing: true })
    addField(fields, '改动强度', params.changeIntensity, { allowMissing: true })
    addField(fields, '风格方向', params.styleDirections || params.selectedStyleNames)
    addField(fields, '设计用途', params.designPurpose)
  } else if (/scene/.test(kind)) {
    addField(fields, '目标场景', params.sceneTemplateName || params.sceneReferenceName || (params.hasSceneReferenceImage || (work.inputAssetSummary || {}).hasSceneReference ? '用户上传场景图' : ''), { allowMissing: true })
    addField(fields, '替换模式', params.sceneMode, { allowMissing: true })
    addField(fields, '场景适配', params.sceneFit)
  } else if (/clothes|garment_replace|outfit|换衣/.test(kind)) {
    const assets = work.inputAssetSummary || {}
    addField(fields, '换装方式', firstValue(params, ['garmentMode', 'replaceMode', 'garmentReplaceMode']), { allowMissing: true })
    if (assets.hasTopGarment || firstValue(params, ['topGarmentImage', 'upperGarmentImage', 'upperGarment'])) addField(fields, '上装参考', '已上传')
    if (assets.hasBottomGarment || firstValue(params, ['bottomGarmentImage', 'lowerGarmentImage', 'lowerGarment'])) addField(fields, '下装参考', '已上传')
    if (assets.hasOnePieceGarment || firstValue(params, ['onePieceGarmentImage', 'fullGarmentImage', 'onePieceGarment'])) addField(fields, '整套参考', '已上传')
    addField(fields, '配饰', accessorySummary(params))
  } else if (/garment_detail|细节/.test(kind)) {
    addField(fields, '所选细节', firstValue(params, ['selectedDetailTypes', 'detailTypes', 'detailType', 'itemType']), { allowMissing: true })
    addField(fields, '生成方式', firstValue(params, ['detailGenerationMode', 'generationMode', 'fidelityMode']), { allowMissing: true })
  } else if (/fabric|面料/.test(kind)) {
    addField(fields, '目标面料', firstValue(params, ['fabricName', 'materialName', 'fabricType', 'materialType']), { allowMissing: true })
    addField(fields, '换面料区域', firstValue(params, ['targetRegion', 'fabricTargetArea']), { allowMissing: true })
    addField(fields, '纹理强度', firstValue(params, ['textureStrength', 'textureRetention']), { allowMissing: true })
  } else if (/pattern_replace|换图案/.test(kind)) {
    addField(fields, '目标图案', firstValue(params, ['patternName', 'patternType', 'printType']), { allowMissing: true })
    addField(fields, '替换区域', firstValue(params, ['targetRegion', 'patternTargetArea']), { allowMissing: true })
  } else if (/model|head_replace|face_replace|模特/.test(kind)) {
    const source = params.modelProfileId ? '我的常用模特' : firstValue(params, ['modelSource', 'personSource', 'referenceSource'])
    addField(fields, '模特来源', source || ((work.inputAssetSummary || {}).hasPersonReference ? '本次上传' : ''), { allowMissing: true })
    addField(fields, '替换方式', firstValue(params, ['replaceType', 'actionType']), { allowMissing: true })
    addField(fields, '人物类型', firstValue(params, ['personType', 'modelType', 'gender']))
    addField(fields, '场景设置', params.sceneTemplateName || params.sceneType)
  } else {
    addField(fields, '主要要求', firstValue(params, ['outputUsage', 'itemDisplayName']), { allowMissing: true })
  }

  addPreserveField(fields, params)
  addField(fields, '补充要求', firstValue(params, ['additionalRequirements', 'customRequirement', 'customPrompt', 'notes']))
  return fields
}

export function buildSchemeFields(item = {}, index = 0) {
  const fields = []
  addField(fields, '方案', item.schemeName || item.displayName || `方案 ${index + 1}`)
  addField(fields, '方案特点', item.changeSummary || item.featureSummary || item.description)
  return fields
}

export function buildGenerationInfo(work = {}) {
  return [
    { label: '生成状态', value: work.statusLabel || work.statusText || '未记录' },
    { label: '生成时间', value: work.timeLabel || '未记录' },
    { label: '方案名称', value: work.planName || '未记录' },
    { label: '结果数量', value: `${Number(work.completedOutputCount) || 0}/${Number(work.expectedOutputCount) || 1}` },
    { label: 'Provider', value: work.provider || '未记录' },
    { label: '模型版本', value: work.modelVersion || '未记录' },
    { label: '任务信息', value: work.taskId || '未记录' },
    { label: '额度记录', value: work.quotaConsumed === undefined || work.quotaConsumed === null || work.quotaConsumed === '' ? '同步中' : `${work.quotaConsumed} 点` }
  ]
}

export { VALUE_LABELS, TARGET_LABELS }
