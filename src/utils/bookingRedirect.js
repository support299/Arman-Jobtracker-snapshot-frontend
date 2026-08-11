/** Location that uses All Day Projects branding / portal elsewhere in the app. */
export const ALL_DAY_PROJECTS_LOCATION_ID = 'Q6mmZyHzEztauzOHEBrk';

/**
 * Base URL for post-scheduling redirect (credit card form, etc.).
 * Only uses the account setting — blank means no redirect.
 * @param {string|null|undefined} _locationId Unused (kept for call-site compatibility).
 * @param {string|null|undefined} accountBookingRedirectUrl From account-info / settings API.
 * @returns {string|null}
 */
export function getBookingRedirectBaseUrl(_locationId, accountBookingRedirectUrl) {
  const fromAccount = (accountBookingRedirectUrl || '').trim();
  if (!fromAccount) {
    return null;
  }
  return fromAccount.replace(/\/$/, '');
}

/**
 * Full redirect URL with contact query params, or null when no redirect is configured.
 */
export function buildBookingRedirectUrl(contact, locationId, accountBookingRedirectUrl) {
  const base = getBookingRedirectBaseUrl(locationId, accountBookingRedirectUrl);
  if (!base) {
    return null;
  }

  const fullName =
    contact?.full_name ||
    [contact?.first_name, contact?.last_name].filter(Boolean).join(' ');

  const params = new URLSearchParams({
    full_name: fullName || '',
    email: contact?.email || '',
    phone: contact?.phone || '',
  });

  const separator = base.includes('?') ? '&' : '?';
  return `${base}${separator}${params.toString()}`;
}

/** @deprecated Blank booking redirect means no redirect; kept for UI import compatibility. */
export const DEFAULT_BOOKING_REDIRECT_URL = '';
