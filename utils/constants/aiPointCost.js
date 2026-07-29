export const AI_POINT_ACTION_TYPES = Object.freeze({
  BASIC_BACKGROUND: 'basic_background',
  BASIC_RECOLOR: 'basic_recolor',
  FABRIC_REPLACE: 'fabric_replace',
  DETAIL_CLOSEUP: 'detail_closeup',
  PRINT_GENERATE: 'print_generate',
  PRINT_PLACEMENT: 'print_placement',
  SKETCH_TO_MODEL: 'sketch_to_model',
  AI_MODEL_IMAGE: 'ai_model_image',
  IMAGE_TO_SKETCH: 'image_to_sketch',
  HOT_STYLE_REMIX: 'hot_style_remix',
  DETAIL_LONG_IMAGE: 'detail_long_image',
  RUNWAY_VIDEO_3S: 'runway_video_3s',
  RUNWAY_VIDEO_5S: 'runway_video_5s',
  RUNWAY_VIDEO_10S: 'runway_video_10s'
})

export const AI_POINT_COST_CONFIG = Object.freeze({
  [AI_POINT_ACTION_TYPES.BASIC_BACKGROUND]: 1,
  [AI_POINT_ACTION_TYPES.BASIC_RECOLOR]: 1,
  [AI_POINT_ACTION_TYPES.FABRIC_REPLACE]: 2,
  [AI_POINT_ACTION_TYPES.DETAIL_CLOSEUP]: 2,
  [AI_POINT_ACTION_TYPES.PRINT_GENERATE]: 3,
  [AI_POINT_ACTION_TYPES.PRINT_PLACEMENT]: 4,
  [AI_POINT_ACTION_TYPES.SKETCH_TO_MODEL]: 5,
  [AI_POINT_ACTION_TYPES.AI_MODEL_IMAGE]: 5,
  [AI_POINT_ACTION_TYPES.IMAGE_TO_SKETCH]: 5,
  [AI_POINT_ACTION_TYPES.HOT_STYLE_REMIX]: 6,
  [AI_POINT_ACTION_TYPES.DETAIL_LONG_IMAGE]: 3,
  [AI_POINT_ACTION_TYPES.RUNWAY_VIDEO_3S]: 25,
  [AI_POINT_ACTION_TYPES.RUNWAY_VIDEO_5S]: 45,
  [AI_POINT_ACTION_TYPES.RUNWAY_VIDEO_10S]: 90
})

export function getAiPointCost(actionType = '', options = {}) {
  const baseCost = AI_POINT_COST_CONFIG[actionType] || 0
  const count = Math.max(1, Number(options.count || 1) || 1)
  return baseCost * count
}

export function isKnownAiPointActionType(actionType = '') {
  return Object.prototype.hasOwnProperty.call(AI_POINT_COST_CONFIG, actionType)
}

export function getAiPointCostStrict(actionType = '', options = {}) {
  if (!isKnownAiPointActionType(actionType)) {
    return {
      ok: false,
      costValue: 0,
      reason: 'unknown_action_type',
      reasonText: '未知扣点类型'
    }
  }

  return {
    ok: true,
    costValue: getAiPointCost(actionType, options),
    reason: '',
    reasonText: ''
  }
}
