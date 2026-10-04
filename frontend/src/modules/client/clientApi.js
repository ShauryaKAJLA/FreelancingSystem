import { baseApi } from '../app/store/baseApi'
import { request, cleanParams } from '../shared/api/http'
import { livePaged } from '../shared/api/paging'
import { takeCheckoutProof } from '../shared/utils/razorpay'
import { reduceCard } from '../shared/utils/card'

// ── Live implementations (Express API) — Phase 2: jobs, discovery, client profile ───────────
// Paged (Phase 12): args { userId, page, limit, status, pendingBids } -> { rows, meta }; pendingBids=true => only jobs with an open bid
const liveGetClientJobs = livePaged((a) => `/clients/${a.userId}/jobs`)
const liveGetJobDetails = (jobId) => request('get', `/jobs/${jobId}`)
const liveCreateJob = (job) => request('post', '/jobs', { data: job })
const liveEditJob = ({ jobId, ...updates }) => request('put', `/jobs/${jobId}`, { data: updates })
const livePublishJob = (jobId) => request('patch', `/jobs/${jobId}/publish`)
const liveDeleteJob = (jobId) => request('delete', `/jobs/${jobId}`)
const liveCancelJob = ({ jobId, reason }) => request('patch', `/jobs/${jobId}/cancel`, { data: { reason } })
// Paged (Phase 12): args { search, skillId, minRating, minRate, maxRate, sortBy, page, limit } -> { rows, meta }
const liveGetFreelancers = livePaged('/freelancers')
const liveGetClientProfile = (clientId) => request('get', `/clients/${clientId}/profile`)
const liveEditClientProfile = ({ clientId, ...updates }) => request('put', `/clients/${clientId}/profile`, { data: updates })

// ── Live implementations — Phase 3: bids, contracts, milestones, termination ────────────────
// The backend derives the acting user (and, for termination, the requester's role) from the JWT, so ids/roles in
// the arguments are used only to build the URL. `requestedByRole` is sent by the UI but ignored server-side.
const liveAcceptBid = ({ jobId, bidId }) => request('post', `/jobs/${jobId}/bids/${bidId}/accept`)
const liveStartContract = (contractId) => request('patch', `/contracts/${contractId}/start`)
const liveCompleteContract = (contractId) => request('patch', `/contracts/${contractId}/complete`)
const liveCancelContract = ({ contractId, reason }) => request('patch', `/contracts/${contractId}/cancel`, { data: { reason } })
// Paged (Phase 11): args { userId, page, limit, status } -> { rows, meta }
const liveGetClientContracts = livePaged((a) => `/clients/${a.userId}/contracts`)
const liveGetContractDetails = (contractId) => request('get', `/contracts/${contractId}`)
const liveCreateMilestone = ({ contractId, title, amount, dueDate }) => request('post', `/contracts/${contractId}/milestones`, { data: { title, amount, dueDate } })
const liveEditMilestone = ({ milestoneId, title, amount, dueDate }) => request('put', `/milestones/${milestoneId}`, { data: { title, amount, dueDate } })
const liveDeleteMilestone = (milestoneId) => request('delete', `/milestones/${milestoneId}`)
const liveRejectMilestone = ({ milestoneId, reason }) => request('patch', `/milestones/${milestoneId}/reject`, { data: { reason } })
const liveRequestContractTermination = ({ contractId, reason }) => request('post', `/contracts/${contractId}/termination-request`, { data: { reason } })
const liveRespondToTerminationRequest = ({ contractId, approve }) => request('post', `/contracts/${contractId}/termination-response`, { data: { approve } })

// ── Live implementations — Phase 4: payments + payment methods ─────────────────────────────
// releaseMilestonePayment = the client APPROVING a submitted milestone (Held -> Awaiting Payout); no money moves to the freelancer here.
const liveReleaseMilestonePayment = (milestoneId) => request('post', `/milestones/${milestoneId}/release-payment`)
// Called after payWithRazorpay resolved. Sends Checkout's order id + signature (parked by razorpay.js) to /payments/verify.
// Replaying it is safe on the server (same ids -> "already verified", no double funding).
const liveFundMilestone = async ({ razorpayPaymentId }) => {
  if (!razorpayPaymentId) return { error: { status: 400, data: 'A Razorpay payment id is required.' } }
  const proof = takeCheckoutProof(razorpayPaymentId)
  if (!proof) {
    return { error: { status: 409, data: 'Your payment went through but its confirmation was lost (the page was reloaded). It is recorded automatically once Razorpay confirms it; refresh in a moment.' } }
  }
  return request('post', '/payments/verify', {
    data: { razorpay_order_id: proof.orderId, razorpay_payment_id: razorpayPaymentId, razorpay_signature: proof.signature },
  })
}
const liveGetClientPayments = livePaged((a) => `/clients/${a.userId}/payments`)
const liveGetClientPaymentDetails = (paymentId) => request('get', `/payments/${paymentId}`)
const liveGetPaymentMethods = (clientId) => request('get', `/clients/${clientId}/payment-methods`)
// The full card number is validated and reduced to { brand, last4 } HERE; only that is sent. The number never leaves the page.
const liveAddPaymentMethod = async ({ clientId, cardNumber, expiry, holderName }) => {
  const card = reduceCard({ cardNumber, expiry, holderName })
  if (card.error) return { error: { status: 400, data: card.error } }
  return request('post', `/clients/${clientId}/payment-methods`, {
    data: { type: 'Card', brand: card.brand, last4: card.last4, expiry: card.expiry, holderName: card.holderName },
  })
}
// ── Live implementations — Phase 5: dashboard, reviews
// The dashboard aggregates jobs, bids and contracts, (computed server-side).
const liveGetClientDashboard = (clientId) => request('get', `/clients/${clientId}/dashboard`)
// reviewerId/revieweeId from the page are NOT sent: the backend derives both from the contract and the token.
const liveSubmitClientReview = ({ contractId, rating, comment }) => request('post', `/contracts/${contractId}/reviews`, { data: { rating, comment } })

const liveRemovePaymentMethod = (paymentMethodId) => request('delete', `/payment-methods/${paymentMethodId}`)
const liveSetDefaultPaymentMethod = (paymentMethodId) => request('patch', `/payment-methods/${paymentMethodId}/default`)

// ── Phase 6 live implementations ────────────────────────────────────────────────────────────
// The reporter is the token's user; only contractId + subject are sent.
const liveRaiseIssue = ({ contractId, subject }) => request('post', '/issues', { data: { contractId, subject } })
const liveClientSearchWorkspace = ({ query }) => request('get', '/search/client', { params: cleanParams({ query }) })

export const clientApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    // ---- Dashboard ----
    getClientDashboard: builder.query({
      queryFn: liveGetClientDashboard,
      providesTags: ['Jobs', 'Contracts', 'Bids'],
    }),

    // ---- Jobs ----
    getClientJobs: builder.query({
      queryFn: liveGetClientJobs,
      providesTags: ['Jobs'],
    }),
    getJobDetails: builder.query({
      queryFn: liveGetJobDetails,
      providesTags: ['Jobs', 'Bids'],
    }),
    createJob: builder.mutation({
      queryFn: liveCreateJob,
      invalidatesTags: ['Jobs'],
    }),
    editJob: builder.mutation({
      queryFn: liveEditJob,
      invalidatesTags: ['Jobs'],
    }),
    publishJob: builder.mutation({
      queryFn: livePublishJob,
      invalidatesTags: ['Jobs'],
    }),
    deleteJob: builder.mutation({
      queryFn: liveDeleteJob,
      invalidatesTags: ['Jobs'],
    }),
    cancelJob: builder.mutation({
      queryFn: liveCancelJob,
      invalidatesTags: ['Jobs', 'Bids'],
    }),

    // ---- Freelancer discovery ----
    getFreelancers: builder.query({
      queryFn: liveGetFreelancers,
      providesTags: ['Users', 'Reviews'],
    }),

    // ---- Bids / hiring ----
    acceptBid: builder.mutation({
      queryFn: liveAcceptBid,
      invalidatesTags: ['Jobs', 'Bids', 'Contracts'],
    }),

    startContract: builder.mutation({
      queryFn: liveStartContract,
      invalidatesTags: ['Contracts'],
    }),
    completeContract: builder.mutation({
      queryFn: liveCompleteContract,
      invalidatesTags: ['Contracts'],
    }),
    cancelContract: builder.mutation({
      queryFn: liveCancelContract,
      invalidatesTags: ['Contracts', 'Jobs'],
    }),

    // ---- Contracts / Milestones / Payments ----
    getClientContracts: builder.query({
      queryFn: liveGetClientContracts,
      providesTags: ['Contracts'],
    }),
    getContractDetails: builder.query({
      queryFn: liveGetContractDetails,
      providesTags: ['Contracts', 'Milestones', 'Payments', 'Reviews'],
    }),
    // Client approves a submitted milestone. The money is NOT sent to the freelancer here:
    // it was already paid to the platform (Razorpay) before the milestone started, and an
    // admin dispatches it to the freelancer afterwards (status "Awaiting Payout").
    releaseMilestonePayment: builder.mutation({
      queryFn: liveReleaseMilestonePayment,
      invalidatesTags: ['Milestones', 'Payments', 'Notifications'],
    }),
    // Client pays a milestone amount to the platform via Razorpay (before the milestone starts).
    fundMilestone: builder.mutation({
      queryFn: liveFundMilestone,
      invalidatesTags: ['Milestones', 'Payments', 'Notifications'],
    }),
    createMilestone: builder.mutation({
      queryFn: liveCreateMilestone,
      invalidatesTags: ['Milestones'],
    }),
    editMilestone: builder.mutation({
      queryFn: liveEditMilestone,
      invalidatesTags: ['Milestones'],
    }),
    deleteMilestone: builder.mutation({
      queryFn: liveDeleteMilestone,
      invalidatesTags: ['Milestones'],
    }),
    rejectMilestone: builder.mutation({
      queryFn: liveRejectMilestone,
      invalidatesTags: ['Milestones'],
    }),

    // ---- Payments ----
    getClientPayments: builder.query({
      queryFn: liveGetClientPayments,
      providesTags: ['Payments'],
    }),
    getClientPaymentDetails: builder.query({
      queryFn: liveGetClientPaymentDetails,
      providesTags: ['Payments'],
    }),

    // ---- Reviews ----
    submitClientReview: builder.mutation({
      queryFn: liveSubmitClientReview,
      invalidatesTags: ['Reviews'],
    }),

    // ---- Profile ----
    getClientProfile: builder.query({
      queryFn: liveGetClientProfile,
      providesTags: ['Users'],
    }),
    editClientProfile: builder.mutation({
      queryFn: liveEditClientProfile,
      invalidatesTags: ['Users'],
    }),

    // ---- Payment methods (the client's medium for making/releasing payments) ----
    getPaymentMethods: builder.query({
      queryFn: liveGetPaymentMethods,
      providesTags: ['PaymentMethods'],
    }),
    addPaymentMethod: builder.mutation({
      queryFn: liveAddPaymentMethod,
      invalidatesTags: ['PaymentMethods'],
    }),
    removePaymentMethod: builder.mutation({
      queryFn: liveRemovePaymentMethod,
      invalidatesTags: ['PaymentMethods'],
    }),
    setDefaultPaymentMethod: builder.mutation({
      queryFn: liveSetDefaultPaymentMethod,
      invalidatesTags: ['PaymentMethods'],
    }),

    // ---- Mutual contract termination ----
    requestContractTermination: builder.mutation({
      queryFn: liveRequestContractTermination,
      invalidatesTags: ['Contracts'],
    }),
    respondToTerminationRequest: builder.mutation({
      queryFn: liveRespondToTerminationRequest,
      invalidatesTags: ['Contracts'],
    }),

    // ---- Raise an issue to the admin ----
    raiseIssue: builder.mutation({
      queryFn: liveRaiseIssue,
      invalidatesTags: ['Issues'],
    }),

    // ---- Workspace search ----
    clientSearchWorkspace: builder.query({
      queryFn: liveClientSearchWorkspace,
    }),
  }),
})

export const {
  useGetClientDashboardQuery,
  useGetClientJobsQuery,
  useGetJobDetailsQuery,
  useCreateJobMutation,
  useEditJobMutation,
  usePublishJobMutation,
  useDeleteJobMutation,
  useCancelJobMutation,
  useGetFreelancersQuery,
  useAcceptBidMutation,
  useStartContractMutation,
  useCompleteContractMutation,
  useCancelContractMutation,
  useGetClientContractsQuery,
  useGetContractDetailsQuery,
  useReleaseMilestonePaymentMutation,
  useCreateMilestoneMutation, useFundMilestoneMutation,
  useEditMilestoneMutation,
  useDeleteMilestoneMutation,
  useRejectMilestoneMutation,
  useGetClientPaymentsQuery,
  useGetClientPaymentDetailsQuery,
  useSubmitClientReviewMutation,
  useGetClientProfileQuery,
  useEditClientProfileMutation,
  useGetPaymentMethodsQuery,
  useAddPaymentMethodMutation,
  useRemovePaymentMethodMutation,
  useSetDefaultPaymentMethodMutation,
  useRequestContractTerminationMutation,
  useRespondToTerminationRequestMutation,
  useRaiseIssueMutation,
  useClientSearchWorkspaceQuery,
} = clientApi
