import { useEffect, useState } from "react"
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  FormControl,
  FormControlLabel,
  Grid,
  InputAdornment,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Switch,
  Tab,
  Tabs,
  TextField,
  Typography,
} from "@mui/material"
import { CardGiftcard, ContentCopy, Save, Redeem } from "@mui/icons-material"
import {
  useGetReferralDashboardQuery,
  useGetReferralProgramQuery,
  useGetReferralGiftCardQuery,
  useUpdateReferralProgramMutation,
} from "../../store/api/referralsApi"

const money = (cents) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format((Number(cents) || 0) / 100)

const ReferralOwnerDashboard = () => {
  const { data: programData, isLoading: programLoading, error: programError } = useGetReferralProgramQuery()
  const { data, isLoading: dashLoading, error, refetch } = useGetReferralDashboardQuery()
  const [updateProgram, { isLoading: saving }] = useUpdateReferralProgramMutation()
  const [section, setSection] = useState("referrals")
  const [tab, setTab] = useState(0)
  const [message, setMessage] = useState(null)
  const [form, setForm] = useState(null)

  const {
    data: giftCardData,
    isLoading: giftCardLoading,
    error: giftCardError,
  } = useGetReferralGiftCardQuery(undefined, { skip: section !== "giftcards" })

  const giftCardUrl = giftCardData?.configured ? giftCardData.purchase_url : null
  const giftCardLocationId = giftCardData?.location_id || ""

  useEffect(() => {
    if (data?.program) setForm({ ...data.program })
    else if (programData) setForm({ ...programData })
  }, [data, programData])

  const setField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }))

  const handleSave = async () => {
    if (!form) return
    setMessage(null)
    try {
      await updateProgram({
        enabled: form.enabled,
        reward_mode: form.reward_mode,
        referrer_reward_cents: Number(form.referrer_reward_cents),
        friend_reward_cents: Number(form.friend_reward_cents),
        minimum_invoice_cents: Number(form.minimum_invoice_cents),
        monthly_referrer_cap_cents: Number(form.monthly_referrer_cap_cents),
        invitation_trigger: form.invitation_trigger,
        auto_invite_enabled: form.auto_invite_enabled,
        email_invite_enabled: form.email_invite_enabled,
        sms_invite_enabled: form.sms_invite_enabled,
        service_label: form.service_label,
        terms_text: form.terms_text,
        primary_color: form.primary_color,
        accent_color: form.accent_color,
      }).unwrap()
      setMessage({ type: "success", text: "Referral program saved." })
      refetch()
    } catch (err) {
      setMessage({ type: "error", text: err?.data?.detail || "Could not save settings." })
    }
  }

  if (programError && section === "referrals") {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">{programError?.data?.detail || "Failed to load referral program."}</Alert>
      </Box>
    )
  }

  if ((programLoading || !form) && section === "referrals") {
    return (
      <Box sx={{ p: 4, display: "flex", justifyContent: "center" }}>
        <CircularProgress />
      </Box>
    )
  }

  const stats = data?.stats || {}
  const listsLoading = dashLoading && data == null
  const referrals = data?.referrals || []
  const customers = data?.customers || []
  const ledger = data?.ledger || []

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 2 }}>
        <CardGiftcard color="primary" />
        <Box>
          <Typography variant="h5" fontWeight={700}>
            {section === "giftcards" ? "Gift Cards" : "Customer Referrals"}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {section === "giftcards"
              ? "Customer gift card purchase page for this subaccount."
              : "Homeowner referral credits for this subaccount — not B2B partner referrals."}
          </Typography>
        </Box>
      </Stack>

      <Tabs
        value={section}
        onChange={(_, v) => setSection(v)}
        sx={{ mb: 2, borderBottom: 1, borderColor: "divider" }}
      >
        <Tab icon={<CardGiftcard fontSize="small" />} iconPosition="start" label="Referrals" value="referrals" />
        <Tab icon={<Redeem fontSize="small" />} iconPosition="start" label="Gift Cards" value="giftcards" />
      </Tabs>

      {section === "giftcards" && (
        <Box>
          <Alert severity="info" sx={{ mb: 2 }}>
            This is the page your <strong>customers</strong> use to purchase gift cards. Share this
            link on your website, emails, or SMS campaigns.
          </Alert>
          <Alert severity="info" sx={{ mb: 2 }}>
            To <strong>manage gift cards</strong>, view orders, and track redemptions, open{" "}
            <strong>Payment → Gift Card</strong> in your GoHighLevel subaccount menu.
          </Alert>

          {giftCardError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {giftCardError?.data?.detail || "Failed to load gift card settings."}
            </Alert>
          )}

          {giftCardLoading ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
              <CircularProgress />
            </Box>
          ) : giftCardUrl ? (
            <Card variant="outlined" sx={{ overflow: "hidden" }}>
              <Box
                component="iframe"
                src={giftCardUrl}
                title="Gift card purchase"
                sx={{
                  display: "block",
                  width: "100%",
                  minHeight: { xs: 520, md: "calc(100vh - 280px)" },
                  height: { xs: 520, md: "calc(100vh - 280px)" },
                  border: 0,
                  bgcolor: "background.default",
                }}
              />
            </Card>
          ) : (
            <Alert severity="warning">
              <Typography variant="subtitle2" fontWeight={700} gutterBottom>
                Gift card page not configured
              </Typography>
              <Typography variant="body2">
                No customer gift card purchase link is set up for this subaccount
                {giftCardLocationId ? ` (${giftCardLocationId})` : ""}. Contact your administrator to add a payment
                link, or configure gift cards under <strong>Payment → Gift Card</strong> in
                GoHighLevel first.
              </Typography>
            </Alert>
          )}
        </Box>
      )}

      {section === "referrals" && (
        <>
      {message && (
        <Alert severity={message.type} sx={{ mb: 2 }} onClose={() => setMessage(null)}>
          {message.text}
        </Alert>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error?.data?.detail || "Failed to load referral lists."}
        </Alert>
      )}

      <Grid container spacing={2} sx={{ mb: 2 }}>
        {[
          ["Qualified", listsLoading ? "…" : (stats.qualified ?? 0), "successful referrals"],
          ["Pending", listsLoading ? "…" : (stats.pending ?? 0), "awaiting paid invoice"],
          ["Credits issued", listsLoading ? "…" : money(stats.credits_issued_cents), listsLoading ? "" : `${money(stats.credits_available_cents)} available`],
          ["Revenue influenced", listsLoading ? "…" : money(stats.influenced_revenue_cents), "from qualified invoices"],
        ].map(([label, value, hint]) => (
          <Grid item xs={12} sm={6} md={3} key={label}>
            <Card variant="outlined">
              <CardContent>
                <Typography variant="caption" color="text.secondary">{label}</Typography>
                <Typography variant="h5" fontWeight={700}>{value}</Typography>
                <Typography variant="caption" color="text.secondary">{hint}</Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab label="Program settings" />
        <Tab label={`Referrals (${listsLoading ? "…" : referrals.length})`} />
        <Tab label="Customers" />
        <Tab label="Credit ledger" />
      </Tabs>

      {tab === 0 && (
        <Card variant="outlined">
          <CardContent>
            <Stack spacing={2}>
              <FormControlLabel
                control={<Switch checked={!!form.enabled} onChange={(e) => setField("enabled", e.target.checked)} />}
                label="Program enabled"
              />
              <FormControl fullWidth>
                <InputLabel>Who earns credit?</InputLabel>
                <Select
                  label="Who earns credit?"
                  value={form.reward_mode}
                  onChange={(e) => setField("reward_mode", e.target.value)}
                >
                  <MenuItem value="two_sided">Both people</MenuItem>
                  <MenuItem value="referrer_only">Referrer only</MenuItem>
                  <MenuItem value="friend_only">New customer only</MenuItem>
                </Select>
              </FormControl>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Referrer credit"
                    type="number"
                    value={(form.referrer_reward_cents || 0) / 100}
                    onChange={(e) => setField("referrer_reward_cents", Math.round(Number(e.target.value) * 100))}
                    disabled={form.reward_mode === "friend_only"}
                    InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Friend credit"
                    type="number"
                    value={(form.friend_reward_cents || 0) / 100}
                    onChange={(e) => setField("friend_reward_cents", Math.round(Number(e.target.value) * 100))}
                    disabled={form.reward_mode === "referrer_only"}
                    InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Minimum qualifying invoice"
                    type="number"
                    value={(form.minimum_invoice_cents || 0) / 100}
                    onChange={(e) => setField("minimum_invoice_cents", Math.round(Number(e.target.value) * 100))}
                    InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }}
                    helperText="Credits issue only after this invoice is paid"
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Monthly referrer cap"
                    type="number"
                    value={(form.monthly_referrer_cap_cents || 0) / 100}
                    onChange={(e) => setField("monthly_referrer_cap_cents", Math.round(Number(e.target.value) * 100))}
                    InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth>
                    <InputLabel>Invitation trigger</InputLabel>
                    <Select
                      label="Invitation trigger"
                      value={form.invitation_trigger}
                      onChange={(e) => setField("invitation_trigger", e.target.value)}
                    >
                      <MenuItem value="completed_job">Job completed</MenuItem>
                      <MenuItem value="five_star_review">Five-star review</MenuItem>
                      <MenuItem value="either">Either</MenuItem>
                      <MenuItem value="review_clicked">Review clicked</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Service label"
                    value={form.service_label || ""}
                    onChange={(e) => setField("service_label", e.target.value)}
                  />
                </Grid>
              </Grid>
              <FormControlLabel
                control={
                  <Switch
                    checked={!!form.auto_invite_enabled}
                    onChange={(e) => setField("auto_invite_enabled", e.target.checked)}
                  />
                }
                label="Auto-invite after trigger (GHL tags / workflows)"
              />
              <TextField
                fullWidth
                multiline
                minRows={3}
                label="Terms"
                value={form.terms_text || ""}
                onChange={(e) => setField("terms_text", e.target.value)}
              />
              <Box>
                <Button variant="contained" startIcon={<Save />} onClick={handleSave} disabled={saving}>
                  {saving ? "Saving…" : "Save program"}
                </Button>
              </Box>
            </Stack>
          </CardContent>
        </Card>
      )}

      {tab === 1 && (
        <Card variant="outlined">
          <CardContent>
            <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>
              Referrals
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              The new customer gets the referral discount on their first job; the referrer's
              wallet is credited automatically when that invoice is fully paid.
            </Typography>
            {listsLoading ? (
              <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}><CircularProgress size={24} /></Box>
            ) : (
              <Stack divider={<Divider />} spacing={1.5}>
                {referrals.length === 0 && (
                  <Typography color="text.secondary">No referrals yet.</Typography>
                )}
                {referrals.map((r) => (
                  <Stack key={r.id} direction={{ xs: "column", sm: "row" }} justifyContent="space-between" spacing={1}>
                    <Box>
                      <Typography fontWeight={600}>{r.referred_name}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        Referred by {r.referrer_name} · {r.referred_email}
                        {r.referral_code ? ` · Code ${r.referral_code}` : ""}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {new Date(r.created_at).toLocaleDateString()}
                        {r.friend_discount_cents > 0 && ` · Discount ${money(r.friend_discount_cents)}`}
                        {r.discount_disabled && ` (disabled${r.discount_disabled_by ? ` by ${r.discount_disabled_by}` : ""})`}
                        {r.reward_credited_cents > 0 && r.reward_credited_at &&
                          ` · Reward ${money(r.reward_credited_cents)} credited ${new Date(r.reward_credited_at).toLocaleDateString()}`}
                        {r.qualifying_invoice_id && ` · Invoice ${r.qualifying_invoice_id}`}
                      </Typography>
                    </Box>
                    <Chip
                      size="small"
                      label={r.status === "qualified" ? "Rewarded" : r.status.charAt(0).toUpperCase() + r.status.slice(1)}
                      color={
                        r.status === "qualified"
                          ? "success"
                          : r.status === "pending"
                            ? "warning"
                            : r.status === "reversed"
                              ? "error"
                              : "default"
                      }
                    />
                  </Stack>
                ))}
              </Stack>
            )}
          </CardContent>
        </Card>
      )}

      {tab === 2 && (
        <Card variant="outlined">
          <CardContent>
            {listsLoading ? (
              <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}><CircularProgress size={24} /></Box>
            ) : (
              <Stack divider={<Divider />} spacing={1.5}>
                {customers.map((c) => (
                  <Stack key={c.id} direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={1}>
                    <Box>
                      <Typography fontWeight={600}>{c.name}</Typography>
                      <Typography variant="body2" color="text.secondary">{c.email}</Typography>
                      <Typography variant="caption">Code {c.referral_code} · {c.qualified_referrals} qualified</Typography>
                    </Box>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Typography variant="body2">{money(c.available_credit_cents)} available</Typography>
                      <Button
                        size="small"
                        startIcon={<ContentCopy />}
                        onClick={() => navigator.clipboard.writeText(c.share_url)}
                      >
                        Copy link
                      </Button>
                    </Stack>
                  </Stack>
                ))}
                {customers.length === 0 && (
                  <Typography color="text.secondary">
                    No referral links yet. Open any contact and click <b>Get referral link</b>, or complete a job to auto-create one for invites.
                  </Typography>
                )}
              </Stack>
            )}
          </CardContent>
        </Card>
      )}

      {tab === 3 && (
        <Card variant="outlined">
          <CardContent>
            {listsLoading ? (
              <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}><CircularProgress size={24} /></Box>
            ) : (
              <Stack divider={<Divider />} spacing={1.5}>
                {ledger.map((e) => (
                  <Stack key={e.id} direction="row" justifyContent="space-between">
                    <Box>
                      <Typography fontWeight={600}>{e.customer_name}</Typography>
                      <Typography variant="body2" color="text.secondary">{e.description || e.entry_type}</Typography>
                    </Box>
                    <Typography fontWeight={700} color={e.amount_cents >= 0 ? "success.main" : "text.primary"}>
                      {e.amount_cents >= 0 ? "+" : ""}{money(e.amount_cents)}
                    </Typography>
                  </Stack>
                ))}
                {ledger.length === 0 && <Typography color="text.secondary">No ledger entries yet.</Typography>}
              </Stack>
            )}
          </CardContent>
        </Card>
      )}
        </>
      )}
    </Box>
  )
}

export default ReferralOwnerDashboard
