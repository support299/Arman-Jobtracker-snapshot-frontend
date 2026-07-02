import { useState } from "react"
import { Link, useParams } from "react-router-dom"
import {
  ArrowLeft,
  ExternalLink,
  RefreshCw,
  Save,
  Shield,
  Zap,
} from "lucide-react"
import { toast } from "sonner"
import {
  useGetPlatformAccountQuery,
  useGetPlatformAccountCalendarsQuery,
  useUpdatePlatformAccountMutation,
  useRunPlatformAccountActionMutation,
  useRunPlatformHealthCheckMutation,
  useImpersonatePlatformAccountMutation,
} from "../../store/api/platformApi"
import PageHeader from "../components/PageHeader"
import StatusBadge from "../components/StatusBadge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { formatDateTime, formatRelative, platformStatusLabel } from "../utils/formatters"

const MANUAL_ACTIONS = [
  { key: "sync-contacts", label: "Sync Contacts", description: "Queue full contact sync from GHL" },
  { key: "sync-users", label: "Sync Users", description: "Sync GHL users into the database" },
  { key: "refresh-calendars", label: "Refresh Calendars", description: "Queue calendar sync from GHL" },
  { key: "ensure-media-folders", label: "Ensure Media Folders", description: "Create missing GHL media folders" },
  { key: "rebootstrap", label: "Re-bootstrap Location", description: "Re-run full location bootstrap" },
  { key: "refresh-token", label: "Refresh OAuth Token", description: "Refresh access token using refresh token" },
]

export default function PlatformAccountDetail() {
  const { id } = useParams()
  const { data: account, isLoading, isError, error, refetch } = useGetPlatformAccountQuery(id)
  const { data: calendars = [] } = useGetPlatformAccountCalendarsQuery(id, { skip: !id })
  const [updateAccount, { isLoading: saving }] = useUpdatePlatformAccountMutation()
  const [runAction, { isLoading: actionLoading }] = useRunPlatformAccountActionMutation()
  const [healthCheck, { isLoading: healthLoading }] = useRunPlatformHealthCheckMutation()
  const [impersonate] = useImpersonatePlatformAccountMutation()

  const [form, setForm] = useState(null)

  const current = form || account

  const setField = (key, value) => {
    setForm((prev) => ({ ...(prev || account), [key]: value }))
  }

  const handleSave = async () => {
    if (!current) return
    try {
      await updateAccount({
        id,
        company_name: current.company_name,
        timezone: current.timezone,
        is_active: current.is_active,
        platform_status: current.platform_status,
        internal_notes: current.internal_notes,
        booking_redirect_url: current.booking_redirect_url,
        invoice_link_base_url: current.invoice_link_base_url,
      }).unwrap()
      setForm(null)
      toast.success("Account updated")
    } catch (err) {
      toast.error(err?.data?.detail || "Failed to update account")
    }
  }

  const handleAction = async (action) => {
    try {
      const result = await runAction({ id, action }).unwrap()
      toast.success(result?.message || `${action} completed`)
      refetch()
    } catch (err) {
      toast.error(err?.data?.detail || `Failed to run ${action}`)
    }
  }

  const handleHealthCheck = async () => {
    try {
      await healthCheck(id).unwrap()
      toast.success("Health check completed")
      refetch()
    } catch (err) {
      toast.error(err?.data?.detail || "Health check failed")
    }
  }

  const handleImpersonate = async () => {
    try {
      const result = await impersonate({ id }).unwrap()
      window.open(result.redirect_url, "_blank", "noopener,noreferrer")
      toast.success("Opening tenant in support mode")
    } catch (err) {
      toast.error(err?.data?.detail || "Impersonation failed")
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    )
  }

  if (isError || !account) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{error?.data?.detail || "Account not found"}</AlertDescription>
      </Alert>
    )
  }

  const health = account.health || {}
  const location = account.location_snapshot

  return (
    <div>
      <Button variant="ghost" size="sm" className="mb-4" asChild>
        <Link to="/platform/accounts"><ArrowLeft className="mr-2 h-4 w-4" />Back to accounts</Link>
      </Button>

      <PageHeader
        title={account.company_name || account.location_id}
        description={`Location ${account.location_id} · Company ${account.company_id || "—"}`}
        actions={
          <>
            <Button variant="outline" onClick={() => refetch()}><RefreshCw className="mr-2 h-4 w-4" />Refresh</Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button><Shield className="mr-2 h-4 w-4" />Open as tenant</Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Open in support mode?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This opens the tenant application scoped to this location. The action will be recorded in the audit log.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleImpersonate}>Open tenant</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </>
        }
      />

      <div className="mb-6 flex flex-wrap gap-2">
        <StatusBadge status={account.platform_status} label={platformStatusLabel(account.platform_status)} />
        <StatusBadge status={health.status} />
        {!account.is_active && <StatusBadge status="inactive" label="Deactivated" />}
      </div>

      {(health.warnings || []).length > 0 && (
        <Alert className="mb-6 border-amber-200 bg-amber-50">
          <AlertDescription>
            <ul className="list-disc pl-4 text-sm text-amber-900">
              {health.warnings.map((w) => <li key={w}>{w}</li>)}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader><CardTitle className="text-base">Account settings</CardTitle></CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Company name</Label>
                <Input value={current?.company_name || ""} onChange={(e) => setField("company_name", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Timezone</Label>
                <Input value={current?.timezone || ""} onChange={(e) => setField("timezone", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Platform status</Label>
                <Select value={current?.platform_status || "active"} onValueChange={(v) => setField("platform_status", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="trial">Trial</SelectItem>
                    <SelectItem value="suspended">Suspended</SelectItem>
                    <SelectItem value="churned">Churned</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <Label>Active</Label>
                  <p className="text-xs text-muted-foreground">Tenant can use the application</p>
                </div>
                <Switch checked={!!current?.is_active} onCheckedChange={(v) => setField("is_active", v)} />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Booking redirect URL</Label>
                <Input value={current?.booking_redirect_url || ""} onChange={(e) => setField("booking_redirect_url", e.target.value)} />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Invoice link base URL</Label>
                <Input value={current?.invoice_link_base_url || ""} onChange={(e) => setField("invoice_link_base_url", e.target.value)} />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Internal notes</Label>
                <Textarea rows={4} value={current?.internal_notes || ""} onChange={(e) => setField("internal_notes", e.target.value)} />
              </div>
              <div className="sm:col-span-2">
                <Button onClick={handleSave} disabled={saving || !form}>
                  <Save className="mr-2 h-4 w-4" />Save changes
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Manual actions</CardTitle></CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              {MANUAL_ACTIONS.map((action) => (
                <div key={action.key} className="rounded-lg border p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium">{action.label}</p>
                      <p className="text-xs text-muted-foreground">{action.description}</p>
                    </div>
                    <Button size="sm" variant="outline" disabled={actionLoading} onClick={() => handleAction(action.key)}>
                      <Zap className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Calendars</CardTitle></CardHeader>
            <CardContent>
              {calendars.length === 0 ? (
                <p className="text-sm text-muted-foreground">No calendars synced yet.</p>
              ) : (
                <ul className="space-y-2">
                  {calendars.map((cal) => (
                    <li key={cal.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                      <span>{cal.name}</span>
                      {cal.is_service_calendar && <StatusBadge status="active" label="Service calendar" />}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle className="text-base">Health & sync</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Last sync</span><span>{formatRelative(account.last_sync_at)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Last health check</span><span>{formatRelative(account.last_health_check_at)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Token expires</span><span>{formatDateTime(health.token_expires_at)}</span></div>
              <Button variant="outline" className="w-full" onClick={handleHealthCheck} disabled={healthLoading}>Run health check</Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">OAuth</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div><span className="text-muted-foreground">User ID:</span> <span className="font-mono text-xs">{account.user_id || "—"}</span></div>
              <div><span className="text-muted-foreground">User type:</span> {account.user_type || "—"}</div>
              <div><span className="text-muted-foreground">Scope:</span> <span className="break-all text-xs">{account.scope || "—"}</span></div>
              <div><span className="text-muted-foreground">Expires in:</span> {account.expires_in ? `${account.expires_in}s` : "—"}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Location</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              {location ? (
                <>
                  <div className="font-medium">{location.name}</div>
                  <div className="text-muted-foreground">{location.address}</div>
                  <div>{location.city}, {location.state}</div>
                  <div>{location.email} · {location.phone}</div>
                </>
              ) : (
                <p className="text-muted-foreground">No location snapshot stored.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Stats</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-3 gap-2 text-center text-sm">
              <div><div className="text-2xl font-bold">{account.stats?.jobs ?? 0}</div><div className="text-muted-foreground">Jobs</div></div>
              <div><div className="text-2xl font-bold">{account.stats?.quotes ?? 0}</div><div className="text-muted-foreground">Quotes</div></div>
              <div><div className="text-2xl font-bold">{account.stats?.users ?? 0}</div><div className="text-muted-foreground">Users</div></div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Platform metadata</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Onboarded</span><span>{formatDateTime(account.onboarded_at)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Onboarded by</span><span>{account.onboarded_by_email || "—"}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Updated</span><span>{formatDateTime(account.updated_at)}</span></div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
