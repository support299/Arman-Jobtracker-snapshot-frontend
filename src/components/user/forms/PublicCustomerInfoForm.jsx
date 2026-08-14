import React, { useState } from 'react';
import {
  Box,
  TextField,
  Typography,
  FormControlLabel,
  Checkbox,
  Grid,
  Paper,
} from '@mui/material';

/**
 * Public/customer-facing first step: enter own contact + address + notes.
 * No contact search, no technician fields, no service-location picker.
 */
export const PublicCustomerInfoForm = ({ data, onUpdate }) => {
  const userInfo = data.userInfo || {};
  const [notesFocused, setNotesFocused] = useState(false);

  const setField = (field, value) => {
    onUpdate({
      userInfo: {
        ...userInfo,
        [field]: value,
      },
    });
  };

  const handleChange = (field) => (event) => {
    setField(field, event.target.value);
  };

  const fieldSx = {
    '& .MuiOutlinedInput-root': {
      borderRadius: 2,
      backgroundColor: '#fff',
      '&:hover fieldset': { borderColor: '#0f766e' },
      '&.Mui-focused fieldset': { borderColor: '#0f766e' },
    },
    '& .MuiInputLabel-root.Mui-focused': { color: '#0f766e' },
  };

  return (
    <Box>
      <Typography
        variant="h5"
        sx={{ fontWeight: 700, color: '#134e4a', mb: 0.5, letterSpacing: '-0.02em' }}
      >
        Your information
      </Typography>
      <Typography variant="body2" sx={{ color: '#57534e', mb: 3, maxWidth: 560 }}>
        Tell us how to reach you and where the work will be done. Your details stay private to this estimate.
      </Typography>

      <Paper
        elevation={0}
        sx={{
          p: { xs: 2, sm: 3 },
          mb: 2.5,
          borderRadius: 3,
          border: '1px solid #e7e5e4',
          background: 'linear-gradient(180deg, #ffffff 0%, #fafaf9 100%)',
        }}
      >
        <Typography variant="subtitle2" sx={{ color: '#0f766e', fontWeight: 700, mb: 2, textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: '0.75rem' }}>
          Contact
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              required
              label="First name"
              value={userInfo.firstName || ''}
              onChange={handleChange('firstName')}
              sx={fieldSx}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Last name"
              value={userInfo.lastName || ''}
              onChange={handleChange('lastName')}
              sx={fieldSx}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              required
              type="email"
              label="Email"
              value={userInfo.email || ''}
              onChange={handleChange('email')}
              sx={fieldSx}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              required
              label="Phone"
              value={userInfo.phone || ''}
              onChange={handleChange('phone')}
              sx={fieldSx}
            />
          </Grid>
        </Grid>
      </Paper>

      <Paper
        elevation={0}
        sx={{
          p: { xs: 2, sm: 3 },
          mb: 2.5,
          borderRadius: 3,
          border: '1px solid #e7e5e4',
          background: 'linear-gradient(180deg, #ffffff 0%, #fafaf9 100%)',
        }}
      >
        <Typography variant="subtitle2" sx={{ color: '#0f766e', fontWeight: 700, mb: 2, textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: '0.75rem' }}>
          Property address
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <TextField
              fullWidth
              required
              label="Street address"
              value={userInfo.streetAddress || ''}
              onChange={handleChange('streetAddress')}
              sx={fieldSx}
            />
          </Grid>
          <Grid item xs={12} sm={4}>
            <TextField
              fullWidth
              required
              label="City"
              value={userInfo.city || ''}
              onChange={handleChange('city')}
              sx={fieldSx}
            />
          </Grid>
          <Grid item xs={12} sm={4}>
            <TextField
              fullWidth
              required
              label="State"
              value={userInfo.state || ''}
              onChange={handleChange('state')}
              sx={fieldSx}
            />
          </Grid>
          <Grid item xs={12} sm={4}>
            <TextField
              fullWidth
              required
              label="ZIP / Postal code"
              value={userInfo.postalCode || ''}
              onChange={handleChange('postalCode')}
              sx={fieldSx}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              select
              fullWidth
              label="Property type"
              value={userInfo.propertyType || 'residential'}
              onChange={handleChange('propertyType')}
              SelectProps={{ native: true }}
              sx={fieldSx}
            >
              <option value="residential">Residential</option>
              <option value="commercial">Commercial</option>
            </TextField>
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Gate code (optional)"
              value={userInfo.gateCode || ''}
              onChange={handleChange('gateCode')}
              sx={fieldSx}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              required
              label="House size (sq ft)"
              value={userInfo.selectedHouseSize || ''}
              onChange={(e) => {
                const onlyNums = e.target.value.replace(/\D/g, '');
                setField('selectedHouseSize', onlyNums);
              }}
              sx={fieldSx}
            />
          </Grid>
          <Grid item xs={12} sm={6} display="flex" alignItems="center">
            <FormControlLabel
              control={
                <Checkbox
                  checked={Boolean(userInfo.first_time)}
                  onChange={(e) => setField('first_time', e.target.checked)}
                  sx={{
                    color: '#0f766e',
                    '&.Mui-checked': { color: '#0f766e' },
                  }}
                />
              }
              label="This is my first time requesting a quote"
            />
          </Grid>
        </Grid>
      </Paper>

      <Paper
        elevation={0}
        sx={{
          p: { xs: 2, sm: 3 },
          borderRadius: 3,
          border: notesFocused ? '1px solid #0f766e' : '1px solid #e7e5e4',
          background: 'linear-gradient(180deg, #ffffff 0%, #f0fdfa 100%)',
          transition: 'border-color 0.2s ease',
        }}
      >
        <Typography variant="subtitle2" sx={{ color: '#0f766e', fontWeight: 700, mb: 1, textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: '0.75rem' }}>
          Notes
        </Typography>
        <Typography variant="body2" sx={{ color: '#57534e', mb: 1.5 }}>
          Share special requests, access instructions, or anything else we should know.
        </Typography>
        <TextField
          fullWidth
          multiline
          minRows={3}
          maxRows={8}
          placeholder="e.g. Gate code details, preferred timing, pets on site…"
          value={userInfo.customerNotes || ''}
          onChange={handleChange('customerNotes')}
          onFocus={() => setNotesFocused(true)}
          onBlur={() => setNotesFocused(false)}
          inputProps={{ maxLength: 2000 }}
          helperText={`${(userInfo.customerNotes || '').length} / 2000`}
          sx={fieldSx}
        />
      </Paper>
    </Box>
  );
};

export default PublicCustomerInfoForm;
