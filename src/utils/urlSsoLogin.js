/** Helpers for GHL iframe SSO from URL query params (email + location_id). */

export function normalizeLoginEmail(value) {
  return (value || '').trim().toLowerCase();
}

export function getUserLoginEmail(user) {
  if (!user) return '';
  return normalizeLoginEmail(user.email || user.username);
}

export function emailsMatch(user, urlEmail) {
  const target = normalizeLoginEmail(urlEmail);
  if (!target) return false;
  return getUserLoginEmail(user) === target;
}

export function friendlySsoErrorMessage(detail, urlEmail) {
  const d = String(detail || '').toLowerCase();
  const who = urlEmail ? ` (${urlEmail})` : '';

  if (d.includes('no user found') || d.includes('invalid credentials')) {
    return `No application account exists for this user${who}. Ask an admin to add them in Team management for this subaccount.`;
  }
  if (d.includes('cannot access this location') || d.includes('not allowed')) {
    return `This user${who} is not allowed to access this subaccount.`;
  }
  if (d.includes('invalid or expired')) {
    return 'Your sign-in link expired. Refresh the page to try again.';
  }
  if (d.includes('email and location_id are required')) {
    return 'Email and location_id are both required for automatic sign-in.';
  }
  return detail || `Could not sign in${who}.`;
}

export function buildSsoAttemptKey({ email, ssoToken, locationId }) {
  return `${normalizeLoginEmail(email) || ssoToken || ''}:${locationId || ''}`;
}

export function sessionMatchesUrl(user, account, email, locationId) {
  if (!email || !user) return false;
  if (!emailsMatch(user, email)) return false;
  if (!locationId) return true;
  const sessionLocation = account?.location_id || '';
  return sessionLocation === locationId;
}
