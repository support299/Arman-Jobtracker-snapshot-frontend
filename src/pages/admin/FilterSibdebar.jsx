import { useState, useEffect } from "react"
import {
  Drawer,
  Box,
  Typography,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  IconButton,
  Divider,
  Chip,
  InputAdornment,
  Checkbox,
  FormControlLabel,
} from "@mui/material"
import {
  Close as CloseIcon,
  Search as SearchIcon,
  FilterList as FilterIcon,
} from "@mui/icons-material"

const STATUS_CHOICES = [
  { value: 'pending', label: 'Pending' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'service_due', label: 'Service Due' },
  { value: 'on_the_way', label: 'On The Way' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'onhold', label: 'On Hold' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
]

const JOB_TYPE_CHOICES = [
  { value: 'one_time', label: 'One Time' },
  { value: 'recurring', label: 'Recurring' },
]

const ESTIMATE_STATUS_CHOICES = [
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'on_my_way', label: 'On My Way' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'quoted', label: 'Quoted' },
  { value: 'canceled', label: 'Canceled' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'declined', label: 'Declined' },
  { value: 'expired', label: 'Expired' },
]

export function FilterSidebar({ 
  open, 
  onClose, 
  onApplyFilters,
  assignees = [],
  initialFilters = {},
  userRole = "worker",
  mode = "jobs", // "jobs" = Jobs page only, "map" = Jobs + Estimates like calendar
  selectedCategories = {},
  onCategoryToggle,
}) {
  // Parse assignee_ids from API format "[34,56]" or array -> array of user_id (number).
  // API expects user_id (integer), not UUID id.
  const parseAssigneeIds = (assigneeIds) => {
    if (Array.isArray(assigneeIds)) {
      return assigneeIds.map((id) => (typeof id === 'number' ? id : parseInt(String(id), 10))).filter((id) => !isNaN(id));
    }
    if (typeof assigneeIds === 'string') {
      const cleaned = assigneeIds.replace(/[\[\]]/g, '');
      return cleaned
        ? cleaned.split(',').map((id) => parseInt(id.trim(), 10)).filter((id) => !isNaN(id))
        : [];
    }
    return [];
  };

  const isMapMode = mode === "map";

  const [filters, setFilters] = useState(() => {
    const base = {
      search: '',
      status: '',
      job_status: initialFilters.job_status || '',
      estimate_status: initialFilters.estimate_status || '',
      job_type: '',
      unassigned: initialFilters.unassigned === true || initialFilters.unassigned === 'true',
      assignee_ids: parseAssigneeIds(initialFilters.assignee_ids || []),
    };
    if (isMapMode) {
      return {
        ...base,
        job_search: initialFilters.job_search || initialFilters.search || '',
        estimate_search: initialFilters.estimate_search || '',
      };
    }
    return {
      ...base,
      search: initialFilters.search || '',
    };
  })

  useEffect(() => {
    if (open && initialFilters) {
      const base = {
        status: initialFilters.status || '',
        job_status: initialFilters.job_status || '',
        estimate_status: initialFilters.estimate_status || '',
        job_type: initialFilters.job_type || '',
        unassigned: initialFilters.unassigned === true || initialFilters.unassigned === 'true',
        assignee_ids: parseAssigneeIds(initialFilters.assignee_ids || []),
      };
      if (isMapMode) {
        setFilters({
          ...base,
          search: '',
          job_search: initialFilters.job_search || initialFilters.search || '',
          estimate_search: initialFilters.estimate_search || '',
        });
      } else {
        setFilters({
          ...base,
          search: initialFilters.search || '',
          job_search: '',
          estimate_search: '',
        });
      }
    }
  }, [open, initialFilters, isMapMode])

  const handleFilterChange = (field, value) => {
    setFilters(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const handleApply = () => {
    const params = {};
    if (isMapMode) {
      if (filters.job_search) params.job_search = filters.job_search;
      if (filters.job_status) params.job_status = filters.job_status;
      if (filters.estimate_search) params.estimate_search = filters.estimate_search;
      if (filters.estimate_status) params.estimate_status = filters.estimate_status;
      if (filters.job_type) params.job_type = filters.job_type;
    } else {
      if (filters.search) params.search = filters.search;
      if (filters.status) params.status = filters.status;
      if (filters.job_type) params.job_type = filters.job_type;
    }
    if (filters.unassigned) params.unassigned = true;
    if (userRole !== "worker" && filters.assignee_ids.length > 0) {
      const joined = filters.assignee_ids.join(",");
      params.assignee_ids = `[${joined}]`;
      if (isMapMode) {
        params.assigned_user_ids = joined;
      }
    }
    onApplyFilters(params);
    onClose();
  };

  const handleClear = () => {
    const defaultAssigneeIds =
      userRole !== "worker"
        ? assignees.map((assignee) => assignee.user_id ?? assignee.id).filter(Boolean)
        : [];
    const clearedFilters = {
      search: "",
      status: "",
      job_status: "",
      estimate_status: "",
      job_type: "",
      unassigned: false,
      job_search: "",
      estimate_search: "",
      assignee_ids: defaultAssigneeIds,
    };
    setFilters(clearedFilters);
    if (userRole !== "worker" && defaultAssigneeIds.length > 0) {
      const joined = defaultAssigneeIds.join(",");
      onApplyFilters({
        assignee_ids: `[${joined}]`,
        ...(isMapMode ? { assigned_user_ids: joined } : {}),
      });
    } else {
      onApplyFilters({});
    }
    if (isMapMode && onCategoryToggle) {
      onCategoryToggle("jobs", true);
      onCategoryToggle("estimates", true);
      onCategoryToggle("vehicles", true);
    }
  };

  const activeFilterCount = isMapMode
    ? (filters.job_search ? 1 : 0) +
      (filters.estimate_search ? 1 : 0) +
      (filters.job_status ? 1 : 0) +
      (filters.estimate_status ? 1 : 0) +
      (filters.job_type ? 1 : 0) +
      (filters.unassigned ? 1 : 0) +
      (userRole !== "worker" && filters.assignee_ids.length > 0 ? 1 : 0)
    : (filters.search ? 1 : 0) +
      (filters.status ? 1 : 0) +
      (filters.job_type ? 1 : 0) +
      (filters.unassigned ? 1 : 0) +
      (userRole !== "worker" && filters.assignee_ids.length > 0 ? 1 : 0);

  const allAssigneeIds = assignees.map((assignee) => assignee.user_id ?? assignee.id).filter(Boolean);
  const allAssigneesSelected = allAssigneeIds.length > 0 && allAssigneeIds.every((id) => filters.assignee_ids.includes(id));
  const someAssigneesSelected = filters.assignee_ids.length > 0 && !allAssigneesSelected;

  const handleToggleSelectAllAssignees = (checked) => {
    if (checked) {
      handleFilterChange('assignee_ids', allAssigneeIds);
      return;
    }
    handleFilterChange('assignee_ids', []);
  };

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: { 
          width: { xs: '100%', sm: 400 },
          zIndex: 1200, // Modal layer
        }
      }}
    >
      <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <Box
          sx={{
            p: 2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: 1,
            borderColor: 'divider'
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <FilterIcon color="primary" />
            <Typography variant="h6">
              Manage Filters
            </Typography>
            {activeFilterCount > 0 && (
              <Chip 
                label={activeFilterCount} 
                size="small" 
                color="primary"
              />
            )}
          </Box>
          <IconButton onClick={onClose} edge="end">
            <CloseIcon />
          </IconButton>
        </Box>

        {/* Filters Content */}
        <Box sx={{ flex: 1, overflowY: 'auto', p: 3 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {/* Map mode: Categories (Jobs / Estimates) */}
            {isMapMode && onCategoryToggle && (
              <>
                <Box>
                  <Typography variant="subtitle2" gutterBottom fontWeight="medium">
                    Show on map
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={selectedCategories?.jobs !== false}
                          onChange={(e) => onCategoryToggle('jobs', e.target.checked)}
                        />
                      }
                      label="Jobs"
                    />
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={selectedCategories?.estimates !== false}
                          onChange={(e) => onCategoryToggle('estimates', e.target.checked)}
                        />
                      }
                      label="Estimates"
                    />
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={selectedCategories?.vehicles !== false}
                          onChange={(e) => onCategoryToggle('vehicles', e.target.checked)}
                        />
                      }
                      label="Live vehicles (One Step GPS)"
                    />
                  </Box>
                </Box>
                <Divider />
              </>
            )}

            {/* Search - single for jobs mode, split for map mode */}
            {isMapMode ? (
              <>
                <Box>
                  <Typography variant="subtitle2" gutterBottom fontWeight="medium">
                    Search Jobs
                  </Typography>
                  <TextField
                    fullWidth
                    placeholder="Title, customer, address..."
                    value={filters.job_search}
                    onChange={(e) => handleFilterChange('job_search', e.target.value)}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <SearchIcon />
                        </InputAdornment>
                      ),
                    }}
                  />
                </Box>
                <Box>
                  <Typography variant="subtitle2" gutterBottom fontWeight="medium">
                    Search Estimates
                  </Typography>
                  <TextField
                    fullWidth
                    placeholder="Title, notes..."
                    value={filters.estimate_search}
                    onChange={(e) => handleFilterChange('estimate_search', e.target.value)}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <SearchIcon />
                        </InputAdornment>
                      ),
                    }}
                  />
                </Box>
              </>
            ) : (
              <Box>
                <Typography variant="subtitle2" gutterBottom fontWeight="medium">
                  Search
                </Typography>
                <TextField
                  fullWidth
                  placeholder="Search jobs, customers..."
                  value={filters.search}
                  onChange={(e) => handleFilterChange('search', e.target.value)}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon />
                      </InputAdornment>
                    ),
                  }}
                />
              </Box>
            )}

            <Divider />

            {/* Status Filter - Job Status for map mode, single Status for jobs mode */}
            <Box>
              <Typography variant="subtitle2" gutterBottom fontWeight="medium">
                {isMapMode ? 'Job Status' : 'Status'}
              </Typography>
              <FormControl fullWidth>
                <Select
                  value={isMapMode ? filters.job_status : filters.status}
                  onChange={(e) => handleFilterChange(isMapMode ? 'job_status' : 'status', e.target.value)}
                  displayEmpty
                >
                  <MenuItem value="">
                    <em>All Statuses</em>
                  </MenuItem>
                  {STATUS_CHOICES.map((status) => (
                    <MenuItem key={status.value} value={status.value}>
                      {status.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>

            {/* Estimate Status - map mode only */}
            {isMapMode && (
              <Box>
                <Typography variant="subtitle2" gutterBottom fontWeight="medium">
                  Estimate Status
                </Typography>
                <FormControl fullWidth>
                  <Select
                    value={filters.estimate_status}
                    onChange={(e) => handleFilterChange('estimate_status', e.target.value)}
                    displayEmpty
                  >
                    <MenuItem value="">
                      <em>All Statuses</em>
                    </MenuItem>
                    {ESTIMATE_STATUS_CHOICES.map((status) => (
                      <MenuItem key={status.value} value={status.value}>
                        {status.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Box>
            )}

            {/* Job Type Filter */}
            <Box>
              <Typography variant="subtitle2" gutterBottom fontWeight="medium">
                Job Type
              </Typography>
              <FormControl fullWidth>
                <Select
                  value={filters.job_type}
                  onChange={(e) => handleFilterChange('job_type', e.target.value)}
                  displayEmpty
                  aria-label="Filter by job type"
                  sx={{
                    minHeight: '44px',
                  }}
                >
                  <MenuItem value="">
                    <em>All Types</em>
                  </MenuItem>
                  {JOB_TYPE_CHOICES.map((type) => (
                    <MenuItem key={type.value} value={type.value}>
                      {type.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>

            <Box>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={Boolean(filters.unassigned)}
                    onChange={(e) => handleFilterChange('unassigned', e.target.checked)}
                  />
                }
                label="Show only unassigned jobs"
              />
            </Box>

            {/* Assignee Filter - Only visible for non-worker roles */}
            {userRole !== "worker" && (
              <>
                <Divider />
                <Box>
                  <Typography variant="subtitle2" gutterBottom fontWeight="medium">
                    Assignees
                  </Typography>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={allAssigneesSelected}
                        indeterminate={someAssigneesSelected}
                        onChange={(e) => handleToggleSelectAllAssignees(e.target.checked)}
                      />
                    }
                    label={allAssigneesSelected ? "Deselect All" : "Select All"}
                  />
                  <FormControl fullWidth>
                    <Select
                      multiple
                      value={filters.assignee_ids}
                      onChange={(e) => handleFilterChange('assignee_ids', e.target.value)}
                      displayEmpty
                      renderValue={(selected) => {
                        if (selected.length === 0) {
                          return <em>All Assignees</em>
                        }
                        return (
                          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                            {selected.map((userId) => {
                              const assignee = assignees.find(a => a.user_id === userId || a.id === userId)
                              return (
                                <Chip
                                  key={userId}
                                  label={assignee ? `${assignee.first_name || ''} ${assignee.last_name || ''}`.trim() || 'Unknown' : userId}
                                  size="small"
                                />
                              )
                            })}
                          </Box>
                        )
                      }}
                    >
                      {assignees.map((assignee) => (
                        <MenuItem key={assignee.id} value={assignee.user_id ?? assignee.id}>
                          {assignee.first_name} {assignee?.last_name}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Box>
              </>
            )}
          </Box>
        </Box>

        {/* Footer Actions */}
        <Box
          sx={{
            p: 2,
            borderTop: 1,
            borderColor: 'divider',
            display: 'flex',
            gap: 2
          }}
        >
          <Button
            variant="outlined"
            fullWidth
            onClick={handleClear}
          >
            Clear All
          </Button>
          <Button
            variant="contained"
            fullWidth
            onClick={handleApply}
          >
            Apply Filters
          </Button>
        </Box>
      </Box>
    </Drawer>
  )
}