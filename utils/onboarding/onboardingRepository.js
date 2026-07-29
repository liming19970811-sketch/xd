const ONBOARDING_STORAGE_KEY = 'diebiandesign_onboarding_v1'

function isDevelopment() {
  try {
    return typeof process !== 'undefined' && ['development', 'dev'].includes(String(process.env && process.env.NODE_ENV || '').toLowerCase())
  } catch (error) {
    return false
  }
}

function logOnboarding(outcome = '') {
  if (!isDevelopment() || typeof console === 'undefined' || typeof console.info !== 'function') return
  const payload = outcome === 'skipped'
    ? { onboardingSkipped: true }
    : { onboardingCompleted: true }
  console.info('[onboarding:state]', payload)
}

export function hasCompletedOnboarding() {
  if (typeof uni === 'undefined' || !uni || typeof uni.getStorageSync !== 'function') return false
  try {
    const value = uni.getStorageSync(ONBOARDING_STORAGE_KEY)
    if (value === true) return true
    return Boolean(value && typeof value === 'object' && value.completed === true)
  } catch (error) {
    return false
  }
}

export function completeOnboarding(outcome = 'completed') {
  if (typeof uni === 'undefined' || !uni || typeof uni.setStorageSync !== 'function') return false
  try {
    uni.setStorageSync(ONBOARDING_STORAGE_KEY, {
      completed: true,
      outcome: outcome === 'skipped' ? 'skipped' : 'completed',
      completedAt: new Date().toISOString()
    })
    logOnboarding(outcome)
    return true
  } catch (error) {
    return false
  }
}

export function resetOnboarding() {
  if (typeof uni === 'undefined' || !uni) return false
  try {
    if (typeof uni.removeStorageSync === 'function') {
      uni.removeStorageSync(ONBOARDING_STORAGE_KEY)
    } else if (typeof uni.setStorageSync === 'function') {
      uni.setStorageSync(ONBOARDING_STORAGE_KEY, null)
    } else {
      return false
    }
    return true
  } catch (error) {
    return false
  }
}

export { ONBOARDING_STORAGE_KEY }
