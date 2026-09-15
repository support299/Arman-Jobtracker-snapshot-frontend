import { useMemo, useState } from "react";
import {
  Box,
  Typography,
  TextField,
  InputAdornment,
  Tabs,
  Tab,
  CircularProgress,
} from "@mui/material";
import {
  Search as SearchIcon,
  WarningAmber as WarningIcon,
  PowerSettingsNew as PowerIcon,
  Speed as SpeedIcon,
  NotificationsActive as AlertIcon,
} from "@mui/icons-material";
import {
  useGetRecentAlertsQuery,
  useGetAlertCountsQuery,
} from "../../../store/api/onestepgpsApi";

function formatAlertTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleString(undefined, {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  });
}

function alertIcon(name = "") {
  const n = name.toLowerCase();
  if (n.includes("harsh") || n.includes("braking") || n.includes("speeding")) {
    return <WarningIcon sx={{ fontSize: 18, color: "#EA580C" }} />;
  }
  if (n.includes("engine") || n.includes("ignition")) {
    return <PowerIcon sx={{ fontSize: 18, color: "#EA580C" }} />;
  }
  if (n.includes("speed")) {
    return <SpeedIcon sx={{ fontSize: 18, color: "#EA580C" }} />;
  }
  return <AlertIcon sx={{ fontSize: 18, color: "#EA580C" }} />;
}

function RecentRow({ alert, selected, onClick }) {
  return (
    <Box
      component="button"
      type="button"
      onClick={onClick}
      sx={{
        all: "unset",
        display: "flex",
        gap: 1.25,
        width: "100%",
        boxSizing: "border-box",
        cursor: onClick ? "pointer" : "default",
        px: 1.5,
        py: 1.25,
        borderBottom: "1px solid",
        borderColor: "rgba(15, 35, 55, 0.06)",
        bgcolor: selected ? "rgba(15, 76, 129, 0.06)" : "transparent",
        "&:hover": onClick
          ? { bgcolor: selected ? "rgba(15, 76, 129, 0.08)" : "rgba(15, 76, 129, 0.03)" }
          : undefined,
      }}
    >
      <Box
        sx={{
          mt: 0.15,
          width: 28,
          height: 28,
          borderRadius: "50%",
          display: "grid",
          placeItems: "center",
          bgcolor: "rgba(234, 88, 12, 0.1)",
          flexShrink: 0,
        }}
      >
        {alertIcon(alert.alert_name)}
      </Box>
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography variant="subtitle2" sx={{ color: "text.primary", lineHeight: 1.3 }}>
          {alert.alert_name || "Alert"}
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.2 }}>
          {alert.device_name || alert.device_id || "Device"}
        </Typography>
        <Typography variant="caption" color="text.disabled" sx={{ display: "block", mt: 0.15 }}>
          {formatAlertTime(alert.alert_time || alert.created_at)}
        </Typography>
      </Box>
    </Box>
  );
}

function CountRow({ row }) {
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "flex-start",
        gap: 1.5,
        px: 1.5,
        py: 1.35,
        borderBottom: "1px solid",
        borderColor: "rgba(15, 35, 55, 0.06)",
      }}
    >
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="subtitle2">{row.alert_name}</Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.25 }}>
          Last event at {formatAlertTime(row.last_event_at)}
        </Typography>
      </Box>
      <Typography variant="subtitle1" fontWeight={700} sx={{ lineHeight: 1.2, minWidth: 28, textAlign: "right" }}>
        {row.count}
      </Typography>
    </Box>
  );
}

/**
 * Recent / Counts alert feed for map sidebar.
 */
export default function MapAlertsPanel({ onFocusAlert }) {
  const [tab, setTab] = useState(0);
  const [query, setQuery] = useState("");

  const search = query.trim();
  const {
    data: recentData,
    isLoading: recentLoading,
    isFetching: recentFetching,
  } = useGetRecentAlertsQuery(
    { limit: 100, ...(search ? { search } : {}) },
    { pollingInterval: 30000 }
  );
  const {
    data: countsData,
    isLoading: countsLoading,
    isFetching: countsFetching,
  } = useGetAlertCountsQuery(
    { days: 7, ...(search ? { search } : {}) },
    { pollingInterval: 30000 }
  );

  const recent = recentData?.results || [];
  const counts = countsData?.results || [];
  const loading = tab === 0 ? recentLoading : countsLoading;
  const fetching = tab === 0 ? recentFetching : countsFetching;

  const emptyCopy = useMemo(() => {
    if (search) return `No alerts match “${search}”.`;
    return "No alerts yet. Add the webhook URL in One Step GPS to start receiving events.";
  }, [search]);

  return (
    <Box sx={{ height: "100%", display: "flex", flexDirection: "column", bgcolor: "#FFFFFF" }}>
      <Box sx={{ px: 2, pt: 1.5, pb: 1, borderBottom: "1px solid", borderColor: "divider" }}>
        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          sx={{
            minHeight: 36,
            mb: 1,
            "& .MuiTab-root": {
              minHeight: 36,
              textTransform: "none",
              fontWeight: 700,
              fontSize: "0.8rem",
              letterSpacing: "0.02em",
            },
          }}
        >
          <Tab label="Recent" />
          <Tab label="Counts" />
        </Tabs>
        <TextField
          fullWidth
          size="small"
          placeholder={tab === 0 ? "Search alerts…" : "Filter by alert name…"}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon sx={{ fontSize: 18, color: "text.disabled" }} />
              </InputAdornment>
            ),
          }}
        />
      </Box>

      <Box sx={{ flex: 1, overflowY: "auto", position: "relative" }}>
        {(loading || fetching) && (
          <Box sx={{ position: "absolute", top: 8, right: 10, zIndex: 1 }}>
            <CircularProgress size={16} />
          </Box>
        )}

        {tab === 0 && !loading && recent.length === 0 && (
          <Box sx={{ px: 2, py: 4, textAlign: "center" }}>
            <Typography variant="body2" color="text.secondary">
              {emptyCopy}
            </Typography>
          </Box>
        )}

        {tab === 0 &&
          recent.map((alert) => (
            <RecentRow
              key={alert.id}
              alert={alert}
              onClick={
                alert.latitude != null && alert.longitude != null
                  ? () => onFocusAlert?.(alert)
                  : undefined
              }
            />
          ))}

        {tab === 1 && !loading && counts.length === 0 && (
          <Box sx={{ px: 2, py: 4, textAlign: "center" }}>
            <Typography variant="body2" color="text.secondary">
              {emptyCopy}
            </Typography>
          </Box>
        )}

        {tab === 1 && counts.map((row) => <CountRow key={row.alert_name} row={row} />)}
      </Box>
    </Box>
  );
}
