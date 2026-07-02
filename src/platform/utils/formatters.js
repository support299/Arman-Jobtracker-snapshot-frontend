export const formatDateTime = (value) => {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

export const formatRelative = (value) => {
  if (!value) return "Never"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  const diffMs = Date.now() - date.getTime()
  const minutes = Math.floor(diffMs / 60000)
  if (minutes < 1) return "Just now"
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  return formatDateTime(value)
}

export const platformStatusLabel = (status) => {
  const map = {
    active: "Active",
    suspended: "Suspended",
    trial: "Trial",
    churned: "Churned",
  }
  return map[status] || status || "Unknown"
}

export const healthStatusLabel = (status) => {
  const map = {
    healthy: "Healthy",
    warning: "Warning",
    critical: "Critical",
    inactive: "Inactive",
    suspended: "Suspended",
  }
  return map[status] || status || "Unknown"
}

export function openOAuthUrlInNewTab(url) {
  const a = document.createElement("a")
  a.href = url
  a.target = "_blank"
  a.rel = "noopener noreferrer"
  a.referrerPolicy = "no-referrer"
  document.body.appendChild(a)
  a.click()
  a.remove()
}

export function pickAuthUrl(body) {
  if (body == null) return ""
  if (typeof body === "object" && typeof body.auth_url === "string") return body.auth_url
  if (typeof body === "object" && body.data && typeof body.data.auth_url === "string") {
    return body.data.auth_url
  }
  return ""
}
