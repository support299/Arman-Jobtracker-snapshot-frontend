"use client"
import { useState, useMemo, useEffect } from "react"
import {
  AppBar,
  Box,
  Toolbar,
  Typography,
  Button,
  IconButton,
  Menu,
  MenuItem,
  useTheme,
  useMediaQuery,
  ListItemIcon,
  Divider,
  Avatar,
  Chip,
  Collapse,
  List,
  ListItemButton,
  ListItemText,
  Breadcrumbs,
  Link,
} from "@mui/material"
import {
  Menu as MenuIcon,
  BusinessCenter,
  LocationOn,
  Logout,
  AdminPanelSettings,
  Person,
  KeyboardArrowDown,
  WorkOutline,
  Event,
  Group,
  Map as MapIcon,
  ReceiptLong,
  PauseCircleOutline,
  AddCircleOutline,
  Home,
  AccountTree,
  ExpandLess,
  ExpandMore,
  AttachMoney,
  AccessTime,
  EventBusy,
  Calculate,
  Assessment,
  Settings,
  PeopleAlt,
  NavigateNext,
  PublishedWithChanges,
  Dashboard as DashboardIcon,
  AccountCircle,
  Contacts as ContactsIcon,
} from "@mui/icons-material"
import { useNavigate, useLocation, useSearchParams } from "react-router-dom"
import { useDispatch, useSelector } from "react-redux"
import { logoutUser } from "../../store/slices/authSlice"
import AdminFooter from "../admin/AdminFooter"
import CompanyLogo from "../CompanyLogo"
import {
  canAccessPayrollAdminSections,
  canAccessPayrollTimeClock,
} from "../../utils/payrollAccess"
import { appendLocationIdToPath, setIframeLocationId } from "../../utils/iframeContext"
import { isTenantSupportMode } from "../../utils/tenantSupportMode"
import IframeSsoLoginHandler from "../auth/IframeSsoLoginHandler"
import TenantModuleSwitcher, { getActiveTenantModule } from "../admin/TenantModuleSwitcher"

// Navigation configuration based on roles
const getNavItemsByRole = (role, fullAccessRoles, user_profile) => {
  const adminItems = [
    // { text: "Dashboard", path: "/admin/dashboard", icon: DashboardIcon, roles: ["admin", "supervisor"] },
    { text: "Jobs", path: "/admin/jobs", icon: WorkOutline, roles: ["admin", "supervisor"] },
    { text: "Map", path: "/admin/map", icon: MapIcon, roles: ["admin", "supervisor"] },
    { text: "Quotes", path: "/admin/accepted-quotes", icon: ReceiptLong, roles: ["admin", "supervisor"] },
    { text: "Repeat Job Requests", path: "/admin/pending-reschedule-quotes", icon: PublishedWithChanges, roles: ["admin", "supervisor"] },
    { text: "On Hold Jobs", path: "/admin/on-hold-jobs", icon: PauseCircleOutline, roles: ["admin", "supervisor"] },
    // { text: "Contacts", path: "/admin/contacts", icon: ContactsIcon, roles: ["admin", "supervisor"] },
    { text: "Team", path: "/admin/team", icon: Group, roles: ["admin", "supervisor"] },
  ]

  const workerItems = [
    { text: "My Jobs", path: "/admin/jobs", icon: WorkOutline, roles: ["worker"] },
    // { text: "Calendar", path: "/admin/calendar", icon: Event, roles: ["worker"] },
  ]

  // Determine payroll path based on role and pay_scale_type
  // For admins: always go to Time Clock (/admin/payroll)
  // For workers: go to Time Clock if hourly, otherwise go to Calculator
  // const getPayrollPath = () => {
  //   if (fullAccessRoles.includes(role)) {
  //     return "/admin/payroll" // Admins always go to Time Clock
  //   } else if (role === "worker") {
  //     return "/admin/payroll/reports"
  //   }
  //   return "/admin/payroll"
  // }

  // const payrollItem = [
  //   { text: "Payroll", path: getPayrollPath(), icon: AttachMoney, roles: ["admin", "worker"] },
  // ]

  const workerReportsProfile = [
    // { text: "Reports", path: "/admin/reports", icon: Assessment, roles: ["worker"] },
    // { text: "Profile", path: "/admin/profile", icon: AccountCircle, roles: ["worker"] },
  ]

  if (fullAccessRoles.includes(role)) {
    return [...adminItems] // , ...payrollItem
  } else if (role === "worker") {
    return [...workerItems, ...workerReportsProfile] // , ...payrollItem
  }

  return []
}

const getPayrollSubNavByRole = (role, user_profile, user) => {
  const canSeeTimeClock = canAccessPayrollTimeClock(role, user_profile, user)
  const canSeeAdminSections = canAccessPayrollAdminSections(role, user)

  const timeClockItem = {
    text: "Time Clock",
    path: "/admin/payroll",
    icon: AccessTime,
    roles: ["admin", "worker"],
  }

  const timeOffItem = {
    text: "Time Off",
    path: "/admin/payroll/time-off",
    icon: EventBusy,
    roles: ["admin", "worker"],
  }

  const commonPayrollItems = [
    ...(canSeeTimeClock ? [timeClockItem] : []),
    timeOffItem,
    { text: "Reports", path: "/admin/payroll/reports", icon: Assessment, roles: ["admin", "worker"] },
  ]

  const adminOnlyPayrollItems = [
    { text: "Payroll Calculator", path: "/admin/payroll/calculator", icon: Calculate, roles: ["admin"] },
    { text: "Settings", path: "/admin/payroll/settings", icon: Settings, roles: ["admin"] },
    // { text: "Team Management", path: "/admin/payroll/team", icon: PeopleAlt, roles: ["admin"] },
  ]

  if (canSeeAdminSections) {
    return [...commonPayrollItems, ...adminOnlyPayrollItems]
  }

  return commonPayrollItems
}

const getManagementItemsByRole = (role, fullAccessRoles) => {
  if (!fullAccessRoles.includes(role)) return []

  return [
    // { text: "Calendar", path: "/admin/calendar", icon: Event },
    { text: "Service Management", path: "/admin/services", icon: BusinessCenter },
    { text: "Location Management", path: "/admin/locations", icon: LocationOn },
    { text: "Account Settings", path: "/admin/account-settings", icon: Settings },
    { text: "Platform Portal", path: "/platform/dashboard", icon: AccountTree },
    // { text: "House Size Info", path: "/admin/house-size-info", icon: Home },
  ]
}

export const AdminLayout = ({ children }) => {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down("lg"))
  const isSmallMobile = useMediaQuery(theme.breakpoints.down("sm"))
  const [mobileMenuAnchor, setMobileMenuAnchor] = useState(null)
  const [managementAnchor, setManagementAnchor] = useState(null)
  const [userMenuAnchor, setUserMenuAnchor] = useState(null)
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false)
  const [mobilePayrollOpen, setMobilePayrollOpen] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const dispatch = useDispatch()

  const location_id = searchParams.get("location_id")

  useEffect(() => {
    if (location_id) {
      setIframeLocationId(location_id)
    }
  }, [location_id])

  const user_profile = useSelector((state) => state.auth.user_profile)
  const user = useSelector((state) => state.auth.user)
  const tenantSupportMode = isTenantSupportMode(user)

  // Get user role from Redux store - adjust this based on your store structure
  const userRole = user?.role || "worker"
  const userName = user_profile?.full_name || "User"

  const fullAccessRoles = ["admin", "manager", "supervisor", "agency"]
  const navRole = tenantSupportMode ? "admin" : userRole

  const navItems = useMemo(
    () => getNavItemsByRole(navRole, fullAccessRoles, user_profile),
    [navRole, user_profile, fullAccessRoles]
  )
  
  const payrollSubNavItems = useMemo(() => 
    getPayrollSubNavByRole(userRole, user_profile, user),
    [userRole, user_profile, user]
  )
  
  const managementItems = useMemo(() => {
    const items = getManagementItemsByRole(userRole, fullAccessRoles)
    return items.filter((item) => {
      if (item.path !== "/platform/dashboard") return true
      if (location_id) return false
      return Boolean(user?.is_superuser)
    })
  }, [userRole, fullAccessRoles, location_id, user?.is_superuser])

  const effectiveManagementItems = useMemo(() => {
    if (!tenantSupportMode) return managementItems
    return managementItems.filter(
      (item) =>
        item.path !== "/platform/dashboard" &&
        item.path !== "/admin/account-settings"
    )
  }, [tenantSupportMode, managementItems])

  const isPayrollSection = location.pathname.startsWith("/admin/payroll")
  const activeTenantModule = getActiveTenantModule(location.pathname)
  const showJobTrackerNav =
    !tenantSupportMode || activeTenantModule.key === "jobtracker"
  const isManagementActive = effectiveManagementItems.some((item) => location.pathname === item.path)
  const showManagementDropdown = effectiveManagementItems.length > 0 && showJobTrackerNav

  // Hide navbar for specific routes
  const shouldHideNavbar =
    !showJobTrackerNav ||
    location.pathname.startsWith("/admin/payroll") ||
    location.pathname === "/admin/dashboard" ||
    location.pathname === "/admin/calendar"

  const getPayrollBreadcrumb = () => {
    const currentPayrollItem = payrollSubNavItems.find(item => item.path === location.pathname)
    return currentPayrollItem ? currentPayrollItem.text : "Payroll Home"
  }

  const handleMobileMenuClick = (e) => {
    setMobileMenuAnchor(e.currentTarget)
  }

  const handleMobileMenuClose = () => {
    setMobileMenuAnchor(null)
    setMobileMoreOpen(false)
    setMobilePayrollOpen(false)
  }

  const handleManagementClick = (e) => {
    setManagementAnchor(e.currentTarget)
  }

  const handleManagementClose = () => {
    setManagementAnchor(null)
  }

  const handleUserMenuClick = (e) => {
    setUserMenuAnchor(e.currentTarget)
  }

  const handleUserMenuClose = () => {
    setUserMenuAnchor(null)
  }

  const handleNavigate = (path) => {
    const target = path.startsWith("/platform")
      ? path
      : appendLocationIdToPath(path, location_id)
    navigate(target)
    handleManagementClose()
    handleMobileMenuClose()
  }

  const handleLogout = () => {
    // Store current location before logout (only if not already on login page)
    if (!location.pathname.includes('/admin/login')) {
      const currentPath = location.pathname + location.search;
      localStorage.setItem('returnTo', currentPath);
      console.log('Stored returnTo in logout:', currentPath);
    }
    
    dispatch(logoutUser())
    navigate("/admin/login")
    handleUserMenuClose()
  }

  const handleSwitchToUser = () => {
    navigate("/")
    handleUserMenuClose()
  }

  const getRoleLabel = (role) => {
    const roleLabels = {
      admin: "Administrator",
      worker: "Employee",
      manager: "Manager",
      supervisor: "Supervisor",
      agency: "Agency Admin",
    }
    return roleLabels[role] || "User"
  }

  const getRoleColor = (role) => {
    const roleColors = {
      admin: "error",
      worker: "primary",
      manager: "warning",
      supervisor: "info",
      agency: "secondary",
    }
    return roleColors[role] || "default"
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <IframeSsoLoginHandler />
      {/* Main Navigation Bar */}
      {!shouldHideNavbar && (
        <AppBar
          position="sticky"
          elevation={0}
          sx={{
            backgroundColor: "white",
            borderBottom: "1px solid",
            borderColor: "divider",
            zIndex: 1200,
          }}
        >
        <Toolbar sx={{ gap: 1 }}>
          {isMobile && (
            <IconButton
              edge="start"
              onClick={handleMobileMenuClick}
              sx={{ mr: 1, color: "text.primary" }}
            >
              <MenuIcon />
            </IconButton>
          )}

          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mr: 3 }}>
            <CompanyLogo
              fallbackSrc="/image.png"
              maxHeight="36px"
              maxWidth="160px"
              sx={{ height: 36 }}
            />
          </Box>

          {!isMobile && ( 
            <>
              <Box sx={{ display: "flex", gap: 0.5, flexGrow: 1 }}>
                {navItems.map((item) => {
                  const isPayrollPath = item.path.startsWith("/admin/payroll")
                  const isContactsNav = item.path === "/admin/contacts"
                  const isActive =
                    isContactsNav
                      ? location.pathname === "/admin/contacts" || location.pathname.startsWith("/admin/contacts/")
                      : location.pathname === item.path || (isPayrollPath && isPayrollSection)
                  
                  return (
                    <Button
                      key={item.text}
                      onClick={() => handleNavigate(item.path)}
                      sx={{
                        color: isActive ? "hsl(var(--primary))" : "text.primary",
                        fontWeight: isActive ? 600 : 500,
                        textTransform: "none",
                        px: 2,
                        borderRadius: 2,
                        position: "relative",
                        "&:hover": {
                          backgroundColor: "hsl(var(--primary) / 0.08)",
                        },
                        "&::after": {
                          content: '""',
                          position: "absolute",
                          bottom: 0,
                          left: "50%",
                          transform: "translateX(-50%)",
                          width: isActive ? "80%" : "0%",
                          height: "3px",
                          backgroundColor: "hsl(var(--primary))",
                          transition: "width 0.3s ease",
                        },
                      }}
                    >
                      {item.text}
                    </Button>
                  )
                })}

                {showManagementDropdown && (
                  <>
                    <Button
                      onClick={handleManagementClick}
                      endIcon={<KeyboardArrowDown />}
                      sx={{
                        color: isManagementActive ? "hsl(var(--primary))" : "text.primary",
                        fontWeight: isManagementActive ? 600 : 500,
                        textTransform: "none",
                        px: 2,
                        borderRadius: 2,
                        position: "relative",
                        "&:hover": {
                          backgroundColor: "hsl(var(--primary) / 0.08)",
                        },
                        "&::after": {
                          content: '""',
                          position: "absolute",
                          bottom: 0,
                          left: "50%",
                          transform: "translateX(-50%)",
                          width: isManagementActive ? "80%" : "0%",
                          height: "3px",
                          backgroundColor: "hsl(var(--primary))",
                          transition: "width 0.3s ease",
                        },
                      }}
                    >
                      More
                    </Button>

                    <Menu
                      anchorEl={managementAnchor}
                      open={Boolean(managementAnchor)}
                      onClose={handleManagementClose}
                      anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
                      transformOrigin={{ vertical: "top", horizontal: "right" }}
                      sx={{
                        mt: 1,
                        "& .MuiPaper-root": {
                          minWidth: 220,
                          boxShadow: "0 4px 20px rgba(0,0,0,0.1)",
                          borderRadius: 2,
                        },
                      }}
                    >
                      <Box sx={{ px: 2, py: 1 }}>
                        <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 600 }}>
                          MANAGEMENT
                        </Typography>
                      </Box>
                      {effectiveManagementItems.map((item) => (
                        <MenuItem
                          key={item.text}
                          onClick={() => handleNavigate(item.path)}
                          selected={location.pathname === item.path}
                          sx={{ py: 1.5 }}
                        >
                          <ListItemIcon>
                            <item.icon fontSize="small" />
                          </ListItemIcon>
                          {item.text}
                        </MenuItem>
                      ))}
                    </Menu>
                  </>
                )}
              </Box>

              {(fullAccessRoles.includes(userRole) || tenantSupportMode) && (
                <Button
                  variant="contained"
                  startIcon={<AddCircleOutline />}
                  onClick={() => handleNavigate("/admin/create-job")}
                  sx={{
                    textTransform: "none",
                    backgroundColor: "hsl(var(--primary))",
                    color: "white",
                    px: 3,
                    borderRadius: 1,
                    fontWeight: 600,
                    boxShadow: "none",
                    "&:hover": {
                      backgroundColor: "hsl(var(--primary) / 0.9)",
                      boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
                    },
                    mr: 1,
                  }}
                >
                  Create Job
                </Button>
              )}
            </>
          )}

          <Box sx={{ flexGrow: isMobile ? 1 : 0 }} />

          <IconButton onClick={handleUserMenuClick} sx={{ ml: 1 }}>
            <Avatar sx={{ width: 36, height: 36, bgcolor: "hsl(var(--primary))" }}>
              <Person />
            </Avatar>
          </IconButton>

          {/* Mobile Navigation Menu */}
          <Menu
            anchorEl={mobileMenuAnchor}
            open={Boolean(mobileMenuAnchor)}
            onClose={handleMobileMenuClose}
            anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
            transformOrigin={{ vertical: "top", horizontal: "left" }}
            sx={{
              mt: 1,
              display: { lg: "none" },
              "& .MuiPaper-root": {
                minWidth: 280,
                maxWidth: "90vw",
                boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
                borderRadius: 2,
              },
            }}
          >
            <Box sx={{ py: 1 }}>
              {navItems.map((item) => {
                const isPayrollPath = item.path === "/admin/payroll"
                const isContactsNav = item.path === "/admin/contacts"
                const navSelected =
                  isContactsNav
                    ? location.pathname === "/admin/contacts" || location.pathname.startsWith("/admin/contacts/")
                    : location.pathname === item.path
                return isPayrollPath ? (
                  <Box key={item.text}>
                    <ListItemButton
                      onClick={() => {
                        setMobilePayrollOpen(!mobilePayrollOpen)
                        // if (!isPayrollSection) {
                        //   handleNavigate(item.path)
                        // }
                      }}
                      selected={isPayrollSection}
                      sx={{
                        mx: 1,
                        borderRadius: 1,
                        "&.Mui-selected": {
                          backgroundColor: "hsl(var(--primary) / 0.1)",
                          color: "hsl(var(--primary))",
                        },
                      }}
                    >
                      {/* <ListItemIcon sx={{ color: isPayrollSection ? "hsl(var(--primary))" : "inherit" }}>
                        <item.icon fontSize="small" />
                      </ListItemIcon> */}
                      {/* <ListItemText primary={item.text} /> */}
                      <ListItemText
                        primary="Payroll"
                        primaryTypographyProps={{ fontWeight: 500 }}
                      />
                      {mobilePayrollOpen ? <ExpandLess /> : <ExpandMore />}
                    </ListItemButton>
                    <Collapse in={mobilePayrollOpen} timeout="auto" unmountOnExit>
                      <List component="div" disablePadding>
                        {payrollSubNavItems.map((subItem) => (
                          <MenuItem
                            key={subItem.text}
                            onClick={() => handleNavigate(subItem.path)}
                            selected={location.pathname === subItem.path}
                            sx={{
                              py: 1.5,
                              pl: 4,
                              mx: 1,
                              borderRadius: 1,
                              "&.Mui-selected": {
                                backgroundColor: "hsl(var(--primary) / 0.1)",
                                color: "hsl(var(--primary))",
                              },
                            }}
                          >
                            <ListItemIcon
                              sx={{ color: location.pathname === subItem.path ? "hsl(var(--primary))" : "inherit" }}
                            >
                              <subItem.icon fontSize="small" />
                            </ListItemIcon>
                            <ListItemText
                              primary={subItem.text}
                              primaryTypographyProps={{ fontSize: "0.9rem" }}
                            />
                          </MenuItem>
                        ))}
                      </List>
                    </Collapse>
                  </Box>
                ) : (
                  <MenuItem
                    key={item.text}
                    onClick={() => handleNavigate(item.path)}
                    selected={navSelected}
                    sx={{
                      py: 1.5,
                      mx: 1,
                      borderRadius: 1,
                      "&.Mui-selected": {
                        backgroundColor: "hsl(var(--primary) / 0.1)",
                        color: "hsl(var(--primary))",
                      },
                    }}
                  >
                    <ListItemIcon sx={{ color: navSelected ? "hsl(var(--primary))" : "inherit" }}>
                      <item.icon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText primary={item.text} />
                  </MenuItem>
                )
              })}

              {showManagementDropdown && (
                <>
                  <Divider sx={{ my: 1 }} />

                  <ListItemButton
                    onClick={() => setMobileMoreOpen(!mobileMoreOpen)}
                    sx={{ mx: 1, borderRadius: 1 }}
                  >
                    <ListItemText
                      primary="More"
                      primaryTypographyProps={{ fontWeight: 500 }}
                    />
                    {mobileMoreOpen ? <ExpandLess /> : <ExpandMore />}
                  </ListItemButton>

                  <Collapse in={mobileMoreOpen} timeout="auto" unmountOnExit>
                    <List component="div" disablePadding>
                      {effectiveManagementItems.map((item) => (
                        <MenuItem
                          key={item.text}
                          onClick={() => handleNavigate(item.path)}
                          selected={location.pathname === item.path}
                          sx={{
                            py: 1.5,
                            pl: 4,
                            mx: 1,
                            borderRadius: 1,
                            "&.Mui-selected": {
                              backgroundColor: "hsl(var(--primary) / 0.1)",
                              color: "hsl(var(--primary))",
                            },
                          }}
                        >
                          <ListItemIcon
                            sx={{ color: location.pathname === item.path ? "hsl(var(--primary))" : "inherit" }}
                          >
                            <item.icon fontSize="small" />
                          </ListItemIcon>
                          <ListItemText
                            primary={item.text}
                            primaryTypographyProps={{ fontSize: "0.9rem" }}
                          />
                        </MenuItem>
                      ))}
                    </List>
                  </Collapse>
                </>
              )}

              {fullAccessRoles.includes(userRole) && (
                <>
                  <Divider sx={{ my: 1 }} />

                  <MenuItem
                    onClick={() => handleNavigate("/admin/create-job")}
                    selected={location.pathname === "/admin/create-job"}
                    sx={{
                      py: 1.5,
                      mx: 1,
                      borderRadius: 1,
                      backgroundColor: "hsl(var(--primary))",
                      color: "white",
                      "&:hover": {
                        backgroundColor: "hsl(var(--primary) / 0.9)",
                      },
                      "&.Mui-selected": {
                        backgroundColor: "hsl(var(--primary))",
                      },
                    }}
                  >
                    <ListItemIcon sx={{ color: "white" }}>
                      <AddCircleOutline fontSize="small" />
                    </ListItemIcon>
                    <ListItemText primary="Create Job" />
                  </MenuItem>
                </>
              )}
            </Box>
          </Menu>

          {/* User Menu */}
          <Menu
            anchorEl={userMenuAnchor}
            open={Boolean(userMenuAnchor)}
            onClose={handleUserMenuClose}
            anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
            transformOrigin={{ vertical: "top", horizontal: "right" }}
            sx={{
              mt: 1,
              "& .MuiPaper-root": {
                minWidth: 200,
                boxShadow: "0 4px 20px rgba(0,0,0,0.1)",
                borderRadius: 2,
              },
            }}
          >
            <Box sx={{ px: 2, py: 1.5, borderBottom: "1px solid", borderColor: "divider" }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                {userName}
              </Typography>
              <Chip 
                label={getRoleLabel(userRole)} 
                size="small" 
                color={getRoleColor(userRole)} 
                sx={{ mt: 0.5, height: 20 }} 
              />
            </Box>
            {fullAccessRoles.includes(userRole) && (
              <MenuItem onClick={handleSwitchToUser} sx={{ py: 1.5 }}>
                <ListItemIcon>
                  <Person fontSize="small" />
                </ListItemIcon>
                Switch to User
              </MenuItem>
            )}
            <Divider />
            <MenuItem onClick={handleLogout} sx={{ py: 1.5, color: "error.main" }}>
              <ListItemIcon>
                <Logout fontSize="small" color="error" />
              </ListItemIcon>
              Logout
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>
      )}

      <TenantModuleSwitcher />

      {/* Payroll Sub-Navigation */}
      {isPayrollSection && (
        <Box
          sx={{
            backgroundColor: "#073D7F",
            borderColor: "divider",
            position: "sticky",
            top: shouldHideNavbar ? 0 : 64,
            zIndex: 1200,
            boxShadow: "0 2px 4px rgba(0,0,0,0.05)",
          }}
        >
          {/* Desktop Navigation */}
          <Box
            sx={{
              display: { xs: "none", md: "flex" },
              gap: 0.5,
              px: 3,
              overflowX: "auto",
              "&::-webkit-scrollbar": {
                height: 4,
              },
              "&::-webkit-scrollbar-thumb": {
                backgroundColor: "rgba(255,255,255,0.3)",
                borderRadius: 2,
              },
            }}
          >
            {payrollSubNavItems.map((item) => (
              <Button
                key={item.text}
                onClick={() => handleNavigate(item.path)}
                startIcon={<item.icon sx={{ fontSize: 18 }} />}
                sx={{
                  color: location.pathname === item.path ? "hsl(var(--primary))" : "#FFFFFF",
                  fontWeight: location.pathname === item.path ? 600 : 400,
                  textTransform: "none",
                  fontSize: "0.875rem",
                  px: 2,
                  py: 0.7,
                  borderRadius: 0,
                  whiteSpace: "nowrap",
                  minWidth: "auto",
                  backgroundColor: location.pathname === item.path ? "white" : "transparent",
                  "&:hover": {
                    backgroundColor: location.pathname === item.path ? "white" : "rgba(255,255,255,0.1)",
                  },
                }}
              >
                {item.text}
              </Button>
            ))}
          </Box>

          {/* Mobile Navigation */}
          <Box sx={{ display: { xs: "block", md: "none" } }}>
            {/* Header */}
            {/* <Box sx={{ px: 2, py: 1, borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
              <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.8)", fontWeight: 600 }}>
                PAYROLL MODULE
              </Typography>
            </Box> */}
            
            {/* Mobile Navigation Items */}
            <Box
              sx={{
                display: "flex",
                overflowX: "auto",
                "&::-webkit-scrollbar": {
                  height: 4,
                },
                "&::-webkit-scrollbar-thumb": {
                  backgroundColor: "rgba(255,255,255,0.3)",
                  borderRadius: 2,
                },
              }}
            >
              {payrollSubNavItems.map((item) => (
                <Button
                  key={item.text}
                  onClick={() => handleNavigate(item.path)}
                  startIcon={<item.icon sx={{ fontSize: 16 }} />}
                  sx={{
                    color: location.pathname === item.path ? "hsl(var(--primary))" : "#FFFFFF",
                    fontWeight: location.pathname === item.path ? 600 : 400,
                    textTransform: "none",
                    fontSize: "0.75rem",
                    borderRadius: 0,
                    whiteSpace: "nowrap",
                    minWidth: "auto",
                    backgroundColor: location.pathname === item.path ? "white" : "transparent",
                    "&:hover": {
                      backgroundColor: location.pathname === item.path ? "white" : "rgba(255,255,255,0.1)",
                    },
                  }}
                >
                  {item.text}
                </Button>
              ))}
            </Box>
          </Box>
        </Box>
      )}

      {/* Main Content Area */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: { xs: 2, sm: 3 },
          backgroundColor: "hsl(var(--muted) / 0.3)",
          minHeight: "calc(100vh - 64px)",
        }}
      >
        {/* Breadcrumb for Payroll Section */}
        {/* {isPayrollSection && (
          <Breadcrumbs
            separator={<NavigateNext fontSize="small" />}
            sx={{ mb: 3 }}
          >
            <Link
              component="button"
              variant="body2"
              onClick={() => handleNavigate("/admin/payroll")}
              sx={{
                textDecoration: "none",
                color: "text.secondary",
                "&:hover": {
                  color: "hsl(var(--primary))",
                  textDecoration: "underline",
                },
              }}
            >
              Payroll
            </Link>
            <Typography variant="body2" sx={{ color: "text.primary", fontWeight: 600 }}>
              {getPayrollBreadcrumb()}
            </Typography>
          </Breadcrumbs>
        )} */}
        {children}
      </Box>
      <AdminFooter />
    </Box>
  )
}