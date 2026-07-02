import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
} from '@mui/material';
import { profileDialogSx, profileFieldSx } from '../../pages/contact/contactProfileTheme';

const emptyForm = {
  name: '',
  street_address: '',
  city: '',
  state: '',
  postal_code: '',
  gate_code: '',
  number_of_floors: '',
  property_sqft: '',
  property_type: '',
};

function parseAddressComponents(components = []) {
  const get = (type) => {
    const item = components.find((c) => c.types?.includes(type));
    return item?.long_name || item?.short_name || '';
  };
  return {
    street_address: [get('street_number'), get('route')].filter(Boolean).join(' '),
    city: get('locality') || get('sublocality') || get('administrative_area_level_2'),
    state: get('administrative_area_level_1'),
    postal_code: get('postal_code'),
  };
}

function SectionLabel({ children }) {
  return <Typography sx={profileDialogSx.sectionLabel}>{children}</Typography>;
}

function PlacesAutocomplete({ value, onSelect, helperText }) {
  const [inputValue, setInputValue] = useState(value || '');
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [googleReady, setGoogleReady] = useState(false);
  const autocompleteService = useRef(null);
  const geocoder = useRef(null);
  const debounceRef = useRef(null);

  useEffect(() => {
    if (window.google?.maps?.places) {
      autocompleteService.current = new window.google.maps.places.AutocompleteService();
      geocoder.current = new window.google.maps.Geocoder();
      setGoogleReady(true);
      return undefined;
    }
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${import.meta.env.VITE_GOOGLE_API_KEY}&libraries=places`;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      autocompleteService.current = new window.google.maps.places.AutocompleteService();
      geocoder.current = new window.google.maps.Geocoder();
      setGoogleReady(true);
    };
    document.head.appendChild(script);
    return () => {
      script.remove();
    };
  }, []);

  useEffect(() => {
    setInputValue(value || '');
  }, [value]);

  const fetchPredictions = (query) => {
    if (!autocompleteService.current || !googleReady) {
      setSuggestions([]);
      return;
    }
    setLoading(true);
    autocompleteService.current.getPlacePredictions(
      { input: query, types: ['address'] },
      (preds, status) => {
        setLoading(false);
        if (status === window.google.maps.places.PlacesServiceStatus.OK && preds?.length) {
          setSuggestions(preds.slice(0, 5));
        } else {
          setSuggestions([]);
        }
      },
    );
  };

  const handleInput = (event) => {
    const next = event.target.value;
    setInputValue(next);
    setShowSuggestions(true);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchPredictions(next), 250);
  };

  const handlePick = (prediction) => {
    setInputValue(prediction.description);
    setShowSuggestions(false);
    if (!geocoder.current) return;
    geocoder.current.geocode({ placeId: prediction.place_id }, (results, status) => {
      if (status !== 'OK' || !results?.[0]) return;
      const parsed = parseAddressComponents(results[0].address_components);
      onSelect({
        ...parsed,
        street_address: parsed.street_address || prediction.description,
      });
    });
  };

  return (
    <Box sx={{ position: 'relative' }}>
      <TextField
        fullWidth
        size="small"
        label="Search address"
        value={inputValue}
        onChange={handleInput}
        onFocus={() => setShowSuggestions(true)}
        placeholder="Start typing an address…"
        helperText={helperText || (googleReady ? 'Autocomplete fills the fields below' : 'Loading maps…')}
        sx={profileFieldSx}
      />
      {showSuggestions && suggestions.length > 0 && (
        <Box
          sx={{
            position: 'absolute',
            zIndex: 10,
            top: '100%',
            left: 0,
            right: 0,
            mt: 0.5,
            bgcolor: '#fff',
            border: '1px solid #e4e7ec',
            borderRadius: 1.5,
            boxShadow: '0 8px 24px rgba(16, 24, 40, 0.08)',
            maxHeight: 220,
            overflow: 'auto',
          }}
        >
          {suggestions.map((item) => (
            <Box
              key={item.place_id}
              onClick={() => handlePick(item)}
              sx={{
                px: 2,
                py: 1.25,
                cursor: 'pointer',
                fontSize: '0.875rem',
                color: '#344054',
                '&:hover': { bgcolor: '#f9fafb' },
              }}
            >
              {item.description}
            </Box>
          ))}
        </Box>
      )}
      {loading && (
        <Typography variant="caption" color="#667085" sx={{ mt: 0.5, display: 'block' }}>
          Searching…
        </Typography>
      )}
    </Box>
  );
}

export function ContactAddressFormDialog({ open, onClose, onSubmit, initialValues, busy, mode = 'create' }) {
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setForm({
        ...emptyForm,
        ...(initialValues || {}),
        number_of_floors: initialValues?.number_of_floors ?? '',
        property_sqft: initialValues?.property_sqft ?? '',
      });
      setError('');
    }
  }, [open, initialValues]);

  const handleChange = (field) => (event) => {
    setForm((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const handleSubmit = async () => {
    setError('');
    const payload = {
      name: form.name.trim() || undefined,
      street_address: form.street_address.trim(),
      city: form.city.trim(),
      state: form.state.trim(),
      postal_code: form.postal_code.trim(),
      gate_code: form.gate_code.trim() || null,
      number_of_floors: form.number_of_floors === '' ? null : Number(form.number_of_floors),
      property_sqft: form.property_sqft === '' ? null : Number(form.property_sqft),
      property_type: form.property_type || null,
    };
    if (!payload.street_address && !payload.city && !payload.state && !payload.postal_code) {
      setError('Enter at least one address line.');
      return;
    }
    try {
      await onSubmit(payload);
      onClose();
    } catch (e) {
      setError(e?.data?.detail || e?.data?.non_field_errors?.[0] || 'Could not save address.');
    }
  };

  const isEdit = mode === 'edit';

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="sm"
      PaperProps={{ sx: profileDialogSx.paper }}
    >
      <DialogTitle sx={profileDialogSx.title}>
        {isEdit ? 'Edit property' : 'Add property'}
      </DialogTitle>
      <Typography sx={profileDialogSx.subtitle}>
        {isEdit
          ? 'Update the saved address and property details below.'
          : 'Search for an address or enter the details manually.'}
      </Typography>

      <DialogContent sx={profileDialogSx.content}>
        <SectionLabel>Location search</SectionLabel>
        <PlacesAutocomplete
          value={form.street_address}
          onSelect={(parsed) => setForm((prev) => ({ ...prev, ...parsed }))}
        />

        <Divider sx={{ my: 2.5, borderColor: '#f2f4f7' }} />

        <SectionLabel>Address details</SectionLabel>
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <TextField
              fullWidth
              size="small"
              label="Property label"
              placeholder="Home, office, rental unit…"
              value={form.name}
              onChange={handleChange('name')}
              sx={profileFieldSx}
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              fullWidth
              size="small"
              label="Street address"
              value={form.street_address}
              onChange={handleChange('street_address')}
              sx={profileFieldSx}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField fullWidth size="small" label="City" value={form.city} onChange={handleChange('city')} sx={profileFieldSx} />
          </Grid>
          <Grid item xs={6} sm={3}>
            <TextField fullWidth size="small" label="State" value={form.state} onChange={handleChange('state')} sx={profileFieldSx} />
          </Grid>
          <Grid item xs={6} sm={3}>
            <TextField
              fullWidth
              size="small"
              label="ZIP / Postal code"
              value={form.postal_code}
              onChange={handleChange('postal_code')}
              sx={profileFieldSx}
            />
          </Grid>
        </Grid>

        <Divider sx={{ my: 2.5, borderColor: '#f2f4f7' }} />

        <SectionLabel>Property details</SectionLabel>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth size="small" sx={profileFieldSx}>
              <InputLabel>Property type</InputLabel>
              <Select label="Property type" value={form.property_type} onChange={handleChange('property_type')}>
                <MenuItem value="">
                  <em>Not specified</em>
                </MenuItem>
                <MenuItem value="residential">Residential</MenuItem>
                <MenuItem value="commercial">Commercial</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={6} sm={3}>
            <TextField
              fullWidth
              size="small"
              label="Square feet"
              type="number"
              value={form.property_sqft}
              onChange={handleChange('property_sqft')}
              sx={profileFieldSx}
            />
          </Grid>
          <Grid item xs={6} sm={3}>
            <TextField
              fullWidth
              size="small"
              label="Floors"
              type="number"
              value={form.number_of_floors}
              onChange={handleChange('number_of_floors')}
              sx={profileFieldSx}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              size="small"
              label="Gate code"
              value={form.gate_code}
              onChange={handleChange('gate_code')}
              sx={profileFieldSx}
            />
          </Grid>
        </Grid>

        {error && (
          <Alert severity="error" variant="outlined" sx={{ mt: 2, borderRadius: 1.5 }}>
            {error}
          </Alert>
        )}
      </DialogContent>

      <DialogActions sx={profileDialogSx.actions}>
        <Button onClick={onClose} disabled={busy} variant="outlined" sx={profileDialogSx.secondaryBtn}>
          Cancel
        </Button>
        <Button variant="contained" onClick={handleSubmit} disabled={busy} sx={profileDialogSx.primaryBtn}>
          {busy ? 'Saving…' : isEdit ? 'Save changes' : 'Add property'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
