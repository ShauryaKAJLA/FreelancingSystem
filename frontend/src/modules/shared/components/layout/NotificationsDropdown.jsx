import { useRef, useState } from 'react'
import { useSelector } from 'react-redux'
import { useNavigate } from 'react-router'
import { FiBell } from 'react-icons/fi'
import {
  useGetMyNotificationsQuery, useMarkNotificationReadMutation, useMarkAllNotificationsReadMutation,
} from '../../notifications/notificationsApi'
import { formatDate } from '../../utils/format'

// Polls the backend so new notifications appear without a reload (Socket.IO is optional later).
const POLL_MS = 30000

export default function NotificationsDropdown({ userId }) {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  const role = useSelector((s) => s.auth.currentUser?.role)
  const containerRef = useRef(null)
  const { data: notifications } = useGetMyNotificationsQuery(userId, { skip: !userId, pollingInterval: POLL_MS })
  const [markRead] = useMarkNotificationReadMutation()
  const [markAllRead] = useMarkAllNotificationsReadMutation()

  const list = notifications ?? []
  const unreadCount = list.filter((n) => !n.read).length

  function toggle() {
    setOpen((v) => !v)
  }

  function handleItemClick(notification) {
    if (!notification.read) markRead(notification.notificationId)
    setOpen(false)
    if (notification.link) navigate(notification.link)
  }

  function handleBlur(e) {
    // Close when focus leaves the whole widget (button + panel), not on every inner click.
    if (containerRef.current && !containerRef.current.contains(e.relatedTarget)) {
      setOpen(false)
    }
  }

  return (
    <div className="relative" ref={containerRef} onBlur={handleBlur}>
      <button
        onClick={toggle}
        aria-label="Notifications"
        aria-expanded={open}
        className="relative rounded-xl border border-slate-200 bg-white p-2.5 text-slate-600 hover:border-violet-200 hover:text-violet-600 dark:border-white/10 dark:bg-slate-900 dark:text-slate-300"
      >
        <FiBell />
        {unreadCount > 0 && (
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-rose-400" />
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-[calc(100%+8px)] z-50 w-80 rounded-xl border border-slate-200 bg-white shadow-lg dark:border-white/10 dark:bg-slate-900">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-white/10">
            <p className="text-sm font-semibold text-slate-900 dark:text-white">Notifications</p>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={() => markAllRead(userId)}
                className="text-xs font-medium text-indigo-600 hover:underline"
              >
                Mark all read
              </button>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {list.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-slate-400">You're all caught up.</p>
            ) : (
              list.map((n) => (
                <button
                  key={n.notificationId}
                  type="button"
                  onClick={() => handleItemClick(n)}
                  className={`flex w-full flex-col items-start gap-1 border-b border-slate-50 px-4 py-3 text-left text-sm last:border-0 hover:bg-slate-50 dark:border-white/5 dark:hover:bg-white/5 ${
                    n.read ? 'text-slate-500' : 'text-slate-800 dark:text-slate-100'
                  }`}
                >
                  <span className="flex w-full items-start gap-2">
                    {!n.read && <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-500" />}
                    <span className={n.read ? '' : 'font-medium'}>{n.message}</span>
                  </span>
                  <span className="pl-3.5 text-xs text-slate-400">{formatDate(n.createdAt)}</span>
                </button>
              ))
            )}
          </div>
          {role && (
            <button
              type="button"
              onClick={() => { setOpen(false); navigate(`/${role.toLowerCase()}/notifications`) }}
              className="w-full border-t border-slate-100 px-4 py-2.5 text-center text-xs font-medium text-indigo-600 hover:bg-slate-50 dark:border-white/10 dark:hover:bg-white/5"
            >
              View all notifications
            </button>
          )}
        </div>
      )}
    </div>
  )
}
