import React, { useCallback, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  CircularProgress,
  Link as MuiLink,
  Alert,
} from '@mui/material';
import { useDispatch, useSelector } from 'react-redux';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

import { loginUser, clearSuccess } from '../../store/slices/authSlice';
import { useUrlSsoLogin } from '../../hooks/useUrlSsoLogin';
import { friendlySsoErrorMessage } from '../../utils/urlSsoLogin';
import { getIframeLocationId } from '../../utils/iframeContext';
import { getPostLoginRedirectPath, resolvePostLoginNavigation } from '../../utils/postLoginRedirect';

const UserLogin = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { loading, error, user, access } = useSelector((state) => state.auth);
  const [searchParams] = useSearchParams();
  const email = searchParams.get('email');
  const locationId = searchParams.get('location_id');

  useEffect(() => {
    if (!access || !user) return;
    const returnTo = localStorage.getItem('returnTo');
    if (returnTo) return;

    navigate(
      getPostLoginRedirectPath({ user, userRole: user.role, locationId }),
      { replace: true },
    );
  }, [access, user, navigate, locationId]);

  const finishLoginNavigation = useCallback(
    (response) => {
      const returnTo = localStorage.getItem('returnTo');
      if (returnTo) {
        localStorage.removeItem('returnTo');
      }
      dispatch(clearSuccess());
      navigate(
        resolvePostLoginNavigation({
          user: response?.user,
          userRole: response?.user?.role,
          locationId,
          returnTo,
        }),
        { replace: true },
      );
    },
    [dispatch, navigate, locationId],
  );

  const { switching, ssoError, loading: ssoLoading } = useUrlSsoLogin({
    enabled: Boolean((email || searchParams.get('sso_token')) && (locationId || getIframeLocationId())),
    onSuccess: finishLoginNavigation,
  });

  const formik = useFormik({
    initialValues: {
      username: '',
      password: '',
    },
    validationSchema: Yup.object({
      username: Yup.string().required('username is required'),
      password: Yup.string().required('Password is required'),
    }),
    onSubmit: async (values) => {
      try {
        const returnTo = localStorage.getItem('returnTo');
        if (returnTo) {
          localStorage.removeItem('returnTo');
        }

        const response = await dispatch(
          loginUser({
            ...values,
            location_id: locationId || getIframeLocationId(),
          }),
        ).unwrap();

        dispatch(clearSuccess());
        navigate(
          resolvePostLoginNavigation({
            user: response?.user,
            userRole: response?.user?.role,
            locationId,
            returnTo,
          }),
          { replace: true },
        );
      } catch {
        // Error is handled by Redux state
      }
    },
  });

  const isAutoLoggingIn = (ssoLoading || loading) && (email || searchParams.get('sso_token'));

  if (isAutoLoggingIn && !ssoError) {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          bgcolor: '#f4f5f7',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          gap: 2,
        }}
      >
        <CircularProgress size={32} />
        <Typography color="text.secondary">
          Signing in{email ? ` as ${email}` : ''}…
        </Typography>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        background: '#f5f5f5',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        px: 2,
      }}
    >
      <Card
        sx={{
          maxWidth: 400,
          width: '100%',
          p: 3,
          boxShadow: 4,
          borderRadius: 3,
        }}
      >
        <CardContent>
          <Box mb={3} textAlign="center">
            <Typography variant="h5" fontWeight="bold">
              Welcome Back
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Sign in to your account
            </Typography>
          </Box>

          {ssoError && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              {friendlySsoErrorMessage(ssoError, email)}
            </Alert>
          )}

          <form onSubmit={formik.handleSubmit} noValidate>
            <Box mb={2}>
              <TextField
                fullWidth
                label="Username"
                name="username"
                type="username"
                variant="outlined"
                value={formik.values.username}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                error={formik.touched.username && Boolean(formik.errors.username)}
                helperText={formik.touched.username && formik.errors.username}
              />
            </Box>

            <Box mb={2}>
              <TextField
                fullWidth
                label="Password"
                name="password"
                type="password"
                variant="outlined"
                value={formik.values.password}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                error={formik.touched.password && Boolean(formik.errors.password)}
                helperText={formik.touched.password && formik.errors.password}
              />
            </Box>

            {error && (
              <Typography variant="body2" color="error" mb={2}>
                {error}
              </Typography>
            )}

            <Button
              type="submit"
              variant="contained"
              fullWidth
              disabled={loading}
              sx={{ py: 1.5, fontWeight: 'bold', mb: 2 }}
            >
              {loading ? <CircularProgress size={24} color="inherit" /> : 'Login'}
            </Button>

            <Typography variant="body2" align="center" color="text.secondary">
              Don&apos;t have an account?{' '}
              <MuiLink component={Link} to="/signup" color="primary">
                Sign up
              </MuiLink>
            </Typography>
          </form>
        </CardContent>
      </Card>
    </Box>
  );
};

export default UserLogin;
