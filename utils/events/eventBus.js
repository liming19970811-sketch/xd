const listeners = new Map()

export function on(eventName = '', handler) {
  if (!eventName || typeof handler !== 'function') return () => {}
  const handlers = listeners.get(eventName) || new Set()
  handlers.add(handler)
  listeners.set(eventName, handlers)
  return () => {
    handlers.delete(handler)
    if (!handlers.size) listeners.delete(eventName)
  }
}

export function emit(eventName = '', payload = {}) {
  if (!eventName) return []
  const handlers = Array.from(listeners.get(eventName) || [])
  return handlers.map((handler) => {
    try {
      return handler(payload)
    } catch (error) {
      // A notification handler must not interrupt the originating business flow.
      return null
    }
  })
}
