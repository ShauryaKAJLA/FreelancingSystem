import { createSlice } from '@reduxjs/toolkit'
import { tokenStore } from '../shared/api/http'

// Session = { userId, name, email, role } (unchanged shape - every component reads only this).
// In live mode the API also returns a JWT: it is split off and kept in tokenStore, never in Redux state.
// The sessionStorage key keeps its old name so existing sessions keep working.
const persisted = (() => {
  try {
    return JSON.parse(sessionStorage.getItem('mockSession') || 'null')
  } catch {
    return null
  }
})()

const initialState = {
  currentUser: persisted, // { userId, name, email, role }
}

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setSession(state, action) {
      const { token, ...user } = action.payload
      if (token) tokenStore.set(token)
      state.currentUser = user
      sessionStorage.setItem('mockSession', JSON.stringify(user))
    },
    clearSession(state) {
      state.currentUser = null
      sessionStorage.removeItem('mockSession')
      tokenStore.clear()
    },
  },
})

export const { setSession, clearSession } = authSlice.actions
export default authSlice.reducer
