const ACTION_LABELS = Object.freeze({
  model_replace: 'AI换模特',
  ai_model_image: 'AI模特图',
  face_replace: 'AI换脸',
  head_replace: 'AI换头',
  scene_replace: 'AI换场景',
  pose_replace: 'AI换姿势',
  pose_adjust: 'AI换姿势',
  pose_variation: 'AI换姿势',
  basic_background: 'AI换场景',
  color_replace: '服装换色',
  basic_recolor: '服装换色',
  color_batch: '批量换色',
  fabric_replace: '服装换面料',
  pattern_replace: '服装换图案',
  refine: '爆款改款',
  hot_style_remix: '爆款改款',
  text_to_sketch: '文字生成款式',
  image_to_sketch: '图片转结构稿',
  sketch_remix: '线稿改款',
  sketch_to_model: '线稿效果图',
  batch_model: '批量模特图',
  runway_video: '走秀视频',
  runway_video_3s: '走秀视频',
  runway_video_5s: '走秀视频',
  runway_video_10s: '走秀视频',
  detail_closeup: '平铺细节图',
  detail_long_image: '商品详情页',
  print_generate: '图案生成',
  print_placement: '图案应用'
})

const STATUS_META = Object.freeze({
  consumed: Object.freeze({ label: '已扣除', tone: 'consumed' }),
  finalized: Object.freeze({ label: '已完成', tone: 'completed' }),
  rolled_back: Object.freeze({ label: '已退回', tone: 'returned' }),
  failed: Object.freeze({ label: '失败', tone: 'failed' }),
  pending: Object.freeze({ label: '处理中', tone: 'pending' }),
  checked: Object.freeze({ label: '已校验', tone: 'pending' })
})

function toOptionalNumber(value) {
  if (value === undefined || value === null || value === '') return null
  const number = Number(value)
  return Number.isFinite(number) && number >= 0 ? number : null
}

function isDevelopment() {
  try {
    if (typeof wx !== 'undefined' && wx && typeof wx.getAccountInfoSync === 'function') {
      const info = wx.getAccountInfoSync()
      return info && info.miniProgram && info.miniProgram.envVersion === 'develop'
    }
  } catch (error) {
    // Fall through to the compile-time environment check.
  }
  try {
    return typeof process !== 'undefined' && ['development', 'dev'].includes(String(process.env && process.env.NODE_ENV || '').toLowerCase())
  } catch (error) {
    return false
  }
}

export function formatMembershipDate(value = '', includeTime = false) {
  if (!value) return ''
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return ''
  const pad = (number) => String(number).padStart(2, '0')
  const day = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
  return includeTime ? `${day} ${pad(date.getHours())}:${pad(date.getMinutes())}` : day
}

export function getResetDescription(usage = {}, plan = {}) {
  const resetDate = formatMembershipDate(usage.resetAt)
  if (resetDate) return `额度将在${resetDate}重置`
  const expiresDate = formatMembershipDate(usage.expiresAt)
  if (expiresDate) return `额度有效期至${expiresDate}`
  const cycle = String(usage.periodType || plan.billingCycle || '').toLowerCase()
  if (cycle === 'monthly' || cycle === 'month') return '额度按月重置'
  if (cycle === 'yearly' || cycle === 'year') return '额度按年重置'
  return '额度规则请查看套餐说明'
}

export function buildMembershipDisplay(usage = {}, plan = {}) {
  const total = toOptionalNumber(usage.total)
  const used = toOptionalNumber(usage.used)
  const remaining = toOptionalNumber(usage.remaining)
  const available = usage.available === true && usage.isFallback !== true && total !== null && used !== null && remaining !== null
  const safeTotal = available ? total : 0
  const safeUsed = available ? Math.min(safeTotal, used) : 0
  const safeRemaining = available ? Math.max(0, safeTotal - safeUsed) : 0
  return {
    available,
    total: safeTotal,
    used: safeUsed,
    remaining: safeRemaining,
    usedPercent: safeTotal > 0 ? Math.min(100, Math.round((safeUsed / safeTotal) * 100)) : 0,
    resetText: getResetDescription(usage, plan),
    statusText: usage.status === 'inactive' ? '已停用' : '使用中',
    isMock: usage.mock === true,
    mockLabel: usage.mock === true && isDevelopment() ? '开发测试额度' : ''
  }
}

export function getUsageActionLabel(action = '') {
  const key = String(action || '').trim().toLowerCase()
  const label = ACTION_LABELS[key]
  if (!label && key && isDevelopment() && typeof console !== 'undefined' && typeof console.info === 'function') {
    console.info('[membership:unknown-action]', { hasAction: true })
  }
  return label || '其他AI服务'
}

export function getUsageStatusMeta(status = '') {
  return STATUS_META[String(status || '').trim().toLowerCase()] || { label: '状态确认中', tone: 'pending' }
}

export function getUsageDelta(record = {}) {
  const value = toOptionalNumber(record.costValue) || 0
  const status = String(record.status || '').toLowerCase()
  const returned = status === 'rolled_back' || String(record.action || '').toLowerCase() === 'rollbackusage'
  if (returned) return { value, text: `+${value}点`, tone: 'returned' }
  if (['consumed', 'finalized'].includes(status)) return { value: -value, text: `-${value}点`, tone: 'consumed' }
  return { value: 0, text: '0点', tone: 'neutral' }
}
