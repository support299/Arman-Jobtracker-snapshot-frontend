import { useState } from "react"
import { useSearchParams } from "react-router-dom"
import { Link2, Rocket, CheckCircle2 } from "lucide-react"
import { toast } from "sonner"
import {
  useGetPlatformOnboardingStatusQuery,
  useStartPlatformOnboardingMutation,
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
  const [oauthHandoffUrl, setOauthHandoffUrl] = useState(null)

  const { data: recent = [], isLoading, refetch } = useGetPlatformOnboardingStatusQuery()
  const [startOnboarding, { isLoading: starting }] = useStartPlatformOnboardingMutation()

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

  const dismissSuccess = () => {
    searchParams.delete("connected")
    setSearchParams(searchParams, { replace: true })
    refetch()
  }

  return (
    <div>
      <PageHeader
        title="Onboarding"
        description="Connect new GHL subaccounts, complete OAuth, and monitor bootstrap progress."
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
            <CardTitle className="text-base">Onboarding checklist</CardTitle>
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
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">Recent onboardings</CardTitle>
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
