/**
 * GHL custom-menu / iframe embed context (location + SSO identity).
 *
 * Custom menu links should pass both email and location_id, e.g.:
 *   https://snapshot.theservicepilot.com/admin/calendar?email={{user.email}}&location_id={{location.id}}
 *   https://snapshot.theservicepilot.com/admin/map?email={{user.email}}&location_id={{location.id}}
 *   https://snapshot.theservicepilot.com/admin/referrals?email={{user.email}}&location_id={{location.id}}
 * Same pattern for dashboard, payroll, jobtracker, quote, etc.
 *
 * location_id is required for multi-tenant SSO.
 */

const STORAGE_KEY = 'iframe_location_id';

export function getIframeLocationId() {
  if (typeof window === 'undefined') return null;
  const fromUrl = new URLSearchParams(window.location.search).get('location_id');
  if (fromUrl) {
    sessionStorage.setItem(STORAGE_KEY, fromUrl);
    return fromUrl;
  }
  return sessionStorage.getItem(STORAGE_KEY);
}

export function setIframeLocationId(locationId) {
  if (!locationId || typeof window === 'undefined') return;
  sessionStorage.setItem(STORAGE_KEY, locationId);
}

export function clearIframeLocationId() {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(STORAGE_KEY);
}

export function appendLocationIdToPath(path, locationId = getIframeLocationId()) {
  if (!locationId) return path;
  const [pathname, search = ''] = path.split('?');
  const params = new URLSearchParams(search);
  params.set('location_id', locationId);
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}

export function withLocationIdParams(params = {}) {
  const locationId = getIframeLocationId();
  if (!locationId) return params;
  return { ...params, location_id: locationId };
}

export function withLocationIdHeaders(headers = {}) {
  const locationId = getIframeLocationId();
  if (!locationId) return headers;
  return { ...headers, 'X-Location-Id': locationId };
}
