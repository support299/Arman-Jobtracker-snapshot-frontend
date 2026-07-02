import { useMemo } from 'react';
import { useSelector } from 'react-redux';
import { useSearchParams } from 'react-router-dom';
import { useGetAccountInfoQuery } from '../store/api/user/quoteApi';
import { resolveBrandingLocationId } from './useAccountBranding';
import { resolveAccountCurrency, DEFAULT_ACCOUNT_CURRENCY } from '../utils/accountCurrency';

/**
 * GHL location currency for admin UI.
 *
 * Prefers live `/quote/account-info/` (refreshed after Account Settings) and falls
 * back to login `auth.account` when account-info is unavailable.
 *
 * @param {string | undefined} override Highest priority — e.g. per-record currency from API.
 */
export function useAccountCurrency(override) {
  const [searchParams] = useSearchParams();
  const locationId = resolveBrandingLocationId(searchParams);
  const ghlAccount = useSelector((state) => state.auth.account);

  const { data: accountInfo } = useGetAccountInfoQuery(
    { location_id: locationId },
    { skip: !locationId },
  );

  return useMemo(() => {
    if (override) return override;

    const fromAccountInfo = accountInfo?.currency;
    if (fromAccountInfo) {
      return resolveAccountCurrency({ accountCurrency: fromAccountInfo });
    }

    if (ghlAccount?.currency) {
      return resolveAccountCurrency({ ghlAccount });
    }

    return DEFAULT_ACCOUNT_CURRENCY;
  }, [override, accountInfo?.currency, ghlAccount?.currency]);
}

export { DEFAULT_ACCOUNT_CURRENCY };
