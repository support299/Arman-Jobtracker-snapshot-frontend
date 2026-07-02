import { useMemo, useState } from "react"
import { useGetPlatformAuditLogsQuery } from "../../store/api/platformApi"
import PageHeader from "../components/PageHeader"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { TableSkeleton } from "@/components/ui/skeletons"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { formatDateTime } from "../utils/formatters"

const ACTION_OPTIONS = [
  { value: "account_update", label: "Account update" },
  { value: "account_status", label: "Status change" },
  { value: "onboard_start", label: "Onboarding" },
  { value: "sync_contacts", label: "Sync contacts" },
  { value: "sync_users", label: "Sync users" },
  { value: "sync_calendars", label: "Sync calendars" },
  { value: "ensure_media_folders", label: "Media folders" },
  { value: "rebootstrap", label: "Re-bootstrap" },
  { value: "refresh_token", label: "Refresh token" },
  { value: "health_check", label: "Health check" },
  { value: "impersonate", label: "Impersonation" },
]

export default function PlatformAudit() {
  const [searchInput, setSearchInput] = useState("")
  const [search, setSearch] = useState("")
  const [action, setAction] = useState("")
  const [page, setPage] = useState(1)

  const params = useMemo(() => {
    const p = { page, ordering: "-created_at" }
    if (search) p.search = search
    if (action) p.action = action
    return p
  }, [search, action, page])

  const { data, isLoading, isError, error } = useGetPlatformAuditLogsQuery(params)
  const results = data?.results || []
  const total = data?.count || 0
  const pageSize = 20
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  return (
    <div>
      <PageHeader
        title="Audit Log"
        description="Immutable record of platform administration actions."
      />

      <Card className="mb-6 p-4">
        <form
          onSubmit={(e) => { e.preventDefault(); setSearch(searchInput.trim()); setPage(1) }}
          className="flex flex-col gap-3 lg:flex-row lg:items-end"
        >
          <div className="flex-1">
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Search</label>
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Description, actor, account…"
            />
          </div>
          <div className="w-full lg:w-52">
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Action type</label>
            <Select value={action || "all"} onValueChange={(v) => { setAction(v === "all" ? "" : v); setPage(1) }}>
              <SelectTrigger><SelectValue placeholder="All actions" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All actions</SelectItem>
                {ACTION_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button type="submit">Search</Button>
        </form>
      </Card>

      {isError && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{error?.data?.detail || "Failed to load audit logs"}</AlertDescription>
        </Alert>
      )}

      {isLoading ? (
        <TableSkeleton rows={10} columns={5} />
      ) : (
        <>
          <div className="overflow-hidden rounded-lg border bg-white">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Actor</TableHead>
                  <TableHead>Account</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {results.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                      No audit entries found.
                    </TableCell>
                  </TableRow>
                ) : (
                  results.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="whitespace-nowrap text-sm">{formatDateTime(row.created_at)}</TableCell>
                      <TableCell className="text-sm capitalize">{row.action.replace(/_/g, " ")}</TableCell>
                      <TableCell className="max-w-md text-sm">{row.description}</TableCell>
                      <TableCell className="text-sm">{row.actor_email || "—"}</TableCell>
                      <TableCell className="text-sm">{row.account_name || "—"}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
            <span>{total} entries</span>
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
