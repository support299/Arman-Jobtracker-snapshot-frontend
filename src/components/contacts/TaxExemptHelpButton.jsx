import React, { useState } from 'react';
import { Box, IconButton, Popover, Stack, Typography } from '@mui/material';
import Close from '@mui/icons-material/Close';
import InfoOutlined from '@mui/icons-material/InfoOutlined';

const TAX_EXEMPT_HELP_TEXT =
  'When enabled, invoices generated for this contact skip sales tax. Tax is removed automatically for jobs completed after this setting is turned on. It does not change invoices for jobs that were already completed before then.';

export function TaxExemptHelpButton({ iconColor = 'text.secondary' }) {
  const [anchorEl, setAnchorEl] = useState(null);
  const open = Boolean(anchorEl);

  return (
    <>
      <IconButton
        size="small"
        aria-label="About tax exempt"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation();
          setAnchorEl(e.currentTarget);
        }}
        sx={{
          p: 0.25,
          color: iconColor,
          '&:hover': { color: 'text.primary', bgcolor: 'action.hover' },
        }}
      >
        <InfoOutlined sx={{ fontSize: 16 }} />
      </IconButton>
      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        slotProps={{
          paper: {
            elevation: 8,
            sx: {
              mt: 0.5,
              width: 340,
              maxWidth: 'calc(100vw - 24px)',
              borderRadius: 1.5,
              boxShadow: '0 8px 24px rgba(15, 23, 42, 0.18)',
            },
          },
        }}
      >
        <Box sx={{ p: 2 }}>
          <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={1} sx={{ mb: 1 }}>
            <Typography variant="subtitle2" fontWeight={700} sx={{ pt: 0.25 }}>
              Tax exempt
            </Typography>
            <IconButton
              size="small"
              aria-label="Close"
              onClick={() => setAnchorEl(null)}
              sx={{ mt: -0.5, mr: -0.5, color: 'text.secondary' }}
            >
              <Close sx={{ fontSize: 18 }} />
            </IconButton>
          </Stack>
          <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.55 }}>
            {TAX_EXEMPT_HELP_TEXT}
          </Typography>
        </Box>
      </Popover>
    </>
  );
}
