import { useEffect, useState } from 'react'
import { FiAlertCircle, FiCheckCircle, FiInfo, FiX } from 'react-icons/fi'

const VARIANTS = {
  success: { Icon: FiCheckCircle, classes: 'border-emerald-200 bg-emerald-50 text-emerald-800', iconClass: 'text-emerald-500' },
  error: { Icon: FiAlertCircle, classes: 'border-red-200 bg-red-50 text-red-800', iconClass: 'text-red-500' },
  info: { Icon: FiInfo, classes: 'border-sky-200 bg-sky-50 text-sky-800', iconClass: 'text-sky-500' },
}

/**
 * Single toast. Handles its own enter transition (no global keyframes needed —
 * this project's App.css is landing-page/legacy CSS and intentionally untouched).
 */
function ToastItem({ toast, onDismiss }) {
  const [entered, setEntered] = useState(false)

  useEffect(() => {
    const raf = requestAnimationFrame(() => setEntered(true))
    return () => cancelAnimationFrame(raf)
  }, [])

  const { Icon, classes, iconClass } = VARIANTS[toast.type] ?? VARIANTS.info

  return (
    <div
      role={toast.type === 'error' ? 'alert' : 'status'}
      className={`pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border px-4 py-3 shadow-lg transition-all duration-300 ease-out ${classes} ${entered ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'}`}
    >
      <Icon className={`mt-0.5 shrink-0 ${iconClass}`} size={18} aria-hidden="true" />
      <p className="flex-1 text-sm font-medium">{toast.message}</p>
      <button
        onClick={() => onDismiss(toast.id)}
        aria-label="Dismiss notification"
        className="shrink-0 text-slate-400 transition-colors hover:text-slate-600"
      >
        <FiX size={16} />
      </button>
    </div>
  )
}

/**
 * Fixed-position stack of toasts, bottom-center on mobile / bottom-right on larger
 * screens. Rendered once by NotificationProvider — not used directly by pages.
 */
export default function ToastStack({ toasts, onDismiss }) {
  if (toasts.length === 0) return null
  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[100] flex flex-col items-center gap-2 p-4 sm:inset-x-auto sm:right-0 sm:items-end"
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  )
}
