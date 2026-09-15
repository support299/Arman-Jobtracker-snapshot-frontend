/** Service Pilot Fleet Center tokens — match Arman’s prototype. */
export const SP = {
  blue: "#0877f9",
  blueSoft: "#eaf3ff",
  green: "#00a941",
  greenSoft: "#e7f8ee",
  amber: "#e99117",
  amberSoft: "#fff4df",
  red: "#d93a49",
  redSoft: "#fff0f1",
  ink: "#18283c",
  slate: "#4e6075",
  muted: "#78899c",
  line: "#e1e8ef",
  soft: "#f3f6f9",
  page: "#f7f9fb",
  shadow: "0 1px 2px rgba(16, 36, 58, 0.05), 0 6px 18px rgba(16, 36, 58, 0.04)",
};

export const TONE = {
  blue: { bg: SP.blueSoft, fg: SP.blue },
  green: { bg: SP.greenSoft, fg: SP.green },
  amber: { bg: SP.amberSoft, fg: SP.amber },
  red: { bg: SP.redSoft, fg: SP.red },
};

export function formatDuration(seconds) {
  if (seconds == null || Number.isNaN(Number(seconds))) return "—";
  const s = Math.max(0, Math.round(Number(seconds)));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

function safeDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDay(value) {
  const date = safeDate(value);
  if (!date) return "";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(date);
}

export function formatDateTime(value) {
  const date = safeDate(value);
  if (!date) return "";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function formatClock(value) {
  const date = safeDate(value);
  if (!date) return "";
  return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(date);
}

export function coordsLabel(lat, lng) {
  const a = Number(lat);
  const b = Number(lng);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return "";
  return `${a.toFixed(5)}, ${b.toFixed(5)}`;
}

export function placeLabel(address, lat, lng, fallback = "Location unavailable") {
  const text = String(address || "").trim();
  if (text) return text;
  return coordsLabel(lat, lng) || fallback;
}

export function relativeTime(value) {
  if (!value) return "—";
  const minutes = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 60_000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  return `${Math.round(minutes / 60)} hr ago`;
}
