"use client"

import { useEffect, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { Box, CircularProgress, Typography, Alert, Button } from "@mui/material"
import { axiosInstance, BASE_URL } from "../../store/axios/axios"

const REDIRECT_PATH =
  import.meta.env.VITE_GHL_LOCATION_CONNECT_REDIRECT_PATH || "/oauth/location-callback"

const LocationOAuthCallback = () => {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [error, setError] = useState(null)

  useEffect(() => {
    const code = searchParams.get("code")
    if (!code) {
      setError("No authorization code received from GoHighLevel.")
      return
    }

    const exchangeToken = async () => {
      try {
        const redirectUri = `${window.location.origin}${REDIRECT_PATH.startsWith("/") ? REDIRECT_PATH : `/${REDIRECT_PATH}`}`
        await axiosInstance.get(`${BASE_URL}/accounts/auth/tokens/`, {
          params: { code, redirect_uri: redirectUri },
        })
        navigate("/platform/onboarding?connected=1", { replace: true })
      } catch (err) {
        const detail =
          err?.response?.data?.detail ||
          err?.response?.data?.error ||
          err?.message ||
          "Failed to complete GHL connection."
        setError(typeof detail === "string" ? detail : JSON.stringify(detail))
      }
    }

    exchangeToken()
  }, [searchParams, navigate])

  if (error) {
    return (
      <Box
        display="flex"
        flexDirection="column"
        alignItems="center"
        justifyContent="center"
        minHeight="60vh"
        gap={2}
        px={2}
      >
        <Alert severity="error" sx={{ maxWidth: 480 }}>
          {error}
        </Alert>
        <Button variant="contained" onClick={() => navigate("/platform/onboarding")}>
          Back to Platform Onboarding
        </Button>
      </Box>
    )
  }

  return (
    <Box
      display="flex"
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
      minHeight="60vh"
      gap={2}
    >
      <CircularProgress />
      <Typography color="text.secondary">Completing GHL subaccount connection…</Typography>
    </Box>
  )
}

export default LocationOAuthCallback
