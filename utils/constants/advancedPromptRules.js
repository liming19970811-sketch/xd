const FIELD_VALUE_LABEL_ALIASES = Object.freeze({
  fabricType: Object.freeze({
    cotton_linen: '棉麻',
    denim: '牛仔',
    chiffon: '雪纺',
    knit: '针织',
    suiting: '西装料',
    suede: '麂皮',
    silk: '真丝'
  }),
  fabricColor: Object.freeze({
    keep_original: '保留原色',
    black_white_gray: '黑白灰',
    morandi: '莫兰迪',
    spring_summer: '春夏亮色'
  }),
  textureStrength: Object.freeze({
    light: '轻微',
    standard: '标准',
    strong: '强'
  }),
  replaceScope: Object.freeze({
    whole_garment: '整衣',
    partial: '局部'
  }),
  durationSec: Object.freeze({
    3: '3秒',
    5: '5秒',
    10: '10秒'
  }),
  motionType: Object.freeze({
    natural_walk: '自然走秀',
    natural_catwalk: '自然走秀',
    turnaround: '转身',
    pose: '摆拍',
    slow_motion: '慢动作'
  }),
  cameraType: Object.freeze({
    fixed: '固定镜头',
    follow: '跟拍',
    half_body: '半身',
    full_body: '全身'
  }),
  backgroundType: Object.freeze({
    white_studio: '白棚',
    runway: 'T台',
    runway_stage: 'T台',
    street: '街拍',
    minimal_space: '简约空间'
  }),
  sketchLevel: Object.freeze({
    simple: '简易',
    standard: '标准',
    fine: '精细',
    precise: '精细'
  }),
  neckType: Object.freeze({
    round: '圆领',
    v: 'V领',
    v_neck: 'V领',
    square: '方领',
    lapel: '翻领',
    off_shoulder: '一字肩',
    camisole: '吊带'
  }),
  sleeveType: Object.freeze({
    short: '短袖',
    short_sleeve: '短袖',
    long: '长袖',
    long_sleeve: '长袖',
    sleeveless: '无袖',
    puff: '泡泡袖',
    drop_shoulder: '落肩袖',
    five_point: '五分袖'
  }),
  fitType: Object.freeze({
    slim: '修身',
    standard: '标准',
    loose: '宽松',
    oversize: 'oversize',
    cropped: '短款',
    waist_fitted: '收腰款'
  }),
  lengthType: Object.freeze({
    short: '短款',
    regular: '常规',
    mid_long: '中长',
    long: '长款'
  })
})

const FIELD_LABEL_ALIASES = Object.freeze({
  fabricType: '面料',
  fabricColor: '面料颜色',
  textureStrength: '质感强度',
  replaceScope: '替换范围',
  durationSec: '时长',
  motionType: '动作',
  cameraType: '镜头',
  backgroundType: '背景',
  sketchLevel: '线稿精度',
  includeLabels: '是否标注结构',
  includeCraftNotes: '是否生成参考工艺说明',
  neckType: '领口',
  sleeveType: '袖型',
  fitType: '版型',
  lengthType: '衣长',
  pocketEnabled: '是否加口袋',
  printTheme: '印花主题',
  printStyle: '印花风格',
  colorCount: '颜色数量',
  complexity: '复杂度',
  placementArea: '位置',
  scale: '缩放',
  rotation: '旋转',
  opacity: '透明度'
})

function getFieldValueLabel(field = {}, value) {
  if (typeof value === 'boolean') {
    return value ? '是' : '否'
  }

  const options = Array.isArray(field.options) ? field.options : []
  const matchedOption = options.find((option) => String(option.value) === String(value))
  if (matchedOption && matchedOption.label) {
    return matchedOption.label
  }

  const aliases = FIELD_VALUE_LABEL_ALIASES[field.key] || {}
  if (Object.prototype.hasOwnProperty.call(aliases, value)) {
    return aliases[value]
  }

  return String(value)
}

function buildFieldPrompt(field = {}, value) {
  if (!field.key || field.key === 'customPrompt') {
    return ''
  }
  if (value === undefined || value === null || value === '') {
    return ''
  }
  return `${field.label || FIELD_LABEL_ALIASES[field.key] || field.key}：${getFieldValueLabel(field, value)}`
}

export function buildAdvancedPromptSummary(advancedPanelValues = {}, panels = []) {
  const panelConfigs = Array.isArray(panels) ? panels : []
  const panelMap = panelConfigs.reduce((map, panel) => {
    if (panel && panel.panelKey) {
      map[panel.panelKey] = panel
    }
    return map
  }, {})
  const panelKeys = Object.keys(advancedPanelValues || {})
  const advancedCustomPrompts = {}
  const advancedOptionPrompts = {}

  panelKeys.forEach((panelKey) => {
    const panelValues = advancedPanelValues[panelKey] || {}
    const customPrompt = String(panelValues.customPrompt || '').trim()
    if (customPrompt) {
      advancedCustomPrompts[panelKey] = customPrompt
    }

    const panelConfig = panelMap[panelKey] || {}
    const fields = Array.isArray(panelConfig.fields) ? panelConfig.fields : []
    const fieldPrompts = fields
      .map((field) => buildFieldPrompt(field, panelValues[field.key]))
      .filter(Boolean)

    if (fieldPrompts.length) {
      advancedOptionPrompts[panelKey] = fieldPrompts.join('；')
    }
  })

  const optionPromptSummary = Object.keys(advancedOptionPrompts)
    .map((panelKey) => `[${panelKey}] ${advancedOptionPrompts[panelKey]}`)
    .join('\n')
  const customPromptSummary = Object.keys(advancedCustomPrompts)
    .map((panelKey) => `[${panelKey}] ${advancedCustomPrompts[panelKey]}`)
    .join('\n')
  const fullAdvancedPromptSummary = [
    optionPromptSummary,
    ...Object.keys(advancedCustomPrompts).map((panelKey) => `[${panelKey} 补充需求] ${advancedCustomPrompts[panelKey]}`)
  ].filter(Boolean).join('\n')

  return {
    advancedCustomPrompts,
    advancedOptionPrompts,
    customPromptSummary,
    optionPromptSummary,
    fullAdvancedPromptSummary
  }
}
