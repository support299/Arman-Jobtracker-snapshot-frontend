import React, { useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  MenuItem,
  FormControl,
  InputLabel,
  OutlinedInput,
  Select,
  Skeleton,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Alert,
  Paper,
  useTheme,
  useMediaQuery,
  CardHeader,
  styled,
  LinearProgress,
  Popover,
} from '@mui/material';
import {
  Description,
  Warning,
  Error as ErrorIcon,
  Refresh,
  InfoOutlined,
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  ComposedChart,
  Line,
  ReferenceArea,
} from 'recharts';
import { format, startOfMonth, endOfMonth, subMonths, startOfYear, endOfYear, addDays, min as minDate, max as maxDate } from 'date-fns';
import { useGetAnalyticsQuery, useGetHeatMapQuery, useGetLeadFunnelReportQuery, useGetSalesForecastingQuery } from '../../store/api/dashboardApi';
import { useGetEmployeesQuery } from '../../store/api/payrollApi';
import { useMoneyFormatter } from '../../hooks/useMoneyFormatter';
import { AlertCircle, AlertTriangle, Ban, CalendarDays, CheckCircle, Clock, File, FileText, PersonStandingIcon } from 'lucide-react';

// Parse date-only string (yyyy-MM-dd) as local date so CDT/other timezones don't show previous day
const parseLocalDate = (dateStr) => {
  if (!dateStr) return null;
  const s = typeof dateStr === 'string' ? dateStr : String(dateStr);
  if (s.length >= 10) {
    const [y, m, d] = s.slice(0, 10).split('-').map(Number);
    if (!Number.isNaN(y) && !Number.isNaN(m) && !Number.isNaN(d)) return new Date(y, m - 1, d);
  }
  return new Date(s);
};

const currentMonthRange = () => {
  const now = new Date();
  return {
    start_date: format(startOfMonth(now), 'yyyy-MM-dd'),
    end_date: format(endOfMonth(now), 'yyyy-MM-dd'),
  };
};

const STATUS_COLORS = {
  paid: '#22c55e',
  unpaid: '#f97316',
  due: '#eab308',
  overdue: '#ef4444',
  draft: '#64748b',
  sent: '#3b82f6',
  void: '#6b7280',
  partially_paid: '#a855f7',
  partial: '#a855f7',
  payment_processing: '#8b5cf6',
};

const ProgressBar = styled(LinearProgress)(({ trackcolor, barcolor, height }) => ({
  height: height || 6,           // similar to h-1.5
  borderRadius: 4,
  backgroundColor: trackcolor, // your bg-success-light
  "& .MuiLinearProgress-bar": {
    backgroundColor: barcolor, // your bg-success
    borderRadius: 4,
  },
}));

const GRANULARITY_OPTIONS = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'yearly', label: 'Yearly' },
];

/** Format a from–to span for chart axis / tooltip */
const formatDateSpan = (start, end, { short = false } = {}) => {
  if (!start) return '';
  if (!end || start.getTime() === end.getTime()) {
    return format(start, short ? 'MMM d' : 'MMM d, yyyy');
  }
  const sameYear = start.getFullYear() === end.getFullYear();
  const sameMonth = sameYear && start.getMonth() === end.getMonth();
  if (short) {
    if (sameMonth) return `${format(start, 'MMM d')}–${format(end, 'd')}`;
    if (sameYear) return `${format(start, 'MMM d')}–${format(end, 'MMM d')}`;
    return `${format(start, 'MMM d, yy')}–${format(end, 'MMM d, yy')}`;
  }
  if (sameMonth) return `${format(start, 'MMM d')} – ${format(end, 'd, yyyy')}`;
  if (sameYear) return `${format(start, 'MMM d')} – ${format(end, 'MMM d, yyyy')}`;
  return `${format(start, 'MMM d, yyyy')} – ${format(end, 'MMM d, yyyy')}`;
};

const resolveTrendPeriodBounds = (trend, granularity, rangeStart, rangeEnd) => {
  const startRaw = trend.period_start || trend.period;
  let start = parseLocalDate(startRaw);
  if (!start) return { start: null, end: null };

  let end = trend.period_end ? parseLocalDate(trend.period_end) : null;
  if (!end) {
    if (granularity === 'weekly') end = addDays(start, 6);
    else if (granularity === 'monthly') end = endOfMonth(start);
    else if (granularity === 'yearly') end = endOfYear(start);
    else end = start;
  }

  if (rangeStart) start = maxDate([start, rangeStart]);
  if (rangeEnd) end = minDate([end, rangeEnd]);
  if (end < start) end = start;
  return { start, end };
};

const formatTrendPeriodLabels = (trend, granularity, rangeStart, rangeEnd) => {
  const { start, end } = resolveTrendPeriodBounds(trend, granularity, rangeStart, rangeEnd);
  if (!start) {
    return { axis: String(trend.period || ''), full: String(trend.period || ''), key: String(trend.period || '') };
  }

  const key = `${format(start, 'yyyy-MM-dd')}_${format(end, 'yyyy-MM-dd')}`;
  const spansYears = rangeStart && rangeEnd && rangeStart.getFullYear() !== rangeEnd.getFullYear();

  if (granularity === 'daily') {
    return {
      key,
      axis: format(start, spansYears ? 'MMM d, yy' : 'MMM d'),
      full: format(start, 'EEE, MMM d, yyyy'),
    };
  }
  if (granularity === 'weekly') {
    return {
      key,
      axis: formatDateSpan(start, end, { short: true }),
      full: `Week · ${formatDateSpan(start, end)}`,
    };
  }
  if (granularity === 'monthly') {
    return {
      key,
      axis: format(start, 'MMM yyyy'),
      full: format(start, 'MMMM yyyy'),
    };
  }
  if (granularity === 'yearly') {
    return {
      key,
      axis: format(start, 'yyyy'),
      full: format(start, 'yyyy'),
    };
  }
  return {
    key,
    axis: formatDateSpan(start, end, { short: true }),
    full: formatDateSpan(start, end),
  };
};

const RevenueTrendTooltip = ({ active, payload, formatCurrency }) => {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  if (!row) return null;
  return (
    <Box
      sx={{
        bgcolor: 'rgba(255,255,255,0.98)',
        border: '1px solid',
        borderColor: 'rgba(15, 23, 42, 0.08)',
        borderRadius: 2,
        boxShadow: '0 8px 24px rgba(15, 23, 42, 0.12)',
        px: 1.75,
        py: 1.25,
        minWidth: 168,
      }}
    >
      <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: '#0f172a', mb: 1 }}>
        {row.periodFull}
      </Typography>
      {payload.map((item) => (
        <Box
          key={item.dataKey}
          sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, py: 0.25 }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
            <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: item.color, flexShrink: 0 }} />
            <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>{item.name}</Typography>
          </Box>
          <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: '#0f172a' }}>
            {formatCurrency(Number(item.value) || 0)}
          </Typography>
        </Box>
      ))}
    </Box>
  );
};

export const AdminDashboard = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.down('md'));
  const user = useSelector((state) => state.auth.user);
  const userRole = user?.role || 'worker';
  const canViewStaff = ['admin', 'manager', 'supervisor'].includes(userRole);

  const { data: assigneesData } = useGetEmployeesQuery(
    { is_active: true },
    { skip: !canViewStaff }
  );

  // All assignee IDs for sales forecasting (same as calendar: comma-separated)
  const assigneeIdsString = useMemo(() => {
    const results = assigneesData?.results || [];
    const ids = results.map((u) => {
      const numId = parseInt(u.user_id, 10);
      return Number.isNaN(numId) ? (u.user_id || u.email || '') : numId;
    }).filter(Boolean);
    return ids.join(',');
  }, [assigneesData?.results]);

  // Shared dashboard period — default: current calendar month (1st → last day)
  const [dateRange, setDateRange] = useState(currentMonthRange);

  // Invoice-only filters (status / chart granularity)
  const [invoiceFilters, setInvoiceFilters] = useState({
    granularity: 'monthly',
    status: 'all',
  });

  const [heatmapParams, setHeatmapParams] = useState({
    days: '7',
    sort_by: 'total_value',
    order: 'desc',
    view: 'heatmap',
  });

  // Lead funnel–only: optional assignee filter
  const [leadFunnelAssigneeIds, setLeadFunnelAssigneeIds] = useState([]);

  const analyticsParams = useMemo(() => {
    const p = {
      start_date: dateRange.start_date,
      end_date: dateRange.end_date,
      granularity: invoiceFilters.granularity,
    };
    if (invoiceFilters.status && invoiceFilters.status !== 'all') {
      p.status = invoiceFilters.status;
    }
    return p;
  }, [dateRange.start_date, dateRange.end_date, invoiceFilters.granularity, invoiceFilters.status]);

  const leadFunnelReportParams = useMemo(() => {
    const p = {
      start_date: dateRange.start_date,
      end_date: dateRange.end_date,
    };
    if (leadFunnelAssigneeIds?.length) {
      p.assignee_ids = leadFunnelAssigneeIds.join(',');
    }
    return p;
  }, [dateRange.start_date, dateRange.end_date, leadFunnelAssigneeIds]);

  const { data: analyticsData, isLoading: analyticsLoading, refetch: refetchAnalytics } = useGetAnalyticsQuery(analyticsParams);
  const { data: heatmapData, isLoading: heatmapLoading, refetch: refetchHeatmap } = useGetHeatMapQuery(heatmapParams);

  // Sales forecasting: rolling timeline (not date-range driven); assignees = all techs like calendar
  const salesForecastParams = useMemo(
    () => ({ assignee_ids: assigneeIdsString }),
    [assigneeIdsString]
  );
  const { data: salesForecastData, isLoading: forecastLoading } = useGetSalesForecastingQuery(salesForecastParams);
  const { data: leadFunnelData, isLoading: leadFunnelLoading } = useGetLeadFunnelReportQuery(leadFunnelReportParams);

  const dateRangeLabel = useMemo(() => {
    const start = parseLocalDate(dateRange.start_date);
    const end = parseLocalDate(dateRange.end_date);
    if (!start || !end) return '';
    return `${format(start, 'MMM d, yyyy')} – ${format(end, 'MMM d, yyyy')}`;
  }, [dateRange.start_date, dateRange.end_date]);

  const [forecastFormulaAnchor, setForecastFormulaAnchor] = useState(null);

  const forecastChartRows = useMemo(() => {
    if (!salesForecastData?.months) return [];
    return salesForecastData.months.map((month) => ({
      month: month.month_label,
      forecast: month.forecast,
      actual: month.actual != null ? month.actual : null,
      raw: month,
    }));
  }, [salesForecastData?.months]);

  const forecastHistoryPlanningSplit = useMemo(() => {
    const months = salesForecastData?.months;
    if (!months?.length) return { historyEndLabel: null, planningStartLabel: null };
    return {
      historyEndLabel: months[2]?.month_label ?? null,
      planningStartLabel: months[3]?.month_label ?? null,
    };
  }, [salesForecastData?.months]);

  const activeAssigneeCount = assigneesData?.results?.length ?? 0;
  const leadFunnelAssigneeRows = assigneesData?.results || [];

  const { formatMoney: formatCurrency, formatMoneyCompact } = useMoneyFormatter();

  const formatSignedCurrency = (value) => {
    if (value == null || Number.isNaN(Number(value))) return '—';
    const n = Number(value);
    const sign = n > 0 ? '+' : n < 0 ? '−' : '';
    const abs = Math.abs(n);
    return `${sign}${formatCurrency(abs)}`;
  };

  const formatVariancePercentOnly = (pct, forecastValue) => {
    if (pct == null || forecastValue === 0) return null;
    const n = Number(pct);
    const sign = n > 0 ? '+' : '';
    return `${sign}${n.toFixed(1)}%`;
  };

  const renderSalesForecastTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    const m = payload[0]?.payload?.raw;
    if (!m) return null;
    const targetLabel = m.forecast_is_locked ? 'Locked' : 'Projected';
    const targetSub =
      m.forecast_is_locked === false ? 'Projected until month starts; then target locks.' : null;
    const pctStr = formatVariancePercentOnly(m.variance_percent, m.forecast);

    return (
      <Paper elevation={3} sx={{ p: 1.5, maxWidth: 320, border: 1, borderColor: 'divider' }}>
        <Typography variant="subtitle2" fontWeight={700} gutterBottom>
          {m.month_label}
        </Typography>
        <Chip size="small" label={targetLabel} sx={{ mb: 1 }} color={m.forecast_is_locked ? 'default' : 'primary'} variant="outlined" />
        {targetSub && (
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
            {targetSub}
          </Typography>
        )}
        <Typography variant="caption" color="text.secondary" display="block">
          Target (forecast) = {formatCurrency(m.historical_average)} (historical average) + {formatCurrency(m.baseline_scheduled_revenue)} (baseline
          schedule)
        </Typography>
        <Typography variant="body2" fontWeight={600} sx={{ mt: 0.5 }}>
          = {formatCurrency(m.forecast)}
        </Typography>
        {m.actual != null && (
          <>
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
              Actual (completed)
            </Typography>
            <Typography variant="body2" fontWeight={600}>
              {formatCurrency(m.actual)} ({m.actual_job_count ?? '—'} jobs)
            </Typography>
            {m.variance != null && (
              <Typography
                variant="caption"
                display="block"
                sx={{ mt: 0.5, color: m.variance > 0 ? 'success.dark' : m.variance < 0 ? 'error.dark' : 'text.secondary' }}
              >
                {formatSignedCurrency(m.variance)} vs target
                {pctStr != null && ` (${pctStr} vs target)`}
              </Typography>
            )}
            {m.actual_vs_historical_average != null && m.historical_average > 0 && (
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                {formatSignedCurrency(m.actual_vs_historical_average)} vs historical average (same month)
              </Typography>
            )}
          </>
        )}
        <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
          Pipeline today: {formatCurrency(m.scheduled_revenue_total ?? m.scheduled_revenue)} ({m.scheduled_job_count_total ?? '—'} jobs)
        </Typography>
        {m.forecast_is_locked && m.additional_scheduled_revenue > 0 && (
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.75 }}>
            Added after month started: {formatCurrency(m.additional_scheduled_revenue)} ({m.additional_scheduled_job_count} jobs) — counts toward
            actual when completed, not toward target.
          </Typography>
        )}
      </Paper>
    );
  };

  const handleDateRangeChange = (field, value) => {
    setDateRange((prev) => ({ ...prev, [field]: value }));
  };

  const handleInvoiceFilterChange = (field, value) => {
    setInvoiceFilters((prev) => ({ ...prev, [field]: value }));
  };

  const applyDatePreset = (preset) => {
    const now = new Date();
    if (preset === 'this_month') {
      setDateRange(currentMonthRange());
    } else if (preset === 'last_month') {
      const last = subMonths(now, 1);
      setDateRange({
        start_date: format(startOfMonth(last), 'yyyy-MM-dd'),
        end_date: format(endOfMonth(last), 'yyyy-MM-dd'),
      });
    } else if (preset === 'this_year') {
      setDateRange({
        start_date: format(startOfYear(now), 'yyyy-MM-dd'),
        end_date: format(endOfYear(now), 'yyyy-MM-dd'),
      });
    }
  };

  const isPresetActive = (preset) => {
    const now = new Date();
    let expected;
    if (preset === 'this_month') expected = currentMonthRange();
    else if (preset === 'last_month') {
      const last = subMonths(now, 1);
      expected = {
        start_date: format(startOfMonth(last), 'yyyy-MM-dd'),
        end_date: format(endOfMonth(last), 'yyyy-MM-dd'),
      };
    } else if (preset === 'this_year') {
      expected = {
        start_date: format(startOfYear(now), 'yyyy-MM-dd'),
        end_date: format(endOfYear(now), 'yyyy-MM-dd'),
      };
    }
    return (
      expected &&
      dateRange.start_date === expected.start_date &&
      dateRange.end_date === expected.end_date
    );
  };

  const formatTrendData = useMemo(() => {
    if (!analyticsData?.trends) return [];
    const rangeStart = parseLocalDate(dateRange.start_date);
    const rangeEnd = parseLocalDate(dateRange.end_date);
    const granularity = invoiceFilters.granularity;
    return analyticsData.trends.map((trend) => {
      const labels = formatTrendPeriodLabels(trend, granularity, rangeStart, rangeEnd);
      return {
        periodKey: labels.key,
        period: labels.axis,
        periodFull: labels.full,
        Paid: trend.total_paid,
        Unpaid: trend.total_due,
      };
    });
  }, [analyticsData?.trends, dateRange.start_date, dateRange.end_date, invoiceFilters.granularity]);

  const trendLabelByKey = useMemo(() => {
    const map = {};
    formatTrendData.forEach((row) => {
      map[row.periodKey] = row.period;
    });
    return map;
  }, [formatTrendData]);

  const formatStatusData = useMemo(() => {
    if (!analyticsData?.status_distribution) return [];
    return Object.entries(analyticsData.status_distribution)
      .filter(([_, value]) => value.count > 0)
      .map(([key, value]) => ({
        name: value.label,
        value: value.count,
        amount: value.total,
        color: STATUS_COLORS[key] || '#64748b',
      }));
  }, [analyticsData?.status_distribution]);

  const statusDataTotal = useMemo(
    () => formatStatusData.reduce((s, d) => s + d.value, 0),
    [formatStatusData]
  );

  const trendXAxisInterval = useMemo(() => {
    const n = formatTrendData.length;
    if (n <= 8) return 0;
    if (n <= 16) return 1;
    if (n <= 32) return 2;
    return Math.ceil(n / 12) - 1;
  }, [formatTrendData.length]);

  const granularityHint = {
    daily: 'Each bar is one day',
    weekly: 'Each bar is a week (from–to dates)',
    monthly: 'Each bar is one calendar month',
    yearly: 'Each bar is one year',
  }[invoiceFilters.granularity] || 'Paid vs outstanding over time';

  const unpaidBreakdown = useMemo(() => {
    const fromApi = analyticsData?.paid_unpaid_overview?.unpaid_breakdown;
    if (Array.isArray(fromApi) && fromApi.length > 0) return fromApi;
    if (!analyticsData?.status_distribution) return [];
    return Object.entries(analyticsData.status_distribution)
      .filter(([key]) => !['paid', 'payment_processing', 'due', 'overdue'].includes(key))
      .map(([key, value]) => ({
        status: key,
        label: value.label,
        count: value.count,
        total: value.total,
      }))
      .filter((row) => row.count > 0)
      .sort((a, b) => b.count - a.count);
  }, [analyticsData?.paid_unpaid_overview?.unpaid_breakdown, analyticsData?.status_distribution]);

  const getLoadLevelColor = (level) => {
    switch (level) {
      case 'none': return '#f1f5f9';
      case 'light': return 'rgba(34, 197, 94, 0.4)';
      case 'moderate': return 'rgba(251, 191, 36, 0.6)';
      case 'heavy': return 'rgba(239, 68, 68, 0.8)';
      default: return '#f1f5f9';
    }
  };

  if (analyticsLoading) {
    return (
      <Box sx={{ p: { xs: 2, sm: 3 } }}>
        {/* Header */}
        <Box sx={{ 
          mb: 3,
          display: 'flex',
          flexDirection: { xs: 'column', sm: 'row' },
          justifyContent: 'space-between',
          alignItems: { xs: 'flex-start', sm: 'center' },
          gap: 2
        }}>
          <Box>
            <Typography variant={isMobile ? 'h5' : 'h4'} gutterBottom>
              Dashboard
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Invoice analytics, lead funnel, and workload overview
            </Typography>
          </Box>
        </Box>

        {/* Shared period skeleton */}
        <Skeleton variant="rectangular" height={88} sx={{ mb: 3, borderRadius: 2.5, bgcolor: 'rgba(15,118,110,0.08)' }} />

        {/* Summary Cards Skeleton - Matching actual design */}
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-7 mb-4">
          {[1, 2, 3, 4, 5, 6, 7].map((i) => (
            <div key={i} className="shadow-sm bg-gradient-to-br from-gray-100/60 to-gray-100/10 rounded-lg">
              <Box className="flex items-center justify-between px-4 pt-4">
                <Skeleton variant="text" width="60%" height={16} sx={{ bgcolor: 'rgba(0,0,0,0.1)' }} />
                <Skeleton variant="circular" width={32} height={32} sx={{ bgcolor: 'rgba(0,0,0,0.1)' }} />
              </Box>
              <CardContent>
                <Skeleton variant="text" width="70%" height={36} sx={{ bgcolor: 'rgba(0,0,0,0.1)', mb: 1 }} />
                <Skeleton variant="text" width="80%" height={20} sx={{ bgcolor: 'rgba(0,0,0,0.08)', mb: 2 }} />
                <Skeleton variant="rectangular" width="100%" height={6} sx={{ borderRadius: 1, bgcolor: 'rgba(0,0,0,0.08)', mb: 1 }} />
                <Skeleton variant="text" width="60%" height={14} sx={{ bgcolor: 'rgba(0,0,0,0.08)' }} />
              </CardContent>
            </div>
          ))}
        </div>

        {/* Charts Section Skeleton */}
        <div className="grid gap-4 grid-cols-1 lg:grid-cols-2 mb-4">
          <Card sx={{ boxShadow: 1 }}>
            <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
              <Skeleton variant="text" width="40%" height={24} sx={{ mb: 1, bgcolor: 'rgba(0,0,0,0.1)' }} />
              <Skeleton variant="text" width="60%" height={16} sx={{ mb: 3, bgcolor: 'rgba(0,0,0,0.08)' }} />
              <Skeleton variant="rectangular" width="100%" height={300} sx={{ borderRadius: 1, bgcolor: 'rgba(0,0,0,0.08)' }} />
            </CardContent>
          </Card>
          <Card sx={{ boxShadow: 1 }}>
            <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
              <Skeleton variant="text" width="50%" height={24} sx={{ mb: 1, bgcolor: 'rgba(0,0,0,0.1)' }} />
              <Skeleton variant="text" width="40%" height={16} sx={{ mb: 3, bgcolor: 'rgba(0,0,0,0.08)' }} />
              <Skeleton variant="rectangular" width="100%" height={300} sx={{ borderRadius: 1, bgcolor: 'rgba(0,0,0,0.08)' }} />
            </CardContent>
          </Card>
        </div>

        {/* Lead Funnel Skeleton - Replace Top Customers skeleton */}
          <Card sx={{ mb: 3, boxShadow: 1 }}>
            <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
              <Skeleton variant="text" width="30%" height={24} sx={{ mb: 1, bgcolor: 'rgba(0,0,0,0.1)' }} />
              <Skeleton variant="text" width="50%" height={16} sx={{ mb: 3, bgcolor: 'rgba(0,0,0,0.08)' }} />
              
              {/* Summary skeleton */}
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' }, gap: 2, mb: 3 }}>
                {[1,2,3,4].map(i => (
                  <Skeleton key={i} variant="rectangular" height={70} sx={{ borderRadius: 1, bgcolor: 'rgba(0,0,0,0.08)' }} />
                ))}
              </Box>
              
              {/* Funnel stages skeleton */}
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} variant="rectangular" height={80} sx={{ mb: 2, borderRadius: 2, bgcolor: 'rgba(0,0,0,0.08)' }} />
              ))}
            </CardContent>
          </Card>

          {/* Sales Forecasting Skeleton */}
          <Card sx={{ mb: 3, boxShadow: 1 }}>
            <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
              <Skeleton variant="text" width="30%" height={24} sx={{ mb: 1, bgcolor: 'rgba(0,0,0,0.1)' }} />
              <Skeleton variant="text" width="50%" height={16} sx={{ mb: 3, bgcolor: 'rgba(0,0,0,0.08)' }} />
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(4, 1fr)' }, gap: 2, mb: 3 }}>
                {[1,2,3,4].map(i => (
                  <Skeleton key={i} variant="rectangular" height={70} sx={{ borderRadius: 1, bgcolor: 'rgba(0,0,0,0.08)' }} />
                ))}
              </Box>
              <Skeleton variant="rectangular" width="100%" height={300} sx={{ borderRadius: 1, bgcolor: 'rgba(0,0,0,0.08)' }} />
            </CardContent>
          </Card>

          {/* Top Customers Skeleton - now at the end */}
          <Card sx={{ mb: 3, boxShadow: 1 }}>
            <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
              <Skeleton variant="text" width="30%" height={24} sx={{ mb: 1, bgcolor: 'rgba(0,0,0,0.1)' }} />
              <Skeleton variant="text" width="50%" height={16} sx={{ mb: 2, bgcolor: 'rgba(0,0,0,0.08)' }} />
              <Box sx={{ mt: 2 }}>
                {[1, 2, 3, 4, 5].map((i) => (
                  <Box key={i} sx={{ display: 'flex', gap: 2, mb: 2, alignItems: 'center' }}>
                    <Skeleton variant="text" width="25%" height={20} sx={{ bgcolor: 'rgba(0,0,0,0.08)' }} />
                    <Skeleton variant="text" width="30%" height={20} sx={{ bgcolor: 'rgba(0,0,0,0.08)' }} />
                    <Skeleton variant="text" width="15%" height={20} sx={{ bgcolor: 'rgba(0,0,0,0.08)' }} />
                    <Skeleton variant="text" width="10%" height={20} sx={{ bgcolor: 'rgba(0,0,0,0.08)' }} />
                    <Skeleton variant="text" width="15%" height={20} sx={{ bgcolor: 'rgba(0,0,0,0.08)' }} />
                  </Box>
                ))}
              </Box>
            </CardContent>
          </Card>

        {/* Heatmap Skeleton */}
        <Card sx={{ boxShadow: 1 }}>
          <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
            <Skeleton variant="text" width="50%" height={24} sx={{ mb: 1, bgcolor: 'rgba(0,0,0,0.1)' }} />
            <Skeleton variant="text" width="60%" height={16} sx={{ mb: 3, bgcolor: 'rgba(0,0,0,0.08)' }} />
            <Box sx={{ mt: 3 }}>
              {[1, 2, 3, 4].map((i) => (
                <Box key={i} sx={{ mb: 2 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Skeleton variant="text" width="20%" height={20} sx={{ bgcolor: 'rgba(0,0,0,0.08)' }} />
                    <Skeleton variant="text" width="15%" height={20} sx={{ bgcolor: 'rgba(0,0,0,0.08)' }} />
                  </Box>
                  <Box sx={{ display: 'flex', gap: 0.5 }}>
                    {[1, 2, 3, 4, 5, 6, 7].map((j) => (
                      <Skeleton 
                        key={j} 
                        variant="rectangular" 
                        width="100%" 
                        height={60} 
                        sx={{ 
                          borderRadius: 1, 
                          bgcolor: 'rgba(0,0,0,0.08)',
                          flex: 1
                        }} 
                      />
                    ))}
                  </Box>
                </Box>
              ))}
            </Box>
          </CardContent>
        </Card>
      </Box>
    );
  }

  if (!analyticsData?.summary) {
    return (
      <Box sx={{ p: { xs: 2, sm: 3 } }}>
        <Typography variant="h5" gutterBottom>
          Dashboard
        </Typography>
        <Alert severity="error" sx={{ mt: 2 }}>
          Could not load dashboard data. Make sure the backend is running on port 8000, then refresh this page.
        </Alert>
      </Box>
    );
  }

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Box>
        {/* Header - Compact on mobile */}
        <Box sx={{ 
          mb: 3,
          display: 'flex',
          flexDirection: { xs: 'column', sm: 'row' },
          justifyContent: 'space-between',
          alignItems: { xs: 'flex-start', sm: 'center' },
          gap: 2
        }}>
          <Box>
            <Typography variant={isMobile ? 'h5' : 'h4'} gutterBottom>
              Dashboard
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Invoice analytics, lead funnel, and workload overview
            </Typography>
          </Box>
          <IconButton 
            onClick={() => { 
              refetchAnalytics(); 
              refetchHeatmap(); 
            }} 
            color="primary"
            size={isMobile ? 'small' : 'medium'}
          >
            <Refresh />
          </IconButton>
        </Box>

        {/* Shared dashboard period — applies to invoices + lead funnel */}
        <Paper
          elevation={0}
          sx={{
            mb: 3,
            p: { xs: 2, sm: 2.5 },
            borderRadius: 2.5,
            border: '1px solid',
            borderColor: 'rgba(15, 118, 110, 0.22)',
            background: 'linear-gradient(135deg, rgba(240,253,250,0.95) 0%, rgba(255,255,255,0.98) 55%, rgba(248,250,252,0.9) 100%)',
            boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04), 0 8px 24px rgba(15, 118, 110, 0.06)',
          }}
        >
          <Box
            sx={{
              display: 'flex',
              flexDirection: { xs: 'column', md: 'row' },
              alignItems: { xs: 'stretch', md: 'center' },
              justifyContent: 'space-between',
              gap: 2,
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, minWidth: 0 }}>
              <Box
                sx={{
                  width: 42,
                  height: 42,
                  borderRadius: 2,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  bgcolor: 'rgba(15, 118, 110, 0.12)',
                  color: '#0f766e',
                  flexShrink: 0,
                }}
              >
                <CalendarDays size={20} />
              </Box>
              <Box sx={{ minWidth: 0 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1, mb: 0.25 }}>
                  <Typography variant="subtitle1" fontWeight={700} sx={{ color: '#0f172a', lineHeight: 1.2 }}>
                    Dashboard period
                  </Typography>
                  <Chip
                    size="small"
                    label="Shared filter"
                    sx={{
                      height: 22,
                      fontWeight: 600,
                      fontSize: '0.7rem',
                      bgcolor: 'rgba(15, 118, 110, 0.12)',
                      color: '#0f766e',
                    }}
                  />
                </Box>
                <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8125rem' }}>
                  Applies to invoice analytics and lead funnel · {dateRangeLabel}
                </Typography>
              </Box>
            </Box>

            <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1.25 }}>
              {['this_month', 'last_month', 'this_year'].map((preset) => {
                const labels = { this_month: 'This month', last_month: 'Last month', this_year: 'This year' };
                const active = isPresetActive(preset);
                return (
                  <Chip
                    key={preset}
                    label={labels[preset]}
                    size="small"
                    onClick={() => applyDatePreset(preset)}
                    variant={active ? 'filled' : 'outlined'}
                    sx={{
                      fontWeight: 600,
                      cursor: 'pointer',
                      ...(active
                        ? { bgcolor: '#0f766e', color: '#fff', '&:hover': { bgcolor: '#0d9488' } }
                        : { borderColor: 'rgba(15, 118, 110, 0.35)', color: '#0f766e' }),
                    }}
                  />
                );
              })}
              <DatePicker
                label="From"
                value={parseLocalDate(dateRange.start_date)}
                onChange={(date) =>
                  date && handleDateRangeChange('start_date', format(date, 'yyyy-MM-dd'))
                }
                slotProps={{
                  textField: {
                    size: 'small',
                    sx: {
                      minWidth: { xs: '100%', sm: 150 },
                      bgcolor: 'background.paper',
                      '& .MuiOutlinedInput-root': { borderRadius: 1.5 },
                    },
                  },
                }}
              />
              <DatePicker
                label="To"
                value={parseLocalDate(dateRange.end_date)}
                onChange={(date) =>
                  date && handleDateRangeChange('end_date', format(date, 'yyyy-MM-dd'))
                }
                slotProps={{
                  textField: {
                    size: 'small',
                    sx: {
                      minWidth: { xs: '100%', sm: 150 },
                      bgcolor: 'background.paper',
                      '& .MuiOutlinedInput-root': { borderRadius: 1.5 },
                    },
                  },
                }}
              />
            </Box>
          </Box>
        </Paper>

        {/* Invoice section toolbar — status + chart granularity only */}
        <Box
          sx={{
            mb: 2,
            display: 'flex',
            flexDirection: { xs: 'column', sm: 'row' },
            alignItems: { xs: 'stretch', sm: 'center' },
            justifyContent: 'space-between',
            gap: 1.5,
          }}
        >
          <Box>
            <Typography variant="subtitle1" fontWeight={700} sx={{ color: '#0f172a' }}>
              Invoice analytics
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Status and chart detail for this section only · {granularityHint}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1.25 }}>
            <Box
              sx={{
                display: 'inline-flex',
                flexWrap: 'wrap',
                gap: 0.5,
                p: 0.5,
                borderRadius: 2,
                bgcolor: 'rgba(15, 118, 110, 0.06)',
                border: '1px solid',
                borderColor: 'rgba(15, 118, 110, 0.14)',
              }}
            >
              {GRANULARITY_OPTIONS.map((opt) => {
                const active = invoiceFilters.granularity === opt.value;
                return (
                  <Chip
                    key={opt.value}
                    label={opt.label}
                    size="small"
                    onClick={() => handleInvoiceFilterChange('granularity', opt.value)}
                    variant={active ? 'filled' : 'outlined'}
                    sx={{
                      fontWeight: 600,
                      cursor: 'pointer',
                      border: 'none',
                      ...(active
                        ? { bgcolor: '#0f766e', color: '#fff', '&:hover': { bgcolor: '#0d9488' } }
                        : {
                            bgcolor: 'transparent',
                            color: '#0f766e',
                            '&:hover': { bgcolor: 'rgba(15, 118, 110, 0.1)' },
                          }),
                    }}
                  />
                );
              })}
            </Box>
            <FormControl size="small" sx={{ minWidth: 140 }}>
              <InputLabel>Invoice status</InputLabel>
              <Select
                value={invoiceFilters.status}
                label="Invoice status"
                onChange={(e) => handleInvoiceFilterChange('status', e.target.value)}
                sx={{ bgcolor: 'background.paper', borderRadius: 1.5 }}
              >
                <MenuItem value="all">All</MenuItem>
                <MenuItem value="paid">Paid</MenuItem>
                <MenuItem value="overdue">Overdue</MenuItem>
                <MenuItem value="draft">Draft</MenuItem>
                <MenuItem value="sent">Sent</MenuItem>
                <MenuItem value="void">Void</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </Box>

        {/* Summary Cards - Responsive Grid */}
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-7 mb-4">
          <div className="shadow-sm bg-gradient-to-br from-stone-200/60 to-from-stone-200/10 rounded-lg">
            <Box className="flex items-center justify-between px-4 pt-4">
              <Typography variant="body2" color="text.secondary" fontWeight="500">
                Total Invoices
              </Typography>
              <div className="h-8 w-8 rounded-full bg-stone-400/20 flex items-center justify-center">
                <FileText className="h-4 w-4 text-primary" />
              </div>
            </Box>
            <CardContent >
              <div className="text-3xl font-bold">{analyticsData?.summary.total_invoices || 0}</div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {analyticsData?.paid_unpaid_overview.paid.count || 0} paid • {analyticsData?.paid_unpaid_overview.unpaid.count || 0} unpaid
                {(analyticsData?.status_distribution?.payment_processing?.count ?? 0) > 0 && (
                  <> • {analyticsData.status_distribution.payment_processing.count} payment processing</>
                )}
              </p>
            </CardContent>
          </div>

          <div className="shadow-sm bg-gradient-to-br from-green-100/60 to-green-100/10 rounded-lg">
            <Box className="flex flex-row items-center justify-between px-4 pt-4">
              <Typography variant="body2" color="text.secondary" fontWeight="500">Paid / Collected</Typography>
              <div className="h-8 w-8 rounded-full bg-green-400/20 flex items-center justify-center">
                <CheckCircle className="h-4 w-4 text-success" />
              </div>
            </Box>
            <CardContent >
              <div className="text-3xl font-bold">{analyticsData?.paid_unpaid_overview.paid.count || 0}</div>
              <p className="text-sm font-medium text-success mt-0.5">
                {formatCurrency(analyticsData?.paid_unpaid_overview.paid.total || 0)}
              </p>
              <div className="mt-2">
                <Box mt={2}>
                  <ProgressBar 
                    variant="determinate" 
                    value={(analyticsData.summary.total_paid / analyticsData.summary.total_amount * 100) || 0} 
                    trackcolor="#E3F9E5"   // light
                    barcolor="#16A34A"
                  />
                </Box>
              </div>
              <p className="text-xs text-muted-foreground">
                {((analyticsData.summary.total_paid / analyticsData.summary.total_amount * 100) || 0).toFixed(1)}% collected
              </p>
            </CardContent>
          </div>

          <div className="shadow-sm bg-gradient-to-br from-orange-100/60 to-orange-100/10 rounded-lg">
            <Box className="flex flex-row items-center justify-between px-4 pt-4">
              <Typography variant="body2" color="text.secondary" fontWeight="500">Outstanding / Unpaid</Typography>
              <div className="h-8 w-8 rounded-full bg-orange-300/20 flex items-center justify-center">
                <Clock className="h-4 w-4 text-orange-400" />
              </div>
            </Box>
            <CardContent >
              <div className="text-3xl font-bold">{analyticsData?.paid_unpaid_overview.unpaid.count || 0}</div>
              <p className="text-sm font-medium text-orange-400 mt-0.5">
                {formatCurrency(analyticsData?.paid_unpaid_overview.unpaid.total || 0)}
              </p>
              <div className="mt-2">
                <Box mt={2}>
                  <ProgressBar 
                    variant="determinate" 
                    value={(analyticsData.paid_unpaid_overview.unpaid.total / analyticsData.summary.total_amount * 100) || 0} 
                    trackcolor="#fffaf0"   // light
                    barcolor="#fb923c"
                  />
                </Box>
              </div>
              <p className="text-xs text-muted-foreground">
                {((analyticsData.paid_unpaid_overview.unpaid.total / analyticsData.summary.total_amount * 100) || 0).toFixed(1)}% pending
              </p>
              {unpaidBreakdown.length > 0 && (
                <Box sx={{ mt: 1.5, pt: 1, borderTop: '1px solid', borderColor: 'divider' }}>
                  <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.75, fontWeight: 600 }}>
                    By status
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {unpaidBreakdown.map((row) => (
                      <Chip
                        key={row.status}
                        size="small"
                        label={`${row.label} ${row.count}`}
                        title={`${row.label}: ${row.count} · ${formatCurrency(row.total)}`}
                        sx={{
                          height: 22,
                          fontSize: '0.65rem',
                          fontWeight: 600,
                          bgcolor: 'rgba(249, 115, 22, 0.1)',
                          color: '#c2410c',
                          '& .MuiChip-label': { px: 0.75 },
                        }}
                      />
                    ))}
                  </Box>
                </Box>
              )}
            </CardContent>
          </div>

          <div className="shadow-sm bg-gradient-to-br from-yellow-100/60 to-yellow-100/10 rounded-lg">
            <Box className="flex flex-row items-center justify-between px-4 pt-4">
              <Typography variant="body2" color="text.secondary" fontWeight="500">Due</Typography>
              <div className="h-8 w-8 rounded-full bg-yellow-300/20 flex items-center justify-center">
                <AlertCircle className="h-4 w-4 text-yellow-400" />
              </div>
            </Box>
            <CardContent >
              <div className="text-3xl font-bold">{analyticsData?.status_distribution.due?.count || 0}</div>
              <p className="text-sm font-medium text-yellow-400 mt-0.5">
                {formatCurrency(analyticsData?.status_distribution.due?.total || 0)}
              </p>
              <div className="mt-2">
                <Box mt={2}>
                  <ProgressBar 
                    variant="determinate" 
                    value={(analyticsData.status_distribution.due?.total / analyticsData.summary.total_amount * 100) || 0} 
                    trackcolor="#fef9c3"   // light
                    barcolor="#facc15"
                  />
                </Box>
              </div>
              <p className="text-xs text-muted-foreground">
                {((analyticsData.status_distribution.due?.total / analyticsData.summary.total_amount * 100) || 0).toFixed(1)}% of total amount
              </p>
            </CardContent>
          </div>

          <div className="shadow-sm bg-gradient-to-br from-red-100/60 to-red-100/10 rounded-lg">
            <Box className="flex flex-row items-center justify-between px-4 pt-4">
              <Typography variant="body2" color="text.secondary" fontWeight="500">Overdue</Typography>
              <div className="h-8 w-8 rounded-full bg-red-300/20 flex items-center justify-center">
                <AlertTriangle className="h-4 w-4 text-red-400" />
              </div>
            </Box>
            <CardContent >
              <div className="text-3xl font-bold">{analyticsData?.summary.overdue_count || 0}</div>
              <p className="text-sm font-medium text-red-400 mt-0.5">
                {formatCurrency(analyticsData?.summary.overdue_total || 0)}
              </p>
              <div className="mt-2">
                <Box mt={2}>
                  <ProgressBar 
                    variant="determinate" 
                    value={(analyticsData.summary.overdue_total / analyticsData.summary.total_amount * 100) || 0} 
                    trackcolor="#fee2e2"   // light
                    barcolor="#f87171"
                  />
                </Box>
              </div>
              <p className="text-xs text-muted-foreground">
                {((analyticsData.summary.overdue_total / analyticsData.summary.total_amount * 100) || 0).toFixed(1)}% of total amount
              </p>
            </CardContent>
          </div>

          <div className="shadow-sm bg-gradient-to-br from-blue-100/60 to-blue-100/10 rounded-lg">
            <Box className="flex flex-row items-center justify-between px-4 pt-4">
              <Typography variant="body2" color="text.secondary" fontWeight="500">Draft</Typography>
              <div className="h-8 w-8 rounded-full bg-blue-300/20 flex items-center justify-center">
                <File className="h-4 w-4 text-blue-400" />
              </div>
            </Box>
            <CardContent >
              <div className="text-3xl font-bold">{analyticsData?.status_distribution.draft?.count || 0}</div>
              <p className="text-sm font-medium text-blue-400 mt-0.5">
                {formatCurrency(analyticsData?.status_distribution.draft?.total || 0)}
              </p>
              <div className="mt-2">
                <Box mt={2}>
                  <ProgressBar 
                    variant="determinate" 
                    value={(analyticsData?.status_distribution.draft?.total / analyticsData.summary.total_amount * 100) || 0} 
                    trackcolor="#dbeafe"   // light
                    barcolor="#60a5fa"
                  />
                </Box>
              </div>
              <p className="text-xs text-muted-foreground">
                {((analyticsData.status_distribution.draft?.total / analyticsData.summary.total_amount * 100) || 0).toFixed(1)}% of total amount
              </p>
            </CardContent>
          </div>

          <div className="shadow-sm bg-gradient-to-br from-slate-200/60 to-slate-200/10 rounded-lg">
            <Box className="flex flex-row items-center justify-between px-4 pt-4">
              <Typography variant="body2" color="text.secondary" fontWeight="500">Void</Typography>
              <div className="h-8 w-8 rounded-full bg-slate-400/20 flex items-center justify-center">
                <Ban className="h-4 w-4 text-slate-500" />
              </div>
            </Box>
            <CardContent >
              <div className="text-3xl font-bold">{analyticsData?.status_distribution.void?.count || 0}</div>
              <p className="text-sm font-medium text-slate-600 mt-0.5">
                {formatCurrency(analyticsData?.status_distribution.void?.total || 0)}
              </p>
              <div className="mt-2">
                <Box mt={2}>
                  <ProgressBar 
                    variant="determinate" 
                    value={(analyticsData?.status_distribution.void?.total / analyticsData.summary.total_amount * 100) || 0} 
                    trackcolor="#f1f5f9"
                    barcolor="#64748b"
                  />
                </Box>
              </div>
              <p className="text-xs text-muted-foreground">
                {((analyticsData?.status_distribution.void?.total / analyticsData.summary.total_amount * 100) || 0).toFixed(1)}% of total amount
              </p>
            </CardContent>
          </div>

          {/* <div className="shadow-sm bg-gradient-to-br from-violet-100/60 to-violet-100/10 rounded-lg">
            <Box className="flex flex-row items-center justify-between px-4 pt-4">
              <Typography variant="body2" color="text.secondary" fontWeight="500">Payment Processing</Typography>
              <div className="h-8 w-8 rounded-full bg-violet-300/20 flex items-center justify-center">
                <Refresh className="h-4 w-4 text-violet-500" />
              </div>
            </Box>
            <CardContent >
              <div className="text-3xl font-bold">{analyticsData?.status_distribution.payment_processing?.count || 0}</div>
              <p className="text-sm font-medium text-violet-500 mt-0.5">
                {formatCurrency(analyticsData?.status_distribution.payment_processing?.total || 0)}
              </p>
              <div className="mt-2">
                <Box mt={2}>
                  <ProgressBar 
                    variant="determinate" 
                    value={(analyticsData?.summary?.total_amount && analyticsData?.status_distribution?.payment_processing?.total)
                      ? (analyticsData.status_distribution.payment_processing.total / analyticsData.summary.total_amount * 100)
                      : 0} 
                    trackcolor="#ede9fe"
                    barcolor="#8b5cf6"
                  />
                </Box>
              </div>
              <p className="text-xs text-muted-foreground">
                {analyticsData?.summary?.total_amount && analyticsData?.status_distribution?.payment_processing?.total
                  ? ((analyticsData.status_distribution.payment_processing.total / analyticsData.summary.total_amount) * 100).toFixed(1)
                  : '0.0'}% of total amount
              </p>
            </CardContent>
          </div> */}
        </div>

        {/* Charts Section - Responsive */}
        <div className="grid gap-4 grid-cols-1 lg:grid-cols-2 mb-4">
          <Card
            sx={{
              boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04), 0 8px 24px rgba(15, 23, 42, 0.04)',
              border: '1px solid',
              borderColor: 'rgba(15, 23, 42, 0.06)',
              borderRadius: 2.5,
            }}
          >
            <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
              <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1, mb: 0.5 }}>
                <Box>
                  <Typography variant="subtitle1" fontWeight={700} sx={{ color: '#0f172a' }}>
                    Revenue Trends
                  </Typography>
                  <Typography variant="caption" color="text.secondary" display="block">
                    Paid vs outstanding · {GRANULARITY_OPTIONS.find((o) => o.value === invoiceFilters.granularity)?.label}
                  </Typography>
                </Box>
                <Chip
                  size="small"
                  label={GRANULARITY_OPTIONS.find((o) => o.value === invoiceFilters.granularity)?.label || 'Monthly'}
                  sx={{
                    height: 22,
                    fontWeight: 600,
                    fontSize: '0.7rem',
                    bgcolor: 'rgba(15, 118, 110, 0.1)',
                    color: '#0f766e',
                  }}
                />
              </Box>
              <ResponsiveContainer width="100%" height={isMobile ? 270 : 320}>
                <BarChart data={formatTrendData} margin={{ top: 8, right: 8, left: 0, bottom: formatTrendData.length > 8 ? 28 : 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                  <XAxis
                    dataKey="periodKey"
                    tickFormatter={(key) => trendLabelByKey[key] || key}
                    tick={{ fontSize: isMobile ? 9 : 11, fill: '#64748b' }}
                    angle={formatTrendData.length > 6 || isMobile ? -35 : 0}
                    textAnchor={formatTrendData.length > 6 || isMobile ? 'end' : 'middle'}
                    height={formatTrendData.length > 6 || isMobile ? 70 : 36}
                    interval={trendXAxisInterval}
                    axisLine={{ stroke: '#e2e8f0' }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: isMobile ? 10 : 12, fill: '#64748b' }}
                    axisLine={false}
                    tickLine={false}
                    width={isMobile ? 44 : 56}
                  />
                  <RechartsTooltip
                    cursor={{ fill: 'rgba(15, 118, 110, 0.06)' }}
                    content={<RevenueTrendTooltip formatCurrency={formatCurrency} />}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: isMobile ? 10 : 12, paddingTop: 8 }}
                    iconType="circle"
                    iconSize={8}
                  />
                  <Bar dataKey="Paid" fill="#22c55e" radius={[4, 4, 0, 0]} maxBarSize={36} />
                  <Bar dataKey="Unpaid" fill="#f97316" radius={[4, 4, 0, 0]} maxBarSize={36} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          <Card
            sx={{
              boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04), 0 8px 24px rgba(15, 23, 42, 0.04)',
              border: '1px solid',
              borderColor: 'rgba(15, 23, 42, 0.06)',
              borderRadius: 2.5,
            }}
          >
            <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
              <Typography variant="subtitle1" fontWeight={700} gutterBottom sx={{ color: '#0f172a' }}>
                Invoice Status Distribution
              </Typography>
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 2 }}>
                Breakdown by status
              </Typography>
              <ResponsiveContainer width="100%" height={isMobile ? 280 : 340}>
                <PieChart margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                  <Pie
                    data={formatStatusData}
                    cx="50%"
                    cy="45%"
                    labelLine={false}
                    label={false}
                    outerRadius={isMobile ? 72 : 88}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {formatStatusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <RechartsTooltip
                    formatter={(value, name, props) => [
                      `${value} (${statusDataTotal ? ((value / statusDataTotal) * 100).toFixed(1) : '0'}%)`,
                      props.payload.name,
                    ]}
                    contentStyle={{ fontSize: 13, padding: '10px 14px', borderRadius: 8 }}
                    itemStyle={{ padding: '4px 0' }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <Box sx={{ mt: 2, pt: 2, borderTop: 1, borderColor: 'divider' }}>
                <Typography variant="caption" color="text.secondary" fontWeight="600" display="block" sx={{ mb: 1 }}>
                  By status
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5 }}>
                  {formatStatusData.map((entry, index) => {
                    const pct = statusDataTotal ? ((entry.value / statusDataTotal) * 100).toFixed(1) : '0';
                    return (
                      <Box
                        key={`legend-${index}`}
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 1,
                          py: 0.5,
                          px: 1.5,
                          borderRadius: 1,
                          bgcolor: 'action.hover',
                          width: '100%',
                          maxWidth: 280,
                        }}
                      >
                        <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: entry.color, flexShrink: 0 }} />
                        <Typography variant="body2" sx={{ flex: 1, fontWeight: 500 }}>
                          {entry.name}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {entry.value} · {pct}% · {formatCurrency(entry.amount)}
                        </Typography>
                      </Box>
                    );
                  })}
                </Box>
              </Box>
            </CardContent>
          </Card>
        </div>

        {/* Lead Funnel Report */}
          <Card sx={{ mb: 3, boxShadow: 1 }}>
            <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 2, mb: 2 }}>
                <Box>
                  <Typography variant="subtitle1" fontWeight="600">
                    Lead Funnel Report
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Uses dashboard period · assignees filter this section only
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1.5 }}>
                  {canViewStaff && (
                    <FormControl size="small" sx={{ minWidth: 200, maxWidth: { xs: '100%', sm: 320 } }}>
                      <InputLabel id="lead-funnel-assignees-label">Assignees</InputLabel>
                      <Select
                        labelId="lead-funnel-assignees-label"
                        multiple
                        value={leadFunnelAssigneeIds}
                        onChange={(e) => {
                          const v = e.target.value;
                          setLeadFunnelAssigneeIds(
                            typeof v === 'string' ? v.split(',').filter(Boolean) : [...v]
                          );
                        }}
                        input={<OutlinedInput label="Assignees" />}
                        renderValue={(selected) => {
                          if (!selected?.length) {
                            return (
                              <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8125rem' }}>
                                All assignees
                              </Typography>
                            );
                          }
                          const maxChips = 2;
                          const shown = selected.slice(0, maxChips);
                          return (
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, py: 0.25 }}>
                              {shown.map((id) => {
                                const emp = leadFunnelAssigneeRows.find(
                                  (e) => String(e.user_id ?? e.id) === String(id)
                                );
                                return (
                                  <Chip key={id} size="small" label={emp?.full_name || id} sx={{ height: 22 }} />
                                );
                              })}
                              {selected.length > maxChips && (
                                <Chip
                                  size="small"
                                  variant="outlined"
                                  label={`+${selected.length - maxChips}`}
                                  sx={{ height: 22 }}
                                />
                              )}
                            </Box>
                          );
                        }}
                        MenuProps={{ PaperProps: { style: { maxHeight: 320 } } }}
                      >
                        {leadFunnelAssigneeRows.map((emp) => {
                          const uid = emp.user_id ?? emp.id;
                          if (uid == null || uid === '') return null;
                          const val = String(uid);
                          return (
                            <MenuItem key={val} value={val}>
                              {emp.full_name || val}
                            </MenuItem>
                          );
                        })}
                      </Select>
                    </FormControl>
                  )}
                  {canViewStaff && leadFunnelAssigneeIds?.length > 0 && (
                    <Button
                      size="small"
                      variant="text"
                      onClick={() => setLeadFunnelAssigneeIds([])}
                      sx={{ textTransform: 'none', flexShrink: 0 }}
                    >
                      Clear assignees
                    </Button>
                  )}
                </Box>
              </Box>

              {leadFunnelLoading ? (
                <Box sx={{ mt: 2 }}>
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Box key={i} sx={{ display: 'flex', gap: 2, mb: 2, alignItems: 'center' }}>
                      <Skeleton variant="text" width="30%" height={20} />
                      <Skeleton variant="text" width="20%" height={20} />
                      <Skeleton variant="text" width="25%" height={20} />
                    </Box>
                  ))}
                </Box>
              ) : leadFunnelData ? (
                <>
                  {/* Report Period Info */}
                  {leadFunnelData.report_period && (
                    <Box sx={{ mb: 2, p: 1.5, bgcolor: '#f0f9ff', borderRadius: 1 }}>
                      <Typography variant="caption" color="text.secondary" display="block">
                        Report Period: {format(parseLocalDate(leadFunnelData.report_period.start_date), 'MMM dd, yyyy')} – {format(parseLocalDate(leadFunnelData.report_period.end_date), 'MMM dd, yyyy')}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" fontSize="0.7rem">
                        {leadFunnelData.report_period.filter_description}
                      </Typography>
                    </Box>
                  )}

                  {/* Summary Metrics */}
                  <Box sx={{ 
                    display: 'grid', 
                    gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' },
                    gap: 2,
                    mb: 3,
                    p: 2,
                    bgcolor: '#f9fafb',
                    borderRadius: 2
                  }}>
                    <Box>
                      <Typography variant="caption" color="text.secondary" display="block">
                        Pipeline Value
                      </Typography>
                      <Typography variant="h6" fontWeight="600" color="primary.main">
                        {formatCurrency(leadFunnelData.summary_metrics.pipeline_value)}
                      </Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption" color="text.secondary" display="block">
                        Acceptance Rate
                      </Typography>
                      <Typography variant="h6" fontWeight="600" color="success.main">
                        {leadFunnelData.summary_metrics.acceptance_rate_percent.toFixed(1)}%
                      </Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption" color="text.secondary" display="block">
                        Rejection Rate
                      </Typography>
                      <Typography variant="h6" fontWeight="600" color="error.main">
                        {leadFunnelData.summary_metrics.rejection_rate_percent.toFixed(1)}%
                      </Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption" color="text.secondary" display="block">
                        Closed Revenue
                      </Typography>
                      <Typography variant="h6" fontWeight="600" color="success.main">
                        {formatCurrency(leadFunnelData.summary_metrics.total_revenue_closed_jobs)}
                      </Typography>
                    </Box>
                  </Box>

                  {/* Funnel Stages — grid to reduce scrolling */}
                  <Box sx={{ 
                    display: 'grid', 
                    gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(3, 1fr)' }, 
                    gap: 1.5 
                  }}>
                    {/* Contacts created on filter date (New Leads) */}
                    <Box sx={{ 
                      p: 1.5, 
                      border: '1px solid', 
                      borderColor: 'divider',
                      borderRadius: 2,
                      bgcolor: 'background.paper',
                      transition: 'all 0.2s',
                      '&:hover': {
                        boxShadow: 2,
                        borderColor: 'primary.main'
                      }
                    }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 0.5 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
                          <Box sx={{ 
                            width: 36, 
                            height: 36, 
                            borderRadius: '50%', 
                            bgcolor: 'rgba(25, 118, 210, 0.1)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0
                          }}>
                            <PersonStandingIcon style={{ color: theme.palette.primary.main, fontSize: 18 }} />
                          </Box>
                          <Box>
                            <Typography variant="body2" fontWeight="600">
                              Contacts created on {format(parseLocalDate(dateRange.start_date), 'MMM d, yyyy')} – {format(parseLocalDate(dateRange.end_date), 'MMM d, yyyy')}
                            </Typography>
                          </Box>
                        </Box>
                        <Chip 
                          label={leadFunnelData.lead_funnel.new_leads.count} 
                          color="primary" 
                          sx={{ fontWeight: 600, fontSize: '0.875rem' }}
                        />
                      </Box>
                    </Box>

                    {/* Open Quotes */}
                    <Box sx={{ 
                      p: 1.5, 
                      border: '1px solid', 
                      borderColor: 'divider',
                      borderRadius: 2,
                      bgcolor: 'background.paper',
                      transition: 'all 0.2s',
                      '&:hover': {
                        boxShadow: 2,
                        borderColor: 'warning.main'
                      }
                    }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 0.5 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
                          <Box sx={{ 
                            width: 36, 
                            height: 36, 
                            borderRadius: '50%', 
                            bgcolor: 'rgba(237, 108, 2, 0.1)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0
                          }}>
                            <Description sx={{ color: 'warning.main', fontSize: 18 }} />
                          </Box>
                          <Box>
                            <Typography variant="body2" fontWeight="600">
                              Open Quotes
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              Pending decision
                            </Typography>
                          </Box>
                        </Box>
                        <Chip 
                          label={leadFunnelData.lead_funnel.open_estimates.count} 
                          color="warning" 
                          variant="outlined"
                          sx={{ fontWeight: 600, fontSize: '0.875rem' }}
                        />
                      </Box>
                    </Box>

                    {/* Rejected Quotes */}
                    <Box sx={{ 
                      p: 1.5, 
                      border: '1px solid', 
                      borderColor: 'divider',
                      borderRadius: 2,
                      bgcolor: 'background.paper',
                      transition: 'all 0.2s',
                      '&:hover': {
                        boxShadow: 2,
                        borderColor: 'error.main'
                      }
                    }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                          <Box sx={{ 
                            width: 36, 
                            height: 36, 
                            borderRadius: '50%', 
                            bgcolor: 'rgba(211, 47, 47, 0.1)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0
                          }}>
                            <ErrorIcon sx={{ color: 'error.main', fontSize: 18 }} />
                          </Box>
                          <Box>
                            <Typography variant="body2" fontWeight="600">
                            Rejected Quotes
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              Declined opportunities
                            </Typography>
                          </Box>
                        </Box>
                        <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
                          <Chip 
                            label={leadFunnelData.lead_funnel.rejected_estimates.count} 
                            color="error" 
                            sx={{ fontWeight: 600, fontSize: '0.875rem', mb: 0.5 }}
                          />
                          <Typography variant="caption" color="error.main" fontWeight="600" display="block">
                            {formatCurrency(leadFunnelData.lead_funnel.rejected_estimates.total_value)}
                          </Typography>
                        </Box>
                      </Box>
                    </Box>

                    {/* Accepted Quotes */}
                    <Box sx={{ 
                      p: 1.5, 
                      border: '1px solid', 
                      borderColor: 'divider',
                      borderRadius: 2,
                      bgcolor: 'background.paper',
                      transition: 'all 0.2s',
                      '&:hover': {
                        boxShadow: 2,
                        borderColor: 'success.main'
                      }
                    }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                          <Box sx={{ 
                            width: 36, 
                            height: 36, 
                            borderRadius: '50%', 
                            bgcolor: 'rgba(46, 125, 50, 0.1)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}>
                            <CheckCircle sx={{ color: 'success.main', fontSize: 18 }} />
                          </Box>
                          <Box>
                            <Typography variant="body2" fontWeight="600">
                              Accepted Quotes
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              Ready to schedule
                            </Typography>
                          </Box>
                        </Box>
                        <Box sx={{ textAlign: 'right' }}>
                          <Chip 
                            label={leadFunnelData.lead_funnel.accepted_estimates.count} 
                            color="success" 
                            sx={{ fontWeight: 600, fontSize: '0.875rem', mb: 0.5 }}
                          />
                          <Typography variant="caption" color="success.main" fontWeight="600" display="block">
                            {formatCurrency(leadFunnelData.lead_funnel.accepted_estimates.total_value)}
                          </Typography>
                        </Box>
                      </Box>
                    </Box>

                    {/* Scheduled Quotes */}
                    <Box sx={{ 
                      p: 1.5, 
                      border: '1px solid', 
                      borderColor: 'divider',
                      borderRadius: 2,
                      bgcolor: 'background.paper',
                      transition: 'all 0.2s',
                      '&:hover': {
                        boxShadow: 2,
                        borderColor: 'info.main'
                      }
                    }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                          <Box sx={{ 
                            width: 36, 
                            height: 36, 
                            borderRadius: '50%', 
                            bgcolor: 'rgba(25, 118, 210, 0.1)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}>
                            <FileText sx={{ color: 'info.main', fontSize: 18 }} />
                          </Box>
                          <Box>
                            <Typography variant="body2" fontWeight="600">
                              {leadFunnelData.lead_funnel.scheduled_quotes.label}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              Accepted quotes
                            </Typography>
                          </Box>
                        </Box>
                        <Box sx={{ textAlign: 'right' }}>
                          <Chip 
                            label={leadFunnelData.lead_funnel.scheduled_quotes.count} 
                            color="info" 
                            sx={{ fontWeight: 600, fontSize: '0.875rem', mb: 0.5 }}
                          />
                          <Typography variant="caption" color="info.main" fontWeight="600" display="block">
                            {formatCurrency(leadFunnelData.lead_funnel.scheduled_quotes.total_value)}
                          </Typography>
                        </Box>
                      </Box>
                    </Box>

                    {/* Estimate to Convert */}
                    <Box sx={{ 
                      p: 1.5, 
                      border: '1px solid', 
                      borderColor: 'divider',
                      borderRadius: 2,
                      bgcolor: 'background.paper',
                      transition: 'all 0.2s',
                      '&:hover': {
                        boxShadow: 2,
                        borderColor: 'warning.main'
                      }
                    }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                          <Box sx={{ 
                            width: 36, 
                            height: 36, 
                            borderRadius: '50%', 
                            bgcolor: 'rgba(237, 108, 2, 0.1)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}>
                            <Warning sx={{ color: 'warning.main', fontSize: 18 }} />
                          </Box>
                          <Box>
                            <Typography variant="body2" fontWeight="600">
                              Quotes to Convert
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              Awaiting conversion
                            </Typography>
                          </Box>
                        </Box>
                        <Box sx={{ textAlign: 'right' }}>
                          <Chip 
                            label={leadFunnelData.lead_funnel.estimate_to_convert.count} 
                            color="warning" 
                            sx={{ fontWeight: 600, fontSize: '0.875rem', mb: 0.5 }}
                          />
                          <Typography variant="caption" color="warning.main" fontWeight="600" display="block">
                            {formatCurrency(leadFunnelData.lead_funnel.estimate_to_convert.total_value)}
                          </Typography>
                        </Box>
                      </Box>
                    </Box>

                    {/* Scheduled Jobs */}
                    <Box sx={{ 
                      p: 1.5, 
                      border: '1px solid', 
                      borderColor: 'divider',
                      borderRadius: 2,
                      bgcolor: 'background.paper',
                      transition: 'all 0.2s',
                      '&:hover': {
                        boxShadow: 2,
                        borderColor: 'info.main'
                      }
                    }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1.5 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0, flex: 1 }}>
                          <Box sx={{ 
                            width: 36, 
                            height: 36, 
                            borderRadius: '50%', 
                            bgcolor: 'rgba(25, 118, 210, 0.1)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                          }}>
                            <Clock sx={{ color: 'info.main', fontSize: 18 }} />
                          </Box>
                          <Box sx={{ minWidth: 0 }}>
                            <Typography variant="body2" fontWeight="600" noWrap>
                              Scheduled Jobs
                            </Typography>
                            <Typography variant="caption" color="text.secondary" display="block" noWrap>
                              Active in range (not completed)
                            </Typography>
                          </Box>
                        </Box>
                        <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
                          <Chip 
                            label={leadFunnelData.lead_funnel.scheduled_jobs.count} 
                            color="info" 
                            sx={{ fontWeight: 600, fontSize: '0.875rem', mb: 0.5 }}
                          />
                          <Typography variant="caption" color="info.main" fontWeight="600" display="block">
                            {formatCurrency(leadFunnelData.lead_funnel.scheduled_jobs.total_value)}
                          </Typography>
                        </Box>
                      </Box>
                    </Box>

                    {/* In Progress Jobs */}
                    <Box sx={{ 
                      p: 1.5, 
                      border: '1px solid', 
                      borderColor: 'divider',
                      borderRadius: 2,
                      bgcolor: 'background.paper',
                      transition: 'all 0.2s',
                      '&:hover': {
                        boxShadow: 2,
                        borderColor: 'primary.main'
                      }
                    }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                          <Box sx={{ 
                            width: 36, 
                            height: 36, 
                            borderRadius: '50%', 
                            bgcolor: 'rgba(25, 118, 210, 0.1)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}>
                            <Clock sx={{ color: 'primary.main', fontSize: 18 }} />
                          </Box>
                          <Box>
                            <Typography variant="body2" fontWeight="600">
                              {leadFunnelData.lead_funnel.in_progress_jobs.label}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              Scheduled in range, in progress
                            </Typography>
                          </Box>
                        </Box>
                        <Box sx={{ textAlign: 'right' }}>
                          <Chip 
                            label={leadFunnelData.lead_funnel.in_progress_jobs.count} 
                            color="primary" 
                            sx={{ fontWeight: 600, fontSize: '0.875rem', mb: 0.5 }}
                          />
                          <Typography variant="caption" color="primary.main" fontWeight="600" display="block">
                            {formatCurrency(leadFunnelData.lead_funnel.in_progress_jobs.total_value)}
                          </Typography>
                        </Box>
                      </Box>
                    </Box>

                    {/* Cancelled Jobs */}
                    <Box sx={{ 
                      p: 1.5, 
                      border: '1px solid', 
                      borderColor: 'divider',
                      borderRadius: 2,
                      bgcolor: 'background.paper',
                      transition: 'all 0.2s',
                      '&:hover': {
                        boxShadow: 2,
                        borderColor: 'error.main'
                      }
                    }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                          <Box sx={{ 
                            width: 36, 
                            height: 36, 
                            borderRadius: '50%', 
                            bgcolor: 'rgba(211, 47, 47, 0.1)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}>
                            <ErrorIcon sx={{ color: 'error.main', fontSize: 18 }} />
                          </Box>
                          <Box>
                            <Typography variant="body2" fontWeight="600">
                              {leadFunnelData.lead_funnel.cancelled_jobs.label}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              Cancelled + on hold, scheduled in range
                            </Typography>
                          </Box>
                        </Box>
                        <Box sx={{ textAlign: 'right' }}>
                          <Chip 
                            label={leadFunnelData.lead_funnel.cancelled_jobs.count} 
                            color="error" 
                            sx={{ fontWeight: 600, fontSize: '0.875rem', mb: 0.5 }}
                          />
                          <Typography variant="caption" color="error.main" fontWeight="600" display="block">
                            {formatCurrency(leadFunnelData.lead_funnel.cancelled_jobs.total_value)}
                          </Typography>
                        </Box>
                      </Box>
                    </Box>

                    {/* Closed Jobs */}
                    <Box sx={{ 
                      p: 1.5, 
                      border: '2px solid', 
                      borderColor: 'success.main',
                      borderRadius: 2,
                      bgcolor: 'rgba(46, 125, 50, 0.1)',
                      transition: 'all 0.2s',
                      '&:hover': {
                        boxShadow: 3,
                      }
                    }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                          <Box sx={{ 
                            width: 36, 
                            height: 36, 
                            borderRadius: '50%', 
                            bgcolor: 'success.main',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}>
                            <CheckCircle sx={{ color: 'white', fontSize: 18 }} />
                          </Box>
                          <Box>
                            <Typography variant="body2" fontWeight="600" color="success.dark">
                              {leadFunnelData.lead_funnel.closed_jobs.label}
                            </Typography>
                            <Typography variant="caption" color="success.dark">
                              Completed jobs scheduled in range
                            </Typography>
                          </Box>
                        </Box>
                        <Box sx={{ textAlign: 'right' }}>
                          <Chip 
                            label={leadFunnelData.lead_funnel.closed_jobs.count} 
                            sx={{ 
                              fontWeight: 600, 
                              fontSize: '0.875rem', 
                              mb: 0.5,
                              bgcolor: 'success.main',
                              color: 'white'
                            }}
                          />
                          <Typography variant="body2" color="success.dark" fontWeight="700" display="block">
                            {formatCurrency(leadFunnelData.lead_funnel.closed_jobs.total_value)}
                          </Typography>
                        </Box>
                      </Box>
                    </Box>
                  </Box>
                </>
              ) : (
                <Alert severity="info">No lead funnel data available</Alert>
              )}
            </CardContent>
          </Card>

          {/* Sales Forecasting */}
          <Card sx={{ mb: 3, boxShadow: 1 }}>
            <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
              <Box sx={{ mb: 2, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1 }}>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="subtitle1" fontWeight="600" gutterBottom>
                    Sales Forecasting
                  </Typography>
                  {salesForecastData && (
                    <>
                      <Typography variant="caption" color="text.secondary" display="block">
                        Data as of {format(new Date(salesForecastData.forecast_generated_at), 'MMM d, yyyy h:mm a')}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.25 }}>
                        {salesForecastData.data_source}
                      </Typography>
                      {activeAssigneeCount > 0 && (
                        <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                          Filtered: {activeAssigneeCount} active technician{activeAssigneeCount === 1 ? '' : 's'} (job totals)
                        </Typography>
                      )}
                    </>
                  )}
                </Box>
                {salesForecastData?.forecast_formula && (
                  <>
                    <IconButton
                      size="small"
                      aria-label="How sales forecast works"
                      onClick={(e) => setForecastFormulaAnchor(e.currentTarget)}
                    >
                      <InfoOutlined fontSize="small" />
                    </IconButton>
                    <Popover
                      open={Boolean(forecastFormulaAnchor)}
                      anchorEl={forecastFormulaAnchor}
                      onClose={() => setForecastFormulaAnchor(null)}
                      anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                      transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                    >
                      <Box sx={{ p: 2, maxWidth: 420 }}>
                        <Typography variant="subtitle2" fontWeight={700} gutterBottom>
                          How this works
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-wrap' }}>
                          {salesForecastData.forecast_formula}
                        </Typography>
                      </Box>
                    </Popover>
                  </>
                )}
              </Box>

              {forecastLoading ? (
                <Skeleton variant="rectangular" height={300} />
              ) : salesForecastData ? (
                <>
                  <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
                    Solid bars: completed revenue where the month has started. Dashed line: target (forecast). Shaded: prior 3 months vs
                    forward 6.
                  </Typography>
                  <ResponsiveContainer width="100%" height={isMobile ? 280 : 360}>
                    <ComposedChart data={forecastChartRows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      {forecastHistoryPlanningSplit.historyEndLabel &&
                        forecastHistoryPlanningSplit.planningStartLabel &&
                        forecastChartRows[0] && (
                          <>
                            <ReferenceArea
                              x1={forecastChartRows[0].month}
                              x2={forecastHistoryPlanningSplit.historyEndLabel}
                              fill={theme.palette.mode === 'dark' ? 'rgba(148,163,184,0.12)' : '#f1f5f9'}
                              fillOpacity={1}
                            />
                            <ReferenceArea
                              x1={forecastHistoryPlanningSplit.planningStartLabel}
                              x2={forecastChartRows[forecastChartRows.length - 1]?.month}
                              fill={theme.palette.mode === 'dark' ? 'rgba(59,130,246,0.08)' : '#eff6ff'}
                              fillOpacity={1}
                            />
                          </>
                        )}
                      <XAxis
                        dataKey="month"
                        tick={{ fontSize: isMobile ? 9 : 11 }}
                        angle={isMobile ? -45 : -30}
                        textAnchor="end"
                        height={isMobile ? 88 : 68}
                      />
                      <YAxis tick={{ fontSize: isMobile ? 10 : 12 }} tickFormatter={(v) => formatCurrency(v)} width={isMobile ? 56 : 72} />
                      <RechartsTooltip content={renderSalesForecastTooltip} />
                      <Legend wrapperStyle={{ fontSize: isMobile ? 10 : 12 }} iconSize={isMobile ? 12 : 14} />
                      <Bar dataKey="actual" name="Actual (completed)" fill="#22c55e" radius={[4, 4, 0, 0]} maxBarSize={48} />
                      <Line
                        type="monotone"
                        dataKey="forecast"
                        name="Target (forecast)"
                        stroke="#3b82f6"
                        strokeWidth={2}
                        strokeDasharray="6 4"
                        dot={{ r: 3, fill: '#3b82f6' }}
                        connectNulls
                      />
                    </ComposedChart>
                  </ResponsiveContainer>

                  <Box sx={{ mt: 3 }}>
                    <Typography variant="subtitle2" fontWeight="600" gutterBottom>
                      Monthly breakdown (same data as chart)
                    </Typography>
                    <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
                      Screen reader summary: month, target, actual, variance vs target. Colors are supplemented with signed amounts.
                    </Typography>
                    <TableContainer component={Paper} variant="outlined" sx={{ mt: 1, overflowX: 'auto' }}>
                      <Table size="small">
                        <TableHead>
                          <TableRow sx={{ bgcolor: '#f9fafb' }}>
                            <TableCell sx={{ fontWeight: 600, fontSize: { xs: '0.7rem', sm: '0.75rem' } }}>Month</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 600, fontSize: { xs: '0.7rem', sm: '0.75rem' } }}>
                              Segment
                            </TableCell>
                            <TableCell align="right" sx={{ fontWeight: 600, fontSize: { xs: '0.7rem', sm: '0.75rem' } }}>
                              Target
                            </TableCell>
                            <TableCell align="right" sx={{ fontWeight: 600, fontSize: { xs: '0.7rem', sm: '0.75rem' } }}>
                              Lock
                            </TableCell>
                            <TableCell align="right" sx={{ fontWeight: 600, fontSize: { xs: '0.7rem', sm: '0.75rem' } }}>
                              Pipeline
                            </TableCell>
                            <TableCell align="right" sx={{ fontWeight: 600, fontSize: { xs: '0.7rem', sm: '0.75rem' } }}>
                              Actual
                            </TableCell>
                            <TableCell align="right" sx={{ fontWeight: 600, fontSize: { xs: '0.7rem', sm: '0.75rem' } }}>
                              vs target
                            </TableCell>
                            <TableCell align="right" sx={{ fontWeight: 600, fontSize: { xs: '0.7rem', sm: '0.75rem' } }}>
                              % vs target
                            </TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {salesForecastData.months.map((month, index) => {
                            const pct = formatVariancePercentOnly(month.variance_percent, month.forecast);
                            const varTone =
                              month.variance == null
                                ? 'text.secondary'
                                : month.variance > 0
                                  ? 'success.main'
                                  : month.variance < 0
                                    ? 'error.main'
                                    : 'text.secondary';
                            return (
                              <TableRow key={`${month.year}-${month.month}-${index}`} hover>
                                <TableCell sx={{ fontSize: { xs: '0.7rem', sm: '0.75rem' } }}>{month.month_label}</TableCell>
                                <TableCell align="right">
                                  <Chip
                                    label={month.type === 'actual' ? 'History' : 'Plan'}
                                    size="small"
                                    color={month.type === 'actual' ? 'success' : 'primary'}
                                    variant="outlined"
                                    sx={{
                                      height: isMobile ? 18 : 20,
                                      fontSize: isMobile ? '0.6rem' : '0.65rem',
                                    }}
                                  />
                                </TableCell>
                                <TableCell align="right" sx={{ fontSize: { xs: '0.7rem', sm: '0.75rem' }, fontWeight: 600 }}>
                                  {formatCurrency(month.forecast)}
                                </TableCell>
                                <TableCell align="right" sx={{ fontSize: { xs: '0.7rem', sm: '0.75rem' } }}>
                                  <Chip
                                    label={month.forecast_is_locked ? 'Locked' : 'Projected'}
                                    size="small"
                                    sx={{ height: isMobile ? 18 : 20, fontSize: isMobile ? '0.6rem' : '0.65rem' }}
                                  />
                                </TableCell>
                                <TableCell align="right" sx={{ fontSize: { xs: '0.7rem', sm: '0.75rem' } }}>
                                  {formatCurrency(month.scheduled_revenue_total ?? month.scheduled_revenue)}
                                  <Typography variant="caption" color="text.secondary" display="block">
                                    {month.scheduled_job_count_total ?? '—'} jobs
                                  </Typography>
                                </TableCell>
                                <TableCell
                                  align="right"
                                  sx={{
                                    fontSize: { xs: '0.7rem', sm: '0.75rem' },
                                    fontWeight: 600,
                                    color: month.actual != null ? 'text.primary' : 'text.secondary',
                                  }}
                                >
                                  {month.actual != null ? (
                                    <>
                                      {formatCurrency(month.actual)}
                                      <Typography variant="caption" color="text.secondary" display="block">
                                        {month.actual_job_count ?? '—'} jobs
                                      </Typography>
                                    </>
                                  ) : (
                                    '—'
                                  )}
                                </TableCell>
                                <TableCell
                                  align="right"
                                  sx={{
                                    fontSize: { xs: '0.7rem', sm: '0.75rem' },
                                    fontWeight: 600,
                                    color: varTone,
                                  }}
                                >
                                  {month.variance != null ? `${formatSignedCurrency(month.variance)} vs target` : '—'}
                                </TableCell>
                                <TableCell align="right" sx={{ fontSize: { xs: '0.7rem', sm: '0.75rem' }, color: varTone }}>
                                  {pct != null ? `${pct} vs target` : month.forecast === 0 ? 'N/A' : '—'}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </Box>
                </>
              ) : (
                <Alert severity="info">No forecasting data available</Alert>
              )}
            </CardContent>
          </Card>

        {/* Technician Workload Heatmap - Responsive */}
        {heatmapData && (
          <Card sx={{ boxShadow: 1 }}>
            <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle1" fontWeight="600" gutterBottom>
                  Sales Activities by Representative (Next 7 Days)
                </Typography>
                <Typography variant="caption" color="text.secondary" display="block">
                  Daily job distribution and sales by technician
                </Typography>
              </Box>

              {/* Legend - Responsive */}
              <Paper sx={{ p: 2, mb: 3, bgcolor: '#f9fafb' }}>
                <Typography variant="caption" fontWeight="600" textAlign="center" display="block" gutterBottom>
                  Job Load Intensity
                </Typography>
                <Box sx={{ 
                  display: 'flex', 
                  justifyContent: 'center', 
                  gap: { xs: 1.5, sm: 3 }, 
                  flexWrap: 'wrap' 
                }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Box sx={{ width: { xs: 16, sm: 20 }, height: { xs: 16, sm: 20 }, bgcolor: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 0.5 }} />
                    <Typography variant="caption" sx={{ fontSize: { xs: '0.65rem', sm: '0.75rem' } }}>No jobs</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Box sx={{ width: { xs: 16, sm: 20 }, height: { xs: 16, sm: 20 }, bgcolor: 'rgba(34, 197, 94, 0.4)', border: '1px solid #e2e8f0', borderRadius: 0.5 }} />
                    <Typography variant="caption" sx={{ fontSize: { xs: '0.65rem', sm: '0.75rem' } }}>Light (1-2)</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Box sx={{ width: { xs: 16, sm: 20 }, height: { xs: 16, sm: 20 }, bgcolor: 'rgba(251, 191, 36, 0.6)', border: '1px solid #e2e8f0', borderRadius: 0.5 }} />
                    <Typography variant="caption" sx={{ fontSize: { xs: '0.65rem', sm: '0.75rem' } }}>Moderate (3-4)</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Box sx={{ width: { xs: 16, sm: 20 }, height: { xs: 16, sm: 20 }, bgcolor: 'rgba(239, 68, 68, 0.8)', border: '1px solid #e2e8f0', borderRadius: 0.5 }} />
                    <Typography variant="caption" sx={{ fontSize: { xs: '0.65rem', sm: '0.75rem' } }}>Heavy (5+)</Typography>
                  </Box>
                </Box>
              </Paper>

              {/* Heatmap Grid - Responsive */}
              <Box sx={{ overflowX: 'auto' }}>
                {heatmapLoading ? (
                  <Skeleton variant="rectangular" height={200} />
                ) : heatmapData?.technicians?.length > 0 ? (
                  <Box sx={{ minWidth: { xs: 400, sm: 500, md: 600 } }}>
                    {heatmapData.technicians.map((tech) => (
                      <Box key={tech.technician_id} sx={{ mb: 2 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1, px: 0.5 }}>
                          <Typography variant="body2" fontWeight="600" sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>
                            {tech.technician_name}
                          </Typography>
                          <Typography variant="body2" color="success.main" fontWeight="700" sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>
                            {formatCurrency(tech.total_value)}
                          </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', gap: 0.5 }}>
                          {tech.days.map((day, idx) => (
                            <Box
                              key={idx}
                              sx={{
                                flex: 1,
                                minWidth: { xs: 45, sm: 55 },
                                height: { xs: 50, sm: 60 },
                                bgcolor: getLoadLevelColor(day.load_level),
                                border: '1px solid #e2e8f0',
                                borderRadius: 1,
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                '&:hover': {
                                  transform: 'scale(1.05)',
                                  boxShadow: 1,
                                },
                              }}
                              title={`${day.label}: ${day.job_count} jobs, ${formatCurrency(day.total_value)}`}
                            >
                              <Typography variant="caption" color="text.secondary" sx={{ fontSize: { xs: 8, sm: 9 } }}>
                                {day.label.split(' ')[1]}
                              </Typography>
                              {day.job_count > 0 && (
                                <>
                                  <Typography variant="body2" fontWeight="700" sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>
                                    {day.job_count}
                                  </Typography>
                                  <Typography variant="caption" color="success.main" fontWeight="700" sx={{ fontSize: { xs: 8, sm: 9 } }}>
                                    {formatCurrency(day.total_value)}
                                  </Typography>
                                </>
                              )}
                            </Box>
                          ))}
                        </Box>
                      </Box>
                    ))}
                  </Box>
                ) : (
                  <Alert severity="info" sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>
                    No scheduled jobs found for the next 7 days
                  </Alert>
                )}
              </Box>

              {heatmapData?.summary && (
                <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block', fontSize: { xs: '0.65rem', sm: '0.75rem' } }}>
                  Total: {heatmapData.summary.total_jobs} jobs worth {formatCurrency(heatmapData.summary.total_value)}
                </Typography>
              )}
            </CardContent>
          </Card>
        )}

        <Card sx={{ mt: 3, boxShadow: 1 }}>
          <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
            <Typography variant="subtitle1" fontWeight="600" gutterBottom>
              Top Customers
            </Typography>
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 2 }}>
              Highest revenue generating customers
            </Typography>
            <TableContainer>
              <Table size={isMobile ? 'small' : 'medium'}>
                <TableHead>
                  <TableRow sx={{ bgcolor: '#f9fafb' }}>
                    <TableCell sx={{ fontWeight: 600, fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>Name</TableCell>
                    {!isMobile && <TableCell sx={{ fontWeight: 600, fontSize: '0.875rem' }}>Email</TableCell>}
                    <TableCell align="right" sx={{ fontWeight: 600, fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>Invoiced</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 600, fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>Count</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 600, fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>Paid</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {analyticsData?.top_customers?.slice(0, 5).map((customer, index) => (
                    <TableRow key={index} hover>
                      <TableCell sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>
                        {isMobile ? customer.contact_name.split(' ')[0] : customer.contact_name}
                      </TableCell>
                      {!isMobile && (
                        <TableCell sx={{ color: 'text.secondary', fontSize: '0.875rem' }}>
                          {customer.contact_email}
                        </TableCell>
                      )}
                      <TableCell align="right" sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>
                        {isMobile ? formatMoneyCompact(customer.total_invoiced) : formatCurrency(customer.total_invoiced)}
                      </TableCell>
                      <TableCell align="right">
                        <Chip 
                          label={customer.invoices_count} 
                          size="small"
                          sx={{ 
                            height: isMobile ? 20 : 24,
                            fontSize: isMobile ? '0.65rem' : '0.75rem'
                          }}
                        />
                      </TableCell>
                      <TableCell align="right" sx={{ color: 'success.main', fontWeight: 600, fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>
                        {isMobile ? formatMoneyCompact(customer.total_paid) : formatCurrency(customer.total_paid)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
          
      </Box>
    </LocalizationProvider>
  );
};

export default AdminDashboard;