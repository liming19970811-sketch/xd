import { getCurrentUser } from '../user/userRepository'
import { formatMembershipDate, getUsageActionLabel, getUsageDelta, getUsageStatusMeta } from './membershipDisplay'

const RECORDS_COLLECTION = 'membership_usage_records'
const DEFAULT_PAGE_SIZE = 20

function getRealOpenId() {
  const user = getCurrentUser()
  const openId = String(user && user.openId || '').trim()
  return openId && !openId.startsWith('mock_') ? openId : ''
}

function getStatusFilter(filter = 'all') {
  if (filter === 'returned') return ['rolled_back']
  if (filter === 'consumed') return ['consumed', 'finalized']
  return []
}

function normalizeRecord(record = {}) {
  const statusMeta = getUsageStatusMeta(record.status)
  const delta = getUsageDelta(record)
  const taskId = String(record.sourceTaskId || record.extensionTaskId || '').trim()
  return {
    id: String(record.recordId || record._id || `${record.createdAt || ''}_${record.actionType || record.action || ''}`),
    actionLabel: getUsageActionLabel(record.costActionType || record.actionType || record.action),
    status: String(record.status || ''),
    statusLabel: statusMeta.label,
    statusTone: statusMeta.tone,
    deltaText: delta.text,
    deltaTone: delta.tone,
    createdAt: String(record.createdAt || record.updatedAt || ''),
    timeLabel: formatMembershipDate(record.createdAt || record.updatedAt, true) || '时间同步中',
    taskId,
    hasTask: Boolean(taskId)
  }
}

function buildError(errorCode = 'usage_records_read_failed', message = '额度明细暂时无法获取') {
  return { ok: false, status: 'error', data: [], hasMore: false, nextPage: 1, errorCode, message }
}

export async function getUsageRecords({ page = 1, pageSize = DEFAULT_PAGE_SIZE, filter = 'all' } = {}) {
  const openId = getRealOpenId()
  if (!openId) return buildError('identity_required', '登录后查看额度明细')
  if (
    typeof wx === 'undefined' ||
    !wx ||
    !wx.cloud ||
    typeof wx.cloud.database !== 'function'
  ) return buildError('cloud_database_unavailable')

  const safePage = Math.max(1, Number(page) || 1)
  const safePageSize = Math.min(50, Math.max(1, Number(pageSize) || DEFAULT_PAGE_SIZE))
  try {
    const db = wx.cloud.database()
    const statusFilter = getStatusFilter(filter)
    const where = { openid: openId }
    if (statusFilter.length) where.status = db.command.in(statusFilter)
    const response = await db.collection(RECORDS_COLLECTION)
      .where(where)
      .orderBy('createdAt', 'desc')
      .skip((safePage - 1) * safePageSize)
      .limit(safePageSize)
      .get()
    const rawRecords = response && Array.isArray(response.data) ? response.data : []
    const records = rawRecords
      .filter((record) => String(record.openid || '') === openId)
      .map(normalizeRecord)
    return {
      ok: true,
      status: 'success',
      data: records,
      hasMore: rawRecords.length === safePageSize,
      nextPage: safePage + 1,
      errorCode: '',
      message: ''
    }
  } catch (error) {
    return buildError('usage_records_read_failed')
  }
}
