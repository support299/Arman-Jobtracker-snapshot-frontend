import { useState } from "react"
import { Link } from "react-router-dom"
import { AlertTriangle, ChevronRight } from "lucide-react"
import { useGetPlatformHealthQuery } from "../../store/api/platformApi"
import PageHeader from "../components/PageHeader"
import MetricCard from "../components/MetricCard"
import StatusBadge from "../components/StatusBadge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { TableSkeleton } from "@/components/ui/skeletons"
import { formatDateTime, formatRelative } from "../utils/formatters"

export default function PlatformHealth() {
  const [statusFilter, setStatusFilter] = useState("")
  const { data, isLoading, isError, error } = useGetPlatformHealthQuery(
    statusFilter ? { status: statusFilter } : {}
  )

  const summary = data?.summary || {}
  const accounts = data?.accounts || []

  return (
    <div>
      <PageHeader
        title="Platform Health"
        description="Sync status, onboarding setup, and configuration warnings across all active accounts."
      />

      {summary.critical > 0 && (
        <Alert variant="destructive" className="mb-6">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>{summary.critical} critical issue(s)</AlertTitle>
          <AlertDescription>Accounts with expired tokens or missing credentials need immediate attention.</AlertDescription>
        </Alert>
      )}

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard title="Healthy" value={summary.healthy} loading={isLoading} />
        <MetricCard title="Warning" value={summary.warning} loading={isLoading} />
        <MetricCard title="Critical" value={summary.critical} loading={isLoading} />
        <MetricCard title="Inactive" value={summary.inactive} loading={isLoading} />
        <MetricCard title="Setup incomplete" value={summary.setup_incomplete} loading={isLoading} />
      </div>

      <Card className="mb-4 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <span className="text-sm font-medium">Filter by status</span>
          <Select value={statusFilter || "all"} onValueChange={(v) => setStatusFilter(v === "all" ? "" : v)}>
            <SelectTrigger className="w-full sm:w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="healthy">Healthy</SelectItem>
              <SelectItem value="warning">Warning</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
              <SelectItem value="suspended">Suspended</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      {isError && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{error?.data?.detail || "Failed to load health data"}</AlertDescription>
        </Alert>
      )}

      {isLoading ? (
        <TableSkeleton rows={8} columns={5} />
      ) : (
        <div className="overflow-hidden rounded-lg border bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Account</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Warnings</TableHead>
                <TableHead>Last sync</TableHead>
                <TableHead>Token expires</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {accounts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                    No accounts match this filter.
                  </TableCell>
                </TableRow>
              ) : (
                accounts.map((row) => (
                  <TableRow key={row.account_id}>
                    <TableCell>
                      <div className="font-medium">{row.company_name || row.location_id}</div>
                      <div className="font-mono text-xs text-muted-foreground">{row.location_id}</div>
                    </TableCell>
                    <TableCell><StatusBadge status={row.status} /></TableCell>
                    <TableCell className="max-w-xs">
                      {(row.warnings || []).length === 0 ? (
                        <span className="text-sm text-muted-foreground">None</span>
                      ) : (
                        <ul className="list-disc pl-4 text-xs text-muted-foreground">
                          {row.warnings.map((w) => <li key={w}>{w}</li>)}
                        </ul>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">{formatRelative(row.last_sync_at)}</TableCell>
                    <TableCell className="text-sm">{formatDateTime(row.token_expires_at)}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" asChild>
                        <Link to={`/platform/accounts/${row.account_id}`}>
                          View <ChevronRight className="ml-1 h-4 w-4" />
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
