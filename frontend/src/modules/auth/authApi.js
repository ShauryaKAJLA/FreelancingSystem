import { baseApi } from '../app/store/baseApi'
import { request } from '../shared/api/http'

// Backend returns { token, user:{ userId, name, email, role } }. The component receives
// { userId, name, email, role, token } and passes it straight to setSession(), which stores the token.
const toSession = ({ token, user }) => ({ ...user, token })

const liveLogin = ({ email, role, password }) =>
  request('post', '/auth/login', { data: { email, password, role }, map: toSession })

const liveRegister = ({ name, email, role, password }) =>
  request('post', '/auth/register', { data: { name, email, password, role }, map: toSession })

export const authApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    login: builder.mutation({ queryFn: liveLogin }),
    register: builder.mutation({ queryFn: liveRegister }),
  }),
})

export const { useLoginMutation, useRegisterMutation } = authApi
