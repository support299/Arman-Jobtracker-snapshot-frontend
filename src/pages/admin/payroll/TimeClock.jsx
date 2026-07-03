import React, { useState, useEffect } from 'react';
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
  Grid,
  Chip,
  CircularProgress,
  Avatar,
  Divider,
  Stack,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  alpha,
} from '@mui/material';
import {
  AccessTime as AccessTimeIcon,
  CalendarToday as CalendarIcon,
  CheckCircle as CheckCircleIcon,
  Logout as LogoutIcon,
  Schedule as ScheduleIcon,
  Person as PersonIcon,
  PlayCircle as PlayCircleIcon,
  StopCircle as StopCircleIcon,
} from '@mui/icons-material';
import {
  useGetTodayTimeEntriesQuery,
  useGetActiveSessionQuery,
  useCheckInMutation,
  useCheckOutMutation,
  useGetEmployeesQuery,
} from '../../../store/api/payrollApi';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
  canAccessPayrollTimeClock,
  canAccessPayrollAdminSections,
} from '../../../utils/payrollAccess';

const TimeClock = () => {
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [notes, setNotes] = useState('');
  
  const user = useSelector((state) => state.auth.user);
  const user_profile = useSelector((state) => state.auth.user_profile);
  const normalizedRole = String(user?.role ?? 'worker').toLowerCase();
  const { data: employeesData } = useGetEmployeesQuery({ pay_scale_type: 'hourly', is_active: true });
  const { data: todayEntries, refetch: refetchToday } = useGetTodayTimeEntriesQuery();
  const { data: activeSession, refetch: refetchActive } = useGetActiveSessionQuery();
  
  const [checkIn, { isLoading: checkingIn }] = useCheckInMutation();
  const [checkOut, { isLoading: checkingOut }] = useCheckOutMutation();

  const employees = employeesData?.results || [];
  const activeEntries = todayEntries?.entries?.filter((entry) => entry.status === 'checked_in') || [];
  const completedEntries = todayEntries?.entries?.filter((entry) => entry.status === 'checked_out') || [];

  // Admin/supervisor: manage any employee. Manager/worker: own clock-in only (worker UI).
  const canManageOthersTimeClock = canAccessPayrollAdminSections(user?.role, user);

  const navigate = useNavigate();

  useEffect(() => {
    const needsPayScaleType = normalizedRole === 'worker' || normalizedRole === 'manager';
    if (needsPayScaleType && !user_profile) {
      return;
    }

    if (!canAccessPayrollTimeClock(user?.role, user_profile, user)) {
      navigate('/admin/payroll/reports', { replace: true });
    }
  }, [navigate, normalizedRole, user, user_profile]);
  
  // Calculate elapsed hours for an entry if not provided
  const calculateElapsedHours = (entry) => {
    if (!entry || !entry.check_in_time) return 0;
    if (entry.elapsed_hours) return entry.elapsed_hours;
    const checkInTime = new Date(entry.check_in_time);
    const now = new Date();
    const diffMs = now - checkInTime;
    return diffMs / (1000 * 60 * 60); // Convert to hours
  };
  
  // Get all active sessions - use active_sessions from API if available, otherwise use activeEntries
  // The API response structure: { active_sessions: [{active: true, entry: {...}, elapsed_hours: 6.42}, ...], count: 7 }
  let allActiveSessions = [];
  if (activeSession?.active_sessions && Array.isArray(activeSession.active_sessions)) {
    // API returned active_sessions array - each session already has {active: true, entry: {...}, elapsed_hours: ...}
    allActiveSessions = activeSession.active_sessions.map(session => {
      // Use the entry from the session, or fallback to session itself if entry doesn't exist
      const entry = session.entry || session;
      return {
        active: session.active !== undefined ? session.active : true,
        entry: entry,
        elapsed_hours: session.elapsed_hours !== undefined 
          ? session.elapsed_hours 
          : calculateElapsedHours(entry)
      };
    });
  } else if (activeEntries.length > 0) {
    // Fallback to using activeEntries from today's entries
    allActiveSessions = activeEntries.map(entry => ({
      active: true,
      entry: entry,
      elapsed_hours: calculateElapsedHours(entry)
    }));
  } else if (activeSession?.active && activeSession.entry) {
    // Single active session format (for regular workers)
    allActiveSessions = [{
      active: true,
      entry: activeSession.entry,
      elapsed_hours: activeSession.elapsed_hours || calculateElapsedHours(activeSession.entry)
    }];
  }
  
  // For admins/managers, find the selected employee's active session from today's entries
  const selectedEmployeeActiveEntry = canManageOthersTimeClock && selectedEmployee
    ? activeEntries.find((entry) => entry.employee === selectedEmployee || entry.employee_id === selectedEmployee)
    : null;
  
  // Workers and managers: only their own active session. Admin/supervisor: all active sessions.
  const displayActiveSessions = canManageOthersTimeClock
    ? allActiveSessions
    : (activeSession?.active 
        ? [{
            active: true,
            entry: activeSession.entry || activeSession,
            elapsed_hours: calculateElapsedHours(activeSession.entry || activeSession)
          }]
        : []);
  
  // Legacy single session for backward compatibility (used in some places)
  const displayActiveSession = displayActiveSessions.length > 0 ? displayActiveSessions[0] : null;

  const entryMatchesSelectedEmployee = (entry) => {
    if (!entry || !selectedEmployee) return false;
    const selected = String(selectedEmployee);
    const entryIds = [entry.employee, entry.employee_id]
      .filter((v) => v != null && v !== '')
      .map(String);
    if (entryIds.includes(selected)) return true;

    const payrollRow = employees.find(
      (emp) =>
        String(emp.user_id) === selected ||
        String(emp.id) === selected ||
        emp.user_id === user?.id ||
        emp.user_id === user?.user_id
    );
    if (!payrollRow) return false;

    const payrollIds = [payrollRow.user_id, payrollRow.id]
      .filter((v) => v != null && v !== '')
      .map(String);
    return entryIds.some((id) => payrollIds.includes(id));
  };

  const isSelectedEmployeeCheckedIn = Boolean(
    displayActiveSession?.active &&
      displayActiveSession?.entry &&
      (canManageOthersTimeClock
        ? entryMatchesSelectedEmployee(displayActiveSession.entry)
        : true)
  );

  // Auto-select employee based on role
  useEffect(() => {
    if (user && !selectedEmployee) {
      if (canManageOthersTimeClock) {
        return;
      } else {
        // For workers/managers, find their employee record and use the user_id
        // Try to match by user.id or user.user_id
        let employeeIdToUse = null;
        
        if (employees.length > 0) {
          const currentUserEmployee = employees.find(
            (emp) => 
              emp.user_id === user.id || 
              emp.user_id === user.user_id || 
              emp.id === user.id ||
              String(emp.user_id) === String(user.id) ||
              String(emp.user_id) === String(user.user_id)
          );
          
          if (currentUserEmployee) {
            const activeEntry = activeSession?.entry || activeSession;
            const activeEmployeeId = activeEntry?.employee ?? activeEntry?.employee_id;
            const payrollIds = [currentUserEmployee.user_id, currentUserEmployee.id]
              .filter((v) => v != null && v !== '')
              .map(String);
            if (
              activeEmployeeId != null &&
              payrollIds.includes(String(activeEmployeeId))
            ) {
              employeeIdToUse = activeEmployeeId;
            } else {
              employeeIdToUse = currentUserEmployee.user_id || currentUserEmployee.id;
            }
          }
        }
        
        // Fallback options if employee record not found
        if (!employeeIdToUse) {
          if (user.user_id) {
            employeeIdToUse = user.user_id;
          } else if (user.id) {
            employeeIdToUse = user.id;
          }
        }
        
        if (employeeIdToUse) {
          setSelectedEmployee(String(employeeIdToUse));
        }
      }
    }
  }, [user, employees, canManageOthersTimeClock, selectedEmployee, activeSession]);
  
  // Poll for active session updates
  useEffect(() => {
    const interval = setInterval(() => {
      refetchActive();
      refetchToday();
    }, 30000);
    
    return () => clearInterval(interval);
  }, [refetchActive, refetchToday]);

  const handleCheckIn = async () => {
    if (!selectedEmployee) return;
    
    try {
      await checkIn({ 
        employee_id: selectedEmployee,
        notes 
      }).unwrap();
      setNotes('');
      refetchActive();
      refetchToday();
    } catch (err) {
      // Error handled by toast notification
    }
  };

  const handleCheckOut = async (entryId) => {
    try {
      await checkOut({ id: entryId }).unwrap();
      refetchActive();
      refetchToday();
    } catch (err) {
      // Error handled by toast notification
    }
  };

  const formatTime = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatElapsedTime = (hours) => {
    if (!hours) return '0h 00m';
    const h = Math.floor(hours);
    const m = Math.floor((hours - h) * 60);
    return `${h}h ${m.toString().padStart(2, '0')}m`;
  };

  const getCurrentDate = () => {
    const date = new Date();
    return date.toLocaleDateString('en-US', { 
      weekday: 'long',
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  const getInitials = (name) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const totalHours = completedEntries.reduce((sum, entry) => 
    sum + (parseFloat(entry.total_hours) || 0), 0
  );

  return (
    <Box sx={{ 
      p: { xs: 2, sm: 3, md: 4 }, 
      backgroundColor: '#f8fafc',
      minHeight: '100vh',
      width: '100%',
      maxWidth: '100%',
      boxSizing: 'border-box',
      display: 'flex',
      flexDirection: 'column',
      gap: 3
    }}>
      {/* Header */}
      <Box >
        <Typography 
          variant="h4" 
          fontWeight={700} 
          color="#0f172a"
          sx={{ fontSize: { xs: '1.75rem', sm: '2rem', md: '2.25rem' }, mb: 0.5 }}
        >
          Time Clock
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ fontSize: '0.9375rem' }}>
          {getCurrentDate()}
        </Typography>
      </Box>

      {/* Summary Cards Row - Professional Design */}
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <Grid item xs={6} sm={3} md={3}>
          <Card 
            elevation={0}
            sx={{ 
              borderRadius: 2,
              border: '1px solid',
              borderColor: 'divider',
              bgcolor: 'white',
              height: '100%',
              transition: 'all 0.2s ease',
              '&:hover': {
                borderColor: '#3b82f6',
                boxShadow: '0 4px 12px rgba(59,130,246,0.1)'
              },
            }}
          >
            <CardContent sx={{ p: 2.5 }}>
              <Box display="flex" alignItems="center" gap={2}>
                <Box 
                  sx={{ 
                    width: 48, 
                    height: 48, 
                    borderRadius: 2, 
                    bgcolor: alpha('#3b82f6', 0.1),
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}
                >
                  <AccessTimeIcon sx={{ fontSize: 24, color: '#3b82f6' }} />
                </Box>
                <Box flex={1} display="flex" flexDirection="row" alignItems="center" gap={1} minWidth={0}>
                  <Typography 
                    variant="h4" 
                    fontWeight={700} 
                    color="#0f172a"
                    sx={{ fontSize: '1.75rem', lineHeight: 1.2, mb: 0.25 }}
                  >
                    {activeEntries.length}
                  </Typography>
                  <Typography 
                    variant="body2" 
                    color="text.secondary"
                    fontWeight={500}
                    sx={{ fontSize: '0.8125rem' }}
                  >
                    Active Now
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={6} sm={3} md={3}>
          <Card 
            elevation={0}
            sx={{ 
              borderRadius: 2,
              border: '1px solid',
              borderColor: 'divider',
              bgcolor: 'white',
              height: '100%',
              transition: 'all 0.2s ease',
              '&:hover': {
                borderColor: '#8b5cf6',
                boxShadow: '0 4px 12px rgba(139,92,246,0.1)'
              }
            }}
          >
            <CardContent sx={{ p: 2.5 }}>
              <Box display="flex" alignItems="center" gap={2}>
                <Box 
                  sx={{ 
                    width: 48, 
                    height: 48, 
                    borderRadius: 2, 
                    bgcolor: alpha('#8b5cf6', 0.1),
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}
                >
                  <CalendarIcon sx={{ fontSize: 24, color: '#8b5cf6' }} />
                </Box>
                <Box flex={1} display="flex" flexDirection="row" alignItems="center" gap={1} minWidth={0}>
                  <Typography 
                    variant="h4" 
                    fontWeight={700} 
                    color="#0f172a"
                    sx={{ fontSize: '1.75rem', lineHeight: 1.2, mb: 0.25 }}
                  >
                    {todayEntries?.entries?.length || 0}
                  </Typography>
                  <Typography 
                    variant="body2" 
                    color="text.secondary"
                    fontWeight={500}
                    sx={{ fontSize: '0.8125rem' }}
                  >
                    Total Entries
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={6} sm={3} md={3}>
          <Card 
            elevation={0}
            sx={{ 
              borderRadius: 2,
              border: '1px solid',
              borderColor: 'divider',
              bgcolor: 'white',
              height: '100%',
              transition: 'all 0.2s ease',
              '&:hover': {
                borderColor: '#10b981',
                boxShadow: '0 4px 12px rgba(16,185,129,0.1)'
              }
            }}
          >
            <CardContent sx={{ p: 2.5 }}>
              <Box display="flex" alignItems="center" gap={2}>
                <Box 
                  sx={{ 
                    width: 48, 
                    height: 48, 
                    borderRadius: 2, 
                    bgcolor: alpha('#10b981', 0.1),
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}
                >
                  <CheckCircleIcon sx={{ fontSize: 24, color: '#10b981' }} />
                </Box>
                <Box flex={1} display="flex" flexDirection="row" alignItems="center" gap={1} minWidth={0}>
                  <Typography 
                    variant="h4" 
                    fontWeight={700} 
                    color="#0f172a"
                    sx={{ fontSize: '1.75rem', lineHeight: 1.2, mb: 0.25 }}
                  >
                    {completedEntries.length}
                  </Typography>
                  <Typography 
                    variant="body2" 
                    color="text.secondary"
                    fontWeight={500}
                    sx={{ fontSize: '0.8125rem' }}
                  >
                    Completed
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={6} sm={3} md={3}>
          <Card 
            elevation={0}
            sx={{ 
              borderRadius: 2,
              border: '1px solid',
              borderColor: 'divider',
              bgcolor: 'white',
              height: '100%',
              transition: 'all 0.2s ease',
              '&:hover': {
                borderColor: '#f59e0b',
                boxShadow: '0 4px 12px rgba(245,158,11,0.1)'
              }
            }}
          >
            <CardContent sx={{ p: 2.5 }}>
              <Box display="flex" alignItems="center" gap={2}>
                <Box 
                  sx={{ 
                    width: 48, 
                    height: 48, 
                    borderRadius: 2, 
                    bgcolor: alpha('#f59e0b', 0.1),
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}
                >
                  <ScheduleIcon sx={{ fontSize: 24, color: '#f59e0b' }} />
                </Box>
                <Box flex={1} display="flex" flexDirection="row" alignItems="center" gap={1} minWidth={0}>
                  <Typography 
                    variant="h4" 
                    fontWeight={700} 
                    color="#0f172a"
                    sx={{ fontSize: '1.75rem', lineHeight: 1.2, mb: 0.25 }}
                  >
                    {totalHours.toFixed(1)}
                  </Typography>
                  <Typography 
                    variant="body2" 
                    color="text.secondary"
                    fontWeight={500}
                    sx={{ fontSize: '0.8125rem' }}
                  >
                    Total Hours
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </div>

      {/* Main Section - Clock In/Out and Active Session Row */}
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-6">
        {/* Action Card - Clock In/Out */}
        <Grid item xs={12} md={6} lg={displayActiveSessions.length > 0 ? 5 : 12}>
          <Card 
            elevation={0} 
            sx={{ 
              borderRadius: 3, 
              border: '1px solid',
              borderColor: 'divider',
              bgcolor: 'white',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
              height: '100%',
              width: '100%',
              maxWidth: '100%'
            }}
          >
            <CardContent sx={{ p: { xs: 3, sm: 3.5 } }}>
              <Typography 
                variant="h5" 
                fontWeight={700} 
                color="#0f172a"
                mb={3}
                sx={{ fontSize: { xs: '1.25rem', sm: '1.5rem' } }}
              >
                {canManageOthersTimeClock ? 'Employee Check-in' : 'Clock In / Out'}
              </Typography>
              
              <Stack spacing={3}>
                {canManageOthersTimeClock ? (
                  <FormControl fullWidth>
                    <InputLabel>Select Employee</InputLabel>
                    <Select
                      value={selectedEmployee}
                      onChange={(e) => setSelectedEmployee(e.target.value)}
                      label="Select Employee"
                      sx={{ borderRadius: 2 }}
                    >
                      {employees.map((emp) => (
                        <MenuItem key={emp.id} value={emp.user_id}>
                          <Box display="flex" alignItems="center" gap={1.5}>
                            <Avatar sx={{ width: 32, height: 32, fontSize: '0.875rem' }}>
                              {getInitials(emp.full_name)}
                            </Avatar>
                            {emp.full_name}
                          </Box>
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                ) : (
                  <Box 
                    sx={{ 
                      p: 2.5, 
                      borderRadius: 2, 
                      bgcolor: '#f8fafc',
                      border: '1px solid',
                      borderColor: 'divider'
                    }}
                  >
                    <Box display="flex" alignItems="center" gap={2}>
                      <Avatar sx={{ width: 48, height: 48, bgcolor: '#3b82f6', fontSize: '1rem' }}>
                        {getInitials(user_profile?.full_name)}
                      </Avatar>
                      <Box>
                        <Typography variant="caption" color="text.secondary" fontWeight={500}>
                          Employee
                        </Typography>
                        <Typography variant="body1" fontWeight={600} color="#0f172a">
                          {user_profile?.full_name || 'User'}
                        </Typography>
                      </Box>
                    </Box>
                  </Box>
                )}

                <TextField
                  fullWidth
                  multiline
                  rows={3}
                  label="Notes (Optional)"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add shift notes..."
                  sx={{ 
                    '& .MuiOutlinedInput-root': { 
                      borderRadius: 2,
                      bgcolor: '#f8fafc'
                    } 
                  }}
                />

                <Button
                  fullWidth
                  size="large"
                  variant="contained"
                  onClick={handleCheckIn}
                  disabled={!selectedEmployee || checkingIn || isSelectedEmployeeCheckedIn}
                  startIcon={checkingIn ? <CircularProgress size={22} color="inherit" /> : <PlayCircleIcon sx={{ fontSize: 24 }} />}
                  sx={{
                    bgcolor: '#3b82f6',
                    color: 'white',
                    textTransform: 'none',
                    fontWeight: 600,
                    py: 2,
                    borderRadius: 2,
                    fontSize: '1rem',
                    boxShadow: '0 4px 6px rgba(59, 130, 246, 0.3)',
                    '&:hover': { 
                      bgcolor: '#2563eb',
                      boxShadow: '0 6px 12px rgba(59, 130, 246, 0.4)',
                      transform: 'translateY(-1px)'
                    },
                    '&:disabled': { 
                      bgcolor: '#e2e8f0', 
                      color: '#94a3b8',
                      boxShadow: 'none'
                    },
                    transition: 'all 0.2s ease'
                  }}
                >
                  {checkingIn ? 'Checking In...' : 'Clock In'}
                </Button>

                {isSelectedEmployeeCheckedIn && (
                  <Box 
                    sx={{ 
                      p: 1.5, 
                      borderRadius: 2, 
                      bgcolor: alpha('#f59e0b', 0.1),
                      border: `1px solid ${alpha('#f59e0b', 0.3)}`
                    }}
                  >
                    <Typography variant="caption" color="#f59e0b" fontWeight={600} textAlign="center" display="block">
                      Already checked in
                    </Typography>
                  </Box>
                )}
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        {/* Active Sessions - Show all for managers/supervisors, single for workers */}
        {displayActiveSessions.length > 0 && (
          <Grid item xs={12} md={6} lg={7} sx={{ width: '100%' }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {canManageOthersTimeClock && displayActiveSessions.length > 1 && (
                <Typography variant="h6" fontWeight={600} color="#0f172a" sx={{ fontSize: { xs: '1rem', sm: '1.25rem' } }}>
                  Active Sessions ({displayActiveSessions.length})
                </Typography>
              )}
              <Box 
                sx={{ 
                  display: 'flex', 
                  flexDirection: 'column',
                  gap: 2
                }}
              >
                {displayActiveSessions.map((session, index) => {
                  const entry = session.entry || session;
                  return (
                    <Card 
                      key={entry.id || index}
                      elevation={0} 
                      sx={{ 
                        borderRadius: 3, 
                        border: '2px solid #3b82f6',
                        bgcolor: alpha('#3b82f6', 0.05),
                        boxShadow: '0 4px 12px rgba(59, 130, 246, 0.15)',
                        width: '100%',
                        height: '100%'
                      }}
                    >
                      <CardContent sx={{ p: { xs: 2.5, sm: 3 } }}>
                        <Box 
                          display="flex" 
                          justifyContent="space-between" 
                          alignItems={{ xs: 'flex-start', sm: 'center' }}
                          flexDirection={{ xs: 'column', sm: 'row' }}
                          gap={2.5}
                        >
                          <Box display="flex" alignItems="center" gap={2.5} flex={1} minWidth={0}>
                            <Box
                              sx={{
                                width: { xs: 48, sm: 56 },
                                height: { xs: 48, sm: 56 },
                                borderRadius: 2,
                                bgcolor: '#3b82f6',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0
                              }}
                            >
                              <AccessTimeIcon sx={{ fontSize: { xs: 24, sm: 28 }, color: 'white' }} />
                            </Box>
                            <Box flex={1} minWidth={0}>
                              <Box display="flex" alignItems="center" gap={1.5} mb={1.5} flexWrap="wrap">
                                <Typography variant="h6" fontWeight={700} color="#0f172a" sx={{ fontSize: { xs: '1rem', sm: '1.25rem' } }}>
                                  {canManageOthersTimeClock && displayActiveSessions.length > 1 ? 'Active Session' : 'Active Session'}
                                </Typography>
                                <Chip
                                  label="LIVE"
                                  size="small"
                                  sx={{ 
                                    bgcolor: '#10b981',
                                    color: 'white',
                                    fontWeight: 700,
                                    fontSize: '0.75rem',
                                    height: 24
                                  }}
                                />
                              </Box>
                              <Box display="flex" alignItems="center" gap={2} flexWrap="wrap">
                                <Avatar sx={{ width: 40, height: 40, bgcolor: '#3b82f6' }}>
                                  {getInitials(entry?.employee_name || '')}
                                </Avatar>
                                <Box minWidth={0}>
                                  <Typography variant="body1" fontWeight={600} color="#0f172a" noWrap>
                                    {entry?.employee_name || 'Unknown Employee'}
                                  </Typography>
                                  <Typography variant="body2" color="text.secondary">
                                    Started at {formatTime(entry?.check_in_time)}
                                  </Typography>
                                </Box>
                                {(session.elapsed_hours !== undefined && session.elapsed_hours !== null) && (
                                  <Box 
                                    sx={{ 
                                      px: 2.5, 
                                      py: 1.25, 
                                      borderRadius: 2, 
                                      bgcolor: 'white',
                                      border: '1px solid',
                                      borderColor: 'divider',
                                      flexShrink: 0
                                    }}
                                  >
                                    <Typography variant="h6" fontWeight={700} color="#3b82f6" sx={{ fontSize: { xs: '1rem', sm: '1.25rem' } }}>
                                      {formatElapsedTime(session.elapsed_hours)}
                                    </Typography>
                                  </Box>
                                )}
                              </Box>
                            </Box>
                          </Box>
                          <Button
                            variant="contained"
                            size="large"
                            fullWidth={{ xs: true, sm: false }}
                            startIcon={checkingOut ? <CircularProgress size={18} color="inherit" /> : <StopCircleIcon sx={{ fontSize: 20 }} />}
                            onClick={() => handleCheckOut(entry?.id)}
                            disabled={checkingOut}
                            sx={{
                              bgcolor: '#ef4444',
                              color: 'white',
                              textTransform: 'none',
                              fontWeight: 600,
                              borderRadius: 2,
                              px: 3,
                              py: 1.5,
                              boxShadow: '0 4px 6px rgba(239, 68, 68, 0.3)',
                              '&:hover': { 
                                bgcolor: '#dc2626',
                                boxShadow: '0 6px 12px rgba(239, 68, 68, 0.4)'
                              },
                              flexShrink: 0,
                              minWidth: { sm: 140 }
                            }}
                          >
                            {checkingOut ? 'Checking Out...' : 'Clock Out'}
                          </Button>
                        </Box>
                      </CardContent>
                    </Card>
                  );
                })}
              </Box>
            </Box>
          </Grid>
        )} 
      </div>

      {/* Today's Log - Full Width */}
      <Box sx={{ width: '100%', maxWidth: '100%' }}>
        {/* Today's Entries - Professional Table/List View */}
          <Card 
            elevation={0} 
            sx={{ 
              borderRadius: 3, 
              border: '1px solid',
              borderColor: 'divider',
              bgcolor: 'white',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
              width: '100%',
              maxWidth: '100%'
            }}
          >
            <CardContent sx={{ p: { xs: 0, sm: 0 } }}>
              <Box sx={{ p: { xs: 2.5, sm: 3 }, borderBottom: '1px solid', borderColor: 'divider' }}>
                <Typography variant="h5" fontWeight={700} color="#0f172a" sx={{ fontSize: { xs: '1.25rem', sm: '1.5rem' } }}>
                  Today's Log
                </Typography>
                <Typography variant="body2" color="text.secondary" mt={0.5}>
                  All time entries for today
                </Typography>
              </Box>
              
              {todayEntries?.entries && todayEntries?.entries?.length > 0 ? (
                <>
                  {/* Desktop Table View */}
                  <Box sx={{ display: { xs: 'none', md: 'block' }, width: '100%', maxWidth: '100%', overflowX: 'auto' }}>
                    <TableContainer sx={{ width: '100%', maxWidth: '100%' }}>
                      <Table sx={{ width: '100%', minWidth: 650 }}>
                        <TableHead>
                          <TableRow sx={{ bgcolor: '#f8fafc' }}>
                            <TableCell sx={{ fontWeight: 600, color: '#64748b', py: 2, fontSize: '0.875rem', minWidth: 200 }}>
                              Employee
                            </TableCell>
                            <TableCell sx={{ fontWeight: 600, color: '#64748b', py: 2, fontSize: '0.875rem', width: 120 }}>
                              Time In
                            </TableCell>
                            <TableCell sx={{ fontWeight: 600, color: '#64748b', py: 2, fontSize: '0.875rem', width: 120 }}>
                              Time Out
                            </TableCell>
                            <TableCell sx={{ fontWeight: 600, color: '#64748b', py: 2, fontSize: '0.875rem', width: 100 }}>
                              Duration
                            </TableCell>
                            <TableCell sx={{ fontWeight: 600, color: '#64748b', py: 2, fontSize: '0.875rem', width: 120 }}>
                              Status
                            </TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {todayEntries.entries.map((entry) => (
                            <TableRow 
                              key={entry.id}
                              sx={{ 
                                '&:hover': { bgcolor: '#f8fafc' },
                                borderLeft: entry.status === 'checked_in' ? '3px solid #3b82f6' : '3px solid transparent'
                              }}
                            >
                              <TableCell>
                                <Box display="flex" alignItems="center" gap={2}>
                                  <Avatar 
                                    sx={{ 
                                      width: 40, 
                                      height: 40,
                                      bgcolor: entry.status === 'checked_in' ? '#3b82f6' : '#64748b',
                                      fontSize: '0.875rem'
                                    }}
                                  >
                                    {getInitials(entry.employee_name)}
                                  </Avatar>
                                  <Box>
                                    <Typography variant="body1" fontWeight={600} color="#0f172a">
                                      {entry.employee_name}
                                    </Typography>
                                    {entry.notes && (
                                      <Typography 
                                        variant="caption" 
                                        color="text.secondary" 
                                        sx={{ 
                                          fontStyle: 'italic',
                                          display: 'block',
                                          mt: 0.25
                                        }}
                                      >
                                        "{entry.notes}"
                                      </Typography>
                                    )}
                                  </Box>
                                </Box>
                              </TableCell>
                              <TableCell>
                                <Typography variant="body2" fontWeight={500} color="#0f172a">
                                  {formatTime(entry.check_in_time)}
                                </Typography>
                              </TableCell>
                              <TableCell>
                                <Typography variant="body2" fontWeight={500} color={entry.check_out_time ? '#0f172a' : 'text.secondary'}>
                                  {entry.check_out_time ? formatTime(entry.check_out_time) : '—'}
                                </Typography>
                              </TableCell>
                              <TableCell>
                                {entry.total_hours ? (
                                  <Typography variant="body2" fontWeight={600} color="#3b82f6">
                                    {parseFloat(entry.total_hours).toFixed(2)}h
                                  </Typography>
                                ) : (
                                  <Typography variant="body2" color="text.secondary">
                                    — 
                                  </Typography>
                                )}
                              </TableCell>
                              <TableCell>
                                <Box display="flex" alignItems="center" gap={1.5}>
                                  <Chip
                                    label={entry.status === 'checked_in' ? 'Active' : 'Completed'}
                                    size="small"
                                    sx={{
                                      bgcolor: entry.status === 'checked_in' 
                                        ? alpha('#3b82f6', 0.1) 
                                        : alpha('#10b981', 0.1),
                                      color: entry.status === 'checked_in' 
                                        ? '#3b82f6' 
                                        : '#10b981',
                                      fontWeight: 600,
                                      fontSize: '0.75rem',
                                      height: 26,
                                      border: `1px solid ${entry.status === 'checked_in' ? alpha('#3b82f6', 0.2) : alpha('#10b981', 0.2)}`
                                    }}
                                  />
                                  {entry.status === 'checked_in' && canManageOthersTimeClock && (
                                    <Button
                                      variant="outlined"
                                      size="small"
                                      startIcon={<StopCircleIcon sx={{ fontSize: 16 }} />}
                                      onClick={() => handleCheckOut(entry.id)}
                                      disabled={checkingOut}
                                      sx={{
                                        borderColor: '#ef4444',
                                        color: '#ef4444',
                                        textTransform: 'none',
                                        fontSize: '0.75rem',
                                        py: 0.5,
                                        px: 1.5,
                                        minWidth: 'auto',
                                        '&:hover': {
                                          borderColor: '#dc2626',
                                          bgcolor: alpha('#ef4444', 0.1)
                                        }
                                      }}
                                    >
                                      Clock Out
                                    </Button>
                                  )}
                                </Box>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </Box>

                  {/* Mobile Card View */}
                  <Box sx={{ display: { xs: 'block', md: 'none' }, p: 2.5 }}>
                    <Stack spacing={2}>
                      {todayEntries.entries.map((entry) => (
                        <Paper
                          key={entry.id}
                          elevation={0}
                          sx={{
                            p: 2.5,
                            border: '1px solid',
                            borderColor: 'divider',
                            borderRadius: 2,
                            borderLeft: `4px solid ${entry.status === 'checked_in' ? '#3b82f6' : '#10b981'}`,
                            bgcolor: 'white'
                          }}
                        >
                          <Box display="flex" alignItems="flex-start" justifyContent="space-between" mb={2}>
                            <Box display="flex" alignItems="center" gap={2} flex={1}>
                              <Avatar 
                                sx={{ 
                                  width: 44, 
                                  height: 44,
                                  bgcolor: entry.status === 'checked_in' ? '#3b82f6' : '#64748b',
                                  fontSize: '0.875rem'
                                }}
                              >
                                {getInitials(entry.employee_name)}
                              </Avatar>
                              <Box flex={1}>
                                <Typography variant="body1" fontWeight={600} color="#0f172a" mb={0.5}>
                                  {entry.employee_name}
                                </Typography>
                                <Chip
                                  label={entry.status === 'checked_in' ? 'Active' : 'Completed'}
                                  size="small"
                                  sx={{
                                    bgcolor: entry.status === 'checked_in' 
                                      ? alpha('#3b82f6', 0.1) 
                                      : alpha('#10b981', 0.1),
                                    color: entry.status === 'checked_in' 
                                      ? '#3b82f6' 
                                      : '#10b981',
                                    fontWeight: 600,
                                    fontSize: '0.75rem',
                                    height: 24
                                  }}
                                />
                              </Box>
                            </Box>
                          </Box>
                          <Grid container spacing={2}>
                            <Grid item xs={6}>
                              <Typography variant="caption" color="text.secondary" fontWeight={500}>
                                Time In
                              </Typography>
                              <Typography variant="body2" fontWeight={600} color="#0f172a" mt={0.5}>
                                {formatTime(entry.check_in_time)}
                              </Typography>
                            </Grid>
                            <Grid item xs={6}>
                              <Typography variant="caption" color="text.secondary" fontWeight={500}>
                                Time Out
                              </Typography>
                              <Typography variant="body2" fontWeight={600} color={entry.check_out_time ? '#0f172a' : 'text.secondary'} mt={0.5}>
                                {entry.check_out_time ? formatTime(entry.check_out_time) : '—'}
                              </Typography>
                            </Grid>
                            <Grid item xs={6}>
                              <Typography variant="caption" color="text.secondary" fontWeight={500}>
                                Duration
                              </Typography>
                              <Typography variant="body2" fontWeight={600} color="#3b82f6" mt={0.5}>
                                {entry.total_hours ? `${parseFloat(entry.total_hours).toFixed(2)}h` : '—'}
                              </Typography>
                            </Grid>
                          </Grid>
                          {entry.notes && (
                            <Box 
                              sx={{ 
                                mt: 2, 
                                pt: 2, 
                                borderTop: '1px solid', 
                                borderColor: 'divider' 
                              }}
                            >
                              <Typography 
                                variant="caption" 
                                color="text.secondary" 
                                sx={{ 
                                  fontStyle: 'italic',
                                  display: 'block'
                                }}
                              >
                                "{entry.notes}"
                              </Typography>
                            </Box>
                          )}
                        </Paper>
                      ))}
                    </Stack>
                  </Box>
                </>
              ) : (
                <Box 
                  sx={{ 
                    py: 10, 
                    textAlign: 'center',
                    px: 3
                  }}
                >
                  <CalendarIcon sx={{ fontSize: 64, color: '#cbd5e1', mb: 2 }} />
                  <Typography variant="h6" fontWeight={600} color="#64748b" mb={1}>
                    No entries today
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Time entries will appear here once employees clock in
                  </Typography>
                </Box>
              )}
            </CardContent>
          </Card>
      </Box>
    </Box>
  );
};

export default TimeClock;