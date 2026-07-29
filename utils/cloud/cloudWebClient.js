import { getCloudBaseConfig, hasCloudBaseEnvId, isCloudBaseEnabled } from '../cloudbase/config.js'

const SDK_CDN = 'https://static.cloudbase.net/cloudbase-js-sdk/latest/cloudbase.full.js'

let sdkLoadPromise = null
let appInstance = null
let authState = {
  authenticated: false,
  authType: 'none',
  errorCode: '',
  message: ''
}
let authPromise = null

function createClientError(code = '') {
  const error = new Error(code)
  error.code = code
  return error
}

function createClientErrorWithMessage(code = '', message = '') {
  const error = createClientError(code)
  error.message = message || code
  return error
}

function getGlobalRoot() {
  if (typeof globalThis !== 'undefined') return globalThis
  if (typeof window !== 'undefined') return window
  return {}
}

function getCloudBaseSdk() {
  const root = getGlobalRoot()
  return root.cloudbase || root.tcb || null
}

export function getCloudWebClientStatus() {
  const config = getCloudBaseConfig()
  return {
    initialized: !!appInstance,
    envId: String(config.env || '').trim(),
    hasApp: !!appInstance,
    hasCallFunction: !!(appInstance && typeof appInstance.callFunction === 'function'),
    authenticated: !!authState.authenticated,
    authType: authState.authType || 'none',
    errorCode: authState.errorCode || '',
    errorMessage: authState.message || ''
  }
}

function loadSdkScript() {
  if (typeof document === 'undefined') {
    return Promise.resolve(null)
  }
  if (getCloudBaseSdk()) {
    return Promise.resolve(getCloudBaseSdk())
  }
  if (sdkLoadPromise) return sdkLoadPromise

  sdkLoadPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${SDK_CDN}"]`)
    if (existing) {
      existing.addEventListener('load', () => resolve(getCloudBaseSdk()))
      existing.addEventListener('error', () => reject(createClientError('cloudbase_web_sdk_load_failed')))
      return
    }

    const script = document.createElement('script')
    script.src = SDK_CDN
    script.async = true
    script.onload = () => resolve(getCloudBaseSdk())
    script.onerror = () => reject(createClientError('cloudbase_web_sdk_load_failed'))
    document.head.appendChild(script)
  })

  return sdkLoadPromise
}

export async function getCloudWebApp() {
  if (appInstance) return appInstance
  if (!isCloudBaseEnabled() || !hasCloudBaseEnvId()) {
    throw createClientError('cloudbase_env_not_configured')
  }

  const sdk = getCloudBaseSdk() || await loadSdkScript()
  if (!sdk || typeof sdk.init !== 'function') {
    throw createClientError('cloudbase_web_sdk_unavailable')
  }

  const config = getCloudBaseConfig()
  appInstance = sdk.init({
    env: String(config.env || '').trim()
  })
  return appInstance
}

function normalizeAuthError(error = {}) {
  const code = String(error.code || error.errCode || error.errorCode || '')
  const message = String(error.message || error.errMsg || error.msg || code || 'CloudBase anonymous auth failed')
  const text = `${code} ${message}`.toLowerCase()

  if (text.includes('anonymous') && (text.includes('disable') || text.includes('not enable') || text.includes('not enabled'))) {
    return { errorCode: 'CLOUD_ANONYMOUS_AUTH_DISABLED', message }
  }
  if (text.includes('origin') || text.includes('domain') || text.includes('illegal') || text.includes('not allowed') || text.includes('allowlist')) {
    return { errorCode: 'CLOUD_WEB_ORIGIN_NOT_ALLOWED', message }
  }
  return { errorCode: 'CLOUD_ANONYMOUS_AUTH_FAILED', message }
}

async function hasExistingSession(auth) {
  if (!auth) return false
  if (typeof auth.getSession === 'function') {
    const sessionResult = await auth.getSession()
    const session = sessionResult && sessionResult.data ? sessionResult.data.session : sessionResult
    return !!session
  }
  if (typeof auth.getLoginState === 'function') {
    return !!(await auth.getLoginState())
  }
  return false
}

async function signInAnonymously(auth) {
  if (!auth) {
    throw createClientErrorWithMessage('CLOUD_ANONYMOUS_AUTH_FAILED', 'CloudBase auth instance is unavailable')
  }
  if (typeof auth.signInAnonymously === 'function') {
    return auth.signInAnonymously()
  }
  if (typeof auth.anonymousAuthProvider === 'function') {
    const provider = auth.anonymousAuthProvider()
    if (provider && typeof provider.signIn === 'function') {
      return provider.signIn()
    }
  }
  throw createClientErrorWithMessage('CLOUD_ANONYMOUS_AUTH_DISABLED', 'CloudBase anonymous auth API is unavailable')
}

export async function ensureCloudWebAuth() {
  if (authState.authenticated) {
    return {
      ok: true,
      authenticated: true,
      authType: authState.authType || 'existing_session',
      errorCode: '',
      message: ''
    }
  }
  if (authPromise) return authPromise

  authPromise = (async () => {
    try {
      const app = await getCloudWebApp()
      if (!app || typeof app.auth !== 'function') {
        throw createClientErrorWithMessage('CLOUD_ANONYMOUS_AUTH_FAILED', 'CloudBase auth API is unavailable')
      }
      const auth = app.auth()
      const existingSession = await hasExistingSession(auth)
      if (existingSession) {
        authState = {
          authenticated: true,
          authType: 'existing_session',
          errorCode: '',
          message: ''
        }
        return {
          ok: true,
          authenticated: true,
          authType: 'existing_session',
          errorCode: '',
          message: ''
        }
      }

      await signInAnonymously(auth)
      authState = {
        authenticated: true,
        authType: 'anonymous',
        errorCode: '',
        message: ''
      }
      return {
        ok: true,
        authenticated: true,
        authType: 'anonymous',
        errorCode: '',
        message: ''
      }
    } catch (error) {
      const normalized = normalizeAuthError(error)
      authState = {
        authenticated: false,
        authType: 'none',
        errorCode: normalized.errorCode,
        message: normalized.message
      }
      return {
        ok: false,
        authenticated: false,
        authType: 'none',
        errorCode: normalized.errorCode,
        message: normalized.message
      }
    } finally {
      authPromise = null
    }
  })()

  return authPromise
}

export async function callCloudWebFunction(name = '', data = {}) {
  const app = await getCloudWebApp()
  if (!app || typeof app.callFunction !== 'function') {
    throw createClientError('cloudbase_web_call_function_unavailable')
  }
  const authResult = await ensureCloudWebAuth()
  if (!authResult.ok) {
    throw createClientErrorWithMessage(authResult.errorCode, authResult.message)
  }
  return app.callFunction({ name, data })
}
