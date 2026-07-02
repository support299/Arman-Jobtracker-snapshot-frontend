import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';
import { BASE_URL } from '../axios/axios';


const access = localStorage.getItem('access');
const refresh = localStorage.getItem('refresh');
const user_profile = localStorage.getItem('user_profile');
const user = localStorage.getItem('user');
const ghl_account = localStorage.getItem('ghl_account');

const initialState = {
  admin: null,
  access: access,
  refresh: refresh,
  user_profile: user_profile ? JSON.parse(user_profile) : null,
  account: ghl_account ? JSON.parse(ghl_account) : null,
  user: user ? JSON.parse(user) : null,
  error: null,
  ssoError: null,
  ssoSwitching: false,
  isAuthenticated: false,
  loading: false,
  success: false,
};

// Login User
export const loginUser = createAsyncThunk(
  'auth/loginUser',
  async (credentials, { rejectWithValue }) => {
    try {
      const response = await axios.post(`${BASE_URL}/service/auth/login/`, credentials);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.detail || error.response?.data?.message || 'Login failed');
    }
  }
);

/**
 * GHL iframe autologin: one-time SSO token → JWT session.
 * Pass either `token` (from URL) or `email` (+ location_id) to mint then exchange.
 */
export const ssoAutoLogin = createAsyncThunk(
  'auth/ssoAutoLogin',
  async ({ email, token, location_id, hadExistingSession = false }, { rejectWithValue }) => {
    try {
      const loc = location_id || '';
      if (token) {
        const response = await axios.post(`${BASE_URL}/service/auth/sso/exchange/`, {
          token,
          location_id: loc,
        });
        return response.data;
      }

      if (!email) {
        return rejectWithValue('email or sso_token is required for autologin');
      }

      const initResponse = await axios.post(`${BASE_URL}/service/auth/sso/init/`, {
        email,
        location_id: loc,
      });
      const exchangeResponse = await axios.post(`${BASE_URL}/service/auth/sso/exchange/`, {
        token: initResponse.data.token,
        location_id: loc,
      });
      return exchangeResponse.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.detail || error.response?.data?.message || 'Autologin failed',
      );
    }
  },
);

// Logout User
export const logoutUser = createAsyncThunk(
  'auth/logoutUser',
  async (_, { getState, rejectWithValue }) => {
    try {
      const state = getState();
      const { access, refresh } = state.auth;

      if (!access || !refresh) return;

      await axios.post(`${BASE_URL}/service/auth/logout/`, { refresh: refresh }, {
        headers: {
          Authorization: `Bearer ${access}`,
        },
      });

      return;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Logout failed');
    }
  }
);

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    logout: (state) => {
      state.access = null;
      state.refresh = null;
      state.isAuthenticated = false;
      state.error = null;
    },
    clearError: (state) => {
      state.error = null;
    },
    clearSuccess: (state) => {
      state.success = false;
    },
    clearSsoError: (state) => {
      state.ssoError = null;
    },
    setCredentials: (state, action) => {
      state.access = action.payload.access;
      state.refresh = action.payload.refresh;
      state.isAuthenticated = true;
      state.error = null;
    },
    /** Merge public GHL account fields after Account Settings save (currency, name, etc.). */
    patchGhlAccount: (state, action) => {
      if (!state.account) return;
      state.account = { ...state.account, ...action.payload };
      localStorage.setItem('ghl_account', JSON.stringify(state.account));
    },
  },
  extraReducers: (builder) => {
    const applyLoginPayload = (state, action) => {
      state.loading = false;
      state.access = action.payload.access;
      state.refresh = action.payload.refresh;
      state.user = action.payload.user;
      const profileData = action.payload.employee_profile || action.payload.user_profile;
      state.user_profile = profileData;
      state.account = action.payload.account || null;
      localStorage.setItem('access', action.payload.access);
      localStorage.setItem('refresh', action.payload.refresh);
      localStorage.setItem('user_profile', JSON.stringify(profileData));
      localStorage.setItem('user', JSON.stringify(action.payload.user));
      if (action.payload.account) {
        localStorage.setItem('ghl_account', JSON.stringify(action.payload.account));
      } else {
        localStorage.removeItem('ghl_account');
      }
      state.isAuthenticated = true;
      state.error = null;
      state.ssoError = null;
      state.ssoSwitching = false;
      state.success = true;
    };

    builder
      // Login User
      .addCase(loginUser.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(loginUser.fulfilled, applyLoginPayload)
      .addCase(loginUser.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
        state.isAuthenticated = false;
      })

      // SSO autologin (iframe)
      .addCase(ssoAutoLogin.pending, (state, action) => {
        state.loading = true;
        state.ssoSwitching = Boolean(action.meta.arg?.hadExistingSession);
        state.ssoError = null;
        if (!action.meta.arg?.hadExistingSession) {
          state.error = null;
        }
      })
      .addCase(ssoAutoLogin.fulfilled, applyLoginPayload)
      .addCase(ssoAutoLogin.rejected, (state, action) => {
        state.loading = false;
        state.ssoSwitching = false;
        const message = action.payload || 'Autologin failed';
        state.ssoError = message;

        if (action.meta.arg?.hadExistingSession) {
          // Keep current session when switching users fails (unknown email, etc.)
          return;
        }

        state.error = message;
        state.isAuthenticated = false;
      })

      // Logout User
      .addCase(logoutUser.fulfilled, (state) => {
        state.user_profile = null;
        state.account = null;
        state.user = null;
        state.access = null;
        state.refresh = null;
        state.isAuthenticated = false;
        state.error = null;
        state.success = false;
        localStorage.removeItem('access');
        localStorage.removeItem('refresh');
        localStorage.removeItem('user_profile');
        localStorage.removeItem('ghl_account');
        localStorage.removeItem('user');
      })
      .addCase(logoutUser.rejected, (state) => {
        state.user = null;
        state.access = null;
        state.refresh = null;
        state.isAuthenticated = false;
        state.error = null;
        localStorage.removeItem('access');
        localStorage.removeItem('refresh');
      });
  },
});

export const { logout, clearError, clearSuccess, clearSsoError, setCredentials, patchGhlAccount } = authSlice.actions;
export default authSlice.reducer;
