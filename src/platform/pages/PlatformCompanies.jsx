import { useState } from "react"
import { Link } from "react-router-dom"
import { ChevronRight, Search } from "lucide-react"
import { useGetPlatformCompaniesQuery } from "../../store/api/platformApi"
import PageHeader from "../components/PageHeader"
import StatusBadge from "../components/StatusBadge"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { TableSkeleton } from "@/components/ui/skeletons"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { formatDateTime, platformStatusLabel } from "../utils/formatters"

export default function PlatformCompanies() {
  const [searchInput, setSearchInput] = useState("")
  const [search, setSearch] = useState("")
  const [expanded, setExpanded] = useState(null)

  const { data, isLoading, isError, error } = useGetPlatformCompaniesQuery(
    search ? { search } : {}
  )

  const companies = data?.results || data || []

  return (
    <div>
      <PageHeader
        title="Companies"
        description="GHL company-level OAuth connections and their linked subaccounts."
      />

      <Card className="mb-6 p-4">
        <form
          onSubmit={(e) => { e.preventDefault(); setSearch(searchInput.trim()) }}
          className="flex gap-2"
        >
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Company ID or user ID…"
              className="pl-9"
            />
          </div>
          <Button type="submit">Search</Button>
        </form>
      </Card>

      {isError && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{error?.data?.detail || "Failed to load companies"}</AlertDescription>
        </Alert>
      )}

      {isLoading ? (
        <TableSkeleton rows={6} columns={4} />
      ) : companies.length === 0 ? (
        <Card className="py-16 text-center">
          <p className="text-muted-foreground">No company OAuth records found.</p>
        </Card>
      ) : (
        <div className="space-y-4">
          {companies.map((company) => (
            <Card key={company.company_id}>
              <CardHeader className="pb-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <CardTitle className="font-mono text-base">{company.company_id}</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      {company.locations_count} connected location{company.locations_count === 1 ? "" : "s"}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setExpanded(expanded === company.company_id ? null : company.company_id)}
                  >
                    {expanded === company.company_id ? "Hide locations" : "Show locations"}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="grid gap-2 sm:grid-cols-3">
                  <div><span className="text-muted-foreground">User ID:</span> {company.user_id || "—"}</div>
                  <div><span className="text-muted-foreground">Expires in:</span> {company.expires_in ? `${company.expires_in}s` : "—"}</div>
                  <div><span className="text-muted-foreground">Updated:</span> {formatDateTime(company.updated_at)}</div>
                </div>

                {expanded === company.company_id && (
                  <div className="overflow-hidden rounded-lg border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Account</TableHead>
                          <TableHead>Location</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(company.connected_accounts || []).map((acc) => (
                          <TableRow key={acc.id}>
                            <TableCell>{acc.company_name || "Unnamed"}</TableCell>
                            <TableCell className="font-mono text-xs">{acc.location_id}</TableCell>
                            <TableCell>
                              <StatusBadge status={acc.platform_status} label={platformStatusLabel(acc.platform_status)} />
                            </TableCell>
                            <TableCell className="text-right">
                              <Button variant="ghost" size="sm" asChild>
                                <Link to={`/platform/accounts/${acc.id}`}>
                                  View <ChevronRight className="ml-1 h-4 w-4" />
                                </Link>
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
