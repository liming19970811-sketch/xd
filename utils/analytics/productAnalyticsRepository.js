import { getCurrentEnterpriseId } from '../tenant/tenantContext.js'
import { getCurrentMember, getCurrentUser } from '../auth/authRepository.js'
import { requirePermission } from '../enterprise-web/enterpriseWebGuard.js'

const ANALYTICS_EVENT_KEY = 'diebians_product_analytics_events_v1'
const MAX_EVENTS = 2000

export const ANALYTICS_EVENT_NAMES = Object.freeze({
  HOME_VIEW: 'home_view',
  CORE_CTA_CLICK: 'core_cta_click',
  LOGIN_SUCCESS: 'login_success',
  WORKSPACE_ENTER: 'workspace_enter',
  PROJECT_CREATE: 'project_create',
  MATERIAL_UPLOAD: 'material_upload',
  TASK_SUBMIT: 'task_submit',
  TASK_SUCCESS: 'task_success',
  REVIEW_SUBMIT: 'review_submit',
  REVIEW_APPROVED: 'review_approved',
  DELIVERY_CONFIRMED: 'delivery_confirmed',
  NAV_CLICK: 'nav_click',
  SIDE_MENU_CLICK: 'side_menu_click',
  SEARCH: 'search',
  SEARCH_EMPTY: 'search_empty',
  QUICK_COMMAND: 'quick_command',
  PAGE_EXIT: 'page_exit'
})

const FUNNEL_DEFINITIONS = Object.freeze([
  {
    funnelId: 'website_visitor',
    name: '官网访客',
    steps: [
      { key: 'home_view', label: '访问首页' },
      { key: 'core_cta_click', label: '点击核心功能' },
      { key: 'login_success', label: '注册/登录' },
      { key: 'workspace_enter', label: '进入工作台' },
      { key: 'task_submit', label: '创建首个任务' },
      { key: 'task_success', label: '完成生成' }
    ]
  },
  {
    funnelId: 'professional_user',
    name: '专业用户',
    steps: [
      { key: 'project_create', label: '创建项目' },
      { key: 'material_upload', label: '上传素材' },
      { key: 'task_submit', label: '提交任务' },
      { key: 'task_success', label: '生成成功' },
      { key: 'review_submit', label: '提交审核' },
      { key: 'review_approved', label: '审核通过' },
      { key: 'delivery_confirmed', label: '正式交付' }
    ]
  },
  {
    funnelId: 'pattern_making',
    name: 'AI 制版',
    steps: [
      { key: 'pattern_upload', label: '上传参考图' },
      { key: 'structure_recognized', label: '结构识别' },
      { key: 'pattern_draft_created', label: '生成初稿' },
      { key: 'pattern_revised', label: '版师修订' },
      { key: 'pattern_approved', label: '审核通过' },
      { key: 'pattern_library_added', label: '加入版型库' }
    ]
  }
])

function nowIso() {
  return new Date().toISOString()
}

function getDeployEnv() {
  if (typeof process !== 'undefined' && process.env && process.env.NODE_ENV) return process.env.NODE_ENV
  return 'development'
}

function readEvents() {
  try {
    const value = uni.getStorageSync(ANALYTICS_EVENT_KEY)
    return Array.isArray(value) ? value.map(normalizeEvent) : []
  } catch (error) {
    return []
  }
}

function writeEvents(events = []) {
  try {
    uni.setStorageSync(ANALYTICS_EVENT_KEY, events.slice(0, MAX_EVENTS).map(normalizeEvent))
  } catch (error) {}
}

function sanitizeText(value = '') {
  return String(value || '')
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email]')
    .replace(/1[3-9]\d{9}/g, '[phone]')
    .replace(/https?:\/\/(?:tmp|localhost|127\.0\.0\.1)[^\s"'<>]*/gi, '[private-url]')
    .replace(/([?&](?:token|sessionToken|apiKey|secret|signature)=)[^&\s]+/gi, '$1[redacted]')
    .slice(0, 120)
}

function normalizeEvent(event = {}) {
  return {
    eventId: String(event.eventId || `evt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`),
    eventName: String(event.eventName || ''),
    enterpriseId: String(event.enterpriseId || getCurrentEnterpriseId()),
    userId: String(event.userId || ''),
    memberId: String(event.memberId || ''),
    userType: String(event.userType || 'personal_user'),
    functionType: String(event.functionType || ''),
    page: sanitizeText(event.page || ''),
    resourceType: String(event.resourceType || ''),
    resourceId: sanitizeText(event.resourceId || ''),
    status: String(event.status || 'success'),
    durationMs: Number(event.durationMs || 0),
    quotaCost: Number(event.quotaCost || 0),
    retryOf: sanitizeText(event.retryOf || ''),
    searchKeyword: sanitizeText(event.searchKeyword || ''),
    noResult: Boolean(event.noResult),
    isMock: event.isMock === true || String(event.provider || '').includes('mock') || String(event.source || '').includes('mock'),
    isInternalTest: event.isInternalTest === true || String(event.userType || '').includes('internal'),
    env: String(event.env || getDeployEnv()),
    createdAt: event.createdAt || nowIso()
  }
}

function currentContext() {
  const user = getCurrentUser()
  const member = getCurrentMember()
  return { user, member, enterpriseId: getCurrentEnterpriseId() }
}

function isReportableEvent(event = {}) {
  if (!event.eventName) return false
  if (event.isMock || event.isInternalTest) return false
  if (['development', 'dev', 'test'].includes(String(event.env || '').toLowerCase())) return false
  return true
}

function uniqueCount(events = [], field = '') {
  return new Set(events.map((event) => String(event[field] || '')).filter(Boolean)).size
}

function buildFunnels(events = []) {
  return FUNNEL_DEFINITIONS.map((funnel) => ({
    ...funnel,
    steps: funnel.steps.map((step, index) => {
      const stepEvents = events.filter((event) => event.eventName === step.key)
      const previousValue = index === 0 ? stepEvents.length : Math.max(1, events.filter((event) => event.eventName === funnel.steps[index - 1].key).length)
      const count = stepEvents.length
      return {
        ...step,
        count,
        users: uniqueCount(stepEvents, 'userId'),
        conversionRate: index === 0 ? 100 : Math.round((count / previousValue) * 100)
      }
    })
  }))
}

function buildFeatureUsage(events = [], tasks = []) {
  const taskRecords = (Array.isArray(tasks) ? tasks : []).filter((task) => !task.mock && task.provider !== 'mock')
  const functionTypes = [...new Set([
    ...events.map((event) => event.functionType).filter(Boolean),
    ...taskRecords.map((task) => task.type || task.taskType || task.input && task.input.type).filter(Boolean)
  ])]
  return functionTypes.map((functionType) => {
    const featureEvents = events.filter((event) => event.functionType === functionType)
    const featureTasks = taskRecords.filter((task) => String(task.type || task.taskType || (task.input && task.input.type) || '') === functionType)
    const submitEvents = featureEvents.filter((event) => event.eventName === 'task_submit')
    const successEvents = featureEvents.filter((event) => event.eventName === 'task_success' || event.status === 'success')
    const failedEvents = featureEvents.filter((event) => event.status === 'failed')
    const retryEvents = featureEvents.filter((event) => event.retryOf)
    const approvedEvents = featureEvents.filter((event) => event.eventName === 'review_approved')
    const durations = featureEvents.map((event) => event.durationMs).filter((value) => value > 0)
    const quotaCosts = featureEvents.map((event) => event.quotaCost).filter((value) => value > 0)
    return {
      functionType,
      visitors: uniqueCount(featureEvents, 'userId'),
      taskCount: submitEvents.length || featureTasks.length,
      successRate: submitEvents.length ? Math.round((successEvents.length / submitEvents.length) * 100) : 0,
      failureRate: submitEvents.length ? Math.round((failedEvents.length / submitEvents.length) * 100) : 0,
      averageDurationMs: durations.length ? Math.round(durations.reduce((sum, value) => sum + value, 0) / durations.length) : 0,
      retryRate: submitEvents.length ? Math.round((retryEvents.length / submitEvents.length) * 100) : 0,
      approvalRate: submitEvents.length ? Math.round((approvedEvents.length / submitEvents.length) * 100) : 0,
      reuseRate: calculateReuseRate(featureEvents),
      averageQuotaCost: quotaCosts.length ? Number((quotaCosts.reduce((sum, value) => sum + value, 0) / quotaCosts.length).toFixed(1)) : 0
    }
  }).sort((left, right) => right.taskCount - left.taskCount)
}

function calculateReuseRate(events = []) {
  const counts = events.reduce((result, event) => {
    if (!event.userId) return result
    result[event.userId] = (result[event.userId] || 0) + 1
    return result
  }, {})
  const users = Object.keys(counts)
  if (!users.length) return 0
  return Math.round((users.filter((userId) => counts[userId] > 1).length / users.length) * 100)
}

function buildNavigation(events = []) {
  const navEvents = events.filter((event) => ['nav_click', 'side_menu_click', 'search', 'search_empty', 'quick_command', 'page_exit'].includes(event.eventName))
  const searchEvents = navEvents.filter((event) => event.eventName === 'search')
  const emptySearchEvents = navEvents.filter((event) => event.eventName === 'search_empty' || event.noResult)
  const keywords = searchEvents.reduce((result, event) => {
    const keyword = event.searchKeyword || 'unknown'
    result[keyword] = (result[keyword] || 0) + 1
    return result
  }, {})
  return {
    topNavClicks: navEvents.filter((event) => event.eventName === 'nav_click').length,
    sideMenuClicks: navEvents.filter((event) => event.eventName === 'side_menu_click').length,
    searchCount: searchEvents.length,
    emptySearchCount: emptySearchEvents.length,
    quickCommandCount: navEvents.filter((event) => event.eventName === 'quick_command').length,
    averageTimeToTaskMs: averageTimeToTask(events),
    exitPages: Object.entries(navEvents.filter((event) => event.eventName === 'page_exit').reduce((result, event) => {
      const page = event.page || 'unknown'
      result[page] = (result[page] || 0) + 1
      return result
    }, {})).map(([page, count]) => ({ page, count })).sort((left, right) => right.count - left.count),
    keywords: Object.entries(keywords).map(([keyword, count]) => ({ keyword, count })).sort((left, right) => right.count - left.count)
  }
}

function averageTimeToTask(events = []) {
  const grouped = events.reduce((result, event) => {
    if (!event.userId) return result
    if (!result[event.userId]) result[event.userId] = []
    result[event.userId].push(event)
    return result
  }, {})
  const durations = Object.keys(grouped).map((userId) => {
    const userEvents = grouped[userId].sort((left, right) => String(left.createdAt).localeCompare(String(right.createdAt)))
    const enter = userEvents.find((event) => event.eventName === 'workspace_enter')
    const submit = userEvents.find((event) => event.eventName === 'task_submit')
    if (!enter || !submit) return 0
    const duration = new Date(submit.createdAt).getTime() - new Date(enter.createdAt).getTime()
    return duration > 0 ? duration : 0
  }).filter(Boolean)
  return durations.length ? Math.round(durations.reduce((sum, value) => sum + value, 0) / durations.length) : 0
}

export function recordProductAnalyticsEvent(input = {}) {
  const context = currentContext()
  const event = normalizeEvent({
    ...input,
    enterpriseId: context.enterpriseId,
    userId: context.user.userId,
    memberId: context.member.memberId
  })
  if (event.isMock || event.isInternalTest) return { success: false, errorCode: 'event_filtered' }
  const events = [event, ...readEvents()]
  writeEvents(events)
  return { success: true, eventId: event.eventId }
}

export function listProductAnalyticsEvents() {
  const enterpriseId = getCurrentEnterpriseId()
  return readEvents().filter((event) => event.enterpriseId === enterpriseId && isReportableEvent(event))
}

export function loadProductAnalyticsCenter(input = {}) {
  const guard = requirePermission('analytics.view')
  if (!guard.allowed) {
    return {
      canAccess: false,
      reason: guard.reason,
      updatedAt: nowIso(),
      events: [],
      funnels: buildFunnels([]),
      featureUsage: [],
      navigation: buildNavigation([]),
      metrics: {}
    }
  }
  const events = listProductAnalyticsEvents()
  return {
    canAccess: true,
    reason: '',
    updatedAt: nowIso(),
    events,
    funnels: buildFunnels(events),
    featureUsage: buildFeatureUsage(events, input.tasks || []),
    navigation: buildNavigation(events),
    metrics: {
      eventCount: events.length,
      activeUsers: uniqueCount(events, 'userId'),
      taskSubmitCount: events.filter((event) => event.eventName === 'task_submit').length,
      taskSuccessCount: events.filter((event) => event.eventName === 'task_success').length,
      feedbackReady: true
    }
  }
}
