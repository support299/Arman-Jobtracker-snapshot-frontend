export function InfoRow({ label, value, className = "" }) {
  return (
    <div className={className}>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm break-words">{value || "—"}</p>
    </div>
  )
}

export default InfoRow
