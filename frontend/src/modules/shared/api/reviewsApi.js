import { baseApi } from '../../app/store/baseApi'
import { request, cleanParams } from './http'
const liveGetUserReviews = ({ userId, page, limit }) => request('get', `/users/${userId}/reviews`, { params: cleanParams({ page, limit }) })

export const reviewsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getUserReviews: builder.query({
      queryFn: liveGetUserReviews,
      providesTags: ['Reviews'],
    }),
  }),
})

export const { useGetUserReviewsQuery } = reviewsApi
