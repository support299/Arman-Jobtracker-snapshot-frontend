"use client";

import React, { useState } from "react";
import {
  Box,
  Typography,
  Button,
  Chip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
} from "@mui/material";
import { User, MapPin, Phone, Mail, Trash2 } from "lucide-react";
import moment from "moment-timezone";
import { useDispatch } from "react-redux";
import {
  jobsApi,
  useUpdateEstimateStatusMutation,
  useDeleteEstimateMutation,
} from "../../../store/api/jobsApi";
import { getEstimateAddress } from "../../../utils/geocode";
import { useToast } from "@/hooks/use-toast";
import { useAccountTimezone } from "@/hooks/useAccountTimezone";

const STATUS_OPTIONS = [
  { value: "confirmed", label: "Confirmed" },
  { value: "on_my_way", label: "On My Way" },
  { value: "in_progress", label: "In Progress" },
  { value: "quoted", label: "Quoted" },
  { value: "canceled", label: "Canceled" },
  { value: "accepted", label: "Accepted" },
  { value: "declined", label: "Declined" },
  { value: "expired", label: "Expired" },
];

export function MapEstimateDetailsContent({
  estimate,
  estimatesParams,
  user,
  onDeleted,
  embeddedInPanel = false,
}) {
  const accountTimezone = useAccountTimezone();
  const [localEstimate, setLocalEstimate] = useState(estimate);
  const dispatch = useDispatch();
  const { toast } = useToast();
  const [updateEstimateStatus, { isLoading: isUpdatingEstimate }] = useUpdateEstimateStatusMutation();
  const [deleteEstimate, { isLoading: isDeletingEstimate }] = useDeleteEstimateMutation();

  const displayEstimate = localEstimate || estimate;
  if (!displayEstimate) return null;

  const address = displayEstimate.address || displayEstimate.contact_full_address || getEstimateAddress(displayEstimate);
  const status = displayEstimate.estimate_status ?? displayEstimate.appointment_status ?? "";

  const handleStatusChange = async (e) => {
    const newStatus = e.target.value;
    if (!displayEstimate?.appointment_id) {
      toast({ title: "Error", description: "Estimate information is missing", variant: "destructive" });
      return;
    }
    if (newStatus === status) return;

    try {
      await updateEstimateStatus({
        id: displayEstimate.appointment_id,
        estimate_status: newStatus,
      }).unwrap();

      setLocalEstimate((prev) => (prev ? { ...prev, estimate_status: newStatus } : prev));

      if (estimatesParams) {
        dispatch(
          jobsApi.util.updateQueryData("getEstimateAppointmentsCalendar", estimatesParams, (draft) => {
            if (Array.isArray(draft)) {
              const idx = draft.findIndex((e) => e.appointment_id === displayEstimate.appointment_id);
              if (idx !== -1) draft[idx] = { ...draft[idx], estimate_status: newStatus };
            } else if (draft?.results) {
              const idx = draft.results.findIndex((e) => e.appointment_id === displayEstimate.appointment_id);
              if (idx !== -1) draft.results[idx] = { ...draft.results[idx], estimate_status: newStatus };
            }
          })
        );
      }

      toast({ title: "Success", description: "Estimate status updated successfully" });
    } catch (error) {
      toast({
        title: "Error",
        description: error?.data?.message || "Failed to update estimate status.",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async () => {
    if (!displayEstimate?.appointment_id) return;
    if (!window.confirm(`Delete "${displayEstimate.title || "this estimate"}"? This cannot be undone.`)) return;

    try {
      await deleteEstimate(displayEstimate.appointment_id).unwrap();

      if (estimatesParams) {
        dispatch(
          jobsApi.util.updateQueryData("getEstimateAppointmentsCalendar", estimatesParams, (draft) => {
            if (Array.isArray(draft)) {
              const filtered = draft.filter((e) => e.appointment_id !== displayEstimate.appointment_id);
              draft.length = 0;
              draft.push(...filtered);
            } else if (draft?.results) {
              draft.results = draft.results.filter((e) => e.appointment_id !== displayEstimate.appointment_id);
            }
          })
        );
      }

      toast({ title: "Success", description: "Estimate deleted" });
      onDeleted?.();
    } catch (error) {
      toast({
        title: "Error",
        description: error?.data?.message || "Failed to delete estimate.",
        variant: "destructive",
      });
    }
  };

  const linkStyle = {
    fontSize: "0.875rem",
    color: "#1976d2",
    textDecoration: "none",
  };

  return (
    <Box sx={{ width: embeddedInPanel ? "100%" : 380, maxWidth: embeddedInPanel ? "none" : "90vw", p: 2, fontFamily: '"Inter", system-ui, sans-serif' }}>
      <Box sx={{ mb: 2 }}>
        <Chip
          size="small"
          label="Estimate"
          sx={{ backgroundColor: "#14b8a620", color: "#14b8a6", fontWeight: 600, mb: 1 }}
        />
        <Typography variant="subtitle1" fontWeight={600}>
          Estimate Details
        </Typography>
      </Box>

      {/* Customer Information */}
      <Box sx={{ pb: 2, borderBottom: 1, borderColor: "divider" }}>
        <Typography variant="caption" sx={{ fontWeight: 600, color: "text.secondary", textTransform: "uppercase" }}>
          Customer Information
        </Typography>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1, mt: 1 }}>
          {displayEstimate.contact_name && (
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <User size={14} style={{ flexShrink: 0 }} />
              {displayEstimate.ghl_contact_id ? (
              <a
                href={`${import.meta.env.VITE_SERVICE_PILOT_APP_URL || "https://app.theservicepilot.com"}/v2/location/${import.meta.env.VITE_LOCATION_ID || "b8qvo7VooP3JD3dIZU42"}/contacts/detail/${displayEstimate.ghl_contact_id}/`}
                target="_blank"
                rel="noopener noreferrer"
                style={linkStyle}
              >
                  {displayEstimate.contact_name}
                </a>
              ) : (
                <Typography variant="body2">{displayEstimate.contact_name}</Typography>
              )}
            </Box>
          )}
          {address && (
            <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1 }}>
              <MapPin size={14} style={{ marginTop: 2, flexShrink: 0 }} />
              <a
                href={`${import.meta.env.VITE_GOOGLE_MAPS_SEARCH_URL || "https://www.google.com/maps/search/?api=1&query="}${encodeURIComponent(address)}`}
                target="_blank"
                rel="noopener noreferrer"
                style={linkStyle}
              >
                {address}
              </a>
            </Box>
          )}
          {(displayEstimate.contact_phone || displayEstimate.customer_phone || displayEstimate.phone) && (
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <Phone size={14} style={{ flexShrink: 0 }} />
              <a
                href={`tel:${displayEstimate.contact_phone || displayEstimate.customer_phone || displayEstimate.phone}`}
                style={linkStyle}
              >
                {displayEstimate.contact_phone || displayEstimate.customer_phone || displayEstimate.phone}
              </a>
            </Box>
          )}
          {(displayEstimate.contact_email || displayEstimate.customer_email || displayEstimate.email) && (
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <Mail size={14} style={{ flexShrink: 0 }} />
              <a
                href={`mailto:${displayEstimate.contact_email || displayEstimate.customer_email || displayEstimate.email}`}
                style={linkStyle}
              >
                {displayEstimate.contact_email || displayEstimate.customer_email || displayEstimate.email}
              </a>
            </Box>
          )}
        </Box>
      </Box>

      {/* Estimate Details */}
      <Box sx={{ py: 2 }}>
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
          <Typography variant="body2" color="text.secondary">Title</Typography>
          <Typography variant="body2">{displayEstimate.title || "N/A"}</Typography>
        </Box>
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
          <Typography variant="body2" color="text.secondary">Assigned To</Typography>
          <Typography variant="body2">{displayEstimate.assigned_user_name || "Unassigned"}</Typography>
        </Box>
        {displayEstimate.calendar && (
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
            <Typography variant="body2" color="text.secondary">Calendar</Typography>
            <a
              href={`${import.meta.env.VITE_SERVICE_PILOT_APP_URL || "https://app.theservicepilot.com"}/v2/location/${import.meta.env.VITE_LOCATION_ID || "b8qvo7VooP3JD3dIZU42"}/calendars/view?user_ids=${user?.ghl_user_id}`}
              target="_blank"
              rel="noopener noreferrer"
              style={linkStyle}
            >
              {displayEstimate.calendar.name || "View Calendar"}
            </a>
          </Box>
        )}
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1, gap: 1 }}>
          <Typography variant="body2" color="text.secondary">Status</Typography>
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <Select
              value={status}
              onChange={handleStatusChange}
              disabled={isUpdatingEstimate}
              displayEmpty
            >
              {STATUS_OPTIONS.map((opt) => (
                <MenuItem key={opt.value} value={opt.value}>
                  {opt.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>
        <Box sx={{ mb: 1 }}>
          <Typography variant="body2" color="text.secondary">Start Time</Typography>
          <Typography variant="body2">
            {displayEstimate.start_time
              ? moment.utc(displayEstimate.start_time).tz(accountTimezone).format("MMMM D, YYYY h:mm A")
              : "N/A"}
          </Typography>
        </Box>
        <Box sx={{ mb: 1 }}>
          <Typography variant="body2" color="text.secondary">End Time</Typography>
          <Typography variant="body2">
            {displayEstimate.end_time
              ? moment.utc(displayEstimate.end_time).tz(accountTimezone).format("MMMM D, YYYY h:mm A")
              : "N/A"}
          </Typography>
        </Box>
        {displayEstimate.notes && (
          <Box sx={{ mb: 1 }}>
            <Typography variant="body2" color="text.secondary">Notes</Typography>
            <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>{displayEstimate.notes}</Typography>
          </Box>
        )}
        {displayEstimate.source && (
          <Box sx={{ display: "flex", justifyContent: "space-between", mb: 1 }}>
            <Typography variant="body2" color="text.secondary">Source</Typography>
            <Typography variant="body2">{displayEstimate.source}</Typography>
          </Box>
        )}
      </Box>

      <Button
        variant="outlined"
        color="error"
        size="small"
        startIcon={isDeletingEstimate ? <CircularProgress size={16} /> : <Trash2 size={16} />}
        onClick={handleDelete}
        disabled={isDeletingEstimate}
        fullWidth
      >
        Delete Estimate
      </Button>
    </Box>
  );
}

export default MapEstimateDetailsContent;
