/** Location that uses All Day Projects booking portal after calendar scheduling. */
export const ALL_DAY_PROJECTS_LOCATION_ID = 'Q6mmZyHzEztauzOHEBrk';

const LOCATION_BOOKING_REDIRECT_URLS = {
  [ALL_DAY_PROJECTS_LOCATION_ID]: 'https://alldayprojects.theservicepilot.com',
};

const DEFAULT_BOOKING_REDIRECT_URL =
  import.meta.env.VITE_BOOKING_REDIRECT_URL ||
  'https://trushinewindowcleaning.theservicepilot.com';

/**
 * Base URL for post-scheduling redirect (credit card form, etc.).
 * @param {string|null|undefined} locationId
 * @param {string|null|undefined} accountBookingRedirectUrl From account-info / settings API.
 */
export function getBookingRedirectBaseUrl(locationId, accountBookingRedirectUrl) {
  const fromAccount = (accountBookingRedirectUrl || '').trim();
  if (fromAccount) {
    return fromAccount.replace(/\/$/, '');
  }
  if (locationId && LOCATION_BOOKING_REDIRECT_URLS[locationId]) {
    return LOCATION_BOOKING_REDIRECT_URLS[locationId];
  }
  return DEFAULT_BOOKING_REDIRECT_URL;
}

export function buildBookingRedirectUrl(contact, locationId, accountBookingRedirectUrl) {
  const fullName =
    contact?.full_name ||
    [contact?.first_name, contact?.last_name].filter(Boolean).join(' ');

  const params = new URLSearchParams({
    full_name: fullName || '',
    email: contact?.email || '',
    phone: contact?.phone || '',
  });

  const base = getBookingRedirectBaseUrl(locationId, accountBookingRedirectUrl);
  const separator = base.includes('?') ? '&' : '?';
  return `${base}${separator}${params.toString()}`;
}

export { DEFAULT_BOOKING_REDIRECT_URL };
