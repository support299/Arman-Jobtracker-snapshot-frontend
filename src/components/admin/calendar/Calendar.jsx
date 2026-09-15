import { useState, useEffect, useRef, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import { DndProvider, useDrop } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import moment from "moment-timezone";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarDays, ChevronLeft, ChevronRight, Loader2, RotateCcw, CheckCircle2, Filter, X, Trash2, Plus, User, Phone, Mail, MapPin, PanelRightClose, PanelLeftClose } from "lucide-react";
import { cn } from "@/lib/utils";
import { Calendar as DatePicker } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAccountTimezone } from "@/hooks/useAccountTimezone";
import { useMoneyFormatter } from "@/hooks/useMoneyFormatter";
import { DayByTechnicianView } from "./DayByTechnicianView";
import { getUsHolidayMap, toLocalDateKey } from "@/utils/usHolidays";
// FullCalendar v6 injects CSS via JS – no manual import. Overrides below for design + mobile.

// FullCalendar custom styles – match current design, mobile-friendly, light borders like day view
const calendarStyles = `
  .fc {
    font-family: inherit;
    --fc-border-color: #e5e7eb;
    --fc-page-bg-color: transparent;
  }
  .fc-toolbar-title { font-size: 1.25rem; }
  .fc .fc-button { padding: 0.25rem 0.5rem; font-size: 0.875rem; }
  .fc-theme-standard .fc-scrollgrid,
  .fc-theme-standard .fc-scrollgrid td,
  .fc-theme-standard .fc-scrollgrid th { border-color: #e5e7eb !important; }
  .fc-theme-standard td,
  .fc-theme-standard th { border-color: #e5e7eb !important; }
  .fc .fc-daygrid-body-unbalanced .fc-daygrid-day-events,
  .fc .fc-daygrid-day-frame,
  .fc .fc-timegrid-axis,
  .fc .fc-timegrid-slot-label,
  .fc .fc-col-header-cell { border-color: #e5e7eb !important; }
  .fc-daygrid-day-number { padding: 4px 6px; font-weight: 600; font-size: 13px; }
  .fc-event { border: none; border-radius: 6px; padding: 4px 6px; cursor: pointer; font-weight: 500; font-size: 13px; }
  .fc-event:hover { transform: translateY(-1px); }
  .fc-timegrid-slot { height: 48px; border-color: #e5e7eb !important; }
  .fc-timegrid-slot-label { font-size: 12px; }
  .fc .fc-scrollgrid-section > *,
  .fc .fc-daygrid-day,
  .fc .fc-col-header-cell { border-color: #e5e7eb !important; }
  @media (max-width: 639px) {
    .fc-toolbar-title { font-size: 1rem; }
    .fc .fc-button { padding: 0.2rem 0.4rem; font-size: 0.75rem; }
    .fc-daygrid-day-number { padding: 2px 4px; font-size: 11px; }
    .fc-event { padding: 4px 6px; font-size: 10px; border-radius: 4px; }
    .fc-scrollgrid { overflow-x: auto; -webkit-overflow-scrolling: touch; }
  }
  .fc-daygrid-day-frame { min-height: 80px; }
  .fc-more-link { font-size: 12px; }
  .daily-job-total-fc {
    font-size: 10px; font-weight: 700; color: #111827;
    padding: 2px 4px; margin: 0; pointer-events: none;
  }
  @media (max-width: 639px) {
    .daily-job-total-fc { font-size: 7px; }
  }
  .fc-us-holiday {
    display: block;
    font-size: 10px;
    font-weight: 700;
    color: #c2410c;
    line-height: 1.15;
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .fc .fc-daygrid-day.fc-us-holiday-day {
    background-color: #fff7ed;
  }
  .fc .fc-daygrid-day.fc-day-today.fc-us-holiday-day {
    background-color: #ffedd5;
  }
  .fc .fc-col-header-cell.fc-us-holiday-day {
    background-color: #fff7ed;
  }
  .fc-day-header-with-holiday {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    line-height: 1.2;
  }
  @media (max-width: 639px) {
    .fc-us-holiday { font-size: 8px; }
  }
  /* Legacy RBC styles kept for any leftover refs – can remove once confirmed unused */
  .rbc-calendar {
  .rbc-calendar {
    width: 100% !important;
    max-width: 100% !important;
    overflow-x: auto !important;
    overflow-y: visible !important;
  }
  @media (max-width: 639px) {
    .rbc-calendar {
      overflow-x: auto !important;
      -webkit-overflow-scrolling: touch !important;
    }
  }
  .rbc-month-view {
    width: 100% !important;
    max-width: 100% !important;
    min-width: 600px !important;
  }
  @media (min-width: 640px) {
    .rbc-month-view {
      min-width: 100% !important;
    }
  }
  .rbc-month-row {
    width: 100% !important;
    max-width: 100% !important;
  }
  .rbc-day-bg {
    width: 100% !important;
  }
  .rbc-header {
    width: 100% !important;
    padding: 8px 4px !important;
    font-size: 11px !important;
    font-weight: 600 !important;
  }
  @media (min-width: 640px) {
    .rbc-header {
      padding: 10px 8px !important;
      font-size: 14px !important;
    }
  }
  .rbc-date-cell {
    padding: 4px !important;
    font-size: 11px !important;
    font-weight: 600 !important;
  }
  @media (min-width: 640px) {
    .rbc-date-cell {
      padding: 6px !important;
      font-size: 13px !important;
    }
  }
  .rbc-event {
    border-radius: 6px !important;
    padding: 0 !important;
    font-size: 13px !important;
    font-weight: 500 !important;
    box-shadow: none !important;
    border: none !important;
    outline: none !important;
    margin: 1px 0 !important;
    transition: all 0.2s ease !important;
    overflow: visible !important;
    cursor: pointer !important;
    pointer-events: auto !important;
  }
  @media (min-width: 640px) {
    .rbc-event {
      margin: 2px 0 !important;
    }
  }
  @media (min-width: 1024px) {
    .rbc-event {
      margin: 2px 0 !important;
    }
  }
  .rbc-event-wrapper {
    border: none !important;
    outline: none !important;
    box-shadow: none !important;
    background: transparent !important;
    padding: 0 !important;
    border-radius: 6px !important;
    overflow: visible !important;
    pointer-events: auto !important;
    cursor: pointer !important;
  }
  .rbc-event-wrapper * {
    pointer-events: auto !important;
  }
  .rbc-event:hover {
    box-shadow: none !important;
    transform: translateY(-1px) !important;
    border: none !important;
    outline: none !important;
    z-index: 10 !important;
  }
  .rbc-event:hover .rbc-event-content {
    box-shadow: none !important;
  }
  .rbc-event-content {
    line-height: 1.3 !important;
    overflow: visible !important;
    text-overflow: ellipsis !important;
    white-space: nowrap !important;
    border: none !important;
    outline: none !important;
    padding: 4px 6px !important;
    border-radius: 6px !important;
    box-shadow: none !important;
    min-height: 20px !important;
    display: flex !important;
    align-items: center !important;
    font-size: 13px !important;
  }
  @media (min-width: 640px) {
    .rbc-event-content {
      padding: 5px 8px !important;
      min-height: 24px !important;
    }
  }
  @media (min-width: 1024px) {
    .rbc-event-content {
      padding: 6px 10px !important;
      min-height: 28px !important;
    }
  }
  .rbc-event-content-responsive {
    padding: 4px 6px !important;
    font-size: 13px !important;
    min-height: 20px !important;
    box-shadow: none !important;
    pointer-events: auto !important;
    cursor: pointer !important;
  }
  .rbc-event-content-responsive,
  .rbc-event-content-responsive span,
  .rbc-event-content-responsive * {
    font-size: 13px !important;
  }
  .rbc-event-content-responsive span,
  .rbc-event-content-responsive * {
    pointer-events: none !important;
  }
  @media (min-width: 640px) {
    .rbc-event-content-responsive {
      padding: 5px 8px !important;
      font-size: 13px !important;
      min-height: 24px !important;
    }
    .rbc-event-content-responsive,
    .rbc-event-content-responsive span,
    .rbc-event-content-responsive * {
      font-size: 13px !important;
    }
    .rbc-event-content-responsive span,
    .rbc-event-content-responsive * {
      pointer-events: none !important;
    }
  }
  @media (min-width: 1024px) {
    .rbc-event-content-responsive {
      padding: 6px 10px !important;
      font-size: 13px !important;
      min-height: 28px !important;
    }
    .rbc-event-content-responsive,
    .rbc-event-content-responsive span,
    .rbc-event-content-responsive * {
      font-size: 13px !important;
    }
    .rbc-event-content-responsive span,
    .rbc-event-content-responsive * {
      pointer-events: none !important;
    }
  }
  .rbc-event-content-responsive .recurring-indicator {
    font-size: 11px !important;
  }
  /* Mobile-specific improvements - Google Calendar style */
  @media (max-width: 639px) {
    .rbc-event {
      width: 100% !important;
      min-width: 100% !important;
      margin: 1px 0 !important;
      border-radius: 4px !important;
    }
  .rbc-event-wrapper {
    width: 100% !important;
    min-width: 100% !important;
    pointer-events: auto !important;
    cursor: pointer !important;
  }
    .rbc-event-content-responsive {
      padding: 4px 6px !important;
      font-size: 10px !important;
      min-height: 20px !important;
      line-height: 1.2 !important;
      width: 100% !important;
      white-space: nowrap !important;
      overflow: hidden !important;
      text-overflow: ellipsis !important;
      justify-content: center !important;
    }
    .rbc-event-content-responsive .truncate {
      white-space: nowrap !important;
      overflow: hidden !important;
      text-overflow: ellipsis !important;
      line-height: 1.2 !important;
      display: block !important;
      text-align: center !important;
      font-size: 10px !important;
      font-weight: 500 !important;
      pointer-events: none !important;
    }
    .rbc-event-content-responsive span,
    .rbc-event-content-responsive * {
      pointer-events: none !important;
    }
    .rbc-event-content-responsive,
    .rbc-event-content-responsive span:not(.recurring-indicator) {
      font-size: 10px !important;
      font-weight: 500 !important;
    }
    .rbc-event-content-responsive .recurring-indicator {
      font-size: 8px !important;
      margin-left: 2px !important;
      font-weight: 600 !important;
    }
    .rbc-month-view .rbc-day-bg {
      min-height: 50px !important;
    }
    .rbc-month-row {
      min-height: 50px !important;
    }
    .rbc-date-cell {
      padding: 2px 4px !important;
      font-size: 11px !important;
    }
    .rbc-header {
      padding: 8px 4px !important;
      font-size: 11px !important;
    }
  }
  .rbc-event-label {
    display: none !important;
  }
  .rbc-day-slot .rbc-time-slot {
    border-top: none !important;
  }
  .rbc-time-slot {
    border-top: 1px solid #f0f0f0 !important;
  }
  .rbc-event-selected {
    border: none !important;
    outline: none !important;
  }
  .rbc-event:focus {
    border: none !important;
    outline: none !important;
  }
  .rbc-event.rbc-selected {
    border: none !important;
    outline: none !important;
  }
  .rbc-day-slot .rbc-event {
    border: none !important;
    outline: none !important;
    margin: 0 !important;
  }
  .rbc-month-view .rbc-event {
    border: none !important;
    outline: none !important;
    margin: 0 !important;
  }
  .rbc-month-view .rbc-day-slot .rbc-event {
    margin: 0 !important;
  }
  .rbc-day-slot .rbc-events-container {
    margin: 0 !important;
  }
  .rbc-day-slot .rbc-events-container .rbc-event {
    margin: 0 !important;
  }
  .rbc-day-bg {
    overflow: visible !important;
  }
  .rbc-day-slot {
    overflow: visible !important;
  }
  .rbc-date-cell {
    overflow: visible !important;
  }
  .rbc-month-view .rbc-day-bg {
    overflow: visible !important;
  }
  .rbc-month-view .rbc-day-slot {
    overflow: visible !important;
  }
  .rbc-month-view .rbc-date-cell {
    overflow: visible !important;
  }
  .rbc-month-row {
    overflow: visible !important;
  }
  .rbc-month-view .rbc-month-row {
    overflow: visible !important;
  }
  .rbc-row-content {
    overflow: visible !important;
  }
  .rbc-month-view .rbc-row-content {
    overflow: visible !important;
  }
  .rbc-day-bg {
    position: relative !important;
  }
  .rbc-month-view .rbc-day-bg {
    position: relative !important;
  }
  .rbc-month-view .rbc-day-bg.has-daily-total {
    overflow: visible !important;
  }
  @media (min-width: 640px) {
    .rbc-month-view .rbc-day-bg.has-daily-total {
      display: flex !important;
      flex-direction: column !important;
    }
    .rbc-month-view .rbc-day-bg.has-daily-total .rbc-events-container {
      flex: 1 1 auto !important;
      overflow: visible !important;
    }
  }
  @media (max-width: 639px) {
    .rbc-month-view .rbc-day-bg.has-daily-total {
      min-height: auto !important;
      padding-bottom: 0 !important;
      display: block !important;
    }
  }
  .rbc-month-view .rbc-row-content {
    overflow: visible !important;
  }
  .rbc-month-row {
    overflow: visible !important;
  }
  .rbc-month-view .rbc-day-slot {
    position: relative !important;
  }
  .rbc-month-view .rbc-events-container {
    position: relative !important;
  }
  .daily-job-total {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif !important;
    letter-spacing: 0.01em !important;
    display: block !important;
    visibility: visible !important;
    opacity: 1 !important;
    pointer-events: none !important;
    white-space: nowrap !important;
  }
  /* Day/Week resource view: one column per technician (resourceGroupingLayout) */
  .rbc-time-view-resources .rbc-time-header-content .rbc-row.rbc-row-resource .rbc-header,
  .rbc-time-view-resources .rbc-resource-grouping .rbc-header {
    padding: 8px 10px !important;
    font-size: 13px !important;
    font-weight: 600 !important;
    border-left: 1px solid var(--rbc-border, #ddd) !important;
    min-width: 120px !important;
  }
  .rbc-time-view-resources .rbc-time-content {
    display: flex !important;
    overflow-x: auto !important;
  }
  /* Range-first layout: one flex row per date, columns = resources; align with header */
  .rbc-time-view-resources .rbc-time-content > div {
    display: flex !important;
    flex: 1 !important;
    min-width: 0 !important;
  }
  .rbc-time-view-resources .rbc-time-content .rbc-day-slot {
    flex: 1 1 0% !important;
    min-width: 120px !important;
  }
  .rbc-time-view-resources .rbc-time-gutter {
    flex-shrink: 0 !important;
  }
  .rbc-time-view-resources .rbc-time-header-gutter {
    min-width: 50px !important;
  }
  .rbc-time-view-resources .rbc-time-header-content.rbc-resource-grouping {
    flex: 1 1 0% !important;
    min-width: 120px !important;
  }
  /* Time column: reduce width so more space for technician columns */
  .rbc-time-gutter,
  .rbc-time-view-resources .rbc-time-gutter {
    max-width: 52px !important;
    min-width: 44px !important;
    width: 48px !important;
  }
  .rbc-time-header-gutter,
  .rbc-time-view-resources .rbc-time-header-gutter,
  .rbc-label.rbc-time-header-gutter {
    max-width: 52px !important;
    min-width: 44px !important;
    width: 48px !important;
  }
  @media (max-width: 639px) {
    .rbc-time-gutter,
    .rbc-time-view-resources .rbc-time-gutter {
      max-width: 44px !important;
      min-width: 38px !important;
      width: 42px !important;
    }
    .rbc-time-header-gutter,
    .rbc-time-view-resources .rbc-time-header-gutter,
    .rbc-label.rbc-time-header-gutter {
      max-width: 44px !important;
      min-width: 38px !important;
      width: 42px !important;
    }
  }
  /* Events above time column (time gutter has z-index 10) */
  .rbc-time-view .rbc-day-slot .rbc-event-wrapper,
  .rbc-time-view .rbc-day-slot .rbc-event,
  .rbc-time-view .rbc-day-slot .rbc-events-container .rbc-event {
    z-index: 15 !important;
    position: relative !important;
  }
  .rbc-time-view .rbc-day-slot .rbc-events-container {
    z-index: 5 !important;
  }
  /* Mobile styles - top left position */
  @media (max-width: 639px) {
    .daily-job-total {
      position: absolute !important;
      top: 2px !important;
      left: 2px !important;
      z-index: 999 !important;
      max-width: calc(100% - 4px) !important;
      overflow: hidden !important;
      text-overflow: ellipsis !important;
      background: transparent !important;
      border: none !important;
      box-shadow: none !important;
      font-size: 7px !important;
      font-weight: 700 !important;
      color: #111827 !important;
      padding: 2px 4px !important;
      margin: 0 !important;
      text-align: left !important;
    }
    .rbc-month-view .rbc-day-bg.has-daily-total {
      position: relative !important;
      overflow: visible !important;
    }
    .rbc-month-view .rbc-date-cell {
      z-index: 1 !important;
      position: relative !important;
    }
  }
  /* Desktop styles - top left position */
  @media (min-width: 640px) {
    .daily-job-total {
      position: absolute !important;
      top: 2px !important;
      left: 2px !important;
      z-index: 999 !important;
      max-width: calc(100% - 4px) !important;
      overflow: hidden !important;
      text-overflow: ellipsis !important;
      background: transparent !important;
      border: none !important;
      box-shadow: none !important;
      font-size: 10px !important;
      font-weight: 700 !important;
      color: #111827 !important;
      padding: 2px 4px !important;
      margin: 0 !important;
      text-align: left !important;
    }
    .rbc-month-view .rbc-day-bg.has-daily-total {
      position: relative !important;
      overflow: visible !important;
    }
    .rbc-month-view .rbc-date-cell {
      z-index: 1 !important;
      position: relative !important;
    }
  }
  .rbc-month-view .rbc-day-bg.has-daily-total .rbc-events-container {
    margin-bottom: 0 !important;
  }
  .rbc-month-view .rbc-events-container {
    padding: 2px 1px !important;
    position: relative !important;
  }
  .rbc-month-view .rbc-day-bg {
    padding: 2px !important;
  }
  .rbc-month-view .rbc-event {
    position: relative !important;
    z-index: 2 !important;
  }
`;

function formatInvoiceStatusLabel(status) {
  const raw = String(status || "").trim();
  if (!raw) return "";
  return raw
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function buildCalendarEventTooltip(baseTitle, type, invoiceStatusLabel) {
  if (type !== "job" || !invoiceStatusLabel) return baseTitle;
  return `${baseTitle}\nInvoice: ${invoiceStatusLabel}`;
}
import { JobCard } from "../jobs/JobCard";
import { jobsApi, useGetCalendarJobsQuery, useGetAppointmentsCalendarQuery, useGetEstimateAppointmentsCalendarQuery, useGetJobDetailsQuery, useUpdateAppointmentMutation, useDeleteAppointmentMutation, useUpdateEstimateStatusMutation, useDeleteEstimateMutation } from "../../../store/api/jobsApi";
import { useGetTimeOffListQuery, useGetEmployeesQuery } from "../../../store/api/payrollApi";
import {
  formatEquivalentDays,
  formatTimeOffScheduleSummary,
} from "../payroll/timeOffCoverage";
import { useSelector, useDispatch } from "react-redux";
import { EditJobDialog } from "../jobs/EditJobDialog";
import { TimelineSidebar } from "./TimelineSidebar";
import { useUpdateJobMutation } from "../../../store/api/jobsApi";
import { jobGrandTotalAmount } from "../../../utils/jobPricing";
import { Typography } from "@mui/material";

const TIME_OFF_KIND_LABELS = {
  day_off: "Day off",
  vacation: "Vacation",
  sick: "Sick",
  personal: "Personal",
  other: "Time off",
};

function parseYmdToLocalDate(ymd) {
  const [y, m, d] = String(ymd || "").split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function addDaysLocal(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

/** Event range [start, endExclusive) overlaps a calendar day (local). */
function timeOffRangeOverlapsDay(evStart, evEndExclusive, dayDate) {
  const dayStart = new Date(dayDate);
  dayStart.setHours(0, 0, 0, 0);
  const dayNext = new Date(dayStart);
  dayNext.setDate(dayNext.getDate() + 1);
  const s = new Date(evStart);
  const e = new Date(evEndExclusive);
  return s < dayNext && e > dayStart;
}

// Custom Event Content for FullCalendar – same design, accepts staff drops
function FullCalendarEventContent({ arg, onStaffDrop, onSelectEvent, eventStyleGetter }) {
  const [isMobile, setIsMobile] = useState(typeof window !== "undefined" && window.innerWidth < 640);
  const fcEvent = arg.event;
  const extended = fcEvent.extendedProps || {};
  const resource = extended.resource;
  const type = extended.type || "job";
  const title = fcEvent.title || "";
  const start = fcEvent.start;

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const getDisplayTitle = () => {
    if (!isMobile) return title;
    if (start) {
      const d = new Date(start);
      const h = d.getHours();
      const m = d.getMinutes();
      const ampm = h >= 12 ? "PM" : "AM";
      const h12 = h % 12 || 12;
      return m === 0 ? `${h12} ${ampm}` : `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
    }
    return title.substring(0, 6);
  };

  const displayTitle = getDisplayTitle();
  const isAppointment = type === "appointment";
  const blockStaffDrop = isAppointment || type === "time_off";

  const [{ isOver }, drop] = useDrop({
    accept: "staff",
    drop: (item) => {
      if (onStaffDrop && resource && !blockStaffDrop) onStaffDrop(resource, item.user);
    },
    canDrop: () => !blockStaffDrop,
    collect: (monitor) => ({ isOver: monitor.isOver() && !blockStaffDrop }),
  });

  const syntheticEvent = {
    id: fcEvent.id,
    title: fcEvent.title,
    start: fcEvent.start,
    end: fcEvent.end,
    resource,
    type,
  };

  let backgroundColor = "#9ca3ef";
  if (eventStyleGetter) {
    const result = eventStyleGetter(syntheticEvent);
    backgroundColor = result?.style?.["--event-bg-color"] || result?.style?.backgroundColor || backgroundColor;
  } else if (type === "appointment" && resource) {
    const status = resource.appointment_status;
    if (status === "confirmed") backgroundColor = "#06b6d4";
    else if (status === "cancelled") backgroundColor = "#ef4444";
    else if (status === "showed") backgroundColor = "#10b981";
    else if (status === "noshow") backgroundColor = "#f59e0b";
    else if (status === "invalid") backgroundColor = "#6b7280";
  } else if (type === "estimate" && resource) {
    const s = resource.estimate_status ?? resource.appointment_status ?? "confirmed";
    if (s === "quoted") backgroundColor = "#f97316";
    else if (s === "accepted") backgroundColor = "#22c55e";
    else if (s === "canceled" || s === "cancelled") backgroundColor = "#ef4444";
    else if (s === "declined" || s === "expired") backgroundColor = "#6b7280";
    else backgroundColor = "#14b8a6";
  } else if (resource?.status) {
    if (resource.status === "pending") backgroundColor = "#f59e0b";
    else if (resource.status === "in_progress") backgroundColor = "#3b82f6";
    else if (resource.status === "completed") backgroundColor = "#10b981";
    else if (resource.status === "cancelled") backgroundColor = "#ef4444";
  }

  const isRecurring = resource?.job_type === "recurring";
  const isEstimate = type === "estimate";
  const isTimeOff = type === "time_off";
  const invoiceStatusLabel = type === "job" ? formatInvoiceStatusLabel(resource?.invoice_status) : "";
  const tooltipTitle = buildCalendarEventTooltip(title, type, invoiceStatusLabel);

  return (
    <div
      ref={drop}
      className={cn(
        "fc-event-main-frame flex items-center w-full h-full rounded overflow-hidden",
        isOver && "ring-2 ring-offset-1 ring-white/80"
      )}
      style={{
        backgroundColor,
        color: "white",
        padding: isMobile ? "4px 6px" : "6px 10px",
        fontSize: isMobile ? 10 : 13,
        fontWeight: 500,
        border: "none",
        borderRadius: isMobile ? 4 : 6,
      }}
      onClick={(e) => {
        e.stopPropagation();
        onSelectEvent?.(syntheticEvent);
      }}
      title={tooltipTitle}
    >
      <span className="truncate flex items-center gap-1 flex-1 min-w-0">
        <span className="truncate">{displayTitle}</span>
        {isRecurring && <span className="flex-shrink-0 text-[11px]">(R)</span>}
        {isEstimate && <span className="flex-shrink-0 text-[11px]">(E)</span>}
        {isTimeOff && <span className="flex-shrink-0 text-[11px]">(Off)</span>}
        {invoiceStatusLabel && (
          <span className="flex-shrink-0 rounded bg-black/15 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white/95">
            {invoiceStatusLabel}
          </span>
        )}
      </span>
    </div>
  );
}

// Legacy DroppableEvent kept for any non-FC usage (e.g. day view uses DayByTechnicianView)
function DroppableEvent({ event, title, style, onStaffDrop, onSelectEvent, continuesPrior, continuesAfter, ...props }) {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 640);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const getDisplayTitle = () => {
    if (!isMobile) return title || event?.title || "";
    if (event?.start) {
      const eventDate = new Date(event.start);
      const hours = eventDate.getHours();
      const minutes = eventDate.getMinutes();
      const ampm = hours >= 12 ? "PM" : "AM";
      const displayHours = hours % 12 || 12;
      if (minutes === 0) return `${displayHours} ${ampm}`;
      return `${displayHours}:${minutes.toString().padStart(2, "0")} ${ampm}`;
    }
    const fullTitle = title || event?.title || "";
    const timeMatch = fullTitle.match(/^(\d{1,2}(?::\d{2})?\s?(AM|PM))/i);
    return timeMatch ? timeMatch[1] : fullTitle.substring(0, 6);
  };

  const displayTitle = getDisplayTitle();

  if (event?.type === "more") {
    return (
      <div
        className="rbc-event"
        style={{ backgroundColor: "transparent", border: "none", outline: "none", borderRadius: "8px", padding: 0, boxShadow: "none", margin: 0, cursor: "pointer" }}
        onClick={(e) => { e.stopPropagation(); onSelectEvent?.(event); }}
        title={event?.title}
        {...props}
      >
        <div className="truncate" style={{ lineHeight: "1.4", backgroundColor: "#e5e7eb", borderRadius: "8px", padding: "6px 10px", fontWeight: 500, fontSize: 13, color: "#374151" }}>
          {event?.title || "+more"}
        </div>
      </div>
    );
  }

  const isAppointment = event?.type === "appointment";
  const [{ isOver }, drop] = useDrop({
    accept: "staff",
    drop: (item) => { if (onStaffDrop && event?.resource && !isAppointment) onStaffDrop(event.resource, item.user); },
    canDrop: () => !isAppointment,
    collect: (monitor) => ({ isOver: monitor.isOver() && !isAppointment }),
  });

  // Use a ref to ensure click handler works on first render
  const eventRef = useRef(null);
  const clickHandlerRef = useRef(null);
  
  useEffect(() => {
    // Attach click handler directly to DOM element to ensure it works on first render
    const element = eventRef.current;
    if (element && onSelectEvent && event) {
      const handleClick = (e) => {
        // Handle all clicks on this element
        e.stopPropagation();
        e.preventDefault();
        console.log('Direct DOM click handler:', event.type, 'target:', e.target.className);
        if (onSelectEvent && event) {
          onSelectEvent(event);
        }
      };
      // Use capture phase to catch clicks early, before any other handlers
      element.addEventListener('mousedown', handleClick, true);
      element.addEventListener('click', handleClick, true);
      clickHandlerRef.current = handleClick;
      return () => {
        if (clickHandlerRef.current && element) {
          element.removeEventListener('mousedown', clickHandlerRef.current, true);
          element.removeEventListener('click', clickHandlerRef.current, true);
        }
      };
    }
  }, [event, onSelectEvent]);

  const eventStyle = style || {};
  const eventTitle = title || event?.title || "";
  
  // Use displayTitle (already calculated above) for rendering
  // displayTitle will show only time on mobile, full title on desktop
  
  // Check if job is recurring
  const resource = event?.resource;
  const isRecurring = resource && (
    resource.job_type === "recurring"
  );
  const isEstimate = event?.type === "estimate";
  const invoiceStatusLabel = event?.type === "job" ? formatInvoiceStatusLabel(resource?.invoice_status) : "";
  const tooltipTitle = buildCalendarEventTooltip(eventTitle, event?.type, invoiceStatusLabel);
  
  // Get the background color from the event style (set by eventStyleGetter)
  // We need to extract it from the parent wrapper's computed style or pass it differently
  let backgroundColor = "#9ca3ef"; // Default
  
  if (event?.type === 'appointment') {
    const appointment = resource;
    switch (appointment?.appointment_status) {
      case "new":
        backgroundColor = "#9ca3ef"; // Light purple-blue for unconfirmed
        break;
      case "confirmed":
        backgroundColor = "#06b6d4"; // Cyan
        break;
      case "cancelled":
        backgroundColor = "#ef4444"; // Red
        break;
      case "showed":
        backgroundColor = "#10b981"; // Green
        break;
      case "noshow":
        backgroundColor = "#f59e0b"; // Orange/Yellow
        break;
      case "invalid":
        backgroundColor = "#6b7280"; // Gray
        break;
      default:
        backgroundColor = "#9ca3ef";
    }
  } else if (event?.type === 'estimate') {
    // Handle estimates with distinct colors
    const estimate = resource;
    // Get estimate status - check both estimate_status and appointment_status
    const estimateStatus = estimate?.estimate_status ?? estimate?.appointment_status ?? "confirmed";
    
    switch (estimateStatus) {
      // Prior quoting - estimates not yet quoted
      case "confirmed":
      case "on_my_way":
      case "in_progress":
        backgroundColor = "#14b8a6"; // Teal - distinct from jobs
        break;
      // Quoted
      case "quoted":
        backgroundColor = "#f97316"; // Orange - distinct from jobs
        break;
      // Accepted
      case "accepted":
        backgroundColor = "#22c55e"; // Emerald green - distinct from completed jobs
        break;
      // Other statuses
      case "canceled":
      case "cancelled":
        backgroundColor = "#ef4444"; // Red
        break;
      case "declined":
        backgroundColor = "#6b7280"; // Gray
        break;
      case "expired":
        backgroundColor = "#9ca3af"; // Light gray
        break;
      default:
        backgroundColor = "#14b8a6"; // Default to teal for prior quoting
    }
  } else if (resource) {
    const job = resource;
    switch (job?.status) {
      case "scheduled":
        backgroundColor = "#9ca3ef";
        break;
      case "pending":
        backgroundColor = "#f59e0b";
        break;
      case "in_progress":
        backgroundColor = "#3b82f6";
        break;
      case "onhold":
        backgroundColor = "#8b5cf6";
        break;
      case "completed":
        backgroundColor = "#10b981";
        break;
      case "cancelled":
        backgroundColor = "#ef4444";
        break;
      default:
        backgroundColor = "#9ca3ef";
    }
  }

  // React-big-calendar applies styles from eventPropGetter to a wrapper div
  // We'll apply the background color and padding directly to our inner content div
  return (
    <div
      ref={(node) => {
        drop(node);
        eventRef.current = node;
      }}
      className={cn(
        "rbc-event",
        isOver && "rbc-event-droppable"
      )}
      onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
        // Call onSelectEvent directly
        if (onSelectEvent && event) {
          console.log('Event clicked in wrapper:', event.type);
          onSelectEvent(event);
        }
      }}
      style={{
        backgroundColor: backgroundColor,
        outline: "none",
        borderRadius: isMobile ? "4px" : "6px",
        padding: isMobile ? "4px 6px" : "6px 10px",
        boxShadow: "none",
        margin: "0",
        cursor: "pointer",
        pointerEvents: "auto",
        position: "relative",
        zIndex: 10,
        width: "100%",
        height: "100%",
        minHeight: "20px",
        lineHeight: isMobile ? "1.2" : "1.3",
        fontWeight: "500",
        color: "white",
        display: "flex",
        alignItems: "center",
        justifyContent: isMobile ? "center" : "space-between",
        gap: isMobile ? "2px" : "4px",
        overflow: "hidden",
        transition: "all 0.2s ease",
        border: isOver ? "2px dashed rgba(255, 255, 255, 0.8)" : "none",
        userSelect: "none",
        WebkitUserSelect: "none",
      }}
      title={tooltipTitle}
    >
      <div 
        className="rbc-event-content-responsive"
        style={{ 
          lineHeight: isMobile ? "1.2" : "1.3",
          backgroundColor: "transparent",
          fontWeight: "500",
          color: "white",
          display: "flex",
          alignItems: "center",
          justifyContent: isMobile ? "center" : "space-between",
          gap: isMobile ? "2px" : "4px",
          width: "100%",
          height: "100%",
          overflow: "hidden",
          padding: 0,
          cursor: "pointer",
          pointerEvents: "none",
          position: "relative",
          zIndex: 11,
          userSelect: "none",
          WebkitUserSelect: "none",
        }}
      >
        <span className="truncate" style={{ 
          flex: isMobile ? "none" : 1, 
          minWidth: 0, 
          overflow: "hidden", 
          textOverflow: "ellipsis", 
          whiteSpace: "nowrap", 
          display: "block", 
          fontSize: isMobile ? "10px" : "13px",
          textAlign: isMobile ? "center" : "left",
          fontWeight: "500",
          width: isMobile ? "100%" : "auto",
          pointerEvents: "none",
        }}>
          {displayTitle}
        </span>
        {isRecurring && (
          <span className="recurring-indicator" style={{ 
            flexShrink: 0,
            fontWeight: "600",
            fontSize: isMobile ? "8px" : "11px",
            opacity: 0.9,
            marginLeft: isMobile ? "2px" : "4px",
            pointerEvents: "none",
          }}>
            (R)
          </span>
        )}
        {isEstimate && (
          <span className="estimate-indicator" style={{ 
            flexShrink: 0,
            fontWeight: "600",
            fontSize: isMobile ? "8px" : "11px",
            opacity: 0.9,
            marginLeft: isMobile ? "2px" : "4px",
            pointerEvents: "none",
          }}>
            (E)
          </span>
        )}
        {invoiceStatusLabel && (
          <span
            style={{
              flexShrink: 0,
              fontWeight: "600",
              fontSize: isMobile ? "8px" : "10px",
              opacity: 0.95,
              marginLeft: isMobile ? "2px" : "4px",
              pointerEvents: "none",
              borderRadius: "9999px",
              padding: isMobile ? "1px 4px" : "2px 6px",
              backgroundColor: "rgba(0, 0, 0, 0.15)",
              color: "white",
              lineHeight: 1.1,
            }}
          >
            {invoiceStatusLabel}
          </span>
        )}
      </div>
    </div>
  );
}

export function NewCalendar({ users = [], isLoadingUsers = false }) {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [updateJob] = useUpdateJobMutation();
  const [updateAppointment, { isLoading: isUpdatingAppointment }] = useUpdateAppointmentMutation();
  const [deleteAppointment, { isLoading: isDeletingAppointment }] = useDeleteAppointmentMutation();
  const [updateEstimateStatus, { isLoading: isUpdatingEstimate }] = useUpdateEstimateStatusMutation();
  const [deleteEstimate, { isLoading: isDeletingEstimate }] = useDeleteEstimateMutation();
  const [events, setEvents] = useState([]);
  const [rawEvents, setRawEvents] = useState([]); // One event per job (API-shaped) for month/week view
  const [originalEvents, setOriginalEvents] = useState([]); // Store original events for height calculation
  const [selectedJob, setSelectedJob] = useState(null);
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [selectedEstimate, setSelectedEstimate] = useState(null);
  const [selectedTimeOff, setSelectedTimeOff] = useState(null);
  // Default to week view on mobile, month view on desktop
  const [view, setView] = useState(window.innerWidth < 640 ? "day" : "month");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [monthRowHeight, setMonthRowHeight] = useState(140);
  const [expandedDays, setExpandedDays] = useState(new Set()); // Track which days are expanded
  const [showSidebar, setShowSidebar] = useState(false);
  
  // Responsive sidebar state - hidden on mobile by default
  // useEffect(() => {
  //   const handleResize = () => {
  //     if (window.innerWidth < 768) {
  //       setShowSidebar(false);
  //     } else {
  //       setShowSidebar(true);
  //     }
  //   };
    
  //   // Set initial state
  //   handleResize();
    
  //   window.addEventListener('resize', handleResize);
  //   return () => window.removeEventListener('resize', handleResize);
  // }, []);
  // Initialize categories - both jobs and appointments checked by default
  const [selectedCategories, setSelectedCategories] = useState({
    jobs: true,
    appointments: false,
    estimates: true,
    timeOff: true,
  });
  const [selectedAssignees, setSelectedAssignees] = useState({});
  const [filterParams, setFilterParams] = useState({});
  
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [editingJob, setEditingJob] = useState(null);
  const [deleteAppointmentDialogOpen, setDeleteAppointmentDialogOpen] = useState(false);
  const [deleteEstimateDialogOpen, setDeleteEstimateDialogOpen] = useState(false);
  
  // Time picker dialog state for drag and drop
  const [timePickerOpen, setTimePickerOpen] = useState(false);
  const [draggedJob, setDraggedJob] = useState(null);
  const [newDate, setNewDate] = useState(null);
  const [selectedTime, setSelectedTime] = useState({ hour: "12", minute: "00", period: "PM" });
  const [isUpdatingTime, setIsUpdatingTime] = useState(false);
  const [lastUpdateInfo, setLastUpdateInfo] = useState(null); // Store original scheduled_at for undo
  const undoTimeoutRef = useRef(null);

  console.log(users, 'users')
  console.log(selectedAssignees, 'selectedAssignees')

  // Initialize all staff as unchecked when users are loaded (only on mount)
  const isInitialized = useRef(false);
  useEffect(() => {
    if (users.length > 0 && !isInitialized.current) {
      const initialAssignees = {};
      const allUserIds = [];
      users.forEach((user) => {
        initialAssignees[user.user_id] = true; // All checked by default
        // Support both numeric IDs and UUIDs/emails
        const numId = parseInt(user.user_id);
        const userId = isNaN(numId) ? (user.user_id || user.email) : numId;
        allUserIds.push(userId);
      });
      setSelectedAssignees(initialAssignees);
      // Set filterParams to include all assignee_ids so all jobs show initially
      const assigneeIdsString = allUserIds.join(',');
      setFilterParams({ assignee_ids: assigneeIdsString, assigned_user_ids: assigneeIdsString });
      isInitialized.current = true;
    }
  }, [users.length]); // Only run when users array length changes

  // Sync selectedAssignees when filterParams.assignee_ids changes (from external sources)
  // Skip if this change came from our own handleAssigneeToggle
  const isInternalUpdate = useRef(false);
  useEffect(() => {
    if (filterParams.assignee_ids && users.length > 0 && !isInternalUpdate.current) {
      // Parse assignee_ids from filterParams (format: "1,2,3" or comma-separated string)
      const assigneeIdsStr = typeof filterParams.assignee_ids === 'string' 
        ? filterParams.assignee_ids.replace(/[\[\]]/g, '') 
        : '';
      const assigneeIds = assigneeIdsStr 
        ? assigneeIdsStr.split(',').map(id => {
            const trimmed = id.trim();
            // Support both numeric IDs and UUIDs/emails
            const numId = parseInt(trimmed);
            return isNaN(numId) ? trimmed : numId;
          }).filter(id => id !== '' && id !== null && id !== undefined)
        : [];
      
      // Update selectedAssignees based on filterParams
      const updatedAssignees = {};
      users.forEach((user) => {
        const userId = user.user_id || user.email;
        updatedAssignees[user.user_id] = assigneeIds.some(id => 
          id === user.user_id || id === userId || id === user.email
        );
      });
      setSelectedAssignees(updatedAssignees);
    }
    isInternalUpdate.current = false;
  }, [filterParams.assignee_ids, users.length]);

  const user = useSelector((state) => state.auth.user)
  const userRole = user?.role || "worker"
  const accountTimezone = useAccountTimezone();
  const { formatMoney: formatPrice } = useMoneyFormatter();
  
  // Check if user can see staff section (admin, manager, supervisor)
  const canViewStaff = ["admin", "manager", "supervisor"].includes(userRole);

  const getDateRange = () => {
    let start, end;

    if (view === "month") {
      start = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      end = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0, 23, 59);
    } else if (view === "week") {
      // Week: Monday to Sunday
      const weekStart = new Date(currentDate);
      const day = currentDate.getDay();
      const diff = day === 0 ? -6 : 1 - day;
      weekStart.setDate(currentDate.getDate() + diff);
      weekStart.setHours(0, 0, 0, 0);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      weekEnd.setHours(23, 59, 59, 999);
      start = weekStart;
      end = weekEnd;
    } else if (view === "day") {
      // Create new Date objects to avoid mutating currentDate
      start = new Date(currentDate);
      start.setHours(0, 0, 0, 0);
      end = new Date(currentDate);
      end.setHours(23, 59, 59, 999);
    }

    return {
      start: start.toISOString(),
      end: end.toISOString(),
    };
  };

  const { start, end } = getDateRange();
  
  // Build filter params for calendar jobs API
  // API expects: start, end, status (comma-separated), job_ids, assignee_ids (comma-separated), search
  const calendarJobsParams = {
    start,
    end,
  };
  
  // Job status - support both single and comma-separated values
  if (filterParams.job_status && filterParams.job_status.trim()) {
    calendarJobsParams.status = filterParams.job_status;
  } else if (filterParams.status && filterParams.status.trim()) {
    // Legacy support
    calendarJobsParams.status = filterParams.status;
  }
  
  // Job IDs filter
  if (filterParams.job_ids && filterParams.job_ids.trim()) {
    calendarJobsParams.job_ids = filterParams.job_ids;
  }
  
  // Assignee IDs - convert from array format to comma-separated string
  if (filterParams.assignee_ids) {
    if (typeof filterParams.assignee_ids === 'string') {
      const cleaned = filterParams.assignee_ids.replace(/[\[\]]/g, '');
      if (cleaned.trim()) {
        calendarJobsParams.assignee_ids = cleaned;
      }
    } else if (Array.isArray(filterParams.assignee_ids) && filterParams.assignee_ids.length > 0) {
      calendarJobsParams.assignee_ids = filterParams.assignee_ids.join(',');
    }
  }
  
  // Search - prioritize job_search, fallback to general search
  if (filterParams.job_search && filterParams.job_search.trim()) {
    calendarJobsParams.search = filterParams.job_search;
  } else if (filterParams.search && filterParams.search.trim()) {
    calendarJobsParams.search = filterParams.search;
  }
  if (filterParams.unassigned === true || filterParams.unassigned === 'true') {
    calendarJobsParams.unassigned = true;
  }
  
  // Build filter params for appointments API
  // API expects: start, end, status (comma-separated), assigned_user_ids (comma-separated), search
  const appointmentsParams = {
    start,
    end,
  };
  
  // Appointment status - support comma-separated values
  if (filterParams.appointment_status && filterParams.appointment_status.trim()) {
    appointmentsParams.status = filterParams.appointment_status;
  }
  
  // Assigned user IDs - convert from array format to comma-separated string
  if (filterParams.assigned_user_ids) {
    if (typeof filterParams.assigned_user_ids === 'string') {
      const cleaned = filterParams.assigned_user_ids.replace(/[\[\]]/g, '');
      if (cleaned.trim()) {
        appointmentsParams.assigned_user_ids = cleaned;
      }
    } else if (Array.isArray(filterParams.assigned_user_ids) && filterParams.assigned_user_ids.length > 0) {
      appointmentsParams.assigned_user_ids = filterParams.assigned_user_ids.join(',');
    }
  }
  
  // Search - prioritize appointment_search
  if (filterParams.appointment_search && filterParams.appointment_search.trim()) {
appointmentsParams.search = filterParams.appointment_search;
  } else if (filterParams.search && filterParams.search.trim()) {
    // Only use general search for appointments if no appointment_search is set
    appointmentsParams.search = filterParams.search;
  }
  if (filterParams.unassigned === true || filterParams.unassigned === 'true') {
    appointmentsParams.unassigned = true;
  }
  
  // Build filter params for estimates API
  // API expects: start, end, status (comma-separated), assigned_user_ids (comma-separated), search
  const estimatesParams = {
    start,
    end,
  };
  
  // Estimate status - support comma-separated values
  if (filterParams.estimate_status && filterParams.estimate_status.trim()) {
    estimatesParams.status = filterParams.estimate_status;
  }
  
  // Assigned user IDs - convert from array format to comma-separated string
  if (filterParams.assigned_user_ids) {
    if (typeof filterParams.assigned_user_ids === 'string') {
      const cleaned = filterParams.assigned_user_ids.replace(/[\[\]]/g, '');
      if (cleaned.trim()) {
        estimatesParams.assigned_user_ids = cleaned;
      }
    } else if (Array.isArray(filterParams.assigned_user_ids) && filterParams.assigned_user_ids.length > 0) {
      estimatesParams.assigned_user_ids = filterParams.assigned_user_ids.join(',');
    }
  }
  
  // Search - prioritize estimate_search
  if (filterParams.estimate_search && filterParams.estimate_search.trim()) {
    estimatesParams.search = filterParams.estimate_search;
  } else if (filterParams.search && filterParams.search.trim()) {
    // Only use general search for estimates if no estimate_search is set
    estimatesParams.search = filterParams.search;
  }
  
  const { data: calendarJobs, isLoading, isFetching } = useGetCalendarJobsQuery(calendarJobsParams);
  const { data: appointments, isLoading: isLoadingAppointments, isFetching: isFetchingAppointments } = useGetAppointmentsCalendarQuery(appointmentsParams);
  // Support both array and { results: [...] } from occurrences API — calendar uses only this (includes assigned_user_ids for columns)
  const jobs = Array.isArray(calendarJobs) ? calendarJobs : (calendarJobs?.results ?? []);
  // Only fetch estimates when the estimates category is enabled (not false)
  const { data: estimates, isLoading: isLoadingEstimates, isFetching: isFetchingEstimates } = useGetEstimateAppointmentsCalendarQuery(estimatesParams, {
    skip: selectedCategories.estimates === false
  });
  
  // Handle both array response and results-wrapped response for appointments
  const appointmentsList = Array.isArray(appointments) 
    ? appointments 
    : (appointments?.results ?? []);
  
  // Handle both array response and results-wrapped response for estimates
  const estimatesList = Array.isArray(estimates) 
    ? estimates 
    : (estimates?.results ?? []);

  const timeOffQueryParams = useMemo(() => {
    let startD;
    let endD;
    if (view === "month") {
      startD = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      endD = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
    } else if (view === "week") {
      const weekStart = new Date(currentDate);
      const day = currentDate.getDay();
      const diff = day === 0 ? -6 : 1 - day;
      weekStart.setDate(currentDate.getDate() + diff);
      weekStart.setHours(0, 0, 0, 0);
      endD = new Date(weekStart);
      endD.setDate(weekStart.getDate() + 6);
      startD = weekStart;
    } else {
      startD = new Date(currentDate);
      startD.setHours(0, 0, 0, 0);
      endD = new Date(currentDate);
      endD.setHours(0, 0, 0, 0);
    }
    const fmt = (d) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${y}-${m}-${day}`;
    };
    return { from_date: fmt(startD), to_date: fmt(endD), page_size: 250 };
  }, [view, currentDate]);

  const { data: payrollEmployeesData } = useGetEmployeesQuery({ is_active: true });
  const payrollRows = payrollEmployeesData?.results ?? [];
  const payrollIdToUserId = useMemo(() => {
    const m = new Map();
    payrollRows.forEach((row) => {
      const pid = row.id ?? row.pk;
      const uid = row.user_id ?? row.user;
      if (pid != null && uid != null) m.set(String(pid), uid);
    });
    return m;
  }, [payrollRows]);

  const { data: timeOffCalendarData } = useGetTimeOffListQuery(timeOffQueryParams, {
    skip: selectedCategories.timeOff === false,
  });
  
  // State for fetching job details when clicked
  const [selectedJobId, setSelectedJobId] = useState(null);
  const { data: jobDetails, isLoading: isLoadingJobDetails } = useGetJobDetailsQuery(
    selectedJobId,
    { skip: !selectedJobId }
  );

  // Skip GHL placeholders like "N/A" so calendar cards match Job Details names.
  const getDisplayName = (item, fallbackName, defaultName) => {
    const usable = (value) => {
      if (value == null) return "";
      const text = String(value).trim();
      if (!text) return "";
      const lower = text.toLowerCase();
      if (["n/a", "na", "n.a.", "n.a", "none", "unknown", "customer"].includes(lower)) return "";
      return text;
    };
    const contactName = usable(
      [item?.contact_details?.first_name, item?.contact_details?.last_name].filter(Boolean).join(" ")
    );
    return (
      usable(item?.company_name) ||
      usable(item?.contact_company_name) ||
      usable(fallbackName) ||
      usable(item?.customer_name) ||
      usable(item?.contact_name) ||
      contactName ||
      usable(item?.title) ||
      defaultName
    );
  };

  // Current user id for worker view (single column, no assignee names)
  const currentUserId = user?.user_id ?? user?.id ?? user?.email;

  // Resources for day/week view: one column per technician (and Unassigned). For workers: single column, no assignee names.
  const calendarResources = useMemo(() => {
    if (userRole === "worker") {
      return [{ id: "schedule", name: "" }];
    }
    const list = users
      .filter((u) => selectedAssignees[u.user_id] !== false)
      .map((u) => {
        const rid = String(u.user_id ?? u.id);
        return {
          id: rid,
          name: `${u.first_name ?? ""} ${u.last_name ?? ""}`.trim() || u.full_name || u.email || rid,
        };
      });
    list.push({ id: "unassigned", name: "Unassigned" });
    return list;
  }, [users, selectedAssignees, userRole]);

  // Set of valid resource ids (for matching assigned_user_ids from occurrences API to technician columns in daily/week view)
  const calendarResourceIdsSet = useMemo(
    () => new Set(calendarResources.map((r) => String(r.id))),
    [calendarResources]
  );

  // Map any assignee id (user_id, employee id, or email) to our resource id so events land in the right column
  const assigneeIdToResourceId = useMemo(() => {
    const map = new Map();
    if (userRole === "worker") {
      if (currentUserId != null) {
        map.set(String(currentUserId), "schedule");
        if (user?.id != null) map.set(String(user.id), "schedule");
        if (user?.email) {
          map.set(String(user.email), "schedule");
          map.set(String(user.email).toLowerCase(), "schedule");
        }
      }
      return map;
    }
    map.set("unassigned", "unassigned");
    users
      .filter((u) => selectedAssignees[u.user_id] !== false)
      .forEach((u) => {
        const rid = String(u.user_id ?? u.id ?? u.employee_id ?? "");
        if (!rid) return;
        map.set(String(u.user_id), rid);
        map.set(String(u.id), rid);
        if (u.employee_id != null) map.set(String(u.employee_id), rid);
        if (u.email) {
          map.set(String(u.email), rid);
          map.set(String(u.email).toLowerCase(), rid);
        }
      });
    return map;
  }, [users, selectedAssignees, userRole, currentUserId, user?.id, user?.email]);

  // Map assignee display name to resource id (for appointments/estimates that only have assigned_user_name from API)
  const normalizeName = (s) => (s && String(s).trim().replace(/\s+/g, " ").toLowerCase()) || "";
  const assigneeNameToResourceId = useMemo(() => {
    const map = new Map();
    if (userRole === "worker") return map;
    users
      .filter((u) => selectedAssignees[u.user_id] !== false)
      .forEach((u) => {
        const rid = String(u.user_id ?? u.id);
        const full = `${u.first_name ?? ""} ${u.last_name ?? ""}`.trim() || u.full_name || "";
        if (full) map.set(normalizeName(full), rid);
        if (u.full_name) map.set(normalizeName(u.full_name), rid);
      });
    return map;
  }, [users, selectedAssignees, userRole]);

  // From occurrences (assigned_user_ids + assignments/assignees), map job_id / id -> array of assignee ids for day/week columns
  const jobIdToAssigneeIds = useMemo(() => {
    const map = new Map();
    jobs.forEach((job) => {
      const assigneeIds = new Set();
      // Occurrences API: assigned_user_ids array
      (job.assigned_user_ids || []).forEach((id) => {
        if (id != null) assigneeIds.add(String(id));
      });
      (job.assignments || []).forEach((a) => {
        const id = a?.user ?? a?.user_id ?? a?.assignee_id;
        if (id != null) assigneeIds.add(String(id));
      });
      (job.assigned_users || []).forEach((u) => {
        const id = typeof u === "object" && u != null ? u?.user_id ?? u?.id : u;
        if (id != null) assigneeIds.add(String(id));
      });
      const single =
        job.assigned_user_id ?? job.assignee_id ?? job.assigned_to ??
        (typeof job.assignee === "object" && job.assignee != null ? job.assignee?.user_id ?? job.assignee?.id : job.assignee);
      if (single != null) assigneeIds.add(String(single));
      const arr = [...assigneeIds];
      if (job.job_id != null) map.set(String(job.job_id), arr);
      if (job.id != null) map.set(String(job.id), arr);
    });
    return map;
  }, [jobs]);

  // Collect all assignee IDs from a job/occurrence (assigned_user_ids + assignments + legacy fields)
  const getJobAssigneeIds = (job) => {
    const fromMap = jobIdToAssigneeIds.get(String(job.job_id)) ?? jobIdToAssigneeIds.get(String(job.id));
    if (fromMap && fromMap.length > 0) return fromMap;
    const ids = new Set();
    (job.assigned_user_ids || []).forEach((id) => {
      if (id != null) ids.add(String(id));
    });
    (job.assignments || []).forEach((a) => {
      const id = a?.user ?? a?.user_id ?? a?.assignee_id;
      if (id != null) ids.add(String(id));
    });
    (job.assigned_users || []).forEach((u) => {
      const id = typeof u === "object" && u != null ? u?.user_id ?? u?.id : u;
      if (id != null) ids.add(String(id));
    });
    const single =
      job.assigned_user_id ?? job.assignee_id ?? job.assigned_to ??
      (typeof job.assignee === "object" && job.assignee != null ? job.assignee?.user_id ?? job.assignee?.id : job.assignee);
    if (single != null) ids.add(String(single));
    return [...ids];
  };

  useEffect(() => {
    // Check if categories are enabled (default to true if not set)
    const showJobs = selectedCategories.jobs !== false;
    const showAppointments = selectedCategories.appointments !== false;
    const showEstimates = selectedCategories.estimates !== false;

    // Raw: one event per job (API-shaped, no expansion) for month/week view.
    const jobEventsRaw = showJobs
      ? jobs
          .filter((job) => job.scheduled_at)
          .map((job) => {
            const jobId = job.job_id ?? job.id;
            const m = moment.utc(job.scheduled_at);
            const startDate = new Date(m.year(), m.month(), m.date(), m.hour(), m.minute(), m.second());
            const duration = parseFloat(job.duration_hours) || 2;
            const endDate = new Date(m.year(), m.month(), m.date(), m.hour() + duration, m.minute(), m.second());
            const timeStr = m.minute() === 0 ? m.format("h A") : m.format("h:mm A");
            const displayName = getDisplayName(job, job.customer_name, "Customer");
            const resourceId = userRole === "worker" ? "schedule" : "unassigned";
            return {
              id: jobId,
              title: `${timeStr} ${displayName}`,
              start: startDate,
              end: endDate,
              resourceId,
              resource: { ...job, id: jobId },
              type: "job",
            };
          })
      : [];

    // Expanded: one event per assignee for day view (job appears in each technician column).
    const jobEvents = showJobs
      ? jobs.flatMap((job) => {
            if (!job.scheduled_at) return [];
            const jobId = job.job_id ?? job.id;
            const m = moment.utc(job.scheduled_at);
            const startDate = new Date(m.year(), m.month(), m.date(), m.hour(), m.minute(), m.second());
            const duration = parseFloat(job.duration_hours) || 2;
            const endDate = new Date(m.year(), m.month(), m.date(), m.hour() + duration, m.minute(), m.second());
            const timeStr = m.minute() === 0 ? m.format("h A") : m.format("h:mm A");
            const displayName = getDisplayName(job, job.customer_name, "Customer");

            if (userRole === "worker") {
              return [{
                id: jobId,
                title: `${timeStr} ${displayName}`,
                start: startDate,
                end: endDate,
                resourceId: "schedule",
                resource: { ...job, id: jobId },
                type: "job",
              }];
            }

            const assigneeIds = getJobAssigneeIds(job);
            const resourceIds = assigneeIds.length > 0
              ? [...new Set(assigneeIds.map((rawId) => {
                  const str = String(rawId);
                  const rid = assigneeIdToResourceId.get(str);
                  if (rid && rid !== "unassigned") return rid;
                  if (calendarResourceIdsSet.has(str)) return str;
                  return "unassigned";
                }).filter(Boolean))]
              : ["unassigned"];

            return resourceIds.map((resourceId, index) => ({
              id: resourceIds.length === 1 ? jobId : `${jobId}-${resourceId}-${index}`,
              title: `${timeStr} ${displayName}`,
              start: startDate,
              end: endDate,
              resourceId,
              resource: { ...job, id: jobId },
              type: "job",
            }));
          })
      : [];

    // Transform appointments to events (only if appointments category is enabled)
    const appointmentEventsRaw = showAppointments
      ? appointmentsList
          .filter((appointment) => {
            if (!appointment.start_time) return false;
            return true;
          })
          .map((appointment) => {
            const startM = moment.utc(appointment.start_time).tz(accountTimezone);
            const endM = moment.utc(appointment.end_time).tz(accountTimezone);
            const startDate = new Date(startM.year(), startM.month(), startM.date(), startM.hour(), startM.minute(), startM.second());
            const endDate = new Date(endM.year(), endM.month(), endM.date(), endM.hour(), endM.minute(), endM.second());
            const timeStr = startM.minute() === 0 ? startM.format("h A") : startM.format("h:mm A");
            const displayName = getDisplayName(appointment, appointment.title || appointment.contact_name, "Appointment");

            const rawAppId =
              appointment.assigned_user_id ??
              appointment.user_id ??
              appointment.assigned_user?.user_id ??
              appointment.assigned_user?.id ??
              null;
            let resourceId = rawAppId != null ? assigneeIdToResourceId.get(String(rawAppId)) : null;
            if (resourceId == null && appointment.assigned_user_name) {
              resourceId = assigneeNameToResourceId.get(normalizeName(appointment.assigned_user_name));
            }
            resourceId = resourceId ?? "unassigned";
            return {
              id: appointment.appointment_id,
              title: `${timeStr} ${displayName}`,
              start: startDate,
              end: endDate,
              resourceId,
              resource: appointment,
              type: "appointment",
            };
          })
      : [];
    const appointmentEvents = userRole === "worker" ? appointmentEventsRaw.filter((ev) => ev.resourceId === "schedule") : appointmentEventsRaw;

    // Transform estimates to events (only if estimates category is enabled)
    const estimateEventsRaw = showEstimates
      ? estimatesList
          .filter((estimate) => {
            if (!estimate.start_time) return false;
            return true;
          })
          .map((estimate) => {
            const startM = moment.utc(estimate.start_time).tz(accountTimezone);
            const endM = moment.utc(estimate.end_time).tz(accountTimezone);
            const startDate = new Date(startM.year(), startM.month(), startM.date(), startM.hour(), startM.minute(), startM.second());
            const endDate = new Date(endM.year(), endM.month(), endM.date(), endM.hour(), endM.minute(), endM.second());
            const timeStr = startM.minute() === 0 ? startM.format("h A") : startM.format("h:mm A");
            const displayName = getDisplayName(estimate, estimate.title || estimate.contact_name, "Estimate");

            const rawEstId =
              estimate.assigned_user_id ??
              estimate.user_id ??
              estimate.assigned_user?.user_id ??
              estimate.assigned_user?.id ??
              null;
            let resourceId = rawEstId != null ? assigneeIdToResourceId.get(String(rawEstId)) : null;
            if (resourceId == null && estimate.assigned_user_name) {
              resourceId = assigneeNameToResourceId.get(normalizeName(estimate.assigned_user_name));
            }
            resourceId = resourceId ?? "unassigned";
            return {
              id: estimate.appointment_id,
              title: `${timeStr} ${displayName}`,
              start: startDate,
              end: endDate,
              resourceId,
              resource: estimate,
              type: "estimate",
            };
          })
      : [];
    const estimateEvents = userRole === "worker" ? estimateEventsRaw.filter((ev) => ev.resourceId === "schedule") : estimateEventsRaw;

    const showTimeOff = selectedCategories.timeOff !== false;
    const timeOffList = showTimeOff ? (timeOffCalendarData?.results ?? []) : [];

    const timeOffVisibleForWorker = (entry) => {
      if (userRole !== "worker") return true;
      const uid = payrollIdToUserId.get(String(entry.employee));
      if (uid != null && String(uid) === String(currentUserId)) return true;
      if (
        entry.employee_email &&
        user?.email &&
        String(entry.employee_email).toLowerCase() === String(user.email).toLowerCase()
      )
        return true;
      return false;
    };

    const resolveTimeOffResourceId = (entry) => {
      if (userRole === "worker") return "schedule";
      const uid = payrollIdToUserId.get(String(entry.employee));
      if (uid != null) {
        const rid = assigneeIdToResourceId.get(String(uid));
        if (rid) return rid;
      }
      if (entry.employee_name) {
        const r = assigneeNameToResourceId.get(normalizeName(entry.employee_name));
        if (r) return r;
      }
      return "unassigned";
    };

    const timeOffEventsRaw = [];
    const timeOffDayEvents = [];
    for (const entry of timeOffList) {
      if (!timeOffVisibleForWorker(entry)) continue;
      const startD = parseYmdToLocalDate(entry.start_date);
      const endD = parseYmdToLocalDate(entry.end_date);
      if (!startD || !endD) continue;
      const endExclusive = addDaysLocal(endD, 1);
      const kindLabel = TIME_OFF_KIND_LABELS[entry.kind] || "Time off";
      const title = `${entry.employee_name} · ${kindLabel}`;
      const resourceId = resolveTimeOffResourceId(entry);

      timeOffEventsRaw.push({
        id: `timeoff-${entry.id}`,
        title,
        start: startD,
        end: endExclusive,
        resourceId,
        resource: entry,
        type: "time_off",
        allDay: true,
      });

      if (timeOffRangeOverlapsDay(startD, endExclusive, currentDate)) {
        timeOffDayEvents.push({
          id: `timeoff-${entry.id}-day`,
          title,
          start: startD,
          end: endExclusive,
          resourceId,
          resource: entry,
          type: "time_off",
          allDay: true,
        });
      }
    }

    const allEvents = [...jobEvents, ...appointmentEvents, ...estimateEvents, ...timeOffDayEvents];
    const allRawEvents = [...jobEventsRaw, ...appointmentEvents, ...estimateEvents, ...timeOffEventsRaw];

    setOriginalEvents(allEvents);
    setRawEvents(allRawEvents);
    setEvents(allEvents);
  }, [
    jobs,
    view,
    currentDate,
    appointmentsList,
    estimatesList,
    accountTimezone,
    selectedCategories,
    assigneeIdToResourceId,
    jobIdToAssigneeIds,
    calendarResourceIdsSet,
    userRole,
    timeOffCalendarData,
    payrollIdToUserId,
    user,
    currentUserId,
    assigneeNameToResourceId,
  ]);

  // Day view: expanded events (one per technician). Month/week: raw events (one per job, API-shaped).
  const displayEvents = useMemo(
    () => (view === "day" ? events : rawEvents),
    [view, events, rawEvents]
  );

  const usHolidayMap = useMemo(() => {
    const year = currentDate.getFullYear();
    return getUsHolidayMap([year - 1, year, year + 1]);
  }, [currentDate]);

  // FullCalendar event format (id, title, start, end, extendedProps, editable)
  const fcEvents = useMemo(
    () =>
      displayEvents.map((ev) => ({
        id: String(ev.id),
        title: ev.title,
        start: ev.start,
        end: ev.end,
        allDay: ev.allDay === true,
        extendedProps: { resource: ev.resource, type: ev.type },
        editable:
          ev.type !== "appointment" &&
          ev.type !== "more" &&
          ev.type !== "time_off",
      })),
    [displayEvents]
  );

  // Check if jobs category is enabled (used for totals display)
  const showJobs = selectedCategories.jobs !== false;
  
  // Calculate daily totals for jobs (only jobs, not appointments or estimates)
  // Only calculate if jobs category is enabled
  const dailyTotals = useMemo(() => {
    // If jobs are not selected, return empty totals
    if (!showJobs) return {};
    
    const totals = {};
    const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const monthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0, 23, 59, 59, 999);

    // Only count jobs that are scheduled
    jobs.forEach((job) => {
      if (!job.scheduled_at) return;
      const hasPriceField =
        job.total_price !== null &&
        job.total_price !== undefined;
      const hasSurchargeField =
        job.total_surcharge !== null &&
        job.total_surcharge !== undefined;
      if (!hasPriceField && !hasSurchargeField) return;

      const m = moment.utc(job.scheduled_at);
      const jobDate = new Date(m.year(), m.month(), m.date());
      
      // Only include jobs in the current month view
      if (jobDate >= monthStart && jobDate <= monthEnd) {
        const year = jobDate.getFullYear();
        const month = String(jobDate.getMonth() + 1).padStart(2, '0');
        const date = String(jobDate.getDate()).padStart(2, '0');
        const dayKey = `${year}-${month}-${date}`;
        
        totals[dayKey] = (totals[dayKey] || 0) + jobGrandTotalAmount(job);
      }
    });

    return totals;
  }, [jobs, currentDate, showJobs]);

  // Weekly totals by Sunday date (Mon–Sun week): key = "YYYY-MM-DD" of the week-ending Sunday, value = sum of job totals incl. surcharge in that week
  const weeklyTotalsBySunday = useMemo(() => {
    if (!showJobs) return {};
    const bySunday = {};
    jobs.forEach((job) => {
      if (!job.scheduled_at) return;
      const hasPriceField = job.total_price != null;
      const hasSurchargeField = job.total_surcharge != null;
      if (!hasPriceField && !hasSurchargeField) return;
      const m = moment.utc(job.scheduled_at);
      const jobDate = new Date(m.year(), m.month(), m.date());
      const day = jobDate.getDay();
      const sundayOffset = (7 - day) % 7;
      const sundayDate = new Date(jobDate);
      sundayDate.setDate(jobDate.getDate() + sundayOffset);
      const y = sundayDate.getFullYear();
      const mo = String(sundayDate.getMonth() + 1).padStart(2, "0");
      const d = String(sundayDate.getDate()).padStart(2, "0");
      const key = `${y}-${mo}-${d}`;
      bySunday[key] = (bySunday[key] || 0) + jobGrandTotalAmount(job);
    });
    return bySunday;
  }, [jobs, showJobs]);

  // Dynamically set month row height so all events fit
  useEffect(() => {
    if (view !== "month") return;

    const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const monthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0, 23, 59, 59, 999);

    // Count actual events per day for row height
    const eventsToCount = displayEvents;
    const counts = {};
    eventsToCount.forEach((ev) => {
      const d = ev.start;
      if (d >= monthStart && d <= monthEnd) {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const date = String(d.getDate()).padStart(2, '0');
        const dayKey = `${year}-${month}-${date}`;
        counts[dayKey] = (counts[dayKey] || 0) + 1;
      }
    });

    // Find the day with the most events - this determines the row height needed
    const maxCount = Object.values(counts).reduce((a, b) => Math.max(a, b), 0);
    
    // Calculate height dynamically based on number of events
    // Each event needs: padding (6px top + 6px bottom = 12px) + content height (~20px) = ~32px per event
    const eventHeight = 32; // Height per event
    const baseHeight = 44; // Base height for day cell (date number + padding)
    const dailyTotalHeight = 28; // Height needed for daily total display
    
    // Check if any day has totals (need extra space)
    const hasAnyTotals = Object.keys(dailyTotals).length > 0;
    const extraHeightForTotal = hasAnyTotals ? dailyTotalHeight : 0;
    
    // Use the maximum event count to calculate height - show all events
    // Add extra height for daily total to ensure events are fully visible
    const calculatedHeight = baseHeight + (Math.max(maxCount, 1) * eventHeight) + extraHeightForTotal;
    
    // Set minimum height, but always use calculated height if it's larger
    const minHeight = hasAnyTotals ? 170 : 140; // Increased minimum when totals are present
    setMonthRowHeight(Math.max(minHeight, calculatedHeight));
  }, [displayEvents, view, currentDate, dailyTotals]);

  const weeksInMonth =
    view === "month"
      ? Math.ceil(
          (new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay() +
            new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate()) /
            7
        )
      : 0;

  const weekDayHeight = () => {
    if (view === "month") {
      return 64 + weeksInMonth * monthRowHeight;
    }
    const hours = 18;
    const pixelsPerHour = 60;
    return 100 + hours * pixelsPerHour;
  };

  const monthTotalHeight = weekDayHeight();

  // Calculate monthly total for jobs
  const monthlyTotal = useMemo(() => {
    return Object.values(dailyTotals).reduce((sum, dayTotal) => sum + dayTotal, 0);
  }, [dailyTotals]);

  // Inject daily totals into day cells using useEffect
  useEffect(() => {
    if (view !== "month") {
      // Clean up when not in month view
      const existingTotals = document.querySelectorAll('.daily-job-total');
      existingTotals.forEach(el => el.remove());
      return;
    }

    // Function to inject totals
    const injectTotals = () => {
      // Remove any existing daily total elements
      const existingTotals = document.querySelectorAll('.daily-job-total');
      existingTotals.forEach(el => el.remove());

      // Find all month rows
      const monthRows = document.querySelectorAll('.rbc-month-row');
      
      if (monthRows.length === 0) {
        return; // Calendar not ready yet
      }
      
      monthRows.forEach((row) => {
        // Get all date cells in this row - these contain the actual date numbers
        const dateCells = row.querySelectorAll('.rbc-date-cell');
        // Get all day-bg cells in this row - these are the day containers
        const dayBgCells = row.querySelectorAll('.rbc-day-bg');
        
        // Match date cells with day-bg cells by their column index
        dateCells.forEach((dateCell, index) => {
          // Get the date number from the date cell text
          const dateText = dateCell.textContent?.trim();
          if (!dateText) return;
          
          const dayNum = parseInt(dateText);
          if (isNaN(dayNum)) return;
          
          // Find the corresponding day-bg cell at the same index
          const dayBgCell = dayBgCells[index];
          if (!dayBgCell) return;
          
          // Determine the actual date by checking which week row we're in
          // Week is Monday–Sunday: column 0 = Monday, 6 = Sunday
          const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
          const firstDayOfMonthDow = firstDayOfMonth.getDay();
          const firstDayOfWeek = firstDayOfMonthDow === 0 ? 6 : firstDayOfMonthDow - 1;
          
          // Find which week row this is (0-based)
          const allMonthRows = document.querySelectorAll('.rbc-month-row');
          const rowIndex = Array.from(allMonthRows).indexOf(row);
          if (rowIndex === -1) return;
          
          // Calculate the actual date: days from start of calendar grid
          const daysFromStart = rowIndex * 7 + index - firstDayOfWeek;
          const actualDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1 + daysFromStart);
          
          // Verify this date is actually in the current month (not from previous/next month)
          if (actualDate.getMonth() !== currentDate.getMonth()) return;
          
          // Create date key using the actual date
          const year = actualDate.getFullYear();
          const month = String(actualDate.getMonth() + 1).padStart(2, '0');
          const date = String(actualDate.getDate()).padStart(2, '0');
          const dateKey = `${year}-${month}-${date}`;
          const isSunday = actualDate.getDay() === 0;

          let displayTotal = 0;
          let label = '';

          if (isSunday) {
            // Sunday: show weekly total (Mon–Sun) for that week
            const weekTotal = weeklyTotalsBySunday[dateKey] || 0;
            displayTotal = weekTotal;
            label = `Week: ${formatPrice(weekTotal)}`;
          } else {
            const dayTotal = dailyTotals[dateKey] || 0;
            const eventsForDay = (view === "month" || view === "week") ? displayEvents : events;
            const hasJobEvents = eventsForDay.some(event => {
              if (event.type !== 'job') return false;
              const eventDate = event.start;
              const eventYear = eventDate.getFullYear();
              const eventMonth = String(eventDate.getMonth() + 1).padStart(2, '0');
              const eventDateNum = String(eventDate.getDate()).padStart(2, '0');
              const eventDateKey = `${eventYear}-${eventMonth}-${eventDateNum}`;
              return eventDateKey === dateKey;
            });
            if (!showJobs || dayTotal <= 0 || !hasJobEvents) return;
            displayTotal = dayTotal;
            label = `Total: ${formatPrice(dayTotal)}`;
          }

          // Show: Sunday always show week total when showJobs; other days show when dayTotal > 0 and hasJobEvents
          if (showJobs && (isSunday || displayTotal > 0)) {
            // Check if total already exists to avoid duplicates
            if (dayBgCell.querySelector('.daily-job-total')) return;
            
            // Create and insert the total element with professional styling
            const totalEl = document.createElement('div');
            totalEl.className = 'daily-job-total';
            
            // Single line format for all devices - CSS will handle positioning
            totalEl.textContent = label;
            
            // Base styles that apply to all devices
            totalEl.style.cssText = `
              display: block !important;
              visibility: visible !important;
              opacity: 1 !important;
              pointer-events: none !important;
              white-space: nowrap !important;
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif !important;
            `;
            
            // Add class to identify cells with totals for CSS targeting
            dayBgCell.classList.add('has-daily-total');
            dayBgCell.style.position = 'relative';
            
            // Find the events container
            const eventsContainer = dayBgCell.querySelector('.rbc-events-container');
            
            // For desktop: Insert after events container in normal flow
            // For mobile: CSS will position it absolutely at top left
            if (eventsContainer) {
              // Insert the total right after the events container
              eventsContainer.parentNode.insertBefore(totalEl, eventsContainer.nextSibling);
            } else {
              // Fallback: append to day-bg cell
              dayBgCell.appendChild(totalEl);
            }
          }
        });
      });
    };

    // Try with a delay to ensure calendar is rendered, then retry if needed
    const timeoutId1 = setTimeout(() => {
      injectTotals();
    }, 150);

    // Retry after a longer delay in case calendar wasn't ready
    const timeoutId2 = setTimeout(() => {
      injectTotals();
    }, 400);

    return () => {
      clearTimeout(timeoutId1);
      clearTimeout(timeoutId2);
    };
  }, [view, dailyTotals, weeklyTotalsBySunday, currentDate, formatPrice, events.length, displayEvents, showJobs]);

  const handleSelectEvent = (event) => {
    console.log('handleSelectEvent called:', event?.type, event?.resource?.job_id || event?.resource?.appointment_id);
    
    if (!event) {
      console.error('handleSelectEvent: event is null/undefined');
      return;
    }
    
    if (event.type === 'appointment') {
      setSelectedAppointment(event.resource);
      setSelectedJob(null);
      setSelectedJobId(null);
      setSelectedEstimate(null);
      setSelectedTimeOff(null);
    } else if (event.type === 'estimate') {
      setSelectedEstimate(event.resource);
      setSelectedJob(null);
      setSelectedJobId(null);
      setSelectedAppointment(null);
      setSelectedTimeOff(null);
    } else if (event.type === "time_off") {
      setSelectedTimeOff(event.resource);
      setSelectedJob(null);
      setSelectedJobId(null);
      setSelectedAppointment(null);
      setSelectedEstimate(null);
    } else {
      // For jobs, fetch full job details using job_id
      const jobId = event.resource?.job_id || event.resource?.id;
      console.log('Job event clicked, jobId:', jobId);
      if (jobId) {
        // Clear previous job data immediately when selecting a new job
        setSelectedJob(null);
        setSelectedJobId(jobId);
        setSelectedAppointment(null);
        setSelectedEstimate(null);
        setSelectedTimeOff(null);
      } else {
        console.error('handleSelectEvent: jobId is missing', event);
      }
    }
  };
  
  // Clear selectedJob when selectedJobId changes (new job selected)
  useEffect(() => {
    if (selectedJobId) {
      // Clear previous job data when a new job ID is set
      setSelectedJob(null);
    }
  }, [selectedJobId]);
  
  // Update selectedJob when jobDetails is loaded
  useEffect(() => {
    if (jobDetails && selectedJobId) {
      setSelectedJob(jobDetails);
    }
  }, [jobDetails, selectedJobId]);

  const handleToggleExpand = (dayKey) => {
    setExpandedDays((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(dayKey)) {
        newSet.delete(dayKey);
      } else {
        newSet.add(dayKey);
      }
      return newSet;
    });
  };

  const handleNavigate = (newDate) => {
    setCurrentDate(newDate);
  };

  const navigateToday = () => {
    setCurrentDate(new Date());
  };

  const navigateBack = () => {
    const newDate = new Date(currentDate);
    switch (view) {
      case "month":
        newDate.setMonth(newDate.getMonth() - 1);
        break;
      case "week":
        newDate.setDate(newDate.getDate() - 7);
        break;
      case "day":
        newDate.setDate(newDate.getDate() - 1);
        break;
    }
    setCurrentDate(newDate);
  };

  const navigateNext = () => {
    const newDate = new Date(currentDate);
    switch (view) {
      case "month":
        newDate.setMonth(newDate.getMonth() + 1);
        break;
      case "week":
        newDate.setDate(newDate.getDate() + 7);
        break;
      case "day":
        newDate.setDate(newDate.getDate() + 1);
        break;
    }
    setCurrentDate(newDate);
  };

  const getDateTitle = () => {
    const monthNames = ["January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"];
    
    switch (view) {
      case "month":
        return `${monthNames[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
      case "week": {
        const weekStart = new Date(currentDate);
        const day = currentDate.getDay();
        const diff = day === 0 ? -6 : 1 - day;
        weekStart.setDate(currentDate.getDate() + diff);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        return `${monthNames[weekStart.getMonth()]} ${weekStart.getDate()} - ${monthNames[weekEnd.getMonth()]} ${weekEnd.getDate()}, ${weekEnd.getFullYear()}`;
      }
      case "day":
        return `${monthNames[currentDate.getMonth()]} ${currentDate.getDate()}, ${currentDate.getFullYear()}`;
      default:
        return `${monthNames[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
    }
  };

  const eventStyleGetter = (event) => {
    if (event.type === "time_off") {
      const entry = event.resource;
      const kind = entry?.kind;
      let backgroundColor = "#a855f7";
      switch (kind) {
        case "sick":
          backgroundColor = "#f87171";
          break;
        case "vacation":
          backgroundColor = "#c084fc";
          break;
        case "personal":
          backgroundColor = "#60a5fa";
          break;
        case "day_off":
          backgroundColor = "#94a3b8";
          break;
        default:
          backgroundColor = "#a855f7";
      }
      return {
        style: {
          backgroundColor: "transparent",
          borderRadius: "8px",
          opacity: 1,
          color: "white",
          border: "none",
          outline: "none",
          fontSize: "13px",
          fontWeight: "500",
          padding: "0",
          boxShadow: "none",
          "--event-bg-color": backgroundColor,
        },
      };
    }

    // Handle appointments differently
    if (event.type === 'appointment') {
      const appointment = event.resource;
      let backgroundColor = "#a78bfa"; // Light purple-blue for appointments

      switch (appointment.appointment_status) {
        case "new":
          backgroundColor = "#9ca3ef"; // Light purple-blue for unconfirmed
          break;
        case "confirmed":
          backgroundColor = "#06b6d4"; // Cyan
          break;
        case "cancelled":
          backgroundColor = "#ef4444"; // Red
          break;
        case "showed":
          backgroundColor = "#10b981"; // Green
          break;
        case "noshow":
          backgroundColor = "#f59e0b"; // Orange/Yellow
          break;
        case "invalid":
          backgroundColor = "#6b7280"; // Gray
          break;
        default:
          backgroundColor = "#9ca3ef";
      }

      return {
        style: {
          backgroundColor: "transparent",
          borderRadius: "8px",
          opacity: 1,
          color: "white",
          border: "none",
          outline: "none",
          fontSize: "13px",
          fontWeight: "500",
          padding: "0",
          boxShadow: "none",
          "--event-bg-color": backgroundColor, // Store color in CSS variable
        },
      };
    }

    // Handle estimates with distinct colors
    if (event.type === 'estimate') {
      const estimate = event.resource;
      // Get estimate status - check both estimate_status and appointment_status
      const estimateStatus = estimate?.estimate_status ?? estimate?.appointment_status ?? "confirmed";
      let backgroundColor = "#14b8a6"; // Default teal for prior quoting

      switch (estimateStatus) {
        // Prior quoting - estimates not yet quoted
        case "confirmed":
        case "on_my_way":
        case "in_progress":
          backgroundColor = "#14b8a6"; // Teal - distinct from jobs
          break;
        // Quoted
        case "quoted":
          backgroundColor = "#f97316"; // Orange - distinct from jobs
          break;
        // Accepted
        case "accepted":
          backgroundColor = "#22c55e"; // Emerald green - distinct from completed jobs
          break;
        // Other statuses
        case "canceled":
        case "cancelled":
          backgroundColor = "#ef4444"; // Red
          break;
        case "declined":
          backgroundColor = "#6b7280"; // Gray
          break;
        case "expired":
          backgroundColor = "#9ca3af"; // Light gray
          break;
        default:
          backgroundColor = "#14b8a6"; // Default to teal for prior quoting
      }

      return {
        style: {
          backgroundColor: "transparent",
          borderRadius: "8px",
          opacity: 1,
          color: "white",
          border: "none",
          outline: "none",
          fontSize: "13px",
          fontWeight: "500",
          padding: "0",
          boxShadow: "none",
          "--event-bg-color": backgroundColor, // Store color in CSS variable
        },
      };
    }

    // Handle jobs
    const job = event.resource;
    let backgroundColor = "#9ca3ef"; // Default light purple-blue (softer tone)

    switch (job.status) {
      case "scheduled":
        backgroundColor = "#9ca3ef"; // Light purple-blue (matching the design)
        break;
      case "pending":
        backgroundColor = "#f59e0b"; // Yellow/Orange
        break;
      case "in_progress":
        backgroundColor = "#3b82f6"; // Blue
        break;
      case "onhold":
        backgroundColor = "#8b5cf6"; // Violet (On Hold)
        break;
      case "completed":
        backgroundColor = "#10b981"; // Green (matching the design)
        break;
      case "cancelled":
        backgroundColor = "#ef4444"; // Red
        break;
    }

    return {
      style: {
        backgroundColor: "transparent",
        borderRadius: "8px",
        opacity: 1,
        color: "white",
        border: "none",
        outline: "none",
        fontSize: "13px",
        fontWeight: "500",
        padding: "0",
        boxShadow: "none",
        "--event-bg-color": backgroundColor, // Store color in CSS variable
      },
    };
  };

  const handleEdit = () => {
    setEditingJob(selectedJob);
    // Close the parent Job Details dialog first
    setSelectedJob(null);
    setSelectedJobId(null);
    // Small delay to ensure parent dialog closes before opening edit dialog
    setTimeout(() => {
      setEditDialogOpen(true);
    }, 100);
  }

  const handleDeleteJob = (jobToDelete, option) => {
    if (!jobToDelete) return
    
    // Get job ID - support both job_id and id fields
    const jobId = jobToDelete.job_id || jobToDelete.id
    if (!jobId) {
      return
    }
    
    // Update the calendar jobs cache to remove the deleted job
    dispatch(
      jobsApi.util.updateQueryData(
        "getCalendarJobs",
        calendarJobsParams,
        (draft) => {
          if (Array.isArray(draft)) {
            if (option === "sequence" && jobToDelete.is_recurring) {
              // Remove all jobs in the recurring sequence
              const filtered = draft.filter(
                (j) => !(
                  (j.customer_name === jobToDelete.customer_name && 
                   j.job_type === jobToDelete.job_type && 
                   j.is_recurring) ||
                  j.series_id === jobToDelete.series_id
                )
              )
              // Clear and repopulate the array
              draft.length = 0
              draft.push(...filtered)
            } else {
              // Remove only the single job
              const index = draft.findIndex(j => 
                j.job_id === jobId || j.id === jobId ||
                j.job_id === jobToDelete.job_id || j.id === jobToDelete.job_id
              )
              if (index !== -1) {
                draft.splice(index, 1)
              }
            }
          }
        }
      )
    )
    
    // Close the job details dialog if the deleted job was selected
    if (selectedJob && (selectedJob.id === jobId || selectedJob.job_id === jobId)) {
      setSelectedJob(null)
      setSelectedJobId(null)
    }
  }

  const handleJobUpdate = (result) => {
    // Update the cache for the calendar jobs query
    // New API returns array directly, not wrapped in results
    dispatch(
      jobsApi.util.updateQueryData(
        "getCalendarJobs",
        calendarJobsParams,
        (draft) => {
          if (Array.isArray(draft)) {
            const index = draft.findIndex(j => j.job_id === result.id || j.job_id === result.job_id);
            if (index !== -1) {
              // Update the occurrence with new data
              draft[index] = {
                ...draft[index],
                ...result,
                job_id: result.id || result.job_id,
              };
            }
          }
        }
      )
    );
    
    // Update the selected job with the new data and ensure modal is shown
    const jobId = result.id || result.job_id;
    if (jobId) {
      // Always set both selectedJobId and selectedJob to ensure modal opens
      setSelectedJobId(jobId);
      setSelectedJob(result);
    }
  }

  // Handle event drop (drag and drop)
  const handleEventDrop = ({ event, start, end }) => {
    // Don't allow dragging appointments
    if (event.type === 'appointment') return;
    
    const job = event.resource;
    if (!job) return;

    // Get job_id from the resource (new API uses job_id)
    const jobId = job.job_id || job.id;
    if (!jobId) return;

    // Get original job date (parse as UTC to show time directly from API)
    const originalMoment = moment.utc(job.scheduled_at);
    const originalDate = originalMoment.format("YYYY-MM-DD");
    const newDateStr = moment(start).format("YYYY-MM-DD");

    // Extract date/time components from start
    // The start Date object represents UTC time components as local time (see event creation at line 807)
    // So we extract the components and treat them as UTC directly
    const startDate = new Date(start);
    const year = startDate.getFullYear();
    const month = startDate.getMonth();
    const date = startDate.getDate();
    const hours = startDate.getHours();
    const minutes = startDate.getMinutes();
    const seconds = startDate.getSeconds();
    
    // Create moment in UTC with the extracted components (treating them as UTC, not local)
    const utcMoment = moment.utc([year, month, date, hours, minutes, seconds]);
    const newScheduledAt = utcMoment.toISOString();

    // In week and day views, directly update since user can see and drag to specific time slots
    // In month view, show time picker when dragging to different date
    if (view === "week" || view === "day") {
      // Week/day view: directly update with the new time (store original for undo)
      updateJobTime({ ...job, id: jobId }, newScheduledAt, job.scheduled_at);
    } else {
      // Month view: show time picker if dropped on different date
      if (originalDate !== newDateStr) {
        // Show time picker dialog
        setDraggedJob({ ...job, id: jobId });
        setNewDate(moment(start).toDate());
        // Set initial time from the drop position (convert UTC to account timezone for display)
        const accountMoment = utcMoment.tz(accountTimezone);
        const hours = accountMoment.hour();
        const hour12 = hours % 12 || 12;
        setSelectedTime({
          hour: hour12.toString(),
          minute: accountMoment.format("mm"),
          period: hours >= 12 ? "PM" : "AM"
        });
        setTimePickerOpen(true);
      } else {
        // Same date in month view, just update time (store original for undo)
        updateJobTime({ ...job, id: jobId }, newScheduledAt, job.scheduled_at);
      }
    }
  };

  // Handle event resize (change duration and/or start time)
  const handleEventResize = ({ event, start, end }) => {
    // Don't allow resizing appointments
    if (event.type === 'appointment') return;
    
    const job = event.resource;
    if (!job) return;

    // Get job_id from the resource (new API uses job_id)
    const jobId = job.job_id || job.id;
    if (!jobId) return;

    // Calculate duration in hours from start and end times
    const startDate = new Date(start);
    const endDate = new Date(end);
    const durationMs = endDate - startDate;
    const durationHours = durationMs / (1000 * 60 * 60); // Convert milliseconds to hours
    
    // Round to 2 decimal places for cleaner values
    const roundedDuration = Math.round(durationHours * 100) / 100;

    // Check if start time changed (resizing from left edge) - parse as UTC to show time directly from API
    const originalMoment = moment.utc(job.scheduled_at);
    const originalStart = originalMoment.toDate();
    const startChanged = Math.abs(startDate.getTime() - originalStart.getTime()) > 60000; // More than 1 minute difference

    if (startChanged) {
      // Start time changed, update both scheduled_at and duration
      const dateStr = moment(startDate).format("YYYY-MM-DD");
      const timeStr = moment(startDate).format("HH:mm:ss");
      const localMoment = moment.tz(`${dateStr} ${timeStr}`, "YYYY-MM-DD HH:mm:ss", accountTimezone);
      const newScheduledAt = localMoment.utc().toISOString();
      
      updateJobTimeAndDuration({ ...job, id: jobId }, newScheduledAt, roundedDuration);
    } else {
      // Only duration changed (resizing from right edge)
      updateJobDuration({ ...job, id: jobId }, roundedDuration);
    }
  };

  // Update job time
  const updateJobTime = async (job, newScheduledAt, originalScheduledAt = null) => {
    try {
      // Store original for undo if not provided
      const original = originalScheduledAt || job.scheduled_at;
      
      const result = await updateJob({
        id: job.id,
        scheduled_at: newScheduledAt,
      }).unwrap();
      
      handleJobUpdate(result);
      
      // Store update info for undo
      setLastUpdateInfo({
        jobId: job.id,
        originalScheduledAt: original,
        newScheduledAt: newScheduledAt,
        job: job
      });
      
      // Auto-dismiss undo notification after 10 seconds
      if (undoTimeoutRef.current) {
        clearTimeout(undoTimeoutRef.current);
      }
      undoTimeoutRef.current = setTimeout(() => {
        setLastUpdateInfo(null);
      }, 10000);
    } catch (error) {
      // Error handled by toast notification
    }
  };

  // Update job duration
  const updateJobDuration = async (job, durationHours) => {
    try {
      // Store original for undo
      const originalScheduledAt = job.scheduled_at;
      const originalDuration = job.duration_hours;
      
      // Ensure minimum duration of 0.5 hours
      const newDuration = Math.max(0.5, durationHours);
      
      const result = await updateJob({
        id: job.id,
        duration_hours: newDuration,
      }).unwrap();
      
      handleJobUpdate(result);
      
      // Store update info for undo (we'll restore both scheduled_at and duration)
      setLastUpdateInfo({
        jobId: job.id,
        originalScheduledAt: originalScheduledAt,
        originalDuration: originalDuration,
        newScheduledAt: result.scheduled_at,
        newDuration: newDuration,
        job: job
      });
      
      // Auto-dismiss undo notification after 10 seconds
      if (undoTimeoutRef.current) {
        clearTimeout(undoTimeoutRef.current);
      }
      undoTimeoutRef.current = setTimeout(() => {
        setLastUpdateInfo(null);
      }, 10000);
    } catch (error) {
      // Error handled by toast notification
    }
  };

  // Update job time and duration
  const updateJobTimeAndDuration = async (job, newScheduledAt, durationHours) => {
    try {
      // Store original for undo
      const originalScheduledAt = job.scheduled_at;
      const originalDuration = job.duration_hours;
      
      // Ensure minimum duration of 0.5 hours
      const newDuration = Math.max(0.5, durationHours);
      
      const result = await updateJob({
        id: job.id,
        scheduled_at: newScheduledAt,
        duration_hours: newDuration,
      }).unwrap();
      
      handleJobUpdate(result);
      
      // Store update info for undo
      setLastUpdateInfo({
        jobId: job.id,
        originalScheduledAt: originalScheduledAt,
        originalDuration: originalDuration,
        newScheduledAt: newScheduledAt,
        newDuration: newDuration,
        job: job
      });
      
      // Auto-dismiss undo notification after 10 seconds
      if (undoTimeoutRef.current) {
        clearTimeout(undoTimeoutRef.current);
      }
      undoTimeoutRef.current = setTimeout(() => {
        setLastUpdateInfo(null);
      }, 10000);
    } catch (error) {
      // Error handled by toast notification
    }
  };

  // Handle time picker confirmation
  const handleTimePickerConfirm = async () => {
    if (!draggedJob || !newDate || isUpdatingTime) return;

    // Store original scheduled_at for undo
    const originalScheduledAt = draggedJob.scheduled_at;

    // Convert 12-hour to 24-hour format
    let hour24 = parseInt(selectedTime.hour);
    if (selectedTime.period === "PM" && hour24 !== 12) hour24 += 12;
    if (selectedTime.period === "AM" && hour24 === 12) hour24 = 0;

    // Create datetime in account timezone, then convert to UTC
    const dateStr = moment(newDate).format("YYYY-MM-DD");
    const timeStr = `${String(hour24).padStart(2, '0')}:${selectedTime.minute}:00`;
    
    // Create moment in account timezone
    const localMoment = moment.tz(`${dateStr} ${timeStr}`, "YYYY-MM-DD HH:mm:ss", accountTimezone);
    
    // Convert to UTC and format as UTC ISO string
    const newScheduledAt = localMoment.utc().toISOString();
    
    setIsUpdatingTime(true);
    
    try {
      await updateJobTime(draggedJob, newScheduledAt);
      
      // Store update info for undo
      setLastUpdateInfo({
        jobId: draggedJob.id,
        originalScheduledAt: originalScheduledAt,
        newScheduledAt: newScheduledAt,
        job: draggedJob
      });
      
      // Auto-dismiss undo notification after 10 seconds
      if (undoTimeoutRef.current) {
        clearTimeout(undoTimeoutRef.current);
      }
      undoTimeoutRef.current = setTimeout(() => {
        setLastUpdateInfo(null);
      }, 10000);
      
      // Close dialog and reset state after a brief delay to show success
      setTimeout(() => {
        setTimePickerOpen(false);
        setDraggedJob(null);
        setNewDate(null);
        setIsUpdatingTime(false);
      }, 500);
    } catch (error) {
      setIsUpdatingTime(false);
      // Error handled by toast notification
    }
  };

  // Handle undo time change
  const handleUndoTimeChange = async () => {
    if (!lastUpdateInfo || isUpdatingTime) return;
    
    setIsUpdatingTime(true);
    
    // Clear auto-dismiss timeout
    if (undoTimeoutRef.current) {
      clearTimeout(undoTimeoutRef.current);
      undoTimeoutRef.current = null;
    }
    
    try {
      // Check if we need to restore duration as well
      if (lastUpdateInfo.originalDuration !== undefined) {
        // Restore both time and duration
        const result = await updateJob({
          id: lastUpdateInfo.job.id,
          scheduled_at: lastUpdateInfo.originalScheduledAt,
          duration_hours: lastUpdateInfo.originalDuration,
        }).unwrap();
        handleJobUpdate(result);
      } else {
        // Only restore scheduled_at
        await updateJobTime(lastUpdateInfo.job, lastUpdateInfo.originalScheduledAt, lastUpdateInfo.newScheduledAt);
      }
      setLastUpdateInfo(null);
      setIsUpdatingTime(false);
    } catch (error) {
      setIsUpdatingTime(false);
      // Error handled by toast notification
    }
  };

  // Handle staff drop on job event
  const handleStaffDrop = async (job, user) => {
    if (!job || !user) return;
    
    // Don't allow staff drops on appointments
    if (job.appointment_id) return;

    // Get job_id from the resource (new API uses job_id)
    const jobId = job.job_id || job.id;
    if (!jobId) return;

    // Check if user is already assigned
    const isAlreadyAssigned = job.assignments?.some(
      (assignment) => assignment.user === user.id
    );

    if (isAlreadyAssigned) {
      // User is already assigned, no need to update
      return;
    }

    try {
      // Get current assignments or empty array
      const currentAssignments = job.assignments || [];
      
      // Add new assignment
      const newAssignments = [
        ...currentAssignments,
        { user: user.id, role: "worker" },
      ];

      // Update job with new assignments using job_id
      const result = await updateJob({
        id: jobId,
        assignments: newAssignments,
      }).unwrap();

      handleJobUpdate(result);
    } catch (error) {
      // Error handled by toast notification
    }
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (undoTimeoutRef.current) {
        clearTimeout(undoTimeoutRef.current);
      }
    };
  }, []);

  const handleCategoryToggle = (categoryId, checked) => {
    setSelectedCategories((prev) => ({
      ...prev,
      [categoryId]: checked,
    }));
  };

  const handleAssigneeToggle = (assigneeId, checked) => {
    const updatedAssignees = {
      ...selectedAssignees,
      [assigneeId]: checked,
    };
    setSelectedAssignees(updatedAssignees);
    
    // Convert selectedAssignees to assignee_ids - API expects comma-separated string
    const selectedIds = Object.keys(updatedAssignees)
      .filter((id) => updatedAssignees[id] === true)
      .map((id) => {
        // Support both numeric IDs and UUIDs/emails
        const numId = parseInt(id);
        return isNaN(numId) ? id : numId;
      });
    
    // Mark as internal update to prevent sync loop
    isInternalUpdate.current = true;
    
    const assigneeIdsString = selectedIds.length > 0 ? selectedIds.join(',') : '';
    
    // Update filterParams with assignee_ids for jobs AND assigned_user_ids for appointments
    // Both APIs should use the same selected team members
    setFilterParams((prev) => ({
      ...prev,
      assignee_ids: assigneeIdsString,
      assigned_user_ids: assigneeIdsString, // Also update appointments filter
    }));
  };

  // Handle select/deselect all team members at once
  const handleSelectAllTeamMembers = (checked) => {
    const updatedAssignees = {};
    users.forEach((user) => {
      updatedAssignees[user.user_id] = checked;
    });
    setSelectedAssignees(updatedAssignees);
    
    // Convert selectedAssignees to assignee_ids - API expects comma-separated string
    const selectedIds = checked
      ? users.map((user) => {
          // Support both numeric IDs and UUIDs/emails
          const numId = parseInt(user.user_id);
          return isNaN(numId) ? (user.user_id || user.email) : numId;
        })
      : [];
    
    // Mark as internal update to prevent sync loop
    isInternalUpdate.current = true;
    
    const assigneeIdsString = selectedIds.length > 0 ? selectedIds.join(',') : '';
    
    // Update filterParams with assignee_ids for jobs AND assigned_user_ids for appointments
    // Both APIs should use the same selected team members
    setFilterParams((prev) => ({
      ...prev,
      assignee_ids: assigneeIdsString,
      assigned_user_ids: assigneeIdsString, // Also update appointments filter
    }));
  };

  const { toast } = useToast();

  // Handle appointment status update
  const handleAppointmentStatusChange = async (newStatus) => {
    if (!selectedAppointment || !selectedAppointment.appointment_id) {
      toast({
        title: "Error",
        description: "Appointment information is missing",
        variant: "destructive",
      });
      return;
    }

    // Don't proceed if status hasn't actually changed
    if (newStatus === selectedAppointment.appointment_status) {
      // Still update the local state to reflect the selection (UI feedback)
      setSelectedAppointment({
        ...selectedAppointment,
        appointment_status: newStatus,
      });
      return;
    }
    
    try {
      const result = await updateAppointment({
        id: selectedAppointment.appointment_id,
        appointment_status: newStatus,
      }).unwrap();
      
      // Update the local state with the new status
      setSelectedAppointment({
        ...selectedAppointment,
        appointment_status: newStatus,
      });
      
      // Manually update the appointments cache for immediate calendar update
      dispatch(
        jobsApi.util.updateQueryData(
          "getAppointmentsCalendar",
          appointmentsParams,
          (draft) => {
            if (Array.isArray(draft)) {
              const index = draft.findIndex(a => a.appointment_id === selectedAppointment.appointment_id);
              if (index !== -1) {
                draft[index] = {
                  ...draft[index],
                  appointment_status: newStatus,
                };
              }
            } else if (draft?.results) {
              const index = draft.results.findIndex(a => a.appointment_id === selectedAppointment.appointment_id);
              if (index !== -1) {
                draft.results[index] = {
                  ...draft.results[index],
                  appointment_status: newStatus,
                };
              }
            }
          }
        )
      );

      toast({
        title: "Success",
        description: "Appointment status updated successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error?.data?.message || "Failed to update appointment status. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Handle appointment deletion
  const handleDeleteAppointment = async () => {
    if (!selectedAppointment || !selectedAppointment.appointment_id) {
      toast({
        title: "Error",
        description: "Appointment information is missing",
        variant: "destructive",
      });
      return;
    }

    try {
      await deleteAppointment(selectedAppointment.appointment_id).unwrap();
      
      // Remove the appointment from the calendar cache
      dispatch(
        jobsApi.util.updateQueryData(
          "getAppointmentsCalendar",
          appointmentsParams,
          (draft) => {
            if (Array.isArray(draft)) {
              const filtered = draft.filter(
                a => a.appointment_id !== selectedAppointment.appointment_id
              );
              draft.length = 0;
              draft.push(...filtered);
            } else if (draft?.results) {
              draft.results = draft.results.filter(
                a => a.appointment_id !== selectedAppointment.appointment_id
              );
            }
          }
        )
      );

      // Close dialogs
      setDeleteAppointmentDialogOpen(false);
      setSelectedAppointment(null);

      toast({
        title: "Success",
        description: "Appointment deleted successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error?.data?.message || "Failed to delete appointment. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Handle estimate status update
  const handleEstimateStatusChange = async (newStatus) => {
    if (!selectedEstimate || !selectedEstimate.appointment_id) {
      toast({
        title: "Error",
        description: "Estimate information is missing",
        variant: "destructive",
      });
      return;
    }

    // Get current status: use estimate_status if not null, otherwise fall back to appointment_status
    const currentStatus = selectedEstimate.estimate_status ?? selectedEstimate.appointment_status;

    // Don't proceed if status hasn't actually changed
    if (newStatus === currentStatus) {
      // Still update the local state to reflect the selection (UI feedback)
      setSelectedEstimate({
        ...selectedEstimate,
        estimate_status: newStatus,
      });
      return;
    }
    
    try {
      const result = await updateEstimateStatus({
        id: selectedEstimate.appointment_id,
        estimate_status: newStatus,
      }).unwrap();
      
      // Update the local state with the new status
      setSelectedEstimate({
        ...selectedEstimate,
        estimate_status: newStatus,
      });
      
      // Manually update the estimates cache for immediate calendar update
      dispatch(
        jobsApi.util.updateQueryData(
          "getEstimateAppointmentsCalendar",
          estimatesParams,
          (draft) => {
            if (Array.isArray(draft)) {
              const index = draft.findIndex(e => e.appointment_id === selectedEstimate.appointment_id);
              if (index !== -1) {
                draft[index] = {
                  ...draft[index],
                  estimate_status: newStatus,
                };
              }
            } else if (draft?.results) {
              const index = draft.results.findIndex(e => e.appointment_id === selectedEstimate.appointment_id);
              if (index !== -1) {
                draft.results[index] = {
                  ...draft.results[index],
                  estimate_status: newStatus,
                };
              }
            }
          }
        )
      );

      toast({
        title: "Success",
        description: "Estimate status updated successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error?.data?.message || "Failed to update estimate status. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Handle estimate deletion
  const handleDeleteEstimate = async () => {
    if (!selectedEstimate || !selectedEstimate.appointment_id) {
      toast({
        title: "Error",
        description: "Estimate information is missing",
        variant: "destructive",
      });
      return;
    }

    try {
      await deleteEstimate(selectedEstimate.appointment_id).unwrap();
      
      // Remove the estimate from the calendar cache
      dispatch(
        jobsApi.util.updateQueryData(
          "getEstimateAppointmentsCalendar",
          estimatesParams,
          (draft) => {
            if (Array.isArray(draft)) {
              const filtered = draft.filter(
                e => e.appointment_id !== selectedEstimate.appointment_id
              );
              draft.length = 0;
              draft.push(...filtered);
            } else if (draft?.results) {
              draft.results = draft.results.filter(
                e => e.appointment_id !== selectedEstimate.appointment_id
              );
            }
          }
        )
      );

      // Close dialogs
      setDeleteEstimateDialogOpen(false);
      setSelectedEstimate(null);

      toast({
        title: "Success",
        description: "Estimate deleted successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error?.data?.message || "Failed to delete estimate. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <>
    <style>{calendarStyles}</style>
    <DndProvider backend={HTML5Backend}>
      <div className="space-y-4 w-full overflow-hidden">
        <div className="flex flex-col md:flex-row gap-4 w-full min-w-0 relative">
          {/* Mobile Overlay - Must be before sidebar for proper z-index */}
          {showSidebar && (
            <div
              className="md:hidden fixed inset-0 bg-black/50 z-40"
              onClick={() => setShowSidebar(false)}
              aria-hidden="true"
            />
          )}

          {/* Main Calendar */}
          <div className={cn(
            "flex-1 min-w-0 overflow-hidden w-full",
            "transition-all duration-300 ease-in-out"
          )}>
            <Card className="w-full">
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
              <CardTitle className="flex items-center gap-2">
                <CalendarDays className="h-5 w-5" />
                Calendar
              </CardTitle>
              <div className="flex items-center gap-2 flex-wrap justify-end">
                {(userRole === "admin" || userRole === "supervisor" || userRole === "manager") && (
                    <Button
                      onClick={() => navigate("/admin/calendar/create-job")}
                      className="bg-primary text-primary-foreground hover:bg-primary/90 text-xs sm:text-sm px-2 sm:px-4"
                      size="sm"
                    >
                      <Plus className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                      <span className="hidden sm:inline">Create Job</span>
                      <span className="sm:hidden">Job</span>
                    </Button>
                )}
                <Link 
                  to={user?.role === "worker" 
                    ? `${import.meta.env.VITE_SERVICE_PILOT_APP_URL || 'https://app.theservicepilot.com'}/v2/location/${import.meta.env.VITE_LOCATION_ID || 'b8qvo7VooP3JD3dIZU42'}/calendars/view?user_ids=${user?.ghl_user_id}` 
                    : `${import.meta.env.VITE_SERVICE_PILOT_APP_URL || 'https://app.theservicepilot.com'}/v2/location/${import.meta.env.VITE_LOCATION_ID || 'b8qvo7VooP3JD3dIZU42'}/calendars/view`}
                  target="_blank"
                  rel="noopener noreferrer"
                  >
                  <Button
                    className="bg-primary text-primary-foreground hover:bg-primary/90 text-xs sm:text-sm px-2 sm:px-4"
                    size="sm"
                    >
                    <Plus className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                    <span className="hidden sm:inline">Create Appointment</span>
                    <span className="sm:hidden">Appt</span>
                  </Button>
                </Link>
                {/* Mobile Sidebar Toggle Button - Right side */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowSidebar(!showSidebar)}
                  className="flex items-center gap-2 md:hidden"
                >
                  <Filter className="h-4 w-4" />
                  Filters
                </Button>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              {/* Monthly Total - Only show in month view and when jobs are selected */}
              {view === "month" && showJobs && monthlyTotal > 0 && (
                <div className="flex items-center justify-end">
                  <div className="flex items-baseline gap-2 bg-white border border-gray-200 rounded-lg px-4 py-2.5 shadow-sm">
                    <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Total Booked</span>
                    <span className="text-lg sm:text-xl font-bold text-gray-900">{formatPrice(monthlyTotal)}</span>
                  </div>
                </div>
              )}
              {/* Mobile: Stack controls vertically, Desktop: Horizontal */}
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 sm:gap-3">
                <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={navigateToday} 
                    className="text-xs sm:text-sm h-8 sm:h-9 px-2 sm:px-3"
                  >
                    Today
                  </Button>
                  <div className="flex items-center border rounded-md">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={navigateBack} 
                      className="rounded-r-none border-r h-8 w-8 sm:h-9 sm:w-9"
                    >
                      <ChevronLeft className="h-3 w-3 sm:h-4 sm:w-4" />
                    </Button>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button 
                          variant="ghost" 
                          className="font-semibold min-w-[100px] sm:min-w-[140px] md:min-w-[180px] rounded-none text-xs sm:text-sm px-2 sm:px-4 h-8 sm:h-9"
                        >
                          {getDateTitle()}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <DatePicker
                          mode="single"
                          selected={currentDate}
                          onSelect={(date) => {
                            if (date) {
                              setCurrentDate(date);
                            }
                          }}
                          initialFocus
                          className={cn("p-3 pointer-events-auto")}
                        />
                      </PopoverContent>
                    </Popover>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={navigateNext} 
                      className="rounded-l-none border-l h-8 w-8 sm:h-9 sm:w-9"
                    >
                      <ChevronRight className="h-3 w-3 sm:h-4 sm:w-4" />
                    </Button>
                  </div>

                  <Select 
                    value={view} 
                    onValueChange={(value) => setView(value)}
                    aria-label="Select calendar view"
                  >
                    <SelectTrigger className="w-[90px] sm:w-[120px] md:w-[140px] text-xs sm:text-sm h-8 sm:h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="z-[1300]">
                      <SelectItem value="month">Month</SelectItem>
                      <SelectItem value="week">Week</SelectItem>
                      <SelectItem value="day">Day</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-2 sm:p-6 relative w-full overflow-hidden">
            {(isLoading || isFetching || isLoadingAppointments || isFetchingAppointments) && (
              <div className="absolute inset-0 bg-background/50 z-50 flex items-center justify-center rounded-lg">
                <div className="flex flex-col items-center gap-2">
                  <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-sm text-muted-foreground">Loading calendar...</span>
                </div>
              </div>
            )}
            
            <div
              className="min-h-[320px] w-full max-w-full overflow-hidden"
              style={{
                height: view === "month" ? monthTotalHeight : "auto",
                ["--month-row-height"]: `${monthRowHeight}px`,
              }}
            >
              <div className="w-full h-full max-w-full overflow-hidden">
                {view === "day" ? (
                  <DayByTechnicianView
                    date={currentDate}
                    events={events}
                    resources={calendarResources.map((r) => ({ id: r.id, title: r.name, name: r.name }))}
                    eventStyleGetter={eventStyleGetter}
                    onSelectEvent={handleSelectEvent}
                    onStaffDrop={handleStaffDrop}
                    onRemoveAssignee={(assigneeId) => handleAssigneeToggle(assigneeId, false)}
                  />
                ) : (
                  <FullCalendar
                    key={`fc-${view}-${currentDate.getTime()}-${fcEvents.length}`}
                    plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
                    initialView={view === "month" ? "dayGridMonth" : "timeGridWeek"}
                    initialDate={currentDate}
                    events={fcEvents}
                    headerToolbar={false}
                    firstDay={1}
                    height={view === "month" ? monthTotalHeight : "auto"}
                    contentHeight={view === "month" ? monthTotalHeight : undefined}
                    dayMaxEvents={false}
                    slotMinTime="06:00:00"
                    slotMaxTime="24:00:00"
                    allDaySlot={false}
                    nowIndicator
                    editable
                    dayCellClassNames={(arg) => (usHolidayMap[toLocalDateKey(arg.date)] ? ["fc-us-holiday-day"] : [])}
                    dayHeaderClassNames={(arg) => (usHolidayMap[toLocalDateKey(arg.date)] ? ["fc-us-holiday-day"] : [])}
                    dayCellContent={(arg) => {
                      const holidayName = usHolidayMap[toLocalDateKey(arg.date)];
                      return (
                        <div className="flex flex-col items-end gap-0.5 w-full min-w-0">
                          <span>{arg.dayNumberText}</span>
                          {holidayName ? (
                            <span className="fc-us-holiday" title={holidayName}>
                              {holidayName}
                            </span>
                          ) : null}
                        </div>
                      );
                    }}
                    dayHeaderContent={(arg) => {
                      const holidayName = view === "month" ? "" : usHolidayMap[toLocalDateKey(arg.date)];
                      if (!holidayName) return arg.text;
                      return (
                        <div className="fc-day-header-with-holiday">
                          <span>{arg.text}</span>
                          <span className="fc-us-holiday" title={holidayName}>{holidayName}</span>
                        </div>
                      );
                    }}
                    eventStartEditable={(info) =>
                      info.event.extendedProps?.type !== "appointment" &&
                      info.event.extendedProps?.type !== "more" &&
                      info.event.extendedProps?.type !== "time_off"
                    }
                    eventDurationEditable={(info) =>
                      info.event.extendedProps?.type !== "appointment" &&
                      info.event.extendedProps?.type !== "more" &&
                      info.event.extendedProps?.type !== "time_off"
                    }
                    eventClick={(info) => {
                      info.jsEvent.preventDefault();
                      const ext = info.event.extendedProps || {};
                      handleSelectEvent({
                        id: info.event.id,
                        title: info.event.title,
                        start: info.event.start,
                        end: info.event.end,
                        resource: ext.resource,
                        type: ext.type || "job",
                      });
                    }}
                    eventDrop={(info) => {
                      const ext = info.event.extendedProps || {};
                      if (ext.type === "time_off") {
                        info.revert();
                        return;
                      }
                      handleEventDrop({
                        event: {
                          id: info.event.id,
                          title: info.event.title,
                          start: info.event.start,
                          end: info.event.end,
                          resource: ext.resource,
                          type: ext.type || "job",
                        },
                        start: info.event.start,
                        end: info.event.end,
                      });
                    }}
                    eventResize={(info) => {
                      const ext = info.event.extendedProps || {};
                      if (ext.type === "time_off") {
                        info.revert();
                        return;
                      }
                      handleEventResize({
                        event: {
                          id: info.event.id,
                          title: info.event.title,
                          start: info.event.start,
                          end: info.event.end,
                          resource: ext.resource,
                          type: ext.type || "job",
                        },
                        start: info.event.start,
                        end: info.event.end,
                      });
                    }}
                    dayCellDidMount={(arg) => {
                      const d = new Date(arg.date);
                      const year = d.getFullYear();
                      const month = String(d.getMonth() + 1).padStart(2, "0");
                      const day = String(d.getDate()).padStart(2, "0");
                      const dateKey = `${year}-${month}-${day}`;
                      const isSunday = d.getDay() === 0;
                      let label;
                      let amount;
                      if (isSunday && view === "month") {
                        // Sunday in month view: show weekly total (Mon–Sun) for that week
                        const weekTotal = weeklyTotalsBySunday[dateKey] || 0;
                        amount = weekTotal;
                        label = `Week: ${formatPrice(weekTotal)}`;
                      } else {
                        const dayTotal = dailyTotals[dateKey] || 0;
                        const eventsForDay = (view === "month" || view === "week") ? displayEvents : events;
                        const hasJobEvents = eventsForDay.some((ev) => {
                          if (ev.type !== "job") return false;
                          const ed = new Date(ev.start);
                          return (
                            ed.getFullYear() === year &&
                            String(ed.getMonth() + 1).padStart(2, "0") === month &&
                            String(ed.getDate()).padStart(2, "0") === day
                          );
                        });
                        if (!showJobs || dayTotal <= 0 || !hasJobEvents) return;
                        amount = dayTotal;
                        label = `Total: ${formatPrice(dayTotal)}`;
                      }
                      if (!showJobs) return;
                      if (!isSunday && amount <= 0) return;
                      const eventsForCell = (view === "month" || view === "week") ? displayEvents : events;
                      const hasJobEventsInCell = !isSunday && eventsForCell.some((ev) => {
                        if (ev.type !== "job") return false;
                        const ed = new Date(ev.start);
                        return (
                          ed.getFullYear() === year &&
                          String(ed.getMonth() + 1).padStart(2, "0") === month &&
                          String(ed.getDate()).padStart(2, "0") === day
                        );
                      });
                      if (!isSunday && !hasJobEventsInCell) return;
                      const div = document.createElement("div");
                      div.className = "daily-job-total-fc";
                      div.textContent = label;
                      div.style.cssText =
                        "position:absolute;top:2px;left:2px;z-index:2;max-width:calc(100% - 4px);overflow:hidden;text-overflow:ellipsis;pointer-events:none;";
                      arg.el.style.position = "relative";
                      arg.el.appendChild(div);
                    }}
                    eventContent={(arg) => (
                      <FullCalendarEventContent
                        arg={arg}
                        onStaffDrop={handleStaffDrop}
                        onSelectEvent={handleSelectEvent}
                        eventStyleGetter={eventStyleGetter}
                      />
                    )}
                  />
                )}
              </div>
            </div>
          </CardContent>
            </Card>
        </div>

          {/* Right Sidebar - Mobile: Full width overlay, Desktop: Sidebar */}
          {showSidebar && (
            <div className={cn(
              "flex-shrink-0",
              "md:relative md:w-auto",
              "fixed md:static inset-y-0 right-0 md:inset-auto z-50 md:z-auto",
              "bg-background md:bg-transparent",
              "overflow-y-auto md:overflow-visible",
              "w-[85vw] max-w-[320px] md:w-[300px] lg:w-[340px]",
              "shadow-lg md:shadow-none",
              "transition-all duration-300 ease-in-out"
            )}>
              {/* Mobile Close Button */}
              <div className="md:hidden flex justify-between items-center p-4 border-b sticky top-0 bg-background z-10">
                <Typography variant="h6" className="font-semibold">Filters</Typography>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowSidebar(false)}
                  className="h-8 w-8"
                  aria-label="Close filters"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              
              <div className="w-full">
                <TimelineSidebar
                  currentDate={currentDate}
                  onDateChange={(date) => setCurrentDate(date)}
                  users={users}
                  isLoadingUsers={isLoadingUsers}
                  canViewStaff={canViewStaff}
                  userRole={userRole}
                  selectedCategories={selectedCategories}
                  onCategoryToggle={handleCategoryToggle}
                  selectedAssignees={selectedAssignees}
                  onAssigneeToggle={handleAssigneeToggle}
                  onSelectAllTeamMembers={handleSelectAllTeamMembers}
                  filterParams={filterParams}
                  onFilterChange={(field, value) => {
                    setFilterParams((prev) => ({
                      ...prev,
                      [field]: value,
                    }));
                  }}
                  jobs={jobs}
                  onToggleSidebar={() => setShowSidebar(false)}
                  showSidebar={showSidebar}
                />
              </div>
            </div>
          )}

          {/* Floating Expand Button - Shows when sidebar is collapsed on desktop */}
          {!showSidebar && (
            <div className="hidden md:block fixed right-4 top-1/2 -translate-y-1/2 z-40">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setShowSidebar(true)}
                className="rounded-full shadow-lg text-[#065F46] bg-[#34D399] hover:bg-[#34D399]/95 h-10 w-10"
                title="Show filters"
              >
                <PanelLeftClose className="h-5 w-5" />
              </Button>
            </div>
          )}
        </div>
      </div>
    </DndProvider>

      <Dialog open={!!selectedJob || !!selectedJobId} onOpenChange={() => {
        setSelectedJob(null);
        setSelectedJobId(null);
      }}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-lg max-h-[calc(100vh-2rem)] sm:max-h-[90vh] flex flex-col gap-0 p-0 sm:p-6">
          <div className="flex-shrink-0 border-b px-4 pb-4 pt-6 pr-12 sm:px-0 sm:pb-4 sm:pt-0 sm:pr-10">
            <DialogHeader className="space-y-1 text-left">
              <DialogTitle className="text-lg font-semibold tracking-tight">Job Details</DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                View and manage job information
              </DialogDescription>
            </DialogHeader>
          </div>
          <div className="flex-1 overflow-y-auto overflow-x-hidden px-4 pb-4 pt-4 sm:px-0 sm:pb-0 sm:pt-4 min-h-0 md:mb-0 mb-60">
            {(() => {
              // Check if selectedJob matches selectedJobId
              const jobMatches = selectedJob && selectedJobId && (
                selectedJob.id === selectedJobId || 
                selectedJob.job_id === selectedJobId
              );
              
              // Show loading if: API is loading OR we have a jobId but no matching job data
              if (isLoadingJobDetails || (selectedJobId && !jobMatches)) {
                return (
                  <div className="flex items-center justify-center py-8">
                    <div className="flex flex-col items-center gap-2">
                      <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                      <span className="text-sm text-muted-foreground">Loading job details...</span>
                    </div>
                  </div>
                );
              }
              
              // Show job details only if we have matching job data
              if (selectedJob && jobMatches) {
                return (
                  <JobCard
                    job={selectedJob}
                    onEdit={handleEdit}
                    onDelete={handleDeleteJob}
                    onUpdate={handleJobUpdate}
                    users={users}
                    accountTimezone={accountTimezone}
                    embeddedInDialog
                  />
                );
              }
              
              return null;
            })()}
          </div>
        </DialogContent>
      </Dialog>

      {/* Appointment Details Dialog */}
      <Dialog 
        open={!!selectedAppointment} 
        onOpenChange={(open) => {
          if (!open) setSelectedAppointment(null);
        }}
      >
        <DialogContent 
          className="max-w-[calc(100vw-2rem)] sm:max-w-md max-h-[calc(100vh-2rem)] sm:max-h-[90vh] flex flex-col p-0 sm:p-6"
          onInteractOutside={(e) => {
            // Prevent closing when clicking on Select dropdown
            const target = e.target;
            if (target && (target.closest('[role="listbox"]') || target.closest('[data-radix-portal]'))) {
              e.preventDefault();
            }
          }}
        >
          <div className="flex-shrink-0 px-4 pt-6 pb-4 sm:px-0 sm:pt-0">
            <DialogHeader>
              <DialogTitle>Appointment Details</DialogTitle>
              <DialogDescription>View appointment information</DialogDescription>
            </DialogHeader>
          </div>
          <div className="flex-1 overflow-y-auto overflow-x-hidden px-4 pb-4 sm:px-0 sm:pb-0 min-h-0">
            {selectedAppointment && (
              <div className="space-y-4">
              {/* Customer Information Section - At the Top */}
              <div className="space-y-3 pb-4 border-b">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Customer Information
                </Label>
                <div className="space-y-2.5">
                  {selectedAppointment.contact_name && (
                    <div className="flex items-center gap-2">
                      <User size={16} className="text-muted-foreground flex-shrink-0" />
                      {selectedAppointment.ghl_contact_id ? (
                        <a
                          href={`${import.meta.env.VITE_SERVICE_PILOT_APP_URL || 'https://app.theservicepilot.com'}/v2/location/${import.meta.env.VITE_LOCATION_ID || 'b8qvo7VooP3JD3dIZU42'}/contacts/detail/${selectedAppointment.ghl_contact_id}/`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-primary hover:text-primary/80 hover:underline transition-all duration-200"
                        >
                          {selectedAppointment.contact_name}
                        </a>
                      ) : (
                        <span className="text-sm">{selectedAppointment.contact_name}</span>
                      )}
                    </div>
                  )}

                  {selectedAppointment.address && (
                    <div className="flex items-start gap-2">
                      <MapPin size={16} className="text-muted-foreground flex-shrink-0 mt-0.5" />
                      <div 
                        className="text-sm text-primary hover:text-primary/80 cursor-pointer hover:underline transition-all duration-200"
                        onClick={() =>
                          window.open(
                            `${import.meta.env.VITE_GOOGLE_MAPS_SEARCH_URL || 'https://www.google.com/maps/search/?api=1&query='}${encodeURIComponent(selectedAppointment.address)}`,
                            "_blank",
                          )
                        }
                      >
                        {selectedAppointment.address}
                      </div>
                    </div>
                  )}

                  {(selectedAppointment.contact_phone || selectedAppointment.customer_phone || selectedAppointment.phone) && (
                    <div className="flex items-center gap-2">
                      <Phone size={16} className="text-muted-foreground flex-shrink-0" />
                      <a
                        href={`tel:${selectedAppointment.contact_phone || selectedAppointment.customer_phone || selectedAppointment.phone}`}
                        className="text-sm text-primary hover:text-primary/80 hover:underline transition-all duration-200"
                      >
                        {selectedAppointment.contact_phone || selectedAppointment.customer_phone || selectedAppointment.phone}
                      </a>
                    </div>
                  )}

                  {(selectedAppointment.contact_email || selectedAppointment.customer_email || selectedAppointment.email) && (
                    <div className="flex items-center gap-2">
                      <Mail size={16} className="text-muted-foreground flex-shrink-0" />
                      <a
                        href={`mailto:${selectedAppointment.contact_email || selectedAppointment.customer_email || selectedAppointment.email}`}
                        className="text-sm text-primary hover:text-primary/80 hover:underline transition-all duration-200"
                      >
                        {selectedAppointment.contact_email || selectedAppointment.customer_email || selectedAppointment.email}
                      </a>
                    </div>
                  )}
                </div>
              </div>

              {/* Appointment Details Section */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-semibold">Title</Label>
                  <span className="text-sm">{selectedAppointment.title || "N/A"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-semibold">Assigned To</Label>
                  <span className="text-sm">{selectedAppointment.assigned_user_name || "Unassigned"}</span>
                </div>

                {selectedAppointment.calendar && (
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-semibold">Calendar</Label>
                    <a
                      href={`${import.meta.env.VITE_SERVICE_PILOT_APP_URL || 'https://app.theservicepilot.com'}/v2/location/${import.meta.env.VITE_LOCATION_ID || 'b8qvo7VooP3JD3dIZU42'}/calendars/view?user_ids=${user?.ghl_user_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-primary hover:text-primary/80 decoration-primary/30 hover:decoration-primary/60 transition-all duration-200 flex items-center gap-1.5 font-medium"
                    >
                      {selectedAppointment.calendar.name || "View Calendar"}
                      <svg 
                        className="h-3.5 w-3.5" 
                        fill="none" 
                        stroke="currentColor" 
                        viewBox="0 0 24 24"
                      >
                        <path 
                          strokeLinecap="round" 
                          strokeLinejoin="round" 
                          strokeWidth={2} 
                          d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" 
                        />
                      </svg>
                    </a>
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <Label className="text-sm font-semibold">Status</Label>
                  <Select
                    value={selectedAppointment.appointment_status || "new"}
                    onValueChange={handleAppointmentStatusChange}
                    disabled={isUpdatingAppointment}
                  >
                    <SelectTrigger className="w-[140px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent 
                      className="z-[1300] !fixed" 
                      onCloseAutoFocus={(e) => e.preventDefault()}
                      onEscapeKeyDown={(e) => {
                        e.stopPropagation();
                      }}
                      onPointerDownOutside={(e) => {
                        // Allow closing when clicking outside, but prevent dialog from closing
                        const target = e.target;
                        // Only prevent if clicking on the dialog overlay
                        if (target && target.hasAttribute && target.hasAttribute('data-radix-dialog-overlay')) {
                          e.preventDefault();
                        }
                      }}
                    >
                      <SelectItem value="new">Unconfirmed</SelectItem>
                      <SelectItem value="confirmed">Confirmed</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                      <SelectItem value="showed">Showed</SelectItem>
                      <SelectItem value="noshow">No Show</SelectItem>
                      <SelectItem value="invalid">Invalid</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-sm font-semibold">Start Time</Label>
                  <div className="text-sm">
                    {selectedAppointment.start_time 
                      ? moment.utc(selectedAppointment.start_time).tz(accountTimezone).format("MMMM D, YYYY h:mm A")
                      : "N/A"}
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-sm font-semibold">End Time</Label>
                  <div className="text-sm">
                    {selectedAppointment.end_time 
                      ? moment.utc(selectedAppointment.end_time).tz(accountTimezone).format("MMMM D, YYYY h:mm A")
                      : "N/A"}
                  </div>
                </div>
                {selectedAppointment.notes && (
                  <div className="space-y-1">
                    <Label className="text-sm font-semibold">Notes</Label>
                    <div className="text-sm whitespace-pre-wrap">{selectedAppointment.notes}</div>
                  </div>
                )}
                {selectedAppointment.source && (
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-semibold">Source</Label>
                    <span className="text-sm">{selectedAppointment.source}</span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-semibold">Users Count</Label>
                  <span className="text-sm">{selectedAppointment.users_count || 0}</span>
                </div>
              </div>
              <div className="pt-4 border-t">
                <Button
                  variant="destructive"
                  onClick={() => setDeleteAppointmentDialogOpen(true)}
                  className="w-full"
                  disabled={isDeletingAppointment}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Appointment
                </Button>
              </div>
            </div>
          )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Appointment Confirmation Dialog */}
      <Dialog 
        open={deleteAppointmentDialogOpen} 
        onOpenChange={(open) => {
          if (!isDeletingAppointment) {
            setDeleteAppointmentDialogOpen(open);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-destructive" />
              Delete Appointment
            </DialogTitle>
            <DialogDescription>
              You're about to delete "{selectedAppointment?.title || 'this appointment'}"
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <Alert variant="destructive">
              <AlertDescription>
                Are you sure you want to delete "{selectedAppointment?.title || 'this appointment'}"? This action cannot be undone.
              </AlertDescription>
            </Alert>
          </div>

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setDeleteAppointmentDialogOpen(false)} 
              disabled={isDeletingAppointment}
            >
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleDeleteAppointment} 
              disabled={isDeletingAppointment}
            >
              {isDeletingAppointment ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Appointment
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!selectedTimeOff}
        onOpenChange={(open) => {
          if (!open) setSelectedTimeOff(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Time off</DialogTitle>
            <DialogDescription>
              {selectedTimeOff?.employee_name || "Scheduled absence"}
            </DialogDescription>
          </DialogHeader>
          {selectedTimeOff && (
            <div className="space-y-3 text-sm py-2">
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground">Type</span>
                <span className="font-medium text-right">
                  {TIME_OFF_KIND_LABELS[selectedTimeOff.kind] || selectedTimeOff.kind}
                </span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground">From</span>
                <span>{selectedTimeOff.start_date}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground">To</span>
                <span>{selectedTimeOff.end_date}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground">Schedule</span>
                <span className="font-medium text-right">
                  {formatTimeOffScheduleSummary(selectedTimeOff)}
                </span>
              </div>
              {formatEquivalentDays(selectedTimeOff.equivalent_days) && (
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">Equivalent</span>
                  <span className="font-medium">
                    {formatEquivalentDays(selectedTimeOff.equivalent_days)}
                  </span>
                </div>
              )}
              {selectedTimeOff.employee_email && (
                <div className="flex justify-between gap-2 min-w-0">
                  <span className="text-muted-foreground shrink-0">Email</span>
                  <span className="truncate">{selectedTimeOff.employee_email}</span>
                </div>
              )}
              {selectedTimeOff.notes ? (
                <div>
                  <span className="text-muted-foreground block mb-1">Notes</span>
                  <p className="whitespace-pre-wrap text-foreground">{selectedTimeOff.notes}</p>
                </div>
              ) : null}
              <Button variant="outline" className="w-full mt-2" asChild>
                <Link to="/admin/payroll/time-off">Manage in Payroll</Link>
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Estimate Details Dialog */}
      <Dialog 
        open={!!selectedEstimate} 
        onOpenChange={(open) => {
          if (!open) setSelectedEstimate(null);
        }}
      >
        <DialogContent 
          className="max-w-[calc(100vw-2rem)] sm:max-w-md max-h-[calc(100vh-2rem)] sm:max-h-[90vh] flex flex-col p-0 sm:p-6"
          onInteractOutside={(e) => {
            // Prevent closing when clicking on Select dropdown
            const target = e.target;
            if (target && (target.closest('[role="listbox"]') || target.closest('[data-radix-portal]'))) {
              e.preventDefault();
            }
          }}
        >
          <div className="flex-shrink-0 px-4 pt-6 pb-4 sm:px-0 sm:pt-0">
            <DialogHeader>
              <DialogTitle>Estimate Details</DialogTitle>
              <DialogDescription>View estimate information</DialogDescription>
            </DialogHeader>
          </div>
          <div className="flex-1 overflow-y-auto overflow-x-hidden px-4 pb-4 sm:px-0 sm:pb-0 min-h-0">
            {selectedEstimate && (
              <div className="space-y-4">
              {/* Customer Information Section - At the Top */}
              <div className="space-y-3 pb-4 border-b">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Customer Information
                </Label>
                <div className="space-y-2.5">
                  {selectedEstimate.contact_name && (
                    <div className="flex items-center gap-2">
                      <User size={16} className="text-muted-foreground flex-shrink-0" />
                      {selectedEstimate.ghl_contact_id ? (
                        <a
                          href={`${import.meta.env.VITE_SERVICE_PILOT_APP_URL || 'https://app.theservicepilot.com'}/v2/location/${import.meta.env.VITE_LOCATION_ID || 'b8qvo7VooP3JD3dIZU42'}/contacts/detail/${selectedEstimate.ghl_contact_id}/`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-primary hover:text-primary/80 hover:underline transition-all duration-200"
                        >
                          {selectedEstimate.contact_name}
                        </a>
                      ) : (
                        <span className="text-sm">{selectedEstimate.contact_name}</span>
                      )}
                    </div>
                  )}

                  {(selectedEstimate.address || selectedEstimate.contact_full_address) && (
                    <div className="flex items-start gap-2">
                      <MapPin size={16} className="text-muted-foreground flex-shrink-0 mt-0.5" />
                      <a
                        href={`${import.meta.env.VITE_GOOGLE_MAPS_SEARCH_URL || 'https://www.google.com/maps/search/?api=1&query='}${encodeURIComponent(
                          selectedEstimate.address || selectedEstimate.contact_full_address
                        )}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-primary hover:text-primary/80 cursor-pointer hover:underline transition-all duration-200"
                      >
                        {selectedEstimate.address || selectedEstimate.contact_full_address}
                      </a>
                    </div>
                  )}


                  {(selectedEstimate.contact_phone || selectedEstimate.customer_phone || selectedEstimate.phone) && (
                    <div className="flex items-center gap-2">
                      <Phone size={16} className="text-muted-foreground flex-shrink-0" />
                      <a
                        href={`tel:${selectedEstimate.contact_phone || selectedEstimate.customer_phone || selectedEstimate.phone}`}
                        className="text-sm text-primary hover:text-primary/80 hover:underline transition-all duration-200"
                      >
                        {selectedEstimate.contact_phone || selectedEstimate.customer_phone || selectedEstimate.phone}
                      </a>
                    </div>
                  )}

                  {(selectedEstimate.contact_email || selectedEstimate.customer_email || selectedEstimate.email) && (
                    <div className="flex items-center gap-2">
                      <Mail size={16} className="text-muted-foreground flex-shrink-0" />
                      <a
                        href={`mailto:${selectedEstimate.contact_email || selectedEstimate.customer_email || selectedEstimate.email}`}
                        className="text-sm text-primary hover:text-primary/80 hover:underline transition-all duration-200"
                      >
                        {selectedEstimate.contact_email || selectedEstimate.customer_email || selectedEstimate.email}
                      </a>
                    </div>
                  )}
                </div>
              </div>

              {/* Estimate Details Section */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-semibold">Title</Label>
                  <span className="text-sm">{selectedEstimate.title || "N/A"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-semibold">Assigned To</Label>
                  <span className="text-sm">{selectedEstimate.assigned_user_name || "Unassigned"}</span>
                </div>

                {selectedEstimate.calendar && (
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-semibold">Calendar</Label>
                    <a
                      href={`${import.meta.env.VITE_SERVICE_PILOT_APP_URL || 'https://app.theservicepilot.com'}/v2/location/${import.meta.env.VITE_LOCATION_ID || 'b8qvo7VooP3JD3dIZU42'}/calendars/view?user_ids=${user?.ghl_user_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-primary hover:text-primary/80 decoration-primary/30 hover:decoration-primary/60 transition-all duration-200 flex items-center gap-1.5 font-medium"
                    >
                      {selectedEstimate.calendar.name || "View Calendar"}
                      <svg 
                        className="h-3.5 w-3.5" 
                        fill="none" 
                        stroke="currentColor" 
                        viewBox="0 0 24 24"
                      >
                        <path 
                          strokeLinecap="round" 
                          strokeLinejoin="round" 
                          strokeWidth={2} 
                          d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" 
                        />
                      </svg>
                    </a>
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <Label className="text-sm font-semibold">Status</Label>
                  <Select
                    value={selectedEstimate.estimate_status ?? selectedEstimate.appointment_status ?? ""}
                    onValueChange={handleEstimateStatusChange}
                    disabled={isUpdatingEstimate}
                  >
                    <SelectTrigger className="w-[140px]">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent 
                      className="z-[1300] !fixed" 
                      onCloseAutoFocus={(e) => e.preventDefault()}
                      onEscapeKeyDown={(e) => {
                        e.stopPropagation();
                      }}
                      onPointerDownOutside={(e) => {
                        // Allow closing when clicking outside, but prevent dialog from closing
                        const target = e.target;
                        // Only prevent if clicking on the dialog overlay
                        if (target && target.hasAttribute && target.hasAttribute('data-radix-dialog-overlay')) {
                          e.preventDefault();
                        }
                      }}
                    >
                      <SelectItem value="confirmed">Confirmed</SelectItem>
                      <SelectItem value="on_my_way">On My Way</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="quoted">Quoted</SelectItem>
                      <SelectItem value="canceled">Canceled</SelectItem>
                      <SelectItem value="accepted">Accepted</SelectItem>
                      <SelectItem value="declined">Declined</SelectItem>
                      <SelectItem value="expired">Expired</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-sm font-semibold">Start Time</Label>
                  <div className="text-sm">
                    {selectedEstimate.start_time 
                      ? moment.utc(selectedEstimate.start_time).tz(accountTimezone).format("MMMM D, YYYY h:mm A")
                      : "N/A"}
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-sm font-semibold">End Time</Label>
                  <div className="text-sm">
                    {selectedEstimate.end_time 
                      ? moment.utc(selectedEstimate.end_time).tz(accountTimezone).format("MMMM D, YYYY h:mm A")
                      : "N/A"}
                  </div>
                </div>
                {selectedEstimate.notes && (
                  <div className="space-y-1">
                    <Label className="text-sm font-semibold">Notes</Label>
                    <div className="text-sm whitespace-pre-wrap">{selectedEstimate.notes}</div>
                  </div>
                )}
                {selectedEstimate.source && (
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-semibold">Source</Label>
                    <span className="text-sm">{selectedEstimate.source}</span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-semibold">Users Count</Label>
                  <span className="text-sm">{selectedEstimate.users_count || 0}</span>
                </div>
              </div>
              <div className="pt-4 border-t">
                <Button
                  variant="destructive"
                  onClick={() => setDeleteEstimateDialogOpen(true)}
                  className="w-full"
                  disabled={isDeletingEstimate}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Estimate
                </Button>
              </div>
            </div>
          )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Estimate Confirmation Dialog */}
      <Dialog 
        open={deleteEstimateDialogOpen} 
        onOpenChange={(open) => {
          if (!isDeletingEstimate) {
            setDeleteEstimateDialogOpen(open);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-destructive" />
              Delete Estimate
            </DialogTitle>
            <DialogDescription>
              You're about to delete "{selectedEstimate?.title || 'this estimate'}"
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <Alert variant="destructive">
              <AlertDescription>
                Are you sure you want to delete "{selectedEstimate?.title || 'this estimate'}"? This action cannot be undone.
              </AlertDescription>
            </Alert>
          </div>

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setDeleteEstimateDialogOpen(false)} 
              disabled={isDeletingEstimate}
            >
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleDeleteEstimate} 
              disabled={isDeletingEstimate}
            >
              {isDeletingEstimate ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
        <EditJobDialog
          job={editingJob}
          open={editDialogOpen}
          onClose={() => {
            setEditDialogOpen(false);
            setSelectedJob(editingJob);  // reopen JobCard
            setEditingJob(null);         // clear temporary
            // Reopen the parent Job Details dialog
            setSelectedJobId(editingJob?.id || editingJob?.job_id);
          }}
          users={users}
          handleJobUpdate={handleJobUpdate}
          accountTimezone={accountTimezone}
        />

      {/* Time Picker Dialog for Drag and Drop */}
      <Dialog 
        open={timePickerOpen} 
        onOpenChange={(open) => {
          if (!isUpdatingTime) {
            setTimePickerOpen(open);
            if (!open) {
              setDraggedJob(null);
              setNewDate(null);
              setIsUpdatingTime(false);
            }
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Select Time</DialogTitle>
            <DialogDescription>
              Choose the time for {draggedJob?.customer_name || draggedJob?.title || "this job"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Date</Label>
              <div className="text-sm font-medium">
                {newDate ? moment(newDate).format("MMMM D, YYYY") : ""}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Hour</Label>
                <Select
                  value={selectedTime.hour}
                  onValueChange={(value) => setSelectedTime({ ...selectedTime, hour: value })}
                  disabled={isUpdatingTime}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((h) => (
                      <SelectItem key={h} value={h.toString()}>
                        {h}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Minute</Label>
                <Select
                  value={selectedTime.minute}
                  onValueChange={(value) => setSelectedTime({ ...selectedTime, minute: value })}
                  disabled={isUpdatingTime}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["00", "15", "30", "45"].map((m) => (
                      <SelectItem key={m} value={m}>
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Period</Label>
                <Select
                  value={selectedTime.period}
                  onValueChange={(value) => setSelectedTime({ ...selectedTime, period: value })}
                  disabled={isUpdatingTime}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="AM">AM</SelectItem>
                    <SelectItem value="PM">PM</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {isUpdatingTime ? (
              <div className="flex items-center justify-center gap-2 py-4">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                <span className="text-sm text-muted-foreground">Updating schedule...</span>
              </div>
            ) : (
              <div className="flex justify-end gap-2 pt-4">
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setTimePickerOpen(false);
                    setDraggedJob(null);
                    setNewDate(null);
                    setIsUpdatingTime(false);
                  }}
                  disabled={isUpdatingTime}
                >
                  Cancel
                </Button>
                <Button 
                  onClick={handleTimePickerConfirm}
                  disabled={isUpdatingTime}
                  className="min-w-[100px]"
                >
                  {isUpdatingTime ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    "Confirm"
                  )}
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Undo Notification */}
      {lastUpdateInfo && !timePickerOpen && (
        <div className="fixed bottom-4 right-4 z-50 animate-in slide-in-from-bottom-2">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-4 max-w-sm">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  Schedule updated successfully
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Time has been changed for this job
                </p>
              </div>
              <div className="flex-shrink-0 flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleUndoTimeChange}
                  disabled={isUpdatingTime}
                  className="h-8 px-3"
                >
                  {isUpdatingTime ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <>
                      <RotateCcw className="h-3 w-3 mr-1" />
                      Undo
                    </>
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setLastUpdateInfo(null)}
                  className="h-8 w-8 p-0"
                >
                  ×
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}