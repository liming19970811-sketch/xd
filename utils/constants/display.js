import { LEAD_FOLLOW_STATUS } from './lead'
import { ORDER_STATUS, PAY_STATUS } from './order'
import { PROJECT_STATUS } from './project'
import { TASK_STATUS } from './task'

function createDisplayItems(definitions) {
  return Object.freeze(definitions.map((item) => Object.freeze({ value: item.value, label: item.label })))
}

function createLabelMap(items) {
  return Object.freeze(
    items.reduce((result, item) => {
      result[item.value] = item.label
      return result
    }, {})
  )
}

export const LEAD_FOLLOW_STATUS_DISPLAY = createDisplayItems([
  { value: LEAD_FOLLOW_STATUS.NEW, label: '新线索' },
  { value: LEAD_FOLLOW_STATUS.CONTACTED, label: '已联系' },
  { value: LEAD_FOLLOW_STATUS.QUALIFYING, label: '评估中' },
  { value: LEAD_FOLLOW_STATUS.QUALIFIED, label: '已确认有效' },
  { value: LEAD_FOLLOW_STATUS.PROPOSAL, label: '方案沟通' },
  { value: LEAD_FOLLOW_STATUS.CONVERTED, label: '已转项目' },
  { value: LEAD_FOLLOW_STATUS.CLOSED, label: '已关闭' }
])

export const PROJECT_STATUS_DISPLAY = createDisplayItems([
  { value: PROJECT_STATUS.PENDING, label: '待确认' },
  { value: PROJECT_STATUS.CONFIRMED, label: '已确认' },
  { value: PROJECT_STATUS.IN_PROGRESS, label: '进行中' },
  { value: PROJECT_STATUS.REVIEWING, label: '审核中' },
  { value: PROJECT_STATUS.COMPLETED, label: '已完成' },
  { value: PROJECT_STATUS.CLOSED, label: '已关闭' }
])

export const PROJECT_STAGE_DISPLAY = createDisplayItems([
  { value: 'requirement_confirmed', label: '需求已确认' },
  { value: 'quoted', label: '已报价' },
  { value: 'designing', label: '设计中' },
  { value: 'first_draft_ready', label: '初稿已出' },
  { value: 'revising', label: '修改中' },
  { value: 'final_delivery', label: '最终交付' },
  { value: 'closed', label: '已关闭' }
])

export const ORDER_STATUS_DISPLAY = createDisplayItems([
  { value: ORDER_STATUS.CREATED, label: '已创建' },
  { value: ORDER_STATUS.PENDING, label: '待处理' },
  { value: ORDER_STATUS.CONFIRMED, label: '已确认' },
  { value: ORDER_STATUS.PROCESSING, label: '处理中' },
  { value: ORDER_STATUS.COMPLETED, label: '已完成' },
  { value: ORDER_STATUS.CLOSED, label: '已关闭' },
  { value: ORDER_STATUS.CANCELLED, label: '已取消' }
])

export const PAY_STATUS_DISPLAY = createDisplayItems([
  { value: PAY_STATUS.UNPAID, label: '未支付' },
  { value: PAY_STATUS.PENDING, label: '支付中' },
  { value: PAY_STATUS.PAID, label: '已支付' },
  { value: PAY_STATUS.FAILED, label: '支付失败' },
  { value: PAY_STATUS.REFUNDED, label: '已退款' }
])

export const TASK_STATUS_DISPLAY = createDisplayItems([
  { value: TASK_STATUS.DRAFT, label: '编辑中' },
  { value: TASK_STATUS.PENDING, label: '待处理' },
  { value: TASK_STATUS.SUBMITTED, label: '已提交' },
  { value: TASK_STATUS.QUEUED, label: '排队中' },
  { value: TASK_STATUS.PROCESSING, label: '生成中' },
  { value: TASK_STATUS.SUCCESS, label: '已完成' },
  { value: TASK_STATUS.FAILED, label: '失败' },
  { value: TASK_STATUS.TIMEOUT, label: '超时' }
])

export const LEAD_FOLLOW_STATUS_LABEL_MAP = createLabelMap(LEAD_FOLLOW_STATUS_DISPLAY)
export const PROJECT_STATUS_LABEL_MAP = createLabelMap(PROJECT_STATUS_DISPLAY)
export const PROJECT_STAGE_LABEL_MAP = createLabelMap(PROJECT_STAGE_DISPLAY)
export const ORDER_STATUS_LABEL_MAP = createLabelMap(ORDER_STATUS_DISPLAY)
export const PAY_STATUS_LABEL_MAP = createLabelMap(PAY_STATUS_DISPLAY)
export const TASK_STATUS_LABEL_MAP = createLabelMap(TASK_STATUS_DISPLAY)
