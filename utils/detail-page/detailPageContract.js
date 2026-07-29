export const DETAIL_PAGE_TASK_TYPE = 'detail_page_long_image'
export const DETAIL_PAGE_TEMPLATE_ID = 'simple_ecommerce'
export const DETAIL_PAGE_TEMPLATE_VERSION = '1.0.0'
export const DETAIL_PAGE_RENDER_WIDTH = 750
export const DETAIL_PAGE_MAX_SEGMENT_HEIGHT = 6000
export const DETAIL_PAGE_MAX_ASSETS = 12

export const DETAIL_IMAGE_SOURCES = Object.freeze([
  'original_upload',
  'user_selected_asset',
  'faithful_crop',
  'ai_reference',
  'manual_upload'
])

export const DETAIL_ASSET_USAGES = Object.freeze([
  Object.freeze({ value: 'product_main', label: '商品主图' }),
  Object.freeze({ value: 'model_display', label: '模特展示图' }),
  Object.freeze({ value: 'flat_front', label: '正面平铺图' }),
  Object.freeze({ value: 'flat_back', label: '背面平铺图' }),
  Object.freeze({ value: 'fabric_detail', label: '面料细节' }),
  Object.freeze({ value: 'neckline_detail', label: '领口细节' }),
  Object.freeze({ value: 'cuff_detail', label: '袖口细节' }),
  Object.freeze({ value: 'hem_detail', label: '下摆细节' }),
  Object.freeze({ value: 'hardware_detail', label: '拉链/纽扣/金属链条' }),
  Object.freeze({ value: 'print_logo', label: '印花/刺绣/Logo' }),
  Object.freeze({ value: 'craft_detail', label: '工艺细节' }),
  Object.freeze({ value: 'size_chart_image', label: '尺码表图片' }),
  Object.freeze({ value: 'other', label: '其他补充图片' })
])

export const DETAIL_PAGE_TEMPLATES = Object.freeze([
  Object.freeze({ id: 'simple_ecommerce', version: '1.0.0', name: '简约电商', accent: '#1677ff', background: '#ffffff', surface: '#f7f8fa', text: '#101828', muted: '#667085', padding: 44, gap: 24, imageHeight: 640, heroImageHeight: 760 }),
  Object.freeze({ id: 'clear_japanese', version: '1.0.0', name: '清透日系', accent: '#5f8f87', background: '#f8fbfa', surface: '#eef5f2', text: '#263a37', muted: '#6f817d', padding: 56, gap: 34, imageHeight: 610, heroImageHeight: 720 }),
  Object.freeze({ id: 'brand_quality', version: '1.0.0', name: '品牌质感', accent: '#b69a67', background: '#16191f', surface: '#252a33', text: '#f8fafc', muted: '#c5cad3', padding: 38, gap: 20, imageHeight: 700, heroImageHeight: 820 })
])

export const DETAIL_PAGE_PLATFORMS = Object.freeze([
  Object.freeze({ id: 'taobao', name: '淘宝', width: 750, density: 'standard' }),
  Object.freeze({ id: 'douyin', name: '抖音', width: 900, density: 'compact' }),
  Object.freeze({ id: 'rednote', name: '小红书', width: 900, density: 'relaxed' }),
  Object.freeze({ id: 'independent', name: '独立站', width: 1200, density: 'standard' })
])

export const DETAIL_PAGE_MODULES = Object.freeze([
  Object.freeze({ id: 'hero', title: '商品首屏', description: '商品名称、主图和核心卖点。', kind: 'mixed', required: true, needsImage: true, needsText: true, enabled: true, preferredUsage: 'product_main' }),
  Object.freeze({ id: 'model_display', title: '模特展示', description: '展示真实穿着效果和使用场景。', kind: 'image', needsImage: true, enabled: false, preferredUsage: 'model_display' }),
  Object.freeze({ id: 'flat_display', title: '平铺展示', description: '展示服装正面、背面和完整廓形。', kind: 'image', needsImage: true, enabled: true, preferredUsage: 'flat_front' }),
  Object.freeze({ id: 'fabric', title: '面料展示', description: '展示真实面料近照和材质说明。', kind: 'mixed', needsImage: true, needsText: true, enabled: false, preferredUsage: 'fabric_detail' }),
  Object.freeze({ id: 'fit', title: '版型说明', description: '展示领型、袖型、衣长和整体廓形。', kind: 'text', needsText: true, enabled: false }),
  Object.freeze({ id: 'craft', title: '细节与工艺', description: '领口、袖口、车线、纽扣、拉链和金属装饰。', kind: 'mixed', needsImage: true, needsText: true, enabled: false, preferredUsage: 'hardware_detail' }),
  Object.freeze({ id: 'selling_points', title: '核心卖点', description: '将用户提供的真实特点整理为易读内容。', kind: 'text', needsText: true, enabled: true }),
  Object.freeze({ id: 'product_info', title: '商品信息', description: '款号、颜色、面料成分、季节和适用场景。', kind: 'text', needsText: true, enabled: false }),
  Object.freeze({ id: 'size_chart', title: '尺码表', description: '使用用户填写、上传或确认的真实尺码。', kind: 'size', enabled: false }),
  Object.freeze({ id: 'care', title: '洗护说明', description: '根据用户提供的面料信息编辑洗护提示。', kind: 'text', needsText: true, enabled: false }),
  Object.freeze({ id: 'brand', title: '品牌信息', description: '品牌名称、Logo和服务说明。', kind: 'mixed', needsText: true, enabled: false, preferredUsage: 'other' }),
  Object.freeze({ id: 'custom', title: '自定义模块', description: '用户自定义标题、图片和文字。', kind: 'mixed', enabled: false, preferredUsage: 'other' })
])

export const SIZE_FIELDS = Object.freeze([
  Object.freeze({ key: 'size', label: '尺码' }),
  Object.freeze({ key: 'shoulder', label: '肩宽' }),
  Object.freeze({ key: 'bust', label: '胸围' }),
  Object.freeze({ key: 'waist', label: '腰围' }),
  Object.freeze({ key: 'hip', label: '臀围' }),
  Object.freeze({ key: 'sleeveLength', label: '袖长' }),
  Object.freeze({ key: 'garmentLength', label: '衣长' }),
  Object.freeze({ key: 'pantsLength', label: '裤长' })
])

function text(value = '') {
  return String(value || '').trim()
}

export function createDetailPageModules() {
  return DETAIL_PAGE_MODULES.map((item, index) => ({
    ...item,
    order: index,
    text: '',
    assetId: '',
    fileId: '',
    fileUrl: '',
    localPath: '',
    imageSource: 'original_upload',
    sourceConfirmed: true,
    subtitle: item.description,
    layout: {
      imageFit: 'contain',
      focalPosition: 'center'
    }
  }))
}

export function getDetailModuleStatus(module = {}, sizeRows = []) {
  if (!module.enabled) return { key: 'unselected', label: '未选择' }
  if (module.kind === 'size') {
    const rows = normalizeSizeRows(sizeRows)
    return rows.length && rows.every((row) => row.confirmedByUser)
      ? { key: 'complete', label: '已完成' }
      : { key: 'missing_info', label: '缺少信息' }
  }
  if (module.needsImage && !text(module.fileId)) return { key: 'missing_image', label: '缺少图片' }
  if (module.needsText && !text(module.text)) return { key: 'missing_info', label: '缺少信息' }
  return { key: 'complete', label: '已完成' }
}

export function normalizeSizeRows(rows = []) {
  return (Array.isArray(rows) ? rows : []).map((row) => ({
    size: text(row.size),
    shoulder: text(row.shoulder),
    bust: text(row.bust),
    waist: text(row.waist),
    hip: text(row.hip),
    sleeveLength: text(row.sleeveLength),
    garmentLength: text(row.garmentLength),
    pantsLength: text(row.pantsLength),
    unit: text(row.unit) || 'cm',
    measurementNote: text(row.measurementNote),
    source: text(row.source) || 'manual',
    confirmedByUser: row.confirmedByUser === true
  })).filter((row) => row.size || ['shoulder', 'bust', 'waist', 'hip', 'sleeveLength', 'garmentLength', 'pantsLength'].some((key) => row[key]))
}

export function validateDetailPageDraft(draft = {}) {
  const errors = []
  const modules = Array.isArray(draft.modules) ? draft.modules : []
  const enabled = modules.filter((item) => item.enabled)
  if (!draft.primaryAsset || !text(draft.primaryAsset.fileId)) errors.push('请上传商品正面图')
  if (!enabled.length) errors.push('请至少选择一个详情模块')
  enabled.forEach((module) => {
    const status = getDetailModuleStatus(module, draft.sizeRows)
    if (status.key === 'missing_image') errors.push(`“${module.title}”缺少真实图片，请补充或隐藏该模块`)
    if (status.key === 'missing_info') errors.push(module.id === 'size_chart' ? '请确认尺码表，或隐藏尺码表模块' : `“${module.title}”缺少真实信息`)
  })
  if (enabled.some((item) => item.imageSource === 'ai_reference' && item.sourceConfirmed !== true)) {
    errors.push('AI参考图必须经用户确认后才能进入正式长图')
  }
  return { ok: errors.length === 0, errors }
}

export function buildDetailPageSnapshot(draft = {}) {
  const template = DETAIL_PAGE_TEMPLATES.find((item) => item.id === draft.templateId) || DETAIL_PAGE_TEMPLATES[0]
  const platform = DETAIL_PAGE_PLATFORMS.find((item) => item.id === draft.platformId) || DETAIL_PAGE_PLATFORMS[0]
  const modules = (Array.isArray(draft.modules) ? draft.modules : [])
    .filter((item) => item.enabled)
    .sort((a, b) => Number(a.order) - Number(b.order))
    .map((item) => ({
      moduleId: text(item.moduleId || item.id),
      moduleType: text(item.moduleType || item.kind),
      subtitle: text(item.subtitle || item.description),
      content: text(item.content || item.text),
      assetIds: Array.from(new Set([text(item.assetId), ...(Array.isArray(item.matchedAssetIds) ? item.matchedAssetIds.map(text) : [])].filter(Boolean))),
      layout: {
        imageFit: ((item.layout || {}).imageFit === 'cover' ? 'cover' : 'contain'),
        focalPosition: ['top', 'center', 'bottom'].includes((item.layout || {}).focalPosition) ? item.layout.focalPosition : 'center'
      },
      visible: item.visible !== false,
      sortOrder: Number(item.sortOrder ?? item.order) || 0,
      dataSource: DETAIL_IMAGE_SOURCES.includes(item.imageSource) ? item.imageSource : 'manual_upload',
      confirmedByUser: item.sourceConfirmed === true,
      // Compatibility aliases for existing task/result readers.
      id: text(item.id),
      title: text(item.title),
      kind: text(item.kind),
      order: Number(item.order) || 0,
      text: text(item.text),
      assetId: text(item.assetId),
      fileId: text(item.fileId),
      imageSource: DETAIL_IMAGE_SOURCES.includes(item.imageSource) ? item.imageSource : 'manual_upload',
      sourceConfirmed: item.sourceConfirmed === true
    }))
  const sizeRows = normalizeSizeRows(draft.sizeRows)
  return {
    detailPageId: text(draft.detailPageId),
    ownerId: text(draft.ownerId),
    enterpriseId: text(draft.enterpriseId),
    projectId: text(draft.projectId),
    productId: text(draft.productId),
    productProfileVersion: Math.max(0, Number(draft.productProfileVersion) || 0),
    sizeChartId: text(draft.sizeChartId),
    contentSnapshotId: text(draft.contentSnapshotId),
    productProfileSnapshot: draft.productProfileSnapshot ? JSON.parse(JSON.stringify(draft.productProfileSnapshot)) : null,
    taskType: DETAIL_PAGE_TASK_TYPE,
    templateId: template.id,
    templateVersion: template.version || DETAIL_PAGE_TEMPLATE_VERSION,
    platform: platform.id,
    width: platform.width || DETAIL_PAGE_RENDER_WIDTH,
    modules,
    contentVersion: Math.max(0, Number(draft.contentVersion) || 0),
    assetClassifications: (Array.isArray(draft.assetClassifications) ? draft.assetClassifications : []).map((item) => ({ ...item })),
    productFacts: (Array.isArray(draft.productFacts) ? draft.productFacts : []).map((item) => ({ ...item })),
    generatedCopy: (Array.isArray(draft.generatedCopy) ? draft.generatedCopy : []).map((item) => ({ ...item, sourceFieldIds: [...(item.sourceFieldIds || [])] })),
    confirmationStatus: text(draft.confirmationStatus) || 'not_organized',
    unresolvedFields: (Array.isArray(draft.unresolvedFields) ? draft.unresolvedFields : []).map((item) => ({ ...item })),
    contentVersions: (Array.isArray(draft.contentVersions) ? draft.contentVersions : []).map((item) => ({ ...item })),
    status: text(draft.status) || 'draft',
    previewUrl: text(draft.previewUrl),
    renderedAssetIds: Array.isArray(draft.renderedAssetIds) ? draft.renderedAssetIds.map(text).filter(Boolean) : [],
    createdAt: text(draft.createdAt),
    updatedAt: text(draft.updatedAt),
    platformId: platform.id,
    moduleOrder: modules.map((item) => item.id),
    contentSnapshot: modules,
    sizeChartSnapshot: {
      rows: sizeRows,
      unit: text(draft.sizeUnit) || (sizeRows[0] || {}).unit || 'cm',
      measurementNote: text(draft.measurementNote),
      attachmentFileId: text((draft.sizeAttachment || {}).fileId),
      source: text(draft.sizeSource) || 'manual',
      confirmedByUser: !sizeRows.length || sizeRows.every((row) => row.confirmedByUser)
    },
    sourceAssetIds: Array.from(new Set([
      text((draft.primaryAsset || {}).assetId),
      ...(Array.isArray(draft.assets) ? draft.assets.map((item) => text(item.assetId)) : []),
      text((draft.sizeAttachment || {}).assetId)
    ].filter(Boolean))),
    editorSnapshot: {
      primaryAsset: { ...(draft.primaryAsset || {}) },
      assets: (Array.isArray(draft.assets) ? draft.assets : []).map((item) => ({ ...item })),
      modules: (Array.isArray(draft.modules) ? draft.modules : []).map((item) => ({ ...item, layout: { ...(item.layout || {}) } })),
      sizeRows: sizeRows.map((row) => ({ ...row })),
      sizeAttachment: { ...(draft.sizeAttachment || {}) },
      sizeSource: text(draft.sizeSource) || 'manual',
      sizeUnit: text(draft.sizeUnit) || 'cm',
      measurementNote: text(draft.measurementNote),
      productFactInputs: { ...(draft.productFactInputs || {}) },
      productId: text(draft.productId),
      productProfileVersion: Math.max(0, Number(draft.productProfileVersion) || 0),
      sizeChartId: text(draft.sizeChartId),
      contentSnapshotId: text(draft.contentSnapshotId),
      productProfileSnapshot: draft.productProfileSnapshot ? JSON.parse(JSON.stringify(draft.productProfileSnapshot)) : null,
      recommendedModuleIds: Array.isArray(draft.recommendedModuleIds) ? [...draft.recommendedModuleIds] : [],
      currentStep: Math.min(3, Math.max(0, Number(draft.currentStep) || 0))
    },
    render: {
      width: platform.width || DETAIL_PAGE_RENDER_WIDTH,
      maxSegmentHeight: DETAIL_PAGE_MAX_SEGMENT_HEIGHT,
      direction: 'vertical',
      allowGrid: false,
      preserveOriginalGarment: true,
      density: platform.density,
      template: { ...template }
    }
  }
}

export function isLegacyInvalidDetailPageTask(task = {}) {
  const type = text(task.taskType || task.type || ((task.input || {}).params || {}).taskType)
  if (!/detail_long_image|detail_page|page_material/i.test(type)) return false
  if (type === DETAIL_PAGE_TASK_TYPE && ((task.result || {}).meta || {}).renderer === 'deterministic_canvas') return false
  const input = task.input || {}
  const params = input.params || {}
  const options = input.options || {}
  const prompt = [params.promptDraft, params.negativePrompt, params.fullAdvancedPromptSummary].join(' ').toLowerCase()
  const hasUnsafeLayout = /grid|collage|four-panel|four-grid|contact sheet|moodboard|multi-panel|九宫格|四宫格|拼贴/.test(prompt) || options.layoutStyle === 'multi_image'
  const hasUnverifiedSize = Boolean(options.includeSizeChart || params.includeSizeChart) && !((params.sizeChartSnapshot || {}).confirmedByUser)
  return hasUnsafeLayout || hasUnverifiedSize || type !== DETAIL_PAGE_TASK_TYPE
}
