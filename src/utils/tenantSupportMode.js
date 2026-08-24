import { getIframeLocationId } from "./iframeContext"

/** Superuser viewing a subaccount via ?location_id= (platform "Open as tenant"). */
export function isTenantSupportMode(user) {
  if (!user?.is_superuser) return false
  return Boolean(getIframeLocationId())
}

export const TENANT_OPEN_DESTINATIONS = [
  {
    key: "jobtracker",
    label: "Job Tracker",
    description: "Jobs, map, and scheduling",
    path: "/admin/jobs",
  },
  {
    key: "dashboard",
    label: "Dashboard",
    description: "Admin overview and metrics",
    path: "/admin/dashboard",
  },
  {
    key: "quotes",
    label: "Quotes",
    description: "Accepted quotes and proposals",
    path: "/admin/accepted-quotes",
  },
  {
    key: "payroll",
    label: "Payroll",
    description: "Reports, time clock, and settings",
    path: "/admin/payroll/reports",
  },
  {
    key: "booking",
    label: "Quote / booking app",
    description: "Customer-facing booking flow",
    path: "/booking",
  },
  {
    key: "settings",
    label: "Account Settings",
    description: "Logo, timezone, invoice URLs",
    path: "/admin/account-settings",
  },
  {
    key: "referrals",
    label: "Referrals",
    description: "Customer referral program",
    path: "/admin/referrals",
  },
]
