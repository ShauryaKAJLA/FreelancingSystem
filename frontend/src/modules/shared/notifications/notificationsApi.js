import { baseApi } from '../../app/store/baseApi'
import { request } from '../api/http'

// ── Live implementations ────────────────────────────────────────────────────────────────────
// GET /notifications/:userId -> { items:[{ notificationId, userId, type, message, link, read, createdAt }], unreadCount }
// The backend derives the role-specific `link` (e.g. /client/contracts/:id vs /freelancer/contracts/:id).
const liveGetMyNotifications = (userId) => request('get', `/notifications/${userId}`, { params: { limit: 50 }, map: (p) => p.items })
// Paged "view all" list (Phase 12). Backend shape: { items, unreadCount, pagination:{ page, limit, total, totalPages } }
// -> { rows, meta, unreadCount }. args { userId, page, limit, unreadOnly }
const liveGetNotificationsPage = ({ userId, page, limit, unreadOnly }) =>
  request('get', `/notifications/${userId}`, {
    params: { page, limit, ...(unreadOnly ? { unreadOnly: 'true' } : {}) },
    map: (p) => ({ rows: p.items, meta: p.pagination, unreadCount: p.unreadCount }),
  })
const liveMarkNotificationRead = (notificationId) => request('patch', `/notifications/${notificationId}/read`)
// read-all acts on the token's user.
const liveMarkAllNotificationsRead = () => request('patch', '/notifications/read-all', { map: () => true })

export const notificationsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getMyNotifications: builder.query({
      queryFn: liveGetMyNotifications,
      providesTags: ['Notifications'],
    }),
    getNotificationsPage: builder.query({
      queryFn: liveGetNotificationsPage,
      providesTags: ['Notifications'],
    }),
    markNotificationRead: builder.mutation({
      queryFn: liveMarkNotificationRead,
      invalidatesTags: ['Notifications'],
    }),
    markAllNotificationsRead: builder.mutation({
      queryFn: liveMarkAllNotificationsRead,
      invalidatesTags: ['Notifications'],
    }),
  }),
})

export const {
  useGetMyNotificationsQuery,
  useGetNotificationsPageQuery,
  useMarkNotificationReadMutation,
  useMarkAllNotificationsReadMutation,
} = notificationsApi
