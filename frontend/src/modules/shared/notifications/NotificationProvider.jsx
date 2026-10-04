import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'
import ToastStack from '../components/ui/Toast'

const NotificationContext = createContext(null)

// Errors stay on screen longer than success/info toasts since they usually carry
// a message the person needs to actually read before deciding what to do next.
const DEFAULT_DURATION = { success: 4000, error: 6000, info: 4500 }

let toastIdCounter = 0

export function NotificationProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const timers = useRef(new Map())

  const dismiss = useCallback((id) => {
    setToasts((current) => current.filter((toast) => toast.id !== id))
    const timer = timers.current.get(id)
    if (timer) {
      clearTimeout(timer)
      timers.current.delete(id)
    }
  }, [])

  const push = useCallback((type, message, opts = {}) => {
    if (!message) return null
    const id = ++toastIdCounter
    setToasts((current) => [...current, { id, type, message }])
    const duration = opts.duration ?? DEFAULT_DURATION[type] ?? 4500
    if (duration !== Infinity) {
      const timer = setTimeout(() => dismiss(id), duration)
      timers.current.set(id, timer)
    }
    return id
  }, [dismiss])

  const notify = useMemo(() => ({
    success: (message, opts) => push('success', message, opts),
    error: (message, opts) => push('error', message, opts),
    info: (message, opts) => push('info', message, opts),
    dismiss,
  }), [push, dismiss])

  return (
    <NotificationContext.Provider value={notify}>
      {children}
      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </NotificationContext.Provider>
  )
}

/**
 * useNotify().success('Job published') / .error('Could not save changes') / .info(...)
 * Falls back to a readable message when a queryFn error is passed directly, e.g.
 * notify.error(result.error?.data) — a flattened backend error is just a string,
 * per the `{ error: { status, data: 'message' } }` convention in clientApi/freelancerApi/adminApi.
 */
// eslint-disable-next-line react-refresh/only-export-components
export function useNotify() {
  const context = useContext(NotificationContext)
  if (!context) throw new Error('useNotify must be used inside NotificationProvider')
  return context
}
