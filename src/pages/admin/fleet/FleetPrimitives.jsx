import { Box, Button, Chip, CircularProgress, Stack, Typography } from "@mui/material";
import { CheckCircle2 } from "lucide-react";
import { SP, TONE } from "./fleetUi";

export function Eyebrow({ children }) {
  return (
    <Typography
      sx={{
        color: SP.blue,
        fontSize: 11,
        fontWeight: 800,
        letterSpacing: "0.14em",
        textTransform: "uppercase",
      }}
    >
      {children}
    </Typography>
  );
}

export function ArchivePill({ count }) {
  return (
    <Chip
      icon={<CheckCircle2 size={14} />}
      label={`${Number(count || 0).toLocaleString()} raw records secured`}
      sx={{
        height: 34,
        bgcolor: SP.greenSoft,
        color: "#087e36",
        fontWeight: 800,
        fontSize: 11,
        "& .MuiChip-icon": { color: "#087e36" },
      }}
    />
  );
}

export function FleetSectionHeader({ eyebrow, title, description, count }) {
  return (
    <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ sm: "flex-start" }} spacing={2} sx={{ mb: 2 }}>
      <Box>
        <Eyebrow>{eyebrow}</Eyebrow>
        <Typography sx={{ fontSize: 23, fontWeight: 800, letterSpacing: "-0.035em", color: SP.ink, mt: 0.5 }}>
          {title}
        </Typography>
        <Typography sx={{ color: SP.muted, fontSize: 13, mt: 0.75, maxWidth: 670, lineHeight: 1.6 }}>
          {description}
        </Typography>
      </Box>
      <ArchivePill count={count} />
    </Stack>
  );
}

export function MetricCard({ icon: Icon, label, value, tone = "blue", hint }) {
  const colors = TONE[tone] || TONE.blue;
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1.5,
        minHeight: 92,
        px: 2,
        py: 1.75,
        bgcolor: "#fff",
        border: `1px solid ${SP.line}`,
        borderRadius: "15px",
        boxShadow: SP.shadow,
        flex: 1,
      }}
    >
      <Box
        sx={{
          width: 43,
          height: 43,
          borderRadius: "12px",
          bgcolor: colors.bg,
          color: colors.fg,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <Icon size={19} />
      </Box>
      <Box>
        <Typography sx={{ color: SP.muted, fontSize: 11, fontWeight: 700 }}>{label}</Typography>
        <Typography sx={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.035em", color: SP.ink, lineHeight: 1.15 }}>
          {value}
        </Typography>
        {hint && (
          <Typography sx={{ color: SP.muted, fontSize: 11, mt: 0.25 }}>{hint}</Typography>
        )}
      </Box>
    </Box>
  );
}

export function OperationsPanel({ title, subtitle, icon: Icon, children, minHeight = 360 }) {
  return (
    <Box
      sx={{
        bgcolor: "#fff",
        border: `1px solid ${SP.line}`,
        borderRadius: "16px",
        boxShadow: SP.shadow,
        overflow: "hidden",
        minHeight,
      }}
    >
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        sx={{ minHeight: 68, px: 2.25, borderBottom: `1px solid ${SP.line}` }}
      >
        <Box>
          <Typography sx={{ fontSize: 15, fontWeight: 800, color: SP.ink }}>{title}</Typography>
          {subtitle && (
            <Typography sx={{ color: SP.muted, fontSize: 12, mt: 0.25 }}>{subtitle}</Typography>
          )}
        </Box>
        {Icon && <Icon size={18} color={SP.muted} />}
      </Stack>
      {children}
    </Box>
  );
}

export function OperationsEmpty({ icon: Icon, label }) {
  return (
    <Stack alignItems="center" justifyContent="center" spacing={1.25} sx={{ minHeight: 280, px: 4, py: 5, textAlign: "center" }}>
      {Icon && <Icon size={28} color="#a4b1bf" />}
      <Typography sx={{ color: SP.muted, fontSize: 13, lineHeight: 1.6, maxWidth: 430 }}>{label}</Typography>
    </Stack>
  );
}

export function FilterPills({ value, onChange, options }) {
  return (
    <Stack direction="row" spacing={0.75} sx={{ overflowX: "auto", pb: 0.5 }}>
      {options.map((opt) => {
        const active = value === opt.id;
        return (
          <Button
            key={opt.id}
            onClick={() => onChange(opt.id)}
            sx={{
              minWidth: 0,
              px: 1.5,
              py: 0.75,
              borderRadius: 999,
              fontSize: 12,
              fontWeight: 800,
              textTransform: "none",
              bgcolor: active ? SP.ink : "#fff",
              color: active ? "#fff" : SP.muted,
              border: `1px solid ${active ? SP.ink : SP.line}`,
              "&:hover": { bgcolor: active ? SP.ink : SP.soft },
            }}
          >
            {opt.label}
          </Button>
        );
      })}
    </Stack>
  );
}

export function LoadingBlock() {
  return (
    <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
      <CircularProgress size={28} sx={{ color: SP.blue }} />
    </Box>
  );
}

export function PrimaryButton({ children, ...props }) {
  return (
    <Button
      variant="contained"
      {...props}
      sx={{
        bgcolor: SP.blue,
        textTransform: "none",
        fontWeight: 800,
        borderRadius: "10px",
        boxShadow: "none",
        "&:hover": { bgcolor: "#075ed0", boxShadow: "none" },
        ...props.sx,
      }}
    >
      {children}
    </Button>
  );
}
