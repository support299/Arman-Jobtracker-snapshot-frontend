import { useEffect, useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControlLabel,
  Switch,
  Alert,
  Box,
  CircularProgress,
  Typography,
  IconButton,
  InputAdornment,
  Divider,
} from "@mui/material";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import {
  useGetSettingsQuery,
  useUpdateSettingsMutation,
  useTestConnectionMutation,
} from "../../../store/api/onestepgpsApi";

export default function OneStepGPSSettingsDialog({ open, onClose }) {
  const { data: settings, isLoading } = useGetSettingsQuery(undefined, { skip: !open });
  const [updateSettings, { isLoading: saving }] = useUpdateSettingsMutation();
  const [testConnection, { isLoading: testing }] = useTestConnectionMutation();

  const [apiKey, setApiKey] = useState("");
  const [isEnabled, setIsEnabled] = useState(true);
  const [webhookUsername, setWebhookUsername] = useState("");
  const [webhookPassword, setWebhookPassword] = useState("");
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!settings) return;
    setIsEnabled(settings.is_enabled !== false);
    setWebhookUsername(settings.webhook_username || "");
    setApiKey("");
    setWebhookPassword("");
  }, [settings]);

  const handleCopyWebhook = async () => {
    const url = settings?.webhook_url;
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setMessage("Webhook URL copied.");
      setTimeout(() => setMessage(null), 2500);
    } catch {
      setError("Could not copy URL.");
    }
  };

  const handleCopyDataQueue = async () => {
    const url = settings?.dataqueue_url;
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setMessage("DataQueue URL copied.");
      setTimeout(() => setMessage(null), 2500);
    } catch {
      setError("Could not copy URL.");
    }
  };

  const handleGenerateToken = () => {
    const token = Array.from(crypto.getRandomValues(new Uint8Array(18)))
      .map((b) => b.toString(36).padStart(2, "0"))
      .join("")
      .slice(0, 24);
    setWebhookPassword(token);
    setMessage("New DataQueue token generated — save settings, then paste this token into OneStep GPS.");
  };

  const handleSave = async () => {
    setMessage(null);
    setError(null);
    try {
      const payload = {
        is_enabled: isEnabled,
        webhook_username: webhookUsername.trim(),
      };
      if (apiKey.trim()) payload.api_key = apiKey.trim();
      if (webhookPassword.trim() || webhookPassword === "") {
        // only send password when user typed something new, or clear intentionally
        // empty string after user edits clears; if untouched leave alone
      }
      if (webhookPassword !== "") {
        payload.webhook_password = webhookPassword;
      }
      await updateSettings(payload).unwrap();
      setApiKey("");
      setWebhookPassword("");
      setMessage("One Step GPS settings saved.");
    } catch (err) {
      setError(err?.data?.detail || "Failed to save settings.");
    }
  };

  const handleTest = async () => {
    setMessage(null);
    setError(null);
    try {
      const payload = apiKey.trim() ? { api_key: apiKey.trim() } : {};
      const result = await testConnection(payload).unwrap();
      setMessage(`Connection OK. Found ${result.device_count} device(s).`);
    } catch (err) {
      setError(err?.data?.detail || "Connection test failed.");
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>One Step GPS</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          API key powers the live map. Alerts, trips, and diagnostics come from the OneStep DataQueue URL below. Leave the legacy webhook URL unchanged.
        </Typography>

        {isLoading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}>
            <CircularProgress size={28} />
          </Box>
        ) : (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <FormControlLabel
              control={
                <Switch
                  checked={isEnabled}
                  onChange={(e) => setIsEnabled(e.target.checked)}
                />
              }
              label="Show live vehicles on map"
            />

            <TextField
              label="API Key"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={settings?.api_key_set ? "Saved key is set — enter new key to replace" : "Paste One Step GPS API key"}
              fullWidth
              autoComplete="off"
            />

            {settings?.api_key_set && !apiKey && (
              <Typography variant="caption" color="text.secondary">
                An API key is already saved for this account.
              </Typography>
            )}

            <Divider sx={{ my: 0.5 }} />

            <Typography variant="subtitle2">OneStep DataQueue (use this)</Typography>
            <Typography variant="caption" color="text.secondary" component="div">
              Paste this URL in OneStep GPS → DataQueues → Webhook endpoint.
              Consumption type: Webhook. Authentication: <strong>No Authentication</strong>.
              Enable Alerts, Device Points, Drives and Stops, and DTCs.
              {settings?.last_webhook_at && (
                <> Last event received: {new Date(settings.last_webhook_at).toLocaleString()}.</>
              )}
            </Typography>
            <TextField
              label="DataQueue URL"
              value={settings?.dataqueue_url || ""}
              fullWidth
              InputProps={{
                readOnly: true,
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton edge="end" onClick={handleCopyDataQueue} disabled={!settings?.dataqueue_url}>
                      <ContentCopyIcon fontSize="small" />
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />

            <Divider sx={{ my: 0.5 }} />
            <Typography variant="subtitle2">Legacy JSON webhook (leave as-is)</Typography>
            <TextField
              label="Legacy webhook URL"
              value={settings?.webhook_url || ""}
              fullWidth
              InputProps={{
                readOnly: true,
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton edge="end" onClick={handleCopyWebhook} disabled={!settings?.webhook_url}>
                      <ContentCopyIcon fontSize="small" />
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />

            <TextField
              label="Webhook username (optional Basic auth)"
              value={webhookUsername}
              onChange={(e) => setWebhookUsername(e.target.value)}
              fullWidth
              autoComplete="off"
            />
            <TextField
              label="Webhook / DataQueue token (Bearer)"
              type="password"
              value={webhookPassword}
              onChange={(e) => setWebhookPassword(e.target.value)}
              placeholder={
                settings?.webhook_password_set
                  ? "Saved token is set — enter new token to replace"
                  : "Generate or paste token"
              }
              fullWidth
              autoComplete="new-password"
            />
            <Button size="small" variant="outlined" onClick={handleGenerateToken}>
              Generate DataQueue token
            </Button>

            {message && <Alert severity="success">{message}</Alert>}
            {error && <Alert severity="error">{error}</Alert>}
          </Box>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose}>Close</Button>
        <Button onClick={handleTest} disabled={testing || isLoading || (!apiKey && !settings?.api_key_set)}>
          {testing ? "Testing..." : "Test connection"}
        </Button>
        <Button variant="contained" onClick={handleSave} disabled={saving || isLoading}>
          {saving ? "Saving..." : "Save"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
