"use client"

import { useState, useEffect, useMemo } from "react"
import { useDispatch } from "react-redux"
import moment from "moment-timezone"
import { useUpdateJobMutation, useGetJobDetailsQuery, jobsApi } from "../../../store/api/jobsApi"
import { useRescheduleQuoteFromJobMutation } from "../../../store/api/user/quoteApi"
import { slotWallClockAsUtcIso } from "../../../utils/scheduleIso"
import QuoteCalendarScheduler from "../../user/QuoteCalendarScheduler"
import { jobSurchargeAmount, overlayJobDetail } from "../../../utils/jobPricing"
import { resolveJobInvoiceUrl } from "../../../utils/invoiceLink"
import { useToast } from "@/hooks/use-toast"
import { useAccountTimezone } from "@/hooks/useAccountTimezone"
import { useMoneyFormatter } from "@/hooks/useMoneyFormatter"
import {
  Card,
  CardContent,
  Typography,
  Box,
  Chip,
  IconButton,
  Collapse,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
} from "@mui/material"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Edit,
  Trash2,
  Phone,
  Mail,
  MapPin,
  User,
  Calendar,
  Clock,
  MoreVertical,
  ChevronDown,
  ChevronUp,
  RotateCw,
  FileText,
  ExternalLink,
  Percent,
  History,
} from "lucide-react"
import { Input } from "@/components/ui/input"
import DeleteJobDialog from "./DeleteJobDialog"
import StatusChangeConfirmationDialog from "./StatusChangeConfirmationDialog"
import { JobCompletionDetails } from "./JobCompletionDetails"
import { ImageViewer } from "@/components/ui/ImageViewer"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

export function JobCard({
  job,
  onUpdate,
  onEdit,
  onDelete,
  users = [],
  accountTimezone: accountTimezoneProp,
  embeddedInDialog = false,
  /** When true: view-only (e.g. contact CRM). No status edits, discount, delete, or completion uploads. */
  readOnly = false,
  /** Skip GET /jobs/:id/ when parent already loaded public job details (portal). */
  skipJobDetailsQuery = false,
  /** Client portal: show reschedule flow (POST /quote/reschedule/from-job/). */
  clientPortalReschedule = false,
}) {
  const [updating, setUpdating] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [imagesRequiredDialogOpen, setImagesRequiredDialogOpen] = useState(false)
  const [notesExpanded, setNotesExpanded] = useState(false)
  const [statusChangeDialogOpen, setStatusChangeDialogOpen] = useState(false)
  const [pendingStatus, setPendingStatus] = useState(null)
  const [displayStatus, setDisplayStatus] = useState(job?.status)
  const [selectedImage, setSelectedImage] = useState(null)
  const [discountType, setDiscountType] = useState(job?.discount_type ?? null)
  const [discountValue, setDiscountValue] = useState(
    job?.discount_type ? String(job?.discount_value ?? "") : ""
  )
  const [discountSaving, setDiscountSaving] = useState(false)
  const [rescheduleDialogOpen, setRescheduleDialogOpen] = useState(false)
  const [rescheduleNotes, setRescheduleNotes] = useState("")
  const [schedulerResetKey, setSchedulerResetKey] = useState(0)
  const [updateJob] = useUpdateJobMutation()
  const [rescheduleQuoteFromJob, { isLoading: isRescheduleSubmitting }] = useRescheduleQuoteFromJobMutation()
  const dispatch = useDispatch()
  const { toast } = useToast()

  const jobId = job?.job_id || job?.id
  const { data: jobDetailsData } = useGetJobDetailsQuery(jobId, { skip: !jobId || skipJobDetailsQuery })
  const accountTimezone = useAccountTimezone(
    accountTimezoneProp ?? jobDetailsData?.account_timezone ?? job?.account_timezone,
  )
  const { formatMoney: formatPrice, currencySymbol } = useMoneyFormatter()
  /** Merge detail query without losing list-only pricing (detail often nulls/omits total_surcharge). */
  const pricingJob = useMemo(() => {
    if (!job) return null
    return overlayJobDetail(job, jobDetailsData)
  }, [job, jobDetailsData])
  const invoiceUrl = resolveJobInvoiceUrl(pricingJob || job)
  const uploadedJobImages = jobDetailsData?.images ?? job?.images ?? []
  const hasUploadedJobImages = Array.isArray(uploadedJobImages) && uploadedJobImages.length > 0

  // Update displayStatus when job status changes externally
  useEffect(() => {
    if (job?.status) {
      setDisplayStatus(job.status)
    }
  }, [job?.status])

  // Sync discount from job when job changes (e.g. after apply)
  useEffect(() => {
    setDiscountType(job?.discount_type ?? null)
    setDiscountValue(job?.discount_type ? String(job?.discount_value ?? "") : "")
  }, [job?.discount_type, job?.discount_value])

  const submissionIdForReschedule = job?.submission_id ?? job?.submission ?? null
  const persistedSnapshotId =
    jobDetailsData?.persisted_snapshot_id ?? job?.persisted_snapshot_id ?? null
  const statusLower = String(job?.status || "").toLowerCase()
  const canOpenReschedule =
    clientPortalReschedule &&
    readOnly &&
    submissionIdForReschedule &&
    statusLower === "completed"

  useEffect(() => {
    if (rescheduleDialogOpen) {
      setRescheduleNotes("")
      setSchedulerResetKey((k) => k + 1)
    }
  }, [rescheduleDialogOpen])

  const handlePortalRescheduleSlot = async (slotIso) => {
    if (!slotIso || !jobId) return
    try {
      await rescheduleQuoteFromJob({
        jobId,
        scheduled_date: slotWallClockAsUtcIso(slotIso),
        notes: rescheduleNotes.trim() || undefined,
      }).unwrap()
      toast({
        title: "Repeat job request submitted",
        description: "Your requested date and time will be confirmed by our team.",
      })
      setRescheduleDialogOpen(false)
      dispatch(jobsApi.util.invalidateTags([{ type: "Job", id: jobId }, { type: "Job", id: `public:${jobId}` }]))
    } catch (err) {
      const msg =
        err?.data?.detail ||
        err?.data?.message ||
        (typeof err?.data === "string" ? err.data : null) ||
        err?.error ||
        "Could not submit repeat job request."
      toast({
        title: "Request failed",
        description: String(msg),
        variant: "destructive",
      })
    }
  }

  const getPriorityColor = (priority) => {
    const priorityStr = String(priority).toLowerCase()
    if (priorityStr === "high" || priority >= 3) return "error"
    if (priorityStr === "medium" || priority === 2) return "warning"
    return "success"
  }

  const getPriorityLabel = (priority) => {
    const priorityStr = String(priority).toLowerCase()
    if (priorityStr === "high" || priority >= 3) return "High"
    if (priorityStr === "medium" || priority === 2) return "Medium"
    return "Low"
  }

  const formatDate = (dateString) => {
    if (!dateString) return "Not scheduled"
    const m = moment.utc(dateString)
    return m.format("MMM D, YYYY · h:mm A")
  }

  // Normalize name to Title Case
  const toTitleCase = (str) => {
    if (!str) return ""
    return str.toLowerCase().split(' ').map(word =>
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ')
  }

  // Treat N/A, n.a., empty as no business name so we don't show "Business Name N/a"
  const hasValidCompanyName = (name) => {
    if (name == null || typeof name !== "string") return false
    const t = name.trim()
    if (!t) return false
    const lower = t.toLowerCase()
    if (lower === "n/a" || lower === "na" || lower === "n.a." || lower === "n.a" || lower === "none") return false
    return true
  }

  const handleStatusChange = (newStatus) => {
    // Don't proceed if status hasn't actually changed
    if (newStatus === job?.status) {
      return
    }

    // Check if status change requires confirmation
    if (newStatus === "completed" || newStatus === "cancelled") {
      if (newStatus === "completed" && !hasUploadedJobImages) {
        setImagesRequiredDialogOpen(true)
        return
      }
      setPendingStatus(newStatus)
      setStatusChangeDialogOpen(true)
      // Keep the current display status until confirmed
    } else {
      // For other statuses, update directly
      setDisplayStatus(newStatus)
      updateJobStatus(newStatus)
    }
  }

  const updateJobStatus = async (newStatus) => {
    if (!job) return
    
    const jobId = job.job_id || job.id
    if (!jobId) {
      return
    }
    
    setUpdating(true)
    try {
      const result = await updateJob({
        id: jobId,
        status: newStatus,
      }).unwrap()
      
      // Update display status first
      setDisplayStatus(newStatus)
      
      // Close the status change dialog
      setStatusChangeDialogOpen(false)
      setPendingStatus(null)
      
      // Update the job data via onUpdate callback
      if (onUpdate) {
        onUpdate(result)
      }
      
      // Small delay to ensure dialog closes before any other updates
      await new Promise(resolve => setTimeout(resolve, 100))
    } catch (error) {
      // Keep dialog open on error so user can retry
      toast({
        title: "Error",
        description: "Failed to update job status. Please try again.",
        variant: "destructive",
      })
    } finally {
      setUpdating(false)
    }
  }

  const handleConfirmStatusChange = async () => {
    if (pendingStatus) {
      if (pendingStatus === "completed" && !hasUploadedJobImages) {
        setStatusChangeDialogOpen(false)
        setPendingStatus(null)
        setDisplayStatus(job?.status)
        setImagesRequiredDialogOpen(true)
        return
      }
      await updateJobStatus(pendingStatus)
    }
  }

  const handleCancelStatusChange = () => {
    setStatusChangeDialogOpen(false)
    setPendingStatus(null)
    // Reset display status to current job status
    setDisplayStatus(job?.status)
  }

  const assignedUserNames = job.assignments
    ?.map((assignment) => {
        if (assignment.user) {
          if (assignment.first_name || assignment.last_name) {
            const fullName = `${assignment.first_name || ""} ${assignment.last_name || ""}`.trim()
            return toTitleCase(fullName)
          } else if (assignment.email) {
            return assignment.email
          }
        }
      const email = assignment.user_email || assignment.user || ""
      return email.includes("@") ? email : toTitleCase(email)
    })
    .filter((name) => name)
    .join(", ") || "Unassigned"

  // Calculate subtotal from items if available (prefer merged detail payload)
  const servicesTotal =
    pricingJob?.items?.reduce((sum, item) => sum + (parseFloat(item.price) || 0), 0) ||
    parseFloat(pricingJob?.total_price) ||
    0

  // Discount: amount (fixed $) or percentage (%). Payload: discount_type ("amount" | "percentage" | null), discount_value (string)
  const numDiscountValue = parseFloat(discountValue) || 0
  const discountAmount =
    discountType === "amount"
      ? numDiscountValue
      : discountType === "percentage"
        ? (servicesTotal * numDiscountValue) / 100
        : 0
  const surchargeAmount = jobSurchargeAmount(pricingJob)
  const discountedBase = Math.max(0, servicesTotal - discountAmount)
  const finalTotal = discountedBase + surchargeAmount
  const showSubtotalBeforeAdjustments =
    discountAmount > 0 || surchargeAmount > 0

  const handleApplyDiscount = async () => {
    const jobId = job?.job_id || job?.id
    if (!jobId) return
    setDiscountSaving(true)
    try {
      const payload =
        !discountType || (discountType !== "amount" && discountType !== "percentage")
          ? { discount_type: null, discount_value: "0.00" }
          : discountType === "amount"
            ? { discount_type: "amount", discount_value: String(Number(numDiscountValue.toFixed(2))) }
            : { discount_type: "percentage", discount_value: String(Number(numDiscountValue.toFixed(2))) }
      const result = await updateJob({ id: jobId, ...payload }).unwrap()
      if (onUpdate) onUpdate(result)
      toast({ title: "Discount updated", description: "Job discount has been saved." })
    } catch (err) {
      toast({
        title: "Error",
        description: "Failed to update discount. Please try again.",
        variant: "destructive",
      })
    } finally {
      setDiscountSaving(false)
    }
  }

  // Check if job is recurring based on job_type
  const isRecurring = job.job_type === "recurring" || job.is_recurring

  // Build status badges (max 3) — job status is controlled by the header selector, not duplicated here
  // Priority order: Recurring (if applicable), Priority
  const statusBadges = []
  // Always show recurring if it's a recurring job (business-critical)
  if (isRecurring && statusBadges.length < 3) {
    statusBadges.push({
      label: "Recurring",
      color: "#6366f1", // Indigo color for better visibility
      key: "recurring"
    })
  }
  if (job.priority && statusBadges.length < 3) {
    statusBadges.push({
      label: `${getPriorityLabel(job.priority)} Priority`,
      color: getPriorityColor(job.priority),
      key: "priority"
    })
  }

  return (
    <>
      <Card
        elevation={embeddedInDialog ? 0 : undefined}
        sx={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          ...(embeddedInDialog && {
            boxShadow: 'none',
            bgcolor: 'transparent',
          }),
        }}
      >
        <CardContent
          sx={{
            p: embeddedInDialog ? 0 : 3,
            flexGrow: 1,
            display: 'flex',
            flexDirection: 'column',
            ...(embeddedInDialog && { '&:last-child': { pb: 0 } }),
          }}
        >
          {/* Title & customer — full width, no competing controls */}
          <Box sx={{ mb: 1.5, minWidth: 0 }}>
              <Typography 
                variant="h6" 
                sx={{ 
                  fontWeight: 600, 
                  mb: 0.5,
                  lineHeight: 1.3,
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  minHeight: { xs: 'auto', sm: '32px' }, // Responsive minimum height
                }}
              >
                {job.title || "Untitled Job"}
              </Typography>
              {/* Company Name - Highlighted if exists (hide when value is N/A or empty) */}
              {hasValidCompanyName(job.contact_details?.company_name) ? (
                <>
                  <Box sx={{ mb: 0.5 }}>
                    <Typography 
                      variant="caption" 
                      sx={{ 
                        color: 'text.secondary', 
                        fontWeight: 500,
                        fontSize: '0.7rem',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                        display: 'block',
                        mb: 0.25,
                      }}
                    >
                      Business Name
                    </Typography>
                    {job.ghl_contact_id ? (
                      <Typography 
                        component="a"
                        href={`${import.meta.env.VITE_SERVICE_PILOT_APP_URL || 'https://app.theservicepilot.com'}/v2/location/${import.meta.env.VITE_LOCATION_ID || 'b8qvo7VooP3JD3dIZU42'}/contacts/detail/${job.ghl_contact_id}/`}
                        target="_blank"
                        rel="noopener noreferrer"
                        variant="body1" 
                        sx={{ 
                          color: 'primary.main', 
                          fontWeight: 600,
                          lineHeight: 1.3,
                          minHeight: { xs: 'auto', sm: '24px' },
                          textDecoration: 'none',
                          cursor: 'pointer',
                          display: 'block',
                          '&:hover': {
                            textDecoration: 'underline',
                          },
                        }}
                      >
                        {toTitleCase(job.contact_details.company_name)}
                      </Typography>
                    ) : (
                      <Typography 
                        variant="body1" 
                        sx={{ 
                          color: 'text.primary', 
                          fontWeight: 600,
                          lineHeight: 1.3,
                          minHeight: { xs: 'auto', sm: '24px' },
                        }}
                      >
                        {toTitleCase(job.contact_details.company_name)}
                      </Typography>
                    )}
                  </Box>
                  {/* Contact Name - Secondary */}
                  {job.customer_name && (
                    <Typography 
                      component="a"
                      href={`${import.meta.env.VITE_SERVICE_PILOT_APP_URL || 'https://app.theservicepilot.com'}/v2/location/${import.meta.env.VITE_LOCATION_ID || 'b8qvo7VooP3JD3dIZU42'}/contacts/detail/${job.ghl_contact_id}/`}
                      target="_blank"
                      rel="noopener noreferrer"
                      variant="body2" 
                      sx={{ 
                        color: 'text.secondary', 
                        fontWeight: 400,
                        lineHeight: 1.3,
                        fontSize: '0.875rem',
                        textDecoration: 'none',
                        cursor: 'pointer',
                        display: 'block',
                        '&:hover': {
                          textDecoration: 'underline',
                          color: 'text.primary',
                        },
                      }}
                    >
                      {toTitleCase(job.customer_name)}
                    </Typography>
                  )}
                </>
              ) : (
                /* Fallback to customer_name when no valid company_name */
                job.customer_name && job.ghl_contact_id ? (
                  <Typography 
                    component="a"
                    href={`${import.meta.env.VITE_SERVICE_PILOT_APP_URL || 'https://app.theservicepilot.com'}/v2/location/${import.meta.env.VITE_LOCATION_ID || 'b8qvo7VooP3JD3dIZU42'}/contacts/detail/${job.ghl_contact_id}/`}
                    target="_blank"
                    rel="noopener noreferrer"
                    variant="body1" 
                    sx={{ 
                      color: 'primary.main', 
                      fontWeight: 500,
                      lineHeight: 1.3,
                      minHeight: { xs: 'auto', sm: '24px' },
                      textDecoration: 'none',
                      cursor: 'pointer',
                      '&:hover': {
                        textDecoration: 'underline',
                      },
                    }}
                  >
                    {toTitleCase(job.customer_name)}
                  </Typography>
                ) : (
                  <Typography 
                    variant="body1" 
                    sx={{ 
                      color: 'text.secondary', 
                      fontWeight: 500,
                      lineHeight: 1.3,
                      minHeight: { xs: 'auto', sm: '24px' },
                    }}
                  >
                    {job.customer_name ? toTitleCase(job.customer_name) : '\u00A0'}
                  </Typography>
                )
              )}
            </Box>

          {/* Toolbar: meta chips (left) · compact status + actions (right) — one row, CRM-style */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 1.5,
              mb: 3,
              minWidth: 0,
              flexWrap: 'nowrap',
              overflowX: 'auto',
              WebkitOverflowScrolling: 'touch',
              pb: 1.5,
              borderBottom: '1px solid',
              borderColor: 'divider',
            }}
          >
            <Box
              sx={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 1,
                alignItems: 'center',
                minWidth: 0,
                flex: '1 1 auto',
              }}
            >
              {statusBadges.length > 0 ? (
                statusBadges.map((badge) => (
                  <Chip
                    key={badge.key}
                    label={badge.label}
                    size="small"
                    sx={{
                      bgcolor: badge.color === "error" || badge.color === "warning" || badge.color === "success"
                        ? undefined
                        : badge.color,
                      color: badge.color === "error" || badge.color === "warning" || badge.color === "success"
                        ? undefined
                        : "white",
                      textTransform: "capitalize",
                      fontSize: "0.75rem",
                      height: "24px",
                      fontWeight: 500,
                    }}
                    color={badge.color === "error" || badge.color === "warning" || badge.color === "success"
                      ? badge.color
                      : undefined}
                  />
                ))
              ) : null}
            </Box>
            <Box
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 0.5,
                flexShrink: 0,
              }}
            >
              {readOnly ? (
                <Chip
                  size="small"
                  label={String(displayStatus || job?.status || '').replace(/_/g, ' ')}
                  sx={{ textTransform: 'capitalize', fontWeight: 600 }}
                  color={
                    ['completed', 'cancelled'].includes(String(job?.status || '').toLowerCase())
                      ? 'default'
                      : ['in_progress', 'on_the_way'].includes(String(job?.status || '').toLowerCase())
                        ? 'primary'
                        : 'warning'
                  }
                  variant="outlined"
                />
              ) : (
                <>
                  <Select
                    value={displayStatus || job?.status}
                    onValueChange={handleStatusChange}
                    disabled={updating}
                  >
                    <SelectTrigger
                      className="h-8 w-[148px] shrink-0 px-2.5 text-xs font-medium capitalize shadow-none"
                      aria-label="Job status"
                    >
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent className="z-[1300]">
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="confirmed">Confirmed</SelectItem>
                      <SelectItem value="service_due">Service Due</SelectItem>
                      <SelectItem value="on_the_way">On The Way</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="onhold">On Hold</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                  <IconButton
                    size="small"
                    onClick={() => onEdit?.(job)}
                    title="Edit job"
                    aria-label="Edit job"
                    sx={{
                      color: 'text.secondary',
                      minWidth: 36,
                      minHeight: 36,
                    }}
                  >
                    <Edit size={18} />
                  </IconButton>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <IconButton
                        size="small"
                        title="More options"
                        aria-label="More options"
                        sx={{
                          color: 'text.secondary',
                          minWidth: 36,
                          minHeight: 36,
                        }}
                      >
                        <MoreVertical size={18} />
                      </IconButton>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="z-[1300]">
                      <DropdownMenuItem onClick={() => setDeleteDialogOpen(true)}>
                        <Trash2 size={16} className="mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </>
              )}
            </Box>
          </Box>

          {/* 2-Column Layout */}
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2, mb: 3 }}>
            {/* Left Column - Contact Info */}
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, textTransform: 'uppercase', mb: 0.5, fontSize: '0.7rem', letterSpacing: '0.5px' }}>
                Contact
              </Typography>
              
              {/* Company Name - only if valid (hide when N/A or empty) */}
              {hasValidCompanyName(job.contact_details?.company_name) ? (
                <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <User size={16} style={{ color: 'rgba(0, 0, 0, 0.54)', flexShrink: 0 }} />
                    <Box sx={{ display: "flex", flexDirection: "column", gap: 0.25 }}>
                      <Typography 
                        variant="caption" 
                        sx={{ 
                          color: 'text.secondary', 
                          fontWeight: 500,
                          fontSize: '0.7rem',
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px',
                          lineHeight: 1,
                        }}
                      >
                        Business Name
                      </Typography>
                      {job.ghl_contact_id ? (
                        <Typography 
                          component="a"
                          href={`${import.meta.env.VITE_SERVICE_PILOT_APP_URL || 'https://app.theservicepilot.com'}/v2/location/${import.meta.env.VITE_LOCATION_ID || 'b8qvo7VooP3JD3dIZU42'}/contacts/detail/${job.ghl_contact_id}/`}
                          target="_blank"
                          rel="noopener noreferrer"
                          variant="body2" 
                          sx={{ 
                            fontSize: '0.875rem',
                            color: 'primary.main',
                            fontWeight: 600,
                            textDecoration: 'none',
                            cursor: 'pointer',
                            '&:hover': {
                              textDecoration: 'underline',
                            },
                          }}
                        >
                          {toTitleCase(job.contact_details.company_name)}
                        </Typography>
                      ) : (
                        <Typography variant="body2" sx={{ fontSize: '0.875rem', fontWeight: 600 }}>
                          {toTitleCase(job.contact_details.company_name)}
                        </Typography>
                      )}
                    </Box>
                  </Box>
                  {/* Contact Name - Secondary */}
                  {job.customer_name && (
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1, pl: '24px' }}>
                      {job.ghl_contact_id ? (
                        <Typography 
                          component="a"
                          href={`${import.meta.env.VITE_SERVICE_PILOT_APP_URL || 'https://app.theservicepilot.com'}/v2/location/${import.meta.env.VITE_LOCATION_ID || 'b8qvo7VooP3JD3dIZU42'}/contacts/detail/${job.ghl_contact_id}/`}
                          target="_blank"
                          rel="noopener noreferrer"
                          variant="body2" 
                          sx={{ 
                            fontSize: '0.8125rem',
                            color: 'text.secondary',
                            textDecoration: 'none',
                            cursor: 'pointer',
                            '&:hover': {
                              textDecoration: 'underline',
                              color: 'text.primary',
                            },
                          }}
                        >
                          {toTitleCase(job.customer_name)}
                        </Typography>
                      ) : (
                        <Typography variant="body2" sx={{ fontSize: '0.8125rem', color: 'text.secondary' }}>
                          {toTitleCase(job.customer_name)}
                        </Typography>
                      )}
                    </Box>
                  )}
                </Box>
              ) : (
                /* Fallback to customer_name when no valid company_name */
                job.customer_name && (
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <User size={16} style={{ color: 'rgba(0, 0, 0, 0.54)', flexShrink: 0 }} />
                    {job.ghl_contact_id ? (
                      <Typography 
                        component="a"
                        href={`${import.meta.env.VITE_SERVICE_PILOT_APP_URL || 'https://app.theservicepilot.com'}/v2/location/${import.meta.env.VITE_LOCATION_ID || 'b8qvo7VooP3JD3dIZU42'}/contacts/detail/${job.ghl_contact_id}/`}
                        target="_blank"
                        rel="noopener noreferrer"
                        variant="body2" 
                        sx={{ 
                          fontSize: '0.875rem',
                          color: 'primary.main',
                          textDecoration: 'none',
                          cursor: 'pointer',
                          '&:hover': {
                            textDecoration: 'underline',
                          },
                        }}
                      >
                        {toTitleCase(job.customer_name)}
                      </Typography>
                    ) : (
                      <Typography variant="body2" sx={{ fontSize: '0.875rem' }}>
                        {toTitleCase(job.customer_name)}
                      </Typography>
                    )}
                  </Box>
                )
              )}

              {job.customer_address && (
                <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1 }}>
                  <MapPin size={16} style={{ color: 'rgba(0, 0, 0, 0.54)', flexShrink: 0, marginTop: '2px' }} />
                  <Typography
                    variant="body2"
                    sx={{
                      fontSize: '0.875rem',
                      fontWeight: 400,
                      cursor: "pointer",
                      color: "primary.main",
                      maxWidth: '200px',
                      lineHeight: 1.4,
                      "&:hover": { textDecoration: "underline" },
                    }}
                    onClick={() =>
                      window.open(
                        `${import.meta.env.VITE_GOOGLE_MAPS_SEARCH_URL || 'https://www.google.com/maps/search/?api=1&query='}${encodeURIComponent(job.customer_address)}`,
                        "_blank",
                      )
                    }
                  >
                    {job.customer_address}
                  </Typography>
                </Box>
              )}

              {job.customer_phone && (
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <Phone size={16} style={{ color: 'rgba(0, 0, 0, 0.54)', flexShrink: 0 }} />
                  <Typography
                    variant="body2"
                    component="a"
                    href={`tel:${job.customer_phone}`}
                    sx={{ 
                      fontSize: '0.875rem',
                      color: "primary.main", 
                      textDecoration: "none", 
                      "&:hover": { textDecoration: "underline" } 
                    }}
                  >
                    {job.customer_phone}
                  </Typography>
                </Box>
              )}

              {job.customer_email && (
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <Mail size={16} style={{ color: 'rgba(0, 0, 0, 0.54)', flexShrink: 0 }} />
                  <Typography
                    variant="body2"
                    component="a"
                    href={`mailto:${job.customer_email}`}
                    sx={{ 
                      fontSize: '0.875rem',
                      color: "primary.main", 
                      textDecoration: "none", 
                      "&:hover": { textDecoration: "underline" } 
                    }}
                  >
                    {job.customer_email}
                  </Typography>
                </Box>
              )}
            </Box>

            {/* Right Column - Schedule & Assignment */}
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, textTransform: 'uppercase', mb: 0.5, fontSize: '0.7rem', letterSpacing: '0.5px' }}>
                Schedule
              </Typography>

              {job.scheduled_at && (
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <Calendar size={16} style={{ color: 'rgba(0, 0, 0, 0.54)', flexShrink: 0 }} />
                  <Typography variant="body2" sx={{ fontSize: '0.875rem' }}>
                    {formatDate(job.scheduled_at)}
                  </Typography>
                </Box>
              )}

              {job.duration_hours && (
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <Clock size={16} style={{ color: 'rgba(0, 0, 0, 0.54)', flexShrink: 0 }} />
                  <Typography variant="body2" sx={{ fontSize: '0.875rem' }}>
                    {job.duration_hours} hrs
                  </Typography>
                </Box>
              )}

              <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1 }}>
                <User size={16} style={{ color: 'rgba(0, 0, 0, 0.54)', flexShrink: 0, marginTop: '2px' }} />
                <Typography variant="body2" sx={{ fontSize: '0.875rem', lineHeight: 1.5 }}>
                  {assignedUserNames}
                </Typography>
              </Box>

              {clientPortalReschedule && readOnly && (
                <Box sx={{ mt: 1.5 }}>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!canOpenReschedule || isRescheduleSubmitting}
                    title={
                      !submissionIdForReschedule
                        ? "This job cannot be requested again online (no linked quote submission)."
                        : statusLower !== "completed"
                          ? "Only completed jobs can be requested again."
                          : undefined
                    }
                    onClick={() => setRescheduleDialogOpen(true)}
                  >
                    Request This Job Again
                  </Button>
                </Box>
              )}
            </Box>
          </Box>

          <Divider sx={{ my: 2 }} />

          {/* Services & Pricing - Consistent structure */}
            <Box sx={{ mb: 3 }}>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700, textTransform: 'uppercase', mb: 1.5, display: 'block', letterSpacing: '0.5px', fontSize: '0.7rem' }}>
                Services
              </Typography>
            {job.items && job.items.length > 0 ? (
              <>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, minHeight: '60px' }}>
                {job.items.map((item, index) => {
                  const serviceName = item.service_name || item.custom_name || "Unknown Service"
                  const itemPrice = parseFloat(item.price) || 0
                  return (
                    <Box key={item.id || index} sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <Typography variant="body2" sx={{ fontSize: '0.875rem', flex: 1, fontWeight: 500, color: 'text.primary' }}>
                        {serviceName}
                      </Typography>
                      <Typography variant="body2" sx={{ fontSize: '0.875rem', color: "text.secondary", ml: 2, fontWeight: 500 }}>
                        {formatPrice(itemPrice)}
                      </Typography>
                    </Box>
                  )
                })}
              </Box>
              {/* Discount section — editors hidden in read-only */}
              {!readOnly && (
              <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid', borderColor: 'divider' }}>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, textTransform: 'uppercase', mb: 1, display: 'block', fontSize: '0.7rem', letterSpacing: '0.5px' }}>
                  Discount
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
                  <Select
                    value={discountType === null ? "none" : discountType}
                    onValueChange={(v) => {
                      setDiscountType(v === "none" ? null : v)
                      if (v === "none") setDiscountValue("")
                    }}
                    disabled={discountSaving}
                  >
                    <SelectTrigger className="w-[120px] h-9">
                      <SelectValue placeholder="Type" />
                    </SelectTrigger>
                    <SelectContent className="z-[1300]">
                      <SelectItem value="none">None</SelectItem>
                      <SelectItem value="amount">Amount ({currencySymbol})</SelectItem>
                      <SelectItem value="percentage">Percentage (%)</SelectItem>
                    </SelectContent>
                  </Select>
                  {discountType === null && (job?.discount_type === "amount" || job?.discount_type === "percentage") && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={handleApplyDiscount}
                      disabled={discountSaving}
                    >
                      {discountSaving ? "Saving…" : "Clear discount"}
                    </Button>
                  )}
                  {(discountType === "amount" || discountType === "percentage") && (
                    <>
                      <Box sx={{ display: 'flex', alignItems: 'center', position: 'relative' }}>
                        {discountType === "amount" && (
                          <span
                            style={{
                              position: 'absolute',
                              left: 10,
                              color: 'rgba(0,0,0,0.5)',
                              pointerEvents: 'none',
                              fontSize: 13,
                              fontWeight: 500,
                            }}
                          >
                            {currencySymbol}
                          </span>
                        )}
                        {discountType === "percentage" && (
                          <Percent size={14} style={{ position: 'absolute', right: 10, color: 'rgba(0,0,0,0.5)', pointerEvents: 'none' }} />
                        )}
                        <Input
                          type="number"
                          min={0}
                          max={discountType === "percentage" ? 100 : undefined}
                          step={discountType === "amount" ? 0.01 : 1}
                          placeholder={discountType === "amount" ? "0.00" : "0"}
                          value={discountValue}
                          onChange={(e) => setDiscountValue(e.target.value)}
                          disabled={discountSaving}
                          className={discountType === "amount" ? "w-[100px] h-9 pl-7" : "w-[80px] h-9 pr-7"}
                        />
                      </Box>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={handleApplyDiscount}
                        disabled={discountSaving || (discountType === "amount" && numDiscountValue <= 0) || (discountType === "percentage" && (numDiscountValue <= 0 || numDiscountValue > 100))}
                      >
                        {discountSaving ? "Saving…" : "Apply"}
                      </Button>
                    </>
                  )}
                </Box>
              </Box>
              )}
              <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid', borderColor: 'divider', display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                {showSubtotalBeforeAdjustments && (
                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <Typography variant="body2" sx={{ fontSize: '0.875rem', fontWeight: 500, color: 'text.secondary' }}>
                      Subtotal
                    </Typography>
                    <Typography variant="body2" sx={{ fontSize: '0.875rem', color: "text.secondary", fontWeight: 500 }}>
                      {formatPrice(servicesTotal)}
                    </Typography>
                  </Box>
                )}
                {discountAmount > 0 && (
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="body2" sx={{ fontSize: '0.875rem', fontWeight: 500, color: 'error.main' }}>
                      Discount {discountType === "percentage" ? `(${numDiscountValue}%)` : ""}
                    </Typography>
                    <Typography variant="body2" sx={{ fontSize: '0.875rem', color: "error.main", fontWeight: 500 }}>
                      -{formatPrice(discountAmount)}
                    </Typography>
                  </Box>
                )}
                {surchargeAmount > 0 && (
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="body2" sx={{ fontSize: '0.875rem', fontWeight: 500, color: 'text.secondary' }}>
                      Surcharge
                    </Typography>
                    <Typography variant="body2" sx={{ fontSize: '0.875rem', color: "text.secondary", fontWeight: 500 }}>
                      {formatPrice(surchargeAmount)}
                    </Typography>
                  </Box>
                )}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="body2" sx={{ fontSize: '0.875rem', fontWeight: 600 }}>
                    Total
                  </Typography>
                  <Typography variant="body2" sx={{ fontSize: '0.875rem', fontWeight: 700, color: "success.main" }}>
                    {formatPrice(finalTotal)}
                  </Typography>
                </Box>
              </Box>
              </>
            ) : (
              <Box sx={{ minHeight: '60px', display: 'flex', alignItems: 'center' }}>
                <Typography variant="body2" sx={{ fontSize: '0.875rem', color: 'text.secondary', fontStyle: 'italic' }}>
                  No services
                </Typography>
            </Box>
          )}
          </Box>

          {/* Invoice URL - Only show for completed jobs - Fixed height */}
          <Box sx={{ mb: 3, minHeight: job.status === "completed" && invoiceUrl ? '100px' : '0px' }}>
            {job.status === "completed" && invoiceUrl && (
              <>
                <Divider sx={{ mb: 2 }} />
                <Box
                  component="a"
                  href={invoiceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 1.5,
                    p: 2,
                    borderRadius: 2,
                    bgcolor: "primary.50",
                    border: "1px solid",
                    borderColor: "primary.200",
                    textDecoration: "none",
                    transition: "all 0.2s ease",
                    "&:hover": {
                      bgcolor: "primary.100",
                      borderColor: "primary.300",
                      transform: "translateY(-1px)",
                      boxShadow: 2,
                    },
                  }}
                >
                  <Box
                    sx={{
                      p: 1,
                      borderRadius: 1,
                      bgcolor: "primary.main",
                      color: "white",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <FileText size={18} />
                  </Box>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="body2" sx={{ fontWeight: 600, color: "primary.main", mb: 0.25 }}>
                      View Invoice
                    </Typography>
                    <Typography variant="caption" sx={{ color: "text.secondary", fontSize: "0.75rem" }}>
                      Click to open invoice in a new tab
                    </Typography>
                  </Box>
                  <ExternalLink size={16} style={{ color: 'rgba(0, 0, 0, 0.54)', flexShrink: 0 }} />
                </Box>
              </>
            )}
          </Box>
          
          {job?.submission &&
            <Box sx={{ mb: 3 }}>
              <Box
                component="a"
                href={`/quote/details/${job.submission}`}
                target="_blank"
                rel="noopener noreferrer"
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 1.5,
                  p: 2,
                  borderRadius: 2,
                  bgcolor: "primary.200",
                  border: "1px solid",
                  borderColor: "divider",
                  textDecoration: "none",
                  transition: "all 0.2s ease",
                  "&:hover": {
                    transform: "translateY(-1px)",
                    boxShadow: 1,
                  },
                }}
              >
                <Typography variant="body2" sx={{ fontWeight: 600, color: "primary.main", mb: 0.25 }}>
                  View Approved Estimate
                </Typography>
                <Typography variant="caption" sx={{ color: "text.secondary", fontSize: "0.75rem" }}>
                  Click to open job in a new tab
                </Typography>
              </Box>
            </Box>
          }

          {persistedSnapshotId && (
            <Box sx={{ mb: 3 }}>
              <Box
                component="a"
                href={`/quote/original/${persistedSnapshotId}`}
                target="_blank"
                rel="noopener noreferrer"
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 1.5,
                  p: 2,
                  borderRadius: 2,
                  bgcolor: "grey.50",
                  border: "1px solid",
                  borderColor: "divider",
                  textDecoration: "none",
                  transition: "all 0.2s ease",
                  "&:hover": {
                    bgcolor: "grey.100",
                    transform: "translateY(-1px)",
                    boxShadow: 1,
                  },
                }}
              >
                <Box
                  sx={{
                    p: 1,
                    borderRadius: 1,
                    bgcolor: "primary.main",
                    color: "white",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <History size={18} />
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="body2" sx={{ fontWeight: 600, color: "primary.main", mb: 0.25 }}>
                    View Original Proposal
                  </Typography>
                  <Typography variant="caption" sx={{ color: "text.secondary", fontSize: "0.75rem" }}>
                    Saved technician copy before client changes
                  </Typography>
                </Box>
                <ExternalLink size={16} style={{ color: 'rgba(0, 0, 0, 0.54)', flexShrink: 0 }} />
              </Box>
            </Box>
          )}

          {/* Notes (Collapsible) - Fixed height */}
          <Box sx={{ mb: 3, minHeight: job.notes ? '50px' : '0px' }}>
          {job.notes && (
              <>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                  p: 1.5,
                  borderRadius: 1,
                  bgcolor: 'grey.50',
                  '&:hover': { bgcolor: 'grey.100' },
                }}
                onClick={() => setNotesExpanded(!notesExpanded)}
              >
                <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary' }}>
                  Job Notes
                </Typography>
                {notesExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </Box>
              <Collapse in={notesExpanded}>
                <Box sx={{ p: 1.5, bgcolor: 'grey.50', borderRadius: 1, mt: 0.5 }}>
                  <Typography variant="body2" sx={{ fontSize: '0.875rem', color: 'text.secondary', whiteSpace: 'pre-wrap' }}>
                    {job.notes}
                  </Typography>
                </Box>
              </Collapse>
              </>
            )}
            </Box>

          {/* Appointment Details - Show when slot is reserved and appointment exists */}
          {job?.slot_reserved_info?.slot_reserved === true && job?.slot_reserved_info?.appointment && (
            <Box sx={{ mb: 3 }}>
              <Divider sx={{ mb: 2 }} />
              <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700, textTransform: 'uppercase', mb: 1.5, display: 'block', letterSpacing: '0.5px', fontSize: '0.7rem' }}>
                Reserved Appointment
              </Typography>
              <Box
                sx={{
                  p: 2,
                  borderRadius: 2,
                  bgcolor: "info.50",
                  border: "1px solid",
                  borderColor: "info.200",
                }}
              >
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                  {job.slot_reserved_info.appointment.title && (
                    <Typography variant="body2" sx={{ fontWeight: 600, color: "info.main", mb: 0.5 }}>
                      {job.slot_reserved_info.appointment.title}
                    </Typography>
                  )}

                  {job.slot_reserved_info.appointment.start_time && (
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <Calendar size={16} style={{ color: 'rgba(0, 0, 0, 0.54)', flexShrink: 0 }} />
                      <Typography variant="body2" sx={{ fontSize: '0.875rem' }}>
                        {moment.utc(job.slot_reserved_info.appointment.start_time).tz(accountTimezone).format("MMM D, YYYY · h:mm A")}
                        {job.slot_reserved_info.appointment.end_time && (
                          <> - {moment.utc(job.slot_reserved_info.appointment.end_time).tz(accountTimezone).format("h:mm A")}</>
                        )}
                      </Typography>
                    </Box>
                  )}

                  {job.slot_reserved_info.appointment.assigned_user && (
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <User size={16} style={{ color: 'rgba(0, 0, 0, 0.54)', flexShrink: 0 }} />
                      <Typography variant="body2" sx={{ fontSize: '0.875rem' }}>
                        {job.slot_reserved_info.appointment.assigned_user.name}
                        {job.slot_reserved_info.appointment.assigned_user.email && (
                          <> ({job.slot_reserved_info.appointment.assigned_user.email})</>
                        )}
                      </Typography>
                    </Box>
                  )}

                  {job.slot_reserved_info.appointment.contact && (
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <User size={16} style={{ color: 'rgba(0, 0, 0, 0.54)', flexShrink: 0 }} />
                      <Typography variant="body2" sx={{ fontSize: '0.875rem' }}>
                        {job.slot_reserved_info.appointment.contact.name}
                        {job.slot_reserved_info.appointment.contact.email && (
                          <> ({job.slot_reserved_info.appointment.contact.email})</>
                        )}
                      </Typography>
                    </Box>
                  )}

                  {job.slot_reserved_info.appointment.address && (
                    <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1 }}>
                      <MapPin size={16} style={{ color: 'rgba(0, 0, 0, 0.54)', flexShrink: 0, marginTop: '2px' }} />
                      <Typography variant="body2" sx={{ fontSize: '0.875rem', lineHeight: 1.4 }}>
                        {job.slot_reserved_info.appointment.address}
                      </Typography>
                    </Box>
                  )}

                  {job.slot_reserved_info.appointment.calendar_name && (
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <Calendar size={16} style={{ color: 'rgba(0, 0, 0, 0.54)', flexShrink: 0 }} />
                      <Typography variant="body2" sx={{ fontSize: '0.875rem', color: 'text.secondary' }}>
                        Calendar: {job.slot_reserved_info.appointment.calendar_name}
                      </Typography>
                    </Box>
                  )}

                  {job.slot_reserved_info.appointment.appointment_status && (
                    <Box>
                      <Chip
                        label={job.slot_reserved_info.appointment.appointment_status.replace(/_/g, " ")}
                        size="small"
                        sx={{
                          textTransform: "capitalize",
                          fontSize: "0.75rem",
                          height: "24px",
                          fontWeight: 500,
                        }}
                        color={job.slot_reserved_info.appointment.appointment_status === "confirmed" ? "success" : "default"}
                      />
                    </Box>
                  )}

                  {job.slot_reserved_info.appointment.notes && (
                    <Box sx={{ mt: 1, pt: 1.5, borderTop: '1px solid', borderColor: 'info.200' }}>
                      <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, display: 'block', mb: 0.5 }}>
                        Notes:
                      </Typography>
                      <Typography variant="body2" sx={{ fontSize: '0.875rem', color: 'text.secondary', whiteSpace: 'pre-wrap' }}>
                        {job.slot_reserved_info.appointment.notes}
                      </Typography>
                    </Box>
                  )}
                </Box>
              </Box>
            </Box>
          )}

          {/* Completion Details — uploads/edits hidden on contact CRM view */}
          {!readOnly && (
            <JobCompletionDetails 
              job={job} 
              onUpdate={onUpdate} 
              onImageClick={(image) => setSelectedImage(image)}
            />
          )}
        </CardContent>
      </Card>

      {deleteDialogOpen && (
        <DeleteJobDialog
          job={job}
          open={deleteDialogOpen}
          onClose={() => setDeleteDialogOpen(false)}
          onDelete={(jobToDelete, option) => {
            onDelete(jobToDelete, option)
            setDeleteDialogOpen(false)
          }}
        />
      )}

      {statusChangeDialogOpen && pendingStatus && (
        <StatusChangeConfirmationDialog
          job={job}
          newStatus={pendingStatus}
          open={statusChangeDialogOpen}
          onClose={handleCancelStatusChange}
          onConfirm={handleConfirmStatusChange}
          isUpdating={updating}
        />
      )}

      <AlertDialog open={imagesRequiredDialogOpen} onOpenChange={setImagesRequiredDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Job images required</AlertDialogTitle>
            <AlertDialogDescription>
              Upload and save at least one job photo in the Job Images section before marking this job as completed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction>OK</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Image Viewer */}
      <ImageViewer
        open={!!selectedImage}
        onClose={() => setSelectedImage(null)}
        image={selectedImage}
        showCaption={true}
      />

      <Dialog
        open={rescheduleDialogOpen}
        onClose={() => !isRescheduleSubmitting && setRescheduleDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Request this job again</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Choose a date and time. We will confirm your request shortly.
          </Typography>
          <TextField
            label="Notes (optional)"
            multiline
            minRows={2}
            fullWidth
            value={rescheduleNotes}
            onChange={(e) => setRescheduleNotes(e.target.value)}
            sx={{ mb: 2 }}
            disabled={isRescheduleSubmitting}
          />
          <QuoteCalendarScheduler
            key={schedulerResetKey}
            onSchedule={handlePortalRescheduleSlot}
            isSubmitting={isRescheduleSubmitting}
          />
        </DialogContent>
        <DialogActions>
          <Button variant="ghost" onClick={() => setRescheduleDialogOpen(false)} disabled={isRescheduleSubmitting}>
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}
