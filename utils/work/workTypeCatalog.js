export const WORK_CATEGORIES = Object.freeze([
  Object.freeze({ id: 'model_outfit', label: '模特与穿搭' }),
  Object.freeze({ id: 'product_display', label: '商品展示' }),
  Object.freeze({ id: 'fashion_design', label: '服装设计' }),
  Object.freeze({ id: 'pattern_making', label: '结构与版型' }),
  Object.freeze({ id: 'marketing', label: '营销素材' }),
  Object.freeze({ id: 'video_dynamic', label: '视频与动态' })
])

const WORK_TYPE_RULES = Object.freeze([
  Object.freeze({ key: 'batch_model', label: '批量模特图', category: 'model_outfit', pattern: /batch_model|model_batch/ }),
  Object.freeze({ key: 'clothes_replace', label: 'AI换衣服', category: 'model_outfit', pattern: /garment_replace|clothes_replace|outfit_replace|virtual_try_on/ }),
  Object.freeze({ key: 'pose_replace', label: 'AI换姿势', category: 'model_outfit', pattern: /pose_replace|pose_adjust|pose_variation|pose_variant|pose_change/ }),
  Object.freeze({ key: 'head_replace', label: 'AI模特', category: 'model_outfit', pattern: /model_replace|ai_model|head_replace|face_replace|model_image/ }),
  Object.freeze({ key: 'detail_long_image', label: '自动排版详情长图', category: 'product_display', pattern: /detail_page_long_image|detail_long_image|detail_page|page_material|product_page/ }),
  Object.freeze({ key: 'garment_detail_batch', label: '服装细节图', category: 'product_display', pattern: /garment_detail_/ }),
  Object.freeze({ key: 'flat_lay', label: '平铺细节', category: 'product_display', pattern: /flat_lay|detail_closeup/ }),
  Object.freeze({ key: 'white_background', label: '商品白底图', category: 'product_display', pattern: /white_background|ecommerce_main/ }),
  Object.freeze({ key: 'scene_replace', label: '换场景', category: 'product_display', pattern: /scene_replace|replace_scene|scene_change|background_replace|basic_background/ }),
  Object.freeze({ key: 'display_image', label: '服装展示图', category: 'product_display', pattern: /display_image|garment_display/ }),
  Object.freeze({ key: 'style_redesign', label: '改款式', category: 'fashion_design', pattern: /style_redesign|hot_style|micro_redesign|sketch_remix|refine/ }),
  Object.freeze({ key: 'color_replace', label: '换颜色', category: 'fashion_design', pattern: /color_replace|basic_recolor|color_batch|color_change/ }),
  Object.freeze({ key: 'fabric_variation', label: '换面料', category: 'fashion_design', pattern: /fabric_replace|fabric_variation/ }),
  Object.freeze({ key: 'pattern_replace', label: '换图案', category: 'fashion_design', pattern: /pattern_replace|pattern_variation|print_generate|print_placement/ }),
  Object.freeze({ key: 'sketch_to_model', label: '线稿效果图', category: 'fashion_design', pattern: /sketch_to_model|sketch_render/ }),
  Object.freeze({ key: 'text_to_sketch', label: '文字生成款式图', category: 'fashion_design', pattern: /text_to_sketch|style_draft/ }),
  Object.freeze({ key: 'pattern_structure', label: '打版结构图', category: 'pattern_making', pattern: /pattern_structure_generate|pattern_structure_|pattern_making/ }),
  Object.freeze({ key: 'image_to_sketch', label: '图片转结构稿', category: 'pattern_making', pattern: /image_to_sketch|structure_sketch/ }),
  Object.freeze({ key: 'marketing_image', label: '营销素材', category: 'marketing', pattern: /marketing|poster|xiaohongshu|campaign|selling_point/ }),
  Object.freeze({ key: 'runway_video', label: '走秀视频', category: 'video_dynamic', pattern: /runway_video|short_video|dynamic_display|video/ })
])

function text(value = '') {
  return String(value || '').trim()
}

export function buildWorkTypeSource(task = {}) {
  const input = task.input || {}
  const params = input.params || task.params || {}
  const options = input.options || {}
  return [
    task.workType,
    task.taskType,
    task.type,
    task.actionType,
    task.toolType,
    task.entryScene,
    task.outputType,
    params.itemType,
    params.actionType,
    params.taskType,
    params.toolType,
    params.entryScene,
    params.outputType,
    options.outputType
  ].map(text).filter(Boolean).join(' ').toLowerCase()
}

export function resolveWorkType(task = {}) {
  const source = buildWorkTypeSource(task)
  const matched = WORK_TYPE_RULES.find((rule) => rule.pattern.test(source))
  if (matched) return { key: matched.key, label: matched.label, category: matched.category }
  return { key: text(task.workType || task.taskType || task.type) || 'generated_asset', label: 'AI生成作品', category: 'product_display' }
}

export function getWorkCategoryLabel(category = '') {
  const found = WORK_CATEGORIES.find((item) => item.id === category)
  return found ? found.label : '商品展示'
}

export function getAvailableWorkCategories(works = []) {
  const available = new Set((Array.isArray(works) ? works : []).map((work) => work.category).filter(Boolean))
  return WORK_CATEGORIES.filter((item) => available.has(item.id))
}

export { WORK_TYPE_RULES }
