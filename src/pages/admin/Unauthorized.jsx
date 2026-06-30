import { Box, Button, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { appendLocationIdToPath } from '../../utils/iframeContext';

const Unauthorized = () => {
  const navigate = useNavigate();

  return (
    <Box
      sx={{
        minHeight: '50vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
        px: 2,
        textAlign: 'center',
      }}
    >
      <Typography variant="h5" fontWeight={600}>
        You don&apos;t have access to this page
      </Typography>
      <Typography variant="body2" color="text.secondary" maxWidth={420}>
        Your account role does not include permission for this section of the job tracker.
      </Typography>
      <Button
        variant="contained"
        onClick={() => navigate(appendLocationIdToPath('/admin/jobs'))}
      >
        Go to My Jobs
      </Button>
    </Box>
  );
};

export default Unauthorized;
