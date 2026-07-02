import {
  Building2,
  Briefcase,
  FileText,
  Users,
  HeartPulse,
  AlertTriangle,
  Activity,
} from "lucide-react"
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts"
import { useGetPlatformDashboardQuery } from "../../store/api/platformApi"
import PageHeader from "../components/PageHeader"
import MetricCard from "../components/MetricCard"
import StatusBadge from "../components/StatusBadge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { formatDateTime, formatRelative } from "../utils/formatters"
import { TableSkeleton } from "@/components/ui/skeletons"

const HEALTH_COLORS = {
  healthy: "#10b981",
  warning: "#f59e0b",
  critical: "#ef4444",
  inactive: "#94a3b8",
}

export default function PlatformDashboard() {
  const { data, isLoading, isError, error, refetch } = useGetPlatformDashboardQuery()

  if (isError) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Failed to load dashboard</AlertTitle>
        <AlertDescription>
          {error?.data?.detail || error?.message || "Unknown error"}
        </AlertDescription>
      </Alert>
    )
  }

  const accounts = data?.accounts || {}
  const oauth = data?.oauth_health || {}
  const healthChartData = [
    { name: "Healthy", value: oauth.healthy || 0, key: "healthy" },
    { name: "Warning", value: oauth.warning || 0, key: "warning" },
    { name: "Critical", value: oauth.critical || 0, key: "critical" },
    { name: "Inactive", value: oauth.inactive || 0, key: "inactive" },
  ].filter((row) => row.value > 0)

  const accountStatusData = [
    { name: "Active", count: accounts.active || 0 },
    { name: "Trial", count: accounts.trial || 0 },
    { name: "Suspended", count: accounts.suspended || 0 },
    { name: "Churned", count: accounts.churned || 0 },
  ]

  return (
    <div>
      <PageHeader
        title="Platform Dashboard"
        description="Overview of all onboarded accounts, platform health, and recent activity."
        actions={
          <button
            type="button"
            onClick={() => refetch()}
            className="inline-flex items-center rounded-md border bg-white px-3 py-2 text-sm font-medium shadow-sm hover:bg-muted"
          >
            <Activity className="mr-2 h-4 w-4" />
            Refresh
          </button>
        }
      />

      {(oauth.critical > 0 || oauth.expiring_tokens > 0) && (
        <Alert className="mb-6 border-amber-200 bg-amber-50">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertTitle className="text-amber-900">Attention required</AlertTitle>
          <AlertDescription className="text-amber-800">
            {oauth.critical > 0 && `${oauth.critical} account(s) in critical state. `}
            {oauth.expiring_tokens > 0 && `${oauth.expiring_tokens} token(s) expiring soon.`}
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="Total Accounts" value={accounts.total} subtitle={`${accounts.active || 0} active`} icon={Building2} loading={isLoading} />
        <MetricCard title="Jobs" value={data?.jobs?.total} subtitle={`${data?.jobs?.last_30_days || 0} in last 30 days`} icon={Briefcase} loading={isLoading} />
        <MetricCard title="Quotes" value={data?.quotes?.total} subtitle={`${data?.quotes?.last_30_days || 0} in last 30 days`} icon={FileText} loading={isLoading} />
        <MetricCard title="Users" value={data?.users} subtitle={`${data?.customers || 0} customers`} icon={Users} loading={isLoading} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Account Status</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            {isLoading ? (
              <div className="flex h-full items-center justify-center text-muted-foreground">Loading…</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={accountStatusData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="count" fill="hsl(224, 76%, 48%)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <HeartPulse className="h-4 w-4" />
              OAuth Health
            </CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            {isLoading ? (
              <div className="flex h-full items-center justify-center text-muted-foreground">Loading…</div>
            ) : healthChartData.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">No active accounts to check</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={healthChartData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={4}>
                    {healthChartData.map((entry) => (
                      <Cell key={entry.key} fill={HEALTH_COLORS[entry.key]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Platform Totals</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Companies</span><span className="font-medium">{data?.companies ?? "—"}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Locations</span><span className="font-medium">{data?.locations ?? "—"}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Expiring tokens</span><span className="font-medium">{oauth.expiring_tokens ?? 0}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Accounts checked</span><span className="font-medium">{oauth.total_checked ?? 0}</span></div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <TableSkeleton rows={4} columns={3} />
            ) : (data?.recent_activity || []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No platform activity recorded yet.</p>
            ) : (
              <div className="space-y-3">
                {(data.recent_activity || []).map((item) => (
                  <div key={item.id} className="flex flex-col gap-1 rounded-lg border bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-medium">{item.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.actor_email || "System"}
                        {item.account_name ? ` · ${item.account_name}` : ""}
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground">{formatRelative(item.created_at)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
