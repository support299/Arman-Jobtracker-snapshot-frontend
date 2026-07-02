import { useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { clearSsoError, ssoAutoLogin } from '../store/slices/authSlice';
import {
  buildSsoAttemptKey,
  sessionMatchesUrl,
} from '../utils/urlSsoLogin';
import { getIframeLocationId, setIframeLocationId } from '../utils/iframeContext';

/**
 * Watch URL for email / sso_token + location_id and SSO-login or switch users.
 *
 * @param {object} options
 * @param {boolean} [options.enabled=true]
 * @param {(response: object) => void} [options.onSuccess] - e.g. navigate after login page
 */
export function useUrlSsoLogin({ enabled = true, onSuccess } = {}) {
  const dispatch = useDispatch();
  const [searchParams] = useSearchParams();
  const user = useSelector((state) => state.auth.user);
  const account = useSelector((state) => state.auth.account);
  const loading = useSelector((state) => state.auth.loading);
  const ssoError = useSelector((state) => state.auth.ssoError);
  const switching = useSelector((state) => state.auth.ssoSwitching);

  const email = searchParams.get('email');
  const ssoToken = searchParams.get('sso_token');
  const locationId = searchParams.get('location_id') || getIframeLocationId();

  const lastSuccessKey = useRef(null);
  const activeAttemptKey = useRef(null);
  const onSuccessRef = useRef(onSuccess);
  onSuccessRef.current = onSuccess;

  useEffect(() => {
    if (locationId) {
      setIframeLocationId(locationId);
    }
  }, [locationId]);

  useEffect(() => {
    if (!enabled) return;
    if (!locationId) return;
    if (!email && !ssoToken) return;

    const attemptKey = buildSsoAttemptKey({ email, ssoToken, locationId });

    if (email && user && sessionMatchesUrl(user, account, email, locationId)) {
      lastSuccessKey.current = attemptKey;
      if (ssoError) {
        dispatch(clearSsoError());
      }
      return;
    }

    if (loading && lastSuccessKey.current !== attemptKey) {
      return;
    }

    if (lastSuccessKey.current === attemptKey && (user || ssoError)) {
      return;
    }

    const hadExistingSession = Boolean(user?.email || user?.username);
    activeAttemptKey.current = attemptKey;

    dispatch(
      ssoAutoLogin({
        email: email || undefined,
        token: ssoToken || undefined,
        location_id: locationId,
        hadExistingSession,
      }),
    )
      .unwrap()
      .then((response) => {
        if (activeAttemptKey.current !== attemptKey) return;
        lastSuccessKey.current = attemptKey;
        onSuccessRef.current?.(response);
      })
      .catch(() => {
        if (activeAttemptKey.current !== attemptKey) return;
        lastSuccessKey.current = attemptKey;
      });
  }, [
    dispatch,
    email,
    ssoToken,
    locationId,
    enabled,
    user?.email,
    user?.username,
    account?.location_id,
    loading,
    ssoError,
  ]);

  return {
    email,
    ssoToken,
    locationId,
    switching,
    ssoError,
    loading,
  };
}
