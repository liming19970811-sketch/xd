import { getMainChainState } from '../mainChainState'
import { getMembershipUsage } from '../member/membershipRepository'
import { getCurrentUser } from '../user/userRepository'
import { getMyWorks } from '../work/workRepository'
import { getTaskCenterSnapshot } from '../workspace/productionRecordRepository'

const DRAFT_MAX_AGE = 7 * 24 * 60 * 60 * 1000

const TOOL_DRAFTS = Object.freeze([
  { key: 'diebiandesign_style_redesign_draft_v1', id: 'style_redesign', name: '微改款', toolType: 'refine', timeKeys: ['updatedAt', 'savedAt'] },
  { key: 'diebiandesign_color_redesign_draft_v1', id: 'color_replace', name: '换颜色', toolType: 'color', timeKeys: ['savedAt', 'updatedAt'] },
  { key: 'diebiandesign_pattern_redesign_draft_v1', id: 'pattern_replace', name: '换图案', toolType: 'pattern', timeKeys: ['savedAt', 'updatedAt'] },
  { key: 'diebiandesign_display_image_draft_v1', id: 'display_image', name: '服装展示图', toolType: 'flat_lay', timeKeys: ['savedAt', 'updatedAt'] },
  { key: 'diebiandesign_detail_image_draft_v1', id: 'detail_image', name: '服装细节图', toolType: 'detail_photo', timeKeys: ['savedAt', 'updatedAt'] },
  { key: 'diebiandesign_pose_replace_draft_v1', id: 'pose_replace', name: 'AI换姿势', route: '/package-ai/change-pose/change-pose', timeKeys: ['updatedAt'] }
])

function text(value = '') {
  return String(value || '').trim()
}

function readStorage(key = '') {
  try {
    return typeof uni !== 'undefined' && uni && typeof uni.getStorageSync === 'function'
      ? uni.getStorageSync(key)
      : null
  } catch (error) {
    return null
  }
}

function getDraftTime(draft = {}, keys = []) {
  for (const key of keys) {
    const value = Number(draft[key] || 0)
    if (Number.isFinite(value) && value > 0) return value
    const timestamp = Date.parse(draft[key] || '')
    if (Number.isFinite(timestamp)) return timestamp
  }
  return 0
}

function hasDraftContent(draft = {}) {
  if (!draft || typeof draft !== 'object') return false
  return Object.keys(draft).some((key) => {
    if (['version', 'schemaVersion', 'savedAt', 'updatedAt'].includes(key)) return false
    const value = draft[key]
    if (Array.isArray(value)) return value.length > 0
    if (value && typeof value === 'object') return Object.keys(value).length > 0
    return Boolean(value)
  })
}

function formatRelativeTime(timestamp = 0) {
  if (!timestamp) return '最近编辑'
  const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60000))
  if (minutes < 1) return '刚刚编辑'
  if (minutes < 60) return `${minutes} 分钟前编辑`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} 小时前编辑`
  return `${Math.floor(hours / 24)} 天前编辑`
}

function readToolDrafts() {
  return TOOL_DRAFTS.reduce((items, config) => {
    const draft = readStorage(config.key)
    const updatedAt = getDraftTime(draft || {}, config.timeKeys)
    const fresh = !updatedAt || updatedAt > Date.now() - DRAFT_MAX_AGE
    if (!fresh || !hasDraftContent(draft || {})) return items
    items.push({
      id: config.id,
      name: config.name,
      updatedAt,
      timeLabel: formatRelativeTime(updatedAt),
      route: config.route || `/package-ai/simple-ai-workbench/simple-ai-workbench?toolType=${encodeURIComponent(config.toolType)}`
    })
    return items
  }, [])
}

function getMainChainDraft() {
  try {
    const state = getMainChainState() || {}
    const draft = state.draftTask || {}
    const input = draft.input || {}
    const assets = input.assets || {}
    const params = input.params || {}
    const cloth = assets.clothImage || {}
    const style = assets.styleImage || {}
    const hasImage = Boolean(text(cloth.fileId || cloth.fileUrl || cloth.localPath) || text(style.fileId || style.fileUrl || style.localPath))
    const entryScene = text(params.entryScene || input.entryScene)
    if (!hasImage && !entryScene) return null
    const updatedAt = getDraftTime(draft, ['updatedAt', 'createdAt'])
    return {
      id: 'main_chain_draft',
      name: entryScene ? '未完成的生成配置' : '服装图片配置',
      updatedAt,
      timeLabel: formatRelativeTime(updatedAt),
      route: entryScene
        ? `/package-ai/upload/upload?entryScene=${encodeURIComponent(entryScene)}`
        : '/package-ai/upload/upload'
    }
  } catch (error) {
    return null
  }
}

function getCurrentIdentity() {
  try {
    const user = getCurrentUser() || {}
    const openId = text(user.openId)
    const available = Boolean(openId && !openId.startsWith('mock_'))
    return {
      available,
      nickname: available ? text(user.nickname) : '',
      avatarUrl: available ? text(user.avatarUrl) : ''
    }
  } catch (error) {
    return { available: false, nickname: '', avatarUrl: '' }
  }
}

export function getHomeWorkbenchSnapshot() {
  const identity = getCurrentIdentity()
  const taskSnapshot = getTaskCenterSnapshot({ limit: 3 })
  const workPage = getMyWorks({ page: 1, pageSize: 3, quickFilter: 'recent' })
  const membership = getMembershipUsage()
  const drafts = readToolDrafts()
  const mainChainDraft = getMainChainDraft()
  if (mainChainDraft) drafts.push(mainChainDraft)
  drafts.sort((left, right) => Number(right.updatedAt || 0) - Number(left.updatedAt || 0))

  return {
    identity,
    membership,
    taskSnapshot,
    works: Array.isArray(workPage.items) ? workPage.items : [],
    draft: drafts[0] || null,
    draftCount: drafts.length
  }
}
