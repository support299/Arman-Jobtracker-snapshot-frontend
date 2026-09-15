import { Box, Button, Stack, TextField, Typography } from "@mui/material";
import { AlertTriangle, BellRing, CheckCircle2, Siren } from "lucide-react";
import { useMemo, useState } from "react";
import { useAcknowledgeAlertMutation, useGetRecentAlertsQuery } from "../../../store/api/onestepgpsApi";
import { FilterPills, FleetSectionHeader, LoadingBlock, MetricCard, OperationsEmpty, OperationsPanel } from "./FleetPrimitives";
import { SP, formatDateTime } from "./fleetUi";

function severityOf(alert) {
  return alert.severity || "warning";
}

export default function FleetAlertsTab({ recordCount = 0 }) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const { data, isLoading } = useGetRecentAlertsQuery({ limit: 200, search }, { pollingInterval: 15000 });
  const [acknowledge, { isLoading: acking }] = useAcknowledgeAlertMutation();
  const alerts = data?.results || [];

  const filtered = useMemo(() => {
    return alerts.filter((a) => {
      if (filter === "open") return !a.acknowledged;
      if (filter === "critical") return severityOf(a) === "critical";
      if (filter === "warning") return severityOf(a) === "warning";
      if (filter === "info") return severityOf(a) === "info";
      return true;
    });
  }, [alerts, filter]);

  const openCount = alerts.filter((a) => !a.acknowledged).length;
  const criticalCount = alerts.filter((a) => !a.acknowledged && severityOf(a) === "critical").length;
  const ackCount = alerts.filter((a) => a.acknowledged).length;

  return (
    <Box>
      <FleetSectionHeader
        eyebrow="Safety & exceptions"
        title="Fleet alerts"
        description="Speeding, idling, geofence, driver-behavior, device, after-hours, and diagnostic events."
        count={data?.count || recordCount}
      />
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1.75} sx={{ mb: 2 }}>
        <MetricCard icon={Siren} label="Open alerts" value={openCount} tone="red" />
        <MetricCard icon={AlertTriangle} label="Critical" value={criticalCount} tone="amber" />
        <MetricCard icon={CheckCircle2} label="Acknowledged" value={ackCount} tone="green" />
      </Stack>

      <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ mb: 2 }} alignItems="center">
        <FilterPills
          value={filter}
          onChange={setFilter}
          options={[
            { id: "all", label: "All" },
            { id: "open", label: "Open" },
            { id: "critical", label: "Critical" },
            { id: "warning", label: "Warning" },
            { id: "info", label: "Info" },
          ]}
        />
        <TextField
          size="small"
          placeholder="Search alerts…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ maxWidth: 280, "& .MuiOutlinedInput-root": { borderRadius: "10px", bgcolor: "#fff" } }}
        />
      </Stack>

      <OperationsPanel title="Alert timeline" subtitle="Newest events first" icon={BellRing}>
        {isLoading ? (
          <LoadingBlock />
        ) : filtered.length === 0 ? (
          <OperationsEmpty
            icon={BellRing}
            label={alerts.length ? "No alerts match this filter." : "Alerts will appear after OneStep DataQueue sends safety and exception events."}
          />
        ) : (
          filtered.map((alert) => {
            const sev = severityOf(alert);
            const critical = sev === "critical";
            return (
              <Box
                key={alert.id}
                sx={{
                  display: "grid",
                  gridTemplateColumns: { xs: "40px 1fr", sm: "42px minmax(0,1fr) 120px" },
                  gap: 1.5,
                  alignItems: "center",
                  px: 2.25,
                  py: 1.75,
                  borderBottom: `1px solid ${SP.line}`,
                }}
              >
                <Box
                  sx={{
                    width: 40,
                    height: 40,
                    borderRadius: "11px",
                    bgcolor: critical ? SP.redSoft : SP.amberSoft,
                    color: critical ? SP.red : SP.amber,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {critical ? <Siren size={18} /> : <AlertTriangle size={18} />}
                </Box>
                <Box sx={{ minWidth: 0 }}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Typography sx={{ fontSize: 13, fontWeight: 800, color: SP.ink }}>
                      {alert.alert_name || "Alert"}
                    </Typography>
                    <Box
                      sx={{
                        fontSize: 10,
                        fontWeight: 900,
                        px: 0.75,
                        py: 0.25,
                        borderRadius: 999,
                        textTransform: "uppercase",
                        bgcolor: critical ? SP.redSoft : sev === "info" ? SP.blueSoft : SP.amberSoft,
                        color: critical ? SP.red : sev === "info" ? SP.blue : "#9d6412",
                      }}
                    >
                      {sev}
                    </Box>
                  </Stack>
                  <Typography sx={{ color: SP.slate, fontSize: 12, mt: 0.75 }}>
                    {alert.device_name || alert.device_id || "Vehicle"}
                    {alert.speed_mph != null ? ` · ${Math.round(alert.speed_mph)} mph` : ""}
                    {alert.posted_speed_limit_mph != null ? ` in a ${Math.round(alert.posted_speed_limit_mph)} mph zone` : ""}
                    {alert.location_raw ? ` · ${alert.location_raw}` : ""}
                  </Typography>
                  <Typography sx={{ color: SP.muted, fontSize: 11, mt: 0.5 }}>
                    {formatDateTime(alert.alert_time || alert.created_at)}
                  </Typography>
                </Box>
                {alert.acknowledged ? (
                  <Box sx={{ justifySelf: "end", bgcolor: SP.greenSoft, color: "#087e36", fontSize: 11, fontWeight: 800, px: 1.25, py: 0.75, borderRadius: 999 }}>
                    Acknowledged
                  </Box>
                ) : (
                  <Button
                    disabled={acking}
                    onClick={() => acknowledge(alert.id)}
                    sx={{
                      justifySelf: "end",
                      bgcolor: SP.amberSoft,
                      color: "#9d6412",
                      fontSize: 11,
                      fontWeight: 800,
                      textTransform: "none",
                      borderRadius: 999,
                      px: 1.5,
                      "&:hover": { bgcolor: "#ffe7bf" },
                    }}
                  >
                    Acknowledge
                  </Button>
                )}
              </Box>
            );
          })
        )}
      </OperationsPanel>
    </Box>
  );
}
