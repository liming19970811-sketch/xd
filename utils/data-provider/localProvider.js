function canUseStorage(methodName) {
  return typeof uni !== 'undefined' && uni && typeof uni[methodName] === 'function'
}

export const localProvider = {
  name: 'local',

  get(key, fallback = null) {
    if (!canUseStorage('getStorageSync')) return fallback
    try {
      const value = uni.getStorageSync(key)
      return value === undefined || value === null || value === '' ? fallback : value
    } catch (error) {
      return fallback
    }
  },

  set(key, value) {
    if (!canUseStorage('setStorageSync')) return value
    try {
      uni.setStorageSync(key, value)
    } catch (error) {
      // Storage failures must not block existing front-end flows.
    }
    return value
  },

  remove(key) {
    if (!canUseStorage('removeStorageSync')) return false
    try {
      uni.removeStorageSync(key)
      return true
    } catch (error) {
      return false
    }
  }
}

export default localProvider
