import { useState } from "react"
import { useSearchParams, Link } from "react-router-dom"
import { Building2, Link2, Rocket, CheckCircle2 } from "lucide-react"
import { toast } from "sonner"
import {
  useGetPlatformOnboardingStatusQuery,
  useStartPlatformOnboardingMutation,
  useGetPlatformAgencyOnboardingStatusQuery,
  useStartPlatformAgencyOnboardingMutation,
} from "../../store/api/platformApi"
import PageHeader from "../components/PageHeader"
import StatusBadge from "../components/StatusBadge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { TableSkeleton } from "@/components/ui/skeletons"
import { openOAuthUrlInNewTab, pickAuthUrl, formatRelative } from "../utils/formatters"

export default function PlatformOnboarding() {
  const [searchParams, setSearchParams] = useSearchParams()
  const connectedSuccess = searchParams.get("connected") === "1"
  const agencyConnectedSuccess = searchParams.get("agency_connected") === "1"
  const [oauthHandoffUrl, setOauthHandoffUrl] = useState(null)
  const [agencyOauthHandoffUrl, setAgencyOauthHandoffUrl] = useState(null)

  const { data: recent = [], isLoading, refetch } = useGetPlatformOnboardingStatusQuery()
  const {
    data: recentAgencies = [],
    isLoading: agenciesLoading,
    refetch: refetchAgencies,
  } = useGetPlatformAgencyOnboardingStatusQuery()
  const [startOnboarding, { isLoading: starting }] = useStartPlatformOnboardingMutation()
  const [startAgencyOnboarding, { isLoading: startingAgency }] =
    useStartPlatformAgencyOnboardingMutation()

  const handleConnect = async () => {
    setOauthHandoffUrl(null)
    try {
      const body = await startOnboarding().unwrap()
      const authUrl = pickAuthUrl(body)
      if (!authUrl) {
        toast.error("Server did not return an OAuth URL")
        return
      }
      openOAuthUrlInNewTab(authUrl)
      setOauthHandoffUrl(authUrl)
      toast.message("OAuth opened in a new tab", { description: "Complete authorization in GoHighLevel" })
    } catch (err) {
      toast.error(err?.data?.detail || "Failed to start onboarding")
    }
  }

  const handleConnectAgency = async () => {
    setAgencyOauthHandoffUrl(null)
    try {
      const body = await startAgencyOnboarding().unwrap()
      const authUrl = pickAuthUrl(body)
      if (!authUrl) {
        toast.error("Server did not return an agency OAuth URL")
        return
      }
      openOAuthUrlInNewTab(authUrl)
      setAgencyOauthHandoffUrl(authUrl)
      toast.message("Agency OAuth opened in a new tab", {
        description: "Authorize the agency marketplace app in GoHighLevel",
      })
    } catch (err) {
      toast.error(err?.data?.detail || "Failed to start agency onboarding")
    }
  }

  const dismissSuccess = () => {
    searchParams.delete("connected")
    setSearchParams(searchParams, { replace: true })
    refetch()
  }

  const dismissAgencySuccess = () => {
    searchParams.delete("agency_connected")
    setSearchParams(searchParams, { replace: true })
    refetchAgencies()
    refetch()
  }

  return (
    <div>
      <PageHeader
        title="Onboarding"
        description="Connect new GHL subaccounts or agencies, complete OAuth, and monitor bootstrap progress."
      />

      {connectedSuccess && (
        <Alert className="mb-6 border-emerald-200 bg-emerald-50">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          <AlertTitle className="text-emerald-900">Connection successful</AlertTitle>
          <AlertDescription className="flex flex-col gap-3 text-emerald-800 sm:flex-row sm:items-center sm:justify-between">
            <span>The subaccount was connected. Bootstrap tasks may still be running in the background.</span>
            <Button size="sm" variant="outline" onClick={dismissSuccess}>Dismiss</Button>
          </AlertDescription>
        </Alert>
      )}

      {agencyConnectedSuccess && (
        <Alert className="mb-6 border-emerald-200 bg-emerald-50">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          <AlertTitle className="text-emerald-900">Agency connected</AlertTitle>
          <AlertDescription className="flex flex-col gap-3 text-emerald-800 sm:flex-row sm:items-center sm:justify-between">
            <span>
              Agency tokens were stored. Installed subaccounts (if any) were queued for bootstrap.{" "}
              <Link to="/platform/companies" className="underline">
                View companies
              </Link>
            </span>
            <Button size="sm" variant="outline" onClick={dismissAgencySuccess}>Dismiss</Button>
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Rocket className="h-5 w-5 text-primary" />
              Connect new account
            </CardTitle>
            <CardDescription>
              Start the GoHighLevel chooselocation OAuth flow to onboard a new subaccount.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ol className="list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
              <li>Click Connect and authorize in GoHighLevel</li>
              <li>Select the subaccount location to install</li>
              <li>Return here — contacts, users, and calendars bootstrap automatically</li>
            </ol>
            <Button onClick={handleConnect} disabled={starting} size="lg" className="w-full sm:w-auto">
              <Link2 className="mr-2 h-4 w-4" />
              {starting ? "Starting…" : "Connect subaccount"}
            </Button>
            {oauthHandoffUrl && (
              <p className="text-sm text-muted-foreground">
                Popup blocked?{" "}
                <a href={oauthHandoffUrl} target="_blank" rel="noopener noreferrer" className="text-primary underline">
                  Open OAuth manually
                </a>
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Building2 className="h-5 w-5 text-primary" />
              Connect agency
            </CardTitle>
            <CardDescription>
              Authorize the dedicated agency marketplace app and store agency-level tokens.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ol className="list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
              <li>Click Connect and authorize at the agency level in GoHighLevel</li>
              <li>Tokens are saved to the agency_tokens table on the backend</li>
              <li>Installed subaccounts are discovered and bootstrapped when available</li>
            </ol>
            <Button
              onClick={handleConnectAgency}
              disabled={startingAgency}
              size="lg"
              className="w-full sm:w-auto"
            >
              <Building2 className="mr-2 h-4 w-4" />
              {startingAgency ? "Starting…" : "Connect agency"}
            </Button>
            {agencyOauthHandoffUrl && (
              <p className="text-sm text-muted-foreground">
                Popup blocked?{" "}
                <a
                  href={agencyOauthHandoffUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline"
                >
                  Open agency OAuth manually
                </a>
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Subaccount checklist</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="rounded-lg border p-3">OAuth tokens stored on backend</div>
            <div className="rounded-lg border p-3">Location snapshot synced from GHL</div>
            <div className="rounded-lg border p-3">Contacts, users, calendars queued</div>
            <div className="rounded-lg border p-3">Media folders ensured for branding uploads</div>
            <p className="text-xs text-muted-foreground">
              Review health status on the account detail page after onboarding completes.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Agency checklist</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="rounded-lg border p-3">Agency tokens stored in agency_tokens</div>
            <div className="rounded-lg border p-3">Company auth mirrored for install webhooks</div>
            <div className="rounded-lg border p-3">Installed locations discovered via GHL</div>
            <div className="rounded-lg border p-3">Location tokens exchanged when approved</div>
            <p className="text-xs text-muted-foreground">
              Manage connected agencies from the Companies page after onboarding.
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">Recent agency onboardings</CardTitle>
          <CardDescription>Latest agencies connected via the agency marketplace app</CardDescription>
        </CardHeader>
        <CardContent>
          {agenciesLoading ? (
            <TableSkeleton rows={3} columns={4} />
          ) : recentAgencies.length === 0 ? (
            <p className="text-sm text-muted-foreground">No agencies onboarded yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Company ID</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Onboarded</TableHead>
                  <TableHead>Updated</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentAgencies.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-mono text-xs">{row.company_id}</TableCell>
                    <TableCell>
                      <StatusBadge status={row.is_active ? "healthy" : "error"} />
                    </TableCell>
                    <TableCell>{formatRelative(row.onboarded_at)}</TableCell>
                    <TableCell>{formatRelative(row.updated_at)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">Recent subaccount onboardings</CardTitle>
          <CardDescription>Latest accounts connected to the platform</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <TableSkeleton rows={5} columns={5} />
          ) : recent.length === 0 ? (
            <p className="text-sm text-muted-foreground">No accounts onboarded yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Account</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Health</TableHead>
                  <TableHead>Onboarded</TableHead>
                  <TableHead>Last sync</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recent.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">{row.company_name || "Unnamed"}</TableCell>
                    <TableCell className="font-mono text-xs">{row.location_id}</TableCell>
                    <TableCell><StatusBadge status={row.health?.status} /></TableCell>
                    <TableCell>{formatRelative(row.onboarded_at)}</TableCell>
                    <TableCell>{formatRelative(row.last_sync_at)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
