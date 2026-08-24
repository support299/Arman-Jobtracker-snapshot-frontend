import {
  Assessment,
  AttachMoney,
  CardGiftcard,
  ReceiptLong,
  Settings,
  Storefront,
  WorkOutline,
} from "@mui/icons-material"
import { Box, Button, Chip, Typography } from "@mui/material"
import { useLocation, useNavigate } from "react-router-dom"
import { useSelector } from "react-redux"
import { appendLocationIdToPath, getIframeLocationId } from "../../utils/iframeContext"
import { isTenantSupportMode } from "../../utils/tenantSupportMode"

export const TENANT_MODULES = [
  {
    key: "jobtracker",
    label: "Job Tracker",
    path: "/admin/jobs",
    icon: WorkOutline,
    match: (pathname) =>
      pathname.startsWith("/admin/jobs") ||
      pathname.startsWith("/admin/map") ||
      pathname.startsWith("/admin/on-hold-jobs") ||
      pathname.startsWith("/admin/create-job") ||
      pathname.startsWith("/admin/team") ||
      pathname.startsWith("/admin/contacts") ||
      pathname.startsWith("/admin/pending-reschedule-quotes") ||
      pathname.startsWith("/admin/services") ||
      pathname.startsWith("/admin/locations") ||
      pathname.startsWith("/admin/calendar"),
  },
  {
    key: "dashboard",
    label: "Dashboard",
    path: "/admin/dashboard",
    icon: Assessment,
    match: (pathname) => pathname.startsWith("/admin/dashboard"),
  },
  {
    key: "quotes",
    label: "Quotes",
    path: "/admin/accepted-quotes",
    icon: ReceiptLong,
    match: (pathname) => pathname.startsWith("/admin/accepted-quotes"),
  },
  {
    key: "payroll",
    label: "Payroll",
    path: "/admin/payroll/reports",
    icon: AttachMoney,
    match: (pathname) => pathname.startsWith("/admin/payroll"),
  },
  {
    key: "booking",
    label: "Booking App",
    path: "/booking",
    icon: Storefront,
    match: (pathname) => pathname === "/booking" || pathname.startsWith("/quote/"),
  },
  {
    key: "settings",
    label: "Account Settings",
    path: "/admin/account-settings",
    icon: Settings,
    match: (pathname) => pathname.startsWith("/admin/account-settings"),
  },
  {
    key: "referrals",
    label: "Referrals",
    path: "/admin/referrals",
    icon: CardGiftcard,
    match: (pathname) => pathname.startsWith("/admin/referrals"),
  },
]

export function getActiveTenantModule(pathname) {
  return TENANT_MODULES.find((module) => module.match(pathname)) || TENANT_MODULES[0]
}

export default function TenantModuleSwitcher({ compact = false }) {
  const navigate = useNavigate()
  const location = useLocation()
  const user = useSelector((state) => state.auth.user)
  const tenantSupportMode = isTenantSupportMode(user)
  const locationId = getIframeLocationId()
  const activeModule = getActiveTenantModule(location.pathname)

  if (!tenantSupportMode) return null

  const handleSwitch = (path) => {
    navigate(appendLocationIdToPath(path, locationId))
  }

  return (
    <Box
      sx={{
        borderBottom: "1px solid",
        borderColor: "divider",
        backgroundColor: compact ? "transparent" : "hsl(var(--muted) / 0.35)",
        px: { xs: 1.5, sm: 2, md: 3 },
        py: compact ? 1 : 1.25,
      }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1,
          flexWrap: "wrap",
        }}
      >
        {!compact && (
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mr: 1 }}>
            <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 700, letterSpacing: 0.4 }}>
              SWITCH APP
            </Typography>
            <Chip
              size="small"
              color="warning"
              label={locationId || "tenant"}
              sx={{ fontWeight: 600, maxWidth: 180 }}
            />
          </Box>
        )}

        <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap" }}>
          {TENANT_MODULES.map((module) => {
            const isActive = module.key === activeModule.key
            const Icon = module.icon
            return (
              <Button
                key={module.key}
                size="small"
                onClick={() => handleSwitch(module.path)}
                startIcon={<Icon sx={{ fontSize: 16 }} />}
                sx={{
                  textTransform: "none",
                  fontWeight: isActive ? 700 : 500,
                  borderRadius: 999,
                  px: 1.5,
                  color: isActive ? "hsl(var(--primary))" : "text.primary",
                  backgroundColor: isActive ? "white" : "transparent",
                  border: "1px solid",
                  borderColor: isActive ? "hsl(var(--primary) / 0.35)" : "transparent",
                  boxShadow: isActive ? "0 1px 2px rgba(0,0,0,0.06)" : "none",
                  "&:hover": {
                    backgroundColor: isActive ? "white" : "hsl(var(--primary) / 0.08)",
                  },
                }}
              >
                {module.label}
              </Button>
            )
          })}
        </Box>
      </Box>
    </Box>
  )
}
