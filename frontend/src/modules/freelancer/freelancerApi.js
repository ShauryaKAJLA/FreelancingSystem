import { baseApi } from '../app/store/baseApi'
import { request, cleanParams } from '../shared/api/http'
import { livePaged } from '../shared/api/paging'

// ── Live implementations (Express API) — Phase 2: open jobs, freelancer profile ────────────
// myBid comes from the bids module (Phase 3)
// Paged (Phase 12): args { search, skillId, category, experienceLevel, budgetMin, budgetMax, sortBy, page, limit } -> { rows, meta }
const liveGetOpenJobs = livePaged('/jobs/open')
const liveGetJobDetailsForFreelancer = ({ jobId, freelancerId }) => request('get', `/freelancers/${freelancerId}/jobs/${jobId}`)
const liveGetFreelancerProfile = (freelancerId) => request('get', `/freelancers/${freelancerId}/profile`)
const liveEditFreelancerProfile = ({ freelancerId, ...updates }) => request('put', `/freelancers/${freelancerId}/profile`, { data: updates })
const liveUpdateFreelancerExtras = ({ freelancerId, ...updates }) => request('put', `/freelancers/${freelancerId}/extras`, { data: updates })

// ── Live implementations — Phase 4: payments (read-only for freelancers; the backend joins names/titles) ──
// Dashboard: live only when jobs, bids, contracts AND payments are live (it sums Paid payments).
const liveGetFreelancerDashboard = (freelancerId) => request('get', `/freelancers/${freelancerId}/dashboard`)
// Paged (Phase 11): args { userId, page, limit, status } -> { rows, meta }
const liveGetFreelancerPayments = livePaged((a) => `/freelancers/${a.userId}/payments`)
const liveGetFreelancerPaymentDetails = (paymentId) => request('get', `/payments/${paymentId}`)

// ── Live implementations — Phase 3: bids, contracts, milestones ─────────────────────────────
// freelancerId in the arguments only builds the URL; the backend uses the authenticated user for every write.
const liveSubmitBid = ({ jobId, bidAmount, proposal }) => request('post', `/jobs/${jobId}/bids`, { data: { bidAmount, proposal } })
const liveEditBid = ({ bidId, bidAmount, proposal }) => request('put', `/bids/${bidId}`, { data: { bidAmount, proposal } })
const liveWithdrawBid = (bidId) => request('patch', `/bids/${bidId}/withdraw`)
// Paged (Phase 12): args { userId, page, limit, status } -> { rows, meta }
const liveGetMyBids = livePaged((a) => `/freelancers/${a.userId}/bids`)
const liveGetFreelancerContracts = livePaged((a) => `/freelancers/${a.userId}/contracts`)
const liveGetFreelancerContractDetails = (contractId) => request('get', `/contracts/${contractId}`)
const liveSubmitMilestone = (milestoneId) => request('patch', `/milestones/${milestoneId}/submit`)

// ── Phase 6 live implementation ─────────────────────────────────────────────────────────────
const liveFreelancerSearchWorkspace = ({ query }) => request('get', '/search/freelancer', { params: cleanParams({ query }) })

export const freelancerApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getFreelancerDashboard: builder.query({
      queryFn: liveGetFreelancerDashboard,
      providesTags: ['Bids', 'Contracts', 'Payments'],
    }),

    getOpenJobs: builder.query({
      queryFn: liveGetOpenJobs,
      providesTags: ['Jobs'],
    }),

    getJobDetailsForFreelancer: builder.query({
      queryFn: liveGetJobDetailsForFreelancer,
      providesTags: ['Jobs', 'Bids'],
    }),

    submitBid: builder.mutation({
      queryFn: liveSubmitBid,
      invalidatesTags: ['Bids', 'Jobs'],
    }),

    editBid: builder.mutation({
      queryFn: liveEditBid,
      invalidatesTags: ['Bids', 'Jobs'],
    }),

    withdrawBid: builder.mutation({
      queryFn: liveWithdrawBid,
      invalidatesTags: ['Bids', 'Jobs'],
    }),

    getMyBids: builder.query({
      queryFn: liveGetMyBids,
      providesTags: ['Bids'],
    }),

    getFreelancerContracts: builder.query({
      queryFn: liveGetFreelancerContracts,
      providesTags: ['Contracts'],
    }),

    // Contract detail is identical in shape to the client side — reuse via its own
    // endpoint here (kept separate per-module per the modular-slice convention).
    getFreelancerContractDetails: builder.query({
      queryFn: liveGetFreelancerContractDetails,
      providesTags: ['Contracts', 'Milestones', 'Payments'],
    }),

    submitMilestone: builder.mutation({
      queryFn: liveSubmitMilestone,
      invalidatesTags: ['Milestones'],
    }),

    getFreelancerPayments: builder.query({
      queryFn: liveGetFreelancerPayments,
      providesTags: ['Payments'],
    }),
    getFreelancerPaymentDetails: builder.query({
      queryFn: liveGetFreelancerPaymentDetails,
      providesTags: ['Payments'],
    }),

    getFreelancerProfile: builder.query({
      queryFn: liveGetFreelancerProfile,
      providesTags: ['Reviews', 'Users'],
    }),

    // Payout account + past projects (replaces whichever of the two is passed).
    updateFreelancerExtras: builder.mutation({
      queryFn: liveUpdateFreelancerExtras,
      invalidatesTags: ['Users'],
    }),

    editFreelancerProfile: builder.mutation({
      queryFn: liveEditFreelancerProfile,
      invalidatesTags: ['Reviews', 'Users'],
    }),

    // ---- Workspace search ----
    freelancerSearchWorkspace: builder.query({
      queryFn: liveFreelancerSearchWorkspace,
    }),
  }),
})

export const {
  useGetFreelancerDashboardQuery,
  useGetOpenJobsQuery,
  useGetJobDetailsForFreelancerQuery,
  useSubmitBidMutation,
  useEditBidMutation,
  useWithdrawBidMutation,
  useGetMyBidsQuery,
  useGetFreelancerContractsQuery,
  useGetFreelancerContractDetailsQuery,
  useSubmitMilestoneMutation,
  useGetFreelancerPaymentsQuery,
  useGetFreelancerPaymentDetailsQuery,
  useGetFreelancerProfileQuery,
  useEditFreelancerProfileMutation,
  useUpdateFreelancerExtrasMutation,
  useFreelancerSearchWorkspaceQuery,
} = freelancerApi
