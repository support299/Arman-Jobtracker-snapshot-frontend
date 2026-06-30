import React, { useMemo, useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Avatar,
  Chip,
  Paper,
  CircularProgress,
  alpha,
  Grid,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  EventBusy as EventBusyIcon,
  BeachAccess as VacationIcon,
  LocalHospital as SickIcon,
  Person as PersonIcon,
  MoreHoriz as OtherIcon,
  Weekend as DayOffIcon,
  Edit as EditIcon,
  DeleteOutline as DeleteIcon,
} from '@mui/icons-material';
import { useSelector } from 'react-redux';
import {
  useGetEmployeesQuery,
  useGetTimeOffListQuery,
  useCreateTimeOffMutation,
  useUpdateTimeOffMutation,
  useDeleteTimeOffMutation,
} from '../../../store/api/payrollApi';
import { useToast } from '@/hooks/use-toast';
import { canManagePayrollTimeOff } from '../../../utils/payrollAccess';
import TimeOffCoverageFields from './TimeOffCoverageFields';
import {
  DEFAULT_COVERAGE_FORM,
  buildCoveragePayload,
  coverageStateFromRow,
  formatEquivalentDays,
  formatTimeOffScheduleSummary,
} from './timeOffCoverage';

/** Matches payroll sub-nav bar (AdminLayout) */
const PAYROLL_NAVY = '#073D7F';

const KIND_OPTIONS = [
  { value: 'day_off', label: 'Day off' },
  { value: 'vacation', label: 'Vacation' },
  { value: 'sick', label: 'Sick' },
  { value: 'personal', label: 'Personal' },
  { value: 'other', label: 'Other' },
];

const kindMeta = {
  day_off: { label: 'Day off', color: '#64748b', Icon: DayOffIcon },
  vacation: { label: 'Vacation', color: '#8b5cf6', Icon: VacationIcon },
  sick: { label: 'Sick', color: '#ef4444', Icon: SickIcon },
  personal: { label: 'Personal', color: PAYROLL_NAVY, Icon: PersonIcon },
  other: { label: 'Other', color: '#94a3b8', Icon: OtherIcon },
};

function formatYmd(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function defaultRange() {
  const today = new Date();
  const from = new Date(today.getFullYear(), today.getMonth(), 1);
  const to = new Date(today.getFullYear(), today.getMonth() + 3, 0);
  return { from_date: formatYmd(from), to_date: formatYmd(to) };
}

function getInitials(name) {
  if (!name) return '?';
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function formatDisplayDate(ymd) {
  if (!ymd) return '—';
  const [y, m, d] = ymd.split('-').map(Number);
  if (!y || !m || !d) return ymd;
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/** Stable key for Select value + API `employee` (payroll row id, pk, or user link). */
function getEmployeeOptionKey(emp) {
  const v = emp?.user_id;
  if (v == null || v === '') return null;
  return String(v);
}

/** Value sent as JSON `employee` (integer id or UUID string). */
function toApiEmployeePayload(emp) {
  const raw = emp?.user_id;
  if (raw == null || raw === '') return null;
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  const s = String(raw).trim();
  if (/^\d+$/.test(s)) return parseInt(s, 10);
  return s;
}

/**
 * @param {{ requireEmployeeSelection: boolean, employees: object[], employeeSelectKey: string, kind: string, start: string, end: string, notes: string }} args
 * @returns {{ ok: true, body: object } | { ok: false, title: string, description: string }}
 */
function buildTimeOffRequestBody({
  requireEmployeeSelection,
  employees,
  employeeSelectKey,
  kind,
  start,
  end,
  notes,
  coverageState,
}) {
  if (start > end) {
    return {
      ok: false,
      title: 'Invalid dates',
      description: 'End date must be on or after start date.',
    };
  }
  const coverageBuilt = buildCoveragePayload({
    startDate: start,
    endDate: end,
    ...coverageState,
  });
  if (!coverageBuilt.ok) return coverageBuilt;

  const body = {
    start_date: start,
    end_date: end,
    kind,
    ...coverageBuilt.fields,
  };
  const trimmedNotes = (notes ?? '').trim();
  if (trimmedNotes) body.notes = trimmedNotes;

  if (requireEmployeeSelection) {
    const key = String(employeeSelectKey ?? '').trim();
    if (!key) {
      return {
        ok: false,
        title: 'Select an employee',
        description: 'Choose who this time off applies to.',
      };
    }
    const selected = employees.find((e) => getEmployeeOptionKey(e) === key);
    const apiEmployee = selected ? toApiEmployeePayload(selected) : null;
    const invalidNumeric =
      typeof apiEmployee === 'number' && (!Number.isFinite(apiEmployee) || apiEmployee < 1);
    if (!selected || apiEmployee == null || invalidNumeric) {
      return {
        ok: false,
        title: 'Select an employee',
        description:
          selected && apiEmployee == null
            ? 'This team member is missing a valid id in payroll data. Try refreshing the page.'
            : 'Choose who this time off applies to.',
      };
    }
    body.employee = apiEmployee;
  }
  return { ok: true, body };
}

/** Update payload only — employee stays fixed on the server (standard for PTO / absence edits). */
function buildTimeOffUpdateBody({ kind, start, end, notes, coverageState }) {
  if (start > end) {
    return {
      ok: false,
      title: 'Invalid dates',
      description: 'End date must be on or after start date.',
    };
  }
  const coverageBuilt = buildCoveragePayload({
    startDate: start,
    endDate: end,
    ...coverageState,
  });
  if (!coverageBuilt.ok) return coverageBuilt;

  const body = {
    start_date: start,
    end_date: end,
    kind,
    ...coverageBuilt.fields,
  };
  const trimmedNotes = (notes ?? '').trim();
  if (trimmedNotes) body.notes = trimmedNotes;
  return { ok: true, body };
}

function formatTimeOffApiError(err) {
  const d = err?.data;
  let msg =
    (typeof d === 'string' && d) ||
    d?.detail ||
    d?.message ||
    'Could not save time off. Please try again.';
  if (d && typeof d === 'object' && !d.detail && !d.message) {
    const parts = Object.entries(d).flatMap(([k, v]) =>
      Array.isArray(v) ? v.map((x) => `${k}: ${x}`) : [`${k}: ${v}`]
    );
    if (parts.length) msg = parts.join(' ');
  }
  return Array.isArray(msg) ? msg.join(' ') : String(msg);
}

/**
 * @param {{ hideHero?: boolean }} props — hideHero: omit inner title band when the page already has a heading (e.g. Time Off tab).
 */
const TimeOffSection = ({ hideHero = false }) => {
  const { toast } = useToast();
  const user = useSelector((state) => state.auth.user);

  const canManageTimeOff = canManagePayrollTimeOff(user);
  const showEmployeeColumn = canManageTimeOff;

  const [listRange, setListRange] = useState(() => defaultRange());
  const [formEmployee, setFormEmployee] = useState('');
  const [formKind, setFormKind] = useState('vacation');
  const [formStart, setFormStart] = useState(() => formatYmd(new Date()));
  const [formEnd, setFormEnd] = useState(() => formatYmd(new Date()));
  const [formNotes, setFormNotes] = useState('');
  const [formCoverage, setFormCoverage] = useState(DEFAULT_COVERAGE_FORM.coverage);
  const [formStartDayCoverage, setFormStartDayCoverage] = useState(DEFAULT_COVERAGE_FORM.startDayCoverage);
  const [formEndDayCoverage, setFormEndDayCoverage] = useState(DEFAULT_COVERAGE_FORM.endDayCoverage);
  const [formStartTime, setFormStartTime] = useState(DEFAULT_COVERAGE_FORM.startTime);
  const [formEndTime, setFormEndTime] = useState(DEFAULT_COVERAGE_FORM.endTime);
  const [formEndStartTime, setFormEndStartTime] = useState(DEFAULT_COVERAGE_FORM.endStartTime);
  const [formEndEndTime, setFormEndEndTime] = useState(DEFAULT_COVERAGE_FORM.endEndTime);

  const [editOpen, setEditOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  /** Read-only employee line in edit dialog; set from the row being edited. */
  const [editEmployeeDisplay, setEditEmployeeDisplay] = useState(null);
  const [editKind, setEditKind] = useState('vacation');
  const [editStart, setEditStart] = useState(() => formatYmd(new Date()));
  const [editEnd, setEditEnd] = useState(() => formatYmd(new Date()));
  const [editNotes, setEditNotes] = useState('');
  const [editCoverage, setEditCoverage] = useState(DEFAULT_COVERAGE_FORM.coverage);
  const [editStartDayCoverage, setEditStartDayCoverage] = useState(DEFAULT_COVERAGE_FORM.startDayCoverage);
  const [editEndDayCoverage, setEditEndDayCoverage] = useState(DEFAULT_COVERAGE_FORM.endDayCoverage);
  const [editStartTime, setEditStartTime] = useState(DEFAULT_COVERAGE_FORM.startTime);
  const [editEndTime, setEditEndTime] = useState(DEFAULT_COVERAGE_FORM.endTime);
  const [editEndStartTime, setEditEndStartTime] = useState(DEFAULT_COVERAGE_FORM.endStartTime);
  const [editEndEndTime, setEditEndEndTime] = useState(DEFAULT_COVERAGE_FORM.endEndTime);

  const formCoverageState = {
    coverage: formCoverage,
    startDayCoverage: formStartDayCoverage,
    endDayCoverage: formEndDayCoverage,
    startTime: formStartTime,
    endTime: formEndTime,
    endStartTime: formEndStartTime,
    endEndTime: formEndEndTime,
  };

  const editCoverageState = {
    coverage: editCoverage,
    startDayCoverage: editStartDayCoverage,
    endDayCoverage: editEndDayCoverage,
    startTime: editStartTime,
    endTime: editEndTime,
    endStartTime: editEndStartTime,
    endEndTime: editEndEndTime,
  };

  /** Row pending deletion in the confirmation dialog (same shape as list `results` items). */
  const [deleteConfirmRow, setDeleteConfirmRow] = useState(null);

  const { data: employeesData } = useGetEmployeesQuery({ is_active: true }, { skip: !canManageTimeOff });
  const employees = employeesData?.results || [];

  const listParams = useMemo(
    () => ({
      from_date: listRange.from_date,
      to_date: listRange.to_date,
    }),
    [listRange.from_date, listRange.to_date]
  );

  const rangeInvalid = listRange.from_date > listRange.to_date;

  const { data: timeOffData, isFetching: listLoading } = useGetTimeOffListQuery(listParams, {
    skip: rangeInvalid,
  });
  const [createTimeOff, { isLoading: creating }] = useCreateTimeOffMutation();
  const [updateTimeOff, { isLoading: updating }] = useUpdateTimeOffMutation();
  const [deleteTimeOff, { isLoading: deletingTimeOff }] = useDeleteTimeOffMutation();

  const results = rangeInvalid ? [] : timeOffData?.results || [];
  const totalCount = rangeInvalid ? 0 : timeOffData?.count ?? results.length;

  const closeEditDialog = () => {
    setEditOpen(false);
    setEditingId(null);
    setEditEmployeeDisplay(null);
    setEditNotes('');
  };

  const openEditDialog = (row) => {
    if (!canManageTimeOff || row?.id == null) return;
    setEditingId(row.id);
    setEditEmployeeDisplay({
      name: row.employee_name || 'Employee',
      email: row.employee_email || '',
    });
    const validKinds = new Set(KIND_OPTIONS.map((o) => o.value));
    setEditKind(validKinds.has(row.kind) ? row.kind : 'other');
    setEditStart(row.start_date || formatYmd(new Date()));
    setEditEnd(row.end_date || row.start_date || formatYmd(new Date()));
    setEditNotes(row.notes || '');
    const cov = coverageStateFromRow(row);
    setEditCoverage(cov.coverage);
    setEditStartDayCoverage(cov.startDayCoverage);
    setEditEndDayCoverage(cov.endDayCoverage);
    setEditStartTime(cov.startTime);
    setEditEndTime(cov.endTime);
    setEditEndStartTime(cov.endStartTime);
    setEditEndEndTime(cov.endEndTime);
    setEditOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canManageTimeOff) {
      toast({
        variant: 'destructive',
        title: 'Not allowed',
        description: 'Only a manager, supervisor, or administrator can add time off.',
      });
      return;
    }
    const built = buildTimeOffRequestBody({
      requireEmployeeSelection: true,
      employees,
      employeeSelectKey: formEmployee,
      kind: formKind,
      start: formStart,
      end: formEnd,
      notes: formNotes,
      coverageState: formCoverageState,
    });
    if (!built.ok) {
      toast({ variant: 'destructive', title: built.title, description: built.description });
      return;
    }

    try {
      await createTimeOff(built.body).unwrap();
      toast({
        title: 'Time off recorded',
        description: 'The entry has been added for the selected employee.',
      });
      setFormNotes('');
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Something went wrong',
        description: formatTimeOffApiError(err),
      });
    }
  };

  const handleEditSave = async () => {
    if (!canManageTimeOff || editingId == null) return;
    const built = buildTimeOffUpdateBody({
      kind: editKind,
      start: editStart,
      end: editEnd,
      notes: editNotes,
      coverageState: editCoverageState,
    });
    if (!built.ok) {
      toast({ variant: 'destructive', title: built.title, description: built.description });
      return;
    }

    try {
      await updateTimeOff({ id: editingId, ...built.body }).unwrap();
      toast({
        title: 'Time off updated',
        description: 'Your changes have been saved.',
      });
      closeEditDialog();
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Something went wrong',
        description: formatTimeOffApiError(err),
      });
    }
  };

  const closeDeleteConfirmDialog = () => {
    if (!deletingTimeOff) setDeleteConfirmRow(null);
  };

  const openDeleteConfirmDialog = (row) => {
    if (!canManageTimeOff || row?.id == null) return;
    setDeleteConfirmRow(row);
  };

  const confirmDeleteTimeOff = async () => {
    const row = deleteConfirmRow;
    if (!canManageTimeOff || row?.id == null) return;
    try {
      await deleteTimeOff(row.id).unwrap();
      setDeleteConfirmRow(null);
      if (editingId === row.id) closeEditDialog();
      toast({
        title: 'Time off removed',
        description: 'The entry has been deleted.',
      });
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Something went wrong',
        description: formatTimeOffApiError(err),
      });
    }
  };

  return (
    <Card
      elevation={0}
      sx={{
        borderRadius: 3,
        border: '1px solid',
        borderColor: 'divider',
        bgcolor: 'white',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        overflow: 'hidden',
      }}
    >
      <CardContent sx={{ p: 0 }}>
        {!hideHero && (
          <Box
            sx={{
              px: { xs: 2.5, sm: 3 },
              py: { xs: 2, sm: 2.5 },
              borderBottom: '1px solid',
              borderColor: 'divider',
              background: `linear-gradient(135deg, ${alpha(PAYROLL_NAVY, 0.08)} 0%, rgba(255,255,255,0) 60%)`,
            }}
          >
            <Box display="flex" alignItems="flex-start" gap={2} flexWrap="wrap">
              <Box
                sx={{
                  width: 48,
                  height: 48,
                  borderRadius: 2,
                  bgcolor: alpha(PAYROLL_NAVY, 0.12),
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <EventBusyIcon sx={{ fontSize: 26, color: PAYROLL_NAVY }} />
              </Box>
              <Box flex={1} minWidth={0}>
                <Typography variant="h5" fontWeight={700} color="#0f172a" sx={{ fontSize: { xs: '1.2rem', sm: '1.35rem' } }}>
                  Time off
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, maxWidth: 720 }}>
                  {canManageTimeOff
                    ? 'Record or update scheduled absence for any team member. Entries appear in the list below for the selected date range.'
                    : 'Your scheduled time off appears below. Only a manager, supervisor, or administrator can add or change entries.'}
                </Typography>
              </Box>
            </Box>
          </Box>
        )}

        <Box sx={{ p: { xs: 2.5, sm: 3 } }}>
          {canManageTimeOff ? (
            <>
              <Typography variant="subtitle1" fontWeight={600} color="#0f172a" sx={{ mb: 1.5 }}>
                Add time off
              </Typography>

              <Box
                component="form"
                onSubmit={handleSubmit}
                sx={{
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 2,
                  bgcolor: 'white',
                  overflow: 'hidden',
                }}
              >
                <Box sx={{ p: { xs: 1.5, sm: 2 } }}>
                  <Grid container spacing={1.5} alignItems="center">
                    <Grid item xs={12} lg={4}>
                      <FormControl fullWidth size="small">
                        <InputLabel id="timeoff-employee-label" shrink>
                          Employee
                        </InputLabel>
                        <Select
                          labelId="timeoff-employee-label"
                          value={formEmployee}
                          label="Employee"
                          displayEmpty
                          onChange={(e) =>
                            setFormEmployee(String(e.target.value ?? ''))
                          }
                          inputProps={{ autoComplete: 'off' }}
                          renderValue={(selected) => {
                            if (!selected) {
                              return (
                                <Typography component="span" color="text.secondary" fontSize="0.875rem">
                                  Select employee
                                </Typography>
                              );
                            }
                            const emp = employees.find(
                              (e) => getEmployeeOptionKey(e) === String(selected)
                            );
                            if (!emp) return String(selected);
                            return (
                              <Box display="flex" alignItems="center" gap={1}>
                                <Avatar sx={{ width: 24, height: 24, fontSize: '0.65rem' }}>
                                  {getInitials(emp.full_name)}
                                </Avatar>
                                <Typography noWrap fontSize="0.875rem">
                                  {emp.full_name}
                                </Typography>
                              </Box>
                            );
                          }}
                          sx={{ borderRadius: 1.5 }}
                        >
                          <MenuItem value="" dense>
                            <em>Select employee</em>
                          </MenuItem>
                          {employees.map((emp) => {
                            const optKey = getEmployeeOptionKey(emp);
                            if (!optKey) return null;
                            return (
                              <MenuItem key={optKey} value={optKey} dense>
                                <Box display="flex" alignItems="center" gap={1}>
                                  <Avatar sx={{ width: 24, height: 24, fontSize: '0.65rem' }}>
                                    {getInitials(emp.full_name)}
                                  </Avatar>
                                  {emp.full_name}
                                </Box>
                              </MenuItem>
                            );
                          })}
                        </Select>
                      </FormControl>
                    </Grid>
                    <Grid item xs={6} sm={4} lg={2}>
                      <FormControl fullWidth size="small">
                        <InputLabel id="timeoff-kind-label">Type</InputLabel>
                        <Select
                          labelId="timeoff-kind-label"
                          value={formKind}
                          label="Type"
                          onChange={(e) => setFormKind(e.target.value)}
                          sx={{ borderRadius: 1.5 }}
                        >
                          {KIND_OPTIONS.map((opt) => (
                            <MenuItem key={opt.value} value={opt.value} dense>
                              {opt.label}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Grid>
                    <Grid item xs={6} sm={4} lg={3}>
                      <TextField
                        fullWidth
                        size="small"
                        type="date"
                        label="Start"
                        value={formStart}
                        onChange={(e) => setFormStart(e.target.value)}
                        InputLabelProps={{ shrink: true }}
                        sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1.5 } }}
                      />
                    </Grid>
                    <Grid item xs={12} sm={4} lg={3}>
                      <TextField
                        fullWidth
                        size="small"
                        type="date"
                        label="End"
                        value={formEnd}
                        onChange={(e) => setFormEnd(e.target.value)}
                        InputLabelProps={{ shrink: true }}
                        sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1.5 } }}
                      />
                    </Grid>
                    <Grid item xs={12}>
                      <TimeOffCoverageFields
                        startDate={formStart}
                        endDate={formEnd}
                        coverage={formCoverage}
                        startDayCoverage={formStartDayCoverage}
                        endDayCoverage={formEndDayCoverage}
                        startTime={formStartTime}
                        endTime={formEndTime}
                        endStartTime={formEndStartTime}
                        endEndTime={formEndEndTime}
                        onCoverageChange={setFormCoverage}
                        onStartDayCoverageChange={setFormStartDayCoverage}
                        onEndDayCoverageChange={setFormEndDayCoverage}
                        onStartTimeChange={setFormStartTime}
                        onEndTimeChange={setFormEndTime}
                        onEndStartTimeChange={setFormEndStartTime}
                        onEndEndTimeChange={setFormEndEndTime}
                      />
                    </Grid>
                    <Grid item xs={12}>
                      <TextField
                        fullWidth
                        size="small"
                        placeholder="Notes (optional)"
                        value={formNotes}
                        onChange={(e) => setFormNotes(e.target.value)}
                        sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1.5 } }}
                      />
                    </Grid>
                  </Grid>
                </Box>

                <Box
                  sx={{
                    px: { xs: 1.5, sm: 2 },
                    py: 1.25,
                    borderTop: '1px solid',
                    borderColor: 'divider',
                    bgcolor: '#fafbfc',
                    display: 'flex',
                    justifyContent: 'flex-end',
                  }}
                >
                  <Button
                    type="submit"
                    variant="contained"
                    size="small"
                    disabled={creating}
                    startIcon={creating ? <CircularProgress size={16} color="inherit" /> : null}
                    sx={{
                      bgcolor: PAYROLL_NAVY,
                      textTransform: 'none',
                      fontWeight: 600,
                      px: 2.5,
                      borderRadius: 1.5,
                      boxShadow: 'none',
                      '&:hover': { bgcolor: '#062e63', boxShadow: 'none' },
                    }}
                  >
                    {creating ? 'Saving…' : 'Save time off'}
                  </Button>
                </Box>
              </Box>
            </>
          ) : (
            <Alert severity="info" sx={{ borderRadius: 2 }}>
              <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 0.5 }}>
                View only
              </Typography>
              <Typography variant="body2">
                Adding or editing time off is limited to managers, supervisors, and administrators.
                Contact your manager if a schedule change is needed.
              </Typography>
            </Alert>
          )}
        </Box>

        <Box
          sx={{
            px: { xs: 2.5, sm: 3 },
            py: { xs: 2, sm: 2.5 },
            borderTop: '1px solid',
            borderColor: 'divider',
            bgcolor: '#fafbfc',
          }}
        >
          <Box
            display="flex"
            flexDirection={{ xs: 'column', sm: 'row' }}
            alignItems={{ sm: 'flex-end' }}
            justifyContent="space-between"
            gap={2}
            mb={2}
          >
            <Box>
              <Typography variant="subtitle1" fontWeight={600} color="#0f172a">
                Scheduled time off
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Showing {totalCount} {totalCount === 1 ? 'entry' : 'entries'} in range
              </Typography>
            </Box>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ width: { xs: '100%', sm: 'auto' } }}>
              <TextField
                size="small"
                type="date"
                label="From"
                value={listRange.from_date}
                onChange={(e) => setListRange((r) => ({ ...r, from_date: e.target.value }))}
                InputLabelProps={{ shrink: true }}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2, bgcolor: 'white' } }}
              />
              <TextField
                size="small"
                type="date"
                label="To"
                value={listRange.to_date}
                onChange={(e) => setListRange((r) => ({ ...r, to_date: e.target.value }))}
                InputLabelProps={{ shrink: true }}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2, bgcolor: 'white' } }}
              />
            </Stack>
          </Box>

          {rangeInvalid && (
            <Alert severity="warning" sx={{ mb: 2, borderRadius: 2 }}>
              From date must be on or before the To date to load entries.
            </Alert>
          )}

          {listLoading && !rangeInvalid ? (
            <Box display="flex" justifyContent="center" py={6}>
              <CircularProgress size={36} sx={{ color: PAYROLL_NAVY }} />
            </Box>
          ) : results.length === 0 ? (
            <Box textAlign="center" py={6} px={2}>
              <EventBusyIcon sx={{ fontSize: 52, color: '#cbd5e1', mb: 1.5 }} />
              <Typography variant="subtitle1" fontWeight={600} color="#64748b">
                No time off in this range
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {canManageTimeOff
                  ? 'Adjust the dates above or add a new entry.'
                  : 'Adjust the date range above. Ask a manager or supervisor to add or update entries.'}
              </Typography>
            </Box>
          ) : (
            <>
              <Box sx={{ display: { xs: 'none', md: 'block' } }}>
                <TableContainer
                  component={Paper}
                  elevation={0}
                  sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, overflow: 'hidden' }}
                >
                  <Table size="small">
                    <TableHead>
                      <TableRow sx={{ bgcolor: '#f1f5f9' }}>
                        {showEmployeeColumn && (
                          <TableCell sx={{ fontWeight: 600, color: '#64748b', fontSize: '0.8125rem' }}>Employee</TableCell>
                        )}
                        <TableCell sx={{ fontWeight: 600, color: '#64748b', fontSize: '0.8125rem' }}>Type</TableCell>
                        <TableCell sx={{ fontWeight: 600, color: '#64748b', fontSize: '0.8125rem' }}>Dates</TableCell>
                        <TableCell sx={{ fontWeight: 600, color: '#64748b', fontSize: '0.8125rem' }}>Schedule</TableCell>
                        <TableCell sx={{ fontWeight: 600, color: '#64748b', fontSize: '0.8125rem' }}>Days</TableCell>
                        <TableCell sx={{ fontWeight: 600, color: '#64748b', fontSize: '0.8125rem' }}>Notes</TableCell>
                        {canManageTimeOff && (
                          <TableCell
                            align="right"
                            sx={{ fontWeight: 600, color: '#64748b', fontSize: '0.8125rem', width: 104 }}
                          >
                            Actions
                          </TableCell>
                        )}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {results.map((row) => {
                        const meta = kindMeta[row.kind] || kindMeta.other;
                        const KindIcon = meta.Icon;
                        const rowKey = row.id ?? `row-${row.start_date}-${row.end_date}-${row.employee}`;
                        return (
                          <TableRow key={rowKey} hover sx={{ '&:last-child td': { borderBottom: 0 } }}>
                            {showEmployeeColumn && (
                              <TableCell>
                                <Box display="flex" alignItems="center" gap={1.5}>
                                  <Avatar sx={{ width: 36, height: 36, fontSize: '0.75rem', bgcolor: PAYROLL_NAVY }}>
                                    {getInitials(row.employee_name)}
                                  </Avatar>
                                  <Box minWidth={0}>
                                    <Typography variant="body2" fontWeight={600} color="#0f172a" noWrap>
                                      {row.employee_name}
                                    </Typography>
                                    {row.employee_email && (
                                      <Typography variant="caption" color="text.secondary" noWrap display="block">
                                        {row.employee_email}
                                      </Typography>
                                    )}
                                  </Box>
                                </Box>
                              </TableCell>
                            )}
                            <TableCell>
                              <Chip
                                icon={<KindIcon sx={{ fontSize: '16px !important' }} />}
                                label={meta.label}
                                size="small"
                                sx={{
                                  bgcolor: alpha(meta.color, 0.1),
                                  color: meta.color,
                                  fontWeight: 600,
                                  border: `1px solid ${alpha(meta.color, 0.25)}`,
                                  '& .MuiChip-icon': { color: meta.color },
                                }}
                              />
                            </TableCell>
                            <TableCell>
                              <Typography variant="body2" fontWeight={500} color="#0f172a">
                                {formatDisplayDate(row.start_date)}
                              </Typography>
                              {row.start_date !== row.end_date && (
                                <Typography variant="caption" color="text.secondary" display="block">
                                  → {formatDisplayDate(row.end_date)}
                                </Typography>
                              )}
                            </TableCell>
                            <TableCell sx={{ maxWidth: 220 }}>
                              <Typography variant="body2" color="#334155">
                                {formatTimeOffScheduleSummary(row)}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              {formatEquivalentDays(row.equivalent_days) ? (
                                <Chip
                                  label={formatEquivalentDays(row.equivalent_days)}
                                  size="small"
                                  sx={{
                                    fontWeight: 600,
                                    bgcolor: alpha(PAYROLL_NAVY, 0.08),
                                    color: PAYROLL_NAVY,
                                    border: `1px solid ${alpha(PAYROLL_NAVY, 0.2)}`,
                                  }}
                                />
                              ) : (
                                <Typography variant="body2" color="text.secondary">
                                  —
                                </Typography>
                              )}
                            </TableCell>
                            <TableCell sx={{ maxWidth: 280 }}>
                              <Typography variant="body2" color="text.secondary" sx={{ wordBreak: 'break-word' }}>
                                {row.notes || '—'}
                              </Typography>
                            </TableCell>
                            {canManageTimeOff && (
                              <TableCell align="right" sx={{ verticalAlign: 'middle' }}>
                                {row.id != null ? (
                                  <Stack direction="row" spacing={0} justifyContent="flex-end">
                                    <Tooltip title="Edit">
                                      <IconButton
                                        size="small"
                                        aria-label={`Edit time off for ${row.employee_name || 'employee'}`}
                                        onClick={() => openEditDialog(row)}
                                        disabled={deletingTimeOff}
                                        sx={{
                                          color: PAYROLL_NAVY,
                                          '&:hover': { bgcolor: alpha(PAYROLL_NAVY, 0.08) },
                                        }}
                                      >
                                        <EditIcon fontSize="small" />
                                      </IconButton>
                                    </Tooltip>
                                    <Tooltip title="Delete">
                                      <IconButton
                                        size="small"
                                        aria-label={`Delete time off for ${row.employee_name || 'employee'}`}
                                        onClick={() => openDeleteConfirmDialog(row)}
                                        disabled={deletingTimeOff}
                                        sx={{
                                          color: '#b91c1c',
                                          '&:hover': { bgcolor: alpha('#b91c1c', 0.08) },
                                        }}
                                      >
                                        <DeleteIcon fontSize="small" />
                                      </IconButton>
                                    </Tooltip>
                                  </Stack>
                                ) : null}
                              </TableCell>
                            )}
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Box>

              <Stack spacing={2} sx={{ display: { xs: 'flex', md: 'none' } }}>
                {results.map((row) => {
                  const meta = kindMeta[row.kind] || kindMeta.other;
                  const KindIcon = meta.Icon;
                  const rowKey = row.id ?? `card-${row.start_date}-${row.end_date}-${row.employee}`;
                  return (
                    <Paper
                      key={rowKey}
                      elevation={0}
                      sx={{
                        p: 2,
                        borderRadius: 2,
                        border: '1px solid',
                        borderColor: 'divider',
                        borderLeft: `4px solid ${meta.color}`,
                        bgcolor: 'white',
                        position: 'relative',
                      }}
                    >
                      {canManageTimeOff && row.id != null && (
                        <Stack
                          direction="row"
                          spacing={0}
                          sx={{
                            position: 'absolute',
                            top: 8,
                            right: 8,
                          }}
                        >
                          <Tooltip title="Edit">
                            <IconButton
                              size="small"
                              aria-label="Edit time off"
                              onClick={() => openEditDialog(row)}
                              disabled={deletingTimeOff}
                              sx={{
                                color: PAYROLL_NAVY,
                                '&:hover': { bgcolor: alpha(PAYROLL_NAVY, 0.08) },
                              }}
                            >
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Delete">
                            <IconButton
                              size="small"
                              aria-label="Delete time off"
                              onClick={() => openDeleteConfirmDialog(row)}
                              disabled={deletingTimeOff}
                              sx={{
                                color: '#b91c1c',
                                '&:hover': { bgcolor: alpha('#b91c1c', 0.08) },
                              }}
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Stack>
                      )}
                      {showEmployeeColumn && (
                        <Box display="flex" alignItems="center" gap={1.5} mb={1.5}>
                          <Avatar sx={{ width: 40, height: 40, fontSize: '0.8rem', bgcolor: PAYROLL_NAVY }}>
                            {getInitials(row.employee_name)}
                          </Avatar>
                          <Box minWidth={0}>
                            <Typography variant="body2" fontWeight={600} color="#0f172a">
                              {row.employee_name}
                            </Typography>
                            {row.employee_email && (
                              <Typography variant="caption" color="text.secondary">
                                {row.employee_email}
                              </Typography>
                            )}
                          </Box>
                        </Box>
                      )}
                      <Chip
                        icon={<KindIcon sx={{ fontSize: '16px !important' }} />}
                        label={meta.label}
                        size="small"
                        sx={{
                          mb: 1.5,
                          bgcolor: alpha(meta.color, 0.1),
                          color: meta.color,
                          fontWeight: 600,
                          '& .MuiChip-icon': { color: meta.color },
                        }}
                      />
                      <Typography variant="caption" color="text.secondary" display="block">
                        {formatDisplayDate(row.start_date)}
                        {row.start_date !== row.end_date
                          ? ` → ${formatDisplayDate(row.end_date)}`
                          : ''}
                      </Typography>
                      <Typography variant="body2" color="#334155" sx={{ mt: 0.75 }}>
                        {formatTimeOffScheduleSummary(row)}
                      </Typography>
                      {formatEquivalentDays(row.equivalent_days) && (
                        <Chip
                          label={formatEquivalentDays(row.equivalent_days)}
                          size="small"
                          sx={{
                            mt: 1,
                            fontWeight: 600,
                            bgcolor: alpha(PAYROLL_NAVY, 0.08),
                            color: PAYROLL_NAVY,
                          }}
                        />
                      )}
                      {row.notes && (
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                          {row.notes}
                        </Typography>
                      )}
                    </Paper>
                  );
                })}
              </Stack>
            </>
          )}
        </Box>

        <Dialog
          open={editOpen}
          onClose={() => {
            if (!updating) closeEditDialog();
          }}
          fullWidth
          maxWidth="md"
          PaperProps={{ sx: { borderRadius: 3 } }}
        >
          <DialogTitle sx={{ fontWeight: 700, color: '#0f172a', py: 1.5, pb: 0.5 }}>
            Edit time off
          </DialogTitle>
          <DialogContent sx={{ pt: 1, pb: 1.5 }}>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
                py: 1,
                px: 1.5,
                mb: 1.5,
                borderRadius: 1.5,
                bgcolor: '#f8fafc',
                border: '1px solid',
                borderColor: 'divider',
              }}
            >
              <Avatar sx={{ width: 32, height: 32, bgcolor: PAYROLL_NAVY, fontSize: '0.75rem' }}>
                {getInitials(editEmployeeDisplay?.name)}
              </Avatar>
              <Box minWidth={0}>
                <Typography variant="body2" fontWeight={600} color="#0f172a" noWrap>
                  {editEmployeeDisplay?.name || 'Employee'}
                </Typography>
                {editEmployeeDisplay?.email ? (
                  <Typography variant="caption" color="text.secondary" noWrap display="block">
                    {editEmployeeDisplay.email}
                  </Typography>
                ) : null}
              </Box>
            </Box>

            <Grid container spacing={1.5} alignItems="center">
              <Grid item xs={12} sm={4}>
                <FormControl fullWidth size="small">
                  <InputLabel id="timeoff-edit-kind-label">Type</InputLabel>
                  <Select
                    labelId="timeoff-edit-kind-label"
                    value={editKind}
                    label="Type"
                    onChange={(e) => setEditKind(e.target.value)}
                    sx={{ borderRadius: 1.5 }}
                  >
                    {KIND_OPTIONS.map((opt) => (
                      <MenuItem key={opt.value} value={opt.value} dense>
                        {opt.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={6} sm={4}>
                <TextField
                  fullWidth
                  size="small"
                  type="date"
                  label="Start"
                  value={editStart}
                  onChange={(e) => setEditStart(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1.5 } }}
                />
              </Grid>
              <Grid item xs={6} sm={4}>
                <TextField
                  fullWidth
                  size="small"
                  type="date"
                  label="End"
                  value={editEnd}
                  onChange={(e) => setEditEnd(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1.5 } }}
                />
              </Grid>
              <Grid item xs={12}>
                <TimeOffCoverageFields
                  startDate={editStart}
                  endDate={editEnd}
                  coverage={editCoverage}
                  startDayCoverage={editStartDayCoverage}
                  endDayCoverage={editEndDayCoverage}
                  startTime={editStartTime}
                  endTime={editEndTime}
                  endStartTime={editEndStartTime}
                  endEndTime={editEndEndTime}
                  onCoverageChange={setEditCoverage}
                  onStartDayCoverageChange={setEditStartDayCoverage}
                  onEndDayCoverageChange={setEditEndDayCoverage}
                  onStartTimeChange={setEditStartTime}
                  onEndTimeChange={setEditEndTime}
                  onEndStartTimeChange={setEditEndStartTime}
                  onEndEndTimeChange={setEditEndEndTime}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  size="small"
                  placeholder="Notes (optional)"
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1.5 } }}
                />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions
            sx={{
              px: 2,
              py: 1.25,
              borderTop: '1px solid',
              borderColor: 'divider',
              gap: 1,
            }}
          >
            <Button onClick={closeEditDialog} disabled={updating} color="inherit" sx={{ textTransform: 'none' }}>
              Cancel
            </Button>
            <Button
              onClick={handleEditSave}
              variant="contained"
              disabled={updating}
              startIcon={updating ? <CircularProgress size={18} color="inherit" /> : null}
              sx={{
                textTransform: 'none',
                fontWeight: 600,
                bgcolor: PAYROLL_NAVY,
                borderRadius: 2,
                px: 2.5,
                '&:hover': { bgcolor: '#062e63' },
              }}
            >
              {updating ? 'Saving…' : 'Save changes'}
            </Button>
          </DialogActions>
        </Dialog>

        <Dialog
          open={Boolean(deleteConfirmRow)}
          onClose={() => {
            if (!deletingTimeOff) closeDeleteConfirmDialog();
          }}
          fullWidth
          maxWidth="xs"
          PaperProps={{ sx: { borderRadius: 3 } }}
        >
          <DialogTitle sx={{ fontWeight: 700, color: '#0f172a', pb: 0.5 }}>Delete time off?</DialogTitle>
          <DialogContent>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              This removes the scheduled absence permanently. You can&apos;t undo this action.
            </Typography>
            {deleteConfirmRow && (
              <Box
                sx={{
                  p: 2,
                  borderRadius: 2,
                  bgcolor: '#fef2f2',
                  border: '1px solid',
                  borderColor: alpha('#b91c1c', 0.22),
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 2,
                }}
              >
                <Box
                  sx={{
                    width: 40,
                    height: 40,
                    borderRadius: 2,
                    bgcolor: alpha('#b91c1c', 0.12),
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <DeleteIcon sx={{ fontSize: 22, color: '#b91c1c' }} />
                </Box>
                <Box minWidth={0}>
                  <Typography variant="caption" color="text.secondary" fontWeight={500} display="block">
                    Entry
                  </Typography>
                  {deleteConfirmRow.employee_name ? (
                    <Typography variant="body2" fontWeight={600} color="#0f172a">
                      {deleteConfirmRow.employee_name}
                    </Typography>
                  ) : null}
                  <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                    {(kindMeta[deleteConfirmRow.kind] || kindMeta.other).label} ·{' '}
                    {formatDisplayDate(deleteConfirmRow.start_date)}
                    {deleteConfirmRow.start_date !== deleteConfirmRow.end_date
                      ? ` — ${formatDisplayDate(deleteConfirmRow.end_date)}`
                      : ''}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" display="block">
                    {formatTimeOffScheduleSummary(deleteConfirmRow)}
                  </Typography>
                </Box>
              </Box>
            )}
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2.5, pt: 0, gap: 1 }}>
            <Button
              onClick={closeDeleteConfirmDialog}
              disabled={deletingTimeOff}
              color="inherit"
              sx={{ textTransform: 'none' }}
            >
              Cancel
            </Button>
            <Button
              onClick={confirmDeleteTimeOff}
              variant="contained"
              disabled={deletingTimeOff}
              startIcon={deletingTimeOff ? <CircularProgress size={18} color="inherit" /> : null}
              sx={{
                textTransform: 'none',
                fontWeight: 600,
                bgcolor: '#b91c1c',
                borderRadius: 2,
                px: 2.5,
                boxShadow: 'none',
                '&:hover': { bgcolor: '#991b1b', boxShadow: 'none' },
              }}
            >
              {deletingTimeOff ? 'Deleting…' : 'Delete'}
            </Button>
          </DialogActions>
        </Dialog>
      </CardContent>
    </Card>
  );
};

export default TimeOffSection;
