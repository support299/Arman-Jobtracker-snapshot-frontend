import { formatDateTime, formatDay, formatDuration } from "./fleetUi";

const BLUE = [8, 119, 249];
const INK = [24, 40, 60];
const MUTED = [120, 137, 156];
const LINE = [225, 232, 239];
const SOFT = [243, 246, 249];

function text(value, fallback = "—") {
  if (value == null || value === "") return fallback;
  return String(value);
}

function miles(value) {
  if (value == null || Number.isNaN(Number(value))) return "—";
  return `${Number(value).toLocaleString(undefined, { maximumFractionDigits: 1 })} mi`;
}

function speed(value) {
  if (value == null || Number.isNaN(Number(value))) return "—";
  return `${Math.round(Number(value))} mph`;
}

function dueLabel(status) {
  if (status === "overdue") return "Overdue";
  if (status === "due_soon") return "Due soon";
  if (status === "fault") return "Fault";
  return "Healthy";
}

function periodLabel(data) {
  const start = data?.period_start ? formatDay(data.period_start) : "";
  const end = data?.period_end ? formatDay(data.period_end) : "";
  if (start && end) return `${start} – ${end}`;
  return "Last 30 days";
}

function addPageIfNeeded(doc, y, needed = 24) {
  const pageHeight = doc.internal.pageSize.getHeight();
  if (y + needed < pageHeight - 28) return y;
  doc.addPage();
  return 22;
}

function drawFooter(doc, company) {
  const pageCount = doc.getNumberOfPages();
  const width = doc.internal.pageSize.getWidth();
  const height = doc.internal.pageSize.getHeight();
  for (let i = 1; i <= pageCount; i += 1) {
    doc.setPage(i);
    doc.setDrawColor(...LINE);
    doc.line(18, height - 16, width - 18, height - 16);
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text(company || "Fleet Center", 18, height - 10);
    doc.text(`Page ${i} of ${pageCount}`, width - 18, height - 10, { align: "right" });
  }
}

function drawHeader(doc, { title, company, data }) {
  const width = doc.internal.pageSize.getWidth();
  doc.setFillColor(...BLUE);
  doc.rect(0, 0, width, 28, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text((company || "Fleet Center").toUpperCase(), 18, 12);
  doc.setFontSize(16);
  doc.text(title, 18, 22);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(periodLabel(data), width - 18, 12, { align: "right" });
  doc.text(data?.generated_at ? `Generated ${formatDateTime(data.generated_at)}` : "", width - 18, 22, { align: "right" });
  return 38;
}

function drawKpis(doc, y, items) {
  const width = doc.internal.pageSize.getWidth();
  const gap = 6;
  const boxW = (width - 36 - gap * (items.length - 1)) / items.length;
  items.forEach((item, i) => {
    const x = 18 + i * (boxW + gap);
    doc.setFillColor(...SOFT);
    doc.roundedRect(x, y, boxW, 22, 2, 2, "F");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text(item.label, x + 4, y + 8);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(...INK);
    doc.text(text(item.value), x + 4, y + 17);
  });
  return y + 30;
}

function drawSection(doc, y, title) {
  y = addPageIfNeeded(doc, y, 16);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...INK);
  doc.text(title, 18, y);
  doc.setDrawColor(...BLUE);
  doc.setLineWidth(0.6);
  doc.line(18, y + 2, 70, y + 2);
  return y + 8;
}

function drawTable(doc, y, columns, rows) {
  const width = doc.internal.pageSize.getWidth() - 36;
  const rowH = 8;
  const drawHeaderRow = () => {
    doc.setFillColor(...BLUE);
    doc.rect(18, y, width, rowH, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(255, 255, 255);
    let x = 18;
    columns.forEach((col) => {
      const label = col.label;
      const align = col.align || "left";
      const tx = align === "right" ? x + col.width - 2 : x + 2;
      doc.text(label, tx, y + 5.5, { align: align === "right" ? "right" : "left" });
      x += col.width;
    });
    y += rowH;
  };

  if (!rows.length) {
    y = addPageIfNeeded(doc, y, 14);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...MUTED);
    doc.text("No records in this period.", 18, y + 4);
    return y + 12;
  }

  drawHeaderRow();
  rows.forEach((row, index) => {
    y = addPageIfNeeded(doc, y, rowH + 2);
    if (y === 22) drawHeaderRow();
    if (index % 2 === 0) {
      doc.setFillColor(250, 252, 254);
      doc.rect(18, y, width, rowH, "F");
    }
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...INK);
    let x = 18;
    columns.forEach((col) => {
      const raw = Array.isArray(row) ? row[col.key] : row[col.key];
      const value = text(raw).slice(0, col.max || 42);
      const align = col.align || "left";
      const tx = align === "right" ? x + col.width - 2 : x + 2;
      doc.text(value, tx, y + 5.5, { align: align === "right" ? "right" : "left" });
      x += col.width;
    });
    y += rowH;
  });
  return y + 8;
}

function fleetActivitySections(doc, y, payload) {
  y = drawKpis(doc, y, [
    { label: "Distance", value: miles(payload.distance_miles) },
    { label: "Drives", value: payload.trips ?? 0 },
    { label: "Stops", value: payload.stops ?? 0 },
    { label: "Drive time", value: formatDuration(payload.drive_seconds) },
  ]);
  y = drawKpis(doc, y, [
    { label: "Idle time", value: formatDuration(payload.idle_seconds) },
    { label: "Avg trip", value: miles(payload.avg_trip_miles) },
    { label: "Top speed", value: speed(payload.max_speed_mph) },
    { label: "Vehicles", value: (payload.vehicles || []).length },
  ]);

  y = drawSection(doc, y, "By vehicle");
  y = drawTable(doc, y, [
    { key: "device_name", label: "Vehicle", width: 44 },
    { key: "technician_name", label: "Driver", width: 32 },
    { key: "trips", label: "Trips", width: 18, align: "right" },
    { key: "stops", label: "Stops", width: 18, align: "right" },
    { key: "miles", label: "Miles", width: 24, align: "right" },
    { key: "drive", label: "Drive", width: 22, align: "right" },
    { key: "idle", label: "Idle", width: 22, align: "right" },
  ], (payload.vehicles || []).map((v) => ({
    device_name: v.device_name,
    technician_name: v.technician_name || "—",
    trips: v.trips,
    stops: v.stops,
    miles: miles(v.distance_miles),
    drive: formatDuration(v.drive_seconds),
    idle: formatDuration(v.idle_seconds),
  })));

  y = drawSection(doc, y, "Daily activity");
  y = drawTable(doc, y, [
    { key: "date", label: "Date", width: 36 },
    { key: "trips", label: "Trips", width: 28, align: "right" },
    { key: "stops", label: "Stops", width: 28, align: "right" },
    { key: "miles", label: "Miles", width: 36, align: "right" },
    { key: "idle", label: "Idle", width: 52, align: "right" },
  ], (payload.by_day || []).filter((d) => d.trips || d.stops || d.distance_miles).map((d) => ({
    date: formatDay(d.date),
    trips: d.trips,
    stops: d.stops,
    miles: miles(d.distance_miles),
    idle: formatDuration(d.idle_seconds),
  })));

  y = drawSection(doc, y, "Recent drives & stops");
  return drawTable(doc, y, [
    { key: "when", label: "When", width: 36 },
    { key: "kind", label: "Type", width: 18 },
    { key: "device_name", label: "Vehicle", width: 32 },
    { key: "miles", label: "Miles", width: 22, align: "right" },
    { key: "duration", label: "Time", width: 22, align: "right" },
    { key: "route", label: "Route", width: 50, max: 38 },
  ], (payload.recent_trips || []).map((t) => ({
    when: formatDateTime(t.started_at),
    kind: t.kind === "stop" ? "Stop" : "Drive",
    device_name: t.device_name,
    miles: t.kind === "stop" ? "—" : miles(t.distance_miles),
    duration: formatDuration(t.duration_seconds),
    route: [t.start_address, t.end_address].filter(Boolean).join(" → ") || "—",
  })));
}

function safetySections(doc, y, payload) {
  y = drawKpis(doc, y, [
    { label: "Safety events", value: payload.events ?? 0 },
    { label: "Speeding", value: payload.speeding ?? 0 },
    { label: "Harsh driving", value: payload.harsh ?? 0 },
    { label: "Open alerts", value: payload.open ?? 0 },
  ]);
  y = drawKpis(doc, y, [
    { label: "All alerts", value: payload.total_alerts ?? 0 },
    { label: "Critical", value: payload.critical ?? 0 },
    { label: "Warning", value: payload.warning ?? 0 },
    { label: "Acknowledged", value: payload.acknowledged ?? 0 },
  ]);

  y = drawSection(doc, y, "By vehicle / driver");
  y = drawTable(doc, y, [
    { key: "device_name", label: "Vehicle", width: 50 },
    { key: "technician_name", label: "Driver", width: 36 },
    { key: "events", label: "Alerts", width: 22, align: "right" },
    { key: "speeding", label: "Speeding", width: 26, align: "right" },
    { key: "harsh", label: "Harsh", width: 22, align: "right" },
    { key: "max_speed", label: "Top speed", width: 24, align: "right" },
  ], (payload.by_driver || []).map((d) => ({
    device_name: d.device_name,
    technician_name: d.technician_name || "—",
    events: d.events,
    speeding: d.speeding,
    harsh: d.harsh,
    max_speed: speed(d.max_speed_mph),
  })));

  y = drawSection(doc, y, "Recent alerts");
  return drawTable(doc, y, [
    { key: "when", label: "When", width: 36 },
    { key: "severity", label: "Sev", width: 20 },
    { key: "alert_name", label: "Alert", width: 48, max: 34 },
    { key: "device_name", label: "Vehicle", width: 32 },
    { key: "speed", label: "Speed", width: 22, align: "right" },
    { key: "ack", label: "Ack", width: 24, align: "right" },
  ], (payload.recent_alerts || []).map((a) => ({
    when: formatDateTime(a.alert_time),
    severity: a.severity || "warning",
    alert_name: a.alert_name,
    device_name: a.device_name,
    speed: speed(a.speed_mph),
    ack: a.acknowledged ? "Yes" : "No",
  })));
}

function maintenanceSections(doc, y, payload) {
  y = drawKpis(doc, y, [
    { label: "Monitored", value: payload.vehicles ?? 0 },
    { label: "Need attention", value: payload.need_attention ?? 0 },
    { label: "Overdue", value: payload.overdue ?? 0 },
    { label: "Due soon", value: payload.due_soon ?? 0 },
  ]);

  y = drawSection(doc, y, "Vehicle health");
  y = drawTable(doc, y, [
    { key: "device_name", label: "Vehicle", width: 36 },
    { key: "status", label: "Status", width: 24 },
    { key: "odometer", label: "Odometer", width: 28, align: "right" },
    { key: "fuel", label: "Fuel", width: 18, align: "right" },
    { key: "next", label: "Next service", width: 40 },
    { key: "dtc", label: "DTCs", width: 36, max: 24 },
  ], (payload.vehicles_detail || []).map((v) => ({
    device_name: v.device_name,
    status: dueLabel(v.due_status),
    odometer: v.odometer_miles != null ? miles(v.odometer_miles) : "—",
    fuel: v.fuel_level_percent != null ? `${Math.round(v.fuel_level_percent)}%` : "—",
    next: [v.next_service_at ? formatDay(v.next_service_at) : "", v.next_service_miles != null ? miles(v.next_service_miles) : ""].filter(Boolean).join(" · ") || "Not set",
    dtc: (v.dtc_codes || []).join(", ") || "None",
  })));

  y = drawSection(doc, y, "Service log");
  return drawTable(doc, y, [
    { key: "when", label: "When", width: 40 },
    { key: "device_name", label: "Vehicle", width: 40 },
    { key: "service_type", label: "Type", width: 32 },
    { key: "odometer", label: "Odometer", width: 28, align: "right" },
    { key: "notes", label: "Notes", width: 42, max: 30 },
  ], (payload.recent_service || []).map((s) => ({
    when: formatDay(s.performed_at),
    device_name: s.device_name,
    service_type: s.service_type,
    odometer: s.odometer_miles != null ? miles(s.odometer_miles) : "—",
    notes: s.notes || "—",
  })));
}

function locationSections(doc, y, payload) {
  y = drawKpis(doc, y, [
    { label: "Geofence events", value: payload.geofence_events ?? 0 },
    { label: "Active zones", value: payload.active_geofences ?? 0 },
    { label: "Entry", value: payload.entry_events ?? 0 },
    { label: "Exit", value: payload.exit_events ?? 0 },
  ]);

  y = drawSection(doc, y, "Geofences");
  y = drawTable(doc, y, [
    { key: "name", label: "Zone", width: 50 },
    { key: "radius", label: "Radius", width: 24, align: "right" },
    { key: "coords", label: "Center", width: 50 },
    { key: "rules", label: "Alerts", width: 58 },
  ], (payload.zones || []).map((z) => ({
    name: z.name,
    radius: miles(z.radius_miles),
    coords: z.latitude != null ? `${z.latitude}, ${z.longitude}` : "—",
    rules: [z.trigger_entry ? "Entry" : null, z.trigger_exit ? "Exit" : null, z.after_hours ? "After hours" : null].filter(Boolean).join(", ") || "—",
  })));

  y = drawSection(doc, y, "Recent location events");
  return drawTable(doc, y, [
    { key: "when", label: "When", width: 40 },
    { key: "alert_name", label: "Event", width: 55, max: 38 },
    { key: "device_name", label: "Vehicle", width: 40 },
    { key: "location", label: "Location", width: 47, max: 32 },
  ], (payload.recent_events || []).map((e) => ({
    when: formatDateTime(e.alert_time),
    alert_name: e.alert_name,
    device_name: e.device_name,
    location: e.location || "—",
  })));
}

const REPORTS = {
  fleet_activity: { title: "Fleet activity report", build: fleetActivitySections },
  driver_safety: { title: "Driver safety report", build: safetySections },
  maintenance_health: { title: "Maintenance health report", build: maintenanceSections },
  location_activity: { title: "Location activity report", build: locationSections },
};

export async function downloadFleetReportPdf(key, data) {
  const spec = REPORTS[key];
  if (!spec) return;
  const report = data || {};
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "letter" });
  const company = report.account?.company_name || "Fleet Center";
  const payload = report[key] || {};
  let y = drawHeader(doc, { title: spec.title, company, data: report });
  y = spec.build(doc, y, payload);
  drawFooter(doc, company);
  const day = report.period_end ? formatDay(report.period_end).replace(/[^a-z0-9]+/gi, "-") : "30d";
  doc.save(`fleet-${key}-${day}.pdf`);
}
