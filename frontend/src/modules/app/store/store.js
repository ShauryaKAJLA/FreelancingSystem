import { configureStore } from '@reduxjs/toolkit'
import { baseApi } from './baseApi'
import authReducer from '../../auth/authSlice'
import { clearSession } from '../../auth/authSlice'
import { setUnauthorizedHandler } from '../../shared/api/http'

export const store = configureStore({
  reducer: {
    auth: authReducer,
    [baseApi.reducerPath]: baseApi.reducer,
  },
  middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(baseApi.middleware),
})

// An expired/invalid JWT (HTTP 401) signs the user out and drops cached API data.
// ProtectedRoute then redirects to /login. 
setUnauthorizedHandler(() => {
  store.dispatch(clearSession())
  store.dispatch(baseApi.util.resetApiState())
})
