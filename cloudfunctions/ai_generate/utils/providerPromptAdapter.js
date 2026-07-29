const PROVIDER_TASK_TYPE_MAP = Object.freeze({
  identity_replace: 'identity_replace',
  head_replace: 'identity_replace',
  face_replace: 'identity_replace',
  virtual_try_on: 'virtual_try_on',
  garment_replace: 'virtual_try_on',
  top_replace: 'virtual_try_on',
  bottom_replace: 'virtual_try_on',
  full_outfit_replace: 'virtual_try_on',
  scene_replace: 'scene_replace',
  pose_replace: 'pose_replace',
  color_replace: 'image_edit_recolor',
  pattern_replace: 'image_edit_print_placement',
  style_remix: 'style_remix_image',
  micro_redesign: 'style_remix_image',
  product_display: 'product_display',
  flat_lay: 'flat_lay',
  flat_lay_generate: 'flat_lay',
  detail_image: 'image_enhance_closeup',
  detail_photo_generate: 'image_enhance_closeup',
  batch_model: 'batch_model',
  fabric_replace: 'image_edit_fabric_replace',
  fabricReplace: 'image_edit_fabric_replace',
  print_generate: 'image_generate_print',
  print_placement: 'image_edit_print_placement',
  color_batch: 'image_edit_recolor',
  basic_recolor: 'image_edit_recolor',
  detail_long_image: 'image_layout_detail_long_image',
  detail_page_from_photo: 'image_layout_detail_long_image',
  detail_closeup: 'image_enhance_closeup',
  sketch_to_model: 'sketch_to_model_image',
  image_to_sketch: 'image_to_structure_sketch',
  hot_style_remix: 'style_remix_image',
  runway_video_3s: 'image_to_runway_video',
  runway_video_5s: 'image_to_runway_video',
  runway_video_10s: 'image_to_runway_video'
})

const PROMPT_VERSION = 'p4_provider_prompt_adapter_v1'

const BASE_TASK_PROMPTS = Object.freeze({
  image_edit_fabric_replace: '请对服装图片进行面料替换，保持原有版型、结构、褶皱和穿着效果。',
  image_generate_print: '请生成适合服装上新的印花图案，保持图案清晰、可用于后续贴图预览。',
  image_edit_print_placement: '请将印花自然贴合到衣身指定位置，保持衣服结构、透视和材质一致。',
  image_edit_recolor: '请对服装进行同款换色或批量配色预览，保持版型、材质和光影稳定。',
  image_layout_detail_long_image: '请基于服装素材生成适合上新的详情长图结构，突出主图、场景图和细节图层次。',
  image_enhance_closeup: '请生成服装局部细节增强图，突出领口、袖口、面料纹理、纽扣拉链或印花细节。',
  sketch_to_model_image: '请将设计稿或线稿生成服装上身参考图，保持原始设计结构和款式重点。',
  image_to_structure_sketch: '请将服装图片转换为清晰结构线稿，强调轮廓、领口、袖口、口袋、省道等结构信息。',
  style_remix_image: '请基于服装款式进行辅助改款参考，保持商业上新所需的清晰结构和合理版型。',
  image_to_runway_video: '请基于服装图生成自然走秀短片，保持服装款式、材质和人物比例稳定。',
  generic_fashion_image: '请基于服装图片和业务参数生成清晰、稳定、适合上新的服装 AI 输出。'
})

const BASE_NEGATIVE_PROMPT =
  '避免低清晰度、变形人体、错误手部、多余肢体、衣服结构错乱、面料纹理破碎、印花漂浮、文字水印、品牌 logo、过度磨皮、背景脏乱、商品主体缺失。'

const TASK_NEGATIVE_PROMPTS = Object.freeze({
  image_edit_fabric_replace: '避免改变衣服版型、避免破坏原有褶皱、避免面料贴图漂浮。',
  image_to_runway_video: '避免人物闪烁、衣摆穿模、背景跳变、脸部变形、动作僵硬。',
  image_to_structure_sketch: '避免线稿断裂、结构标注错误、过度阴影、照片质感残留。'
})

function firstNonEmpty(values = []) {
  return values.find((value) => value !== undefined && value !== null && value !== '') || ''
}

function resolveProviderTaskType(input = {}) {
  const key = firstNonEmpty([
    input.costActionType,
    input.actionType,
    input.taskType,
    input.templateType,
    input.entryScene,
    input.action
  ])
  return PROVIDER_TASK_TYPE_MAP[key] || 'generic_fashion_image'
}

function buildBaseParamSummary(input = {}) {
  const parts = [
    ['templateType', input.templateType],
    ['styleCode', input.styleCode],
    ['sceneCode', input.sceneCode],
    ['bodyType', input.bodyType],
    ['costActionType', input.costActionType]
  ]
    .filter((item) => item[1] !== undefined && item[1] !== null && item[1] !== '')
    .map((item) => `${item[0]}=${item[1]}`)

  return parts.length ? `基础参数：${parts.join('；')}` : '基础参数：使用默认业务参数。'
}

function buildProviderPromptPayload(input = {}) {
  const providerTaskType = resolveProviderTaskType(input)
  const fullAdvancedPromptSummary = String(input.fullAdvancedPromptSummary || '').trim()
  const advancedCustomPrompts = input.advancedCustomPrompts || {}
  const advancedOptionPrompts = input.advancedOptionPrompts || {}

  const positivePrompt = [
    BASE_TASK_PROMPTS[providerTaskType] || BASE_TASK_PROMPTS.generic_fashion_image,
    buildBaseParamSummary(input),
    fullAdvancedPromptSummary || '使用默认高级参数。',
    '请保持服装主体清晰，避免夸张变形，避免不合理肢体、错位纽扣、破碎纹理、文字水印和品牌标识。'
  ].join('\n')

  const taskNegativePrompt = TASK_NEGATIVE_PROMPTS[providerTaskType] || ''
  const negativePrompt = [BASE_NEGATIVE_PROMPT, taskNegativePrompt].filter(Boolean).join('\n')

  const promptMeta = {
    promptVersion: PROMPT_VERSION,
    providerTaskType,
    hasFullAdvancedPromptSummary: !!fullAdvancedPromptSummary,
    fullAdvancedPromptSummaryLength: fullAdvancedPromptSummary.length,
    advancedCustomPromptCount: Object.keys(advancedCustomPrompts).length,
    advancedOptionPromptCount: Object.keys(advancedOptionPrompts).length,
    positivePromptLength: positivePrompt.length,
    negativePromptLength: negativePrompt.length,
    costActionType: input.costActionType || ''
  }

  return {
    providerTaskType,
    positivePrompt,
    negativePrompt,
    promptMeta
  }
}

module.exports = {
  buildProviderPromptPayload,
  PROMPT_VERSION
}
