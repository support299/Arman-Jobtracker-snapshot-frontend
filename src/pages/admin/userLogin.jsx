import React, { useEffect, useRef } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  CircularProgress,
  Link as MuiLink,
} from '@mui/material';
import { useDispatch, useSelector } from 'react-redux';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

// Replace this with your actual login action
import { loginUser, clearSuccess } from '../../store/slices/authSlice';
import { USER_PASSWORD } from '../../store/axios/axios';
import {
  appendLocationIdToPath,
  getIframeLocationId,
  setIframeLocationId,
} from '../../utils/iframeContext';

const UserLogin = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { loading, error, success } = useSelector((state) => state.auth);
  const [searchParams] = useSearchParams();
  const email = searchParams.get("email");
  const locationId = searchParams.get("location_id");
  const navigationHandled = useRef(false);

  const defaultRedirectPath = (userRole) => {
    if (userRole === 'admin' || userRole === 'manager') {
      return appendLocationIdToPath('/admin/dashboard');
    }
    return appendLocationIdToPath('/admin/jobs');
  };

  useEffect(() => {
    if (locationId) {
      setIframeLocationId(locationId);
    }
  }, [locationId]);

  useEffect(() => {
    if (email) {
      navigationHandled.current = true;
      const returnTo = localStorage.getItem('returnTo');
      console.log('returnTo (auto-login email - before dispatch):', returnTo);

      dispatch(loginUser({
        username: email,
        password: USER_PASSWORD,
        location_id: locationId || getIframeLocationId(),
      }))
        .unwrap()
        .then((response) => {
          if (returnTo) {
            localStorage.removeItem('returnTo');
            dispatch(clearSuccess());
            navigate(appendLocationIdToPath(returnTo), { replace: true });
          } else {
            const userRole = response?.user?.role || 'worker';
            dispatch(clearSuccess());
            navigate(defaultRedirectPath(userRole), { replace: true });
          }
        })
        .catch(() => {
          navigationHandled.current = false;
        });
    }
  }, [email, locationId, dispatch, navigate]);

  // Note: Navigation is handled in form submission and auto-login handlers above
  // This useEffect is kept as a fallback only if navigation wasn't handled
  useEffect(() => {
    if (success && !navigationHandled.current) {
      const timer = setTimeout(() => {
        const returnTo = localStorage.getItem('returnTo');
        console.log('returnTo (success useEffect fallback):', returnTo);

        if (returnTo) {
          localStorage.removeItem('returnTo');
          dispatch(clearSuccess());
          navigate(appendLocationIdToPath(returnTo), { replace: true });
          return;
        }

        const currentPath = window.location.pathname;
        if (currentPath === '/admin/login') {
          const user = JSON.parse(localStorage.getItem('user') || '{}');
          const userRole = user?.role || 'worker';
          dispatch(clearSuccess());
          navigate(defaultRedirectPath(userRole), { replace: true });
        } else {
          dispatch(clearSuccess());
        }
      }, 100);

      return () => clearTimeout(timer);
    }

    if (success && navigationHandled.current) {
      dispatch(clearSuccess());
      navigationHandled.current = false;
    }
  }, [success, navigate, dispatch]);

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
        navigationHandled.current = true;
        // Read returnTo BEFORE login to avoid race condition with success useEffect
        const returnTo = localStorage.getItem('returnTo');
        console.log('returnTo (form login - before dispatch):', returnTo);
        
        const response = await dispatch(loginUser({
          ...values,
          location_id: locationId || getIframeLocationId(),
        })).unwrap();

        if (returnTo) {
          localStorage.removeItem('returnTo');
          dispatch(clearSuccess());
          navigate(appendLocationIdToPath(returnTo), { replace: true });
        } else {
          const userRole = response?.user?.role || 'worker';
          dispatch(clearSuccess());
          navigate(defaultRedirectPath(userRole), { replace: true });
        }
      } catch (error) {
        navigationHandled.current = false;
        // Error is handled by Redux state
      }
    },
  });

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
              Don't have an account?{' '}
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
