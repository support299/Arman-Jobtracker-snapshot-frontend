import { useState } from "react"
import { NavLink, Outlet, useNavigate } from "react-router-dom"
import { useDispatch, useSelector } from "react-redux"
import {
  LayoutDashboard,
  Building2,
  Users,
  HeartPulse,
  ScrollText,
  Rocket,
  LogOut,
  Menu,
  X,
  Shield,
  ExternalLink,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { logoutUser } from "../store/slices/authSlice"

const NAV_ITEMS = [
  { label: "Dashboard", path: "/platform/dashboard", icon: LayoutDashboard },
  { label: "Accounts", path: "/platform/accounts", icon: Building2 },
  { label: "Onboarding", path: "/platform/onboarding", icon: Rocket },
  { label: "Companies", path: "/platform/companies", icon: Users },
  { label: "Health", path: "/platform/health", icon: HeartPulse },
  { label: "Audit Log", path: "/platform/audit", icon: ScrollText },
]

export function PlatformLayout() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const user = useSelector((state) => state.auth.user)
  const dispatch = useDispatch()
  const navigate = useNavigate()

  const handleLogout = () => {
    dispatch(logoutUser())
    navigate("/admin/login")
  }

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b px-6 py-5">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
          <Shield className="h-5 w-5" />
        </div>
        <div>
          <p className="text-sm font-semibold tracking-tight">Service Pilot</p>
          <p className="text-xs text-muted-foreground">Platform Portal</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            onClick={() => setMobileOpen(false)}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )
            }
          >
            <item.icon className="h-4 w-4 shrink-0" />
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="border-t p-4 space-y-2">
        <Button
          variant="outline"
          className="w-full justify-start gap-2"
          onClick={() => navigate("/admin/jobs")}
        >
          <ExternalLink className="h-4 w-4" />
          Tenant App
        </Button>
        <div className="rounded-lg bg-muted/50 px-3 py-2">
          <p className="truncate text-xs font-medium">{user?.email || "Super Admin"}</p>
          <p className="text-[11px] text-muted-foreground">Platform Administrator</p>
        </div>
        <Button variant="ghost" className="w-full justify-start gap-2 text-muted-foreground" onClick={handleLogout}>
          <LogOut className="h-4 w-4" />
          Sign out
        </Button>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-slate-50/80">
      <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col lg:border-r lg:bg-white">
        {sidebar}
      </div>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            aria-label="Close menu"
            onClick={() => setMobileOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 w-72 bg-white shadow-xl">{sidebar}</div>
        </div>
      )}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b bg-white/90 px-4 backdrop-blur lg:px-8">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setMobileOpen((open) => !open)}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
          <div className="flex-1" />
          <span className="hidden text-xs text-muted-foreground sm:inline">Internal use only</span>
        </header>

        <main className="mx-auto max-w-[1400px] px-4 py-6 lg:px-8 lg:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

export default PlatformLayout
