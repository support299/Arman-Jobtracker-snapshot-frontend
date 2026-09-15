import { useEffect, useState } from "react";
import {
  Box,
  Button,
  Drawer,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Typography,
} from "@mui/material";
import { Link2, Mail, UserRound, X } from "lucide-react";
import { useGetDevicesQuery, useGetFleetAssignmentsQuery, useSaveFleetAssignmentsMutation } from "../../../store/api/onestepgpsApi";
import { useGetEmployeesQuery } from "../../../store/api/payrollApi";
import { PrimaryButton } from "./FleetPrimitives";
import { SP } from "./fleetUi";

export default function FleetSettingsDrawer({ open, onClose, onOpenGps }) {
  const [section, setSection] = useState("integration");
  const { data: devicesData } = useGetDevicesQuery(undefined, { skip: !open });
  const { data: assignmentsData } = useGetFleetAssignmentsQuery(undefined, { skip: !open });
  const { data: employeesData } = useGetEmployeesQuery({ is_active: true }, { skip: !open });
  const [saveAssignments, { isLoading }] = useSaveFleetAssignmentsMutation();
  const devices = devicesData?.devices || [];
  const employees = employeesData?.results || [];
  const [map, setMap] = useState({});

  useEffect(() => {
    const next = {};
    (assignmentsData?.results || []).forEach((row) => {
      next[row.device_id] = row.user || "";
    });
    setMap(next);
  }, [assignmentsData]);

  const handleSave = async () => {
    const assignments = devices.map((d) => {
      const userId = map[d.device_id] || null;
      const emp = employees.find((e) => String(e.user_id ?? e.id) === String(userId));
      return {
        device_id: d.device_id,
        user: userId || null,
        technician_name: emp ? `${emp.first_name || ""} ${emp.last_name || ""}`.trim() : "",
      };
    });
    await saveAssignments(assignments).unwrap();
  };

  const tabs = [
    { id: "integration", label: "Integration", icon: Link2 },
    { id: "assignments", label: "Assignments", icon: UserRound },
    { id: "notifications", label: "Notifications", icon: Mail },
  ];

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{ sx: { width: { xs: "100%", sm: 420 }, bgcolor: "#fff" } }}
    >
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ px: 2.5, pt: 2.5, pb: 1.5, borderBottom: `1px solid ${SP.line}` }}>
        <Box>
          <Typography sx={{ color: SP.blue, fontSize: 11, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase" }}>
            Fleet configuration
          </Typography>
          <Typography sx={{ fontSize: 22, fontWeight: 800, color: SP.ink, mt: 0.5 }}>Fleet settings</Typography>
        </Box>
        <IconButton onClick={onClose}><X size={18} /></IconButton>
      </Stack>

      <Stack direction="row" spacing={0.5} sx={{ px: 2, pt: 1.5, borderBottom: `1px solid ${SP.line}` }}>
        {tabs.map((t) => {
          const Icon = t.icon;
          const active = section === t.id;
          return (
            <Button
              key={t.id}
              onClick={() => setSection(t.id)}
              startIcon={<Icon size={14} />}
              sx={{
                textTransform: "none",
                fontWeight: 800,
                fontSize: 12,
                color: active ? SP.blue : SP.muted,
                borderBottom: `2px solid ${active ? SP.blue : "transparent"}`,
                borderRadius: 0,
                pb: 1.25,
              }}
            >
              {t.label}
            </Button>
          );
        })}
      </Stack>

      <Box sx={{ p: 2.5 }}>
        {section === "integration" && (
          <Stack spacing={2}>
            <Typography sx={{ color: SP.slate, fontSize: 13, lineHeight: 1.6 }}>
              Connect this GHL subaccount to its One Step GPS account. Use the DataQueue URL in GPS settings for alerts, trips, and diagnostics.
            </Typography>
            <PrimaryButton onClick={onOpenGps}>Open GPS connection</PrimaryButton>
          </Stack>
        )}

        {section === "assignments" && (
          <Stack spacing={2}>
            <Typography sx={{ color: SP.slate, fontSize: 13, lineHeight: 1.6 }}>
              Match OneStep vehicles to the technician. Assignments auto sync to this section.
            </Typography>
            {devices.length === 0 && (
              <Typography sx={{ color: SP.muted, fontSize: 13 }}>No live vehicles yet. Connect GPS first.</Typography>
            )}
            {devices.map((device) => (
              <FormControl key={device.device_id} fullWidth size="small">
                <InputLabel>{device.display_name || device.device_id}</InputLabel>
                <Select
                  label={device.display_name || device.device_id}
                  value={map[device.device_id] || ""}
                  onChange={(e) => setMap((prev) => ({ ...prev, [device.device_id]: e.target.value }))}
                >
                  <MenuItem value="">Unassigned</MenuItem>
                  {employees.map((emp) => (
                    <MenuItem key={emp.id} value={emp.user_id ?? emp.id}>
                      {`${emp.first_name || ""} ${emp.last_name || ""}`.trim() || emp.email}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            ))}
            <PrimaryButton disabled={isLoading || devices.length === 0} onClick={handleSave}>
              {isLoading ? "Saving…" : "Save assignments"}
            </PrimaryButton>
          </Stack>
        )}

        {section === "notifications" && (
          <Stack spacing={1.5}>
            <Typography sx={{ color: SP.slate, fontSize: 13, lineHeight: 1.6 }}>
              Alert, geofence, and maintenance notifications use the OneStep webhook plus JobTracker alerts. Configure the webhook in GPS connection.
            </Typography>
            <PrimaryButton onClick={onOpenGps}>Open GPS connection</PrimaryButton>
          </Stack>
        )}
      </Box>
    </Drawer>
  );
}
