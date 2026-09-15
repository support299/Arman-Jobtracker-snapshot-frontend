import { Box, Button, Dialog, DialogContent, IconButton, Stack, Typography } from "@mui/material";
import { useMemo, useState } from "react";
import { useSelector } from "react-redux";
import moment from "moment-timezone";
import { Briefcase, CheckCircle2, ChevronLeft, ChevronRight, Clock3, ExternalLink, History, MapPin, Play, Route, X } from "lucide-react";
import { useGetCalendarJobsQuery } from "../../../store/api/jobsApi";
import { useGetEmployeesQuery } from "../../../store/api/payrollApi";
import { useGetFleetAssignmentsQuery, useGetFleetTripsQuery } from "../../../store/api/onestepgpsApi";
import MapJobCardWrapper from "../../../components/admin/jobs/MapJobCardWrapper";
import { useAccountTimezone } from "../../../hooks/useAccountTimezone";
import { FilterPills, FleetSectionHeader, LoadingBlock, MetricCard, OperationsEmpty, OperationsPanel } from "./FleetPrimitives";
import { SP, coordsLabel, formatClock, formatDateTime, formatDuration, placeLabel } from "./fleetUi";

const MANAGEMENT_ROLES = ["admin", "manager", "supervisor"];
const DONE_STATUSES = new Set(["completed", "cancelled"]);
const OPEN_STATUSES = new Set([
  "pending",
  "confirmed",
  "to_convert",
  "reschedule_pending",
  "service_due",
  "onhold",
]);

function usableName(value) {
  if (value == null) return "";
  const text = String(value).trim();
  if (!text) return "";
  if (["n/a", "na", "n.a.", "n.a", "none", "unknown", "customer"].includes(text.toLowerCase())) return "";
  return text;
}

function jobDisplayName(job) {
  return usableName(job?.company_name) || usableName(job?.customer_name) || usableName(job?.title) || "Job";
}

function jobEndAt(job) {
  const start = job?.scheduled_at ? new Date(job.scheduled_at) : null;
  if (!start || Number.isNaN(start.getTime())) return null;
  const hours = Number(job.duration_hours);
  const ms = Number.isFinite(hours) && hours > 0 ? hours * 3600000 : 60 * 60 * 1000;
  return new Date(start.getTime() + ms);
}

function statusMeta(status) {
  const key = String(status || "pending");
  if (key === "completed") return { label: "Completed", bg: SP.greenSoft, fg: SP.green };
  if (key === "next") return { label: "Next", bg: SP.blueSoft, fg: SP.blue };
  if (key === "in_progress") return { label: "In progress", bg: SP.blueSoft, fg: SP.blue };
  if (key === "on_the_way") return { label: "On the way", bg: SP.blueSoft, fg: SP.blue };
  if (key === "overdue") return { label: "Overdue", bg: SP.redSoft, fg: SP.red };
  if (key === "cancelled") return { label: "Cancelled", bg: SP.soft, fg: SP.muted };
  if (key === "onhold") return { label: "On hold", bg: SP.amberSoft, fg: SP.amber };
  if (key === "upcoming") return { label: "Upcoming", bg: SP.soft, fg: SP.slate };
  return { label: "Pending", bg: SP.amberSoft, fg: SP.amber };
}

function decorateJobs(jobs, now) {
  const sorted = [...jobs].sort((a, b) => {
    const aTime = new Date(a.scheduled_at || 0).getTime();
    const bTime = new Date(b.scheduled_at || 0).getTime();
    return aTime - bTime;
  });
  const nextJob = sorted.find((job) => {
    const status = String(job.status || "pending");
    if (DONE_STATUSES.has(status)) return false;
    if (status === "in_progress" || status === "on_the_way") return false;
    return OPEN_STATUSES.has(status) || !status;
  });
  const nextId = nextJob?.job_id || nextJob?.id;

  return sorted.map((job) => {
    const raw = String(job.status || "pending");
    let derived = raw;
    if (raw === "completed" || raw === "cancelled" || raw === "in_progress" || raw === "on_the_way" || raw === "onhold") {
      derived = raw;
    } else if (String(job.job_id || job.id) === String(nextId)) {
      derived = "next";
    } else {
      const end = jobEndAt(job);
      const start = job.scheduled_at ? new Date(job.scheduled_at) : null;
      if (end && end.getTime() < now.getTime()) derived = "overdue";
      else if (start && start.getTime() > now.getTime()) derived = "upcoming";
      else derived = "pending";
    }
    return { ...job, derivedStatus: derived };
  });
}

function assigneeLabel(job, employees) {
  const ids = (job.assigned_user_ids || []).map(String);
  if (!ids.length) return "Unassigned";
  const names = employees
    .filter((emp) => ids.includes(String(emp.user_id ?? emp.id)))
    .map((emp) => `${emp.first_name || ""} ${emp.last_name || ""}`.trim() || emp.full_name || emp.email)
    .filter(Boolean);
  return names.join(", ") || "Assigned";
}

function mapsUrl(lat, lng) {
  return `https://www.google.com/maps?q=${encodeURIComponent(`${lat},${lng}`)}`;
}

function ShiftDay({ dayKey, tz, onChange }) {
  const day = moment.tz(dayKey, tz);
  const todayKey = moment.tz(tz).format("YYYY-MM-DD");
  return (
    <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
      <IconButton
        size="small"
        onClick={() => onChange(day.clone().subtract(1, "day").format("YYYY-MM-DD"))}
        sx={{ border: `1px solid ${SP.line}`, borderRadius: "10px" }}
      >
        <ChevronLeft size={16} />
      </IconButton>
      <Box sx={{ minWidth: 160, textAlign: "center" }}>
        <Typography sx={{ fontSize: 15, fontWeight: 800, color: SP.ink }}>
          {day.format("ddd, MMM D")}
        </Typography>
        <Typography sx={{ color: SP.muted, fontSize: 11 }}>{day.year()}</Typography>
      </Box>
      <IconButton
        size="small"
        onClick={() => onChange(day.clone().add(1, "day").format("YYYY-MM-DD"))}
        sx={{ border: `1px solid ${SP.line}`, borderRadius: "10px" }}
      >
        <ChevronRight size={16} />
      </IconButton>
      {dayKey !== todayKey && (
        <Button
          onClick={() => onChange(todayKey)}
          sx={{ textTransform: "none", fontWeight: 800, color: SP.blue }}
        >
          Today
        </Button>
      )}
    </Stack>
  );
}

function StatusChip({ status }) {
  const meta = statusMeta(status);
  return (
    <Box sx={{ bgcolor: meta.bg, color: meta.fg, fontSize: 10, fontWeight: 800, px: 1, py: 0.25, borderRadius: 999, textTransform: "uppercase", whiteSpace: "nowrap" }}>
      {meta.label}
    </Box>
  );
}

export default function FleetTripsTab({ recordCount = 0 }) {
  const user = useSelector((state) => state.auth.user);
  const tz = useAccountTimezone();
  const userRole = user?.role || "worker";
  const isManagementUser = MANAGEMENT_ROLES.includes(userRole);
  const [dayKey, setDayKey] = useState(() => moment.tz(tz).format("YYYY-MM-DD"));
  const [jobFilter, setJobFilter] = useState("all");
  const [selectedTrip, setSelectedTrip] = useState(null);
  const [detailsJobId, setDetailsJobId] = useState(null);

  const dayStart = useMemo(() => moment.tz(dayKey, tz).startOf("day"), [dayKey, tz]);
  const dayEnd = useMemo(() => moment.tz(dayKey, tz).endOf("day"), [dayKey, tz]);
  const range = useMemo(
    () => ({ start: dayStart.toISOString(), end: dayEnd.toISOString() }),
    [dayStart, dayEnd],
  );

  const { data: employeesData } = useGetEmployeesQuery({ is_active: true }, { skip: !isManagementUser });
  const employees = employeesData?.results || [];
  const { data: assignmentsData } = useGetFleetAssignmentsQuery(undefined, { skip: !isManagementUser });

  const jobParams = useMemo(() => {
    const params = { start: range.start, end: range.end };
    if (isManagementUser) params.scope = "all";
    return params;
  }, [range.start, range.end, isManagementUser]);

  const { data: jobsData, isLoading: jobsLoading } = useGetCalendarJobsQuery(jobParams, { pollingInterval: 30000 });
  const { data: tripsData, isLoading: tripsLoading } = useGetFleetTripsQuery(range, { pollingInterval: 30000 });

  const rawJobs = Array.isArray(jobsData) ? jobsData : jobsData?.results || [];
  const jobs = useMemo(() => decorateJobs(rawJobs, new Date()), [rawJobs]);
  const trips = tripsData?.results || [];
  const totals = tripsData?.totals || {};

  const filteredJobs = useMemo(() => {
    return jobs.filter((job) => {
      if (jobFilter === "next") return job.derivedStatus === "next";
      if (jobFilter === "pending") return ["pending", "upcoming", "overdue", "next", "confirmed"].includes(job.derivedStatus);
      if (jobFilter === "active") return ["in_progress", "on_the_way"].includes(job.derivedStatus);
      if (jobFilter === "completed") return job.derivedStatus === "completed";
      return true;
    });
  }, [jobs, jobFilter]);

  const completedCount = jobs.filter((job) => job.derivedStatus === "completed").length;
  const remainingCount = jobs.filter((job) => !DONE_STATUSES.has(String(job.status || ""))).length;
  const nextJob = jobs.find((job) => job.derivedStatus === "next") || jobs.find((job) => job.derivedStatus === "in_progress" || job.derivedStatus === "on_the_way");

  const deviceToUser = useMemo(() => {
    const map = {};
    (assignmentsData?.results || []).forEach((row) => {
      if (row.device_id && row.user) map[row.device_id] = String(row.user);
    });
    return map;
  }, [assignmentsData]);

  const jobForTrip = (trip) => {
    const t0 = new Date(trip.started_at).getTime();
    const t1 = trip.ended_at ? new Date(trip.ended_at).getTime() : t0;
    if (!Number.isFinite(t0)) return null;
    const userId = deviceToUser[trip.device_id];
    return jobs.find((job) => {
      if (DONE_STATUSES.has(String(job.status || ""))) return false;
      if (userId) {
        const ids = (job.assigned_user_ids || []).map(String);
        if (ids.length && !ids.includes(userId)) return false;
      }
      const start = new Date(job.scheduled_at).getTime();
      const end = jobEndAt(job)?.getTime() || start;
      return Number.isFinite(start) && t0 < end && t1 > start;
    });
  };

  return (
    <Box>
      <FleetSectionHeader
        eyebrow="Route history"
        title="Trips & stops"
        description={
          isManagementUser
            ? "Jobs for the selected day, ordered by schedule time, plus GPS drives and stops."
            : "Your jobs for the selected day, ordered by schedule time, plus GPS drives and stops."
        }
        count={jobs.length || tripsData?.count || recordCount}
      />

      <ShiftDay dayKey={dayKey} tz={tz} onChange={setDayKey} />

      <Stack direction={{ xs: "column", sm: "row" }} spacing={1.75} sx={{ mb: 2 }}>
        <MetricCard icon={Briefcase} label="Jobs" value={jobs.length} hint={isManagementUser ? "All techs this day" : "Assigned to you"} tone="blue" />
        <MetricCard icon={CheckCircle2} label="Completed" value={completedCount} tone="green" />
        <MetricCard icon={Clock3} label="Remaining" value={remainingCount} tone="amber" />
        <MetricCard
          icon={Play}
          label="Next"
          value={nextJob ? formatClock(nextJob.scheduled_at) : "—"}
          hint={nextJob ? jobDisplayName(nextJob) : "No upcoming job"}
          tone="blue"
        />
      </Stack>

      <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ mb: 2 }} alignItems="center">
        <FilterPills
          value={jobFilter}
          onChange={setJobFilter}
          options={[
            { id: "all", label: "All jobs" },
            { id: "next", label: "Next" },
            { id: "pending", label: "Pending" },
            { id: "active", label: "In progress" },
            { id: "completed", label: "Completed" },
          ]}
        />
      </Stack>

      <OperationsPanel
        title="Scheduled jobs"
        subtitle={isManagementUser ? "Everyone’s jobs, earliest schedule first" : "Your jobs, earliest schedule first"}
        icon={Briefcase}
        minHeight={220}
      >
        {jobsLoading ? (
          <LoadingBlock />
        ) : filteredJobs.length === 0 ? (
          <OperationsEmpty icon={Briefcase} label={jobs.length ? "No jobs match this filter." : "No jobs scheduled for this day."} />
        ) : (
          filteredJobs.map((job) => {
            const end = jobEndAt(job);
            return (
              <Box
                key={job.job_id || job.id}
                onClick={() => setDetailsJobId(job.job_id || job.id)}
                sx={{
                  display: "grid",
                  gridTemplateColumns: { xs: "40px 1fr", sm: "42px minmax(0,1fr) auto" },
                  gap: 1.5,
                  alignItems: "center",
                  px: 2.25,
                  py: 1.75,
                  borderBottom: `1px solid ${SP.line}`,
                  cursor: "pointer",
                  "&:last-child": { borderBottom: 0 },
                  "&:hover": { bgcolor: SP.soft },
                }}
              >
                <Box sx={{ width: 40, height: 40, borderRadius: "11px", bgcolor: statusMeta(job.derivedStatus).bg, color: statusMeta(job.derivedStatus).fg, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Briefcase size={17} />
                </Box>
                <Box sx={{ minWidth: 0 }}>
                  <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                    <Typography sx={{ fontSize: 13, fontWeight: 800, color: SP.ink }}>{jobDisplayName(job)}</Typography>
                    <StatusChip status={job.derivedStatus} />
                  </Stack>
                  <Typography sx={{ color: SP.slate, fontSize: 12, mt: 0.75, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {job.job_address || "Address not set"}
                  </Typography>
                  <Typography sx={{ color: SP.muted, fontSize: 11, mt: 0.5 }}>
                    {formatClock(job.scheduled_at)}
                    {end ? ` – ${formatClock(end)}` : ""}
                    {isManagementUser ? ` · ${assigneeLabel(job, employees)}` : ""}
                  </Typography>
                </Box>
                <Typography sx={{ display: { xs: "none", sm: "block" }, color: SP.blue, fontSize: 12, fontWeight: 800 }}>
                  Open
                </Typography>
              </Box>
            );
          })
        )}
      </OperationsPanel>

      <Stack direction={{ xs: "column", sm: "row" }} spacing={1.75} sx={{ my: 2 }}>
        <MetricCard icon={Route} label="Distance" value={`${totals.distance_miles ?? 0} mi`} tone="blue" />
        <MetricCard icon={History} label="Drive time" value={formatDuration(totals.drive_seconds)} tone="green" />
        <MetricCard icon={MapPin} label="Stops" value={totals.stops ?? 0} tone="amber" />
      </Stack>

      <OperationsPanel title="GPS activity" subtitle="Drives and stops for this day" icon={History}>
        {tripsLoading ? (
          <LoadingBlock />
        ) : trips.length === 0 ? (
          <OperationsEmpty icon={History} label="No GPS drives or stops for this day yet. They appear after OneStep DataQueue sends activity." />
        ) : (
          trips.map((trip) => {
            const stop = trip.kind === "stop";
            const matched = jobForTrip(trip);
            const startText = placeLabel(trip.start_address, trip.start_latitude, trip.start_longitude);
            const endText = placeLabel(trip.end_address, trip.end_latitude, trip.end_longitude);
            return (
              <Box
                key={trip.id}
                sx={{
                  display: "grid",
                  gridTemplateColumns: { xs: "40px 1fr", sm: "42px minmax(0,1fr) 140px" },
                  gap: 1.5,
                  alignItems: "center",
                  px: 2.25,
                  py: 1.75,
                  borderBottom: `1px solid ${SP.line}`,
                  "&:last-child": { borderBottom: 0 },
                }}
              >
                <Box
                  sx={{
                    width: 40,
                    height: 40,
                    borderRadius: "11px",
                    bgcolor: stop ? SP.amberSoft : SP.blueSoft,
                    color: stop ? SP.amber : SP.blue,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {stop ? <MapPin size={17} /> : <Route size={17} />}
                </Box>
                <Box sx={{ minWidth: 0 }}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Typography sx={{ fontSize: 13, fontWeight: 800, color: SP.ink }}>
                      {trip.device_name || trip.device_id}
                    </Typography>
                    <Box sx={{ bgcolor: SP.soft, color: SP.muted, fontSize: 10, fontWeight: 800, px: 1, py: 0.25, borderRadius: 999, textTransform: "uppercase" }}>
                      {stop ? "Stop" : "Drive"}
                    </Box>
                    {matched && <StatusChip status={matched.derivedStatus} />}
                  </Stack>
                  <Typography sx={{ color: SP.slate, fontSize: 12, mt: 0.75, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {startText}{" "}
                    <Box component="span" sx={{ color: SP.blue, fontWeight: 800, mx: 0.5 }}>→</Box>
                    {endText}
                  </Typography>
                  {matched && (
                    <Typography sx={{ color: SP.blue, fontSize: 11, mt: 0.35, fontWeight: 700 }}>
                      Likely job: {jobDisplayName(matched)}
                    </Typography>
                  )}
                  <Typography sx={{ color: SP.muted, fontSize: 11, mt: 0.5 }}>
                    {formatDateTime(trip.started_at)}
                    {trip.ended_at ? ` – ${formatClock(trip.ended_at)}` : ""}
                  </Typography>
                </Box>
                <Box sx={{ textAlign: { sm: "right" }, gridColumn: { xs: "2", sm: "auto" } }}>
                  <Typography sx={{ fontSize: 15, fontWeight: 800, color: SP.ink }}>
                    {stop ? formatDuration(trip.duration_seconds) : `${trip.distance_miles != null ? Number(trip.distance_miles).toFixed(1) : "0.0"} mi`}
                  </Typography>
                  <Typography sx={{ color: SP.slate, fontSize: 12, mt: 0.25 }}>
                    {stop ? "Stopped" : formatDuration(trip.duration_seconds)}
                    {trip.idle_seconds ? ` · idle ${formatDuration(trip.idle_seconds)}` : ""}
                  </Typography>
                  <Button
                    onClick={() => setSelectedTrip(trip)}
                    sx={{ mt: 0.75, p: 0, minWidth: 0, color: SP.blue, fontSize: 12, fontWeight: 800, textTransform: "none" }}
                    startIcon={<Play size={12} />}
                  >
                    Replay
                  </Button>
                </Box>
              </Box>
            );
          })
        )}
      </OperationsPanel>

      <Dialog open={Boolean(detailsJobId)} onClose={() => setDetailsJobId(null)} maxWidth="sm" fullWidth>
        <DialogContent sx={{ p: 0 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ px: 2, pt: 1.5 }}>
            <Typography sx={{ fontSize: 16, fontWeight: 800 }}>Job details</Typography>
            <IconButton onClick={() => setDetailsJobId(null)}><X size={18} /></IconButton>
          </Stack>
          {detailsJobId && (
            <MapJobCardWrapper jobId={detailsJobId} users={employees} embeddedInPanel />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(selectedTrip)} onClose={() => setSelectedTrip(null)} maxWidth="sm" fullWidth>
        <DialogContent sx={{ p: 0 }}>
          {selectedTrip && (
            <Box>
              <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ p: 2.5, borderBottom: `1px solid ${SP.line}` }}>
                <Box>
                  <Typography sx={{ color: SP.blue, fontSize: 11, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase" }}>
                    Trip replay
                  </Typography>
                  <Typography sx={{ fontSize: 22, fontWeight: 800, color: SP.ink, mt: 0.5 }}>
                    {selectedTrip.device_name || selectedTrip.device_id}
                  </Typography>
                </Box>
                <IconButton onClick={() => setSelectedTrip(null)}><X size={18} /></IconButton>
              </Stack>
              <Box sx={{ p: 2.5 }}>
                <Box
                  sx={{
                    height: 180,
                    borderRadius: "14px",
                    border: `1px solid ${SP.line}`,
                    bgcolor: "#e9eff1",
                    position: "relative",
                    overflow: "hidden",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    px: 2,
                    textAlign: "center",
                  }}
                >
                  <Box>
                    <Typography sx={{ fontSize: 13, fontWeight: 800, color: SP.ink }}>
                      {placeLabel(selectedTrip.start_address, selectedTrip.start_latitude, selectedTrip.start_longitude)}
                    </Typography>
                    <Typography sx={{ color: SP.blue, fontWeight: 800, my: 0.5 }}>→</Typography>
                    <Typography sx={{ fontSize: 13, fontWeight: 800, color: SP.ink }}>
                      {placeLabel(selectedTrip.end_address, selectedTrip.end_latitude, selectedTrip.end_longitude)}
                    </Typography>
                  </Box>
                </Box>
                {(selectedTrip.start_latitude != null || selectedTrip.end_latitude != null) && (
                  <Button
                    startIcon={<ExternalLink size={14} />}
                    onClick={() => {
                      const lat = selectedTrip.end_latitude ?? selectedTrip.start_latitude;
                      const lng = selectedTrip.end_longitude ?? selectedTrip.start_longitude;
                      window.open(mapsUrl(lat, lng), "_blank", "noopener,noreferrer");
                    }}
                    sx={{ mt: 1.5, textTransform: "none", fontWeight: 800, color: SP.blue }}
                  >
                    Open in Google Maps
                  </Button>
                )}
                <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1, mt: 2 }}>
                  {[
                    ["Started", formatDateTime(selectedTrip.started_at)],
                    ["Distance", `${Number(selectedTrip.distance_miles || 0).toFixed(1)} mi`],
                    ["Drive time", formatDuration(selectedTrip.duration_seconds)],
                    ["Maximum speed", selectedTrip.max_speed_mph != null ? `${Math.round(selectedTrip.max_speed_mph)} mph` : "Unavailable"],
                  ].map(([label, value]) => (
                    <Box key={label} sx={{ bgcolor: SP.soft, borderRadius: "9px", p: 1.25 }}>
                      <Typography sx={{ color: SP.muted, fontSize: 11 }}>{label}</Typography>
                      <Typography sx={{ fontSize: 13, fontWeight: 800 }}>{value}</Typography>
                    </Box>
                  ))}
                </Box>
                {coordsLabel(selectedTrip.start_latitude, selectedTrip.start_longitude) && (
                  <Typography sx={{ color: SP.muted, fontSize: 11, mt: 1.5 }}>
                    Start {coordsLabel(selectedTrip.start_latitude, selectedTrip.start_longitude)}
                    {coordsLabel(selectedTrip.end_latitude, selectedTrip.end_longitude)
                      ? ` · End ${coordsLabel(selectedTrip.end_latitude, selectedTrip.end_longitude)}`
                      : ""}
                  </Typography>
                )}
              </Box>
            </Box>
          )}
        </DialogContent>
      </Dialog>
    </Box>
  );
}
