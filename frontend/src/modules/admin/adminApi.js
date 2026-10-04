import { baseApi } from '../app/store/baseApi'
import { request, cleanParams } from '../shared/api/http'
import { livePaged } from '../shared/api/paging'

// Paged lists: every list query takes { page, limit, ...filters } and resolves to { rows, meta } (see shared/api/paging.js).

// Every admin endpoint takes the caller from the token, so `adminId` / `raisedBy` arguments are ignored. Payout dispatch/verify reuse the Phase 4 payment routes.
const liveGetAdminDashboard = () => request('get', '/admin/dashboard')
const liveGetUsers = livePaged('/admin/users')
const liveGetUserDetails = (userId) => request('get', `/admin/users/${userId}`)
const liveToggleUserStatus = ({ userId }) => request('patch', `/admin/users/${userId}/status`)
const liveGetTransactions = livePaged('/admin/transactions')
const liveGetPaymentDetails = (paymentId) => request('get', `/admin/payments/${paymentId}`)
// Phase 7: admin-initiated refund of a payment still held in escrow .
const liveRefundPayment = ({ paymentId, reason }) => request('post', `/payments/${paymentId}/refund`, { data: { reason } })
const liveDispatchPayment = ({ paymentId }) => request('post', `/payments/${paymentId}/payout`, { data: {} })
const liveVerifyPayment = (paymentId) => request('post', `/payments/${paymentId}/verify-admin`)
const liveGetAdminContracts = livePaged('/admin/contracts')
const liveGetAdminContractDetails = (contractId) => request('get', `/admin/contracts/${contractId}`)
const liveGetAdminReviews = livePaged('/admin/reviews')
const liveModerateReview = ({ reviewId, action }) => request('patch', `/admin/reviews/${reviewId}`, { data: { action } })
const liveGetReportedIssues = livePaged('/admin/issues')
const liveResolveIssue = ({ issueId }) => request('patch', `/admin/issues/${issueId}/resolve`, { data: {} })
const liveGetAdminActionsLog = livePaged('/admin/actions')
const liveGetAdminOpenJobs = livePaged('/admin/jobs/open')
const liveGetAdminProfile = (adminId) => request('get', `/admin/profile/${adminId}`)
const liveEditAdminProfile = ({ adminId, name, email }) => request('put', `/admin/profile/${adminId}`, { data: { name, email } })
const liveAdminSearchWorkspace = ({ query }) => request('get', '/search/admin', { params: cleanParams({ query }) })

export const adminApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getAdminDashboard: builder.query({
      queryFn: liveGetAdminDashboard,
      providesTags: ['Users', 'Jobs', 'Contracts', 'Issues'],
    }),

    getUsers: builder.query({
      queryFn: liveGetUsers,
      providesTags: ['Users'],
    }),

    getUserDetails: builder.query({
      queryFn: liveGetUserDetails,
      providesTags: ['Users'],
    }),

    toggleUserStatus: builder.mutation({
      queryFn: liveToggleUserStatus,
      invalidatesTags: ['Users', 'AdminActions'],
    }),

    getTransactions: builder.query({
      queryFn: liveGetTransactions,
      providesTags: ['Payments'],
    }),

    getPaymentDetails: builder.query({
      queryFn: liveGetPaymentDetails,
      providesTags: ['Payments', 'Users'],
    }),

    refundPayment: builder.mutation({
      queryFn: liveRefundPayment,
      invalidatesTags: ['Payments', 'AdminActions', 'Notifications'],
    }),

    // Admin dispatches an approved milestone's funds (held by the platform) to the freelancer.
    // A real payout needs RazorpayX Payouts from a server (secret key); here it is simulated
    // and a reference id is stored so the swap to a backend call is a one-line change.
    dispatchPayment: builder.mutation({
      queryFn: liveDispatchPayment,
      invalidatesTags: ['Payments', 'AdminActions', 'Notifications'],
    }),

    verifyPayment: builder.mutation({
      queryFn: liveVerifyPayment,
      invalidatesTags: ['Payments'],
    }),

    getAdminContracts: builder.query({
      queryFn: liveGetAdminContracts,
      providesTags: ['Contracts'],
    }),

    getAdminContractDetails: builder.query({
      queryFn: liveGetAdminContractDetails,
      providesTags: ['Contracts', 'Milestones', 'Payments', 'Reviews'],
    }),

    getAdminReviews: builder.query({
      queryFn: liveGetAdminReviews,
      providesTags: ['Reviews'],
    }),

    moderateReview: builder.mutation({
      queryFn: liveModerateReview,
      invalidatesTags: ['Reviews', 'AdminActions'],
    }),

    getReportedIssues: builder.query({
      queryFn: liveGetReportedIssues,
      providesTags: ['Issues'],
    }),

    resolveIssue: builder.mutation({
      queryFn: liveResolveIssue,
      invalidatesTags: ['Issues', 'AdminActions'],
    }),

    getAdminActionsLog: builder.query({
      queryFn: liveGetAdminActionsLog,
      providesTags: ['AdminActions'],
    }),

    getAdminOpenJobs: builder.query({
      queryFn: liveGetAdminOpenJobs,
      providesTags: ['Jobs', 'Bids'],
    }),

    // ---- Profile ----
    getAdminProfile: builder.query({
      queryFn: liveGetAdminProfile,
      providesTags: ['Users'],
    }),
    editAdminProfile: builder.mutation({
      queryFn: liveEditAdminProfile,
      invalidatesTags: ['Users'],
    }),

    // ---- Workspace search ----
    adminSearchWorkspace: builder.query({
      queryFn: liveAdminSearchWorkspace,
    }),
  }),
})

export const {
  useGetAdminDashboardQuery,
  useGetUsersQuery,
  useGetUserDetailsQuery,
  useToggleUserStatusMutation,
  useGetTransactionsQuery,
  useGetPaymentDetailsQuery,
  useVerifyPaymentMutation,
  useDispatchPaymentMutation,
  useRefundPaymentMutation,
  useGetAdminContractsQuery,
  useGetAdminContractDetailsQuery,
  useGetAdminReviewsQuery,
  useModerateReviewMutation,
  useGetReportedIssuesQuery,
  useResolveIssueMutation,
  useGetAdminActionsLogQuery,
  useGetAdminOpenJobsQuery,
  useGetAdminProfileQuery,
  useEditAdminProfileMutation,
  useAdminSearchWorkspaceQuery,
} = adminApi
