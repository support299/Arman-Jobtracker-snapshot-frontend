import React from 'react';
import { Provider, useSelector } from 'react-redux';
import { persistor, store } from './store/index.js';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Outlet, Navigate } from "react-router-dom";
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { CssBaseline } from '@mui/material';

// Import pages
import Index from "./pages/Index.jsx";
import NotFound from "./pages/NotFound.jsx";
import { AdminLayout } from './components/layouts/AdminLayout.jsx';
import AdminDashboard from './pages/admin/AdminDashboard.jsx';
import ServicesManagement from './pages/admin/ServicesManagement.jsx';
import LocationsManagement from './pages/admin/LocationsManagement.jsx';
import AccountSettings from './pages/admin/AccountSettings.jsx';
import ReferralOwnerDashboard from './pages/admin/ReferralOwnerDashboard.jsx';
import LocationOAuthCallback from './pages/admin/LocationOAuthCallback.jsx';
import { BookingWizard } from './components/user/BookingWizard.jsx';
import UserLogin from './pages/admin/userLogin.jsx';
import AdminProtectedRoute from './pages/AdminProtectedRoute.jsx';
import QuoteDetailsPage from './pages/user/QuoteDetailsPage.jsx';
import OriginalProposalPage from './pages/user/OriginalProposalPage.jsx';
import InvoicePaymentPage from './pages/user/InvoicePaymentPage.jsx';
import ReferralClaimPage from './pages/user/ReferralClaimPage.jsx';
import ReferralCustomerHubPage from './pages/user/ReferralCustomerHubPage.jsx';
import HouseSizeInfo from './components/admin/HouseSizeInfo.jsx';
import PlatformProtectedRoute from './platform/PlatformProtectedRoute.jsx';
import PlatformLayout from './platform/PlatformLayout.jsx';
import PlatformDashboard from './platform/pages/PlatformDashboard.jsx';
import PlatformAccounts from './platform/pages/PlatformAccounts.jsx';
import PlatformAccountDetail from './platform/pages/PlatformAccountDetail.jsx';
import PlatformOnboarding from './platform/pages/PlatformOnboarding.jsx';
import PlatformHealth from './platform/pages/PlatformHealth.jsx';
import PlatformAudit from './platform/pages/PlatformAudit.jsx';
import PlatformCompanies from './platform/pages/PlatformCompanies.jsx';
import { PersistGate } from 'redux-persist/integration/react';
import TermsAndConditions from './pages/user/TermsAndConditions.jsx';
import Jobs from './pages/admin/Jobs.jsx';
import JobsMap from './pages/admin/JobsMap.jsx';
import AdminCalendar from './pages/admin/AdminCalendar.jsx';
import TeamManagement from './pages/admin/TeamManagement.jsx';
import AcceptedQuotes from './pages/admin/AcceptedQuotes.jsx';
import PendingRescheduleQuotes from './pages/admin/PendingRescheduleQuotes.jsx';
import OnHoldJobs from './pages/admin/OnHoldJobs.jsx';
import CreateJob from './pages/admin/CreateJob.jsx';
import CalendarCreateJob from './pages/admin/CalendarCreateJob.jsx';
import RoleProtectedRoute from './pages/RoleProtectedRoute.jsx';
import TimeClock from './pages/admin/payroll/TimeClock.jsx';
import PayrollTimeOff from './pages/admin/payroll/PayrollTimeOff.jsx';
import PayrollCalculator from './pages/admin/payroll/PayrollCalculator.jsx';
import PayrollReports from './pages/admin/payroll/PayrollReports.jsx';
import PayrollSettings from './pages/admin/payroll/PayrollSettings.jsx';
import PayrollTeamManagement from './pages/admin/payroll/PayrollTeamManagement.jsx';
import Contacts from './pages/admin/Contacts.jsx';
import ContactDetail from './pages/admin/ContactDetail.jsx';
import ContactProfilePage from './pages/contact/ContactProfilePage.jsx';
import Unauthorized from './pages/admin/Unauthorized.jsx';
import { canAccessPayrollTimeClock } from './utils/payrollAccess.js';
import { appendLocationIdToPath } from './utils/iframeContext.js';

// Create Material-UI theme that integrates with our design system
const theme = createTheme({
  palette: {
    primary: {
      main: 'hsl(224, 76%, 48%)',
    },
    secondary: {
      main: 'hsl(259, 70%, 55%)',
    },
    background: {
      default: 'hsl(0, 0%, 100%)',
      paper: 'hsl(0, 0%, 100%)',
    },
  },
  typography: {
    fontFamily: '"Inter", "system-ui", sans-serif',
  },
  shape: {
    borderRadius: 8,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 600,
        },
      },
    },
  },
});

const queryClient = new QueryClient();

const PayrollTimeClockRoute = () => {
  const user = useSelector((state) => state.auth.user);
  const userProfile = useSelector((state) => state.auth.user_profile);
  const role = String(user?.role ?? 'worker').toLowerCase();
  const needsPayScaleType = role === 'worker' || role === 'manager';

  if (needsPayScaleType && !userProfile) {
    return null;
  }

  if (!canAccessPayrollTimeClock(user?.role, userProfile, user)) {
    return <Navigate to={appendLocationIdToPath('/admin/payroll/reports')} replace />;
  }

  return <TimeClock />;
};

function App() {
  return (
    <Provider store={store}>
      <PersistGate loading={null} persistor={persistor}>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider theme={theme}>
            <CssBaseline />
            <TooltipProvider>
              <Toaster />
              <Sonner />
              <BrowserRouter>
                <Routes>
                  {/* Public Routes */}
                  <Route path="/" element={<Navigate to="/booking" replace />} />
                  <Route path="/booking" element={<BookingWizard />} />
                  <Route path="/public-quote" element={<BookingWizard mode="public" />} />
                  <Route path="/quote/details/:id" element={<QuoteDetailsPage />} />
                  <Route path="/quote/original/:id" element={<OriginalProposalPage />} />
                  <Route path="/invoice/:jobId" element={<InvoicePaymentPage />} />
                  <Route path="/r/:code" element={<ReferralClaimPage />} />
                  <Route path="/refer" element={<ReferralCustomerHubPage />} />
                  <Route path="/portal/contacts/:id" element={<ContactDetail />} />
                  <Route path="/contact/jobs/:ghl_contact_id" element={<ContactProfilePage />} />
                  <Route path="/contact/profile/:ghl_contact_id" element={<ContactProfilePage />} />
                  <Route path="/terms" element={<TermsAndConditions />} />
                  <Route path="/oauth/location-callback" element={<LocationOAuthCallback />} />
                  
                  {/* Admin Login Route */}
                  <Route path="/admin/login" element={<UserLogin />} />

                  {/* Platform Portal — superuser only, separate shell */}
                  <Route path="/platform" element={
                    <PlatformProtectedRoute>
                      <PlatformLayout />
                    </PlatformProtectedRoute>
                  }>
                    <Route index element={<Navigate to="/platform/dashboard" replace />} />
                    <Route path="dashboard" element={<PlatformDashboard />} />
                    <Route path="accounts" element={<PlatformAccounts />} />
                    <Route path="accounts/:id" element={<PlatformAccountDetail />} />
                    <Route path="onboarding" element={<PlatformOnboarding />} />
                    <Route path="health" element={<PlatformHealth />} />
                    <Route path="audit" element={<PlatformAudit />} />
                    <Route path="companies" element={<PlatformCompanies />} />
                  </Route>
                  
                  {/* Standalone Calendar Create Job Route (no AdminLayout) */}
                  <Route path="/admin/calendar/create-job" element={
                    <AdminProtectedRoute>
                      <RoleProtectedRoute allowedRoles={['admin', 'manager', 'supervisor', 'agency']}>
                        <CalendarCreateJob />
                      </RoleProtectedRoute>
                    </AdminProtectedRoute>
                  } />
                  
                  {/* Protected Admin Routes */}
                  <Route path="/admin" element={
                    <AdminProtectedRoute >
                      <AdminLayout userRole="worker">
                        <Outlet />
                      </AdminLayout>
                    </AdminProtectedRoute>
                  }>
                    <Route path="dashboard" element={
                      <RoleProtectedRoute allowedRoles={['admin', 'manager', 'supervisor']}>
                        <AdminDashboard />
                      </RoleProtectedRoute>
                    } />
                    <Route path="jobs" element={<Jobs />} />
                    <Route path="unauthorized" element={<Unauthorized />} />
                    <Route path="map" element={
                        <RoleProtectedRoute allowedRoles={['admin', 'manager', 'supervisor']}>
                          <JobsMap />
                        </RoleProtectedRoute>
                    } />
                    {/* <Route path="jobs/:id" element={<JobDetails />} /> */}
                    <Route path="accepted-quotes" element={
                        <RoleProtectedRoute allowedRoles={['manager', 'supervisor']}>
                          <AcceptedQuotes />
                        </RoleProtectedRoute>
                      }
                    />
                    <Route path="pending-reschedule-quotes" element={
                        <RoleProtectedRoute allowedRoles={['manager', 'supervisor']}>
                          <PendingRescheduleQuotes />
                        </RoleProtectedRoute>
                      }
                    />
                    <Route path="on-hold-jobs" element={
                        <RoleProtectedRoute allowedRoles={['admin', 'manager', 'supervisor']}>
                          <OnHoldJobs />
                        </RoleProtectedRoute>
                    } />
                    <Route path="team" element={
                        <RoleProtectedRoute allowedRoles={['manager', 'supervisor']}>
                          <TeamManagement />
                        </RoleProtectedRoute>
                      }
                    />
                    <Route path="contacts" element={
                        <RoleProtectedRoute allowedRoles={['admin', 'manager', 'supervisor']}>
                          <Contacts />
                        </RoleProtectedRoute>
                      }
                    />
                    <Route path="contacts/:id" element={
                        <RoleProtectedRoute allowedRoles={['admin', 'manager', 'supervisor']}>
                          <ContactDetail />
                        </RoleProtectedRoute>
                      }
                    />
                    <Route path="calendar" element={<AdminCalendar />} />
                    <Route path="create-job" element={
                        <RoleProtectedRoute allowedRoles={['manager', 'supervisor']}>
                          <CreateJob />
                        </RoleProtectedRoute>
                      }
                    />
                    <Route path="services" element={
                        <RoleProtectedRoute allowedRoles={['manager', 'supervisor']}>
                          <ServicesManagement />
                        </RoleProtectedRoute>
                      }
                    />
                    <Route path="locations" element={
                        <RoleProtectedRoute allowedRoles={['manager', 'supervisor']}>
                          <LocationsManagement />
                        </RoleProtectedRoute>
                      }
                    />
                    <Route path="account-settings" element={
                        <RoleProtectedRoute allowedRoles={['manager', 'supervisor']}>
                          <AccountSettings />
                        </RoleProtectedRoute>
                      }
                    />
                    <Route path="referrals" element={
                        <RoleProtectedRoute allowedRoles={['manager', 'supervisor', 'admin', 'agency']}>
                          <ReferralOwnerDashboard />
                        </RoleProtectedRoute>
                      }
                    />
                    <Route path="house-size-info" element={
                        <RoleProtectedRoute allowedRoles={['manager', 'supervisor']}>
                          <HouseSizeInfo />
                        </RoleProtectedRoute>
                      }
                    />
                    <Route path="subaccounts" element={<Navigate to="/platform/accounts" replace />} />
                    
                    {/* Payroll Routes */}
                    <Route path="payroll" element={<PayrollTimeClockRoute />} />
                    <Route path="payroll/time-off" element={<PayrollTimeOff />} />
                    <Route path="payroll/calculator" element={
                        <RoleProtectedRoute allowedRoles={['admin', 'supervisor']} redirectPath="/admin/payroll/reports">
                          <PayrollCalculator />
                        </RoleProtectedRoute>
                      }
                    />
                    <Route path="payroll/reports" element={<PayrollReports />} />
                    <Route path="payroll/settings" element={
                        <RoleProtectedRoute allowedRoles={['admin', 'supervisor']} redirectPath="/admin/payroll/reports">
                          <PayrollSettings />
                        </RoleProtectedRoute>
                      }
                    />
                    {/* <Route path="payroll/team" element={
                        <RoleProtectedRoute allowedRoles={['admin', 'manager', 'supervisor']}>
                          <PayrollTeamManagement />
                        </RoleProtectedRoute>
                      }
                    /> */}
                  </Route>
                  
                  {/* Catch-all route */}
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </BrowserRouter>
            </TooltipProvider>
          </ThemeProvider>
        </QueryClientProvider>
      </PersistGate>
    </Provider>
  );
}

export default App;