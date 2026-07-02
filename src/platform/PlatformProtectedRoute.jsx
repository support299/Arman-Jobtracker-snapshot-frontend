import { Navigate } from "react-router-dom"
import { useSelector } from "react-redux"

/**
 * Restricts platform routes to authenticated superusers only.
 */
const PlatformProtectedRoute = ({ children }) => {
  const user = useSelector((state) => state.auth.user)
  const accessToken = localStorage.getItem("access")

  if (!accessToken) {
    return <Navigate to="/admin/login" replace />
  }

  if (!user?.is_superuser) {
    return <Navigate to="/admin/jobs" replace />
  }

  return children
}

export default PlatformProtectedRoute
