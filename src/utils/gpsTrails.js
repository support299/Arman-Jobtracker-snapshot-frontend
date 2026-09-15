/**
 * Client-side live GPS snail trails.
 * Append poll positions, prune by age, draw fading polylines on Google Maps.
 */

export const TRAIL_TTL_MS = 5 * 60 * 1000; // keep ~5 minutes of path
export const TRAIL_MIN_MOVE_M = 6; // ignore GPS jitter
export const TRAIL_MAX_POINTS = 80;

function haversineMeters(a, b) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * @param {Map<string, Array<{lat:number,lng:number,t:number}>>} trailMap
 * @param {Array<{device_id?:string,display_name?:string,lat:number,lng:number}>} devices
 * @param {number} now
 */
export function appendDeviceTrails(trailMap, devices, now = Date.now()) {
  const seen = new Set();

  devices.forEach((device) => {
    const id = String(device.device_id || device.display_name || "");
    if (!id || device.lat == null || device.lng == null) return;
    seen.add(id);

    const point = { lat: Number(device.lat), lng: Number(device.lng), t: now };
    if (Number.isNaN(point.lat) || Number.isNaN(point.lng)) return;

    let points = trailMap.get(id) || [];
    const last = points[points.length - 1];
    if (last) {
      const dist = haversineMeters(last, point);
      if (dist < TRAIL_MIN_MOVE_M) {
        // refresh timestamp on last point so idle devices don't look "moving"
        last.t = now;
      } else {
        points = [...points, point];
      }
    } else {
      points = [point];
    }

    const cutoff = now - TRAIL_TTL_MS;
    points = points.filter((p) => p.t >= cutoff);
    if (points.length > TRAIL_MAX_POINTS) {
      points = points.slice(points.length - TRAIL_MAX_POINTS);
    }
    trailMap.set(id, points);
  });

  // Drop trails for devices no longer in the feed
  for (const key of [...trailMap.keys()]) {
    if (!seen.has(key)) trailMap.delete(key);
  }
}

/**
 * Build fading polyline segments (older = more transparent).
 * @returns {Array<{path: Array<{lat:number,lng:number}>, opacity: number, color: string}>}
 */
export function buildFadingTrailSegments(points, { color = "#EF4444", bands = 5 } = {}) {
  if (!points || points.length < 2) return [];

  const n = points.length;
  const segments = [];
  const bandSize = Math.max(1, Math.ceil((n - 1) / bands));

  for (let i = 0; i < n - 1; i += bandSize) {
    const end = Math.min(n - 1, i + bandSize);
    const path = points.slice(i, end + 1).map((p) => ({ lat: p.lat, lng: p.lng }));
    if (path.length < 2) continue;
    // Newer bands (higher i) get higher opacity
    const bandIndex = Math.floor(i / bandSize);
    const opacity = 0.18 + (bandIndex / Math.max(bands - 1, 1)) * 0.72;
    segments.push({ path, opacity, color });
  }
  return segments;
}

export function clearMapOverlays(overlays) {
  (overlays || []).forEach((o) => o?.setMap?.(null));
}
