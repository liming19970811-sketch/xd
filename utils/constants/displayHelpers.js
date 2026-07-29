import {
  LEAD_FOLLOW_STATUS_LABEL_MAP,
  ORDER_STATUS_LABEL_MAP,
  PAY_STATUS_LABEL_MAP,
  PROJECT_STAGE_LABEL_MAP,
  PROJECT_STATUS_LABEL_MAP,
  TASK_STATUS_LABEL_MAP
} from './display'

const DISPLAY_LABEL_MAPS = Object.freeze({
  leadFollowStatus: LEAD_FOLLOW_STATUS_LABEL_MAP,
  projectStatus: PROJECT_STATUS_LABEL_MAP,
  projectStage: PROJECT_STAGE_LABEL_MAP,
  orderStatus: ORDER_STATUS_LABEL_MAP,
  payStatus: PAY_STATUS_LABEL_MAP,
  taskStatus: TASK_STATUS_LABEL_MAP
})

const DISPLAY_FALLBACK_LABELS = Object.freeze({
  leadFollowStatus: '新线索',
  projectStatus: '待确认',
  projectStage: '需求已确认',
  orderStatus: '待处理',
  payStatus: '未支付',
  taskStatus: '待处理'
})

export function getDisplayLabel(type, value) {
  const labelMap = DISPLAY_LABEL_MAPS[type]
  if (!labelMap) {
    return value || ''
  }

  return labelMap[value] || value || DISPLAY_FALLBACK_LABELS[type] || ''
}

export function getLeadFollowStatusLabel(value) {
  return getDisplayLabel('leadFollowStatus', value)
}

export function getProjectStatusLabel(value) {
  return getDisplayLabel('projectStatus', value)
}

export function getProjectStageLabel(value) {
  return getDisplayLabel('projectStage', value)
}

export function getOrderStatusLabel(value) {
  return getDisplayLabel('orderStatus', value)
}

export function getPayStatusLabel(value) {
  return getDisplayLabel('payStatus', value)
}

export function getTaskStatusLabel(value) {
  return getDisplayLabel('taskStatus', value)
}
