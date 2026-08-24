import { useEffect, useMemo, useState } from "react"
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
import { CardGiftcard, ContentCopy, Save } from "@mui/icons-material"
import {
  useGetReferralDashboardQuery,
  useUpdateReferralProgramMutation,
} from "../../store/api/referralsApi"

const money = (cents) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format((Number(cents) || 0) / 100)

const ReferralOwnerDashboard = () => {
  const { data, isLoading, error, refetch } = useGetReferralDashboardQuery()
  const [updateProgram, { isLoading: saving }] = useUpdateReferralProgramMutation()
  const [tab, setTab] = useState(0)
  const [message, setMessage] = useState(null)
  const [form, setForm] = useState(null)

  useEffect(() => {
    if (data?.program) setForm({ ...data.program })
  }, [data])

  const pending = useMemo(
    () => (data?.referrals || []).filter((r) => r.status === "pending"),
    [data]
  )

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

  if (isLoading || !form) {
    return (
      <Box sx={{ p: 4, display: "flex", justifyContent: "center" }}>
        <CircularProgress />
      </Box>
    )
  }

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">{error?.data?.detail || "Failed to load referral dashboard."}</Alert>
      </Box>
    )
  }

  const stats = data.stats || {}

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 2 }}>
        <CardGiftcard color="primary" />
        <Box>
          <Typography variant="h5" fontWeight={700}>Customer Referrals</Typography>
          <Typography variant="body2" color="text.secondary">
            Homeowner referral credits for this subaccount — not B2B partner referrals.
          </Typography>
        </Box>
      </Stack>

      {message && (
        <Alert severity={message.type} sx={{ mb: 2 }} onClose={() => setMessage(null)}>
          {message.text}
        </Alert>
      )}

      <Grid container spacing={2} sx={{ mb: 2 }}>
        {[
          ["Qualified", stats.qualified, "successful referrals"],
          ["Pending", stats.pending, "awaiting paid invoice"],
          ["Credits issued", money(stats.credits_issued_cents), `${money(stats.credits_available_cents)} available`],
          ["Revenue influenced", money(stats.influenced_revenue_cents), "from qualified invoices"],
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
        <Tab label={`Referrals (${(data?.referrals || []).length})`} />
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
            <Stack divider={<Divider />} spacing={1.5}>
              {(data.referrals || []).length === 0 && (
                <Typography color="text.secondary">No referrals yet.</Typography>
              )}
              {(data.referrals || []).map((r) => (
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
          </CardContent>
        </Card>
      )}

      {tab === 2 && (
        <Card variant="outlined">
          <CardContent>
            <Stack divider={<Divider />} spacing={1.5}>
              {(data.customers || []).map((c) => (
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
              {(data.customers || []).length === 0 && (
                    <Typography color="text.secondary">
                      No referral links yet. Open any contact and click <b>Get referral link</b>, or complete a job to auto-create one for invites.
                    </Typography>
              )}
            </Stack>
          </CardContent>
        </Card>
      )}

      {tab === 3 && (
        <Card variant="outlined">
          <CardContent>
            <Stack divider={<Divider />} spacing={1.5}>
              {(data.ledger || []).map((e) => (
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
              {(data.ledger || []).length === 0 && <Typography color="text.secondary">No ledger entries yet.</Typography>}
            </Stack>
          </CardContent>
        </Card>
      )}
    </Box>
  )
}

export default ReferralOwnerDashboard
