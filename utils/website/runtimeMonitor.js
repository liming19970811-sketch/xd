const MONITOR_KEY = 'diebians_h5_runtime_events_v1'
const MAX_EVENTS = 60

function getRuntimeEnv() {
  // #ifdef H5
  if (typeof process !== 'undefined' && process.env && process.env.NODE_ENV) {
    return process.env.NODE_ENV
  }
  // #endif
  return 'development'
}

function sanitize(value = '') {
  return String(value || '')
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer [redacted]')
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '[email]')
    .replace(/1[3-9]\d{9}/g, '[phone]')
    .replace(/(sessionToken|token|apiKey|secret|openid|unionid)=([^&\s]+)/gi, '$1=[redacted]')
    .replace(/https?:\/\/tmp\/[^\s]+/gi, '[tmp-image-url]')
    .slice(0, 240)
}

function readEvents() {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.sessionStorage.getItem(MONITOR_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed : []
  } catch (error) {
    return []
  }
}

function writeEvents(events = []) {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.setItem(MONITOR_KEY, JSON.stringify(events.slice(-MAX_EVENTS)))
  } catch (error) {}
}

export function recordWebsiteRuntimeEvent(type = '', detail = {}) {
  // #ifdef H5
  const event = {
    eventId: `web_evt_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`,
    type,
    env: getRuntimeEnv(),
    route: typeof window !== 'undefined' ? sanitize(window.location.hash || window.location.pathname || '') : '',
    message: sanitize(detail.message || detail.errorCode || ''),
    status: detail.status || '',
    createdAt: new Date().toISOString()
  }
  const events = readEvents()
  events.push(event)
  writeEvents(events)
  if (event.env !== 'production' && typeof console !== 'undefined') {
    console.warn('[website:runtime]', {
      type: event.type,
      env: event.env,
      status: event.status,
      message: event.message
    })
  }
  // #endif
}

export function installWebsiteRuntimeMonitor() {
  // #ifdef H5
  if (typeof window === 'undefined' || window.__diebiansRuntimeMonitorInstalled) return
  window.__diebiansRuntimeMonitorInstalled = true
  window.addEventListener('error', (event) => {
    recordWebsiteRuntimeEvent('page_error', {
      message: event && event.message,
      status: 'failed'
    })
  })
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event && event.reason
    recordWebsiteRuntimeEvent('promise_error', {
      message: reason && (reason.message || reason.errorCode || reason),
      status: 'failed'
    })
  })
  window.addEventListener('hashchange', () => {
    recordWebsiteRuntimeEvent('route_change', {
      message: 'hash route changed',
      status: 'success'
    })
  })
  // #endif
}
