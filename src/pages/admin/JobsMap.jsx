"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Box, Typography, Button, Badge, Chip, IconButton, Tooltip, useMediaQuery, useTheme } from "@mui/material";
import { FilterIcon, Settings as SettingsIcon, PanelLeftClose, PanelLeft, X } from "lucide-react";
import { Loader } from "@googlemaps/js-api-loader";
import { MarkerClusterer } from "@googlemaps/markerclusterer";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns";
import { useGetCalendarJobsQuery, useGetEstimateAppointmentsCalendarQuery, useGetSubaccountOfficeQuery } from "../../store/api/jobsApi";
import { useGetDevicesQuery, useGetFleetGeofencesQuery, useGetSettingsQuery } from "../../store/api/onestepgpsApi";
import { useGetEmployeesQuery } from "../../store/api/payrollApi";
import { useDispatch, useSelector } from "react-redux";
import { geocodeJobs, getEstimateAddress, geocodeAddress } from "../../utils/geocode";
import { FilterSidebar } from "./FilterSibdebar";
import MapJobCardWrapper from "../../components/admin/jobs/MapJobCardWrapper";
import MapEstimateDetailsContent from "../../components/admin/jobs/MapEstimateDetailsContent";
import { EditJobDialog } from "../../components/admin/jobs/EditJobDialog";
import OneStepGPSSettingsDialog from "../../components/admin/jobs/OneStepGPSSettingsDialog";
import MapOpsPanel from "../../components/admin/jobs/MapOpsPanel";
import { jobsApi } from "../../store/api/jobsApi";
import { startOfDay, endOfDay } from "date-fns";
import {
  appendDeviceTrails,
  buildFadingTrailSegments,
  clearMapOverlays,
} from "../../utils/gpsTrails";

const MAP_DEFAULT_CENTER = { lat: 29.7604, lng: -95.3698 }; // Houston, TX
const MAP_DEFAULT_ZOOM = 10;
const MANAGEMENT_ROLES = ["admin", "manager", "supervisor"];
const MAP_DETAIL_PANEL_WIDTH = 560;

/** Larger, high-contrast vehicle pin (SVG data URL) with heading rotation via Marker. */
function buildVehicleMarkerIcon({ fill, heading = 0, size = 52 }) {
  const svg = encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 64 64">
      <defs>
        <filter id="s" x="-40%" y="-40%" width="180%" height="180%">
          <feDropShadow dx="0" dy="2" stdDeviation="2.5" flood-color="#0B1726" flood-opacity="0.35"/>
        </filter>
      </defs>
      <g filter="url(#s)" transform="rotate(${Number.isFinite(heading) ? heading : 0} 32 32)">
        <circle cx="32" cy="32" r="22" fill="${fill}" stroke="#FFFFFF" stroke-width="5"/>
        <circle cx="32" cy="32" r="22" fill="none" stroke="rgba(11,23,38,0.18)" stroke-width="1.5"/>
        <path d="M32 14 L46 42 L32 36 L18 42 Z" fill="#FFFFFF"/>
      </g>
    </svg>
  `.trim());
  return {
    url: `data:image/svg+xml;charset=UTF-8,${svg}`,
    scaledSize: new google.maps.Size(size, size),
    anchor: new google.maps.Point(size / 2, size / 2),
    labelOrigin: new google.maps.Point(size / 2, -6),
  };
}

function vehicleFillColor(device, moving) {
  if (!device.online) return "#64748B";
  if (moving) return "#16A34A";
  return "#0F766E";
}

/** Distinct office / HQ pin for the subaccount business address. */
function buildOfficeMarkerIcon({ size = 48 }) {
  const svg = encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 64 64">
      <defs>
        <filter id="o" x="-40%" y="-40%" width="180%" height="180%">
          <feDropShadow dx="0" dy="2" stdDeviation="2.5" flood-color="#0B1726" flood-opacity="0.35"/>
        </filter>
      </defs>
      <g filter="url(#o)">
        <circle cx="32" cy="32" r="22" fill="#2563EB" stroke="#FFFFFF" stroke-width="5"/>
        <path d="M32 16 L44 30 V44 H36 V36 H28 V44 H20 V30 Z" fill="#FFFFFF"/>
        <rect x="28" y="36" width="8" height="8" fill="#2563EB"/>
      </g>
    </svg>
  `.trim());
  return {
    url: `data:image/svg+xml;charset=UTF-8,${svg}`,
    scaledSize: new google.maps.Size(size, size),
    anchor: new google.maps.Point(size / 2, size / 2),
    labelOrigin: new google.maps.Point(size / 2, -8),
  };
}

const getDefaultDateRange = () => {
  const now = new Date();
  return {
    start: startOfDay(now),
    end: endOfDay(now),
  };
};

export function JobsMap({ dedicatedPage = false }) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef([]);
  const vehicleMarkersRef = useRef([]);
  const geofenceOverlaysRef = useRef([]);
  const officeMarkerRef = useRef(null);
  const trailPolylinesRef = useRef([]);
  const trailsByDeviceRef = useRef(new Map());
  const geocodeCacheRef = useRef(new Map());
  const clustererRef = useRef(null);
  const infoWindowRef = useRef(null);
  const [selectedJobIdForPopup, setSelectedJobIdForPopup] = useState(null);
  const [selectedEstimateForPopup, setSelectedEstimateForPopup] = useState(null);

  const [dateRange, setDateRange] = useState(() => getDefaultDateRange());
  const [filterParams, setFilterParams] = useState({});
  const [selectedCategories, setSelectedCategories] = useState({ jobs: true, estimates: true, vehicles: true });
  const [filterSidebarOpen, setFilterSidebarOpen] = useState(false);
  const [gpsSettingsOpen, setGpsSettingsOpen] = useState(false);
  const [panelOpen, setPanelOpen] = useState(true);
  const [selectedListKey, setSelectedListKey] = useState(null);
  const [addressByDeviceId, setAddressByDeviceId] = useState({});
  const [officeCoords, setOfficeCoords] = useState(null);
  const [mapReady, setMapReady] = useState(false);
  const [geocodedJobs, setGeocodedJobs] = useState([]);
  const [geocoding, setGeocoding] = useState(false);
  const [selectedJob, setSelectedJob] = useState(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  const dispatch = useDispatch();
  const theme = useTheme();
  const isMdUp = useMediaQuery(theme.breakpoints.up("md"));
  const user = useSelector((state) => state.auth.user);
  const userRole = user?.role || "worker";
  const isManagementUser = MANAGEMENT_ROLES.includes(userRole);
  const currentUserAssigneeId = user?.user_id ?? user?.id;
  const mapFiltersInitializedRef = useRef(false);

  // Build params for occurrences API (api/job/occurrences/)
  const occurrencesParams = useMemo(() => {
    const params = {
      start: dateRange.start.toISOString(),
      end: dateRange.end.toISOString(),
    };
    const status = filterParams.job_status || filterParams.status;
    if (status?.trim()) params.status = status;
    const search = filterParams.job_search || filterParams.search;
    if (search?.trim()) params.search = search;
    if (filterParams.job_type?.trim()) params.job_type = filterParams.job_type;
    if (filterParams.assignee_ids) {
      const ids = typeof filterParams.assignee_ids === "string"
        ? filterParams.assignee_ids.replace(/[\[\]]/g, "").split(",").map((s) => s.trim()).filter(Boolean)
        : Array.isArray(filterParams.assignee_ids) ? filterParams.assignee_ids : [];
      if (ids.length > 0) params.assignee_ids = ids.join(",");
    }
    return params;
  }, [dateRange.start, dateRange.end, filterParams.job_status, filterParams.status, filterParams.job_search, filterParams.search, filterParams.job_type, filterParams.assignee_ids]);

  const estimatesParams = useMemo(() => {
    const params = {
      start: dateRange.start.toISOString(),
      end: dateRange.end.toISOString(),
    };
    if (filterParams.estimate_status?.trim()) params.status = filterParams.estimate_status;
    const search = filterParams.estimate_search || filterParams.search;
    if (search?.trim()) params.search = search;
    if (filterParams.assignee_ids) {
      const ids = typeof filterParams.assignee_ids === "string"
        ? filterParams.assignee_ids.replace(/[\[\]]/g, "").split(",").map((s) => s.trim()).filter(Boolean)
        : Array.isArray(filterParams.assignee_ids) ? filterParams.assignee_ids : [];
      if (ids.length > 0) params.assigned_user_ids = ids.join(",");
    } else if (filterParams.assigned_user_ids) {
      params.assigned_user_ids = String(filterParams.assigned_user_ids).replace(/[\[\]]/g, "");
    } else if (userRole === "worker" && currentUserAssigneeId) {
      params.assigned_user_ids = String(currentUserAssigneeId);
    }
    return params;
  }, [dateRange.start, dateRange.end, filterParams.estimate_status, filterParams.estimate_search, filterParams.search, filterParams.assignee_ids, filterParams.assigned_user_ids, userRole, currentUserAssigneeId]);

  const showJobs = selectedCategories.jobs !== false;
  const showEstimates = selectedCategories.estimates !== false;
  const showVehicles = selectedCategories.vehicles !== false;
  const canManageGps = ["admin", "manager"].includes(userRole);
  const canViewGps = ["admin", "manager", "supervisor"].includes(userRole);

  const { data: gpsSettings } = useGetSettingsQuery(undefined, { skip: !canViewGps });
  const gpsConfigured = gpsSettings?.api_key_set && gpsSettings?.is_enabled !== false;

  const {
    data: gpsDevicesData,
    isFetching: gpsDevicesFetching,
  } = useGetDevicesQuery(undefined, {
    skip: !showVehicles || !gpsConfigured,
    pollingInterval: showVehicles && gpsConfigured ? 20000 : 0,
  });

  const gpsDevices = gpsDevicesData?.devices || [];
  const { data: geofencesData } = useGetFleetGeofencesQuery(undefined, { skip: !canViewGps });
  const geofences = geofencesData?.results || [];

  // Always fetch both so geocoding has full data; category filtering is display-only
  const { data: occurrencesData, isLoading: jobsLoading } = useGetCalendarJobsQuery(occurrencesParams);
  const { data: estimatesData, isLoading: estimatesLoading } = useGetEstimateAppointmentsCalendarQuery(estimatesParams);
  const { data: assigneesData } = useGetEmployeesQuery({ is_active: true });
  const { data: subaccountOffice } = useGetSubaccountOfficeQuery();
  const users = assigneesData?.results || [];

  // Management users: default to all assignees (matches Calendar). Workers: backend scopes to self.
  useEffect(() => {
    if (mapFiltersInitializedRef.current || users.length === 0) return;

    if (isManagementUser) {
      const allUserIds = users
        .map((employee) => employee.user_id ?? employee.id)
        .filter((id) => id != null && id !== "");
      if (allUserIds.length > 0) {
        const assigneeIdsString = allUserIds.join(",");
        setFilterParams({
          assignee_ids: assigneeIdsString,
          assigned_user_ids: assigneeIdsString,
        });
      }
    }

    mapFiltersInitializedRef.current = true;
  }, [users, isManagementUser]);

  const jobs = Array.isArray(occurrencesData) ? occurrencesData : occurrencesData?.results ?? [];
  const estimates = Array.isArray(estimatesData) ? estimatesData : estimatesData?.results ?? [];

  const activeFilterCount = Object.keys(filterParams).filter(
    (key) =>
      filterParams[key] &&
      (Array.isArray(filterParams[key]) ? filterParams[key].length > 0 : true)
  ).length;

  // Load Google Maps
  useEffect(() => {
    const apiKey = import.meta.env.VITE_GOOGLE_API_KEY;
    if (!apiKey || !mapRef.current) return;

    const loader = new Loader({
      apiKey,
      version: "weekly",
      libraries: ["places"],
    });

    loader
      .load()
      .then(() => {
        const map = new google.maps.Map(mapRef.current, {
          center: MAP_DEFAULT_CENTER,
          zoom: MAP_DEFAULT_ZOOM,
          mapTypeControl: true,
          streetViewControl: false,
          fullscreenControl: true,
          zoomControl: true,
          styles: [
            {
              featureType: "poi",
              elementType: "labels",
              stylers: [{ visibility: "off" }],
            },
          ],
        });
        mapInstanceRef.current = map;
        const infoWindow = new google.maps.InfoWindow({
          maxWidth: 420,
        });
        infoWindow.addListener("closeclick", () => {});
        infoWindowRef.current = infoWindow;
        setMapReady(true);
      })
      .catch((err) => {
        console.error("Google Maps load error:", err);
      });

    return () => {
      if (clustererRef.current) {
        clustererRef.current.clearMarkers();
        clustererRef.current = null;
      }
      markersRef.current.forEach((m) => m?.setMap?.(null));
      markersRef.current = [];
      mapInstanceRef.current = null;
    };
  }, []);

  // Geocode jobs and estimates (always geocode all data; category filtering is applied for display)
  useEffect(() => {
    const jobItems = jobs
      .filter((j) => {
        const addr = j.job_address || j.customer_address;
        return addr && String(addr).trim();
      })
      .map((job) => ({
        address: (job.job_address || job.customer_address || "").trim(),
        item: { ...job, __type: "job" },
      }));

    const estimateItems = estimates
      .filter((e) => {
        const addr = getEstimateAddress(e);
        return addr && String(addr).trim();
      })
      .map((estimate) => ({
        address: getEstimateAddress(estimate).trim(),
        item: { ...estimate, __type: "estimate" },
      }));

    const allItems = [...jobItems, ...estimateItems];
    if (!mapReady || allItems.length === 0) {
      setGeocodedJobs([]);
      setGeocoding(false);
      return;
    }

    const geocoder = new google.maps.Geocoder();
    const byAddress = new Map();
    allItems.forEach(({ address, item }) => {
      if (!byAddress.has(address)) byAddress.set(address, []);
      byAddress.get(address).push(item);
    });

    let cancelled = false;
    setGeocoding(true);

    const run = async () => {
      const uniqueItems = Array.from(byAddress.entries()).map(([address, itemsAtAddress]) => ({
        address,
        job: itemsAtAddress[0],
      }));

      const results = await geocodeJobs(
        uniqueItems.map(({ address, job }) => ({ address, job })),
        geocoder,
        60
      );

      if (cancelled) return;

      const addressToCoords = new Map();
      results.forEach((r) => {
        const addr =
          r.job.__type === "job"
            ? (r.job.job_address || r.job.customer_address || "").trim()
            : getEstimateAddress(r.job).trim();
        if (!addressToCoords.has(addr)) addressToCoords.set(addr, { lat: r.lat, lng: r.lng });
      });

      const withCoords = [];
      jobItems.forEach(({ address, item }) => {
        const coords = addressToCoords.get(address);
        if (coords) withCoords.push({ ...item, ...coords });
      });
      estimateItems.forEach(({ address, item }) => {
        const coords = addressToCoords.get(address);
        if (coords) withCoords.push({ ...item, ...coords });
      });

      setGeocodedJobs(withCoords);
      setGeocoding(false);
    };

    run();
    return () => {
      cancelled = true;
      setGeocoding(false);
    };
  }, [mapReady, jobs, estimates]);

  // Filter geocoded items by selected categories (instant, no re-geocoding)
  const displayedGeocodedJobs = useMemo(() => {
    return geocodedJobs.filter(
      (item) =>
        (item.__type === "job" && showJobs) || (item.__type === "estimate" && showEstimates)
    );
  }, [geocodedJobs, showJobs, showEstimates]);

  const focusMap = useCallback((lat, lng) => {
    const map = mapInstanceRef.current;
    if (!map || lat == null || lng == null || !google?.maps) return;
    map.panTo({ lat: Number(lat), lng: Number(lng) });
    const z = map.getZoom();
    if (!z || z < 14) map.setZoom(15);
  }, []);

  const closeMapDetail = useCallback(() => {
    setSelectedJobIdForPopup(null);
    setSelectedEstimateForPopup(null);
  }, []);

  const openJobOrEstimateDetail = useCallback((item) => {
    if (!item) return;
    if (item.__type === "estimate") {
      setSelectedJobIdForPopup(null);
      setSelectedEstimateForPopup(item);
    } else {
      const jobId = item.job_id || item.id;
      if (!jobId) return;
      setSelectedEstimateForPopup(null);
      setSelectedJobIdForPopup(jobId);
    }
    if (item.lat != null && item.lng != null) {
      focusMap(item.lat, item.lng);
    }
  }, [focusMap]);

  // Update markers when displayed geocoded jobs change (with clustering)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !google.maps) return;

    // Clear previous clusterer and markers
    if (clustererRef.current) {
      clustererRef.current.clearMarkers();
      clustererRef.current = null;
    }
    markersRef.current.forEach((m) => m?.setMap?.(null));
    markersRef.current = [];

    const statusColors = {
      pending: "#f59e0b",
      confirmed: "#06b6d4",
      service_due: "#a855f7",
      on_the_way: "#f97316",
      in_progress: "#3b82f6",
      onhold: "#8b5cf6",
      completed: "#10b981",
      cancelled: "#ef4444",
    };

    const openPopup = (item) => {
      openJobOrEstimateDetail(item);
    };

    const markers = [];
    displayedGeocodedJobs.forEach((item) => {
      const isEstimate = item.__type === "estimate";
      const color = isEstimate
        ? "#14b8a6"
        : (statusColors[item.status] || "#6b7280");
      const title = isEstimate
        ? item.title || item.contact_name || "Estimate"
        : item.customer_name || item.job_address || item.customer_address || "Job";
      const marker = new google.maps.Marker({
        position: { lat: item.lat, lng: item.lng },
        title: isEstimate ? `Estimate: ${title}` : title,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 12,
          fillColor: color,
          fillOpacity: 1,
          strokeColor: "#fff",
          strokeWeight: 2,
        },
      });

      marker.addListener("click", () => openPopup(item));
      markers.push(marker);
    });

    markersRef.current = markers;

    if (markers.length > 0) {
      const noCountRenderer = {
        render: ({ position }) =>
          new google.maps.Marker({
            position,
            icon: {
              path: google.maps.SymbolPath.CIRCLE,
              scale: 18,
              fillColor: "#4285f4",
              fillOpacity: 0.6,
              strokeColor: "#fff",
              strokeWeight: 2,
            },
            zIndex: 1000,
          }),
      };
      clustererRef.current = new MarkerClusterer({ map, markers, renderer: noCountRenderer });
      const bounds = new google.maps.LatLngBounds();
      displayedGeocodedJobs.forEach((j) => bounds.extend({ lat: j.lat, lng: j.lng }));
      map.fitBounds(bounds, { top: 80, right: 80, bottom: 80, left: 80 });
    }

    return () => {
      if (clustererRef.current) {
        clustererRef.current.clearMarkers();
        clustererRef.current = null;
      }
      markersRef.current.forEach((m) => m?.setMap?.(null));
      markersRef.current = [];
    };
  }, [displayedGeocodedJobs, openJobOrEstimateDetail]);

  // Live One Step GPS vehicle markers + fading movement trails
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !google?.maps) return;

    clearMapOverlays(vehicleMarkersRef.current);
    clearMapOverlays(trailPolylinesRef.current);
    vehicleMarkersRef.current = [];
    trailPolylinesRef.current = [];

    if (!showVehicles || gpsDevices.length === 0) {
      return () => {
        clearMapOverlays(vehicleMarkersRef.current);
        clearMapOverlays(trailPolylinesRef.current);
        vehicleMarkersRef.current = [];
        trailPolylinesRef.current = [];
      };
    }

    appendDeviceTrails(trailsByDeviceRef.current, gpsDevices);

    const openVehiclePopup = (device, marker) => {
      const addr = addressByDeviceId[device.device_id] || device.address || "";
      const status =
        device.drive_status ||
        (device.online ? "Online" : "Offline");
      const duration = device.status_duration_label ? ` ${device.status_duration_label}` : "";
      const speed =
        device.speed_mph != null && !Number.isNaN(Number(device.speed_mph))
          ? `${Math.round(Number(device.speed_mph))} mph`
          : null;
      const div = document.createElement("div");
      div.style.padding = "8px 4px";
      div.style.maxWidth = "260px";
      div.style.fontFamily = '"Plus Jakarta Sans", sans-serif';
      div.innerHTML = `
        <div style="font-weight:700;margin-bottom:4px;font-size:14px;">${device.display_name || "Vehicle"}</div>
        <div style="font-size:12px;color:#0D9488;font-weight:600;margin-bottom:2px;">${status}${duration}</div>
        ${speed ? `<div style="font-size:12px;color:#334155;">Speed: ${speed}</div>` : ""}
        ${device.technician_name ? `<div style="font-size:12px;color:#334155;">Tech: ${device.technician_name}</div>` : ""}
        ${addr ? `<div style="font-size:12px;color:#64748B;margin-top:4px;">${addr}</div>` : ""}
        ${device.last_updated ? `<div style="font-size:11px;color:#94A3B8;margin-top:4px;">Updated: ${device.last_updated}</div>` : ""}
      `;
      infoWindowRef.current.setContent(div);
      infoWindowRef.current.open(map, marker);
    };

    const polylines = [];
    trailsByDeviceRef.current.forEach((points) => {
      const segments = buildFadingTrailSegments(points, { color: "#EF4444", bands: 6 });
      segments.forEach((seg) => {
        const line = new google.maps.Polyline({
          map,
          path: seg.path,
          geodesic: true,
          strokeColor: seg.color,
          strokeOpacity: seg.opacity,
          strokeWeight: 4,
          zIndex: 1500,
        });
        polylines.push(line);
      });
    });
    trailPolylinesRef.current = polylines;

    const markers = gpsDevices.map((device) => {
      const moving =
        (Number(device.speed_mph) || 0) >= 3 ||
        String(device.drive_status || "").toLowerCase().includes("driv");
      const heading = Number(device.heading);
      const hasHeading = !Number.isNaN(heading);
      const labelSpeed =
        device.speed_mph != null && moving
          ? ` · ${Math.round(Number(device.speed_mph))} mph`
          : "";
      const fill = vehicleFillColor(device, moving);

      const marker = new google.maps.Marker({
        map,
        position: { lat: device.lat, lng: device.lng },
        title: `${device.display_name || "Vehicle"}${labelSpeed}`,
        zIndex: 2500,
        optimized: false,
        label: {
          text: `${device.display_name || "Vehicle"}${labelSpeed}`,
          color: "#0B1726",
          fontSize: "13px",
          fontWeight: "700",
          className: "gps-vehicle-label",
        },
        icon: buildVehicleMarkerIcon({
          fill,
          heading: hasHeading ? heading : 0,
          size: 56,
        }),
      });
      marker.addListener("click", () => openVehiclePopup(device, marker));
      return marker;
    });

    vehicleMarkersRef.current = markers;

    return () => {
      clearMapOverlays(vehicleMarkersRef.current);
      clearMapOverlays(trailPolylinesRef.current);
      vehicleMarkersRef.current = [];
      trailPolylinesRef.current = [];
    };
  }, [gpsDevices, showVehicles, addressByDeviceId]);

  // Active geofences from Fleet Center
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !google?.maps || !mapReady) return;

    clearMapOverlays(geofenceOverlaysRef.current);
    geofenceOverlaysRef.current = [];

    const overlays = [];
    geofences
      .filter((g) => g.is_active !== false && g.latitude != null && g.longitude != null)
      .forEach((g) => {
        const color = g.color || "#0877f9";
        const circle = new google.maps.Circle({
          map,
          center: { lat: Number(g.latitude), lng: Number(g.longitude) },
          radius: Math.max(Number(g.radius_miles) || 1, 0.1) * 1609.34,
          fillColor: color,
          fillOpacity: 0.12,
          strokeColor: color,
          strokeOpacity: 0.85,
          strokeWeight: 2,
          zIndex: 400,
        });
        const label = new google.maps.Marker({
          map,
          position: { lat: Number(g.latitude), lng: Number(g.longitude) },
          title: g.name,
          clickable: false,
          zIndex: 401,
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 0,
          },
          label: {
            text: g.name || "Geofence",
            color: color,
            fontSize: "12px",
            fontWeight: "700",
          },
        });
        overlays.push(circle, label);
      });
    geofenceOverlaysRef.current = overlays;

    return () => {
      clearMapOverlays(geofenceOverlaysRef.current);
      geofenceOverlaysRef.current = [];
    };
  }, [geofences, mapReady]);

  // Geocode subaccount office address for HQ marker
  useEffect(() => {
    if (!mapReady || !subaccountOffice?.configured || !subaccountOffice.full_address || !google?.maps) {
      return;
    }

    let cancelled = false;
    const geocoder = new google.maps.Geocoder();

    geocodeAddress(subaccountOffice.full_address, geocoder).then((coords) => {
      if (!cancelled && coords) setOfficeCoords(coords);
    });

    return () => {
      cancelled = true;
    };
  }, [mapReady, subaccountOffice?.configured, subaccountOffice?.full_address]);

  // Subaccount office marker on map
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !google?.maps) return;

    if (officeMarkerRef.current) {
      officeMarkerRef.current.setMap(null);
      officeMarkerRef.current = null;
    }

    if (!officeCoords || !subaccountOffice?.configured) {
      return () => {
        if (officeMarkerRef.current) {
          officeMarkerRef.current.setMap(null);
          officeMarkerRef.current = null;
        }
      };
    }

    const officeName = (subaccountOffice.name || "Office").trim();
    const fullAddress = subaccountOffice.full_address || "";

    const openOfficePopup = (marker) => {
      const div = document.createElement("div");
      div.style.padding = "8px 4px";
      div.style.maxWidth = "260px";
      div.style.fontFamily = '"Plus Jakarta Sans", sans-serif';
      div.innerHTML = `
        <div style="font-weight:700;margin-bottom:4px;font-size:14px;">${officeName}</div>
        <div style="font-size:12px;color:#2563EB;font-weight:600;margin-bottom:4px;">Subaccount office</div>
        ${fullAddress ? `<div style="font-size:12px;color:#64748B;">${fullAddress}</div>` : ""}
      `;
      infoWindowRef.current.setContent(div);
      infoWindowRef.current.open(map, marker);
    };

    const marker = new google.maps.Marker({
      map,
      position: officeCoords,
      title: officeName,
      zIndex: 3000,
      optimized: false,
      label: {
        text: officeName,
        color: "#1D4ED8",
        fontSize: "13px",
        fontWeight: "700",
        className: "gps-office-label",
      },
      icon: buildOfficeMarkerIcon({ size: 50 }),
    });
    marker.addListener("click", () => openOfficePopup(marker));
    officeMarkerRef.current = marker;

    return () => {
      if (officeMarkerRef.current) {
        officeMarkerRef.current.setMap(null);
        officeMarkerRef.current = null;
      }
    };
  }, [officeCoords, subaccountOffice?.configured, subaccountOffice?.name, subaccountOffice?.full_address]);

  // Reverse-geocode vehicle positions for sidebar addresses (cached)
  useEffect(() => {
    if (!mapReady || !showVehicles || !gpsDevices.length || !google?.maps) return;

    let cancelled = false;
    const geocoder = new google.maps.Geocoder();

    const run = async () => {
      const next = { ...addressByDeviceId };
      let changed = false;

      for (const device of gpsDevices) {
        if (cancelled) return;
        const id = device.device_id;
        if (!id) continue;
        if (device.address) {
          if (next[id] !== device.address) {
            next[id] = device.address;
            changed = true;
          }
          continue;
        }
        if (next[id]) continue;

        const cacheKey = `${device.lat.toFixed(4)},${device.lng.toFixed(4)}`;
        if (geocodeCacheRef.current.has(cacheKey)) {
          next[id] = geocodeCacheRef.current.get(cacheKey);
          changed = true;
          continue;
        }

        try {
          // eslint-disable-next-line no-await-in-loop
          const result = await new Promise((resolve) => {
            geocoder.geocode(
              { location: { lat: device.lat, lng: device.lng } },
              (results, status) => {
                if (status === "OK" && results?.[0]) resolve(results[0].formatted_address);
                else resolve(null);
              }
            );
          });
          if (result) {
            geocodeCacheRef.current.set(cacheKey, result);
            next[id] = result;
            changed = true;
          }
        } catch {
          // ignore geocode failures
        }
      }

      if (!cancelled && changed) setAddressByDeviceId(next);
    };

    run();
    return () => {
      cancelled = true;
    };
    // Intentionally omit addressByDeviceId from deps to avoid re-entry loops
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gpsDevices, showVehicles, mapReady]);

  const handleJobUpdate = useCallback(
    (result) => {
      const jobId = result.id || result.job_id;
      if (!jobId) return;
      dispatch(
        jobsApi.util.updateQueryData(
          "getCalendarJobs",
          occurrencesParams,
          (draft) => {
            const list = Array.isArray(draft) ? draft : draft?.results ?? [];
            const index = list.findIndex(
              (j) => j.id === jobId || j.job_id === jobId
            );
            if (index !== -1) {
              list[index] = {
                ...list[index],
                ...result,
                id: result.id || result.job_id || list[index].id,
                job_id: result.job_id || result.id || list[index].job_id,
              };
              if (!Array.isArray(draft) && draft?.results) draft.results = list;
            }
          }
        )
      );
    },
    [dispatch, occurrencesParams]
  );

  const handleEditFromPopup = useCallback((j) => {
    setSelectedJob(j);
    setEditDialogOpen(true);
    closeMapDetail();
  }, [closeMapDetail]);

  const handleDeleteFromPopup = useCallback(
    (jobToDelete, option) => {
      if (!jobToDelete) return;
      const jobId = jobToDelete.job_id || jobToDelete.id;
      if (!jobId) return;
      dispatch(
        jobsApi.util.updateQueryData("getCalendarJobs", occurrencesParams, (draft) => {
          const list = Array.isArray(draft) ? draft : draft?.results ?? [];
          const idx = list.findIndex((j) => j.id === jobId || j.job_id === jobId);
          if (idx !== -1) {
            list.splice(idx, 1);
            if (!Array.isArray(draft) && draft?.results) draft.results = list;
          }
        })
      );
      infoWindowRef.current?.close();
      closeMapDetail();
      setSelectedJobIdForPopup(null);
    },
    [dispatch, occurrencesParams, closeMapDetail]
  );

  const panelJobs = useMemo(
    () => displayedGeocodedJobs.filter((i) => i.__type === "job"),
    [displayedGeocodedJobs]
  );
  const panelEstimates = useMemo(
    () => displayedGeocodedJobs.filter((i) => i.__type === "estimate"),
    [displayedGeocodedJobs]
  );

  const totalListed = (showJobs ? jobs.length : 0) + (showEstimates ? estimates.length : 0);

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          height: dedicatedPage ? "100%" : { xs: "auto", md: "calc(100vh - 120px)" },
          minHeight: dedicatedPage ? 0 : { xs: "calc(100vh - 140px)", md: 560 },
          mx: dedicatedPage ? 0 : { xs: -2, sm: -3 },
          mb: dedicatedPage ? 0 : { xs: -2, sm: -3 },
          mt: dedicatedPage ? 0 : { xs: -1, sm: -1 },
        }}
      >
        {/* Compact ops toolbar */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 1.5,
            px: { xs: 2, sm: 2.5 },
            py: 1.25,
            bgcolor: "#fff",
            borderBottom: "1px solid",
            borderColor: "divider",
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, minWidth: 0 }}>
            <Tooltip title={panelOpen ? "Hide list" : "Show list"}>
              <IconButton size="small" onClick={() => setPanelOpen((v) => !v)} sx={{ display: { xs: "none", md: "inline-flex" } }}>
                {panelOpen ? <PanelLeftClose size={18} /> : <PanelLeft size={18} />}
              </IconButton>
            </Tooltip>
            {!dedicatedPage && (
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="h6" sx={{ lineHeight: 1.2 }}>
                  Map
                </Typography>
                <Typography variant="caption" color="text.secondary" noWrap>
                  Jobs, estimates & live fleet
                </Typography>
              </Box>
            )}
            {gpsConfigured && showVehicles && (
              <Chip
                size="small"
                label={`${gpsDevices.length} live`}
                color="secondary"
                variant="outlined"
                sx={{ display: { xs: "none", sm: "inline-flex" }, height: 24 }}
              />
            )}
          </Box>

          <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 1 }}>
            {canManageGps && !dedicatedPage && (
              <Button
                size="small"
                variant="outlined"
                startIcon={<SettingsIcon size={16} />}
                onClick={() => setGpsSettingsOpen(true)}
              >
                GPS
              </Button>
            )}
            <DatePicker
              label="Start"
              value={dateRange.start}
              onChange={(date) => date && setDateRange((prev) => ({ ...prev, start: date }))}
              slotProps={{ textField: { size: "small", sx: { width: { xs: 130, sm: 150 } } } }}
            />
            <DatePicker
              label="End"
              value={dateRange.end}
              onChange={(date) => date && setDateRange((prev) => ({ ...prev, end: date }))}
              slotProps={{ textField: { size: "small", sx: { width: { xs: 130, sm: 150 } } } }}
            />
            <Button
              size="small"
              variant="outlined"
              startIcon={<FilterIcon size={16} />}
              onClick={() => setFilterSidebarOpen(true)}
            >
              <Badge badgeContent={activeFilterCount} color="primary" sx={{ "& .MuiBadge-badge": { right: -8 } }}>
                Filters
              </Badge>
            </Button>
          </Box>
        </Box>

        {/* Split: list + map */}
        <Box sx={{ flex: 1, display: "flex", flexDirection: { xs: "column", md: "row" }, minHeight: 0, overflow: "hidden" }}>
          {(panelOpen || !isMdUp) && (
            <Box
              sx={{
                height: { xs: 280, md: "100%" },
                flexShrink: 0,
                borderBottom: { xs: "1px solid", md: "none" },
                borderColor: "divider",
              }}
            >
              <MapOpsPanel
                vehicles={gpsDevices}
                jobs={panelJobs}
                estimates={panelEstimates}
                addressByDeviceId={addressByDeviceId}
                gpsConfigured={Boolean(gpsConfigured)}
                showVehicles={showVehicles}
                showJobs={showJobs}
                showEstimates={showEstimates}
                selectedKey={selectedListKey}
                onSelectItem={(key, payload) => {
                  setSelectedListKey(key);
                  if (payload?.type === "job" || payload?.type === "estimate") {
                    openJobOrEstimateDetail({ ...payload.item, __type: payload.type });
                  }
                }}
                onFocusMap={focusMap}
                onFocusAlert={(alert) => {
                  if (alert?.latitude != null && alert?.longitude != null) {
                    focusMap(alert.latitude, alert.longitude);
                  }
                }}
              />
            </Box>
          )}

          <Box
            sx={{
              flex: 1,
              minHeight: { xs: 360, md: 0 },
              position: "relative",
              bgcolor: "#E8EEF4",
            }}
          >
            <div
              ref={mapRef}
              style={{
                width: "100%",
                height: "100%",
                minHeight: 360,
              }}
            />

            {(jobsLoading || estimatesLoading || geocoding || gpsDevicesFetching) && (
              <Box
                sx={{
                  position: "absolute",
                  top: 12,
                  left: "50%",
                  transform: "translateX(-50%)",
                  px: 1.75,
                  py: 0.75,
                  borderRadius: 2,
                  bgcolor: "rgba(255,255,255,0.95)",
                  border: "1px solid",
                  borderColor: "divider",
                  boxShadow: 2,
                  zIndex: 2,
                }}
              >
                <Typography variant="caption" color="text.secondary" fontWeight={600}>
                  {jobsLoading || estimatesLoading
                    ? "Loading…"
                    : gpsDevicesFetching
                      ? "Updating vehicles…"
                      : "Geocoding addresses…"}
                </Typography>
              </Box>
            )}

            {(selectedJobIdForPopup || selectedEstimateForPopup) && (
              <Box
                sx={{
                  position: "absolute",
                  zIndex: filterSidebarOpen ? 4 : 6,
                  display: "flex",
                  flexDirection: "column",
                  bgcolor: "background.paper",
                  borderRadius: 2,
                  boxShadow: "0 12px 40px rgba(11, 23, 38, 0.18)",
                  border: "1px solid",
                  borderColor: "divider",
                  overflow: "hidden",
                  top: { xs: "auto", md: 12 },
                  bottom: { xs: 0, md: 12 },
                  left: { xs: 0, md: 12 },
                  right: { xs: 0, md: "auto" },
                  width: {
                    xs: "100%",
                    md: MAP_DETAIL_PANEL_WIDTH,
                  },
                  minWidth: { md: MAP_DETAIL_PANEL_WIDTH },
                  maxWidth: { xs: "100%", md: `min(${MAP_DETAIL_PANEL_WIDTH}px, calc(100% - 24px))` },
                  maxHeight: { xs: "62vh", md: "calc(100% - 24px)" },
                }}
              >
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    px: 1.5,
                    py: 1,
                    borderBottom: "1px solid",
                    borderColor: "divider",
                    bgcolor: "grey.50",
                    flexShrink: 0,
                  }}
                >
                  <Typography variant="subtitle2" fontWeight={700}>
                    {selectedJobIdForPopup ? "Job details" : "Estimate details"}
                  </Typography>
                  <IconButton size="small" onClick={closeMapDetail} aria-label="Close details">
                    <X size={18} />
                  </IconButton>
                </Box>
                <Box sx={{ flex: 1, minHeight: 0, overflowY: "auto", overflowX: "hidden" }}>
                  {selectedJobIdForPopup ? (
                    <MapJobCardWrapper
                      jobId={selectedJobIdForPopup}
                      users={users}
                      onEdit={handleEditFromPopup}
                      onDelete={handleDeleteFromPopup}
                      onUpdate={handleJobUpdate}
                      embeddedInPanel
                    />
                  ) : (
                    <MapEstimateDetailsContent
                      estimate={selectedEstimateForPopup}
                      estimatesParams={estimatesParams}
                      user={user}
                      onDeleted={closeMapDetail}
                      embeddedInPanel
                    />
                  )}
                </Box>
              </Box>
            )}

            {mapReady &&
              !jobsLoading &&
              !estimatesLoading &&
              !geocoding &&
              geocodedJobs.length === 0 &&
              (jobs.length > 0 || estimates.length > 0) && (
                <Box
                  sx={{
                    position: "absolute",
                    top: 12,
                    left: "50%",
                    transform: "translateX(-50%)",
                    px: 2,
                    py: 1,
                    borderRadius: 2,
                    bgcolor: "warning.light",
                    color: "warning.contrastText",
                    zIndex: 2,
                  }}
                >
                  <Typography variant="caption" fontWeight={600}>
                    No valid addresses to plot. Check job addresses.
                  </Typography>
                </Box>
              )}

            {mapReady &&
              !jobsLoading &&
              !estimatesLoading &&
              jobs.length === 0 &&
              estimates.length === 0 &&
              !(showVehicles && gpsDevices.length > 0) && (
              <Box
                sx={{
                  position: "absolute",
                  inset: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  pointerEvents: "none",
                  zIndex: 1,
                }}
              >
                <Box
                  sx={{
                    px: 3,
                    py: 2,
                    borderRadius: 2,
                    bgcolor: "rgba(255,255,255,0.94)",
                    border: "1px solid",
                    borderColor: "divider",
                    maxWidth: 320,
                    textAlign: "center",
                  }}
                >
                  <Typography variant="subtitle2" gutterBottom>
                    Nothing in this range
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Adjust dates or filters to see jobs and estimates on the map.
                  </Typography>
                </Box>
              </Box>
            )}

            {/* Floating legend / counts */}
            {!jobsLoading && !estimatesLoading && (
              <Box
                sx={{
                  position: "absolute",
                  bottom: 12,
                  left: 12,
                  px: 1.5,
                  py: 0.75,
                  borderRadius: 2,
                  bgcolor: "rgba(255,255,255,0.95)",
                  border: "1px solid",
                  borderColor: "divider",
                  boxShadow: 1,
                  zIndex: 2,
                }}
              >
                <Typography variant="caption" color="text.secondary" fontWeight={600}>
                  {displayedGeocodedJobs.length}/{totalListed} plotted
                  {showVehicles && gpsConfigured ? ` · ${gpsDevices.length} vehicles` : ""}
                </Typography>
              </Box>
            )}
          </Box>
        </Box>

      <FilterSidebar
        open={filterSidebarOpen}
        onClose={() => setFilterSidebarOpen(false)}
        onApplyFilters={(filters) => setFilterParams(filters)}
        assignees={users}
        initialFilters={filterParams}
        userRole={userRole}
        mode="map"
        selectedCategories={selectedCategories}
        onCategoryToggle={(cat, checked) =>
          setSelectedCategories((prev) => ({ ...prev, [cat]: checked }))
        }
      />

      <OneStepGPSSettingsDialog open={gpsSettingsOpen} onClose={() => setGpsSettingsOpen(false)} />

      {selectedJob && (
        <EditJobDialog
          job={selectedJob}
          open={editDialogOpen}
          onClose={() => {
            setEditDialogOpen(false);
            setSelectedJob(null);
          }}
          users={users}
          handleJobUpdate={handleJobUpdate}
        />
      )}
      </Box>
    </LocalizationProvider>
  );
}

export default JobsMap;
