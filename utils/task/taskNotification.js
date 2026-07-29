const STORAGE_KEY = 'diebiandesign_task_notification_v1'

function getRuntimeConfig() {
  try {
    const app = typeof getApp === 'function' ? getApp() : null
    const config = app && app.globalData && app.globalData.taskNotificationConfig
    return config && typeof config === 'object' ? config : {}
  } catch (error) {
    return {}
  }
}

function readState() {
  try {
    const state = uni.getStorageSync(STORAGE_KEY)
    return state && typeof state === 'object' ? state : {}
  } catch (error) {
    return {}
  }
}

function writeState(state = {}) {
  try {
    uni.setStorageSync(STORAGE_KEY, state)
  } catch (error) {}
}

export function getTaskNotificationCapability() {
  const config = getRuntimeConfig()
  const templateIds = Array.isArray(config.templateIds) ? config.templateIds.filter(Boolean) : []
  const hasRequestApi = typeof wx !== 'undefined' && typeof wx.requestSubscribeMessage === 'function'
  const hasCloudSender = Boolean(config.cloudSenderReady === true && config.cloudFunctionName)
  const available = hasRequestApi && templateIds.length > 0 && hasCloudSender
  const state = readState()
  return {
    ok: true,
    available,
    status: available ? (state.status || 'not_requested') : 'notification_unavailable',
    statusLabel: available
      ? ({ accepted: '已允许', rejected: '已拒绝', banned: '已禁止', failed: '请求失败', not_requested: '未开启' }[state.status] || '未开启')
      : '暂未开放',
    message: available ? '任务完成或失败时，通过微信服务通知提醒。' : '当前尚未配置微信消息模板和云端发送能力。'
  }
}

export function requestTaskNotificationSubscription() {
  const capability = getTaskNotificationCapability()
  if (!capability.available) {
    return Promise.resolve({ ok: false, status: 'notification_unavailable', message: capability.message })
  }
  const config = getRuntimeConfig()
  const templateIds = config.templateIds.filter(Boolean)
  return new Promise((resolve) => {
    wx.requestSubscribeMessage({
      tmplIds: templateIds,
      success(result = {}) {
        const values = templateIds.map((templateId) => result[templateId])
        let status = values.includes('accept') ? 'accepted' : 'rejected'
        if (values.includes('ban')) status = 'banned'
        const next = { status, updatedAt: new Date().toISOString() }
        writeState(next)
        resolve({ ok: status === 'accepted', status, message: status === 'accepted' ? '已允许生成提醒' : '未允许生成提醒' })
      },
      fail() {
        const next = { status: 'failed', updatedAt: new Date().toISOString() }
        writeState(next)
        resolve({ ok: false, status: 'failed', message: '提醒授权请求失败，请稍后重试。' })
      }
    })
  })
}
