import { appendLocationIdToPath, getIframeLocationId } from "./iframeContext"

const SUPERUSER_GENERIC_ADMIN_PATHS = new Set([
  "/admin/jobs",
  "/admin/dashboard",
  "/admin/login",
  "/admin",
])

/**
 * Default route after admin login (when no returnTo is stored).
 * Superusers without a tenant location context go to the Platform Portal.
 */
export function getPostLoginRedirectPath({ user, userRole, locationId } = {}) {
  const loc = locationId || getIframeLocationId()

  if (user?.is_superuser && !loc) {
    return "/platform/dashboard"
  }

  const role = String(userRole || user?.role || "worker").toLowerCase()
  if (role === "admin" || role === "manager") {
    return appendLocationIdToPath("/admin/dashboard", loc)
  }

  return appendLocationIdToPath("/admin/jobs", loc)
}

/** Prefer platform portal for superusers instead of generic tenant home pages. */
export function resolveLoginReturnTo(returnTo, { user, locationId } = {}) {
  if (!returnTo) return null

  const loc = locationId || getIframeLocationId()
  if (user?.is_superuser && !loc) {
    const pathOnly = returnTo.split("?")[0]
    if (SUPERUSER_GENERIC_ADMIN_PATHS.has(pathOnly)) {
      return "/platform/dashboard"
    }
  }

  return returnTo
}

export function resolvePostLoginNavigation({ user, userRole, locationId, returnTo }) {
  const resolvedReturnTo = resolveLoginReturnTo(returnTo, { user, locationId })
  if (resolvedReturnTo) {
    return appendLocationIdToPath(resolvedReturnTo, locationId || getIframeLocationId())
  }
  return getPostLoginRedirectPath({ user, userRole, locationId })
}
