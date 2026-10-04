import { createApi, fakeBaseQuery } from '@reduxjs/toolkit/query/react'

/**
 * Central RTK Query API slice. Every module injects its own endpoints into this via `injectEndpoints`
 * (see each module's ...Api.js). Endpoints use `queryFn` + the axios helpers in shared/api/http.js, so `fakeBaseQuery()` is intentional.
 */
export const baseApi = createApi({
  reducerPath: 'api',
  baseQuery: fakeBaseQuery(),
  tagTypes: ['Jobs', 'Bids', 'Contracts', 'Milestones', 'Payments', 'Reviews', 'Users', 'Messages', 'AdminActions', 'Issues', 'Notifications', 'PaymentMethods', 'Skills'],
  endpoints: () => ({}),
})
