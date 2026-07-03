import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Grid,
  CircularProgress,
  Alert,
  Tooltip,
  Stack,
  Divider,
  Pagination,
} from '@mui/material';
import {
  FilterList as FilterIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Clear as ClearIcon,
  FileDownload as DownloadIcon,
  Refresh as RefreshIcon,
  AttachMoney as MoneyIcon,
  Work as WorkIcon,
  AccessTime as TimeIcon,
  TrendingUp as TrendingUpIcon,
} from '@mui/icons-material';
import {
  useGetPayoutsQuery,
  useUpdatePayoutMutation,
  useDeletePayoutMutation,
  useGetEmployeesQuery,
  useUpdateTimeEntryMutation,
} from '../../../store/api/payrollApi';
import { TableSkeleton } from '../../../components/ui/skeletons';
import { useSelector } from 'react-redux';
import { useMoneyFormatter } from '../../../hooks/useMoneyFormatter';
import { canAccessPayrollAdminSections } from '../../../utils/payrollAccess';

function formatYmd(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

const PayrollReports = () => {
  const user = useSelector((state) => state.auth.user);
  const userRole = user?.role || 'worker';
  const canEditDelete = canAccessPayrollAdminSections(userRole, user);

  // Default date range: month-to-date (first day of this month – today).
  const getDefaultDateRange = () => {
    const today = new Date();
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    return {
      start_date: formatYmd(monthStart),
      end_date: formatYmd(today),
    };
  };

  const [filters, setFilters] = useState(() => {
    const d = getDefaultDateRange();
    return {
      employee: '',
      type: '',
      project_title: '',
      start_date: d.start_date,
      end_date: d.end_date,
    };
  });

  const [page, setPage] = useState(1);

  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedPayout, setSelectedPayout] = useState(null);
  const [editFormData, setEditFormData] = useState({
    amount: '',
    rate_percentage: '',
    project_value: '',
    notes: '',
    check_in_time: '',
    check_out_time: '',
    total_hours: '',
  });
  const [formErrors, setFormErrors] = useState({});
  const [notification, setNotification] = useState({ open: false, type: '', message: '' });
  const lastChangedFieldRef = useRef(null);

  // Build query params from filters
  const queryParams = useMemo(() => {
    const params = {};
    if (filters.employee) params.employee = filters.employee;
    if (filters.type) params.type = filters.type;
    if (filters.start_date) params.start_date = filters.start_date;
    if (filters.end_date) params.end_date = filters.end_date;
    if (filters.project_title) params.project_title = filters.project_title;
    params.page = page;

    return params;
  }, [filters, page]);

  const { data: payoutsData, isLoading, isFetching, refetch } = useGetPayoutsQuery(queryParams);
  const { data: employeesData, isLoading: loadingEmployees } = useGetEmployeesQuery({ is_active: true });
  const [updatePayout, { isLoading: updating }] = useUpdatePayoutMutation();
  const [updateTimeEntry] = useUpdateTimeEntryMutation();
  const [deletePayout, { isLoading: deleting }] = useDeletePayoutMutation();

  const payouts = payoutsData?.results || [];
  const employees = employeesData?.results || [];
  const totalCount = payoutsData?.count || 0;
  const totalPages = Math.ceil(totalCount / 20);
  
  // Get totals from API response
  const totals = payoutsData?.totals || {};
  const averagePayout = totals?.average_payout || 0;
  const payoutCount = totals?.payout_count || totalCount;
  const totalHoursWorked = totals?.total_hours_worked || 0;
  
  // Determine if we should show time entry columns (clock in, clock out, total hours)
  const showTimeColumns = filters.type === 'hourly' || payouts.some(p => p.payout_type === 'hourly' && p.time_entry_details);
  
  // Use totals from API for summary statistics
  const summary = useMemo(() => {
    return {
      totalAmount: totals.total_payouts || 0,
      totalCount: payoutCount,
      projectAmount: totals.project_total_payouts || 0,
      hourlyAmount: totals.hourly_total_payouts || 0,
      averagePayout: averagePayout,
      totalHoursWorked: totalHoursWorked,
    };
  }, [totals, averagePayout, payoutCount, totalHoursWorked]);

  const showNotification = (type, message) => {
    setNotification({ open: true, type, message });
    setTimeout(() => setNotification({ open: false, type: '', message: '' }), 5000);
  };

  const handleFilterChange = (field, value) => {
    setFilters(prev => ({ ...prev, [field]: value }));
    setPage(1);
  };

  const handlePageChange = (event, newPage) => {
    setPage(newPage);
  };
  
  const handleClearFilters = () => {
    const d = getDefaultDateRange();
    setFilters({
      employee: '',
      type: '',
      project_title: '',
      start_date: d.start_date,
      end_date: d.end_date,
    });
    setPage(1);
  };

  // Helper function to convert ISO datetime to local datetime string for datetime-local input
  const isoToLocalDateTime = (isoString) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    // Format as YYYY-MM-DDTHH:mm for datetime-local input
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  // Helper function to convert local datetime string to ISO string
  const localDateTimeToIso = (localDateTime) => {
    if (!localDateTime) return null;
    const date = new Date(localDateTime);
    return date.toISOString();
  };

  // Calculate total hours from clock in and clock out times
  const calculateTotalHours = (checkIn, checkOut) => {
    if (!checkIn || !checkOut) return '';
    const inTime = new Date(checkIn);
    const outTime = new Date(checkOut);
    if (outTime <= inTime) return '';
    const diffMs = outTime - inTime;
    const diffHours = diffMs / (1000 * 60 * 60);
    return diffHours.toFixed(2);
  };

  // Auto-calculate total hours when clock in/out times change
  useEffect(() => {
    if (selectedPayout?.payout_type === 'hourly' && editFormData.check_in_time && editFormData.check_out_time) {
      const calculated = calculateTotalHours(
        localDateTimeToIso(editFormData.check_in_time),
        localDateTimeToIso(editFormData.check_out_time)
      );
      if (calculated && calculated !== editFormData.total_hours) {
        lastChangedFieldRef.current = 'total_hours';
        setEditFormData(prev => ({ ...prev, total_hours: calculated }));
      }
      console.log(editFormData.total_hours, calculated);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editFormData.check_in_time, editFormData.check_out_time, selectedPayout?.payout_type]);

  // Calculate amount based on payout type and relevant fields
  const calculateAmount = () => {
    if (!selectedPayout) return null;

    const rate = parseFloat(editFormData.rate_percentage);
    if (!editFormData.rate_percentage || isNaN(rate) || rate <= 0) return null;

    if (selectedPayout.payout_type === 'hourly') {
      // For hourly payouts: amount = total_hours * rate_percentage (hourly rate)
      const hours = parseFloat(editFormData.total_hours);
      if (!editFormData.total_hours || isNaN(hours) || hours <= 0) return null;
      return (hours * rate).toFixed(2);
    } else {
      // For project payouts: amount = project_value * (rate_percentage / 100)
      const projectValue = parseFloat(editFormData.project_value);
      if (!editFormData.project_value || isNaN(projectValue) || projectValue <= 0) return null;
      return (projectValue * (rate / 100)).toFixed(2);
    }
  };

  // Calculate rate_percentage based on amount and payout type
  const calculateRatePercentage = () => {
    if (!selectedPayout) return null;

    const amount = parseFloat(editFormData.amount);
    if (!editFormData.amount || isNaN(amount) || amount <= 0) return null;

    if (selectedPayout.payout_type === 'hourly') {
      // For hourly payouts: rate_percentage = amount / total_hours
      const hours = parseFloat(editFormData.total_hours);
      if (!editFormData.total_hours || isNaN(hours) || hours <= 0) return null;
      return (amount / hours).toFixed(2);
    } else {
      // For project payouts: rate_percentage = (amount / project_value) * 100
      const projectValue = parseFloat(editFormData.project_value);
      if (!editFormData.project_value || isNaN(projectValue) || projectValue <= 0) return null;
      return ((amount / projectValue) * 100).toFixed(2);
    }
  };

  // Auto-calculate amount when rate_percentage, project_value, or total_hours change
  useEffect(() => {
    if (!editDialogOpen || !selectedPayout) return;
    // Skip if amount was just changed manually
    if (lastChangedFieldRef.current === 'amount') {
      lastChangedFieldRef.current = null;
      return;
    }

    const calculatedAmount = calculateAmount();
    if (calculatedAmount && calculatedAmount !== editFormData.amount) {
      lastChangedFieldRef.current = 'rate';
      setEditFormData(prev => ({ ...prev, amount: calculatedAmount }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    editFormData.rate_percentage,
    editFormData.project_value,
    editFormData.total_hours,
    selectedPayout?.payout_type,
    editDialogOpen,
  ]);

  // Auto-calculate rate_percentage when amount changes (reverse calculation)
  useEffect(() => {
    if (!editDialogOpen || !selectedPayout) return;
    // Skip if rate was just changed manually or calculated from rate
    if (lastChangedFieldRef.current === 'rate' || lastChangedFieldRef.current === 'project_value' || lastChangedFieldRef.current === 'total_hours') {
      lastChangedFieldRef.current = null;
      return;
    }

    // Check if amount matches what would be calculated from current rate
    // If it matches, don't recalculate (to avoid loops)
    const calculatedAmount = calculateAmount();
    if (calculatedAmount && Math.abs(parseFloat(calculatedAmount) - parseFloat(editFormData.amount || 0)) < 0.01) {
      return;
    }

    const calculatedRate = calculateRatePercentage();
    if (calculatedRate && calculatedRate !== editFormData.rate_percentage) {
      lastChangedFieldRef.current = 'amount';
      setEditFormData(prev => ({ ...prev, rate_percentage: calculatedRate }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    editFormData.amount,
    editFormData.project_value,
    editFormData.total_hours,
    selectedPayout?.payout_type,
    editDialogOpen,
  ]);

  const validateEditForm = () => {
    const errors = {};
    
    if (!editFormData.amount || parseFloat(editFormData.amount) <= 0) {
      errors.amount = 'Amount must be greater than 0';
    }
    
    if (editFormData.rate_percentage && 
        (parseFloat(editFormData.rate_percentage) < 0 || parseFloat(editFormData.rate_percentage) > 100)) {
      errors.rate_percentage = 'Rate must be between 0 and 100';
    }
    
    if (editFormData.project_value && parseFloat(editFormData.project_value) < 0) {
      errors.project_value = 'Project value cannot be negative';
    }

    // Validate time fields for hourly payouts
    if (selectedPayout?.payout_type === 'hourly') {
      if (editFormData.check_in_time && editFormData.check_out_time) {
        const checkIn = new Date(localDateTimeToIso(editFormData.check_in_time));
        const checkOut = new Date(localDateTimeToIso(editFormData.check_out_time));
        if (checkOut <= checkIn) {
          errors.check_out_time = 'Clock out time must be after clock in time';
        }
      }
      if (editFormData.total_hours && parseFloat(editFormData.total_hours) < 0) {
        errors.total_hours = 'Total hours cannot be negative';
      }
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleEdit = (payout) => {
    setSelectedPayout(payout);
    const timeEntryDetails = payout.time_entry_details || {};
    setEditFormData({
      amount: payout.amount || '',
      rate_percentage: payout.rate_percentage || '',
      project_value: payout.project_value || '',
      notes: payout.notes || '',
      check_in_time: timeEntryDetails.check_in_time ? isoToLocalDateTime(timeEntryDetails.check_in_time) : '',
      check_out_time: timeEntryDetails.check_out_time ? isoToLocalDateTime(timeEntryDetails.check_out_time) : '',
      total_hours: timeEntryDetails.total_hours ? parseFloat(timeEntryDetails.total_hours).toFixed(2) : '',
    });
    setFormErrors({});
    lastChangedFieldRef.current = null;
    setEditDialogOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!validateEditForm()) {
      return;
    }

    try {
      // Time entry details (clock in, clock out, total hours) go to the time-entries API
      if (selectedPayout?.payout_type === 'hourly' && selectedPayout?.time_entry) {
        const timeEntryPayload = {};
        if (editFormData.check_in_time) {
          timeEntryPayload.check_in_time = localDateTimeToIso(editFormData.check_in_time);
        }
        if (editFormData.check_out_time) {
          timeEntryPayload.check_out_time = localDateTimeToIso(editFormData.check_out_time);
        }
        if (editFormData.total_hours) {
          timeEntryPayload.total_hours = parseFloat(editFormData.total_hours);
        }
        console.log(timeEntryPayload, editFormData.total_hours);
        if (Object.keys(timeEntryPayload).length > 0) {
          await updateTimeEntry({
            id: selectedPayout.time_entry,
            ...timeEntryPayload,
          }).unwrap();
        }
      }

      // Payout-only fields go to the payouts API
      const updateData = {
        amount: parseFloat(editFormData.amount),
      };
      if (editFormData.rate_percentage) {
        updateData.rate_percentage = parseFloat(editFormData.rate_percentage);
      }
      if (editFormData.project_value) {
        updateData.project_value = parseFloat(editFormData.project_value);
      }
      if (editFormData.notes) {
        updateData.notes = editFormData.notes;
      }

      await updatePayout({
        id: selectedPayout.id,
        ...updateData,
      }).unwrap();

      setEditDialogOpen(false);
      showNotification('success', 'Payout updated successfully');
      refetch();
    } catch (err) {
      showNotification('error', err.data?.detail || err.data?.message || 'Failed to update payout');
    }
  };

  const handleDeleteConfirm = (payout) => {
    setSelectedPayout(payout);
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    try {
      await deletePayout(selectedPayout.id).unwrap();
      setDeleteDialogOpen(false);
      showNotification('success', 'Payout deleted successfully');
      refetch();
    } catch (err) {
      showNotification('error', err.data?.detail || err.data?.message || 'Failed to delete payout');
    }
  };

  const handleExport = () => {
    // Prepare CSV data
    const headers = ['Employee', 'Type', 'Project/Description', 'Amount', 'Rate', 'Project Value', 'Date', 'Notes'];
    const rows = payouts.map(p => [
      p.employee_name || 'N/A',
      p.payout_type || 'project',
      p.project_title || 'N/A',
      p.amount || '0',
      p.rate_percentage 
        ? `${parseFloat(p.rate_percentage).toFixed(2)}${p.payout_type === 'hourly' ? '/hr' : '%'}`
        : 'N/A',
      p.project_value || 'N/A',
      formatDate(p.created_at),
      p.notes || '',
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `payroll-report-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const { formatMoney: formatCurrency, currencySymbol } = useMoneyFormatter();

  const formatTime = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box mb={4}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Box>
            <Typography variant="h4" fontWeight={600} gutterBottom>
              Payroll Reports
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Comprehensive view of all employee payouts and earnings
            </Typography>
          </Box>
          <Stack direction="row" spacing={1}>
            <Tooltip title="Refresh data">
              <IconButton onClick={() => refetch()} disabled={isFetching}>
                <RefreshIcon />
              </IconButton>
            </Tooltip>
            <Button
              variant="outlined"
              startIcon={<DownloadIcon />}
              onClick={handleExport}
              disabled={payouts.length === 0 || isLoading}
            >
              Export
            </Button>
          </Stack>
        </Box>

        {/* Summary Cards */}
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6} md={3}>
            <Card 
              sx={{ 
                height: '100%',
                bgcolor: 'primary.50',
                border: 'none',
                boxShadow: 1,
                position: 'relative',
                overflow: 'hidden',
                '&:hover': {
                  transform: 'translateY(-2px)',
                  boxShadow: 3,
                  transition: 'all 0.2s ease-in-out',
                },
                transition: 'all 0.2s ease-in-out',
              }}
            >
              <Box
                sx={{
                  position: 'absolute',
                  top: -20,
                  right: -20,
                  width: 100,
                  height: 100,
                  borderRadius: '50%',
                  bgcolor: 'primary.100',
                  opacity: 0.3,
                }}
              />
              <CardContent sx={{ position: 'relative', zIndex: 1, p: 3 }}>
                <Box display="flex" justifyContent="space-between" alignItems="flex-start">
                  <Box flex={1}>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1, fontWeight: 500, fontSize: '0.875rem' }}>
                      Total Payouts
                    </Typography>
                    <Typography variant="h4" fontWeight={700} color="text.primary" sx={{ mb: 0.5 }}>
                      {formatCurrency(summary.totalAmount)}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.813rem' }}>
                      {summary.totalCount.toLocaleString()} transactions
                    </Typography>
                  </Box>
                  <Box
                    sx={{
                      p: 1.5,
                      borderRadius: 2,
                      bgcolor: 'primary.100',
                      color: 'primary.main',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      ml: 2,
                    }}
                  >
                    <MoneyIcon sx={{ fontSize: 28 }} />
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card 
              sx={{ 
                height: '100%',
                bgcolor: 'info.50',
                border: 'none',
                boxShadow: 1,
                position: 'relative',
                overflow: 'hidden',
                '&:hover': {
                  transform: 'translateY(-2px)',
                  boxShadow: 3,
                  transition: 'all 0.2s ease-in-out',
                },
                transition: 'all 0.2s ease-in-out',
              }}
            >
              <Box
                sx={{
                  position: 'absolute',
                  top: -20,
                  right: -20,
                  width: 100,
                  height: 100,
                  borderRadius: '50%',
                  bgcolor: 'info.100',
                  opacity: 0.3,
                }}
              />
              <CardContent sx={{ position: 'relative', zIndex: 1, p: 3 }}>
                <Box display="flex" justifyContent="space-between" alignItems="flex-start">
                  <Box flex={1}>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1, fontWeight: 500, fontSize: '0.875rem' }}>
                      Project Payouts
                    </Typography>
                    <Typography variant="h4" fontWeight={700} color="text.primary" sx={{ mb: 0.5 }}>
                      {formatCurrency(summary.projectAmount)}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.813rem' }}>
                      Project payouts
                    </Typography>
                  </Box>
                  <Box
                    sx={{
                      p: 1.5,
                      borderRadius: 2,
                      bgcolor: 'info.100',
                      color: 'info.main',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      ml: 2,
                    }}
                  >
                    <WorkIcon sx={{ fontSize: 28 }} />
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card 
              sx={{ 
                height: '100%',
                bgcolor: 'success.50',
                border: 'none',
                boxShadow: 1,
                position: 'relative',
                overflow: 'hidden',
                '&:hover': {
                  transform: 'translateY(-2px)',
                  boxShadow: 3,
                  transition: 'all 0.2s ease-in-out',
                },
                transition: 'all 0.2s ease-in-out',
              }}
            >
              <Box
                sx={{
                  position: 'absolute',
                  top: -20,
                  right: -20,
                  width: 100,
                  height: 100,
                  borderRadius: '50%',
                  bgcolor: 'success.100',
                  opacity: 0.3,
                }}
              />
              <CardContent sx={{ position: 'relative', zIndex: 1, p: 3 }}>
                <Box display="flex" justifyContent="space-between" alignItems="flex-start">
                  <Box flex={1}>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1, fontWeight: 500, fontSize: '0.875rem' }}>
                      Hourly Payouts
                    </Typography>
                    <Typography variant="h4" fontWeight={700} color="text.primary" sx={{ mb: 0.5 }}>
                      {formatCurrency(summary.hourlyAmount)}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.813rem' }}>
                      {summary.totalHoursWorked > 0 ? `${summary.totalHoursWorked.toFixed(2)} hours` : 'Hourly payouts'}
                    </Typography>
                  </Box>
                  <Box
                    sx={{
                      p: 1.5,
                      borderRadius: 2,
                      bgcolor: 'success.100',
                      color: 'success.main',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      ml: 2,
                    }}
                  >
                    <TimeIcon sx={{ fontSize: 28 }} />
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card 
              sx={{ 
                height: '100%',
                bgcolor: 'warning.50',
                border: 'none',
                boxShadow: 1,
                position: 'relative',
                overflow: 'hidden',
                '&:hover': {
                  transform: 'translateY(-2px)',
                  boxShadow: 3,
                  transition: 'all 0.2s ease-in-out',
                },
                transition: 'all 0.2s ease-in-out',
              }}
            >
              <Box
                sx={{
                  position: 'absolute',
                  top: -20,
                  right: -20,
                  width: 100,
                  height: 100,
                  borderRadius: '50%',
                  bgcolor: 'warning.100',
                  opacity: 0.3,
                }}
              />
              <CardContent sx={{ position: 'relative', zIndex: 1, p: 3 }}>
                <Box display="flex" justifyContent="space-between" alignItems="flex-start">
                  <Box flex={1}>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1, fontWeight: 500, fontSize: '0.875rem' }}>
                      Average Payout
                    </Typography>
                    <Typography variant="h4" fontWeight={700} color="text.primary" sx={{ mb: 0.5 }}>
                      {formatCurrency(summary.averagePayout)}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.813rem' }}>
                      per transaction
                    </Typography>
                  </Box>
                  <Box
                    sx={{
                      p: 1.5,
                      borderRadius: 2,
                      bgcolor: 'warning.100',
                      color: 'warning.main',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      ml: 2,
                    }}
                  >
                    <TrendingUpIcon sx={{ fontSize: 28 }} />
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Box>

      {/* Notification */}
      {notification.open && (
        <Alert 
          severity={notification.type} 
          sx={{ mb: 2 }} 
          onClose={() => setNotification({ open: false, type: '', message: '' })}
        >
          {notification.message}
        </Alert>
      )}

      {/* Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
            <Box display="flex" alignItems="center" gap={1}>
              <FilterIcon />
              <Typography variant="h6" fontWeight={600}>
                Filters
              </Typography>
            </Box>
            <Button
              variant="text"
              size="small"
              startIcon={<ClearIcon />}
              onClick={handleClearFilters}
              disabled={
                !filters.employee &&
                !filters.type &&
                !filters.project_title &&
                !filters.start_date &&
                !filters.end_date
              }
            >
              Clear All
            </Button>
          </Box>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth size="small">
                <Select
                  displayEmpty
                  value={filters.employee}
                  onChange={(e) => handleFilterChange('employee', e.target.value)}
                  disabled={loadingEmployees}
                >
                  <MenuItem value="">All Employees</MenuItem>
                  {employees.map((emp) => (
                    <MenuItem key={emp.user_id} value={emp.user_id}>
                      {emp.full_name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6} md={2.4}>
              <FormControl fullWidth size="small">
                <Select
                  displayEmpty
                  value={filters.type}
                  onChange={(e) => handleFilterChange('type', e.target.value)}
                >
                  <MenuItem value="">All Types</MenuItem>
                  <MenuItem value="project">Project</MenuItem>
                  <MenuItem value="hourly">Hourly</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6} md={2.4}>
              <TextField
                fullWidth
                size="small"
                label="Project Title"
                value={filters.project_title}
                onChange={(e) => handleFilterChange('project_title', e.target.value)}
                placeholder="Search projects..."
              />
            </Grid>
            <Grid item xs={12} sm={6} md={2.4}>
              <TextField
                fullWidth
                size="small"
                label="Start Date"
                type="date"
                value={filters.start_date}
                onChange={(e) => handleFilterChange('start_date', e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={2.4}>
              <TextField
                fullWidth
                size="small"
                label="End Date"
                type="date"
                value={filters.end_date}
                onChange={(e) => handleFilterChange('end_date', e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent sx={{ p: 0 }}>
          <TableContainer>
            <Table sx={{ minWidth: 1200 }}>
              <TableHead>
                <TableRow sx={{ backgroundColor: 'action.hover' }}>
                  <TableCell sx={{ fontWeight: 600 }}>Employee</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Type</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Project/Description</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 600 }}>Amount</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 600 }}>Rate</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 600 }}>Project Value</TableCell>
                  {showTimeColumns && (
                    <>
                      <TableCell sx={{ fontWeight: 600 }}>Clock In</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Clock Out</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600 }}>Total Hours</TableCell>
                    </>
                  )}
                  <TableCell sx={{ fontWeight: 600 }}>Date</TableCell>
                  {canEditDelete && (
                    <TableCell align="center" sx={{ fontWeight: 600 }}>Actions</TableCell>
                  )}
                </TableRow>
              </TableHead>
              <TableBody>
                {isLoading || isFetching ? (
                  <>
                    {Array.from({ length: 8 }).map((_, i) => (
                      <TableRow key={i}>
                        {Array.from({ length: showTimeColumns ? (canEditDelete ? 11 : 10) : (canEditDelete ? 8 : 7) }).map((_, j) => (
                          <TableCell key={j}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Box
                                sx={{
                                  width: '100%',
                                  height: 20,
                                  bgcolor: 'action.hover',
                                  borderRadius: 1,
                                  animation: 'pulse 1.5s ease-in-out infinite',
                                  '@keyframes pulse': {
                                    '0%, 100%': { opacity: 1 },
                                    '50%': { opacity: 0.5 },
                                  },
                                }}
                              />
                            </Box>
                    </TableCell>
                        ))}
                  </TableRow>
                    ))}
                  </>
                ) : payouts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={showTimeColumns ? (canEditDelete ? 11 : 10) : (canEditDelete ? 8 : 7)} align="center" sx={{ py: 8 }}>
                      <Typography variant="body1" color="text.secondary">
                        No payouts found
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                        {Object.values(filters).some(v => v) 
                          ? 'Try adjusting your filters'
                          : 'No payout records available'}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  payouts.map((payout) => (
                    <TableRow key={payout.id} hover>
                      <TableCell>
                        <Typography variant="body2" fontWeight={500}>
                          {payout.employee_name || 'Unknown'}
                        </Typography>
                        {payout.employee_email && (
                          <Typography variant="caption" color="text.secondary" display="block">
                            {payout.employee_email}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={payout.payout_type === 'bonus_first_time' ? 'Fist time bonus' : payout.payout_type === 'bonus_quoted_by' ? 'Quoted by bonus' : payout.payout_type || 'project'}
                          size="small"
                          color={payout.payout_type === 'hourly' ? 'primary' : 'default'}
                          sx={{ textTransform: 'capitalize' }}
                        />
                      </TableCell>
                      <TableCell>
                        <Tooltip title={payout.project_title || 'N/A'}>
                          <Typography 
                            variant="body2" 
                            sx={{ 
                              maxWidth: 250, 
                              overflow: 'hidden', 
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap'
                            }}
                          >
                            {payout.project_title || 'N/A'}
                          </Typography>
                        </Tooltip>
                        {payout.notes && (
                          <Typography variant="caption" color="text.secondary" display="block">
                            {payout.notes}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" fontWeight={600}>
                          {formatCurrency(payout.amount)}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        {payout.rate_percentage ? (
                          <Typography variant="body2">
                            {parseFloat(payout.rate_percentage).toFixed(2)}
                            {payout.payout_type === 'hourly' ? '/hr' : '%'}
                          </Typography>
                        ) : (
                          <Typography variant="body2" color="text.secondary">—</Typography>
                        )}
                      </TableCell>
                      <TableCell align="right">
                        {payout.project_value ? (
                          <Typography variant="body2">
                            {formatCurrency(payout.project_value)}
                          </Typography>
                        ) : (
                          <Typography variant="body2" color="text.secondary">—</Typography>
                        )}
                      </TableCell>
                      {showTimeColumns && (
                        <>
                          <TableCell>
                            {payout.payout_type === 'hourly' && payout.time_entry_details ? (
                              <Typography variant="body2">
                                {formatTime(payout.time_entry_details.check_in_time)}
                              </Typography>
                            ) : (
                              <Typography variant="body2" color="text.secondary">—</Typography>
                            )}
                          </TableCell>
                          <TableCell>
                            {payout.payout_type === 'hourly' && payout.time_entry_details ? (
                              <Typography variant="body2">
                                {payout.time_entry_details.check_out_time 
                                  ? formatTime(payout.time_entry_details.check_out_time)
                                  : '—'}
                              </Typography>
                            ) : (
                              <Typography variant="body2" color="text.secondary">—</Typography>
                            )}
                          </TableCell>
                          <TableCell align="right">
                            {payout.payout_type === 'hourly' && payout.time_entry_details ? (
                              <Typography variant="body2" fontWeight={500}>
                                {payout.time_entry_details.total_hours 
                                  ? `${parseFloat(payout.time_entry_details.total_hours).toFixed(2)}h`
                                  : '—'}
                              </Typography>
                            ) : (
                              <Typography variant="body2" color="text.secondary">—</Typography>
                            )}
                          </TableCell>
                        </>
                      )}
                      <TableCell>
                        <Typography variant="body2">
                          {formatDate(payout.created_at)}
                        </Typography>
                      </TableCell>
                      {canEditDelete && (
                        <TableCell align="center">
                          <Tooltip title="Edit payout">
                            <IconButton
                              size="small"
                              onClick={() => handleEdit(payout)}
                              color="primary"
                            >
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Delete payout">
                            <IconButton
                              size="small"
                              onClick={() => handleDeleteConfirm(payout)}
                              color="error"
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      )}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>

          {!isLoading && !isFetching && payouts.length > 0 && (
            <>
              <Divider />
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  p: 2,
                  flexWrap: 'wrap',
                  gap: 2,
                }}
              > 
                <Pagination
                  count={totalPages}
                  page={page}
                  onChange={handlePageChange}
                  color="primary"
                  shape="rounded"
                  showFirstButton
                  showLastButton
                />
              </Box>
            </>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog 
        open={editDialogOpen} 
        onClose={() => !updating && setEditDialogOpen(false)} 
        maxWidth="sm" 
        fullWidth
      >
        <DialogTitle>
          <Typography variant="h6" fontWeight={600}>
            Edit Payout
          </Typography>
        </DialogTitle>
        <Divider />
        <DialogContent sx={{ pt: 3 }}>
          {selectedPayout && (
            <Alert severity="info" sx={{ mb: 3 }}>
              Editing payout for <strong>{selectedPayout.employee_name}</strong>
              {selectedPayout.project_title && (
                <Typography variant="caption" display="block" sx={{ mt: 0.5 }}>
                  Project: {selectedPayout.project_title}
                </Typography>
              )}
            </Alert>
          )}
          {selectedPayout?.payout_type === 'hourly' && selectedPayout?.time_entry_details && (
            <Alert severity="info" sx={{ mb: 3 }}>
              <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                Time Entry Details
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={4}>
                  <TextField
                    fullWidth
                    label="Clock In"
                    type="datetime-local"
                    value={editFormData.check_in_time}
                    onChange={(e) => {
                      setEditFormData({ ...editFormData, check_in_time: e.target.value });
                    }}
                    error={!!formErrors.check_in_time}
                    helperText={formErrors.check_in_time}
                    InputLabelProps={{ shrink: true }}
                    size="small"
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField
                    fullWidth
                    label="Clock Out"
                    type="datetime-local"
                    value={editFormData.check_out_time}
                    onChange={(e) => {
                      setEditFormData({ ...editFormData, check_out_time: e.target.value });
                    }}
                    error={!!formErrors.check_out_time}
                    helperText={formErrors.check_out_time}
                    InputLabelProps={{ shrink: true }}
                    size="small"
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField
                    fullWidth
                    label="Total Hours"
                    type="number"
                    value={editFormData.total_hours}
                    onChange={(e) => {
                      setEditFormData({ ...editFormData, total_hours: e.target.value });
                    }}
                    error={!!formErrors.total_hours}
                    helperText={formErrors.total_hours || 'Automatically calculated from clock in/out times'}
                    InputProps={{
                      readOnly: true,
                      endAdornment: <Typography>h</Typography>,
                    }}
                    inputProps={{ min: 0, step: 0.01 }}
                    size="small"
                  />
                </Grid>
              </Grid>
            </Alert>
          )}
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Amount"
                type="number"
                value={editFormData.amount}
                onChange={(e) => {
                  lastChangedFieldRef.current = 'amount';
                  setEditFormData({ ...editFormData, amount: e.target.value });
                }}
                error={!!formErrors.amount}
                helperText={formErrors.amount}
                InputProps={{
                  startAdornment: <Typography sx={{ mr: 1 }}>{currencySymbol}</Typography>,
                }}
                inputProps={{ min: 0, step: 0.01 }}
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Rate Percentage"
                type="number"
                value={editFormData.rate_percentage}
                onChange={(e) => {
                  lastChangedFieldRef.current = 'rate';
                  setEditFormData({ ...editFormData, rate_percentage: e.target.value });
                }}
                error={!!formErrors.rate_percentage}
                helperText={formErrors.rate_percentage || 'Optional: 0-100'}
                InputProps={{
                  endAdornment: <Typography>%</Typography>,
                }}
                inputProps={{ min: 0, max: 100, step: 0.01 }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Project Value"
                type="number"
                value={editFormData.project_value}
                onChange={(e) => {
                  lastChangedFieldRef.current = 'project_value';
                  setEditFormData({ ...editFormData, project_value: e.target.value });
                }}
                error={!!formErrors.project_value}
                helperText={formErrors.project_value || 'Optional'}
                InputProps={{
                  startAdornment: <Typography sx={{ mr: 1 }}>{currencySymbol}</Typography>,
                }}
                inputProps={{ min: 0, step: 0.01 }}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Notes"
                multiline
                rows={3}
                value={editFormData.notes}
                onChange={(e) => setEditFormData({ ...editFormData, notes: e.target.value })}
                placeholder="Add any additional notes..."
              />
            </Grid>
          </Grid>
        </DialogContent>
        <Divider />
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setEditDialogOpen(false)} disabled={updating}>
            Cancel
          </Button>
          <Button
            onClick={handleSaveEdit}
            variant="contained"
            disabled={updating}
            startIcon={updating && <CircularProgress size={16} />}
          >
            {updating ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog 
        open={deleteDialogOpen} 
        onClose={() => !deleting && setDeleteDialogOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>
          <Typography variant="h6" fontWeight={600}>
            Confirm Deletion
          </Typography>
        </DialogTitle>
        <Divider />
        <DialogContent sx={{ pt: 3 }}>
          <Alert severity="warning" sx={{ mb: 2 }}>
            This action cannot be undone
          </Alert>
          {selectedPayout && (
            <Box>
              <Typography variant="body2" gutterBottom>
                Are you sure you want to delete this payout?
              </Typography>
              <Box sx={{ mt: 2, p: 2, bgcolor: 'action.hover', borderRadius: 1 }}>
                <Typography variant="body2" color="text.secondary">
                  <strong>Employee:</strong> {selectedPayout.employee_name}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  <strong>Amount:</strong> {formatCurrency(selectedPayout.amount)}
                </Typography>
                {selectedPayout.project_title && (
                  <Typography variant="body2" color="text.secondary">
                    <strong>Project:</strong> {selectedPayout.project_title}
                  </Typography>
                )}
              </Box>
            </Box>
          )}
        </DialogContent>
        <Divider />
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setDeleteDialogOpen(false)} disabled={deleting}>
            Cancel
          </Button>
          <Button
            onClick={handleDelete}
            color="error"
            variant="contained"
            disabled={deleting}
            startIcon={deleting && <CircularProgress size={16} />}
          >
            {deleting ? 'Deleting...' : 'Delete Payout'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default PayrollReports;