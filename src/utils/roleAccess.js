/** Roles with full job-tracker admin navigation (matches AdminLayout fullAccessRoles). */
export const FULL_ADMIN_ROLES = ['admin', 'manager', 'supervisor', 'agency'];

/** Roles with supervisor-level access inside a subaccount. */
export const SUPERVISOR_LEVEL_ROLES = ['admin', 'supervisor', 'agency'];

/**
 * Whether a user's role may access a route guarded by allowedRoles.
 *
 * Agency users inherit supervisor-level access (and manager where supervisor is allowed).
 */
export function isRoleAllowed(userRole, allowedRoles = []) {
  const role = String(userRole || 'worker').toLowerCase();
  const allowed = (allowedRoles || []).map((r) => String(r).toLowerCase());

  if (allowed.includes(role)) {
    return true;
  }

  if (role === 'agency') {
    if (allowed.includes('supervisor') || allowed.includes('manager') || allowed.includes('admin')) {
      return true;
    }
  }

  return false;
}
