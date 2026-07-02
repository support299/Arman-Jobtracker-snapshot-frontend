import React from 'react';
import { Alert, Backdrop, CircularProgress, Typography } from '@mui/material';
import { useSearchParams } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { clearSsoError } from '../../store/slices/authSlice';
import { useUrlSsoLogin } from '../../hooks/useUrlSsoLogin';
import { friendlySsoErrorMessage } from '../../utils/urlSsoLogin';

/**
 * Handles dynamic SSO when GHL iframe URL includes email + location_id.
 * Switches logged-in user when the email param changes; shows errors inline.
 */
export function IframeSsoLoginHandler() {
  const dispatch = useDispatch();
  const [searchParams] = useSearchParams();
  const urlEmail = searchParams.get('email');

  const { switching, ssoError } = useUrlSsoLogin({ enabled: true });

  if (!urlEmail && !searchParams.get('sso_token')) {
    return null;
  }

  return (
    <>
      <Backdrop
        open={switching}
        sx={{
          color: '#fff',
          zIndex: (theme) => theme.zIndex.drawer + 2,
          flexDirection: 'column',
          gap: 1.5,
        }}
      >
        <CircularProgress color="inherit" size={28} />
        <Typography variant="body2">
          Signing in{urlEmail ? ` as ${urlEmail}` : ''}…
        </Typography>
      </Backdrop>

      {ssoError && (
        <Alert
          severity="warning"
          onClose={() => dispatch(clearSsoError())}
          sx={{
            borderRadius: 0,
            borderBottom: '1px solid',
            borderColor: 'divider',
          }}
        >
          {friendlySsoErrorMessage(ssoError, urlEmail)}
        </Alert>
      )}
    </>
  );
}

export default IframeSsoLoginHandler;
