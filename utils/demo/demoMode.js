import {
  DEMO_ENTERPRISE_STORAGE_KEY,
  clearDemoEnterprise,
  createDemoEnterprise
} from './demoEnterpriseSeed'

const DEMO_MODE_STORAGE_KEY = 'diebiandesign_demo_mode'

function getNow() {
  return new Date().toISOString()
}

function safeReadMode() {
  if (typeof uni === 'undefined' || !uni || typeof uni.getStorageSync !== 'function') {
    return null
  }
  try {
    const mode = uni.getStorageSync(DEMO_MODE_STORAGE_KEY)
    return mode && typeof mode === 'object' ? mode : null
  } catch (error) {
    return null
  }
}

function safeReadDemoEnterprise() {
  if (typeof uni === 'undefined' || !uni || typeof uni.getStorageSync !== 'function') {
    return null
  }
  try {
    const demo = uni.getStorageSync(DEMO_ENTERPRISE_STORAGE_KEY)
    return demo && typeof demo === 'object' ? demo : null
  } catch (error) {
    return null
  }
}

function safeWriteMode(mode = null) {
  if (typeof uni === 'undefined' || !uni || typeof uni.setStorageSync !== 'function') {
    return
  }
  try {
    uni.setStorageSync(DEMO_MODE_STORAGE_KEY, mode)
  } catch (error) {
    // Demo mode must not block real admin or workspace flows.
  }
}

function safeClearMode() {
  if (typeof uni === 'undefined' || !uni) {
    return
  }
  try {
    if (typeof uni.removeStorageSync === 'function') {
      uni.removeStorageSync(DEMO_MODE_STORAGE_KEY)
      return
    }
    if (typeof uni.setStorageSync === 'function') {
      uni.setStorageSync(DEMO_MODE_STORAGE_KEY, null)
    }
  } catch (error) {
    // Clearing demo mode is best effort in preview environments.
  }
}

export function getDemoMode() {
  const mode = safeReadMode()
  return {
    demoEnabled: Boolean(mode && mode.demoEnabled),
    demoId: mode && mode.demoId ? String(mode.demoId) : '',
    createdAt: mode && mode.createdAt ? String(mode.createdAt) : ''
  }
}

export function getDemoEnterpriseData() {
  return safeReadDemoEnterprise()
}

export function enableDemoMode() {
  const demo = createDemoEnterprise()
  const mode = {
    demoEnabled: true,
    demoId: demo.demoId,
    createdAt: getNow()
  }
  safeWriteMode(mode)
  console.log('[demo:mode]', {
    demoId: mode.demoId
  })
  return {
    mode,
    demo
  }
}

export function resetEnterpriseDemoMode() {
  clearDemoEnterprise()
  const demo = createDemoEnterprise()
  const mode = {
    demoEnabled: true,
    demoId: demo.demoId,
    createdAt: getNow()
  }
  safeWriteMode(mode)
  console.log('[demo:mode]', {
    demoId: mode.demoId
  })
  return {
    mode,
    demo
  }
}

export function disableDemoMode() {
  const currentMode = getDemoMode()
  clearDemoEnterprise()
  safeClearMode()
  console.log('[demo:mode]', {
    demoId: currentMode.demoId
  })
  return {
    demoEnabled: false,
    demoId: currentMode.demoId,
    createdAt: currentMode.createdAt
  }
}

export { DEMO_MODE_STORAGE_KEY }
