import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  FormControl,
  InputAdornment,
  InputLabel,
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
    return p;
  }, [page, pageSize, ordering, debouncedSearch]);

  const { data, isLoading, isFetching, error } = useGetDashboardContactsQuery(queryParams, {
    placeholderData: (previousData) => previousData,
  });

  const rows = data?.results ?? [];
  const total = data?.count ?? 0;

  const handleClearFilters = () => {
    setSearchInput('');
    setDebouncedSearch('');
    setOrdering('-date_added');
    setPage(1);
  };

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

        <Card elevation={0} sx={(theme) => ({ ...contactsPageSx.surface(theme), mb: 0 })}>
          <CardContent sx={{ p: { xs: 2, sm: 2.5 } }}>
          <Typography variant="subtitle2" fontWeight={600} color="text.primary" sx={{ mb: 2, fontSize: '0.8125rem' }}>
            Filters
          </Typography>
          <Box
            sx={{
              display: 'grid',
              gap: 2,
              gridTemplateColumns: { xs: '1fr', sm: '1fr auto', md: 'minmax(0, 2fr) minmax(140px, 220px) auto' },
              alignItems: 'end',
            }}
          >
            <TextField
              size="small"
              label="Search"
              placeholder="Name, email, phone, company, contact id…"
              value={searchInput}
              onChange={(e) => {
                setSearchInput(e.target.value);
                setPage(1);
              }}
              fullWidth
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search fontSize="small" sx={{ color: 'text.secondary' }} />
                  </InputAdornment>
                ),
              }}
            />
            <FormControl size="small" fullWidth>
              <InputLabel id="contacts-ordering">Sort</InputLabel>
              <Select
                labelId="contacts-ordering"
                label="Sort"
                value={ordering}
                onChange={(e) => {
                  setOrdering(e.target.value);
                  setPage(1);
                }}
              >
                {ORDERING_OPTIONS.map((o) => (
                  <MenuItem key={o.value} value={o.value}>
                    {o.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Button variant="text" color="inherit" onClick={handleClearFilters} sx={{ height: 40 }}>
              Reset
            </Button>
          </Box>
          </CardContent>
        </Card>

      {error && (
        <Alert severity="error" sx={{ mb: 0 }}>
          {error?.data?.detail || error?.error || 'Unable to load contacts.'}
        </Alert>
      )}

      {!isLoading && !error && (
        <Typography variant="body2" sx={{ fontSize: '0.8125rem', color: 'text.secondary' }}>
          {total === 0 ? 'No contacts match your filters.' : `${total.toLocaleString()} record${total === 1 ? '' : 's'}`}
        </Typography>
      )}

      <Paper elevation={0} sx={(theme) => ({ ...contactsPageSx.surface(theme), overflow: 'hidden' })}>
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
                          {row.dnd && (
                            <Chip size="small" label="DND" color="warning" variant="outlined" sx={{ mt: 0.5, height: 22 }} />
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
