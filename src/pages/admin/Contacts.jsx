import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  FormControl,
  InputAdornment,
  MenuItem,
  Paper,
  Select,
  Skeleton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import Search from '@mui/icons-material/Search';
import SwapVert from '@mui/icons-material/SwapVert';
import { format, parseISO } from 'date-fns';
import { useGetDashboardContactsQuery } from '../../store/api/dashboardApi';
import { contactsPageSx } from './contactsTheme';
import { CompanyContactBanner } from '../../components/contacts/CompanyContactBanner';

const ORDERING_OPTIONS = [
  { value: '-date_added', label: 'Date added (newest)' },
  { value: 'date_added', label: 'Date added (oldest)' },
  { value: 'last_name', label: 'Last name (A–Z)' },
  { value: '-last_name', label: 'Last name (Z–A)' },
  { value: 'first_name', label: 'First name (A–Z)' },
  { value: '-first_name', label: 'First name (Z–A)' },
  { value: 'email', label: 'Email (A–Z)' },
  { value: '-email', label: 'Email (Z–A)' },
  { value: 'id', label: 'ID (ascending)' },
  { value: '-id', label: 'ID (descending)' },
];

const TAX_STATUS_OPTIONS = [
  { value: '', label: 'All contacts' },
  { value: 'true', label: 'Tax exempt' },
  { value: 'false', label: 'Taxable' },
];

const DND_OPTIONS = [
  { value: '', label: 'All contacts' },
  { value: 'true', label: 'Do not disturb' },
  { value: 'false', label: 'Can contact' },
];

const ACTIVITY_OPTIONS = [
  { value: '', label: 'All activity' },
  { value: 'pending', label: 'Has pending jobs', param: 'has_pending_jobs', bool: 'true' },
  { value: 'jobs', label: 'Has jobs', param: 'has_jobs', bool: 'true' },
  { value: 'no_jobs', label: 'No jobs', param: 'has_jobs', bool: 'false' },
  { value: 'quotes', label: 'Has quotes', param: 'has_quotes', bool: 'true' },
  { value: 'invoices', label: 'Has invoices', param: 'has_invoices', bool: 'true' },
  { value: 'addresses', label: 'Has properties', param: 'has_addresses', bool: 'true' },
];

const CONTACT_INFO_OPTIONS = [
  { value: '', label: 'Any contact info' },
  { value: 'has_email', label: 'Has email', param: 'has_email', bool: 'true' },
  { value: 'missing_email', label: 'Missing email', param: 'has_email', bool: 'false' },
  { value: 'has_phone', label: 'Has phone', param: 'has_phone', bool: 'true' },
  { value: 'missing_phone', label: 'Missing phone', param: 'has_phone', bool: 'false' },
];

const ADDED_PRESET_OPTIONS = [
  { value: '', label: 'Any time', days: null },
  { value: '7d', label: 'Added last 7 days', days: 7 },
  { value: '30d', label: 'Added last 30 days', days: 30 },
  { value: '90d', label: 'Added last 90 days', days: 90 },
];

function isoDateDaysAgo(days) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - days);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function CompactSelect({ id, value, onChange, options, placeholder, minWidth = 152, active = false }) {
  const selected = options.find((o) => o.value === value);
  return (
    <FormControl size="small" sx={{ minWidth, flex: '0 1 auto' }}>
      <Select
        id={id}
        displayEmpty
        value={value}
        onChange={(e) => onChange(e.target.value)}
        renderValue={() => (value ? selected?.label : placeholder)}
        MenuProps={{
          PaperProps: { sx: { mt: 0.75, borderRadius: 2, maxHeight: 320 } },
        }}
        sx={{
          height: 36,
          borderRadius: 1.5,
          fontSize: '0.8125rem',
          fontWeight: active ? 600 : 500,
          color: active ? 'text.primary' : 'text.secondary',
          bgcolor: active ? 'action.selected' : 'background.paper',
          '& .MuiOutlinedInput-notchedOutline': {
            borderColor: active ? 'primary.light' : 'divider',
          },
          '&:hover .MuiOutlinedInput-notchedOutline': {
            borderColor: active ? 'primary.main' : 'grey.400',
          },
          '& .MuiSelect-select': {
            py: 0.75,
            pl: 1.5,
            pr: 4,
          },
        }}
      >
        {options.map((o) => (
          <MenuItem key={o.value || `${id}-all`} value={o.value} sx={{ fontSize: '0.8125rem' }}>
            {o.label}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}

/** Route segment for contact detail: GHL UUID preferred (matches dashboard detail lookup). */
function contactDetailSlug(row) {
  const ghl = row?.ghl_contact_id || row?.contact_id;
  if (ghl && String(ghl).trim()) return String(ghl).trim();
  return row?.id;
}

const formatWhen = (iso) => {
  if (!iso) return '—';
  try {
    return format(parseISO(iso), 'MMM d, yyyy');
  } catch {
    return iso;
  }
};

const Contacts = () => {
  const theme = useTheme();
  const isSmDown = useMediaQuery(theme.breakpoints.down('sm'));
  const navigate = useNavigate();

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [ordering, setOrdering] = useState('-date_added');
  const [taxExemptFilter, setTaxExemptFilter] = useState('');
  const [dndFilter, setDndFilter] = useState('');
  const [activityFilter, setActivityFilter] = useState('');
  const [contactInfoFilter, setContactInfoFilter] = useState('');
  const [addedPreset, setAddedPreset] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchInput.trim()), 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  const queryParams = useMemo(() => {
    const p = {
      page,
      page_size: pageSize,
      ordering,
    };
    if (debouncedSearch) p.search = debouncedSearch;
    if (taxExemptFilter === 'true' || taxExemptFilter === 'false') p.tax_exempt = taxExemptFilter;
    if (dndFilter === 'true' || dndFilter === 'false') p.dnd = dndFilter;
    const activity = ACTIVITY_OPTIONS.find((o) => o.value === activityFilter);
    if (activity?.param) p[activity.param] = activity.bool;
    const contactInfo = CONTACT_INFO_OPTIONS.find((o) => o.value === contactInfoFilter);
    if (contactInfo?.param) p[contactInfo.param] = contactInfo.bool;
    const added = ADDED_PRESET_OPTIONS.find((o) => o.value === addedPreset);
    if (added?.days) p.date_added_after = isoDateDaysAgo(added.days);
    return p;
  }, [page, pageSize, ordering, debouncedSearch, taxExemptFilter, dndFilter, activityFilter, contactInfoFilter, addedPreset]);

  const { data, isLoading, isFetching, error } = useGetDashboardContactsQuery(queryParams, {
    placeholderData: (previousData) => previousData,
  });

  const rows = data?.results ?? [];
  const total = data?.count ?? 0;

  const handleClearFilters = () => {
    setSearchInput('');
    setDebouncedSearch('');
    setTaxExemptFilter('');
    setDndFilter('');
    setActivityFilter('');
    setContactInfoFilter('');
    setAddedPreset('');
    setPage(1);
  };

  const activeChips = useMemo(() => {
    const chips = [];
    if (debouncedSearch) {
      chips.push({
        key: 'search',
        label: `Search: ${debouncedSearch}`,
        onDelete: () => { setSearchInput(''); setDebouncedSearch(''); setPage(1); },
      });
    }
    if (taxExemptFilter) {
      chips.push({
        key: 'tax',
        label: TAX_STATUS_OPTIONS.find((o) => o.value === taxExemptFilter)?.label,
        onDelete: () => { setTaxExemptFilter(''); setPage(1); },
      });
    }
    if (dndFilter) {
      chips.push({
        key: 'dnd',
        label: DND_OPTIONS.find((o) => o.value === dndFilter)?.label,
        onDelete: () => { setDndFilter(''); setPage(1); },
      });
    }
    if (activityFilter) {
      chips.push({
        key: 'activity',
        label: ACTIVITY_OPTIONS.find((o) => o.value === activityFilter)?.label,
        onDelete: () => { setActivityFilter(''); setPage(1); },
      });
    }
    if (contactInfoFilter) {
      chips.push({
        key: 'info',
        label: CONTACT_INFO_OPTIONS.find((o) => o.value === contactInfoFilter)?.label,
        onDelete: () => { setContactInfoFilter(''); setPage(1); },
      });
    }
    if (addedPreset) {
      chips.push({
        key: 'added',
        label: ADDED_PRESET_OPTIONS.find((o) => o.value === addedPreset)?.label,
        onDelete: () => { setAddedPreset(''); setPage(1); },
      });
    }
    return chips;
  }, [debouncedSearch, taxExemptFilter, dndFilter, activityFilter, contactInfoFilter, addedPreset]);

  return (
    <Box sx={(theme) => ({ ...contactsPageSx.canvas(theme), ...contactsPageSx.shell })}>
      <Stack spacing={3}>
        <Box>
          <Typography sx={contactsPageSx.eyebrow}>Contact directory</Typography>
          <Typography variant={isSmDown ? 'h5' : 'h4'} component="h1" sx={contactsPageSx.title}>
            Contacts
          </Typography>
          <Typography sx={contactsPageSx.subtitle}>
            Search, sort, and open a contact to see jobs, quotes, invoices, and properties in the record view.
          </Typography>
        </Box>

        <CompanyContactBanner mode="business" />

      {error && (
        <Alert severity="error">
          {error?.data?.detail || error?.error || 'Unable to load contacts.'}
        </Alert>
      )}

      <Paper elevation={0} sx={(theme) => ({ ...contactsPageSx.surface(theme), overflow: 'hidden' })}>
        <Box sx={{ px: { xs: 1.5, sm: 2 }, py: 1.75 }}>
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            spacing={1.5}
            alignItems={{ xs: 'stretch', md: 'center' }}
            justifyContent="space-between"
          >
            <TextField
              size="small"
              hiddenLabel
              placeholder="Search by name, email, phone, company, or ID"
              value={searchInput}
              onChange={(e) => {
                setSearchInput(e.target.value);
                setPage(1);
              }}
              sx={{
                flex: 1,
                minWidth: 0,
                maxWidth: { md: 520 },
                '& .MuiOutlinedInput-root': {
                  height: 40,
                  borderRadius: 2,
                  bgcolor: (t) => (t.palette.mode === 'dark' ? 'action.hover' : 'grey.50'),
                },
              }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search fontSize="small" sx={{ color: 'text.secondary' }} />
                  </InputAdornment>
                ),
              }}
            />
            <Stack direction="row" spacing={1.25} alignItems="center" justifyContent={{ xs: 'space-between', md: 'flex-end' }}>
              <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                {isLoading ? 'Loading…' : `${total.toLocaleString()} ${total === 1 ? 'contact' : 'contacts'}`}
              </Typography>
              <Stack direction="row" spacing={0.75} alignItems="center">
                <SwapVert sx={{ fontSize: 18, color: 'text.secondary', display: { xs: 'none', sm: 'block' } }} />
                <CompactSelect
                  id="contacts-ordering"
                  placeholder="Sort"
                  value={ordering}
                  onChange={(v) => { setOrdering(v); setPage(1); }}
                  options={ORDERING_OPTIONS}
                  minWidth={200}
                  active={ordering !== '-date_added'}
                />
              </Stack>
            </Stack>
          </Stack>

          <Divider sx={{ my: 1.5 }} />

          <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" alignItems="center">
            <CompactSelect
              id="contacts-tax-status"
              placeholder="Tax status"
              value={taxExemptFilter}
              onChange={(v) => { setTaxExemptFilter(v); setPage(1); }}
              options={TAX_STATUS_OPTIONS}
              active={Boolean(taxExemptFilter)}
            />
            <CompactSelect
              id="contacts-dnd"
              placeholder="DND"
              value={dndFilter}
              onChange={(v) => { setDndFilter(v); setPage(1); }}
              options={DND_OPTIONS}
              active={Boolean(dndFilter)}
            />
            <CompactSelect
              id="contacts-activity"
              placeholder="Activity"
              value={activityFilter}
              onChange={(v) => { setActivityFilter(v); setPage(1); }}
              options={ACTIVITY_OPTIONS}
              minWidth={168}
              active={Boolean(activityFilter)}
            />
            <CompactSelect
              id="contacts-info"
              placeholder="Contact info"
              value={contactInfoFilter}
              onChange={(v) => { setContactInfoFilter(v); setPage(1); }}
              options={CONTACT_INFO_OPTIONS}
              minWidth={168}
              active={Boolean(contactInfoFilter)}
            />
            <CompactSelect
              id="contacts-added"
              placeholder="Date added"
              value={addedPreset}
              onChange={(v) => { setAddedPreset(v); setPage(1); }}
              options={ADDED_PRESET_OPTIONS}
              minWidth={168}
              active={Boolean(addedPreset)}
            />
            {activeChips.length > 0 && (
              <Button
                size="small"
                onClick={handleClearFilters}
                sx={{ textTransform: 'none', fontWeight: 600, color: 'text.secondary', ml: 0.5 }}
              >
                Clear filters
              </Button>
            )}
          </Stack>

          {activeChips.length > 0 && (
            <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap" sx={{ mt: 1.25 }}>
              {activeChips.map((chip) => (
                <Chip
                  key={chip.key}
                  size="small"
                  label={chip.label}
                  onDelete={chip.onDelete}
                  sx={{ height: 26, fontWeight: 600 }}
                />
              ))}
            </Stack>
          )}
        </Box>
        <TableContainer>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell sx={contactsPageSx.tableHeadCell}>Name</TableCell>
                <TableCell sx={{ ...contactsPageSx.tableHeadCell, display: { xs: 'none', md: 'table-cell' } }}>Email</TableCell>
                <TableCell sx={{ ...contactsPageSx.tableHeadCell, display: { xs: 'none', sm: 'table-cell' } }}>Phone</TableCell>
                <TableCell sx={{ ...contactsPageSx.tableHeadCell, display: { xs: 'none', lg: 'table-cell' } }}>Company</TableCell>
                <TableCell align="right" sx={contactsPageSx.tableHeadCell}>Quotes</TableCell>
                <TableCell align="right" sx={contactsPageSx.tableHeadCell}>Jobs</TableCell>
                <TableCell align="right" sx={{ ...contactsPageSx.tableHeadCell, display: { xs: 'none', sm: 'table-cell' } }}>
                  Pending
                </TableCell>
                <TableCell align="right" sx={contactsPageSx.tableHeadCell}>Invoices</TableCell>
                <TableCell sx={{ ...contactsPageSx.tableHeadCell, display: { xs: 'none', md: 'table-cell' } }}>Added</TableCell>
                <TableCell width={96} sx={contactsPageSx.tableHeadCell} />
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading
                ? Array.from({ length: 8 }).map((_, i) => (
                    <TableRow key={i}>
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((j) => (
                        <TableCell key={j}>
                          <Skeleton variant="text" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                : rows.map((row) => {
                    const name = [row.first_name, row.last_name].filter(Boolean).join(' ') || '—';
                    const slug = contactDetailSlug(row);
                    return (
                      <TableRow
                        key={slug ?? row.id}
                        hover
                        sx={{
                          cursor: 'pointer',
                          transition: 'background-color 0.12s ease',
                          '&:hover': { bgcolor: 'action.hover' },
                          '& td': { borderColor: 'grey.100', py: 1.5 },
                        }}
                        onClick={() => slug != null && navigate(`/admin/contacts/${encodeURIComponent(String(slug))}`)}
                      >
                        <TableCell>
                          <Typography fontWeight={600} variant="body2">{name}</Typography>
                          {(row.dnd || row.tax_exempt) && (
                            <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ mt: 0.5 }}>
                              {row.dnd && (
                                <Chip size="small" label="DND" color="warning" variant="outlined" sx={{ height: 22 }} />
                              )}
                              {row.tax_exempt && (
                                <Chip size="small" label="Tax exempt" color="success" variant="outlined" sx={{ height: 22 }} />
                              )}
                            </Stack>
                          )}
                          <Typography variant="caption" color="text.secondary" sx={{ display: { md: 'none' }, mt: 0.25 }}>
                            {row.email || '—'}
                          </Typography>
                        </TableCell>
                        <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>{row.email || '—'}</TableCell>
                        <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>{row.phone || '—'}</TableCell>
                        <TableCell sx={{ display: { xs: 'none', lg: 'table-cell' } }}>{row.company_name || '—'}</TableCell>
                        <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums', color: 'text.secondary' }}>{row.submissions_count ?? 0}</TableCell>
                        <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums', color: 'text.secondary' }}>{row.jobs_count ?? 0}</TableCell>
                        <TableCell align="right" sx={{ display: { xs: 'none', sm: 'table-cell' }, fontVariantNumeric: 'tabular-nums', color: 'text.secondary' }}>
                          {row.pending_jobs_count ?? 0}
                        </TableCell>
                        <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums', color: 'text.secondary' }}>{row.invoices_count ?? 0}</TableCell>
                        <TableCell sx={{ display: { xs: 'none', md: 'table-cell' }, whiteSpace: 'nowrap' }}>
                          {formatWhen(row.date_added)}
                        </TableCell>
                        <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                          <Button
                            size="small"
                            variant="outlined"
                            color="primary"
                            sx={{ textTransform: 'none', fontWeight: 600, borderRadius: 1.5 }}
                            disabled={slug == null}
                            onClick={() => slug != null && navigate(`/admin/contacts/${encodeURIComponent(String(slug))}`)}
                          >
                            Open
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          component="div"
          rowsPerPageOptions={[25, 50, 100]}
          count={total}
          rowsPerPage={pageSize}
          page={Math.max(0, page - 1)}
          onPageChange={(_, next) => setPage(next + 1)}
          onRowsPerPageChange={(e) => {
            setPageSize(Math.min(100, parseInt(e.target.value, 10)));
            setPage(1);
          }}
          labelDisplayedRows={({ from, to, count }) => `${from}–${to} of ${count !== -1 ? count : `more than ${to}`}`}
        />
        {isFetching && !isLoading && (
          <Typography variant="caption" color="text.secondary" sx={{ px: 2, pb: 1, display: 'block' }}>
            Updating…
          </Typography>
        )}
      </Paper>
      </Stack>
    </Box>
  );
};

export default Contacts;
