import { getCurrentContext } from '../auth/authRepository.js'
import { getColorHistory, replaceColorHistory } from './colorPicker.js'

const FUNCTION_NAME = 'color_preference'
let syncPromise = null

function canUseCloud() {
  return typeof wx !== 'undefined' && wx && wx.cloud && typeof wx.cloud.callFunction === 'function'
}

function requestContext() {
  const context = getCurrentContext()
  const enterpriseId = String((context.currentEnterprise || {}).enterpriseId || '')
  const sessionToken = String(context.sessionToken || '')
  const useEnterprise = Boolean(enterpriseId && enterpriseId !== 'default_enterprise' && sessionToken)
  return {
    scope: useEnterprise ? 'enterprise' : 'personal',
    enterpriseId: useEnterprise ? enterpriseId : '',
    sessionToken: useEnterprise ? sessionToken : ''
  }
}

async function call(action, data = {}) {
  if (!canUseCloud()) return { ok: false, errorCode: 'CLOUD_UNAVAILABLE', data: null }
  try {
    const response = await wx.cloud.callFunction({
      name: FUNCTION_NAME,
      data: { action, data: { ...requestContext(), ...data } }
    })
    return response && response.result ? response.result : response
  } catch (error) {
    return { ok: false, errorCode: String(error && (error.errCode || error.code) || 'CLOUD_CALL_FAILED'), data: null }
  }
}

export function syncRecentColors() {
  if (syncPromise) return syncPromise
  syncPromise = call('list').then((response) => {
    if (response && response.ok && response.data && Array.isArray(response.data.colors)) {
      return replaceColorHistory(response.data.colors)
    }
    return getColorHistory()
  }).finally(() => {
    syncPromise = null
  })
  return syncPromise
}

export function saveRecentColorToCloud(color = {}) {
  return call('save', { color })
}

export function removeRecentColorFromCloud(hex = '') {
  return call('remove', { hex })
}

export function clearRecentColorsFromCloud() {
  return call('clear')
}
