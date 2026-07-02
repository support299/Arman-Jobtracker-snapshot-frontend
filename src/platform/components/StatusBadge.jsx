import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"

const VARIANTS = {
  healthy: "border-emerald-200 bg-emerald-50 text-emerald-700",
  warning: "border-amber-200 bg-amber-50 text-amber-700",
  critical: "border-red-200 bg-red-50 text-red-700",
  inactive: "border-slate-200 bg-slate-100 text-slate-600",
  suspended: "border-orange-200 bg-orange-50 text-orange-700",
  active: "border-emerald-200 bg-emerald-50 text-emerald-700",
  trial: "border-blue-200 bg-blue-50 text-blue-700",
  churned: "border-slate-200 bg-slate-100 text-slate-600",
}

export function StatusBadge({ status, label, className }) {
  const key = String(status || "").toLowerCase()
  return (
    <Badge variant="outline" className={cn("font-medium capitalize", VARIANTS[key], className)}>
      {label || status || "Unknown"}
    </Badge>
  )
}

export default StatusBadge
