"use client"

import { useState, useEffect } from "react"
import { useParams, useNavigate } from "react-router-dom"
import {
  Box,
  Typography,
  Card,
  CardContent,
  Divider,
  Chip,
  CircularProgress,
  Paper,
  Button,
  Stack,
  Avatar,
  Container,
  Grid,
  Collapse,
  IconButton,
  Alert,
  AlertTitle,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from "@mui/material"
import {
  Receipt,
  ArrowBack,
  ExpandMore,
  ExpandLess,
  Add,
  AccessTime,
  CheckCircle,
  PictureAsPdf,
  Gavel,
  Image as ImageIcon,
} from "@mui/icons-material"
import {
  useCreateScheduleMutation,
  useGetGlobalPriceQuery,
  useGetQuoteDetailsQuery,
} from "../../store/api/user/quoteApi"
import { Info, Plus } from "lucide-react"
import { handleDownloadPDF } from "../../utils/handleDownloadPDF"
import { useAccountBranding } from "../../hooks/useAccountBranding"
import { applyCompanyNameToTermsText } from "../../utils/companyProfile"
import CompanyLogo from "../../components/CompanyLogo"
import { QuoteDetailsSkeleton } from "../../components/ui/skeletons"
import { ImageViewer } from "../../components/ui/ImageViewer"
import QuoteCalendarScheduler from "../../components/user/QuoteCalendarScheduler"
import PackageOptionsSummary from "../../components/user/PackageOptionsSummary"
import { slotWallClockAsUtcIso } from "../../utils/scheduleIso"
import { buildBookingRedirectUrl } from "../../utils/bookingRedirect"

const statusStyles = {
  pending: { bgcolor: "warning.light", color: "warning.dark" },
  approved: { bgcolor: "success.light", color: "success.dark" },
  rejected: { bgcolor: "error.light", color: "error.dark" },
  submitted: { bgcolor: "info.light", color: "info.dark" },
  draft: { bgcolor: "grey.100", color: "grey.800" },
  responses_completed: { bgcolor: "success.light", color: "success.dark" },
}

const formatYesNo = (val) => {
  if (val === true) return "Yes"
  if (val === false) return "No"
  return "N/A"
}

const QuoteDetailsPage = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const [expandedServices, setExpandedServices] = useState({})
  const [activeTab, setActiveTab] = useState("recurring")
  const [showTermsDialog, setShowTermsDialog] = useState(false)
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false)
  const [isScheduling, setIsScheduling] = useState(false)
  const [selectedImage, setSelectedImage] = useState(null)

  const {
    data: quote,
    isLoading,
    isError,
    error,
    refetch,
  } = useGetQuoteDetailsQuery(id, {
    refetchOnMountOrArgChange: true,
    refetchOnFocus: true,
    refetchOnReconnect: true,
  })

  const { data: globalPriceData } = useGetGlobalPriceQuery()

  const [createSchedule] = useCreateScheduleMutation()

  const { profile, locationId, accountInfo, formatPrice, isReady, isLoading: isBrandingLoading } = useAccountBranding({ quote })
  const termsCompanyLabel = (text) => {
    if (!profile.name) return ''
    return applyCompanyNameToTermsText(text, profile.name, profile.abbreviation)
  }
  const termsHref = locationId
    ? `/terms?location_id=${encodeURIComponent(locationId)}`
    : '/terms'

  // Expand all services by default
  useEffect(() => {
    if (quote?.service_selections) {
      const initialExpanded = {}
      quote.service_selections.forEach((service) => {
        initialExpanded[service.id] = true
      })
      setExpandedServices(initialExpanded)
    }
  }, [quote])

  const toggleServiceExpansion = (serviceId) => {
    setExpandedServices((prev) => ({
      ...prev,
      [serviceId]: !prev[serviceId],
    }))
  }

  const toTitleCase = (str) => {
    if (!str) return ""
    return str.toLowerCase().split(' ').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ')
  }

  const handleSchedule = async (slotDate) => {
    if (!slotDate) return
    const payload = {
      id: quote.id,
      scheduled_date: slotWallClockAsUtcIso(slotDate),
      is_submitted: true,
      // Public quotes have no technician; blank quoted_by is allowed.
      quoted_by: quote.quote_schedule?.quoted_by || '',
    }

    setIsScheduling(true)
    try {
      await createSchedule(payload).unwrap()
      const redirectUrl = buildBookingRedirectUrl(
        quote.contact,
        locationId,
        accountInfo?.booking_redirect_url,
      )
      if (redirectUrl) {
        window.location.assign(redirectUrl)
        return
      }
      // No redirect configured — show in-page success (Scheduled card) after refetch.
      await refetch()
      window.scrollTo({ top: 0, behavior: "smooth" })
    } catch (err) {
      // Error handled by toast notification
    } finally {
      setIsScheduling(false)
    }
  }

  if (isLoading) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Button startIcon={<ArrowBack />} variant="text" onClick={() => navigate(-1)} sx={{ mb: 3 }}>
          Back
        </Button>
        <QuoteDetailsSkeleton />
      </Container>
    )
  }

  if (isError || !quote) {
    return (
      <Box p={4}>
        <Button startIcon={<ArrowBack />} variant="text" onClick={() => navigate(-1)} sx={{ mb: 2 }}>
          Back
        </Button>
        <Typography variant="h5" color="error" gutterBottom>
          Failed to load quote
        </Typography>
        <Typography variant="body2">{error?.message || "Quote not found or something went wrong."}</Typography>
      </Box>
    )
  }

  const {
    contact,
    address,
    house_sqft,
    location_details,
    status,
    total_base_price,
    total_adjustments,
    total_surcharges,
    final_total,
    created_at,
    expires_at,
    service_selections,
    quote_surcharge_applicable,
    additional_data,
    custom_products,
    custom_service_total,
    quote_schedule,
    quoted_by_details,
    images,
    quote_origin,
  } = quote

  const renderQuestionResponse = (response) => {
    switch (response.question_type) {
      case "yes_no":
      case "conditional":
        return response.yes_no_answer ? "Yes" : "No"
      case "multiple_yes_no":
        return (
          response.sub_question_responses
            .filter((sub) => sub.answer)
            .map((sub) => sub.sub_question_text)
            .join(", ") || "None selected"
        )
      case "quantity":
        return response.option_responses.map((opt) => `${opt.option_text}: ${opt.quantity}`).join(", ")
      case "describe":
        return response.option_responses.map((opt) => opt.option_text).join(", ")
      default:
        return "N/A"
    }
  }

  // Terms and Conditions Content Component
  const TermsContent = () => (
    <Box>
      {/* Tabs */}
      <Box display="flex" justifyContent="center" mb={3}>
        <Box display="flex" borderBottom={1} borderColor="divider">
          <Button
            onClick={() => setActiveTab("recurring")}
            sx={{
              px: 2,
              py: 1,
              fontSize: "0.875rem",
              fontWeight: 500,
              borderBottom: activeTab === "recurring" ? 2 : 0,
              borderColor: activeTab === "recurring" ? "primary.main" : "transparent",
              color: activeTab === "recurring" ? "primary.main" : "text.secondary",
              "&:hover": { color: "text.primary" },
              textTransform: "none",
              borderRadius:0
            }}
          >
            Recurring Service Terms
          </Button>
          <Button
            onClick={() => setActiveTab("terms")}
            sx={{
              px: 2,
              py: 1,
              fontSize: "0.875rem",
              fontWeight: 500,
              borderBottom: activeTab === "terms" ? 2 : 0,
              borderColor: activeTab === "terms" ? "primary.main" : "transparent",
              color: activeTab === "terms" ? "primary.main" : "text.secondary",
              "&:hover": { color: "text.primary" },
              textTransform: "none",
              borderRadius:0
            }}
          >
            Terms and Conditions
          </Button>
          {/* <Button
            onClick={() => setActiveTab("specs")}
            sx={{
              px: 2,
              py: 1,
              fontSize: "0.875rem",
              fontWeight: 500,
              borderBottom: activeTab === "specs" ? 2 : 0,
              borderColor: activeTab === "specs" ? "primary.main" : "transparent",
              color: activeTab === "specs" ? "primary.main" : "text.secondary",
              "&:hover": { color: "text.primary" },
              textTransform: "none",
            }}
          >
            Job Specs
          </Button> */}
        </Box>
      </Box>

      {/* Tab Content */}
      {activeTab === "recurring" && (
        <Box sx={{ maxHeight: "400px", overflow: "auto", pr: 1 }}>
          {/* OLD RECURRING TERMS - HIDDEN
          <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
            Recurring Service Agreement (Window Cleaning & Gutter Cleaning)
          </Typography>
          <Box sx={{ color: "text.secondary", fontSize: "0.875rem", "& > *": { mb: 1.5 } }}>
            <Typography variant="body2">
              {termsCompanyLabel(`This Recurring Service Agreement outlines the terms and conditions for ongoing window cleaning and/or gutter cleaning services provided by TruShine Window Cleaning.`)}
            </Typography>
          */}
          
          {/* NEW RECURRING SERVICE ADDENDUM */}
          <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
            Recurring Service Addendum
          </Typography>
          <Typography variant="body2" sx={{ mb: 2, color: "text.secondary" }}>
            (Window Cleaning & Gutter Cleaning)
          </Typography>
          <Box sx={{ color: "text.secondary", fontSize: "0.875rem", "& > *": { mb: 1.5 } }}>

            {/* R1) Scope of Recurring Services */}
            <Typography variant="subtitle2" sx={{ fontWeight: 600, color: "text.primary" }}>
              R1) Scope of Recurring Services
            </Typography>
            <Typography variant="body2" sx={{ mb: 1 }}>
              {termsCompanyLabel('TruShine will perform recurring window cleaning and/or gutter cleaning as selected:')}
            </Typography>
            <Box component="ul" sx={{ pl: 3, m: 0 }}>
              <Typography component="li" variant="body2">
                <strong>Window Cleaning:</strong> exterior window cleaning for all accessible glass; interior if included; add-ons available for additional fee.
              </Typography>
              <Typography component="li" variant="body2">
                <strong>Gutter Cleaning:</strong> removal of debris; flushing downspouts; light roof debris removal near gutter lines when safely accessible.
              </Typography>
              <Typography component="li" variant="body2">
                Services occur on the chosen frequency: monthly, bi-monthly, quarterly, semi-annual, or annual, and continue until canceled per this Addendum.
              </Typography>
            </Box>

            {/* R2) Pricing & Payment Terms */}
            <Typography variant="subtitle2" sx={{ fontWeight: 600, color: "text.primary", mt: 2 }}>
              R2) Pricing & Payment Terms (Recurring)
            </Typography>
            <Box component="ul" sx={{ pl: 3, m: 0 }}>
              <Typography component="li" variant="body2">Recurring clients receive discounted pricing compared to one-time rates.</Typography>
              <Typography component="li" variant="body2">Pricing is based on property size, service scope, and access conditions.</Typography>
              <Typography component="li" variant="body2">
                <strong>Billing timing:</strong>{' '}
                {termsCompanyLabel('For Recurring Plan Visits, Client authorizes TruShine to charge the card on file after completion of each Visit (same day), unless otherwise agreed in writing.')}
              </Typography>
              <Typography component="li" variant="body2">A valid credit card must be kept on file for automated billing; receipts are sent via email after each charge.</Typography>
            </Box>

            {/* R3) Minimum Commitment */}
            <Typography variant="subtitle2" sx={{ fontWeight: 600, color: "text.primary", mt: 2 }}>
              R3) Minimum Commitment (By Frequency)
            </Typography>
            <Typography variant="body2" sx={{ mb: 1 }}>Minimum commitment applies based on plan frequency:</Typography>
            <Box component="ul" sx={{ pl: 3, m: 0 }}>
              <Typography component="li" variant="body2"><strong>Monthly, Bi-Monthly, Quarterly, Semi-Annual:</strong> minimum one (1) year commitment.</Typography>
              <Typography component="li" variant="body2"><strong>Quarterly:</strong> minimum 4 scheduled services</Typography>
              <Typography component="li" variant="body2"><strong>Semi-Annual:</strong> minimum 2 scheduled services</Typography>
              <Typography component="li" variant="body2"><strong>Annual:</strong> minimum two (2) year commitment with at least 2 scheduled services per year.</Typography>
            </Box>

            {/* R4) Renewal & Post-Term Continuation */}
            <Typography variant="subtitle2" sx={{ fontWeight: 600, color: "text.primary", mt: 2 }}>
              R4) Renewal & Post-Term Continuation
            </Typography>
            <Typography variant="body2">
              After the minimum commitment is met, the plan continues automatically at the same recurring rate unless Client cancels with written notice (as defined at the top). No price increases apply without Client approval or advance written notice.
            </Typography>

            {/* R5) Cancellation After Minimum Term */}
            <Typography variant="subtitle2" sx={{ fontWeight: 600, color: "text.primary", mt: 2 }}>
              R5) Cancellation After Minimum Term
            </Typography>
            <Typography variant="body2">
              After the minimum commitment is met, either party may terminate with at least 14 days' written notice.
            </Typography>

            {/* R6) Early Cancellation Policy */}
            <Typography variant="subtitle2" sx={{ fontWeight: 600, color: "text.primary", mt: 2 }}>
              R6) Early Cancellation Policy (Before Minimum Term)
            </Typography>
            <Typography variant="body2" sx={{ mb: 1 }}>If Client cancels before fulfilling the minimum service term, a cancellation fee applies equal to:</Typography>
            <Box component="ul" sx={{ pl: 3, m: 0 }}>
              <Typography component="li" variant="body2">the difference between the discounted recurring rate and the standard one-time rate (plus tax) for all completed Visits to date.</Typography>
            </Box>
            <Typography variant="body2" sx={{ mt: 1 }}>
              This fee will be charged to the card on file on the day of cancellation.
            </Typography>

            {/* R7) Client Responsibilities */}
            <Typography variant="subtitle2" sx={{ fontWeight: 600, color: "text.primary", mt: 2 }}>
              R7) Client Responsibilities (Recurring)
            </Typography>
            <Box component="ul" sx={{ pl: 3, m: 0 }}>
              <Typography component="li" variant="body2">Ensure access on scheduled dates (gates unlocked, pets secured, clear paths).</Typography>
              <Typography component="li" variant="body2">
                {termsCompanyLabel('Notify TruShine of pre-existing issues, fragile items, or safety concerns.')}
              </Typography>
              <Typography component="li" variant="body2">Communicate promptly about scheduling changes or access restrictions.</Typography>
              <Typography component="li" variant="body2">
                {termsCompanyLabel('If TruShine arrives and cannot perform due to lack of access, the $75 trip fee applies, and rescheduling fees may also apply.')}
              </Typography>
            </Box>

            {/* R8) Service Adjustments */}
            <Typography variant="subtitle2" sx={{ fontWeight: 600, color: "text.primary", mt: 2 }}>
              R8) Service Adjustments & Changes
            </Typography>
            <Typography variant="body2">
              {termsCompanyLabel(`Pricing may be updated if property conditions change or the service scope is modified. Client may request upgrades, add-ons, or frequency changes with written notice. TruShine will provide advance notice of pricing updates.`)}
            </Typography>

            {/* R9) Weather / Safety / Access Limitations */}
            <Typography variant="subtitle2" sx={{ fontWeight: 600, color: "text.primary", mt: 2 }}>
              R9) Weather / Safety / Access Limitations
            </Typography>
            <Typography variant="body2">
             {termsCompanyLabel(`TruShine may cancel or reschedule due to weather, safety concerns, or access limitations.`)}
            </Typography>
          </Box>
        </Box>
      )}

      {activeTab === "terms" && (
        <Box sx={{ maxHeight: "400px", overflow: "auto", pr: 1 }}>
          {/* OLD TERMS - HIDDEN
          <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
            Terms and Conditions
          </Typography>
          <Box
            sx={{
              color: "text.secondary",
              fontSize: "0.75rem",
              "& > *": { mb: 1.5 },
            }}
          >
            <Typography variant="subtitle2" sx={{ fontWeight: 600, color: "text.primary" }}>
              GENERAL TERMS
            </Typography>
          */}
          
          {/* NEW MASTER TERMS & CONDITIONS */}
          <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
            {profile.name}
          </Typography>
          <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600, mb: 2 }}>
            Master Terms & Conditions + Recurring Service Addendum
          </Typography>
          <Typography variant="body2" sx={{ mb: 2, color: "text.secondary" }}>
            (Window Cleaning • Gutter Cleaning • Pressure Washing • Awning Cleaning)
          </Typography>
          <Typography variant="body2" sx={{ mb: 3, fontSize: "0.8rem", fontStyle: "italic" }}>
            {termsCompanyLabel("Written notice for anything in this agreement means email or SMS/text message to TruShine's official contact information on your invoice/estimate/website (or the number/email used to confirm your appointment).")}
          </Typography>
          <Box
            sx={{
              color: "text.secondary",
              fontSize: "0.75rem",
              "& > *": { mb: 1.5 },
            }}
          >
            {/* 1) Definitions */}
            <Typography variant="subtitle2" sx={{ fontWeight: 600, color: "text.primary" }}>
              1) Definitions
            </Typography>
            <Box component="ul" sx={{ pl: 3, m: 0 }}>
              <Typography component="li" variant="body2">
                <strong>"{profile.name} / {profile.abbreviation}"</strong> = {profile.name}.
              </Typography>
              <Typography component="li" variant="body2">
                <strong>"Client"</strong> = the person or entity booking services.
              </Typography>
              <Typography component="li" variant="body2">
                <strong>"Services"</strong> = work listed in the estimate/proposal/work order/invoice.
              </Typography>
              <Typography component="li" variant="body2">
                <strong>"Visit"</strong> = a scheduled service appointment date.
              </Typography>
              <Typography component="li" variant="body2">
                <strong>"Site"</strong> = the property where Services are performed.
              </Typography>
              <Typography component="li" variant="body2">
                <strong>"Recurring Plan"</strong> = ongoing services scheduled monthly, bi-monthly, quarterly, semi-annual, or annual.
              </Typography>
            </Box>

            {/* 2) Acceptance & Agreement */}
            <Typography variant="subtitle2" sx={{ fontWeight: 600, color: "text.primary", mt: 2 }}>
              2) Acceptance & Agreement
            </Typography>
            <Typography variant="body2">
              Quotes are valid for 30 days and must be accepted in writing (signature, electronic acceptance, or checkbox). By booking, approving, paying, or accepting electronically, Client agrees to these Master Terms & Conditions. If Client enrolls in a Recurring Plan, the Recurring Service Addendum also applies.
            </Typography>

            {/* 3) Professional Standards */}
            <Typography variant="subtitle2" sx={{ fontWeight: 600, color: "text.primary", mt: 2 }}>
              3) Professional Standards, Codes, and Insurance
            </Typography>
            <Typography variant="body2">
              {termsCompanyLabel(`All work is performed in a professional, workmanlike manner and in compliance with applicable local codes and regulations. TruShine is properly insured against injury to employees and losses resulting from employee actions.`)}
            </Typography>

            {/* 4) Scope of Work */}
            <Typography variant="subtitle2" sx={{ fontWeight: 600, color: "text.primary", mt: 2 }}>
              4) Scope of Work & Exclusions
            </Typography>
            <Typography variant="body2" sx={{ mb: 1 }}>
              The scope is limited to what is specifically included in the estimate/proposal/work order. Anything not listed is excluded unless agreed in writing.
            </Typography>
            <Box component="ul" sx={{ pl: 3, m: 0 }}>
              <Typography component="li" variant="body2">
                <strong>A) Window Cleaning:</strong> All windows must be securely closed on the day of service. Unsafe/inaccessible windows will not be cleaned. Exterior glass may be cleaned using a water-fed pole with pure water and left to dry naturally. "Window" includes frame, sill, sash, and glass (wood, aluminum, steel, UPVC). Brick/tile/stone sills are excluded. Add-ons (extra fee unless included): screen cleaning, track detailing, hard water removal, etc.
              </Typography>
              <Typography component="li" variant="body2">
                <strong>B) Gutter Cleaning:</strong> Basic gutter cleaning includes clearing internal gutters only. Debris hauling and repairs are not included unless agreed in writing. Cleaning may be performed via leaf blower; downspouts may be flushed with hose. Exterior gutter surface cleaning is not included (available for additional cost).
              </Typography>
              <Typography component="li" variant="body2">
               {termsCompanyLabel(`<strong>C) Pressure Washing:</strong> Removes most stains; some marks may remain. External water access is required. Client must cover/remove outdoor furniture. If TruShine must do it, a $150 fee may apply. TruShine is not liable for chemical damage to items not properly protected/removed.`)}
              </Typography>
              <Typography component="li" variant="body2">
               {termsCompanyLabel(`<strong>D) Awning Cleaning:</strong> TruShine is not liable for unexpected damage during awning cleaning. Service may be declined if material is over 5 years old or fails inspection.`)}
              </Typography>
            </Box>

            {/* 5) Access, Safety, and Property Condition */}
            <Typography variant="subtitle2" sx={{ fontWeight: 600, color: "text.primary", mt: 2 }}>
              5) Access, Safety, and Property Condition
            </Typography>
            <Box component="ul" sx={{ pl: 3, m: 0 }}>
              <Typography component="li" variant="body2">
                Client must provide full access to work areas (gates unlocked, pets secured, clear access).
              </Typography>
              <Typography component="li" variant="body2">
               {termsCompanyLabel(`TruShine will not move obstacles/furniture for access (unless agreed).`)}
              </Typography>
              <Typography component="li" variant="body2">
                {termsCompanyLabel(`If TruShine arrives and cannot perform due to lack of access or unsafe conditions, a $75 trip fee applies.`)}
              </Typography>
              <Typography component="li" variant="body2">
                {termsCompanyLabel(`Client is responsible for ensuring items/structures are sound. TruShine may document or refuse questionable items.`)}
              </Typography>
              <Typography component="li" variant="body2">
                {termsCompanyLabel(`Any special accommodations must be reviewed and approved by TruShine management before accepting the proposal.`)}
              </Typography>
            </Box>

            {/* 6) Scheduling, Rescheduling, and Delays */}
            <Typography variant="subtitle2" sx={{ fontWeight: 600, color: "text.primary", mt: 2 }}>
              6) Scheduling, Rescheduling, and Delays
            </Typography>
            <Box component="ul" sx={{ pl: 3, m: 0 }}>
              <Typography component="li" variant="body2">
               {termsCompanyLabel(`TruShine is not liable for delays due to weather, supply issues, or other uncontrollable factors.`)}
              </Typography>
              <Typography component="li" variant="body2">
                Each Client may reschedule up to two (2) times within 7 days of the original date.
              </Typography>
              <Typography component="li" variant="body2">
                Rescheduling/cancellation requested within 8 hours of a scheduled Visit: <strong>$35 fee</strong>.
              </Typography>
              <Typography component="li" variant="body2">
                Rescheduling more than 8 hours in advance: no fee for the first 2 reschedules.
              </Typography>
              <Typography component="li" variant="body2">
                {termsCompanyLabel(`Beyond 2 reschedules, TruShine may charge up to the full service amount to protect crew scheduling and reserved time.`)}
              </Typography>
              <Typography component="li" variant="body2">
                <strong>Important:</strong> These rescheduling rules apply to all Visits, including Recurring Plan Visits.
              </Typography>
            </Box>

            {/* 7) Pricing, Deposits, and Payments */}
            <Typography variant="subtitle2" sx={{ fontWeight: 600, color: "text.primary", mt: 2 }}>
              7) Pricing, Deposits, and Payments
            </Typography>
            <Box component="ul" sx={{ pl: 3, m: 0 }}>
              <Typography component="li" variant="body2">
                Payment is due upon completion unless otherwise agreed in writing.
              </Typography>
              <Typography component="li" variant="body2">
               {termsCompanyLabel(`TruShine may require credit card info on file and/or a $100 deposit.`)}
              </Typography>
              <Typography component="li" variant="body2">
                Jobs needing materials may require a 50% deposit.
              </Typography>
              <Typography component="li" variant="body2">
                Accepted: cash, check, credit card (in person, by phone, or online).
              </Typography>
              <Typography component="li" variant="body2">
                Commercial payments may be mailed to: <strong>3525 Murdock St, Houston, TX 77047</strong>.
              </Typography>
              <Typography component="li" variant="body2">
                Clients with unpaid balances may be denied further service.
              </Typography>
              <Typography component="li" variant="body2">
                Disputed payments are Client's responsibility; late/recovery fees may apply.
              </Typography>
              <Typography component="li" variant="body2">
                All services are subject to applicable Texas state tax.
              </Typography>
            </Box>

            {/* 8) Late Fees & Collections */}
            <Typography variant="subtitle2" sx={{ fontWeight: 600, color: "text.primary", mt: 2 }}>
              8) Late Fees & Collections
            </Typography>
            <Box component="ul" sx={{ pl: 3, m: 0 }}>
              <Typography component="li" variant="body2">
                Residential: <strong>10% late fee after 1 day</strong>.
              </Typography>
              <Typography component="li" variant="body2">
                Commercial: <strong>10% late fee after 30 days</strong>.
              </Typography>
              <Typography component="li" variant="body2">
                Balances unpaid after 60 days may be sent to collections, including legal fees and collection costs as permitted by law.
              </Typography>
            </Box>

            {/* 9) Guarantees */}
            <Typography variant="subtitle2" sx={{ fontWeight: 600, color: "text.primary", mt: 2 }}>
              9) Guarantees (Service-Specific)
            </Typography>
            <Box component="ul" sx={{ pl: 3, m: 0 }}>
              <Typography component="li" variant="body2">
                <strong>Window Cleaning:</strong> 36-hour streak-free guarantee on all window cleaning packages.
              </Typography>
              <Typography component="li" variant="body2">
                <strong>Gutter Cleaning:</strong> 15-day guarantee on all gutter cleaning packages.
              </Typography>
              <Typography component="li" variant="body2">
                <strong>Awning Cleaning:</strong> 24-hour guarantee on all awning cleaning services.
              </Typography>
              <Typography component="li" variant="body2">
                <strong>Pressure Washing:</strong> 3-day satisfaction guarantee on premium pressure washing packages only.
              </Typography>
            </Box>

            {/* 10) Complaints, Re-Visits, and Trip Fees */}
            <Typography variant="subtitle2" sx={{ fontWeight: 600, color: "text.primary", mt: 2 }}>
              10) Complaints, Re-Visits, and Trip Fees
            </Typography>
            <Box component="ul" sx={{ pl: 3, m: 0 }}>
              <Typography component="li" variant="body2">
                Any service concerns must be reported within 48 hours of completion for review and resolution.
              </Typography>
              <Typography component="li" variant="body2">
               {termsCompanyLabel(`TruShine must be given a reasonable opportunity to inspect and/or correct any confirmed workmanship issues.`)}
              </Typography>
              <Typography component="li" variant="body2">
                If a complaint revisit finds the work satisfactory, a <strong>$75 trip fee</strong> applies.
              </Typography>
            </Box>

            {/* 11) Refund Policy */}
            <Typography variant="subtitle2" sx={{ fontWeight: 600, color: "text.primary", mt: 2 }}>
              11) Refund Policy
            </Typography>
            <Typography variant="body2">
              All sales are final. Refunds are only for unused materials during service (if applicable).
            </Typography>

            {/* 12) Cancellation Policy */}
            <Typography variant="subtitle2" sx={{ fontWeight: 600, color: "text.primary", mt: 2 }}>
              12) Cancellation Policy (One-Time / Non-Recurring)
            </Typography>
            <Typography variant="body2">
              {termsCompanyLabel(`Client cancellation requests should be provided with as much notice as possible. For larger or reserved jobs, TruShine may require 14 days' written notice; shorter notice may result in a charge up to the full service amount, depending on crew scheduling and reserved time.`)}
            </Typography>

            {/* 13) Liability Limits */}
            <Typography variant="subtitle2" sx={{ fontWeight: 600, color: "text.primary", mt: 2 }}>
              13) Liability Limits & Pre-Existing Damage
            </Typography>
            <Typography variant="body2">
              {termsCompanyLabel(`TruShine is not responsible for pre-existing damage or deterioration including (but not limited to): aged gutters, rotted wood, failing seals, cracked panes, loose screens, or previously weakened/fragile items. Client must notify TruShine of known issues or safety concerns prior to service.`)}
            </Typography>

            {/* 14) Updates to Terms */}
            <Typography variant="subtitle2" sx={{ fontWeight: 600, color: "text.primary", mt: 2 }}>
              14) Updates to Terms
            </Typography>
            <Typography variant="body2">
             {termsCompanyLabel(`TruShine reserves the right to update these Terms & Conditions at any time. Updated terms apply prospectively.`)}
            </Typography>

            {/* 15) Order of Priority */}
            <Typography variant="subtitle2" sx={{ fontWeight: 600, color: "text.primary", mt: 2 }}>
              15) Order of Priority (If Anything Conflicts)
            </Typography>
            <Typography variant="body2" sx={{ mb: 1 }}>
              If there is a conflict between documents:
            </Typography>
            <Box component="ul" sx={{ pl: 3, m: 0 }}>
              <Typography component="li" variant="body2">
                The signed/accepted proposal/work order/invoice for the Visit, then
              </Typography>
              <Typography component="li" variant="body2">
                the Recurring Service Addendum (if enrolled), then
              </Typography>
              <Typography component="li" variant="body2">
                these Master Terms & Conditions.
              </Typography>
            </Box>

            <Typography variant="body2" sx={{ fontWeight: 600, mt: 2 }}>
              By accepting the proposal, electronically or in writing, you agree to all the terms outlined above.
            </Typography>
          </Box>
        </Box>
      )}


      {activeTab === "specs" && (
        <Box sx={{ maxHeight: "400px", overflow: "auto", pr: 1 }}>
          <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
            Job Specifications
          </Typography>
          <Box sx={{ color: "text.secondary", fontSize: "0.875rem" }}>
            <Typography variant="body2" paragraph>
              Detailed job specifications will be confirmed based on your selected services and property assessment.
            </Typography>
            <Typography variant="body2" paragraph>
              Our team will review all service areas during the initial visit to ensure proper execution according to
              your quote specifications.
            </Typography>
            <Typography variant="body2">
              Any additional requirements or changes to the original scope will be discussed and approved before
              implementation.
            </Typography>
          </Box>
        </Box>
      )}
    </Box>
  )

  return (
    <Box className="min-h-screen" sx={{ background: "linear-gradient(135deg,#f0f4f9 0%,#e2e8f0 70%)", pb: 6 }}>
      {/* Header */}
      <Box
        sx={{
          bgcolor: "white",
          borderBottom: 1,
          borderColor: "divider",
          mb: 4,
          py: 2,
        }}
        className="fixed w-full z-20"
      >
        <Box
          maxWidth="1200px"
          mx="auto"
          px={{ xs: 2, md: 4 }}
          display="flex"
          justifyContent="space-between"
          alignItems={{ xs: "center", md: "center" }}
          gap={{ xs: 2, md: 4 }}
        >
          {/* Left side - Logo & Quote Info */}
          <Box display="flex" alignItems={"center"} flexDirection="row" gap={{xs:1, sm:2}}>
            <CompanyLogo
              locationId={locationId}
              quote={quote}
              sx={{
                height: { xs: 55, sm: 75 },
                width: "auto",
                borderRadius: 1,
              }}
            />
            <Box display="flex" alignItems="start" flexDirection="column" gap={0} flexWrap="wrap">
              <Typography variant="h4" color="#023c8f" fontWeight="600"
                sx={{
                  fontSize: { xs: "1.25rem", sm: "1.5rem", md: "2rem" }, // xs=h6-ish, sm=h5, md=h4
                }}
              >
                Quote Details
              </Typography>
              <Box display="flex" flexWrap="wrap" alignItems="center" gap={1} mt={0.5}>
                <Typography variant="body2" color="text.secondary" sx={{fontSize:{ xs: "0.6rem", sm: "0.8rem", md: "0.9rem"}}}>
                  ID: {quote.id}
                </Typography>
                {(quote_origin || additional_data?.quote_origin) && (
                  <Chip
                    size="small"
                    label={
                      (quote_origin || additional_data?.quote_origin) === 'public'
                        ? 'Public quote'
                        : 'Technician quote'
                    }
                    sx={{
                      fontWeight: 600,
                      fontSize: { xs: '0.65rem', sm: '0.75rem' },
                      borderRadius: 1,
                      bgcolor: (quote_origin || additional_data?.quote_origin) === 'public' ? '#E8F4FD' : '#F3F4F6',
                      color: (quote_origin || additional_data?.quote_origin) === 'public' ? '#0369A1' : '#374151',
                    }}
                  />
                )}
                {/* <Chip
                  label={status?.charAt(0).toUpperCase() + status?.slice(1)}
                  size="small"
                  sx={{
                    fontWeight: 600,
                    fontSize:{ xs: "0.7rem", sm: "0.8rem", md: "0.8rem"},
                    borderRadius: 1,
                    ...(statusStyles[status?.toLowerCase()] || statusStyles["draft"]),
                  }}
                />
                <Typography variant="body2" color="text.secondary" sx={{fontSize:{ xs: "0.6rem", sm: "0.8rem", md: "0.9rem"}}}>
                  Created: {new Date(created_at).toLocaleDateString()}
                </Typography> */}
              </Box>
            </Box>
          </Box>

          {/* Right side - Buttons */}
          <Box
            display="flex"
            flexDirection={{  xs: "row" }}
            alignItems={{ xs: "stretch", sm: "center" }}
            gap={2}
            width={{ sm: "auto" }}
          >
            <Button
              variant="outlined"
              onClick={() =>
                handleDownloadPDF(
                  setIsGeneratingPDF,
                  quote,
                  contact,
                  address,
                  quote_schedule,
                  service_selections,
                  custom_products,
                  globalPriceData,
                  additional_data,
                  house_sqft,
                  profile,
                  locationId
                )
              }
              disabled={isGeneratingPDF}
              startIcon={
                isGeneratingPDF ? <CircularProgress size={16} /> : <PictureAsPdf />
              }
              sx={{
                borderColor: "#42bd3f",
                color: "#42bd3f",
                "&:hover": {
                  bgcolor: "rgba(66, 189, 63, 0.04)",
                  borderColor: "#42bd3f",
                },
                '& .pdf-btn-label': {
                  display: 'none',
                  '@media (min-width:600px)': {
                    display: 'inline',
                  },
                },
              }}
              fullWidth={{ xs: false, sm: true }}
            >
              <span className="pdf-btn-label">
                {isGeneratingPDF ? "Generating..." : "Download PDF"}
              </span>
            </Button>

            {window.self !== window.top && (
              <Button
                variant="contained"
                size="large"
                onClick={() => navigate("/")}
                sx={{
                  px: { xs: 2, md: 4 },
                  py: 1.5,
                  borderRadius: 2,
                  fontWeight: 600,
                  fontSize: "1rem",
                  background: "linear-gradient(90deg, #023c8f, #0056d3)",
                  "&:hover": {
                    background: "linear-gradient(90deg, #012a6b, #004bb8)",
                  },
                }}
                startIcon={<Plus size={20} />}
                fullWidth={{ xs: true, sm: false }}
              >
                Start New Quote
              </Button>
            )}
          </Box>
        </Box>
      </Box>

      {/* Body */}
      <Box maxWidth="1400px" className="py-32" mx="auto" px={{ xs: 2, md: 4 }}>
        <Container maxWidth="lg">
          <Box display="grid" gridTemplateColumns={{ xs: "1fr", lg: "2fr 1fr" }} gap={6}>
            {/* Left column */}
            <Box display="flex" flexDirection="column" gap={2}>
              {/* Customer Info */}
              <Card>
                <CardContent sx={{ p: 3 }}>
                  <Typography variant="h6" gutterBottom fontWeight={600} sx={{ color: "#023c8f" }}>
                    Customer Information
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6}>
                      <Typography variant="caption" color="text.secondary">
                        Name
                      </Typography>
                      <Typography variant="body1">
                        {toTitleCase(contact?.first_name) } { toTitleCase(contact?.last_name) }
                      </Typography>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <Typography variant="caption" color="text.secondary">
                        Email
                      </Typography>
                      <Typography variant="body1">{contact?.email}</Typography>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <Typography variant="caption" color="text.secondary">
                        Phone
                      </Typography>
                      <Typography variant="body1">{contact?.phone}</Typography>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <Typography variant="caption" color="text.secondary">
                        House sq ft
                      </Typography>
                      <Typography variant="body1">{house_sqft} sq ft</Typography>
                    </Grid>
                    <Grid item xs={12}>
                      <Typography variant="caption" color="text.secondary">
                        Address
                      </Typography>
                      <Typography variant="body1">
                        {address?.name} — {address?.street_address}, {address?.city}, {address?.state},{" "}
                        {address?.postal_code}
                      </Typography>
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>

              {/* Enhanced Scheduling Section */}
              {status?.toLowerCase() !== 'rejected' && (
                <>
                  {!quote_schedule?.is_submitted ? (
                    <QuoteCalendarScheduler onSchedule={handleSchedule} isSubmitting={isScheduling} />
                  ) : (
                    <Card
                      elevation={4}
                      sx={{
                        borderRadius: 3,
                        background: "linear-gradient(135deg, #f1f8e9 0%, #e8f5e8 100%)",
                      }}
                    >
                      <Box
                        sx={{
                          background: "linear-gradient(135deg, #42bd3f 0%, #369932 100%)",
                          color: "white",
                          px: 4,
                          py: 3,
                          display: "flex",
                          alignItems: "center",
                          gap: 2,
                          borderRadius: "12px 12px 0 0",
                        }}
                      >
                        <Avatar sx={{ bgcolor: "rgba(255,255,255,0.2)", width: 40, height: 40 }}>
                          <CheckCircle />
                        </Avatar>
                        <Box>
                          <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>
                            Scheduled
                          </Typography>
                          <Typography variant="body2" sx={{ opacity: 0.9 }}>
                            Your service is confirmed
                          </Typography>
                        </Box>
                      </Box>

                      <CardContent sx={{ p: 4 }}>
                        <Alert
                          severity="success"
                          sx={{
                            bgcolor: "rgba(255,255,255,0.8)",
                            border: "none",
                            borderRadius: 2,
                          }}
                        >
                          <AlertTitle sx={{ fontWeight: 600 }}>Service Scheduled!</AlertTitle>
                          <Typography variant="body2" sx={{ mt: 1 }}>
                            <strong>Date & Time (UTC):</strong>
                            <br />
                            {new Date(quote_schedule?.scheduled_date).toLocaleDateString("en-GB", {
                              weekday: "long",
                              year: "numeric",
                              month: "long",
                              day: "numeric",
                              timeZone: "UTC",
                            })}
                            <br />
                            <AccessTime sx={{ mr: 1, verticalAlign: "middle", fontSize: 16 }} />
                            {new Date(quote_schedule?.scheduled_date).toLocaleTimeString("en-GB", {
                              hour: "2-digit",
                              minute: "2-digit",
                              hour12: true,   // 👈 ensures AM/PM format
                              timeZone: "UTC",
                            })
                            .replace("am", "AM")
                            .replace("pm", "PM")
                            }
                          </Typography>
                        </Alert>

                        <Typography variant="body2" color="text.secondary" align="center" sx={{ mt: 3 }}>
                          Our team will contact you before the scheduled date to confirm details
                        </Typography>
                      </CardContent>
                    </Card>
                  )}
                </>
              )}

              {/* Service Selections */}
              {service_selections?.map((selection) => (
                <Card key={selection.id}>
                  {/* Service Header */}
                  <Box
                    sx={{
                      px: {xs:2, md:3},
                      py: 0.5,
                      backgroundColor: "#023c8f",
                      color: "white",
                      cursor: "pointer",
                      "&:hover": { bgcolor: "#012a6b" },
                    }}
                    onClick={() => toggleServiceExpansion(selection.id)}
                  >
                    <Box display="flex" alignItems="center" justifyContent="space-between">
                      <Typography fontWeight={600}
                        sx={{ color: 'white', fontSize:{ xs: "1rem", sm: "1.2rem", md: "1.5rem"},flex: 1,
                          whiteSpace: "normal",
                          wordBreak: "break-word"
                        }}
                      >
                        {selection.service_details?.name}
                      </Typography>
                      <IconButton sx={{ color: "white" }}>
                        {expandedServices[selection.id] ? <ExpandLess /> : <ExpandMore />}
                      </IconButton>
                    </Box>
                  </Box>

                  {/* Collapsible Content */}
                  <Collapse in={expandedServices[selection.id]} timeout="auto" unmountOnExit>
                    <Box sx={{ px: {xs:1.5, md:3}, py: 1 }}>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                        {selection.service_details?.description}
                      </Typography>

                      {/* All package options (selected + alternatives) */}
                      {(selection.package_quotes?.length > 0 || selection.selected_package_details) && (
                        <PackageOptionsSummary selection={selection} formatPrice={formatPrice} />
                      )}

                      {/* Question Responses */}
                      {selection.question_responses?.length > 0 && (
                        <Box mt={2}>
                          <Typography variant="subtitle1" fontWeight={600} sx={{ color: "#023c8f", fontSize:{ xs: "1rem", sm: "1.2rem", md: "1.3rem"} }}>
                            Your Responses
                          </Typography>
                          <Box sx={{ bgcolor: "#f8f9fa", borderRadius: 1, p: 1 }}>
                            {selection.question_responses.map((response, index) => (
                              <Box key={response.id} sx={{ display: 'flex', mb: 0.5, alignItems: "flex-start"}}>
                                  <Typography variant="body1" sx={{ color: "#023c8f", fontWeight: 600, mr: 1, minWidth: '25px', fontSize: { xs: "0.9rem", sm: "1rem", md: "1.1rem" }}}>
                                    Q{index + 1}:
                                  </Typography>
                                <Box >
                                  <Typography variant="body1" sx={{ flex: 1, mr: 1, fontSize: { xs: "0.9rem", sm: "1rem", md: "1.1rem" }}}>
                                    {response.question_text}
                                  </Typography>
                                  <Typography variant="body2" sx={{ fontWeight: 600, minWidth: 'fit-content', pl:1, fontSize: { xs: "0.75rem", sm: "0.85rem", md: "1rem" }}}>
                                    {renderQuestionResponse(response)}
                                  </Typography>
                                </Box>
                              </Box>
                            ))}
                          </Box>
                        </Box>
                      )}
                    </Box>
                  </Collapse>
                </Card>
              ))}

              {/* Custom Products/Services */}
              {custom_products.filter((c)=>c.is_active===true) && custom_products.filter((c)=>c.is_active===true).length > 0 && (
                <Card>
                  <Box sx={{ p: 3, py: 2 }}>
                    <Stack direction="row" alignItems="center" spacing={2}>
                      <Avatar sx={{ bgcolor: "#023c8f" }}>
                        <Add />
                      </Avatar>
                      <Box>
                        <Typography variant="h6" sx={{ fontWeight: 600, color: "#023c8f" }}>
                          Custom Services
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {custom_products.filter((c)=>c.is_active===true).length} custom service{custom_products.filter((c)=>c.is_active===true).length > 1 ? "s" : ""} added
                        </Typography>
                      </Box>
                    </Stack>
                  </Box>
                  <Divider />
                  <Box sx={{ overflow: "hidden" }}>
                    {custom_products.filter((c)=>c.is_active===true).map((product, index) => (
                      <Box
                        key={product.id}
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          p: 3,
                          borderBottom: index < custom_products.filter((c)=>c.is_active===true).length - 1 ? "1px solid #f0f0f0" : "none",
                          "&:hover": {
                            bgcolor: "#f8f9fa",
                          },
                          transition: "background-color 0.2s ease",
                        }}
                      >
                        <Box sx={{ flex: 1, mr: 2 }}>
                          <Typography variant="subtitle1" fontWeight={600} sx={{ color: "#023c8f", mb: 0.5 }}>
                            {product.product_name}
                          </Typography>
                          {product.description && (
                            <Typography
                              variant="body2"
                              color="text.secondary"
                              sx={{
                                display: "-webkit-box",
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: "vertical",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                              }}
                            >
                              {product.description}
                            </Typography>
                          )}
                        </Box>
                        <Box sx={{ textAlign: "right", flexShrink: 0 }}>
                          <Typography variant="h6" fontWeight={700} sx={{ color: "#42bd3f" }}>
                            {formatPrice(product.price)}
                          </Typography>
                        </Box>
                      </Box>
                    ))}
                  </Box>
                </Card>
              )}

              {/* Images Section */}
              {images && images.length > 0 && (
                <Card>
                  <Box sx={{ p: 3, py: 2 }}>
                    <Stack direction="row" alignItems="center" spacing={2}>
                      <Avatar sx={{ bgcolor: "#023c8f" }}>
                        <ImageIcon />
                      </Avatar>
                      <Typography variant="h6" sx={{ fontWeight: 600, color: "#023c8f" }}>
                        Images ({images.length})
                      </Typography>
                    </Stack>
                  </Box>
                  <Divider />
                  <CardContent sx={{ p: 3 }}>
                    <Grid container spacing={2} sx={{ maxWidth: "100%" }}>
                      {images.map((image) => (
                        <Grid item xs={4} sm={3} md={2} lg={2} xl={2} key={image.id}>
                          <Box
                            sx={{
                              position: "relative",
                              aspectRatio: "1",
                              borderRadius: 2,
                              overflow: "hidden",
                              border: "2px solid #e2e8f0",
                              cursor: "pointer",
                              transition: "all 0.2s ease",
                              maxWidth: {
                                xs: "120px",
                                sm: "150px",
                                md: "180px",
                                lg: "200px",
                              },
                              maxHeight: {
                                xs: "120px",
                                sm: "150px",
                                md: "180px",
                                lg: "200px",
                              },
                              width: "100%",
                              mx: "auto",
                              "&:hover": {
                                borderColor: "#023c8f",
                                transform: "scale(1.02)",
                                boxShadow: "0 4px 12px rgba(2, 60, 143, 0.15)",
                              },
                            }}
                            onClick={() => {
                              setSelectedImage(image)
                            }}
                          >
                            <img
                              src={image.image_url || image.image}
                              alt={image.caption || "Quote image"}
                              style={{
                                width: "100%",
                                height: "100%",
                                objectFit: "cover",
                                maxWidth: "100%",
                                display: "block",
                              }}
                              onError={(e) => {
                                e.target.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Crect fill='%23ddd' width='100' height='100'/%3E%3Ctext fill='%23999' font-family='sans-serif' font-size='14' dy='10.5' font-weight='bold' x='50%25' y='50%25' text-anchor='middle'%3EImage%3C/text%3E%3C/svg%3E"
                              }}
                            />
                            {image.caption && (
                              <Box
                                sx={{
                                  position: "absolute",
                                  bottom: 0,
                                  left: 0,
                                  right: 0,
                                  bgcolor: "rgba(0, 0, 0, 0.7)",
                                  color: "white",
                                  p: 1,
                                  fontSize: "0.75rem",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {image.caption}
                              </Box>
                            )}
                          </Box>
                        </Grid>
                      ))}
                    </Grid>
                  </CardContent>
                </Card>
              )}

              {/* Additional Information */}
              {(additional_data && (additional_data?.signature || additional_data?.additional_notes)) || quoted_by_details ? (
                <Card>
                  <Box sx={{ p: 3, py: 2 }}>
                    <Stack direction="row" alignItems="center" spacing={2}>
                      <Avatar sx={{ bgcolor: "#023c8f" }}>
                        <Info />
                      </Avatar>
                      <Typography variant="h6" sx={{ fontWeight: 600, color: "#023c8f" }}>
                        Additional Information
                      </Typography>
                    </Stack>
                  </Box>
                  <Divider />
                  <CardContent sx={{ p: 3 }}>
                    <Stack spacing={3}>
                      {quoted_by_details && (
                        <Box>
                          <Typography variant="subtitle2" sx={{ color: "#64748b", mb: 1 }}>
                            Quoted By
                          </Typography>
                          <Box
                            sx={{
                              // border: "1px solid #e2e8f0",
                              // borderRadius: 1,
                              p: 2,
                              bgcolor: "#f8fafc",
                            }}
                          >
                            <Typography variant="body1" sx={{ fontWeight: 500, color: "#023c8f" }}>
                              {quoted_by_details.full_name || `${quoted_by_details.first_name || ""} ${quoted_by_details.last_name || ""}`.trim()}
                            </Typography>
                            {/* {quoted_by_details.email && (
                              <Typography variant="body2" sx={{ color: "text.secondary", mt: 0.5 }}>
                                {quoted_by_details.email}
                              </Typography>
                            )} */}
                          </Box>
                        </Box>
                      )}

                      <Box>
                        <Typography variant="subtitle2" sx={{ color: "#64748b", mb: 2 }}>
                          Terms & Conditions
                        </Typography>
                        {quote?.status === "accepted" || "submitted" ? (
                          <Box
                            sx={{
                              border: "1px solid #e0e0e0",
                              borderRadius: "8px",
                              backgroundColor: "#f9fafb",
                              p: 2,
                              display: "flex",
                              alignItems: "flex-start",
                              gap: 1.5,
                            }}
                          >
                            <CheckCircle sx={{ color: "#42bd3f", mt: 0.25, flexShrink: 0 }} />
                            <Box sx={{ flex: 1 }}>
                              <Typography variant="body2" sx={{ color: "#374151", fontWeight: 500 }}>
                                I have read and agree to the Terms & Conditions and Privacy Policy
                              </Typography>
                              <Button
                                variant="text"
                                size="small"
                                onClick={() => setShowTermsDialog(true)}
                                startIcon={<Gavel />}
                                sx={{
                                  mt: 1,
                                  color: "#023c8f",
                                  textTransform: "none",
                                  fontSize: "0.75rem",
                                  "&:hover": {
                                    backgroundColor: "transparent",
                                    textDecoration: "underline",
                                  },
                                }}
                              >
                                View Terms & Conditions
                              </Button>
                            </Box>
                          </Box>
                        ) : (
                          <Button
                            variant="outlined"
                            onClick={() => setShowTermsDialog(true)}
                            startIcon={<Gavel />}
                            sx={{
                              borderColor: "#023c8f",
                              color: "#023c8f",
                              "&:hover": {
                                bgcolor: "rgba(2, 60, 143, 0.04)",
                                borderColor: "#023c8f",
                              },
                            }}
                          >
                            View Terms & Conditions
                          </Button>
                        )}
                      </Box>

                      {additional_data?.signature && (
                        <Box>
                          <Typography variant="subtitle2" sx={{ color: "#64748b", mb: 1 }}>
                            Signature
                          </Typography>
                          <Box
                            sx={{
                              border: "1px solid #ccc",
                              borderRadius: "8px",
                              backgroundColor: "white",
                              p: 2,
                              maxWidth: "400px",
                            }}
                          >
                            <img
                              src={`data:image/png;base64,${additional_data.signature}`}
                              alt="Signature"
                              style={{ 
                                width: "100%", 
                                maxWidth: "100%",
                                height: "auto",
                                display: "block",
                                marginBottom: "8px"
                              }}
                            />
                            {/* Timestamp display */}
                            {additional_data?.submitted_at && (
                              <Box
                                sx={{
                                  borderTop: "1px solid #e0e0e0",
                                  pt: 1.5,
                                  mt: 1.5,
                                  display: "flex",
                                  flexDirection: "column",
                                  gap: 0.75,
                                  fontSize: "0.75rem",
                                  color: "#6b7280",
                                }}
                              >
                                {contact && (contact?.first_name || contact?.last_name) && (
                                  <Typography variant="caption" sx={{ fontSize: "0.7rem", color: "#6b7280" }}>
                                    Signed by: {toTitleCase([contact?.first_name, contact?.last_name].filter(Boolean).join(' ')) || contact?.email || 'Customer'}
                                  </Typography>
                                )}
                                <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                                  <Typography variant="caption" sx={{ fontSize: "0.7rem", color: "#6b7280" }}>
                                    Date: {new Date(additional_data.submitted_at).toLocaleDateString('en-US', { 
                                      year: 'numeric', 
                                      month: 'long', 
                                      day: 'numeric' 
                                    })}
                                  </Typography>
                                  <Typography variant="caption" sx={{ fontSize: "0.7rem", color: "#6b7280" }}>
                                    Time: {new Date(additional_data.submitted_at).toLocaleTimeString('en-US', { 
                                      hour: '2-digit', 
                                      minute: '2-digit',
                                      hour12: true 
                                    })}
                                  </Typography>
                                </Box>
                              </Box>
                            )}
                          </Box>
                        </Box>
                      )}

                      {additional_data?.additional_notes && (
                        <Box>
                          <Typography variant="subtitle2" sx={{ color: "#64748b", mb: 1 }}>
                            Additional Notes
                          </Typography>
                          <Box
                            sx={{
                              border: "1px solid #334155",
                              borderRadius: 1,
                              p: 2,
                            }}
                          >
                            <Typography variant="body2">{additional_data.additional_notes}</Typography>
                          </Box>
                        </Box>
                      )}
                    </Stack>
                  </CardContent>
                </Card>
              ) : null}
            </Box>

            {/* Right column - pricing */}
            <Box>
              <Paper elevation={3} sx={{ borderRadius: 2, position: "sticky", top: 80, overflow: "hidden" }}>
                <Box
                  sx={{
                    background: "#023c8f",
                    color: "white",
                    px: 3,
                    py: 2,
                    display: "flex",
                    alignItems: "center",
                    gap: 1,
                  }}
                >
                  <Receipt fontSize="small" />
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    Pricing Summary
                  </Typography>
                </Box>

                <CardContent>
                  <Box display="flex" flexDirection="column" gap={2}>
                    {/* Sum of services */}
                    {service_selections?.map((service) => (
                      <Box
                        key={service.id}
                        sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}
                      >
                        <Typography variant="body2">{service.service_details?.name}</Typography>
                        <Typography variant="subtitle2">{formatPrice(service.final_total_price)}</Typography>
                      </Box>
                    ))}

                    {/* Custom Services Price */}
                    {custom_service_total && Number.parseFloat(custom_service_total) > 0 && (
                      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <Typography variant="body2">Custom Services</Typography>
                        <Typography variant="subtitle2">{formatPrice(custom_service_total)}</Typography>
                      </Box>
                    )}

                    {
                      /* Surcharge display (if needed in the future) */
                      total_surcharges > 0 && (
                        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <Typography variant="body2">Trip Surcharge</Typography>
                          <Typography variant="subtitle2">{formatPrice(total_surcharges)}</Typography>
                        </Box>
                      )
                    }

                    {/* Calculate totals */}
                    {(() => {
                      const totalServicePrice =
                        service_selections?.reduce((sum, s) => sum + Number(s.final_total_price || 0), 0) || 0

                      const subtotal = totalServicePrice + Number(custom_service_total || 0)

                      // final_total already includes custom services, surcharges, and minimum-price floor
                      const lineSubtotal =
                        totalServicePrice +
                        Number(custom_service_total || 0) +
                        Number(total_surcharges || 0)
                      const storedFinal = Number(final_total || 0)
                      const finalNumeric = storedFinal > 0 ? storedFinal : lineSubtotal
                      const taxRate = parseFloat(import.meta.env.VITE_TAX_RATE) || 0.0825
                      const taxAmount = finalNumeric * taxRate
                      const finalWithTax = finalNumeric + taxAmount

                      return (
                        <>
                          {/* Adjustments */}
                          {/* <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <Typography variant="body2">Adjustments</Typography>
                            <Typography variant="subtitle2">{formatPrice(adjustment)}</Typography>
                          </Box> */}

                          {/* Tax */}
                          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <Typography variant="body2">Tax ({(taxRate * 100).toFixed(2)}%)</Typography>
                            <Typography variant="subtitle2">{formatPrice(taxAmount)}</Typography>
                          </Box>

                          {/* Note if subtotal < base price */}
                          {subtotal < (globalPriceData?.base_price || 0) && (
                            <Typography variant="caption" color="error">
                              Note: Minimum base price is {formatPrice(globalPriceData?.base_price || 0)}
                            </Typography>
                          )}

                          <Divider />

                          {/* Final Total */}
                          <Box
                            sx={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              background: "rgba(243,244,246,0.5)",
                              p: 1,
                              borderRadius: 1,
                            }}
                          >
                            <Typography variant="subtitle1" fontWeight="600">
                              Final Total
                            </Typography>
                            <div className="flex flex-col">
                              <Typography variant="h5" fontWeight="500" color="#42bd3f">
                                {formatPrice(finalWithTax)}
                              </Typography>
                              <Typography variant="caption" color="text.secondary" align="center">
                                Tax included
                              </Typography>
                            </div>
                          </Box>
                        </>
                      )
                    })()}

                    <Divider />
                    <Box display={"flex"} flexDirection={"column"} alignItems={"center"} gap={1}>
                      <Typography variant="caption" color="text.secondary" align="center">
                      Quote created on{" "}
                      {new Date(created_at).toLocaleString(undefined, {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" align="center"
                      sx={{
                        fontWeight: 600,
                        fontSize:{ xs: "0.7rem", sm: "0.8rem", md: "0.8rem"},
                        borderRadius: 0.3,
                        bgcolor: status?.toLowerCase() === 'rejected' ? "#FFE5E5" : "#D9FFD9",
                        color: status?.toLowerCase() === 'rejected' ? "#d32f2f" : "success.dark",
                        width:"fit-content",
                        px:3
                      }}
                    >
                      Status:{" "}
                      {status?.charAt(0).toUpperCase() + status?.slice(1)}
                    </Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Paper>
            </Box>
          </Box>
        </Container>
      </Box>

      {/* Image Viewer */}
      <ImageViewer
        open={!!selectedImage}
        onClose={() => setSelectedImage(null)}
        image={selectedImage}
        showCaption={true}
      />

      {/* Terms & Conditions Dialog */}
      <Dialog
        open={showTermsDialog}
        onClose={() => setShowTermsDialog(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3,
            maxHeight: "80vh",
          },
        }}
      >
        <DialogTitle
          sx={{
            bgcolor: "#023c8f",
            color: "white",
            display: "flex",
            alignItems: "center",
            gap: 1,
          }}
        >
          <Gavel />
          Terms & Conditions
        </DialogTitle>
        <DialogContent sx={{ p: 3 }}>
          <TermsContent />
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 0 }}>
          <Button
            onClick={() => setShowTermsDialog(false)}
            variant="contained"
            sx={{
              bgcolor: "#023c8f",
              "&:hover": { bgcolor: "#012a6b" },
            }}
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

export default QuoteDetailsPage
