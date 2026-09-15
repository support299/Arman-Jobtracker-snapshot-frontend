import { useMemo, useState } from "react";
import {
  Box,
  Typography,
  TextField,
  InputAdornment,
  Tabs,
  Tab,
  Chip,
  IconButton,
  Tooltip,
} from "@mui/material";
import {
  Search as SearchIcon,
  NearMe as NearMeIcon,
  Bolt as BoltIcon,
  DirectionsCar as CarIcon,
} from "@mui/icons-material";
import MapAlertsPanel from "./MapAlertsPanel";

function formatRelative(iso) {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return String(iso);
  const sec = Math.max(0, (Date.now() - t) / 1000);
  if (sec < 60) return `${Math.round(sec)}s ago`;
  if (sec < 3600) return `${Math.round(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.round(sec / 3600)}h ago`;
  return `${Math.round(sec / 86400)}d ago`;
}

function formatSpeed(speed) {
  if (speed == null || Number.isNaN(Number(speed))) return null;
  const n = Number(speed);
  return `${Math.round(n)} mph`;
}

function vehicleStatusLine(v) {
  const status = (v.drive_status || (v.online ? "Online" : "Offline")).toString();
  const duration = v.status_duration_label;
  if (duration) return `${status} ${duration}`;
  return status;
}

function isMoving(v) {
  const speed = Number(v.speed_mph);
  if (!Number.isNaN(speed) && speed >= 3) return true;
  const s = String(v.drive_status || "").toLowerCase();
  return s.includes("driv") || s.includes("mov");
}

function statusAccent(v) {
  if (!v.online) return "#94A3B8";
  if (v.external_voltage != null && Number(v.external_voltage) < 1) return "#EF4444";
  if (isMoving(v)) return "#22C55E";
  return "#F59E0B";
}

const STATUS_COLORS = {
  pending: "#D97706",
  confirmed: "#0284C7",
  service_due: "#7C3AED",
  on_the_way: "#EA580C",
  in_progress: "#2563EB",
  onhold: "#64748B",
  completed: "#059669",
  cancelled: "#DC2626",
};

function ListRow({ title, subtitle, meta, accent, selected, onClick, trailing }) {
  return (
    <Box
      component="button"
      type="button"
      onClick={onClick}
      sx={{
        all: "unset",
        display: "block",
        width: "100%",
        boxSizing: "border-box",
        cursor: "pointer",
        px: 1.5,
        py: 1.25,
        borderRadius: 2,
        border: "1px solid",
        borderColor: selected ? "secondary.main" : "transparent",
        backgroundColor: selected ? "rgba(13, 148, 136, 0.08)" : "transparent",
        transition: "background-color 120ms ease, border-color 120ms ease",
        "&:hover": {
          backgroundColor: selected ? "rgba(13, 148, 136, 0.1)" : "rgba(15, 76, 129, 0.04)",
        },
      }}
    >
      <Box sx={{ display: "flex", gap: 1.25, alignItems: "flex-start" }}>
        <Box
          sx={{
            mt: 0.35,
            width: 8,
            height: 8,
            borderRadius: "50%",
            flexShrink: 0,
            bgcolor: accent || "text.disabled",
          }}
        />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography
            variant="subtitle2"
            sx={{
              color: "text.primary",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {title}
          </Typography>
          {subtitle && (
            <Typography
              variant="caption"
              sx={{
                display: "block",
                color: "text.secondary",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                mt: 0.25,
              }}
            >
              {subtitle}
            </Typography>
          )}
          {meta && (
            <Typography variant="caption" sx={{ display: "block", color: "text.disabled", mt: 0.35 }}>
              {meta}
            </Typography>
          )}
        </Box>
        {trailing}
      </Box>
    </Box>
  );
}

function VehicleCard({ vehicle, address, selected, onClick, onFocus }) {
  const accent = statusAccent(vehicle);
  const speed = formatSpeed(vehicle.speed_mph);
  const moving = isMoving(vehicle);
  const addr = address || vehicle.address;

  return (
    <Box
      component="button"
      type="button"
      onClick={onClick}
      sx={{
        all: "unset",
        display: "block",
        width: "100%",
        boxSizing: "border-box",
        cursor: "pointer",
        px: 1.5,
        py: 1.35,
        mb: 0.75,
        borderRadius: 2,
        border: "1px solid",
        borderColor: selected ? "rgba(13, 148, 136, 0.45)" : "rgba(15, 35, 55, 0.08)",
        backgroundColor: selected ? "rgba(13, 148, 136, 0.07)" : "#FFFFFF",
        boxShadow: selected ? "none" : "0 1px 2px rgba(11, 23, 38, 0.04)",
        transition: "border-color 120ms ease, background-color 120ms ease",
        "&:hover": {
          borderColor: "rgba(15, 76, 129, 0.28)",
          backgroundColor: selected ? "rgba(13, 148, 136, 0.09)" : "rgba(15, 76, 129, 0.03)",
        },
      }}
    >
      <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1 }}>
        <Box
          sx={{
            mt: 0.15,
            width: 28,
            height: 28,
            borderRadius: "50%",
            display: "grid",
            placeItems: "center",
            flexShrink: 0,
            bgcolor: moving ? "rgba(34, 197, 94, 0.12)" : "rgba(148, 163, 184, 0.16)",
            color: accent,
          }}
        >
          {vehicle.external_voltage != null && Number(vehicle.external_voltage) < 1 ? (
            <BoltIcon sx={{ fontSize: 16, color: "#EF4444" }} />
          ) : (
            <CarIcon sx={{ fontSize: 16 }} />
          )}
        </Box>

        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, minWidth: 0 }}>
            <Typography
              variant="subtitle2"
              sx={{
                flex: 1,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                color: "text.primary",
              }}
            >
              {vehicle.display_name || "Vehicle"}
            </Typography>
            {speed && moving && (
              <Chip
                size="small"
                label={speed}
                sx={{
                  height: 20,
                  fontSize: "0.65rem",
                  fontWeight: 700,
                  bgcolor: "rgba(34, 197, 94, 0.12)",
                  color: "#15803D",
                }}
              />
            )}
          </Box>

          <Typography
            variant="caption"
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 0.5,
              mt: 0.35,
              color: accent,
              fontWeight: 600,
            }}
          >
            <Box
              component="span"
              sx={{
                width: 7,
                height: 7,
                borderRadius: "50%",
                bgcolor: accent,
                display: "inline-block",
              }}
            />
            {vehicleStatusLine(vehicle)}
          </Typography>

          {vehicle.technician_name && (
            <Typography variant="caption" sx={{ display: "block", mt: 0.3, color: "text.secondary" }}>
              {vehicle.technician_name}
            </Typography>
          )}

          {addr && (
            <Typography
              variant="caption"
              sx={{
                display: "block",
                mt: 0.45,
                color: "text.secondary",
                lineHeight: 1.35,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
              title={addr}
            >
              {addr}
            </Typography>
          )}

          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mt: 0.65, flexWrap: "wrap" }}>
            {!moving && speed && (
              <Typography variant="caption" color="text.disabled">
                {speed}
              </Typography>
            )}
            {vehicle.last_updated && (
              <Typography variant="caption" color="text.disabled">
                {formatRelative(vehicle.last_updated)}
              </Typography>
            )}
            {(vehicle.tags || []).slice(0, 3).map((tag) => (
              <Chip
                key={tag}
                size="small"
                label={tag}
                sx={{
                  height: 18,
                  fontSize: "0.62rem",
                  fontWeight: 600,
                  bgcolor: "rgba(15, 76, 129, 0.08)",
                  color: "#0F4C81",
                }}
              />
            ))}
          </Box>
        </Box>

        <Tooltip title="Focus on map">
          <IconButton
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              onFocus?.();
            }}
            sx={{ mt: -0.25 }}
          >
            <NearMeIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>
      </Box>
    </Box>
  );
}

/**
 * Left list panel for Map ops console — vehicles, jobs, estimates.
 */
export default function MapOpsPanel({
  vehicles = [],
  jobs = [],
  estimates = [],
  addressByDeviceId = {},
  gpsConfigured = false,
  showVehicles = true,
  showJobs = true,
  showEstimates = true,
  showAlerts = true,
  selectedKey = null,
  onSelectItem,
  onFocusMap,
  onFocusAlert,
}) {
  const [tab, setTab] = useState(0);
  const [query, setQuery] = useState("");

  const tabs = useMemo(() => {
    const list = [];
    if (showVehicles) list.push({ key: "vehicles", label: "Vehicles", count: vehicles.length });
    if (showAlerts) list.push({ key: "alerts", label: "Alerts", count: null });
    if (showJobs) list.push({ key: "jobs", label: "Jobs", count: jobs.length });
    if (showEstimates) list.push({ key: "estimates", label: "Estimates", count: estimates.length });
    return list;
  }, [
    showVehicles,
    showAlerts,
    showJobs,
    showEstimates,
    vehicles.length,
    jobs.length,
    estimates.length,
  ]);

  const activeKey = tabs[Math.min(tab, Math.max(tabs.length - 1, 0))]?.key || "jobs";

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const match = (s) => !q || String(s || "").toLowerCase().includes(q);

    if (activeKey === "vehicles") {
      return vehicles.filter(
        (v) =>
          match(v.display_name) ||
          match(v.device_id) ||
          match(v.address) ||
          match(addressByDeviceId[v.device_id]) ||
          match(v.drive_status)
      );
    }
    if (activeKey === "estimates") {
      return estimates.filter(
        (e) => match(e.title) || match(e.contact_name) || match(getEstimateAddressSafe(e))
      );
    }
    return jobs.filter(
      (j) =>
        match(j.customer_name) ||
        match(j.job_address) ||
        match(j.customer_address) ||
        match(j.status)
    );
  }, [activeKey, vehicles, jobs, estimates, query, addressByDeviceId]);

  return (
    <Box
      sx={{
        width: { xs: "100%", md: 360 },
        minWidth: { md: 320 },
        maxWidth: { md: 400 },
        height: "100%",
        display: "flex",
        flexDirection: "column",
        bgcolor: "#F7F9FB",
        borderRight: { md: "1px solid" },
        borderColor: { md: "divider" },
      }}
    >
      <Box sx={{ px: 2, pt: 2, pb: activeKey === "alerts" ? 0.5 : 1.5, bgcolor: "background.paper", borderBottom: "1px solid", borderColor: "divider" }}>
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: activeKey === "alerts" ? 0.5 : 1.5 }}>
          <Typography variant="overline" sx={{ color: "text.secondary" }}>
            Field map
          </Typography>
          {gpsConfigured && showVehicles && (
            <Chip
              size="small"
              label="LIVE"
              sx={{
                height: 22,
                bgcolor: "rgba(16, 185, 129, 0.12)",
                color: "#047857",
                fontWeight: 700,
                letterSpacing: "0.06em",
                fontSize: "0.65rem",
              }}
            />
          )}
        </Box>
        {activeKey !== "alerts" && (
          <TextField
            fullWidth
            size="small"
            placeholder={`Search ${activeKey}…`}
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
        )}
      </Box>

      <Tabs
        value={Math.min(tab, tabs.length - 1)}
        onChange={(_, v) => setTab(v)}
        variant="scrollable"
        scrollButtons="auto"
        sx={{
          minHeight: 40,
          px: 1,
          bgcolor: "background.paper",
          borderBottom: "1px solid",
          borderColor: "divider",
          "& .MuiTab-root": {
            minHeight: 40,
            fontSize: "0.75rem",
            fontWeight: 600,
            textTransform: "none",
            px: 1,
            minWidth: "auto",
          },
        }}
      >
        {tabs.map((t) => (
          <Tab
            key={t.key}
            label={
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                <span>{t.label}</span>
                {t.count != null && (
                  <Box
                    component="span"
                    sx={{
                      fontSize: "0.65rem",
                      px: 0.6,
                      py: 0.1,
                      borderRadius: 1,
                      bgcolor: "rgba(15, 35, 55, 0.06)",
                      color: "text.secondary",
                    }}
                  >
                    {t.count}
                  </Box>
                )}
              </Box>
            }
          />
        ))}
      </Tabs>

      {activeKey === "alerts" ? (
        <Box sx={{ flex: 1, minHeight: 0 }}>
          <MapAlertsPanel onFocusAlert={onFocusAlert} />
        </Box>
      ) : (
      <Box sx={{ flex: 1, overflowY: "auto", px: 1.25, py: 1.25 }}>
        {activeKey === "vehicles" && !gpsConfigured && (
          <Box sx={{ px: 1.5, py: 3, textAlign: "center" }}>
            <Typography variant="body2" color="text.secondary">
              Connect One Step GPS to see live vehicles here.
            </Typography>
          </Box>
        )}

        {filtered.length === 0 && !(activeKey === "vehicles" && !gpsConfigured) && (
          <Box sx={{ px: 1.5, py: 3, textAlign: "center" }}>
            <Typography variant="body2" color="text.secondary">
              Nothing matches{query ? ` “${query}”` : ""}.
            </Typography>
          </Box>
        )}

        {activeKey === "vehicles" &&
          gpsConfigured &&
          filtered.map((v) => {
            const key = `vehicle:${v.device_id || v.display_name}`;
            return (
              <VehicleCard
                key={key}
                vehicle={v}
                address={addressByDeviceId[v.device_id]}
                selected={selectedKey === key}
                onClick={() => {
                  onSelectItem?.(key, { type: "vehicle", item: v });
                  onFocusMap?.(v.lat, v.lng);
                }}
                onFocus={() => onFocusMap?.(v.lat, v.lng)}
              />
            );
          })}

        {activeKey === "jobs" &&
          filtered.map((j) => {
            const id = j.job_id || j.id;
            const key = `job:${id}`;
            return (
              <ListRow
                key={key}
                selected={selectedKey === key}
                title={j.customer_name || j.title || "Job"}
                subtitle={j.job_address || j.customer_address || "No address"}
                meta={(j.status || "").replace(/_/g, " ")}
                accent={STATUS_COLORS[j.status] || "#64748B"}
                onClick={() => {
                  onSelectItem?.(key, { type: "job", item: j });
                  if (j.lat != null && j.lng != null) onFocusMap?.(j.lat, j.lng);
                }}
              />
            );
          })}

        {activeKey === "estimates" &&
          filtered.map((e) => {
            const id = e.id || e.appointment_id;
            const key = `estimate:${id}`;
            return (
              <ListRow
                key={key}
                selected={selectedKey === key}
                title={e.title || e.contact_name || "Estimate"}
                subtitle={getEstimateAddressSafe(e) || "No address"}
                meta={(e.status || "").replace(/_/g, " ")}
                accent="#14B8A6"
                onClick={() => {
                  onSelectItem?.(key, { type: "estimate", item: e });
                  if (e.lat != null && e.lng != null) onFocusMap?.(e.lat, e.lng);
                }}
              />
            );
          })}
      </Box>
      )}
    </Box>
  );
}

function getEstimateAddressSafe(e) {
  return e?.address || e?.customer_address || e?.location_address || "";
}
