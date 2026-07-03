import moment from "moment-timezone"

/** Frequently used timezones shown at the top of the picker. */
const PRIORITY_TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Phoenix",
  "America/Anchorage",
  "Pacific/Honolulu",
  "America/Toronto",
  "America/Vancouver",
  "America/Mexico_City",
  "America/Sao_Paulo",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Amsterdam",
  "Europe/Moscow",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Calcutta",
  "Asia/Singapore",
  "Asia/Hong_Kong",
  "Asia/Tokyo",
  "Asia/Seoul",
  "Asia/Shanghai",
  "Australia/Sydney",
  "Australia/Melbourne",
  "Pacific/Auckland",
  "UTC",
]

let cachedOptions = null

/** All IANA timezones with common ones first (deduplicated). */
export function getTimezoneOptions() {
  if (cachedOptions) return cachedOptions

  const allNames = moment.tz.names()
  const allSet = new Set(allNames)
  const priority = PRIORITY_TIMEZONES.filter((tz) => allSet.has(tz))
  const prioritySet = new Set(priority)
  const remainder = allNames.filter((tz) => !prioritySet.has(tz)).sort((a, b) => a.localeCompare(b))

  cachedOptions = [...priority, ...remainder]
  return cachedOptions
}

export function formatTimezoneLabel(tz) {
  if (!tz) return "Select timezone"
  try {
    const offset = moment.tz(tz).format("Z")
    return `${tz.replace(/_/g, " ")} (UTC${offset})`
  } catch {
    return tz.replace(/_/g, " ")
  }
}
