"use client"

import { useState, useEffect, useRef } from "react"
import {
  Box,
  TextField,
  CircularProgress,
  Paper,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ClickAwayListener,
} from "@mui/material"
import { LocationOn } from "@mui/icons-material"

export const PlacesAutocomplete = ({
  value,
  onChange,
  error,
  helperText,
  label = "Address",
  placeholder = "Search for a location...",
}) => {
  const [inputValue, setInputValue] = useState(value || "")
  const [suggestions, setSuggestions] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [isGoogleLoaded, setIsGoogleLoaded] = useState(false)
  const autocompleteService = useRef(null)
  const geocoder = useRef(null)
  const debounceTimer = useRef(null)

  useEffect(() => {
    const loadGoogleMaps = async () => {
      if (window.google?.maps?.places) {
        setIsGoogleLoaded(true)
        autocompleteService.current = new window.google.maps.places.AutocompleteService()
        geocoder.current = new window.google.maps.Geocoder()
        return
      }

      const script = document.createElement("script")
      script.src = `https://maps.googleapis.com/maps/api/js?key=${import.meta.env.VITE_GOOGLE_API_KEY}&libraries=places`
      script.async = true
      script.defer = true
      script.onload = () => {
        setIsGoogleLoaded(true)
        autocompleteService.current = new window.google.maps.places.AutocompleteService()
        geocoder.current = new window.google.maps.Geocoder()
      }
      document.head.appendChild(script)
    }

    loadGoogleMaps()
  }, [])

  useEffect(() => {
    setInputValue(value || "")
  }, [value])

  const searchPlaces = (query) => {
    if (!query || !isGoogleLoaded || !autocompleteService.current) {
      setSuggestions([])
      return
    }

    setIsLoading(true)
    autocompleteService.current.getPlacePredictions(
      { input: query, types: ["establishment", "geocode"] },
      (predictions, status) => {
        setIsLoading(false)
        if (status === window.google.maps.places.PlacesServiceStatus.OK && predictions) {
          setSuggestions(predictions.slice(0, 5))
        } else {
          setSuggestions([])
        }
      },
    )
  }

  const handleInputChange = (event) => {
    const newValue = event.target.value
    setInputValue(newValue)
    setShowSuggestions(true)

    if (debounceTimer.current) clearTimeout(debounceTimer.current)
    debounceTimer.current = setTimeout(() => searchPlaces(newValue), 300)
  }

  const handleSuggestionClick = (suggestion) => {
    setInputValue(suggestion.description)
    setShowSuggestions(false)
    setSuggestions([])

    if (!geocoder.current) return

    geocoder.current.geocode({ placeId: suggestion.place_id }, (results, status) => {
      if (status === "OK" && results[0]) {
        const place = results[0]
        const location = place.geometry.location
        onChange({
          address: place.formatted_address,
          latitude: location.lat(),
          longitude: location.lng(),
          placeId: suggestion.place_id,
        })
      }
    })
  }

  return (
    <ClickAwayListener onClickAway={() => setShowSuggestions(false)}>
      <Box sx={{ position: "relative" }}>
        <TextField
          fullWidth
          label={label}
          value={inputValue}
          onChange={handleInputChange}
          onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
          error={error}
          helperText={
            helperText || (isGoogleLoaded ? "Start typing to search for places..." : "Loading Google Places...")
          }
          placeholder={placeholder}
          disabled={!isGoogleLoaded}
          InputProps={{
            endAdornment: isLoading && <CircularProgress size={20} />,
          }}
        />

        {showSuggestions && suggestions.length > 0 && (
          <Paper
            sx={{
              position: "absolute",
              top: "100%",
              left: 0,
              right: 0,
              zIndex: 2000,
              maxHeight: 200,
              overflow: "auto",
              mt: 1,
            }}
          >
            <List dense>
              {suggestions.map((suggestion) => (
                <ListItem
                  key={suggestion.place_id}
                  button
                  onClick={() => handleSuggestionClick(suggestion)}
                  sx={{ "&:hover": { backgroundColor: "action.hover" } }}
                >
                  <ListItemIcon>
                    <LocationOn color="primary" />
                  </ListItemIcon>
                  <ListItemText
                    primary={suggestion.structured_formatting.main_text}
                    secondary={suggestion.structured_formatting.secondary_text}
                  />
                </ListItem>
              ))}
            </List>
          </Paper>
        )}
      </Box>
    </ClickAwayListener>
  )
}
