"use client"

import { useEffect, useRef, useState } from "react"
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Divider,
  FormControl,
  FormControlLabel,
  Grid,
  InputLabel,
  MenuItem,
  Radio,
  RadioGroup,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material"
import { CloudUpload, Refresh, Save, Settings } from "@mui/icons-material"
import {
  useGetAccountSettingsQuery,
  useUpdateAccountSettingsMutation,
  useUploadAccountLogoMutation,
  useRefreshAccountCalendarsMutation,
} from "../../store/api/accountSettingsApi"
import { syncAccountBrandingAfterSettings } from "../../utils/syncAccountBranding"
import { DEFAULT_INVOICE_LINK_BASE_URL } from "../../utils/invoiceLink"
import { useDispatch } from "react-redux"

const InfoRow = ({ label, value }) => (
  <Grid item xs={12} sm={6}>
    <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.5 }}>
      {label}
    </Typography>
    <Typography variant="body2">{value || "—"}</Typography>
  </Grid>
)

const AccountSettings = () => {
  const dispatch = useDispatch()
  const fileInputRef = useRef(null)
  const { data, isLoading, error, refetch } = useGetAccountSettingsQuery()
  const [updateSettings, { isLoading: isSaving }] = useUpdateAccountSettingsMutation()
  const [uploadLogo, { isLoading: isUploading }] = useUploadAccountLogoMutation()
  const [refreshCalendars, { isLoading: isRefreshingCalendars }] = useRefreshAccountCalendarsMutation()

  const [companyName, setCompanyName] = useState("")
  const [currency, setCurrency] = useState("USD")
  const [serviceCalendarId, setServiceCalendarId] = useState("")
  const [bookingRedirectUrl, setBookingRedirectUrl] = useState("")
  const [invoiceLinkBaseUrl, setInvoiceLinkBaseUrl] = useState("")
  const [logoPreview, setLogoPreview] = useState(null)
  const [statusMessage, setStatusMessage] = useState(null)
  const [statusSeverity, setStatusSeverity] = useState("success")

  const supportedCurrencies = data?.supported_currencies?.length
    ? data.supported_currencies
    : ["USD", "CAD", "GBP", "EUR", "AUD"]

  useEffect(() => {
    if (data) {
      setCompanyName(data.account_name || "")
      setCurrency(data.currency || "USD")
      setLogoPreview(data.logo_url || null)
      setServiceCalendarId(data.service_calendar_id || "")
      setBookingRedirectUrl(data.booking_redirect_url || "")
      setInvoiceLinkBaseUrl(data.invoice_link_base_url || "")
    }
  }, [data])

  const calendars = data?.calendars || []

  const invalidateBrandingCache = (settings) => {
    syncAccountBrandingAfterSettings(dispatch, settings)
  }

  const handleSaveName = async () => {
    setStatusMessage(null)
    try {
      const result = await updateSettings({ company_name: companyName.trim() }).unwrap()
      invalidateBrandingCache(result)
      setStatusMessage("Account name updated.")
      setStatusSeverity("success")
    } catch (err) {
      setStatusMessage(
        err?.data?.company_name?.[0] ||
          err?.data?.detail ||
          "Failed to update account name.",
      )
      setStatusSeverity("error")
    }
  }

  const handleSaveCurrency = async () => {
    setStatusMessage(null)
    try {
      const result = await updateSettings({ currency }).unwrap()
      invalidateBrandingCache(result)
      setStatusMessage("Currency updated for this subaccount.")
      setStatusSeverity("success")
    } catch (err) {
      setStatusMessage(
        err?.data?.currency?.[0] ||
          err?.data?.detail ||
          "Failed to update currency.",
      )
      setStatusSeverity("error")
    }
  }

  const handleResetCurrency = async () => {
    setStatusMessage(null)
    try {
      const result = await updateSettings({ reset_currency_to_country: true }).unwrap()
      setCurrency(result.currency || data?.currency_from_country || "USD")
      invalidateBrandingCache(result)
      setStatusMessage("Currency reset to match the subaccount country.")
      setStatusSeverity("success")
    } catch (err) {
      setStatusMessage(
        err?.data?.currency?.[0] ||
          err?.data?.detail ||
          "Failed to reset currency.",
      )
      setStatusSeverity("error")
    }
  }

  const handleRefreshCalendars = async () => {
    setStatusMessage(null)
    try {
      const result = await refreshCalendars().unwrap()
      const settings = result.settings || result
      if (settings.service_calendar_id) {
        setServiceCalendarId(settings.service_calendar_id)
      }
      setStatusMessage(
        `Synced ${result.synced_count ?? calendars.length} calendar(s) from GoHighLevel.`,
      )
      setStatusSeverity("success")
    } catch (err) {
      setStatusMessage(err?.data?.detail || "Failed to refresh calendars from GHL.")
      setStatusSeverity("error")
    }
  }

  const handleSaveServiceCalendar = async () => {
    setStatusMessage(null)
    if (!serviceCalendarId) {
      setStatusMessage("Select a service calendar first.")
      setStatusSeverity("error")
      return
    }
    try {
      await updateSettings({ service_calendar_id: serviceCalendarId }).unwrap()
      setStatusMessage("Service calendar updated for availability and job booking.")
      setStatusSeverity("success")
    } catch (err) {
      setStatusMessage(
        err?.data?.service_calendar_id?.[0] ||
          err?.data?.detail ||
          "Failed to save service calendar.",
      )
      setStatusSeverity("error")
    }
  }

  const handleSaveBookingRedirect = async () => {
    setStatusMessage(null)
    const trimmed = bookingRedirectUrl.trim()
    try {
      const result = await updateSettings({
        booking_redirect_url: trimmed || null,
      }).unwrap()
      setBookingRedirectUrl(result.booking_redirect_url || "")
      invalidateBrandingCache(result)
      setStatusMessage(
        trimmed
          ? "Booking redirect URL updated."
          : "Booking redirect URL cleared. Customers will stay on this page after scheduling.",
      )
      setStatusSeverity("success")
    } catch (err) {
      setStatusMessage(
        err?.data?.booking_redirect_url?.[0] ||
          err?.data?.detail ||
          "Failed to save booking redirect URL.",
      )
      setStatusSeverity("error")
    }
  }

  const handleSaveInvoiceLinkBase = async () => {
    setStatusMessage(null)
    const trimmed = invoiceLinkBaseUrl.trim()
    try {
      const result = await updateSettings({
        invoice_link_base_url: trimmed || null,
      }).unwrap()
      setInvoiceLinkBaseUrl(result.invoice_link_base_url || "")
      invalidateBrandingCache(result)
      setStatusMessage(
        trimmed
          ? "Invoice link base URL updated."
          : "Invoice link base URL cleared. The default will be used for completed jobs.",
      )
      setStatusSeverity("success")
    } catch (err) {
      setStatusMessage(
        err?.data?.invoice_link_base_url?.[0] ||
          err?.data?.detail ||
          "Failed to save invoice link base URL.",
      )
      setStatusSeverity("error")
    }
  }

  const handleLogoSelect = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return

    const allowed = ["image/png", "image/jpeg", "image/jpg", "image/gif", "image/webp"]
    if (!allowed.includes(file.type)) {
      setStatusMessage("Please upload a PNG, JPG, GIF, or WEBP image.")
      setStatusSeverity("error")
      return
    }

    const previewUrl = URL.createObjectURL(file)
    setLogoPreview(previewUrl)
    setStatusMessage(null)

    const formData = new FormData()
    formData.append("logo", file)

    try {
      const result = await uploadLogo(formData).unwrap()
      setLogoPreview(result.logo_url || previewUrl)
      invalidateBrandingCache(result)
      setStatusMessage("Logo updated. It will appear across quotes, jobs, and profile pages.")
      setStatusSeverity("success")
    } catch (err) {
      setLogoPreview(data?.logo_url || null)
      setStatusMessage(err?.data?.logo?.[0] || err?.data?.detail || "Failed to upload logo.")
      setStatusSeverity("error")
    } finally {
      URL.revokeObjectURL(previewUrl)
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    }
  }

  if (isLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
        <CircularProgress />
      </Box>
    )
  }

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error" action={<Button onClick={() => refetch()}>Retry</Button>}>
          {error?.data?.detail || "Unable to load account settings."}
        </Alert>
      </Box>
    )
  }

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 960, mx: "auto" }}>
      <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 3 }}>
        <Settings color="action" />
        <Box>
          <Typography variant="h5" fontWeight={600}>
            Account Settings
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Subaccount profile and branding for the current location.
          </Typography>
        </Box>
      </Stack>

      {statusMessage && (
        <Alert severity={statusSeverity} sx={{ mb: 2 }} onClose={() => setStatusMessage(null)}>
          {statusMessage}
        </Alert>
      )}

      <Card variant="outlined" sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="subtitle1" fontWeight={600} gutterBottom>
            Logo
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            This logo is shown on quotes, invoices, contact profiles, and throughout the app for
            this subaccount.
          </Typography>

          <Stack direction={{ xs: "column", sm: "row" }} spacing={3} alignItems="center">
            <Box
              sx={{
                width: 160,
                height: 100,
                border: "1px solid",
                borderColor: "divider",
                borderRadius: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                bgcolor: "grey.50",
                overflow: "hidden",
              }}
            >
              {logoPreview ? (
                <Box
                  component="img"
                  src={logoPreview}
                  alt="Account logo"
                  sx={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}
                />
              ) : (
                <Typography variant="caption" color="text.secondary">
                  No logo
                </Typography>
              )}
            </Box>

            <Box>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/gif,image/webp"
                hidden
                onChange={handleLogoSelect}
              />
              <Button
                variant="outlined"
                startIcon={isUploading ? <CircularProgress size={18} /> : <CloudUpload />}
                disabled={isUploading}
                onClick={() => fileInputRef.current?.click()}
              >
                {isUploading ? "Uploading…" : "Upload logo"}
              </Button>
              <Typography variant="caption" display="block" color="text.secondary" sx={{ mt: 1 }}>
                PNG, JPG, GIF, or WEBP. Recommended square or wide logo on a transparent background.
              </Typography>
            </Box>
          </Stack>
        </CardContent>
      </Card>

      <Card variant="outlined" sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="subtitle1" fontWeight={600} gutterBottom>
            Display name
          </Typography>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems={{ sm: "flex-start" }}>
            <TextField
              fullWidth
              size="small"
              label="Company / account name"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
            />
            <Button
              variant="contained"
              startIcon={isSaving ? <CircularProgress size={18} color="inherit" /> : <Save />}
              disabled={isSaving || !companyName.trim() || companyName.trim() === (data?.account_name || "")}
              onClick={handleSaveName}
              sx={{ minWidth: 120 }}
            >
              Save
            </Button>
          </Stack>
        </CardContent>
      </Card>

      <Card variant="outlined" sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="subtitle1" fontWeight={600} gutterBottom>
            Currency
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Used for quotes, invoices, jobs, and payroll display for this subaccount.
            {data?.currency_from_country && (
              <> Country default: <strong>{data.currency_from_country}</strong>.</>
            )}
            {data?.currency_manual && (
              <> You are using a custom currency override.</>
            )}
          </Typography>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems={{ sm: "flex-start" }}>
            <FormControl fullWidth size="small">
              <InputLabel id="account-currency-label">Currency</InputLabel>
              <Select
                labelId="account-currency-label"
                label="Currency"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
              >
                {supportedCurrencies.map((code) => (
                  <MenuItem key={code} value={code}>
                    {code}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Button
              variant="contained"
              startIcon={isSaving ? <CircularProgress size={18} color="inherit" /> : <Save />}
              disabled={isSaving || currency === (data?.currency || "")}
              onClick={handleSaveCurrency}
              sx={{ minWidth: 120 }}
            >
              Save
            </Button>
            {data?.currency_manual && (
              <Button
                variant="text"
                disabled={isSaving}
                onClick={handleResetCurrency}
              >
                Use country default
              </Button>
            )}
          </Stack>
        </CardContent>
      </Card>

      <Card variant="outlined" sx={{ mb: 3 }}>
        <CardContent>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            justifyContent="space-between"
            alignItems={{ xs: "flex-start", sm: "center" }}
            spacing={2}
            sx={{ mb: 2 }}
          >
            <Box>
              <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                Service calendar
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Used for quote booking availability and blocking time when jobs are confirmed.
                {data?.service_calendar_name && (
                  <> Current: <strong>{data.service_calendar_name}</strong>.</>
                )}
              </Typography>
            </Box>
            <Button
              variant="outlined"
              startIcon={isRefreshingCalendars ? <CircularProgress size={18} /> : <Refresh />}
              disabled={isRefreshingCalendars}
              onClick={handleRefreshCalendars}
            >
              Refresh calendars
            </Button>
          </Stack>

          {calendars.length === 0 ? (
            <Alert severity="info" sx={{ mb: 2 }}>
              No calendars saved yet. Click Refresh calendars to sync from GoHighLevel.
            </Alert>
          ) : (
            <RadioGroup
              value={serviceCalendarId}
              onChange={(e) => setServiceCalendarId(e.target.value)}
              sx={{ mb: 2 }}
            >
              {calendars.map((cal) => (
                <FormControlLabel
                  key={cal.ghl_calendar_id}
                  value={cal.ghl_calendar_id}
                  control={<Radio size="small" />}
                  label={
                    <Box>
                      <Typography variant="body2">{cal.name}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {[cal.calendar_type, cal.ghl_calendar_id].filter(Boolean).join(" · ")}
                      </Typography>
                    </Box>
                  }
                />
              ))}
            </RadioGroup>
          )}

          <Button
            variant="contained"
            startIcon={isSaving ? <CircularProgress size={18} color="inherit" /> : <Save />}
            disabled={
              isSaving ||
              !serviceCalendarId ||
              serviceCalendarId === (data?.service_calendar_id || "")
            }
            onClick={handleSaveServiceCalendar}
          >
            Save calendar
          </Button>
        </CardContent>
      </Card>

      <Card variant="outlined" sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="subtitle1" fontWeight={600} gutterBottom>
            Booking redirect URL
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            After a customer picks a time on an accepted quote, they are sent to this page (for
            example, a credit card authorization form). Contact details are appended as query
            parameters: <code>full_name</code>, <code>email</code>, and <code>phone</code>.
            Leave blank for no redirect after scheduling.
          </Typography>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems={{ sm: "flex-start" }}>
            <TextField
              fullWidth
              size="small"
              label="Redirect URL"
              placeholder="https://yourcompany.theservicepilot.com"
              value={bookingRedirectUrl}
              onChange={(e) => setBookingRedirectUrl(e.target.value)}
            />
            <Button
              variant="contained"
              startIcon={isSaving ? <CircularProgress size={18} color="inherit" /> : <Save />}
              disabled={
                isSaving ||
                bookingRedirectUrl.trim() === (data?.booking_redirect_url || "").trim()
              }
              onClick={handleSaveBookingRedirect}
              sx={{ minWidth: 120 }}
            >
              Save
            </Button>
          </Stack>
        </CardContent>
      </Card>

      <Card variant="outlined" sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="subtitle1" fontWeight={600} gutterBottom>
            Invoice link base URL
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Fallback host for GoHighLevel payment links (for example,{" "}
            <code>https://links.theservicepilot.com/invoice/6a440961f1f144dd9a5a8f75</code>).
            The job &quot;View Invoice&quot; button opens this app&apos;s customer invoice page
            (<code>/invoice/&lt;job-id&gt;</code>) for tip, signature, and pay via GHL.
            Leave blank to use the default base: {DEFAULT_INVOICE_LINK_BASE_URL}
          </Typography>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems={{ sm: "flex-start" }}>
            <TextField
              fullWidth
              size="small"
              label="Invoice link base URL"
              placeholder="https://links.theservicepilot.com/invoice/"
              value={invoiceLinkBaseUrl}
              onChange={(e) => setInvoiceLinkBaseUrl(e.target.value)}
            />
            <Button
              variant="contained"
              startIcon={isSaving ? <CircularProgress size={18} color="inherit" /> : <Save />}
              disabled={
                isSaving ||
                invoiceLinkBaseUrl.trim() === (data?.invoice_link_base_url || "").trim()
              }
              onClick={handleSaveInvoiceLinkBase}
              sx={{ minWidth: 120 }}
            >
              Save
            </Button>
          </Stack>
        </CardContent>
      </Card>

      <Card variant="outlined">
        <CardContent>
          <Typography variant="subtitle1" fontWeight={600} gutterBottom>
            Subaccount information
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Synced from GoHighLevel. Contact your administrator to change location details in GHL.
          </Typography>
          <Divider sx={{ mb: 2 }} />
          <Grid container spacing={2}>
            <InfoRow label="Location name" value={data?.location_name} />
            <InfoRow label="Location ID" value={data?.location_id} />
            <InfoRow label="Company ID" value={data?.company_id} />
            <InfoRow label="Domain" value={data?.domain} />
            <InfoRow label="Website" value={data?.website} />
            <InfoRow label="Email" value={data?.email} />
            <InfoRow label="Phone" value={data?.phone} />
            <InfoRow label="Contact" value={[data?.first_name, data?.last_name].filter(Boolean).join(" ")} />
            <InfoRow label="Address" value={data?.full_address} />
            <InfoRow label="Timezone" value={data?.timezone} />
            <InfoRow label="Status" value={data?.is_active ? "Active" : "Inactive"} />
          </Grid>
        </CardContent>
      </Card>
    </Box>
  )
}

export default AccountSettings
