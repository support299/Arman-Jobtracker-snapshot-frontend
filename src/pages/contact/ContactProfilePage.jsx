import React, { useEffect, useMemo, useState } from 'react';
import { Link as RouterLink, useParams, useSearchParams } from 'react-router-dom';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Divider,
  Grid,
  IconButton,
  Paper,
  Skeleton,
  Stack,
  Tab,
  Tabs,
  Typography,
} from '@mui/material';
import AddOutlined from '@mui/icons-material/AddOutlined';
import DeleteOutline from '@mui/icons-material/DeleteOutline';
import EditOutlined from '@mui/icons-material/EditOutlined';
import EmailOutlined from '@mui/icons-material/EmailOutlined';
import HomeWorkOutlined from '@mui/icons-material/HomeWorkOutlined';
import PhoneOutlined from '@mui/icons-material/PhoneOutlined';
import moment from 'moment-timezone';
import { useGetDashboardContactByIdQuery } from '../../store/api/dashboardApi';
import {
  useCreateContactAddressMutation,
  useDeleteContactAddressMutation,
  useUpdateContactAddressMutation,
} from '../../store/api/contactProfileApi';
import { ContactAddressFormDialog } from '../../components/contacts/ContactAddressFormDialog';
import { ContactJobJobCard } from '../../components/admin/contacts/ContactJobJobCard';
import { ContactQuotePanel } from '../../components/admin/contacts/ContactMiscPanels';
import { CompanyContactBanner } from '../../components/contacts/CompanyContactBanner';
import { profilePageSx } from './contactProfileTheme';
import { useMoneyFormatter } from '../../hooks/useMoneyFormatter';
import { getIframeLocationId } from '../../utils/iframeContext';

function parseContactParam(raw) {
  if (raw == null) return null;
  const s = decodeURIComponent(String(raw).trim());
  if (!s) return null;
  if (/^\d+$/.test(s)) return Number(s);
  if (/^[A-Za-z0-9_-]{6,128}$/.test(s)) return s;
  return null;
}

function initials(first, last, email) {
  const f = (first || '').trim().charAt(0);
  const l = (last || '').trim().charAt(0);
  if (f || l) return `${f}${l}`.toUpperCase();
  const e = (email || '').trim().charAt(0);
  return e ? e.toUpperCase() : '?';
}

function formatAddressLine(address) {
  return (
    address.full_address
    || [address.street_address, address.city, address.state, address.postal_code].filter(Boolean).join(', ')
  );
}

function MetaItem({ icon: Icon, children }) {
  return (
    <Box sx={profilePageSx.metaItem}>
      <Icon sx={{ fontSize: 16, color: '#98a2b3' }} />
      <span>{children}</span>
    </Box>
  );
}

function StatCell({ label, value }) {
  return (
    <Box sx={profilePageSx.statCell}>
      <Typography sx={profilePageSx.statValue}>{value}</Typography>
      <Typography sx={profilePageSx.statLabel}>{label}</Typography>
    </Box>
  );
}

function DetailRow({ label, value }) {
  if (value == null || value === '') return null;
  return (
    <Stack direction="row" justifyContent="space-between" spacing={2} sx={{ py: 0.75 }}>
      <Typography variant="body2" color="#667085">
        {label}
      </Typography>
      <Typography variant="body2" fontWeight={500} color="#344054" textAlign="right">
        {value}
      </Typography>
    </Stack>
  );
}

function PropertyCard({ address, onEdit, onDelete, deleting }) {
  return (
    <Paper
      elevation={0}
      sx={{
        p: 2,
        borderRadius: 1.5,
        border: '1px solid #e4e7ec',
        height: '100%',
        bgcolor: '#fff',
      }}
    >
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography fontWeight={600} fontSize="0.9375rem" color="#101828">
            {address.name || 'Property'}
          </Typography>
          <Typography variant="body2" color="#667085" sx={{ mt: 0.75, lineHeight: 1.5 }}>
            {formatAddressLine(address)}
          </Typography>
        </Box>
        <Stack direction="row" spacing={0.25}>
          <IconButton
            size="small"
            onClick={() => onEdit(address)}
            aria-label="Edit property"
            sx={{ color: '#667085', '&:hover': { bgcolor: '#f2f4f7' } }}
          >
            <EditOutlined fontSize="small" />
          </IconButton>
          <IconButton
            size="small"
            onClick={() => onDelete(address)}
            disabled={deleting}
            aria-label="Delete property"
            sx={{ color: '#667085', '&:hover': { bgcolor: '#fef3f2', color: '#b42318' } }}
          >
            <DeleteOutline fontSize="small" />
          </IconButton>
        </Stack>
      </Stack>
      <Divider sx={{ my: 1.5, borderColor: '#f2f4f7' }} />
      <Stack spacing={0}>
        <DetailRow label="Type" value={address.property_type ? String(address.property_type) : null} />
        <DetailRow label="Square feet" value={address.property_sqft != null ? `${address.property_sqft} sq ft` : null} />
        <DetailRow label="Floors" value={address.number_of_floors != null ? String(address.number_of_floors) : null} />
        <DetailRow label="Gate code" value={address.gate_code} />
      </Stack>
    </Paper>
  );
}

function SectionHeader({ title, description, action }) {
  return (
    <Stack
      direction={{ xs: 'column', sm: 'row' }}
      justifyContent="space-between"
      alignItems={{ xs: 'flex-start', sm: 'center' }}
      spacing={1.5}
      sx={{ mb: 2.5 }}
    >
      <Box>
        <Typography sx={profilePageSx.sectionTitle}>{title}</Typography>
        {description && <Typography sx={profilePageSx.sectionDesc}>{description}</Typography>}
      </Box>
      {action}
    </Stack>
  );
}

export default function ContactProfilePage() {
  const { formatMoney: money } = useMoneyFormatter();
  const { ghl_contact_id: idParam } = useParams();
  const [searchParams] = useSearchParams();
  const contactKey = useMemo(() => parseContactParam(idParam), [idParam]);
  const locationId = searchParams.get('location_id') || getIframeLocationId() || '';

  const [tab, setTab] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState('create');
  const [editingAddress, setEditingAddress] = useState(null);
  const [selectedJobId, setSelectedJobId] = useState(null);
  const [selectedQuoteId, setSelectedQuoteId] = useState(null);

  const { data, isLoading, error, refetch } = useGetDashboardContactByIdQuery(contactKey, {
    skip: contactKey == null,
  });
  const [createAddress, { isLoading: creating }] = useCreateContactAddressMutation();
  const [updateAddress, { isLoading: updating }] = useUpdateContactAddressMutation();
  const [deleteAddress, { isLoading: deleting }] = useDeleteContactAddressMutation();

  const ghlContactId = data?.contact_id || (typeof contactKey === 'string' ? contactKey : null);

  const displayName = useMemo(() => {
    if (!data) return 'Client profile';
    const n = [data.first_name, data.last_name].filter(Boolean).join(' ');
    return n || data.email || 'Client profile';
  }, [data]);

  const summary = data?.summary || {};
  const addresses = data?.addresses || [];
  const jobs = data?.jobs || [];
  const submissions = data?.submissions || [];

  const selectedJob = jobs.find((j) => (j.job_id || j.id) === selectedJobId) || jobs[0] || null;
  const selectedQuote = submissions.find((s) => s.id === selectedQuoteId) || submissions[0] || null;

  useEffect(() => {
    if (jobs.length && selectedJobId == null) {
      setSelectedJobId(jobs[0].job_id || jobs[0].id);
    }
  }, [jobs, selectedJobId]);

  useEffect(() => {
    if (submissions.length && selectedQuoteId == null) {
      setSelectedQuoteId(submissions[0].id);
    }
  }, [submissions, selectedQuoteId]);

  const openCreateDialog = () => {
    setDialogMode('create');
    setEditingAddress(null);
    setDialogOpen(true);
  };

  const openEditDialog = (address) => {
    setDialogMode('edit');
    setEditingAddress(address);
    setDialogOpen(true);
  };

  const handleSaveAddress = async (payload) => {
    if (!ghlContactId) throw new Error('Missing contact');
    if (dialogMode === 'edit' && editingAddress?.id) {
      await updateAddress({ ghlContactId, addressId: editingAddress.id, ...payload }).unwrap();
    } else {
      await createAddress({ ghlContactId, ...payload }).unwrap();
    }
    refetch();
  };

  const handleDeleteAddress = async (address) => {
    if (!ghlContactId || !address?.id) return;
    if (!window.confirm(`Remove "${address.name || 'this property'}"?`)) return;
    await deleteAddress({ ghlContactId, addressId: address.id }).unwrap();
    refetch();
  };

  const addPropertyBtn = (
    <Button
      variant="outlined"
      size="small"
      startIcon={<AddOutlined />}
      onClick={openCreateDialog}
      sx={{
        textTransform: 'none',
        fontWeight: 600,
        borderRadius: 1.5,
        borderColor: '#d0d5dd',
        color: '#344054',
        '&:hover': { borderColor: '#98a2b3', bgcolor: '#f9fafb' },
      }}
    >
      Add property
    </Button>
  );

  if (contactKey == null) {
    return (
      <Box sx={{ ...profilePageSx.page, p: 3 }}>
        <Alert severity="warning" sx={{ borderRadius: 1.5 }}>Invalid contact link.</Alert>
      </Box>
    );
  }

  if (!locationId) {
    return (
      <Box sx={{ ...profilePageSx.page, p: 3 }}>
        <Alert severity="warning" sx={{ borderRadius: 1.5 }}>
          This page requires a <strong>location_id</strong> query parameter for your subaccount.
        </Alert>
      </Box>
    );
  }

  if (isLoading) {
    return (
      <Box sx={profilePageSx.page}>
        <Box sx={profilePageSx.shell}>
          <Skeleton variant="rounded" height={88} sx={{ borderRadius: 1.5 }} />
          <Skeleton variant="rounded" height={420} sx={{ mt: 2, borderRadius: 1.5 }} />
        </Box>
      </Box>
    );
  }

  if (error || !data) {
    return (
      <Box sx={{ ...profilePageSx.page, p: 3 }}>
        <Alert severity="error" sx={{ borderRadius: 1.5 }}>
          {error?.data?.detail || 'Could not load this client profile.'}
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={profilePageSx.page}>
      <Box sx={profilePageSx.shell}>
        <CompanyContactBanner locationId={locationId} invitePortal={false} />

        <Paper elevation={0} sx={profilePageSx.mainCard}>
          <Box sx={profilePageSx.header}>
            <Typography sx={profilePageSx.eyebrow}>Client profile</Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }}>
              <Avatar
                sx={{
                  width: 48,
                  height: 48,
                  fontSize: '0.9375rem',
                  fontWeight: 600,
                  bgcolor: '#f2f4f7',
                  color: '#344054',
                  border: '1px solid #e4e7ec',
                }}
              >
                {initials(data.first_name, data.last_name, data.email)}
              </Avatar>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={profilePageSx.displayName}>{displayName}</Typography>
                <Typography sx={profilePageSx.subtitle}>
                  Manage properties, jobs, and quotes for this contact.
                </Typography>
                <Box sx={profilePageSx.metaRow}>
                  {data.phone && <MetaItem icon={PhoneOutlined}>{data.phone}</MetaItem>}
                  {data.email && <MetaItem icon={EmailOutlined}>{data.email}</MetaItem>}
                </Box>
              </Box>
            </Stack>
          </Box>

          <Box sx={profilePageSx.statsBar}>
            <StatCell label="Properties" value={summary.addresses_count ?? addresses.length} />
            <StatCell label="Active jobs" value={summary.pending_jobs_count ?? 0} />
            <StatCell label="Quotes" value={summary.submissions_count ?? submissions.length} />
            <StatCell label="Total jobs" value={summary.jobs_count ?? jobs.length} />
          </Box>

          <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable" scrollButtons="auto" sx={profilePageSx.tabs}>
            <Tab label="Overview" />
            <Tab label={`Properties (${addresses.length})`} />
            <Tab label={`Jobs (${jobs.length})`} />
            <Tab label={`Quotes (${submissions.length})`} />
          </Tabs>

          <Box sx={profilePageSx.content}>
            {tab === 0 && (
              <Stack spacing={2.5}>
                <Typography variant="body2" color="#667085" lineHeight={1.6}>
                  Review saved properties, active jobs, and quote history from a single place.
                </Typography>
                {addresses.length === 0 ? (
                  <Alert
                    severity="info"
                    variant="outlined"
                    sx={{ borderRadius: 1.5, borderColor: '#d0d5dd', bgcolor: '#fafafa' }}
                    action={
                      <Button size="small" onClick={() => { setTab(1); openCreateDialog(); }}>
                        Add property
                      </Button>
                    }
                  >
                    No properties saved yet. Add an address to use it for bookings and jobs.
                  </Alert>
                ) : (
                  <Grid container spacing={2}>
                    {addresses.slice(0, 2).map((addr) => (
                      <Grid item xs={12} md={6} key={addr.id}>
                        <PropertyCard address={addr} onEdit={openEditDialog} onDelete={handleDeleteAddress} deleting={deleting} />
                      </Grid>
                    ))}
                  </Grid>
                )}
              </Stack>
            )}

            {tab === 1 && (
              <>
                <SectionHeader
                  title="Saved properties"
                  description="Addresses stored in your account for quotes, jobs, and scheduling."
                  action={addPropertyBtn}
                />
                {addresses.length === 0 ? (
                  <Box sx={profilePageSx.emptyState}>
                    <HomeWorkOutlined sx={{ fontSize: 36, color: '#98a2b3', mb: 1 }} />
                    <Typography fontWeight={600} color="#344054">No properties yet</Typography>
                    <Typography variant="body2" color="#667085" sx={{ mt: 0.5, mb: 2 }}>
                      Add a property to keep service locations on file.
                    </Typography>
                    <Button
                      variant="contained"
                      onClick={openCreateDialog}
                      sx={{
                        textTransform: 'none',
                        fontWeight: 600,
                        borderRadius: 1.5,
                        bgcolor: '#101828',
                        boxShadow: 'none',
                        '&:hover': { bgcolor: '#344054', boxShadow: 'none' },
                      }}
                    >
                      Add property
                    </Button>
                  </Box>
                ) : (
                  <Grid container spacing={2}>
                    {addresses.map((addr) => (
                      <Grid item xs={12} md={6} key={addr.id}>
                        <PropertyCard address={addr} onEdit={openEditDialog} onDelete={handleDeleteAddress} deleting={deleting} />
                      </Grid>
                    ))}
                  </Grid>
                )}
              </>
            )}

            {tab === 2 && (
              <Grid container spacing={2.5}>
                <Grid item xs={12} md={4}>
                  <Typography sx={{ ...profilePageSx.sectionTitle, mb: 1.5 }}>Job list</Typography>
                  <Stack spacing={1}>
                    {jobs.length === 0 && (
                      <Typography variant="body2" color="#667085">No jobs linked to this contact.</Typography>
                    )}
                    {jobs.map((job) => {
                      const id = job.job_id || job.id;
                      const active = (selectedJob?.job_id || selectedJob?.id) === id;
                      return (
                        <Box key={id} onClick={() => setSelectedJobId(id)} sx={profilePageSx.listItem(active)}>
                          <Typography fontWeight={600} fontSize="0.875rem" color="#101828">
                            {job.title || 'Job'}
                          </Typography>
                          <Typography variant="caption" color="#667085" display="block" sx={{ mt: 0.25 }}>
                            {(job.status || '—').replace(/_/g, ' ')}
                            {job.scheduled_date ? ` · ${moment.utc(job.scheduled_date).format('MMM D, YYYY')}` : ''}
                          </Typography>
                        </Box>
                      );
                    })}
                  </Stack>
                </Grid>
                <Grid item xs={12} md={8}>
                  {selectedJob ? (
                    <ContactJobJobCard jobLite={selectedJob} usePublicJobApi skipDetailFetch />
                  ) : (
                    <Typography variant="body2" color="#667085">Select a job to view details.</Typography>
                  )}
                </Grid>
              </Grid>
            )}

            {tab === 3 && (
              <Grid container spacing={2.5}>
                <Grid item xs={12} md={4}>
                  <Typography sx={{ ...profilePageSx.sectionTitle, mb: 1.5 }}>Quote list</Typography>
                  <Stack spacing={1}>
                    {submissions.length === 0 && (
                      <Typography variant="body2" color="#667085">No quotes for this contact.</Typography>
                    )}
                    {submissions.map((s) => {
                      const active = selectedQuote?.id === s.id;
                      return (
                        <Box key={s.id} onClick={() => setSelectedQuoteId(s.id)} sx={profilePageSx.listItem(active)}>
                          <Typography fontWeight={600} fontSize="0.875rem" color="#101828">
                            {money(s.final_total)}
                          </Typography>
                          <Typography variant="caption" color="#667085" display="block" sx={{ mt: 0.25 }}>
                            {s.status || '—'} · {moment.utc(s.updated_at).format('MMM D, YYYY')}
                          </Typography>
                        </Box>
                      );
                    })}
                  </Stack>
                </Grid>
                <Grid item xs={12} md={8}>
                  {selectedQuote ? (
                    <Paper elevation={0} sx={{ p: 2.5, border: '1px solid #e4e7ec', borderRadius: 1.5 }}>
                      <ContactQuotePanel submission={selectedQuote} />
                      <Button
                        component={RouterLink}
                        to={`/quote/details/${selectedQuote.id}`}
                        variant="outlined"
                        size="small"
                        sx={{
                          mt: 2,
                          textTransform: 'none',
                          fontWeight: 600,
                          borderRadius: 1.5,
                          borderColor: '#d0d5dd',
                          color: '#344054',
                        }}
                      >
                        Open full quote
                      </Button>
                    </Paper>
                  ) : (
                    <Typography variant="body2" color="#667085">Select a quote to view details.</Typography>
                  )}
                </Grid>
              </Grid>
            )}
          </Box>
        </Paper>
      </Box>

      <ContactAddressFormDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSubmit={handleSaveAddress}
        initialValues={editingAddress}
        busy={creating || updating}
        mode={dialogMode}
      />
    </Box>
  );
}
