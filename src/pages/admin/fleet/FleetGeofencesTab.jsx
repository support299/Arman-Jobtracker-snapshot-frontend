import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import { ExternalLink, Eye, Hexagon, MapPin, MoreHorizontal, Pencil, Plus, Route, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { PlacesAutocomplete } from "../../../components/admin/PlacesAutocomplete";
import {
  useCreateFleetGeofenceMutation,
  useDeleteFleetGeofenceMutation,
  useGetFleetGeofencesQuery,
  useUpdateFleetGeofenceMutation,
} from "../../../store/api/onestepgpsApi";
import { FleetSectionHeader, PrimaryButton } from "./FleetPrimitives";
import { SP } from "./fleetUi";

const EMPTY_FORM = {
  name: "",
  address: "",
  latitude: "",
  longitude: "",
  radius_miles: "1",
  trigger_entry: true,
  trigger_exit: true,
  after_hours: false,
};

const ICON_TONES = [
  { bg: SP.blueSoft, fg: SP.blue },
  { bg: SP.greenSoft, fg: SP.green },
  { bg: SP.amberSoft, fg: SP.amber },
];

function formFromFence(g) {
  return {
    name: g?.name || "",
    address: "",
    latitude: g?.latitude == null ? "" : String(g.latitude),
    longitude: g?.longitude == null ? "" : String(g.longitude),
    radius_miles: g?.radius_miles == null ? "1" : String(g.radius_miles),
    trigger_entry: g?.trigger_entry !== false,
    trigger_exit: g?.trigger_exit !== false,
    after_hours: !!g?.after_hours,
  };
}

function fenceRules(g) {
  return [
    g.trigger_entry ? "Entry" : null,
    g.trigger_exit ? "Exit" : null,
    g.after_hours ? "After hours" : null,
  ].filter(Boolean).join(", ");
}

function mapsUrl(lat, lng) {
  return `https://www.google.com/maps?q=${encodeURIComponent(`${lat},${lng}`)}`;
}

function loadGoogleMaps() {
  return new Promise((resolve, reject) => {
    if (window.google?.maps) {
      resolve();
      return;
    }
    const existing = document.querySelector('script[src*="maps.googleapis.com"]');
    if (existing) {
      if (window.google?.maps) {
        resolve();
        return;
      }
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Google Maps failed to load")), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${import.meta.env.VITE_GOOGLE_API_KEY}&libraries=places`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Google Maps failed to load"));
    document.head.appendChild(script);
  });
}

function GeofencePreviewMap({ latitude, longitude, radiusMiles, name }) {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const circleRef = useRef(null);
  const markerRef = useRef(null);
  const [ready, setReady] = useState(false);
  const lat = Number(latitude);
  const lng = Number(longitude);
  const hasCoords = Number.isFinite(lat) && Number.isFinite(lng);

  useEffect(() => {
    let cancelled = false;
    loadGoogleMaps()
      .then(() => {
        if (!cancelled) setReady(true);
      })
      .catch(() => {
        if (!cancelled) setReady(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!ready || !hasCoords || !window.google?.maps) return undefined;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      if (cancelled || !mapRef.current) return;
      const center = { lat, lng };
      if (!mapInstance.current) {
        mapInstance.current = new window.google.maps.Map(mapRef.current, {
          center,
          zoom: 13,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: true,
          zoomControl: true,
        });
      } else {
        mapInstance.current.setCenter(center);
      }

      if (circleRef.current) circleRef.current.setMap(null);
      if (markerRef.current) markerRef.current.setMap(null);

      circleRef.current = new window.google.maps.Circle({
        map: mapInstance.current,
        center,
        radius: Math.max(Number(radiusMiles) || 1, 0.1) * 1609.34,
        fillColor: SP.blue,
        fillOpacity: 0.14,
        strokeColor: SP.blue,
        strokeOpacity: 0.85,
        strokeWeight: 2,
      });
      markerRef.current = new window.google.maps.Marker({
        map: mapInstance.current,
        position: center,
        title: name || "Geofence",
      });

      const bounds = circleRef.current.getBounds();
      if (bounds) mapInstance.current.fitBounds(bounds, 36);
      window.google.maps.event.trigger(mapInstance.current, "resize");
    }, 80);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [ready, hasCoords, lat, lng, radiusMiles, name]);

  if (!hasCoords) {
    return (
      <Box
        sx={{
          minHeight: 280,
          height: "100%",
          borderRadius: "13px",
          bgcolor: "#e8eef1",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: SP.muted,
          fontSize: 13,
          fontWeight: 700,
          textAlign: "center",
          px: 3,
        }}
      >
        Search an address to preview this zone
      </Box>
    );
  }

  return (
    <Box
      ref={mapRef}
      sx={{ minHeight: 280, height: "100%", borderRadius: "13px", overflow: "hidden", bgcolor: "#e8eef1" }}
    />
  );
}

export default function FleetGeofencesTab({ recordCount = 0 }) {
  const { data } = useGetFleetGeofencesQuery();
  const [createGeofence] = useCreateFleetGeofenceMutation();
  const [updateGeofence] = useUpdateFleetGeofenceMutation();
  const [deleteGeofence] = useDeleteFleetGeofenceMutation();
  const fences = data?.results || [];
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [detailsFence, setDetailsFence] = useState(null);
  const [menu, setMenu] = useState({ anchor: null, fence: null });
  const [deleteTarget, setDeleteTarget] = useState(null);

  const handlePlaceSelect = (place) => {
    const lat = place?.latitude;
    const lng = place?.longitude;
    const address = place?.address || "";
    setForm((prev) => ({
      ...prev,
      address,
      latitude: lat == null || Number.isNaN(Number(lat)) ? prev.latitude : String(lat),
      longitude: lng == null || Number.isNaN(Number(lng)) ? prev.longitude : String(lng),
      name: prev.name.trim() ? prev.name : address.split(",")[0] || prev.name,
    }));
  };

  const hasCoords =
    form.latitude !== "" &&
    form.longitude !== "" &&
    Number.isFinite(Number(form.latitude)) &&
    Number.isFinite(Number(form.longitude));

  const closeEditor = () => {
    setEditorOpen(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
  };

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setEditorOpen(true);
  };

  const openEdit = (fence) => {
    setMenu({ anchor: null, fence: null });
    setDetailsFence(null);
    setEditingId(fence.id);
    setForm(formFromFence(fence));
    setEditorOpen(true);
  };

  const openDetails = (fence) => {
    setMenu({ anchor: null, fence: null });
    setDetailsFence(fence);
  };

  const handleSave = async () => {
    if (!hasCoords) return;
    const payload = {
      name: form.name.trim() || "New zone",
      latitude: Number(form.latitude),
      longitude: Number(form.longitude),
      radius_miles: Number(form.radius_miles) || 1,
      trigger_entry: form.trigger_entry,
      trigger_exit: form.trigger_exit,
      after_hours: form.after_hours,
    };
    if (editingId) {
      await updateGeofence({ id: editingId, ...payload }).unwrap();
    } else {
      await createGeofence(payload).unwrap();
    }
    closeEditor();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await deleteGeofence(deleteTarget.id).unwrap();
    if (detailsFence?.id === deleteTarget.id) setDetailsFence(null);
    setDeleteTarget(null);
  };

  const liveDetails = detailsFence
    ? fences.find((g) => g.id === detailsFence.id) || detailsFence
    : null;

  return (
    <Box>
      <FleetSectionHeader
        eyebrow="Location rules"
        title="Geofences"
        description="Create operating areas and trigger entry, exit, after-hours, and restricted-zone alerts."
        count={recordCount}
      />

      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        sx={{ bgcolor: "#fff", border: `1px solid ${SP.line}`, borderRadius: "14px", px: 2, py: 1.5, mb: 2 }}
      >
        <Box>
          <Typography sx={{ fontSize: 13, fontWeight: 800 }}>{fences.length} active geofences</Typography>
          <Typography sx={{ color: SP.muted, fontSize: 12 }}>Showing all geofences for this subaccount.</Typography>
        </Box>
        <PrimaryButton startIcon={<Plus size={16} />} onClick={openCreate}>
          Create geofence
        </PrimaryButton>
      </Stack>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "minmax(0,1fr) 360px" },
          gap: 2,
          minHeight: 480,
        }}
      >
        <Box
          sx={{
            position: "relative",
            minHeight: 430,
            borderRadius: "16px",
            border: `1px solid ${SP.line}`,
            overflow: "hidden",
            bgcolor: "#e8eef1",
            backgroundImage:
              "linear-gradient(35deg, transparent 46%, rgba(255,255,255,.8) 47%, rgba(255,255,255,.8) 50%, transparent 51%), linear-gradient(112deg, transparent 48%, rgba(255,255,255,.65) 49%, rgba(255,255,255,.65) 52%, transparent 53%)",
          }}
        >
          {fences.slice(0, 2).map((g, i) => (
            <Box
              key={g.id}
              onClick={() => openDetails(g)}
              sx={{
                position: "absolute",
                left: i === 0 ? "16%" : "auto",
                right: i === 1 ? "16%" : "auto",
                top: i === 0 ? 55 : 105,
                width: i === 0 ? { xs: 220, md: 320 } : 120,
                height: i === 0 ? { xs: 220, md: 320 } : 120,
                borderRadius: "50%",
                bgcolor: i === 0 ? "rgba(8,119,249,.13)" : "rgba(0,169,65,.13)",
                border: `2px solid ${i === 0 ? "rgba(8,119,249,.7)" : "rgba(0,169,65,.7)"}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
              }}
            >
              <Box sx={{ bgcolor: "#fff", color: i === 0 ? SP.blue : SP.green, fontSize: 12, fontWeight: 800, px: 1.25, py: 0.75, borderRadius: 999, boxShadow: SP.shadow }}>
                {g.name}
              </Box>
            </Box>
          ))}
          <Box sx={{ position: "absolute", left: "48%", top: "48%", width: 38, height: 38, borderRadius: "50%", bgcolor: SP.blue, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", border: "3px solid #fff" }}>
            <Route size={16} />
          </Box>
          <Box sx={{ position: "absolute", left: 14, bottom: 14, bgcolor: "#fff", borderRadius: "9px", px: 1.25, py: 1, display: "flex", alignItems: "center", gap: 0.75, fontSize: 12, fontWeight: 800, color: SP.slate, boxShadow: SP.shadow }}>
            <MapPin size={14} color={SP.blue} /> {fences[0]?.name || "Geofences"}
          </Box>
        </Box>

        <Box sx={{ bgcolor: "#fff", border: `1px solid ${SP.line}`, borderRadius: "16px", overflow: "hidden" }}>
          {fences.length === 0 ? (
            <Box sx={{ p: 3 }}>
              <Typography sx={{ color: SP.muted, fontSize: 13 }}>
                No geofences yet. Create operating areas here. Entry / exit / after-hours alerts from OneStep will also appear on the Alerts tab.
              </Typography>
            </Box>
          ) : (
            fences.map((g, i) => {
              const tone = ICON_TONES[i % ICON_TONES.length];
              return (
                <Box
                  key={g.id}
                  onClick={() => openDetails(g)}
                  sx={{
                    display: "grid",
                    gridTemplateColumns: "40px minmax(0,1fr) auto",
                    gap: 1.25,
                    alignItems: "center",
                    p: 1.75,
                    borderBottom: `1px solid ${SP.line}`,
                    cursor: "pointer",
                    "&:last-child": { borderBottom: 0 },
                    "&:hover": { bgcolor: SP.soft },
                  }}
                >
                  <Box sx={{ width: 38, height: 38, borderRadius: "10px", bgcolor: tone.bg, color: tone.fg, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Hexagon size={17} />
                  </Box>
                  <Box>
                    <Typography sx={{ fontSize: 13, fontWeight: 800 }}>{g.name}</Typography>
                    <Typography sx={{ color: SP.muted, fontSize: 12 }}>{fenceRules(g) || "Active"}</Typography>
                    <Typography sx={{ color: SP.muted, fontSize: 11 }}>
                      {g.radius_miles} mi · {Number(g.latitude).toFixed(4)}, {Number(g.longitude).toFixed(4)}
                    </Typography>
                  </Box>
                  <IconButton
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenu({ anchor: e.currentTarget, fence: g });
                    }}
                    sx={{ color: SP.muted }}
                    aria-label="Geofence actions"
                  >
                    <MoreHorizontal size={18} />
                  </IconButton>
                </Box>
              );
            })
          )}
        </Box>
      </Box>

      <Menu
        anchorEl={menu.anchor}
        open={Boolean(menu.anchor)}
        onClose={() => setMenu({ anchor: null, fence: null })}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
      >
        <MenuItem onClick={() => menu.fence && openDetails(menu.fence)}>
          <ListItemIcon><Eye size={16} /></ListItemIcon>
          <ListItemText>View details</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => menu.fence && openEdit(menu.fence)}>
          <ListItemIcon><Pencil size={16} /></ListItemIcon>
          <ListItemText>Edit</ListItemText>
        </MenuItem>
        <MenuItem
          onClick={() => {
            if (!menu.fence) return;
            setDeleteTarget(menu.fence);
            setMenu({ anchor: null, fence: null });
          }}
          sx={{ color: SP.red }}
        >
          <ListItemIcon><Trash2 size={16} color={SP.red} /></ListItemIcon>
          <ListItemText>Delete</ListItemText>
        </MenuItem>
      </Menu>

      <Dialog
        open={editorOpen}
        onClose={closeEditor}
        fullWidth
        maxWidth="md"
        slotProps={{ paper: { sx: { overflow: "visible" } } }}
      >
        <DialogContent sx={{ p: 0, overflow: "visible" }}>
          <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ p: 2.5, borderBottom: `1px solid ${SP.line}` }}>
            <Box>
              <Typography sx={{ color: SP.blue, fontSize: 11, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase" }}>
                Location automation
              </Typography>
              <Typography sx={{ fontSize: 22, fontWeight: 800, mt: 0.5 }}>
                {editingId ? "Edit geofence" : "Create geofence"}
              </Typography>
            </Box>
            <IconButton onClick={closeEditor}><X size={18} /></IconButton>
          </Stack>
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 2.5, p: 2.5 }}>
            <GeofencePreviewMap
              latitude={form.latitude}
              longitude={form.longitude}
              radiusMiles={form.radius_miles}
              name={form.name}
            />
            <Stack spacing={2}>
              <TextField label="Geofence name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Customer site or service area" />
              <PlacesAutocomplete
                value={form.address}
                onChange={handlePlaceSelect}
                label="Search address"
                placeholder="Type an address or place…"
                helperText="Pick a place to fill latitude and longitude."
              />
              <Stack direction="row" spacing={1.5}>
                <TextField fullWidth label="Latitude" value={form.latitude} onChange={(e) => setForm({ ...form, latitude: e.target.value })} />
                <TextField fullWidth label="Longitude" value={form.longitude} onChange={(e) => setForm({ ...form, longitude: e.target.value })} />
              </Stack>
              <TextField label="Radius (miles)" value={form.radius_miles} onChange={(e) => setForm({ ...form, radius_miles: e.target.value })} />
              <FormControlLabel control={<Switch checked={form.trigger_entry} onChange={(e) => setForm({ ...form, trigger_entry: e.target.checked })} />} label="Entry alert" />
              <FormControlLabel control={<Switch checked={form.trigger_exit} onChange={(e) => setForm({ ...form, trigger_exit: e.target.checked })} />} label="Exit alert" />
              <FormControlLabel control={<Switch checked={form.after_hours} onChange={(e) => setForm({ ...form, after_hours: e.target.checked })} />} label="After-hours alert" />
              <PrimaryButton onClick={handleSave} disabled={!hasCoords}>
                {editingId ? "Save changes" : "Save geofence"}
              </PrimaryButton>
            </Stack>
          </Box>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(liveDetails)} onClose={() => setDetailsFence(null)} fullWidth maxWidth="md">
        {liveDetails && (
          <>
            <DialogContent sx={{ p: 0 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ p: 2.5, borderBottom: `1px solid ${SP.line}` }}>
                <Box>
                  <Typography sx={{ color: SP.blue, fontSize: 11, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase" }}>
                    Geofence
                  </Typography>
                  <Typography sx={{ fontSize: 22, fontWeight: 800, mt: 0.5 }}>{liveDetails.name}</Typography>
                </Box>
                <IconButton onClick={() => setDetailsFence(null)}><X size={18} /></IconButton>
              </Stack>
              <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1.2fr 0.8fr" }, gap: 2.5, p: 2.5 }}>
                <GeofencePreviewMap
                  latitude={liveDetails.latitude}
                  longitude={liveDetails.longitude}
                  radiusMiles={liveDetails.radius_miles}
                  name={liveDetails.name}
                />
                <Stack spacing={1.5}>
                  <Typography sx={{ color: SP.muted, fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                    Location
                  </Typography>
                  <Typography sx={{ fontSize: 14, fontWeight: 700 }}>
                    {Number(liveDetails.latitude).toFixed(6)}, {Number(liveDetails.longitude).toFixed(6)}
                  </Typography>
                  <Typography sx={{ color: SP.muted, fontSize: 13 }}>
                    Radius {liveDetails.radius_miles} mi · {fenceRules(liveDetails) || "No alert rules"}
                  </Typography>
                  <Divider sx={{ my: 0.5 }} />
                  <Button
                    startIcon={<ExternalLink size={16} />}
                    onClick={() => window.open(mapsUrl(liveDetails.latitude, liveDetails.longitude), "_blank", "noopener,noreferrer")}
                    sx={{ justifyContent: "flex-start", textTransform: "none", fontWeight: 800, color: SP.blue }}
                  >
                    Open in Google Maps
                  </Button>
                  <PrimaryButton startIcon={<Pencil size={16} />} onClick={() => openEdit(liveDetails)}>
                    Edit geofence
                  </PrimaryButton>
                </Stack>
              </Box>
            </DialogContent>
          </>
        )}
      </Dialog>

      <Dialog open={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)}>
        <DialogTitle sx={{ fontWeight: 800 }}>Delete geofence?</DialogTitle>
        <DialogContent>
          <Typography sx={{ color: SP.slate, fontSize: 14 }}>
            {deleteTarget?.name || "This zone"} will be removed. This cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDeleteTarget(null)} sx={{ textTransform: "none", fontWeight: 700, color: SP.slate }}>
            Cancel
          </Button>
          <Button onClick={handleDelete} sx={{ textTransform: "none", fontWeight: 800, color: SP.red }}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
