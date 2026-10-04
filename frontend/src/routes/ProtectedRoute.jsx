import { Navigate, Outlet } from 'react-router'
import { useSelector } from 'react-redux'

// Client-side guard for a role's route subtree (session in Redux, backed by sessionStorage). Real authorization is enforced by the API (JWT + role checks).
export default function ProtectedRoute({ allowedRole }) {
  const user = useSelector((s) => s.auth.currentUser)
  if (!user) return <Navigate to="/login" replace />
  if (user.role !== allowedRole) return <Navigate to="/login" replace />
  return <Outlet />
}
