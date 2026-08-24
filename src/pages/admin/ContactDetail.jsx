import React, { useEffect, useMemo, useState } from 'react';
import { Link as RouterLink, useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  Alert,
  Avatar,
  Box,
  Breadcrumbs,
  Button,
  Chip,
  Grid,
  Link,
  Paper,
  Skeleton,
  Stack,
  Tab,
  Tabs,
  Typography,
  alpha,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import DescriptionOutlined from '@mui/icons-material/DescriptionOutlined';
import PendingActionsOutlined from '@mui/icons-material/PendingActionsOutlined';
import ReceiptLongOutlined from '@mui/icons-material/ReceiptLongOutlined';
import EventOutlined from '@mui/icons-material/EventOutlined';
import PaidOutlined from '@mui/icons-material/PaidOutlined';
import AccountBalanceOutlined from '@mui/icons-material/AccountBalanceOutlined';
import ListAltOutlined from '@mui/icons-material/ListAltOutlined';
import { ArrowBack, ContentCopy, OpenInNew, CardGiftcard } from '@mui/icons-material';
import TableChart from '@mui/icons-material/TableChart';
import moment from 'moment-timezone';
import { useGetDashboardContactByIdQuery } from '../../store/api/dashboardApi';
import { useEnsureReferralLinkMutation } from '../../store/api/referralsApi';
import { ContactActivitySplit } from '../../components/admin/contacts/ContactActivitySplit';
import { ContactJobJobCard } from '../../components/admin/contacts/ContactJobJobCard';
import {
  ContactQuotePanel,
  ContactInvoicePanel,
  ContactAppointmentPanel,
  ContactAddressPanel,
} from '../../components/admin/contacts/ContactMiscPanels';
import { ContactAddressFormDialog } from '../../components/contacts/ContactAddressFormDialog';
import {
  useCreateContactAddressMutation,
  useDeleteContactAddressMutation,
  useUpdateContactAddressMutation,
} from '../../store/api/contactProfileApi';
import { ContactPickRow } from '../../components/admin/contacts/ContactPickRow';
import { contactsPageSx, portalInviteSx, PORTAL_INSIGHT_AVATAR_GRADIENTS } from './contactsTheme';
import { exportInvoicesToCsv } from '../../utils/exportInvoicesCsv';
import { jobGrandTotalAmount } from '../../utils/jobPricing';
import { CompanyContactBanner } from '../../components/contacts/CompanyContactBanner';
import { useMoneyFormatter } from '../../hooks/useMoneyFormatter';
import { formatMoney } from '../../utils/formatMoney';

const when = (iso) => {
  if (!iso) return '—';
  try {
    return moment.utc(iso).format('MMM D, YYYY · h:mm A');
  } catch {
    return iso;
  }
};

function initials(first, last, email) {
  const f = (first || '').trim().charAt(0);
  const l = (last || '').trim().charAt(0);
  if (f || l) return `${f}${l}`.toUpperCase();
  const e = (email || '').trim().charAt(0);
  return e ? e.toUpperCase() : '?';
}

/**
 * Route segment for contact detail lookup.
 * - Legacy DB primary key: digits only (e.g. `19756`).
 * - GHL contact id: GoHighLevel uses several formats — standard UUIDs and opaque
 *   alphanumeric strings (e.g. `DWhlh4FUzliSB2N5rZ6X`, `80TGhk1b5D0a9KkY0gts`).
 */
function parseContactDetailParam(raw) {
  if (raw == null) return null;
  const s = decodeURIComponent(String(raw).trim());
  if (!s) return null;
  if (/^\d+$/.test(s)) {
    const n = Number(s);
    return Number.isFinite(n) && n > 0 ? n : null;
  }
  const ghlOrUuid = /^[A-Za-z0-9_-]{6,128}$/;
  if (ghlOrUuid.test(s)) return s;
  return null;
}

const ContactDetail = () => {
  const { formatMoney: money } = useMoneyFormatter();
  const { id: idParam } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const isSmDown = useMediaQuery(theme.breakpoints.down('sm'));

  const isAdminRoute = location.pathname.startsWith('/admin');
  const isPortal = !isAdminRoute;
  const backPath = isAdminRoute ? '/admin/contacts' : '/booking';

  const contactKey = useMemo(() => parseContactDetailParam(idParam), [idParam]);

  const [tab, setTab] = useState(0);
  const [selJob, setSelJob] = useState(null);
  const [selQuote, setSelQuote] = useState(null);
  const [selPendingRequest, setSelPendingRequest] = useState(null);
  const [selInvoice, setSelInvoice] = useState(null);
  const [selAppt, setSelAppt] = useState(null);
  const [selAddr, setSelAddr] = useState(null);
  const [addrDialogOpen, setAddrDialogOpen] = useState(false);
  const [addrDialogMode, setAddrDialogMode] = useState('create');
  const [editingAddr, setEditingAddr] = useState(null);

  const [createAddress, { isLoading: creatingAddr }] = useCreateContactAddressMutation();
  const [updateAddress, { isLoading: updatingAddr }] = useUpdateContactAddressMutation();
  const [deleteAddress, { isLoading: deletingAddr }] = useDeleteContactAddressMutation();
  const [ensureReferralLink, { isLoading: ensuringReferral }] = useEnsureReferralLinkMutation();
  const [referralLocal, setReferralLocal] = useState(null);
  const [referralMsg, setReferralMsg] = useState(null);
  const [copiedReferral, setCopiedReferral] = useState(false);

  const { data, isLoading, error, refetch } = useGetDashboardContactByIdQuery(contactKey, { skip: contactKey == null });

  useEffect(() => {
    setSelJob(null);
    setSelQuote(null);
    setSelPendingRequest(null);
    setSelInvoice(null);
    setSelAppt(null);
    setSelAddr(null);
    setReferralLocal(null);
    setReferralMsg(null);
  }, [tab, contactKey]);

  const referral = referralLocal || data?.referral || null;

  const moneyCents = (cents) => money((Number(cents) || 0) / 100);

  const handleEnsureReferralLink = async () => {
    if (!data?.id) return;
    setReferralMsg(null);
    try {
      const result = await ensureReferralLink(data.id).unwrap();
      setReferralLocal({
        eligible: true,
        has_link: true,
        referral_code: result.referral_code,
        share_url: result.share_url,
        hub_url: result.hub_url,
        available_credit_cents: result.available_credit_cents ?? referral?.available_credit_cents ?? 0,
        lifetime_credit_cents: referral?.lifetime_credit_cents ?? 0,
        program_enabled: true,
      });
      setReferralMsg({ type: 'success', text: 'Referral link ready.' });
      refetch();
    } catch (err) {
      setReferralMsg({ type: 'error', text: err?.data?.detail || 'Could not create referral link.' });
    }
  };

  const handleCopyReferral = async () => {
    const url = referral?.share_url;
    if (!url) return;
    await navigator.clipboard.writeText(url);
    setCopiedReferral(true);
    window.setTimeout(() => setCopiedReferral(false), 1600);
  };

  const displayName = useMemo(() => {
    if (!data) return 'Contact';
    const n = [data.first_name, data.last_name].filter(Boolean).join(' ');
    return n || data.email || `Contact #${data.id}`;
  }, [data]);

  const handleTabChange = (_, v) => setTab(v);

  if (contactKey == null) {
    return (
      <Box sx={(t) => ({ ...(isPortal ? portalInviteSx.pageBg(t) : contactsPageSx.canvas(t)), p: 3 })}>
        <Alert severity="warning">
          Invalid contact URL. Use a GHL contact id or a numeric id for legacy links.
        </Alert>
        <Button sx={{ mt: 2 }} onClick={() => navigate(backPath)}>
          Back
        </Button>
      </Box>
    );
  }

  if (isLoading) {
    return (
      <Box sx={(t) => ({ ...(isPortal ? portalInviteSx.pageBg(t) : contactsPageSx.canvas(t)), ...contactsPageSx.shell })}>
        <Skeleton variant="text" width={280} height={32} sx={{ mb: 2 }} />
        <Skeleton variant="rectangular" height={140} sx={{ mb: 2, borderRadius: 2 }} />
        <Skeleton variant="rectangular" height={400} sx={{ borderRadius: 2 }} />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={(t) => ({ ...(isPortal ? portalInviteSx.pageBg(t) : contactsPageSx.canvas(t)), p: 3 })}>
        <Alert severity="error">{error?.data?.detail || 'Could not load this contact.'}</Alert>
        <Button sx={{ mt: 2 }} startIcon={<ArrowBack />} onClick={() => navigate(backPath)}>
          Back
        </Button>
      </Box>
    );
  }

  const summary = data.summary || {};
  const servicePilotBase = import.meta.env.VITE_SERVICE_PILOT_APP_URL || 'https://app.theservicepilot.com';
  const defaultLoc = import.meta.env.VITE_LOCATION_ID || '';
  const ghlContactUrl =
    data.contact_id && (data.location_id || defaultLoc)
      ? `${servicePilotBase}/v2/location/${data.location_id || defaultLoc}/contacts/detail/${data.contact_id}/`
      : null;

  const submissions = data.submissions || [];
  const jobs = data.jobs || [];
  const pendingRequests = data.reschedule_pending_jobs || [];
  const invoices = data.invoices || [];
  const appointments = data.appointments || [];
  const addresses = data.addresses || [];
  const ghlContactId = data.contact_id;

  const handleSaveAddress = async (payload) => {
    if (!ghlContactId) return;
    if (addrDialogMode === 'edit' && editingAddr?.id) {
      await updateAddress({ ghlContactId, addressId: editingAddr.id, ...payload }).unwrap();
    } else {
      await createAddress({ ghlContactId, ...payload }).unwrap();
    }
    refetch();
  };

  const handleDeleteAddress = async (addr) => {
    if (!ghlContactId || !addr?.id) return;
    if (!window.confirm(`Remove "${addr.name || 'this property'}"?`)) return;
    await deleteAddress({ ghlContactId, addressId: addr.id }).unwrap();
    refetch();
  };

  return (
    <Box marginTop={2} sx={(t) => ({ ...(isPortal ? portalInviteSx.pageBg(t) : contactsPageSx.canvas(t)), ...contactsPageSx.shell })}>
      {isPortal ? (
        <Box sx={portalInviteSx.hero}>
          <Typography component="h1" sx={portalInviteSx.heroTitle}>
            VIP Service Hub
          </Typography>
          <Typography sx={portalInviteSx.heroSubtitle}>
            Welcome — view quotes, jobs, invoices, and appointments in one friendly place.
          </Typography>
        </Box>
      ) : (
        <Typography sx={{ ...contactsPageSx.eyebrow, mb: 1 }}>Contact record</Typography>
      )}
      
        {isAdminRoute && (
          <Breadcrumbs
            sx={{
              mb: 2.5,
              '& .MuiTypography-root, & a': { fontSize: '0.8125rem' },
              ...(isPortal
                ? {
                    px: 0.5,
                    py: 0.75,
                    borderRadius: 2,
                    bgcolor: (th) => alpha(th.palette.primary.main, th.palette.mode === 'dark' ? 0.08 : 0.06),
                    border: '1px solid',
                    borderColor: (th) => alpha(th.palette.primary.main, 0.15),
                  }
                : {}),
            }}
            separator="›"
          >
          <>
            <Link component={RouterLink} to={backPath} underline="hover" color="text.secondary">
              Contacts
            </Link>
            <Typography color="text.primary" fontWeight={500}>
              {displayName}
            </Typography>
          </>
        </Breadcrumbs>
        )}

      {!isAdminRoute ? (
        <CompanyContactBanner mode="business" invitePortal locationId={data.location_id} />
      ) : (
        <CompanyContactBanner mode="customer" contact={data} primaryAddress={addresses[0]} />
      )}

      <Paper
        elevation={0}
        sx={(theme) => ({
          ...contactsPageSx.surface(theme),
          p: { xs: 2, sm: 3 },
          mb: 3,
          ...(isPortal
            ? {
                borderRadius: 3,
                borderColor: alpha(theme.palette.primary.main, 0.18),
                background:
                  theme.palette.mode === 'dark'
                    ? alpha(theme.palette.primary.main, 0.07)
                    : `linear-gradient(135deg, #ffffff 0%, ${alpha(theme.palette.primary.main, 0.06)} 55%, ${alpha(theme.palette.secondary.main, 0.05)} 100%)`,
                boxShadow: `0 8px 32px ${alpha(theme.palette.primary.main, 0.1)}`,
              }
            : {}),
        })}
      >
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'flex-start' }} justifyContent="space-between">
          <Stack direction="row" spacing={2} alignItems="flex-start">
            <Avatar
              sx={(theme) => ({
                width: 52,
                height: 52,
                fontWeight: 600,
                fontSize: '1.1rem',
                ...(isPortal
                  ? {
                      background: 'linear-gradient(145deg, #6366f1 0%, #3b82f6 45%, #0ea5e9 100%)',
                      color: '#fff',
                      boxShadow: `0 6px 18px ${alpha(theme.palette.primary.main, 0.35)}`,
                    }
                  : {
                      bgcolor: 'grey.200',
                      color: 'grey.800',
                    }),
              })}
            >
              {initials(data.first_name, data.last_name, data.email)}
            </Avatar>
            <Box sx={{ pt: 0.25 }}>
              {isAdminRoute && (
                <Button
                  size="small"
                  color="inherit"
                  startIcon={<ArrowBack />}
                  onClick={() => navigate(backPath)}
                  sx={{ mb: 0.75, ml: -1, fontSize: '0.8125rem', textTransform: 'none', fontWeight: 500 }}
                >
                  Back
                </Button>
              )}
              <Typography variant={isSmDown ? 'h6' : 'h5'} component="h1" sx={{ ...contactsPageSx.title, mb: 0.5 }}>
                {displayName}
              </Typography>
              <Typography sx={{ ...contactsPageSx.subtitle, mt: 0 }}>
                {[data.email, data.phone].filter(Boolean).join(' · ') || 'No email or phone'}
              </Typography>
              {data.company_name ? (
                <Typography variant="body2" fontWeight={500} color="text.primary" sx={{ mt: 1 }}>
                  {data.company_name}
                </Typography>
              ) : null}
            </Box>
          </Stack>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap justifyContent={{ xs: 'flex-start', sm: 'flex-end' }}>
            {data.dnd && <Chip label="Do not disturb" size="small" sx={{ bgcolor: 'warning.50', borderColor: 'warning.light' }} variant="outlined" />}
            {isAdminRoute && ghlContactUrl && (
              <Button variant="contained" disableElevation endIcon={<OpenInNew sx={{ fontSize: 18 }} />} href={ghlContactUrl} target="_blank" rel="noopener noreferrer" sx={{ textTransform: 'none', fontWeight: 600, borderRadius: 2, px: 2 }}>
                Open in CRM
              </Button>
            )}
          </Stack>
        </Stack>
      </Paper>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={4}>
          <InsightStat
            icon={DescriptionOutlined}
            label="Open quotes"
            value={summary.open_quotes_count ?? '—'}
            portalInvite={isPortal}
            accentIndex={0}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <InsightStat
            icon={PendingActionsOutlined}
            label="Jobs (pending / total)"
            value={`${summary.pending_jobs_count ?? 0} / ${summary.jobs_total ?? 0}`}
            portalInvite={isPortal}
            accentIndex={1}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <InsightStat
            icon={PendingActionsOutlined}
            label="Pending requests"
            value={summary.reschedule_pending_jobs_count ?? pendingRequests.length ?? 0}
            portalInvite={isPortal}
            accentIndex={7}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <InsightStat
            icon={ReceiptLongOutlined}
            label="Invoices"
            value={summary.invoices_total ?? '—'}
            hint={summary.invoice_balance_sum != null ? `${money(summary.invoice_balance_sum)} outstanding` : null}
            portalInvite={isPortal}
            accentIndex={2}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <InsightStat
            icon={EventOutlined}
            label="Appointments"
            value={summary.appointments_total ?? '—'}
            portalInvite={isPortal}
            accentIndex={3}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <InsightStat
            icon={ListAltOutlined}
            label="Quotes (all)"
            value={summary.submissions_total ?? '—'}
            portalInvite={isPortal}
            accentIndex={4}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <InsightStat
            icon={PaidOutlined}
            label="Invoiced (sum)"
            value={money(summary.invoiced_amount_sum)}
            portalInvite={isPortal}
            accentIndex={5}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <InsightStat
            icon={AccountBalanceOutlined}
            label="Invoice balance (sum)"
            value={money(summary.invoice_balance_sum)}
            portalInvite={isPortal}
            accentIndex={6}
          />
        </Grid>
      </Grid>

      <Paper
        elevation={0}
        sx={(theme) => ({
          ...contactsPageSx.surface(theme),
          overflow: 'hidden',
          ...(isPortal
            ? {
                borderRadius: 3,
                borderColor: alpha(theme.palette.primary.main, 0.14),
                boxShadow: `0 10px 36px ${alpha(theme.palette.primary.main, 0.08)}`,
              }
            : {}),
        })}
      >
        <Tabs
          value={tab}
          onChange={handleTabChange}
          variant="scrollable"
          scrollButtons="auto"
          sx={(theme) => ({
            px: { xs: 0.5, sm: 1 },
            minHeight: 44,
            borderBottom: 1,
            borderColor: 'divider',
            bgcolor: isPortal ? alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.06 : 0.03) : 'background.paper',
            '& .MuiTab-root': {
              textTransform: 'none',
              fontWeight: 500,
              fontSize: '0.8125rem',
              minHeight: 44,
              py: 1,
              color: 'text.secondary',
              '&.Mui-selected': {
                color: isPortal ? theme.palette.primary.main : 'text.primary',
                fontWeight: 600,
              },
            },
            '& .MuiTabs-indicator': {
              height: 3,
              borderRadius: '3px 3px 0 0',
              bgcolor: isPortal ? theme.palette.primary.main : undefined,
            },
          })}
        >
          <Tab disableRipple label="Overview" />
          <Tab disableRipple label={`Quotes (${submissions.length})`} />
          <Tab disableRipple label={`Jobs (${jobs.length})`} />
          <Tab disableRipple label={`Pending Requests (${pendingRequests.length})`} />
          <Tab disableRipple label={`Invoices (${invoices.length})`} />
          <Tab disableRipple label={`Appointments (${appointments.length})`} />
          <Tab disableRipple label={`Addresses (${addresses.length})`} />
        </Tabs>

        <Box
          sx={{
            p: { xs: 2, sm: 2.5 },
            borderTop: 1,
            borderColor: 'divider',
            bgcolor: (t) =>
              isPortal
                ? alpha(t.palette.primary.main, t.palette.mode === 'dark' ? 0.04 : 0.025)
                : t.palette.mode === 'dark'
                  ? 'transparent'
                  : alpha(t.palette.grey[500], 0.04),
          }}
        >
          {tab === 0 && (
            <Stack spacing={2}>
              <Typography sx={{ ...contactsPageSx.subtitle, maxWidth: 'none' }}>
                Identifiers and sync metadata. Invoice lists may show up to 250 recent rows; summary totals include the full set.
              </Typography>

              {isAdminRoute && referral?.eligible !== false && (
                <Paper
                  variant="outlined"
                  sx={{
                    p: 2,
                    borderRadius: 2,
                    bgcolor: (t) => alpha(t.palette.primary.main, t.palette.mode === 'dark' ? 0.08 : 0.04),
                  }}
                >
                  <Stack spacing={1.5}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <CardGiftcard color="primary" fontSize="small" />
                      <Typography fontWeight={700}>Customer referral</Typography>
                      {referral?.program_enabled === false && (
                        <Chip size="small" label="Program paused" color="warning" variant="outlined" />
                      )}
                    </Stack>
                    <Typography variant="body2" color="text.secondary">
                      Any contact can get a personal referral link — no completed job required. Credits still unlock only after a referred friend’s first qualifying invoice is paid.
                    </Typography>
                    {referral?.has_link && referral?.share_url ? (
                      <>
                        <Typography variant="caption" color="text.secondary">
                          Code: <Box component="span" sx={{ fontFamily: 'monospace', fontWeight: 600 }}>{referral.referral_code}</Box>
                          {' · '}Available credit: {moneyCents(referral.available_credit_cents)}
                        </Typography>
                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                          <Box
                            sx={{
                              flex: 1,
                              px: 1.5,
                              py: 1,
                              borderRadius: 1.5,
                              border: 1,
                              borderColor: 'divider',
                              bgcolor: 'background.paper',
                              fontSize: '0.8125rem',
                              fontFamily: 'monospace',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {String(referral.share_url).replace(/^https?:\/\//, '')}
                          </Box>
                          <Button
                            variant="contained"
                            disableElevation
                            startIcon={<ContentCopy />}
                            onClick={handleCopyReferral}
                            sx={{ textTransform: 'none', fontWeight: 600 }}
                          >
                            {copiedReferral ? 'Copied' : 'Copy link'}
                          </Button>
                        </Stack>
                      </>
                    ) : (
                      <Box>
                        <Button
                          variant="contained"
                          disableElevation
                          startIcon={<CardGiftcard />}
                          onClick={handleEnsureReferralLink}
                          disabled={ensuringReferral || referral?.program_enabled === false}
                          sx={{ textTransform: 'none', fontWeight: 600 }}
                        >
                          {ensuringReferral ? 'Creating…' : 'Get referral link'}
                        </Button>
                      </Box>
                    )}
                    {referralMsg && (
                      <Alert severity={referralMsg.type} onClose={() => setReferralMsg(null)}>
                        {referralMsg.text}
                      </Alert>
                    )}
                  </Stack>
                </Paper>
              )}

              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                  gap: 2,
                }}
              >
                {isAdminRoute && <Field label="GHL contact id" value={data.contact_id} mono />}
                {isAdminRoute && <Field label="Location id" value={data.location_id} mono />}
                <Field label="Country" value={data.country} />
                <Field label="Date added" value={when(data.date_added)} />
                <Field label="Account id" value={data.account_id != null ? String(data.account_id) : null} />
              </Box>
              {Array.isArray(data.custom_fields) && data.custom_fields.length > 0 && (
                <Alert severity="info" variant="outlined">
                  This contact has custom fields in CRM data; open GoHighLevel for full field editing.
                </Alert>
              )}
            </Stack>
          )}

          {tab === 1 && (
            <ContactActivitySplit
              invitePortal={isPortal}
              items={submissions}
              getKey={(s) => s.id}
              selectedId={selQuote}
              onSelect={setSelQuote}
              emptyList="No quotes (submissions) for this contact."
              selectHint="Choose a quote on the left to see totals and open the full quote."
              drawerTitle="Quote"
              renderListItem={(s, active) => (
                <ContactPickRow key={s.id} active={active} onClick={() => setSelQuote(s.id)}>
                  <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography fontWeight={700}>{money(s.final_total)}</Typography>
                      <Typography variant="caption" color="text.secondary" display="block">
                        {s.location_name || 'Any location'} · {s.status || '—'}
                      </Typography>
                    </Box>
                    <Chip size="small" label={s.status || '—'} variant="outlined" sx={{ textTransform: 'capitalize' }} />
                  </Stack>
                  <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                    Updated {when(s.updated_at)}
                  </Typography>
                </ContactPickRow>
              )}
              renderDetail={(s) => <ContactQuotePanel submission={s} />}
            />
          )}

          {tab === 2 && (
            <ContactActivitySplit
              invitePortal={isPortal}
              items={jobs}
              getKey={(j) => j.id}
              selectedId={selJob}
              onSelect={setSelJob}
              emptyList="No jobs linked to this contact."
              selectHint="Select a job to load full details from the job system (same information as job cards)."
              drawerTitle="Job"
              renderListItem={(j, active) => (
                <ContactPickRow key={j.id} active={active} onClick={() => setSelJob(j.id)}>
                  <Typography fontWeight={700} sx={{ pr: 1 }}>
                    {j.title || 'Job'}
                  </Typography>
                  <Stack direction="row" flexWrap="wrap" gap={0.5} sx={{ mt: 0.5 }}>
                    <Chip size="small" label={(j.status || '').replace(/_/g, ' ')} color="warning" sx={{ textTransform: 'capitalize' }} />
                    {(j.job_type === 'recurring' || j.is_recurring) && (
                      <Chip size="small" variant="outlined" label="Recurring" />
                    )}
                  </Stack>
                  <Stack direction="row" justifyContent="space-between" sx={{ mt: 1 }} spacing={1}>
                    <Typography variant="caption" color="text.secondary">
                      {when(j.scheduled_at)}
                    </Typography>
                    <Typography variant="caption" fontWeight={700}>
                      {money(jobGrandTotalAmount(j))}
                    </Typography>
                  </Stack>
                </ContactPickRow>
              )}
              renderDetail={(j) => <ContactJobJobCard jobLite={j} usePublicJobApi={!isAdminRoute} />}
            />
          )}

          {tab === 3 && (
            <ContactActivitySplit
              invitePortal={isPortal}
              items={pendingRequests}
              getKey={(j) => j.id}
              selectedId={selPendingRequest}
              onSelect={setSelPendingRequest}
              emptyList="No pending repeat job requests for this contact."
              selectHint="Select a pending request to review the requested job."
              drawerTitle="Pending Request"
              renderListItem={(j, active) => (
                <ContactPickRow key={j.id} active={active} onClick={() => setSelPendingRequest(j.id)}>
                  <Typography fontWeight={700} sx={{ pr: 1 }}>
                    {j.title || 'Pending request'}
                  </Typography>
                  <Stack direction="row" flexWrap="wrap" gap={0.5} sx={{ mt: 0.5 }}>
                    <Chip size="small" label="Pending request" color="warning" />
                    {(j.job_type === 'recurring' || j.is_recurring) && (
                      <Chip size="small" variant="outlined" label="Recurring" />
                    )}
                  </Stack>
                  <Stack direction="row" justifyContent="space-between" sx={{ mt: 1 }} spacing={1}>
                    <Typography variant="caption" color="text.secondary">
                      {when(j.scheduled_at)}
                    </Typography>
                    <Typography variant="caption" fontWeight={700}>
                      {money(jobGrandTotalAmount(j))}
                    </Typography>
                  </Stack>
                </ContactPickRow>
              )}
              renderDetail={(j) => (
                <ContactJobJobCard
                  jobLite={j}
                  usePublicJobApi={!isAdminRoute}
                  lookupId={j.job_id || j.reschedule_source_job_id || j.source_job?.job_id || j.source_job?.id || j.source_job_id || j.id}
                />
              )}
            />
          )}

          {tab === 4 && (
            <>
              <Stack direction="row" justifyContent="flex-end" sx={{ mb: 2 }}>
                <Button
                  variant={isPortal ? 'contained' : 'outlined'}
                  color={isPortal ? 'primary' : 'inherit'}
                  size="small"
                  startIcon={<TableChart />}
                  disabled={!invoices.length}
                  onClick={() => exportInvoicesToCsv(invoices, displayName)}
                  sx={{
                    textTransform: 'none',
                    fontWeight: 600,
                    ...(isPortal
                      ? {
                          borderRadius: 2,
                          boxShadow: (th) => `0 4px 14px ${alpha(th.palette.primary.main, 0.35)}`,
                        }
                      : {}),
                  }}
                >
                  Export all to Excel
                </Button>
              </Stack>
              <ContactActivitySplit
                invitePortal={isPortal}
                items={invoices}
                getKey={(inv) => inv.id}
                selectedId={selInvoice}
                onSelect={setSelInvoice}
                emptyList="No invoices in this view."
                selectHint="Select an invoice for amounts and dates."
                drawerTitle="Invoice"
                renderListItem={(inv, active) => (
                  <ContactPickRow key={inv.id} active={active} onClick={() => setSelInvoice(inv.id)}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
                      <Typography fontWeight={700}>{inv.invoice_number || inv.invoice_id || 'Invoice'}</Typography>
                      <Chip size="small" variant="outlined" label={inv.status || '—'} />
                    </Stack>
                    <Typography variant="body2" sx={{ mt: 0.5 }}>
                      {formatMoney(inv.total, inv.currency)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Due {when(inv.due_date)}
                      {inv.is_overdue ? ' · Overdue' : ''}
                    </Typography>
                  </ContactPickRow>
                )}
                renderDetail={(inv) => (
                  <ContactInvoicePanel invoice={inv} contact={data} billToAddress={addresses[0]} />
                )}
              />
            </>
          )}

          {tab === 5 && (
            <ContactActivitySplit
              invitePortal={isPortal}
              items={appointments}
              getKey={(a) => a.id}
              selectedId={selAppt}
              onSelect={setSelAppt}
              emptyList="No appointments."
              selectHint="Select an appointment for schedule and assignment."
              drawerTitle="Appointment"
              renderListItem={(a, active) => (
                <ContactPickRow key={a.id} active={active} onClick={() => setSelAppt(a.id)}>
                  <Typography fontWeight={700}>{a.title || 'Appointment'}</Typography>
                  <Chip size="small" sx={{ mt: 0.5, textTransform: 'capitalize' }} label={a.appointment_status || '—'} />
                  <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.75 }}>
                    {when(a.start_time)}
                  </Typography>
                </ContactPickRow>
              )}
              renderDetail={(a) => <ContactAppointmentPanel appt={a} />}
            />
          )}

          {tab === 6 && (
            <>
              <Stack direction="row" justifyContent="flex-end" spacing={1} sx={{ mb: 2 }}>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => {
                    setAddrDialogMode('create');
                    setEditingAddr(null);
                    setAddrDialogOpen(true);
                  }}
                >
                  Add property
                </Button>
                {selAddr && (
                  <>
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => {
                        const addr = addresses.find((a) => a.id === selAddr);
                        if (!addr) return;
                        setAddrDialogMode('edit');
                        setEditingAddr(addr);
                        setAddrDialogOpen(true);
                      }}
                    >
                      Edit
                    </Button>
                    <Button
                      size="small"
                      color="error"
                      variant="outlined"
                      disabled={deletingAddr}
                      onClick={() => {
                        const addr = addresses.find((a) => a.id === selAddr);
                        if (addr) handleDeleteAddress(addr);
                      }}
                    >
                      Delete
                    </Button>
                  </>
                )}
              </Stack>
              <ContactActivitySplit
                invitePortal={isPortal}
                items={addresses}
                getKey={(addr) => addr.id}
                selectedId={selAddr}
                onSelect={setSelAddr}
                emptyList="No properties on file. Add addresses in-app — they are no longer synced from GoHighLevel."
                selectHint="Select a property to view formatted location details."
                drawerTitle="Property"
                renderListItem={(addr, active) => (
                  <ContactPickRow key={addr.id} active={active} onClick={() => setSelAddr(addr.id)}>
                    <Typography fontWeight={700}>{addr.name || 'Property'}</Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                      {addr.city}, {addr.state} {addr.postal_code || ''}
                    </Typography>
                  </ContactPickRow>
                )}
                renderDetail={(addr) => <ContactAddressPanel addr={addr} />}
              />
            </>
          )}
        </Box>
      </Paper>

      <ContactAddressFormDialog
        open={addrDialogOpen}
        onClose={() => setAddrDialogOpen(false)}
        onSubmit={handleSaveAddress}
        initialValues={editingAddr}
        busy={creatingAddr || updatingAddr}
        mode={addrDialogMode}
      />
    </Box>
  );
};

function Field({ label, value, mono }) {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary" fontWeight={600} display="block">
        {label}
      </Typography>
      <Typography variant="body2" sx={{ fontFamily: mono ? 'ui-monospace, monospace' : 'inherit', wordBreak: 'break-all' }}>
        {value || '—'}
      </Typography>
    </Box>
  );
}

function InsightStat({ icon: Icon, label, value, hint, portalInvite, accentIndex = 0 }) {
  const theme = useTheme();
  const grad = PORTAL_INSIGHT_AVATAR_GRADIENTS[accentIndex % PORTAL_INSIGHT_AVATAR_GRADIENTS.length];
  return (
    <Paper
      elevation={0}
      sx={{
        ...contactsPageSx.surface(theme),
        p: 2,
        height: '100%',
        transition: 'border-color 0.15s ease, box-shadow 0.15s ease, transform 0.15s ease',
        ...(portalInvite
          ? {
              borderRadius: 3,
              borderColor: alpha(theme.palette.primary.main, 0.14),
              background:
                theme.palette.mode === 'dark'
                  ? alpha(theme.palette.primary.main, 0.06)
                  : `linear-gradient(165deg, #ffffff 0%, ${alpha(theme.palette.primary.main, 0.06)} 100%)`,
              boxShadow: `0 6px 22px ${alpha(theme.palette.primary.main, 0.07)}`,
              '&:hover': {
                borderColor: alpha(theme.palette.primary.main, 0.28),
                boxShadow: `0 10px 28px ${alpha(theme.palette.primary.main, 0.12)}`,
                transform: 'translateY(-2px)',
              },
            }
          : {
              '&:hover': {
                borderColor: 'grey.300',
                boxShadow: theme.palette.mode === 'dark' ? 'none' : '0 2px 8px rgba(15, 23, 42, 0.06)',
              },
            }),
      }}
    >
      <Stack direction="row" spacing={1.75} alignItems="flex-start">
        <Avatar
          sx={{
            width: 40,
            height: 40,
            ...(portalInvite
              ? {
                  background: grad,
                  color: '#fff',
                  boxShadow: `0 4px 12px ${alpha(theme.palette.primary.main, 0.28)}`,
                }
              : {
                  bgcolor: 'grey.100',
                  color: 'grey.700',
                }),
          }}
        >
          <Icon sx={{ fontSize: 20 }} />
        </Avatar>
        <Box sx={{ minWidth: 0 }}>
          <Typography
            variant="caption"
            sx={{
              fontSize: '0.6875rem',
              fontWeight: 600,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: portalInvite ? 'primary.main' : 'text.secondary',
              display: 'block',
              mb: 0.35,
            }}
          >
            {label}
          </Typography>
          <Typography variant="h6" fontWeight={600} sx={{ letterSpacing: '-0.02em', lineHeight: 1.25, fontVariantNumeric: 'tabular-nums' }}>
            {value ?? '—'}
          </Typography>
          {hint && (
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5, fontSize: '0.75rem' }}>
              {hint}
            </Typography>
          )}
        </Box>
      </Stack>
    </Paper>
  );
}

export default ContactDetail;
