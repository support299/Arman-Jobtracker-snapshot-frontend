import { useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { Search, ChevronRight, RefreshCw } from "lucide-react"
import { useGetPlatformAccountsQuery } from "../../store/api/platformApi"
import PageHeader from "../components/PageHeader"
import StatusBadge from "../components/StatusBadge"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Card } from "@/components/ui/card"
import { TableSkeleton } from "@/components/ui/skeletons"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { formatDateTime, formatRelative, platformStatusLabel } from "../utils/formatters"

export default function PlatformAccounts() {
  const [searchInput, setSearchInput] = useState("")
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)
  const [platformStatus, setPlatformStatus] = useState("")
  const [isActive, setIsActive] = useState("")
  const [ordering, setOrdering] = useState("-onboarded_at")

  const queryParams = useMemo(() => {
    const params = { page, ordering }
    if (search) params.search = search
    if (platformStatus) params.platform_status = platformStatus
    if (isActive !== "") params.is_active = isActive
    return params
  }, [search, page, platformStatus, isActive, ordering])

  const { data, isLoading, isError, error, refetch, isFetching } = useGetPlatformAccountsQuery(queryParams)

  const results = data?.results || []
  const total = data?.count || 0
  const pageSize = 20
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  const handleSearch = (e) => {
    e.preventDefault()
    setSearch(searchInput.trim())
    setPage(1)
  }

  return (
    <div>
      <PageHeader
        title="Accounts"
        description="Manage all onboarded subaccounts across the platform."
        actions={
          <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        }
      />

      <Card className="mb-6 p-4">
        <form onSubmit={handleSearch} className="flex flex-col gap-3 lg:flex-row lg:items-end">
          <div className="flex-1">
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Company, location ID, timezone…"
                className="pl-9"
              />
            </div>
          </div>
          <div className="w-full lg:w-40">
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Status</label>
            <Select value={platformStatus || "all"} onValueChange={(v) => { setPlatformStatus(v === "all" ? "" : v); setPage(1) }}>
              <SelectTrigger><SelectValue placeholder="All statuses" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="trial">Trial</SelectItem>
                <SelectItem value="suspended">Suspended</SelectItem>
                <SelectItem value="churned">Churned</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="w-full lg:w-36">
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Active</label>
            <Select value={isActive === "" ? "all" : isActive} onValueChange={(v) => { setIsActive(v === "all" ? "" : v); setPage(1) }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="true">Active only</SelectItem>
                <SelectItem value="false">Inactive only</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="w-full lg:w-44">
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Sort by</label>
            <Select value={ordering} onValueChange={(v) => { setOrdering(v); setPage(1) }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="-onboarded_at">Recently onboarded</SelectItem>
                <SelectItem value="company_name">Company A–Z</SelectItem>
                <SelectItem value="-last_sync_at">Last sync</SelectItem>
                <SelectItem value="-updated_at">Recently updated</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button type="submit">Search</Button>
        </form>
      </Card>

      {isError && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{error?.data?.detail || "Failed to load accounts"}</AlertDescription>
        </Alert>
      )}

      {isLoading ? (
        <TableSkeleton rows={8} columns={8} />
      ) : results.length === 0 ? (
        <Card className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-lg font-medium">No accounts found</p>
          <p className="mt-1 text-sm text-muted-foreground">Try adjusting filters or onboard a new account.</p>
          <Button asChild className="mt-4">
            <Link to="/platform/onboarding">Start onboarding</Link>
          </Button>
        </Card>
      ) : (
        <>
          <div className="overflow-hidden rounded-lg border bg-white">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Account</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Health</TableHead>
                  <TableHead>Last sync</TableHead>
                  <TableHead>Token expires</TableHead>
                  <TableHead className="text-right">Jobs</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {results.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      <div className="font-medium">{row.company_name || "Unnamed"}</div>
                      <div className="text-xs text-muted-foreground">{row.company_id || "—"}</div>
                    </TableCell>
                    <TableCell>
                      <div className="font-mono text-xs">{row.location_id}</div>
                      <div className="text-xs text-muted-foreground">{row.timezone || "—"}</div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <StatusBadge status={row.platform_status} label={platformStatusLabel(row.platform_status)} />
                        {!row.is_active && <StatusBadge status="inactive" label="Deactivated" />}
                      </div>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={row.health_status} />
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatRelative(row.last_sync_at)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatDateTime(row.token_expires_at)}</TableCell>
                    <TableCell className="text-right text-sm">{row.jobs_count ?? 0}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" asChild>
                        <Link to={`/platform/accounts/${row.id}`}>
                          View <ChevronRight className="ml-1 h-4 w-4" />
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
            <span>{total} account{total === 1 ? "" : "s"}</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
              <span className="flex items-center px-2">Page {page} of {totalPages}</span>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
