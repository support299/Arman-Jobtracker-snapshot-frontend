import { Box, Button, Dialog, DialogContent, Grid, IconButton, MenuItem, Stack, TextField, Typography } from "@mui/material";
import { Activity, CheckCircle2, ClipboardCheck, Fuel, Gauge, Plus, Siren, Wrench, X } from "lucide-react";
import { useMemo, useState } from "react";
import {
  useCompleteFleetMaintenanceMutation,
  useEnsureFleetMaintenanceMutation,
  useGetDevicesQuery,
  useGetFleetMaintenanceQuery,
  useUpdateFleetMaintenanceMutation,
} from "../../../store/api/onestepgpsApi";
import { FilterPills, FleetSectionHeader, LoadingBlock, MetricCard, OperationsEmpty, OperationsPanel, PrimaryButton } from "./FleetPrimitives";
import { SP, formatDay, relativeTime } from "./fleetUi";

const SERVICE_TYPES = [
  { id: "oil", label: "Oil change" },
  { id: "tires", label: "Tire rotation" },
  { id: "brakes", label: "Brakes" },
  { id: "inspection", label: "Inspection" },
  { id: "filter", label: "Filter" },
  { id: "other", label: "Other" },
];

function typeLabel(value) {
  return SERVICE_TYPES.find((item) => item.id === value)?.label || value || "Service";
}

function toDateInput(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function emptySchedule(vehicle) {
  return {
    service_type: vehicle?.service_type || "oil",
    next_service_at: toDateInput(vehicle?.next_service_at),
    next_service_miles: vehicle?.next_service_miles ?? "",
    interval_miles: vehicle?.interval_miles ?? "",
    interval_days: vehicle?.interval_days ?? "",
    notes: vehicle?.notes || "",
  };
}

function emptyComplete(vehicle) {
  return {
    service_type: vehicle?.service_type || "oil",
    performed_at: toDateInput(new Date()),
    odometer_miles: vehicle?.odometer_miles ?? "",
    notes: "",
  };
}

function healthMeta(vehicle) {
  if (vehicle.due_status === "overdue") return { label: "Overdue", bg: SP.redSoft, fg: SP.red };
  if (vehicle.due_status === "due_soon") return { label: "Due soon", bg: SP.amberSoft, fg: SP.amber };
  if (vehicle.due_status === "fault" || vehicle.check_engine || (vehicle.dtc_codes || []).length) {
    return { label: "Service needed", bg: SP.redSoft, fg: SP.red };
  }
  return { label: "Healthy", bg: SP.greenSoft, fg: "#087e36" };
}

function nextServiceText(vehicle) {
  if (vehicle.due_status === "overdue") {
    if (vehicle.miles_remaining != null && vehicle.miles_remaining <= 0) {
      return `Overdue by ${Math.abs(Math.round(vehicle.miles_remaining)).toLocaleString()} mi`;
    }
    if (vehicle.days_remaining != null && vehicle.days_remaining <= 0) {
      return `Overdue since ${formatDay(vehicle.next_service_at) || "scheduled date"}`;
    }
    return "Overdue";
  }
  const bits = [];
  if (vehicle.next_service_at) bits.push(formatDay(vehicle.next_service_at));
  if (vehicle.next_service_miles != null) bits.push(`${Math.round(vehicle.next_service_miles).toLocaleString()} mi`);
  if (vehicle.miles_remaining != null && vehicle.miles_remaining > 0) bits.push(`in ${Math.round(vehicle.miles_remaining).toLocaleString()} mi`);
  if (!bits.length) return "Not configured";
  return bits.join(" · ");
}

export default function FleetMaintenanceTab({ recordCount = 0 }) {
  const { data: devicesData, isLoading: devicesLoading } = useGetDevicesQuery(undefined, { pollingInterval: 30000 });
  const { data, isLoading, isError } = useGetFleetMaintenanceQuery(undefined, { pollingInterval: 30000 });
  const [ensureMaintenance] = useEnsureFleetMaintenanceMutation();
  const [updateSchedule] = useUpdateFleetMaintenanceMutation();
  const [completeService] = useCompleteFleetMaintenanceMutation();
  const maintRows = data?.results || [];
  const devices = devicesData?.devices || [];
  const vehicles = useMemo(() => {
    const byId = new Map(maintRows.map((row) => [String(row.device_id), row]));
    if (!devices.length) return maintRows;
    const merged = devices.map((device) => {
      const existing = byId.get(String(device.device_id));
      const name = device.display_name || device.device_name || device.device_id;
      if (existing) {
        return {
          ...existing,
          device_name: existing.device_name || name,
          odometer_miles: existing.odometer_miles ?? device.odometer_miles ?? device.odometer ?? null,
          engine_hours: existing.engine_hours ?? device.engine_hours ?? null,
          fuel_level_percent: existing.fuel_level_percent ?? device.fuel_level_percent ?? null,
        };
      }
      return {
        id: null,
        device_id: device.device_id,
        device_name: name,
        odometer_miles: device.odometer_miles ?? device.odometer ?? null,
        engine_hours: device.engine_hours ?? null,
        fuel_level_percent: device.fuel_level_percent ?? null,
        check_engine: Boolean(device.check_engine),
        dtc_codes: device.dtc_codes || [],
        due_status: "ok",
        logs: [],
        updated_at: device.dt_tracker || device.updated_at || null,
      };
    });
    maintRows.forEach((row) => {
      if (!merged.some((item) => String(item.device_id) === String(row.device_id))) merged.push(row);
    });
    return merged;
  }, [maintRows, devices]);
  const totals = data?.totals || {};
  const vehiclesMonitored = totals.vehicles_monitored || vehicles.length;
  const [filter, setFilter] = useState("all");
  const [scheduleVehicle, setScheduleVehicle] = useState(null);
  const [completeVehicle, setCompleteVehicle] = useState(null);
  const [historyVehicle, setHistoryVehicle] = useState(null);
  const [scheduleForm, setScheduleForm] = useState(emptySchedule());
  const [completeForm, setCompleteForm] = useState(emptyComplete());
  const [saving, setSaving] = useState(false);

  const filtered = useMemo(() => {
    return vehicles.filter((v) => {
      if (filter === "due") return v.due_status === "overdue" || v.due_status === "due_soon";
      if (filter === "fault") return v.due_status === "fault" || v.check_engine || (v.dtc_codes || []).length;
      if (filter === "healthy") return v.due_status === "ok";
      return true;
    });
  }, [vehicles, filter]);

  const openSchedule = (vehicle) => {
    setScheduleVehicle(vehicle);
    setScheduleForm(emptySchedule(vehicle));
  };

  const openComplete = (vehicle) => {
    setCompleteVehicle(vehicle);
    setCompleteForm(emptyComplete(vehicle));
  };

  const handleSaveSchedule = async () => {
    if (!scheduleVehicle) return;
    setSaving(true);
    try {
      const payload = {
        service_type: scheduleForm.service_type,
        next_service_at: scheduleForm.next_service_at || null,
        next_service_miles: scheduleForm.next_service_miles === "" ? null : Number(scheduleForm.next_service_miles),
        interval_miles: scheduleForm.interval_miles === "" ? null : Number(scheduleForm.interval_miles),
        interval_days: scheduleForm.interval_days === "" ? null : Number(scheduleForm.interval_days),
        notes: scheduleForm.notes,
      };
      if (scheduleVehicle.id) {
        await updateSchedule({ id: scheduleVehicle.id, ...payload }).unwrap();
      } else {
        await ensureMaintenance({
          device_id: scheduleVehicle.device_id,
          device_name: scheduleVehicle.device_name,
          ...payload,
        }).unwrap();
      }
      setScheduleVehicle(null);
    } finally {
      setSaving(false);
    }
  };

  const handleComplete = async () => {
    if (!completeVehicle) return;
    setSaving(true);
    try {
      let id = completeVehicle.id;
      if (!id) {
        const created = await ensureMaintenance({
          device_id: completeVehicle.device_id,
          device_name: completeVehicle.device_name,
        }).unwrap();
        id = created.id;
      }
      await completeService({
        id,
        service_type: completeForm.service_type,
        performed_at: completeForm.performed_at || undefined,
        odometer_miles: completeForm.odometer_miles === "" ? undefined : Number(completeForm.odometer_miles),
        notes: completeForm.notes,
      }).unwrap();
      setCompleteVehicle(null);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box>
      <FleetSectionHeader
        eyebrow="Vehicle health"
        title="Maintenance & diagnostics"
        description="Set service intervals, log completed work, and track due dates against live odometer and DTCs."
        count={recordCount}
      />
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1.75} sx={{ mb: 2 }}>
        <MetricCard icon={Wrench} label="Need attention" value={totals.need_attention ?? 0} tone={totals.need_attention ? "red" : "green"} />
        <MetricCard icon={ClipboardCheck} label="Due soon" value={totals.due_soon ?? 0} tone="amber" />
        <MetricCard icon={Fuel} label="Average fuel" value={totals.average_fuel != null ? `${totals.average_fuel}%` : "—"} tone="blue" />
        <MetricCard icon={Gauge} label="Vehicles monitored" value={vehiclesMonitored} tone="green" />
      </Stack>

      <Stack sx={{ mb: 2 }}>
        <FilterPills
          value={filter}
          onChange={setFilter}
          options={[
            { id: "all", label: "All" },
            { id: "due", label: "Due" },
            { id: "fault", label: "Faults" },
            { id: "healthy", label: "Healthy" },
          ]}
        />
      </Stack>

      <OperationsPanel title="Vehicle health" subtitle="Latest diagnostic state per vehicle" icon={Activity}>
        {vehicles.length === 0 && (isLoading || devicesLoading) ? (
          <LoadingBlock />
        ) : vehicles.length === 0 ? (
          <OperationsEmpty icon={Wrench} label={isError ? "Could not load saved diagnostics. Live GPS vehicles will show here when the tracker list is available." : "Diagnostic and maintenance information will appear when supported trackers send it."} />
        ) : filtered.length === 0 ? (
          <OperationsEmpty icon={Wrench} label="No vehicles match this filter." />
        ) : (
          <Grid container spacing={1.75} sx={{ p: 2 }}>
            {filtered.map((v) => {
              const codes = v.dtc_codes || [];
              const health = healthMeta(v);
              const scheduled = v.schedule_managed || v.next_service_at || v.next_service_miles != null;
              return (
                <Grid item xs={12} md={6} key={v.id || v.device_id}>
                  <Box
                    sx={{
                      border: `1px solid ${health.fg === SP.red ? "#f0c4c8" : SP.line}`,
                      boxShadow: v.due_status === "overdue" || v.due_status === "fault" ? "inset 3px 0 0 #d93a49" : "none",
                      borderRadius: "14px",
                      p: 1.75,
                    }}
                  >
                    <Stack direction="row" spacing={1.25} alignItems="center">
                      <Box
                        sx={{
                          width: 38,
                          height: 38,
                          borderRadius: "10px",
                          bgcolor: health.bg,
                          color: health.fg,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        {health.label === "Healthy" ? <CheckCircle2 size={18} /> : <Siren size={18} />}
                      </Box>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography sx={{ fontSize: 13, fontWeight: 800 }}>{v.device_name || v.device_id}</Typography>
                        <Typography sx={{ color: SP.muted, fontSize: 11 }}>Updated {relativeTime(v.updated_at)}</Typography>
                      </Box>
                      <Box sx={{ bgcolor: health.bg, color: health.fg, fontSize: 11, fontWeight: 800, px: 1, py: 0.5, borderRadius: 999 }}>
                        {health.label}
                      </Box>
                    </Stack>
                    <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1px", mt: 1.75, bgcolor: SP.line, borderRadius: "8px", overflow: "hidden" }}>
                      {[
                        ["Odometer", v.odometer_miles != null ? `${Math.round(v.odometer_miles).toLocaleString()} mi` : "Unavailable"],
                        ["Engine hours", v.engine_hours != null ? `${v.engine_hours} hr` : "Unavailable"],
                        ["Fuel", v.fuel_level_percent != null ? `${Math.round(v.fuel_level_percent)}%` : "Unavailable"],
                        ["Next service", nextServiceText(v)],
                      ].map(([label, value]) => (
                        <Box key={label} sx={{ bgcolor: SP.soft, p: 1.25 }}>
                          <Typography sx={{ color: SP.muted, fontSize: 11 }}>{label}</Typography>
                          <Typography sx={{ fontSize: 13, fontWeight: 800 }}>{value}</Typography>
                        </Box>
                      ))}
                    </Box>
                    {(v.service_type || v.last_service_at) && (
                      <Typography sx={{ color: SP.muted, fontSize: 12, mt: 1.25 }}>
                        {v.service_type ? typeLabel(v.service_type) : "Service"}
                        {v.last_service_at ? ` · last ${formatDay(v.last_service_at)}` : ""}
                        {v.interval_miles ? ` · every ${Math.round(v.interval_miles).toLocaleString()} mi` : ""}
                        {v.interval_days ? ` · every ${v.interval_days} days` : ""}
                      </Typography>
                    )}
                    <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap sx={{ mt: 1.5 }}>
                      <Typography sx={{ color: SP.muted, fontSize: 11, fontWeight: 800, textTransform: "uppercase", mr: 0.5 }}>
                        DTC codes
                      </Typography>
                      {codes.length ? (
                        codes.map((code) => (
                          <Box key={code} sx={{ bgcolor: SP.redSoft, color: SP.red, fontSize: 11, fontWeight: 800, px: 0.75, py: 0.35, borderRadius: "5px" }}>
                            {code}
                          </Box>
                        ))
                      ) : (
                        <Typography sx={{ color: SP.green, fontSize: 12 }}>None reported</Typography>
                      )}
                    </Stack>
                    {(v.logs || []).length > 0 && (
                      <Button
                        onClick={() => setHistoryVehicle(v)}
                        sx={{ mt: 1, p: 0, minWidth: 0, textTransform: "none", fontWeight: 800, color: SP.blue, fontSize: 12 }}
                      >
                        {(v.logs || []).length} service record{(v.logs || []).length === 1 ? "" : "s"}
                      </Button>
                    )}
                    <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ mt: 1.5 }}>
                      <Button
                        fullWidth
                        startIcon={<Plus size={14} />}
                        onClick={() => openSchedule(v)}
                        sx={{
                          height: 34,
                          textTransform: "none",
                          fontWeight: 800,
                          color: SP.ink,
                          border: `1px solid ${SP.line}`,
                          borderRadius: "10px",
                        }}
                      >
                        {scheduled ? "Edit schedule" : "Schedule service"}
                      </Button>
                      <PrimaryButton fullWidth startIcon={<ClipboardCheck size={14} />} onClick={() => openComplete(v)} sx={{ height: 34 }}>
                        Log service
                      </PrimaryButton>
                    </Stack>
                  </Box>
                </Grid>
              );
            })}
          </Grid>
        )}
      </OperationsPanel>

      <Dialog open={Boolean(scheduleVehicle)} onClose={() => setScheduleVehicle(null)} fullWidth maxWidth="sm">
        <DialogContent sx={{ p: 0 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ p: 2.5, borderBottom: `1px solid ${SP.line}` }}>
            <Box>
              <Typography sx={{ color: SP.blue, fontSize: 11, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase" }}>
                Service schedule
              </Typography>
              <Typography sx={{ fontSize: 22, fontWeight: 800, mt: 0.5 }}>
                {scheduleVehicle?.device_name || scheduleVehicle?.device_id}
              </Typography>
            </Box>
            <IconButton onClick={() => setScheduleVehicle(null)}><X size={18} /></IconButton>
          </Stack>
          <Stack spacing={2} sx={{ p: 2.5 }}>
            <TextField
              select
              label="Service type"
              value={scheduleForm.service_type}
              onChange={(e) => setScheduleForm({ ...scheduleForm, service_type: e.target.value })}
            >
              {SERVICE_TYPES.map((item) => (
                <MenuItem key={item.id} value={item.id}>{item.label}</MenuItem>
              ))}
            </TextField>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
              <TextField
                fullWidth
                type="date"
                label="Next service date"
                InputLabelProps={{ shrink: true }}
                value={scheduleForm.next_service_at}
                onChange={(e) => setScheduleForm({ ...scheduleForm, next_service_at: e.target.value })}
              />
              <TextField
                fullWidth
                type="number"
                label="Next service miles"
                value={scheduleForm.next_service_miles}
                onChange={(e) => setScheduleForm({ ...scheduleForm, next_service_miles: e.target.value })}
              />
            </Stack>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
              <TextField
                fullWidth
                type="number"
                label="Repeat every (miles)"
                value={scheduleForm.interval_miles}
                onChange={(e) => setScheduleForm({ ...scheduleForm, interval_miles: e.target.value })}
                helperText="Used when you log a completed service"
              />
              <TextField
                fullWidth
                type="number"
                label="Repeat every (days)"
                value={scheduleForm.interval_days}
                onChange={(e) => setScheduleForm({ ...scheduleForm, interval_days: e.target.value })}
              />
            </Stack>
            <TextField
              label="Notes"
              multiline
              minRows={2}
              value={scheduleForm.notes}
              onChange={(e) => setScheduleForm({ ...scheduleForm, notes: e.target.value })}
            />
            <PrimaryButton onClick={handleSaveSchedule} disabled={saving}>
              Save schedule
            </PrimaryButton>
          </Stack>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(completeVehicle)} onClose={() => setCompleteVehicle(null)} fullWidth maxWidth="sm">
        <DialogContent sx={{ p: 0 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ p: 2.5, borderBottom: `1px solid ${SP.line}` }}>
            <Box>
              <Typography sx={{ color: SP.blue, fontSize: 11, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase" }}>
                Log completed service
              </Typography>
              <Typography sx={{ fontSize: 22, fontWeight: 800, mt: 0.5 }}>
                {completeVehicle?.device_name || completeVehicle?.device_id}
              </Typography>
            </Box>
            <IconButton onClick={() => setCompleteVehicle(null)}><X size={18} /></IconButton>
          </Stack>
          <Stack spacing={2} sx={{ p: 2.5 }}>
            <TextField
              select
              label="Service type"
              value={completeForm.service_type}
              onChange={(e) => setCompleteForm({ ...completeForm, service_type: e.target.value })}
            >
              {SERVICE_TYPES.map((item) => (
                <MenuItem key={item.id} value={item.id}>{item.label}</MenuItem>
              ))}
            </TextField>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
              <TextField
                fullWidth
                type="date"
                label="Completed on"
                InputLabelProps={{ shrink: true }}
                value={completeForm.performed_at}
                onChange={(e) => setCompleteForm({ ...completeForm, performed_at: e.target.value })}
              />
              <TextField
                fullWidth
                type="number"
                label="Odometer"
                value={completeForm.odometer_miles}
                onChange={(e) => setCompleteForm({ ...completeForm, odometer_miles: e.target.value })}
              />
            </Stack>
            <TextField
              label="Notes"
              multiline
              minRows={2}
              value={completeForm.notes}
              onChange={(e) => setCompleteForm({ ...completeForm, notes: e.target.value })}
            />
            {(completeVehicle?.interval_miles || completeVehicle?.interval_days) && (
              <Typography sx={{ color: SP.muted, fontSize: 12 }}>
                Next due will roll forward
                {completeVehicle.interval_miles ? ` by ${Math.round(completeVehicle.interval_miles).toLocaleString()} mi` : ""}
                {completeVehicle.interval_days ? ` / ${completeVehicle.interval_days} days` : ""}.
              </Typography>
            )}
            <PrimaryButton onClick={handleComplete} disabled={saving}>
              Save completed service
            </PrimaryButton>
          </Stack>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(historyVehicle)} onClose={() => setHistoryVehicle(null)} fullWidth maxWidth="sm">
        <DialogContent sx={{ p: 0 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ p: 2.5, borderBottom: `1px solid ${SP.line}` }}>
            <Box>
              <Typography sx={{ color: SP.blue, fontSize: 11, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase" }}>
                Service history
              </Typography>
              <Typography sx={{ fontSize: 22, fontWeight: 800, mt: 0.5 }}>
                {historyVehicle?.device_name || historyVehicle?.device_id}
              </Typography>
            </Box>
            <IconButton onClick={() => setHistoryVehicle(null)}><X size={18} /></IconButton>
          </Stack>
          <Box>
            {(historyVehicle?.logs || []).map((log) => (
              <Box key={log.id} sx={{ px: 2.5, py: 1.75, borderBottom: `1px solid ${SP.line}` }}>
                <Typography sx={{ fontSize: 13, fontWeight: 800 }}>{typeLabel(log.service_type)}</Typography>
                <Typography sx={{ color: SP.muted, fontSize: 12, mt: 0.35 }}>
                  {formatDay(log.performed_at)}
                  {log.odometer_miles != null ? ` · ${Math.round(log.odometer_miles).toLocaleString()} mi` : ""}
                </Typography>
                {log.notes ? <Typography sx={{ color: SP.slate, fontSize: 13, mt: 0.75 }}>{log.notes}</Typography> : null}
              </Box>
            ))}
          </Box>
        </DialogContent>
      </Dialog>
    </Box>
  );
}
