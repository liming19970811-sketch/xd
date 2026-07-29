import { AI_POINT_COST_CONFIG } from './aiPointCost'

export const COST_ACTION_TYPE_MAP = Object.freeze({
  text_to_sketch: 'sketch_to_model',
  sketch_remix: 'hot_style_remix',
  color_batch: 'basic_recolor',
  detail_page_from_photo: 'detail_long_image',
  sketch_to_tech_pack: 'image_to_sketch',

  basic_background: 'basic_background',
  basic_recolor: 'basic_recolor',
  fabric_replace: 'fabric_replace',
  detail_closeup: 'detail_closeup',
  print_generate: 'print_generate',
  print_placement: 'print_placement',
  sketch_to_model: 'sketch_to_model',
  ai_model_image: 'ai_model_image',
  image_to_sketch: 'image_to_sketch',
  hot_style_remix: 'hot_style_remix',
  detail_long_image: 'detail_long_image',
  runway_video_3s: 'runway_video_3s',
  runway_video_5s: 'runway_video_5s',
  runway_video_10s: 'runway_video_10s'
})

function normalizeDurationSec(durationSec) {
  const normalized = Number(durationSec || 3)
  if (normalized === 5) {
    return 5
  }
  if (normalized === 10) {
    return 10
  }
  return 3
}

export function resolveCostActionType(input = '', options = {}) {
  if (options.costActionType) {
    return options.costActionType
  }

  const rawActionType = String(input || '').trim()
  if (rawActionType === 'runway_video') {
    return `runway_video_${normalizeDurationSec(options.durationSec)}s`
  }
  if (/^runway_video_(3|5|10)s$/.test(rawActionType)) {
    return rawActionType
  }

  return COST_ACTION_TYPE_MAP[rawActionType] || rawActionType
}

export function isKnownCostActionType(actionType = '') {
  return Object.prototype.hasOwnProperty.call(AI_POINT_COST_CONFIG, actionType)
}
