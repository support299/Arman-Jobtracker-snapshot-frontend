import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

export function MetricCard({ title, value, subtitle, icon: Icon, trend, loading, className }) {
  if (loading) {
    return (
      <Card className={className}>
        <CardHeader className="pb-2">
          <Skeleton className="h-4 w-24" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-8 w-16" />
          <Skeleton className="mt-2 h-3 w-32" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={cn("overflow-hidden transition-shadow hover:shadow-md", className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        {Icon && (
          <div className="rounded-lg bg-primary/10 p-2 text-primary">
            <Icon className="h-4 w-4" />
          </div>
        )}
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold tracking-tight">{value ?? "—"}</div>
        {(subtitle || trend) && (
          <p className="mt-1 text-xs text-muted-foreground">
            {trend && <span className="mr-1 font-medium text-emerald-600">{trend}</span>}
            {subtitle}
          </p>
        )}
      </CardContent>
    </Card>
  )
}

export default MetricCard
