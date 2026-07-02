/** Clean, neutral styling for the public client profile (/contact/jobs/...). */

export const profilePageSx = {
  page: {
    minHeight: '100vh',
    bgcolor: '#f4f5f7',
    pb: 4,
  },
  shell: {
    maxWidth: 960,
    mx: 'auto',
    px: { xs: 2, sm: 3 },
    pt: { xs: 2, sm: 2.5 },
  },
  mainCard: {
    mt: 2,
    borderRadius: 2,
    border: '1px solid',
    borderColor: '#e4e7ec',
    bgcolor: '#fff',
    boxShadow: '0 1px 2px rgba(16, 24, 40, 0.06)',
    overflow: 'hidden',
  },
  header: {
    px: { xs: 2, sm: 3 },
    py: { xs: 2.5, sm: 3 },
    borderBottom: '1px solid',
    borderColor: '#e4e7ec',
    bgcolor: '#fff',
  },
  eyebrow: {
    fontSize: '0.6875rem',
    fontWeight: 600,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: '#667085',
    mb: 1,
  },
  displayName: {
    fontSize: { xs: '1.375rem', sm: '1.5rem' },
    fontWeight: 600,
    letterSpacing: '-0.02em',
    color: '#101828',
    lineHeight: 1.25,
  },
  subtitle: {
    mt: 0.5,
    fontSize: '0.875rem',
    color: '#667085',
    lineHeight: 1.5,
  },
  metaRow: {
    mt: 1.5,
    display: 'flex',
    flexWrap: 'wrap',
    gap: 2,
  },
  metaItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 0.75,
    fontSize: '0.875rem',
    color: '#344054',
  },
  statsBar: {
    display: 'grid',
    gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' },
    borderBottom: '1px solid',
    borderColor: '#e4e7ec',
  },
  statCell: {
    px: { xs: 2, sm: 3 },
    py: 2,
    borderRight: { md: '1px solid #e4e7ec' },
    '&:nth-of-type(2n)': {
      borderRight: { xs: 'none', md: undefined },
    },
    '&:last-child': {
      borderRight: 'none',
    },
    '&:not(:last-child)': {
      borderBottom: { xs: '1px solid #e4e7ec', md: 'none' },
    },
  },
  statValue: {
    fontSize: '1.25rem',
    fontWeight: 600,
    color: '#101828',
    lineHeight: 1.2,
  },
  statLabel: {
    fontSize: '0.75rem',
    fontWeight: 500,
    color: '#667085',
    mt: 0.25,
  },
  tabs: {
    minHeight: 48,
    px: { xs: 1, sm: 2 },
    borderBottom: '1px solid',
    borderColor: '#e4e7ec',
    bgcolor: '#fafafa',
    '& .MuiTab-root': {
      minHeight: 48,
      textTransform: 'none',
      fontWeight: 500,
      fontSize: '0.875rem',
      color: '#667085',
      '&.Mui-selected': { color: '#101828', fontWeight: 600 },
    },
    '& .MuiTabs-indicator': {
      height: 2,
      bgcolor: '#101828',
    },
  },
  content: {
    p: { xs: 2, sm: 3 },
    bgcolor: '#fff',
    minHeight: 320,
  },
  sectionTitle: {
    fontSize: '0.9375rem',
    fontWeight: 600,
    color: '#101828',
  },
  sectionDesc: {
    fontSize: '0.8125rem',
    color: '#667085',
    mt: 0.25,
  },
  listItem: (active) => ({
    p: 1.5,
    cursor: 'pointer',
    borderRadius: 1.5,
    border: '1px solid',
    borderColor: active ? '#98a2b3' : '#e4e7ec',
    bgcolor: active ? '#f9fafb' : '#fff',
    transition: 'border-color 0.15s, background-color 0.15s',
    '&:hover': {
      borderColor: '#98a2b3',
      bgcolor: '#f9fafb',
    },
  }),
  emptyState: {
    p: 4,
    textAlign: 'center',
    borderRadius: 1.5,
    border: '1px dashed #d0d5dd',
    bgcolor: '#fafafa',
  },
};

export const profileFieldSx = {
  '& .MuiOutlinedInput-root': {
    borderRadius: 1.5,
    bgcolor: '#fff',
    fontSize: '0.875rem',
    '& fieldset': { borderColor: '#d0d5dd' },
    '&:hover fieldset': { borderColor: '#98a2b3' },
    '&.Mui-focused fieldset': { borderColor: '#344054', borderWidth: 1 },
  },
  '& .MuiInputLabel-root': {
    fontSize: '0.875rem',
    color: '#667085',
    '&.Mui-focused': { color: '#344054' },
  },
};

export const profileDialogSx = {
  paper: {
    borderRadius: 2,
    border: '1px solid #e4e7ec',
    boxShadow: '0 20px 40px rgba(16, 24, 40, 0.12)',
  },
  title: {
    px: 3,
    pt: 2.5,
    pb: 0,
    fontSize: '1.125rem',
    fontWeight: 600,
    color: '#101828',
  },
  subtitle: {
    px: 3,
    pt: 0.5,
    pb: 0,
    fontSize: '0.8125rem',
    color: '#667085',
  },
  content: {
    px: 3,
    py: 2.5,
  },
  sectionLabel: {
    fontSize: '0.6875rem',
    fontWeight: 600,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    color: '#667085',
    mb: 1.5,
    mt: 0,
  },
  actions: {
    px: 3,
    py: 2,
    borderTop: '1px solid #e4e7ec',
    bgcolor: '#fafafa',
  },
  primaryBtn: {
    textTransform: 'none',
    fontWeight: 600,
    borderRadius: 1.5,
    px: 2.5,
    boxShadow: 'none',
    bgcolor: '#101828',
    '&:hover': { bgcolor: '#344054', boxShadow: 'none' },
  },
  secondaryBtn: {
    textTransform: 'none',
    fontWeight: 500,
    borderRadius: 1.5,
    color: '#344054',
    borderColor: '#d0d5dd',
  },
};
