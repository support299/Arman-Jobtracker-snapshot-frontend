import { patchGhlAccount } from '../store/slices/authSlice';
import { quoteApi } from '../store/api/user/quoteApi';
import { getIframeLocationId } from './iframeContext';

/**
 * After Account Settings save, push branding/currency into Redux and RTK cache
 * so useAccountCurrency, useAccountBranding, and CompanyLogo update without re-login.
 */
export function syncAccountBrandingAfterSettings(dispatch, settings = {}) {
  const patch = {};
  if (settings.currency) {
    patch.currency = settings.currency;
  }
  if (settings.account_name) {
    patch.account_name = settings.account_name;
  }
  if (Object.keys(patch).length > 0) {
    dispatch(patchGhlAccount(patch));
  }

  const locationId = settings.location_id || getIframeLocationId();
  if (locationId) {
    dispatch(
      quoteApi.util.updateQueryData(
        'getAccountInfo',
        { location_id: locationId },
        (draft) => {
          if (!draft) return;
          if (settings.currency) {
            draft.currency = settings.currency;
          }
          if (settings.account_name) {
            draft.account_name = settings.account_name;
          }
          if (settings.logo_url !== undefined) {
            draft.logo_url = settings.logo_url;
          }
          if (settings.booking_redirect_url !== undefined) {
            draft.booking_redirect_url = settings.booking_redirect_url;
          }
          if (settings.invoice_link_base_url !== undefined) {
            draft.invoice_link_base_url = settings.invoice_link_base_url;
          }
        },
      ),
    );
  }

  dispatch(quoteApi.util.invalidateTags(['AccountInfo']));
}
