import { baseApi } from '../app/store/baseApi'
import { request } from '../shared/api/http'

// ── Live implementations ────────────────────────────────────────────────────────────────────
// GET /messages/:userId?view=conversations -> { items: [conversation rows] }
const liveGetConversations = (userId) => request('get', `/messages/${userId}`, { params: { view: 'conversations' }, map: (p) => p.items })
// GET /messages/conversation/:otherUserId -> { items: [oldest..newest] } (also marks incoming as read)
const liveGetConversation = ({ otherUserId }) => request('get', `/messages/conversation/${otherUserId}`, { params: { limit: 100 }, map: (p) => p.items })
// The sender is the token's user; only receiverId + messageText are sent.
const liveSendMessage = ({ receiverId, messageText }) => request('post', '/messages', { data: { receiverId, messageText } })

export const messagesApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getConversations: builder.query({ queryFn: liveGetConversations, providesTags: ['Messages'] }),
    getConversation: builder.query({ queryFn: liveGetConversation, providesTags: ['Messages'] }),
    sendMessage: builder.mutation({ queryFn: liveSendMessage, invalidatesTags: ['Messages'] }),
  }),
})

export const { useGetConversationsQuery, useGetConversationQuery, useSendMessageMutation } = messagesApi
