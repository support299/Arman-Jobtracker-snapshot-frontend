import React from "react";
import { Box, Typography } from "@mui/material";
import JobsMap from "./JobsMap.jsx";

/** Dedicated map page for GHL embed (same shell pattern as AdminCalendar). */
const AdminMap = () => (
  <Box
    sx={{
      width: "100%",
      height: { xs: "auto", md: "calc(100vh - 32px)" },
      minHeight: { xs: "calc(100vh - 32px)", md: 0 },
      display: "flex",
      flexDirection: "column",
      overflow: "hidden",
    }}
  >
    <Typography
      variant="h4"
      component="h1"
      gutterBottom
      sx={{
        fontSize: { xs: "1.5rem", sm: "2rem", md: "2.125rem" },
        fontWeight: 600,
        flexShrink: 0,
      }}
    >
      Map
    </Typography>
    <Typography
      variant="body2"
      color="text.secondary"
      mb={2}
      sx={{
        fontSize: { xs: "0.75rem", sm: "0.875rem" },
        display: { xs: "none", sm: "block" },
        flexShrink: 0,
      }}
    >
      Jobs, estimates & live fleet.
    </Typography>
    <Box sx={{ flex: 1, minHeight: { xs: 480, md: 0 }, overflow: "hidden" }}>
      <JobsMap dedicatedPage />
    </Box>
  </Box>
);

export default AdminMap;
