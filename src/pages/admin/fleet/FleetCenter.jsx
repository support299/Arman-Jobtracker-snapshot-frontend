import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Alert, Box, Button, Chip, Stack, Tab, Tabs, Typography } from "@mui/material";
import {
  Bell,
  BellRing,
  CarFront,
  FileBarChart,
  Map as MapIcon,
  Route,
  ScanLine,
  Settings,
  Truck,
  Wrench,
} from "lucide-react";
import { useGetDevicesQuery, useGetFleetSummaryQuery, useGetSettingsQuery } from "../../../store/api/onestepgpsApi";
import OneStepGPSSettingsDialog from "../../../components/admin/jobs/OneStepGPSSettingsDialog";
import JobsMap from "../JobsMap";
import FleetTripsTab from "./FleetTripsTab";
import FleetAlertsTab from "./FleetAlertsTab";
import FleetMaintenanceTab from "./FleetMaintenanceTab";
import FleetGeofencesTab from "./FleetGeofencesTab";
import FleetReportsTab from "./FleetReportsTab";
import FleetSettingsDrawer from "./FleetSettingsDrawer";
import { MetricCard, PrimaryButton } from "./FleetPrimitives";
import { SP } from "./fleetUi";

const TABS = [
  { id: "live", label: "Live map", icon: MapIcon },
  { id: "trips", label: "Trips & stops", icon: Route },
  { id: "alerts", label: "Alerts", icon: Bell },
  { id: "maintenance", label: "Maintenance", icon: Wrench },
  { id: "geofences", label: "Geofences", icon: ScanLine },
  { id: "reports", label: "Reports", icon: FileBarChart },
];

export default function FleetCenter() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = TABS.some((t) => t.id === searchParams.get("tab")) ? searchParams.get("tab") : "live";
  const [gpsOpen, setGpsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { data: gpsSettings } = useGetSettingsQuery();
  const gpsConfigured = gpsSettings?.api_key_set && gpsSettings?.is_enabled !== false;
  const { data: devicesData } = useGetDevicesQuery(undefined, {
    skip: !gpsConfigured,
    pollingInterval: gpsConfigured ? 20000 : 0,
  });
  const { data: summary } = useGetFleetSummaryQuery(undefined, { pollingInterval: 30000 });
  const devices = devicesData?.devices || [];
  const drivingCount = devices.filter((d) => {
    const status = String(d.drive_status || "").toLowerCase();
    return (Number(d.speed_mph) || 0) >= 3 || status.includes("driv");
  }).length;

  const setTab = (next) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("tab", next);
    setSearchParams(nextParams, { replace: true });
  };

  const recordCount =
    (summary?.trips || 0) +
    (summary?.open_alerts || 0) +
    (summary?.acknowledged_alerts || 0) +
    (summary?.geofences || 0);

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        flex: 1,
        width: "100%",
        minHeight: 0,
        height: { xs: "auto", md: "100%" },
        overflow: tab === "live" ? "hidden" : "auto",
        bgcolor: SP.page,
        mx: { xs: -1.5, sm: -2 },
        my: { xs: -1.5, sm: -2 },
        px: { xs: 2, sm: 3 },
        py: { xs: 2, sm: 2.5 },
      }}
    >
      <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={2} sx={{ mb: 1, flexShrink: 0 }}>
        <Box>
          <Typography sx={{ color: SP.blue, fontSize: 11, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase" }}>
            Operations
          </Typography>
          <Typography sx={{ fontSize: { xs: 28, sm: 32 }, fontWeight: 800, letterSpacing: "-0.04em", color: SP.ink, mt: 0.5 }}>
            Fleet Center
          </Typography>
          <Typography sx={{ color: SP.muted, fontSize: 13, mt: 0.75, maxWidth: 640, lineHeight: 1.6 }}>
            Live vehicles, jobs, trips, alerts, and diagnostics for this subaccount.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
          <Chip
            size="small"
            label={gpsConfigured ? "Tracking live" : "GPS not connected"}
            sx={{
              height: 28,
              fontWeight: 800,
              bgcolor: gpsConfigured ? SP.greenSoft : "#fff",
              color: gpsConfigured ? SP.green : SP.muted,
              border: `1px solid ${gpsConfigured ? "#b7e7c8" : SP.line}`,
              "& .MuiChip-label::before": gpsConfigured
                ? { content: '""', display: "inline-block", width: 7, height: 7, borderRadius: "50%", bgcolor: SP.green, mr: 0.75 }
                : undefined,
            }}
          />
          <Button
            size="small"
            variant="outlined"
            startIcon={<Settings size={15} />}
            onClick={() => setSettingsOpen(true)}
            sx={{
              textTransform: "none",
              fontWeight: 800,
              borderColor: SP.line,
              color: SP.ink,
              borderRadius: "10px",
            }}
          >
            Settings
          </Button>
          <PrimaryButton size="small" onClick={() => setGpsOpen(true)}>
            {gpsConfigured ? "Connect GPS" : "Connect GPS"}
          </PrimaryButton>
        </Stack>
      </Stack>

      <Box sx={{ borderBottom: `1px solid ${SP.line}`, mb: 2, flexShrink: 0 }}>
        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          variant="scrollable"
          scrollButtons="auto"
          TabIndicatorProps={{ sx: { height: 2, bgcolor: SP.blue } }}
          sx={{
            minHeight: 42,
            "& .MuiTab-root": {
              minHeight: 42,
              textTransform: "none",
              fontWeight: 800,
              fontSize: 13,
              color: SP.muted,
              px: 1.75,
            },
            "& .Mui-selected": { color: `${SP.blue} !important` },
          }}
        >
          {TABS.map((item) => {
            const Icon = item.icon;
            return <Tab key={item.id} value={item.id} icon={<Icon size={16} />} iconPosition="start" label={item.label} />;
          })}
        </Tabs>
      </Box>

      {!gpsConfigured && tab !== "live" && (
        <Alert
          severity="warning"
          sx={{ mb: 2, borderRadius: "12px" }}
          action={<Button color="inherit" size="small" onClick={() => setGpsOpen(true)}>Connect</Button>}
        >
          Connect One Step GPS to sync vehicles, alerts, trips, and diagnostics for this subaccount.
        </Alert>
      )}

      <Box sx={{ flex: 1, minHeight: { xs: 480, md: 0 }, display: "flex", flexDirection: "column", overflow: tab === "live" ? "hidden" : "auto" }}>
        {tab === "live" && (
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ mb: 1.5, flexShrink: 0 }}>
            <MetricCard icon={Truck} label="Fleet vehicles" value={devices.length} hint={gpsConfigured ? `${devices.filter((d) => d.online !== false).length} online now` : "Connect GPS"} tone="blue" />
            <MetricCard icon={CarFront} label="Driving" value={drivingCount} hint="Live on the road" tone="green" />
            <MetricCard icon={BellRing} label="Open alerts" value={summary?.open_alerts ?? 0} hint="Needs attention" tone="amber" />
            <MetricCard icon={ScanLine} label="Geofences" value={summary?.geofences ?? 0} hint="Active zones" tone="blue" />
          </Stack>
        )}
        <Box
          sx={{
            flex: 1,
            minHeight: 0,
            overflow: tab === "live" ? "hidden" : "visible",
            ...(tab === "live"
              ? {
                  border: `1px solid ${SP.line}`,
                  borderRadius: "16px",
                  overflow: "hidden",
                  bgcolor: "#fff",
                  boxShadow: SP.shadow,
                }
              : {}),
          }}
        >
          {tab === "live" && <JobsMap dedicatedPage />}
          {tab === "trips" && <FleetTripsTab recordCount={recordCount} />}
          {tab === "alerts" && <FleetAlertsTab recordCount={recordCount} />}
          {tab === "maintenance" && <FleetMaintenanceTab recordCount={recordCount} />}
          {tab === "geofences" && <FleetGeofencesTab recordCount={recordCount} />}
          {tab === "reports" && <FleetReportsTab recordCount={recordCount} />}
        </Box>
      </Box>

      <Stack direction="row" justifyContent="space-between" sx={{ mt: 1.25, flexShrink: 0 }}>
        <Typography sx={{ color: SP.muted, fontSize: 11, fontWeight: 700 }}>Each subaccount is isolated.</Typography>
        <Typography sx={{ color: SP.muted, fontSize: 11, fontWeight: 700 }}>Powered by OneStep GPS</Typography>
      </Stack>

      <OneStepGPSSettingsDialog open={gpsOpen} onClose={() => setGpsOpen(false)} />
      <FleetSettingsDrawer open={settingsOpen} onClose={() => setSettingsOpen(false)} onOpenGps={() => setGpsOpen(true)} />
    </Box>
  );
}
