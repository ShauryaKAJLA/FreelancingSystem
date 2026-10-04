import { useState } from 'react'
import { useSelector } from 'react-redux'
import { useNavigate } from 'react-router'
import { useGetNotificationsPageQuery, useMarkNotificationReadMutation, useMarkAllNotificationsReadMutation } from './notificationsApi'
import PageHeader from '../components/layout/PageHeader'
import Select from '../components/ui/Select'
import Button from '../components/ui/Button'
import Pagination from '../components/ui/Pagination'
import Spinner from '../components/ui/Spinner'
import ErrorState from '../components/ui/ErrorState'
import EmptyState from '../components/ui/EmptyState'
import { formatDate } from '../utils/format'

const PAGE_SIZE = 15

// "View all" for the bell dropdown. Shared by the client, freelancer and admin shells (the backend resolves the role-specific `link`).
export default function NotificationsPage() {
  const user = useSelector((s) => s.auth.currentUser)
  const navigate = useNavigate()
  const [view, setView] = useState({ unreadOnly: false, page: 1 })
  const { data, isLoading, isFetching, isError } = useGetNotificationsPageQuery(
    { userId: user?.userId, page: view.page, limit: PAGE_SIZE, unreadOnly: view.unreadOnly }, { skip: !user })
  const [markRead] = useMarkNotificationReadMutation()
  const [markAllRead, { isLoading: markingAll }] = useMarkAllNotificationsReadMutation()

  function handleItemClick(n) {
    if (!n.read) markRead(n.notificationId)
    if (n.link) navigate(n.link)
  }

  return (
    <div>
      <PageHeader title="Notifications" description="Everything that has happened on your account, newest first."
                  actions={
                    <div className="flex items-center gap-2">
                      <Select value={view.unreadOnly ? 'unread' : ''} onChange={(e) => setView({ unreadOnly: e.target.value === 'unread', page: 1 })}
                              className="w-36" aria-label="Filter notifications">
                        <option value="">All</option>
                        <option value="unread">Unread only</option>
                      </Select>
                      <Button variant="secondary" disabled={markingAll || !data?.unreadCount} onClick={() => markAllRead(user.userId)}>Mark all read</Button>
                    </div>
                  } />
      {isLoading && <Spinner />}
      {isError && <ErrorState />}
      {data && data.rows.length === 0 && (
        <EmptyState title={view.unreadOnly ? 'No unread notifications' : "You're all caught up"} description="New activity on your jobs, bids, contracts and payments shows up here." />
      )}
      {data && data.rows.length > 0 && (
        <div className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white">
          {data.rows.map((n) => (
            <button key={n.notificationId} type="button" onClick={() => handleItemClick(n)}
                    className={`flex w-full items-start gap-3 px-4 py-3 text-left text-sm hover:bg-slate-50 ${n.read ? 'text-slate-500' : 'text-slate-800'}`}>
              <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.read ? 'bg-transparent' : 'bg-indigo-500'}`} aria-hidden="true" />
              <span className="min-w-0 flex-1">
                <span className={n.read ? '' : 'font-medium'}>{n.message}</span>
                <span className="mt-0.5 block text-xs text-slate-400">{formatDate(n.createdAt)}</span>
              </span>
              {!n.read && <span className="sr-only">Unread</span>}
            </button>
          ))}
        </div>
      )}
      {data && <Pagination meta={data.meta} onPageChange={(page) => setView((v) => ({ ...v, page }))} isFetching={isFetching} />}
    </div>
  )
}
