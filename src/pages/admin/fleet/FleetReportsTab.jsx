import { Box, Button, Stack, Typography } from "@mui/material";
import { CheckCircle2, Download, MapPin, Route, ShieldAlert, Wrench, X } from "lucide-react";
import { useState } from "react";
import { useGetFleetReportsQuery } from "../../../store/api/onestepgpsApi";
import { FleetSectionHeader, PrimaryButton } from "./FleetPrimitives";
import { downloadFleetReportPdf } from "./fleetReportPdf";
import { SP, formatDuration } from "./fleetUi";

export default function FleetReportsTab({ recordCount = 0 }) {
  const { data } = useGetFleetReportsQuery();
  const [ready, setReady] = useState("");
  const [generating, setGenerating] = useState("");
  const activity = data?.fleet_activity || {};
  const safety = data?.driver_safety || {};
  const maintenance = data?.maintenance_health || {};
  const location = data?.location_activity || {};

  const generate = async (key) => {
    setGenerating(key);
    try {
      await downloadFleetReportPdf(key, data || { [key]: {} });
      setReady(key);
    } finally {
      setGenerating("");
    }
  };

  const cards = [
    {
      key: "fleet_activity",
      title: "Fleet activity",
      body: "Miles, drive time, stops, idle time, and utilization by vehicle.",
      schedule: "Weekly",
      icon: Route,
      detail: data
        ? `${activity.distance_miles ?? 0} mi · ${activity.trips ?? 0} trips · ${activity.stops ?? 0} stops · ${formatDuration(activity.drive_seconds)}`
        : "Last 30 days",
    },
    {
      key: "driver_safety",
      title: "Driver safety",
      body: "Speeding, harsh driving, alerts, and driver trends.",
      schedule: "Monthly",
      icon: ShieldAlert,
      detail: data
        ? `${safety.events ?? 0} safety events · ${safety.speeding ?? 0} speeding · ${safety.open ?? 0} open`
        : "Last 30 days",
    },
    {
      key: "maintenance_health",
      title: "Maintenance health",
      body: "Odometer, engine hours, DTCs, and upcoming service.",
      schedule: "Weekly",
      icon: Wrench,
      detail: data
        ? `${maintenance.need_attention ?? 0} need attention · ${maintenance.overdue ?? 0} overdue · ${maintenance.vehicles ?? 0} monitored`
        : "Last 30 days",
    },
    {
      key: "location_activity",
      title: "Location activity",
      body: "Geofence arrivals, departures, dwell time, and after-hours use.",
      schedule: "On demand",
      icon: MapPin,
      detail: data
        ? `${location.geofence_events ?? 0} events · ${location.active_geofences ?? 0} zones`
        : "Last 30 days",
    },
  ];

  const bars = (data?.fleet_activity?.by_day || [])
    .filter((d) => d.distance_miles || d.trips)
    .slice(-7)
    .map((d) => d.distance_miles || 0);
  const maxBar = Math.max(...bars, 1);
  const chartBars = bars.length ? bars.map((v) => Math.max(12, Math.round((v / maxBar) * 100))) : [32, 44, 39, 58, 63, 72, 82];

  return (
    <Box>
      <FleetSectionHeader
        eyebrow="Analytics & exports"
        title="Fleet reports"
        description="Review the last 30 days and download a PDF for operations, safety, maintenance, or geofences."
        count={recordCount}
      />

      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 2,
          bgcolor: SP.blue,
          color: "#fff",
          borderRadius: "16px",
          px: 3,
          py: 2.5,
          mb: 2,
          background: "linear-gradient(120deg, #0877f9, #075ed0)",
        }}
      >
        <Box>
          <Typography sx={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", opacity: 0.85 }}>
            Last 30 days
          </Typography>
          <Typography sx={{ fontSize: 22, fontWeight: 800, mt: 0.5 }}>
            {data?.fleet_activity
              ? `${activity.trips ?? 0} trips · ${activity.distance_miles ?? 0} mi · ${formatDuration(activity.drive_seconds)}`
              : "Fleet utilization"}
          </Typography>
          <Typography sx={{ fontSize: 13, mt: 0.5, opacity: 0.9, maxWidth: 520 }}>
            PDFs include per-vehicle totals, recent events, and service status from this subaccount’s live data.
          </Typography>
        </Box>
        <Stack direction="row" alignItems="flex-end" spacing={0.75} sx={{ height: 72, display: { xs: "none", sm: "flex" } }}>
          {chartBars.map((h, i) => (
            <Box key={i} sx={{ width: 10, height: `${h}%`, bgcolor: "rgba(255,255,255,0.85)", borderRadius: "3px 3px 0 0" }} />
          ))}
        </Stack>
      </Box>

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 1.75 }}>
        {cards.map((card) => {
          const Icon = card.icon;
          const busy = generating === card.key;
          return (
            <Box
              key={card.key}
              sx={{
                display: "grid",
                gridTemplateColumns: "44px minmax(0,1fr) auto",
                gap: 1.5,
                alignItems: "center",
                bgcolor: "#fff",
                border: `1px solid ${SP.line}`,
                borderRadius: "16px",
                boxShadow: SP.shadow,
                p: 2,
              }}
            >
              <Box sx={{ width: 44, height: 44, borderRadius: "12px", bgcolor: SP.blueSoft, color: SP.blue, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Icon size={19} />
              </Box>
              <Box>
                <Typography sx={{ fontSize: 15, fontWeight: 800 }}>{card.title}</Typography>
                <Typography sx={{ color: SP.muted, fontSize: 12, mt: 0.5 }}>{card.body}</Typography>
                <Typography sx={{ color: SP.muted, fontSize: 11, mt: 0.75 }}>PDF · {card.detail}</Typography>
              </Box>
              <PrimaryButton
                size="small"
                startIcon={<Download size={14} />}
                onClick={() => generate(card.key)}
                disabled={Boolean(generating)}
              >
                {busy ? "Building…" : ready === card.key ? "Downloaded" : "Generate PDF"}
              </PrimaryButton>
            </Box>
          );
        })}
      </Box>

      {ready && (
        <Stack direction="row" spacing={1.25} alignItems="center" sx={{ mt: 2, bgcolor: SP.greenSoft, borderRadius: "12px", px: 2, py: 1.25 }}>
          <CheckCircle2 size={18} color={SP.green} />
          <Typography sx={{ fontSize: 13, flex: 1 }}>
            <strong>{cards.find((c) => c.key === ready)?.title} PDF is ready.</strong> Saved to your downloads.
          </Typography>
          <Button onClick={() => setReady("")} sx={{ minWidth: 0, color: SP.muted }}><X size={16} /></Button>
        </Stack>
      )}
    </Box>
  );
}
