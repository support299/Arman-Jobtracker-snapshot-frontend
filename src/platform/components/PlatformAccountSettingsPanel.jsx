import { useEffect, useRef, useState } from "react"
import { CloudUpload, RefreshCw, Save } from "lucide-react"
import { toast } from "sonner"
import {
  useGetPlatformAccountSettingsQuery,
  useRefreshPlatformAccountCalendarsMutation,
  useUpdatePlatformAccountSettingsMutation,
  useUploadPlatformAccountLogoMutation,
} from "../../store/api/platformApi"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import StatusBadge from "./StatusBadge"
import InfoRow from "./InfoRow"
import TimezoneSelect from "./TimezoneSelect"
import { formatDateTime } from "../utils/formatters"
import { DEFAULT_INVOICE_LINK_BASE_URL } from "../../utils/invoiceLink"

export default function PlatformAccountSettingsPanel({ accountId }) {
  const fileInputRef = useRef(null)
  const { data, isLoading, isError, error, refetch } = useGetPlatformAccountSettingsQuery(accountId, {
    skip: !accountId,
  })
  const [updateSettings, { isLoading: saving }] = useUpdatePlatformAccountSettingsMutation()
  const [uploadLogo, { isLoading: uploading }] = useUploadPlatformAccountLogoMutation()
  const [refreshCalendars, { isLoading: refreshing }] = useRefreshPlatformAccountCalendarsMutation()

  const [companyName, setCompanyName] = useState("")
  const [timezone, setTimezone] = useState("")
  const [currency, setCurrency] = useState("USD")
  const [serviceCalendarId, setServiceCalendarId] = useState("")
  const [bookingRedirectUrl, setBookingRedirectUrl] = useState("")
  const [invoiceLinkBaseUrl, setInvoiceLinkBaseUrl] = useState("")
  const [logoPreview, setLogoPreview] = useState(null)

  const supportedCurrencies = data?.supported_currencies?.length
    ? data.supported_currencies
    : ["USD", "CAD", "GBP", "EUR", "AUD", "INR"]

  useEffect(() => {
    if (!data) return
    setCompanyName(data.account_name || "")
    setTimezone(data.timezone || "")
    setCurrency(data.currency || "USD")
    setServiceCalendarId(data.service_calendar_id || "")
    setBookingRedirectUrl(data.booking_redirect_url || "")
    setInvoiceLinkBaseUrl(data.invoice_link_base_url || "")
    setLogoPreview(data.logo_url || null)
  }, [data])

  const handleError = (err) => {
    const detail = err?.data
    if (typeof detail === "string") return detail
    if (detail?.detail) return detail.detail
    const firstKey = detail && Object.keys(detail)[0]
    if (firstKey && Array.isArray(detail[firstKey])) return detail[firstKey][0]
    return "Save failed"
  }

  const handleLogoSelect = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    const previewUrl = URL.createObjectURL(file)
    setLogoPreview(previewUrl)
    const formData = new FormData()
    formData.append("logo", file)
    try {
      const result = await uploadLogo({ id: accountId, formData }).unwrap()
      setLogoPreview(result.logo_url || previewUrl)
      toast.success("Logo updated")
    } catch (err) {
      setLogoPreview(data?.logo_url || null)
      toast.error(handleError(err))
    } finally {
      URL.revokeObjectURL(previewUrl)
        if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (isError) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{error?.data?.detail || "Failed to load account settings"}</AlertDescription>
      </Alert>
    )
  }

  if (!data) return null

  const calendars = data.calendars || []

  return (
    <div className="space-y-6">
      {/* 1. Company / location info — read-only, synced from GHL */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Subaccount information</CardTitle>
          <CardDescription>Synced from GoHighLevel location profile</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <InfoRow label="Location name" value={data.location_name} />
          <InfoRow label="Location ID" value={data.location_id} />
          <InfoRow label="Company ID" value={data.company_id} />
          <InfoRow label="Domain" value={data.domain} />
          <InfoRow label="Website" value={data.website} />
          <InfoRow label="Email" value={data.email} />
          <InfoRow label="Phone" value={data.phone} />
          <InfoRow label="Contact" value={[data.first_name, data.last_name].filter(Boolean).join(" ")} />
          <InfoRow label="Address" value={data.full_address} className="sm:col-span-2 lg:col-span-3" />
          <InfoRow label="User type" value={data.user_type} />
          <InfoRow label="Tenant status" value={data.is_active ? "Active" : "Inactive"} />
          <InfoRow label="Last updated" value={formatDateTime(data.updated_at)} />
        </CardContent>
      </Card>

      {/* 2. Branding */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Branding</CardTitle>
          <CardDescription>Logo and display name for this subaccount</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-6 sm:grid-cols-[160px_1fr]">
            <div className="flex h-24 w-40 items-center justify-center overflow-hidden rounded-lg border bg-muted/30">
              {logoPreview ? (
                <img src={logoPreview} alt="Account logo" className="max-h-full max-w-full object-contain p-2" />
              ) : (
                <span className="text-xs text-muted-foreground">No logo</span>
              )}
            </div>
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/gif,image/webp"
                className="hidden"
                onChange={handleLogoSelect}
              />
              <Button variant="outline" disabled={uploading} onClick={() => fileInputRef.current?.click()}>
                <CloudUpload className="mr-2 h-4 w-4" />
                {uploading ? "Uploading…" : "Upload logo"}
              </Button>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Company / account name</Label>
              <Input value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Timezone</Label>
              <TimezoneSelect value={timezone} onValueChange={setTimezone} disabled={saving} />
            </div>
          </div>
          <Button
            disabled={saving || (companyName === (data.account_name || "") && timezone === (data.timezone || ""))}
            onClick={async () => {
              try {
                await updateSettings({
                  id: accountId,
                  company_name: companyName.trim(),
                  timezone: timezone.trim(),
                }).unwrap()
                toast.success("Branding updated")
              } catch (err) {
                toast.error(handleError(err))
              }
            }}
          >
            <Save className="mr-2 h-4 w-4" />Save branding
          </Button>
        </CardContent>
      </Card>

      {/* 3. Currency */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Currency</CardTitle>
          <CardDescription>
            Used for quotes, invoices, jobs, and payroll
            {data.currency_from_country && <> · Country default: {data.currency_from_country}</>}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-2">
            <Label>Currency</Label>
            <Select value={currency} onValueChange={setCurrency}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {supportedCurrencies.map((code) => (
                  <SelectItem key={code} value={code}>{code}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            disabled={saving || currency === (data.currency || "")}
            onClick={async () => {
              try {
                await updateSettings({ id: accountId, currency }).unwrap()
                toast.success("Currency updated")
              } catch (err) {
                toast.error(handleError(err))
              }
            }}
          >
            Save currency
          </Button>
          {data.currency_manual && (
            <Button
              variant="outline"
              disabled={saving}
              onClick={async () => {
                try {
                  await updateSettings({ id: accountId, reset_currency_to_country: true }).unwrap()
                  toast.success("Currency reset to country default")
                  refetch()
                } catch (err) {
                  toast.error(handleError(err))
                }
              }}
            >
              Use country default
            </Button>
          )}
        </CardContent>
      </Card>

      {/* 4. Service calendar */}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle className="text-base">Service calendar</CardTitle>
            <CardDescription>Used for quote booking and job scheduling</CardDescription>
          </div>
          <Button variant="outline" size="sm" disabled={refreshing} onClick={async () => {
            try {
              await refreshCalendars(accountId).unwrap()
              toast.success("Calendars refreshed from GHL")
              refetch()
            } catch (err) {
              toast.error(handleError(err))
            }
          }}>
            <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {calendars.length === 0 ? (
            <p className="text-sm text-muted-foreground">No calendars synced yet. Click Refresh to pull from GHL.</p>
          ) : (
            <RadioGroup value={serviceCalendarId} onValueChange={setServiceCalendarId} className="space-y-2">
              {calendars.map((cal) => (
                <label
                  key={cal.ghl_calendar_id}
                  className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 hover:bg-muted/30"
                >
                  <RadioGroupItem value={cal.ghl_calendar_id} className="mt-1" />
                  <div className="flex-1">
                    <p className="font-medium text-sm">{cal.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {[cal.calendar_type, cal.ghl_calendar_id].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  {cal.ghl_calendar_id === data.service_calendar_id && (
                    <StatusBadge status="active" label="Current" />
                  )}
                </label>
              ))}
            </RadioGroup>
          )}
          <Button
            disabled={saving || !serviceCalendarId || serviceCalendarId === (data.service_calendar_id || "")}
            onClick={async () => {
              try {
                await updateSettings({ id: accountId, service_calendar_id: serviceCalendarId }).unwrap()
                toast.success("Service calendar updated")
              } catch (err) {
                toast.error(handleError(err))
              }
            }}
          >
            Save calendar
          </Button>
        </CardContent>
      </Card>

      {/* 5. URLs */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">URLs & integrations</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Booking redirect URL</Label>
            <p className="text-xs text-muted-foreground">
              Leave blank for no redirect after scheduling.
            </p>
            <Input
              value={bookingRedirectUrl}
              onChange={(e) => setBookingRedirectUrl(e.target.value)}
              placeholder="https://…"
            />
          </div>
          <div className="space-y-2">
            <Label>Invoice link base URL</Label>
            <p className="text-xs text-muted-foreground">
              Fallback for GHL pay links. View Invoice opens /invoice/&lt;job-id&gt;. Default:{" "}
              {DEFAULT_INVOICE_LINK_BASE_URL}
            </p>
            <Input
              value={invoiceLinkBaseUrl}
              onChange={(e) => setInvoiceLinkBaseUrl(e.target.value)}
              placeholder="https://…"
            />
          </div>
          <Button
            disabled={
              saving ||
              (bookingRedirectUrl.trim() === (data.booking_redirect_url || "").trim() &&
                invoiceLinkBaseUrl.trim() === (data.invoice_link_base_url || "").trim())
            }
            onClick={async () => {
              try {
                await updateSettings({
                  id: accountId,
                  booking_redirect_url: bookingRedirectUrl.trim() || null,
                  invoice_link_base_url: invoiceLinkBaseUrl.trim() || null,
                }).unwrap()
                toast.success("URLs updated")
              } catch (err) {
                toast.error(handleError(err))
              }
            }}
          >
            <Save className="mr-2 h-4 w-4" />Save URLs
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
